-- Disposable PostgreSQL service only. NOT Supabase Auth or Storage.
-- GitHub Actions must use a new empty sanatpish_ci database on localhost.
\set ON_ERROR_STOP on
DO $$
BEGIN
 IF current_database() <> 'sanatpish_ci' THEN
   RAISE EXCEPTION 'Refusing to bootstrap outside sanatpish_ci';
 END IF;
END $$;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE TABLE auth.users(
  id uuid PRIMARY KEY,
  phone text,
  email text,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  phone_confirmed_at timestamptz,
  email_confirmed_at timestamptz
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon,authenticated;

CREATE SCHEMA storage;
CREATE TABLE storage.buckets(
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
CREATE TABLE storage.objects(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL REFERENCES storage.buckets(id),
  name text NOT NULL
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
 GRANT ALL ON TABLES TO anon,authenticated;
