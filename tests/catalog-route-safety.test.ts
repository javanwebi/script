import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("legacy category routes wait for PostgreSQL hydration and never dereference an empty category fallback", () => {
  const page = read("src/pages/CategoryPage.tsx");
  assert.match(page, /databaseStorageEnabled/);
  assert.match(page, /const category = findCatalogCategory\(slug \|\| ''\)/);
  assert.match(page, /if \(!category\)/);
  assert.match(page, /if \(catalogReady\) return <NotFoundPage \/>/);
  assert.match(page, /LegacyCategoryContent key=\{category\.slug\}/);
  assert.doesNotMatch(page, /findCatalogCategory\(slug \|\| ''\) \|\| CATEGORIES\[0\]/);
});

test("legacy catalog and dealer routes resolve to the intended protected destinations", () => {
  const app = read("src/App.tsx");
  assert.match(app, /path="\/catalog"[\s\S]*Navigate to="\/products"/);
  assert.match(app, /function LegacyDealerRedirect\(\)/);
  assert.match(app, /pathname: "\/account", search: location\.search, hash: location\.hash/);
  assert.match(app, /path="\/dealer\/\*"\s+element=\{<LegacyDealerRedirect \/>\}/);
  assert.match(app, /path="\/account\/\*"\s+element=\{/);
});

test("unknown application routes and invalid catalogue categories render the useful not-found page", () => {
  const app = read("src/App.tsx");
  const category = read("src/pages/CategoryPage.tsx");
  const notFound = read("src/pages/NotFoundPage.tsx");
  assert.match(app, /path="\*" element=\{<NotFoundPage \/>\}/);
  assert.match(category, /if \(catalogReady\) return <NotFoundPage \/>/);
  assert.match(notFound, /to="\/products"/);
  assert.match(notFound, /to="\/categories"/);
});

test("search page does not publish unsupported catalog counts or invented example product codes", () => {
  const search = read("src/pages/SearchPage.tsx");
  assert.match(search, /MAX_SEARCH_RESULTS = 48/);
  assert.match(search, /نتیجه نمایش‌داده‌شده/);
  assert.doesNotMatch(search, /۳۱۸ قطعه|AT-E001|AT-E045|AT-E/);
});

test("central brand tokens use the approved Sanat Pish orange without changing homepage structure", () => {
  const index = read("src/index.css");
  const home = read("src/pages/HomePage.tsx");
  assert.match(index, /--color-brand-primary: #E56B1E/);
  assert.match(index, /--btn-primary: #E56B1E/);
  assert.match(index, /--sp-brand-primary: #E56B1E/);
  assert.match(home, /HomeKnowledge/);
});

test("direct SKU details expose stored technical specifications without inventing prices", () => {
  const page = read("src/pages/DirectSkuDetailPage.tsx");
  assert.match(page, /item\.technicalSpecs\.map/);
  assert.match(page, /مشاوره فنی با FORZA/);
  assert.match(page, /قیمت این کد در این صفحه نمایش داده نمی‌شود/);
  assert.doesNotMatch(page, /formatPrice|mock|نمونه قیمت/);
});

test("catalogue experience styles cover category, detail and narrow-screen layouts", () => {
  const css = read("src/catalog-experience.css");
  assert.match(css, /\.category-showcase \.category-featured-panel/);
  assert.match(css, /\.product-detail-page \.product-detail-layout/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /#E56B1E/);
});


test("category product comparison is interactive and never compares or reveals customer prices", () => {
  const category = read("src/pages/CategoryPage.tsx");
  const card = read("src/components/product/ProductCard.tsx");
  assert.match(category, /comparisonCodes/);
  assert.match(category, /category-comparison-dock/);
  assert.match(category, /role="dialog" aria-modal="true"/);
  assert.match(category, /technicalSpecs/);
  assert.match(category, /قیمت اختصاصی در این بخش نمایش داده نمی‌شود/);
  assert.match(card, /onToggleCompare/);
  assert.match(card, /aria-pressed=\{compareSelected\}/);
  assert.doesNotMatch(category, /comparisonRows[\s\S]{0,500}formatPrice/);
});
