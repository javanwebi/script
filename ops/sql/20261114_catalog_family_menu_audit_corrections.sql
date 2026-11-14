-- Targeted, source-verified menu corrections only.
-- No family or SKU rows are deleted. Only incorrect automatic menu assignments are removed.
-- admin_verified assignments are never overwritten or deleted.
BEGIN;

DO $$
DECLARE
  steel_family_count integer;
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

  IF NOT EXISTS (
    SELECT 1 FROM public.catalog_categories
    WHERE slug='excel-v2-6-2' AND is_active=true
      AND metadata->>'source'='industrial_megamenu_hierarchy_v2'
  ) THEN
    RAISE EXCEPTION 'Approved guide category excel-v2-6-2 is missing';
  END IF;
END $$;

-- These 53 families remain in catalog_families and catalog_variants.
-- 27 of them had been falsely assigned to the polyurethane leaf despite no explicit PU evidence in any SKU name or material field.
-- Their old automatic menu assignments are not supported by the authoritative source
-- or do not match the site's current submenu vocabulary, so they must be reviewed.
DELETE FROM public.catalog_family_menu_assignments
WHERE family_code IN (
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
  'FAM-35743',
  'FAM-33996',
  'FAM-32247',
  'FAM-32246',
  'FAM-80151',
  'FAM-31929',
  'FAM-33416',
  'FAM-33126',
  'FAM-321931',
  'FAM-30',
  'FAM-10111',
  'FAM-10410',
  'FAM-22751',
  'FAM-32711',
  'FAM-32735',
  'FAM-34854',
  'FAM-35525',
  'FAM-35624',
  'FAM-36750',
  'FAM-37769',
  'FAM-38283',
  'FAM-38285',
  'FAM-38697',
  'FAM-38786',
  'FAM-39005',
  'FAM-39130',
  'FAM-40417',
  'FAM-40462',
  'FAM-40604',
  'FAM-40609',
  'FAM-41253',
  'FAM-41326',
  'FAM-51279',
  'FAM-52319',
  'FAM-52735',
  'FAM-38906',
  'FAM-39114',
  'FAM-40601'
)
AND method <> 'admin_verified';


-- Earlier database-reference counts showed 43 families / 1,037 SKUs under
-- "لاستیکی فابریک", but the authoritative Excel has no explicit rubber material.
-- Remove only automatic assignments; preserve any admin_verified decision.
DELETE FROM public.catalog_family_menu_assignments
WHERE category_slug='excel-v2-1-1'
  AND submenu_name='لاستیکی فابریک'
  AND method <> 'admin_verified';

-- Earlier database-reference counts showed 7 steel families / 109 SKUs.
-- Excel confirms only the three explicit stainless families above (9 SKUs).
-- Keep those three for the verified upsert; send other automatic rows to review.
DELETE FROM public.catalog_family_menu_assignments
WHERE category_slug='excel-v2-6-2'
  AND submenu_name='نرده استیل'
  AND family_code NOT IN ('FAM-35826','FAM-10105','FAM-52948')
  AND method <> 'admin_verified';

-- The Excel explicitly identifies these three guide families as stainless steel:
-- FAM-35826 = 5 SKUs; FAM-10105 = 2 SKUs; FAM-52948 = 2 SKUs.
INSERT INTO public.catalog_family_menu_assignments
  (family_code,category_slug,submenu_name,leaf_name,method)
VALUES
  ('FAM-35826','excel-v2-6-2','نرده استیل','نرده استیل و متعلقات','excel_source_verified'),
  ('FAM-10105','excel-v2-6-2','نرده استیل','نرده استیل و متعلقات','excel_source_verified'),
  ('FAM-52948','excel-v2-6-2','نرده استیل','نرده استیل و متعلقات','excel_source_verified')
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
  WHERE family_code IN ('FAM-35826','FAM-10105','FAM-52948')
    AND (
      method='admin_verified'
      OR (
        category_slug='excel-v2-6-2'
        AND submenu_name='نرده استیل'
        AND leaf_name='نرده استیل و متعلقات'
      )
    );

  IF verified_count <> 3 THEN
    RAISE EXCEPTION 'Expected 3 source-verified or admin-locked stainless guide families, found %', verified_count;
  END IF;
END $audit$;

COMMIT;
