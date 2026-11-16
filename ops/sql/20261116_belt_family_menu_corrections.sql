-- 2026-11-16: engineering corrections for industrial-belt family/menu assignments.
-- IMPORTANT: review-only migration. Do not run on production until a verified full DB backup exists
-- and the owner explicitly approves the production data change.
-- This migration does NOT delete catalog_families, catalog_variants or catalog_direct_skus.
-- It only corrects the family-menu overlay and direct-SKU menu metadata. Unapproved families/SKUs
-- are kept active but removed from the public belt menu until the Excel taxonomy is approved.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE _belt_family_updates (
  family_code text PRIMARY KEY,
  expected_category_slug text NOT NULL,
  expected_submenu_name text,
  expected_leaf_name text,
  new_category_slug text NOT NULL,
  new_submenu_name text,
  new_leaf_name text,
  new_method text NOT NULL
) ON COMMIT DROP;
INSERT INTO _belt_family_updates VALUES
('PFAM-تسمه-V-شکل-پرو-GENERIC--M-051','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','excel-v2-1-2','کلاسیک و دنده‌دار','Z (9.5) , M , A , B , C , D , E , 8V','engineering_audited'),
('PFAM-تسمه-V-شکل-پرو-GENERIC--Z-045','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','excel-v2-1-2','کلاسیک و دنده‌دار','Z (9.5) , M , A , B , C , D , E , 8V','engineering_audited'),
('PFAM-تسمه-V-شکل-پرو-GENERIC--ZX-109','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','excel-v2-1-2','کلاسیک و دنده‌دار','Z (9.5) , M , A , B , C , D , E , 8V','engineering_audited'),
('PFAM-تسمه-V-شکل-پرو-HANKOOK-Z-657','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','excel-v2-1-2','کلاسیک و دنده‌دار','Z (9.5) , M , A , B , C , D , E , 8V','engineering_audited'),
('PFAM-تسمه-V-شکل-پرو-REFLEX-Z-656','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','excel-v2-1-2','کلاسیک و دنده‌دار','Z (9.5) , M , A , B , C , D , E , 8V','engineering_audited'),
('PFAM-تسمه-V-شکل-پرو-GENERIC--MX-660','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','excel-v2-1-2','کلاسیک و دنده‌دار',NULL,'taxonomy_gap'),
('PFAM-تسمه-جوشی-V-رو-GENERIC--B-050','excel-v2-1-1','سیم‌دار فابریک','APL دار','excel-v2-1-2','کلاسیک و دنده‌دار','Z (9.5) , M , A , B , C , D , E , 8V','engineering_audited'),
('PFAM-تسمه-جوشی-V-رو-GENERIC--C-108','excel-v2-1-1','سیم‌دار فابریک','APL دار','excel-v2-1-2','کلاسیک و دنده‌دار','Z (9.5) , M , A , B , C , D , E , 8V','engineering_audited'),
('PFAM-تسمه-تایمینگ-م-POWER-3M-470','excel-v2-1-1','انواع گام و کدهای تایمینگ','5M , 8M , 11M , 14M','excel-v2-1-1','لاستیکی فابریک','لاستیکی فابریک ساده و دنده‌دار','engineering_audited'),
('PFAM-تسمه-تایمینگ-م-POWER-3M-621','excel-v2-1-1','انواع گام و کدهای تایمینگ','5M , 8M , 11M , 14M','excel-v2-1-1','لاستیکی فابریک','لاستیکی فابریک ساده و دنده‌دار','engineering_audited'),
('PFAM-تسمه-ذوزنقه-ای-GENERIC--CRC-046','excel-v2-1-3','تسمه گرد (CRC)','انواع تسمه گرد جوشی','excel-v2-1-4','تسمه بارکش','انواع تسمه بارکش صنعتی','engineering_audited'),
('PFAM-تسمه-ذوزنقه-ای-GENERIC--TRC-653','excel-v2-1-3','تسمه گرد (CRC)','انواع تسمه گرد جوشی','excel-v2-1-4','تسمه بارکش','انواع تسمه بارکش صنعتی','engineering_audited'),
('PFAM-تسمه-ذوزنقه-ای-GNR-CRC-168','excel-v2-1-3','تسمه گرد (CRC)','انواع تسمه گرد جوشی','excel-v2-1-4','تسمه بارکش','انواع تسمه بارکش صنعتی','engineering_audited'),
('PFAM-تسمه-ذوزنقه-ای-MEGADYNE-CRC-107','excel-v2-1-3','تسمه گرد (CRC)','انواع تسمه گرد جوشی','excel-v2-1-4','تسمه بارکش','انواع تسمه بارکش صنعتی','engineering_audited'),
('PFAM-تسمه-ذوزنقه-ای-SWR-CRC-097','excel-v2-1-3','تسمه گرد (CRC)','انواع تسمه گرد جوشی','excel-v2-1-4','تسمه بارکش','انواع تسمه بارکش صنعتی','engineering_audited'),
('PFAM-دستگاه-صنعتی-GENERIC--دستگاه-صنعتی-576','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','excel-v2-1-4','دستگاه‌های تسمه جوشی',NULL,'taxonomy_gap'),
('PFAM-تسمه-V-شکل-به--GENERIC--3VX-BANDED-641','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','excel-v2-1-2','تسمه اسپشیال',NULL,'taxonomy_gap'),
('PFAM-تسمه-V-شکل-به--SWR-3VX-BANDED-395','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','excel-v2-1-2','تسمه اسپشیال',NULL,'taxonomy_gap'),
('PFAM-تسمه-V-شکل-پرو-DONGIL-XPZ-594','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','excel-v2-1-2','تسمه اسپشیال',NULL,'taxonomy_gap'),
('PFAM-تسمه-V-شکل-پرو-GENERIC--SPZ-121','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','excel-v2-1-2','تسمه اسپشیال',NULL,'taxonomy_gap'),
('PFAM-تسمه-V-شکل-پرو-SWR-5V-489','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','excel-v2-1-2','تسمه اسپشیال',NULL,'taxonomy_gap'),
('PFAM-تسمه-V-شکل-پرو-SWR-SPZ-080','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','excel-v2-1-2','تسمه اسپشیال',NULL,'taxonomy_gap'),
('PFAM-تسمه-V-شکل-پرو-SWR-XPZ-105','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','excel-v2-1-2','تسمه اسپشیال',NULL,'taxonomy_gap'),
('PFAM-تسمه-تایمینگ-ذ-BANDO-DH-287','excel-v2-1-1','انواع گام و کدهای تایمینگ','H , XH , L , XL','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'taxonomy_gap'),
('PFAM-تسمه-تایمینگ-ذ-BANDO-DH-474','excel-v2-1-1','انواع گام و کدهای تایمینگ','H , XH , L , XL','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'taxonomy_gap'),
('PFAM-تسمه-تایمینگ-ذ-BERAVO-DH-226','excel-v2-1-1','انواع گام و کدهای تایمینگ','H , XH , L , XL','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'taxonomy_gap'),
('PFAM-تسمه-تایمینگ-ذ-BERAVO-DH-290','excel-v2-1-1','انواع گام و کدهای تایمینگ','H , XH , L , XL','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'taxonomy_gap'),
('PFAM-تسمه-تایمینگ-ذ-GENERIC--DH-223','excel-v2-1-1','انواع گام و کدهای تایمینگ','H , XH , L , XL','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'taxonomy_gap'),
('PFAM-تسمه-تایمینگ-ذ-GENERIC--DH-472','excel-v2-1-1','انواع گام و کدهای تایمینگ','H , XH , L , XL','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'taxonomy_gap'),
('PFAM-تسمه-تایمینگ-ذ-GENERIC--DL-473','excel-v2-1-1','انواع گام و کدهای تایمینگ','H , XH , L , XL','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'taxonomy_gap'),
('PFAM-تسمه-تایمینگ-ذ-MARSHAL-DH-087','excel-v2-1-1','انواع گام و کدهای تایمینگ','H , XH , L , XL','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'taxonomy_gap'),
('PFAM-تسمه-تایمینگ-ذ-MARSHAL-DH-126','excel-v2-1-1','انواع گام و کدهای تایمینگ','H , XH , L , XL','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'taxonomy_gap'),
('PFAM-تسمه-تایمینگ-ذ-MARSHAL-DL-650','excel-v2-1-1','انواع گام و کدهای تایمینگ','H , XH , L , XL','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'taxonomy_gap'),
('PFAM-تسمه-تایمینگ-ذ-MEGADYNE-DH-289','excel-v2-1-1','انواع گام و کدهای تایمینگ','H , XH , L , XL','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'taxonomy_gap'),
('PFAM-تسمه-تایمینگ-ذ-MEGADYNE-DH-329','excel-v2-1-1','انواع گام و کدهای تایمینگ','H , XH , L , XL','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'taxonomy_gap'),
('PFAM-تسمه-تایمینگ-ذ-UNITECH-DH-258','excel-v2-1-1','انواع گام و کدهای تایمینگ','H , XH , L , XL','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'taxonomy_gap'),
('PFAM-تسمه-تایمینگ-ذ-UNITECH-DH-326','excel-v2-1-1','انواع گام و کدهای تایمینگ','H , XH , L , XL','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'taxonomy_gap'),
('PFAM-تسمه-تایمینگ-م-GENERIC--D8M-484','excel-v2-1-1','انواع گام و کدهای تایمینگ','5M , 8M , 11M , 14M','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'taxonomy_gap'),
('PFAM-تسمه-تایمینگ-م-GENERIC--T10-036','excel-v2-1-1','انواع گام و کدهای تایمینگ','T5 , AT5 , AT10 , AT20','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'taxonomy_gap');

CREATE TEMP TABLE _belt_family_unassign (
  family_code text PRIMARY KEY,
  expected_category_slug text NOT NULL,
  expected_submenu_name text,
  expected_leaf_name text,
  reason text NOT NULL
) ON COMMIT DROP;
INSERT INTO _belt_family_unassign VALUES
('PFAM-تسمه-چندشیاری--AA-TOP-PJ-670','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','Poly-V has no approved independent Excel menu path; hold for taxonomy approval'),
('PFAM-تسمه-چندشیاری--AA-TOP-PJ-671','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','Poly-V has no approved independent Excel menu path; hold for taxonomy approval'),
('PFAM-تسمه-چندشیاری--AA-TOP-PK-198','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','Poly-V has no approved independent Excel menu path; hold for taxonomy approval'),
('PFAM-تسمه-چندشیاری--DONGIL-PK-197','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','Poly-V has no approved independent Excel menu path; hold for taxonomy approval'),
('PFAM-تسمه-چندشیاری--GENERIC--PJ-265','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','Poly-V has no approved independent Excel menu path; hold for taxonomy approval'),
('PFAM-تسمه-چندشیاری--GENERIC--PK-095','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','Poly-V has no approved independent Excel menu path; hold for taxonomy approval'),
('PFAM-تسمه-چندشیاری--GENERIC--PL-294','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','Poly-V has no approved independent Excel menu path; hold for taxonomy approval'),
('PFAM-تسمه-چندشیاری--MARSHAL-PJ-672','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','Poly-V has no approved independent Excel menu path; hold for taxonomy approval'),
('PFAM-تسمه-چندشیاری--MEGADYNE-PJ-332','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','Poly-V has no approved independent Excel menu path; hold for taxonomy approval'),
('PFAM-تسمه-چندشیاری--OPTIBELT-PJ-118','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','Poly-V has no approved independent Excel menu path; hold for taxonomy approval'),
('PFAM-تسمه-چندشیاری--OPTIBELT-PJ-669','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','Poly-V has no approved independent Excel menu path; hold for taxonomy approval'),
('PFAM-تسمه-چندشیاری--OPTIBELT-PK-266','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','Poly-V has no approved independent Excel menu path; hold for taxonomy approval'),
('PFAM-تسمه-چندشیاری--OPTIBELT-PL-668','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','Poly-V has no approved independent Excel menu path; hold for taxonomy approval'),
('PFAM-تسمه-چندشیاری--POWER-PJ-400','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','Poly-V has no approved independent Excel menu path; hold for taxonomy approval'),
('PFAM-تسمه-چندشیاری--POWER-PJ-495','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','Poly-V has no approved independent Excel menu path; hold for taxonomy approval'),
('PFAM-تسمه-جوشی-V-رو-FORZA-A-633','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','Welded PU trapezoidal/V sections have no approved flat-belt or V-belt leaf'),
('PFAM-تسمه-جوشی-V-رو-FORZA-B-634','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','Welded PU trapezoidal/V sections have no approved flat-belt or V-belt leaf'),
('PFAM-تسمه-جوشی-V-رو-FORZA-B-636','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','Welded PU trapezoidal/V sections have no approved flat-belt or V-belt leaf'),
('PFAM-تسمه-جوشی-V-رو-FORZA-C-637','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','Welded PU trapezoidal/V sections have no approved flat-belt or V-belt leaf'),
('PFAM-تسمه-جوشی-V-رو-FORZA-C-638','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','Welded PU trapezoidal/V sections have no approved flat-belt or V-belt leaf'),
('PFAM-تسمه-جوشی-V-رو-T-B-B-635','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','Welded PU trapezoidal/V sections have no approved flat-belt or V-belt leaf'),
('PFAM-تسمه-جوشی-پلی--B-R-B-665','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','Welded PU trapezoidal/V sections have no approved flat-belt or V-belt leaf'),
('PFAM-تسمه-جوشی-پلی--FORZA-A-662','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','Welded PU trapezoidal/V sections have no approved flat-belt or V-belt leaf'),
('PFAM-تسمه-جوشی-پلی--FORZA-A-663','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','Welded PU trapezoidal/V sections have no approved flat-belt or V-belt leaf'),
('PFAM-تسمه-جوشی-پلی--FORZA-B-491','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','Welded PU trapezoidal/V sections have no approved flat-belt or V-belt leaf'),
('PFAM-تسمه-جوشی-پلی--FORZA-B-666','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','Welded PU trapezoidal/V sections have no approved flat-belt or V-belt leaf'),
('PFAM-تسمه-جوشی-پلی--FORZA-C-494','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','Welded PU trapezoidal/V sections have no approved flat-belt or V-belt leaf'),
('PFAM-تسمه-جوشی-پلی--FORZA-C-667','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','Welded PU trapezoidal/V sections have no approved flat-belt or V-belt leaf'),
('PFAM-تسمه-جوشی-پلی--GENERIC--B-397','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','Welded PU trapezoidal/V sections have no approved flat-belt or V-belt leaf'),
('PFAM-تسمه-جوشی-پلی--GENERIC--B-398','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','Welded PU trapezoidal/V sections have no approved flat-belt or V-belt leaf'),
('PFAM-تسمه-جوشی-پلی--GENERIC--C-399','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','Welded PU trapezoidal/V sections have no approved flat-belt or V-belt leaf'),
('PFAM-تسمه-جوشی-پلی--GENERIC--C-493','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','Welded PU trapezoidal/V sections have no approved flat-belt or V-belt leaf'),
('PFAM-تسمه-جوشی-پلی--VOLTA-B-664','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','Welded PU trapezoidal/V sections have no approved flat-belt or V-belt leaf'),
('PFAM-تسمه-V-شکل-پرو-GENERIC--AA-658','excel-v2-1-2',NULL,NULL,'AA/BB hexagonal and K profiles lack an approved Excel submenu'),
('PFAM-تسمه-V-شکل-پرو-GENERIC--K-659','excel-v2-1-2',NULL,NULL,'AA/BB hexagonal and K profiles lack an approved Excel submenu'),
('PFAM-تسمه-V-شکل-پرو-SWR-AA-652','excel-v2-1-2',NULL,NULL,'AA/BB hexagonal and K profiles lack an approved Excel submenu'),
('PFAM-تسمه-V-شکل-پرو-SWR-K-396','excel-v2-1-2',NULL,NULL,'AA/BB hexagonal and K profiles lack an approved Excel submenu'),
('PFAM-تسمه-تایمینگ-د-OPTIBELT-AUTO-RU-222','excel-v2-1-1','انواع گام و کدهای تایمینگ','5M , 8M , 11M , 14M','AUTO-RU is automotive/industrial-vehicle timing, not the approved industrial timing menu');

CREATE TEMP TABLE _belt_direct_updates (
  sku_code text PRIMARY KEY,
  expected_category_slug text NOT NULL,
  expected_submenu text,
  expected_subcategory text,
  check_subcategory boolean NOT NULL,
  new_category_slug text NOT NULL,
  new_submenu text NOT NULL,
  new_subcategory text NOT NULL,
  reason text NOT NULL
) ON COMMIT DROP;
INSERT INTO _belt_direct_updates VALUES
('31997','excel-v2-1-3','تسمه گرد (CRC)','انواع تسمه گرد جوشی','true','excel-v2-1-4','تسمه بارکش','انواع تسمه بارکش صنعتی','Crowned CRC/TRC is a conveyor/hauling belt, not a welded PU round belt'),
('41738','excel-v2-1-1','سیم‌دار فابریک','APL دار','true','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','Wrapped rubber V-belt profile XPC belongs to the special V-belt family'),
('10009','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'false','excel-v2-1-1','انواع گام و کدهای تایمینگ','','Double-sided timing profile has no matching single-sided pitch leaf'),
('10036','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'false','excel-v2-1-1','انواع گام و کدهای تایمینگ','','Double-sided timing profile has no matching single-sided pitch leaf'),
('10291','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'false','excel-v2-1-1','انواع گام و کدهای تایمینگ','','Double-sided timing profile has no matching single-sided pitch leaf'),
('145022','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'false','excel-v2-1-1','انواع گام و کدهای تایمینگ','','Double-sided timing profile has no matching single-sided pitch leaf'),
('34905','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'false','excel-v2-1-1','انواع گام و کدهای تایمینگ','','Double-sided timing profile has no matching single-sided pitch leaf'),
('38264','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'false','excel-v2-1-1','انواع گام و کدهای تایمینگ','','Double-sided timing profile has no matching single-sided pitch leaf'),
('39897','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'false','excel-v2-1-1','انواع گام و کدهای تایمینگ','','Double-sided timing profile has no matching single-sided pitch leaf'),
('41554','excel-v2-1-1','انواع گام و کدهای تایمینگ',NULL,'false','excel-v2-1-1','انواع گام و کدهای تایمینگ','','Double-sided timing profile has no matching single-sided pitch leaf'),
('27843','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','true','excel-v2-1-2','تسمه اسپشیال','','Profile is valid in the special V-belt submenu but absent from the approved leaf label'),
('27850','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','true','excel-v2-1-2','تسمه اسپشیال','','Profile is valid in the special V-belt submenu but absent from the approved leaf label'),
('33969','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','true','excel-v2-1-2','تسمه اسپشیال','','Profile is valid in the special V-belt submenu but absent from the approved leaf label'),
('37496','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','true','excel-v2-1-2','تسمه اسپشیال','','Profile is valid in the special V-belt submenu but absent from the approved leaf label'),
('37985','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','true','excel-v2-1-2','تسمه اسپشیال','','Profile is valid in the special V-belt submenu but absent from the approved leaf label'),
('38974','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','true','excel-v2-1-2','تسمه اسپشیال','','Profile is valid in the special V-belt submenu but absent from the approved leaf label'),
('39183','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','true','excel-v2-1-2','تسمه اسپشیال','','Profile is valid in the special V-belt submenu but absent from the approved leaf label'),
('41253','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','true','excel-v2-1-2','تسمه اسپشیال','','Profile is valid in the special V-belt submenu but absent from the approved leaf label'),
('10410','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('10553','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('31845','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('32072','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('32328','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('33838','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('33839','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('33840','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('34078','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('34774','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('35361','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('35623','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('37221','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('37819','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('37820','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('37840','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('37894','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('38333','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('38334','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('38338','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('38340','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('38756','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('38786','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('39859','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('39986','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('40003','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('41297','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('41717','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('41809','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('41810','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('41811','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('41812','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('41857','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('51279','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('52640','excel-v2-1-3','تسمه فلت','انواع تسمه تخت و فلت','true','UNRESOLVED','','','Welded PU trapezoidal/V section has no approved Excel submenu; keep active but out of belt menu'),
('10264','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','true','UNRESOLVED','','','Poly-V is a distinct ribbed-belt family without an approved Excel leaf'),
('31758','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','true','UNRESOLVED','','','Poly-V is a distinct ribbed-belt family without an approved Excel leaf'),
('37621','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','true','UNRESOLVED','','','Poly-V is a distinct ribbed-belt family without an approved Excel leaf'),
('37731','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','true','UNRESOLVED','','','Poly-V is a distinct ribbed-belt family without an approved Excel leaf'),
('38075','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','true','UNRESOLVED','','','Poly-V is a distinct ribbed-belt family without an approved Excel leaf'),
('41278','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','true','UNRESOLVED','','','Poly-V is a distinct ribbed-belt family without an approved Excel leaf'),
('41807','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','true','UNRESOLVED','','','Poly-V is a distinct ribbed-belt family without an approved Excel leaf'),
('41814','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','true','UNRESOLVED','','','Poly-V is a distinct ribbed-belt family without an approved Excel leaf'),
('58129','excel-v2-1-2','تسمه اسپشیال','SPA , SPB , SPC و دندانه‌دار','true','UNRESOLVED','','','Poly-V is a distinct ribbed-belt family without an approved Excel leaf'),
('35236','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','true','UNRESOLVED','','','Hexagonal BB profile has no approved Excel submenu'),
('38510','excel-v2-1-2','وی‌بلت متری','تسمه A و B و C وی‌بلت متری','true','UNRESOLVED','','','Hexagonal BB profile has no approved Excel submenu'),
('35023','excel-v2-1-1','','','true','UNRESOLVED','','','AUTO-RU is automotive/industrial-vehicle timing, not the approved industrial timing menu'),
('42209','excel-v2-1-1','','','true','UNRESOLVED','','','AUTO-RU is automotive/industrial-vehicle timing, not the approved industrial timing menu'),
('32711','excel-v2-1-1','سیم‌دار فابریک','پلی‌یورتان','true','UNRESOLVED','','','These are a timing tensioner, belt scraper, scraper blade and metal strip—not belt products'),
('34975','excel-v2-1-1','سیم‌دار فابریک','پلی‌یورتان','true','UNRESOLVED','','','These are a timing tensioner, belt scraper, scraper blade and metal strip—not belt products'),
('35712','excel-v2-1-1','سیم‌دار فابریک','پلی‌یورتان','true','UNRESOLVED','','','These are a timing tensioner, belt scraper, scraper blade and metal strip—not belt products'),
('41169','excel-v2-1-1','سیم‌دار فابریک','پلی‌یورتان','true','UNRESOLVED','','','These are a timing tensioner, belt scraper, scraper blade and metal strip—not belt products');

-- Fail closed if the live data no longer matches the audited source paths.
DO $$
DECLARE bad_codes text;
BEGIN
  SELECT string_agg(m.family_code, ', ' ORDER BY m.family_code)
    INTO bad_codes
  FROM _belt_family_updates m
  LEFT JOIN public.catalog_family_menu_assignments a ON a.family_code=m.family_code
  WHERE a.family_code IS NULL
     OR a.category_slug IS DISTINCT FROM m.expected_category_slug
     OR a.submenu_name IS DISTINCT FROM m.expected_submenu_name
     OR a.leaf_name IS DISTINCT FROM m.expected_leaf_name;
  IF bad_codes IS NOT NULL THEN
    RAISE EXCEPTION 'Belt family update preflight failed; unexpected current path for: %', bad_codes;
  END IF;

  SELECT string_agg(m.family_code, ', ' ORDER BY m.family_code)
    INTO bad_codes
  FROM _belt_family_unassign m
  LEFT JOIN public.catalog_family_menu_assignments a ON a.family_code=m.family_code
  WHERE a.family_code IS NULL
     OR a.category_slug IS DISTINCT FROM m.expected_category_slug
     OR a.submenu_name IS DISTINCT FROM m.expected_submenu_name
     OR a.leaf_name IS DISTINCT FROM m.expected_leaf_name;
  IF bad_codes IS NOT NULL THEN
    RAISE EXCEPTION 'Belt family unassign preflight failed; unexpected current path for: %', bad_codes;
  END IF;

  SELECT string_agg(m.sku_code, ', ' ORDER BY m.sku_code)
    INTO bad_codes
  FROM _belt_direct_updates m
  LEFT JOIN public.catalog_direct_skus d ON d.sku_code=m.sku_code AND d.is_active=true
  WHERE d.sku_code IS NULL
     OR d.category_slug IS DISTINCT FROM m.expected_category_slug
     OR d.submenu IS DISTINCT FROM m.expected_submenu
     OR (m.check_subcategory AND d.subcategory IS DISTINCT FROM m.expected_subcategory);
  IF bad_codes IS NOT NULL THEN
    RAISE EXCEPTION 'Belt direct-SKU preflight failed; unexpected current path for: %', bad_codes;
  END IF;

  IF EXISTS (
    SELECT 1 FROM _belt_family_updates m
    LEFT JOIN public.catalog_categories c ON c.slug=m.new_category_slug
    WHERE c.slug IS NULL
  ) THEN
    RAISE EXCEPTION 'A destination belt category does not exist; migration aborted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM _belt_direct_updates m
    LEFT JOIN public.catalog_categories c ON c.slug=m.new_category_slug
    WHERE m.new_category_slug <> 'UNRESOLVED' AND c.slug IS NULL
  ) THEN
    RAISE EXCEPTION 'A direct-SKU destination category does not exist; migration aborted';
  END IF;
END $$;

-- Row-level rollback material for every changed or unassigned mapping.
CREATE TABLE IF NOT EXISTS public.catalog_family_menu_assignments_belt_backup_20261116 (
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
CREATE TABLE IF NOT EXISTS public.catalog_direct_skus_belt_backup_20261116 (
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

INSERT INTO public.catalog_family_menu_assignments_belt_backup_20261116
  (family_code,category_slug,submenu_name,leaf_name,method,created_at,updated_at,backup_reason)
SELECT a.family_code,a.category_slug,a.submenu_name,a.leaf_name,a.method,a.created_at,a.updated_at,
       coalesce(m.reason,'engineering belt menu correction')
FROM public.catalog_family_menu_assignments a
LEFT JOIN _belt_family_unassign m ON m.family_code=a.family_code
WHERE a.family_code IN (SELECT family_code FROM _belt_family_updates)
   OR a.family_code IN (SELECT family_code FROM _belt_family_unassign)
ON CONFLICT (family_code) DO NOTHING;

INSERT INTO public.catalog_direct_skus_belt_backup_20261116
  (sku_code,category_slug,category_name,submenu,subcategory,technical_specs,updated_at,backup_reason)
SELECT d.sku_code,d.category_slug,d.category_name,d.submenu,d.subcategory,d.technical_specs,d.updated_at,m.reason
FROM public.catalog_direct_skus d
JOIN _belt_direct_updates m ON m.sku_code=d.sku_code
ON CONFLICT (sku_code) DO NOTHING;

-- Correct family-to-menu paths where an approved destination exists.
UPDATE public.catalog_family_menu_assignments a
SET category_slug=m.new_category_slug,
    submenu_name=m.new_submenu_name,
    leaf_name=m.new_leaf_name,
    method=m.new_method,
    updated_at=now()
FROM _belt_family_updates m
WHERE a.family_code=m.family_code;

-- Remove only the public menu mapping for families with no approved Excel path.
-- Their family records and all SKU variants remain active and recoverable.
DELETE FROM public.catalog_family_menu_assignments a
USING _belt_family_unassign m
WHERE a.family_code=m.family_code;

-- Correct direct-SKU menu paths or mark non-belt/unapproved records as unresolved.
UPDATE public.catalog_direct_skus d
SET category_slug=m.new_category_slug,
    category_name=CASE
      WHEN m.new_category_slug='UNRESOLVED' THEN 'نیازمند تعیین تکلیف'
      ELSE (SELECT c.name FROM public.catalog_categories c WHERE c.slug=m.new_category_slug)
    END,
    submenu=m.new_submenu,
    subcategory=m.new_subcategory,
    updated_at=now()
FROM _belt_direct_updates m
WHERE d.sku_code=m.sku_code;

COMMIT;

-- Postflight: review these counts before deploying the application.
SELECT jsonb_build_object(
  'family_menu_by_belt_category',(
    SELECT jsonb_agg(to_jsonb(x) ORDER BY category_slug)
    FROM (
      SELECT a.category_slug,count(*) families,sum(f.item_count) family_skus
      FROM public.catalog_family_menu_assignments a
      JOIN public.catalog_families f ON f.code=a.family_code
      WHERE a.category_slug LIKE 'excel-v2-1-%'
        AND f.is_active=true AND coalesce(f.is_deleted,false)=false
      GROUP BY a.category_slug
    ) x
  ),
  'direct_skus_by_belt_category',(
    SELECT jsonb_agg(to_jsonb(x) ORDER BY category_slug)
    FROM (
      SELECT category_slug,count(*) active_direct_skus
      FROM public.catalog_direct_skus
      WHERE is_active=true AND category_slug LIKE 'excel-v2-1-%'
      GROUP BY category_slug
    ) x
  ),
  'unassigned_active_belt_families',(
    SELECT count(*)
    FROM public.catalog_families f
    LEFT JOIN public.catalog_family_menu_assignments a ON a.family_code=f.code
    WHERE f.is_active=true AND coalesce(f.is_deleted,false)=false
      AND f.category_slug LIKE 'excel-v2-1-%' AND a.family_code IS NULL
  ),
  'unresolved_active_direct_skus',(
    SELECT count(*) FROM public.catalog_direct_skus
    WHERE is_active=true AND category_slug='UNRESOLVED'
  )
) AS belt_taxonomy_postflight;
