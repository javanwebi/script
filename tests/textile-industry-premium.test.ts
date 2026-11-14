import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (file: string) => readFileSync(file, "utf8");
const page = source("src/pages/IndustryTemplatePage.tsx");
const styles = source("src/pages/industry-template.css");
const content = source("src/data/industryPageDetails.ts");
const routes = source("src/App.tsx");

test("textile uses the same canonical industry template without losing its dedicated production stages", () => {
  assert.match(routes, /path="\/industries\/:slug"[\s\S]*?IndustryTemplatePage/);
  assert.match(page, /normalizeSlug/);
  assert.match(content, /textile: \{/);
  assert.match(content, /آماده‌سازی الیاف/);
  assert.match(content, /ریسندگی/);
  assert.match(content, /بافندگی/);
  assert.match(content, /گردبافی/);
  assert.match(content, /رنگرزی و تکمیل/);
  assert.match(content, /کنترل کیفیت و بسته‌بندی/);
});

test("textile content explains real process constraints without promising unsupported compatibility", () => {
  assert.match(content, /پرز و الیاف معلق/);
  assert.match(content, /رطوبت، بخار، مواد شیمیایی/);
  assert.match(content, /مدل ماشین/);
  assert.match(page, /جایگزینی نهایی نیازمند تطبیق مشخصات فنی است/);
  assert.doesNotMatch(content, /تضمین کیفیت صنعتی|مشاوره تخصصی رایگان|سرعت مجاز تا/);
});

test("textile search, identification, FORZA and manufacturing request retain industry context", () => {
  assert.match(page, /\/ai-consult\?industry=/);
  assert.match(page, /\/identify-part\?industry=/);
  assert.match(page, /CustomPartRequestModal/);
  assert.match(page, /درخواست از صفحه صنعت /);
  assert.match(page, /rankIndustryProducts/);
});

test("textile layout remains responsive and respects reduced-motion preferences", () => {
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /@media \(max-width: 390px\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /\.industry-template--textile/);
});
