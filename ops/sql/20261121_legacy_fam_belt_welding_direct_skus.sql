-- Legacy FAM-only production compatibility:
-- Keep the existing FAM families and variants intact. Publish only the three
-- source-verified welding tools as direct SKU menu records in the approved belt
-- category. This is deliberately not a FAM -> PFAM family migration.
--
-- Source: docs/phase1-catalog-executive-report.md (Question 7) and
-- docs/direct-products-report.md. Expected source families:
--   41497  -> FAM-41497
--   35852  -> FAM-35852
--   110049 -> FAM-90062
--
-- The private snapshot makes this additive projection reversible and idempotent.

BEGIN;

CREATE SCHEMA IF NOT EXISTS internal;

CREATE TABLE IF NOT EXISTS internal.catalog_legacy_fam_belt_welding_direct_backup_20261121 (
  sku_code text PRIMARY KEY,
  previous_row jsonb,
  migration_state text NOT NULL DEFAULT 'rolled_back'
    CHECK (migration_state IN ('applied','rolled_back')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TEMP TABLE legacy_fam_belt_welding_direct_source
ON COMMIT DROP
AS
SELECT *
FROM (VALUES
  ('41497'::text, 'FAM-41497'::text, 'دستگاه‌های تسمه جوشی'::text, 'دستگاه جوش تسمه صنعتی'::text),
  ('35852'::text, 'FAM-35852'::text, 'دستگاه‌های تسمه جوشی'::text, 'دستگاه جوش تسمه صنعتی'::text),
  ('110049'::text, 'FAM-90062'::text, 'دستگاه‌های تسمه جوشی'::text, 'دستگاه جوش تسمه صنعتی'::text)
) AS source(sku_code, expected_family_code, submenu, subcategory);

DO $migration$
DECLARE
  active_pfam integer;
  active_fam integer;
  category_count integer;
  source_count integer;
  backup_count integer;
  applied_count integer;
  rolled_back_count integer;
  restored_count integer;
  target_count integer;
BEGIN
  SELECT
    count(*) FILTER (
      WHERE code LIKE 'PFAM-%' AND is_active=true AND coalesce(is_deleted,false)=false
    )::integer,
    count(*) FILTER (
      WHERE code LIKE 'FAM-%' AND is_active=true AND coalesce(is_deleted,false)=false
    )::integer
  INTO active_pfam, active_fam
  FROM public.catalog_families;

  IF coalesce(active_pfam,0) <> 0 OR coalesce(active_fam,0) = 0 THEN
    RAISE EXCEPTION
      'LEGACY_FAM_WELDING_MIGRATION_REQUIRES_FAM_ONLY_LINEAGE active_pfam=% active_fam=%',
      coalesce(active_pfam,0), coalesce(active_fam,0);
  END IF;

  SELECT count(*)::integer
  INTO category_count
  FROM public.catalog_categories
  WHERE slug='excel-v2-1-4'
    AND is_active=true
    AND metadata->>'source'='industrial_megamenu_hierarchy_v2';

  IF category_count <> 1 THEN
    RAISE EXCEPTION
      'LEGACY_FAM_WELDING_TARGET_CATEGORY_NOT_APPROVED count=%',
      category_count;
  END IF;

  SELECT count(*)::integer
  INTO source_count
  FROM legacy_fam_belt_welding_direct_source s
  JOIN public.catalog_variants v
    ON v.code=s.sku_code
   AND v.family_code=s.expected_family_code
   AND v.active=true
  JOIN public.catalog_families f
    ON f.code=s.expected_family_code
   AND coalesce(f.is_deleted,false)=false;

  IF source_count <> 3 THEN
    RAISE EXCEPTION
      'LEGACY_FAM_WELDING_SOURCE_VALIDATION_FAILED expected=3 found=%',
      source_count;
  END IF;

  -- Never override a disabled SKU or an unrelated/admin-selected category.
  IF EXISTS (
    SELECT 1
    FROM legacy_fam_belt_welding_direct_source s
    JOIN public.catalog_direct_skus d ON d.sku_code=s.sku_code
    WHERE d.is_active=false
       OR d.category_slug NOT IN ('UNRESOLVED','excel-v2-1-4')
       OR (
         d.category_slug='excel-v2-1-4'
         AND (d.submenu IS DISTINCT FROM s.submenu
           OR d.subcategory IS DISTINCT FROM s.subcategory)
       )
       OR (
         d.source_family_code IS NOT NULL
         AND d.source_family_code <> s.expected_family_code
       )
  ) THEN
    RAISE EXCEPTION
      'LEGACY_FAM_WELDING_EXISTING_DIRECT_SKU_CONFLICT; no existing assignment was overwritten';
  END IF;

  SELECT count(*)::integer,
         count(*) FILTER (WHERE migration_state='applied')::integer,
         count(*) FILTER (WHERE migration_state='rolled_back')::integer
  INTO backup_count, applied_count, rolled_back_count
  FROM internal.catalog_legacy_fam_belt_welding_direct_backup_20261121;

  IF backup_count=0 THEN
    INSERT INTO internal.catalog_legacy_fam_belt_welding_direct_backup_20261121
      (sku_code, previous_row, migration_state)
    SELECT s.sku_code, to_jsonb(d), 'rolled_back'
    FROM legacy_fam_belt_welding_direct_source s
    LEFT JOIN public.catalog_direct_skus d ON d.sku_code=s.sku_code;
    backup_count := 3;
    rolled_back_count := 3;
    applied_count := 0;
  ELSIF backup_count <> 3 OR NOT (
    applied_count=3 OR rolled_back_count=3
  ) THEN
    RAISE EXCEPTION
      'LEGACY_FAM_WELDING_BACKUP_INCOMPLETE rows=% applied=% rolled_back=%',
      backup_count, applied_count, rolled_back_count;
  END IF;

  IF applied_count=3 THEN
    SELECT count(*)::integer
    INTO target_count
    FROM legacy_fam_belt_welding_direct_source s
    JOIN public.catalog_direct_skus d
      ON d.sku_code=s.sku_code
     AND d.category_slug='excel-v2-1-4'
     AND d.submenu=s.submenu
     AND d.subcategory=s.subcategory
     AND d.source_family_code=s.expected_family_code
     AND d.is_active=true;

    IF target_count <> 3 THEN
      RAISE EXCEPTION
        'LEGACY_FAM_WELDING_APPLIED_MARKER_BUT_TARGET_DRIFTED expected=3 found=%',
        target_count;
    END IF;

    RAISE NOTICE 'LEGACY_FAM_WELDING_DIRECT_SKUS_ALREADY_APPLIED count=3';
    RETURN;
  END IF;

  -- A rolled-back migration may be reapplied only if the original direct-SKU
  -- rows are still exactly as they were when the backup was taken.
  SELECT count(*)::integer
  INTO restored_count
  FROM internal.catalog_legacy_fam_belt_welding_direct_backup_20261121 b
  LEFT JOIN public.catalog_direct_skus d ON d.sku_code=b.sku_code
  WHERE (b.previous_row IS NULL AND d.sku_code IS NULL)
     OR (b.previous_row IS NOT NULL AND to_jsonb(d)=b.previous_row);

  IF restored_count <> 3 THEN
    RAISE EXCEPTION
      'LEGACY_FAM_WELDING_REAPPLY_SOURCE_DRIFT expected=3 found=%',
      restored_count;
  END IF;

  INSERT INTO public.catalog_direct_skus
    (sku_code,name,category_slug,category_name,submenu,subcategory,brand,image_url,
     technical_specs,price_snapshot,source_family_code,is_active,updated_at)
  SELECT
    v.code,
    v.name,
    c.slug,
    c.name,
    s.submenu,
    s.subcategory,
    coalesce(nullif(trim(v.brand),''),coalesce(d.brand,''),''),
    d.image_url,
    CASE
      WHEN d.technical_specs IS NULL OR d.technical_specs='[]'::jsonb
        THEN coalesce(v.technical_specs,'[]'::jsonb)
      ELSE d.technical_specs
    END,
    coalesce(d.price_snapshot,'{}'::jsonb),
    v.family_code,
    true,
    now()
  FROM legacy_fam_belt_welding_direct_source s
  JOIN public.catalog_variants v
    ON v.code=s.sku_code
   AND v.family_code=s.expected_family_code
   AND v.active=true
  JOIN public.catalog_categories c
    ON c.slug='excel-v2-1-4'
   AND c.is_active=true
   AND c.metadata->>'source'='industrial_megamenu_hierarchy_v2'
  LEFT JOIN public.catalog_direct_skus d ON d.sku_code=s.sku_code
  ON CONFLICT (sku_code) DO UPDATE SET
    name=CASE
      WHEN trim(catalog_direct_skus.name)='' THEN excluded.name
      ELSE catalog_direct_skus.name
    END,
    category_slug=excluded.category_slug,
    category_name=excluded.category_name,
    submenu=excluded.submenu,
    subcategory=excluded.subcategory,
    brand=CASE
      WHEN trim(catalog_direct_skus.brand)='' THEN excluded.brand
      ELSE catalog_direct_skus.brand
    END,
    image_url=coalesce(catalog_direct_skus.image_url,excluded.image_url),
    technical_specs=CASE
      WHEN catalog_direct_skus.technical_specs='[]'::jsonb
        THEN excluded.technical_specs
      ELSE catalog_direct_skus.technical_specs
    END,
    price_snapshot=coalesce(catalog_direct_skus.price_snapshot,'{}'::jsonb),
    source_family_code=excluded.source_family_code,
    is_active=true,
    updated_at=now();

  UPDATE internal.catalog_legacy_fam_belt_welding_direct_backup_20261121
  SET migration_state='applied'
  WHERE sku_code IN ('41497','35852','110049');

  SELECT count(*)::integer
  INTO target_count
  FROM legacy_fam_belt_welding_direct_source s
  JOIN public.catalog_direct_skus d
    ON d.sku_code=s.sku_code
   AND d.category_slug='excel-v2-1-4'
   AND d.submenu=s.submenu
   AND d.subcategory=s.subcategory
   AND d.source_family_code=s.expected_family_code
   AND d.is_active=true;

  IF target_count <> 3 THEN
    RAISE EXCEPTION
      'LEGACY_FAM_WELDING_POSTCONDITION_FAILED expected=3 found=%',
      target_count;
  END IF;
END
$migration$;

COMMIT;
