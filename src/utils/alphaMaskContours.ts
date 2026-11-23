import type { ImageRegion } from './imageRegion';

export interface ContourPoint {
  x: number;
  y: number;
}

export interface AlphaMaskData {
  width: number;
  height: number;
  alphaMask: Uint8Array;
}

export interface AlphaMaskContour {
  region: ImageRegion;
  polygon: ContourPoint[];
  areaRatio: number;
}

const MAX_SAMPLE_DIMENSION = 220;
const MIN_COMPONENT_RATIO = 0.0015;
const MAX_COMPONENTS = 8;
const NEIGHBORS_8 = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],             [1, 0],
  [-1, 1],  [0, 1],   [1, 1],
] as const;
const NEIGHBORS_4 = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

function convexHull(points: ContourPoint[]): ContourPoint[] {
  if (points.length <= 2) return points;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: ContourPoint, a: ContourPoint, b: ContourPoint) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: ContourPoint[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: ContourPoint[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Extracts independent foreground components from a local alpha matte.
 * The polygon is deliberately a conservative hull: the original alpha matte
 * remains the authoritative silhouette when the crop is composited.
 */
export function extractAlphaMaskContours(
  data: AlphaMaskData,
  threshold = 110,
): AlphaMaskContour[] {
  const { width, height, alphaMask } = data;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return [];
  if (!alphaMask || alphaMask.length < width * height) return [];

  const scale = Math.min(1, MAX_SAMPLE_DIMENSION / Math.max(width, height));
  const sampleWidth = Math.max(1, Math.round(width * scale));
  const sampleHeight = Math.max(1, Math.round(height * scale));
  const total = sampleWidth * sampleHeight;
  const mask = new Uint8Array(total);

  for (let y = 0; y < sampleHeight; y++) {
    const sourceY = Math.min(height - 1, Math.floor(((y + 0.5) / sampleHeight) * height));
    for (let x = 0; x < sampleWidth; x++) {
      const sourceX = Math.min(width - 1, Math.floor(((x + 0.5) / sampleWidth) * width));
      mask[y * sampleWidth + x] = alphaMask[sourceY * width + sourceX] >= threshold ? 1 : 0;
    }
  }

  const labels = new Int32Array(total);
  const queue = new Int32Array(total);
  const minimumPixels = Math.max(5, Math.ceil(total * MIN_COMPONENT_RATIO));
  const contours: AlphaMaskContour[] = [];
  let componentId = 0;

  for (let start = 0; start < total; start++) {
    if (!mask[start] || labels[start]) continue;
    componentId++;
    let read = 0;
    let write = 0;
    queue[write++] = start;
    labels[start] = componentId;
    let minX = sampleWidth;
    let minY = sampleHeight;
    let maxX = -1;
    let maxY = -1;

    while (read < write) {
      const index = queue[read++];
      const x = index % sampleWidth;
      const y = Math.floor(index / sampleWidth);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      for (const [dx, dy] of NEIGHBORS_8) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= sampleWidth || ny >= sampleHeight) continue;
        const next = ny * sampleWidth + nx;
        if (!mask[next] || labels[next]) continue;
        labels[next] = componentId;
        queue[write++] = next;
      }
    }

    if (write < minimumPixels) continue;

    const boundary: ContourPoint[] = [];
    for (let i = 0; i < write; i++) {
      const index = queue[i];
      const x = index % sampleWidth;
      const y = Math.floor(index / sampleWidth);
      const isBoundary = NEIGHBORS_4.some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx < 0 || ny < 0 || nx >= sampleWidth || ny >= sampleHeight ||
          labels[ny * sampleWidth + nx] !== componentId;
      });
      if (isBoundary) boundary.push({ x: (x + 0.5) / sampleWidth, y: (y + 0.5) / sampleHeight });
    }

    const polygon = convexHull(boundary);
    if (polygon.length < 3) continue;

    const padX = Math.max(1, Math.round(sampleWidth * 0.012));
    const padY = Math.max(1, Math.round(sampleHeight * 0.012));
    const left = Math.max(0, minX - padX);
    const top = Math.max(0, minY - padY);
    const right = Math.min(sampleWidth, maxX + 1 + padX);
    const bottom = Math.min(sampleHeight, maxY + 1 + padY);

    contours.push({
      region: {
        x: left / sampleWidth,
        y: top / sampleHeight,
        width: (right - left) / sampleWidth,
        height: (bottom - top) / sampleHeight,
      },
      polygon,
      areaRatio: write / total,
    });
  }

  return contours.sort((a, b) => b.areaRatio - a.areaRatio).slice(0, MAX_COMPONENTS);
}

/** Chooses the component that best overlaps the user's confirmed image region. */
export function selectAlphaMaskContour(
  contours: AlphaMaskContour[],
  selectedRegion?: ImageRegion,
  minimumOverlap = 0.35,
): AlphaMaskContour | null {
  if (!contours.length) return null;
  if (!selectedRegion) return contours[0];

  const selectedArea = Math.max(0.000001, selectedRegion.width * selectedRegion.height);
  const matches: AlphaMaskContour[] = [];

  for (const contour of contours) {
    const region = contour.region;
    const intersectionWidth = Math.max(
      0,
      Math.min(selectedRegion.x + selectedRegion.width, region.x + region.width) -
        Math.max(selectedRegion.x, region.x),
    );
    const intersectionHeight = Math.max(
      0,
      Math.min(selectedRegion.y + selectedRegion.height, region.y + region.height) -
        Math.max(selectedRegion.y, region.y),
    );
    const intersection = intersectionWidth * intersectionHeight;
    const componentArea = Math.max(0.000001, region.width * region.height);
    const overlap = intersection / Math.min(selectedArea, componentArea);
    if (overlap >= minimumOverlap) matches.push(contour);
  }

  // A rectangle may contain a complete assembly with several disconnected
  // foreground islands. In that case keep the full alpha matte instead of
  // silently discarding every component except the largest one.
  return matches.length === 1 ? matches[0] : null;
}
