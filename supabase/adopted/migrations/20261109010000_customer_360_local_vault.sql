-- Customer 360 intelligence with device-local customer image vault.
-- This migration stores image metadata and recognition outcomes only.
-- It deliberately has no image bytea, base64, permanent URL, or storage-path column.

create table if not exists public.customer_image_identifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_image_id text not null,
  image_sha256 text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  original_name text not null default '',
  recognition_status text not null default 'submitted'
    check (recognition_status in ('submitted','processing','completed','failed','unmatched')),
  detected_part_type text,
  recognized_summary text,
  selected_product_code text,
  matched_product_codes jsonb not null default '[]'::jsonb,
  similar_product_codes jsonb not null default '[]'::jsonb,
  recognition_result jsonb not null default '{}'::jsonb,
  consultation_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, device_image_id)
);
create index if not exists customer_image_identifications_user_created_idx
  on public.customer_image_identifications(user_id, created_at desc);
create index if not exists customer_image_identifications_product_idx
  on public.customer_image_identifications(selected_product_code)
  where selected_product_code is not null;

create table if not exists public.customer_ai_consultations (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null default 'گفتگوی فنی',
  summary text not null default '',
  status text not null default 'open'
    check (status in ('open','waiting','resolved','archived')),
  messages jsonb not null default '[]'::jsonb,
  product_codes jsonb not null default '[]'::jsonb,
  message_count integer not null default 0 check (message_count >= 0),
  started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id, id)
);
create index if not exists customer_ai_consultations_user_recent_idx
  on public.customer_ai_consultations(user_id, last_message_at desc);

create table if not exists public.customer_product_interests (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null,
  product_name text not null default '',
  interaction_count integer not null default 1 check (interaction_count > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_consultation_id text,
  primary key(user_id, product_code)
);
create index if not exists customer_product_interests_user_recent_idx
  on public.customer_product_interests(user_id, last_seen_at desc);

create table if not exists public.customer_product_consultation_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  consultation_id text not null,
  product_code text not null,
  product_name text not null default '',
  created_at timestamptz not null default now(),
  unique(user_id, consultation_id, product_code),
  foreign key (user_id, consultation_id)
    references public.customer_ai_consultations(user_id, id) on delete cascade
);
create index if not exists customer_product_consultation_items_user_idx
  on public.customer_product_consultation_items(user_id, created_at desc);

create table if not exists public.customer_followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  crm_customer_id text references public.crm_customers(id) on delete cascade,
  assigned_staff_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  notes text not null default '',
  status text not null default 'pending'
    check (status in ('pending','in_progress','completed','cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((user_id is not null) <> (crm_customer_id is not null))
);
create index if not exists customer_followups_user_due_idx
  on public.customer_followups(user_id, due_at asc nulls last) where user_id is not null;
create index if not exists customer_followups_crm_due_idx
  on public.customer_followups(crm_customer_id, due_at asc nulls last) where crm_customer_id is not null;

alter table public.customer_image_identifications enable row level security;
alter table public.customer_ai_consultations enable row level security;
alter table public.customer_product_interests enable row level security;
alter table public.customer_product_consultation_items enable row level security;
alter table public.customer_followups enable row level security;

drop policy if exists customer_image_identifications_owner_select on public.customer_image_identifications;
create policy customer_image_identifications_owner_select on public.customer_image_identifications
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin_user());
drop policy if exists customer_image_identifications_owner_insert on public.customer_image_identifications;
create policy customer_image_identifications_owner_insert on public.customer_image_identifications
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists customer_ai_consultations_owner_select on public.customer_ai_consultations;
create policy customer_ai_consultations_owner_select on public.customer_ai_consultations
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin_user());
drop policy if exists customer_ai_consultations_owner_insert on public.customer_ai_consultations;
create policy customer_ai_consultations_owner_insert on public.customer_ai_consultations
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists customer_product_interests_owner_select on public.customer_product_interests;
create policy customer_product_interests_owner_select on public.customer_product_interests
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin_user());
drop policy if exists customer_product_interests_owner_insert on public.customer_product_interests;
create policy customer_product_interests_owner_insert on public.customer_product_interests
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists customer_product_consultation_items_owner_select on public.customer_product_consultation_items;
create policy customer_product_consultation_items_owner_select on public.customer_product_consultation_items
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin_user());
drop policy if exists customer_product_consultation_items_owner_insert on public.customer_product_consultation_items;
create policy customer_product_consultation_items_owner_insert on public.customer_product_consultation_items
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists customer_followups_staff_select on public.customer_followups;
create policy customer_followups_staff_select on public.customer_followups
  for select to authenticated using (public.is_admin_user());
drop policy if exists customer_followups_staff_insert on public.customer_followups;
create policy customer_followups_staff_insert on public.customer_followups
  for insert to authenticated with check (public.is_admin_user());
drop policy if exists customer_followups_staff_update on public.customer_followups;
create policy customer_followups_staff_update on public.customer_followups
  for update to authenticated using (public.is_admin_user()) with check (public.is_admin_user());

grant select, insert on public.customer_image_identifications to authenticated;
grant select, insert on public.customer_ai_consultations to authenticated;
grant select, insert on public.customer_product_interests to authenticated;
grant select, insert on public.customer_product_consultation_items to authenticated;
grant select, insert, update on public.customer_followups to authenticated;
grant all on public.customer_image_identifications to service_role;
grant all on public.customer_ai_consultations to service_role;
grant all on public.customer_product_interests to service_role;
grant all on public.customer_product_consultation_items to service_role;
grant all on public.customer_followups to service_role;

comment on table public.customer_image_identifications is
  'Image metadata and recognition result only. Original customer image bytes remain in the customer device browser vault.';
comment on table public.customer_product_consultation_items is
  'Distinct product selections per customer consultation session; used to count consultation interest without incrementing on every chat turn.';
comment on column public.customer_image_identifications.device_image_id is
  'Opaque IndexedDB/OPFS record ID from the customer device; never a server file path.';
comment on column public.customer_image_identifications.recognition_result is
  'Sanitized recognition metadata only; must not contain image bytes, data URLs, customer image URLs, or storage paths.';
