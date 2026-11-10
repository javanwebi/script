import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Product } from '../src/types';
import { rankIndustryProducts } from '../src/utils/industryCatalog';

const page = readFileSync(new URL('../src/pages/DiscoveryPages.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/storefront.css', import.meta.url), 'utf8');

test('non-ceramic industries have distinct editorial compositions', () => {
  for (const slug of ['textile', 'packaging', 'food', 'machinery', 'rubber']) {
    assert.ok(page.includes(`industry.slug === '${slug}'`), `missing ${slug} layout component`);
    assert.ok(css.includes(`.industry-visual-module--${slug}`), `missing ${slug} visual system`);
    assert.ok(css.includes(`.industry-${slug} .industry-hero`), `missing ${slug} hero treatment`);
  }
  assert.match(page, /industry-hero--\$\{industry\.slug\}/);
  assert.match(css, /@media \(max-width: 767px\)/);
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
