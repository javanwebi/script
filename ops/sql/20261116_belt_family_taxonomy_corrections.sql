-- Sanat Pish: engineering-audited industrial belt family and direct-SKU taxonomy corrections.
-- Scope: only taxonomy paths are changed. No family, SKU, technical specification, image or price row is deleted.
-- Families with no approved Excel leaf (AA, K, AUTO-RU) are deliberately kept in the catalog without a menu assignment.

begin;

do $$
begin
  if (select count(*) from public.catalog_families where code in ('PFAM-تسمه-V-شکل-پرو-GENERIC--M-051', 'PFAM-تسمه-V-شکل-پرو-GENERIC--MX-660', 'PFAM-تسمه-V-شکل-پرو-GENERIC--Z-045', 'PFAM-تسمه-V-شکل-پرو-GENERIC--ZX-109', 'PFAM-تسمه-V-شکل-پرو-HANKOOK-Z-657', 'PFAM-تسمه-V-شکل-پرو-REFLEX-Z-656', 'PFAM-تسمه-تایمینگ-م-GENERIC--T10-036', 'PFAM-تسمه-تایمینگ-م-POWER-3M-470', 'PFAM-تسمه-تایمینگ-م-POWER-3M-621', 'PFAM-تسمه-جوشی-V-رو-FORZA-A-633', 'PFAM-تسمه-جوشی-V-رو-FORZA-B-634', 'PFAM-تسمه-جوشی-V-رو-FORZA-B-636', 'PFAM-تسمه-جوشی-V-رو-FORZA-C-637', 'PFAM-تسمه-جوشی-V-رو-FORZA-C-638', 'PFAM-تسمه-جوشی-V-رو-T-B-B-635', 'PFAM-تسمه-جوشی-پلی--B-R-B-665', 'PFAM-تسمه-جوشی-پلی--FORZA-A-662', 'PFAM-تسمه-جوشی-پلی--FORZA-A-663', 'PFAM-تسمه-جوشی-پلی--FORZA-B-491', 'PFAM-تسمه-جوشی-پلی--FORZA-B-666', 'PFAM-تسمه-جوشی-پلی--FORZA-C-494', 'PFAM-تسمه-جوشی-پلی--FORZA-C-667', 'PFAM-تسمه-جوشی-پلی--GENERIC--B-397', 'PFAM-تسمه-جوشی-پلی--GENERIC--B-398', 'PFAM-تسمه-جوشی-پلی--GENERIC--C-399', 'PFAM-تسمه-جوشی-پلی--GENERIC--C-493', 'PFAM-تسمه-جوشی-پلی--VOLTA-B-664', 'PFAM-تسمه-ذوزنقه-ای-GENERIC--CRC-046', 'PFAM-تسمه-ذوزنقه-ای-GENERIC--TRC-653', 'PFAM-تسمه-ذوزنقه-ای-GNR-CRC-168', 'PFAM-تسمه-ذوزنقه-ای-MEGADYNE-CRC-107', 'PFAM-تسمه-ذوزنقه-ای-SWR-CRC-097') and is_active=true and coalesce(is_deleted,false)=false) <> 32 then
    raise exception 'Belt taxonomy precondition failed: expected 32 active target families';
  end if;
end $$;

with mapping(family_code,category_slug,category_name,submenu_name,leaf_name) as (
  values
  ('PFAM-تسمه-V-شکل-پرو-GENERIC--M-051', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-V-شکل-پرو-GENERIC--MX-660', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-V-شکل-پرو-GENERIC--Z-045', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-V-شکل-پرو-GENERIC--ZX-109', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-V-شکل-پرو-HANKOOK-Z-657', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-V-شکل-پرو-REFLEX-Z-656', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-تایمینگ-م-GENERIC--T10-036', 'excel-v2-1-1', 'تسمه تایمینگ', 'سیم‌دار فابریک', 'پلی‌یورتان'),
  ('PFAM-تسمه-تایمینگ-م-POWER-3M-470', 'excel-v2-1-1', 'تسمه تایمینگ', 'لاستیکی فابریک', 'لاستیکی فابریک ساده و دنده‌دار'),
  ('PFAM-تسمه-تایمینگ-م-POWER-3M-621', 'excel-v2-1-1', 'تسمه تایمینگ', 'لاستیکی فابریک', 'لاستیکی فابریک ساده و دنده‌دار'),
  ('PFAM-تسمه-جوشی-V-رو-FORZA-A-633', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-V-رو-FORZA-B-634', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-V-رو-FORZA-B-636', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-V-رو-FORZA-C-637', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-V-رو-FORZA-C-638', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-V-رو-T-B-B-635', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-پلی--B-R-B-665', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-جوشی-پلی--FORZA-A-662', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-پلی--FORZA-A-663', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-پلی--FORZA-B-491', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-پلی--FORZA-B-666', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-پلی--FORZA-C-494', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-پلی--FORZA-C-667', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-پلی--GENERIC--B-397', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-جوشی-پلی--GENERIC--B-398', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-جوشی-پلی--GENERIC--C-399', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-پلی--GENERIC--C-493', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-پلی--VOLTA-B-664', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-ذوزنقه-ای-GENERIC--CRC-046', 'excel-v2-1-4', 'تسمه بارکش و تجهیزات جوشی', 'تسمه بارکش', 'انواع تسمه بارکش صنعتی'),
  ('PFAM-تسمه-ذوزنقه-ای-GENERIC--TRC-653', 'excel-v2-1-4', 'تسمه بارکش و تجهیزات جوشی', 'تسمه بارکش', 'انواع تسمه بارکش صنعتی'),
  ('PFAM-تسمه-ذوزنقه-ای-GNR-CRC-168', 'excel-v2-1-4', 'تسمه بارکش و تجهیزات جوشی', 'تسمه بارکش', 'انواع تسمه بارکش صنعتی'),
  ('PFAM-تسمه-ذوزنقه-ای-MEGADYNE-CRC-107', 'excel-v2-1-4', 'تسمه بارکش و تجهیزات جوشی', 'تسمه بارکش', 'انواع تسمه بارکش صنعتی'),
  ('PFAM-تسمه-ذوزنقه-ای-SWR-CRC-097', 'excel-v2-1-4', 'تسمه بارکش و تجهیزات جوشی', 'تسمه بارکش', 'انواع تسمه بارکش صنعتی')
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
  ('PFAM-تسمه-V-شکل-پرو-GENERIC--M-051', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-V-شکل-پرو-GENERIC--MX-660', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-V-شکل-پرو-GENERIC--Z-045', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-V-شکل-پرو-GENERIC--ZX-109', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-V-شکل-پرو-HANKOOK-Z-657', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-V-شکل-پرو-REFLEX-Z-656', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-تایمینگ-م-GENERIC--T10-036', 'excel-v2-1-1', 'تسمه تایمینگ', 'سیم‌دار فابریک', 'پلی‌یورتان'),
  ('PFAM-تسمه-تایمینگ-م-POWER-3M-470', 'excel-v2-1-1', 'تسمه تایمینگ', 'لاستیکی فابریک', 'لاستیکی فابریک ساده و دنده‌دار'),
  ('PFAM-تسمه-تایمینگ-م-POWER-3M-621', 'excel-v2-1-1', 'تسمه تایمینگ', 'لاستیکی فابریک', 'لاستیکی فابریک ساده و دنده‌دار'),
  ('PFAM-تسمه-جوشی-V-رو-FORZA-A-633', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-V-رو-FORZA-B-634', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-V-رو-FORZA-B-636', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-V-رو-FORZA-C-637', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-V-رو-FORZA-C-638', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-V-رو-T-B-B-635', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-پلی--B-R-B-665', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-جوشی-پلی--FORZA-A-662', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-پلی--FORZA-A-663', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-پلی--FORZA-B-491', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-پلی--FORZA-B-666', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-پلی--FORZA-C-494', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-پلی--FORZA-C-667', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-پلی--GENERIC--B-397', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-جوشی-پلی--GENERIC--B-398', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-جوشی-پلی--GENERIC--C-399', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-پلی--GENERIC--C-493', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری'),
  ('PFAM-تسمه-جوشی-پلی--VOLTA-B-664', 'excel-v2-1-2', 'تسمه وی‌بلت (V-Belt)', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V'),
  ('PFAM-تسمه-ذوزنقه-ای-GENERIC--CRC-046', 'excel-v2-1-4', 'تسمه بارکش و تجهیزات جوشی', 'تسمه بارکش', 'انواع تسمه بارکش صنعتی'),
  ('PFAM-تسمه-ذوزنقه-ای-GENERIC--TRC-653', 'excel-v2-1-4', 'تسمه بارکش و تجهیزات جوشی', 'تسمه بارکش', 'انواع تسمه بارکش صنعتی'),
  ('PFAM-تسمه-ذوزنقه-ای-GNR-CRC-168', 'excel-v2-1-4', 'تسمه بارکش و تجهیزات جوشی', 'تسمه بارکش', 'انواع تسمه بارکش صنعتی'),
  ('PFAM-تسمه-ذوزنقه-ای-MEGADYNE-CRC-107', 'excel-v2-1-4', 'تسمه بارکش و تجهیزات جوشی', 'تسمه بارکش', 'انواع تسمه بارکش صنعتی'),
  ('PFAM-تسمه-ذوزنقه-ای-SWR-CRC-097', 'excel-v2-1-4', 'تسمه بارکش و تجهیزات جوشی', 'تسمه بارکش', 'انواع تسمه بارکش صنعتی')
)
update public.catalog_families f
set category_slug=m.category_slug,
    category_name=m.category_name,
    submenu=m.submenu_name,
    subcategory=m.leaf_name,
    updated_at=now()
from mapping m
where f.code=m.family_code;

-- Keep these valid products searchable at category level, but do not publish them under a false leaf.
delete from public.catalog_family_menu_assignments
where family_code in ('PFAM-تسمه-V-شکل-پرو-GENERIC--AA-658', 'PFAM-تسمه-V-شکل-پرو-GENERIC--K-659', 'PFAM-تسمه-تایمینگ-د-OPTIBELT-AUTO-RU-222');

update public.catalog_families
set submenu=null, subcategory=null, updated_at=now()
where code in ('PFAM-تسمه-V-شکل-پرو-GENERIC--AA-658', 'PFAM-تسمه-V-شکل-پرو-GENERIC--K-659', 'PFAM-تسمه-تایمینگ-د-OPTIBELT-AUTO-RU-222');

-- Move true welded V-section A/B/C SKUs out of the flat-belt leaf.
with direct_profile as (
  select s.sku_code,
    max(x.value) filter (where x.key='پروفیل / مدل') as profile,
    max(x.value) filter (where x.key='supplyForm') as supply_form
  from public.catalog_direct_skus s
  left join lateral jsonb_to_recordset(s.technical_specs) as x(key text,value text) on true
  where s.is_active=true
    and s.category_slug='excel-v2-1-3'
    and s.submenu='تسمه فلت'
  group by s.sku_code
)
update public.catalog_direct_skus s
set category_slug='excel-v2-1-2',
    category_name='تسمه وی‌بلت (V-Belt)',
    submenu=case when d.supply_form='heat-weldable-meter' then 'وی‌بلت متری' else 'کلاسیک و دنده‌دار' end,
    subcategory=case when d.supply_form='heat-weldable-meter'
      then 'تسمه A و B و C وی‌بلت متری'
      else 'Z (9.5) , M , A , B , C , D , E , 8V' end,
    updated_at=now()
from direct_profile d
where s.sku_code=d.sku_code and d.profile in ('A','B','C');

-- BRB has no exact approved leaf; do not mislabel it as flat.
with direct_profile as (
  select s.sku_code,max(x.value) filter (where x.key='پروفیل / مدل') as profile
  from public.catalog_direct_skus s
  left join lateral jsonb_to_recordset(s.technical_specs) as x(key text,value text) on true
  where s.is_active=true and s.category_slug='excel-v2-1-3' and s.submenu='تسمه فلت'
  group by s.sku_code
)
update public.catalog_direct_skus s
set submenu='',subcategory='',updated_at=now()
from direct_profile d
where s.sku_code=d.sku_code and d.profile='BRB';

-- Move the explicit crowned/ridge-top CRC direct SKU to the approved hauling-belt path.
update public.catalog_direct_skus
set category_slug='excel-v2-1-4',
    category_name='تسمه بارکش و تجهیزات جوشی',
    submenu='تسمه بارکش',
    subcategory='انواع تسمه بارکش صنعتی',
    updated_at=now()
where sku_code='31997' and category_slug='excel-v2-1-3';

-- Timing: rubber 3M belongs to the rubber factory leaf; steel-cord TPU T10 belongs to wired factory PU.
update public.catalog_direct_skus
set submenu='لاستیکی فابریک',
    subcategory='لاستیکی فابریک ساده و دنده‌دار',
    updated_at=now()
where sku_code='41314' and category_slug='excel-v2-1-1';

update public.catalog_direct_skus
set submenu='سیم‌دار فابریک',
    subcategory='پلی‌یورتان',
    updated_at=now()
where sku_code='38048' and category_slug='excel-v2-1-1';

-- Automotive timing belts have no approved industrial timing leaf; preserve the SKUs but remove the false leaf.
update public.catalog_direct_skus
set submenu='',subcategory='',updated_at=now()
where sku_code in ('35023','42209') and category_slug='excel-v2-1-1';

-- V-belt profiles Z/ZX/8V are classical, not A/B/C meter profiles.
update public.catalog_direct_skus
set submenu='کلاسیک و دنده‌دار',
    subcategory='Z (9.5) , M , A , B , C , D , E , 8V',
    updated_at=now()
where sku_code in ('22743','37869','37188') and category_slug='excel-v2-1-2';

-- BB is a double-sided hexagonal V profile with no approved leaf; preserve at category level only.
update public.catalog_direct_skus
set submenu='',subcategory='',updated_at=now()
where sku_code in ('35236','38510') and category_slug='excel-v2-1-2';

do $$
begin
  if (select count(*) from public.catalog_family_menu_assignments
      where family_code in ('PFAM-تسمه-V-شکل-پرو-GENERIC--M-051', 'PFAM-تسمه-V-شکل-پرو-GENERIC--MX-660', 'PFAM-تسمه-V-شکل-پرو-GENERIC--Z-045', 'PFAM-تسمه-V-شکل-پرو-GENERIC--ZX-109', 'PFAM-تسمه-V-شکل-پرو-HANKOOK-Z-657', 'PFAM-تسمه-V-شکل-پرو-REFLEX-Z-656', 'PFAM-تسمه-تایمینگ-م-GENERIC--T10-036', 'PFAM-تسمه-تایمینگ-م-POWER-3M-470', 'PFAM-تسمه-تایمینگ-م-POWER-3M-621', 'PFAM-تسمه-جوشی-V-رو-FORZA-A-633', 'PFAM-تسمه-جوشی-V-رو-FORZA-B-634', 'PFAM-تسمه-جوشی-V-رو-FORZA-B-636', 'PFAM-تسمه-جوشی-V-رو-FORZA-C-637', 'PFAM-تسمه-جوشی-V-رو-FORZA-C-638', 'PFAM-تسمه-جوشی-V-رو-T-B-B-635', 'PFAM-تسمه-جوشی-پلی--B-R-B-665', 'PFAM-تسمه-جوشی-پلی--FORZA-A-662', 'PFAM-تسمه-جوشی-پلی--FORZA-A-663', 'PFAM-تسمه-جوشی-پلی--FORZA-B-491', 'PFAM-تسمه-جوشی-پلی--FORZA-B-666', 'PFAM-تسمه-جوشی-پلی--FORZA-C-494', 'PFAM-تسمه-جوشی-پلی--FORZA-C-667', 'PFAM-تسمه-جوشی-پلی--GENERIC--B-397', 'PFAM-تسمه-جوشی-پلی--GENERIC--B-398', 'PFAM-تسمه-جوشی-پلی--GENERIC--C-399', 'PFAM-تسمه-جوشی-پلی--GENERIC--C-493', 'PFAM-تسمه-جوشی-پلی--VOLTA-B-664', 'PFAM-تسمه-ذوزنقه-ای-GENERIC--CRC-046', 'PFAM-تسمه-ذوزنقه-ای-GENERIC--TRC-653', 'PFAM-تسمه-ذوزنقه-ای-GNR-CRC-168', 'PFAM-تسمه-ذوزنقه-ای-MEGADYNE-CRC-107', 'PFAM-تسمه-ذوزنقه-ای-SWR-CRC-097')
        and method='engineering_audited') <> 32 then
    raise exception 'Belt taxonomy postcondition failed: family assignment update incomplete';
  end if;
  if exists (select 1 from public.catalog_family_menu_assignments where family_code in ('PFAM-تسمه-V-شکل-پرو-GENERIC--AA-658', 'PFAM-تسمه-V-شکل-پرو-GENERIC--K-659', 'PFAM-تسمه-تایمینگ-د-OPTIBELT-AUTO-RU-222')) then
    raise exception 'Belt taxonomy postcondition failed: unresolved families still have menu assignments';
  end if;
  if (select count(*) from (
      select s.sku_code,
        max(x.value) filter (where x.key='پروفیل / مدل') as profile,
        max(x.value) filter (where x.key='نوع محصول') as product_type
      from public.catalog_direct_skus s
      left join lateral jsonb_to_recordset(s.technical_specs) as x(key text,value text) on true
      where s.is_active=true and s.category_slug='excel-v2-1-2'
        and s.submenu in ('وی‌بلت متری','کلاسیک و دنده‌دار')
      group by s.sku_code
    ) moved
    where profile in ('A','B','C') and product_type ~* 'تسمه جوشی') <> 34 then
    raise exception 'Belt taxonomy postcondition failed: expected 34 welded A/B/C direct SKUs in V-belt menu (33 moved plus one already correctly placed)';
  end if;
  if not exists (select 1 from public.catalog_direct_skus
      where sku_code='31997' and category_slug='excel-v2-1-4'
        and submenu='تسمه بارکش' and subcategory='انواع تسمه بارکش صنعتی') then
    raise exception 'Belt taxonomy postcondition failed: direct ridge-top SKU not moved';
  end if;
  if not exists (select 1 from public.catalog_direct_skus
      where sku_code='38048' and submenu='سیم‌دار فابریک' and subcategory='پلی‌یورتان') then
    raise exception 'Belt taxonomy postcondition failed: direct steel-cord T10 timing SKU not moved';
  end if;
  if not exists (select 1 from public.catalog_direct_skus
      where sku_code='41314' and submenu='لاستیکی فابریک'
        and subcategory='لاستیکی فابریک ساده و دنده‌دار') then
    raise exception 'Belt taxonomy postcondition failed: direct rubber 3M timing SKU not moved';
  end if;
  if exists (select 1 from public.catalog_direct_skus
      where sku_code in ('35023','42209','35236','38510')
        and (submenu<>'' or subcategory<>'')) then
    raise exception 'Belt taxonomy postcondition failed: unapproved automotive/hexagonal SKUs still have menu leaves';
  end if;
end $$;

commit;
