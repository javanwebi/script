-- Additive recovery for the production VPS's missing navigation schema.
-- Run ONLY through the canonical deployment against the live app's DATABASE_URL.
-- Existing rows, group customizations, product data and assignments are untouched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '40s';

DO $$
DECLARE count_categories integer;
BEGIN
 IF to_regclass('public.catalog_categories') IS NULL
    OR to_regclass('public.catalog_families') IS NULL THEN
    RAISE EXCEPTION 'Wrong database: required catalog_categories/catalog_families tables are missing';
 END IF;
 SELECT count(*) INTO count_categories FROM public.catalog_categories
 WHERE slug ~ '^excel-v2-[0-9]+-[0-9]+$' AND is_active=true;
 IF count_categories < 6 THEN
   RAISE EXCEPTION 'Wrong or incomplete production taxonomy; only % approved active categories found', count_categories;
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.catalog_navigation_groups (
 id text PRIMARY KEY,
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 120),
 icon_key text NOT NULL DEFAULT 'layers',
 image_url text,
 category_slugs text[] NOT NULL DEFAULT '{}',
 sort_order integer NOT NULL DEFAULT 0,
 is_active boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_catalog_navigation_groups_sort
 ON public.catalog_navigation_groups(sort_order,id);
ALTER TABLE public.catalog_navigation_groups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalog_navigation_groups FROM PUBLIC, anon, authenticated;

-- Only if missing. Real family and category data is never replaced.
CREATE TABLE IF NOT EXISTS public.catalog_family_menu_assignments (
 family_code text PRIMARY KEY REFERENCES public.catalog_families(code) ON DELETE CASCADE,
 category_slug text NOT NULL REFERENCES public.catalog_categories(slug) ON DELETE RESTRICT,
 submenu_name text,
 leaf_name text,
 method text NOT NULL DEFAULT 'conservative_name_rule',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_catalog_family_menu_category
 ON public.catalog_family_menu_assignments(category_slug);
ALTER TABLE public.catalog_family_menu_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalog_family_menu_assignments FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.catalog_direct_skus (
 sku_code text PRIMARY KEY,
 name text NOT NULL,
 category_slug text NOT NULL,
 category_name text NOT NULL,
 submenu text NOT NULL DEFAULT '',
 subcategory text NOT NULL DEFAULT '',
 brand text NOT NULL DEFAULT '',
 image_url text,
 technical_specs jsonb NOT NULL DEFAULT '[]'::jsonb,
 price_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
 source_family_code text,
 is_active boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_catalog_direct_skus_category
 ON public.catalog_direct_skus(category_slug,submenu,subcategory)
 WHERE is_active;
ALTER TABLE public.catalog_direct_skus ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalog_direct_skus FROM PUBLIC, anon, authenticated;

-- Source of truth for bootstrap labels is the reviewed Excel snapshot.
-- ON CONFLICT DO NOTHING preserves everything already changed in Admin.
INSERT INTO public.catalog_navigation_groups
 (id,title,icon_key,category_slugs,sort_order,is_active) VALUES
  ('excel-v2-1','انواع تسمه‌های صنعتی','layers',ARRAY['excel-v2-1-1','excel-v2-1-2','excel-v2-1-3','excel-v2-1-4']::text[],0,true),
  ('excel-v2-2','نوارهای نقاله و انتقال مواد','layers',ARRAY['excel-v2-2-1','excel-v2-2-2']::text[],1,true),
  ('excel-v2-3','رولر و متعلقات رولر','layers',ARRAY['excel-v2-3-1','excel-v2-3-2','excel-v2-3-3']::text[],2,true),
  ('excel-v2-4','پولی و تجهیزات انتقال قدرت','layers',ARRAY['excel-v2-4-1']::text[],3,true),
  ('excel-v2-5','برس‌های صنعتی','layers',ARRAY['excel-v2-5-1','excel-v2-5-2']::text[],4,true),
  ('excel-v2-6','ریل، گاید و تجهیزات هدایت خطوط انتقال','layers',ARRAY['excel-v2-6-1','excel-v2-6-2','excel-v2-6-3','excel-v2-6-4']::text[],5,true),
  ('excel-v2-7','قطعات پلیمری و لاستیکی','layers',ARRAY['excel-v2-7-1','excel-v2-7-2','excel-v2-7-3']::text[],6,true),
  ('excel-v2-8','تجهیزات نسوز و حرارتی','layers',ARRAY['excel-v2-8-1','excel-v2-8-2']::text[],7,true),
  ('excel-v2-9','زنجیر و قطعات مکانیکی انتقال حرکت','layers',ARRAY['excel-v2-9-1','excel-v2-9-2','excel-v2-9-3','excel-v2-9-4']::text[],8,true),
  ('excel-v2-10','قطعات خطوط لعاب و چاپ','layers',ARRAY['excel-v2-10-1','excel-v2-10-2']::text[],9,true),
  ('excel-v2-11','انواع توری مش','layers',ARRAY['excel-v2-11-1']::text[],10,true),
  ('excel-v2-12','قطعات سفارشی مطابق با نقشه فنی شما','layers',ARRAY['excel-v2-12-1']::text[],11,true),
  ('excel-v2-13','انواع بلبرینگ','layers',ARRAY['excel-v2-13-1','excel-v2-13-2']::text[],12,true),
  ('excel-v2-14','ابر و اسفنج و اسکاج صنعتی','layers',ARRAY['excel-v2-14-1','excel-v2-14-2','excel-v2-14-3']::text[],13,true)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE available integer;
BEGIN
 SELECT count(*) INTO available FROM public.catalog_navigation_groups
 WHERE is_active=true AND id ~ '^excel-v2-[0-9]+$';
 IF available < 6 THEN
  RAISE EXCEPTION 'Failed to prepare approved mega-menu; only % approved groups are active', available;
 END IF;
END $$;
COMMIT;
