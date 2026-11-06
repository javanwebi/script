import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("mobile auth and visual search suppress floating navigation", () => {
  const auth = source("src/components/auth/AuthModal.tsx");
  const visual = source("src/components/search/AiVisualPartSearchModal.tsx");
  const css = source("src/storefront.css");
  assert.match(auth, /sanat-auth-dialog-open/);
  assert.match(visual, /sanat-visual-search-open/);
  assert.match(css, /body\.sanat-auth-dialog-open \.store-ai-quick-actions/);
  assert.match(css, /body\.sanat-visual-search-open \.store-bottom-nav/);
  assert.match(css, /body\.sanat-product-detail-open \.store-ai-quick-actions/);
});

test("mobile hero removes the under-banner marketing copy and provides direct page links", () => {
  const home = source("src/pages/HomePage.tsx");
  assert.match(home, /sanatpish-mobile-hero\.webp/);
  assert.match(home, /ورود سریع به بخش‌های صنعت پیش/);
  assert.match(home, /to=\"\/products\"/);
  assert.match(home, /to=\"\/categories\"/);
  assert.match(home, /to=\"\/ai-consult\"/);
  assert.match(home, /to=\"\/consumer-dashboard\"/);
  assert.doesNotMatch(home, /Mobile Text & Information Block/);
});

test("clicking a SKU code opens its linked image without mislabeling family references", () => {
  const variants = source("src/components/product/ProductVariants.tsx");
  assert.match(variants, /openVariantImagePreview\(v\)/);
  assert.match(variants, /تصویر اختصاصی این کد ثبت نشده است/);
  assert.match(variants, /sanat-product-image-preview-open/);
});

test("the FORZA contact sheet no longer renders the decorative chat popup above it", () => {
  const floating = source("src/components/common/AiFloatingButton.tsx");
  const styles = source("src/components/common/floating-quick-actions.css");
  assert.doesNotMatch(floating, /sp-forza-contact__chat-preview/);
  assert.doesNotMatch(styles, /sp-forza-contact__chat-preview/);
});
