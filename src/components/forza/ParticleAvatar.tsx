import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { W as PW, H as PH, B64 } from './pixels';

export interface ParticleAvatarRef {
  replay: () => void;
  reform: () => void;
  burst: () => void;
  snap: () => void;
  seek: (seconds: number) => void;
  getStats: () => {
    time: number;
    particles: number;
    backgroundParticles: number;
    width: number;
    height: number;
    frames: number;
  } | null;
}

export interface ParticleAvatarProps {
  paused?: boolean;
  mode?: 'auto' | 'listen' | 'speak';
  intensity?: number;
  audioLevel?: number;
  quality?: 'auto' | 'high' | 'balanced' | 'low' | string;
  background?: boolean;
  backgroundSpeed?: number;
  restartKey?: number;
  onError?: (err: string) => void;
  onFormed?: () => void;
  onStats?: (stats: { fps: number | null; tier: string; renderMs: number; particles?: number }) => void;
  className?: string;
}

const WORLD_W = 6.4;
const CELL = WORLD_W / PW;

const vert = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uPx;
uniform float uBurst;
uniform float uSize;
uniform float uGain;
uniform float uSpeech;
attribute vec3 aStart;
attribute vec3 color;
attribute float aSeed;
attribute float aLum;
varying vec3 vColor;
varying float vAlpha;

float ease(float t) {
  return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
}

void main() {
  float p = ease(clamp((uProgress - aSeed * 0.4) / 0.6, 0.0, 1.0));
  vec3 target = position;

  // Side landscape wave ripples:
  float side = smoothstep(1.3, 2.9, abs(target.x)) * step(-0.9, target.y) * step(target.y, 1.1);
  target.y += side * sin(target.x * 3.0 - uTime * 0.9) * 0.022;

  // Hair & crown mask:
  // Humanoid head region: abs(x) < 0.68; hair/crown is in upper head target.y between 0.50 and 1.70
  float inHeadX = smoothstep(0.68, 0.10, abs(target.x));
  float isHair = inHeadX * smoothstep(0.50, 0.88, target.y) * smoothstep(1.70, 1.35, target.y);

  // Micro idle vibration (hair is excluded so it stays 100% still at idle):
  target.xy += vec2(sin(uTime * 0.8 + aSeed * 91.0), cos(uTime * 0.7 + aSeed * 57.0)) * 0.0025 * (1.0 - isHair);

  // Hair & crown movement: Driven directly by real sound & noise amplitude (uSpeech)
  if (uSpeech > 0.001) {
    // Multi-harmonic audio frequency simulation responding dynamically to sound noise:
    float noiseFreq1 = sin(uTime * 12.0 + aSeed * 18.0 + target.x * 10.0);
    float noiseFreq2 = cos(uTime * 18.0 + aSeed * 36.0);
    float hairBob = sin(uTime * 6.5) * 0.5 + noiseFreq1 * 0.3 + noiseFreq2 * 0.2;
    float strandRipple = sin(uTime * 12.0 + target.x * 12.0 + aSeed * 22.0) * 0.3;
    
    // Direct audio level / noise amplitude:
    float audioKick = uSpeech;

    // Controlled, natural gentle up-and-down acoustic wave on hair (subtle, elegant, no extreme upward flinging):
    target.y += isHair * (hairBob + strandRipple) * audioKick * 0.016;

    // Subtle organic lateral resonance during speech:
    target.x += isHair * sin(uTime * 6.0 + target.y * 3.0 + aSeed * 16.0) * audioKick * 0.005;
  }

  vec3 pos = mix(aStart, target, p);
  pos += normalize(vec3(target.xy, 0.4) + 1e-4) * uBurst * (0.4 + aSeed * 2.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  float tw = 0.82 + 0.18 * sin(uTime * (1.5 + aSeed * 3.0) + aSeed * 120.0);
  gl_PointSize = max(1.0, uPx * uSize * (0.8 + aLum * 0.7));
  vColor = color * uGain * tw;
  vAlpha = mix(0.25, 1.0, p);
}
`;

const frag = /* glsl */ `
uniform float uSoft;
varying vec3 vColor;
varying float vAlpha;

void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = mix(1.0 - smoothstep(0.35, 0.5, r), pow(smoothstep(0.5, 0.0, r), 2.0), uSoft);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
}
`;

const emberVert = /* glsl */ `
uniform float uTime;
uniform float uPx;
attribute float aSeed;
varying float vA;

void main() {
  vec3 p = position;
  p.y = mod(p.y + uTime * (0.04 + aSeed * 0.1) + 2.2, 4.4) - 2.2;
  p.x += sin(uTime * 0.5 + aSeed * 30.0) * 0.06;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uPx * (0.012 + aSeed * aSeed * 0.03);
  vA = (0.5 + 0.5 * sin(uTime * 1.7 + aSeed * 50.0)) * smoothstep(2.2, 1.0, abs(p.y)) * 0.8;
}
`;

const emberFrag = /* glsl */ `
varying float vA;

void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = pow(smoothstep(0.5, 0.0, r), 1.6) * vA;
  gl_FragColor = vec4(vec3(1.0, 0.5, 0.15) * a, 1.0);
}
`;

function decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const d = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) d[i] = bin.charCodeAt(i);
  return d;
}

const toWorld = (x: number, y: number): [number, number] => [
  (x - PW / 2) * CELL,
  -(y - PH / 2) * CELL,
];

const vortex = (): [number, number, number] => {
  const a = Math.random() * 6.2831853;
  const r = 3 + Math.random() * 4;
  return [Math.cos(a) * r, (Math.random() - 0.5) * 5, Math.sin(a) * r - 1];
};

interface LayerArrays {
  pos: Float32Array;
  col: Float32Array;
  start: Float32Array;
  seed: Float32Array;
  lum: Float32Array;
  count: number;
}

interface CachedLayers {
  sharp: LayerArrays;
  glow: LayerArrays;
  totalCount: number;
}

let cachedLayers: CachedLayers | null = null;

function buildLayers(data: Uint8Array): CachedLayers {
  if (cachedLayers) return cachedLayers;

  const sharpPos: number[] = [];
  const sharpCol: number[] = [];
  const sharpStart: number[] = [];
  const sharpSeed: number[] = [];
  const sharpLum: number[] = [];

  for (let y = 0; y < PH; y++) {
    for (let x = 0; x < PW; x++) {
      const i = (y * PW + x) * 3;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const l = Math.max(r, g * 1.1, b);
      if (l < 0.06) continue;
      if (Math.random() > Math.pow(Math.min(1, l * 1.5), 1.6)) continue;

      const [wx, wy] = toWorld(x + (Math.random() - 0.5) * 0.3, y + (Math.random() - 0.5) * 0.3);
      sharpPos.push(wx, wy, l * 0.03);
      sharpCol.push(r, g, b);
      const v = vortex();
      sharpStart.push(v[0], v[1], v[2]);
      sharpSeed.push(Math.random());
      sharpLum.push(l);
    }
  }

  const glowPos: number[] = [];
  const glowCol: number[] = [];
  const glowStart: number[] = [];
  const glowSeed: number[] = [];
  const glowLum: number[] = [];
  const S = 4;

  for (let y = 0; y < PH; y += S) {
    for (let x = 0; x < PW; x += S) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let yy = 0; yy < S; yy++) {
        for (let xx = 0; xx < S; xx++) {
          const i = ((y + yy) * PW + x + xx) * 3;
          if (i >= data.length) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
      }
      r /= S * S * 255;
      g /= S * S * 255;
      b /= S * S * 255;
      const l = Math.max(r, g, b);
      if (l < 0.25) continue;

      const [wx, wy] = toWorld(x + S / 2, y + S / 2);
      glowPos.push(wx, wy, -0.02);
      glowCol.push(r, g * 0.85, b * 0.6);
      const v = vortex();
      glowStart.push(v[0], v[1], v[2]);
      glowSeed.push(Math.random());
      glowLum.push(l);
    }
  }

  cachedLayers = {
    sharp: {
      pos: new Float32Array(sharpPos),
      col: new Float32Array(sharpCol),
      start: new Float32Array(sharpStart),
      seed: new Float32Array(sharpSeed),
      lum: new Float32Array(sharpLum),
      count: sharpSeed.length,
    },
    glow: {
      pos: new Float32Array(glowPos),
      col: new Float32Array(glowCol),
      start: new Float32Array(glowStart),
      seed: new Float32Array(glowSeed),
      lum: new Float32Array(glowLum),
      count: glowSeed.length,
    },
    totalCount: sharpSeed.length + glowSeed.length,
  };

  return cachedLayers;
}

// Reduce GPU vertex count evenly across the picture on entry-level phones.
function sampleLayer(layer: LayerArrays, stride: number): LayerArrays {
  if (stride <= 1) return layer;
  const count = Math.ceil(layer.count / stride);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  const start = new Float32Array(count * 3), seed = new Float32Array(count), lum = new Float32Array(count);
  for (let target = 0; target < count; target++) {
    const source = target * stride;
    pos.set(layer.pos.subarray(source * 3, source * 3 + 3), target * 3);
    col.set(layer.col.subarray(source * 3, source * 3 + 3), target * 3);
    start.set(layer.start.subarray(source * 3, source * 3 + 3), target * 3);
    seed[target] = layer.seed[source];
    lum[target] = layer.lum[source];
  }
  return {pos, col, start, seed, lum, count};
}

function makePoints(
  L: LayerArrays,
  uniforms: Record<string, { value: any }>,
  size: number,
  gain: number,
  soft: number
) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(L.pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(L.col, 3));
  g.setAttribute('aStart', new THREE.BufferAttribute(L.start, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(L.seed, 1));
  g.setAttribute('aLum', new THREE.BufferAttribute(L.lum, 1));

  const m = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      ...uniforms,
      uSize: { value: size },
      uGain: { value: gain },
      uSoft: { value: soft },
    },
  });

  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return { pts, mat: m };
}

export const ParticleAvatar = forwardRef<ParticleAvatarRef, ParticleAvatarProps>(
  function ParticleAvatar(
    {
      paused = false,
      mode = 'auto',
      intensity = 1,
      audioLevel = 0,
      quality = 'auto',
      background = true,
      backgroundSpeed = 2,
      restartKey = 0,
      onError,
      onFormed,
      onStats,
      className = '',
    },
    ref
  ) {
    const mount = useRef<HTMLDivElement | null>(null);
    const api = useRef<{
      reform: () => void;
      burst: () => void;
      snap: () => void;
      seek: (s: number) => void;
      getStats: () => any;
    }>({
      reform: () => {},
      burst: () => {},
      snap: () => {},
      seek: () => {},
      getStats: () => null,
    });

    const props = useRef({ paused, mode, intensity, audioLevel, quality, background, backgroundSpeed, onError, onFormed, onStats });
    props.current = { paused, mode, intensity, audioLevel, quality, background, backgroundSpeed, onError, onFormed, onStats };

    useImperativeHandle(
      ref,
      () => ({
        replay() {
          api.current.reform();
        },
        reform() {
          api.current.reform();
        },
        burst() {
          api.current.burst();
        },
        snap() {
          api.current.snap();
        },
        seek(seconds: number) {
          api.current.seek(seconds);
        },
        getStats() {
          return api.current.getStats();
        },
      }),
      []
    );

    // Support restartKey
    const prevRestartKey = useRef(restartKey);
    useEffect(() => {
      if (restartKey !== prevRestartKey.current) {
        prevRestartKey.current = restartKey;
        api.current.reform();
      }
    }, [restartKey]);

    useEffect(() => {
      const el = mount.current;
      if (!el) return;

      const lowDetail = quality === 'low';
      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: false,
          preserveDrawingBuffer: !lowDetail,
          powerPreference: lowDetail ? 'low-power' : 'high-performance',
          depth: false,
          stencil: false,
        });
      } catch (e: any) {
        props.current.onError?.('برای اجرای موتور ذرات FORZA شتاب‌دهی WebGL فعال نیاز است.');
        // Missing WebGL must not prevent an accessible voice conversation.
        props.current.onFormed?.();
        return;
      }

      const pr = Math.min(window.devicePixelRatio || 1, lowDetail ? 1 : quality === 'high' ? 2 : 1.5);
      renderer.setPixelRatio(pr);
      renderer.setClearColor(0x080402, 1);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

      const shared = {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uPx: { value: 100 },
        uBurst: { value: 0 },
        uSpeech: { value: 0 },
      };

      const layers = buildLayers(decode(B64));
      const glowLayer = lowDetail ? sampleLayer(layers.glow, 3) : layers.glow;
      const sharpLayer = lowDetail ? sampleLayer(layers.sharp, 4) : layers.sharp;
      const { pts: glowPts, mat: glowMat } = makePoints(glowLayer, shared, CELL * 4 * 3.0, 0.1, 1);
      const { pts: sharpPts, mat: sharpMat } = makePoints(sharpLayer, shared, CELL * 0.75, 1.55, 0.7);
      scene.add(glowPts, sharpPts);

      // Embers floating layer
      const N = lowDetail ? 120 : 900;
      const ep = new Float32Array(N * 3);
      const es = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        ep[i * 3] = (Math.random() - 0.5) * 7;
        ep[i * 3 + 1] = (Math.random() - 0.5) * 4.4;
        ep[i * 3 + 2] = Math.random() * 0.6;
        es[i] = Math.random();
      }
      const eg = new THREE.BufferGeometry();
      eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
      eg.setAttribute('aSeed', new THREE.BufferAttribute(es, 1));
      const emberMat = new THREE.ShaderMaterial({
        vertexShader: emberVert,
        fragmentShader: emberFrag,
        uniforms: shared,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const emberPts = new THREE.Points(eg, emberMat);
      emberPts.frustumCulled = false;
      scene.add(emberPts);

      const worldH = (WORLD_W * PH) / PW;
      function resize() {
        if (!el) return;
        const w = el.clientWidth;
        const h = el.clientHeight;
        if (w === 0 || h === 0) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // Cover screen like original artwork
        const visH = Math.min(worldH, WORLD_W / camera.aspect);
        const dist = visH / 2 / Math.tan(THREE.MathUtils.degToRad(15));
        camera.position.set(0, 0, dist);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        shared.uPx.value = (h * pr) / visH;
      }
      window.addEventListener('resize', resize);
      resize();

      let burst = 0;
      let formationReported = false;
      let speechVal = 0;
      let last = performance.now();
      let t = 0;
      let raf = 0;
      let frameCount = 0;
      let lastFpsTime = performance.now();
      let lastFrameAt = 0;

      const loop = () => {
        const now = performance.now();
        // 24 fps is sufficient for decorative particles on weak devices.
        if (lowDetail && lastFrameAt && now - lastFrameAt < 1000 / 24) {
          raf = requestAnimationFrame(loop);
          return;
        }
        lastFrameAt = now;
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;

        if (!props.current.paused) {
          t += dt;
          shared.uTime.value = t;
          shared.uProgress.value = Math.min(1, shared.uProgress.value + dt / (lowDetail ? 1.5 : 4));
          // Notify only after the actual particle formation reaches 100%.
          if (!formationReported && shared.uProgress.value >= 1) {
            formationReported = true;
            props.current.onFormed?.();
          }
          burst *= Math.pow(0.05, dt);
          shared.uBurst.value = burst;

          // Vocal resonance & speech wave for hair movement directly proportional to audio level & noise
          const currentMode = props.current.mode;
          const currentIntensity = props.current.intensity || 1;
          const audioLvl = props.current.audioLevel !== undefined ? props.current.audioLevel : 0;

          let targetSpeech = 0;
          let targetGain = 1.55;
          if (currentMode === 'speak') {
            // When speaking, hair movement directly tracks audio sound & noise amplitude with natural responsiveness
            targetSpeech = Math.min(1.0, audioLvl * 1.0) * currentIntensity;
            targetGain = 1.6 + audioLvl * 0.45;
          } else {
            targetSpeech = 0;
            if (currentMode === 'listen') {
              targetGain = 1.5 * currentIntensity + Math.sin(t * 3.0) * 0.08;
            }
          }

          speechVal = THREE.MathUtils.lerp(speechVal, targetSpeech, 0.38);
          if (speechVal < 0.001) speechVal = 0;
          shared.uSpeech.value = speechVal;

          sharpMat.uniforms.uGain.value = THREE.MathUtils.lerp(
            sharpMat.uniforms.uGain.value,
            targetGain,
            0.15
          );
        }

        const renderStart = performance.now();
        renderer.render(scene, camera);
        const renderMs = performance.now() - renderStart;

        frameCount++;
        if (now - lastFpsTime >= 1000) {
          const fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
          frameCount = 0;
          lastFpsTime = now;
          props.current.onStats?.({
            fps,
            tier: lowDetail ? 'LOW' : 'ULTRA',
            renderMs: Math.round(renderMs * 10) / 10,
            particles: sharpLayer.count + glowLayer.count + N,
          });
        }

        raf = requestAnimationFrame(loop);
      };
      loop();

      api.current = {
        reform: () => {
          shared.uProgress.value = 0;
        },
        burst: () => {
          burst = 1.35;
        },
        snap: () => {
          try {
            const a = document.createElement('a');
            a.download = 'forza-ai-particles.png';
            a.href = renderer.domElement.toDataURL('image/png');
            a.click();
          } catch (e) {
            console.error('Snap download failed:', e);
          }
        },
        seek: (seconds: number) => {
          t = Math.max(0, seconds);
          shared.uTime.value = t;
        },
        getStats: () => ({
          time: t,
          particles: sharpLayer.count + glowLayer.count + N,
          backgroundParticles: N,
          width: el.clientWidth,
          height: el.clientHeight,
          frames: frameCount,
        }),
      };

      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        renderer.dispose();
        glowMat.dispose();
        sharpMat.dispose();
        emberMat.dispose();
        el.innerHTML = '';
      };
    }, [quality]);

    return (
      <div
        ref={mount}
        className={`avatar-surface absolute inset-0 w-full h-full overflow-hidden bg-[#080402] ${className}`}
        style={{ background: '#080402' }}
      />
    );
  }
);
