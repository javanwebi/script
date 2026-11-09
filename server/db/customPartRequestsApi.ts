import type { Express, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import { database, databaseEnabled, adoptedSchema } from './connection';
import { getPortalIdentity } from '../../api/portal';
import { canStaff } from './staffPermissions';
import { refreshAuth } from './supabaseAuth';

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const PUBLIC_WINDOW_MS = 10 * 60 * 1000;
const PUBLIC_WINDOW_LIMIT = 4;
const publicWindows = new Map<string, { startedAt: number; count: number }>();
const statuses = new Set(['new', 'reviewing', 'quoted', 'accepted', 'rejected', 'completed']);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.dwg', '.dxf', '.step', '.stp']);
const imageMimes: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
const cleanText = (value: unknown, max = 500) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)
  : '';
const normalizePhone = (value: unknown) => cleanText(value, 40)
  .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
  .replace(/[^0-9]/g, '');

function assertSameOrigin(req: Request) {
  const origin = req.headers.origin;
  if (!origin) return;
  let host = '';
  try { host = new URL(origin).host; } catch { throw fail(403, 'مبدأ درخواست معتبر نیست.'); }
  if (host !== req.headers.host) throw fail(403, 'مبدأ درخواست معتبر نیست.');
}

function enforcePublicRateLimit(req: Request) {
  const key = String(req.ip || req.socket.remoteAddress || 'unknown').slice(0, 100);
  const now = Date.now();
  let bucket = publicWindows.get(key);
  if (!bucket || now - bucket.startedAt >= PUBLIC_WINDOW_MS) {
    bucket = { startedAt: now, count: 0 };
    publicWindows.set(key, bucket);
  }
  if (bucket.count >= PUBLIC_WINDOW_LIMIT) throw fail(429, 'تعداد درخواست‌های ثبت‌شده در این بازه زیاد است؛ کمی بعد دوباره تلاش کنید.');
  bucket.count += 1;
  if (publicWindows.size > 2048) {
    for (const [ip, value] of publicWindows) {
      if (now - value.startedAt >= PUBLIC_WINDOW_MS) publicWindows.delete(ip);
    }
  }
}

function readAttachment(body: Record<string, unknown>) {
  const encoded = cleanText(body.attachmentBase64, Math.ceil(MAX_ATTACHMENT_BYTES * 4 / 3) + 4096);
  const suppliedName = cleanText(body.attachmentName, 180);
  if (!encoded) {
    if (suppliedName) throw fail(400, 'فایل پیوست معتبر نیست؛ دوباره انتخاب کنید.');
    return { name: null, mime: null, size: null, bytes: null as Buffer | null };
  }
  if (!suppliedName) throw fail(400, 'نام فایل پیوست مشخص نیست.');
  const name = basename(suppliedName).replace(/[\r\n]/g, '_').slice(0, 180);
  const extension = extname(name).toLowerCase();
  if (!allowedExtensions.has(extension)) throw fail(415, 'فرمت فایل پشتیبانی نمی‌شود. JPG، PNG، WebP، PDF، DWG، DXF یا STEP ارسال کنید.');
  const raw = encoded.replace(/^data:[^,]*;base64,/i, '');
  if (!raw || !/^[A-Za-z0-9+/]*={0,2}$/.test(raw)) throw fail(400, 'محتوای فایل معتبر نیست.');
  const bytes = Buffer.from(raw, 'base64');
  if (!bytes.length) throw fail(400, 'فایل خالی است.');
  if (bytes.length > MAX_ATTACHMENT_BYTES) throw fail(413, 'حجم فایل باید حداکثر ۸ مگابایت باشد.');
  const mime = imageMimes[extension] || (extension === '.pdf' ? 'application/pdf' : 'application/octet-stream');
  return { name, mime, size: bytes.length, bytes };
}

async function staffIdentity(req: Request, res: Response, action: 'view' | 'edit') {
  if (!databaseEnabled() || !adoptedSchema()) throw fail(503, 'مدیریت درخواست ساخت به دیتابیس اصلی صنعت پیش نیاز دارد.');
  if (req.method !== 'GET') {
    assertSameOrigin(req);
    if (!req.is('application/json')) throw fail(415, 'فرمت درخواست باید JSON باشد.');
  }
  await refreshAuth(req, res);
  const identity = await getPortalIdentity(req);
  if (!identity.user || !canStaff(identity, 'crm', action)) throw fail(403, 'مجوز دسترسی به درخواست‌های ساخت وجود ندارد.');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie');
  return identity;
}

function respond(res: Response, error: unknown) {
  const e = error as { status?: number; code?: string; message?: string };
  const status = e?.status || (e?.code === '23505' ? 409 : 503);
  if (status >= 500) console.error('[Custom part requests]', e?.code || e?.message || 'database unavailable');
  return res.status(status).json({
    success: false,
    message: status >= 500 ? 'ثبت یا دریافت درخواست ساخت از پایگاه داده ممکن نشد.' : (e.message || 'درخواست انجام نشد.'),
  });
}

export function registerCustomPartRequestsApi(app: Express) {
  // Public endpoint: guest customers can submit a manufacturing request without creating an account.
  app.post('/api/custom-part-requests', async (req, res) => {
    try {
      if (!databaseEnabled() || !adoptedSchema()) throw fail(503, 'ثبت درخواست ساخت موقتاً در دسترس نیست.');
      assertSameOrigin(req);
      if (!req.is('application/json')) throw fail(415, 'فرمت درخواست باید JSON باشد.');
      enforcePublicRateLimit(req);

      const contactName = cleanText(req.body?.contactName, 120);
      const phone = normalizePhone(req.body?.phoneNumber || req.body?.phone);
      const partName = cleanText(req.body?.partName, 180);
      const partType = cleanText(req.body?.partType, 160);
      const dimensions = cleanText(req.body?.dimensions, 500);
      const alloyCondition = cleanText(req.body?.alloyCondition, 500);
      const quantity = cleanText(req.body?.quantity, 80) || '1';
      const companyName = cleanText(req.body?.companyName, 180);
      const email = cleanText(req.body?.email, 180).toLowerCase();
      const notes = cleanText(req.body?.notes, 3000);
      if (contactName.length < 2) throw fail(400, 'نام و نام خانوادگی را وارد کنید.');
      if (phone.length < 10 || phone.length > 15) throw fail(400, 'شماره تماس معتبر وارد کنید.');
      if (partName.length < 2) throw fail(400, 'عنوان قطعه را وارد کنید.');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, 'نشانی ایمیل معتبر نیست.');

      const attachment = readAttachment(req.body || {});
      let customerUserId: string | null = null;
      try {
        const identity = await getPortalIdentity(req);
        if (identity.user && !identity.admin && !identity.staff) {
          customerUserId = String(identity.user.authUserId || identity.user.id || '') || null;
        }
      } catch { /* Guest submissions remain supported. */ }

      const trackingCode = 'SP-MFG-' + randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
      const result = await database().query(
        `insert into public.custom_part_requests
          (tracking_code, contact_name, phone, email, company_name, part_name, part_type,
           dimensions, alloy_condition, quantity, notes, attachment_name, attachment_mime,
           attachment_size, attachment_bytes, customer_user_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         returning id::text, tracking_code, created_at`,
        [trackingCode, contactName, phone, email || null, companyName || null, partName, partType || null,
          dimensions || null, alloyCondition || null, quantity, notes || null, attachment.name, attachment.mime,
          attachment.size, attachment.bytes, customerUserId],
      );
      const row = result.rows[0];
      res.setHeader('Cache-Control', 'no-store');
      return res.status(201).json({ success: true, trackingCode: row.tracking_code, createdAt: row.created_at });
    } catch (error) { return respond(res, error); }
  });

  app.get('/api/admin/custom-part-requests', async (req, res) => {
    try {
      await staffIdentity(req, res, 'view');
      const query = cleanText(req.query.q, 120);
      const status = cleanText(req.query.status, 30);
      if (status && status !== 'all' && !statuses.has(status)) throw fail(400, 'وضعیت درخواست معتبر نیست.');
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
      const offset = Math.max(0, Math.min(100000, Number(req.query.offset) || 0));
      const rows = await database().query(
        `select id::text, tracking_code, contact_name, phone, email, company_name, part_name,
                part_type, dimensions, alloy_condition, quantity, notes, attachment_name,
                attachment_mime, attachment_size, (attachment_bytes is not null) as has_attachment,
                status, internal_note, quote_amount, quote_currency, created_at, updated_at
           from public.custom_part_requests
          where ($1::text is null or status=$1)
            and ($2='' or tracking_code ilike '%'||$2||'%' or contact_name ilike '%'||$2||'%'
                 or phone ilike '%'||$2||'%' or part_name ilike '%'||$2||'%' or company_name ilike '%'||$2||'%')
          order by created_at desc limit $3 offset $4`,
        [status && status !== 'all' ? status : null, query, limit, offset],
      );
      const count = await database().query(
        `select count(*)::int as total from public.custom_part_requests
          where ($1::text is null or status=$1)
            and ($2='' or tracking_code ilike '%'||$2||'%' or contact_name ilike '%'||$2||'%'
                 or phone ilike '%'||$2||'%' or part_name ilike '%'||$2||'%' or company_name ilike '%'||$2||'%')`,
        [status && status !== 'all' ? status : null, query],
      );
      return res.json({ success: true, rows: rows.rows, total: Number(count.rows[0]?.total || 0) });
    } catch (error) { return respond(res, error); }
  });

  app.get('/api/admin/custom-part-requests/:id/attachment', async (req, res) => {
    try {
      await staffIdentity(req, res, 'view');
      const id = String(req.params.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw fail(400, 'شناسه درخواست معتبر نیست.');
      const result = await database().query(
        'select attachment_name, attachment_mime, attachment_bytes from public.custom_part_requests where id=$1',
        [id],
      );
      const row = result.rows[0];
      if (!row?.attachment_bytes) throw fail(404, 'فایل پیوست پیدا نشد.');
      const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/octet-stream']);
      const mime = allowedMime.has(String(row.attachment_mime)) ? String(row.attachment_mime) : 'application/octet-stream';
      const name = basename(String(row.attachment_name || 'attachment')).replace(/[\r\n"]/g, '_');
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `${mime.startsWith('image/') ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(name)}`);
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.end(row.attachment_bytes);
    } catch (error) { return respond(res, error); }
  });

  app.patch('/api/admin/custom-part-requests/:id', async (req, res) => {
    try {
      await staffIdentity(req, res, 'edit');
      const id = String(req.params.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw fail(400, 'شناسه درخواست معتبر نیست.');
      const updates: string[] = [];
      const values: unknown[] = [id];
      const add = (column: string, value: unknown) => { values.push(value); updates.push(column + '=$' + values.length); };
      if (req.body?.status !== undefined) {
        const status = cleanText(req.body.status, 30);
        if (!statuses.has(status)) throw fail(400, 'وضعیت درخواست معتبر نیست.');
        add('status', status);
      }
      if (req.body?.internalNote !== undefined) add('internal_note', cleanText(req.body.internalNote, 3000) || null);
      if (req.body?.quoteAmount !== undefined) {
        const raw = req.body.quoteAmount;
        const amount = raw === null || raw === '' ? null : Number(raw);
        if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 1e15)) throw fail(400, 'مبلغ پیشنهادی معتبر نیست.');
        add('quote_amount', amount);
        const currency = cleanText(req.body.quoteCurrency || 'IRT', 8).toUpperCase();
        if (!['IRT', 'IRR', 'USD', 'EUR'].includes(currency)) throw fail(400, 'واحد مبلغ معتبر نیست.');
        add('quote_currency', currency);
      }
      if (!updates.length) throw fail(400, 'تغییری برای ذخیره ارسال نشده است.');
      updates.push('updated_at=now()');
      const result = await database().query(
        `update public.custom_part_requests set ${updates.join(', ')} where id=$1
          returning id::text, tracking_code, status, internal_note, quote_amount, quote_currency, updated_at`,
        values,
      );
      if (!result.rows[0]) throw fail(404, 'درخواست ساخت پیدا نشد.');
      return res.json({ success: true, request: result.rows[0] });
    } catch (error) { return respond(res, error); }
  });
}
