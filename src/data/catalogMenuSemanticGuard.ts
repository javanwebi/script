import { APPROVED_MENU_CATEGORIES } from './approvedMenuFallback';

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

  // Every published family must point to a real approved Excel category and submenu.
  // When a leaf is supplied it must be an exact child of that submenu.
  const approvedCategory = APPROVED_MENU_CATEGORIES.find((item) => item.slug === context.categorySlug);
  if (!approvedCategory) return fail('unapproved_category_slug');
  const approvedSubmenu = (approvedCategory.children || []).find(
    (item) => normalize(item.name) === submenu
  );
  if (!approvedSubmenu) return fail('unapproved_submenu');
  if (leaf) {
    const approvedLeaf = (approvedSubmenu.children || []).some(
      (item) => normalize(item.name) === leaf
    );
    if (!approvedLeaf) return fail('unapproved_leaf');
  }

  // Industrial belt families need both a valid Excel path and a matching engineering identity.
  const profileCode = profile.replace(/-banded$/, '').replace(/[^a-z0-9]/g, '');
  const isTiming = matches(identity, /تسمه تایمینگ|timing|synchronous|htd|rpp|at5|at10|at20|\bt5\b/);
  const isPuMaterial = matches(material, /پلی.?یورتان|polyurethane|thermoplastic.?pu|\btpu\b|\bpu\b/);
  const isWeldedPuVSection =
    isPuMaterial &&
    ['a', 'b', 'c', 'brb'].includes(profileCode) &&
    matches(identity, /تسمه\s*جوشی|welded.{0,24}belt/);
  const hasVbeltProfile = [
    'z', 'zx', 'm', 'mx', 'a', 'ax', 'b', 'bx', 'c', 'cx', 'd', 'e', '8v', '8vx',
    'spz', 'xpz', 'spa', 'xpa', 'spb', 'xpb', 'spc', 'xpc', '3v', '3vx', '5v', '5vx', '8v', '8vx',
    'aa', 'bb', 'cc', 'k'
  ].includes(profileCode);
  // Welded PU V-sections are a separate engineering division, not rubber V-belts.
  const isVbelt = (matches(identity, /تسمه(?:\s+جوشی)?\s*v|وی.?بلت|v.?belt|v شکل/) || hasVbeltProfile) && !isWeldedPuVSection;
  const isPolyV = matches(identity, /چندشیاری|poly.?v|multi.?rib/);
  const isRubberMaterial = matches(material, /لاستیک|الاستومر|rubber|elastomer|nbr|epdm|fkm|viton|neoprene|کلروپرن/);
  const isRidgeTop = matches(identity, /تاج.?دار|گرد\s*ه?\s*ماهی|ridge.?top|crowned/);
  const isExplicitWeldedRound =
    !isRidgeTop && matches(identity, /تسمه.{0,12}جوشی|welded.{0,24}belt/) && matches(identity, /گرد|round/) &&
    ['round', 'crc'].includes(profileCode);
  const isWeldingDevice = matches(identity, /دستگاه.*(?:جوش|آپارات).*تسمه|گیره.*آپارات.*تسمه|belt.*weld.*device/);
  const isConveyorBelt = matches(identity, /نوار نقاله|تسمه بارکش|تسمه نقاله|conveyor|belt conveyor|گریپ.?آجدار/);
  const isNonBeltItem = matches(identity, /دستگاه پولیش|دستگاه تزریق|تسمه سفت.?کن|belt.?tensioner|tensioner|تسمه پاک.?کن|belt.?cleaner|scraper|اسکریپر|تیغه فلزی|تسمه آهنی/);

  if (context.categorySlug === 'excel-v2-1-1') {
    if (!isTiming || isVbelt || isPolyV || isNonBeltItem) {
      return fail('timing_category_product_type_mismatch');
    }
    if (matches(identity, /auto.?ru|auto.?8mm|zrk|خودرویی|لیفتراکی/)) {
      return fail('automotive_timing_outside_industrial_menu');
    }

    if (submenu === normalize('سیم‌دار فابریک')) {
      if (leaf === normalize('پلی‌یورتان') && !isPuMaterial) {
        return fail('polyurethane_timing_leaf_without_pu_material');
      }
      if (leaf === normalize('APL دار') && !matches(identity, /apl|گریپ|روکش|coating/)) {
        return fail('apl_timing_leaf_without_coating_identity');
      }
    }

    if (submenu === normalize('لاستیکی فابریک') && !isRubberMaterial) {
      return fail('rubber_timing_leaf_without_rubber_material');
    }

    if (submenu === normalize('انواع گام و کدهای تایمینگ')) {
      if (profileCode === '3m' && isRubberMaterial) {
        return fail('rubber_3m_timing_must_use_rubber_submenu');
      }
      if (leaf && ['t10', 't20', '3m', 'mxl'].includes(profileCode)) {
        return fail('timing_profile_without_exact_approved_leaf');
      }
      if (leaf === normalize('T5 , AT5 , AT10 , AT20') && !['t5', 'at5', 'at10', 'at20'].includes(profileCode)) {
        return fail('metric_timing_leaf_profile_mismatch');
      }
      if (leaf === normalize('H , XH , L , XL') && !['h', 'xh', 'l', 'xl'].includes(profileCode)) {
        return fail('imperial_timing_leaf_profile_mismatch');
      }
      if (
        leaf === normalize('5M , 8M , 11M , 14M') &&
        !['5m', '8m', '11m', '14m', 'rpp8m', 'rpp14m'].includes(profileCode)
      ) {
        return fail('curvilinear_timing_leaf_profile_mismatch');
      }
    }
  }

  if (context.categorySlug === 'excel-v2-1-2') {
    if (!isVbelt || isPolyV) return fail('vbelt_category_product_type_mismatch');
    if (['aa', 'bb', 'k'].includes(profileCode)) return fail('vbelt_profile_without_approved_leaf');

    if (submenu === normalize('وی‌بلت متری') && !['a', 'b', 'c', 'aperforated', 'bperforated', 'cperforated'].includes(profileCode)) {
      return fail('vbelt_meter_leaf_profile_mismatch');
    }

    if (
      submenu === normalize('کلاسیک و دنده‌دار') &&
      !['z', 'zx', 'm', 'mx', 'a', 'ax', 'b', 'bx', 'c', 'cx', 'd', 'e', '8v', '8vx'].includes(profileCode)
    ) {
      return fail('vbelt_classical_leaf_profile_mismatch');
    }
    if (leaf && submenu === normalize('کلاسیک و دنده‌دار') &&
      !['z', 'zx', 'm', 'a', 'ax', 'b', 'bx', 'c', 'cx', 'd', 'e', '8v', '8vx'].includes(profileCode)) {
      return fail('vbelt_classical_leaf_profile_mismatch');
    }

    if (
      submenu === normalize('تسمه اسپشیال') &&
      !['spz', 'xpz', 'spa', 'xpa', 'spb', 'xpb', 'spc', 'xpc', '3v', '3vx', '5v', '5vx', '8v', '8vx'].includes(profileCode)
    ) {
      return fail('vbelt_special_leaf_profile_mismatch');
    }
    if (leaf && submenu === normalize('تسمه اسپشیال') &&
      !['xpz', 'spa', 'xpa', 'spb', 'xpb', 'spc', 'xpc'].includes(profileCode)) {
      return fail('vbelt_special_leaf_profile_mismatch');
    }
  }

  if (context.categorySlug === 'excel-v2-1-3') {
    // Explicit round-welded identity is sufficient for the approved CRC menu path.
    // Polymer grade, hardness, cord construction and exact manufacturer series remain unverified.
    if (!isPuMaterial && !isExplicitWeldedRound) return fail('welded_round_category_without_explicit_round_identity');
    if (isRidgeTop) return fail('ridge_top_belt_is_not_welded_pu');
    if (submenu === normalize('تسمه گرد (CRC)') && !['crc', 'round'].includes(profileCode)) {
      return fail('welded_round_leaf_profile_mismatch');
    }
    if (submenu === normalize('تسمه فلت') && (['a', 'b', 'c', 'brb'].includes(profileCode) || !['flat', 'f'].includes(profileCode))) {
      return fail('welded_flat_leaf_profile_mismatch');
    }
  }

  if (context.categorySlug === 'excel-v2-1-4') {
    if (submenu === normalize('تسمه بارکش') && !isRidgeTop && !isConveyorBelt) {
      return fail('hauling_belt_leaf_requires_crowned_conveyor_identity');
    }
    if (isNonBeltItem) return fail('belt_equipment_category_contains_non_belt_item');
    if (submenu === normalize('دستگاه‌های تسمه جوشی') && !isWeldingDevice) {
      return fail('belt_welding_equipment_leaf_product_type_mismatch');
    }
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
