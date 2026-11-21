import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const server=readFileSync(new URL('../server.ts',import.meta.url),'utf8');
test('Nima proxy forwards progressive stream metadata and flushes first frame without full buffering',()=>{
  const route=server.slice(server.indexOf("app.post('/api/ai/forza-speech-stream'"));
  assert.match(route,/x-forza-queue-ms/);
  assert.match(route,/X-Forza-Queue-Ms/);
  assert.match(route,/X-Forza-Stream-Protocol/);
  assert.match(route,/res\.flushHeaders\?\.\(\)/);
  assert.match(route,/firstChunkMs/);
  assert.match(route,/for await\(const chunk of upstream\.body/);
  assert.doesNotMatch(route,/await upstream\.arrayBuffer\(\)/);
});