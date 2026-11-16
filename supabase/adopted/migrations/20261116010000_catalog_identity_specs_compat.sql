-- Additive compatibility migration for the adopted production catalogue.
-- The navigation API and the reviewed PVC surface migration read these JSONB
-- identity/variable fields. Older adopted baselines did not include them.
-- Existing SKU, family, image, technical and commercial records are preserved.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.catalog_variants') IS NULL THEN
    RAISE EXCEPTION 'catalog_variants is missing; refusing identity schema repair';
  END IF;
END
$$;

ALTER TABLE public.catalog_variants
  ADD COLUMN IF NOT EXISTS identity_specs JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS variable_specs JSONB DEFAULT '{}'::jsonb;

DO $$
DECLARE
  identity_type TEXT;
  variable_type TEXT;
BEGIN
  SELECT data_type INTO identity_type
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='catalog_variants'
    AND column_name='identity_specs';

  SELECT data_type INTO variable_type
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='catalog_variants'
    AND column_name='variable_specs';

  IF identity_type IS DISTINCT FROM 'jsonb' THEN
    RAISE EXCEPTION 'catalog_variants.identity_specs must be JSONB; found %', identity_type;
  END IF;

  IF variable_type IS DISTINCT FROM 'jsonb' THEN
    RAISE EXCEPTION 'catalog_variants.variable_specs must be JSONB; found %', variable_type;
  END IF;
END
$$;

ALTER TABLE public.catalog_variants
  ALTER COLUMN identity_specs SET DEFAULT '{}'::jsonb,
  ALTER COLUMN variable_specs SET DEFAULT '{}'::jsonb;

COMMIT;
