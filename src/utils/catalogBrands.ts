export interface BrandSource {
  brand?: string | null;
  name?: string | null;
  variants?: Array<{
    brand?: string | null;
    name?: string | null;
    model?: string | null;
    code?: string | null;
    active?: boolean;
  }> | null;
}

const PLACEHOLDER_BRANDS = new Set([
  "ثبت نشده", "نامشخص", "بدون برند", "خارجی", "وارداتی صنعتی",
  "صنعت پیش", "unknown", "n/a", "na", "-", "عمومی", "بدون نام",
]);

export function normalizeCatalogBrand(value: string): string {
  return String(value || "")
    .toLocaleLowerCase("fa-IR")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200c\s]+/g, " ")
    .trim();
}

/**
 * Returns a real manufacturer label only.
 * Origin/placeholders and the Sanat Pish retailer name are never emitted as brands.
 */
export function resolveDisplayBrand(rawBrand?: string | null, name?: string | null): string {
  const cleaned = String(rawBrand || "").trim();
  const searchable = `${cleaned} ${String(name || "")}`;

  const known: Array<[RegExp, string]> = [
    [/\bswr\b/i, "SWR"],
    [/\bforza\b|فورزا/i, "FORZA"],
    [/optibelt|اپتی.?بلت|اپتی\b/i, "Optibelt"],
    [/megadyne|مگداین|مگادین/i, "Megadyne"],
    [/\bgates\b|گیتس/i, "Gates"],
    [/continental|contitech|کنتیننتال|کنتی.?تک/i, "Continental (ContiTech)"],
    [/\bskf\b/i, "SKF"],
    [/\bfag\b|\bina\b|فاگ|اینا/i, "FAG / INA"],
    [/habasit|هاباست/i, "Habasit"],
    [/atlas\s*industrial|اطلس\s*صنعتی/i, "Atlas Industrial"],
    [/\bbando\b|باندو/i, "Bando"],
    [/dongil|دانگیل/i, "Dongil"],
    [/mitsuboshi|میتسوبوشی/i, "Mitsuboshi"],
    [/dayco|دایکو/i, "Dayco"],
    [/chiaravalli|چیاراوالی/i, "Chiaravalli"],
  ];

  for (const [pattern, label] of known) {
    if (pattern.test(searchable)) return label;
  }

  if (!cleaned || PLACEHOLDER_BRANDS.has(normalizeCatalogBrand(cleaned))) return "";
  return cleaned;
}

/** Real brands found on the family and its active SKU records. */
export function getProductDisplayBrands(product: BrandSource): string[] {
  const candidates = [
    resolveDisplayBrand(product.brand, product.name),
    ...(product.variants || [])
      .filter((variant) => variant.active !== false)
      .map((variant) =>
        resolveDisplayBrand(
          variant.brand,
          [variant.name, variant.model, variant.code].filter(Boolean).join(" "),
        ),
      ),
  ];

  const seen = new Set<string>();
  return candidates.filter((brand) => {
    if (!brand) return false;
    const key = normalizeCatalogBrand(brand);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function productHasDisplayBrand(product: BrandSource, selectedBrand: string): boolean {
  const target = normalizeCatalogBrand(selectedBrand);
  if (!target) return false;
  return getProductDisplayBrands(product).some(
    (brand) => normalizeCatalogBrand(brand) === target,
  );
}
