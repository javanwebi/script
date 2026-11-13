import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {WebSocket} from 'ws';
import {selectForzaSttProvider} from './forzaSttProvider';
import {hasForzaDibaSttModel} from './forzaDibaStt';

type Slot={child:ChildProcessWithoutNullStreams; ready:boolean; dead:boolean; clients:Map<string,WebSocket>};
const pool:Slot[]=[];
function send(ws:WebSocket, message:object){
  if(ws.readyState!==WebSocket.OPEN)return;
  if(ws.bufferedAmount>65536){ws.close(1013,'STT output congested');return;}
  ws.send(JSON.stringify(message));
}
function write(slot:Slot, message:object){
  if(slot.dead||slot.child.stdin.writableLength>262144)return false;
  slot.child.stdin.write(JSON.stringify(message)+'\n');
  return true;
}
function launch():Slot{
  const child=spawn(process.env.FORZA_STT_PYTHON||'/opt/forza-pocket/bin/python',
    [path.resolve('scripts/forza_diba_stream_worker.py')],{stdio:['pipe','pipe','pipe']});
  const slot:Slot={child,ready:false,dead:false,clients:new Map()};
  const timeout=setTimeout(()=>fail(),20000);
  const fail=()=>{
    if(slot.dead)return;
    slot.dead=true;clearTimeout(timeout);
    for(const ws of slot.clients.values()){send(ws,{type:'error',code:'diba_stream_unavailable'});ws.close(1011,'STT worker unavailable');}
    slot.clients.clear();child.kill();
    const index=pool.indexOf(slot);if(index>=0)pool.splice(index,1);
  };
  child.on('error',fail);child.on('exit',fail);child.stdin.on('error',fail);
  child.stderr.on('data',()=>{});
  createInterface({input:child.stdout}).on('line',line=>{
    let msg:any;try{msg=JSON.parse(line);}catch{return;}
    if(msg.type==='worker_ready'){
      clearTimeout(timeout);slot.ready=true;
      for(const id of slot.clients.keys())if(!write(slot,{id,op:'open'}))fail();
      return;
    }
    const ws=slot.clients.get(msg.id);if(!ws)return;
    if(msg.type==='result')send(ws,{type:'result',text:String(msg.text||'').slice(0,6000),final:msg.final===true,flushed:msg.flushed===true});
    else if(msg.type==='ready')send(ws,{type:'ready',provider:'diba',sampleRate:16000});
    else {send(ws,{type:'error',code:'diba_stream_failed'});ws.close(1011,'STT failed');}
  });
  return slot;
}

/** Same-origin WS path shares the existing /api/live reverse proxy. */
export function connectForzaDibaStream(ws:WebSocket){
  if(selectForzaSttProvider(process.env).provider!=='diba'||!hasForzaDibaSttModel()){send(ws,{type:'error',code:'diba_model_missing'});ws.close(1013,'Diba unavailable');return;}
  // Two shared model processes, at most forty isolated recognizers. Capacity
  // is an admission ceiling, not a promise of realtime throughput on every CPU.
  let slot=pool.filter(s=>!s.dead&&s.clients.size<20).sort((a,b)=>a.clients.size-b.clients.size)[0];
  if(pool.length<2 && (!slot || slot.clients.size>=20)){slot=launch();pool.push(slot);}
  if(!slot){send(ws,{type:'error',code:'diba_stream_busy'});ws.close(1013,'STT capacity');return;}
  const id=randomUUID();slot.clients.set(id,ws);
  if(slot.ready&&!write(slot,{id,op:'open'})){ws.close(1013,'STT congested');}
  let last=Date.now(),windowStart=last,bytes=0,controls=0;
  const timer=setInterval(()=>{if(Date.now()-last>45000)ws.close(1000,'STT idle');},10000);
  ws.on('message',(raw,isBinary)=>{
    const data=Array.isArray(raw)?Buffer.concat(raw):Buffer.from(raw as ArrayBuffer);
    last=Date.now();if(last-windowStart>=1000){windowStart=last;bytes=0;controls=0;}
    if(isBinary){
      bytes+=data.length;
      if(!slot.ready||data.length===0||data.length>8192||data.length%2||bytes>64000){ws.close(1008,'Invalid PCM rate');return;}
      if(!write(slot,{id,op:'audio',pcm:Buffer.from(data as Buffer).toString('base64')}))ws.close(1013,'STT congested');
    }else{
      if(data.length>128||++controls>10){ws.close(1008,'Invalid STT control');return;}
      let msg:any;try{msg=JSON.parse(String(data));}catch{ws.close(1008,'Invalid STT control');return;}
      if(msg.type==='ping')send(ws,{type:'pong'});
      else if(msg.type==='flush'&&slot.ready){if(!write(slot,{id,op:'flush'}))ws.close(1013,'STT congested');}
      else ws.close(1008,'Invalid STT control');
    }
  });
  ws.once('close',()=>{
    clearInterval(timer);slot.clients.delete(id);
    // A close follows only the bounded PCM already queued. No cancelled
    // 45-second file remains running behind a timed-out Node request.
    if(slot.ready&&!write(slot,{id,op:'close'}))slot.child.kill();
  });
  ws.on('error',()=>ws.close());
}
