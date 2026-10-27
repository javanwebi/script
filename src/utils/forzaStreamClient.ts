export type ForzaStreamEvent =
  | {type:'start';responseId?:string}
  | {type:'text_chunk';chunk:string;textSoFar?:string}
  | {type:'done';fullText?:string}
  | {type:'error';message?:string};

/** Decode SSE incrementally; never wait for the full response body. */
export async function consumeForzaTextStream(
  response: Response,
  onChunk: (chunk: string, textSoFar: string) => void,
): Promise<string> {
  if (!response.ok || !response.body) throw new Error('forza_stream_unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let fullText = '';
  const dispatch = (frame: string) => {
    const lines = frame.split(/\r?\n/).filter(line => line.startsWith('data:'));
    if (!lines.length) return;
    const raw = lines.map(line => line.slice(5).trimStart()).join('\n');
    let msg: ForzaStreamEvent;
    try {msg = JSON.parse(raw) as ForzaStreamEvent;} catch {return;}
    if (msg.type === 'error') throw new Error(msg.message || 'forza_stream_failed');
    if (msg.type === 'text_chunk' && typeof msg.chunk === 'string') {
      fullText += msg.chunk;
      onChunk(msg.chunk, fullText);
    } else if (msg.type === 'done' && typeof msg.fullText === 'string') {
      fullText = msg.fullText;
    }
  };
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      pending += decoder.decode(value, {stream:true});
      let n;
      while ((n = pending.indexOf('\n\n')) >= 0) {
        dispatch(pending.slice(0,n));
        pending = pending.slice(n+2);
      }
      if (pending.length > 65536) throw new Error('forza_stream_frame_too_large');
    }
    pending += decoder.decode();
    if (pending.trim()) dispatch(pending);
    return fullText.trim();
  } finally {
    reader.releaseLock();
  }
}
