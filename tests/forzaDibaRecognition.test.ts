import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ForzaDibaRecognition} from '../src/utils/forzaDibaRecognition';

test('Diba adapter preserves interim/final boundaries, PCM and shared microphone ownership',async t=>{
  const originals={WebSocket:globalThis.WebSocket,fetch:globalThis.fetch,window:(globalThis as any).window,AudioWorkletNode:(globalThis as any).AudioWorkletNode};
  let socket:any,worklet:any,disconnected:any;
  class Socket {
    static OPEN=1;readyState=1;bufferedAmount=0;sent:any[]=[];onmessage:any;onerror:any;onclose:any;
    constructor(){socket=this;}
    send(value:any){this.sent.push(value);}
    close(){this.readyState=3;}
    receive(value:any){this.onmessage?.({data:JSON.stringify(value)});}
  }
  class Worklet {port={onmessage:null as any,close(){}};constructor(){worklet=this;}connect(){}disconnect(){}}
  Object.assign(globalThis,{WebSocket:Socket,AudioWorkletNode:Worklet,window:{location:{href:'https://sanatpish.com/ai-forza'}},fetch:async()=>({ok:true,json:async()=>({available:true})})});
  t.after(()=>Object.assign(globalThis,originals));
  const context:any={sampleRate:48000,audioWorklet:{addModule:async()=>{}},createGain:()=>({gain:{value:1},connect(){},disconnect(){}}),destination:{}};
  const source:any={connect(){},disconnect(node:any){disconnected=node;}};
  const providers:string[]=[];const events:any[]=[];
  const rec=new ForzaDibaRecognition(context,source,p=>providers.push(p));
  t.after(()=>rec.abort());
  rec.onresult=e=>events.push(JSON.parse(JSON.stringify(e.results)));
  rec.start();await new Promise(r=>setImmediate(r));
  socket.receive({type:'ready'});await new Promise(r=>setImmediate(r));
  assert.deepEqual(providers,['diba']);
  worklet.port.onmessage({data:new Float32Array(2048).fill(0.5)});
  const pcm=socket.sent[0];assert.ok(pcm instanceof ArrayBuffer);assert.ok(pcm.byteLength<2048);
  assert.equal(new DataView(pcm).getInt16(0,true),16384);
  socket.receive({type:'result',text:'بلبرینگ',final:false});
  socket.receive({type:'result',text:'بلبرینگ',final:false});
  assert.equal(events.length,1,'duplicate partials suppressed');
  assert.equal(rec.requestFinal(),true);assert.equal(rec.requestFinal(),true);
  assert.equal(socket.sent.filter((v:any)=>typeof v==='string'&&JSON.parse(v).type==='flush').length,1);
  socket.receive({type:'result',text:'بلبرینگ 6203',final:true,flushed:true});
  socket.receive({type:'result',text:'اندازه',final:false});
  assert.equal(events.at(-1).length,2);
  assert.equal(events.at(-1)[0][0].transcript,'بلبرینگ 6203');
  assert.equal(events.at(-1)[1][0].transcript,'اندازه');
  const oldSocket=socket;let errors=0;rec.onerror=()=>{errors++;};
  oldSocket.onerror();
  assert.equal(errors,1);assert.equal(rec.hasPendingServerFinal,true,'failed partial stays unconfirmed');
  rec.abort();
  assert.equal(disconnected,worklet,'only adapter connection disconnected');
  assert.equal(oldSocket.onmessage,null);assert.equal(rec.requestFinal(),false);
});

test('unavailable Diba selects browser fallback without waiting for a worker timeout',async t=>{
  const oldFetch=globalThis.fetch;let started=0,aborted=0;const providers:string[]=[];
  globalThis.fetch=(async()=>({ok:true,json:async()=>({available:false})})) as any;
  t.after(()=>{globalThis.fetch=oldFetch;});
  class Browser {onstart:any;start(){started++;this.onstart();}abort(){aborted++;}}
  const rec=new ForzaDibaRecognition({} as any,{} as any,p=>providers.push(p),Browser);
  t.after(()=>rec.abort());rec.start();await new Promise(r=>setImmediate(r));
  assert.equal(started,1);assert.deepEqual(providers,['browser']);assert.equal(rec.isServerStream,false);
  rec.abort();assert.equal(aborted,1);
});

test('aborting during capability lookup cannot create a late recognition session',async t=>{
  const oldFetch=globalThis.fetch;let resolve:any,started=0;
  globalThis.fetch=(()=>new Promise(r=>{resolve=r;})) as any;
  t.after(()=>{globalThis.fetch=oldFetch;});
  class Browser {start(){started++;}abort(){}}
  const rec=new ForzaDibaRecognition({} as any,{} as any,()=>{},Browser);
  rec.start();rec.abort();resolve({ok:true,json:async()=>({available:false})});
  await new Promise(r=>setImmediate(r));assert.equal(started,0);
});
