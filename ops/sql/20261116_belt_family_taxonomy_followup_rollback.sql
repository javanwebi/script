-- Exact rollback for ops/sql/20261116_belt_family_taxonomy_followup.sql.
-- Restores only the family/menu/direct-SKU fields changed by that migration.
-- The private backup is intentionally retained after rollback for audit.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('internal.catalog_belt_taxonomy_followup_backup_20261116') IS NULL THEN
    RAISE EXCEPTION 'Belt follow-up rollback refused: required private backup is missing';
  END IF;
  IF (SELECT count(*) FROM internal.catalog_belt_taxonomy_followup_backup_20261116 WHERE table_name='catalog_families') <> 71
     OR (SELECT count(*) FROM internal.catalog_belt_taxonomy_followup_backup_20261116 WHERE table_name='catalog_family_menu_assignments') <> 32
     OR (SELECT count(*) FROM internal.catalog_belt_taxonomy_followup_backup_20261116 WHERE table_name='catalog_direct_skus') <> 35 THEN
    RAISE EXCEPTION 'Belt follow-up rollback refused: backup row counts do not match the reviewed snapshot';
  END IF;
END $$;

UPDATE public.catalog_families f
SET category_slug=b.row_data->>'category_slug',
    category_name=b.row_data->>'category_name',
    submenu=b.row_data->>'submenu',
    subcategory=b.row_data->>'subcategory',
    updated_at=(b.row_data->>'updated_at')::timestamptz
FROM internal.catalog_belt_taxonomy_followup_backup_20261116 b
WHERE b.table_name='catalog_families'
  AND b.row_key=f.code;

INSERT INTO public.catalog_family_menu_assignments
  (family_code,category_slug,submenu_name,leaf_name,method,created_at,updated_at)
SELECT
  b.row_key,
  b.row_data->>'category_slug',
  b.row_data->>'submenu_name',
  b.row_data->>'leaf_name',
  b.row_data->>'method',
  (b.row_data->>'created_at')::timestamptz,
  (b.row_data->>'updated_at')::timestamptz
FROM internal.catalog_belt_taxonomy_followup_backup_20261116 b
WHERE b.table_name='catalog_family_menu_assignments'
ON CONFLICT (family_code) DO UPDATE
SET category_slug=EXCLUDED.category_slug,
    submenu_name=EXCLUDED.submenu_name,
    leaf_name=EXCLUDED.leaf_name,
    method=EXCLUDED.method,
    created_at=EXCLUDED.created_at,
    updated_at=EXCLUDED.updated_at;

UPDATE public.catalog_direct_skus s
SET category_slug=b.row_data->>'category_slug',
    category_name=b.row_data->>'category_name',
    submenu=b.row_data->>'submenu',
    subcategory=b.row_data->>'subcategory',
    updated_at=(b.row_data->>'updated_at')::timestamptz
FROM internal.catalog_belt_taxonomy_followup_backup_20261116 b
WHERE b.table_name='catalog_direct_skus'
  AND b.row_key=s.sku_code;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM internal.catalog_belt_taxonomy_followup_backup_20261116 b
    JOIN public.catalog_families f ON f.code=b.row_key
    WHERE b.table_name='catalog_families'
      AND (
        f.category_slug IS DISTINCT FROM b.row_data->>'category_slug'
        OR f.category_name IS DISTINCT FROM b.row_data->>'category_name'
        OR f.submenu IS DISTINCT FROM b.row_data->>'submenu'
        OR f.subcategory IS DISTINCT FROM b.row_data->>'subcategory'
        OR f.updated_at IS DISTINCT FROM (b.row_data->>'updated_at')::timestamptz
      )
  ) THEN
    RAISE EXCEPTION 'Belt follow-up rollback failed: family metadata mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM internal.catalog_belt_taxonomy_followup_backup_20261116 b
    LEFT JOIN public.catalog_family_menu_assignments a ON a.family_code=b.row_key
    WHERE b.table_name='catalog_family_menu_assignments'
      AND (
        a.family_code IS NULL
        OR a.category_slug IS DISTINCT FROM b.row_data->>'category_slug'
        OR a.submenu_name IS DISTINCT FROM b.row_data->>'submenu_name'
        OR a.leaf_name IS DISTINCT FROM b.row_data->>'leaf_name'
        OR a.method IS DISTINCT FROM b.row_data->>'method'
        OR a.created_at IS DISTINCT FROM (b.row_data->>'created_at')::timestamptz
        OR a.updated_at IS DISTINCT FROM (b.row_data->>'updated_at')::timestamptz
      )
  ) THEN
    RAISE EXCEPTION 'Belt follow-up rollback failed: family menu assignment mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM internal.catalog_belt_taxonomy_followup_backup_20261116 b
    JOIN public.catalog_direct_skus s ON s.sku_code=b.row_key
    WHERE b.table_name='catalog_direct_skus'
      AND (
        s.category_slug IS DISTINCT FROM b.row_data->>'category_slug'
        OR s.category_name IS DISTINCT FROM b.row_data->>'category_name'
        OR s.submenu IS DISTINCT FROM b.row_data->>'submenu'
        OR s.subcategory IS DISTINCT FROM b.row_data->>'subcategory'
        OR s.updated_at IS DISTINCT FROM (b.row_data->>'updated_at')::timestamptz
      )
  ) THEN
    RAISE EXCEPTION 'Belt follow-up rollback failed: direct SKU menu metadata mismatch';
  END IF;
END $$;

COMMIT;
