/** Read complete Persian clauses from the live AI stream.
 * Avoid tiny two-word requests: Pocket pays a substantial fixed G2P/model
 * cost per request, so short fragments amplify both startup delay and gaps.
 * A genuinely short final answer is still flushed by the caller at stream end.
 */
export function takeSpeakablePhrase(buffer:string,first:boolean):{phrase:string;rest:string}|null{
  if(!buffer.trim())return null;
  const min=first?28:55;
  // First voice onset matters more than a long initial chunk. On the VPS,
  // a 70-120 character first TTS request can delay first sound severely.
  // Keep subsequent phrases larger to avoid repeated model-startup costs.
  const target=first?48:130;
  const max=first?90:180;
  // Never interpret decimal dots in e.g. 12.7 as phrase boundaries.
  const boundary=/(?<!\d)\.(?!\d)|[!?؟؛:\n]/g;
  let found:RegExpExecArray|null;
  while((found=boundary.exec(buffer))){
    const end=found.index+1;
    if(end>=min&&end<=max)
      return {phrase:buffer.slice(0,end).trim(),rest:buffer.slice(end).trimStart()};
    if(end>max)break;
  }
  // Commas are weaker boundaries; do not send a short greeting fragment.
  const comma=/[،]|(?<!\d),(?!\d)/g;
  while((found=comma.exec(buffer))){
    const end=found.index+1;
    if(end>=(first?34:75)&&end<=max)
      return {phrase:buffer.slice(0,end).trim(),rest:buffer.slice(end).trimStart()};
    if(end>max)break;
  }
  if(buffer.length<target)return null;
  // Release a complete word at the target size; never split a network token.
  const end=Math.min(buffer.length-1,max);
  const cut=buffer.lastIndexOf(' ',end);
  if(cut<min)return null;
  return {phrase:buffer.slice(0,cut).trim(),rest:buffer.slice(cut).trimStart()};
}
