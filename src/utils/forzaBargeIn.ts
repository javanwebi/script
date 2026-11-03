/** Conservative echo guard. This is NOT speaker diarization. A headset is
 * the reliable way to avoid acoustic bleed when Web Speech runs during TTS.
 * Only use with live microphone VAD evidence; never use it to suppress a turn
 * after the customer has finished speaking.
 */
const normalize = (text:string) => String(text || '')
  .replace(/[\u064A]/g,'ی').replace(/[\u0643]/g,'ک')
  .replace(/[.,،؛:!?؟\u200c\n\r]/g,' ')
  .replace(/\s+/g,' ').trim().toLowerCase();

export function isForzaProbableEcho(recognized:string, spokenAnswer:string):boolean {
  const speech=normalize(recognized);
  const answer=normalize(spokenAnswer);
  if(!speech || !answer)return false;
  // Intentional corrections and explicit interruption commands take priority.
  if(/^(?:نه|صبر کن|بس کن|توقف|ادامه بده|منظورم|نه منظورم)(?:\s|$)/.test(speech))
    return false;
  if(answer.includes(speech))return true;
  const words=speech.split(' ').filter(Boolean);
  if(words.length < 3)return false;
  const n=words.length;
  const answerWords=answer.split(' ');
  for(let i=0;i+n<=answerWords.length;i++){
    let equal=0;
    for(let j=0;j<n;j++)if(words[j]===answerWords[i+j])equal++;
    if(equal/n>=0.85)return true;
  }
  return false;
}
