/** Server-owned, fail-closed administrator and employee permission rules. */
export const STAFF_SECTIONS = {
  dashboard: ['view'],
  products: ['view','create','edit','delete','images','categories','sku_move','prices'],
  bulk_import: ['view','import'],
  announcements: ['view','create','edit','delete'],
  content_studio: ['view','create','edit','delete'],
  crm: ['view','create','edit','delete'],
  customer_grading: ['view','edit'],
  agencies: ['view','edit'],
  inquiries: ['view','create','edit'],
  orders: ['view','edit'],
  clients: ['view','create','edit','delete'],
  reports: ['view'],

} as const;
export type StaffPermissions = Record<string,string[]>;
export type StaffIdentity = {admin?:boolean;staff?:boolean;permissions?:StaffPermissions};
const entries=Object.entries(STAFF_SECTIONS) as [string,readonly string[]][];
const allowed=new Map(entries);
export function sanitizeStaffPermissions(raw:unknown):StaffPermissions{
  if(!raw || typeof raw!=='object' || Array.isArray(raw))return {};
  const result:StaffPermissions={};
  for(const [section,actions] of Object.entries(raw)){
    const valid=allowed.get(section);
    if(!valid || !Array.isArray(actions))continue;
    const selected=[...new Set(actions.filter((item):item is string=>typeof item==='string' && valid.includes(item)))];
    if(!selected.includes('view'))continue;
    result[section]=selected;
  }
  return result;
}
export function canStaff(identity:StaffIdentity,section:string,action='view'):boolean{
  if(identity.admin===true)return true;
  if(identity.staff!==true)return false;
  const actions=identity.permissions?.[section];
  return Array.isArray(actions) && actions.includes('view') && actions.includes(action);
}
const namespaceSections:Record<string,string>={
  catalog_overrides:'products',categories:'products',brands:'products',
  inquiries:'inquiries',orders:'orders',customers:'crm',tickets:'crm',
  price_lists:'customer_grading',grades:'customer_grading',
  rewards:'customer_grading',reward_assignments:'customer_grading',price_history:'customer_grading',
  dealers:'agencies',applications:'agencies',
  banners:'content_studio',articles:'content_studio',pages:'content_studio',
  campaigns:'content_studio',announcements:'announcements',client_logos:'clients',
  settings:'settings',audit:'settings',sms_templates:'settings',sms_logs:'settings',
  layouts:'settings',discounts:'settings',milestones:'settings',
  invoices:'orders',receipts:'orders',supply:'orders',messages:'orders',
};
export function namespacePermission(identity:StaffIdentity,domain:string,write=false,key=''):boolean{
  if(identity.admin===true)return true;
  if(identity.staff!==true)return false;
  // Customer private state is never a shared admin staff namespace.
  if(!domain || domain==='customer_state' || domain==='customer_overrides' || domain==='reference')return false;
  const section=namespaceSections[domain];
  if(!section)return false;
  // Full override documents can contain prices, stock and other confidential commercial data.
  // Staff without commercial permission must use dedicated, scoped catalog API operations.
  if(domain==='catalog_overrides' && !canStaff(identity,'products','prices'))return false;
  if(key==='atlas_admin_products_v1')return canStaff(identity,'products',write?'edit':'view');
  if(key==='atlas_admin_price_logs_v1')return canStaff(identity,'products','prices');
  if(section==='settings' && key==='hyper_sanat_stock_v2')return canStaff(identity,'products','prices');
  // Credentials, payment gateways and system backups are super-admin-only.
  if(section==='settings')return false;
  if(!write)return canStaff(identity,section,'view');
  return canStaff(identity,section,'edit')||canStaff(identity,section,'create')||canStaff(identity,section,'delete');
}
export function catalogMutationPermission(path:string):[string,string]{
  if(path.includes('/overrides/bulk'))return ['bulk_import','import'];
  if(path.includes('/category-images/upload') || path.includes('/product-images/upload'))return ['products','images'];
  if(path.includes('/menu-family-assignment') || path.includes('/navigation-groups'))return ['products','categories'];
  if(path.includes('/sku-transfer'))return ['products','sku_move'];
  if(path.includes('/overrides/reset-family') || path.includes('/overrides/family/'))return ['products','delete'];
  if(path.includes('/overrides/family') || path.includes('/direct-skus'))return ['products','edit'];
  return ['__forbidden__','__forbidden__'];
}

/** Verify mutations against the actual previous database document, not browser flags.
 * Append-only, edit-only and delete-only users cannot exchange their privileges. */
export function assertStaffDocumentChange(identity:StaffIdentity,domain:string,key:string,before:unknown,after:unknown):void{
 if(identity.admin===true)return;
 const section=namespaceSections[domain];
 if(!section || !namespacePermission(identity,domain,true,key))throw forbidden();
 if(section==='products' && domain==='catalog_overrides' && !canStaff(identity,'products','prices'))throw forbidden();
 if(section==='customer_grading' || section==='agencies' || section==='orders' ||
    section==='settings' || section==='products'){
   if(!canStaff(identity,section,'edit'))throw forbidden();
   return;
 }
 if(!Array.isArray(before) && !Array.isArray(after)){
   if(JSON.stringify(before)!==JSON.stringify(after) && !canStaff(identity,section,'edit'))throw forbidden();
   return;
 }
 if(!Array.isArray(after))throw forbidden();
 const old=Array.isArray(before)?before:[];
 const identifiable=(items:unknown[])=>{
   const result=new Map<string,unknown>();
   for(const item of items){
     if(!item || typeof item!=='object' || Array.isArray(item))throw forbidden();
     const row=item as Record<string,unknown>;
     const id=['id','code','slug','phone','key'].map(key=>row[key]).find(x=>typeof x==='string' && x.length>0);
     if(typeof id!=='string' || result.has(id))throw forbidden();
     result.set(id,item);
   }
   return result;
 };
 const previous=identifiable(old),next=identifiable(after);
 for(const [id,value] of next){
   if(!previous.has(id)){
     if(!canStaff(identity,section,'create'))throw forbidden();
   }else if(JSON.stringify(previous.get(id))!==JSON.stringify(value) && !canStaff(identity,section,'edit'))throw forbidden();
 }
 for(const id of previous.keys())if(!next.has(id) && !canStaff(identity,section,'delete'))throw forbidden();
}
function forbidden():Error & {status:number}{
 return Object.assign(new Error('اجازه افزودن، ویرایش یا حذف این اطلاعات را ندارید.'),{status:403});
}

/** Prevent a catalogue editor from smuggling stock/price changes through whole-family JSON. */
export function assertStaffCommercialFields(identity:StaffIdentity,existing:unknown,incoming:unknown){
 if(identity.admin || canStaff(identity,'products','prices'))return;
 const sensitive=/^(prices?|(?:base|retail|wholesale|dealer|unit)_?price|stock|inquiry_?only|currency|cost|discount|credit|commercial)/i;
 const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
 const walk=(from:unknown,to:unknown):void=>{
  if(!to || typeof to!=='object')return;
  if(Array.isArray(to)){
   const before=Array.isArray(from)?from:[];
   for(let i=0;i<to.length;i++){
    const value=to[i];
    const code=value && typeof value==='object' && !Array.isArray(value) ? (value as any).code : undefined;
    const previous=code ? before.find(item=>item && typeof item==='object' && (item as any).code===code):before[i];
    walk(previous,value);
   }
   return;
  }
  const previous=from && typeof from==='object' && !Array.isArray(from)?from as Record<string,unknown>:{};
  for(const [key,value] of Object.entries(to)){
   const old=previous[key];
   if(sensitive.test(key)){
    const blank=(v:unknown):boolean=>v==null || v==='' || v===false || v===0 ||
       (Array.isArray(v) && v.every(blank)) || (typeof v==='object' && Object.values(v as Record<string,unknown>).every(blank));
    const absent=old===undefined && (blank(value) || (key.toLowerCase().replace('_','')==='inquiryonly' && value===true));
    if(!same(old,value) && !absent && !(old!==undefined && blank(value)))throw forbidden();
   }else walk(old,value);
  }
 };
 walk(existing,incoming);
}

/** Merge confidential commercial fields on the server so a price-blind editor
 * cannot accidentally zero prices or stock when saving metadata from a redacted catalogue. */
export function preserveStaffCommercialFields(identity:StaffIdentity,existing:unknown,incoming:unknown):unknown{
 if(identity.admin || canStaff(identity,'products','prices'))return incoming;
 const sensitive=/^(prices?|(?:base|retail|wholesale|dealer|unit)_?price|stock|inquiry_?only|currency|cost|discount|credit|commercial)/i;
 const merge=(before:unknown,after:unknown):unknown=>{
  if(Array.isArray(after)){
   const old=Array.isArray(before)?before:[];
   return after.map((entry,index)=>{
    const code=entry && typeof entry==='object' && !Array.isArray(entry) ? (entry as any).code:undefined;
    const previous=code ? old.find(item=>item && typeof item==='object' && (item as any).code===code):old[index];
    return merge(previous,entry);
   });
  }
  if(!after || typeof after!=='object')return after;
  const source=before && typeof before==='object' && !Array.isArray(before) ? before as Record<string,unknown>:{};
  const result:Record<string,unknown>={};
  for(const [key,value] of Object.entries(after)){
   if(sensitive.test(key)){
    result[key]=source[key]!==undefined ? structuredClone(source[key]):value;
   }else result[key]=merge(source[key],value);
  }
  for(const [key,value] of Object.entries(source))if(sensitive.test(key) && !(key in result))
    result[key]=structuredClone(value);
  return result;
 };
 return merge(existing,incoming);
}
