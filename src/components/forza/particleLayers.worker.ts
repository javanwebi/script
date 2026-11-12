import { W, H, B64 } from './pixels';
import { buildParticleLayers, buildParticlePosterPixels } from './particleLayers.shared';

type WorkerScope = {
  onmessage: ((event: MessageEvent<{ type: string; includeLayers?: boolean }>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

const workerScope = self as unknown as WorkerScope;

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

workerScope.onmessage = async event => {
  if (event.data?.type !== 'build') return;
  try {
    const pixels = decodeBase64(B64);

    // Publish the exact FORZA silhouette before the expensive point-cloud
    // preprocessing. The main thread can paint it immediately while this
    // worker builds the interactive WebGL particle buffers.
    const posterPixels = buildParticlePosterPixels(pixels);
    let poster: ImageBitmap | null = null;
    let transferablePosterPixels: Uint8ClampedArray | null = posterPixels;

    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(W, H);
        const context = canvas.getContext('2d');
        if (context) {
          const imageData = context.createImageData(W, H);
          imageData.data.set(posterPixels);
          context.putImageData(imageData, 0, 0);
          poster = await createImageBitmap(canvas);
          transferablePosterPixels = null;
        }
      }
    } catch {
      // Transfer the RGBA buffer when OffscreenCanvas/ImageBitmap is unavailable.
    }

    const posterTransfer: Transferable[] = [];
    if (poster) posterTransfer.push(poster);
    else if (transferablePosterPixels) posterTransfer.push(transferablePosterPixels.buffer as ArrayBuffer);

    workerScope.postMessage({
      type: 'poster',
      width: W,
      height: H,
      poster,
      posterPixels: transferablePosterPixels,
    }, posterTransfer);

    // Unsupported-WebGL devices need only the poster. On supported devices,
    // continue the heavy preprocessing here without blocking the UI thread.
    const layers = event.data.includeLayers === false ? null : buildParticleLayers(pixels, W, H);
    const transfer: Transferable[] = [];
    if (layers) {
      transfer.push(
        layers.sharp.pos.buffer as ArrayBuffer, layers.sharp.col.buffer as ArrayBuffer, layers.sharp.start.buffer as ArrayBuffer,
        layers.sharp.seed.buffer as ArrayBuffer, layers.sharp.lum.buffer as ArrayBuffer,
        layers.glow.pos.buffer as ArrayBuffer, layers.glow.col.buffer as ArrayBuffer, layers.glow.start.buffer as ArrayBuffer,
        layers.glow.seed.buffer as ArrayBuffer, layers.glow.lum.buffer as ArrayBuffer,
      );
    }

    workerScope.postMessage({
      type: 'ready',
      width: W,
      height: H,
      layers,
      poster: null,
      posterPixels: null,
    }, transfer);
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'particle_worker_failed',
    });
  }
};
