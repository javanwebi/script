import test from 'node:test';
import assert from 'node:assert/strict';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {AUTH_REFRESH_COOKIE_PATH,buildRefreshCookie,supabaseAuthAction} from '../../server/db/supabaseAuth';

test('refresh cookie covers portal and sibling admin API routes with secure cookie attributes',()=>{
 assert.equal(AUTH_REFRESH_COOKIE_PATH,'/api');
 const cookie=buildRefreshCookie('test-refresh-token',2592000,true);
 assert.match(cookie,/^sp_refresh=test-refresh-token; Path=\\/api;/);
 assert.match(cookie,/HttpOnly; SameSite=Lax; Max-Age=2592000; Secure$/);
 const cleared=buildRefreshCookie('',0,true);
 assert.match(cleared,/Max-Age=0; Secure$/);
});

test('registration fails closed without SMS; credentials require a verified server session; malformed OTP is rejected',async()=>{
 const names=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SMS_READY'];
 const previous=Object.fromEntries(names.map(n=>[n,process.env[n]]));
 try {
  process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='test-publishable';process.env.SUPABASE_SMS_READY='false';
  for(const [body,status,pattern] of [
   [{action:'register',payload:{mobile:'09120000001',password:'must-never-be-stored'}},503,/پیامک/],
   [{action:'registration_credentials',username:'attacker',password:'not-authorized'},401,/تأیید/],
   [{action:'otp_verify',phone:'09120000001',code:'123'},400,/شش/],
  ] as const){
   let result:any;
   const req={headers:{}} as IncomingMessage;
   const res={statusCode:200,setHeader(){},end(value:string){result=JSON.parse(value);}} as unknown as ServerResponse;
   assert.equal(await supabaseAuthAction(req,res,body,v=>v),true);
   assert.equal(res.statusCode,status);assert.equal(result.success,false);assert.match(result.message,pattern);
   assert.equal(result.user,undefined);
  }
 } finally {for(const name of names)if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];}
});
