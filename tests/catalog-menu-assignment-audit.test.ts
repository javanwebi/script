import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import type {Product} from '../src/types';
import {APPROVED_MENU_CATEGORIES} from '../src/data/approvedMenuFallback.ts';
import {CATALOG_FAMILY_MENU_ASSIGNMENTS} from '../src/data/catalogMenuAssignmentsData.ts';
import {getFamilyMenuAssignment,resolveMenuCategoryPayload} from '../src/services/catalogTaxonomyResolver.ts';

const reviewCodes=[
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
];

test('approved industrial menu retains exactly 67 technical leaf nodes',()=>{
 const leafCount=APPROVED_MENU_CATEGORIES.reduce(
  (total,category)=>total+(category.children||[]).reduce(
   (subTotal,submenu)=>subTotal+(submenu.children||[]).length,0
  ),0
 );
 assert.equal(APPROVED_MENU_CATEGORIES.length,34);
 assert.equal(leafCount,67);
});

test('every retained family assignment points to an approved category and valid named nodes',()=>{
 for(const [familyCode,assignment] of Object.entries(CATALOG_FAMILY_MENU_ASSIGNMENTS)){
  const category=APPROVED_MENU_CATEGORIES.find(item=>item.slug===assignment.categorySlug);
  assert.ok(category, familyCode+' has an unapproved category '+assignment.categorySlug);
  if(!assignment.submenuName) continue;
  const submenu=(category.children||[]).find(node=>node.name===assignment.submenuName);
  assert.ok(submenu,familyCode+' has an unapproved submenu '+assignment.submenuName);
  if(assignment.leafName){
   assert.ok((submenu.children||[]).some(node=>node.name===assignment.leafName),
    familyCode+' has an unapproved leaf '+assignment.leafName);
  }
 }
});

test('the three source-confirmed stainless guide families map to the stainless rail leaf only',()=>{
 for(const familyCode of ['FAM-35826','FAM-10105','FAM-52948']){
  assert.deepEqual(CATALOG_FAMILY_MENU_ASSIGNMENTS[familyCode],{
   categorySlug:'excel-v2-6-2',
   submenuName:'نرده استیل',
   leafName:'نرده استیل و متعلقات',
  });
 }
});

test('ambiguous and source-conflicting families are left for admin review',()=>{
 for(const familyCode of reviewCodes){
  assert.equal(CATALOG_FAMILY_MENU_ASSIGNMENTS[familyCode],undefined,familyCode+' must not have an automatic mapping');
  assert.equal(getFamilyMenuAssignment(familyCode),null,familyCode+' must not receive a heuristic fallback');
  assert.equal(getFamilyMenuAssignment({
   code:familyCode,
   categorySlug:'excel-v2-1-1',
   submenu:'سیم‌دار فابریک',
   subcategory:'پلی‌یورتان',
  } as any),null,familyCode+' must not fall back to legacy product metadata');
 }
 assert.equal(getFamilyMenuAssignment('FAM-999999'),null);
 const legacyProduct={
  code:'FAM-80151',
  categorySlug:'excel-v2-1-1',
  submenu:'سیم‌دار فابریک',
  subcategory:'پلی‌یورتان',
 } as unknown as Product;
 assert.equal(getFamilyMenuAssignment(legacyProduct),null,
  'legacy product category metadata must not bypass the explicit review map');
});

test('rubber-factory timing belts are not populated without material evidence in the source workbook',()=>{
 const timing=APPROVED_MENU_CATEGORIES.find(category=>category.slug==='excel-v2-1-1');
 const rubber=timing?.children?.find(submenu=>submenu.name==='لاستیکی فابریک');
 const leaf=rubber?.children?.find(node=>node.name==='لاستیکی فابریک ساده و دنده‌دار');
 assert.ok(leaf,'approved rubber-factory leaf must remain present');
 assert.equal(Object.values(CATALOG_FAMILY_MENU_ASSIGNMENTS).filter(
  assignment=>assignment.categorySlug==='excel-v2-1-1'
    &&assignment.submenuName==='لاستیکی فابریک'
    &&assignment.leafName===leaf.name
 ).length,0);
});

test('invalid menu routes do not fall through to the first approved category',()=>{
 assert.equal(resolveMenuCategoryPayload('not-a-real-category'),null);
});

test('the current family map has 1,287 retained rows and exposes incomplete assignments for review',()=>{
 assert.equal(Object.keys(CATALOG_FAMILY_MENU_ASSIGNMENTS).length,1287);
 assert.equal(Object.values(CATALOG_FAMILY_MENU_ASSIGNMENTS).filter(item=>!item.submenuName).length,55);
 assert.equal(Object.values(CATALOG_FAMILY_MENU_ASSIGNMENTS).filter(item=>!item.leafName).length,265);
});

test('21 approved menu leaves have no explicit family leaf mapping after this audit',()=>{
 const leaves=APPROVED_MENU_CATEGORIES.flatMap(category=>(category.children||[]).flatMap(submenu=>
  (submenu.children||[]).map(leaf=>({categorySlug:category.slug,submenuName:submenu.name,leafName:leaf.name}))
 ));
 const empty=leaves.filter(leaf=>!Object.values(CATALOG_FAMILY_MENU_ASSIGNMENTS).some(item=>
  item.categorySlug===leaf.categorySlug&&item.submenuName===leaf.submenuName&&item.leafName===leaf.leafName
 ));
 assert.equal(empty.length,21);
});

test('the resolver has no first-submenu or first-leaf defaulting rule',()=>{
 const source=readFileSync('src/services/catalogTaxonomyResolver.ts','utf8');
 assert.doesNotMatch(source,/defaultSubmenu|children\?\.\[0\]\?\.name/);
 assert.match(source,/if \(!assignment \|\| assignment\.categorySlug !== cleanSlug\) continue/);
});


test('the polyurethane timing-belt leaf has no families without explicit PU evidence',()=>{
 const falsePolyurethaneFamilies=[
  'FAM-30',
  'FAM-10111',
  'FAM-10410',
  'FAM-22751',
  'FAM-32711',
  'FAM-32735',
  'FAM-34854',
  'FAM-35525',
  'FAM-35624',
  'FAM-36750',
  'FAM-37769',
  'FAM-38283',
  'FAM-38285',
  'FAM-38697',
  'FAM-38786',
  'FAM-39005',
  'FAM-39130',
  'FAM-40417',
  'FAM-40462',
  'FAM-40604',
  'FAM-40609',
  'FAM-41253',
  'FAM-41326',
  'FAM-51279',
  'FAM-52319',
  'FAM-52735',
  'FAM-38906',

  'FAM-80151',
  'FAM-31929',];
 for(const familyCode of falsePolyurethaneFamilies){
  assert.equal(CATALOG_FAMILY_MENU_ASSIGNMENTS[familyCode],undefined);
 }
 assert.equal(Object.values(CATALOG_FAMILY_MENU_ASSIGNMENTS).filter(
  assignment=>assignment.categorySlug==='excel-v2-1-1'
   &&assignment.submenuName==='سیم‌دار فابریک'
   &&assignment.leafName==='پلی‌یورتان'
 ).length,0);
});

test('mixed conveyor family stays at parent level while rail/guide families map to approved leaves',()=>{
 assert.deepEqual(CATALOG_FAMILY_MENU_ASSIGNMENTS['FAM-52858'],{
  categorySlug:'excel-v2-2-1',submenuName:'بر اساس جنس',leafName:null
 });
 for(const familyCode of ['FAM-33201','FAM-90314','FAM-90251','FAM-90249','FAM-90037']){
  assert.deepEqual(CATALOG_FAMILY_MENU_ASSIGNMENTS[familyCode],{
   categorySlug:'excel-v2-6-1',submenuName:'بر اساس تیپ و کاربرد',leafName:'ریل تیپ B و تیپ C'
  });
 }
 for(const familyCode of ['FAM-33952','FAM-36235']){
  assert.deepEqual(CATALOG_FAMILY_MENU_ASSIGNMENTS[familyCode],{
   categorySlug:'excel-v2-6-1',submenuName:'بر اساس تیپ و کاربرد',leafName:'ریل تایمینگ، زنجیر و دنده شانه'
  });
 }
 assert.deepEqual(CATALOG_FAMILY_MENU_ASSIGNMENTS['FAM-40690'],{
  categorySlug:'excel-v2-6-1',submenuName:'بر اساس جنس',leafName:'ریل راهنما تفلون و متعلقات'
 });
 for(const familyCode of ['FAM-31443','FAM-36297','FAM-40689','FAM-38349']){
  assert.deepEqual(CATALOG_FAMILY_MENU_ASSIGNMENTS[familyCode],{
   categorySlug:'excel-v2-6-2',submenuName:'گاید تفلونی',leafName:'۲ لبه و متعلقات'
  });
 }
});

test('approved page family counts align to the audited source groups',()=>{
 const values=Object.values(CATALOG_FAMILY_MENU_ASSIGNMENTS);
 assert.equal(values.filter(item=>item.categorySlug==='excel-v2-6-2').length,73);
 assert.equal(values.filter(item=>item.categorySlug==='excel-v2-2-1').length,2);
 assert.equal(values.filter(item=>item.categorySlug==='excel-v2-2-2').length,0);
});

test('mixed-material families remain at parent level until SKU-level overrides are available',()=>{
 assert.deepEqual(CATALOG_FAMILY_MENU_ASSIGNMENTS['FAM-52858'],{
  categorySlug:'excel-v2-2-1',submenuName:'بر اساس جنس',leafName:null
 });
 assert.deepEqual(CATALOG_FAMILY_MENU_ASSIGNMENTS['FAM-33117'],{
  categorySlug:'excel-v2-6-1',submenuName:'بر اساس جنس',leafName:null
 });
});

test('direct SKU records are filtered into the same Excel category collection as family products',()=>{
 const source=readFileSync('src/pages/ProductsPage.tsx','utf8');
 assert.match(source,/directSkuCodeSet\.has\(product\.code\)[\s\S]*?matchesCatalogCategory\(product, selectedCategory, selectedSubcategory\)/);
 assert.match(source,/matchesProductMenuSelection\(product, selectedCategory, selectedSubcategory, liveFamilyMenuIndex, directSkuCodeSet\)/);
});

test('source-verified mixed-family SKU overrides populate the correct technical leaves',()=>{
 const skuSql=readFileSync('ops/sql/20261114_catalog_sku_level_menu_assignments.sql','utf8');
 const skuCodes=[...skuSql.matchAll(/'([0-9]{4,6})'/g)].map(match=>match[1]);
 assert.equal(skuCodes.length,303);
 assert.equal(new Set(skuCodes).size,303);
 assert.match(skuSql,/ON CONFLICT \(sku_code\) DO NOTHING/);
 assert.match(skuSql,/source_family_code/);
 assert.match(skuSql,/نوار نقاله PVC/);
 assert.match(skuSql,/نوار نقاله پلی‌اورتان \(PU\)/);
 assert.match(skuSql,/انواع تسمه گرد جوشی/);
 assert.match(skuSql,/ریل راهنما استیل و متعلقات/);
 assert.match(skuSql,/ریل راهنما آهنی و متعلقات/);
 assert.match(skuSql,/ریل راهنما گالوانیزه و متعلقات/);
});

test('family-backed direct SKUs are hidden only while their source family is visible',()=>{
 const source=readFileSync('src/pages/ExcelMenuCategoryPage.tsx','utf8');
 assert.match(source,/const sourceFamilyCode = String\(item\.sourceFamilyCode \|\| ''\)/);
 assert.match(source,/selectedFamilyCodesForFacet\.has\(sourceFamilyCode\)/);
 assert.match(source,/!selectedFamilyCodesForFacet\.has\(skuCode\)/);
});

test('category pages merge SKU-level records into the same collection as family products',()=>{
 const source=readFileSync('src/pages/ExcelMenuCategoryPage.tsx','utf8');
 assert.match(source,/useDirectSkus/);
 assert.match(source,/directSkuProducts/);
});
