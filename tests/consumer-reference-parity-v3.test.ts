import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read=(file:string)=>fs.readFileSync(path.resolve(process.cwd(),file),"utf8");
const shell=read("src/components/portal/PortalShell.tsx");
const page=read("src/pages/ConsumerDashboardPage.tsx");
const tools=read("src/components/portal/PortalTools.tsx");
const club=read("src/components/portal/PortalClub.tsx");
const art=read("src/components/portal/ConsumerReferenceArt.tsx");
const css=read("src/components/portal/consumer-reference-parity-v3.css");

test("every customer-reference section shares the existing authenticated portal",()=>{
  assert.match(shell,/variant === "consumer"/);
  assert.match(shell,/consumer-reference-parity-v3\.css/);
  assert.match(shell,/consumerSectionTitles/);
  for(const id of ["overview","orders","quick_buy","club_rewards","saved_products","purchase_list","receipts","addresses"]){
    assert.ok(shell.includes(id), "missing section "+id);
  }
  assert.match(shell,/m\.id === "orders" \? Layers : m\.id === "club_rewards" \? Award/);
  assert.match(shell,/consumer-reference-back/);
  assert.match(shell,/\["saved_products", "purchase_list"\]/);
  assert.match(shell,/select\("overview"\)/);
});

test("reference art is lightweight source SVG, not static fake orders or products",()=>{
  for(const comp of ["ParcelArt","InvoiceArt","MedalArt","LocationArt"]){
    assert.match(art,new RegExp("export function "+comp+"\\("));
  }
  assert.match(art,/useId/);
  assert.match(page,/<ParcelArt \/>/);
  assert.match(page,/<InvoiceArt \/>/);
  assert.match(page,/<LocationArt \/>/);
  assert.match(club,/<MedalArt \/>/);
  assert.match(page,/!activeOrder &&/);
  assert.match(page,/consumer-empty-timeline/);
  assert.match(page,/orderImageByCode\.get/);
  assert.match(page,/handleQuickAddProduct\(prod\)/);
  assert.match(page,/setSelectedReceiptOrder\(o\)/);
  assert.match(page,/handleSetDefaultAddress\(address\.id\)/);
  assert.match(tools,/resolvePurchaseLines\(text, catalog\)/);
  assert.match(tools,/consumer-saved-reference-grid/);
  assert.match(tools,/consumer-bulk-results/);
  assert.doesNotMatch(art,/SP-458721|6205-2RS|127,500,000/);
});

test("eight screens keep real data while using reference composition and correct icons",()=>{
  for(const selector of ["consumer-home-recommendations","consumer-home-product-grid","consumer-overview-shipment",
    "consumer-overview-tracker","consumer-quickbuy-grid","consumer-invoice-row",
    "consumer-order-reference-card","consumer-address-delivery-note","consumer-saved-forza-banner",
    "consumer-club-hero","consumer-bulk-hero"]){
    assert.ok(css.includes(selector),"Missing art direction for "+selector);
  }
  assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css,/max-width:767px/);
  assert.match(css,/max-width:375px/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/focus-visible/);
  assert.match(css,/direction:rtl/);
  assert.match(page,/suggestedProducts\.map\(\(prod\)/);
  assert.match(page,/catalog\.slice\(0, 2\)/);
  assert.match(page,/orders\.filter/);
  assert.match(page,/formatPrice\(totalSpent\)/);
  assert.match(page,/user\?\.addresses/);
  assert.match(club,/cms\.getClubMilestones\(portal\)/);
  assert.match(css,/consumer-address-panel > \.consumer-address-add \{order:3/);
});
