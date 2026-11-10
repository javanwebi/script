import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {getCatalogDisplayImageCandidates, CatalogResultImage} from '../src/components/search/CatalogResultImage';

const read = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('homepage About preview and company navigation lead to the dedicated company pages', () => {
  const home = read('src/pages/HomePage.tsx');
  const overview = read('src/components/storefront/HomeOverview.tsx');
  const discovery = read('src/pages/DiscoveryPages.tsx');
  const app = read('src/App.tsx');
  const legacyAbout = read('src/pages/AboutUsPage.tsx');
  const layout = read('src/components/layout/Layout.tsx');
  assert.match(layout,/isAboutEditorialPage/);
  assert.match(layout,/!isAboutEditorialPage/);
  assert.match(home,/HomeAboutSection/);
  assert.match(home,/<WhySanatPish \/>/);
  assert.match(overview,/export function HomeAboutSection/);
  assert.match(overview,/با پشتوانه بازرگانی تسمه اطلس/);
  assert.match(overview,/to="\/about"/);
  assert.match(discovery,/export function AboutPage/);
  assert.match(discovery,/sp-about-approved/);
  assert.match(discovery,/sp-about-hero/);
  assert.match(discovery,/src=\{A\.partsWarehouseVault\}/);
  assert.match(discovery,/image: A\.whySanatExpressDelivery/);
  assert.match(discovery,/image: A\.reverseEngineeringLab/);
  assert.match(discovery,/بازار تخصصی/);
  assert.match(discovery,/year: "۱۳۸۴"/);
  assert.match(discovery,/year: "۱۳۹۰"/);
  assert.match(discovery,/year: "۱۴۰۱"/);
  assert.match(discovery,/year: "امروز"/);
  assert.match(discovery,/sp-about-timeline-year/);
  assert.match(discovery,/پشتیبانی صنایع/);
  assert.match(discovery,/پاسخگویی سریع/);
  assert.match(discovery,/getManagedCategories\(\)/);
  assert.match(discovery,/subscribeCatalogChanges\(refreshStats\)/);
  assert.match(discovery,/catalogStats\.ready/);
  assert.match(discovery,/aria-live="polite"/);
  const aboutCss = read('src/about-page-approved.css');
  assert.match(aboutCss,/grid-column:\s*1\s*\/\s*-1/);
  const storyMarkup = discovery.slice(discovery.indexOf('<section className="sp-about-story"'), discovery.indexOf('<section className="sp-about-capabilities">'));
  assert.match(storyMarkup,/sp-about-story-copy[\s\S]*?<\/div>\s*<div className="sp-about-timeline"/);
  const main = read('src/main.tsx');
  assert.match(main,/about-page-approved\.css/);
  assert.match(aboutCss,/max-width: 760px/);
  assert.match(aboutCss,/sp-about-timeline-year/);
  assert.match(aboutCss,/prefers-reduced-motion/);
  assert.match(aboutCss,/focus-visible/);
  assert.match(discovery,/با پشتوانه بازرگانی تسمه اطلس/);
  assert.match(discovery,/to: "\/services"/);
  assert.match(discovery,/to: "\/industries"/);
  assert.match(discovery,/to: "\/brands"/);
  assert.match(discovery,/to: "\/knowledge"/);
  assert.match(discovery,/to: "\/contact"/);
  assert.match(discovery,/export function AboutNavigation/);
  assert.match(app,/path="\/about" element={<AboutPage \/>}/);
  assert.match(app,/path="\/services" element={<ServicesPage \/>}/);
  assert.match(legacyAbout,/<WhySanatPish variant="about" \/>/);
  assert.match(overview,/variant === 'about' \? 'about-why-sanat-pish'/);
  assert.match(overview,/levitatingOrbitalEngine/);
  assert.match(overview,/rightPillars\.map/);
  assert.match(overview,/leftPillars\.map/);
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
