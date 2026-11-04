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
  settings: ['view','edit'],
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
  if(key==='atlas_admin_products_v1')return canStaff(identity,'products',write?'edit':'view');
  if(key==='atlas_admin_price_logs_v1')return canStaff(identity,'products',write?'prices':'view');
  if(section==='settings' && key==='hyper_sanat_stock_v2')return canStaff(identity,'products',write?'prices':'view');
  if(section==='settings' && !canStaff(identity,'settings','view'))return false;
  return canStaff(identity,section,write?'edit':'view');
}
export function catalogMutationPermission(path:string):[string,string]{
  if(path.includes('/overrides/bulk'))return ['bulk_import','import'];
  if(path.includes('/category-images/upload') || path.includes('/product-images/upload'))return ['products','images'];
  if(path.includes('/menu-family-assignment') || path.includes('/navigation-groups'))return ['products','categories'];
  if(path.includes('/sku-transfer'))return ['products','sku_move'];
  if(path.includes('/overrides/reset-family') || /^\/overrides\/family\//.test(path))return ['products','delete'];
  if(path.includes('/overrides/family') || path.includes('/direct-skus'))return ['products','edit'];
  return ['__forbidden__','__forbidden__'];
}
