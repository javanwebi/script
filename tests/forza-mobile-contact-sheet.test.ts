import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("FORZA launcher opens workspace directly on desktop and mobile", () => {
  const code = source("src/components/common/AiFloatingButton.tsx");
  const css = source("src/components/common/floating-quick-actions.css");
  assert.match(code, /const handleLauncherClick = \(\) => navigate\("\/ai-consult"\)/);
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

test("swipe up enters the same AI chat route without any visible workspace button", () => {
  const code = source("src/components/common/AiFloatingButton.tsx");
  assert.match(code, /onTouchStart=\{onTouchStart\}/);
  assert.match(code, /onTouchMove=\{onTouchMove\}/);
  assert.match(code, /onTouchEnd=\{onTouchEnd\}/);
  assert.match(code, /dragOffsetRef\.current > 58/);
  assert.match(code, /if \(shouldEnter\) openWorkspace\(\)/);
  assert.doesNotMatch(code, /sp-forza-contact__workspace-button|onClick=\{openWorkspace\}/);
  assert.match(code, /role="link"/);
  assert.match(code, /onKeyDown=\{event =>/);
  assert.match(code, /data-testid="forza-swipe-instruction"/);
  assert.match(code, /\.closest\("\.sp-forza-contact__swipe, \.sp-forza-contact__swipe-cta"\)/);
  assert.match(code, /sp-forza-contact__arrow--bottom/);
  assert.match(code, /sp-forza-contact__arrow--middle/);
  assert.match(code, /sp-forza-contact__arrow--top/);
  const css = source("src/components/common/floating-quick-actions.css");
  assert.match(css, /\.sp-forza-contact__arrow--bottom \{ animation-delay: 0s; \}/);
  assert.match(css, /\.sp-forza-contact__arrow--middle \{ animation-delay: \.2s; \}/);
  assert.match(css, /\.sp-forza-contact__arrow--top \{ animation-delay: \.4s; \}/);
  assert.match(css, /@keyframes sp-forza-arrow-pulse/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(code, /event\.key === "Escape"/);
  assert.match(code, /document\.body\.style\.overflow = overflow/);
});

test("reference-designed FORZA mobile sheet is a full dark half-sheet without the decorative popup above it",()=>{
  const code=source("src/components/common/AiFloatingButton.tsx");
  const css=source("src/components/common/floating-quick-actions.css");
  assert.match(code,/sp-forza-contact__sheet--reference/);
  assert.doesNotMatch(code,/sp-forza-contact__chat-preview/);
  assert.doesNotMatch(css,/sp-forza-contact__chat-preview/);
  assert.match(code,/sp-forza-contact__swipe-copy/);
  assert.match(code,/صفحه را به بالا بکشید/);
  assert.match(code,/sp-forza-contact__channels/);
  assert.match(code,/sp-forza-contact__phone/);
  assert.match(css,/linear-gradient\(145deg,#203343/);
  assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/touch-action:none/);
  assert.doesNotMatch(code,/sp-forza-contact__workspace-button/);
});
