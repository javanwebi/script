import type { Product } from "../types";

export type CatalogListingProduct = Omit<Product, "variants" | "galleryImages"> & {
  variantCount: number;
  searchText: string;
};

export function toCatalogListingProduct(product: Product): CatalogListingProduct {
  const variants = (product.variants || []).filter((variant) => variant.active !== false);
  const image =
    product.images?.find(Boolean) ||
    product.image ||
    product.galleryImages?.find((entry) => entry.scope === "family")?.url ||
    product.galleryImages?.[0]?.url;

  const searchParts: string[] = [];
  const add = (value: unknown) => {
    if (typeof value === "string" && value.trim()) searchParts.push(value.trim());
  };
  add(product.code); add(product.name); add(product.nameEn); add(product.brand);
  add(product.categoryName); add(product.categorySlug); add(product.subcategory); add(product.submenu);
  for (const tag of product.tags || []) add(tag);
  for (const spec of product.technicalSpecs || []) { add(spec.key); add(spec.value); }
  for (const variant of variants) {
    add(variant.code); add(variant.name); add(variant.size); add(variant.model); add(variant.brand);
    for (const spec of variant.technicalSpecs || []) { add(spec.key); add(spec.value); }
  }

  return {
    code: product.code,
    name: product.name,
    nameEn: product.nameEn,
    brand: product.brand || "",
    categorySlug: product.categorySlug,
    categoryName: product.categoryName,
    category: product.category,
    subcategory: product.subcategory || "",
    submenu: product.submenu,
    technicalSpecs: [],
    prices: product.prices || { base: 0, retail: 0, wholesale: 0, dealer: 0 },
    stock: Number.isFinite(product.stock) ? product.stock : 0,
    stockKnown: product.stockKnown === true,
    inquiryOnly: product.inquiryOnly !== false,
    rating: product.rating,
    images: image ? [image] : [],
    image,
    tags: product.tags || [],
    unit: product.unit || "عدد",
    featured: product.featured,
    hasCatalogueImage: product.hasCatalogueImage,
    imageScope: product.imageScope,
    active: product.active,
    updatedAt: product.updatedAt,
    variantCount: variants.length,
    searchText: searchParts.join(" "),
  };
}
