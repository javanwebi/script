import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('HomeAboutSection removes the 3 mini feature divs, keeps orbital image on right and summary copy on left', () => {
  const overview = read('src/components/storefront/HomeOverview.tsx');
  const companyCss = read('src/company-pages.css');

  const sectionStart = overview.indexOf('export function HomeAboutSection()');
  const sectionEnd = overview.indexOf('export function WhySanatPish');
  const homeAboutCode = overview.slice(sectionStart, sectionEnd);

  assert.doesNotMatch(homeAboutCode, /home-about-preview__highlights/);
  assert.doesNotMatch(homeAboutCode, /whySanatDirectFactory/);
  assert.match(homeAboutCode, /levitatingOrbitalEngine/);
  assert.match(homeAboutCode, /orbitalParts\.map/);
  assert.match(homeAboutCode, /to="\/about"/);
  assert.match(homeAboutCode, /با پشتوانه بازرگانی تسمه اطلس از سال ۱۳۶۶/);

  assert.match(companyCss, /\.home-about-preview\s*\{[\s\S]*?direction:\s*rtl;/);
  assert.match(companyCss, /\.home-about-preview__visual\s*\{[\s\S]*?grid-column:\s*1;/);
  assert.match(companyCss, /\.home-about-preview__copy\s*\{[\s\S]*?grid-column:\s*2;/);
});

test('AboutPage uses the supplied responsive template, accurate Atlas history, live catalogue metrics and real navigation', () => {
  const discovery = read('src/pages/DiscoveryPages.tsx');
  const about = read('src/pages/AboutPageTemplate.tsx');
  const main = read('src/main.tsx');

  assert.match(main, /company-pages-premium\\.css/);
  assert.match(discovery, /import AboutPageTemplate/);
  assert.match(discovery, /return <AboutPageTemplate \\/>/);
  assert.match(about, /با پشتوانه تجربه بازرگانی تسمه اطلس/);
  assert.match(about, /۱۳۶۶/);
  assert.doesNotMatch(about, /۱۳۸۴/);
  assert.match(about, /SERVICE_ITEMS/);
  assert.match(about, /شناسایی هوشمند قطعه با FORZA/);
  assert.match(about, /بررسی مهندسی معکوس و ساخت/);
  assert.match(about, /getManagedBrands\\(\\)/);
  assert.match(about, /getManagedCategories\\(\\)/);
  assert.match(about, /getAllProducts\\(\\)/);
  assert.match(about, /subscribeCatalogChanges\\(refreshStats\\)/);
  assert.match(about, /INDUSTRIES\\.map/);
  assert.match(about, /to="\\/contact"/);
  assert.match(about, /to="\\/services"/);
  assert.match(about, /to="\\/products"/);
  assert.doesNotMatch(about, /ABOUT_BRANCHES|navigator\\.clipboard|InquiryModal|submittedRef/);
});
test('ServicesPage, IndustriesPage, BrandsPage, KnowledgePage, ContactUsPage, and AboutNavigation implement upgraded UX', () => {
  const discovery = read('src/pages/DiscoveryPages.tsx');
  const services = read('src/pages/ServicesPage.tsx');
  const contact = read('src/pages/ContactUsPage.tsx');

  assert.match(services, /type CapabilityGroup/);
  assert.match(services, /serviceTabs\.map/);
  assert.match(services, /aria-pressed=\{activeGroup === tab\.id\}/);
  assert.match(services, /sp-service-inputs/);

  assert.match(discovery, /about-navigation-link-label/);
  assert.match(discovery, /sp-knowledge-hero/);
  assert.match(discovery, /sp-knowledge-grid/);
  assert.match(discovery, /sp-knowledge-article-hero/);
  assert.match(discovery, /جستجوی صنایع/);

  assert.match(contact, /event\.key === 'Escape'/);
  assert.doesNotMatch(contact, /animate-pulse/);
  assert.equal((contact.match(/<h1[\s>]/g) ?? []).length, 1);

  const assets = read('src/assets/images/index.ts');
  const bottomNavRoutes = read('src/components/layout/storefrontBottomNavVisibility.ts');
  const storefrontCss = read('src/storefront.css');

  assert.match(assets, /companyPages:\s*\{/);
  for (const route of ['/about', '/services', '/industries', '/brands', '/knowledge', '/contact']) {
    assert.ok(bottomNavRoutes.includes(`"${route}"`), `${route} must show bottom dock and FORZA launcher`);
  }
  assert.match(storefrontCss, /spAccountSheetSlideUp/);
  assert.match(storefrontCss, /transform:\s*translateY\(100%\)/);
});
