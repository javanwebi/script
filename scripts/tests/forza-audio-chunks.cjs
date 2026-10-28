// Browser control-flow smoke only. Uses fake microphones and mocked WAV audio.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {mockLocalVoice}=require('./forza-browser-voice-mock.cjs');
const wave=Buffer.alloc(44+9600);
wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);
wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);
wave.writeUInt32LE(24000,24);wave.writeUInt32LE(48000,28);
wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);
wave.write('data',36);wave.writeUInt32LE(9600,40);
(async()=>{
  const browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',
  ]});
  try {
    const page=await browser.newPage();
    const greeting='سَلام، بِه صَنعَت پیش خُوش آمَدید. مَن فورزا هَستَم وَ بَرایِ رَهنَمایی شُما آمادِه‌اَم.';
    const fullAnswer='سلام، قطعه در کاتالوگ صنعت پیش ثبت شده است. لطفاً کد فنی را بفرمایید.';
    let streamCalls=0;
    await page.addInitScript(()=>{
      window.__micRequested=false;
      const original=navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
      if(original)navigator.mediaDevices.getUserMedia=async(...args)=>{
        window.__micRequested=true;
        return original(...args);
      };
    });
    await mockLocalVoice(page,wave);
    await page.route('**/api/ai/consult-stream',async route=>{
      streamCalls++;
      const request=route.request().postDataJSON();
      assert.equal(request.mode,'forza');
      const answer=[
        {type:'start',responseId:'mock-1'},
        {type:'text_chunk',responseId:'mock-1',chunk:'سلام، قطعه در کاتالوگ صنعت پیش ثبت شده است.'},
        {type:'text_chunk',responseId:'mock-1',chunk:' لطفاً کد فنی را بفرمایید.'},
        {type:'done',responseId:'mock-1',fullText:fullAnswer},
      ];
      await route.fulfill({status:200,contentType:'text/event-stream; charset=utf-8',
        body:answer.map(x=>'data: '+JSON.stringify(x)+'\n\n').join('')});
    });
    await page.route('**/api/ai/forza-live',route=>route.fulfill({
      json:{success:true,userTranscript:'تسمه',text:fullAnswer}
    }));
    await page.goto('http://127.0.0.1:4173/ai-forza');
    assert.equal(await page.getByText('برای شنیدن صدای هوش مصنوعی فورزا اینجا کلیک کنید').count(),0);
    assert.equal(await page.getByText('تلاش مجدد برای فعال‌کردن میکروفون').count(),0);
    await page.waitForFunction(()=>window.__micRequested===true,{},{timeout:15000});
    await page.waitForFunction((expected)=>window.__ttsSent===true || !!document.querySelector('.forza-stage'),{},{timeout:15000});
    await page.waitForFunction(()=>document.body.innerText.includes('فورزا گوش می‌دهد'),{},{timeout:80000});
    const greetingSpoken=await page.evaluate(()=>window.__forzaAmirSpoken);
    assert.equal(greetingSpoken.length,0,'prerecorded Amir greeting must not be synthesized twice');
    await page.getByRole('button',{name:'تایپ پیام متنی',exact:true}).click();
    await page.getByPlaceholder('سؤال فنی خود را تایپ کنید...').fill('تسمه');
    const send=page.getByRole('button',{name:'ارسال به هوش مصنوعی',exact:true});
    await send.click();
    await page.waitForFunction(()=>document.body.innerText.includes('لطفاً کد فنی'),{},{timeout:20000});
    await page.waitForFunction(()=>document.body.innerText.includes('فورزا گوش می‌دهد'),{},{timeout:30000});
    assert.ok(streamCalls>=1,'must use direct Gemini SSE endpoint');
    const ttsTexts=await page.evaluate(()=>window.__forzaAmirSpoken);
    assert.ok(ttsTexts.length>=1,'must synthesize reply speech locally with Amir');
    assert.ok(ttsTexts.every(x=>x.length<=240),'speech phrases must be bounded');
    console.log('PASS: automatic mic acquisition; no retry/unlock buttons; greeting and streamed reply TTS (mock audio).');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
