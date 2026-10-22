import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Sparkles,
  Layers,
  ZoomIn,
  ZoomOut,
  Activity,
  Cpu,
  Radio,
  Volume2,
  Eye,
  Sliders,
  Maximize2,
} from 'lucide-react';
import { ParticleAvatar, ParticleAvatarRef } from './ParticleAvatar';
import { STORE_ASSETS } from '../../assets/images';

const aiCyborgImg = STORE_ASSETS.aiForzaCyborg;
const refineryBg = STORE_ASSETS.refineryDuskWide;

export type CharacterRenderMode = 'cinematic' | 'particles' | 'hybrid';
export type CharacterCameraZoom = 'portrait' | 'torso';
export type CharacterAiState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface AiHumanoidCharacterProps {
  status?: CharacterAiState;
  renderMode?: CharacterRenderMode;
  onRenderModeChange?: (mode: CharacterRenderMode) => void;
  cameraZoom?: CharacterCameraZoom;
  onCameraZoomChange?: (zoom: CharacterCameraZoom) => void;
  audioInputLevel?: number; // 0 to 1
  isPaused?: boolean;
  quality?: string;
  className?: string;
}

export const AiHumanoidCharacter: React.FC<AiHumanoidCharacterProps> = ({
  status = 'idle',
  renderMode = 'cinematic',
  onRenderModeChange,
  cameraZoom = 'torso',
  onCameraZoomChange,
  audioInputLevel = 0,
  isPaused = false,
  quality = 'high',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const particleRef = useRef<ParticleAvatarRef | null>(null);

  // 3D Mouse Parallax & Head Gaze Tracking
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [targetGaze, setTargetGaze] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const [scanPosition, setScanPosition] = useState(0);

  // Autonomous natural micro-movements
  useEffect(() => {
    let animId: number;
    const updateGaze = () => {
      setGaze(prev => ({
        x: prev.x + (targetGaze.x - prev.x) * 0.08,
        y: prev.y + (targetGaze.y - prev.y) * 0.08,
      }));
      animId = requestAnimationFrame(updateGaze);
    };
    animId = requestAnimationFrame(updateGaze);
    return () => cancelAnimationFrame(animId);
  }, [targetGaze]);

  // Natural blinking & micro ocular movements
  useEffect(() => {
    if (isPaused) return;
    const blinkInterval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 160);
    }, 4200 + Math.random() * 2500);

    return () => clearInterval(blinkInterval);
  }, [isPaused]);

  // Optical scanning animation during thinking
  useEffect(() => {
    if (status !== 'thinking') return;
    const interval = setInterval(() => {
      setScanPosition(p => (p >= 100 ? 0 : p + 4));
    }, 50);
    return () => clearInterval(interval);
  }, [status]);

  // Mouse / Pointer tracker for gaze
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPaused || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2; // -1 to 1
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setTargetGaze({
      x: Math.max(-1, Math.min(1, nx)),
      y: Math.max(-1, Math.min(1, ny)),
    });
  };

  const handlePointerLeave = () => {
    setTargetGaze({ x: 0, y: 0 });
  };

  // Intensity multiplier based on state
  const stateIntensity = useMemo(() => {
    switch (status) {
      case 'speaking':
        return 1.45 + audioInputLevel * 0.5;
      case 'listening':
        return 1.25;
      case 'thinking':
        return 1.1;
      default:
        return 0.85;
    }
  }, [status, audioInputLevel]);

  // Core colors
  const primaryColor = '#E06518';
  const secondaryColor = '#DEE2E5';

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`relative w-full h-full overflow-hidden select-none flex items-center justify-center bg-[#05080e] ${className}`}
      style={{ perspective: '1200px' }}
    >
      {/* =================================================================== */}
      {/* 1. CINEMATIC INDUSTRIAL BACKGROUND & VOLUMETRIC ATMOSPHERE          */}
      {/* =================================================================== */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Background Image: Industrial Refinery at twilight */}
        <img
          src={refineryBg}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center filter brightness-[0.38] contrast-[1.25] scale-105 transition-transform duration-1000 ease-out"
          style={{
            transform: `scale(1.04) translate3d(${-gaze.x * 12}px, ${-gaze.y * 8}px, 0)`,
          }}
        />

        {/* Ambient Warm Volumetric Gradient Flare */}
        <div
          className="absolute inset-0 mix-blend-screen opacity-50 transition-opacity duration-700"
          style={{
            background: `radial-gradient(ellipse 70% 60% at 50% 38%, rgba(224, 101, 24, ${
              status === 'speaking' ? '0.35' : status === 'listening' ? '0.22' : '0.15'
            }) 0%, rgba(13, 22, 38, 0.6) 60%, transparent 100%)`,
          }}
        />

        {/* Subtle Cyber Grid Matrix Horizon */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(224, 101, 24, 0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(222, 226, 229, 0.15) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            transform: 'perspective(600px) rotateX(60deg) translateY(240px)',
            transformOrigin: 'bottom center',
          }}
        />

        {/* Floating Ambient Embers & Micro-Particles */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[18%] left-[22%] w-1.5 h-1.5 rounded-full bg-[#E06518] shadow-[0_0_10px_#E06518] animate-pulse" />
          <div className="absolute top-[32%] right-[18%] w-1 h-1 rounded-full bg-[#FFA500] shadow-[0_0_8px_#FFA500] animate-ping" />
          <div className="absolute top-[54%] left-[12%] w-1.5 h-1.5 rounded-full bg-[#DEE2E5] shadow-[0_0_8px_#DEE2E5] opacity-60" />
          <div className="absolute top-[68%] right-[24%] w-1 h-1 rounded-full bg-[#E06518] shadow-[0_0_6px_#E06518] opacity-70" />
        </div>

        {/* Cinematic Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#05080e] via-transparent to-[#05080e]/80" />
        <div className="absolute inset-0 bg-radial from-transparent via-[#05080e]/40 to-[#05080e]/95" />
      </div>

      {/* =================================================================== */}
      {/* 2. THREE.JS 3D QUANTUM PARTICLE AVATAR (PARTICLES & HYBRID MODES)    */}
      {/* =================================================================== */}
      {(renderMode === 'particles' || renderMode === 'hybrid') && (
        <div
          className={`absolute inset-0 z-10 transition-opacity duration-700 pointer-events-none ${
            renderMode === 'hybrid' ? 'opacity-70 mix-blend-screen' : 'opacity-100'
          }`}
        >
          <ParticleAvatar
            ref={particleRef}
            paused={isPaused}
            mode={status === 'speaking' ? 'speak' : status === 'listening' ? 'listen' : 'auto'}
            intensity={stateIntensity}
            quality={quality}
            background={renderMode === 'particles'}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. CINEMATIC HYPER-REALISTIC CYBORG HUMAN CHARACTER (MAIN LAYER)     */}
      {/* =================================================================== */}
      {(renderMode === 'cinematic' || renderMode === 'hybrid') && (
        <div
          className="relative z-20 w-full h-full flex items-center justify-center transition-all duration-700 ease-out pointer-events-none"
          style={{
            transform: `
              scale(${cameraZoom === 'portrait' ? 1.48 : 1.05})
              translate3d(${gaze.x * 18}px, ${cameraZoom === 'portrait' ? gaze.y * 14 + 110 : gaze.y * 10}px, 0)
              rotateY(${gaze.x * 5.5}deg)
              rotateX(${-gaze.y * 3.5}deg)
            `,
            transformOrigin: cameraZoom === 'portrait' ? '50% 32%' : '50% 48%',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Main Container for the Humanoid Silhouette & Lighting */}
          <div className="relative h-[82vh] max-h-[1150px] aspect-[942/1670] flex items-center justify-center">
            {/* Soft Ambient Volumetric Backlight Rim behind the Head & Neck */}
            <div
              className="absolute top-[16%] left-1/2 -translate-x-1/2 w-64 h-72 rounded-full pointer-events-none transition-all duration-500"
              style={{
                background: `radial-gradient(circle, rgba(224, 101, 24, ${
                  status === 'speaking' ? '0.65' : status === 'listening' ? '0.45' : '0.3'
                }) 0%, rgba(255, 148, 54, 0.18) 50%, transparent 80%)`,
                filter: 'blur(32px)',
                transform: `scale(${status === 'speaking' ? 1.25 : 1})`,
              }}
            />

            {/* The Authentic High-Resolution AI FORZA Humanoid Cyborg Image */}
            <img
              src={aiCyborgImg}
              alt="AI FORZA Advanced Humanoid Character"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain object-bottom drop-shadow-[0_25px_65px_rgba(0,0,0,0.95)] select-none pointer-events-none"
              style={{
                filter: `drop-shadow(0 0 28px rgba(224, 101, 24, ${
                  status === 'speaking' ? '0.45' : '0.2'
                })) contrast(1.08) brightness(1.02)`,
              }}
            />

            {/* EYES MICRO-ANIMATION & CYBER-OPTIC LUMINESCENCE */}
            {/* Left Eye Optic Node */}
            <div
              className={`absolute top-[28.8%] left-[45.2%] w-3 h-2 rounded-full pointer-events-none transition-opacity duration-200 ${
                blink ? 'opacity-0' : 'opacity-100'
              }`}
              style={{
                background: `radial-gradient(circle, #FFFFFF 20%, #FFA500 60%, transparent 95%)`,
                filter: `drop-shadow(0 0 8px ${
                  status === 'listening' ? '#22d3ee' : '#E06518'
                }) drop-shadow(0 0 16px #E06518)`,
                transform: `translate3d(${gaze.x * 2.5}px, ${gaze.y * 1.5}px, 0)`,
              }}
            />

            {/* Right Eye Optic Node */}
            <div
              className={`absolute top-[28.8%] left-[54.8%] w-3 h-2 rounded-full pointer-events-none transition-opacity duration-200 ${
                blink ? 'opacity-0' : 'opacity-100'
              }`}
              style={{
                background: `radial-gradient(circle, #FFFFFF 20%, #FFA500 60%, transparent 95%)`,
                filter: `drop-shadow(0 0 8px ${
                  status === 'listening' ? '#22d3ee' : '#E06518'
                }) drop-shadow(0 0 16px #E06518)`,
                transform: `translate3d(${gaze.x * 2.5}px, ${gaze.y * 1.5}px, 0)`,
              }}
            />

            {/* Thinking / Neural Processing Optical Scanline across Brow */}
            {status === 'thinking' && (
              <div
                className="absolute top-[26.5%] left-[40%] right-[40%] h-[2px] pointer-events-none"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, #FFFFFF 30%, #E06518 70%, transparent)',
                  boxShadow: '0 0 12px #E06518, 0 0 20px #FFFFFF',
                  transform: `translateY(${Math.sin(scanPosition * 0.1) * 8}px)`,
                }}
              />
            )}

            {/* VOCAL NODE / LARYNX ACOUSTIC WAVES (WHEN SPEAKING) */}
            {status === 'speaking' && (
              <div className="absolute top-[43.5%] left-1/2 -translate-x-1/2 pointer-events-none flex items-center justify-center">
                {/* Concentric sound wave pulses */}
                <span className="absolute w-8 h-8 rounded-full border border-[#E06518]/70 animate-ping opacity-75" />
                <span className="absolute w-14 h-14 rounded-full border border-[#FFA500]/50 animate-ping opacity-50 [animation-delay:0.3s]" />
                <div
                  className="w-4 h-4 rounded-full bg-[#FFFFFF] shadow-[0_0_14px_#FFA500,0_0_28px_#E06518] animate-pulse"
                  style={{
                    transform: `scale(${1 + audioInputLevel * 0.8})`,
                  }}
                />
              </div>
            )}

            {/* LISTENING OPTICAL SENSOR PING (WHEN USER SPEAKS) */}
            {status === 'listening' && (
              <div className="absolute top-[34%] left-1/2 -translate-x-1/2 pointer-events-none flex items-center justify-center">
                <span className="absolute w-12 h-12 rounded-full border border-cyan-400/60 animate-ping opacity-60" />
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_#22d3ee,0_0_24px_#38bdf8] animate-pulse" />
              </div>
            )}

            {/* QUANTUM CHEST REACTOR (CORE EMITTER) */}
            <div className="absolute top-[64.5%] left-1/2 -translate-x-1/2 pointer-events-none flex items-center justify-center">
              {/* Rotating Outer HUD Coordinate Ring */}
              <div
                className="absolute w-24 h-24 rounded-full border border-dashed border-[#E06518]/60 animate-spin opacity-85"
                style={{ animationDuration: '24s' }}
              />

              {/* Pulsing Concentric Energy Shield */}
              <div
                className="absolute w-20 h-20 rounded-full border border-[#FFA500]/50 transition-all duration-300"
                style={{
                  transform: `scale(${
                    status === 'speaking' ? 1.25 + audioInputLevel * 0.3 : 1
                  })`,
                  borderColor: status === 'speaking' ? '#FFFFFF' : '#E06518',
                  boxShadow: `0 0 20px rgba(224, 101, 24, ${
                    status === 'speaking' ? 0.9 : 0.4
                  })`,
                }}
              />

              {/* Central Glowing Luminous Fusion Core */}
              <div
                className="w-8 h-8 rounded-full bg-white shadow-[0_0_24px_#E06518,0_0_50px_#FFA500] animate-pulse transition-transform duration-300"
                style={{
                  transform: `scale(${
                    status === 'speaking' ? 1.25 + audioInputLevel * 0.4 : 1
                  })`,
                }}
              />
            </div>

            {/* DYNAMIC SVG NEURAL ENERGY CONDUITS & CIRCUITRY */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 942 1670"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="humanoidCircuitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                  <stop offset="45%" stopColor="#FFA500" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#E06518" stopOpacity="0.3" />
                </linearGradient>
                <filter id="humanoidCircuitGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="blur1" />
                  <feGaussianBlur stdDeviation="12" result="blur2" />
                  <feMerge>
                    <feMergeNode in="blur2" />
                    <feMergeNode in="blur1" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Forehead to Temple Neural Fiber Paths */}
              <path
                d="M471 360 L471 420 M471 385 Q515 390 545 425 M471 385 Q427 390 397 425"
                stroke="url(#humanoidCircuitGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                filter="url(#humanoidCircuitGlow)"
                className="animate-pulse"
                opacity={status === 'thinking' ? '0.95' : '0.6'}
              />

              {/* Cheekbone & Jaw Micro-Circuits */}
              <path
                d="M380 520 Q395 580 435 630 M562 520 Q547 580 507 630"
                stroke="url(#humanoidCircuitGrad)"
                strokeWidth="2"
                strokeDasharray="6 4"
                filter="url(#humanoidCircuitGlow)"
                opacity={status === 'speaking' ? '0.9' : '0.5'}
              />

              {/* Larynx & Neck Energy Conduits leading to Chest Reactor */}
              <path
                d="M471 690 L471 830 M455 730 L455 850 M487 730 L487 850"
                stroke="url(#humanoidCircuitGrad)"
                strokeWidth="3"
                strokeDasharray="18 8"
                filter="url(#humanoidCircuitGlow)"
                className="animate-pulse"
                opacity={status === 'speaking' ? '1' : '0.65'}
              />

              {/* Clavicle & Shoulder Armor Energy Channels */}
              <path
                d="M350 890 Q410 870 471 875 Q532 870 592 890 M310 930 Q390 910 471 915 Q552 910 632 930"
                stroke="url(#humanoidCircuitGrad)"
                strokeWidth="2.2"
                filter="url(#humanoidCircuitGlow)"
                opacity="0.6"
              />
            </svg>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. REAL-TIME ACOUSTIC AUDIO SPECTRUM (ATTACHED TO CHARACTER BASE)    */}
      {/* =================================================================== */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-2"
        dir="rtl"
      >
        {/* Equalizer Frequency Bars */}
        <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-2xl">
          <Activity size={14} className="text-[#E06518] animate-pulse" />
          <div className="flex items-end gap-1 h-5 px-1">
            {[14, 22, 10, 28, 18, 32, 24, 16, 26, 12, 30, 20, 15, 27].map((baseHeight, idx) => {
              const dynamicHeight =
                status === 'speaking'
                  ? Math.min(24, Math.max(4, Math.round(baseHeight * (0.5 + audioInputLevel * 0.9))))
                  : status === 'listening'
                  ? Math.min(18, Math.max(3, Math.round((idx % 3 === 0 ? 16 : 8) * (0.6 + Math.sin(idx) * 0.4))))
                  : 4;

              return (
                <span
                  key={idx}
                  className="w-1 rounded-full transition-all duration-100 ease-out"
                  style={{
                    height: `${dynamicHeight}px`,
                    backgroundColor:
                      idx % 2 === 0 ? primaryColor : secondaryColor,
                    boxShadow:
                      status === 'speaking'
                        ? '0 0 8px rgba(224, 101, 24, 0.8)'
                        : 'none',
                  }}
                />
              );
            })}
          </div>
          <span className="text-[11px] font-mono text-[#dee2e5]/90 mr-1">
            {status === 'speaking'
              ? 'فرکانس صدا: فعال'
              : status === 'listening'
              ? 'دریافت صوت...'
              : status === 'thinking'
              ? 'تحلیل عصبی...'
              : 'آماده‌باش کامل'}
          </span>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 5. INTERACTIVE GRAPHIC CONTROLS & CAMERA DOCK                       */}
      {/* =================================================================== */}
      <div className="absolute top-5 right-6 z-40 flex items-center gap-2 pointer-events-auto">
        {/* Camera Zoom Switcher */}
        <button
          type="button"
          onClick={() =>
            onCameraZoomChange?.(cameraZoom === 'torso' ? 'portrait' : 'torso')
          }
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/75 hover:bg-black/90 border border-white/15 hover:border-[#E06518]/70 text-[#dee2e5] hover:text-white text-xs backdrop-blur-md transition-all shadow-lg active:scale-95 cursor-pointer"
          title="تغییر فاصله و بزرگ‌نمایی چهره"
        >
          {cameraZoom === 'torso' ? <ZoomIn size={13} /> : <ZoomOut size={13} />}
          <span className="font-medium text-[11px]">
            {cameraZoom === 'torso' ? 'کلوزآپ چهره' : 'نمای کامل'}
          </span>
        </button>

        {/* Render Mode Switcher: Cinematic / Particles / Hybrid */}
        <div className="flex items-center bg-black/75 p-1 rounded-full border border-white/15 backdrop-blur-md shadow-lg">
          <button
            type="button"
            onClick={() => onRenderModeChange?.('cinematic')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
              renderMode === 'cinematic'
                ? 'bg-[#E06518] text-white shadow-[0_0_12px_rgba(224,101,24,0.7)]'
                : 'text-[#dee2e5]/70 hover:text-white'
            }`}
            title="کاراکتر فوق‌العاده با گرافیک سینمایی هایپررئال"
          >
            سینمایی
          </button>
          <button
            type="button"
            onClick={() => onRenderModeChange?.('hybrid')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
              renderMode === 'hybrid'
                ? 'bg-[#E06518] text-white shadow-[0_0_12px_rgba(224,101,24,0.7)]'
                : 'text-[#dee2e5]/70 hover:text-white'
            }`}
            title="ترکیب سایبورگ سینمایی با ماتریکس ذرات هولوگرام"
          >
            هیبرید
          </button>
          <button
            type="button"
            onClick={() => onRenderModeChange?.('particles')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
              renderMode === 'particles'
                ? 'bg-[#E06518] text-white shadow-[0_0_12px_rgba(224,101,24,0.7)]'
                : 'text-[#dee2e5]/70 hover:text-white'
            }`}
            title="ماتریکس ذرات ۳ بعدی کوانتومی"
          >
            ذرات 3D
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiHumanoidCharacter;
