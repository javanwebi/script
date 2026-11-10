import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file: string) =>
  readFileSync(new URL("../" + file, import.meta.url), "utf8");

test("company routes use the new page-specific art direction without changing route URLs", () => {
  const app = read("src/App.tsx");
  const pages = read("src/pages/CompanyPagesExperience.tsx");

  assert.match(app, /from "\.\/pages\/CompanyPagesExperience"/);
  assert.match(app, /path="\/about" element={<AboutPage \/>}/);
  assert.match(app, /path="\/services" element={<ServicesPage \/>}/);
  assert.match(app, /path="\/industries" element={<IndustriesPage \/>}/);
  assert.match(app, /path="\/brands" element={<BrandsPage \/>}/);
  assert.match(app, /path="\/knowledge" element={<KnowledgePage \/>}/);

  for (const pageClass of [
    "company-page--about",
    "company-page--services",
    "company-page--industries",
    "company-page--brands",
    "company-page--knowledge",
  ]) {
    assert.ok(pages.includes(pageClass), "missing page root: " + pageClass);
  }
});

test("About page explains the Atlas backing and links to every company destination", () => {
  const pages = read("src/pages/CompanyPagesExperience.tsx");
  assert.match(pages, /با پشتوانه بازرگانی تسمه اطلس/);
  assert.match(pages, /بازار جامع قطعات صنعتی ایران/);
  for (const href of ["/services", "/industries", "/brands", "/products", "/knowledge", "/contact"]) {
    assert.ok(pages.includes('to: "' + href + '"') || pages.includes('to="' + href + '"'),
      "About page destination missing: " + href);
  }
});

test("service and industry pages use dedicated visual compositions rather than repeated generic card grids", () => {
  const pages = read("src/pages/CompanyPagesExperience.tsx");
  const css = read("src/company-pages-art-direction.css");
  assert.match(pages, /sp-service-mosaic/);
  assert.match(pages, /sp-industry-bento/);
  assert.match(pages, /INDUSTRIES\.map/);
  assert.doesNotMatch(pages, /company-service-grid|company-industry-grid|company-pathway-grid/);
  assert.match(css, /\.sp-service-item--catalog/);
  assert.match(css, /\.sp-industry-tile--ceramic/);
  assert.match(css, /\.sp-industry-tile--textile/);
});

test("brand directory remains connected to published database records and honest empty states", () => {
  const pages = read("src/pages/CompanyPagesExperience.tsx");
  assert.match(pages, /getManagedBrands/);
  assert.match(pages, /databaseStorageEnabled/);
  assert.match(pages, /atlas-brands-updated/);
  assert.match(pages, /brand\.active !== false/);
  assert.match(pages, /هنوز برندی برای نمایش منتشر نشده است/);
  assert.match(pages, /موجودی همه محصولات/);
});

test("knowledge base preserves source articles, filtering, article detail and technical disclaimer", () => {
  const pages = read("src/pages/CompanyPagesExperience.tsx");
  assert.match(pages, /import \{ INDUSTRIES, ARTICLES \}/);
  assert.match(pages, /ARTICLES\.find/);
  assert.match(pages, /sp-knowledge-toc/);
  assert.match(pages, /sp-knowledge-search/);
  assert.match(pages, /مشخصات\s+کاتالوگ سازنده و دستورالعمل دستگاه ملاک تأیید نهایی هستند/);
});

test("member pricing remains account-aware and no sample product price is introduced", () => {
  const pages = read("src/pages/CompanyPagesExperience.tsx");
  assert.match(pages, /MemberAccess compact/);
  assert.match(pages, /قیمت SKU از داده تجاری فعال سرور/);
  assert.match(pages, /قیمت‌های به‌روز در حساب مشتری/);
  assert.doesNotMatch(pages, /قیمت نمونه|قیمت فرضی|۱٬۲۳۴٬۵۶۷/);
});

test("art direction supports mobile, keyboard focus and reduced motion; contact logic stays in place", () => {
  const css = read("src/company-pages-art-direction.css");
  const contact = read("src/pages/ContactUsPage.tsx");
  const main = read("src/main.tsx");
  assert.match(main, /company-pages-art-direction\.css/);
  assert.match(css, /max-width: 760px/);
  assert.match(css, /max-width: 420px/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
  assert.match(contact, /contact-page__hero/);
  assert.match(contact, /contact-workspace-main/);
  assert.match(contact, /handleFormSubmit/);
  assert.match(contact, /handleConfirmVisit/);
});
