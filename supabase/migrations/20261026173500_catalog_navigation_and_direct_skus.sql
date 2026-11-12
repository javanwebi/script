-- Catalog navigation presentation and direct SKU assignments.
-- Applied to sanatpishatlas through Supabase migration; tracked here for future environments.
create table if not exists public.catalog_navigation_groups (
  id text primary key,
  title text not null check(length(btrim(title)) between 2 and 120),
  icon_key text not null default 'layers',
  image_url text,
  category_slugs text[] not null default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists idx_catalog_navigation_groups_sort on public.catalog_navigation_groups(sort_order,id);
alter table public.catalog_navigation_groups enable row level security;
revoke all on public.catalog_navigation_groups from public, anon, authenticated;
insert into public.catalog_navigation_groups(id,title,icon_key,category_slugs,sort_order) values
('power','انتقال قدرت و مکانیکی','layers',array['تسمه-و-انتقال-نیرو','پولی-و-انتقال-نیرو','زنجیر-و-چرخ-زنجیر','قطعات-مکانیکی','انتقال-قدرت-مکانیکی'],0),
('motion','تجهیزات حرکت و هدایت','move',array['ریل-و-تجهیزات-هدایت','چرخ-و-رولر'],1),
('seals','شیلنگ، لاستیک و آب‌بندی','link-2',array['شیلنگ-و-اتصالات','آب-بندی-و-قطعات-لاستیکی','آب-بندی-و-درزگیری','تجهیزات-وکیوم'],2),
('engineering','پروفیل و قطعات مهندسی','box',array['مواد-و-ورق-صنعتی','اتصالات-و-نگهدارنده','برس-و-ابزار-پرداخت'],3)
on conflict(id) do nothing;

-- These public catalogue records have no family foreign key.
-- Legacy variant and finance records are deliberately preserved as provenance
-- when a real existing SKU is selected for direct placement.
create table if not exists public.catalog_direct_skus (
  sku_code text primary key,
  name text not null,
  category_slug text not null,
  category_name text not null,
  submenu text not null default '',
  subcategory text not null default '',
  brand text not null default '',
  image_url text,
  technical_specs jsonb not null default '[]'::jsonb,
  price_snapshot jsonb not null default '{}'::jsonb,
  source_family_code text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists idx_catalog_direct_skus_category on public.catalog_direct_skus(category_slug,submenu,subcategory) where is_active;
alter table public.catalog_direct_skus enable row level security;
revoke all on public.catalog_direct_skus from public,anon,authenticated;
