import * as ort from 'onnxruntime-web/wasm';
import { getForegroundRegions, type ForegroundImageRegion } from './foregroundRegion';
import { CLIENT_AI_SEGMENTATION_INPUT_SIZE, postprocessU2NetMask } from './clientAiSegmentationShared';

const MODEL_URL = '/models/u2netp.onnx';
const MEAN = [0.485, 0.456, 0.406] as const;
const STD = [0.229, 0.224, 0.225] as const;

type WorkerRequest =
  | { id: number; action: 'warmup' }
  | {
      id: number;
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

type WorkerScope = {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
};

const scope = self as unknown as WorkerScope;
let sessionPromise: Promise<ort.InferenceSession> | null = null;
let queue: Promise<void> = Promise.resolve();

function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    // This dedicated worker is already off the UI thread; do not create a nested ORT proxy worker.
    ort.env.wasm.wasmPaths = '/forza-runtime/ort/';
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    }).catch((error: unknown) => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

async function handleRequest(request: WorkerRequest): Promise<void> {
  try {
    const session = await getSession();
    if (request.action === 'warmup') {
      scope.postMessage({ id: request.id, ok: true });
      return;
    }

    const { width, height, modelRect } = request;
    const INPUT_SIZE = CLIENT_AI_SEGMENTATION_INPUT_SIZE;
    const plane = INPUT_SIZE * INPUT_SIZE;
    const inputPixels = new Uint8ClampedArray(request.inputPixelsBuffer);
    const sourcePixels = new Uint8ClampedArray(request.sourcePixelsBuffer);
    if (inputPixels.length < plane * 4 || sourcePixels.length < width * height * 4) {
      throw new Error('client_segmentation_invalid_pixel_buffers');
    }

    const tensorData = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i++) {
      tensorData[i] = (inputPixels[i * 4] / 255 - MEAN[0]) / STD[0];
      tensorData[plane + i] = (inputPixels[i * 4 + 1] / 255 - MEAN[1]) / STD[1];
      tensorData[2 * plane + i] = (inputPixels[i * 4 + 2] / 255 - MEAN[2]) / STD[2];
    }

    const inputName = session.inputNames[0] || 'input.1';
    const outputName = session.outputNames[0] || '1959';
    const inputTensor = new ort.Tensor('float32', tensorData, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    const outputs = await session.run({ [inputName]: inputTensor }) as Record<string, ort.Tensor>;
    const output = outputs[outputName];
    if (!output?.data) throw new Error('client_segmentation_missing_model_output');

    const alphaMask = postprocessU2NetMask(output.data as ArrayLike<number>, width, height, modelRect);
    if (!alphaMask) throw new Error('client_segmentation_invalid_model_mask');

    const regions = getForegroundRegions({ width, height, alphaMask });
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

    if (foregroundPixels < width * height * 0.004) {
      throw new Error('client_segmentation_foreground_too_small');
    }
    if (!regions.length) {
      throw new Error('client_segmentation_no_conservative_region');
    }

    const alphaMaskBuffer = alphaMask.buffer as ArrayBuffer;
    const compositeBuffer = composite.buffer as ArrayBuffer;
    scope.postMessage({
      id: request.id,
      ok: true,
      alphaMask: alphaMaskBuffer,
      composite: compositeBuffer,
      regions,
      foregroundPixels,
    }, [alphaMaskBuffer, compositeBuffer]);
  } catch (error) {
    scope.postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

scope.onmessage = (event) => {
  // A single model session is reused and requests are serialized to bound mobile CPU/memory use.
  queue = queue.then(() => handleRequest(event.data)).catch(() => undefined);
};
