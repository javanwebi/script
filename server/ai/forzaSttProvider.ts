/** FORZA STT is independent from text/chat and Piper TTS providers.
 * The default production recognizer is the local Persian Diba/Vosk model.
 * Gemini remains an explicit compatibility option; xKiro is never an STT key.
 */
export type ForzaSttSelection =
  | {provider:'diba';modelPath:string;reason:'configured'}
  | {provider:'gemini';key:string;reason:'configured'}
  | {provider:'none';reason:'disabled'|'not_configured'|'unsupported_provider'|'missing_gemini_key'|'model_missing'};

export function selectForzaSttProvider(env:Record<string,string|undefined>):ForzaSttSelection{
  const setting=String(env.FORZA_STT_PROVIDER||'').trim().toLowerCase();
  if(setting==='disabled'||setting==='none'||setting==='browser')
    return {provider:'none',reason:'disabled'};

  if(setting==='gemini'){
    const key=String(env.FORZA_STT_GEMINI_API_KEY||env.GEMINI_API_KEY||'')
      .trim().replace(/^['"]|['"]$/g,'');
    if(!key || /^(MY_|YOUR_|PASTE_|SET_)/.test(key))
      return {provider:'none',reason:'missing_gemini_key'};
    return {provider:'gemini',key,reason:'configured'};
  }

  // Diba is the default only when its model is included in the production image.
  // Local development can keep using browser recognition without downloading it.
  if(setting===''||setting==='diba'){
    const modelPath=String(env.FORZA_STT_DIBA_MODEL_PATH||'').trim();
    if(modelPath)return {provider:'diba',modelPath,reason:'configured'};
    return {provider:'none',reason:setting==='diba'?'model_missing':'not_configured'};
  }
  return {provider:'none',reason:'unsupported_provider'};
}
