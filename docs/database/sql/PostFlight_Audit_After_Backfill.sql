-- =============================================================================
-- Sanat Pish — Post-Flight Read-Only Verification Audit for sanatpishatlas
-- Project ID: spkszfbeeufdcpcltqal
-- Migration Version: 20261022120000
-- =============================================================================
-- هدف: تأیید ۱۰۰٪ خواندنی و بدون تغییر که پس از اجرای Migration:
-- ۱. دقیقاً ۲۵ جدول هدف دارای ستون raw_payload هستند (۲۱ جدول جدید + ۴ جدول قبلی).
-- ۲. ستون‌های پیش‌نیاز (مانند portal_announcements.summary) اضافه شده‌اند.
-- ۳. توابع کمکی app_private ایجاد و دسترسی عمومی از آن‌ها سلب شده است.
-- ۴. نسخه 20261022120000 در schema_change_log ثبت شده است.
-- ۵. داده‌های قدیمی (۱۳ رکورد در ۴ حوزه کلیدی) با حفظ مقادیر قبلی همگام شده‌اند.
-- =============================================================================

-- ۱. بررسی جامع ستون raw_payload در ۲۵ جدول هدف (مقدار مورد انتظار: دقیقاً ۲۵ از ۲۵)
SELECT
  COUNT(*) AS total_target_tables,
  COUNT(*) FILTER (WHERE has_raw_payload) AS tables_with_raw_payload,
  COUNT(*) FILTER (WHERE NOT has_raw_payload) AS tables_missing_raw_payload,
  CASE
    WHEN COUNT(*) = 25 AND COUNT(*) FILTER (WHERE has_raw_payload) = 25 THEN 'PASS: تمام ۲۵ جدول هدف دارای ستون raw_payload هستند'
    ELSE 'FAIL: تعداد جدول‌های دارای raw_payload با ۲۵ مطابقت ندارد'
  END AS overall_status
FROM (
  SELECT
    t.table_name,
    EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = t.table_name
        AND c.column_name = 'raw_payload'
    ) AS has_raw_payload
  FROM (
    VALUES
      ('agencies'),
      ('agency_applications'),
      ('agency_deposit_receipts'),
      ('agency_supply_requests'),
      ('agency_messages'),
      ('catalog_brands'),
      ('catalog_categories'),
      ('price_lists'),
      ('price_change_history'),
      ('price_inquiries'),
      ('discount_codes'),
      ('official_invoices'),
      ('plant_machinery_passports'),
      ('marketing_campaigns'),
      ('support_tickets'),
      ('industrial_chat_sessions'),
      ('client_logos'),
      ('blog_posts'),
      ('static_pages'),
      ('sms_templates'),
      ('sms_logs'),
      ('audit_logs'),
      ('portal_announcements'),
      ('portal_banners'),
      ('club_milestones')
  ) AS t(table_name)
) status_audit;

-- ۲. بررسی تک‌تک ۲۵ جدول و ستون‌های تکمیلی و اختصاصی
SELECT
  t.table_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = 'raw_payload'
  ) AS has_raw_payload,
  CASE
    WHEN t.table_name = 'portal_announcements' THEN EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'portal_announcements' AND c.column_name = 'summary'
    )
    WHEN t.table_name = 'price_lists' THEN EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'price_lists' AND c.column_name = 'discount_percent'
    )
    WHEN t.table_name = 'club_milestones' THEN EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'club_milestones' AND c.column_name = 'min_purchase_volume'
    )
    ELSE true
  END AS has_specific_prerequisites
FROM (
  VALUES
    ('agencies'),
    ('agency_applications'),
    ('agency_deposit_receipts'),
    ('agency_supply_requests'),
    ('agency_messages'),
    ('catalog_brands'),
    ('catalog_categories'),
    ('price_lists'),
    ('price_change_history'),
    ('price_inquiries'),
    ('discount_codes'),
    ('official_invoices'),
    ('plant_machinery_passports'),
    ('marketing_campaigns'),
    ('support_tickets'),
    ('industrial_chat_sessions'),
    ('client_logos'),
    ('blog_posts'),
    ('static_pages'),
    ('sms_templates'),
    ('sms_logs'),
    ('audit_logs'),
    ('portal_announcements'),
    ('portal_banners'),
    ('club_milestones')
) AS t(table_name)
ORDER BY t.table_name;

-- ۳. بررسی ثبت نسخه Migration در جدول لاگ تغییرات اسکیما
SELECT
  version,
  description,
  applied_at,
  CASE
    WHEN version = '20261022120000' THEN 'PASS: نسخه 20261022120000 با موفقیت در تاریخچه دیتابیس ثبت شده است'
    ELSE 'UNKNOWN'
  END AS migration_status
FROM app_private.schema_change_log
WHERE version = '20261022120000';

-- ۴. بررسی وجود توابع کمکی امن در app_private و بسته بودن دسترسی public
SELECT
  r.routine_name,
  r.routine_type,
  r.security_type,
  CASE
    WHEN has_function_privilege('public', 'app_private.' || r.routine_name || '()', 'EXECUTE') THEN 'WARNING: PUBLIC_CAN_EXECUTE'
    ELSE 'PASS: SECURE (REVOKED FROM PUBLIC)'
  END AS security_status
FROM information_schema.routines r
WHERE r.routine_schema = 'app_private'
  AND r.routine_name IN (
    'safe_numeric',
    'safe_int',
    'safe_bool',
    'safe_timestamptz',
    'safe_jsonb_array',
    'safe_jsonb_object',
    'backfill_relational_projections_from_kv'
  )
ORDER BY r.routine_name;

-- ۵. بررسی حفظ و همگام‌سازی ۱۳ رکورد در ۴ حوزه کلیدی و پر بودن raw_payload
SELECT
  'price_lists' AS domain,
  count(*) AS total_rows,
  count(*) FILTER (WHERE raw_payload <> '{}'::jsonb) AS rows_with_kv_payload,
  count(*) FILTER (WHERE discount_percent > 0) AS rows_with_discount
FROM public.price_lists
UNION ALL
SELECT
  'portal_announcements' AS domain,
  count(*) AS total_rows,
  count(*) FILTER (WHERE raw_payload <> '{}'::jsonb) AS rows_with_kv_payload,
  count(*) FILTER (WHERE summary IS NOT NULL OR raw_payload->>'summary' IS NOT NULL) AS rows_with_summary
FROM public.portal_announcements
UNION ALL
SELECT
  'portal_banners' AS domain,
  count(*) AS total_rows,
  count(*) FILTER (WHERE raw_payload <> '{}'::jsonb) AS rows_with_kv_payload,
  count(*) FILTER (WHERE target_roles <> '[]'::jsonb OR raw_payload->>'targetRoles' IS NOT NULL) AS rows_with_roles
FROM public.portal_banners
UNION ALL
SELECT
  'club_milestones' AS domain,
  count(*) AS total_rows,
  count(*) FILTER (WHERE raw_payload <> '{}'::jsonb) AS rows_with_kv_payload,
  count(*) FILTER (WHERE min_purchase_volume IS NOT NULL OR raw_payload->>'minPurchaseVolume' IS NOT NULL) AS rows_with_volume
FROM public.club_milestones;
