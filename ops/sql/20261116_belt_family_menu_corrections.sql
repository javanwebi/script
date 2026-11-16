-- 2026-11-16: final outstanding industrial-belt taxonomy corrections.
-- IMPORTANT: review-only migration. Do not run on production until a verified full DB backup exists
-- and the owner explicitly approves the production data change.
-- Product/family/SKU records are never deleted or deactivated; only invalid menu mappings are removed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE _belt_family_unassign (
  family_code text PRIMARY KEY,
  expected_category_slug text NOT NULL,
  expected_submenu_name text,
  expected_leaf_name text,
  reason text NOT NULL
) ON COMMIT DROP;
INSERT INTO _belt_family_unassign VALUES
('PFAM-تسمه-جوشی-V-رو-FORZA-A-633','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal profiles A/B/C/BRB are not classical rubber V-belts and have no approved Excel menu leaf'),
('PFAM-تسمه-جوشی-V-رو-FORZA-B-634','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal profiles A/B/C/BRB are not classical rubber V-belts and have no approved Excel menu leaf'),
('PFAM-تسمه-جوشی-V-رو-FORZA-B-636','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal profiles A/B/C/BRB are not classical rubber V-belts and have no approved Excel menu leaf'),
('PFAM-تسمه-جوشی-V-رو-FORZA-C-637','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal profiles A/B/C/BRB are not classical rubber V-belts and have no approved Excel menu leaf'),
('PFAM-تسمه-جوشی-V-رو-FORZA-C-638','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal profiles A/B/C/BRB are not classical rubber V-belts and have no approved Excel menu leaf'),
('PFAM-تسمه-جوشی-V-رو-T-B-B-635','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal profiles A/B/C/BRB are not classical rubber V-belts and have no approved Excel menu leaf'),
('PFAM-تسمه-جوشی-پلی--B-R-B-665','excel-v2-1-2','کلاسیک و دنده‌دار','Z (9.5) , M , A , B , C , D , E , 8V','Welded PU V/trapezoidal profiles A/B/C/BRB are not classical rubber V-belts and have no approved Excel menu leaf'),
('PFAM-تسمه-جوشی-پلی--FORZA-A-662','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal profiles A/B/C/BRB are not classical rubber V-belts and have no approved Excel menu leaf'),
('PFAM-تسمه-جوشی-پلی--FORZA-A-663','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal profiles A/B/C/BRB are not classical rubber V-belts and have no approved Excel menu leaf'),
('PFAM-تسمه-جوشی-پلی--FORZA-B-491','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal profiles A/B/C/BRB are not classical rubber V-belts and have no approved Excel menu leaf'),
('PFAM-تسمه-جوشی-پلی--FORZA-B-666','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal profiles A/B/C/BRB are not classical rubber V-belts and have no approved Excel menu leaf'),
('PFAM-تسمه-جوشی-پلی--FORZA-C-494','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal profiles A/B/C/BRB are not classical rubber V-belts and have no approved Excel menu leaf'),
('PFAM-تسمه-جوشی-پلی--FORZA-C-667','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal profiles A/B/C/BRB are not classical rubber V-belts and have no approved Excel menu leaf'),
('PFAM-تسمه-جوشی-پلی--GENERIC--B-397','excel-v2-1-2','کلاسیک و دنده‌دار','Z (9.5) , M , A , B , C , D , E , 8V','Welded PU V/trapezoidal profiles A/B/C/BRB are not classical rubber V-belts and have no approved Excel menu leaf'),
('PFAM-تسمه-جوشی-پلی--GENERIC--B-398','excel-v2-1-2','کلاسیک و دنده‌دار','Z (9.5) , M , A , B , C , D , E , 8V','Welded PU V/trapezoidal profiles A/B/C/BRB are not classical rubber V-belts and have no approved Excel menu leaf'),
('PFAM-تسمه-جوشی-پلی--GENERIC--C-399','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal profiles A/B/C/BRB are not classical rubber V-belts and have no approved Excel menu leaf'),
('PFAM-تسمه-جوشی-پلی--GENERIC--C-493','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal profiles A/B/C/BRB are not classical rubber V-belts and have no approved Excel menu leaf'),
('PFAM-تسمه-جوشی-پلی--VOLTA-B-664','excel-v2-1-2','کلاسیک و دنده‌دار','Z (9.5) , M , A , B , C , D , E , 8V','Welded PU V/trapezoidal profiles A/B/C/BRB are not classical rubber V-belts and have no approved Excel menu leaf');

CREATE TEMP TABLE _belt_direct_unassign (
  sku_code text PRIMARY KEY,
  expected_category_slug text NOT NULL,
  expected_submenu text,
  expected_subcategory text,
  reason text NOT NULL
) ON COMMIT DROP;
INSERT INTO _belt_direct_unassign VALUES
('10410','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('10553','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('31845','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('32072','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('32328','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('33838','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('33839','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('33840','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('34774','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('35361','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('35623','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('37221','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('37819','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('37820','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('37840','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('38334','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('38340','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('38756','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('38786','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('39859','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('39986','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('40003','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('41297','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('41717','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('41809','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('41811','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('51279','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('52640','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('37894','excel-v2-1-2','کلاسیک و دنده‌دار','Z (9.5) , M , A , B , C , D , E , 8V','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('38333','excel-v2-1-2','کلاسیک و دنده‌دار','Z (9.5) , M , A , B , C , D , E , 8V','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('38338','excel-v2-1-2','کلاسیک و دنده‌دار','Z (9.5) , M , A , B , C , D , E , 8V','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('41810','excel-v2-1-2','کلاسیک و دنده‌دار','Z (9.5) , M , A , B , C , D , E , 8V','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('41857','excel-v2-1-2','کلاسیک و دنده‌دار','Z (9.5) , M , A , B , C , D , E , 8V','Welded PU V/trapezoidal direct SKU has no approved V-belt menu path'),
('32711','excel-v2-1-1','سیم‌دار فابریک','پلی‌یورتان','Timing tensioner is an accessory, not a belt SKU');

-- The APL polishing/injection machine family is active but currently has no menu assignment.
-- It must appear in the equipment submenu, without being falsely labelled as a belt SKU leaf.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.catalog_families
    WHERE code='PFAM-دستگاه-صنعتی-GENERIC--دستگاه-صنعتی-576'
      AND is_active=true AND coalesce(is_deleted,false)=false
  ) THEN
    RAISE EXCEPTION 'APL equipment family is missing or inactive; refusing to insert menu assignment';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.catalog_family_menu_assignments
    WHERE family_code='PFAM-دستگاه-صنعتی-GENERIC--دستگاه-صنعتی-576'
  ) THEN
    RAISE EXCEPTION 'APL equipment family already has a menu assignment; reconcile before applying';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.catalog_categories WHERE slug='excel-v2-1-4') THEN
    RAISE EXCEPTION 'Equipment belt category is missing';
  END IF;
END $$;

-- Fail closed if any remaining family or direct SKU has changed since this audit.
DO $$
DECLARE bad_codes text;
BEGIN
  SELECT string_agg(m.family_code, ', ' ORDER BY m.family_code)
    INTO bad_codes
  FROM _belt_family_unassign m
  LEFT JOIN public.catalog_family_menu_assignments a ON a.family_code=m.family_code
  WHERE a.family_code IS NULL
     OR a.category_slug IS DISTINCT FROM m.expected_category_slug
     OR a.submenu_name IS DISTINCT FROM m.expected_submenu_name
     OR a.leaf_name IS DISTINCT FROM m.expected_leaf_name;
  IF bad_codes IS NOT NULL THEN
    RAISE EXCEPTION 'Welded PU family preflight failed; unexpected current path for: %', bad_codes;
  END IF;

  SELECT string_agg(m.sku_code, ', ' ORDER BY m.sku_code)
    INTO bad_codes
  FROM _belt_direct_unassign m
  LEFT JOIN public.catalog_direct_skus d ON d.sku_code=m.sku_code AND d.is_active=true
  WHERE d.sku_code IS NULL
     OR d.category_slug IS DISTINCT FROM m.expected_category_slug
     OR d.submenu IS DISTINCT FROM m.expected_submenu
     OR d.subcategory IS DISTINCT FROM m.expected_subcategory;
  IF bad_codes IS NOT NULL THEN
    RAISE EXCEPTION 'Direct welded-PU/accessory preflight failed; unexpected current path for: %', bad_codes;
  END IF;
END $$;

-- Store rollback rows in a non-API schema. Refuse to reuse a previous/stale backup.
DO $
BEGIN
  IF to_regclass('internal.catalog_family_menu_assignments_belt_backup_20261116') IS NOT NULL
     OR to_regclass('internal.catalog_direct_skus_belt_backup_20261116') IS NOT NULL THEN
    RAISE EXCEPTION 'Belt rollback backup tables already exist; inspect them before running this migration';
  END IF;
END $;
CREATE SCHEMA IF NOT EXISTS internal;
REVOKE ALL ON SCHEMA internal FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA internal FROM anon, authenticated;
CREATE TABLE internal.catalog_family_menu_assignments_belt_backup_20261116 (
  family_code text PRIMARY KEY,
  category_slug text NOT NULL,
  submenu_name text,
  leaf_name text,
  method text NOT NULL,
  created_at timestamptz,
  updated_at timestamptz,
  backup_reason text NOT NULL,
  backup_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE internal.catalog_direct_skus_belt_backup_20261116 (
  sku_code text PRIMARY KEY,
  category_slug text,
  category_name text,
  submenu text,
  subcategory text,
  technical_specs jsonb,
  updated_at timestamptz,
  backup_reason text NOT NULL,
  backup_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE internal.catalog_family_menu_assignments_belt_backup_20261116,
                    internal.catalog_direct_skus_belt_backup_20261116 FROM PUBLIC;

INSERT INTO internal.catalog_family_menu_assignments_belt_backup_20261116
  (family_code,category_slug,submenu_name,leaf_name,method,created_at,updated_at,backup_reason)
SELECT a.family_code,a.category_slug,a.submenu_name,a.leaf_name,a.method,a.created_at,a.updated_at,m.reason
FROM public.catalog_family_menu_assignments a
JOIN _belt_family_unassign m ON m.family_code=a.family_code
ON CONFLICT (family_code) DO NOTHING;

INSERT INTO internal.catalog_direct_skus_belt_backup_20261116
  (sku_code,category_slug,category_name,submenu,subcategory,technical_specs,updated_at,backup_reason)
SELECT d.sku_code,d.category_slug,d.category_name,d.submenu,d.subcategory,d.technical_specs,d.updated_at,m.reason
FROM public.catalog_direct_skus d
JOIN _belt_direct_unassign m ON m.sku_code=d.sku_code
ON CONFLICT (sku_code) DO NOTHING;

-- Insert the equipment family into the approved equipment submenu, without inventing a leaf.
INSERT INTO public.catalog_family_menu_assignments
  (family_code,category_slug,submenu_name,leaf_name,method,created_at,updated_at)
VALUES
  ('PFAM-دستگاه-صنعتی-GENERIC--دستگاه-صنعتی-576','excel-v2-1-4','دستگاه‌های تسمه جوشی',NULL,'taxonomy_gap',now(),now());

-- Remove only the invalid public V-belt menu assignment for welded PU V/trapezoidal families.
-- The family rows and their variants remain active.
DELETE FROM public.catalog_family_menu_assignments a
USING _belt_family_unassign m
WHERE a.family_code=m.family_code;

-- Remove welded PU sections and the timing tensioner from the public direct-SKU belt menu.
UPDATE public.catalog_direct_skus d
SET category_slug='UNRESOLVED',
    category_name='نیازمند تعیین تکلیف',
    submenu='',
    subcategory='',
    updated_at=now()
FROM _belt_direct_unassign m
WHERE d.sku_code=m.sku_code;

COMMIT;

-- Postflight summary.
SELECT jsonb_build_object(
  'equipment_family_assignment',(
    SELECT to_jsonb(a) FROM public.catalog_family_menu_assignments a
    WHERE a.family_code='PFAM-دستگاه-صنعتی-GENERIC--دستگاه-صنعتی-576'
  ),
  'remaining_welded_pu_family_assignments',(
    SELECT count(*) FROM public.catalog_family_menu_assignments
    WHERE family_code IN (SELECT family_code FROM internal.catalog_family_menu_assignments_belt_backup_20261116)
  ),
  'unresolved_direct_skus_from_this_migration',(
    SELECT count(*) FROM public.catalog_direct_skus
    WHERE sku_code IN (SELECT sku_code FROM internal.catalog_direct_skus_belt_backup_20261116)
      AND category_slug='UNRESOLVED'
  ),
  'active_belt_family_assignments_by_category',(
    SELECT jsonb_agg(to_jsonb(x) ORDER BY category_slug) FROM (
      SELECT a.category_slug,count(*) families
      FROM public.catalog_family_menu_assignments a
      JOIN public.catalog_families f ON f.code=a.family_code
      WHERE a.category_slug LIKE 'excel-v2-1-%'
        AND f.is_active=true AND coalesce(f.is_deleted,false)=false
      GROUP BY a.category_slug
    ) x
  )
) AS belt_taxonomy_postflight;
