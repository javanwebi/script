-- Exact rollback for ops/sql/20261117_belt_family_engineering_corrections.sql.
-- Restores only the columns changed by the forward migration from its private snapshot.
BEGIN;

DO $$
BEGIN
  IF to_regclass('internal.catalog_belt_family_engineering_backup_20261117') IS NULL THEN
    RAISE EXCEPTION 'Required belt engineering backup is missing; rollback cannot proceed safely';
  END IF;
  IF (SELECT count(*) FROM internal.catalog_belt_family_engineering_backup_20261117 WHERE table_name='catalog_variants') <> 292
     OR (SELECT count(*) FROM internal.catalog_belt_family_engineering_backup_20261117 WHERE table_name='catalog_families') <> 19
     OR (SELECT count(*) FROM internal.catalog_belt_family_engineering_backup_20261117 WHERE table_name='catalog_family_menu_assignments') <> 8
     OR (SELECT count(*) FROM internal.catalog_belt_family_engineering_backup_20261117 WHERE table_name='catalog_direct_skus') <> 14
     OR (SELECT count(*) FROM internal.catalog_belt_family_engineering_backup_20261117 WHERE table_name='catalog_categories') <> 5 THEN
    RAISE EXCEPTION 'Backup row counts do not match the expected engineering correction snapshot';
  END IF;
END $$;

UPDATE public.catalog_variants v
SET family_type_id=b.row_data->>'family_type_id',
    identity_specs=b.row_data->'identity_specs',
    variable_specs=b.row_data->'variable_specs',
    technical_specs=b.row_data->'technical_specs',
    technical_review=b.row_data->'technical_review',
    research_evidence=b.row_data->>'research_evidence',
    proposed_category_slug=b.row_data->>'proposed_category_slug',
    proposed_submenu=b.row_data->>'proposed_submenu',
    proposed_leaf=b.row_data->>'proposed_leaf',
    updated_at=(b.row_data->>'updated_at')::timestamptz
FROM internal.catalog_belt_family_engineering_backup_20261117 b
WHERE b.table_name='catalog_variants' AND b.row_key=v.code;

UPDATE public.catalog_families f
SET name=b.row_data->>'name',
    description=b.row_data->>'description',
    materials=b.row_data->>'materials',
    technical_specs=b.row_data->'technical_specs',
    submenu=b.row_data->>'submenu',
    subcategory=b.row_data->>'subcategory',
    updated_at=(b.row_data->>'updated_at')::timestamptz
FROM internal.catalog_belt_family_engineering_backup_20261117 b
WHERE b.table_name='catalog_families' AND b.row_key=f.code;

UPDATE public.catalog_family_menu_assignments a
SET submenu_name=b.row_data->>'submenu_name',
    leaf_name=b.row_data->>'leaf_name',
    method=b.row_data->>'method',
    updated_at=(b.row_data->>'updated_at')::timestamptz
FROM internal.catalog_belt_family_engineering_backup_20261117 b
WHERE b.table_name='catalog_family_menu_assignments' AND b.row_key=a.family_code;

UPDATE public.catalog_direct_skus d
SET submenu=b.row_data->>'submenu',
    subcategory=b.row_data->>'subcategory',
    technical_specs=b.row_data->'technical_specs',
    updated_at=(b.row_data->>'updated_at')::timestamptz
FROM internal.catalog_belt_family_engineering_backup_20261117 b
WHERE b.table_name='catalog_direct_skus' AND b.row_key=d.sku_code;

UPDATE public.catalog_categories c
SET metadata=b.row_data->'metadata',
    is_active=(b.row_data->>'is_active')::boolean,
    updated_at=(b.row_data->>'updated_at')::timestamptz
FROM internal.catalog_belt_family_engineering_backup_20261117 b
WHERE b.table_name='catalog_categories' AND b.row_key=c.slug;

DO $
BEGIN
  IF (SELECT count(*) FROM internal.catalog_belt_family_engineering_backup_20261117 WHERE table_name='catalog_variants') <> 290
     OR (SELECT count(*) FROM internal.catalog_belt_family_engineering_backup_20261117 WHERE table_name='catalog_families') <> 18
     OR (SELECT count(*) FROM internal.catalog_belt_family_engineering_backup_20261117 WHERE table_name='catalog_family_menu_assignments') <> 7
     OR (SELECT count(*) FROM internal.catalog_belt_family_engineering_backup_20261117 WHERE table_name='catalog_direct_skus') <> 14
     OR (SELECT count(*) FROM internal.catalog_belt_family_engineering_backup_20261117 WHERE table_name='catalog_categories') <> 5 THEN
    RAISE EXCEPTION 'Rollback verification failed: snapshot rows were not preserved';
  END IF;
END $$;

COMMIT;
