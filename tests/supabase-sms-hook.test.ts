import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
import {verifySmsHookSignature} from '../server/auth/supabaseSmsHook';

test('Supabase signed payload must be authentic and fresh',()=>{
  const key=randomBytes(32);
  const secret='v1,whsec_'+key.toString('base64');
  const timestamp=String(Math.floor(Date.now()/1000));
  const id='msg_test';
  const body=Buffer.from('{"test":true}');
  const signature='v1,'+createHmac('sha256',key).update(id+'.'+timestamp+'.').update(body).digest('base64');
  const headers={id,timestamp,signature};
  assert.equal(verifySmsHookSignature(body,headers,secret),true);
  assert.equal(verifySmsHookSignature(Buffer.from('{}'),headers,secret),false);
  assert.equal(verifySmsHookSignature(body,{...headers,id:'other'},secret),false);
  assert.equal(verifySmsHookSignature(body,{...headers,timestamp:String(Number(timestamp)-500)},secret),false);
  assert.equal(verifySmsHookSignature(body,headers,''),false);
});
