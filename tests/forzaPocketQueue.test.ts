import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('Pocket bounds queued work, deduplicates phrases and validates worker limits', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'forza-pocket-'));
  const binary = join(dir, 'worker');
  await writeFile(binary, `#!/usr/bin/env node
const readline=require('node:readline');
console.log(JSON.stringify({type:'ready'}));
readline.createInterface({input:process.stdin}).on('line',line=>{
 const {id}=JSON.parse(line);const wav=Buffer.alloc(48);
 wav.write('RIFF');wav.write('WAVE',8);
 setTimeout(()=>console.log(JSON.stringify({id,audio:wav.toString('base64')})),50);
});
`, {mode:0o700});
  process.env.FORZA_POCKET_PYTHON = binary;
  try {
    const { synthesizeServerPocket } = await import('../src/services/forzaPocketServerSpeech');
    await assert.rejects(synthesizeServerPocket('x'.repeat(221)), /invalid_text/);
    const first = synthesizeServerPocket('سلام');
    assert.strictEqual(synthesizeServerPocket('سلام'), first);
    const jobs = [first, ...['یک','دو','سه'].map(synthesizeServerPocket)];
    await assert.rejects(synthesizeServerPocket('چهار'), /worker_busy/);
    const results = await Promise.all(jobs);
    assert.equal(results.length, 4);
    assert.strictEqual(await synthesizeServerPocket('سلام'), results[0]);
    assert.equal((await synthesizeServerPocket('پنج')).toString('ascii',0,4), 'RIFF');
  } finally {
    delete process.env.FORZA_POCKET_PYTHON;
    await rm(dir, { recursive:true, force:true });
  }
});
