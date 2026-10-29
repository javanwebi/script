// Network-free Pocket TTS mock for FORZA browser UI-flow tests.
async function mockLocalVoice(page,wav){
  const base64=wav.toString('base64');
  await page.addInitScript(()=>{window.__forzaAmirSpoken=[];});
  await page.route('**/api/ai/forza-speech',async route=>{
    const text=route.request().postDataJSON()?.text||'';
    await page.evaluate(t=>window.__forzaAmirSpoken.push(t),text);
    await route.fulfill({status:200,contentType:'audio/wav',
      headers:{'X-Forza-Voice':'pocket-farsi-v2-male'},body:wav});
  });
  await page.route('**/forza-runtime/stt/vosk.js',async route=>{
    await route.fulfill({status:200,contentType:'application/javascript',
      body:'window.Vosk={createModel:async()=>({KaldiRecognizer:class{on(){} acceptWaveform(){} remove(){}}})};'});
  });
}
module.exports={mockLocalVoice};
