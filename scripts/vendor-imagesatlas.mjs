#!/usr/bin/env node
/** Copy pinned official imagesatlas blobs into script source without guessing SKU assignments. */
import {execFileSync} from 'node:child_process';
import {copyFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const repo='javanweb/imagesatlas';
const commit='5bbaec971a05771939663d47803b5d5c2c624c6d';
const source=path.resolve(process.cwd(),'.image-source-imagesatlas');
const target=path.resolve(process.cwd(),'storage','products','catalog');
const head=execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(head!==commit)throw new Error('Unexpected source revision: '+head);
const tree=execFileSync('git',['-C',source,'ls-tree','-rz','--long','HEAD']).toString('utf8');
const files=tree.split('\0').filter(Boolean).map(line=>{
 const match=/^100644 blob ([a-f0-9]{40}) ([0-9]+)\t(.+)$/.exec(line);
 if(!match || !/^e\([1-9]\d{0,3}\)\.png$/.test(match[3]))
  throw new Error('Unexpected catalog repository object');
 return {name:match[3],gitBlobSha:match[1],size:Number(match[2])};
});
if(files.length!==869 || new Set(files.map(x=>x.name)).size!==869)
 throw new Error('Expected 869 unique original PNG files');
for(let number=1;number<=869;number++)
 if(!files.some(x=>x.name===`e(${number}).png`))throw new Error('Missing e('+number+').png');
await mkdir(target,{recursive:true});
for(const file of files)await copyFile(path.join(source,file.name),path.join(target,file.name));
await writeFile(path.join(target,'manifest.json'),
 JSON.stringify({sourceRepo:repo,sourceCommit:commit,files},null,2)+'\n','utf8');
console.log('Vendored',files.length,'PNG images from',repo+'@'+commit,'into',target);
