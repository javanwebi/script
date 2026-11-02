/** Public catalog metadata must never carry commercial fields, including nested SKUs. */
const commercialKeys = new Set([
  "price",
  "prices",
  "retail",
  "wholesale",
  "dealer",
  "base",
  "stock",
  "stockKnown",
  "inquiryOnly",
  "unitPrice",
  "calculatedPrice",
  "discountPercent",
  "creditLimit",
]);
export function publicCatalog<T>(input: T): T {
  if (Array.isArray(input)) return input.map(publicCatalog) as T;
  if (input && typeof input === "object")
    return Object.fromEntries(
      Object.entries(input)
        .filter(([key]) => !commercialKeys.has(key))
        .map(([key, value]) => [key, publicCatalog(value)]),
    ) as T;
  return input;
}

/** Keep the public catalogue searchable but defer bulky per-SKU technical reports. */
export function compactCatalogReviews<T>(input: T): T {
  if (!Array.isArray(input)) return input;
  return input.map((family) => {
    if (!family || typeof family !== 'object' || !Array.isArray(family.variants)) return family;
    return {
      ...family,
      variants: family.variants.map((variant: unknown) => {
        if (!variant || typeof variant !== 'object') return variant;
        const { technicalReview: _deferredReview, ...summary } = variant as Record<string, unknown>;
        return summary;
      }),
    };
  }) as T;
}
