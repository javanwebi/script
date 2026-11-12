import test from 'node:test';
import assert from 'node:assert/strict';
import {tapImageRegion,findImageRegionAtPoint} from '../src/utils/imageRegionInteraction';
import {validImageRegion} from '../src/utils/imageRegion';
test('tap selects the clicked part in portrait/landscape images and stays inside image edges',()=>{
 for(const aspect of [0.2,0.5,1,1408/768,5])for(const point of [{x:0,y:0},{x:1,y:1},{x:0.5,y:0.5},{x:0.51,y:0.49}]){
  const r=tapImageRegion(point,aspect);assert.ok(validImageRegion(r));
  assert.ok(point.x>=r.x-1e-9&&point.x<=r.x+r.width+1e-9);
  assert.ok(point.y>=r.y-1e-9&&point.y<=r.y+r.height+1e-9);
  assert.ok(Math.abs(r.width*aspect-r.height)<1e-8);
 }
});

test('tap selects a detected object box, but a tap on background keeps the current system selection',()=>{
 const left={x:0.1,y:0.2,width:0.25,height:0.4};
 const right={x:0.62,y:0.2,width:0.25,height:0.4};
 assert.deepEqual(findImageRegionAtPoint({x:0.72,y:0.4},[left,right]),right);
 assert.equal(findImageRegionAtPoint({x:0.48,y:0.8},[left,right]),undefined);
});
