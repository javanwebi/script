export interface FamilyMenuSemanticContext {
  familyCode?: string;
  familyName?: string | null;
  productType?: string | null;
  material?: string | null;
  profile?: string | null;
  categorySlug: string;
  submenuName?: string | null;
  leafName?: string | null;
}

export interface FamilyMenuSemanticValidation {
  valid: boolean;
  reason: string | null;
}

const normalize = (value: unknown): string =>
  String(value ?? '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200b-\u200f\ufeff\s]+/g, ' ')
    .trim()
    .toLocaleLowerCase('fa-IR');

const matches = (value: string, pattern: RegExp): boolean => pattern.test(value);

export function validateFamilyMenuAssignment(
  context: FamilyMenuSemanticContext
): FamilyMenuSemanticValidation {
  const familyName = normalize(context.familyName);
  const productType = normalize(context.productType);
  const material = normalize(context.material);
  const profile = normalize(context.profile);
  const submenu = normalize(context.submenuName);
  const leaf = normalize(context.leafName);
  const identity = [productType, familyName, profile].filter(Boolean).join(' ');

  const fail = (reason: string): FamilyMenuSemanticValidation => ({ valid: false, reason });
  if (productType === 'mixed' || material === 'mixed' || profile === 'mixed') {
    return fail('family_contains_mixed_technical_identity');
  }

  // Wheels must contain a wheel, gear or sprocket identity. Couplings transmit torque
  // between shafts but are not wheels, even when a source family was named incorrectly.
  if (context.categorySlug === 'excel-v2-9-4') {
    if (matches(identity, /کوپلینگ|کوبلینگ|coupling/)) return fail('wheel_category_contains_shaft_coupling');
    if (!matches(identity, /چرخ|چرخ.?دنده|چرخ.?زنجیر|دنده.?زنجیر|sprocket|gear|wheel|پالت.?آیزر/)) {
      return fail('wheel_category_product_type_mismatch');
    }
  }

  if (context.categorySlug === 'excel-v2-6-2') {
    const isGuide = matches(identity, /گاید|راهنما|ریل|نرده|guide|rail/);
    if (!isGuide) return fail('guide_category_product_type_mismatch');

    if (submenu === normalize('گاید تفلونی')) {
      if (!matches(material, /تفلون|ptfe|uhmwpe/)) return fail('teflon_guide_without_teflon_material');
    }

    if (submenu === normalize('نرده استیل')) {
      if (!matches(material, /استیل|stainless|ss\s*304|ss\s*316/)) {
        return fail('stainless_rail_without_stainless_material');
      }
    }
  }

  if (context.categorySlug === 'excel-v2-6-1') {
    if (!matches(identity, /ریل|گاید|راهنما|rail|guide/)) return fail('rail_category_product_type_mismatch');
    if (submenu === normalize('بر اساس جنس')) {
      if (matches(leaf, /استیل/) && !matches(material, /استیل|stainless|ss\s*304|ss\s*316/)) {
        return fail('stainless_rail_leaf_material_mismatch');
      }
      if (matches(leaf, /تفلون/) && !matches(material, /تفلون|ptfe|uhmwpe/)) {
        return fail('teflon_rail_leaf_material_mismatch');
      }
      if (matches(leaf, /آهنی/) && !matches(material, /فولاد|آهن|steel|carbon/)) {
        return fail('iron_rail_leaf_material_mismatch');
      }
      if (matches(leaf, /گالوانیزه/) && !matches(material, /گالوانیزه|galvanized/)) {
        return fail('galvanized_rail_leaf_material_mismatch');
      }
    }
  }

  if (context.categorySlug === 'excel-v2-7-1') {
    const rubberProduct = matches(identity, /لاستیک|الاستومر|ضربه.?گیر|مکنده|دیافراگم|گریپ|اورینگ|پکینگ|کاسه.?نمد|rubber|elastomer|bumper|suction|seal/);
    const elastomerMaterial = matches(material, /لاستیک|الاستومر|rubber|elastomer|nbr|epdm|fkm|viton|سیلیکون|silicone/);
    const explicitlyNonRubberMaterial = matches(material, /پلی.?وینیل.?کلراید|\bpvc\b|تفلون|\bptfe\b|uhmwpe|پلی.?آمید|polyamide|فولاد|آهن|steel|آلومینیوم|aluminum/);
    if (explicitlyNonRubberMaterial && !rubberProduct) return fail('rubber_category_non_rubber_material');
    if (!rubberProduct && !elastomerMaterial) return fail('rubber_category_product_type_or_material_mismatch');
  }

  if (context.categorySlug === 'excel-v2-9-3' && submenu === normalize('دستگیره و پیچ فلکه')) {
    if (!matches(identity, /دستگیره|پیچ.?فلکه|پیچ.?دسته.?دار|handwheel|knob|handle/)) {
      return fail('handle_category_product_type_mismatch');
    }
  }

  if (context.categorySlug === 'excel-v2-10-1' && submenu === normalize('اسپاتول سیلیکونی')) {
    if (!matches(identity, /اسپاتول|squeegee/)) return fail('spatula_leaf_product_type_mismatch');
  }

  return { valid: true, reason: null };
}
