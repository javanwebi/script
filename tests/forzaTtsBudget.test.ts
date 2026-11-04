import test from 'node:test';
import assert from 'node:assert/strict';
import {ForzaTtsBudget} from '../server/ai/forzaTtsBudget';

test('one customer turn is limited without exhausting other turns behind same NAT',()=>{
 const limiter=new ForzaTtsBudget(60,12,60_000);
 for(let n=0;n<12;n++)assert.equal(limiter.consume('198.51.100.7','call-a-turn-1',1000).ok,true);
 assert.deepEqual(limiter.consume('198.51.100.7','call-a-turn-1',1000),{
   ok:false,reason:'turn',retryAfterSeconds:60
 });
 assert.equal(limiter.consume('198.51.100.7','call-b-turn-1',1000).ok,true);
 assert.equal(limiter.consume('203.0.113.2','call-a-turn-1',1000).ok,true);
});

test('random turn ids cannot bypass the aggregate network ceiling',()=>{
 const limiter=new ForzaTtsBudget(3,2,60000);
 for(let n=0;n<3;n++)assert.equal(limiter.consume('192.0.2.9','new-turn-'+n,0).ok,true);
 assert.deepEqual(limiter.consume('192.0.2.9','fresh-turn',0),{
   ok:false,reason:'address',retryAfterSeconds:60
 });
 assert.equal(limiter.consume('192.0.2.9','fresh-turn',60000).ok,true);
});

test('rate key removes untrusted characters and avoids keeping plaintext',()=>{
 const limiter=new ForzaTtsBudget(3,1,60000);
 assert.equal(limiter.consume('client','call turn\nunsafe',0).ok,true);
 const rejection=limiter.consume('client','callturnunsafe',0);
 assert.equal(rejection.ok,false);
});
