/** Extract whole-word phrases in order, keeping every character of the answer.
 * Phrases are short enough for the Pocket Farsi v2 engine, even if the model
 * streams a very long sentence with no punctuation.
 */
export function takeSpeakablePhrase(buffer: string, first: boolean): {phrase:string;rest:string}|null{
  if(!buffer.trim())return null;
  // The first local speech utterance can start on a shorter complete phrase.
  // Never pass raw partial tokens (e.g. «فور» before «فورزا»).
  const min=first?10:12;
  const target=first?20:36;
  const max=52;
  const pause=/[.!?؟،؛:\n]/g;
  let match:RegExpExecArray|null;
  while((match=pause.exec(buffer))){
    const end=match.index+1;
    if(end>=min && end<=max){
      return {phrase:buffer.slice(0,end).trim(),rest:buffer.slice(end).trimStart()};
    }
    if(end>max)break;
  }
  if(buffer.length<target)return null;
  const index=buffer.lastIndexOf(' ',Math.min(buffer.length,first?32:max));
  if(index<min)return null;
  return {phrase:buffer.slice(0,index).trim(),rest:buffer.slice(index).trimStart()};
}
