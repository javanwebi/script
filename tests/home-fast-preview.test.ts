import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectHomePreviewProducts} from '../src/utils/homeCatalogPreview';

test('public home teaser strips every commercial field and bulky variants',()=>{
 const family={code:'AT-E010',name:'قطعه نمونه',brand:'FORZA',categorySlug:'transmission',
  categoryName:'تسمه و انتقال نیرو',images:['/storage/products/a.webp','/storage/products/b.webp'],
  price:250000,stock:42,active:true,variants:[{code:'PRIVATE-SKU',price:1000}]};
 const input=Array.from({length:13},(_,i)=>({...family,code:'AT-E'+String(10+i).padStart(3,'0')}));
 const previews=selectHomePreviewProducts(input);
 assert.equal(previews.length,12);
 const encoded=JSON.stringify(previews);
 for(const key of ['price','stock','variants','PRIVATE-SKU','technicalReview'])
  assert.ok(!encoded.includes(key),key);
 assert.equal(previews[0].images.length,1);
 assert.equal(previews[0].name,'قطعه نمونه');
});

test('large catalogue keeps the existing 12–24 featured fallback window',()=>{
 const input=Array.from({length:30},(_,i)=>({code:'SKU-'+i,name:'Product '+i,
  brand:'brand',categorySlug:'cat',categoryName:'Category',images:[],active:true}));
 const previews=selectHomePreviewProducts(input);
 assert.equal(previews.length,12);
 assert.equal(previews[0].code,'SKU-12');
 assert.equal(previews.at(-1)?.code,'SKU-23');
});

test('never reveal inactive families or oversized data URLs',()=>{
 const input=Array.from({length:15},(_,i)=>({code:'X'+i,name:'n',brand:'b',
  categorySlug:'c',categoryName:'C',images:['data:image/png;base64,'+'A'.repeat(6000)],active:i!==13}));
 const result=selectHomePreviewProducts(input);
 assert.ok(result.every(p=>p.code!=='X13'));
 assert.ok(result.every(p=>p.images.length===0));
});

test('first paint reads lightweight APIs before full SKU hydration',()=>{
 const home=readFileSync('src/components/storefront/HomeSequence.tsx','utf8');
 const featured=readFileSync('src/components/home/HighUtilityProductsSection.tsx','utf8');
 const server=readFileSync('server.ts','utf8');
 assert.match(home,/fetch\('\/api\/catalog\/categories'/);
 assert.match(featured,/fetch\('\/api\/catalog\/home-preview'/);
 assert.match(featured,/utilityProducts\.length===0 && previews\.map/);
 assert.match(server,/app\.get\('\/api\/catalog\/home-preview',publicHomePreviewApi\)/);
});
