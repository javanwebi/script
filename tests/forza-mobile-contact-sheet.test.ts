import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("FORZA launcher preserves desktop direct navigation and mobile-only half-height contact sheet", () => {
  const code = source("src/components/common/AiFloatingButton.tsx");
  const css = source("src/components/common/floating-quick-actions.css");
  assert.match(code, /window\.matchMedia\("\(max-width: 1023px\)"\)\.matches/);
  assert.match(code, /navigate\("\/ai-consult"\)/);
  assert.match(code, /createPortal\(/);
  assert.match(code, /data-testid="forza-mobile-contact-sheet"/);
  assert.match(code, /aria-modal="true"/);
  assert.match(css, /height: max\(56dvh/);
  assert.match(css, /@media \(min-width: 1024px\)/);
});

test("phone and WhatsApp use site contact links; unavailable social accounts never send users to generic platform homepages", () => {
  const code = source("src/components/common/AiFloatingButton.tsx");
  assert.match(code, /tel:03535254703/);
  assert.match(code, /https:\/\/wa\.me\/989903427027/);
  assert.match(code, /VITE_SANATPISH_EITAA_URL/);
  assert.match(code, /VITE_SANATPISH_TELEGRAM_URL/);
  assert.match(code, /VITE_SANATPISH_INSTAGRAM_URL/);
  assert.match(code, /آدرس رسمی هنوز ثبت نشده/);
  assert.doesNotMatch(code, /href="https:\/\/(instagram\.com|eitaa\.com|t\.me)"/);
});

test("swipe up passes threshold to the same existing AI workspace chat route with accessible button fallback", () => {
  const code = source("src/components/common/AiFloatingButton.tsx");
  assert.match(code, /onTouchStart=\{onTouchStart\}/);
  assert.match(code, /onTouchMove=\{onTouchMove\}/);
  assert.match(code, /onTouchEnd=\{onTouchEnd\}/);
  assert.match(code, /dragOffsetRef\.current > 78/);
  assert.match(code, /if \(shouldEnter\) openWorkspace\(\)/);
  assert.match(code, /onClick=\{openWorkspace\}/);
  assert.match(code, /event\.key === "Escape"/);
  assert.match(code, /document\.body\.style\.overflow = overflow/);
});
