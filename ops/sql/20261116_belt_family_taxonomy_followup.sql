-- Follow-up engineering corrections from the full 373-family semantic guard audit.
-- 31 valid families receive approved parent/leaf paths; 22 families remain in the catalog but are quarantined from the belt menu.
-- No family or SKU is deleted.

begin;

do $$
begin
  if (select count(*) from public.catalog_families
      where code in ('PFAM-تسمه-تایمینگ-ذ-GENERIC--H-483', 'PFAM-تسمه-تایمینگ-م-FORZA-AT20-015', 'PFAM-تسمه-تایمینگ-م-FORZA-AT20-054', 'PFAM-تسمه-تایمینگ-م-GENERIC--AT10-468', 'PFAM-تسمه-تایمینگ-م-GENERIC--AT20-262', 'PFAM-تسمه-تایمینگ-م-GENERIC--AT20-632', 'PFAM-تسمه-تایمینگ-م-POWER-D8M-484', 'PFAM-تسمه-تایمینگ-ذ-BANDO-DH-287', 'PFAM-تسمه-تایمینگ-ذ-BANDO-DH-474', 'PFAM-تسمه-تایمینگ-ذ-BERAVO-DH-226', 'PFAM-تسمه-تایمینگ-ذ-BERAVO-DH-290', 'PFAM-تسمه-تایمینگ-ذ-GENERIC--DH-223', 'PFAM-تسمه-تایمینگ-ذ-GENERIC--DH-472', 'PFAM-تسمه-تایمینگ-ذ-GENERIC--DL-473', 'PFAM-تسمه-تایمینگ-ذ-MARSHAL-DH-087', 'PFAM-تسمه-تایمینگ-ذ-MARSHAL-DH-126', 'PFAM-تسمه-تایمینگ-ذ-MARSHAL-DL-650', 'PFAM-تسمه-تایمینگ-ذ-MEGADYNE-DH-289', 'PFAM-تسمه-تایمینگ-ذ-MEGADYNE-DH-329', 'PFAM-تسمه-تایمینگ-ذ-UNITECH-DH-258', 'PFAM-تسمه-تایمینگ-ذ-UNITECH-DH-326', 'PFAM-تسمه-جوشی-V-رو-GENERIC--B-050', 'PFAM-تسمه-جوشی-V-رو-GENERIC--C-108', 'PFAM-تسمه-V-شکل-پرو-GENERIC--MX-660', 'PFAM-تسمه-V-شکل-به--GENERIC--3VX-BANDED-641', 'PFAM-تسمه-V-شکل-به--SWR-3VX-BANDED-395', 'PFAM-تسمه-V-شکل-پرو-DONGIL-XPZ-594', 'PFAM-تسمه-V-شکل-پرو-GENERIC--SPZ-121', 'PFAM-تسمه-V-شکل-پرو-SWR-5V-489', 'PFAM-تسمه-V-شکل-پرو-SWR-SPZ-080', 'PFAM-تسمه-V-شکل-پرو-SWR-XPZ-105') and is_active=true and coalesce(is_deleted,false)=false) <> 31 then
    raise exception 'Belt follow-up precondition failed: expected 31 active mapped families';
  end if;
  if (select count(*) from public.catalog_families
      where code in ('PFAM-تسمه-صنعتی-GENERIC--تسمه-صنعتی-C-291', 'PFAM-دستگاه-صنعتی-GENERIC--دستگاه-صنعتی-576', 'PFAM-تسمه-V-شکل-پرو-SWR-AA-652', 'PFAM-تسمه-V-شکل-پرو-SWR-K-396', 'PFAM-تسمه-چندشیاری--AA-TOP-PJ-670', 'PFAM-تسمه-چندشیاری--AA-TOP-PJ-671', 'PFAM-تسمه-چندشیاری--AA-TOP-PK-198', 'PFAM-تسمه-چندشیاری--DONGIL-PK-197', 'PFAM-تسمه-چندشیاری--GENERIC--PJ-265', 'PFAM-تسمه-چندشیاری--GENERIC--PK-095', 'PFAM-تسمه-چندشیاری--GENERIC--PL-294', 'PFAM-تسمه-چندشیاری--MARSHAL-PJ-672', 'PFAM-تسمه-چندشیاری--MEGADYNE-PJ-332', 'PFAM-تسمه-چندشیاری--OPTIBELT-PJ-118', 'PFAM-تسمه-چندشیاری--OPTIBELT-PJ-669', 'PFAM-تسمه-چندشیاری--OPTIBELT-PK-266', 'PFAM-تسمه-چندشیاری--OPTIBELT-PL-668', 'PFAM-تسمه-چندشیاری--POWER-PJ-400', 'PFAM-تسمه-چندشیاری--POWER-PJ-495', 'PFAM-تسمه-V-شکل-پرو-GENERIC--AA-658', 'PFAM-تسمه-V-شکل-پرو-GENERIC--K-659', 'PFAM-تسمه-تایمینگ-د-OPTIBELT-AUTO-RU-222') and is_active=true and coalesce(is_deleted,false)=false) <> 22 then
    raise exception 'Belt follow-up precondition failed: expected 22 unresolved families';
  end if;
end $$;

with mapping(family_code,category_slug,category_name,submenu_name,leaf_name) as (
  values
  ('PFAM-تسمه-تایمینگ-ذ-GENERIC--H-483', 'excel-v2-1-1', 'تسمه تایمینگ', 'سیم‌دار فابریک', 'پلی‌یورتان'),
  ('PFAM-تسمه-تایمینگ-م-FORZA-AT20-015', 'excel-v2-1-1', 'تسمه تایمینگ', 'سیم‌دار فابریک', 'پلی‌یورتان'),
  ('PFAM-تسمه-تایمینگ-م-FORZA-AT20-054', 'excel-v2-1-1', 'تسمه تایمینگ', 'سیم‌دار فابریک', 'پلی‌یورتان'),
  ('PFAM-تسمه-تایمینگ-م-GENERIC--AT10-468', 'excel-v2-1-1', 'تسمه تایمینگ', 'سیم‌دار فابریک', 'پلی‌یورتان'),
  ('PFAM-تسمه-تایمینگ-م-GENERIC--AT20-262', 'excel-v2-1-1', 'تسمه تایمینگ', 'سیم‌دار فابریک', 'پلی‌یورتان'),
  ('PFAM-تسمه-تایمینگ-م-GENERIC--AT20-632', 'excel-v2-1-1', 'تسمه تایمینگ', 'سیم‌دار فابریک', 'پلی‌یورتان'),
  ('PFAM-تسمه-تایمینگ-م-POWER-D8M-484', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-BANDO-DH-287', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-BANDO-DH-474', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-BERAVO-DH-226', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-BERAVO-DH-290', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-GENERIC--DH-223', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-GENERIC--DH-472', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-GENERIC--DL-473', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-MARSHAL-DH-087', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-MARSHAL-DH-126', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-MARSHAL-DL-650', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-MEGADYNE-DH-289', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-MEGADYNE-DH-329', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-UNITECH-DH-258', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-UNITECH-DH-326', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-جوشی-V-رو-GENERIC--B-050', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-جوشی-V-رو-GENERIC--C-108', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-V-شکل-پرو-GENERIC--MX-660', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', null),
  ('PFAM-تسمه-V-شکل-به--GENERIC--3VX-BANDED-641', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'تسمه اسپشیال', null),
  ('PFAM-تسمه-V-شکل-به--SWR-3VX-BANDED-395', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'تسمه اسپشیال', null),
  ('PFAM-تسمه-V-شکل-پرو-DONGIL-XPZ-594', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'تسمه اسپشیال', null),
  ('PFAM-تسمه-V-شکل-پرو-GENERIC--SPZ-121', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'تسمه اسپشیال', null),
  ('PFAM-تسمه-V-شکل-پرو-SWR-5V-489', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'تسمه اسپشیال', null),
  ('PFAM-تسمه-V-شکل-پرو-SWR-SPZ-080', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'تسمه اسپشیال', null),
  ('PFAM-تسمه-V-شکل-پرو-SWR-XPZ-105', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'تسمه اسپشیال', null)
)
update public.catalog_family_menu_assignments a
set category_slug=m.category_slug,
    submenu_name=m.submenu_name,
    leaf_name=m.leaf_name,
    method='engineering_audited',
    updated_at=now()
from mapping m
where a.family_code=m.family_code;

with mapping(family_code,category_slug,category_name,submenu_name,leaf_name) as (
  values
  ('PFAM-تسمه-تایمینگ-ذ-GENERIC--H-483', 'excel-v2-1-1', 'تسمه تایمینگ', 'سیم‌دار فابریک', 'پلی‌یورتان'),
  ('PFAM-تسمه-تایمینگ-م-FORZA-AT20-015', 'excel-v2-1-1', 'تسمه تایمینگ', 'سیم‌دار فابریک', 'پلی‌یورتان'),
  ('PFAM-تسمه-تایمینگ-م-FORZA-AT20-054', 'excel-v2-1-1', 'تسمه تایمینگ', 'سیم‌دار فابریک', 'پلی‌یورتان'),
  ('PFAM-تسمه-تایمینگ-م-GENERIC--AT10-468', 'excel-v2-1-1', 'تسمه تایمینگ', 'سیم‌دار فابریک', 'پلی‌یورتان'),
  ('PFAM-تسمه-تایمینگ-م-GENERIC--AT20-262', 'excel-v2-1-1', 'تسمه تایمینگ', 'سیم‌دار فابریک', 'پلی‌یورتان'),
  ('PFAM-تسمه-تایمینگ-م-GENERIC--AT20-632', 'excel-v2-1-1', 'تسمه تایمینگ', 'سیم‌دار فابریک', 'پلی‌یورتان'),
  ('PFAM-تسمه-تایمینگ-م-POWER-D8M-484', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-BANDO-DH-287', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-BANDO-DH-474', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-BERAVO-DH-226', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-BERAVO-DH-290', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-GENERIC--DH-223', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-GENERIC--DH-472', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-GENERIC--DL-473', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-MARSHAL-DH-087', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-MARSHAL-DH-126', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-MARSHAL-DL-650', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-MEGADYNE-DH-289', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-MEGADYNE-DH-329', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-UNITECH-DH-258', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-تایمینگ-ذ-UNITECH-DH-326', 'excel-v2-1-1', 'تسمه تایمینگ', 'انواع گام و کدهای تایمینگ', null),
  ('PFAM-تسمه-جوشی-V-رو-GENERIC--B-050', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-جوشی-V-رو-GENERIC--C-108', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-V-شکل-پرو-GENERIC--MX-660', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', null),
  ('PFAM-تسمه-V-شکل-به--GENERIC--3VX-BANDED-641', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'تسمه اسپشیال', null),
  ('PFAM-تسمه-V-شکل-به--SWR-3VX-BANDED-395', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'تسمه اسپشیال', null),
  ('PFAM-تسمه-V-شکل-پرو-DONGIL-XPZ-594', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'تسمه اسپشیال', null),
  ('PFAM-تسمه-V-شکل-پرو-GENERIC--SPZ-121', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'تسمه اسپشیال', null),
  ('PFAM-تسمه-V-شکل-پرو-SWR-5V-489', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'تسمه اسپشیال', null),
  ('PFAM-تسمه-V-شکل-پرو-SWR-SPZ-080', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'تسمه اسپشیال', null),
  ('PFAM-تسمه-V-شکل-پرو-SWR-XPZ-105', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'تسمه اسپشیال', null)
)
update public.catalog_families f
set category_slug=m.category_slug,
    category_name=m.category_name,
    submenu=m.submenu_name,
    subcategory=m.leaf_name,
    updated_at=now()
from mapping m
where f.code=m.family_code;

-- These are valid catalog records but lack an approved Excel leaf, or are not industrial belt products.
delete from public.catalog_family_menu_assignments
where family_code in ('PFAM-تسمه-صنعتی-GENERIC--تسمه-صنعتی-C-291', 'PFAM-دستگاه-صنعتی-GENERIC--دستگاه-صنعتی-576', 'PFAM-تسمه-V-شکل-پرو-SWR-AA-652', 'PFAM-تسمه-V-شکل-پرو-SWR-K-396', 'PFAM-تسمه-چندشیاری--AA-TOP-PJ-670', 'PFAM-تسمه-چندشیاری--AA-TOP-PJ-671', 'PFAM-تسمه-چندشیاری--AA-TOP-PK-198', 'PFAM-تسمه-چندشیاری--DONGIL-PK-197', 'PFAM-تسمه-چندشیاری--GENERIC--PJ-265', 'PFAM-تسمه-چندشیاری--GENERIC--PK-095', 'PFAM-تسمه-چندشیاری--GENERIC--PL-294', 'PFAM-تسمه-چندشیاری--MARSHAL-PJ-672', 'PFAM-تسمه-چندشیاری--MEGADYNE-PJ-332', 'PFAM-تسمه-چندشیاری--OPTIBELT-PJ-118', 'PFAM-تسمه-چندشیاری--OPTIBELT-PJ-669', 'PFAM-تسمه-چندشیاری--OPTIBELT-PK-266', 'PFAM-تسمه-چندشیاری--OPTIBELT-PL-668', 'PFAM-تسمه-چندشیاری--POWER-PJ-400', 'PFAM-تسمه-چندشیاری--POWER-PJ-495', 'PFAM-تسمه-V-شکل-پرو-GENERIC--AA-658', 'PFAM-تسمه-V-شکل-پرو-GENERIC--K-659', 'PFAM-تسمه-تایمینگ-د-OPTIBELT-AUTO-RU-222');

update public.catalog_families
set category_slug='UNRESOLVED',
    category_name='نیازمند تعیین تکلیف',
    submenu=null,
    subcategory=null,
    updated_at=now()
where code in ('PFAM-تسمه-صنعتی-GENERIC--تسمه-صنعتی-C-291', 'PFAM-دستگاه-صنعتی-GENERIC--دستگاه-صنعتی-576', 'PFAM-تسمه-V-شکل-پرو-SWR-AA-652', 'PFAM-تسمه-V-شکل-پرو-SWR-K-396', 'PFAM-تسمه-چندشیاری--AA-TOP-PJ-670', 'PFAM-تسمه-چندشیاری--AA-TOP-PJ-671', 'PFAM-تسمه-چندشیاری--AA-TOP-PK-198', 'PFAM-تسمه-چندشیاری--DONGIL-PK-197', 'PFAM-تسمه-چندشیاری--GENERIC--PJ-265', 'PFAM-تسمه-چندشیاری--GENERIC--PK-095', 'PFAM-تسمه-چندشیاری--GENERIC--PL-294', 'PFAM-تسمه-چندشیاری--MARSHAL-PJ-672', 'PFAM-تسمه-چندشیاری--MEGADYNE-PJ-332', 'PFAM-تسمه-چندشیاری--OPTIBELT-PJ-118', 'PFAM-تسمه-چندشیاری--OPTIBELT-PJ-669', 'PFAM-تسمه-چندشیاری--OPTIBELT-PK-266', 'PFAM-تسمه-چندشیاری--OPTIBELT-PL-668', 'PFAM-تسمه-چندشیاری--POWER-PJ-400', 'PFAM-تسمه-چندشیاری--POWER-PJ-495', 'PFAM-تسمه-V-شکل-پرو-GENERIC--AA-658', 'PFAM-تسمه-V-شکل-پرو-GENERIC--K-659', 'PFAM-تسمه-تایمینگ-د-OPTIBELT-AUTO-RU-222');

-- Direct SKU: XPC is a narrow V-belt, not a timing APL belt.
update public.catalog_direct_skus
set category_slug='excel-v2-1-2',
    category_name='تسمه وی‌بلت (V-Belt)',
    submenu='تسمه اسپشیال',
    subcategory='SPA , SPB , SPC و دندانه‌دار',
    updated_at=now()
where sku_code='41738' and is_active=true;

-- Direct double-sided timing profiles have a valid parent submenu but no exact approved leaf.
update public.catalog_direct_skus
set submenu='انواع گام و کدهای تایمینگ',
    subcategory='',
    updated_at=now()
where sku_code in ('10009','10036','10291','145022','34905','38264','39897','41554')
  and is_active=true;

-- SPZ/XPZ/3V/3VX/5V direct profiles stay under the special submenu, without a false SPA/SPB/SPC leaf.
update public.catalog_direct_skus
set submenu='تسمه اسپشیال',
    subcategory='',
    updated_at=now()
where sku_code in ('27843','27850','33969','37496','37985','38974','39183','41253')
  and is_active=true;

-- These direct SKUs have no approved industrial belt menu category/leaf.
update public.catalog_direct_skus
set category_slug='UNRESOLVED',
    category_name='نیازمند تعیین تکلیف',
    submenu='',
    subcategory='',
    updated_at=now()
where sku_code in (
  '34975','35712','41169',
  '35023','42209',
  '10264','31758','37621','37731','38075','41278','41807','41814','58129',
  '35236','38510'
) and is_active=true;

-- BRB is a distinct weldable profile with no approved menu leaf; keep the two direct SKUs searchable but unassigned.
with brb as (
  select s.sku_code,
    max(x.value) filter(where x.key='پروفیل / مدل') as profile
  from public.catalog_direct_skus s
  left join lateral jsonb_to_recordset(s.technical_specs) as x(key text,value text) on true
  where s.is_active=true and s.category_slug='excel-v2-1-3'
  group by s.sku_code
)
update public.catalog_direct_skus s
set category_slug='UNRESOLVED',
    category_name='نیازمند تعیین تکلیف',
    submenu='',
    subcategory='',
    updated_at=now()
from brb
where s.sku_code=brb.sku_code and brb.profile='BRB';

do $$
begin
  if (select count(*) from public.catalog_family_menu_assignments
      where family_code in ('PFAM-تسمه-تایمینگ-ذ-GENERIC--H-483', 'PFAM-تسمه-تایمینگ-م-FORZA-AT20-015', 'PFAM-تسمه-تایمینگ-م-FORZA-AT20-054', 'PFAM-تسمه-تایمینگ-م-GENERIC--AT10-468', 'PFAM-تسمه-تایمینگ-م-GENERIC--AT20-262', 'PFAM-تسمه-تایمینگ-م-GENERIC--AT20-632', 'PFAM-تسمه-تایمینگ-م-POWER-D8M-484', 'PFAM-تسمه-تایمینگ-ذ-BANDO-DH-287', 'PFAM-تسمه-تایمینگ-ذ-BANDO-DH-474', 'PFAM-تسمه-تایمینگ-ذ-BERAVO-DH-226', 'PFAM-تسمه-تایمینگ-ذ-BERAVO-DH-290', 'PFAM-تسمه-تایمینگ-ذ-GENERIC--DH-223', 'PFAM-تسمه-تایمینگ-ذ-GENERIC--DH-472', 'PFAM-تسمه-تایمینگ-ذ-GENERIC--DL-473', 'PFAM-تسمه-تایمینگ-ذ-MARSHAL-DH-087', 'PFAM-تسمه-تایمینگ-ذ-MARSHAL-DH-126', 'PFAM-تسمه-تایمینگ-ذ-MARSHAL-DL-650', 'PFAM-تسمه-تایمینگ-ذ-MEGADYNE-DH-289', 'PFAM-تسمه-تایمینگ-ذ-MEGADYNE-DH-329', 'PFAM-تسمه-تایمینگ-ذ-UNITECH-DH-258', 'PFAM-تسمه-تایمینگ-ذ-UNITECH-DH-326', 'PFAM-تسمه-جوشی-V-رو-GENERIC--B-050', 'PFAM-تسمه-جوشی-V-رو-GENERIC--C-108', 'PFAM-تسمه-V-شکل-پرو-GENERIC--MX-660', 'PFAM-تسمه-V-شکل-به--GENERIC--3VX-BANDED-641', 'PFAM-تسمه-V-شکل-به--SWR-3VX-BANDED-395', 'PFAM-تسمه-V-شکل-پرو-DONGIL-XPZ-594', 'PFAM-تسمه-V-شکل-پرو-GENERIC--SPZ-121', 'PFAM-تسمه-V-شکل-پرو-SWR-5V-489', 'PFAM-تسمه-V-شکل-پرو-SWR-SPZ-080', 'PFAM-تسمه-V-شکل-پرو-SWR-XPZ-105') and method='engineering_audited') <> 31 then
    raise exception 'Belt follow-up postcondition failed: mapped family count mismatch';
  end if;
  if exists (select 1 from public.catalog_family_menu_assignments where family_code in ('PFAM-تسمه-صنعتی-GENERIC--تسمه-صنعتی-C-291', 'PFAM-دستگاه-صنعتی-GENERIC--دستگاه-صنعتی-576', 'PFAM-تسمه-V-شکل-پرو-SWR-AA-652', 'PFAM-تسمه-V-شکل-پرو-SWR-K-396', 'PFAM-تسمه-چندشیاری--AA-TOP-PJ-670', 'PFAM-تسمه-چندشیاری--AA-TOP-PJ-671', 'PFAM-تسمه-چندشیاری--AA-TOP-PK-198', 'PFAM-تسمه-چندشیاری--DONGIL-PK-197', 'PFAM-تسمه-چندشیاری--GENERIC--PJ-265', 'PFAM-تسمه-چندشیاری--GENERIC--PK-095', 'PFAM-تسمه-چندشیاری--GENERIC--PL-294', 'PFAM-تسمه-چندشیاری--MARSHAL-PJ-672', 'PFAM-تسمه-چندشیاری--MEGADYNE-PJ-332', 'PFAM-تسمه-چندشیاری--OPTIBELT-PJ-118', 'PFAM-تسمه-چندشیاری--OPTIBELT-PJ-669', 'PFAM-تسمه-چندشیاری--OPTIBELT-PK-266', 'PFAM-تسمه-چندشیاری--OPTIBELT-PL-668', 'PFAM-تسمه-چندشیاری--POWER-PJ-400', 'PFAM-تسمه-چندشیاری--POWER-PJ-495', 'PFAM-تسمه-V-شکل-پرو-GENERIC--AA-658', 'PFAM-تسمه-V-شکل-پرو-GENERIC--K-659', 'PFAM-تسمه-تایمینگ-د-OPTIBELT-AUTO-RU-222')) then
    raise exception 'Belt follow-up postcondition failed: unresolved families still have menu assignments';
  end if;
  if (select count(*) from public.catalog_families where code in ('PFAM-تسمه-صنعتی-GENERIC--تسمه-صنعتی-C-291', 'PFAM-دستگاه-صنعتی-GENERIC--دستگاه-صنعتی-576', 'PFAM-تسمه-V-شکل-پرو-SWR-AA-652', 'PFAM-تسمه-V-شکل-پرو-SWR-K-396', 'PFAM-تسمه-چندشیاری--AA-TOP-PJ-670', 'PFAM-تسمه-چندشیاری--AA-TOP-PJ-671', 'PFAM-تسمه-چندشیاری--AA-TOP-PK-198', 'PFAM-تسمه-چندشیاری--DONGIL-PK-197', 'PFAM-تسمه-چندشیاری--GENERIC--PJ-265', 'PFAM-تسمه-چندشیاری--GENERIC--PK-095', 'PFAM-تسمه-چندشیاری--GENERIC--PL-294', 'PFAM-تسمه-چندشیاری--MARSHAL-PJ-672', 'PFAM-تسمه-چندشیاری--MEGADYNE-PJ-332', 'PFAM-تسمه-چندشیاری--OPTIBELT-PJ-118', 'PFAM-تسمه-چندشیاری--OPTIBELT-PJ-669', 'PFAM-تسمه-چندشیاری--OPTIBELT-PK-266', 'PFAM-تسمه-چندشیاری--OPTIBELT-PL-668', 'PFAM-تسمه-چندشیاری--POWER-PJ-400', 'PFAM-تسمه-چندشیاری--POWER-PJ-495', 'PFAM-تسمه-V-شکل-پرو-GENERIC--AA-658', 'PFAM-تسمه-V-شکل-پرو-GENERIC--K-659', 'PFAM-تسمه-تایمینگ-د-OPTIBELT-AUTO-RU-222') and category_slug='UNRESOLVED') <> 22 then
    raise exception 'Belt follow-up postcondition failed: unresolved family quarantine mismatch';
  end if;
  if not exists (select 1 from public.catalog_direct_skus where sku_code='41738' and category_slug='excel-v2-1-2' and submenu='تسمه اسپشیال' and subcategory='SPA , SPB , SPC و دندانه‌دار') then
    raise exception 'Belt follow-up postcondition failed: XPC direct V-belt not moved';
  end if;
  if (select count(*) from public.catalog_direct_skus where sku_code in ('10009','10036','10291','145022','34905','38264','39897','41554') and submenu='انواع گام و کدهای تایمینگ' and subcategory='') <> 8 then
    raise exception 'Belt follow-up postcondition failed: double-sided timing direct SKUs not parent-only';
  end if;
  if (select count(*) from public.catalog_direct_skus where sku_code in ('27843','27850','33969','37496','37985','38974','39183','41253') and submenu='تسمه اسپشیال' and subcategory='') <> 8 then
    raise exception 'Belt follow-up postcondition failed: special V direct SKUs not parent-only';
  end if;
  if (select count(*) from public.catalog_direct_skus where category_slug='UNRESOLVED' and sku_code in (
    '34975','35712','41169','35023','42209','10264','31758','37621','37731','38075','41278','41807','41814','58129','35236','38510'
  )) <> 16 then
    raise exception 'Belt follow-up postcondition failed: direct SKU quarantine mismatch';
  end if;
  if (select count(*) from public.catalog_direct_skus s
      left join lateral jsonb_to_recordset(s.technical_specs) as x(key text,value text) on true
      where s.is_active=true and s.category_slug='UNRESOLVED' and x.key='پروفیل / مدل' and x.value='BRB') <> 2 then
    raise exception 'Belt follow-up postcondition failed: BRB direct SKUs not quarantined';
  end if;
end $$;

commit;
