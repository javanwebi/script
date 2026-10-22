-- =============================================================================
-- Sanat Pish — Pre-Flight Read-Only Audit for sanatpishatlas (spkszfbeeufdcpcltqal)
-- =============================================================================
-- هدف: بررسی ساختار فعلی جداول، هم‌پوشانی شناسه‌ها (IDs) بین portal_kv_store و
-- جداول رابطه‌ای، و بررسی کلیدهای آبجکت بدون هیچ‌گونه تغییر در دیتابیس (100% Read-Only).
-- =============================================================================

-- ۱. بررسی وجود ستون‌های raw_payload و ستون‌های پیش‌نیاز در جداول هدف
SELECT
  t.table_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = 'raw_payload'
  ) AS has_raw_payload,
  CASE
    WHEN t.table_name = 'price_lists' THEN EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'price_lists' AND c.column_name = 'discount_percent'
    )
    WHEN t.table_name = 'club_milestones' THEN EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'club_milestones' AND c.column_name = 'min_purchase_volume'
    )
    WHEN t.table_name = 'portal_announcements' THEN EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'portal_announcements' AND c.column_name = 'summary'
    )
    ELSE true
  END AS has_prerequisite_columns
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

-- ۲. بررسی وضعیت کلیدهای موجود در public.portal_kv_store و تطابق با app_private.document_versions
SELECT
  kv.key,
  jsonb_typeof(kv.value) AS json_type,
  CASE
    WHEN jsonb_typeof(kv.value) = 'array' THEN jsonb_array_length(kv.value)
    WHEN jsonb_typeof(kv.value) = 'object' THEN (SELECT count(*)::int FROM jsonb_object_keys(kv.value))
    ELSE 1
  END AS item_or_key_count,
  dv.version AS tracked_version,
  dv.value_kind AS tracked_kind,
  kv.updated_at
FROM public.portal_kv_store kv
LEFT JOIN app_private.document_versions dv
  ON dv.namespace = kv.key AND dv.scope_id = 'global'
ORDER BY kv.key;

-- ۳. بررسی هم‌پوشانی شناسه‌ها (ID Overlap) بین ۴ کلید آرایه‌ای پر در portal_kv_store و جداول رابطه‌ای فعلی
WITH kv_items AS (
  SELECT
    kv.key AS kv_key,
    elem->>'id' AS item_id,
    COALESCE(elem->>'code', elem->>'tierKey') AS item_code,
    COALESCE(elem->>'name', elem->>'title', elem->>'publicTitle') AS item_title
  FROM public.portal_kv_store kv
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(kv.value) = 'array' THEN kv.value ELSE '[]'::jsonb END
  ) AS elem
  WHERE kv.key IN (
    'atlas_price_lists_v2',
    'atlas_portal_content_announcements_v1',
    'atlas_portal_content_banners_v1',
    'atlas_portal_club_milestones_v1'
  )
)
SELECT
  kv_items.kv_key,
  kv_items.item_id,
  kv_items.item_code,
  kv_items.item_title,
  CASE
    WHEN kv_items.kv_key = 'atlas_price_lists_v2' THEN EXISTS (
      SELECT 1 FROM public.price_lists pl WHERE pl.id = kv_items.item_id
    )
    WHEN kv_items.kv_key = 'atlas_portal_content_announcements_v1' THEN EXISTS (
      SELECT 1 FROM public.portal_announcements pa WHERE pa.id = kv_items.item_id
    )
    WHEN kv_items.kv_key = 'atlas_portal_content_banners_v1' THEN EXISTS (
      SELECT 1 FROM public.portal_banners pb WHERE pb.id = kv_items.item_id
    )
    WHEN kv_items.kv_key = 'atlas_portal_club_milestones_v1' THEN EXISTS (
      SELECT 1 FROM public.club_milestones cm
      WHERE cm.id = kv_items.item_id
         OR cm.id = 'ms-highvol-' || kv_items.item_code
         OR cm.id = 'ms-highvol-' || upper(kv_items.item_code)
         OR cm.id = kv_items.item_code
    )
    ELSE false
  END AS already_exists_in_relational_table
FROM kv_items
ORDER BY kv_items.kv_key, kv_items.item_id;

-- ۴. بررسی کلیدهای سطح اول دو رکورد آبجکت (catalog_overrides_db_v1 و sanatpish:portal:db:v1)
SELECT
  kv.key,
  obj_key AS top_level_key,
  jsonb_typeof(kv.value -> obj_key) AS sub_value_type,
  CASE
    WHEN jsonb_typeof(kv.value -> obj_key) = 'array' THEN jsonb_array_length(kv.value -> obj_key)
    WHEN jsonb_typeof(kv.value -> obj_key) = 'object' THEN (SELECT count(*)::int FROM jsonb_object_keys(kv.value -> obj_key))
    ELSE 1
  END AS sub_count
FROM public.portal_kv_store kv
CROSS JOIN LATERAL jsonb_object_keys(
  CASE WHEN jsonb_typeof(kv.value) = 'object' THEN kv.value ELSE '{}'::jsonb END
) AS obj_key
WHERE kv.key IN ('catalog_overrides_db_v1', 'sanatpish:portal:db:v1')
ORDER BY kv.key, obj_key;
