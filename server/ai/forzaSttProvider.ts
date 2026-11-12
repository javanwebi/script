/** FORZA STT is independent from the xKiro text model and Piper Nima TTS.
 * Production speech recognition uses only the local Persian Diba/Vosk model.
 * Cloud/Gemini STT is deliberately unsupported for the live FORZA call.
 */
export type ForzaSttSelection =
  | {provider:'diba';modelPath:string;reason:'configured'}
  | {provider:'none';reason:'disabled'|'not_configured'|'unsupported_provider'|'model_missing'};

export function selectForzaSttProvider(env:Record<string,string|undefined>):ForzaSttSelection{
  const setting=String(env.FORZA_STT_PROVIDER||'').trim().toLowerCase();
  if(setting==='disabled'||setting==='none'||setting==='browser')
    return {provider:'none',reason:'disabled'};

  // FORZA speech recognition is local Diba/Vosk only. A Gemini setting is
  // rejected rather than silently enabling a cloud speech provider.
  if(setting==='gemini')
    return {provider:'none',reason:'unsupported_provider'};

  // Diba is the default only when its model is included in the production image.
  // Local development can keep using browser recognition without downloading it.
  if(setting===''||setting==='diba'){
    const modelPath=String(env.FORZA_STT_DIBA_MODEL_PATH||'').trim();
    if(modelPath)return {provider:'diba',modelPath,reason:'configured'};
    return {provider:'none',reason:setting==='diba'?'model_missing':'not_configured'};
  }
  return {provider:'none',reason:'unsupported_provider'};
}
