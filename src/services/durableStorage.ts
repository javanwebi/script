/** In PostgreSQL mode this is an in-memory view of server data, never a durable browser database. */
let enabled=false,hydrating=false,userId:string|null=null;
const memory=new Map<string,string>(),versions=new Map<string,number>(),queues=new Map<string,Promise<void>>();
const dirtyWrites=new Map<string,string>();
export type DurableRuntimeState = {
 success:boolean;
 database:boolean;
 message?:string;
 userId?:string|null;
 values?:Record<string,unknown>;
 versions?:Record<string,number>;
 products?:unknown[];
 productsIncluded?:boolean;
 [key:string]:unknown;
};
let refreshInFlight:Promise<DurableRuntimeState>|null=null;
let refreshInFlightIncludesProducts=false;
let adminCatalogRefreshInFlight:Promise<DurableRuntimeState>|null=null;
let catalogHydrated=false;
const portalOwned=new Set(['atlas_admin_customers_v1','atlas_admin_inquiries_v1','atlas_legacy_customers_v1','atlas_customers_approval_v2','atlas_price_lists_v2','atlas_customer_grades_v2','atlas_club_rewards_v2','atlas_customer_reward_assignments_v1','atlas_price_list_history_v2','atlas_portal_content_banners_v1','atlas_portal_content_announcements_v1','atlas_portal_club_milestones_v1','atlas_portal_layout_configs_v1','atlas_portal_customer_overrides_v1']);
const readOnly=new Set(['hyper_sanat_orders_v2','hyper_sanat_sms_v2','hyper_sanat_stock_v2','hyper_sanat_inquiries_v2']);
const ephemeral=(key:string)=>/auth|credentials|registered_users|mock_inactive|migrated|local_backup|catalog_overrides/.test(key);
export function databaseStorageEnabled(){return enabled;}
export function hydrateMemory(run:()=>void){hydrating=true;try{run();}finally{hydrating=false;}}
function emit(state:string,message=''){window.dispatchEvent(new CustomEvent('atlas-portal-save-status',{detail:{state,message}}));}
export function isDatabaseCatalogHydrated(){return catalogHydrated;}

export function refreshDurableStorage(options:{includeProducts?:boolean}={}):Promise<DurableRuntimeState>{
 const includeProducts=options.includeProducts!==false;
 if(refreshInFlight){
  if(!includeProducts || refreshInFlightIncludesProducts)return refreshInFlight;
  const pending=refreshInFlight;
  // A lean admin bootstrap may already be running. Upgrade it to a full
  // catalogue refresh only after the lean request has settled.
  return pending.then(
   ()=>refreshDurableStorage(options),
   ()=>refreshDurableStorage(options),
  );
 }
 const request:Promise<DurableRuntimeState>=(async()=>{
  // Runtime reads must never wait behind unrelated writes. Pending and failed keys
  // are protected from snapshot replacement below, so catalogue hydration can proceed.
  const endpoint=includeProducts?'/api/runtime':'/api/runtime?includeProducts=0';
  const timeoutMs=includeProducts?30000:12000;
  let res:Response;
  try{
   res=await fetch(endpoint,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(timeoutMs)});
  }catch(error){
   if(error instanceof Error && (error.name==='TimeoutError' || error.name==='AbortError'))
    throw new Error(includeProducts
     ? 'دریافت فهرست کالاها بیش از ۳۰ ثانیه طول کشید؛ سرویس داده پاسخ‌گو نبود و باید دوباره تلاش شود.'
     : 'بارگذاری اولیه پنل بیش از حد طول کشید؛ دوباره تلاش کنید.');
   throw error;
  }
  if(!res.ok)throw new Error('Runtime API returned HTTP '+res.status+'.');
  const data=await res.json() as DurableRuntimeState;
  if(!data.success)throw new Error(data.message || 'پاسخ سرویس داده معتبر نبود.');
  enabled=data.database===true;
  if(enabled){
   // Never replace optimistic values or versions while their write is pending
   // or after a failed write. The server snapshot may have been read before
   // that write committed; dropping these values would lose the user's edit.
   const protectedKeys=new Set([...queues.keys(),...dirtyWrites.keys()]);
   for(const key of memory.keys())
    if(!ephemeral(key) && !protectedKeys.has(key))memory.delete(key);
   for(const key of versions.keys())
    if(!protectedKeys.has(key))versions.delete(key);
   userId=data.userId ?? null;
   for(const [key,value] of Object.entries(data.values || {}))
    if(!protectedKeys.has(key))memory.set(key,JSON.stringify(value));
   for(const [key,value] of Object.entries(data.versions || {}))
    if(!protectedKeys.has(key))versions.set(key,Number(value));
   // A lean runtime response deliberately omits the catalogue. It must not
   // invalidate a catalogue already hydrated in this browser session.
   // Only a full request can change the hydration flag.
   if(includeProducts)catalogHydrated=data.productsIncluded===true && Array.isArray(data.products);
   window.dispatchEvent(new CustomEvent('sanat-durable-hydrated',{detail:data}));
  }else{
   catalogHydrated=false;
  }
  return data;
 })();
 refreshInFlight=request;
 refreshInFlightIncludesProducts=includeProducts;
 void request.finally(()=>{
  if(refreshInFlight===request){
   refreshInFlight=null;
   refreshInFlightIncludesProducts=false;
  }
 }).catch(()=>{});
 return request;
}

/**
 * Hydrate the admin product index without repeating the full administrator
 * portal snapshot (CRM, orders, settings and other unrelated documents).
 */
export function refreshAdminCatalog():Promise<DurableRuntimeState>{
 if(adminCatalogRefreshInFlight)return adminCatalogRefreshInFlight;
 const request:Promise<DurableRuntimeState>=(async()=>{
  if(!enabled){
   const state=await refreshDurableStorage({includeProducts:false});
   if(state.database!==true)throw new Error('پایگاه داده هنوز برای دریافت کاتالوگ آماده نیست.');
  }
  let res:Response;
  try{
   res=await fetch('/api/admin/catalog',{
    credentials:'same-origin',cache:'no-store',
    signal:AbortSignal.timeout(45000)
   });
  }catch(error){
   if(error instanceof Error && (error.name==='TimeoutError' || error.name==='AbortError' || /timed out/i.test(error.message)))
    throw new Error('دریافت فهرست کالاها از مسیر اختصاصی بیش از ۴۵ ثانیه طول کشید؛ وضعیت سرور و کاتالوگ باید بررسی شود.');
   throw error;
  }
  const data=await res.json() as DurableRuntimeState;
  if(!res.ok || !data.success)throw new Error(data.message || 'دریافت فهرست کالاها ممکن نشد.');
  if(data.database!==true || data.productsIncluded!==true || !Array.isArray(data.products))
   throw new Error('پاسخ سرور کامل نیست؛ فهرست کالاها در حافظه بارگذاری نشد.');
  catalogHydrated=true;
  window.dispatchEvent(new CustomEvent('sanat-durable-hydrated',{detail:data}));
  return data;
 })();
 adminCatalogRefreshInFlight=request;
 void request.finally(()=>{
  if(adminCatalogRefreshInFlight===request)adminCatalogRefreshInFlight=null;
 }).catch(()=>{});
 return request;
}

export const durableStorage={
 getItem(key:string):string|null{if(!enabled&&!ephemeral(key)&&!hydrating)return null;return memory.get(key) ?? (ephemeral(key) || /settings|club_config|stock_v2|layout_configs/.test(key)?null:'[]');},
 /** Unlike legacy getItem, distinguish a truly missing row from an explicit saved [].
  * Read-only; never initializes a PostgreSQL document on a public page render. */
 getExistingItem(key:string):string|null{
  if(!enabled&&!ephemeral(key)&&!hydrating)return null;
  return memory.get(key) ?? null;
 },
 setItem(key:string,value:string){
  // Hydration copies authenticated server data into a volatile rendering cache.
  // Never block that copy on the separate /api/runtime bootstrap; no DB write occurs.
  if(hydrating || ephemeral(key)){memory.set(key,value);return;}
  if(!enabled)throw new Error('پایگاه داده هنوز آماده نیست؛ داده به صورت محلی ذخیره نشد.');
  if(memory.get(key)===value && (!dirtyWrites.has(key) || queues.has(key)))return;
  memory.set(key,value);
  if(portalOwned.has(key) || readOnly.has(key))return;
  const actor=userId;
  dirtyWrites.set(key,value);
  const previous=queues.get(key) || Promise.resolve();
  // A failed write must not permanently poison this key's queue. A later edit
  // gets a fresh attempt while the failed optimistic value remains protected.
  const pending=previous.catch(()=>undefined).then(async()=>{
   emit('saving');
   let res:Response;
   try{
    res=await fetch('/api/runtime',{
     method:'POST',
     credentials:'same-origin',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify({key,value:JSON.parse(value),version:versions.get(key) || 0,userId:actor}),
     signal:AbortSignal.timeout(15000),
    });
   }catch(error){
    if(error instanceof Error && (error.name==='TimeoutError' || error.name==='AbortError'))
     throw new Error('ذخیره تغییرات بیش از ۱۵ ثانیه طول کشید؛ اتصال سرور را بررسی و دوباره تلاش کنید.');
    throw error;
   }
   const data=await res.json().catch(()=>null);
   if(!res.ok || !data?.success)
    throw new Error(data?.message || 'ذخیره در دیتابیس انجام نشد.');
   versions.set(key,Number(data.version));
   if(queues.get(key)===pending)dirtyWrites.delete(key);
   emit('saved');
  }).catch(error=>{
   dirtyWrites.set(key,value);
   emit('error',error instanceof Error?error.message:'ذخیره در دیتابیس انجام نشد.');
   throw error;
  });
  queues.set(key,pending);
  // Remove settled entries so an old rejection cannot block all future reads
  // or writes. The dirty value above remains in memory until a successful retry.
  void pending.finally(()=>{
   if(queues.get(key)===pending)queues.delete(key);
  }).catch(()=>{});
  void pending.catch(()=>{});
 },
 removeItem(key:string){if(ephemeral(key)){memory.delete(key);return;}if(!enabled)return;this.setItem(key,'null');},
};
export async function flushDurableChanges(){
 const pending=[...queues.values()];
 await Promise.all(pending);
}
