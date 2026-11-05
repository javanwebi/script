import test from 'node:test';
import assert from 'node:assert/strict';
import {withForzaSttDeadline} from '../server/ai/forzaSttDeadline';

test('STT returns the provider result and does not abort a completed request',async()=>{
  let upstream:AbortSignal|undefined;
  const result=await withForzaSttDeadline(async signal=>{
    upstream=signal;
    return {text:'6203ZZ',confidence:0.9};
  },undefined,200);
  assert.equal(result.text,'6203ZZ');
  assert.equal(upstream?.aborted,false);
});

test('STT timeout aborts the actual in-flight provider work',async()=>{
  let upstream:AbortSignal|undefined;
  const unresolved=withForzaSttDeadline(async signal=>{
    upstream=signal;
    return await new Promise<string>(()=>{});
  },undefined,15);
  await assert.rejects(unresolved,/FORZA_STT_TIMEOUT/);
  assert.equal(upstream?.aborted,true);
  assert.match(String(upstream?.reason?.message),/FORZA_STT_TIMEOUT/);
});

test('browser disconnect stops provider without waiting for its configured timeout',async()=>{
  const disconnected=new AbortController();
  let upstream:AbortSignal|undefined;
  const unresolved=withForzaSttDeadline(async signal=>{
    upstream=signal;
    return await new Promise<string>(()=>{});
  },disconnected.signal,1000);
  await Promise.resolve();
  disconnected.abort();
  await assert.rejects(unresolved,/FORZA_STT_DISCONNECTED/);
  assert.equal(upstream?.aborted,true);
});

test('pre-aborted client never sends speech data to a provider',async()=>{
  const disconnected=new AbortController();
  disconnected.abort();
  let invoked=false;
  await assert.rejects(withForzaSttDeadline(async()=>{
    invoked=true;
    return 'no';
  },disconnected.signal,100),/FORZA_STT_DISCONNECTED/);
  assert.equal(invoked,false);
});

test('invalid or unbounded timeout is refused before starting work',async()=>{
  let invoked=false;
  await assert.rejects(withForzaSttDeadline(async()=>{
    invoked=true;
    return null;
  },undefined,999999),/INVALID_DEADLINE/);
  assert.equal(invoked,false);
});
