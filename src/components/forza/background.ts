import * as THREE from 'three';

/*
 * Background, built for looks first and cost second.
 *
 * 1. BAKED LAYER: ~200k particles (sky, stars, layered particle mountains, crests, gold veins)
 *    are rendered ONCE into a texture on mount/resize. Each frame draws a single textured quad.
 * 2. LIVE LAYER: a few thousand cheap particles: crest comets, drifting dust, HUD rings.
 * 3. COMPOSITE: the baked quad gets a fast light sweep and a soft vignette in one fragment pass.
 *
 * Coordinates match geometry: x centered, y measured downward (0 top, 800 bottom).
 */
export const BG_CONFIG = { seed: 4217, layers: 4, uMin: 120, uMax: 1180, defaultSpeed: 2 };
const HEAD_Y = 292;

function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Must stay identical to ridge() in GLSL below.
export function ridge(u: number, layer: number, side: number) {
  const ph = layer * 1.7 + (side > 0 ? 0 : 2.3);
  const rise = -135 * smooth(180, 950, u);
  const jag =
    -(62 - layer * 7) * Math.pow(1 - Math.abs(Math.sin(u * 0.0105 + ph)), 1.6) -
    26 * Math.pow(1 - Math.abs(Math.sin(u * 0.031 + ph * 2.1)), 2.0) -
    7 * Math.sin(u * 0.083 + ph * 3.0);
  return 430 + layer * 58 + rise + jag;
}

const RIDGE_GLSL = `
const float U_MIN=${BG_CONFIG.uMin.toFixed(1)};
const float U_SPAN=${(BG_CONFIG.uMax - BG_CONFIG.uMin).toFixed(1)};
float ridge(float u,float layer,float side){
  float ph=layer*1.7+(side>0.0?0.0:2.3);
  float rise=-135.0*smoothstep(180.0,950.0,u);
  float jag=-(62.0-layer*7.0)*pow(1.0-abs(sin(u*.0105+ph)),1.6)
            -26.0*pow(1.0-abs(sin(u*.031+ph*2.1)),2.0)
            -7.0*sin(u*.083+ph*3.0);
  return 430.0+layer*58.0+rise+jag;
}
float bodyMask(float x,float y){
  float hw=y<470.0?150.0:150.0+(y-470.0)*.9;
  return y<60.0?1.0:smoothstep(hw-10.0,hw+150.0,abs(x));
}`;

function bolt(
  random: () => number,
  a: [number, number],
  b: [number, number],
  rough: number,
  depth: number
): [number, number][] {
  let pts: [number, number][] = [a, b],
    amp = rough;
  for (let level = 0; level < depth; level++) {
    const next: [number, number][] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i],
        q = pts[i + 1];
      const dx = q[0] - p[0],
        dy = q[1] - p[1],
        len = Math.hypot(dx, dy) || 1;
      const off = (random() - 0.5) * 2 * amp;
      next.push([(p[0] + q[0]) / 2 - (dy / len) * off, (p[1] + q[1]) / 2 + (dx / len) * off], q);
    }
    pts = next;
    amp *= 0.52;
  }
  return pts;
}

function buildGeometry(attrs: { aBase: number[]; aColor: number[]; aExtra: number[]; aSeed?: number[] }) {
  const g = new THREE.BufferGeometry();
  const n = attrs.aBase.length / 4;
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  for (const [k, v] of Object.entries(attrs)) {
    if (v) {
      g.setAttribute(k, new THREE.Float32BufferAttribute(v, k === 'aColor' ? 3 : 4));
    }
  }
  return g;
}

let cachedBakedDesktop: THREE.BufferGeometry | null = null;
let cachedBakedCompact: THREE.BufferGeometry | null = null;
let cachedLiveDesktop: THREE.BufferGeometry | null = null;
let cachedLiveCompact: THREE.BufferGeometry | null = null;

/* ---------- 1. baked layer (static, rendered once) ---------- */
// aBase: u, depth, layer, side (side 0 = free world point: u=x, depth=y)   aExtra: size, alpha
export function makeBakedGeometry({ compact = false }: { compact?: boolean } = {}) {
  if (compact && cachedBakedCompact) return cachedBakedCompact.clone();
  if (!compact && cachedBakedDesktop) return cachedBakedDesktop.clone();

  const random = seeded(BG_CONFIG.seed);
  const aBase: number[] = [],
    aColor: number[] = [],
    aExtra: number[] = [];
  const add = (
    u: number,
    d: number,
    layer: number,
    side: number,
    color: number[],
    size: number,
    alpha: number
  ) => {
    aBase.push(u, d, layer, side);
    aColor.push(...color);
    aExtra.push(size, alpha, 0, 0);
  };
  const k = compact ? 0.45 : 1,
    spacing = compact ? 1.1 : 0.6;
  const { layers, uMin, uMax } = BG_CONFIG;

  // Visible stars covering the entire sky in White #ffffff, Orange #e06518, and Silver #dee2e5
  const starCount = Math.round((compact ? 2200 : 4500) * k);
  for (let i = 0; i < starCount; i++) {
    const x = -1150 + random() * 2300;
    const y = -140 + random() * 620;
    const colorRoll = random();
    const color =
      colorRoll < 0.65
        ? [1.0, 1.0, 1.0] // Pure White #ffffff
        : colorRoll < 0.85
        ? [0.878, 0.396, 0.094] // Vibrant Orange #e06518
        : [0.870, 0.886, 0.898]; // Platinum Silver #dee2e5

    const isLarge = random() < 0.22;
    const isMedium = random() < 0.6;
    const size = isLarge ? 2.5 + random() * 1.5 : isMedium ? 1.6 + random() * 0.8 : 1.05 + random() * 0.5;
    const alpha = isLarge ? 0.75 + random() * 0.25 : isMedium ? 0.5 + random() * 0.3 : 0.3 + random() * 0.25;

    add(x, y, 0, 0, color, size, alpha);
  }

  const stroke = (pts: [number, number][], layer: number, side: number, width: number, color: number[]) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [u0, d0] = pts[i],
        [u1, d1] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(u1 - u0, d1 - d0) / spacing));
      for (let j = 0; j < n; j++) {
        const f = j / n,
          u = u0 + (u1 - u0) * f,
          d = Math.max(1, d0 + (d1 - d0) * f);
        add(u, d, layer, side, color, 1.05 * width, 0.65);
        if (j % 3 === 0) add(u, d, layer, side, [0.878, 0.396, 0.094], 4.2 * width, 0.06);
      }
    }
  };

  for (const side of [-1, 1]) {
    for (let layer = 0; layer < layers; layer++) {
      const front = layer / (layers - 1);
      // Silver platinum #dee2e5 mountain base
      const tint = [0.870 * (0.35 + 0.65 * front), 0.886 * (0.35 + 0.65 * front), 0.898 * (0.4 + 0.6 * front)];
      // Mountain body: striated folds, dense near the crest, fading to the base.
      const target = Math.round((15000 + layer * 3000) * k);
      for (let placed = 0, guard = 0; placed < target && guard < target * 6; guard++) {
        const u = uMin + random() * (uMax - uMin);
        const d =
          random() < 0.85
            ? -Math.log(Math.max(0.001, random())) * (24 + layer * 12)
            : random() * 380;
        const fold = Math.pow(
          0.5 + 0.5 * Math.sin(u * 0.05 * side + d * 0.07 + Math.sin(u * 0.013 + layer) * 3.2),
          3
        );
        if (random() > 0.18 + 0.82 * fold) continue;
        const near = Math.exp(-d / 30),
          b = 0.18 + 0.82 * near;
        add(
          u,
          d,
          layer,
          side,
          [tint[0] + 0.12 * near, tint[1] * b + 0.15 * near, tint[2] * (0.5 + 0.5 * b)],
          0.55 + random() * 0.6 + near * 0.5,
          (0.13 + 0.4 * near + 0.14 * fold) * (0.45 + 0.55 * front) * (1 - smooth(140, 380, d))
        );
        placed++;
      }
      // Crest: Pure White #ffffff razor line + #e06518 glowing aura
      for (let i = 0; i < 3600 * k; i++) {
        const u = uMin + random() * (uMax - uMin);
        add(
          u,
          (random() - 0.5) * 1.8,
          layer,
          side,
          [1.0, 1.0, 1.0],
          1.0 + random() * 0.6,
          (0.35 + 0.35 * front) * (0.7 + random() * 0.3)
        );
        if (i % 5 === 0)
          add(u, 1 + random() * 4, layer, side, [0.878, 0.396, 0.094], 6 + random() * 4, 0.04 + 0.045 * front);
      }
      // Static veins in #e06518 Orange on front ranges
      if (layer > 0) {
        for (let v = 0; v < 2 + layer; v++) {
          const u0 = uMin + 80 + random() * (uMax - uMin - 160),
            dir = random() < 0.5 ? -1 : 1;
          const main = bolt(
            random,
            [u0, 4 + random() * 12],
            [u0 + dir * (150 + random() * 260), 40 + random() * 110],
            30,
            7
          );
          const orangeVein = [0.878, 0.396 + random() * 0.1, 0.094];
          stroke(main, layer, side, 1, orangeVein);
          for (let f = 0; f < 2 + Math.floor(random() * 3); f++) {
            const p = main[10 + Math.floor(random() * (main.length - 20))];
            const q: [number, number] = [
              p[0] + (random() < 0.5 ? -dir : dir) * (35 + random() * 100),
              p[1] + 18 + random() * 60,
            ];
            stroke(bolt(random, p, q, 14, 6), layer, side, 0.7, orangeVein);
          }
        }
      }
    }
  }
  const geometry = buildGeometry({ aBase, aColor, aExtra });
  if (compact) cachedBakedCompact = geometry.clone();
  else cachedBakedDesktop = geometry.clone();
  return geometry;
}

export const bakedVertex = /* glsl */ `
precision highp float;
attribute vec4 aBase; attribute vec3 aColor; attribute vec4 aExtra;
uniform float uScale;
varying vec3 vColor; varying float vAlpha;
${RIDGE_GLSL}
void main(){
  float x,y;
  if(abs(aBase.w)<.5){x=aBase.x;y=aBase.y;}
  else{x=aBase.w*aBase.x;y=ridge(aBase.x,aBase.z,aBase.w)+aBase.y;}
  vColor=aColor; vAlpha=aExtra.y*bodyMask(x,y);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(x,400.0-y,-2.0,1.0);
  gl_PointSize=max(.7,aExtra.x*uScale);
}`;

export const pointFragment = /* glsl */ `
precision highp float;
varying vec3 vColor; varying float vAlpha;
void main(){
  vec2 p = gl_PointCoord - vec2(0.5);
  float d2 = dot(p, p) * 4.0;
  if(d2 > 1.0) discard;
  float a = (1.0 - d2) * (1.0 - sqrt(d2) * 0.4) * vAlpha;
  gl_FragColor = vec4(vColor, a);
}`;

// Sky gradient + horizon aura, baked together with the particles (Gray transitioning to luminous White).
export const skyVertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;

export const skyFragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
void main(){
  // Coordinates centered on the AI avatar
  vec2 p = vUv - vec2(0.5, 0.42);
  
  // Radial atmospheric glow behind head and torso
  float headGlow = exp(-dot(p - vec2(0.0, 0.08), p - vec2(0.0, 0.08)) * 4.8);
  
  // Soft horizontal light across horizon
  float horizon = exp(-pow((p.y + 0.06) / 0.24, 2.0));

  // Deep space midnight palette matching reference screenshot
  vec3 topSky = vec3(0.012, 0.016, 0.028);
  vec3 horizonSky = vec3(0.022, 0.028, 0.045);
  vec3 warmRadiance = vec3(0.085, 0.042, 0.012);

  float yGrad = vUv.y;
  vec3 sky = mix(horizonSky, topSky, smoothstep(0.12, 0.88, yGrad));
  
  // Soft warm glow right behind the avatar
  sky += warmRadiance * (headGlow * 0.85 + horizon * 0.35);

  gl_FragColor = vec4(sky, 1.0);
}`;

/* ---------- 3. composite: baked texture + light sweep + vignette ---------- */
export const compositeFragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uBaked;
uniform float uBgTime;
void main(){
  vec3 c = texture2D(uBaked, vUv).rgb;
  float ax = abs(vUv.x - 0.5) * 2.0;
  float pos = fract(uBgTime * 0.22);
  float band = exp(-pow((ax - pos * 1.3 + 0.1) / 0.05, 2.0));
  float trail = exp(-pow((ax - pos * 1.3 + 0.18) / 0.16, 2.0)) * 0.25;
  
  // Light sweep shimmer across the mountain peaks
  c += (vec3(0.35, 0.45, 0.6) * (band * 0.45 + trail * 0.2)) * smoothstep(0.15, 0.35, ax);
  
  // Soft cosmic vignette towards borders
  float dist = length((vUv - 0.5) * vec2(1.15, 1.0));
  float vig = smoothstep(1.25, 0.35, dist);
  c *= mix(0.6, 1.0, vig);
  
  gl_FragColor = vec4(c, 1.0);
}`;

/* ---------- 2. live layer (cheap, animated) ---------- */
// kind: 0 crest comet, 1 dust, 2 HUD ring point
export function makeLiveGeometry({ compact = false }: { compact?: boolean } = {}) {
  if (compact && cachedLiveCompact) return cachedLiveCompact.clone();
  if (!compact && cachedLiveDesktop) return cachedLiveDesktop.clone();

  const random = seeded(BG_CONFIG.seed + 99);
  const aBase: number[] = [],
    aColor: number[] = [],
    aExtra: number[] = [],
    aSeed: number[] = [];
  const add = (
    b: number[],
    color: number[],
    size: number,
    alpha: number,
    kind: number,
    aux: number,
    seed?: number
  ) => {
    aBase.push(...b);
    aColor.push(...color);
    aExtra.push(size, alpha, kind, aux);
    aSeed.push(seed ?? random(), random(), random(), random());
  };
  for (const side of [-1, 1]) {
    for (let layer = 0; layer < 4; layer++) {
      for (let c = 0; c < (compact ? 1 : 2); c++) {
        const u0 = random() * 1000,
          cs = random();
        for (let tail = 0; tail < 22; tail++) {
          add([u0, 0, layer, side], [1.0, 1.0, 1.0], 2.6 - tail * 0.09, 1 - tail / 22, 0, tail, cs);
        }
      }
    }
  }
  for (let i = 0; i < (compact ? 300 : 700); i++) {
    const isOrg = random() < 0.25;
    add(
      [-600 + random() * 1200, 200 + random() * 600, 0, 0],
      isOrg ? [0.878, 0.396, 0.094] : [0.870, 0.886, 0.898],
      0.7 + random() * 1.4,
      0.12 + random() * 0.35,
      1,
      0
    );
  }

  // Stationary twinkling sky stars across the full sky (ستاره‌های چشمک‌زن در کل پهنه آسمان)
  const liveStarCount = compact ? 420 : 850;
  for (let i = 0; i < liveStarCount; i++) {
    const x = -1150 + random() * 2300;
    const y = -140 + random() * 620;
    const isOrange = random() < 0.22;
    const color = isOrange ? [0.878, 0.396, 0.094] : random() < 0.65 ? [1.0, 1.0, 1.0] : [0.870, 0.886, 0.898];
    const isBig = random() < 0.25;
    const size = isBig ? 2.6 + random() * 1.4 : 1.45 + random() * 0.75;
    const alpha = isBig ? 0.7 + random() * 0.3 : 0.4 + random() * 0.3;
    add([x, y, 0, 0], color, size, alpha, 3, 0, random());
  }

  // HUD: rings around the head. aBase = radius, angle, ring id, dashed flag
  const rings = [
    { r: 318, n: 1400, dash: 0, a: 0.22, s: 1.0 }, // thin full ring
    { r: 334, n: 180, dash: 1, a: 0.55, s: 1.3 }, // tick marks
    { r: 350, n: 900, dash: 2, a: 0.6, s: 1.5 }, // three bright arc segments
    { r: 366, n: 600, dash: 3, a: 0.3, s: 1.1 }, // dashed ring
  ];
  rings.forEach((ring, id) => {
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2;
      if (ring.dash === 2 && (a % ((Math.PI * 2) / 3)) > 1.25) continue;
      if (ring.dash === 3 && Math.floor(a / 0.05) % 2) continue;
      const len = ring.dash === 1 ? (i % 10 === 0 ? 12 : 5) : 0;
      for (let j = 0; j <= len; j += 1.2) {
        add(
          [ring.r + j, a, id, ring.dash],
          id === 2 ? [0.878, 0.396, 0.094] : [0.870, 0.886, 0.898],
          ring.s,
          ring.a,
          2,
          0
        );
      }
    }
  });
  const geometry = buildGeometry({ aBase, aColor, aExtra, aSeed });
  if (compact) cachedLiveCompact = geometry.clone();
  else cachedLiveDesktop = geometry.clone();
  return geometry;
}

export const liveVertex = /* glsl */ `
precision highp float;
attribute vec4 aBase; attribute vec3 aColor; attribute vec4 aExtra; attribute vec4 aSeed;
uniform float uBgTime; uniform float uScale; uniform float uActivity;
varying vec3 vColor; varying float vAlpha;
${RIDGE_GLSL}
void main(){
  float t=uBgTime, kind=aExtra.z, aux=aExtra.w, alpha=aExtra.y, size=aExtra.x;
  vec3 color=aColor; float x,y;
  if(kind<.5){
    float layer=aBase.z, side=aBase.w, dir=mod(layer,2.0)<.5?1.0:-1.0;
    float u=U_MIN+mod(aBase.x-dir*aux*4.0+dir*t*(180.0+aSeed.x*170.0),U_SPAN);
    x=side*u; y=ridge(u,layer,side);
    color=mix(vec3(.85,.98,1.0),vec3(.1,.55,1.0),aux/22.0);
    alpha*=(.5+.5*layer/3.0)*bodyMask(x,y);
  } else if(kind<1.5){
    float vy=18.0+aSeed.x*35.0, vx=(aSeed.y-.5)*20.0;
    y=mod(aBase.y-t*vy,800.0);
    x=-600.0+mod(aBase.x+600.0+t*vx,1200.0);
    alpha*=(.5+.5*sin(t*3.0+aSeed.w*50.0))*bodyMask(x,y);
  } else if(kind<2.5){
    float id=aBase.z, spin=id==0.0?.05:id==1.0?-.09:id==2.0?.28:-.14;
    float a=aBase.y+t*spin, r=aBase.x*(1.0+uActivity*.012);
    x=cos(a)*r; y=${HEAD_Y.toFixed(1)}+sin(a)*r;
    alpha*=(1.0-smoothstep(430.0,560.0,y))*(.8+.2*sin(t*3.0+id));
  } else {
    // Stationary gentle twinkling stars in the sky
    x=aBase.x;
    y=aBase.y;
    float twinkleSpeed=1.2+aSeed.x*2.2;
    float twinkle=sin(t*twinkleSpeed+aSeed.y*6.2831853);
    alpha*=clamp(0.4+0.6*twinkle,0.0,1.0)*bodyMask(x,y);
  }
  vColor=color; vAlpha=alpha;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(x,400.0-y,-1.5,1.0);
  gl_PointSize=max(.7,size*uScale);
}`;
