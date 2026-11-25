export const CLIENT_AI_SEGMENTATION_INPUT_SIZE = 320;

export function postprocessU2NetMask(
  rawScores: ArrayLike<number>,
  targetWidth: number,
  targetHeight: number,
  modelRect: { x: number; y: number; width: number; height: number } = {
    x: 0, y: 0, width: CLIENT_AI_SEGMENTATION_INPUT_SIZE, height: CLIENT_AI_SEGMENTATION_INPUT_SIZE,
  },
): Uint8Array | null {
  const INPUT_SIZE = CLIENT_AI_SEGMENTATION_INPUT_SIZE;
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
