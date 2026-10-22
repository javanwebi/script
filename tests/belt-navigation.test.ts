import { test } from "node:test";
import assert from "node:assert/strict";
import { BELT_MENU, matchesBeltSelection } from "../src/data/beltNavigation";
import type { Product } from "../src/types";
const p = (name: string, submenu = "", extra = {}) =>
  ({
    name,
    submenu,
    subcategory: "",
    tags: [],
    technicalSpecs: [],
    variants: [],
    ...extra,
  }) as unknown as Product;
test("belt navigation preserves requested hierarchy", () => {
  assert.deepEqual(
    BELT_MENU.map((n) => n.name),
    [
      "تسمه V-BELT",
      "تسمه CRC پنج ضلعی",
      "تسمه گرد پلی اورتان",
      "تسمه تایمینگ",
      "تسمه شیاری",
    ],
  );
  assert.deepEqual(
    BELT_MENU.at(-1)?.children?.map((n) => n.name),
    ["PK", "PY", "PL"],
  );
});
test("classic and special links select their actual catalog types", () => {
  assert.equal(
    matchesBeltSelection(p("تسمه SPA", "تسمه V پروفیل باریک"), "اسپشیال"),
    true,
  );
  assert.equal(
    matchesBeltSelection(p("تسمه SPA", "تسمه V پروفیل باریک"), "کلاسیک"),
    false,
  );
  assert.equal(
    matchesBeltSelection(p("تسمه A", "تسمه V کلاسیک"), "کلاسیک"),
    true,
  );
});
test("CRC and timing subtype links do not broaden unknown materials", () => {
  assert.equal(
    matchesBeltSelection(p("تسمه CRC جوشی پلی یورتان"), "جوشی پلی یورتان"),
    true,
  );
  assert.equal(
    matchesBeltSelection(p("تسمه CRC فابریک"), "جوشی پلی یورتان"),
    false,
  );
  assert.equal(
    matchesBeltSelection(p("تسمه تایمینگ T10"), "فابریک لاستیکی"),
    false,
  );
  assert.equal(matchesBeltSelection(p("تسمه سیم دار T10"), "سیمار"), true);
});
test("rib profile matches a real family/SKU identity, not a generic specification list", () => {
  const product = p("تسمه 6PK1200", "تسمه چندشیاری", {
    technicalSpecs: [{ key: "نوع", value: "تسمه شیاری PJ / PK / PL" }],
  });
  assert.equal(matchesBeltSelection(product, "PK"), true);
  assert.equal(matchesBeltSelection(product, "PL"), false);
  assert.equal(
    matchesBeltSelection(
      p("تسمه", "", { variants: [{ code: "6PL1200", size: "1200" }] }),
      "PL",
    ),
    true,
  );
});
