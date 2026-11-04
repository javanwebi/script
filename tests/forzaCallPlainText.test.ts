import test from 'node:test';
import assert from 'node:assert/strict';
import {ForzaCallPlainText, forzaSpokenPlainText} from '../src/utils/forzaCallPlainText';
import {ForzaIncrementalSpeechText} from '../src/utils/forzaIncrementalSpeechText';

function chunks(raw:string):string[] {
  const projector=new ForzaCallPlainText();
  const views:string[]=[];
  for(let i=1;i<=raw.length;i++) views.push(projector.push(raw.slice(0,i)));
  views.push(projector.complete(raw));
  return views;
}

test('broken bold stars never flash or reach TTS; all technical codes survive',()=>{
  const raw='تسمه **SPA 1250** و بلبرینگ **6202ZZ** با لقی C3';
  const frames=chunks(raw);
  assert.ok(frames.every(frame=>!frame.includes('*')));
  assert.equal(frames.at(-1),'تسمه SPA 1250 و بلبرینگ 6202ZZ با لقی C3');
});

test('Markdown links show only title and never reveal a split raw URL',()=>{
  const frames=chunks('مشخصات [تسمه SPA 1250](https://example.com/part?id=6202ZZ) را ببینید.');
  assert.ok(frames.every(frame=>!frame.includes('https')&&!frame.includes('example.com')));
  assert.equal(frames.at(-1),'مشخصات تسمه SPA 1250 را ببینید.');
});

test('inline backticks, titles and standalone URLs cannot be voiced',()=>{
  const projector=new ForzaCallPlainText();
  const txt='# مشخصات ' + String.fromCharCode(96) +
    'SPA 1250' + String.fromCharCode(96) + ' https://example.com/belt';
  assert.equal(projector.complete(txt),'مشخصات SPA 1250');
  assert.ok(!projector.complete(txt).includes('*'));
});

test('spoken dimension operator is meaningful, while original technical codes are unchanged',()=>{
  assert.equal(forzaSpokenPlainText('ابعاد ۱۰×۲۰ و کد SPA 1250 و 6202ZZ و C3'),
    'ابعاد ده در بیست و کد SPA 1250 و 6202ZZ و C3');
  assert.equal(chunks('ابعاد 10*20').at(-1),'ابعاد 10×20');
});

test('first complete short phrase enters Nima without authoritative SSE done',()=>{
  const planner=new ForzaIncrementalSpeechText();
  const first=planner.push('سلام.');
  assert.deepEqual(first,['سلام.']);
  assert.deepEqual(planner.push('سلام.'),[]);
  assert.deepEqual(planner.complete('سلام.'),[]);
});

test('streamed subtitles cannot rewrite text that has already been voiced',()=>{
  const p=new ForzaCallPlainText();
  p.push('تسمه **SPA 1250** ');
  assert.throws(()=>p.push('تسمه **SPA 1251** '),/stream_revised/);
});

test('multiword link title is retained if the link ends midstream',()=>{
  const p=new ForzaCallPlainText();
  assert.equal(p.complete('برای [مشخصات کامل دستگاه'),'برای مشخصات کامل دستگاه');
});
