import crypto from 'node:crypto';
import type {Request,Response} from 'express';
import {database,databaseEnabled,transaction,adoptedSchema} from './connection';
import {adoptedOrders} from './adoptedCheckout';
import {adoptedNamespaces,readAdoptedProducts,toman} from './adopted';
import {readDocument,writeDocument,readProducts,conflict} from './repository';
import {domainFor,canWriteCustomerNamespace,publicReadable} from './namespaces';
import {getPortalIdentity} from '../../api/portal';
import {publicCatalog} from '../../src/utils/catalogPrivacy';
function checkOrigin(req:Request){if(req.get('origin') && new URL(req.get('origin')!).host!==req.get('host'))throw Object.assign(new Error('درخواست از مبدأ نامعتبر است.'),{status:403});}
function guestScope(req:Request,res:Response){let token=(req.headers.cookie || '').split(';').map(v=>v.trim()).find(v=>v.startsWith('sp_guest='))?.slice(9);if(!token || !/^[a-f0-9]{64}$/.test(token)){token=crypto.randomBytes(32).toString('hex');res.append('Set-Cookie',`sp_guest=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.NODE_ENV==='production'?'; Secure':''}`);}return 'guest:'+crypto.createHash('sha256').update(token).digest('hex');}
export async function runtimeApi(req:Request,res:Response){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Cookie');
 if(!databaseEnabled())return res.json({success:true,database:false});
 try{
  const identity=await getPortalIdentity(req);const scope=identity.user ? 'user:'+identity.user.id : guestScope(req,res);
  if(req.method==='GET'){
   const metadata=(await database().query('select namespace,scope_id,version from app_private.document_versions where scope_id=$1 or scope_id=$2',[scope,'global'])).rows;
   const values:Record<string,unknown>={},versions:Record<string,number>={};
   for(const row of metadata){if(!domainFor(row.namespace))continue;
    if(row.scope_id==='global' && !(identity.admin || publicReadable.has(row.namespace)))continue;
    values[row.namespace]=await readDocument(database(),row.namespace,row.scope_id);versions[row.namespace]=Number(row.version);
   }
   if(adoptedSchema())for(const key of adoptedNamespaces()){
    if(Object.hasOwn(values,key) || !(identity.admin || publicReadable.has(key)))continue;
    const value=await readDocument(database(),key,'global');if(value!==undefined){values[key]=value;versions[key]=0;}
   }
   if(identity.user)values.hyper_sanat_orders_v2=adoptedSchema()?await adoptedOrders(database(),identity.user.authUserId):(await database().query('select payload from public.orders where active and (owner_id=$1 or legacy_customer_id=$1) order by updated_at desc',[identity.user.id])).rows.map(row=>row.payload);
   const products=adoptedSchema() && !identity.admin && identity.user?await transaction(async client=>{
    const data=await readAdoptedProducts(client);await client.query("select set_config('request.jwt.claim.sub',$1,true)",[identity.user!.authUserId]);
    const rows=(await client.query('select c.variant_code,c.currency,app_private.current_variant_price(c.variant_code) as amount from public.variant_commercial_specs c')).rows;
    const prices=new Map(rows.map(row=>[row.variant_code,toman(row.amount,row.currency)]));
    for(const family of data){for(const variant of family.variants){const amount=identity.user!.canViewPrices?prices.get(variant.code) || 0:0;variant.prices={base:amount,retail:amount,wholesale:amount,dealer:amount};variant.price=amount;if(!identity.user!.canViewStock){variant.stock=0;variant.stockKnown=false;}}family.prices=family.variants[0]?.prices || {base:0,retail:0,wholesale:0,dealer:0};family.stock=family.variants.reduce((s:number,v:any)=>s+v.stock,0);family.stockKnown=family.variants.every((v:any)=>v.stockKnown);}
    return data;
   }):await readProducts();
   return res.json({success:true,database:true,admin:identity.admin,userId:identity.user?.id || null,values,versions,products:identity.canReadCommerce?products:publicCatalog(products)});
  }
  checkOrigin(req);
  const key=String(req.body?.key || '');const domain=domainFor(key);if(!domain)throw Object.assign(new Error('بخش داده معتبر نیست.'),{status:400});
  const customerId=identity.user?.id || 'guest';
  if(!identity.admin && !canWriteCustomerNamespace(key,customerId))throw Object.assign(new Error('اجازه تغییر این اطلاعات را ندارید.'),{status:403});
  if(identity.user && req.body?.userId!==identity.user.id)throw Object.assign(new Error('حساب فعال تغییر کرده است؛ صفحه را تازه کنید.'),{status:409});
  if(JSON.stringify(req.body?.value).length>4*1024*1024)throw Object.assign(new Error('حجم داده بیش از حد است.'),{status:413});
  const target=identity.admin && !canWriteCustomerNamespace(key,customerId)?'global':scope;
  const version=await transaction(async client=>{
    await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[target+':'+key]);
    const current=Number((await client.query('select version from app_private.document_versions where scope_id=$1 and namespace=$2',[target,key])).rows[0]?.version || 0);
    if(Number(req.body?.version)!==current)throw conflict();
    await writeDocument(client,key,req.body.value,target,identity.user?.id);
    return Number((await client.query('select version from app_private.document_versions where scope_id=$1 and namespace=$2',[target,key])).rows[0]?.version || current);
  });return res.json({success:true,version});
 }catch(error:any){return res.status(error.status || 503).json({success:false,message:error.status?error.message:'ارتباط با دیتابیس برقرار نشد؛ هیچ ذخیره‌سازی محلی جایگزین نشد.'});}
}
