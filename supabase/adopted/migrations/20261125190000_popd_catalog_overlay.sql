BEGIN;

CREATE SCHEMA IF NOT EXISTS app_private;

CREATE TABLE IF NOT EXISTS app_private.catalog_popd_families (
  source_family_code text PRIMARY KEY,
  source_kind text NOT NULL CHECK (source_kind IN ('belt', 'non_belt')),
  category_slug text NOT NULL REFERENCES public.catalog_categories(slug) ON UPDATE CASCADE ON DELETE RESTRICT,
  family_name text NOT NULL,
  brand text NOT NULL DEFAULT '',
  submenu text NOT NULL DEFAULT '',
  leaf text NOT NULL DEFAULT '',
  declared_variant_count integer NOT NULL DEFAULT 0 CHECK (declared_variant_count >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_sha256 text NOT NULL,
  resolved_db_family_code text,
  resolution_status text NOT NULL DEFAULT 'UNRESOLVED'
    CHECK (resolution_status IN ('ONE_TO_ONE', 'SPLIT', 'COLLISION', 'UNRESOLVED')),
  family_image_urls text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_active boolean NOT NULL DEFAULT true,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_private.catalog_popd_family_variants (
  source_family_code text NOT NULL
    REFERENCES app_private.catalog_popd_families(source_family_code) ON DELETE CASCADE,
  variant_code text NOT NULL
    REFERENCES public.catalog_variants(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (source_family_code, variant_code),
  UNIQUE (variant_code)
);

CREATE TABLE IF NOT EXISTS app_private.catalog_popd_direct_skus (
  sku_code text PRIMARY KEY
    REFERENCES public.catalog_variants(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  category_slug text NOT NULL
    REFERENCES public.catalog_categories(slug) ON UPDATE CASCADE ON DELETE RESTRICT,
  source_kind text NOT NULL CHECK (source_kind IN ('belt', 'non_belt')),
  name text NOT NULL,
  brand text NOT NULL DEFAULT '',
  submenu text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_sha256 text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_popd_families_category_idx
  ON app_private.catalog_popd_families(category_slug, is_active, submenu, family_name);

CREATE INDEX IF NOT EXISTS catalog_popd_family_variants_family_idx
  ON app_private.catalog_popd_family_variants(source_family_code, sort_order);

CREATE INDEX IF NOT EXISTS catalog_popd_direct_skus_category_idx
  ON app_private.catalog_popd_direct_skus(category_slug, is_active, submenu, sku_code);

ALTER TABLE app_private.catalog_popd_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.catalog_popd_family_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.catalog_popd_direct_skus ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  app_private.catalog_popd_families,
  app_private.catalog_popd_family_variants,
  app_private.catalog_popd_direct_skus
FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE app_private.catalog_popd_families IS
  'Non-destructive POPD source-family overlay for the public catalog. Does not rewrite catalog_families.';
COMMENT ON TABLE app_private.catalog_popd_family_variants IS
  'Exact POPD source family to SKU membership. A SKU can belong to only one POPD source family.';
COMMENT ON TABLE app_private.catalog_popd_direct_skus IS
  'POPD direct-SKU category assignments, kept separate from family membership and existing commercial rows.';

COMMIT;
