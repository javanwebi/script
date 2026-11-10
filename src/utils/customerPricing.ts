export type CustomerPriceViewer = { canViewPrices?: boolean } | null | undefined;

export type ServerResolvedPrice = {
  price?: number | null;
  prices?: { retail?: number | null } | null;
  inquiryOnly?: boolean | null;
};

/**
 * Catalog prices are already resolved by the authenticated runtime endpoint
 * against the active customer price list. Never apply a second client-side
 * discount here: doing so can discount an already discounted price twice.
 */
export function hasCustomerPriceAccess(viewer: CustomerPriceViewer): boolean {
  return viewer?.canViewPrices === true;
}

export function getCurrentCustomerSkuPrice(
  source: ServerResolvedPrice,
  viewer: CustomerPriceViewer,
  inCustomerPortal: boolean,
): number {
  if (!inCustomerPortal || !hasCustomerPriceAccess(viewer) || source.inquiryOnly === true) {
    return 0;
  }
  const value = Number(source.price ?? source.prices?.retail ?? 0);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}
