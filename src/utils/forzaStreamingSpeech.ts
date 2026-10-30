/** Read complete Persian phrases from streaming Gemini text without fragmenting
 * a spoken sentence into tiny word groups. First phrase is shorter to start
 * promptly; later phrases run longer so Pocket's prosody sounds natural.
 */
export function takeSpeakablePhrase(buffer:string,first:boolean):{phrase:string;rest:string}|null{
  if(!buffer.trim())return null;
  const min=first?14:36;
  const target=first?40:100;
  const max=first?72:150;
  const boundary=/[.!?؟؛:\n]/g;
  let found:RegExpExecArray|null;
  while((found=boundary.exec(buffer))){
    const end=found.index+1;
    if(end>=min&&end<=max)
      return {phrase:buffer.slice(0,end).trim(),rest:buffer.slice(end).trimStart()};
    if(end>max)break;
  }
  // A comma is a natural clause boundary only when the phrase is not tiny.
  const comma=/[،,]/g;
  while((found=comma.exec(buffer))){
    const end=found.index+1;
    if(end>=(first?30:65)&&end<=max)
      return {phrase:buffer.slice(0,end).trim(),rest:buffer.slice(end).trimStart()};
    if(end>max)break;
  }
  if(buffer.length<target)return null;
  // Ensure a complete word is released: never consume a partial network token.
  const end=Math.min(buffer.length-1,max);
  const cut=buffer.lastIndexOf(' ',end);
  if(cut<min)return null;
  return {phrase:buffer.slice(0,cut).trim(),rest:buffer.slice(cut).trimStart()};
}
