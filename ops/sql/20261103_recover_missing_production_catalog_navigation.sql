-- Additive recovery for the production VPS's missing navigation schema.
-- Run ONLY through the canonical deployment against the live app's DATABASE_URL.
-- Existing rows, group customizations, product data and assignments are untouched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '40s';

-- Existing production fingerprint must be present; approved Excel rows need not exist yet.
DO $$
DECLARE legacy_categories integer;
DECLARE existing_families integer;
BEGIN
 IF to_regclass('public.catalog_categories') IS NULL
    OR to_regclass('public.catalog_families') IS NULL THEN
    RAISE EXCEPTION 'Wrong database: catalogue core tables are missing';
 END IF;
 SELECT count(*) INTO legacy_categories FROM public.catalog_categories;
 SELECT count(*) INTO existing_families FROM public.catalog_families;
 IF legacy_categories < 10 OR existing_families < 100 THEN
   RAISE EXCEPTION 'Database fingerprint mismatch; categories %, families %', legacy_categories, existing_families;
 END IF;
END $$;

-- Reviewed 34-category Excel hierarchy, including all nested menu nodes.
-- Insert missing slugs only; never replace any existing admin changes.
INSERT INTO public.catalog_categories
 (id,slug,name,icon,image_url,description,sort_order,is_active,metadata) VALUES
 ('excel-v2-1-1','excel-v2-1-1','تسمه تایمینگ','Package',NULL,'',101,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"سیم‌دار فابریک","children":[{"name":"پلی‌یورتان"},{"name":"کامیون دار (کلید دار)"},{"name":"APL دار"}]},{"name":"لاستیکی فابریک","children":[{"name":"لاستیکی فابریک ساده و دنده‌دار"}]},{"name":"انواع گام و کدهای تایمینگ","children":[{"name":"T5 , AT5 , AT10 , AT20"},{"name":"H , XH , L , XL"},{"name":"5M , 8M , 11M , 14M"}]}],"subcategories":["سیم‌دار فابریک","لاستیکی فابریک","انواع گام و کدهای تایمینگ"],"routeSlug":"excel-v2-1-1","nameEn":""}'::jsonb),
 ('excel-v2-1-2','excel-v2-1-2','تسمه وی‌بلت (V-Belt)','Package',NULL,'',102,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"کلاسیک و دنده‌دار","children":[{"name":"Z (9.5) , M , A , B , C , D , E , 8V"}]},{"name":"تسمه اسپشیال","children":[{"name":"SPA , SPB , SPC و دندانه‌دار"}]},{"name":"وی‌بلت متری","children":[{"name":"تسمه A و B و C وی‌بلت متری"}]}],"subcategories":["کلاسیک و دنده‌دار","تسمه اسپشیال","وی‌بلت متری"],"routeSlug":"excel-v2-1-2","nameEn":""}'::jsonb),
 ('excel-v2-1-3','excel-v2-1-3','تسمه جوشی با سایت','Package',NULL,'',103,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"تسمه گرد (CRC)","children":[{"name":"انواع تسمه گرد جوشی"}]},{"name":"تسمه فلت","children":[{"name":"انواع تسمه تخت و فلت"}]}],"subcategories":["تسمه گرد (CRC)","تسمه فلت"],"routeSlug":"excel-v2-1-3","nameEn":""}'::jsonb),
 ('excel-v2-1-4','excel-v2-1-4','تسمه بارکش و تجهیزات جوشی','Package',NULL,'',104,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"تسمه بارکش","children":[{"name":"انواع تسمه بارکش صنعتی"}]},{"name":"دستگاه‌های تسمه جوشی","children":[{"name":"دستگاه جوش تسمه صنعتی"}]}],"subcategories":["تسمه بارکش","دستگاه‌های تسمه جوشی"],"routeSlug":"excel-v2-1-4","nameEn":""}'::jsonb),
 ('excel-v2-2-1','excel-v2-2-1','نوار نقاله صنعتی','Package',NULL,'',201,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"بر اساس جنس","children":[{"name":"نوار نقاله PVC"},{"name":"نوار نقاله پلی‌اورتان (PU)"}]},{"name":"بر اساس کاربرد و ابعاد","children":[{"name":"مخصوص دستگاه بسته‌بندی (در ضخامت و ابعاد مختلف)"}]}],"subcategories":["بر اساس جنس","بر اساس کاربرد و ابعاد"],"routeSlug":"excel-v2-2-1","nameEn":""}'::jsonb),
 ('excel-v2-2-2','excel-v2-2-2','خدمات نوار نقاله','Package',NULL,'',202,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"بازدید و نصب","children":[{"name":"بازدید و نصب کامل در محل"}]}],"subcategories":["بازدید و نصب"],"routeSlug":"excel-v2-2-2","nameEn":""}'::jsonb),
 ('excel-v2-3-1','excel-v2-3-1','روکش رولر و غلتک','Package',NULL,'',301,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"روکش غلتک","children":[{"name":"در سختی‌های مختلف - پرینت"}]}],"subcategories":["روکش غلتک"],"routeSlug":"excel-v2-3-1","nameEn":""}'::jsonb),
 ('excel-v2-3-2','excel-v2-3-2','قطعات رولر','Package',NULL,'',302,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"بوش بغل رولر","children":[{"name":"بوش بغل رولر فلزی"},{"name":"بوش بغل رولر پلاستیک"}]},{"name":"بوش دنده رولر","children":[{"name":"انواع بوش دنده رولر"}]},{"name":"فنر سر رول","children":[{"name":"انواع فنر سر رول"}]},{"name":"پین سر رولر و زنجیر","children":[{"name":"انواع پین سر رولر و زنجیر"}]}],"subcategories":["بوش بغل رولر","بوش دنده رولر","فنر سر رول","پین سر رولر و زنجیر"],"routeSlug":"excel-v2-3-2","nameEn":""}'::jsonb),
 ('excel-v2-3-3','excel-v2-3-3','متعلقات نگهدارنده','Package',NULL,'',303,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"خار نگهدارنده","children":[{"name":"انواع خار نگهدارنده رولر و شفت"}]}],"subcategories":["خار نگهدارنده"],"routeSlug":"excel-v2-3-3","nameEn":""}'::jsonb),
 ('excel-v2-4-1','excel-v2-4-1','انواع پولی تایمینگ','Package',NULL,'',401,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"پولی پلی‌اورتان","children":[{"name":"در سایزها و گام‌های مختلف"}]},{"name":"پولی پلاستیک","children":[{"name":"در سایزها و گام‌های مختلف"}]}],"subcategories":["پولی پلی‌اورتان","پولی پلاستیک"],"routeSlug":"excel-v2-4-1","nameEn":""}'::jsonb),
 ('excel-v2-5-1','excel-v2-5-1','برس سیمی','Package',NULL,'',501,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"انواع برس‌های سیمی","children":[{"name":"در ابعاد مختلف"}]}],"subcategories":["انواع برس‌های سیمی"],"routeSlug":"excel-v2-5-1","nameEn":""}'::jsonb),
 ('excel-v2-5-2','excel-v2-5-2','برس خشک‌کن','Package',NULL,'',502,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"انواع برس خشک‌کن","children":[{"name":"مخصوص خطوط صنعتی و شستشو"}]}],"subcategories":["انواع برس خشک‌کن"],"routeSlug":"excel-v2-5-2","nameEn":""}'::jsonb),
 ('excel-v2-6-1','excel-v2-6-1','انواع ریل راهنما','Package',NULL,'',601,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"بر اساس جنس","children":[{"name":"ریل راهنما استیل و متعلقات"},{"name":"ریل راهنما تفلون و متعلقات"},{"name":"ریل راهنما آهنی و متعلقات"},{"name":"ریل راهنما گالوانیزه و متعلقات"}]},{"name":"بر اساس تیپ و کاربرد","children":[{"name":"ریل تیپ B و تیپ C"},{"name":"ریل تایمینگ، زنجیر و دنده شانه"}]}],"subcategories":["بر اساس جنس","بر اساس تیپ و کاربرد"],"routeSlug":"excel-v2-6-1","nameEn":""}'::jsonb),
 ('excel-v2-6-2','excel-v2-6-2','انواع گاید راهنما','Package',NULL,'',602,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"گاید تفلونی","children":[{"name":"۲ لبه و متعلقات"},{"name":"۳ لبه و متعلقات"},{"name":"بدون لبه و متعلقات"}]},{"name":"نرده استیل","children":[{"name":"نرده استیل و متعلقات"}]}],"subcategories":["گاید تفلونی","نرده استیل"],"routeSlug":"excel-v2-6-2","nameEn":""}'::jsonb),
 ('excel-v2-6-3','excel-v2-6-3','پروفیل و پایه هدایت','Package',NULL,'',603,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"پروفیل آلومینیوم","children":[{"name":"انواع پروفیل آلومینیومی صنعتی"}]},{"name":"پایه کشویی","children":[{"name":"انواع پایه کشویی تفلونی خط کاشی"}]}],"subcategories":["پروفیل آلومینیوم","پایه کشویی"],"routeSlug":"excel-v2-6-3","nameEn":""}'::jsonb),
 ('excel-v2-6-4','excel-v2-6-4','سنسور و نگهدارنده‌ها','Package',NULL,'',604,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"انواع سنسور","children":[{"name":"سنسورهای خطوط انتقال"}]},{"name":"نگهدارنده سنسور","children":[{"name":"انواع قطعات نگهدارنده سنسور"}]}],"subcategories":["انواع سنسور","نگهدارنده سنسور"],"routeSlug":"excel-v2-6-4","nameEn":""}'::jsonb),
 ('excel-v2-7-1','excel-v2-7-1','قطعات لاستیکی صنعتی','Package',NULL,'',701,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"انواع قطعات لاستیکی","children":[{"name":"قطعات لاستیکی عمومی و تخصصی"}]}],"subcategories":["انواع قطعات لاستیکی"],"routeSlug":"excel-v2-7-1","nameEn":""}'::jsonb),
 ('excel-v2-7-2','excel-v2-7-2','آب‌بندها و اورینگ','Package',NULL,'',702,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"انواع اورینگ","children":[{"name":"اورینگ در سایزها و متریال‌های مختلف"}]},{"name":"کاسه نمد و پکینگ","children":[{"name":"انواع کاسه نمد و پکینگ صنعتی"}]}],"subcategories":["انواع اورینگ","کاسه نمد و پکینگ"],"routeSlug":"excel-v2-7-2","nameEn":""}'::jsonb),
 ('excel-v2-7-3','excel-v2-7-3','ضربه‌گیر و مکنده','Package',NULL,'',703,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"ضربه‌گیر و لرزه‌گیر","children":[{"name":"انواع ضربه‌گیر و لرزه‌گیر لاستیکی و پلیمری"}]},{"name":"مکنده","children":[{"name":"انواع مکنده صنعتی"}]}],"subcategories":["ضربه‌گیر و لرزه‌گیر","مکنده"],"routeSlug":"excel-v2-7-3","nameEn":""}'::jsonb),
 ('excel-v2-8-1','excel-v2-8-1','نوار برزنتی نسوز (چند لایه)','Package',NULL,'',801,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"برزنتی چسب‌دار","children":[{"name":"(نخ و پارچه) برزنتی در ضخامت مختلف"}]},{"name":"نسوز چسب‌دار","children":[{"name":"(کتان و چسب) نسوز در ضخامت مختلف"}]}],"subcategories":["برزنتی چسب‌دار","نسوز چسب‌دار"],"routeSlug":"excel-v2-8-1","nameEn":""}'::jsonb),
 ('excel-v2-8-2','excel-v2-8-2','نخ و عایق نسوز','Package',NULL,'',802,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"نخ نسوز","children":[{"name":"انواع نخ نسوز صنعتی"}]}],"subcategories":["نخ نسوز"],"routeSlug":"excel-v2-8-2","nameEn":""}'::jsonb),
 ('excel-v2-9-1','excel-v2-9-1','زنجیر صنعتی','Package',NULL,'',901,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"انواع زنجیر","children":[{"name":"زنجیرهای انتقال حرکت صنعتی"}]}],"subcategories":["انواع زنجیر"],"routeSlug":"excel-v2-9-1","nameEn":""}'::jsonb),
 ('excel-v2-9-2','excel-v2-9-2','قطعات پمپ','Package',NULL,'',902,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"پروانه و پوسته پمپ","children":[{"name":"پمپ حلزونی و طبقاتی"}]}],"subcategories":["پروانه و پوسته پمپ"],"routeSlug":"excel-v2-9-2","nameEn":""}'::jsonb),
 ('excel-v2-9-3','excel-v2-9-3','یراق‌آلات و قطعات مکانیکی','Package',NULL,'',903,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"دستگیره و پیچ فلکه","children":[{"name":"انواع دستگیره شکل و پیچ فلکه"}]},{"name":"انواع لولا","children":[{"name":"لولاهای صنعتی"}]}],"subcategories":["دستگیره و پیچ فلکه","انواع لولا"],"routeSlug":"excel-v2-9-3","nameEn":""}'::jsonb),
 ('excel-v2-9-4','excel-v2-9-4','چرخ‌های صنعتی','Package',NULL,'',904,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"انواع چرخ","children":[{"name":"چرخ‌های صنعتی و انتقال"}]}],"subcategories":["انواع چرخ"],"routeSlug":"excel-v2-9-4","nameEn":""}'::jsonb),
 ('excel-v2-10-1','excel-v2-10-1','تجهیزات دستگاه چاپ','Package',NULL,'',1001,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"اسپاتول سیلیکونی","children":[{"name":"انواع سایزهای اسپاتول سیلیکونی جهت دستگاه چاپ"}]}],"subcategories":["اسپاتول سیلیکونی"],"routeSlug":"excel-v2-10-1","nameEn":""}'::jsonb),
 ('excel-v2-10-2','excel-v2-10-2','تجهیزات روتاری','Package',NULL,'',1002,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"انگشتی روتاری","children":[{"name":"انواع انگشتی روتاری فرنگ"}]}],"subcategories":["انگشتی روتاری"],"routeSlug":"excel-v2-10-2","nameEn":""}'::jsonb),
 ('excel-v2-11-1','excel-v2-11-1','توری مش صنعتی','Package',NULL,'',1101,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"انواع توری مش","children":[{"name":"توری مش در ابعاد و چشمه‌های مختلف"}]}],"subcategories":["انواع توری مش"],"routeSlug":"excel-v2-11-1","nameEn":""}'::jsonb),
 ('excel-v2-12-1','excel-v2-12-1','ساخت قطعات سفارشی','Package',NULL,'',1201,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"مطابق با نقشه فنی","children":[{"name":"طراحی و تولید قطعات بر اساس نقشه یا نمونه فنی شما"}]}],"subcategories":["مطابق با نقشه فنی"],"routeSlug":"excel-v2-12-1","nameEn":""}'::jsonb),
 ('excel-v2-13-1','excel-v2-13-1','بلبرینگ صنعتی','Package',NULL,'',1301,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"انواع بلبرینگ","children":[{"name":"بلبرینگ‌های صنعتی در سایزهای مختلف"}]}],"subcategories":["انواع بلبرینگ"],"routeSlug":"excel-v2-13-1","nameEn":""}'::jsonb),
 ('excel-v2-13-2','excel-v2-13-2','یاتاقان و متعلقات','Package',NULL,'',1302,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"انواع یاتاقان","children":[{"name":"یاتاقان و انواع محافظ یاتاقان"}]},{"name":"مهره و واشر","children":[{"name":"انواع مهره و واشر بلبرینگ و یاتاقان"}]}],"subcategories":["انواع یاتاقان","مهره و واشر"],"routeSlug":"excel-v2-13-2","nameEn":""}'::jsonb),
 ('excel-v2-14-1','excel-v2-14-1','ابر اسفنجی','Package',NULL,'',1401,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"ابرهای اسفنجی","children":[{"name":"انواع ابر اسفنجی صنعتی"}]}],"subcategories":["ابرهای اسفنجی"],"routeSlug":"excel-v2-14-1","nameEn":""}'::jsonb),
 ('excel-v2-14-2','excel-v2-14-2','نوار اسفنجی','Package',NULL,'',1402,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"نوار اسفنجی چسب‌دار و ساده","children":[{"name":"چسب‌دار و بدون چسب"}]},{"name":"نوار اسفنجی سیلیکونی","children":[{"name":"انواع نوار اسفنجی سیلیکونی"}]}],"subcategories":["نوار اسفنجی چسب‌دار و ساده","نوار اسفنجی سیلیکونی"],"routeSlug":"excel-v2-14-2","nameEn":""}'::jsonb),
 ('excel-v2-14-3','excel-v2-14-3','اسکاج صنعتی','Package',NULL,'',1403,true,'{"source":"industrial_megamenu_hierarchy_v2","children":[{"name":"انواع اسکاج","children":[{"name":"اسکاج صنعتی و اسکاج گرد"}]}],"subcategories":["انواع اسکاج"],"routeSlug":"excel-v2-14-3","nameEn":""}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE approved_categories integer;
BEGIN
 SELECT count(*) INTO approved_categories
 FROM public.catalog_categories
 WHERE is_active=true
   AND slug ~ '^excel-v2-[0-9]+-[0-9]+$'
   AND metadata->>'source'='industrial_megamenu_hierarchy_v2';
 IF approved_categories < 34 THEN
   RAISE EXCEPTION 'Approved category bootstrap incomplete: %/34. Existing records are not overwritten.', approved_categories;
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
