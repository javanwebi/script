-- Canonical, category-specific routes for the approved 34-category catalogue.
-- Retire legacy categories only when no active families, direct SKUs or menu assignments remain.
-- Some isolated PGlite tests intentionally omit the production catalogue tables; safely skip there.
DO $$
BEGIN
  IF to_regclass('public.catalog_categories') IS NULL THEN
    RAISE NOTICE 'Skipping canonical category routes: public.catalog_categories is not installed in this database';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.catalog_categories c
    JOIN public.catalog_families f ON f.category_slug = c.slug
    WHERE c.is_active = true AND c.slug NOT LIKE 'excel-v2-%'
      AND f.is_active = true AND coalesce(f.is_deleted, false) = false
  ) THEN
    RAISE EXCEPTION 'Cannot retire legacy categories while active families remain assigned';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.catalog_categories c
    JOIN public.catalog_direct_skus d ON d.category_slug = c.slug
    WHERE c.is_active = true AND c.slug NOT LIKE 'excel-v2-%' AND d.is_active = true
  ) THEN
    RAISE EXCEPTION 'Cannot retire legacy categories while active direct SKUs remain assigned';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.catalog_categories c
    JOIN public.catalog_family_menu_assignments a ON a.category_slug = c.slug
    WHERE c.is_active = true AND c.slug NOT LIKE 'excel-v2-%'
  ) THEN
    RAISE EXCEPTION 'Cannot retire legacy categories while menu assignments remain';
  END IF;

  UPDATE public.catalog_categories c
  SET is_active = false
  WHERE c.is_active = true AND c.slug NOT LIKE 'excel-v2-%';

  UPDATE public.catalog_categories c
  SET metadata = jsonb_set(coalesce(c.metadata, '{}'::jsonb), '{routeSlug}', to_jsonb(c.slug), true)
  WHERE c.slug LIKE 'excel-v2-%'
    AND c.metadata->>'routeSlug' IS DISTINCT FROM c.slug;

  IF EXISTS (
    SELECT 1 FROM public.catalog_categories
    WHERE slug LIKE 'excel-v2-%' AND metadata->>'routeSlug' IS DISTINCT FROM slug
  ) THEN
    RAISE EXCEPTION 'Canonical category route verification failed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.catalog_categories
    WHERE slug NOT LIKE 'excel-v2-%' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Legacy category remains active after route migration';
  END IF;

  IF (SELECT count(*) FROM public.catalog_categories WHERE slug LIKE 'excel-v2-%' AND is_active = true) <> 34 THEN
    RAISE EXCEPTION 'Expected exactly 34 active approved categories';
  END IF;
END $$;
