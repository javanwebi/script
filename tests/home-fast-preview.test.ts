import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectHomePreviewProducts} from '../src/utils/homeCatalogPreview';

test('public home teaser strips every commercial field and bulky variants',()=>{
 const family={code:'AT-E010',name:'قطعه نمونه',brand:'FORZA',categorySlug:'transmission',
  categoryName:'تسمه و انتقال نیرو',images:['/storage/products/11111111-1111-1111-1111-111111111111.webp','/storage/products/22222222-2222-2222-2222-222222222222.webp'],
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

test('home preview prefers image-linked families while preserving exact family association',()=>{
 const input=Array.from({length:30},(_,i)=>({
  code:'SKU-'+i,name:'Family '+i,brand:'B',categorySlug:'cat',categoryName:'C',
  images:i>=24?['/storage/products/11111111-1111-1111-1111-111111111111.webp']:[],
  active:true,
 }));
 const previews=selectHomePreviewProducts(input);
 assert.equal(previews.length,12);
 assert.ok(previews.some(p=>p.code==='SKU-24'));
 for(const p of previews){
  assert.equal(p.name,'Family '+p.code.split('-')[1]);
  if(p.images.length)assert.match(p.images[0],/^\\/storage\\/products\\//);
 }
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

test('first paint prefetches SQL-light categories and small product previews',()=>{
 const main=readFileSync('src/main.tsx','utf8');
 const boot=readFileSync('src/services/homeFirstPaint.ts','utf8');
 const home=readFileSync('src/components/storefront/HomeSequence.tsx','utf8');
 const featured=readFileSync('src/components/home/HighUtilityProductsSection.tsx','utf8');
 const server=readFileSync('server.ts','utf8');
 const nav=readFileSync('server/catalogNavigationApi.ts','utf8');
 assert.match(main,/prefetchHomeFirstPaint\(\)/);
 assert.match(main,/prefetchHomeFirstPaint\(\)[\s\S]*?await import\('\.\/App\.tsx'\)/);
 assert.match(boot,/\x2fapi\x2fcatalog\x2fhome-categories/);
 assert.match(boot,/\x2fapi\x2fcatalog\x2fhome-preview/);
 assert.match(home,/homeCategories\(\)/);
 assert.match(featured,/homeProducts\(\)/);
 assert.match(home,/queueMicrotask/);
 assert.match(featured,/queueMicrotask/);
 assert.match(nav,/app\.get\('\x2fapi\x2fcatalog\x2fhome-categories'/);
 const quickRoute=nav.slice(nav.indexOf("app.get('/api/catalog/home-categories'"),nav.indexOf('// PostgreSQL is the authoritative source'));
 assert.ok(quickRoute.length>0);
 assert.doesNotMatch(quickRoute,/count\s*\(|join\s+public\.catalog_variants/i);
 assert.match(main,/window\.location\.pathname === '\/'/);
 assert.match(featured,/utilityProducts\.length===0 && previews\.map/);
 assert.match(server,/app\.get\('\x2fapi\x2fcatalog\x2fhome-preview',publicHomePreviewApi\)/);
});
