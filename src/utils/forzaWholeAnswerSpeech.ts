/** FORZA single-turn audio contract for CPU Piper/VITS and Pocket.
 *
 * SSE text is rendered live but only the completed, authoritative full answer
 * is spoken. One text input, one private TTS HTTP request, one RIFF WAV and
 * one AudioContext source. Punctuation never becomes an audio boundary.
 *
 * This deliberately trades token-synchronous first audio for the invariant
 * that there can be no per-phrase inference gaps within a spoken answer.
 */
export interface WholeAnswerPlayer {
  enqueueWav(audio:Uint8Array):Promise<void>;
}

export async function playForzaWholeAnswer(
  fullText:string,
  synthesize:(text:string,signal?:AbortSignal)=>Promise<Uint8Array>,
  player:WholeAnswerPlayer,
  signal?:AbortSignal,
):Promise<void>{
  const text=fullText.trim();
  if(!text)throw new Error('forza_empty_answer');
  if(signal?.aborted)throw new Error('forza_tts_aborted');
  // Never make another request for individual sentences or a tiny final tail.
  const wav=await synthesize(text,signal);
  if(signal?.aborted)throw new Error('forza_tts_aborted');
  await player.enqueueWav(wav);
}
