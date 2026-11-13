import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const read=(file:string)=>readFileSync(file,'utf8');

test('storefront & company images are served locally from public/images as lightweight WebP with zero CDN URLs',()=>{
 const assets=read('src/assets/images/index.ts');
 const clients=read('src/assets/moshtariAssets.ts');
 const optim=read('scripts/optimize-images.mjs');
 const imports=assets.split('\n').filter(line=>line.startsWith('import '));
 assert.equal(imports.length, 0);
 assert.equal(clients.split('\n').filter(line=>line.startsWith('import ')).length, 0);
 assert.ok(optim.includes('public/images/'));

 const imagePaths=[
  ...(assets.match(/\/images\/[a-zA-Z0-9/_-]+\.webp/g)||[]),
  ...(clients.match(/\/images\/[a-zA-Z0-9/_-]+\.webp/g)||[]),
 ];
 assert.ok(imagePaths.length >= 90);
 for(const rel of new Set(imagePaths)){
  const full=join(process.cwd(),'public',rel.replace(/^\//,''));
  assert.ok(existsSync(full),`missing optimized asset in public: ${full}`);
  assert.ok(statSync(full).size < 350*1024,`asset too heavy (>350KB): ${rel}`);
 }

 for(const file of [
  'src/services/adminService.ts',
  'src/components/agency/AgencyForm.tsx',
  'src/components/dealer/DepositReceiptModal.tsx',
  'src/pages/ServicesPage.tsx',
  'src/pages/DiscoveryPages.tsx',
  'src/pages/ContactUsPage.tsx',
  'src/pages/BeltCategoryExperience.tsx',
  'src/pages/CategoryPage.tsx',
  'src/pages/ConsumerDashboardPage.tsx',
 ]){
  const src=read(file);
  assert.ok(!src.includes('images.unsplash.com'),`Unsplash CDN reference found in ${file}`);
  assert.ok(!/import\s+.+assets\/.*\.(png|jpg|jpeg|webp)['"]/.test(src),`Heavy raw image ES import found in ${file}`);
 }
});

test('desktop hero remains image-prioritized and mobile hero is a large four-slide image carousel with embedded copy and two CTAs',()=>{
 const hero=read('src/pages/HomePage.tsx');
 assert.ok(!hero.includes('backgroundImage: `url(${slide.image})`'));
 assert.equal(hero.split('src={isActive ? slide.image : undefined}').length-1,1);
 assert.ok(hero.includes('const mobileHeroSlides = ['));
 assert.ok(hero.includes('STORE_ASSETS.heroPulley'));
 assert.ok(hero.includes('STORE_ASSETS.heroSteelCoils'));
 assert.ok(hero.includes('STORE_ASSETS.whySanatExpressDelivery'));
 assert.ok(hero.includes('STORE_ASSETS.whySanatCadEngineering'));
 assert.ok(hero.includes('setMobileHeroSlideIndex'));
 assert.ok(hero.includes('mobile-home-hero'));
 assert.ok(hero.includes('aria-label="بنرهای اسلایدی صفحه اصلی"'));
 assert.ok(hero.includes('توقف خط تولید، هرگز!'));
 assert.ok(hero.includes('ارسال فوری در کمتر از ۲۴ ساعت'));
 assert.ok(hero.includes('پیگیری سفارش'));
 assert.ok(hero.includes('ساخت قطعات کمیاب'));
 assert.ok(hero.includes('شناسایی قطعه با هوش مصنوعی'));
 assert.ok(hero.includes('تماس با واحد فروش فوری'));
 assert.equal((hero.match(/className="mobile-hero-action /g)||[]).length,2);
 assert.ok(!hero.includes('sanatpish-mobile-hero.webp'));
 assert.ok(hero.includes('loading="eager"'));
 assert.ok(hero.includes('fetchPriority={isActive ? "high" : "low"}'));
});

test('category marketing artwork bypasses catalog-only product URL resolver',()=>{
 const source=read('src/components/storefront/HomeSequence.tsx');
 assert.match(source,/const image\s*=\s*group\.imageUrl \|\| resolveExcelCategoryArtwork\(/);
 assert.ok(source.includes('group.categorySlugs.map(slug=>categoryBySlug.get(slug)?.image)'));
 assert.ok(source.includes('src={image}'));
 assert.ok(!source.includes('A.categories.transmission}'));
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
