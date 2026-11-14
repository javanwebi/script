-- Source-verified SKU-level subcategory overrides from SanatPish_Products_Final.xlsx.
-- Expected unique SKU rows: 305.
-- Family rows and variant rows are never deleted or rewritten.
-- ON CONFLICT DO NOTHING preserves any existing admin-managed SKU assignment.
BEGIN;

CREATE TEMP TABLE catalog_sku_menu_source ON COMMIT DROP AS
SELECT unnest(ARRAY['10099', '10100', '10109', '10110', '10123', '10256', '10549', '10629', '10630', '10631', '10632', '10664', '10710', '31203', '31531', '31771', '31804', '31806', '32035', '32411', '33386', '33625', '33888', '34041', '34237', '34368', '34553', '34695', '34890', '36380', '36657', '36661', '36730', '36822', '37036', '37509', '38276', '38836', '38948', '39440', '39669', '40372', '40409', '40440', '40444', '40445', '40446', '40448', '40477', '40499', '40565', '40656', '40758', '40800', '40801', '40831', '40832', '41042', '41058', '41060', '41061', '41066', '41077', '41114', '41145', '41146', '41147', '41151', '41152', '41173', '41191', '41192', '41193', '41194', '41195', '41196', '41198', '41211', '41212', '41248', '41256', '41262', '41265', '41266', '41290', '41342', '41343', '41345', '41365', '41383', '41388', '41398', '41404', '41405', '41406', '41407', '41428', '41430', '41431', '41440', '41470', '41471', '41488', '41520', '41521', '41562', '41587', '41599', '41715', '41770', '41771', '41772', '41792', '41843', '41844', '41845', '41846', '41851', '41862', '42202', '52315', '52611', '52612', '52613', '52628', '52629', '52630', '52694', '52695', '52696', '52697', '52708', '52709', '52763', '52810', '52811', '52815', '52821', '52858', '52873', '52941', '52945', '62614', '87965', '334142', '403250']::text[]) AS sku_code,
       'FAM-52858'::text AS expected_family_code,
       'excel-v2-2-1'::text AS category_slug,
       'بر اساس جنس'::text AS submenu,
       'نوار نقاله PVC'::text AS subcategory
UNION ALL
SELECT unnest(ARRAY['10127', '10438', '10439', '34229', '35058', '38287', '40865', '40979', '41364', '41716', '41745', '41842', '53263']::text[]) AS sku_code,
       'FAM-52858'::text AS expected_family_code,
       'excel-v2-2-1'::text AS category_slug,
       'بر اساس جنس'::text AS submenu,
       'نوار نقاله پلی‌اورتان (PU)'::text AS subcategory
UNION ALL
SELECT unnest(ARRAY['31243', '36946', '38748', '38971', '39004', '39122', '39468', '39769', '40462', '41160', '41725']::text[]) AS sku_code,
       'FAM-40462'::text AS expected_family_code,
       'excel-v2-1-3'::text AS category_slug,
       'تسمه گرد (CRC)'::text AS submenu,
       'انواع تسمه گرد جوشی'::text AS subcategory
UNION ALL
SELECT unnest(ARRAY['31224', '31310', '31328', '34095', '34132', '34136', '35501', '36612', '37005', '37006', '37007', '37009', '37031', '37032', '37033', '37034', '37573', '39615', '39673', '40020', '41171', '41685']::text[]) AS sku_code,
       'FAM-38906'::text AS expected_family_code,
       'excel-v2-1-3'::text AS category_slug,
       'تسمه گرد (CRC)'::text AS submenu,
       'انواع تسمه گرد جوشی'::text AS subcategory
UNION ALL
SELECT unnest(ARRAY['50149']::text[]) AS sku_code,
       'FAM-22751'::text AS expected_family_code,
       'excel-v2-1-3'::text AS category_slug,
       'تسمه گرد (CRC)'::text AS submenu,
       'انواع تسمه گرد جوشی'::text AS subcategory
UNION ALL
SELECT unnest(ARRAY['10166', '10184', '10188', '31205', '31206', '31208', '31252', '31254', '31275', '31280', '31282', '31292', '31299', '31311', '31663', '31697', '31882', '31997', '32088', '32172', '33088', '33768', '33773', '33775', '33822', '33830', '33834', '33842', '33843', '34092', '34283', '34374', '34650', '34687', '34688', '34767', '34780', '34783', '35387', '35946', '36156', '36188', '37215', '37217', '37507', '37699', '37828', '37934', '38013', '38014', '38015', '38221', '38702', '38703', '38778', '41043', '41141', '41142', '41143', '42563']::text[]) AS sku_code,
       'FAM-80151'::text AS expected_family_code,
       'excel-v2-1-3'::text AS category_slug,
       'تسمه گرد (CRC)'::text AS submenu,
       'انواع تسمه گرد جوشی'::text AS subcategory
UNION ALL
SELECT unnest(ARRAY['32161', '33841', '34782', '36215', '37931', '40612']::text[]) AS sku_code,
       'FAM-52319'::text AS expected_family_code,
       'excel-v2-1-3'::text AS category_slug,
       'تسمه گرد (CRC)'::text AS submenu,
       'انواع تسمه گرد جوشی'::text AS subcategory
UNION ALL
SELECT unnest(ARRAY['41813', '41856']::text[]) AS sku_code,
       'FAM-40417'::text AS expected_family_code,
       'excel-v2-1-3'::text AS category_slug,
       'تسمه گرد (CRC)'::text AS submenu,
       'انواع تسمه گرد جوشی'::text AS subcategory
UNION ALL
SELECT unnest(ARRAY['34182', '38344']::text[]) AS sku_code,
       'FAM-35624'::text AS expected_family_code,
       'excel-v2-1-3'::text AS category_slug,
       'تسمه گرد (CRC)'::text AS submenu,
       'انواع تسمه گرد جوشی'::text AS subcategory
UNION ALL
SELECT unnest(ARRAY['36187', '39092']::text[]) AS sku_code,
       'FAM-35525'::text AS expected_family_code,
       'excel-v2-1-3'::text AS category_slug,
       'تسمه گرد (CRC)'::text AS submenu,
       'انواع تسمه گرد جوشی'::text AS subcategory
UNION ALL
SELECT unnest(ARRAY['32060', '32612', '32613', '32616', '34096', '34107', '34131', '34147', '34149', '34454', '34526', '34598', '34721', '35147', '35314', '35441', '35741', '35867', '38599', '42386']::text[]) AS sku_code,
       'FAM-37769'::text AS expected_family_code,
       'excel-v2-1-3'::text AS category_slug,
       'تسمه گرد (CRC)'::text AS submenu,
       'انواع تسمه گرد جوشی'::text AS subcategory
UNION ALL
SELECT unnest(ARRAY['36922', '38813']::text[]) AS sku_code,
       'FAM-33117'::text AS expected_family_code,
       'excel-v2-6-1'::text AS category_slug,
       'بر اساس جنس'::text AS submenu,
       'ریل راهنما استیل و متعلقات'::text AS subcategory
UNION ALL
SELECT unnest(ARRAY['33063', '34082', '34824', '35344', '35381', '35517', '36763']::text[]) AS sku_code,
       'FAM-33117'::text AS expected_family_code,
       'excel-v2-6-1'::text AS category_slug,
       'بر اساس جنس'::text AS submenu,
       'ریل راهنما تفلون و متعلقات'::text AS subcategory
UNION ALL
SELECT unnest(ARRAY['36909']::text[]) AS sku_code,
       'FAM-33117'::text AS expected_family_code,
       'excel-v2-6-1'::text AS category_slug,
       'بر اساس جنس'::text AS submenu,
       'ریل راهنما گالوانیزه و متعلقات'::text AS subcategory
UNION ALL
SELECT unnest(ARRAY['36431']::text[]) AS sku_code,
       'FAM-90087'::text AS expected_family_code,
       'excel-v2-6-1'::text AS category_slug,
       'بر اساس جنس'::text AS submenu,
       'ریل راهنما گالوانیزه و متعلقات'::text AS subcategory
UNION ALL
SELECT unnest(ARRAY['34206']::text[]) AS sku_code,
       'FAM-33117'::text AS expected_family_code,
       'excel-v2-6-1'::text AS category_slug,
       'بر اساس جنس'::text AS submenu,
       'ریل راهنما آهنی و متعلقات'::text AS subcategory
UNION ALL
SELECT unnest(ARRAY['37095', '37702']::text[]) AS sku_code,
       'FAM-90087'::text AS expected_family_code,
       'excel-v2-6-1'::text AS category_slug,
       'بر اساس جنس'::text AS submenu,
       'ریل راهنما آهنی و متعلقات'::text AS subcategory
UNION ALL
SELECT unnest(ARRAY['37093', '37121', '39757', '41122']::text[]) AS sku_code,
       'FAM-80089'::text AS expected_family_code,
       'excel-v2-6-1'::text AS category_slug,
       'بر اساس جنس'::text AS submenu,
       'ریل راهنما آهنی و متعلقات'::text AS subcategory;

UNION ALL
SELECT unnest(ARRAY['39703', '3970318']::text[]) AS sku_code,
       'FAM-52858'::text AS expected_family_code,
       'excel-v2-2-1'::text AS category_slug,
       'بر اساس کاربرد و ابعاد'::text AS submenu,
       'مخصوص دستگاه بسته‌بندی (در ضخامت و ابعاد مختلف)'::text AS subcategory

DO $audit$
DECLARE
  source_count integer;
  valid_count integer;
BEGIN
  SELECT count(*) INTO source_count FROM pg_temp.catalog_sku_menu_source;
  IF source_count <> 305 THEN
    RAISE EXCEPTION 'Expected 305 source SKU assignments, found %', source_count;
  END IF;

  SELECT count(*) INTO valid_count
  FROM pg_temp.catalog_sku_menu_source s
  JOIN public.catalog_variants v
    ON v.code=s.sku_code
   AND v.family_code=s.expected_family_code
   AND v.active=true
  JOIN public.catalog_categories c
    ON c.slug=s.category_slug
   AND c.is_active=true;

  IF valid_count <> source_count THEN
    RAISE EXCEPTION 'SKU source validation failed: expected %, found %', source_count, valid_count;
  END IF;
END $audit$;

INSERT INTO public.catalog_direct_skus
  (sku_code,name,category_slug,category_name,submenu,subcategory,brand,image_url,
   technical_specs,price_snapshot,source_family_code,is_active,updated_at)
SELECT
  v.code,
  v.name,
  c.slug,
  c.name,
  s.submenu,
  s.subcategory,
  coalesce(v.brand,''),
  NULL,
  coalesce(v.technical_specs,'[]'::jsonb),
  '{}'::jsonb,
  v.family_code,
  true,
  now()
FROM pg_temp.catalog_sku_menu_source s
JOIN public.catalog_variants v
  ON v.code=s.sku_code
 AND v.family_code=s.expected_family_code
 AND v.active=true
JOIN public.catalog_categories c
  ON c.slug=s.category_slug
 AND c.is_active=true
ON CONFLICT (sku_code) DO NOTHING;

DO $audit$
DECLARE
  assigned_count integer;
BEGIN
  SELECT count(*) INTO assigned_count
  FROM pg_temp.catalog_sku_menu_source s
  JOIN public.catalog_direct_skus d
    ON d.sku_code=s.sku_code
   AND d.source_family_code=s.expected_family_code
   AND d.category_slug=s.category_slug
   AND d.submenu=s.submenu
   AND d.subcategory=s.subcategory
   AND d.is_active=true;

  IF assigned_count <> 305 THEN
    RAISE EXCEPTION 'SKU menu assignments conflict with existing/admin records: expected 305, found %', assigned_count;
  END IF;
END $audit$;

COMMIT;
