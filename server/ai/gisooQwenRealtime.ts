import { WebSocket } from 'ws';
import type { RawData } from 'ws';

const MODEL='qwen3.8-omni-flash-realtime';
const DEFAULT_URL='wss://ir.gisoo.pro/api/v1/realtime?model='+MODEL;
const VOICES=new Set(['Raymond','Ryan','Bodega','Aiden','Wil','Evan','Eric','Peter','Marcus','Rizky','Jakub','Alek','Arda','Dolce','Emilien','Andre']);
const DEFAULT_VOICE='Bodega';
type Event=Record<string,any>;
export type GisooCatalogSearchHandler=(query:string,limit:number)=>Promise<unknown>|unknown;
let activeSessions=0;
export function resolveGisooQwenVoice(configuredValue:unknown=process.env.FORZA_QWEN_VOICE){const configured=String(configuredValue||'').trim();if(configured.toLowerCase()==='andre')return DEFAULT_VOICE;const selected=VOICES.has(configured)?configured:[...VOICES].find(candidate=>candidate.toLowerCase()===configured.toLowerCase());return selected||DEFAULT_VOICE;}
export function isGisooQwenVoiceConfirmed(session:Event,selectedVoice:string){const reported=session?.audio?.output?.voice??session?.voice;return typeof reported==='string'&&reported.trim().toLowerCase()===selectedVoice.toLowerCase();}
function voice(){return resolveGisooQwenVoice();}
function bounded(n:number,fallback:number,min:number,max:number){return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):fallback;}
function decode(raw:RawData):Event{return JSON.parse((Buffer.isBuffer(raw)?raw:Array.isArray(raw)?Buffer.concat(raw):Buffer.from(raw as ArrayBuffer)).toString('utf8'));}
function id(e:Event,fallback=''){return String(e.response_id||e.response?.id||fallback);}
export function buildGisooQwenSessionUpdate(instructions:string,silenceDurationMs=500,selectedVoice=voice()){
  return {
    type:'session.update',
    session:{
      output_modalities:['audio'],
      instructions:instructions.slice(0,16000),
      audio:{
        input:{format:{type:'audio/pcm',rate:16000},turn_detection:{type:'server_vad',threshold:0.5,prefix_padding_ms:300,silence_duration_ms:bounded(silenceDurationMs,500,500,2500),create_response:true,interrupt_response:true}},
        output:{format:{type:'audio/pcm',rate:24000},voice:selectedVoice}
      },
      tools:[{
        type:'function',
        name:'search_sanatpish_catalog',
        description:'جست‌وجوی فقط‌خواندنی در کاتالوگ زنده صنعت پیش برای نام قطعه، خانواده محصول یا کد SKU. هنگام درخواست خرید، یافتن یا مقایسه قطعه از این ابزار استفاده کن. فقط نتایج واقعی کاتالوگ برگردانده می‌شوند و قیمت/موجودی در خروجی نیست.',
        parameters:{
          type:'object',
          properties:{
            query:{type:'string',description:'نام فارسی قطعه یا کد دقیق کالا؛ در صورت نیاز مترادف رایج انگلیسی'},
            limit:{type:'integer',minimum:1,maximum:6,description:'حداکثر تعداد خانواده‌های محصول؛ پیش‌فرض ۶'}
          },
          required:['query'],
          additionalProperties:false
        }
      }],
      reasoning:{effort:'none'},
      max_output_tokens:1536
    }
  };
}
export function buildGisooQwenOpeningGreetingTrigger(itemId:string){
  return {
    type:'conversation.item.create',
    item:{
      id:itemId,
      type:'message',
      role:'user',
      content:[{
        type:'input_text',
        text:'تماس صوتی اکنون برقرار شده است. این فقط فرمان داخلی آغاز تماس است، نه حرف مشتری. بدون اشاره به این پیام، خوشامدگویی آغازین تعریف‌شده در دستور جلسه را یک‌بار بیان کن و سپس منتظر صحبت مشتری بمان.'
      }]
    }
  };
}
export function mapGisooQwenEvent(e:Event,responseId=''):Array<Record<string,unknown>>{
  const response=id(e,responseId),t=e.type;
  if(t==='response.output_audio.delta'&&typeof e.delta==='string')return [{type:'audio_chunk',responseId:response,data:e.delta,mimeType:'audio/pcm;rate=24000'}];
  if(t==='response.output_audio_transcript.delta'&&typeof e.delta==='string')return [{type:'ai_text_chunk',responseId:response,text:e.delta}];
  if(t==='response.output_audio_transcript.done'&&typeof e.transcript==='string')return [{type:'ai_transcript',responseId:response,text:e.transcript}];
  if(t==='conversation.item.input_audio_transcription.delta'||t==='input_audio_transcription.delta'){const text=typeof e.text==='string'||typeof e.stash==='string'?String(e.text||'')+String(e.stash||''):String(e.delta||'');return text?[{type:'user_transcript',text,final:false}]:[];}
  if(t==='conversation.item.input_audio_transcription.completed'||t==='input_audio_transcription.completed'){const text=String(e.transcript||e.text||'');return text?[{type:'user_transcript',text,final:true}]:[];}
  if(t==='input_audio_buffer.speech_started'&&response)return [{type:'interrupted',responseId:response}];
  if(t==='response.done'&&response)return [{type:'turn_complete',responseId:response}];
  return [];
}
export function classifyGisooRealtimeError(code:string,ready:boolean):'ignore'|'active_response'|'recoverable'|'fatal'{
  if(code==='response_cancel_not_active'||code==='input_audio_buffer_commit_empty')return 'ignore';
  if(code==='conversation_already_has_active_response')return 'active_response';
  if(!ready||code==='session_closed'||code==='server_restart'||code==='insufficient_credit')return 'fatal';
  return 'recoverable';
}
/** Exhibition-only native audio bridge. The site's legacy speech stack remains intact. */
export function connectGisooQwenRealtime(client:WebSocket,instructions:string,catalogSearch?:GisooCatalogSearchHandler):void{
  const key=String(process.env.FORZA_QWEN_API_KEY||'').trim(),selectedVoice=voice();
  const limit=bounded(Number(process.env.FORZA_QWEN_MAX_SESSIONS||8),8,1,8);
  const toClient=(e:Record<string,unknown>)=>{if(client.readyState!==WebSocket.OPEN)return false;if(client.bufferedAmount>2000000){client.close(1013,'Browser backpressure');return false;}client.send(JSON.stringify(e));return true;};
  if(!key||activeSessions>=limit){toClient({type:'fallback_required',reason:!key?'کلید گیسو تنظیم نشده است.':'ظرفیت تماس تکمیل است.'});client.close(1013,'Qwen unavailable');return;}
  activeSessions++;
  let upstream:WebSocket|null=null,closed=false,ready=false,configured=false,userSpeaking=false,requested=false,firstAudio=false,greetingSeedPending=false,greetingResponsePending=false,greetingTriggerId='';
  let active='',pendingText='',partial='',seq=0,speechStop=0,timer:ReturnType<typeof setTimeout>|undefined;
  let micFrames=0,micBytes=0,micSquareSum=0,micSamples=0,micPeak=0,micWindowStarted=Date.now(),firstMicFrameAt=0,lastSpeechStartedAt=0;
  const cancelled=new Set<string>(),toolResponseIds=new Set<string>(),processedToolCalls=new Set<string>(),started=Date.now();
  const log=(event:string,data:Record<string,unknown>={})=>console.info('[FORZA QWEN] '+event+' '+JSON.stringify(data));
  const finish=(reason?:string)=>{if(closed)return;closed=true;activeSessions=Math.max(0,activeSessions-1);if(timer)clearTimeout(timer);if(reason){toClient({type:'fallback_required',reason});if(client.readyState===WebSocket.OPEN)client.close(1011,'Qwen session ended');}try{if(upstream?.readyState===WebSocket.CONNECTING)upstream.terminate();else if(upstream?.readyState===WebSocket.OPEN)upstream.close(1000,'Call ended');}catch{}};
  const send=(e:Record<string,unknown>)=>{if(closed||upstream?.readyState!==WebSocket.OPEN)return false;if(upstream.bufferedAmount>1000000){finish('ارتباط گیسو کند شده است؛ دوباره متصل شوید.');return false;}upstream.send(JSON.stringify(e));return true;};
  const interrupt=(response:string)=>{if(!response||cancelled.has(response))return;cancelled.add(response);if(cancelled.size>64){const oldest=cancelled.values().next().value;if(oldest)cancelled.delete(oldest);}toClient({type:'interrupted',responseId:response});};
  const textTurn=(text:string)=>{if(closed||!ready)return;if(active||requested){pendingText=text;if(active&&!cancelled.has(active)){interrupt(active);send({type:'response.cancel'});}return;}requested=true;speechStop=Date.now();send({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text}]}});send({type:'response.create'});};
  const runCatalogTool=async(event:Event)=>{
    const callId=String(event.call_id||'').trim();
    if(!callId||processedToolCalls.has(callId))return;
    processedToolCalls.add(callId);
    if(processedToolCalls.size>128){const first=processedToolCalls.values().next().value;if(first)processedToolCalls.delete(first);}
    const toolResponseId=id(event,active);
    if(toolResponseId){toolResponseIds.add(toolResponseId);if(toolResponseIds.size>64){const first=toolResponseIds.values().next().value;if(first)toolResponseIds.delete(first);}}
    let args:Event={};
    try{args=typeof event.arguments==='string'?JSON.parse(event.arguments):event.arguments||{};}catch{}
    const query=String(args.query||'').trim().slice(0,120);
    const limit=bounded(Number(args.limit||6),6,1,6);
    toClient({type:'catalog_search_started',query});
    let result:Record<string,unknown>;
    try{
      if(event.name!=='search_sanatpish_catalog')throw new Error('unknown_tool');
      if(!query)throw new Error('empty_query');
      if(!catalogSearch)throw new Error('catalog_unavailable');
      const value=await catalogSearch(query,limit);
      result=value&&typeof value==='object'?value as Record<string,unknown>:{success:false,query,familyCount:0,skuCount:0,results:[]};
    }catch(error){
      const code=error instanceof Error?error.message:'catalog_unavailable';
      result={success:false,query,familyCount:0,skuCount:0,results:[],error:code==='empty_query'?'empty_query':'catalog_unavailable'};
    }
    if(toolResponseId&&cancelled.has(toolResponseId)){
      log('catalog_tool_cancelled',{queryLength:query.length});
      return;
    }
    const displayResults=Array.isArray(result.results)?result.results:[];
    toClient({
      type:'catalog_results',
      query,
      success:result.success!==false,
      familyCount:Number(result.familyCount||displayResults.length),
      skuCount:Number(result.skuCount||0),
      results:displayResults
    });
    send({type:'conversation.item.create',item:{type:'function_call_output',call_id:callId,output:JSON.stringify(result)}});
    send({type:'response.create'});
    log('catalog_tool_completed',{queryLength:query.length,resultCount:displayResults.length,success:result.success!==false});
  };
  client.on('close',()=>finish());client.on('error',()=>finish());
  try{const target=new URL(process.env.FORZA_QWEN_REALTIME_URL?.trim()||DEFAULT_URL);if(target.protocol!=='wss:'||!['gisoo.pro','ir.gisoo.pro'].includes(target.hostname)||target.searchParams.get('model')!==MODEL)throw Error('invalid URL');upstream=new WebSocket(target,{headers:{Authorization:'Bearer '+key},handshakeTimeout:15000,maxPayload:2097152});}catch{finish('نشانی اتصال گیسو معتبر نیست.');return;}
  timer=setTimeout(()=>{if(!ready)finish('گیسو نشست را در زمان مناسب آماده نکرد.');},20000);
  upstream.on('open',()=>log('socket_open',{ms:Date.now()-started}));
  upstream.on('unexpected-response',(_req,res)=>{res.resume();finish('گیسو اتصال را نپذیرفت (HTTP '+String(res.statusCode||0)+').');});
  upstream.on('error',()=>finish('ارتباط WebSocket گیسو قطع شد.'));
  upstream.on('close',()=>{if(!closed)finish('نشست گیسو بسته شد؛ دوباره متصل شوید.');});
  upstream.on('message',raw=>{
    if(closed)return;let e:Event;try{e=decode(raw);}catch{return;}const t=String(e.type||'');
    if(t==='session.created'&&!configured){configured=true;send(buildGisooQwenSessionUpdate(instructions,Number(process.env.FORZA_QWEN_SILENCE_MS||500),selectedVoice));return;}
    if(t==='session.updated'&&!ready&&configured){const reported=e.session?.audio?.output?.voice??e.session?.voice;const confirmed=isGisooQwenVoiceConfirmed(e.session||{},selectedVoice);if(!confirmed){finish('گیسو صدای درخواستی '+selectedVoice+' را تأیید نکرد'+(typeof reported==='string'&&reported.trim()?' (صدای گزارش‌شده: '+reported+')':' (صدای گزارش‌شده موجود نیست)')+'. اتصال با صدای پیش‌فرض ادامه پیدا نمی‌کند.');return;}ready=true;if(timer)clearTimeout(timer);log('session_ready',{ms:Date.now()-started,voice:selectedVoice,confirmed:true});greetingTriggerId='forza-opening-'+started;greetingSeedPending=true;if(!send(buildGisooQwenOpeningGreetingTrigger(greetingTriggerId))){finish('فرمان آغاز مکالمه به گیسو ارسال نشد.');return;}timer=setTimeout(()=>{if(greetingSeedPending)finish('گیسو فرمان آغاز تماس را ثبت نکرد.');},7000);log('opening_greeting_trigger_sent',{itemId:greetingTriggerId,role:'user',contentType:'input_text'});return;}
    if(!ready&&t!=='error')return;
    if(t==='input_audio_buffer.speech_started'){userSpeaking=true;lastSpeechStartedAt=Date.now();partial='';pendingText='';log('speech_started',{afterFirstMicFrameMs:firstMicFrameAt?Date.now()-firstMicFrameAt:null,activeResponse:Boolean(active)});toClient({type:'speech_started'});if(active&&!cancelled.has(active)){interrupt(active);send({type:'response.cancel'});}else if(requested){send({type:'response.cancel'});}return;}
    if(t==='input_audio_buffer.speech_stopped'){userSpeaking=false;speechStop=Date.now();log('speech_stopped',{speechDurationMs:lastSpeechStartedAt?Date.now()-lastSpeechStartedAt:null});toClient({type:'speech_stopped'});return;}
    if(t==='input_audio_buffer.committed'){log('audio_committed',{afterSpeechStopMs:speechStop?Date.now()-speechStop:null});return;}
    if(t==='conversation.item.created'||t==='conversation.item.added'){const item=e.item&&typeof e.item==='object'?e.item as Event:{};const receivedItemId=String(item.id||e.item_id||'');const content=Array.isArray(item.content)?item.content as Event[]:[];const contentTypes=content.map((part:Event)=>String(part.type||'unknown')).slice(0,4);log('conversation_item_received',{eventType:t,itemId:receivedItemId||null,role:String(item.role||'unknown'),contentTypes});const triggerText=content.some((part:Event)=>part.type==='input_text'&&String(part.text||'').includes('تماس صوتی اکنون برقرار شده است'));if(greetingSeedPending&&(receivedItemId===greetingTriggerId||triggerText)){greetingSeedPending=false;if(timer)clearTimeout(timer);toClient({type:'connected',provider:'qwen',model:MODEL,voice:selectedVoice,voiceConfirmed:true,inputSampleRate:16000,sampleRate:24000});requested=true;greetingResponsePending=true;if(!send({type:'response.create'})){finish('درخواست خوشامدگویی اولیه به گیسو ارسال نشد.');return;}timer=setTimeout(()=>{if(greetingResponsePending)finish('گیسو پاسخ خوشامدگویی را شروع نکرد.');},10000);log('opening_greeting_requested',{voice:selectedVoice,triggerItemId:receivedItemId||greetingTriggerId});}return;}
    if(t==='response.created'){if(greetingResponsePending){greetingResponsePending=false;if(timer)clearTimeout(timer);}active=id(e,'qwen-'+(++seq));requested=false;firstAudio=false;log('response_created',{afterSpeechStopMs:speechStop?Date.now()-speechStop:null,afterSpeechStartedMs:lastSpeechStartedAt?Date.now()-lastSpeechStartedAt:null});if(userSpeaking||pendingText){interrupt(active);send({type:'response.cancel'});}else toClient({type:'response_started',responseId:active});return;}
    if(t==='response.function_call_arguments.done'){void runCatalogTool(e);return;}
    if(t==='response.done'){
      const response=id(e,active);
      if(response&&toolResponseIds.delete(response)){
        if(response===active){
          active='';
          requested=false;
          if(cancelled.has(response)&&pendingText&&!userSpeaking){
            const nextText=pendingText;
            pendingText='';
            textTurn(nextText);
          }
        }
        log('tool_response_done',{responseId:response,status:e.response?.status||'unknown'});
        return;
      }
      if(response===active){active='';requested=false;if(!cancelled.has(response))toClient({type:'turn_complete',responseId:response});if(pendingText&&!userSpeaking){const next=pendingText;pendingText='';textTurn(next);}}
      log('response_done',{status:e.response?.status||'unknown',usage:e.response?.usage||null});return;
    }
    if(t==='error'){
      const details=e.error&&typeof e.error==='object'?e.error as Event:{};
      const code=String(details.code||'unknown').slice(0,80),disposition=classifyGisooRealtimeError(code,ready);
      const providerMessage=String(details.message||'').replace(/[\r\n]+/g,' ').slice(0,240);
      log('provider_error',{code,type:String(details.type||'').slice(0,80),message:providerMessage,param:String(details.param||'').slice(0,80),eventId:String(details.event_id||'').slice(0,80),ready,disposition});
      if(greetingSeedPending||greetingResponsePending){finish('گیسو شروع مکالمه را نپذیرفت: '+(providerMessage||code));return;}
      if(disposition==='ignore')return;
      if(disposition==='active_response'){requested=false;return;}
      if(disposition==='fatal'){
        const reason=code==='insufficient_credit'?'اعتبار گیسو کافی نیست.':code==='session_closed'?'گیسو نشست را بسته است؛ دوباره متصل شوید.':code==='server_restart'?'گیسو در حال راه‌اندازی مجدد است؛ چند ثانیه بعد دوباره متصل شوید.': 'گیسو هنگام آماده‌سازی نشست خطا داد: '+code;
        finish(reason);return;
      }
      const reason=code==='flood'?'گیسو فعلاً تعداد درخواست‌ها را محدود کرده است؛ اتصال برقرار مانده. کمی صبر کنید و دوباره صحبت کنید.': 'خطای موقت گیسو ('+code+')؛ اتصال برقرار است.';
      toClient({type:'provider_error',code,reason,recoverable:true});return;
    }
    if(t.includes('input_audio_transcription.delta')&&typeof e.delta==='string'&&typeof e.text!=='string'){partial+=e.delta;toClient({type:'user_transcript',text:partial,final:false});return;}
    if(t.startsWith('response.')){const response=id(e,active);if(!response||response!==active||cancelled.has(response))return;if(t==='response.output_audio.delta'&&!firstAudio){firstAudio=true;log('first_audio',{afterSpeechStopMs:speechStop?Date.now()-speechStop:null});}}
    for(const out of mapGisooQwenEvent(e,active))toClient(out);
  });
  client.on('message',raw=>{if(closed)return;const length=Buffer.isBuffer(raw)?raw.length:Array.isArray(raw)?raw.reduce((n,b)=>n+b.length,0):(raw as ArrayBuffer).byteLength;if(length>100000){client.close(1009,'Frame too large');return;}let e:Event;try{e=decode(raw);}catch{return;}if(e.type==='ping'){toClient({type:'pong'});return;}if(!ready)return;if(e.type==='capture_settings'){log('capture_settings',{echoCancellation:e.echoCancellation===true,noiseSuppression:e.noiseSuppression===true,autoGainControl:e.autoGainControl===true,sampleRate:Number(e.sampleRate)||null,channelCount:Number(e.channelCount)||null});return;}if(e.type==='realtime_audio'){
    if(typeof e.audio!=='string'||!e.audio.length||e.audio.length>65000||e.audio.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(e.audio)){log('mic_frame_rejected',{reason:'invalid_base64_payload',encodedLength:typeof e.audio==='string'?e.audio.length:0});return;}
    const pcm=Buffer.from(e.audio,'base64');if(!pcm.length||pcm.length%2!==0){log('mic_frame_rejected',{reason:'invalid_pcm_length',bytes:pcm.length});return;}
    const now=Date.now();if(!firstMicFrameAt){firstMicFrameAt=now;micWindowStarted=now;log('mic_first_frame',{afterSessionReadyMs:now-started,bytes:pcm.length,sampleRate:Number(e.sampleRate)||16000});}
    micFrames++;micBytes+=pcm.length;for(let i=0;i<pcm.length;i+=2){const sample=pcm.readInt16LE(i);micSquareSum+=sample*sample;micSamples++;const peak=Math.abs(sample);if(peak>micPeak)micPeak=peak;}
    if(now-micWindowStarted>=5000){log('mic_stream',{intervalMs:now-micWindowStarted,frames:micFrames,bytes:micBytes,samples:micSamples,rms:micSamples?Math.round(Math.sqrt(micSquareSum/micSamples)):0,peak:micPeak,sampleRate:16000});micFrames=0;micBytes=0;micSquareSum=0;micSamples=0;micPeak=0;micWindowStarted=now;}
    if(!send({type:'input_audio_buffer.append',audio:e.audio}))log('mic_forward_failed',{bytes:pcm.length,upstreamBufferedBytes:upstream?.bufferedAmount||0});return;
  }if(e.type==='cancel'){pendingText='';if(active){interrupt(active);send({type:'response.cancel'});}else if(requested)send({type:'response.cancel'});return;}if(e.type==='text'&&typeof e.text==='string'&&e.text.trim())textTurn(e.text.trim().slice(0,3000));});
}
