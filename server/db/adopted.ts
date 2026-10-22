import {createHash} from 'node:crypto';
import type {SqlClient} from './connection';
import {adoptedOrders} from './adoptedCheckout';
type Row=Record<string,any>;
const sha=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const camel=(key:string)=>key.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
const safePayload=(user:Row)=>{const {password,passwordHash,passwordSalt,...safe}=user;return safe;};
export const toman=(value:unknown,currency:string)=>Number(value || 0)/(currency==='IRR'?10:1);
const roles:Row={client:'retail',club:'wholesale',agency:'dealer',super_admin:'admin'};
export async function readAdoptedDocument(client:SqlClient,key:string,scope:string){
 if(scope==='global' && key==='atlas_admin_orders_v1')return adoptedOrders(client);
 if(scope==='global' && key==='atlas_admin_club_config_v1'){const row=(await client.query('select * from public.club_configs order by id limit 1')).rows[0];return row?{...row.extra_rules,...Object.fromEntries(Object.entries(row).map(([k,v])=>[camel(k),v])),pointsPer100kTomans:row.points_per_100k_tomans}:undefined;}
 if(scope==='global' && key==='atlas_admin_settings_v1'){const row=(await client.query('select * from public.system_settings order by id limit 1')).rows[0];return row?{...row.raw_settings,paymentGateway:row.payment_gateway,smsProvider:row.sms_provider,shippingMethods:row.shipping_methods,currency:row.currency,seo:row.seo}:undefined;}
 if(key==='catalogue/base')return readAdoptedProducts(client);
 if(key==='catalog_overrides/runtime')return (await client.query("select value from public.portal_kv_store where key='catalog_overrides_db_v1'")).rows[0]?.value;
 // Domain tables are authoritative; a historical compatibility document must never mask table edits.
 const source=scope==='global'?projections[key]:undefined;
 if(source){
  const filter=key==='atlas_admin_banners_v1'?" where scope='storefront'":key==='atlas_portal_content_banners_v1'?" where scope<>'storefront'":key==='atlas_legacy_customers_v1'?' where is_legacy=true':'';
  const archived=(await client.query('select value from public.portal_kv_store where key=$1',['domain_tombstones/'+key])).rows[0]?.value || [];
  const hidden=new Set(Array.isArray(archived)?archived.map(String):[]);
  const data=(await client.query(`select * from public.${source.table}${filter} order by ${source.pk || 'id'}`)).rows.filter(row=>!hidden.has(String(row[source.pk || 'id'])));
  if(source.table==='portal_layout_configs')return Object.fromEntries(data.map(row=>[row.portal_key,row.config]));
  const compatibility=(await client.query('select value from public.portal_kv_store where key=$1',[key])).rows[0]?.value;
  const previous=Array.isArray(compatibility)?compatibility:[];
  // Preserve unknown legacy fields, but known table columns always win; deleted table rows stay absent.
  const pk=source.pk || 'id',property=source.aliases?.[pk] || camel(pk);
  const extras=new Map(previous.map((entry:Row)=>[String(entry[property]),entry]));
  const decoded=data.map(row=>({...extras.get(String(row[pk])),...decode(row,source)}));
  if(source.table==='club_milestones'){
   // A legacy unscoped row is wholesale only. Never copy wholesale rewards into consumer rules.
   const consumer=decoded.filter(row=>row.portal==='consumer'),high_volume=decoded.filter(row=>row.portal!=='consumer');
   return {consumer,high_volume};
  }
  return decoded;
 }
 const row=scope==='global'?(await client.query('select value from public.portal_kv_store where key=$1',[key])).rows[0]:(await client.query('select value from app_private.scoped_documents where namespace=$1 and scope_id=$2',[key,scope])).rows[0];
 return row?.value;
}
type Projection={table:string;pk?:string;aliases?:Record<string,string>;defaults?:Row};
/** Documents preserve the original UI contract; typed tables are updated in the same transaction. */
export const adoptedNamespaces=()=>[...Object.keys(projections),'atlas_admin_club_config_v1','atlas_admin_settings_v1'];
const projections:Record<string,Projection>={
 atlas_admin_customers_v1:{table:'crm_customers',aliases:{company:'companyName',name:'name',grade_code:'tierCode'}},
 atlas_legacy_customers_v1:{table:'crm_customers',aliases:{company:'companyName',grade_code:'tierCode'},defaults:{is_legacy:true}},
 atlas_admin_inquiries_v1:{table:'price_inquiries',aliases:{crm_customer_id:'customerId',quoted_unit_price:'quotedPrice'}},
 hyper_sanat_inquiries_v2:{table:'price_inquiries',aliases:{crm_customer_id:'customerId',quoted_unit_price:'quotedPrice'}},
 atlas_price_lists_v2:{table:'price_lists'},atlas_price_list_history_v2:{table:'price_change_history',aliases:{date_label:'date'}},
 atlas_admin_price_logs_v1:{table:'price_change_history',aliases:{date_label:'date'}},
 atlas_customer_grades_v2:{table:'customer_grade_configs',pk:'grade_code',aliases:{grade_code:'code',min_purchase_volume:'minPurchase'}},
 atlas_club_rewards_v2:{table:'club_rewards'},atlas_customer_reward_assignments_v1:{table:'customer_reward_assignments'},
 atlas_portal_content_banners_v1:{table:'portal_banners',aliases:{image_url:'imageUrl',link_url:'link',scope:'portal'}},
 atlas_admin_banners_v1:{table:'portal_banners',defaults:{scope:'storefront'},aliases:{image_url:'image',link_url:'link'}},
 atlas_portal_content_announcements_v1:{table:'portal_announcements'},atlas_portal_club_milestones_v1:{table:'club_milestones'},
 atlas_portal_layout_configs_v1:{table:'portal_layout_configs',pk:'portal_key',aliases:{portal_key:'portal'}},
 atlas_admin_categories_v1:{table:'catalog_categories',aliases:{image_url:'image',is_active:'active'}},atlas_admin_brands_v1:{table:'catalog_brands',aliases:{logo_url:'logo',is_featured:'featured'}},
 atlas_clients_logos_v3_moshtari:{table:'client_logos',aliases:{logo_url:'logo'}},
 atlas_admin_blog_v1:{table:'blog_posts',aliases:{image_url:'image',published_at:'date'}},
 atlas_admin_pages_v1:{table:'static_pages',aliases:{last_updated:'lastUpdated'}},
 atlas_admin_sms_templates_v1:{table:'sms_templates',aliases:{event_key:'event'}},
 atlas_admin_discounts_v1:{table:'discount_codes'},atlas_admin_campaigns_v1:{table:'marketing_campaigns'},
 atlas_admin_tickets_v1:{table:'support_tickets'},atlas_admin_audit_logs_v1:{table:'audit_logs',aliases:{timestamp_label:'timestamp'}},
 atlas_admin_dealers_v1:{table:'agencies'},atlas_admin_active_agencies_v1:{table:'agencies'},hyper_sanat_approved_dealers_v1:{table:'agencies'},
 hyper_sanat_agency_applications_v1:{table:'agency_applications',aliases:{address:'fullAddress',experience_years:'activityYears',requested_categories:'activityFields',admin_note:'notes'}},
 hyper_sanat_deposit_receipts_v1:{table:'agency_deposit_receipts',aliases:{tracking_code:'trackingNumber',deposit_date:'paymentDate',receipt_image_url:'receiptImage',admin_note:'notes'}},
 hyper_sanat_supply_requests_v1:{table:'agency_supply_requests',aliases:{agency_name:'dealerName',product_code:'requestNumber'}},
 atlas_admin_supply_reqs_v1:{table:'agency_supply_requests'},
 hyper_sanat_dealer_messages_v1:{table:'agency_messages',aliases:{body:'message'}},
 atlas_admin_official_invoices_v1:{table:'official_invoices',aliases:{subtotal_amount:'subtotal',discount_amount:'totalDiscount',tax_amount:'totalTax',total_payable:'grandTotal',issued_date:'issueDate'}},
 atlas_admin_sms_logs_v1:{table:'sms_logs',aliases:{event_key:'template',message_text:'message'}},
 hyper_sanat_sms_logs_v1:{table:'sms_logs',aliases:{event_key:'template',message_text:'message'}},
 hyper_sanat_sms_v2:{table:'sms_logs',aliases:{event_key:'template',message_text:'message'}},
};
function normalizeDigits(val:unknown):string{
 return String(val ?? '').replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)).replace(/[,٬_\s]/g,'');
}
function safeNum(val:unknown,fallback:number|null=0):number|null{
 if(typeof val==='number')return Number.isFinite(val)?val:fallback;
 const m=normalizeDigits(val).match(/[-+]?\d+(?:\.\d+)?/);
 if(!m)return fallback;
 const n=Number(m[0]);
 return Number.isFinite(n)?n:fallback;
}
function safeInt(val:unknown,fallback:number|null=0):number|null{
 const n=safeNum(val,null);
 return n===null?fallback:Math.round(n);
}
function safeBool(val:unknown,fallback=false):boolean{
 if(typeof val==='boolean')return val;
 const s=normalizeDigits(val).toLowerCase();
 if(['true','t','1','yes','y','on','active','فعال'].includes(s))return true;
 if(['false','f','0','no','n','off','inactive','غیرفعال'].includes(s))return false;
 return fallback;
}
function safeTs(val:unknown):string|null{
 if(!val || typeof val!=='string')return null;
 const s=normalizeDigits(val).trim();
 if(!s || /^(13|14)\d{2}[/-]/.test(s))return null;
 const d=Date.parse(s);
 return Number.isNaN(d)?null:new Date(d).toISOString();
}
function decode(row:Row,source:Projection){const result:Row={...(row.raw_payload || {}),...(source.table==='catalog_categories'?row.metadata || {}:{})};for(const [key,value] of Object.entries(row))if(!['raw_payload','created_at','updated_at'].includes(key)){const prop=source.aliases?.[key] || camel(key);if(value!==null || !Object.hasOwn(result,prop))result[prop]=value;}if(source.table==='price_inquiries' && row.status==='quoted' && row.raw_payload?.status==='answered')result.status='answered';if(source.table==='catalog_brands'){result.nameEn=result.nameEn || row.name;result.logo=row.logo_url;result.image=row.logo_url;result.active=true;}if(source.table==='price_lists'){if(row.items && typeof row.items==='object' && Object.keys(row.items).length)result.customProductPrices={...(result.customProductPrices || {}),...row.items};result.active=row.is_active!==false;}if(source.table==='portal_banners'){result.backgroundImage=result.backgroundImage ?? row.image_url;result.ctaLinkOrTab=result.ctaLinkOrTab ?? row.link_url;}return result;}
async function projectDocument(client:SqlClient,key:string,value:unknown){
 if(key==='atlas_admin_club_config_v1' && value && typeof value==='object'){
  const v=value as Row;await client.query('update public.club_configs set points_per_100k_tomans=$1,toman_per_point_redeem=$2,bronze_threshold=$3,silver_threshold=$4,gold_threshold=$5,welcome_gift_points=$6 where id=(select id from public.club_configs order by id limit 1)',[safeInt(v.pointsPer100k_tomans ?? v.pointsPer100kTomans,1),safeNum(v.tomanPerPointRedeem,5000),safeInt(v.bronzeThreshold,0),safeInt(v.silverThreshold,500),safeInt(v.goldThreshold,1200),safeInt(v.welcomeGiftPoints,50)]);return;
 }
 if(key==='atlas_admin_settings_v1' && value && typeof value==='object'){
  const v=value as Row;await client.query('update public.system_settings set payment_gateway=$1,sms_provider=$2,shipping_methods=$3,currency=$4,seo=$5,raw_settings=$6 where id=(select id from public.system_settings order by id limit 1)',[v.paymentGateway || {},v.smsProvider || {},v.shippingMethods || {},v.currency || 'toman',v.seo || {},JSON.stringify(v)]);return;
 }
 const source=projections[key];if(!source)return;
 if(source.table==='club_milestones' && value && typeof value==='object' && !Array.isArray(value))value=Object.entries(value).flatMap(([portal,rows])=>Array.isArray(rows)?rows.map(entry=>({
  ...entry,
  portal,
  id:String(entry.id || entry.code || entry.tierKey).startsWith(portal+':')?String(entry.id || entry.code || entry.tierKey):portal+':'+String(entry.id || entry.code || entry.tierKey)
 })):[]);
 if(source.table==='portal_layout_configs' && value && typeof value==='object' && !Array.isArray(value))value=Object.entries(value).map(([portal,config])=>({portal,config}));
 if(!Array.isArray(value))return;
 const columns=(await client.query("select column_name,data_type from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position",[source.table])).rows;
 const pk=source.pk || 'id';
 const property=source.aliases?.[pk] || camel(pk);
 const incoming=new Set(value.map(entry=>String(entry?.[property] ?? entry?.code ?? entry?.tierKey)));
 const filter=key==='atlas_admin_banners_v1'?" where scope='storefront'":key==='atlas_portal_content_banners_v1'?" where scope<>'storefront'":key==='atlas_legacy_customers_v1'?' where is_legacy=true':'';
 const existing=(await client.query(`select ${pk} from public.${source.table}${filter}`)).rows;
 const previous=(await client.query('select value from public.portal_kv_store where key=$1',['domain_tombstones/'+key])).rows[0]?.value || [];
 const hidden=[...new Set([...(Array.isArray(previous)?previous:[]),...existing.map(row=>String(row[pk]))])].filter(id=>!incoming.has(String(id)));
 // Logical removals preserve original rows and history. New table rows remain discoverable.
 await client.query('insert into public.portal_kv_store(key,value) values($1,$2) on conflict(key) do update set value=excluded.value,updated_at=now()',['domain_tombstones/'+key,JSON.stringify(hidden)]);
 for(const entry of value){
  if(!entry || typeof entry!=='object')throw new Error('Invalid document record');
  const row:Row={...source.defaults};
  for(const column of columns){const name=column.column_name;if(['created_at','updated_at','auth_user_id','user_id'].includes(name))continue;const property=source.aliases?.[name] || camel(name);if(Object.hasOwn(entry,property))row[name]=entry[property];}
  if(source.table==='price_lists'){row.id=String(row.id || entry.id || entry.code);row.name=row.name || entry.adminTitle || entry.code || row.id;row.items=entry.items && typeof entry.items==='object' && Object.keys(entry.items).length?entry.items:(entry.customProductPrices || entry.skuPrices || {});row.is_active=entry.isActive ?? entry.active ?? true;row.discount_percent=safeNum(entry.discountPercent ?? entry.defaultDiscountPercent,0);delete row.created_by;}
  if(source.table==='portal_banners'){row.scope=key==='atlas_admin_banners_v1'?'storefront':(['consumer','high_volume','storefront'].includes(String(entry.portal || ''))?entry.portal:['consumer','high_volume','storefront'].includes(String(entry.scope || ''))?entry.scope:'consumer');row.title=row.title || entry.badgeText || String(entry[property]);row.image_url=String(row.image_url ?? entry.backgroundImage ?? entry.image ?? '');row.link_url=row.link_url ?? entry.ctaLinkOrTab ?? null;}
  if(source.table==='portal_announcements'){row.title=row.title || 'اطلاعیه';row.body=row.body || entry.content || '-';row.portal=['storefront','consumer','high_volume'].includes(String(entry.portal || ''))?entry.portal:'consumer';row.scope=entry.scope || 'collective';row.tag=entry.tag || 'اطلاعیه';}
  if(source.table==='club_milestones'){row.id=String(row.id || entry.id || entry.code || entry.tierKey);row.title=row.title || entry.publicTitle || row.id;row.target_points=safeInt(row.target_points ?? entry.targetPoints ?? entry.minPurchaseVolume ?? entry.discountPercent,0) ?? 0;row.reward_title=row.reward_title || entry.rewardTitle || entry.summaryBenefit || row.title;row.reward_value=row.reward_value ?? (entry.discountPercent!=null?`${entry.discountPercent}%`:null);}
  if(source.table==='catalog_categories'){row.metadata={...(entry.metadata || {}),children:entry.children || [],subcategories:entry.subcategories || [],count:safeInt(entry.count,0)};delete row.parent_id;}
  if(source.table==='agencies'){row.code=String(row.code || entry.agencyCode || entry[property]);row.name=row.name || entry.companyName || String(entry[property]);row.phone=row.phone || '';row.province=row.province || '';row.city=row.city || '';const dup=(await client.query('select id from public.agencies where code=$1 and id<>$2 limit 1',[row.code,String(entry[property])])).rows[0];if(dup)row.code=`${row.code}-${entry[property]}`;}
  if(source.table==='agency_applications'){row.full_name=row.full_name || entry.managerName || entry.companyName || 'متقاضی نمایندگی';row.phone=row.phone || entry.tel || '';row.province=row.province || '';row.city=row.city || '';if(Array.isArray(row.active_brands))row.active_brands=row.active_brands.join(', ');delete row.applicant_user_id;delete row.reviewed_by;}
  if(source.table==='agency_deposit_receipts'){row.dealer_name=row.dealer_name || 'نماینده';row.amount=safeNum(row.amount ?? entry.amount,0);row.tracking_code=String(row.tracking_code || entry.trackingNumber || entry[property]);delete row.agency_id;}
  if(source.table==='agency_supply_requests'){row.agency_name=row.agency_name || entry.dealerName || 'نماینده';row.product_code=String(row.product_code || entry.partCode || entry.requestNumber || entry[property]);row.product_name=row.product_name || entry.partName || 'قطعه صنعتی';row.quantity=Math.max(1,safeInt(row.quantity ?? entry.quantity,1) || 1);delete row.agency_id;}
  if(source.table==='agency_messages'){row.sender=row.sender || entry.senderRole || 'user';row.body=row.body || entry.message || '-';delete row.agency_id;}
  if(source.table==='official_invoices'){row.invoice_number=String(row.invoice_number || entry[property]);const dup=(await client.query('select id from public.official_invoices where invoice_number=$1 and id<>$2 limit 1',[row.invoice_number,String(entry[property])])).rows[0];if(dup)row.invoice_number=`${row.invoice_number}-${entry[property]}`;row.buyer_name=row.buyer_name || entry.buyer?.companyName || entry.buyer?.name || 'خریدار';row.seller_info=row.seller_info || entry.seller || {};delete row.order_id;}
  if(source.table==='sms_logs'){row.recipient_phone=String(row.recipient_phone || entry.phone || entry.to || '');row.message_text=String(row.message_text || entry.message || '');}
  if(source.table==='price_change_history'){row.product_code=String(row.product_code || entry.code || '');row.changed_by=row.changed_by || entry.actor || 'مدیر سیستم';delete row.price_list_id;}
  if(source.table==='price_inquiries'){row.customer_name=row.customer_name || 'مشتری';row.phone=String(row.phone || entry.customerPhone || '');row.product_code=String(row.product_code || entry.partCode || '');row.product_name=row.product_name || entry.partName || '';row.quantity=Math.max(1,safeInt(row.quantity ?? entry.requestedQty,1) || 1);if(row.status==='answered')row.status='quoted';else if(!['pending','reviewing','quoted','approved','rejected','expired','converted_to_order'].includes(String(row.status || '')))row.status='pending';row.admin_reply=row.admin_reply ?? entry.adminNote ?? null;delete row.crm_customer_id;}
  if(source.table==='customer_reward_assignments'){row.reward_title=row.reward_title || 'جایزه باشگاه';delete row.customer_id;delete row.reward_id;}
  if(source.table==='crm_customers'){
   // CRM rows are created and edited by the authenticated admin API. Their
   // business identity and commercial assignment must reach the SQL table,
   // but they must NEVER create an Auth account or accept a password.
   const name=String(entry.name ?? entry.fullName ?? entry.companyName ?? '').trim();
   const phone=String(entry.phone ?? entry.mobile ?? '').trim();
   if(!name || !/^09\\d{9}$/.test(phone))throw new Error('CRM customer requires a valid name and Iranian mobile');
   row.name=name;row.phone=phone;
   if(entry.companyName!==undefined)row.company=String(entry.companyName || '').trim();
   if(entry.tierCode!==undefined || entry.gradeCode!==undefined)row.grade_code=String(entry.tierCode ?? entry.gradeCode ?? '').trim() || null;
   if(entry.assignedPriceListId!==undefined || entry.priceListId!==undefined)row.assigned_price_list_id=String(entry.assignedPriceListId ?? entry.priceListId ?? '').trim() || null;
   if(entry.approvedB2B!==undefined){
    row.approved_b2b=entry.approvedB2B===true;
    row.approval_status=row.approved_b2b?'approved':'pending';
   }
   delete row.auth_user_id;
   delete row.password;delete row.password_hash;delete row.password_salt;
  }
  for(const col of columns){
   const n=col.column_name,dt=col.data_type;
   if(!Object.hasOwn(row,n) || row[n]===undefined)continue;
   if(['integer','bigint','smallint'].includes(dt)){const v=safeInt(row[n],null);if(v===null)delete row[n];else row[n]=v;}
   else if(['numeric','double precision','real'].includes(dt)){let v=safeNum(row[n],null);if(v===null)delete row[n];else{if(['discount_percent','custom_discount_percent','multiplier'].includes(n))v=Math.max(-999.99,Math.min(999.99,v));row[n]=v;}}
   else if(dt==='boolean'){row[n]=safeBool(row[n],false);}
   else if(dt.startsWith('timestamp')){const v=safeTs(row[n]);if(v===null)delete row[n];else row[n]=v;}
   else if(dt==='uuid'){if(typeof row[n]!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row[n]))delete row[n];}
  }
  if(columns.some(c=>c.column_name==='raw_payload')){
   if(source.table==='crm_customers'){
    const {password,passwordHash,passwordSalt,sessionVersion,...safe}=entry;
    row.raw_payload=safe;
   }else row.raw_payload=entry;
  }
  if(row[pk]==null)throw new Error(`Missing ${pk} for ${key}`);
  const names=Object.keys(row);const assignments=names.filter(n=>n!==pk).map(n=>`"${n}"=excluded."${n}"`).join(',');
  // Identifiers originate exclusively in the fixed projection map and database metadata.
  await client.query(`insert into public.${source.table}(${names.map(n=>`"${n}"`).join(',')}) select ${names.map(n=>`"${n}"`).join(',')} from jsonb_populate_record(null::public.${source.table},$1::jsonb) on conflict("${pk}") do ${assignments?'update set '+assignments:'nothing'}`,[JSON.stringify(row)]);
  if(source.table==='crm_customers'){
   // A CRM record is not an authenticated account. Only an already-linked,
   // phone/email verified Supabase identity receives its admin-approved B2B
   // permissions. Never escalate or demote an agency/super-admin role.
   const linked=(await client.query('select auth_user_id,approved_b2b,grade_code,assigned_price_list_id from public.crm_customers where id=$1',[row.id])).rows[0];
   if(linked?.auth_user_id){
    await client.query(`update public.user_profiles set
      approved_b2b=$2,grade_code=$3,assigned_price_list_id=$4,
      role=case when role in ('client','club') then
        (case when $2 then 'club'::public.app_role_type else 'client'::public.app_role_type end)
        else role end,
      updated_at=now()
      where id=$1 and status='active'`,[
      linked.auth_user_id,linked.approved_b2b,linked.grade_code,linked.assigned_price_list_id
    ]);
   }
  }
 }
}
async function projectScopedDocument(client:SqlClient,key:string,value:unknown,scope:string){
 if(!Array.isArray(value))return;
 let authUserId:string|null=null;
 if(scope.startsWith('user:')){
  const rawId=scope.slice(5);
  if(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawId)){
   authUserId=(await client.query('select id from auth.users where id=$1',[rawId])).rows[0]?.id || null;
  }
  if(!authUserId)authUserId=(await client.query('select auth_user_id from app_private.portal_users where id=$1',[rawId])).rows[0]?.auth_user_id || null;
 }
 if(key==='atlas_plant_machinery_passport_v1'){
  for(const entry of value){
   if(!entry || typeof entry!=='object' || !entry.id)continue;
   const rowId=String(entry.id);
   await client.query(`insert into public.plant_machinery_passports(id,user_id,machine_name,line_name,manufacturer,model_year,serial_number,installed_parts,notes,raw_payload) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(id) do update set user_id=coalesce(excluded.user_id,plant_machinery_passports.user_id),machine_name=excluded.machine_name,line_name=excluded.line_name,manufacturer=excluded.manufacturer,model_year=excluded.model_year,serial_number=excluded.serial_number,installed_parts=excluded.installed_parts,notes=excluded.notes,raw_payload=excluded.raw_payload,updated_at=now()`,[rowId,authUserId,entry.machineName || entry.name || 'دستگاه صنعتی',entry.lineName || entry.section || null,entry.manufacturer || null,entry.modelYear || entry.installedYear || null,entry.serialNumber || entry.modelNumber || null,JSON.stringify(entry.installedParts || entry.parts || []),entry.notes || null,JSON.stringify(entry)]);
  }
 }else if(key==='forza_industrial_chat_sessions_v2'){
  for(const entry of value){
   if(!entry || typeof entry!=='object' || !entry.id)continue;
   const rowId=String(entry.id);
   await client.query(`insert into public.industrial_chat_sessions(id,user_id,customer_name,status,messages,raw_payload) values($1,$2,$3,$4,$5,$6) on conflict(id) do update set user_id=coalesce(excluded.user_id,industrial_chat_sessions.user_id),customer_name=excluded.customer_name,status=excluded.status,messages=excluded.messages,raw_payload=excluded.raw_payload,last_updated=now()`,[rowId,authUserId,entry.customerName || entry.title || null,entry.status || 'active',JSON.stringify(entry.messages || []),JSON.stringify(entry)]);
  }
 }else if(authUserId && (key==='hyper_sanat_cart_v2' || key==='hyper_sanat_saved_v2' || key.startsWith('hyper_sanat_wishlist_v1:'))){
  const colType=key==='hyper_sanat_cart_v2'?'cart':key==='hyper_sanat_saved_v2'?'saved':'wishlist';
  await client.query('insert into public.user_saved_collections(user_id,collection_type,items) values($1,$2,$3) on conflict(user_id,collection_type) do update set items=excluded.items,updated_at=now()',[authUserId,colType,JSON.stringify(value)]);
 }
}
export async function writeAdoptedDocument(client:SqlClient,key:string,value:unknown,scope:string){
 await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[scope+':'+key]);
 const digest=sha(value),old=(await client.query('select content_sha256 from app_private.document_versions where namespace=$1 and scope_id=$2 for update',[key,scope])).rows[0];if(old?.content_sha256===digest)return;
 const previous=await readAdoptedDocument(client,key,scope);
 if(previous!==undefined && sha(previous)===digest){await client.query('update app_private.document_versions set content_sha256=$3 where namespace=$1 and scope_id=$2',[key,scope,digest]);return;}
 if(previous!==undefined)await client.query('insert into app_private.source_archives(source_path,sha256,payload) values($1,$2,$3) on conflict do nothing',[`history/${scope}/${key}`,sha(previous),JSON.stringify(previous)]);
 if(scope==='global'){
  if(key==='atlas_admin_orders_v1'){
   if(!Array.isArray(value))throw new Error('Invalid orders document');
   for(const order of value){const status=({registered:'pending',processing:'confirmed',shipped:'shipped',delivered:'delivered',cancelled:'cancelled'} as Row)[order.status];if(!status)throw new Error('Invalid order status');
    const existing=(await client.query('select status from public.orders where id=$1 for update',[order.id])).rows[0];if(!existing)throw new Error('Orders must be created through authoritative checkout');
    if(existing.status!==status){await client.query('update public.orders set status=$2,carrier=$3,tracking_number=$4 where id=$1',[order.id,status,order.carrier || null,order.trackingNumber || null]);await client.query('insert into public.order_status_events(order_id,from_status,to_status,note) values($1,$2,$3,$4)',[order.id,existing.status,status,'Administrator status change']);}
   }
  }
  await projectDocument(client,key,value);
  await client.query('insert into public.portal_kv_store(key,value) values($1,$2) on conflict(key) do update set value=excluded.value,updated_at=now()',[key,JSON.stringify(value)]);
 }else{
  await projectScopedDocument(client,key,value,scope);
  await client.query('insert into app_private.scoped_documents(namespace,scope_id,value) values($1,$2,$3) on conflict(namespace,scope_id) do update set value=excluded.value',[key,scope,JSON.stringify(value)]);
 }
 const kind=Array.isArray(value)?'array':value && typeof value==='object'?'object':'scalar';
 await client.query('insert into app_private.document_versions(namespace,scope_id,version,value_kind,content_sha256) values($1,$2,1,$3,$4) on conflict(namespace,scope_id) do update set version=document_versions.version+1,value_kind=excluded.value_kind,content_sha256=excluded.content_sha256,updated_at=now()',[key,scope,kind,digest]);
}
export async function adoptedUsers(client:SqlClient){
 const drafts=(await client.query('select id,payload,auth_user_id,active from app_private.portal_users')).rows;
 const profiles=(await client.query('select * from public.user_profiles')).rows;
 const addresses=(await client.query('select * from public.user_addresses where active')).rows;
 return profiles.map(p=>{const draft=drafts.find(d=>d.auth_user_id===p.id || d.id===p.legacy_user_id);return {...(draft?.payload || {}),...(p.preferences || {}),addresses:addresses.filter(a=>a.user_id===p.id).map(a=>({id:a.legacy_id || a.id,title:a.title,province:a.province,city:a.city,fullAddress:a.full_address,postalCode:a.postal_code,recipientName:a.recipient_name,recipientPhone:a.recipient_phone})),id:draft?.id || p.legacy_user_id || p.id,authUserId:p.id,phone:p.phone?.replace(/^\+98/,'0'),email:p.email,username:p.username,fullName:p.full_name,companyName:p.company_name,role:roles[p.role] || 'guest',active:p.status==='active' && draft?.active!==false,approvedB2B:p.approved_b2b,canViewPrices:p.can_view_prices,canViewStock:p.can_view_stock,creditLimit:Number(p.credit_limit),creditUsed:Number(p.credit_used),walletBalance:Number(p.wallet_balance),clubPoints:p.club_points};});
}
export async function persistAdoptedUsers(client:SqlClient,users:Row[]){
 // No missing user is deleted or deactivated by a stale whole-document save.
 for(const user of users){
  const safe=safePayload(user);
  if(!user.authUserId)await client.query('insert into app_private.portal_users(id,auth_user_id,payload) values($1,$2,$3) on conflict(id) do update set auth_user_id=coalesce(excluded.auth_user_id,portal_users.auth_user_id),payload=excluded.payload',[user.id,user.authUserId || null,JSON.stringify(safe)]);
  if(!user.authUserId)continue;
  // Never derive role, approval, finance or grade from the compatibility payload.
  await client.query('update public.user_profiles set username=$2,full_name=$3,company_name=$4,province=$5,city=$6,preferences=preferences || $7::jsonb where id=$1',[user.authUserId,user.username || null,user.fullName || '',user.companyName || '',user.province || null,user.city || null,JSON.stringify({onboardingCompleted:user.onboardingCompleted===true,activityField:user.activityField || '',firstName:user.firstName || '',lastName:user.lastName || '',provinceId:user.provinceId || '',cityId:user.cityId || '',favoriteBrands:user.favoriteBrands || [],businessType:user.businessType || ''})]);
  for(const a of user.addresses || [])await client.query('insert into public.user_addresses(user_id,legacy_id,title,province,city,full_address,postal_code,recipient_name,recipient_phone) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(user_id,legacy_id) do update set title=excluded.title,province=excluded.province,city=excluded.city,full_address=excluded.full_address,postal_code=excluded.postal_code,recipient_name=excluded.recipient_name,recipient_phone=excluded.recipient_phone,active=true',[user.authUserId,a.id,a.title || '',a.province || '',a.city || '',a.fullAddress || '',a.postalCode || '',a.recipientName || '',a.recipientPhone || '']);
 }
}
export async function readAdoptedProducts(client:SqlClient){
 const families=(await client.query('select * from public.catalog_families where is_active and not is_deleted order by code')).rows;
 const variants=(await client.query('select v.*,c.price,c.base_price,c.retail_price,c.wholesale_price,c.dealer_price,c.stock,c.stock_reserved,c.stock_known,c.inquiry_only,c.currency from public.catalog_variants v left join public.variant_commercial_specs c on c.variant_code=v.code where v.active order by v.sort_order,v.code')).rows;
 const images=(await client.query('select * from public.catalog_gallery_images order by sort_order,id')).rows;
 const byFamily=new Map<string,Row[]>(),gallery=new Map<string,Row[]>();
 for(const v of variants){const prices={base:toman(v.base_price,v.currency),retail:toman(v.retail_price || v.price,v.currency),wholesale:toman(v.wholesale_price,v.currency),dealer:toman(v.dealer_price,v.currency)};const dto={...v.runtime_payload,code:v.code,name:v.name,size:v.size || '',model:v.model,brand:v.brand,unit:v.unit,active:v.active,images:v.images,technicalSpecs:v.technical_specs,technicalReview:v.technical_review,prices,price:prices.retail,stock:Math.max(0,Number(v.stock || 0)-Number(v.stock_reserved || 0)),stockKnown:v.stock_known===true,inquiryOnly:v.inquiry_only!==false};const list=byFamily.get(v.family_code) || [];list.push(dto);byFamily.set(v.family_code,list);}
 for(const i of images){const list=gallery.get(i.family_code) || [];list.push({id:i.id,url:i.url,fileName:i.file_name,scope:i.scope,variantCode:i.variant_code,identityVerified:i.identity_verified===true,title:i.title,order:i.sort_order});gallery.set(i.family_code,list);}
 return families.map(f=>{const vs=byFamily.get(f.code) || [],first=vs[0];return {...f.runtime_payload,code:f.code,name:f.name,brand:f.brand,categorySlug:f.category_slug,categoryName:f.category_name,subcategory:f.subcategory || '',submenu:f.submenu,unit:f.unit,description:f.description,sourceRow:f.source_row,active:f.is_active,images:f.images,technicalSpecs:f.technical_specs,tags:f.tags,hasCatalogueImage:f.has_catalogue_image,imageScope:f.image_scope,galleryImages:gallery.get(f.code) || [],variants:vs,prices:first?.prices || {base:0,retail:0,wholesale:0,dealer:0},stock:vs.reduce((n,v)=>n+v.stock,0),stockKnown:vs.length>0 && vs.every(v=>v.stockKnown),inquiryOnly:!vs.length || vs.every(v=>v.inquiryOnly)};});
}
export async function saveAdoptedProducts(client:SqlClient,products:Row[]){
 const skus=new Set<string>();for(const p of products)for(const v of p.variants || []){if(skus.has(v.code))throw new Error('Duplicate inventory SKU');skus.add(v.code);}
 for(const p of products){
  await client.query(`insert into public.catalog_families(code,name,brand,category_slug,category_name,subcategory,submenu,unit,description,images,technical_specs,tags,is_active) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) on conflict(code) do update set name=excluded.name,brand=excluded.brand,category_slug=excluded.category_slug,category_name=excluded.category_name,subcategory=excluded.subcategory,submenu=excluded.submenu,unit=excluded.unit,description=excluded.description,images=excluded.images,technical_specs=excluded.technical_specs,tags=excluded.tags,is_active=excluded.is_active`,[p.code,p.name,p.brand || '',p.categorySlug || '',p.categoryName || '',p.subcategory || '',p.submenu || null,p.unit || 'عدد',p.description || '',JSON.stringify(p.images || []),JSON.stringify(p.technicalSpecs || []),JSON.stringify(p.tags || []),p.active!==false]);
  for(const v of p.variants || []){
   await client.query(`insert into public.catalog_variants(code,family_code,name,size,model,brand,unit,images,technical_specs,technical_review,active) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict(code) do update set family_code=excluded.family_code,name=excluded.name,size=excluded.size,model=excluded.model,brand=excluded.brand,unit=excluded.unit,images=excluded.images,technical_specs=excluded.technical_specs,technical_review=excluded.technical_review,active=excluded.active`,[v.code,p.code,v.name || p.name,v.size || '',v.model || '',v.brand || p.brand || '',v.unit || p.unit || 'عدد',JSON.stringify(v.images || []),JSON.stringify(v.technicalSpecs || []),JSON.stringify(v.technicalReview || {}),v.active!==false]);
   // Metadata edits do not reset inventory, reservations, prices, or source currency.
   await client.query('insert into public.variant_commercial_specs(variant_code,family_code) values($1,$2) on conflict(variant_code) do update set family_code=excluded.family_code',[v.code,p.code]);
  }
  for(const [position,image] of (p.galleryImages || []).entries())await client.query(`insert into public.catalog_gallery_images(id,family_code,variant_code,url,scope,title,sort_order,identity_verified) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(id) do update set variant_code=excluded.variant_code,url=excluded.url,scope=excluded.scope,title=excluded.title,sort_order=excluded.sort_order,identity_verified=excluded.identity_verified`,[image.id || sha([p.code,image.url,image.variantCode]),p.code,image.variantCode || null,image.url,image.scope || 'family',image.title || '',position,image.identityVerified===true]);
 }
}
