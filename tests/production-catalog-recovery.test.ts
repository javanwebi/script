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

test('bulk family-menu seed is withheld from production deploy until the complete taxonomy audit is approved',()=>{
 const sql=readFileSync('ops/sql/20261101_catalog_family_menu_assignments.sql','utf8');
 const correction=readFileSync('ops/sql/20261114_catalog_family_menu_audit_corrections.sql','utf8');
 const skuSql=readFileSync('ops/sql/20261114_catalog_sku_level_menu_assignments.sql','utf8');
 const mainDeploy=readFileSync('ops/deploy-main-bluegreen-vps.sh','utf8');
 const singlePort=readFileSync('ops/deploy-single-port-vps.sh','utf8');
 const source=CATALOG_FAMILY_MENU_ASSIGNMENTS;
 const rows=[...sql.matchAll(/^\('(FAM-[^']+)','(excel-v2-[0-9]+-[0-9]+)',(NULL|'(?:''|[^'])*'),(NULL|'(?:''|[^'])*'),'conservative_name_rule'\),?$/gm)];
 const literal=(value:string)=>value==='NULL'?null:value.slice(1,-1).replace(/''/g,"'");
 const actual=Object.fromEntries(rows.map(match=>[match[1],{
  categorySlug:match[2],
  submenuName:literal(match[3]) ?? '',
  leafName:literal(match[4]),
 }]));
 const sorted=(value:Record<string,unknown>)=>Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
 assert.equal(rows.length,1287);
 assert.equal(new Set(rows.map(match=>match[1])).size,1287);
 assert.deepEqual(sorted(actual),sorted(source));
 assert.equal(Object.values(source).filter(item=>item.categorySlug==='excel-v2-1-4').length,0);
 assert.equal(Object.values(source).filter(item=>item.categorySlug==='excel-v2-6-2').length,73);
 assert.equal(Object.values(source).filter(item=>item.categorySlug==='excel-v2-2-1').length,2);
 assert.equal(Object.values(source).filter(item=>item.categorySlug==='excel-v2-2-2').length,0);
 assert.equal(Object.values(source).filter(item=>item.categorySlug==='excel-v2-6-2'&&item.submenuName==='نرده استیل'&&item.leafName==='نرده استیل و متعلقات').length,3);
 assert.equal(Object.values(source).filter(item=>item.categorySlug==='excel-v2-2-1'&&item.submenuName==='بر اساس جنس'&&item.leafName==='نوار نقاله PVC').length,0);
 assert.match(sql,/ON CONFLICT\(family_code\) DO UPDATE SET/);
 assert.match(sql,/WHERE public\.catalog_family_menu_assignments\.method <> 'admin_verified'/);
 for(const script of [mainDeploy,singlePort]){
  assert.doesNotMatch(script,/20261101_catalog_family_menu_assignments\.sql/);
  assert.match(script,/SKIP UNVERIFIED BULK FAMILY MENU SEED/);
  assert.match(script,/20261114_catalog_family_menu_audit_corrections\.sql/);
  assert.match(script,/PRODUCTION_SOURCE_VERIFIED_FAMILY_ASSIGNMENTS_OR_ADMIN_LOCKED/);
  assert.match(script,/20261114_catalog_sku_level_menu_assignments\\.sql/);
  assert.match(script,/PRODUCTION_SKU_LEVEL_MENU_ASSIGNMENTS_VERIFIED/);
  assert.ok(script.includes("method=\\x27admin_verified\\x27 or"),"deploy must preserve admin-verified overrides");
 }
 assert.match(correction,/DELETE FROM public\.catalog_family_menu_assignments/);
 assert.match(correction,/method <> 'admin_verified'/);
 assert.match(correction,/excel_source_verified/);
 assert.match(correction,/method='admin_verified'/);
 assert.match(correction,/submenu_name='لاستیکی فابریک'/);
 assert.match(correction,/submenu_name='نرده استیل'/);
 assert.match(correction,/family_code NOT IN \('FAM-35826','FAM-10105','FAM-52948'\)/);
 assert.match(correction,/FAM-52858/);
 assert.match(correction,/leaf_name IS NULL/);
 assert.match(skuSql,/نوار نقاله PVC/);
 const skuCodes=[...skuSql.matchAll(/'([0-9]{4,6})'/g)].map(match=>match[1]);
 assert.equal(skuCodes.length,303);
 assert.equal(new Set(skuCodes).size,303);
 assert.match(skuSql,/ON CONFLICT \\(sku_code\\) DO NOTHING/);
 assert.match(skuSql,/source_family_code/);
 assert.doesNotMatch(correction,/DELETE FROM public\.catalog_families|DELETE FROM public\.catalog_variants/);
 for(const code of [
  'FAM-33416',
  'FAM-33126',
  'FAM-32711',
  'FAM-34280',
  'FAM-54569',
  'FAM-381961',
  'FAM-36858',
  'FAM-39853',
  'FAM-31520',
  'FAM-32174',
  'FAM-39782',
  'FAM-39852',
  'FAM-41065',
  'FAM-41498',
  'FAM-33163',
  'FAM-41601',
  'FAM-38800',
  'FAM-35310',
  'FAM-34854',
  'FAM-36750',
  'FAM-38283',
  'FAM-41326',
  'FAM-32735',
  'FAM-39005',
  'FAM-80151',
  'FAM-10111',
  'FAM-52319',
  'FAM-40462',
  'FAM-41253',
  'FAM-39130',
  'FAM-38906',
  'FAM-22751',
  'FAM-35525',
  'FAM-30',
  'FAM-37769',
  'FAM-51279',
  'FAM-40604',
  'FAM-10410',
  'FAM-40417',
  'FAM-38285',
  'FAM-38786',
  'FAM-35624',
  'FAM-40609',
  'FAM-52735',
  'FAM-31929',
  'FAM-38697',
  'FAM-35743',
  'FAM-33996',
  'FAM-32247',
  'FAM-32246',
  'FAM-321931',
  'FAM-39114',
  'FAM-40601',
  'FAM-10657',
  'FAM-34667',
  'FAM-34885',
  'FAM-34881',
  'FAM-34882',
  'FAM-37134',
  'FAM-32786',
  'FAM-39543',
  'FAM-35330',
  'FAM-33547',
  'FAM-31533',
  'FAM-90163',
  'FAM-90206',
  'FAM-40522',
  'FAM-40001',
  'FAM-34123',
  'FAM-34138',
  'FAM-40749',
  'FAM-40728',
  'FAM-34899',
  'FAM-35526',
  'FAM-36814',
  'FAM-32697',
  'FAM-41148',
  'FAM-38660',
  'FAM-39946',
  'FAM-34949',
  'FAM-33173',
  'FAM-32268',
  'FAM-37317',
  'FAM-33675',
  'FAM-35245',
  'FAM-13962',
  'FAM-13963',
  'FAM-33318',
  'FAM-34724',
  'FAM-37929',
  'FAM-36577',
  'FAM-33154',
  'FAM-37715',
  'FAM-10161',
  'FAM-90308',
  'FAM-38353'
 ]) assert.ok(correction.includes(code),"Missing review correction for "+code);
 for(const code of ['FAM-35826','FAM-10105','FAM-52948','FAM-52858']) assert.ok(correction.includes(code));
});

