import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APPROVED_MENU_CATEGORIES, APPROVED_MENU_GROUPS } from '../src/data/approvedMenuFallback';

const sql=readFileSync('ops/sql/20261103_recover_missing_production_catalog_navigation.sql','utf8');
const deploy=readFileSync('ops/deploy-main-bluegreen-vps.sh','utf8');

test('migration contains all 34 exact approved Excel category slugs and 14 groups',()=>{
  assert.equal(APPROVED_MENU_CATEGORIES.length,34);
  assert.equal(APPROVED_MENU_GROUPS.length,14);
  const start=sql.indexOf('INSERT INTO public.catalog_categories');
  const stop=sql.indexOf('ON CONFLICT DO NOTHING;',start);
  assert.ok(start>0 && stop>start);
  const block=sql.slice(start,stop);
  const seeded=[...block.matchAll(/^ \('(excel-v2-[0-9]+-[0-9]+)'/gm)].map(match=>match[1]);
  const expected=APPROVED_MENU_CATEGORIES.map(cat=>cat.slug);
  assert.deepEqual(seeded,expected);
  assert.equal((block.match(/"source":"industrial_megamenu_hierarchy_v2"/g)||[]).length,34);
  for(const group of APPROVED_MENU_GROUPS)
    assert.ok(sql.includes("'"+group.id+"'"),group.id);
});

test('production repair never overwrites existing category, family or SKU rows',()=>{
  assert.match(sql,/^BEGIN;/m);
  assert.match(sql,/^COMMIT;/m);
  assert.match(sql,/ON CONFLICT DO NOTHING;/);
  assert.match(sql,/ON CONFLICT \(id\) DO NOTHING;/);
  assert.doesNotMatch(sql,/\bUPDATE\s+(?:public\.)?catalog_/i);
  assert.doesNotMatch(sql,/\bDELETE\s+FROM\s+(?:public\.)?catalog_/i);
  assert.doesNotMatch(sql,/\bTRUNCATE\s+(?:TABLE\s+)?(?:public\.)?catalog_/i);
  assert.doesNotMatch(sql,/\bDROP\s+TABLE\b/i);
  assert.match(sql,/family_total < 500 OR known_codes < 250/);
  assert.match(sql,/active_categories <> 34/);
  assert.match(sql,/IF available < 14 THEN/);
});

test('blue-green deploy verifies full taxonomy both before and after recovery',()=>{
  assert.match(deploy,/PRODUCTION_NAV_SCHEMA_STATUS/);
  assert.match(deploy,/Number\(approved\.rows\[0\]\.total\)<14/);
  assert.match(deploy,/Number\(categories\.rows\[0\]\.total\)<34/);
  assert.match(deploy,/Number\(x\.rows\[0\]\.n\)<14/);
  assert.match(deploy,/Number\(cats\.rows\[0\]\.n\)<34/);
  assert.match(deploy,/len\(approved\)>=14/);
  assert.match(deploy,/MISSING_APPROVED_CATEGORIES/);
  assert.match(deploy,/DEPLOY_FAILED_PREVIOUS_SITE_PRESERVED/);
});
