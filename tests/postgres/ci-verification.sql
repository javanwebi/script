-- Executed only against the isolated GitHub Actions PostgreSQL service.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE n int; fk_count int; index_count int;
BEGIN
 IF current_database() <> 'sanatpish_ci' THEN RAISE EXCEPTION 'Unsafe database target'; END IF;
 SELECT count(*) INTO n FROM information_schema.tables
 WHERE table_schema='public' AND table_type='BASE TABLE';
 IF n < 45 THEN RAISE EXCEPTION 'Schema incomplete: % public tables',n; END IF;
 SELECT count(*) INTO fk_count FROM pg_constraint
 WHERE contype='f' AND connamespace='public'::regnamespace;
 IF fk_count < 30 THEN RAISE EXCEPTION 'Missing FKs: %',fk_count; END IF;
 SELECT count(*) INTO index_count FROM pg_indexes WHERE schemaname='public';
 IF index_count < 35 THEN RAISE EXCEPTION 'Missing indexes: %',index_count; END IF;
 IF EXISTS (
  SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN
  ('user_profiles','orders','order_items','catalog_families','catalog_variants',
   'variant_commercial_specs','support_tickets','ticket_messages')
   AND c.relrowsecurity IS NOT TRUE
 ) THEN RAISE EXCEPTION 'RLS missing on a protected table'; END IF;
 IF NOT EXISTS(SELECT 1 FROM app_private.schema_change_log
               WHERE version='20261022120000') THEN
   RAISE EXCEPTION 'Backfill migration not applied';
 END IF;
 RAISE NOTICE 'verified public tables %, foreign keys %, indexes %',n,fk_count,index_count;
END $$;

INSERT INTO auth.users(id,phone,phone_confirmed_at,raw_user_meta_data)
VALUES
 ('11111111-1111-4111-8111-111111111111','+989120000001',now(),
  '{"name":"Example Buyer","role":"super_admin"}'::jsonb),
 ('22222222-2222-4222-8222-222222222222','+989120000002',now(),'{}'::jsonb);
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles
 WHERE id='11111111-1111-4111-8111-111111111111' AND role='client') THEN
  RAISE EXCEPTION 'Auth trigger failed or user-editable metadata escalated privileges';
 END IF;
END $$;

INSERT INTO public.catalog_families(code,name,category_slug,category_name)
VALUES('CI-FAM-01','Sample bearing','parts','Parts');
INSERT INTO public.catalog_variants(code,family_code,name)
VALUES('CI-SKU-01','CI-FAM-01','Test bearing SKU');
INSERT INTO public.variant_commercial_specs
 (variant_code,family_code,retail_price,stock,stock_known,inquiry_only,currency)
VALUES('CI-SKU-01','CI-FAM-01',12300,5,true,false,'IRR');

INSERT INTO public.orders(id,user_id,customer_name,phone,total_amount)
VALUES('CI-ORDER-01','11111111-1111-4111-8111-111111111111',
       'Example Buyer','09120000001',12300);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id='CI-ORDER-01') THEN
  RAISE EXCEPTION 'Owner cannot read own order';
 END IF;
END $$;
SET LOCAL request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.orders WHERE id='CI-ORDER-01') THEN
  RAISE EXCEPTION 'RLS leaking customer order';
 END IF;
END $$;
RESET ROLE;

SAVEPOINT rollback_probe;
UPDATE public.catalog_families SET name='Never persist' WHERE code='CI-FAM-01';
ROLLBACK TO SAVEPOINT rollback_probe;
DO $$
BEGIN
 IF (SELECT name FROM public.catalog_families WHERE code='CI-FAM-01') <> 'Sample bearing'
 THEN RAISE EXCEPTION 'Savepoint rollback failed'; END IF;
END $$;
ROLLBACK;
SELECT 'PostgreSQL schema, FK/index, Auth trigger, RLS and rollback tests passed' AS result;
