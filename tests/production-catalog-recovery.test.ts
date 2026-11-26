import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {APPROVED_MENU_GROUPS} from '../src/data/popdApprovedMenu.ts';
import {CATALOG_FAMILY_MENU_ASSIGNMENTS} from '../src/data/catalogMenuAssignmentsData.ts';

test('additive production recovery seeds the exact POPD groups while preserving group presentation and commercial data',()=>{
 const sql=readFileSync('ops/sql/20261103_recover_missing_production_catalog_navigation.sql','utf8');
 assert.equal(APPROVED_MENU_GROUPS.length,14);
 for(const group of APPROVED_MENU_GROUPS) {
  assert.ok(sql.includes("'"+group.id+"'"),"Missing "+group.id);
  assert.ok(sql.includes("'"+group.title+"'"),"Missing "+group.title);
 }
 assert.match(sql,/BEGIN;/);
 assert.match(sql,/COMMIT;/);
 assert.match(sql,/INSERT INTO public.catalog_categories/);
 assert.match(sql,/ON CONFLICT \(slug\) DO UPDATE/);
 assert.match(sql,/industrial_megamenu_hierarchy_v2/);
 assert.match(sql,/Approved category bootstrap incomplete/);
  assert.match(sql,/Expected exactly 40 approved POPD categories/);
  for(const group of APPROVED_MENU_GROUPS) {
   const expected="ARRAY["+group.categorySlugs.map(slug=>"'"+slug+"'").join(',')+"]::text[]";
   assert.ok(sql.includes(expected),"Missing exact POPD category membership for "+group.id);
  }
 assert.match(sql,/Database fingerprint mismatch/);
 const seededCategorySlugs=[...sql.matchAll(/\('excel-v2-([0-9]+)-([0-9]+)','excel-v2-/g)];
 assert.equal(seededCategorySlugs.length,40);
 assert.ok(sql.indexOf('INSERT INTO public.catalog_categories') < sql.indexOf('INSERT INTO public.catalog_navigation_groups'));
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public.catalog_navigation_groups/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public.catalog_family_menu_assignments/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public.catalog_direct_skus/);
  assert.match(sql,/ON CONFLICT \(id\) DO UPDATE/);
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
  const singlePort=readFileSync('ops/deploy-single-port-vps.sh','utf8');
  assert.match(singlePort,/PRODUCTION_GROUP_CATEGORY_COVERAGE_VERIFIED/);
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

test('production deploy keeps unverified families out of the bulk seed and applies only source-verified corrections',()=>{
 const sql=readFileSync('ops/sql/20261101_catalog_family_menu_assignments.sql','utf8');
 const singlePort=readFileSync('ops/deploy-single-port-vps.sh','utf8');
 const wrapper=readFileSync('ops/deploy-main-bluegreen-vps.sh','utf8');
 const skuSql=readFileSync('ops/sql/20261114_catalog_sku_level_menu_assignments.sql','utf8');
 const source=CATALOG_FAMILY_MENU_ASSIGNMENTS;
 const rows=[...sql.matchAll(/\n\('(FAM-[^']+)','(excel-v2-[0-9]+-[0-9]+)',(NULL|'(?:''|[^'])*'),(NULL|'(?:''|[^'])*'),'conservative_name_rule'\)/g)];
 const literal=(value:string)=>value==='NULL'?null:value.slice(1,-1).replace(/''/g,"'");
 const actual=Object.fromEntries(rows.map(match=>[match[1],{
  categorySlug:match[2],
  submenuName:literal(match[3]),
  leafName:literal(match[4]),
 }]));
 const sorted=(value:Record<string,unknown>)=>Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
 assert.equal(rows.length,1286);
 assert.equal(new Set(rows.map(match=>match[1])).size,1286);
 assert.equal(Object.keys(source).length,1286);
 assert.ok(Object.keys(source).every(familyCode=>familyCode.startsWith('FAM-')),'synthetic PFAM proposals must never enter the live family map');
 assert.deepEqual(sorted(actual),sorted(source));

 // These 21 former hauling/welded-family guesses are now explicitly held in the 97-family review queue.
 const unresolvedHaulingFamilies=[
  'FAM-34280','FAM-54569','FAM-381961','FAM-36858','FAM-39853','FAM-31520','FAM-32174',
  'FAM-39782','FAM-39852','FAM-41065','FAM-41498','FAM-33163','FAM-41601','FAM-38800',
  'FAM-35310','FAM-35743','FAM-33996','FAM-32247','FAM-32246','FAM-39114','FAM-40601'
 ];
 for(const familyCode of unresolvedHaulingFamilies)assert.equal(source[familyCode],undefined,familyCode+' must remain in admin review');

 const skuBlocks=[...skuSql.matchAll(/unnest\(ARRAY\[([\s\S]*?)\]::text\[\]\)/g)];
 const skuCodes=skuBlocks.flatMap(block=>[...block[1].matchAll(/'(\d+)'/g)].map(match=>match[1]));
 assert.equal(skuCodes.length,305);
 assert.equal(new Set(skuCodes).size,305);
 assert.match(skuSql,/ON CONFLICT\s*\(sku_code\)\s*DO NOTHING/);
 assert.match(skuSql,/BEGIN;/);
 assert.match(skuSql,/COMMIT;/);
 assert.doesNotMatch(skuSql,/^\s*(DROP\s+|TRUNCATE\s+|DELETE\s+FROM\s+|UPDATE\s+)/gim);

 // The 1,286 family seed is review-only; production applies only targeted verified corrections and SKU overrides.
 assert.match(singlePort,/SKIP UNVERIFIED BULK FAMILY MENU SEED/);
 assert.match(singlePort,/1,286-row family menu seed is intentionally not auto-applied/);
 assert.match(singlePort,/APPLY TARGETED EXCEL-VERIFIED FAMILY MENU CORRECTIONS/);
 assert.match(singlePort,/20261114_catalog_family_menu_audit_corrections\.sql/);
 assert.match(singlePort,/APPLY SOURCE-VERIFIED SKU-LEVEL MENU ASSIGNMENTS/);
 assert.match(singlePort,/20261114_catalog_sku_level_menu_assignments\.sql/);
 assert.match(singlePort,/PRODUCTION_SOURCE_VERIFIED_FAMILY_ASSIGNMENTS_OR_ADMIN_LOCKED/);
 assert.match(singlePort,/PRODUCTION_SKU_LEVEL_MENU_ASSIGNMENTS_VERIFIED/);
 assert.doesNotMatch(singlePort,/20261116_belt_family_(?:menu|taxonomy)_corrections/,'review-only taxonomy proposals must never auto-run on production');
 assert.match(wrapper,/deploy-single-port-vps\.sh/);
 assert.ok(singlePort.indexOf('SKIP UNVERIFIED BULK FAMILY MENU SEED')<singlePort.indexOf('PRIVATE CANARY WITHOUT A HOST PORT'));
});
