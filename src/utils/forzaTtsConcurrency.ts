/**
 * Capacity advertised by the private Nima worker's authenticated internal
 * health probe. Unknown/legacy workers deliberately fall back to one.
 */
export function normalizeForzaNimaWorkerCount(value:unknown):number{
  const parsed=typeof value==='number'||typeof value==='string'?Number(value):NaN;
  if(!Number.isFinite(parsed)||parsed<1)return 1;
  return Math.max(1,Math.min(4,Math.floor(parsed)));
}

/**
 * Keep one worker free for other calls on small pools. Only use two parallel
 * phrase syntheses when the private service has at least three isolated
 * single-threaded workers available.
 */
export function forzaNimaClientConcurrency(value:unknown):number{
  return normalizeForzaNimaWorkerCount(value)>=3?2:1;
}
