/** FORZA STT is independent from the text/chat and Piper TTS providers.
 * xKiro's official API has no speech-to-text endpoint, so its key must never
 * be passed to the Google SDK. Explicit opt-in and a dedicated Gemini key are
 * required to use the optional legacy transcription path.
 */
export type ForzaSttSelection =
  | {provider:'gemini';key:string;reason:'configured'}
  | {provider:'none';reason:'disabled'|'not_configured'|'unsupported_provider'|'missing_gemini_key'};
export function selectForzaSttProvider(env:Record<string,string|undefined>):ForzaSttSelection{
  const setting=String(env.FORZA_STT_PROVIDER||'').trim().toLowerCase();
  if(!setting)return {provider:'none',reason:'not_configured'};
  if(setting==='disabled'||setting==='none'||setting==='browser')return {provider:'none',reason:'disabled'};
  // xKiro offers TTS but has no audio transcription API (as of 2026-11-03).
  if(setting!=='gemini')return {provider:'none',reason:'unsupported_provider'};
  const key=String(env.FORZA_STT_GEMINI_API_KEY||env.GEMINI_API_KEY||'')
    .trim().replace(/^['"]|['"]$/g,'');
  if(!key || /^(MY_|YOUR_|PASTE_|SET_)/.test(key))return {provider:'none',reason:'missing_gemini_key'};
  return {provider:'gemini',key,reason:'configured'};
}
