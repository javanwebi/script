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
  Square,
} from 'lucide-react';
import { ParticleAvatar, ParticleAvatarRef } from './ParticleAvatar';
import { extractPersianSpeechSince, forzaEndOfTurnPauseMs, forzaTurnRemainingWaitMs, extractForzaAudioBase64 } from '../../utils/forzaSpeechPipeline';
import { FORZA_GREETING_TEXT } from '../../utils/forzaGreeting';
import {forzaRecognitionRetryDelay} from '../../utils/forzaRecognitionRecovery';
import { ForzaVoiceActivity, rootMeanSquareFromTimeDomain } from '../../utils/forzaVoiceActivity';
import './style.css';
import { disposeDibaSttModel, loadDibaSttModel, type LocalRecognizer, type LocalSttModel } from '../../utils/forzaLocalSpeech';
import { consumeForzaTextStream } from '../../utils/forzaStreamClient';
import { ForzaContinuousWav } from '../../utils/forzaContinuousWav';
import { ForzaNimaBufferedSpeech } from '../../utils/forzaNimaBufferedSpeech';
import { ForzaIncrementalSpeechText } from '../../utils/forzaIncrementalSpeechText';
import { ForzaCallPlainText, forzaSpokenPlainText } from '../../utils/forzaCallPlainText';
import { forzaTurnIntent, shouldIgnoreForzaSpeakerEcho } from '../../utils/forzaBargeIn';
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
  const voiceModeRef = useRef<'pocket-farsi-v2'|'piper-nima-gyro-medium'>('pocket-farsi-v2');
  const nimaAckWavRef=useRef<Uint8Array|null>(null);
  const [activeVoiceLabel,setActiveVoiceLabel]=useState('در حال بررسی موتور صوتی');
  useEffect(()=>{
    let mounted=true;
    let ackRetryTimer:number|null=null;
    void fetch('/api/ai/forza-voice-info',{cache:'no-store'})
      .then(r=>r.ok?r.json():null)
      .then(data=>{
        if(!mounted)return;
        if(data?.voice==='piper-nima-gyro-medium'&&data?.incrementalSpeech===true){
          voiceModeRef.current='piper-nima-gyro-medium';
          setActiveVoiceLabel('نیما (Piper فارسی)');
          // Prefetch the same-voice acknowledgement while particles form.
          // The worker has already synthesized it once at startup; this is
          // a small RAM-only WAV fetch, never a per-turn TTS inference.
          const preloadNimaAck=(attempt=0)=>{
            void fetch('/api/ai/forza-ack',{cache:'force-cache'})
              .then(response=>response.ok?response.arrayBuffer():null)
              .then(value=>{
                if(!mounted)return;
                if(!value){
                  if(attempt<2)ackRetryTimer=window.setTimeout(()=>preloadNimaAck(attempt+1),700*(attempt+1));
                  return;
                }
                const wav=new Uint8Array(value);
                if(wav.byteLength>=44&&
                   String.fromCharCode(...wav.subarray(0,4))==='RIFF'&&
                   String.fromCharCode(...wav.subarray(8,12))==='WAVE'){
                  nimaAckWavRef.current=wav;
                  console.info('[FORZA_NIMA_ACK] prefetched=1 bytes='+wav.byteLength);
                }
              }).catch(()=>{
                if(mounted&&attempt<2)
                  ackRetryTimer=window.setTimeout(()=>preloadNimaAck(attempt+1),700*(attempt+1));
              });
          };
          preloadNimaAck();

        }else{
          voiceModeRef.current='pocket-farsi-v2';
          setActiveVoiceLabel(data?.voice==='pocket-farsi-v2'
            ?'Pocket TTS فارسی v2':'موتور فعلی سرور');
        }
      }).catch(()=>{if(mounted)setActiveVoiceLabel('موتور فعلی سرور');});
    return()=>{
      mounted=false;
      if(ackRetryTimer!==null)window.clearTimeout(ackRetryTimer);
    };
  },[]);
  useEffect(() => { callClosedRef.current = false; return () => { callClosedRef.current = true; }; }, []);
  const avatarRef = useRef<ParticleAvatarRef | null>(null);
  const shell = useRef<HTMLDivElement | null>(null);

  const [paused, setPaused] = useState(false);
  const [revision, setRevision] = useState(0);
  const [speed, setSpeed] = useState<number>(2);
  const [clean, setClean] = useState(false);
  // Keep the original high-fidelity silhouette and particle density.
  // Microphone VAD now runs independently of Three.js, so a low render FPS
  // must never silently replace the avatar with a sparse/different design.
  const [quality] = useState<'high'>('high');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [showTextInput, setShowTextInput] = useState<boolean>(false);
  const [customInput, setCustomInput] = useState<string>('');
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState<boolean>(false);
  const speakerMutedRef=useRef(false);
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null);
  const [isUserSpeaking, setIsUserSpeaking] = useState<boolean>(false);
  // The configured provider speaks via STT -> text -> TTS, not Gemini Live WS.
  const [particlesFormed, setParticlesFormed] = useState(false);
  const [greetingPhase, setGreetingPhase] = useState<'forming'|'preparing'|'speaking'|'needs-permission'|'complete'|'error'>('forming');
  const [voicePending, setVoicePending] = useState(false);
  // Distinguish an in-flight LLM from an available WAV and from an
  // AudioContext source actually playing. Never infer sound from text alone.
  const [voiceStage,setVoiceStage]=useState<'idle'|'text'|'synthesizing'|'buffering'|'playing'|'error'>('idle');
  const [voiceWaitSeconds, setVoiceWaitSeconds] = useState(0);
  const greetingStartedRef = useRef(false);
  const micAutoStartedRef = useRef(false);
  const greetingFinishedRef = useRef(false);
  const micMutedRef = useRef(false);
  const speechInterimRef = useRef(false);
  const pendingAudioResolveRef = useRef<(() => void) | null>(null);
  const recognitionFailedRef = useRef(false);
  const recognitionRetryRef=useRef(0);
  const recognitionRetryTimerRef=useRef<number|null>(null);
  const recognitionRestartTimerRef=useRef<number|null>(null);
  const vadRef = useRef(new ForzaVoiceActivity());
  const micContextWarningRef = useRef(false);
  const lastMicActivityRef = useRef(0);
  const detectedSpeechEndAtRef=useRef(0);
  // Memory-only, non-content latency samples (never transcripts or PCM).
  const endToPlaybackSamplesRef=useRef<number[]>([]);
  const recorderStartedAtRef = useRef(0);
  const speechSegmentStartedRef = useRef(false);
  const localSttModelRef=useRef<LocalSttModel|null>(null);
  const localSttLoadRef=useRef<Promise<boolean>|null>(null);
  const preferLocalSttRef=useRef(false);
  const localSttRecognizerRef=useRef<LocalRecognizer|null>(null);
  const localSttNodeRef=useRef<ScriptProcessorNode|null>(null);
  const localSttSinkRef=useRef<GainNode|null>(null);
  const localSttFinalRef=useRef('');
  const [,setLocalSttStatus]=useState<'loading'|'ready'|'fallback'>('fallback');
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);

  const [stats, setStats] = useState<{ fps: number | null; tier: string; renderMs: number; particles?: number }>({
    fps: null,
    tier: 'ULTRA',
    renderMs: 0,
    particles: 0,
  });
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [voiceOutputError, setVoiceOutputError] = useState<string | null>(null);
  const continuousVoiceRef=useRef<ForzaContinuousWav|null>(null);
  const manualReplayAbortRef=useRef<AbortController|null>(null);
  const isManualReplayPendingRef=useRef(false);
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
  const activeTurnRef = useRef<{generation:number; abort:AbortController; markInterrupted?:()=>void}|null>(null);
  const generationRef = useRef(0);
  // Not an authentication credential; a per-page correlation label used for
  // fair rate limits and debugging. No speech, audio or identity is stored.
  const callIdRef=useRef(Math.random().toString(36).slice(2,12));
  const interruptRequestRef = useRef<() => void>(()=>{});
  const isAiSpeakingRef = useRef<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const isRecognitionActiveRef = useRef<boolean>(false);
  const isProcessingTurnRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<number | null>(null);
  const activeTranscriptRef = useRef<string>('');
  const lastTranscriptChangedAtRef = useRef<number>(0);
  const webSpeechFailedRef = useRef<boolean>(false);
  const recognitionResultCountRef=useRef(0);
  const recognitionConsumedCountRef=useRef(0);
  // Compare only to speech entering the WebAudio player, not the LLM's
  // unspoken answer. Acoustic echo suppression is NOT diarization.
  const heardSpeechEchoRef=useRef('');
  const lastForzaPlaybackAtRef=useRef(0);
  const likelySpeakerEcho=(words:string)=>{
    const recentPlayback=isAiSpeakingRef.current ||
      (lastForzaPlaybackAtRef.current>0 && Date.now()-lastForzaPlaybackAtRef.current<1500);
    return shouldIgnoreForzaSpeakerEcho(
      words,heardSpeechEchoRef.current,recentPlayback);
  };
  const serverSttConfiguredRef=useRef<boolean|null>(null);

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
  const micPollTimerRef=useRef<number|null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const setStatus = useCallback((s: ForzaStatus) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  // Download the small offline greeting while the particles form, not after.
  useEffect(() => {
    const audio = new Audio('/forza-greeting-bootstrap.wav');
    audio.preload = 'auto';
    audioElRef.current = audio;
    audio.load();
    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      if (audioElRef.current === audio) audioElRef.current = null;
      };
  }, []);

  // Diba runs in the visitor's browser; no Railway inference.
  const attachLocalStt=useCallback(()=>{
    const ctx=ctxRef.current,source=micSourceNodeRef.current;
    if(!ctx||!source||!localSttModelRef.current||localSttNodeRef.current)return;
    try{
      const node=ctx.createScriptProcessor(4096,1,1),sink=ctx.createGain();
      sink.gain.value=0;
      node.onaudioprocess=(event:AudioProcessingEvent)=>{
        if(micMutedRef.current || !greetingFinishedRef.current ||
           (statusRef.current!=='listening' && !isProcessingTurnRef.current &&
            !isAiSpeakingRef.current && !isManualReplayPendingRef.current))return;
        try{localSttRecognizerRef.current?.acceptWaveform(event.inputBuffer);}
        catch(error){console.warn('[FORZA Diba] PCM rejected',error);}
      };
      source.connect(node);node.connect(sink);sink.connect(ctx.destination);
      localSttNodeRef.current=node;localSttSinkRef.current=sink;
      setLocalSttStatus('ready');
    }catch(error){console.warn('[FORZA Diba] Audio bridge error',error);setLocalSttStatus('fallback');}
  },[]);

  const startDibaTurn=useCallback(()=>{
    const model=localSttModelRef.current;
    if(!model||!localSttNodeRef.current||!ctxRef.current)return false;
    try{
      localSttRecognizerRef.current?.remove?.();
      const recognizer=new model.KaldiRecognizer(ctxRef.current.sampleRate);
      localSttFinalRef.current='';
      const update=(value:string,isFinal:boolean)=>{
        if(localSttRecognizerRef.current!==recognizer||micMutedRef.current||
           (statusRef.current!=='listening'&&!isProcessingTurnRef.current &&
            !isAiSpeakingRef.current&&!isManualReplayPendingRef.current))return;
        const words=value.trim();
        if(isFinal&&words)localSttFinalRef.current=[localSttFinalRef.current,words].filter(Boolean).join(' ');
        const transcript=[localSttFinalRef.current,isFinal?'':words].filter(Boolean).join(' ').trim();
        if(!transcript)return;
        if(isProcessingTurnRef.current||isAiSpeakingRef.current||isManualReplayPendingRef.current){
          if(!vadRef.current.heardSpeech)return;
          if(likelySpeakerEcho(transcript)){
            console.info('[FORZA_STT] source=local echo_candidate_ignored=1');
            return;
          }
          interruptRequestRef.current();
        }
        if (transcript!==activeTranscriptRef.current || speechInterimRef.current===isFinal) {
          lastTranscriptChangedAtRef.current=Date.now();
        }
        activeTranscriptRef.current=transcript;speechInterimRef.current=!isFinal;
        hasSpeechSoundRef.current=true;setUserText(transcript);setIsUserSpeaking(true);
      };
      recognizer.on('partialresult',msg=>update(String(msg?.result?.partial||''),false));
      recognizer.on('result',msg=>update(String(msg?.result?.text||''),true));
      recognizer.on('error',()=>setLocalSttStatus('fallback'));
      localSttRecognizerRef.current=recognizer;
      return true;
    }catch(error){console.warn('[FORZA Diba] Recognizer failed',error);setLocalSttStatus('fallback');return false;}
  },[]);



  // Start/Stop voice listening helpers
  const startListening = useCallback((monitorOnly=false) => {
    if (!isCallActive || !greetingFinishedRef.current || micMutedRef.current ||
        (!monitorOnly && (isAiSpeakingRef.current || statusRef.current === 'thinking' || isProcessingTurnRef.current))) {
      return;
    }

    if(!monitorOnly){
      setStatus('listening');
      setTurn('user');
      activeTranscriptRef.current = '';
      lastTranscriptChangedAtRef.current = 0;
      hasSpeechSoundRef.current = false;
      audioChunksRef.current = [];
    }

    // Prefer Chrome's Persian recognition when available; local Diba is a fallback.
    const browserAvailable=Boolean(recognitionRef.current && !recognitionFailedRef.current && !webSpeechFailedRef.current && !preferLocalSttRef.current);
    const localReady=browserAvailable ? false : startDibaTurn();
    if (!localReady && !micMutedRef.current && recognitionRef.current && !isRecognitionActiveRef.current && !recognitionFailedRef.current) {
      try {
        recognitionRef.current.start();
        isRecognitionActiveRef.current = true;
      } catch(error:any) {
        // Chrome may still be finishing the previous recognizer; its onend
        // callback will restart monitoring. This is not a permanent failure.
        if(error?.name!=='InvalidStateError')recognitionFailedRef.current = true;
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
  }, [isCallActive, setStatus, startDibaTurn]);

  // Diba is a real local fallback, loaded only when Web Speech is unavailable
  // or has repeatedly lost its Persian network recognizer. It downloads in the
  // background while Chrome retries; it never blocks an active browser turn.
  const ensureDibaStt=useCallback(()=>{
    if(localSttModelRef.current){
      attachLocalStt();
      if((!recognitionRef.current||recognitionFailedRef.current||recognitionRetryRef.current>=2||preferLocalSttRef.current)&&
         greetingFinishedRef.current&&!micMutedRef.current){
        preferLocalSttRef.current=true;
        try{recognitionRef.current?.abort();}catch{}
        isRecognitionActiveRef.current=false;
        startListening(true);
        console.info('[FORZA_STT] source=diba fallback=ready');
      }
      return Promise.resolve(true);
    }
    if(localSttLoadRef.current)return localSttLoadRef.current;
    setLocalSttStatus('loading');
    const load=loadDibaSttModel().then(model=>{
      if(callClosedRef.current)return false;
      localSttModelRef.current=model;
      attachLocalStt();
      setLocalSttStatus('ready');
      if((!recognitionRef.current||recognitionFailedRef.current||recognitionRetryRef.current>=2||preferLocalSttRef.current)&&
         greetingFinishedRef.current&&!micMutedRef.current){
        preferLocalSttRef.current=true;
        try{recognitionRef.current?.abort();}catch{}
        isRecognitionActiveRef.current=false;
        startListening(true);
        console.info('[FORZA_STT] source=diba fallback=activated');
      }
      return true;
    }).catch(error=>{
      setLocalSttStatus('fallback');
      console.warn('[FORZA Diba] fallback_unavailable type='+
        String((error as any)?.name||'load_error').replace(/[^A-Za-z0-9_-]/g,'').slice(0,40));
      return false;
    }).finally(()=>{
      if(localSttLoadRef.current===load)localSttLoadRef.current=null;
    });
    localSttLoadRef.current=load;
    return load;
  },[attachLocalStt,startDibaTurn,startListening]);

  const startVoiceInput=useCallback(()=>{
    const browserUnavailable=!recognitionRef.current||recognitionFailedRef.current||
      webSpeechFailedRef.current||preferLocalSttRef.current;
    if(browserUnavailable&&!localSttModelRef.current&&serverSttConfiguredRef.current!==true){
      setMicrophoneError('در حال آماده‌سازی تشخیص گفتار فارسی...');
      void ensureDibaStt().then(ready=>{
        if(!ready&&!callClosedRef.current)
          setMicrophoneError('مدل تشخیص گفتار فارسی بارگذاری نشد؛ اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.');
        else if(ready)setMicrophoneError(null);
      });
      return;
    }
    startListening();
  },[ensureDibaStt,startListening]);

  const stopListening = useCallback(() => {
    localSttRecognizerRef.current?.remove?.();
    localSttRecognizerRef.current=null;
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
    let samples=new Uint8Array(512);
    // Mic end-of-turn must not depend on Three.js frames. On weak devices
    // the avatar can fall to 7 FPS while a 55ms audio poll remains active.
    // This timer is not a replacement for a future AudioWorklet VAD:
    // browsers may throttle background-tab timers.
    const check=()=>{
      if(!active)return;
      if(!greetingFinishedRef.current || micMutedRef.current ||
         (statusRef.current!=='listening' && !isProcessingTurnRef.current &&
          !isAiSpeakingRef.current&&!isManualReplayPendingRef.current)){
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
          // During TTS this is only a VAD *candidate*. WebSpeech/local STT
          // must provide non-echo words before cancelling the AI response.
          if(!isProcessingTurnRef.current)setIsUserSpeaking(true);
          else console.info('[FORZA_TURN] phase=barge-in-vad-candidate');
        }
        // 300-520ms after a complete question; incomplete thoughts and
        // explicit code corrections retain a longer safety window.
        if(isProcessingTurnRef.current){
          if(silenceTimerRef.current){clearTimeout(silenceTimerRef.current);silenceTimerRef.current=null;}
          return;
        }
        if(current.speaking){
          if(silenceTimerRef.current){
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current=null;
          }
        }else if(current.silenceMs>0 && hasSpeechSoundRef.current && !silenceTimerRef.current){
          const transcript=activeTranscriptRef.current.trim();
          const pauseMs=transcript
            ? forzaEndOfTurnPauseMs(transcript,speechInterimRef.current)
            : 700;
          const remaining=Math.max(80,pauseMs-current.silenceMs);
          const tryFinalize=()=>{
            silenceTimerRef.current=null;
            if(isProcessingTurnRef.current||isAiSpeakingRef.current||
               statusRef.current!=='listening'||micMutedRef.current)return;
            const candidate=activeTranscriptRef.current.trim();
            const acousticSilence=vadRef.current.silenceDuration(Date.now());
            const wait=candidate
              ? forzaTurnRemainingWaitMs(
                  candidate,speechInterimRef.current,
                  Date.now()-lastTranscriptChangedAtRef.current,
                  vadRef.current.heardSpeech?acousticSilence:null)
              : Math.max(0,1000-acousticSilence);
            if(wait>0){
              silenceTimerRef.current=window.setTimeout(tryFinalize,Math.max(80,wait));
              return;
            }
            setIsUserSpeaking(false);
            detectedSpeechEndAtRef.current=performance.now()-acousticSilence;
            console.info('[FORZA_LATENCY] phase=vad_end_detected silenceMs='+
              Math.round(acousticSilence));
            if(candidate){
              activeTranscriptRef.current='';
              lastTranscriptChangedAtRef.current=0;
              hasSpeechSoundRef.current=false;
              vadRef.current.reset();
              void handleUserFinishedSpeaking(candidate);
            }else if(mediaRecorderRef.current?.state==='recording'){
              // Preserve the server STT fallback when browser STT is unavailable.
              mediaRecorderRef.current.stop();
              vadRef.current.reset();
            }else{
              hasSpeechSoundRef.current=false;
              vadRef.current.reset();
            }
          };
          silenceTimerRef.current=window.setTimeout(tryFinalize,remaining);
        }
      }catch(err){
        console.warn('[FORZA] Audio analyser failed',(err as any)?.name||'audio_error');
      }
    };
    const micPoll=window.setInterval(check,55);
    return()=>{
      active=false;
      window.clearInterval(micPoll);
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

  // Streamed answer text must be visible as soon as each server chunk arrives.
  // Re-running a typewriter animation on every chunk hides the live response.
  useEffect(() => {
    setDisplayedAi(aiText || '');
  }, [aiText]);

  // Keep the first-audio wait observable instead of showing an indefinitely
  // frozen spinner while the CPU-based Pocket model is synthesizing speech.
  useEffect(() => {
    if (!voicePending) {
      setVoiceWaitSeconds(0);
      return;
    }
    const started = Date.now();
    setVoiceWaitSeconds(0);
    const timer = window.setInterval(() => {
      setVoiceWaitSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [voicePending]);

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
    manualReplayAbortRef.current?.abort(new Error('forza_manual_replay_stopped'));
    manualReplayAbortRef.current=null;
    isManualReplayPendingRef.current=false;
    continuousVoiceRef.current?.cancel();
    continuousVoiceRef.current=null;
    try { window.speechSynthesis?.cancel(); } catch {}
    const pending = pendingAudioResolveRef.current;
    pendingAudioResolveRef.current = null;
    pending?.();
    const source = currentBufferSourceRef.current;
    currentBufferSourceRef.current = null;
    try { source?.stop(); } catch {}
    isAiSpeakingRef.current = false;
    const a = audioElRef.current;
    if (a) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {}
    }
  }, []);

  const interruptCurrentTurn = useCallback(() => {
    const active=activeTurnRef.current;
    if(!active || active.abort.signal.aborted){
      // Manual replay has no LLM turn but must still be interruptible.
      if(continuousVoiceRef.current||isManualReplayPendingRef.current){
        stopAudio();
        setVoicePending(false);
        setVoiceStage('idle');
        setStatus('listening');
        setTurn('user');
      }
      return;
    }
    // Invalidate callbacks before aborting. The old finally must not cancel
    // the new user's microphone, player or response.
    activeTurnRef.current=null;
    active.abort.abort(new Error('forza_customer_interrupted'));
    stopAudio();
    // Preserve only the last 500ms of in-RAM mic pre-roll for the customer's
    // first syllables; older chunks may contain FORZA's own speaker output.
    audioChunksRef.current=audioChunksRef.current.slice(-2);
    // Playback cancellation has now measured a partially played WAV.
    active.markInterrupted?.();
    isProcessingTurnRef.current=false;
    isAiSpeakingRef.current=false;
    setVoicePending(false);
    setVoiceStage('idle');
    setStatus('listening');
    setTurn('user');
    setIsUserSpeaking(true);
    console.info('[FORZA_TURN] phase=customer-interrupt turn='+active.generation);
  },[stopAudio,setStatus]);
  interruptRequestRef.current=interruptCurrentTurn;

  useEffect(()=>{
    speakerMutedRef.current=isSpeakerMuted;
    continuousVoiceRef.current?.setMuted(isSpeakerMuted);
  },[isSpeakerMuted]);

  // Preserve the pre-recorded greeting and manual playback fallback.
  // Some browsers reject a valid Piper WAV in HTMLAudioElement but can decode it.
  const playDataUrl = useCallback((url: string): Promise<void> => new Promise((resolve,reject) => {
    if (!url) return reject(new Error('audio_missing'));
    stopAudio();
    let audio = audioElRef.current;
    if (!audio) {
      audio = new Audio();
      audioElRef.current = audio;
    }
    audio.pause();
    // Preserve the buffered, same-origin Pocket greeting; rewriting src forces
    // an unnecessary fetch exactly when the particles finish.
    if (audio.src !== new URL(url, window.location.href).href) audio.src = url;
    audio.muted = isSpeakerMuted;
    audio.volume = 1;
    let settled = false;
    let fallbackStarted = false;
    let startWatchdog: number | undefined;
    let endWatchdog: number | undefined;
    let cancelPending: () => void = () => {};
    const cleanup = () => {
      audio.removeEventListener('ended', ended);
      audio.removeEventListener('error', failed);
      audio.removeEventListener('playing', playing);
    };
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      if(startWatchdog !== undefined) window.clearTimeout(startWatchdog);
      if(endWatchdog !== undefined) window.clearTimeout(endWatchdog);
      cleanup();
      if (pendingAudioResolveRef.current === cancelPending) pendingAudioResolveRef.current = null;
      isAiSpeakingRef.current = false;
      if (err) reject(err);
      else resolve();
    };
    cancelPending = () => finish();
    pendingAudioResolveRef.current = cancelPending;
    const playing = () => {
      if(settled)return;
      if(startWatchdog !== undefined) window.clearTimeout(startWatchdog);
      if(endWatchdog === undefined) {
        const duration = Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration * 1000 + 6000 : 45000;
        endWatchdog = window.setTimeout(
          () => finish(new Error('amir_audio_end_timeout')),
          Math.min(90000, Math.max(10000, duration)),
        );
      }
      isAiSpeakingRef.current = true;
      setVoicePending(false);
      setStatus('speaking');
      setTurn('ai');
      setAutoplayBlocked(false);
      setPendingAudioUrl(null);
    };
    const ended = () => finish();
    const playViaWebAudio = async () => {
      const ctx = ensureCtx();
      if (!ctx) throw new Error('audio_context_unavailable');
      if (ctx.state === 'suspended') await ctx.resume();
      if (settled) return;
      const response = await fetch(url);
      if (!response.ok) throw new Error('audio_blob_unreadable');
      const decoded = await ctx.decodeAudioData(await response.arrayBuffer());
      if (settled) return;
      const source = ctx.createBufferSource();
      source.buffer = decoded;
      source.connect(ctx.destination);
      currentBufferSourceRef.current = source;
      source.onended = () => {
        if (currentBufferSourceRef.current === source) currentBufferSourceRef.current = null;
        finish();
      };
      playing();
      source.start(0);
    };
    const failed = () => {
      if (settled || fallbackStarted) return;
      audio.pause();
      fallbackStarted = true;
      cleanup();
      void playViaWebAudio().catch((error: any) => {
        console.warn('[FORZA audio] HTMLAudio and WebAudio playback failed', error?.name || error?.message || 'audio_error');
        finish(new Error('audio-playback-failed'));
      });
    };
    audio.addEventListener('ended', ended);
    audio.addEventListener('error', failed);
    audio.addEventListener('playing', playing);
    startWatchdog = window.setTimeout(() => {
      if(!settled && !isAiSpeakingRef.current) {
        console.warn('[FORZA Audio] playback did not start before watchdog');
        failed();
        // WebAudio recovery is also bounded, even when suspended.
        window.setTimeout(() => {
          if(!settled) finish(new Error('amir_audio_start_timeout'));
        }, 5000);
      }
    }, 6500);
    void audio.play().then(playing).catch((error: any) => {
      if (settled) return;
      if (error?.name === 'NotAllowedError') {
        // Respect browser autoplay policy; the visible CTA is only used when required.
        setAutoplayBlocked(true);
        setPendingAudioUrl(url);
        finish(new Error('autoplay_permission_required'));
      } else {
        failed();
      }
    });
  }), [ensureCtx, isSpeakerMuted, setStatus, stopAudio]);


  // Exactly one full answer per turn. Do not split at punctuation, SSE tokens,
  // words or phoneme phrases in the browser. This is the SAME original Pocket
  // Farsi voice /speak service, not browser SpeechSynthesis or a new model.
  // WAV stays in RAM: no browser audio cache or blob URL files.
  const requestPocketAudio=useCallback(async(
    answer:string,
    signal?:AbortSignal,
    turnId?:string,
  ):Promise<Uint8Array>=>{
    const text=answer.trim();
    if(!text)throw new Error('forza_empty_answer');
    const started=performance.now();
    const response=await fetch('/api/ai/forza-speech',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text,turnId}),
      signal:signal
        ? AbortSignal.any([signal,AbortSignal.timeout(420000)])
        : AbortSignal.timeout(420000),
    });
    if(!response.ok)throw new Error('pocket_http_'+response.status);
    if(response.headers.get('X-Forza-Voice')!==voiceModeRef.current)
      throw new Error('forza_original_pocket_voice_required');
    if(!(response.headers.get('Content-Type')||'').includes('audio/wav'))
      throw new Error('forza_pocket_full_answer_not_wav');
    const wavHeadersAt=performance.now();
    const audio=new Uint8Array(await response.arrayBuffer());
    console.info('[FORZA_TTS_STAGE] turn='+String(turnId||'unknown')+
      ' phase=wave_received clientMs='+Math.round(performance.now()-started)+
      ' headerWaitMs='+Math.round(wavHeadersAt-started)+
      ' transferMs='+Math.round(performance.now()-wavHeadersAt)+
      ' workerQueueMs='+String(response.headers.get('X-Forza-Queue-Ms')||'unknown')+
      ' workerInferenceMs='+String(response.headers.get('X-Forza-Inference-Ms')||'unknown')+
      ' bytes='+audio.byteLength);
    if(audio.byteLength<44||audio.byteLength>8_000_000 ||
       String.fromCharCode(...audio.subarray(0,4))!=='RIFF' ||
       String.fromCharCode(...audio.subarray(8,12))!=='WAVE')
      throw new Error('forza_invalid_full_answer_wav');
    if(signal?.aborted || callClosedRef.current)throw new Error('forza_tts_aborted');
    if(voiceModeRef.current==='piper-nima-gyro-medium'){
      console.info('[FORZA_LATENCY] phase=nima-phrase-wav-ready ms='+
        Math.round(performance.now()-started)+' chars='+text.length+
        ' bytes='+audio.byteLength);
    }else{
      console.info('[FORZA_LATENCY] phase=whole-pocket-wav-ready ms='+
        Math.round(performance.now()-started)+' chars='+text.length+
        ' bytes='+audio.byteLength);
    }
    return audio;
  },[]);

  const playPocketFullAnswer=useCallback(async(
    answer:string,
    player:ForzaContinuousWav,
    signal?:AbortSignal,
  ):Promise<void>=>{
    // One HTTP POST, one RIFF/WAVE, one AudioBufferSource: no waiting
    // for a second generated packet mid-sentence, including punctuation.
    const audio=await requestPocketAudio(answer,signal);
    if(signal?.aborted || callClosedRef.current)return;
    await player.enqueueWav(audio);
    console.info('[FORZA_LATENCY] phase=whole-pocket-playback-finished '+
      'audio_buffers=1 underruns='+player.underrunCount);
  },[requestPocketAudio]);

  const playSpeechPhrase=useCallback(async(phrase:string):Promise<void>=>{
    continuousVoiceRef.current?.cancel();
    const controller=new AbortController();
    manualReplayAbortRef.current=controller;
    isManualReplayPendingRef.current=true;
    const player=new ForzaContinuousWav(ensureCtx,()=>{
      isAiSpeakingRef.current=true;
      setVoicePending(false);
      setStatus('speaking');
      setTurn('ai');
    },ms=>console.warn('[FORZA_AUDIO_UNDERRUN] wait_ms='+ms));
    player.setMuted(isSpeakerMuted);
    continuousVoiceRef.current=player;
    try{
      await playPocketFullAnswer(phrase,player,controller.signal);
      if(!callClosedRef.current&&!controller.signal.aborted)setVoiceOutputError(null);
    }catch(error:any){
      if(!callClosedRef.current&&!controller.signal.aborted)setVoiceOutputError(
        error?.message==='autoplay_permission_required'
          ?'برای پخش صوت یک‌بار صفحه را لمس کنید.'
          :'صدای FORZA از سرور Ubuntu دریافت نشد؛ متن پاسخ نمایش داده شده است.');
      if(!controller.signal.aborted)
        console.warn('[FORZA Pocket Ubuntu] phrase failed',String(error?.message||'error').slice(0,90));
      throw error;
    }finally{
      player.cancel();
      if(continuousVoiceRef.current===player)continuousVoiceRef.current=null;
      if(manualReplayAbortRef.current===controller){
        manualReplayAbortRef.current=null;
        isManualReplayPendingRef.current=false;
        isAiSpeakingRef.current=false;
      }
    }
  },[ensureCtx,isSpeakerMuted,playPocketFullAnswer,setStatus]);

  const speakText = useCallback(async (text: string) => {
    if(text===GREETING_TEXT){
      stopListening();
    }else{
      // Manual replay must remain interruptible, including while generating.
      heardSpeechEchoRef.current=text;
      isManualReplayPendingRef.current=true;
      startListening(true);
    }
    setVoiceOutputError(null);
    setStatus(text === GREETING_TEXT ? 'idle' : 'thinking');
    setTurn('ai');

    if (text === GREETING_TEXT) {
      // The exact greeting was synthesized by Pocket Farsi v2 at image build time.
      // No model download or inference is needed at the 100% particle event.
      const url = '/forza-greeting-bootstrap.wav';
      await playDataUrl(url);
      console.info('[FORZA greeting] Pocket Farsi v2 prerecorded welcome finished');
      return;
    }

    // Request and play one complete WAV. No network/player chunk boundaries.
    if(text.trim())await playSpeechPhrase(text.trim());
  }, [playSpeechPhrase,setStatus,stopListening,startListening]);

  const replayAiVoice = useCallback(async () => {
    const text = aiText.trim();
    if (!text) return;
    setVoiceOutputError(null);
    // Replay triggers fresh synthesis. Customer audio never remains cached.
    try {
      await speakText(text);
    } catch (error:any) {
      // An intentional customer interruption is not a TTS outage.
      const code=String(error?.message||error?.name||'');
      if(!/aborted|stopped|interrupted|cancelled/i.test(code))
        setVoiceOutputError(code === 'autoplay_permission_required'
          ? 'برای پخش صدا، یک بار صفحه را لمس یا کلیک کنید.'
          : 'صدای فورزا از سرویس صوتی در دسترس نیست؛ اتصال Ubuntu را بررسی کنید.');
    } finally {
      if(greetingFinishedRef.current && !isProcessingTurnRef.current &&
         !activeTranscriptRef.current.trim())startVoiceInput();
    }
  },[aiText,playDataUrl,speakText,startVoiceInput,stopListening]);

  // A user gesture permits browser audio, but it never skips the greeting.
  const unlockAudio = useCallback(() => {
    ensureCtx();
    setVoiceOutputError(null);
    setGreetingPhase('preparing');
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
          startVoiceInput();
        })
        .catch((error:any)=>{
          console.warn('[FORZA] User-initiated greeting failed',error?.message||'audio_error');
          setGreetingPhase('needs-permission');setAutoplayBlocked(true);setStatus('idle');
          setVoiceOutputError('پخش صدای خوشامدگویی انجام نشد؛ لطفاً مجدداً تلاش کنید.');
        });
    } else {
      setAutoplayBlocked(false);
      if(!greetingFinishedRef.current) {
        void speakText(GREETING_TEXT).then(()=>{
          greetingFinishedRef.current=true;
          setGreetingPhase('complete');
          setStatus('listening');
          setTurn('user');
          startVoiceInput();
        }).catch((error:any)=>{
          console.warn('[FORZA] User-initiated greeting failed',error?.message||'audio_error');
          setGreetingPhase('needs-permission');setAutoplayBlocked(true);setStatus('idle');
          setVoiceOutputError('پخش صدای خوشامدگویی انجام نشد؛ لطفاً مجدداً تلاش کنید.');
        });
      }
    }
  },[ensureCtx,pendingAudioUrl,playDataUrl,setStatus,startVoiceInput,speakText]);

  // Turn management: send speech/query to AI & worker
  const handleUserFinishedSpeaking = useCallback(
    async (textToSend?: string, audioBlob?: Blob, audioMime?: string) => {
      const q = (textToSend || '').trim();
      if (!q && !audioBlob) return;
      if (!greetingFinishedRef.current) return;
      if (isAiSpeakingRef.current || statusRef.current === 'thinking' || isProcessingTurnRef.current) {
        // A typed correction or stop command must not be locked out while
        // FORZA is generating or playing the previous answer.
        if(!q)return;
        interruptCurrentTurn();
      }
      if(q && forzaTurnIntent(q)==='stop'){
        // A pure stop command should not trigger an extra AI response.
        setUserText(q);
        setIsUserSpeaking(false);
        setStatus('listening');
        setTurn('user');
        activeTranscriptRef.current='';
        // Keep Chrome's cumulative recognition from replaying the stop words
        // as the next customer turn when the recognizer remains active.
        recognitionConsumedCountRef.current=recognitionResultCountRef.current;
        localSttFinalRef.current='';
        lastTranscriptChangedAtRef.current=0;
        vadRef.current.reset();
        return;
      }

      // Chrome keeps final results from older turns while recognition stays
      // open to hear interruptions. Mark them consumed instead of stopping
      // and restarting the mic (which drops first syllables).
      recognitionConsumedCountRef.current=recognitionResultCountRef.current;
      localSttFinalRef.current='';
      heardSpeechEchoRef.current='';
      lastForzaPlaybackAtRef.current=0;
      isProcessingTurnRef.current = true;
      setVoicePending(false);
      setVoiceStage('text');
      setErrorNotice(null);
      // Keep browser/local recognition and mic recording alive during the
      // model request. Stopping then immediately restarting WebSpeech loses
      // the first syllable of a customer interruption on some browsers.
      // Only the previous transcript is cleared; VAD resets below.
      // No audio-unlock call here: it can accidentally replay the introduction
      // while the customer's recording is being submitted.
      setStatus('thinking');
      setTurn('ai');
      // Never display the previous answer as if it belonged to this turn.
      // As soon as the first SSE token arrives, it replaces this empty area.
      setAiText('');
      setDisplayedAi('');
      activeTranscriptRef.current = '';

      if (q) {
        setUserText(q);
      } else {
        // The raw-audio fallback cannot invent a transcript before recognition;
        // keep previously displayed live words instead of replacing them with
        // a misleading "receiving/sending audio" spinner.
        setUserText(previous=>previous.trim());
      }

      const pocketAbort=new AbortController();
      const generation=++generationRef.current;
      activeTurnRef.current={generation,abort:pocketAbort};
      console.info('[FORZA_TURN] turn='+generation+
        ' phase=request_preparation_end_to_turn_ms='+
        (detectedSpeechEndAtRef.current?Math.round(performance.now()-detectedSpeechEndAtRef.current):-1));
      vadRef.current.reset();
      startListening(true); // monitor barge-in, without changing the AI status
      let playerForTurn:ForzaContinuousWav|null=null;
      let bufferedNima:ForzaNimaBufferedSpeech|null=null;
      let terminalIdleTimer:number|null=null;
      let acknowledgementTimer:number|null=null;
      try {
        const payload: any = {
          history: historyRef.current.slice(-8),
          // First deliver the exact AI words; synthesize audio as a second step.
          deferAudio: true,
        };

        if (q) {
          payload.query = q;
        }

        if (audioBlob) {
          // Avoid a guaranteed futile 15-second transcription attempt when
          // Chrome STT failed and the optional server provider is disabled.
          // If provider discovery was unavailable, retain existing fallback.
          if(serverSttConfiguredRef.current===false){
            console.warn('[FORZA_STT] source=server fallback_not_configured=1');
            throw new Error('تشخیص گفتار سروری فعال نیست و مرورگر نتوانست صحبت شما را به متن تبدیل کند. فعلاً از «تایپ پیام متنی» استفاده کنید.');
          }
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
          });
          reader.readAsDataURL(audioBlob);
          const audioBase64 = extractForzaAudioBase64(await base64Promise);
          // Transcribe speech first so the customer's exact words appear
          // immediately, before waiting on AI generation and spoken output.
          const sttStartedAt=performance.now();
          const sttAbort=new AbortController();
          const sttTimer=window.setTimeout(()=>sttAbort.abort(new Error('تبدیل گفتار به متن بیش از حد طول کشید؛ لطفاً سؤال را تایپ کنید.')),15000);
          let sttResponse:Response;
          let sttData:any;
          try {
            sttResponse = await fetch('/api/ai/forza-live', {
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body:JSON.stringify({
                audioBase64,
                audioMimeType:audioMime || audioBlob.type || 'audio/webm',
                transcribeOnly:true,
              }),
              signal:AbortSignal.any([sttAbort.signal,pocketAbort.signal]),
            });
            sttData = await sttResponse.json().catch(()=>null);
          } finally {
            window.clearTimeout(sttTimer);
          }
          if(!sttResponse.ok || !sttData?.success || !String(sttData.userTranscript||'').trim()){
            console.warn('[FORZA_STT] source=server failure status='+sttResponse.status+
              ' code='+String(sttData?.errorCode||'unknown').slice(0,60)+
              ' duration_ms='+Math.round(performance.now()-sttStartedAt));
            throw new Error(sttData?.error||'سرویس تشخیص گفتار پاسخ نداد؛ لطفاً سؤال را تایپ کنید.');
          }
          console.info('[FORZA_STT] turn='+generation+' source=server duration_ms='+
            Math.round(performance.now()-sttStartedAt)+' transcript_chars='+
            String(sttData.userTranscript).trim().length);
          payload.query = String(sttData.userTranscript).trim();
          setUserText(payload.query);
          setMicrophoneError(null);
        }

        // Render every incoming SSE delta immediately; the selected Nima
        // engine voices complete word groups before the LLM reply finishes.
        // Pocket fallback retains its one-request full-answer path.
        const turnStartedAt=performance.now();
        const previousHistory=historyRef.current.slice(-8);
        const resolvedUserQuery=String(payload.query||q).trim();
        if(resolvedUserQuery){
          setUserText(resolvedUserQuery);
          historyRef.current.push({role:'user',text:resolvedUserQuery});
        }
        let reply='';
        let firstTextDelivered=false;
        let firstPlaybackLogged=false;
        let heardEntry:Turn|null=null;
        let interruptedPhrase:{text:string;playedMs:number;durationMs:number}|null=null;
        const recordHeard=(phrase:string)=>{
          if(speakerMutedRef.current)return;
          if(activeTurnRef.current?.generation!==generation || pocketAbort.signal.aborted)return;
          if(!phrase.trim())return;
          if(!heardEntry){
            heardEntry={role:'model',text:''};
            historyRef.current.push(heardEntry);
          }
          heardEntry.text=[heardEntry.text,phrase.trim()].filter(Boolean).join(' ').trim();
        };
        if(activeTurnRef.current?.generation===generation){
          activeTurnRef.current.markInterrupted=()=>{
            if(!reply)return;
            const partial=interruptedPhrase;
            const note=partial
              ? 'عبارت «'+partial.text+'» فقط '+Math.round(partial.playedMs)+
                ' از '+Math.round(partial.durationMs)+' میلی‌ثانیه پخش شد و کامل شنیده‌شده نیست.'
              : 'عبارت جدیدِ در حال ساخت یا صف، پخش کامل نداشته است.';
            historyRef.current.push({role:'model',
              text:'[پاسخ قطع شد. فقط عبارت‌های کاملِ قبلی شنیده‌شده محسوب شوند. '+
                note+' اگر کاربر گفت ادامه بده از آخرین عبارت کامل شروع کن؛ متن ساخته‌شده بعدی را شنیده‌شده فرض نکن.]'});
          };
        }
        continuousVoiceRef.current?.cancel();
        const continuousPlayer=new ForzaContinuousWav(
          ensureCtx,
          ()=>{
            if(activeTurnRef.current?.generation!==generation)return;
            isAiSpeakingRef.current=true;
            lastForzaPlaybackAtRef.current=Date.now();
            setVoicePending(false);
            setVoiceStage('playing');
            setStatus('speaking');
            setTurn('ai');
          },
          ms=>console.warn('[FORZA_AUDIO_UNDERRUN] turn='+generation+' wait_ms='+ms+
            ' cause=next_wav_arrived_after_previous_playback'),
          ()=>{
            if(activeTurnRef.current?.generation!==generation)return;
            isAiSpeakingRef.current=false;
            setVoicePending(true);
            setVoiceStage('buffering');
            setStatus('thinking');
          },
          (stage,ms)=>{
            if(stage==='playback_started'&&!firstPlaybackLogged){
              firstPlaybackLogged=true;
              if(detectedSpeechEndAtRef.current>0){
                const latency=Math.round(performance.now()-detectedSpeechEndAtRef.current);
                const samples=endToPlaybackSamplesRef.current;
                samples.push(latency);
                if(samples.length>200)samples.shift();
                const ordered=[...samples].sort((a,b)=>a-b);
                const median=ordered[Math.floor((ordered.length-1)*0.5)];
                const p95=ordered[Math.ceil(ordered.length*0.95)-1];
                const mean=Math.round(ordered.reduce((sum,ms)=>sum+ms,0)/ordered.length);
                console.info('[FORZA_END_TO_AUDIO] turn='+generation+' ms='+latency+
                  ' n='+ordered.length+' meanMs='+mean+' medianMs='+median+' p95Ms='+p95+
                  ' estimatedAudioEnd=1 noPrivateContent=1');
              }
            }
            console.info('[FORZA_AUDIO_STAGE] turn='+generation+
              ' phase='+stage+' ms='+ms+' clientMs='+Math.round(performance.now()-turnStartedAt)+
              ' endToPlaybackMs='+(stage==='playback_started'&&detectedSpeechEndAtRef.current
                ? Math.round(performance.now()-detectedSpeechEndAtRef.current):-1));
          },
        );
        playerForTurn=continuousPlayer;
        continuousPlayer.setMuted(isSpeakerMuted);
        continuousVoiceRef.current=continuousPlayer;
        // Nima: group *complete words* across punctuation, so a full stop
        // never forces its own neural WAV or an avoidable gap. Stream tokens
        // to subtitles immediately and keep the Pocket fallback unchanged.
        const useNima=voiceModeRef.current==='piper-nima-gyro-medium';
        let firstNimaPhraseReady=false;
        let acknowledgementQueued=false;
        const phrasePlanner=new ForzaIncrementalSpeechText();
        const callPlainText=new ForzaCallPlainText();
        // Text updates are displayed immediately. Piper gets its first small,
        // completed word group while SSE continues, then synthesizes further
        // phrases in bounded lookahead on the same AudioContext clock.
        // Begin the first ready WAV with only a tiny optional buffer hold.
        bufferedNima=new ForzaNimaBufferedSpeech({
          synthesize:(phrase,signal)=>requestPocketAudio(forzaSpokenPlainText(phrase),signal,
            'call-'+callIdRef.current+'-turn-'+generation),
          player:continuousPlayer,
          signal:pocketAbort.signal,
          onPhrasePlayed:recordHeard,
          onPhraseReady:info=>{
            if(activeTurnRef.current?.generation!==generation)return;
            if(info.index===0){
              firstNimaPhraseReady=true;
              if(acknowledgementTimer!==null&&!acknowledgementQueued){
                window.clearTimeout(acknowledgementTimer);
                acknowledgementTimer=null;
              }
            }
            console.info('[FORZA_TTS_STAGE] turn='+generation+
              ' phase=phrase_wav_ready index='+info.index+
              ' queueClientMs='+info.waitMs+' requestClientMs='+info.fetchMs+
              ' wavBytes='+info.wavBytes+' wavDurationMs='+info.durationMs);
          },
          onPhraseProgress:(phrase,progress)=>{
            if(progress.phase==='started'){
              heardSpeechEchoRef.current=phrase;
              lastForzaPlaybackAtRef.current=Date.now();
            }else if(progress.phase==='finished'){
              lastForzaPlaybackAtRef.current=Date.now();
            }
            if(progress.phase==='interrupted' && progress.playedMs>0 &&
               progress.playedMs<progress.durationMs && !speakerMutedRef.current){
              interruptedPhrase={text:phrase,playedMs:progress.playedMs,
                durationMs:progress.durationMs};
            }
          },
          maxConcurrent:2,
          initialBufferSeconds:0.35,
          maximumInitialWaitMs:40,
          onBuffered:info=>console.info('[FORZA_NIMA_BUFFER] audio_s='+
            info.bufferedSeconds.toFixed(2)+' phrases='+info.queuedPhrases+
            ' started='+Number(info.started)),
        });
        const activeNimaBuffer=bufferedNima;
        // A provider may delay the SSE done event after the complete text
        // appears. A short idle flush avoids waiting seconds to voice the
        // final completed sentence. The timer is cancelled on further deltas,
        // turn completion, interruption, and any error.
        let firstPhraseQueued=false;
        const queueSpeech=(phrase:string)=>{
          if(activeTurnRef.current?.generation!==generation || pocketAbort.signal.aborted)return;
          if(!firstPhraseQueued){
            firstPhraseQueued=true;
            setVoiceStage('synthesizing');
            console.info('[FORZA_NIMA_LATENCY] phase=first-tts-phrase-queued clientMs='+
              Math.round(performance.now()-turnStartedAt)+' turn='+generation+' chars='+phrase.length);
          }
          activeNimaBuffer.add(phrase);
        };
        const normalizedAckQuery=resolvedUserQuery
          .replace(/[ي]/g,'ی').replace(/[ك]/g,'ک').replace(/[،,؛;:!?؟.!]+/g,' ').replace(/\s+/g,' ').trim();
        const shortAckOnly=/^(?:سلام|درود|ممنون|ممنونم|متشکرم|سپاس|مرسی|خوبی|حالت چطوره|بله|باشه)(?: وقت بخیر)?$/u.test(normalizedAckQuery);
        if(useNima&&!isSpeakerMuted&&!shortAckOnly&&normalizedAckQuery.length>=12&&nimaAckWavRef.current){
          acknowledgementTimer=window.setTimeout(()=>{
            acknowledgementTimer=null;
            const wav=nimaAckWavRef.current;
            if(!wav||firstNimaPhraseReady||acknowledgementQueued||pocketAbort.signal.aborted||
               activeTurnRef.current?.generation!==generation||speakerMutedRef.current)return;
            acknowledgementQueued=true;
            console.info('[FORZA_NIMA_ACK] phase=scheduled turn='+generation+
              ' afterEndMs='+Math.round(performance.now()-turnStartedAt));
            void continuousPlayer.enqueueWav(wav).catch(error=>{
              if(!pocketAbort.signal.aborted)
                console.warn('[FORZA_NIMA_ACK] playback_unavailable type='+
                  String((error as any)?.name||'audio_error').slice(0,40));
            });
          },320);
        }
        const onTextChunk=(_chunk:string,fullText:string)=>{
          if(activeTurnRef.current?.generation!==generation || pocketAbort.signal.aborted)return;
          reply=callPlainText.push(fullText);
          if(!firstTextDelivered&&reply.trim()){
            firstTextDelivered=true;
            console.info('[FORZA_LATENCY] phase=first-text turn='+generation+
              ' clientMs='+Math.round(performance.now()-turnStartedAt));
            setVoicePending(true);
          }
          setAiText(reply);
          if(useNima){
            // Enforce monotonic SSE text; never speak a revised/duplicate
            // segment after the consumer has already heard its predecessor.
            if(terminalIdleTimer!==null){
              window.clearTimeout(terminalIdleTimer);
              terminalIdleTimer=null;
            }
            for(const phrase of phrasePlanner.push(reply))queueSpeech(phrase);
            // Flush complete held groups after a bounded provider idle, even
            // if the answer has not reached its final punctuation or SSE done.
            // Incomplete suffix words and unfinished part codes remain held.
            terminalIdleTimer=window.setTimeout(()=>{
              terminalIdleTimer=null;
              if(pocketAbort.signal.aborted||callClosedRef.current||
                 activeTurnRef.current?.generation!==generation)return;
              const completed=/[.!؟؛]\s*$/.test(reply)
                ? phrasePlanner.flushTerminalIdle()
                : phrasePlanner.flushStableIdle();
              if(completed.length){
                console.info('[FORZA_NIMA_FINAL] bounded_idle_flush=1 chars='+
                  completed.reduce((sum,phrase)=>sum+phrase.length,0));
                for(const phrase of completed)queueSpeech(phrase);
              }
            },160);
          }
        };
        try {
          const streamController=new AbortController();
          let streamTimer=window.setTimeout(()=>streamController.abort(new Error('شروع دریافت پاسخ هوش مصنوعی بیش از حد طول کشید.')),30000);
          const totalTimer=window.setTimeout(()=>streamController.abort(new Error('دریافت متن پاسخ هوش مصنوعی بیش از دو دقیقه طول کشید.')),120000);
          try{
            console.info('[FORZA_LATENCY] phase=llm_request_sent turn='+generation+
              ' endToRequestMs='+(detectedSpeechEndAtRef.current
                ? Math.round(performance.now()-detectedSpeechEndAtRef.current):-1));
            const streamRes=await fetch('/api/ai/consult-stream',{
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body:JSON.stringify({
                query:resolvedUserQuery,
                history:previousHistory,
                includeAudio:false,
                mode:'forza',
                userTurnId:'call-'+callIdRef.current+'-turn-'+generation,
                responseId:'call-'+callIdRef.current+'-response-'+generation,
              }),
              signal:AbortSignal.any([streamController.signal,pocketAbort.signal]),
            });
            console.info('[FORZA_LATENCY] phase=sse_headers turn='+generation+
              ' clientMs='+Math.round(performance.now()-turnStartedAt)+
              ' http='+streamRes.status);
            const rawFinal=await consumeForzaTextStream(streamRes,(chunk,fullText)=>{
              window.clearTimeout(streamTimer);
              streamTimer=window.setTimeout(()=>streamController.abort(new Error('ارتباط متن هوش مصنوعی بیش از ۴۵ ثانیه بدون داده ماند.')),45000);
              onTextChunk(chunk,fullText);
            },(stage,info)=>{
              const code=String(info?.code||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,48);
              const provider=String(info?.provider||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,32);
              // Client and server clocks are NOT assumed synchronized. Match
              // the same turn id in Node logs to separate transport, model
              // TTFT, TTS queue, inference, WAV transfer and audio decode.
              console.info('[FORZA_TEXT_STAGE] turn='+generation+' phase=browser_'+stage+
                ' clientMs='+Math.round(performance.now()-turnStartedAt)+
                (provider?' provider='+provider:'')+(code?' code='+code:''));
            });
            reply=callPlainText.complete(rawFinal);
            if(!reply)throw new Error('forza_empty_stream');
          }finally{
            window.clearTimeout(streamTimer);
            window.clearTimeout(totalTimer);
          }
        } catch(streamError) {
          if(pocketAbort.signal.aborted||activeTurnRef.current?.generation!==generation)throw streamError;
          // Keep the existing complete-response route as a compatibility
          // fallback when streaming has not begun at all.
          if (reply) {
            // An interrupted or incomplete SSE is not a complete answer.
            // Never send the visible partial transcript to the TTS engine.
            console.warn('[FORZA] Text stream incomplete; refusing unverified trailing speech');
            // Do not allow an incomplete source to keep playing stale queued
            // audio. History stores only WAVs actually completed before this
            // interruption, not all text displayed in the subtitle.
            playerForTurn?.cancel();
            activeTurnRef.current?.markInterrupted?.();
            throw new Error('جریان پاسخ هوش مصنوعی ناقص ماند؛ متن دریافت‌شده حفظ شد. می‌توانید سؤال را دوباره بپرسید یا ادامه دهید.');
          } else {
          const fallbackAbort=new AbortController();
          const fallbackTimer=window.setTimeout(()=>fallbackAbort.abort(new Error('سرور هوش مصنوعی پاسخ نداد؛ دوباره تلاش کنید.')),15000);
          let res:Response;
          let data:any;
          try {
            res=await fetch('/api/ai/forza-live',{
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body:JSON.stringify(payload),
              signal:AbortSignal.any([fallbackAbort.signal,pocketAbort.signal]),
            });
            data=await res.json().catch(()=>null);
          } finally {
            window.clearTimeout(fallbackTimer);
          }
          if (!res.ok || !data?.success) throw new Error(data?.error||'server-error');
          const rawFallback = String(data.text||'').trim();
          if (!rawFallback) throw new Error('forza_empty_response');
          onTextChunk(rawFallback,rawFallback);
          reply=callPlainText.complete(rawFallback);
          }
        }
        if(reply && activeTurnRef.current?.generation===generation && !pocketAbort.signal.aborted){
          setAiText(reply);
          try {
            console.info('[FORZA_LATENCY] phase=whole-answer-tts-request '+
              'clientMs='+Math.round(performance.now()-turnStartedAt)+
              ' chars='+reply.length);
            if(useNima){
              if(terminalIdleTimer!==null){
                window.clearTimeout(terminalIdleTimer);
                terminalIdleTimer=null;
              }
              const finalPhrases=phrasePlanner.complete(reply);
              console.info('[FORZA_NIMA_FINAL] coalesced_phrases='+finalPhrases.length+
                ' final_chars='+(finalPhrases.at(-1)?.length||0));
              for(const phrase of finalPhrases)queueSpeech(phrase);
              await activeNimaBuffer.finish();
              console.info('[FORZA_LATENCY] phase=nima-incremental-finished phrases='+
                activeNimaBuffer.statistics.scheduled+
                ' audio_s='+activeNimaBuffer.statistics.totalBufferedSeconds.toFixed(2)+
                ' underruns='+continuousPlayer.underrunCount);
            }else{
              heardSpeechEchoRef.current=reply;
              await playPocketFullAnswer(forzaSpokenPlainText(reply),continuousPlayer,pocketAbort.signal);
              recordHeard(reply);
            }
            if(!callClosedRef.current&&activeTurnRef.current?.generation===generation)
              setVoiceOutputError(null);
          }catch(error:any){
            if(activeTurnRef.current?.generation===generation && !pocketAbort.signal.aborted)
              setVoiceStage('error');
            console.warn('[FORZA_TTS_DIAG] stage=turn-failed code='+
              String(error?.message||'unknown').slice(0,100));
            if(!callClosedRef.current&&activeTurnRef.current?.generation===generation)
              setVoiceOutputError(
              error?.message==='autoplay_permission_required'
                ?'برای پخش صوت یک‌بار صفحه را لمس کنید.'
                :error?.message==='pocket_http_429'
                  ?'ظرفیت موقت سرویس صوتی تکمیل است. کمی بعد دوباره تلاش کنید؛ متن پاسخ حفظ شده است.'
                  :'تولید یا پخش صدای کامل FORZA انجام نشد؛ متن پاسخ همچنان نمایش داده شده است.');
          }
        }
      } catch (err: any) {
        if(pocketAbort.signal.aborted||activeTurnRef.current?.generation!==generation)return;
        console.warn('[AI FORZA] Conversational turn failed:', err?.message || 'unknown');
        // A speech-recognition failure is not a TTS/playback failure.
        if (!q) setUserText(previous=>previous.trim());
        setErrorNotice(
          String(err?.message || 'پاسخ هوش مصنوعی در دسترس نیست؛ لطفاً دوباره تلاش کنید.').slice(0, 230)
        );
      } finally {
        // Cancel an in-flight private voice HTTP request if the AI turn
        // failed, the user interrupted it, or the call was closed.
        // This never stops/replaces the actual Pocket voice container.
        pocketAbort.abort();
        if(terminalIdleTimer!==null)window.clearTimeout(terminalIdleTimer);
        if(acknowledgementTimer!==null)window.clearTimeout(acknowledgementTimer);
        bufferedNima?.cancel();
        playerForTurn?.cancel();
        if(activeTurnRef.current?.generation!==generation)return;
        activeTurnRef.current=null;
        setVoiceStage('idle');
        if(continuousVoiceRef.current===playerForTurn)continuousVoiceRef.current=null;
        isAiSpeakingRef.current=false;
        setVoicePending(false);
        isProcessingTurnRef.current = false;
        setStatus('listening');
        setTurn('user');
        startVoiceInput();
      }
    },
    [setStatus, startListening, startVoiceInput, stopListening,interruptCurrentTurn,playPocketFullAnswer,requestPocketAudio,ensureCtx,isSpeakerMuted]
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
            // 2-second in-RAM pre-roll while FORZA is responding. No disk
            // persistence; preserve the first user syllables after barge-in.
            // Hard RAM cap also while the customer leaves the microphone
            // open for hours. Keep 45s for optional post-recording STT and a
            // 2s tail during model speech to reduce memory and self-echo.
            const maxChunks=isProcessingTurnRef.current?8:180;
            if(audioChunksRef.current.length>maxChunks)
              audioChunksRef.current.splice(0,audioChunksRef.current.length-maxChunks);
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
            // MediaRecorder.stop() is asynchronous. Resume RAM-only monitor
            // capture after the previous turn's recorder has actually stopped.
            if(!micMutedRef.current && streamRef.current?.active && mr.state==='inactive'){
              try{mr.start(250);}catch{}
            }
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
            // Do not send a doomed 15s server-transcription request while the
            // local Persian fallback is still downloading after WebSpeech failed.
            if(localSttLoadRef.current&&!localSttRecognizerRef.current&&serverSttConfiguredRef.current!==true){
              setMicrophoneError('تشخیص فارسی در حال آماده‌سازی است؛ لطفاً پس از آماده‌شدن دوباره صحبت کنید.');
              return;
            }
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
        recognitionResultCountRef.current=0;
        recognitionConsumedCountRef.current=0;
      };

      rec.onresult = (event: any) => {
        // Chrome's results include earlier FINAL words on every event.
        // Rebuild all segments; processing only resultIndex loses sentences.
        const total=Number(event.results?.length||0);
        if(total<recognitionConsumedCountRef.current)
          recognitionConsumedCountRef.current=0;
        recognitionResultCountRef.current=total;
        const recognized = extractPersianSpeechSince(event.results,recognitionConsumedCountRef.current);
        const currentSpeech = recognized.text;
        if(!currentSpeech.trim())return;
        recognitionRetryRef.current=0;
        setMicrophoneError(null);
        if(isProcessingTurnRef.current||isAiSpeakingRef.current||isManualReplayPendingRef.current){
          // RMS alone cannot distinguish the loudspeaker from a person.
          // Require actual STT words and reject likely self-echo.
          if(!vadRef.current.heardSpeech)return;
          if(likelySpeakerEcho(currentSpeech)){
            console.info('[FORZA_STT] source=browser echo_candidate_ignored=1');
            return;
          }
          interruptRequestRef.current();
        }
        if (currentSpeech) {
          if(currentSpeech!==activeTranscriptRef.current ||
             speechInterimRef.current!==recognized.hasInterim){
            lastTranscriptChangedAtRef.current=Date.now();
          }
          speechInterimRef.current = recognized.hasInterim;
          hasSpeechSoundRef.current = true;
          activeTranscriptRef.current = currentSpeech;
          setUserText(currentSpeech);
          setStatus('listening');
          setTurn('user');
          setIsUserSpeaking(true);

          const pauseMs = forzaEndOfTurnPauseMs(currentSpeech, recognized.hasInterim);
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          const tryFinalize=()=>{
            silenceTimerRef.current=null;
            if(isAiSpeakingRef.current||isProcessingTurnRef.current||
               statusRef.current!=='listening'||micMutedRef.current)return;
            const candidate=activeTranscriptRef.current.trim();
            if(!candidate)return;
            const wait=forzaTurnRemainingWaitMs(
              candidate,speechInterimRef.current,
              Date.now()-lastTranscriptChangedAtRef.current,
              vadRef.current.heardSpeech?vadRef.current.silenceDuration(Date.now()):null);
            if(wait>0){
              silenceTimerRef.current=window.setTimeout(tryFinalize,Math.max(80,wait));
              return;
            }
            detectedSpeechEndAtRef.current=vadRef.current.heardSpeech
              ? performance.now()-vadRef.current.silenceDuration(Date.now()) : 0;
            console.info('[FORZA_LATENCY] phase=browser_stt_turn_end chars='+candidate.length+
              ' endToSttFinalMs='+(detectedSpeechEndAtRef.current
                ? Math.round(performance.now()-detectedSpeechEndAtRef.current):-1));
            activeTranscriptRef.current='';
            lastTranscriptChangedAtRef.current=0;
            hasSpeechSoundRef.current=false;
            setIsUserSpeaking(false);
            void handleUserFinishedSpeaking(candidate);
          };
          silenceTimerRef.current=window.setTimeout(tryFinalize,pauseMs);
        }
      };

      rec.onerror = (e: any) => {
        const error = e?.error;
        console.warn('[AI FORZA SpeechRecognition] Status:', error);
        const retryDelay=forzaRecognitionRetryDelay(String(error),recognitionRetryRef.current);
        if(retryDelay!==null && !callClosedRef.current && !micMutedRef.current){
          recognitionFailedRef.current=true;
          webSpeechFailedRef.current=true;
          recognitionRetryRef.current++;
          // Warm the 53 MB local model off the critical path. Switch only after
          // repeated network failures so one transient Chrome error does not
          // interrupt a recognizer that has already recovered.
          void ensureDibaStt();
          if(recognitionRetryTimerRef.current!==null)window.clearTimeout(recognitionRetryTimerRef.current);
          try{rec.abort();}catch{}
          setMicrophoneError('ارتباط تشخیص گفتار لحظه‌ای قطع شد؛ در حال اتصال دوباره هستیم.');
          recognitionRetryTimerRef.current=window.setTimeout(()=>{
            recognitionRetryTimerRef.current=null;
            if(callClosedRef.current||micMutedRef.current||!isCallActive||localSttRecognizerRef.current||preferLocalSttRef.current)return;
            recognitionFailedRef.current=false;
            webSpeechFailedRef.current=false;
            try{rec.start();}catch{
              recognitionFailedRef.current=true;
              webSpeechFailedRef.current=true;
              setMicrophoneError('اتصال تشخیص گفتار برقرار نشد؛ میکروفون را دوباره فعال کنید یا پیام را تایپ کنید.');
            }
          },retryDelay);
          return;
        }
        if (['network','not-allowed','service-not-allowed','audio-capture','language-not-supported'].includes(error)) {
          webSpeechFailedRef.current = true;
          recognitionFailedRef.current=true;
          // Preserve the existing provider behind /api/ai/forza-live.
          // The microphone recorder continues; only its finalized audio
          // will be sent if the browser recognizer is unavailable.
          setMicrophoneError('تشخیص گفتار مرورگر در دسترس نیست؛ در حال آماده‌سازی تشخیص فارسی محلی هستیم.');
          if(error==='not-allowed'||error==='service-not-allowed'||error==='language-not-supported'){
            preferLocalSttRef.current=true;
            void ensureDibaStt();
          }else if(error==='network')void ensureDibaStt();
        }
      };

      rec.onend = () => {
        isRecognitionActiveRef.current = false;
        if (recognitionFailedRef.current || !greetingFinishedRef.current || micMutedRef.current) return;
        // Auto-restart recognition if call is still active and listening
        if (isCallActive && !localSttRecognizerRef.current && !preferLocalSttRef.current &&
            (isProcessingTurnRef.current||statusRef.current==='listening') && !isMicMuted) {
          window.setTimeout(() => {
            if (isCallActive && !localSttRecognizerRef.current && !preferLocalSttRef.current &&
                (isProcessingTurnRef.current||statusRef.current==='listening') && !isMicMuted) {
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
  }, [handleUserFinishedSpeaking, isCallActive, isMicMuted, setStatus,startDibaTurn,ensureDibaStt]);

  // Request mic access on entry; only start active transcription after greeting.
  const initializeMicrophone = useCallback(async () => {
    setMicrophoneError(null);
    try {
      if (!window.isSecureContext) throw new Error('insecure_origin');
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
      localSttNodeRef.current?.disconnect();localSttSinkRef.current?.disconnect();
      localSttNodeRef.current=null;localSttSinkRef.current=null;
      attachLocalStt();
      setupMediaRecorder(stream);
      if(recognitionRetryTimerRef.current!==null)window.clearTimeout(recognitionRetryTimerRef.current);
      recognitionRetryTimerRef.current=null;
      recognitionRetryRef.current=0;
      const previousRecognizer=recognitionRef.current;
      if(previousRecognizer){previousRecognizer.onend=null;previousRecognizer.onerror=null;previousRecognizer.onresult=null;try{previousRecognizer.abort();}catch{}}
      recognitionFailedRef.current=false;
      recognitionRef.current=initSpeechRecognition();
      if(!recognitionRef.current){
        preferLocalSttRef.current=true;
        void ensureDibaStt();
      }
      if(greetingFinishedRef.current && !micMutedRef.current) startVoiceInput();
    } catch(error:any) {
      setMicrophoneError(error?.message==='insecure_origin'
        ? 'برای استفاده از میکروفون، FORZA را با HTTPS معتبر باز کنید؛ آدرس HTTP روی IP عمومی امن نیست.'
        : error?.name==='NotAllowedError' || error?.name==='PermissionDeniedError'
        ? 'اجازه میکروفون رد شده است. Microphone را در تنظیمات سایت Allow کنید؛ سپس صفحه را بازخوانی کنید.'
        : 'میکروفون متصل نشد. میکروفون پیش‌فرض و مجوز مرورگر را بررسی کنید.');
    }
  },[ensureCtx,setupMediaRecorder,initSpeechRecognition,startVoiceInput,attachLocalStt,ensureDibaStt]);

  // Chrome Persian recognition is primary. Diba is a lazy browser-local
  // fallback after unsupported recognition or repeated network failures;
  // recognized text is still sent immediately to the xKiro server turn.

  // Discover the optional transcription fallback independently of the
  // text AI provider. Browser streaming STT still works when this is false.
  // A failed discovery does not disable the existing compatibility path.
  useEffect(()=>{
    const controller=new AbortController();
    void fetch('/api/ai/forza-stt-info',{signal:controller.signal,cache:'no-store'})
      .then(async response=>response.ok?await response.json():null)
      .then((info:{serverSttConfigured?:boolean}|null)=>{
        if(!controller.signal.aborted&&typeof info?.serverSttConfigured==='boolean')
          serverSttConfiguredRef.current=info.serverSttConfigured;
      })
      .catch(()=>{});
    return ()=>controller.abort();
  },[]);

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
      setVoiceOutputError(null);
      greetingFinishedRef.current=true;
      setGreetingPhase('complete');
      setStatus('listening');setTurn('user');
      // If Chrome has no Persian recognizer and server STT is not configured,
      // do not open a dead microphone path. Finish the local Diba load first.
      startVoiceInput();
    }).catch((e:any)=>{
      if(!active)return;
      const autoplayDenied = e?.message === 'autoplay_permission_required' ||
        e?.message === 'browser_tts_failed';
      console.warn('[FORZA] Greeting audio unavailable',e?.message||'audio_error');
      if (autoplayDenied) {
        setGreetingPhase('needs-permission');
        setAutoplayBlocked(true);
        setVoiceOutputError('مرورگر پخش خودکار را محدود کرده است؛ برای ادامه یک بار روی صفحه کلیک کنید.');
        return;
      }
      // Do not listen before a complete audible greeting.
      greetingFinishedRef.current=false;
      setGreetingPhase('needs-permission');
      setStatus('idle');
      setTurn('ai');
      setVoiceOutputError('صدای خوشامدگویی فورزا پخش نشد. روی «شروع مکالمه» بزنید تا دوباره امتحان شود.');
    });
    return ()=>{
      active=false;
      greetingStartedRef.current=false;
      greetingFinishedRef.current=false;
      if(silenceTimerRef.current)clearTimeout(silenceTimerRef.current);
      if(recognitionRetryTimerRef.current!==null)window.clearTimeout(recognitionRetryTimerRef.current);
      stopListening();
      streamRef.current?.getTracks().forEach(track=>track.stop());
      streamRef.current=null;
      localSttRecognizerRef.current?.remove?.();localSttRecognizerRef.current=null;
      localSttNodeRef.current?.disconnect();localSttSinkRef.current?.disconnect();
      localSttNodeRef.current=null;localSttSinkRef.current=null;
      stopAudio();
    };
  // A scene starts once. Changing TTS/recognition callbacks must not tear down
  // the stream mid-greeting or permanently disable the microphone.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[particlesFormed]);

  const endCall = useCallback(() => {
    callClosedRef.current = true;
    if(recognitionRetryTimerRef.current!==null)window.clearTimeout(recognitionRetryTimerRef.current);
    activeTurnRef.current?.abort.abort(new Error('forza_call_closed'));
    activeTurnRef.current=null;
    historyRef.current=[];
    audioChunksRef.current=[];
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
    if (!greetingFinishedRef.current || !text.trim()) return false;
    detectedSpeechEndAtRef.current=0; // typed turns have no acoustic end
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
                  HUMAN SYSTEMS / 001 · {stats.particles ? `${stats.particles.toLocaleString('en')} PARTICLES` : 'PARTICLES —'}
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
              {stats.tier} · {stats.fps!==null ? `${stats.fps} FPS` : 'FPS —'} · {formatTime(seconds)}
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
              SYNC <b className="text-white">—</b>
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
            {turn === 'user'
              ? 'فورزا گوش می‌دهد؛ صحبتتان را کامل کنید'
              : greetingPhase === 'needs-permission'
              ? 'برای شروع باید صدای خوشامدگویی پخش شود'
              : status === 'speaking' && isSpeakerMuted
              ? 'صدای فورزا بی‌صداست'
              : status === 'speaking' && voiceStage === 'playing'
              ? 'AI FORZA در حال صحبت...'
              : greetingPhase === 'preparing'
              ? 'AI FORZA در حال خوشامدگویی...'
              : voiceStage === 'buffering'
              ? 'در انتظار ادامه صدا...'
              : voiceStage === 'synthesizing'
              ? 'در حال تولید صدا...'
              : voiceStage === 'text'
              ? 'در انتظار پاسخ فورزا...'
              : status === 'thinking' && voicePending
              ? 'در انتظار پخش صوت...'
              : status === 'thinking'
              ? 'در انتظار پاسخ فورزا...'
              : 'AI FORZA آماده می‌شود...'}
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
          {(isProcessingTurnRef.current || isAiSpeakingRef.current || voicePending) && greetingPhase === 'complete' && (
            <button type="button"
              onClick={interruptCurrentTurn}
              className="p-1 rounded-md text-[#dee2e5]/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="توقف فوری پاسخ و ادامه شنیدن صدای مشتری"
              aria-label="توقف پاسخ فورزا">
              <Square size={13} fill="currentColor" />
            </button>
          )}
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
            onClick={() => { if(greetingPhase==='complete')void replayAiVoice(); else unlockAudio(); }}
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
              else if (greetingFinishedRef.current) startVoiceInput();
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

        {!clean && (
          <div role="status" dir="rtl" className="pointer-events-none self-end text-[10px] text-[#dee2e5]/70">
            صدای فورزا: {activeVoiceLabel} · تشخیص گفتار: مرورگر / سرویس فعلی سرور
          </div>
        )}
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
        {greetingPhase === 'preparing' && autoplayBlocked && (
          <div role="status" className="pointer-events-none self-end rounded-xl bg-black/80 px-3 py-2 text-xs text-white">
            مرورگر اجازه پخش خودکار صدا را نداده است.
          </div>
        )}

        {greetingPhase === 'needs-permission' && (
          <button type="button" onClick={unlockAudio}
            className="pointer-events-auto self-end rounded-xl border-2 border-orange-400 bg-orange-600 px-5 py-3 text-sm font-bold text-white shadow-xl hover:bg-orange-500"
            aria-label="شروع مکالمه و پخش خوشامدگویی فورزا">
            <Volume2 size={17} className="ml-2 inline-block" /> شروع مکالمه و پخش خوشامدگویی
          </button>
        )}
        {voiceOutputError && (
          <div role="alert" className="pointer-events-auto self-end max-w-sm rounded-xl border border-orange-400/50 bg-black/90 px-3 py-2 text-xs text-orange-100">
            {voiceOutputError}
            <button type="button" onClick={() => { if(greetingPhase==='complete')void replayAiVoice();else unlockAudio(); }}
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
              disabled={!customInput.trim() || greetingPhase !== 'complete'}
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
