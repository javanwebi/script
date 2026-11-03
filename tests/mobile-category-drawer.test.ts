import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("home mobile categories use the existing bottom dock and a real modal sheet", () => {
  const nav = source("src/components/layout/MobileBottomBar.tsx");
  assert.match(nav, /onClick=\{openCategories\}/);
  assert.match(nav, /setSheet\("categories"\)/);
  assert.match(nav, /store-mobile-sheet is-category-explorer/);
  assert.match(nav, /<ReferenceMegaMenu compact onNavigate=\{\(\) => setSheet\(null\)\} \/>/);
  assert.match(nav, /onCancel=\{\(\) => setSheet\(null\)\}/);
  assert.match(nav, /dialog\.current\?\.showModal\(\)/);
  assert.match(nav, /if \(opener\.current\?\.isConnected\) opener\.current\.focus\(\)/);
});

test("mobile group rail and results derive from the exact approved Excel catalogue", () => {
  const menu = source("src/components/catalog/ReferenceMegaMenu.tsx");
  const explorer = source("src/components/catalog/MobileCategoryExplorer.tsx");
  assert.match(menu, /APPROVED_MENU_CATEGORIES, APPROVED_MENU_GROUPS/);
  assert.match(menu, /navigationSections/);
  assert.match(menu, /<MobileCategoryExplorer/);
  assert.match(menu, /sections=\{navigationSections\}/);
  assert.match(menu, /onSearch=\{setSearch\}/);
  assert.match(explorer, /sections\.map\(group/);
  assert.match(explorer, /onClick=\{\(\) => setSelectedGroupId\(group\.id\)\}/);
  assert.match(explorer, /activeGroup\.categories\.map\(category/);
  assert.match(explorer, /category\.children/);
  assert.match(explorer, /<CategoryNavigation nodes=\{subNodes\} categorySlug=\{category\.slug\}/);
  assert.match(explorer, /resolveCategorySlug\(category\.slug\)/);
  assert.match(explorer, /onClick=\{onNavigate\}/);
  assert.doesNotMatch(explorer, /SP-458721|SP-335090|۲۴۸ کالا/);
});

test("sheet preserves two independent RTL scroll regions and scanner dock layout", () => {
  const css = source("src/components/catalog/mobile-category-explorer.css");
  const industrial = source("src/components/layout/industrial-mobile-nav.css");
  assert.match(css, /store-mobile-sheet\.is-category-explorer\[open\]/);
  assert.match(css, /grid-template-columns: minmax\(114px, 39%\) minmax\(0, 1fr\)/);
  assert.match(css, /sanat-mobile-category-rail \{/);
  assert.match(css, /sanat-mobile-category-results \{/);
  assert.ok((css.match(/overflow-y: auto/g) || []).length >= 2);
  assert.match(css, /overscroll-behavior: contain/);
  assert.match(css, /direction: rtl/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /max-width: 375px/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(industrial, /store-scan-orbit/);
});
