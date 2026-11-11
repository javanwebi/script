import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getCurrentCustomerSkuPrice,
  hasCustomerPriceAccess,
} from "../src/utils/customerPricing";

test("guest and public product pages never receive commercial prices", () => {
  const serverPrice = { price: 125000, prices: { retail: 125000 } };
  assert.equal(getCurrentCustomerSkuPrice(serverPrice, null, true), 0);
  assert.equal(getCurrentCustomerSkuPrice(serverPrice, { canViewPrices: true }, false), 0);
  assert.equal(getCurrentCustomerSkuPrice(serverPrice, { canViewPrices: false }, true), 0);
  assert.equal(hasCustomerPriceAccess(null), false);
});

test("authorized customers see the exact price already resolved by the server", () => {
  const serverPrice = { price: 125000, prices: { retail: 125000 } };
  assert.equal(getCurrentCustomerSkuPrice(serverPrice, { canViewPrices: true }, true), 125000);
  // A server-resolved price is returned unchanged; the browser must not discount it again.
  assert.equal(getCurrentCustomerSkuPrice({ price: 98000 }, { canViewPrices: true }, true), 98000);
});

test("SKU inquiry-only and missing or invalid prices stay on the inquiry path", () => {
  const customer = { canViewPrices: true };
  assert.equal(getCurrentCustomerSkuPrice({ price: 125000, inquiryOnly: true }, customer, true), 0);
  assert.equal(getCurrentCustomerSkuPrice({ price: 0, prices: { retail: 0 } }, customer, true), 0);
  assert.equal(getCurrentCustomerSkuPrice({ price: -10 }, customer, true), 0);
  assert.equal(getCurrentCustomerSkuPrice({ price: Number.NaN }, customer, true), 0);
  assert.equal(getCurrentCustomerSkuPrice({ prices: { retail: 73000 } }, customer, true), 73000);
});

test("customer portal price surfaces use server prices and never reapply browser price-list discounts", () => {
  const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
  const portalTools = read("src/components/portal/PortalTools.tsx");
  const portalCard = read("src/components/portal/PortalProductCard.tsx");
  const account = read("src/pages/AccountPage.tsx");
  const consumer = read("src/pages/ConsumerDashboardPage.tsx");
  const productDetail = read("src/pages/ProductDetailPage.tsx");
  const publicCard = read("src/components/product/ProductCard.tsx");
  const cart = read("src/context/CartContext.tsx");

  assert.match(portalTools, /getCurrentCustomerSkuPrice/);
  assert.doesNotMatch(portalTools, /getSkuPriceForList/);
  assert.match(portalTools, /memberPath\(currentUser, p\.code\)/);
  assert.match(portalCard, /getCurrentCustomerSkuPrice/);
  assert.doesNotMatch(portalCard, /getSkuPriceForList/);
  assert.match(account, /canViewCustomerPrices/);
  assert.match(account, /sku\.basePrice/);
  assert.match(consumer, /getCurrentCustomerSkuPrice/);
  assert.match(productDetail, /currentUser\.canViewPrices === true/);
  // A customer with price access but without quick-order permission must still
  // be able to submit an inquiry on mobile when stock is unavailable.
  assert.match(productDetail, /disabled=\{buyingAllowed && isSelectedStockKnown && activeStockCount <= 0\}/);
  assert.ok(consumer.includes('to={`/consumer-dashboard/product/${encodeURIComponent(prod.code)}`}'));

  assert.match(publicCard, /location\.pathname\.startsWith\("\/consumer-dashboard\/"\)/);
  assert.match(publicCard, /const href = isCustomerPortalRoute && currentUser/);
  assert.doesNotMatch(publicCard, /const href = hasPricePermission/);
  assert.match(publicCard, /product\.galleryImages\?\.find\(image => image\.scope === "family" && image\.url\)/);
  assert.match(publicCard, /src=\{productImage\}/);
  assert.match(publicCard, /identityVerified === true/);
  assert.match(cart, /subscribeCatalogChanges/);
  assert.match(cart, /resolvePurchaseLines/);
  assert.match(cart, /currentUser\?\.canViewPrices === true/);
  assert.match(cart, /refreshCommercialSnapshot/);
});
