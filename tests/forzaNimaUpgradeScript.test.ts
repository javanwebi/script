import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const script=readFileSync(new URL('../ops/upgrade-forza-realtime-vps.sh',import.meta.url),'utf8');
test('private Nima upgrade proves multi-frame streaming in a disposable canary before live promotion',()=>{
  assert.match(script,/run_voice "\$CANARY"/);
  assert.match(script,/speak-stream/);
  assert.match(script,/X-Forza-Stream-Protocol/);
  assert.match(script,/FORZA_PROGRESSIVE_STREAM_CANARY/);
  assert.match(script,/frames>=2/);
  assert.ok(script.indexOf('FORZA_PROGRESSIVE_STREAM_CANARY')<script.indexOf('run_voice "\$LIVE"'));
  assert.match(script,/ROLLBACK_CONTAINER/);
  assert.ok(script.includes('/api/ai/forza-speech-stream'));
  assert.match(script,/FORZA_SITE_PROGRESSIVE_STREAM_OK/);
});