// Network-free Piper mock for UI-flow tests (actual Piper is tested separately).
async function mockLocalVoice(page,wav){
  const base64=wav.toString('base64');
  await page.addInitScript(()=>{window.__forzaAmirSpoken=[];});
  await page.route('**/assets/piper-tts-web-*.js',async route=>{
    await route.fulfill({
      status:200,contentType:'text/javascript',headers:{'cache-control':'no-store'},
      body:`const bytes=Uint8Array.from(atob("${base64}"),c=>c.charCodeAt(0));
        export class TtsSession{
          constructor(options){
            if(options.voiceId!=="fa_IR-amir-medium")throw Error("wrong Piper voice");
            this.waitReady=Promise.resolve();
          }
          async predict(text){
            window.__forzaAmirSpoken.push(text);
            return new Blob([bytes],{type:"audio/wav"});
          }
        }`,
    });
  });
  await page.route('**/forza-runtime/stt/vosk.js',async route=>{
    await route.fulfill({status:200,contentType:'application/javascript',
      body:'window.Vosk={createModel:async()=>({KaldiRecognizer:class{on(){} acceptWaveform(){} remove(){}}})};'});
  });
}
module.exports={mockLocalVoice};
