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
  let sawDone = false;
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
    } else if (msg.type === 'done') {
      sawDone = true;
      if (typeof msg.fullText !== 'string') return;
      // A provider/proxy can deliver its final fullText without having sent
      // every delta frame. Feed any missing suffix to both subtitles and TTS.
      const finalText=msg.fullText;
      if(finalText.startsWith(fullText) && finalText.length>fullText.length){
        const remaining=finalText.slice(fullText.length);
        fullText=finalText;
        onChunk(remaining,fullText);
      } else if(!fullText){
        fullText=finalText;
        if(fullText)onChunk(fullText,fullText);
      }
    }
  };
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      pending += decoder.decode(value, {stream:true});
      let n;
      // Handle either LF or CRLF SSE delimiters. Some proxy paths preserve
      // CRLF, which otherwise leaves all text buffered until disconnect.
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(pending)) !== null) {
        const length = boundary[0].length;
        n = boundary.index;
        dispatch(pending.slice(0,n));
        pending = pending.slice(n+length);
        if (sawDone) break;
      }
      if (sawDone) break;
      if (pending.length > 65536) throw new Error('forza_stream_frame_too_large');
    }
    if (!sawDone) {
      pending += decoder.decode();
      if (pending.trim()) dispatch(pending);
    }
    return fullText.trim();
  } finally {
    // A server/proxy may keep an SSE connection open after its final 'done'
    // frame. Stop reading immediately instead of leaving FORZA in 'receiving'.
    if (sawDone) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
