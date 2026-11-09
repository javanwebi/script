import type { Express, Request, Response } from 'express';
import { database, databaseEnabled, adoptedSchema } from './connection';
import { getPortalIdentity } from '../../api/portal';
import { canStaff } from './staffPermissions';
import { refreshAuth } from './supabaseAuth';

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
const cleanText = (value: unknown, max = 500) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)
  : '';
const codeList = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.map(item => cleanText(item, 110)).filter(item => /^[\p{L}\p{N}_.:-]{1,110}$/u.test(item)))].slice(0, 40)
  : [];
const jsonResult = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  // Never accept image bytes, data URLs, permanent image URLs, or server paths.
  const forbidden = Object.keys(raw).filter(key => /(base64|dataurl|imageurl|storagepath|filepath|imagebytes|bloburl)/i.test(key));
  if (forbidden.length) throw fail(400, 'اطلاعات تصویر نباید به دیتابیس ارسال شود؛ فقط نتیجه شناسایی مجاز است.');
  const safe = {
    confidence: Number.isFinite(Number(raw.confidence)) ? Math.max(0, Math.min(100, Number(raw.confidence))) : null,
    technicalAdvice: cleanText(raw.technicalAdvice, 2500),
    recognizedSummary: cleanText(raw.summary, 2500),
  };
  return safe;
};

type Identity = Awaited<ReturnType<typeof getPortalIdentity>>;
const customer360Enabled = () => process.env.CUSTOMER_360_LOCAL_VAULT_ENABLED === 'true';

async function customerIdentity(req: Request, res: Response) {
  if (!customer360Enabled()) throw fail(503, 'ثبت سوابق CRM تا فعال‌سازی کنترل‌شده این قابلیت در دسترس نیست.');
  if (!databaseEnabled() || !adoptedSchema()) throw fail(503, 'ثبت سوابق مشتری به دیتابیس اصلی نیاز دارد.');
  await refreshAuth(req, res);
  const identity = await getPortalIdentity(req);
  const userId = String(identity.user?.authUserId || identity.user?.id || '');
  if (!identity.user || !userId || identity.admin || identity.staff) throw fail(401, 'برای ثبت سوابق، ابتدا وارد حساب مشتری خود شوید.');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie');
  return { identity, userId };
}

async function staffIdentity(req: Request, res: Response, action = 'view'): Promise<Identity> {
  if (!customer360Enabled()) throw fail(503, 'قابلیت‌های تکمیلی CRM هنوز فعال نشده‌اند.');
  if (!databaseEnabled() || !adoptedSchema()) throw fail(503, 'CRM فقط با دیتابیس اصلی صنعت پیش در دسترس است.');
  if (req.method !== 'GET') {
    const origin = req.headers.origin;
    if (origin) {
      let host = '';
      try { host = new URL(origin).host; } catch { throw fail(403, 'مبدأ درخواست معتبر نیست.'); }
      if (host !== req.headers.host) throw fail(403, 'مبدأ درخواست معتبر نیست.');
    }
    if (!req.is('application/json')) throw fail(415, 'فرمت درخواست باید JSON باشد.');
  }
  await refreshAuth(req, res);
  const identity = await getPortalIdentity(req);
  if (!identity.user || !canStaff(identity, 'crm', action)) throw fail(403, 'مجوز دسترسی به پرونده مشتریان وجود ندارد.');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie');
  return identity;
}

function respond(res: Response, error: unknown) {
  const e = error as { status?: number; code?: string; message?: string };
  const status = e?.code === '23505' ? 409 : e?.status || 503;
  if (status >= 500) console.error('[Customer Intelligence]', e?.code || e?.message || 'database unavailable');
  return res.status(status).json({
    success: false,
    message: status >= 500 ? 'ارتباط با پایگاه داده سوابق مشتری برقرار نشد.' : (e.message || 'درخواست انجام نشد.'),
  });
}

async function resolveCustomerUserId(key: string): Promise<string> {
  if (key.startsWith('profile:')) {
    const id = key.slice(8);
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw fail(400, 'شناسه مشتری نامعتبر است.');
    const row = (await database().query('select id from public.user_profiles where id=$1', [id])).rows[0];
    if (!row) throw fail(404, 'مشتری پیدا نشد.');
    return row.id;
  }
  if (key.startsWith('crm:')) {
    const id = key.slice(4);
    if (!id || id.length > 160) throw fail(400, 'شناسه مشتری نامعتبر است.');
    const row = (await database().query('select auth_user_id from public.crm_customers where id=$1', [id])).rows[0];
    if (!row?.auth_user_id) throw fail(409, 'این مخاطب هنوز حساب کاربری متصل ندارد؛ سوابق دیجیتال برای حساب ثبت‌شده قابل نمایش است.');
    return row.auth_user_id;
  }
  throw fail(400, 'شناسه مشتری معتبر نیست.');
}

export function registerCustomerIntelligenceApi(app: Express) {
  app.post('/api/customer-intelligence/image-identifications', async (req, res) => {
    try {
      const { userId } = await customerIdentity(req, res);
      const deviceImageId = cleanText(req.body?.deviceImageId, 120);
      const sha256 = cleanText(req.body?.sha256, 64).toLowerCase();
      const mimeType = cleanText(req.body?.mimeType, 40).toLowerCase();
      const sizeBytes = Number(req.body?.sizeBytes);
      const originalName = cleanText(req.body?.originalName, 180);
      if (!deviceImageId || !/^[a-z0-9-]{8,120}$/i.test(deviceImageId)) throw fail(400, 'شناسه محلی تصویر معتبر نیست.');
      if (!/^[a-f0-9]{64}$/.test(sha256)) throw fail(400, 'اثر انگشت تصویر معتبر نیست.');
      if (!['image/jpeg','image/png','image/webp'].includes(mimeType)) throw fail(400, 'نوع تصویر پشتیبانی نمی‌شود.');
      if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 10 * 1024 * 1024) throw fail(413, 'حجم تصویر مجاز نیست.');
      if (req.body?.image || req.body?.imageBase64 || req.body?.dataUrl || req.body?.imageUrl || req.body?.storagePath) {
        throw fail(400, 'فایل تصویر فقط روی دستگاه مشتری نگهداری می‌شود و نباید به سرور ارسال شود.');
      }
      const result = await database().query(
        `insert into public.customer_image_identifications
          (user_id,device_image_id,image_sha256,mime_type,file_size,original_name,recognition_status)
         values($1,$2,$3,$4,$5,$6,'submitted')
         on conflict(user_id,device_image_id) do update set
          image_sha256=excluded.image_sha256,mime_type=excluded.mime_type,
          file_size=excluded.file_size,original_name=excluded.original_name,updated_at=now()
         returning id`,
        [userId,deviceImageId,sha256,mimeType,sizeBytes,originalName]
      );
      return res.status(201).json({ success: true, id: result.rows[0].id, deviceImageId });
    } catch (error) { return respond(res, error); }
  });

  app.post('/api/customer-intelligence/image-identifications/:id/result', async (req, res) => {
    try {
      const { userId } = await customerIdentity(req, res);
      const id = cleanText(req.params.id, 64);
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw fail(400, 'شناسه سابقه تصویر معتبر نیست.');
      const status = ['completed','failed','unmatched'].includes(req.body?.status) ? req.body.status : 'failed';
      const detectedPartType = cleanText(req.body?.detectedPartType, 180);
      const summary = cleanText(req.body?.summary, 2500);
      const selectedProductCode = cleanText(req.body?.selectedProductCode, 110);
      const matched = codeList(req.body?.matchedProductCodes);
      const similar = codeList(req.body?.similarProductCodes);
      const safe = jsonResult(req.body);
      const updated = await database().query(
        `update public.customer_image_identifications set
          recognition_status=$3,detected_part_type=$4,recognized_summary=$5,
          selected_product_code=nullif($6,''),matched_product_codes=$7::jsonb,
          similar_product_codes=$8::jsonb,recognition_result=$9::jsonb,
          updated_at=now()
         where id=$1 and user_id=$2 returning id`,
        [id,userId,status,detectedPartType,summary,selectedProductCode,JSON.stringify(matched),JSON.stringify(similar),JSON.stringify(safe)]
      );
      if (!updated.rowCount) throw fail(404, 'سابقه شناسایی متعلق به این حساب نیست یا پیدا نشد.');
      return res.json({ success: true });
    } catch (error) { return respond(res, error); }
  });

  app.post('/api/customer-intelligence/image-identifications/:id/select', async (req, res) => {
    try {
      const { userId } = await customerIdentity(req, res);
      const id = cleanText(req.params.id, 64);
      const productCode = cleanText(req.body?.productCode, 110);
      if (!/^[0-9a-f-]{36}$/i.test(id) || !productCode) throw fail(400, 'شناسه سابقه یا کد محصول معتبر نیست.');
      const product = await database().query('select code from public.catalog_variants where code=$1 limit 1', [productCode]);
      if (!product.rowCount) throw fail(404, 'کد انتخاب‌شده در کاتالوگ واقعی پیدا نشد.');
      const updated = await database().query(
        'update public.customer_image_identifications set selected_product_code=$3,updated_at=now() where id=$1 and user_id=$2 returning id',
        [id,userId,productCode]
      );
      if (!updated.rowCount) throw fail(404, 'سابقه شناسایی متعلق به این حساب نیست یا پیدا نشد.');
      return res.json({ success: true });
    } catch (error) { return respond(res, error); }
  });

  app.post('/api/customer-intelligence/consultations', async (req, res) => {
    try {
      const { userId } = await customerIdentity(req, res);
      const sessionId = cleanText(req.body?.sessionId, 120);
      const title = cleanText(req.body?.title, 180) || 'گفتگوی فنی';
      const summary = cleanText(req.body?.summary, 2500);
      const products = Array.isArray(req.body?.products) ? req.body.products.slice(0, 40).map((item: any) => ({
        code: cleanText(item?.code, 110),
        name: cleanText(item?.name, 180),
      })).filter((item: any) => item.code && /^[\p{L}\p{N}_.:-]{1,110}$/u.test(item.code)) : [];
      const productCodes = codeList(req.body?.productCodes || products.map((item: any) => item.code));
      const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-100).map((item: any) => ({
        id: cleanText(item?.id, 120),
        role: item?.role === 'assistant' || item?.role === 'model' ? 'assistant' : 'user',
        text: cleanText(item?.text, 8000),
        createdAt: Number.isFinite(Number(item?.createdAt)) ? Number(item.createdAt) : null,
      })).filter((item: any) => item.id && item.text) : [];
      if (!sessionId) throw fail(400, 'شناسه گفتگوی FORZA معتبر نیست.');
      const count = messages.length;
      await database().query(
        `insert into public.customer_ai_consultations
          (user_id,id,title,summary,status,messages,product_codes,message_count,started_at,last_message_at,updated_at)
         values($1,$2,$3,$4,'open',$5::jsonb,$6::jsonb,$7,now(),now(),now())
         on conflict(user_id,id) do update set
          title=excluded.title,summary=excluded.summary,messages=excluded.messages,
          product_codes=excluded.product_codes,message_count=excluded.message_count,
          last_message_at=now(),updated_at=now()`,
        [userId,sessionId,title,summary,JSON.stringify(messages),JSON.stringify(productCodes),count]
      );
      for (const code of productCodes) {
        const selectedProduct = products.find((item: any) => item.code === code);
        const productName = selectedProduct?.name || code;
        const linked = await database().query(
          `insert into public.customer_product_consultation_items
            (user_id,consultation_id,product_code,product_name)
           values($1,$2,$3,$4)
           on conflict(user_id,consultation_id,product_code) do nothing
           returning id`,
          [userId,sessionId,code,productName]
        );
        if (linked.rowCount) {
          await database().query(
            `insert into public.customer_product_interests
              (user_id,product_code,product_name,interaction_count,last_seen_at,last_consultation_id)
             values($1,$2,$3,1,now(),$4)
             on conflict(user_id,product_code) do update set
              product_name=case when excluded.product_name='' then public.customer_product_interests.product_name else excluded.product_name end,
              interaction_count=public.customer_product_interests.interaction_count+1,
              last_seen_at=now(),last_consultation_id=excluded.last_consultation_id`,
            [userId,code,productName,sessionId]
          );
        } else {
          await database().query(
            `update public.customer_product_interests set
              product_name=case when $3='' then product_name else $3 end,
              last_seen_at=now(),last_consultation_id=$4
             where user_id=$1 and product_code=$2`,
            [userId,code,productName,sessionId]
          );
        }
      }
      return res.json({ success: true, messageCount: count, productCount: productCodes.length });
    } catch (error) { return respond(res, error); }
  });

  app.get('/api/admin/crm/images', async (req, res) => {
    try {
      if (!customer360Enabled()) return res.json({ success: true, enabled: false, rows: [] });
      await staffIdentity(req, res, 'view');
      const limit = Math.max(1, Math.min(300, Number(req.query.limit) || 100));
      const search = cleanText(req.query.q, 120);
      const result = await database().query(
        `select i.id,i.user_id,i.device_image_id,i.image_sha256,i.mime_type,i.file_size,
          i.original_name,i.recognition_status,i.detected_part_type,i.recognized_summary,
          i.selected_product_code,i.matched_product_codes,i.similar_product_codes,i.created_at,
          coalesce(nullif(u.full_name,''),c.name,'مشتری ثبت‌نام‌شده') as customer_name,
          coalesce(nullif(u.company_name,''),c.company,'') as company,
          coalesce(u.phone,c.phone,'') as phone
         from public.customer_image_identifications i
         left join public.user_profiles u on u.id=i.user_id
         left join public.crm_customers c on c.auth_user_id=i.user_id
         where ($2='' or coalesce(u.full_name,c.name,'') ilike '%'||$2||'%' or
           coalesce(u.company_name,c.company,'') ilike '%'||$2||'%' or
           coalesce(u.phone,c.phone,'') ilike '%'||$2||'%' or
           coalesce(i.detected_part_type,'') ilike '%'||$2||'%' or
           coalesce(i.selected_product_code,'') ilike '%'||$2||'%')
         order by i.created_at desc limit $1`,
        [limit,search]
      );
      // Intentionally no image URL or bytes are returned to the administrator.
      return res.json({ success: true, enabled: true, rows: result.rows });
    } catch (error) { return respond(res, error); }
  });

  app.get('/api/admin/crm/customers/:key/followups', async (req, res) => {
    try {
      if (!customer360Enabled()) return res.json({ success: true, enabled: false, rows: [] });
      await staffIdentity(req, res, 'view');
      const userId = await resolveCustomerUserId(req.params.key);
      const result = await database().query(
        `select f.id,f.user_id,f.assigned_staff_id,f.created_by,f.title,f.notes,f.status,
          f.due_at,f.completed_at,f.created_at,f.updated_at,
          coalesce(u.full_name,u.username,'') as assigned_staff_name
         from public.customer_followups f
         left join public.user_profiles u on u.id=f.assigned_staff_id
         where f.user_id=$1 order by f.due_at asc nulls last,f.created_at desc limit 100`,
        [userId]
      );
      return res.json({ success: true, rows: result.rows });
    } catch (error) { return respond(res, error); }
  });

  app.post('/api/admin/crm/customers/:key/followups', async (req, res) => {
    try {
      const identity = await staffIdentity(req, res, 'edit');
      const userId = await resolveCustomerUserId(req.params.key);
      const title = cleanText(req.body?.title, 180);
      const notes = cleanText(req.body?.notes, 2000);
      const dueAt = req.body?.dueAt ? new Date(req.body.dueAt) : null;
      if (title.length < 2) throw fail(400, 'عنوان پیگیری باید حداقل دو نویسه باشد.');
      if (dueAt && !Number.isFinite(dueAt.getTime())) throw fail(400, 'زمان پیگیری معتبر نیست.');
      const assignedStaffId = cleanText(req.body?.assignedStaffId, 64);
      const result = await database().query(
        `insert into public.customer_followups(user_id,assigned_staff_id,created_by,title,notes,due_at)
         values($1,$2,$3,$4,$5,$6) returning id`,
        [userId,assignedStaffId || null,identity.user?.authUserId || null,title,notes,dueAt]
      );
      return res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (error) { return respond(res, error); }
  });

  app.patch('/api/admin/crm/followups/:id', async (req, res) => {
    try {
      await staffIdentity(req, res, 'edit');
      const id = cleanText(req.params.id, 64);
      const status = ['pending','in_progress','completed','cancelled'].includes(req.body?.status) ? req.body.status : null;
      if (!/^[0-9a-f-]{36}$/i.test(id) || !status) throw fail(400, 'وضعیت یا شناسه پیگیری معتبر نیست.');
      const result = await database().query(
        `update public.customer_followups set status=$2,
          completed_at=case when $2='completed' then now() else null end,updated_at=now()
         where id=$1 returning id`,
        [id,status]
      );
      if (!result.rowCount) throw fail(404, 'پیگیری پیدا نشد.');
      return res.json({ success: true });
    } catch (error) { return respond(res, error); }
  });
}
