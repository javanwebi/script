/**
 * FORZA's zero-per-request-cost browser speech engines.
 * Piper Amir uses a pinned MIT browser runtime with a public MIT voice model.
 * Diba Small uses the Apache-licensed Vosk WebAssembly browser engine.
 * Both models are downloaded to the customer's device; the Railway server
 * never executes these models or sees the Gemini API key from this module.
 */
export const FORZA_AMIR_VOICE_ID = 'fa_IR-amir-medium';
export const FORZA_DIBA_MODEL_URL =
  'https://huggingface.co/Dibachain/Diba-STT/resolve/main/browser/diba-stt-fa-small.tar.gz';
const PIPER_MODULE_URL =
  'https://esm.sh/@mintplex-labs/piper-tts-web@1.0.5?bundle&target=es2022';
const VOSK_SCRIPT_URL =
  'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.min.js';

export interface LocalRecognizer {
  acceptWaveform(samples: AudioBuffer): void;
  on(event: 'result' | 'partialresult' | 'error', handler: (event: any) => void): void;
  remove?(): void;
}
export interface LocalSttModel {
  KaldiRecognizer: new (sampleRate?: number) => LocalRecognizer;
  terminate?(): void;
}
type PiperModule = {
  predict(input: { text: string; voiceId: string }): Promise<Blob>;
  download?: (voiceId: string, progress?: (event: unknown) => void) => Promise<unknown>;
};
type BrowserVosk = { createModel(url: string): Promise<LocalSttModel> };

let piperModulePromise: Promise<PiperModule> | null = null;
let dibaModelPromise: Promise<LocalSttModel> | null = null;
let voskScriptPromise: Promise<void> | null = null;
const piperSpeechCache = new Map<string, Promise<Blob>>();

function timeout<T>(promise: Promise<T>, milliseconds: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), milliseconds);
    promise.then(
      result => { clearTimeout(timer); resolve(result); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

function loadVoskScript(): Promise<void> {
  if (voskScriptPromise) return voskScriptPromise;
  voskScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = (window as any).Vosk as BrowserVosk | undefined;
    if (existing?.createModel) return resolve();
    const tag = document.createElement('script');
    tag.src = VOSK_SCRIPT_URL;
    tag.async = true;
    tag.onload = () => {
      if ((window as any).Vosk?.createModel) resolve();
      else reject(new Error('vosk_runtime_missing'));
    };
    tag.onerror = () => reject(new Error('vosk_runtime_download_failed'));
    document.head.append(tag);
  }).catch(error => {
    voskScriptPromise = null;
    throw error;
  });
  return voskScriptPromise;
}

export async function loadDibaSttModel(): Promise<LocalSttModel> {
  if (!dibaModelPromise) {
    dibaModelPromise = (async () => {
      await timeout(loadVoskScript(), 25000, 'vosk_runtime_timeout');
      const vosk = (window as any).Vosk as BrowserVosk;
      return await timeout(vosk.createModel(FORZA_DIBA_MODEL_URL), 90000, 'diba_model_timeout');
    })().catch(error => {
      dibaModelPromise = null; // retry after a transient network failure
      throw error;
    });
  }
  return dibaModelPromise;
}

async function piper(): Promise<PiperModule> {
  if (!piperModulePromise) {
    // The runtime, its phonemizer and the voice weights run on the client.
    // This URL is intentionally pinned; do not import a changing 'latest' version.
    const source = PIPER_MODULE_URL;
    piperModulePromise = timeout(
      import(/* @vite-ignore */ source) as Promise<PiperModule>,
      45000,
      'piper_runtime_timeout',
    ).catch(error => {
      piperModulePromise = null;
      throw error;
    });
  }
  return piperModulePromise;
}

export async function prepareAmirVoice(): Promise<void> {
  const api = await piper();
  if (api.download) {
    await timeout(api.download(FORZA_AMIR_VOICE_ID), 120000, 'amir_voice_download_timeout');
  }
}

export function synthesizeAmir(text: string): Promise<Blob> {
  const normalized = text.trim();
  if (!normalized) return Promise.reject(new Error('empty_speech'));
  if (normalized.length > 750) return Promise.reject(new Error('amir_text_too_long'));
  const cached = piperSpeechCache.get(normalized);
  if (cached) return cached;
  const created = (async () => {
    const api = await piper();
    const result = await timeout(
      api.predict({ text: normalized, voiceId: FORZA_AMIR_VOICE_ID }),
      45000,
      'amir_voice_inference_timeout',
    );
    if (!(result instanceof Blob) || result.size < 44) throw new Error('amir_voice_empty');
    return result;
  })().catch(error => {
    piperSpeechCache.delete(normalized);
    throw error;
  });
  piperSpeechCache.set(normalized, created);
  if (piperSpeechCache.size > 8) {
    const first = piperSpeechCache.keys().next().value;
    if (first) piperSpeechCache.delete(first);
  }
  return created;
}
