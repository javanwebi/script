export interface LayerArrays {
  pos: Float32Array;
  col: Float32Array;
  start: Float32Array;
  seed: Float32Array;
  lum: Float32Array;
  count: number;
}

export interface CachedLayers {
  sharp: LayerArrays;
  glow: LayerArrays;
  totalCount: number;
}

const WORLD_W = 6.4;

function toWorld(x: number, y: number, width: number, height: number): [number, number] {
  const cell = WORLD_W / width;
  return [(x - width / 2) * cell, -(y - height / 2) * cell];
}

function vortex(): [number, number, number] {
  const a = Math.random() * Math.PI * 2;
  const r = 3 + Math.random() * 4;
  return [Math.cos(a) * r, (Math.random() - 0.5) * 5, Math.sin(a) * r - 1];
}

/**
 * One canonical particle layout for every device.
 * Keep the same silhouette and glow samples; performance adaptation happens
 * in the renderer's pixel ratio, never by deleting the character on phones.
 */
export function buildParticleLayers(data: Uint8Array, width: number, height: number): CachedLayers {
  const stride = 2;
  const glowStep = 4;
  const sharpPos: number[] = [], sharpCol: number[] = [], sharpStart: number[] = [], sharpSeed: number[] = [], sharpLum: number[] = [];

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 3;
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const l = Math.max(r, g * 1.1, b);
      if (l < 0.06 || Math.random() > Math.pow(Math.min(1, l * 1.5), 1.6)) continue;
      const [wx, wy] = toWorld(x + (Math.random() - 0.5) * stride, y + (Math.random() - 0.5) * stride, width, height);
      sharpPos.push(wx, wy, l * 0.03);
      sharpCol.push(r, g, b);
      const v = vortex();
      sharpStart.push(v[0], v[1], v[2]);
      sharpSeed.push(Math.random());
      sharpLum.push(l);
    }
  }

  const glowPos: number[] = [], glowCol: number[] = [], glowStart: number[] = [], glowSeed: number[] = [], glowLum: number[] = [];
  for (let y = 0; y < height; y += glowStep) {
    for (let x = 0; x < width; x += glowStep) {
      let r = 0, g = 0, b = 0, samples = 0;
      for (let yy = 0; yy < glowStep && y + yy < height; yy++) {
        for (let xx = 0; xx < glowStep && x + xx < width; xx++) {
          const i = ((y + yy) * width + x + xx) * 3;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; samples++;
        }
      }
      if (!samples) continue;
      r /= samples * 255; g /= samples * 255; b /= samples * 255;
      const l = Math.max(r, g, b);
      if (l < 0.25) continue;
      const [wx, wy] = toWorld(x + glowStep / 2, y + glowStep / 2, width, height);
      glowPos.push(wx, wy, -0.02);
      glowCol.push(r, g * 0.85, b * 0.6);
      const v = vortex();
      glowStart.push(v[0], v[1], v[2]);
      glowSeed.push(Math.random());
      glowLum.push(l);
    }
  }

  const sharp: LayerArrays = {
    pos: new Float32Array(sharpPos), col: new Float32Array(sharpCol),
    start: new Float32Array(sharpStart), seed: new Float32Array(sharpSeed),
    lum: new Float32Array(sharpLum), count: sharpSeed.length,
  };
  const glow: LayerArrays = {
    pos: new Float32Array(glowPos), col: new Float32Array(glowCol),
    start: new Float32Array(glowStart), seed: new Float32Array(glowSeed),
    lum: new Float32Array(glowLum), count: glowSeed.length,
  };
  return { sharp, glow, totalCount: sharp.count + glow.count };
}

/** RGBA poster used only when a device/browser cannot keep a WebGL context. */
export function buildParticlePosterPixels(data: Uint8Array): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray((data.length / 3) * 4);
  for (let src = 0, dst = 0; src < data.length; src += 3, dst += 4) {
    const r = data[src], g = data[src + 1], b = data[src + 2];
    const l = Math.max(r, g, b);
    rgba[dst] = r;
    rgba[dst + 1] = g;
    rgba[dst + 2] = b;
    rgba[dst + 3] = l < 12 ? 0 : Math.min(255, Math.round(l * 1.2));
  }
  return rgba;
}
