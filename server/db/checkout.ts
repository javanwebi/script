import crypto from 'node:crypto';
import type {Request,Response} from 'express';
import {databaseEnabled,transaction,adoptedSchema,type SqlClient} from './connection';
import {createAdoptedOrder} from './adoptedCheckout';
import {getPortalIdentity} from '../../api/portal';
import {readDocument,writeDocument} from './repository';
const invalid=(message:string,status=400)=>Object.assign(new Error(message),{status});
/** Pending order only. No browser callback can confirm payment or grant points. */
export async function createOrder(client:SqlClient,profile:any,input:any){
 if(adoptedSchema())return createAdoptedOrder(client,profile,input);
 const key=String(input.requestKey || '');if(!/^[0-9a-f-]{36}$/i.test(key))throw invalid('شناسه درخواست معتبر نیست.');
 if(!Array.isArray(input.items)||!input.items.length||input.items.length>200)throw invalid('سبد خرید معتبر نیست.');
 const items=input.items.map((i:any)=>({code:String(i.code),quantity:Number(i.quantity)})).sort((a:any,b:any)=>a.code.localeCompare(b.code));
 if(items.some((i:any)=>!Number.isSafeInteger(i.quantity)||i.quantity<1)||new Set(items.map((i:any)=>i.code)).size!==items.length)throw invalid('تعداد کالا معتبر نیست.');
 if(!['online','transfer','credit'].includes(input.paymentMethod))throw invalid('روش پرداخت معتبر نیست.');
 const shipping:any={freight:{name:'باربری صنعتی (پس‌کرایه به مقصد)',cost:0},tipax:{name:'تیپاکس اکسپرس (درب به درب)',cost:85000},post:{name:'پست پیشتاز سفارشی',cost:55000}};
 const method=shipping[input.shippingId];if(!method)throw invalid('روش ارسال معتبر نیست.');
 const digest=crypto.createHash('sha256').update(JSON.stringify({items,addressId:input.addressId,shippingId:input.shippingId,paymentMethod:input.paymentMethod})).digest('hex');
 await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['checkout:'+profile.id]);
 const old=(await client.query('select * from app_private.checkout_requests where profile_id=$1 and request_key=$2',[profile.id,key])).rows[0];
 if(old){if(old.request_hash!==digest)throw invalid('این درخواست قبلاً با اطلاعات دیگری ثبت شده است.',409);return (await client.query('select payload from public.orders where entry_key=$1 and owner_id=$2',[old.order_id,profile.id])).rows[0].payload;}
 const address=(await client.query('select payload from public.addresses where id=$1 and profile_id=$2 and active',[`${profile.id}:${input.addressId}`,profile.id])).rows[0]?.payload;if(!address)throw invalid('نشانی معتبر و متعلق به حساب شما انتخاب کنید.');
 const orderItems=[];for(const item of items){const row=(await client.query(`select v.payload,f.name,f.payload as family,s.quantity,s.reserved,s.known,p.amount from public.product_variants v join public.product_families f on f.code=v.family_code join public.inventory_balances s on s.variant_code=v.code left join public.sku_prices p on p.variant_code=v.code and p.price_list_code='retail' where v.code=$1 and v.active and f.active for update of s`,[item.code])).rows[0];
  if(!row || !row.known || Number(row.quantity)-Number(row.reserved)<item.quantity || !(Number(row.amount)>0))throw invalid(`کالای ${item.code} نیاز به استعلام قیمت یا موجودی دارد.`,409);
  orderItems.push({productCode:item.code,productName:row.name,brand:row.family.brand || '',unit:row.family.unit || 'عدد',quantity:item.quantity,unitPrice:Number(row.amount),priceLayerUsed:'retail',totalPrice:Number(row.amount)*item.quantity,image:row.payload.image || row.family.images?.[0] || ''});
 }
 // Customer pricing, club credits and bank confirmation need an authoritative settlement adapter.
 // Preserve the request for review rather than accepting client-calculated financial values.
 const id=crypto.randomUUID(),total=orderItems.reduce((sum,i)=>sum+i.totalPrice,0);
 const order={id,orderNumber:'SP-'+id.slice(0,8).toUpperCase(),customerId:profile.id,customerName:profile.fullName,companyName:profile.companyName,role:profile.role,items:orderItems,totalAmount:total,discountAmount:0,shippingCost:method.cost,shippingMethod:method.name,paymentMethod:input.paymentMethod,paymentStatus:input.paymentMethod==='online'?'awaiting_payment':'pending_review',finalAmount:total+method.cost,status:'registered',createdAt:new Date().toISOString(),shippingAddress:`${address.province}، ${address.city}، ${address.fullAddress}`,recipientName:address.recipientName,recipientPhone:address.recipientPhone,timeline:[{status:'registered',label:'ثبت سفارش',description:'در انتظار تأیید قیمت نهایی و پرداخت',completed:true,current:true}]};
 const orders=await readDocument(client,'atlas_admin_orders_v1') || [];
 await writeDocument(client,'atlas_admin_orders_v1',[...orders,order]);
 await client.query("update public.orders set owner_id=$1 where namespace='atlas_admin_orders_v1' and scope_id='global' and entry_key=$2",[profile.id,id]);
 for(const [position,item] of orderItems.entries())await client.query("insert into public.order_items(order_id,position,variant_code,quantity,unit_price,payload,order_namespace,order_scope) values($1,$2,$3,$4,$5,$6,'atlas_admin_orders_v1','global')",[id,position,item.productCode,item.quantity,item.unitPrice,JSON.stringify(item)]);
 await client.query('insert into app_private.checkout_requests(profile_id,request_key,order_id,request_hash) values($1,$2,$3,$4)',[profile.id,key,id,digest]);return order;
}
export async function checkoutApi(req:Request,res:Response){res.setHeader('Cache-Control','no-store');if(!databaseEnabled())return res.status(404).end();try{if(req.get('origin') && new URL(req.get('origin')!).host!==req.get('host'))throw invalid('مبدأ نامعتبر',403);const identity=await getPortalIdentity(req);if(!identity.user)throw invalid('ابتدا وارد حساب شوید.',401);const order=await transaction(async client=>{await client.query("select pg_advisory_xact_lock(hashtextextended('orders:global',0))");return createOrder(client,identity.user,req.body);});return res.json({success:true,order});}catch(error:any){return res.status(error.status || 503).json({success:false,message:error.status?error.message:'ثبت سفارش انجام نشد؛ دوباره تلاش کنید.'});}}
