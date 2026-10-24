#!/usr/bin/env node
/** Verify all 869 vendored PNGs against the SHA-1 blob hashes of the pinned image repository. */
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=path.join(process.cwd(),'storage','products','catalog');
const source=path.join(process.cwd(),'.image-source-imagesatlas');
const expectedCommit='5bbaec971a05771939663d47803b5d5c2c624c6d';
const sourceCommit=execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(sourceCommit!==expectedCommit)throw new Error('Unexpected source commit');
const tree=execFileSync('git',['-C',source,'ls-tree','-rz','--long','HEAD']).toString('utf8');
const files=tree.split('\0').filter(Boolean).map(line=>{
 const match=/^100644 blob ([a-f0-9]{40})\s+([0-9]+)\t(.+)$/.exec(line);
 if(!match)throw new Error('Invalid original image tree');
 return {name:match[3],gitBlobSha:match[1],size:Number(match[2])};
});
if(files.length!==869)throw new Error('Expected 869 original images');
const manifest={files};
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
