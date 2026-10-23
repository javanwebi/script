import {createHash} from 'node:crypto';
import {database,transaction,adoptedSchema,type SqlClient} from './connection';
import {adoptedNamespaces,readAdoptedDocument,writeAdoptedDocument,adoptedUsers,persistAdoptedUsers,readAdoptedProducts,saveAdoptedProducts} from './adopted';
import {domainTables,domainFor,type Domain} from './namespaces';
type Row=Record<string,any>;
export interface PortalDatabase {revision:number;users:Row[];values:Record<string,any>;otp?:Record<string,any>;}
export const conflict=()=>Object.assign(new Error('اطلاعات هم‌زمان تغییر کرده است؛ دوباره بارگذاری کنید.'),{status:409});
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function readDocument(client:SqlClient,key:string,scope='global',domain?:Domain){
 if(adoptedSchema())return readAdoptedDocument(client,key,scope);
 const table=domainTables[domain || domainFor(key)!];if(!table)throw new Error('Unknown data namespace');
 const meta=(await client.query('select value_kind,version from app_private.document_versions where namespace=$1 and scope_id=$2',[key,scope])).rows[0];if(!meta)return undefined;
 const rows=(await client.query(`select payload from public.${table} where namespace=$1 and scope_id=$2 and active order by position`,[key,scope])).rows;
 return meta.value_kind==='array' ? rows.map(row=>row.payload) : rows[0]?.payload ?? null;
}
export async function writeDocument(client:SqlClient,key:string,value:unknown,scope='global',ownerId?:string,domain?:Domain){
 if(adoptedSchema())return writeAdoptedDocument(client,key,value,scope);
 const table=domainTables[domain || domainFor(key)!];if(!table)throw new Error('Unknown data namespace');
 await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[scope+':'+key]);
 const kind=Array.isArray(value)?'array':value && typeof value==='object'?'object':'scalar';
 const digest=hash(value);
 const old=(await client.query('select content_sha256 from app_private.document_versions where namespace=$1 and scope_id=$2 for update',[key,scope])).rows[0];if(old?.content_sha256===digest)return;
 await client.query('insert into app_private.source_archives(source_path,sha256,payload) values($1,$2,$3) on conflict do nothing',[`history/${scope}/${key}`,digest,JSON.stringify(value)]);
 await client.query(`update public.${table} set active=false where namespace=$1 and scope_id=$2`,[key,scope]);
 const rows=kind==='array'?value as any[]:[value];
 const ids=new Set<string>();
 for(let i=0;i<rows.length;i++){
  const row=rows[i];let id=String(row?.id ?? row?.code ?? i);if(ids.has(id))id+=`#${i}`;ids.add(id);
  await client.query(`insert into public.${table}(namespace,scope_id,entry_key,position,owner_id,legacy_customer_id,status,payload,active) values($1,$2,$3,$4,$5,$6,$7,$8,true) on conflict(namespace,scope_id,entry_key) do update set position=excluded.position,owner_id=excluded.owner_id,legacy_customer_id=excluded.legacy_customer_id,status=excluded.status,payload=excluded.payload,active=true,updated_at=now()`,[key,scope,id,i,ownerId || null,row?.customerId || null,row?.status || null,JSON.stringify(row)]);
 }
 await client.query('insert into app_private.document_versions(namespace,scope_id,value_kind,content_sha256,version) values($1,$2,$3,$4,1) on conflict(namespace,scope_id) do update set value_kind=excluded.value_kind,content_sha256=excluded.content_sha256,version=app_private.document_versions.version+1,updated_at=now()',[key,scope,kind,digest]);
}
export async function readPortal():Promise<PortalDatabase>{return transaction(async client=>{
 await client.query('set transaction isolation level repeatable read');
 const revision=Number((await client.query('select revision from app_private.portal_version where singleton=true')).rows[0].revision);
 const users=adoptedSchema()?await adoptedUsers(client):(await client.query('select payload from app_private.portal_users where active order by id')).rows.map(row=>row.payload);
 const keys=(await client.query("select namespace from app_private.document_versions where scope_id='global'")).rows.map(row=>row.namespace).filter(key=>domainFor(key));
 const values:Row={};for(const key of new Set([...keys,...(adoptedSchema()?adoptedNamespaces():[])]))values[key]=await readDocument(client,key);
 const otp=adoptedSchema()?{}:Object.fromEntries((await client.query('select id,payload from app_private.legacy_otp')).rows.map(row=>[row.id,row.payload]));
 return {revision,users,values,otp};
});}
export async function persistUsers(client:SqlClient,users:Row[]){
 if(adoptedSchema())return persistAdoptedUsers(client,users);
 await client.query('update app_private.portal_users set active=false where not(id=any($1::text[]))',[users.map(user=>user.id)]);
 await client.query('update public.profiles set active=false where not(id=any($1::text[]))',[users.map(user=>user.id)]);
 for(const user of users){
  const {password,passwordHash,passwordSalt,...safe}=user;
  const role=['retail','wholesale','dealer','admin'].includes(user.role)?user.role:'retail';
  await client.query(`insert into public.profiles(id,auth_user_id,phone,username,display_name,company_name,role,payload) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(id) do update set auth_user_id=coalesce(excluded.auth_user_id,profiles.auth_user_id),phone=excluded.phone,username=excluded.username,display_name=excluded.display_name,company_name=excluded.company_name,role=excluded.role,payload=excluded.payload,active=true`,[user.id,user.authUserId || null,user.phone || user.mobile || null,user.username || null,user.fullName || '',user.companyName || '',role,JSON.stringify(safe)]);
  await client.query('insert into app_private.portal_users(id,payload,active) values($1,$2,true) on conflict(id) do update set payload=excluded.payload,active=true',[user.id,JSON.stringify(user)]);
  for(const [index,address] of (user.addresses || []).entries())await client.query('insert into public.addresses(id,profile_id,payload) values($1,$2,$3) on conflict(id) do update set payload=excluded.payload',[`${user.id}:${address.id || index}`,user.id,JSON.stringify(address)]);
 }
}
export async function writePortal(db:PortalDatabase,expected:number,persistAccounts=true,changedKeys?:readonly string[]){await transaction(async client=>{
 const row=(await client.query('update app_private.portal_version set revision=revision+1 where singleton=true and revision=$1 returning revision',[expected])).rows[0];if(!row)throw conflict();
 if(persistAccounts)await persistUsers(client,db.users);
 for(const [key,value] of Object.entries(db.values))if(domainFor(key) && (!changedKeys || changedKeys.includes(key)))await writeDocument(client,key,value);
 if(!adoptedSchema())for(const [key,value] of Object.entries(db.otp || {}))await client.query('insert into app_private.legacy_otp(id,payload) values($1,$2) on conflict(id) do update set payload=excluded.payload',[key,JSON.stringify(value)]);
 db.revision=Number(row.revision);
 });}
export async function readProducts(){
 if(adoptedSchema())return readAdoptedProducts(database());
 const result=await database().query(`select f.payload,coalesce((select jsonb_agg(v.payload || jsonb_build_object('stock',s.quantity-s.reserved,'stockKnown',s.known,'prices',coalesce((select jsonb_object_agg(p.price_list_code,p.amount) from public.sku_prices p where p.variant_code=v.code),'{}'::jsonb)) order by v.code) from public.product_variants v join public.inventory_balances s on s.variant_code=v.code where v.family_code=f.code and v.active),'[]'::jsonb) as variants from public.product_families f where f.active order by f.code`);
 return result.rows.map(row=>({...row.payload,variants:row.variants}));
}
async function chunks(client:SqlClient,rows:Row[],sql:string){for(let index=0;index<rows.length;index+=500)await client.query(sql,[JSON.stringify(rows.slice(index,index+500))]);}
export async function saveProducts(client:SqlClient,products:Row[]){
 if(adoptedSchema())return saveAdoptedProducts(client,products);
 const families=products.map(p=>({code:p.code,name:p.name,category_slug:p.categorySlug || '',active:p.active!==false,payload:p}));
 const variants=products.flatMap(p=>(p.variants || []).map((v:Row)=>({code:v.code,family_code:p.code,name:v.name || p.name,active:v.active!==false,payload:v})));
 if(new Set(variants.map(v=>v.code)).size!==variants.length)throw new Error('Duplicate inventory SKU: review source data before import');
 await chunks(client,families,`insert into public.product_families(code,name,category_slug,active,payload) select code,name,category_slug,active,payload from jsonb_to_recordset($1::jsonb) as x(code text,name text,category_slug text,active boolean,payload jsonb) on conflict(code) do update set name=excluded.name,category_slug=excluded.category_slug,active=excluded.active,payload=excluded.payload,updated_at=now()`);
 await chunks(client,variants,`insert into public.product_variants(code,family_code,name,active,payload) select code,family_code,name,active,payload from jsonb_to_recordset($1::jsonb) as x(code text,family_code text,name text,active boolean,payload jsonb) on conflict(code) do update set family_code=excluded.family_code,name=excluded.name,active=excluded.active,payload=excluded.payload,updated_at=now()`);
 const stock=variants.map(v=>({variant_code:v.code,quantity:Number(v.payload.stock)||0,known:v.payload.stockKnown===true,payload:{source:'catalogue'}}));
 await chunks(client,stock,`insert into public.inventory_balances(variant_code,quantity,known,payload) select variant_code,quantity,known,payload from jsonb_to_recordset($1::jsonb) as x(variant_code text,quantity numeric,known boolean,payload jsonb) on conflict(variant_code) do nothing`);
 const prices=variants.flatMap(v=>Object.entries(v.payload.prices || {}).filter(([,n])=>Number.isFinite(Number(n)) && Number(n)>=0).map(([layer,amount])=>({variant_code:v.code,price_list_code:layer,amount:Number(amount)})));
 await chunks(client,prices,`insert into public.sku_prices(variant_code,price_list_code,amount) select variant_code,price_list_code,amount from jsonb_to_recordset($1::jsonb) as x(variant_code text,price_list_code text,amount numeric) on conflict(variant_code,price_list_code) do update set amount=excluded.amount`);
 const specs=products.flatMap(p=>[...(p.technicalSpecs || []).map((s:Row,position:number)=>({family_code:p.code,variant_code:'',position,name:s.key,value:String(s.value)})),...(p.variants || []).flatMap((v:Row)=>(v.technicalSpecs || []).map((s:Row,position:number)=>({family_code:p.code,variant_code:v.code,position,name:s.key,value:String(s.value)})))]);
 await chunks(client,specs,`insert into public.product_specs(family_code,variant_code,position,name,value) select family_code,variant_code,position,name,value from jsonb_to_recordset($1::jsonb) as x(family_code text,variant_code text,position integer,name text,value text) on conflict(family_code,variant_code,position) do update set name=excluded.name,value=excluded.value`);
 const images=products.flatMap(p=>(p.galleryImages || (p.images || []).map((url:string)=>({url,scope:'family'}))).map((image:Row,position:number)=>({id:hash([p.code,image.url,image.variantCode]),family_code:p.code,variant_code:image.variantCode || null,url:image.url,identity_verified:image.identityVerified===true,position,payload:image})));
 await chunks(client,images,`insert into public.product_images(id,family_code,variant_code,url,identity_verified,position,payload) select id,family_code,variant_code,url,identity_verified,position,payload from jsonb_to_recordset($1::jsonb) as x(id text,family_code text,variant_code text,url text,identity_verified boolean,position integer,payload jsonb) on conflict(id) do update set identity_verified=excluded.identity_verified,position=excluded.position,payload=excluded.payload`);
}
