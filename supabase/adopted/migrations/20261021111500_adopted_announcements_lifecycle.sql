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
