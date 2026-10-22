import type { Product } from "../types";
export interface PurchaseLine {
  code: string;
  quantity: number;
  product?: Product;
  error?: string;
}
export function resolvePurchaseLines(
  text: string,
  products: Product[],
): PurchaseLine[] {
  const index = new Map<string, Product>();
  for (const product of products) {
    if (product.active === false) continue;
    index.set(product.code.toLowerCase(), product);
    for (const v of product.variants || []) {
      if (v.active === false) continue;
      const price = v.price ?? v.prices?.retail ?? 0;
      index.set(v.code.toLowerCase(), {
        ...product,
        code: v.code,
        name: v.name,
        images: v.images?.length ? v.images : product.images,
        technicalSpecs: [
          ...(v.technicalSpecs || []),
          ...(v.size ? [{ key: "سایز", value: v.size }] : []),
        ],
        prices: v.prices || {
          base: price,
          retail: price,
          wholesale: price,
          dealer: price,
        },
        inquiryOnly: v.inquiryOnly ?? price <= 0,
        stock: v.stock ?? 0,
        stockKnown: v.stockKnown ?? false,
        unit: v.unit || product.unit,
        variants: undefined,
      });
    }
  }
  const normalized = text
    .replace(/[۰-۹]/g, (x) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(x)))
    .replace(/[٠-٩]/g, (x) => String("٠١٢٣٤٥٦٧٨٩".indexOf(x)));
  return normalized
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 100)
    .map((line) => {
      const parts = line.split(/[,،;\t\s]+/).filter(Boolean);
      const code = parts[0] || "";
      const quantity = parts.length === 1 ? 1 : Number(parts[1]);
      const product = index.get(code.toLowerCase());
      return {
        code,
        quantity,
        product,
        error:
          parts.length > 2 ||
          !Number.isSafeInteger(quantity) ||
          quantity < 1 ||
          quantity > 9999
            ? "تعداد باید عددی بین ۱ تا ۹۹۹۹ باشد."
            : !product
              ? "این کد در کاتالوگ پیدا نشد."
              : product.variants?.length
                ? "برای این خانواده، کد دقیق کالا را انتخاب کنید."
                : undefined,
      };
    });
}
