import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getProductDisplayBrands,
  productHasDisplayBrand,
  resolveDisplayBrand,
} from "../src/utils/catalogBrands.ts";

test("brand resolver never promotes placeholders or Sanat Pish into manufacturer brands", () => {
  assert.equal(resolveDisplayBrand("ثبت نشده", "قطعه صنعتی عمومی"), "");
  assert.equal(resolveDisplayBrand("صنعت پیش", "قطعه صنعتی"), "");
  assert.equal(resolveDisplayBrand("خارجی", "تسمه صنعتی بدون نام سازنده"), "");
});

test("brand resolver recognizes only supported manufacturer evidence in brand or product text", () => {
  assert.equal(resolveDisplayBrand("", "تسمه Optibelt SPA 1250"), "Optibelt");
  assert.equal(resolveDisplayBrand("ContiTech", "تسمه صنعتی"), "Continental (ContiTech)");
  assert.equal(resolveDisplayBrand("FAG", "بلبرینگ صنعتی"), "FAG / INA");
  assert.equal(resolveDisplayBrand("", "تسمه FORZA 8M"), "FORZA");
  assert.equal(resolveDisplayBrand("Atlas Industrial", "قطعه صنعتی"), "Atlas Industrial");
});

test("brand facets include actual SKU-level manufacturers when the family brand is empty", () => {
  const product = {
    code: "FAM-10001",
    name: "خانواده تسمه تایمینگ",
    brand: "ثبت نشده",
    variants: [
      { code: "SWR-8M-1000", name: "SWR 8M 1000", brand: "SWR", active: true },
      { code: "GATES-8M-1200", name: "تسمه 8M", brand: "Gates", active: true },
      { code: "OLD-8M", name: "کد غیرفعال", brand: "SKF", active: false },
    ],
  };

  assert.deepEqual(getProductDisplayBrands(product), ["SWR", "Gates"]);
  assert.equal(productHasDisplayBrand(product, "Gates"), true);
  assert.equal(productHasDisplayBrand(product, "SKF"), false);
});

test("a real family brand and matching SKU brand are deduplicated", () => {
  const product = {
    code: "FAM-10002",
    name: "تسمه صنعتی",
    brand: "Optibelt",
    variants: [{ code: "OP-1250", name: "Optibelt 1250", brand: "اپتی‌بلت", active: true }],
  };
  assert.deepEqual(getProductDisplayBrands(product), ["Optibelt"]);
});
