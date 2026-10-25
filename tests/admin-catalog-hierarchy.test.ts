import test from 'node:test';
import assert from 'node:assert/strict';
import type {Product} from '../src/types';
import {catalogHierarchyOptions,catalogFamilyCount,matchesFamilyHierarchy} from '../src/admin/catalogFamilyFilters';
import {normalizeManagedCategory} from '../src/data/categories';
const families=[
 {code:'FAM-32893',name:'اورینگ لاستیکی',categoryName:'آب‌بندی و درزگیری',categorySlug:'آب-بندی-و-درزگیری',submenu:'اورینگ',subcategory:'اورینگ لاستیکی'},
 {code:'FAM-123',name:'واشر لاستیکی',categoryName:'آب‌بندی و درزگیری',categorySlug:'آب-بندی-و-درزگیری',submenu:'واشر',subcategory:'واشر تخت'},
 {code:'FAM-456',name:'پولی',categoryName:'پولی و انتقال نیرو',categorySlug:'پولی-و-انتقال-نیرو',submenu:'پولی',subcategory:'پولی صنعتی'},
] as Product[];
test('all family codes remain reachable through category hierarchy',()=>{
 for(const p of families){
  const filter={category:p.categoryName,submenu:p.submenu||'all',subcategory:p.subcategory||'all'};
  assert.ok(matchesFamilyHierarchy(p,filter),p.code);
  assert.ok(families.filter(item=>matchesFamilyHierarchy(item,filter)).some(item=>item.code===p.code));
 }
});
test('o-ring appears under the correct category, submenu and subcategory',()=>{
 const a=catalogHierarchyOptions(families,{category:'آب‌بندی و درزگیری',submenu:'all',subcategory:'all'});
 assert.ok(a.submenus.includes('اورینگ'));
 const b=catalogHierarchyOptions(families,{category:'آب‌بندی و درزگیری',submenu:'اورینگ',subcategory:'all'});
 assert.deepEqual(b.subcategories,['اورینگ لاستیکی']);
 assert.equal(families.filter(p=>matchesFamilyHierarchy(p,{category:'آب‌بندی و درزگیری',submenu:'اورینگ',subcategory:'اورینگ لاستیکی'})).length,1);
 assert.equal(catalogFamilyCount(families,'آب‌بندی و درزگیری'),2);
});
test('normalization handles Arabic and Persian forms and ZWNJ',()=>{
 assert.ok(matchesFamilyHierarchy(families[0],{category:'آب بندی و درزگيري',submenu:'اورينگ',subcategory:'اورینگ لاستیکی'}));
});

test('sparse database category metadata gets safe display defaults and preserves exact counts',()=>{
 const category=normalizeManagedCategory({
  id:' آب‌بندی و درزگیری ',
  slug:'آب-بندی-و-درزگیری',
  name:'آب‌بندی و درزگیری',
  count:'17',
  skuCount:'90',
  children:[{name:'اورینگ',children:[{name:'اورینگ لاستیکی'}]}],
 });
 assert.equal(category.nameEn,'');
 assert.equal(category.description,'اورینگ');
 assert.equal(category.icon,'Package');
 assert.equal(category.familyCount,17);
 assert.equal(category.count,17);
 assert.equal(category.skuCount,90);
 assert.equal(category.children.length,1);
 assert.equal(category.children[0].children?.[0].name,'اورینگ لاستیکی');
});
