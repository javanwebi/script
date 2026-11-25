import * as ort from 'onnxruntime-web/wasm';
export { getForegroundRegion, getForegroundRegions } from './foregroundRegion';
export type { ForegroundImageRegion } from './foregroundRegion';

export interface ClientAiSegmentationResult {
  width: number;
  height: number;
  alphaMask: Uint8Array;
  whiteBgDataUrl: string;
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
  modelRect: { x: number; y: number; width: number; height: number } = {
    x: 0, y: 0, width: INPUT_SIZE, height: INPUT_SIZE,
  },
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
  if (max < 0.14 || range < 0.09) return null;

  // U2NET exports a sigmoid saliency map in [0,1]. Preserve its calibrated
  // probabilities; normalize only non-probability model outputs.
  const isProbabilityMap = min >= -0.001 && max <= 1.001;
  const normalized = new Float32Array(plane);
  for (let i = 0; i < plane; i++) {
    const raw = Number(rawScores[i]);
    normalized[i] = Math.max(0, Math.min(1, isProbabilityMap ? raw : (raw - min) / range));
  }

  const left = Math.max(0, Math.min(INPUT_SIZE - 1, modelRect.x));
  const top = Math.max(0, Math.min(INPUT_SIZE - 1, modelRect.y));
  const right = Math.max(left + 1, Math.min(INPUT_SIZE, modelRect.x + modelRect.width));
  const bottom = Math.max(top + 1, Math.min(INPUT_SIZE, modelRect.y + modelRect.height));
  const mask = new Uint8Array(targetWidth * targetHeight);

  for (let y = 0; y < targetHeight; y++) {
    const fy = top + (y + 0.5) * ((bottom - top) / targetHeight) - 0.5;
    const y0 = Math.max(Math.floor(top), Math.min(Math.ceil(bottom) - 1, Math.floor(fy)));
    const y1 = Math.max(y0, Math.min(Math.ceil(bottom) - 1, y0 + 1));
    const wy = Math.max(0, Math.min(1, fy - y0));
    for (let x = 0; x < targetWidth; x++) {
      const fx = left + (x + 0.5) * ((right - left) / targetWidth) - 0.5;
      const x0 = Math.max(Math.floor(left), Math.min(Math.ceil(right) - 1, Math.floor(fx)));
      const x1 = Math.max(x0, Math.min(Math.ceil(right) - 1, x0 + 1));
      const wx = Math.max(0, Math.min(1, fx - x0));
      const topValue = normalized[y0 * INPUT_SIZE + x0] * (1 - wx) + normalized[y0 * INPUT_SIZE + x1] * wx;
      const bottomValue = normalized[y1 * INPUT_SIZE + x0] * (1 - wx) + normalized[y1 * INPUT_SIZE + x1] * wx;
      mask[y * targetWidth + x] = Math.round((topValue * (1 - wy) + bottomValue * wy) * 255);
    }
  }
  return mask;
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

    // Preserve the source aspect ratio. Stretching every portrait/landscape
    // photo into a square distorts industrial parts and shifts the crop bounds.
    const modelScale = Math.min(INPUT_SIZE / width, INPUT_SIZE / height);
    const modelWidth = Math.max(1, Math.round(width * modelScale));
    const modelHeight = Math.max(1, Math.round(height * modelScale));
    const modelLeft = Math.floor((INPUT_SIZE - modelWidth) / 2);
    const modelTop = Math.floor((INPUT_SIZE - modelHeight) / 2);
    // Fill with ImageNet mean RGB so padding becomes neutral after normalization.
    inputContext.fillStyle = 'rgb(124,116,104)';
    inputContext.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
    inputContext.imageSmoothingEnabled = true;
    inputContext.imageSmoothingQuality = 'high';
    inputContext.drawImage(sourceCanvas, 0, 0, width, height, modelLeft, modelTop, modelWidth, modelHeight);
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

    const alphaMask = postprocessU2NetMask(output.data as ArrayLike<number>, width, height, { x: modelLeft, y: modelTop, width: modelWidth, height: modelHeight });
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
