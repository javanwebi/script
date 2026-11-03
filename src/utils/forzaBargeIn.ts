import {normalizePersianTranscript} from './forzaSpeechPipeline';

/** WebSpeech + microphone gate: conservative because speaker echo is not the customer. */
const commands=/(?:^|\s)(?:نه|صبر(?:\s+کن)?|وایسا|بس(?:\s+کن)?|قطع(?:\s+کن)?|ادامه(?:\s+بده)?|منظورم)(?=$|\s)/i;
export function shouldInterruptForzaSpeech(
  recognized:string,assistantSpeech:string,
  options:{microphoneVoiced:boolean;isFinal:boolean},
):boolean{
  const raw=normalizePersianTranscript(recognized).toLowerCase();
  const text=raw.replace(/[،؛.!؟?:]/g,' ').replace(/\s+/g,' ').trim();
  if(!text)return false;
  const words=text.split(' ').filter(Boolean);
  const hasCommand=commands.test(' '+text+' ');
  if(!options.microphoneVoiced)return false;
  if(!hasCommand && (words.length<2 || text.length<7))return false;
  // A single interim word is too easy to hallucinate from loudspeaker echo.
  if(hasCommand && words.length===1 && !options.isFinal)return false;
  // Compare only against text actually produced by FORZA. Do not reject
  // explicit corrections merely because they quote a product code.
  const output=normalizePersianTranscript(assistantSpeech).toLowerCase()
    .replace(/[،؛.!؟?:]/g,' ').replace(/\s+/g,' ').trim();
  if(output){
    if(output.includes(text) && text.length>=6)return false;
    const assistantWords=new Set(output.split(' '));
    const matched=words.filter(word=>word.length>2 && assistantWords.has(word)).length;
    if(words.length>=3 && matched/words.length>=0.8)return false;
  }
  // Generic questions wait for a final ASR hypothesis; clear correction
  // commands may interrupt on interim text. This favors echo safety over
  // an unverified sub-300ms speakerphone promise.
  return hasCommand || options.isFinal;
}
export function forzaInterruptionIntent(input:string):
  'stop'|'continue'|'correction'|'new_question'{
  const text=normalizePersianTranscript(input);
  if(/^(?:صبر\s*کن|صبر|وایسا|بس\s*کن|قطع\s*کن)(?:\s*[.!؟])?$/.test(text))return 'stop';
  if(/^(?:ادامه\s*بده|ادامه|بقیه(?:ش)?\s*رو\s*بگو)(?:\s*[.!؟])?$/.test(text))return 'continue';
  if(/(?:^|\s)(?:نه|منظورم|اشتباه|اصلاح)(?:\s|[،,.]|$)/.test(text))return 'correction';
  return 'new_question';
}
