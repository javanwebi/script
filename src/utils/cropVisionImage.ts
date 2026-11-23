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

export interface SegmentedVisionCutout {
  previewUrl?: string;
  modelInputUrl?: string;
}

function buildPolygonMaskBuffer(
  polygon: ContourPoint[],
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  outW: number,
  outH: number,
): Float32Array | null {
  if (!Array.isArray(polygon) || polygon.length < 6) return null;
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, outW, outH);
  ctx.beginPath();
  polygon.forEach((point, index) => {
    const x = ((point.x - rx) / rw) * outW;
    const y = ((point.y - ry) / rh) * outH;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = '#000';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = Math.max(1.5, Math.min(4, Math.min(outW, outH) * 0.008));
  ctx.fill();
  const pixels = ctx.getImageData(0, 0, outW, outH).data;
  const mask = new Float32Array(outW * outH);
  for (let i = 0; i < mask.length; i++) mask[i] = pixels[i * 4 + 3] / 255;
  return mask;
}

function buildAlphaMaskBuffer(
  alphaData: AlphaMaskData,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  outW: number,
  outH: number,
): Float32Array | null {
  const { width, height, alphaMask } = alphaData;
  if (!width || !height || alphaMask.length < width * height) return null;
  const out = new Float32Array(outW * outH);
  for (let y = 0; y < outH; y++) {
    const fy = (ry + ((y + 0.5) / outH) * rh) * height - 0.5;
    const y0 = Math.max(0, Math.min(height - 1, Math.floor(fy)));
    const y1 = Math.max(0, Math.min(height - 1, y0 + 1));
    const wy = Math.max(0, Math.min(1, fy - y0));
    for (let x = 0; x < outW; x++) {
      const fx = (rx + ((x + 0.5) / outW) * rw) * width - 0.5;
      const x0 = Math.max(0, Math.min(width - 1, Math.floor(fx)));
      const x1 = Math.max(0, Math.min(width - 1, x0 + 1));
      const wx = Math.max(0, Math.min(1, fx - x0));
      const top = alphaMask[y0 * width + x0] * (1 - wx) + alphaMask[y0 * width + x1] * wx;
      const bottom = alphaMask[y1 * width + x0] * (1 - wx) + alphaMask[y1 * width + x1] * wx;
      const sampled = (top * (1 - wy) + bottom * wy) / 255;
      let alpha = 0;
      if (sampled >= 0.78) alpha = 1;
      else if (sampled > 0.14) {
        const t = (sampled - 0.14) / 0.64;
        alpha = t * t * (3 - 2 * t);
      }
      out[y * outW + x] = alpha;
    }
  }
  return out;
}

/**
 * Crops the selected normalized region, then composites the local segmentation
 * matte and optional contour onto a clean white canvas for visual matching.
 * The original customer image remains untouched in the local image vault.
 */
export async function renderSegmentedVisionCutout(
  sourceUrl: string,
  region?: ImageRegion,
  rotationDeg = 0,
  polygon?: ContourPoint[],
  alphaData?: AlphaMaskData | null,
): Promise<SegmentedVisionCutout> {
  if (!sourceUrl) return {};
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      if (/^https?:\/\//i.test(sourceUrl)) element.crossOrigin = 'anonymous';
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('image_load_failed'));
      element.src = sourceUrl;
    });
    const naturalWidth = img.naturalWidth || 800;
    const naturalHeight = img.naturalHeight || 800;
    const rotation = ((rotationDeg % 360) + 360) % 360;
    // Avoid allocating a second full-resolution canvas on the normal (unrotated)
    // mobile path. A rotated source is created only when the caller requests it.
    let source: CanvasImageSource = img;
    let sourceWidth = naturalWidth;
    let sourceHeight = naturalHeight;
    if (rotation !== 0) {
      const rotated = document.createElement('canvas');
      const swapped = rotation === 90 || rotation === 270;
      rotated.width = swapped ? naturalHeight : naturalWidth;
      rotated.height = swapped ? naturalWidth : naturalHeight;
      const rotatedContext = rotated.getContext('2d');
      if (!rotatedContext) return { previewUrl: sourceUrl, modelInputUrl: sourceUrl };
      rotatedContext.save();
      rotatedContext.translate(rotated.width / 2, rotated.height / 2);
      rotatedContext.rotate((rotation * Math.PI) / 180);
      rotatedContext.drawImage(img, -naturalWidth / 2, -naturalHeight / 2, naturalWidth, naturalHeight);
      rotatedContext.restore();
      source = rotated;
      sourceWidth = rotated.width;
      sourceHeight = rotated.height;
    }

    const rx = region ? Math.max(0, Math.min(1, region.x)) : 0;
    const ry = region ? Math.max(0, Math.min(1, region.y)) : 0;
    const rw = region ? Math.max(0.05, Math.min(1 - rx, region.width)) : 1;
    const rh = region ? Math.max(0.05, Math.min(1 - ry, region.height)) : 1;
    const sx = Math.round(rx * sourceWidth);
    const sy = Math.round(ry * sourceHeight);
    const sw = Math.max(1, Math.round(rw * sourceWidth));
    const sh = Math.max(1, Math.round(rh * sourceHeight));
    const scale = Math.min(1, 560 / Math.max(sw, sh));
    const outW = Math.max(1, Math.round(sw * scale));
    const outH = Math.max(1, Math.round(sh * scale));
    const output = document.createElement('canvas');
    output.width = outW;
    output.height = outH;
    const context = output.getContext('2d', { willReadFrequently: true });
    if (!context) return { previewUrl: sourceUrl, modelInputUrl: sourceUrl };
    context.fillStyle = '#fff';
    context.fillRect(0, 0, outW, outH);
    context.drawImage(source, sx, sy, sw, sh, 0, 0, outW, outH);

    const alpha = alphaData ? buildAlphaMaskBuffer(alphaData, rx, ry, rw, rh, outW, outH) : null;
    const contour = polygon?.length && polygon.length >= 6
      ? buildPolygonMaskBuffer(polygon, rx, ry, rw, rh, outW, outH)
      : null;
    let finalMask: Float32Array | null = null;
    const total = outW * outH;
    if (alpha && contour) {
      let overlap = 0;
      let contourPixels = 0;
      for (let i = 0; i < total; i++) {
        if (contour[i] >= 0.35) {
          contourPixels++;
          if (alpha[i] >= 0.35) overlap++;
        }
      }
      if (overlap >= total * 0.035 && contourPixels > 0 && overlap / contourPixels >= 0.16) {
        finalMask = new Float32Array(total);
        for (let i = 0; i < total; i++) finalMask[i] = alpha[i] * contour[i];
      } else if (contourPixels >= total * 0.04) finalMask = contour;
      else finalMask = alpha;
    } else {
      finalMask = alpha || contour;
    }
    if (finalMask) {
      let foreground = 0;
      for (let i = 0; i < total; i++) if (finalMask[i] >= 0.35) foreground++;
      if (foreground >= total * 0.035) {
        const imageData = context.getImageData(0, 0, outW, outH);
        const pixels = imageData.data;
        for (let i = 0; i < total; i++) {
          const a = finalMask[i];
          const inverse = 1 - a;
          const offset = i * 4;
          pixels[offset] = Math.round(pixels[offset] * a + 255 * inverse);
          pixels[offset + 1] = Math.round(pixels[offset + 1] * a + 255 * inverse);
          pixels[offset + 2] = Math.round(pixels[offset + 2] * a + 255 * inverse);
          pixels[offset + 3] = 255;
        }
        context.putImageData(imageData, 0, 0);
      }
    }
    const cutout = output.toDataURL('image/jpeg', 0.91);
    return { previewUrl: cutout, modelInputUrl: cutout };
  } catch {
    const safe = sourceUrl.startsWith('data:') ? sourceUrl : undefined;
    return { previewUrl: safe, modelInputUrl: safe };
  }
}

export async function renderCroppedVisionDataUrl(
  sourceUrl: string,
  region?: ImageRegion,
  rotationDeg = 0,
  polygon?: ContourPoint[],
  alphaData?: AlphaMaskData | null,
): Promise<string | undefined> {
  const result = await renderSegmentedVisionCutout(sourceUrl, region, rotationDeg, polygon, alphaData);
  return result.modelInputUrl || result.previewUrl;
}

/** Downscales large camera/gallery images before local vision inference. */
export async function prepareFastVisionDetectionUrl(sourceUrl: string, maxDim = 860): Promise<string> {
  if (!sourceUrl) return sourceUrl;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.crossOrigin = 'anonymous';
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('image_load_failed'));
      element.src = sourceUrl;
    });
    const width = img.naturalWidth || 800;
    const height = img.naturalHeight || 800;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    if (scale >= 0.96 && sourceUrl.startsWith('data:image/jpeg') && sourceUrl.length < 220_000) return sourceUrl;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) return sourceUrl;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return sourceUrl;
  }
}
