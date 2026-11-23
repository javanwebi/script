import type { ImageRegion } from './imageRegion';
import type { AlphaMaskData, ContourPoint } from './smartPartContour';

export interface SegmentedVisionCutout {
  /** Uniform pure-white (#FFFFFF) studio cutout composited from pixel alpha matte */
  previewUrl?: string;
  /** Pure white (#FFFFFF) studio cutout JPEG optimized for catalog AI visual matching */
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
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = outW;
  maskCanvas.height = outH;
  const mCtx = maskCanvas.getContext('2d');
  if (!mCtx) return null;

  mCtx.clearRect(0, 0, outW, outH);
  mCtx.beginPath();
  for (let i = 0; i < polygon.length; i++) {
    const px = ((polygon[i].x - rx) / rw) * outW;
    const py = ((polygon[i].y - ry) / rh) * outH;
    if (i === 0) mCtx.moveTo(px, py);
    else mCtx.lineTo(px, py);
  }
  mCtx.closePath();
  mCtx.fillStyle = '#000000';
  mCtx.shadowColor = '#000000';
  mCtx.shadowBlur = Math.max(1.5, Math.min(4, Math.min(outW, outH) * 0.008));
  mCtx.fill();

  const imgData = mCtx.getImageData(0, 0, outW, outH).data;
  const out = new Float32Array(outW * outH);
  for (let i = 0; i < out.length; i++) {
    out[i] = imgData[i * 4 + 3] / 255;
  }
  return out;
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
  const { width: aW, height: aH, alphaMask } = alphaData;
  if (!aW || !aH || alphaMask.length < aW * aH) return null;

  const out = new Float32Array(outW * outH);
  for (let y = 0; y < outH; y++) {
    const ny = ry + ((y + 0.5) / outH) * rh;
    const fy = ny * aH - 0.5;
    const y0 = Math.max(0, Math.min(aH - 1, Math.floor(fy)));
    const y1 = Math.max(0, Math.min(aH - 1, y0 + 1));
    const wy = Math.max(0, Math.min(1, fy - y0));
    const wyInv = 1 - wy;

    for (let x = 0; x < outW; x++) {
      const nx = rx + ((x + 0.5) / outW) * rw;
      const fx = nx * aW - 0.5;
      const x0 = Math.max(0, Math.min(aW - 1, Math.floor(fx)));
      const x1 = Math.max(0, Math.min(aW - 1, x0 + 1));
      const wx = Math.max(0, Math.min(1, fx - x0));
      const wxInv = 1 - wx;

      const sampled =
        (alphaMask[y0 * aW + x0] * wxInv * wyInv +
          alphaMask[y0 * aW + x1] * wx * wyInv +
          alphaMask[y1 * aW + x0] * wxInv * wy +
          alphaMask[y1 * aW + x1] * wx * wy) /
        255;

      // Crisp smoothstep matte ramp so anti-aliased edges blend cleanly into #FFFFFF
      let a = 0;
      if (sampled >= 0.78) a = 1;
      else if (sampled > 0.14) {
        const t = (sampled - 0.14) / 0.64;
        a = t * t * (3 - 2 * t);
      }
      out[y * outW + x] = a;
    }
  }
  return out;
}

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
      const el = new Image();
      if (/^https?:\/\//i.test(sourceUrl)) {
        el.crossOrigin = 'anonymous';
      }
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image_load_failed'));
      el.src = sourceUrl;
    });

    const natW = img.naturalWidth || 800;
    const natH = img.naturalHeight || 800;

    // 1. Apply rotation on intermediate canvas if needed
    const rot = ((rotationDeg % 360) + 360) % 360;
    const rotCanvas = document.createElement('canvas');
    const swapped = rot === 90 || rot === 270;
    rotCanvas.width = swapped ? natH : natW;
    rotCanvas.height = swapped ? natW : natH;
    const rCtx = rotCanvas.getContext('2d');
    if (!rCtx) return { previewUrl: sourceUrl, modelInputUrl: sourceUrl };

    rCtx.save();
    rCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
    rCtx.rotate((rot * Math.PI) / 180);
    rCtx.drawImage(img, -natW / 2, -natH / 2, natW, natH);
    rCtx.restore();

    // 2. Crop around detected part region
    const rx = region ? Math.max(0, Math.min(1, region.x)) : 0;
    const ry = region ? Math.max(0, Math.min(1, region.y)) : 0;
    const rw = region ? Math.max(0.05, Math.min(1 - rx, region.width)) : 1;
    const rh = region ? Math.max(0.05, Math.min(1 - ry, region.height)) : 1;

    const sx = Math.round(rx * rotCanvas.width);
    const sy = Math.round(ry * rotCanvas.height);
    const sw = Math.max(1, Math.round(rw * rotCanvas.width));
    const sh = Math.max(1, Math.round(rh * rotCanvas.height));

    const maxDim = 560;
    const scale = Math.min(1, maxDim / Math.max(sw, sh));
    const outW = Math.max(1, Math.round(sw * scale));
    const outH = Math.max(1, Math.round(sh * scale));

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
    if (!outCtx) return { previewUrl: sourceUrl, modelInputUrl: sourceUrl };

    outCtx.fillStyle = '#FFFFFF';
    outCtx.fillRect(0, 0, outW, outH);
    outCtx.drawImage(rotCanvas, sx, sy, sw, sh, 0, 0, outW, outH);

    // 3. Composite segmented silhouette onto pure #FFFFFF studio backdrop
    const alphaBuf = alphaData ? buildAlphaMaskBuffer(alphaData, rx, ry, rw, rh, outW, outH) : null;
    const polyBuf = polygon && polygon.length >= 6 ? buildPolygonMaskBuffer(polygon, rx, ry, rw, rh, outW, outH) : null;

    if (alphaBuf || polyBuf) {
      const total = outW * outH;
      let finalMask: Float32Array | null = null;

      if (alphaBuf && polyBuf) {
        let fgBoth = 0;
        let fgPoly = 0;
        for (let i = 0; i < total; i++) {
          if (polyBuf[i] >= 0.35) {
            fgPoly++;
            if (alphaBuf[i] >= 0.35) fgBoth++;
          }
        }
        if (fgBoth >= total * 0.035 && fgPoly > 0 && fgBoth / fgPoly >= 0.16) {
          finalMask = new Float32Array(total);
          for (let i = 0; i < total; i++) {
            finalMask[i] = alphaBuf[i] * polyBuf[i];
          }
        } else if (fgPoly >= total * 0.04) {
          finalMask = polyBuf;
        } else {
          finalMask = alphaBuf;
        }
      } else {
        finalMask = alphaBuf || polyBuf;
      }

      if (finalMask) {
        let fgCount = 0;
        for (let i = 0; i < total; i++) {
          if (finalMask[i] >= 0.35) fgCount++;
        }
        if (fgCount >= total * 0.035) {
          const imgData = outCtx.getImageData(0, 0, outW, outH);
          const pixels = imgData.data;
          for (let i = 0; i < total; i++) {
            const a = finalMask[i];
            const inv = 1 - a;
            const o = i * 4;
            pixels[o] = Math.round(pixels[o] * a + 255 * inv);
            pixels[o + 1] = Math.round(pixels[o + 1] * a + 255 * inv);
            pixels[o + 2] = Math.round(pixels[o + 2] * a + 255 * inv);
            pixels[o + 3] = 255;
          }
          outCtx.putImageData(imgData, 0, 0);
        }
      }
    }

    const cutoutUrl = outCanvas.toDataURL('image/jpeg', 0.91);
    return { previewUrl: cutoutUrl, modelInputUrl: cutoutUrl };
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
  const { modelInputUrl, previewUrl } = await renderSegmentedVisionCutout(
    sourceUrl,
    region,
    rotationDeg,
    polygon,
    alphaData,
  );
  return modelInputUrl || previewUrl;
}

/**
 * Downscales large camera/gallery photos to a lightweight JPEG (~860px max)
 * so both local CV segmentation and Gemini region detection run dramatically faster.
 */
export async function prepareFastVisionDetectionUrl(
  sourceUrl: string,
  maxDim = 860,
): Promise<string> {
  if (!sourceUrl) return sourceUrl;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image_load_failed'));
      el.src = sourceUrl;
    });
    const natW = img.naturalWidth || 800;
    const natH = img.naturalHeight || 800;
    const scale = Math.min(1, maxDim / Math.max(natW, natH));
    if (scale >= 0.96 && sourceUrl.startsWith('data:image/jpeg') && sourceUrl.length < 220_000) {
      return sourceUrl;
    }
    const outW = Math.max(1, Math.round(natW * scale));
    const outH = Math.max(1, Math.round(natH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return sourceUrl;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(img, 0, 0, outW, outH);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return sourceUrl;
  }
}
