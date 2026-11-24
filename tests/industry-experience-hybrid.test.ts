import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Product } from "../src/types";
import { INDUSTRY_EXPERIENCE } from "../src/data/industryExperience";
import { rankIndustryStageProducts } from "../src/utils/industryCatalog";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const map = read("src/components/storefront/IndustryProcessMap.tsx");
const page = read("src/pages/IndustryTemplatePage.tsx");
const directory = read("src/pages/DiscoveryPages.tsx");
const styles = read("src/industry-experience.css") + read("src/pages/industry-template.css");
const workflow = read(".github/workflows/verify-vps-build.yml");

test("all six industries have distinct process-map art directions", () => {
  const expected = {
    ceramic: "thermal",
    textile: "woven",
    packaging: "conveyor",
    food: "hygiene",
    machinery: "blueprint",
    rubber: "polymer",
  } as const;
  for (const [slug, layout] of Object.entries(expected)) {
    assert.equal(INDUSTRY_EXPERIENCE[slug as keyof typeof INDUSTRY_EXPERIENCE].layout, layout);
    assert.match(styles, new RegExp("\\.ipt-process-map--" + layout));
  }
});

test("the process map keeps accessible stage selection and updates the existing detail panel", () => {
  assert.match(page, /<IndustryProcessMap/);
  assert.match(page, /setRequestOpen\(false\);[\s\S]*?\}, \[slug\]\)/,
    "industry navigation must close an open custom-part request modal");
  assert.doesNotMatch(page, /ipt-production-visual/);
  assert.match(map, /role="tablist"/);
  assert.match(map, /role="tab"/);
  assert.match(map, /aria-selected=\{selected\}/);
  assert.match(map, /tabIndex=\{selected \? 0 : -1\}/);
  assert.match(map, /event\.key === "ArrowRight"/);
  assert.match(map, /event\.key === "ArrowLeft"/);
  assert.match(map, /event\.key === "Home"/);
  assert.match(map, /event\.key === "End"/);
  assert.match(map, /aria-controls="ipt-stage-panel"/);
  assert.match(map, /id=\{"ipt-stage-tab-" \+ index\}/);
  assert.match(page, /aria-labelledby=\{"ipt-stage-tab-" \+ Math\.min\(activeStageIndex, stages\.length - 1\)\}/);
  assert.match(map, /data-stage-title=\{stage\.title\}/);
  assert.match(map, /نمای شماتیک مسیر فرایند؛ نه نقشه اجرایی کارخانه/);
});

test("the industry directory gives customers three real starting routes and an editorial six-industry grid", () => {
  assert.match(directory, /industry-directory-paths/);
  assert.match(directory, /to="\/products"/);
  assert.match(directory, /to="\/identify-part"/);
  assert.match(directory, /to="\/ai-consult"/);
  assert.match(directory, /company-industry-grid--editorial/);
  assert.match(styles, /grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/);
  assert.match(styles, /company-industry-card:nth-child\(1\)/);
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

test("station ranking prioritizes stage evidence, keeps industry fallback and excludes inactive or unrelated products", () => {
  const ceramic = { slug: "ceramic", title: "کاشی و سرامیک", terms: ["تسمه", "چرخ", "مکنده", "نسوز"] };
  const stage = { title: "کوره پخت", subtitle: "رولر، مشعل و قطعات نسوز" };
  const contextual = catalogProduct("CAT-KILN-01", "رولر نسوز کوره", {
    technicalSpecs: [{ key: "کاربرد", value: "کوره پخت" }],
  });
  const operatingContextMatch = catalogProduct("CAT-HEAT-03", "بلبرینگ صنعتی", {
    description: "مناسب دمای بالا و فشار کاری مداوم",
  });
  const industryFallback = catalogProduct("CAT-BELT-02", "تسمه صنعتی");
  const inactive = catalogProduct("CAT-OLD-03", "تسمه نسوز", { active: false });
  const unrelated = catalogProduct("CAT-OTHER-04", "دستکش ایمنی", { featured: true, hasCatalogueImage: true });
  const ranked = rankIndustryStageProducts(
    [industryFallback, inactive, unrelated, operatingContextMatch, contextual],
    ceramic,
    stage,
    4,
    ["دمای بالا، فشار ۱۲ بار و کار مداوم"],
  );
  assert.deepEqual(
    ranked.map(product => product.code),
    ["CAT-KILN-01", "CAT-HEAT-03", "CAT-BELT-02"],
    "free-text operating conditions must influence matching without admitting unrelated featured products",
  );
});

test("the VPS workflow runs the new industry tests and all-industry responsive smoke", () => {
  assert.match(workflow, /tests\/industry-experience-hybrid\.test\.ts/);
  assert.match(workflow, /scripts\/tests\/industry-experience-responsive-smoke\.cjs/);
});
