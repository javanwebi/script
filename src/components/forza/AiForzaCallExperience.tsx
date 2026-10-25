import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  PhoneOff,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Send,
  MessageSquare,
  Sparkles,
  Eye,
  Loader2,
} from 'lucide-react';
import { ParticleAvatar, ParticleAvatarRef } from './ParticleAvatar';
import { ForzaRealtimeClient } from './forzaRealtimeClient';
import { analyzePersianSentenceCompletion } from '../../utils/silenceDetector';
import './style.css';

interface AiForzaCallExperienceProps {
  onClose?: () => void;
}

type ForzaStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

const GREETING_TEXT = 'سلام، خوش آمدید به صنعت پیش. من فورزا، دستیار هوشمند فنی شما هستم. می‌توانم در شناسایی قطعات صنعتی، انتخاب تسمه و پولی، بررسی کد بلبرینگ و مشخصات فنی، پیدا کردن قطعه مناسب دستگاه‌ها و راهنمایی استعلام محصول کمک کنم. بفرمایید، چه کاری براتون انجام بدم؟';

const QUICK_TOPICS = [
  'محاسبه طول و گام تسمه تایمینگ PU',
  'بررسی کد یاتاقان و لقی استاندارد C3',
  'مشاوره استعلام قیمت قطعات انتقال قدرت',
  'انتخاب پولی چدنی متناسب با شفت الکتروموتور',
];

interface Turn {
  role: 'user' | 'model';
  text: string;
}

function getSupportedAudioMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/aac',
    'audio/wav',
  ];
  for (const t of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return 'audio/webm';
}

export const AiForzaCallExperience: React.FC<AiForzaCallExperienceProps> = ({ onClose }) => {
  // Visual scene & humanoid character states
  const avatarRef = useRef<ParticleAvatarRef | null>(null);
  const shell = useRef<HTMLDivElement | null>(null);

  const [paused, setPaused] = useState(false);
  const [revision, setRevision] = useState(0);
  const [speed, setSpeed] = useState<number>(2);
  const [clean, setClean] = useState(false);
  const [quality, setQuality] = useState('high');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [showTextInput, setShowTextInput] = useState<boolean>(false);
  const [customInput, setCustomInput] = useState<string>('');
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState<boolean>(false);
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null);
  const [isUserSpeaking, setIsUserSpeaking] = useState<boolean>(false);
  const [voiceMode, setVoiceMode] = useState<'pending' | 'connecting' | 'native' | 'legacy' | 'unavailable'>('pending');
  const realtimeRef = useRef<ForzaRealtimeClient | null>(null);

  const [stats, setStats] = useState<{ fps: number | null; tier: string; renderMs: number; particles?: number }>({
    fps: null,
    tier: 'ULTRA',
    renderMs: 0,
    particles: 0,
  });
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [fullscreenError, setFullscreenError] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);

  // Conversational AI state
  const [isCallActive, setIsCallActive] = useState(true);
  const [status, setStatusState] = useState<ForzaStatus>('idle');
  const [turn, setTurn] = useState<'user' | 'ai' | 'idle'>('ai');
  const [aiText, setAiText] = useState(GREETING_TEXT);
  const [displayedAi, setDisplayedAi] = useState('');
  const [userText, setUserText] = useState('');
  const [seconds, setSeconds] = useState(0);

  const statusRef = useRef<ForzaStatus>('idle');
  const historyRef = useRef<Turn[]>([]);
  const isAiSpeakingRef = useRef<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const isRecognitionActiveRef = useRef<boolean>(false);
  const isProcessingTurnRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<number | null>(null);
  const activeTranscriptRef = useRef<string>('');
  const webSpeechFailedRef = useRef<boolean>(false);

  // MediaRecorder audio capture refs (fallback & complementary for STT)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const hasSpeechSoundRef = useRef<boolean>(false);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const currentBufferSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animFrameAudioRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const setStatus = useCallback((s: ForzaStatus) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  // Explicit user click unlocks microphone and audio output.
  const startRealtime = useCallback(() => {
    realtimeRef.current?.stop();
    realtimeRef.current = null;
    setErrorNotice(null);
    setVoiceMode('connecting');
    const client = new ForzaRealtimeClient({
      onMode: mode => {
        setVoiceMode(mode);
        if (mode === 'native') {
          setStatus('listening');
          setTurn('user');
          setAiText(GREETING_TEXT);
        }
      },
      onStatus: next => {
        setStatus(next);
        setTurn(next === 'listening' ? 'user' : 'ai');
        if (next !== 'listening') setIsUserSpeaking(false);
      },
      onUserText: text => { setUserText(text); setIsUserSpeaking(true); },
      onAiText: text => { setAiText(text); },
      onLevel: value => setAudioLevel(value),
      onError: message => setErrorNotice(message),
    });
    realtimeRef.current = client;
    void client.start();
  }, [setStatus]);

  useEffect(() => {
    // Open the session immediately on page entry; no start-call button.
    // Browser microphone and speaker permissions are requested only by the
    // browser; if autoplay is disallowed, the UI offers an audio unlock.
    startRealtime();
    return () => {
      realtimeRef.current?.stop();
      realtimeRef.current = null;
    };
  }, [startRealtime]);

  // Start/Stop voice listening helpers
  const startListening = useCallback(() => {
    if (!isCallActive || isAiSpeakingRef.current || statusRef.current === 'thinking' || isProcessingTurnRef.current) {
      return;
    }

    setStatus('listening');
    setTurn('user');
    activeTranscriptRef.current = '';
    hasSpeechSoundRef.current = false;
    audioChunksRef.current = [];

    // 1. Restart browser SpeechRecognition if supported and unmuted
    if (!isMicMuted && recognitionRef.current && !isRecognitionActiveRef.current) {
      try {
        recognitionRef.current.start();
        isRecognitionActiveRef.current = true;
      } catch {
        // Recognition may already be starting or running
      }
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, [isCallActive, isMicMuted, setStatus]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isRecognitionActiveRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      isRecognitionActiveRef.current = false;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    setIsUserSpeaking(false);
  }, []);

  // Real-time audio noise/frequency monitoring & Voice Activity Detection (VAD)
  useEffect(() => {
    if (voiceMode !== 'legacy') return;
    let active = true;
    const dataArray = new Uint8Array(128);

    const checkLevel = () => {
      if (!active) return;
      let level = 0;

      if (status === 'speaking') {
        const time = Date.now();
        // Dynamic multi-frequency speech cadence matching Persian acoustic speech bursts
        const base = 0.65;
        const wave1 = Math.sin(time * 0.018) * 0.32;
        const wave2 = Math.cos(time * 0.029) * 0.18;
        const wave3 = Math.sin(time * 0.045) * 0.12;
        level = Math.min(1.25, Math.max(0.18, base + wave1 + wave2 + wave3));
      } else if (status === 'listening' && micAnalyserRef.current && !isMicMuted) {
        try {
          micAnalyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          level = Math.min(1, Math.max(0, avg / 110));

          // Intelligent Voice Activity Detection for user speech
          if (!isAiSpeakingRef.current && !isProcessingTurnRef.current && statusRef.current !== 'thinking') {
            const isSpeakingNow = level > 0.062;

            if (isSpeakingNow) {
              hasSpeechSoundRef.current = true;
              setIsUserSpeaking(true);

              // Begin recording audio chunks if MediaRecorder is idle
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
                audioChunksRef.current = [];
                try {
                  mediaRecorderRef.current.start(250);
                } catch {}
              }

              // Reset silence countdown while user continues to speak
              if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
              }
            } else if (hasSpeechSoundRef.current) {
              // Sound detected previously, now user paused
              if (!silenceTimerRef.current) {
                const currentText = activeTranscriptRef.current?.trim() || '';
                const analysis = analyzePersianSentenceCompletion(currentText);
                const pauseMs = analysis.recommendedPauseMs || 1350;

                silenceTimerRef.current = window.setTimeout(() => {
                  silenceTimerRef.current = null;
                  setIsUserSpeaking(false);

                  if (isProcessingTurnRef.current || isAiSpeakingRef.current || statusRef.current === 'thinking') {
                    return;
                  }

                  // 1. If WebSpeech captured words, dispatch immediately
                  const transcript = activeTranscriptRef.current?.trim();
                  if (transcript && transcript.length > 1) {
                    activeTranscriptRef.current = '';
                    hasSpeechSoundRef.current = false;
                    void handleUserFinishedSpeaking(transcript);
                    return;
                  }

                  // 2. Otherwise stop MediaRecorder; its onstop handler will dispatch the recorded audio to worker
                  if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    try {
                      mediaRecorderRef.current.stop();
                    } catch {}
                  }
                }, pauseMs);
              }
            }
          }
        } catch {
          level = 0;
        }
      } else {
        level = 0;
      }

      setAudioLevel(prev => {
        const lerpFactor = level > prev ? 0.45 : 0.22;
        return prev + (level - prev) * lerpFactor;
      });
      animFrameAudioRef.current = requestAnimationFrame(checkLevel);
    };

    animFrameAudioRef.current = requestAnimationFrame(checkLevel);

    return () => {
      active = false;
      if (animFrameAudioRef.current) cancelAnimationFrame(animFrameAudioRef.current);
    };
  }, [isMicMuted, status, voiceMode]);

  // Compute reactive mode for Three.js ParticleAvatar
  const avatarMode = status === 'speaking' ? 'speak' : status === 'listening' ? 'listen' : 'auto';
  const avatarIntensity = status === 'speaking' ? 1.45 : status === 'thinking' ? 0.6 : 1.0;

  // Reduced motion preference
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(motion.matches);
    update();
    motion.addEventListener('change', update);
    return () => motion.removeEventListener('change', update);
  }, []);

  // Keyboard shortcuts matching provided template
  useEffect(() => {
    function keyboard(e: KeyboardEvent) {
      if (/INPUT|SELECT|TEXTAREA|BUTTON/.test((e.target as HTMLElement).tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setPaused(p => !p);
      }
      if (e.key.toLowerCase() === 'h') setClean(c => !c);
      if (e.key.toLowerCase() === 'r') {
        setRevision(r => r + 1);
        avatarRef.current?.reform();
        setPaused(false);
      }
      if (e.key.toLowerCase() === 'b') {
        avatarRef.current?.burst();
      }
      if (e.key.toLowerCase() === 'p') {
        avatarRef.current?.snap();
      }
      if (e.key.toLowerCase() === 's') {
        setSpeed(s => (s === 1 ? 2 : s === 2 ? 3.5 : 1));
      }
    }
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, []);

  // Fullscreen toggle
  async function fullscreen() {
    try {
      setFullscreenError('');
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (shell.current?.requestFullscreen) {
        await shell.current.requestFullscreen();
      } else {
        setFullscreenError('حالت تمام‌صفحه در این مرورگر پشتیبانی نمی‌شود.');
      }
    } catch {
      setFullscreenError('امکان ورود به حالت تمام‌صفحه وجود ندارد.');
    }
  }

  // Typewriter effect for AI subtitle
  useEffect(() => {
    if (!aiText) {
      setDisplayedAi('');
      return;
    }
    if (voiceMode === 'native') {
      setDisplayedAi(aiText);
      return;
    }
    let i = 0;
    setDisplayedAi('');
    const id = window.setInterval(() => {
      i += 3;
      setDisplayedAi(aiText.slice(0, i));
      if (i >= aiText.length) window.clearInterval(id);
    }, 18);
    return () => window.clearInterval(id);
  }, [aiText, voiceMode]);

  // Call duration timer
  useEffect(() => {
    if (!isCallActive) return;
    const id = window.setInterval(() => setSeconds(s => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [isCallActive]);

  const ensureCtx = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) {
        ctxRef.current = new AC();
      }
    }
    if (ctxRef.current && ctxRef.current.state === 'suspended') {
      void ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const stopAudio = useCallback(() => {
    isAiSpeakingRef.current = false;
    try {
      if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    } catch {}

    const a = audioElRef.current;
    if (a) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {}
    }
  }, []);

  // Direct, crystal-clear HTML5 Audio playback for neural Persian voice
  const playDataUrl = useCallback(
    (url: string) =>
      new Promise<void>((resolve, reject) => {
        if (!url) {
          return resolve();
        }

        stopAudio();
        ensureCtx();

        let audio = audioElRef.current;
        if (!audio) {
          audio = new Audio();
          audioElRef.current = audio;
        }

        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1.0;
        audio.muted = isSpeakerMuted;

        let isCleanedUp = false;
        const cleanup = () => {
          if (isCleanedUp) return;
          isCleanedUp = true;
          audio?.removeEventListener('playing', onPlaying);
          audio?.removeEventListener('ended', onEnded);
          audio?.removeEventListener('error', onError);
        };

        const onPlaying = () => {
          isAiSpeakingRef.current = true;
          setStatus('speaking');
          setTurn('ai');
          setAutoplayBlocked(false);
          setPendingAudioUrl(null);
        };

        const onEnded = () => {
          cleanup();
          isAiSpeakingRef.current = false;
          setStatus('listening');
          setTurn('user');
          startListening();
          resolve();
        };

        const onError = (e: any) => {
          cleanup();
          isAiSpeakingRef.current = false;
          console.warn('[AI FORZA Audio] HTML5 Audio playback error:', e);
          startListening();
          reject(new Error('audio-playback-error'));
        };

        audio.addEventListener('playing', onPlaying);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);

        audio.src = url;
        audio.load();

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              isAiSpeakingRef.current = true;
              setStatus('speaking');
              setTurn('ai');
              setAutoplayBlocked(false);
              setPendingAudioUrl(null);
            })
            .catch(err => {
              console.warn('[AI FORZA Audio] Browser autoplay policy restricted audio:', err);
              cleanup();
              isAiSpeakingRef.current = false;
              setAutoplayBlocked(true);
              setPendingAudioUrl(url);
              startListening();
              reject(err);
            });
        }
      }),
    [ensureCtx, isSpeakerMuted, setStatus, startListening, stopAudio]
  );

  // User gesture unlock for browser autoplay permissions
  const unlockAudio = useCallback(() => {
    ensureCtx();
    const a = audioElRef.current;
    if (a) {
      a.muted = isSpeakerMuted;
      if (pendingAudioUrl) {
        const urlToPlay = pendingAudioUrl;
        setPendingAudioUrl(null);
        setAutoplayBlocked(false);
        void playDataUrl(urlToPlay).catch(() => {});
      }
    }
  }, [ensureCtx, isSpeakerMuted, pendingAudioUrl, playDataUrl]);

  const speakBrowserFallback = useCallback(
    (text: string) =>
      new Promise<void>(resolve => {
        try {
          if (!('speechSynthesis' in window)) {
            setStatus('listening');
            startListening();
            return resolve();
          }
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'fa-IR';
          u.rate = 0.95;

          const voices = window.speechSynthesis.getVoices();
          const faVoice =
            voices.find(v => v.lang.startsWith('fa') || v.lang.includes('IR')) ||
            voices.find(v => v.lang.startsWith('ar')) ||
            voices[0];
          if (faVoice) u.voice = faVoice;

          activeUtteranceRef.current = u;

          u.onstart = () => {
            isAiSpeakingRef.current = true;
            setStatus('speaking');
            setTurn('ai');
          };
          u.onend = () => {
            activeUtteranceRef.current = null;
            setTimeout(() => {
              isAiSpeakingRef.current = false;
              setStatus('listening');
              setTurn('user');
              startListening();
              resolve();
            }, 30);
          };
          u.onerror = () => {
            activeUtteranceRef.current = null;
            isAiSpeakingRef.current = false;
            setStatus('listening');
            setTurn('user');
            startListening();
            resolve();
          };
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
          }
          window.speechSynthesis.speak(u);
        } catch {
          activeUtteranceRef.current = null;
          isAiSpeakingRef.current = false;
          setStatus('idle');
          startListening();
          resolve();
        }
      }),
    [setStatus, startListening]
  );

  const speakText = useCallback(
    async (text: string) => {
      try {
        const res = await fetch('/api/ai/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        const data = await res.json().catch(() => null);
        if (data?.audioBase64) {
          await playDataUrl(data.audioBase64);
          return;
        }
        throw new Error('no-audio');
      } catch {
        await speakBrowserFallback(text);
      } finally {
        isAiSpeakingRef.current = false;
      }
    },
    [playDataUrl, speakBrowserFallback]
  );

  // Turn management: send speech/query to AI & worker
  const handleUserFinishedSpeaking = useCallback(
    async (textToSend?: string, audioBlob?: Blob, audioMime?: string) => {
      const q = (textToSend || '').trim();
      if (!q && !audioBlob) return;
      if (isAiSpeakingRef.current || statusRef.current === 'thinking' || isProcessingTurnRef.current) return;

      isProcessingTurnRef.current = true;
      stopListening();
      unlockAudio();
      setStatus('thinking');
      setTurn('ai');
      activeTranscriptRef.current = '';

      if (q) {
        setUserText(q);
      } else {
        setUserText('در حال تبدیل صدای شما به متن و استعلام از ورکر...');
      }

      try {
        const payload: any = {
          history: historyRef.current.slice(-8),
        };

        if (q) {
          payload.query = q;
        }

        if (audioBlob) {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
          });
          reader.readAsDataURL(audioBlob);
          const audioBase64 = await base64Promise;
          payload.audioBase64 = audioBase64;
          payload.audioMimeType = audioMime || audioBlob.type || 'audio/webm';
        }

        const res = await fetch('/api/ai/forza-live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) throw new Error(data?.error || 'server-error');

        const resolvedUserQuery = (data.userTranscript || q || '').trim();
        if (resolvedUserQuery) {
          setUserText(resolvedUserQuery);
          historyRef.current.push({ role: 'user', text: resolvedUserQuery });
        }

        const reply = data.text || '';
        if (reply) {
          historyRef.current.push({ role: 'model', text: reply });
          setAiText(reply);

          if (data.audioBase64) {
            setStatus('speaking');
            setTurn('ai');
            try {
              await playDataUrl(data.audioBase64);
            } catch (playErr) {
              console.warn('[AI FORZA] Direct audio play failed, falling back:', playErr);
              if (!autoplayBlocked) {
                await speakText(reply);
              }
            }
          } else {
            await speakText(reply);
          }
        }
      } catch (err: any) {
        console.warn('[AI FORZA] Error during conversational turn:', err);
        setErrorNotice('خطا در تبدیل صدا یا پاسخ هوش مصنوعی فورزا؛ لطفاً مجدداً بفرمایید.');
      } finally {
        isProcessingTurnRef.current = false;
        setStatus('listening');
        setTurn('user');
        startListening();
      }
    },
    [autoplayBlocked, playDataUrl, setStatus, speakText, startListening, stopListening, unlockAudio]
  );

  // Setup MediaRecorder for robust audio capture and fallback STT
  const setupMediaRecorder = useCallback(
    (stream: MediaStream) => {
      try {
        const mimeType = getSupportedAudioMimeType();
        const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

        mr.ondataavailable = (e: BlobEvent) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mr.onstop = () => {
          const chunks = [...audioChunksRef.current];
          audioChunksRef.current = [];
          const hadSpeech = hasSpeechSoundRef.current;
          hasSpeechSoundRef.current = false;

          if (isProcessingTurnRef.current || isAiSpeakingRef.current || statusRef.current === 'thinking') {
            return;
          }

          // 1. If Web Speech API already transcribed text, prefer text
          const currentTranscript = activeTranscriptRef.current?.trim();
          if (currentTranscript && currentTranscript.length > 0) {
            activeTranscriptRef.current = '';
            void handleUserFinishedSpeaking(currentTranscript);
            return;
          }

          // 2. Otherwise convert recorded audio Blob and send to /api/ai/forza-live
          if (chunks.length > 0 && hadSpeech) {
            const finalMime = mr.mimeType || mimeType || 'audio/webm';
            const audioBlob = new Blob(chunks, { type: finalMime });
            if (audioBlob.size > 1200) {
              void handleUserFinishedSpeaking('', audioBlob, finalMime);
            }
          }
        };

        mediaRecorderRef.current = mr;
      } catch (mrErr) {
        console.warn('[AI FORZA] MediaRecorder initialization warning:', mrErr);
      }
    },
    [handleUserFinishedSpeaking]
  );

  const initSpeechRecognition = useCallback(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return null;

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'fa-IR';

      rec.onstart = () => {
        isRecognitionActiveRef.current = true;
      };

      rec.onresult = (event: any) => {
        if (isAiSpeakingRef.current || statusRef.current === 'thinking' || isProcessingTurnRef.current) return;

        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const trans = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) {
            final += trans;
          } else {
            interim += trans;
          }
        }

        const currentSpeech = (final || interim || '').trim();
        if (currentSpeech) {
          hasSpeechSoundRef.current = true;
          activeTranscriptRef.current = currentSpeech;
          setUserText(currentSpeech);
          setStatus('listening');
          setTurn('user');
          setIsUserSpeaking(true);

          const analysis = analyzePersianSentenceCompletion(currentSpeech);
          const pauseMs = analysis.recommendedPauseMs || 1250;

          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = window.setTimeout(() => {
            if (activeTranscriptRef.current && !isAiSpeakingRef.current && !isProcessingTurnRef.current) {
              const textToSend = activeTranscriptRef.current;
              activeTranscriptRef.current = '';
              hasSpeechSoundRef.current = false;
              setIsUserSpeaking(false);
              void handleUserFinishedSpeaking(textToSend);
            }
          }, pauseMs);
        }
      };

      rec.onerror = (e: any) => {
        const error = e?.error;
        console.warn('[AI FORZA SpeechRecognition] Status:', error);
        if (error === 'network') {
          webSpeechFailedRef.current = true;
        }
      };

      rec.onend = () => {
        isRecognitionActiveRef.current = false;
        // Auto-restart recognition if call is still active and listening
        if (isCallActive && !isAiSpeakingRef.current && statusRef.current !== 'thinking' && !isProcessingTurnRef.current && !isMicMuted) {
          window.setTimeout(() => {
            if (isCallActive && !isAiSpeakingRef.current && statusRef.current !== 'thinking' && !isProcessingTurnRef.current && !isMicMuted) {
              try {
                rec.start();
                isRecognitionActiveRef.current = true;
              } catch {}
            }
          }, 200);
        }
      };

      return rec;
    } catch {
      return null;
    }
  }, [handleUserFinishedSpeaking, isCallActive, isMicMuted, setStatus]);

  // Initial startup: greeting & mic setup (non-blocking for instant 0ms entry)
  useEffect(() => {
    if (voiceMode !== 'legacy') return;
    let mounted = true;

    // Start in calm idle state - hair stays completely still until speech actually plays!
    setStatus('idle');
    setTurn('idle');
    historyRef.current.push({ role: 'model', text: GREETING_TEXT });
    setDisplayedAi(GREETING_TEXT);

    // Non-blocking greeting speech & mic init
    const timer = setTimeout(() => {
      if (!mounted) return;
      void speakText(GREETING_TEXT)
        .then(() => {
          if (!mounted) return;
          setStatus('listening');
          setTurn('user');
          startListening();
        })
        .catch(() => {
          if (!mounted) return;
          setStatus('listening');
          setTurn('user');
          startListening();
        });

      try {
        if (navigator?.mediaDevices?.getUserMedia) {
          navigator.mediaDevices
            .getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            })
            .then(stream => {
              if (mounted) {
                streamRef.current = stream;
                try {
                  const ctx = ensureCtx();
                  if (ctx) {
                    const micSource = ctx.createMediaStreamSource(stream);
                    const micAnalyser = ctx.createAnalyser();
                    micAnalyser.fftSize = 256;
                    micAnalyser.smoothingTimeConstant = 0.6;
                    micSource.connect(micAnalyser);
                    micAnalyserRef.current = micAnalyser;
                    micSourceNodeRef.current = micSource;
                  }
                } catch {
                  /* ignore mic audio node error */
                }

                // Initialize both MediaRecorder and SpeechRecognition
                setupMediaRecorder(stream);
                const rec = initSpeechRecognition();
                recognitionRef.current = rec;
                if (rec && !isMicMuted) {
                  try {
                    rec.start();
                    isRecognitionActiveRef.current = true;
                  } catch {}
                }
              }
            })
            .catch(() => {
              if (mounted) {
                const rec = initSpeechRecognition();
                recognitionRef.current = rec;
                if (rec && !isMicMuted) {
                  try {
                    rec.start();
                    isRecognitionActiveRef.current = true;
                  } catch {}
                }
              }
            });
        } else {
          const rec = initSpeechRecognition();
          recognitionRef.current = rec;
          if (rec && !isMicMuted) {
            try {
              rec.start();
              isRecognitionActiveRef.current = true;
            } catch {}
          }
        }
      } catch {
        const rec = initSpeechRecognition();
        recognitionRef.current = rec;
        if (rec && !isMicMuted) {
          try {
            rec.start();
            isRecognitionActiveRef.current = true;
          } catch {}
        }
      }
    }, 40);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      stopListening();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      stopAudio();
    };
  }, [voiceMode]);

  const endCall = useCallback(() => {
    realtimeRef.current?.stop();
    realtimeRef.current = null;
    stopAudio();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* noop */
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setIsCallActive(false);
    if (onClose) onClose();
  }, [onClose, stopAudio]);

  const submitUserText = (text: string) => {
    if (voiceMode === 'native') {
      realtimeRef.current?.sendText(text);
      return;
    }
    if (voiceMode === 'legacy') void handleUserFinishedSpeaking(text);
  };

  const toFarsiDigits = (n: number | string) => {
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return n.toString().replace(/[0-9]/g, w => farsiDigits[+w]);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, '0');
    const r = (s % 60).toString().padStart(2, '0');
    return toFarsiDigits(`${m}:${r}`);
  };

  return (
    <main
      ref={shell}
      className="forza-stage"
      dir="ltr"
      onClick={() => {
        if (autoplayBlocked) {
          unlockAudio();
        }
      }}
      onDoubleClick={e => {
        if ((e.target as HTMLElement).tagName === 'CANVAS') setClean(c => !c);
      }}
    >
      {(voiceMode === 'pending' || voiceMode === 'connecting') && (
        <div dir="rtl" role="status"
          className="absolute top-20 left-1/2 -translate-x-1/2 z-40 rounded-xl border border-white/20 bg-black/75 px-4 py-2 text-xs text-white">
          در حال برقراری اتصال فورزا...
        </div>
      )}
      {voiceMode === 'unavailable' && (
        <div dir="rtl" role="status"
          className="absolute top-20 left-1/2 -translate-x-1/2 z-40 rounded-xl border border-red-500/50 bg-black/80 px-4 py-2 text-xs text-white">
          اتصال صوتی برقرار نشد. برای تلاش مجدد صفحه را تازه‌سازی کنید.
        </div>
      )}
      {/* 1. Permanent Holographic Particle Mesh Avatar Engine */}
      <ParticleAvatar
        ref={avatarRef}
        paused={paused}
        mode={status === 'speaking' ? 'speak' : status === 'listening' ? 'listen' : 'auto'}
        intensity={status === 'speaking' ? 1.4 : status === 'listening' ? 1.15 : 1}
        audioLevel={audioLevel}
        quality={quality}
        background={true}
        onStats={s => setStats(prev => ({ ...prev, ...s }))}
      />

      {/* Hidden HTML5 audio element for direct, crystal-clear Persian TTS streaming */}
      <audio ref={audioElRef} className="hidden" playsInline preload="auto" />

      {/* 2. HUD Cybernetic Overlay (toggleable with H or signal button) */}
      {!clean && (
        <div className="forza-hud" aria-hidden="true">
          <i className="hud-corner tl" />
          <i className="hud-corner tr" />
          <i className="hud-corner bl" />
          <i className="hud-corner br" />

          {/* Top-Right FORZA Lockup & Audio Spectrum */}
          <div className="hud-block hud-top-right">
            <div className="flex items-center gap-3 justify-end">
              <div>
                <div className="hud-title text-white tracking-widest text-base font-black">- FORZA</div>
                <div className="hud-dim text-[10px] tracking-wider text-[#dee2e5]/80">
                  HUMAN SYSTEMS / 001 · {stats.particles ? `${stats.particles.toLocaleString('en')} PARTICLES` : '200K+ PARTICLES'}
                </div>
              </div>
              <div className="bars h-4">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>

          {/* Top-Left Telemetry Status directly under exit button */}
          <div className="hud-block hud-top-left">
            <div className="hud-dim text-[10px] tabular-nums text-[#dee2e5]/70 tracking-wider font-mono">
              {stats.tier} · {stats.fps ? `${stats.fps} FPS` : '60 FPS'} · {formatTime(seconds)}
            </div>
          </div>

          {/* Left Brand Procedural Identity Label */}
          <div className="procedural-label">
            <span>PROCEDURAL IDENTITY</span>
            <strong>Built from<br />light</strong>
          </div>

          {/* Bottom-Left Metric: Sync % & Realtime status */}
          <div className="hud-block hud-bottom-left">
            <div className="text-[11px] text-[#dee2e5] font-mono">
              SYNC <b className="text-white">۹۹.۴%</b>
            </div>
            <div className="hud-dim text-[10px] text-[#dee2e5]/70 font-mono tracking-wider">
              PARTICLE MESH · REALTIME GPU
            </div>
          </div>

          {/* Subtle light scan line */}
          <div className="scan" />
        </div>
      )}

      {/* Top Header Exit Call Button */}
      <button
        type="button"
        onClick={endCall}
        className="absolute top-5 left-6 z-40 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-950/80 hover:bg-red-900 border border-red-500/60 hover:border-red-400 text-white shadow-xl shadow-black/60 backdrop-blur-md transition-all active:scale-95 group cursor-pointer"
        aria-label="پایان مکالمه و خروج"
        title="پایان مکالمه هوشمند FORZA"
        dir="rtl"
      >
        <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center text-white group-hover:bg-red-500 transition-colors">
          <PhoneOff size={11} className="text-white" />
        </div>
        <span className="font-bold text-xs tracking-wide">خروج</span>
      </button>

      {/* Quick Question Chips (Bottom-Left on Desktop / Mid on Mobile) */}
      {!clean && (
        <div
          dir="rtl"
          className="absolute bottom-24 sm:bottom-12 left-6 sm:left-8 z-30 max-w-sm hidden sm:flex flex-col gap-2 pointer-events-auto"
        >
          <div className="flex items-center gap-1.5 text-[11px] text-[#dee2e5]/70 font-semibold tracking-wide">
            <Sparkles size={12} className="text-[#E06518]" />
            <span>پرسش‌های پیشنهادی از هوش مصنوعی فورزا:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TOPICS.map((topic, i) => (
              <button
                key={i}
                type="button"
                onClick={() => submitUserText(topic)}
                disabled={status === 'thinking'}
                className="text-[11px] text-right px-3 py-1.5 rounded-lg bg-black/70 hover:bg-[#E06518]/25 border border-white/10 hover:border-[#E06518]/60 text-[#dee2e5] hover:text-white backdrop-blur-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top Center Signal / HUD Toggle */}
      <button
        className="signal-toggle"
        onClick={() => setClean(c => !c)}
        aria-label={clean ? 'نمایش HUD' : 'مخفی‌سازی HUD'}
        title="تغییر نمایش HUD و جزئیات (کلید H)"
      >
        <span />
        <span />
        <span />
        <span />
      </button>

      {/* 2.5 Bottom Center Particle Interactive Controls (from rza-forza-particles) */}
      {!clean && (
        <div
          dir="rtl"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center gap-2 sm:gap-3 pointer-events-auto"
        >
          <button
            type="button"
            onClick={() => avatarRef.current?.reform()}
            className="rounded-full border border-[#ff6a00]/40 bg-[#1a0d06]/80 hover:border-[#ff8a2a] hover:bg-[#ff6a00]/25 text-[#ffd9b0] hover:text-white px-3.5 sm:px-4 py-1.5 text-[11px] sm:text-[13px] font-medium backdrop-blur-md transition-all active:scale-95 shadow-lg shadow-black/60 cursor-pointer"
            title="ساخت دوباره گرداب ذرات (کلید R)"
          >
            ساخت دوباره
          </button>
          <button
            type="button"
            onClick={() => avatarRef.current?.burst()}
            className="rounded-full border border-[#ff6a00]/40 bg-[#1a0d06]/80 hover:border-[#ff8a2a] hover:bg-[#ff6a00]/25 text-[#ffd9b0] hover:text-white px-3.5 sm:px-4 py-1.5 text-[11px] sm:text-[13px] font-medium backdrop-blur-md transition-all active:scale-95 shadow-lg shadow-black/60 cursor-pointer"
            title="انفجار موج شوک ذرات (کلید B)"
          >
            انفجار ذرات
          </button>
          <button
            type="button"
            onClick={() => avatarRef.current?.snap()}
            className="rounded-full border border-[#ff6a00]/40 bg-[#1a0d06]/80 hover:border-[#ff8a2a] hover:bg-[#ff6a00]/25 text-[#ffd9b0] hover:text-white px-3.5 sm:px-4 py-1.5 text-[11px] sm:text-[13px] font-medium backdrop-blur-md transition-all active:scale-95 shadow-lg shadow-black/60 cursor-pointer"
            title="دانلود عکس خروجی ذرات PNG (کلید P)"
          >
            دانلود PNG
          </button>
        </div>
      )}

      {/* 3. Persian Voice Subtitles & Interaction Pill matching screenshot layout */}
      <div
        dir="rtl"
        className="absolute bottom-10 right-4 sm:right-10 max-w-xs sm:max-w-md z-30 flex flex-col gap-2.5 pointer-events-none"
      >
        {/* Turn Status Pill & Mic / Speaker Controls */}
        <div className="self-end inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/85 border border-white/20 backdrop-blur-md shadow-lg text-xs pointer-events-auto transition-all">
          <span className="font-medium text-white text-[11px] sm:text-[12px]">
            {turn === 'user'
              ? (voiceMode === 'native' ? 'فورزا گوش می‌دهد؛ صحبتتان را کامل کنید' : 'نوبت شماست (مستقیم صحبت کنید)')
              : status === 'thinking'
              ? 'AI FORZA در حال پردازش...'
              : 'AI FORZA در حال صحبت...'}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              turn === 'user'
                ? 'bg-white shadow-[0_0_8px_#ffffff]'
                : status === 'thinking'
                ? 'bg-[#e06518] shadow-[0_0_8px_#e06518] animate-pulse'
                : 'bg-[#e06518] shadow-[0_0_8px_#e06518]'
            }`}
          />
          <button
            type="button"
            onClick={() => {
              setIsSpeakerMuted(prev => {
                const next = !prev;
                if (audioElRef.current) audioElRef.current.muted = next;
                realtimeRef.current?.setSpeakerMuted(next);
                return next;
              });
            }}
            className={`mr-1 p-1 rounded-md transition-colors cursor-pointer ${
              isSpeakerMuted ? 'text-red-400 hover:bg-red-500/20' : 'text-[#dee2e5]/70 hover:text-white hover:bg-white/10'
            }`}
            title={isSpeakerMuted ? 'خروج از حالت بی‌صدا' : 'بی‌صدا کردن صدای گوینده'}
          >
            {isSpeakerMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setIsMicMuted(prev => {
              const next = !prev;
              realtimeRef.current?.setMicMuted(next);
              return next;
            })}
            className={`p-1 rounded-md cursor-pointer ${isMicMuted ? 'text-red-400' : 'text-[#dee2e5]/70 hover:text-white'}`}
            title={isMicMuted ? 'روشن کردن میکروفون' : 'بی‌صدا کردن میکروفون'}>
            {isMicMuted ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setShowTextInput(!showTextInput)}
            className="p-1 rounded-md text-[#dee2e5]/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="تایپ پیام متنی"
          >
            <MessageSquare size={13} />
          </button>
        </div>

        {/* Browser Autoplay Unblock Badge */}
        {autoplayBlocked && (
          <button
            type="button"
            onClick={unlockAudio}
            className="pointer-events-auto self-end flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#e06518] hover:bg-[#c95210] text-white text-xs sm:text-sm font-bold shadow-xl shadow-[#e06518]/30 animate-pulse border border-white/20 cursor-pointer transition-all active:scale-95"
            title="فعال‌سازی پخش صدا در مرورگر"
          >
            <Volume2 size={16} />
            <span>🔊 برای شنیدن صدای هوش مصنوعی فورزا اینجا کلیک کنید</span>
          </button>
        )}

        {/* Text Input Drawer (for typing without microphone) */}
        {showTextInput && (
          <form
            onSubmit={e => {
              e.preventDefault();
              if (customInput.trim()) {
                const text = customInput.trim();
                setCustomInput('');
                setShowTextInput(false);
                submitUserText(text);
              }
            }}
            className="flex items-center gap-2 p-1.5 rounded-xl bg-black/90 border border-[#E06518]/60 backdrop-blur-md shadow-2xl pointer-events-auto animate-fadeInCard"
          >
            <input
              type="text"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              placeholder="سؤال فنی خود را تایپ کنید..."
              className="flex-1 bg-transparent px-3 py-1.5 text-xs text-white placeholder-white/40 outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={!customInput.trim()}
              className="p-2 rounded-lg bg-[#E06518] hover:bg-[#C95210] disabled:opacity-40 text-white transition-all cursor-pointer"
              title="ارسال به هوش مصنوعی"
            >
              <Send size={13} />
            </button>
          </form>
        )}

        {/* User live speech transcript */}
        {userText && (
          <div className="text-xs sm:text-sm bg-black/85 border border-[#dee2e5]/40 text-[#dee2e5] px-3.5 py-2 rounded-xl backdrop-blur-md shadow-md animate-fadeInCard pointer-events-auto leading-relaxed">
            <span className="text-white font-bold ml-2">شما:</span>
            <span>{userText}</span>
          </div>
        )}

        {/* AI voice response subtitle box matching screenshot */}
        {displayedAi && (
          <div className="text-xs sm:text-sm bg-[#080d18]/95 border border-[#e06518]/50 text-white p-3.5 sm:p-4 rounded-xl backdrop-blur-md shadow-2xl pointer-events-auto leading-relaxed border-t-2 border-t-[#e06518] animate-fadeInCard">
            <div className="text-[11px] font-bold text-[#e06518] mb-1.5 tracking-wider flex items-center justify-end gap-1.5" dir="rtl">
              <span>: AI FORZA</span>
              <Volume2 size={13} className="text-[#e06518]" />
            </div>
            <p className="text-[12px] sm:text-[13px] text-[#dee2e5] leading-relaxed font-normal">{displayedAi}</p>
          </div>
        )}

        {/* Small cyan audio spectrum bars at bottom corner */}
        <div className="bars h-3.5 self-end pl-1">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      {/* Restore button when HUD hidden */}
      {clean && (
        <button
          className="absolute bottom-5 right-5 z-40 p-2.5 rounded-xl bg-[#0a0d14]/80 border border-[#dee2e5]/30 text-[#dee2e5] hover:text-white hover:bg-white/10 transition-all shadow-xl"
          onClick={() => setClean(false)}
          aria-label="نمایش کنترل‌ها"
          title="نمایش مجدد کنترل‌ها"
        >
          <Eye size={18} />
        </button>
      )}

      {/* Error or Fullscreen Notification Toast */}
      {(errorNotice || fullscreenError) && (
        <div
          dir="rtl"
          className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg bg-red-950/90 border border-red-500/50 text-red-200 text-xs flex items-center gap-3 backdrop-blur-md shadow-2xl animate-fadeInCard"
          role="status"
        >
          <span>{errorNotice || fullscreenError}</span>
          <button
            onClick={() => {
              setErrorNotice(null);
              setFullscreenError('');
            }}
            className="text-red-300 hover:text-white text-base font-bold px-1"
            aria-label="بستن پیام"
          >
            ✕
          </button>
        </div>
      )}
    </main>
  );
};

export default AiForzaCallExperience;
