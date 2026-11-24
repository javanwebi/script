export interface ForegroundImageRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

type MaskSource = {
  width: number;
  height: number;
  alphaMask: Uint8Array;
};

type Component = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  pixels: number;
  confidence: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * Splits a saliency mask into independently selectable foreground objects.
 * Eight-way connectivity keeps diagonal edges of circular/mechanical parts intact.
 */
function componentsAtThreshold(source: MaskSource, threshold: number): Component[] {
  const { width, height, alphaMask } = source;
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  const minimumPixels = Math.max(18, Math.floor(total * 0.0012));
  const components: Component[] = [];

  for (let seed = 0; seed < total; seed++) {
    if (visited[seed] || alphaMask[seed] < threshold) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = seed;
    visited[seed] = 1;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let pixels = 0;
    let confidence = 0;

    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      pixels++;
      confidence += alphaMask[index];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const next = ny * width + nx;
          if (visited[next] || alphaMask[next] < threshold) continue;
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }

    if (pixels < minimumPixels || maxX < minX || maxY < minY) continue;
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    const boxArea = boxWidth * boxHeight;
    const areaRatio = pixels / total;
    const boxRatio = boxArea / total;
    if (boxWidth < width * 0.018 || boxHeight < height * 0.018 || boxRatio > 0.965) continue;

    components.push({
      minX,
      minY,
      maxX,
      maxY,
      pixels,
      confidence: confidence / pixels,
    });
  }

  return components;
}

/**
 * Returns ranked object boxes from a local segmentation mask.
 * It tries progressively softer thresholds when the model produces a weak mask,
 * rejects tiny speckles and full-frame background masks, and preserves multiple
 * disconnected foreground objects for customer selection.
 */
export function getForegroundRegions(
  source: MaskSource,
  threshold = 110,
  limit = 6,
): ForegroundImageRegion[] {
  const { width, height, alphaMask } = source;
  if (!width || !height || alphaMask.length < width * height) return [];
  const total = width * height;
  let components: Component[] = [];

  for (const candidateThreshold of [threshold, Math.max(76, threshold - 24), Math.max(58, threshold - 42)]) {
    components = componentsAtThreshold(source, candidateThreshold);
    if (components.length) break;
  }
  if (!components.length) return [];

  const ranked = components.map(component => {
    const boxWidth = component.maxX - component.minX + 1;
    const boxHeight = component.maxY - component.minY + 1;
    const areaRatio = component.pixels / total;
    const boxArea = boxWidth * boxHeight;
    const fillRatio = component.pixels / Math.max(1, boxArea);
    const centerX = (component.minX + component.maxX + 1) / 2 / width;
    const centerY = (component.minY + component.maxY + 1) / 2 / height;
    const centerDistance = Math.hypot(centerX - 0.5, centerY - 0.5) / Math.SQRT1_2;
    const areaScore = Math.min(1, Math.sqrt(areaRatio / 0.18));
    const centerScore = 1 - clamp(centerDistance, 0, 1);
    const fillScore = Math.min(1, fillRatio / 0.72);
    const confidenceScore = clamp(component.confidence / 255, 0, 1);
    const score = areaScore * 0.48 + centerScore * 0.25 + fillScore * 0.17 + confidenceScore * 0.1;

    const padX = Math.max(2, Math.round(boxWidth * 0.045));
    const padY = Math.max(2, Math.round(boxHeight * 0.045));
    const left = Math.max(0, component.minX - padX);
    const top = Math.max(0, component.minY - padY);
    const right = Math.min(width, component.maxX + 1 + padX);
    const bottom = Math.min(height, component.maxY + 1 + padY);
    const region = {
      x: left / width,
      y: top / height,
      width: (right - left) / width,
      height: (bottom - top) / height,
    };
    return { region, score };
  });

  ranked.sort((a, b) => b.score - a.score);
  const unique: ForegroundImageRegion[] = [];
  for (const item of ranked) {
    const duplicate = unique.some(existing => {
      const intersectionWidth = Math.max(0, Math.min(existing.x + existing.width, item.region.x + item.region.width) - Math.max(existing.x, item.region.x));
      const intersectionHeight = Math.max(0, Math.min(existing.y + existing.height, item.region.y + item.region.height) - Math.max(existing.y, item.region.y));
      const intersection = intersectionWidth * intersectionHeight;
      const union = existing.width * existing.height + item.region.width * item.region.height - intersection;
      return union > 0 && intersection / union > 0.82;
    });
    if (!duplicate) unique.push(item.region);
    if (unique.length >= Math.max(1, limit)) break;
  }
  return unique;
}

export function getForegroundRegion(
  source: MaskSource,
  threshold = 110,
): ForegroundImageRegion | null {
  return getForegroundRegions(source, threshold, 1)[0] || null;
}
