/**
 * Express /api/runtime -> PostgreSQL integration, no mocked DB responses.
 * Only runs against a disposable localhost/sanatpish_ci database.
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import express from 'express';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {runtimeApi} from '../../server/db/runtimeApi';
import {closeDatabase} from '../../server/db/connection';

async function main(){
 const raw=process.env.INTEGRATION_TEST_DATABASE_URL;
 if(process.env.CI_POSTGRES_ISOLATED!=='true'||!raw)throw new Error('Expected disposable CI PostgreSQL');
 const target=new URL(raw);
 if(!['127.0.0.1','localhost','::1'].includes(target.hostname)||target.pathname!=='/sanatpish_ci')
  throw new Error('Unsafe DB target');
 process.env.DATABASE_URL=raw;
 process.env.DATABASE_ENV='test';
 process.env.DATA_BACKEND='postgres';
 process.env.DATABASE_SCHEMA='adopted';
 process.env.DATABASE_SSL='disable';
 process.env.NODE_ENV='test';
 const app=express();
 app.use(express.json({limit:'4mb'}));
 app.all('/api/runtime',(req,res)=>{void runtimeApi(req,res);});
 const server=createServer(app);
 server.listen(0,'127.0.0.1');
 await once(server,'listening');
 const addr=server.address();
 if(!addr||typeof addr==='string')throw new Error('Expected local ephemeral listener');
 const base='http://127.0.0.1:'+addr.port;
 try{
  const initial=await fetch(base+'/api/runtime');
  assert.equal(initial.status,200);
  const first=await initial.json() as any;
  assert.equal(first.success,true);
  assert.equal(first.database,true);
  assert.equal(first.admin,false);
  const cookie=(initial.headers.get('set-cookie')||'').split(';')[0];
  assert.match(cookie,/^sp_guest=[a-f0-9]{64}$/);
  const headers={'content-type':'application/json','cookie':cookie};
  const cart=[{code:'CI-SKU-01',quantity:2}];
  const saved=await fetch(base+'/api/runtime',{method:'POST',headers,body:JSON.stringify({key:'hyper_sanat_cart_v2',value:cart,version:0})});
  assert.equal(saved.status,200,await saved.text().catch(()=>'<error response unavailable>'));
  const afterSave=await fetch(base+'/api/runtime',{headers:{cookie}});
  const loaded=await afterSave.json() as any;
  assert.deepEqual(loaded.values.hyper_sanat_cart_v2,cart);
  const updated=await fetch(base+'/api/runtime',{method:'POST',headers,body:JSON.stringify({key:'hyper_sanat_cart_v2',value:[{code:'CI-SKU-01',quantity:3}],version:1})});
  assert.equal(updated.status,200);
  const afterUpdate=await fetch(base+'/api/runtime',{headers:{cookie}});
  assert.equal((await afterUpdate.json() as any).values.hyper_sanat_cart_v2[0].quantity,3);
  const other=await fetch(base+'/api/runtime');
  assert.equal((await other.json() as any).values.hyper_sanat_cart_v2,undefined,'Guest data must remain isolated');
  const wrongVersion=await fetch(base+'/api/runtime',{method:'POST',headers,body:JSON.stringify({key:'hyper_sanat_cart_v2',value:[],version:0})});
  assert.equal(wrongVersion.status,409,'Stale writes must be rejected');
  const forbidden=await fetch(base+'/api/runtime',{method:'POST',headers,body:JSON.stringify({key:'atlas_admin_customers_v1',value:[],version:0})});
  assert.equal(forbidden.status,403);
  const foreignOrigin=await fetch(base+'/api/runtime',{method:'POST',headers:{...headers,origin:'https://attacker.invalid'},body:JSON.stringify({key:'hyper_sanat_cart_v2',value:[],version:2})});
  assert.equal(foreignOrigin.status,403);
  console.log(JSON.stringify({scope:'Express HTTP /api/runtime -> Postgres',tests:['GET','POST create','refresh read','POST update','guest isolation','CAS conflict','admin denied','cross-origin denied'],passed:true},null,2));
 }finally{
  server.close();
  await once(server,'close');
  await closeDatabase();
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
