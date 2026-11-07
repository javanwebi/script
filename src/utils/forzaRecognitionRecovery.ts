/** Retry only transient recognizer network failures. Never loop permission prompts. */
export function forzaRecognitionRetryDelay(error:string,attempt:number):number|null{
 const delays=[400,1200,2800];
 return error==='network'&&Number.isInteger(attempt)&&attempt>=0&&attempt<delays.length?delays[attempt]:null;
}
