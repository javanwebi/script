import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {readDocument,writeDocument,saveProducts,persistUsers} from '../../server/db/repository';
import type {SqlClient} from '../../server/db/connection';
async function setup(){const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`);for(const file of (await readdir('supabase/migrations')).sort())if(file.endsWith('.sql'))await db.exec(await readFile('supabase/migrations/'+file,'utf8'));return db;}
test('Postgres migration creates relational catalogue, privacy policies, lossless documents and CAS revisions',async()=>{const db=await setup();const sql=db as unknown as SqlClient;try{
 const products=[{code:'family-1',name:'Industrial seal',categorySlug:'seals',variants:[{code:'sku-1',name:'Seal 20',technicalSpecs:[{key:'قطر داخلی',value:'20'}],prices:{retail:10},stock:3,stockKnown:true}],images:['https://example.org/seal.png']}];
 await saveProducts(sql,products);await saveProducts(sql,products);
 assert.equal((await db.query('select * from public.product_variants')).rows.length,1);
 await writeDocument(sql,'atlas_admin_orders_v1',[{id:'order-1',customerId:'legacy-unknown',extra:{must:'survive'}}]);
 assert.deepEqual(await readDocument(sql,'atlas_admin_orders_v1'),[{id:'order-1',customerId:'legacy-unknown',extra:{must:'survive'}}]);
 await writeDocument(sql,'atlas_admin_orders_v1',[]);assert.deepEqual(await readDocument(sql,'atlas_admin_orders_v1'),[]);
 assert.equal((await db.query('select * from public.orders')).rows.length,1,'soft removal preserves prior record');
 assert.equal((await db.query('select * from app_private.source_archives')).rows.length,2);
 const first=await db.query('update app_private.portal_version set revision=revision+1 where revision=0 returning revision');const stale=await db.query('update app_private.portal_version set revision=revision+1 where revision=0 returning revision');assert.equal(first.rows.length,1);assert.equal(stale.rows.length,0);
 await db.exec('set role anon');assert.equal((await db.query('select code,name from public.product_families')).rows.length,1);
 await assert.rejects(db.query('select payload from public.product_families'));
 await assert.rejects(db.query('select * from public.sku_prices'));
 await assert.rejects(db.query('select * from app_private.portal_users'));
 await assert.rejects(db.query("update public.product_families set name='forged'"));await db.exec('reset role');
 }finally{await db.close();}});
test('RLS isolates customer identities and never exposes credential payloads',async()=>{const db=await setup();try{
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 await db.query('insert into auth.users values($1),($2)',[a,b]);
 await persistUsers(db as unknown as SqlClient,[{id:'a',authUserId:a,fullName:'A',phone:'09120000001',passwordHash:'secret-A'},{id:'b',authUserId:b,fullName:'B',phone:'09120000002',passwordHash:'secret-B'}]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);await db.exec('set role authenticated');
 assert.deepEqual((await db.query('select id from public.profiles')).rows,[{id:'a'}]);
 await assert.rejects(db.query('select payload from public.profiles'));await assert.rejects(db.query("update public.profiles set role='admin' where id='a'"));
 }finally{await db.close();}});
