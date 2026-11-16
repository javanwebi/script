/** Retry transient Web Speech network failures for the life of the call.
 * Backoff is capped, but a third temporary network failure must not permanently
 * disable the microphone for every later customer turn. Permission/device
 * errors remain terminal and never trigger a prompt loop. */
export function forzaRecognitionRetryDelay(error:string,attempt:number):number|null{
 const delays=[400,1200,2800,5000,8000];
 if(error!=='network'||!Number.isInteger(attempt)||attempt<0)return null;
 return delays[Math.min(attempt,delays.length-1)];
}
