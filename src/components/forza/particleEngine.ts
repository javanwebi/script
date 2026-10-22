// All geometry is generated here. Coordinates live on a 1200 × 760 design plane.
// A seeded PRNG makes reloads and recordings reproducible.
//
// Static mesh, rim, shoulders, outer face and logo bake once after assembly.
// Only the focused facial wave region remains live. Ring and glow sprites are
// cached too. Actual frame rates still depend on the browser and hardware.
export const W = 1200, H = 760;
const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (v: number) => {
  v = clamp(v);
  return v * v * (3 - 2 * v);
};
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function cubic(p: number[], t: number): [number, number] {
  const q = 1 - t;
  return [
    q * q * q * p[0] + 3 * q * q * t * p[2] + 3 * q * t * t * p[4] + t * t * t * p[6],
    q * q * q * p[1] + 3 * q * q * t * p[3] + 3 * q * t * t * p[5] + t * t * t * p[7],
  ];
}

// Brand palette: primary #e06518, secondary #55565a, white #ffffff.
// Only tints/shades of these three are used.
export const BRAND = { primary: "#e06518", secondary: "#55565a", white: "#ffffff", background: "#101012" };
const PALETTE = [
  "#55565a", // 0  secondary: inner contours
  "#55565a", // 1  secondary tint: head latitudes / accents
  "#ffffff", // 2  near white: silhouette edge
  "#ffffff", // 3  warm-white rim
  "#ffffff", // 4  warm-white highlights
  "#e06518", // 5  primary shade: clavicle accents
  "#e06518", // 6  primary: neck filaments
  "#e06518", // 7  primary tint: bright filament
  "#e06518", // 8  face heat 1
  "#e06518", // 9  face heat 2 (primary)
  "#e06518", // 10 face heat 3
  "#ffffff", // 11 face heat core (white-hot)
  "#e06518", // 12 logo particles (primary)
];
export const LOGO_COLOR = BRAND.primary;

const outline = [
  [600, 104, 682, 101, 728, 152, 717, 235],
  [717, 235, 731, 244, 727, 280, 715, 292],
  [715, 292, 706, 343, 659, 420, 600, 437],
];
const shoulder = [
  [677, 373, 669, 433, 673, 477, 706, 496],
  [706, 496, 750, 526, 823, 529, 865, 574],
  [865, 574, 889, 597, 905, 623, 915, 661],
];

// Logo sits in the middle of the chest. Design-plane rectangle.
export const LOGO_BOX = (() => {
  const w = 156, h = (w * 424) / 640, cx = 600, cy = 604;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
})();
const PAD = 12;
// Soft elliptical clearing around the logo (no hard box edge).
const inLogoZone = (x: number, y: number) => {
  const rx = LOGO_BOX.w / 2 + PAD + 6, ry = LOGO_BOX.h / 2 + PAD + 4;
  const dx = (x - (LOGO_BOX.x + LOGO_BOX.w / 2)) / rx, dy = (y - (LOGO_BOX.y + LOGO_BOX.h / 2)) / ry;
  return dx * dx + dy * dy < 1;
};

export interface LogoMask {
  data: Uint8ClampedArray;
  w: number;
  h: number;
}

export interface ParticlePoint {
  x: number;
  y: number;
  color: number;
  alpha: number;
  size: number;
  kind: number;
  seed: number;
  phase: number;
  focus: number;
  sx: number;
  sy: number;
}

export interface DustPoint {
  x: number;
  y: number;
  phase: number;
  rate: number;
  size: number;
  alpha: number;
}

export interface SceneAssets {
  face: HTMLCanvasElement;
  chest: HTMLCanvasElement;
  seed: HTMLCanvasElement;
  spark: HTMLCanvasElement;
  ring: HTMLCanvasElement;
  ribbon: HTMLCanvasElement;
}

export interface Scene {
  points: ParticlePoint[];
  dust: DustPoint[];
  live: ParticlePoint[][];
  still: ParticlePoint[][];
  baked: HTMLCanvasElement | null;
  assets: SceneAssets | null;
}

/** logoMask: optional { data: Uint8ClampedArray (RGBA), w, h } sampled from the logo. */
export function createScene(logoMask?: LogoMask | null): Scene {
  const random = rng(18742), points: ParticlePoint[] = [], dust: DustPoint[] = [];
  function add(x: number, y: number, color = 2, alpha = 0.6, size = 1, kind = 0) {
    const dx = x - 600, dy = y - 327;
    points.push({
      x,
      y,
      color,
      alpha,
      size,
      kind,
      seed: random(),
      phase: random() * TAU,
      focus: Math.exp(-((dx / 74) ** 2 + (dy / 73) ** 2)),
      sx: 600 + (random() - 0.5) * 990,
      sy: 610 + (random() - 0.5) * 270,
    });
  }
  // Edge particles: multiple imperfect strands read as light.
  for (const side of [-1, 1]) {
    for (const segment of [...outline, ...shoulder]) {
      for (let k = 0; k < 290; k++) {
        const [px, py] = cubic(segment, random());
        const jitter = (random() + random() + random() - 1.5);
        const x = 600 + side * (px - 600) + jitter * 3.5, y = py + (random() - 0.5) * 3;
        add(x, y, random() > 0.75 ? 3 : 2, 0.65 + random() * 0.35, 1.6 + random() * 1.1, 1);
        if (k % 4 === 0) dust.push({
          x: x + side * random() * 29,
          y: y + (random() - 0.5) * 42,
          phase: random() * TAU,
          rate: 0.2 + random() * 0.8,
          size: 0.6 + random() * 0.9,
          alpha: random() * 0.5,
        });
      }
    }
  }
  // Horizontal latitude contours: smooth, featureless head (animated every frame).
  for (let row = 0; row < 53; row++) {
    const y = 111 + row * 6.02;
    let half: number;
    if (y < 206) half = 117 * Math.sqrt(Math.max(0, 1 - ((y - 206) / 103) ** 2));
    else if (y < 270) half = 117 + (y - 206) * 0.018;
    else half = 120 * Math.pow(Math.max(0.015, 1 - ((y - 269) / 174) ** 1.4), 0.64);
    for (let x = -half; x <= half; x += 2.1) {
      const u = x / Math.max(half, 1);
      const curve = (-15 + 45 * smooth((y - 210) / 220)) * (1 - u * u);
      const yy = y + curve;
      const heat = Math.exp(-((x / 62) ** 2 + ((yy - 321) / 57) ** 2) * 1.28);
      const color = heat > 0.72 ? 11 : heat > 0.40 ? 10 : heat > 0.18 ? 9 : heat > 0.07 ? 8 : 1;
      add(600 + x, yy, color, heat > 0.07 ? 0.65 + heat * 0.35 : 0.42, 1.1 + heat * 1.5, 2);
    }
  }
  for (const side of [-1, 1]) {
    // Thin concentric shoulder / neck contours.
    for (let i = 0; i < 12; i++) {
      const inset = i * 9.2;
      const joinX = 730 - inset * 0.55, joinY = 525 + i * 6.2;
      const segments = [
        [674 - inset * 0.18, 394 + i * 4, 646 - inset * 0.30, 472 + i * 2.5, joinX - 46, joinY - 13, joinX, joinY],
        [joinX, joinY, joinX + 46, joinY + 13, 876 - inset * 0.7, 593 + i * 3.7, 903 - inset * 0.72, 670],
      ];
      for (const p of segments) for (let j = 0; j < 130; j++) {
        const [x, y] = cubic(p, j / 129);
        if (inLogoZone(600 + side * (x - 600), y)) continue;
        add(600 + side * (x - 600), y, i % 4 === 0 ? 1 : 0, (0.6 - i * 0.022) * clamp((690 - y) / 48), 1.1, 3);
      }
    }
    // Nested pectoral arches.
    for (let i = 0; i < 7; i++) {
      const p = [891 - i * 9, 669, 864 - i * 6, 549 + i * 6, 679 + i * 2.5, 542 + i * 9, 623 + i * 4, 674];
      for (let j = 0; j < 170; j++) {
        const [x, y] = cubic(p, j / 169);
        if (inLogoZone(600 + side * (x - 600), y)) continue;
        add(600 + side * (x - 600), y, i % 3 === 0 ? 1 : 0, 0.32, 1, 3);
      }
    }
    // Inner clavicle arcs (kept outside the logo plate).
    for (let i = 0; i < 8; i++) {
      const p = [641 + i * 5.5, 443 + i * 3.5, 619 + i * 5, 521, 610 + i * 8.5, 550, 609 + i * 11, 674];
      for (let j = 0; j < 100; j++) {
        const [x, y] = cubic(p, j / 99);
        if (inLogoZone(600 + side * (x - 600), y)) continue;
        add(600 + side * (x - 600), y, i < 3 ? 5 : 0, 0.3, 0.9, 3);
      }
    }
    // Orange neck filaments, now ending above the logo.
    const endY = LOGO_BOX.y - PAD - 2;
    for (let strand = 0; strand < 5; strand++) {
      for (let j = 0; j < 150; j++) {
        const t = j / 149, y = 424 + t * (endY - 424);
        const x = 600 + side * (7 + strand * 4 + (42 - strand * 3) * (1 - t) ** 2
          + Math.sin(t * 14 + strand * 0.6) * Math.sin(t * Math.PI) * 4.2);
        add(x, y, strand === 1 ? 7 : 6, (0.7 + Math.sin(t * Math.PI) * 0.28) * (1 - t * 0.45), 1.2, 4);
      }
    }
  }
  // Logo particles: sampled from the logo alpha so it assembles with the body.
  if (logoMask) {
    const { data, w, h } = logoMask, step = 1.35;
    for (let y = 0; y < LOGO_BOX.h; y += step) for (let x = 0; x < LOGO_BOX.w; x += step) {
      const mx = Math.min(w - 1, (x / LOGO_BOX.w * w) | 0), my = Math.min(h - 1, (y / LOGO_BOX.h * h) | 0);
      if (data[(my * w + mx) * 4 + 3] > 140) add(LOGO_BOX.x + x + (random() - 0.5) * 0.6, LOGO_BOX.y + y + (random() - 0.5) * 0.6, 12, 0.9, 1.35, 5);
    }
  }
  // Longitude mesh: the added depth is static, not another animated particle pass.
  for (let meridian = -5; meridian <= 5; meridian++) {
    for (let j = 0; j < 130; j++) {
      const y = 119 + j * 2.32;
      const half = y < 206 ? 117 * Math.sqrt(Math.max(0, 1 - ((y - 206) / 103) ** 2))
        : y < 270 ? 117 + (y - 206) * 0.018
        : 120 * Math.pow(Math.max(0.015, 1 - ((y - 269) / 174) ** 1.4), 0.64);
      const u = meridian / 6;
      const x = 600 + half * Math.sin(u * Math.PI / 2);
      add(x, y + (-15 + 45 * smooth((y - 210) / 220)) * (1 - u * u), meridian === 0 ? 5 : 1,
        0.14 + Math.abs(u) * 0.08, 0.8, 3);
    }
  }
  // Broken highlights on the shoulders, ribs and temples.
  for (const side of [-1, 1]) {
    for (let j = 0; j < 260; j++) {
      const t = j / 259, x = 600 + side * (92 + t * 207), y = 507 + Math.pow(t, 1.8) * 139;
      if (!inLogoZone(x, y)) add(x, y, j % 7 === 0 ? 7 : 2, 0.16 + random() * 0.19, 0.8 + random() * 0.6, 3);
    }
    for (let j = 0; j < 95; j++) {
      const y = 172 + j * 1.15, x = 600 + side * (105 + Math.sin(j * 0.033) * 9);
      add(x, y, 7, 0.14 + random() * 0.16, 0.85, 3);
    }
  }
  // Low-density ambient dust.
  for (let i = 0; i < 160; i++) dust.push({
    x: 600 + (random() - 0.5) * 760,
    y: 85 + random() * 610,
    phase: random() * TAU,
    rate: 0.12 + random() * 0.5,
    size: 0.6,
    alpha: 0.05 + random() * 0.09,
  });

  // Split: animated (face) vs. bakeable (everything else), bucketed by colour.
  const live: ParticlePoint[][] = PALETTE.map(() => []), still: ParticlePoint[][] = PALETTE.map(() => []);
  for (const p of points) (p.kind === 2 && p.focus > 0.025 ? live : still)[p.color].push(p);
  return { points, dust, live, still, baked: null, assets: null };
}

// Time at which every particle has reached its rest position.
const SETTLE_TIME = 0.28 + 0.75 + 0.46 + 2.85 + 0.05;

function drawBucket(
  ctx: CanvasRenderingContext2D,
  buckets: ParticlePoint[][],
  time: number,
  arrival: number,
  breathY: number,
  speech: number,
  isLive: boolean,
  quality = 2
) {
  for (let color = 0; color < PALETTE.length; color++) {
    const list = buckets[color];
    if (!list.length) continue;
    ctx.fillStyle = PALETTE[color];
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      // Reduce interior density while forming on weaker devices. The rim and
      // chest emblem stay intact. Settled static geometry is cached at full detail.
      if (quality < 2 && time < SETTLE_TIME && p.kind !== 1 && p.kind !== 5 &&
        i % (quality === 0 ? 3 : 2) !== 0) continue;
      if (isLive && quality === 0 && i % 2) continue;
      const delay = (p.y / 760) * 0.75 + p.seed * 0.46;
      const a = time >= SETTLE_TIME ? 1 : smooth((time - 0.28 - delay) / 2.85);
      if (a <= 0) continue;
      const disperse = 1 - a;
      let x = p.x, y = p.y;
      if (disperse > 0) {
        x += (p.sx - p.x) * disperse + Math.sin(p.phase + time * 2.1) * disperse * 96;
        y += (p.sy - p.y) * disperse + Math.cos(p.phase + time * 1.6) * disperse * 64;
      }
      if (isLive) {
        const dx = p.x - 600, dy = p.y - 327;
        const focus = p.focus;
        if (focus > 0.01) {
          y += focus * (Math.sin(dx * 0.072 + time * 4.6) * 4.5 + Math.sin(dx * 0.12 - time * 5.5) * 1.7) * (0.65 + speech);
          x += dx * focus * speech * 0.018;
        }
      }
      y += breathY;
      const flicker = isLive ? 0.78 + 0.22 * Math.sin(time * (1.5 + p.seed) + p.phase) ** 2 : 0.9;
      const warmth = color >= 8 && color <= 11 ? 0.77 + speech * 0.43 : 1;
      ctx.globalAlpha = clamp(p.alpha * flicker * warmth * (0.20 + 0.80 * a));
      ctx.fillRect(x, y, p.size, p.size);
    }
  }
}

/** Returns the breath offset so the caller can move the crisp logo with the body. */
export function paintScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  time: number,
  quality = 2,
  energy = 1,
  sound = 0
): { breathY: number; logoAlpha: number } {
  ctx.clearRect(0, 0, W, H);
  if (!scene.assets) scene.assets = createAssets();
  const assets = scene.assets;
  const arrival = smooth((time - 0.35) / 4.0), settled = smooth((time - 2.4) / 2.2);
  const breathY = Math.sin(time * 1.65) * 0.75 * settled;
  const speech = (0.45 + 0.25 * Math.sin(time * 2.7) + 0.21 * Math.sin(time * 5.4)) * (0.70 + 0.30 * Math.sin(time * 0.53) ** 2);
  const soundBoost = Math.max(0, Math.min(1, sound));
  // Warm emission behind the face.
  if (settled > 0) {
    ctx.globalAlpha = settled * (0.38 + speech * 0.28 + soundBoost * 0.36);
    ctx.drawImage(assets.face, 512, 239, 176, 176);
  }
  // Slowly breathing elliptical wavefronts around the shoulders, like the
  // reference's concentric energy field, instead of generic circular radar.
  for (let ring = 0; ring < (quality === 0 ? 3 : 5); ring++) {
    const pulse = (time * 0.045 + ring * 0.23) % 1;
    const rx = 185 + ring * 47 + pulse * 18, ry = 58 + ring * 19 + pulse * 11;
    ctx.globalAlpha = (0.11 + 0.07 * Math.sin(pulse * Math.PI) + soundBoost * 0.24 * Math.max(0, Math.sin(pulse * Math.PI * 2 + time * 3))) * settled;
    ctx.strokeStyle = ring % 2 ? "#55565a" : "#e06518";
    ctx.lineWidth = ring === 0 ? 1.2 : 0.7;
    ctx.beginPath();
    ctx.ellipse(600, 505, rx, ry, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  // Voice energy sparks outward from the head and follows the shoulder field.
  // Reuses the cached sprite, so microphone mode adds no new particles.
  if (soundBoost > 0.018 && quality === 0) {
    for (let i = 0; i < 12; i++) {
      const phase = (time * (0.16 + soundBoost * 0.44) + i / 12) % 1;
      const side = i % 2 ? 1 : -1;
      const rx = 112 + phase * 180, ry = 145 + phase * 172;
      const angle = -Math.PI * 0.28 + phase * Math.PI * 0.56 + (i % 3 - 1) * 0.16;
      const x = 600 + side * Math.cos(angle) * rx, y = 305 + Math.sin(angle) * ry;
      ctx.globalAlpha = (0.08 + soundBoost * 0.68) * Math.sin(phase * Math.PI);
      ctx.drawImage(assets.spark, x - 5 - soundBoost * 4, y - 5, 10 + soundBoost * 8, 10 + soundBoost * 8);
    }
    const pulse = 0.35 + 0.65 * Math.abs(Math.sin(time * 4 + soundBoost * 5));
    ctx.globalAlpha = soundBoost * pulse * 0.48;
    ctx.drawImage(assets.face, 512 - soundBoost * 18, 239 - soundBoost * 18,
      176 + soundBoost * 36, 176 + soundBoost * 36);
  }
  // Dust motes.
  ctx.fillStyle = "#55565a";
  for (let i = 0; i < scene.dust.length; i += quality === 0 ? 3 : quality === 1 ? 2 : 1) {
    const p = scene.dust[i];
    ctx.globalAlpha = p.alpha * arrival * (0.5 + 0.5 * Math.sin(time * p.rate + p.phase) ** 2);
    ctx.fillRect(p.x + Math.sin(time * 0.42 + p.phase) * 4, p.y - Math.sin(time * p.rate + p.phase) * 8, p.size, p.size);
  }
  // Static body: draw live until settled, then bake once and blit.
  if (time >= SETTLE_TIME) {
    if (!scene.baked && typeof document !== "undefined") {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const bCtx = c.getContext("2d");
      if (bCtx) {
        drawBucket(bCtx, scene.still, SETTLE_TIME + 10, 1, 0, 0, false);
        scene.baked = c;
      }
    }
    ctx.globalAlpha = 1;
    if (scene.baked) ctx.drawImage(scene.baked, 0, breathY);
  } else {
    drawBucket(ctx, scene.still, time, arrival, breathY, speech, false, quality);
  }
  drawBucket(ctx, scene.live, time, arrival, breathY, speech, true, quality);
  // Travelling rim-light packets add motion without animating the whole mesh.
  if (settled > 0 && quality > 0) {
    for (const side of [-1, 1]) for (let pulse = 0; pulse < 4; pulse++) {
      const phase = (time * 0.095 + pulse * 0.25) % 1;
      const pathIndex = Math.min(2, Math.floor(phase * 3));
      const [px, py] = cubic(outline[pathIndex], (phase * 3) % 1);
      ctx.globalAlpha = settled * 0.42 * Math.sin(phase * Math.PI) * energy * (1 + soundBoost * 1.5);
      ctx.drawImage(assets.spark, 600 + side * (px - 600) - 9, py + breathY - 9, 18, 18);
    }
    for (const side of [-1, 1]) for (let pulse = 0; pulse < 3; pulse++) {
      const t = (time * 0.24 + pulse / 3) % 1;
      const endY = LOGO_BOX.y - PAD - 2;
      const px = 600 + side * (14 + 36 * (1 - t) ** 2), py = 424 + t * (endY - 424);
      ctx.globalAlpha = settled * 0.5 * Math.sin(t * Math.PI) * energy * (1 + soundBoost * 1.7);
      ctx.drawImage(assets.spark, px - 7, py + breathY - 7, 14, 14);
    }
  }
  // One cached scan ribbon across the facial volume. No per-particle work.
  if (settled > 0 && quality > 0) {
    const scan = (time * 0.065) % 1;
    const sy = 133 + scan * 257;
    const half = sy < 206 ? 112 * Math.sqrt(Math.max(0, 1 - ((sy - 206) / 103) ** 2))
      : sy < 270 ? 112 : 113 * Math.pow(Math.max(0.015, 1 - ((sy - 269) / 174) ** 1.4), 0.64);
    ctx.globalAlpha = Math.sin(scan * Math.PI) * 0.22 * settled * energy;
    ctx.drawImage(assets.ribbon, 600 - half, sy + breathY, half * 2, 12);
  }
  // Chest seed during assembly: white core into brand orange.
  const seed = Math.max(0, 1 - smooth((time - 2.3) / 2.5));
  if (seed > 0) {
    ctx.globalAlpha = seed * Math.min(1.25, energy);
    ctx.drawImage(assets.seed, 550, 602, 100, 100);
  }
  ctx.globalAlpha = 1;
  return { breathY, logoAlpha: settled };
}

function surface(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function glow(size: number, stops: [number, string][]): HTMLCanvasElement {
  const c = surface(size, size), ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}
function createAssets(): SceneAssets {
  const ring = surface(576, 576), r = ring.getContext("2d")!;
  r.fillStyle = "#55565a";
  for (let j = 0; j < 420; j++) {
    const a = j / 420 * TAU;
    r.fillRect(288 + Math.cos(a) * 278, 288 + Math.sin(a) * 278, 1.4, 1.4);
  }
  const ribbon = surface(256, 16), s = ribbon.getContext("2d")!;
  const g = s.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, "#e0651800");
  g.addColorStop(0.5, "#ffffff");
  g.addColorStop(1, "#e0651800");
  s.fillStyle = g;
  s.fillRect(0, 7, 256, 1.2);
  return {
    face: glow(176, [[0, "#e06518aa"], [0.4, "#e0651840"], [1, "#e0651800"]]),
    chest: glow(192, [[0, "#e0651838"], [1, "#e0651800"]]),
    seed: glow(100, [[0, "#ffffff"], [0.1, "#ffffff"], [0.25, "#e06518"], [0.55, "#e0651844"], [1, "#e0651800"]]),
    spark: glow(32, [[0, "#ffffff"], [0.1, "#ffffff"], [0.3, "#e0651860"], [1, "#e0651800"]]),
    ring,
    ribbon,
  };
}

// Baked studio environment: illumination, atmosphere, pedestal and grain.
// Only drawn once per scene, then composited as one image per rendered frame.
export function createBackdrop(): HTMLCanvasElement {
  const c = surface(W, H), ctx = c.getContext("2d")!, random = rng(8720);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#070c1b");
  bg.addColorStop(0.56, "#091329");
  bg.addColorStop(1, "#080d1c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  function glowShape(x: number, y: number, rx: number, ry: number, inner: string, outer: string) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0, 0.02, 0, 0, 1);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  function path(points: number[], color: string, width: number, alpha: number) {
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 6)
      ctx.bezierCurveTo(points[i], points[i + 1], points[i + 2], points[i + 3], points[i + 4], points[i + 5]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha;
    ctx.stroke();
  }
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  glowShape(600, 288, 335, 380, "#e0651838", "#07132600");
  glowShape(210, 530, 310, 200, "#e0651820", "#07132600");
  glowShape(990, 530, 310, 200, "#e0651820", "#07132600");

  // A vivid, nearly continuous corona traces around the head and neck.
  for (let i = 0; i < 8; i++) {
    const inset = i * 5, wobble = (random() - 0.5) * 3;
    ctx.globalAlpha = 0.11 + i * 0.012;
    ctx.strokeStyle = i < 2 ? "#ffffff" : "#e06518";
    ctx.lineWidth = i === 0 ? 3.2 : 1;
    ctx.beginPath();
    ctx.ellipse(600, 270, 137 + inset, 173 + inset * 1.12, wobble * 0.008, Math.PI * 1.04, Math.PI * 1.96);
    ctx.stroke();
  }
  // Fine shoulder field lines follow the silhouette, with a soft outward bow.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 15; i++) {
      const k = i / 14, shift = k * 43;
      path([
        600 + side * (135 + shift), 478 + shift * 0.33,
        600 + side * (205 + shift), 438 + shift * 0.22,
        600 + side * (270 + shift), 443 + shift * 0.42,
        600 + side * (332 + shift), 482 + shift * 0.8
      ], i % 4 === 0 ? "#ffffff" : "#e06518", i % 4 === 0 ? 1.7 : 0.72, 0.14 + k * 0.11);
    }
    // Long energetic "waterfall" channels sweep around the head and flare
    // out over both shoulders, rather than meeting as rigid geometric wings.
    for (let i = 0; i < 15; i++) {
      const d = i * 11 + (random() - 0.5) * 8;
      const upper = [
        600 + side * (147 + d * 0.18), 451 + d * 0.14,
        600 + side * (247 + d * 0.4), 396 - d * 0.1,
        600 + side * (312 + d), 244 - d * 0.6,
        600 + side * (490 + d), 105 + d * 0.32
      ];
      path(upper, i % 5 === 0 ? "#ffffff" : "#e06518", i % 5 === 0 ? 2.1 : 0.9, i % 5 === 0 ? 0.26 : 0.12);
      if (i % 3 === 0) {
        path([
          600 + side * (222 + d * 0.3), 408,
          600 + side * (308 + d), 350 - d * 0.3,
          600 + side * (360 + d), 226 - d * 0.4,
          600 + side * (502 + d), 122 + d * 0.5
        ], "#ffffff", 1, 0.25);
      }
      const lower = [
        600 + side * (169 + d * 0.12), 535 + d * 0.12,
        600 + side * (282 + d * 0.45), 516 + d * 0.2,
        600 + side * (330 + d), 646 - d * 0.28,
        600 + side * (507 + d), 692 - d * 0.12
      ];
      path(lower, i % 4 === 0 ? "#ffffff" : "#55565a", i % 4 === 0 ? 1.8 : 0.8, i % 4 === 0 ? 0.2 : 0.1);
    }
    // Cloud of luminous plasma grains, concentrated around the curved streams.
    for (let i = 0; i < 680; i++) {
      const t = random(), band = random();
      const upper = random() < 0.56;
      const centerX = upper ? 600 + side * (252 + t * 238) : 600 + side * (280 + t * 235);
      const centerY = upper ? 405 - t * 295 : 528 + t * 152;
      const spread = 8 + 28 * Math.sin(t * Math.PI);
      const x = centerX + (random() - 0.5) * spread;
      const y = centerY + (band - 0.5) * spread * 1.45;
      const size = 0.45 + random() * 2;
      ctx.globalAlpha = 0.08 + random() * 0.38;
      ctx.fillStyle = random() > 0.11 ? "#e06518" : "#ffffff";
      ctx.fillRect(x + Math.sin(t * 38 + band * 8) * 7, y, size, size);
    }
  }
  // Gold current runs thread through the field, intentionally irregular.
  for (let side of [-1, 1]) for (let i = 0; i < 6; i++) {
    const d = i * 18 + (random() - 0.5) * 15;
    path([
      600 + side * (304 + d), 153 + i * 9,
      600 + side * (264 + d), 240 + i * 4,
      600 + side * (324 + d), 290 + i * 8,
      600 + side * (226 + d), 386 + i * 11
    ], i % 2 ? "#ffffff" : "#ffffff", 0.9 + random() * 0.8, 0.2 + random() * 0.18);
  }
  // Concentric wavefronts radiate across the shoulders, plus a warm face core.
  for (let i = 0; i < 10; i++) {
    ctx.globalAlpha = 0.08 + i * 0.009;
    ctx.strokeStyle = i % 4 === 0 ? "#ffffff" : "#55565a";
    ctx.lineWidth = i % 4 === 0 ? 1.3 : 0.7;
    ctx.beginPath();
    ctx.ellipse(600, 502, 204 + i * 34, 67 + i * 17, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  glowShape(600, 305, 94, 112, "#e065186b", "#e0651800");
  glowShape(600, 305, 52, 76, "#e06518a0", "#e0651800");
  glowShape(600, 305, 25, 42, "#ffffffa0", "#e0651800");
  // Fine luminous current filaments in the cheek / chin core.
  for (let i = 0; i < 13; i++) {
    const y = 279 + i * 5, w = 17 + 30 * Math.sin(i / 12 * Math.PI);
    path([
      600 - w, y,
      600 - w * 0.42, y - 4,
      600 + w * 0.32, y + 4,
      600 + w, y
    ], i % 3 === 0 ? "#ffffff" : "#ffffff", 0.9, 0.25 + i % 4 * 0.035);
  }
  ctx.restore();

  // Floating halo motes above the head, with a second spray along the waves.
  for (let i = 0; i < 980; i++) {
    let x: number, y: number;
    if (i < 370) {
      const a = random() * TAU, r = 1 + random() * 0.22;
      x = 600 + Math.cos(a) * (150 + random() * 36) * r;
      y = 270 + Math.sin(a) * (190 + random() * 48) * r;
    } else {
      const side = random() < 0.5 ? -1 : 1, t = random(), spread = 12 + 48 * Math.sin(t * Math.PI);
      x = 600 + side * (262 + t * 260) + (random() - 0.5) * spread;
      y = 421 - t * 310 + (random() - 0.5) * spread;
    }
    const size = 0.45 + random() * 1.8;
    ctx.globalAlpha = 0.07 + random() * 0.3;
    ctx.fillStyle = random() > 0.1 ? "#e06518" : "#ffffff";
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 1;
  return c;
}
