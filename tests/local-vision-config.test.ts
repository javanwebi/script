import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {loadLocalVisionConfig} from '../server/localVisionConfig';
test('bind-mounted activation loads only local vision settings and preserves database, port and other providers',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'vision-config-'));
 try{
  const env={DATABASE_URL:'private-db',PORT:'3013',VOICE_PROVIDER:'current',PART_RECOGNITION_MODE:'read-only-agent',LOCAL_VISION_ENCODER:'mobileclip2-s0',LOCAL_VISION_MIN_SIMILARITY:'0.55'} as Record<string,string>;
  await fs.writeFile(path.join(root,'.env.local-vision'),'PART_RECOGNITION_MODE=local-embedding\nLOCAL_VISION_URL=http://encoder:8091\nLOCAL_VISION_TOKEN='+ 'a'.repeat(32)+'\nDATABASE_URL=wrong\nPORT=3008\nVOICE_PROVIDER=wrong\n');
  assert.equal(loadLocalVisionConfig(root,env),false);assert.equal(env.PART_RECOGNITION_MODE,'read-only-agent');
  await fs.writeFile(path.join(root,'.local-vision-enabled'),'');
  assert.equal(loadLocalVisionConfig(root,env),true);assert.equal(env.PART_RECOGNITION_MODE,'local-embedding');
  assert.equal(env.LOCAL_VISION_ENCODER,'dinov2-small');assert.equal(env.LOCAL_VISION_MIN_SIMILARITY,'0.65');
  assert.equal(env.DATABASE_URL,'private-db');assert.equal(env.PORT,'3013');assert.equal(env.VOICE_PROVIDER,'current');
  await fs.unlink(path.join(root,'.env.local-vision'));assert.throws(()=>loadLocalVisionConfig(root,env),/missing/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
