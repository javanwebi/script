/** First audible FORZA source wins; the other request may finish in the background. */
export interface ForzaReadyAudio {
  audioBase64?: string;
  useClientSpeech?: boolean;
}
export type ForzaVoiceStart =
  | { kind: 'stream' }
  | { kind: 'audio'; audioUrl: string }
  | { kind: 'browser' };

export async function chooseForzaVoiceStart(
  streamStarted: Promise<void>,
  streamFinished: Promise<boolean>,
  audioReady: Promise<ForzaReadyAudio>,
): Promise<ForzaVoiceStart> {
  const fileResult: Promise<ForzaVoiceStart> = audioReady.then(
    audio => audio?.audioBase64 ? { kind: 'audio' as const, audioUrl: audio.audioBase64 } : { kind: 'browser' as const },
    () => ({ kind: 'browser' as const }),
  );
  const first = await Promise.race([
    streamStarted.then((): ForzaVoiceStart | {kind:'stream-failed'} => ({ kind: 'stream' })),
    streamFinished.then(
      completed => completed ? { kind: 'stream' } as const : { kind: 'stream-failed' } as const,
      () => ({ kind: 'stream-failed' } as const),
    ),
    fileResult,
  ]);
  // If the stream failed before the first audible frame, use the *already
  // pending* JSON TTS request rather than starting it after the failure.
  return first.kind === 'stream-failed' ? fileResult : first;
}
