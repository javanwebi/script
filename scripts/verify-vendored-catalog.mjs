#!/usr/bin/env node
/** Verify all 869 vendored PNGs against the SHA-1 blob hashes of the pinned image repository. */
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

const root=path.join(process.cwd(),'storage','products','catalog');
const manifest=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));
if(manifest.sourceRepo!=='javanweb/imagesatlas' ||
   manifest.sourceCommit!=='5bbaec971a05771939663d47803b5d5c2c624c6d' ||
   !Array.isArray(manifest.files) || manifest.files.length!==869)
  throw new Error('Catalog image manifest does not match the pinned original repository');
const present=(await readdir(root)).filter(f=>f.endsWith('.png')).sort();
const expected=manifest.files.map(f=>f.name).sort();
if(JSON.stringify(present)!==JSON.stringify(expected))
  throw new Error('Missing or unexpected catalog PNG files');
let bytes=0;
for(const record of manifest.files){
 if(!/^e\([1-9]\d{0,3}\)\.png$/.test(record.name)||
   !Number.isSafeInteger(record.size)||record.size<=0||
   !/^[a-f0-9]{40}$/.test(record.gitBlobSha))
  throw new Error('Invalid catalog file metadata');
 const buf=await readFile(path.join(root,record.name));
 const gitSha=createHash('sha1').update('blob '+buf.length+'\0').update(buf).digest('hex');
 if(buf.length!==record.size || gitSha!==record.gitBlobSha)
  throw new Error('Catalog image integrity check failed: '+record.name);
 bytes+=buf.length;
}
console.log('Verified',present.length,'pinned images,',bytes,'bytes (SHA-1 Git blobs).');
