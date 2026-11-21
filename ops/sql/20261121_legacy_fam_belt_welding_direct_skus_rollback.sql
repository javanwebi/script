-- Revert only the direct-SKU projection created by
-- 20261121_legacy_fam_belt_welding_direct_skus.sql.
-- Family rows, variant rows, images and commercial records are never modified.

BEGIN;

DO $rollback$
DECLARE
  backup_count integer;
  applied_count integer;
  rolled_back_count integer;
  target_count integer;
  restored_count integer;
BEGIN
  IF to_regclass('internal.catalog_legacy_fam_belt_welding_direct_backup_20261121') IS NULL THEN
    RAISE EXCEPTION 'LEGACY_FAM_WELDING_ROLLBACK_BACKUP_MISSING';
  END IF;

  SELECT count(*)::integer,
         count(*) FILTER (WHERE migration_state='applied')::integer,
         count(*) FILTER (WHERE migration_state='rolled_back')::integer
  INTO backup_count, applied_count, rolled_back_count
  FROM internal.catalog_legacy_fam_belt_welding_direct_backup_20261121;

  IF backup_count <> 3 THEN
    RAISE EXCEPTION
      'LEGACY_FAM_WELDING_ROLLBACK_BACKUP_INCOMPLETE rows=%',
      backup_count;
  END IF;

  IF rolled_back_count=3 THEN
    SELECT count(*)::integer
    INTO restored_count
    FROM internal.catalog_legacy_fam_belt_welding_direct_backup_20261121 b
    LEFT JOIN public.catalog_direct_skus d ON d.sku_code=b.sku_code
    WHERE (b.previous_row IS NULL AND d.sku_code IS NULL)
       OR (b.previous_row IS NOT NULL AND to_jsonb(d)=b.previous_row);

    IF restored_count <> 3 THEN
      RAISE EXCEPTION
        'LEGACY_FAM_WELDING_ROLLBACK_ALREADY_MARKED_BUT_SOURCE_DRIFTED found=%',
        restored_count;
    END IF;

    RAISE NOTICE 'LEGACY_FAM_WELDING_DIRECT_SKUS_ALREADY_ROLLED_BACK';
    RETURN;
  END IF;

  IF applied_count <> 3 THEN
    RAISE EXCEPTION
      'LEGACY_FAM_WELDING_ROLLBACK_STATE_INVALID applied=% rolled_back=%',
      applied_count, rolled_back_count;
  END IF;

  SELECT count(*)::integer
  INTO target_count
  FROM internal.catalog_legacy_fam_belt_welding_direct_backup_20261121 b
  JOIN public.catalog_direct_skus d ON d.sku_code=b.sku_code
  WHERE d.category_slug='excel-v2-1-4'
    AND d.submenu='دستگاه‌های تسمه جوشی'
    AND d.subcategory='دستگاه جوش تسمه صنعتی'
    AND d.source_family_code IN ('FAM-41497','FAM-35852','FAM-90062')
    AND d.is_active=true;

  IF target_count <> 3 THEN
    RAISE EXCEPTION
      'LEGACY_FAM_WELDING_ROLLBACK_TARGET_DRIFT expected=3 found=%; refusing to overwrite later edits',
      target_count;
  END IF;

  DELETE FROM public.catalog_direct_skus d
  USING internal.catalog_legacy_fam_belt_welding_direct_backup_20261121 b
  WHERE d.sku_code=b.sku_code;

  INSERT INTO public.catalog_direct_skus
  SELECT (jsonb_populate_record(NULL::public.catalog_direct_skus,b.previous_row)).*
  FROM internal.catalog_legacy_fam_belt_welding_direct_backup_20261121 b
  WHERE b.previous_row IS NOT NULL
  ON CONFLICT (sku_code) DO UPDATE SET
    name=excluded.name,
    category_slug=excluded.category_slug,
    category_name=excluded.category_name,
    submenu=excluded.submenu,
    subcategory=excluded.subcategory,
    brand=excluded.brand,
    image_url=excluded.image_url,
    technical_specs=excluded.technical_specs,
    price_snapshot=excluded.price_snapshot,
    source_family_code=excluded.source_family_code,
    is_active=excluded.is_active,
    updated_at=excluded.updated_at;

  UPDATE internal.catalog_legacy_fam_belt_welding_direct_backup_20261121
  SET migration_state='rolled_back'
  WHERE sku_code IN ('41497','35852','110049');

  SELECT count(*)::integer
  INTO restored_count
  FROM internal.catalog_legacy_fam_belt_welding_direct_backup_20261121 b
  LEFT JOIN public.catalog_direct_skus d ON d.sku_code=b.sku_code
  WHERE (b.previous_row IS NULL AND d.sku_code IS NULL)
     OR (b.previous_row IS NOT NULL AND to_jsonb(d)=b.previous_row);

  IF restored_count <> 3 THEN
    RAISE EXCEPTION
      'LEGACY_FAM_WELDING_ROLLBACK_POSTCONDITION_FAILED expected=3 found=%',
      restored_count;
  END IF;
END
$rollback$;

COMMIT;
