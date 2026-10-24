-- Manual rollback ONLY. Preserve source images and verified DB records.
-- Before rollback confirm Volume still has all 869 originals byte-identical.
select pg_advisory_xact_lock(hashtext('sanatpish-source-catalog-image-cutover-v1'));
update public.catalog_image_audits set image_url=replace(image_url,'/products/catalog/','/storage/products/catalog/')
where image_url like '/products/catalog/e(%';
update public.catalog_image_features set image_url=replace(image_url,'/products/catalog/','/storage/products/catalog/')
where image_url like '/products/catalog/e(%';
update public.catalog_gallery_images set url=replace(url,'/products/catalog/','/storage/products/catalog/')
where url like '/products/catalog/e(%';
update public.catalog_summary_entries set image_url=replace(image_url,'/products/catalog/','/storage/products/catalog/')
where image_url like '/products/catalog/e(%';
update public.catalog_categories set image_url=replace(image_url,'/products/catalog/','/storage/products/catalog/')
where image_url like '/products/catalog/e(%';
update public.catalog_families set images=replace(images::text,'/products/catalog/','/storage/products/catalog/')::jsonb
where images::text like '%/products/catalog/e(%';
update public.catalog_variants set images=replace(images::text,'/products/catalog/','/storage/products/catalog/')::jsonb
where images::text like '%/products/catalog/e(%';
update public.portal_kv_store set value=replace(value::text,'/products/catalog/','/storage/products/catalog/')::jsonb
where key='catalog_overrides_db_v1' and value::text like '%/products/catalog/e(%';
