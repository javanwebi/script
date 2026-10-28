/** In PostgreSQL mode this is an in-memory view of server data, never a durable browser database. */
let enabled=false,hydrating=false,userId:string|null=null;
const memory=new Map<string,string>(),versions=new Map<string,number>(),queues=new Map<string,Promise<void>>();
let failure:Error|null=null;
const portalOwned=new Set(['atlas_admin_customers_v1','atlas_admin_inquiries_v1','atlas_legacy_customers_v1','atlas_customers_approval_v2','atlas_price_lists_v2','atlas_customer_grades_v2','atlas_club_rewards_v2','atlas_customer_reward_assignments_v1','atlas_price_list_history_v2','atlas_portal_content_banners_v1','atlas_portal_content_announcements_v1','atlas_portal_club_milestones_v1','atlas_portal_layout_configs_v1','atlas_portal_customer_overrides_v1']);
const readOnly=new Set(['hyper_sanat_orders_v2','hyper_sanat_sms_v2','hyper_sanat_stock_v2','hyper_sanat_inquiries_v2']);
const ephemeral=(key:string)=>/auth|credentials|registered_users|mock_inactive|migrated|local_backup|catalog_overrides/.test(key);
export function databaseStorageEnabled(){return enabled;}
export function hydrateMemory(run:()=>void){hydrating=true;try{run();}finally{hydrating=false;}}
function emit(state:string,message=''){window.dispatchEvent(new CustomEvent('atlas-portal-save-status',{detail:{state,message}}));}
export async function refreshDurableStorage(){
 if(enabled)await flushDurableChanges();
 const res=await fetch('/api/runtime',{credentials:'same-origin',cache:'no-store'});if(!res.ok)throw new Error('دریافت اطلاعات از پایگاه داده ممکن نشد.');const data=await res.json();if(!data.success)throw new Error(data.message);enabled=data.database===true;
 if(enabled){for(const key of memory.keys())if(!ephemeral(key))memory.delete(key);versions.clear();userId=data.userId;for(const [key,value] of Object.entries(data.values || {}))memory.set(key,JSON.stringify(value));for(const [key,value] of Object.entries(data.versions || {}))versions.set(key,Number(value));window.dispatchEvent(new CustomEvent('sanat-durable-hydrated',{detail:data}));}
 return data;
}
export const durableStorage={
 getItem(key:string):string|null{if(!enabled&&!ephemeral(key)&&!hydrating)return null;return memory.get(key) ?? (ephemeral(key) || /settings|club_config|stock_v2|layout_configs/.test(key)?null:'[]');},
 setItem(key:string,value:string){
  // Hydration copies authenticated server data into a volatile rendering cache.
  // Never block that copy on the separate /api/runtime bootstrap; no DB write occurs.
  if(hydrating || ephemeral(key)){memory.set(key,value);return;}
  if(!enabled)throw new Error('پایگاه داده هنوز آماده نیست؛ داده به صورت محلی ذخیره نشد.');
  if(memory.get(key)===value)return;
  memory.set(key,value);
  if(portalOwned.has(key) || readOnly.has(key))return;
  const actor=userId;
  const previous=queues.get(key) || Promise.resolve();
  const pending=previous.then(async()=>{emit('saving');const res=await fetch('/api/runtime',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value:JSON.parse(value),version:versions.get(key) || 0,userId:actor})});const data=await res.json();if(!res.ok || !data.success)throw new Error(data.message || 'ذخیره در دیتابیس انجام نشد.');versions.set(key,data.version);emit('saved');}).catch(error=>{failure=error;emit('error',error.message);throw error;});
  queues.set(key,pending);void pending.catch(()=>{});
 },
 removeItem(key:string){if(ephemeral(key)){memory.delete(key);return;}if(!enabled)return;this.setItem(key,'null');},
};
export async function flushDurableChanges(){await Promise.all([...queues.values()]);if(failure)throw failure;}
