-- Compatible ONLY with the user-supplied 49-table catalog_* / user_profiles schema.
-- No product/customer record is deleted, renamed or overwritten.
create schema if not exists app_private;
revoke all on schema app_private from public;
alter table public.user_profiles add column if not exists assigned_price_list_id text references public.price_lists(id);
alter table public.price_lists add column if not exists discount_percent numeric(5,2) not null default 0 check(discount_percent between 0 and 100);

create or replace function public.is_admin_user() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_profiles where id=(select auth.uid()) and status='active' and role='super_admin');
$$;
create or replace function public.can_current_user_view_commercial() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_profiles where id=(select auth.uid()) and status='active' and (role='super_admin' or can_view_prices));
$$;
create function app_private.normalize_iran_phone(p_phone text) returns text language plpgsql immutable security invoker set search_path='' as $$
declare n text;begin
 n=regexp_replace(translate(coalesce(p_phone,''),'۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩','01234567890123456789'),'[^0-9]','','g');
 if n like '0098%' then n=substring(n from 3);end if;
 if n ~ '^09[0-9]{9}$' then return '+98'||substring(n from 2);end if;
 if n ~ '^989[0-9]{9}$' then return '+'||n;end if;
 if n ~ '^9[0-9]{9}$' then return '+98'||n;end if;
 return null;
end$$;
-- Trigger remains on auth.users. Authorization never comes from raw_user_meta_data.
create or replace function public.handle_auth_user_sync() returns trigger language plpgsql security definer set search_path='' as $$
declare matched public.crm_customers;verified_phone text;verified_email text;matches integer;approved boolean=false;begin
 if new.phone_confirmed_at is not null then verified_phone=app_private.normalize_iran_phone(new.phone);end if;
 if new.email_confirmed_at is not null then verified_email=lower(new.email);end if;
 select count(*) into matches from public.crm_customers c where (c.auth_user_id is null or c.auth_user_id=new.id) and ((verified_phone is not null and app_private.normalize_iran_phone(c.phone)=verified_phone) or (verified_email is not null and lower(c.email)=verified_email));
 if matches=1 then select * into matched from public.crm_customers c where (c.auth_user_id is null or c.auth_user_id=new.id) and ((verified_phone is not null and app_private.normalize_iran_phone(c.phone)=verified_phone) or (verified_email is not null and lower(c.email)=verified_email)) for update;end if;
 approved=matched.id is not null and matched.approved_b2b and matched.approval_status='approved';
 insert into public.user_profiles(id,legacy_user_id,phone,email,full_name,company_name,role,status,grade_code,approved_b2b,can_view_prices,can_view_stock,credit_limit,credit_used,wallet_balance,club_points)
 values(new.id,matched.id,verified_phone,verified_email,left(coalesce(matched.name,new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''),512),left(coalesce(matched.company,new.raw_user_meta_data->>'company',''),512),case when approved then 'club'::public.app_role_type else 'client'::public.app_role_type end,'active',case when approved then matched.grade_code else null end,coalesce(approved,false),true,true,case when approved then matched.credit_limit else 0 end,case when approved then matched.used_credit else 0 end,case when approved then matched.wallet_balance else 0 end,case when approved then matched.points else 0 end)
 on conflict(id) do update set phone=coalesce(excluded.phone,user_profiles.phone),email=coalesce(excluded.email,user_profiles.email),legacy_user_id=coalesce(user_profiles.legacy_user_id,excluded.legacy_user_id),approved_b2b=case when approved then true else user_profiles.approved_b2b end,role=case when approved and user_profiles.role='client' then 'club'::public.app_role_type else user_profiles.role end,updated_at=now();
 if matched.id is not null then update public.crm_customers set auth_user_id=new.id,updated_at=now() where id=matched.id and (auth_user_id is null or auth_user_id=new.id);end if;
 return new;
end$$;
create trigger on_auth_verified_identity_sync after update of phone,phone_confirmed_at,email,email_confirmed_at on auth.users for each row execute function public.handle_auth_user_sync();
revoke execute on function public.handle_auth_user_sync() from public,anon,authenticated;
revoke execute on function public.is_admin_user(),public.can_current_user_view_commercial() from public;
grant execute on function public.is_admin_user(),public.can_current_user_view_commercial() to anon,authenticated;

-- RLS restricts ROWS, not columns. Explicit grants protect role, grade and financial fields.
revoke all on public.user_profiles from public,anon,authenticated;
grant select(id,phone,email,username,full_name,company_name,national_id,economic_code,registration_number,role,status,approved_b2b,can_view_prices,can_view_stock,province,city,address,postal_code,wallet_balance,credit_limit,credit_used,current_debt,club_points,lifetime_points,viewed_categories,preferences,last_login_at,created_at,updated_at) on public.user_profiles to authenticated;
grant update(full_name,company_name,province,city,address,postal_code,viewed_categories,preferences) on public.user_profiles to authenticated;
revoke select on public.crm_customers from public,anon,authenticated;
grant select(id,auth_user_id,name,company,phone,email,province,city,address,postal_code) on public.crm_customers to authenticated;
-- Internal base/wholesale/dealer prices are accessed by trusted backend or the filtered RPC.
revoke select on public.variant_commercial_specs,public.price_lists from public,anon,authenticated;
-- The BFF verifies ownership, final totals and payment; browsers cannot fabricate orders or quotes.
revoke insert,update,delete on public.orders,public.order_items,public.official_invoices,public.price_inquiries,public.agency_applications from public,anon,authenticated;
do $$declare t record;begin for t in select tablename from pg_tables where schemaname='public' loop execute format('revoke truncate,references,trigger on public.%I from public,anon,authenticated',t.tablename);end loop;end$$;

create function app_private.current_variant_price(p_sku text) returns numeric language plpgsql stable security invoker set search_path='' as $$
declare u public.user_profiles;list_id text;sheet public.price_lists;commercial public.variant_commercial_specs;price numeric;begin
 select * into u from public.user_profiles where id=(select auth.uid()) and status='active';if not found then return null;end if;
 select * into commercial from public.variant_commercial_specs where variant_code=p_sku;if not found then return null;end if;
 price=coalesce(nullif(commercial.retail_price,0),nullif(commercial.price,0),nullif(commercial.base_price,0),0);
 list_id=u.assigned_price_list_id;
 if list_id is null then select c.assigned_price_list_id into list_id from public.crm_customers c where c.auth_user_id=u.id and c.approval_status='approved' limit 1;end if;
 select * into sheet from public.price_lists p where p.id=list_id and p.is_active and (p.valid_from is null or p.valid_from<=now()) and (p.valid_until is null or p.valid_until>now());
 if found then
 if jsonb_typeof(sheet.items->p_sku)='number' then price=(sheet.items->>p_sku)::numeric;
 elsif jsonb_typeof(sheet.items->p_sku)='object' and jsonb_typeof(sheet.items->p_sku->'price')='number' then price=(sheet.items->p_sku->>'price')::numeric;
 else price=round(price*(1-sheet.discount_percent/100));end if;
 end if;
 if price<0 then raise exception 'Invalid SKU price';end if;return price;
end$$;

-- Private content helper only answers whether the CURRENT identity matches a row's target.
create function app_private.content_visible(p_portal text,p_payload jsonb,p_roles jsonb default '[]',p_grades jsonb default '[]') returns boolean language plpgsql stable security definer set search_path='' as $$
declare u public.user_profiles;begin
 if public.is_admin_user() then return true;end if;
 if p_portal='storefront' and coalesce(p_payload->>'scope','collective')<>'individual' and coalesce(p_payload->>'targetCustomerId','')='' and coalesce(p_roles,'[]')='[]' and coalesce(p_grades,'[]')='[]' then return true;end if;
 select * into u from public.user_profiles where id=(select auth.uid()) and status='active';if not found then return false;end if;
 if p_portal not in ('consumer','high_volume','storefront') or p_portal is null then return false;end if;
 if p_portal='high_volume' and not u.approved_b2b then return false;end if;
 if p_portal='consumer' and u.approved_b2b then return false;end if;
 if coalesce(p_payload->>'scope','collective')='individual' and p_payload->>'targetCustomerId' is distinct from coalesce(u.legacy_user_id,u.id::text) and p_payload->>'targetCustomerId' is distinct from u.id::text then return false;end if;
 if coalesce(p_roles,'[]')<>'[]' and not p_roles @> jsonb_build_array(u.role::text) then return false;end if;
 if coalesce(p_grades,'[]')<>'[]' and not p_grades @> jsonb_build_array(u.grade_code) then return false;end if;
 if nullif(p_payload->>'targetTierCode','') is not null and p_payload->>'targetTierCode'<>'ALL' and p_payload->>'targetTierCode' is distinct from u.grade_code then return false;end if;
 return true;
end$$;
grant usage on schema app_private to anon,authenticated;
revoke execute on all functions in schema app_private from public,anon,authenticated;
grant execute on function app_private.content_visible(text,jsonb,jsonb,jsonb) to anon,authenticated;
alter policy "Public read active banners" on public.portal_banners using(public.is_admin_user() or (active and app_private.content_visible(scope,raw_payload,target_roles)));
alter policy "Public read active announcements" on public.portal_announcements using(public.is_admin_user() or (active and app_private.content_visible(coalesce(raw_payload->>'portal','consumer'),raw_payload,target_roles,target_grades)));
alter policy "Public read catalog_variants" on public.catalog_variants using(public.is_admin_user() or (active and exists(select 1 from public.catalog_families f where f.code=family_code and f.is_active and not f.is_deleted)));

CREATE OR REPLACE FUNCTION public.get_family_variants_for_current_user(target_family_code TEXT)
RETURNS TABLE (
    code TEXT,
    family_code TEXT,
    name TEXT,
    size TEXT,
    model TEXT,
    brand TEXT,
    unit TEXT,
    active BOOLEAN,
    images JSONB,
    technical_specs JSONB,
    technical_review JSONB,
    price NUMERIC(18, 2),
    retail_price NUMERIC(18, 2),
    wholesale_price NUMERIC(18, 2),
    dealer_price NUMERIC(18, 2),
    stock INTEGER,
    stock_known BOOLEAN,
    inquiry_only BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        v.code,
        v.family_code,
        v.name,
        v.size,
        v.model,
        v.brand,
        v.unit,
        v.active,
        v.images,
        v.technical_specs,
        v.technical_review,
        CASE WHEN public.can_current_user_view_commercial() THEN app_private.current_variant_price(v.code) ELSE NULL END,
        CASE WHEN public.is_admin_user() THEN c.retail_price ELSE NULL END,
        CASE WHEN public.is_admin_user() THEN c.wholesale_price ELSE NULL END,
        CASE WHEN public.is_admin_user() THEN c.dealer_price ELSE NULL END,
        CASE WHEN EXISTS(SELECT 1 FROM public.user_profiles up WHERE up.id=(SELECT auth.uid()) AND up.status='active' AND (up.can_view_stock OR up.role='super_admin')) THEN c.stock ELSE NULL END,
        CASE WHEN EXISTS(SELECT 1 FROM public.user_profiles up WHERE up.id=(SELECT auth.uid()) AND up.status='active' AND (up.can_view_stock OR up.role='super_admin')) THEN c.stock_known ELSE FALSE END,
        CASE WHEN public.can_current_user_view_commercial() THEN c.inquiry_only ELSE TRUE END
    FROM public.catalog_variants v
    LEFT JOIN public.variant_commercial_specs c ON c.variant_code = v.code
    JOIN public.catalog_families f ON f.code=v.family_code
    WHERE v.family_code = target_family_code
      AND ((v.active AND f.is_active AND NOT f.is_deleted) OR public.is_admin_user())
    ORDER BY v.sort_order ASC, v.code ASC;
$$;
revoke execute on function public.get_family_variants_for_current_user(text) from public;
grant execute on function public.get_family_variants_for_current_user(text) to anon,authenticated;
-- Public representatives expose contact details, never credit balances, sub-users or raw CRM.
revoke select on public.agencies from public,anon,authenticated;
grant select(id,code,name,company_name,phone,province,city,address,latitude,longitude,is_public_representative) on public.agencies to anon,authenticated;
