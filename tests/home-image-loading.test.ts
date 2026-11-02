import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const read=(file:string)=>readFileSync(file,'utf8');

test('marketing photography imports generated lightweight WebP, not full JPG',()=>{
 const assets=read('src/assets/images/index.ts');
 const optim=read('scripts/optimize-images.mjs');
 assert.doesNotMatch(assets,/^import .+ from '\\.\\/[^']+\\.jpe?g';/gm);
 assert.match(assets,/brands_fullbleed_bg_1791282424638\\.webp/);
 assert.match(assets,/parts_warehouse_vault_1791289671081\\.webp/);
 assert.match(assets,/IMAGESITE\\/mobile\\/Futuristic FORZA AI Robot Halo\\.webp/);
 assert.match(optim,/src\\/assets\\/IMAGESITE/);
 assert.match(optim,/only\\.includes\\(e\\.name\\)/);
});

test('first hero has high priority and inactive slides have no image request',()=>{
 const hero=read('src/pages/HomePage.tsx');
 assert.match(hero,/backgroundImage: isActive \\? `url\\(\\$\\{slide\\.image\\}\\)` : undefined/);
 assert.match(hero,/src=\\{isActive \\? slide\\.image : undefined\\}/);
 assert.match(hero,/fetchPriority=\\{isActive \\? "high" : "low"\\}/);
});

test('home category art bypasses catalog-only image URL resolver',()=>{
 const source=read('src/components/storefront/HomeSequence.tsx');
 assert.match(source,/<img[\\s\\S]*?src=\\{categoryArtwork\\[c\\.name\\]/);
 assert.doesNotMatch(source,/<ProductImage[\\s\\S]*?src=\\{categoryArtwork\\[c\\.name\\]/);
});

test('offscreen sections and product images avoid full-resolution downloads',()=>{
 for (const file of [
  'src/components/home/MainBrandsBanner.tsx',
  'src/components/storefront/HomeDiscovery.tsx',
  'src/components/storefront/HomeOverview.tsx',
  'src/components/layout/Footer.tsx'
 ]){
  const text=read(file);
  const images=text.match(/<img\\b[\\s\\S]*?\\/>/g)??[];
  assert.ok(images.length>0,file);
  for(const img of images){
   assert.match(img,/loading="lazy"/,file);
   assert.match(img,/decoding="async"/,file);
   assert.match(img,/fetchPriority="low"/,file);
  }
 }
 for (const file of [
  'src/components/home/HighUtilityProductsSection.tsx',
  'src/components/product/ProductCard.tsx',
  'src/components/portal/PortalProductCard.tsx'
 ]){
  const text=read(file);
  assert.match(text,/thumbnail/,file);
 }
});

test('fingerprinted assets are immutable but HTML is revalidated',()=>{
 const server=read('server.ts');
 assert.match(server,/max-age=31536000, immutable/);
 assert.match(server,/res\\.setHeader\\('Cache-Control', 'no-cache'\\)/);
});
