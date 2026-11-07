import test from 'node:test';import assert from 'node:assert/strict';
import {forzaRecognitionRetryDelay} from '../src/utils/forzaRecognitionRecovery';
test('transient STT network failures have bounded backoff; permissions and permanent errors never loop',()=>{
 assert.deepEqual([0,1,2,3].map(n=>forzaRecognitionRetryDelay('network',n)),[400,1200,2800,null]);
 for(const e of ['not-allowed','service-not-allowed','language-not-supported','audio-capture','aborted'])assert.equal(forzaRecognitionRetryDelay(e,0),null);
 assert.equal(forzaRecognitionRetryDelay('network',NaN),null);
});
