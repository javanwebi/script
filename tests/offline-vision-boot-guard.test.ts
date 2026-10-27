import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('offline production startup never launches legacy hosted image builders',()=>{
  const code=fs.readFileSync(path.resolve('server.ts'),'utf8');
  const start=code.indexOf('async function start() {');
  assert.ok(start>0,'server startup function exists');
  const end=code.indexOf('\nstart().catch(',start);
  assert.ok(end>start);
  const body=code.slice(start,end);
  assert.match(body,/if\s*\(OFFLINE_VISION_MODE\)\s*\{\s*recognitionJobs\.resumePending\(\)/);
  assert.match(body,/\}\s*else\s*\{\s*void buildImageFeatureIndex\(\);\s*void buildImageEmbeddingIndex\(\);/);
  assert.doesNotMatch(body,/\n\s*void buildImageEmbeddingIndex\(\);\s*\n\s*\n\s*if\s*\(process\.env\.NODE_ENV/);
  assert.ok(code.includes("if(OFFLINE_VISION_MODE){\n   const corpus=buildCatalogImageCorpus("));
});
