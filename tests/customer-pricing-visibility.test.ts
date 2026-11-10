import test from "node:test";
import assert from "node:assert/strict";
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
