import { W, H, B64 } from './pixels';
import { buildParticleLayers, buildParticlePosterPixels } from './particleLayers.shared';

type WorkerScope = {
  onmessage: ((event: MessageEvent<{ type: string }>) => void) | null;
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
    const layers = buildParticleLayers(pixels, W, H);
    const posterPixels = buildParticlePosterPixels(pixels);
    let poster: ImageBitmap | null = null;
    let transferablePosterPixels: Uint8ClampedArray | null = posterPixels;

    // OffscreenCanvas keeps poster preparation away from the UI thread too.
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(W, H);
        const context = canvas.getContext('2d');
        if (context) {
          context.putImageData(new ImageData(posterPixels, W, H), 0, 0);
          poster = await createImageBitmap(canvas);
          transferablePosterPixels = null;
        }
      }
    } catch {
      // Main thread can build the tiny 2D poster if OffscreenCanvas is absent.
    }

    const transfer: Transferable[] = [
      layers.sharp.pos.buffer, layers.sharp.col.buffer, layers.sharp.start.buffer,
      layers.sharp.seed.buffer, layers.sharp.lum.buffer,
      layers.glow.pos.buffer, layers.glow.col.buffer, layers.glow.start.buffer,
      layers.glow.seed.buffer, layers.glow.lum.buffer,
    ];
    if (poster) transfer.push(poster);
    else if (transferablePosterPixels) transfer.push(transferablePosterPixels.buffer);

    workerScope.postMessage({
      type: 'ready',
      width: W,
      height: H,
      layers,
      poster,
      posterPixels: transferablePosterPixels,
    }, transfer);
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'particle_worker_failed',
    });
  }
};
