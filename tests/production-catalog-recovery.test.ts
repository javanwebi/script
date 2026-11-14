import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {APPROVED_MENU_GROUPS} from '../src/data/approvedMenuFallback.ts';
import {CATALOG_FAMILY_MENU_ASSIGNMENTS} from '../src/data/catalogMenuAssignmentsData.ts';

test('additive production recovery seeds every approved spreadsheet group without overwriting admin edits',()=>{
 const sql=readFileSync('ops/sql/20261103_recover_missing_production_catalog_navigation.sql','utf8');
 assert.equal(APPROVED_MENU_GROUPS.length,14);
 for(const group of APPROVED_MENU_GROUPS) {
  assert.ok(sql.includes("'"+group.id+"'"),"Missing "+group.id);
  assert.ok(sql.includes("'"+group.title+"'"),"Missing "+group.title);
 }
 assert.match(sql,/BEGIN;/);
 assert.match(sql,/COMMIT;/);
 assert.match(sql,/INSERT INTO public.catalog_categories/);
 assert.match(sql,/ON CONFLICT \(slug\) DO NOTHING/);
 assert.match(sql,/industrial_megamenu_hierarchy_v2/);
 assert.match(sql,/Approved category bootstrap incomplete/);
 assert.match(sql,/Database fingerprint mismatch/);
 const seededCategorySlugs=[...sql.matchAll(/\('excel-v2-([0-9]+)-([0-9]+)','excel-v2-/g)];
 assert.equal(seededCategorySlugs.length,34);
 assert.ok(sql.indexOf('INSERT INTO public.catalog_categories') < sql.indexOf('INSERT INTO public.catalog_navigation_groups'));
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public.catalog_navigation_groups/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public.catalog_family_menu_assignments/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public.catalog_direct_skus/);
 assert.match(sql,/ON CONFLICT \(id\) DO NOTHING/);
 assert.doesNotMatch(sql,/^\s*(DROP\s+|TRUNCATE\s+|DELETE\s+FROM\s+|UPDATE\s+|ALTER\s+TABLE\s+public\.catalog_categories\b)/gim);
});
test('canonical one-command deploy safely repairs only the database currently used by the live production container',()=>{
 const deploy=readFileSync('ops/deploy-main-bluegreen-vps.sh','utf8');
 const wrapper=readFileSync('ops/sanatpish-deploy-main.sh','utf8');
 assert.match(wrapper,/git fetch origin main/);
 assert.match(wrapper,/ops\/deploy-main-bluegreen-vps.sh/);
 assert.match(deploy,/docker exec -i "\$OLD"/);
 assert.match(deploy,/PRODUCTION_NAVIGATION_GROUPS_VERIFIED/);
 assert.match(deploy,/PRODUCTION_APPROVED_CATEGORIES_VERIFIED/);
 assert.match(deploy,/20261103_recover_missing_production_catalog_navigation.sql/);
 assert.match(deploy,/SANATPISH_MAIN_BLUEGREEN_DEPLOY_OK/);
 assert.ok(deploy.indexOf('PRODUCTION_NAVIGATION_GROUPS_VERIFIED') < deploy.indexOf("echo '===== START NEW CANARY ====='"));
});
test('canonical deploy final HTTPS probe uses the production hostname and matching TLS SNI',()=>{
 const wrapper=readFileSync('ops/sanatpish-deploy-main.sh','utf8');
 assert.match(wrapper,/--resolve sanatpish\.com:443:127\.0\.0\.1/);
 assert.match(wrapper,/https:\/\/sanatpish\.com\/api\/health/);
 assert.match(wrapper,/FINAL_HTTPS_HEALTH_OK domain=sanatpish\.com sni=correct/);
 assert.match(wrapper,/grep -q '"database":"ok"'/);
 assert.doesNotMatch(wrapper,/https:\/\/127\.0\.0\.1\/api\/health/);
});

test('blue/green publish rejects React SPA fallback for FORZA STT diagnostics',()=>{
 const script=readFileSync('ops/deploy-main-bluegreen-vps.sh','utf8');
 assert.match(script,/FORZA_STT_CANARY_API_JSON_OK/);
 assert.match(script,/FORZA_STT_PUBLIC_API_RETURNED_HTML/);
 assert.match(script,/PUBLIC_FORZA_STT_API_JSON_OK/);
 assert.match(script,/api\/ai\/forza-stt-info/);
 assert.match(script,/application\/json/);
 assert.ok(script.indexOf("FORZA_STT_CANARY_API_JSON_OK") < script.indexOf("echo '===== ATOMIC NGINX TRAFFIC SWITCH ====='"),
   'private canary API must be JSON before touching Nginx');
 assert.ok(script.indexOf("PUBLIC_FORZA_STT_API_JSON_OK") < script.indexOf("SUCCESS=1"),
   'public HTTPS API must be JSON before successful publish');
 assert.match(script,/NGINX_ROLLBACK_OK/);
});

test('production deploy applies every canonical family-menu assignment without overwriting admin-verified edits',()=>{
 const sql=readFileSync('ops/sql/20261101_catalog_family_menu_assignments.sql','utf8');
 const singlePort=readFileSync('ops/deploy-single-port-vps.sh','utf8');
 const wrapper=readFileSync('ops/deploy-main-bluegreen-vps.sh','utf8');
 const source=CATALOG_FAMILY_MENU_ASSIGNMENTS;
 const rows=[...sql.matchAll(/\n\('(FAM-[^']+)','(excel-v2-[0-9]+-[0-9]+)',(NULL|'(?:''|[^'])*'),(NULL|'(?:''|[^'])*'),'conservative_name_rule'\)/g)];
 const literal=(value:string)=>value==='NULL'?null:value.slice(1,-1).replace(/''/g,"'");
 const actual=Object.fromEntries(rows.map(match=>[match[1],{
  categorySlug:match[2],
  submenuName:literal(match[3]),
  leafName:literal(match[4]),
 }]));
 const sorted=(value:Record<string,unknown>)=>Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
 assert.equal(rows.length,1383);
 assert.equal(new Set(rows.map(match=>match[1])).size,1383);
 assert.deepEqual(sorted(actual),sorted(source));
 assert.equal(Object.values(source).filter(item=>item.categorySlug==='excel-v2-1-4').length,21);
 assert.match(sql,/BEGIN;/);
 assert.match(sql,/ON CONFLICT\(family_code\) DO UPDATE SET/);
 assert.match(sql,/WHERE public\.catalog_family_menu_assignments\.method <> 'admin_verified'/);
 assert.match(sql,/COMMIT;/);
 assert.doesNotMatch(sql,/^\s*(DROP\s+|TRUNCATE\s+|DELETE\s+FROM\s+|UPDATE\s+)/gim);
 assert.match(singlePort,/20261101_catalog_family_menu_assignments\.sql/);
 assert.match(singlePort,/Expected at least 1383 family menu assignments/);
 assert.match(singlePort,/Expected 21 assignments for excel-v2-1-4/);
 assert.match(singlePort,/Expected all 34 approved categories to contain active families/);
 assert.match(singlePort,/PRODUCTION_APPROVED_CATEGORIES_WITH_FAMILIES_VERIFIED/);
 assert.match(wrapper,/deploy-single-port-vps\.sh/);
 assert.ok(singlePort.indexOf('PRODUCTION_FAMILY_MENU_ASSIGNMENTS_VERIFIED') < singlePort.indexOf("echo '===== PRIVATE CANARY WITHOUT A HOST PORT ====='"));
});
