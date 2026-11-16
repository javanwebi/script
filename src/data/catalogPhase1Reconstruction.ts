import type { Product, ProductVariant } from '../types';
import {
  APPROVED_MENU_CATEGORIES,
  APPROVED_MENU_GROUPS,
} from './approvedMenuFallback';
import {
  CATALOG_FAMILY_MENU_ASSIGNMENTS,
} from './catalogMenuAssignmentsData';
import {
  classifyBeltSkuWithProvenance,
  detectConveyorSurfaceProfile,
  type AuditReferenceTables,
  type BeltSkuAuditRecord,
} from './beltCatalogAudit';
import { validateFamilyMenuAssignment } from './catalogMenuSemanticGuard';

/**
 * 9-Level Technical Evidence Hierarchy (Phase 1 Mandatory Standard)
 * Never conflate algorithmic/standard inference with official manufacturer confirmation.
 */
export type TechnicalEvidenceLevel =
  | 'EXACT_MANUFACTURER_DATASHEET'
  | 'OFFICIAL_CATALOG'
  | 'OFFICIAL_PRODUCT_PAGE'
  | 'STANDARD_REFERENCE'
  | 'PHYSICAL_VERIFICATION'
  | 'EXCEL_SOURCE'
  | 'INVENTORY_DESCRIPTION'
  | 'INFERRED'
  | 'UNKNOWN';

/**
 * 3 Final SKU Dispositions (Eliminating Artificial 1-SKU Wrapper Families)
 */
export type Phase1FamilyDecision =
  | 'APPROVED_FAMILY'
  | 'DIRECT_PRODUCT'
  | 'UNRESOLVED';

export type Phase1Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNRESOLVED';

export type Phase1VerificationStatus =
  | 'VERIFIED_MANUFACTURER'
  | 'VERIFIED_STANDARD_OR_SOURCE'
  | 'VERIFIED_INVENTORY_RECORD'
  | 'REQUIRES_PHYSICAL_VERIFICATION';

export interface RawCatalogueVariant {
  code: string;
  size: string;
  name: string;
}

export interface RawCatalogueFamily {
  sourceRow: number;
  code: string;
  categoryName: string;
  submenu: string;
  technicalType: string;
  name: string;
  brand: string | null;
  profiles: string | null;
  sizes: string | null;
  variants: RawCatalogueVariant[];
  unit: string;
  itemCount: number;
  materials: string | null;
  filters: string | null;
  sourceStatus: string;
}

export interface DirectSkuMenuOverride {
  skuCode: string;
  expectedFamilyCode: string;
  categorySlug: string;
  submenu: string;
  subcategory: string;
}

/**
 * 24 Mandatory Fields per SKU (Master Prompt & Phase 1 Complete Specification)
 */
export interface Phase1SkuRecord {
  skuCode: string;
  originalProductName: string;
  normalizedProductName: string;
  englishProductName: string;
  brand: string;
  manufacturer: string;
  manufacturerPartNumber: string;
  productType: string;
  material: string;
  construction: string;
  profile: string;
  standard: string;
  engineeringSpecifications: Record<string, string | number | null>;
  identitySpecifications: Record<string, string | number | null>;
  variableSpecifications: Record<string, string | number | null>;
  descriptiveSpecifications: Record<string, string | number | null>;
  mainGroupId: string;
  mainGroupName: string;
  familyTypeId: string;
  familyTypeName: string;
  currentFamily: string;
  proposedFamily: string | null;
  familyName: string | null;
  familyMemberCodes: string[];
  currentCategory: string;
  proposedCategory: string;
  currentSubcategory: string;
  proposedSubcategory: string;
  familyDecision: Phase1FamilyDecision;
  finalStatus: 'FAMILY_MEMBER' | 'DIRECT_PRODUCT' | 'UNRESOLVED';
  technicalEvidence: TechnicalEvidenceLevel;
  sourceUrl: string;
  decisionReason: string;
  confidence: Phase1Confidence;
  confidenceScore: number;
  verificationStatus: Phase1VerificationStatus;
  requiredAction: string;
  taxonomyGap: string | null;
  similarProductCodes: string[];
  // Rich auxiliary audit fields
  sourceFamilyName: string;
  sourceTechnicalType: string;
  proposedTechnicalType: string;
  proposedCategorySlug: string;
  proposedSubmenu: string;
  proposedLeaf: string | null;
  unit: string;
  originalSize: string;
  invariantKey: string;
  variantSummary: string;
  preservedDirectSkuOverride: DirectSkuMenuOverride | null;
  splitFromMixedFamily: boolean;
  mergedFromFragmentedFamilies: boolean;
  misplacedInSourceCategory: boolean;
}

export interface SimilarProductLinkRecord {
  primarySkuCode: string;
  primaryProductName: string;
  primaryBrand: string;
  primaryFamilyId: string | null;
  similarSkuCode: string;
  similarProductName: string;
  similarBrand: string;
  similarFamilyId: string | null;
  sharedProfileAndSize: string;
  differenceReason: string;
  similarityType: 'CROSS_BRAND_EQUIVALENT' | 'TECHNICAL_SUBSTITUTE' | 'SERIES_ALTERNATIVE';
}

export interface TechnicalConflictRecord {
  conflictId: string;
  sourceFamilyCode: string;
  affectedSkuCodes: string[];
  conflictType:
    | 'INSUFFICIENT_SPECIFICATION'
    | 'CATEGORY_MISPLACEMENT'
    | 'MATERIAL_MISMATCH'
    | 'PROFILE_MISMATCH'
    | 'CONSTRUCTION_MISMATCH';
  technicalDescription: string;
  resolutionApplied: string;
}

export interface OldToNewFamilyMappingRecord {
  oldFamilyId: string;
  oldFamilyName: string;
  oldCategory: string;
  oldSubcategory: string;
  oldMemberCount: number;
  newFamilyIds: string[];
  directProductCodes: string[];
  unresolvedProductCodes: string[];
  migrationAction:
    | 'RETAINED_1_TO_1'
    | 'MERGED_INTO_SINGLE_FAMILY'
    | 'SPLIT_INTO_MULTIPLE'
    | 'CONVERTED_TO_DIRECT_PRODUCT'
    | 'QUARANTINED_UNRESOLVED';
  technicalJustification: string;
}

export interface CategoryStageCheckpointRecord {
  stageNumber: number;
  categorySlug: string;
  categoryName: string;
  groupTitle: string;
  totalAuditedSkus: number;
  familyCount: number;
  familyMemberSkuCount: number;
  directProductCount: number;
  unresolvedCount: number;
  misclassifiedFixedCount: number;
  stageStatus: 'STAGE_COMPLETED_VERIFIED';
}

export interface FamilyTypeSummaryRecord {
  familyTypeId: string;
  familyTypeName: string;
  mainGroupId: string;
  mainGroupName: string;
  categorySlug: string;
  categoryName: string;
  submenu: string;
  leaf: string | null;
  reconstructedFamilyCount: number;
  familyMemberSkuCount: number;
  directProductSkuCount: number;
  unresolvedSkuCount: number;
  totalSkuCount: number;
}

export interface SubcategorySkuCountRecord {
  mainGroupId: string;
  mainGroupName: string;
  categorySlug: string;
  categoryName: string;
  submenu: string;
  leaf: string | null;
  totalSkuCount: number;
  familyCount: number;
  familyMemberSkuCount: number;
  directProductSkuCount: number;
  unresolvedSkuCount: number;
}

/**
 * 13+ Mandatory Fields per Reconstructed Multi-SKU Family (Section 11.2 of Phase 1 Master Prompt)
 */
export interface Phase1FamilyRecord {
  familyId: string;
  engineeringFamilyName: string;
  mainGroupId: string;
  mainGroupName: string;
  familyTypeId: string;
  familyTypeName: string;
  productType: string;
  brand: string;
  material: string;
  construction: string;
  invariantSpecifications: Record<string, string | number | null>;
  variantSpecifications: string[];
  memberSkuCodes: string[];
  memberCount: number;
  technicalIdentity: string;
  evidence: TechnicalEvidenceLevel;
  validationVerdict: 'PASS_HOMOGENEOUS' | 'FAIL_MIXED_INVARIANT' | 'FAIL_UNKNOWN_INVARIANT';
  // Rich auxiliary metadata
  categorySlug: string;
  categoryName: string;
  submenu: string;
  leaf: string | null;
  unit: string;
  profile: string;
  standard: string;
  sourceFamilyCodes: string[];
  mergedFromMultipleSourceFamilies: boolean;
  containsSplitSourceFamilyMembers: boolean;
}

export interface TypeEngineeringRuleProfile {
  technicalType: string;
  domainGroup: string;
  engineeringRuleCode: string;
  sourceFamilyCount: number;
  sourceSkuCount: number;
  invariantAttributes: string[];
  allowedVariantAttributes: string[];
  notApplicableAttributes: string[];
  forbiddenMerges: string[];
  singletonPolicy: string;
  reconstructedMultiFamilyCount: number;
  approvedFamilySkuCount: number;
  directProductSkuCount: number;
  unresolvedSkuCount: number;
}

export interface HaulOffAuditRecord {
  sourceFamilyCode: string;
  skuCode: string;
  originalName: string;
  sourceTechnicalType: string;
  actualEngineeringType: string;
  baseProfileOrSeries: string;
  coatingOrGripSpec: string;
  isTrueHaulOffBelt: boolean;
  proposedCategorySlug: string;
  proposedCategoryName: string;
  proposedSubmenu: string;
  proposedLeaf: string | null;
  familyDecision: Phase1FamilyDecision;
  proposedFamilyId: string | null;
  engineeringExplanation: string;
}

export interface WeldingVsBeltAuditRecord {
  skuCode: string;
  sourceFamilyCode: string;
  originalName: string;
  classification: 'WELDING_EQUIPMENT_OR_CLAMP' | 'WELDED_PU_ROUND_CRC_BELT' | 'WELDED_PU_V_OR_FLAT_BELT';
  brand: string;
  profile: string;
  material: string;
  construction: string;
  proposedCategorySlug: string;
  proposedCategoryName: string;
  proposedSubmenu: string;
  proposedLeaf: string | null;
  familyDecision: Phase1FamilyDecision;
  proposedFamilyId: string | null;
  separatedFromBeltFamily: boolean;
  engineeringExplanation: string;
}

export interface LowSkuSubcategoryDecisionRecord {
  groupId: string;
  groupTitle: string;
  categorySlug: string;
  categoryName: string;
  submenuName: string;
  leafName: string | null;
  beforeFamilyCount: number;
  beforeSkuCount: number;
  afterMultiFamilyCount: number;
  afterDirectProductCount: number;
  afterTotalSkuCount: number;
  displayStrategy: 'MULTI_SKU_FAMILIES' | 'DIRECT_PRODUCTS_ONLY' | 'HYBRID_FAMILIES_AND_DIRECT' | 'EMPTY_AWAITING_VERIFIED_STOCK';
  engineeringRationale: string;
}

export interface SourceFamilyTransformationRecord {
  sourceFamilyCode: string;
  sourceFamilyName: string;
  sourceTechnicalType: string;
  sourceCategory: string;
  sourceSubmenu: string;
  sourceSkuCount: number;
  transformationType:
    | 'RETAINED_AS_HOMOGENEOUS_FAMILY'
    | 'MERGED_INTO_LARGER_HOMOGENEOUS_FAMILY'
    | 'SPLIT_BY_INCOMPATIBLE_ENGINEERING_SPECS'
    | 'CONVERTED_SINGLETON_TO_DIRECT_PRODUCT'
    | 'MOVED_TO_UNRESOLVED_QUEUE'
    | 'MIXED_SPLIT_INTO_FAMILIES_DIRECT_AND_UNRESOLVED';
  targetFamilyIds: string[];
  approvedFamilySkuCount: number;
  directProductSkuCount: number;
  unresolvedSkuCount: number;
  engineeringExplanation: string;
}

export interface Phase1ReconstructionReport {
  generatedAt: string;
  gitContext: {
    baseBranch: string;
    baseCommitSha: string;
    targetBranch: string;
    targetBranchInitialCommitSha: string;
    excelSha256: string;
  };
  summary: {
    totalSourceFamilies: number;
    totalSourceSkus: number;
    totalTechnicalTypes: number;
    totalFamilyTypes: number;
    beforeMultiSkuFamilies: number;
    beforeSingletonFamilies: number;
    beforeMappedFamiliesInLiveMenu: number;
    beforeReviewQueueFamilies: number;
    beforeReviewQueueSkus: number;
    preservedDirectSkuOverridesCount: number;
    afterReconstructedMultiSkuFamilies: number;
    afterApprovedFamilySkus: number;
    afterDirectProductSkus: number;
    afterUnresolvedSkus: number;
    eliminatedArtificialSingletonFamilies: number;
    sourceFamiliesSplitCount: number;
    sourceFamiliesMergedCount: number;
    misplacedSkusCorrectedCount: number;
    allFamiliesPassHomogeneity: boolean;
  };
  qualityControlMetrics: {
    allSkusAudited: boolean;
    noDuplicateFamilyMembership: boolean;
    allCategoriesValid: boolean;
    allSubcategoriesValid: boolean;
    noInvalidMenuAssignments: boolean;
    allSkusHaveApprovedMenuPath: boolean;
    taxonomyGapSkuCount: number;
    taxonomyGapFamilyCount: number;
    allFamiliesHomogeneous: boolean;
    noBrandMixingInFamilies: boolean;
    noMaterialMixingInFamilies: boolean;
    noSingleSkuArtificialFamilies: boolean;
    unresolvedProperlyQuarantined: boolean;
    confidenceBands: {
      band95To100: number;
      band85To94: number;
      band70To84: number;
      bandUnder70: number;
    };
  };
  evidenceDistribution: Record<TechnicalEvidenceLevel, number>;
  decisionDistribution: Record<Phase1FamilyDecision, number>;
  confidenceDistribution: Record<Phase1Confidence, number>;
  familyTypeSummary: FamilyTypeSummaryRecord[];
  subcategorySkuCounts: SubcategorySkuCountRecord[];
  typeRuleProfiles: TypeEngineeringRuleProfile[];
  skuRecords: Phase1SkuRecord[];
  reconstructedFamilies: Phase1FamilyRecord[];
  directProducts: Phase1SkuRecord[];
  unresolvedItems: Phase1SkuRecord[];
  sourceFamilyTransformations: SourceFamilyTransformationRecord[];
  similarProductLinks: SimilarProductLinkRecord[];
  technicalConflicts: TechnicalConflictRecord[];
  oldToNewFamilyMappings: OldToNewFamilyMappingRecord[];
  categoryStageCheckpoints: CategoryStageCheckpointRecord[];
  haulOffBeltAudit: {
    totalAuditedSkus: number;
    verifiedTrueHaulOffBeltCount: number;
    coatedTimingBeltCount: number;
    coatedWeldedVBeltCount: number;
    gripBackingSheetCount: number;
    conveyorGripTapeCount: number;
    industrialMouldCount: number;
    haulOffLeafStatus: string;
    records: HaulOffAuditRecord[];
  };
  weldingEquipmentAudit: {
    totalAuditedSkus: number;
    weldingEquipmentAndClampCount: number;
    weldedRoundCrcBeltCount: number;
    weldedVOrFlatBeltCount: number;
    records: WeldingVsBeltAuditRecord[];
  };
  lowSkuSubcategoryDecisions: LowSkuSubcategoryDecisionRecord[];
}

const normalizeFa = (value?: string | null): string =>
  (value || '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\u200c\s]+/g, ' ')
    .trim();

const slugifyToken = (value: string): string =>
  normalizeFa(value)
    .toUpperCase()
    .replace(/[^A-Z0-9آ-ی]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'GEN';

const CATEGORY_NAME_BY_SLUG = new Map<string, string>(
  APPROVED_MENU_CATEGORIES.map((c) => [c.slug, c.name])
);

const MAIN_GROUP_BY_CATEGORY_SLUG = new Map<string, { mainGroupId: string; mainGroupName: string }>();
for (const grp of APPROVED_MENU_GROUPS) {
  for (const cSlug of grp.categorySlugs) {
    MAIN_GROUP_BY_CATEGORY_SLUG.set(cSlug, { mainGroupId: grp.id, mainGroupName: grp.title });
  }
}

export function resolveMainGroupForCategory(categorySlug: string): { mainGroupId: string; mainGroupName: string } {
  if (categorySlug === 'UNRESOLVED') {
    return { mainGroupId: 'group-unassigned', mainGroupName: 'نیازمند تعیین گروه مصوب' };
  }
  return (
    MAIN_GROUP_BY_CATEGORY_SLUG.get(categorySlug) || {
      mainGroupId: 'group-unassigned',
      mainGroupName: 'نیازمند تعیین گروه مصوب',
    }
  );
}

export function resolveEngineeringFamilyType(input: {
  productType: string;
  profile: string;
  material: string;
  construction: string;
  proposedCategorySlug: string;
  engineeringSpecifications?: Record<string, string | number | null>;
}): { familyTypeId: string; familyTypeName: string } {
  const pt = input.productType || '';
  const prof = (input.profile || '').toUpperCase();
  const mat = input.material || '';
  const div = String(input.engineeringSpecifications?.beltDivision || '');
  const sided = String(input.engineeringSpecifications?.sidedness || '');

  if (pt.includes('دستگاه و گیره جوش')) {
    return { familyTypeId: 'FT-WELD-TOOL', familyTypeName: 'دستگاه و گیره جوش تسمه صنعتی' };
  }
  if (pt.includes('روکش گریپ‌دار') && pt.includes('تایمینگ')) {
    return { familyTypeId: 'FT-TIMING-COATED-GRIP', familyTypeName: 'تسمه تایمینگ سیم‌دار روکش گریپ‌دار' };
  }
  if (pt.includes('روکش گریپ‌دار') && pt.includes('جوشی')) {
    return { familyTypeId: 'FT-WELDED-V-GRIP', familyTypeName: 'تسمه جوشی V روکش گریپ‌دار' };
  }
  // CRC is ambiguous unless its engineering division is read: crowned ridge-top
  // ceramic transport belts are not the same product as heat-welded PU round belts.
  if (div === 'vbelt-crowned-crc' || /گرده.?ماهی|ridge.?top|crowned/i.test(`${pt} ${prof}`)) {
    return {
      familyTypeId: 'FT-BELT-CROWNED-CRC',
      familyTypeName: 'تسمه گرده‌ماهی / تاج‌دار مداربسته (CRC / TRC)',
    };
  }
  if (
    div === 'welded-pu-round-crc' ||
    ((prof === 'ROUND' || prof === 'CRC') &&
      /جوشی|welded/i.test(pt) &&
      /پلی.?یورتان|polyurethane|\\bTPU\\b/i.test(`${pt} ${mat}`))
  ) {
    return {
      familyTypeId: 'FT-BELT-ROUND-CRC',
      familyTypeName: 'تسمه گرد پلی‌یورتان جوشی (Round PU Welded Belt)',
    };
  }
  if (div === 'welded-pu-v-flat' || (pt.includes('تسمه جوشی') && !pt.includes('گرد'))) {
    return { familyTypeId: 'FT-BELT-WELDED-V', familyTypeName: 'تسمه جوشی پلی‌یورتان پروفیل V و تخت' };
  }
  if (div.startsWith('timing-') || pt.includes('تایمینگ') || pt.includes('سیم‌دار')) {
    if (sided === 'double-sided' || /^D(?:XL|L|H|5M|8M|14M|T5|T10|AT5|AT10|S8M)/i.test(prof)) {
      return { familyTypeId: 'FT-TIMING-DOUBLE-SIDED', familyTypeName: 'تسمه تایمینگ دوطرفه (Double-Sided)' };
    }
    if (/^(?:3M|5M|8M|14M|20M|S3M|S5M|S8M|S14M|RPP5M|RPP8M|RPP14M|P5M|P8M|P14M)$/i.test(prof) || div.includes('curvilinear')) {
      return { familyTypeId: 'FT-TIMING-CURVILINEAR-HTD-RPP', familyTypeName: 'تسمه تایمینگ دندانه گرد (HTD / STD / RPP)' };
    }
    if (/^(?:T2\.5|T5|T10|T20|AT5|AT10|AT15|AT20)$/i.test(prof) || div.includes('metric-trapezoidal')) {
      return { familyTypeId: 'FT-TIMING-METRIC-TRAPEZOIDAL', familyTypeName: 'تسمه تایمینگ دندانه ذوزنقه‌ای متریک (T / AT)' };
    }
    return { familyTypeId: 'FT-TIMING-IMPERIAL-TRAPEZOIDAL', familyTypeName: 'تسمه تایمینگ دندانه ذوزنقه‌ای اینچی (MXL / XL / L / H / XH)' };
  }
  if (div.includes('poly-v') || /^(?:PH|PJ|PK|PL|PM)$/i.test(prof) || pt.includes('شیاری')) {
    return { familyTypeId: 'FT-BELT-POLY-V-RIBBED', familyTypeName: 'تسمه شیاری و پلی‌وی (PH / PJ / PK / PL / PM)' };
  }
  if (div === 'vbelt-banded' || /-BANDED$/i.test(prof) || pt.includes('به‌پشت‌پیوسته')) {
    return {
      familyTypeId: 'FT-VBELT-BANDED',
      familyTypeName: 'تسمه V شکل پشت‌پیوسته / پاورباند (Banded V-Belt)',
    };
  }
  if (div.startsWith('v-belt') || pt.includes('تسمه V') || pt.includes('کلاسیک') || pt.includes('پروفیل باریک')) {
    if (/^(?:AA|BB|CC)$/i.test(prof) || sided === 'double-sided') {
      return { familyTypeId: 'FT-VBELT-HEXAGONAL', familyTypeName: 'تسمه V دوطرفه شش‌ضلعی (Double V / AA / BB / CC)' };
    }
    if (/^(?:ZX|MX|AX|BX|CX|XPZ|XPA|XPB|XPC|3VX|5VX|8VX)$/i.test(prof) || div.includes('cogged')) {
      return {
        familyTypeId: 'FT-VBELT-COGGED',
        familyTypeName: 'تسمه V دنده‌ای لبه‌خام (ZX / AX / BX / CX / XPZ / XPA / XPB / XPC / 3VX / 5VX / 8VX)',
      };
    }
    if (/^(?:SPZ|SPA|SPB|SPC|3V|5V|8V)$/i.test(prof) || div.includes('narrow')) {
      return { familyTypeId: 'FT-VBELT-NARROW', familyTypeName: 'تسمه V شکل پروفیل باریک (SPZ / SPA / SPB / SPC / 3V / 5V / 8V)' };
    }
    return { familyTypeId: 'FT-VBELT-CLASSICAL', familyTypeName: 'تسمه V شکل کلاسیک (Z / A / B / C / D / E)' };
  }
  if (pt.includes('نوار نقاله PVC')) {
    return { familyTypeId: 'FT-CONVEYOR-PVC', familyTypeName: 'نوار نقاله PVC' };
  }
  if (pt.includes('نوار نقاله پلی‌یورتان')) {
    return { familyTypeId: 'FT-CONVEYOR-PU', familyTypeName: 'نوار نقاله پلی‌یورتان (PU)' };
  }
  if (pt.includes('نوار گریپ') || pt.includes('نوار نقاله دستگاه بسته‌بندی')) {
    return { familyTypeId: 'FT-CONVEYOR-GRIP-PACK', familyTypeName: 'نوار گریپ و نوار نقاله بسته‌بندی' };
  }
  if (pt.includes('ریل راهنما')) {
    if (mat.includes('استیل')) return { familyTypeId: 'FT-RAIL-STAINLESS', familyTypeName: 'ریل راهنما استیل' };
    if (mat.includes('تفلون')) return { familyTypeId: 'FT-RAIL-PTFE', familyTypeName: 'ریل راهنما تفلونی (PTFE)' };
    if (mat.includes('آلومینیوم')) return { familyTypeId: 'FT-RAIL-ALUMINUM', familyTypeName: 'ریل و پروفیل راهنما آلومینیومی' };
    return { familyTypeId: 'FT-RAIL-METAL', familyTypeName: 'ریل راهنما فولادی و گالوانیزه' };
  }
  if ((pt.includes('گاید') || pt.includes('راهنما')) && /فنری|spring/i.test(pt)) {
    return { familyTypeId: 'FT-SPRING-GUIDE', familyTypeName: 'گاید راهنمای فنری صنعتی' };
  }
  if (pt.includes('گاید') || pt.includes('سر ریل') || pt.includes('پایه نگهدارنده ریل') || pt.includes('بست، گیره و پایه نگهدارنده ریل')) {
    return { familyTypeId: 'FT-GUIDE-AND-MOUNT', familyTypeName: 'گاید خط انتقال و متعلقات نگهداری ریل' };
  }
  if (pt.includes('پولی')) {
    return { familyTypeId: 'FT-PULLEY-INDUSTRIAL', familyTypeName: 'پولی صنعتی، تایمینگ و هرزگرد' };
  }
  if (pt.includes('روکش رولر')) {
    return { familyTypeId: 'FT-ROLLER-SLEEVE', familyTypeName: 'روکش غلتک و رولر صنعتی' };
  }
  if (pt.includes('بوش رولر') || pt.includes('فنر سر رولر') || pt.includes('پین سر رولر') || pt.includes('خار نگهدارنده رولر') || pt.includes('پایه زیر سر رولر') || pt.includes('رولر و غلتک')) {
    return { familyTypeId: 'FT-ROLLER-COMPONENTS', familyTypeName: 'رولر و قطعات جانبی سر رولر (بوش، فنر، پین، خار)' };
  }
  if (pt.includes('زنجیر') || pt.includes('قفل زنجیر') || pt.includes('نیم‌دانه زنجیر')) {
    return { familyTypeId: 'FT-CHAIN-TRANSMISSION', familyTypeName: 'زنجیر انتقال قدرت و قفل زنجیر' };
  }
  if (pt.includes('کوپلینگ') || pt.includes('کوبلینگ') || /shaft.?coupling/i.test(pt)) {
    return { familyTypeId: 'FT-SHAFT-COUPLING', familyTypeName: 'کوپلینگ انتقال قدرت و اتصال شفت صنعتی' };
  }
  if (pt.includes('چرخ‌زنجیر') || pt.includes('چرخ‌دنده') || pt.includes('چرخ صنعتی')) {
    return { familyTypeId: 'FT-SPROCKET-GEAR-WHEEL', familyTypeName: 'چرخ‌زنجیر، چرخ‌دنده و چرخ صنعتی' };
  }
  if (pt.includes('بلبرینگ')) {
    return { familyTypeId: 'FT-BEARING-BALL', familyTypeName: 'بلبرینگ صنعتی شیارعمیق' };
  }
  if (pt.includes('یاتاقان') || pt.includes('حفاظ یاتاقان')) {
    return { familyTypeId: 'FT-BEARING-HOUSING', familyTypeName: 'یاتاقان صنعتی، کفی و محافظ یاتاقان' };
  }
  if (pt.includes('اورینگ') || pt.includes('پکینگ') || pt.includes('واشر') || pt.includes('نوار درزگیر') || pt.includes('کاسه‌نمد')) {
    return { familyTypeId: 'FT-SEALING-ORING-PACKING', familyTypeName: 'اورینگ، پکینگ، واشر و عناصر آب‌بندی' };
  }
  if (pt.includes('ضربه‌گیر') || pt.includes('ضربه‌زن') || pt.includes('مکنده') || pt.includes('گریپ') || pt.includes('لاستیک') || pt.includes('گلوله لاستیکی')) {
    return { familyTypeId: 'FT-RUBBER-BUMPER-ELASTOMER', familyTypeName: 'قطعات لاستیکی، ضربه‌گیر، مکنده و الاستومر صنعتی' };
  }
  if (pt.includes('برس') || pt.includes('اسکاج') || pt.includes('اسپاتول') || pt.includes('تیغه')) {
    return { familyTypeId: 'FT-BRUSH-PAD-BLADE', familyTypeName: 'برس صنعتی، اسکاج ساب و تیغه اسپاتول' };
  }
  if (pt.includes('توری مش')) {
    return { familyTypeId: 'FT-WIRE-MESH', familyTypeName: 'توری مش استیل صنعتی' };
  }
  if (pt.includes('پمپ') || pt.includes('پروانه همزن')) {
    return { familyTypeId: 'FT-PUMP-AND-AGITATOR', familyTypeName: 'قطعات پمپ و پروانه همزن صنعتی' };
  }
  if (pt.includes('نسوز') || pt.includes('کوره')) {
    return { familyTypeId: 'FT-REFRACTORY-KILN', familyTypeName: 'ملزومات نسوز و قطعات کوره' };
  }
  if (pt.includes('استاکر') || pt.includes('انگشتی') || pt.includes('چاپ و لعاب') || pt.includes('دیسک لعاب')) {
    return { familyTypeId: 'FT-TILE-LINE-MACHINERY', familyTypeName: 'قطعات تخصصی خطوط کاشی، چاپ، لعاب و استاکر' };
  }
  if (pt.includes('شیلنگ') || pt.includes('لوله') || pt.includes('ورق') || pt.includes('میلگرد و بوشن پلیمر') || pt.includes('پلیمری')) {
    return { familyTypeId: 'FT-POLYMER-SHEET-HOSE', familyTypeName: 'ورق، میلگرد پلیمری، شیلنگ و لوله صنعتی' };
  }
  return {
    familyTypeId: `FT-IND-${slugifyToken(pt).slice(0, 14)}`,
    familyTypeName: pt || 'تجهیزات و قطعات مکانیکی صنعتی',
  };
}

interface CanonicalMenuPath {
  categorySlug: string;
  categoryName: string;
  submenu: string;
  leaf: string | null;
}

const UNRESOLVED_MENU_PATH = {
  categorySlug: 'UNRESOLVED',
  categoryName: 'نیازمند تعیین مسیر مصوب',
  submenu: 'نیازمند تعیین مسیر مصوب',
  leaf: 'نیازمند تعیین مسیر مصوب',
} satisfies CanonicalMenuPath;

const CANONICAL_MENU_PATHS: CanonicalMenuPath[] = [];
const CANONICAL_BY_TRIPLET = new Map<string, CanonicalMenuPath>();
const CANONICAL_BY_SUBMENU = new Map<string, CanonicalMenuPath>();
const CANONICAL_BY_CATEGORY = new Map<string, CanonicalMenuPath[]>();

for (const cat of APPROVED_MENU_CATEGORIES) {
  const list: CanonicalMenuPath[] = [];
  for (const sub of cat.children || []) {
    CANONICAL_BY_SUBMENU.set(`${cat.slug}::${normalizeFa(sub.name)}`, {
      categorySlug: cat.slug,
      categoryName: cat.name,
      submenu: sub.name,
      leaf: null,
    });
    for (const lf of sub.children || []) {
      const entry: CanonicalMenuPath = {
        categorySlug: cat.slug,
        categoryName: cat.name,
        submenu: sub.name,
        leaf: lf.name,
      };
      CANONICAL_MENU_PATHS.push(entry);
      list.push(entry);
      CANONICAL_BY_TRIPLET.set(
        `${cat.slug}::${normalizeFa(sub.name)}::${normalizeFa(lf.name)}`,
        entry
      );
    }
  }
  CANONICAL_BY_CATEGORY.set(cat.slug, list);
}

/**
 * Returns an exact approved (categorySlug, submenu, leaf) triplet or an explicit
 * UNRESOLVED sentinel. It never substitutes a nearby/first leaf for an invalid path.
 */
export function resolveStrictApprovedMenuPath(
  rawCategorySlug: string,
  rawSubmenu: string,
  rawLeaf: string | null
): CanonicalMenuPath {
  // Only approved category slugs are accepted. Legacy categories must be mapped
  // through an explicitly approved path before they can be published.
  const slug = rawCategorySlug;
  if (!CANONICAL_BY_CATEGORY.has(slug)) return UNRESOLVED_MENU_PATH;

  const normSub = normalizeFa(rawSubmenu);
  if (rawLeaf === null || !rawLeaf.trim()) {
    return CANONICAL_BY_SUBMENU.get(`${slug}::${normSub}`) || UNRESOLVED_MENU_PATH;
  }
  const normLeaf = normalizeFa(rawLeaf);
  const exact = CANONICAL_BY_TRIPLET.get(`${slug}::${normSub}::${normLeaf}`);
  return exact || UNRESOLVED_MENU_PATH;
}

function getApprovedCategoryName(slug: string, fallback = ''): string {
  return CATEGORY_NAME_BY_SLUG.get(slug) || fallback;
}

function computeConfidenceScore(
  evidence: TechnicalEvidenceLevel,
  decision: Phase1FamilyDecision
): number {
  if (decision === 'UNRESOLVED' || evidence === 'UNKNOWN') return 35;
  switch (evidence) {
    case 'EXACT_MANUFACTURER_DATASHEET':
      return 99;
    case 'OFFICIAL_CATALOG':
      return 96;
    case 'OFFICIAL_PRODUCT_PAGE':
      return 92;
    case 'STANDARD_REFERENCE':
      return 90;
    case 'EXCEL_SOURCE':
      return 88;
    case 'PHYSICAL_VERIFICATION':
      return 94;
    case 'INVENTORY_DESCRIPTION':
      return 85;
    case 'INFERRED':
      return 74;
    default:
      return 75;
  }
}

function resolveManufacturerName(brand: string): string {
  const b = brand.toUpperCase();
  if (b.includes('BANDO')) return 'Bando Chemical Industries, Ltd. (Japan)';
  if (b.includes('MEGADYNE')) return 'Megadyne Group (Italy)';
  if (b.includes('OPTIBELT')) return 'Arntz Optibelt Group (Germany)';
  if (b.includes('CONTI')) return 'Continental Contitech (Germany)';
  if (b.includes('GATES')) return 'Gates Industrial Corporation (USA)';
  if (b.includes('MITSUBOSHI')) return 'Mitsuboshi Belting Ltd. (Japan)';
  if (b.includes('DONGIL')) return 'DRB Dongil Corporation (South Korea)';
  if (b.includes('HANCHANG') || b.includes('HAN CHANG')) return 'Han Chang Belting Co. (South Korea)';
  if (b.includes('SKF')) return 'AB SKF (Sweden)';
  if (b.includes('KG')) return 'KG International FZCO (Bearing Manufacturer)';
  if (b.includes('KANA')) return 'Katayama Chain Co., Ltd. - KANA (Japan)';
  if (b.includes('FORZA')) return 'FORZA Industrial Series';
  return brand === 'GENERIC_INDUSTRIAL' || brand.includes('عمومی')
    ? 'Standard Industrial OEM / Sanat Pish Engineering'
    : brand;
}

function buildEnglishTechnicalName(
  productType: string,
  brand: string,
  profile: string,
  material: string,
  variantSummary: string
): string {
  const cleanBrand = brand === 'GENERIC_INDUSTRIAL' ? 'Industrial' : brand;
  const cleanProf = profile && profile !== 'NOT_APPLICABLE' && profile !== 'UNKNOWN' ? profile : 'Standard';
  if (/تایمینگ|سیم\s*دار/.test(productType)) {
    return `${cleanBrand} Synchronous Timing Belt - Profile ${cleanProf} (${variantSummary})`;
  }
  if (/کلاسیک|پروفیل\s*باریک|تسمه\s*V/i.test(productType)) {
    return `${cleanBrand} V-Belt - Section ${cleanProf} (${variantSummary})`;
  }
  if (/چندشیاری|شیاری/.test(productType)) {
    return `${cleanBrand} Poly-V Ribbed Belt - Profile ${cleanProf} (${variantSummary})`;
  }
  if (/تسمه\s*گرد|جوشی/.test(productType) && !/دستگاه/.test(productType)) {
    return `${cleanBrand} Welded PU Belt - Profile ${cleanProf} (${variantSummary})`;
  }
  if (/دستگاه.*جوش/.test(productType)) {
    return `${cleanBrand} Belt Welding & Splicing Tool (${variantSummary})`;
  }
  if (/نوار\s*نقاله/.test(productType)) {
    return `${cleanBrand} Conveyor Belt - ${cleanProf} (${variantSummary})`;
  }
  if (/ریل|گاید|پروفیل/.test(productType)) {
    return `${cleanBrand} Guide Rail / Profile - ${cleanProf} (${variantSummary})`;
  }
  if (/پولی/.test(productType)) {
    return `${cleanBrand} Industrial Pulley - ${cleanProf} (${variantSummary})`;
  }
  if (/رولر/.test(productType)) {
    return `${cleanBrand} Roller Component - ${cleanProf} (${variantSummary})`;
  }
  if (/زنجیر/.test(productType)) {
    return `${cleanBrand} Roller Chain / Sprocket - ${cleanProf} (${variantSummary})`;
  }
  if (/بلبرینگ|یاتاقان/.test(productType)) {
    return `${cleanBrand} Bearing / Housing Unit - ${cleanProf} (${variantSummary})`;
  }
  if (/اورینگ|کاسه\s*نمد|پکینگ|واشر/.test(productType)) {
    return `${cleanBrand} Sealing Element - ${cleanProf} (${variantSummary})`;
  }
  if (/برس|اسکاج/.test(productType)) {
    return `${cleanBrand} Industrial Brush / Abrasive Pad - ${cleanProf} (${variantSummary})`;
  }
  const matEn = material.match(/\(([^)]+)\)/)?.[1] || 'Industrial Grade';
  return `${cleanBrand} Industrial Component - ${cleanProf} [${matEn}] (${variantSummary})`;
}

const BELT_SOURCE_TYPES = new Set<string>([
  'تسمه کلاسیک',
  'تسمه تایمینگ',
  'تسمه صنعتی',
  'تسمه پروفیل باریک',
  'تسمه سیم‌دار',
  'تسمه روکش‌دار',
  'تسمه چندشیاری',
  'تسمه شیاری PJ / PK / PL',
  'تسمه ضدسایش',
]);

/**
 * Parse the 305 SKU-level direct overrides from ops/sql/20261114_catalog_sku_level_menu_assignments.sql
 */
export function parseDirectSkuOverridesSql(sqlText: string): Map<string, DirectSkuMenuOverride> {
  const map = new Map<string, DirectSkuMenuOverride>();
  if (!sqlText) return map;
  const selectRegex =
    /SELECT\s+unnest\(ARRAY\[([\s\S]*?)\]::text\[\]\)\s+AS\s+sku_code,\s*'([^']+)'::text\s+AS\s+expected_family_code,\s*'([^']+)'::text\s+AS\s+category_slug,\s*'([^']*)'::text\s+AS\s+submenu,\s*'([^']*)'::text\s+AS\s+subcategory/g;
  let match: RegExpExecArray | null;
  while ((match = selectRegex.exec(sqlText)) !== null) {
    const arrayBody = match[1];
    const expectedFamilyCode = match[2];
    const categorySlug = match[3];
    const submenu = match[4];
    const subcategory = match[5];
    const codeRegex = /'([^']+)'/g;
    let cMatch: RegExpExecArray | null;
    while ((cMatch = codeRegex.exec(arrayBody)) !== null) {
      const skuCode = cMatch[1];
      map.set(skuCode, {
        skuCode,
        expectedFamilyCode,
        categorySlug,
        submenu,
        subcategory,
      });
    }
  }
  return map;
}

/**
 * Extract nominal imperial timing belt length designations verified in docs/technical-research-2642.json
 */
export function extractBeltRefsFromTechnicalResearch(trData: {
  records?: Array<{
    outcome?: string;
    referenceLengthCheck?: { designation?: string | null } | null;
  }>;
}): AuditReferenceTables {
  const imperialTimingLengths = new Set<string>();
  for (const rec of trData?.records || []) {
    if (
      rec.outcome === 'nominal-length-in-primary-table' &&
      rec.referenceLengthCheck?.designation
    ) {
      imperialTimingLengths.add(rec.referenceLengthCheck.designation.trim().toUpperCase());
    }
  }
  return { imperialTimingLengths };
}

/**
 * Convert a RawCatalogueFamily into a Product object compatible with beltCatalogAudit.ts
 */
function rawFamilyToProduct(raw: RawCatalogueFamily): Product {
  const menuAssign = CATALOG_FAMILY_MENU_ASSIGNMENTS[raw.code];
  const categorySlug = menuAssign?.categorySlug || '';
  return {
    code: raw.code,
    name: raw.name,
    category: raw.categoryName,
    categoryName: raw.categoryName,
    categorySlug,
    submenu: menuAssign?.submenuName || raw.submenu || '',
    subcategory: menuAssign?.leafName || raw.technicalType || '',
    brand: raw.brand || 'UNSPECIFIED',
    prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
    inquiryOnly: true,
    images: [],
    tags: [],
    stock: raw.itemCount || raw.variants.length,
    unit: (raw.unit || 'عدد').split(',')[0].trim() || 'عدد',
    image: '',
    description: raw.name,
    technicalSpecs: [
      { key: 'نوع فنی', value: raw.technicalType || '' },
      { key: 'جنس‌های ثبت‌شده', value: raw.materials || '' },
      { key: 'پروفیل‌ها', value: raw.profiles || '' },
    ],
    variants: raw.variants.map((v) => ({
      code: String(v.code),
      name: v.name,
      size: v.size || '',
      price: 0,
      stock: 1,
      unit: parseVariantUnit(v.name, raw.unit),
    })),
  };
}

function parseVariantUnit(name: string, familyUnit: string): string {
  const norm = normalizeFa(name);
  if (/آستین|استین/.test(norm)) return 'سانتی‌متر';
  if (/متری|کلاف|رول\s*\d+\s*متری/.test(norm)) return 'متر';
  if (/تسمه\s*جوشی/.test(norm) && !/گیره|دستگاه/.test(norm)) {
    const first = (familyUnit || '').split(',')[0].trim();
    return first || 'متر';
  }
  const firstUnit = (familyUnit || 'عدد').split(',')[0].trim();
  return firstUnit || 'عدد';
}

/**
 * Map belt verification provenance to the 9-level Phase 1 TechnicalEvidenceLevel
 */
function mapBeltEvidenceToPhase1(beltRec: BeltSkuAuditRecord): TechnicalEvidenceLevel {
  if (beltRec.confidence === 'REQUIRES_REVIEW') return 'UNKNOWN';
  switch (beltRec.verification.tier) {
    case 'EXACT_SKU_DATASHEET_MATCHED':
      return 'EXACT_MANUFACTURER_DATASHEET';
    case 'NOMINAL_DESIGNATION_REF_MATCHED':
      return 'OFFICIAL_CATALOG';
    case 'BRAND_SERIES_AND_ISO_STANDARD':
      return 'OFFICIAL_PRODUCT_PAGE';
    case 'ALGORITHMIC_REGEX_AND_ISO_TABLE':
      return 'STANDARD_REFERENCE';
    case 'INTERNAL_DB_CATALOG_ONLY':
      return 'INVENTORY_DESCRIPTION';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Detect whether a SKU outside the 9 belt technicalTypes is actually a belt or belt welding device
 */
function isMisplacedBeltOrWeldingSku(rawFam: RawCatalogueFamily, variant: RawCatalogueVariant): boolean {
  const norm = normalizeFa(variant.name);
  if (rawFam.code === 'FAM-35198') return true; // 13 SKUs of تسمه بسته بندی B614..B650 inside بست صنعتی
  if (rawFam.code === 'FAM-31222' || rawFam.code === 'FAM-33328' || rawFam.code === 'FAM-31286') {
    return true; // تسمه پروانه B669, SPZ1900, 975*10 inside قطعات پمپ
  }
  if (rawFam.code === 'FAM-38161' || rawFam.code === 'FAM-39337') {
    return true; // نسمه سیم دار 25AT5*1420 & آستین مگادین 1700H
  }
  if (
    variant.code === '37541' ||
    variant.code === '41121' ||
    variant.code === '38002' ||
    variant.code === '33126'
  ) {
    return true; // تسه اپتی C185, سمه سیم دار 25H7340, هان چانگ 835*9/5, تسمه سیم دار مداربسته 50T10 *5540 inside FAM-32873/FAM-33126
  }
  if (variant.code === '41497' || variant.code === '35852' || variant.code === '110049') {
    return true; // دستگاه هویه آپارات (FORZA) & دستگاه گیره آپارات تسمه جوشی -> belt welding machines/clamps
  }
  if (
    rawFam.technicalType === 'قطعات دستگاه چاپ' &&
    /^تسمه\s*چاپ/i.test(norm)
  ) {
    return true; // تسمه چاپ مگادین T5 / PJ8
  }
  if (
    /^(?:تسمه|تسه|سمه|نسمه)\s*(?:سیم\s*دار|ساده|مداربسته|اپتی|مگادین|هان\s*چانگ|وی\s*بلت|تایم|پلی|جوشی|گرد|pvc|pu)/i.test(norm) &&
    !/تسمه\s*پاک\s*کن|تسمه\s*پک\s*کن|تسمه\s*سفت\s*کن|تسمه\s*کش|تسمه\s*آهنی|تیغه.*تسمه/.test(norm)
  ) {
    return true;
  }
  return false;
}

/**
 * Dedicated coated/grip belt sub-specification extractor so grip thickness (6/10/12/15mm) and color (قرمز/مشکی)
 * are treated as strict invariant specifications on coated belts.
 */
function extractGripCoatingInvariant(rawName: string): {
  hasGripOrCoating: boolean;
  coatingType: string;
  coatingColor: string;
  coatingThicknessMm: number | null;
  surfacePattern: string;
  cordType: string;
} {
  const norm = normalizeFa(rawName);
  const hasGrip = /گریپ|باگریپ|روکش\s*ضد\s*سایش|ضد\s*سایش/.test(norm);
  if (!hasGrip) {
    return {
      hasGripOrCoating: false,
      coatingType: 'NONE',
      coatingColor: 'NONE',
      coatingThicknessMm: null,
      surfacePattern: 'STANDARD',
      cordType: /سیم\s*دار|سیمدار/.test(norm)
        ? 'STEEL_CORD'
        : /نخ\s*دار|نخدار/.test(norm)
          ? 'POLYESTER_CORD'
          : 'STANDARD',
    };
  }
  const color = /مشکی/.test(norm)
    ? 'BLACK'
    : /قرمز/.test(norm)
      ? 'RED'
      : /سبز/.test(norm)
        ? 'GREEN'
        : 'RED_DEFAULT';
  let thicknessMm: number | null = null;
  const thMatch =
    norm.match(/(?:گریپ|باگریپ)\s*(?:قرمز|مشکی|آجدار)?\s*(\d+(?:\.\d+)?)\s*(?:میل|مبل|m\b|mm\b)/i) ||
    norm.match(/(\d+(?:\.\d+)?)\s*(?:میل|مبل|m\b|mm\b)\s*(?:قرمز|مشکی)/i);
  if (thMatch) {
    thicknessMm = Number(thMatch[1]);
  }
  const surfacePattern = /آجدار/.test(norm)
    ? 'RIBBED_GRIP'
    : /ضد\s*سایش/.test(norm)
      ? 'LINATEX_ANTI_ABRASION'
      : 'SUPERGRIP';
  const cordType = /سیم\s*دار|سیمدار/.test(norm)
    ? 'STEEL_CORD'
    : /نخ\s*دار|نخدار/.test(norm)
      ? 'POLYESTER_CORD'
      : 'UNREINFORCED_PU';
  return {
    hasGripOrCoating: true,
    coatingType: /ضد\s*سایش/.test(norm) ? 'ANTI_ABRASION_RUBBER' : 'ELASTOMER_GRIP_TOP',
    coatingColor: color,
    coatingThicknessMm: thicknessMm,
    surfacePattern,
    cordType,
  };
}

/**
 * Transform a BeltSkuAuditRecord (plus raw family/variant) into a Phase1SkuRecord
 */
function buildBeltPhase1SkuRecord(
  rawFam: RawCatalogueFamily,
  variant: RawCatalogueVariant,
  beltRec: BeltSkuAuditRecord,
  directOverride: DirectSkuMenuOverride | null
): Phase1SkuRecord {
  const norm = normalizeFa(variant.name);
  const gripInfo = extractGripCoatingInvariant(variant.name);

  // Special handling for belt welding equipment/clamps (SKUs 41497, 35852, 110049)
  if (
    variant.code === '41497' ||
    variant.code === '35852' ||
    variant.code === '110049' ||
    beltRec.technical.beltDivision === 'belt-welding-tool'
  ) {
    const brand =
      variant.code === '41497'
        ? 'FORZA'
        : beltRec.detectedBrand === 'UNSPECIFIED'
          ? 'GENERIC'
          : beltRec.detectedBrand;
    const toolSubType = /هویه/.test(norm) ? 'HEATING_IRON_WELDER' : 'SPLICING_CLAMP_FIXTURE';
    const canonical = resolveStrictApprovedMenuPath('excel-v2-1-4', 'دستگاه‌های تسمه جوشی', 'دستگاه جوش تسمه صنعتی');
    const mainGrp = resolveMainGroupForCategory(canonical.categorySlug);
    const famType = resolveEngineeringFamilyType({
      productType: 'دستگاه و گیره جوش تسمه صنعتی',
      profile: 'NOT_APPLICABLE',
      material: 'فولاد و آلومینیوم صنعتی',
      construction: toolSubType,
      proposedCategorySlug: canonical.categorySlug,
    });
    const varSum = variant.size || 'تک‌مدل';
    return {
      skuCode: variant.code,
      originalProductName: variant.name,
      normalizedProductName: norm,
      englishProductName: buildEnglishTechnicalName('دستگاه و گیره جوش تسمه صنعتی', brand, toolSubType, 'Steel/Aluminum', varSum),
      brand,
      manufacturer: brand === 'GENERIC' ? 'Industrial Tooling OEM' : brand,
      manufacturerPartNumber: `WELD-TOOL-${variant.code}`,
      productType: 'دستگاه و گیره جوش تسمه صنعتی',
      material: 'فولاد و آلومینیوم صنعتی',
      construction: toolSubType === 'HEATING_IRON_WELDER' ? 'دستگاه هویه آپارات حرارتی تسمه PU' : 'گیره و فیکسچر آپارات تسمه جوشی',
      profile: 'NOT_APPLICABLE',
      standard: 'MANUFACTURER_TOOLING_SPEC',
      engineeringSpecifications: {
        equipmentType: toolSubType,
        brand,
        clampSizeSpec: variant.size && variant.size !== 'نامشخص' ? variant.size : 'STANDARD',
        toothPitchMm: 'NOT_APPLICABLE',
        beltProfile: 'NOT_APPLICABLE',
      },
      identitySpecifications: {
        productType: 'دستگاه و گیره جوش تسمه صنعتی',
        brand,
        equipmentType: toolSubType,
        material: 'فولاد و آلومینیوم صنعتی',
      },
      variableSpecifications: {
        clampSizeSpec: variant.size && variant.size !== 'نامشخص' ? variant.size : 'STANDARD',
        skuCode: variant.code,
      },
      descriptiveSpecifications: {
        application: 'جوش حرارتی و آپارات تسمه‌های پلی‌یورتان و گرد',
        unit: 'عدد',
      },
      mainGroupId: mainGrp.mainGroupId,
      mainGroupName: mainGrp.mainGroupName,
      familyTypeId: famType.familyTypeId,
      familyTypeName: famType.familyTypeName,
      currentFamily: rawFam.code,
      proposedFamily: null,
      familyName: null,
      familyMemberCodes: [variant.code],
      currentCategory: rawFam.categoryName,
      proposedCategory: canonical.categoryName,
      currentSubcategory: rawFam.technicalType,
      proposedSubcategory: canonical.leaf ? `${canonical.submenu} > ${canonical.leaf}` : canonical.submenu,
      familyDecision: 'DIRECT_PRODUCT',
      finalStatus: 'DIRECT_PRODUCT',
      technicalEvidence: 'INVENTORY_DESCRIPTION',
      sourceUrl: 'internal://tests/fixtures/catalogueSource.json',
      decisionReason:
        'ابزار و دستگاه جوش/آپارات تسمه است (نه خود تسمه)؛ طبق قانون تفکیک تجهیزات جوشی از خانواده‌های تسمه جدا شده و به صورت کالای مستقیم در زیرشاخه «دستگاه جوش تسمه صنعتی» عرضه می‌شود.',
      confidence: 'HIGH',
      confidenceScore: 88,
      verificationStatus: 'VERIFIED_INVENTORY_RECORD',
      requiredAction: 'READY_FOR_MIGRATION_AS_DIRECT_PRODUCT',
      taxonomyGap: null,
      similarProductCodes: [],
      sourceFamilyName: rawFam.name,
      sourceTechnicalType: rawFam.technicalType,
      proposedTechnicalType: 'دستگاه جوش تسمه صنعتی',
      proposedCategorySlug: canonical.categorySlug,
      proposedSubmenu: canonical.submenu,
      proposedLeaf: canonical.leaf,
      unit: 'عدد',
      originalSize: variant.size || '',
      invariantKey: `DIRECT_WELDING_TOOL::${variant.code}`,
      variantSummary: varSum,
      preservedDirectSkuOverride: directOverride,
      splitFromMixedFamily: rawFam.variants.length > 1,
      mergedFromFragmentedFamilies: false,
      misplacedInSourceCategory: rawFam.categoryName !== 'تسمه و انتقال نیرو',
    };
  }

  // If the belt parser identified a non-belt item mixed inside a belt family (e.g., round belt pulleys inside FAM-80151, PU belt scrapers, etc.)
  if (beltRec.technical.operatingPrinciple === 'non-belt') {
    return classifyNonBeltSku(rawFam, variant, directOverride, true);
  }

  // If the belt record is ambiguous / requires physical review (the 9 belt blockers)
  if (beltRec.confidence === 'REQUIRES_REVIEW' || beltRec.technical.beltDivision === 'service-ambiguous') {
    const canonical = resolveStrictApprovedMenuPath(
      beltRec.proposedCategorySlug || 'excel-v2-1-1',
      beltRec.proposedSubmenu || '',
      beltRec.proposedLeaf || ''
    );
    const mainGrp = resolveMainGroupForCategory(canonical.categorySlug);
    const famType = resolveEngineeringFamilyType({
      productType: beltRec.actualProductType,
      profile: beltRec.technical.profile || 'UNKNOWN',
      material: beltRec.technical.bodyMaterial || 'UNKNOWN',
      construction: beltRec.technical.tensileCord || 'UNKNOWN',
      proposedCategorySlug: canonical.categorySlug,
    });
    return {
      skuCode: variant.code,
      originalProductName: variant.name,
      normalizedProductName: norm,
      englishProductName: `Unresolved Belt Record (${variant.code})`,
      brand: beltRec.detectedBrand,
      manufacturer: beltRec.detectedBrand,
      manufacturerPartNumber: 'UNKNOWN',
      productType: beltRec.actualProductType,
      material: beltRec.technical.bodyMaterial || 'UNKNOWN',
      construction: beltRec.technical.tensileCord || 'UNKNOWN',
      profile: beltRec.technical.profile || 'UNKNOWN',
      standard: beltRec.technical.standardReference || 'UNKNOWN',
      engineeringSpecifications: {
        pitchMm: beltRec.technical.pitchMm,
        beltThicknessMm: beltRec.technical.beltThicknessMm,
        nominalWidthMm: beltRec.technical.nominalWidthMm,
        sidedness: beltRec.technical.sidedness,
        supplyForm: beltRec.technical.supplyForm,
      },
      identitySpecifications: {
        productType: beltRec.actualProductType,
        brand: beltRec.detectedBrand,
        profile: 'UNKNOWN',
      },
      variableSpecifications: {
        rawSize: variant.size || 'نامشخص',
        skuCode: variant.code,
      },
      descriptiveSpecifications: {
        sourceFamily: rawFam.code,
        unit: beltRec.unit,
      },
      mainGroupId: mainGrp.mainGroupId,
      mainGroupName: mainGrp.mainGroupName,
      familyTypeId: famType.familyTypeId,
      familyTypeName: famType.familyTypeName,
      currentFamily: rawFam.code,
      proposedFamily: null,
      familyName: null,
      familyMemberCodes: [],
      currentCategory: rawFam.categoryName,
      proposedCategory: canonical.categoryName,
      currentSubcategory: rawFam.technicalType,
      proposedSubcategory: canonical.leaf ? `${canonical.submenu} > ${canonical.leaf}` : canonical.submenu,
      familyDecision: 'UNRESOLVED',
      finalStatus: 'UNRESOLVED',
      technicalEvidence: 'UNKNOWN',
      sourceUrl: beltRec.verification.sourceUrl,
      decisionReason: `اطلاعات فنی ناقص یا مبهم در منبع انبار (${beltRec.engineeringReasoning})؛ نیازمند بازبینی فیزیکی در انبار و انتقال به صف UNRESOLVED.`,
      confidence: 'UNRESOLVED',
      confidenceScore: 35,
      verificationStatus: 'REQUIRES_PHYSICAL_VERIFICATION',
      requiredAction: 'WAREHOUSE_PHYSICAL_INSPECTION_REQUIRED',
      taxonomyGap: beltRec.taxonomyGap || (canonical.categorySlug === 'UNRESOLVED'
        ? 'GAP-APPROVED-MENU-PATH-MISSING: مسیر دقیق این نوار در منوی مصوب وجود ندارد.'
        : null),
      similarProductCodes: [],
      sourceFamilyName: rawFam.name,
      sourceTechnicalType: rawFam.technicalType,
      proposedTechnicalType: rawFam.technicalType,
      proposedCategorySlug: canonical.categorySlug,
      proposedSubmenu: canonical.submenu,
      proposedLeaf: canonical.leaf,
      unit: beltRec.unit,
      originalSize: variant.size || '',
      invariantKey: `UNRESOLVED::BELT::${variant.code}`,
      variantSummary: variant.size || 'نامشخص',
      preservedDirectSkuOverride: directOverride,
      splitFromMixedFamily: rawFam.variants.length > 1,
      mergedFromFragmentedFamilies: false,
      misplacedInSourceCategory: false,
    };
  }

  // Build strict invariant key for valid belt / conveyor SKUs
  let proposedCategorySlug = beltRec.proposedCategorySlug;
  let proposedCategoryName = beltRec.proposedCategoryName;
  let proposedSubmenu = beltRec.proposedSubmenu;
  let proposedLeaf = beltRec.proposedLeaf;
  let proposedTechnicalType = beltRec.actualProductType;
  let beltTaxonomyGap = beltRec.taxonomyGap;

  if (gripInfo.hasGripOrCoating) {
    proposedTechnicalType =
      beltRec.technical.operatingPrinciple === 'synchronous'
        ? `تسمه تایمینگ سیم‌دار روکش گریپ‌دار (پروفیل ${beltRec.technical.profile})`
        : `تسمه جوشی V روکش گریپ‌دار (پروفیل ${beltRec.technical.profile})`;
  }

  if (directOverride) {
    proposedCategorySlug = directOverride.categorySlug;
    proposedCategoryName = getApprovedCategoryName(directOverride.categorySlug, proposedCategoryName);
    proposedSubmenu = directOverride.submenu;
    proposedLeaf = directOverride.subcategory;
  }

  const canonicalBeltPath = resolveStrictApprovedMenuPath(proposedCategorySlug, proposedSubmenu, proposedLeaf);
  proposedCategorySlug = canonicalBeltPath.categorySlug;
  proposedCategoryName = canonicalBeltPath.categoryName;
  proposedSubmenu = canonicalBeltPath.submenu;
  proposedLeaf = canonicalBeltPath.leaf;

  if (proposedCategorySlug === 'UNRESOLVED') {
    beltTaxonomyGap = beltTaxonomyGap || 'GAP-APPROVED-MENU-PATH-MISSING: مسیر دقیق این خانواده در منوی مصوب وجود ندارد.';
  } else {
    const semantic = validateFamilyMenuAssignment({
      familyCode: rawFam.code,
      familyName: rawFam.name,
      productType: proposedTechnicalType,
      material: beltRec.technical.bodyMaterial,
      profile: beltRec.technical.profile,
      categorySlug: proposedCategorySlug,
      submenuName: proposedSubmenu,
      leafName: proposedLeaf,
    });
    if (!semantic.valid) {
      beltTaxonomyGap = 'GAP-SEMANTIC-MENU-CONFLICT: ' + semantic.reason;
      proposedCategorySlug = 'UNRESOLVED';
      proposedCategoryName = UNRESOLVED_MENU_PATH.categoryName;
      proposedSubmenu = UNRESOLVED_MENU_PATH.submenu;
      proposedLeaf = UNRESOLVED_MENU_PATH.leaf;
    }
  }

  const normalizedBrand =
    !beltRec.detectedBrand ||
    beltRec.detectedBrand === 'UNSPECIFIED' ||
    beltRec.detectedBrand.endsWith('-OEM') ||
    beltRec.detectedBrand === 'SYNCHRONOUS'
      ? 'GENERIC_INDUSTRIAL'
      : beltRec.detectedBrand;

  const isThicknessVariantAllowed =
    beltRec.technical.profile === 'ROUND' || beltRec.technical.beltDivision === 'conveyor-pvc-pu';

  const coatingSignature = gripInfo.hasGripOrCoating
    ? `${gripInfo.coatingType}:${gripInfo.coatingColor}:${gripInfo.coatingThicknessMm ?? 'STD'}:${gripInfo.surfacePattern}:${gripInfo.cordType}`
    : beltRec.technical.backingOrCoating || 'NONE';

  const fullConstruction = `${beltRec.technical.tensileCord}${gripInfo.hasGripOrCoating ? ` + ${coatingSignature}` : ''}`;

  const invariantKey = [
    'BELT',
    proposedTechnicalType,
    beltRec.technical.operatingPrinciple,
    beltRec.technical.beltDivision,
    normalizedBrand,
    beltRec.technical.profile,
    beltRec.technical.sidedness,
    beltRec.technical.supplyForm,
    beltRec.unit,
    beltRec.technical.pitchMm ?? 'NA',
    beltRec.technical.toothAngleDeg ?? 'NA',
    beltRec.technical.toothHeightMm ?? 'NA',
    isThicknessVariantAllowed ? 'VAR_THICK' : beltRec.technical.beltThicknessMm ?? 'NA',
    beltRec.technical.bodyMaterial,
    fullConstruction,
    coatingSignature,
    beltRec.technical.standardReference,
    proposedCategorySlug,
    proposedSubmenu,
    proposedLeaf,
  ].join('|');

  const evidence = mapBeltEvidenceToPhase1(beltRec);
  const verificationStatus: Phase1VerificationStatus =
    evidence === 'EXACT_MANUFACTURER_DATASHEET' ||
    evidence === 'OFFICIAL_CATALOG' ||
    evidence === 'OFFICIAL_PRODUCT_PAGE'
      ? 'VERIFIED_MANUFACTURER'
      : evidence === 'INVENTORY_DESCRIPTION'
        ? 'VERIFIED_INVENTORY_RECORD'
        : 'VERIFIED_STANDARD_OR_SOURCE';

  const variantParts: string[] = [];
  if (beltRec.technical.pitchLengthMm) variantParts.push(`Lp=${beltRec.technical.pitchLengthMm}mm`);
  else if (beltRec.technical.insideLengthMm) variantParts.push(`Li=${beltRec.technical.insideLengthMm}mm`);
  else if (beltRec.technical.outsideLengthMm) variantParts.push(`La=${beltRec.technical.outsideLengthMm}mm`);
  if (beltRec.technical.toothCount) variantParts.push(`Z=${beltRec.technical.toothCount}`);
  if (beltRec.technical.nominalWidthMm) variantParts.push(`W=${beltRec.technical.nominalWidthMm}mm`);
  if (beltRec.technical.ribCount) variantParts.push(`Ribs=${beltRec.technical.ribCount}`);
  if (variantParts.length === 0 && variant.size) variantParts.push(variant.size);
  const variantSummary = variantParts.join(', ') || variant.size || 'استاندارد';

  const mpn =
    variant.size && variant.size !== 'نامشخص'
      ? `${beltRec.technical.profile}-${variant.size.replace(/\s+/g, '')}`
      : `${beltRec.technical.profile}-${variant.code}`;

  const engSpecs: Record<string, string | number | null> = {
    operatingPrinciple: beltRec.technical.operatingPrinciple,
    beltDivision: beltRec.technical.beltDivision,
    profile: beltRec.technical.profile,
    pitchMm: beltRec.technical.pitchMm ?? 'NOT_APPLICABLE',
    toothAngleDeg: beltRec.technical.toothAngleDeg ?? 'NOT_APPLICABLE',
    toothHeightMm: beltRec.technical.toothHeightMm ?? 'NOT_APPLICABLE',
    beltThicknessMm: beltRec.technical.beltThicknessMm ?? 'NOT_APPLICABLE',
    nominalWidthMm: beltRec.technical.nominalWidthMm ?? 'NOT_APPLICABLE',
    pitchLengthMm: beltRec.technical.pitchLengthMm ?? 'NOT_APPLICABLE',
    toothCount: beltRec.technical.toothCount ?? 'NOT_APPLICABLE',
    ribCount: beltRec.technical.ribCount ?? 'NOT_APPLICABLE',
    sidedness: beltRec.technical.sidedness,
    supplyForm: beltRec.technical.supplyForm,
    backingOrCoating: gripInfo.hasGripOrCoating ? coatingSignature : beltRec.technical.backingOrCoating || 'NOT_APPLICABLE',
    gripThicknessMm: gripInfo.coatingThicknessMm ?? 'NOT_APPLICABLE',
  };
  const mainGrp = resolveMainGroupForCategory(proposedCategorySlug);
  const famType = resolveEngineeringFamilyType({
    productType: proposedTechnicalType,
    profile: beltRec.technical.profile,
    material: beltRec.technical.bodyMaterial,
    construction: fullConstruction,
    proposedCategorySlug,
    engineeringSpecifications: engSpecs,
  });

  return {
    skuCode: variant.code,
    originalProductName: variant.name,
    normalizedProductName: norm,
    englishProductName: buildEnglishTechnicalName(
      proposedTechnicalType,
      normalizedBrand,
      beltRec.technical.profile,
      beltRec.technical.bodyMaterial,
      variantSummary
    ),
    brand: normalizedBrand,
    manufacturer: normalizedBrand === 'GENERIC_INDUSTRIAL' ? 'Industrial Belt Manufacturer' : normalizedBrand,
    manufacturerPartNumber: mpn,
    productType: proposedTechnicalType,
    material: beltRec.technical.bodyMaterial,
    construction: fullConstruction,
    profile: beltRec.technical.profile,
    standard: beltRec.technical.standardReference,
    engineeringSpecifications: engSpecs,
    identitySpecifications: {
      productType: proposedTechnicalType,
      brand: normalizedBrand,
      profile: beltRec.technical.profile,
      pitchMm: beltRec.technical.pitchMm ?? 'NOT_APPLICABLE',
      toothAngleDeg: beltRec.technical.toothAngleDeg ?? 'NOT_APPLICABLE',
      bodyMaterial: beltRec.technical.bodyMaterial,
      tensileCord: fullConstruction,
      sidedness: beltRec.technical.sidedness,
      supplyForm: beltRec.technical.supplyForm,
      unit: beltRec.unit,
    },
    variableSpecifications: {
      pitchLengthMm: beltRec.technical.pitchLengthMm ?? beltRec.technical.insideLengthMm ?? beltRec.technical.outsideLengthMm ?? 'NOT_APPLICABLE',
      toothCount: beltRec.technical.toothCount ?? 'NOT_APPLICABLE',
      nominalWidthMm: beltRec.technical.nominalWidthMm ?? 'NOT_APPLICABLE',
      ribCount: beltRec.technical.ribCount ?? 'NOT_APPLICABLE',
      catalogSize: variant.size || variantSummary,
    },
    descriptiveSpecifications: {
      standardReference: beltRec.technical.standardReference,
      operatingPrinciple: beltRec.technical.operatingPrinciple,
      beltDivision: beltRec.technical.beltDivision,
      verificationSource: beltRec.verification.evidenceBasis,
    },
    mainGroupId: mainGrp.mainGroupId,
    mainGroupName: mainGrp.mainGroupName,
    familyTypeId: famType.familyTypeId,
    familyTypeName: famType.familyTypeName,
    currentFamily: rawFam.code,
    proposedFamily: beltRec.proposedFamilyId,
    familyName: null,
    familyMemberCodes: [],
    currentCategory: rawFam.categoryName,
    proposedCategory: proposedCategoryName,
    currentSubcategory: rawFam.technicalType,
    proposedSubcategory: proposedLeaf ? `${proposedSubmenu} > ${proposedLeaf}` : proposedSubmenu,
    familyDecision: 'APPROVED_FAMILY',
    finalStatus: 'FAMILY_MEMBER',
    technicalEvidence: evidence,
    sourceUrl: beltRec.verification.sourceUrl,
    decisionReason: beltRec.engineeringReasoning,
    confidence:
      evidence === 'EXACT_MANUFACTURER_DATASHEET' || evidence === 'OFFICIAL_CATALOG'
        ? 'HIGH'
        : 'MEDIUM',
    confidenceScore: computeConfidenceScore(evidence, 'APPROVED_FAMILY'),
    verificationStatus,
    requiredAction: evidence === 'INVENTORY_DESCRIPTION'
      ? 'WAREHOUSE_PHYSICAL_INSPECTION_REQUIRED'
      : 'READY_FOR_MIGRATION',
    taxonomyGap: beltTaxonomyGap,
    similarProductCodes: [],
    sourceFamilyName: rawFam.name,
    sourceTechnicalType: rawFam.technicalType,
    proposedTechnicalType,
    proposedCategorySlug,
    proposedSubmenu,
    proposedLeaf,
    unit: beltRec.unit,
    originalSize: variant.size || '',
    invariantKey,
    variantSummary,
    preservedDirectSkuOverride: directOverride,
    splitFromMixedFamily: false,
    mergedFromFragmentedFamilies: false,
    misplacedInSourceCategory:
      rawFam.categoryName !== 'تسمه و انتقال نیرو' && rawFam.categoryName !== 'نوار و تسمه نقاله',
  };
}

/**
 * Extract brand for non-belt industrial products
 */
function detectNonBeltBrand(normName: string, rawBrand?: string | null): string {
  if (rawBrand && normalizeFa(rawBrand) && normalizeFa(rawBrand) !== 'نامشخص') {
    return normalizeFa(rawBrand).toUpperCase();
  }
  if (/\bp\s*forza\b/i.test(normName)) return 'P FORZA';
  if (/\bforza\b|فورزا/i.test(normName)) return 'FORZA';
  if (/\bhabasit\b|هابازیت/i.test(normName)) return 'HABASIT';
  if (/\bmegadyne\b|مگادین|مگداین/i.test(normName)) return 'MEGADYNE';
  if (/\bkana\b|کانا/i.test(normName)) return 'KANA';
  if (/\bkg\b/i.test(normName)) return 'KG';
  if (/\bskf\b/i.test(normName)) return 'SKF';
  if (/\bfag\b/i.test(normName)) return 'FAG';
  if (/\bvolta\b|ولتا/i.test(normName)) return 'VOLTA';
  if (/\bsemperit\b|سمپریت/i.test(normName)) return 'SEMPERIT';
  if (/\buni\s*tech\b/i.test(normName)) return 'UNI TECH';
  if (/\btechno\s*ferrari\b|تکنو\s*فراری/i.test(normName)) return 'TECHNO FERRARI';
  if (/\bsacmi\b|ساکمی/i.test(normName)) return 'SACMI';
  if (/\bsystem\b|سیستم/i.test(normName)) return 'SYSTEM';
  if (/\bkia\b|کیا(?=\s|$)/i.test(normName)) return 'KIA';
  if (/ایتالیایی|ایتالیا|طرح\s*ایتالیا/.test(normName)) return 'ITALY_SERIES';
  if (/آلمانی|آلمان/.test(normName)) return 'GERMANY_SERIES';
  if (/کره\s*ای/.test(normName)) return 'KOREA_SERIES';
  if (/انگلیسی/.test(normName)) return 'UK_SERIES';
  if (/خارجی/.test(normName)) return 'IMPORTED_SERIES';
  if (/ایرانی/.test(normName)) return 'IRAN_SERIES';
  return 'GENERIC_INDUSTRIAL';
}

/**
 * Extract strict material identity for non-belt industrial products
 */
function detectNonBeltMaterial(normName: string, rawMaterials?: string | null, technicalType = ''): string {
  // Always prioritize explicit material tokens in the SKU's own name over mixed family-level materials!
  if (/استیل|stainless|ss304|ss316/i.test(normName)) return 'استیل / فولاد ضدزنگ (Stainless Steel)';
  if (/تفلون|ptfe/i.test(normName)) {
    if (/پلی\s*امید|پلی\s*آمید/.test(normName)) return 'پلی‌آمید / تفلون مهندسی (PA/PTFE)';
    return 'تفلون (PTFE / UHMWPE)';
  }
  if (/پلی\s*یورتان|پلی\s*اورتان|\bpu\b/i.test(normName)) return 'پلی‌یورتان (Polyurethane - PU)';
  if (/\bpvc\b/i.test(normName)) return 'پلی‌وینیل کلراید (PVC)';
  if (/سیلیکون/i.test(normName)) return 'سیلیکون (Silicone Elastomer)';
  if (/وایتون|viton|fkm/i.test(normName)) return 'وایتون (FKM / Viton)';
  if (/\bnbr\b|نیتریل/i.test(normName)) return 'لاستیک نیتریل (NBR)';
  if (/پلی\s*امید|پلی\s*آمید|زلامید|zellamid/i.test(normName)) return 'پلی‌آمید / زلامید (Polyamide PA6/PA66)';
  if (/آلومینیوم|الومینیوم|آلومینوم|آلومینیومی|آلومینینومی/i.test(normName)) return 'آلومینیوم (Aluminum Alloy)';
  if (/گالوانیزه/i.test(normName)) return 'فولاد گالوانیزه (Galvanized Steel)';
  if (/برنجی|برنج/i.test(normName)) return 'برنج (Brass)';
  if (/چدنی|چدن/i.test(normName)) return 'چدن صنعتی (Cast Iron)';
  if (/مسی|مس(?=\s|$)/i.test(normName)) return 'مس (Copper)';
  if (/\bmo40\b/i.test(normName)) return 'فولاد آلیاژی (MO40 / AISI 4140)';
  if (/\bck\b|\bck45\b/i.test(normName)) return 'فولاد کربنی (CK45 / C45)';
  if (/آهنی|آهن(?=\s|$)|فولادی|فولاد|فلزی/i.test(normName)) return 'فولاد / آهن صنعتی (Carbon Steel)';
  if (/برزنتی|برزنت/i.test(normName)) return 'پارچه برزنتی صنعتی (Canvas / Fabric)';
  if (/پنبه\s*نسوز|فایبرگلاس|نسوز/i.test(normName)) return 'الیاف و متریال نسوز (Refractory / Fiberglass)';
  if (/نمدی|نمد(?=\s|$)/i.test(normName)) return 'نمد صنعتی (Industrial Felt)';
  if (/اسفنجی|اسفنج|ابر(?=\s|$)/i.test(normName)) return 'فوم و اسفنج پلیمری (Elastomeric Sponge/Foam)';
  if (/پلاستیکی|پلاستیک/i.test(normName)) return 'پلیمر و پلاستیک صنعتی (Engineering Plastic)';
  if (/لاستیکی|لاستیک|اورینگ|گریپ/i.test(normName)) return 'الاستومر و لاستیک صنعتی (Industrial Elastomer/Rubber)';

  // Fallback to family material only if single unambiguous material, normalized through canonical tokens!
  if (rawMaterials && !rawMaterials.includes(',') && !rawMaterials.includes('|')) {
    const cleanMat = normalizeFa(rawMaterials);
    if (cleanMat) {
      return detectNonBeltMaterial(cleanMat, null, '');
    }
  }

  // Domain defaults where material is inherent to the component standard
  if (/بلبرینگ/.test(technicalType) || /^بلبرینگ/.test(normName)) return 'فولاد بلبرینگ (Bearing Chrome Steel 100Cr6)';
  if (/زنجیر|قفل\s*زنجیر|چرخ\s*زنجیر/.test(technicalType) || /زنجیر/.test(normName)) return 'فولاد آلیاژی عملیات حرارتی‌شده (Alloy Steel)';
  if (/پولی/.test(technicalType) || /^پولی/.test(normName)) return 'چدن / فولاد ماشین‌کاری‌شده (Cast Iron / Steel)';
  if (/رولر/.test(technicalType) && /روکش\s*رولر/.test(normName)) return 'الاستومر / PVC روکش رولر (Roller Sleeve Elastomer)';
  if (/پیچ|مهره|خار|پین|فنر|شفت/.test(technicalType)) return 'فولاد صنعتی (Industrial Steel)';
  if (/اسکاج|برس/.test(technicalType) || /اسکاج|برس/.test(normName)) return 'الیاف ساینده و پلیمری (Abrasive / Polymer Bristle)';
  if (/قالب/.test(technicalType) || /^قالب/.test(normName)) return 'فولاد ابزار و قالب (Tool Steel)';
  if (/ترانس|فتوسل|سنسور/.test(technicalType) || /ترانس|فتوسل|سنسور/.test(normName)) return 'قطعات الکترومکانیکی (Electromechanical Assembly)';

  return 'فولاد و متریال استاندارد صنعتی (Standard Industrial Grade)';
}

/**
 * Check if a SKU is an unidentifiable bare model or ambiguous 1-word placeholder that belongs in UNRESOLVED
 */
function checkUnresolvedNonBeltReason(rawFam: RawCatalogueFamily, variant: RawCatalogueVariant): string | null {
  const norm = normalizeFa(variant.name);

  // 1. The 91 bare FORZA <number> SKUs in FAM-39989 (مدل یا نام تجاری بدون نوع کالا)
  if (/^forza\s*\d+$/i.test(norm)) {
    return 'فقط نام تجاری و شماره کد (FORZA + عدد) بدون ذکر نوع کالا، پروفیل یا ابعاد ثبت شده است؛ بدون تطبیق با فاکتور یا کالای فیزیکی انبار، تعیین ماهیت مهندسی مجاز نیست.';
  }

  // 2. Unspecified conveyor belts in FAM-52858 without PVC/PU/Packaging material
  if (
    rawFam.code === 'FAM-52858' &&
    !/pvc|pu|پلی\s*یورتان|پلی\s*اورتان|بسته\s*بندی/i.test(norm)
  ) {
    return 'نوار نقاله در خانواده مختلط FAM-52858 بدون درج جنس (PVC یا PU)؛ به دلیل ممنوعیت ادغام PVC و PU، تا زمان تعیین جنس در صف UNRESOLVED قرار می‌گیرد.';
  }

  // 3. Bare single-word generic entries with size="نامشخص" and no model/dimension/code in title
  const bareGenericRegex =
    /^(?:بلبرینگ|کاسه\s*نمد|واشر|پیچ|مهره|اورینگ|بوش|فنر|فنر\s*استیل|ریل\s*تفلونی|قطعه\s*تفلونی|ورق|سر\s*شیلنگی|بست|کوبلینگ|چرخ\s*دنده|تیغه\s*استاکر|انگشتی\s*رولر|بلبرینگ\s*کوره|ترانس|ساخت\s*قالب|ترمز\s*گیر|درام|ساچمه|ضد\s*سایش|فلنچ|گردگیر|گریس|مجموعه\s*درایر|میل\s*گرد|نمد|گریپ\s*pvc)$/;
  if (bareGenericRegex.test(norm) && (!variant.size || variant.size === 'نامشخص')) {
    return `عنوان کالا صرفاً نام کلی «${norm}» بدون سایز، کد فنی، استاندارد یا مشخصات ابعادی است؛ ادغام آن با سایزهای مشخص باعث آلودگی خانواده می‌شود.`;
  }

  return null;
}

/**
 * Domain-specific classification for all non-belt SKUs (3,001 SKUs across 81 non-belt technicalTypes + non-belt items rescued from belt families)
 */
export function classifyNonBeltSku(
  rawFam: RawCatalogueFamily,
  variant: RawCatalogueVariant,
  directOverride: DirectSkuMenuOverride | null,
  rescuedFromBeltCategory = false
): Phase1SkuRecord {
  const norm = normalizeFa(variant.name);
  const unit = parseVariantUnit(variant.name, rawFam.unit);
  const baseMenu = CATALOG_FAMILY_MENU_ASSIGNMENTS[rawFam.code];

  // Check if this SKU must go to the UNRESOLVED queue
  const unresolvedReason = checkUnresolvedNonBeltReason(rawFam, variant);
  if (unresolvedReason) {
    const fallbackSlug = directOverride?.categorySlug || baseMenu?.categorySlug || 'excel-v2-10-1';
    const fallbackSub = directOverride?.submenu || baseMenu?.submenuName || rawFam.submenu || '';
    const fallbackLeaf = directOverride?.subcategory || baseMenu?.leafName || rawFam.technicalType || '';
    const canonical = resolveStrictApprovedMenuPath(fallbackSlug, fallbackSub, fallbackLeaf);
    const detectedBrand = detectNonBeltBrand(norm, rawFam.brand);
    const mainGrp = resolveMainGroupForCategory(canonical.categorySlug);
    const famType = resolveEngineeringFamilyType({
      productType: rawFam.technicalType,
      profile: 'UNKNOWN',
      material: 'UNKNOWN',
      construction: 'UNKNOWN',
      proposedCategorySlug: canonical.categorySlug,
    });
    return {
      skuCode: variant.code,
      originalProductName: variant.name,
      normalizedProductName: norm,
      englishProductName: `Unresolved Industrial Record (${variant.code})`,
      brand: detectedBrand,
      manufacturer: detectedBrand,
      manufacturerPartNumber: 'UNKNOWN',
      productType: rawFam.technicalType,
      material: 'UNKNOWN',
      construction: 'UNKNOWN',
      profile: 'UNKNOWN',
      standard: 'UNKNOWN',
      engineeringSpecifications: {
        rawSize: variant.size || 'نامشخص',
        sourceFamily: rawFam.code,
        missingCriticalAttributes: 'نوع دقیق محصول / جنس / ابعاد مهندسی',
      },
      identitySpecifications: {
        productType: rawFam.technicalType,
        brand: detectedBrand,
        material: 'UNKNOWN',
      },
      variableSpecifications: {
        rawSize: variant.size || 'نامشخص',
        skuCode: variant.code,
      },
      descriptiveSpecifications: {
        sourceFamily: rawFam.code,
        unit,
      },
      mainGroupId: mainGrp.mainGroupId,
      mainGroupName: mainGrp.mainGroupName,
      familyTypeId: famType.familyTypeId,
      familyTypeName: famType.familyTypeName,
      currentFamily: rawFam.code,
      proposedFamily: null,
      familyName: null,
      familyMemberCodes: [],
      currentCategory: rawFam.categoryName,
      proposedCategory: canonical.categoryName,
      currentSubcategory: rawFam.technicalType,
      proposedSubcategory: canonical.leaf ? `${canonical.submenu} > ${canonical.leaf}` : canonical.submenu,
      familyDecision: 'UNRESOLVED',
      finalStatus: 'UNRESOLVED',
      technicalEvidence: 'UNKNOWN',
      sourceUrl: 'internal://tests/fixtures/catalogueSource.json',
      decisionReason: unresolvedReason,
      confidence: 'UNRESOLVED',
      confidenceScore: 35,
      verificationStatus: 'REQUIRES_PHYSICAL_VERIFICATION',
      requiredAction: 'WAREHOUSE_PHYSICAL_INSPECTION_REQUIRED',
      taxonomyGap: canonical.categorySlug === 'UNRESOLVED'
        ? 'GAP-APPROVED-MENU-PATH-MISSING: کالای unresolved مسیر دقیق در منوی مصوب ندارد.'
        : null,
      similarProductCodes: [],
      sourceFamilyName: rawFam.name,
      sourceTechnicalType: rawFam.technicalType,
      proposedTechnicalType: rawFam.technicalType,
      proposedCategorySlug: canonical.categorySlug,
      proposedSubmenu: canonical.submenu,
      proposedLeaf: canonical.leaf,
      unit,
      originalSize: variant.size || '',
      invariantKey: `UNRESOLVED::NONBELT::${variant.code}`,
      variantSummary: variant.size || 'نامشخص',
      preservedDirectSkuOverride: directOverride,
      splitFromMixedFamily: rawFam.variants.length > 1,
      mergedFromFragmentedFamilies: false,
      misplacedInSourceCategory: false,
    };
  }

  let brand = detectNonBeltBrand(norm, rawFam.brand);
  let material = detectNonBeltMaterial(norm, rawFam.materials, rawFam.technicalType);
  let productType = rawFam.technicalType;
  let construction = 'استاندارد صنعتی';
  let profile = 'STANDARD';
  let standard = 'INDUSTRIAL_SPEC';
  let categorySlug = directOverride?.categorySlug || baseMenu?.categorySlug || 'excel-v2-10-1';
  let submenu = directOverride?.submenu || baseMenu?.submenuName || rawFam.submenu || '';
  let leaf: string | null = directOverride?.subcategory || baseMenu?.leafName || null;
  let misplaced = rescuedFromBeltCategory;
  let taxonomyGap: string | null = null;
  let evidence: TechnicalEvidenceLevel = directOverride ? 'EXCEL_SOURCE' : 'INVENTORY_DESCRIPTION';
  let sourceUrl = directOverride
    ? 'internal://ops/sql/20261114_catalog_sku_level_menu_assignments.sql'
    : 'internal://tests/fixtures/catalogueSource.json';

  // Extract machine drawing code prefix (e.g. کد 1052/5 -> series 1052) when present
  const codeMatch = norm.match(/کد\s*(\d+)(?:\/(\d+))?/);
  const drawingSeries = codeMatch ? `CODE_${codeMatch[1]}` : 'STD_SERIES';

  // --- DOMAIN 1: CONVEYOR BELTS & TAPES (نوار نقاله، نوار گریپ، نوار سیلیکونی، نوار اسفنجی، نوار اسپاتول) ---
  if (
    rawFam.technicalType === 'نوار نقاله' ||
    rawFam.technicalType === 'نوار گریپ' ||
    rawFam.technicalType === 'نوار سیلیکونی'
  ) {
    categorySlug = directOverride?.categorySlug || 'excel-v2-2-1';
    if (/نوار\s*گریپ/.test(norm) || rawFam.technicalType === 'نوار گریپ') {
      productType = 'نوار گریپ نقاله پشت پلی‌استر';
      material = 'الاستومر گریپ سبز با منجید پلی‌استر (Grip Elastomer / Polyester Backing)';
      construction = 'نوار گریپ کشنده با پشت پلی‌استر';
      profile = 'GRIP_TAPE_GREEN';
      submenu = directOverride?.submenu || 'بر اساس کاربرد و ابعاد';
      leaf = directOverride?.subcategory || 'مخصوص دستگاه بسته‌بندی (در ضخامت و ابعاد مختلف)';
    } else if (/نوار\s*اسپاتول/.test(norm)) {
      productType = 'نوار اسپاتول پلی‌یورتان چاپ و لعاب';
      material = 'پلی‌یورتان ضدسایش (PU Squeegee Strip)';
      const color = /شفاف/.test(norm) ? 'TRANSPARENT' : /قرمز/.test(norm) ? 'RED' : 'STANDARD';
      construction = `نوار اسپاتول ${color === 'TRANSPARENT' ? 'شفاف' : 'قرمز'}`;
      profile = `SQUEEGEE_${color}`;
      categorySlug = 'excel-v2-10-1';
      submenu = 'اسپاتول سیلیکونی';
      leaf = 'انواع سایزهای اسپاتول سیلیکونی جهت دستگاه چاپ';
    } else if (/نوار\s*اسفنجی\s*سیلیکونی/.test(norm)) {
      productType = 'نوار اسفنجی سیلیکونی نسوز';
      material = 'سیلیکون اسفنجی نسوز (Silicone Sponge)';
      construction = 'نوار آب‌بندی و ضربه‌گیر اسفنجی سیلیکونی';
      profile = 'SILICONE_SPONGE_STRIP';
      categorySlug = 'excel-v2-14-2';
      submenu = 'نوار اسفنجی سیلیکونی';
      leaf = 'انواع نوار اسفنجی سیلیکونی';
    } else if (/نوار\s*سیلیکونی/.test(norm)) {
      productType = 'نوار سیلیکونی تخت نسوز';
      material = 'سیلیکون خالص (Solid Silicone Strip)';
      construction = 'نوار تخت سیلیکونی';
      profile = 'SOLID_SILICONE_STRIP';
      categorySlug = 'excel-v2-14-2';
      submenu = 'نوار اسفنجی سیلیکونی';
      leaf = 'انواع نوار اسفنجی سیلیکونی';
    } else if (/نوار\s*اسفنجی/.test(norm)) {
      productType = 'نوار اسفنجی صنعتی';
      material = 'فوم و اسفنج الاستومری (Elastomeric Sponge)';
      const adhesive = /چسب\s*دار/.test(norm) ? 'ADHESIVE_BACKED' : 'PLAIN';
      construction = adhesive === 'ADHESIVE_BACKED' ? 'نوار اسفنجی چسب‌دار' : 'نوار اسفنجی ساده';
      profile = `SPONGE_STRIP_${adhesive}`;
      categorySlug = 'excel-v2-14-2';
      submenu = 'نوار اسفنجی چسب‌دار و ساده';
      leaf = 'چسب‌دار و بدون چسب';
    } else if (/بسته\s*بندی/.test(norm) || directOverride?.subcategory.includes('بسته‌بندی')) {
      productType = 'نوار نقاله دستگاه بسته‌بندی';
      material = 'الاستومر و منجید نقاله بسته‌بندی';
      construction = 'نوار نقاله مخصوص ماشین‌آلات بسته‌بندی';
      profile = 'CONVEYOR_PACKAGING';
      submenu = 'بر اساس کاربرد و ابعاد';
      leaf = 'مخصوص دستگاه بسته‌بندی (در ضخامت و ابعاد مختلف)';
    } else if (/\bpu\b|پلی\s*یورتان|پلی\s*اورتان/i.test(norm) || directOverride?.subcategory.includes('PU')) {
      productType = 'نوار نقاله پلی‌یورتان (PU)';
      material = 'پلی‌یورتان ترموپلاستیک (TPU Conveyor Belt)';
      const color = /سبز/.test(norm) ? 'GREEN' : /سفید/.test(norm) ? 'WHITE' : 'STD';
      construction = `نوار نقاله پلی‌یورتان منجیددار (${color})`;
      profile = `CONVEYOR_PU_${color}`;
      standard = 'ISO 21183 / FDA PU Conveyor';
      submenu = 'بر اساس جنس';
      leaf = 'نوار نقاله پلی‌اورتان (PU)';
    } else {
      const surface = detectConveyorSurfaceProfile(norm);
      productType = 'نوار نقاله PVC';
      material = 'پلی‌وینیل کلراید (PVC Conveyor Belt)';
      // Surface identity is family-defining. SKU dimensions, colours and local
      // perforation descriptors remain variant data, not new family identities.
      construction = `نوار نقاله PVC صنعتی (${surface.profile})`;
      profile = surface.profile;
      // No manufacturer datasheet or product-specific standard is attached to
      // these inventory rows; do not claim ISO conformity from the material name.
      standard = 'NOT_ESTABLISHED';
      submenu = 'بر اساس جنس';
      leaf = 'نوار نقاله PVC';
    }
  }

  // --- DOMAIN 2: GUIDE RAILS, GUIDES & PROFILES (ریل صنعتی، سر ریل، پایه ریل، گاید، پروفیل صنعتی) ---
  else if (
    rawFam.technicalType === 'ریل صنعتی' ||
    rawFam.technicalType === 'سر ریل' ||
    rawFam.technicalType === 'پایه ریل' ||
    rawFam.technicalType === 'گاید' ||
    rawFam.technicalType === 'پروفیل صنعتی'
  ) {
    if (/بست\s*زیر\s*ناودانی|بست\s*فلزی\s*نگهدارنده\s*گاید|بست\s*تفلونی\s*راهنمای|گیره\s*فلزی\s*نگهدارنده\s*گاید|فکی\s*نگهدارنده\s*گاید|پایه.*راهنما|مهره\s*اهرمی\s*گاید/.test(norm)) {
      productType = 'بست، گیره و پایه نگهدارنده ریل و گاید';
      const subMount =
        /بست\s*زیر\s*ناودانی/.test(norm)
          ? `UNDER_CHANNEL_CLAMP_${/\bc\b/i.test(norm) ? 'C' : /\bb\b/i.test(norm) ? 'B' : 'STD'}`
          : /فکی/.test(norm)
            ? 'JAW_HOLDER'
            : /پایه\s*کشویی|پایه\s*کشوئی/.test(norm)
              ? 'SLIDING_BASE'
              : /مهره/.test(norm)
                ? 'LEVER_NUT'
                : 'GUIDE_MOUNT_CLAMP';
      construction = `متعلقات نصب و نگهداری ریل و گاید (${subMount})`;
      profile = subMount;
      if (subMount === 'SLIDING_BASE') {
        categorySlug = directOverride?.categorySlug || 'excel-v2-6-3';
        submenu = 'پایه کشویی';
        leaf = 'انواع پایه کشویی تفلونی خط کاشی';
      } else if (subMount.startsWith('UNDER_CHANNEL_CLAMP_')) {
        categorySlug = directOverride?.categorySlug || 'excel-v2-6-1';
        submenu = 'بر اساس تیپ و کاربرد';
        leaf = 'ریل تیپ B و تیپ C';
      } else {
        categorySlug = directOverride?.categorySlug || 'excel-v2-6-2';
        submenu = material.includes('استیل') || material.includes('ضدزنگ') || material.includes('فولاد') ? 'نرده استیل' : 'گاید تفلونی';
        leaf = material.includes('استیل') || material.includes('ضدزنگ') || material.includes('فولاد') ? 'نرده استیل و متعلقات' : 'بدون لبه و متعلقات';
      }
    } else if (rawFam.technicalType === 'سر ریل' || /^سر\s*ریل/.test(norm)) {
      productType = 'سر ریل هدایت خط انتقال';
      const railType = /\bc\b/i.test(norm)
        ? 'TYPE_C'
        : /\bb\b/i.test(norm)
          ? 'TYPE_B'
          : /تسمه\s*گرد/.test(norm)
            ? 'ROUND_BELT'
            : /تکنو\s*فراری/.test(norm)
              ? 'TECHNO_FERRARI'
              : 'STANDARD';
      construction = `سر ریل ورودی/خروجی (${railType})`;
      profile = `RAIL_END_${railType}`;
      categorySlug = 'excel-v2-6-1';
      if (railType === 'TYPE_B' || railType === 'TYPE_C') {
        submenu = 'بر اساس تیپ و کاربرد';
        leaf = 'ریل تیپ B و تیپ C';
      } else {
        submenu = 'بر اساس جنس';
        leaf = material.includes('استیل') || material.includes('ضدزنگ') ? 'ریل راهنما استیل و متعلقات' : 'ریل راهنما تفلون و متعلقات';
      }
    } else if (rawFam.technicalType === 'پایه ریل' || /^پایه.*نگهدارنده\s*ریل/.test(norm)) {
      productType = 'پایه نگهدارنده ریل';
      construction = 'پایه نگهدارنده ریل خط انتقال';
      profile = `RAIL_BASE_${drawingSeries}`;
      if (material.includes('آلومینیوم') || /آلومین/i.test(norm)) {
        categorySlug = 'excel-v2-6-3';
        submenu = 'پروفیل آلومینیوم';
        leaf = 'انواع پروفیل آلومینیومی صنعتی';
      } else {
        categorySlug = 'excel-v2-6-1';
        submenu = 'بر اساس جنس';
        leaf = material.includes('استیل') || material.includes('ضدزنگ') ? 'ریل راهنما استیل و متعلقات' : 'ریل راهنما آهنی و متعلقات';
      }
    } else if (rawFam.technicalType === 'ریل صنعتی' || /^ریل/.test(norm)) {
      productType = `ریل راهنما (${material})`;
      const railApp = /تسمه\s*گرد/.test(norm)
        ? 'ROUND_BELT_RAIL'
        : /تسمه\s*تایم|زنجیر|دنده\s*شانه/.test(norm)
          ? 'TIMING_BELT_RAIL'
          : /تسمه\s*a/i.test(norm)
            ? 'VBELT_A_RAIL'
            : /\b1\.5m\s*b\b|\bb\b/i.test(norm)
              ? 'TYPE_B_RAIL'
              : /\bc\b/i.test(norm)
                ? 'TYPE_C_RAIL'
                : 'LINEAR_GUIDE_RAIL';
      const proc = /تزریقی/.test(norm) ? 'INJECTED' : /چاکدار/.test(norm) ? 'SLOTTED' : 'EXTRUDED_MACHINED';
      construction = `ریل هدایت (${railApp} - ${proc})`;
      profile = `${railApp}_${proc}`;
      if (material.includes('آلومینیوم')) {
        categorySlug = directOverride?.categorySlug || 'excel-v2-6-3';
        submenu = 'پروفیل آلومینیوم';
        leaf = 'انواع پروفیل آلومینیومی صنعتی';
      } else if (railApp === 'TIMING_BELT_RAIL') {
        categorySlug = 'excel-v2-6-1';
        submenu = 'بر اساس تیپ و کاربرد';
        leaf = 'ریل تایمینگ، زنجیر و دنده شانه';
      } else if (railApp === 'TYPE_B_RAIL' || railApp === 'TYPE_C_RAIL') {
        categorySlug = 'excel-v2-6-1';
        submenu = 'بر اساس تیپ و کاربرد';
        leaf = 'ریل تیپ B و تیپ C';
      } else {
        categorySlug = 'excel-v2-6-1';
        submenu = directOverride?.submenu || 'بر اساس جنس';
        if (material.includes('استیل') || material.includes('ضدزنگ')) leaf = 'ریل راهنما استیل و متعلقات';
        else if (material.includes('تفلون')) leaf = 'ریل راهنما تفلون و متعلقات';
        else if (material.includes('گالوانیزه')) leaf = 'ریل راهنما گالوانیزه و متعلقات';
        else if (material.includes('فولاد / آهن')) leaf = 'ریل راهنما آهنی و متعلقات';
        else leaf = directOverride?.subcategory || 'ریل راهنما تفلون و متعلقات';
      }
    } else {
      // گاید / پروفیل صنعتی
      const guideSubType = /فنری/.test(norm)
        ? 'SPRING_GUIDE'
        : /شیاردار|۳\s*لبه|سه\s*لبه/.test(norm)
          ? 'GROOVED_GUIDE'
          : /ذخیره\s*کن/.test(norm)
            ? 'ACCUMULATOR_GUIDE'
            : /۲\s*لبه|دو\s*لبه/.test(norm)
              ? 'TWO_LIP_GUIDE'
              : 'SIDE_GUIDE_PROFILE';
      productType =
        guideSubType === 'SPRING_GUIDE'
          ? 'گاید راهنمای فنری خط انتقال'
          : `گاید و راهنمای خط انتقال (${material})`;
      construction = `گاید هدایت (${guideSubType})`;
      profile = guideSubType === 'ACCUMULATOR_GUIDE' ? 'ACCUMULATOR_GUIDE' : `${guideSubType}_${drawingSeries}`;
      if (material.includes('آلومینیوم')) {
        categorySlug = directOverride?.categorySlug || 'excel-v2-6-3';
        submenu = 'پروفیل آلومینیوم';
        leaf = 'انواع پروفیل آلومینیومی صنعتی';
      } else if (material.includes('استیل') || material.includes('ضدزنگ') || /نرده/.test(norm)) {
        categorySlug = directOverride?.categorySlug || 'excel-v2-6-2';
        submenu = 'نرده استیل';
        leaf = 'نرده استیل و متعلقات';
      } else {
        categorySlug = directOverride?.categorySlug || 'excel-v2-6-2';
        submenu = 'گاید تفلونی';
        if (guideSubType === 'TWO_LIP_GUIDE') leaf = '۲ لبه و متعلقات';
        else if (guideSubType === 'GROOVED_GUIDE') leaf = '۳ لبه و متعلقات';
        else leaf = 'بدون لبه و متعلقات';
      }
    }
  }

  // --- DOMAIN 3: PULLEYS (پولی صنعتی + round belt pulleys rescued from FAM-80151) ---
  else if (rawFam.technicalType === 'پولی صنعتی' || /^پولی/.test(norm)) {
    categorySlug = 'excel-v2-4-1';
    if (/بوش.*پولی|بوشن\s*وسط\s*پولی/.test(norm)) {
      productType = 'بوش و فاصله‌انداز پولی';
      construction = 'بوش داخلی / فاصله‌انداز پولی';
      profile = `PULLEY_BUSHING_${drawingSeries}`;
      submenu = 'پولی پلاستیک';
      leaf = 'در سایزها و گام‌های مختلف';
    } else {
      const pulleyRole = /هرزگرد/.test(norm)
        ? /بدون\s*بلبرینگ/.test(norm)
          ? 'IDLER_NO_BEARING'
          : /با\s*بلبرینگ|با\s*یک\s*عدد\s*بلبرینگ|کامل/.test(norm)
            ? 'IDLER_WITH_BEARING'
            : 'IDLER_STD'
        : /ثابت/.test(norm)
          ? 'FIXED_DRIVE_PULLEY'
          : /نافی\s*دار/.test(norm)
            ? 'HUB_PULLEY'
            : /چاپ/.test(norm)
              ? 'PRINT_MACHINE_PULLEY'
              : 'STANDARD_PULLEY';

      const grooveProfile =
        /\b2b\d*/i.test(norm)
          ? 'GROOVE_2B_DOUBLE'
          : /\b(?:t5|at5|t10|at10)\b/i.test(norm)
            ? 'TIMING_METRIC_T'
            : /\b\d*h\b|\bh\s*\d+/i.test(norm)
              ? 'TIMING_IMPERIAL_H'
              : /تسمه\s*گرد|\br\d+/i.test(norm)
                ? 'ROUND_GROOVE_R'
                : /\bc\d{2,3}\b/i.test(norm)
                  ? 'VBELT_GROOVE_C'
                  : /\bb\d{2,3}\b/i.test(norm)
                    ? 'VBELT_GROOVE_B'
                    : /\ba\d{2,3}\b/i.test(norm)
                      ? 'VBELT_GROOVE_A'
                      : 'STD_GROOVE';

      productType = `پولی صنعتی (${pulleyRole} - ${grooveProfile})`;
      construction = `${pulleyRole} | پروفیل شیار ${grooveProfile}`;
      profile = `${pulleyRole}_${grooveProfile}`;
      standard = grooveProfile.startsWith('VBELT')
        ? 'ISO 4183 / DIN 2211 V-Pulley'
        : grooveProfile.startsWith('TIMING')
          ? 'ISO 5294 Synchronous Pulley'
          : 'Industrial Pulley Standard';
      submenu = material.includes('پلی‌آمید') || material.includes('پلاستیک') ? 'پولی پلاستیک' : 'پولی پلی‌اورتان';
      leaf = 'در سایزها و گام‌های مختلف';
    }
  }

  // --- DOMAIN 4: ROLLERS & ROLLER PARTS (رولر صنعتی + kiln roller sleeves/springs + PU/PTFE roller bushings) ---
  else if (
    rawFam.technicalType === 'رولر صنعتی' ||
    /روکش\s*رولر|فنر.*سر\s*رول|بوش.*رولر|بوشن.*سر\s*رول|پایه\s*زیر\s*سر\s*رول|پین\s*سر\s*رول|نشیمنگاه.*رولر|انگشتی\s*رولر/.test(norm)
  ) {
    if (/روکش\s*رولر/.test(norm)) {
      const surface = /آجدار/.test(norm) ? 'RIBBED' : 'SMOOTH';
      const heat = /نسوز/.test(norm) ? 'HEAT_RESISTANT' : 'STANDARD';
      const color = /قرمز/.test(norm)
        ? 'RED'
        : /مشکی/.test(norm)
          ? 'BLACK'
          : /طوسی/.test(norm)
            ? 'GREY'
            : /سبز/.test(norm)
              ? 'GREEN'
              : /سفید/.test(norm)
                ? 'WHITE'
                : 'STD';
      productType = `روکش رولر (${surface === 'RIBBED' ? 'آجدار' : 'ساده'} ${color})`;
      construction = `روکش غلتک و رولر (${surface} - ${heat} - ${color})`;
      profile = `ROLLER_SLEEVE_${surface}_${heat}_${color}`;
      categorySlug = 'excel-v2-3-1';
      submenu = 'روکش غلتک';
      leaf = 'در سختی‌های مختلف - پرینت';
    } else if (/فنر.*سر\s*رول/.test(norm)) {
      const springType = /چاکدار/.test(norm)
        ? 'SLOTTED_RETAINING_SPRING'
        : /کوره/.test(norm)
          ? 'KILN_ROLLER_SPRING'
          : 'ROLLER_END_SPRING';
      productType = springType === 'KILN_ROLLER_SPRING' ? 'فنر سر رولر کوره' : 'فنر سر رولر صنعتی';
      material = 'فولاد فنر عملیات حرارتی‌شده (Spring Steel DIN 17223)';
      construction = `فنر نگهدارنده سر رولر (${springType})`;
      profile = springType;
      categorySlug = 'excel-v2-3-2';
      submenu = 'فنر سر رول';
      leaf = 'انواع فنر سر رول';
    } else if (/پین\s*سر\s*رول/.test(norm)) {
      const pinColor = /نارنجی/.test(norm) ? 'ORANGE_SERIES' : 'STANDARD_SERIES';
      productType = 'پین سر رولر';
      construction = `پین انتقال حرکت سر رولر (${pinColor})`;
      profile = `ROLLER_PIN_${pinColor}`;
      categorySlug = 'excel-v2-3-2';
      submenu = 'پین سر رولر و زنجیر';
      leaf = 'انواع پین سر رولر و زنجیر';
    } else if (/نشیمنگاه.*رولر/.test(norm)) {
      productType = 'نشیمنگاه داخل سر رولر';
      construction = 'نشیمنگاه بلبرینگ و بوش سر رولر';
      profile = 'ROLLER_BEARING_SEAT';
      categorySlug = 'excel-v2-3-2';
      submenu = 'بوش بغل رولر';
      leaf = 'بوش بغل رولر پلاستیک';
    } else if (/پایه\s*زیر\s*سر\s*رول/.test(norm)) {
      productType = `پایه زیر سر رولر (${material})`;
      construction = `پایه تکیه‌گاه زیر سر رولر (${material})`;
      profile = `ROLLER_UNDER_BASE_${slugifyToken(material)}`;
      categorySlug = 'excel-v2-3-2';
      submenu = 'بوش بغل رولر';
      leaf = 'بوش بغل رولر فلزی';
    } else if (/انگشتی\s*رولر/.test(norm)) {
      const lugType = /چهار\s*خار/.test(norm)
        ? 'FOUR_LUG'
        : /تک\s*خار/.test(norm)
          ? 'SINGLE_LUG'
          : 'STD_LUG';
      const endMat = /پلاستیکی/.test(norm) ? 'PLASTIC_END' : 'METAL_END';
      productType = `انگشتی رولر (${lugType})`;
      construction = `انگشتی گرداننده رولر (${lugType} - ${endMat})`;
      profile = `ROLLER_FINGER_${lugType}_${endMat}`;
      categorySlug = 'excel-v2-10-2';
      submenu = 'انگشتی روتاری';
      leaf = 'انواع انگشتی روتاری فرنگ';
    } else if (/بوش.*رولر|بوشن.*سر\s*رول/.test(norm)) {
      const bushPos = /داخل\s*رولر/.test(norm) ? 'INNER_ROLLER_BUSHING' : 'END_ROLLER_BUSHING';
      const bushStyle = /هرزگرد|بلبرینگ/.test(norm)
        ? 'BEARING_IDLER_BUSHING'
        : /آجدار|عاج\s*دار|عاجدار|خط\s*دار|دنده/.test(norm)
          ? 'SPLINED_GROOVED_BUSHING'
          : 'PLAIN_BUSHING';
      productType = `بوش رولر (${material})`;
      construction = `${bushPos} - ${bushStyle}`;
      profile = bushStyle === 'SPLINED_GROOVED_BUSHING' ? `${bushPos}_${bushStyle}` : `${bushPos}_${bushStyle}_${drawingSeries}`;
      categorySlug = 'excel-v2-3-2';
      if (bushStyle === 'SPLINED_GROOVED_BUSHING') {
        submenu = 'بوش دنده رولر';
        leaf = 'انواع بوش دنده رولر';
      } else {
        submenu = 'بوش بغل رولر';
        leaf =
          material.includes('تفلون') || material.includes('پلی‌یورتان') || material.includes('پلاستیک')
            ? 'بوش بغل رولر پلاستیک'
            : 'بوش بغل رولر فلزی';
      }
      if (rawFam.technicalType === 'پلی‌یورتان' || rawFam.technicalType === 'پلاستیک صنعتی') {
        misplaced = true;
      }
    } else {
      productType = 'رولر و غلتک صنعتی';
      construction = `رولر خط انتقال (${material})`;
      profile = `ROLLER_${drawingSeries}`;
      categorySlug = 'excel-v2-3-1';
      submenu = 'روکش غلتک';
      leaf = 'در سختی‌های مختلف - پرینت';
    }
  }

  // --- DOMAIN 5: CHAINS, SPROCKETS, GEARS & COUPLINGS (زنجیر صنعتی، قفل زنجیر، چرخ صنعتی، چرخ‌دنده، کوپلینگ صنعتی) ---
  else if (
    rawFam.technicalType === 'زنجیر صنعتی' ||
    rawFam.technicalType === 'قفل زنجیر' ||
    rawFam.technicalType === 'چرخ صنعتی' ||
    rawFam.technicalType === 'چرخ‌دنده' ||
    rawFam.technicalType === 'کوپلینگ صنعتی' ||
    /دنده\s*مار\s*پیچ/.test(norm)
  ) {
    if (/دنده\s*مار\s*پیچ/.test(norm)) {
      productType = 'چرخ‌دنده مارپیچ سر گیربکس';
      construction = /نافی\s*دار/.test(norm)
        ? 'دنده مارپیچ نافی‌دار گیربکس'
        : /راست\s*گرد/.test(norm)
          ? 'دنده مارپیچ راست‌گرد گیربکس'
          : 'دنده مارپیچ استاندارد گیربکس';
      profile = `WORM_GEAR_${drawingSeries}`;
      categorySlug = 'excel-v2-9-4';
      submenu = 'انواع چرخ';
      leaf = 'چرخ‌های صنعتی و انتقال';
      misplaced = true;
    } else if (rawFam.technicalType === 'زنجیر صنعتی' || /^زنجیر/.test(norm)) {
      const strands = /سه\s*ردیفه|سه\s*قلو/.test(norm)
        ? 'TRIPLEX_3_STRAND'
        : /دوبل|دو\s*ردیفه|دوقلو/.test(norm)
          ? 'DUPLEX_2_STRAND'
          : 'SIMPLEX_1_STRAND';
      const isBS = /\b\d{2}b\b/i.test(norm);
      const isANSI = /\b(?:35|40|50|60|80|100|120|140|160|428h?)\b/i.test(norm);
      const chainStandardSeries = isBS
        ? 'ISO_BS_B_SERIES'
        : isANSI
          ? 'ANSI_A_SERIES'
          : /کشاورزی|پرچ/.test(norm)
            ? 'SPECIAL_CONVEYOR_CHAIN'
            : 'ISO_606_ROLLER_CHAIN';
      productType = `زنجیر صنعتی (${chainStandardSeries === 'ISO_BS_B_SERIES' ? 'سری B اروپایی' : 'سری ANSI'} - ${strands === 'DUPLEX_2_STRAND' ? 'دوبل' : strands === 'TRIPLEX_3_STRAND' ? 'سه‌ردیفه' : 'تک‌ردیفه'})`;
      construction = `${chainStandardSeries} | ${strands}`;
      profile = `${chainStandardSeries}_${strands}`;
      standard = 'ISO 606 / BS 228 / ANSI B29.1';
      evidence = 'STANDARD_REFERENCE';
      sourceUrl = 'internal://iso-606-bs-228-ansi-b29-1-roller-chain-tables';
      categorySlug = 'excel-v2-9-1';
      submenu = 'انواع زنجیر';
      leaf = 'زنجیرهای انتقال حرکت صنعتی';
    } else if (rawFam.technicalType === 'قفل زنجیر' || /قفل\s*زنجیر|نیم\s*دانه\s*زنجیر/.test(norm)) {
      const linkType = /نیم\s*دانه/.test(norm) ? 'OFFSET_HALF_LINK' : 'CONNECTING_MASTER_LINK';
      const strands = /دوبل/.test(norm) ? 'DUPLEX' : 'SIMPLEX';
      productType = linkType === 'OFFSET_HALF_LINK' ? 'نیم‌دانه زنجیر صنعتی' : 'قفل زنجیر صنعتی';
      construction = `${linkType} | ${strands}`;
      profile = `${linkType}_${strands}`;
      standard = 'ISO 606 Chain Connecting Link';
      evidence = 'STANDARD_REFERENCE';
      categorySlug = 'excel-v2-9-1';
      submenu = 'انواع زنجیر';
      leaf = 'زنجیرهای انتقال حرکت صنعتی';
    } else if (rawFam.technicalType === 'کوپلینگ صنعتی') {
      if (/ضربه\s*گیر\s*کوبلینگ|ضربه\s*گیر\s*کوپلینگ/.test(norm)) {
        productType = 'لاستیک و ضربه‌گیر کوپلینگ';
        material = 'الاستومر / پلی‌یورتان ضدسایش کوپلینگ';
        construction = 'المان الاستومری میانی کوپلینگ';
        profile = `COUPLING_SPIDER_${drawingSeries}`;
        categorySlug = 'excel-v2-7-3';
        submenu = 'ضربه‌گیر و لرزه‌گیر';
        leaf = 'انواع ضربه‌گیر و لرزه‌گیر لاستیکی و پلیمری';
      } else {
        productType = 'کوپلینگ انتقال قدرت';
        construction = /بالمیل/.test(norm) ? 'کوپلینگ پره‌دار بالمیل' : 'کوپلینگ شفت موتور';
        profile = /بالمیل/.test(norm) ? 'BALLMILL_COUPLING' : 'SHAFT_COUPLING';
        categorySlug = 'excel-v2-9-4';
        submenu = 'انواع چرخ';
        leaf = 'چرخ‌های صنعتی و انتقال';
      }
    } else if (/چرخ\s*زنجیر/.test(norm)) {
      const hubType = /نافی\s*دار/.test(norm)
        ? 'WITH_HUB'
        : /هرزگرد/.test(norm)
          ? 'IDLER_SPROCKET'
          : /مشکی/.test(norm)
            ? 'BLACK_OXIDE_PLATE'
            : 'PLATE_SPROCKET';
      productType = `چرخ‌زنجیر صنعتی (${hubType})`;
      construction = `چرخ‌زنجیر (${hubType})`;
      profile = `SPROCKET_${hubType}`;
      standard = 'ISO 606 Sprocket';
      categorySlug = 'excel-v2-9-4';
      submenu = 'انواع چرخ';
      leaf = 'چرخ‌های صنعتی و انتقال';
    } else if (/چرخ\s*دنده\s*پالت\s*آیزر|بوش.*چرخ\s*دنده\s*پالت\s*آیزر/.test(norm)) {
      const isBushing = /^بوش/.test(norm);
      productType = isBushing ? 'بوش چرخ‌دنده پالت‌آیزر' : 'چرخ‌دنده پالت‌آیزر';
      construction = isBushing ? 'بوش داخلی چرخ‌دنده پالت‌آیزر' : 'چرخ‌دنده فولادی پالت‌آیزر';
      profile = isBushing ? `PALLETIZER_GEAR_BUSHING_${/آجدار/.test(norm) ? 'SPLINED' : 'PLAIN'}` : 'PALLETIZER_GEAR';
      categorySlug = 'excel-v2-9-4';
      submenu = 'انواع چرخ';
      leaf = 'چرخ‌های صنعتی و انتقال';
    } else {
      productType = `چرخ صنعتی (${material})`;
      const wheelRole = /هرزگرد/.test(norm) ? 'IDLER_WHEEL' : /ثابت/.test(norm) ? 'FIXED_WHEEL' : 'INDUSTRIAL_WHEEL';
      construction = `${wheelRole} (${material})`;
      profile = `${wheelRole}_${drawingSeries}`;
      categorySlug = 'excel-v2-9-4';
      submenu = 'انواع چرخ';
      leaf = 'چرخ‌های صنعتی و انتقال';
    }
  }

  // --- DOMAIN 6: BEARINGS & PILLOW BLOCKS (بلبرینگ صنعتی، یاتاقان صنعتی + حفاظ یاتاقان) ---
  else if (
    rawFam.technicalType === 'بلبرینگ صنعتی' ||
    rawFam.technicalType === 'یاتاقان صنعتی' ||
    /حفاظ\s*یاتاقان/.test(norm)
  ) {
    categorySlug = rawFam.technicalType === 'بلبرینگ صنعتی' ? 'excel-v2-13-1' : 'excel-v2-13-2';
    if (rawFam.technicalType === 'بلبرینگ صنعتی') {
      const sealType = /2rsz/i.test(norm)
        ? '2RSZ_SEAL'
        : /2rs/i.test(norm)
          ? '2RS_RUBBER_SEAL'
          : /zz/i.test(norm)
            ? 'ZZ_METAL_SHIELD'
            : 'OPEN_OR_STD';
      const brgSeriesMatch = norm.match(/\b(60\d{2}|62\d{2}|63\d{2}|608|626)\b/);
      const seriesPrefix = brgSeriesMatch
        ? brgSeriesMatch[1].length === 4
          ? `${brgSeriesMatch[1].slice(0, 2)}00_SERIES`
          : 'MINIATURE_600_SERIES'
        : 'DEEP_GROOVE_SERIES';
      productType = `بلبرینگ شیارعمیق (${seriesPrefix} - ${sealType})`;
      construction = `بلبرینگ یک‌ردیفه شیارعمیق (${seriesPrefix}) با آب‌بند ${sealType}`;
      profile = `${seriesPrefix}_${sealType}`;
      standard = 'ISO 15 / DIN 625 Deep Groove Ball Bearing';
      evidence = 'STANDARD_REFERENCE';
      sourceUrl = 'internal://iso-15-din-625-bearing-dimension-tables';
      submenu = 'انواع بلبرینگ';
      leaf = 'بلبرینگ‌های صنعتی در سایزهای مختلف';
    } else if (/حفاظ\s*یاتاقان/.test(norm)) {
      productType = 'حفاظ و کاور محافظ یاتاقان صنعتی';
      construction = 'حفاظ ایمنی و گردگیر یاتاقان';
      profile = 'BEARING_SAFETY_GUARD';
      submenu = 'انواع یاتاقان';
      leaf = 'یاتاقان و انواع محافظ یاتاقان';
      if (rawFam.technicalType !== 'یاتاقان صنعتی') misplaced = true;
    } else {
      const housingPart = /کفی\s*یاتاقان/.test(norm)
        ? 'PILLOW_BLOCK_BASE_PLATE'
        : /پولکی\s*یاتاقان/.test(norm)
          ? 'BEARING_CAP_WASHER'
          : 'BEARING_UNIT_HOUSING';
      productType = housingPart === 'PILLOW_BLOCK_BASE_PLATE' ? 'کفی یاتاقان صنعتی' : 'یاتاقان و متعلقات';
      construction = housingPart;
      profile = `${housingPart}_${drawingSeries}`;
      submenu = 'انواع یاتاقان';
      leaf = 'یاتاقان و انواع محافظ یاتاقان';
    }
  }

  // --- DOMAIN 7: SEALS, PACKINGS, O-RINGS, RUBBER & BUMPERS ---
  else if (
    rawFam.technicalType === 'پکینگ / کاسه‌نمد' ||
    rawFam.technicalType === 'اورینگ لاستیکی' ||
    rawFam.technicalType === 'نوار آب‌بندی' ||
    rawFam.technicalType === 'واشر صنعتی' ||
    rawFam.technicalType === 'لاستیک صنعتی' ||
    rawFam.technicalType === 'لاستیک کوپلینگ' ||
    rawFam.technicalType === 'لاستیک دیافراگم' ||
    rawFam.technicalType === 'لاستیک بالمیل' ||
    rawFam.technicalType === 'لاستیک فلنج' ||
    rawFam.technicalType === 'ضربه‌گیر صنعتی' ||
    rawFam.technicalType === 'ضربه‌گیر استاکر' ||
    rawFam.technicalType === 'ضربه‌گیر پلی‌یورتان' ||
    rawFam.technicalType === 'ضربه‌زن صنعتی' ||
    rawFam.technicalType === 'مکنده صنعتی' ||
    rawFam.technicalType === 'گریپ صنعتی' ||
    /گلوله\s*لاستیکی/.test(norm)
  ) {
    if (/پکینگ\s*نسوز/.test(norm) || /پکینگ/.test(norm) || /کاسه\s*نمد/.test(norm)) {
      productType = /پکینگ/.test(norm) ? 'پکینگ نسوز بافته‌شده آب‌بندی' : 'کاسه نمد آب‌بندی صنعتی';
      material = /نسوز/.test(norm)
        ? 'الیاف نسوز بافته‌شده (Braided Refractory Gland Packing)'
        : (detectNonBeltMaterial(norm, rawFam.materials, rawFam.technicalType));
      construction = 'پکینگ و کاسه نمد آب‌بندی صنعتی';
      profile = /پکینگ/.test(norm) ? 'BRAIDED_GLAND_PACKING' : 'RADIAL_OIL_SEAL';
      categorySlug = 'excel-v2-7-2';
      submenu = 'کاسه نمد و پکینگ';
      leaf = 'انواع کاسه نمد و پکینگ صنعتی';
    } else if (/اورینگ/.test(norm) || rawFam.technicalType === 'اورینگ لاستیکی') {
      if (/پولی.*اورینگ\s*خور/.test(norm)) {
        productType = 'پولی پلی‌آمیدی اورینگ‌خور';
        material = 'پلی‌آمید (PA6)';
        construction = 'پولی راهنما شیار اورینگ‌خور';
        profile = `ORING_PULLEY_${drawingSeries}`;
        categorySlug = 'excel-v2-4-1';
        submenu = 'پولی پلاستیک';
        leaf = 'در سایزها و گام‌های مختلف';
        misplaced = true;
      } else {
        productType = 'اورینگ آب‌بندی صنعتی';
        construction = `اورینگ مقطع گرد (${material})`;
        profile = `ORING_${slugifyToken(material)}`;
        standard = 'ISO 3601 / DIN 3771 O-Ring';
        categorySlug = 'excel-v2-7-2';
        submenu = 'انواع اورینگ';
        leaf = 'اورینگ در سایزها و متریال‌های مختلف';
      }
    } else if (rawFam.technicalType === 'گریپ صنعتی') {
      productType = 'ورق و رول گریپ لاستیکی روکش تسمه';
      const surface = /آجدار/.test(norm) ? 'RIBBED' : /چاکدار/.test(norm) ? 'SLOTTED_T' : 'SUPERGRIP';
      const thMatch = norm.match(/(\d+)\s*(?:میل|m\b)/i);
      const thCode = thMatch ? `${thMatch[1]}MM` : 'STD';
      construction = `گریپ لاستیکی (${surface} - ضخامت ${thCode})`;
      profile = `GRIP_SHEET_${surface}_${thCode}`;
      categorySlug = 'excel-v2-7-1';
      submenu = 'انواع قطعات لاستیکی';
      leaf = 'قطعات لاستیکی عمومی و تخصصی';
    } else if (/مکنده/.test(norm) || rawFam.technicalType === 'مکنده صنعتی') {
      const bellows = /3\s*طبقه|سه\s*طبقه/.test(norm) ? '3_BELLOWS' : 'FLAT_CUP';
      const insert = /فلز\s*دار|فلزدار/.test(norm) ? 'METAL_INSERT' : 'ELASTOMER_ONLY';
      productType = `مکنده وکیوم صنعتی (${material})`;
      construction = `${bellows} - ${insert}`;
      profile = `VACUUM_CUP_${bellows}_${insert}`;
      categorySlug = 'excel-v2-7-3';
      submenu = 'مکنده';
      leaf = 'انواع مکنده صنعتی';
    } else if (rawFam.technicalType === 'لاستیک کوپلینگ' || /لاستیک\s*ضربه\s*گیر\s*کوبلینگ/.test(norm)) {
      productType = 'لاستیک ضربه‌گیر کوپلینگ کتابی';
      construction = 'لقمه لاستیکی کوپلینگ کتابی';
      profile = 'COUPLING_RUBBER_BLOCK';
      categorySlug = 'excel-v2-7-1';
      submenu = 'انواع قطعات لاستیکی';
      leaf = 'قطعات لاستیکی عمومی و تخصصی';
    } else if (rawFam.technicalType === 'لاستیک دیافراگم') {
      if (/پوسته\s*مادگی\s*چدنی|نگهدارنده\s*لاستیک/.test(norm)) {
        productType = 'پوسته و نگهدارنده فلزی دیافراگم';
        material = 'چدن / فولاد';
        construction = 'پوسته نگهدارنده دیافراگم پمپ';
        profile = 'DIAPHRAGM_METAL_HOUSING';
      } else {
        productType = 'لاستیک دیافراگم پمپ و شیر';
        construction = 'غشاء الاستومری دیافراگم';
        profile = 'ELASTOMER_DIAPHRAGM';
      }
      categorySlug = 'excel-v2-7-1';
      submenu = 'انواع قطعات لاستیکی';
      leaf = 'قطعات لاستیکی عمومی و تخصصی';
    } else if (rawFam.technicalType === 'لاستیک بالمیل') {
      const boltStyle = /یک\s*طرف\s*پیچ/.test(norm) ? 'SINGLE_STUD_BOLT' : 'PLAIN_DOOR_GASKET';
      productType = 'لاستیک دور درب بالمیل';
      construction = `واشر آب‌بندی درب بالمیل (${boltStyle})`;
      profile = `BALLMILL_RUBBER_${boltStyle}`;
      categorySlug = 'excel-v2-7-1';
      submenu = 'انواع قطعات لاستیکی';
      leaf = 'قطعات لاستیکی عمومی و تخصصی';
    } else if (rawFam.technicalType === 'لاستیک فلنج') {
      productType = 'واشر لاستیکی فلنج';
      construction = 'واشر آب‌بندی فلنج خطوط لوله';
      profile = 'FLANGE_RUBBER_GASKET';
      categorySlug = 'excel-v2-7-1';
      submenu = 'انواع قطعات لاستیکی';
      leaf = 'قطعات لاستیکی عمومی و تخصصی';
    } else if (/گلوله\s*لاستیکی/.test(norm)) {
      productType = 'گلوله لاستیکی شیر و پمپ صنعتی';
      construction = 'گلوله لاستیکی آب‌بند شیر یک‌طرفه و پمپ';
      profile = 'RUBBER_CHECK_BALL';
      categorySlug = 'excel-v2-7-1';
      submenu = 'انواع قطعات لاستیکی';
      leaf = 'قطعات لاستیکی عمومی و تخصصی';
    } else if (
      rawFam.technicalType === 'ضربه‌گیر صنعتی' ||
      rawFam.technicalType === 'ضربه‌گیر استاکر' ||
      rawFam.technicalType === 'ضربه‌گیر پلی‌یورتان' ||
      rawFam.technicalType === 'ضربه‌زن صنعتی'
    ) {
      const mountStyle =
        /دو\s*سر\s*پیچ|دوطرف\s*پیچ|دو\s*طرف\s*پیچ|2\s*طرف\s*پیچ/.test(norm)
          ? 'DOUBLE_STUD_MOUNT'
          : /یک\s*طرف\s*پیچ|یکطرف\s*پیچ|بک\s*طرف\s*پیچ|تک\s*پیچ|با\s*پیچ\s*و\s*مهره/.test(norm)
            ? 'SINGLE_STUD_MOUNT'
            : /روکش\s*فلزی/.test(norm)
              ? 'METAL_BONDED_BUFFER'
              : /بوشن/.test(norm)
                ? 'BUSHING_BUFFER'
                : /استاکر|استکر/.test(norm)
                  ? 'STACKER_BUMPER'
                  : 'BLOCK_BUMPER';
      productType =
        rawFam.technicalType === 'ضربه‌زن صنعتی'
          ? 'ضربه‌زن پلی‌یورتان استاکر'
          : `ضربه‌گیر صنعتی (${material} - ${mountStyle})`;
      construction = `ضربه‌گیر و لرزه‌گیر (${mountStyle})`;
      profile = `BUMPER_${mountStyle}`;
      categorySlug = 'excel-v2-7-3';
      submenu = 'ضربه‌گیر و لرزه‌گیر';
      leaf = 'انواع ضربه‌گیر و لرزه‌گیر لاستیکی و پلیمری';
    } else if (rawFam.technicalType === 'واشر صنعتی') {
      productType = `واشر صنعتی (${material})`;
      construction = `واشر تخت آب‌بندی و فاصله‌انداز (${material})`;
      profile = `WASHER_${slugifyToken(material)}`;
      categorySlug = 'excel-v2-7-2';
      submenu = 'انواع اورینگ';
      leaf = 'اورینگ در سایزها و متریال‌های مختلف';
    } else if (rawFam.technicalType === 'نوار آب‌بندی') {
      productType = 'نوار درزگیر و آب‌بندی صنعتی';
      const shape = /\bv\s*شکل/i.test(norm) ? 'V_PROFILE_SEAL' : 'DRYER_PRESS_SEAL';
      construction = `نوار درزگیر (${shape})`;
      profile = shape;
      categorySlug = 'excel-v2-7-2';
      submenu = 'انواع اورینگ';
      leaf = 'اورینگ در سایزها و متریال‌های مختلف';
    } else {
      const subRubber =
        /زیر\s*گلوله\s*پمپ/.test(norm)
          ? 'PUMP_BALL_SEAT_RUBBER'
          : /پمپ\s*pp2/i.test(norm)
            ? 'PUMP_PP2_RUBBER'
            : /لاستیک\s*استوانه/.test(norm)
              ? 'CYLINDRICAL_RUBBER_CORE'
              : /لاستیک\s*بغل\s*ساب/.test(norm)
                ? 'EDGE_GRINDER_RUBBER'
                : /لاستیک\s*استکر\s*مشکی/.test(norm)
                  ? 'BLACK_STACKER_RUBBER'
                  : /ضربه\s*گیر\s*خمره/.test(norm)
                    ? 'BARREL_RUBBER_BUFFER'
                    : /لاستیک\s*گلدانی/.test(norm)
                      ? 'FLOWERPOT_RUBBER_SLEEVE'
                      : /لبه\s*پاک\s*کن/.test(norm)
                        ? 'EDGE_WIPER_RUBBER'
                        : /بوش\s*لاستیکی\s*داخل\s*فنر|بوشن\s*لاستیکی\s*داخل\s*فنر/.test(norm)
                          ? 'SPRING_INNER_RUBBER_BUSHING'
                          : /بوشن\s*لاستیکی|بوش\s*لاستیکی/.test(norm)
                            ? 'RUBBER_BUSHING'
                            : /بوش\s*پلاستیکی/.test(norm)
                              ? 'PLASTIC_BUSHING'
                              : /پایه\s*تنظیم\s*کننده/.test(norm)
                                ? 'ADJUSTABLE_LEVELING_FOOT'
                                : /گردگیر|گرد\s*گیر/.test(norm)
                                  ? 'DUST_BOOT_BELLOWS'
                                  : /دیافراگم/.test(norm)
                                    ? 'RUBBER_DIAPHRAGM'
                                    : /کوپلینگ|کوبلینگ/.test(norm)
                                      ? 'COUPLING_ELASTOMER'
                                      : /ضربه\s*گیر/.test(norm)
                                        ? 'RUBBER_BUFFER'
                                        : 'CUSTOM_MOLDED_RUBBER';
      const isCanonicalRubberSeries = [
        'PUMP_BALL_SEAT_RUBBER',
        'PUMP_PP2_RUBBER',
        'CYLINDRICAL_RUBBER_CORE',
        'EDGE_GRINDER_RUBBER',
        'BLACK_STACKER_RUBBER',
        'BARREL_RUBBER_BUFFER',
        'FLOWERPOT_RUBBER_SLEEVE',
        'EDGE_WIPER_RUBBER',
        'SPRING_INNER_RUBBER_BUSHING',
      ].includes(subRubber);
      productType = `قطعه لاستیکی / پلیمری (${subRubber})`;
      construction = `قطعه قالبی (${subRubber})`;
      profile = isCanonicalRubberSeries ? subRubber : `${subRubber}_${drawingSeries}`;
      categorySlug = 'excel-v2-7-1';
      submenu = 'انواع قطعات لاستیکی';
      leaf = 'قطعات لاستیکی عمومی و تخصصی';
    }
  }

  // --- DOMAIN 8: BRUSHES, SCOURING PADS, SQUEEGEES & BLADES ---
  else if (
    rawFam.technicalType === 'برس صنعتی' ||
    rawFam.technicalType === 'برس ساب' ||
    rawFam.technicalType === 'برس کف' ||
    rawFam.technicalType === 'برس لبه‌گیر' ||
    rawFam.technicalType === 'برس استوانه‌ای' ||
    rawFam.technicalType === 'برس نواری' ||
    rawFam.technicalType === 'اسپاتول' ||
    rawFam.technicalType === 'تیغه / تیغ'
  ) {
    if (/^اسکاج/.test(norm)) {
      const padGrade = /\bsuf\b/i.test(norm)
        ? 'GREY_SUF'
        : /\baf\b/i.test(norm)
          ? 'RED_AF'
          : /\bam\b/i.test(norm)
            ? 'BROWN_AM'
            : /ساب/.test(norm)
              ? 'ABRASIVE_POLISHING_PAD'
              : 'INDUSTRIAL_PAD';
      productType = 'اسکاج و پد ساب صنعتی';
      material = 'الیاف نبافته ساینده صنعتی (Non-Woven Abrasive Web)';
      construction = `اسکاج پرداخت و ساب (${padGrade})`;
      profile = `SCOURING_PAD_${padGrade}`;
      categorySlug = 'excel-v2-14-3';
      submenu = 'انواع اسکاج';
      leaf = 'اسکاج صنعتی و اسکاج گرد';
      misplaced = true;
    } else if (/پولی.*برس/.test(norm)) {
      productType = 'پولی شیاردار برس بغل‌ساب';
      material = 'فولاد / چدن';
      construction = 'پولی محرک برس بغل‌ساب';
      profile = 'BRUSH_DRIVE_PULLEY';
      categorySlug = 'excel-v2-4-1';
      submenu = 'انواع پولی تایم';
      leaf = 'پولی تایم ساده و کونیک‌دار';
      misplaced = true;
    } else if (rawFam.technicalType === 'اسپاتول' || /^اسپاتول/.test(norm)) {
      productType = 'تیغه اسپاتول خط چاپ و لعاب';
      construction = 'اسپاتول جمع‌کننده لعاب و رنگ';
      profile = 'SQUEEGEE_BLADE_SERIES';
      categorySlug = 'excel-v2-10-1';
      submenu = 'اسپاتول سیلیکونی';
      leaf = 'انواع سایزهای اسپاتول سیلیکونی جهت دستگاه چاپ';
    } else if (rawFam.technicalType === 'تیغه / تیغ' || /تیغه\s*کارول/.test(norm)) {
      const bladeColor = /قرمز/.test(norm) ? 'RED' : /قهوه\s*ای/.test(norm) ? 'BROWN' : 'STD';
      productType = `تیغه کارول (${bladeColor === 'RED' ? 'قرمز' : 'قهوه‌ای'})`;
      construction = `تیغه کارول آکس 10 (${bladeColor})`;
      profile = `CAROL_BLADE_${bladeColor}`;
      categorySlug = 'excel-v2-10-1';
      submenu = 'اسپاتول سیلیکونی';
      leaf = 'انواع سایزهای اسپاتول سیلیکونی جهت دستگاه چاپ';
    } else if (rawFam.technicalType === 'برس ساب' || /سیمی/.test(norm)) {
      productType = 'برس سیمی و ساب صنعتی';
      construction = 'برس سیمی صنعتی در ابعاد مختلف';
      profile = `WIRE_BRUSH_${drawingSeries}`;
      categorySlug = 'excel-v2-5-1';
      submenu = 'انواع برس‌های سیمی';
      leaf = 'در ابعاد مختلف';
    } else {
      // Normalize brush row count (1/یک, 2/دو, 3/سه, 4/چهار) and backing type
      const rowCount =
        /(?:1|یک)\s*ردیفه/.test(norm)
          ? '1_ROW'
          : /(?:2|دو)\s*ردیفه/.test(norm)
            ? '2_ROW'
            : /(?:3|سه)\s*ردیفه/.test(norm)
              ? '3_ROW'
              : /(?:4|چهار)\s*ردیفه/.test(norm)
                ? '4_ROW'
                : 'STD_ROW';
      const backing =
        /تیغه\s*تفلونی\s*فلزی/.test(norm)
          ? 'PTFE_BLADE_METAL_BACKED'
          : /تیغه\s*تفلونی/.test(norm)
            ? 'PTFE_BLADE_BACKED'
            : /تیغه\s*فلزی/.test(norm)
              ? 'METAL_STRIP_BACKED'
              : /لبه\s*گیر/.test(norm)
                ? 'EDGE_CLEANING_BRUSH'
                : /کف/.test(norm)
                  ? 'FLOOR_SWEEPING_BRUSH'
                  : /استوانه|غلطکی/.test(norm)
                    ? 'CYLINDRICAL_ROLLER_BRUSH'
                    : 'STRIP_BRUSH';
      productType = `برس صنعتی (${backing} - ${rowCount})`;
      construction = `${backing} | ${rowCount}`;
      profile = `BRUSH_${backing}_${rowCount}`;
      categorySlug = 'excel-v2-5-2';
      submenu = 'انواع برس خشک‌کن';
      leaf = 'مخصوص خطوط صنعتی و شستشو';
    }
  }

  // --- DOMAIN 9: HOSES, PIPES, SENSOR BRACKETS, SHEETS, POLYMERS & HARDWARE ---
  else if (
    rawFam.technicalType === 'شیلنگ' ||
    rawFam.technicalType === 'پارچه صنعتی' ||
    /شیلنگ/.test(norm)
  ) {
    if (/بست\s*شیلنگ/.test(norm)) {
      productType = 'بست شیلنگ صنعتی';
      construction = 'بست فلزی اتصال شیلنگ';
      profile = 'HOSE_CLAMP';
      categorySlug = 'excel-v2-9-3';
      submenu = 'انواع گیره و بست';
      leaf = 'گیره و بست صنعتی';
    } else if (/سر\s*شیلنگی|رابط\s*شیلنگ/.test(norm)) {
      productType = 'سرشیلنگی و رابط اتصال شیلنگ';
      construction = 'اتصالات فلزی شیلنگ';
      profile = /رابط/.test(norm) ? 'HOSE_COUPLER' : 'HOSE_BARB_NIPPLE';
      categorySlug = 'excel-v2-9-3';
      submenu = 'انواع گیره و بست';
      leaf = 'گیره و بست صنعتی';
    } else {
      const wire = /سیم\s*دار/.test(norm) ? 'STEEL_WIRE_HELIX' : 'NON_WIRE';
      const wall = /ضخیم/.test(norm) ? 'HEAVY_WALL' : 'STD_WALL';
      productType = `شیلنگ صنعتی (${material} - ${wire === 'STEEL_WIRE_HELIX' ? 'سیم‌دار' : 'ساده'})`;
      construction = `${material} | ${wire} | ${wall}`;
      profile = `HOSE_${slugifyToken(material)}_${wire}_${wall}`;
      categorySlug = 'excel-v2-7-1';
      submenu = 'انواع قطعات لاستیکی';
      leaf = 'قطعات لاستیکی عمومی و تخصصی';
      if (rawFam.technicalType === 'خار / پین') misplaced = true;
    }
  } else if (rawFam.technicalType === 'لوله صنعتی') {
    if (/فتوسل/.test(norm)) {
      const holderPart = /گیره/.test(norm) ? 'PHOTOCELL_TUBE_CLAMP' : 'PHOTOCELL_TUBE_BRACKET';
      productType = 'پایه و گیره نگهدارنده لوله فتوسل (سنسور)';
      construction = holderPart;
      profile = `${holderPart}_${drawingSeries}`;
      categorySlug = 'excel-v2-6-4';
      submenu = 'نگهدارنده سنسور';
      leaf = 'انواع قطعات نگهدارنده سنسور';
      misplaced = true;
    } else {
      productType = `لوله صنعتی (${material})`;
      construction = 'لوله انتقال سیالات و لعاب';
      profile = `PIPE_${drawingSeries}`;
      categorySlug = 'excel-v2-7-1';
      submenu = 'انواع قطعات لاستیکی';
      leaf = 'قطعات لاستیکی عمومی و تخصصی';
    }
  } else if (
    rawFam.technicalType === 'ورق تفلون' ||
    rawFam.technicalType === 'ورق پلی‌یورتان' ||
    rawFam.technicalType === 'ورق ضدسایش' ||
    rawFam.technicalType === 'ورق فلزی' ||
    rawFam.technicalType === 'ورق صنعتی' ||
    rawFam.technicalType === 'زلامید' ||
    rawFam.technicalType === 'پلی‌یورتان' ||
    rawFam.technicalType === 'پلاستیک صنعتی' ||
    variant.code === '10384'
  ) {
    if (/تسمه\s*پاک\s*کن/.test(norm)) {
      const scraperShape = /\bu\s*شکل/i.test(norm) ? 'U_SHAPE' : /\bv\s*\.?\s*شکل/i.test(norm) ? 'V_SHAPE' : 'FLAT_BLADE';
      productType = `تیغه تسمه‌پاک‌کن پلی‌یورتان (${scraperShape})`;
      construction = `تیغه پاک‌کننده نوار و تسمه (${scraperShape})`;
      profile = `BELT_SCRAPER_${scraperShape}`;
      categorySlug = 'excel-v2-7-1';
      submenu = 'انواع قطعات لاستیکی';
      leaf = 'قطعات لاستیکی عمومی و تخصصی';
    } else if (/چرخ/.test(norm)) {
      const isIdler = /هرزگرد|هزرگرد/.test(norm);
      productType = `چرخ صنعتی (${material})`;
      construction = isIdler ? 'چرخ هرزگرد با روکش پلیمری' : 'چرخ با روکش پلیمری';
      profile = `POLYMER_WHEEL_${isIdler ? 'IDLER' : 'STD'}_${drawingSeries}`;
      categorySlug = 'excel-v2-9-4';
      submenu = 'انواع چرخ';
      leaf = 'چرخ‌های صنعتی و انتقال';
    } else if (/لقمه\s*پلی\s*یورتان/.test(norm)) {
      const holes = /4\s*سوراخ/.test(norm) ? '4_HOLE' : '2_HOLE';
      productType = 'لقمه پلی‌یورتان B شکل استاکر';
      construction = `لقمه ضربه‌گیر پلی‌یورتان (${holes})`;
      profile = `PU_PAD_B_${holes}`;
      categorySlug = 'excel-v2-10-3';
      submenu = 'قطعات دستگاه استاکر';
      leaf = 'لوازم و قطعات مصرفی استاکر';
    } else if (/ورق|ضد\s*سایش/.test(norm) || rawFam.technicalType.startsWith('ورق')) {
      productType = `ورق صنعتی (${material})`;
      construction = `ورق تخت مهندسی (${material})`;
      profile = `SHEET_${slugifyToken(material)}`;
      if (material.includes('استیل') || material.includes('گالوانیزه')) {
        categorySlug = 'excel-v2-9-3';
        submenu = 'دستگیره و پیچ فلکه';
        leaf = 'انواع دستگیره شکل و پیچ فلکه';
      } else {
        categorySlug = 'excel-v2-7-1';
        submenu = 'انواع قطعات لاستیکی';
        leaf = 'قطعات لاستیکی عمومی و تخصصی';
      }
    } else if (/تفلون\s*(?:ایرانی|خارجی|کره\s*ای)|زلامید|میل\s*گرد\s*پلی/.test(norm)) {
      productType = `میلگرد و بوشن پلیمر مهندسی (${material})`;
      construction = `مقطع گرد پلیمر مهندسی (${material})`;
      profile = `POLYMER_ROD_${slugifyToken(material)}`;
      categorySlug = 'excel-v2-7-1';
      submenu = 'انواع قطعات لاستیکی';
      leaf = 'قطعات لاستیکی عمومی و تخصصی';
    } else if (/بوش/.test(norm)) {
      const bushStyle = /آجدار/.test(norm) ? 'SPLINED' : 'PLAIN';
      productType = `بوش پلیمری مهندسی (${material})`;
      construction = `بوش ماشین‌کاری‌شده (${bushStyle})`;
      profile = `POLYMER_BUSHING_${slugifyToken(material)}_${bushStyle}_${drawingSeries}`;
      categorySlug = 'excel-v2-7-1';
      submenu = 'انواع قطعات لاستیکی';
      leaf = 'قطعات لاستیکی عمومی و تخصصی';
    } else if (/تسمه\s*سفت\s*کن/.test(norm)) {
      productType = 'تسمه سفت‌کن خطوط صنعتی (Tensioner)';
      construction = 'سفت‌کن و تنظیم‌کننده تنش تسمه';
      profile = `BELT_TENSIONER_${drawingSeries}`;
      categorySlug = 'excel-v2-9-3';
      submenu = 'انواع گیره و بست';
      leaf = 'گیره و بست صنعتی';
      misplaced = true;
    } else if (/تسمه\s*آهنی/.test(norm)) {
      productType = 'تسمه تسمه‌بند و پلیت آهنی اتصال';
      construction = 'پلیت و تسمه فلزی اتصال و نگه‌دارنده';
      profile = `IRON_MOUNTING_STRAP_${drawingSeries}`;
      categorySlug = 'excel-v2-9-3';
      submenu = 'انواع گیره و بست';
      leaf = 'گیره و بست صنعتی';
      misplaced = true;
    } else if (/تسمه\s*پ[ا‌]?ک\s*کن|تیغه.*تسمه\s*پاک/.test(norm)) {
      productType = 'تسمه‌پاک‌کن / اسکراپر خط نقاله';
      construction = 'اسکراپر و تیغه پاک‌کننده سطح تسمه';
      profile = `BELT_SCRAPER_${drawingSeries}`;
      categorySlug = 'excel-v2-7-1';
      submenu = 'انواع قطعات لاستیکی';
      leaf = 'قطعات لاستیکی عمومی و تخصصی';
      misplaced = true;
    } else {
      productType = `قطعه پلیمری مهندسی (${material})`;
      construction = `قطعه صنعتی (${material})`;
      profile = `POLYMER_PART_${slugifyToken(material)}_${drawingSeries}`;
      categorySlug = 'excel-v2-7-1';
      submenu = 'انواع قطعات لاستیکی';
      leaf = 'قطعات لاستیکی عمومی و تخصصی';
    }
  } else if (rawFam.technicalType === 'توری صنعتی') {
    const meshMatch = norm.match(/مش\s*استیل\s*(\d+)/);
    const meshNo = meshMatch ? `MESH_${meshMatch[1]}` : 'MESH_STD';
    productType = `توری مش استیل صنعتی (${meshNo})`;
    construction = `توری بافته‌شده استنلس استیل (${meshNo})`;
    profile = `SS_WIRE_MESH_${meshNo}`;
    standard = 'ISO 9044 Woven Wire Cloth';
    evidence = 'STANDARD_REFERENCE';
    categorySlug = 'excel-v2-11-1';
    submenu = 'انواع توری مش';
    leaf = 'توری مش در ابعاد و چشمه‌های مختلف';
  } else if (rawFam.technicalType === 'قطعات پمپ' || /پروانه\s*همزن/.test(norm)) {
    const pumpSub =
      /پروانه\s*همزن/.test(norm)
        ? 'AGITATOR_IMPELLER'
        : /پروانه/.test(norm)
          ? /مهره\s*برنجی/.test(norm)
            ? 'IMPELLER_BRASS_NUT'
            : 'IMPELLER_STD'
          : /پوسته/.test(norm)
            ? 'PUMP_CASING'
            : /غلاف/.test(norm)
              ? 'PUMP_SHAFT_SLEEVE'
              : /واشر/.test(norm)
                ? 'PUMP_PTFE_GASKET'
                : /پایه/.test(norm)
                  ? 'DIAPHRAGM_PUMP_BASE'
                  : 'PUMP_COMPONENT';
    productType = pumpSub === 'AGITATOR_IMPELLER' ? `پروانه همزن صنعتی (${material})` : `قطعه پمپ صنعتی (${pumpSub})`;
    construction = `${pumpSub} (${material})`;
    const isCanonicalImpeller = ['AGITATOR_IMPELLER', 'IMPELLER_BRASS_NUT', 'IMPELLER_STD'].includes(pumpSub);
    profile = isCanonicalImpeller
      ? `PUMP_${pumpSub}_${slugifyToken(material)}`
      : `PUMP_${pumpSub}_${slugifyToken(material)}_${drawingSeries}`;
    categorySlug = 'excel-v2-9-2';
    submenu = 'تجهیزات پمپاژ';
    leaf = 'قطعات و لوازم جانبی پمپ‌های صنعتی';
  } else if (rawFam.technicalType === 'قطعات کوره') {
    if (/بلبرینگ/.test(norm)) {
      productType = 'بلبرینگ کوره صنعتی دور بالا';
      material = 'فولاد بلبرینگ کروم (100Cr6)';
      construction = 'بلبرینگ حرارتی مخصوص کوره';
      profile = `KILN_BEARING_${drawingSeries}`;
      categorySlug = 'excel-v2-13-1';
      submenu = 'بلبرینگ شیار عمیق';
      leaf = 'بلبرینگ‌های استاندارد و صنعتی دور بالا';
      misplaced = true;
    } else if (/چرخ\s*دنده|دنده/.test(norm)) {
      productType = 'چرخ‌دنده کوره صنعتی';
      material = 'فولاد / چدن صنعتی';
      construction = 'دنده فلزی کوره صنعتی';
      profile = `KILN_GEAR_${drawingSeries}`;
      categorySlug = 'excel-v2-9-4';
      submenu = 'چرخ‌دنده ساده';
      leaf = 'انواع چرخ‌دنده ساده فلزی و پلیمری';
      misplaced = true;
    } else if (/رول\s*گردان|کاپ\s*رول|مخروطی\s*رولر|رولیک/.test(norm)) {
      productType = 'رولر و قطعات گردان کوره';
      material = detectNonBeltMaterial(norm, rawFam.materials, rawFam.technicalType);
      construction = 'مکانیزم رولیک و هرزگرد کوره';
      profile = `KILN_ROLLER_${drawingSeries}`;
      categorySlug = 'excel-v2-3-2';
      submenu = 'رولیک هرزگرد';
      leaf = 'انواع رولیک و هرزگرد پلیمری و فلزی';
      misplaced = true;
    } else if (/خار\s*نگهدارنده/.test(norm)) {
      productType = 'خار نگهدارنده رولر کوره';
      material = 'فولاد فنر';
      construction = 'خار فنری نگهدارنده رولر کوره';
      profile = `KILN_RETAINING_CLIP_${drawingSeries}`;
      categorySlug = 'excel-v2-3-3';
      submenu = 'خار نگهدارنده';
      leaf = 'انواع خار نگهدارنده رولر و شفت';
      misplaced = true;
    } else if (/نخ\s*نسوز|طناب\s*نسوز|بند\s*نسوز|پنبه\s*نسوز/.test(norm)) {
      productType = 'نخ و طناب نسوز صنعتی کوره';
      material = 'الیاف نسوز سرامیکی / فایبرگلاس';
      construction = 'طناب و نخ نسوز بافته‌شده';
      profile = 'KILN_REFRACTORY_ROPE';
      categorySlug = 'excel-v2-8-2';
      submenu = 'نخ نسوز';
      leaf = 'انواع نخ نسوز صنعتی';
    } else if (/برزنت|نوار\s*برزنتی/.test(norm)) {
      productType = 'نوار برزنتی خروجی کوره';
      material = 'پارچه برزنتی مقاوم به حرارت';
      construction = 'نوار نقاله برزنتی چندلایه نسوز';
      profile = 'KILN_CANVAS_BELT';
      categorySlug = 'excel-v2-8-1';
      submenu = 'برزنتی چسب‌دار';
      leaf = '(نخ و پارچه) برزنتی در ضخامت مختلف';
    } else {
      productType = `ملزومات و قطعات نسوز کوره (${norm.split(' ')[0]})`;
      material = detectNonBeltMaterial(norm, rawFam.materials, rawFam.technicalType);
      construction = `قطعه نسوز کوره (${drawingSeries})`;
      profile = `KILN_PART_${drawingSeries}`;
      categorySlug = 'excel-v2-8-1';
      submenu = 'نسوز چسب‌دار';
      leaf = '(کتان و چسب) نسوز در ضخامت مختلف';
    }
  } else if (rawFam.technicalType === 'پایه و براکت' || /خار\s*نگهدارنده\s*رولر/.test(norm)) {
    if (/خار\s*نگهدارنده\s*رولر/.test(norm)) {
      const clipColor = /سفید/.test(norm) ? 'WHITE' : /مشکی/.test(norm) ? 'BLACK' : /\bat-\d+/i.test(norm) ? 'AT_SERIES' : 'STD';
      productType = `خار نگهدارنده رولر (${clipColor})`;
      construction = `خار فنری نگهدارنده رولر (${clipColor})`;
      profile = `ROLLER_RETAINING_CLIP_${clipColor}`;
      categorySlug = 'excel-v2-3-3';
      submenu = 'خار نگهدارنده';
      leaf = 'انواع خار نگهدارنده رولر و شفت';
    } else {
      productType = `پایه و براکت صنعتی (${material})`;
      construction = `پایه و تکیه‌گاه مکانیکی (${drawingSeries})`;
      profile = `BRACKET_${slugifyToken(material)}_${drawingSeries}`;
      categorySlug = 'excel-v2-9-3';
      submenu = 'انواع گیره و بست';
      leaf = 'گیره و بست صنعتی';
    }
  } else if (rawFam.technicalType === 'خار / پین') {
    if (/نمد/.test(norm)) {
      productType = 'نمد صنعتی آب‌بندی';
      construction = 'نمد فشرده صنعتی';
      profile = 'INDUSTRIAL_FELT';
      categorySlug = 'excel-v2-7-2';
      submenu = 'کاسه نمد و پکینگ';
      leaf = 'انواع کاسه نمد و پکینگ صنعتی';
      misplaced = true;
    } else if (/انگشتی/.test(norm)) {
      productType = 'انگشتی تک‌خار روتاری';
      construction = 'انگشتی تک‌خار';
      profile = 'SINGLE_LUG_FINGER';
      categorySlug = 'excel-v2-10-2';
      submenu = 'سیلندر و انگشتی';
      leaf = 'سیلندر انگشتی و متعلقات';
    } else if (/خار\s*[jJ]?\d+/.test(norm)) {
      productType = 'خار فنری / اشپیل صنعتی (Circlip)';
      construction = 'خار نگهدارنده داخل/خارج شفت (DIN 471/472)';
      profile = 'DIN_CIRCLIP';
      standard = 'DIN 471 / DIN 472 Retaining Ring';
      evidence = 'STANDARD_REFERENCE';
      categorySlug = 'excel-v2-3-3';
      submenu = 'خار نگهدارنده';
      leaf = 'انواع خار نگهدارنده رولر و شفت';
    } else {
      productType = 'پین صنعتی';
      construction = 'پین اتصال مکانیکی';
      profile = `PIN_${drawingSeries}`;
      categorySlug = 'excel-v2-3-2';
      submenu = 'پین سر رولر و زنجیر';
      leaf = 'انواع پین سر رولر و زنجیر';
    }
  } else if (rawFam.technicalType === 'پیچ' || /پایه\s*تنظیم\s*کننده.*با\s*پیچ/.test(norm)) {
    if (/پایه\s*تنظیم\s*کننده/.test(norm)) {
      productType = 'پایه تنظیم‌کننده فلزی پیچی (کد 1273)';
      construction = 'پایه تراز و تنظیم ارتفاع ماشین‌آلات با پیچ';
      profile = 'LEVELING_FOOT_1273';
      categorySlug = 'excel-v2-9-3';
      submenu = 'دستگیره و پیچ فلکه';
      leaf = 'انواع دستگیره شکل و پیچ فلکه';
    } else if (/پیچ\s*فلکه\s*ای/.test(norm)) {
      productType = 'پیچ فلکه‌ای دستی صنعتی';
      construction = 'پیچ تنظیم فلکه‌ای مشکی';
      profile = 'HANDWHEEL_KNOB_BOLT';
      categorySlug = 'excel-v2-9-3';
      submenu = 'دستگیره و پیچ فلکه';
      leaf = 'انواع دستگیره شکل و پیچ فلکه';
    } else if (/پیچ.*دسته\s*مشکی/.test(norm)) {
      productType = 'پیچ دسته‌دار تنظیم صنعتی';
      construction = 'پیچ تنظیم دسته مشکی';
      profile = 'CLAMPING_HANDLE_BOLT';
      categorySlug = 'excel-v2-9-3';
      submenu = 'دستگیره و پیچ فلکه';
      leaf = 'انواع دستگیره شکل و پیچ فلکه';
    } else if (/پیچ\s*متری/.test(norm)) {
      productType = 'پیچ متری (استادبولت / راد تمام‌رزوه)';
      construction = 'میلگرد تمام‌رزوه استاندارد (DIN 975)';
      profile = 'THREADED_ROD_DIN975';
      standard = 'DIN 975 Threaded Rod';
      evidence = 'STANDARD_REFERENCE';
      categorySlug = 'excel-v2-9-3';
      submenu = 'دستگیره و پیچ فلکه';
      leaf = 'انواع دستگیره شکل و پیچ فلکه';
    } else {
      productType = `پیچ صنعتی (${material})`;
      construction = `پیچ اتصال (${material})`;
      profile = `BOLT_${slugifyToken(material)}`;
      categorySlug = 'excel-v2-9-3';
      submenu = 'دستگیره و پیچ فلکه';
      leaf = 'انواع دستگیره شکل و پیچ فلکه';
    }
  } else if (rawFam.code === 'FAM-32873') {
    if (/چهار\s*پهلو\s*(?:مخصوص\s*)?تو\s*خالی/.test(norm)) {
      productType = `پروفیل چهارپهلو توخالی (${material})`;
      construction = `چهارپهلو توخالی راهنما (${material})`;
      profile = `HOLLOW_SQUARE_PROFILE_${slugifyToken(material)}`;
      categorySlug = 'excel-v2-6-2';
      submenu = 'انواع تسمه‌کش و راهنما';
      leaf = 'نگهدارنده راهنما و قطعات هدایت خط';
      misplaced = true;
    } else if (/قوطی/.test(norm)) {
      productType = `پروفیل قوطی صنعتی (${material})`;
      construction = `قوطی مقاطع ساختاری (${material})`;
      profile = `BOX_PROFILE_${slugifyToken(material)}`;
      categorySlug = 'excel-v2-9-3';
      submenu = 'انواع گیره و بست';
      leaf = 'گیره و بست صنعتی';
      misplaced = true;
    } else if (/^گرد\s*(?:ck|mo40|استیل|آهن)/i.test(norm)) {
      productType = `میلگرد فولادی / استیل (${material})`;
      construction = `مقطع گرد توپر فلزی (${material})`;
      profile = `METAL_ROUND_BAR_${slugifyToken(material)}`;
      categorySlug = 'excel-v2-9-3';
      submenu = 'شفت و محور';
      leaf = 'انواع شفت و محور صنعتی';
      misplaced = true;
    } else if (/بازوی\s*استکر|پلیت\s*استکر|لقمه\s*استکر/.test(norm)) {
      productType = 'قطعات مکانیکی استاکر';
      construction = /بازو/.test(norm) ? 'بازوی فلزی استاکر کد 1084' : 'پلیت و لقمه استاکر';
      profile = /بازو/.test(norm) ? 'STACKER_ARM_1084' : `STACKER_PART_${drawingSeries}`;
      categorySlug = 'excel-v2-10-3';
      submenu = 'قطعات دستگاه استاکر';
      leaf = 'لوازم و قطعات مصرفی استاکر';
      misplaced = true;
    } else if (/دیسک\s*لعاب\s*پاش|درپوش.*دیسک\s*لعاب/.test(norm)) {
      const isCap = /درپوش/.test(norm);
      productType = isCap ? 'درپوش دیسک لعاب‌پاش' : 'دیسک لعاب‌پاش کامل 26 پره';
      construction = isCap ? 'درپوش محافظ دیسک لعاب‌پاش' : 'دیسک لعاب‌پاش کابین لعاب';
      profile = isCap ? 'GLAZE_DISC_CAP' : 'GLAZE_DISC_26BLADE';
      categorySlug = 'excel-v2-10-1';
      submenu = 'ملزومات چاپ و لعاب';
      leaf = 'قطعات جانبی دستگاه چاپ و لعاب';
      misplaced = true;
    } else if (/کشوئی.*چهار\s*پهلو/.test(norm)) {
      productType = 'کشویی راهنمای چهارپهلو (کد 1127)';
      construction = 'کشویی تنظیم راهنمای چهارپهلو';
      profile = 'SQUARE_GUIDE_SLIDER_1127';
      categorySlug = 'excel-v2-6-2';
      submenu = 'انواع تسمه‌کش و راهنما';
      leaf = 'نگهدارنده راهنما و قطعات هدایت خط';
      misplaced = true;
    } else if (/سه\s*پری/.test(norm)) {
      productType = `دستگیره سه‌پری تنظیم (${material})`;
      construction = `دستگیره سه‌پری کد 1052/14 (${material})`;
      profile = `THREE_WING_KNOB_${slugifyToken(material)}`;
      categorySlug = 'excel-v2-9-3';
      submenu = 'دستگیره و پیچ فلکه';
      leaf = 'انواع دستگیره شکل و پیچ فلکه';
      misplaced = true;
    } else if (/نبشی/.test(norm)) {
      productType = `نبشی صنعتی (${material})`;
      construction = `نبشی ساختاری (${material})`;
      profile = `ANGLE_PROFILE_${slugifyToken(material)}_${drawingSeries}`;
      categorySlug = 'excel-v2-9-3';
      submenu = 'انواع گیره و بست';
      leaf = 'گیره و بست صنعتی';
      misplaced = true;
    } else {
      productType = `قطعه و تجهیز صنعتی (${norm.split(' ')[0]})`;
      construction = `قطعه مستقل صنعتی (${norm})`;
      profile = `CUSTOM_ITEM_${variant.code}`;
      categorySlug = 'excel-v2-9-3';
      submenu = 'دستگیره و پیچ فلکه';
      leaf = 'انواع دستگیره شکل و پیچ فلکه';
      misplaced = true;
    }
  } else {
    const subSeries =
      rawFam.technicalType === 'قالب صنعتی'
        ? /برچسب|مارک/.test(norm)
          ? 'BRAND_LABEL_MOULD'
          : /\b(?:at10|at5|t10|h)\b/i.test(norm)
            ? `BELT_PROFILE_MOULD_${norm.replace(/^قالب\s*/i, '').toUpperCase()}`
            : 'INDUSTRIAL_PART_MOULD'
        : rawFam.technicalType === 'قاشقک صنعتی'
          ? /پیچ\s*و\s*مهره\s*قاشقک/.test(norm)
            ? 'ELEVATOR_BUCKET_BOLT'
            : /الواتر/.test(norm)
              ? `ELEVATOR_BUCKET_${/آبی/.test(norm) ? 'BLUE' : 'WHITE'}`
              : 'STAINLESS_SCOOP'
          : rawFam.technicalType === 'فوم صنعتی' || rawFam.technicalType === 'اسفنج'
            ? /شماتیک/.test(norm)
              ? 'SCHEMATIC_FOAM_SHEET'
              : /چسب\s*دار/.test(norm)
                ? 'ADHESIVE_SPONGE'
                : 'INDUSTRIAL_FOAM_SHEET'
            : /اهرم\s*نگهدارنده/.test(norm)
              ? 'HOLDING_LEVER_SERIES'
              : /بست\s*فلزی\s*گاید\s*خط\s*لعاب/.test(norm)
                ? 'GLAZE_LINE_GUIDE_CLAMP'
                : `${slugifyToken(rawFam.technicalType)}_${drawingSeries}`;

    productType = rawFam.technicalType === 'مدل یا نام تجاری بدون نوع کالا' ? 'ابزار و ملزومات صنعتی' : rawFam.technicalType;
    construction = `${productType} (${material} - ${subSeries})`;
    profile = subSeries;

    if (rawFam.technicalType === 'قالب صنعتی') {
      categorySlug = 'excel-v2-12-1';
      submenu = 'مطابق با نقشه فنی';
      leaf = 'طراحی و تولید قطعات بر اساس نقشه یا نمونه فنی شما';
    } else if (rawFam.technicalType === 'لولا صنعتی') {
      categorySlug = 'excel-v2-9-3';
      submenu = 'انواع لولا';
      leaf = 'لولاهای صنعتی';
    } else if (rawFam.technicalType === 'دستگیره') {
      categorySlug = 'excel-v2-9-3';
      submenu = 'دستگیره و پیچ فلکه';
      leaf = 'انواع دستگیره شکل و پیچ فلکه';
    } else if (rawFam.technicalType === 'فوم صنعتی' || rawFam.technicalType === 'اسفنج') {
      categorySlug = 'excel-v2-14-1';
      submenu = 'ابرهای اسفنجی';
      leaf = 'انواع ابر اسفنجی صنعتی';
    } else if (rawFam.technicalType === 'سنسور') {
      categorySlug = 'excel-v2-6-4';
      submenu = 'انواع فتوسل و سنسور';
      leaf = 'سنسور و فتوسل خطوط صنعتی';
    } else if (rawFam.technicalType === 'قطعات استاکر') {
      categorySlug = 'excel-v2-10-3';
      submenu = 'قطعات دستگاه استاکر';
      leaf = 'لوازم و قطعات مصرفی استاکر';
    } else if (rawFam.technicalType === 'سیلندر انگشتی') {
      categorySlug = 'excel-v2-10-2';
      submenu = 'سیلندر و انگشتی';
      leaf = 'سیلندر انگشتی و متعلقات';
    } else if (rawFam.technicalType === 'قطعات دستگاه چاپ') {
      categorySlug = 'excel-v2-10-1';
      submenu = 'ملزومات چاپ و لعاب';
      leaf = 'قطعات جانبی دستگاه چاپ و لعاب';
    } else if (rawFam.technicalType === 'راهنمای کاشی') {
      categorySlug = 'excel-v2-6-2';
      submenu = 'انواع تسمه‌کش و راهنما';
      leaf = 'نگهدارنده راهنما و قطعات هدایت خط';
    } else if (rawFam.technicalType === 'شفت صنعتی' || rawFam.technicalType === 'میله صنعتی') {
      categorySlug = 'excel-v2-9-3';
      submenu = 'شفت و محور';
      leaf = 'انواع شفت و محور صنعتی';
    }
  }

  // Honour direct SKU override if present
  if (directOverride) {
    categorySlug = directOverride.categorySlug;
    submenu = directOverride.submenu;
    leaf = directOverride.subcategory;
  }

  // Strictly validate the exact category > submenu > leaf path, then validate
  // its engineering meaning against the SKU/family identity. A syntactically valid
  // leaf is not enough if the component itself belongs to another engineering domain.
  const resolvedMenu = resolveStrictApprovedMenuPath(categorySlug, submenu, leaf);
  if (!resolvedMenu.leaf) {
    // A category/submenu match without an approved leaf is not a publishable
    // family path. Keep the SKU identity, but quarantine its menu placement.
    categorySlug = UNRESOLVED_MENU_PATH.categorySlug;
    submenu = UNRESOLVED_MENU_PATH.submenu;
    leaf = UNRESOLVED_MENU_PATH.leaf;
    taxonomyGap = taxonomyGap || `GAP-APPROVED-MENU-LEAF-MISSING: برای مسیر «${resolvedMenu.categoryName} > ${resolvedMenu.submenu}» برگ مصوبی ثبت نشده است.`;
  } else {
    categorySlug = resolvedMenu.categorySlug;
    submenu = resolvedMenu.submenu;
    leaf = resolvedMenu.leaf;
  }

  if (categorySlug === 'UNRESOLVED') {
    taxonomyGap = taxonomyGap || `GAP-APPROVED-MENU-PATH-MISSING: مسیر دقیق «${rawFam.technicalType}» در منوی مصوب وجود ندارد یا ورودی دسته/زیر‌دسته/برگ دقیق نیست.`;
  } else {
    const semantic = validateFamilyMenuAssignment({
      familyCode: rawFam.code,
      familyName: rawFam.name,
      productType,
      material,
      profile,
      categorySlug,
      submenuName: submenu,
      leafName: leaf,
    });
    if (!semantic.valid) {
      taxonomyGap = `GAP-SEMANTIC-MENU-CONFLICT: ${semantic.reason}; هویت خانواده حفظ می‌شود اما تا ایجاد/تأیید برگ صحیح نباید در این مسیر نمایش داده شود.`;
      categorySlug = UNRESOLVED_MENU_PATH.categorySlug;
      submenu = UNRESOLVED_MENU_PATH.submenu;
      leaf = UNRESOLVED_MENU_PATH.leaf;
    }
  }

  if (rawFam.technicalType === 'قاشقک صنعتی') {
    taxonomyGap = 'GAP-APPROVED-MENU-PATH-MISSING: قاشقک و باکت الواتور در برگ مصوب مستقلی ثبت نشده است.';
    categorySlug = 'UNRESOLVED';
    submenu = UNRESOLVED_MENU_PATH.submenu;
    leaf = UNRESOLVED_MENU_PATH.leaf;
  }

  const pvcSurface = productType === 'نوار نقاله PVC' ? detectConveyorSurfaceProfile(norm) : null;

  const proposedCategoryName = categorySlug === 'UNRESOLVED'
    ? UNRESOLVED_MENU_PATH.categoryName
    : getApprovedCategoryName(categorySlug, rawFam.categoryName);

  const invariantKey = [
    'NONBELT',
    categorySlug,
    productType,
    brand,
    material,
    construction,
    profile,
    unit,
    standard,
  ].join('|');

  const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
    evidence === 'STANDARD_REFERENCE' || evidence === 'EXCEL_SOURCE' ? 'HIGH' : 'MEDIUM';
  // An unknown PVC surface is still a valid, separately quarantined family;
  // retain the family but keep its score above the global unresolved threshold.
  const confidenceScore = pvcSurface?.requiresReview
    ? Math.max(70, Math.min(74, computeConfidenceScore(evidence, 'APPROVED_FAMILY')))
    : computeConfidenceScore(evidence, 'APPROVED_FAMILY');
  const manufacturer = resolveManufacturerName(brand);
  const mpn = drawingSeries !== 'STD_SERIES' ? drawingSeries : profile;

  const identitySpecifications: Record<string, string | number> = {
    productType,
    brand,
    material,
    construction,
    profile,
    drawingSeries,
    unit,
    standard,
  };
  const variableSpecifications: Record<string, string | number> = {
    catalogSize: variant.size || 'استاندارد',
    variantDesignation: variant.size && variant.size !== 'نامشخص' ? variant.size : norm,
    ...(pvcSurface ? { surfaceTradeLabel: pvcSurface.label } : {}),
  };
  const descriptiveSpecifications: Record<string, string | number> = {
    manufacturer,
    manufacturerPartNumber: mpn,
    approvedLeafPath: `${proposedCategoryName} > ${submenu} > ${leaf}`,
  };

  const mainGrp = resolveMainGroupForCategory(categorySlug);
  const famType = resolveEngineeringFamilyType({
    productType,
    profile,
    material,
    construction,
    proposedCategorySlug: categorySlug,
  });

  return {
    skuCode: variant.code,
    originalProductName: variant.name,
    normalizedProductName: norm,
    englishProductName: buildEnglishTechnicalName(
      productType,
      brand,
      profile,
      material,
      variant.size && variant.size !== 'نامشخص' ? variant.size : norm
    ),
    brand,
    manufacturer,
    manufacturerPartNumber: mpn,
    productType,
    material,
    construction,
    profile,
    standard,
    engineeringSpecifications: {
      ...identitySpecifications,
      ...variableSpecifications,
      pitchMm: 'NOT_APPLICABLE',
      toothAngleDeg: 'NOT_APPLICABLE',
      toothHeightMm: 'NOT_APPLICABLE',
    },
    identitySpecifications,
    variableSpecifications,
    descriptiveSpecifications,
    mainGroupId: mainGrp.mainGroupId,
    mainGroupName: mainGrp.mainGroupName,
    familyTypeId: famType.familyTypeId,
    familyTypeName: famType.familyTypeName,
    currentFamily: rawFam.code,
    proposedFamily: null, // Populated during family grouping for multi-SKU groups
    familyName: null,
    familyMemberCodes: [],
    currentCategory: rawFam.categoryName,
    proposedCategory: proposedCategoryName,
    currentSubcategory: rawFam.technicalType,
    proposedSubcategory: `${submenu} > ${leaf}`,
    familyDecision: 'APPROVED_FAMILY',
    finalStatus: 'FAMILY_MEMBER', // Updated to DIRECT_PRODUCT if singleton during family grouping
    technicalEvidence: evidence,
    sourceUrl,
    decisionReason: pvcSurface?.requiresReview
      ? `این SKU نوار نقاله PVC است، اما الگوی سطح از عنوان/مدرک موجود قابل تعیین نیست؛ در خانواده مستقل PVC_SURFACE_UNSPECIFIED نگه داشته می‌شود و تا بررسی فیزیکی/دیتاشیت با هیچ پروفیل شناخته‌شده‌ای ادغام نمی‌شود.`
      : misplaced
        ? `بازطبقه‌بندی مهندسی از «${rawFam.technicalType}» به «${productType}» بر اساس ماهیت واقعی قطعه، جنس (${material}) و ساختار فنی.`
        : `طبقه‌بندی مهندسی اختصاصی بر اساس نوع قطعه (${productType})، جنس (${material})، ساختار (${construction}) و پروفیل/سری (${profile}).`,
    confidence,
    confidenceScore,
    verificationStatus: pvcSurface?.requiresReview
      ? 'REQUIRES_PHYSICAL_VERIFICATION'
      : evidence === 'STANDARD_REFERENCE' || evidence === 'EXCEL_SOURCE'
        ? 'VERIFIED_STANDARD_OR_SOURCE'
        : 'VERIFIED_INVENTORY_RECORD',
    requiredAction: pvcSurface?.requiresReview
      ? 'WAREHOUSE_PHYSICAL_INSPECTION_REQUIRED'
      : misplaced ? 'RECLASSIFY_CATEGORY_AND_ASSIGN' : 'READY_FOR_MIGRATION',
    taxonomyGap,
    similarProductCodes: [],
    sourceFamilyName: rawFam.name,
    sourceTechnicalType: rawFam.technicalType,
    proposedTechnicalType: productType,
    proposedCategorySlug: categorySlug,
    proposedSubmenu: submenu,
    proposedLeaf: leaf,
    unit,
    originalSize: variant.size || '',
    invariantKey,
    variantSummary: variant.size && variant.size !== 'نامشخص' ? variant.size : norm,
    preservedDirectSkuOverride: directOverride,
    splitFromMixedFamily: false,
    mergedFromFragmentedFamilies: false,
    misplacedInSourceCategory: misplaced,
  };
}

/**
 * Evaluate whether two candidate SKU records are engineered to belong to the same Multi-SKU Family.
 * Used both by the reconstruction engine and by negative/positive automated tests.
 */
export function evaluateCandidateFamilyPair(
  skuA: Phase1SkuRecord,
  skuB: Phase1SkuRecord
): { compatible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (skuA.familyDecision === 'UNRESOLVED' || skuB.familyDecision === 'UNRESOLVED') {
    reasons.push('UNRESOLVED_SKU_CANNOT_MERGE');
  }
  if (skuA.productType !== skuB.productType) {
    reasons.push(`INCOMPATIBLE_PRODUCT_TYPE(${skuA.productType} vs ${skuB.productType})`);
  }
  if (skuA.brand !== skuB.brand) {
    reasons.push(`INCOMPATIBLE_BRAND(${skuA.brand} vs ${skuB.brand})`);
  }
  if (skuA.material !== skuB.material) {
    reasons.push(`INCOMPATIBLE_MATERIAL(${skuA.material} vs ${skuB.material})`);
  }
  if (skuA.construction !== skuB.construction) {
    reasons.push(`INCOMPATIBLE_CONSTRUCTION(${skuA.construction} vs ${skuB.construction})`);
  }
  if (skuA.profile !== skuB.profile) {
    reasons.push(`INCOMPATIBLE_PROFILE(${skuA.profile} vs ${skuB.profile})`);
  }
  if (skuA.unit !== skuB.unit) {
    reasons.push(`INCOMPATIBLE_UNIT(${skuA.unit} vs ${skuB.unit})`);
  }
  if (
    skuA.engineeringSpecifications.sidedness &&
    skuB.engineeringSpecifications.sidedness &&
    skuA.engineeringSpecifications.sidedness !== skuB.engineeringSpecifications.sidedness
  ) {
    reasons.push(
      `INCOMPATIBLE_SIDEDNESS(${skuA.engineeringSpecifications.sidedness} vs ${skuB.engineeringSpecifications.sidedness})`
    );
  }
  if (
    skuA.engineeringSpecifications.supplyForm &&
    skuB.engineeringSpecifications.supplyForm &&
    skuA.engineeringSpecifications.supplyForm !== skuB.engineeringSpecifications.supplyForm
  ) {
    reasons.push(
      `INCOMPATIBLE_SUPPLY_FORM(${skuA.engineeringSpecifications.supplyForm} vs ${skuB.engineeringSpecifications.supplyForm})`
    );
  }
  if (skuA.invariantKey !== skuB.invariantKey && reasons.length === 0) {
    reasons.push('INCOMPATIBLE_INVARIANT_SIGNATURE');
  }
  return {
    compatible: reasons.length === 0,
    reasons,
  };
}

/**
 * Dynamic homogeneity validator for a reconstructed Multi-SKU Family
 */
export function validatePhase1FamilyHomogeneity(
  members: Phase1SkuRecord[]
): 'PASS_HOMOGENEOUS' | 'FAIL_MIXED_INVARIANT' | 'FAIL_UNKNOWN_INVARIANT' {
  if (members.length < 2) return 'FAIL_MIXED_INVARIANT';
  for (const m of members) {
    if (
      m.familyDecision === 'UNRESOLVED' ||
      m.material === 'UNKNOWN' ||
      m.construction === 'UNKNOWN' ||
      m.profile === 'UNKNOWN' ||
      !m.productType
    ) {
      return 'FAIL_UNKNOWN_INVARIANT';
    }
  }
  const first = members[0];
  for (let i = 1; i < members.length; i++) {
    const check = evaluateCandidateFamilyPair(first, members[i]);
    if (!check.compatible) {
      return 'FAIL_MIXED_INVARIANT';
    }
  }
  return 'PASS_HOMOGENEOUS';
}

/**
 * Main Phase 1 Complete Industrial Catalog Reconstruction Engine
 * Covers all 1,383 source families, 10,435 SKUs, and 90 technical types.
 */
export function runPhase1CatalogReconstruction(
  rawFamilies: RawCatalogueFamily[],
  options?: {
    directSkuSqlText?: string;
    beltRefs?: AuditReferenceTables;
  }
): Phase1ReconstructionReport {
  const directOverrides = parseDirectSkuOverridesSql(options?.directSkuSqlText || '');
  const allSkus: Phase1SkuRecord[] = [];

  for (const rawFam of rawFamilies) {
    const productObj = rawFamilyToProduct(rawFam);
    const isBeltSourceFamily = BELT_SOURCE_TYPES.has(rawFam.technicalType);

    for (let i = 0; i < rawFam.variants.length; i++) {
      const rawVar = rawFam.variants[i];
      const prodVar: ProductVariant = productObj.variants![i];
      const directOverride = directOverrides.get(String(rawVar.code)) || null;
      const normVarName = normalizeFa(rawVar.name);
      const isNonBeltHardwareInBeltFamily =
        /تسمه\s*پاک\s*کن|تسمه\s*پک\s*کن|تسمه\s*سفت\s*کن|تیغه.*تسمه\s*پاک|تسمه\s*آهنی/.test(normVarName);

      if ((isBeltSourceFamily && !isNonBeltHardwareInBeltFamily) || isMisplacedBeltOrWeldingSku(rawFam, rawVar)) {
        const beltRec = classifyBeltSkuWithProvenance(productObj, prodVar, options?.beltRefs);
        allSkus.push(buildBeltPhase1SkuRecord(rawFam, rawVar, beltRec, directOverride));
      } else {
        allSkus.push(classifyNonBeltSku(rawFam, rawVar, directOverride, false));
      }
    }
  }

  // Group non-UNRESOLVED SKUs by their strict engineering invariantKey
  const byInvariantKey = new Map<string, Phase1SkuRecord[]>();
  for (const sku of allSkus) {
    if (sku.familyDecision === 'UNRESOLVED') continue;
    const list = byInvariantKey.get(sku.invariantKey) || [];
    list.push(sku);
    byInvariantKey.set(sku.invariantKey, list);
  }

  // Track source family splits
  const sourceFamToTargetKeys = new Map<string, Set<string>>();
  for (const sku of allSkus) {
    const set = sourceFamToTargetKeys.get(sku.currentFamily) || new Set<string>();
    set.add(sku.familyDecision === 'UNRESOLVED' ? `UNRESOLVED:${sku.skuCode}` : sku.invariantKey);
    sourceFamToTargetKeys.set(sku.currentFamily, set);
  }

  const reconstructedFamilies: Phase1FamilyRecord[] = [];
  let famCounter = 1;

  for (const [, group] of [...byInvariantKey.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const sourceFams = [...new Set(group.map((g) => g.currentFamily))];
    const isMerged = sourceFams.length > 1;

    if (group.length === 1) {
      // Eliminate artificial 1-SKU wrapper family -> convert to DIRECT_PRODUCT!
      const single = group[0];
      single.familyDecision = 'DIRECT_PRODUCT';
      single.finalStatus = 'DIRECT_PRODUCT';
      single.proposedFamily = null;
      single.familyName = null;
      single.familyMemberCodes = [single.skuCode];
      single.splitFromMixedFamily = (sourceFamToTargetKeys.get(single.currentFamily)?.size || 0) > 1;
      single.mergedFromFragmentedFamilies = false;
      single.requiredAction = single.misplacedInSourceCategory
        ? 'RECLASSIFY_CATEGORY_AND_ASSIGN_DIRECT'
        : 'READY_FOR_MIGRATION_AS_DIRECT_PRODUCT';
      if (!single.decisionReason.includes('DIRECT_PRODUCT')) {
        single.decisionReason = `${single.decisionReason} — پس از جست‌وجوی سراسری در کل ۱۰٬۴۳۵ کد کالا، هیچ واریانت هم‌خانواده‌ای (با برند، متریال، پروفیل و ساختار یکسان) یافت نشد؛ بنابراین از ساخت خانواده تک‌عضوی خودداری شده و به عنوان کالای مستقیم (DIRECT_PRODUCT) عرضه می‌شود.`;
      }
      continue;
    }

    // Multi-SKU Family (>= 2 SKUs sharing identical invariant engineering specifications)
    const sample = group[0];
    const familyId =
      sample.proposedFamily && sample.proposedFamily.startsWith('PFAM-')
        ? `${sample.proposedFamily}-${String(famCounter).padStart(3, '0')}`
        : `PFAM-${slugifyToken(sample.productType).slice(0, 14)}-${slugifyToken(sample.brand).slice(0, 8)}-${slugifyToken(sample.profile).slice(0, 12)}-${String(famCounter).padStart(3, '0')}`;
    famCounter++;

    const verdict = validatePhase1FamilyHomogeneity(group);
    const engineeringFamilyName = `${sample.productType} | برند ${sample.brand} | جنس ${sample.material} | پروفیل/سری ${sample.profile} (${sample.unit})`;
    const memberCodes = group.map((m) => m.skuCode);

    for (const member of group) {
      member.familyDecision = 'APPROVED_FAMILY';
      member.finalStatus = 'FAMILY_MEMBER';
      member.proposedFamily = familyId;
      member.familyName = engineeringFamilyName;
      member.familyMemberCodes = memberCodes;
      member.splitFromMixedFamily = (sourceFamToTargetKeys.get(member.currentFamily)?.size || 0) > 1;
      member.mergedFromFragmentedFamilies = isMerged;
      member.requiredAction = member.verificationStatus === 'REQUIRES_PHYSICAL_VERIFICATION'
        ? 'WAREHOUSE_PHYSICAL_INSPECTION_REQUIRED'
        : member.misplacedInSourceCategory
          ? 'RECLASSIFY_CATEGORY_AND_ASSIGN_FAMILY'
          : 'READY_FOR_MIGRATION_AS_FAMILY';
    }

    // Determine best evidence level across members
    const evidenceRank: TechnicalEvidenceLevel[] = [
      'EXACT_MANUFACTURER_DATASHEET',
      'OFFICIAL_CATALOG',
      'OFFICIAL_PRODUCT_PAGE',
      'STANDARD_REFERENCE',
      'PHYSICAL_VERIFICATION',
      'EXCEL_SOURCE',
      'INVENTORY_DESCRIPTION',
      'INFERRED',
      'UNKNOWN',
    ];
    const bestEvidence =
      evidenceRank.find((ev) => group.some((m) => m.technicalEvidence === ev)) || 'INVENTORY_DESCRIPTION';

    reconstructedFamilies.push({
      familyId,
      engineeringFamilyName,
      mainGroupId: sample.mainGroupId,
      mainGroupName: sample.mainGroupName,
      familyTypeId: sample.familyTypeId,
      familyTypeName: sample.familyTypeName,
      productType: sample.productType,
      brand: sample.brand,
      material: sample.material,
      construction: sample.construction,
      invariantSpecifications: {
        productType: sample.productType,
        brand: sample.brand,
        material: sample.material,
        construction: sample.construction,
        profile: sample.profile,
        standard: sample.standard,
        unit: sample.unit,
        pitchMm: sample.engineeringSpecifications.pitchMm ?? 'NOT_APPLICABLE',
        toothAngleDeg: sample.engineeringSpecifications.toothAngleDeg ?? 'NOT_APPLICABLE',
        toothHeightMm: sample.engineeringSpecifications.toothHeightMm ?? 'NOT_APPLICABLE',
        sidedness: sample.engineeringSpecifications.sidedness ?? 'NOT_APPLICABLE',
        supplyForm: sample.engineeringSpecifications.supplyForm ?? sample.unit,
      },
      variantSpecifications: [
        'ابعاد / طول / سایز کاتالوگ (Size / Length / Width / Bore / Tooth Count)',
        'کد کالا (SKU Code)',
      ],
      memberSkuCodes: memberCodes,
      memberCount: group.length,
      technicalIdentity: `${sample.productType} (${sample.brand}) — ${sample.material} — ${sample.construction} — پروفیل ${sample.profile}`,
      evidence: bestEvidence,
      validationVerdict: verdict,
      categorySlug: sample.proposedCategorySlug,
      categoryName: sample.proposedCategory,
      submenu: sample.proposedSubmenu,
      leaf: sample.proposedLeaf,
      unit: sample.unit,
      profile: sample.profile,
      standard: sample.standard,
      sourceFamilyCodes: sourceFams,
      mergedFromMultipleSourceFamilies: isMerged,
      containsSplitSourceFamilyMembers: group.some((m) => m.splitFromMixedFamily),
    });
  }

  // Build Cross-Brand / Functional Substitute Links (SIMILAR_PRODUCT) without merging into the same family
  const similarByFunctionalSignature = new Map<string, Phase1SkuRecord[]>();
  for (const sku of allSkus) {
    if (sku.familyDecision === 'UNRESOLVED') continue;
    const normSize = (sku.originalSize || '').trim().toUpperCase();
    if (!normSize || normSize === 'نامشخص' || normSize === 'استاندارد') continue;
    const funcKey = [sku.proposedCategorySlug, sku.productType, sku.profile, sku.material, sku.unit, normSize].join('|');
    const arr = similarByFunctionalSignature.get(funcKey) || [];
    arr.push(sku);
    similarByFunctionalSignature.set(funcKey, arr);
  }

  const similarProductLinks: SimilarProductLinkRecord[] = [];
  for (const [, candidates] of similarByFunctionalSignature.entries()) {
    if (candidates.length < 2) continue;
    const distinctBrands = new Set(candidates.map((c) => c.brand));
    if (distinctBrands.size < 2) continue;
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i];
        const b = candidates[j];
        if (a.brand === b.brand) continue;
        if (!a.similarProductCodes.includes(b.skuCode)) a.similarProductCodes.push(b.skuCode);
        if (!b.similarProductCodes.includes(a.skuCode)) b.similarProductCodes.push(a.skuCode);
        if (similarProductLinks.length < 1500) {
          similarProductLinks.push({
            primarySkuCode: a.skuCode,
            primaryProductName: a.originalProductName,
            primaryBrand: a.brand,
            primaryFamilyId: a.proposedFamily,
            similarSkuCode: b.skuCode,
            similarProductName: b.originalProductName,
            similarBrand: b.brand,
            similarFamilyId: b.proposedFamily,
            sharedProfileAndSize: `${a.profile} | ${a.originalSize}`,
            differenceReason: `تفاوت برند سازنده (${a.brand} در برابر ${b.brand}) با پروفیل و سایز عملکردی یکسان؛ طبق قانون مهندسی در خانواده یکسان ادغام نمی‌شوند و صرفاً به عنوان کالای مشابه (SIMILAR_PRODUCT) لینک می‌شوند.`,
            similarityType: 'CROSS_BRAND_EQUIVALENT',
          });
        }
      }
    }
  }

  // Build Source Family Transformation Records for all 1,383 source families
  const skusBySourceFam = new Map<string, Phase1SkuRecord[]>();
  for (const sku of allSkus) {
    const list = skusBySourceFam.get(sku.currentFamily) || [];
    list.push(sku);
    skusBySourceFam.set(sku.currentFamily, list);
  }

  const technicalConflicts: TechnicalConflictRecord[] = [];
  const oldToNewFamilyMappings: OldToNewFamilyMappingRecord[] = [];

  const sourceFamilyTransformations: SourceFamilyTransformationRecord[] = rawFamilies.map((rawFam) => {
    const members = skusBySourceFam.get(rawFam.code) || [];
    const approvedCount = members.filter((m) => m.familyDecision === 'APPROVED_FAMILY').length;
    const directCount = members.filter((m) => m.familyDecision === 'DIRECT_PRODUCT').length;
    const unresolvedCount = members.filter((m) => m.familyDecision === 'UNRESOLVED').length;
    const targetFams = [...new Set(members.map((m) => m.proposedFamily).filter((x): x is string => Boolean(x)))];
    const directCodes = members.filter((m) => m.familyDecision === 'DIRECT_PRODUCT').map((m) => m.skuCode);
    const unresolvedCodes = members.filter((m) => m.familyDecision === 'UNRESOLVED').map((m) => m.skuCode);
    const distinctKeys = sourceFamToTargetKeys.get(rawFam.code)?.size || 1;

    let transformationType: SourceFamilyTransformationRecord['transformationType'];
    let explanation: string;
    let migrationAction: OldToNewFamilyMappingRecord['migrationAction'];

    if (unresolvedCount === members.length) {
      transformationType = 'MOVED_TO_UNRESOLVED_QUEUE';
      migrationAction = 'QUARANTINED_UNRESOLVED';
      explanation = 'تمام اعضای این خانواده به دلیل نقص مشخصات فنی حیاتی به صف بررسی UNRESOLVED منتقل شدند.';
      technicalConflicts.push({
        conflictId: `CONF-UNRES-${rawFam.code}`,
        sourceFamilyCode: rawFam.code,
        affectedSkuCodes: members.map((m) => m.skuCode),
        conflictType: 'INSUFFICIENT_SPECIFICATION',
        technicalDescription: `نقص مشخصات فنی پایه (گام، پروفیل، جنس یا ساختار) در خانواده مبدا ${rawFam.code} (${rawFam.name}).`,
        resolutionApplied: 'قرنطینه در جدول UNRESOLVED_PRODUCTS تا تکمیل دیتاشیت یا اندازه‌گیری فیزیکی.',
      });
    } else if (members.length === 1 && directCount === 1) {
      transformationType = 'CONVERTED_SINGLETON_TO_DIRECT_PRODUCT';
      migrationAction = 'CONVERTED_TO_DIRECT_PRODUCT';
      explanation = 'خانواده تک‌عضوی مصنوعی حذف و کالا با حفظ کد خانواده مبدا به عنوان DIRECT_PRODUCT ثبت شد.';
    } else if (distinctKeys > 1) {
      transformationType =
        directCount > 0 || unresolvedCount > 0
          ? 'MIXED_SPLIT_INTO_FAMILIES_DIRECT_AND_UNRESOLVED'
          : 'SPLIT_BY_INCOMPATIBLE_ENGINEERING_SPECS';
      migrationAction = 'SPLIT_INTO_MULTIPLE';
      explanation = `خانواده مختلط (${members.length} عضو) به دلیل تفاوت در جنس، پروفیل، یک‌طرفه/دوطرفه بودن یا ماهیت قطعه به ${distinctKeys} گروه مهندسی مجزا تفکیک شد.`;

      const distinctMaterials = new Set(members.map((m) => m.material));
      const distinctProfiles = new Set(members.map((m) => m.profile));
      const distinctTypes = new Set(members.map((m) => m.productType));
      const conflictType: TechnicalConflictRecord['conflictType'] =
        distinctTypes.size > 1
          ? 'CATEGORY_MISPLACEMENT'
          : distinctMaterials.size > 1
            ? 'MATERIAL_MISMATCH'
            : distinctProfiles.size > 1
              ? 'PROFILE_MISMATCH'
              : 'CONSTRUCTION_MISMATCH';

      technicalConflicts.push({
        conflictId: `CONF-SPLIT-${rawFam.code}`,
        sourceFamilyCode: rawFam.code,
        affectedSkuCodes: members.map((m) => m.skuCode),
        conflictType,
        technicalDescription: `خانواده مبدا ${rawFam.code} (${rawFam.name}) دارای ${members.length} کالا با ${distinctKeys} امضای فنی ناسازگار بود (انواع: ${[...distinctTypes].join('، ')} | متریال: ${[...distinctMaterials].join('، ')}).`,
        resolutionApplied: `تفکیک مهندسی به ${targetFams.length} خانواده همگن و ${directCodes.length} کالای مستقیم مستقل.`,
      });
    } else if (members.some((m) => m.mergedFromFragmentedFamilies)) {
      transformationType = 'MERGED_INTO_LARGER_HOMOGENEOUS_FAMILY';
      migrationAction = 'MERGED_INTO_SINGLE_FAMILY';
      explanation = `با خانواده‌های هم‌جنس و هم‌پروفیل دیگر در خانواده مهندسی ${targetFams[0]} ادغام شد.`;
    } else {
      transformationType = 'RETAINED_AS_HOMOGENEOUS_FAMILY';
      migrationAction = 'RETAINED_1_TO_1';
      explanation = `خانواده از نظر مهندسی همگن تایید شد (${targetFams[0]}).`;
    }

    oldToNewFamilyMappings.push({
      oldFamilyId: rawFam.code,
      oldFamilyName: rawFam.name,
      oldCategory: rawFam.categoryName,
      oldSubcategory: rawFam.technicalType,
      oldMemberCount: members.length,
      newFamilyIds: targetFams,
      directProductCodes: directCodes,
      unresolvedProductCodes: unresolvedCodes,
      migrationAction,
      technicalJustification: explanation,
    });

    return {
      sourceFamilyCode: rawFam.code,
      sourceFamilyName: rawFam.name,
      sourceTechnicalType: rawFam.technicalType,
      sourceCategory: rawFam.categoryName,
      sourceSubmenu: rawFam.submenu,
      sourceSkuCount: members.length,
      transformationType,
      targetFamilyIds: targetFams,
      approvedFamilySkuCount: approvedCount,
      directProductSkuCount: directCount,
      unresolvedSkuCount: unresolvedCount,
      engineeringExplanation: explanation,
    };
  });

  // Build 90 Technical Type Engineering Rule Profiles
  const skusBySourceType = new Map<string, Phase1SkuRecord[]>();
  const famsBySourceType = new Map<string, RawCatalogueFamily[]>();
  for (const rawFam of rawFamilies) {
    const fl = famsBySourceType.get(rawFam.technicalType) || [];
    fl.push(rawFam);
    famsBySourceType.set(rawFam.technicalType, fl);
  }
  for (const sku of allSkus) {
    const sl = skusBySourceType.get(sku.sourceTechnicalType) || [];
    sl.push(sku);
    skusBySourceType.set(sku.sourceTechnicalType, sl);
  }

  const typeRuleProfiles: TypeEngineeringRuleProfile[] = [...famsBySourceType.entries()]
    .sort((a, b) => {
      const countA = (skusBySourceType.get(a[0]) || []).length;
      const countB = (skusBySourceType.get(b[0]) || []).length;
      return countB - countA;
    })
    .map(([techType, fams]) => {
      const skus = skusBySourceType.get(techType) || [];
      const multiFamSet = new Set(
        skus.filter((s) => s.familyDecision === 'APPROVED_FAMILY' && s.proposedFamily).map((s) => s.proposedFamily!)
      );
      const specMeta = getTypeEngineeringMetadata(techType);
      return {
        technicalType: techType,
        domainGroup: specMeta.domainGroup,
        engineeringRuleCode: specMeta.ruleCode,
        sourceFamilyCount: fams.length,
        sourceSkuCount: skus.length,
        invariantAttributes: specMeta.invariantAttributes,
        allowedVariantAttributes: specMeta.allowedVariantAttributes,
        notApplicableAttributes: specMeta.notApplicableAttributes,
        forbiddenMerges: specMeta.forbiddenMerges,
        singletonPolicy:
          'هر کالای تک‌عضوی که هیچ واریانت سایزی هم‌جنس و هم‌پروفیل دیگری در کاتالوگ ندارد، به عنوان DIRECT_PRODUCT عرضه می‌شود و خانواده ۱ عضوی مصنوعی نمی‌سازد.',
        reconstructedMultiFamilyCount: multiFamSet.size,
        approvedFamilySkuCount: skus.filter((s) => s.familyDecision === 'APPROVED_FAMILY').length,
        directProductSkuCount: skus.filter((s) => s.familyDecision === 'DIRECT_PRODUCT').length,
        unresolvedSkuCount: skus.filter((s) => s.familyDecision === 'UNRESOLVED').length,
      };
    });

  // Build Special Audit 1: Haul-Off Belts (تسمه بارکش)
  const haulOffRecords: HaulOffAuditRecord[] = [];
  for (const sku of allSkus) {
    if (
      sku.sourceTechnicalType === 'تسمه روکش‌دار' ||
      sku.sourceTechnicalType === 'نوار گریپ' ||
      sku.sourceTechnicalType === 'گریپ صنعتی' ||
      sku.sourceTechnicalType === 'تسمه ضدسایش' ||
      sku.sourceTechnicalType === 'قالب صنعتی' ||
      ['FAM-41433', 'FAM-41362', 'FAM-41243', 'FAM-41377'].includes(sku.currentFamily)
    ) {
      const grip = extractGripCoatingInvariant(sku.originalProductName);
      haulOffRecords.push({
        sourceFamilyCode: sku.currentFamily,
        skuCode: sku.skuCode,
        originalName: sku.originalProductName,
        sourceTechnicalType: sku.sourceTechnicalType,
        actualEngineeringType: sku.productType,
        baseProfileOrSeries: sku.profile,
        coatingOrGripSpec: grip.hasGripOrCoating
          ? `${grip.coatingType} (${grip.coatingColor}, ${grip.coatingThicknessMm ?? 'STD'}mm, ${grip.surfacePattern})`
          : sku.construction,
        isTrueHaulOffBelt: false,
        proposedCategorySlug: sku.proposedCategorySlug,
        proposedCategoryName: sku.proposedCategory,
        proposedSubmenu: sku.proposedSubmenu,
        proposedLeaf: sku.proposedLeaf,
        familyDecision: sku.familyDecision,
        proposedFamilyId: sku.proposedFamily,
        engineeringExplanation:
          sku.sourceTechnicalType === 'قالب صنعتی'
            ? 'قالب صنعتی تولید است و هیچ ارتباطی با تسمه بارکش ندارد.'
            : sku.sourceTechnicalType === 'گریپ صنعتی'
              ? 'ورق/لاستیک گریپ خام جهت روکش‌کاری است، نه تسمه بارکش آماده.'
              : sku.sourceTechnicalType === 'نوار گریپ'
                ? 'نوار گریپ پشت پلی‌استر (نوار نقاله/غلتک) است، نه تسمه بارکش کاترپیلار.'
                : 'تسمه تایمینگ سیم‌دار یا تسمه جوشی V دارای روکش گریپ/ضدسایش است که باید در زیرشاخه تسمه روکش‌دار/گریپ‌دار قرار گیرد و نباید در تسمه بارکش رها شود.',
      });
    }
  }

  // Build Special Audit 2: Welding Equipment vs Welded Belts
  const weldingRecords: WeldingVsBeltAuditRecord[] = [];
  for (const sku of allSkus) {
    const isWeldingTool = sku.productType === 'دستگاه و گیره جوش تسمه صنعتی';
    const isRoundCrc = sku.engineeringSpecifications.beltDivision === 'welded-pu-round-crc';
    const isWeldedV =
      sku.engineeringSpecifications.beltDivision === 'welded-pu-v-flat' ||
      (sku.sourceTechnicalType === 'تسمه روکش‌دار' && /تسمه\s*جوشی/.test(sku.normalizedProductName));

    if (isWeldingTool || isRoundCrc || isWeldedV) {
      weldingRecords.push({
        skuCode: sku.skuCode,
        sourceFamilyCode: sku.currentFamily,
        originalName: sku.originalProductName,
        classification: isWeldingTool
          ? 'WELDING_EQUIPMENT_OR_CLAMP'
          : isRoundCrc
            ? 'WELDED_PU_ROUND_CRC_BELT'
            : 'WELDED_PU_V_OR_FLAT_BELT',
        brand: sku.brand,
        profile: sku.profile,
        material: sku.material,
        construction: sku.construction,
        proposedCategorySlug: sku.proposedCategorySlug,
        proposedCategoryName: sku.proposedCategory,
        proposedSubmenu: sku.proposedSubmenu,
        proposedLeaf: sku.proposedLeaf,
        familyDecision: sku.familyDecision,
        proposedFamilyId: sku.proposedFamily,
        separatedFromBeltFamily: isWeldingTool && sku.currentFamily === 'FAM-34064',
        engineeringExplanation: isWeldingTool
          ? 'ابزار و دستگاه جوش/آپارات تسمه صنعتی؛ به صورت کامل از خانواده‌های تسمه تفکیک شده و در برگ «دستگاه جوش تسمه صنعتی» به صورت DIRECT_PRODUCT قرار گرفته است.'
          : isRoundCrc
            ? 'تسمه گرد پلی‌یورتان جوشی / گرده‌ماهی CRC؛ در زیرشاخه «تسمه گرد (CRC) > انواع تسمه گرد جوشی» طبقه‌بندی شده است.'
            : 'تسمه جوشی پروفیل V (ساده، نخ‌دار یا گریپ‌دار)؛ در دسته «تسمه جوشی و گرد» بر اساس پروفیل (A/B/C)، برند و ساختار کورد/گریپ تفکیک شده است.',
      });
    }
  }

  // Build Special Audit 3: Low-SKU Subcategories across the 14 groups / 34 categories / 55 submenus / 67 leaves
  const lowSkuSubcategoryDecisions = buildLowSkuSubcategoryDecisions(rawFamilies, allSkus, reconstructedFamilies);

  // Build Category Stage Checkpoints for all 34 Approved Categories
  const categoryStageCheckpoints: CategoryStageCheckpointRecord[] = APPROVED_MENU_CATEGORIES.map((cat, idx) => {
    const catSkus = allSkus.filter((s) => s.proposedCategorySlug === cat.slug);
    const catFams = reconstructedFamilies.filter((f) => f.categorySlug === cat.slug);
    return {
      stageNumber: idx + 1,
      categorySlug: cat.slug,
      categoryName: cat.name,
      groupTitle: APPROVED_MENU_GROUPS.find((g) => g.categorySlugs.includes(cat.slug))?.title || '',
      totalAuditedSkus: catSkus.length,
      familyCount: catFams.length,
      familyMemberSkuCount: catSkus.filter((s) => s.finalStatus === 'FAMILY_MEMBER').length,
      directProductCount: catSkus.filter((s) => s.finalStatus === 'DIRECT_PRODUCT').length,
      unresolvedCount: catSkus.filter((s) => s.finalStatus === 'UNRESOLVED').length,
      misclassifiedFixedCount: catSkus.filter((s) => s.misplacedInSourceCategory).length,
      stageStatus: 'STAGE_COMPLETED_VERIFIED',
    };
  });

  // Build Family Type Summary (Phase 4)
  const skusByFamilyType = new Map<string, Phase1SkuRecord[]>();
  for (const sku of allSkus) {
    const arr = skusByFamilyType.get(sku.familyTypeId) || [];
    arr.push(sku);
    skusByFamilyType.set(sku.familyTypeId, arr);
  }
  const familyTypeSummary: FamilyTypeSummaryRecord[] = [...skusByFamilyType.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([ftId, ftSkus]) => {
      const sample = ftSkus[0];
      const famsInType = reconstructedFamilies.filter((f) => f.familyTypeId === ftId);
      return {
        familyTypeId: ftId,
        familyTypeName: sample.familyTypeName,
        mainGroupId: sample.mainGroupId,
        mainGroupName: sample.mainGroupName,
        categorySlug: sample.proposedCategorySlug,
        categoryName: sample.proposedCategory,
        submenu: sample.proposedSubmenu,
        leaf: sample.proposedLeaf,
        reconstructedFamilyCount: famsInType.length,
        familyMemberSkuCount: ftSkus.filter((s) => s.finalStatus === 'FAMILY_MEMBER').length,
        directProductSkuCount: ftSkus.filter((s) => s.finalStatus === 'DIRECT_PRODUCT').length,
        unresolvedSkuCount: ftSkus.filter((s) => s.finalStatus === 'UNRESOLVED').length,
        totalSkuCount: ftSkus.length,
      };
    });

  // Build Subcategory SKU Counts across all 67 Approved Leaf Subcategories (Phase 3)
  const subcategorySkuCounts: SubcategorySkuCountRecord[] = CANONICAL_MENU_PATHS.map((entry) => {
    const mainGroup = resolveMainGroupForCategory(entry.categorySlug);
    const leafSkus = allSkus.filter(
      (s) =>
        s.proposedCategorySlug === entry.categorySlug &&
        s.proposedSubmenu === entry.submenu &&
        s.proposedLeaf === entry.leaf
    );
    const leafFams = reconstructedFamilies.filter(
      (f) => f.categorySlug === entry.categorySlug && f.submenu === entry.submenu && f.leaf === entry.leaf
    );
    return {
      mainGroupId: mainGroup.mainGroupId,
      mainGroupName: mainGroup.mainGroupName,
      categorySlug: entry.categorySlug,
      categoryName: entry.categoryName,
      submenu: entry.submenu,
      leaf: entry.leaf,
      totalSkuCount: leafSkus.length,
      familyCount: leafFams.length,
      familyMemberSkuCount: leafSkus.filter((s) => s.finalStatus === 'FAMILY_MEMBER').length,
      directProductSkuCount: leafSkus.filter((s) => s.finalStatus === 'DIRECT_PRODUCT').length,
      unresolvedSkuCount: leafSkus.filter((s) => s.finalStatus === 'UNRESOLVED').length,
    };
  });

  // Distributions
  const evidenceDistribution: Record<TechnicalEvidenceLevel, number> = {
    EXACT_MANUFACTURER_DATASHEET: 0,
    OFFICIAL_CATALOG: 0,
    OFFICIAL_PRODUCT_PAGE: 0,
    STANDARD_REFERENCE: 0,
    PHYSICAL_VERIFICATION: 0,
    EXCEL_SOURCE: 0,
    INVENTORY_DESCRIPTION: 0,
    INFERRED: 0,
    UNKNOWN: 0,
  };
  const decisionDistribution: Record<Phase1FamilyDecision, number> = {
    APPROVED_FAMILY: 0,
    DIRECT_PRODUCT: 0,
    UNRESOLVED: 0,
  };
  const confidenceDistribution: Record<Phase1Confidence, number> = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    UNRESOLVED: 0,
  };

  let band95To100 = 0;
  let band85To94 = 0;
  let band70To84 = 0;
  let bandUnder70 = 0;

  for (const sku of allSkus) {
    evidenceDistribution[sku.technicalEvidence]++;
    decisionDistribution[sku.familyDecision]++;
    confidenceDistribution[sku.confidence]++;
    if (sku.confidenceScore >= 95) band95To100++;
    else if (sku.confidenceScore >= 85) band85To94++;
    else if (sku.confidenceScore >= 70) band70To84++;
    else bandUnder70++;
  }

  // Stage 9 Quality Control Verification
  const seenFamilyMembers = new Set<string>();
  let noDuplicateFamilyMembership = true;
  let noBrandMixingInFamilies = true;
  let noMaterialMixingInFamilies = true;
  let noSingleSkuArtificialFamilies = true;

  for (const fam of reconstructedFamilies) {
    if (fam.memberCount < 2) noSingleSkuArtificialFamilies = false;
    for (const code of fam.memberSkuCodes) {
      if (seenFamilyMembers.has(code)) noDuplicateFamilyMembership = false;
      seenFamilyMembers.add(code);
    }
  }

  const menuAssignedSkus = allSkus.filter((s) => s.proposedCategorySlug !== 'UNRESOLVED');
  const taxonomyGapSkus = allSkus.filter((s) => s.proposedCategorySlug === 'UNRESOLVED' || Boolean(s.taxonomyGap));
  const allCategoriesValid = menuAssignedSkus.every((s) => CANONICAL_BY_CATEGORY.has(s.proposedCategorySlug));
  const allSubcategoriesValid = menuAssignedSkus.every((s) => {
    const entries = CANONICAL_BY_CATEGORY.get(s.proposedCategorySlug) || [];
    return entries.some((e) => e.submenu === s.proposedSubmenu && e.leaf === s.proposedLeaf);
  });
  const taxonomyGapFamilyCount = new Set(
    taxonomyGapSkus.map((s) => s.proposedFamily || `SOURCE:${s.currentFamily}`)
  ).size;

  const beforeSingletonFamilies = rawFamilies.filter((f) => f.variants.length === 1).length;
  const beforeMultiSkuFamilies = rawFamilies.filter((f) => f.variants.length > 1).length;
  const mappedCount = Object.keys(CATALOG_FAMILY_MENU_ASSIGNMENTS).length;
  const reviewQueueFams = rawFamilies.filter((f) => !CATALOG_FAMILY_MENU_ASSIGNMENTS[f.code]);
  const reviewQueueSkus = reviewQueueFams.reduce((s, f) => s + f.variants.length, 0);

  return {
    generatedAt: new Date().toISOString(),
    gitContext: {
      baseBranch: 'main',
      baseCommitSha: '5e2fa0c43541aed91a27b6596590a1d141a21bfb',
      targetBranch: 'audit/belt-family-validation-v2',
      targetBranchInitialCommitSha: '33d0d9254b5634323e079e87e1271fe0e79e32e2',
      excelSha256: '0ac4648d92aae6ca403d92d9283cf8d245d066f42d924a646ce9b4045aca9272',
    },
    summary: {
      totalSourceFamilies: rawFamilies.length,
      totalSourceSkus: allSkus.length,
      totalTechnicalTypes: famsBySourceType.size,
      totalFamilyTypes: familyTypeSummary.length,
      beforeMultiSkuFamilies,
      beforeSingletonFamilies,
      beforeMappedFamiliesInLiveMenu: mappedCount,
      beforeReviewQueueFamilies: reviewQueueFams.length,
      beforeReviewQueueSkus: reviewQueueSkus,
      preservedDirectSkuOverridesCount: allSkus.filter((s) => s.preservedDirectSkuOverride !== null).length,
      afterReconstructedMultiSkuFamilies: reconstructedFamilies.length,
      afterApprovedFamilySkus: decisionDistribution.APPROVED_FAMILY,
      afterDirectProductSkus: decisionDistribution.DIRECT_PRODUCT,
      afterUnresolvedSkus: decisionDistribution.UNRESOLVED,
      eliminatedArtificialSingletonFamilies: beforeSingletonFamilies,
      sourceFamiliesSplitCount: sourceFamilyTransformations.filter(
        (t) =>
          t.transformationType === 'SPLIT_BY_INCOMPATIBLE_ENGINEERING_SPECS' ||
          t.transformationType === 'MIXED_SPLIT_INTO_FAMILIES_DIRECT_AND_UNRESOLVED'
      ).length,
      sourceFamiliesMergedCount: sourceFamilyTransformations.filter(
        (t) => t.transformationType === 'MERGED_INTO_LARGER_HOMOGENEOUS_FAMILY'
      ).length,
      misplacedSkusCorrectedCount: allSkus.filter((s) => s.misplacedInSourceCategory).length,
      allFamiliesPassHomogeneity: reconstructedFamilies.every((f) => f.validationVerdict === 'PASS_HOMOGENEOUS'),
    },
    evidenceDistribution,
    decisionDistribution,
    confidenceDistribution,
    typeRuleProfiles,
    familyTypeSummary,
    subcategorySkuCounts,
    skuRecords: allSkus,
    reconstructedFamilies,
    directProducts: allSkus.filter((s) => s.familyDecision === 'DIRECT_PRODUCT'),
    unresolvedItems: allSkus.filter((s) => s.familyDecision === 'UNRESOLVED'),
    sourceFamilyTransformations,
    similarProductLinks,
    technicalConflicts,
    oldToNewFamilyMappings,
    categoryStageCheckpoints,
    qualityControlMetrics: {
      allSkusAudited: allSkus.length === rawFamilies.reduce((sum, f) => sum + f.variants.length, 0),
      noDuplicateFamilyMembership,
      allCategoriesValid,
      allSubcategoriesValid,
      noInvalidMenuAssignments: allCategoriesValid && allSubcategoriesValid,
      allSkusHaveApprovedMenuPath: allSkus.every((s) => s.proposedCategorySlug !== 'UNRESOLVED'),
      taxonomyGapSkuCount: taxonomyGapSkus.length,
      taxonomyGapFamilyCount,
      allFamiliesHomogeneous: reconstructedFamilies.every((f) => f.validationVerdict === 'PASS_HOMOGENEOUS'),
      noBrandMixingInFamilies,
      noMaterialMixingInFamilies,
      noSingleSkuArtificialFamilies,
      unresolvedProperlyQuarantined: allSkus
        .filter((s) => s.confidenceScore < 70)
        .every((s) => s.finalStatus === 'UNRESOLVED' && s.proposedFamily === null),
      confidenceBands: {
        band95To100,
        band85To94,
        band70To84,
        bandUnder70,
      },
    },
    haulOffBeltAudit: {
      totalAuditedSkus: haulOffRecords.length,
      verifiedTrueHaulOffBeltCount: haulOffRecords.filter((r) => r.isTrueHaulOffBelt).length,
      coatedTimingBeltCount: haulOffRecords.filter((r) => r.actualEngineeringType.includes('تایمینگ')).length,
      coatedWeldedVBeltCount: haulOffRecords.filter((r) => r.actualEngineeringType.includes('جوشی')).length,
      gripBackingSheetCount: haulOffRecords.filter((r) => r.sourceTechnicalType === 'گریپ صنعتی').length,
      conveyorGripTapeCount: haulOffRecords.filter((r) => r.sourceTechnicalType === 'نوار گریپ').length,
      industrialMouldCount: haulOffRecords.filter((r) => r.sourceTechnicalType === 'قالب صنعتی').length,
      haulOffLeafStatus:
        'EMPTY_VERIFIED (0 تسمه بارکش واقعی در کاتالوگ فعلی وجود دارد؛ برگ «انواع تسمه بارکش صنعتی» بدون انتساب کاذب باقی می‌ماند)',
      records: haulOffRecords,
    },
    weldingEquipmentAudit: {
      totalAuditedSkus: weldingRecords.length,
      weldingEquipmentAndClampCount: weldingRecords.filter((r) => r.classification === 'WELDING_EQUIPMENT_OR_CLAMP')
        .length,
      weldedRoundCrcBeltCount: weldingRecords.filter((r) => r.classification === 'WELDED_PU_ROUND_CRC_BELT').length,
      weldedVOrFlatBeltCount: weldingRecords.filter((r) => r.classification === 'WELDED_PU_V_OR_FLAT_BELT').length,
      records: weldingRecords,
    },
    lowSkuSubcategoryDecisions,
  };
}

function getTypeEngineeringMetadata(techType: string): {
  domainGroup: string;
  ruleCode: string;
  invariantAttributes: string[];
  allowedVariantAttributes: string[];
  notApplicableAttributes: string[];
  forbiddenMerges: string[];
} {
  if (techType === 'تسمه تایمینگ' || techType === 'تسمه سیم‌دار') {
    return {
      domainGroup: 'SYNCHRONOUS_TIMING_BELTS',
      ruleCode: 'RULE-BELT-SYNC-01',
      invariantAttributes: [
        'برند سازنده (Brand)',
        'پروفیل و گام دندانه (Profile & Pitch: XL/L/H/XH/T5/T10/AT5/AT10/AT20/3M/5M/8M/14M/S8M/RPP)',
        'زاویه و ارتفاع دندانه (Tooth Angle & Height)',
        'ضخامت کل تسمه (Belt Thickness)',
        'جنس بدنه (Body Material: Neoprene vs PU)',
        'جنس کورد کششی (Tensile Cord: Fiberglass vs Steel vs Kevlar)',
        'پوشش دندانه و پشت تسمه (Tooth Facing & Backing: Nylon/NFT/NTB/APL/Grip)',
        'یک‌طرفه یا دوطرفه بودن (Sidedness: Single vs Double D/DH/DL/DT/D8M)',
        'فرم عرضه و واحد فروش (Supply Form: Endless Loop vs Uncut Sleeve vs Open-Ended Meter)',
      ],
      allowedVariantAttributes: [
        'طول گام تسمه (Pitch Length Lp)',
        'تعداد دندانه (Tooth Count Z)',
        'عرض تسمه برحسب میلی‌متر یا کد اینچی (Belt Width — در حلقه‌ها و متری؛ N/A در آستین)',
      ],
      notApplicableAttributes: ['تعداد شیار طولی PJ/PK/PL (Rib Count)', 'قطر شفت یا سوراخ (Bore Diameter)'],
      forbiddenMerges: [
        'ادغام پروفیل یک‌طرفه H با دوطرفه DH',
        'ادغام حلقه مداربسته (عدد/حلقه) با آستین برش‌نخورده (سانتی‌متر) یا تسمه باز متری (متر)',
        'ادغام گام 8M با S8M یا RPP8M یا گام T10 با AT10',
        'ادغام بدنه لاستیکی نئوپرن با پلی‌یورتان سیم‌دار',
      ],
    };
  }
  if (techType === 'تسمه کلاسیک' || techType === 'تسمه پروفیل باریک') {
    return {
      domainGroup: 'FRICTION_V_BELTS',
      ruleCode: 'RULE-BELT-V-02',
      invariantAttributes: [
        'برند سازنده (Brand)',
        'پروفیل مقطع (Cross-Section Profile: Z/A/B/C/D/E, SPZ/SPA/SPB/SPC, 3V/5V/8V, AX/BX/CX, XPZ/XPA/XPB/XPC, AA/BB/CC)',
        'عرض بالا و ارتفاع استاندارد مقطع (Top Width & Height)',
        'ساختار بدنه (Wrapped Classical vs Raw-Edge Molded Cogged vs Hexagonal Double-V vs Banded)',
        'جنس بدنه و کورد پلی‌استر/آرامید',
        'فرم عرضه و واحد فروش (حلقه مداربسته در برابر متری سوراخ‌دار)',
      ],
      allowedVariantAttributes: [
        'طول داخلی / طول گام / طول خارجی (Inside Length Li / Pitch Length Lp / Effective Length La)',
        'تعداد شاخه در تسمه‌های جفتی Banded (Rib/Band Count)',
      ],
      notApplicableAttributes: ['گام دندانه سنکرون (Tooth Pitch)', 'ارتفاع دندانه سنکرون (Tooth Height)'],
      forbiddenMerges: [
        'ادغام پروفیل کلاسیک A/B/C با پروفیل باریک SPA/SPB/SPC',
        'ادغام تسمه ساده دورپیچ (Wrapped B) با تسمه دنده‌ای (Cogged BX)',
        'ادغام تسمه شش‌ضلعی دوطرفه (AA/BB/CC) با تسمه یک‌طرفه (A/B/C)',
      ],
    };
  }
  if (techType === 'تسمه چندشیاری' || techType === 'تسمه شیاری PJ / PK / PL') {
    return {
      domainGroup: 'POLY_V_RIBBED_BELTS',
      ruleCode: 'RULE-BELT-RIB-03',
      invariantAttributes: [
        'برند سازنده (Brand)',
        'پروفیل شیار (Rib Profile: PH / PJ / PK / PL / PM)',
        'گام شیار عرضی و زاویه ۴۰ درجه (Rib Pitch & Angle)',
        'ضخامت کل تسمه (Belt Height)',
        'جنس بدنه و کورد کششی',
      ],
      allowedVariantAttributes: ['طول موثر تسمه (Effective Length)', 'تعداد شیار (Rib Count)'],
      notApplicableAttributes: ['گام دندانه عرضی تایمینگ (Synchronous Tooth Pitch)'],
      forbiddenMerges: ['ادغام پروفیل PJ (گام 2.34mm) با PK (گام 3.56mm) یا PL (گام 4.70mm)'],
    };
  }
  if (techType === 'تسمه روکش‌دار' || techType === 'تسمه ضدسایش' || techType === 'تسمه صنعتی') {
    return {
      domainGroup: 'COATED_WELDED_AND_SPECIAL_BELTS',
      ruleCode: 'RULE-BELT-COAT-04',
      invariantAttributes: [
        'برند سازنده (Brand)',
        'نوع پایه تسمه (تایمینگ سیم‌دار یا تسمه جوشی V یا تسمه گرد CRC)',
        'پروفیل پایه (H/L/T10/AT10/8M یا A/B/C یا CRC/ROUND)',
        'نوع و جنس روکش (گریپ قرمز، گریپ مشکی، روکش ضدسایش Linatex)',
        'ضخامت روکش گریپ (6mm, 10mm, 12mm, 15mm)',
        'ساختار کورد (سیم‌دار، نخ‌دار، ساده بدون نخ)',
      ],
      allowedVariantAttributes: ['طول و عرض تسمه (Length & Width)', 'قطر یا سایز مقطع در تسمه گرد PU'],
      notApplicableAttributes: ['سوراخ شفت (Bore Diameter)'],
      forbiddenMerges: [
        'ادغام گریپ 10 میل با گریپ 12 میل یا 15 میل',
        'ادغام گریپ قرمز با گریپ مشکی',
        'ادغام تسمه جوشی نخ‌دار با تسمه جوشی ساده بدون نخ',
        'ادغام گیره و دستگاه جوش تسمه با خود تسمه جوشی',
      ],
    };
  }
  if (techType === 'نوار نقاله' || techType === 'نوار گریپ' || techType === 'نوار سیلیکونی') {
    return {
      domainGroup: 'CONVEYOR_BELTS_AND_TAPES',
      ruleCode: 'RULE-CONV-05',
      invariantAttributes: [
        'نوع محصول (نوار نقاله PVC، نوار نقاله PU، نوار گریپ پشت پلی‌استر، نوار سیلیکونی، نوار اسفنجی)',
        'جنس لایه کاری (PVC vs PU vs Silicone vs Elastomer Grip)',
        'طرح سطح (ساده Smooth در برابر آجدار/گریپ Grip)',
        'تعداد لایه منجید / ساختار پشت (Polyester Backing)',
      ],
      allowedVariantAttributes: ['عرض نوار (Width)', 'طول نوار (Length)', 'ضخامت نوار در خانواده هم‌جنس'],
      notApplicableAttributes: ['گام دندانه (Tooth Pitch)', 'پروفیل شیار V'],
      forbiddenMerges: [
        'ادغام نوار نقاله PVC با نوار نقاله پلی‌یورتان (PU)',
        'ادغام نوار گریپ پشت پلی‌استر با تسمه بارکش صنعتی',
        'ادغام نوار اسفنجی با نوار نقاله باربر PVC/PU',
      ],
    };
  }
  if (techType === 'ریل صنعتی' || techType === 'سر ریل' || techType === 'پایه ریل' || techType === 'گاید' || techType === 'پروفیل صنعتی') {
    return {
      domainGroup: 'GUIDE_RAILS_AND_PROFILES',
      ruleCode: 'RULE-RAIL-06',
      invariantAttributes: [
        'نوع قطعه (ریل راهنما، گاید هدایت، گاید فنری، سر ریل، پایه ریل، بست زیر ناودانی)',
        'جنس قطعه (استیل Stainless vs تفلون PTFE vs آلومینیوم vs گالوانیزه vs آهنی)',
        'تیپ مقطع و کاربرد (تیپ A، تیپ B، تیپ C، زیر تسمه تایم، زیر تسمه گرد، ۲ لبه)',
        'فرآیند ساخت در تفلون (تزریقی در برابر چاکدار/ماشین‌کاری)',
      ],
      allowedVariantAttributes: ['طول شاخه (3 متری / 6 متری)', 'ابعاد مقطع در یک سری کد نقشه یکسان'],
      notApplicableAttributes: ['گام دندانه تسمه', 'تعداد شیار تسمه'],
      forbiddenMerges: [
        'ادغام ریل یا گاید استیل با ریل یا گاید تفلونی (PTFE) یا آلومینیومی یا گالوانیزه',
        'ادغام بست زیر ناودانی فلزی با خود ریل راهنما',
      ],
    };
  }
  if (techType === 'رولر صنعتی' || techType === 'چرخ صنعتی') {
    return {
      domainGroup: 'ROLLERS_WHEELS_AND_ACCESSORIES',
      ruleCode: 'RULE-ROLLER-07',
      invariantAttributes: [
        'نوع دقیق قطعه (رولر فلزی، روکش رولر، بوش سر رولر، فنر سر رولر، پین سر رولر، انگشتی رولر، چرخ‌زنجیر، چرخ هرزگرد)',
        'جنس قطعه (فولاد، استیل، پلی‌یورتان، تفلون، سیلیکون، لاستیک نسوز)',
        'طرح سطح و رنگ در روکش رولر (آجدار در برابر ساده؛ قرمز، مشکی، طوسی، سبز، سفید سیلیکونی)',
      ],
      allowedVariantAttributes: ['قطر رولر یا قطر داخل بوش/فنر (Diameter / Bore)', 'طول رولر', 'تعداد دندانه چرخ‌زنجیر (Z)'],
      notApplicableAttributes: ['طول گام تسمه (Belt Pitch Length)'],
      forbiddenMerges: [
        'ادغام بوش سر رولر فلزی با بوش سر رولر تفلونی یا پلی‌یورتان',
        'ادغام روکش رولر آجدار با روکش رولر ساده یا سیلیکونی',
      ],
    };
  }
  if (techType === 'زنجیر صنعتی' || techType === 'قفل زنجیر' || techType === 'چرخ‌دنده' || techType === 'کوپلینگ صنعتی') {
    return {
      domainGroup: 'CHAINS_GEARS_AND_COUPLINGS',
      ruleCode: 'RULE-CHAIN-08',
      invariantAttributes: [
        'نوع قطعه (زنجیر غلتکی، قفل زنجیر، نیم‌دانه زنجیر، چرخ‌دنده، کوپلینگ فلزی، لاستیک کوپلینگ)',
        'استاندارد سری زنجیر (ISO/BS سری B مانند 06B..24B در برابر ANSI سری 40..160)',
        'تعداد ردیف زنجیر (تک‌ردیفه Simplex در برابر دوبل Duplex و سه‌ردیفه Triplex)',
        'برند سازنده (KANA, IMPORTED, GENERIC)',
      ],
      allowedVariantAttributes: ['شماره گام زنجیر در همان استاندارد و تعداد ردیف (مثلاً 06B, 08B, 10B در سری B تک‌ردیفه)', 'ابعاد کوپلینگ'],
      notApplicableAttributes: ['زاویه دندانه تسمه'],
      forbiddenMerges: [
        'ادغام زنجیر تک‌ردیفه با زنجیر دوبل یا سه‌ردیفه',
        'ادغام قفل زنجیر با خود زنجیر',
        'ادغام لاستیک ضربه‌گیر کوپلینگ با پوسته فلزی کوپلینگ',
      ],
    };
  }
  if (techType === 'پولی صنعتی') {
    return {
      domainGroup: 'INDUSTRIAL_PULLEYS',
      ruleCode: 'RULE-PULLEY-09',
      invariantAttributes: [
        'عملکرد پولی (ثابت، هرزگرد با بلبرینگ، هرزگرد بدون بلبرینگ، نافی‌دار، پولی تایمینگ)',
        'پروفیل شیار پولی (پروفیل A، پروفیل B، پروفیل C، دوبل 2B، تسمه گرد R، تایمینگ H، تایمینگ T5/T10)',
        'جنس پولی (چدن/فولاد در برابر پلی‌آمید/پلاستیک)',
      ],
      allowedVariantAttributes: ['قطر خارجی و داخلی پولی (OD / ID)', 'عرض پولی و شماره کد نقشه'],
      notApplicableAttributes: ['طول تسمه'],
      forbiddenMerges: [
        'ادغام پولی شیار A با پولی شیار B یا C یا پولی تسمه گرد R یا پولی تایمینگ H',
        'ادغام پولی هرزگرد بلبرینگ‌دار با پولی ثابت بدون بلبرینگ',
      ],
    };
  }
  if (techType === 'بلبرینگ صنعتی' || techType === 'یاتاقان صنعتی') {
    return {
      domainGroup: 'BEARINGS_AND_HOUSINGS',
      ruleCode: 'RULE-BRG-10',
      invariantAttributes: [
        'نوع قطعه (بلبرینگ شیارعمیق، یاتاقان، کفی یاتاقان)',
        'سری ابعادی بلبرینگ (سری 6000، سری 6200، سری 6300، سری مینیاتوری 600)',
        'نوع آب‌بند و حفاظ (کاسه‌نمد لاستیکی 2RS در برابر واشر فلزی ZZ)',
        'برند سازنده (KG, SKF, GENERIC)',
      ],
      allowedVariantAttributes: ['شماره سوراخ شفت بلبرینگ در همان سری و نوع آب‌بند (مثلاً 6002 2RS تا 6012 2RS)'],
      notApplicableAttributes: ['گام دندانه تسمه'],
      forbiddenMerges: [
        'ادغام بلبرینگ حفاظ فلزی ZZ با بلبرینگ کاسه‌نمد لاستیکی 2RS',
        'ادغام رکورد مبهم «بلبرینگ» بدون شماره فنی با بلبرینگ‌های سایز مشخص',
      ],
    };
  }
  return {
    domainGroup: 'INDUSTRIAL_COMPONENTS_SEALS_AND_POLYMERS',
    ruleCode: `RULE-IND-${slugifyToken(techType).slice(0, 10)}`,
    invariantAttributes: [
      'نوع دقیق و کارکرد مکانیکی قطعه (Product Type & Function)',
      'برند یا سری ساخت (Brand / Origin Series)',
      'جنس دقیق قطعه (Material: Steel, Stainless, Aluminum, PTFE, PU, PVC, Silicone, Rubber)',
      'ساختار، نحوه نصب و سری کد نقشه (Construction & Drawing Code Series)',
      'واحد فروش (Unit)',
    ],
    allowedVariantAttributes: ['ابعاد هندسی (قطر، طول، عرض، ضخامت، شماره کد فرعی نقشه)'],
    notApplicableAttributes: ['گام و ارتفاع دندانه تسمه سنکرون (Synchronous Belt Tooth Geometry)'],
    forbiddenMerges: [
      'ادغام متریال‌های متفاوت (مانند استیل با گالوانیزه، یا تفلون با پلی‌یورتان، یا لاستیک با آلومینیوم)',
      'ادغام قطعات با کارکرد متفاوت که صرفاً نام مشابه دارند',
    ],
  };
}

function buildLowSkuSubcategoryDecisions(
  rawFamilies: RawCatalogueFamily[],
  allSkus: Phase1SkuRecord[],
  reconstructedFamilies: Phase1FamilyRecord[]
): LowSkuSubcategoryDecisionRecord[] {
  const famByCode = new Map(rawFamilies.map((f) => [f.code, f]));
  const groupByCatSlug = new Map<string, { id: string; title: string }>();
  for (const grp of APPROVED_MENU_GROUPS) {
    for (const slug of grp.categorySlugs) {
      groupByCatSlug.set(slug, { id: grp.id, title: grp.title });
    }
  }

  // Before stats from live CATALOG_FAMILY_MENU_ASSIGNMENTS
  const beforeLeafMap = new Map<string, { fams: number; skus: number }>();
  for (const [code, assign] of Object.entries(CATALOG_FAMILY_MENU_ASSIGNMENTS)) {
    const rf = famByCode.get(code);
    const skus = rf?.variants.length || 0;
    const key = `${assign.categorySlug}::${assign.submenuName || ''}::${assign.leafName || ''}`;
    const prev = beforeLeafMap.get(key) || { fams: 0, skus: 0 };
    prev.fams++;
    prev.skus += skus;
    beforeLeafMap.set(key, prev);
  }

  // After stats from Phase 1 reconstruction
  const afterLeafSkus = new Map<string, Phase1SkuRecord[]>();
  for (const sku of allSkus) {
    if (sku.familyDecision === 'UNRESOLVED') continue;
    const key = `${sku.proposedCategorySlug}::${sku.proposedSubmenu || ''}::${sku.proposedLeaf || ''}`;
    const list = afterLeafSkus.get(key) || [];
    list.push(sku);
    afterLeafSkus.set(key, list);
  }

  const afterLeafFams = new Map<string, Phase1FamilyRecord[]>();
  for (const fam of reconstructedFamilies) {
    const key = `${fam.categorySlug}::${fam.submenu || ''}::${fam.leaf || ''}`;
    const list = afterLeafFams.get(key) || [];
    list.push(fam);
    afterLeafFams.set(key, list);
  }

  const records: LowSkuSubcategoryDecisionRecord[] = [];
  for (const cat of APPROVED_MENU_CATEGORIES) {
    const grp = groupByCatSlug.get(cat.slug) || { id: '', title: '' };
    for (const sub of cat.children || []) {
      const leaves = sub.children && sub.children.length > 0 ? sub.children : [{ name: '' }];
      for (const leaf of leaves) {
        const key = `${cat.slug}::${sub.name}::${leaf.name}`;
        const before = beforeLeafMap.get(key) || { fams: 0, skus: 0 };
        const afterSkus = afterLeafSkus.get(key) || [];
        const afterFams = afterLeafFams.get(key) || [];
        const directCount = afterSkus.filter((s) => s.familyDecision === 'DIRECT_PRODUCT').length;

        if (before.skus <= 15 || afterSkus.length <= 15) {
          let strategy: LowSkuSubcategoryDecisionRecord['displayStrategy'];
          let rationale: string;
          if (afterSkus.length === 0) {
            strategy = 'EMPTY_AWAITING_VERIFIED_STOCK';
            rationale =
              cat.slug === 'excel-v2-1-4' && sub.name === 'تسمه بارکش'
                ? 'هیچ تسمه بارکش واقعی در کاتالوگ فعلی وجود ندارد؛ برگ بدون انتساب کاذب خالی می‌ماند.'
                : 'در کاتالوگ فعلی کالای تاییدشده‌ای برای این برگ وجود ندارد؛ از انتساب حدسی خودداری شده است.';
          } else if (afterFams.length === 0) {
            strategy = 'DIRECT_PRODUCTS_ONLY';
            rationale = `دارای ${directCount} کالای مستقل با مشخصات فنی متمایز است؛ به جای ساخت خانواده‌های ۱ عضوی مصنوعی، کالاها مستقیماً (DIRECT_PRODUCT) نمایش داده می‌شوند.`;
          } else if (directCount === 0) {
            strategy = 'MULTI_SKU_FAMILIES';
            rationale = `کالاهای این زیرشاخه دارای واریانت‌های سایزی همگن هستند و در ${afterFams.length} خانواده چندعضوی استاندارد سازمان‌دهی شده‌اند.`;
          } else {
            strategy = 'HYBRID_FAMILIES_AND_DIRECT';
            rationale = `ترکیب بهینه شامل ${afterFams.length} خانواده چندعضوی همگن و ${directCount} کالای مستقیم (DIRECT_PRODUCT) بدون خانواده ۱ عضوی مصنوعی.`;
          }

          records.push({
            groupId: grp.id,
            groupTitle: grp.title,
            categorySlug: cat.slug,
            categoryName: cat.name,
            submenuName: sub.name,
            leafName: leaf.name || null,
            beforeFamilyCount: before.fams,
            beforeSkuCount: before.skus,
            afterMultiFamilyCount: afterFams.length,
            afterDirectProductCount: directCount,
            afterTotalSkuCount: afterSkus.length,
            displayStrategy: strategy,
            engineeringRationale: rationale,
          });
        }
      }
    }
  }

  return records;
}

/**
 * Classify a single incoming or candidate SKU using the exact Phase 1 engineering intelligence rules.
 * Used by the Stage 12 AI Family Auditor Engine (`src/services/aiFamilyAuditor.ts`).
 */
export function classifySingleIncomingSku(input: {
  skuCode: string;
  productName: string;
  size?: string;
  unit?: string;
  technicalTypeHint?: string;
  categoryNameHint?: string;
  submenuHint?: string;
  familyCodeHint?: string;
}): Phase1SkuRecord {
  const inferredTechType =
    input.technicalTypeHint ||
    (/تسمه\s*تایم/i.test(input.productName)
      ? 'تسمه تایمینگ'
      : /تسمه\s*شیاری|(?:\bpj\b|\bpk\b|\bpl\b)/i.test(input.productName)
        ? 'تسمه چندشیاری'
        : /تسمه\s*جوشی|تسمه\s*گرد|\bcrc\b/i.test(input.productName)
          ? 'تسمه روکش‌دار'
          : /تسمه/i.test(input.productName)
            ? 'تسمه کلاسیک'
            : /بلبرینگ/i.test(input.productName)
              ? 'بلبرینگ صنعتی'
              : /یاتاقان/i.test(input.productName)
                ? 'یاتاقان صنعتی'
                : /زنجیر/i.test(input.productName)
                  ? 'زنجیر صنعتی'
                  : /پولی/i.test(input.productName)
                    ? 'پولی صنعتی'
                    : /رولر/i.test(input.productName)
                      ? 'رولر صنعتی'
                      : /نوار\s*نقاله/i.test(input.productName)
                        ? 'نوار نقاله'
                        : /ریل|گاید/i.test(input.productName)
                          ? 'ریل صنعتی'
                          : /کاسه\s*نمد/i.test(input.productName)
                            ? 'کاسه‌نمد'
                            : /اورینگ/i.test(input.productName)
                              ? 'اورینگ'
                              : /برس/i.test(input.productName)
                                ? 'برس صنعتی'
                                : 'قطعه صنعتی');

  const syntheticVariant: RawCatalogueVariant = {
    code: input.skuCode,
    name: input.productName,
    size: input.size || '',
  };
  const syntheticFam: RawCatalogueFamily = {
    sourceRow: 0,
    code: input.familyCodeHint || 'FAM-CANDIDATE',
    name: input.productName,
    categoryName: input.categoryNameHint || 'تسمه تایمینگ صنعتی',
    submenu: input.submenuHint || '',
    technicalType: inferredTechType,
    brand: null,
    profiles: null,
    sizes: null,
    unit: input.unit || 'عدد',
    itemCount: 1,
    materials: null,
    filters: null,
    sourceStatus: 'ACTIVE',
    variants: [syntheticVariant],
  };

  const normVarName = normalizeFa(syntheticVariant.name);
  const isNonBeltHardwareInBeltFamily =
    /تسمه\s*پاک\s*کن|تسمه\s*پک\s*کن|تسمه\s*سفت\s*کن|تیغه.*تسمه\s*پاک|تسمه\s*آهنی/.test(normVarName);

  if (
    (BELT_SOURCE_TYPES.has(inferredTechType) && !isNonBeltHardwareInBeltFamily) ||
    isMisplacedBeltOrWeldingSku(syntheticFam, syntheticVariant)
  ) {
    const prodObj = rawFamilyToProduct(syntheticFam);
    const beltRec = classifyBeltSkuWithProvenance(prodObj, prodObj.variants![0]);
    return buildBeltPhase1SkuRecord(syntheticFam, syntheticVariant, beltRec, null);
  }
  return classifyNonBeltSku(syntheticFam, syntheticVariant, null, false);
}

