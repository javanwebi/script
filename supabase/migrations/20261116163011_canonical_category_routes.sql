-- Canonical, category-specific routes for the approved 34-category catalogue.
-- Retire only legacy parent rows that have no active family, direct SKU or menu assignment.
DO $$
BEGIN
  IF EXISTS (
    WITH legacy AS (
      SELECT DISTINCT metadata->>'routeSlug' AS slug
      FROM public.catalog_categories
      WHERE slug LIKE 'excel-v2-%' AND metadata->>'routeSlug' IS NOT NULL
    )
    SELECT 1 FROM legacy l
    JOIN public.catalog_families f ON f.category_slug = l.slug
    WHERE f.is_active = true AND coalesce(f.is_deleted, false) = false
  ) THEN
    RAISE EXCEPTION 'Cannot retire legacy category route while active families remain assigned';
  END IF;

  IF EXISTS (
    WITH legacy AS (
      SELECT DISTINCT metadata->>'routeSlug' AS slug
      FROM public.catalog_categories
      WHERE slug LIKE 'excel-v2-%' AND metadata->>'routeSlug' IS NOT NULL
    )
    SELECT 1 FROM legacy l
    JOIN public.catalog_direct_skus d ON d.category_slug = l.slug
    WHERE d.is_active = true
  ) THEN
    RAISE EXCEPTION 'Cannot retire legacy category route while active direct SKUs remain assigned';
  END IF;

  IF EXISTS (
    WITH legacy AS (
      SELECT DISTINCT metadata->>'routeSlug' AS slug
      FROM public.catalog_categories
      WHERE slug LIKE 'excel-v2-%' AND metadata->>'routeSlug' IS NOT NULL
    )
    SELECT 1 FROM legacy l
    JOIN public.catalog_family_menu_assignments a ON a.category_slug = l.slug
  ) THEN
    RAISE EXCEPTION 'Cannot retire legacy category route while family menu assignments remain';
  END IF;
END $$;

WITH legacy AS (
  SELECT DISTINCT metadata->>'routeSlug' AS slug
  FROM public.catalog_categories
  WHERE slug LIKE 'excel-v2-%' AND metadata->>'routeSlug' IS NOT NULL
)
UPDATE public.catalog_categories c
SET is_active = false
FROM legacy l
WHERE c.slug = l.slug
  AND c.slug NOT LIKE 'excel-v2-%'
  AND c.is_active = true;

UPDATE public.catalog_categories c
SET metadata = jsonb_set(coalesce(c.metadata, '{}'::jsonb), '{routeSlug}', to_jsonb(c.slug), true)
WHERE c.slug LIKE 'excel-v2-%'
  AND c.metadata->>'routeSlug' IS DISTINCT FROM c.slug;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.catalog_categories
    WHERE slug LIKE 'excel-v2-%'
      AND metadata->>'routeSlug' IS DISTINCT FROM slug
  ) THEN
    RAISE EXCEPTION 'Canonical category route verification failed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.catalog_categories
    WHERE slug IN (
      'آب-بندی-و-قطعات-لاستیکی', 'برس-و-ابزار-پرداخت', 'بلبرینگ-و-یاتاقان',
      'پولی-و-انتقال-نیرو', 'تجهیزات-خطوط-کاشی-و-سرامیک', 'تسمه-و-انتقال-نیرو',
      'چرخ-و-رولر', 'ریل-و-تجهیزات-هدایت', 'زنجیر-و-چرخ-زنجیر', 'فیلتراسیون-و-توری',
      'قطعات-پمپ-و-سیالات', 'قطعات-تولید-و-قالب', 'قطعات-مکانیکی',
      'مواد-و-ملزومات-صنعتی', 'نوار-و-تسمه-نقاله'
    ) AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Legacy parent category remains active after route migration';
  END IF;
END $$;
