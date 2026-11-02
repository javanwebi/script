import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const read=(file:string)=>readFileSync(file,'utf8');

test('marketing photograph imports use generated WebP derivatives',()=>{
 const assets=read('src/assets/images/index.ts');
 const optim=read('scripts/optimize-images.mjs');
 const imports=assets.split('\n').filter(line=>line.startsWith('import '));
 assert.equal(imports.filter(line=>line.endsWith(".jpg';")).length,0);
 assert.ok(assets.includes('brands_fullbleed_bg_1791282424638.webp'));
 assert.ok(assets.includes('parts_warehouse_vault_1791289671081.webp'));
 assert.ok(assets.includes('IMAGESITE/mobile/Futuristic FORZA AI Robot Halo.webp'));
 assert.ok(optim.includes('src/assets/IMAGESITE'));
 assert.ok(optim.includes('only.includes(e.name)'));
});

test('hero requests visible slide only, with high priority on mobile',()=>{
 const hero=read('src/pages/HomePage.tsx');
 assert.ok(!hero.includes('backgroundImage: `url(${slide.image})`'));
 assert.equal(hero.split('src={isActive ? slide.image : undefined}').length-1,2);
 assert.ok(hero.includes('fetchPriority={isActive ? "high" : "low"}'));
});

test('category marketing artwork bypasses catalog-only product URL resolver',()=>{
 const source=read('src/components/storefront/HomeSequence.tsx');
 assert.ok(source.includes('src={categoryArtwork[c.name] || c.image || A.categories.transmission}'));
 assert.ok(!source.includes('src={categoryArtwork[c.name] || c.image}'));
});

test('offscreen images are lazy, low-priority and decoded asynchronously',()=>{
 for(const file of [
  'src/components/home/MainBrandsBanner.tsx',
  'src/components/storefront/HomeDiscovery.tsx',
  'src/components/storefront/HomeOverview.tsx',
  'src/components/layout/Footer.tsx'
 ]){
  const source=read(file);
  const tags=source.split('<img').slice(1).map(part=>part.split('/>')[0]);
  assert.ok(tags.length>0,file);
  for(const tag of tags){
   assert.ok(tag.includes('loading="lazy"'),file);
   assert.ok(tag.includes('decoding="async"'),file);
   assert.ok(tag.includes('fetchPriority="low"'),file);
  }
 }
 for(const file of [
  'src/components/home/HighUtilityProductsSection.tsx',
  'src/components/product/ProductCard.tsx',
  'src/components/portal/PortalProductCard.tsx'
 ]){
  assert.ok(read(file).includes('thumbnail'),file);
 }
});

test('versioned assets can be cached immutably, HTML is revalidated',()=>{
 const server=read('server.ts');
 assert.ok(server.includes('max-age=31536000, immutable'));
 assert.ok(server.includes("res.setHeader('Cache-Control', 'no-cache')"));
});
