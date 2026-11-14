import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {getCatalogDisplayImageCandidates, CatalogResultImage} from '../src/components/search/CatalogResultImage';

const read = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('homepage About preview and approved editorial pages preserve company navigation and imagery', () => {
  const home = read('src/pages/HomePage.tsx');
  const overview = read('src/components/storefront/HomeOverview.tsx');
  const discovery = read('src/pages/DiscoveryPages.tsx');
  const about = read('src/pages/AboutPageTemplate.tsx');
  const app = read('src/App.tsx');
  const layout = read('src/components/layout/Layout.tsx');
  const main = read('src/main.tsx');
  const aboutCss = read('src/about-page-approved.css');
  const premiumCss = read('src/company-pages-premium.css');

  assert.match(home,/HomeAboutSection/);
  assert.match(home,/<WhySanatPish \/>/);
  assert.match(layout,/isAboutEditorialPage/);
  assert.match(layout,/!isAboutEditorialPage/);
  assert.match(overview,/export function HomeAboutSection/);
  assert.match(overview,/companyPages\.aboutSanatpishShowroom/);
  assert.match(overview,/to="\/about"/);
  assert.match(overview,/to="\/services"/);
  assert.match(discovery,/export function AboutPage/);
  assert.match(discovery,/import AboutPageTemplate from "\.\/AboutPageTemplate"/);
  assert.match(discovery,/return <AboutPageTemplate \/>/);
  assert.match(about,/A\.companyPages\.aboutHero/);
  assert.match(about,/A\.companyPages\.aboutWarehouse/);
  assert.match(about,/داستان ما؛ از بازرگانی تسمه اطلس تا صنعت پیش/);
  assert.match(about,/۱۳۶۶/);
  assert.doesNotMatch(about,/۱۳۸۴/);
  assert.match(about,/SERVICE_ITEMS/);
  assert.match(about,/INDUSTRIES\.map/);
  assert.match(about,/getManagedBrands\(\)/);
  assert.match(about,/getManagedCategories\(\)/);
  assert.match(about,/getAllProducts\(\)/);
  assert.match(about,/subscribeCatalogChanges\(refreshStats\)/);
  assert.match(about,/stats\.ready/);
  assert.match(about,/aria-live="polite"/);
  assert.match(about,/to="\/contact"/);
  assert.match(about,/to="\/services"/);
  assert.doesNotMatch(about,/InquiryModal|submittedRef|کد پیگیری/);
  for (const destination of ['services','industries','brands','knowledge','contact']) {
    assert.match(discovery,new RegExp('to: "/' + destination + '"'));
  }
  assert.match(discovery,/export function AboutNavigation/);
  assert.match(app,/path="\/about" element={<AboutPage \/>}/);
  assert.match(app,/path="\/services" element={<ServicesPage \/>}/);
  assert.match(main,/about-page-approved\.css/);
  assert.match(main,/company-pages-premium\.css/);
  assert.match(aboutCss,/prefers-reduced-motion/);
  assert.match(premiumCss,/\.sp-about-approved/);
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
  assert.match(wizard,/photos=\{visiblePhotoMatches\}/);
  assert.match(wizard,/نیازمند تأیید فنی/);
  assert.match(wizard,/حداکثر حجم ۱۰ مگابایت/);
  assert.doesNotMatch(wizard,/resolveMatchImage/);
  assert.match(modelResults,/CatalogResultImage/);
  assert.match(modelResults,/familyReference=\{item\.imageScope === 'family'\}/);
  assert.match(css,/\.sp-catalog-lightbox/);
  assert.match(css,/\.sp-vision-match-grid/);
  assert.match(css,/max-width: 760px/);
});
