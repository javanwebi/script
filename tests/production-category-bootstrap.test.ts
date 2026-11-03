import {PGlite} from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const sql=readFileSync('ops/sql/20261103_recover_missing_production_catalog_navigation.sql','utf8');

test('empty approved taxonomy recovers additively while preserving legacy categories and admin edits',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`
   create role anon;
   create role authenticated;
   create table public.catalog_categories (
     id text primary key, slug text not null unique, name text not null,
     icon text, image_url text, description text, sort_order integer not null default 0,
     is_active boolean not null default true, metadata jsonb not null default '{}'::jsonb
   );
   create table public.catalog_families (code text primary key);
   insert into public.catalog_categories (id,slug,name) select
      'legacy-'||n,'legacy-'||n,'Original legacy category '||n from generate_series(1,29) n;
   insert into public.catalog_families (code) select 'FAM-'||n from generate_series(1,140) n;
  `);
  await db.exec(sql);
  const counts=await db.query<{cat:number;groups:number}>(`
    select
      (select count(*)::int from public.catalog_categories where slug like 'excel-v2-%' and metadata->>'source'='industrial_megamenu_hierarchy_v2') as cat,
      (select count(*)::int from public.catalog_navigation_groups where id like 'excel-v2-%') as groups
  `);
  assert.deepEqual(counts.rows[0],{cat:34,groups:14});
  const original=await db.query<{n:number}>("select count(*)::int as n from public.catalog_categories where slug like 'legacy-%'");
  assert.equal(original.rows[0].n,29);
  const children=await db.query<{name:string,children:unknown}>("select name, metadata->'children' as children from public.catalog_categories where slug='excel-v2-1-1'");
  assert.equal(children.rows[0].name,'تسمه تایمینگ');
  assert.ok(Array.isArray(children.rows[0].children));

  // Subsequent deploys never change admin-assigned names or images.
  await db.exec("update public.catalog_navigation_groups set title='Admin renamed group' where id='excel-v2-1';");
  await db.exec("update public.catalog_categories set name='Admin renamed category' where slug='excel-v2-1-1';");
  await db.exec(sql);
  const admin=await db.query<{group_name:string;category_name:string}>(`
    select
      (select title from public.catalog_navigation_groups where id='excel-v2-1') as group_name,
      (select name from public.catalog_categories where slug='excel-v2-1-1') as category_name
  `);
  assert.equal(admin.rows[0].group_name,'Admin renamed group');
  assert.equal(admin.rows[0].category_name,'Admin renamed category');
 } finally { await db.close(); }
});

test('wrong or empty database fingerprint rejects bootstrap and rolls back',async()=>{
 const db=new PGlite();
 try{
   await db.exec(`
     create role anon; create role authenticated;
     create table public.catalog_categories (
       id text primary key,slug text not null unique,name text not null,
       icon text,image_url text,description text,sort_order integer not null default 0,
       is_active boolean not null default true,metadata jsonb not null default '{}'::jsonb
     );
     create table public.catalog_families (code text primary key);
   `);
   await assert.rejects(()=>db.exec(sql),/Database fingerprint mismatch/);
   const result=await db.query<{table_name:string|null}>("select to_regclass('public.catalog_navigation_groups')::text as table_name");
   assert.equal(result.rows[0].table_name,null);
 }finally{await db.close();}
});
