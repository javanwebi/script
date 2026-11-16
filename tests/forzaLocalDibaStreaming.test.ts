import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the Persian Diba browser recognizer is loaded from the same origin, never a third-party model host',()=>{
 const local=readFileSync('src/utils/forzaLocalSpeech.ts','utf8');
 const server=readFileSync('server.ts','utf8');
 const docker=readFileSync('ops/Dockerfile.forza-stt-runtime','utf8');
 const deploy=readFileSync('ops/deploy-single-port-vps.sh','utf8');
 const canary=readFileSync('ops/verify-single-port-canary.mjs','utf8');
 assert.match(local,/FORZA_DIBA_MODEL_URL='\/forza-runtime\/stt\/diba-stt-fa-small-c244182d\.tar\.gz'/);
 assert.doesNotMatch(local,/https:\/\/huggingface\.co/);
 assert.match(server,/app\.get\('\/forza-runtime\/stt\/diba-stt-fa-small-c244182d\.tar\.gz'/);
 assert.match(server,/FORZA_STT_DIBA_BROWSER_ARCHIVE/);
 assert.match(server,/Cache-Control','public, max-age=31536000, immutable/);
 assert.match(server,/sendFile\(archive,\{maxAge:'1y',immutable:true\}\)/);
 assert.match(docker,/cp \/tmp\/diba-stt-fa-small\.tar\.gz \/opt\/diba-stt\/diba-stt-fa-small\.tar\.gz/);
 assert.match(docker,/FORZA_STT_DIBA_BROWSER_ARCHIVE=\/opt\/diba-stt\/diba-stt-fa-small\.tar\.gz/);
 assert.match(deploy,/test -s \/opt\/diba-stt\/diba-stt-fa-small\.tar\.gz/);
 assert.match(canary,/DIBA_BROWSER_MODEL_HTTP_/);
 assert.match(canary,/DIBA_BROWSER_MODEL_CONTENT_LENGTH_MISSING/);
});

test('local Diba streams partial and final hypotheses and falls back to browser recognition on model errors',()=>{
 const ui=readFileSync('src/components/forza/AiForzaCallExperience.tsx','utf8');
 assert.match(ui,/loadDibaSttModel\(\)\.then\(model=>/);
 assert.match(ui,/dibaCpuCount>=6/);
 assert.match(ui,/dibaSaveData/);
 assert.match(ui,/recognizer\.on\('partialresult'/);
 assert.match(ui,/recognizer\.on\('result'/);
 assert.match(ui,/recognizer\.on\('error'/);
 assert.match(ui,/recognitionStartRef\.current\(\)/);
 assert.match(ui,/const localReady=startDibaTurn\(\)/);
 assert.match(ui,/دایبا محلی آماده است · تشخیص زنده/);
});

test('the native browser fallback remains active while local model loading is pending',()=>{
 const ui=readFileSync('src/components/forza/AiForzaCallExperience.tsx','utf8');
 const load=ui.indexOf('void loadDibaSttModel().then(model=>');
 const native=ui.indexOf('recognitionRef.current=initSpeechRecognition()',load);
 assert.ok(load>0&&native>load);
 assert.match(ui,/Chrome keeps transcribing immediately/);
 assert.match(ui,/if\(localReady\)/);
});
