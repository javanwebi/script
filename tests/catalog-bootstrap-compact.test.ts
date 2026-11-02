import { test } from 'node:test';
import assert from 'node:assert/strict';
import {compactCatalogReviews,publicCatalog} from '../src/utils/catalogPrivacy';

test('initial catalogue omits heavy reports without losing SKU identity, images or specs',()=>{
 const products=[{
  code:'F-100',name:'قطعه نمونه',images:['/storage/products/thumbs/a.webp'],
  variants:[
   {code:'SKU-1',name:'قطعه اول',technicalSpecs:[{key:'طول',value:'1250 mm'}],technicalReview:{categoryPath:['تسمه'],note:'long detail'},prices:{retail:200}},
   {code:'SKU-2',name:'قطعه دوم',technicalSpecs:[{key:'قطر',value:'20 mm'}],technicalReview:{categoryPath:['پولی'],note:'report'},prices:{retail:300}},
  ],
 }];
 const original=JSON.stringify(products);
 const compact=compactCatalogReviews(publicCatalog(products));
 assert.deepEqual(compact[0].variants.map(v=>v.code),['SKU-1','SKU-2']);
 assert.deepEqual(compact[0].images,products[0].images);
 assert.deepEqual(compact[0].variants[0].technicalSpecs,products[0].variants[0].technicalSpecs);
 assert.equal('technicalReview' in compact[0].variants[0],false);
 assert.equal('technicalReview' in compact[0].variants[1],false);
 assert.equal('prices' in compact[0].variants[0],false);
 assert.equal(JSON.stringify(products),original,'do not mutate authoritative source');
});

test('catalog compaction does not drop ordinary metadata or alter empty input',()=>{
 assert.deepEqual(compactCatalogReviews([]),[]);
 const products=[{code:'F-1',variants:[{code:'SKU-9',size:'SPA 1250',technicalSpecs:[],technicalReview:{note:'long'}}],categorySlug:'belts'}];
 const [result]=compactCatalogReviews(products);
 assert.equal(result.categorySlug,'belts');
 assert.equal(result.variants[0].size,'SPA 1250');
 assert.equal('technicalReview' in result.variants[0],false);
});
