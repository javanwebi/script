import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Product } from "../src/types";
import { rankIndustryProducts } from "../src/utils/industryCatalog";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const page = read("src/pages/IndustryTemplatePage.tsx");
const css = read("src/pages/industry-template.css");
const app = read("src/App.tsx");
const details = read("src/data/industryPageDetails.ts");

test("all six industry routes use one lazy-loaded canonical page template", () => {
  assert.match(app, /const IndustryTemplatePage = lazy/);
  assert.match(app, /path="\/industries\/:slug"[\s\S]*?element=\{<IndustryTemplatePage \/>\}/);
  assert.match(app, /path="\/industry\/:slug"[\s\S]*?element=\{<IndustryTemplatePage \/>\}/);
  assert.match(app, /Navigate to="\/industries\/ceramic"/);
  for (const slug of ["ceramic", "textile", "packaging", "food", "machinery", "rubber"]) {
    assert.ok(details.includes(slug + ": {"), "missing content for " + slug);
    assert.ok(page.includes("industry.title"), "industry content must come from the canonical registry");
  }
});

test("industry stages are grounded in the supplied template and do not expose demo SKU data", () => {
  for (const slug of ["ceramic", "textile", "packaging", "food", "machinery", "rubber"]) {
    assert.ok(details.includes(slug + ": {"), "missing " + slug);
  }
  assert.match(details, /کوره پخت/);
  assert.match(details, /رنگرزی و تکمیل/);
  assert.match(details, /کروگیتور/);
  assert.match(details, /پاستوریزاسیون/);
  assert.match(details, /ماشین‌کاری و ساخت/);
  assert.match(details, /اکستروژن/);
  assert.doesNotMatch(page + details, /SP-FP-6208|FAM-TEXTILE|SKU-TEXTILE|SP-[A-Z]{2}-[A-Z0-9]+/);
  assert.doesNotMatch(page, /Math\.random|trackingCode\s*=/);
});

test("catalog cards and stage recommendations come only from the live catalog ranker", () => {
  assert.match(page, /getAllProducts\(\)/);
  assert.match(page, /isDatabaseCatalogHydrated\(\)/);
  assert.doesNotMatch(page, /databaseStorageEnabled\(\)/);
  assert.match(page, /subscribeCatalogChanges/);
  assert.match(page, /rankIndustryProducts\(products, industry, 6\)/);
  assert.match(page, /rankIndustryProducts\(products, \{ \.\.\.industry, terms:/);
  assert.match(page, /<ProductCard/);
  assert.match(page, /نتیجه ساختگی ارائه نمی‌شود/);
  assert.match(page, /کالای تأییدشده‌ای برای پیشنهاد مستقیم پیدا نشد/);
});

test("all major actions navigate to real site routes or the real custom-part request API", () => {
  assert.match(page, /\/products\?q=/);
  assert.match(page, /\/ai-consult\?industry=/);
  assert.match(page, /PartIdentificationLink/);
  assert.match(page, /CustomPartRequestModal/);
  assert.match(page, /\/knowledge\//);
  assert.match(page, /\/about/);
  assert.match(page, /\/services/);
  assert.match(page, /\/contact/);
  assert.match(page, /initialNotes=/);
  const modal = read("src/components/home/CustomPartRequestModal.tsx");
  assert.match(modal, /fetch\('\/api\/custom-part-requests'/);
});

test("industry template has responsive desktop, tablet, mobile and reduced-motion rules", () => {
  assert.match(css, /\.ipt-hero\s*\{/);
  assert.match(css, /@media \(max-width: 1050px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
});

function catalogProduct(code: string, name: string, overrides: Partial<Product> = {}): Product {
  return {
    code,
    name,
    brand: "TEST",
    categorySlug: "industrial-parts",
    categoryName: "قطعات صنعتی",
    subcategory: "قطعات انتقال",
    technicalSpecs: [],
    prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
    stock: 0,
    inquiryOnly: true,
    images: [],
    tags: [],
    unit: "عدد",
    ...overrides,
  };
}

test("industry ranking returns only active relevant catalogue families and de-duplicates codes", () => {
  const ceramic = { slug: "ceramic", title: "کاشی و سرامیک", terms: ["تسمه", "چرخ", "مکنده", "نسوز"] };
  const relevant = catalogProduct("FAM-REAL-1", "چرخ صنعتی پلی‌یورتان");
  const inactive = catalogProduct("FAM-OLD-2", "تسمه صنعتی", { active: false });
  const unrelated = catalogProduct("FAM-REAL-3", "دستکش ایمنی");
  const ranked = rankIndustryProducts([unrelated, inactive, relevant, relevant], ceramic, 6);
  assert.deepEqual(ranked.map(product => product.code), ["FAM-REAL-1"]);
});
