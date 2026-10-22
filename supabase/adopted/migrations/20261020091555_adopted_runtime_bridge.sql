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
