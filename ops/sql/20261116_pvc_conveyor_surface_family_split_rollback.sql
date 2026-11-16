-- Rollback for ops/sql/20261116_pvc_conveyor_surface_family_split.sql.
-- Requires the private snapshots created by that migration. Does not delete backups.

DO $$
BEGIN
  IF to_regclass('internal.catalog_pvc_surface_variants_backup_20261116') IS NULL
     OR to_regclass('internal.catalog_pvc_surface_commercial_backup_20261116') IS NULL
     OR to_regclass('internal.catalog_pvc_surface_family_backup_20261116') IS NULL
     OR to_regclass('internal.catalog_pvc_surface_assignment_backup_20261116') IS NULL
     OR to_regclass('internal.catalog_pvc_surface_alias_backup_20261116') IS NULL THEN
    RAISE EXCEPTION 'PVC rollback snapshots are incomplete; refusing rollback';
  END IF;

  IF (SELECT count(*) FROM internal.catalog_pvc_surface_variants_backup_20261116) <> 146 THEN
    RAISE EXCEPTION 'PVC variant rollback snapshot does not contain 146 rows';
  END IF;
END $$;

DELETE FROM public.catalog_family_menu_assignments
WHERE family_code IN (
  'PFAM-CONVEYOR-PVC-STONE-SURFACE-20261116',
  'PFAM-CONVEYOR-PVC-PAMARGHI-PATTERN-20261116',
  'PFAM-CONVEYOR-PVC-KALEGHANDI-CLEAT-20261116'
);

UPDATE public.catalog_variants v
SET
  family_code=b.family_code,
  reconstructed_family_code=b.reconstructed_family_code,
  confidence_score=b.confidence_score,
  technical_specs=b.technical_specs,
  identity_specs=b.identity_specs,
  variable_specs=b.variable_specs,
  technical_review=b.technical_review,
  updated_at=b.updated_at
FROM internal.catalog_pvc_surface_variants_backup_20261116 b
WHERE v.code=b.code;

UPDATE public.variant_commercial_specs s
SET family_code=b.family_code,
    updated_at=b.updated_at
FROM internal.catalog_pvc_surface_commercial_backup_20261116 b
WHERE s.variant_code=b.variant_code;

UPDATE public.catalog_families f
SET
  name=b.name,
  profiles=b.profiles,
  sizes_summary=b.sizes_summary,
  unit=b.unit,
  item_count=b.item_count,
  source_status=b.source_status,
  description=b.description,
  technical_specs=b.technical_specs,
  tags=b.tags,
  override_version=b.override_version,
  updated_at=b.updated_at
FROM internal.catalog_pvc_surface_family_backup_20261116 b
WHERE f.code=b.code;

UPDATE public.catalog_family_aliases a
SET all_new_family_codes=b.all_new_family_codes,
    updated_at=b.updated_at
FROM internal.catalog_pvc_surface_alias_backup_20261116 b
WHERE a.old_family_code=b.old_family_code
  AND a.new_family_code=b.new_family_code;

DELETE FROM public.catalog_families
WHERE code IN (
  'PFAM-CONVEYOR-PVC-STONE-SURFACE-20261116',
  'PFAM-CONVEYOR-PVC-PAMARGHI-PATTERN-20261116',
  'PFAM-CONVEYOR-PVC-KALEGHANDI-CLEAT-20261116'
);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.catalog_variants
      WHERE family_code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008' AND active=true) <> 146 THEN
    RAISE EXCEPTION 'PVC rollback did not restore all 146 variants to the original family';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.catalog_variants v
    JOIN public.variant_commercial_specs s ON s.variant_code=v.code
    WHERE v.family_code='PFAM-نوار-نقاله-PVC-GENERIC--CONVEYOR-PVC-008'
      AND s.family_code IS DISTINCT FROM v.family_code
  ) THEN
    RAISE EXCEPTION 'PVC rollback left commercial specs attached to a different family';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.catalog_families
    WHERE code IN (
      'PFAM-CONVEYOR-PVC-STONE-SURFACE-20261116',
      'PFAM-CONVEYOR-PVC-PAMARGHI-PATTERN-20261116',
      'PFAM-CONVEYOR-PVC-KALEGHANDI-CLEAT-20261116'
    )
  ) THEN
    RAISE EXCEPTION 'PVC rollback left one or more split families active in the catalogue';
  END IF;
END $$;
