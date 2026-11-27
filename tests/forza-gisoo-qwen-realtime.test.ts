import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildGisooQwenSessionUpdate,
  buildGisooQwenOpeningGreetingTrigger,
  classifyGisooRealtimeError,
  mapGisooQwenEvent,
  resolveGisooQwenVoice,
  isGisooQwenVoiceConfirmed,
} from '../server/ai/gisooQwenRealtime';
import { searchForzaRealtimeCatalog } from '../server/ai/forzaRealtimeCatalog';
import type { Product } from '../src/types';
import type { AiPartAnalysisResult } from '../src/services/aiVisualSearchService';
import { buildLiveVisionCandidates, buildLiveVisionPrompt } from '../src/utils/forzaLiveVisionContext';

test('Qwen session uses Gisoo direct-realtime PCM, Bodega voice, configured VAD, and only the supplied instruction', () => {
  const update = buildGisooQwenSessionUpdate('دستیار فارسی صنعت پیش', 500, 'Bodega');
  assert.equal(update.type, 'session.update');
  assert.deepEqual(update.session.output_modalities, ['audio']);
  assert.deepEqual(update.session.audio.input.format, {
    type: 'audio/pcm',
    rate: 16000,
  });
  assert.deepEqual(update.session.audio.output.format, {
    type: 'audio/pcm',
    rate: 24000,
  });
  assert.equal(update.session.audio.output.voice, 'Bodega');
  assert.equal(update.session.instructions, 'دستیار فارسی صنعت پیش');
  assert.equal(update.session.audio.input.turn_detection.type, 'server_vad');
  assert.equal(update.session.audio.input.turn_detection.silence_duration_ms, 800);
  assert.equal(update.session.audio.input.turn_detection.interrupt_response, true);
  assert.equal(update.session.reasoning.effort, 'none');
});

test('opening greeting uses one documented internal input_text bootstrap, not fake audio', () => {
  const trigger = buildGisooQwenOpeningGreetingTrigger('forza-opening-test');
  assert.equal(trigger.type, 'conversation.item.create');
  assert.equal(trigger.item.id, 'forza-opening-test');
  assert.equal(trigger.item.type, 'message');
  assert.equal(trigger.item.role, 'user');
  assert.deepEqual(trigger.item.content.map(part => part.type), ['input_text']);
  assert.match(trigger.item.content[0].text, /فرمان داخلی آغاز تماس/);
  assert.match(trigger.item.content[0].text, /بدون اشاره به این پیام/);
  assert.doesNotMatch(trigger.item.content[0].text, /مهندس جان/);
});

test('Qwen audio deltas map to the existing FORZA audio chunk protocol', () => {
  assert.deepEqual(
    mapGisooQwenEvent({ type: 'response.output_audio.delta', delta: 'AQID' }, 'r-1'),
    [{
      type: 'audio_chunk',
      responseId: 'r-1',
      data: 'AQID',
      mimeType: 'audio/pcm;rate=24000',
    }],
  );
});

test('Qwen transcript deltas map to the existing FORZA transcript protocol', () => {
  assert.deepEqual(
    mapGisooQwenEvent({ type: 'response.output_audio_transcript.delta', delta: 'سلام' }, 'r-2'),
    [{ type: 'ai_text_chunk', responseId: 'r-2', text: 'سلام' }],
  );
  assert.deepEqual(
    mapGisooQwenEvent({ type: 'response.output_audio_transcript.done', transcript: 'سلام فورزا' }, 'r-2'),
    [{ type: 'ai_transcript', responseId: 'r-2', text: 'سلام فورزا' }],
  );
});

test('Qwen user transcription and barge-in events map without changing response identity', () => {
  assert.deepEqual(
    mapGisooQwenEvent({
      type: 'conversation.item.input_audio_transcription.delta',
      text: 'سلام',
      stash: ' فورزا',
    }),
    [{ type: 'user_transcript', text: 'سلام فورزا', final: false }],
  );
  assert.deepEqual(
    mapGisooQwenEvent({ type: 'input_audio_buffer.speech_started' }, 'r-3'),
    [{ type: 'interrupted', responseId: 'r-3' }],
  );
});

test('Qwen response completion maps to FORZA turn_complete', () => {
  assert.deepEqual(
    mapGisooQwenEvent({ type: 'response.done' }, 'r-4'),
    [{ type: 'turn_complete', responseId: 'r-4' }],
  );
});


test('Qwen late completion keeps the provider response identity', () => {
  assert.deepEqual(mapGisooQwenEvent({ type: 'response.done', response: { id: 'old' } }, 'new'), [
    { type: 'turn_complete', responseId: 'old' },
  ]);
  assert.deepEqual(mapGisooQwenEvent({ type: 'response.output_audio.delta', response_id: 'old', delta: 'AQID' }, 'new'), [
    { type: 'audio_chunk', responseId: 'old', data: 'AQID', mimeType: 'audio/pcm;rate=24000' },
  ]);
});

test('Qwen invalid VAD duration uses a finite default', () => {
  assert.equal(buildGisooQwenSessionUpdate('فارسی', NaN).session.audio.input.turn_detection.silence_duration_ms, 900);
});

test('Face-to-face page actually mounts the native Gisoo client without the old speech endpoints', () => {
  const page=readFileSync('src/pages/AiForzaPage.tsx','utf8');
  const client=readFileSync('src/components/forza/ForzaQwenCallExperience.tsx','utf8');
  assert.match(page,/import\('\.\.\/components\/forza\/ForzaQwenCallExperience'\)/);
  assert.match(client,/\/api\/live\?provider=qwen/);
  assert.match(client,/type:'realtime_audio'/);
  assert.doesNotMatch(client,/\/api\/ai\/(?:stt|forza-speech|consult-stream|forza-live)/);
});

test('Customer barge-in remains intact and Gisoo generates one opening greeting after session acceptance', () => {
  const server=readFileSync('server/ai/gisooQwenRealtime.ts','utf8');
  const client=readFileSync('src/components/forza/ForzaQwenCallExperience.tsx','utf8');
  const app=readFileSync('server.ts','utf8');
  const prompt=app.match(/const FORZA_QWEN_SYSTEM_INSTRUCTION = `([\s\S]*?)`;/)?.[1]||'';
  assert.match(server,/speech_started'\)\{userSpeaking=true;[\s\S]*?send\(\{type:'response.cancel'\}\)/);
  assert.match(client,/if\(!s\.ready\|\|micMuted\.current\|\|scanning\.current/);
  assert.match(client,/setPhase\('listening'\);return;/);
  assert.doesNotMatch(client,/greeted|type:'text',text:greeting|سلام، به صنعت پیش خوش آمدید/);
  assert.match(prompt,/تو فورزا، مشاور فنی و راهنمای تأمین قطعات صنعتی صنعت پیش هستی/);
  assert.match(prompt,/مکالمه زنده و پیوسته بین دو انسان/);
  assert.match(prompt,/به محض دریافت این فرمان داخلی/);
  assert.match(prompt,/فرمان داخلی آغاز تماس است و حرف مشتری نیست/);
  assert.match(prompt,/سلام، به صنعت پیش خوش آمدید/);
  assert.match(prompt,/فقط یک‌بار طبیعی خوشامد بگو/);
  assert.match(prompt,/این تنها خوشامدگویی و معرفی تو در کل تماس است/);
  assert.match(prompt,/حتی اگر مشتری دوباره سلام کرد/);
  assert.match(server,/send\(buildGisooQwenOpeningGreetingTrigger\(greetingTriggerId\)\)/);
  assert.match(server,/greetingSeedPending&&\(receivedItemId===greetingTriggerId\|\|triggerText\)/);
  assert.match(server,/greetingResponsePending=true/);
  assert.match(server,/send\(\{type:'response\.create'\}\)/);
  assert.match(server,/log\('opening_greeting_requested'/);
  assert.doesNotMatch(prompt,/هیچ خوشامدگویی خودکار یا پیام آغازینی نساز/);
  assert.doesNotMatch(prompt,/۲۵ تا ۶۰ کلمه|۴ تا ۷ جمله/);
  assert.match(app,/connectGisooQwenRealtime\(clientWs, FORZA_QWEN_SYSTEM_INSTRUCTION/);
  assert.match(app,/systemInstruction: FORZA_SYSTEM_INSTRUCTION/);
  assert.doesNotMatch(server,/const ADVICE=|۷۰ تا ۱۳۰ کلمه/);
});
 test('Native capture and stable light are enabled for exhibition calls', () => {
  const client=readFileSync('src/components/forza/ForzaQwenCallExperience.tsx','utf8');
  const worklet=readFileSync('public/forza-runtime/qwen-mic-worklet.js','utf8');
  assert.match(client,/new AudioWorkletNode/);
  assert.match(client,/intensity=\{1\} stableLight/);
  assert.match(worklet,/sampleRate \* 0\.02/);
 });


test('recoverable Gisoo flood errors do not tear down an established realtime session', () => {
  assert.equal(classifyGisooRealtimeError('flood', true), 'recoverable');
  assert.equal(classifyGisooRealtimeError('rate_limit_exceeded', true), 'recoverable');
  assert.equal(classifyGisooRealtimeError('session_closed', true), 'recoverable');
  assert.equal(classifyGisooRealtimeError('server_restart', true), 'recoverable');
  assert.equal(classifyGisooRealtimeError('insufficient_credit', true), 'fatal');
  assert.equal(classifyGisooRealtimeError('flood', false), 'recoverable');
  assert.equal(classifyGisooRealtimeError('rate_limit_exceeded', false), 'recoverable');
  assert.equal(classifyGisooRealtimeError('server_error', false), 'recoverable');
  assert.equal(classifyGisooRealtimeError('response_cancel_not_active', true), 'ignore');
  assert.equal(classifyGisooRealtimeError('conversation_already_has_active_response', true), 'active_response');
  const client=readFileSync('src/components/forza/ForzaQwenCallExperience.tsx','utf8');
  assert.match(client,/m\.type==='provider_error'/);
  assert.match(client,/اتصال برقرار است/);
});


test('Qwen realtime session exposes the read-only Sanat Pish catalogue tool without appending a second prompt', () => {
  const update = buildGisooQwenSessionUpdate('دستیار فارسی صنعت پیش', 500, 'Ryan');
  assert.equal(update.session.audio.output.voice, 'Ryan');
  assert.equal(update.session.max_output_tokens, 1536);
  assert.equal(update.session.tools[0].type, 'function');
  assert.equal(update.session.tools[0].name, 'search_sanatpish_catalog');
  assert.deepEqual(update.session.tools[0].parameters.required, ['query']);
  assert.equal(update.session.instructions, 'دستیار فارسی صنعت پیش');
  assert.doesNotMatch(update.session.instructions, /سلام|مهندس جان|جمله|خوشامدگویی/);
});

test('live catalogue lookup returns real family/SKU metadata without commercial fields', () => {
  const products = [{
    code: 'BEARING-FAMILY',
    name: 'بلبرینگ شیار عمیق',
    brand: 'SKF',
    categorySlug: 'bearings',
    categoryName: 'بلبرینگ',
    subcategory: 'شیار عمیق',
    technicalSpecs: [{ key: 'نوع', value: 'شیار عمیق' }],
    prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
    stock: 99,
    inquiryOnly: true,
    images: ['/storage/products/catalog/bearing-family.webp'],
    active: true,
    variants: [
      { code: '6205-2RS', name: 'بلبرینگ 6205 2RS', size: '25×52×15', price: 100, stock: 10, active: true },
      { code: '6206-ZZ', name: 'بلبرینگ 6206 ZZ', size: '30×62×16', price: 200, stock: 20, active: true },
    ],
  }] as unknown as Product[];

  const result = searchForzaRealtimeCatalog(products, 'بلبرینگ می‌خواهم', 6);
  assert.equal(result.success, true);
  assert.equal(result.familyCount, 1);
  assert.equal(result.results[0].code, 'BEARING-FAMILY');
  assert.equal(result.results[0].variants.length, 2);
  assert.equal(result.results[0].variants[0].code, '6205-2RS');
  assert.equal(result.results[0].link, '/product/BEARING-FAMILY');
  assert.equal(JSON.stringify(result).includes('"price"'), false);
  assert.equal(JSON.stringify(result).includes('"stock"'), false);
});

test('native Gisoo server executes catalogue function calls and returns tool output', () => {
  const server = readFileSync('server/ai/gisooQwenRealtime.ts', 'utf8');
  const app = readFileSync('server.ts', 'utf8');
  assert.match(server, /response\.function_call_arguments\.done/);
  assert.match(server, /function_call_output/);
  assert.match(server, /type:'catalog_results'/);
  assert.match(server, /cancelled\.has\(response\)&&pendingText&&!userSpeaking/);
  assert.match(server, /toolResponseId&&cancelled\.has\(toolResponseId\)/);
  assert.match(app, /connectGisooQwenRealtime\(clientWs, FORZA_QWEN_SYSTEM_INSTRUCTION, searchForzaLiveCatalog, resuming\)/);
  assert.match(app, /systemInstruction: FORZA_SYSTEM_INSTRUCTION/);
});

test('live call renders catalogue product cards and does not disconnect on a twelve-second audio queue', () => {
  const client = readFileSync('src/components/forza/ForzaQwenCallExperience.tsx', 'utf8');
  assert.match(client, /m\.type==='catalog_results'/);
  assert.match(client, /نتایج کاتالوگ صنعت پیش/);
  assert.match(client, /href=\{family\.link\}/);
  assert.match(client, /s\.next-ctx\.currentTime>90/);
  assert.doesNotMatch(client, /s\.next-ctx\.currentTime>12/);
  assert.match(client, /useState\('Bodega'\)/);
});


test('FORZA selects a different documented Qwen3.8 male voice and rejects silent voice fallback', () => {
  assert.equal(resolveGisooQwenVoice(undefined), 'Bodega');
  assert.equal(resolveGisooQwenVoice('Andre'), 'Bodega');
  assert.equal(resolveGisooQwenVoice('andre'), 'Bodega');
  assert.equal(resolveGisooQwenVoice('Bodega'), 'Bodega');
  assert.equal(resolveGisooQwenVoice('Ryan'), 'Ryan');
  assert.equal(resolveGisooQwenVoice('Raymond'), 'Raymond');
  assert.equal(resolveGisooQwenVoice('Aiden'), 'Aiden');
  assert.equal(resolveGisooQwenVoice('Tina'), 'Bodega');
  assert.equal(resolveGisooQwenVoice('Ethan'), 'Bodega');
  assert.equal(resolveGisooQwenVoice('unsupported-voice'), 'Bodega');
  assert.equal(buildGisooQwenSessionUpdate('مشاور فنی فارسی').session.audio.output.voice, 'Bodega');
  assert.equal(isGisooQwenVoiceConfirmed({audio:{output:{voice:'Bodega'}}},'Bodega'),true);
  assert.equal(isGisooQwenVoiceConfirmed({audio:{output:{voice:'Tina'}}},'Bodega'),false);
  assert.equal(isGisooQwenVoiceConfirmed({},'Bodega'),false);
});

test('Browser reports actual laptop microphone noise-processing settings without exposing device identity', () => {
  const client=readFileSync('src/components/forza/ForzaQwenCallExperience.tsx','utf8');
  const server=readFileSync('server/ai/gisooQwenRealtime.ts','utf8');
  assert.match(client,/getSettings\(\)/);
  assert.match(client,/type:'capture_settings'/);
  assert.match(server,/log\('capture_settings'/);
  assert.doesNotMatch(client,/deviceId:|label:capture/);
});

test('Realtime bridge records privacy-safe microphone energy, VAD, and first-audio timing without logging audio payloads', () => {
  const server = readFileSync('server/ai/gisooQwenRealtime.ts', 'utf8');
  assert.match(server, /log\('mic_first_frame'/);
  assert.match(server, /log\('mic_stream'/);
  assert.match(server, /rms:micSamples\?Math\.round\(Math\.sqrt\(micSquareSum\/micSamples\)\):0/);
  assert.match(server, /log\('speech_started'/);
  assert.match(server, /log\('speech_stopped'/);
  assert.match(server, /log\('response_created'/);
  assert.match(server, /log\('first_audio'/);
  assert.match(server, /type:'input_audio_buffer\.append',audio:e\.audio/);
  assert.doesNotMatch(server, /log\('mic_stream',[^\n]*audio:e\.audio/);
});

test('catalogue cards retain visible products during follow-up speech and expose direct SKU links', () => {
  const client = readFileSync('src/components/forza/ForzaQwenCallExperience.tsx', 'utf8');
  const start = client.indexOf("if(m.type==='speech_started')");
  const end = client.indexOf("if(m.type==='speech_stopped')", start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(client.slice(start, end), /setCatalogResults|setCatalogQuery/);
  assert.match(client, /href=\{'\/direct-product\/'\+encodeURIComponent\(variant\.code\)\}/);
  assert.match(client, /useState\('Bodega'\)/);
});

test('reconnect seeds context only on resumed calls and avoids an opening greeting',()=>{
 const server=readFileSync('server/ai/gisooQwenRealtime.ts','utf8');
 const client=readFileSync('src/components/forza/ForzaQwenCallExperience.tsx','utf8');
 assert.match(server,/if\(resuming\)\{toClient\(\{type:'connected',[^\n]*resumed:true\}\);return;\}greetingTriggerId=/);
 assert.match(server,/if\(!resuming\|\|resumeSeedAccepted\)return/);
 assert.match(client,/retryCount\.current<5/);
 assert.match(client,/m\.retryable===true/);
 assert.match(server,/retryable=false/);
 assert.match(server,/browser_heartbeat_timeout/);
 assert.match(client,/type:'resume_context'/);
 assert.match(client,/type:'ping'/);
 assert.match(client,/m\.type==='pong'/);
 assert.match(client,/clearInterval\(s\.heartbeat\)/);
});
test('live image input reuses the existing region detector and embedding service without full-screen navigation',()=>{
 const client=readFileSync('src/components/forza/ForzaQwenCallExperience.tsx','utf8');
 assert.match(client,/detectImageRegions\(base64\)/);
 assert.match(client,/analyzePartWithAi\(\{imageBase64:base64/);
 assert.match(client,/includeNearest:true/);
 assert.match(client,/buildLiveVisionCandidates\(result\)/);
 assert.match(client,/buildLiveVisionPrompt\(result,items\)/);
 assert.doesNotMatch(client,/ImageSearch isOpen fullScreen/);
});

test('embedding-only model and nearest results reach the call with real codes, specs, and distinct uncertainty',()=>{
 const suggestion={familyCode:'BELT-FAMILY',familyName:'تسمه',name:'تسمه صنعتی',brand:'Brand',imageScope:'none' as const,matchBasis:'family' as const,specs:[{key:'عرض',value:'13 mm'}],reason:'خانواده مشابه'};
 const result={success:true,isAiGenerated:true,matchedProducts:[],similarCandidates:[],summary:{detectedPartType:'تسمه',detectedProfile:'تأیید نشده',visualAnalysis:'شباهت',confidence:0},technicalAdvice:'ابعاد را بررسی کنید',
 modelSuggestions:[{...suggestion,code:'A49',matchBasis:'visual',image:'/not-authorized.png'}],
 nearestCatalogSuggestions:[{...suggestion,code:'A49',matchBasis:'explore'},{...suggestion,familyCode:'OTHER',matchBasis:'explore'}]} as AiPartAnalysisResult;
 const candidates=buildLiveVisionCandidates(result);
 assert.equal(candidates.length,2);
 assert.equal(candidates[0].code,'A49');
 assert.equal(candidates[0].basis,'similar');
 assert.equal(candidates[0].image,undefined);
 assert.equal(candidates[0].link,'/direct-product/A49');
 assert.equal(candidates[1].basis,'explore');
 assert.equal(candidates[1].link,'/product/OTHER');
 const prompt=buildLiveVisionPrompt(result,candidates);
 assert.match(prompt,/A49/);
 assert.match(prompt,/13 mm/);
 assert.match(prompt,/OTHER/);
 assert.ok(prompt.length<3000);
});
test('visual consultation payload remains complete JSON within the bridge limit',()=>{
 const result={matchedProducts:[],summary:{whatYouSee:'الف'.repeat(5000),readableMarkings:['x'.repeat(400)]},catalogImageMatches:[],modelSuggestions:Array.from({length:16},(_,i)=>({familyCode:'family'+i,code:'SKU'+i,name:'تسمه'.repeat(200),familyName:'تسمه',brand:'brand',imageScope:'none',matchBasis:'visual',specs:Array.from({length:12},()=>({key:'عرض'.repeat(100),value:'100'.repeat(100)})),reason:'شبیه'.repeat(100)}))} as unknown as AiPartAnalysisResult;
 const prompt=buildLiveVisionPrompt(result,buildLiveVisionCandidates(result));
 assert.ok(prompt.length<=2900);
 const payload=JSON.parse(prompt.slice(prompt.indexOf('{')));
 assert.ok(payload.candidates.length>0);
 assert.ok(payload.candidates.length<16);
});

test('exact SKU lookup prioritizes the requested active code and exposes its own technical specs only',()=>{
 const product={code:'BELTS',name:'تسمه',brand:'SWR',images:[],technicalSpecs:[{key:'نوع',value:'V'}],variants:[
 ...Array.from({length:12},(_,i)=>({code:'A19'+i,name:'تسمه دیگر',size:'19',active:true})),
 {code:'A19',name:'تسمه مورد نظر',size:'13×8',model:'A',technicalSpecs:[{key:'عرض',value:'13 mm'}],description:'مدل ثبت شده',price:100,stock:10,active:true},
 {code:'A1900',name:'غیرفعال',size:'',active:false}
 ]} as unknown as Product;
 const result=searchForzaRealtimeCatalog([product], 'A۱۹');
 assert.equal(result.familyCount,1);
 assert.equal(result.results[0].variants[0].code,'A19');
 assert.deepEqual(result.results[0].variants[0].technicalSpecs,[{key:'عرض',value:'13 mm'}]);
 assert.equal(result.results[0].variants[0].link,'/direct-product/A19');
 assert.ok(!result.results[0].variants.some(v=>v.code==='A1900'));
 assert.doesNotMatch(JSON.stringify(result), /"price"|"stock"/);
});

test('Qwen realtime uses a natural Persian pause and exposes exact detail and comparison tools',()=>{
 const update=buildGisooQwenSessionUpdate('مشاور');
 assert.equal(update.session.audio.input.turn_detection.silence_duration_ms,900);
 assert.equal(update.session.tools.length,4);
 assert.equal(update.session.tools[0].name,'search_sanatpish_catalog');
 assert.equal(update.session.tools[1].name,'get_sanatpish_product_details');
 assert.deepEqual(update.session.tools[1].parameters.required,['code']);
 assert.equal(update.session.tools[2].name,'compare_sanatpish_products');
 assert.deepEqual(update.session.tools[2].parameters.required,['codes']);
 assert.equal(update.session.tools[3].name,'update_forza_consultation');
 assert.deepEqual(update.session.tools[3].parameters.required,['stage','summary','knownFacts','missingFacts']);
 assert.ok(update.session.tools[3].parameters.properties.knownFacts);
 assert.ok(update.session.tools[3].parameters.properties.missingFacts);
});
test('transport protects the call from brief backpressure and records provider close diagnostics',()=>{
 const server=readFileSync('server/ai/gisooQwenRealtime.ts','utf8');
 const client=readFileSync('src/components/forza/ForzaQwenCallExperience.tsx','utf8');
 assert.match(server,/upstream\.ping\(\)/);
 assert.match(server,/upstream\.on\('pong'/);
 assert.match(server,/client\.on\('pong'/);
 assert.match(server,/browser_heartbeat_timeout/);
 assert.match(server,/upstream_closed/);
 assert.match(server,/session_end/);
 assert.match(server,/session_started/);
 assert.match(server,/session_rejected/);
 assert.match(server,/upstream_audio_backpressure_started/);
 assert.match(server,/upstreamCongestedNotice&&queued<32768/);
 assert.match(server,/browser_output_backpressure/);
 assert.match(server,/network_degraded/);
 assert.match(client,/retryCount\.current<5/);
 assert.match(client,/document\.visibilityState==='visible'/);
 assert.match(client,/window\.addEventListener\('online'/);
 assert.match(client,/micCongestedSince/);
 assert.doesNotMatch(client,/bufferedAmount>262144\)\{fail/);
});
test('mic resampling and PCM conversion run in AudioWorklet for the primary path',()=>{
 const worklet=readFileSync('public/forza-runtime/qwen-mic-worklet.js','utf8');
 const client=readFileSync('src/components/forza/ForzaQwenCallExperience.tsx','utf8');
 assert.match(worklet,/targetRate = 16000/);
 assert.match(worklet,/new Int16Array\(outputLength\)/);
 assert.match(worklet,/this\.port\.postMessage\(pcm, \[pcm\.buffer\]\)/);
 assert.match(client,/e\.data instanceof Int16Array/);
 assert.match(client,/encodePcm16\(samples\)/);
});
test('FORZA consultant prompt follows a staged industrial diagnostic and recommendation workflow',()=>{
 const app=readFileSync('server.ts','utf8');
 const prompt=app.match(/const FORZA_QWEN_SYSTEM_INSTRUCTION = `([\s\S]*?)`;/)?.[1]||'';
 for(const term of ['پرونده مهندسی','تسمه‌ها','بلبرینگ و رولبرینگ','عیب‌یابی','کاتالوگ واقعی','دلیل انتخاب','یک سؤال مهم','وایسا','بله، بفرمایید'])assert.ok(prompt.includes(term),term);
 assert.match(prompt,/get_sanatpish_product_details/);
 assert.match(prompt,/compare_sanatpish_products/);
 assert.match(prompt,/update_forza_consultation/);
});
test('catalog lookup does not claim success when no family or SKU matched',()=>{
 const products=[{code:'OTHER',name:'قطعه دیگر',brand:'',categorySlug:'other',categoryName:'سایر',subcategory:'',technicalSpecs:[],prices:{base:0,retail:0,wholesale:0,dealer:0},stock:0,inquiryOnly:true,images:[],tags:[],unit:'عدد',active:true,variants:[]}] as unknown as Product[];
 const result=searchForzaRealtimeCatalog(products,'قطعه ناشناخته');
 if(result.results.length===0)assert.equal(result.success,false);
});

test('live Qwen call keeps a provider-safe concurrency ceiling configurable up to forty sessions',()=>{
 const server=readFileSync('server/ai/gisooQwenRealtime.ts','utf8');
 assert.match(server,/FORZA_QWEN_MAX_SESSIONS\|\|8\),8,1,40/);
});
test('reconnect preserves transcript and vision context while avoiding false background heartbeat timeouts',()=>{
 const client=readFileSync('src/components/forza/ForzaQwenCallExperience.tsx','utf8');
 assert.match(client,/history\.current=\[\.\.\.history\.current,\{role,text\}\]\.slice\(-8\)/);
 assert.match(client,/visibilitychange/);
 assert.match(client,/visibilityHandler=\(\)=>\{if\(document\.visibilityState==='visible'\)/);
 assert.match(client,/document\.removeEventListener\('visibilitychange'/);
});
test('parallel Qwen function calls wait for every tool output and create only one continuation',()=>{
 const server=readFileSync('server/ai/gisooQwenRealtime.ts','utf8');
 const start=server.indexOf('const runCatalogTool');
 const end=server.indexOf("client.on('pong'",start);
 const handler=server.slice(start,end);
 assert.match(server,/toolPendingCounts\.set\(toolResponseId,\(toolPendingCounts\.get\(toolResponseId\)\|\|0\)\+1\)/);
 assert.match(server,/toolResponseDone\.add\(response\)/);
 assert.match(server,/continueAfterToolCalls\(response\)/);
 assert.match(server,/completeToolCall\(toolResponseId\)/);
 assert.doesNotMatch(handler,/type:'response\.create'/);
 assert.match(server,/if\(!send\(\{type:'response\.create'\}\)\)/);
});
test('barge-in cancellation is bounded and clears stale active responses',()=>{
 const server=readFileSync('server/ai/gisooQwenRealtime.ts','utf8');
 assert.match(server,/cancelActiveResponse/);
 assert.match(server,/cancelTimer=setTimeout/);
 assert.match(server,/response_cancel_timeout/);
 assert.match(server,/response_cancel_not_active&&active&&cancelled\.has\(active\)/);
});
test('provider failures cannot leave the live assistant waiting forever for a response start',()=>{
 const server=readFileSync('server/ai/gisooQwenRealtime.ts','utf8');
 assert.match(server,/responseStartTimer=setTimeout/);
 assert.match(server,/response_start_timeout/);
 assert.match(server,/send\(\{type:'response\.cancel'\}\)/);
 assert.match(server,/\['flood','rate_limit_exceeded','server_error','temporarily_unavailable'\]/);
 assert.match(server,/authentication_error/);
});

test('live call displays and restores a real consultation stage instead of a decorative progress bar',()=>{
 const client=readFileSync('src/components/forza/ForzaQwenCallExperience.tsx','utf8');
 const server=readFileSync('server/ai/gisooQwenRealtime.ts','utf8');
 assert.match(client,/CONSULTATION_STAGES/);
 assert.match(client,/m\.type==='consultation_update'/);
 assert.match(client,/consultation:consultationRef\.current/);
 assert.match(client,/consultationState\.knownFacts/);
 assert.match(client,/consultationState\.missingFacts/);
 assert.match(server,/type:'consultation_update'/);
 assert.match(server,/update_forza_consultation/);
 assert.match(server,/knownFacts,missingFacts/);
 assert.match(server,/invalid_consultation_stage/);
});
