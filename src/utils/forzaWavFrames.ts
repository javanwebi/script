/** Incremental decoder for the private Pocket TTS binary wire format.
 * Each packet is a LE uint32 byte length followed by a complete PCM WAV.
 * This intentionally accepts arbitrary HTTP chunk boundaries.
 */
export async function readForzaWavFrames(
  stream:ReadableStream<Uint8Array>,
  onFrame:(wav:Uint8Array)=>void,
):Promise<number>{
  const reader=stream.getReader();
  let pending=new Uint8Array(0);
  let expected:number|null=null;
  let frames=0,total=0;
  try{
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      if(!value?.length)continue;
      total+=value.length;
      if(total>5_000_000)throw new Error('forza_wav_stream_too_large');
      const appended=new Uint8Array(pending.length+value.length);
      appended.set(pending);
      appended.set(value,pending.length);
      pending=appended;
      while(true){
        if(expected===null){
          if(pending.length<4)break;
          expected=new DataView(pending.buffer,pending.byteOffset,4).getUint32(0,true);
          pending=pending.slice(4);
          if(expected<44||expected>1_500_000)throw new Error('forza_wav_frame_invalid_length');
        }
        if(pending.length<expected)break;
        const wav=pending.slice(0,expected);
        pending=pending.slice(expected);
        expected=null;
        if(String.fromCharCode(...wav.slice(0,4))!=='RIFF' ||
           String.fromCharCode(...wav.slice(8,12))!=='WAVE')
          throw new Error('forza_wav_frame_invalid_header');
        frames++;
        if(frames>64)throw new Error('forza_wav_too_many_frames');
        onFrame(wav);
      }
    }
    if(expected!==null||pending.length!==0||frames===0)
      throw new Error('forza_wav_stream_truncated');
    return frames;
  }finally{
    reader.releaseLock();
  }
}
