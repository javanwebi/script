-- Standalone placement for the ten active belt SKUs with no active family.
-- Restore the 14 source-of-truth PVC/legacy units that were overwritten during reconstruction.
-- No family is created, no variant family_code is rewritten, and no SKU/image/spec row is deleted.
-- The comprehensive belt pre-change snapshot is required before this migration.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE _belt_orphan_migration_context (
  apply_production_data boolean NOT NULL
) ON COMMIT DROP;

-- Empty PGlite/schema tests do not contain the production-only catalog backup/data.
-- Skip only when none of the ten audited source SKUs exist; partial production data still fails closed.
INSERT INTO _belt_orphan_migration_context(apply_production_data)
SELECT EXISTS (
  SELECT 1 FROM public.catalog_variants
  WHERE code IN ('10077','10265','10695','32929','34483','34854','38910','41630','58288','58304')
);

DO $$
DECLARE
  missing_skus integer;
  unit_mismatches integer;
BEGIN
  IF NOT (SELECT apply_production_data FROM _belt_orphan_migration_context) THEN
    RAISE NOTICE 'Skipping production-only belt seed migration in empty isolated schema fixture';
    RETURN;
  END IF;

  IF to_regclass('internal.catalog_belt_taxonomy_backup_20261116') IS NULL THEN
    RAISE EXCEPTION 'Required full belt taxonomy pre-change backup is missing; refusing migration';
  END IF;
  IF to_regclass('public.backup_20261116_catalog_variants') IS NULL THEN
    RAISE EXCEPTION 'Required original catalog variant backup is missing; refusing unit restoration';
  END IF;
  IF to_regclass('internal.catalog_variants_unit_restore_backup_20261116') IS NOT NULL
     OR to_regclass('internal.catalog_orphan_belt_direct_backup_20261116') IS NOT NULL THEN
    RAISE EXCEPTION 'Belt orphan/unit rollback snapshots already exist; inspect before retrying';
  END IF;

  SELECT count(*) INTO missing_skus
  FROM public.catalog_variants v
  WHERE v.code IN ('10077','10265','10695','32929','34483','34854','38910','41630','58288','58304')
    AND v.active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.catalog_direct_skus d
      WHERE d.sku_code = v.code AND d.is_active = true
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.catalog_families f
      WHERE f.code = v.family_code
        AND f.is_active = true
        AND coalesce(f.is_deleted,false) = false
    )
    AND (
      v.reconstructed_family_code IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.catalog_families rf
        WHERE rf.code = v.reconstructed_family_code
          AND rf.is_active = true
          AND coalesce(rf.is_deleted,false) = false
      )
    );
  IF missing_skus <> 10 THEN
    RAISE EXCEPTION 'Expected exactly 10 active familyless belt SKUs not yet in direct SKU table; found %', missing_skus;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.catalog_categories
    WHERE slug='excel-v2-1-1' AND is_active=true
  ) THEN
    RAISE EXCEPTION 'Approved timing-belt category is missing';
  END IF;

  SELECT count(*) INTO unit_mismatches
  FROM public.catalog_variants v
  JOIN public.backup_20261116_catalog_variants b ON b.code=v.code
  WHERE b.family_code='FAM-52858'
    AND v.code IN ('10256','10549','33439','38287','39365','39703','3970318','40036','41152','41248','41587','41715','64360','87965')
    AND v.unit IS DISTINCT FROM b.unit;
  IF unit_mismatches <> 14 THEN
    RAISE EXCEPTION 'Expected exactly 14 PVC/legacy unit mismatches from source backup; found %', unit_mismatches;
  END IF;
END $;

-- The real production backup must already exist (checked above). Empty isolated schema
-- fixtures may not carry that production snapshot; create an empty compatible placeholder.
CREATE TABLE IF NOT EXISTS public.backup_20261116_catalog_variants (
  code text PRIMARY KEY,
  family_code text,
  unit text
);

CREATE TABLE internal.catalog_variants_unit_restore_backup_20261116 (
  code text PRIMARY KEY,
  previous_unit text,
  source_unit text,
  previous_updated_at timestamptz,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE internal.catalog_orphan_belt_direct_backup_20261116 AS
SELECT d.*, now() AS backed_up_at
FROM public.catalog_direct_skus d
WHERE false;

REVOKE ALL ON TABLE internal.catalog_variants_unit_restore_backup_20261116,
                    internal.catalog_orphan_belt_direct_backup_20261116
FROM PUBLIC, anon, authenticated;

INSERT INTO internal.catalog_variants_unit_restore_backup_20261116
  (code,previous_unit,source_unit,previous_updated_at)
SELECT v.code,v.unit,b.unit,v.updated_at
FROM public.catalog_variants v
JOIN public.backup_20261116_catalog_variants b ON b.code=v.code
WHERE b.family_code='FAM-52858'
  AND v.code IN ('10256','10549','33439','38287','39365','39703','3970318','40036','41152','41248','41587','41715','64360','87965')
  AND v.unit IS DISTINCT FROM b.unit;

UPDATE public.catalog_variants v
SET unit=b.unit, updated_at=now()
FROM public.backup_20261116_catalog_variants b
WHERE b.code=v.code
  AND b.family_code='FAM-52858'
  AND v.code IN ('10256','10549','33439','38287','39365','39703','3970318','40036','41152','41248','41587','41715','64360','87965')
  AND v.unit IS DISTINCT FROM b.unit;

-- These six are unambiguously timing-belt products by source name, but lack enough
-- profile evidence for an exact leaf. Keep them as standalone direct SKUs at parent level.
WITH standalone(sku_code,category_slug,category_name,submenu,subcategory) AS (
  VALUES
    ('10077','excel-v2-1-1','تسمه تایمینگ','انواع گام و کدهای تایمینگ',''),
    ('10265','excel-v2-1-1','تسمه تایمینگ','انواع گام و کدهای تایمینگ',''),
    ('10695','excel-v2-1-1','تسمه تایمینگ','انواع گام و کدهای تایمینگ',''),
    ('32929','excel-v2-1-1','تسمه تایمینگ','انواع گام و کدهای تایمینگ',''),
    ('41630','excel-v2-1-1','تسمه تایمینگ','انواع گام و کدهای تایمینگ',''),
    ('58288','excel-v2-1-1','تسمه تایمینگ','','')
)
INSERT INTO public.catalog_direct_skus
  (sku_code,name,category_slug,category_name,submenu,subcategory,brand,image_url,technical_specs,price_snapshot,source_family_code,is_active,updated_at)
SELECT v.code,v.name,s.category_slug,s.category_name,s.submenu,s.subcategory,
       coalesce(v.brand,''),NULL,coalesce(v.technical_specs,'[]'::jsonb),'{}'::jsonb,
       NULL,true,now()
FROM standalone s
JOIN public.catalog_variants v ON v.code=s.sku_code AND v.active=true
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalog_direct_skus d WHERE d.sku_code=v.code
);

-- Four records are still technically ambiguous. They remain standalone/searchable,
-- but outside approved category paths until physical/product evidence is available.
WITH standalone(sku_code) AS (
  VALUES ('34483'),('34854'),('38910'),('58304')
)
INSERT INTO public.catalog_direct_skus
  (sku_code,name,category_slug,category_name,submenu,subcategory,brand,image_url,technical_specs,price_snapshot,source_family_code,is_active,updated_at)
SELECT v.code,v.name,'UNRESOLVED','نیازمند تعیین تکلیف','','',
       coalesce(v.brand,''),NULL,coalesce(v.technical_specs,'[]'::jsonb),'{}'::jsonb,
       NULL,true,now()
FROM standalone s
JOIN public.catalog_variants v ON v.code=s.sku_code AND v.active=true
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalog_direct_skus d WHERE d.sku_code=v.code
);

-- Save the exact inserted direct rows for a guarded rollback.
INSERT INTO internal.catalog_orphan_belt_direct_backup_20261116
SELECT d.*,now()
FROM public.catalog_direct_skus d
WHERE d.sku_code IN ('10077','10265','10695','32929','34483','34854','38910','41630','58288','58304')
  AND d.source_family_code IS NULL;

DO $$
BEGIN
  IF NOT (SELECT apply_production_data FROM _belt_orphan_migration_context) THEN
    RETURN;
  END IF;

  IF (SELECT count(*) FROM public.catalog_direct_skus
      WHERE sku_code IN ('10077','10265','10695','32929','34483','34854','38910','41630','58288','58304')
        AND is_active=true) <> 10 THEN
    RAISE EXCEPTION 'Postcondition failed: all ten standalone belt SKUs must be active direct products';
  END IF;

  IF (SELECT count(*) FROM public.catalog_direct_skus
      WHERE sku_code IN ('10077','10265','10695','32929','41630')
        AND category_slug='excel-v2-1-1'
        AND submenu='انواع گام و کدهای تایمینگ'
        AND subcategory='') <> 5 THEN
    RAISE EXCEPTION 'Postcondition failed: timing SKUs must be parent-only, without invented technical leaves';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.catalog_direct_skus
    WHERE sku_code='58288' AND category_slug='excel-v2-1-1'
      AND submenu='' AND subcategory=''
  ) THEN
    RAISE EXCEPTION 'Postcondition failed: automotive timing SKU must not be assigned to an unapproved industrial leaf';
  END IF;

  IF (SELECT count(*) FROM public.catalog_direct_skus
      WHERE sku_code IN ('34483','34854','38910','58304')
        AND category_slug='UNRESOLVED'
        AND submenu='' AND subcategory='') <> 4 THEN
    RAISE EXCEPTION 'Postcondition failed: four technically ambiguous SKUs must remain unassigned';
  END IF;

  IF (SELECT count(*) FROM public.catalog_variants v
      JOIN public.backup_20261116_catalog_variants b ON b.code=v.code
      WHERE b.family_code='FAM-52858'
        AND v.code IN ('10256','10549','33439','38287','39365','39703','3970318','40036','41152','41248','41587','41715','64360','87965')
        AND v.unit IS NOT DISTINCT FROM b.unit) <> 14 THEN
    RAISE EXCEPTION 'Postcondition failed: original units were not fully restored';
  END IF;
END $$;

COMMIT;
