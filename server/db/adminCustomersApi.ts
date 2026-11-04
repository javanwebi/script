import type { Express, Request, Response } from 'express';
import crypto from 'node:crypto';
import { database, databaseEnabled, adoptedSchema, transaction, type SqlClient } from './connection';
import { getPortalIdentity } from '../../api/portal';
import { canStaff } from './staffPermissions';
import { refreshAuth } from './supabaseAuth';

/**
 * The CRM reads/writes the real adopted PostgreSQL tables. It never falls back
 * to browser documents, mock customers, invented lifetime spend or passwords.
 * A newly created CRM contact is not an Auth account until verified signup.
 */
const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
const text = (raw: unknown, max = 180) => typeof raw === 'string' ? raw.trim().slice(0, max) : '';
const emailOk = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const portalKind = (value: unknown) => value === 'high_volume' ? 'high_volume' : 'retail';
const uuid = () => crypto.randomUUID();
const customerKey = (value: unknown) => {
  const key = text(value, 160);
  if (!/^(crm:[a-zA-Z0-9_-]{1,100}|profile:[0-9a-f-]{36})$/i.test(key))
    throw fail(400, 'شناسه مشتری معتبر نیست.');
  return { source: key.startsWith('crm:') ? 'crm' : 'profile', id: key.split(':').slice(1).join(':') };
};
export function normalizeCrmPhone(raw: unknown): string {
  const digits = String(raw || '')
    .replace(/[۰-۹]/g, x => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x)))
    .replace(/[٠-٩]/g, x => String('٠١٢٣٤٥٦٧٨٩'.indexOf(x)))
    .replace(/[\s()-]/g, '')
    .replace(/^(\+98|0098|98)/, '0');
  if (!/^09\d{9}$/.test(digits)) throw fail(400, 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.');
  return digits;
}

const base = [
  "select 'crm:' || c.id as id, 'crm' as source, c.id as crm_id, c.auth_user_id as user_id,",
  "coalesce(nullif(u.full_name,''),c.name) as name, coalesce(nullif(u.company_name,''),c.company) as company,",
  "coalesce(nullif(u.phone,''),c.phone) as phone, coalesce(nullif(u.email,''),c.email) as email,",
  "coalesce(nullif(u.city,''),c.city) as city, coalesce(nullif(u.province,''),c.province) as province,",
  "coalesce(u.approved_b2b,c.approved_b2b,false) as approved_b2b,",
  "coalesce(u.grade_code,c.grade_code) as grade_code,",
  "coalesce(u.assigned_price_list_id,c.assigned_price_list_id) as assigned_price_list_id,",
  "case when u.id is null then c.credit_limit else u.credit_limit end as credit_limit,",
  "case when u.id is null then c.used_credit else u.credit_used end as credit_used,",
  "u.current_debt, c.notes, c.approval_status, u.last_login_at,",
  "coalesce(u.created_at,c.created_at) as created_at,",
  "case when u.id is null then false else true end as has_login",
  "from public.crm_customers c left join public.user_profiles u on u.id=c.auth_user_id",
  "where u.id is null or u.role::text not in ('super_admin','warehouse_operator','sales_manager')",
  "union all",
  "select 'profile:' || u.id as id, 'profile' as source, null::text as crm_id, u.id as user_id,",
  "u.full_name as name, u.company_name as company, u.phone, u.email, u.city, u.province,",
  "u.approved_b2b, u.grade_code, u.assigned_price_list_id, u.credit_limit,",
  "u.credit_used, u.current_debt, null::text as notes,",
  "case when u.approved_b2b then 'approved' else 'pending' end as approval_status,",
  "u.last_login_at,u.created_at,true as has_login",
  "from public.user_profiles u",
  "where u.role::text not in ('super_admin','warehouse_operator','sales_manager')",
  "and not exists (select 1 from public.crm_customers c where c.auth_user_id=u.id)"
].join(' ');

const completed = "o.status::text in ('confirmed','packing','shipped','delivered') and coalesce(o.payment_status,'') not in ('failed','refunded','cancelled')";
const amount = "coalesce(nullif(o.final_amount,0),o.total_amount,0) / case when o.currency='IRR' then 10 else 1 end";
const stats = [
  "left join lateral (select count(*)::int as order_count,",
  "coalesce(sum(" + amount + "),0)::numeric as total_spent, max(o.created_at) as last_order_at",
  "from public.orders o where (" + completed + ")",
  "and ((b.user_id is not null and o.user_id=b.user_id)",
  "or (b.crm_id is not null and o.crm_customer_id=b.crm_id))) s on true"
].join(' ');
const cols = "b.*,coalesce(s.order_count,0) as order_count,coalesce(s.total_spent,0) as total_spent,s.last_order_at";
const selection = "from (" + base + ") b " + stats;
type Identity = Awaited<ReturnType<typeof getPortalIdentity>>;

async function guard(req: Request, res: Response, action = 'view'): Promise<Identity> {
  if (!databaseEnabled() || !adoptedSchema()) throw fail(503, 'CRM فقط با دیتابیس واقعی صنعت پیش در دسترس است.');
  if (req.method !== 'GET') {
    const origin = req.headers.origin;
    if (origin) {
      let host = '';
      try { host = new URL(origin).host; } catch { throw fail(403, 'مبدأ درخواست نامعتبر است.'); }
      if (host !== req.headers.host) throw fail(403, 'مبدأ درخواست نامعتبر است.');
    }
    if (!req.is('application/json')) throw fail(415, 'فرمت درخواست باید JSON باشد.');
  }
  await refreshAuth(req, res);
  // refreshAuth writes cookies to the response; getPortalIdentity uses the original
  // cookie. Existing sessions work normally, and expired sessions fail closed.
  const identity = await getPortalIdentity(req);
  if (!identity.user || !canStaff(identity, 'crm', action)) throw fail(403, 'مجوز دسترسی به CRM وجود ندارد.');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie');
  return identity;
}
function respond(res: Response, error: unknown) {
  const e = error as { status?: number; code?: string; message?: string };
  const code = e?.code === '23505' ? 409 : e?.status || 503;
  if (code >= 500) console.error('[CRM]', e?.code || e?.message || 'database unavailable');
  return res.status(code).json({ success: false, message: code >= 500 ? 'ارتباط با دیتابیس CRM برقرار نشد.' : (e.message || 'درخواست انجام نشد.') });
}
async function audit(client: SqlClient, identity: Identity, action: string, target: string, details: string) {
  await client.query(
    "insert into public.audit_logs (id,user_id,user_name,user_role,action,entity,target,details,extra_payload) values ($1,$2,$3,$4,$5,'crm_customers',$6,$7,'{}'::jsonb)",
    ['crm-' + uuid(), identity.user?.authUserId || null, identity.user?.fullName || 'مدیریت', identity.admin ? 'super_admin' : 'staff', action, target, details]
  );
}
async function loadOne(key: string) {
  const result = await database().query("select " + cols + " " + selection + " where b.id=$1", [key]);
  if (!result.rowCount) throw fail(404, 'مشتری یافت نشد.');
  return result.rows[0];
}
function input(raw: any) {
  const name = text(raw?.name, 160), company = text(raw?.company, 200);
  const city = text(raw?.city, 100), province = text(raw?.province, 100);
  const email = text(raw?.email, 250).toLowerCase(), notes = text(raw?.notes, 4000);
  if (name.length < 2) throw fail(400, 'نام مشتری باید حداقل دو نویسه باشد.');
  if (!emailOk(email)) throw fail(400, 'ایمیل معتبر نیست.');
  return { name, company, city, province, email, notes };
}

export function registerAdminCustomersApi(app: Express) {
  app.get('/api/admin/crm/customers', async (req, res) => {
    try {
      await guard(req, res);
      const q = text(req.query.q, 120);
      const kind = req.query.kind === 'high_volume' || req.query.kind === 'retail' ? req.query.kind : 'all';
      const page = Math.min(100000, Math.max(1, Number.parseInt(String(req.query.page || 1), 10) || 1));
      const limit = 25;
      const conditions = ["($1='' or b.name ilike '%' || $1 || '%' or coalesce(b.company,'') ilike '%' || $1 || '%' or coalesce(b.phone,'') like '%' || $1 || '%')"];
      if (kind !== 'all') conditions.push(kind === 'high_volume' ? 'b.approved_b2b=true' : 'b.approved_b2b=false');
      const where = 'where ' + conditions.join(' and ');
      const values = [q];
      const [rows, total, summary] = await Promise.all([
        database().query("select " + cols + " " + selection + " " + where + " order by b.created_at desc,b.id desc limit " + limit + " offset $2", [q,(page-1)*limit]),
        database().query("select count(*)::int as total from (" + base + ") b " + where, values),
        database().query("select count(*)::int as total,count(*) filter(where approved_b2b)::int as high_volume,count(*) filter(where not approved_b2b)::int as retail from (" + base + ") b")
      ]);
      res.json({ success: true, customers: rows.rows, total: total.rows[0]?.total || 0, page, pageSize: limit, counts: summary.rows[0] });
    } catch (e) { respond(res, e); }
  });

  app.get('/api/admin/crm/customers/:key', async (req, res) => {
    try {
      await guard(req, res);
      const key = customerKey(req.params.key);
      const customer = await loadOne(key.source + ':' + key.id);
      const [orders, finance, tickets] = await Promise.all([
        database().query(
          "select o.id,o.created_at,o.status::text as status,o.payment_status,o.currency,o.total_amount,o.final_amount,o.discount_amount from public.orders o where (o.user_id=$1::uuid and $1::uuid is not null) or (o.crm_customer_id=$2::text and $2::text is not null) order by o.created_at desc limit 30",
          [customer.user_id || null,customer.crm_id || null]),
        customer.user_id
          ? database().query("select id,kind,debt_delta,wallet_delta,points_delta,reference,order_id,description,created_at from public.financial_entries where user_id=$1 order by created_at desc limit 40",[customer.user_id])
          : Promise.resolve({rows:[]}),
        customer.user_id
          ? database().query("select id,subject,status,created_at,updated_at from public.support_tickets where user_id=$1 order by created_at desc limit 30",[customer.user_id])
          : Promise.resolve({rows:[]})
      ]);
      res.json({ success: true, customer, orders: orders.rows, finance: finance.rows, tickets: tickets.rows });
    } catch (e) { respond(res, e); }
  });

  app.post('/api/admin/crm/customers', async (req, res) => {
    try {
      const identity = await guard(req, res, 'create');
      const fields = input(req.body);
      const phone = normalizeCrmPhone(req.body?.phone);
      const kind = portalKind(req.body?.kind);
      const id = 'crm-' + uuid();
      await transaction(async client => {
        const duplicate = await client.query(
          "select 1 from public.crm_customers where right(regexp_replace(coalesce(phone,''),'[^0-9]','','g'),10)=$1 union all select 1 from public.user_profiles where right(regexp_replace(coalesce(phone,''),'[^0-9]','','g'),10)=$1 limit 1",
          [phone.slice(-10)]
        );
        if (duplicate.rowCount) throw fail(409, 'این شماره قبلاً ثبت شده است؛ از پرونده موجود استفاده کنید.');
        await client.query(
          "insert into public.crm_customers (id,name,company,phone,email,city,province,approved_b2b,approval_status,notes) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          [id,fields.name,fields.company || null,phone,fields.email || null,fields.city || null,fields.province || null,kind==='high_volume',kind==='high_volume'?'approved':'pending',fields.notes || null]
        );
        await audit(client,identity,'ایجاد مشتری',id,'ثبت مخاطب CRM؛ حساب ورود تا زمان ثبت‌نام تأییدشده ایجاد نمی‌شود.');
      });
      res.status(201).json({success:true,id:'crm:'+id,hasLogin:false,message:'مخاطب ثبت شد. حساب ورود هنوز ایجاد نشده است.'});
    } catch (e) { respond(res, e); }
  });

  app.patch('/api/admin/crm/customers/:key', async (req, res) => {
    try {
      const identity = await guard(req, res, 'edit');
      const key = customerKey(req.params.key);
      const fields = input(req.body);
      let createdCrmId: string | null = null;
      await transaction(async client => {
        if (key.source === 'crm') {
          const row = await client.query("select id,auth_user_id from public.crm_customers where id=$1 for update",[key.id]);
          if (!row.rowCount) throw fail(404, 'مشتری یافت نشد.');
          await client.query(
            "update public.crm_customers set name=$2,company=$3,city=$4,province=$5,email=$6,notes=$7,updated_at=now() where id=$1",
            [key.id,fields.name,fields.company || null,fields.city || null,fields.province || null,fields.email || null,fields.notes || null]);
          if (row.rows[0].auth_user_id) {
            await client.query(
              "update public.user_profiles set full_name=$2,company_name=$3,city=$4,province=$5,updated_at=now() where id=$1 and role::text not in ('super_admin','warehouse_operator','sales_manager')",
              [row.rows[0].auth_user_id,fields.name,fields.company || null,fields.city || null,fields.province || null]);
          }
        } else {
          const profile = await client.query(
            "select id,phone,email,approved_b2b,full_name,company_name from public.user_profiles where id=$1 and role::text not in ('super_admin','warehouse_operator','sales_manager') for update",
            [key.id]);
          if (!profile.rowCount) throw fail(404, 'مشتری ثبت‌نامی یافت نشد.');
          const p = profile.rows[0];
          await client.query(
            "update public.user_profiles set full_name=$2,company_name=$3,city=$4,province=$5,updated_at=now() where id=$1",
            [key.id,fields.name,fields.company || null,fields.city || null,fields.province || null]);
          if (fields.notes) {
            createdCrmId = 'crm-'+uuid();
            await client.query(
              "insert into public.crm_customers (id,auth_user_id,name,company,phone,email,city,province,approved_b2b,approval_status,notes) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
              [createdCrmId,key.id,fields.name,fields.company || null,p.phone,p.email,fields.city || null,fields.province || null,p.approved_b2b,p.approved_b2b?'approved':'pending',fields.notes]);
          }
        }
        await audit(client,identity,'ویرایش مشتری',key.id,'اطلاعات تماس سازمانی و یادداشت CRM تغییر کرد؛ سوابق سفارش و مالی دست‌نخورده است.');
      });
      res.json({success:true,id:createdCrmId ? 'crm:'+createdCrmId : key.source+':'+key.id});
    } catch (e) { respond(res, e); }
  });

  app.post('/api/admin/crm/customers/:key/approval', async (req, res) => {
    try {
      const identity = await guard(req,res,'edit');
      if (!identity.admin && !canStaff(identity,'customer_grading','edit'))
        throw fail(403,'تغییر نوع پنل فقط با دسترسی تأیید مشتریان عمده مجاز است.');
      if (typeof req.body?.approved !== 'boolean') throw fail(400,'وضعیت تأیید نامعتبر است.');
      const approved = req.body.approved as boolean;
      const key = customerKey(req.params.key);
      await transaction(async client => {
        if (key.source==='crm') {
          const record = await client.query('select id,auth_user_id from public.crm_customers where id=$1 for update',[key.id]);
          if (!record.rowCount) throw fail(404,'مشتری یافت نشد.');
          await client.query("update public.crm_customers set approved_b2b=$2,approval_status=$3,updated_at=now() where id=$1",[key.id,approved,approved?'approved':'pending']);
          if (record.rows[0].auth_user_id)
            await client.query("update public.user_profiles set approved_b2b=$2,updated_at=now() where id=$1 and role::text not in ('super_admin','warehouse_operator','sales_manager')",[record.rows[0].auth_user_id,approved]);
        } else {
          const updated=await client.query("update public.user_profiles set approved_b2b=$2,updated_at=now() where id=$1 and role::text not in ('super_admin','warehouse_operator','sales_manager') returning id",[key.id,approved]);
          if (!updated.rowCount) throw fail(404,'مشتری یافت نشد.');
        }
        await audit(client,identity,approved?'ارتقای مشتری به خرید بالا':'بازگشت مشتری به خرید تکی',key.id,'مجوز پنل مشتری تغییر کرد؛ سفارش‌ها و سوابق مالی حفظ شدند.');
      });
      res.json({success:true});
    } catch (e) { respond(res,e); }
  });

  // Only commercial managers can assign verified grades, price lists or credit limits.
  app.get('/api/admin/crm/commercial-options', async (req,res) => {
    try {
      const identity=await guard(req,res);
      if(!identity.admin&&!canStaff(identity,'customer_grading','view'))throw fail(403,'مجوز مشاهده گرید و قیمت‌نامه لازم است.');
      const [grades,priceLists]=await Promise.all([
        database().query("select grade_code,title,discount_percent,credit_limit from public.customer_grade_configs order by grade_code"),
        database().query("select id,name,currency from public.price_lists where is_active=true order by name")
      ]);
      res.json({success:true,grades:grades.rows,priceLists:priceLists.rows});
    }catch(e){respond(res,e);}
  });

  app.patch('/api/admin/crm/customers/:key/commercial', async (req,res) => {
    try{
      const identity=await guard(req,res,'edit');
      if(!identity.admin&&!canStaff(identity,'customer_grading','edit'))
        throw fail(403,'تنظیم گرید، قیمت‌نامه و اعتبار نیاز به مجوز مدیریت مشتریان عمده دارد.');
      const key=customerKey(req.params.key);
      const grade=text(req.body?.grade_code,60)||null;
      const priceList=text(req.body?.assigned_price_list_id,100)||null;
      const creditLimit=Number(req.body?.credit_limit);
      if(typeof req.body?.credit_limit!=='number'||!Number.isSafeInteger(creditLimit)||creditLimit<0||creditLimit>1e15)
        throw fail(400,'سقف اعتبار باید عدد صحیح غیرمنفی باشد.');
      await transaction(async client=>{
        if(grade && !(await client.query('select 1 from public.customer_grade_configs where grade_code=$1',[grade])).rowCount)
          throw fail(400,'گرید انتخاب‌شده در دیتابیس وجود ندارد.');
        if(priceList && !(await client.query('select 1 from public.price_lists where id=$1 and is_active=true',[priceList])).rowCount)
          throw fail(400,'قیمت‌نامه انتخاب‌شده فعال نیست.');
        if(key.source==='crm'){
          const row=await client.query(
            'select id,auth_user_id,approved_b2b,used_credit from public.crm_customers where id=$1 for update',[key.id]);
          if(!row.rowCount)throw fail(404,'مشتری یافت نشد.');
          let current=row.rows[0];
          if(current.auth_user_id){
            const profile=await client.query(
              "select id,approved_b2b,credit_used from public.user_profiles where id=$1 and role::text not in ('super_admin','warehouse_operator','sales_manager') for update",
              [current.auth_user_id]);
            if(!profile.rowCount)throw fail(409,'پروفایل معتبر متصل به این مشتری پیدا نشد.');
            current={...current,approved_b2b:profile.rows[0].approved_b2b,used_credit:profile.rows[0].credit_used};
          }
          if(!current.approved_b2b)throw fail(409,'تخصیص شرایط عمده فقط برای مشتری تأییدشده مجاز است.');
          if(creditLimit<Number(current.used_credit||0))throw fail(409,'سقف اعتبار نمی‌تواند کمتر از اعتبار مصرف‌شده باشد.');
          await client.query(
            'update public.crm_customers set grade_code=$2,assigned_price_list_id=$3,credit_limit=$4,updated_at=now() where id=$1',
            [key.id,grade,priceList,creditLimit]);
          if(current.auth_user_id)await client.query(
            'update public.user_profiles set grade_code=$2,assigned_price_list_id=$3,credit_limit=$4,updated_at=now() where id=$1',
            [current.auth_user_id,grade,priceList,creditLimit]);
        }else{
          const row=await client.query(
            "select id,approved_b2b,credit_used from public.user_profiles where id=$1 and role::text not in ('super_admin','warehouse_operator','sales_manager') for update",
            [key.id]);
          if(!row.rowCount)throw fail(404,'مشتری پیدا نشد.');
          if(!row.rows[0].approved_b2b)throw fail(409,'برای تخصیص شرایط عمده ابتدا مشتری را تأیید کنید.');
          if(creditLimit<Number(row.rows[0].credit_used||0))throw fail(409,'سقف اعتبار نمی‌تواند کمتر از اعتبار مصرف‌شده باشد.');
          await client.query(
            'update public.user_profiles set grade_code=$2,assigned_price_list_id=$3,credit_limit=$4,updated_at=now() where id=$1',
            [key.id,grade,priceList,creditLimit]);
        }
        await audit(client,identity,'تغییر شرایط تجاری مشتری',key.id,'گرید: '+(grade||'ندارد')+'؛ قیمت‌نامه: '+(priceList||'ندارد')+'؛ سقف اعتبار: '+creditLimit);
      });
      res.json({success:true});
    }catch(e){respond(res,e);}
  });

  // Preserve the existing ticket-reply capability, now backed by support_tickets.
  app.get('/api/admin/crm/tickets', async (req,res) => {
    try {
      await guard(req,res);
      const result=await database().query(
        "select id,user_id,customer_name,phone,subject,status,messages,created_at,updated_at from public.support_tickets order by updated_at desc limit 100");
      res.json({success:true,tickets:result.rows});
    } catch(e) {respond(res,e);}
  });

  app.post('/api/admin/crm/tickets/:id/reply', async (req,res) => {
    try {
      const identity=await guard(req,res,'edit');
      const id=text(req.params.id,120), message=text(req.body?.message,3000);
      if(!id || !message)throw fail(400,'شناسه تیکت و متن پاسخ الزامی است.');
      await transaction(async client=>{
        const found=await client.query('select id,messages from public.support_tickets where id=$1 for update',[id]);
        if(!found.rowCount)throw fail(404,'تیکت پیدا نشد.');
        const old=Array.isArray(found.rows[0].messages)?found.rows[0].messages:[];
        const reply={id:'crm-reply-'+uuid(),sender:'support',senderName:identity.user?.fullName||'پشتیبانی صنعت پیش',message,timestamp:new Date().toISOString()};
        await client.query(
          "update public.support_tickets set messages=$2::jsonb,status='answered',updated_at=now() where id=$1",
          [id,JSON.stringify([...old,reply])]);
        await audit(client,identity,'پاسخ به تیکت',id,'پاسخ ثبت‌شده در تیکت CRM');
      });
      res.json({success:true});
    }catch(e){respond(res,e);}
  });

}
