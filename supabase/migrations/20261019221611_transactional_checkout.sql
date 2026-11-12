-- Checkout idempotency and relational ownership; existing records remain intact.
do $$
begin
  if to_regclass('public.user_profiles') is not null or to_regclass('public.catalog_families') is not null then
    raise exception 'CRITICAL SAFETY GUARD: Target database uses the adopted 49-table master schema (user_profiles, catalog_families). Prototype migrations under supabase/migrations must NEVER be applied to this database. Use supabase/adopted/migrations or "npm run db:migrate:adopted".';
  end if;
end$$;

create table app_private.checkout_requests(profile_id text not null references public.profiles(id),request_key uuid not null,order_id text not null,request_hash text not null,created_at timestamptz not null default now(),primary key(profile_id,request_key));
alter table public.order_items add column order_namespace text;
alter table public.order_items add column order_scope text;
alter table public.order_items add constraint order_items_order_fk foreign key(order_namespace,order_scope,order_id) references public.orders(namespace,scope_id,entry_key);
alter table public.inventory_balances add column reserved numeric not null default 0 check(reserved>=0);
alter table public.inventory_balances add column version bigint not null default 0;
create table app_private.rate_limits(bucket text primary key,attempts integer not null default 1,expires_at timestamptz not null);
revoke all on app_private.checkout_requests,app_private.rate_limits from public,anon,authenticated;
