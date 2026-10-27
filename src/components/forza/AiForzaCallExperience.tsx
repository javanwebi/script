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
  RotateCcw,
} from 'lucide-react';
import { ParticleAvatar, ParticleAvatarRef } from './ParticleAvatar';
import { extractPersianSpeechRecognition, forzaEndOfTurnPauseMs, extractForzaAudioBase64 } from '../../utils/forzaSpeechPipeline';
import { FORZA_GREETING_TEXT } from '../../utils/forzaGreeting';
import { ForzaVoiceActivity, rootMeanSquareFromTimeDomain } from '../../utils/forzaVoiceActivity';
import './style.css';
import { forzaFastStartSpeechChunks } from '../../utils/forzaSpeechChunks';

import { consumeForzaTextStream } from '../../utils/forzaStreamClient';
import { takeSpeakablePhrase } from '../../utils/forzaStreamingSpeech';
import { AiVisualPartSearchModal } from '../search/AiVisualPartSearchModal';

interface AiForzaCallExperienceProps {
  onClose?: () => void;
}

type ForzaStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

const GREETING_TEXT = FORZA_GREETING_TEXT;

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

type ForzaSpeechResponse = {
  success?: boolean;
  audioBase64?: string;
  useClientSpeech?: boolean;
  error?: { type?: string; message?: string };
};

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
  const callClosedRef = useRef(false);
  useEffect(() => { callClosedRef.current = false; return () => { callClosedRef.current = true; }; }, []);
  const avatarRef = useRef<ParticleAvatarRef | null>(null);
  const shell = useRef<HTMLDivElement | null>(null);

  const [paused, setPaused] = useState(false);
  const [revision, setRevision] = useState(0);
  const [speed, setSpeed] = useState<number>(2);
  const [clean, setClean] = useState(false);
  const [quality, setQuality] = useState('high');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [showTextInput, setShowTextInput] = useState<boolean>(false);
  const [customInput, setCustomInput] = useState<string>('');
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState<boolean>(false);
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null);
  const [isUserSpeaking, setIsUserSpeaking] = useState<boolean>(false);
  // The configured provider speaks via STT -> text -> TTS, not Gemini Live WS.
  const voiceMode = 'legacy' as const;
  const [particlesFormed, setParticlesFormed] = useState(false);
  const [greetingPhase, setGreetingPhase] = useState<'forming'|'preparing'|'speaking'|'needs-permission'|'complete'|'error'>('forming');
  const greetingStartedRef = useRef(false);
  const micAutoStartedRef = useRef(false);
  const greetingFinishedRef = useRef(false);
  const micMutedRef = useRef(false);
  const speechInterimRef = useRef(false);
  const pendingAudioResolveRef = useRef<(() => void) | null>(null);
  const recognitionFailedRef = useRef(false);
  const vadRef = useRef(new ForzaVoiceActivity());
  const micContextWarningRef = useRef(false);
  const lastMicActivityRef = useRef(0);
  const recorderStartedAtRef = useRef(0);
  const speechSegmentStartedRef = useRef(false);
  const ttsRequestsRef = useRef(new Map<string, Promise<ForzaSpeechResponse>>());
  const ttsProviderCooldownRef = useRef(0);

  const ttsReadyRef = useRef(new Map<string, ForzaSpeechResponse>());
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);

  const [stats, setStats] = useState<{ fps: number | null; tier: string; renderMs: number; particles?: number }>({
    fps: null,
    tier: 'ULTRA',
    renderMs: 0,
    particles: 0,
  });
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [voiceOutputError, setVoiceOutputError] = useState<string | null>(null);
  const lastPlayableVoiceRef = useRef<{ text:string; audioUrl:string } | null>(null);
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

  const setStatus = useCallback((s: ForzaStatus) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  // Start/Stop voice listening helpers
  const startListening = useCallback(() => {
    if (!isCallActive || !greetingFinishedRef.current || micMutedRef.current || isAiSpeakingRef.current || statusRef.current === 'thinking' || isProcessingTurnRef.current) {
      return;
    }

    setStatus('listening');
    setTurn('user');
    activeTranscriptRef.current = '';
    hasSpeechSoundRef.current = false;
    audioChunksRef.current = [];

    // Prefer fast WebSpeech; simultaneously capture actual microphone audio
    // so the Cloudflare STT route works when Chrome recognition fails.
    if (!micMutedRef.current && recognitionRef.current && !isRecognitionActiveRef.current && !recognitionFailedRef.current) {
      try {
        recognitionRef.current.start();
        isRecognitionActiveRef.current = true;
      } catch {
        recognitionFailedRef.current = true;
      }
    }
    const recorder = mediaRecorderRef.current;
    if (!micMutedRef.current && recorder?.state === 'inactive') {
      try {
        audioChunksRef.current = [];
        speechSegmentStartedRef.current = false;
        recorderStartedAtRef.current = Date.now();
        recorder.start(250);
      } catch (error) {
        console.warn('[FORZA] MediaRecorder could not start', (error as any)?.name || 'unavailable');
        setMicrophoneError('ضبط صدا فعال نشد؛ مجوز میکروفون را بررسی کنید.');
      }
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, [isCallActive, setStatus]);

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

  // Low-latency VAD uses actual mic PCM RMS, not decorative frequency motion.
  // The worker STT fallback receives MediaRecorder audio after a real speech
  // segment finishes; Chrome SpeechRecognition may finish even sooner.
  useEffect(() => {
    let active=true;
    let frame=0;
    let lastCheck=0;
    let samples=new Uint8Array(512);
    const check=(timestamp:number)=>{
      if(!active)return;
      frame=requestAnimationFrame(check);
      if(timestamp-lastCheck<55)return;
      lastCheck=timestamp;
      if(statusRef.current==='speaking'){
        setAudioLevel(0.4+Math.random()*0.22);
        return;
      }
      if(statusRef.current!=='listening'||!greetingFinishedRef.current||micMutedRef.current||isAiSpeakingRef.current||isProcessingTurnRef.current){
        vadRef.current.reset();
        setAudioLevel(0);
        return;
      }
      const analyser=micAnalyserRef.current;
      if(!analyser || !streamRef.current?.active){
        // WebSpeech may be available without Web Audio; expose real mic
        // readiness rather than pretending to hear any sound.
        setAudioLevel(0);
        return;
      }
      if(ctxRef.current?.state==='suspended'){
        if(!micContextWarningRef.current){
          micContextWarningRef.current=true;
          setMicrophoneError('مرورگر پردازش صدا را متوقف کرده است. برای فعال‌سازی روی «تلاش مجدد میکروفون» بزنید.');
        }
        return;
      }
      try {
        // getByteTimeDomainData() writes only fftSize samples. A longer
        // zero-initialized buffer makes silence look like loud speech.
        if (samples.length !== analyser.fftSize) samples = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(samples);
        const rms=rootMeanSquareFromTimeDomain(samples);
        const current=vadRef.current.sample(rms,Date.now());
        setAudioLevel(current.level);
        if(current.speechStarted){
          hasSpeechSoundRef.current=true;
          setIsUserSpeaking(true);
        }
        // 650-900ms after a clearly finished question, ~1.7s for an
        // unfinished Persian thought. Worker audio STT is the safety net.
        if(current.speaking){
          if(silenceTimerRef.current){
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current=null;
          }
        }else if(current.silenceMs>0 && hasSpeechSoundRef.current && !silenceTimerRef.current){
          const transcript=activeTranscriptRef.current.trim();
          const pauseMs=transcript
            ? forzaEndOfTurnPauseMs(transcript,speechInterimRef.current)
            : 1000;
          const remaining=Math.max(80,pauseMs-current.silenceMs);
          silenceTimerRef.current=window.setTimeout(()=>{
            silenceTimerRef.current=null;
            if(isProcessingTurnRef.current||isAiSpeakingRef.current||statusRef.current!=='listening')return;
            if(vadRef.current.silenceDuration(Date.now())<pauseMs)return;
            setIsUserSpeaking(false);
            if(activeTranscriptRef.current.trim()){
              const text=activeTranscriptRef.current.trim();
              activeTranscriptRef.current='';
              hasSpeechSoundRef.current=false;
              vadRef.current.reset();
              void handleUserFinishedSpeaking(text);
            }else if(mediaRecorderRef.current?.state==='recording'){
              // MediaRecorder.onstop dispatches the audio to Worker STT.
              mediaRecorderRef.current.stop();
              vadRef.current.reset();
            }else{
              hasSpeechSoundRef.current=false;
              vadRef.current.reset();
            }
          },remaining);
        }
      }catch(err){
        console.warn('[FORZA] Audio analyser failed',(err as any)?.name||'audio_error');
      }
    };
    frame=requestAnimationFrame(check);
    return()=>{
      active=false;
      cancelAnimationFrame(frame);
      if(silenceTimerRef.current){clearTimeout(silenceTimerRef.current);silenceTimerRef.current=null;}
    };
  },[]);

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
    const a = audioElRef.current;
    if (a) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {}
    }
  }, []);

  // Sound playback and microphone ownership are deliberately independent.
  // Listening starts ONLY after the real audio ended event, never on HTTP 200.
  const playDataUrl = useCallback((url: string): Promise<void> => new Promise((resolve,reject) => {
    if (!url) return reject(new Error('audio_missing'));
    stopAudio();
    let audio = audioElRef.current;
    if (!audio) {
      audio = new Audio();
      audioElRef.current = audio;
    }
    audio.pause();
    audio.src = url;
    audio.muted = isSpeakerMuted;
    audio.volume = 1;
    let settled=false;
    const cleanup=()=> {
      audio.removeEventListener('ended',ended);
      audio.removeEventListener('error',failed);
      audio.removeEventListener('playing',playing);
    };
    const finish=(err?:Error)=> {
      if(settled)return;
      settled=true;
      cleanup();
      isAiSpeakingRef.current=false;
      if(err) reject(err);
      else resolve();
    };
    const playing=()=>{
      isAiSpeakingRef.current=true;
      setStatus('speaking');
      setTurn('ai');
      setAutoplayBlocked(false);
      setPendingAudioUrl(null);
    };
    const ended=()=>finish();
    const failed=()=>finish(new Error('audio-playback-failed'));
    audio.addEventListener('ended',ended);
    audio.addEventListener('error',failed);
    audio.addEventListener('playing',playing);
    void audio.play().then(playing).catch((error:any)=>{
      if(error?.name==='NotAllowedError') {
        // Leave a real permission action visible; DO NOT start the mic.
        setAutoplayBlocked(true);
        setPendingAudioUrl(url);
        finish(new Error('autoplay_permission_required'));
      } else {
        finish(new Error('audio-playback-failed'));
      }
    });
  }),[isSpeakerMuted,setStatus,stopAudio]);

  const requestSpeechAudio = useCallback((text:string) => {
    const ready = ttsReadyRef.current.get(text);
    if (ready?.audioBase64) return Promise.resolve(ready);
    if (Date.now() < ttsProviderCooldownRef.current) {
      return Promise.reject(new Error('tts_provider_temporarily_unavailable'));
    }
    const inFlight=ttsRequestsRef.current.get(text);
    if(inFlight)return inFlight;
    const promise=fetch('/api/ai/tts', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text}),
      signal: AbortSignal.timeout(25000),
    }).then(async res=>{
      const data=await res.json().catch(()=>null) as ForzaSpeechResponse | null;
      if (!res.ok || data?.success !== true || typeof data.audioBase64 !== 'string' || !data.audioBase64.startsWith('data:audio/')) {
        if (res.status === 503 || res.status === 429) ttsProviderCooldownRef.current = Date.now() + 15000;
        throw new Error(data?.error?.type || 'tts_provider_unavailable');
      }
      if (data.audioBase64) {
        const cache = ttsReadyRef.current;
        cache.set(text, data);
        if (cache.size > 24) {
          const oldest = cache.keys().next().value;
          if (oldest) cache.delete(oldest);
        }
      }
      return data;
    }).finally(()=>ttsRequestsRef.current.delete(text));
    ttsRequestsRef.current.set(text,promise);
    return promise;
  },[]);

  // Synthesize the greeting while the particle scene is forming, not after it finishes.
  useEffect(() => {
    const firstPhrase = forzaFastStartSpeechChunks(GREETING_TEXT)[0];
    if (firstPhrase) void requestSpeechAudio(firstPhrase).catch(() => {});
  }, [requestSpeechAudio]);

  // The only permitted speech engine is the configured private FORZA TTS backend.
  // A failure remains visible; no Gemini or browser-native voice fallback.
  const playSpeechPhrase = useCallback(async (
    phrase: string, serverSpeech: Promise<ForzaSpeechResponse>,
  ): Promise<void> => {
    const speech = await serverSpeech;
    if (!speech.audioBase64) throw new Error('pocket_tts_unavailable');
    lastPlayableVoiceRef.current = {text:phrase,audioUrl:speech.audioBase64};
    await playDataUrl(speech.audioBase64);
  }, [playDataUrl]);

  const speakText = useCallback(async (text:string) => {
    stopListening();
    setVoiceOutputError(null);
    setStatus('thinking');
    setTurn('ai');
    const chunks = forzaFastStartSpeechChunks(text);
    // Pipeline TTS generation while preceding phrases are spoken.
    let pendingSpeech: Promise<ForzaSpeechResponse> | undefined =
      chunks.length ? requestSpeechAudio(chunks[0]) : undefined;
    for (let index = 0; index < chunks.length; index++) {
      if (callClosedRef.current) return;
      const chunk = chunks[index];
      const currentSpeech = pendingSpeech!;
      pendingSpeech = chunks[index + 1] ? requestSpeechAudio(chunks[index + 1]) : undefined;
      await playSpeechPhrase(chunk, currentSpeech);
    }
  },[playSpeechPhrase,requestSpeechAudio,setStatus,stopListening]);

  const replayAiVoice = useCallback(async () => {
    const text = aiText.trim();
    if (!text) return;
    setVoiceOutputError(null);
    // Reuse already-generated Pocket audio when possible; no secondary voice provider.
    try {
      const existing = lastPlayableVoiceRef.current;
      if (existing?.text === text && existing.audioUrl) {
        stopListening();
        await playDataUrl(existing.audioUrl);
      } else {
        await speakText(text);
      }
    } catch (error:any) {
      setVoiceOutputError(error?.message === 'autoplay_permission_required'
        ? 'برای پخش صدا، یک بار صفحه را لمس یا کلیک کنید.'
        : 'موتور صوتی FORZA صدا تولید نکرد؛ وضعیت سرویس را بررسی کنید.');
    } finally {
      if (greetingFinishedRef.current) startListening();
    }
  },[aiText,playDataUrl,speakText,startListening,stopListening]);

  // A user gesture permits browser audio, but it never skips the greeting.
  const unlockAudio = useCallback(() => {
    ensureCtx();
    const url=pendingAudioUrl;
    if(url) {
      setPendingAudioUrl(null);
      void playDataUrl(url)
        .then(()=>{
          if(!greetingFinishedRef.current) {
            greetingFinishedRef.current=true;
            setGreetingPhase('complete');
          }
          setStatus('listening');
          setTurn('user');
          startListening();
        })
        .catch(()=>{setGreetingPhase('needs-permission');setAutoplayBlocked(true)});
    } else {
      setAutoplayBlocked(false);
      if(!greetingFinishedRef.current) {
        void speakText(GREETING_TEXT).then(()=>{
          greetingFinishedRef.current=true;
          setGreetingPhase('complete');
          setStatus('listening');
          setTurn('user');
          startListening();
        }).catch(()=>{setGreetingPhase('needs-permission');setAutoplayBlocked(true)});
      }
    }
  },[ensureCtx,pendingAudioUrl,playDataUrl,setStatus,startListening,speakText]);

  // Turn management: send speech/query to AI & worker
  const handleUserFinishedSpeaking = useCallback(
    async (textToSend?: string, audioBlob?: Blob, audioMime?: string) => {
      const q = (textToSend || '').trim();
      if (!q && !audioBlob) return;
      if (!greetingFinishedRef.current) return;
      if (isAiSpeakingRef.current || statusRef.current === 'thinking' || isProcessingTurnRef.current) return;

      isProcessingTurnRef.current = true;
      stopListening();
      // No audio-unlock call here: it can accidentally replay the introduction
      // while the customer's recording is being submitted.
      setStatus('thinking');
      setTurn('ai');
      activeTranscriptRef.current = '';

      if (q) {
        setUserText(q);
      } else {
        setUserText('در حال تبدیل صدای شما به متن و ارسال به سرور...');
      }

      try {
        const payload: any = {
          history: historyRef.current.slice(-24),
          // First deliver the exact AI words; synthesize audio as a second step.
          deferAudio: true,
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
          const audioBase64 = extractForzaAudioBase64(await base64Promise);
          // Transcribe speech first so the customer's exact words appear
          // immediately, before waiting on AI generation and spoken output.
          const sttResponse = await fetch('/api/ai/forza-live', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
              audioBase64,
              audioMimeType:audioMime || audioBlob.type || 'audio/webm',
              transcribeOnly:true,
            }),
          });
          const sttData = await sttResponse.json().catch(()=>null);
          if(!sttResponse.ok || !sttData?.success || !String(sttData.userTranscript||'').trim()){
            throw new Error(sttData?.error||'گفتار واضحی دریافت نشد؛ لطفاً دوباره صحبت کنید.');
          }
          payload.query = String(sttData.userTranscript).trim();
          setUserText(payload.query);
          setMicrophoneError(null);
        }

        // Direct Gemini SSE starts speaking on the FIRST complete, speakable
        // phrase. The speech engine receives phrases while the model is still
        // writing the rest of its answer; output playback is strictly ordered.
        const previousHistory = historyRef.current.slice(-24);
        const resolvedUserQuery = String(payload.query || q).trim();
        if (resolvedUserQuery) {
          setUserText(resolvedUserQuery);
          historyRef.current.push({role:'user',text:resolvedUserQuery});
        }
        let reply = '';
        let speechBuffer = '';
        let phraseCount = 0;
        let playbackChain: Promise<void> = Promise.resolve();
        let playbackFailure = false;
        const queuePhrase = (phrase: string) => {
          if (!phrase.trim()) return;
          phraseCount++;
          const speechRequest = requestSpeechAudio(phrase);
          playbackChain = playbackChain.then(async () => {
            if (callClosedRef.current) return;
            await playSpeechPhrase(phrase, speechRequest);
          }).catch(error => {
            playbackFailure = true;
            console.warn('[FORZA Voice] streaming speech failed',error?.message||'unknown');
          });
        };
        const onTextChunk = (chunk: string, fullText: string) => {
          reply = fullText;
          setAiText(fullText);
          speechBuffer += chunk;
          while (true) {
            const ready = takeSpeakablePhrase(speechBuffer, phraseCount === 0);
            if (!ready) break;
            speechBuffer = ready.rest;
            queuePhrase(ready.phrase);
          }
        };
        try {
          const streamRes = await fetch('/api/ai/consult-stream', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
              query:resolvedUserQuery,
              history:previousHistory,
              includeAudio:false,
              mode:'forza',
            }),
          });
          reply = await consumeForzaTextStream(streamRes, onTextChunk);
          if (!reply) throw new Error('forza_empty_stream');
        } catch(streamError) {
          // Keep the existing complete-response route as a compatibility
          // fallback when streaming has not begun at all.
          if (reply) throw streamError;
          const res = await fetch('/api/ai/forza-live',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify(payload),
          });
          const data = await res.json().catch(()=>null);
          if (!res.ok || !data?.success) throw new Error(data?.error||'server-error');
          reply = String(data.text||'').trim();
          if (!reply) throw new Error('forza_empty_response');
          onTextChunk(reply,reply);
        }
        if (speechBuffer.trim()) queuePhrase(speechBuffer.trim());
        if (reply) {
          historyRef.current.push({role:'model',text:reply});
          setAiText(reply);
          await playbackChain;
          if (playbackFailure) {
            setVoiceOutputError('صدای پاسخ کامل پخش نشد؛ سرویس TTS را بررسی کنید.');
          } else {
            setVoiceOutputError(null);
          }
        }
      } catch (err: any) {
        console.warn('[AI FORZA] Conversational turn failed:', err?.message || 'unknown');
        if (!q) setUserText('پاسخ صوتی دریافت نشد؛ لطفاً دوباره صحبت کنید یا سؤال را تایپ کنید.');
        setErrorNotice(
          String(err?.message || 'پاسخ هوش مصنوعی در دسترس نیست؛ لطفاً دوباره تلاش کنید.').slice(0, 230)
        );
      } finally {
        isProcessingTurnRef.current = false;
        setStatus('listening');
        setTurn('user');
        startListening();
      }
    },
    [setStatus, startListening, stopListening, requestSpeechAudio, playSpeechPhrase]
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
          // Ignore events from an old recorder replaced by a microphone retry.
          if (mediaRecorderRef.current !== mr) return;
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
            } else {
              setMicrophoneError('صدای ضبط‌شده خیلی کوتاه است؛ میکروفون را نزدیک‌تر کنید و دوباره صحبت کنید.');
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

        // Chrome's results include earlier FINAL words on every event.
        // Rebuild all segments; processing only resultIndex loses sentences.
        const recognized = extractPersianSpeechRecognition(event.results);
        const currentSpeech = recognized.text;
        if (currentSpeech) {
          speechInterimRef.current = recognized.hasInterim;
          hasSpeechSoundRef.current = true;
          activeTranscriptRef.current = currentSpeech;
          setUserText(currentSpeech);
          setStatus('listening');
          setTurn('user');
          setIsUserSpeaking(true);

          const pauseMs = forzaEndOfTurnPauseMs(currentSpeech, recognized.hasInterim);

          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = window.setTimeout(() => {
            silenceTimerRef.current = null;
            if (vadRef.current.heardSpeech && vadRef.current.silenceDuration(Date.now()) < pauseMs) return;
            if (activeTranscriptRef.current && !isAiSpeakingRef.current && !isProcessingTurnRef.current && statusRef.current === 'listening' && !micMutedRef.current) {
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
        if (['network','not-allowed','service-not-allowed','audio-capture','language-not-supported'].includes(error)) {
          webSpeechFailedRef.current = true;
          recognitionFailedRef.current=true;
          setMicrophoneError('تشخیص گفتار مرورگر در دسترس نیست؛ پردازش صوتی سرور امتحان می‌شود.');
        }
      };

      rec.onend = () => {
        isRecognitionActiveRef.current = false;
        if (recognitionFailedRef.current || !greetingFinishedRef.current || micMutedRef.current) return;
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

  // Request mic access on entry; only start active transcription after greeting.
  const initializeMicrophone = useCallback(async () => {
    setMicrophoneError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
      // Resuming AudioContext from an explicit click also unlocks analyser VAD.
      // Never await AudioContext.resume() before getUserMedia: Chrome can
      // suspend it until a user gesture and otherwise block mic acquisition.
      const ctx=ensureCtx();
      const stream=await navigator.mediaDevices.getUserMedia({audio:{
        echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1,
      }});
      streamRef.current?.getTracks().forEach(track=>track.stop());
      streamRef.current=stream;
      micContextWarningRef.current=false;
      vadRef.current.reset();
      for (const track of stream.getAudioTracks()) {
        track.onended=()=>setMicrophoneError('ارتباط میکروفون قطع شد. پس از وصل‌کردن میکروفون، صفحه را بازخوانی کنید.');
      }
      if(ctx){
        micSourceNodeRef.current?.disconnect();
        const source=ctx.createMediaStreamSource(stream);
        const analyser=ctx.createAnalyser();
        analyser.fftSize=512;analyser.smoothingTimeConstant=0.6;
        source.connect(analyser);
        micSourceNodeRef.current=source;
        micAnalyserRef.current=analyser;
      }
      if(mediaRecorderRef.current?.state==='recording') mediaRecorderRef.current.stop();
      setupMediaRecorder(stream);
      recognitionFailedRef.current=false;
      recognitionRef.current=initSpeechRecognition();
      if(greetingFinishedRef.current && !micMutedRef.current) startListening();
    } catch(error:any) {
      setMicrophoneError(error?.name==='NotAllowedError' || error?.name==='PermissionDeniedError'
        ? 'اجازه میکروفون رد شده است. روی قفل کنار آدرس سایت کلیک کرده و Microphone را Allow کنید؛ سپس صفحه را بازخوانی کنید.'
        : 'میکروفون متصل نشد. میکروفون پیش‌فرض و مجوز مرورگر را بررسی کنید.');
    }
  },[ensureCtx,setupMediaRecorder,initSpeechRecognition,startListening]);

  // Acquire permission while the particle animation forms; audio input stays
  // muted for transcription until the greeting has finished.
  useEffect(() => {
    if (micAutoStartedRef.current) return;
    micAutoStartedRef.current = true;
    void initializeMicrophone();
  }, [initializeMicrophone]);

  // Start only after the avatar confirms 100% of particles have formed.
  // Never listen to the introduction or silently skip an autoplay denial.
  useEffect(() => {
    if (!particlesFormed || greetingStartedRef.current) return;
    greetingStartedRef.current=true;
    let active=true;
    setStatus('idle'); setTurn('ai'); setGreetingPhase('preparing');
    setDisplayedAi(GREETING_TEXT);
    if(!historyRef.current.length)historyRef.current.push({role:'model',text:GREETING_TEXT});
    void speakText(GREETING_TEXT).then(()=>{
      if(!active)return;
      greetingFinishedRef.current=true;
      setGreetingPhase('complete');
      setStatus('listening');setTurn('user');
      startListening();
    }).catch((e:any)=>{
      if(!active)return;
      const autoplayDenied = e?.message === 'autoplay_permission_required';
      console.warn('[FORZA] Greeting audio unavailable',e?.message||'audio_error');
      if (autoplayDenied) {
        setGreetingPhase('needs-permission');
        setAutoplayBlocked(true);
        setVoiceOutputError('مرورگر پخش خودکار را محدود کرده است؛ برای ادامه یک بار روی صفحه کلیک کنید.');
        return;
      }
      // Without Pocket audio the requested greeting has NOT played.
      // Do not fake its completion and never record the customer mid-error.
      setVoiceOutputError('موتور صوتی FORZA در دسترس نیست. خوشامدگویی پخش نشد و مکالمه آغاز نشده است.');
      greetingFinishedRef.current=false;
      setGreetingPhase('error');
      setStatus('idle');
      setTurn('ai');
    });
    return ()=>{
      active=false;
      greetingStartedRef.current=false;
      greetingFinishedRef.current=false;
      if(silenceTimerRef.current)clearTimeout(silenceTimerRef.current);
      stopListening();
      streamRef.current?.getTracks().forEach(track=>track.stop());
      streamRef.current=null;
      stopAudio();
    };
  // A scene starts once. Changing TTS/recognition callbacks must not tear down
  // the stream mid-greeting or permanently disable the microphone.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[particlesFormed]);

  const endCall = useCallback(() => {
    callClosedRef.current = true;
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
    if (!greetingFinishedRef.current || isAiSpeakingRef.current || statusRef.current === 'thinking' || isProcessingTurnRef.current) return false;
    void handleUserFinishedSpeaking(text);
    return true;
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
        onFormed={() => setParticlesFormed(true)}
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
        className="absolute bottom-20 right-4 sm:right-10 w-[calc(100%-2rem)] sm:w-[min(36vw,30rem)] max-h-[55dvh] overflow-y-auto max-w-[34rem] z-30 flex flex-col gap-3 pointer-events-none"
      >
        {/* Turn Status Pill & Mic / Speaker Controls */}
        <div className="self-end inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/88 border border-white/15 backdrop-blur-xl shadow-lg text-xs pointer-events-auto transition-all forza-persian-label">
          <span className="font-semibold text-white text-[12px] sm:text-[13px] leading-6">
            {greetingPhase === 'error'
              ? 'موتور صوتی FORZA در دسترس نیست'
              : greetingPhase === 'needs-permission'
              ? 'مرورگر پخش خودکار را محدود کرده است'
              : turn === 'user'
              ? 'فورزا گوش می‌دهد؛ صحبتتان را کامل کنید'
              : status === 'thinking'
              ? 'AI FORZA در حال پردازش...'
              : status === 'speaking'
              ? 'AI FORZA در حال صحبت...'
              : 'FORZA در حال آماده‌سازی تماس...'}
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
            onClick={() => { void replayAiVoice(); }}
            disabled={!aiText.trim() || status === 'speaking'}
            className="p-1 rounded-md text-[#dee2e5]/70 hover:text-white hover:bg-white/10 disabled:opacity-40"
            title="خواندن دوباره پاسخ فورزا"
            aria-label="خواندن دوباره پاسخ فورزا">
            <RotateCcw size={14}/>
          </button>
          <button
            type="button"
            onClick={() => setIsMicMuted(prev => {
              const next = !prev;
              micMutedRef.current = next;
              if (next) stopListening();
              else if (greetingFinishedRef.current) startListening();
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

        {microphoneError && (
          <div role="alert" className="pointer-events-auto self-end flex max-w-sm flex-col gap-2 rounded-xl border border-orange-400/40 bg-black/85 px-3 py-2 text-right text-xs text-amber-200">
            <span>{microphoneError}</span>

          </div>
        )}
        {greetingPhase === 'forming' && (
          <div role="status" className="pointer-events-none self-end rounded-xl bg-black/80 px-3 py-2 text-xs text-white">
            در حال تکمیل ذرات فورزا...
          </div>
        )}
        {greetingPhase === 'preparing' && (
          <div role="status" className="pointer-events-none self-end rounded-xl bg-black/80 px-3 py-2 text-xs text-white">
            در حال آماده‌سازی صدای خوشامدگویی...
          </div>
        )}

        {voiceOutputError && (
          <div role="alert" className="pointer-events-auto self-end max-w-sm rounded-xl border border-orange-400/50 bg-black/90 px-3 py-2 text-xs text-orange-100">
            {voiceOutputError}
            <button type="button" onClick={() => { void replayAiVoice(); }}
              className="mt-2 block rounded-md border border-orange-400/50 px-2 py-1 font-bold text-white hover:bg-orange-600/30">
              خواندن دوباره پاسخ
            </button>
          </div>
        )}
        <button type="button" onClick={() => { micMutedRef.current = true; setIsMicMuted(true); stopListening(); setShowImageSearch(true); }}
          className="pointer-events-auto self-end flex items-center gap-3 rounded-2xl border border-orange-400/60 bg-gradient-to-l from-orange-950/95 to-slate-950/95 px-5 py-3 text-white shadow-xl backdrop-blur-xl"
          aria-label="شناسایی تصویر قطعه با فورزا">
          <Eye size={22} className="text-orange-400" />
          <span className="forza-persian-label">اسکن تصویر قطعه</span>
        </button>
        {/* No extra audio-unlock button. The existing stage gesture handler
            may resume playback when the browser enforces autoplay policy. */}
        {/* Text Input Drawer (for typing without microphone) */}
        {showTextInput && (
          <form
            onSubmit={e => {
              e.preventDefault();
              if (customInput.trim()) {
                const text = customInput.trim();
                if (submitUserText(text)) {
                  setCustomInput('');
                  setShowTextInput(false);
                }
              }
            }}
            className="flex items-center gap-2 p-1.5 rounded-xl bg-black/90 border border-[#E06518]/60 backdrop-blur-md shadow-2xl pointer-events-auto animate-fadeInCard"
          >
            <input
              type="text"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              placeholder="سؤال فنی خود را تایپ کنید..."
              className="flex-1 bg-transparent px-3 py-2 text-[13px] sm:text-sm text-white placeholder-white/45 outline-none forza-persian-copy"
              autoFocus
            />
            <button
              type="submit"
              disabled={!customInput.trim() || greetingPhase !== 'complete' || status === 'thinking' || status === 'speaking'}
              className="p-2 rounded-lg bg-[#E06518] hover:bg-[#C95210] disabled:opacity-40 text-white transition-all cursor-pointer"
              title="ارسال به هوش مصنوعی"
            >
              <Send size={13} />
            </button>
          </form>
        )}

        {/* User live speech transcript */}
        {userText && (
          <div className="forza-persian-copy text-[13px] sm:text-[14px] bg-black/88 border border-white/15 text-[#f1f3f5] px-4 py-3 rounded-2xl backdrop-blur-xl shadow-xl animate-fadeInCard pointer-events-auto">
            <span className="forza-persian-label text-white ml-2">شما:</span>
            <span>{userText}</span>
          </div>
        )}

        {/* AI voice response subtitle box matching screenshot */}
        {displayedAi && (
          <div className="text-xs sm:text-sm bg-[#0b0908]/94 border border-[#e06518]/45 text-white p-4 sm:p-5 rounded-2xl backdrop-blur-xl shadow-2xl pointer-events-auto border-t-2 border-t-[#e06518] animate-fadeInCard">
            <div className="forza-persian-label text-[12px] font-bold text-[#f47a29] mb-2 flex items-center justify-end gap-1.5" dir="rtl">
              <span><bdi dir="ltr" className="forza-code">AI FORZA</bdi> :</span>
              <Volume2 size={13} className="text-[#e06518]" />
            </div>
            <p className="forza-persian-copy text-[13px] sm:text-[15px] text-[#f1f3f5]">{displayedAi}</p>
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
      {showImageSearch && <AiVisualPartSearchModal isOpen onClose={() => setShowImageSearch(false)} />}
    </main>
  );
};

export default AiForzaCallExperience;
