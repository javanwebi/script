/** FORZA STT is independent from chat and Piper TTS providers.
 * AvalAI GPT-Transcribe is the primary production final verifier when explicitly
 * selected; local Diba/Vosk remains the free fallback. Gemini is compatibility-only.
 */
export type ForzaSttSelection =
  | {provider:'avalai';key:string;model:'gpt-transcribe';reason:'configured'}
  | {provider:'diba';modelPath:string;reason:'configured'}
  | {provider:'gemini';key:string;reason:'configured'}
  | {provider:'none';reason:'disabled'|'not_configured'|'unsupported_provider'|'missing_gemini_key'|'missing_avalai_key'|'model_missing'};

export function selectForzaSttProvider(env:Record<string,string|undefined>):ForzaSttSelection{
  const setting=String(env.FORZA_STT_PROVIDER||'').trim().toLowerCase();
  if(setting==='disabled'||setting==='none'||setting==='browser')
    return {provider:'none',reason:'disabled'};

  if(setting==='avalai'){
    const key=String(env.AVALAI_API_KEY||'').trim().replace(/^['"]|['"]$/g,'');
    if(!key || /^(MY_|YOUR_|PASTE_|SET_)/.test(key))
      return {provider:'none',reason:'missing_avalai_key'};
    return {provider:'avalai',key,model:'gpt-transcribe',reason:'configured'};
  }

  if(setting==='gemini'){
    const key=String(env.FORZA_STT_GEMINI_API_KEY||env.GEMINI_API_KEY||'')
      .trim().replace(/^['"]|['"]$/g,'');
    if(!key || /^(MY_|YOUR_|PASTE_|SET_)/.test(key))
      return {provider:'none',reason:'missing_gemini_key'};
    return {provider:'gemini',key,reason:'configured'};
  }

  // Diba is the free local fallback when its model is included in the image.
  // Local development can keep using browser recognition without downloading it.
  if(setting===''||setting==='diba'){
    const modelPath=String(env.FORZA_STT_DIBA_MODEL_PATH||'').trim();
    if(modelPath)return {provider:'diba',modelPath,reason:'configured'};
    return {provider:'none',reason:setting==='diba'?'model_missing':'not_configured'};
  }
  return {provider:'none',reason:'unsupported_provider'};
}
