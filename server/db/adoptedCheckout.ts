import crypto from 'node:crypto';
import type {SqlClient} from './connection';
import {toman} from './adopted';
type Row=Record<string,any>;
const invalid=(message:string,status=400)=>Object.assign(new Error(message),{status});
export function orderDto(row:Row){const data=row.metadata || {};const currency=row.currency;return {...data,id:row.id,customerId:data.customerId || row.user_id,customerName:row.customer_name,companyName:row.company,items:row.items_json,totalAmount:toman(row.total_amount,currency),discountAmount:toman(row.discount_amount,currency),shippingCost:toman(row.shipping_amount,currency),finalAmount:toman(row.final_amount,currency),status:({pending:'registered',confirmed:'processing',packing:'processing'} as Row)[row.status] || row.status,paymentStatus:row.payment_status==='paid'?'paid':row.payment_status==='refunded'?'refunded':row.payment_method==='online'?'awaiting_payment':'pending_review',paymentMethod:row.payment_method==='receipt'?'transfer':row.payment_method,shippingAddress:row.shipping_address,createdAt:row.created_at};}
export async function adoptedOrders(client:SqlClient,authId?:string){const rows=(await client.query(`select * from public.orders ${authId?'where user_id=$1':''} order by created_at desc`,authId?[authId]:[])).rows;return rows.map(orderDto);}
/** Existing UI amounts are toman. Stored source amounts remain in their declared currency. */
export async function createAdoptedOrder(client:SqlClient,profile:Row,input:Row){
 const authId=profile.authUserId;if(!authId)throw invalid('حساب باید به Supabase Auth متصل باشد.',403);
 const key=String(input.requestKey || '');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))throw invalid('شناسه درخواست معتبر نیست.');
 if(!Array.isArray(input.items)||!input.items.length||input.items.length>200)throw invalid('سبد خرید معتبر نیست.');
 const items=input.items.map((i:Row)=>({code:String(i.code),quantity:Number(i.quantity)})).sort((a:Row,b:Row)=>a.code.localeCompare(b.code));
 if(items.some((i:Row)=>!Number.isSafeInteger(i.quantity)||i.quantity<1)||new Set(items.map((i:Row)=>i.code)).size!==items.length)throw invalid('تعداد کالا معتبر نیست.');
 if(!['online','transfer','credit'].includes(input.paymentMethod))throw invalid('روش پرداخت معتبر نیست.');
 // Shipping tariff is kept server-side, in toman, matching the current checkout UI.
 const shipping:Row={freight:{name:'باربری صنعتی (پس‌کرایه به مقصد)',cost:0},tipax:{name:'تیپاکس اکسپرس (درب به درب)',cost:85000},post:{name:'پست پیشتاز سفارشی',cost:55000}};
 const method=shipping[input.shippingId];if(!method)throw invalid('روش ارسال معتبر نیست.');
 const digest=crypto.createHash('sha256').update(JSON.stringify({items,addressId:input.addressId,shippingId:input.shippingId,paymentMethod:input.paymentMethod})).digest('hex');
 await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['checkout:'+authId]);
 const old=(await client.query('select * from public.checkout_requests where user_id=$1 and request_key=$2',[authId,key])).rows[0];
 if(old){if(old.request_sha256!==digest)throw invalid('این درخواست قبلاً با اطلاعات دیگری ثبت شده است.',409);return orderDto((await client.query('select * from public.orders where id=$1 and user_id=$2',[old.order_id,authId])).rows[0]);}
 const owner=(await client.query("select * from public.user_profiles where id=$1 and status='active'",[authId])).rows[0];if(!owner?.can_view_prices || !owner?.can_view_stock)throw invalid('قیمت و موجودی برای این حساب فعال نیست.',403);
 const address=(await client.query('select * from public.user_addresses where user_id=$1 and (legacy_id=$2 or id::text=$2) and active',[authId,String(input.addressId)])).rows[0];if(!address)throw invalid('نشانی معتبر و متعلق به حساب شما انتخاب کنید.');
 await client.query("select set_config('request.jwt.claim.sub',$1,true)",[authId]);
 const orderItems=[];for(const item of items){const row=(await client.query(`select v.*,f.name as family_name,f.brand as family_brand,c.currency,c.stock,c.stock_reserved,c.stock_known,c.inquiry_only,app_private.current_variant_price(v.code) as amount from public.catalog_variants v join public.catalog_families f on f.code=v.family_code join public.variant_commercial_specs c on c.variant_code=v.code where v.code=$1 and v.active and f.is_active and not f.is_deleted for update of c`,[item.code])).rows[0];
  if(!row || !row.stock_known || row.inquiry_only || Number(row.stock)-Number(row.stock_reserved)<item.quantity || !(Number(row.amount)>0))throw invalid(`کالای ${item.code} نیاز به استعلام قیمت یا موجودی دارد.`,409);
  const amount=toman(row.amount,row.currency);orderItems.push({productCode:item.code,productName:row.name,brand:row.brand || row.family_brand,unit:row.unit,quantity:item.quantity,unitPrice:amount,totalPrice:amount*item.quantity,priceLayerUsed:'retail',image:row.images?.[0] || ''});
 }
 const id=crypto.randomUUID(),total=orderItems.reduce((sum,i)=>sum+i.totalPrice,0);
 const metadata={orderNumber:'SP-'+id.slice(0,8).toUpperCase(),customerId:profile.id,role:profile.role,shippingMethod:method.name,recipientName:address.recipient_name,recipientPhone:address.recipient_phone,timeline:[{status:'registered',label:'ثبت سفارش',description:'در انتظار تأیید و پرداخت',completed:true,current:true}]};
 await client.query(`insert into public.orders(id,user_id,customer_name,company,phone,total_amount,final_amount,shipping_amount,currency,payment_method,payment_status,shipping_address,items_json,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,'IRT',$9,'pending_review',$10,$11,$12)`,[id,authId,owner.full_name,owner.company_name,owner.phone || '',total,total+method.cost,method.cost,input.paymentMethod==='transfer'?'receipt':input.paymentMethod,`${address.province}، ${address.city}، ${address.full_address}`,JSON.stringify(orderItems),JSON.stringify(metadata)]);
 for(const i of orderItems)await client.query('insert into public.order_items(order_id,product_code,product_name,quantity,unit_price,total_price) values($1,$2,$3,$4,$5,$6)',[id,i.productCode,i.productName,i.quantity,i.unitPrice,i.totalPrice]);
 await client.query("select app_private.reserve_order_stock($1,now()+interval '30 minutes')",[id]);
 if(input.paymentMethod==='credit')await client.query("select app_private.hold_order_credit($1,$2,now()+interval '30 minutes')",[authId,id]);
 await client.query('insert into public.checkout_requests(user_id,request_key,order_id,request_sha256) values($1,$2,$3,$4)',[authId,key,id,digest]);
 await client.query("insert into app_private.document_versions(namespace,scope_id,version,value_kind) values('atlas_admin_orders_v1','global',1,'array') on conflict(namespace,scope_id) do update set version=document_versions.version+1,updated_at=now()");
 return orderDto((await client.query('select * from public.orders where id=$1',[id])).rows[0]);
}
