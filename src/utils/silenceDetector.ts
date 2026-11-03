/**
 * silenceDetector.ts
 *
 * Advanced Persian Voice Activity & Silence Detection (VAD)
 * Analyzes audio energy (RMS/AnalyserNode) and Persian linguistic cues
 * to intelligently identify the natural conclusion of a user's spoken sentence
 * and automatically dispatch the turn for Gemini processing.
 */

export interface PersianSentenceAnalysis {
  isComplete: boolean;
  isQuestion: boolean;
  isMidThought: boolean;
  confidence: number;
  recommendedPauseMs: number;
  detectedReason: string;
}

/**
 * Intelligent Persian linguistic analyzer to detect if a spoken sentence has reached its conclusion.
 * Differentiates between completed inquiries, polite terminations, and mid-sentence pauses.
 */
export function analyzePersianSentenceCompletion(text: string): PersianSentenceAnalysis {
  const raw = String(text || '').trim().replace(/ي/g, 'ی').replace(/ك/g, 'ک');
  const ellipsis = /(?:\.{2,}|…)\s*$/.test(raw);
  const clean = raw.replace(/[.?!؟…]+$/g, '').replace(/[،,؛;]/g, ' ')
    .replace(/\s+/g, ' ').trim();

  const decision = (
    isComplete: boolean, isQuestion: boolean, isMidThought: boolean,
    confidence: number, recommendedPauseMs: number, detectedReason: string,
  ): PersianSentenceAnalysis => ({
    isComplete, isQuestion, isMidThought, confidence, recommendedPauseMs, detectedReason,
  });

  if (clean.length < 2) {
    return decision(false, false, true, 0, 2200, 'گفتار کوتاه یا ناتمام');
  }

  // Ending a clause with a connector, self-correction, or incomplete request
  // is not the same as ending a conversational turn. Check this BEFORE
  // punctuation: Chrome may auto-insert a full stop on an interim hypothesis.
  const waitingForContinuation =
    /(?:^|\s)(?:و|که|چون|چونکه|برای|تا|اما|ولی|یا|اگر|یعنی|مثلا|مثلاً|بعد|بعدش|سپس|با|از|در|روی|به|همراه|همچنین|منظورم|میخوام|می‌خوام|میخواهم|می‌خواهم|میخواستم|می‌خواستم|میشه|می‌شه|لطفا|لطفاً|یه|یک|آیا|چطور|چگونه|چقدر|چند|کدام|کدوم|چه|چی|نه)$/.test(clean) ||
    /(?:نیاز\s+دارم|لازم\s+دارم|برای\s+اینکه|در\s+واقع|به\s+عبارت\s+دیگر|از\s+طرفی|به\s+همراه|صبر\s+کن\s+تا|میخوام\s+بگم|می‌خوام\s+بگم)$/.test(clean);
  if (waitingForContinuation || ellipsis) {
    return decision(false, false, true, 0.15, 2250,
      'در انتظار ادامه جمله، مشخصات کالا یا اصلاح مشتری');
  }

  // Stand-alone commands are complete. A longer sentence starting with
  // "صبر کن" is NOT necessarily complete ("صبر کن توضیح بدم ...").
  if (/^(?:سلام|درود|خداحافظ|ممنون|ممنونم|متشکرم|سپاس|صبر\s+کن|بس\s+کن|ادامه\s+بده|قطع\s+کن|متوقف\s+شو|دوباره\s+بگو)$/.test(clean)) {
    return decision(true, false, false, 0.98, 650, 'فرمان یا عبارت مستقل');
  }

  // Do not infer that "آیا این تسمه ..." is a complete question merely
  // because it starts with آیا. Wait for the predicate or question ending.
  const questionEnd =
    /(?:چیست|چیه|چنده|چقدره|چقدر\s+است|کدام\s+است|کدومه|کدوم\s+است|چطوریه|چگونه\s+است|کجاست|چند\s+تومنه|چند\s+در\s+میاد|قیمتش\s+چنده|کدوم\s+بهتره|کدام\s+بهتر\s+است|چه\s+فرقی\s+دارن|چه\s+فرقی\s+دارند|چه\s+تفاوتی\s+داره|موجود\s+دارید|موجود\s+دارین|موجود\s+هست|موجوده|داری|دارید|دارین|امکانش\s+هست|درسته|بهتره|چنده\s+الان|کی\s+می‌رسه|کی\s+آماده\s+می‌شه|کی\s+ارسال\s+می‌شه|گارانتی\s+داره|ضمانت\s+داره)$/.test(clean);
  if (questionEnd) {
    return decision(true, true, false, 0.96, 750, 'پرسش دارای پایان مشخص');
  }

  const requestEnd =
    /(?:بگید|بفرمایید|توضیح\s+دهید|توضیح\s+بدید|راهنمایی\s+کنید|راهنمایی\s+بفرمایید|کمکم\s+کنید|محاسبه\s+کنید|معادل‌یابی\s+کنید|پیشنهاد\s+دهید|پیشنهاد\s+بدید|معرفی\s+کنید|ثبت\s+کنید|صادر\s+کنید|ارسال\s+کنید|پیش‌فاکتور\s+بدید|پیش\s+فاکتور\s+بدید|بفرستید|بگو|بفرست|بدونم|میشه\s+بگید|می‌شه\s+بگید)$/.test(clean);
  if (requestEnd) {
    return decision(true, false, false, 0.94, 800, 'درخواست مشخص و قابل پاسخ');
  }

  // Question punctuation is helpful but not sufficient to override an
  // unfinished prefix such as "آیا این تسمه" or "یه تسمه می‌خوام".
  const hasQuestionMark = /[?؟]\s*$/.test(raw);
  const hasTerminalPunctuation = /[.!?؟]\s*$/.test(raw) && !ellipsis;
  const startsWithUnfinishedQuestion = /^(?:آیا|چطور|چگونه|چرا|چه|کدام|کدوم)\s+/.test(clean)
    && !/(?:است|هست|نیست|داره|دارند|دارد|ندارد|می‌شود|میشه|می‌شه|شد|شده|کنم|کنیم|بکنم|بکنیم|می‌کنه|میکنه)$/.test(clean);
  if (hasTerminalPunctuation && !startsWithUnfinishedQuestion) {
    return decision(true, hasQuestionMark, false, 0.91, 850,
      'نشانه پایان جمله همراه با ساختار قابل قبول');
  }

  // A verb is evidence, not proof, of completion. Keep a moderate silence
  // window when a customer may append another size, model or specification.
  if (/(?:است|هست|نیست|دارد|ندارد|داره|شد|شده|می‌شود|می‌شه|میشه|کرد|کرده|باشه)$/.test(clean)) {
    return decision(true, false, false, 0.77, 1100, 'فعل پایانی محتمل');
  }

  // NEVER classify a four-word fragment as definitely complete. The customer
  // may still be forming a Persian sentence or spelling an industrial code.
  if (clean.split(/\s+/).length >= 4) {
    return decision(false, false, false, 0.48, 1550,
      'جمله با پایان نامطمئن؛ منتظر پایداری متن و سکوت');
  }

  return decision(false, false, true, 0.3, 1900,
    'عبارت کوتاه یا مشخصات ناتمام');
}

/**
 * Calculates Root Mean Square (RMS) volume and frequency spectrum from an AnalyserNode
 */
export function calculateAudioMetrics(analyser: AnalyserNode, timeBuffer: Uint8Array, freqBuffer: Uint8Array): {
  rms: number;
  peakDb: number;
  averageFrequency: number;
  voiceBandEnergy: number;
} {
  analyser.getByteTimeDomainData(timeBuffer as any);
  analyser.getByteFrequencyData(freqBuffer as any);

  let sumSquares = 0;
  for (let i = 0; i < timeBuffer.length; i++) {
    const normalized = (timeBuffer[i] - 128) / 128;
    sumSquares += normalized * normalized;
  }
  const rms = Math.sqrt(sumSquares / timeBuffer.length);

  // Focus on Persian vocal formant frequencies (150Hz to 3200Hz)
  // Assuming 44.1kHz or 48kHz, bin width ~ 43Hz for fftSize 512
  const minBin = Math.max(1, Math.floor(150 / 43));
  const maxBin = Math.min(freqBuffer.length - 1, Math.ceil(3200 / 43));
  let voiceSum = 0;
  let totalFreqSum = 0;

  for (let i = 0; i < freqBuffer.length; i++) {
    totalFreqSum += freqBuffer[i];
    if (i >= minBin && i <= maxBin) {
      voiceSum += freqBuffer[i];
    }
  }

  const voiceBandEnergy = voiceSum / (maxBin - minBin + 1) / 255;
  const averageFrequency = totalFreqSum / freqBuffer.length / 255;
  const peakDb = rms > 0 ? 20 * Math.log10(rms) : -100;

  return {
    rms,
    peakDb,
    averageFrequency,
    voiceBandEnergy,
  };
}

/**
 * Converts Float32Array from Web Audio API into 16-bit PCM Int16Array
 */
export function float32ToInt16PCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

/**
 * Encodes Int16Array PCM buffer to Base64 string
 */
export function pcm16ToBase64(int16Array: Int16Array): string {
  const buffer = new Uint8Array(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength);
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

/**
 * Decodes Base64 string to 16-bit PCM Int16Array
 */
export function base64ToPCM16(base64: string): Int16Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
}

/**
 * Converts Int16Array PCM data into a playable Web Audio API AudioBuffer
 */
export function pcm16ToAudioBuffer(
  pcmData: Int16Array,
  audioCtx: AudioContext,
  sampleRate = 24000
): AudioBuffer {
  const audioBuffer = audioCtx.createBuffer(1, pcmData.length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < pcmData.length; i++) {
    channelData[i] = pcmData[i] / 32768.0;
  }
  return audioBuffer;
}

/**
 * Downsamples Float32Array audio buffer from inputSampleRate to outputSampleRate (e.g. 48kHz -> 16kHz)
 */
export function downsampleAudioBuffer(
  buffer: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array {
  if (outputSampleRate >= inputSampleRate) {
    return buffer;
  }
  const ratio = inputSampleRate / outputSampleRate;
  const newLength = Math.floor(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIndex = Math.floor(i * ratio);
    result[i] = buffer[srcIndex] || 0;
  }
  return result;
}

/**
 * Wrap raw PCM into a standard RIFF WAV container for fallback audio elements
 */
export function pcm16ToWavBlob(pcmData: Int16Array, sampleRate = 24000, numChannels = 1): Blob {
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const dataSize = pcmData.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Copy PCM samples
  const pcmBytes = new Uint8Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
  new Uint8Array(buffer, 44).set(pcmBytes);

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Decodes a base64 audio data URI (mp3, wav, webm) into an AudioBuffer
 */
export async function decodeBase64ToAudioBuffer(
  base64AudioUri: string,
  audioCtx: AudioContext
): Promise<AudioBuffer | null> {
  try {
    const base64Data = base64AudioUri.replace(/^data:[^;]+;base64,/, '');
    const binary = atob(base64Data);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;
    return await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch (err) {
    console.warn('[AudioDecode] Error decoding base64 audio buffer:', err);
    return null;
  }
}
