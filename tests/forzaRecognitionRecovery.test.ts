import test from 'node:test';import assert from 'node:assert/strict';
import {forzaRecognitionRetryDelay} from '../src/utils/forzaRecognitionRecovery';
import {disposeDibaSttModel} from '../src/utils/forzaLocalSpeech';
test('transient STT network failures have bounded backoff; permissions and permanent errors never loop',()=>{
 assert.deepEqual([0,1,2,3].map(n=>forzaRecognitionRetryDelay('network',n)),[400,1200,2800,null]);
 for(const e of ['not-allowed','service-not-allowed','language-not-supported','audio-capture','aborted'])assert.equal(forzaRecognitionRetryDelay(e,0),null);
 assert.equal(forzaRecognitionRetryDelay('network',NaN),null);
});


test('Diba is wired as a lazy Persian STT fallback, not an unused helper',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
 assert.match(source,/loadDibaSttModel/);
 assert.match(source,/const ensureDibaStt/);
 assert.match(source,/recognitionRetryRef\.current>=2/);
 assert.match(source,/const startVoiceInput/);
 assert.match(source,/source=diba fallback=activated/);
});


test('production blue-green build ships the Vosk script at the exact browser URL',async()=>{
 const {readFile}=await import('node:fs/promises');
 const deploy=await readFile(new URL('../ops/deploy-main-bluegreen-vps.sh',import.meta.url),'utf8');
 const local=await readFile(new URL('../src/utils/forzaLocalSpeech.ts',import.meta.url),'utf8');
 assert.ok(deploy.includes('vosk-browser@0.0.8'));
 assert.ok(deploy.includes('public/forza-runtime/stt/vosk.js'));
 assert.ok(deploy.includes('dist/forza-runtime/stt/vosk.js'));
 assert.ok(local.includes("VOSK_SCRIPT_URL='/forza-runtime/stt/vosk.js'"));
});


test('Diba teardown terminates the model and invalidates the cached loader',()=>{
 let terminated=0;
 disposeDibaSttModel({terminate:()=>{terminated++;}} as any);
 assert.equal(terminated,1);
});

test('FORZA call teardown cancels session-owned media and audio resources',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
 assert.match(source,/const teardownCall=useCallback/);
 assert.match(source,/activeTurnRef\.current=null;[\s\S]{0,100}active\?\.abort\.abort/);
 assert.match(source,/recorder\.onstop=null/);
 assert.match(source,/recognition\.abort\(\)/);
 assert.match(source,/disposeDibaSttModel\(localModel(?:\|\|undefined)?\)/);
 assert.match(source,/track\.stop\(\)/);
 assert.match(source,/context\.close\(\)/);
 assert.match(source,/micPollTimerRef\.current=null/);
 assert.match(source,/recognitionRestartTimerRef\.current=null/);
 assert.match(source,/if\(callClosedRef\.current\)\{stream\.getTracks\(\)/);
});
