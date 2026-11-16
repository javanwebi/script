import test from 'node:test';import assert from 'node:assert/strict';
import {forzaRecognitionRetryDelay} from '../src/utils/forzaRecognitionRecovery';

test('transient STT network failures keep recovering with a capped backoff for the life of the call',()=>{
 assert.deepEqual([0,1,2,3,4,5,12].map(n=>forzaRecognitionRetryDelay('network',n)),
  [400,1200,2800,5000,8000,8000,8000]);
 for(const e of ['not-allowed','service-not-allowed','language-not-supported','audio-capture','aborted'])
  assert.equal(forzaRecognitionRetryDelay(e,0),null);
 assert.equal(forzaRecognitionRetryDelay('network',NaN),null);
 assert.equal(forzaRecognitionRetryDelay('network',-1),null);
});
