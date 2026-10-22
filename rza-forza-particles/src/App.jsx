/*
  Subject: the user's "RZA · FORZA" glowing AI avatar, rebuilt entirely from WebGL particles.
  v2: fidelity first. Flat, pixel-aligned particle field (800x525 sample, ~200k sparks) sized to
  the screen so it reads like the original; a second layer of large soft sparks fakes bloom.
  No cursor interaction. Motion: vortex assembly, ember twinkle, a slow ripple through the side waves.
  Color: straight from the image (ember #ff6a00, molten #ffb15a, ash #fff1e0, char #0a0604).
*/
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { W as PW, H as PH, B64 } from "./pixels.js";

const WORLD_W = 6.4;
const CELL = WORLD_W / PW;

const vert = /* glsl */ `
uniform float uTime; uniform float uProgress; uniform float uPx; uniform float uBurst; uniform float uSize; uniform float uGain;
attribute vec3 aStart; attribute vec3 color; attribute float aSeed; attribute float aLum;
varying vec3 vColor; varying float vAlpha;
float ease(float t){ return t<.5 ? 4.*t*t*t : 1.-pow(-2.*t+2.,3.)/2.; }
void main(){
  float p = ease(clamp((uProgress - aSeed*0.4)/0.6, 0., 1.));
  vec3 target = position;
  float side = smoothstep(1.3, 2.9, abs(target.x)) * step(-0.9, target.y) * step(target.y, 1.1);
  target.y += side * sin(target.x*3.0 - uTime*0.9) * 0.022;
  target.xy += vec2(sin(uTime*0.8+aSeed*91.), cos(uTime*0.7+aSeed*57.)) * 0.0025;
  vec3 pos = mix(aStart, target, p);
  pos += normalize(vec3(target.xy, 0.4) + 1e-4) * uBurst * (0.4 + aSeed*2.);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.);
  float tw = 0.82 + 0.18*sin(uTime*(1.5+aSeed*3.) + aSeed*120.);
  gl_PointSize = max(1.0, uPx * uSize * (0.8 + aLum*0.7));
  vColor = color * uGain * tw;
  vAlpha = mix(0.25, 1.0, p);
}`;
const frag = /* glsl */ `
uniform float uSoft;
varying vec3 vColor; varying float vAlpha;
void main(){
  float r = length(gl_PointCoord - .5);
  float a = mix(1.0 - smoothstep(.35,.5,r), pow(smoothstep(.5,0.,r),2.), uSoft);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
}`;

const emberVert = /* glsl */ `
uniform float uTime; uniform float uPx; attribute float aSeed; varying float vA;
void main(){
  vec3 p = position;
  p.y = mod(p.y + uTime*(0.04+aSeed*0.1) + 2.2, 4.4) - 2.2;
  p.x += sin(uTime*0.5 + aSeed*30.)*0.06;
  gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.);
  gl_PointSize = uPx * (0.012 + aSeed*aSeed*0.03);
  vA = (0.5+0.5*sin(uTime*1.7+aSeed*50.)) * smoothstep(2.2, 1.0, abs(p.y)) * 0.8;
}`;
const emberFrag = /* glsl */ `
varying float vA;
void main(){ float r = length(gl_PointCoord-.5); float a = pow(smoothstep(.5,0.,r),1.6)*vA;
  gl_FragColor = vec4(vec3(1., .5, .15)*a, 1.); }`;

function decode() {
  const bin = atob(B64), d = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) d[i] = bin.charCodeAt(i);
  return d;
}
const toWorld = (x, y) => [(x - PW / 2) * CELL, -(y - PH / 2) * CELL];
const vortex = () => { const a = Math.random() * 6.283, r = 3 + Math.random() * 4; return [Math.cos(a) * r, (Math.random() - .5) * 5, Math.sin(a) * r - 1]; };

function buildLayers(data) {
  // sharp layer: one spark per lit pixel (probabilistic for dim pixels)
  const sharp = { pos: [], col: [], start: [], seed: [], lum: [] };
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const i = (y * PW + x) * 3;
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const l = Math.max(r, g * 1.1, b);
    if (l < 0.06) continue;
    if (Math.random() > Math.pow(Math.min(1, l * 1.5), 1.6)) continue;
    const [wx, wy] = toWorld(x + (Math.random() - .5) * 0.3, y + (Math.random() - .5) * 0.3);
    sharp.pos.push(wx, wy, l * 0.03);
    sharp.col.push(r, g, b);
    sharp.start.push(...vortex()); sharp.seed.push(Math.random()); sharp.lum.push(l);
  }
  // glow layer: big soft sparks on bright regions = particle bloom
  const glow = { pos: [], col: [], start: [], seed: [], lum: [] };
  const S = 4;
  for (let y = 0; y < PH; y += S) for (let x = 0; x < PW; x += S) {
    let r = 0, g = 0, b = 0;
    for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) {
      const i = ((y + yy) * PW + x + xx) * 3; if (i >= data.length) continue;
      r += data[i]; g += data[i + 1]; b += data[i + 2];
    }
    r /= S * S * 255; g /= S * S * 255; b /= S * S * 255;
    const l = Math.max(r, g, b);
    if (l < 0.25) continue;
    const [wx, wy] = toWorld(x + S / 2, y + S / 2);
    glow.pos.push(wx, wy, -0.02);
    glow.col.push(r, g * 0.85, b * 0.6);
    glow.start.push(...vortex()); glow.seed.push(Math.random()); glow.lum.push(l);
  }
  return { sharp, glow };
}

function makePoints(L, uniforms, size, gain, soft) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(L.pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(L.col, 3));
  g.setAttribute("aStart", new THREE.Float32BufferAttribute(L.start, 3));
  g.setAttribute("aSeed", new THREE.Float32BufferAttribute(L.seed, 1));
  g.setAttribute("aLum", new THREE.Float32BufferAttribute(L.lum, 1));
  const m = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: { ...uniforms, uSize: { value: size }, uGain: { value: gain }, uSoft: { value: soft } },
  });
  return new THREE.Points(g, m);
}

export default function App() {
  const mount = useRef(null);
  const api = useRef({});
  const [count, setCount] = useState(0);

  useEffect(() => {
    const el = mount.current;
    const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    const pr = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pr);
    renderer.setClearColor(0x080402, 1);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

    const shared = { uTime: { value: 0 }, uProgress: { value: 0 }, uPx: { value: 100 }, uBurst: { value: 0 } };
    const { sharp, glow } = buildLayers(decode());
    const glowPts = makePoints(glow, shared, CELL * 4 * 3.0, 0.1, 1);
    const sharpPts = makePoints(sharp, shared, CELL * 0.75, 1.55, 0.7);
    scene.add(glowPts, sharpPts);
    setCount(sharp.seed.length + glow.seed.length);

    const N = 900, ep = new Float32Array(N * 3), es = new Float32Array(N);
    for (let i = 0; i < N; i++) { ep[i * 3] = (Math.random() - .5) * 7; ep[i * 3 + 1] = (Math.random() - .5) * 4.4; ep[i * 3 + 2] = Math.random() * 0.6; es[i] = Math.random(); }
    const eg = new THREE.BufferGeometry();
    eg.setAttribute("position", new THREE.BufferAttribute(ep, 3)); eg.setAttribute("aSeed", new THREE.BufferAttribute(es, 1));
    scene.add(new THREE.Points(eg, new THREE.ShaderMaterial({ vertexShader: emberVert, fragmentShader: emberFrag, uniforms: shared, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));

    const worldH = WORLD_W * PH / PW;
    function resize() {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h); camera.aspect = w / h;
      // cover the screen like the original image
      const visH = Math.min(worldH, WORLD_W / camera.aspect);
      const dist = visH / 2 / Math.tan(THREE.MathUtils.degToRad(15));
      camera.position.set(0, 0, dist); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
      shared.uPx.value = (h * pr) / visH; // device pixels per world unit
    }
    window.addEventListener("resize", resize); resize();

    let burst = 0, last = performance.now(), t = 0, raf;
    const loop = () => {
      const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now; t += dt;
      shared.uTime.value = t;
      shared.uProgress.value = Math.min(1, shared.uProgress.value + dt / 4);
      burst *= Math.pow(0.05, dt); shared.uBurst.value = burst;
      renderer.render(scene, camera); raf = requestAnimationFrame(loop);
    };
    loop();

    api.current = {
      reform: () => { shared.uProgress.value = 0; },
      burst: () => { burst = 1.3; },
      snap: () => { const a = document.createElement("a"); a.download = "rza-forza-particles.png"; a.href = renderer.domElement.toDataURL("image/png"); a.click(); },
    };
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); renderer.dispose(); el.innerHTML = ""; };
  }, []);

  const btn = "rounded-full border border-fire/40 bg-soot/60 px-5 py-2.5 text-[14px] text-molten backdrop-blur transition hover:border-ember hover:bg-fire/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ember";
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-char font-fa text-ash" dir="rtl">
      <div ref={mount} className="absolute inset-0" />
      <div className="pointer-events-none absolute right-6 top-5 font-display text-[14px] font-bold uppercase tracking-[0.4em] text-ember/80" dir="ltr">
        RZA · FORZA <span className="font-medium tracking-[0.2em] text-molten/50">/ {count ? count.toLocaleString("en") : "…"} particles</span>
      </div>
      <div className="absolute inset-x-0 bottom-4 flex flex-wrap items-center justify-center gap-3 px-4">
        <button className={btn} onClick={() => api.current.reform?.()}>ساخت دوباره</button>
        <button className={btn} onClick={() => api.current.burst?.()}>انفجار ذرات</button>
        <button className={btn} onClick={() => api.current.snap?.()}>دانلود PNG</button>
      </div>
    </main>
  );
}
