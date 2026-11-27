import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Mic, MicOff, PhoneOff, RotateCcw, Send, Square, Volume2, VolumeX, MessageSquare } from 'lucide-react';
import { getForzaAudioContext } from '../../utils/forzaAudioUnlock';
import { resampleDibaPcm } from '../../utils/forzaLocalSpeech';
import { buildLiveVisionCandidates, buildLiveVisionPrompt, type LiveVisionCandidate } from '../../utils/forzaLiveVisionContext';
import './style.css';

const ParticleAvatar = lazy(() => import('./ParticleAvatar').then(m => ({default:m.ParticleAvatar})));

type Phase = 'connecting'|'listening'|'thinking'|'speaking'|'disconnected';
type LiveCatalogVariant={code:string;name:string;size?:string};
type LiveCatalogFamily={code:string;name:string;brand?:string;images?:string[];link:string;variants?:LiveCatalogVariant[]};
type Session = { ws:WebSocket|null; stream:MediaStream|null; node:ScriptProcessorNode|AudioWorkletNode|null; mic:MediaStreamAudioSourceNode|null; sink:GainNode|null; output:GainNode|null; analyser:AnalyserNode|null; ctx:AudioContext|null; sources:Set<AudioBufferSourceNode>; next:number; ready:boolean; done:boolean; ignored:Set<string>; id:string; frame:number; lastVisual:number; };

function newSession():Session {
  return {ws:null,stream:null,node:null,mic:null,sink:null,output:null,analyser:null,ctx:null,sources:new Set(),next:0,ready:false,done:true,ignored:new Set(),id:'',frame:0,lastVisual:0};
}
function encodePcm(samples:Float32Array,rate:number):string {
  const pcm=resampleDibaPcm(samples,rate);
  const bytes=new Uint8Array(pcm.length*2), view=new DataView(bytes.buffer);
  for(let i=0;i<pcm.length;i++){const x=Math.max(-1,Math.min(1,pcm[i]));view.setInt16(i*2,x<0?x*32768:x*32767,true);}
  let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary);
}

export function ForzaQwenCallExperience({onClose}:{onClose?:()=>void}) {
  const session=useRef<Session|null>(null);
  const micMuted=useRef(false), speakerMuted=useRef(false), scanning=useRef(false);
  const scanVersion=useRef(0);
  const [phase,setPhase]=useState<Phase>('connecting');
  const [error,setError]=useState('');
  const [user,setUser]=useState(''),[assistant,setAssistant]=useState('');
  const [level,setLevel]=useState(0),[muted,setMuted]=useState(false),[silent,setSilent]=useState(false);
  const [showText,setShowText]=useState(false),[text,setText]=useState('');
  const fileInput=useRef<HTMLInputElement>(null),cameraInput=useRef<HTMLInputElement>(null);
  const [visionImage,setVisionImage]=useState('');
  const [visionBusy,setVisionBusy]=useState(false);
  const [visionError,setVisionError]=useState('');
  const [visionRegion,setVisionRegion]=useState<{x:number;y:number;width:number;height:number}|null>(null);
  const [visionItems,setVisionItems]=useState<LiveVisionCandidate[]>([]);
  const [visionPrompt,setVisionPrompt]=useState('');
  const [visionExpanded,setVisionExpanded]=useState(true);
  const [confirmed,setConfirmed]=useState(false);
  const [voice,setVoice]=useState('Bodega');
  const [catalogQuery,setCatalogQuery]=useState('');
  const [catalogResults,setCatalogResults]=useState<LiveCatalogFamily[]>([]);
  const [catalogBusy,setCatalogBusy]=useState(false);
  const [stats,setStats]=useState<{fps:number|null;particles?:number;tier:string}>({fps:null,tier:'ULTRA'});
  const [clean,setClean]=useState(false);

  const stopPlayback=useCallback((s:Session)=>{
    if(s.id){s.ignored.add(s.id);if(s.ignored.size>64){const first=s.ignored.values().next().value;if(first)s.ignored.delete(first);}}
    for(const source of s.sources){source.onended=null;try{source.stop();source.disconnect();}catch{}}
    s.sources.clear();s.next=0;s.done=true;setLevel(0);
  },[]);
  const dispose=useCallback(()=>{
    const s=session.current;session.current=null;scanVersion.current++;
    if(!s)return;
    cancelAnimationFrame(s.frame);stopPlayback(s);
    if(s.ws){s.ws.onopen=null;s.ws.onmessage=null;s.ws.onerror=null;s.ws.onclose=null;try{s.ws.close();}catch{}}
    if(s.node){if('port' in s.node){s.node.port.onmessage=null;s.node.port.close();}else s.node.onaudioprocess=null;}
    for(const node of [s.node,s.mic,s.sink,s.output,s.analyser])try{node?.disconnect();}catch{}
    s.stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});
  },[stopPlayback]);
  const send=useCallback((s:Session,message:object)=>{
    if(session.current!==s||!s.ready||s.ws?.readyState!==WebSocket.OPEN)return false;
    s.ws.send(JSON.stringify(message));return true;
  },[]);
  const submit=useCallback((value:string,display=value)=>{
    const s=session.current;if(!s?.ready||!value.trim())return false;
    stopPlayback(s);setUser(display);setAssistant('');setPhase('thinking');
    return send(s,{type:'text',text:value});
  },[send,stopPlayback]);
  const start=useCallback(async()=>{
    dispose();const s=newSession();session.current=s;
    setError('');setPhase('connecting');setConfirmed(false);
    const fail=(message:string)=>{if(session.current!==s)return;dispose();setPhase('disconnected');setError(message);};
    try{
      const ctx=getForzaAudioContext();if(!ctx)throw new Error('مرورگر از صدای زنده پشتیبانی نمی‌کند.');
      s.ctx=ctx;
      let resumeTimer:number|undefined;
      try { await Promise.race([ctx.resume(),new Promise<never>((_,reject)=>{resumeTimer=window.setTimeout(()=>reject(new Error('برای فعال‌کردن صدا روی اتصال مجدد بزنید.')),1500);})]); }
      finally { if(resumeTimer!==undefined)window.clearTimeout(resumeTimer); }
      if(session.current!==s)return;
      if(ctx.state!=='running')throw new Error('برای فعال‌کردن صدا روی اتصال مجدد بزنید.');
      const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      if(session.current!==s){stream.getTracks().forEach(t=>t.stop());return;}
      s.stream=stream;
      for(const track of stream.getAudioTracks())track.onended=()=>fail('میکروفون قطع شد؛ اتصال مجدد را بزنید.');
      s.output=ctx.createGain();s.output.gain.value=speakerMuted.current?0:1;
      s.analyser=ctx.createAnalyser();s.analyser.fftSize=256;
      s.output.connect(s.analyser);s.analyser.connect(ctx.destination);
      s.mic=ctx.createMediaStreamSource(stream);
      s.sink=ctx.createGain();s.sink.gain.value=0;
      const sendMic=(samples:Float32Array)=>{
        if(!s.ready||micMuted.current||scanning.current||s.ws?.readyState!==WebSocket.OPEN)return;
        if(s.ws.bufferedAmount>262144){fail('ارتباط صوتی کند شد؛ دوباره متصل شوید.');return;}
        send(s,{type:'realtime_audio',audio:encodePcm(samples,ctx.sampleRate)});
      };
      if(ctx.audioWorklet){
        try{
          await ctx.audioWorklet.addModule('/forza-runtime/qwen-mic-worklet.js');
          if(session.current!==s)return;
          const node=new AudioWorkletNode(ctx,'forza-qwen-mic',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
          node.port.onmessage=e=>{if(e.data instanceof Float32Array)sendMic(e.data);};
          s.node=node;
        }catch(error){console.warn('[FORZA QWEN] AudioWorklet unavailable',error);}
      }
      if(session.current!==s)return;
      if(!s.node){const node=ctx.createScriptProcessor(1024,1,1);node.onaudioprocess=e=>sendMic(e.inputBuffer.getChannelData(0));s.node=node;}
      s.mic.connect(s.node);s.node.connect(s.sink);s.sink.connect(ctx.destination);
      const ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/api/live?provider=qwen');s.ws=ws;
      ws.onerror=()=>fail('اتصال زنده به گیسو برقرار نشد.');
      ws.onclose=()=>fail('ارتباط گیسو قطع شد؛ اتصال مجدد را بزنید.');
      const samples=new Float32Array(s.analyser.fftSize);
      const visual=(time:number)=>{
        if(session.current!==s)return;
        if(time-s.lastVisual>33){s.lastVisual=time;s.analyser?.getFloatTimeDomainData(samples);let power=0;for(const v of samples)power+=v*v;setLevel(Math.min(1,Math.sqrt(power/samples.length)*4));}
        s.frame=requestAnimationFrame(visual);
      };
      s.frame=requestAnimationFrame(visual);
      ws.onmessage=e=>{
        if(session.current!==s)return;
        let m:any;try{m=JSON.parse(e.data);}catch{return;}
        if(m.type==='fallback_required'||m.type==='error'){fail(String(m.reason||m.message||'خطای گیسو'));return;}
        if(m.type==='provider_error'){
          setError(String(m.reason||'خطای موقت گیسو؛ اتصال برقرار است.'));
          s.done=true;
          if(!s.sources.size)setPhase('listening');
          return;
        }
        if(m.type==='connected'){
          if(m.provider!=='qwen'){fail('سرور هنوز روی Qwen تنظیم نشده است.');return;}
          if(s.ready)return;s.ready=true;setVoice(typeof m.voice==='string'?m.voice:'Bodega');setConfirmed(m.voiceConfirmed===true);const capture=s.stream?.getAudioTracks()[0]?.getSettings();send(s,{type:'capture_settings',echoCancellation:capture?.echoCancellation,noiseSuppression:capture?.noiseSuppression,autoGainControl:capture?.autoGainControl,sampleRate:capture?.sampleRate,channelCount:capture?.channelCount});setPhase('listening');return;
        }
        if(m.type==='catalog_search_started'){setCatalogQuery(String(m.query||''));setCatalogResults([]);setCatalogBusy(true);return;}
        if(m.type==='catalog_results'){
          setCatalogQuery(String(m.query||''));
          setCatalogResults(Array.isArray(m.results)?m.results:[]);
          setCatalogBusy(false);
          return;
        }
        if(m.type==='speech_started'){setError('');stopPlayback(s);setUser('');setPhase('listening');return;}
        if(m.type==='speech_stopped'){setPhase('thinking');return;}
        if(m.type==='interrupted'){if(m.responseId)s.ignored.add(m.responseId);if(!m.responseId||m.responseId===s.id){stopPlayback(s);setPhase('listening');}return;}
        if(m.type==='user_transcript'){if(typeof m.text==='string')setUser(m.text);return;}
        if(m.type==='response_started'){setError('');s.id=String(m.responseId||'');s.done=false;setAssistant('');setPhase('thinking');return;}
        const id=String(m.responseId||'');if(id&&s.ignored.has(id))return;
        if(id&&s.id&&id!==s.id)return;
        if(m.type==='ai_text_chunk'){setAssistant(prev=>prev+String(m.text||''));return;}
        if(m.type==='ai_transcript'){setAssistant(String(m.text||''));return;}
        if(m.type==='turn_complete'){s.done=true;if(!s.sources.size)setPhase('listening');return;}
        if(m.type!=='audio_chunk'||typeof m.data!=='string'||!s.output)return;
        try{
          const raw=atob(m.data), bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
          if(!bytes.length||bytes.length%2)return;
          const buffer=ctx.createBuffer(1,bytes.length/2,24000), dest=buffer.getChannelData(0), view=new DataView(bytes.buffer);
          for(let i=0;i<dest.length;i++)dest[i]=view.getInt16(i*2,true)/32768;
          const source=ctx.createBufferSource();source.buffer=buffer;source.connect(s.output);
          if(s.next-ctx.currentTime>90){setError('پاسخ صوتی از سقف ۹۰ ثانیه عبور کرد؛ اتصال برقرار است. سؤال را مرحله‌ای بپرسید.');stopPlayback(s);send(s,{type:'cancel'});setPhase('listening');return;}
          const at=s.next>ctx.currentTime?s.next:ctx.currentTime+0.015;s.next=at+buffer.duration;
          s.sources.add(source);source.onended=()=>{s.sources.delete(source);source.disconnect();if(session.current===s&&!s.sources.size&&s.done){setPhase('listening');setLevel(0);}};
          source.start(at);setPhase('speaking');
        }catch{fail('داده صوتی دریافتی گیسو قابل پخش نیست.');}
      };
    }catch(e){fail(e instanceof Error?e.message:'دسترسی میکروفون یا صدا برقرار نشد.');}
  },[dispose,send,stopPlayback]);

  useEffect(()=>{void start();return dispose;},[start,dispose]);
  const cancel=()=>{const s=session.current;if(s?.ready){stopPlayback(s);send(s,{type:'cancel'});setPhase('listening');}};
  const toggleMic=()=>{micMuted.current=!micMuted.current;setMuted(micMuted.current);};
  const toggleSpeaker=()=>{speakerMuted.current=!speakerMuted.current;setSilent(speakerMuted.current);const out=session.current?.output;if(out)out.gain.value=speakerMuted.current?0:1;};
  const scanImage=async(file:File)=>{
    const sequence=++scanVersion.current;
    setVisionExpanded(true);setVisionError('');setVisionItems([]);setVisionPrompt('');setVisionRegion(null);setVisionImage('');
    if(!/^(image\/jpeg|image\/png|image\/webp)$/.test(file.type)||file.size>10*1024*1024){setVisionBusy(false);setVisionError('تصویر JPG، PNG یا WebP تا ۱۰ مگابایت انتخاب کنید.');return;}
    setVisionBusy(true);
    try{
      const {aiVisualSearchService}=await import('../../services/aiVisualSearchService');
      const {base64,mimeType}=await aiVisualSearchService.fileToBase64(file);
      if(sequence!==scanVersion.current)return;
      setVisionImage(base64);
      let detection:Awaited<ReturnType<typeof aiVisualSearchService.detectImageRegions>>|undefined;
      try{detection=await aiVisualSearchService.detectImageRegions(base64);}catch{/* No unsupported crop: search the original image. */}
      if(sequence!==scanVersion.current)return;
      setVisionRegion(detection?.queryRegion || null);
      const result=await aiVisualSearchService.analyzePartWithAi({imageBase64:base64,mimeType,stage:'quick',observationOnly:false,includeNearest:true,region:detection?.queryRegion,detectionId:detection?.detectionId,fullImage:!detection?.queryRegion});
      if(sequence!==scanVersion.current)return;
      if(!result.success)throw new Error('تحلیل تصویر کامل نشد.');
      const items=buildLiveVisionCandidates(result),prompt=buildLiveVisionPrompt(result,items);
      setVisionRegion(result.queryRegion===undefined?detection?.queryRegion||null:result.queryRegion);setVisionItems(items);setVisionPrompt(prompt);
      if(!submit(prompt,'تصویر قطعه را برای بررسی فنی ارسال کردم.'))setVisionError('نتایج آماده است؛ پس از اتصال، مشاوره صوتی را انتخاب کنید.');
    }catch(error){if(sequence===scanVersion.current)setVisionError(error instanceof Error?error.message:'بررسی تصویر ناموفق بود.');}
    finally{if(sequence===scanVersion.current)setVisionBusy(false);}
  };
  const clearVision=()=>{scanVersion.current++;setVisionImage('');setVisionItems([]);setVisionPrompt('');setVisionRegion(null);setVisionBusy(false);setVisionError('');};
  const labels:Record<Phase,string>={connecting:'در حال اتصال به گیسو…',listening:'فورزا گوش می‌دهد',thinking:'فورزا در حال پاسخ‌گویی…',speaking:'فورزا در حال صحبت است',disconnected:'اتصال قطع است'};
  const control='p-1.5 rounded-md text-white/80 hover:bg-white/10';
  return <main className="forza-stage" dir="ltr">
    <Suspense fallback={<div className="forza-avatar-fallback"/>}><ParticleAvatar mode={phase==='speaking'?'speak':phase==='listening'?'listen':'auto'} intensity={1} stableLight audioLevel={phase==='speaking'?level:0} quality="high" background backgroundSpeed={2} onStats={setStats}/></Suspense>
    {!clean&&<div className="forza-hud" aria-hidden="true"><i className="hud-corner tl"/><i className="hud-corner tr"/><i className="hud-corner bl"/><i className="hud-corner br"/><div className="hud-block hud-top-right"><div className="hud-title text-white tracking-widest font-black">- FORZA</div><div className="hud-dim text-[10px]">HUMAN SYSTEMS / 001 · {stats.particles?.toLocaleString('en')} PARTICLES</div></div><div className="hud-block hud-top-left"><div className="hud-dim text-[10px]">{stats.tier} · {stats.fps??'—'} FPS</div></div><div className="procedural-label"><span>PROCEDURAL IDENTITY</span><strong>Built from<br/>light</strong></div><div className="hud-block hud-bottom-left"><div className="hud-dim text-[10px]">PARTICLE MESH · REALTIME GPU</div></div><div className="scan"/></div>}
    <button type="button" dir="rtl" onClick={()=>{dispose();onClose?.();}} className="forza-exit-call-button absolute top-5 left-6 z-40 flex gap-2 rounded-full bg-red-950/80 border border-red-500/60 px-4 py-2 text-white text-xs"><PhoneOff size={14}/> خروج</button>
    <button className="signal-toggle" onClick={()=>setClean(v=>!v)} aria-label="تغییر نمایش HUD"><span/><span/><span/><span/></button>
    <div dir="rtl" className="forza-conversation-panel absolute bottom-3 right-3 sm:bottom-20 sm:right-10 w-[calc(100%-1.5rem)] sm:w-[min(36vw,30rem)] max-h-[min(74dvh,760px)] overflow-y-auto max-w-[34rem] z-30 flex flex-col gap-3 pointer-events-none">
      <div className="forza-status-dock self-end inline-flex flex-wrap items-center gap-2 px-4 py-2 rounded-full bg-black/90 border border-white/15 text-xs pointer-events-auto"><span className="font-semibold text-white">{labels[phase]}</span><button className={control} onClick={toggleMic} aria-label="میکروفون">{muted?<MicOff size={14}/>:<Mic size={14}/>}</button><button className={control} onClick={toggleSpeaker} aria-label="بلندگو">{silent?<VolumeX size={14}/>:<Volume2 size={14}/>}</button><button className={control} onClick={cancel} aria-label="قطع پاسخ"><Square size={13}/></button><button className={control} onClick={()=>setShowText(v=>!v)} aria-label="پیام متنی"><MessageSquare size={14}/></button><button className={control} onClick={()=>{dispose();setPhase('disconnected');}} aria-label="قطع اتصال"><PhoneOff size={14}/></button><button className={control} onClick={()=>void start()} aria-label="اتصال مجدد"><RotateCcw size={14}/></button></div>
      <div className="forza-voice-meta self-end text-[10px] text-white/70">گیسو · Qwen Realtime · {voice} {confirmed?'(تأیید پارامتر)':'(صدای تأییدنشده)'}</div>
      {error&&<div role="alert" className="pointer-events-auto rounded-xl bg-red-950/90 border border-red-500/50 p-3 text-xs text-white">{error}<button className="block mt-2 underline" onClick={()=>void start()}>اتصال مجدد</button></div>}
      <button type="button" className="forza-image-scan-button pointer-events-auto self-end flex gap-3 items-center rounded-2xl border border-orange-400/60 bg-orange-950/90 px-5 py-3 text-white" onClick={()=>fileInput.current?.click()}><Eye size={22} className="text-orange-400"/> ارسال تصویر قطعه</button>
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void scanImage(f);}}/>
      <input ref={cameraInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void scanImage(f);}}/>
      <button type="button" className="pointer-events-auto self-end text-xs text-orange-300 px-3 py-2" onClick={()=>cameraInput.current?.click()}>عکس گرفتن با دوربین</button>
      {(visionImage||visionBusy||visionError)&&<section dir="rtl" className="pointer-events-auto rounded-2xl border border-orange-400/40 bg-[#100a06]/95 p-3 shadow-xl" aria-label="شناسایی تصویری در تماس فورزا">
        <div className="flex items-center justify-between gap-2 mb-2"><strong className="text-sm text-orange-300">مشاوره تصویری FORZA</strong><button className="text-xs text-white/80 p-2" onClick={()=>setVisionExpanded(v=>!v)} aria-expanded={visionExpanded}>{visionExpanded?'جمع کردن':'نمایش نتایج'}</button><button className="text-xs text-white/70 p-2" onClick={clearVision}>حذف تصویر</button></div>
        {visionBusy&&<p role="status" className="text-xs text-white/80 py-2">در حال شناسایی قطعه و بررسی کاتالوگ…</p>}
        {visionError&&<p role="alert" className="text-xs text-orange-200 py-2">{visionError}</p>}
        {visionExpanded&&<>
          {visionImage&&<div className="bg-black/60 rounded-xl overflow-hidden"><div className="relative mx-auto w-fit max-w-full"><img src={visionImage} alt="تصویر قطعه ارسالی مشتری" className="block max-h-[32dvh] max-w-full w-auto h-auto object-contain"/>{visionRegion&&<div aria-label="ناحیه شناسایی شده" className="absolute border-2 border-orange-400 pointer-events-none" style={{left:visionRegion.x*100+'%',top:visionRegion.y*100+'%',width:visionRegion.width*100+'%',height:visionRegion.height*100+'%'}}/>}</div><p className="text-xs text-white/70 p-2">{visionRegion?'ناحیه پیشنهادی قطعه':'تصویر کامل؛ محدوده تأیید نشده است'}</p></div>}
          {!visionBusy&&visionPrompt&&<><div className="mt-3 flex justify-between items-center gap-2"><strong className="text-xs text-white">گزینه‌های کاتالوگ ({visionItems.length})</strong><button type="button" disabled={phase==='disconnected'||phase==='connecting'} className="rounded-lg bg-orange-500 px-3 py-2 text-xs text-black font-bold disabled:opacity-50" onClick={()=>submit(visionPrompt,'لطفاً گزینه‌های تصویر را توضیح بده.')}>مشاوره صوتی</button></div>
          {!visionItems.length&&<p className="text-xs text-white/70 py-2">گزینه قابل اتکا پیدا نشد؛ عکس واضح‌تر یا مشخصات قطعه را ارسال کنید.</p>}
          <div className="flex flex-col gap-2 mt-2">{visionItems.map(item=><article key={item.code?'sku:'+item.code:'family:'+item.familyCode} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-start gap-3">{item.image?<img src={item.image} alt={item.name} loading="lazy" className="w-16 h-16 object-contain bg-white rounded-lg"/>:<div className="w-16 h-16 shrink-0 rounded-lg bg-white/10 flex items-center justify-center text-[10px] text-white/60">بدون تصویر</div>}<div className="min-w-0 flex-1"><strong className="text-sm text-white">{item.name}</strong><p className="text-xs text-white/70 mt-1"><bdi>{item.code||item.familyCode}</bdi>{item.brand?' · '+item.brand:''}{item.size?' · '+item.size:''}</p><p className="text-xs text-orange-300 mt-1">{item.basis==='explore'?'صرفاً گزینه بررسی':item.basis==='exact'?'تطبیق گزارش‌شده؛ سازگاری نیازمند بررسی':item.basis==='read_code'?'کد خوانده‌شده؛ نیازمند تأیید':'مشابه؛ نیازمند تأیید'}</p>{item.imageScope==='family'&&<p className="text-[10px] text-white/60">تصویر خانواده</p>}</div></div>
            {!!item.specs.length&&<details className="mt-2 text-xs text-white/80"><summary className="cursor-pointer py-1">مشخصات ثبت‌شده</summary>{item.specs.map((s,i)=><div key={i} className="flex justify-between gap-2 py-1"><span>{s.key}</span><span>{s.value}</span></div>)}</details>}
            <div className="mt-2 flex gap-2"><button disabled={phase==='disconnected'||phase==='connecting'} className="rounded-lg border border-orange-400/50 text-orange-300 px-3 py-2 text-xs disabled:opacity-50" onClick={()=>submit('با ابزار کاتالوگ درباره این گزینه مشاوره بده؛ کد مرجع '+JSON.stringify({code:item.code,familyCode:item.familyCode,basis:item.basis})+'؛ مشخصات و سازگاری را حدس نزن.','درباره '+item.name+' توضیح بده.')}>توضیح فورزا</button><a href={item.link} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-white/10 text-white px-3 py-2 text-xs">مشاهده محصول</a></div>
          </article>)}</div></>}
        </>}
      </section>}
      {showText&&<form className="pointer-events-auto flex gap-2 rounded-xl bg-black/90 p-2 text-white" onSubmit={e=>{e.preventDefault();if(submit(text)){setText('');setShowText(false);}}}><input className="flex-1 min-w-0 bg-transparent px-2 outline-none" value={text} onChange={e=>setText(e.target.value)} placeholder="سؤال فنی خود را تایپ کنید…"/><button type="submit" aria-label="ارسال"><Send size={16}/></button></form>}
      {(user||assistant)&&<div className="forza-message-card pointer-events-auto" aria-live="polite">{user&&<><div className="text-xs font-bold text-white mb-1">شما</div><p className="forza-persian-copy text-sm text-white">{user}</p></>}{assistant&&<><div className="text-xs font-bold text-orange-400 mt-2 mb-1">FORZA</div><p className="forza-persian-copy text-sm text-white">{assistant}</p></>}</div>}
      {(catalogBusy||catalogQuery)&&<section className="pointer-events-auto rounded-2xl border border-orange-400/35 bg-[#100a06]/95 p-3 shadow-xl" aria-label="نتایج کاتالوگ صنعت پیش" dir="rtl">
        <div className="mb-2 flex items-center justify-between gap-2">
          <strong className="text-xs font-bold text-orange-300">نتایج کاتالوگ صنعت پیش</strong>
          <span className="text-[10px] text-white/60">{catalogBusy?'در حال جست‌وجو…':catalogResults.length+' خانواده محصول'}</span>
        </div>
        {catalogBusy&&<p className="py-2 text-xs text-white/70">در حال بررسی خانواده‌ها و کدهای کالا…</p>}
        {!catalogBusy&&catalogResults.length===0&&<p className="py-2 text-xs text-white/70">مورد منطبقی در کاتالوگ پیدا نشد؛ کد یا مشخصات بیشتری بگویید.</p>}
        <div className="flex flex-col gap-2">
          {catalogResults.map(family=>{
            const image=family.images?.[0]||'';
            return <article key={family.code} className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white">
                  {image?<img src={image} alt={family.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-contain"/>:<span className="text-[10px] text-slate-500">بدون تصویر</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <strong className="block text-xs font-bold leading-5 text-white">{family.name}</strong>
                  <div className="mt-0.5 text-[10px] text-white/60">{family.brand?family.brand+' · ':''}<span dir="ltr" className="font-mono">{family.code}</span></div>
                </div>
                <a href={family.link} className="shrink-0 rounded-lg bg-orange-500 px-2.5 py-2 text-[10px] font-bold text-black">مشاهده</a>
              </div>
              {!!family.variants?.length&&<div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
                {family.variants.slice(0,6).map(variant=><a key={variant.code} href={'/direct-product/'+encodeURIComponent(variant.code)} className="rounded-md bg-black/40 px-2 py-1 text-[10px] text-white/80 hover:bg-orange-500/20 hover:text-white"><bdi dir="ltr" className="font-mono">{variant.code}</bdi>{variant.size?' · '+variant.size:''}</a>)}
              </div>}
            </article>;
          })}
        </div>
      </section>}
    </div>

  </main>;
}
