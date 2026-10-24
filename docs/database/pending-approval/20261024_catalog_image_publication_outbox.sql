-- PENDING OWNER APPROVAL. Apply ONLY to sanatpishatlas in a reviewed migration.
-- Additive; does not touch product, SKU, image or order data.
create table if not exists public.catalog_image_publications (
 id uuid primary key default gen_random_uuid(),
 upload_id uuid not null,
 gallery_id text not null,
 family_code text not null,
 variant_code text,
 original_extension text not null check(original_extension in('png','jpg','webp')),
 original_sha256 text not null check(original_sha256 ~ '^[a-f0-9]{64}$'),
 old_url text not null,
 public_original_url text not null,
 public_thumb_url text not null,
 public_medium_url text not null,
 state text not null default 'pending' check(state in
   ('pending','publishing','awaiting_ci','awaiting_deploy','published','retry','blocked')),
 attempts integer not null default 0 check(attempts>=0),
 pr_number integer,
 git_commit_sha text,
 last_error text,
 retry_after timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 published_at timestamptz
);
create index if not exists catalog_image_publications_queue_idx
 on public.catalog_image_publications(state,retry_after,created_at)
 where state in('pending','retry','awaiting_ci','awaiting_deploy','publishing');
create unique index if not exists catalog_image_publications_upload_id_uidx
 on public.catalog_image_publications(upload_id);
alter table public.catalog_image_publications enable row level security;
revoke all on table public.catalog_image_publications from anon,authenticated;
-- No public RLS policy: only trusted server PostgreSQL credentials can read/write.
