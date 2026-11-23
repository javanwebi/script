import type { ImageRegion } from './imageRegion';

export interface ContourPoint {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
}

export interface DetectedPartContour {
  id: string;
  region: ImageRegion;
  polygon: ContourPoint[];
  center: ContourPoint;
  label?: string;
  partFamily?: string;
  edgeLocked?: boolean;
  fromAiMask?: boolean;
}

export interface AlphaMaskData {
  width: number;
  height: number;
  alphaMask: Uint8Array;
}

export interface VisualDescriptor {
  isDark: boolean;
  isMetallic: boolean;
  isElongated: boolean;
  isCircular: boolean;
  avgLuma: number;
  aspectRatio: number;
}

const SAMPLE_MAX_DIM = 220;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:\/\//i.test(src)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = src;
  });
}

export async function rotateImageDataUrl(src: string, rotationDeg: number): Promise<string> {
  const normalizedRot = ((rotationDeg % 360) + 360) % 360;
  if (normalizedRot === 0) return src;
  const img = await loadHtmlImage(src);
  const swapAxes = normalizedRot === 90 || normalizedRot === 270;
  const rawW = img.naturalWidth || img.width || 800;
  const rawH = img.naturalHeight || img.height || 600;
  const w = swapAxes ? rawH : rawW;
  const h = swapAxes ? rawW : rawH;

  const maxDim = 1280;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;

  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((normalizedRot * Math.PI) / 180);
  const drawW = swapAxes ? outH : outW;
  const drawH = swapAxes ? outW : outH;
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.9);
}

function drawRotatedToCanvas(img: HTMLImageElement, rotationDeg: number): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const normalizedRot = ((rotationDeg % 360) + 360) % 360;
  const swapAxes = normalizedRot === 90 || normalizedRot === 270;
  const rawW = img.naturalWidth || img.width || 400;
  const rawH = img.naturalHeight || img.height || 300;
  const rotW = swapAxes ? rawH : rawW;
  const rotH = swapAxes ? rawW : rawH;
  const scale = Math.min(1, SAMPLE_MAX_DIM / Math.max(rotW, rotH));
  const w = Math.max(64, Math.round(rotW * scale));
  const h = Math.max(64, Math.round(rotH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D unavailable');

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((normalizedRot * Math.PI) / 180);
  const drawW = swapAxes ? h : w;
  const drawH = swapAxes ? w : h;
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  const imgData = ctx.getImageData(0, 0, w, h);
  return { width: w, height: h, data: imgData.data };
}

/**
 * 3x3 Gaussian-smoothed RGB buffer to suppress sensor noise / fine surface texture.
 */
function smoothRgbBuffer(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const ym1 = y > 0 ? y - 1 : 0;
    const yp1 = y < h - 1 ? y + 1 : h - 1;
    for (let x = 0; x < w; x++) {
      const xm1 = x > 0 ? x - 1 : 0;
      const xp1 = x < w - 1 ? x + 1 : w - 1;
      const o = (y * w + x) * 3;
      const r0 = (ym1 * w + xm1) * 4;
      const r1 = (ym1 * w + x) * 4;
      const r2 = (ym1 * w + xp1) * 4;
      const r3 = (y * w + xm1) * 4;
      const r4 = (y * w + x) * 4;
      const r5 = (y * w + xp1) * 4;
      const r6 = (yp1 * w + xm1) * 4;
      const r7 = (yp1 * w + x) * 4;
      const r8 = (yp1 * w + xp1) * 4;
      for (let c = 0; c < 3; c++) {
        out[o + c] =
          (data[r0 + c] +
            2 * data[r1 + c] +
            data[r2 + c] +
            2 * data[r3 + c] +
            4 * data[r4 + c] +
            2 * data[r5 + c] +
            data[r6 + c] +
            2 * data[r7 + c] +
            data[r8 + c]) *
          0.0625;
      }
    }
  }
  return out;
}

/**
 * Fast LUT-backed sRGB -> CIE L*a*b* conversion.
 * L* in [0..100], a* & b* in [-128..127]. Separating luminance (L*) from
 * chromaticity (a*, b*) makes segmentation immune to table flash glare & shadows.
 */
const SRGB_TO_LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const s = i / 255;
  SRGB_TO_LIN[i] = s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function fLab(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

function convertRgbToLabBuffer(smoothRgb: Float32Array, pixelCount: number): Float32Array {
  const lab = new Float32Array(pixelCount * 3);
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 3;
    const r = SRGB_TO_LIN[Math.max(0, Math.min(255, Math.round(smoothRgb[o])))];
    const g = SRGB_TO_LIN[Math.max(0, Math.min(255, Math.round(smoothRgb[o + 1])))];
    const b = SRGB_TO_LIN[Math.max(0, Math.min(255, Math.round(smoothRgb[o + 2])))];

    const X = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
    const Y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
    const Z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;

    const fx = fLab(X);
    const fy = fLab(Y);
    const fz = fLab(Z);

    lab[o] = 116 * fy - 16;
    lab[o + 1] = 500 * (fx - fy);
    lab[o + 2] = 200 * (fy - fz);
  }
  return lab;
}

/**
 * Perceptual Lab vector Sobel gradient magnitude (chroma-weighted to highlight
 * true object boundaries while suppressing lighting sheen / wood grain).
 */
function computeLabEdgeMap(lab: Float32Array, w: number, h: number): Float32Array {
  const edges = new Float32Array(w * h);
  const channelWeights = [0.65, 1.35, 1.35];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      let gradSq = 0;
      const tlIdx = ((y - 1) * w + (x - 1)) * 3;
      const tcIdx = ((y - 1) * w + x) * 3;
      const trIdx = ((y - 1) * w + (x + 1)) * 3;
      const mlIdx = (y * w + (x - 1)) * 3;
      const mrIdx = (y * w + (x + 1)) * 3;
      const blIdx = ((y + 1) * w + (x - 1)) * 3;
      const bcIdx = ((y + 1) * w + x) * 3;
      const brIdx = ((y + 1) * w + (x + 1)) * 3;

      for (let c = 0; c < 3; c++) {
        const gx =
          -lab[tlIdx + c] +
          lab[trIdx + c] -
          2 * lab[mlIdx + c] +
          2 * lab[mrIdx + c] -
          lab[blIdx + c] +
          lab[brIdx + c];
        const gy =
          -lab[tlIdx + c] -
          2 * lab[tcIdx + c] -
          lab[trIdx + c] +
          lab[blIdx + c] +
          2 * lab[bcIdx + c] +
          lab[brIdx + c];
        gradSq += (gx * gx + gy * gy) * channelWeights[c];
      }
      edges[idx] = Math.sqrt(gradSq) * 0.35;
    }
  }
  return edges;
}

interface LabCluster {
  L: number;
  a: number;
  b: number;
  vL: number;
  va: number;
  vb: number;
  count: number;
}

/**
 * Quantizes pixel indices into up to `maxK` Lab Gaussian clusters (GMM diagonal components)
 * using farthest-first seeding + 2 k-means refinement iterations.
 */
function buildLabGmmClusters(
  lab: Float32Array,
  indices: number[],
  maxK: number,
): LabCluster[] {
  if (indices.length === 0) {
    return [{ L: 90, a: 0, b: 0, vL: 120, va: 40, vb: 40, count: 1 }];
  }

  const stride = Math.max(1, Math.floor(indices.length / 600));
  const samples: number[] = [];
  for (let i = 0; i < indices.length; i += stride) {
    samples.push(indices[i]);
  }

  const centers: Array<{ L: number; a: number; b: number }> = [];
  const firstIdx = samples[0] * 3;
  centers.push({ L: lab[firstIdx], a: lab[firstIdx + 1], b: lab[firstIdx + 2] });

  while (centers.length < maxK && centers.length < samples.length) {
    let bestSample = -1;
    let bestDist = -1;
    for (let s = 0; s < samples.length; s++) {
      const o = samples[s] * 3;
      const Ls = lab[o];
      const as = lab[o + 1];
      const bs = lab[o + 2];
      let minD = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const dL = Ls - centers[c].L;
        const da = as - centers[c].a;
        const db = bs - centers[c].b;
        const d = 0.45 * dL * dL + 1.3 * da * da + 1.3 * db * db;
        if (d < minD) minD = d;
      }
      if (minD > bestDist) {
        bestDist = minD;
        bestSample = samples[s];
      }
    }
    if (bestSample < 0 || bestDist < 36) break;
    const o = bestSample * 3;
    centers.push({ L: lab[o], a: lab[o + 1], b: lab[o + 2] });
  }

  const kCount = centers.length;
  const assign = new Int16Array(samples.length);

  for (let iter = 0; iter < 2; iter++) {
    const sumL = new Float64Array(kCount);
    const sumA = new Float64Array(kCount);
    const sumB = new Float64Array(kCount);
    const cnt = new Int32Array(kCount);

    for (let s = 0; s < samples.length; s++) {
      const o = samples[s] * 3;
      const Ls = lab[o];
      const as = lab[o + 1];
      const bs = lab[o + 2];
      let bestK = 0;
      let bestD = Infinity;
      for (let c = 0; c < kCount; c++) {
        const dL = Ls - centers[c].L;
        const da = as - centers[c].a;
        const db = bs - centers[c].b;
        const d = 0.45 * dL * dL + 1.3 * da * da + 1.3 * db * db;
        if (d < bestD) {
          bestD = d;
          bestK = c;
        }
      }
      assign[s] = bestK;
      sumL[bestK] += Ls;
      sumA[bestK] += as;
      sumB[bestK] += bs;
      cnt[bestK]++;
    }

    for (let c = 0; c < kCount; c++) {
      if (cnt[c] > 0) {
        centers[c].L = sumL[c] / cnt[c];
        centers[c].a = sumA[c] / cnt[c];
        centers[c].b = sumB[c] / cnt[c];
      }
    }
  }

  // Final pass to compute diagonal variances per Gaussian component
  const vL = new Float64Array(kCount);
  const va = new Float64Array(kCount);
  const vb = new Float64Array(kCount);
  const cnt = new Int32Array(kCount);

  for (let s = 0; s < samples.length; s++) {
    const c = assign[s];
    const o = samples[s] * 3;
    const dL = lab[o] - centers[c].L;
    const da = lab[o + 1] - centers[c].a;
    const db = lab[o + 2] - centers[c].b;
    vL[c] += dL * dL;
    va[c] += da * da;
    vb[c] += db * db;
    cnt[c]++;
  }

  const clusters: LabCluster[] = [];
  for (let c = 0; c < kCount; c++) {
    if (cnt[c] === 0) continue;
    clusters.push({
      L: centers[c].L,
      a: centers[c].a,
      b: centers[c].b,
      vL: Math.max(32, vL[c] / cnt[c]),
      va: Math.max(14, va[c] / cnt[c]),
      vb: Math.max(14, vb[c] / cnt[c]),
      count: cnt[c],
    });
  }

  return clusters.length
    ? clusters
    : [{ L: 90, a: 0, b: 0, vL: 120, va: 40, vb: 40, count: 1 }];
}

/**
 * Multi-modal background model sampled from ALL border strips (preserving BOTH
 * dark wood AND bright flash-glare wood without discarding high-luminance corners).
 */
function buildBorderBackgroundInfo(
  lab: Float32Array,
  data: Uint8ClampedArray,
  w: number,
  h: number,
): { bgClusters: LabCluster[]; bgDist: Float32Array; borderP90Dist: number } {
  const borderIndices: number[] = [];
  const band = Math.max(4, Math.round(Math.min(w, h) * 0.045));

  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (x < band || x >= w - band || y < band || y >= h - band) {
        const idx = y * w + x;
        if (data[idx * 4 + 3] >= 25) {
          borderIndices.push(idx);
        }
      }
    }
  }

  const allClusters = buildLabGmmClusters(lab, borderIndices, 10);
  const totalSampled = allClusters.reduce((acc, c) => acc + c.count, 0);
  const minClusterWeight = Math.max(2, Math.round(totalSampled * 0.04));
  const dominantClusters = allClusters.filter((c) => c.count >= minClusterWeight);
  const bgClusters = dominantClusters.length > 0 ? dominantClusters : allClusters;
  const bgDist = new Float32Array(w * h);
  const borderSampleDists: number[] = [];

  for (let y = 0; y < h; y++) {
    const onBorder = y < band || y >= h - band;
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (data[idx * 4 + 3] < 25) continue;
      const o = idx * 3;
      const L = lab[o];
      const a = lab[o + 1];
      const b = lab[o + 2];

      let minD = Infinity;
      for (let c = 0; c < bgClusters.length; c++) {
        const cl = bgClusters[c];
        const dL = L - cl.L;
        const da = a - cl.a;
        const db = b - cl.b;
        const d = Math.sqrt(0.32 * dL * dL + 1.55 * da * da + 1.55 * db * db);
        if (d < minD) minD = d;
      }
      bgDist[idx] = minD;
      if ((onBorder || x < band || x >= w - band) && ((x + y) & 1) === 0) {
        borderSampleDists.push(minD);
      }
    }
  }

  borderSampleDists.sort((a, b) => a - b);
  const p90 =
    borderSampleDists[Math.min(borderSampleDists.length - 1, Math.floor(borderSampleDists.length * 0.9))] || 6;

  return { bgClusters, bgDist, borderP90Dist: Math.max(5, Math.min(26, p90)) };
}

/**
 * 4-pass Geodesic Minimum-Barrier / Edge-Gated Border Distance.
 * Smooth gradients & glare connected to image borders stay near 0; crossing crisp
 * part outlines raises distance sharply inside metallic/dark/neutral parts alike.
 */
function computeGeodesicBorderDistance(
  lab: Float32Array,
  edges: Float32Array,
  w: number,
  h: number,
): Float32Array {
  const geo = new Float32Array(w * h);
  const INF = 1e6;
  geo.fill(INF);

  for (let x = 0; x < w; x++) {
    geo[x] = 0;
    geo[(h - 1) * w + x] = 0;
  }
  for (let y = 0; y < h; y++) {
    geo[y * w] = 0;
    geo[y * w + (w - 1)] = 0;
  }

  const relaxStep = (cur: number, nb: number) => {
    const o1 = cur * 3;
    const o2 = nb * 3;
    const dL = lab[o1] - lab[o2];
    const da = lab[o1 + 1] - lab[o2 + 1];
    const db = lab[o1 + 2] - lab[o2 + 2];
    const colStep = Math.sqrt(0.35 * dL * dL + 1.3 * da * da + 1.3 * db * db);
    const edgeWall = Math.max(0, edges[cur] - 8);
    const cost = geo[nb] + edgeWall * 0.72 + Math.max(0, colStep - 2.5) * 0.36;
    if (cost < geo[cur]) geo[cur] = cost;
  };

  // Pass 1: Top-Left -> Bottom-Right
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const cur = y * w + x;
      relaxStep(cur, cur - 1);
      relaxStep(cur, cur - w);
      relaxStep(cur, cur - w - 1);
      relaxStep(cur, cur - w + 1);
    }
  }
  // Pass 2: Bottom-Right -> Top-Left
  for (let y = h - 2; y >= 1; y--) {
    for (let x = w - 2; x >= 1; x--) {
      const cur = y * w + x;
      relaxStep(cur, cur + 1);
      relaxStep(cur, cur + w);
      relaxStep(cur, cur + w + 1);
      relaxStep(cur, cur + w - 1);
    }
  }
  // Pass 3: Top-Right -> Bottom-Left
  for (let y = 1; y < h - 1; y++) {
    for (let x = w - 2; x >= 1; x--) {
      const cur = y * w + x;
      relaxStep(cur, cur + 1);
      relaxStep(cur, cur - w);
      relaxStep(cur, cur - w + 1);
      relaxStep(cur, cur - w - 1);
    }
  }
  // Pass 4: Bottom-Left -> Top-Right
  for (let y = h - 2; y >= 1; y--) {
    for (let x = 1; x < w - 1; x++) {
      const cur = y * w + x;
      relaxStep(cur, cur - 1);
      relaxStep(cur, cur + w);
      relaxStep(cur, cur + w - 1);
      relaxStep(cur, cur + w + 1);
    }
  }

  return geo;
}

/**
 * Adaptive Otsu threshold over per-pixel saliency.
 */
function computeOtsuThreshold(values: Float32Array, minVal: number, maxVal: number): number {
  const bins = 128;
  const hist = new Int32Array(bins);
  const scale = (bins - 1) / 130;

  for (let i = 0; i < values.length; i++) {
    const b = Math.max(0, Math.min(bins - 1, Math.floor(values[i] * scale)));
    hist[b]++;
  }

  const total = values.length;
  let sum = 0;
  for (let i = 0; i < bins; i++) sum += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let bestBin = 24;

  for (let t = 0; t < bins; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      bestBin = t;
    }
  }

  return Math.max(minVal, Math.min(maxVal, bestBin / scale));
}

export function rectToRoundedPolygon(region: ImageRegion): ContourPoint[] {
  const { x, y, width, height } = region;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const pts: ContourPoint[] = [];
  const count = 32;
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const px = cx + Math.sign(cos) * Math.pow(Math.abs(cos), 0.55) * rx;
    const py = cy + Math.sign(sin) * Math.pow(Math.abs(sin), 0.55) * ry;
    pts.push({ x: clamp01(px), y: clamp01(py) });
  }
  return pts;
}

function dilateMask(src: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (
        src[idx] ||
        src[idx - 1] ||
        src[idx + 1] ||
        src[idx - w] ||
        src[idx + w] ||
        src[idx - w - 1] ||
        src[idx - w + 1] ||
        src[idx + w - 1] ||
        src[idx + w + 1]
      ) {
        out[idx] = 1;
      }
    }
  }
  return out;
}

function erodeMask(src: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (src[idx] && src[idx - 1] && src[idx + 1] && src[idx - w] && src[idx + w]) {
        out[idx] = 1;
      }
    }
  }
  return out;
}

/**
 * Exterior-border flood hole filling so hollow bearings, bolts, and block cutouts
 * trace clean continuous outer silhouettes without breaking on center bores.
 */
function fillEnclosedHoles(mask: Uint8Array, w: number, h: number): Uint8Array {
  const pw = w + 2;
  const ph = h + 2;
  const padded = new Uint8Array(pw * ph);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      padded[(y + 1) * pw + (x + 1)] = mask[y * w + x];
    }
  }

  const exterior = new Uint8Array(pw * ph);
  const q = new Int32Array(pw * ph);
  let head = 0;
  let tail = 0;
  exterior[0] = 1;
  q[tail++] = 0;

  while (head < tail) {
    const cur = q[head++];
    const cx = cur % pw;
    const cy = Math.floor(cur / pw);
    if (cx > 0) {
      const nb = cur - 1;
      if (!exterior[nb] && !padded[nb]) {
        exterior[nb] = 1;
        q[tail++] = nb;
      }
    }
    if (cx < pw - 1) {
      const nb = cur + 1;
      if (!exterior[nb] && !padded[nb]) {
        exterior[nb] = 1;
        q[tail++] = nb;
      }
    }
    if (cy > 0) {
      const nb = cur - pw;
      if (!exterior[nb] && !padded[nb]) {
        exterior[nb] = 1;
        q[tail++] = nb;
      }
    }
    if (cy < ph - 1) {
      const nb = cur + pw;
      if (!exterior[nb] && !padded[nb]) {
        exterior[nb] = 1;
        q[tail++] = nb;
      }
    }
  }

  const filled = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!exterior[(y + 1) * pw + (x + 1)]) {
        filled[y * w + x] = 1;
      }
    }
  }
  return filled;
}

/**
 * Keeps only the largest 4-connected foreground region overlapping `anchorMask`
 * (eliminates disconnected speckles or distant specular patches).
 */
function keepLargestAnchoredComponent(
  mask: Uint8Array,
  anchorMask: Uint8Array,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Uint8Array {
  const visited = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let bestPixels: number[] = [];
  let bestAnchorHits = -1;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const start = y * w + x;
      if (!mask[start] || visited[start]) continue;

      let sp = 0;
      stack[sp++] = start;
      visited[start] = 1;
      const pixels: number[] = [];
      let anchorHits = 0;

      while (sp > 0) {
        const cur = stack[--sp];
        pixels.push(cur);
        if (anchorMask[cur]) anchorHits++;
        const cx = cur % w;
        const cy = Math.floor(cur / w);
        if (cx > x0 && mask[cur - 1] && !visited[cur - 1]) {
          visited[cur - 1] = 1;
          stack[sp++] = cur - 1;
        }
        if (cx < x1 && mask[cur + 1] && !visited[cur + 1]) {
          visited[cur + 1] = 1;
          stack[sp++] = cur + 1;
        }
        if (cy > y0 && mask[cur - w] && !visited[cur - w]) {
          visited[cur - w] = 1;
          stack[sp++] = cur - w;
        }
        if (cy < y1 && mask[cur + w] && !visited[cur + w]) {
          visited[cur + w] = 1;
          stack[sp++] = cur + w;
        }
      }

      if (
        anchorHits > bestAnchorHits ||
        (anchorHits === bestAnchorHits && pixels.length > bestPixels.length)
      ) {
        bestAnchorHits = anchorHits;
        bestPixels = pixels;
      }
    }
  }

  const out = new Uint8Array(w * h);
  for (let i = 0; i < bestPixels.length; i++) {
    out[bestPixels[i]] = 1;
  }
  return out;
}

/**
 * Client-Side Iterative GrabCut Segmentation (GMM Lab Models + Edge-Aligned MRF Cut):
 * Iteratively refines foreground/background Gaussian color mixtures in CIE L*a*b* and
 * minimizes boundary energy gamma * exp(-beta * ||dLab||^2) inside `roi`.
 */
function runGrabCutSegmentation(
  scene: {
    w: number;
    h: number;
    lab: Float32Array;
    edges: Float32Array;
    bgDist: Float32Array;
    geoDist: Float32Array;
    data: Uint8ClampedArray;
  },
  initialFgMask: Uint8Array,
  roi: { x0: number; y0: number; x1: number; y1: number },
  mustFgMask?: Uint8Array,
): Uint8Array {
  const { w, h, lab, data, bgDist, geoDist } = scene;
  const x0 = Math.max(2, roi.x0);
  const y0 = Math.max(2, roi.y0);
  const x1 = Math.min(w - 3, roi.x1);
  const y1 = Math.min(h - 3, roi.y1);

  if (x1 - x0 < 6 || y1 - y0 < 6) return initialFgMask;

  // Trimap: 0 = MUST_BG, 1 = PROB_BG, 2 = PROB_FG, 3 = MUST_FG
  const trimap = new Uint8Array(w * h);
  const alpha = new Uint8Array(w * h);

  let initFgCount = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const idx = y * w + x;
      if (data[idx * 4 + 3] < 30) {
        trimap[idx] = 0;
        continue;
      }
      const onRoiEdge = x <= x0 + 1 || x >= x1 - 1 || y <= y0 + 1 || y >= y1 - 1;
      if (onRoiEdge && !initialFgMask[idx] && !(mustFgMask && mustFgMask[idx])) {
        trimap[idx] = 0;
        alpha[idx] = 0;
        continue;
      }
      if (mustFgMask && mustFgMask[idx]) {
        trimap[idx] = 3;
        alpha[idx] = 1;
        initFgCount++;
      } else if (initialFgMask[idx]) {
        trimap[idx] = 2;
        alpha[idx] = 1;
        initFgCount++;
      } else {
        trimap[idx] = 1;
        alpha[idx] = 0;
      }
    }
  }

  if (initFgCount < 16) return initialFgMask;

  // Estimate local contrast beta = 1 / (2 * mean(||Lab_i - Lab_j||^2)) inside ROI
  let diffSum = 0;
  let diffPairs = 0;
  const labSqDiff = (i: number, j: number) => {
    const o1 = i * 3;
    const o2 = j * 3;
    const dL = lab[o1] - lab[o2];
    const da = lab[o1 + 1] - lab[o2 + 1];
    const db = lab[o1 + 2] - lab[o2 + 2];
    return 0.55 * dL * dL + 1.35 * da * da + 1.35 * db * db;
  };

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = y * w + x;
      diffSum += labSqDiff(idx, idx + 1) + labSqDiff(idx, idx + w);
      diffPairs += 2;
    }
  }
  const meanDiff = Math.max(12, diffSum / Math.max(1, diffPairs));
  const beta = 1 / (2 * meanDiff);
  const gamma = 3.4;

  // Precompute pairwise smoothness boundary weights (exp(-beta * ||dLab||^2))
  const wR = new Float32Array(w * h);
  const wD = new Float32Array(w * h);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const idx = y * w + x;
      if (x < x1) wR[idx] = gamma * Math.exp(-beta * labSqDiff(idx, idx + 1));
      if (y < y1) wD[idx] = gamma * Math.exp(-beta * labSqDiff(idx, idx + w));
    }
  }

  const unary = new Float32Array(w * h);

  // Also include immediate exterior ring around ROI in BG samples for crisp background learning
  const bgRingIndices: number[] = [];
  const rx0 = Math.max(1, x0 - 6);
  const ry0 = Math.max(1, y0 - 6);
  const rx1 = Math.min(w - 2, x1 + 6);
  const ry1 = Math.min(h - 2, y1 + 6);
  for (let y = ry0; y <= ry1; y++) {
    for (let x = rx0; x <= rx1; x++) {
      if (x < x0 || x > x1 || y < y0 || y > y1) {
        const idx = y * w + x;
        if (data[idx * 4 + 3] >= 30) bgRingIndices.push(idx);
      }
    }
  }

  const gmmNegLogProb = (clusters: LabCluster[], idx: number): number => {
    const o = idx * 3;
    const L = lab[o];
    const a = lab[o + 1];
    const b = lab[o + 2];
    let best = Infinity;
    for (let c = 0; c < clusters.length; c++) {
      const cl = clusters[c];
      const dL = L - cl.L;
      const da = a - cl.a;
      const db = b - cl.b;
      // Chroma-weighted Mahalanobis distance (stronger on a*,b*, forgiving on flash L*)
      const dist =
        (dL * dL) / (cl.vL * 1.45) +
        (da * da) / (cl.va * 0.8) +
        (db * db) / (cl.vb * 0.8);
      if (dist < best) best = dist;
    }
    return best;
  };

  for (let iter = 0; iter < 4; iter++) {
    // M-Step: Update Foreground & Background Lab GMM clusters from current alpha
    const fgIndices: number[] = [];
    const bgIndices: number[] = [...bgRingIndices];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const idx = y * w + x;
        if (data[idx * 4 + 3] < 30) continue;
        if (alpha[idx]) fgIndices.push(idx);
        else bgIndices.push(idx);
      }
    }

    if (fgIndices.length < 12 || bgIndices.length < 12) break;

    const fgGmm = buildLabGmmClusters(lab, fgIndices, 5);
    const bgGmm = buildLabGmmClusters(lab, bgIndices, 7);

    // Unary data log-likelihood ratio: positive -> Foreground, negative -> Background
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const idx = y * w + x;
        if (trimap[idx] === 0 || trimap[idx] === 3) continue;
        const dFg = gmmNegLogProb(fgGmm, idx);
        const dBg = gmmNegLogProb(bgGmm, idx);
        // Penalize background-like pixels that match global border & have low edge barrier
        const borderBias = bgDist[idx] < 9 && geoDist[idx] < 10 ? -2.4 : 0;
        unary[idx] = Math.max(-16, Math.min(16, (dBg - dFg) * 2.2 + borderBias));
      }
    }

    // E-Step: 6 Gauss-Seidel MRF relaxation sweeps minimizing Potts boundary energy
    for (let sweep = 0; sweep < 6; sweep++) {
      const fwd = (sweep & 1) === 0;
      const yStart = fwd ? y0 : y1;
      const yEnd = fwd ? y1 + 1 : y0 - 1;
      const yStep = fwd ? 1 : -1;
      const xStart = fwd ? x0 : x1;
      const xEnd = fwd ? x1 + 1 : x0 - 1;
      const xStep = fwd ? 1 : -1;

      for (let y = yStart; y !== yEnd; y += yStep) {
        for (let x = xStart; x !== xEnd; x += xStep) {
          const idx = y * w + x;
          if (trimap[idx] === 0 || trimap[idx] === 3) continue;
          const smooth =
            wR[idx - 1] * (alpha[idx - 1] ? 1 : -1) +
            wR[idx] * (alpha[idx + 1] ? 1 : -1) +
            wD[idx - w] * (alpha[idx - w] ? 1 : -1) +
            wD[idx] * (alpha[idx + w] ? 1 : -1);
          alpha[idx] = unary[idx] + smooth > 0 ? 1 : 0;
        }
      }
    }
  }

  // Keep connected FG silhouette anchored to initial seed + fill enclosed interior holes
  const anchored = keepLargestAnchoredComponent(
    alpha,
    mustFgMask || initialFgMask,
    w,
    h,
    x0,
    y0,
    x1,
    y1,
  );
  return fillEnclosedHoles(anchored, w, h);
}

function pointToSegmentDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function ramerDouglasPeucker(
  points: Array<{ x: number; y: number }>,
  epsilon: number,
): Array<{ x: number; y: number }> {
  if (points.length <= 3) return points;
  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = pointToSegmentDist(points[i].x, points[i].y, first.x, first.y, last.x, last.y);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }
  if (maxDist > epsilon) {
    const left = ramerDouglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = ramerDouglasPeucker(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

function chaikinClosed(
  points: Array<{ x: number; y: number }>,
  passes = 2,
): Array<{ x: number; y: number }> {
  let pts = points;
  for (let p = 0; p < passes; p++) {
    if (pts.length < 4 || pts.length > 160) break;
    const next: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    pts = next;
  }
  return pts;
}

/**
 * Computes the deepest interior center pixel inside the silhouette mask (Pole of Inaccessibility)
 * so clickable part dots always land squarely on the physical part body.
 */
function computeInteriorCenterPixel(
  mask: Uint8Array,
  w: number,
  h: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  sumX: number,
  sumY: number,
  count: number,
): { cx: number; cy: number } {
  const meanX = sumX / count;
  const meanY = sumY / count;

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const dist = new Float32Array(bw * bh);
  const INF = 1e6;

  for (let y = 0; y < bh; y++) {
    const gy = minY + y;
    for (let x = 0; x < bw; x++) {
      const gx = minX + x;
      if (!mask[gy * w + gx]) {
        dist[y * bw + x] = 0;
      } else {
        let d = INF;
        if (x > 0) d = Math.min(d, dist[y * bw + (x - 1)] + 1);
        else d = 1;
        if (y > 0) d = Math.min(d, dist[(y - 1) * bw + x] + 1);
        else d = 1;
        dist[y * bw + x] = d;
      }
    }
  }

  let bestScore = -Infinity;
  let bestX = Math.round(meanX);
  let bestY = Math.round(meanY);

  for (let y = bh - 1; y >= 0; y--) {
    const gy = minY + y;
    for (let x = bw - 1; x >= 0; x--) {
      const gx = minX + x;
      const idx = y * bw + x;
      if (!mask[gy * w + gx]) continue;
      let d = dist[idx];
      if (x < bw - 1) d = Math.min(d, dist[y * bw + (x + 1)] + 1);
      else d = 1;
      if (y < bh - 1) d = Math.min(d, dist[(y + 1) * bw + x] + 1);
      else d = 1;
      dist[idx] = d;

      const distToMean = Math.hypot(gx - meanX, gy - meanY);
      const score = d * 2.4 - distToMean * 0.35;
      if (score > bestScore) {
        bestScore = score;
        bestX = gx;
        bestY = gy;
      }
    }
  }

  return { cx: bestX, cy: bestY };
}

/**
 * Moore-Neighbor Contour Tracing on the GrabCut silhouette mask.
 */
function traceMaskOuterBoundary(
  rawMask: Uint8Array,
  w: number,
  h: number,
  fallbackBox: ImageRegion,
): { polygon: ContourPoint[]; region: ImageRegion; center: ContourPoint } {
  const mask = fillEnclosedHoles(rawMask, w, h);

  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      sumX += x;
      sumY += y;
      count++;
    }
  }

  if (count < 20 || maxX <= minX || maxY <= minY) {
    return {
      region: fallbackBox,
      polygon: rectToRoundedPolygon(fallbackBox),
      center: {
        x: clamp01(fallbackBox.x + fallbackBox.width / 2),
        y: clamp01(fallbackBox.y + fallbackBox.height / 2),
      },
    };
  }

  const pw = w + 2;
  const ph = h + 2;
  const padded = new Uint8Array(pw * ph);
  let startX = -1;
  let startY = -1;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (mask[y * w + x]) {
        padded[(y + 1) * pw + (x + 1)] = 1;
        if (startX === -1) {
          startX = x + 1;
          startY = y + 1;
        }
      }
    }
  }

  const dx = [0, 1, 1, 1, 0, -1, -1, -1];
  const dy = [-1, -1, 0, 1, 1, 1, 0, -1];
  const boundary: Array<{ x: number; y: number }> = [];
  let cx = startX;
  let cy = startY;
  let backtrackDir = 0;
  const maxSteps = Math.min(18000, pw * ph);
  let firstEnterDir = -1;

  for (let step = 0; step < maxSteps; step++) {
    boundary.push({ x: cx - 1, y: cy - 1 });
    let foundNext = false;
    for (let i = 0; i < 8; i++) {
      const dir = (backtrackDir + i) % 8;
      const nx = cx + dx[dir];
      const ny = cy + dy[dir];
      if (nx >= 0 && nx < pw && ny >= 0 && ny < ph && padded[ny * pw + nx]) {
        const prevDir = (dir + 7) % 8;
        const enterFrom = (dir + 4) % 8;
        if (step === 0) firstEnterDir = enterFrom;
        else if (cx === startX && cy === startY && enterFrom === firstEnterDir && boundary.length > 4) {
          foundNext = false;
          break;
        }
        cx = nx;
        cy = ny;
        backtrackDir = (prevDir + 6) % 8;
        if (padded[(cy + dy[backtrackDir]) * pw + (cx + dx[backtrackDir])]) {
          backtrackDir = (dir + 5) % 8;
        }
        foundNext = true;
        break;
      }
    }
    if (!foundNext) break;
    if (cx === startX && cy === startY && boundary.length > 6) {
      break;
    }
  }

  let polygon: ContourPoint[];
  if (boundary.length >= 6) {
    const half = Math.floor(boundary.length / 2);
    const segA = ramerDouglasPeucker(boundary.slice(0, half + 1), 1.15);
    const segB = ramerDouglasPeucker([...boundary.slice(half), boundary[0]], 1.15);
    const simplified = [...segA.slice(0, -1), ...segB.slice(0, -1)];
    const smoothed = chaikinClosed(simplified.length >= 4 ? simplified : boundary, 2);
    polygon = smoothed.map((pt) => ({
      x: clamp01(pt.x / w),
      y: clamp01(pt.y / h),
    }));
  } else {
    polygon = rectToRoundedPolygon(fallbackBox);
  }

  const padX = Math.max(2, Math.round(w * 0.015));
  const padY = Math.max(2, Math.round(h * 0.015));
  const bx = clamp01((minX - padX) / w);
  const by = clamp01((minY - padY) / h);
  const bx2 = clamp01((maxX + padX) / w);
  const by2 = clamp01((maxY + padY) / h);

  const region: ImageRegion = {
    x: bx,
    y: by,
    width: Math.min(1 - bx, Math.max(0.05, bx2 - bx)),
    height: Math.min(1 - by, Math.max(0.05, by2 - by)),
  };

  const interiorCenter = computeInteriorCenterPixel(
    mask,
    w,
    h,
    minX,
    maxX,
    minY,
    maxY,
    sumX,
    sumY,
    count,
  );

  return {
    polygon,
    region,
    center: {
      x: clamp01(interiorCenter.cx / w),
      y: clamp01(interiorCenter.cy / h),
    },
  };
}

interface CachedScene {
  w: number;
  h: number;
  data: Uint8ClampedArray;
  lab: Float32Array;
  edges: Float32Array;
  bgDist: Float32Array;
  geoDist: Float32Array;
  localContrast: Float32Array;
  saliency: Float32Array;
  borderP90Dist: number;
  fgThreshold: number;
  compMap: Int32Array;
  candidates: DetectedPartContour[];
}

const sceneCache = new Map<string, CachedScene>();

function cacheKeyFor(src: string, rotationDeg: number): string {
  const head = src.slice(0, 96);
  const tail = src.slice(-48);
  return `${head}:${tail}:${src.length}:${((rotationDeg % 360) + 360) % 360}`;
}

/**
 * O(W*H) Multi-Scale Center-Surround CIE L*a*b* Contrast via Integral Images.
 * Highlights compact focal objects (e.g. a coupling held in a glove or a block on wood glare)
 * while naturally suppressing uniform sleeves, wide tables, and smooth specular flash streaks.
 */
function computeMultiScaleCenterSurround(
  lab: Float32Array,
  w: number,
  h: number,
): Float32Array {
  const stride = w + 1;
  const satL = new Float64Array(stride * (h + 1));
  const satA = new Float64Array(stride * (h + 1));
  const satB = new Float64Array(stride * (h + 1));

  for (let y = 0; y < h; y++) {
    let rowL = 0;
    let rowA = 0;
    let rowB = 0;
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      rowL += lab[o];
      rowA += lab[o + 1];
      rowB += lab[o + 2];
      const si = (y + 1) * stride + (x + 1);
      satL[si] = satL[si - stride] + rowL;
      satA[si] = satA[si - stride] + rowA;
      satB[si] = satB[si - stride] + rowB;
    }
  }

  const boxSum = (sat: Float64Array, x0: number, y0: number, x1: number, y1: number): number => {
    const cx0 = Math.max(0, x0);
    const cy0 = Math.max(0, y0);
    const cx1 = Math.min(w - 1, x1);
    const cy1 = Math.min(h - 1, y1);
    if (cx1 < cx0 || cy1 < cy0) return 0;
    return (
      sat[(cy1 + 1) * stride + (cx1 + 1)] -
      sat[cy0 * stride + (cx1 + 1)] -
      sat[(cy1 + 1) * stride + cx0] +
      sat[cy0 * stride + cx0]
    );
  };

  const boxArea = (x0: number, y0: number, x1: number, y1: number): number => {
    const cx0 = Math.max(0, x0);
    const cy0 = Math.max(0, y0);
    const cx1 = Math.min(w - 1, x1);
    const cy1 = Math.min(h - 1, y1);
    return cx1 >= cx0 && cy1 >= cy0 ? (cx1 - cx0 + 1) * (cy1 - cy0 + 1) : 0;
  };

  const minDim = Math.min(w, h);
  const scales = [
    { rIn: Math.max(2, Math.round(minDim * 0.02)), rOut: Math.max(8, Math.round(minDim * 0.095)) },
    { rIn: Math.max(3, Math.round(minDim * 0.045)), rOut: Math.max(12, Math.round(minDim * 0.16)) },
    { rIn: Math.max(5, Math.round(minDim * 0.085)), rOut: Math.max(20, Math.round(minDim * 0.27)) },
  ];

  const out = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const o = idx * 3;
      const pL = lab[o];
      const pA = lab[o + 1];
      const pB = lab[o + 2];

      let maxContrast = 0;
      for (const sc of scales) {
        const inA = boxArea(x - sc.rIn, y - sc.rIn, x + sc.rIn, y + sc.rIn);
        const outA = boxArea(x - sc.rOut, y - sc.rOut, x + sc.rOut, y + sc.rOut);
        const ringA = Math.max(1, outA - inA);

        const inSumL = boxSum(satL, x - sc.rIn, y - sc.rIn, x + sc.rIn, y + sc.rIn);
        const inSumA = boxSum(satA, x - sc.rIn, y - sc.rIn, x + sc.rIn, y + sc.rIn);
        const inSumB = boxSum(satB, x - sc.rIn, y - sc.rIn, x + sc.rIn, y + sc.rIn);

        const ringL = (boxSum(satL, x - sc.rOut, y - sc.rOut, x + sc.rOut, y + sc.rOut) - inSumL) / ringA;
        const ringAVal = (boxSum(satA, x - sc.rOut, y - sc.rOut, x + sc.rOut, y + sc.rOut) - inSumA) / ringA;
        const ringBVal = (boxSum(satB, x - sc.rOut, y - sc.rOut, x + sc.rOut, y + sc.rOut) - inSumB) / ringA;

        const dLp = pL - ringL;
        const dAp = pA - ringAVal;
        const dBp = pB - ringBVal;
        const pixDiff = Math.sqrt(0.42 * dLp * dLp + 1.55 * dAp * dAp + 1.55 * dBp * dBp);

        const boxL = inSumL / Math.max(1, inA) - ringL;
        const boxAVal = inSumA / Math.max(1, inA) - ringAVal;
        const boxBVal = inSumB / Math.max(1, inA) - ringBVal;
        const boxDiff = Math.sqrt(0.42 * boxL * boxL + 1.55 * boxAVal * boxAVal + 1.55 * boxBVal * boxBVal);

        const combined = pixDiff * 0.65 + boxDiff * 0.35;
        if (combined > maxContrast) maxContrast = combined;
      }

      out[idx] = maxContrast;
    }
  }

  return out;
}

interface RawProposal {
  pixels: number[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  sumX: number;
  sumY: number;
  meanLc: number;
  score: number;
  fromFocalCue: boolean;
}

/**
 * Pure RGBA buffer visual-part segmentation engine (zero DOM dependency, testable directly in Node).
 * Supports optional `externalAlphaMask` (e.g., from `@imgly/background-removal` IS-Net) to suppress
 * background workshop clutter while extracting compact foreground/in-hand mechanical parts.
 */
export function analyzeRgbaBuffer(
  w: number,
  h: number,
  data: Uint8ClampedArray,
  externalAlphaMask?: Uint8Array,
): CachedScene {
  const smoothRgb = smoothRgbBuffer(data, w, h);
  const lab = convertRgbToLabBuffer(smoothRgb, w * h);
  const edges = computeLabEdgeMap(lab, w, h);
  const { bgDist, borderP90Dist } = buildBorderBackgroundInfo(lab, data, w, h);
  const geoDist = computeGeodesicBorderDistance(lab, edges, w, h);
  const localContrast = computeMultiScaleCenterSurround(lab, w, h);

  const hasExtAlpha = Boolean(externalAlphaMask && externalAlphaMask.length >= w * h);

  // Saliency blends center-surround contrast + chromatic border distance + gated barrier
  const saliency = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] < 35) continue;
    const extBoost = hasExtAlpha && externalAlphaMask![i] >= 110 ? 1.18 : hasExtAlpha ? 0.35 : 1;
    saliency[i] =
      (localContrast[i] * 0.62 + bgDist[i] * 0.42 + Math.min(48, geoDist[i]) * 0.16) * extBoost;
  }

  const borderSals: number[] = [];
  const band = Math.max(4, Math.round(Math.min(w, h) * 0.045));
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (x < band || x >= w - band || y < band || y >= h - band) {
        borderSals.push(saliency[y * w + x]);
      }
    }
  }
  borderSals.sort((a, b) => a - b);
  const borderNoiseFloor =
    borderSals[Math.min(borderSals.length - 1, Math.floor(borderSals.length * 0.92))] || 8;

  const fgThreshold = computeOtsuThreshold(saliency, Math.max(13, borderNoiseFloor * 1.4), 60);

  const extractCompsFromMask = (
    seedMask: Uint8Array,
    fromFocalCue: boolean,
  ): { comps: RawProposal[]; hadGiantMonster: boolean } => {
    const closed = erodeMask(fillEnclosedHoles(dilateMask(seedMask, w, h), w, h), w, h);
    const visited = new Uint8Array(w * h);
    const stack = new Int32Array(w * h);
    const found: RawProposal[] = [];
    const minPixels = Math.max(40, Math.round(w * h * 0.005));
    let hadGiantMonster = false;

    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const start = y * w + x;
        if (!closed[start] || visited[start]) continue;

        let sp = 0;
        stack[sp++] = start;
        visited[start] = 1;
        const pixels: number[] = [];
        let sumX = 0;
        let sumY = 0;
        let minX = w;
        let maxX = 0;
        let minY = h;
        let maxY = 0;
        let edgeRich = 0;
        let maxEdge = 0;
        let bgDistSum = 0;
        let geoSum = 0;
        let lcSum = 0;
        let touchesBorder = 0;

        while (sp > 0) {
          const cur = stack[--sp];
          const cx = cur % w;
          const cy = Math.floor(cur / w);
          pixels.push(cur);
          sumX += cx;
          sumY += cy;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
          if (cx <= 4 || cx >= w - 5 || cy <= 4 || cy >= h - 5) touchesBorder++;

          const e = edges[cur];
          if (e > maxEdge) maxEdge = e;
          if (e > 15) edgeRich++;
          bgDistSum += bgDist[cur];
          geoSum += Math.min(90, geoDist[cur]);
          lcSum += localContrast[cur];

          const nbs = [cur - 1, cur + 1, cur - w, cur + w];
          for (const nb of nbs) {
            if (nb >= 0 && nb < w * h && !visited[nb] && closed[nb]) {
              visited[nb] = 1;
              stack[sp++] = nb;
            }
          }
        }

        const spanW = (maxX - minX) / w;
        const spanH = (maxY - minY) / h;
        const borderSides =
          (minX <= 5 ? 1 : 0) +
          (maxX >= w - 6 ? 1 : 0) +
          (minY <= 5 ? 1 : 0) +
          (maxY >= h - 6 ? 1 : 0);
        const borderRatio = touchesBorder / pixels.length;

        if (
          pixels.length > w * h * 0.92 ||
          (borderSides >= 3 && borderRatio > 0.085 && (maxX - minX) * (maxY - minY) > w * h * 0.72 && touchesBorder > (w + h) * 0.45) ||
          (borderSides >= 2 &&
            !hasExtAlpha &&
            borderP90Dist > 12 &&
            (pixels.length > w * h * 0.56 || borderRatio > 0.065 || (spanW > 0.72 && spanH > 0.70)))
        ) {
          hadGiantMonster = true;
          continue;
        }
        if (pixels.length < minPixels) continue;

        const edgeDensity = edgeRich / pixels.length;
        const meanBgDist = bgDistSum / pixels.length;
        const meanGeo = geoSum / pixels.length;
        const meanLc = lcSum / pixels.length;

        if (meanBgDist < borderP90Dist * 1.1 && meanGeo < 14 && meanLc < 18) continue;
        if (edgeDensity < 0.02 && maxEdge < 24 && meanLc < 22) continue;
        if (borderRatio > 0.08 && meanLc < 32) continue;

        const meanX = sumX / pixels.length / w;
        const meanY = sumY / pixels.length / h;
        const centerDistSq = Math.pow(meanX - 0.5, 2) + Math.pow(meanY - 0.5, 2);
        const centerPrior = Math.exp(-centerDistSq / 0.16);

        const borderPurity =
          touchesBorder === 0
            ? 1.5
            : borderSides >= 2
            ? 0.14
            : Math.max(0.16, 1 - borderRatio * 9);

        const areaFrac = pixels.length / (w * h);
        const fillRatio = pixels.length / Math.max(1, (maxX - minX + 1) * (maxY - minY + 1));
        const compactness = Math.max(0.45, Math.min(1.25, fillRatio * 1.45));
        const isCleanDetached = borderSides <= 1 && borderRatio < 0.032;
        const maxFavoredArea = isCleanDetached ? 0.78 : 0.24;
        const sizeFactor =
          areaFrac <= maxFavoredArea
            ? Math.pow(areaFrac, 0.34)
            : Math.pow(maxFavoredArea, 0.34) * Math.max(0.32, 1 - (areaFrac - maxFavoredArea) * 2.4);
        const wideSpanPenalty =
          (borderSides >= 2 || borderRatio > 0.04) && (spanW > 0.64 || spanH > 0.64) && meanBgDist < 22 ? 0.48 : 1;
        const contrastBoost = Math.pow(Math.min(48, Math.max(14, meanLc)) / 22, 0.78);
        const cleanBodyBonus =
          isCleanDetached && areaFrac >= 0.22 && meanBgDist >= Math.max(18, borderP90Dist * 2.5)
            ? 1.38
            : 1;

        found.push({
          pixels,
          minX,
          maxX,
          minY,
          maxY,
          sumX,
          sumY,
          meanLc,
          fromFocalCue,
          score:
            sizeFactor *
            compactness *
            wideSpanPenalty *
            centerPrior *
            borderPurity *
            contrastBoost *
            cleanBodyBonus *
            (1 + meanBgDist * 0.04 + edgeDensity * 2.4),
        });
      }
    }
    return { comps: found, hadGiantMonster };
  };

  const extractAtSaliencyThreshold = (thresh: number, useGeoFallback = false) => {
    const mask = new Uint8Array(w * h);
    let fgCount = 0;
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const idx = y * w + x;
        const alpha = data[idx * 4 + 3];
        if (alpha < 35) continue;
        if (
          useGeoFallback
            ? geoDist[idx] > 18 || edges[idx] > 24
            : (alpha < 248 && bgDist[idx] > 8) || saliency[idx] > thresh
        ) {
          mask[idx] = 1;
          fgCount++;
        }
      }
    }
    if (fgCount < w * h * 0.005) return { comps: [], hadGiantMonster: false };
    return extractCompsFromMask(mask, false);
  };

  let { comps: rawComps, hadGiantMonster } = extractAtSaliencyThreshold(fgThreshold, false);

  // On clean studio/table backdrops (borderP90Dist <= 9.5), multi-scale localContrast spikes near the object rim
  // (halo on empty white borders) and dips across flat interior surfaces. Extract directly via pure Lab border
  // distance + edge barrier so 100% of cohesive close-up parts stay intact without splitting into quadrants/strips.
  if (borderP90Dist <= 9.5) {
    const cleanBgMask = new Uint8Array(w * h);
    let cleanBgCount = 0;
    const bgCut = Math.max(12.5, borderP90Dist * 2.15);
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const idx = y * w + x;
        const alpha = data[idx * 4 + 3];
        if (alpha < 35) continue;
        if (
          (alpha < 248 && bgDist[idx] > 7) ||
          bgDist[idx] > bgCut ||
          (bgDist[idx] > Math.max(9.5, borderP90Dist * 1.65) && geoDist[idx] > 14)
        ) {
          cleanBgMask[idx] = 1;
          cleanBgCount++;
        }
      }
    }
    if (cleanBgCount >= w * h * 0.005) {
      const cleanBodyRes = extractCompsFromMask(cleanBgMask, false);
      if (cleanBodyRes.comps.length > 0) {
        rawComps = [...rawComps, ...cleanBodyRes.comps];
      }
    }
  }

  if (rawComps.length === 0 || hadGiantMonster) {
    const interiorSals: number[] = [];
    const ix0 = Math.round(w * 0.1);
    const ix1 = Math.round(w * 0.9);
    const iy0 = Math.round(h * 0.1);
    const iy1 = Math.round(h * 0.9);
    for (let y = iy0; y < iy1; y += 2) {
      for (let x = ix0; x < ix1; x += 2) {
        interiorSals.push(saliency[y * w + x]);
      }
    }
    interiorSals.sort((a, b) => a - b);
    const p76 = interiorSals[Math.floor(interiorSals.length * 0.76)] || fgThreshold * 1.35;
    const p86 = interiorSals[Math.floor(interiorSals.length * 0.86)] || fgThreshold * 1.65;
    const p92 = interiorSals[Math.floor(interiorSals.length * 0.92)] || fgThreshold * 2.0;

    for (const highT of [Math.max(fgThreshold * 1.35, p76), p86, p92]) {
      const res = extractAtSaliencyThreshold(highT, false);
      if (res.comps.length > 0) {
        rawComps = [...rawComps, ...res.comps];
      }
    }
  }

  // Cue B: Multi-Percentile Focal Center-Surround Peak Extractor — catches compact parts
  // inside hands/gloves (test4_red_spider) or sitting over bright specular glare (image_de422df0)
  const interiorLc: number[] = [];
  for (let y = Math.round(h * 0.08); y < Math.round(h * 0.92); y += 2) {
    for (let x = Math.round(w * 0.08); x < Math.round(w * 0.92); x += 2) {
      if (hasExtAlpha && externalAlphaMask![y * w + x] < 65) continue;
      interiorLc.push(localContrast[y * w + x]);
    }
  }
  interiorLc.sort((a, b) => a - b);
  const lcMax = interiorLc[interiorLc.length - 1] || 35;
  const lcP84 = Math.max(22, interiorLc[Math.floor(interiorLc.length * 0.84)] || 24);
  const lcP91 = Math.max(27, interiorLc[Math.floor(interiorLc.length * 0.91)] || 29);
  const lcP95 = Math.max(32, interiorLc[Math.floor(interiorLc.length * 0.95)] || 34);
  const lcPeakCut = Math.max(33, lcMax * 0.56);

  const uniqueCuts = Array.from(
    new Set([lcP84, lcP91, lcP95, lcPeakCut].map((v) => Math.round(v * 2) / 2)),
  );

  for (const lcCut of uniqueCuts) {
    const focalMask = new Uint8Array(w * h);
    let focalCount = 0;
    const marginX = Math.max(3, Math.round(w * 0.025));
    const marginY = Math.max(3, Math.round(h * 0.025));
    for (let y = marginY; y < h - marginY; y++) {
      for (let x = marginX; x < w - marginX; x++) {
        const idx = y * w + x;
        if (data[idx * 4 + 3] < 35) continue;
        if (hasExtAlpha && externalAlphaMask![idx] < 65) continue;
        if (localContrast[idx] >= lcCut) {
          focalMask[idx] = 1;
          focalCount++;
        }
      }
    }
    if (focalCount >= w * h * 0.004) {
      const focalRes = extractCompsFromMask(focalMask, true);
      for (const fc of focalRes.comps) {
        const areaFrac = fc.pixels.length / (w * h);
        const fcBorders =
          (fc.minX <= 5 ? 1 : 0) +
          (fc.maxX >= w - 6 ? 1 : 0) +
          (fc.minY <= 5 ? 1 : 0) +
          (fc.maxY >= h - 6 ? 1 : 0);
        if (areaFrac <= (fcBorders <= 1 ? 0.65 : 0.34)) {
          rawComps.push({ ...fc, score: fc.score * 1.04 });
        }
      }
    }
  }

  // Also include geodesic + Lab-edge enclosed foreground proposals so thin hollow rings,
  // bearings, and metallic parts on textured benches are always represented.
  const geoRes = extractAtSaliencyThreshold(fgThreshold, true);
  if (geoRes.comps.length > 0) {
    rawComps = [...rawComps, ...geoRes.comps];
  }

  const compMap = new Int32Array(w * h);
  rawComps.sort((a, b) => b.score - a.score);

  // Deduplicate same-scale proposals while preserving BOTH a clean enclosing whole assembly
  // and a distinct compact inner sub-part (e.g. center bearing inside a pulley wheel),
  // AND letting a bright compact held object survive inside a bloated border/hand wrapper.
  const selectedComps: RawProposal[] = [];
  for (const comp of rawComps) {
    const cx = comp.sumX / comp.pixels.length / w;
    const cy = comp.sumY / comp.pixels.length / h;
    const cArea = Math.max(1e-5, ((comp.maxX - comp.minX) / w) * ((comp.maxY - comp.minY) / h));
    const cBorders =
      (comp.minX <= 6 ? 1 : 0) +
      (comp.maxX >= w - 7 ? 1 : 0) +
      (comp.minY <= 6 ? 1 : 0) +
      (comp.maxY >= h - 7 ? 1 : 0);

    let replacedPartial = false;
    const duplicate = selectedComps.some((s, idx) => {
      const sx = s.sumX / s.pixels.length / w;
      const sy = s.sumY / s.pixels.length / h;
      const sArea = Math.max(1e-5, ((s.maxX - s.minX) / w) * ((s.maxY - s.minY) / h));
      const sBorders =
        (s.minX <= 6 ? 1 : 0) +
        (s.maxX >= w - 7 ? 1 : 0) +
        (s.minY <= 6 ? 1 : 0) +
        (s.maxY >= h - 7 ? 1 : 0);

      const minXn = comp.minX / w;
      const maxXn = comp.maxX / w;
      const minYn = comp.minY / h;
      const maxYn = comp.maxY / h;
      const sMinXn = s.minX / w;
      const sMaxXn = s.maxX / w;
      const sMinYn = s.minY / h;
      const sMaxYn = s.maxY / h;
      const ix0 = Math.max(minXn, sMinXn);
      const iy0 = Math.max(minYn, sMinYn);
      const ix1 = Math.min(maxXn, sMaxXn);
      const iy1 = Math.min(maxYn, sMaxYn);
      if (ix1 > ix0 && iy1 > iy0) {
        const inter = (ix1 - ix0) * (iy1 - iy0);
        const minOverlap = inter / Math.min(cArea, sArea);
        const areaRatio = Math.max(cArea, sArea) / Math.min(cArea, sArea);
        const sOuterBloated =
          sArea > 0.26 && (sBorders >= 2 || (sBorders >= 1 && comp.meanLc > s.meanLc * 1.65));
        const cOuterBloated =
          cArea > 0.26 && (cBorders >= 2 || (cBorders >= 1 && s.meanLc > comp.meanLc * 1.65));

        if (sOuterBloated && cArea < sArea * 0.42 && comp.meanLc > s.meanLc * 1.65) {
          return false;
        }
        if (cOuterBloated && sArea < cArea * 0.42 && s.meanLc > comp.meanLc * 1.6) {
          return true;
        }

        // Preserve distinct scale pair (clean outer close-up assembly + embedded inner sub-part)
        const cMaxBorders = borderP90Dist <= 9.5 ? 2 : 1;
        const cCleanOuter = cArea > sArea * 1.9 && cBorders <= cMaxBorders && cArea <= 0.90;
        const sCleanOuter = sArea > cArea * 1.9 && sBorders <= cMaxBorders && sArea <= 0.90;
        if ((cCleanOuter || sCleanOuter) && minOverlap > 0.62) {
          return false;
        }

        // On clean backdrops, if `comp` encloses a partial/chopped slice `s` of the same body,
        // upgrade `s` to the full assembly without letting lower-contrast gloves swallow held parts.
        if (
          !replacedPartial &&
          borderP90Dist <= 9.5 &&
          cArea > sArea * 1.25 &&
          cArea < sArea * 2.2 &&
          inter / sArea > 0.78 &&
          cBorders <= cMaxBorders &&
          cArea <= 0.90 &&
          !(s.meanLc > comp.meanLc * 1.35)
        ) {
          selectedComps[idx] = comp;
          replacedPartial = true;
          return true;
        }

        if (minOverlap > 0.36 && areaRatio < 2.2) return true;
        if (minOverlap > 0.36) return true;
      }
      if (Math.hypot(cx - sx, cy - sy) < 0.10 && Math.max(cArea, sArea) / Math.min(cArea, sArea) < 2.5) {
        return true;
      }
      return false;
    });

    if (!duplicate && !replacedPartial && selectedComps.length < 7) {
      selectedComps.push(comp);
    }
  }

  const sceneBase = { w, h, lab, edges, bgDist, geoDist, data };
  const fallbackBox: ImageRegion = { x: 0.18, y: 0.18, width: 0.64, height: 0.64 };
  const scoredCandidates: Array<{
    cand: DetectedPartContour;
    rank: number;
    mask: Uint8Array;
    areaFrac: number;
    borderSides: number;
    borderRatio: number;
    meanLc: number;
    meanChroma: number;
  }> = [];

  for (let i = 0; i < selectedComps.length; i++) {
    const comp = selectedComps[i];
    const initMask = new Uint8Array(w * h);
    const mustFgMask = new Uint8Array(w * h);

    const cueVals = comp.pixels
      .map((p) => (comp.fromFocalCue ? localContrast[p] : saliency[p]))
      .sort((a, b) => a - b);
    const coreCut = cueVals[Math.floor(cueVals.length * 0.55)] || fgThreshold;

    for (const p of comp.pixels) {
      initMask[p] = 1;
      const val = comp.fromFocalCue ? localContrast[p] : saliency[p];
      if (val >= coreCut) mustFgMask[p] = 1;
    }

    const bw = Math.max(12, comp.maxX - comp.minX);
    const bh = Math.max(12, comp.maxY - comp.minY);
    const padX = Math.max(5, Math.round(bw * (comp.fromFocalCue ? 0.19 : 0.28)));
    const padY = Math.max(5, Math.round(bh * (comp.fromFocalCue ? 0.19 : 0.28)));
    const roi = {
      x0: Math.max(2, comp.minX - padX),
      y0: Math.max(2, comp.minY - padY),
      x1: Math.min(w - 3, comp.maxX + padX),
      y1: Math.min(h - 3, comp.maxY + padY),
    };

    let grabCutMask = runGrabCutSegmentation(sceneBase, initMask, roi, mustFgMask);

    // Anti-leak guard: if GrabCut spilled out of a high-contrast focal part into surrounding gloves/glare,
    // revert to the tight morphological silhouette `initMask`.
    let cutCount = 0;
    let boundaryEdgeSum = 0;
    let boundaryPx = 0;
    let lcSum = 0;
    let borderTouches = 0;
    let sumX = 0;
    let sumY = 0;
    let chromaSum = 0;
    let mMinX = w;
    let mMaxX = 0;
    let mMinY = h;
    let mMaxY = 0;

    const measureMask = (m: Uint8Array) => {
      cutCount = 0;
      boundaryEdgeSum = 0;
      boundaryPx = 0;
      lcSum = 0;
      chromaSum = 0;
      borderTouches = 0;
      sumX = 0;
      sumY = 0;
      mMinX = w;
      mMaxX = 0;
      mMinY = h;
      mMaxY = 0;
      for (let y = roi.y0; y <= roi.y1; y++) {
        for (let x = roi.x0; x <= roi.x1; x++) {
          const idx = y * w + x;
          if (!m[idx]) continue;
          cutCount++;
          lcSum += localContrast[idx];
          chromaSum += Math.hypot(lab[idx * 3 + 1], lab[idx * 3 + 2]);
          sumX += x;
          sumY += y;
          if (x < mMinX) mMinX = x;
          if (x > mMaxX) mMaxX = x;
          if (y < mMinY) mMinY = y;
          if (y > mMaxY) mMaxY = y;
          if (x <= 4 || x >= w - 5 || y <= 4 || y >= h - 5) borderTouches++;

          const isEdgePx = !m[idx - 1] || !m[idx + 1] || !m[idx - w] || !m[idx + w];
          if (isEdgePx) {
            boundaryEdgeSum += Math.max(
              edges[idx],
              edges[idx - 1],
              edges[idx + 1],
              edges[idx - w],
              edges[idx + w],
            );
            boundaryPx++;
          }
        }
      }
    };

    measureMask(grabCutMask);
    if (
      comp.fromFocalCue &&
      (cutCount > comp.pixels.length * 2.1 ||
        (cutCount > comp.pixels.length * 1.45 && lcSum / Math.max(1, cutCount) < comp.meanLc * 0.72))
    ) {
      grabCutMask = fillEnclosedHoles(dilateMask(initMask, w, h), w, h);
      measureMask(grabCutMask);
    }

    if (cutCount < 24) continue;

    const meanX = sumX / cutCount / w;
    const meanY = sumY / cutCount / h;
    const areaFrac = cutCount / (w * h);
    const perimEdge = boundaryEdgeSum / Math.max(1, boundaryPx);
    const meanLc = lcSum / cutCount;
    const meanChroma = chromaSum / cutCount;
    const borderRatio = borderTouches / cutCount;
    const borderSides =
      (mMinX <= 6 ? 1 : 0) +
      (mMaxX >= w - 7 ? 1 : 0) +
      (mMinY <= 6 ? 1 : 0) +
      (mMaxY >= h - 7 ? 1 : 0);
    const centerPrior = Math.exp(-(Math.pow(meanX - 0.5, 2) + Math.pow(meanY - 0.5, 2)) / 0.16);
    const borderPurity = borderTouches === 0 ? 1.45 : Math.max(0.14, 1 - borderRatio * 10);
    const maxFavoredWeightArea = borderTouches <= Math.round(cutCount * 0.025) ? 0.58 : 0.24;
    const sizeWeight =
      areaFrac <= maxFavoredWeightArea
        ? Math.pow(areaFrac, 0.34)
        : Math.pow(maxFavoredWeightArea, 0.34) * Math.max(0.25, 1 - (areaFrac - maxFavoredWeightArea) * 2.8);
    const focalRankBoost = Math.pow(Math.min(48, Math.max(14, meanLc)) / 22, 0.78);

    const rank =
      sizeWeight *
      centerPrior *
      borderPurity *
      focalRankBoost *
      (1 + perimEdge * 0.08);

    const traced = traceMaskOuterBoundary(grabCutMask, w, h, fallbackBox);
    scoredCandidates.push({
      rank,
      mask: grabCutMask,
      areaFrac,
      borderSides,
      borderRatio,
      meanLc,
      meanChroma,
      cand: {
        id: `auto-${scoredCandidates.length + 1}`,
        region: traced.region,
        polygon: traced.polygon,
        center: traced.center,
        edgeLocked: true,
      },
    });
  }

  // Promote a clean outer assembly ahead of an embedded inner sub-part (including close-up
  // wheels/couplings filling most of the frame), while NEVER promoting a border-touching hand/glove
  // wrapping a smaller, much higher-chroma held part (e.g. test4_red_spider).
  for (let i = 0; i < scoredCandidates.length; i++) {
    const outer = scoredCandidates[i];
    if (outer.borderRatio > 0.085 || outer.areaFrac > 0.92) continue;
    const rO = outer.cand.region;
    const oArea = rO.width * rO.height;
    for (let j = 0; j < scoredCandidates.length; j++) {
      if (i === j) continue;
      const inner = scoredCandidates[j];
      const rI = inner.cand.region;
      const iArea = rI.width * rI.height;
      if (oArea < iArea * 1.65) continue;
      const ix0 = Math.max(rO.x, rI.x);
      const iy0 = Math.max(rO.y, rI.y);
      const ix1 = Math.min(rO.x + rO.width, rI.x + rI.width);
      const iy1 = Math.min(rO.y + rO.height, rI.y + rI.height);
      if (ix1 > ix0 && iy1 > iy0) {
        const enclosed = ((ix1 - ix0) * (iy1 - iy0)) / Math.max(1e-5, iArea);
        const outerIsDetachedBody =
          outer.borderSides === 0 ||
          (outer.meanChroma > inner.meanChroma * 1.4 && outer.meanChroma > 24) ||
          (borderP90Dist <= 9.5 && outer.borderSides <= 2 && outer.areaFrac >= 0.28 && oArea >= iArea * 1.65) ||
          (outer.areaFrac >= 0.45 && outer.borderRatio <= 0.08 && inner.meanChroma <= outer.meanChroma * 1.5);
        const innerIsDistinctVibrantHeldPart =
          inner.meanChroma > outer.meanChroma * 1.5 && inner.meanLc > outer.meanLc * 1.25;
        if (
          enclosed >= 0.70 &&
          outerIsDetachedBody &&
          !innerIsDistinctVibrantHeldPart &&
          outer.meanLc >= inner.meanLc * 0.38
        ) {
          outer.rank = Math.max(outer.rank, inner.rank * 1.25);
        }
      }
    }
  }

  scoredCandidates.sort((a, b) => b.rank - a.rank);
  const topRank = scoredCandidates[0]?.rank || 0;
  const filteredScored = scoredCandidates.filter(
    (item, idx) => idx === 0 || item.rank >= topRank * 0.25,
  );

  const candidates: DetectedPartContour[] = [];
  for (let i = 0; i < filteredScored.length; i++) {
    const item = filteredScored[i];
    const cid = i + 1;
    for (let p = 0; p < w * h; p++) {
      if (item.mask[p] && compMap[p] === 0) compMap[p] = cid;
    }
    candidates.push({
      ...item.cand,
      id: `auto-${cid}`,
    });
  }

  return {
    w,
    h,
    data,
    lab,
    edges,
    bgDist,
    geoDist,
    localContrast,
    saliency,
    borderP90Dist,
    fgThreshold,
    compMap,
    candidates,
  };
}

/**
 * Smart Fusion of `@imgly/background-removal` IS-Net Alpha Matte + Focal Part Segmentation:
 * - If IS-Net cleanly isolates compact object(s) (not touching image borders, <= 34% area),
 *   uses pixel-accurate `extractContoursFromAlphaMask(alphaData)`.
 * - If IS-Net returns an oversized or border-touching foreground blob (e.g., person's arm/glove
 *   holding a coupling in `test4_red_spider`, or a large bench surface), uses IS-Net's alpha
 *   matte as `externalAlphaMask` inside `analyzeRgbaBuffer` so background clutter disappears and
 *   only the compact focal part inside the hand is extracted!
 */
export async function refineAutoContoursWithAiMask(
  src: string,
  alphaData: AlphaMaskData,
  rotationDeg = 0,
): Promise<{
  candidates: DetectedPartContour[];
  useAiWhiteCutout: boolean;
}> {
  const aiContours = extractContoursFromAlphaMask(alphaData);
  if (aiContours.length === 0) {
    return { candidates: [], useAiWhiteCutout: false };
  }

  const primaryAi = aiContours[0];
  const r = primaryAi.region;
  const aiArea = r.width * r.height;
  const touchesEdges =
    (r.x <= 0.025 ? 1 : 0) +
    (r.y <= 0.025 ? 1 : 0) +
    (r.x + r.width >= 0.975 ? 1 : 0) +
    (r.y + r.height >= 0.975 ? 1 : 0);

  const isCleanCompactSubject =
    aiArea <= 0.30 &&
    r.width <= 0.66 &&
    r.height <= 0.66 &&
    touchesEdges === 0;

  if (isCleanCompactSubject) {
    return { candidates: aiContours, useAiWhiteCutout: true };
  }

  // Only inspect inside an oversized/border-reaching AI mask (e.g. hand/arm holding a small part)
  // to verify whether there is a distinct small focal part held inside a hand/background wrapper,
  // WITHOUT ever splitting a complete centered wheel/pulley/bearing into half or inner hub only.
  try {
    const img = await loadHtmlImage(src);
    const { width: w, height: h, data } = drawRotatedToCanvas(img, rotationDeg);
    const scaledAlpha = new Uint8Array(w * h);
    const mW = alphaData.width;
    const mH = alphaData.height;
    for (let y = 0; y < h; y++) {
      const sy = Math.min(mH - 1, Math.floor((y / h) * mH));
      for (let x = 0; x < w; x++) {
        const sx = Math.min(mW - 1, Math.floor((x / w) * mW));
        scaledAlpha[y * w + x] = alphaData.alphaMask[sy * mW + sx];
      }
    }

    const maskedScene = analyzeRgbaBuffer(w, h, data, scaledAlpha);
    if (maskedScene.candidates.length > 0) {
      const top = maskedScene.candidates[0];
      const tr = top.region;
      const topArea = tr.width * tr.height;

      if (topArea < aiArea * 0.45 && topArea <= 0.32) {
        // Measure Lab chroma + mean color inside `top` vs the rest of the AI foreground mask
        const smoothRgb = smoothRgbBuffer(data, w, h);
        const lab = convertRgbToLabBuffer(smoothRgb, w * h);
        let inCount = 0;
        let inChromaSum = 0;
        let inL = 0;
        let inA = 0;
        let inB = 0;
        let outCount = 0;
        let outChromaSum = 0;
        let outL = 0;
        let outA = 0;
        let outB = 0;

        const tx0 = Math.floor(tr.x * w);
        const tx1 = Math.ceil((tr.x + tr.width) * w);
        const ty0 = Math.floor(tr.y * h);
        const ty1 = Math.ceil((tr.y + tr.height) * h);

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            if (scaledAlpha[idx] < 95) continue;
            const o = idx * 3;
            const L = lab[o];
            const a = lab[o + 1];
            const b = lab[o + 2];
            const chroma = Math.hypot(a, b);
            const insideTop = x >= tx0 && x <= tx1 && y >= ty0 && y <= ty1;
            if (insideTop) {
              inCount++;
              inChromaSum += chroma;
              inL += L;
              inA += a;
              inB += b;
            } else {
              outCount++;
              outChromaSum += chroma;
              outL += L;
              outA += a;
              outB += b;
            }
          }
        }

        if (inCount >= 20 && outCount >= 30) {
          const inChroma = inChromaSum / inCount;
          const outChroma = outChromaSum / outCount;
          const dLab = Math.hypot(
            (inL / inCount - outL / outCount) * 0.55,
            inA / inCount - outA / outCount,
            inB / inCount - outB / outCount,
          );
          // Reject inner neutral bore/bearing inside a vibrant outer body (including close-ups touching frame edges);
          // Accept genuine held/focal part (e.g. red spider inside muted glove) ONLY when the outer
          // AI mask reaches/fills like a hand/arm holding a small vibrant compact object.
          const outerLooksLikeHandOrArm = touchesEdges >= 1 || r.height >= 0.72 || r.width >= 0.72;
          const outerIsVibrantBody = outChroma > inChroma * 1.35 && outChroma > 24;
          const distinctFocalPart =
            outerLooksLikeHandOrArm &&
            topArea <= 0.16 &&
            outChroma < 20 &&
            dLab >= 20 &&
            inChroma >= Math.max(22, outChroma * 1.35) &&
            !outerIsVibrantBody;

          if (distinctFocalPart) {
            sceneCache.set(cacheKeyFor(src, rotationDeg), maskedScene);
            return { candidates: maskedScene.candidates, useAiWhiteCutout: false };
          }
        }
      }
    }
  } catch {
    // Fallback to complete AI contours below
  }

  return { candidates: aiContours, useAiWhiteCutout: true };
}

async function getOrComputeScene(src: string, rotationDeg = 0): Promise<CachedScene> {
  const key = cacheKeyFor(src, rotationDeg);
  const cached = sceneCache.get(key);
  if (cached) return cached;

  const img = await loadHtmlImage(src);
  const { width: w, height: h, data } = drawRotatedToCanvas(img, rotationDeg);
  const scene = analyzeRgbaBuffer(w, h, data);

  if (sceneCache.size >= 4) {
    const firstKey = sceneCache.keys().next().value;
    if (firstKey) sceneCache.delete(firstKey);
  }
  sceneCache.set(key, scene);
  return scene;
}

/**
 * Refines an AI bounding region (box_2d) using client-side GrabCut segmentation
 * to hug the exact outer physical contour and discard all background pixels.
 */
export async function refineContourInsideRegion(
  src: string,
  box: ImageRegion,
  hintCenter?: ContourPoint,
  rotationDeg = 0,
  meta?: { id?: string; label?: string; partFamily?: string },
): Promise<DetectedPartContour> {
  const defaultCenter: ContourPoint = hintCenter || {
    x: clamp01(box.x + box.width / 2),
    y: clamp01(box.y + box.height / 2),
  };
  const fallback: DetectedPartContour = {
    id: meta?.id || `part-${Date.now()}`,
    region: box,
    polygon: rectToRoundedPolygon(box),
    center: defaultCenter,
    label: meta?.label,
    partFamily: meta?.partFamily,
    edgeLocked: true,
  };

  try {
    const scene = await getOrComputeScene(src, rotationDeg);
    const { w, h, compMap, candidates, lab, data } = scene;

    const x0 = Math.max(2, Math.floor(box.x * w));
    const y0 = Math.max(2, Math.floor(box.y * h));
    const x1 = Math.min(w - 3, Math.ceil((box.x + box.width) * w));
    const y1 = Math.min(h - 3, Math.ceil((box.y + box.height) * h));
    if (x1 - x0 < 8 || y1 - y0 < 8) return fallback;

    const boxAreaNorm = box.width * box.height;
    // Close-up part filling >= 64% of the frame: preserve the full AI region instead of
    // shrinking it via thin border-ring GrabCut or reusing a smaller partial Phase-1 fragment.
    if (boxAreaNorm >= 0.64) {
      return fallback;
    }

    const cx = Math.max(x0, Math.min(x1, Math.round(defaultCenter.x * w)));
    const cy = Math.max(y0, Math.min(y1, Math.round(defaultCenter.y * h)));
    const directCompId = compMap[cy * w + cx];
    if (directCompId > 0 && candidates[directCompId - 1]) {
      const compCand = candidates[directCompId - 1];
      const compArea = compCand.region.width * compCand.region.height;
      // Only reuse pre-computed candidate if it tightly matches this box (never reuse an oversized blob!)
      if (compArea <= boxAreaNorm * 1.35 && compArea >= boxAreaNorm * 0.55) {
        return {
          ...compCand,
          id: meta?.id || compCand.id,
          label: meta?.label || compCand.label,
          partFamily: meta?.partFamily || compCand.partFamily,
        };
      }
    }

    // OpenCV GC_INIT_WITH_RECT style: learn local BG right outside `box` (gloves, desk, machines)
    const padX = Math.max(5, Math.round((x1 - x0) * 0.22));
    const padY = Math.max(5, Math.round((y1 - y0) * 0.22));
    const roi = {
      x0: Math.max(2, x0 - padX),
      y0: Math.max(2, y0 - padY),
      x1: Math.min(w - 3, x1 + padX),
      y1: Math.min(h - 3, y1 + padY),
    };

    const ringIndices: number[] = [];
    for (let y = roi.y0; y <= roi.y1; y++) {
      for (let x = roi.x0; x <= roi.x1; x++) {
        if (x < x0 || x > x1 || y < y0 || y > y1) {
          const idx = y * w + x;
          if (data[idx * 4 + 3] >= 30) ringIndices.push(idx);
        }
      }
    }
    if (ringIndices.length < 24) return fallback;
    const localRingGmm = buildLabGmmClusters(lab, ringIndices, 7);

    const initMask = new Uint8Array(w * h);
    const mustFg = new Uint8Array(w * h);
    let count = 0;

    // Seed PROB_FG pixels inside `box` that clearly differ from the immediate outer ring
    const rx = (x1 - x0) / 2;
    const ry = (y1 - y0) / 2;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const idx = y * w + x;
        if (data[idx * 4 + 3] < 30) continue;
        const o = idx * 3;
        const L = lab[o];
        const a = lab[o + 1];
        const b = lab[o + 2];
        let minRingD = Infinity;
        for (let c = 0; c < localRingGmm.length; c++) {
          const cl = localRingGmm[c];
          const dL = L - cl.L;
          const da = a - cl.a;
          const db = b - cl.b;
          const d = Math.sqrt(0.42 * dL * dL + 1.45 * da * da + 1.45 * db * db);
          if (d < minRingD) minRingD = d;
        }
        const ellipDist = Math.hypot((x - cx) / Math.max(2, rx), (y - cy) / Math.max(2, ry));
        if (minRingD > 11 || ellipDist < 0.68) {
          initMask[idx] = 1;
          count++;
        }
        if (ellipDist < 0.34 && minRingD > 14) {
          mustFg[idx] = 1;
        }
      }
    }

    const boxArea = (x1 - x0 + 1) * (y1 - y0 + 1);
    if (count < boxArea * 0.1) return fallback;

    const grabCutMask = runGrabCutSegmentation(scene, initMask, roi, mustFg);
    // Hard clamp silhouette strictly inside `box` (+ 2px margin) so surrounding hands/tools cannot leak in
    for (let y = roi.y0; y <= roi.y1; y++) {
      for (let x = roi.x0; x <= roi.x1; x++) {
        if (x < x0 - 2 || x > x1 + 2 || y < y0 - 2 || y > y1 + 2) {
          grabCutMask[y * w + x] = 0;
        }
      }
    }

    const traced = traceMaskOuterBoundary(grabCutMask, w, h, box);
    const minRetention = boxAreaNorm >= 0.4 ? 0.8 : 0.75;
    if (traced.region.width * traced.region.height < boxAreaNorm * minRetention) {
      return fallback;
    }
    return {
      id: fallback.id,
      region: traced.region,
      polygon: traced.polygon,
      center: hintCenter || traced.center,
      label: meta?.label,
      partFamily: meta?.partFamily,
      edgeLocked: true,
    };
  } catch {
    return fallback;
  }
}

/**
 * Extracts pixel-accurate part silhouettes and interior clickable dots directly
 * from a neural alpha matte (`@imgly/background-removal` isnet_quint8).
 */
export function extractContoursFromAlphaMask(alphaData: AlphaMaskData): DetectedPartContour[] {
  const { width: srcW, height: srcH, alphaMask } = alphaData;
  if (!srcW || !srcH || alphaMask.length < srcW * srcH) return [];

  const maxTraceDim = 280;
  const scale = Math.min(1, maxTraceDim / Math.max(srcW, srcH));
  const w = Math.max(32, Math.round(srcW * scale));
  const h = Math.max(32, Math.round(srcH * scale));

  const binary = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y / h) * srcH));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x / w) * srcW));
      if (alphaMask[sy * srcW + sx] >= 68) {
        binary[y * w + x] = 1;
      }
    }
  }
  const closedBinary = erodeMask(fillEnclosedHoles(dilateMask(binary, w, h), w, h), w, h);

  const visited = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const minPixels = Math.max(36, Math.round(w * h * 0.004));
  const comps: Array<{
    pixels: number[];
    sumX: number;
    sumY: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    score: number;
  }> = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (!closedBinary[start] || visited[start]) continue;

      let sp = 0;
      stack[sp++] = start;
      visited[start] = 1;
      const pixels: number[] = [];
      let sumX = 0;
      let sumY = 0;
      let minX = w;
      let maxX = 0;
      let minY = h;
      let maxY = 0;

      while (sp > 0) {
        const cur = stack[--sp];
        const cx = cur % w;
        const cy = Math.floor(cur / w);
        pixels.push(cur);
        sumX += cx;
        sumY += cy;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        if (cx > 0 && closedBinary[cur - 1] && !visited[cur - 1]) {
          visited[cur - 1] = 1;
          stack[sp++] = cur - 1;
        }
        if (cx < w - 1 && closedBinary[cur + 1] && !visited[cur + 1]) {
          visited[cur + 1] = 1;
          stack[sp++] = cur + 1;
        }
        if (cy > 0 && closedBinary[cur - w] && !visited[cur - w]) {
          visited[cur - w] = 1;
          stack[sp++] = cur - w;
        }
        if (cy < h - 1 && closedBinary[cur + w] && !visited[cur + w]) {
          visited[cur + w] = 1;
          stack[sp++] = cur + w;
        }
      }

      if (pixels.length < minPixels) continue;

      const meanX = sumX / pixels.length / w;
      const meanY = sumY / pixels.length / h;
      const centerBias = Math.max(0.4, 1 - Math.hypot(meanX - 0.5, meanY - 0.5) * 0.6);
      comps.push({
        pixels,
        sumX,
        sumY,
        minX,
        maxX,
        minY,
        maxY,
        score: pixels.length * centerBias,
      });
    }
  }

  if (comps.length === 0) return [];
  comps.sort((a, b) => b.score - a.score);
  const topScore = comps[0].score;

  const fallbackBox: ImageRegion = { x: 0.14, y: 0.14, width: 0.72, height: 0.72 };
  const results: DetectedPartContour[] = [];

  const significantComps = comps.filter((c, i) => i === 0 || c.score >= topScore * 0.22).slice(0, 6);

  // If multiple foreground blobs substantially overlap each other's bounding boxes
  // (e.g. stacked/nested rings or disassembled halves overlapping in 2D projection),
  // synthesize a combined assembly at index 0 while keeping separated side-by-side objects distinct.
  if (significantComps.length >= 2) {
    const cluster = [significantComps[0]];
    let changed = true;
    while (changed) {
      changed = false;
      for (const cand of significantComps) {
        if (cluster.includes(cand)) continue;
        const cW = Math.max(1, cand.maxX - cand.minX);
        const cH = Math.max(1, cand.maxY - cand.minY);
        const overlapsCluster = cluster.some((m) => {
          const mW = Math.max(1, m.maxX - m.minX);
          const mH = Math.max(1, m.maxY - m.minY);
          const ovX = Math.min(cand.maxX, m.maxX) - Math.max(cand.minX, m.minX);
          const ovY = Math.min(cand.maxY, m.maxY) - Math.max(cand.minY, m.minY);
          return (
            ovX >= Math.min(cW, mW) * 0.14 &&
            ovY >= Math.min(cH, mH) * 0.14
          );
        });
        if (overlapsCluster) {
          cluster.push(cand);
          changed = true;
        }
      }
    }
    if (cluster.length >= 2) {
      const unionMask = new Uint8Array(w * h);
      for (const c of cluster) {
        for (let p = 0; p < c.pixels.length; p++) {
          unionMask[c.pixels[p]] = 1;
        }
      }
      const tracedUnion = traceMaskOuterBoundary(unionMask, w, h, fallbackBox);
      results.push({
        id: 'ai-seg-group',
        region: tracedUnion.region,
        polygon: tracedUnion.polygon,
        center: tracedUnion.center,
        edgeLocked: true,
        fromAiMask: true,
      });
    }
  }

  for (let i = 0; i < significantComps.length; i++) {
    const comp = significantComps[i];
    const compMask = new Uint8Array(w * h);
    for (let p = 0; p < comp.pixels.length; p++) {
      compMask[comp.pixels[p]] = 1;
    }
    const traced = traceMaskOuterBoundary(compMask, w, h, fallbackBox);
    results.push({
      id: `ai-seg-${results.length + 1}`,
      region: traced.region,
      polygon: traced.polygon,
      center: traced.center,
      edgeLocked: true,
      fromAiMask: true,
    });
  }

  return results.slice(0, 6);
}

/**
 * Order-independent fusion of ONNX neural contours (`aiBase`), Gemini vision boxes
 * (`geminiParts`), and instant client CV contours (`localCandidates`).
 * Guarantees Element 0 frames the complete foreground part or stacked group while
 * keeping inner sub-parts and hand-held compact parts intact regardless of async timing.
 */
export function fuseDetectionCandidates(
  aiBase: DetectedPartContour[],
  geminiParts: DetectedPartContour[],
  localCandidates: DetectedPartContour[],
): DetectedPartContour[] {
  if (geminiParts.length === 0) {
    return aiBase.length > 0 ? aiBase : localCandidates;
  }

  const areaOf = (r: ImageRegion) => Math.max(1e-5, r.width * r.height);
  const countEdgeTouches = (r: ImageRegion) =>
    (r.x <= 0.025 ? 1 : 0) +
    (r.y <= 0.025 ? 1 : 0) +
    (r.x + r.width >= 0.975 ? 1 : 0) +
    (r.y + r.height >= 0.975 ? 1 : 0);
  const overlapArea = (a: ImageRegion, b: ImageRegion) => {
    const ix0 = Math.max(a.x, b.x);
    const iy0 = Math.max(a.y, b.y);
    const ix1 = Math.min(a.x + a.width, b.x + b.width);
    const iy1 = Math.min(a.y + a.height, b.y + b.height);
    return ix1 > ix0 && iy1 > iy0 ? (ix1 - ix0) * (iy1 - iy0) : 0;
  };

  const claimedAiIds = new Set<string>();
  const mergedRaw: DetectedPartContour[] = [];

  for (const sp of geminiParts) {
    const spArea = areaOf(sp.region);
    const spTouches = countEdgeTouches(sp.region);

    let bestAi: DetectedPartContour | undefined;
    let bestOverlap = 0;
    for (const ai of aiBase) {
      const aiArea = areaOf(ai.region);
      const inter = overlapArea(sp.region, ai.region);
      const ratio = inter / Math.min(spArea, aiArea);
      if (ratio > 0.42 && ratio > bestOverlap) {
        bestOverlap = ratio;
        bestAi = ai;
      }
    }

    if (bestAi) {
      const aiArea = areaOf(bestAi.region);
      const aiTouches = countEdgeTouches(bestAi.region);

      if (!bestAi.fromAiMask) {
        // `refineAutoContoursWithAiMask` already isolated a compact held part inside a hand/glove
        if (spArea <= aiArea * 1.45 && spArea >= aiArea * 0.55) {
          claimedAiIds.add(bestAi.id);
          mergedRaw.push({
            ...bestAi,
            id: sp.id || bestAi.id,
            label: sp.label || bestAi.label,
            partFamily: sp.partFamily || bestAi.partFamily,
          });
          continue;
        }
        mergedRaw.push(sp);
        continue;
      }

      const aiLooksLikeArmWrapper =
        aiTouches >= 1 &&
        aiArea < 0.44 &&
        spArea <= Math.min(0.22, aiArea * 0.42) &&
        spTouches === 0 &&
        geminiParts.length === 1;

      if (aiLooksLikeArmWrapper) {
        mergedRaw.push(sp);
        continue;
      }

      if (spArea > aiArea * 1.25 && spTouches <= 1 && spArea <= 0.90) {
        mergedRaw.push(sp);
        continue;
      }

      // If this enclosing neural contour has NOT been emitted yet and frames >= 80% of `sp`,
      // emit the pixel-accurate whole assembly (e.g., all 3 stacked rings, whole wheel) labeled by Gemini.
      if (!claimedAiIds.has(bestAi.id) && aiArea >= spArea * 0.80) {
        claimedAiIds.add(bestAi.id);
        mergedRaw.push({
          ...bestAi,
          id: sp.id || bestAi.id,
          label: sp.label || bestAi.label,
          partFamily: sp.partFamily || bestAi.partFamily,
        });
        // Preserve distinct inner sub-part (`sp`) if it is significantly smaller than the enclosing whole assembly
        if (aiArea / spArea >= 1.85) {
          mergedRaw.push(sp);
        }
        continue;
      }

      // If `bestAi` was already emitted earlier and `sp` is a distinct smaller sub-part, keep `sp`
      if (claimedAiIds.has(bestAi.id) && aiArea / spArea >= 1.85) {
        mergedRaw.push(sp);
        continue;
      }

      if (spArea >= aiArea * 0.62) {
        mergedRaw.push({
          ...bestAi,
          id: sp.id || bestAi.id,
          label: sp.label || bestAi.label,
          partFamily: sp.partFamily || bestAi.partFamily,
        });
        continue;
      }
    }

    mergedRaw.push(sp);
  }

  // Deduplicate overlapping boxes while retaining legitimate nested whole+inner pairs
  const merged: DetectedPartContour[] = [];
  for (const cand of mergedRaw) {
    const cArea = areaOf(cand.region);
    const dup = merged.some((ex) => {
      const exArea = areaOf(ex.region);
      const areaRatio = Math.max(cArea, exArea) / Math.min(cArea, exArea);
      const inter = overlapArea(cand.region, ex.region);
      if (inter > 0) {
        const minOverlap = inter / Math.min(cArea, exArea);
        if (areaRatio >= 1.85 && minOverlap > 0.60) return false;
        if (minOverlap > 0.38) return true;
      }
      return (
        Math.hypot(cand.center.x - ex.center.x, cand.center.y - ex.center.y) < 0.10 &&
        areaRatio < 1.85
      );
    });
    if (!dup) merged.push(cand);
  }

  const lockedLocal = (aiBase.length > 0 ? aiBase : localCandidates).filter((c) => c.edgeLocked);
  for (const loc of lockedLocal) {
    if (merged.length >= 6) break;
    const locArea = areaOf(loc.region);
    const locTouches = countEdgeTouches(loc.region);
    const alreadyCovered = merged.some((sp) => {
      const spArea = areaOf(sp.region);
      const areaRatio = Math.max(locArea, spArea) / Math.min(locArea, spArea);
      // Allow a clean detached whole neural contour (`fromAiMask`) alongside a smaller single piece
      if (loc.fromAiMask && locTouches <= 1 && locArea > spArea * 1.30) return false;
      if (
        Math.hypot(sp.center.x - loc.center.x, sp.center.y - loc.center.y) < 0.20 &&
        areaRatio < 1.85
      ) {
        return true;
      }
      const inter = overlapArea(sp.region, loc.region);
      return inter > 0 && inter / Math.min(locArea, spArea) > 0.35 && areaRatio < 1.85;
    });
    if (!alreadyCovered) merged.push(loc);
  }

  // Always promote an enclosing complete foreground silhouette ahead of an embedded inner/partial piece
  if (merged.length >= 2) {
    const first = merged[0];
    const fArea = areaOf(first.region);
    const fTouches = countEdgeTouches(first.region);
    for (let i = 1; i < merged.length; i++) {
      const cand = merged[i];
      const oArea = areaOf(cand.region);
      const oTouches = countEdgeTouches(cand.region);
      const isCleanOuter = cand.fromAiMask ? oTouches <= 1 && oArea <= 0.92 : oTouches <= 1 && oArea <= 0.88;
      if (!isCleanOuter) continue;
      // Do not replace an isolated tight held part inside a border-reaching arm wrapper
      const isArmOverTightPart =
        cand.fromAiMask &&
        oTouches >= 1 &&
        oArea < 0.44 &&
        fArea <= Math.min(0.22, oArea * 0.42) &&
        fTouches === 0 &&
        geminiParts.length === 1;
      if (isArmOverTightPart) continue;

      if (oArea > fArea * 1.25) {
        const enclosed = overlapArea(cand.region, first.region) / fArea;
        if (enclosed >= 0.62) {
          merged.splice(i, 1);
          merged.unshift({
            ...cand,
            label: cand.label || first.label,
            partFamily: cand.partFamily || first.partFamily,
          });
          break;
        }
      }
    }
  }

  return merged.slice(0, 6);
}

/**
 * Automatically detects all distinct physical parts via client-side Lab+GrabCut
 * segmentation right after image upload — replacing fixed crop rectangles with exact contours.
 */
export async function analyzeImageAutoContour(
  src: string,
  rotationDeg = 0,
): Promise<{ primary: DetectedPartContour; candidates: DetectedPartContour[] }> {
  const fallbackBox: ImageRegion = { x: 0.18, y: 0.18, width: 0.64, height: 0.64 };
  const fallback: DetectedPartContour = {
    id: 'auto-1',
    region: fallbackBox,
    polygon: rectToRoundedPolygon(fallbackBox),
    center: { x: 0.5, y: 0.5 },
    edgeLocked: false,
  };

  try {
    const scene = await getOrComputeScene(src, rotationDeg);
    if (scene.candidates.length === 0) {
      return { primary: fallback, candidates: [fallback] };
    }
    return {
      primary: scene.candidates[0],
      candidates: scene.candidates,
    };
  } catch {
    return { primary: fallback, candidates: [fallback] };
  }
}

export function segmentInnerSubPartAtTap(
  scene: CachedScene,
  tx: number,
  ty: number,
  outerBound: ImageRegion,
  meta?: { id?: string; label?: string; partFamily?: string },
): DetectedPartContour | null {
  const { w, h, lab, data } = scene;
  const ox0 = Math.max(2, Math.floor(outerBound.x * w));
  const oy0 = Math.max(2, Math.floor(outerBound.y * h));
  const ox1 = Math.min(w - 3, Math.ceil((outerBound.x + outerBound.width) * w));
  const oy1 = Math.min(h - 3, Math.ceil((outerBound.y + outerBound.height) * h));
  const outerW = ox1 - ox0 + 1;
  const outerH = oy1 - oy0 + 1;
  const outerArea = outerW * outerH;
  if (outerW < 24 || outerH < 24) return null;

  const sx = Math.max(ox0 + 2, Math.min(ox1 - 2, Math.round(tx * w)));
  const sy = Math.max(oy0 + 2, Math.min(oy1 - 2, Math.round(ty * h)));

  // Collect foreground reference color pixels of the enclosing outer assembly (ignoring corner background outside circular rims)
  const excludeRadius = Math.max(8, Math.round(Math.min(outerW, outerH) * 0.25));
  const outerFgSamples: number[] = [];
  const outerFallbackSamples: number[] = [];
  const minBgThreshold = Math.max(8, scene.borderP90Dist * 1.5);
  for (let y = oy0; y <= oy1; y += 2) {
    for (let x = ox0; x <= ox1; x += 2) {
      if (Math.hypot(x - sx, y - sy) < excludeRadius) continue;
      const idx = y * w + x;
      if (data[idx * 4 + 3] < 35) continue;
      outerFallbackSamples.push(idx);
      if (scene.bgDist[idx] >= minBgThreshold && scene.geoDist[idx] >= 8) {
        outerFgSamples.push(idx);
      }
    }
  }
  const outerSamples = outerFgSamples.length >= 24 ? outerFgSamples : outerFallbackSamples;
  if (outerSamples.length < 24) return null;

  const outerGmm = buildLabGmmClusters(lab, outerSamples, 6);
  const gmmDist = (idx: number): number => {
    const o = idx * 3;
    const L = lab[o];
    const a = lab[o + 1];
    const b = lab[o + 2];
    let best = Infinity;
    for (let c = 0; c < outerGmm.length; c++) {
      const cl = outerGmm[c];
      const dL = L - cl.L;
      const da = a - cl.a;
      const db = b - cl.b;
      const d = Math.sqrt(0.42 * dL * dL + 1.48 * da * da + 1.48 * db * db);
      if (d < best) best = d;
    }
    return best;
  };

  // Sample 5x5 neighborhood around tap point to verify a distinct inner sub-part exists here
  let tapDistSum = 0;
  let tapSamples = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = Math.max(ox0, Math.min(ox1, sx + dx));
      const ny = Math.max(oy0, Math.min(oy1, sy + dy));
      tapDistSum += gmmDist(ny * w + nx);
      tapSamples++;
    }
  }
  const tapOuterDist = tapDistSum / Math.max(1, tapSamples);
  if (tapOuterDist < 13.5) return null;

  // Seed flood-fill from tap inside outerBound where pixels diverge significantly from the outer assembly
  const acceptThreshold = Math.max(10.5, Math.min(22, tapOuterDist * 0.44));
  const subMask = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const startIdx = sy * w + sx;
  subMask[startIdx] = 1;
  queue[tail++] = startIdx;

  let minX = sx;
  let maxX = sx;
  let minY = sy;
  let maxY = sy;
  let count = 1;
  const maxAllowed = Math.round(outerArea * 0.48);

  while (head < tail && count < maxAllowed) {
    const cur = queue[head++];
    const nbs = [cur - 1, cur + 1, cur - w, cur + w];
    for (const nb of nbs) {
      if (nb < 0 || nb >= w * h || subMask[nb]) continue;
      const nx = nb % w;
      const ny = Math.floor(nb / w);
      if (nx <= ox0 || nx >= ox1 || ny <= oy0 || ny >= oy1) continue;
      if (data[nb * 4 + 3] < 25) continue;
      if (gmmDist(nb) >= acceptThreshold) {
        subMask[nb] = 1;
        queue[tail++] = nb;
        count++;
        if (nx < minX) minX = nx;
        if (nx > maxX) maxX = nx;
        if (ny < minY) minY = ny;
        if (ny > maxY) maxY = ny;
      }
    }
  }

  if (count < Math.max(24, w * h * 0.004) || count >= maxAllowed * 0.96) {
    return null;
  }

  const closedSeed = fillEnclosedHoles(dilateMask(subMask, w, h), w, h);
  const mustFg = new Uint8Array(w * h);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const idx = y * w + x;
      if (subMask[idx] && gmmDist(idx) >= Math.max(acceptThreshold * 1.15, 14)) {
        mustFg[idx] = 1;
      }
    }
  }

  const padX = Math.max(6, Math.round((maxX - minX) * 0.28));
  const padY = Math.max(6, Math.round((maxY - minY) * 0.28));
  const roi = {
    x0: Math.max(ox0, minX - padX),
    y0: Math.max(oy0, minY - padY),
    x1: Math.min(ox1, maxX + padX),
    y1: Math.min(oy1, maxY + padY),
  };

  let finalMask = runGrabCutSegmentation(scene, closedSeed, roi, mustFg);
  let gcCount = 0;
  for (let y = roi.y0; y <= roi.y1; y++) {
    for (let x = roi.x0; x <= roi.x1; x++) {
      if (finalMask[y * w + x]) gcCount++;
    }
  }
  if (gcCount < Math.max(24, count * 0.45) || gcCount > outerArea * 0.52) {
    finalMask = closedSeed;
    gcCount = count;
  }
  if (gcCount > outerArea * 0.52) return null;

  const fallbackBox: ImageRegion = {
    x: clamp01(minX / w),
    y: clamp01(minY / h),
    width: Math.max(0.06, (maxX - minX) / w),
    height: Math.max(0.06, (maxY - minY) / h),
  };
  const traced = traceMaskOuterBoundary(finalMask, w, h, fallbackBox);
  if (traced.region.width * traced.region.height >= outerBound.width * outerBound.height * 0.62) {
    return null;
  }

  return {
    id: meta?.id || `sub-${Date.now()}`,
    region: traced.region,
    polygon: traced.polygon,
    center: traced.center,
    label: meta?.label,
    partFamily: meta?.partFamily,
    edgeLocked: true,
  };
}

/**
 * Click-to-Select GrabCut Segmentation:
 * - When `opts.preferInnerAtTap` is true (user clicked inside an already-selected large whole assembly),
 *   isolates a distinct embedded inner sub-part under the cursor (e.g. center bearing inside a pulley wheel).
 * - Otherwise clicks select the ENTIRE foreground object under the tap point, or return `null` on empty background.
 */
export async function segmentPartAtTapPoint(
  src: string,
  tapX: number,
  tapY: number,
  rotationDeg = 0,
  meta?: { id?: string; label?: string; partFamily?: string },
  opts?: { preferInnerAtTap?: boolean; outerBound?: ImageRegion },
): Promise<DetectedPartContour | null> {
  const tx = clamp01(tapX);
  const ty = clamp01(tapY);

  try {
    const scene = await getOrComputeScene(src, rotationDeg);
    const { w, h, compMap, candidates, saliency, edges, fgThreshold, bgDist, borderP90Dist, data } =
      scene;

    if (opts?.preferInnerAtTap && opts.outerBound) {
      const outerArea = opts.outerBound.width * opts.outerBound.height;
      const nestedCand = [...candidates]
        .filter((c) => {
          const cArea = c.region.width * c.region.height;
          if (cArea >= outerArea * 0.62) return false;
          const inRect =
            tx >= c.region.x &&
            tx <= c.region.x + c.region.width &&
            ty >= c.region.y &&
            ty <= c.region.y + c.region.height;
          if (!inRect) return false;
          return c.polygon.length >= 6 ? isPointInsidePolygon(tx, ty, c.polygon) : true;
        })
        .sort((a, b) => a.region.width * a.region.height - b.region.width * b.region.height)[0];

      if (nestedCand) {
        return {
          ...nestedCand,
          label: meta?.label || nestedCand.label,
          partFamily: meta?.partFamily || nestedCand.partFamily,
        };
      }

      const innerSeg = segmentInnerSubPartAtTap(scene, tx, ty, opts.outerBound, meta);
      if (innerSeg) return innerSeg;
      return null;
    }

    const sx = Math.max(2, Math.min(w - 3, Math.round(tx * w)));
    const sy = Math.max(2, Math.min(h - 3, Math.round(ty * h)));

    // 1. Direct or 3.5% touch-forgiveness lookup into cached GrabCut component map
    const directCompId = compMap[sy * w + sx];
    if (directCompId > 0 && candidates[directCompId - 1]) {
      const hit = candidates[directCompId - 1];
      return {
        ...hit,
        label: meta?.label || hit.label,
        partFamily: meta?.partFamily || hit.partFamily,
      };
    }

    const snapRadius = Math.max(3, Math.round(Math.min(w, h) * 0.036));
    let bestSnapComp = 0;
    let bestSnapDist = Infinity;
    for (let dy = -snapRadius; dy <= snapRadius; dy++) {
      const ny = sy + dy;
      if (ny < 2 || ny >= h - 2) continue;
      for (let dx = -snapRadius; dx <= snapRadius; dx++) {
        const nx = sx + dx;
        if (nx < 2 || nx >= w - 2) continue;
        const cid = compMap[ny * w + nx];
        if (cid > 0) {
          const d = dx * dx + dy * dy;
          if (d < bestSnapDist) {
            bestSnapDist = d;
            bestSnapComp = cid;
          }
        }
      }
    }

    if (bestSnapComp > 0 && candidates[bestSnapComp - 1]) {
      const hit = candidates[bestSnapComp - 1];
      return {
        ...hit,
        label: meta?.label || hit.label,
        partFamily: meta?.partFamily || hit.partFamily,
      };
    }

    // 2. No pre-detected component hit: verify a real high-contrast foreground object exists under tap
    let seedX = -1;
    let seedY = -1;
    let bestLocalScore = 0;
    const tightR = Math.max(3, Math.round(Math.min(w, h) * 0.025));
    const localTrigger = Math.max(16, fgThreshold * 1.05);

    for (let dy = -tightR; dy <= tightR; dy++) {
      const ny = sy + dy;
      if (ny < 2 || ny >= h - 2) continue;
      for (let dx = -tightR; dx <= tightR; dx++) {
        const nx = sx + dx;
        if (nx < 2 || nx >= w - 2) continue;
        const idx = ny * w + nx;
        const sc = saliency[idx] + edges[idx] * 0.25;
        if ((saliency[idx] > localTrigger || bgDist[idx] > borderP90Dist * 1.65) && sc > bestLocalScore) {
          bestLocalScore = sc;
          seedX = nx;
          seedY = ny;
        }
      }
    }

    // Empty background clicked: return null so active part cutout remains unchanged!
    if (seedX === -1 || seedY === -1) {
      return null;
    }

    const seedMask = new Uint8Array(w * h);
    const mustFg = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let head = 0;
    let tail = 0;
    const startIdx = seedY * w + seedX;
    seedMask[startIdx] = 1;
    mustFg[startIdx] = 1;
    queue[tail++] = startIdx;

    let minX = seedX;
    let maxX = seedX;
    let minY = seedY;
    let maxY = seedY;
    let count = 1;
    let bgDistSum = bgDist[startIdx];
    const maxPixels = Math.round(w * h * 0.45);
    const maxRadius = Math.max(w, h) * 0.45;

    while (head < tail && count < maxPixels) {
      const cur = queue[head++];
      const nbs = [cur - 1, cur + 1, cur - w, cur + w];
      for (const nb of nbs) {
        if (nb < 0 || nb >= w * h || seedMask[nb]) continue;
        const nx = nb % w;
        const ny = Math.floor(nb / w);
        if (nx <= 2 || nx >= w - 3 || ny <= 2 || ny >= h - 3) continue;
        if (Math.hypot(nx - seedX, ny - seedY) > maxRadius) continue;
        if (data[nb * 4 + 3] < 25) continue;

        if (saliency[nb] > fgThreshold * 0.85 || bgDist[nb] > borderP90Dist * 1.45) {
          seedMask[nb] = 1;
          if (Math.hypot(nx - seedX, ny - seedY) <= 4) mustFg[nb] = 1;
          queue[tail++] = nb;
          count++;
          bgDistSum += bgDist[nb];
          if (nx < minX) minX = nx;
          if (nx > maxX) maxX = nx;
          if (ny < minY) minY = ny;
          if (ny > maxY) maxY = ny;
        }
      }
    }

    if (
      count < Math.max(30, w * h * 0.004) ||
      count >= maxPixels * 0.9 ||
      bgDistSum / count < borderP90Dist * 1.15
    ) {
      return null;
    }

    const padX = Math.max(8, Math.round((maxX - minX) * 0.35));
    const padY = Math.max(8, Math.round((maxY - minY) * 0.35));
    const roi = {
      x0: Math.max(2, minX - padX),
      y0: Math.max(2, minY - padY),
      x1: Math.min(w - 3, maxX + padX),
      y1: Math.min(h - 3, maxY + padY),
    };

    const grabCutMask = runGrabCutSegmentation(scene, seedMask, roi, mustFg);
    const localBox: ImageRegion = {
      x: clamp01(tx - 0.14),
      y: clamp01(ty - 0.14),
      width: 0.28,
      height: 0.28,
    };
    const traced = traceMaskOuterBoundary(grabCutMask, w, h, localBox);
    return {
      id: meta?.id || `tap-${Date.now()}`,
      region: traced.region,
      polygon: traced.polygon,
      center: traced.center,
      label: meta?.label,
      partFamily: meta?.partFamily,
      edgeLocked: true,
    };
  } catch {
    return null;
  }
}

export function isPointInsidePolygon(x: number, y: number, poly: ContourPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Extracts compact lightness/metallic/shape signals strictly from pixels INSIDE the
 * segmented part silhouette (excluding background table/glare outside the contour).
 */
export async function inferVisualDescriptor(
  src: string,
  region?: ImageRegion,
  rotationDeg = 0,
  polygon?: ContourPoint[],
): Promise<VisualDescriptor> {
  const defaultDesc: VisualDescriptor = {
    isDark: false,
    isMetallic: true,
    isElongated: false,
    isCircular: true,
    avgLuma: 140,
    aspectRatio: 1,
  };
  try {
    const img = await loadHtmlImage(src);
    const { width: w, height: h, data } = drawRotatedToCanvas(img, rotationDeg);
    const r = region || { x: 0.15, y: 0.15, width: 0.7, height: 0.7 };
    const x0 = Math.max(0, Math.floor(r.x * w));
    const y0 = Math.max(0, Math.floor(r.y * h));
    const x1 = Math.min(w - 1, Math.ceil((r.x + r.width) * w));
    const y1 = Math.min(h - 1, Math.ceil((r.y + r.height) * h));
    const usePoly = Array.isArray(polygon) && polygon.length >= 6;

    let lumaSum = 0;
    let satSum = 0;
    let pxCount = 0;

    for (let y = y0; y <= y1; y += 2) {
      const ny = y / h;
      for (let x = x0; x <= x1; x += 2) {
        if (usePoly && !isPointInsidePolygon(x / w, ny, polygon!)) continue;
        const p = (y * w + x) * 4;
        if (data[p + 3] < 40) continue;
        const R = data[p];
        const G = data[p + 1];
        const B = data[p + 2];
        const luma = 0.299 * R + 0.587 * G + 0.114 * B;
        const maxC = Math.max(R, G, B);
        const minC = Math.min(R, G, B);
        lumaSum += luma;
        satSum += maxC - minC;
        pxCount++;
      }
    }

    if (pxCount === 0) return defaultDesc;
    const avgLuma = lumaSum / pxCount;
    const avgSat = satSum / pxCount;
    const rw = Math.max(0.05, r.width);
    const rh = Math.max(0.05, r.height);
    const aspectRatio = Math.max(rw, rh) / Math.min(rw, rh);

    return {
      isDark: avgLuma < 88,
      isMetallic: avgSat < 34 && avgLuma >= 85,
      isElongated: aspectRatio > 1.38,
      isCircular: aspectRatio <= 1.38,
      avgLuma: Math.round(avgLuma),
      aspectRatio: Number(aspectRatio.toFixed(2)),
    };
  } catch {
    return defaultDesc;
  }
}
