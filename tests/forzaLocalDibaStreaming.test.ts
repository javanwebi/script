import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FORZA_DIBA_SAMPLE_RATE, resampleDibaPcm } from '../src/utils/forzaLocalSpeech';


test('Diba receives correctly resampled 16 kHz mono PCM from common 48 kHz browser audio',()=>{
 const inputRate=48000;
 const input=new Float32Array(inputRate);
 for(let i=0;i<input.length;i++)input[i]=0.5*Math.sin(2*Math.PI*1000*i/inputRate);
 const output=resampleDibaPcm(input,inputRate);
 assert.equal(FORZA_DIBA_SAMPLE_RATE,16000);
 assert.equal(output.length,16000);
 const rms=Math.sqrt(output.reduce((sum,value)=>sum+value*value,0)/output.length);
 assert.ok(rms>0.32&&rms<0.38,'speech-band energy should survive resampling');
 assert.ok(output.every(Number.isFinite),'resampled PCM must not contain NaN/Infinity');

 const highTone=new Float32Array(inputRate);
 for(let i=0;i<highTone.length;i++)highTone[i]=0.5*Math.sin(2*Math.PI*12000*i/inputRate);
 const filtered=resampleDibaPcm(highTone,inputRate);
 const highRms=Math.sqrt(filtered.reduce((sum,value)=>sum+value*value,0)/filtered.length);
 assert.ok(highRms<0.03,'frequencies above the 8 kHz Nyquist limit must not alias into speech');

 const input44100=new Float32Array(44100);
 for(let i=0;i<input44100.length;i++)input44100[i]=0.5*Math.sin(2*Math.PI*1000*i/44100);
 const output44100=resampleDibaPcm(input44100,44100);
 assert.equal(output44100.length,16000,'44.1 kHz capture must preserve one second of audio');
 const rms44100=Math.sqrt(output44100.reduce((sum,value)=>sum+value*value,0)/output44100.length);
 assert.ok(rms44100>0.32&&rms44100<0.38,'44.1 kHz speech energy must survive conversion');
 assert.equal(resampleDibaPcm(input,4000).length,0,'unsupported capture rates fail closed');
});

test('Diba PCM helper preserves already-16 kHz microphone buffers',()=>{
 const input=Float32Array.from([0.1,-0.2,0.3,-0.4]);
 const output=resampleDibaPcm(input,16000);
 assert.deepEqual(Array.from(output),Array.from(input));
 assert.notEqual(output,input,'caller buffers must not be mutated or retained');
});

test('the Persian Diba browser recognizer is loaded from the same origin, never a third-party model host',()=>{
 const local=readFileSync('src/utils/forzaLocalSpeech.ts','utf8');
 const server=readFileSync('server.ts','utf8');
 const docker=readFileSync('ops/Dockerfile.forza-stt-runtime','utf8');
 const deploy=readFileSync('ops/deploy-single-port-vps.sh','utf8');
 const legacyDeploy=readFileSync('ops/sanatpish-deploy.sh','utf8');
 const workflow=readFileSync('.github/workflows/verify-vps-build.yml','utf8');
 const canary=readFileSync('ops/verify-single-port-canary.mjs','utf8');
 assert.match(local,/FORZA_DIBA_MODEL_URL='\/forza-runtime\/stt\/diba-stt-fa-small-c244182d\.tar\.gz'/);
 assert.match(local,/within\(modelPromise,90000,'diba_model_timeout',model=>model\.terminate\?\.\(\)\)/,
  'a model worker resolving after its load timeout must be terminated');
 assert.doesNotMatch(local,/https:\/\/huggingface\.co/);
 assert.match(server,/app\.get\('\/forza-runtime\/stt\/diba-stt-fa-small-c244182d\.tar\.gz'/);
 assert.match(server,/FORZA_STT_DIBA_BROWSER_ARCHIVE/);
 assert.match(server,/Cache-Control','public, max-age=31536000, immutable/);
 assert.match(server,/sendFile\(archive,\{maxAge:'1y',immutable:true\}\)/);
 assert.match(docker,/cp \/tmp\/diba-stt-fa-small\.tar\.gz \/opt\/diba-stt\/diba-stt-fa-small\.tar\.gz/);
 assert.match(docker,/FORZA_STT_DIBA_BROWSER_ARCHIVE=\/opt\/diba-stt\/diba-stt-fa-small\.tar\.gz/);
 assert.match(deploy,/test -s \/opt\/diba-stt\/diba-stt-fa-small\.tar\.gz/);
 assert.match(deploy,/vosk-browser@0\.0\.8/);
 assert.match(deploy,/cp node_modules\/vosk-browser\/dist\/vosk\.js public\/forza-runtime\/stt\/vosk\.js/);
 assert.match(deploy,/test -s dist\/forza-runtime\/stt\/vosk\.js/);
 assert.match(legacyDeploy,/vosk-browser@0\.0\.8/);
 assert.match(legacyDeploy,/cp node_modules\/vosk-browser\/dist\/vosk\.js public\/forza-runtime\/stt\/vosk\.js/);
 assert.match(legacyDeploy,/Candidate Diba browser runtime missing/);
 assert.match(workflow,/vosk-browser@0\.0\.8/);
 assert.match(workflow,/cp node_modules\/vosk-browser\/dist\/vosk\.js public\/forza-runtime\/stt\/vosk\.js/);
 assert.match(workflow,/test -s dist\/forza-runtime\/stt\/vosk\.js/);
 assert.match(canary,/DIBA_BROWSER_MODEL_HTTP_/);
 assert.match(canary,/DIBA_BROWSER_MODEL_CONTENT_LENGTH_MISSING/);
 assert.match(canary,/DIBA_BROWSER_VOSK_SCRIPT_HTTP_/);
 assert.match(canary,/DIBA_BROWSER_VOSK_SCRIPT_CONTENT_LENGTH_MISSING/);
});

test('local Diba streams partial and final hypotheses and falls back to browser recognition on model errors',()=>{
 const ui=readFileSync('src/components/forza/AiForzaCallExperience.tsx','utf8');
 assert.match(ui,/loadDibaSttModel\(\)\.then\(model=>/);
 assert.match(ui,/dibaCpuCount>=4/);
 assert.match(ui,/dibaSaveData/);
 assert.match(ui,/createScriptProcessor\(2048,1,1\)/,'small audio frames keep live partial latency low');
 assert.match(ui,/resampleDibaPcm\(mono,input\.sampleRate\)/,'browser capture must be resampled to the model rate');
 assert.match(ui,/new model\.KaldiRecognizer\(FORZA_DIBA_SAMPLE_RATE\)/);
 assert.match(ui,/hasRecentNearFieldEvidence\(micNow\)/,'resumed speech must reset the endpoint before the full admission latch');
 assert.match(ui,/hasRecentNearFieldEvidence\(Date\.now\(\)\)/,'fresh near-field PCM cancels pending turn dispatch');
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
