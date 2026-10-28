// Deterministic network-free browser speech mocks for FORZA smoke tests.
// The real models are large and belong in hardware/device acceptance tests.
const assert = require('node:assert/strict');

async function mockLocalVoice(page, wav) {
  const base64=wav.toString('base64');
  await page.addInitScript(() => { window.__forzaAmirSpoken=[]; });
  await page.route('**/piper-tts-web@1.0.5*', async route => {
    await route.fulfill({
      status:200,
      contentType:'application/javascript',
      headers:{'access-control-allow-origin':'*','cache-control':'no-store'},
      body:`const wavBytes=Uint8Array.from(atob("${base64}"),c=>c.charCodeAt(0));
        export async function predict({text,voiceId}){
          if(voiceId!=="fa_IR-amir-medium")throw Error("wrong voice: "+voiceId);
          window.__forzaAmirSpoken.push(text);
          return new Blob([wavBytes],{type:"audio/wav"});
        }`,
    });
  });
  await page.route('**/vosk.min.js',route=>route.fulfill({
    status:200,
    contentType:'application/javascript',
    body:'window.Vosk={createModel:async()=>({KaldiRecognizer:class{on(){} acceptWaveform(){} remove(){}}})};',
  }));
}
module.exports={mockLocalVoice};
