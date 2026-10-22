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
  item jsonb;
  v_id text;
  v_code text;
  v_slug text;
  v_name text;
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

  -- 0a-2. Catalog Overrides (catalog_overrides_db_v1 -> catalog_families non-destructive enrichment)
  v_n := 0;
  for rec in
    select value
    from public.portal_kv_store
    where key = 'catalog_overrides_db_v1'
      and jsonb_typeof(value) = 'object'
  loop
    begin
      if jsonb_typeof(rec.value->'families') = 'object' then
        for item in select e.key as fam_id, e.value as fam_val from jsonb_each(rec.value->'families') e
        loop
          update public.catalog_families
          set raw_payload = public.catalog_families.raw_payload || jsonb_build_object('override', item.fam_val)
          where (id = item.fam_id or slug = item.fam_id)
            and public.catalog_families.raw_payload is distinct from (public.catalog_families.raw_payload || jsonb_build_object('override', item.fam_val));
          v_n := v_n + 1;
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

insert into app_private.schema_change_log(version, description)
values ('20261022120000', 'Complete relational table projections, raw_payload preservation, and KV-to-relational backfill function')
on conflict (version) do nothing;

select app_private.backfill_relational_projections_from_kv() as backfill_summary;
