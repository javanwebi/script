import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Product } from '../src/types';
import { rankIndustryProducts } from '../src/utils/industryCatalog';

const page = readFileSync(new URL('../src/pages/DiscoveryPages.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/industry-art-direction.css', import.meta.url), 'utf8');

test('non-ceramic industries have distinct editorial compositions', () => {
  for (const slug of ['textile', 'packaging', 'food', 'machinery', 'rubber']) {
    assert.ok(page.includes(`${slug}: {`), `missing ${slug} page-specific visual brief`);
    assert.ok(css.includes(`.industry-showcase--${slug}`), `missing ${slug} showcase treatment`);
    assert.ok(css.includes(`.industry-page.industry-${slug} .industry-hero`), `missing ${slug} hero treatment`);
  }
  assert.match(page, /industry-hero--\$\{industry\.slug\}/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/);
  assert.match(css, /industry-directory-card:nth-child\(1\)/);
});

test('ceramic retains its dedicated page instead of falling back to the generic industry template', () => {
  assert.match(page, /TileCeramicIndustryPage/);
  assert.match(page, /slug === "ceramic"/);
  const ceramic = readFileSync(new URL('../src/pages/TileCeramicIndustryPage.tsx', import.meta.url), 'utf8');
  assert.match(ceramic, /ceramic-hero-visual/);
  assert.match(ceramic, /ceramic-hero-image/);
  assert.match(ceramic, /ceramic-hero-content/);
  assert.match(ceramic, /rankIndustryProducts/);
  assert.match(ceramic, /<ProductCard/);
  assert.doesNotMatch(ceramic, /FAM-35245|FAM-80274|FAM-41680|FAM-BELT-TIM/);
});

function catalogProduct(code: string, name: string, overrides: Partial<Product> = {}): Product {
  return {
    code,
    name,
    brand: 'TEST',
    categorySlug: 'industrial-parts',
    categoryName: 'قطعات صنعتی',
    subcategory: 'قطعات انتقال',
    technicalSpecs: [],
    prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
    stock: 0,
    inquiryOnly: true,
    images: [],
    tags: [],
    unit: 'عدد',
    ...overrides,
  };
}

test('industry recommendations use active catalogue products and never placeholders', () => {
  const ceramic = { slug: 'ceramic', title: 'کاشی و سرامیک', terms: ['تسمه', 'چرخ', 'مکنده', 'نسوز'] };
  const relevant = catalogProduct('FAM-REAL-1', 'چرخ صنعتی پلی‌یورتان');
  const inactive = catalogProduct('FAM-OLD-2', 'تسمه صنعتی', { active: false });
  const unrelated = catalogProduct('FAM-REAL-3', 'دستکش ایمنی');
  const ranked = rankIndustryProducts([unrelated, inactive, relevant], ceramic, 6);
  assert.deepEqual(ranked.map(product => product.code), ['FAM-REAL-1']);
});

test('industry recommendations can match technical taxonomy and specifications', () => {
  const textile = { slug: 'textile', title: 'نساجی و پارچه', terms: ['گاید', 'ریل'] };
  const product = catalogProduct('FAM-TEXTILE', 'قطعه هدایت پارچه', {
    categoryName: 'گاید و ریل صنعتی',
    technicalSpecs: [{ key: 'کاربرد', value: 'خط نساجی و بافندگی' }],
  });
  const ranked = rankIndustryProducts([product], textile, 6);
  assert.equal(ranked[0]?.code, 'FAM-TEXTILE');
});

test('premium catalogue styling is loaded and scoped to product browsing routes', () => {
  const entry = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const premium = readFileSync(new URL('../src/catalogue-premium.css', import.meta.url), 'utf8');
  assert.match(entry, /@import "\.\/catalogue-premium\.css";/);
  for (const selector of [
    '.catalogue-page .catalogue-intro',
    '.catalogue-page .store-product-grid',
    '.catalogue-page .store-product-card',
    '.product-detail-page .product-detail-layout',
    '.product-detail-page .product-detail-specs',
  ]) {
    assert.ok(premium.includes(selector), `missing premium selector: ${selector}`);
  }
  assert.match(premium, /@media \(max-width: 600px\)/);
  assert.match(premium, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(premium, /:has\(> \.catalogue-page\)/);
  assert.match(premium, /:has\(> \.product-detail-page\)/);
});

test('premium industry pages keep split desktop hero and mobile-first station layouts', () => {
  const entry = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const premium = readFileSync(new URL('../src/industry-pages-premium.css', import.meta.url), 'utf8');
  assert.match(entry, /@import "\.\/industry-pages-premium\.css";/);
  for (const selector of [
    '.industry-page .industry-hero',
    '.industry-page .industry-hero > img',
    '.industry-page .industry-fastbar',
    '.industry-page .industry-selector',
    '.industry-page .industry-stations button[aria-pressed="true"]',
    '.industry-page .industry-part-links > a',
    '.industry-page .editorial-products',
    '.industry-directory > a',
  ]) {
    assert.ok(premium.includes(selector), `missing industry design selector: ${selector}`);
  }
  assert.match(premium, /inset: 0 0 0 auto/);
  assert.match(premium, /@media \(max-width: 760px\)/);
  assert.match(premium, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(premium, /@media \(prefers-reduced-motion: reduce\)/);
});

test('ceramic production explorer no longer forces a desktop-width canvas on phones', () => {
  const premium = readFileSync(new URL('../src/industry-pages-premium.css', import.meta.url), 'utf8');
  assert.ok(premium.includes('#ceramic-production-line [class~="min-w-[860px]"]'));
  assert.match(premium, /min-width: 0 !important/);
  assert.ok(premium.includes('#ceramic-production-line [class*="grid-cols-7"]'));
  assert.match(premium, /flex: 0 0 112px/);
  assert.match(premium, /\.ceramic-recommendations/);
});

test('industrial hero copy is isolated into a high-contrast editorial column', () => {
  const page = readFileSync(new URL('../src/pages/DiscoveryPages.tsx', import.meta.url), 'utf8');
  const premium = readFileSync(new URL('../src/industry-art-direction.css', import.meta.url), 'utf8');
  assert.match(page, /className="industry-hero-copy"/);
  assert.match(page, /industry-hero-media-index/);
  assert.match(premium, /\.industry-page \.industry-hero \.industry-hero-copy\s*\{[\s\S]*?left: clamp\(24px, 6\.4vw, 96px\)/);
  assert.match(premium, /width: min\(43%, 610px\)/);
  assert.match(premium, /industry-page\.industry-food \.industry-hero/);
  assert.match(premium, /industry-page\.industry-machinery \.industry-hero::before/);
});

test('industrial directory and industry showcases use image-led, page-specific compositions', () => {
  const page = readFileSync(new URL('../src/pages/DiscoveryPages.tsx', import.meta.url), 'utf8');
  const premium = readFileSync(new URL('../src/industry-art-direction.css', import.meta.url), 'utf8');
  const entry = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(entry, /@import "\.\/industry-art-direction\.css";/);
  assert.match(page, /directory-intro-visual/);
  assert.match(page, /directory-intro-stats/);
  assert.match(page, /industry-showcase-main-art/);
  assert.match(page, /industry-part-link/);
  for (const selector of [
    '.industry-directory-page .industry-directory-card',
    '.industry-showcase-art',
    '.industry-showcase-flow',
    '.industry-part-links > a.industry-part-link > img',
    '.industry-check-band',
    '.industry-related > a::after',
  ]) {
    assert.ok(premium.includes(selector), `missing premium art-direction selector: ${selector}`);
  }
  assert.match(premium, /@media \(prefers-reduced-motion: reduce\)/);
});
