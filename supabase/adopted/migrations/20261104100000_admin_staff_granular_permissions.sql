-- Additive, adopted-schema-only staff permission storage.
-- DO NOT apply to production without a verified backup, restore test and owner approval.
begin;
do $$begin
 if to_regclass('public.user_profiles') is null or to_regclass('public.catalog_families') is null then
  raise exception 'Expected the adopted Sanat Pish schema; refusing to migrate.';
 end if;
end$$;
create table if not exists app_private.admin_staff_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 permissions jsonb not null default '{}'::jsonb,
 active boolean not null default true,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint staff_permissions_object check (jsonb_typeof(permissions)='object')
);
create index if not exists idx_admin_staff_accounts_active on app_private.admin_staff_accounts(active);
revoke all on app_private.admin_staff_accounts from anon, authenticated, public;
comment on table app_private.admin_staff_accounts is 'Only server API may administer staff permissions; not exposed through PostgREST.';
commit;
