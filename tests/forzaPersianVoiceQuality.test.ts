import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareAmirSpeechText, balanceAmirWavVolume } from '../src/utils/forzaPersianVoiceQuality';

test('Forza Persian voice speaks known technical codes without altering displayed identifiers',()=>{
  const prepared=prepareAmirSpeechText('بلبرینگ SKF مدل 6205 با لقی C3 و تسمه SPA 1250 به طول 12 mm.');
  assert.match(prepared,/اِس کِی اِف/);
  assert.match(prepared,/سی سه/);
  assert.match(prepared,/اِس پی اِی/);
  assert.match(prepared,/12 میلی‌متر/);
  assert.match(prepared,/6205/);
  assert.match(prepared,/1250/);
});
test('Normalizes Arabic glyphs, punctuation and marketing markdown without changing text meaning',()=>{
  assert.equal(prepareAmirSpeechText('**سلام**،  به صنعت پيش خوش آمديد!!!'), 'سلام، به صنعت پیش خوش آمدید!');
  assert.match(prepareAmirSpeechText('تسمه V-belt و HTD 8M'),/تسمه وی بِلْت و اِچ تی دی 8M/);
});
test('WAV voice leveling rejects invalid and silent audio safely',async()=>{
  const original=new Blob([new Uint8Array([2,3,4,5])],{type:'application/octet-stream'});
  assert.equal(await balanceAmirWavVolume(original),original);
  const silent=makeWav(6000,()=>0);
  assert.equal((await balanceAmirWavVolume(silent)).size,silent.size);
});
test('WAV voice leveling preserves headers and limits gains',async()=>{
  const wav=makeWav(12000,i=>Math.round(Math.sin(i/9)*2000));
  const result=await balanceAmirWavVolume(wav);
  const b=await result.arrayBuffer();
  const v=new DataView(b);
  assert.equal(v.getUint32(0,false),0x52494646);
  assert.equal(v.getUint32(8,false),0x57415645);
  assert.equal(v.getUint32(4,true)+8,b.byteLength);
  assert.ok(Math.abs(v.getInt16(44+2*30,true))<3000);
});
function makeWav(samples:number,value:(i:number)=>number):Blob {
  const out=new ArrayBuffer(44+samples*2),view=new DataView(out);
  const ascii=(pos:number,str:string)=>{for(let i=0;i<str.length;i++)view.setUint8(pos+i,str.charCodeAt(i));};
  ascii(0,'RIFF');view.setUint32(4,out.byteLength-8,true);ascii(8,'WAVE');ascii(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,22050,true);view.setUint32(28,44100,true);view.setUint16(32,2,true);
  view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,samples*2,true);
  for(let i=0;i<samples;i++)view.setInt16(44+i*2,value(i),true);
  return new Blob([out],{type:'audio/wav'});
}
