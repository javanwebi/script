import test from 'node:test';
import assert from 'node:assert/strict';
import {ForzaRecordingSafety,forzaSttFailure} from '../src/utils/forzaSttTurnSafety';
test('playback contaminated recording stays blocked after playback stops, next clean turn recovers',()=>{
 const recording=new ForzaRecordingSafety();
 for(let turn=0;turn<3;turn++){
  recording.reset();recording.observe(false,false);assert.equal(recording.safe,true);
  recording.observe(true,false);recording.observe(false,false);assert.equal(recording.safe,false);
  recording.reset();recording.observe(false,true);assert.equal(recording.safe,false);
  recording.reset();recording.observe(false,false);assert.equal(recording.safe,true);
 }
});
test('no speech differs from provider outage and capacity error',()=>{
 assert.equal(forzaSttFailure(422,'stt_no_transcript').code,'stt_no_transcript');
 assert.equal(forzaSttFailure(503,'stt_provider_unavailable').code,'stt_unavailable');
 assert.equal(forzaSttFailure(429,'').code,'stt_busy');
});
