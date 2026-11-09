import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalVisionDetectionCache} from '../src/services/localVisionDetectionCache';

const query={model:'dinov2-test',vectors:[[0.1,0.2]],region:null,viewRegions:[null,{x:0.2,y:0.2,width:0.3,height:0.3}],markings:[],ocrAvailable:false};
const region={x:0.2,y:0.2,width:0.3,height:0.3};

test('detection cache reuses only the exact uploaded image and model',()=>{
 const cache=new LocalVisionDetectionCache(1000,4);
 cache.set('id',{imageHash:'sha-a',model:'dinov2-test',query,queryRegions:[region],selectedRegion:region},10);
 assert.equal(cache.get('id','sha-a','dinov2-test',20)?.selectedRegion,region);
 assert.equal(cache.get('id','sha-b','dinov2-test',20),undefined);
 assert.equal(cache.get('id','sha-a','another-model',20),undefined);
});

test('detection cache stores only an opaque content hash, never a customer image URL or bytes',()=>{
 const cache=new LocalVisionDetectionCache(1000,4);
 cache.set('id',{imageHash:'sha-private',model:'dinov2-test',query,queryRegions:[region]},10);
 const entry=cache.get('id','sha-private','dinov2-test',20);
 assert.equal(entry?.imageHash,'sha-private');
 assert.equal('imageUrl' in (entry || {}),false);
 assert.equal('imageBase64' in (entry || {}),false);
});

test('detection cache expires stale entries and removes them',()=>{
 const cache=new LocalVisionDetectionCache(100,4);
 cache.set('id',{imageHash:'sha-a',model:'dinov2-test',query,queryRegions:[region]},10);
 assert.equal(cache.get('id','sha-a','dinov2-test',111),undefined);
 assert.equal(cache.get('id','sha-a','dinov2-test',112),undefined);
});

test('detection cache remains bounded and evicts the oldest entry',()=>{
 const cache=new LocalVisionDetectionCache(1000,2);
 cache.set('one',{imageHash:'sha-one',model:'m',query,queryRegions:[]},1);
 cache.set('two',{imageHash:'sha-two',model:'m',query,queryRegions:[]},2);
 cache.set('three',{imageHash:'sha-three',model:'m',query,queryRegions:[]},3);
 assert.equal(cache.get('one','sha-one','m',4),undefined);
 assert.ok(cache.get('two','sha-two','m',4));
 assert.ok(cache.get('three','sha-three','m',4));
});
