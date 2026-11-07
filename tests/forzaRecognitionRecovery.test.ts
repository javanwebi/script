import test from 'node:test';import assert from 'node:assert/strict';
import {forzaRecognitionRetryDelay} from '../src/utils/forzaRecognitionRecovery';
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
 assert.match(deploy,/vosk-browser@0\\.0\\.8/);
 assert.match(deploy,/public\\/forza-runtime\\/stt\\/vosk\\.js/);
 assert.match(deploy,/dist\\/forza-runtime\\/stt\\/vosk\\.js/);
 assert.match(local,/VOSK_SCRIPT_URL='\\/forza-runtime\\/stt\\/vosk\\.js'/);
});
