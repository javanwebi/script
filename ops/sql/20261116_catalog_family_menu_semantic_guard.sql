-- Remove only semantically incompatible family-to-menu links.
-- No family, SKU, product identity, image, price, or inventory record is deleted.
-- The original assignment rows are copied to a durable backup table first.

begin;

create table if not exists public.catalog_family_menu_assignment_semantic_backup_20261116 as
select a.*, now() as backed_up_at
from public.catalog_family_menu_assignments a
where false;

alter table public.catalog_family_menu_assignment_semantic_backup_20261116 enable row level security;
revoke all on table public.catalog_family_menu_assignment_semantic_backup_20261116 from public, anon, authenticated;
create index if not exists idx_catalog_family_menu_semantic_backup_family
  on public.catalog_family_menu_assignment_semantic_backup_20261116(family_code);

create temporary table catalog_menu_semantic_conflicts_20261116
on commit drop
as
with family_identity as (
  select
    f.code,
    f.name,
    a.category_slug,
    a.submenu_name,
    a.leaf_name,
    a.method,
    replace(replace(
      case
        when count(distinct nullif(v.identity_specs->>'productType','')) <= 1
          then coalesce(max(v.identity_specs->>'productType'), f.name)
        else 'MIXED'
      end, 'ي', 'ی'), 'ك', 'ک') as product_type,
    replace(replace(
      case
        when count(distinct nullif(v.identity_specs->>'material','')) <= 1
          then coalesce(max(v.identity_specs->>'material'), f.materials, '')
        else 'MIXED'
      end, 'ي', 'ی'), 'ك', 'ک') as material,
    replace(replace(
      case
        when count(distinct nullif(v.identity_specs->>'profile','')) <= 1
          then coalesce(max(v.identity_specs->>'profile'), '')
        else 'MIXED'
      end, 'ي', 'ی'), 'ك', 'ک') as profile,
    count(distinct v.code) filter (where v.active=true) as active_sku_count
  from public.catalog_families f
  join public.catalog_family_menu_assignments a on a.family_code=f.code
  left join public.catalog_variants v on v.family_code=f.code and v.active=true
  where f.is_active=true and coalesce(f.is_deleted,false)=false
  group by f.code,f.name,a.category_slug,a.submenu_name,a.leaf_name,a.method,f.materials
),
classified as (
  select *,
    case
      when category_slug='excel-v2-9-4'
        and (product_type||' '||name||' '||profile) ~* 'کوپلینگ|کوبلینگ|coupling'
        then 'wheel_coupling'
      when category_slug='excel-v2-9-4'
        and (product_type||' '||name||' '||profile) !~* 'چرخ|چرخ.?دنده|چرخ.?زنجیر|دنده.?زنجیر|sprocket|gear|wheel|پالت.?آیزر'
        then 'wheel_product_type_mismatch'

      when category_slug='excel-v2-6-2' and submenu_name='گاید تفلونی'
        and (
          (product_type||' '||name||' '||profile) !~* 'گاید|راهنما|ریل|guide|rail'
          or material !~* 'تفلون|ptfe|uhmwpe'
        ) then 'teflon_guide_type_or_material_mismatch'
      when category_slug='excel-v2-6-2' and submenu_name='نرده استیل'
        and (
          (product_type||' '||name||' '||profile) !~* 'گاید|راهنما|ریل|نرده|guide|rail'
          or material !~* 'استیل|stainless|ss[[:space:]]*304|ss[[:space:]]*316'
        ) then 'stainless_guide_type_or_material_mismatch'

      when category_slug='excel-v2-6-1'
        and (product_type||' '||name||' '||profile) !~* 'ریل|گاید|راهنما|rail|guide'
        then 'rail_product_type_mismatch'
      when category_slug='excel-v2-6-1' and submenu_name='بر اساس جنس'
        and leaf_name ilike '%استیل%' and material !~* 'استیل|stainless|ss[[:space:]]*304|ss[[:space:]]*316'
        then 'stainless_rail_material_mismatch'
      when category_slug='excel-v2-6-1' and submenu_name='بر اساس جنس'
        and leaf_name ilike '%تفلون%' and material !~* 'تفلون|ptfe|uhmwpe'
        then 'teflon_rail_material_mismatch'
      when category_slug='excel-v2-6-1' and submenu_name='بر اساس جنس'
        and leaf_name ilike '%آهنی%' and material !~* 'فولاد|آهن|steel|carbon'
        then 'iron_rail_material_mismatch'
      when category_slug='excel-v2-6-1' and submenu_name='بر اساس جنس'
        and leaf_name ilike '%گالوانیزه%' and material !~* 'گالوانیزه|galvanized'
        then 'galvanized_rail_material_mismatch'

      when category_slug='excel-v2-7-1'
        and (
          (
            material ~* 'پلی.?وینیل.?کلراید|pvc|تفلون|ptfe|uhmwpe|پلی.?آمید|polyamide|فولاد|آهن|steel|آلومینیوم|aluminum'
            and (product_type||' '||name||' '||profile) !~* 'لاستیک|الاستومر|ضربه.?گیر|مکنده|دیافراگم|گریپ|اورینگ|پکینگ|کاسه.?نمد|rubber|elastomer|bumper|suction|seal'
          )
          or (
            (product_type||' '||name||' '||profile) !~* 'لاستیک|الاستومر|ضربه.?گیر|مکنده|دیافراگم|گریپ|اورینگ|پکینگ|کاسه.?نمد|rubber|elastomer|bumper|suction|seal'
            and material !~* 'لاستیک|الاستومر|rubber|elastomer|nbr|epdm|fkm|viton|سیلیکون|silicone'
          )
        ) then 'rubber_product_or_material_mismatch'

      when category_slug='excel-v2-9-3' and submenu_name='دستگیره و پیچ فلکه'
        and (product_type||' '||name||' '||profile) !~* 'دستگیره|پیچ.?فلکه|پیچ.?دسته.?دار|handwheel|knob|handle'
        then 'handle_product_type_mismatch'

      when category_slug='excel-v2-10-1' and submenu_name='اسپاتول سیلیکونی'
        and (product_type||' '||name||' '||profile) !~* 'اسپاتول|squeegee'
        then 'spatula_product_type_mismatch'
    end as conflict_reason
  from family_identity
)
select code as family_code, category_slug, submenu_name, leaf_name, method,
       conflict_reason, active_sku_count
from classified
where conflict_reason is not null;

-- Snapshot is idempotent: an assignment is backed up once, before its first removal.
insert into public.catalog_family_menu_assignment_semantic_backup_20261116
select a.*, now()
from public.catalog_family_menu_assignments a
join catalog_menu_semantic_conflicts_20261116 c on c.family_code=a.family_code
where not exists (
  select 1
  from public.catalog_family_menu_assignment_semantic_backup_20261116 b
  where b.family_code=a.family_code
);

delete from public.catalog_family_menu_assignments a
using catalog_menu_semantic_conflicts_20261116 c
where a.family_code=c.family_code;

-- Review result: families and SKUs are retained; only invalid menu links are removed.
select conflict_reason,
       count(*) as families_unassigned,
       sum(active_sku_count) as active_skus_unassigned
from catalog_menu_semantic_conflicts_20261116
group by conflict_reason
order by conflict_reason;

commit;
