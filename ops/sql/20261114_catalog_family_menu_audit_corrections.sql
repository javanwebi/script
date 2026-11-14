-- Source-verified, idempotent family-menu corrections for the 2026-11-14 audit.
-- No catalog_families or catalog_variants rows are deleted.
-- Only unsafe automatic menu assignments are removed; admin_verified rows are preserved.
BEGIN;

DO $$
DECLARE
  steel_family_count integer;
  pvc_family_count integer;
BEGIN
  SELECT count(*) INTO steel_family_count
  FROM public.catalog_families
  WHERE code IN ('FAM-35826','FAM-10105','FAM-52948')
    AND is_active=true AND is_deleted=false;

  IF steel_family_count <> 3 THEN
    RAISE EXCEPTION 'Expected 3 active stainless guide families from the authoritative Excel, found %', steel_family_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.catalog_families
    WHERE code IN ('FAM-35826','FAM-10105','FAM-52948')
      AND NOT (name ILIKE '%استیل%' OR name ILIKE '%استيل%')
  ) THEN
    RAISE EXCEPTION 'Stainless guide family name validation failed; refusing menu correction';
  END IF;

  SELECT count(*) INTO pvc_family_count
  FROM public.catalog_families
  WHERE code='FAM-52858'
    AND is_active=true AND is_deleted=false
    AND name ILIKE '%نوار نقاله%';

  IF pvc_family_count <> 1 THEN
    RAISE EXCEPTION 'Expected active source family FAM-52858 (نوار نقاله), found %', pvc_family_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.catalog_categories
    WHERE slug='excel-v2-6-2' AND is_active=true
      AND metadata->>'source'='industrial_megamenu_hierarchy_v2'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.catalog_categories
    WHERE slug='excel-v2-2-1' AND is_active=true
      AND metadata->>'source'='industrial_megamenu_hierarchy_v2'
  ) THEN
    RAISE EXCEPTION 'Approved guide or conveyor category is missing';
  END IF;
END $$;

-- 97 families remain in catalog_families and catalog_variants.
-- They are omitted from automatic mapping because their source type, material,
-- family contents, or current approved-menu destination is ambiguous or unsupported.
DELETE FROM public.catalog_family_menu_assignments
WHERE family_code IN (
  'FAM-33416',
  'FAM-35198',
  'FAM-33126',
  'FAM-32711',
  'FAM-34280',
  'FAM-54569',
  'FAM-381961',
  'FAM-36858',
  'FAM-39853',
  'FAM-31520',
  'FAM-32174',
  'FAM-39782',
  'FAM-39852',
  'FAM-41065',
  'FAM-41498',
  'FAM-33163',
  'FAM-41601',
  'FAM-38800',
  'FAM-35310',
  'FAM-34854',
  'FAM-36750',
  'FAM-38283',
  'FAM-41326',
  'FAM-32735',
  'FAM-39005',
  'FAM-80151',
  'FAM-10111',
  'FAM-52319',
  'FAM-40462',
  'FAM-41253',
  'FAM-39130',
  'FAM-38906',
  'FAM-22751',
  'FAM-35525',
  'FAM-30',
  'FAM-37769',
  'FAM-51279',
  'FAM-40604',
  'FAM-10410',
  'FAM-40417',
  'FAM-38285',
  'FAM-38786',
  'FAM-35624',
  'FAM-40609',
  'FAM-52735',
  'FAM-31929',
  'FAM-38697',
  'FAM-35743',
  'FAM-33996',
  'FAM-32247',
  'FAM-32246',
  'FAM-321931',
  'FAM-39114',
  'FAM-40601',
  'FAM-10657',
  'FAM-34667',
  'FAM-34885',
  'FAM-34881',
  'FAM-34882',
  'FAM-37134',
  'FAM-32786',
  'FAM-39543',
  'FAM-35330',
  'FAM-33547',
  'FAM-31533',
  'FAM-90163',
  'FAM-90206',
  'FAM-40522',
  'FAM-40001',
  'FAM-34123',
  'FAM-34138',
  'FAM-40749',
  'FAM-40728',
  'FAM-34899',
  'FAM-35526',
  'FAM-36814',
  'FAM-32697',
  'FAM-41148',
  'FAM-38660',
  'FAM-39946',
  'FAM-34949',
  'FAM-33173',
  'FAM-32268',
  'FAM-37317',
  'FAM-33675',
  'FAM-35245',
  'FAM-13962',
  'FAM-13963',
  'FAM-33318',
  'FAM-34724',
  'FAM-37929',
  'FAM-36577',
  'FAM-33154',
  'FAM-37715',
  'FAM-10161',
  'FAM-90308',
  'FAM-38353'
)
AND method <> 'admin_verified';

-- 43 families / 1,037 SKUs were previously shown as "لاستیکی فابریک" in the database
-- reference, but the authoritative workbook does not confirm rubber material for them.
DELETE FROM public.catalog_family_menu_assignments
WHERE category_slug='excel-v2-1-1'
  AND submenu_name='لاستیکی فابریک'
  AND method <> 'admin_verified';

-- The database reference had 7 stainless families / 109 SKUs.
-- The workbook explicitly confirms only 3 families / 9 SKUs.
DELETE FROM public.catalog_family_menu_assignments
WHERE category_slug='excel-v2-6-2'
  AND submenu_name='نرده استیل'
  AND family_code NOT IN ('FAM-35826','FAM-10105','FAM-52948')
  AND method <> 'admin_verified';

-- The workbook identifies these 3 families as stainless guides (9 SKUs total).
-- FAM-52858 is a mixed-material 165-SKU conveyor family; keep it at the parent submenu.
INSERT INTO public.catalog_family_menu_assignments
  (family_code,category_slug,submenu_name,leaf_name,method)
VALUES
  ('FAM-35826','excel-v2-6-2','نرده استیل','نرده استیل و متعلقات','excel_source_verified'),
  ('FAM-10105','excel-v2-6-2','نرده استیل','نرده استیل و متعلقات','excel_source_verified'),
  ('FAM-52948','excel-v2-6-2','نرده استیل','نرده استیل و متعلقات','excel_source_verified'),
  ('FAM-52858','excel-v2-2-1','بر اساس جنس',NULL,'excel_source_verified')
ON CONFLICT(family_code) DO UPDATE SET
  category_slug=EXCLUDED.category_slug,
  submenu_name=EXCLUDED.submenu_name,
  leaf_name=EXCLUDED.leaf_name,
  method='excel_source_verified',
  updated_at=now()
WHERE public.catalog_family_menu_assignments.method <> 'admin_verified';

DO $audit$
DECLARE
  verified_count integer;
BEGIN
  SELECT count(*) INTO verified_count
  FROM public.catalog_family_menu_assignments
  WHERE (
    family_code IN ('FAM-35826','FAM-10105','FAM-52948')
    AND (
      method='admin_verified'
      OR (
        category_slug='excel-v2-6-2'
        AND submenu_name='نرده استیل'
        AND leaf_name='نرده استیل و متعلقات'
      )
    )
  ) OR (
    family_code='FAM-52858'
    AND (
      method='admin_verified'
      OR (
        category_slug='excel-v2-2-1'
        AND submenu_name='بر اساس جنس'
        AND leaf_name IS NULL
      )
    )
  );

  IF verified_count <> 4 THEN
    RAISE EXCEPTION 'Expected 4 source-verified or admin-locked family assignments, found %', verified_count;
  END IF;
END $audit$;

COMMIT;
