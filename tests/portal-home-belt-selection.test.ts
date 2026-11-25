import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("homepage places the focused belt selector directly after product categories", () => {
  const home = read("src/pages/HomePage.tsx");
  const categories = home.indexOf("<HomeCategoryStrip />");
  const beltSelector = home.indexOf("<HomeBeltSelection />");
  const clients = home.indexOf("<OurClientsSection />");

  assert.ok(categories >= 0, "the existing product category strip remains");
  assert.ok(beltSelector > categories, "the new belt section follows product categories");
  assert.ok(clients > beltSelector, "existing client section remains after the new feature");
  assert.match(home, /<HomeBeltSelection\s*\/>/);
});

test("homepage belt section stays visually restrained and uses existing optimized belt artwork", () => {
  const component = read("src/components/storefront/HomeBeltSelection.tsx");
  const styles = read("src/components/storefront/HomeBeltSelection.css");

  assert.match(component, /STORE_ASSETS\.subcategories\.vbeltRibbedHero/);
  assert.match(component, /to="\/belt-selection"/);
  assert.match(component, /از روی عکس/);
  assert.match(component, /با کد فنی/);
  assert.match(styles, /@media \(max-width: 767px\)/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("belt selection page connects image, code, pulley calculation and engineering guidance to existing flows", () => {
  const page = read("src/pages/BeltSelectionPage.tsx");

  assert.match(page, /to="\/identify-part\?from=belt-selection"/);
  assert.match(page, /navigate\(\`\/search\?q=\$\{encodeURIComponent\(query\)\}&scope=industrial-belt\`\)/);
  assert.match(page, /scope=industrial-belt/);
  assert.match(page, /tool=belt-calculator/);
  assert.match(page, /prompt=\$\{encodeURIComponent\(BELT_ENGINEERING_PROMPT\)\}/);
});

test("belt selection route is lazy-loaded and preloaded only on deliberate navigation intent", () => {
  const app = read("src/App.tsx");
  const preload = read("src/components/layout/RouteIntentPreload.tsx");

  assert.match(app, /import\("\.\/pages\/BeltSelectionPage"\)/);
  assert.match(app, /path="\/belt-selection"/);
  assert.match(preload, /'\/belt-selection':\s*\(\)\s*=>\s*import\('\.\.\/\.\.\/pages\/BeltSelectionPage'\)/);
});

test("FORZA supports belt selector deep links without changing default chat behavior", () => {
  const consult = read("src/pages/AiConsultPage.tsx");

  assert.match(consult, /entryParams\.get\('tool'\)[\s\S]*?setShowCalculatorModal\(true\)/);
  assert.match(consult, /entryParams\.get\('prompt'\)[\s\S]*?setInputQuery/);
});

test("image identification returns customers to the belt selection flow", () => {
  const provider = read("src/components/search/PartIdentificationProvider.tsx");
  const layout = read("src/components/layout/Layout.tsx");
  const dock = read("src/components/layout/storefrontBottomNavVisibility.ts");

  assert.match(provider, /entrySource === 'belt-selection'[\s\S]*?returnPath[\s\S]*?\/belt-selection/);
  assert.match(layout, /"\/belt-selection"/);
  assert.match(dock, /"\/belt-selection"/);
});
