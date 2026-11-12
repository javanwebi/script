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
    'ابعاد ده در بیست و کد اِس پی اِی یک هزار و دویست و پنجاه و شش دو صفر دو، زِد زِد و سی سه');
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


test('headings and numbered bullets split across SSE chunks never leak markers',()=>{
  const raw='### مشخصات\n1. تسمه SPA 1250\n- بلبرینگ 6202ZZ';
  const frames=chunks(raw);
  assert.ok(frames.every(v=>!v.includes('#')&&!v.includes('1.')&&!v.includes('\n-')));
  assert.equal(frames.at(-1),'مشخصات تسمه SPA 1250 بلبرینگ 6202ZZ');
});

test('decimal dimensions and negative technical values survive plain-text display',()=>{
  const project=new ForzaCallPlainText();
  assert.equal(project.complete('3.25×20 و -5'),'3.25×20 و -5');
  assert.equal(forzaSpokenPlainText('ابعاد 100×200 و 3.25×20'),
    'ابعاد صد در دویست و سه ممیز دو پنج در بیست');
});


test('industrial SKU suffixes and engineering units are spoken clearly without changing display text',()=>{
  assert.equal(forzaSpokenPlainText('بلبرینگ 6203C3 با قطر 12.7 mm و دور 1500 rpm'),
    'بلبرینگ شش دو صفر سه، سی سه با قطر دوازده ممیز هفت میلی‌متر و دور یک هزار و پانصد دور در دقیقه');
  assert.equal(chunks('بلبرینگ 6203C3').at(-1),'بلبرینگ 6203C3');
});
