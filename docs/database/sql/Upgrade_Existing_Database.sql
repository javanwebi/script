-- Sanat Pish: reviewed owner-supplied catalog_* / user_profiles schema.
-- Production: backup + owner approval required. No data deletion.
-- For the existing 49-table database ONLY.
BEGIN;
do $$begin if to_regclass('public.user_profiles') is null or to_regclass('public.catalog_variants') is null then raise exception 'Wrong schema: expected adopted user_profiles/catalog_variants';end if;if to_regclass('public.financial_entries') is not null then raise exception 'Upgrade appears already applied; check migration history instead of repeating it';end if;end$$;

-- 20261020083418_adopt_existing_schema_security.sql
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


-- 20261020083459_adopted_financial_and_storage.sql
-- Additive, compatible with the adopted user_profiles/catalog_* schema.
-- Existing amounts/currencies are preserved; NO IRR/IRT conversion is performed.
alter table public.variant_commercial_specs add column if not exists stock_reserved integer not null default 0 check(stock_reserved>=0);
alter table public.variant_commercial_specs add column if not exists stock_version bigint not null default 0;
alter table public.orders add column if not exists final_amount numeric(18,2) check(final_amount>=0);
alter table public.orders add column if not exists payment_status text not null default 'unpaid' check(payment_status in ('unpaid','pending_review','paid','refunded'));
alter table public.orders add column if not exists currency text not null default 'IRR' check(currency in ('IRR','IRT'));
alter table public.orders add column if not exists shipping_amount numeric(18,2) not null default 0 check(shipping_amount>=0);
alter table public.club_milestones add column if not exists portal text check(portal in ('consumer','high_volume'));
alter table public.club_milestones add column if not exists min_purchase_volume numeric(18,2) check(min_purchase_volume>=0);
create table public.customer_finance_accounts(user_id uuid primary key references public.user_profiles(id),opening_debt numeric(18,2) not null default 0,opening_wallet numeric(18,2) not null default 0 check(opening_wallet>=0),opening_points bigint not null default 0 check(opening_points>=0),currency text not null check(currency in ('IRR','IRT')),source_reference text not null,created_at timestamptz not null default now());
create table public.financial_entries(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.customer_finance_accounts(user_id),debt_delta numeric(18,2) not null default 0,wallet_delta numeric(18,2) not null default 0,points_delta bigint not null default 0,kind text not null check(kind in ('invoice','payment','refund','earn','redeem','adjustment')),reference text not null,order_id text references public.orders(id),description text not null default '',created_at timestamptz not null default now(),check(debt_delta<>0 or wallet_delta<>0 or points_delta<>0),unique(user_id,reference));
create index financial_entries_user on public.financial_entries(user_id,created_at);
create table public.inventory_events(id uuid primary key default gen_random_uuid(),variant_code text not null references public.catalog_variants(code),quantity_delta integer not null check(quantity_delta<>0),reference text not null,reason text not null,created_at timestamptz not null default now(),unique(variant_code,reference));
create index inventory_events_sku on public.inventory_events(variant_code,created_at);
create table public.stock_reservations(id uuid primary key default gen_random_uuid(),order_id text not null references public.orders(id),variant_code text not null references public.catalog_variants(code),quantity integer not null check(quantity>0),state text not null default 'active' check(state in ('active','released','consumed')),expires_at timestamptz not null,created_at timestamptz not null default now(),unique(order_id,variant_code));
create index stock_reservations_expiry on public.stock_reservations(expires_at) where state='active';
create table public.credit_reservations(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.customer_finance_accounts(user_id),order_id text not null unique references public.orders(id),amount numeric(18,2) not null check(amount>0),state text not null default 'active' check(state in ('active','released','captured')),expires_at timestamptz not null,created_at timestamptz not null default now());
create index credit_reservations_user on public.credit_reservations(user_id,state,expires_at);
create table public.payment_attempts(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.user_profiles(id),order_id text not null references public.orders(id),provider text not null,amount numeric(18,2) not null check(amount>0),currency text not null check(currency in ('IRR','IRT')),state text not null default 'pending' check(state in ('pending','verified','failed','cancelled')),request_key uuid not null unique,provider_reference text,evidence jsonb,created_at timestamptz not null default now(),verified_at timestamptz);
create unique index payment_attempt_provider_reference on public.payment_attempts(provider,provider_reference) where provider_reference is not null;
create unique index payment_attempt_one_verified_order on public.payment_attempts(order_id) where state='verified';
create index payment_attempt_user on public.payment_attempts(user_id,created_at);
create table public.payment_refunds(id uuid primary key default gen_random_uuid(),payment_id uuid not null references public.payment_attempts(id),amount numeric(18,2) not null check(amount>0),state text not null default 'pending' check(state in ('pending','verified','rejected')),request_key uuid not null unique,provider_reference text,evidence jsonb,created_at timestamptz not null default now());
create table public.order_shipments(id uuid primary key default gen_random_uuid(),order_id text not null references public.orders(id),carrier text not null,tracking_code text,state text not null default 'pending' check(state in ('pending','shipped','delivered','returned')),payload jsonb not null default '{}',created_at timestamptz not null default now());
create index order_shipments_order on public.order_shipments(order_id);
create table public.order_status_events(id uuid primary key default gen_random_uuid(),order_id text not null references public.orders(id),actor_id uuid references auth.users(id),from_status public.order_status_type,to_status public.order_status_type not null,note text not null default '',created_at timestamptz not null default now());
create index order_status_events_order on public.order_status_events(order_id,created_at);
create table public.user_addresses(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.user_profiles(id),title text not null,province text not null,city text not null,full_address text not null,postal_code text,recipient_name text,recipient_phone text,active boolean not null default true,created_at timestamptz not null default now());
create index user_addresses_user on public.user_addresses(user_id) where active;
create table public.document_assets(id uuid primary key default gen_random_uuid(),user_id uuid references public.user_profiles(id),bucket_id text not null check(bucket_id in ('catalogue','customer-documents')),object_path text not null,sha256 text check(sha256 ~ '^[a-f0-9]{64}$'),mime_type text not null,byte_size bigint not null check(byte_size>=0),purpose text not null,created_at timestamptz not null default now(),unique(bucket_id,object_path));
create index document_assets_user on public.document_assets(user_id);
create table public.ticket_messages(id uuid primary key default gen_random_uuid(),ticket_id text not null references public.support_tickets(id),author_id uuid not null references public.user_profiles(id),body text not null check(length(body) between 1 and 20000),internal boolean not null default false,file_id uuid references public.document_assets(id),created_at timestamptz not null default now());
create index ticket_messages_ticket on public.ticket_messages(ticket_id,created_at);
create table public.reward_redemptions(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.user_profiles(id),reward_id text not null references public.club_rewards(id),points_spent bigint not null check(points_spent>=0),state text not null default 'requested' check(state in ('requested','approved','fulfilled','rejected','cancelled')),request_key uuid not null unique,created_at timestamptz not null default now());
create table public.checkout_requests(user_id uuid not null references public.user_profiles(id),request_key uuid not null,order_id text not null references public.orders(id),request_sha256 text not null check(request_sha256 ~ '^[a-f0-9]{64}$'),created_at timestamptz not null default now(),primary key(user_id,request_key));
create table app_private.notification_outbox(id uuid primary key default gen_random_uuid(),user_id uuid references public.user_profiles(id),channel text not null check(channel in ('sms','email','in_app')),destination text not null,template text not null,payload jsonb not null default '{}',state text not null default 'pending' check(state in ('pending','sending','sent','failed')),attempts integer not null default 0 check(attempts>=0),request_key text not null unique,provider_reference text,last_error text,available_at timestamptz not null default now(),created_at timestamptz not null default now(),sent_at timestamptz);
create index notification_outbox_pending on app_private.notification_outbox(available_at) where state in ('pending','failed');
create table app_private.schema_change_log(version text primary key,description text not null,applied_at timestamptz not null default now());
do $$declare t text;begin foreach t in array array['customer_finance_accounts','financial_entries','inventory_events','stock_reservations','credit_reservations','payment_attempts','payment_refunds','order_shipments','order_status_events','user_addresses','document_assets','ticket_messages','reward_redemptions','checkout_requests'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);end loop;end$$;
alter table app_private.notification_outbox enable row level security;
alter table app_private.schema_change_log enable row level security;
revoke all on app_private.notification_outbox,app_private.schema_change_log from public,anon,authenticated;
grant select,insert,update on public.user_addresses to authenticated;
create policy own_address_read on public.user_addresses for select to authenticated using(user_id=(select auth.uid()));
create policy own_address_insert on public.user_addresses for insert to authenticated with check(user_id=(select auth.uid()));
create policy own_address_update on public.user_addresses for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

-- Financial accounts must be explicitly reconciled before first posting; no guessed opening balances.
create function app_private.post_financial_entry(p_user uuid,p_reference text,p_kind text,p_debt numeric default 0,p_wallet numeric default 0,p_points bigint default 0,p_order text default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare account public.customer_finance_accounts;old public.financial_entries;wallet numeric;points bigint;result uuid;begin
 select * into account from public.customer_finance_accounts where user_id=p_user for update;if not found then raise exception 'Reconciled opening account required';end if;
 if nullif(p_reference,'') is null or p_debt is null or p_wallet is null or p_points is null then raise exception 'Invalid financial entry';end if;
 select * into old from public.financial_entries where user_id=p_user and reference=p_reference;
 if found then if old.debt_delta<>p_debt or old.wallet_delta<>p_wallet or old.points_delta<>p_points or old.kind<>p_kind or old.order_id is distinct from p_order then raise exception 'Idempotency conflict';end if;return old.id;end if;
 if p_order is not null and not exists(select 1 from public.orders where id=p_order and user_id=p_user) then raise exception 'Order ownership mismatch';end if;
 select account.opening_wallet+coalesce(sum(wallet_delta),0),account.opening_points+coalesce(sum(points_delta),0) into wallet,points from public.financial_entries where user_id=p_user;
 if wallet+p_wallet<0 or points+p_points<0 then raise exception 'Insufficient wallet or points';end if;
 insert into public.financial_entries(user_id,reference,kind,debt_delta,wallet_delta,points_delta,order_id) values(p_user,p_reference,p_kind,p_debt,p_wallet,p_points,p_order) returning id into result;return result;
end$$;
create function app_private.adjust_stock(p_sku text,p_delta integer,p_reference text,p_reason text) returns integer language plpgsql security invoker set search_path='' as $$
declare old public.inventory_events;result integer;begin
 if p_delta is null or p_delta=0 or nullif(p_reference,'') is null or nullif(p_reason,'') is null then raise exception 'Invalid inventory adjustment';end if;
 perform 1 from public.variant_commercial_specs where variant_code=p_sku for update;if not found then raise exception 'Unknown SKU';end if;
 select * into old from public.inventory_events where variant_code=p_sku and reference=p_reference;if found then if old.quantity_delta<>p_delta or old.reason<>p_reason then raise exception 'Idempotency conflict';end if;select stock into result from public.variant_commercial_specs where variant_code=p_sku;return result;end if;
 update public.variant_commercial_specs set stock=stock+p_delta,stock_known=true,stock_version=stock_version+1,updated_at=now() where variant_code=p_sku and stock+p_delta>=stock_reserved returning stock into result;if not found then raise exception 'Insufficient unreserved stock';end if;
 insert into public.inventory_events(variant_code,quantity_delta,reference,reason) values(p_sku,p_delta,p_reference,p_reason);return result;
end$$;
create function app_private.reserve_order_stock(p_order text,p_expiry timestamptz) returns void language plpgsql security invoker set search_path='' as $$
declare item record;old public.stock_reservations;begin
 if p_expiry is null or p_expiry<=now() then raise exception 'Invalid reservation expiry';end if;
 perform 1 from public.orders where id=p_order and status not in ('cancelled','delivered') for update;if not found then raise exception 'Order not reservable';end if;
 if not exists(select 1 from public.order_items where order_id=p_order) then raise exception 'Empty order';end if;
 for item in select product_code,sum(quantity)::integer as quantity from public.order_items where order_id=p_order group by product_code order by product_code loop
 select * into old from public.stock_reservations where order_id=p_order and variant_code=item.product_code;
 if found then if old.quantity<>item.quantity or old.state<>'active' or old.expires_at<=now() then raise exception 'Reservation conflict';end if;continue;end if;
 update public.variant_commercial_specs set stock_reserved=stock_reserved+item.quantity,stock_version=stock_version+1 where variant_code=item.product_code and stock_known and stock-stock_reserved>=item.quantity;if not found then raise exception 'Insufficient known stock';end if;
 insert into public.stock_reservations(order_id,variant_code,quantity,expires_at) values(p_order,item.product_code,item.quantity,p_expiry);end loop;
end$$;
create function app_private.finish_order_stock(p_order text,p_consume boolean) returns void language plpgsql security invoker set search_path='' as $$
declare item record;begin
 if p_consume is null then raise exception 'Action required';end if;perform 1 from public.orders where id=p_order for update;
 for item in select * from public.stock_reservations where order_id=p_order and state='active' order by variant_code for update loop
 if p_consume and item.expires_at<=now() then raise exception 'Reservation expired';end if;
 update public.variant_commercial_specs set stock_reserved=stock_reserved-item.quantity,stock=stock-case when p_consume then item.quantity else 0 end,stock_version=stock_version+1 where variant_code=item.variant_code and stock_reserved>=item.quantity and (not p_consume or stock>=item.quantity);if not found then raise exception 'Reservation inconsistency';end if;
 update public.stock_reservations set state=case when p_consume then 'consumed' else 'released' end where id=item.id;
 if p_consume then insert into public.inventory_events(variant_code,quantity_delta,reference,reason) values(item.variant_code,-item.quantity,'reservation:'||item.id,'order fulfilment');end if;end loop;
end$$;
create function app_private.record_verified_payment(p_id uuid,p_reference text,p_amount numeric,p_currency text,p_evidence jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare payment public.payment_attempts;target public.orders;begin
 select * into payment from public.payment_attempts where id=p_id for update;if not found then raise exception 'Unknown payment';end if;
 if nullif(p_reference,'') is null or p_amount is distinct from payment.amount or p_currency is distinct from payment.currency or p_evidence is null or jsonb_typeof(p_evidence)<>'object' or p_evidence='{}'::jsonb then raise exception 'Payment verification mismatch';end if;
 if payment.state='verified' then if payment.provider_reference<>p_reference then raise exception 'Payment replay conflict';end if;return;end if;
 if payment.state<>'pending' then raise exception 'Payment not pending';end if;
 select * into target from public.orders where id=payment.order_id for update;
 if not found or target.user_id is distinct from payment.user_id or target.final_amount is distinct from payment.amount or target.currency is distinct from payment.currency or target.status='cancelled' then raise exception 'Order/payment mismatch';end if;
 update public.payment_attempts set state='verified',provider_reference=p_reference,evidence=p_evidence,verified_at=now() where id=p_id;
 update public.orders set payment_status='paid',receipt_verified=true,updated_at=now() where id=target.id;
end$$;
create function app_private.claim_notifications(p_limit integer default 20) returns setof app_private.notification_outbox language sql security invoker set search_path='' as $$
 update app_private.notification_outbox set state='sending',attempts=attempts+1 where id in(select id from app_private.notification_outbox where state in ('pending','failed') and available_at<=now() and attempts<5 order by available_at for update skip locked limit greatest(0,least(p_limit,100))) returning *;
$$;
create function app_private.reject_journal_edit() returns trigger language plpgsql security invoker set search_path='' as $$begin raise exception 'Append-only journal: use a compensating entry';end$$;
create trigger immutable_financial_entries before update or delete on public.financial_entries for each row execute function app_private.reject_journal_edit();
create trigger immutable_inventory_events before update or delete on public.inventory_events for each row execute function app_private.reject_journal_edit();
revoke execute on all functions in schema app_private from public,anon,authenticated;
grant execute on function app_private.content_visible(text,jsonb,jsonb,jsonb) to anon,authenticated;

create function app_private.hold_order_credit(p_user uuid,p_order text,p_expiry timestamptz) returns uuid language plpgsql security invoker set search_path='' as $$
declare account public.customer_finance_accounts;target public.orders;old public.credit_reservations;debt numeric;held numeric;limit_amount numeric;result uuid;begin
 select * into account from public.customer_finance_accounts where user_id=p_user for update;if not found then raise exception 'Reconciled opening account required';end if;
 select * into target from public.orders where id=p_order and user_id=p_user;if not found or target.final_amount is null or target.final_amount<=0 or target.currency<>account.currency or target.status='cancelled' or p_expiry is null or p_expiry<=now() then raise exception 'Invalid credit order';end if;
 select * into old from public.credit_reservations where order_id=p_order;if found then if old.user_id<>p_user or old.amount<>target.final_amount or old.state<>'active' or old.expires_at<=now() then raise exception 'Credit hold conflict';end if;return old.id;end if;
 select credit_limit into limit_amount from public.user_profiles where id=p_user and status='active';if limit_amount is null or limit_amount<=0 then raise exception 'Credit not authorized';end if;
 select account.opening_debt+coalesce(sum(debt_delta),0) into debt from public.financial_entries where user_id=p_user;
 select coalesce(sum(amount),0) into held from public.credit_reservations where user_id=p_user and state='active' and expires_at>now();
 if greatest(debt,0)+held+target.final_amount>limit_amount then raise exception 'Credit limit exceeded';end if;
 insert into public.credit_reservations(user_id,order_id,amount,expires_at) values(p_user,p_order,target.final_amount,p_expiry) returning id into result;return result;
end$$;
create function app_private.finish_order_credit(p_id uuid,p_capture boolean) returns void language plpgsql security invoker set search_path='' as $$
declare hold public.credit_reservations;begin
 if p_capture is null then raise exception 'Action required';end if;select * into hold from public.credit_reservations where id=p_id;if not found then raise exception 'Unknown credit hold';end if;
 perform 1 from public.customer_finance_accounts where user_id=hold.user_id for update;select * into hold from public.credit_reservations where id=p_id for update;
 if hold.state=(case when p_capture then 'captured' else 'released' end) then return;end if;
 if hold.state<>'active' then raise exception 'Credit hold finalized';end if;
 if p_capture then if hold.expires_at<=now() then raise exception 'Credit hold expired';end if;perform app_private.post_financial_entry(hold.user_id,'credit-hold:'||hold.id,'invoice',hold.amount,0,0,hold.order_id);end if;
 update public.credit_reservations set state=case when p_capture then 'captured' else 'released' end where id=p_id;
end$$;
create function app_private.record_verified_refund(p_id uuid,p_reference text,p_evidence jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare refund public.payment_refunds;payment public.payment_attempts;refunded numeric;begin
 select * into refund from public.payment_refunds where id=p_id;if not found then raise exception 'Unknown refund';end if;
 select * into payment from public.payment_attempts where id=refund.payment_id for update;
 select * into refund from public.payment_refunds where id=p_id for update;
 if payment.state<>'verified' or nullif(p_reference,'') is null or p_evidence is null or jsonb_typeof(p_evidence)<>'object' or p_evidence='{}'::jsonb then raise exception 'Refund verification mismatch';end if;
 if refund.state='verified' then if refund.provider_reference<>p_reference then raise exception 'Refund replay conflict';end if;return;end if;
 if refund.state<>'pending' then raise exception 'Refund not pending';end if;
 select coalesce(sum(amount),0) into refunded from public.payment_refunds where payment_id=payment.id and state='verified';
 if refunded+refund.amount>payment.amount then raise exception 'Refund exceeds payment';end if;
 update public.payment_refunds set state='verified',provider_reference=p_reference,evidence=p_evidence where id=p_id;
 if refunded+refund.amount=payment.amount then update public.orders set payment_status='refunded',updated_at=now() where id=payment.order_id;end if;
end$$;
create function app_private.release_expired_stock(p_limit integer default 100) returns integer language plpgsql security invoker set search_path='' as $$
declare item record;released integer=0;begin
 for item in select distinct order_id from public.stock_reservations where state='active' and expires_at<=now() order by order_id limit greatest(0,least(p_limit,1000)) loop perform app_private.finish_order_stock(item.order_id,false);released=released+1;end loop;return released;
end$$;
revoke execute on all functions in schema app_private from public,anon,authenticated;
grant execute on function app_private.content_visible(text,jsonb,jsonb,jsonb) to anon,authenticated;

-- Real Supabase Storage owns its catalogs. No custom auth.users/storage.objects replacements.
do $$begin
 if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then raise exception 'Supabase Storage schema required';end if;
 if exists(select 1 from storage.buckets where id='catalogue' and public is not true) or exists(select 1 from storage.buckets where id='customer-documents' and public is true) then raise exception 'Existing bucket visibility mismatch: review before changing';end if;
end$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('catalogue','catalogue',true,20971520,array['image/jpeg','image/png','image/webp','application/pdf']),('customer-documents','customer-documents',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do nothing;
create policy sanat_private_document_read on storage.objects for select to authenticated using(bucket_id='customer-documents' and split_part(name,'/',1)=(select auth.uid())::text);
create policy sanat_private_document_insert on storage.objects for insert to authenticated with check(bucket_id='customer-documents' and split_part(name,'/',1)=(select auth.uid())::text);
-- Uploads are append-only: no customer replacement/delete policy is added.
insert into app_private.schema_change_log(version,description) values('20261020083418','Adopt existing schema and harden authorization'),('20261020083459','Add financial journals, stock reservations, payment audit and private storage');


-- 20261020091555_adopted_runtime_bridge.sql
-- Private compatibility documents: legacy identifiers and unknown fields are retained.
-- Authentication and authorization remain in auth.users / public.user_profiles.
create table app_private.portal_version(singleton boolean primary key default true check(singleton),revision bigint not null default 0);
insert into app_private.portal_version(singleton,revision)
select true,coalesce((select (value->>'revision')::bigint from public.portal_kv_store where key='sanatpish:portal:db:v1'),0);
create table app_private.portal_users(id text primary key,auth_user_id uuid unique references auth.users(id),payload jsonb not null,active boolean not null default true);
create table app_private.auth_provisioning(id uuid primary key,phone text not null,payload jsonb not null,status text not null default 'pending' check(status in ('pending','linked')),created_at timestamptz not null default now());
create index auth_provisioning_phone_idx on app_private.auth_provisioning(phone,created_at desc) where status='pending';
create table app_private.document_versions(namespace text not null,scope_id text not null,version bigint not null default 0,content_sha256 text,value_kind text not null check(value_kind in ('array','object','scalar')),updated_at timestamptz not null default now(),primary key(namespace,scope_id));
create table app_private.scoped_documents(namespace text not null,scope_id text not null,value jsonb not null,primary key(namespace,scope_id));
create table app_private.source_archives(source_path text not null,sha256 text not null,payload jsonb not null,imported_at timestamptz not null default now(),primary key(source_path,sha256));
insert into app_private.document_versions(namespace,scope_id,version,value_kind)
select key,'global',1,case jsonb_typeof(value) when 'array' then 'array' when 'object' then 'object' else 'scalar' end from public.portal_kv_store;
insert into app_private.document_versions(namespace,scope_id,version,value_kind)
select key,'global',0,'array' from unnest(array['atlas_admin_orders_v1','atlas_admin_categories_v1','atlas_admin_brands_v1','atlas_admin_blog_v1','atlas_admin_pages_v1','atlas_clients_logos_v3_moshtari','atlas_admin_sms_templates_v1','atlas_admin_campaigns_v1','atlas_admin_tickets_v1','atlas_admin_audit_logs_v1','atlas_admin_discounts_v1','atlas_portal_layout_configs_v1']) key on conflict do nothing;
insert into app_private.portal_users(id,payload)
select u->>'id',u-'password'-'passwordHash'-'passwordSalt' from public.portal_kv_store k cross join lateral jsonb_array_elements(coalesce(k.value->'users','[]')) u where k.key='sanatpish:portal:db:v1';
alter table public.catalog_gallery_images add column identity_verified boolean not null default false;
alter table public.user_addresses add column legacy_id text;
create unique index user_addresses_legacy_idx on public.user_addresses(user_id,legacy_id);
do $$declare t text;begin foreach t in array array['portal_version','portal_users','auth_provisioning','document_versions','scoped_documents','source_archives'] loop execute format('alter table app_private.%I enable row level security',t);execute format('revoke all on app_private.%I from public,anon,authenticated',t);end loop;end$$;
alter function public.trigger_set_updated_at() set search_path='';
do $$declare f record;begin for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname='match_catalog_images_by_family' loop execute format('alter function %s set search_path=pg_catalog,public',f.signature);end loop;end$$;
insert into app_private.schema_change_log(version,description) values('20261020091555','Adopted runtime document bridge and catalog DTO compatibility');


-- 20261020093117_adopted_auth_rate_limits.sql
-- The existing Auth BFF rate-limit query needs this private runtime table.
create table app_private.rate_limits(bucket text primary key,attempts integer not null default 0 check(attempts>=0),expires_at timestamptz not null);
create index rate_limits_expiry on app_private.rate_limits(expires_at);
alter table app_private.rate_limits enable row level security;
revoke all on app_private.rate_limits from public,anon,authenticated;
insert into app_private.schema_change_log(version,description) values('20261020093117','Private durable Auth request throttling');


-- 20261021111500_adopted_announcements_lifecycle.sql
-- Enhance portal_announcements with 3-tier audience targeting (storefront, consumer, high_volume),
-- multi-customer selection, optional start/end timestamps, customer end-time visibility toggle,
-- and automatic expiration into archive.

alter table public.portal_announcements
  add column if not exists portal text not null default 'storefront',
  add column if not exists scope text not null default 'collective',
  add column if not exists target_customer_id text,
  add column if not exists target_customer_ids jsonb not null default '[]'::jsonb,
  add column if not exists tag text not null default 'اطلاعیه',
  add column if not exists highlight_value text,
  add column if not exists action_label text,
  add column if not exists action_tab text,
  add column if not exists action_link text,
  add column if not exists starts_at text,
  add column if not exists ends_at text,
  add column if not exists show_end_time_to_customer boolean not null default false,
  add column if not exists archived boolean not null default false,
  add column if not exists archived_at text;

create index if not exists idx_portal_announcements_lifecycle
  on public.portal_announcements(portal, active, archived);

create or replace function app_private.safe_timestamptz(p_value text)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  return p_value::timestamptz;
exception
  when others then
    return null;
end;
$$;

create or replace function app_private.content_visible(
  p_portal text,
  p_payload jsonb,
  p_roles jsonb default '[]',
  p_grades jsonb default '[]'
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  u public.user_profiles;
  v_scope text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_archived boolean;
  v_ids jsonb;
begin
  if public.is_admin_user() then
    return true;
  end if;

  v_archived := coalesce((p_payload->>'archived')::boolean, false);
  if v_archived then
    return false;
  end if;

  v_starts := app_private.safe_timestamptz(p_payload->>'startsAt');
  if v_starts is not null and v_starts > now() then
    return false;
  end if;

  v_ends := coalesce(
    app_private.safe_timestamptz(p_payload->>'endsAt'),
    app_private.safe_timestamptz(p_payload->>'expiresAt')
  );
  if v_ends is not null and v_ends <= now() then
    return false;
  end if;

  v_scope := coalesce(nullif(p_payload->>'scope', ''), 'collective');

  if p_portal = 'storefront'
     and v_scope = 'collective'
     and coalesce(p_payload->>'targetCustomerId', '') = ''
     and coalesce(p_roles, '[]') = '[]'
     and coalesce(p_grades, '[]') = '[]' then
    return true;
  end if;

  select * into u
  from public.user_profiles
  where id = (select auth.uid()) and status = 'active';

  if not found then
    return false;
  end if;

  if p_portal not in ('consumer', 'high_volume', 'storefront') or p_portal is null then
    return false;
  end if;

  if p_portal = 'high_volume' and not u.approved_b2b then
    return false;
  end if;

  if p_portal = 'consumer' and u.approved_b2b then
    return false;
  end if;

  if v_scope in ('individual', 'selected') then
    v_ids := case
      when jsonb_typeof(p_payload->'targetCustomerIds') = 'array' then p_payload->'targetCustomerIds'
      else '[]'::jsonb
    end;
    if p_payload->>'targetCustomerId' is distinct from coalesce(u.legacy_user_id, u.id::text)
       and p_payload->>'targetCustomerId' is distinct from u.id::text
       and not (v_ids @> jsonb_build_array(u.id::text))
       and not (u.legacy_user_id is not null and v_ids @> jsonb_build_array(u.legacy_user_id)) then
      return false;
    end if;
  end if;

  if coalesce(p_roles, '[]') <> '[]' and not p_roles @> jsonb_build_array(u.role::text) then
    return false;
  end if;

  if coalesce(p_grades, '[]') <> '[]' and not p_grades @> jsonb_build_array(u.grade_code) then
    return false;
  end if;

  if nullif(p_payload->>'targetTierCode', '') is not null
     and p_payload->>'targetTierCode' <> 'ALL'
     and p_payload->>'targetTierCode' is distinct from u.grade_code then
    return false;
  end if;

  return true;
end;
$$;

grant execute on function app_private.safe_timestamptz(text) to anon, authenticated;
grant execute on function app_private.content_visible(text, jsonb, jsonb, jsonb) to anon, authenticated;

alter policy "Public read active announcements" on public.portal_announcements
  using (
    public.is_admin_user() or (
      active
      and not coalesce(archived, false)
      and (app_private.safe_timestamptz(starts_at) is null or app_private.safe_timestamptz(starts_at) <= now())
      and (app_private.safe_timestamptz(coalesce(ends_at, expires_at)) is null or app_private.safe_timestamptz(coalesce(ends_at, expires_at)) > now())
      and app_private.content_visible(
        coalesce(nullif(raw_payload->>'portal', ''), nullif(portal, ''), 'consumer'),
        raw_payload,
        target_roles,
        target_grades
      )
    )
  );

insert into app_private.schema_change_log(version, description)
values ('20261021111500', 'Add 3-tier portal announcements scheduling, customer targeting, and auto-archive');


-- 20261022120000_adopted_complete_projections_and_backfill.sql
-- 20261022120000_adopted_complete_projections_and_backfill.sql
-- Complete relational projections for all adopted domains and fault-tolerant KV-to-table backfill function.
-- Additive only: preserves all original rows, identifiers, currencies, and column digests.

-- Ensure prerequisite columns from 20261020 / 20261021 exist before backfill
alter table public.price_lists
  add column if not exists discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100);

alter table public.club_milestones
  add column if not exists portal text check (portal in ('consumer', 'high_volume')),
  add column if not exists min_purchase_volume numeric(18,2) check (min_purchase_volume >= 0);

alter table public.portal_announcements
  add column if not exists summary text,
  add column if not exists portal text not null default 'storefront',
  add column if not exists scope text not null default 'collective',
  add column if not exists target_customer_id text,
  add column if not exists target_customer_ids jsonb not null default '[]'::jsonb,
  add column if not exists tag text not null default 'اطلاعیه',
  add column if not exists highlight_value text,
  add column if not exists action_label text,
  add column if not exists action_tab text,
  add column if not exists action_link text,
  add column if not exists starts_at text,
  add column if not exists ends_at text,
  add column if not exists show_end_time_to_customer boolean not null default false,
  add column if not exists archived boolean not null default false,
  add column if not exists archived_at text;

create index if not exists idx_portal_announcements_lifecycle
  on public.portal_announcements(portal, active, archived);

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'agencies',
    'agency_applications',
    'agency_deposit_receipts',
    'agency_supply_requests',
    'agency_messages',
    'catalog_brands',
    'catalog_categories',
    'price_lists',
    'price_change_history',
    'price_inquiries',
    'discount_codes',
    'official_invoices',
    'plant_machinery_passports',
    'marketing_campaigns',
    'support_tickets',
    'industrial_chat_sessions',
    'client_logos',
    'blog_posts',
    'static_pages',
    'sms_templates',
    'sms_logs',
    'audit_logs',
    'portal_announcements',
    'portal_banners',
    'club_milestones'
  ]
  loop
    execute format(
      'alter table public.%I add column if not exists raw_payload jsonb not null default ''{}''::jsonb',
      tbl
    );
  end loop;
end$$;

insert into app_private.document_versions(namespace, scope_id, version, value_kind)
select
  k.key,
  'global',
  1,
  case jsonb_typeof(k.value)
    when 'array' then 'array'
    when 'object' then 'object'
    else 'scalar'
  end
from public.portal_kv_store k
on conflict (namespace, scope_id) do nothing;

insert into app_private.document_versions(namespace, scope_id, version, value_kind)
select
  s.namespace,
  s.scope_id,
  1,
  case jsonb_typeof(s.value)
    when 'array' then 'array'
    when 'object' then 'object'
    else 'scalar'
  end
from app_private.scoped_documents s
on conflict (namespace, scope_id) do nothing;

insert into app_private.document_versions(namespace, scope_id, version, value_kind)
select key, 'global', 0, 'array'
from unnest(array[
  'atlas_admin_customers_v1',
  'atlas_legacy_customers_v1',
  'atlas_customers_approval_v2',
  'atlas_admin_inquiries_v1',
  'hyper_sanat_inquiries_v2',
  'atlas_price_lists_v2',
  'atlas_price_list_history_v2',
  'atlas_admin_price_logs_v1',
  'atlas_customer_grades_v2',
  'atlas_club_rewards_v2',
  'atlas_customer_reward_assignments_v1',
  'atlas_portal_content_banners_v1',
  'atlas_admin_banners_v1',
  'atlas_portal_content_announcements_v1',
  'atlas_portal_club_milestones_v1',
  'atlas_portal_customer_overrides_v1',
  'atlas_admin_dealers_v1',
  'atlas_admin_active_agencies_v1',
  'hyper_sanat_approved_dealers_v1',
  'hyper_sanat_agency_applications_v1',
  'hyper_sanat_deposit_receipts_v1',
  'hyper_sanat_supply_requests_v1',
  'atlas_admin_supply_reqs_v1',
  'hyper_sanat_dealer_messages_v1',
  'atlas_admin_official_invoices_v1',
  'atlas_admin_sms_logs_v1',
  'hyper_sanat_sms_logs_v1',
  'hyper_sanat_sms_v2'
]) as key
on conflict (namespace, scope_id) do nothing;

insert into app_private.document_versions(namespace, scope_id, version, value_kind)
select key, 'global', 0, 'object'
from unnest(array[
  'atlas_portal_layout_configs_v1',
  'atlas_admin_club_config_v1',
  'atlas_admin_settings_v1',
  'catalog_overrides_db_v1',
  'sanatpish:portal:db:v1'
]) as key
on conflict (namespace, scope_id) do nothing;

-- Safe type-conversion helpers for legacy/Persian JSON strings
create or replace function app_private.safe_numeric(val text, fallback numeric default 0)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  cleaned text;
  matched text;
begin
  if val is null then
    return fallback;
  end if;
  cleaned := translate(val, '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩,٬_ ', '01234567890123456789');
  matched := (regexp_match(cleaned, '[-+]?[0-9]+(?:\.[0-9]+)?'))[1];
  if matched is null or matched = '' then
    return fallback;
  end if;
  begin
    return matched::numeric;
  exception when others then
    return fallback;
  end;
end;
$$;

create or replace function app_private.safe_int(val text, fallback integer default 0)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  num numeric;
begin
  num := app_private.safe_numeric(val, null);
  if num is null then
    return fallback;
  end if;
  begin
    return round(num)::integer;
  exception when others then
    return fallback;
  end;
end;
$$;

create or replace function app_private.safe_bool(val text, fallback boolean default false)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  norm text;
begin
  if val is null then
    return fallback;
  end if;
  norm := lower(btrim(translate(val, '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789')));
  if norm in ('true', 't', '1', 'yes', 'y', 'on', 'active', 'فعال') then
    return true;
  elsif norm in ('false', 'f', '0', 'no', 'n', 'off', 'inactive', 'غیرفعال') then
    return false;
  end if;
  return fallback;
end;
$$;

create or replace function app_private.safe_timestamptz(p_value text)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
declare
  norm text;
begin
  if p_value is null then
    return null;
  end if;
  norm := btrim(translate(p_value, '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'));
  if norm = '' or norm ~ '^(13|14)[0-9]{2}[/-]' then
    return null;
  end if;
  begin
    return norm::timestamptz;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function app_private.safe_jsonb_array(val jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when val is not null and jsonb_typeof(val) = 'array' then val else '[]'::jsonb end;
$$;

create or replace function app_private.safe_jsonb_object(val jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when val is not null and jsonb_typeof(val) = 'object' then val else '{}'::jsonb end;
$$;

revoke execute on function app_private.safe_numeric(text, numeric) from public, anon, authenticated;
revoke execute on function app_private.safe_int(text, integer) from public, anon, authenticated;
revoke execute on function app_private.safe_bool(text, boolean) from public, anon, authenticated;
grant execute on function app_private.safe_timestamptz(text) to anon, authenticated;
revoke execute on function app_private.safe_jsonb_array(jsonb) from public, anon, authenticated;
revoke execute on function app_private.safe_jsonb_object(jsonb) from public, anon, authenticated;

create or replace function app_private.backfill_relational_projections_from_kv()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  rec record;
  ms record;
  rec_fam record;
  rec_var record;
  rec_img record;
  item jsonb;
  v_id text;
  v_code text;
  v_slug text;
  v_name text;
  v_var_code text;
  v_img_id text;
  v_img_url text;
  v_agency_id text;
  v_order_id text;
  v_price_list_id text;
  v_crm_id text;
  v_grade_code text;
  v_reward_id text;
  v_user_id uuid;
  v_counts jsonb := '{}'::jsonb;
  v_n integer;
  v_skipped_errors integer := 0;
  v_error_details jsonb := '[]'::jsonb;
begin
  -- 0. Envelope & Object Keys in portal_kv_store (sanatpish:portal:db:v1, catalog_overrides_db_v1)
  v_n := 0;
  for rec in
    select value
    from public.portal_kv_store
    where key = 'sanatpish:portal:db:v1'
      and jsonb_typeof(value) = 'object'
  loop
    begin
      insert into app_private.portal_version(singleton, revision)
      values (true, greatest(0, coalesce(app_private.safe_int(rec.value->>'revision', 0), 0)))
      on conflict (singleton) do update
        set revision = greatest(app_private.portal_version.revision, excluded.revision);

      if jsonb_typeof(rec.value->'values') = 'object' then
        insert into public.portal_kv_store(key, value)
        select e.key, e.value
        from jsonb_each(rec.value->'values') as e(key, value)
        where nullif(btrim(e.key), '') is not null
        on conflict (key) do nothing;
      end if;

      if jsonb_typeof(rec.value->'users') = 'array' then
        for item in select * from jsonb_array_elements(rec.value->'users')
        loop
          begin
            v_id := nullif(btrim(item->>'id'), '');
            if v_id is not null then
              insert into app_private.portal_users(id, payload)
              values (v_id, item - 'password' - 'passwordHash' - 'passwordSalt')
              on conflict (id) do update
                set payload = app_private.portal_users.payload || excluded.payload
                where app_private.portal_users.payload is distinct from (app_private.portal_users.payload || excluded.payload);
              v_n := v_n + 1;
            end if;
          exception when others then
            v_skipped_errors := v_skipped_errors + 1;
            v_error_details := v_error_details || jsonb_build_array(
              jsonb_build_object('section', 'portal_users', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
            );
          end;
        end loop;
      end if;
    exception when others then
      v_skipped_errors := v_skipped_errors + 1;
      v_error_details := v_error_details || jsonb_build_array(
        jsonb_build_object('section', 'sanatpish:portal:db:v1', 'record_id', 'envelope', 'sqlstate', SQLSTATE, 'message', SQLERRM)
      );
    end;
  end loop;
  v_counts := v_counts || jsonb_build_object('portal_users_synced', v_n);

  -- 0a-2. Catalog Overrides (catalog_overrides_db_v1 -> catalog_families, catalog_variants, variant_commercial_specs, catalog_gallery_images non-destructive enrichment)
  v_n := 0;
  for rec in
    select value
    from public.portal_kv_store
    where key = 'catalog_overrides_db_v1'
      and jsonb_typeof(value) = 'object'
  loop
    begin
      if jsonb_typeof(rec.value->'families') = 'object' then
        for rec_fam in
          select e.key as fam_code, e.value as fam_val
          from jsonb_each(rec.value->'families') e
        loop
          begin
            -- Non-destructive update or insert into catalog_families using real columns (PK is code; NO id, slug, or raw_payload)
            insert into public.catalog_families(
              code,
              name,
              brand,
              category_slug,
              category_name,
              submenu,
              subcategory,
              unit,
              description,
              technical_specs,
              is_active,
              override_version
            )
            values (
              rec_fam.fam_code,
              coalesce(nullif(btrim(rec_fam.fam_val->>'name'), ''), rec_fam.fam_code),
              coalesce(nullif(btrim(rec_fam.fam_val->>'brand'), ''), 'ثبت نشده'),
              coalesce(nullif(btrim(rec_fam.fam_val->>'categorySlug'), ''), 'uncategorized'),
              coalesce(nullif(btrim(rec_fam.fam_val->>'categoryName'), ''), 'دسته‌بندی نشده'),
              nullif(btrim(rec_fam.fam_val->>'submenu'), ''),
              nullif(btrim(rec_fam.fam_val->>'subcategory'), ''),
              coalesce(nullif(btrim(rec_fam.fam_val->>'unit'), ''), 'عدد'),
              nullif(btrim(rec_fam.fam_val->>'description'), ''),
              case when jsonb_typeof(rec_fam.fam_val->'technicalSpecs') = 'array' then rec_fam.fam_val->'technicalSpecs' else '[]'::jsonb end,
              coalesce(app_private.safe_bool(rec_fam.fam_val->>'active', true), true),
              coalesce(app_private.safe_int(rec_fam.fam_val->>'overrideVersion', 1), 1)
            )
            on conflict (code) do update
              set name = coalesce(nullif(btrim(excluded.name), ''), public.catalog_families.name),
                  brand = case when excluded.brand <> 'ثبت نشده' then excluded.brand else public.catalog_families.brand end,
                  category_slug = case when excluded.category_slug <> 'uncategorized' then excluded.category_slug else public.catalog_families.category_slug end,
                  category_name = case when excluded.category_name <> 'دسته‌بندی نشده' then excluded.category_name else public.catalog_families.category_name end,
                  submenu = coalesce(excluded.submenu, public.catalog_families.submenu),
                  subcategory = coalesce(excluded.subcategory, public.catalog_families.subcategory),
                  unit = coalesce(nullif(btrim(excluded.unit), ''), public.catalog_families.unit),
                  description = coalesce(excluded.description, public.catalog_families.description),
                  technical_specs = case
                    when jsonb_typeof(excluded.technical_specs) = 'array' and jsonb_array_length(excluded.technical_specs) > 0
                    then excluded.technical_specs
                    else public.catalog_families.technical_specs
                  end,
                  is_active = coalesce(excluded.is_active, public.catalog_families.is_active),
                  override_version = greatest(public.catalog_families.override_version, excluded.override_version),
                  updated_at = now();

            -- Non-destructive synchronization of variants into catalog_variants and variant_commercial_specs
            if jsonb_typeof(rec_fam.fam_val->'variants') = 'array' then
              for rec_var in
                select value as v_val from jsonb_array_elements(rec_fam.fam_val->'variants')
              loop
                v_var_code := nullif(btrim(rec_var.v_val->>'code'), '');
                if v_var_code is not null then
                  insert into public.catalog_variants(
                    code,
                    family_code,
                    name,
                    size,
                    model,
                    brand,
                    unit,
                    active,
                    images,
                    technical_specs
                  )
                  values (
                    v_var_code,
                    rec_fam.fam_code,
                    coalesce(nullif(btrim(rec_var.v_val->>'name'), ''), v_var_code),
                    nullif(btrim(rec_var.v_val->>'size'), ''),
                    nullif(btrim(rec_var.v_val->>'model'), ''),
                    coalesce(nullif(btrim(rec_var.v_val->>'brand'), ''), nullif(btrim(rec_fam.fam_val->>'brand'), ''), 'ثبت نشده'),
                    coalesce(nullif(btrim(rec_var.v_val->>'unit'), ''), nullif(btrim(rec_fam.fam_val->>'unit'), ''), 'عدد'),
                    coalesce(app_private.safe_bool(rec_var.v_val->>'active', true), true),
                    case when jsonb_typeof(rec_var.v_val->'images') = 'array' then rec_var.v_val->'images' else '[]'::jsonb end,
                    case when jsonb_typeof(rec_var.v_val->'technicalSpecs') = 'array' then rec_var.v_val->'technicalSpecs' else '[]'::jsonb end
                  )
                  on conflict (code) do update
                    set name = coalesce(nullif(btrim(excluded.name), ''), public.catalog_variants.name),
                        size = coalesce(excluded.size, public.catalog_variants.size),
                        model = coalesce(excluded.model, public.catalog_variants.model),
                        brand = case when excluded.brand <> 'ثبت نشده' then excluded.brand else public.catalog_variants.brand end,
                        unit = coalesce(nullif(btrim(excluded.unit), ''), public.catalog_variants.unit),
                        active = coalesce(excluded.active, public.catalog_variants.active),
                        images = case
                          when jsonb_typeof(excluded.images) = 'array' and jsonb_array_length(excluded.images) > 0
                          then excluded.images
                          else public.catalog_variants.images
                        end,
                        technical_specs = case
                          when jsonb_typeof(excluded.technical_specs) = 'array' and jsonb_array_length(excluded.technical_specs) > 0
                          then excluded.technical_specs
                          else public.catalog_variants.technical_specs
                        end,
                        updated_at = now();

                  -- Commercial specifications (price, stock, inquiry_only) in variant_commercial_specs
                  insert into public.variant_commercial_specs(
                    variant_code,
                    family_code,
                    price,
                    base_price,
                    retail_price,
                    wholesale_price,
                    dealer_price,
                    stock,
                    stock_known,
                    inquiry_only,
                    currency
                  )
                  values (
                    v_var_code,
                    rec_fam.fam_code,
                    coalesce(app_private.safe_numeric(rec_var.v_val->>'price', 0), 0),
                    coalesce(app_private.safe_numeric(rec_var.v_val->'prices'->>'base', 0), 0),
                    coalesce(app_private.safe_numeric(rec_var.v_val->'prices'->>'retail', coalesce(app_private.safe_numeric(rec_var.v_val->>'price', 0), 0)), 0),
                    coalesce(app_private.safe_numeric(rec_var.v_val->'prices'->>'wholesale', 0), 0),
                    coalesce(app_private.safe_numeric(rec_var.v_val->'prices'->>'dealer', 0), 0),
                    coalesce(app_private.safe_int(rec_var.v_val->>'stock', 0), 0),
                    coalesce(app_private.safe_bool(rec_var.v_val->>'stockKnown', false), false),
                    coalesce(app_private.safe_bool(rec_var.v_val->>'inquiryOnly', true), true),
                    coalesce(nullif(btrim(rec_var.v_val->>'currency'), ''), 'IRR')
                  )
                  on conflict (variant_code) do update
                    set price = case when excluded.price > 0 then excluded.price else public.variant_commercial_specs.price end,
                        base_price = case when excluded.base_price > 0 then excluded.base_price else public.variant_commercial_specs.base_price end,
                        retail_price = case when excluded.retail_price > 0 then excluded.retail_price else public.variant_commercial_specs.retail_price end,
                        wholesale_price = case when excluded.wholesale_price > 0 then excluded.wholesale_price else public.variant_commercial_specs.wholesale_price end,
                        dealer_price = case when excluded.dealer_price > 0 then excluded.dealer_price else public.variant_commercial_specs.dealer_price end,
                        stock = case when excluded.stock_known then excluded.stock else public.variant_commercial_specs.stock end,
                        stock_known = public.variant_commercial_specs.stock_known or excluded.stock_known,
                        inquiry_only = case when excluded.retail_price > 0 or public.variant_commercial_specs.retail_price > 0 then false else public.variant_commercial_specs.inquiry_only end,
                        updated_at = now();
                end if;
              end loop;
            end if;

            -- Non-destructive synchronization of gallery images if present
            if jsonb_typeof(rec_fam.fam_val->'galleryImages') = 'array' then
              for rec_img in
                select value as i_val from jsonb_array_elements(rec_fam.fam_val->'galleryImages')
              loop
                v_img_id := nullif(btrim(rec_img.i_val->>'id'), '');
                v_img_url := nullif(btrim(rec_img.i_val->>'url'), '');
                if v_img_id is not null and v_img_url is not null then
                  insert into public.catalog_gallery_images(
                    id,
                    family_code,
                    variant_code,
                    file_name,
                    url,
                    scope,
                    title,
                    sort_order
                  )
                  values (
                    v_img_id,
                    rec_fam.fam_code,
                    nullif(btrim(rec_img.i_val->>'variantCode'), ''),
                    nullif(btrim(rec_img.i_val->>'fileName'), ''),
                    v_img_url,
                    case
                      when rec_img.i_val->>'scope' in ('family', 'family-example', 'variant', 'unassigned')
                      then (rec_img.i_val->>'scope')::public.image_scope_type
                      else 'family'::public.image_scope_type
                    end,
                    nullif(btrim(rec_img.i_val->>'title'), ''),
                    coalesce(app_private.safe_int(rec_img.i_val->>'order', 1), 1)
                  )
                  on conflict (id) do update
                    set url = excluded.url,
                        variant_code = coalesce(excluded.variant_code, public.catalog_gallery_images.variant_code),
                        file_name = coalesce(excluded.file_name, public.catalog_gallery_images.file_name),
                        title = coalesce(excluded.title, public.catalog_gallery_images.title),
                        sort_order = excluded.sort_order,
                        updated_at = now();
                end if;
              end loop;
            end if;

            v_n := v_n + 1;
          exception when others then
            v_skipped_errors := v_skipped_errors + 1;
            v_error_details := v_error_details || jsonb_build_array(
              jsonb_build_object('section', 'catalog_overrides_family', 'record_id', rec_fam.fam_code, 'sqlstate', SQLSTATE, 'message', SQLERRM)
            );
          end;
        end loop;
      end if;
    exception when others then
      v_skipped_errors := v_skipped_errors + 1;
      v_error_details := v_error_details || jsonb_build_array(
        jsonb_build_object('section', 'catalog_overrides', 'record_id', 'families', 'sqlstate', SQLSTATE, 'message', SQLERRM)
      );
    end;
  end loop;
  v_counts := v_counts || jsonb_build_object('catalog_overrides_synced', v_n);

  -- 0b. Price Lists (atlas_price_lists_v2 -> public.price_lists)
  v_n := 0;
  for rec in
    select value
    from public.portal_kv_store
    where key = 'atlas_price_lists_v2'
      and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := null;
        select p.id into v_id
        from public.price_lists p
        where p.id = nullif(btrim(item->>'id'), '')
           or (nullif(btrim(item->>'code'), '') is not null and (
                 p.id = btrim(item->>'code')
                 or lower(p.id) = lower('pl-grade-' || btrim(item->>'code'))
                 or p.raw_payload->>'code' = btrim(item->>'code')
               ))
        order by case when p.id = nullif(btrim(item->>'id'), '') then 0 else 1 end
        limit 1;

        v_id := coalesce(v_id, nullif(btrim(item->>'id'), ''), nullif(btrim(item->>'code'), ''));
        if v_id is not null then
          insert into public.price_lists(
            id, name, description, currency, target_grades, is_default, is_active,
            valid_from, valid_until, items, discount_percent, raw_payload
          )
          values (
            v_id,
            coalesce(nullif(btrim(item->>'name'), ''), nullif(btrim(item->>'adminTitle'), ''), nullif(btrim(item->>'code'), ''), v_id),
            item->>'description',
            case when (item->>'currency') in ('IRR', 'IRT') then item->>'currency' else 'IRR' end,
            case
              when jsonb_typeof(item->'targetGrades') = 'array' then item->'targetGrades'
              when nullif(btrim(item->>'clubTier'), '') is not null then jsonb_build_array(btrim(item->>'clubTier'))
              else '[]'::jsonb
            end,
            app_private.safe_bool(coalesce(item->>'isDefault', item->>'isRetailCash'), false),
            app_private.safe_bool(coalesce(item->>'isActive', item->>'active'), true),
            app_private.safe_timestamptz(item->>'validFrom'),
            app_private.safe_timestamptz(item->>'validUntil'),
            app_private.safe_jsonb_object(coalesce(item->'items', item->'customProductPrices', item->'skuPrices')),
            least(100, greatest(0, coalesce(app_private.safe_numeric(coalesce(item->>'discountPercent', item->>'defaultDiscountPercent'), 0), 0))),
            item
          )
          on conflict (id) do update
            set raw_payload = public.price_lists.raw_payload || excluded.raw_payload,
                discount_percent = case
                  when public.price_lists.discount_percent = 0 and excluded.discount_percent <> 0
                    then excluded.discount_percent
                  else public.price_lists.discount_percent
                end,
                items = case
                  when public.price_lists.items = '{}'::jsonb and excluded.items <> '{}'::jsonb
                    then excluded.items
                  else public.price_lists.items
                end
            where public.price_lists.raw_payload is distinct from (public.price_lists.raw_payload || excluded.raw_payload)
               or (public.price_lists.discount_percent = 0 and excluded.discount_percent <> 0)
               or (public.price_lists.items = '{}'::jsonb and excluded.items <> '{}'::jsonb);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'price_lists', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('price_lists', v_n);

  -- 0c. Portal Announcements (atlas_portal_content_announcements_v1 -> public.portal_announcements)
  v_n := 0;
  for rec in
    select value
    from public.portal_kv_store
    where key = 'atlas_portal_content_announcements_v1'
      and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := null;
        select a.id into v_id
        from public.portal_announcements a
        where a.id = nullif(btrim(item->>'id'), '')
           or (nullif(btrim(item->>'title'), '') is not null and a.title = btrim(item->>'title'))
        order by case when a.id = nullif(btrim(item->>'id'), '') then 0 else 1 end
        limit 1;

        v_id := coalesce(v_id, nullif(btrim(item->>'id'), ''));
        if v_id is not null then
          insert into public.portal_announcements(
            id, title, body, priority, target_roles, target_grades, pinned, active, expires_at,
            portal, scope, target_customer_id, target_customer_ids, tag, highlight_value,
            action_label, action_tab, action_link, starts_at, ends_at,
            show_end_time_to_customer, archived, archived_at, raw_payload
          )
          values (
            v_id,
            coalesce(nullif(btrim(item->>'title'), ''), 'اطلاعیه'),
            coalesce(nullif(btrim(item->>'body'), ''), nullif(btrim(item->>'content'), ''), '-'),
            coalesce(nullif(btrim(item->>'priority'), ''), 'normal'),
            app_private.safe_jsonb_array(item->'targetRoles'),
            app_private.safe_jsonb_array(item->'targetGrades'),
            app_private.safe_bool(item->>'pinned', false),
            app_private.safe_bool(item->>'active', true),
            coalesce(item->>'expiresAt', item->>'endsAt'),
            case
              when (item->>'portal') in ('storefront', 'consumer', 'high_volume') then item->>'portal'
              else 'consumer'
            end,
            coalesce(nullif(btrim(item->>'scope'), ''), 'collective'),
            nullif(btrim(item->>'targetCustomerId'), ''),
            app_private.safe_jsonb_array(item->'targetCustomerIds'),
            coalesce(nullif(btrim(item->>'tag'), ''), 'اطلاعیه'),
            item->>'highlightValue',
            item->>'actionLabel',
            item->>'actionTab',
            item->>'actionLink',
            item->>'startsAt',
            coalesce(item->>'endsAt', item->>'expiresAt'),
            app_private.safe_bool(item->>'showEndTimeToCustomer', false),
            app_private.safe_bool(item->>'archived', false),
            item->>'archivedAt',
            item
          )
          on conflict (id) do update
            set portal = case
                  when (excluded.raw_payload->>'portal') in ('storefront', 'consumer', 'high_volume')
                    then excluded.raw_payload->>'portal'
                  else public.portal_announcements.portal
                end,
                scope = coalesce(nullif(btrim(excluded.raw_payload->>'scope'), ''), public.portal_announcements.scope),
                target_customer_id = coalesce(public.portal_announcements.target_customer_id, excluded.target_customer_id),
                target_customer_ids = case
                  when public.portal_announcements.target_customer_ids = '[]'::jsonb and excluded.target_customer_ids <> '[]'::jsonb
                    then excluded.target_customer_ids
                  else public.portal_announcements.target_customer_ids
                end,
                tag = case
                  when public.portal_announcements.tag = 'اطلاعیه' and excluded.tag <> 'اطلاعیه'
                    then excluded.tag
                  else public.portal_announcements.tag
                end,
                highlight_value = coalesce(public.portal_announcements.highlight_value, excluded.highlight_value),
                action_label = coalesce(public.portal_announcements.action_label, excluded.action_label),
                action_tab = coalesce(public.portal_announcements.action_tab, excluded.action_tab),
                action_link = coalesce(public.portal_announcements.action_link, excluded.action_link),
                starts_at = coalesce(public.portal_announcements.starts_at, excluded.starts_at),
                ends_at = coalesce(public.portal_announcements.ends_at, excluded.ends_at, public.portal_announcements.expires_at),
                show_end_time_to_customer = coalesce(app_private.safe_bool(excluded.raw_payload->>'showEndTimeToCustomer', null), public.portal_announcements.show_end_time_to_customer),
                archived = coalesce(app_private.safe_bool(excluded.raw_payload->>'archived', null), public.portal_announcements.archived),
                archived_at = coalesce(public.portal_announcements.archived_at, excluded.archived_at),
                raw_payload = public.portal_announcements.raw_payload || excluded.raw_payload
            where public.portal_announcements.raw_payload is distinct from (public.portal_announcements.raw_payload || excluded.raw_payload)
               or (
                 (excluded.raw_payload->>'portal') in ('storefront', 'consumer', 'high_volume')
                 and public.portal_announcements.portal is distinct from (excluded.raw_payload->>'portal')
               )
               or (public.portal_announcements.tag = 'اطلاعیه' and excluded.tag <> 'اطلاعیه')
               or (public.portal_announcements.highlight_value is null and excluded.highlight_value is not null)
               or (public.portal_announcements.action_label is null and excluded.action_label is not null)
               or (public.portal_announcements.action_tab is null and excluded.action_tab is not null)
               or (public.portal_announcements.action_link is null and excluded.action_link is not null);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'portal_announcements', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('portal_announcements', v_n);

  -- 0d. Portal Banners (atlas_portal_content_banners_v1, atlas_admin_banners_v1 -> public.portal_banners)
  v_n := 0;
  for rec in
    select key, value
    from public.portal_kv_store
    where key in ('atlas_portal_content_banners_v1', 'atlas_admin_banners_v1')
      and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := null;
        select b.id into v_id
        from public.portal_banners b
        where b.id = nullif(btrim(item->>'id'), '')
           or (
             nullif(btrim(item->>'title'), '') is not null
             and b.title = btrim(item->>'title')
             and b.scope = case
               when rec.key = 'atlas_admin_banners_v1' then 'storefront'
               when (item->>'portal') in ('consumer', 'high_volume', 'storefront') then item->>'portal'
               when (item->>'scope') in ('consumer', 'high_volume', 'storefront') then item->>'scope'
               else 'consumer'
             end
           )
        order by case when b.id = nullif(btrim(item->>'id'), '') then 0 else 1 end
        limit 1;

        v_id := coalesce(v_id, nullif(btrim(item->>'id'), ''));
        if v_id is not null then
          insert into public.portal_banners(
            id, scope, title, subtitle, image_url, link_url, cta_text,
            position, target_roles, sort_order, active, valid_until, raw_payload
          )
          values (
            v_id,
            case
              when rec.key = 'atlas_admin_banners_v1' then 'storefront'
              when (item->>'portal') in ('consumer', 'high_volume', 'storefront') then item->>'portal'
              when (item->>'scope') in ('consumer', 'high_volume', 'storefront') then item->>'scope'
              else 'consumer'
            end,
            coalesce(nullif(btrim(item->>'title'), ''), nullif(btrim(item->>'badgeText'), ''), v_id),
            item->>'subtitle',
            coalesce(item->>'imageUrl', item->>'backgroundImage', item->>'image', ''),
            coalesce(item->>'linkUrl', item->>'link', item->>'ctaLinkOrTab'),
            item->>'ctaText',
            coalesce(nullif(btrim(item->>'position'), ''), 'hero_slider'),
            app_private.safe_jsonb_array(item->'targetRoles'),
            coalesce(app_private.safe_int(coalesce(item->>'sortOrder', item->>'order'), 1), 1),
            app_private.safe_bool(item->>'active', true),
            item->>'validUntil',
            item
          )
          on conflict (id) do update
            set raw_payload = public.portal_banners.raw_payload || excluded.raw_payload
            where public.portal_banners.raw_payload is distinct from (public.portal_banners.raw_payload || excluded.raw_payload);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'portal_banners', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('portal_banners', v_n);

  -- 0e. Club Milestones (atlas_portal_club_milestones_v1 -> public.club_milestones, supports array and object formats)
  v_n := 0;
  for rec in
    select value
    from public.portal_kv_store
    where key = 'atlas_portal_club_milestones_v1'
      and jsonb_typeof(value) in ('array', 'object')
  loop
    for ms in
      select null::text as portal_key, elem as item, ord::integer as ord
      from jsonb_array_elements(
        case when jsonb_typeof(rec.value) = 'array' then rec.value else '[]'::jsonb end
      ) with ordinality as a(elem, ord)
      union all
      select p.key as portal_key, elem as item, ord::integer as ord
      from jsonb_each(
        case when jsonb_typeof(rec.value) = 'object' then rec.value else '{}'::jsonb end
      ) as p(key, arr)
      cross join lateral jsonb_array_elements(app_private.safe_jsonb_array(arr)) with ordinality as o(elem, ord)
      where p.key in ('consumer', 'high_volume')
    loop
      item := ms.item;
      begin
        v_id := null;
        if ms.portal_key is null then
          select m.id into v_id
          from public.club_milestones m
          where m.id = coalesce(nullif(btrim(item->>'id'), ''), nullif(btrim(item->>'code'), ''), nullif(btrim(item->>'tierKey'), ''))
             or m.id = 'ms-highvol-' || coalesce(nullif(btrim(item->>'code'), ''), nullif(btrim(item->>'tierKey'), ''))
             or m.id = 'ms-highvol-' || upper(coalesce(nullif(btrim(item->>'code'), ''), nullif(btrim(item->>'tierKey'), ''))::text)
             or (nullif(btrim(item->>'code'), '') is not null and (m.id = btrim(item->>'code') or m.raw_payload->>'code' = btrim(item->>'code')))
             or (nullif(btrim(item->>'tierKey'), '') is not null and (m.id = btrim(item->>'tierKey') or m.raw_payload->>'tierKey' = btrim(item->>'tierKey')))
             or (nullif(btrim(coalesce(item->>'title', item->>'publicTitle')), '') is not null and m.title = btrim(coalesce(item->>'title', item->>'publicTitle')))
          order by case
            when m.id = coalesce(nullif(btrim(item->>'id'), ''), nullif(btrim(item->>'code'), ''), nullif(btrim(item->>'tierKey'), '')) then 0
            when m.id = 'ms-highvol-' || upper(coalesce(nullif(btrim(item->>'tierKey'), ''), nullif(btrim(item->>'code'), ''))::text) then 1
            else 2
          end
          limit 1;
        else
          select m.id into v_id
          from public.club_milestones m
          where m.id = ms.portal_key || ':' || coalesce(nullif(btrim(item->>'id'), ''), nullif(btrim(item->>'code'), ''), nullif(btrim(item->>'tierKey'), ''))
             or m.id = 'ms-highvol-' || upper(coalesce(nullif(btrim(item->>'tierKey'), ''), nullif(btrim(item->>'code'), ''))::text)
             or (m.portal = ms.portal_key and (m.id = coalesce(nullif(btrim(item->>'id'), ''), nullif(btrim(item->>'code'), ''), nullif(btrim(item->>'tierKey'), '')) or m.id = 'ms-highvol-' || upper(coalesce(nullif(btrim(item->>'tierKey'), ''), nullif(btrim(item->>'code'), ''))::text)))
          limit 1;
        end if;

        if v_id is null then
          if upper(coalesce(item->>'tierKey', item->>'code', '')) in ('A', 'B', 'C', 'D') then
            v_id := 'ms-highvol-' || upper(coalesce(item->>'tierKey', item->>'code'));
          else
            v_id := coalesce(nullif(btrim(item->>'id'), ''), nullif(btrim(item->>'code'), ''), nullif(btrim(item->>'tierKey'), ''), 'ms-' || ms.ord::text);
            if ms.portal_key is not null and v_id not like (ms.portal_key || ':%') and v_id not like 'ms-highvol-%' then
              v_id := ms.portal_key || ':' || v_id;
            end if;
          end if;
        end if;

        if v_id is not null then
          insert into public.club_milestones(
            id, title, target_points, reward_title, reward_type, reward_value,
            icon, sort_order, active, portal, min_purchase_volume, raw_payload
          )
          values (
            v_id,
            coalesce(nullif(btrim(item->>'title'), ''), nullif(btrim(item->>'publicTitle'), ''), v_id),
            coalesce(app_private.safe_int(coalesce(item->>'targetPoints', item->>'target_points', item->>'minPurchaseVolume', item->>'discountPercent'), 0), 0),
            coalesce(
              nullif(btrim(item->>'rewardTitle'), ''),
              nullif(btrim(item->>'reward_title'), ''),
              nullif(btrim(item->>'summaryBenefit'), ''),
              coalesce(nullif(btrim(item->>'title'), ''), nullif(btrim(item->>'publicTitle'), ''), v_id)
            ),
            coalesce(nullif(btrim(coalesce(item->>'rewardType', item->>'reward_type')), ''), 'discount'),
            coalesce(item->>'rewardValue', item->>'reward_value', case when item->>'discountPercent' is not null then (item->>'discountPercent') || '%' else null end),
            item->>'icon',
            coalesce(app_private.safe_int(coalesce(item->>'sortOrder', item->>'sort_order'), ms.ord), ms.ord),
            app_private.safe_bool(item->>'active', true),
            case
              when coalesce(ms.portal_key, item->>'portal') in ('consumer', 'high_volume')
                then coalesce(ms.portal_key, item->>'portal')
              else null
            end,
            app_private.safe_numeric(coalesce(item->>'minPurchaseVolume', item->>'min_purchase_volume'), null),
            item
          )
          on conflict (id) do update
            set min_purchase_volume = coalesce(public.club_milestones.min_purchase_volume, excluded.min_purchase_volume),
                portal = coalesce(public.club_milestones.portal, excluded.portal),
                raw_payload = public.club_milestones.raw_payload || excluded.raw_payload
            where public.club_milestones.raw_payload is distinct from (public.club_milestones.raw_payload || excluded.raw_payload)
               or (public.club_milestones.min_purchase_volume is null and excluded.min_purchase_volume is not null)
               or (public.club_milestones.portal is null and excluded.portal is not null);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'club_milestones', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('club_milestones', v_n);

  -- 1. Agencies (atlas_admin_dealers_v1, atlas_admin_active_agencies_v1, hyper_sanat_approved_dealers_v1)
  v_n := 0;
  for rec in
    select key, value
    from public.portal_kv_store
    where key in ('atlas_admin_dealers_v1', 'atlas_admin_active_agencies_v1', 'hyper_sanat_approved_dealers_v1')
      and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := coalesce(nullif(btrim(item->>'id'), ''), nullif(btrim(item->>'code'), ''), nullif(btrim(item->>'agencyCode'), ''));
        v_code := coalesce(nullif(btrim(item->>'code'), ''), nullif(btrim(item->>'agencyCode'), ''), v_id);
        if v_id is not null and v_code is not null then
          if exists (select 1 from public.agencies a where a.code = v_code and a.id <> v_id) then
            v_code := v_code || '-' || v_id;
          end if;
          insert into public.agencies(
            id, code, name, company_name, phone, province, city, address,
            latitude, longitude, credit_limit, current_balance, next_check_date,
            contract_status, discount_percent, sub_users, territories,
            is_public_representative, raw_payload
          )
          values (
            v_id,
            v_code,
            coalesce(nullif(btrim(item->>'name'), ''), nullif(btrim(item->>'companyName'), ''), nullif(btrim(item->>'managerName'), ''), v_id),
            coalesce(nullif(btrim(item->>'companyName'), ''), nullif(btrim(item->>'name'), '')),
            coalesce(item->>'phone', ''),
            coalesce(item->>'province', ''),
            coalesce(item->>'city', ''),
            item->>'address',
            app_private.safe_numeric(item->>'latitude', null)::double precision,
            app_private.safe_numeric(item->>'longitude', null)::double precision,
            coalesce(app_private.safe_numeric(item->>'creditLimit', 0), 0),
            coalesce(app_private.safe_numeric(coalesce(item->>'currentBalance', item->>'currentDebt'), 0), 0),
            item->>'nextCheckDate',
            coalesce(nullif(btrim(item->>'contractStatus'), ''), 'valid'),
            least(100, greatest(0, coalesce(app_private.safe_numeric(item->>'discountPercent', 15), 15))),
            app_private.safe_jsonb_array(item->'subUsers'),
            app_private.safe_jsonb_array(item->'territories'),
            app_private.safe_bool(item->>'isPublicRepresentative', true),
            item
          )
          on conflict (id) do update
            set raw_payload = public.agencies.raw_payload || excluded.raw_payload
            where public.agencies.raw_payload is distinct from (public.agencies.raw_payload || excluded.raw_payload);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'agencies', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('agencies', v_n);

  -- 2. Agency Applications (hyper_sanat_agency_applications_v1)
  v_n := 0;
  for rec in
    select value
    from public.portal_kv_store
    where key = 'hyper_sanat_agency_applications_v1'
      and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := nullif(btrim(item->>'id'), '');
        if v_id is not null then
          insert into public.agency_applications(
            id, full_name, company_name, phone, email, province, city, address,
            store_area_sqm, ownership_type, experience_years, active_brands,
            requested_categories, documents, status, admin_note, reviewed_at, raw_payload
          )
          values (
            v_id,
            coalesce(nullif(btrim(item->>'fullName'), ''), nullif(btrim(item->>'managerName'), ''), nullif(btrim(item->>'companyName'), ''), 'متقاضی نمایندگی'),
            item->>'companyName',
            coalesce(nullif(btrim(item->>'phone'), ''), nullif(btrim(item->>'tel'), ''), ''),
            item->>'email',
            coalesce(item->>'province', ''),
            coalesce(item->>'city', ''),
            coalesce(item->>'address', item->>'fullAddress'),
            app_private.safe_int(item->>'storeAreaSqm', null),
            item->>'ownershipType',
            coalesce(app_private.safe_int(coalesce(item->>'experienceYears', item->>'activityYears'), 0), 0),
            case
              when jsonb_typeof(item->'activeBrands') = 'array' then (select string_agg(x, ', ') from jsonb_array_elements_text(item->'activeBrands') as x)
              else item->>'activeBrands'
            end,
            case
              when jsonb_typeof(item->'requestedCategories') = 'array' then item->'requestedCategories'
              when jsonb_typeof(item->'activityFields') = 'array' then item->'activityFields'
              else '[]'::jsonb
            end,
            app_private.safe_jsonb_array(item->'documents'),
            coalesce(nullif(btrim(item->>'status'), ''), 'pending'),
            coalesce(item->>'adminNote', item->>'notes'),
            app_private.safe_timestamptz(item->>'reviewedAt'),
            item
          )
          on conflict (id) do update
            set raw_payload = public.agency_applications.raw_payload || excluded.raw_payload
            where public.agency_applications.raw_payload is distinct from (public.agency_applications.raw_payload || excluded.raw_payload);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'agency_applications', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('agency_applications', v_n);

  -- 3. Agency Deposit Receipts (hyper_sanat_deposit_receipts_v1)
  v_n := 0;
  for rec in
    select value
    from public.portal_kv_store
    where key = 'hyper_sanat_deposit_receipts_v1'
      and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := nullif(btrim(item->>'id'), '');
        if v_id is not null then
          v_agency_id := null;
          select a.id into v_agency_id
          from public.agencies a
          where a.id = (item->>'agencyId') or a.code = coalesce(item->>'agencyCode', item->>'dealerCode')
          limit 1;
          insert into public.agency_deposit_receipts(
            id, agency_id, dealer_name, amount, tracking_code, deposit_date,
            bank_name, receipt_image_url, status, admin_note, raw_payload
          )
          values (
            v_id,
            v_agency_id,
            coalesce(nullif(btrim(item->>'dealerName'), ''), 'نماینده'),
            coalesce(app_private.safe_numeric(item->>'amount', 0), 0),
            coalesce(nullif(btrim(item->>'trackingCode'), ''), nullif(btrim(item->>'trackingNumber'), ''), v_id),
            coalesce(item->>'depositDate', item->>'paymentDate'),
            item->>'bankName',
            coalesce(item->>'receiptImageUrl', item->>'receiptImage'),
            coalesce(nullif(btrim(item->>'status'), ''), 'pending'),
            coalesce(item->>'adminNote', item->>'notes'),
            item
          )
          on conflict (id) do update
            set raw_payload = public.agency_deposit_receipts.raw_payload || excluded.raw_payload
            where public.agency_deposit_receipts.raw_payload is distinct from (public.agency_deposit_receipts.raw_payload || excluded.raw_payload);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'agency_deposit_receipts', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('agency_deposit_receipts', v_n);

  -- 4. Agency Supply Requests (hyper_sanat_supply_requests_v1, atlas_admin_supply_reqs_v1)
  v_n := 0;
  for rec in
    select value
    from public.portal_kv_store
    where key in ('hyper_sanat_supply_requests_v1', 'atlas_admin_supply_reqs_v1')
      and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := nullif(btrim(item->>'id'), '');
        if v_id is not null then
          v_agency_id := null;
          select a.id into v_agency_id
          from public.agencies a
          where a.id = (item->>'agencyId') or a.code = coalesce(item->>'agencyCode', item->>'dealerCode')
          limit 1;
          insert into public.agency_supply_requests(
            id, agency_id, agency_name, product_code, product_name,
            quantity, urgency, status, notes, raw_payload
          )
          values (
            v_id,
            v_agency_id,
            coalesce(nullif(btrim(item->>'agencyName'), ''), nullif(btrim(item->>'dealerName'), ''), 'نماینده'),
            coalesce(nullif(btrim(item->>'productCode'), ''), nullif(btrim(item->>'partCode'), ''), nullif(btrim(item->>'requestNumber'), ''), v_id),
            coalesce(nullif(btrim(item->>'productName'), ''), nullif(btrim(item->>'partName'), ''), 'قطعه صنعتی'),
            greatest(1, coalesce(app_private.safe_int(item->>'quantity', 1), 1)),
            coalesce(nullif(btrim(item->>'urgency'), ''), 'normal'),
            coalesce(nullif(btrim(item->>'status'), ''), 'pending'),
            coalesce(item->>'notes', item->>'adminResponse'),
            item
          )
          on conflict (id) do update
            set raw_payload = public.agency_supply_requests.raw_payload || excluded.raw_payload
            where public.agency_supply_requests.raw_payload is distinct from (public.agency_supply_requests.raw_payload || excluded.raw_payload);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'agency_supply_requests', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('agency_supply_requests', v_n);

  -- 5. Agency Messages (hyper_sanat_dealer_messages_v1)
  v_n := 0;
  for rec in
    select value
    from public.portal_kv_store
    where key = 'hyper_sanat_dealer_messages_v1'
      and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := nullif(btrim(item->>'id'), '');
        if v_id is not null then
          v_agency_id := null;
          select a.id into v_agency_id
          from public.agencies a
          where a.id = (item->>'agencyId') or a.code = coalesce(item->>'agencyCode', item->>'dealerCode')
          limit 1;
          insert into public.agency_messages(
            id, agency_id, sender, subject, body, attachments, is_read, raw_payload
          )
          values (
            v_id,
            v_agency_id,
            coalesce(nullif(btrim(item->>'sender'), ''), nullif(btrim(item->>'senderRole'), ''), 'user'),
            item->>'subject',
            coalesce(nullif(btrim(item->>'body'), ''), nullif(btrim(item->>'message'), ''), '-'),
            app_private.safe_jsonb_array(item->'attachments'),
            app_private.safe_bool(item->>'isRead', false),
            item
          )
          on conflict (id) do update
            set raw_payload = public.agency_messages.raw_payload || excluded.raw_payload
            where public.agency_messages.raw_payload is distinct from (public.agency_messages.raw_payload || excluded.raw_payload);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'agency_messages', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('agency_messages', v_n);

  -- 6. Official Invoices (atlas_admin_official_invoices_v1)
  v_n := 0;
  for rec in
    select value
    from public.portal_kv_store
    where key = 'atlas_admin_official_invoices_v1'
      and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := nullif(btrim(item->>'id'), '');
        if v_id is not null then
          v_order_id := null;
          select o.id into v_order_id from public.orders o where o.id = (item->>'orderId') limit 1;
          v_code := coalesce(nullif(btrim(item->>'invoiceNumber'), ''), v_id);
          if exists (select 1 from public.official_invoices i where i.invoice_number = v_code and i.id <> v_id) then
            v_code := v_code || '-' || v_id;
          end if;
          insert into public.official_invoices(
            id, invoice_number, order_id, buyer_name, buyer_economic_code,
            buyer_national_id, buyer_postal_code, buyer_address, buyer_phone,
            seller_info, items, subtotal_amount, discount_amount, tax_amount,
            total_payable, status, issued_date, raw_payload
          )
          values (
            v_id,
            v_code,
            v_order_id,
            coalesce(nullif(btrim(item->>'buyerName'), ''), nullif(btrim(item#>>'{buyer,companyName}'), ''), nullif(btrim(item#>>'{buyer,name}'), ''), 'خریدار'),
            coalesce(item->>'buyerEconomicCode', item->>'economicCode', item#>>'{buyer,economicCode}'),
            coalesce(item->>'buyerNationalId', item->>'nationalId', item#>>'{buyer,nationalId}'),
            coalesce(item->>'buyerPostalCode', item->>'postalCode', item#>>'{buyer,postalCode}'),
            coalesce(item->>'buyerAddress', item->>'address', item#>>'{buyer,address}'),
            coalesce(item->>'buyerPhone', item->>'phone', item#>>'{buyer,phone}'),
            app_private.safe_jsonb_object(coalesce(item->'sellerInfo', item->'seller')),
            app_private.safe_jsonb_array(item->'items'),
            coalesce(app_private.safe_numeric(coalesce(item->>'subtotalAmount', item->>'subtotal', item->>'totalAmount'), 0), 0),
            coalesce(app_private.safe_numeric(coalesce(item->>'discountAmount', item->>'totalDiscount', item->>'discount'), 0), 0),
            coalesce(app_private.safe_numeric(coalesce(item->>'taxAmount', item->>'totalTax', item->>'tax'), 0), 0),
            coalesce(app_private.safe_numeric(coalesce(item->>'totalPayable', item->>'grandTotal', item->>'finalAmount', item->>'totalAmount', item->>'total'), 0), 0),
            coalesce(nullif(btrim(item->>'status'), ''), 'issued'),
            coalesce(item->>'issuedDate', item->>'issueDate', item->>'date'),
            item
          )
          on conflict (id) do update
            set raw_payload = public.official_invoices.raw_payload || excluded.raw_payload
            where public.official_invoices.raw_payload is distinct from (public.official_invoices.raw_payload || excluded.raw_payload);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'official_invoices', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('official_invoices', v_n);

  -- 7. SMS Logs (atlas_admin_sms_logs_v1, hyper_sanat_sms_logs_v1, hyper_sanat_sms_v2)
  v_n := 0;
  for rec in
    select value
    from public.portal_kv_store
    where key in ('atlas_admin_sms_logs_v1', 'hyper_sanat_sms_logs_v1', 'hyper_sanat_sms_v2')
      and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := nullif(btrim(item->>'id'), '');
        if v_id is not null then
          insert into public.sms_logs(
            id, recipient_phone, recipient_name, event_key, message_text, status, sent_at, raw_payload
          )
          values (
            v_id,
            coalesce(nullif(btrim(item->>'recipientPhone'), ''), nullif(btrim(item->>'phone'), ''), nullif(btrim(item->>'to'), ''), ''),
            coalesce(item->>'recipientName', item->>'customerName'),
            coalesce(item->>'eventKey', item->>'template', item->>'type'),
            coalesce(nullif(btrim(item->>'messageText'), ''), nullif(btrim(item->>'message'), ''), nullif(btrim(item->>'text'), ''), ''),
            coalesce(nullif(btrim(item->>'status'), ''), 'sent'),
            coalesce(item->>'sentAt', item->>'timestamp', item->>'date'),
            item
          )
          on conflict (id) do update
            set raw_payload = public.sms_logs.raw_payload || excluded.raw_payload
            where public.sms_logs.raw_payload is distinct from (public.sms_logs.raw_payload || excluded.raw_payload);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'sms_logs', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('sms_logs', v_n);

  -- 8. Price Change History (atlas_price_list_history_v2, atlas_admin_price_logs_v1)
  v_n := 0;
  for rec in
    select value
    from public.portal_kv_store
    where key in ('atlas_price_list_history_v2', 'atlas_admin_price_logs_v1')
      and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := nullif(btrim(item->>'id'), '');
        if v_id is not null then
          v_price_list_id := null;
          select p.id into v_price_list_id from public.price_lists p where p.id = (item->>'priceListId') limit 1;
          insert into public.price_change_history(
            id, price_list_id, product_code, product_name, old_price, new_price,
            changed_by, reason, date_label, snapshot, raw_payload
          )
          values (
            v_id,
            v_price_list_id,
            coalesce(nullif(btrim(item->>'productCode'), ''), nullif(btrim(item->>'code'), ''), nullif(btrim(item->>'priceListCode'), ''), v_id),
            coalesce(item->>'productName', item->>'name', item->>'priceListName'),
            coalesce(app_private.safe_numeric(item->>'oldPrice', 0), 0),
            coalesce(app_private.safe_numeric(item->>'newPrice', 0), 0),
            coalesce(nullif(btrim(item->>'changedBy'), ''), nullif(btrim(item->>'actor'), ''), nullif(btrim(item->>'editorName'), ''), 'مدیر سیستم'),
            coalesce(item->>'reason', item->>'note', item->>'notes'),
            coalesce(item->>'dateLabel', item->>'date', item->>'createdAt', item->>'timestamp'),
            app_private.safe_jsonb_object(item->'snapshot'),
            item
          )
          on conflict (id) do update
            set raw_payload = public.price_change_history.raw_payload || excluded.raw_payload
            where public.price_change_history.raw_payload is distinct from (public.price_change_history.raw_payload || excluded.raw_payload);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'price_change_history', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('price_change_history', v_n);

  -- 8b. Price Inquiries (atlas_admin_inquiries_v1, hyper_sanat_inquiries_v2)
  v_n := 0;
  for rec in
    select value
    from public.portal_kv_store
    where key in ('atlas_admin_inquiries_v1', 'hyper_sanat_inquiries_v2')
      and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := nullif(btrim(item->>'id'), '');
        if v_id is not null then
          v_crm_id := null;
          select c.id into v_crm_id from public.crm_customers c where c.id = coalesce(item->>'customerId', item->>'crmCustomerId') limit 1;
          insert into public.price_inquiries(
            id, crm_customer_id, customer_name, company_name, phone, product_code, product_name,
            quantity, unit, urgency, status, quoted_unit_price, quoted_total_price,
            validity_date, customer_note, admin_reply, items, attachments, raw_payload
          )
          values (
            v_id,
            v_crm_id,
            coalesce(nullif(btrim(item->>'customerName'), ''), 'مشتری'),
            coalesce(item->>'companyName', item->>'company'),
            coalesce(nullif(btrim(item->>'phone'), ''), nullif(btrim(item->>'customerPhone'), ''), ''),
            coalesce(nullif(btrim(item->>'productCode'), ''), nullif(btrim(item->>'partCode'), ''), ''),
            coalesce(nullif(btrim(item->>'productName'), ''), nullif(btrim(item->>'partName'), ''), ''),
            greatest(1, coalesce(app_private.safe_int(coalesce(item->>'quantity', item->>'requestedQty'), 1), 1)),
            coalesce(nullif(btrim(item->>'unit'), ''), 'عدد'),
            coalesce(nullif(btrim(item->>'urgency'), ''), 'normal'),
            case
              when (item->>'status') in ('pending', 'reviewing', 'quoted', 'approved', 'rejected', 'expired', 'converted_to_order')
                then (item->>'status')::public.inquiry_status_type
              when (item->>'status') = 'answered'
                then 'quoted'::public.inquiry_status_type
              else 'pending'::public.inquiry_status_type
            end,
            app_private.safe_numeric(coalesce(item->>'quotedUnitPrice', item->>'quotedPrice'), null),
            app_private.safe_numeric(item->>'quotedTotalPrice', null),
            item->>'validityDate',
            coalesce(item->>'customerNote', item->>'note'),
            coalesce(item->>'adminReply', item->>'adminNote'),
            app_private.safe_jsonb_array(item->'items'),
            app_private.safe_jsonb_array(item->'attachments'),
            item
          )
          on conflict (id) do update
            set raw_payload = public.price_inquiries.raw_payload || excluded.raw_payload
            where public.price_inquiries.raw_payload is distinct from (public.price_inquiries.raw_payload || excluded.raw_payload);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'price_inquiries', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('price_inquiries', v_n);

  -- 8c. Customer Grades, Club Rewards, Reward Assignments & Marketing Campaigns
  v_n := 0;
  for rec in
    select value from public.portal_kv_store where key = 'atlas_customer_grades_v2' and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_grade_code := coalesce(nullif(btrim(item->>'gradeCode'), ''), nullif(btrim(item->>'code'), ''), nullif(btrim(item->>'id'), ''));
        if v_grade_code is not null then
          insert into public.customer_grade_configs(
            grade_code, title, discount_percent, credit_limit, settlement_days,
            min_points, min_purchase_volume, can_view_prices, can_view_stock,
            can_buy_on_credit, benefits, metadata
          )
          values (
            v_grade_code,
            coalesce(nullif(btrim(item->>'title'), ''), nullif(btrim(item->>'name'), ''), v_grade_code),
            least(100, greatest(0, coalesce(app_private.safe_numeric(item->>'discountPercent', 0), 0))),
            coalesce(app_private.safe_numeric(item->>'creditLimit', 0), 0),
            coalesce(app_private.safe_int(item->>'settlementDays', 0), 0),
            coalesce(app_private.safe_int(item->>'minPoints', 0), 0),
            coalesce(app_private.safe_numeric(coalesce(item->>'minPurchaseVolume', item->>'minPurchase'), 0), 0),
            app_private.safe_bool(item->>'canViewPrices', true),
            app_private.safe_bool(item->>'canViewStock', true),
            app_private.safe_bool(item->>'canBuyOnCredit', false),
            app_private.safe_jsonb_array(item->'benefits'),
            item
          )
          on conflict (grade_code) do update
            set metadata = public.customer_grade_configs.metadata || excluded.metadata
            where public.customer_grade_configs.metadata is distinct from (public.customer_grade_configs.metadata || excluded.metadata);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'customer_grade_configs', 'record_id', coalesce(v_grade_code, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('customer_grade_configs', v_n);

  -- Club Rewards (atlas_club_rewards_v2)
  v_n := 0;
  for rec in
    select value from public.portal_kv_store where key = 'atlas_club_rewards_v2' and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := nullif(btrim(item->>'id'), '');
        if v_id is not null then
          insert into public.club_rewards(
            id, title, description, points_cost, reward_type, discount_percent,
            max_amount, min_grade, active, image_url, raw_payload
          )
          values (
            v_id,
            coalesce(nullif(btrim(item->>'title'), ''), v_id),
            item->>'description',
            greatest(0, coalesce(app_private.safe_int(coalesce(item->>'pointsCost', item->>'minPurchaseRequired'), 0), 0)),
            coalesce(nullif(btrim(item->>'rewardType'), ''), 'discount_code'),
            case when item->>'discountPercent' is not null then least(100, greatest(0, app_private.safe_numeric(item->>'discountPercent', 0))) else null end,
            app_private.safe_numeric(coalesce(item->>'maxAmount', item->>'numericValue'), null),
            coalesce(nullif(btrim(coalesce(item->>'minGrade', item->>'targetClubTier')), ''), 'bronze'),
            app_private.safe_bool(item->>'active', true),
            item->>'imageUrl',
            item
          )
          on conflict (id) do update
            set raw_payload = public.club_rewards.raw_payload || excluded.raw_payload
            where public.club_rewards.raw_payload is distinct from (public.club_rewards.raw_payload || excluded.raw_payload);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'club_rewards', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('club_rewards', v_n);

  -- Customer Reward Assignments (atlas_customer_reward_assignments_v1)
  v_n := 0;
  for rec in
    select value from public.portal_kv_store where key = 'atlas_customer_reward_assignments_v1' and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := nullif(btrim(item->>'id'), '');
        if v_id is not null then
          v_crm_id := null;
          select c.id into v_crm_id from public.crm_customers c where c.id = (item->>'customerId') limit 1;
          v_reward_id := null;
          select r.id into v_reward_id from public.club_rewards r where r.id = (item->>'rewardId') limit 1;
          insert into public.customer_reward_assignments(
            id, customer_id, reward_id, reward_title, code, status, assigned_by, expires_at, used_at, raw_payload
          )
          values (
            v_id,
            v_crm_id,
            v_reward_id,
            coalesce(nullif(btrim(item->>'rewardTitle'), ''), nullif(btrim(item->>'title'), ''), 'جایزه باشگاه'),
            item->>'code',
            coalesce(nullif(btrim(item->>'status'), ''), 'active'),
            item->>'assignedBy',
            app_private.safe_timestamptz(item->>'expiresAt'),
            app_private.safe_timestamptz(item->>'usedAt'),
            item
          )
          on conflict (id) do update
            set raw_payload = public.customer_reward_assignments.raw_payload || excluded.raw_payload
            where public.customer_reward_assignments.raw_payload is distinct from (public.customer_reward_assignments.raw_payload || excluded.raw_payload);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'customer_reward_assignments', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('customer_reward_assignments', v_n);

  -- Marketing Campaigns (atlas_admin_campaigns_v1)
  v_n := 0;
  for rec in
    select value from public.portal_kv_store where key = 'atlas_admin_campaigns_v1' and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := nullif(btrim(item->>'id'), '');
        if v_id is not null then
          insert into public.marketing_campaigns(
            id, title, description, multiplier, reward_type, reward_value,
            target_tier, start_date, end_date, valid_until, active, participants_count, raw_payload
          )
          values (
            v_id,
            coalesce(nullif(btrim(item->>'title'), ''), v_id),
            item->>'description',
            least(999.99, greatest(0, coalesce(app_private.safe_numeric(item->>'multiplier', 1.0), 1.0))),
            item->>'rewardType',
            item->>'rewardValue',
            coalesce(nullif(btrim(item->>'targetTier'), ''), 'all'),
            item->>'startDate',
            item->>'endDate',
            item->>'validUntil',
            app_private.safe_bool(item->>'active', true),
            coalesce(app_private.safe_int(item->>'participantsCount', 0), 0),
            item
          )
          on conflict (id) do update
            set raw_payload = public.marketing_campaigns.raw_payload || excluded.raw_payload
            where public.marketing_campaigns.raw_payload is distinct from (public.marketing_campaigns.raw_payload || excluded.raw_payload);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'marketing_campaigns', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('marketing_campaigns', v_n);

  -- 8d. CRM Customers, Discount Codes, Support Tickets, Audit Logs, Client Logos
  v_n := 0;
  for rec in
    select key, value
    from public.portal_kv_store
    where key in ('atlas_admin_customers_v1', 'atlas_legacy_customers_v1')
      and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := nullif(btrim(item->>'id'), '');
        if v_id is not null then
          v_grade_code := null;
          select g.grade_code into v_grade_code from public.customer_grade_configs g where g.grade_code = coalesce(item->>'gradeCode', item->>'tierCode') limit 1;
          v_price_list_id := null;
          select p.id into v_price_list_id from public.price_lists p where p.id = (item->>'assignedPriceListId') limit 1;
          insert into public.crm_customers(
            id, is_legacy, name, company, phone, email, national_id, economic_code,
            province, city, address, postal_code, grade_code, approved_b2b,
            approval_status, credit_limit, used_credit, wallet_balance, points,
            total_orders, total_spent, assigned_price_list_id, notes, raw_payload
          )
          values (
            v_id,
            case when rec.key = 'atlas_legacy_customers_v1' then true else app_private.safe_bool(item->>'isLegacy', false) end,
            coalesce(nullif(btrim(item->>'name'), ''), nullif(btrim(item->>'fullName'), ''), 'مشتری'),
            coalesce(item->>'company', item->>'companyName'),
            coalesce(nullif(btrim(item->>'phone'), ''), ''),
            item->>'email',
            item->>'nationalId',
            item->>'economicCode',
            item->>'province',
            item->>'city',
            item->>'address',
            item->>'postalCode',
            v_grade_code,
            app_private.safe_bool(item->>'approvedB2b', false),
            coalesce(nullif(btrim(item->>'approvalStatus'), ''), 'pending'),
            coalesce(app_private.safe_numeric(item->>'creditLimit', 0), 0),
            coalesce(app_private.safe_numeric(item->>'usedCredit', 0), 0),
            coalesce(app_private.safe_numeric(item->>'walletBalance', 0), 0),
            coalesce(app_private.safe_int(item->>'points', 0), 0),
            coalesce(app_private.safe_int(item->>'totalOrders', 0), 0),
            coalesce(app_private.safe_numeric(item->>'totalSpent', 0), 0),
            v_price_list_id,
            item->>'notes',
            item
          )
          on conflict (id) do update
            set raw_payload = public.crm_customers.raw_payload || excluded.raw_payload
            where public.crm_customers.raw_payload is distinct from (public.crm_customers.raw_payload || excluded.raw_payload);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'crm_customers', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('crm_customers', v_n);

  -- Discount Codes (atlas_admin_discounts_v1)
  v_n := 0;
  for rec in
    select value from public.portal_kv_store where key = 'atlas_admin_discounts_v1' and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := nullif(btrim(item->>'id'), '');
        v_code := coalesce(nullif(btrim(item->>'code'), ''), v_id);
        if v_id is not null and v_code is not null then
          if exists (select 1 from public.discount_codes d where d.code = v_code and d.id <> v_id) then
            v_code := v_code || '-' || v_id;
          end if;
          insert into public.discount_codes(
            id, code, title, discount_percent, max_discount_amount, min_order_amount,
            usage_limit, used_count, valid_until, active, target_tier, raw_payload
          )
          values (
            v_id, v_code, item->>'title',
            least(100, greatest(0, coalesce(app_private.safe_numeric(item->>'discountPercent', 0), 0))),
            app_private.safe_numeric(item->>'maxDiscountAmount', null),
            coalesce(app_private.safe_numeric(item->>'minOrderAmount', 0), 0),
            app_private.safe_int(item->>'usageLimit', null),
            coalesce(app_private.safe_int(item->>'usedCount', 0), 0),
            item->>'validUntil',
            app_private.safe_bool(item->>'active', true),
            item->>'targetTier',
            item
          )
          on conflict (id) do update
            set raw_payload = public.discount_codes.raw_payload || excluded.raw_payload
            where public.discount_codes.raw_payload is distinct from (public.discount_codes.raw_payload || excluded.raw_payload);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'discount_codes', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('discount_codes', v_n);

  -- Support Tickets (atlas_admin_tickets_v1)
  v_n := 0;
  for rec in
    select value from public.portal_kv_store where key = 'atlas_admin_tickets_v1' and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := nullif(btrim(item->>'id'), '');
        if v_id is not null then
          insert into public.support_tickets(
            id, customer_name, phone, subject, status, messages, raw_payload
          )
          values (
            v_id,
            coalesce(nullif(btrim(item->>'customerName'), ''), 'مشتری'),
            coalesce(nullif(btrim(item->>'phone'), ''), ''),
            coalesce(nullif(btrim(item->>'subject'), ''), 'تیکت پشتیبانی'),
            coalesce(nullif(btrim(item->>'status'), ''), 'open'),
            app_private.safe_jsonb_array(item->'messages'),
            item
          )
          on conflict (id) do update
            set raw_payload = public.support_tickets.raw_payload || excluded.raw_payload
            where public.support_tickets.raw_payload is distinct from (public.support_tickets.raw_payload || excluded.raw_payload);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'support_tickets', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('support_tickets', v_n);

  -- Audit Logs (atlas_admin_audit_logs_v1)
  v_n := 0;
  for rec in
    select value from public.portal_kv_store where key = 'atlas_admin_audit_logs_v1' and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := nullif(btrim(item->>'id'), '');
        if v_id is not null then
          insert into public.audit_logs(
            id, user_id, user_name, user_role, action, entity, target, details,
            extra_payload, timestamp_label, raw_payload
          )
          values (
            v_id,
            item->>'userId',
            item->>'userName',
            item->>'userRole',
            coalesce(nullif(btrim(item->>'action'), ''), 'system_action'),
            item->>'entity',
            item->>'target',
            item->>'details',
            app_private.safe_jsonb_object(item->'extraPayload'),
            coalesce(item->>'timestampLabel', item->>'timestamp', item->>'date'),
            item
          )
          on conflict (id) do update
            set raw_payload = public.audit_logs.raw_payload || excluded.raw_payload
            where public.audit_logs.raw_payload is distinct from (public.audit_logs.raw_payload || excluded.raw_payload);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'audit_logs', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('audit_logs', v_n);

  -- Client Logos (atlas_clients_logos_v3_moshtari)
  v_n := 0;
  for rec in
    select value from public.portal_kv_store where key = 'atlas_clients_logos_v3_moshtari' and jsonb_typeof(value) = 'array'
  loop
    for item in select * from jsonb_array_elements(rec.value)
    loop
      begin
        v_id := nullif(btrim(item->>'id'), '');
        if v_id is not null then
          insert into public.client_logos(
            id, name, logo_url, industry, city, sort_order, active, raw_payload
          )
          values (
            v_id,
            coalesce(nullif(btrim(item->>'name'), ''), v_id),
            coalesce(nullif(btrim(item->>'logoUrl'), ''), nullif(btrim(item->>'logo'), ''), ''),
            item->>'industry',
            item->>'city',
            coalesce(app_private.safe_int(item->>'sortOrder', 0), 0),
            app_private.safe_bool(item->>'active', true),
            item
          )
          on conflict (id) do update
            set raw_payload = public.client_logos.raw_payload || excluded.raw_payload
            where public.client_logos.raw_payload is distinct from (public.client_logos.raw_payload || excluded.raw_payload);
          v_n := v_n + 1;
        end if;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'client_logos', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end loop;
  end loop;
  v_counts := v_counts || jsonb_build_object('client_logos', v_n);

  -- 9. Scoped User Documents -> Plant Machinery Passports, Industrial Chat Sessions & Saved Collections
  v_n := 0;
  for rec in
    select namespace, scope_id, value
    from app_private.scoped_documents
    union all
    select key as namespace, 'global' as scope_id, value
    from public.portal_kv_store
    where key in ('atlas_plant_machinery_passport_v1', 'forza_industrial_chat_sessions_v2')
  loop
    v_user_id := null;
    if rec.scope_id like 'user:%' then
      begin
        v_user_id := substring(rec.scope_id from 6)::uuid;
        if not exists (select 1 from auth.users u where u.id = v_user_id) then
          select p.auth_user_id into v_user_id
          from app_private.portal_users p
          where p.id = substring(rec.scope_id from 6)
          limit 1;
        end if;
      exception when others then
        select p.auth_user_id into v_user_id
        from app_private.portal_users p
        where p.id = substring(rec.scope_id from 6)
        limit 1;
      end;
    end if;

    if rec.namespace = 'atlas_plant_machinery_passport_v1' and jsonb_typeof(rec.value) = 'array' then
      for item in select * from jsonb_array_elements(rec.value)
      loop
        begin
          v_id := nullif(btrim(item->>'id'), '');
          if v_id is not null then
            insert into public.plant_machinery_passports(
              id, user_id, machine_name, line_name, manufacturer, model_year,
              serial_number, installed_parts, notes, raw_payload
            )
            values (
              v_id,
              v_user_id,
              coalesce(nullif(btrim(item->>'machineName'), ''), nullif(btrim(item->>'name'), ''), 'دستگاه صنعتی'),
              coalesce(item->>'lineName', item->>'section', item->>'plantSection'),
              item->>'manufacturer',
              coalesce(item->>'modelYear', item->>'installedYear'),
              coalesce(item->>'serialNumber', item->>'modelNumber'),
              case
                when jsonb_typeof(item->'installedParts') = 'array' then item->'installedParts'
                when jsonb_typeof(item->'parts') = 'array' then item->'parts'
                else '[]'::jsonb
              end,
              item->>'notes',
              item
            )
            on conflict (id) do update
              set machine_name = excluded.machine_name,
                  line_name = excluded.line_name,
                  manufacturer = excluded.manufacturer,
                  model_year = excluded.model_year,
                  serial_number = excluded.serial_number,
                  installed_parts = excluded.installed_parts,
                  raw_payload = excluded.raw_payload,
                  updated_at = now()
              where public.plant_machinery_passports.raw_payload is distinct from excluded.raw_payload;
            v_n := v_n + 1;
          end if;
        exception when others then
          v_skipped_errors := v_skipped_errors + 1;
          v_error_details := v_error_details || jsonb_build_array(
            jsonb_build_object('section', 'plant_machinery_passports', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
          );
        end;
      end loop;
    elsif rec.namespace = 'forza_industrial_chat_sessions_v2' and jsonb_typeof(rec.value) = 'array' then
      for item in select * from jsonb_array_elements(rec.value)
      loop
        begin
          v_id := nullif(btrim(item->>'id'), '');
          if v_id is not null then
            insert into public.industrial_chat_sessions(
              id, user_id, customer_name, status, messages, raw_payload
            )
            values (
              v_id,
              v_user_id,
              coalesce(item->>'customerName', item->>'title'),
              coalesce(nullif(btrim(item->>'status'), ''), 'active'),
              app_private.safe_jsonb_array(item->'messages'),
              item
            )
            on conflict (id) do update
              set customer_name = excluded.customer_name,
                  messages = excluded.messages,
                  raw_payload = excluded.raw_payload,
                  last_updated = now()
              where public.industrial_chat_sessions.raw_payload is distinct from excluded.raw_payload;
            v_n := v_n + 1;
          end if;
        exception when others then
          v_skipped_errors := v_skipped_errors + 1;
          v_error_details := v_error_details || jsonb_build_array(
            jsonb_build_object('section', 'industrial_chat_sessions', 'record_id', coalesce(v_id, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
          );
        end;
      end loop;
    elsif v_user_id is not null and (
      rec.namespace in ('hyper_sanat_cart_v2', 'hyper_sanat_saved_v2')
      or rec.namespace like 'hyper_sanat_wishlist_v1:%'
    ) and jsonb_typeof(rec.value) = 'array' then
      begin
        insert into public.user_saved_collections(user_id, collection_type, items)
        values (
          v_user_id,
          case
            when rec.namespace = 'hyper_sanat_cart_v2' then 'cart'
            when rec.namespace = 'hyper_sanat_saved_v2' then 'saved'
            else 'wishlist'
          end,
          rec.value
        )
        on conflict (user_id, collection_type) do update
          set items = excluded.items,
              updated_at = now()
          where public.user_saved_collections.items is distinct from excluded.items;
        v_n := v_n + 1;
      exception when others then
        v_skipped_errors := v_skipped_errors + 1;
        v_error_details := v_error_details || jsonb_build_array(
          jsonb_build_object('section', 'user_saved_collections', 'record_id', coalesce(v_user_id::text, 'unknown'), 'sqlstate', SQLSTATE, 'message', SQLERRM)
        );
      end;
    end if;
  end loop;
  v_counts := v_counts || jsonb_build_object(
    'scoped_user_records', v_n,
    'skipped_errors', v_skipped_errors,
    'error_details', v_error_details
  );

  return v_counts;
end;
$$;

revoke execute on function app_private.backfill_relational_projections_from_kv() from public, anon, authenticated;

do $$
declare
  v_res jsonb;
  v_err_count int;
begin
  v_res := app_private.backfill_relational_projections_from_kv();
  v_err_count := coalesce((v_res->>'skipped_errors')::int, 0);
  if v_err_count > 0 then
    raise exception 'Migration 20261022120000 backfill failed with % skipped error(s): %',
      v_err_count,
      v_res->'error_details';
  end if;
end$$;

insert into app_private.schema_change_log(version, description)
values ('20261022120000', 'Complete relational table projections, raw_payload preservation, and KV-to-relational backfill function')
on conflict (version) do nothing;

COMMIT;
