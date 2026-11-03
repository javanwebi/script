import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {APPROVED_MENU_GROUPS} from '../src/data/approvedMenuFallback.ts';

test('additive production recovery seeds every approved spreadsheet group without overwriting admin edits',()=>{
 const sql=readFileSync('ops/sql/20261103_recover_missing_production_catalog_navigation.sql','utf8');
 assert.equal(APPROVED_MENU_GROUPS.length,14);
 for(const group of APPROVED_MENU_GROUPS) {
  assert.ok(sql.includes("'"+group.id+"'"),"Missing "+group.id);
  assert.ok(sql.includes("'"+group.title+"'"),"Missing "+group.title);
 }
 assert.match(sql,/BEGIN;/);
 assert.match(sql,/COMMIT;/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public.catalog_navigation_groups/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public.catalog_family_menu_assignments/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public.catalog_direct_skus/);
 assert.match(sql,/ON CONFLICT \(id\) DO NOTHING/);
 assert.doesNotMatch(sql,/\b(DROP|TRUNCATE|DELETE|UPDATE|ALTER\s+TABLE\s+public\.catalog_categories)\b/i);
});
test('canonical one-command deploy safely repairs only the database currently used by the live production container',()=>{
 const deploy=readFileSync('ops/deploy-main-bluegreen-vps.sh','utf8');
 const wrapper=readFileSync('ops/sanatpish-deploy-main.sh','utf8');
 assert.match(wrapper,/git fetch origin main/);
 assert.match(wrapper,/ops\/deploy-main-bluegreen-vps.sh/);
 assert.match(deploy,/docker exec -i "\$OLD"/);
 assert.match(deploy,/PRODUCTION_NAVIGATION_GROUPS_VERIFIED/);
 assert.match(deploy,/20261103_recover_missing_production_catalog_navigation.sql/);
 assert.match(deploy,/SANATPISH_MAIN_BLUEGREEN_DEPLOY_OK/);
 assert.ok(deploy.indexOf('PRODUCTION_NAVIGATION_GROUPS_VERIFIED') < deploy.indexOf("echo '===== START NEW CANARY ====='"));
});
