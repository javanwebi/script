import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {durableStorage, databaseStorageEnabled} from '../src/services/durableStorage';
import {readAdoptedDocument} from '../server/db/adopted';

const KEY='atlas_clients_logos_v3_moshtari';

test('non-hydrated customer logo read is missing, without creating persistent data',()=>{
 assert.equal(databaseStorageEnabled(),false);
 assert.equal(durableStorage.getExistingItem(KEY),null);
 assert.equal(durableStorage.getItem(KEY),null);
 assert.throws(()=>durableStorage.setItem(KEY,'[]'),/پایگاه داده هنوز آماده نیست/);
 assert.equal(durableStorage.getExistingItem(KEY),null);
});

test('client logo getter never writes defaults during initial render',()=>{
 const source=readFileSync('src/services/clientService.ts','utf8');
 const getter=source.split('private getStorage(): ClientLogo[] {')[1]?.split('private saveStorage')[0];
 assert.ok(getter,'could not locate client getter');
 assert.match(getter,/getExistingItem\(STORAGE_KEY\)/);
 assert.doesNotMatch(getter,/saveStorage\(/);
 assert.match(getter,/Array\.isArray\(parsed\)/,'saved empty list stays empty');
});

test('PostgreSQL client logos expose the admin isActive and order properties',async()=>{
 const rows=[{id:'client-1',name:'Factory One',logo_url:'/assets/logo-1.webp',
   industry:'کاشی و سرامیک',active:true,sort_order:2,created_at:'2026-01-01T00:00:00Z'}];
 const db={
   query:async(sql:string)=>{
     if(sql.includes('select * from public.client_logos'))return {rows};
     if(sql.includes('select value from public.portal_kv_store'))return {rows:[]};
     throw Error('Unexpected query: '+sql);
   },
 } as unknown as Parameters<typeof readAdoptedDocument>[0];
 const saved=await readAdoptedDocument(db,'atlas_clients_logos_v3_moshtari','global') as Array<Record<string,unknown>>;
 assert.equal(saved.length,1);
 assert.equal(saved[0].logo,'/assets/logo-1.webp');
 assert.equal(saved[0].isActive,true);
 assert.equal(saved[0].order,2);
});

test('customer logos survive empty database hydration without browser-side seeding',()=>{
 const service=readFileSync('src/services/clientService.ts','utf8');
 assert.match(service,/parsed\.length === 0\) return DEFAULT_CLIENTS/);
 assert.match(service,/sanat-durable-hydrated/);
 const page=readFileSync('src/components/home/OurClientsSection.tsx','utf8');
 assert.match(page,/setInterval\(/,'carousel rotates automatically');
 assert.match(page,/3200/,'carousel uses a gentle 3.2-second interval');
 assert.match(page,/clients\.slice\(0, itemsPerView\)/,'carousel wraps using only the first visible logos');
 assert.match(page,/visibleClients\.map/,'all active client logos are included in order');
 assert.match(page,/prefers-reduced-motion/);
 assert.match(page,/max-h-\[70px\]/,'desktop logos stay compact');
 assert.doesNotMatch(page,/if \(clients\.length === 0\) return null/);
 const admin=readFileSync('src/admin/AdminLayout.tsx','utf8');
 assert.match(admin,/ClientsAdminModule/);
 assert.match(admin,/admin\/clients/);
});

test('client logo database projection does not truncate a large uploaded list',async()=>{
 const rows=Array.from({length:45},(_,i)=>({
   id:'customer-'+i,name:'Customer '+i,logo_url:'/logos/'+i+'.webp',
   active:i!==8,sort_order:i+1,created_at:'2026-01-01T00:00:00Z',
 }));
 const db={
  query:async(sql:string)=>{
   if(sql.includes('select * from public.client_logos'))return {rows};
   if(sql.includes('select value from public.portal_kv_store'))return {rows:[]};
   throw Error('Unexpected query: '+sql);
  },
 } as unknown as Parameters<typeof readAdoptedDocument>[0];
 const saved=await readAdoptedDocument(db,'atlas_clients_logos_v3_moshtari','global') as Array<Record<string,unknown>>;
 assert.equal(saved.length,45);
 assert.equal(saved[8].isActive,false);
 assert.equal(saved[44].logo,'/logos/44.webp');
 assert.equal(saved[44].order,45);
});
