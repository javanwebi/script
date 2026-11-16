-- Guarded rollback for 20261116150000_belt_orphan_direct_skus_and_restore_pvc_units.
-- Deletes only the ten direct rows inserted by that migration and restores only the 14
-- unit values changed by it. It never deletes or rewrites catalog variants/families.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('internal.catalog_variants_unit_restore_backup_20261116') IS NULL
     OR to_regclass('internal.catalog_orphan_belt_direct_backup_20261116') IS NULL THEN
    RAISE EXCEPTION 'Rollback snapshots are missing; refusing rollback';
  END IF;
  IF (SELECT count(*) FROM internal.catalog_variants_unit_restore_backup_20261116) <> 14 THEN
    RAISE EXCEPTION 'Unit rollback snapshot incomplete; refusing rollback';
  END IF;
  IF (SELECT count(*) FROM internal.catalog_orphan_belt_direct_backup_20261116) <> 10 THEN
    RAISE EXCEPTION 'Standalone SKU rollback snapshot incomplete; refusing rollback';
  END IF;
END $$;

DELETE FROM public.catalog_direct_skus d
USING internal.catalog_orphan_belt_direct_backup_20261116 b
WHERE d.sku_code=b.sku_code
  AND d.updated_at=b.updated_at
  AND d.source_family_code IS NULL;

UPDATE public.catalog_variants v
SET unit=b.previous_unit,
    updated_at=b.previous_updated_at
FROM internal.catalog_variants_unit_restore_backup_20261116 b
WHERE v.code=b.code
  AND v.unit IS NOT DISTINCT FROM b.source_unit;

COMMIT;
