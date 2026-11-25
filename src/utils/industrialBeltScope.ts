type IndustrialBeltFamilyLike = {
  name?: string;
  nameEn?: string;
  subcategory?: string;
  submenu?: string;
  variants?: Array<{
    variableSpecs?: Record<string, unknown>;
    identitySpecs?: Record<string, unknown>;
  }>;
};

const BELT_TERMS = /تسمه|belt/i;
const NON_BELT_TERMS = /پولی|pulley|فلکه|قرقره|بلبرینگ|bearing|یاتاقان|دستگاه\s*جوش|تجهیزات?\s*جوش/i;
const BELT_PROFILE_MARKING = /\b(?:SPZ|SPA|SPB|SPC|XPZ|XPA|XPB|XPC|3VX?|5VX?|8VX?|AA|BB|CC|MXL|XL|XH|XXH|HTD|RPP|MEGASYNC|MEGAPOWER|STD|T2\.5|T5|T10|T20|AT2\.5|AT5|AT10|AT20|PJ|PK|PL|PM|PH|S5M|S8M|S14M|D5M|D8M|D14M)\b/i;

export function isIndustrialBeltProduct(product: IndustrialBeltFamilyLike): boolean {
  const label = [product.name, product.nameEn, product.subcategory, product.submenu].filter(Boolean).join(' ');
  if (NON_BELT_TERMS.test(label)) return false;
  const variants = product.variants || [];
  const divisions = variants.map(variant => String(variant.variableSpecs?.beltDivision || '').trim()).filter(Boolean);
  if (divisions.some(value => /^(?:non-belt-|service-ambiguous$|belt-welding-tool$)/i.test(value))) return false;
  const hasBeltDivision = variants.some(variant => {
    const division = String(variant.variableSpecs?.beltDivision || '');
    const productType = String(variant.identitySpecs?.productType || '');
    return /(?:belt|تسمه|vbelt|timing|ribbed|welded-pu)/i.test(division) || /تسمه|belt/i.test(productType);
  });
  return BELT_TERMS.test(label) || hasBeltDivision;
}

export function isIndustrialBeltDirectSku(item: {
  skuCode?: string;
  name?: string;
  subcategory?: string;
  submenu?: string;
}): boolean {
  const label = [item.name, item.subcategory, item.submenu].filter(Boolean).join(' ');
  if (NON_BELT_TERMS.test(label)) return false;
  return BELT_TERMS.test(label) || BELT_PROFILE_MARKING.test([item.skuCode, item.name].filter(Boolean).join(' '));
}
