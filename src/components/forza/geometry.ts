import * as THREE from 'three';

// Coordinates: 1200 x 800 stage, centered at x=0. All contours are made of particles.
export const CONFIG = {
  seed: 7319,
  introDuration: 4.8,
  // 1. Primary Orange: #e06518
  orange: [0.878, 0.396, 0.094] as [number, number, number],
  // 2. Secondary Silver Platinum: #dee2e5
  silver: [0.870, 0.886, 0.898] as [number, number, number],
  // 3. Pure White: #ffffff
  white: [1.0, 1.0, 1.0] as [number, number, number],
  pointSpacing: 0.95,
  mobilePointSpacing: 1.45,
};

function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let cachedAvatarDesktop: THREE.BufferGeometry | null = null;
let cachedAvatarCompact: THREE.BufferGeometry | null = null;

export function makeAvatarGeometry({ compact = false }: { compact?: boolean } = {}) {
  if (compact && cachedAvatarCompact) return cachedAvatarCompact.clone();
  if (!compact && cachedAvatarDesktop) return cachedAvatarDesktop.clone();

  const random = seeded(CONFIG.seed);
  const positions: number[] = [],
    colors: number[] = [],
    extras: number[] = [],
    seeds: number[] = [];
  const spacing = compact ? CONFIG.mobilePointSpacing : CONFIG.pointSpacing;

  // extras: size, opacity, kind, warmth; kind 0 contour, 1 rim, 2 dust,
  // 3 throat, 4 pressure wave, 5 chest light, 6 small signal indicator.
  function add(
    x: number,
    y: number,
    color: number[] | [number, number, number],
    size = 1.2,
    alpha = 0.6,
    kind = 0,
    warmth = 0
  ) {
    positions.push(x, 400 - y, 0);
    colors.push(color[0], color[1], color[2]);
    extras.push(size, alpha, kind, warmth);
    seeds.push(random(), random(), random(), random());
  }

  function curve(
    points: [number, number][],
    {
      color = CONFIG.silver,
      alpha = 0.6,
      size = 1.2,
      kind = 0,
      jitter = 0,
      density = 1,
    }: {
      color?: number[] | [number, number, number];
      alpha?: number;
      size?: number;
      kind?: number;
      jitter?: number;
      density?: number;
    } = {}
  ) {
    const c = new THREE.CatmullRomCurve3(
      points.map(([x, y]) => new THREE.Vector3(x, y, 0)),
      false,
      'centripetal'
    );
    const count = Math.ceil((c.getLength() * density) / spacing);
    for (let k = 0; k < count; k++) {
      const p = c.getPoint(k / (count - 1));
      add(p.x + (random() - 0.5) * jitter, p.y + (random() - 0.5) * jitter, color, size, alpha, kind);
    }
    return c;
  }

  const halfHead: [number, number][] = [
    [0, 110],
    [51, 119],
    [91, 145],
    [118, 190],
    [128, 234],
    [128, 265],
    [130, 288],
    [132, 303],
    [126, 329],
    [112, 367],
    [91, 406],
    [64, 436],
    [31, 455],
    [0, 464],
  ];

  const neck: [number, number][] = [
    [96, 402],
    [88, 446],
    [92, 487],
    [117, 520],
    [166, 542],
    [225, 559],
    [282, 583],
    [324, 626],
    [349, 685],
  ];

  const rims: THREE.CatmullRomCurve3[] = [];
  for (const side of [-1, 1]) {
    for (const shape of [halfHead, neck]) {
      const path: [number, number][] = shape.map(([x, y]) => [side * x, y]);
      rims.push(curve(path, { color: CONFIG.white, alpha: 0.92, size: 2.0, kind: 1, density: 1.7 }));
      for (let j = 0; j < 5; j++) {
        curve(
          path.map(([x, y]) => [x + side * (j - 2) * 1.6, y + Math.sin(y * 0.02 + j) * 0.8]),
          { color: CONFIG.silver, alpha: 0.22, size: 1.1, kind: 1, jitter: 1.5 }
        );
      }
    }
  }

  function halfWidth(t: number) {
    const y = 110 + t * 354;
    for (let i = 1; i < halfHead.length; i++) {
      if (y <= halfHead[i][1]) {
        const a = halfHead[i - 1],
          b = halfHead[i];
        const f = (y - a[1]) / (b[1] - a[1]);
        return a[0] + (b[0] - a[0]) * f;
      }
    }
    return 0;
  }

  // Frontal latitude curves with warped ends to give the head volume in platinum #dee2e5 & white
  for (let row = 1; row <= 46; row++) {
    const t = row / 48,
      baseY = 110 + t * 354,
      width = halfWidth(t);
    const count = Math.ceil((width * 2.9) / spacing);
    for (let i = 0; i <= count; i++) {
      const angle = -Math.PI / 2 + (i / count) * Math.PI;
      const x = Math.sin(angle) * width,
        depth = Math.cos(angle);
      const curvature = 50 * Math.min(1, t / 0.24);
      const y = baseY - Math.cos(t * Math.PI) * curvature * depth;
      const hot = Math.exp(-((x / 90) ** 2) - ((y - 337) / 73) ** 2);
      const edge = Math.abs(Math.sin(angle)) ** 7;

      const baseCol = [0.870 * (0.65 + depth * 0.35), 0.886 * (0.65 + depth * 0.35), 0.898 * (0.7 + edge * 0.3)];
      add(
        x,
        y,
        baseCol,
        1.15 + hot * 0.35,
        0.36 + edge * 0.35 + hot * 0.3,
        0,
        hot
      );
    }
  }

  for (let row = 2; row < 40; row++) {
    const t = row / 42,
      width = halfWidth(t),
      baseY = 110 + t * 354;
    for (let i = 0; i < 100; i++) {
      const a = -Math.PI / 2 + (i / 99) * Math.PI;
      add(
        Math.sin(a) * width,
        baseY + Math.cos(t * Math.PI) * 24 * Math.cos(a),
        [0.78, 0.81, 0.84],
        0.85,
        0.12,
        0
      );
    }
  }

  // Clavicle contours nest toward the sternum.
  for (const side of [-1, 1]) {
    for (let j = 0; j < 11; j++) {
      const rx = 163 - j * 12,
        ry = 145 - j * 11;
      const count = Math.ceil((Math.PI * Math.max(rx, ry)) / spacing);
      for (let k = 0; k <= count; k++) {
        const a = (k / count) * Math.PI;
        add(
          side * (186 + j * 2 + Math.cos(a) * rx),
          711 - Math.sin(a) * ry + Math.sin(a * 3) * 2,
          CONFIG.silver,
          1.08,
          0.48 - j * 0.011,
          0
        );
      }
      if (j < 11) {
        const path: [number, number][] = [
          [90 - j * 4.9, 423 + j * 3],
          [84 - j * 4.7, 471 + j * 3],
          [96 - j * 4.8, 510 + j * 3.7],
          [125 - j * 5.2, 543 + j * 5.3],
          [148 - j * 5.5, 568 + j * 6.5],
          [157 - j * 5.8, 587 + j * 7.1],
        ].map(([x, y]) => [side * x, y]);
        curve(path, { color: [0.72, 0.75, 0.78], alpha: 0.35 - j * 0.013, size: 0.95, jitter: 0.25 });
      }
    }
    for (let j = 0; j < 7; j++) {
      const points: [number, number][] = [
        [64 - j * 5.5, 444 + j * 1.9],
        [58 - j * 5.5, 474],
        [48 - j * 5.1, 505],
        [40 - j * 4.9 + Math.sin(j) * 6, 534],
        [27 - j * 3.5, 554],
        [22 - j * 3, 580],
        [9 - j * 1.25, 607],
        [5 - j * 0.65, 652],
        [3 - j * 0.45, 699],
      ].map(([x, y]) => [side * x, y]);
      curve(points, {
        color: CONFIG.orange,
        alpha: 0.68 - j * 0.055,
        size: j < 2 ? 1.5 : 0.95,
        kind: 3,
        jitter: 0.65,
      });
    }
  }

  for (let j = 0; j < 12; j++) {
    const width = 77 - j * 4.5;
    curve(
      [
        [-width, 436 + j * 7],
        [-width * 0.7, 461 + j * 7],
        [0, 482 + j * 7],
        [width * 0.7, 461 + j * 7],
        [width, 436 + j * 7],
      ],
      { color: [0.76, 0.79, 0.82], size: 0.8, alpha: 0.28 }
    );
  }

  const dustCount = compact ? 6500 : 12500;
  for (let i = 0; i < dustCount; i++) {
    const path = rims[Math.floor(random() * rims.length)],
      p = path.getPoint(random());
    const spread = 2 + random() ** 2 * 23;
    const isOrangeDust = random() < 0.22;
    add(
      p.x + (random() - 0.5) * spread * 2,
      p.y + (random() - 0.5) * spread * 2,
      isOrangeDust ? CONFIG.orange : random() < 0.5 ? CONFIG.white : CONFIG.silver,
      0.6 + random() * 1.5,
      0.12 + random() * 0.47,
      2
    );
  }

  for (let i = 0; i < (compact ? 1400 : 2600); i++) {
    const a = random() * Math.PI * 2,
      r = Math.sqrt(random());
    const x = Math.cos(a) * r * 82,
      y = 339 + Math.sin(a) * r * 88;
    const warm = Math.exp(-((x / 72) ** 2) - ((y - 337) / 62) ** 2);
    add(x, y, CONFIG.orange, 0.45 + random() * 0.7, 0.08 + warm * 0.16, 2, warm);
  }

  for (let ring = 0; ring < 8; ring++) {
    const radius = 162 + ring * 21;
    for (let i = 0; i < 900; i++) {
      const a = (i / 900) * Math.PI * 2;
      add(
        Math.cos(a) * radius,
        302 + Math.sin(a) * radius * 1.16,
        ring % 2 === 0 ? CONFIG.orange : CONFIG.silver,
        1.25,
        0.52,
        4,
        ring / 8
      );
    }
  }

  for (let bar = 0; bar < 23; bar++) {
    for (let j = 0; j < 7; j++) {
      if (bar === 16 || bar === 17) continue;
      add(232 + bar * 2.45, 505 + j * 0.7, CONFIG.orange, 1.0, 0.9, 6, bar / 23);
    }
  }

  // --- HOLOGRAPHIC PEDESTAL RING UNDER AI ---
  const ringBaseY = 716;
  const ringPts = compact ? 850 : 1600;
  const rxMain = 315;
  const ryMain = 48;

  // 1. Primary Ring in vibrant #e06518 Orange with White Highlights
  for (let i = 0; i < ringPts; i++) {
    const angle = (i / ringPts) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const depth = 0.7 + 0.3 * sinA;

    for (let strand = -2; strand <= 2; strand++) {
      const rx = rxMain + strand * 2.4;
      const ry = ryMain + strand * 0.38;
      const x = cosA * rx + (random() - 0.5) * 1.0;
      const y = ringBaseY + sinA * ry + (random() - 0.5) * 0.8;

      const isCore = Math.abs(strand) <= 1;
      const color = isCore ? CONFIG.orange : strand === 0 ? CONFIG.white : [0.95, 0.52, 0.12];
      const size = isCore ? 1.5 + random() * 0.5 : 0.85 + random() * 0.4;
      const alpha = (isCore ? 0.85 : 0.4) * depth;

      add(x, y, color, size, alpha, 7, angle / (Math.PI * 2));
    }
  }

  // 2. Concentric inner accent ring (platinum silver #dee2e5 & white track)
  const rxInner = 248;
  const ryInner = 38;
  const innerPts = compact ? 420 : 800;
  for (let i = 0; i < innerPts; i++) {
    const angle = (i / innerPts) * Math.PI * 2;
    const seg = Math.sin(angle * 6);
    if (seg < -0.35) continue;

    const isWhiteAccent = Math.sin(angle * 3) > 0.35;
    const color = isWhiteAccent ? CONFIG.white : CONFIG.silver;
    const x = Math.cos(angle) * rxInner + (random() - 0.5) * 1.1;
    const y = ringBaseY + Math.sin(angle) * ryInner + (random() - 0.5) * 0.7;
    const depth = 0.7 + 0.3 * Math.sin(angle);

    add(x, y, color, 1.35, (isWhiteAccent ? 0.85 : 0.65) * depth, 7, angle / (Math.PI * 2));
  }

  // 3. Outer boundary radar / compass ticks around the ring
  const rxOuter = 358;
  const ryOuter = 55;
  const tickCount = 64;
  for (let i = 0; i < tickCount; i++) {
    const angle = (i / tickCount) * Math.PI * 2;
    const isMajor = i % 4 === 0;
    const len = isMajor ? 8 : 3.5;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    for (let d = 0; d <= len; d += 1.4) {
      const x = cosA * (rxOuter + d);
      const y = ringBaseY + sinA * (ryOuter + d * (ryOuter / rxOuter));
      const color = isMajor ? CONFIG.orange : CONFIG.silver;
      add(x, y, color, isMajor ? 1.3 : 0.85, isMajor ? 0.75 : 0.38, 7, angle / (Math.PI * 2));
    }
  }

  // 4. Holographic stage floor glow & rising vertical emitter streams
  const floorDust = compact ? 350 : 750;
  for (let i = 0; i < floorDust; i++) {
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(random());
    const x = Math.cos(a) * r * rxMain * 0.95;
    const y = ringBaseY + Math.sin(a) * r * ryMain * 0.95;
    const dist = Math.hypot(x / rxMain, (y - ringBaseY) / ryMain);
    const warm = Math.max(0, 1 - dist * 1.6) * 0.75;
    const color = warm > 0.2 ? CONFIG.orange : CONFIG.silver;
    add(x, y, color, 0.75 + random() * 0.7, (0.16 + warm * 0.35) * (1 - dist * 0.45), 7, a / (Math.PI * 2));

    // Vertical hologram rays rising toward the torso
    if (i % 3 === 0) {
      const rise = 6 + random() * 40;
      const riseX = x * (1 - rise * 0.0025);
      const riseY = y - rise;
      const riseAlpha = (0.26 - rise * 0.004) * (0.6 + random() * 0.4);
      if (riseAlpha > 0.03) {
        add(riseX, riseY, i % 2 === 0 ? CONFIG.orange : CONFIG.white, 0.85 + random() * 0.6, riseAlpha, 7, a / (Math.PI * 2));
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aExtra', new THREE.Float32BufferAttribute(extras, 4));
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 4));

  if (compact) cachedAvatarCompact = geometry.clone();
  else cachedAvatarDesktop = geometry.clone();

  return geometry;
}
