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
  SET metadata = jsonb_set(coalesce(c.metadata, '{}'::jsonb), '{routeSlug}', to_jsonb(routes.route_slug), true)
  FROM (VALUES
      ('excel-v2-1-1', 'تسمه-تایمینگ-صنعتی'),
      ('excel-v2-1-2', 'تسمه-وی-بلت-صنعتی'),
      ('excel-v2-1-3', 'تسمه-جوشی-صنعتی'),
      ('excel-v2-1-4', 'تسمه-بارکش-صنعتی'),
      ('excel-v2-2-1', 'نوار-نقاله-صنعتی'),
      ('excel-v2-2-2', 'خدمات-نوار-نقاله'),
      ('excel-v2-3-1', 'روکش-رولر-و-غلتک-صنعتی'),
      ('excel-v2-3-2', 'قطعات-رولر-صنعتی'),
      ('excel-v2-3-3', 'متعلقات-نگهدارنده-رولر'),
      ('excel-v2-4-1', 'پولی-تایمینگ-صنعتی'),
      ('excel-v2-5-1', 'برس-سیمی-صنعتی'),
      ('excel-v2-5-2', 'برس-خشک-کن-صنعتی'),
      ('excel-v2-6-1', 'ریل-راهنمای-صنعتی'),
      ('excel-v2-6-2', 'گاید-راهنمای-صنعتی'),
      ('excel-v2-6-3', 'پروفیل-و-پایه-هدایت-صنعتی'),
      ('excel-v2-6-4', 'سنسور-و-نگهدارنده-صنعتی'),
      ('excel-v2-7-1', 'قطعات-لاستیکی-صنعتی'),
      ('excel-v2-7-2', 'اورینگ-و-آببند-صنعتی'),
      ('excel-v2-7-3', 'ضربه-گیر-و-مکنده-صنعتی'),
      ('excel-v2-8-1', 'نوار-برزنتی-نسوز-چند-لایه'),
      ('excel-v2-8-2', 'نخ-و-عایق-نسوز-صنعتی'),
      ('excel-v2-9-1', 'زنجیر-صنعتی'),
      ('excel-v2-9-2', 'قطعات-پمپ-صنعتی'),
      ('excel-v2-9-3', 'یراق-آلات-و-قطعات-مکانیکی'),
      ('excel-v2-9-4', 'چرخ-صنعتی'),
      ('excel-v2-10-1', 'قطعات-دستگاه-چاپ-صنعتی'),
      ('excel-v2-10-2', 'تجهیزات-روتاری-صنعتی'),
      ('excel-v2-11-1', 'توری-مش-صنعتی'),
      ('excel-v2-12-1', 'ساخت-قطعات-صنعتی-سفارشی'),
      ('excel-v2-13-1', 'بلبرینگ-صنعتی'),
      ('excel-v2-13-2', 'یاتاقان-و-متعلقات-صنعتی'),
      ('excel-v2-14-1', 'ابر-اسفنجی-صنعتی'),
      ('excel-v2-14-2', 'نوار-اسفنجی-صنعتی'),
      ('excel-v2-14-3', 'اسکاج-صنعتی')
  ) AS routes(category_slug, route_slug)
  WHERE c.slug = routes.category_slug
    AND c.is_active = true
    AND c.metadata->>'routeSlug' IS DISTINCT FROM routes.route_slug;

  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('excel-v2-1-1', 'تسمه-تایمینگ-صنعتی'),
      ('excel-v2-1-2', 'تسمه-وی-بلت-صنعتی'),
      ('excel-v2-1-3', 'تسمه-جوشی-صنعتی'),
      ('excel-v2-1-4', 'تسمه-بارکش-صنعتی'),
      ('excel-v2-2-1', 'نوار-نقاله-صنعتی'),
      ('excel-v2-2-2', 'خدمات-نوار-نقاله'),
      ('excel-v2-3-1', 'روکش-رولر-و-غلتک-صنعتی'),
      ('excel-v2-3-2', 'قطعات-رولر-صنعتی'),
      ('excel-v2-3-3', 'متعلقات-نگهدارنده-رولر'),
      ('excel-v2-4-1', 'پولی-تایمینگ-صنعتی'),
      ('excel-v2-5-1', 'برس-سیمی-صنعتی'),
      ('excel-v2-5-2', 'برس-خشک-کن-صنعتی'),
      ('excel-v2-6-1', 'ریل-راهنمای-صنعتی'),
      ('excel-v2-6-2', 'گاید-راهنمای-صنعتی'),
      ('excel-v2-6-3', 'پروفیل-و-پایه-هدایت-صنعتی'),
      ('excel-v2-6-4', 'سنسور-و-نگهدارنده-صنعتی'),
      ('excel-v2-7-1', 'قطعات-لاستیکی-صنعتی'),
      ('excel-v2-7-2', 'اورینگ-و-آببند-صنعتی'),
      ('excel-v2-7-3', 'ضربه-گیر-و-مکنده-صنعتی'),
      ('excel-v2-8-1', 'نوار-برزنتی-نسوز-چند-لایه'),
      ('excel-v2-8-2', 'نخ-و-عایق-نسوز-صنعتی'),
      ('excel-v2-9-1', 'زنجیر-صنعتی'),
      ('excel-v2-9-2', 'قطعات-پمپ-صنعتی'),
      ('excel-v2-9-3', 'یراق-آلات-و-قطعات-مکانیکی'),
      ('excel-v2-9-4', 'چرخ-صنعتی'),
      ('excel-v2-10-1', 'قطعات-دستگاه-چاپ-صنعتی'),
      ('excel-v2-10-2', 'تجهیزات-روتاری-صنعتی'),
      ('excel-v2-11-1', 'توری-مش-صنعتی'),
      ('excel-v2-12-1', 'ساخت-قطعات-صنعتی-سفارشی'),
      ('excel-v2-13-1', 'بلبرینگ-صنعتی'),
      ('excel-v2-13-2', 'یاتاقان-و-متعلقات-صنعتی'),
      ('excel-v2-14-1', 'ابر-اسفنجی-صنعتی'),
      ('excel-v2-14-2', 'نوار-اسفنجی-صنعتی'),
      ('excel-v2-14-3', 'اسکاج-صنعتی')
    ) AS expected(category_slug, route_slug)
    LEFT JOIN public.catalog_categories c ON c.slug = expected.category_slug
    WHERE c.slug IS NULL OR c.metadata->>'routeSlug' IS DISTINCT FROM expected.route_slug
  ) THEN
    RAISE EXCEPTION 'Persian SEO route verification failed';
  END IF;

  IF (SELECT count(DISTINCT metadata->>'routeSlug')
      FROM public.catalog_categories
      WHERE slug LIKE 'excel-v2-%' AND is_active = true) <> 34 THEN
    RAISE EXCEPTION 'Approved category SEO routes must be unique';
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS catalog_categories_active_seo_route_slug_unique
    ON public.catalog_categories ((metadata->>'routeSlug'))
    WHERE is_active = true AND slug LIKE 'excel-v2-%';

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
