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
