import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Product } from "../src/types";
import { INDUSTRY_STAGE_CATALOG } from "../src/data/industryStageCatalog";
import { INDUSTRY_PAGE_DETAILS } from "../src/data/industryPageDetails";
import {
  rankIndustryProcessProducts,
  rankIndustryStageProducts,
  type IndustryStageCatalogDefinition,
} from "../src/utils/industryCatalog";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const page = read("src/pages/IndustryTemplatePage.tsx");
const css = read("src/pages/industry-template.css");
const app = read("src/App.tsx");
const home = read("src/pages/HomePage.tsx");
const details = read("src/data/industryPageDetails.ts");
const stageCatalogSource = read("src/data/industryStageCatalog.ts");

test("all six homepage industry cards open their canonical industry detail routes", () => {
  for (const slug of ["ceramic", "textile", "packaging", "food", "machinery", "rubber"]) {
    assert.match(home, new RegExp('link: "/industries/' + slug + '"'));
    assert.match(app, new RegExp('path="/industries/' + slug + '"|path="/industries/:slug"'));
  }
  assert.match(app, /path="\/category\/ceramic-tiles"[\s\S]*?Navigate to="\/industries\/ceramic"/);
  assert.match(app, /path="\/category\/textile-machinery"[\s\S]*?Navigate to="\/industries\/textile"/);
  assert.match(app, /path="\/category\/packaging-carton"[\s\S]*?Navigate to="\/industries\/packaging"/);
  assert.match(app, /path="\/category\/food-beverage"[\s\S]*?Navigate to="\/industries\/food"/);
  assert.match(app, /path="\/category\/machinery-equipment"[\s\S]*?Navigate to="\/industries\/machinery"/);
  assert.match(app, /path="\/category\/rubber-plastics"[\s\S]*?Navigate to="\/industries\/rubber"/);
  assert.match(page, /canonicalPath = "\/industries\/" \+ slug/);
  assert.match(page, /location\.pathname\.replace/);
});

test("production sequences use technically valid process order and expose alternative routes honestly", () => {
  for (const slug of ["ceramic", "textile", "packaging", "food", "machinery", "rubber"]) {
    assert.ok(details.includes(slug + ": {"), "missing " + slug);
    assert.equal(
      INDUSTRY_STAGE_CATALOG[slug].length,
      INDUSTRY_PAGE_DETAILS[slug].stages.length,
      "stage catalog mapping must stay aligned with the numbered stages for " + slug,
    );
  }
  assert.match(details, /کروگیتور و ورق‌سازی/);
  assert.match(details, /چاپ فلکسو/);
  assert.match(details, /اسلیتر و اسکورر/);
  assert.match(details, /بافندگی یا گردبافی؛ مسیرهای جایگزین/);
  assert.match(details, /اکستروژن یا تزریق؛ مسیرهای جایگزین/);
  assert.match(details, /ولکانیزاسیون یا خنک‌کاری متناسب با ماده/);
  assert.match(stageCatalogSource, /قطعات کوره/);
  assert.match(stageCatalogSource, /قطعات دستگاه چاپ/);
  assert.match(stageCatalogSource, /قطعات استاکر/);
  assert.match(stageCatalogSource, /food-grade/);
  assert.doesNotMatch(page + details, /SP-FP-6208|FAM-TEXTILE|SKU-TEXTILE|SP-[A-Z]{2}-[A-Z0-9]+/);
  assert.doesNotMatch(page, /Math\.random|trackingCode\s*=/);
});

test("selected production stage uses strict category, subcategory and term matching only", () => {
  assert.match(page, /rankIndustryStageProducts\(products, activeStageCatalog, 3\)/);
  assert.match(page, /rankIndustryStageProducts\([\s\S]*?activeStageCatalog,[\s\S]*?\[equipment, condition, operatingNote\]/);
  assert.match(page, /rankIndustryProcessProducts\(products, stageCatalogs\.map/);
  assert.doesNotMatch(page, /rankIndustryProducts/);
  assert.match(page, /INDUSTRY_STAGE_CATALOG/);
  assert.match(page, /activeStageCatalog\?\.notice/);
  assert.match(page, /برای جلوگیری از نمایش کالای نامرتبط، نتیجه ساختگی ارائه نمی‌شود/);
});

function catalogProduct(
  code: string,
  name: string,
  overrides: Partial<Product> = {},
): Product {
  return {
    code,
    name,
    brand: "TEST",
    categorySlug: "تجهیزات-خطوط-کاشی-و-سرامیک",
    categoryName: "تجهیزات خطوط کاشی و سرامیک",
    subcategory: "قطعات کوره",
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

test("stage ranker excludes unrelated category, subcategory and inactive families", () => {
  const kilnStage: IndustryStageCatalogDefinition = {
    categorySlugs: ["تجهیزات-خطوط-کاشی-و-سرامیک"],
    subcategories: ["قطعات کوره"],
    terms: ["کوره", "رولر"],
  };
  const relevant = catalogProduct("FAM-REAL-1", "بلبرینگ کوره");
  const wrongCategory = catalogProduct("FAM-REAL-2", "بلبرینگ کوره", {
    categorySlug: "بلبرینگ-و-یاتاقان",
    categoryName: "بلبرینگ و یاتاقان",
    subcategory: "بلبرینگ صنعتی",
  });
  const wrongSubcategory = catalogProduct("FAM-REAL-3", "رولر کوره", {
    subcategory: "قطعات دستگاه چاپ",
  });
  const inactive = catalogProduct("FAM-OLD-4", "قطعات کوره", { active: false });
  const unrelated = catalogProduct("FAM-REAL-5", "دستکش ایمنی");
  const ranked = rankIndustryStageProducts(
    [unrelated, wrongCategory, wrongSubcategory, inactive, relevant, relevant],
    kilnStage,
    6,
  );
  assert.deepEqual(ranked.map(product => product.code), ["FAM-REAL-1"]);
});

test("empty stage mappings never fall back to broad industry keywords", () => {
  const emptyStage: IndustryStageCatalogDefinition = {
    categorySlugs: [],
    subcategories: [],
    terms: [],
  };
  const genericBelt = catalogProduct("FAM-GENERIC-1", "تسمه صنعتی", {
    categorySlug: "تسمه-و-انتقال-نیرو",
    categoryName: "تسمه و انتقال نیرو",
    subcategory: "تسمه صنعتی",
  });
  assert.deepEqual(rankIndustryStageProducts([genericBelt], emptyStage, 6), []);
});

test("industry catalogue shortlist is the deduplicated union of stage-approved families", () => {
  const products = [
    catalogProduct("FAM-REAL-1", "بلبرینگ کوره"),
    catalogProduct("FAM-REAL-2", "رولر کوره"),
    catalogProduct("FAM-REAL-3", "پولی چاپ", { subcategory: "قطعات دستگاه چاپ" }),
  ];
  const stages = [
    { catalog: { categorySlugs: ["تجهیزات-خطوط-کاشی-و-سرامیک"], subcategories: ["قطعات کوره"], terms: ["کوره", "رولر"] } },
    { catalog: { categorySlugs: ["تجهیزات-خطوط-کاشی-و-سرامیک"], subcategories: ["قطعات دستگاه چاپ"], terms: ["چاپ"] } },
  ];
  const ranked = rankIndustryProcessProducts(products, stages, 6);
  assert.deepEqual(ranked.map(product => product.code), ["FAM-REAL-1", "FAM-REAL-2", "FAM-REAL-3"]);
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

test("desktop hero places the image on the left and Persian copy on the right", () => {
  assert.match(page, /ipt-hero-visual/);
  assert.match(css, /\.ipt-hero\s*\{\s*direction: ltr;/);
  assert.match(css, /\.ipt-hero-copy\s*\{\s*direction: rtl;/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(page, /ipt-stage-hotspots/);
  assert.match(page, /ipt-stage-tabs/);
});

test("industry page hero images use the actual industry-specific source assets", () => {
  assert.match(home, /industries\.ceramic/);
  assert.match(home, /industries\.textile/);
  assert.match(home, /companyPages\.industriesHero/);
  assert.match(home, /industries\.foodBottles/);
  assert.match(home, /industries\.manufacturing/);
  assert.match(home, /industries\.rubber/);
});
