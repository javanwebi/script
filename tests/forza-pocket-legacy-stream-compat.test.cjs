'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const server=readFileSync(new URL('../server.ts','file://'+__filename),'utf8');
test('only 404 from old private /speak-stream allows original Pocket full WAV compatibility',()=>{
 const start=server.indexOf("app.post('/api/ai/forza-speech-stream'");
 const end=server.indexOf("// POST: /api/ai/consult-stream",start);
 assert.ok(start>0&&end>start);
 const route=server.slice(start,end);
 assert.match(route,/if\(upstream\?\.status===404\)/);
 assert.match(route,/legacy_worker_no_stream_endpoint status=404/);
 assert.match(route,/const health=await fetch\(internalForzaVoiceUrl\+'\/health'/);
 assert.match(route,/identity\?\.voice!=='pocket-farsi-v2'/);
 assert.match(route,/const legacy=await fetch\(internalForzaVoiceUrl\+'\/speak'/);
 assert.match(route,/X-Forza-Voice-Token/);
 assert.match(route,/wav\.readUInt32LE\(24\)!==24000/);
 assert.match(route,/framing\.writeUInt32LE\(wav\.length,0\)/);
 assert.match(route,/res\.end\(Buffer\.concat\(\[framing,wav\]\)\)/);
 assert.match(route,/X-Forza-Voice-Compatibility','legacy-full-wav'/);
 assert.match(route,/Cache-Control','no-store, no-transform'/);
 assert.ok(route.indexOf("if(upstream?.status===404)")<route.indexOf("if(!upstream?.ok)"));
 assert.doesNotMatch(route,/\b(?:window\.)?speechSynthesis\.speak\(|\bnew SpeechSynthesisUtterance\(|\bpiper-amir-medium\b|wav\.writeFile\(/);
});
test('new Pocket progressive workers retain pass-through WAV frame stream',()=>{
 const route=server.slice(server.indexOf("app.post('/api/ai/forza-speech-stream'"),
  server.indexOf("// POST: /api/ai/consult-stream"));
 assert.match(route,/application\/x-forza-wav-frames/);
 assert.match(route,/for await\(const chunk of upstream\.body as any\)/);
 assert.match(route,/if\(!res\.write\(chunk\)\)/);
 assert.match(route,/controller\.signal/);
 assert.match(route,/pocket_stream_unavailable/);
});
