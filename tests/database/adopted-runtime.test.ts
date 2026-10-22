import test from 'node:test';import assert from 'node:assert/strict';
import {adoptedDatabase} from './adopted.fixture';
import {readAdoptedProducts,saveAdoptedProducts,readAdoptedDocument,writeAdoptedDocument,persistAdoptedUsers,adoptedUsers} from '../../server/db/adopted';
import {createAdoptedOrder,adoptedOrders} from '../../server/db/adoptedCheckout';
import type {SqlClient} from '../../server/db/connection';
import {getPortalIdentity} from '../../api/portal';
import type {IncomingMessage} from 'node:http';
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
test('anonymous database identity does not load private portal documents or authorize commerce',async()=>{const previous=process.env.DATA_BACKEND;try{process.env.DATA_BACKEND='postgres';assert.deepEqual(await getPortalIdentity({headers:{cookie:'sp_guest=untrusted'}} as IncomingMessage),{admin:false,user:undefined,canReadCommerce:false});}finally{if(previous===undefined)delete process.env.DATA_BACKEND;else process.env.DATA_BACKEND=previous;}});
test('adopted runtime retains real codes, currency, stock and unknown UI fields without prototype tables',async()=>{const db=await adoptedDatabase();const sql=db as unknown as SqlClient;try{
 await saveAdoptedProducts(sql,[{code:'source-family',name:'Bearing',categorySlug:'bearings',categoryName:'Bearings',variants:[{code:'6202ZZ',name:'6202ZZ',stock:999,prices:{retail:999}}]}]);
 await db.exec("update public.variant_commercial_specs set stock=10,stock_known=true,retail_price=1200,currency='IRR',inquiry_only=false where variant_code='6202ZZ'");
 const first=(await readAdoptedProducts(sql))[0];assert.equal(first.variants[0].prices.retail,120);assert.equal(first.variants[0].stock,10);
 await saveAdoptedProducts(sql,[{...first,name:'Updated bearing'}]);const row=(await db.query<any>('select * from public.variant_commercial_specs')).rows[0];assert.equal(row.stock,10);assert.equal(Number(row.retail_price),1200);assert.equal(row.currency,'IRR');
 await db.exec('begin');await writeAdoptedDocument(sql,'custom-state',{unknown:{kept:true}},'user:one');await db.exec('commit');assert.deepEqual(await readAdoptedDocument(sql,'custom-state','user:one'),{unknown:{kept:true}});assert.equal(await readAdoptedDocument(sql,'custom-state','user:two'),undefined);
 for(let i=1;i<=26;i++){const result=await db.query<any>("insert into app_private.rate_limits(bucket,attempts,expires_at) values('probe',1,now()+interval '15 minutes') on conflict(bucket) do update set attempts=rate_limits.attempts+1 returning attempts");assert.equal(result.rows[0].attempts,i);}
 await db.exec('begin');await writeAdoptedDocument(sql,'atlas_admin_pages_v1',[{id:'about',slug:'about',title:'About',content:'Industrial supply',unknown:42}],'global');await db.exec('commit');assert.equal((await db.query<any>('select title from public.static_pages')).rows[0].title,'About');assert.equal((await readAdoptedDocument(sql,'atlas_admin_pages_v1','global'))[0].unknown,42);await db.exec("update public.static_pages set title='Edited directly in Supabase' where id='about'");assert.equal((await readAdoptedDocument(sql,'atlas_admin_pages_v1','global'))[0].title,'Edited directly in Supabase');await writeAdoptedDocument(sql,'atlas_admin_pages_v1',[],'global');assert.deepEqual(await readAdoptedDocument(sql,'atlas_admin_pages_v1','global'),[]);assert.equal((await db.query<any>("select count(*)::int as n from public.static_pages where id='about'")).rows[0].n,1);
 await writeAdoptedDocument(sql,'atlas_portal_club_milestones_v1',{consumer:[{id:'retail',title:'Retail',targetPoints:10,rewardTitle:'Retail reward'}],high_volume:[{id:'bulk',title:'Bulk',targetPoints:100,rewardTitle:'Bulk reward'}]},'global');const milestones=await readAdoptedDocument(sql,'atlas_portal_club_milestones_v1','global');assert.equal(milestones.consumer.length,1);assert.equal(milestones.consumer[0].title,'Retail');assert.equal(milestones.high_volume[0].title,'Bulk');
 await db.exec('set role anon');await assert.rejects(db.query('select * from app_private.scoped_documents'));await assert.rejects(db.query('select * from public.variant_commercial_specs'));
 }finally{await db.close();}});
test('adopted checkout uses Auth identity, own address, database prices, reservations and replay protection',async()=>{const db=await adoptedDatabase();const sql=db as unknown as SqlClient;try{
 await db.query('insert into auth.users(id,phone,phone_confirmed_at) values($1,$2,now()),($3,$4,now())',[id,'989120000001',other,'989120000002']);
 const profile={id:'legacy-buyer',authUserId:id,fullName:'Buyer',role:'admin',password:'must-not-persist',addresses:[{id:'factory',province:'Yazd',city:'Yazd',fullAddress:'Factory'}]};await persistAdoptedUsers(sql,[profile]);
 assert.equal((await adoptedUsers(sql)).find(u=>u.authUserId===id)?.role,'retail');assert.equal((await db.query<any>('select count(*)::int as n from app_private.portal_users')).rows[0].n,0);assert.equal((await db.query<any>('select preferences from public.user_profiles where id=$1',[id])).rows[0].preferences.password,undefined);assert.equal((await adoptedUsers(sql)).find(u=>u.authUserId===id)?.addresses[0].fullAddress,'Factory');
 await saveAdoptedProducts(sql,[{code:'family',name:'Part',categorySlug:'parts',categoryName:'Parts',variants:[{code:'part',name:'Part'}]}]);await db.exec("update public.variant_commercial_specs set stock=3,stock_known=true,inquiry_only=false,retail_price=1000,currency='IRR'");
 const input={requestKey:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',items:[{code:'part',quantity:2,unitPrice:1}],addressId:'factory',shippingId:'freight',paymentMethod:'online',paymentStatus:'paid'};
 await db.exec('begin');const order=await createAdoptedOrder(sql,profile,input);await db.exec('commit');assert.equal(order.finalAmount,200);assert.equal(order.paymentStatus,'awaiting_payment');
 await db.exec('begin');assert.equal((await createAdoptedOrder(sql,profile,input)).id,order.id);await db.exec('commit');assert.equal((await db.query<any>('select stock_reserved from public.variant_commercial_specs')).rows[0].stock_reserved,2);
 assert.equal((await adoptedOrders(sql,other)).length,0);
 await db.exec('begin');await assert.rejects(createAdoptedOrder(sql,profile,{...input,requestKey:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',items:[{code:'part',quantity:2}]}),/استعلام/);await db.exec('rollback');
 await db.exec('begin');await assert.rejects(createAdoptedOrder(sql,profile,{...input,requestKey:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',addressId:'other'}),/نشانی/);await db.exec('rollback');
 assert.equal((await db.query<any>('select count(*)::int as n from public.orders')).rows[0].n,1);
 }finally{await db.close();}});
test('adopted runtime projects agency, invoice, inquiry, sms, price history and scoped user tables plus backfill',async()=>{const db=await adoptedDatabase();const sql=db as unknown as SqlClient;try{
 await db.query('insert into auth.users(id,phone,phone_confirmed_at) values($1,$2,now())',[id,'989120000099']);
 await db.exec('begin');
 await writeAdoptedDocument(sql,'atlas_admin_dealers_v1',[{id:'DL-01',code:'D-101',companyName:'Tehran Sanat',managerName:'Reza',province:'Tehran',city:'Tehran',phone:'09121112233',creditLimit:500000,currentDebt:120000,tier:'Gold',customField:'kept-dealer'}],'global');
 await writeAdoptedDocument(sql,'hyper_sanat_agency_applications_v1',[{id:'APP-01',fullName:'Ali',companyName:'Yazd Part',phone:'09131112233',province:'Yazd',city:'Yazd',status:'pending',extraMeta:true}],'global');
 await writeAdoptedDocument(sql,'hyper_sanat_deposit_receipts_v1',[{id:'DEP-01',dealerName:'Tehran Sanat',amount:250000,trackingCode:'TRK-99',bankName:'Mellat',depositDate:'1404/01/15',status:'approved'}],'global');
 await writeAdoptedDocument(sql,'atlas_admin_supply_reqs_v1',[{id:'SUP-01',dealerName:'Tehran Sanat',partCode:'6204ZZ',partName:'Bearing 6204',quantity:50,urgency:'urgent',status:'quoted'}],'global');
 await writeAdoptedDocument(sql,'hyper_sanat_dealer_messages_v1',[{id:'MSG-01',dealerName:'Tehran Sanat',subject:'Order status',body:'When will it ship?',senderRole:'dealer',isRead:false}],'global');
 await writeAdoptedDocument(sql,'atlas_admin_official_invoices_v1',[{id:'INV-01',invoiceNumber:'1404-001',buyerName:'Foulad Mobarakeh',nationalId:'10260000000',totalAmount:15000000,taxAmount:1350000,status:'issued'}],'global');
 await writeAdoptedDocument(sql,'atlas_admin_sms_logs_v1',[{id:'SMS-01',phone:'09121112233',message:'Code: 1234',type:'otp',status:'delivered',provider:'MeliPayamak'}],'global');
 await writeAdoptedDocument(sql,'atlas_admin_price_logs_v1',[{id:'PL-01',code:'6202ZZ',oldPrice:100,newPrice:120,actor:'admin',reason:'FX update'}],'global');
 await writeAdoptedDocument(sql,'hyper_sanat_inquiries_v2',[{id:'INQ-01',partName:'Belt B52',partCode:'B52',quantity:10,customerName:'Karimi',customerPhone:'09123334455',status:'answered',adminNote:'Available in stock'}],'global');
 await writeAdoptedDocument(sql,'atlas_plant_machinery_passport_v1',[{id:'MAC-01',name:'Kiln Drive #1',plantSection:'Line 1',criticality:'critical',belts:[{code:'B52'}]}],`user:${id}`);
 await writeAdoptedDocument(sql,'forza_industrial_chat_sessions_v2',[{id:'CHAT-01',title:'Bearing selection',messages:[{role:'user',text:'Hi'}]}],`user:${id}`);
 await writeAdoptedDocument(sql,'hyper_sanat_cart_v2',[{code:'6202ZZ',quantity:4}],`user:${id}`);
 await db.exec('commit');

 const dealers=await readAdoptedDocument(sql,'atlas_admin_dealers_v1','global');
 assert.equal(dealers.length,1);
 assert.equal(dealers[0].companyName,'Tehran Sanat');
 assert.equal(dealers[0].customField,'kept-dealer');

 const inquiries=await readAdoptedDocument(sql,'hyper_sanat_inquiries_v2','global');
 assert.equal(inquiries.length,1);
 assert.equal(inquiries[0].status,'answered');
 assert.equal((await db.query<any>("select status::text as s from public.price_inquiries where id='INQ-01'")).rows[0].s,'quoted');

 assert.equal((await db.query<any>("select count(*)::int as n from public.plant_machinery_passports where id='MAC-01'")).rows[0].n,1);
 assert.equal((await db.query<any>("select count(*)::int as n from public.industrial_chat_sessions where id='CHAT-01'")).rows[0].n,1);
 assert.equal((await db.query<any>("select count(*)::int as n from public.user_saved_collections where user_id=$1 and collection_type='cart'",[id])).rows[0].n,1);

 const backfillRes=(await db.query<any>('select app_private.backfill_relational_projections_from_kv() as res')).rows[0].res;
 assert.equal(typeof backfillRes.agencies,'number');
 assert.equal(typeof backfillRes.price_inquiries,'number');
 assert.equal(backfillRes.skipped_errors,0);

 // Stress-test dirty/legacy JSON in portal_kv_store (Persian digits, commas, text in numbers, duplicate codes, unverified FKs, zero quantity, Jalali dates)
 await db.query(`insert into public.portal_kv_store(key,value) values
  ('atlas_admin_active_agencies_v1',$1::jsonb),
  ('hyper_sanat_agency_applications_v1',$2::jsonb),
  ('hyper_sanat_deposit_receipts_v1',$3::jsonb),
  ('hyper_sanat_supply_requests_v1',$4::jsonb),
  ('atlas_admin_official_invoices_v1',$5::jsonb),
  ('atlas_admin_inquiries_v1',$6::jsonb)
  on conflict(key) do update set value=excluded.value`,[
  JSON.stringify([
   {id:'DL-02',code:'D-101',companyName:'Duplicate Code Dealer',creditLimit:'۱۲,۵۰۰,۰۰۰ تومان',currentDebt:'توافقی',discountPercent:'150%',isPublicRepresentative:'فعال'},
   {id:'DL-03',code:'D-103',companyName:'Isfahan Bearing',creditLimit:'',currentBalance:null}
  ]),
  JSON.stringify([
   {id:'APP-02',fullName:'Mehdi',phone:'۰۹۱۳۰۰۰۰۰۰۰',province:'Isfahan',city:'Isfahan',experienceYears:'۸ سال سابقه',storeAreaSqm:'۱۲۰ متر',activeBrands:['SKF','FAG'],reviewedAt:'1403/02/31'}
  ]),
  JSON.stringify([
   {id:'DEP-02',agencyId:'MISSING-AGENCY',dealerName:'Isfahan Bearing',amount:'۴۵,۰۰۰,۰۰۰',trackingCode:'TRK-100'}
  ]),
  JSON.stringify([
   {id:'SUP-02',agencyCode:'D-103',dealerName:'Isfahan Bearing',partCode:'22210E',partName:'Spherical Roller',quantity:'0',urgency:'immediate'}
  ]),
  JSON.stringify([
   {id:'INV-02',invoiceNumber:'1404-001',orderId:'MISSING-ORDER',buyerName:'Kerman Cement',subtotal:'۱۰,۰۰۰,۰۰۰',totalTax:'۹۰۰,۰۰۰',grandTotal:'۱۰,۹۰۰,۰۰۰'}
  ]),
  JSON.stringify([
   {id:'INQ-02',customerId:'MISSING-CRM',customerName:'Rahimi',phone:'09120001122',productCode:'UCFL205',productName:'Pillow Block',quantity:'-5',quotedPrice:'توافقی',status:'unknown_status'}
  ])
 ]);

 const dirtyBackfill=(await db.query<any>('select app_private.backfill_relational_projections_from_kv() as res')).rows[0].res;
 assert.equal(dirtyBackfill.skipped_errors,0);
 const dl2=(await db.query<any>("select code,credit_limit::numeric as lim,discount_percent::numeric as disc,is_public_representative as pub from public.agencies where id='DL-02'")).rows[0];
 assert.equal(dl2.code,'D-101-DL-02');
 assert.equal(Number(dl2.lim),12500000);
 assert.equal(Number(dl2.disc),100);
 assert.equal(dl2.pub,true);

 const app2=(await db.query<any>("select experience_years,store_area_sqm,active_brands,reviewed_at from public.agency_applications where id='APP-02'")).rows[0];
 assert.equal(app2.experience_years,8);
 assert.equal(app2.store_area_sqm,120);
 assert.equal(app2.active_brands,'SKF, FAG');
 assert.equal(app2.reviewed_at,null);

 const sup2=(await db.query<any>("select agency_id,quantity from public.agency_supply_requests where id='SUP-02'")).rows[0];
 assert.equal(sup2.agency_id,'DL-03');
 assert.equal(sup2.quantity,1);

 const inv2=(await db.query<any>("select invoice_number,total_payable::numeric as total from public.official_invoices where id='INV-02'")).rows[0];
 assert.equal(inv2.invoice_number,'1404-001-INV-02');
 assert.equal(Number(inv2.total),10900000);
 }finally{await db.close();}});

test('backfill_relational_projections_from_kv safely merges live sanatpishatlas pre-flight KV keys without duplicating or overwriting existing relational rows',async()=>{const db=await adoptedDatabase();const sql=db as unknown as SqlClient;try{
 // Seed existing relational rows matching live sanatpishatlas counts:
 // 5 price_lists, 2 portal_announcements, 4 portal_banners (2 storefront + 2 portal), 4 club_milestones
 await db.exec(`
  insert into public.price_lists(id, name, description, currency, is_default, is_active, items, discount_percent, raw_payload)
  values
   ('pl-1', 'لیست قیمت مصرف‌کننده', 'قیمت پایه', 'IRR', true, true, '{"6202ZZ": 120000}'::jsonb, 0, '{}'::jsonb),
   ('pl-2', 'لیست قیمت همکار برنزی', 'همکار سطح ۱', 'IRR', false, true, '{"6202ZZ": 115000}'::jsonb, 3, '{}'::jsonb),
   ('pl-3', 'لیست قیمت همکار نقره‌ای', 'همکار سطح ۲', 'IRR', false, true, '{"6202ZZ": 110000}'::jsonb, 5, '{}'::jsonb),
   ('pl-4', 'لیست قیمت همکار طلایی', 'همکار سطح ۳', 'IRR', false, true, '{"6202ZZ": 105000}'::jsonb, 8, '{}'::jsonb),
   ('pl-5', 'لیست قیمت نمایندگی ویژه', 'قراردادی', 'IRR', false, true, '{"6202ZZ": 100000}'::jsonb, 12, '{}'::jsonb);

  insert into public.portal_announcements(id, portal, title, body, tag, action_label, action_link, pinned, active, priority)
  values
   ('ann-1', 'storefront', 'بروزرسانی لیست قیمت بلبرینگ‌های صنعتی', 'لیست قیمت جدید اعمال شد.', 'قیمت', 'مشاهده کاتالوگ', '/catalog', true, true, 'high'),
   ('ann-2', 'high_volume', 'شرایط ویژه تسویه اعتباری نمایندگان', 'سقف اعتباری فصل جدید افزایش یافت.', 'اعتبار', 'پنل مالی', '/portal', false, true, 'normal');

  insert into public.portal_banners(id, scope, title, subtitle, cta_text, link_url, image_url, active, sort_order)
  values
   ('ban-store-1', 'storefront', 'تامین مستقیم قطعات صنعتی', 'ارسال سریع به سراسر کشور', 'ورود به کاتالوگ', '/catalog', '/img/s1.jpg', true, 1),
   ('ban-store-2', 'storefront', 'تسمه‌های صنعتی فورزا', 'اصالت و گارانتی معتبر', 'مشاهده تسمه‌ها', '/belts', '/img/s2.jpg', true, 2),
   ('ban-portal-1', 'consumer', 'باشگاه مشتریان صنعت پیش', 'امتیاز بگیرید و تخفیف دریافت کنید', 'مشاهده جوایز', 'club', '/img/p1.jpg', true, 3),
   ('ban-portal-2', 'high_volume', 'ثبت سفارش عمده سریع', 'بارگذاری فایل اکسل یا کد فنی', 'ثبت سفارش', 'quick-order', '/img/p2.jpg', true, 4);

  insert into public.club_milestones(id, title, target_points, reward_title, reward_type, sort_order, active)
  values
   ('ms-highvol-A', 'سطح برنزی', 0, 'تخفیف پایه باشگاه', 'discount', 1, true),
   ('ms-highvol-B', 'سطح نقره‌ای', 1000, 'تخفیف ۵ درصدی', 'discount', 2, true),
   ('ms-highvol-C', 'سطح طلایی', 5000, 'تخفیف ۸ درصدی', 'discount', 3, true),
   ('ms-highvol-D', 'سطح الماس', 15000, 'تخفیف ۱۲ درصدی ویژه', 'discount', 4, true);

  -- Seed initial catalog_families for the 3 live families to verify non-destructive enrichment
  insert into public.catalog_families(code, name, category_slug, category_name, brand, unit, description)
  values
   ('FAM-34265', 'چرخ‌دنده فولادی صنعتی', 'gear-wheels', 'چرخ و رولر', 'ATLAS GEAR', 'عدد', 'توضیحات اولیه کارخانه'),
   ('FAM-80301', 'چرخ‌دنده پلیمر تفلون', 'polymers', 'آب‌بندی و قطعات لاستیکی', 'ATLAS POLYMER', 'عدد', 'توضیحات اولیه پلیمر'),
   ('FAM-32496', 'پکینگ نسوز تفلونی', 'packings', 'آب‌بندی و درزگیری', 'ثبت نشده', 'كيلوگرم, عدد', 'توضیحات اولیه پکینگ')
  on conflict (code) do nothing;
 `);

 // Seed portal_kv_store with the exact 4 non-empty arrays + 2 objects from live pre-flight
 await db.query(`
  insert into public.portal_kv_store(key, value)
  values
   ('atlas_price_lists_v2', $1::jsonb),
   ('atlas_portal_content_announcements_v1', $2::jsonb),
   ('atlas_portal_content_banners_v1', $3::jsonb),
   ('atlas_portal_club_milestones_v1', $4::jsonb),
   ('catalog_overrides_db_v1', $5::jsonb),
   ('sanatpish:portal:db:v1', $6::jsonb)
  on conflict (key) do update set value = excluded.value
 `, [
  JSON.stringify([
   {id:'pl-1', name:'لیست قیمت مصرف‌کننده', discountPercent:0, active:true, customProductPrices:{'6202ZZ':120000}, extraKvMeta:'v2-1'},
   {id:'pl-2', name:'لیست قیمت همکار برنزی', discountPercent:3, active:true, customProductPrices:{'6202ZZ':115000}, extraKvMeta:'v2-2'},
   {id:'pl-3', name:'لیست قیمت همکار نقره‌ای', discountPercent:5, active:true, customProductPrices:{'6202ZZ':110000}, extraKvMeta:'v2-3'},
   {id:'pl-4', name:'لیست قیمت همکار طلایی', discountPercent:8, active:true, customProductPrices:{'6202ZZ':105000}, extraKvMeta:'v2-4'},
   {id:'pl-5', name:'لیست قیمت نمایندگی ویژه', discountPercent:12, active:true, customProductPrices:{'6202ZZ':100000}, extraKvMeta:'v2-5'}
  ]),
  JSON.stringify([
   {id:'ann-1', portal:'all', title:'بروزرسانی لیست قیمت بلبرینگ‌های صنعتی', summary:'خلاصه اطلاعیه اول', body:'لیست قیمت جدید اعمال شد.', category:'pricing', priority:'high', status:'published', publishedAt:'1404/01/20', isPinned:true, active:true},
   {id:'ann-2', portal:'high_volume', title:'شرایط ویژه تسویه اعتباری نمایندگان', summary:'خلاصه اطلاعیه دوم', body:'سقف اعتباری فصل جدید افزایش یافت.', category:'credit', priority:'important', status:'published', publishedAt:'1404/01/21', isPinned:false, active:true}
  ]),
  JSON.stringify([
   {id:'ban-portal-1', portal:'consumer', title:'باشگاه مشتریان صنعت پیش', subtitle:'امتیاز بگیرید و تخفیف دریافت کنید', badge:'باشگاه', ctaText:'مشاهده جوایز', ctaLinkOrTab:'club', backgroundImage:'/img/p1.jpg', theme:'gold', active:true, order:3},
   {id:'ban-portal-2', portal:'high_volume', title:'ثبت سفارش عمده سریع', subtitle:'بارگذاری فایل اکسل یا کد فنی', badge:'پورتال همکاران', ctaText:'ثبت سفارش', ctaLinkOrTab:'quick-order', backgroundImage:'/img/p2.jpg', theme:'slate', active:true, order:4}
  ]),
  JSON.stringify([
   {id:'tier-a', code:'A', tierKey:'A', publicTitle:'سطح برنزی', minPurchaseVolume:10000000, discountPercent:2, summaryBenefit:'تخفیف پایه باشگاه', benefits:['ارسال اولویت‌دار'], sortOrder:1},
   {id:'tier-b', code:'B', tierKey:'B', publicTitle:'سطح نقره‌ای', minPurchaseVolume:50000000, discountPercent:5, summaryBenefit:'تخفیف ۵ درصدی', benefits:['مشاوره فنی'], sortOrder:2},
   {id:'tier-c', code:'C', tierKey:'C', publicTitle:'سطح طلایی', minPurchaseVolume:200000000, discountPercent:8, summaryBenefit:'تخفیف ۸ درصدی', benefits:['خرید اعتباری'], sortOrder:3},
   {id:'tier-d', code:'D', tierKey:'D', publicTitle:'سطح الماس', minPurchaseVolume:500000000, discountPercent:12, summaryBenefit:'تخفیف ۱۲ درصدی ویژه', benefits:['مدیر حساب اختصاصی'], sortOrder:4}
  ]),
  JSON.stringify({
   version: 1,
   updatedAt: '2026-10-17T11:40:00.440Z',
   deletedCodes: [],
   families: {
    'FAM-34265': {
     code: 'FAM-34265',
     name: 'چرخ دنده',
     brand: 'ATLAS GEAR',
     categorySlug: 'wheels-rollers',
     categoryName: 'چرخ و رولر',
     submenu: 'چرخ صنعتی',
     subcategory: 'چرخ صنعتی',
     unit: 'عدد',
     active: true,
     description: 'خانواده چرخ‌دنده‌های صنعتی خطوط تولید',
     technicalSpecs: [{key: 'استاندارد', value: 'DIN 867'}],
     galleryImages: [
      {id: 'img-34265-1', url: 'https://img.test/34265-1.png', fileName: 'e549.png', scope: 'variant', variantCode: '34265', title: 'چرخ‌دنده هلیکال Z14', order: 1}
     ],
     variants: [
      {
       code: '34265',
       name: 'چرخ دنده هلیکال فولادی Z14 شفت ۲۰ میلی‌متر',
       size: 'Z14 — قطر ۶۵ × شفت ۲۰ میلی‌متر',
       model: 'HG-Z14-M4',
       brand: 'ATLAS GEAR',
       unit: 'عدد',
       price: 450000,
       prices: {base: 400000, retail: 450000, wholesale: 420000, dealer: 390000},
       inquiryOnly: false,
       stock: 12,
       stockKnown: true,
       active: true,
       images: ['https://img.test/34265-1.png'],
       technicalSpecs: [{key: 'تعداد دندانه (Z)', value: '14'}]
      }
     ]
    },
    'FAM-80301': {
     code: 'FAM-80301',
     name: 'چرخ دنده پلاستیکی سفید',
     brand: 'ATLAS POLYMER',
     categorySlug: 'rubber-polymers',
     categoryName: 'آب‌بندی و قطعات لاستیکی',
     unit: 'عدد',
     active: true,
     description: 'خانواده چرخ‌دنده پلیمری سفید',
     technicalSpecs: [{key: 'جنس', value: 'پلی‌آمید'}],
     variants: [
      {
       code: '41069',
       name: 'چرخ دنده پلاستيكي سفيد Z16 * 122 * 40',
       size: 'Z16، 16*122*40',
       model: 'PA6-Z16-122x40',
       brand: 'ATLAS POLYMER',
       unit: 'عدد',
       price: 0,
       prices: {base: 0, retail: 0, wholesale: 0, dealer: 0},
       inquiryOnly: true,
       stock: 0,
       stockKnown: false,
       active: true,
       images: [],
       technicalSpecs: [{key: 'تعداد دندانه', value: '16'}]
      }
     ]
    },
    'FAM-32496': {
     code: 'FAM-32496',
     name: 'پکینگ / کاسه‌نمد',
     brand: 'ثبت نشده',
     categorySlug: 'packings',
     categoryName: 'آب‌بندی و درزگیری',
     unit: 'كيلوگرم, عدد',
     active: true,
     variants: [
      {
       code: '32496',
       name: 'پكينگ نسوز سفيد 15 * 15',
       size: '15*15',
       unit: 'عدد',
       price: 0,
       prices: {base: 0, retail: 0, wholesale: 0, dealer: 0},
       inquiryOnly: true,
       stock: 0,
       stockKnown: false,
       active: true,
       images: []
      }
     ]
    }
   }
  }),
  JSON.stringify({
   revision: 42,
   users: [
    {id:'legacy-u1', phone:'09125556677', fullName:'Legacy User', role:'wholesale', password:'secret-password', passwordHash:'hash-123'}
   ],
   values: {
    custom_legacy_setting: {enabled: true}
   }
  })
 ]);

 // First run of backfill
 const run1=(await db.query<any>('select app_private.backfill_relational_projections_from_kv() as res')).rows[0].res;
 assert.equal(run1.skipped_errors,0);
 assert.deepEqual(run1.error_details,[]);
 assert.equal(run1.price_lists,5);
 assert.equal(run1.portal_announcements,2);
 assert.equal(run1.portal_banners,2);
 assert.equal(run1.club_milestones,4);
 assert.equal(run1.catalog_overrides_synced,3);

 // Verify no duplicate rows were created and all 4 storefront + portal banners remain intact
 assert.equal((await db.query<any>('select count(*)::int as n from public.price_lists')).rows[0].n,5);
 assert.equal((await db.query<any>('select count(*)::int as n from public.portal_announcements')).rows[0].n,2);
 assert.equal((await db.query<any>('select count(*)::int as n from public.portal_banners')).rows[0].n,4);
 assert.equal((await db.query<any>('select count(*)::int as n from public.club_milestones')).rows[0].n,4);

 // Verify the 3 catalog families were enriched non-destructively
 const fam1=(await db.query<any>("select name, category_slug, brand from public.catalog_families where code='FAM-34265'")).rows[0];
 assert.equal(fam1.name,'چرخ دنده');
 assert.equal(fam1.category_slug,'wheels-rollers');
 assert.equal(fam1.brand,'ATLAS GEAR');

 const fam2=(await db.query<any>("select name, brand from public.catalog_families where code='FAM-80301'")).rows[0];
 assert.equal(fam2.name,'چرخ دنده پلاستیکی سفید');
 assert.equal(fam2.brand,'ATLAS POLYMER');

 const fam3=(await db.query<any>("select name, category_slug from public.catalog_families where code='FAM-32496'")).rows[0];
 assert.equal(fam3.name,'پکینگ / کاسه‌نمد');
 assert.equal(fam3.category_slug,'packings');

 // Verify variants synced into catalog_variants
 const var1=(await db.query<any>("select name, model from public.catalog_variants where code='34265'")).rows[0];
 assert.equal(var1.name,'چرخ دنده هلیکال فولادی Z14 شفت ۲۰ میلی‌متر');
 assert.equal(var1.model,'HG-Z14-M4');

 // Verify commercial specs synced into variant_commercial_specs
 const comm1=(await db.query<any>("select retail_price::numeric as price, stock, stock_known, inquiry_only from public.variant_commercial_specs where variant_code='34265'")).rows[0];
 assert.equal(Number(comm1.price),450000);
 assert.equal(comm1.stock,12);
 assert.equal(comm1.stock_known,true);
 assert.equal(comm1.inquiry_only,false);

 // Verify gallery images synced into catalog_gallery_images
 const img1=(await db.query<any>("select url from public.catalog_gallery_images where id='img-34265-1'")).rows[0];
 assert.equal(img1.url,'https://img.test/34265-1.png');

 // Verify enriched columns were populated without losing existing data
 const pl1=(await db.query<any>("select items, raw_payload from public.price_lists where id='pl-1'")).rows[0];
 assert.equal(pl1.items['6202ZZ'],120000);
 assert.equal(pl1.raw_payload.extraKvMeta,'v2-1');

 const ann1=(await db.query<any>("select raw_payload, priority, portal, tag from public.portal_announcements where id='ann-1'")).rows[0];
 assert.equal(ann1.raw_payload.summary,'خلاصه اطلاعیه اول');
 assert.equal(ann1.priority,'high');
 assert.equal(ann1.portal,'storefront');

 const msGold=(await db.query<any>("select min_purchase_volume::numeric as vol from public.club_milestones where id='ms-highvol-C'")).rows[0];
 assert.equal(Number(msGold.vol),200000000);

 // Verify sanatpish:portal:db:v1 synced revision & legacy user without password
 assert.equal(Number((await db.query<any>('select revision from app_private.portal_version where singleton=true')).rows[0].revision)>=42,true);
 const legacyUser=(await db.query<any>("select payload from app_private.portal_users where id='legacy-u1'")).rows[0];
 assert.equal(legacyUser.payload.fullName,'Legacy User');
 assert.equal(legacyUser.payload.password,undefined);
 assert.equal(legacyUser.payload.passwordHash,undefined);

 // Verify readAdoptedDocument returns consistent data for price_lists, banners, announcements, and club_milestones
 const readPl=await readAdoptedDocument(sql,'atlas_price_lists_v2','global');
 assert.equal(readPl.length,5);
 assert.equal(readPl.find((x:any)=>x.id==='pl-1').customProductPrices['6202ZZ'],120000);

 const readPortalBanners=await readAdoptedDocument(sql,'atlas_portal_content_banners_v1','global');
 assert.equal(readPortalBanners.length,2);
 assert.equal(readPortalBanners[0].backgroundImage,'/img/p1.jpg');
 assert.equal(readPortalBanners[0].ctaLinkOrTab,'club');

 const readStoreBanners=await readAdoptedDocument(sql,'atlas_admin_banners_v1','global');
 assert.equal(readStoreBanners.length,2);

 // Second run of backfill to verify 100% idempotency
 const run2=(await db.query<any>('select app_private.backfill_relational_projections_from_kv() as res')).rows[0].res;
 assert.equal(run2.skipped_errors,0);
 assert.equal(run2.catalog_overrides_synced,3);
 assert.equal((await db.query<any>('select count(*)::int as n from public.price_lists')).rows[0].n,5);
 assert.equal((await db.query<any>('select count(*)::int as n from public.portal_announcements')).rows[0].n,2);
 assert.equal((await db.query<any>('select count(*)::int as n from public.portal_banners')).rows[0].n,4);
 assert.equal((await db.query<any>('select count(*)::int as n from public.club_milestones')).rows[0].n,4);
 assert.equal((await db.query<any>("select count(*)::int as n from public.catalog_families where code in ('FAM-34265', 'FAM-80301', 'FAM-32496')")).rows[0].n,3);
 assert.equal((await db.query<any>("select count(*)::int as n from public.catalog_variants where code in ('34265', '41069', '32496')")).rows[0].n,3);
}finally{await db.close();}});


test('adopted CRM changes persist as SQL rows across fresh reads without creating Auth users or default passwords', async()=>{
 const db=await adoptedDatabase();
 try{
  const sql=db as any;
  const first=[{id:'CRM-INTEGRATION-01',fullName:'Test Industrial Buyer',mobile:'09123334455',companyName:'Sample Parts',approvedB2B:true,assignedPriceListId:'TEST-PRICE-01',password:'must-not-be-stored'}];
  await db.exec('begin');
  await writeAdoptedDocument(sql,'atlas_admin_customers_v1',first,'global');
  await db.exec('commit');
  const stored=(await db.query<any>("select id,name,phone,company,approved_b2b,approval_status,assigned_price_list_id,raw_payload from public.crm_customers where id='CRM-INTEGRATION-01'")).rows[0];
  assert.equal(stored.name,'Test Industrial Buyer');
  assert.equal(stored.phone,'09123334455');
  assert.equal(stored.company,'Sample Parts');
  assert.equal(stored.approved_b2b,true);
  assert.equal(stored.approval_status,'approved');
  assert.equal(stored.assigned_price_list_id,'TEST-PRICE-01');
  assert.equal(stored.raw_payload.password,undefined);
  // The compatibility document must not leak a supplied CRM password.
  const reloaded=await readAdoptedDocument(sql,'atlas_admin_customers_v1','global') as any[];
  assert.equal(reloaded.find(c=>c.id==='CRM-INTEGRATION-01')?.name,'Test Industrial Buyer');
  await db.exec('begin');
  await writeAdoptedDocument(sql,'atlas_admin_customers_v1',[{id:'CRM-INTEGRATION-01',fullName:'Updated Buyer',mobile:'09123334455',companyName:'Sample Parts',approvedB2B:false,assignedPriceListId:'TEST-PRICE-02'}],'global');
  await db.exec('commit');
  const changed=(await db.query<any>("select name,approved_b2b,assigned_price_list_id from public.crm_customers where id='CRM-INTEGRATION-01'")).rows[0];
  assert.equal(changed.name,'Updated Buyer');
  assert.equal(changed.approved_b2b,false);
  assert.equal(changed.assigned_price_list_id,'TEST-PRICE-02');
  assert.equal((await db.query<any>("select count(*)::int as n from public.crm_customers where id='CRM-INTEGRATION-01'")).rows[0].n,1);
  assert.equal((await db.query<any>("select count(*)::int as n from app_private.portal_users where id='CRM-INTEGRATION-01'")).rows[0].n,0);
 }finally{await db.close();}
});
