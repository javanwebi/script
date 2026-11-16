-- PVC conveyor surface family split.
-- Source identity is the explicit local catalogue surface label, not a guessed ISO/manufacturer equivalent.
-- SKU dimensions remain variants; per-SKU units, images, commercial specs and source names are preserved.

DO $$
DECLARE
  v_total integer;
  v_stone integer;
  v_chicken integer;
  v_conical integer;
  v_unknown integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.catalog_families
    WHERE code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008'
      AND is_active=true AND coalesce(is_deleted,false)=false
  ) THEN
    RAISE EXCEPTION 'PVC source family is missing or inactive; refusing surface split';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.catalog_categories WHERE slug='excel-v2-2-1') THEN
    RAISE EXCEPTION 'Approved conveyor category excel-v2-2-1 is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.catalog_family_menu_assignments
    WHERE family_code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008'
      AND category_slug='excel-v2-2-1'
      AND submenu_name='بر اساس جنس'
      AND leaf_name='نوار نقاله PVC'
  ) THEN
    RAISE EXCEPTION 'Existing PVC conveyor family does not have its approved menu path';
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE name ILIKE '%سنگی%' OR name ILIKE '%سنگي%'),
    count(*) FILTER (WHERE name ILIKE '%پامرغی%' OR name ILIKE '%پامرغي%' OR name ILIKE '%پا مرغی%' OR name ILIKE '%پا مرغی%'),
    count(*) FILTER (WHERE name ILIKE '%قندی%' OR name ILIKE '%قندي%'),
    count(*) FILTER (
      WHERE name NOT ILIKE '%سنگی%' AND name NOT ILIKE '%سنگي%'
        AND name NOT ILIKE '%پامرغی%' AND name NOT ILIKE '%پامرغي%'
        AND name NOT ILIKE '%پا مرغی%'
        AND name NOT ILIKE '%قندی%' AND name NOT ILIKE '%قندي%'
    )
  INTO v_total,v_stone,v_chicken,v_conical,v_unknown
  FROM public.catalog_variants
  WHERE family_code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008'
    AND active=true;

  IF v_total <> 146 OR v_stone <> 114 OR v_chicken <> 3 OR v_conical <> 4 OR v_unknown <> 25 THEN
    RAISE EXCEPTION 'PVC surface preflight mismatch: total %, stone %, chicken %, conical %, unknown %',
      v_total,v_stone,v_chicken,v_conical,v_unknown;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.catalog_variants
    WHERE family_code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008'
      AND reconstructed_family_code IS DISTINCT FROM 'PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008'
  ) THEN
    RAISE EXCEPTION 'PVC source family contains inconsistent reconstructed_family_code values';
  END IF;

  IF (
    SELECT count(*) FROM public.variant_commercial_specs s
    JOIN public.catalog_variants v ON v.code=s.variant_code
    WHERE v.family_code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008'
  ) <> 146 THEN
    RAISE EXCEPTION 'Expected 146 commercial-spec rows for PVC variants; refusing partial update';
  END IF;

  IF (
    SELECT count(*) FROM public.catalog_family_aliases
    WHERE old_family_code='FAM-52858'
      AND new_family_code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008'
  ) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one source-family alias for FAM-52858';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.catalog_variants v
    JOIN public.catalog_direct_skus d ON d.sku_code=v.code AND d.is_active=true
    WHERE v.family_code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008'
  ) THEN
    RAISE EXCEPTION 'PVC family contains duplicate active direct-SKU records; reconcile before splitting';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.catalog_families
    WHERE code IN (
      'PFAM-CONVEYOR-PVC-STONE-SURFACE-20261116',
      'PFAM-CONVEYOR-PVC-PAMARGHI-PATTERN-20261116',
      'PFAM-CONVEYOR-PVC-KALEGHANDI-CLEAT-20261116'
    )
  ) THEN
    RAISE EXCEPTION 'One or more PVC surface target family codes already exist';
  END IF;

  IF to_regclass('internal.catalog_pvc_surface_variants_backup_20261116') IS NOT NULL
     OR to_regclass('internal.catalog_pvc_surface_commercial_backup_20261116') IS NOT NULL
     OR to_regclass('internal.catalog_pvc_surface_family_backup_20261116') IS NOT NULL
     OR to_regclass('internal.catalog_pvc_surface_assignment_backup_20261116') IS NOT NULL
     OR to_regclass('internal.catalog_pvc_surface_alias_backup_20261116') IS NOT NULL THEN
    RAISE EXCEPTION 'PVC surface rollback backups already exist; inspect before retrying';
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS internal;
REVOKE ALL ON SCHEMA internal FROM PUBLIC, anon, authenticated;

CREATE TABLE internal.catalog_pvc_surface_variants_backup_20261116 AS
SELECT * FROM public.catalog_variants
WHERE family_code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008';

CREATE TABLE internal.catalog_pvc_surface_commercial_backup_20261116 AS
SELECT s.*
FROM public.variant_commercial_specs s
JOIN internal.catalog_pvc_surface_variants_backup_20261116 b ON b.code=s.variant_code;

CREATE TABLE internal.catalog_pvc_surface_family_backup_20261116 AS
SELECT * FROM public.catalog_families
WHERE code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008';

CREATE TABLE internal.catalog_pvc_surface_assignment_backup_20261116 AS
SELECT * FROM public.catalog_family_menu_assignments
WHERE family_code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008';

CREATE TABLE internal.catalog_pvc_surface_alias_backup_20261116 AS
SELECT * FROM public.catalog_family_aliases
WHERE old_family_code='FAM-52858'
  AND new_family_code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008';

REVOKE ALL ON TABLE
  internal.catalog_pvc_surface_variants_backup_20261116,
  internal.catalog_pvc_surface_commercial_backup_20261116,
  internal.catalog_pvc_surface_family_backup_20261116,
  internal.catalog_pvc_surface_assignment_backup_20261116,
  internal.catalog_pvc_surface_alias_backup_20261116
FROM PUBLIC, anon, authenticated;

-- Create one family per explicit surface identity. "کله‌قندی سوراخ‌دار" remains
-- a SKU-level label within the same local کله‌قندی family; no standard equivalence is inferred.
WITH classified AS (
  SELECT
    v.*,
    CASE
      WHEN v.name ILIKE '%سنگی%' OR v.name ILIKE '%سنگي%' THEN 'PVC_STONE_SURFACE'
      WHEN v.name ILIKE '%پامرغی%' OR v.name ILIKE '%پامرغي%' OR v.name ILIKE '%پا مرغی%' THEN 'PVC_PAMARGHI_PATTERN'
      WHEN v.name ILIKE '%قندی%' OR v.name ILIKE '%قندي%' THEN 'PVC_CONICAL_CLEAT'
      ELSE 'PVC_SURFACE_UNSPECIFIED'
    END AS profile_code
  FROM public.catalog_variants v
  WHERE v.family_code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008'
    AND v.active=true
),
stats AS (
  SELECT
    profile_code,
    count(*)::integer AS item_count,
    string_agg(DISTINCT coalesce(nullif(btrim(size),''),'نامشخص'), ' | '
      ORDER BY coalesce(nullif(btrim(size),''),'نامشخص')) AS sizes_summary,
    string_agg(DISTINCT coalesce(nullif(btrim(unit),''),'نامشخص'), '، '
      ORDER BY coalesce(nullif(btrim(unit),''),'نامشخص')) AS units_summary,
    CASE
      WHEN count(DISTINCT coalesce(nullif(btrim(unit),''),'نامشخص')) > 1 THEN 'متنوع'
      ELSE max(coalesce(nullif(btrim(unit),''),'نامشخص'))
    END AS family_unit
  FROM classified
  GROUP BY profile_code
),
mapping(profile_code,family_code,family_name,surface_label,construction) AS (
  VALUES
    ('PVC_STONE_SURFACE','PFAM-CONVEYOR-PVC-STONE-SURFACE-20261116','نوار نقاله PVC | سطح سنگی','سنگی','نوار نقاله PVC صنعتی (سطح سنگی)'),
    ('PVC_PAMARGHI_PATTERN','PFAM-CONVEYOR-PVC-PAMARGHI-PATTERN-20261116','نوار نقاله PVC | سطح پامرغی','پامرغی','نوار نقاله PVC صنعتی (الگوی پامرغی)'),
    ('PVC_CONICAL_CLEAT','PFAM-CONVEYOR-PVC-KALEGHANDI-CLEAT-20261116','نوار نقاله PVC | پروفیل کله‌قندی','کله‌قندی','نوار نقاله PVC صنعتی (پروفیل کله‌قندی)')
)
INSERT INTO public.catalog_families (
  code,canonical_family_code,source_row,name,brand,category_slug,category_name,submenu,subcategory,
  profiles,sizes_summary,unit,item_count,materials,filters_hint,source_status,description,
  has_catalogue_image,image_scope,images,technical_specs,tags,correction_pages,
  is_deleted,is_active,override_version,created_at,updated_at
)
SELECT
  m.family_code,
  m.family_code,
  t.source_row,
  m.family_name,
  t.brand,
  t.category_slug,
  t.category_name,
  t.submenu,
  t.subcategory,
  m.profile_code,
  s.sizes_summary,
  s.family_unit,
  s.item_count,
  t.materials,
  t.filters_hint,
  'engineering_audited_20261116',
  m.family_name || '؛ ' || s.item_count::text || ' کد کالا. برچسب سطح از عنوان کاتالوگ استخراج شده است؛ معادل استاندارد یا سازنده‌ای بدون دیتاشیت ادعا نمی‌شود. واحدهای ثبت‌شده: ' || s.units_summary || '.',
  false,
  null,
  '[]'::jsonb,
  jsonb_build_array(
    jsonb_build_object('key','نوع محصول','value','نوار نقاله PVC'),
    jsonb_build_object('key','جنس و متریال','value','پلی‌وینیل کلراید (PVC Conveyor Belt)'),
    jsonb_build_object('key','ساختار مهندسی','value',m.construction),
    jsonb_build_object('key','پروفیل سطح کاتالوگ','value',m.surface_label),
    jsonb_build_object('key','استاندارد مرجع','value','NOT_ESTABLISHED'),
    jsonb_build_object('key','واحدهای ثبت‌شده','value',s.units_summary),
    jsonb_build_object('key','تعداد کد کالا','value',s.item_count::text),
    jsonb_build_object('key','productType','value','نوار نقاله PVC'),
    jsonb_build_object('key','brand','value','GENERIC_INDUSTRIAL'),
    jsonb_build_object('key','material','value','پلی‌وینیل کلراید (PVC Conveyor Belt)'),
    jsonb_build_object('key','construction','value',m.construction),
    jsonb_build_object('key','profile','value',m.profile_code),
    jsonb_build_object('key','standard','value','NOT_ESTABLISHED'),
    jsonb_build_object('key','unit','value',s.family_unit)
  ),
  jsonb_build_array('نوارهای نقاله و انتقال مواد','نوار نقاله PVC','بر اساس جنس',m.profile_code,m.surface_label),
  t.correction_pages,
  false,
  true,
  1,
  now(),
  now()
FROM mapping m
JOIN stats s ON s.profile_code=m.profile_code
CROSS JOIN (
  SELECT * FROM public.catalog_families
  WHERE code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008'
) t
WHERE s.item_count > 0;

-- Keep the generic source code for the 25 PVC SKUs whose surface pattern is not stated.
WITH classified AS (
  SELECT
    v.*,
    CASE
      WHEN v.name ILIKE '%سنگی%' OR v.name ILIKE '%سنگي%' THEN 'PVC_STONE_SURFACE'
      WHEN v.name ILIKE '%پامرغی%' OR v.name ILIKE '%پامرغي%' OR v.name ILIKE '%پا مرغی%' THEN 'PVC_PAMARGHI_PATTERN'
      WHEN v.name ILIKE '%قندی%' OR v.name ILIKE '%قندي%' THEN 'PVC_CONICAL_CLEAT'
      ELSE 'PVC_SURFACE_UNSPECIFIED'
    END AS profile_code
  FROM public.catalog_variants v
  WHERE v.family_code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008'
    AND v.active=true
),
stats AS (
  SELECT
    count(*)::integer AS item_count,
    string_agg(DISTINCT coalesce(nullif(btrim(size),''),'نامشخص'), ' | '
      ORDER BY coalesce(nullif(btrim(size),''),'نامشخص')) AS sizes_summary,
    string_agg(DISTINCT coalesce(nullif(btrim(unit),''),'نامشخص'), '، '
      ORDER BY coalesce(nullif(btrim(unit),''),'نامشخص')) AS units_summary,
    CASE
      WHEN count(DISTINCT coalesce(nullif(btrim(unit),''),'نامشخص')) > 1 THEN 'متنوع'
      ELSE max(coalesce(nullif(btrim(unit),''),'نامشخص'))
    END AS family_unit
  FROM classified
  WHERE profile_code='PVC_SURFACE_UNSPECIFIED'
)
UPDATE public.catalog_families f
SET
  name='نوار نقاله PVC | الگوی سطح نامشخص',
  profiles='PVC_SURFACE_UNSPECIFIED',
  sizes_summary=s.sizes_summary,
  unit=s.family_unit,
  item_count=s.item_count,
  source_status='engineering_audited_20261116',
  description='این خانواده فقط شامل کدهایی است که جنس PVC و ماهیت نوار نقاله در منبع مشخص است، اما الگوی سطح ثبت نشده است. رنگ‌هایی مانند سبز، زرد یا شفاف به‌تنهایی دلیل صاف/ساده بودن سطح نیستند. تا دریافت عکس/دیتاشیت، این کدها جدا و نیازمند بررسی می‌مانند. واحدهای ثبت‌شده: ' || s.units_summary || '.',
  technical_specs=jsonb_build_array(
    jsonb_build_object('key','نوع محصول','value','نوار نقاله PVC'),
    jsonb_build_object('key','جنس و متریال','value','پلی‌وینیل کلراید (PVC Conveyor Belt)'),
    jsonb_build_object('key','ساختار مهندسی','value','نوار نقاله PVC با الگوی سطح نامشخص'),
    jsonb_build_object('key','پروفیل سطح کاتالوگ','value','الگوی سطح نامشخص'),
    jsonb_build_object('key','استاندارد مرجع','value','NOT_ESTABLISHED'),
    jsonb_build_object('key','واحدهای ثبت‌شده','value',s.units_summary),
    jsonb_build_object('key','تعداد کد کالا','value',s.item_count::text),
    jsonb_build_object('key','productType','value','نوار نقاله PVC'),
    jsonb_build_object('key','brand','value','GENERIC_INDUSTRIAL'),
    jsonb_build_object('key','material','value','پلی‌وینیل کلراید (PVC Conveyor Belt)'),
    jsonb_build_object('key','construction','value','نوار نقاله PVC با الگوی سطح نامشخص'),
    jsonb_build_object('key','profile','value','PVC_SURFACE_UNSPECIFIED'),
    jsonb_build_object('key','standard','value','NOT_ESTABLISHED'),
    jsonb_build_object('key','unit','value',s.family_unit)
  ),
  tags=jsonb_build_array('نوارهای نقاله و انتقال مواد','نوار نقاله PVC','بر اساس جنس','PVC_SURFACE_UNSPECIFIED','الگوی سطح نامشخص'),
  override_version=coalesce(f.override_version,0)+1,
  updated_at=now()
FROM stats s
WHERE f.code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008'
  AND s.item_count=25;

-- Publish all four PVC families on the existing approved PVC conveyor leaf.
INSERT INTO public.catalog_family_menu_assignments
  (family_code,category_slug,submenu_name,leaf_name,method,created_at,updated_at)
VALUES
  ('PFAM-CONVEYOR-PVC-STONE-SURFACE-20261116','excel-v2-2-1','بر اساس جنس','نوار نقاله PVC','engineering_audited',now(),now()),
  ('PFAM-CONVEYOR-PVC-PAMARGHI-PATTERN-20261116','excel-v2-2-1','بر اساس جنس','نوار نقاله PVC','engineering_audited',now(),now()),
  ('PFAM-CONVEYOR-PVC-KALEGHANDI-CLEAT-20261116','excel-v2-2-1','بر اساس جنس','نوار نقاله PVC','engineering_audited',now(),now())
ON CONFLICT (family_code) DO UPDATE
SET category_slug=EXCLUDED.category_slug,
    submenu_name=EXCLUDED.submenu_name,
    leaf_name=EXCLUDED.leaf_name,
    method=EXCLUDED.method,
    updated_at=now();

-- Assign SKU and family identity without changing SKU code, size, unit, images or commercial data.
WITH mapped AS (
  SELECT
    v.code,
    v.name,
    CASE
      WHEN v.name ILIKE '%سنگی%' OR v.name ILIKE '%سنگي%' THEN 'PVC_STONE_SURFACE'
      WHEN v.name ILIKE '%پامرغی%' OR v.name ILIKE '%پامرغي%' OR v.name ILIKE '%پا مرغی%' THEN 'PVC_PAMARGHI_PATTERN'
      WHEN v.name ILIKE '%قندی%' OR v.name ILIKE '%قندي%' THEN 'PVC_CONICAL_CLEAT'
      ELSE 'PVC_SURFACE_UNSPECIFIED'
    END AS profile_code,
    CASE
      WHEN v.name ILIKE '%سنگی%' OR v.name ILIKE '%سنگي%' THEN 'PFAM-CONVEYOR-PVC-STONE-SURFACE-20261116'
      WHEN v.name ILIKE '%پامرغی%' OR v.name ILIKE '%پامرغي%' OR v.name ILIKE '%پا مرغی%' THEN 'PFAM-CONVEYOR-PVC-PAMARGHI-PATTERN-20261116'
      WHEN v.name ILIKE '%قندی%' OR v.name ILIKE '%قندي%' THEN 'PFAM-CONVEYOR-PVC-KALEGHANDI-CLEAT-20261116'
      ELSE 'PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008'
    END AS target_family_code,
    CASE
      WHEN v.name ILIKE '%سنگی%' OR v.name ILIKE '%سنگي%' THEN 'سنگی'
      WHEN v.name ILIKE '%پامرغی%' OR v.name ILIKE '%پامرغي%' OR v.name ILIKE '%پا مرغی%' THEN 'پامرغی'
      WHEN v.name ILIKE '%قندی%' OR v.name ILIKE '%قندي%' THEN
        CASE
          WHEN v.name ILIKE '%سوراخ دار%' OR v.name ILIKE '%سوراخ‌دار%' OR v.name ILIKE '%سوراخدار%'
            THEN 'کله‌قندی سوراخ‌دار'
          ELSE 'کله‌قندی'
        END
      ELSE 'الگوی سطح نامشخص'
    END AS surface_label,
    CASE
      WHEN v.name ILIKE '%سنگی%' OR v.name ILIKE '%سنگي%' THEN 'نوار نقاله PVC صنعتی (سطح سنگی)'
      WHEN v.name ILIKE '%پامرغی%' OR v.name ILIKE '%پامرغي%' OR v.name ILIKE '%پا مرغی%' THEN 'نوار نقاله PVC صنعتی (الگوی پامرغی)'
      WHEN v.name ILIKE '%قندی%' OR v.name ILIKE '%قندي%' THEN 'نوار نقاله PVC صنعتی (پروفیل کله‌قندی)'
      ELSE 'نوار نقاله PVC صنعتی (الگوی سطح نامشخص)'
    END AS construction
  FROM public.catalog_variants v
  WHERE v.family_code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008'
    AND v.active=true
)
UPDATE public.catalog_variants v
SET
  family_code=m.target_family_code,
  reconstructed_family_code=m.target_family_code,
  identity_specs=jsonb_set(
    jsonb_set(
      jsonb_set(coalesce(v.identity_specs,'{}'::jsonb),'{profile}',to_jsonb(m.profile_code),true),
      '{construction}',to_jsonb(m.construction),true
    ),
    '{standard}',to_jsonb('NOT_ESTABLISHED'::text),true
  ),
  variable_specs=jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(coalesce(v.variable_specs,'{}'::jsonb),'{profile}',to_jsonb(m.profile_code),true),
        '{construction}',to_jsonb(m.construction),true
      ),
      '{standard}',to_jsonb('NOT_ESTABLISHED'::text),true
    ),
    '{unit}',to_jsonb(v.unit),true
  ) || jsonb_build_object('surfaceTradeLabel',m.surface_label),
  technical_specs=coalesce(v.technical_specs,'[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('key','پروفیل سطح کاتالوگ','value',m.surface_label),
    jsonb_build_object('key','کد پروفیل کاتالوگی','value',m.profile_code),
    jsonb_build_object('key','وضعیت استاندارد سازنده','value','NOT_ESTABLISHED')
  ),
  technical_review=CASE
    WHEN m.profile_code='PVC_SURFACE_UNSPECIFIED' THEN
      jsonb_set(
        jsonb_set(
          coalesce(v.technical_review,'{}'::jsonb),
          '{note}',
          to_jsonb('جنس PVC و ماهیت نوار نقاله از عنوان کاتالوگ مشخص است؛ الگوی سطح در عنوان/مدرک موجود تعیین نشده و تا بررسی فیزیکی یا دیتاشیت نامشخص باقی می‌ماند.'::text),
          true
        ),
        '{researchWarnings}',
        coalesce(v.technical_review->'researchWarnings','[]'::jsonb) ||
          jsonb_build_array('الگوی سطح PVC از منبع موجود قابل تعیین نیست؛ در خانواده مستقل نامشخص نگه داشته شد و نباید صاف/ساده فرض شود.'),
        true
      )
    ELSE v.technical_review
  END,
  confidence_score=CASE WHEN m.profile_code='PVC_SURFACE_UNSPECIFIED' THEN 70 ELSE 85 END,
  updated_at=now()
FROM mapped m
WHERE v.code=m.code;

-- Keep commercial records attached to the exact same family as their SKU.
UPDATE public.variant_commercial_specs s
SET family_code=v.family_code,
    updated_at=now()
FROM public.catalog_variants v
JOIN internal.catalog_pvc_surface_variants_backup_20261116 b ON b.code=v.code
WHERE s.variant_code=v.code;

-- Extend the source-family alias so every resulting PVC family remains traceable to FAM-52858.
UPDATE public.catalog_family_aliases a
SET all_new_family_codes=ARRAY(
      SELECT DISTINCT family_code
      FROM unnest(
        coalesce(a.all_new_family_codes,ARRAY[]::text[]) ||
        ARRAY[
          'PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008',
          'PFAM-CONVEYOR-PVC-STONE-SURFACE-20261116',
          'PFAM-CONVEYOR-PVC-PAMARGHI-PATTERN-20261116',
          'PFAM-CONVEYOR-PVC-KALEGHANDI-CLEAT-20261116'
        ]::text[]
      ) AS families(family_code)
      ORDER BY family_code
    ),
    updated_at=now()
WHERE a.old_family_code='FAM-52858'
  AND a.new_family_code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008';

-- Fail closed if any SKU, unit, image, commercial record or family count changed unexpectedly.
DO $$
DECLARE
  v_stone integer;
  v_chicken integer;
  v_conical integer;
  v_unknown integer;
BEGIN
  SELECT count(*) INTO v_stone FROM public.catalog_variants
    WHERE family_code='PFAM-CONVEYOR-PVC-STONE-SURFACE-20261116' AND active=true;
  SELECT count(*) INTO v_chicken FROM public.catalog_variants
    WHERE family_code='PFAM-CONVEYOR-PVC-PAMARGHI-PATTERN-20261116' AND active=true;
  SELECT count(*) INTO v_conical FROM public.catalog_variants
    WHERE family_code='PFAM-CONVEYOR-PVC-KALEGHANDI-CLEAT-20261116' AND active=true;
  SELECT count(*) INTO v_unknown FROM public.catalog_variants
    WHERE family_code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008' AND active=true;

  IF v_stone<>114 OR v_chicken<>3 OR v_conical<>4 OR v_unknown<>25 THEN
    RAISE EXCEPTION 'PVC surface postflight mismatch: stone %, chicken %, conical %, unknown %',
      v_stone,v_chicken,v_conical,v_unknown;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.catalog_variants v
    JOIN internal.catalog_pvc_surface_variants_backup_20261116 b ON b.code=v.code
    WHERE v.images IS DISTINCT FROM b.images
       OR v.unit IS DISTINCT FROM b.unit
       OR v.name IS DISTINCT FROM b.name
       OR v.size IS DISTINCT FROM b.size
  ) THEN
    RAISE EXCEPTION 'PVC migration changed source SKU name, size, unit or image payload';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.catalog_variants v
    JOIN public.variant_commercial_specs s ON s.variant_code=v.code
    WHERE v.code IN (SELECT code FROM internal.catalog_pvc_surface_variants_backup_20261116)
      AND s.family_code IS DISTINCT FROM v.family_code
  ) THEN
    RAISE EXCEPTION 'PVC commercial records are not attached to their SKU family';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.catalog_variants v
    WHERE v.code IN (SELECT code FROM internal.catalog_pvc_surface_variants_backup_20261116)
      AND (
        v.identity_specs->>'profile' IS DISTINCT FROM
          CASE
            WHEN v.name ILIKE '%سنگی%' OR v.name ILIKE '%سنگي%' THEN 'PVC_STONE_SURFACE'
            WHEN v.name ILIKE '%پامرغی%' OR v.name ILIKE '%پامرغي%' OR v.name ILIKE '%پا مرغی%' THEN 'PVC_PAMARGHI_PATTERN'
            WHEN v.name ILIKE '%قندی%' OR v.name ILIKE '%قندي%' THEN 'PVC_CONICAL_CLEAT'
            ELSE 'PVC_SURFACE_UNSPECIFIED'
          END
        OR v.variable_specs->>'unit' IS DISTINCT FROM v.unit
        OR v.identity_specs->>'standard' IS DISTINCT FROM 'NOT_ESTABLISHED'
      )
  ) THEN
    RAISE EXCEPTION 'PVC SKU identity/variable specs are not synchronized with the audited profile and unit';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.catalog_families f
    WHERE f.code IN (
      'PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008',
      'PFAM-CONVEYOR-PVC-STONE-SURFACE-20261116',
      'PFAM-CONVEYOR-PVC-PAMARGHI-PATTERN-20261116',
      'PFAM-CONVEYOR-PVC-KALEGHANDI-CLEAT-20261116'
    )
    AND f.item_count IS DISTINCT FROM (
      SELECT count(*)::integer FROM public.catalog_variants v
      WHERE v.family_code=f.code AND v.active=true
    )
  ) THEN
    RAISE EXCEPTION 'PVC family item_count does not match active SKU membership';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.catalog_variants
    WHERE code IN (SELECT code FROM internal.catalog_pvc_surface_variants_backup_20261116)
      AND family_code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008'
      AND (name ILIKE '%سنگی%' OR name ILIKE '%سنگي%' OR name ILIKE '%پامرغی%' OR name ILIKE '%پامرغي%' OR name ILIKE '%قندی%' OR name ILIKE '%قندي%')
  ) THEN
    RAISE EXCEPTION 'A named PVC surface profile remains in the generic unknown-surface family';
  END IF;

  IF NOT (
    SELECT all_new_family_codes @> ARRAY[
      'PFAM-CONVEYOR-PVC-STONE-SURFACE-20261116',
      'PFAM-CONVEYOR-PVC-PAMARGHI-PATTERN-20261116',
      'PFAM-CONVEYOR-PVC-KALEGHANDI-CLEAT-20261116'
    ]::text[]
    FROM public.catalog_family_aliases
    WHERE old_family_code='FAM-52858'
      AND new_family_code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008'
  ) THEN
    RAISE EXCEPTION 'Source-family alias is missing one or more new PVC family codes';
  END IF;
END $$;
