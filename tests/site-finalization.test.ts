import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("legacy catalog and FAQ links resolve to real destinations and unknown routes get a useful page", () => {
  const app = read("src/App.tsx");
  assert.ok(app.includes('path="*" element={<NotFoundPage />}'));
  assert.match(app, /path="\/faq"[\s\S]*Navigate to="\/knowledge"/);
  assert.match(app, /path="\*" element={<NotFoundPage \/>}/);
  assert.match(read("src/pages/NotFoundPage.tsx"), /to="\/products"/);
  assert.match(read("src/pages/NotFoundPage.tsx"), /to="\/categories"/);
});

test("homepage knowledge cards use published article slugs and do not advertise a missing PDF", () => {
  const homeKnowledge = read("src/components/home/HomeKnowledge.tsx");
  const legacyDiscovery = read("src/pages/DiscoveryPages.tsx");
  assert.match(homeKnowledge, /ARTICLES\.slice\(0, 4\)/);
  assert.ok(homeKnowledge.includes('to={`/knowledge/${article.slug}`}'));
  assert.match(homeKnowledge, /مشاهده کاتالوگ/);
  assert.doesNotMatch(homeKnowledge, /PDF - 12\.5MB|دانلود کاتالوگ/);
  assert.doesNotMatch(legacyDiscovery, /roller-wear|belt-selection|visual-inquiry|PDF - 12\.5MB/);
});

test("public contact form reports success only after a persisted server response", () => {
  const page = read("src/pages/ContactUsPage.tsx");
  const api = read("api/portal.ts");
  assert.match(page, /action: 'public_contact'/);
  assert.match(page, /if \(!response\.ok \|\| !data\?\.success\)/);
  assert.ok(page.indexOf("setIsSubmitted(true)") > page.indexOf("await response.json()"));
  assert.match(page, /submissionError/);
  assert.match(api, /body\.action === "public_contact"/);
  assert.match(api, /rateLimit\(req, "public-contact", 8\)/);
  assert.match(api, /x-real-ip/);
  assert.match(api, /source: "website_contact"/);
  assert.match(api, /db\.values\.atlas_admin_inquiries_v1 = \[inquiry/);
  assert.match(api, /await writeDb\(db, revision, false, \["atlas_admin_inquiries_v1"\]\)/);
});

test("footer exposes only configured contact routes and no fake trust or newsletter confirmations", () => {
  const footer = read("src/components/layout/Footer.tsx");
  assert.match(footer, /wa\.me\/989903427027/);
  assert.match(footer, /mailto:info@sanatpish\.com/);
  assert.match(footer, /to="\/knowledge"/);
  assert.doesNotMatch(footer, /instagram\.com|eitaa\.com|t\.me\//);
  assert.doesNotMatch(footer, /eNAMAD\.ir|EnamadEmblemSvg|سامانه ثبت/);
  assert.doesNotMatch(footer, /۳۰,۰۰۰ قلم کالا|ارسال رایگان سراسری|با موفقیت در سامانه اطلس ثبت شد/);
});

test("brand banner resolves category links from the approved live taxonomy", () => {
  const banner = read("src/components/home/MainBrandsBanner.tsx");
  assert.match(banner, /getManagedCategories/);
  assert.match(banner, /resolveCategorySlug/);
  assert.match(banner, /categoryHrefFor\('بلبرینگ و یاتاقان'/);
  assert.match(banner, /categoryHrefFor\('پولی و انتقال نیرو'/);
  assert.doesNotMatch(banner, /\/category\/power-transmission/);
});

test("brand search results open matching catalog results instead of the FORZA/SWR landing category", () => {
  const header = read("src/components/layout/Header.tsx");
  assert.ok(header.includes('to={`/products?q=${encodeURIComponent(b.name)}`}'));
  assert.ok(!header.includes('to={`/category/swr-forza-exclusive`}'));
});

test("known customer logos recover bundled assets instead of rendering empty sources", () => {
  const service = read("src/services/clientService.ts");
  assert.match(service, /DEFAULT_CLIENT_BY_ID/);
  assert.match(service, /storedLogo \|\| fallback\?\.logo/);
  assert.match(service, /entry\.logo\.trim\(\)\.length > 0/);
});

test("premium page styles are loaded without changing the homepage component", () => {
  const main = read("src/main.tsx");
  const index = read("src/index.css");
  const home = read("src/pages/HomePage.tsx");
  assert.match(main, /company-pages-art-direction\.css/);
  assert.match(main, /pages\/about-page-approved\.css/);
  assert.match(index, /catalogue-premium\.css/);
  assert.match(index, /industry-pages-premium\.css/);
  assert.match(index, /industry-art-direction\.css/);
  assert.match(home, /components\/home\/HomeKnowledge/);
});
