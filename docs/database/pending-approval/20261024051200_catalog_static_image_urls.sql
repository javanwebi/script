-- PRODUCTION APPROVAL REQUIRED. DO NOT RUN THIS FROM PR CI.
-- Preconditions: independently back up PostgreSQL and the /data Volume;
-- check that all 869 original PNGs and 1,738 derivatives are present
-- in a successful production deploy. No changes to SKU codes or prices.
select pg_advisory_xact_lock(hashtext('sanatpish-source-catalog-image-cutover-v1'));
do $guard$
declare n integer;
begin
 select count(*) into n from public.catalog_image_audits
 where image_url ~ '^/storage/products/catalog/e\\([1-9][0-9]{0,3}\\)\\.png$';
 if n <> 869 then raise exception 'Expected 869 verified volume images, found %',n; end if;
end $guard$;

-- Extra in-database evidence; also make an INDEPENDENT external backup first.
with snapshot as (
 select jsonb_build_object(
  'catalog_image_audits',(select coalesce(jsonb_agg(jsonb_build_object('file',file_name,'url',image_url)),'[]'::jsonb)
       from public.catalog_image_audits where image_url like '/storage/products/catalog/%'),
  'catalog_gallery_images',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'url',url)),'[]'::jsonb)
       from public.catalog_gallery_images where url like '/storage/products/catalog/%'),
  'catalog_image_features',(select coalesce(jsonb_agg(jsonb_build_object('file',file_name,'url',image_url)),'[]'::jsonb)
       from public.catalog_image_features where image_url like '/storage/products/catalog/%'),
  'catalog_summary_entries',(select coalesce(jsonb_agg(jsonb_build_object('file',file_name,'url',image_url)),'[]'::jsonb)
       from public.catalog_summary_entries where image_url like '/storage/products/catalog/%')
 ) as content
)
insert into app_private.source_archives(source_path,sha256,payload)
select 'manual-backup/product-image-url-cutover/20261024',
 encode(digest(convert_to(content::text,'UTF8'),'sha256'),'hex'),content from snapshot
on conflict(source_path,sha256) do nothing;

update public.catalog_image_audits set image_url=replace(image_url,'/storage/products/catalog/','/products/catalog/')
where image_url like '/storage/products/catalog/e(%';
update public.catalog_image_features set image_url=replace(image_url,'/storage/products/catalog/','/products/catalog/')
where image_url like '/storage/products/catalog/e(%';
update public.catalog_gallery_images set url=replace(url,'/storage/products/catalog/','/products/catalog/')
where url like '/storage/products/catalog/e(%';
update public.catalog_summary_entries set image_url=replace(image_url,'/storage/products/catalog/','/products/catalog/')
where image_url like '/storage/products/catalog/e(%';
update public.catalog_categories set image_url=replace(image_url,'/storage/products/catalog/','/products/catalog/')
where image_url like '/storage/products/catalog/e(%';
update public.catalog_families set images=replace(images::text,'/storage/products/catalog/','/products/catalog/')::jsonb
where images::text like '%/storage/products/catalog/e(%';
update public.catalog_variants set images=replace(images::text,'/storage/products/catalog/','/products/catalog/')::jsonb
where images::text like '%/storage/products/catalog/e(%';
update public.portal_kv_store set value=replace(value::text,'/storage/products/catalog/','/products/catalog/')::jsonb
where key='catalog_overrides_db_v1' and value::text like '%/storage/products/catalog/e(%';

do $verify$
declare n integer;
begin
 select count(*) into n from public.catalog_image_audits
 where image_url ~ '^/products/catalog/e\\([1-9][0-9]{0,3}\\)\\.png$';
 if n <> 869 then raise exception 'Cutover incomplete; found % authoritative original images',n; end if;
end $verify$;
