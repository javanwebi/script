import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import type {Product} from '../src/types';
import {APPROVED_MENU_CATEGORIES} from '../src/data/approvedMenuFallback.ts';
import {CATALOG_FAMILY_MENU_ASSIGNMENTS} from '../src/data/catalogMenuAssignmentsData.ts';
import {getFamilyMenuAssignment,resolveMenuCategoryPayload} from '../src/services/catalogTaxonomyResolver.ts';

const reviewCodes=[
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
 'FAM-35743',
 'FAM-33996',
 'FAM-32247',
 'FAM-32246',
 'FAM-80151',
 'FAM-31929',
 'FAM-33416',
 'FAM-33126',
 'FAM-321931',
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
 'FAM-38906'
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

test('the current family map has 1,357 retained rows and exposes incomplete assignments for review',()=>{
 assert.equal(Object.keys(CATALOG_FAMILY_MENU_ASSIGNMENTS).length,1357);
 assert.equal(Object.values(CATALOG_FAMILY_MENU_ASSIGNMENTS).filter(item=>!item.submenuName).length,55);
 assert.equal(Object.values(CATALOG_FAMILY_MENU_ASSIGNMENTS).filter(item=>!item.leafName).length,278);
});

test('21 approved menu leaves have no explicit family leaf mapping after this audit',()=>{
 const leaves=APPROVED_MENU_CATEGORIES.flatMap(category=>(category.children||[]).flatMap(submenu=>
  (submenu.children||[]).map(leaf=>({categorySlug:category.slug,submenuName:submenu.name,leafName:leaf.name}))
 ));
 const empty=leaves.filter(leaf=>!Object.values(CATALOG_FAMILY_MENU_ASSIGNMENTS).some(item=>
  item.categorySlug===leaf.categorySlug&&item.submenuName===leaf.submenuName&&item.leafName===leaf.leafName
 ));
 assert.equal(empty.length,22);
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
];
 for(const familyCode of falsePolyurethaneFamilies){
  assert.equal(CATALOG_FAMILY_MENU_ASSIGNMENTS[familyCode],undefined);
 }
 assert.equal(Object.values(CATALOG_FAMILY_MENU_ASSIGNMENTS).filter(
  assignment=>assignment.categorySlug==='excel-v2-1-1'
   &&assignment.submenuName==='سیم‌دار فابریک'
   &&assignment.leafName==='پلی‌یورتان'
 ).length,0);
});

test('mixed-material families remain at parent level until SKU-level overrides are available',()=>{
 assert.deepEqual(CATALOG_FAMILY_MENU_ASSIGNMENTS['FAM-52858'],{
  categorySlug:'excel-v2-2-1',submenuName:'بر اساس جنس',leafName:null
 });
 assert.deepEqual(CATALOG_FAMILY_MENU_ASSIGNMENTS['FAM-33117'],{
  categorySlug:'excel-v2-6-1',submenuName:'بر اساس جنس',leafName:null
 });
});
