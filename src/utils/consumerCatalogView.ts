import type { Product } from "../types";

/** Search only published, actual catalog rows. SKU codes remain literal LTR identifiers. */
export function searchConsumerProducts(
  catalog: readonly Product[],
  query: string,
  categorySlug: string,
): Product[] {
  const normalized = query.trim().toLocaleLowerCase();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return catalog.filter((product) => {
    if (product.active === false || (categorySlug !== "all" && product.categorySlug !== categorySlug))
      return false;
    if (!tokens.length) return true;
    const haystack = [
      product.name,
      product.code,
      product.brand,
      product.categoryName,
      ...((product.variants || []).filter((variant) => variant.active !== false)
        .flatMap((variant) => [variant.code, variant.name, variant.model || ""])),
    ].join(" ").toLocaleLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

/** Reordering is always re-priced against the *current* live catalog.
 * Historical invoice unitPrice is intentionally not accepted as cart price.
 * A deleted/inactive/unknown variant cannot be silently substituted.
 */
export function resolveCurrentRetailReorder(
  code: string,
  quantity: number,
  findProduct: (code: string) => Product | undefined,
): { product: Product; quantity: number } | null {
  const normalized = code.trim().toLocaleLowerCase();
  const family = findProduct(code);
  if (!family || family.active === false || !Number.isFinite(quantity) || quantity <= 0)
    return null;

  const isFamily = family.code.toLocaleLowerCase() === normalized;
  const variant = isFamily
    ? undefined
    : family.variants?.find((item) => item.code.toLocaleLowerCase() === normalized);
  if (!isFamily && !variant) return null;
  // Families with variants require an exact currently published SKU choice.
  if (isFamily && family.variants?.some((item) => item.active !== false)) return null;
  if (variant && (variant.active === false || variant.inquiryOnly || (variant.stockKnown && (variant.stock ?? 0) <= 0))) return null;
  if (!variant && (family.inquiryOnly || (family.stockKnown && family.stock <= 0))) return null;

  const variantPrice = variant?.prices?.retail ?? variant?.price;
  const retail = variant ? variantPrice : family.prices?.retail;
  if (!Number.isFinite(retail) || !retail || retail <= 0) return null;

  const prices = variant?.prices
    ? { ...variant.prices, retail }
    : { ...family.prices, base: retail, retail, wholesale: retail, dealer: retail };

  return {
    product: {
      ...family,
      code: variant?.code || family.code,
      name: variant?.name || family.name,
      images: variant?.images?.length ? variant.images : family.images,
      prices,
      inquiryOnly: false,
    },
    quantity,
  };
}
