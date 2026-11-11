import crypto from 'node:crypto';
import type {Request,Response} from 'express';
import {database,databaseEnabled,transaction,adoptedSchema} from './connection';
import {adoptedOrders} from './adoptedCheckout';
import {adoptedNamespaces,readAdoptedProducts,toman} from './adopted';
import {readDocument,writeDocument,readProducts,conflict} from './repository';
import {domainFor,canWriteCustomerNamespace,publicReadable} from './namespaces';
import {getPortalIdentity} from '../../api/portal';
import {canStaff,namespacePermission,assertStaffDocumentChange} from './staffPermissions';
import {publicCatalog,compactCatalogReviews} from '../../src/utils/catalogPrivacy';
import {selectHomePreviewProducts} from '../../src/utils/homeCatalogPreview';
import {getAdminCatalogProducts,invalidateAdminCatalogCache,primeAdminCatalogCache} from './adminCatalogCache';
import {toCatalogListingProduct} from '../../src/utils/catalogListing';
function checkOrigin(req:Request){if(req.get('origin') && new URL(req.get('origin')!).host!==req.get('host'))throw Object.assign(new Error('درخواست از مبدأ نامعتبر است.'),{status:403});}
function guestScope(req:Request,res:Response){let token=(req.headers.cookie || '').split(';').map(v=>v.trim()).find(v=>v.startsWith('sp_guest='))?.slice(9);if(!token || !/^[a-f0-9]{64}$/.test(token)){token=crypto.randomBytes(32).toString('hex');res.append('Set-Cookie',`sp_guest=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.NODE_ENV==='production'?'; Secure':''}`);}return 'guest:'+crypto.createHash('sha256').update(token).digest('hex');}
// Cache only the shared public catalogue. Never cache user-specific prices, stock visibility or sessions.
const PUBLIC_CATALOG_TTL_MS=120000;
let publicCatalogCache:{expires:number,value:unknown}|undefined;
let publicCatalogInFlight:Promise<unknown>|undefined;
let publicCatalogGeneration=0;
let publicListingCache:{expires:number;value:{success:true;total:number;brands:string[];products:unknown[]}}|undefined;
/** Public /api/runtime responses must see newly uploaded images immediately. */
export function invalidatePublicCatalogCache(){
 publicCatalogGeneration++;
 publicCatalogCache=undefined;
 publicCatalogInFlight=undefined;
 publicListingCache=undefined;
 invalidateAdminCatalogCache();
}
/** Seed the public response cache from the catalogue already loaded during startup. */
export function primePublicCatalogCache(products:unknown){
 publicCatalogGeneration++;
 publicCatalogInFlight=undefined;
 primeAdminCatalogCache(products);
 publicCatalogCache={expires:Date.now()+PUBLIC_CATALOG_TTL_MS,value:compactCatalogReviews(publicCatalog(products))};
 publicListingCache=undefined;
}
const PUBLIC_DOCUMENT_TTL_MS=60000;
const sharedDocumentCache=new Map<string,{expires:number,value:unknown}>();
const sharedDocumentInFlight=new Map<string,Promise<unknown>>();
async function cachedPublicDocument(key:string):Promise<unknown>{
 const entry=sharedDocumentCache.get(key);
 if(entry && Date.now()<entry.expires)return entry.value;
 const pending=sharedDocumentInFlight.get(key);
 if(pending)return pending;
 const task=readDocument(database(),key,'global').then(value=>{
   sharedDocumentCache.set(key,{expires:Date.now()+PUBLIC_DOCUMENT_TTL_MS,value});
   return value;
 }).finally(()=>sharedDocumentInFlight.delete(key));
 sharedDocumentInFlight.set(key,task);
 return task;
}

async function publicProductsCached():Promise<unknown>{
 if(publicCatalogCache && Date.now()<publicCatalogCache.expires)return publicCatalogCache.value;
 if(!publicCatalogInFlight){
  const generation=publicCatalogGeneration;
  const task=readProducts({includeTechnicalReviews:false}).then(products=>{
    const value=compactCatalogReviews(publicCatalog(products));
    if(generation===publicCatalogGeneration)
      publicCatalogCache={expires:Date.now()+PUBLIC_CATALOG_TTL_MS,value};
    return value;
  }).finally(()=>{if(publicCatalogInFlight===task)publicCatalogInFlight=undefined;});
  publicCatalogInFlight=task;
 }
 return publicCatalogInFlight;
}
/** Compact first-paint index: full SKU payloads are fetched only on product detail. */
export async function publicCatalogListingApi(_req:Request,res:Response){
 if(!databaseEnabled())return res.status(503).json({success:false,message:'پایگاه داده در دسترس نیست.'});
 res.setHeader('Cache-Control','public, max-age=30, stale-while-revalidate=120');
 try{
  if(publicListingCache && Date.now()<publicListingCache.expires)return res.json(publicListingCache.value);
  const catalog=await publicProductsCached() as any[];
  const products=(Array.isArray(catalog)?catalog:[])
   .filter(product=>product?.active!==false)
   .map(product=>toCatalogListingProduct(product));
  const brands=Array.from(new Set(products.map(product=>product.brand).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'fa'));
  const value={success:true as const,total:products.length,brands,products};
  publicListingCache={expires:Date.now()+PUBLIC_CATALOG_TTL_MS,value};
  return res.json(value);
 }catch{
  return res.status(503).json({success:false,message:'دریافت فهرست سبک محصولات ممکن نشد.'});
 }
}

function findCatalogFamily(products:any[],code:string){
 const normalized=code.trim().toLowerCase();
 return products.find(product=>
  String(product?.code||'').toLowerCase()===normalized ||
  (Array.isArray(product?.variants) && product.variants.some((variant:any)=>String(variant?.code||'').toLowerCase()===normalized))
 );
}

/** Fetch the full technical/commercial payload for one selected family only. */
export async function catalogProductApi(req:Request,res:Response){
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Vary','Cookie');
 if(!databaseEnabled())return res.status(503).json({success:false,message:'پایگاه داده در دسترس نیست.'});
 const code=String(req.params.code||'').trim();
 if(!code || code.length>180)return res.status(400).json({success:false,message:'کد محصول معتبر نیست.'});
 try{
  const identity=await getPortalIdentity(req);
  let products:any[]=[];
  let commercialVisible=false;
  if(identity.staff){
   if(!canStaff(identity,'products'))return res.status(403).json({success:false,message:'دسترسی مشاهده این کالا مجاز نیست.'});
   products=await getAdminCatalogProducts() as any[];
   commercialVisible=canStaff(identity,'products','prices');
  }else if(identity.admin){
   products=await getAdminCatalogProducts() as any[];
   commercialVisible=true;
  }else if(identity.user && identity.canReadCommerce){
   products=await readProducts({includeTechnicalReviews:false}) as any[];
   const family=findCatalogFamily(products,code);
   if(family){
    const variants=Array.isArray(family.variants)?family.variants:[];
    const zeroPrices={base:0,retail:0,wholesale:0,dealer:0};
    if(adoptedSchema()){
     await transaction(async client=>{
      await client.query("select set_config('request.jwt.claim.sub',$1,true)",[identity.user!.authUserId]);
      const codes=variants.map((variant:any)=>variant.code).filter(Boolean);
      const rows=identity.user!.canViewPrices && codes.length
       ? (await client.query('select c.variant_code,c.currency,app_private.current_variant_price(c.variant_code) as amount from public.variant_commercial_specs c where c.variant_code=any($1::text[])',[codes])).rows
       : [];
      const prices=new Map(rows.map((row:any)=>[row.variant_code,toman(row.amount,row.currency)]));
      for(const variant of variants){
       const amount=identity.user!.canViewPrices?Number(prices.get(variant.code)||0):0;
       variant.prices={base:amount,retail:amount,wholesale:amount,dealer:amount};
       variant.price=amount;
       if(!identity.user!.canViewStock){variant.stock=0;variant.stockKnown=false;}
      }
     });
    }else{
     for(const variant of variants){
      if(!identity.user.canViewPrices){variant.prices=zeroPrices;variant.price=0;}
      if(!identity.user.canViewStock){variant.stock=0;variant.stockKnown=false;}
     }
    }
    family.prices=variants[0]?.prices||zeroPrices;
    family.stock=variants.reduce((sum:number,variant:any)=>sum+Number(variant.stock||0),0);
    family.stockKnown=variants.length>0 && variants.every((variant:any)=>variant.stockKnown===true);
    family.inquiryOnly=variants.length===0 || variants.every((variant:any)=>variant.inquiryOnly===true);
   }
   commercialVisible=true;
  }else{
   products=await publicProductsCached() as any[];
  }
  const family=findCatalogFamily(products,code);
  if(!family)return res.status(404).json({success:false,message:'خانواده محصول در کاتالوگ پیدا نشد.'});
  const visibleProduct=commercialVisible?family:publicCatalog(family);
  const product=compactCatalogReviews([visibleProduct])[0];
  return res.json({success:true,product});
 }catch(error:any){
  const status=Number(error?.status)||503;
  return res.status(status).json({success:false,message:status===403?'دسترسی مشاهده این کالا مجاز نیست.':'دریافت اطلاعات خانواده محصول ممکن نشد.'});
 }
}

/** First-paint catalog preview: independent of the 10k-SKU runtime hydration. */
export async function publicHomePreviewApi(_req:Request,res:Response){
 res.setHeader('Cache-Control','public, max-age=20');
 if(!databaseEnabled())return res.status(503).json({success:false,products:[]});
 try{
  // This cache contains only the publicCatalog projection; never prices or stock.
  const catalog=await publicProductsCached();
  return res.json({success:true,products:selectHomePreviewProducts(catalog)});
 }catch{return res.status(503).json({success:false,products:[]});}
}

/** Resolve one public technical review on demand; no private commercial fields. */
export async function publicVariantReviewApi(req:Request,res:Response){
 res.setHeader('Cache-Control','private, no-store');
 if(!databaseEnabled())return res.status(503).json({success:false});
 const code=String(req.params.code||'').trim();
 if(!code || code.length>180)return res.status(400).json({success:false});
 try{
  if(adoptedSchema()){
   const result=await database().query(
    `select v.code,v.technical_review
       from public.catalog_variants v
       join public.catalog_families f on f.code=v.family_code
      where lower(v.code)=lower($1) and v.active=true
        and f.is_active=true and not f.is_deleted
      limit 1`,
    [code]
   );
   const variant=result.rows[0];
   if(!variant)return res.status(404).json({success:false});
   return res.json({success:true,code:variant.code,technicalReview:variant.technical_review??null});
  }
  const catalog=await readProducts();
  if(!Array.isArray(catalog))return res.status(503).json({success:false});
  for(const family of catalog as Array<{active?:boolean;variants?:Array<{code?:string;active?:boolean;technicalReview?:unknown}>}>){
   if(family.active===false)continue;
   const variant=family.variants?.find(v=>v.active!==false && v.code?.toLowerCase()===code.toLowerCase());
   if(variant)return res.json({success:true,code:variant.code,technicalReview:variant.technicalReview??null});
  }
  return res.status(404).json({success:false});
 }catch{return res.status(503).json({success:false,message:'دریافت اطلاعات فنی ممکن نشد.'});}
}

export async function runtimeApi(req:Request,res:Response){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Cookie');
 if(!databaseEnabled())return res.json({success:true,database:false});
 try{
  const identity=await getPortalIdentity(req);const scope=identity.user ? 'user:'+identity.user.id : guestScope(req,res);
  if(req.method==='GET'){
   // Admin overview needs portal documents and permissions, not the complete
   // 10k-SKU catalogue. The catalogue is fetched on demand by its workspace.
   const includeProducts=String(req.query.includeProducts ?? '1')!=='0';
   const metadata=(await database().query('select namespace,scope_id,version from app_private.document_versions where scope_id=$1 or scope_id=$2',[scope,'global'])).rows;
   const values:Record<string,unknown>={},versions:Record<string,number>={};
   const permitted=metadata.filter(row=>domainFor(row.namespace) && (identity.staff
     ? (row.scope_id==='global' && namespacePermission(identity,domainFor(row.namespace)||'',false,row.namespace))
     : (row.scope_id!== 'global' || identity.admin || publicReadable.has(row.namespace))));
   const seen=new Set(permitted.map(row=>row.namespace));
   const supplemental=adoptedSchema()?adoptedNamespaces().filter(key=>!seen.has(key) && (identity.staff?namespacePermission(identity,domainFor(key)||'',false,key):(identity.admin || publicReadable.has(key)))):[];
   // Parallel reads eliminate sequential cross-region round trips. Cache only
   // public global documents, never private user or admin datasets.
   let guestProducts:unknown;
   // Cold public catalogue reads can be expensive; overlap them with document reads.
   await Promise.all([
     ...(includeProducts && !identity.user && !identity.admin ? [
       publicProductsCached().then(value=>{guestProducts=value;})
     ] : []),
     ...permitted.map(async row=>{
       const key=row.namespace;
       const value=row.scope_id==='global' && !identity.admin && !identity.staff && publicReadable.has(key)
         ? await cachedPublicDocument(key)
         : await readDocument(database(),key,row.scope_id);
       values[key]=value;
       versions[key]=Number(row.version);
     }),
     ...supplemental.map(async key=>{
       const value=!identity.admin && !identity.staff && publicReadable.has(key)
         ? await cachedPublicDocument(key)
         : await readDocument(database(),key,'global');
       if(value!==undefined){values[key]=value;versions[key]=0;}
     })
   ]);
   if(identity.user && !identity.staff)values.hyper_sanat_orders_v2=adoptedSchema()?await adoptedOrders(database(),identity.user.authUserId):(await database().query('select payload from public.orders where active and (owner_id=$1 or legacy_customer_id=$1) order by updated_at desc',[identity.user.id])).rows.map(row=>row.payload);
   let visibleProducts:unknown=[];
   if(includeProducts){
    const products=identity.staff
     ? (canStaff(identity,'products')?await getAdminCatalogProducts():[])
     : !identity.user && !identity.admin ? guestProducts : adoptedSchema() && !identity.admin && identity.user?await transaction(async client=>{
     const data=await readAdoptedProducts(client,{includeTechnicalReviews:false});await client.query("select set_config('request.jwt.claim.sub',$1,true)",[identity.user!.authUserId]);
     const rows=(await client.query('select c.variant_code,c.currency,app_private.current_variant_price(c.variant_code) as amount from public.variant_commercial_specs c')).rows;
     const prices=new Map(rows.map(row=>[row.variant_code,toman(row.amount,row.currency)]));
     for(const family of data){for(const variant of family.variants){const amount=identity.user!.canViewPrices?prices.get(variant.code) || 0:0;variant.prices={base:amount,retail:amount,wholesale:amount,dealer:amount};variant.price=amount;if(!identity.user!.canViewStock){variant.stock=0;variant.stockKnown=false;}}family.prices=family.variants[0]?.prices || {base:0,retail:0,wholesale:0,dealer:0};family.stock=family.variants.reduce((s:number,v:any)=>s+v.stock,0);family.stockKnown=family.variants.every((v:any)=>v.stockKnown);}
     return data;
    }):identity.admin?await getAdminCatalogProducts():await readProducts({includeTechnicalReviews:false});
    visibleProducts=identity.staff && !canStaff(identity,'products','prices')
     ? publicCatalog(products)
     : identity.canReadCommerce?products:(!identity.user && !identity.admin ? products : publicCatalog(products));
   }
   return res.json({success:true,database:true,admin:identity.admin,userId:identity.user?.id || null,values,versions,productsIncluded:includeProducts,products:includeProducts?compactCatalogReviews(visibleProducts):[]});
  }
  checkOrigin(req);
  const key=String(req.body?.key || '');const domain=domainFor(key);if(!domain)throw Object.assign(new Error('بخش داده معتبر نیست.'),{status:400});
  const customerId=identity.user?.id || 'guest';
  if(identity.staff && !namespacePermission(identity,domain,false,key))
    throw Object.assign(new Error('دسترسی به این بخش مجاز نیست.'),{status:403});
  if(identity.staff && !namespacePermission(identity,domain,true,key))
    throw Object.assign(new Error('مجوز ویرایش این بخش را ندارید.'),{status:403});
  if(!identity.admin && !identity.staff && !canWriteCustomerNamespace(key,customerId))throw Object.assign(new Error('اجازه تغییر این اطلاعات را ندارید.'),{status:403});
  if(identity.user && !identity.staff && req.body?.userId!==identity.user.id)throw Object.assign(new Error('حساب فعال تغییر کرده است؛ صفحه را تازه کنید.'),{status:409});
  if(JSON.stringify(req.body?.value).length>4*1024*1024)throw Object.assign(new Error('حجم داده بیش از حد است.'),{status:413});
  const target=(identity.admin || identity.staff) && !canWriteCustomerNamespace(key,customerId)?'global':scope;
  const version=await transaction(async client=>{
    await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[target+':'+key]);
    const current=Number((await client.query('select version from app_private.document_versions where scope_id=$1 and namespace=$2',[target,key])).rows[0]?.version || 0);
    if(Number(req.body?.version)!==current)throw conflict();
    if(identity.staff){
      const existing=await readDocument(client,key,target);
      assertStaffDocumentChange(identity,domain,key,existing,req.body.value);
    }
    await writeDocument(client,key,req.body.value,target,identity.user?.id);
    return Number((await client.query('select version from app_private.document_versions where scope_id=$1 and namespace=$2',[target,key])).rows[0]?.version || current);
  });if(target==='global'){sharedDocumentCache.delete(key);publicCatalogCache=undefined;publicListingCache=undefined;}return res.json({success:true,version});
 }catch(error:any){return res.status(error.status || 503).json({success:false,message:error.status?error.message:'ارتباط با دیتابیس برقرار نشد؛ هیچ ذخیره‌سازی محلی جایگزین نشد.'});}
}

/**
 * Dedicated administrator catalogue bootstrap.
 * Keep the 10k-SKU read separate from the broad portal-document snapshot:
 * the admin workspace needs products, not every CRM/order/settings document.
 */
export async function adminCatalogApi(req:Request,res:Response){
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Vary','Cookie');
 if(!databaseEnabled())return res.status(503).json({success:false,database:false,message:'پایگاه داده در دسترس نیست.'});
 try{
  const identity=await getPortalIdentity(req);
  const allowed=identity.admin===true || (identity.staff===true && (canStaff(identity,'products') || canStaff(identity,'bulk_import')));
  if(!allowed)return res.status(403).json({success:false,message:'دسترسی مشاهده فهرست کالاها مجاز نیست.'});
  const products=identity.staff
   ? (canStaff(identity,'products')?await getAdminCatalogProducts():[])
   : identity.admin?await getAdminCatalogProducts():[];
  const visibleProducts=identity.staff && !canStaff(identity,'products','prices')
   ? publicCatalog(products)
   : identity.canReadCommerce?products:(!identity.user && !identity.admin?products:publicCatalog(products));
  return res.json({
   success:true,database:true,admin:identity.admin===true,
   productsIncluded:true,products:compactCatalogReviews(visibleProducts)
  });
 }catch(error:any){
  return res.status(error.status || 503).json({
   success:false,database:false,
   message:error.status?error.message:'دریافت فهرست کالاها از پایگاه داده ممکن نشد.'
  });
 }
}
