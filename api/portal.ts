import {database as postgresDatabase} from '../server/db/connection';
import {supabaseIdentity,supabaseAuthAction,refreshAuth} from "../server/db/supabaseAuth";
import {databaseEnabled,adoptedSchema} from "../server/db/connection";
import {readPortal,writePortal} from "../server/db/repository";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import { smsConfigured, sendVerificationCode } from "./sms";
import { BRANDS } from "../src/data/brands";
import { BUSINESS_TYPES } from "../src/data/iranLocations";

type Row = Record<string, any>;
interface Database {
  revision: number;
  otp?: Record<
    string,
    {
      hash: string;
      expires: number;
      sentAt: number;
      attempts: number;
      count: number;
      window: number;
      userId: string;
      version: number;
    }
  >;
  users: Row[];
  values: Record<string, any>;
}
const CUSTOMER_KEY = "atlas_admin_customers_v1";
const keys = [
  CUSTOMER_KEY,
  "atlas_admin_inquiries_v1",
  "atlas_legacy_customers_v1",
  "atlas_customers_approval_v2",
  "atlas_price_lists_v2",
  "atlas_customer_grades_v2",
  "atlas_club_rewards_v2",
  "atlas_customer_reward_assignments_v1",
  "atlas_price_list_history_v2",
  "atlas_portal_content_banners_v1",
  "atlas_portal_content_announcements_v1",
  "atlas_portal_club_milestones_v1",
  "atlas_portal_layout_configs_v1",
  "atlas_portal_customer_overrides_v1",
];
const empty = (): Database => ({ revision: 0, users: [], values: {} });
const dbPath = () =>
  process.env.PORTAL_DATA_PATH || path.join(process.cwd(), ".data/portal.json");
const redisUrl = () =>
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = () =>
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redisKey = () => process.env.PORTAL_REDIS_KEY || "sanatpish:portal:v1";
const fail = (status: number, message: string): never => {
  throw Object.assign(new Error(message), { status });
};
async function redis(command: unknown[]) {
  const response = await fetch(redisUrl()!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json();
  if (!response.ok || data.error)
    fail(503, "ارتباط با پایگاه داده برقرار نشد.");
  return data.result;
}
async function readDb(): Promise<Database> {
  if(databaseEnabled())return readPortal();
  if (redisUrl() && redisToken()) {
    const raw = await redis(["GET", redisKey()]);
    return raw ? JSON.parse(raw) : empty();
  }
  if (process.env.VERCEL)
    fail(503, "پایگاه داده پنل هنوز توسط مدیریت پیکربندی نشده است.");
  try {
    return JSON.parse(await fs.readFile(dbPath(), "utf8"));
  } catch (error: any) {
    if (error.code === "ENOENT") return empty();
    throw error;
  }
}
async function writeDb(db: Database, expected: number) {
  if(databaseEnabled())return writePortal(db,expected);
  db.revision = expected + 1;
  if (redisUrl() && redisToken()) {
    const script =
      "local old=redis.call('GET',KEYS[1]); local rev=0; if old then rev=cjson.decode(old).revision end; if rev~=tonumber(ARGV[1]) then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";
    if (
      !(await redis([
        "EVAL",
        script,
        1,
        redisKey(),
        expected,
        JSON.stringify(db),
      ]))
    )
      fail(
        409,
        "اطلاعات هم‌زمان تغییر کرده است. صفحه را تازه کنید و دوباره ذخیره کنید.",
      );
  } else {
    const current = await readDb();
    if (current.revision !== expected)
      fail(409, "اطلاعات تغییر کرده است؛ دوباره تلاش کنید.");
    await fs.mkdir(path.dirname(dbPath()), { recursive: true });
    await fs.writeFile(`${dbPath()}.tmp`, JSON.stringify(db), { mode: 0o600 });
    await fs.rename(`${dbPath()}.tmp`, dbPath());
  }
}
let localSecret: Promise<string> | undefined;
async function secret() {
  if ((process.env.PORTAL_SESSION_SECRET || "").length >= 32)
    return process.env.PORTAL_SESSION_SECRET!;
  if (databaseEnabled() || process.env.VERCEL || process.env.NODE_ENV === "production")
    fail(503, "تنظیمات ورود امن پنل کامل نشده است.");
  localSecret ??= (async () => {
    const file = `${dbPath()}.secret`;
    await fs.mkdir(path.dirname(file), { recursive: true });
    try {
      await fs.writeFile(file, crypto.randomBytes(48).toString("hex"), {
        flag: "wx",
        mode: 0o600,
      });
    } catch (e: any) {
      if (e.code !== "EEXIST") throw e;
    }
    return fs.readFile(file, "utf8");
  })();
  return localSecret;
}
const equal = (a: string, b: string) => {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
function mobile(raw: string) {
  let value = String(raw || "")
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
    .replace(/[\s()-]/g, "");
  value = value.replace(/^(\+98|0098|98)/, "0");
  if (!/^09\d{9}$/.test(value)) fail(400, "شماره موبایل معتبر وارد کنید.");
  return value;
}
function passwordHash(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}
function setPassword(user: Row, password: string) {
  user.passwordSalt = crypto.randomBytes(16).toString("hex");
  user.passwordHash = passwordHash(password, user.passwordSalt);
  user.sessionVersion = (user.sessionVersion || 0) + 1;
}
function safeUser(user: Row) {
  const { passwordHash, passwordSalt, password, notes, adminNotes, ...rest } =
    user;
  return rest;
}
function csrf(req: IncomingMessage) {
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host)
    fail(403, "مبدأ درخواست معتبر نیست.");
  if (!String(req.headers["content-type"]).includes("application/json"))
    fail(415, "درخواست نامعتبر است.");
}
async function issueSession(
  res: ServerResponse,
  userId: string,
  version: number | string,
  admin = false,
) {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      version,
      admin,
      exp: Date.now() + 8 * 60 * 60 * 1000,
    }),
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", await secret())
    .update(payload)
    .digest("base64url");
  res.setHeader(
    "Set-Cookie",
    `sanat_portal=${payload}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${process.env.VERCEL || process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
}
async function session(
  req: IncomingMessage,
  db: Database,
): Promise<{ admin: boolean; user?: Row }> {
  if(databaseEnabled())return supabaseIdentity(req,db);
  const cookie = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("sanat_portal="))
    ?.slice(13);
  if (!cookie) return { admin: false };
  try {
    const [payload, signature] = cookie.split(".");
    if (
      !equal(
        signature || "",
        crypto
          .createHmac("sha256", await secret())
          .update(payload)
          .digest("base64url"),
      )
    )
      return { admin: false };
    const claim = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (claim.exp <= Date.now()) return { admin: false };
    if (claim.admin) {
      // Changing the admin password immediately invalidates previous admin sessions.
      const version = crypto
        .createHash("sha256")
        .update(process.env.PORTAL_ADMIN_PASSWORD || "")
        .digest("hex");
      return { admin: claim.version === version };
    }
    const user = db.users.find(
      (u) => u.id === claim.userId && u.sessionVersion === claim.version,
    );
    return { admin: false, user };
  } catch {
    return { admin: false };
  }
}
function portal(user: Row) {
  return user.approvedB2B === true ? "high_volume" : "consumer";
}
function canPurchase(db: Database, user: Row) {
  if (user.onboardingCompleted !== true) return false;
  const p = portal(user);
  const base = db.values.atlas_portal_layout_configs_v1?.[p];
  const override = db.values.atlas_portal_customer_overrides_v1?.find(
    (r: Row) => r.portal === p && r.customerId === user.id,
  );
  const permissions = { ...base?.permissions, ...override?.permissions };
  if (permissions.allowQuickSkuOrder === false) return false;
  const menus = override?.menus || base?.menus;
  return (
    !menus ||
    menus.some(
      (m: Row) =>
        m.enabled &&
        ["purchase_list", "quick_buy", "orders", "orders_pricelist"].includes(
          m.id,
        ) &&
        !override?.disabledMenuIds?.includes(m.id),
    )
  );
}
function scopedState(db: Database, user: Row) {
  const result: Record<string, any> = { [CUSTOMER_KEY]: [safeUser(user)] };
  const p = portal(user);
  const base = db.values.atlas_portal_layout_configs_v1?.[p];
  const override = db.values.atlas_portal_customer_overrides_v1?.find(
    (r: Row) => r.portal === p && r.customerId === user.id,
  );
  const menus = override?.menus || base?.menus;
  const canOrders =
    !menus ||
    menus.some(
      (m: Row) =>
        m.enabled &&
        m.id === (p === "consumer" ? "orders" : "orders_pricelist"),
    );
  const canClub =
    !override?.disabledMenuIds?.includes("club_rewards") &&
    (!menus ||
      (p === "consumer" && !menus.some((m: Row) => m.id === "club_rewards")) ||
      menus.some((m: Row) => m.enabled && m.id === "club_rewards"));
  for (const key of keys) {
    const value = db.values[key];
    if (value === undefined) continue;
    if (key === "atlas_admin_inquiries_v1")
      result[key] = value.filter((r: Row) => r.customerId === user.id);
    else if (key === CUSTOMER_KEY || key === "atlas_legacy_customers_v1")
      result[key] = [safeUser(user)];
    else if (key === "atlas_portal_layout_configs_v1")
      result[key] = { [p]: value[p] };
    else if (key === "atlas_portal_customer_overrides_v1")
      result[key] = value.filter(
        (r: Row) => r.portal === p && r.customerId === user.id,
      );
    else if (key.includes("content_banners"))
      result[key] = value.filter(
        (r: Row) =>
          r.portal === p &&
          r.active &&
          (r.scope === "collective" || r.targetCustomerId === user.id) &&
          (!r.targetTierCode ||
            r.targetTierCode === "ALL" ||
            r.targetTierCode === user.assignedPriceListCode),
      );
    else if (key.includes("content_announcements"))
      result[key] = value.filter((r: Row) => {
        if (!r || !r.active || r.archived === true) return false;
        const now = Date.now();
        if (r.startsAt) {
          const s = Date.parse(r.startsAt);
          if (Number.isFinite(s) && s > now) return false;
        }
        const endVal = r.endsAt || r.expiresAt;
        if (endVal) {
          const e = Date.parse(endVal);
          if (Number.isFinite(e) && e <= now) return false;
        }
        if (r.portal === "storefront") {
          return !r.scope || r.scope === "collective";
        }
        if (r.portal !== p) return false;
        const matchesCustomer =
          !r.scope ||
          r.scope === "collective" ||
          r.targetCustomerId === user.id ||
          (Array.isArray(r.targetCustomerIds) &&
            r.targetCustomerIds.includes(user.id));
        if (!matchesCustomer) return false;
        return (
          !r.targetTierCode ||
          r.targetTierCode === "ALL" ||
          r.targetTierCode === user.assignedPriceListCode
        );
      });
    else if (key === "atlas_price_lists_v2")
      result[key] = canOrders
        ? value.filter((r: Row) =>
            p === "consumer"
              ? r.isRetailCash || r.code === "RETAIL"
              : r.code === user.assignedPriceListCode,
          )
        : [];
    else if (key === "atlas_portal_club_milestones_v1") {
      if (canClub)
        result[key] = Array.isArray(value)
          ? p === "high_volume"
            ? value
            : { consumer: [] }
          : { [p]: value[p] || [] };
    } else if (key === "atlas_customers_approval_v2")
      result[key] = value.filter((r: Row) => r.phone === user.phone);
    else if (
      key === "atlas_customer_reward_assignments_v1" ||
      key === "atlas_club_rewards_v2"
    ) {
      result[key] = canClub
        ? value
            .filter(
              (r: Row) =>
                (r.portal || "high_volume") === p &&
                (key !== "atlas_customer_reward_assignments_v1"
                  ? r.active
                  : r.targetCustomerIds?.includes(user.id)) &&
                (!r.expiresAt || Date.parse(r.expiresAt) > Date.now()) &&
                (!r.targetCustomerIds?.length ||
                  r.targetCustomerIds.includes(user.id)) &&
                (!r.targetPriceListCode ||
                  r.targetPriceListCode === "ALL" ||
                  r.targetPriceListCode === user.assignedPriceListCode) &&
                (!r.targetClubTier ||
                  r.targetClubTier === "all" ||
                  r.targetClubTier === user.clubTier) &&
                (r.minPurchaseRequired || 0) <= (user.totalPurchases || 0),
            )
            .map((r: Row) => {
              const { notes, targetTierLabel, targetCustomerName, ...safe } = r;
              return safe;
            })
        : [];
    }
  }
  return result;
}
const attempts = new Map<string, { count: number; until: number }>();
async function rateLimit(req: IncomingMessage) {
  const ip = process.env.VERCEL
    ? req.headers["x-forwarded-for"]
    : req.socket.remoteAddress;
  const key = `${redisKey()}:login:${crypto.createHash("sha256").update(String(ip)).digest("hex")}`;
  if(databaseEnabled()){
    const count=Number((await postgresDatabase().query(`insert into app_private.rate_limits(bucket,attempts,expires_at) values($1,1,now()+interval '15 minutes') on conflict(bucket) do update set attempts=case when rate_limits.expires_at<now() then 1 else rate_limits.attempts+1 end,expires_at=case when rate_limits.expires_at<now() then now()+interval '15 minutes' else rate_limits.expires_at end returning attempts`,[key])).rows[0].attempts);
    if(count>25)fail(429,'تعداد تلاش‌های ورود بیش از حد مجاز است.');
  } else if (redisUrl() && redisToken()) {
    const count = await redis(["INCR", key]);
    if (count === 1) await redis(["EXPIRE", key, 900]);
    if (count > 25)
      fail(
        429,
        "تلاش‌های ورود بیش از حد مجاز است؛ ۱۵ دقیقه دیگر دوباره تلاش کنید.",
      );
  } else {
    const old = attempts.get(key);
    const entry =
      old && old.until > Date.now()
        ? old
        : { count: 0, until: Date.now() + 900000 };
    entry.count++;
    attempts.set(key, entry);
    if (entry.count > 25) fail(429, "تعداد تلاش‌های ورود بیش از حد مجاز است.");
  }
}
async function readBody(req: IncomingMessage & { body?: Row }): Promise<Row> {
  if (req.body)
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 2_000_000) fail(413, "حجم داده بیش از حد مجاز است.");
  }
  return JSON.parse(raw || "{}");
}
// Serialize local writes; Redis uses revision compare-and-set across instances.
let pending = Promise.resolve();
export default async function handler(
  req: IncomingMessage & { body?: Row },
  res: ServerResponse,
) {
  let release!: () => void;
  const prior = pending;
  pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prior;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  const send = (status: number, value: Row) => {
    res.statusCode = status;
    res.end(JSON.stringify(value));
  };
  try {
    if (req.method !== "GET" && req.method !== "POST")
      return send(405, { success: false });
    if(databaseEnabled() && req.method==="GET")await refreshAuth(req,res);
    if(databaseEnabled() && req.method==="GET" && !/(?:^|;)\s*sp_access=/.test(req.headers.cookie || '')){
      const revision=Number((await postgresDatabase().query('select revision from app_private.portal_version where singleton=true')).rows[0].revision);
      return send(200,{success:true,smsAvailable:process.env.SUPABASE_SMS_READY==='true',revision,user:null,admin:false,values:{}});
    }
    const db = await readDb();
    const auth = await session(req, db);
    if (req.method === "GET") {
      const guestAnnouncements = Array.isArray(
        db.values.atlas_portal_content_announcements_v1,
      )
        ? db.values.atlas_portal_content_announcements_v1.filter((r: Row) => {
            if (!r || !r.active || r.archived === true) return false;
            if (r.portal !== "storefront" || (r.scope && r.scope !== "collective"))
              return false;
            const now = Date.now();
            if (r.startsAt) {
              const s = Date.parse(r.startsAt);
              if (Number.isFinite(s) && s > now) return false;
            }
            const endVal = r.endsAt || r.expiresAt;
            if (endVal) {
              const e = Date.parse(endVal);
              if (Number.isFinite(e) && e <= now) return false;
            }
            return true;
          })
        : [];
      return send(200, {
        success: true,
        smsAvailable: databaseEnabled() ? process.env.SUPABASE_SMS_READY==='true' : smsConfigured(),
        revision: db.revision,
        user: auth.user ? safeUser(auth.user) : null,
        admin: auth.admin,
        values: auth.admin
          ? { ...db.values, [CUSTOMER_KEY]: db.users.map(safeUser) }
          : auth.user
            ? scopedState(db, auth.user)
            : guestAnnouncements.length > 0
              ? { atlas_portal_content_announcements_v1: guestAnnouncements }
              : {},
      });
    }
    csrf(req);
    const body = await readBody(req);
    if(databaseEnabled() && ["register","login","admin_login","otp_request","otp_verify","registration_credentials","logout","dev_otp_request","dev_otp_verify"].includes(body.action)){await rateLimit(req);if(await supabaseAuthAction(req,res,body,safeUser))return;}
    const revision = db.revision;
    if (body.action === "logout") {
      res.setHeader(
        "Set-Cookie",
        "sanat_portal=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
      );
      return send(200, { success: true });
    }
    if (body.action === "admin_login") {
      await rateLimit(req);
      const password = process.env.PORTAL_ADMIN_PASSWORD || "";
      if (password.length < 12)
        fail(503, "رمز امن مدیر هنوز در سرور تنظیم نشده است.");
      if (
        !equal(
          String(body.username),
          process.env.PORTAL_ADMIN_USERNAME || "admin",
        ) ||
        !equal(String(body.password), password)
      )
        fail(401, "نام کاربری یا رمز عبور نادرست است.");
      await issueSession(
        res,
        "admin",
        crypto.createHash("sha256").update(password).digest("hex"),
        true,
      );
      return send(200, { success: true, admin: true });
    }
    if (body.action === "register") {
      await secret();
      await rateLimit(req);
      const p = body.payload || {};
      const phone = mobile(p.mobile);
      for (const field of [
        "firstName",
        "lastName",
        "companyName",
        "provinceId",
        "cityId",
        "activityField",
      ])
        if (
          typeof p[field] !== "string" ||
          !p[field].trim() ||
          p[field].length > 300
        )
          fail(400, "تمام فیلدهای الزامی را کامل کنید.");
      if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))
        fail(400, "ایمیل معتبر وارد کنید.");
      if (db.users.some((u) => u.phone === phone))
        fail(409, "این شماره قبلاً ثبت شده است.");
      const username = String(p.username || "")
        .trim()
        .toLowerCase();
      if (!/^[a-z][a-z0-9_]{3,31}$/.test(username))
        fail(
          400,
          "نام کاربری باید ۴ تا ۳۲ حرف انگلیسی، عدد یا زیرخط و با حرف شروع شود.",
        );
      if (db.users.some((u) => u.username?.toLowerCase() === username))
        fail(409, "این نام کاربری قبلاً انتخاب شده است.");
      if (
        typeof p.password !== "string" ||
        p.password.length < 10 ||
        p.password.length > 128 ||
        p.password === phone
      )
        fail(400, "رمز باید ۱۰ تا ۱۲۸ نویسه و متفاوت با شماره موبایل باشد.");
      const user: Row = {
        id: crypto.randomUUID(),
        username,
        fullName: `${p.firstName.trim()} ${p.lastName.trim()}`,
        firstName: p.firstName.trim(),
        lastName: p.lastName.trim(),
        companyName: p.companyName.trim(),
        phone,
        mobile: phone,
        email: p.email || "",
        provinceId: p.provinceId,
        cityId: p.cityId,
        province: p.province,
        city: p.city,
        activityField: p.activityField,
        role: "retail",
        approvedB2B: false,
        clubTier: "bronze",
        clubPoints: 0,
        totalPurchases: 0,
        creditLimit: 0,
        addresses: [],
        favoriteBrands: [],
        onboardingCompleted: false,
        createdAt: new Date().toISOString(),
      };
      setPassword(user, p.password);
      db.users.push(user);
      await writeDb(db, revision);
      await issueSession(res, user.id, user.sessionVersion);
      return send(201, {
        success: true,
        user: safeUser(user),
        credentials: { username },
        smsSent: false,
        isNewUser: true,
        onboardingStep: 1,
      });
    }
    if (body.action === "otp_request") {
      await rateLimit(req);
      if (!smsConfigured())
        fail(503, "ورود پیامکی هنوز فعال نشده است؛ با رمز عبور وارد شوید.");
      const phone = mobile(body.phone);
      const key = crypto
        .createHmac("sha256", await secret())
        .update(phone)
        .digest("hex");
      db.otp ||= {};
      for (const [id, value] of Object.entries(db.otp))
        if (value.window + 3600000 < Date.now()) delete db.otp[id];
      const old = db.otp[key],
        now = Date.now();
      if (old && now - old.sentAt < 60000)
        fail(429, "برای ارسال مجدد یک دقیقه صبر کنید.");
      const count = old && now - old.window < 3600000 ? old.count : 0;
      if (count >= 5)
        fail(429, "تعداد درخواست‌های پیامک زیاد است؛ یک ساعت دیگر تلاش کنید.");
      const user = db.users.find((u) => u.phone === phone);
      const code = String(crypto.randomInt(100000, 1000000));
      db.otp[key] = {
        hash: crypto
          .createHmac("sha256", await secret())
          .update(phone + ":" + code)
          .digest("hex"),
        expires: now + 180000,
        sentAt: now,
        attempts: 0,
        count: count + 1,
        window: count ? old!.window : now,
        userId: user?.id || "",
        version: user?.sessionVersion || 0,
      };
      await writeDb(db, revision);
      if (user) await sendVerificationCode(phone, code);
      return send(200, {
        success: true,
        retryAfter: 60,
        message:
          "اگر این شماره حساب فعال داشته باشد، کد ورود برای آن ارسال می‌شود.",
      });
    }
    if (body.action === "otp_verify") {
      await rateLimit(req);
      const phone = mobile(body.phone);
      const code = String(body.code || "")
        .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
        .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
      const key = crypto
        .createHmac("sha256", await secret())
        .update(phone)
        .digest("hex");
      const entry = db.otp?.[key]!;
      if (!entry || entry.expires <= Date.now() || entry.attempts >= 5)
        fail(401, "کد منقضی شده یا معتبر نیست؛ کد جدید درخواست کنید.");
      entry.attempts++;
      const hash = crypto
        .createHmac("sha256", await secret())
        .update(phone + ":" + code)
        .digest("hex");
      const user = db.users.find(
        (u) =>
          u.phone === phone &&
          u.id === entry.userId &&
          u.sessionVersion === entry.version,
      );
      const valid = /^\d{6}$/.test(code) && equal(hash, entry.hash) && user;
      if (valid) {
        entry.expires = 0;
        entry.hash = "";
      }
      await writeDb(db, revision);
      if (!valid) fail(401, "کد واردشده صحیح نیست.");
      await issueSession(res, user!.id, user!.sessionVersion);
      return send(200, { success: true, user: safeUser(user!) });
    }
    if (body.action === "login") {
      await rateLimit(req);
      const identifier = String(body.identifier || "")
        .trim()
        .toLowerCase();
      let phone = identifier;
      try {
        phone = mobile(identifier);
      } catch {
        /* username login */
      }
      const user = db.users.find(
        (u) => u.username?.toLowerCase() === identifier || u.phone === phone,
      );
      if (
        !user ||
        !body.password ||
        !equal(
          passwordHash(String(body.password), user.passwordSalt),
          user.passwordHash,
        )
      )
        fail(401, "نام کاربری یا رمز عبور نادرست است.");
      await issueSession(res, user!.id, user!.sessionVersion);
      return send(200, {
        success: true,
        user: safeUser(user!),
        onboardingStep: user!.onboardingCompleted
          ? "completed"
          : user!.favoriteBrands?.length
            ? 2
            : 1,
      });
    }
    if (body.action === "inquiry") {
      if (!auth.user) fail(401, "برای استعلام وارد حساب شوید.");
      if (!canPurchase(db, auth.user!))
        fail(403, "این دسترسی برای حساب شما فعال نیست.");
      const code = String(body.code || "").trim();
      const quantity = Number(body.quantity);
      const notes = String(body.notes || "").slice(0, 2000);
      if (
        !code ||
        code.length > 100 ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 9999
      )
        fail(400, "کد و تعداد معتبر وارد کنید.");
      const id = "INQ-" + crypto.randomUUID();
      const inquiry = {
        id,
        inquiryNumber: id,
        customerId: auth.user!.id,
        customerName: auth.user!.fullName,
        companyName: auth.user!.companyName,
        phone: auth.user!.phone,
        productCode: code,
        productName: String(body.productName || code).slice(0, 200),
        requestedQty: quantity,
        notes,
        status: "pending",
        createdAt: new Date().toISOString(),
        items: [
          {
            productCode: code,
            productName: String(body.productName || code).slice(0, 200),
            quantity,
            notes,
          },
        ],
      };
      db.values.atlas_admin_inquiries_v1 = [
        inquiry,
        ...(db.values.atlas_admin_inquiries_v1 || []),
      ];
      await writeDb(db, revision);
      return send(201, { success: true, inquiry, revision: db.revision });
    }
    if (body.action === "profile") {
      if (!auth.user) fail(401, "ابتدا وارد حساب شوید.");
      const patch = body.payload || {};
      if (
        patch.onboardingCompleted !== undefined &&
        typeof patch.onboardingCompleted !== "boolean"
      )
        fail(400, "وضعیت تکمیل حساب معتبر نیست.");
      if (
        patch.favoriteBrands !== undefined &&
        (!Array.isArray(patch.favoriteBrands) ||
          !patch.favoriteBrands.length ||
          patch.favoriteBrands.some(
            (id: unknown) =>
              typeof id !== "string" ||
              !BRANDS.some((b) => b.id === id && b.active !== false),
          ))
      )
        fail(400, "حداقل یک برند معتبر انتخاب کنید.");
      if (
        patch.businessType !== undefined &&
        !BUSINESS_TYPES.some((b) => b.id === patch.businessType)
      )
        fail(400, "نوع کسب‌وکار را انتخاب کنید.");
      if (
        patch.onboardingCompleted === true &&
        (!(patch.favoriteBrands || auth.user!.favoriteBrands)?.length ||
          !BUSINESS_TYPES.some(
            (b) => b.id === (patch.businessType || auth.user!.businessType),
          ))
      )
        fail(400, "ابتدا برندها و نوع کسب‌وکار را تکمیل کنید.");

      for (const field of [
        "favoriteBrands",
        "businessType",
        "onboardingCompleted",
        "addresses",
        "email",
      ])
        if (patch[field] !== undefined) auth.user![field] = patch[field];
      if (
        patch.addresses &&
        (!Array.isArray(patch.addresses) || patch.addresses.length > 50)
      )
        fail(400, "آدرس‌ها معتبر نیستند.");
      await writeDb(db, revision);
      return send(200, { success: true, user: safeUser(auth.user!) });
    }
    if (body.action === "save") {
      if (!auth.admin) fail(403, "فقط مدیر اجازه ویرایش دارد.");
      if (body.revision !== revision)
        fail(409, "اطلاعات توسط نشست دیگری تغییر کرده است؛ صفحه را تازه کنید.");
      for (const [key, value] of Object.entries(body.values || {})) {
        if (!keys.includes(key)) fail(400, "تنظیمات نامعتبر است.");
        if (key === CUSTOMER_KEY) {
          if (!Array.isArray(value)) fail(400, "فهرست مشتریان نامعتبر است.");
          const seenPhones = new Set<string>(),
            seenNames = new Set<string>();
          const users: Row[] = [];
          for (const row of value as Row[]) {
            for (const field of [
              "totalPurchases",
              "totalOrdersAmount",
              "creditLimit",
              "discountPercent",
            ]) {
              if (
                row[field] !== undefined &&
                (!Number.isFinite(row[field]) ||
                  row[field] < 0 ||
                  (field === "discountPercent" && row[field] > 100))
              )
                fail(400, "مبلغ یا درصد مشتری معتبر نیست.");
            }
            const phone = mobile(row.phone || row.mobile);
            const username = String(row.username || `sanat_${phone.slice(-6)}`)
              .trim()
              .toLowerCase();
            if (
              !row.id ||
              !row.fullName ||
              seenPhones.has(phone) ||
              seenNames.has(username)
            )
              fail(400, "نام کاربری و موبایل هر مشتری باید یکتا باشد.");
            seenPhones.add(phone);
            seenNames.add(username);
            const previous = db.users.find((u) => u.id === row.id);
            const user: Row = {
              ...previous,
              ...row,
              phone,
              mobile: phone,
              username,
              role:
                row.approvedB2B === true
                  ? row.role === "dealer"
                    ? "dealer"
                    : "wholesale"
                  : "retail",
              approvedB2B: row.approvedB2B === true,
              onboardingCompleted: previous?.onboardingCompleted === true,
            };
            // Adopted Supabase accounts can only be provisioned by a verified
            // Supabase Auth identity, never by supplying a CRM password or phone.
            if (!(databaseEnabled() && adoptedSchema())) {
              if (!previous || row.password)
                setPassword(user, String(row.password || phone));
              else {
                user.passwordHash = previous.passwordHash;
                user.passwordSalt = previous.passwordSalt;
                user.sessionVersion = previous.sessionVersion;
              }
            }
            delete user.password;
            users.push(user);
          }
          if (databaseEnabled() && adoptedSchema()) {
            // CRM entries are authoritative in public.crm_customers, not
            // app_private.portal_users. Do not rewrite auth profiles while
            // saving this administrative list.
            db.values[CUSTOMER_KEY] = users.map(safeUser);
          } else {
            db.users = users;
          }
        } else {
          if (
            key === "atlas_portal_club_milestones_v1" &&
            !Array.isArray(value)
          ) {
            if (
              !value ||
              typeof value !== "object" ||
              Object.entries(value).some(
                ([portal, items]) =>
                  !["consumer", "high_volume"].includes(portal) ||
                  !Array.isArray(items),
              )
            )
              fail(400, "ساختار مسیر باشگاه معتبر نیست.");
          } else if (
            key !== "atlas_portal_layout_configs_v1" &&
            !Array.isArray(value)
          )
            fail(400, "ساختار تنظیمات معتبر نیست.");
          db.values[key] = value;
        }
      }
      await writeDb(db, revision);
      return send(200, { success: true, revision: db.revision });
    }
    fail(400, "عملیات نامعتبر است.");
  } catch (error: any) {
    send(error.status || 500, {
      success: false,
      message: error.status
        ? error.message
        : "ذخیره یا دریافت اطلاعات ممکن نشد.",
    });
  } finally {
    release();
  }
}

// Shared authorization for Express-only catalog mutations on persistent hosting.
export async function requirePortalAdmin(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  try {
    const auth = await session(req, await readDb());
    if (!auth.admin) fail(403, "فقط مدیر اجازه ویرایش دارد.");
    if (
      req.headers.origin &&
      new URL(req.headers.origin).host !== req.headers.host
    )
      fail(403, "مبدأ درخواست معتبر نیست.");
    next();
  } catch (error: any) {
    res.statusCode = error.status || 503;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        success: false,
        message: error.status ? error.message : "بررسی دسترسی ممکن نشد.",
      }),
    );
  }
}

/** Resolves a signed session against the current persisted user and revocation version. */
export async function getPortalIdentity(req: IncomingMessage) {
  if(databaseEnabled() && !/(?:^|;)\s*sp_access=/.test(req.headers.cookie || ''))return {admin:false,user:undefined,canReadCommerce:false};
  const db = await readDb();
  const identity = await session(req, db);
  return {
    ...identity,
    canReadCommerce:
      identity.admin || (!!identity.user && canPurchase(db, identity.user)),
  };
}
