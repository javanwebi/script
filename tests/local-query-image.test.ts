import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {prepareLocalQuery,validImageRegion} from '../src/services/localQueryImage';
test('manual regions are bounded and crop the actual oriented image before encoding',async()=>{
 const bytes=await sharp({create:{width:200,height:100,channels:3,background:'red'}}).png().toBuffer();
 const cropped=await prepareLocalQuery(bytes,{x:0.25,y:0,width:0.5,height:1});
 const meta=await sharp(cropped).metadata();assert.equal(meta.width,100);assert.equal(meta.height,100);
 for(const region of [{x:-0.1,y:0,width:0.5,height:0.5},{x:0.8,y:0,width:0.5,height:0.5},{x:0,y:0,width:NaN,height:1},{x:0,y:0,width:0,height:1}]){
  assert.equal(validImageRegion(region),false);await assert.rejects(()=>prepareLocalQuery(bytes,region));
 }
});
