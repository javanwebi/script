import * as ort from 'onnxruntime-web';

export interface ClientAiSegmentationResult {
  width: number;
  height: number;
  alphaMask: Uint8Array;
  whiteBgDataUrl: string;
}

export interface ForegroundImageRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MODEL_URL = '/models/u2netp.onnx';
const INPUT_SIZE = 320;
const MAX_IMAGE_DIMENSION = 860;
const INFERENCE_TIMEOUT_MS = 28_000;
const MEAN = [0.485, 0.456, 0.406] as const;
const STD = [0.229, 0.224, 0.225] as const;

let sessionPromise: Promise<ort.InferenceSession> | null = null;
let runtimeConfigured = false;

function configureRuntime() {
  if (runtimeConfigured) return;
  ort.env.wasm.wasmPaths = '/forza-runtime/ort/';
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  runtimeConfigured = true;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('client_segmentation_timeout')), timeoutMs);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

export function getOnnxSegmentationSession(): Promise<ort.InferenceSession> {
  configureRuntime();
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    }).catch((error: unknown) => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise!;
}

export async function preloadClientAiSegmentation(): Promise<void> {
  try {
    await withTimeout(getOnnxSegmentationSession(), INFERENCE_TIMEOUT_MS);
  } catch {
    // Segmentation is an enhancement; the existing server/manual region flow remains available.
  }
}

export function postprocessU2NetMask(
  rawScores: ArrayLike<number>,
  targetWidth: number,
  targetHeight: number,
): Uint8Array | null {
  const plane = INPUT_SIZE * INPUT_SIZE;
  if (!targetWidth || !targetHeight || rawScores.length < plane) return null;

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < plane; i++) {
    const value = Number(rawScores[i]);
    if (!Number.isFinite(value)) return null;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const range = max - min;
  if (max < 0.18 || range < 0.12) return null;

  const normalized = new Float32Array(plane);
  for (let i = 0; i < plane; i++) {
    normalized[i] = Math.max(0, Math.min(1, (Number(rawScores[i]) - min) / range));
  }

  const mask = new Uint8Array(targetWidth * targetHeight);
  for (let y = 0; y < targetHeight; y++) {
    const fy = (y + 0.5) * (INPUT_SIZE / targetHeight) - 0.5;
    const y0 = Math.max(0, Math.min(INPUT_SIZE - 1, Math.floor(fy)));
    const y1 = Math.min(INPUT_SIZE - 1, y0 + 1);
    const wy = Math.max(0, Math.min(1, fy - y0));
    for (let x = 0; x < targetWidth; x++) {
      const fx = (x + 0.5) * (INPUT_SIZE / targetWidth) - 0.5;
      const x0 = Math.max(0, Math.min(INPUT_SIZE - 1, Math.floor(fx)));
      const x1 = Math.min(INPUT_SIZE - 1, x0 + 1);
      const wx = Math.max(0, Math.min(1, fx - x0));
      const top = normalized[y0 * INPUT_SIZE + x0] * (1 - wx) +
        normalized[y0 * INPUT_SIZE + x1] * wx;
      const bottom = normalized[y1 * INPUT_SIZE + x0] * (1 - wx) +
        normalized[y1 * INPUT_SIZE + x1] * wx;
      const value = Math.round((top * (1 - wy) + bottom * wy) * 255);
      mask[y * targetWidth + x] = value < 22 ? 0 : value > 232 ? 255 : value;
    }
  }
  return mask;
}

/** Returns a conservative padded bounding box, or null when the mask is empty or implausibly broad. */
export function getForegroundRegion(
  result: Pick<ClientAiSegmentationResult, 'width' | 'height' | 'alphaMask'>,
  threshold = 110,
): ForegroundImageRegion | null {
  const { width, height, alphaMask } = result;
  if (!width || !height || alphaMask.length < width * height) return null;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let foregroundPixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alphaMask[y * width + x] < threshold) continue;
      foregroundPixels++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const total = width * height;
  if (foregroundPixels < total * 0.004 || foregroundPixels > total * 0.96 || maxX < minX || maxY < minY) {
    return null;
  }

  const padX = Math.max(2, Math.round(width * 0.025));
  const padY = Math.max(2, Math.round(height * 0.025));
  const left = Math.max(0, minX - padX);
  const top = Math.max(0, minY - padY);
  const right = Math.min(width, maxX + 1 + padX);
  const bottom = Math.min(height, maxY + 1 + padY);
  const region = {
    x: left / width,
    y: top / height,
    width: (right - left) / width,
    height: (bottom - top) / height,
  };
  if (region.width < 0.025 || region.height < 0.025 || region.width * region.height > 0.96) return null;
  return region;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:\/\//i.test(src)) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('segment_image_load_failed'));
    image.src = src;
  });
}

export async function segmentImageWithClientAi(src: string): Promise<ClientAiSegmentationResult | null> {
  if (!src || typeof window === 'undefined') return null;
  try {
    const [session, image] = await Promise.all([
      withTimeout(getOnnxSegmentationSession(), INFERENCE_TIMEOUT_MS),
      loadImage(src),
    ]);

    const naturalWidth = image.naturalWidth || image.width || 640;
    const naturalHeight = image.naturalHeight || image.height || 640;
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(naturalWidth, naturalHeight));
    const width = Math.max(32, Math.round(naturalWidth * scale));
    const height = Math.max(32, Math.round(naturalHeight * scale));

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!sourceContext) return null;
    sourceContext.fillStyle = '#FFFFFF';
    sourceContext.fillRect(0, 0, width, height);
    sourceContext.drawImage(image, 0, 0, width, height);
    const sourcePixels = sourceContext.getImageData(0, 0, width, height).data;

    const inputCanvas = document.createElement('canvas');
    inputCanvas.width = INPUT_SIZE;
    inputCanvas.height = INPUT_SIZE;
    const inputContext = inputCanvas.getContext('2d', { willReadFrequently: true });
    if (!inputContext) return null;
    inputContext.drawImage(sourceCanvas, 0, 0, INPUT_SIZE, INPUT_SIZE);
    const inputPixels = inputContext.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;

    const plane = INPUT_SIZE * INPUT_SIZE;
    const tensorData = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i++) {
      tensorData[i] = (inputPixels[i * 4] / 255 - MEAN[0]) / STD[0];
      tensorData[plane + i] = (inputPixels[i * 4 + 1] / 255 - MEAN[1]) / STD[1];
      tensorData[2 * plane + i] = (inputPixels[i * 4 + 2] / 255 - MEAN[2]) / STD[2];
    }

    const inputName = session.inputNames[0] || 'input.1';
    const outputName = session.outputNames[0] || '1959';
    const inputTensor = new ort.Tensor('float32', tensorData, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    const outputs = await withTimeout(
      session.run({ [inputName]: inputTensor }),
      INFERENCE_TIMEOUT_MS,
    ) as Record<string, ort.Tensor>;
    const output = outputs[outputName];
    if (!output?.data) return null;

    const alphaMask = postprocessU2NetMask(output.data as ArrayLike<number>, width, height);
    if (!alphaMask) return null;

    const composite = new Uint8ClampedArray(width * height * 4);
    let foregroundPixels = 0;
    for (let i = 0; i < width * height; i++) {
      const alpha = alphaMask[i];
      if (alpha >= 110) foregroundPixels++;
      const a = alpha / 255;
      const inverse = 1 - a;
      const offset = i * 4;
      composite[offset] = Math.round(sourcePixels[offset] * a + 255 * inverse);
      composite[offset + 1] = Math.round(sourcePixels[offset + 1] * a + 255 * inverse);
      composite[offset + 2] = Math.round(sourcePixels[offset + 2] * a + 255 * inverse);
      composite[offset + 3] = 255;
    }
    if (foregroundPixels < width * height * 0.004) return null;

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = width;
    outputCanvas.height = height;
    const outputContext = outputCanvas.getContext('2d');
    if (!outputContext) return null;
    outputContext.putImageData(new ImageData(composite, width, height), 0, 0);

    return {
      width,
      height,
      alphaMask,
      whiteBgDataUrl: outputCanvas.toDataURL('image/jpeg', 0.92),
    };
  } catch {
    return null;
  }
}
