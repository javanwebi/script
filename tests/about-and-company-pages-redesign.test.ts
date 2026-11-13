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

test('AboutPage integrates services strip, brands & industries ecosystem, and Yazd/Meybod/Tehran contact hub', () => {
  const discovery = read('src/pages/DiscoveryPages.tsx');
  const main = read('src/main.tsx');

  assert.match(main, /company-pages-premium\.css/);
  assert.match(discovery, /sp-about-services-strip/);
  assert.match(discovery, /sp-about-ecosystem/);
  assert.match(discovery, /sp-about-brands-row/);
  assert.match(discovery, /sp-about-industries-row/);
  assert.match(discovery, /sp-about-contact-hub/);
  assert.match(discovery, /ABOUT_BRANCHES/);
  assert.match(discovery, /id:\s*"yazd"/);
  assert.match(discovery, /id:\s*"meybod"/);
  assert.match(discovery, /id:\s*"tehran"/);
  assert.match(discovery, /handleCopyBranchAddress/);
  assert.match(discovery, /فعال کردن نقشه تعاملی/);
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
