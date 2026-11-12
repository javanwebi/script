import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import type { CachedLayers, LayerArrays } from './particleLayers.shared';

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

interface ParticleLayerPayload {
  width: number;
  height: number;
  layers: CachedLayers | null;
  poster: ImageBitmap | null;
  posterPixels: Uint8ClampedArray | null;
}

let particleLayerPayloadPromise: Promise<ParticleLayerPayload> | null = null;
let particlePosterSource: CanvasImageSource | null = null;

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** The 1.68 MB source image and CPU particle construction never block React's main thread. */
function loadParticleLayerPayload(includeLayers = true): Promise<ParticleLayerPayload> {
  if (!particleLayerPayloadPromise) {
    particleLayerPayloadPromise = new Promise<ParticleLayerPayload>((resolve, reject) => {
      if (typeof Worker === 'undefined') {
        reject(new Error('module_worker_unavailable'));
        return;
      }
      let worker: Worker;
      try {
        worker = new Worker(new URL('./particleLayers.worker.ts', import.meta.url), {
          type: 'module',
          name: 'forza-particle-builder',
        });
      } catch (error) {
        reject(error);
        return;
      }
      const timeout = window.setTimeout(() => {
        worker.terminate();
        reject(new Error('particle_worker_timeout'));
      }, 20000);
      const finish = () => {
        window.clearTimeout(timeout);
        worker.terminate();
      };
      worker.onmessage = event => {
        finish();
        if (event.data?.type !== 'ready') {
          reject(new Error(event.data?.message || 'particle_worker_failed'));
          return;
        }
        resolve({
          width: event.data.width,
          height: event.data.height,
          layers: event.data.layers || null,
          poster: event.data.poster || null,
          posterPixels: event.data.posterPixels || null,
        });
      };
      worker.onerror = event => {
        event.preventDefault();
        finish();
        reject(new Error('particle_worker_load_failed'));
      };
      worker.postMessage({ type: 'build', includeLayers });
    }).catch(async () => {
      // Compatibility path for older browsers that cannot start module workers.
      // Only the static poster is built here; WebGL is not allowed to block the
      // main thread with a second full particle preprocessing pass.
      const [{ W, H, B64 }, shared] = await Promise.all([
        import('./pixels'),
        import('./particleLayers.shared'),
      ]);
      await new Promise<void>(resolve => window.setTimeout(resolve, 0));
      const pixels = decodeBase64(B64);
      return {
        width: W,
        height: H,
        layers: null,
        poster: null,
        posterPixels: shared.buildParticlePosterPixels(pixels),
      };
    });
  }
  return particleLayerPayloadPromise;
}

function resolveParticlePoster(payload: ParticleLayerPayload): CanvasImageSource | null {
  if (particlePosterSource) return particlePosterSource;
  if (payload.poster) {
    particlePosterSource = payload.poster;
    return particlePosterSource;
  }
  if (payload.posterPixels) {
    const canvas = document.createElement('canvas');
    canvas.width = payload.width;
    canvas.height = payload.height;
    const context = canvas.getContext('2d', { alpha: true });
    if (context) {
      const imageData = context.createImageData(payload.width, payload.height);
      imageData.data.set(payload.posterPixels);
      context.putImageData(imageData, 0, 0);
      particlePosterSource = canvas;
      payload.posterPixels = null;
      return particlePosterSource;
    }
  }
  return null;
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
      const currentMount = mount.current;
      if (!currentMount) return;
      const mountEl: HTMLDivElement = currentMount;
      let renderer: THREE.WebGLRenderer | null = null;
      let cancelled = false;
      let contextLost = false;
      let raf = 0;
      let fallbackRaf = 0;
      let fallbackCanvas: HTMLCanvasElement | null = null;
      let fallbackRender: (() => void) | null = null;
      let layerPayload: ParticleLayerPayload | null = null;
      let glowPts: THREE.Points | null = null;
      let sharpPts: THREE.Points | null = null;
      let glowMat: THREE.ShaderMaterial | null = null;
      let sharpMat: THREE.ShaderMaterial | null = null;
      let visibilityHandler: (() => void) | null = null;
      let contextLostHandler: ((event: Event) => void) | null = null;
      let contextRestoredHandler: (() => void) | null = null;
      let formationReady = false;
      let formationReported = false;
      let totalParticleCount = 0;
      let t = 0;
      let burst = 0;
      let speechVal = 0;
      let last = performance.now();
      let frameCount = 0;
      let lastFpsTime = performance.now();
      let lowFpsSamples = 0;
      let highFpsSamples = 0;
      let adaptiveScale = 1;
      let appliedQuality = props.current.quality === 'low' ? 'low' : 'balanced';

      // Every device receives the same particle coordinates and glow layer.
      // Only framebuffer resolution adapts; the humanoid/logo is never removed.
      const maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
      let pixelRatio = Math.max(0.65, maxPixelRatio * (appliedQuality === 'low' ? 0.82 : 1));
      const EMBER_COUNT = 720;
      const emberPositions = new Float32Array(EMBER_COUNT * 3);
      const emberSeeds = new Float32Array(EMBER_COUNT);
      for (let i = 0; i < EMBER_COUNT; i++) {
        emberPositions[i * 3] = (Math.random() - 0.5) * 7;
        emberPositions[i * 3 + 1] = (Math.random() - 0.5) * 4.4;
        emberPositions[i * 3 + 2] = Math.random() * 0.6;
        emberSeeds[i] = Math.random();
      }

      let fallbackStartedAt = 0;
      let fallbackTime = 0;
      let fallbackFrameCount = 0;
      const fallbackEmbers = Array.from({ length: 220 }, () => ({
        x: Math.random(),
        y: Math.random(),
        radius: 0.45 + Math.random() * 1.35,
        speed: 0.008 + Math.random() * 0.025,
        phase: Math.random() * Math.PI * 2,
      }));

      const reportFormed = () => {
        if (formationReported) return;
        formationReported = true;
        props.current.onFormed?.();
      };

      const stopCanvasFallback = () => {
        if (fallbackRaf) cancelAnimationFrame(fallbackRaf);
        fallbackRaf = 0;
        fallbackRender = null;
        fallbackCanvas?.remove();
        fallbackCanvas = null;
      };

      const startCanvasFallback = (source: CanvasImageSource | null, imageWidth: number, imageHeight: number) => {
        if (cancelled || fallbackCanvas) return;
        const canvas = document.createElement('canvas');
        canvas.className = 'forza-canvas-fallback';
        canvas.dataset.engine = 'canvas2d';
        canvas.setAttribute('aria-hidden', 'true');
        mountEl.appendChild(canvas);
        const context = canvas.getContext('2d', { alpha: true });
        if (!context) {
          canvas.remove();
          console.warn('[FORZA_PARTICLES] canvas_fallback_unavailable');
          reportFormed();
          return;
        }
        fallbackCanvas = canvas;
        fallbackStartedAt = performance.now();
        let fallbackLastFpsTime = fallbackStartedAt;
        let canvasWidth = 0;
        let canvasHeight = 0;
        let dpr = 1;
        let fallbackFrames = 0;
        let fallbackLast = fallbackStartedAt;

        const resizeFallback = () => {
          const width = Math.max(1, mountEl.clientWidth);
          const height = Math.max(1, mountEl.clientHeight);
          dpr = Math.min(window.devicePixelRatio || 1, 1.15);
          const targetWidth = Math.round(width * dpr);
          const targetHeight = Math.round(height * dpr);
          if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvasWidth = width;
            canvasHeight = height;
            context.setTransform(dpr, 0, 0, dpr, 0, 0);
          }
        };

        const renderFallback = () => {
          if (cancelled || !fallbackCanvas || document.hidden) {
            fallbackRaf = 0;
            return;
          }
          const now = performance.now();
          const dt = Math.min((now - fallbackLast) / 1000, 0.05);
          fallbackLast = now;
          if (!props.current.paused) fallbackTime += dt;
          resizeFallback();
          const width = canvasWidth || mountEl.clientWidth;
          const height = canvasHeight || mountEl.clientHeight;
          context.clearRect(0, 0, width, height);

          // Recreate the orange ambient dust from the original FORZA scene.
          context.save();
          context.globalCompositeOperation = 'lighter';
          for (const ember of fallbackEmbers) {
            const x = ((ember.x + Math.sin(fallbackTime * 0.35 + ember.phase) * 0.025) % 1) * width;
            const y = ((ember.y + fallbackTime * ember.speed * (props.current.backgroundSpeed || 1)) % 1) * height;
            const alpha = 0.18 + (0.5 + 0.5 * Math.sin(fallbackTime * 1.7 + ember.phase)) * 0.5;
            context.fillStyle = 'rgba(224,101,24,' + alpha.toFixed(3) + ')';
            context.beginPath();
            context.arc(x, y, ember.radius, 0, Math.PI * 2);
            context.fill();
          }
          context.restore();

          const rawProgress = Math.min(1, (now - fallbackStartedAt) / 2800);
          const progress = rawProgress < 0.5
            ? 4 * rawProgress * rawProgress * rawProgress
            : 1 - Math.pow(-2 * rawProgress + 2, 3) / 2;
          if (source && imageWidth > 0 && imageHeight > 0) {
            const drawWidth = width;
            const drawHeight = drawWidth * imageHeight / imageWidth;
            const pulse = 1 + Math.min(1, props.current.audioLevel || 0) * 0.006;
            const dw = drawWidth * pulse;
            const dh = drawHeight * pulse;
            const x = (width - dw) / 2;
            const y = (height - dh) / 2;
            context.save();
            context.globalCompositeOperation = 'lighter';
            context.filter = 'blur(22px)';
            context.globalAlpha = 0.32 * progress;
            context.drawImage(source, x, y, dw, dh);
            context.filter = 'blur(4px)';
            context.globalAlpha = 0.46 * progress;
            context.drawImage(source, x, y, dw, dh);
            context.filter = 'none';
            context.globalAlpha = progress;
            context.drawImage(source, x, y, dw, dh);
            context.restore();
          } else {
            // The CSS particle field remains visible if even the poster source
            // is unavailable; this is deliberately not surfaced as a user error.
            context.save();
            context.strokeStyle = 'rgba(224,101,24,' + (0.12 + progress * 0.28) + ')';
            context.lineWidth = 1;
            context.beginPath();
            context.ellipse(width / 2, height / 2, Math.min(width, height) * 0.2, Math.min(width, height) * 0.32, 0, 0, Math.PI * 2);
            context.stroke();
            context.restore();
          }

          if (rawProgress >= 1) reportFormed();
          fallbackFrames++;
          fallbackFrameCount++;
          if (now - fallbackLastFpsTime >= 1000) {
            const fps = Math.round(fallbackFrames * 1000 / (now - fallbackLastFpsTime));
            fallbackFrames = 0;
            fallbackLastFpsTime = now;
            props.current.onStats?.({
              fps,
              tier: 'CANVAS',
              renderMs: Math.round((performance.now() - now) * 10) / 10,
              particles: totalParticleCount,
            });
          }
          fallbackRaf = requestAnimationFrame(renderFallback);
        };

        fallbackRender = renderFallback;
        api.current = {
          reform: () => { fallbackStartedAt = performance.now(); formationReported = false; },
          burst: () => { fallbackStartedAt = Math.min(fallbackStartedAt, performance.now() - 1800); },
          snap: () => {
            try {
              const link = document.createElement('a');
              link.download = 'forza-ai-particles.png';
              link.href = canvas.toDataURL('image/png');
              link.click();
            } catch {}
          },
          seek: (seconds: number) => { fallbackTime = Math.max(0, seconds); },
          getStats: () => ({
            time: fallbackTime,
            particles: totalParticleCount,
            backgroundParticles: EMBER_COUNT,
            width: mountEl.clientWidth,
            height: mountEl.clientHeight,
            frames: fallbackFrameCount,
          }),
        };
        if (!document.hidden) fallbackRaf = requestAnimationFrame(renderFallback);
      };

      const activateFallback = async () => {
        try {
          const payload = layerPayload || await loadParticleLayerPayload(Boolean(renderer));
          if (cancelled) return;
          layerPayload = payload;
          const poster = resolveParticlePoster(payload);
          startCanvasFallback(poster, payload.width, payload.height);
        } catch (error) {
          // Keep the stage alive and let the existing CSS particle field remain
          // visible; never turn a temporary graphics issue into a red call error.
          console.warn('[FORZA_PARTICLES] poster_recovery_deferred', error instanceof Error ? error.name : 'load_error');
          if (!formationReported) reportFormed();
        }
      };

      let worldH = WORLD_W;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      const shared = {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uPx: { value: 100 },
        uBurst: { value: 0 },
        uSpeech: { value: 0 },
      };
      const emberGeometry = new THREE.BufferGeometry();
      emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
      emberGeometry.setAttribute('aSeed', new THREE.BufferAttribute(emberSeeds, 1));
      const emberMaterial = new THREE.ShaderMaterial({
        vertexShader: emberVert,
        fragmentShader: emberFrag,
        uniforms: shared,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const emberPoints = new THREE.Points(emberGeometry, emberMaterial);
      emberPoints.frustumCulled = false;
      scene.add(emberPoints);

      const resize = () => {
        if (!renderer) return;
        const width = mountEl.clientWidth;
        const height = mountEl.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        const visibleHeight = Math.min(worldH, WORLD_W / camera.aspect);
        const distance = visibleHeight / 2 / Math.tan(THREE.MathUtils.degToRad(15));
        camera.position.set(0, 0, distance);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        shared.uPx.value = (height * pixelRatio) / visibleHeight;
      };

      try {
        renderer = new THREE.WebGLRenderer({
          antialias: false,
          alpha: true,
          preserveDrawingBuffer: false,
          powerPreference: 'high-performance',
          depth: false,
          stencil: false,
        });
      } catch {
        console.info('[FORZA_PARTICLES] webgl_unavailable_canvas_fallback=1');
      }

      if (!renderer) {
        void activateFallback();
      } else {
        renderer.setPixelRatio(pixelRatio);
        renderer.setClearColor(0x080402, 0);
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.background = 'transparent';
        renderer.domElement.dataset.engine = 'webgl';
        mountEl.appendChild(renderer.domElement);

        const applyPixelRatio = () => {
          if (!renderer) return;
          const baseScale = props.current.quality === 'low' ? 0.82 : 1;
          const nextRatio = Math.max(0.65, Math.min(maxPixelRatio, maxPixelRatio * baseScale * adaptiveScale));
          if (Math.abs(nextRatio - pixelRatio) < 0.025) return;
          pixelRatio = nextRatio;
          renderer.setPixelRatio(pixelRatio);
          resize();
        };

        const setWebglApi = () => {
          api.current = {
            reform: () => { shared.uProgress.value = 0; formationReported = false; },
            burst: () => { burst = 1.35; },
            snap: () => {
              try {
                const link = document.createElement('a');
                link.download = 'forza-ai-particles.png';
                link.href = renderer!.domElement.toDataURL('image/png');
                link.click();
              } catch {}
            },
            seek: (seconds: number) => { t = Math.max(0, seconds); shared.uTime.value = t; },
            getStats: () => ({
              time: t,
              particles: totalParticleCount,
              backgroundParticles: EMBER_COUNT,
              width: mountEl.clientWidth,
              height: mountEl.clientHeight,
              frames: frameCount,
            }),
          };
        };

        const loop = () => {
          if (!renderer || cancelled || contextLost || document.hidden) {
            raf = 0;
            return;
          }
          const now = performance.now();
          const dt = Math.min((now - last) / 1000, 0.05);
          last = now;
          if (props.current.quality !== appliedQuality) {
            appliedQuality = props.current.quality === 'low' ? 'low' : 'balanced';
            applyPixelRatio();
          }
          if (!props.current.paused) {
            t += dt;
            shared.uTime.value = t;
            if (formationReady) shared.uProgress.value = Math.min(1, shared.uProgress.value + dt / 2.8);
            if (formationReady && !formationReported && shared.uProgress.value >= 1) reportFormed();
            burst *= Math.pow(0.05, dt);
            shared.uBurst.value = burst;
            const currentMode = props.current.mode;
            const currentIntensity = props.current.intensity || 1;
            const audioLevel = props.current.audioLevel !== undefined ? props.current.audioLevel : 0;
            let targetSpeech = 0;
            let targetGain = 1.55;
            if (currentMode === 'speak') {
              targetSpeech = Math.min(1, audioLevel) * currentIntensity;
              targetGain = 1.6 + audioLevel * 0.45;
            } else if (currentMode === 'listen') {
              targetGain = 1.5 * currentIntensity + Math.sin(t * 3) * 0.08;
            }
            speechVal = THREE.MathUtils.lerp(speechVal, targetSpeech, 0.38);
            if (speechVal < 0.001) speechVal = 0;
            shared.uSpeech.value = speechVal;
            if (sharpMat) sharpMat.uniforms.uGain.value = THREE.MathUtils.lerp(sharpMat.uniforms.uGain.value, targetGain, 0.15);
          }
          const renderStart = performance.now();
          try {
            renderer.render(scene, camera);
          } catch (error) {
            console.warn('[FORZA_PARTICLES] render_recovery', error instanceof Error ? error.name : 'render_error');
            contextLost = true;
            if (raf) cancelAnimationFrame(raf);
            raf = 0;
            void activateFallback();
            return;
          }
          const renderMs = performance.now() - renderStart;
          frameCount++;
          if (now - lastFpsTime >= 1000) {
            const fps = Math.round(frameCount * 1000 / (now - lastFpsTime));
            frameCount = 0;
            lastFpsTime = now;
            if (fps < 42) {
              lowFpsSamples++;
              highFpsSamples = 0;
              if (lowFpsSamples >= 3 && adaptiveScale > 0.65) {
                adaptiveScale = Math.max(0.65, adaptiveScale * 0.86);
                lowFpsSamples = 0;
                applyPixelRatio();
              }
            } else if (fps >= 55) {
              highFpsSamples++;
              lowFpsSamples = 0;
              if (highFpsSamples >= 8 && adaptiveScale < 1) {
                adaptiveScale = Math.min(1, adaptiveScale + 0.05);
                highFpsSamples = 0;
                applyPixelRatio();
              }
            } else {
              lowFpsSamples = 0;
              highFpsSamples = 0;
            }
            props.current.onStats?.({
              fps,
              tier: adaptiveScale < 0.9 || appliedQuality === 'low' ? 'ADAPTIVE' : 'ULTRA',
              renderMs: Math.round(renderMs * 10) / 10,
              particles: totalParticleCount,
            });
          }
          raf = requestAnimationFrame(loop);
        };

        const handleContextLost = (event: Event) => {
          event.preventDefault();
          contextLost = true;
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
          void activateFallback();
        };
        const handleContextRestored = () => {
          if (cancelled || !renderer) return;
          contextLost = false;
          stopCanvasFallback();
          renderer.domElement.style.visibility = 'visible';
          renderer.resetState();
          resize();
          last = performance.now();
          if (!raf && !document.hidden) raf = requestAnimationFrame(loop);
          setWebglApi();
        };
          const handleVisibilityChange = () => {
          if (document.hidden) {
            if (raf) cancelAnimationFrame(raf);
            if (fallbackRaf) cancelAnimationFrame(fallbackRaf);
            raf = 0;
            fallbackRaf = 0;
            return;
          }
          last = performance.now();
          if (fallbackCanvas && fallbackRender && !fallbackRaf) fallbackRaf = requestAnimationFrame(fallbackRender);
          else if (!contextLost && !raf) raf = requestAnimationFrame(loop);
        };

        window.addEventListener('resize', resize);
        visibilityHandler = handleVisibilityChange;
        contextLostHandler = handleContextLost;
        contextRestoredHandler = handleContextRestored;
        document.addEventListener('visibilitychange', handleVisibilityChange);
        renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
        renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);
        setWebglApi();
        if (!document.hidden) loop();

        void loadParticleLayerPayload().then(payload => {
          if (cancelled) return;
          layerPayload = payload;
          const poster = resolveParticlePoster(payload);
          if (!payload.layers) {
            renderer!.domElement.style.visibility = 'hidden';
            if (raf) cancelAnimationFrame(raf);
            raf = 0;
            startCanvasFallback(poster, payload.width, payload.height);
            return;
          }
          const uniforms = shared as Record<string, { value: any }>;
          const glow = makePoints(payload.layers.glow, uniforms, (WORLD_W / payload.width) * 4 * 3, 0.1, 1);
          const sharp = makePoints(payload.layers.sharp, uniforms, (WORLD_W / payload.width) * 0.75, 1.55, 0.7);
          glowPts = glow.pts;
          glowMat = glow.mat;
          sharpPts = sharp.pts;
          sharpMat = sharp.mat;
          scene.add(glowPts, sharpPts);
          worldH = WORLD_W * payload.height / payload.width;
          totalParticleCount = payload.layers.totalCount + EMBER_COUNT;
          resize();
          formationReady = true;
          if (contextLost) startCanvasFallback(poster, payload.width, payload.height);
        }).catch(error => {
          console.warn('[FORZA_PARTICLES] layer_load_recovery', error instanceof Error ? error.name : 'load_error');
          void activateFallback();
        });
      }

      const handleFallbackVisibility = () => {
        if (document.hidden) {
          if (fallbackRaf) cancelAnimationFrame(fallbackRaf);
          fallbackRaf = 0;
        } else if (fallbackCanvas && fallbackRender && !fallbackRaf) {
          fallbackRaf = requestAnimationFrame(fallbackRender);
        }
      };
      if (!renderer) {
        visibilityHandler = handleFallbackVisibility;
        document.addEventListener('visibilitychange', handleFallbackVisibility);
      }

      return () => {
        cancelled = true;
        if (raf) cancelAnimationFrame(raf);
        if (fallbackRaf) cancelAnimationFrame(fallbackRaf);
        if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
        window.removeEventListener('resize', resize);
        if (renderer) {
          if (contextLostHandler) renderer.domElement.removeEventListener('webglcontextlost', contextLostHandler);
          if (contextRestoredHandler) renderer.domElement.removeEventListener('webglcontextrestored', contextRestoredHandler);
          renderer.dispose();
        }
        stopCanvasFallback();
        glowPts?.geometry.dispose();
        sharpPts?.geometry.dispose();
        emberGeometry.dispose();
        glowMat?.dispose();
        sharpMat?.dispose();
        emberMaterial.dispose();
        scene.clear();
        mountEl.innerHTML = '';
      };
    }, []);

    return (
      <div
        ref={mount}
        className={`avatar-surface absolute inset-0 w-full h-full overflow-hidden ${className}`}
      />
    );
  }
);
