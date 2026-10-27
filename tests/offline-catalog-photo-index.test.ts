import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import {OfflineCatalogPhotoIndex,describeOfflineImage} from '../src/services/offlineCatalogPhotoIndex';
import type {CatalogImageRecord} from '../src/services/catalogImageCorpus';

const square=(color:string)=>sharp({create:{width:128,height:128,channels:3,background:'white'}})
  .composite([{input:Buffer.from('<svg width="128" height="128"><rect x="25" y="25" width="75" height="75" fill="'+color+'"/></svg>')}]).png().toBuffer();
const circle=()=>sharp({create:{width:128,height:128,channels:3,background:'white'}})
  .composite([{input:Buffer.from('<svg width="128" height="128"><circle cx="64" cy="64" r="42" fill="black"/></svg>')}]).png().toBuffer();
const row=(id:string,revision='1',bindings:CatalogImageRecord['bindings']=[]):CatalogImageRecord=>
  ({id,url:'/storage/products/catalog/'+id+'.png',label:id,revision,bindings});

test('offline index is deterministic, returns the original photo and never requires a network API',async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'offline-index-'));
 try{
  const a=await square('black'),b=await circle(),c=await square('gray');
  const images=[row('square'),row('circle'),row('gray')];
  const sources=new Map([['square',a],['circle',b],['gray',c]]);
  const index=new OfflineCatalogPhotoIndex(path.join(folder,'index.json'));
  let firstReads=0;
  const first=await index.search(a,images,async image=>{firstReads++;return sources.get(image.id)!;},{limit:3});
  assert.equal(first.coverage.total,3);
  assert.equal(first.coverage.complete,true);
  assert.equal(first.coverage.compared,3);
  assert.equal(first.hits[0].image.id,'square');
  assert.equal(first.hits[0].identicalPhotograph,true);
  assert.equal(first.hits[0].score>=first.hits[1].score,true);
  assert.ok(firstReads>=3);
  const subsequent=await new OfflineCatalogPhotoIndex(path.join(folder,'index.json')).search(b,images,
    async image=>sources.get(image.id)!,{limit:3});
  assert.equal(subsequent.hits[0].image.id,'circle');
  assert.equal(subsequent.hits[0].identicalPhotograph,true);
  assert.equal(subsequent.coverage.complete,true);
  assert.ok((await describeOfflineImage(a)).luminance.length===144);
 }finally{await fs.rm(folder,{recursive:true,force:true});}
});

test('unreadable images are tracked; an incomplete index never claims full coverage',async()=>{
 const image=await square('black');
 const catalog=[row('valid'),row('missing')];
 const index=new OfflineCatalogPhotoIndex();
 const progress:any[]=[];
 const result=await index.search(image,catalog,async item=>item.id==='valid'?image:null,
   {limit:3,progress:value=>progress.push(value)});
 assert.equal(result.coverage.compared,1);
 assert.equal(result.coverage.failed,1);
 assert.equal(result.coverage.complete,false);
 assert.deepEqual(result.coverage.failedImageIds,['missing']);
 assert.equal(result.hits.length,1);
 assert.equal(result.hits[0].identicalPhotograph,true);
 assert.equal(progress.at(-1).stage,'complete');
});

test('new catalogue photographs and changed revisions are indexed instead of returning stale results',async()=>{
 const dark=await square('black'),round=await circle();
 const index=new OfflineCatalogPhotoIndex();
 let indexed=0;
 const read=async(item:CatalogImageRecord)=>{indexed++;return item.id==='x'&&item.revision==='1'?dark:round;};
 await index.search(dark,[row('x')],read);
 const first= indexed;
 await index.search(dark,[row('x')],read);
 assert.equal(indexed-first,1); // only the strict final candidate comparison, not an index rebuild
 await index.search(round,[row('x','2'),row('y')],read);
 assert.ok(indexed>first+2);
});

test('an empty catalogue returns no guessed part code or image',async()=>{
 const image=await circle();
 const result=await new OfflineCatalogPhotoIndex().search(image,[],async()=>null);
 assert.equal(result.hits.length,0);
 assert.equal(result.coverage.complete,true);
});
