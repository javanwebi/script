import type { Express, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { database, transaction, databaseEnabled, adoptedSchema, type SqlClient } from './connection';
import { getPortalIdentity } from '../../api/portal';
import { canStaff } from './staffPermissions';
import { refreshAuth } from './supabaseAuth';

type GuestItemInput = { productCode: string; quantity: number };
type QuoteRow = {
 id: string;
 requestNumber: string | number;
 status: string;
 warehouseAssignedTo?: string | null;
 createdAt: string;
 sentToWarehouseAt?: string | null;
 warehouseCompletedAt?: string | null;
 items: Array<{
  id: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
  warehouseStatus: string;
  availableQuantity?: number | null;
  warehouseNote?: string | null;
 }>;
};

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const usernamePattern = /^[a-z][a-z0-9_]{3,31}$/;
const guestRate = new Map<string, { count: number; resetAt: number }>();
const adminListeners = new Set<Response>();
const warehouseListeners = new Set<Response>();

function ready() {
 if (!databaseEnabled() || !adoptedSchema()) throw fail(503, 'گردش درخواست پیش‌فاکتور روی دیتابیس اصلی صنعت پیش فعال نیست.');
}
function checkOrigin(req: Request) {
 const origin = req.headers.origin;
 if (origin && (!req.headers.host || new URL(origin).host !== req.headers.host))
  throw fail(403, 'مبدأ درخواست معتبر نیست.');
}
function rateLimitGuest(req: Request) {
 const key = req.ip || req.socket.remoteAddress || 'unknown';
 const now = Date.now();
 const current = guestRate.get(key);
 if (!current || current.resetAt <= now) {
  guestRate.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
 } else {
  current.count += 1;
  if (current.count > 60) throw fail(429, 'تعداد درخواست‌ها بیش از حد مجاز است؛ چند دقیقه دیگر دوباره تلاش کنید.');
 }
 if (guestRate.size > 5000) {
  for (const [ip, value] of guestRate) if (value.resetAt <= now) guestRate.delete(ip);
 }
}
function emit(listeners: Set<Response>, event: string) {
 for (const listener of listeners) {
  try { listener.write(`event: ${event}\ndata: {}\n\n`); }
  catch { listeners.delete(listener); }
 }
}
function stream(req: Request, res: Response, listeners: Set<Response>) {
 res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
 res.setHeader('Cache-Control', 'private, no-cache, no-transform');
 res.setHeader('Connection', 'keep-alive');
 res.setHeader('X-Accel-Buffering', 'no');
 res.flushHeaders();
 res.write('retry: 5000\n\n');
 listeners.add(res);
 const heartbeat = setInterval(() => {
  try { res.write(': keep-alive\n\n'); }
  catch { clearInterval(heartbeat); listeners.delete(res); }
 }, 25000);
 req.on('close', () => { clearInterval(heartbeat); listeners.delete(res); });
}
function respond(res: Response, error: unknown) {
 const e = error as { status?: number; code?: string };
 const status = e?.code === '23505' ? 409 : e?.status || 503;
 if (status >= 500) console.error('[Guest quote / warehouse API]', e?.code || 'service-unavailable');
 return res.status(status).json({
  success: false,
  message: status < 500
   ? (error instanceof Error ? error.message : 'درخواست معتبر نیست.')
   : 'ارتباط با سرویس درخواست پیش‌فاکتور برقرار نشد؛ دوباره تلاش کنید.'
 });
}
async function manager(req: Request, action: 'view' | 'edit' = 'view') {
 ready();
 const identity = await getPortalIdentity(req);
 if (!identity.admin &&
     !canStaff(identity, 'guest_quotes', action) &&
     !canStaff(identity, 'inquiries', action))
  throw fail(403, 'مجوز مدیریت درخواست‌های پیش‌فاکتور را ندارید.');
 checkOrigin(req);
 return String(identity.user?.authUserId || '');
}
async function owner(req: Request) {
 ready();
 const identity = await getPortalIdentity(req);
 if (!identity.admin || !identity.user?.authUserId)
  throw fail(403, 'فقط مدیر اصلی مجاز به مدیریت حساب‌های انبارداری است.');
 checkOrigin(req);
 return String(identity.user.authUserId);
}
async function warehouseActor(req: Request, res: Response, checkRequestOrigin = false) {
 ready();
 await refreshAuth(req, res);
 const identity = await getPortalIdentity(req);
 const userId = String(identity.user?.authUserId || '');
 if (!userId || identity.user?.dbRole !== 'warehouse_operator')
  throw fail(401, 'برای ورود به پنل انبارداری ابتدا وارد حساب انباردار شوید.');
 const account = (await database().query(
  'select active from app_private.warehouse_operator_accounts where user_id=$1',
  [userId]
 )).rows[0];
 if (account?.active !== true) throw fail(403, 'دسترسی حساب انبارداری غیرفعال است.');
 if (checkRequestOrigin) checkOrigin(req);
 return { id: userId, name: String(identity.user?.fullName || identity.user?.username || 'انباردار') };
}
async function listRequests(client: SqlClient, whereSql = '', values: unknown[] = []): Promise<QuoteRow[]> {
 const result = await client.query(
  `select r.id,r.request_number as "requestNumber",r.status,
          r.warehouse_assigned_to as "warehouseAssignedTo",
          r.created_at as "createdAt",
          r.sent_to_warehouse_at as "sentToWarehouseAt",
          r.warehouse_completed_at as "warehouseCompletedAt",
          coalesce(json_agg(json_build_object(
            'id',i.id,'productCode',i.product_code,'productName',i.product_name,
            'unit',i.unit,'quantity',i.quantity,'warehouseStatus',i.warehouse_status,
            'availableQuantity',i.available_quantity,'warehouseNote',i.warehouse_note
          ) order by i.created_at,i.id) filter(where i.id is not null),'[]'::json) as items
     from public.guest_quote_requests r
     left join public.guest_quote_request_items i on i.request_id=r.id
     ${whereSql}
     group by r.id
     order by r.created_at desc
     limit 200`,
  values
 );
 return result.rows as QuoteRow[];
}
function adminAuth() {
 const url = process.env.SUPABASE_URL;
 const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
 if (!url || !key) throw fail(503, 'کلید محرمانه سرور Supabase برای ساخت حساب انباردار تنظیم نشده است.');
 return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
async function audit(actor: string, action: string, target: string) {
 try {
  await database().query(`
   insert into public.audit_logs(id,user_id,user_name,user_role,action,entity,target,details,created_at)
   select $1,$2,coalesce(nullif(p.full_name,''),p.username),p.role::text,$3,'warehouse',$4,
          'عملیات گردش درخواست یا حساب انبارداری ثبت شد.',now()
   from public.user_profiles p where p.id=$2`,
   [crypto.randomUUID(), actor, action, target]);
 } catch { console.warn('[Warehouse audit] Could not append audit event'); }
}

export function registerGuestQuoteWarehouseApi(app: Express) {
 // Public endpoint: only validated catalog codes and quantities are accepted.
 // It deliberately ignores customer name, phone, email, address and notes.
 app.post('/api/guest-quote-requests', async (req, res) => {
  try {
   ready();
   checkOrigin(req);
   rateLimitGuest(req);
   if (String(req.body?.website || '').trim()) throw fail(400, 'درخواست معتبر نیست.');
   const requestKey = String(req.body?.requestKey || '').trim();
   if (!uuidPattern.test(requestKey)) throw fail(400, 'شناسه امن درخواست معتبر نیست.');
   if (!Array.isArray(req.body?.items) || req.body.items.length < 1 || req.body.items.length > 30)
    throw fail(400, 'حداقل یک و حداکثر ۳۰ قلم کالا انتخاب کنید.');
   const quantities = new Map<string, number>();
   for (const raw of req.body.items as GuestItemInput[]) {
    const code = typeof raw?.productCode === 'string' ? raw.productCode.trim() : '';
    const quantity = Number(raw?.quantity);
    if (!code || code.length > 100 || /[\u0000-\u001f]/.test(code) ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > 9999)
     throw fail(400, 'کد کالا یا تعداد یکی از اقلام معتبر نیست.');
    const total = (quantities.get(code) || 0) + quantity;
    if (total > 9999) throw fail(400, 'تعداد تجمیعی یک کالا نباید بیشتر از ۹۹۹۹ باشد.');
    quantities.set(code, total);
   }
   const codes = [...quantities.keys()];
   const catalog = await database().query(`
    with candidates as (
     select v.code,coalesce(nullif(v.name,''),f.name) as name,
            coalesce(nullif(v.unit,''),nullif(f.unit,''),'عدد') as unit,1 as priority
       from public.catalog_variants v
       join public.catalog_families f on f.code=v.family_code
      where v.code=any($1::text[]) and v.active is true
        and f.is_active is true and coalesce(f.is_deleted,false)=false
     union all
     select d.sku_code as code,d.name,'عدد'::text as unit,2 as priority
       from public.catalog_direct_skus d
      where d.sku_code=any($1::text[]) and d.is_active is true
     union all
     select f.code,f.name,coalesce(nullif(f.unit,''),'عدد') as unit,3 as priority
       from public.catalog_families f
      where f.code=any($1::text[]) and f.is_active is true
        and coalesce(f.is_deleted,false)=false
    )
    select distinct on(code) code,name,unit from candidates order by code,priority
   `, [codes]);
   const byCode = new Map<string, { code: string; name: string; unit: string }>(
    catalog.rows.map((row: any) => [String(row.code), {
     code: String(row.code), name: String(row.name || row.code), unit: String(row.unit || 'عدد')
    }] as const)
   );
   const missing = codes.filter(code => !byCode.has(code));
   if (missing.length) throw fail(400, 'یک یا چند کالا در کاتالوگ فعال صنعت پیش یافت نشد؛ فهرست کالاها را دوباره بررسی کنید.');
   const result = await transaction(async client => {
    const inserted = await client.query(
     'insert into public.guest_quote_requests(request_key) values($1) on conflict(request_key) do nothing returning id,request_number',
     [requestKey]
    );
    if (!inserted.rowCount) {
     const existing = (await client.query(
      'select id,request_number from public.guest_quote_requests where request_key=$1',
      [requestKey]
     )).rows[0];
     if (!existing) throw fail(503, 'ثبت درخواست نهایی نشد؛ دوباره تلاش کنید.');
     return { id: String(existing.id), requestNumber: String(existing.request_number), duplicate: true };
    }
    const request = inserted.rows[0];
    for (const [code, quantity] of quantities) {
     const product = byCode.get(code)!;
     await client.query(
      'insert into public.guest_quote_request_items(request_id,product_code,product_name,unit,quantity) values($1,$2,$3,$4,$5)',
      [request.id, product.code, product.name, product.unit, quantity]
     );
    }
    return { id: String(request.id), requestNumber: String(request.request_number), duplicate: false };
   });
   if (!result.duplicate) emit(adminListeners, 'guest-quote-updated');
   res.setHeader('Cache-Control', 'no-store');
   return res.status(result.duplicate ? 200 : 201).json({
    success: true,
    requestNumber: result.requestNumber,
    message: 'درخواست پیش‌فاکتور ثبت شد.'
   });
  } catch (error) { return respond(res, error); }
 });

 app.get('/api/admin/guest-quote-requests', async (req, res) => {
  try {
   await manager(req, 'view');
   res.setHeader('Cache-Control', 'private, no-store');
   const requests = await listRequests(database());
   return res.json({ success: true, requests });
  } catch (error) { return respond(res, error); }
 });
 app.get('/api/admin/guest-quote-requests/events', async (req, res) => {
  try {
   await manager(req, 'view');
   stream(req, res, adminListeners);
  } catch (error) { return respond(res, error); }
 });
 app.post('/api/admin/guest-quote-requests/:id/send-to-warehouse', async (req, res) => {
  try {
   const actor = await manager(req, 'edit');
   const id = String(req.params.id || '');
   if (!uuidPattern.test(id)) throw fail(400, 'شناسه درخواست معتبر نیست.');
   const result = await transaction(async client => {
    const updated = await client.query(`
     update public.guest_quote_requests
        set status='sent_to_warehouse',sent_by=$2,sent_to_warehouse_at=now(),
            warehouse_assigned_to=null,warehouse_completed_at=null,updated_at=now()
      where id=$1 and status in ('new','warehouse_returned')
      returning id
    `, [id, actor || null]);
    if (!updated.rowCount) return false;
    await client.query(`
     update public.guest_quote_request_items
        set warehouse_status='pending',available_quantity=null,warehouse_note=null,
            reviewed_by=null,reviewed_at=null
      where request_id=$1
    `, [id]);
    return true;
   });
   if (!result) throw fail(409, 'این درخواست در وضعیت قابل ارجاع به انبارداری نیست.');
   await audit(actor, 'ارجاع درخواست پیش‌فاکتور به انبار', id);
   emit(adminListeners, 'guest-quote-updated');
   emit(warehouseListeners, 'warehouse-request-updated');
   return res.json({ success: true });
  } catch (error) { return respond(res, error); }
 });
 app.post('/api/admin/guest-quote-requests/:id/complete', async (req, res) => {
  try {
   const actor = await manager(req, 'edit');
   const id = String(req.params.id || '');
   if (!uuidPattern.test(id)) throw fail(400, 'شناسه درخواست معتبر نیست.');
   const result = await database().query(`
    update public.guest_quote_requests
       set status='completed',updated_at=now()
     where id=$1 and status='warehouse_returned'
     returning id
   `, [id]);
   if (!result.rowCount) throw fail(409, 'ابتدا باید نتیجه بررسی انبارداری دریافت شود.');
   await audit(actor, 'تکمیل درخواست پیش‌فاکتور', id);
   emit(adminListeners, 'guest-quote-updated');
   return res.json({ success: true });
  } catch (error) { return respond(res, error); }
 });

 // Separate warehouse identity/session. It cannot read the general admin portal.
 app.get('/api/warehouse/session', async (req, res) => {
  try {
   const actor = await warehouseActor(req, res);
   const profile = (await database().query(
    'select username,full_name from public.user_profiles where id=$1 and status=\'active\'',
    [actor.id]
   )).rows[0];
   res.setHeader('Cache-Control', 'private, no-store');
   return res.json({ success: true, user: { id: actor.id, username: profile?.username || '', name: profile?.full_name || actor.name } });
  } catch (error) { return respond(res, error); }
 });
 app.get('/api/warehouse/requests', async (req, res) => {
  try {
   const actor = await warehouseActor(req, res);
   res.setHeader('Cache-Control', 'private, no-store');
   const requests = await listRequests(
    database(),
    `where r.status in ('sent_to_warehouse','warehouse_reviewing')
       and (r.warehouse_assigned_to is null or r.warehouse_assigned_to=$1)`,
    [actor.id]
   );
   return res.json({ success: true, requests });
  } catch (error) { return respond(res, error); }
 });
 app.get('/api/warehouse/requests/events', async (req, res) => {
  try {
   await warehouseActor(req, res);
   stream(req, res, warehouseListeners);
  } catch (error) { return respond(res, error); }
 });
 app.post('/api/warehouse/requests/:id/claim', async (req, res) => {
  try {
   const actor = await warehouseActor(req, res, true);
   const id = String(req.params.id || '');
   if (!uuidPattern.test(id)) throw fail(400, 'شناسه درخواست معتبر نیست.');
   const result = await database().query(`
    update public.guest_quote_requests
       set warehouse_assigned_to=$2,status='warehouse_reviewing',updated_at=now()
     where id=$1 and status in ('sent_to_warehouse','warehouse_reviewing')
       and (warehouse_assigned_to is null or warehouse_assigned_to=$2)
     returning id
   `, [id, actor.id]);
   if (!result.rowCount) throw fail(409, 'این درخواست توسط انباردار دیگری دریافت شده یا دیگر در صف انبار نیست.');
   emit(adminListeners, 'guest-quote-updated');
   emit(warehouseListeners, 'warehouse-request-updated');
   return res.json({ success: true });
  } catch (error) { return respond(res, error); }
 });
 app.patch('/api/warehouse/requests/:id/items', async (req, res) => {
  try {
   const actor = await warehouseActor(req, res, true);
   const id = String(req.params.id || '');
   if (!uuidPattern.test(id)) throw fail(400, 'شناسه درخواست معتبر نیست.');
   if (!Array.isArray(req.body?.items) || req.body.items.length < 1 || req.body.items.length > 100)
    throw fail(400, 'فهرست اقلام بررسی‌شده معتبر نیست.');
   const items = req.body.items.map((raw: any) => {
    const itemId = String(raw?.id || '');
    const status = String(raw?.warehouseStatus || '');
    const rawAvailable = raw?.availableQuantity === null || raw?.availableQuantity === undefined || raw?.availableQuantity === ''
     ? null : Number(raw.availableQuantity);
    const available = status === 'unavailable' ? 0 : rawAvailable;
    const note = typeof raw?.warehouseNote === 'string' ? raw.warehouseNote.trim().slice(0, 1000) : '';
    if (!uuidPattern.test(itemId) || !['available','partial','unavailable'].includes(status) ||
        (available !== null && (!Number.isInteger(available) || available < 0 || available > 1000000)))
     throw fail(400, 'وضعیت موجودی یا تعداد یکی از اقلام معتبر نیست.');
    return { id: itemId, status, available, note };
   });
   await transaction(async client => {
    const request = (await client.query(
     'select status,warehouse_assigned_to from public.guest_quote_requests where id=$1 for update',
     [id]
    )).rows[0];
    if (!request || !['sent_to_warehouse','warehouse_reviewing'].includes(String(request.status)))
     throw fail(409, 'این درخواست دیگر در صف بررسی انبارداری نیست.');
    if (String(request.warehouse_assigned_to || '') !== actor.id)
     throw fail(403, 'ابتدا درخواست را از صف دریافت کنید؛ این درخواست به حساب شما واگذار نشده است.');
    await client.query(
     `update public.guest_quote_requests
         set status='warehouse_reviewing',updated_at=now()
       where id=$1 and warehouse_assigned_to=$2`,
     [id, actor.id]
    );
    for (const item of items) {
     const requested = (await client.query(
      'select quantity from public.guest_quote_request_items where id=$1 and request_id=$2',
      [item.id, id]
     )).rows[0];
     if (!requested) throw fail(400, 'یکی از اقلام به این درخواست تعلق ندارد.');
     const requestedQuantity = Number(requested.quantity);
     if (item.status === 'available' && (item.available === null || item.available < requestedQuantity))
      throw fail(400, 'برای وضعیت «موجود»، تعداد موجود باید برابر یا بیشتر از تعداد درخواستی باشد.');
     if (item.status === 'partial' && (item.available === null || item.available < 1 || item.available >= requestedQuantity))
      throw fail(400, 'برای وضعیت «موجودی ناکافی»، تعداد موجود باید بیشتر از صفر و کمتر از تعداد درخواستی باشد.');
     if (item.status === 'unavailable' && item.available !== 0)
      throw fail(400, 'برای کالای ناموجود، تعداد موجود باید صفر باشد.');
     const updated = await client.query(
      `update public.guest_quote_request_items
          set warehouse_status=$3,available_quantity=$4,warehouse_note=$5,
              reviewed_by=$6,reviewed_at=now()
        where id=$1 and request_id=$2 returning id`,
      [item.id, id, item.status, item.available, item.note || null, actor.id]
     );
     if (!updated.rowCount) throw fail(400, 'یکی از اقلام به این درخواست تعلق ندارد.');
    }
    const pending = (await client.query(
     'select count(*)::int as count from public.guest_quote_request_items where request_id=$1 and warehouse_status=\'pending\'',
     [id]
    )).rows[0]?.count || 0;
    await client.query(
     `update public.guest_quote_requests
         set status=$2,warehouse_completed_at=case when $2='warehouse_returned' then now() else null end,
             updated_at=now()
       where id=$1`,
     [id, Number(pending) === 0 ? 'warehouse_returned' : 'warehouse_reviewing']
    );
   });
   await audit(actor.id, 'ثبت نتیجه بررسی موجودی انبار', id);
   emit(adminListeners, 'guest-quote-updated');
   emit(warehouseListeners, 'warehouse-request-updated');
   return res.json({ success: true });
  } catch (error) { return respond(res, error); }
 });

 // Owner-only management of separate warehouse login accounts.
 app.get('/api/admin/warehouse/accounts', async (req, res) => {
  try {
   await owner(req);
   res.setHeader('Cache-Control', 'private, no-store');
   const result = await database().query(`
    select a.user_id as id,p.username,p.full_name as name,a.active,
           a.created_at as "createdAt",p.last_login_at as "lastLogin"
      from app_private.warehouse_operator_accounts a
      join public.user_profiles p on p.id=a.user_id
     order by a.created_at desc
   `);
   return res.json({ success: true, accounts: result.rows });
  } catch (error) { return respond(res, error); }
 });
 app.post('/api/admin/warehouse/accounts', async (req, res) => {
  let createdId: string | undefined;
  try {
   const actor = await owner(req);
   const username = String(req.body?.username || '').trim().toLowerCase();
   const name = String(req.body?.name || '').trim();
   const email = username + '.' + crypto.randomUUID().slice(0, 8) + '@warehouse.sanatpish.com';
   const password = req.body?.password;
   if (!usernamePattern.test(username)) throw fail(400, 'نام کاربری باید ۴ تا ۳۲ حرف انگلیسی، عدد یا زیرخط باشد و با حرف شروع شود.');
   if (name.length < 2 || name.length > 160) throw fail(400, 'نام انباردار باید بین ۲ تا ۱۶۰ نویسه باشد.');
   if (typeof password !== 'string' || password.length < 12 || password.length > 128)
    throw fail(400, 'رمز عبور باید حداقل ۱۲ و حداکثر ۱۲۸ نویسه باشد.');
   const existing = await database().query(
    'select id from public.user_profiles where lower(username)=$1 limit 1',
    [username]
   );
   if (existing.rowCount) throw fail(409, 'نام کاربری یا ایمیل قبلاً ثبت شده است.');
   const created = await adminAuth().auth.admin.createUser({
    email, password, email_confirm: true, app_metadata: { account_kind: 'warehouse_operator' }
   });
   if (created.error || !created.data.user) throw fail(400, 'ساخت حساب احراز هویت انباردار انجام نشد.');
   createdId = created.data.user.id;
   await transaction(async client => {
    await client.query(`
     insert into public.user_profiles(id,email,username,full_name,role,status,approved_b2b,can_view_prices,can_view_stock)
     values($1,$2,$3,$4,'warehouse_operator','active',false,false,false)
     on conflict(id) do update set
       email=excluded.email,username=excluded.username,full_name=excluded.full_name,
       role='warehouse_operator',status='active',approved_b2b=false,
       can_view_prices=false,can_view_stock=false,updated_at=now()
    `, [createdId, email, username, name]);
    await client.query(
     'insert into app_private.warehouse_operator_accounts(user_id,created_by) values($1,$2)',
     [createdId, actor]
    );
   });
   await audit(actor, 'ایجاد حساب انباردار', createdId);
   return res.status(201).json({ success: true, id: createdId });
  } catch (error) {
   if (createdId) { try { await adminAuth().auth.admin.deleteUser(createdId); } catch { /* best-effort Auth cleanup */ } }
   return respond(res, error);
  }
 });
 app.patch('/api/admin/warehouse/accounts/:id', async (req, res) => {
  try {
   const actor = await owner(req);
   const id = String(req.params.id || '');
   const active = req.body?.active;
   const name = req.body?.name;
   if (!uuidPattern.test(id)) throw fail(400, 'شناسه حساب معتبر نیست.');
   if (typeof active !== 'boolean') throw fail(400, 'وضعیت حساب باید مشخص باشد.');
   if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2 || name.length > 160))
    throw fail(400, 'نام انباردار معتبر نیست.');
   const count = await transaction(async client => {
    const updated = await client.query(
     'update app_private.warehouse_operator_accounts set active=$2,updated_at=now() where user_id=$1 returning user_id',
     [id, active]
    );
    if (!updated.rowCount) return 0;
    await client.query(
     `update public.user_profiles set status=$2::public.account_status_type,
             full_name=coalesce($3,full_name),updated_at=now()
       where id=$1 and role='warehouse_operator'`,
     [id, active ? 'active' : 'suspended', typeof name === 'string' ? name.trim() : null]
    );
    return updated.rowCount;
   });
   if (!count) throw fail(404, 'حساب انباردار پیدا نشد.');
   await audit(actor, active ? 'فعال‌سازی حساب انباردار' : 'غیرفعال‌سازی حساب انباردار', id);
   return res.json({ success: true });
  } catch (error) { return respond(res, error); }
 });
 app.post('/api/admin/warehouse/accounts/:id/reset-password', async (req, res) => {
  try {
   const actor = await owner(req);
   const id = String(req.params.id || '');
   const password = req.body?.password;
   if (!uuidPattern.test(id)) throw fail(400, 'شناسه حساب معتبر نیست.');
   if (typeof password !== 'string' || password.length < 12 || password.length > 128)
    throw fail(400, 'رمز عبور باید حداقل ۱۲ نویسه باشد.');
   if (!(await database().query(
    'select 1 from app_private.warehouse_operator_accounts where user_id=$1',
    [id]
   )).rowCount) throw fail(404, 'حساب انباردار پیدا نشد.');
   const updated = await adminAuth().auth.admin.updateUserById(id, { password });
   if (updated.error) throw fail(503, 'بازنشانی رمز حساب انباردار انجام نشد.');
   await audit(actor, 'بازنشانی رمز حساب انباردار', id);
   return res.json({ success: true });
  } catch (error) { return respond(res, error); }
 });
}
