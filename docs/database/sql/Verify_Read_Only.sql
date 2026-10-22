-- Read-only verification. No DDL, DML, file reads or business record changes.
select 'families' as kind,count(*) as records from public.catalog_families union all
select 'variants',count(*) from public.catalog_variants union all
select 'commercial',count(*) from public.variant_commercial_specs union all
select 'image_audits',count(*) from public.catalog_image_audits;
select schemaname,tablename,rowsecurity from pg_tables where schemaname in ('public','app_private') order by schemaname,tablename;
select column_name,privilege_type,grantee from information_schema.column_privileges where table_schema='public' and table_name='user_profiles' and grantee='authenticated' order by column_name,privilege_type;
select name,public from storage.buckets where id in ('catalogue','customer-documents');
select version,description,applied_at from app_private.schema_change_log order by version;
