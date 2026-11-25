import { CLIENT_AI_SEGMENTATION_INPUT_SIZE } from './clientAiSegmentationShared';
import type { ForegroundImageRegion } from './foregroundRegion';
export { getForegroundRegion, getForegroundRegions } from './foregroundRegion';
export { postprocessU2NetMask } from './clientAiSegmentationShared';
export type { ForegroundImageRegion } from './foregroundRegion';

export interface ClientAiSegmentationResult {
  width: number;
  height: number;
  alphaMask: Uint8Array;
  whiteBgDataUrl: string;
  regions: ForegroundImageRegion[];
  foregroundPixels: number;
}

const MODEL_INPUT_SIZE = CLIENT_AI_SEGMENTATION_INPUT_SIZE;
const MAX_IMAGE_DIMENSION = 720;
const INFERENCE_TIMEOUT_MS = 28_000;

type WorkerRequestPayload =
  | { action: 'warmup' }
  | {
      action: 'segment';
      width: number;
      height: number;
      modelRect: { x: number; y: number; width: number; height: number };
      inputPixelsBuffer: ArrayBuffer;
      sourcePixelsBuffer: ArrayBuffer;
    };

type WorkerResponse = {
  id: number;
  ok: boolean;
  error?: string;
  alphaMask?: ArrayBuffer;
  composite?: ArrayBuffer;
  regions?: ForegroundImageRegion[];
  foregroundPixels?: number;
};

type PendingRequest = {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
  timer: number;
};

let segmentationWorker: Worker | null = null;
let workerRequestId = 0;
const pendingRequests = new Map<number, PendingRequest>();

function rejectWorkerRequests(instance: Worker, error: Error) {
  if (segmentationWorker === instance) segmentationWorker = null;
  instance.terminate();
  for (const pending of pendingRequests.values()) {
    window.clearTimeout(pending.timer);
    pending.reject(error);
  }
  pendingRequests.clear();
}

function getSegmentationWorker(): Worker {
  if (segmentationWorker) return segmentationWorker;
  if (typeof Worker === 'undefined') throw new Error('client_segmentation_worker_unavailable');

  const instance = new Worker(
    new URL('./clientAiSegmentation.worker.ts', import.meta.url),
    { type: 'module', name: 'forza-u2netp-segmentation' },
  );
  instance.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const pending = pendingRequests.get(event.data.id);
    if (!pending) return;
    window.clearTimeout(pending.timer);
    pendingRequests.delete(event.data.id);
    if (event.data.ok) pending.resolve(event.data);
    else pending.reject(new Error(event.data.error || 'client_segmentation_worker_failed'));
  };
  instance.onerror = (event: ErrorEvent) => {
    rejectWorkerRequests(instance, new Error(event.message || 'client_segmentation_worker_crashed'));
  };
  instance.onmessageerror = () => {
    rejectWorkerRequests(instance, new Error('client_segmentation_worker_message_failed'));
  };
  segmentationWorker = instance;
  return instance;
}

function requestWorker(
  payload: WorkerRequestPayload,
  transfer: Transferable[] = [],
): Promise<WorkerResponse> {
  const id = ++workerRequestId;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('client_segmentation_timeout'));
    }, INFERENCE_TIMEOUT_MS);
    pendingRequests.set(id, { resolve, reject, timer });
    try {
      getSegmentationWorker().postMessage({ ...payload, id }, transfer);
    } catch (error) {
      window.clearTimeout(timer);
      pendingRequests.delete(id);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export async function preloadClientAiSegmentation(): Promise<void> {
  try {
    await requestWorker({ action: 'warmup' });
  } catch {
    // The enhancement fails closed; the server-side region detector remains the fallback.
  }
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
    const image = await loadImage(src);
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
    inputCanvas.width = MODEL_INPUT_SIZE;
    inputCanvas.height = MODEL_INPUT_SIZE;
    const inputContext = inputCanvas.getContext('2d', { willReadFrequently: true });
    if (!inputContext) return null;

    // Preserve the source aspect ratio. Stretching every portrait/landscape
    // photo into a square distorts industrial parts and shifts the crop bounds.
    const modelScale = Math.min(MODEL_INPUT_SIZE / width, MODEL_INPUT_SIZE / height);
    const modelWidth = Math.max(1, Math.round(width * modelScale));
    const modelHeight = Math.max(1, Math.round(height * modelScale));
    const modelLeft = Math.floor((MODEL_INPUT_SIZE - modelWidth) / 2);
    const modelTop = Math.floor((MODEL_INPUT_SIZE - modelHeight) / 2);
    // Fill with ImageNet mean RGB so padding becomes neutral after normalization.
    inputContext.fillStyle = 'rgb(124,116,104)';
    inputContext.fillRect(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
    inputContext.imageSmoothingEnabled = true;
    inputContext.imageSmoothingQuality = 'high';
    inputContext.drawImage(sourceCanvas, 0, 0, width, height, modelLeft, modelTop, modelWidth, modelHeight);
    const inputPixels = inputContext.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE).data;

    const inputPixelsBuffer = inputPixels.buffer as ArrayBuffer;
    const sourcePixelsBuffer = sourcePixels.buffer as ArrayBuffer;
    const response = await requestWorker({
      action: 'segment',
      width,
      height,
      modelRect: { x: modelLeft, y: modelTop, width: modelWidth, height: modelHeight },
      inputPixelsBuffer,
      sourcePixelsBuffer,
    }, [inputPixelsBuffer, sourcePixelsBuffer]);

    if (!response.alphaMask || !response.composite || !response.regions) return null;
    const alphaMask = new Uint8Array(response.alphaMask);
    const composite = new Uint8ClampedArray(response.composite);

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
      regions: response.regions,
      foregroundPixels: response.foregroundPixels || 0,
      whiteBgDataUrl: outputCanvas.toDataURL('image/jpeg', 0.92),
    };
  } catch {
    return null;
  }
}
