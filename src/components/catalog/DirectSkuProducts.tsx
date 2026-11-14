import React, { useEffect, useMemo, useState } from "react";
import { ProductCard } from "../product/ProductCard";
import { resolveDisplayBrand } from "../../utils/catalogBrands";
import type { Product, TechnicalSpec } from "../../types";

export type DirectSku = {
  skuCode: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  submenu: string;
  subcategory: string;
  brand: string;
  imageUrl: string | null;
  technicalSpecs: TechnicalSpec[];
  priceSnapshot: Record<string, unknown>;
  sourceFamilyCode?: string | null;
  active: boolean;
};

export function useDirectSkus() {
  const [items, setItems] = useState<DirectSku[]>([]);

  useEffect(() => {
    let alive = true;
    const refresh = () =>
      fetch("/api/catalog/direct-skus", {
        credentials: "same-origin",
        cache: "no-store",
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!alive || !data?.success || !Array.isArray(data.items)) return;
          const seen = new Set<string>();
          const next = (data.items as DirectSku[]).filter((item) => {
            const code = String(item?.skuCode || "").trim();
            if (!code || item.active === false || seen.has(code.toLowerCase())) return false;
            seen.add(code.toLowerCase());
            return true;
          });
          setItems(next);
        })
        .catch(() => {
          // Preserve the last successful catalogue snapshot during transient network errors.
        });

    void refresh();
    window.addEventListener("catalog-direct-skus-updated", refresh);
    return () => {
      alive = false;
      window.removeEventListener("catalog-direct-skus-updated", refresh);
    };
  }, []);

  return items;
}

export function toDirectSkuProduct(item: DirectSku): Product {
  const image = typeof item.imageUrl === "string" ? item.imageUrl : "";
  return {
    code: item.skuCode,
    name: item.name || item.skuCode,
    brand: resolveDisplayBrand(item.brand, item.name),
    categorySlug: item.categorySlug,
    categoryName: item.categoryName,
    submenu: item.submenu || "",
    subcategory: item.subcategory || "",
    technicalSpecs: Array.isArray(item.technicalSpecs) ? item.technicalSpecs : [],
    prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
    stock: 0,
    stockKnown: false,
    inquiryOnly: true,
    images: image ? [image] : [],
    image: image || undefined,
    tags: [],
    unit: "عدد",
    variants: [],
    active: item.active !== false,
    hasCatalogueImage: Boolean(image),
    imageScope: image ? "sku-verified" : undefined,
  };
}

export function directSkuMatchesSubcategory(item: DirectSku, selection = "all"): boolean {
  if (selection === "all") return true;
  const normalize = (value: string) =>
    String(value || "")
      .replace(/ي/g, "ی")
      .replace(/ك/g, "ک")
      .replace(/[\u200c\s]+/g, " ")
      .trim();
  const target = normalize(selection);
  return [item.submenu, item.subcategory].some((value) => normalize(value) === target);
}

export function DirectSkuProductCard({
  item,
  variant = "default",
  compareControl,
}: {
  item: DirectSku;
  variant?: "default" | "excel-grid" | "excel-list";
  compareControl?: React.ReactNode;
}) {
  const product = useMemo(() => toDirectSkuProduct(item), [item]);
  return (
    <ProductCard
      product={product}
      variant={variant}
      detailPath={"/direct-product/" + encodeURIComponent(item.skuCode)}
      disableSiteFallback
      compareControl={compareControl}
    />
  );
}

/**
 * Inline compatibility renderer. It deliberately emits only product cards:
 * no separate heading, panel or second catalogue section.
 */
export function DirectSkuProducts({
  categorySlug,
  selectedSub = "all",
  selectedBrands = [],
  search = "",
  imageOnly = false,
  inStockOnly = false,
  viewMode = "default",
}: {
  categorySlug: string;
  selectedSub?: string;
  selectedBrands?: string[];
  search?: string;
  imageOnly?: boolean;
  inStockOnly?: boolean;
  viewMode?: "default" | "excel-grid" | "excel-list";
}) {
  const all = useDirectSkus();
  const items = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fa-IR");
    return all.filter((item) => {
      if (item.categorySlug !== categorySlug || !directSkuMatchesSubcategory(item, selectedSub)) return false;
      if (selectedBrands.length && !selectedBrands.includes(resolveDisplayBrand(item.brand, item.name))) return false;
      if (imageOnly && !item.imageUrl) return false;
      // The public direct-SKU endpoint does not expose authoritative stock.
      if (inStockOnly) return false;
      if (query) {
        const haystack = [
          item.skuCode, item.name, item.brand, item.submenu, item.subcategory,
          ...(item.technicalSpecs || []).flatMap((spec) => [spec.key, spec.value]),
        ].join(" ").toLocaleLowerCase("fa-IR");
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [all, categorySlug, selectedSub, selectedBrands.join("|"), search, imageOnly, inStockOnly]);

  return (
    <>
      {items.map((item) => (
        <div className="catalogue-product-item-wrap" key={item.skuCode}>
          <DirectSkuProductCard item={item} variant={viewMode} />
        </div>
      ))}
    </>
  );
}
