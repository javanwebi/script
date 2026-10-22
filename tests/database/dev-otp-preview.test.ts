import test from 'node:test';
import assert from 'node:assert/strict';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {developmentOtpEnabled,handleDevelopmentOtp} from '../../server/db/devOtpPreview';

const dev={NODE_ENV:'development',DATABASE_ENV:'development',DEV_OTP_PREVIEW:'true'} as NodeJS.ProcessEnv;
function invoke(body:any,env:NodeJS.ProcessEnv=dev,host='localhost:5173') {
 let status=200,headers:Record<string,string>={},payload:any;
 const req={headers:{host}} as IncomingMessage;
 const res={set statusCode(v:number){status=v;},get statusCode(){return status;},setHeader(key:string,value:string){headers[key]=value;},end(value:string){payload=JSON.parse(value);}} as unknown as ServerResponse;
 const handled=handleDevelopmentOtp(req,res,body,env);
 return {handled,status,payload,headers};
}
test('preview is impossible with production NODE_ENV, DATABASE_ENV or non-loopback host',()=>{
 for(const env of [{...dev,NODE_ENV:'production'},{...dev,DATABASE_ENV:'production'},{...dev,DEV_OTP_PREVIEW:'false'}]){
  assert.equal(developmentOtpEnabled(env,'localhost:5173'),false);
  const r=invoke({action:'dev_otp_request',phone:'09123456789'},env);
  assert.equal(r.status,404); assert.equal(r.payload.devCode,undefined);
 }
 assert.equal(invoke({action:'dev_otp_request',phone:'09123456789'},dev,'sanatpish.com').status,404);
});
test('development preview sends code to loopback, consumes one-time token and never creates a session',()=>{
 const request=invoke({action:'dev_otp_request',phone:'09123456789'});
 assert.equal(request.status,200);
 assert.match(request.payload.devCode,/^\d{6}$/);
 assert.equal(request.payload.preview,true);
 assert.equal(request.payload.user,undefined);
 assert.equal(request.headers['Cache-Control'],'no-store');
 assert.equal(invoke({action:'dev_otp_verify',phone:'09123456789',requestId:request.payload.requestId,code:'000000'}).status,401);
 const verified=invoke({action:'dev_otp_verify',phone:'09123456789',requestId:request.payload.requestId,code:request.payload.devCode});
 assert.equal(verified.status,200);
 assert.equal(verified.payload.previewVerified,true);
 assert.equal(verified.payload.session,undefined);
 assert.equal(invoke({action:'dev_otp_verify',phone:'09123456789',requestId:request.payload.requestId,code:request.payload.devCode}).status,401);
});
