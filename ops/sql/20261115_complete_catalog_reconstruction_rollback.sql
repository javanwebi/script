-- ============================================================================
-- SANAT PISH — STAGE 10 STANDALONE ROLLBACK SCRIPT (REVERSIBLE RESTORE)
-- Generated At: 2026-11-15T23:02:00.667Z
-- Restores pre-migration state without deleting original catalog records.
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS public.catalog_similar_product_links;
DROP TABLE IF EXISTS public.catalog_reconstruction_family_map;

ALTER TABLE public.catalog_variants DROP COLUMN IF EXISTS reconstructed_family_code;
ALTER TABLE public.catalog_variants DROP COLUMN IF EXISTS display_status;
ALTER TABLE public.catalog_variants DROP COLUMN IF EXISTS main_group_id;
ALTER TABLE public.catalog_variants DROP COLUMN IF EXISTS family_type_id;
ALTER TABLE public.catalog_variants DROP COLUMN IF EXISTS proposed_category_slug;
ALTER TABLE public.catalog_variants DROP COLUMN IF EXISTS proposed_submenu;
ALTER TABLE public.catalog_variants DROP COLUMN IF EXISTS proposed_leaf;
ALTER TABLE public.catalog_variants DROP COLUMN IF EXISTS confidence_score;
ALTER TABLE public.catalog_variants DROP COLUMN IF EXISTS research_evidence;
ALTER TABLE public.catalog_variants DROP COLUMN IF EXISTS identity_specs;
ALTER TABLE public.catalog_variants DROP COLUMN IF EXISTS variable_specs;

COMMIT;
