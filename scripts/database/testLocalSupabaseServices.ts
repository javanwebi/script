/**
 * Actual local Supabase Auth and Storage API verification (never production).
 * Requires a status.json created by a fresh isolated Supabase CLI stack.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';

async function main(){
 if(process.env.CI_SUPABASE_LOCAL_ONLY!=='true')throw new Error('Refusing non-CI Supabase service test');
 const path=process.env.CI_SUPABASE_STATUS_FILE;
 if(!path)throw new Error('Missing isolated Supabase status file');
 const status=JSON.parse(await readFile(path,'utf8'));
 const url=String(status.API_URL || '');
 const publicKey=String(status.ANON_KEY || status.PUBLISHABLE_KEY || '');
 const adminKey=String(status.SERVICE_ROLE_KEY || '');
 const parsed=new URL(url);
 if(!['127.0.0.1','localhost','::1'].includes(parsed.hostname)||!url.includes(':54321'))
  throw new Error('Refusing non-local Supabase API');
 assert(publicKey && adminKey,'Expected local Supabase keys (not project secrets)');
 const options={auth:{autoRefreshToken:false,persistSession:false}};
 const admin=createClient(url,adminKey,options);
 const accountEmail='ci-owner-'+Date.now()+'@example.test';
 const unrelatedEmail='ci-other-'+Date.now()+'@example.test';
 const password='Ci-only-very-long-passphrase-2026!';
 const userA=(await admin.auth.admin.createUser({email:accountEmail,password,email_confirm:true})).data.user;
 const userB=(await admin.auth.admin.createUser({email:unrelatedEmail,password,email_confirm:true})).data.user;
 assert(userA?.id&&userB?.id,'Failed to create verified users via real local GoTrue');
 const owner=createClient(url,publicKey,options);
 const other=createClient(url,publicKey,options);
 const ownAuth=await owner.auth.signInWithPassword({email:accountEmail,password});
 const otherAuth=await other.auth.signInWithPassword({email:unrelatedEmail,password});
 assert(!ownAuth.error&&ownAuth.data.session,'Real Auth sign-in/session failed');
 assert(!otherAuth.error&&otherAuth.data.session,'Other Auth sign-in failed');
 const returned=await owner.auth.getUser();
 assert.equal(returned.data.user?.id,userA.id);
 const profile=await admin.from('user_profiles').select('id,role').eq('id',userA.id).single();
 assert(!profile.error,'Auth-to-user_profiles trigger failed: '+profile.error?.message);
 assert.equal(profile.data.role,'client');
 console.log('PASS: real GoTrue user creation, email verification, sign-in and profile trigger');

 // Real API/Storage policy checks with a private bucket and two separate JWTs.
 const privateBucket='customer-documents';
 const fileKey=userA.id+'/ci-owned.png';
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
 const deniedAnonymous=await createClient(url,publicKey,options).storage.from(privateBucket).upload(fileKey,png,{contentType:'image/png'});
 assert(deniedAnonymous.error,'Anonymous private document write unexpectedly succeeded');
 const saved=await owner.storage.from(privateBucket).upload(fileKey,png,{contentType:'image/png',upsert:false});
 assert(!saved.error,'Authenticated private upload failed: '+saved.error?.message);
 const download=await owner.storage.from(privateBucket).download(fileKey);
 assert(!download.error&&download.data,'Owner cannot read own private document');
 const outsiderDownload=await other.storage.from(privateBucket).download(fileKey);
 assert(outsiderDownload.error,'Other user can read private file');
 console.log('PASS: real Storage upload, private owner read and cross-user denial');

 const unauthorized=await owner.from('catalog_families').insert({code:'CI-UNAUTHORIZED',name:'Should fail',category_slug:'ci',category_name:'CI'});
 assert(unauthorized.error,'Retail identity can write protected catalog');
 const visible=await owner.from('orders').select('id').limit(1);
 assert(!visible.error,'Authenticated order SELECT failed: '+visible.error?.message);
 console.log('PASS: JWT-backed RLS denies catalog mutation and permits scoped order query');

 await owner.auth.signOut();
 const absent=await owner.auth.getUser();
 assert(absent.error||!absent.data.user,'Session sign-out did not clear client identity');
 console.log(JSON.stringify({success:true,scope:{auth:'real local GoTrue',storage:'real local Storage API',rls:'real JWT scoped API',production:'untouched'}},null,2));
}
main().catch(error=>{console.error('Local Supabase API test failed:',error instanceof Error?error.stack:error);process.exitCode=1;});
