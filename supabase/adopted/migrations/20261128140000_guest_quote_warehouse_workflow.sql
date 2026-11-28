-- Guest quote requests and a separate warehouse operator portal.
-- Additive migration: existing customer inquiries and official invoices are untouched.
begin;
do $$begin
 if to_regclass('public.catalog_families') is null
    or to_regclass('public.catalog_variants') is null
    or to_regclass('public.user_profiles') is null then
  raise exception 'Expected the adopted Sanat Pish schema; refusing to migrate.';
 end if;
end$$;

create schema if not exists app_private;

create table if not exists public.guest_quote_requests (
 id uuid primary key default gen_random_uuid(),
 request_number bigint generated always as identity unique,
 request_key uuid not null unique,
 status text not null default 'new'
  check (status in ('new','sent_to_warehouse','warehouse_reviewing','warehouse_returned','completed','cancelled')),
 sent_by uuid references auth.users(id) on delete set null,
 sent_to_warehouse_at timestamptz,
 warehouse_assigned_to uuid references auth.users(id) on delete set null,
 warehouse_completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists idx_guest_quote_requests_status_created
 on public.guest_quote_requests(status,created_at desc);
create index if not exists idx_guest_quote_requests_warehouse
 on public.guest_quote_requests(status,warehouse_assigned_to,created_at desc);

create table if not exists public.guest_quote_request_items (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.guest_quote_requests(id) on delete cascade,
 product_code text not null,
 product_name text not null,
 unit text not null default 'عدد',
 quantity integer not null check (quantity between 1 and 9999),
 warehouse_status text not null default 'pending'
  check (warehouse_status in ('pending','available','partial','unavailable')),
 available_quantity integer check (available_quantity is null or available_quantity >= 0),
 warehouse_note text,
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(request_id,product_code)
);
create index if not exists idx_guest_quote_items_request
 on public.guest_quote_request_items(request_id);

-- A warehouse login is a distinct identity from generic admin staff accounts.
create table if not exists app_private.warehouse_operator_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 active boolean not null default true,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists idx_warehouse_operator_accounts_active
 on app_private.warehouse_operator_accounts(active);

-- All writes/reads go through the authenticated Express BFF. No browser role
-- receives direct table access; the guest endpoint stores no customer identity.
alter table public.guest_quote_requests enable row level security;
alter table public.guest_quote_request_items enable row level security;
alter table app_private.warehouse_operator_accounts enable row level security;
revoke all on public.guest_quote_requests,public.guest_quote_request_items
 from public,anon,authenticated;
revoke all on app_private.warehouse_operator_accounts
 from public,anon,authenticated;

comment on table public.guest_quote_requests is
 'Anonymous storefront requests for an internal proforma workflow. No customer PII is stored.';
comment on table public.guest_quote_request_items is
 'Product codes, catalog names, quantities and warehouse stock review only.';
comment on table app_private.warehouse_operator_accounts is
 'Separate warehouse-only identities; accessible only through the server-side API.';
commit;
