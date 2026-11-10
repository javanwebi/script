import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {getCatalogDisplayImageCandidates, CatalogResultImage} from '../src/components/search/CatalogResultImage';

const read = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('homepage returns to the existing sequence without an added About block', () => {
  const home = read('src/pages/HomePage.tsx');
  const overview = read('src/components/storefront/HomeOverview.tsx');
  const about = read('src/pages/AboutUsPage.tsx');
  assert.doesNotMatch(home,/HomeAboutSection/);
  assert.doesNotMatch(overview,/export function HomeAboutSection/);
  assert.match(home,/<WhySanatPish \/>/);
  assert.match(about,/<WhySanatPish variant="about" \/>/);
  assert.match(overview,/variant === 'about' \? 'about-why-sanat-pish'/);
  assert.match(overview,/levitatingOrbitalEngine/);
  assert.match(overview,/rightPillars\.map/);
  assert.match(overview,/leftPillars\.map/);
  assert.match(about,/درباره صنعت پیش/);
});

test('catalogue preview promotes only verified thumbnails to the real full-size original', () => {
  assert.deepEqual(
    getCatalogDisplayImageCandidates(['/storage/products/thumbs/e(42).webp']),
    ['/storage/products/catalog/e(42).png','/storage/products/thumbs/e(42).webp']
  );
  assert.deepEqual(
    getCatalogDisplayImageCandidates(['e(3).png','/storage/products/catalog/e(3).png', 'https://evil.invalid/x.png']),
    ['/storage/products/catalog/e(3).png']
  );
  assert.deepEqual(getCatalogDisplayImageCandidates(['unknown.jpg','https://example.com/catalog.jpg']),[]);
});

test('image preview is accessible and explicitly distinguishes shared family photos', () => {
  const html = renderToStaticMarkup(<CatalogResultImage
    sources={['/storage/products/catalog/e(3).png']}
    alt="نمونه قطعه"
    familyReference
  />);
  assert.match(html,/بزرگ‌نمایی تصویر نمونه قطعه/);
  assert.match(html,/تصویر مرجع خانواده؛ نه تأیید مدل/);
  assert.match(html,/e\(3\)\.png/);
  assert.match(html,/loading="lazy"/);
});

test('missing image does not claim an unrelated catalog photo', () => {
  const html = renderToStaticMarkup(<CatalogResultImage sources={['https://example.com/fake.webp']} alt="قطعه بدون تصویر" />);
  assert.match(html,/تصویر معتبر در کاتالوگ ثبت نشده/);
  assert.doesNotMatch(html,/<img/);
  assert.doesNotMatch(html,/بزرگ‌نمایی تصویر/);
});

test('both recognition result paths share full-resolution zoomable photography and technical safeguards', () => {
  const wizard = read('src/components/search/AiVisualPartSearchModal.tsx');
  const modelResults = read('src/components/search/LocalModelResults.tsx');
  const css = read('src/components/search/industrial-scan.css');
  assert.match(wizard,/data-testid="vision-journey"/);
  assert.match(wizard,/sp-vision-result-intro/);
  assert.match(wizard,/sp-vision-match-photo/);
  assert.match(wizard,/sources=\{\[match\.image,/);
  assert.match(wizard,/sources=\{\[photo\.image\]\}/);
  assert.match(wizard,/نیازمند تأیید فنی/);
  assert.match(wizard,/حداکثر حجم ۱۰ مگابایت/);
  assert.doesNotMatch(wizard,/resolveMatchImage/);
  assert.match(modelResults,/CatalogResultImage/);
  assert.match(modelResults,/familyReference=\{item\.imageScope === 'family'\}/);
  assert.match(css,/\.sp-catalog-lightbox/);
  assert.match(css,/\.sp-vision-match-grid/);
  assert.match(css,/max-width: 760px/);
});
