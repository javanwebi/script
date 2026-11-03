import test from 'node:test';
import assert from 'node:assert/strict';
import {ForzaTurnTelemetry,forzaLatencyDistribution,forzaSessionLatencySummary} from '../src/utils/forzaTurnTelemetry';

test('finite p50/p95 and mean are computed from real supplied samples, not fabricated trials',()=>{
  const distribution=forzaLatencyDistribution([800,1000,900,1100,1200]);
  assert.deepEqual(distribution,{count:5,meanMs:1000,medianMs:1000,p95Ms:1200});
  assert.equal(forzaLatencyDistribution([]).p95Ms,null);
  assert.equal(forzaLatencyDistribution([NaN,-20,15]).count,1);
});
test('clock milestones capture actual speech-end to audio-start latency',()=>{
  let now=0;
  const clock=()=>now;
  const m=new ForzaTurnTelemetry('test-random-turn',clock);
  m.markAt('speech_start',0);
  m.markAt('speech_end',1100);
  m.markAt('endpoint_detected',1880);
  m.markAt('server_request',1920);
  now=3200;m.mark('first_text');
  now=4200;m.mark('audio_started');
  assert.equal(m.duration('endpoint_delay_ms','speech_end','endpoint_detected'),780);
  assert.equal(m.duration('server_to_audio_ms','server_request','audio_started'),2280);
  assert.equal(m.duration('unmeasured','stt_final','audio_started'),null);
  assert.equal(forzaSessionLatencySummary()['endpoint_delay_ms'].count>=1,true);
});
