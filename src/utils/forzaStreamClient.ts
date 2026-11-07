export type ForzaStreamEvent =
  | {type:'start';responseId?:string;userTurnId?:string;timestamp?:number}
  | {type:'provider';provider?:string}
  | {type:'text_chunk';chunk:string;textSoFar?:string}
  | {type:'done';fullText?:string;suggestedAction?:{label:string;link?:string}}
  | {type:'error';message?:string;errorCode?:string};
export type ForzaStreamStage = 'start'|'provider'|'first_delta'|'done'|'error'|'incomplete';


/** Decode SSE incrementally; never wait for the full response body. */
export async function consumeForzaTextStream(
  response: Response,
  onChunk: (chunk: string, textSoFar: string) => void,
  onStage?: (stage:ForzaStreamStage,info?:{code?:string;provider?:string})=>void,
  onDone?: (message:Extract<ForzaStreamEvent,{type:'done'}>)=>void,
): Promise<string> {
  if (!response.ok || !response.body) throw new Error('forza_stream_unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let fullText = '';
  let sawDone = false;
  let sawDelta = false;
  const dispatch = (frame: string) => {
    const lines = frame.split(/\r?\n/).filter(line => line.startsWith('data:'));
    if (!lines.length) return;
    const raw = lines.map(line => line.slice(5).trimStart()).join('\n');
    let msg: ForzaStreamEvent;
    try {msg = JSON.parse(raw) as ForzaStreamEvent;} catch {return;}
    if (msg.type === 'start') onStage?.('start');
    if (msg.type === 'provider') onStage?.('provider',{provider:msg.provider});
    if (msg.type === 'error') {
      onStage?.('error',{code:msg.errorCode});
      throw new Error(msg.message || 'forza_stream_failed');
    }
    if (msg.type === 'text_chunk' && typeof msg.chunk === 'string') {
      if(!sawDelta && msg.chunk.trim()){
        sawDelta=true;
        onStage?.('first_delta');
      }
      fullText += msg.chunk;
      onChunk(msg.chunk, fullText);
    } else if (msg.type === 'done') {
      // An authoritative done is valid only when it extends prior deltas.
      // Revising words that have already entered a TTS request must NEVER be
      // reported as a completed response, or re-spoken from the beginning.
      if (typeof msg.fullText === 'string') {
        const finalText=msg.fullText;
        if(!finalText.startsWith(fullText)){
          onStage?.('error',{code:'forza_stream_revised_after_delta'});
          throw new Error('forza_stream_revised_after_delta');
        }
        if(finalText.length>fullText.length){
          const remaining=finalText.slice(fullText.length);
          fullText=finalText;
          onChunk(remaining,fullText);
        }
      }
      sawDone=true;
      onStage?.('done');
      onDone?.(msg);
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
    // Network EOF is NOT the end of an AI answer. Without the explicit
    // final SSE event, the UI must never send a partial answer to TTS.
    if (!sawDone) {
      onStage?.('incomplete');
      throw new Error('forza_stream_incomplete');
    }
    return fullText.trim();
  } finally {
    // A server/proxy may keep an SSE connection open after its final 'done'
    // frame. Stop reading immediately instead of leaving FORZA in 'receiving'.
    // Also cancel on error/invalid EOF; releaseLock alone leaves the upstream
    // response body running after the caller has abandoned this turn.
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
