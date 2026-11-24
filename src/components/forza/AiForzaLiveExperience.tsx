import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ForzaRealtimeClient,
  type ForzaVoicePhase,
  type ForzaVoiceStatus,
} from './forzaRealtimeClient';
import type { ForzaRealtimeCallbacks } from './forzaRealtimeClient';

interface AiForzaLiveExperienceProps {
  onClose?: () => void;
}

type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
};

const STATUS_LABEL: Record<ForzaVoiceStatus, string> = {
  listening: 'گوش می‌کنم',
  thinking: 'در حال فکر کردن',
  speaking: 'فورزا در حال پاسخ دادن',
};

export const AiForzaLiveExperience: React.FC<AiForzaLiveExperienceProps> = ({ onClose }) => {
  const clientRef = useRef<ForzaRealtimeClient | null>(null);
  const userTextRef = useRef('');
  const aiTextRef = useRef('');
  const resumeMicAfterTextRef = useRef(false);
  const messageIdRef = useRef(0);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const [phase, setPhase] = useState<ForzaVoicePhase | 'idle'>('idle');
  const [status, setStatus] = useState<ForzaVoiceStatus>('listening');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [liveUserText, setLiveUserText] = useState('');
  const [liveAiText, setLiveAiText] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [level, setLevel] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);

  const commitTurn = useCallback((userText: string, aiText: string) => {
    const next: ChatMessage[] = [];
    const user = String(userText || '').trim();
    const assistant = String(aiText || '').trim();
    if (user) next.push({ id: ++messageIdRef.current, role: 'user', text: user });
    if (assistant) next.push({ id: ++messageIdRef.current, role: 'assistant', text: assistant });
    if (next.length) setMessages(previous => [...previous, ...next]);
  }, []);

  const callbacks = useCallback((): ForzaRealtimeCallbacks => ({
    onMode: mode => {
      setPhase(mode);
      if (mode === 'native') {
        setError('');
        setMicMuted(false);
      }
    },
    onStatus: next => {
      setStatus(next);
      // When a typed question temporarily pauses the microphone, resume it only
      // after the final streamed audio has actually drained from the browser queue.
      if (next === 'listening' && resumeMicAfterTextRef.current) {
        resumeMicAfterTextRef.current = false;
        clientRef.current?.setMicMuted(false);
        setMicMuted(false);
      }
    },
    onUserText: (text, final) => {
      userTextRef.current = text;
      setLiveUserText(text);
      if (final) setStatus('thinking');
    },
    onAiText: text => {
      // A new provider response starts with an empty transcript. Preserve any
      // interrupted partial answer before displaying the next response.
      if (!text && aiTextRef.current.trim()) {
        const partial = aiTextRef.current.trim();
        setMessages(previous => [
          ...previous,
          { id: ++messageIdRef.current, role: 'assistant', text: partial },
        ]);
      }
      aiTextRef.current = text;
      setLiveAiText(text);
    },
    onTurnComplete: (userText, aiText) => {
      commitTurn(userText || userTextRef.current, aiText || aiTextRef.current);
      userTextRef.current = '';
      aiTextRef.current = '';
      setLiveUserText('');
      setLiveAiText('');
    },
    onInterrupted: (_responseId, userText, aiText) => {
      commitTurn(userText || userTextRef.current, aiText || aiTextRef.current);
      userTextRef.current = '';
      aiTextRef.current = '';
      setLiveUserText('');
      setLiveAiText('');
      setStatus('listening');
    },
    onLevel: setLevel,
    onError: setError,
  }), [commitTurn]);

  useEffect(() => () => {
    clientRef.current?.stop();
    clientRef.current = null;
  }, []);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, liveUserText, liveAiText]);

  const startCall = useCallback(async () => {
    if (phase === 'connecting' || phase === 'native') return;
    clientRef.current?.stop();
    userTextRef.current = '';
    aiTextRef.current = '';
    resumeMicAfterTextRef.current = false;
    setMessages([]);
    setLiveUserText('');
    setLiveAiText('');
    setError('');
    setDraft('');
    setLevel(0);
    setMicMuted(false);
    setPhase('connecting');
    setStatus('listening');

    const client = new ForzaRealtimeClient(callbacks());
    clientRef.current = client;
    client.setSpeakerMuted(speakerMuted);
    await client.start();
  }, [callbacks, phase, speakerMuted]);

  const stopCall = useCallback(() => {
    clientRef.current?.stop();
    clientRef.current = null;
    resumeMicAfterTextRef.current = false;
    commitTurn(userTextRef.current, aiTextRef.current);
    userTextRef.current = '';
    aiTextRef.current = '';
    setLiveUserText('');
    setLiveAiText('');
    setPhase('idle');
    setStatus('listening');
    setLevel(0);
    setMicMuted(false);
  }, [commitTurn]);

  const closeExperience = useCallback(() => {
    stopCall();
    onClose?.();
  }, [onClose, stopCall]);

  const toggleMic = () => {
    const next = !micMuted;
    resumeMicAfterTextRef.current = false;
    setMicMuted(next);
    clientRef.current?.setMicMuted(next);
  };

  const toggleSpeaker = () => {
    const next = !speakerMuted;
    setSpeakerMuted(next);
    clientRef.current?.setSpeakerMuted(next);
  };

  const sendText = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    const client = clientRef.current;
    if (!text || phase !== 'native' || !client) return;

    const resumeMic = !micMuted;
    resumeMicAfterTextRef.current = resumeMic;
    if (resumeMic) {
      client.setMicMuted(true);
      setMicMuted(true);
    }
    if (!client.sendText(text)) {
      resumeMicAfterTextRef.current = false;
      if (resumeMic) {
        client.setMicMuted(false);
        setMicMuted(false);
      }
      setError('پیام ارسال نشد. اتصال زنده را بررسی کنید.');
      return;
    }
    setDraft('');
  };

  const connected = phase === 'native';
  const connecting = phase === 'connecting';
  const statusText = connecting
    ? 'در حال اتصال امن به هوش مصنوعی زنده…'
    : phase === 'unavailable'
      ? 'اتصال زنده برقرار نشد'
      : phase === 'legacy'
        ? 'مسیر مکالمه زنده در دسترس نیست'
        : connected
          ? STATUS_LABEL[status]
          : 'برای شروع، دکمه مکالمه را بزنید';

  return (
    <div className="relative flex h-full min-h-[100svh] w-full flex-col overflow-hidden bg-[#101114] text-white" dir="rtl">
      <header className="relative z-10 flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-7">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E56B1E] shadow-lg shadow-orange-950/30">
            <AudioLines size={21} strokeWidth={2.2} />
          </div>
          <div>
            <div className="text-sm font-bold tracking-wide">FORZA LIVE</div>
            <div className="text-[11px] text-white/50">گفت‌وگوی صوتی زنده</div>
          </div>
        </div>
        <button
          type="button"
          onClick={closeExperience}
          aria-label="بستن مکالمه"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <X size={19} />
        </button>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6 pt-5 sm:px-7">
        <section className="mx-auto flex w-full max-w-3xl flex-col items-center">
          <div className="relative mt-1 flex h-36 w-36 items-center justify-center sm:h-44 sm:w-44" aria-hidden="true">
            <div
              className="absolute inset-1 rounded-full bg-[#E56B1E]/20 blur-2xl transition-transform duration-150"
              style={{ transform: `scale(${1 + level * 0.75})` }}
            />
            <div className={`absolute inset-3 rounded-full border border-[#E56B1E]/30 ${connected ? 'animate-pulse' : ''}`} />
            <div className="absolute inset-7 rounded-full border border-white/10" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#ff9c57] via-[#E56B1E] to-[#9e3c0b] shadow-[0_12px_55px_rgba(229,107,30,0.28)] sm:h-24 sm:w-24">
              <AudioLines size={35} strokeWidth={1.7} />
            </div>
          </div>

          <h1 className="mt-3 text-center text-xl font-bold sm:text-2xl">با فورزا صحبت کنید</h1>
          <p className="mt-2 min-h-6 text-center text-sm text-white/60" role="status" aria-live="polite">
            {statusText}
          </p>
          {connected && (
            <div className="mt-3 flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
              مکالمه دوطرفه برقرار است
            </div>
          )}

          <div className="mt-7 w-full max-w-2xl space-y-3" aria-live="polite" aria-relevant="additions text">
            {messages.map(message => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 sm:max-w-[78%] ${message.role === 'user' ? 'rounded-tr-md bg-white/10 text-white' : 'rounded-tl-md border border-[#E56B1E]/20 bg-[#E56B1E]/10 text-white'}`}>
                  <div className="mb-1 text-[10px] font-semibold tracking-wide text-white/45">
                    {message.role === 'user' ? 'شما' : 'FORZA'}
                  </div>
                  <p className="whitespace-pre-wrap">{message.text}</p>
                </div>
              </div>
            ))}
            {liveUserText && (
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-2xl rounded-tr-md bg-white/10 px-4 py-3 text-sm leading-7 text-white/90 sm:max-w-[78%]">
                  <div className="mb-1 text-[10px] font-semibold text-white/45">شما · زنده</div>
                  <p className="whitespace-pre-wrap">{liveUserText}</p>
                </div>
              </div>
            )}
            {liveAiText && (
              <div className="flex justify-end">
                <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-[#E56B1E]/20 bg-[#E56B1E]/10 px-4 py-3 text-sm leading-7 text-white sm:max-w-[78%]">
                  <div className="mb-1 text-[10px] font-semibold text-[#ffb27f]">FORZA · زنده</div>
                  <p className="whitespace-pre-wrap">{liveAiText}</p>
                </div>
              </div>
            )}
            {!messages.length && !liveUserText && !liveAiText && (
              <div className="mx-auto mt-1 max-w-md rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 text-center text-sm leading-7 text-white/45">
                {connected
                  ? 'به‌محض شروع صحبت، متن مکالمه هم‌زمان در این قسمت نمایش داده می‌شود.'
                  : 'سؤال خود را می‌توانید با صدا یا از طریق کادر پیام مطرح کنید.'}
              </div>
            )}
            <div ref={messageEndRef} />
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-[#101114]/95 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 sm:px-7">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3">
          {error && (
            <div className="w-full rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-right text-xs leading-6 text-red-200" role="alert">
              {error}
            </div>
          )}

          {connected ? (
            <>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-label={micMuted ? 'روشن کردن میکروفون' : 'قطع میکروفون'}
                  className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${micMuted ? 'border-amber-300/40 bg-amber-300/15 text-amber-200' : 'border-white/15 bg-white/10 text-white hover:bg-white/15'}`}
                >
                  {micMuted ? <MicOff size={19} /> : <Mic size={19} />}
                </button>
                <button
                  type="button"
                  onClick={toggleSpeaker}
                  aria-label={speakerMuted ? 'روشن کردن بلندگو' : 'قطع صدای بلندگو'}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
                >
                  {speakerMuted ? <VolumeX size={19} /> : <Volume2 size={19} />}
                </button>
                <button
                  type="button"
                  onClick={stopCall}
                  aria-label="پایان مکالمه"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500"
                >
                  <PhoneOff size={19} />
                </button>
              </div>
              <div className="text-center text-[11px] text-white/40">
                {micMuted ? 'میکروفون خاموش است؛ می‌توانید پیام تایپ کنید.' : 'صحبت کنید؛ برای قطع پاسخ فورزا، وسط صحبت او شروع به صحبت کنید.'}
              </div>
              <form onSubmit={sendText} className="flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-2 focus-within:border-[#E56B1E]/60">
                <input
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  placeholder="یا پیام خود را اینجا بنویسید…"
                  aria-label="پیام متنی به فورزا"
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
                  maxLength={3000}
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  aria-label="ارسال پیام"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E56B1E] text-white transition hover:bg-[#f17c31] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send size={17} />
                </button>
              </form>
            </>
          ) : (
            <button
              type="button"
              onClick={startCall}
              disabled={connecting}
              className="flex min-h-14 w-full max-w-md items-center justify-center gap-3 rounded-2xl bg-[#E56B1E] px-6 py-4 text-sm font-bold text-white shadow-xl shadow-orange-950/25 transition hover:bg-[#f17c31] disabled:cursor-wait disabled:opacity-70"
            >
              {connecting ? <Loader2 size={19} className="animate-spin" /> : <Mic size={19} />}
              {connecting ? 'در حال اتصال به هوش مصنوعی…' : phase === 'unavailable' || phase === 'legacy' ? 'تلاش دوباره برای اتصال زنده' : 'شروع مکالمه زنده'}
            </button>
          )}

          <div className="text-center text-[10px] leading-5 text-white/35">
            برای مکالمه صوتی، دسترسی میکروفون مرورگر لازم است. در صورت نیاز می‌توانید از پیام متنی استفاده کنید.
          </div>
        </div>
      </footer>
    </div>
  );
};
