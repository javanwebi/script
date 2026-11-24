import test from 'node:test';
import assert from 'node:assert/strict';
import {forzaNimaClientConcurrency,normalizeForzaNimaWorkerCount} from '../src/utils/forzaTtsConcurrency';

test('unknown and legacy Nima services remain single-request safe',()=>{
  for(const value of [undefined,null,'',0,-1,NaN,Infinity,'unknown',{},true]){
    assert.equal(normalizeForzaNimaWorkerCount(value),1);
    assert.equal(forzaNimaClientConcurrency(value),1);
  }
  assert.equal(forzaNimaClientConcurrency(1),1);
  assert.equal(forzaNimaClientConcurrency(2),1);
});

test('large private worker pools allow two overlapping Nima phrase syntheses',()=>{
  assert.equal(normalizeForzaNimaWorkerCount(3),3);
  assert.equal(normalizeForzaNimaWorkerCount(4),4);
  assert.equal(normalizeForzaNimaWorkerCount(8),4);
  assert.equal(forzaNimaClientConcurrency(3),2);
  assert.equal(forzaNimaClientConcurrency(4),2);
  assert.equal(forzaNimaClientConcurrency('4'),2);
});
