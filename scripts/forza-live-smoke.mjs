const endpoint='https://sanatpish-production.up.railway.app/api/ai/forza-live';
try {
  const response=await fetch(endpoint,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({query:'سلام',history:[]}),
    signal:AbortSignal.timeout(60000),
  });
  const result=await response.json().catch(()=>({}));
  const summary={
    httpStatus:response.status,
    success:result?.success===true,
    modelAnswerLength:String(result?.text||'').length,
    providerError:typeof result?.error==='string'?result.error.slice(0,200):undefined,
  };
  console.log('[FORZA LIVE SMOKE]',JSON.stringify(summary));
  if(!response.ok||!result?.success||!result?.text)process.exitCode=1;
}catch(e){
  console.error('[FORZA LIVE SMOKE] Request unavailable:',e?.name||'network');
  process.exitCode=1;
}
