import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migrationPath = 'supabase/migrations/20261116145916_belt_orphan_direct_skus_and_restore_pvc_units.sql';
const rollbackPath = 'ops/sql/20261116_belt_orphan_direct_skus_and_restore_pvc_units_rollback.sql';

test('familyless belt SKUs become standalone direct products and PVC units restore reversibly', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema internal;
      create table internal.catalog_belt_taxonomy_backup_20261116 (row_key text primary key);
      create table public.catalog_categories (slug text primary key, is_active boolean not null);
      create table public.catalog_families (code text primary key, is_active boolean not null, is_deleted boolean);
      create table public.catalog_variants (
        code text primary key,
        name text not null,
        family_code text,
        reconstructed_family_code text,
        active boolean not null,
        proposed_category_slug text,
        proposed_submenu text,
        brand text,
        unit text,
        images jsonb not null default '[]'::jsonb,
        technical_specs jsonb not null default '[]'::jsonb,
        updated_at timestamptz not null default now()
      );
      create table public.backup_20261116_catalog_variants (
        code text primary key,
        family_code text,
        unit text
      );
      create table public.catalog_direct_skus (
        sku_code text primary key,
        name text not null,
        category_slug text not null,
        category_name text not null,
        submenu text not null default '',
        subcategory text not null default '',
        brand text not null default '',
        image_url text,
        technical_specs jsonb not null default '[]'::jsonb,
        price_snapshot jsonb not null default '{}'::jsonb,
        source_family_code text,
        is_active boolean not null default true,
        updated_at timestamptz not null default now()
      );
      insert into public.catalog_categories(slug,is_active) values ('excel-v2-1-1',true);
    `);

    const standaloneCodes = ['10077','10265','10695','32929','34483','34854','38910','41630','58288','58304'];
    for (const code of standaloneCodes) {
      await db.query(
        `insert into public.catalog_variants
          (code,name,family_code,reconstructed_family_code,active,proposed_category_slug,proposed_submenu,brand,unit,images,technical_specs)
         values($1,$2,$3,null,true,$4,$5,'TEST','حلقه','[]'::jsonb,'[]'::jsonb)`,
        [code, `تسمه تست ${code}`, `FAM-${code}`, 'excel-v2-1-1', 'انواع گام و کدهای تایمینگ']
      );
    }

    const unitSources = [
      ['10256','عدد'],['10549','عدد'],['33439','عدد'],['38287','عدد'],
      ['39365','متر'],['39703','متر'],['3970318','متر'],['40036','متر مربع'],
      ['41152','متر'],['41248','متر'],['41587','عدد'],['41715','رول'],
      ['64360','متر'],['87965','عدد']
    ];
    for (const [code, sourceUnit] of unitSources) {
      await db.query(
        `insert into public.catalog_variants
          (code,name,family_code,reconstructed_family_code,active,brand,unit,images,technical_specs)
         values($1,$2,'FAM-52858',null,true,'TEST','حلقه','[]'::jsonb,'[]'::jsonb)`,
        [code, `PVC test ${code}`]
      );
      await db.query(
        `insert into public.backup_20261116_catalog_variants(code,family_code,unit)
         values($1,'FAM-52858',$2)`,
        [code, sourceUnit]
      );
    }

    await db.exec(await readFile(migrationPath, 'utf8'));

    const direct = await db.query<{ count: number }>(
      `select count(*)::int as count from public.catalog_direct_skus
       where sku_code=any(array['10077','10265','10695','32929','34483','34854','38910','41630','58288','58304']::text[])
         and is_active=true`
    );
    assert.equal(direct.rows[0].count, 10);

    const timingParent = await db.query<{ count: number }>(
      `select count(*)::int as count from public.catalog_direct_skus
       where sku_code in ('10077','10265','10695','32929','41630')
         and category_slug='excel-v2-1-1' and submenu='انواع گام و کدهای تایمینگ' and subcategory=''`
    );
    assert.equal(timingParent.rows[0].count, 5);

    const unresolved = await db.query<{ count: number }>(
      `select count(*)::int as count from public.catalog_direct_skus
       where sku_code in ('34483','34854','38910','58304') and category_slug='UNRESOLVED'`
    );
    assert.equal(unresolved.rows[0].count, 4);

    const units = await db.query<{ count: number }>(
      `select count(*)::int as count from public.catalog_variants v
       join public.backup_20261116_catalog_variants b on b.code=v.code
       where b.family_code='FAM-52858' and v.unit=b.unit`
    );
    assert.equal(units.rows[0].count, 14);

    const snapshots = await db.query<{ units: number; direct: number }>(
      `select
        (select count(*)::int from internal.catalog_variants_unit_restore_backup_20261116) as units,
        (select count(*)::int from internal.catalog_orphan_belt_direct_backup_20261116) as direct`
    );
    assert.deepEqual(snapshots.rows[0], { units: 14, direct: 10 });

    await db.exec(await readFile(rollbackPath, 'utf8'));

    const afterRollback = await db.query<{ direct: number; restored: number }>(
      `select
        (select count(*)::int from public.catalog_direct_skus
         where sku_code=any(array['10077','10265','10695','32929','34483','34854','38910','41630','58288','58304']::text[])) as direct,
        (select count(*)::int from public.catalog_variants v
         join internal.catalog_variants_unit_restore_backup_20261116 b on b.code=v.code
         where v.unit=b.previous_unit) as restored`
    );
    assert.deepEqual(afterRollback.rows[0], { direct: 0, restored: 14 });
  } finally {
    await db.close();
  }
});
