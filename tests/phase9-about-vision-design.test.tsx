import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {getCatalogDisplayImageCandidates, CatalogResultImage} from '../src/components/search/CatalogResultImage';

const read = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('homepage About preview leads to the routed approved company page', () => {
  const home = read('src/pages/HomePage.tsx');
  const overview = read('src/components/storefront/HomeOverview.tsx');
  const app = read('src/App.tsx');
  const layout = read('src/components/layout/Layout.tsx');
  const about = read('src/pages/AboutPage.tsx');
  const main = read('src/main.tsx');
  const aboutCss = read('src/pages/about-page-approved.css');

  assert.match(home, /HomeAboutSection/);
  assert.match(home, /<WhySanatPish \/>/);
  assert.match(overview, /با پشتوانه بازرگانی تسمه اطلس/);
  assert.match(overview, /to="\/about"/);
  assert.match(app, /path="\/about" element={<AboutPage \/>}/);
  assert.match(app, /import\("\.\/pages\/AboutPage"\)/);
  assert.match(layout, /isAboutEditorialPage/);
  assert.match(about, /sp-about-page/);
  assert.match(about, /بازار تخصصی/);
  assert.match(about, /با پشتوانه بازرگانی تسمه اطلس/);
  for (const path of ['/services', '/industries', '/brands', '/knowledge', '/contact']) {
    assert.ok(about.includes(`to: "${path}"`), `missing About destination ${path}`);
  }
  assert.match(about, /sp-about-timeline__label/);
  assert.match(about, /sp-about-capability/);
  assert.match(about, /sp-about-destination/);
  assert.match(main, /pages\/about-page-approved\.css/);
  assert.match(aboutCss, /\.sp-about-page/);
  assert.match(aboutCss, /max-width: 760px/);
  assert.match(aboutCss, /prefers-reduced-motion/);
  assert.match(aboutCss, /focus-visible/);
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
