-- Rollback for ops/sql/20261116_belt_family_menu_corrections.sql.
-- Run only if the matching internal backup tables exist and the forward migration was applied.
BEGIN;
DO $$
BEGIN
  IF to_regclass('internal.catalog_family_menu_assignments_belt_backup_20261116') IS NULL
     OR to_regclass('internal.catalog_direct_skus_belt_backup_20261116') IS NULL THEN
    RAISE EXCEPTION 'Belt taxonomy rollback backup tables are missing; refusing rollback';
  END IF;
  IF (SELECT count(*) FROM internal.catalog_family_menu_assignments_belt_backup_20261116) < 18
     OR (SELECT count(*) FROM internal.catalog_direct_skus_belt_backup_20261116) < 34 THEN
    RAISE EXCEPTION 'Belt taxonomy rollback backup is incomplete; refusing rollback';
  END IF;
END $$;

-- Remove only the equipment assignment inserted by the forward migration.
DELETE FROM public.catalog_family_menu_assignments
WHERE family_code='PFAM-دستگاه-صنعتی-GENERIC--دستگاه-صنعتی-576'
  AND category_slug='excel-v2-1-4'
  AND submenu_name='دستگاه‌های تسمه جوشی'
  AND leaf_name IS NULL
  AND method='taxonomy_gap';

INSERT INTO public.catalog_family_menu_assignments
  (family_code,category_slug,submenu_name,leaf_name,method,created_at,updated_at)
SELECT family_code,category_slug,submenu_name,leaf_name,method,created_at,updated_at
FROM internal.catalog_family_menu_assignments_belt_backup_20261116
ON CONFLICT (family_code) DO UPDATE SET
  category_slug=EXCLUDED.category_slug,
  submenu_name=EXCLUDED.submenu_name,
  leaf_name=EXCLUDED.leaf_name,
  method=EXCLUDED.method,
  updated_at=EXCLUDED.updated_at;

UPDATE public.catalog_direct_skus d
SET category_slug=b.category_slug,
    category_name=b.category_name,
    submenu=b.submenu,
    subcategory=b.subcategory,
    technical_specs=b.technical_specs,
    updated_at=b.updated_at
FROM internal.catalog_direct_skus_belt_backup_20261116 b
WHERE d.sku_code=b.sku_code;

COMMIT;
