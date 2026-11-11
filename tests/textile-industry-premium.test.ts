import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (file: string) => readFileSync(file, 'utf8');
const page = source('src/pages/TextileIndustryPage.tsx');
const styles = source('src/textile-industry.css');
const routes = source('src/App.tsx');

test('textile industry remains on its dedicated route and uses the shared layout landmark', () => {
  assert.match(routes, /path="\/industries\/textile"/);
  assert.match(page, /<div className="textile-page" dir="rtl">/);
  assert.doesNotMatch(page, /<main className="textile-page"/);
});

test('textile hero places the real industrial image before the content column in RTL order', () => {
  assert.match(page, /className="textile-hero-visual"/);
  assert.match(page, /src=\{A\.industries\.textile\}/);
  assert.match(page, /alt="ماشین‌آلات و خط تولید صنعت نساجی"/);
  assert.ok(page.indexOf('className="textile-hero-visual"') < page.indexOf('className="textile-hero-copy"'));
  assert.match(styles, /grid-template-columns: minmax\(0, \.95fr\) minmax\(0, 1\.05fr\)/);
});

test('the former hero accent block is removed and the image has a dedicated caption', () => {
  assert.match(page, /textile-hero-visual-caption/);
  assert.match(styles, /\.textile-hero::after\s*\{\s*display:\s*none !important;/);
  assert.match(styles, /\.textile-hero-visual/);
});

test('textile recommendations come only from ranked real catalogue products', () => {
  assert.match(page, /rankIndustryProducts\(getAllProducts\(\), industry, 6\)/);
  assert.match(page, /products\.map\(\(product\) => <ProductCard/);
  assert.match(page, /در حال حاضر خانواده تأییدشده‌ای برای پیشنهاد مستقیم پیدا نشد/);
  assert.doesNotMatch(page, /mockProduct|placeholderProduct|fakeProduct/i);
});

test('production stages, product search, FORZA and canonical image identification remain connected', () => {
  assert.match(page, /aria-pressed=\{selected\}/);
  assert.match(page, /aria-controls="textile-stage-panel"/);
  assert.match(page, /activeStage\.search/);
  assert.match(page, /to="\/ai-consult\?industry=textile"/);
  assert.match(page, /to="\/identify-part"/);
  assert.doesNotMatch(page, /to="\/part-identification"/);
});

test('textile copy avoids unsupported guarantees and keeps the technical value proposition', () => {
  assert.match(page, /پشتوانه بازرگانی اطلس/);
  assert.match(page, /مهندسی معکوس قطعات کمیاب/);
  assert.doesNotMatch(page, /تضمین کیفیت صنعتی|مشاوره تخصصی رایگان/);
});

test('textile hero and full page have dedicated tablet, mobile, narrow-phone and reduced-motion rules', () => {
  assert.match(styles, /@media \(max-width: 1100px\) and \(min-width: 761px\)/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /@media \(max-width: 380px\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /\.textile-hero-visual:hover \.textile-hero-image/);
});

test('textile hero styles stay scoped to the textile page', () => {
  assert.match(styles, /\.textile-page/);
  assert.doesNotMatch(styles, /(^|\n)body\s*\{/);
});
