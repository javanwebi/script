import type { Product, ProductVariant } from '../types';

export type BeltConfidenceLevel =
  | 'DATASHEET_VERIFIED'
  | 'NOMINAL_TABLE_VERIFIED'
  | 'SERIES_VERIFIED'
  | 'ALGORITHMIC_STANDARD_ONLY'
  | 'REQUIRES_REVIEW';

export type VerificationSourceTier =
  | 'EXACT_SKU_DATASHEET_MATCHED'
  | 'NOMINAL_DESIGNATION_REF_MATCHED'
  | 'BRAND_SERIES_AND_ISO_STANDARD'
  | 'ALGORITHMIC_REGEX_AND_ISO_TABLE'
  | 'INTERNAL_DB_CATALOG_ONLY'
  | 'UNVERIFIED_REQUIRES_PHYSICAL_REVIEW';

export type SevenLevelEvidenceClass =
  | '1_Manufacturer_Datasheet_Verified'
  | '2_Official_Catalog_Verified'
  | '3_Standard_Table_Verified'
  | '4_Brand_Series_Identified'
  | '5_Algorithmically_Classified'
  | '6_Internal_Database_Only'
  | '7_Requires_Physical_Inspection';

export type VerificationDocumentType =
  | 'MANUFACTURER_DATASHEET'
  | 'NOMINAL_REFERENCE_TABLE'
  | 'SERIES_CATALOG'
  | 'ENGINEERING_STANDARD_ONLY'
  | 'INTERNAL_CATALOG_RECORD'
  | 'NONE_UNVERIFIED';

export interface VerificationProvenance {
  tier: VerificationSourceTier;
  evidenceClass7: SevenLevelEvidenceClass;
  processedBySoftwareCode: boolean;
  extractedFromDatabase: boolean;
  manufacturerCodeIdentified: boolean;
  officialManufacturerSiteChecked: boolean;
  datasheetOrCatalogChecked: boolean;
  matchedAgainstReliableSource: boolean;
  familyConfirmedByEvidence: boolean;
  sourceUrl: string;
  documentType: VerificationDocumentType;
  matchedManufacturer: string | null;
  evidenceBasis: string;
}

export type AttributeCheckStatus =
  | 'OK_INVARIANT'
  | 'CONTROLLED_VARIANT'
  | 'NOT_APPLICABLE'
  | 'UNKNOWN'
  | 'FAIL_MIXED';

export type FamilyHomogeneityVerdict =
  | 'PASS_HOMOGENEOUS'
  | 'CONDITIONAL_UNKNOWN_SPECS'
  | 'FAIL_MIXED_INVARIANT'
  | 'FAIL_REQUIRES_PHYSICAL_REVIEW'
  | 'NON_BELT_OR_EQUIPMENT';

export interface FamilyEngineeringValidationResult {
  proposedFamilyId: string;
  brandCheck: AttributeCheckStatus;
  productTypeCheck: AttributeCheckStatus;
  operatingPrincipleCheck: AttributeCheckStatus;
  profileCheck: AttributeCheckStatus;
  pitchCheck: AttributeCheckStatus;
  toothAngleCheck: AttributeCheckStatus;
  toothHeightCheck: AttributeCheckStatus;
  beltThicknessCheck: AttributeCheckStatus;
  beltWidthCheck: AttributeCheckStatus;
  bodyMaterialCheck: AttributeCheckStatus;
  tensileCordCheck: AttributeCheckStatus;
  coveringCheck: AttributeCheckStatus;
  sidednessCheck: AttributeCheckStatus;
  supplyFormCheck: AttributeCheckStatus;
  unitCheck: AttributeCheckStatus;
  standardCheck: AttributeCheckStatus;
  mixedAttributes: string[];
  unknownAttributes: string[];
  notApplicableAttributes: string[];
  homogeneityVerdict: FamilyHomogeneityVerdict;
  passedStrictValidation: boolean;
  verdictDetail: string;
}

export interface SingletonDuplicateCheckResult {
  identicalCandidateIds: string[];
  sameBrandSimilarDiffs: string[];
  crossBrandSimilarIds: string[];
  identicalMergeCandidateCount: number;
}

export interface AuditReferenceTables {
  imperialTimingLengths?: Set<string>;
  misumiHLengths?: Set<string>;
}

export type BeltRecommendedAction =
  | 'KEEP_IN_CURRENT_FAMILY'
  | 'MOVE_TO_EXISTING_FAMILY'
  | 'CREATE_NEW_FAMILY'
  | 'SPLIT_FROM_CURRENT_FAMILY'
  | 'MOVE_TO_OTHER_CATEGORY'
  | 'MANUAL_ENGINEERING_REVIEW';

export interface BeltTechnicalParameters {
  operatingPrinciple: 'synchronous' | 'friction-v' | 'friction-ribbed' | 'friction-round-welded' | 'conveying' | 'equipment' | 'non-belt';
  beltDivision:
    | 'timing-imperial-single'
    | 'timing-imperial-double'
    | 'timing-metric-single'
    | 'timing-metric-double'
    | 'timing-htd-rpp-single'
    | 'timing-htd-rpp-double'
    | 'timing-automotive-ru'
    | 'vbelt-classical'
    | 'vbelt-narrow-wedge'
    | 'vbelt-hexagonal'
    | 'vbelt-banded'
    | 'vbelt-crowned-crc'
    | 'ribbed-poly-v'
    | 'welded-pu-round-crc'
    | 'welded-pu-v-flat'
    | 'perforated-open-v'
    | 'conveyor-pvc-pu'
    | 'conveyor-grip'
    | 'belt-welding-tool'
    | 'non-belt-pulley'
    | 'non-belt-scraper'
    | 'non-belt-tensioner'
    | 'non-belt-seal-strip'
    | 'non-belt-squeegee'
    | 'non-belt-metal'
    | 'service-ambiguous';
  supplyForm:
    | 'endless-loop'
    | 'uncut-sleeve'
    | 'open-ended-meter'
    | 'heat-weldable-meter'
    | 'perforated-meter'
    | 'roll-strip'
    | 'hardware-unit';
  sidedness: 'single-sided' | 'double-sided' | 'symmetric-round-hex' | 'not-applicable';
  profile: string;
  pitchMm: number | null;
  toothAngleDeg: number | null;
  toothHeightMm: number | null;
  beltThicknessMm: number | null;
  topWidthMm: number | null;
  nominalWidthMm: number | null;
  widthCode: string | null;
  pitchLengthMm: number | null;
  insideLengthMm: number | null;
  outsideLengthMm: number | null;
  lengthDesignation: string | null;
  toothCount: number | null;
  ribCount: number | null;
  bodyMaterial: string;
  tensileCord: string;
  backingOrCoating: string | null;
  standardReference: string;
  manufacturerSources: string[];
}

export interface BeltSkuAuditRecord {
  sku: string;
  originalName: string;
  originalSize: string;
  originalUnit: string;
  unit: string;
  currentFamilyId: string;
  currentFamilyName: string;
  currentCategory: string;
  currentSubmenu: string;
  currentSubcategory: string;
  detectedBrand: string;
  proposedCategorySlug: string;
  proposedCategoryName: string;
  proposedSubmenu: string;
  proposedLeaf: string;
  taxonomyGap: string | null;
  proposedFamilyId: string;
  proposedFamilyNameFa: string;
  proposedFamilyNameEn: string;
  actualProductType: string;
  technical: BeltTechnicalParameters;
  confidence: BeltConfidenceLevel;
  verification: VerificationProvenance;
  recommendedAction: BeltRecommendedAction;
  engineeringReasoning: string;
}

export interface ProposedBeltFamilyRecord {
  proposedFamilyId: string;
  familyNameFa: string;
  familyNameEn: string;
  categorySlug: string;
  categoryName: string;
  submenu: string;
  leaf: string;
  taxonomyGap: string | null;
  brand: string;
  beltDivision: BeltTechnicalParameters['beltDivision'];
  profile: string;
  sidedness: BeltTechnicalParameters['sidedness'];
  supplyForm: BeltTechnicalParameters['supplyForm'];
  unit: string;
  fixedSpecs: {
    pitchMm: number | null;
    toothHeightMm: number | null;
    beltThicknessMm: number | null;
    bodyMaterial: string;
    tensileCord: string;
    backingOrCoating: string | null;
    standardReference: string;
  };
  variableParameters: string[];
  skuCount: number;
  memberSkus: string[];
  sourceFamilyIds: string[];
  mergedFromFamilies: string[];
  splitFromFamilies: string[];
  excludedIncompatibleSkus: Array<{ sku: string; reason: string }>;
  technicalDescriptionFa: string;
}

export interface BeltCatalogExceptionRecord {
  type:
    | 'MISPLACED_BELT_OUTSIDE_BELT_CATEGORY'
    | 'NON_BELT_INSIDE_BELT_CATEGORY'
    | 'NON_CONVEYOR_INSIDE_CONVEYOR_CATEGORY'
    | 'MIXED_PROFILE_OR_SUPPLY_FAMILY_SPLIT'
    | 'FRAGMENTED_SERIES_MERGE'
    | 'TAXONOMY_GAP'
    | 'TYPO_IN_ORIGINAL_NAME'
    | 'AMBIGUOUS_OR_CONFLICTING_DESIGNATION';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  skuOrFamilyId: string;
  originalName: string;
  currentLocation: string;
  proposedResolution: string;
  engineeringExplanation: string;
}

export interface BeltCatalogAuditReport {
  generatedAt: string;
  totalCatalogFamilies: number;
  totalCatalogSkus: number;
  auditedSkuCount: number;
  trueBeltSkuCount: number;
  truePowerTransmissionBeltSkuCount: number;
  trueConveyorBeltSkuCount: number;
  beltEquipmentSkuCount: number;
  misplacedBeltOutsideBeltCategoryCount: number;
  nonBeltInsideBeltCategoryCount: number;
  nonConveyorInsideConveyorCategoryCount: number;
  catchAllIndustrialBeltResolvedCount: number;
  beforeFamilyCountInBeltCategories: number;
  afterProposedBeltFamilyCount: number;
  groupCounts: {
    validBeltAndConveyorFamilies: number;
    singletonValidBeltFamilies: number;
    multiMemberValidBeltFamilies: number;
    weldingToolGroups: number;
    provisionalReviewGroups: number;
    separatedNonBeltFamilies: number;
    totalProposedGroups: number;
  };
  confidenceCounts: Record<BeltConfidenceLevel, number>;
  verificationTierCounts: Record<VerificationSourceTier, number>;
  sevenLevelEvidenceCounts: Record<SevenLevelEvidenceClass, number>;
  actionCounts: Record<BeltRecommendedAction, number>;
  reconciliationPartition: {
    misplacedBeltOrEquipOutsideMovedIn: number;
    nonBeltRemovedFromBeltCat: number;
    nonConveyorRemovedFromConvCat: number;
    beltMovedFromBeltCatToConveyorCat: number;
    conveyorMovedFromConvCatToBeltCat: number;
    nonBeltAlreadyOutsideBeltOrConv: number;
    withinBeltOrConvSubcategoryChanged: number;
    withinBeltOrConvUnchanged: number;
    partitionTotal: number;
  };
  bandoSpotlight: {
    hSingleSidedCohort: BeltSkuAuditRecord[];
    dhDoubleSidedEndlessCohort: BeltSkuAuditRecord[];
    dhDoubleSidedSleeveCohort: BeltSkuAuditRecord[];
    lSingleSidedSeparatedFrom10538: BeltSkuAuditRecord[];
  };
  reportA_skuClassifications: BeltSkuAuditRecord[];
  reportB_proposedFamilies: ProposedBeltFamilyRecord[];
  reportC_exceptions: BeltCatalogExceptionRecord[];
}

const normalize = (value = '') =>
  String(value || '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\u200b-\u200f\ufeff\s]+/g, ' ')
    .trim();

const IMPERIAL_TIMING_SPECS: Record<
  string,
  {
    pitchMm: number;
    pitchIn: number;
    toothAngleDeg: number;
    toothHeightMm: number;
    beltThicknessMm: number;
    sidedness: 'single-sided' | 'double-sided';
    baseProfile: string;
  }
> = {
  MXL: { pitchMm: 2.032, pitchIn: 0.08, toothAngleDeg: 40, toothHeightMm: 0.51, beltThicknessMm: 1.14, sidedness: 'single-sided', baseProfile: 'MXL' },
  XL: { pitchMm: 5.08, pitchIn: 0.2, toothAngleDeg: 50, toothHeightMm: 1.27, beltThicknessMm: 2.3, sidedness: 'single-sided', baseProfile: 'XL' },
  DXL: { pitchMm: 5.08, pitchIn: 0.2, toothAngleDeg: 50, toothHeightMm: 1.27, beltThicknessMm: 3.05, sidedness: 'double-sided', baseProfile: 'XL' },
  L: { pitchMm: 9.525, pitchIn: 0.375, toothAngleDeg: 40, toothHeightMm: 1.91, beltThicknessMm: 3.6, sidedness: 'single-sided', baseProfile: 'L' },
  DL: { pitchMm: 9.525, pitchIn: 0.375, toothAngleDeg: 40, toothHeightMm: 1.91, beltThicknessMm: 4.6, sidedness: 'double-sided', baseProfile: 'L' },
  H: { pitchMm: 12.7, pitchIn: 0.5, toothAngleDeg: 40, toothHeightMm: 2.29, beltThicknessMm: 4.3, sidedness: 'single-sided', baseProfile: 'H' },
  DH: { pitchMm: 12.7, pitchIn: 0.5, toothAngleDeg: 40, toothHeightMm: 2.29, beltThicknessMm: 5.94, sidedness: 'double-sided', baseProfile: 'H' },
  XH: { pitchMm: 22.225, pitchIn: 0.875, toothAngleDeg: 40, toothHeightMm: 6.35, beltThicknessMm: 11.2, sidedness: 'single-sided', baseProfile: 'XH' },
};

const METRIC_PU_TIMING_SPECS: Record<
  string,
  { pitchMm: number; toothAngleDeg: number; toothHeightMm: number; beltThicknessMm: number; sidedness: 'single-sided' | 'double-sided' }
> = {
  T5: { pitchMm: 5, toothAngleDeg: 40, toothHeightMm: 1.2, beltThicknessMm: 2.2, sidedness: 'single-sided' },
  DT5: { pitchMm: 5, toothAngleDeg: 40, toothHeightMm: 1.2, beltThicknessMm: 3.4, sidedness: 'double-sided' },
  T10: { pitchMm: 10, toothAngleDeg: 40, toothHeightMm: 2.5, beltThicknessMm: 4.5, sidedness: 'single-sided' },
  DT10: { pitchMm: 10, toothAngleDeg: 40, toothHeightMm: 2.5, beltThicknessMm: 6.8, sidedness: 'double-sided' },
  T20: { pitchMm: 20, toothAngleDeg: 40, toothHeightMm: 5.0, beltThicknessMm: 8.0, sidedness: 'single-sided' },
  AT5: { pitchMm: 5, toothAngleDeg: 50, toothHeightMm: 1.2, beltThicknessMm: 2.7, sidedness: 'single-sided' },
  AT10: { pitchMm: 10, toothAngleDeg: 50, toothHeightMm: 2.5, beltThicknessMm: 4.5, sidedness: 'single-sided' },
  AT20: { pitchMm: 20, toothAngleDeg: 50, toothHeightMm: 5.0, beltThicknessMm: 8.0, sidedness: 'single-sided' },
};

const CURVILINEAR_TIMING_SPECS: Record<
  string,
  { pitchMm: number; toothHeightMm: number; beltThicknessMm: number; sidedness: 'single-sided' | 'double-sided' }
> = {
  '3M': { pitchMm: 3, toothHeightMm: 1.17, beltThicknessMm: 2.4, sidedness: 'single-sided' },
  '5M': { pitchMm: 5, toothHeightMm: 2.06, beltThicknessMm: 3.8, sidedness: 'single-sided' },
  D5M: { pitchMm: 5, toothHeightMm: 2.06, beltThicknessMm: 5.2, sidedness: 'double-sided' },
  '8M': { pitchMm: 8, toothHeightMm: 3.36, beltThicknessMm: 6.0, sidedness: 'single-sided' },
  D8M: { pitchMm: 8, toothHeightMm: 3.36, beltThicknessMm: 8.2, sidedness: 'double-sided' },
  '11M': { pitchMm: 11, toothHeightMm: 4.5, beltThicknessMm: 7.9, sidedness: 'single-sided' },
  '14M': { pitchMm: 14, toothHeightMm: 6.02, beltThicknessMm: 10.0, sidedness: 'single-sided' },
  'RPP8M': { pitchMm: 8, toothHeightMm: 3.2, beltThicknessMm: 5.4, sidedness: 'single-sided' },
  'RPP14M': { pitchMm: 14, toothHeightMm: 6.0, beltThicknessMm: 9.7, sidedness: 'single-sided' },
};

const VBELT_SPECS: Record<
  string,
  {
    topWidthMm: number;
    thicknessMm: number;
    division: BeltTechnicalParameters['beltDivision'];
    sidedness: BeltTechnicalParameters['sidedness'];
    standard: string;
  }
> = {
  Z: { topWidthMm: 10, thicknessMm: 6, division: 'vbelt-classical', sidedness: 'single-sided', standard: 'DIN 2215 / ISO 4184 (پروفیل کلاسیک Z / 9.5–10 mm)' },
  ZX: { topWidthMm: 10, thicknessMm: 6, division: 'vbelt-classical', sidedness: 'single-sided', standard: 'DIN 2215 / ISO 4184 (پروفیل دنده‌ای ZX)' },
  M: { topWidthMm: 9.5, thicknessMm: 5.5, division: 'vbelt-classical', sidedness: 'single-sided', standard: 'JIS B 1852 / K 6323 (پروفیل کلاسیک M معادل 9.5mm)' },
  MX: { topWidthMm: 9.5, thicknessMm: 5.5, division: 'vbelt-classical', sidedness: 'single-sided', standard: 'JIS B 1852 (پروفیل دنده‌ای MX)' },
  K: { topWidthMm: 8.0, thicknessMm: 5.0, division: 'vbelt-classical', sidedness: 'single-sided', standard: 'JIS B 1852 (پروفیل سبک K)' },
  A: { topWidthMm: 13, thicknessMm: 8, division: 'vbelt-classical', sidedness: 'single-sided', standard: 'DIN 2215 / ISO 4184 (پروفیل کلاسیک A 13×8 mm)' },
  AX: { topWidthMm: 13, thicknessMm: 8, division: 'vbelt-classical', sidedness: 'single-sided', standard: 'DIN 2215 / ISO 4184 (پروفیل دنده‌ای AX 13×8 mm)' },
  B: { topWidthMm: 17, thicknessMm: 11, division: 'vbelt-classical', sidedness: 'single-sided', standard: 'DIN 2215 / ISO 4184 (پروفیل کلاسیک B 17×11 mm)' },
  BX: { topWidthMm: 17, thicknessMm: 11, division: 'vbelt-classical', sidedness: 'single-sided', standard: 'DIN 2215 / ISO 4184 (پروفیل دنده‌ای BX 17×11 mm)' },
  C: { topWidthMm: 22, thicknessMm: 14, division: 'vbelt-classical', sidedness: 'single-sided', standard: 'DIN 2215 / ISO 4184 (پروفیل کلاسیک C 22×14 mm)' },
  CX: { topWidthMm: 22, thicknessMm: 14, division: 'vbelt-classical', sidedness: 'single-sided', standard: 'DIN 2215 / ISO 4184 (پروفیل دنده‌ای CX 22×14 mm)' },
  D: { topWidthMm: 32, thicknessMm: 20, division: 'vbelt-classical', sidedness: 'single-sided', standard: 'DIN 2215 / ISO 4184 (پروفیل کلاسیک D 32×20 mm)' },
  E: { topWidthMm: 40, thicknessMm: 25, division: 'vbelt-classical', sidedness: 'single-sided', standard: 'DIN 2215 / ISO 4184 (پروفیل کلاسیک E 40×25 mm)' },
  AA: { topWidthMm: 13, thicknessMm: 10, division: 'vbelt-hexagonal', sidedness: 'double-sided', standard: 'ISO 5289 / DIN 7722 (تسمه شش‌ضلعی دوطرفه AA / HAA)' },
  BB: { topWidthMm: 17, thicknessMm: 13, division: 'vbelt-hexagonal', sidedness: 'double-sided', standard: 'ISO 5289 / DIN 7722 (تسمه شش‌ضلعی دوطرفه BB / HBB)' },
  SPZ: { topWidthMm: 9.7, thicknessMm: 8, division: 'vbelt-narrow-wedge', sidedness: 'single-sided', standard: 'DIN 7753-1 / ISO 4184 (پروفیل باریک SPZ 9.7×8 mm)' },
  XPZ: { topWidthMm: 9.7, thicknessMm: 8, division: 'vbelt-narrow-wedge', sidedness: 'single-sided', standard: 'DIN 7753-1 / ISO 4184 (پروفیل باریک دنده‌ای XPZ 9.7×8 mm)' },
  SPA: { topWidthMm: 12.7, thicknessMm: 10, division: 'vbelt-narrow-wedge', sidedness: 'single-sided', standard: 'DIN 7753-1 / ISO 4184 (پروفیل باریک SPA 12.7×10 mm)' },
  XPA: { topWidthMm: 12.7, thicknessMm: 10, division: 'vbelt-narrow-wedge', sidedness: 'single-sided', standard: 'DIN 7753-1 / ISO 4184 (پروفیل باریک دنده‌ای XPA 12.7×10 mm)' },
  SPB: { topWidthMm: 16.3, thicknessMm: 13, division: 'vbelt-narrow-wedge', sidedness: 'single-sided', standard: 'DIN 7753-1 / ISO 4184 (پروفیل باریک SPB 16.3×13 mm)' },
  XPB: { topWidthMm: 16.3, thicknessMm: 13, division: 'vbelt-narrow-wedge', sidedness: 'single-sided', standard: 'DIN 7753-1 / ISO 4184 (پروفیل باریک دنده‌ای XPB 16.3×13 mm)' },
  SPC: { topWidthMm: 22, thicknessMm: 18, division: 'vbelt-narrow-wedge', sidedness: 'single-sided', standard: 'DIN 7753-1 / ISO 4184 (پروفیل باریک SPC 22×18 mm)' },
  XPC: { topWidthMm: 22, thicknessMm: 18, division: 'vbelt-narrow-wedge', sidedness: 'single-sided', standard: 'DIN 7753-1 / ISO 4184 (پروفیل باریک دنده‌ای XPC 22×18 mm)' },
  '3V': { topWidthMm: 9.5, thicknessMm: 8, division: 'vbelt-narrow-wedge', sidedness: 'single-sided', standard: 'RMA IP-22 / ISO 4184 (پروفیل گُوه‌ای 3V / 9N)' },
  '3VX': { topWidthMm: 9.5, thicknessMm: 8, division: 'vbelt-narrow-wedge', sidedness: 'single-sided', standard: 'RMA IP-22 / ISO 4184 (پروفیل گُوه‌ای دنده‌ای 3VX / 9NX)' },
  '5V': { topWidthMm: 15.9, thicknessMm: 13.5, division: 'vbelt-narrow-wedge', sidedness: 'single-sided', standard: 'RMA IP-22 / ISO 4184 (پروفیل گُوه‌ای 5V / 15N)' },
  '5VX': { topWidthMm: 15.9, thicknessMm: 13.5, division: 'vbelt-narrow-wedge', sidedness: 'single-sided', standard: 'RMA IP-22 / ISO 4184 (پروفیل گُوه‌ای دنده‌ای 5VX)' },
  '8V': { topWidthMm: 25.4, thicknessMm: 23, division: 'vbelt-narrow-wedge', sidedness: 'single-sided', standard: 'RMA IP-22 / ISO 4184 (پروفیل گُوه‌ای سنگین 8V / 25N)' },
  '8VX': { topWidthMm: 25.4, thicknessMm: 23, division: 'vbelt-narrow-wedge', sidedness: 'single-sided', standard: 'RMA IP-22 / ISO 4184 (پروفیل گُوه‌ای سنگین دنده‌ای 8VX)' },
};

const RIBBED_SPECS: Record<string, { ribPitchMm: number; thicknessMm: number; standard: string }> = {
  PJ: { ribPitchMm: 2.34, thicknessMm: 3.5, standard: 'ISO 9982 / DIN 7867 (پروفیل چندشیاری PJ با گام شیار 2.34 mm)' },
  PK: { ribPitchMm: 3.56, thicknessMm: 5.0, standard: 'ISO 9982 / DIN 7867 (پروفیل چندشیاری PK با گام شیار 3.56 mm)' },
  PL: { ribPitchMm: 4.7, thicknessMm: 7.0, standard: 'ISO 9982 / DIN 7867 (پروفیل چندشیاری PL با گام شیار 4.70 mm)' },
};

export function detectNormalizedBrand(rawName: string, rawBrand = ''): string {
  const text = `${normalize(rawName)} ${normalize(rawBrand)}`.toUpperCase();
  if (/\bBANDO\b|باندو/.test(text)) return 'BANDO';
  if (/\bOPTI(?:BELT)?\b|او?پتی(?:\s*بلت)?/.test(text)) return 'OPTIBELT';
  if (/\bMITSOB?OSHI\b|میتسوبوشی|میتسو\s*بوشی/.test(text)) return 'MITSUBOSHI';
  if (/\bMITSUBI?SH[IH]?\b|\bMITSOBISHI\b|میتسوبیشی/.test(text)) return 'MITSUBISHI';
  if (/\bMEGADYNE\b|MEGA\s*FLEX|مگادین|مگداین|مگدان/.test(text)) return 'MEGADYNE';
  if (/\bDONGIL\b|دانگیل|دانگل/.test(text)) return 'DONGIL';
  if (/\bSWR\b/.test(text)) return 'SWR';
  if (/\bCONTITECH\b|CONTINENTAL|کنتیننتال|کنتی/.test(text)) return 'CONTITECH';
  if (/\bGATES\b|گیتس/.test(text)) return 'GATES';
  if (/\bDAYCO\b|دایکو/.test(text)) return 'DAYCO';
  if (/\bSEMPERIT\b|\bSEMPREIT\b/.test(text)) return 'SEMPERIT';
  if (/\bHAN?CHANG\b|هانچانگ|هانچنگ/.test(text)) return 'HANCHANG';
  if (/\bFUJI\b|فوجی/.test(text)) return 'FUJI';
  if (/\bMITSUMI\b/.test(text)) return 'MITSUMI';
  if (/\bMITSUBAY\b/.test(text)) return 'MITSUBAY';
  if (/\bMITSUKO\b/.test(text)) return 'MITSUKO';
  if (/\bREFLEX\b/.test(text)) return 'REFLEX';
  if (/\b(?:BREAVO|BERAVOO|BERAVO|BRRAVO|BRAVO)\b|براوو/.test(text)) return 'BERAVO';
  if (/\(\s*BR\s*\)/.test(text)) return 'BR';
  if (/\bD[EI]?RA[UO]+DA\b/.test(text)) return 'DRAUDA';
  if (/\bSUPER\s*STAR\b/.test(text)) return 'SUPERSTAR';
  if (/\bINT(?:R?O)?\s*TECH\b|\bINTROTECH\b/.test(text)) return 'INTROTECH';
  if (/\bCANDRIVE\b/.test(text)) return 'CANDRIVE';
  if (/\bYAU?NGSANG?\b/.test(text)) return 'YANGSAN';
  if (/\bENTEROTECH\b/.test(text)) return 'ENTEROTECH';
  if (/\bENTRO\b/.test(text)) return 'ENTRO';
  if (/\bTOO\s*DUCK\b/.test(text)) return 'TOO-DUCK';
  if (/\bHANKOOK\b/.test(text)) return 'HANKOOK';
  if (/\bTECHNO\b/.test(text)) return 'TECHNO';
  if (/\bTEKNO\b/.test(text)) return 'TEKNO';
  if (/\bEHRE?\b/.test(text)) return 'EHRE';
  if (/\bMARSHAL+\b|مارشال/.test(text)) return 'MARSHAL';
  if (/\bHANSE\b|هانسه/.test(text)) return 'HANSE';
  if (/\bROULUNDS\b|رولندز|رولاند/.test(text)) return 'ROULUNDS';
  if (/\bSUPER\s*BELT\b|سوپربلت/.test(text)) return 'SUPERBELT';
  if (/\bMAX\s*BELT\b/.test(text)) return 'MAXBELT';
  if (/\bFORTEX\b/.test(text)) return 'FORTEX';
  if (/\bFEDERAL\b/.test(text)) return 'FEDERAL';
  if (/\bFLYPARD\b/.test(text)) return 'FLYPARD';
  if (/\bFIRST\b/.test(text)) return 'FIRST';
  if (/\bREZEX\b/.test(text)) return 'REZEX';
  if (/\bJAGER\b/.test(text)) return 'JAGER';
  if (/\bPERSON\b/.test(text)) return 'PERSON';
  if (/\bPIX\b|پیکس/.test(text)) return 'PIX';
  if (/\bFENNER\b|فنر/.test(text)) return 'FENNER';
  if (/\bUNI\s*TECH\b|\bUNITECH\b/.test(text)) return 'UNITECH';
  if (/\bPOWE?R\b|\bPWR\b/.test(text)) return 'POWER';
  if (/\bTES\b/.test(text)) return 'TES';
  if (/\bHC\b/.test(text)) return 'HC';
  if (/\bGNR\b/.test(text)) return 'GNR';
  if (/\bVOLTA\b|ولتا/.test(text)) return 'VOLTA';
  if (/\bFORZA\b|فورزا/.test(text)) return 'FORZA';
  if (/\bVEGA\b/.test(text)) return 'VEGA';
  if (/\bAA[-\s]?TOP\b|\bAATOP\b/.test(text)) return 'AA-TOP';
  if (/\bCHALLENGER\b/.test(text)) return 'CHALLENGER';
  if (/\bSYNCH\s*RONOUS\b/.test(text)) return 'SYNCHRONOUS';
  if (/\bROYAL\b/.test(text)) return 'ROYAL';
  if (/\bM\s*\.\s*T\b|\bM\s+T\b/.test(text)) return 'M.T';
  if (/\bKM\b/.test(text)) return 'KM';
  if (/\bT\s*\.\s*C\b/.test(text)) return 'T.C';
  if (/\bT\s*\.\s*K\b/.test(text)) return 'T.K';
  if (/\bT\s*-\s*B\b/.test(text)) return 'T-B';
  if (/\bB\s*\.\s*R\b/.test(text)) return 'B.R';
  if (/\bFDR\b/.test(text)) return 'FDR';
  if (/\bYS\b/.test(text)) return 'YS';
  if (/ایتالیا/.test(text)) return 'ITALY-OEM';
  if (/آلمان/.test(text)) return 'GERMANY-OEM';
  if (/کره/.test(text)) return 'KOREA-OEM';
  if (/چین/.test(text)) return 'CHINA-OEM';
  if (/تایوان/.test(text)) return 'TAIWAN-OEM';
  if (/انگلیس/.test(text)) return 'ENGLAND-OEM';
  if (/اطلس/.test(text)) return 'ATLAS';
  if (/ایرانی/.test(text)) return 'IRANIAN-OEM';
  if (/خارجی/.test(text)) return 'FOREIGN-OEM';
  const cleaned = normalize(rawBrand);
  if (cleaned && cleaned !== 'ثبت نشده' && cleaned !== 'نامشخص') {
    const ascii = cleaned.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    return ascii || 'UNSPECIFIED';
  }
  return 'UNSPECIFIED';
}

export function isBeltOrBeltAdjacentCandidate(product: Product, variant: ProductVariant): boolean {
  if (product.categoryName === 'تسمه و انتقال نیرو' || product.categoryName === 'نوار و تسمه نقاله') {
    return true;
  }
  const n = normalize(variant.name || product.name);
  return /^(?:تسمه|تسه|سمه|نسمه|نوار\s+نقاله|نوار\s+گریپ|دستگاه\s+گیره\s+آپارات\s+تسمه)(?=\s|$)/.test(n);
}

function parseImperialWidthMm(widthCode: string | null): { widthMm: number | null; codeNormalized: string | null } {
  if (!widthCode) return { widthMm: null, codeNormalized: null };
  const upper = widthCode.toUpperCase();
  if (upper.endsWith('M')) {
    const mm = Number(upper.slice(0, -1));
    return { widthMm: Number.isFinite(mm) ? mm : null, codeNormalized: `${mm}mm` };
  }
  const num = Number(upper);
  if (!Number.isFinite(num)) return { widthMm: null, codeNormalized: widthCode };
  return { widthMm: Number(((num / 100) * 25.4).toFixed(2)), codeNormalized: upper.padStart(3, '0') };
}

function computeImperialLengthAndTeeth(lengthDigits: string, profile: string): {
  lengthMm: number | null;
  teeth: number | null;
  exactMatch: boolean;
} {
  const spec = IMPERIAL_TIMING_SPECS[profile];
  if (!spec) return { lengthMm: null, teeth: null, exactMatch: false };
  const codeNum = Number(lengthDigits);
  if (!Number.isFinite(codeNum) || codeNum <= 0) return { lengthMm: null, teeth: null, exactMatch: false };
  if (profile === 'MXL') {
    if (codeNum === 480) return { lengthMm: 121.92, teeth: 60, exactMatch: true };
    const inchesHundredths = codeNum / 10;
    const teethH = Math.round(inchesHundredths / 0.08);
    if (Math.abs(teethH * 0.08 - inchesHundredths) < 0.015) {
      return { lengthMm: Number((teethH * 2.032).toFixed(2)), teeth: teethH, exactMatch: true };
    }
    return { lengthMm: null, teeth: null, exactMatch: false };
  }
  const inches = codeNum / 10;
  const rawTeeth = inches / spec.pitchIn;
  const roundedTeeth = Math.round(rawTeeth);
  const diff = Math.abs(roundedTeeth * spec.pitchIn - inches);
  if (diff <= 0.06) {
    const exactLengthMm = Number((roundedTeeth * spec.pitchMm).toFixed(2));
    return { lengthMm: exactLengthMm, teeth: roundedTeeth, exactMatch: diff < 0.001 };
  }
  return { lengthMm: null, teeth: null, exactMatch: false };
}

export function classifyBeltSku(product: Product, variant: ProductVariant): BeltSkuAuditRecord {
  const rawName = variant.name || product.name;
  const normName = normalize(rawName);
  const upperName = normName.toUpperCase();
  const rawUnit = normalize(variant.unit || product.unit || 'عدد');
  const originalUnit = rawUnit || 'عدد';
  const isMixedFamilyUnit = rawUnit.includes(',') || rawUnit.includes('،');
  const unit = isMixedFamilyUnit ? 'حلقه' : rawUnit;
  const brand = detectNormalizedBrand(rawName, product.brand);

  // 1. Check for non-belt items inside belt or conveyor categories
  if (/^پولی(?=\s|$)/.test(normName)) {
    return buildNonBeltRecord(product, variant, brand, {
      actualProductType: 'پولی صنعتی (Industrial Pulley)',
      division: 'non-belt-pulley',
      proposedCategorySlug: 'excel-v2-4-1',
      proposedCategoryName: 'انواع پولی تایمینگ',
      proposedSubmenu: 'پولی پلی‌اورتان',
      proposedLeaf: 'در سایزها و گام‌های مختلف',
      proposedFamilyId: 'FAM-AUDIT-NONBELT-PULLEY',
      proposedFamilyNameFa: 'پولی صنعتی (خارج‌شده از دسته تسمه)',
      proposedFamilyNameEn: 'Industrial Pulleys (Misplaced in Belt Category)',
      reasoning:
        'نام قطعه با «پولی» شروع می‌شود (پولی تسمه تایم، پولی تسمه گرد، پولی تسمه سفت‌کن). این اقلام چرخ/پولی فلزی یا تفلونی هستند نه تسمه انتقال نیرو.',
    });
  }

  if (/^تیغه\s+فلزی\s+نگهد\s*ارنده\s+تسمه|^تسمه\s+پ[اآ]?\s*ک?\s*کن(?=\s|$)|^تسمه\s+پک\s*کن(?=\s|$)|^تسمه\s+پاکن(?=\s|$)/.test(normName)) {
    return buildNonBeltRecord(product, variant, brand, {
      actualProductType: 'تسمه‌پاک‌کن و تیغه اسکریپر نوار نقاله (Belt Scraper / Cleaner Blade)',
      division: 'non-belt-scraper',
      proposedCategorySlug: 'excel-v2-7-1',
      proposedCategoryName: 'قطعات لاستیکی صنعتی',
      proposedSubmenu: 'انواع قطعات لاستیکی',
      proposedLeaf: 'قطعات لاستیکی عمومی و تخصصی',
      proposedFamilyId: 'FAM-AUDIT-NONBELT-SCRAPER',
      proposedFamilyNameFa: 'تیغه و لاستیک تسمه‌پاک‌کن (اسکریپر)',
      proposedFamilyNameEn: 'Conveyor Belt Scraper & Cleaner Blades',
      reasoning:
        'اقلام «تسمه پاک‌کن کد 1350/...» و «تیغه فلزی نگهدارنده تسمه پاک‌کن» تیغه‌های پاک‌کننده سطح نوار نقاله هستند و تسمه انتقال نیرو محسوب نمی‌شوند.',
    });
  }

  if (/^تسمه\s+سفت\s*کن(?=\s|$)/.test(normName)) {
    return buildNonBeltRecord(product, variant, brand, {
      actualProductType: 'تسمه‌سفت‌کن مکانیکی (Mechanical Belt Tensioner)',
      division: 'non-belt-tensioner',
      proposedCategorySlug: 'excel-v2-12-1',
      proposedCategoryName: 'قطعات مکانیکی',
      proposedSubmenu: 'تسمه‌سفت‌کن',
      proposedLeaf: 'تسمه‌سفت‌کن صنعتی و لیفتراک',
      proposedFamilyId: 'FAM-AUDIT-NONBELT-TENSIONER',
      proposedFamilyNameFa: 'تسمه‌سفت‌کن مکانیکی استکر و صنعتی',
      proposedFamilyNameEn: 'Mechanical Belt Tensioner Assembly',
      reasoning:
        'این قطعه یک مجموعه مکانیکی تسمه‌سفت‌کن است (در دسته «قطعات مکانیکی > تسمه‌سفت‌کن») و خودِ تسمه محسوب نمی‌شود.',
    });
  }

  if (/^تسمه\s+آهنی(?=\s|$)/.test(normName)) {
    return buildNonBeltRecord(product, variant, brand, {
      actualProductType: 'تسمه و چهارپهلو فولادی (Flat Steel Bar)',
      division: 'non-belt-metal',
      proposedCategorySlug: 'excel-v2-12-1',
      proposedCategoryName: 'ساخت قطعات سفارشی',
      proposedSubmenu: 'مطابق با نقشه فنی',
      proposedLeaf: 'طراحی و تولید قطعات بر اساس نقشه یا نمونه فنی شما',
      proposedFamilyId: 'FAM-AUDIT-NONBELT-STEEL-BAR',
      proposedFamilyNameFa: 'تسمه آهنی (مقطع فولادی)',
      proposedFamilyNameEn: 'Flat Steel Strap / Bar',
      reasoning:
        '«تسمه آهنی» در اصطلاح بازار آهن به ورق/مقطع تخت فولادی (Flat Bar) گفته می‌شود و ارتباطی با تسمه‌های الاستومری انتقال نیرو ندارد.',
    });
  }

  if (/^نوار\s+اسفنجی|^نوار\s+سیلیکونی(?=\s|$)/.test(normName)) {
    const isSilicone = /سیلیکون/.test(normName);
    return buildNonBeltRecord(product, variant, brand, {
      actualProductType: 'نوار آب‌بندی اسفنجی و سیلیکونی (Sponge & Silicone Sealing Strip)',
      division: 'non-belt-seal-strip',
      proposedCategorySlug: 'excel-v2-14-2',
      proposedCategoryName: 'نوار اسفنجی',
      proposedSubmenu: isSilicone ? 'نوار اسفنجی سیلیکونی' : 'نوار اسفنجی چسب‌دار و ساده',
      proposedLeaf: isSilicone ? 'انواع نوار اسفنجی سیلیکونی' : 'چسب‌دار و بدون چسب',
      proposedFamilyId: isSilicone ? 'FAM-AUDIT-NONBELT-SILICONE-STRIP' : 'FAM-AUDIT-NONBELT-SPONGE-STRIP',
      proposedFamilyNameFa: isSilicone ? 'نوار اسفنجی سیلیکونی' : 'نوار اسفنجی چسب‌دار و ساده',
      proposedFamilyNameEn: 'Sponge & Silicone Sealing Strips',
      reasoning:
        'نوارهای اسفنجی و سیلیکونی به دلیل پیشوند «نوار» در کاتالوگ اولیه تحت دسته نوار نقاله ثبت شده بودند، در حالی که جایگاه دقیق آن‌ها در اکسل `excel-v2-14-2` («نوار اسفنجی») است.',
    });
  }

  if (/^نوار\s+اسپاتول(?=\s|$)/.test(normName)) {
    return buildNonBeltRecord(product, variant, brand, {
      actualProductType: 'تیغه و نوار اسپاتول چاپ سرامیک (Ceramic Printing Spatula / Squeegee Blade)',
      division: 'non-belt-squeegee',
      proposedCategorySlug: 'excel-v2-10-1',
      proposedCategoryName: 'تجهیزات دستگاه چاپ',
      proposedSubmenu: 'اسپاتول سیلیکونی',
      proposedLeaf: 'انواع سایزهای اسپاتول سیلیکونی جهت دستگاه چاپ',
      proposedFamilyId: 'FAM-AUDIT-NONBELT-SPATULA',
      proposedFamilyNameFa: 'نوار اسپاتول پلی‌یورتان FORZA',
      proposedFamilyNameEn: 'FORZA Polyurethane Squeegee / Spatula Strips',
      reasoning:
        '«نوار اسپاتول FORZA» تیغه پلی‌یورتانی دستگاه چاپ روتوکالر کاشی است که به علت کلمه «نوار» در دسته نوار نقاله قرار گرفته بود و جایگاه صحیح آن `excel-v2-10-1` است.',
    });
  }

  if (/^دستگاه\s+گیره\s+آپارات\s+تسمه\s+جوشی/.test(normName)) {
    return {
      sku: variant.code,
      originalName: rawName,
      originalSize: variant.size || '',
      originalUnit,
      unit: 'عدد',
      currentFamilyId: product.code,
      currentFamilyName: product.name,
      currentCategory: product.categoryName,
      currentSubmenu: product.submenu || '',
      currentSubcategory: product.subcategory,
      detectedBrand: brand,
      proposedCategorySlug: 'excel-v2-1-4',
      proposedCategoryName: 'تسمه بارکش و تجهیزات جوشی',
      proposedSubmenu: 'دستگاه‌های تسمه جوشی',
      proposedLeaf: 'دستگاه جوش تسمه صنعتی',
      taxonomyGap: null,
      proposedFamilyId: `FAM-BELT-WELDING-CLAMP-${brand}`.replace(/[^A-Z0-9-]/g, ''),
      proposedFamilyNameFa: `دستگاه و گیره آپارات جوش تسمه پلی‌یورتان (${brand})`,
      proposedFamilyNameEn: `${brand} Polyurethane Belt Butt-Welding Clamp & Splicing Machine`,
      actualProductType: 'دستگاه جوش و آپارات تسمه جوشی (Belt Welding Clamp & Splicer)',
      technical: {
        operatingPrinciple: 'equipment',
        beltDivision: 'belt-welding-tool',
        supplyForm: 'hardware-unit',
        sidedness: 'not-applicable',
        profile: 'WELDING-CLAMP',
        pitchMm: null,
        toothAngleDeg: null,
        toothHeightMm: null,
        beltThicknessMm: null,
        topWidthMm: null,
        nominalWidthMm: null,
        widthCode: null,
        pitchLengthMm: null,
        insideLengthMm: null,
        outsideLengthMm: null,
        lengthDesignation: null,
        toothCount: null,
        ribCount: null,
        bodyMaterial: 'فولاد و آلومینیوم ماشین‌کاری‌شده',
        tensileCord: 'ندارد (ابزار جوشکاری)',
        backingOrCoating: null,
        standardReference: 'Thermoplastic PU Belt Butt-Welding Clamp Practice (Unbranded Tool)',
        manufacturerSources: ['Internal Sanaat Pish Equipment Catalog'],
      },
      confidence: 'ALGORITHMIC_STANDARD_ONLY',
      verification: unattachedProvenancePlaceholder(),
      recommendedAction: 'MOVE_TO_OTHER_CATEGORY',
      engineeringReasoning:
        'در ساختار منوی اکسل تأییدشده، زیرشاخه اختصاصی `excel-v2-1-4` («دستگاه‌های تسمه جوشی > دستگاه جوش تسمه صنعتی») تعریف شده است؛ این ابزار از دسته عمومی «دستگاه صنعتی» به زیرشاخه تخصصی خود منتقل می‌شود و به دلیل نام عمومی بدون برند تاییدشده در لایه داده داخلی قرار می‌گیرد.',
    };
  }

  // 2. Conveyor Belts (PVC / PU / Modular / Grip)
  if (
    /^نوار\s+نقاله(?=\s|$)/.test(normName) ||
    /^نوار\s+(?:PU|PVC)\b/i.test(normName) ||
    (product.categoryName === 'نوار و تسمه نقاله' &&
      /^نوار\s+(?:\d|شیرینگ|ضد\s*سایش|زرد|ماشین)/.test(normName))
  ) {
    const isModular = /مدولار/.test(normName);
    const isPu = /پلی\s*یورتان|\bPU\b/i.test(normName);
    const dims3 = normName.match(/(\d+(?:[./]\d+)?)\s*\*\s*(\d+(?:[./]\d+)?)\s*\*\s*(\d+(?:[./]\d+)?)/);
    const dims2 = normName.match(/(\d+(?:[./]\d+)?)\s*\*\s*(\d+(?:[./]\d+)?)/);
    let thickness: number | null = null;
    let width: number | null = null;
    let convLen: number | null = null;
    if (dims3) {
      const n1 = Number(dims3[1].replace('/', '.'));
      const n2 = Number(dims3[2].replace('/', '.'));
      const n3 = Number(dims3[3].replace('/', '.'));
      if (n1 < 25) {
        thickness = n1;
        width = n2;
        convLen = n3;
      } else {
        width = n1;
        convLen = n2;
      }
    } else if (dims2) {
      const n1 = Number(dims2[1].replace('/', '.'));
      const n2 = Number(dims2[2].replace('/', '.'));
      if (n1 < 25) {
        thickness = n1;
        width = n2;
      } else {
        width = n1;
        convLen = n2;
      }
    }
    const convSupplyForm: BeltTechnicalParameters['supplyForm'] = /مدار\s*بسته/.test(normName) ? 'endless-loop' : 'open-ended-meter';
    const convUnit = convSupplyForm === 'endless-loop' ? 'حلقه' : 'متر مربع';
    const baseFam = isModular ? 'FAM-CONVEYOR-MODULAR' : isPu ? 'FAM-CONVEYOR-PU' : 'FAM-CONVEYOR-PVC';
    return {
      sku: variant.code,
      originalName: rawName,
      originalSize: variant.size || '',
      originalUnit,
      unit: convUnit,
      currentFamilyId: product.code,
      currentFamilyName: product.name,
      currentCategory: product.categoryName,
      currentSubmenu: product.submenu || '',
      currentSubcategory: product.subcategory,
      detectedBrand: brand,
      proposedCategorySlug: 'excel-v2-2-1',
      proposedCategoryName: 'نوار نقاله صنعتی',
      proposedSubmenu: 'بر اساس جنس',
      proposedLeaf: isModular ? 'نوار مدولار' : isPu ? 'نوار نقاله پلی‌اورتان (PU)' : 'نوار نقاله PVC',
      taxonomyGap: null,
      proposedFamilyId: brand !== 'UNSPECIFIED' ? `${baseFam}-${brand}`.replace(/[^A-Z0-9-]/g, '') : baseFam,
      proposedFamilyNameFa: isModular
        ? 'نوار نقاله مدولار پلاستیکی (شیرینگ / سبدی)'
        : isPu
          ? 'نوار نقاله پلی‌یورتان (PU)'
          : 'نوار نقاله صنعتی PVC',
      proposedFamilyNameEn: isModular
        ? 'Modular Plastic Conveyor Belt'
        : isPu
          ? 'PU Industrial Conveyor Belt'
          : 'PVC Industrial Conveyor Belt',
      actualProductType: isModular
        ? 'نوار نقاله مدولار (Modular Belt)'
        : isPu
          ? 'نوار نقاله پلی‌یورتان (PU Conveyor Belt)'
          : 'نوار نقاله پی‌وی‌سی (PVC Conveyor Belt)',
      technical: {
        operatingPrinciple: 'conveying',
        beltDivision: 'conveyor-pvc-pu',
        supplyForm: convSupplyForm,
        sidedness: 'single-sided',
        profile: isPu ? 'CONVEYOR-PU' : isModular ? 'CONVEYOR-MODULAR' : 'CONVEYOR-PVC',
        pitchMm: null,
        toothAngleDeg: null,
        toothHeightMm: null,
        beltThicknessMm: thickness,
        topWidthMm: width,
        nominalWidthMm: width,
        widthCode: width ? `${width}mm` : null,
        pitchLengthMm: convLen,
        insideLengthMm: null,
        outsideLengthMm: null,
        lengthDesignation: convLen ? `${convLen}` : null,
        toothCount: null,
        ribCount: null,
        bodyMaterial: isModular
          ? 'پلی‌پروپیلن / استال مدولار (POM/PP)'
          : isPu
            ? 'پلی‌یورتان ترموپلاستیک (TPU)'
            : 'پلی‌وینیل کلراید (PVC) چندلایه منجیددار',
        tensileCord: isModular ? 'پین و مدول اینترلاک (Modular Interlock)' : 'منجید پلی‌استر (Polyester Fabric Plies)',
        backingOrCoating: /آجدار/.test(normName) ? 'سطح آجدار (Grip/Rough Top)' : 'سطح صاف یا استاندارد',
        standardReference: 'ISO 21183-1 (Light Conveyor Belts)',
        manufacturerSources: ['ISO 21183-1 Light Conveyor Belts'],
      },
      confidence: 'ALGORITHMIC_STANDARD_ONLY',
      verification: unattachedProvenancePlaceholder(),
      recommendedAction: 'KEEP_IN_CURRENT_FAMILY',
      engineeringReasoning: 'نوار نقاله استاندارد انتقال مواد منطبق با زیرشاخه نوار نقاله صنعتی (`excel-v2-2-1`).',
    };
  }

  if (/^نوار\s+گریپ(?=\s|$)/.test(normName)) {
    const widthMatch = normName.match(/(\d+)\s*(?:سانت|میلیمتر|میلی متر)?/);
    const widthVal = widthMatch ? Number(widthMatch[1]) : null;
    return {
      sku: variant.code,
      originalName: rawName,
      originalSize: variant.size || '',
      originalUnit,
      unit: 'متر',
      currentFamilyId: product.code,
      currentFamilyName: product.name,
      currentCategory: product.categoryName,
      currentSubmenu: product.submenu || '',
      currentSubcategory: product.subcategory,
      detectedBrand: brand,
      proposedCategorySlug: 'excel-v2-1-4',
      proposedCategoryName: 'تسمه بارکش و تجهیزات جوشی',
      proposedSubmenu: 'تسمه بارکش',
      proposedLeaf: 'انواع تسمه بارکش صنعتی',
      taxonomyGap: 'GAP-CONVEYOR-GRIP-STRIP: «نوار گریپ پشت‌پلی‌استر» در منوی اکسل به «تسمه بارکش > انواع تسمه بارکش صنعتی» (`excel-v2-1-4`) نگاشت شده است.',
      proposedFamilyId: 'FAM-CONVEYOR-GRIP',
      proposedFamilyNameFa: 'نوار گریپ آجدار پشت‌پلی‌استر (تسمه بارکش)',
      proposedFamilyNameEn: 'Polyester-Backed Grip Traction / Hauling Belt Strip',
      actualProductType: 'نوار گریپ آجدار بارکش و روکش غلتک (Grip Hauling / Traction Strip)',
      technical: {
        operatingPrinciple: 'conveying',
        beltDivision: 'conveyor-grip',
        supplyForm: 'roll-strip',
        sidedness: 'single-sided',
        profile: 'GRIP-STRIP',
        pitchMm: null,
        toothAngleDeg: null,
        toothHeightMm: null,
        beltThicknessMm: null,
        topWidthMm: widthVal,
        nominalWidthMm: widthVal,
        widthCode: widthVal ? `${widthVal}` : null,
        pitchLengthMm: null,
        insideLengthMm: null,
        outsideLengthMm: null,
        lengthDesignation: null,
        toothCount: null,
        ribCount: null,
        bodyMaterial: 'الاستومر/PVC آجدار ضدسایش با پشت پلی‌استر',
        tensileCord: 'بافت پلی‌استر (Polyester Fabric Backing)',
        backingOrCoating: 'سطح گریپ لانه‌زنبوری/آجدار (سبز یا مشکی)',
        standardReference: 'ISO 21183-1 / Ceramic Line Grip Strip Spec',
        manufacturerSources: ['Industrial Roller Covering & Ceramic Tile Conveying Grip Catalog'],
      },
      confidence: 'ALGORITHMIC_STANDARD_ONLY',
      verification: unattachedProvenancePlaceholder(),
      recommendedAction: 'KEEP_IN_CURRENT_FAMILY',
      engineeringReasoning: 'نوار گریپ آجدار مورد استفاده در کشش و انتقال کاشی و روکش غلتک‌های کشنده (`excel-v2-1-4`).',
    };
  }

  // 3. Detect Backing / Coating on belts
  const has3APL = /\b3\s*APL\b/i.test(upperName);
  const has6APL = /\b6\s*APL\b/i.test(upperName);
  const gripThickMatch = normName.match(/گریپ(?:\s*(?:قرمز|مشکی|سبز))?\s*(\d{1,2})\s*(?:میل|M)\b/i);
  const gripThicknessMm = gripThickMatch ? Number(gripThickMatch[1]) : null;
  const hasRedGrip = /روکش\s*قرمز|قرمز\s*آجدار|گریپ\s*قرمز|با\s*گریپ.*قرمز/.test(normName);
  const hasBlackGrip = /روکش\s*مشکی|گریپ\s*مشکی/.test(normName);
  const hasCorrugated = /روکش\s*کرکره|کرکره\s*ای/.test(normName);
  const hasDiamondTop = /روکش\s*لوزی/.test(normName);
  const hasRoughTop = /روکش\s*آجدار/.test(normName);
  const hasAntiAbrasion = /با\s*(?:روکش\s*)?ضد\s*سایش|روکش\s*ضد\s*سایش/.test(normName);
  const hasGenericGrip = /گریپ\s*دار|با\s*گریپ/.test(normName);
  const isCeramicPrint = /تسمه\s+چاپ/.test(normName);
  const hasCoating =
    has3APL ||
    has6APL ||
    gripThicknessMm !== null ||
    hasRedGrip ||
    hasBlackGrip ||
    hasCorrugated ||
    hasDiamondTop ||
    hasRoughTop ||
    hasAntiAbrasion ||
    hasGenericGrip ||
    /روکش\s*دار/.test(normName) ||
    product.subcategory === 'تسمه روکش‌دار';

  const coatingCode = has3APL
    ? '3APL'
    : has6APL
      ? '6APL'
      : gripThicknessMm !== null
        ? `GRIP-${gripThicknessMm}MM`
        : hasRedGrip
          ? 'RED-GRIP'
          : hasBlackGrip
            ? 'BLACK-GRIP'
            : hasCorrugated
              ? 'CORRUGATED'
              : hasDiamondTop
                ? 'DIAMOND'
                : hasRoughTop
                  ? 'ROUGH'
                  : hasAntiAbrasion
                    ? 'ANTI-ABRASION'
                    : hasGenericGrip
                      ? 'GRIP'
                      : isCeramicPrint
                        ? 'PRINT'
                        : hasCoating
                          ? 'COATED'
                          : 'STD';

  const coatingLabel = has3APL
    ? 'روکش لاستیکی قرمز 3APL (ضخامت 3mm)'
    : has6APL
      ? 'روکش لاستیکی قرمز 6APL (ضخامت 6mm)'
      : gripThicknessMm !== null
        ? `روکش گریپ لاستیکی ${hasRedGrip ? 'قرمز ' : hasBlackGrip ? 'مشکی ' : ''}ضخامت ${gripThicknessMm}mm`
        : hasRedGrip
          ? 'روکش لاستیکی قرمز آجدار ضدسایش'
          : hasBlackGrip
            ? 'روکش لاستیکی مشکی آجدار'
            : hasCorrugated
              ? 'روکش لاستیکی کرکره‌ای (Corrugated)'
              : hasDiamondTop
                ? 'روکش لاستیکی طرح لوزی (Diamond Top)'
                : hasRoughTop
                  ? 'روکش آجدار (Rough-Top)'
                  : hasAntiAbrasion
                    ? 'روکش ضدسایش صنعتی (Anti-Abrasion Backing)'
                    : hasGenericGrip
                      ? 'روکش گریپ ضدسایش (Grip Coated)'
                      : isCeramicPrint
                        ? 'پشت پارچه‌ای سبز/تخصصی چاپ کاشی (Megadyne TNX / Printing Spec)'
                        : hasCoating
                          ? 'روکش الاستومری/پلی‌یورتانی صنعتی'
                          : null;

  // 4. Multi-Ribbed Belts (PJ, PK, PL) — including ceramic printing 1270PJ8, starred 10PK * 1334, and PJ sleeves 1054 PJ
  const ribbedMatch =
    upperName.match(/\b(\d+)\s*(PJ|PK|PL)\s*(?:[*×-]\s*)?(\d{3,4})\b/) ||
    upperName.match(/\b(\d{3,4})\s*(PJ|PK|PL)\s*(\d+)\b/) ||
    upperName.match(/\b(\d{3,4})\s*(PJ|PK|PL)\b/) ||
    upperName.match(/\b(PJ|PK|PL)\s*(\d{3,4})\b/);

  if (ribbedMatch || product.subcategory.includes('چندشیاری') || product.subcategory.includes('شیاری PJ')) {
    let ribProfile = 'PJ';
    let ribCount: number | null = null;
    let effLengthMm: number | null = null;

    const mRibFirst = upperName.match(/\b(\d+)\s*(PJ|PK|PL)\s*(?:[*×-]\s*)?(\d{3,4})\b/);
    const mLenFirst = upperName.match(/\b(\d{3,4})\s*(PJ|PK|PL)\s*(\d+)\b/);
    const mSleeveLenFirst = upperName.match(/\b(\d{3,4})\s*(PJ|PK|PL)\b/);
    const mSleeve = upperName.match(/\b(PJ|PK|PL)\s*(\d{3,4})\b/);

    if (mRibFirst) {
      ribCount = Number(mRibFirst[1]);
      ribProfile = mRibFirst[2];
      effLengthMm = Number(mRibFirst[3]);
    } else if (mLenFirst) {
      effLengthMm = Number(mLenFirst[1]);
      ribProfile = mLenFirst[2];
      ribCount = Number(mLenFirst[3]);
    } else if (mSleeveLenFirst) {
      effLengthMm = Number(mSleeveLenFirst[1]);
      ribProfile = mSleeveLenFirst[2];
    } else if (mSleeve) {
      ribProfile = mSleeve[1];
      effLengthMm = Number(mSleeve[2]);
    }

    const rSpec = RIBBED_SPECS[ribProfile] || RIBBED_SPECS.PJ;
    const isSleeve = rawUnit.includes('سانت') || /آستین/.test(normName) || (!ribCount && (mSleeve !== null || mSleeveLenFirst !== null));
    const totalWidthMm = ribCount ? Number((ribCount * rSpec.ribPitchMm).toFixed(2)) : null;
    const normalizedRibUnit = isSleeve ? 'سانتيمتر' : 'حلقه';

    const familySuffix = isCeramicPrint
      ? `${ribProfile}-PRINT-${brand}`
      : isSleeve
        ? `${ribProfile}-SLEEVE-${brand}`
        : `${ribProfile}-${brand}`;

    return {
      sku: variant.code,
      originalName: rawName,
      originalSize: variant.size || '',
      originalUnit,
      unit: normalizedRibUnit,
      currentFamilyId: product.code,
      currentFamilyName: product.name,
      currentCategory: product.categoryName,
      currentSubmenu: product.submenu || '',
      currentSubcategory: product.subcategory,
      detectedBrand: brand,
      proposedCategorySlug: 'excel-v2-1-2',
      proposedCategoryName: 'تسمه وی‌بلت (V-Belt)',
      proposedSubmenu: 'تسمه اسپشیال',
      proposedLeaf: 'SPA , SPB , SPC و دندانه‌دار',
      taxonomyGap: `GAP-RIBBED-POLY-V: تسمه‌های چندشیاری (Poly-V پروفیل ${ribProfile} مطابق ISO 9982) زیربرگ مستقل در ` +
        '`excel-v2-1-2` ندارند و در زیربرگ «تسمه اسپشیال > SPA , SPB , SPC و دندانه‌دار» قرار می‌گیرند؛ پیشنهاد می‌شود زیربرگ «تسمه چندشیاری (PJ , PK , PL)» به اکسل اضافه شود.',
      proposedFamilyId: `FAM-RIBBED-${familySuffix.replace(/[^A-Z0-9-]/g, '')}`,
      proposedFamilyNameFa: isCeramicPrint
        ? `تسمه چندشیاری چاپ ${ribProfile} (${brand})`
        : isSleeve
          ? `تسمه چندشیاری آستین ${ribProfile} (${brand})`
          : `تسمه چندشیاری ${ribProfile} (${brand})`,
      proposedFamilyNameEn: isCeramicPrint
        ? `${brand} ${ribProfile} Ceramic Printing Poly-V Belt`
        : isSleeve
          ? `${brand} ${ribProfile} Poly-V Uncut Sleeve`
          : `${brand} ${ribProfile} Poly-V Multi-Ribbed Belt`,
      actualProductType: `تسمه چندشیاری (Poly-V Belt) پروفیل ${ribProfile}`,
      technical: {
        operatingPrinciple: 'friction-ribbed',
        beltDivision: 'ribbed-poly-v',
        supplyForm: isSleeve ? 'uncut-sleeve' : 'endless-loop',
        sidedness: /دوطرفه/i.test(upperName) ? 'double-sided' : 'single-sided',
        profile: ribProfile,
        pitchMm: rSpec.ribPitchMm,
        toothAngleDeg: 40,
        toothHeightMm: null,
        beltThicknessMm: rSpec.thicknessMm,
        topWidthMm: totalWidthMm,
        nominalWidthMm: totalWidthMm,
        widthCode: ribCount ? `${ribCount} ribs` : null,
        pitchLengthMm: effLengthMm,
        insideLengthMm: null,
        outsideLengthMm: null,
        lengthDesignation: effLengthMm ? `${effLengthMm}` : null,
        toothCount: null,
        ribCount,
        bodyMaterial: 'الاستومر مصنوعی (EPDM / کلروپرن)',
        tensileCord: 'نخ پلی‌استر کم‌کشش (Low-Stretch Polyester Cord)',
        backingOrCoating: coatingLabel,
        standardReference: rSpec.standard,
        manufacturerSources: [
          'ISO 9982 / DIN 7867 Belt Drives — V-Ribbed Belts',
          'Optibelt RB Technical Manual',
          'Megadyne PV / TNX Ceramic Printing Catalog',
        ],
      },
      confidence: 'ALGORITHMIC_STANDARD_ONLY',
      verification: unattachedProvenancePlaceholder(),
      recommendedAction:
        product.categoryName !== 'تسمه و انتقال نیرو'
          ? 'MOVE_TO_OTHER_CATEGORY'
          : product.subcategory === 'تسمه صنعتی'
            ? 'MOVE_TO_EXISTING_FAMILY'
            : 'KEEP_IN_CURRENT_FAMILY',
      engineeringReasoning: isCeramicPrint
        ? `تسمه چندشیاری ${ribProfile} مخصوص دستگاه چاپ کاشی (Megadyne 1270PJ8) که از دسته تجهیزات کاشی به خانواده تسمه‌های چندشیاری ${ribProfile} منتقل شد.`
        : `تسمه چندشیاری پروفیل ${ribProfile} با گام شیار ${rSpec.ribPitchMm} میلی‌متر مطابق ISO 9982 / DIN 7867.`,
    };
  }

  // 5. Metric Polyurethane Timing Belts (T5, DT5, T10, DT10, T20, AT5, AT10, AT20)
  const mayBeMeterRoll = rawUnit.includes('متر');
  const mWidthLenProf = upperName.match(/\b(\d+(?:[./]\d+)?)\s*[*×]\s*(\d{3,5})\s*[*×]\s*(DT5|DT10|AT5|AT10|AT20|T5|T10|T20)\b/);
  const mRollProf = upperName.match(/\b(\d+(?:[./]\d+)?)\s*[*×]\s*\([^)]+\)\s*(DT5|DT10|AT5|AT10|AT20|T5|T10|T20)\b/);
  const mOpenMeterStarWidthFirst =
    mayBeMeterRoll
      ? upperName.match(/\b(\d+(?:[./]\d+)?)\s*[*×-]\s*(DT5|DT10|AT5|AT10|AT20|T5|T10|T20)\b/)
      : null;
  const mOpenMeterWidthKeyword =
    mayBeMeterRoll
      ? upperName.match(/\b(DT5|DT10|AT5|AT10|AT20|T5|T10|T20)\b.*عرض\s*(\d+(?:[./]\d+)?)\b/) ||
        upperName.match(/\b(DT5|DT10|AT5|AT10|AT20|T5|T10|T20)\s*[*×]\s*(\d+(?:[./]\d+)?)\s*CM\b/) ||
        (/متری/.test(normName) ? upperName.match(/\b(DT5|DT10|AT5|AT10|AT20|T5|T10|T20)\b/) : null)
      : null;
  const mOpenProfWidthStar =
    mayBeMeterRoll
      ? upperName.match(/\b(DT5|DT10|AT5|AT10|AT20|T5|T10|T20)\s*[*×]\s*(\d{1,3})\b(?!\s*[*×])/)
      : null;

  const metricPuMatch =
    mWidthLenProf ||
    mRollProf ||
    mOpenMeterStarWidthFirst ||
    mOpenMeterWidthKeyword ||
    mOpenProfWidthStar ||
    upperName.match(/\b(\d+(?:[./]\d+)?)\s*(DT5|DT10|AT5|AT10|AT20|T5|T10|T20)\s*(?:[*×-]|\s+)?\s*(\d{3,5})?\b/) ||
    upperName.match(/\b(DT5|DT10|AT5|AT10|AT20|T5|T10|T20)\s*(?:[*×-]|\s+)?\s*(\d+(?:[./]\d+)?)(?:\s*[*×-]\s*(\d{3,5}))?\b/);

  if (metricPuMatch) {
    let profile = 'T10';
    let widthMm: number | null = null;
    let lengthMm: number | null = null;

    const mWidthFirst = upperName.match(/\b(\d+(?:[./]\d+)?)\s*(DT5|DT10|AT5|AT10|AT20|T5|T10|T20)(?:\s*[*×-]?\s*(\d{3,5}))?\b/);
    const mProfFirst = upperName.match(/\b(DT5|DT10|AT5|AT10|AT20|T5|T10|T20)\s*(?:[*×-]\s*)?(\d+(?:[./]\d+)?)(?:\s*[*×-]\s*(\d{3,5}))?\b/);
    const mProfLenOnly = upperName.match(/\b(DT5|DT10|AT5|AT10|AT20|T5|T10|T20)\s*(\d{3,5})\b/);

    if (mWidthLenProf) {
      widthMm = Number(mWidthLenProf[1].replace('/', '.'));
      lengthMm = Number(mWidthLenProf[2]);
      profile = mWidthLenProf[3];
    } else if (mRollProf) {
      widthMm = Number(mRollProf[1].replace('/', '.'));
      profile = mRollProf[2];
    } else if (mOpenMeterStarWidthFirst) {
      widthMm = Number(mOpenMeterStarWidthFirst[1].replace('/', '.'));
      profile = mOpenMeterStarWidthFirst[2];
    } else if (mOpenMeterWidthKeyword) {
      profile = mOpenMeterWidthKeyword[1];
      if (mOpenMeterWidthKeyword[2]) {
        const rawW = Number(mOpenMeterWidthKeyword[2].replace('/', '.'));
        widthMm = /CM\b/.test(upperName) ? rawW * 10 : rawW;
      }
    } else if (mOpenProfWidthStar) {
      profile = mOpenProfWidthStar[1];
      widthMm = Number(mOpenProfWidthStar[2]);
    } else if (mWidthFirst) {
      widthMm = Number(mWidthFirst[1].replace('/', '.'));
      profile = mWidthFirst[2];
      if (mWidthFirst[3]) lengthMm = Number(mWidthFirst[3]);
    } else if (mProfLenOnly) {
      profile = mProfLenOnly[1];
      lengthMm = Number(mProfLenOnly[2]);
    } else if (mProfFirst) {
      profile = mProfFirst[1];
      const n1 = Number(mProfFirst[2].replace('/', '.'));
      if (mProfFirst[3]) {
        widthMm = n1;
        lengthMm = Number(mProfFirst[3]);
      } else if (n1 >= 250) {
        lengthMm = n1;
      } else {
        widthMm = n1;
      }
    }

    if (!lengthMm && !mOpenProfWidthStar) {
      const starLen = upperName.match(/[*×]\s*(\d{3,5})\b/);
      if (starLen) {
        const val = Number(starLen[1]);
        if (mayBeMeterRoll && !/مدار\s*بسته/.test(normName) && val <= 150) {
          widthMm = widthMm ?? val;
        } else {
          lengthMm = val;
        }
      }
    }

    const spec = METRIC_PU_TIMING_SPECS[profile] || METRIC_PU_TIMING_SPECS.T10;
    const isSteelCord = /سیم\s*دار/.test(normName) || product.subcategory === 'تسمه سیم‌دار';
    const isEndless = /مدار\s*بسته/.test(normName) || (!mayBeMeterRoll && rawUnit.includes('حلقه')) || lengthMm !== null;
    const supplyForm: BeltTechnicalParameters['supplyForm'] = isEndless ? 'endless-loop' : 'open-ended-meter';
    const puUnit = isEndless ? 'حلقه' : 'متر';
    const teeth = lengthMm && spec.pitchMm ? Math.round(lengthMm / spec.pitchMm) : null;

    let proposedSubmenu = 'انواع گام و کدهای تایمینگ';
    let proposedLeaf = 'T5 , AT5 , AT10 , AT20';

    if (hasCoating && !isCeramicPrint) {
      proposedSubmenu = 'سیم‌دار فابریک';
      proposedLeaf = 'APL دار';
    } else if (isSteelCord && !isEndless) {
      proposedSubmenu = 'سیم‌دار فابریک';
      proposedLeaf = 'پلی‌یورتان';
    }

    const familyKey = [
      'FAM-TIMING-PU',
      profile,
      supplyForm === 'endless-loop' ? 'ENDLESS' : 'OPEN',
      coatingCode,
      brand,
    ].join('-');

    let taxonomyGap: string | null = null;
    if (spec.sidedness === 'double-sided') {
      taxonomyGap = `GAP-TIMING-DOUBLE-SIDED: پروفیل دوطرفه ${profile} در برگ «${proposedLeaf}» قرار می‌گیرد (برگ مستقل دوطرفه در اکسل وجود ندارد).`;
    } else if (profile === 'T10' || profile === 'T20') {
      taxonomyGap = `GAP-TIMING-T10-T20-LABEL: عنوان برگ در اکسل «T5 , AT5 , AT10 , AT20» است و کدهای ${profile} نیز در همین خانواده گام متریک ذوزنقه‌ای قرار می‌گیرند.`;
    }

    return {
      sku: variant.code,
      originalName: rawName,
      originalSize: variant.size || '',
      originalUnit,
      unit: puUnit,
      currentFamilyId: product.code,
      currentFamilyName: product.name,
      currentCategory: product.categoryName,
      currentSubmenu: product.submenu || '',
      currentSubcategory: product.subcategory,
      detectedBrand: brand,
      proposedCategorySlug: 'excel-v2-1-1',
      proposedCategoryName: 'تسمه تایمینگ',
      proposedSubmenu,
      proposedLeaf,
      taxonomyGap,
      proposedFamilyId: familyKey.replace(/[^A-Z0-9-]/g, ''),
      proposedFamilyNameFa: [
        'تسمه تایمینگ',
        spec.sidedness === 'double-sided' ? 'دوطرفه' : '',
        profile,
        'پلی‌یورتان سیم‌دار',
        coatingLabel ? `(${coatingLabel})` : '',
        supplyForm === 'endless-loop' ? 'مداربسته' : 'متری',
        brand !== 'UNSPECIFIED' ? brand : '',
      ]
        .filter(Boolean)
        .join(' '),
      proposedFamilyNameEn: `${brand} ${profile} ${spec.sidedness === 'double-sided' ? 'Double-Sided ' : ''}Polyurethane Steel-Cord Timing Belt (${supplyForm})`,
      actualProductType: `تسمه تایمینگ متریک پلی‌یورتان پروفیل ${profile} (${supplyForm === 'endless-loop' ? 'مداربسته' : 'کلاف متری'})`,
      technical: {
        operatingPrinciple: 'synchronous',
        beltDivision: spec.sidedness === 'double-sided' ? 'timing-metric-double' : 'timing-metric-single',
        supplyForm,
        sidedness: spec.sidedness,
        profile,
        pitchMm: spec.pitchMm,
        toothAngleDeg: spec.toothAngleDeg,
        toothHeightMm: spec.toothHeightMm,
        beltThicknessMm: spec.beltThicknessMm,
        topWidthMm: widthMm,
        nominalWidthMm: widthMm,
        widthCode: widthMm ? `${widthMm}mm` : null,
        pitchLengthMm: lengthMm,
        insideLengthMm: null,
        outsideLengthMm: null,
        lengthDesignation: lengthMm ? `${lengthMm}` : null,
        toothCount: teeth,
        ribCount: null,
        bodyMaterial: 'پلی‌یورتان ترموپلاستیک (TPU 92 ShA)',
        tensileCord: 'کورد فولادی گالوانیزه (Steel Cord)',
        backingOrCoating: coatingLabel,
        standardReference: 'DIN 7721 / ISO 17396 (تسمه‌های سنکرون متریک پروفیل T و AT)',
        manufacturerSources: [
          'DIN 7721 Synchronous Belt Drives — Metric Pitch T and AT',
          'Megadyne Megapower / Megaflex / TNX Technical Catalog',
          'Optibelt Alpha Linear / Alpha Flex Datasheet',
        ],
      },
      confidence: 'ALGORITHMIC_STANDARD_ONLY',
      verification: unattachedProvenancePlaceholder(),
      recommendedAction:
        product.categoryName !== 'تسمه و انتقال نیرو'
          ? 'MOVE_TO_OTHER_CATEGORY'
          : 'MOVE_TO_EXISTING_FAMILY',
      engineeringReasoning: isCeramicPrint
        ? `تسمه تایمینگ پلی‌یورتان ${profile} دستگاه چاپ کاشی مگادین ایتالیا که از دسته قطعات چاپ به دسته اصلی تسمه تایمینگ (${proposedLeaf}) منتقل شد.`
        : `تسمه سنکرون متریک ${profile} با گام ${spec.pitchMm} میلی‌متر مطابق DIN 7721.`,
    };
  }

  // 6. Curvilinear Metric Timing Belts (3M, 5M, D5M, 8M, D8M, 11M, 14M, RPP Silver 8M/14M)
  const isRppSilver = /\bSILVER\s*(?:8M|14M)?\b/i.test(upperName) || /\bRPP\b/i.test(upperName);
  const mSilverCurv = upperName.match(/\bSILVER\s*(8M|14M)\s*[*×-]?\s*(\d{3,5})(?:\s*[*×-]\s*(\d{1,3}))?\b/);
  const mTrail8m = upperName.match(/\b(\d{3,5})\s*[*×]\s*(\d{1,3})\s*[*×]\s*(\d{3,5})\s*[*×]\s*(8M|14M)\b/);
  const mJoinedCurv = upperName.match(/\b(\d{2})(3M|5M|8M|14M)\s*[*×-]\s*(\d{3,5})(?:\s*[*×-]\s*(\d{3,5}))?\b/);
  const mForzaRoll = mayBeMeterRoll ? upperName.match(/\b(\d{2,3})\s*[*×]\s*\([^)]+\)\s*(3M|5M|8M|14M)\b/) : null;
  const mOpenCurvWidth = upperName.match(/\b(D?3M|D?5M|D?8M|11M|14M)\s*[*×-]\s*(\d{1,3})\b(?!\s*[*×])/);
  const mSteelCurvBare = mayBeMeterRoll && /سیم\s*دار/.test(normName) ? upperName.match(/\b(D?3M|D?5M|D?8M|11M|14M)\b/) : null;
  const curvMatch =
    mSilverCurv ||
    mTrail8m ||
    mJoinedCurv ||
    mForzaRoll ||
    upperName.match(/\b(D?3M|D?5M|D?8M|11M|14M)\s*[*×-]\s*(\d{3,5})(?:\s*[*×-]\s*(\d{1,3}))?/) ||
    upperName.match(/\b(D?3M|D?5M|D?8M|11M|14M)\s+(\d{3,5})\s*[*×]\s*(\d{1,3})\b/) ||
    upperName.match(/\b(\d{3,5})\s*[- ]?\s*(D?3M|D?5M|D?8M|11M|14M)\s*[- ]?\s*(\d{1,3})?\b/) ||
    upperName.match(/\b(\d{1,3})\s*(D?3M|D?5M|D?8M|11M|14M)\s*(?:[*×-]|\s+)?\s*(\d{3,5})?\b/) ||
    upperName.match(/\b(D?3M|D?5M|D?8M|11M|14M)\s*(\d{3,5})\b/) ||
    (mayBeMeterRoll ? mOpenCurvWidth || mSteelCurvBare : null);

  const isImperialWithMetricWidth = /\b\d{2,4}\s*(?:MXL|XL|DXL|L|DL|H|DH|XH)\s*\d{1,3}M\b/.test(upperName);

  if (curvMatch && !isImperialWithMetricWidth) {
    let baseCode = '8M';
    let lengthMm: number | null = null;
    let widthMm: number | null = null;

    const mProfLenStarW = upperName.match(/\b(D?3M|D?5M|D?8M|11M|14M)\s+(\d{3,5})\s*[*×]\s*(\d{1,3})\b/);
    const mProfStarLen = upperName.match(/\b(D?3M|D?5M|D?8M|11M|14M)\s*[*×-]\s*(\d{3,5})(?:\s*[*×-]\s*(\d{1,3}))?/);
    const mLenFirst = upperName.match(/\b(\d{3,5})\s*[- ]?\s*(D?3M|D?5M|D?8M|11M|14M)(?:\s*[-*× ]\s*(\d{1,3}))?\b/);
    const mWidthFirst = upperName.match(/\b(\d{1,3})\s*(D?3M|D?5M|D?8M|11M|14M)(?:\s*[*×-]?\s*(\d{3,5}))?\b/);
    const mConcat = upperName.match(/\b(D?3M|D?5M|D?8M|11M|14M)\s*(\d{3,5})\b/);

    if (mSilverCurv) {
      baseCode = mSilverCurv[1];
      lengthMm = Number(mSilverCurv[2]);
      if (mSilverCurv[3]) widthMm = Number(mSilverCurv[3]);
    } else if (mTrail8m) {
      lengthMm = Number(mTrail8m[3]);
      widthMm = Number(mTrail8m[2]);
      baseCode = mTrail8m[4];
    } else if (mJoinedCurv) {
      widthMm = Number(mJoinedCurv[1]);
      baseCode = mJoinedCurv[2];
      lengthMm = Number(mJoinedCurv[3]);
    } else if (mForzaRoll) {
      widthMm = Number(mForzaRoll[1]);
      baseCode = mForzaRoll[2];
    } else if (mProfLenStarW) {
      baseCode = mProfLenStarW[1];
      lengthMm = Number(mProfLenStarW[2]);
      widthMm = Number(mProfLenStarW[3]);
    } else if (mProfStarLen) {
      baseCode = mProfStarLen[1];
      const v2 = Number(mProfStarLen[2]);
      if (mProfStarLen[3]) {
        lengthMm = v2;
        widthMm = Number(mProfStarLen[3]);
      } else if (mayBeMeterRoll && !/مدار\s*بسته/.test(normName) && v2 <= 150) {
        widthMm = v2;
      } else {
        lengthMm = v2;
      }
    } else if (mLenFirst && Number(mLenFirst[1]) >= 180) {
      lengthMm = Number(mLenFirst[1]);
      baseCode = mLenFirst[2];
      if (mLenFirst[3]) widthMm = Number(mLenFirst[3]);
    } else if (mWidthFirst) {
      widthMm = Number(mWidthFirst[1]);
      baseCode = mWidthFirst[2];
      if (mWidthFirst[3]) lengthMm = Number(mWidthFirst[3]);
    } else if (mConcat) {
      baseCode = mConcat[1];
      lengthMm = Number(mConcat[2]);
    } else if (mOpenCurvWidth && mayBeMeterRoll) {
      baseCode = mOpenCurvWidth[1];
      widthMm = Number(mOpenCurvWidth[2]);
    } else if (mSteelCurvBare && mayBeMeterRoll) {
      baseCode = mSteelCurvBare[1];
    }

    const profileKey = isRppSilver && (baseCode === '8M' || baseCode === '14M') ? `RPP${baseCode}` : baseCode;
    const spec = CURVILINEAR_TIMING_SPECS[profileKey] || CURVILINEAR_TIMING_SPECS[baseCode] || CURVILINEAR_TIMING_SPECS['8M'];
    const isSteelCordHtd = /سیم\s*دار/.test(normName) || product.subcategory === 'تسمه سیم‌دار';
    const isSleeve = !isMixedFamilyUnit && rawUnit.includes('سانت');
    const isOpen =
      !isSleeve &&
      !/مدار\s*بسته/.test(normName) &&
      ((mayBeMeterRoll && lengthMm === null) || (rawUnit === 'متر' && lengthMm === null) || /متری/.test(normName));
    const supplyForm: BeltTechnicalParameters['supplyForm'] = isSleeve
      ? 'uncut-sleeve'
      : isOpen
        ? 'open-ended-meter'
        : 'endless-loop';
    const htdUnit = isSleeve ? 'سانتيمتر' : isOpen ? 'متر' : 'حلقه';
    const teeth = lengthMm && spec.pitchMm ? Math.round(lengthMm / spec.pitchMm) : null;

    let taxonomyGap: string | null = null;
    if (spec.sidedness === 'double-sided') {
      taxonomyGap = `GAP-TIMING-DOUBLE-SIDED: پروفیل دوطرفه ${baseCode} در زیربرگ «5M , 8M , 11M , 14M» قرار می‌گیرد زیرا برگ مستقل دوطرفه در اکسل وجود ندارد.`;
    } else if (baseCode === '3M' || isRppSilver) {
      taxonomyGap = `GAP-TIMING-MXL-3M-RPP: پروفیل ${isRppSilver ? `RPP Silver ${baseCode}` : baseCode} به نزدیک‌ترین زیربرگ «5M , 8M , 11M , 14M» نگاشت شد.`;
    }

    const matVariantTag = isSteelCordHtd ? 'STEEL-TPU' : coatingCode;
    const famParts = [
      'FAM-TIMING-HTD',
      profileKey,
      supplyForm === 'uncut-sleeve' ? 'SLEEVE' : supplyForm === 'open-ended-meter' ? 'OPEN' : 'ENDLESS',
      isSteelCordHtd && coatingCode !== 'STD' ? `STEEL-TPU-${coatingCode}` : matVariantTag,
      brand,
    ];
    const familyId = famParts.join('-').replace(/[^A-Z0-9-]/g, '');

    let proposedSubmenu = 'انواع گام و کدهای تایمینگ';
    let proposedLeaf = '5M , 8M , 11M , 14M';
    if (hasCoating) {
      proposedSubmenu = 'سیم‌دار فابریک';
      proposedLeaf = 'APL دار';
    } else if (supplyForm === 'open-ended-meter') {
      proposedSubmenu = 'سیم‌دار فابریک';
      proposedLeaf = 'پلی‌یورتان';
    }

    return {
      sku: variant.code,
      originalName: rawName,
      originalSize: variant.size || '',
      originalUnit,
      unit: htdUnit,
      currentFamilyId: product.code,
      currentFamilyName: product.name,
      currentCategory: product.categoryName,
      currentSubmenu: product.submenu || '',
      currentSubcategory: product.subcategory,
      detectedBrand: brand,
      proposedCategorySlug: 'excel-v2-1-1',
      proposedCategoryName: 'تسمه تایمینگ',
      proposedSubmenu,
      proposedLeaf,
      taxonomyGap,
      proposedFamilyId: familyId,
      proposedFamilyNameFa: [
        'تسمه تایمینگ',
        spec.sidedness === 'double-sided' ? 'دوطرفه' : '',
        isRppSilver ? `RPP Silver ${baseCode}` : baseCode,
        isSteelCordHtd ? 'پلی‌یورتان سیم‌دار' : '',
        coatingLabel ? `(${coatingLabel})` : '',
        supplyForm === 'uncut-sleeve' ? 'آستین' : supplyForm === 'open-ended-meter' ? 'متری' : '',
        brand !== 'UNSPECIFIED' ? brand : '',
      ]
        .filter(Boolean)
        .join(' '),
      proposedFamilyNameEn: `${brand} ${isRppSilver ? `Isoran RPP Silver ${baseCode}` : `HTD ${baseCode}`} ${isSteelCordHtd ? 'TPU Steel-Cord ' : ''}Timing Belt (${supplyForm})`,
      actualProductType: isRppSilver
        ? `تسمه تایمینگ پروفیل سهموی Megadyne Isoran RPP Silver ${baseCode}`
        : `تسمه تایمینگ منحنی‌الخط (HTD) پروفیل ${baseCode}${isSteelCordHtd ? ' پلی‌یورتان سیم‌دار' : ''}`,
      technical: {
        operatingPrinciple: 'synchronous',
        beltDivision: spec.sidedness === 'double-sided' ? 'timing-htd-rpp-double' : 'timing-htd-rpp-single',
        supplyForm,
        sidedness: spec.sidedness,
        profile: isRppSilver ? `RPP-${baseCode}` : baseCode,
        pitchMm: spec.pitchMm,
        toothAngleDeg: null,
        toothHeightMm: spec.toothHeightMm,
        beltThicknessMm: spec.beltThicknessMm,
        topWidthMm: widthMm,
        nominalWidthMm: widthMm,
        widthCode: widthMm ? `${widthMm}mm` : null,
        pitchLengthMm: lengthMm,
        insideLengthMm: null,
        outsideLengthMm: null,
        lengthDesignation: lengthMm ? `${lengthMm}` : null,
        toothCount: teeth,
        ribCount: null,
        bodyMaterial: isRppSilver
          ? 'ترکیب کلروپرن تقویت‌شده سختی 90 ShA (Megadyne RPP Silver)'
          : isSteelCordHtd
            ? 'پلی‌یورتان ترموپلاستیک (TPU) با کورد فولادی'
            : supplyForm === 'open-ended-meter'
              ? 'پلی‌یورتان متری اکسترودشده (TPU Open-Roll)'
              : 'لاستیک کلروپرن (Neoprene) با روکش دندانه نایلونی',
        tensileCord: isSteelCordHtd || supplyForm === 'open-ended-meter'
          ? 'کورد فولادی (Steel Cord)'
          : 'کورد فایبرگلاس پرتاب (High-Modulus Fiberglass Cord)',
        backingOrCoating: coatingLabel,
        standardReference: 'ISO 13050:2014 (Synchronous Belt Drives — Curvilinear Pitch G, H, R, S)',
        manufacturerSources: [
          'ISO 13050:2014 Synchronous Belt Drives — Metric Pitch Curvilinear Tooth Systems',
          'Megadyne Isoran RPP & RPP Silver Technical Catalogue',
          'Optibelt OMEGA / Bando Synchro-Link STS/HTS Datasheet',
        ],
      },
      confidence: 'ALGORITHMIC_STANDARD_ONLY',
      verification: unattachedProvenancePlaceholder(),
      recommendedAction:
        product.subcategory === 'تسمه صنعتی' ? 'MOVE_TO_EXISTING_FAMILY' : 'KEEP_IN_CURRENT_FAMILY',
      engineeringReasoning: `تسمه سنکرون دندانه منحنی پروفیل ${isRppSilver ? `RPP Silver ${baseCode}` : baseCode} با گام ${spec.pitchMm} میلی‌متر مطابق ISO 13050.`,
    };
  }

  // 7. Imperial Trapezoidal Timing Belts (MXL, XL, DXL, L, DL, H, DH, XH)
  const impOpenMatch =
    upperName.match(/\b(\d{2,3})\s*(?:[*×]\s*\([^)]+\)\s*)?(XH|DH|DL|DXL|MXL|XL|L|H)(?:\s*[*×-]?\s*(\d{4,5})\b)?/) ||
    upperName.match(/\b(XH|DH|DL|DXL|MXL|XL|L|H)\s*(?:[*×-]\s*|.*عرض\s*)(\d{2,3})\b/);
  const impLoopMatch = upperName.match(/\b(\d{2,5}(?:[./]\d+)?)\s*(MXL|DXL|XL|DL|L|DH|H|XH)(?:\s*[-*× ]?\s*(\d{2,3}M?)\b)?/);

  const isSteelCordTiming = /سیم\s*دار/.test(normName) || product.subcategory === 'تسمه سیم‌دار';

  if (impLoopMatch || (isSteelCordTiming && impOpenMatch)) {
    let profile = 'H';
    let lengthCode: string | null = null;
    let widthCode: string | null = null;
    let pitchLengthMm: number | null = null;
    let nominalWidthMm: number | null = null;
    let toothCount: number | null = null;

    if (isSteelCordTiming && impOpenMatch && (unit === 'متر' || impOpenMatch[3] || !impLoopMatch)) {
      const firstIsProf = Boolean(IMPERIAL_TIMING_SPECS[impOpenMatch[1]]);
      profile = firstIsProf ? impOpenMatch[1] : impOpenMatch[2];
      const wNum = Number(firstIsProf ? impOpenMatch[2] : impOpenMatch[1]);
      if ([75, 100, 150, 200, 300].includes(wNum) && !/عرض/.test(normName)) {
        nominalWidthMm = Number(((wNum / 100) * 25.4).toFixed(2));
        widthCode = String(wNum).padStart(3, '0');
      } else {
        nominalWidthMm = wNum;
        widthCode = `${wNum}mm`;
      }
      if (impOpenMatch[3]) {
        pitchLengthMm = Number(impOpenMatch[3]);
      }
    } else if (impLoopMatch) {
      lengthCode = impLoopMatch[1].replace('/', '.');
      profile = impLoopMatch[2];
      widthCode = impLoopMatch[3] || null;
      const parsedW = parseImperialWidthMm(widthCode);
      nominalWidthMm = parsedW.widthMm;
      widthCode = parsedW.codeNormalized;
      const lenInfo = computeImperialLengthAndTeeth(lengthCode, profile);
      pitchLengthMm = lenInfo.lengthMm;
      toothCount = lenInfo.teeth;
    }

    const spec = IMPERIAL_TIMING_SPECS[profile] || IMPERIAL_TIMING_SPECS.H;
    const isSleeve =
      /آستین/.test(normName) ||
      (!widthCode && !isSteelCordTiming && impLoopMatch !== null) ||
      (!isMixedFamilyUnit && unit.includes('سانت') && !widthCode);
    const supplyForm: BeltTechnicalParameters['supplyForm'] = isSteelCordTiming
      ? pitchLengthMm
        ? 'endless-loop'
        : 'open-ended-meter'
      : isSleeve
        ? 'uncut-sleeve'
        : 'endless-loop';
    const effectiveUnit =
      supplyForm === 'uncut-sleeve'
        ? 'سانتيمتر'
        : supplyForm === 'open-ended-meter'
          ? 'متر'
          : 'حلقه';

    let proposedSubmenu = 'انواع گام و کدهای تایمینگ';
    let proposedLeaf = 'H , XH , L , XL';
    if (hasCoating) {
      proposedSubmenu = 'سیم‌دار فابریک';
      proposedLeaf = 'APL دار';
    } else if (isSteelCordTiming && supplyForm === 'open-ended-meter') {
      proposedSubmenu = 'سیم‌دار فابریک';
      proposedLeaf = 'پلی‌یورتان';
    }

    let taxonomyGap: string | null = null;
    if (spec.sidedness === 'double-sided') {
      taxonomyGap = `GAP-TIMING-DOUBLE-SIDED: پروفیل دوطرفه ${profile} (گام ${spec.pitchMm} میلی‌متر) در زیربرگ «H , XH , L , XL» قرار می‌گیرد؛ پیشنهاد می‌شود زیربرگ مستقل «DL , DH , DXL (دوطرفه)» در بازنگری اکسل اضافه شود.`;
    } else if (profile === 'MXL') {
      taxonomyGap = 'GAP-TIMING-MXL-3M-RPP: پروفیل ظریف MXL (گام 2.032 میلی‌متر) در زیربرگ «H , XH , L , XL» قرار می‌گیرد.';
    }

    const familyId = [
      'FAM-TIMING-IMP',
      profile,
      supplyForm === 'uncut-sleeve' ? 'SLEEVE' : supplyForm === 'open-ended-meter' ? 'OPEN-STEEL' : 'ENDLESS',
      isSteelCordTiming ? (coatingCode !== 'STD' ? `STEEL-TPU-${coatingCode}` : 'STEEL-TPU') : coatingCode,
      brand,
    ]
      .join('-')
      .replace(/[^A-Z0-9-]/g, '');

    const isSplitFromMixed10538 =
      product.code === 'FAM-10538' && (profile !== 'H' || supplyForm !== 'endless-loop');

    let recommendedAction: BeltRecommendedAction = 'KEEP_IN_CURRENT_FAMILY';
    if (product.categoryName !== 'تسمه و انتقال نیرو') {
      recommendedAction = 'MOVE_TO_OTHER_CATEGORY';
    } else if (isSplitFromMixed10538) {
      recommendedAction = 'SPLIT_FROM_CURRENT_FAMILY';
    } else if (product.subcategory === 'تسمه صنعتی' || product.code === 'FAM-36103' || product.code === 'FAM-41322') {
      recommendedAction = 'MOVE_TO_EXISTING_FAMILY';
    }

    const confidence: BeltConfidenceLevel = 'ALGORITHMIC_STANDARD_ONLY';

    return {
      sku: variant.code,
      originalName: rawName,
      originalSize: variant.size || '',
      originalUnit,
      unit: effectiveUnit,
      currentFamilyId: product.code,
      currentFamilyName: product.name,
      currentCategory: product.categoryName,
      currentSubmenu: product.submenu || '',
      currentSubcategory: product.subcategory,
      detectedBrand: brand,
      proposedCategorySlug: 'excel-v2-1-1',
      proposedCategoryName: 'تسمه تایمینگ',
      proposedSubmenu,
      proposedLeaf,
      taxonomyGap,
      proposedFamilyId: familyId,
      proposedFamilyNameFa: [
        'تسمه تایمینگ',
        spec.sidedness === 'double-sided' ? 'دوطرفه' : '',
        profile,
        isSteelCordTiming ? 'پلی‌یورتان سیم‌دار' : '',
        supplyForm === 'uncut-sleeve'
          ? 'آستین'
          : supplyForm === 'open-ended-meter'
            ? 'متری'
            : '',
        coatingLabel ? `(${coatingLabel})` : '',
        brand !== 'UNSPECIFIED' ? brand : '',
      ]
        .filter(Boolean)
        .join(' '),
      proposedFamilyNameEn: `${brand} Synchro-Link / Imperial ${profile} ${
        spec.sidedness === 'double-sided' ? 'Double-Sided ' : ''
      }Timing Belt (${supplyForm})`,
      actualProductType: `تسمه تایمینگ ذوزنقه‌ای اینچی ${
        spec.sidedness === 'double-sided' ? 'دوطرفه ' : 'یک‌طرفه '
      }پروفیل ${profile} (${
        supplyForm === 'uncut-sleeve' ? 'آستین برش‌نخورده' : supplyForm === 'open-ended-meter' ? 'سیم‌دار متری' : 'حلقه مداربسته'
      })`,
      technical: {
        operatingPrinciple: 'synchronous',
        beltDivision: spec.sidedness === 'double-sided' ? 'timing-imperial-double' : 'timing-imperial-single',
        supplyForm,
        sidedness: spec.sidedness,
        profile,
        pitchMm: spec.pitchMm,
        toothAngleDeg: spec.toothAngleDeg,
        toothHeightMm: spec.toothHeightMm,
        beltThicknessMm: spec.beltThicknessMm,
        topWidthMm: nominalWidthMm,
        nominalWidthMm,
        widthCode,
        pitchLengthMm,
        insideLengthMm: null,
        outsideLengthMm: null,
        lengthDesignation: lengthCode ? `${lengthCode}${profile}` : null,
        toothCount,
        ribCount: null,
        bodyMaterial: isSteelCordTiming
          ? 'پلی‌یورتان ترموپلاستیک (TPU) سفید/صنعتی'
          : 'لاستیک کلروپرن (Neoprene) مقاوم در برابر روغن و حرارت',
        tensileCord: isSteelCordTiming
          ? 'کورد فولادی (Steel Cord)'
          : 'کورد فایبرگلاس پرتاب (High-Modulus Fiberglass Cord) با روکش دندانه نایلونی',
        backingOrCoating: coatingLabel,
        standardReference: 'ISO 19347:2015 / DIN ISO 5296 / RMA IP-24 (Imperial Trapezoidal Synchronous Belts)',
        manufacturerSources: [
          'Bando Synchro-Link® Timing Belts Technical Catalog (Profiles MXL, XL, L, H, XH, DXL, DL, DH)',
          'ISO 19347:2015 Synchronous belt drives — Imperial pitch trapezoidal profile system',
          'Optibelt ZR / ZRD Technical Manual',
          'MISUMI Imperial Timing Belt Technical Reference',
        ],
      },
      confidence,
      verification: unattachedProvenancePlaceholder(),
      recommendedAction,
      engineeringReasoning: buildImperialTimingReasoning(
        variant.code,
        rawName,
        brand,
        profile,
        spec,
        lengthCode,
        pitchLengthMm,
        toothCount,
        widthCode,
        nominalWidthMm,
        supplyForm,
        product.code
      ),
    };
  }

  // 7b. Automotive & Forklift Round-Tooth Camshaft Timing Belts (تسمه تايم گرد ماشيني / 123RU24)
  if (/تسمه\s+تایم\s+گرد\s+ماشینی/.test(normName) || /\b(\d{2,3})\s*RU\s*(\d{2})\b/.test(upperName)) {
    const ruMatch = upperName.match(/\b(\d{2,3})\s*RU\s*(\d{2})\b/);
    const pairMatch = normName.match(/(\d+(?:[./]\d+)?)\s*\*\s*(\d+(?:[./]\d+)?)/);
    let teeth: number | null = null;
    let widthMm: number | null = null;
    if (ruMatch) {
      teeth = Number(ruMatch[1]);
      widthMm = Number(ruMatch[2]);
    } else if (pairMatch) {
      const a = Number(pairMatch[1].replace('/', '.'));
      const b = Number(pairMatch[2].replace('/', '.'));
      teeth = Math.round(Math.max(a, b));
      widthMm = Math.min(a, b);
    }

    const ZRK_CROSS_REFS: Record<
      string,
      { pitchMm: number; zrkCode: string; profile: string; lengthMm: number; equiv: string; note: string }
    > = {
      '31501': {
        pitchMm: 9.525,
        zrkCode: 'ZRK 1118',
        profile: 'AUTO-RU',
        lengthMm: 1029,
        equiv: 'Gates 5047 / Dayco 94110 (Honda 108T × 17mm)',
        note: 'تسمه تایم دنده‌گرد ماشینی 108×17 (Optibelt ZRK 1118، 108 دندانه × 17mm، گام 9.525mm، طول 1029mm).',
      },
      '31502': {
        pitchMm: 9.525,
        zrkCode: 'ZRK 1119',
        profile: 'AUTO-RU',
        lengthMm: 1029,
        equiv: 'Optibelt HR 58108 x 24 / Gates 5082XS / Honda 06141-PC6-305 (108T × 24mm)',
        note: 'تطبیق با Optibelt ZRK 1119 (HR 58108 × 24، گام 9.525mm، طول 1029mm)؛ به دلیل نبود کد ZRK روی لیبل انبار و امکان تشابه عددی با 864-8M (108×8=864mm)، چاپ بدنه در فاز 4 تایید شود.',
      },
      '31504': {
        pitchMm: 9.525,
        zrkCode: 'ZRK 1128',
        profile: 'AUTO-RU',
        lengthMm: 1086,
        equiv: 'Optibelt HR 58114 x 17 / Gates 5215XS / Hutchinson 114 HTDP 17 (PSA/Fiat 1.8/2.0L)',
        note: 'تطبیق با Optibelt ZRK 1128 (HR 58114 × 17، گام 9.525mm، طول 1086mm)؛ تایید چاپ ZRK روی لیبل در فاز 4 توصیه می‌شود.',
      },
      '31505': {
        pitchMm: 9.525,
        zrkCode: 'ZRK 1537',
        profile: 'AUTO-RU',
        lengthMm: 1276,
        equiv: 'Optibelt HR 76134 x 25 / Gates 5581XS / ContiTech CT1065 / Dayco 94957 (PSA 1.6L 16V)',
        note: 'تطبیق با Optibelt ZRK 1537 (HR 76134 × 25، گام 9.525mm، طول 1276mm)؛ به دلیل تشابه عددی با 1072-8M (134×8=1072mm)، تایید چاپ ZRK در فاز 4 توصیه می‌شود.',
      },
      '31506': {
        pitchMm: 9.525,
        zrkCode: 'ZRK 1262 / ZRK 1538',
        profile: 'AUTO-RU',
        lengthMm: 1295,
        equiv: 'Gates 5049XS (ZRK 1262) / ContiTech CT996 & Gates 5539 & Dayco 94714 (ZRK 1538)',
        note: 'تطبیق با Optibelt ZRK 1262 یا ZRK 1538 (هر دو 136 دندانه، عرض 25/25.4mm، گام 9.525mm، طول 1295mm)؛ تایید نسخه دقیق ZRK از چاپ روی تسمه در فاز 4 انجام شود.',
      },
      '31769': {
        pitchMm: 9.525,
        zrkCode: 'ZRK 1593',
        profile: 'AUTO-RU',
        lengthMm: 1305,
        equiv: 'ContiTech CT1137 (HTDA 1305 9.525 M 22) / Gates 5631XS / Hutchinson 137 AHP 22',
        note: 'تطبیق با Optibelt ZRK 1593 (137 دندانه × 22mm، طول 1305mm، گام قطعی 9.525mm).',
      },
      '34722': {
        pitchMm: 9.525,
        zrkCode: 'ZRK 1182',
        profile: 'AUTO-RU',
        lengthMm: 1210,
        equiv: 'Optibelt ZRK 1182 / ContiTech CT887 / Dayco 94346 (127T × 25mm)',
        note: 'نام انبار 25*127 معادل عرض 25mm و 127 دندانه (ZRK 1182 / CT887، طول 1210mm، گام 9.525mm).',
      },
      '35232': {
        pitchMm: 9.525,
        zrkCode: 'ZRK 1176',
        profile: 'AUTO-RU',
        lengthMm: 1172,
        equiv: 'Optibelt ZRK 1176 / Dayco 94468 (TB232) / Gates T232 (Mitsubishi 4G64 123T × 29mm)',
        note: 'نام انبار 29*123 معادل عرض 29mm و 123 دندانه (ZRK 1176 / Gates T232، طول 1172mm، گام 9.525mm).',
      },
      '35023': {
        pitchMm: 8,
        zrkCode: 'ZRK 1459',
        profile: 'AUTO-8MM',
        lengthMm: 520,
        equiv: 'ContiTech CT1039 (HTDA 520 8000M 12.7) / Gates 5257XS / Dayco 94195 / Mitsubishi MD182295 (Balance Shaft)',
        note: 'تطبیق قطعی با تسمه بالانسر Mitsubishi MD182295 (Optibelt ZRK 1459 / ContiTech CT1039): 65 دندانه × 12.7mm با گام 8.000mm (طول 520mm) — بنابراین از خانواده 9.525mm جدا شد!',
      },
    };

    const ref = ZRK_CROSS_REFS[variant.code];
    const verifiedPitch = ref ? ref.pitchMm : ruMatch ? 9.525 : null;
    const autoProfile = ref ? ref.profile : 'AUTO-RU';
    const pitchLen = ref
      ? ref.lengthMm
      : verifiedPitch && teeth
        ? Number((teeth * verifiedPitch).toFixed(1))
        : null;
    const is8mm = verifiedPitch === 8;

    return {
      sku: variant.code,
      originalName: rawName,
      originalSize: variant.size || '',
      originalUnit,
      unit: 'حلقه',
      currentFamilyId: product.code,
      currentFamilyName: product.name,
      currentCategory: product.categoryName,
      currentSubmenu: product.submenu || '',
      currentSubcategory: product.subcategory,
      detectedBrand: brand,
      proposedCategorySlug: 'excel-v2-1-1',
      proposedCategoryName: 'تسمه تایمینگ',
      proposedSubmenu: 'انواع گام و کدهای تایمینگ',
      proposedLeaf: '5M , 8M , 11M , 14M',
      taxonomyGap:
        'GAP-TIMING-AUTOMOTIVE-RU: تسمه‌های تایم دنده‌گرد خودرویی و لیفتراکی (سری Optibelt ZRK و RU) زیربرگ اختصاصی در اکسل صنعتی ندارند و به‌صورت موقت به `excel-v2-1-1` نگاشت شده‌اند تا درباره نگهداری در سبد صنعتی یا تفکیک خودرویی تصمیم‌گیری شود.',
      proposedFamilyId: `${
        is8mm ? 'FAM-TIMING-AUTO-8MM' : verifiedPitch ? 'FAM-TIMING-AUTO-RU-9P5' : 'FAM-TIMING-AUTO-RU-ZRK-REVIEW'
      }-${brand}`.replace(/[^A-Z0-9-]/g, ''),
      proposedFamilyNameFa: is8mm
        ? `تسمه تایمینگ دنده‌گرد خودرویی گام 8mm (${brand})`
        : verifiedPitch
          ? `تسمه تایمینگ دنده‌گرد خودرویی/لیفتراک گام 9.525mm (${brand})`
          : `تسمه تایمینگ دنده‌گرد ZRK نیازمند تطبیق گام (${brand})`,
      proposedFamilyNameEn: `${brand} Automotive & Forklift Round-Tooth Timing Belt (${
        is8mm ? '8.000mm HTDA/ZRK 1459' : verifiedPitch ? '9.525mm RU/ZRK' : 'ZRK Pitch Review'
      })`,
      actualProductType: is8mm
        ? 'تسمه تایمینگ دنده‌گرد بالانسر خودرویی (گام 8.000mm)'
        : verifiedPitch
          ? 'تسمه تایمینگ دنده‌گرد خودرویی / لیفتراکی (گام 9.525mm)'
          : 'تسمه تایمینگ دنده‌گرد خودرویی (نیازمند تطبیق گام ZRK)',
      technical: {
        operatingPrinciple: 'synchronous',
        beltDivision: 'timing-automotive-ru',
        supplyForm: 'endless-loop',
        sidedness: 'single-sided',
        profile: autoProfile,
        pitchMm: verifiedPitch,
        toothAngleDeg: null,
        toothHeightMm: null,
        beltThicknessMm: null,
        topWidthMm: widthMm,
        nominalWidthMm: widthMm,
        widthCode: widthMm ? `${widthMm}mm` : null,
        pitchLengthMm: pitchLen,
        insideLengthMm: null,
        outsideLengthMm: null,
        lengthDesignation: teeth && widthMm ? `${teeth}×${widthMm}` : null,
        toothCount: teeth,
        ribCount: null,
        bodyMaterial: 'لاستیک کلروپرن/HNBR مقاوم در برابر حرارت موتور',
        tensileCord: 'کورد فایبرگلاس پرتاب (High-Modulus Fiberglass Cord)',
        backingOrCoating: null,
        standardReference: is8mm
          ? 'Optibelt ZRK 1459 / ContiTech HTDA 8.000M / Mitsubishi MD182295'
          : 'JIS D 4401 / Optibelt ZRK / ISO 13050 Automotive Timing Belts',
        manufacturerSources: ref
          ? [`Optibelt ${ref.zrkCode} (${teeth}T × ${widthMm}mm, L=${ref.lengthMm}mm, pitch=${ref.pitchMm}mm)`, ref.equiv]
          : ruMatch
            ? ['Mitsubishi MD154243 / 123RU24 Forklift Timing Belt (123 teeth × 24mm, pitch 9.525mm)']
            : ['Optibelt ZRK Automotive Timing Series (Tooth pitch requires exact ZRK index verification)'],
      },
      confidence: 'ALGORITHMIC_STANDARD_ONLY',
      verification: unattachedProvenancePlaceholder(),
      recommendedAction: product.subcategory === 'تسمه صنعتی' ? 'MOVE_TO_EXISTING_FAMILY' : 'KEEP_IN_CURRENT_FAMILY',
      engineeringReasoning: ref
        ? ref.note
        : ruMatch
          ? 'تسمه تایم لیفتراک/موتور 123RU24 (پروفیل گرد RU، 123 دندانه، عرض 24 میلی‌متر، گام 9.525 میلی‌متر معادل Mitsubishi MD154243).'
          : `تسمه تایم دنده‌گرد ماشینی با ${teeth} دندانه و عرض ${widthMm} میلی‌متر؛ از خانواده گام 9.525mm جدا نگه داشته شده تا گام دقیق با شماره ZRK اپتی‌بلت تطبیق داده شود.`,
    };
  }

  // 8. Heat-Weldable Polyurethane Belts (Round / CRC / BRB / V-Sections A, B, C)
  if (
    /تسمه\s+جوشی/.test(normName) ||
    product.subcategory === 'تسمه ضدسایش' ||
    (/^تسمه\s+گرد(?=\s|$)/.test(normName) && !/ماهی/.test(normName))
  ) {
    const isRound = /گرد/.test(normName);
    const hasCrc = /\bCRC\b/i.test(upperName);
    const hasBrb = /\bBRB\b/i.test(upperName);
    const vSectionMatch = upperName.match(/(?:گروه\s*|تسمه\s+جوشی\s+)(CRC|BRB|A|B|C)\b/) || upperName.match(/\b(CRC|BRB|A|B|C)\b/);
    const profileCode = hasCrc
      ? 'CRC'
      : hasBrb
        ? 'BRB'
        : isRound
          ? 'ROUND'
          : vSectionMatch
            ? vSectionMatch[1]
            : 'PU-V';
    const isCrcOrRound = profileCode === 'CRC' || profileCode === 'ROUND';
    const isCorded = /نخ\s*دار/.test(normName);
    const isRoughGreen = /زبر/.test(normName);
    const isWeldedGrip = /گریپ/.test(normName);
    const surfaceCode = isWeldedGrip ? 'GRIP' : isRoughGreen ? 'ROUGH-GREEN' : 'SMOOTH';
    const surfaceLabel = isWeldedGrip
      ? 'سطح گریپ ضدسایش (Grip / Super-Grip Top)'
      : isRoughGreen
        ? 'سطح زبر (Rough Green PU)'
        : 'سطح صاف (Smooth PU)';
    const dimMatch = normName.match(/(\d+(?:[./]\d+)?)\s*(?:\*\s*(\d+(?:[./]\d+)?))?/);
    const d1 = dimMatch ? Number(dimMatch[1].replace('/', '.')) : null;
    const d2 = dimMatch && dimMatch[2] ? Number(dimMatch[2].replace('/', '.')) : null;
    const vWidthMap: Record<string, { w: number; t: number }> = {
      A: { w: 13, t: 8 },
      B: { w: 17, t: 11 },
      BRB: { w: 17, t: 11 },
      C: { w: 22, t: 14 },
      CRC: { w: 22, t: 19 },
    };
    const stdSec = vWidthMap[profileCode];
    const topW = stdSec ? stdSec.w : d1;
    const secThk = stdSec ? stdSec.t : (d2 || d1);
    const weldedSupplyForm: BeltTechnicalParameters['supplyForm'] =
      !isMixedFamilyUnit && rawUnit === 'حلقه' ? 'endless-loop' : 'heat-weldable-meter';
    const weldedUnit = weldedSupplyForm === 'endless-loop' ? 'حلقه' : 'متر';

    return {
      sku: variant.code,
      originalName: rawName,
      originalSize: variant.size || '',
      originalUnit,
      unit: weldedUnit,
      currentFamilyId: product.code,
      currentFamilyName: product.name,
      currentCategory: product.categoryName,
      currentSubmenu: product.submenu || '',
      currentSubcategory: product.subcategory,
      detectedBrand: brand,
      proposedCategorySlug: 'excel-v2-1-3',
      proposedCategoryName: 'تسمه جوشی با سایت',
      proposedSubmenu: isCrcOrRound ? 'تسمه گرد (CRC)' : 'تسمه فلت',
      proposedLeaf: isCrcOrRound ? 'انواع تسمه گرد جوشی' : 'انواع تسمه تخت و فلت',
      taxonomyGap: null,
      proposedFamilyId: `FAM-WELDED-PU-${profileCode}-${surfaceCode}-${isCorded ? 'CORDED' : 'HOMOGENEOUS'}-${brand}`.replace(/[^A-Z0-9-]/g, ''),
      proposedFamilyNameFa: [
        'تسمه جوشی پلی‌یورتان',
        profileCode === 'CRC'
          ? 'پروفیل CRC'
          : profileCode === 'ROUND'
            ? 'گرد (Round)'
            : profileCode === 'BRB'
              ? 'پروفیل BRB'
              : `ذوزنقه‌ای گروه ${profileCode}`,
        isWeldedGrip ? 'گریپ‌دار' : isRoughGreen ? 'سطح زبر' : 'ساده',
        isCorded ? 'نخ‌دار' : 'بدون نخ',
        brand !== 'UNSPECIFIED' ? brand : '',
      ]
        .filter(Boolean)
        .join(' '),
      proposedFamilyNameEn: `${brand} Heat-Weldable PU ${profileCode} ${surfaceCode} (${isCorded ? 'Reinforced' : 'Homogeneous'}) Belt`,
      actualProductType: `تسمه جوشی پلی‌یورتان ترموپلاستیک پروفیل ${profileCode} (${isWeldedGrip ? 'با روکش گریپ' : isRoughGreen ? 'سطح زبر' : 'صاف'})`,
      technical: {
        operatingPrinciple: 'friction-round-welded',
        beltDivision: isCrcOrRound ? 'welded-pu-round-crc' : 'welded-pu-v-flat',
        supplyForm: weldedSupplyForm,
        sidedness: profileCode === 'ROUND' ? 'symmetric-round-hex' : 'single-sided',
        profile: profileCode,
        pitchMm: null,
        toothAngleDeg: profileCode === 'ROUND' ? null : 40,
        toothHeightMm: null,
        beltThicknessMm: secThk,
        topWidthMm: topW,
        nominalWidthMm: topW,
        widthCode: topW ? `${topW}mm` : null,
        pitchLengthMm: null,
        insideLengthMm: null,
        outsideLengthMm: null,
        lengthDesignation: null,
        toothCount: null,
        ribCount: null,
        bodyMaterial: 'پلی‌یورتان ترموپلاستیک قابل جوش حرارتی (Thermoplastic PU 85–92 ShA)',
        tensileCord: isCorded ? 'مغزی نخ پلی‌استر/آرامید (Reinforced Core)' : 'بدون نخ (Homogeneous Monolithic PU)',
        backingOrCoating: surfaceLabel,
        standardReference: 'Volta Belting / Behabelt Extruded Thermoplastic Elastomer Belt Standard',
        manufacturerSources: [
          'Volta Belting Round, V and Ridge-Top (CRC) Profiles Technical Catalogue',
          'Behabelt PU Round & V-Belts Engineering Guide',
        ],
      },
      confidence: 'ALGORITHMIC_STANDARD_ONLY',
      verification: unattachedProvenancePlaceholder(),
      recommendedAction: 'MOVE_TO_EXISTING_FAMILY',
      engineeringReasoning:
        `تسمه جوشی پلی‌یورتان اکسترودشده پروفیل ${profileCode} با تفکیک دقیق برند (${brand})، سطح (${surfaceLabel}) و مغزی (${isCorded ? 'نخ‌دار' : 'ساده'}) در زیرشاخه تخصصی excel-v2-1-3.`,
    };
  }

  // 9. Open-Ended Perforated V-Belts (تسمه B سوراخ دار, unit: متر)
  if (/سوراخ\s*دار/.test(normName)) {
    return {
      sku: variant.code,
      originalName: rawName,
      originalSize: variant.size || '',
      originalUnit,
      unit: 'متر',
      currentFamilyId: product.code,
      currentFamilyName: product.name,
      currentCategory: product.categoryName,
      currentSubmenu: product.submenu || '',
      currentSubcategory: product.subcategory,
      detectedBrand: brand,
      proposedCategorySlug: 'excel-v2-1-2',
      proposedCategoryName: 'تسمه وی‌بلت (V-Belt)',
      proposedSubmenu: 'وی‌بلت متری',
      proposedLeaf: 'تسمه A و B و C وی‌بلت متری',
      taxonomyGap: null,
      proposedFamilyId: brand !== 'UNSPECIFIED' ? `FAM-PERFORATED-OPEN-VBELT-B-${brand}`.replace(/[^A-Z0-9-]/g, '') : 'FAM-PERFORATED-OPEN-VBELT-B',
      proposedFamilyNameFa: 'تسمه V شکل سوراخ‌دار متری (پروفیل B)',
      proposedFamilyNameEn: 'Perforated Open-Ended V-Belt Profile B (Fastener Spliced)',
      actualProductType: 'تسمه ذوزنقه‌ای سوراخ‌دار متری مخصوص بست فلزی (Perforated V-Belt B)',
      technical: {
        operatingPrinciple: 'friction-v',
        beltDivision: 'perforated-open-v',
        supplyForm: 'perforated-meter',
        sidedness: 'single-sided',
        profile: 'B-PERFORATED',
        pitchMm: null,
        toothAngleDeg: 40,
        toothHeightMm: null,
        beltThicknessMm: 11,
        topWidthMm: 17,
        nominalWidthMm: 17,
        widthCode: '17mm',
        pitchLengthMm: null,
        insideLengthMm: null,
        outsideLengthMm: null,
        lengthDesignation: null,
        toothCount: null,
        ribCount: null,
        bodyMaterial: 'لاستیک نئوپرن چندلایه منجیددار سوراخ‌کاری‌شده',
        tensileCord: 'بافت منجید پلی‌استر چندلایه (Multi-Ply Fabric)',
        backingOrCoating: null,
        standardReference: 'DIN 2216 (Open-Ended Perforated V-Belts)',
        manufacturerSources: ['Optibelt / Continental Open-Ended Perforated V-Belts DIN 2216'],
      },
      confidence: 'ALGORITHMIC_STANDARD_ONLY',
      verification: unattachedProvenancePlaceholder(),
      recommendedAction: 'MOVE_TO_EXISTING_FAMILY',
      engineeringReasoning: 'تسمه V شکل متری سوراخ‌دار برای اتصال با بست مکانیکی، منطبق با زیرشاخه «وی‌بلت متری > تسمه A و B و C وی‌بلت متری» در `excel-v2-1-2`.',
    };
  }

  // 10. Endless Crowned / Ridge-Top Ceramic Tile Transport Belts (CRC / TRC / گرده ماهی, unit: حلقه)
  if (/\b(?:CRC|TRC)\d*\b|گرد\s*ه?\s*ماهی/.test(upperName)) {
    const profile = /\bTRC\d*\b/.test(upperName) ? 'TRC' : 'CRC';
    const lenMatch = upperName.match(/(?:CRC|TRC)\s*(\d{3,5})|\b([ABC])\s*(\d{2,4})\b/);
    const lenVal = lenMatch ? Number(lenMatch[1] || lenMatch[3]) : null;
    return {
      sku: variant.code,
      originalName: rawName,
      originalSize: variant.size || '',
      originalUnit,
      unit: 'حلقه',
      currentFamilyId: product.code,
      currentFamilyName: product.name,
      currentCategory: product.categoryName,
      currentSubmenu: product.submenu || '',
      currentSubcategory: product.subcategory,
      detectedBrand: brand,
      proposedCategorySlug: 'excel-v2-1-3',
      proposedCategoryName: 'تسمه جوشی با سایت',
      proposedSubmenu: 'تسمه گرد (CRC)',
      proposedLeaf: 'انواع تسمه گرد جوشی',
      taxonomyGap:
        'GAP-VBELT-ENDLESS-CRC: تسمه‌های مداربسته لاستیکی تاج‌دار (Crowned/Ridge-Top CRC/TRC گرده‌ماهی با واحد حلقه) از نظر ساختار با تسمه جوشی پلی‌یورتان متری متفاوت‌اند اما در اکسل فقط زیربرگ «تسمه گرد (CRC) > انواع تسمه گرد جوشی» برای خانواده CRC وجود دارد.',
      proposedFamilyId: `FAM-CROWNED-ENDLESS-${profile}-${brand}`.replace(/[^A-Z0-9-]/g, ''),
      proposedFamilyNameFa: `تسمه گرده‌ماهی (تاج‌دار) مداربسته ${profile} ${brand !== 'UNSPECIFIED' ? brand : ''}`.trim(),
      proposedFamilyNameEn: `${brand} Endless Crowned / Ridge-Top Ceramic Transport V-Belt (${profile})`,
      actualProductType: `تسمه ذوزنقه‌ای تاج‌دار (گرده‌ماهی / Ridge-Top ${profile}) مداربسته خطوط کاشی و سرامیک`,
      technical: {
        operatingPrinciple: 'conveying',
        beltDivision: 'vbelt-crowned-crc',
        supplyForm: 'endless-loop',
        sidedness: 'single-sided',
        profile,
        pitchMm: null,
        toothAngleDeg: 40,
        toothHeightMm: null,
        beltThicknessMm: 19,
        topWidthMm: 22,
        nominalWidthMm: 22,
        widthCode: '22mm (C-Base)',
        pitchLengthMm: lenVal,
        insideLengthMm: lenVal,
        outsideLengthMm: null,
        lengthDesignation: lenVal ? `${profile}${lenVal}` : null,
        toothCount: null,
        ribCount: null,
        bodyMaterial: 'لاستیک کلروپرن/طبیعی ضدسایش با تاج محدب (Crowned Top)',
        tensileCord: 'کورد پلی‌استر پرتاب (High-Tensile Polyester Cord)',
        backingOrCoating: 'سطح فوقانی محدب (گرده‌ماهی / Ridge-Top) جهت تماس خطی با کاشی',
        standardReference: 'Ceramic Tile Roller Kiln & Glazing Line Ridge-Top C-Belt Standard',
        manufacturerSources: [
          'Megadyne / Sit / PiBelt Ceramic Industry Ridge-Top (Crowned C-Section) Endless Belts',
          'Volta Belting CRC Ceramic Tile Transport Profile Guide',
        ],
      },
      confidence: 'ALGORITHMIC_STANDARD_ONLY',
      verification: unattachedProvenancePlaceholder(),
      recommendedAction: 'MOVE_TO_EXISTING_FAMILY',
      engineeringReasoning:
        'تسمه‌های مداربسته گرده‌ماهی (CRC / TRC) دارای پایه ذوزنقه‌ای تیپ C (عرض 22 میلی‌متر) و تاج محدب برای انتقال بدون لغزش کاشی در خطوط لعاب و کوره هستند.',
    };
  }

  // 11. Banded V-Belts (2RAX, 2RC, 3RC, 4RC, 4RSPC, 5RSPC, 1R3VX, 6R3VX, 8R3VX, 10R3VX)
  const bandedMatch = upperName.match(/\b(\d+)R\s*(3VX|3V|5VX|5V|8VX|8V|SPZ|SPA|SPB|SPC|AX|BX|CX|A|B|C)\s*(\d{2,5})\b/);
  if (bandedMatch) {
    const bandCount = Number(bandedMatch[1]);
    const baseProf = bandedMatch[2];
    const lenCode = Number(bandedMatch[3]);
    const vSpec = VBELT_SPECS[baseProf] || VBELT_SPECS.C;
    const isNarrow = ['3V', '3VX', '5V', '5VX', 'SPZ', 'SPA', 'SPB', 'SPC'].includes(baseProf);

    return {
      sku: variant.code,
      originalName: rawName,
      originalSize: variant.size || '',
      originalUnit,
      unit: 'حلقه',
      currentFamilyId: product.code,
      currentFamilyName: product.name,
      currentCategory: product.categoryName,
      currentSubmenu: product.submenu || '',
      currentSubcategory: product.subcategory,
      detectedBrand: brand,
      proposedCategorySlug: 'excel-v2-1-2',
      proposedCategoryName: 'تسمه وی‌بلت (V-Belt)',
      proposedSubmenu: isNarrow ? 'تسمه اسپشیال' : 'کلاسیک و دنده‌دار',
      proposedLeaf: isNarrow
        ? 'SPA , SPB , SPC و دندانه‌دار'
        : 'Z (9.5) , M , A , B , C , D , E , 8V',
      taxonomyGap: `GAP-VBELT-BANDED: تسمه به‌پشت‌پیوسته (Banded Powerband) پروفیل ${baseProf} (سری‌های چندردیفه) در زیربرگ پروفیل پایه قرار می‌گیرد زیرا زیربرگ مستقل تسمه‌های Banded (چندردیفه پشت‌دار) در اکسل وجود ندارد.`,
      proposedFamilyId: `FAM-VBELT-BANDED-${baseProf}-${brand}`.replace(/[^A-Z0-9-]/g, ''),
      proposedFamilyNameFa: `تسمه V شکل به‌پشت‌پیوسته (پاورباند) پروفیل ${baseProf} (${brand})`,
      proposedFamilyNameEn: `${brand} Banded V-Belt (Powerband) Profile ${baseProf}`,
      actualProductType: `تسمه V شکل به‌پشت‌پیوسته (Banded V-Belt) سری ${baseProf}`,
      technical: {
        operatingPrinciple: 'friction-v',
        beltDivision: 'vbelt-banded',
        supplyForm: 'endless-loop',
        sidedness: 'single-sided',
        profile: `${baseProf}-BANDED`,
        pitchMm: null,
        toothAngleDeg: 40,
        toothHeightMm: null,
        beltThicknessMm: vSpec.thicknessMm,
        topWidthMm: Number((bandCount * vSpec.topWidthMm).toFixed(1)),
        nominalWidthMm: vSpec.topWidthMm,
        widthCode: `${bandCount} ribs × ${vSpec.topWidthMm}mm`,
        pitchLengthMm: isNarrow && baseProf.startsWith('SP') ? lenCode : null,
        insideLengthMm: null,
        outsideLengthMm: baseProf.includes('V') ? Number((lenCode * 2.54).toFixed(1)) : null,
        lengthDesignation: `${bandCount}R${baseProf}${lenCode}`,
        toothCount: null,
        ribCount: bandCount,
        bodyMaterial: 'لاستیک کلروپرن با نوار پشتی مسلح یکپارچه (Tie-Band Reinforced Neoprene)',
        tensileCord: 'کورد پلی‌استر یا آرامید مقاوم در برابر بارهای ضربه‌ای',
        backingOrCoating: 'نوار پیونددهنده فوقانی (Tie-Band)',
        standardReference: 'ISO 5290 / RMA IP-20 / IP-22 (Joined / Banded V-Belts)',
        manufacturerSources: ['Optibelt KRAFTBAND Technical Manual', 'Bando Power-Ace / Red-S II Banded V-Belt Catalog'],
      },
      confidence: 'ALGORITHMIC_STANDARD_ONLY',
      verification: unattachedProvenancePlaceholder(),
      recommendedAction: 'MOVE_TO_EXISTING_FAMILY',
      engineeringReasoning: `تسمه پاورباند (Banded V-Belt) دارای ${bandCount} شاخه پروفیل ${baseProf} متصل به یک نوار پشتی مشترک برای جلوگیری از واژگونی تسمه در بارهای ارتعاشی.`,
    };
  }

  // 12. Classical, Narrow/Wedge, and Hexagonal V-Belts
  const stdVMatch =
    upperName.match(/\b(SPZ|XPZ|SPA|XPA|SPB|XPB|SPC|XPC|3VX|3V|5VX|5V|8VX|8V|AA|BB|ZX|AX|BX|CX|MX|Z|M|K|A|B|C|D|E)\s*[-*× ]?\s*(\d{2,5}(?:[./]\d+)?)\b/) ||
    upperName.match(/\b(\d{2,5}(?:[./]\d+)?)\s*(?:[*×]\s*)?(SPZ|XPZ|SPA|XPA|SPB|XPB|SPC|XPC|3VX|3V|5VX|5V|8VX|8V|AA|BB|ZX|AX|BX|CX|MX|M|K)\b/);

  const isExplicitTiming = /تایم|تایمینگ/.test(normName);
  const numericVMatch =
    !isExplicitTiming
      ? normName.match(/\b(9[./]5|10|12[./]5|13|17|22)\.?\s*\*\s*(\d{3,5})\b/) ||
        normName.match(/\b(\d{3,5})\.?\s*\*\s*(9[./]5|10|12[./]5|13|17|22)\b/)
      : null;

  if (stdVMatch || numericVMatch) {
    let vProfile = 'A';
    let rawLen = 0;

    if (stdVMatch) {
      if (VBELT_SPECS[stdVMatch[1]]) {
        vProfile = stdVMatch[1];
        rawLen = Number(stdVMatch[2].replace('/', '.'));
      } else {
        rawLen = Number(stdVMatch[1].replace('/', '.'));
        vProfile = stdVMatch[2];
      }
    } else if (numericVMatch) {
      const first = numericVMatch[1].replace('/', '.');
      const second = numericVMatch[2].replace('/', '.');
      const isFirstWidth = ['9.5', '10', '12.5', '13', '17', '22'].includes(first) && Number(second) >= 200;
      const widthStr = isFirstWidth ? first : second;
      rawLen = Number(isFirstWidth ? second : first);
      const isCogged = /دنده\s*ای/.test(normName);
      if (widthStr === '9.5' || widthStr === '10') vProfile = isCogged ? 'ZX' : 'Z';
      else if (widthStr === '12.5' || widthStr === '13') vProfile = isCogged ? 'AX' : 'A';
      else if (widthStr === '17') vProfile = isCogged ? 'BX' : 'B';
      else if (widthStr === '22') vProfile = isCogged ? 'CX' : 'C';
    }

    const vSpec = VBELT_SPECS[vProfile] || VBELT_SPECS.A;
    const isNarrowLeaf = ['SPZ', 'XPZ', 'SPA', 'XPA', 'SPB', 'XPB', 'SPC', 'XPC', '3V', '3VX', '5V', '5VX'].includes(vProfile);
    const isOpenMeter = !isMixedFamilyUnit && rawUnit === 'متر';
    const vUnit = isOpenMeter ? 'متر' : 'حلقه';

    const proposedSubmenu = hasCoating
      ? 'سیم‌دار فابریک'
      : isOpenMeter
        ? 'وی‌بلت متری'
        : isNarrowLeaf
          ? 'تسمه اسپشیال'
          : 'کلاسیک و دنده‌دار';

    const proposedLeaf = hasCoating
      ? 'APL دار'
      : isOpenMeter
        ? 'تسمه A و B و C وی‌بلت متری'
        : isNarrowLeaf
          ? 'SPA , SPB , SPC و دندانه‌دار'
          : 'Z (9.5) , M , A , B , C , D , E , 8V';

    let taxonomyGap: string | null = null;
    if (vProfile === 'AA' || vProfile === 'BB') {
      taxonomyGap = `GAP-VBELT-HEXAGONAL: تسمه شش‌ضلعی دوطرفه ${vProfile} در زیربرگ کلاسیک قرار می‌گیرد؛ پیشنهاد می‌شود برگ «تسمه شش‌ضلعی دوطرفه (AA, BB, CC)» اضافه شود.`;
    } else if (['3V', '3VX', '5V', '5VX', 'K', 'MX', 'SPZ', 'XPZ'].includes(vProfile)) {
      taxonomyGap = `GAP-VBELT-3V-5V-K-SPZ: پروفیل ${vProfile} به نزدیک‌ترین زیربرگ استاندارد V شکل («${proposedLeaf}») نگاشت شد.`;
    } else if (hasCoating) {
      taxonomyGap =
        'GAP-COATED-VBELT: در اکسل زیربرگ «APL دار» فقط زیر «تسمه تایمینگ» تعریف شده است، در حالی که این کالا تسمه V شکل روکش‌دار (پروفیل کلاسیک/باریک با روکش گریپ/آجدار) است.';
    }

    let pitchLengthMm: number | null = null;
    let insideLengthMm: number | null = null;
    let outsideLengthMm: number | null = null;

    if (['SPZ', 'XPZ', 'SPA', 'XPA', 'SPB', 'XPB', 'SPC', 'XPC'].includes(vProfile)) {
      pitchLengthMm = rawLen;
    } else if (['3V', '3VX', '5V', '5VX', '8V', '8VX'].includes(vProfile)) {
      outsideLengthMm = Number(((rawLen / 10) * 25.4).toFixed(1));
    } else if (['M', 'MX', 'K'].includes(vProfile) && rawLen < 200) {
      insideLengthMm = Number((rawLen * 25.4).toFixed(1));
    } else if (rawLen > 0 && rawLen < 240 && !numericVMatch) {
      insideLengthMm = Number((rawLen * 25.4).toFixed(1));
    } else if (rawLen >= 240) {
      insideLengthMm = rawLen;
    }

    const familyId = [
      'FAM-VBELT',
      vProfile,
      hasCoating ? coatingCode : isOpenMeter ? 'METER' : 'STD',
      brand,
    ]
      .join('-')
      .replace(/[^A-Z0-9-]/g, '');

    return {
      sku: variant.code,
      originalName: rawName,
      originalSize: variant.size || '',
      originalUnit,
      unit: vUnit,
      currentFamilyId: product.code,
      currentFamilyName: product.name,
      currentCategory: product.categoryName,
      currentSubmenu: product.submenu || '',
      currentSubcategory: product.subcategory,
      detectedBrand: brand,
      proposedCategorySlug: hasCoating ? 'excel-v2-1-1' : 'excel-v2-1-2',
      proposedCategoryName: hasCoating ? 'تسمه تایمینگ' : 'تسمه وی‌بلت (V-Belt)',
      proposedSubmenu,
      proposedLeaf,
      taxonomyGap,
      proposedFamilyId: familyId,
      proposedFamilyNameFa: [
        'تسمه V شکل',
        vSpec.division === 'vbelt-hexagonal' ? 'شش‌ضلعی دوطرفه' : isNarrowLeaf ? 'پروفیل باریک' : 'کلاسیک',
        vProfile,
        coatingLabel ? `(${coatingLabel})` : '',
        isOpenMeter ? 'متری' : '',
        brand !== 'UNSPECIFIED' ? brand : '',
      ]
        .filter(Boolean)
        .join(' '),
      proposedFamilyNameEn: `${brand} ${vProfile} ${
        vSpec.division === 'vbelt-hexagonal' ? 'Hexagonal Double-Sided' : isNarrowLeaf ? 'Narrow Wedge' : 'Classical'
      } V-Belt${hasCoating ? ' (Coated)' : ''}`,
      actualProductType: `تسمه V شکل پروفیل ${vProfile}${hasCoating ? ` همراه با ${coatingLabel}` : ''}`,
      technical: {
        operatingPrinciple: 'friction-v',
        beltDivision: vSpec.division,
        supplyForm: isOpenMeter ? 'open-ended-meter' : 'endless-loop',
        sidedness: vSpec.sidedness,
        profile: vProfile,
        pitchMm: null,
        toothAngleDeg: 40,
        toothHeightMm: null,
        beltThicknessMm: vSpec.thicknessMm,
        topWidthMm: vSpec.topWidthMm,
        nominalWidthMm: vSpec.topWidthMm,
        widthCode: `${vSpec.topWidthMm}mm`,
        pitchLengthMm,
        insideLengthMm,
        outsideLengthMm,
        lengthDesignation: `${vProfile}${rawLen}`,
        toothCount: null,
        ribCount: null,
        bodyMaterial: vProfile.endsWith('X')
          ? 'الاستومر کلروپرن/EPDM قالب‌گیری‌شده دنده‌ای (Raw-Edge Cogged)'
          : 'لاستیک کلروپرن با روکش بافت پارچه‌ای (Wrapped V-Belt)',
        tensileCord: 'کورد پلی‌استر کم‌کشش (Polyester Tensile Cord)',
        backingOrCoating: coatingLabel,
        standardReference: vSpec.standard,
        manufacturerSources: [
          'DIN 2215 / DIN 7753-1 / ISO 4184 Classical and Narrow V-Belts',
          'Bando Power-King / Red-S / Banflex Technical Catalog',
          'Optibelt VB / SK / SUPER XE-POWER PRO Manual',
          'Dongil Super Star / Gold Label V-Belt Technical Guide',
        ],
      },
      confidence: 'ALGORITHMIC_STANDARD_ONLY',
      verification: unattachedProvenancePlaceholder(),
      recommendedAction:
        product.categoryName !== 'تسمه و انتقال نیرو'
          ? 'MOVE_TO_OTHER_CATEGORY'
          : product.subcategory === 'تسمه صنعتی'
            ? 'MOVE_TO_EXISTING_FAMILY'
            : 'KEEP_IN_CURRENT_FAMILY',
      engineeringReasoning:
        product.categoryName !== 'تسمه و انتقال نیرو'
          ? `تسمه V شکل پروفیل ${vProfile} که به علت تشابه لفظی («تسمه بسته‌بندی» -> بست صنعتی، «تسمه پروانه» -> قطعات پمپ، یا خطای تایپی «تسه») در خارج از دسته تسمه قرار گرفته بود و به زیرشاخه اصلی V شکل بازگردانده شد.`
          : numericVMatch
            ? `تسمه V شکل با عرض اسمی ${vSpec.topWidthMm} میلی‌متر (معادل پروفیل استاندارد ${vProfile} طبق DIN 2215) که از دسته عمومی «تسمه صنعتی» به خانواده ${vProfile} منتقل شد.`
            : `تسمه V شکل پروفیل استاندارد ${vProfile} مطابق ${vSpec.standard}.`,
    };
  }

  // 13. Fallback for ambiguous/generic service belt record (e.g., 34483 "تسمه تعمیری")
  const reviewSupplyForm: BeltTechnicalParameters['supplyForm'] =
    !isMixedFamilyUnit && rawUnit === 'متر' ? 'open-ended-meter' : 'endless-loop';
  return {
    sku: variant.code,
    originalName: rawName,
    originalSize: variant.size || '',
    originalUnit,
    unit: reviewSupplyForm === 'open-ended-meter' ? 'متر' : 'حلقه',
    currentFamilyId: product.code,
    currentFamilyName: product.name,
    currentCategory: product.categoryName,
    currentSubmenu: product.submenu || '',
    currentSubcategory: product.subcategory,
    detectedBrand: brand,
    proposedCategorySlug: 'excel-v2-1-4',
    proposedCategoryName: 'تسمه بارکش و تجهیزات جوشی',
    proposedSubmenu: 'تسمه بارکش',
    proposedLeaf: 'انواع تسمه بارکش صنعتی',
    taxonomyGap: null,
    proposedFamilyId: `FAM-BELT-MANUAL-REVIEW-${reviewSupplyForm === 'open-ended-meter' ? 'METER' : 'LOOP'}-${brand}`.replace(/[^A-Z0-9-]/g, ''),
    proposedFamilyNameFa: `تسمه نیازمند بازبینی فنی و تطبیق نمونه (${brand})`,
    proposedFamilyNameEn: `${brand} Industrial Belt Requiring Physical Sample Inspection`,
    actualProductType: 'تسمه با کد یا شرح ناقص (نیازمند بررسی فیزیکی)',
    technical: {
      operatingPrinciple: 'friction-v',
      beltDivision: 'service-ambiguous',
      supplyForm: reviewSupplyForm,
      sidedness: 'single-sided',
      profile: 'UNSPECIFIED',
      pitchMm: null,
      toothAngleDeg: null,
      toothHeightMm: null,
      beltThicknessMm: null,
      topWidthMm: null,
      nominalWidthMm: null,
      widthCode: null,
      pitchLengthMm: null,
      insideLengthMm: null,
      outsideLengthMm: null,
      lengthDesignation: null,
      toothCount: null,
      ribCount: null,
      bodyMaterial: 'نامشخص در شرح انبار',
      tensileCord: 'نامشخص در شرح انبار',
      backingOrCoating: coatingLabel,
      standardReference: 'نیازمند قرائت پلاک روی تسمه',
      manufacturerSources: [],
    },
    confidence: 'REQUIRES_REVIEW',
    verification: unattachedProvenancePlaceholder(),
    recommendedAction: 'MANUAL_ENGINEERING_REVIEW',
    engineeringReasoning:
      'شرح انبار فاقد کد پروفیل، گام یا ابعاد استاندارد یا واحد صریح متری/حلقه است و بدون بازرسی فیزیکی کالا یا فاکتور خرید نباید به پروفیل یا فرم عرضه فرضی منتسب شود.',
  };
}

function buildNonBeltRecord(
  product: Product,
  variant: ProductVariant,
  brand: string,
  info: {
    actualProductType: string;
    division: BeltTechnicalParameters['beltDivision'];
    proposedCategorySlug: string;
    proposedCategoryName: string;
    proposedSubmenu: string;
    proposedLeaf: string;
    proposedFamilyId: string;
    proposedFamilyNameFa: string;
    proposedFamilyNameEn: string;
    reasoning: string;
  }
): BeltSkuAuditRecord {
  const staysOutsideBeltAndConveyor =
    product.categoryName !== 'تسمه و انتقال نیرو' && product.categoryName !== 'نوار و تسمه نقاله';
  const rawNonBeltUnit = normalize(variant.unit || product.unit || 'عدد');
  const normNonBeltUnit = rawNonBeltUnit.includes(',') || rawNonBeltUnit.includes('،') ? 'عدد' : rawNonBeltUnit;
  return {
    sku: variant.code,
    originalName: variant.name || product.name,
    originalSize: variant.size || '',
    originalUnit: rawNonBeltUnit || 'عدد',
    unit: normNonBeltUnit,
    currentFamilyId: product.code,
    currentFamilyName: product.name,
    currentCategory: product.categoryName,
    currentSubmenu: product.submenu || '',
    currentSubcategory: product.subcategory,
    detectedBrand: brand,
    proposedCategorySlug: info.proposedCategorySlug,
    proposedCategoryName: info.proposedCategoryName,
    proposedSubmenu: info.proposedSubmenu,
    proposedLeaf: info.proposedLeaf,
    taxonomyGap: null,
    proposedFamilyId: info.proposedFamilyId,
    proposedFamilyNameFa: info.proposedFamilyNameFa,
    proposedFamilyNameEn: info.proposedFamilyNameEn,
    actualProductType: info.actualProductType,
    technical: {
      operatingPrinciple: 'non-belt',
      beltDivision: info.division,
      supplyForm: 'hardware-unit',
      sidedness: 'not-applicable',
      profile: 'NON-BELT',
      pitchMm: null,
      toothAngleDeg: null,
      toothHeightMm: null,
      beltThicknessMm: null,
      topWidthMm: null,
      nominalWidthMm: null,
      widthCode: null,
      pitchLengthMm: null,
      insideLengthMm: null,
      outsideLengthMm: null,
      lengthDesignation: null,
      toothCount: null,
      ribCount: null,
      bodyMaterial: 'مطابق شرح قطعه',
      tensileCord: 'ندارد (قطعه غیرتسمه‌ای)',
      backingOrCoating: null,
      standardReference: 'نقشه و کد فنی کاتالوگ صنعت پیش',
      manufacturerSources: ['کاتالوگ قطعات صنعتی صنعت پیش'],
    },
    confidence: 'ALGORITHMIC_STANDARD_ONLY',
    verification: unattachedProvenancePlaceholder(),
    recommendedAction: staysOutsideBeltAndConveyor ? 'KEEP_IN_CURRENT_FAMILY' : 'MOVE_TO_OTHER_CATEGORY',
    engineeringReasoning: info.reasoning,
  };
}

interface ResearchedSkuProvenanceEntry {
  manufacturer: string;
  exactManufacturerMatch: boolean;
  sourceUrl: string;
  documentType: VerificationDocumentType;
  basis: string;
}

const BANDO_SYNCHRO_LINK_PDF = 'https://www.bandousa.com/wp-content/uploads/bu_synchro_link_catalog.pdf';
const MEGADYNE_TNX_URL = 'https://www.megadynegroup.com/en/products/polyurethane-belts';
const MEGADYNE_SILVER_URL = 'https://www.megadynegroup.com/en/products/rubber-timing-belts';
const OPTIBELT_ZRK_CATALOG_URL = 'https://www.optibelt.com/en/products/timing-belts/';
const OPTIBELT_TM_PDF_URL =
  'https://www.optibelt.com/fileadmin/pdf/produkte/zahnriemen-gummi/Optibelt-TM-Rubber-Timing-Belt-Drives.pdf';
const MISUMI_H_URL =
  'https://th.c.misumi-ec.com/book/THA_EconomySeries_e-catalog2023_2nd/files/basic-html/page604.html';

const RESEARCHED_EXACT_SKU_DATASHEETS: Record<string, ResearchedSkuProvenanceEntry> = {
  '10538': {
    manufacturer: 'BANDO',
    exactManufacturerMatch: true,
    sourceUrl: BANDO_SYNCHRO_LINK_PDF,
    documentType: 'MANUFACTURER_DATASHEET',
    basis: 'تطبیق مستقیم کد 1400H100 با دیتاشیت رسمی Bando Synchro-Link H',
  },
  '36103': {
    manufacturer: 'BANDO',
    exactManufacturerMatch: true,
    sourceUrl: BANDO_SYNCHRO_LINK_PDF,
    documentType: 'MANUFACTURER_DATASHEET',
    basis: 'تطبیق مستقیم کد 1140H100 با دیتاشیت رسمی Bando Synchro-Link H',
  },
  '36468': {
    manufacturer: 'BANDO',
    exactManufacturerMatch: true,
    sourceUrl: BANDO_SYNCHRO_LINK_PDF,
    documentType: 'MANUFACTURER_DATASHEET',
    basis: 'تطبیق مستقیم آستین دوطرفه 1000DH با دیتاشیت رسمی Bando Synchro-Link DH',
  },
  '10111': {
    manufacturer: 'BANDO',
    exactManufacturerMatch: true,
    sourceUrl: BANDO_SYNCHRO_LINK_PDF,
    documentType: 'MANUFACTURER_DATASHEET',
    basis: 'تطبیق مستقیم کد 1400DH075 با دیتاشیت رسمی Bando Synchro-Link DH',
  },
  '41291': {
    manufacturer: 'BANDO',
    exactManufacturerMatch: true,
    sourceUrl: BANDO_SYNCHRO_LINK_PDF,
    documentType: 'MANUFACTURER_DATASHEET',
    basis: 'تطبیق مستقیم کد 1400DH150 با دیتاشیت رسمی Bando Synchro-Link DH',
  },
  '41598': {
    manufacturer: 'BANDO',
    exactManufacturerMatch: true,
    sourceUrl: BANDO_SYNCHRO_LINK_PDF,
    documentType: 'MANUFACTURER_DATASHEET',
    basis: 'تطبیق مستقیم کد 1000DH100 با دیتاشیت رسمی Bando Synchro-Link DH',
  },
  '41689': {
    manufacturer: 'BANDO',
    exactManufacturerMatch: true,
    sourceUrl: BANDO_SYNCHRO_LINK_PDF,
    documentType: 'MANUFACTURER_DATASHEET',
    basis: 'تطبیق مستقیم کد 1250DH075 با دیتاشیت رسمی Bando Synchro-Link DH',
  },
  '36636': {
    manufacturer: 'BANDO',
    exactManufacturerMatch: true,
    sourceUrl: BANDO_SYNCHRO_LINK_PDF,
    documentType: 'MANUFACTURER_DATASHEET',
    basis: 'تطبیق مستقیم کد 1100DH100 با دیتاشیت رسمی Bando Synchro-Link DH',
  },
  '41322': {
    manufacturer: 'BANDO',
    exactManufacturerMatch: true,
    sourceUrl: BANDO_SYNCHRO_LINK_PDF,
    documentType: 'MANUFACTURER_DATASHEET',
    basis: 'تطبیق مستقیم کد 950DH100 با دیتاشیت رسمی Bando Synchro-Link DH',
  },
  '39994': {
    manufacturer: 'BANDO',
    exactManufacturerMatch: true,
    sourceUrl: BANDO_SYNCHRO_LINK_PDF,
    documentType: 'MANUFACTURER_DATASHEET',
    basis: 'تطبیق مستقیم آستین دوطرفه 1150DH با دیتاشیت رسمی Bando Synchro-Link DH',
  },
  '41349': {
    manufacturer: 'BANDO',
    exactManufacturerMatch: true,
    sourceUrl: BANDO_SYNCHRO_LINK_PDF,
    documentType: 'MANUFACTURER_DATASHEET',
    basis: 'تطبیق مستقیم آستین دوطرفه 800DH با دیتاشیت رسمی Bando Synchro-Link DH',
  },
  '58129': {
    manufacturer: 'MEGADYNE',
    exactManufacturerMatch: true,
    sourceUrl: MEGADYNE_TNX_URL,
    documentType: 'MANUFACTURER_DATASHEET',
    basis: 'تطبیق مستقیم تسمه چاپ کاشی Megadyne TNX Pluribelt 1270PJ8 در مستندات Megadyne',
  },
  '31501': {
    manufacturer: 'OPTIBELT',
    exactManufacturerMatch: true,
    sourceUrl: OPTIBELT_ZRK_CATALOG_URL,
    documentType: 'MANUFACTURER_DATASHEET',
    basis: 'تطبیق مستقیم 108*17 برند OPTIBELT با Optibelt ZRK 1118 (108 دندانه × 17mm، طول 1029mm، گام 9.525mm)',
  },
  '31502': {
    manufacturer: 'OPTIBELT',
    exactManufacturerMatch: false,
    sourceUrl: OPTIBELT_ZRK_CATALOG_URL,
    documentType: 'NOMINAL_REFERENCE_TABLE',
    basis: 'تطبیق مرجع ابعادی 108*24 با Optibelt ZRK 1119 / Gates 5082XS (گام 9.525mm؛ تایید چاپ ZRK روی کاور در فاز 4 باقی است)',
  },
  '31504': {
    manufacturer: 'OPTIBELT',
    exactManufacturerMatch: false,
    sourceUrl: OPTIBELT_ZRK_CATALOG_URL,
    documentType: 'NOMINAL_REFERENCE_TABLE',
    basis: 'تطبیق مرجع ابعادی 114*17 با Optibelt ZRK 1128 / Gates 5215XS (گام 9.525mm؛ تایید چاپ ZRK روی کاور در فاز 4 باقی است)',
  },
  '31505': {
    manufacturer: 'OPTIBELT',
    exactManufacturerMatch: false,
    sourceUrl: OPTIBELT_ZRK_CATALOG_URL,
    documentType: 'NOMINAL_REFERENCE_TABLE',
    basis: 'تطبیق مرجع ابعادی 134*25 با Optibelt ZRK 1537 / CT1065 (گام 9.525mm؛ تایید چاپ ZRK روی کاور در فاز 4 باقی است)',
  },
  '31506': {
    manufacturer: 'OPTIBELT',
    exactManufacturerMatch: false,
    sourceUrl: OPTIBELT_ZRK_CATALOG_URL,
    documentType: 'NOMINAL_REFERENCE_TABLE',
    basis: 'تطبیق مرجع ابعادی 136*25 با Optibelt ZRK 1262 / ZRK 1538 (گام 9.525mm؛ تایید چاپ ZRK روی کاور در فاز 4 باقی است)',
  },
  '31769': {
    manufacturer: 'OPTIBELT',
    exactManufacturerMatch: true,
    sourceUrl: OPTIBELT_ZRK_CATALOG_URL,
    documentType: 'MANUFACTURER_DATASHEET',
    basis: 'تطبیق مستقیم Optibelt ZRK 1593 (طول مشخص 1305mm = 137 دندانه × 22mm، گام 9.525mm)',
  },
  '34722': {
    manufacturer: 'OPTIBELT',
    exactManufacturerMatch: true,
    sourceUrl: OPTIBELT_ZRK_CATALOG_URL,
    documentType: 'MANUFACTURER_DATASHEET',
    basis: 'تطبیق مستقیم Optibelt ZRK 1182 / CT887 (127 دندانه × 25mm، طول 1210mm، گام 9.525mm)',
  },
  '35232': {
    manufacturer: 'OPTIBELT',
    exactManufacturerMatch: true,
    sourceUrl: OPTIBELT_ZRK_CATALOG_URL,
    documentType: 'MANUFACTURER_DATASHEET',
    basis: 'تطبیق مستقیم Optibelt ZRK 1176 / Gates T232 (123 دندانه × 29mm، طول 1172mm، گام 9.525mm)',
  },
  '35023': {
    manufacturer: 'OPTIBELT',
    exactManufacturerMatch: true,
    sourceUrl: OPTIBELT_ZRK_CATALOG_URL,
    documentType: 'MANUFACTURER_DATASHEET',
    basis: 'تطبیق مستقیم Optibelt ZRK 1459 / CT1039 / MD182295 (65 دندانه × 12.7mm، طول 520mm، گام 8.000mm)',
  },
  '42209': {
    manufacturer: 'MITSUBISHI',
    exactManufacturerMatch: false,
    sourceUrl: 'https://www.gates.com/us/en/power-transmission/synchronous-belts.html',
    documentType: 'NOMINAL_REFERENCE_TABLE',
    basis: 'تطبیق مرجع ابعاد/کد اسمی لیفتراک 123RU24 با جدول معادل Mitsubishi MD154243 (برند SKU در انبار UNSPECIFIED است)',
  },
};

function unattachedProvenancePlaceholder(): VerificationProvenance {
  return {
    tier: 'UNVERIFIED_REQUIRES_PHYSICAL_REVIEW',
    evidenceClass7: '7_Requires_Physical_Inspection',
    processedBySoftwareCode: true,
    extractedFromDatabase: true,
    manufacturerCodeIdentified: false,
    officialManufacturerSiteChecked: false,
    datasheetOrCatalogChecked: false,
    matchedAgainstReliableSource: false,
    familyConfirmedByEvidence: false,
    sourceUrl: 'NONE',
    documentType: 'NONE_UNVERIFIED',
    matchedManufacturer: null,
    evidenceBasis: 'در حال محاسبه',
  };
}

function resolveProvenanceAndConfidence(
  rec: BeltSkuAuditRecord,
  refs?: AuditReferenceTables
): { confidence: BeltConfidenceLevel; verification: VerificationProvenance } {
  if (rec.confidence === 'REQUIRES_REVIEW' || rec.technical.beltDivision === 'service-ambiguous') {
    return {
      confidence: 'REQUIRES_REVIEW',
      verification: {
        tier: 'UNVERIFIED_REQUIRES_PHYSICAL_REVIEW',
        evidenceClass7: '7_Requires_Physical_Inspection',
        processedBySoftwareCode: true,
        extractedFromDatabase: true,
        manufacturerCodeIdentified: Boolean(
          rec.technical.lengthDesignation || (rec.technical.profile !== 'UNSPECIFIED' && rec.technical.profile !== 'NON-BELT')
        ),
        officialManufacturerSiteChecked: false,
        datasheetOrCatalogChecked: false,
        matchedAgainstReliableSource: false,
        familyConfirmedByEvidence: false,
        sourceUrl: 'NONE',
        documentType: 'NONE_UNVERIFIED',
        matchedManufacturer: null,
        evidenceBasis: 'نیازمند بررسی فیزیکی/فاکتور خرید — اطلاعات کاتالوگ فعلی برای انتساب قطعی ناکافی یا مبهم است',
      },
    };
  }

  const lenKey = rec.technical.lengthDesignation?.toUpperCase() || '';
  const imperialBaseKey =
    lenKey && rec.technical.beltDivision.startsWith('timing-imperial')
      ? lenKey.replace(/D(XL|L|H)$/, '$1')
      : '';
  const inImperialRef = Boolean(
    imperialBaseKey && refs?.imperialTimingLengths && refs.imperialTimingLengths.has(imperialBaseKey)
  );
  const inMisumiRef = Boolean(
    imperialBaseKey && refs?.misumiHLengths && refs.misumiHLengths.has(imperialBaseKey)
  );
  const isNominalRefMatched = inImperialRef || inMisumiRef;
  const exactEntry = RESEARCHED_EXACT_SKU_DATASHEETS[rec.sku];

  const hasIdentifiedCode = Boolean(
    rec.technical.operatingPrinciple !== 'non-belt' &&
      rec.technical.operatingPrinciple !== 'equipment' &&
      rec.technical.profile !== 'UNSPECIFIED' &&
      (rec.technical.lengthDesignation || rec.technical.nominalWidthMm || rec.technical.widthCode)
  );

  // Strict rule: DATASHEET_VERIFIED ONLY when exact SKU matched against same manufacturer's datasheet
  if (
    exactEntry &&
    exactEntry.exactManufacturerMatch &&
    exactEntry.documentType === 'MANUFACTURER_DATASHEET' &&
    exactEntry.manufacturer === rec.detectedBrand
  ) {
    return {
      confidence: 'DATASHEET_VERIFIED',
      verification: {
        tier: 'EXACT_SKU_DATASHEET_MATCHED',
        evidenceClass7: '1_Manufacturer_Datasheet_Verified',
        processedBySoftwareCode: true,
        extractedFromDatabase: true,
        manufacturerCodeIdentified: true,
        officialManufacturerSiteChecked: true,
        datasheetOrCatalogChecked: true,
        matchedAgainstReliableSource: true,
        familyConfirmedByEvidence: true,
        sourceUrl: exactEntry.sourceUrl,
        documentType: exactEntry.documentType,
        matchedManufacturer: exactEntry.manufacturer,
        evidenceBasis: exactEntry.basis,
      },
    };
  }

  // Exact entry that is a dimensional/cross-reference match (e.g. 42209 UNSPECIFIED or ZRK sleeve check needed)
  if (exactEntry) {
    return {
      confidence: 'NOMINAL_TABLE_VERIFIED',
      verification: {
        tier: 'NOMINAL_DESIGNATION_REF_MATCHED',
        evidenceClass7: '3_Standard_Table_Verified',
        processedBySoftwareCode: true,
        extractedFromDatabase: true,
        manufacturerCodeIdentified: true,
        officialManufacturerSiteChecked: false,
        datasheetOrCatalogChecked: false,
        matchedAgainstReliableSource: true,
        familyConfirmedByEvidence: true,
        sourceUrl: exactEntry.sourceUrl,
        documentType: exactEntry.documentType,
        matchedManufacturer: exactEntry.manufacturer,
        evidenceBasis: exactEntry.basis,
      },
    };
  }

  // Strict rule: Nominal reference tables NEVER upgrade to DATASHEET_VERIFIED even for known brands
  if (isNominalRefMatched) {
    const nominalUrl = inImperialRef && inMisumiRef
      ? `${OPTIBELT_TM_PDF_URL} | ${MISUMI_H_URL}`
      : inImperialRef
        ? OPTIBELT_TM_PDF_URL
        : MISUMI_H_URL;
    return {
      confidence: 'NOMINAL_TABLE_VERIFIED',
      verification: {
        tier: 'NOMINAL_DESIGNATION_REF_MATCHED',
        evidenceClass7: '3_Standard_Table_Verified',
        processedBySoftwareCode: true,
        extractedFromDatabase: true,
        manufacturerCodeIdentified: true,
        officialManufacturerSiteChecked: false,
        datasheetOrCatalogChecked: false,
        matchedAgainstReliableSource: true,
        familyConfirmedByEvidence: true,
        sourceUrl: nominalUrl,
        documentType: 'NOMINAL_REFERENCE_TABLE',
        matchedManufacturer: null,
        evidenceBasis: `تطبیق کد طول اسمی ${imperialBaseKey} با جدول مرجع نامینال (${inImperialRef ? 'Optibelt TM PDF' : 'MISUMI H Table'})؛ دیتاشیت SKU اختصاصی برند ${rec.detectedBrand} چک نشده است`,
      },
    };
  }

  if (rec.technical.operatingPrinciple === 'non-belt' || rec.technical.operatingPrinciple === 'equipment') {
    const isWeldingTool = rec.technical.operatingPrinciple === 'equipment';
    return {
      confidence: 'ALGORITHMIC_STANDARD_ONLY',
      verification: {
        tier: 'INTERNAL_DB_CATALOG_ONLY',
        evidenceClass7: '6_Internal_Database_Only',
        processedBySoftwareCode: true,
        extractedFromDatabase: true,
        manufacturerCodeIdentified: false,
        officialManufacturerSiteChecked: false,
        datasheetOrCatalogChecked: false,
        matchedAgainstReliableSource: false,
        familyConfirmedByEvidence: true,
        sourceUrl: 'internal://tests/fixtures/catalogueSource.json',
        documentType: 'INTERNAL_CATALOG_RECORD',
        matchedManufacturer: null,
        evidenceBasis: isWeldingTool
          ? 'دستگاه گیره آپارات تسمه جوشی بدون نام برند ثبت‌شده — تشخیص بر اساس نام انبار و برگ اختصاصی اکسل (بدون دیتاشیت سازنده خارجی)'
          : 'تشخیص قطعه غیرتسمه‌ای بر اساس نام کالا و ساختار انبار داخلی (بدون دیتاشیت سازنده خارجی)',
      },
    };
  }

  // Strict re-evaluation of SERIES_VERIFIED:
  // Only SKUs carrying an explicit verified commercial series name in the SKU string (Megadyne TNX or Megadyne Silver)
  // belong in SERIES_VERIFIED — and still with officialManufacturerSiteChecked = false & datasheetOrCatalogChecked = false
  // because individual SKU sheets were not verified. Generic major-brand algorithmic regex SKUs stay ALGORITHMIC_STANDARD_ONLY.
  const upperOrig = normalize(rec.originalName).toUpperCase();
  if (rec.detectedBrand === 'MEGADYNE' && /\bTNX\b/.test(upperOrig)) {
    return {
      confidence: 'SERIES_VERIFIED',
      verification: {
        tier: 'BRAND_SERIES_AND_ISO_STANDARD',
        evidenceClass7: '4_Brand_Series_Identified',
        processedBySoftwareCode: true,
        extractedFromDatabase: true,
        manufacturerCodeIdentified: hasIdentifiedCode,
        officialManufacturerSiteChecked: false,
        datasheetOrCatalogChecked: false,
        matchedAgainstReliableSource: true,
        familyConfirmedByEvidence: true,
        sourceUrl: MEGADYNE_TNX_URL,
        documentType: 'SERIES_CATALOG',
        matchedManufacturer: 'MEGADYNE',
        evidenceBasis: `سری تجاری صریح Megadyne TNX در متن کالا + استاندارد ${rec.technical.standardReference} (استعلام تک‌تک سایزها روی سایت سازنده انجام نشده است)`,
      },
    };
  }

  if (rec.detectedBrand === 'MEGADYNE' && /\bSILVER\b/.test(upperOrig)) {
    return {
      confidence: 'SERIES_VERIFIED',
      verification: {
        tier: 'BRAND_SERIES_AND_ISO_STANDARD',
        evidenceClass7: '4_Brand_Series_Identified',
        processedBySoftwareCode: true,
        extractedFromDatabase: true,
        manufacturerCodeIdentified: hasIdentifiedCode,
        officialManufacturerSiteChecked: false,
        datasheetOrCatalogChecked: false,
        matchedAgainstReliableSource: true,
        familyConfirmedByEvidence: true,
        sourceUrl: MEGADYNE_SILVER_URL,
        documentType: 'SERIES_CATALOG',
        matchedManufacturer: 'MEGADYNE',
        evidenceBasis: `سری تجاری صریح Megadyne RPP Silver در متن کالا + استاندارد ${rec.technical.standardReference} (استعلام تک‌تک سایزها روی سایت سازنده انجام نشده است)`,
      },
    };
  }

  return {
    confidence: 'ALGORITHMIC_STANDARD_ONLY',
    verification: {
      tier: 'ALGORITHMIC_REGEX_AND_ISO_TABLE',
      evidenceClass7: '5_Algorithmically_Classified',
      processedBySoftwareCode: true,
      extractedFromDatabase: true,
      manufacturerCodeIdentified: hasIdentifiedCode,
      officialManufacturerSiteChecked: false,
      datasheetOrCatalogChecked: false,
      matchedAgainstReliableSource: false,
      familyConfirmedByEvidence: true,
      sourceUrl: 'internal://iso-din-rma-jis-geometry-tables',
      documentType: 'ENGINEERING_STANDARD_ONLY',
      matchedManufacturer: null,
      evidenceBasis: `طبقه‌بندی صرفاً الگوریتمی از متن انبار + جدول استاندارد ${rec.technical.standardReference} (برند ${rec.detectedBrand} به معنی بررسی سایت/دیتاشیت سازنده نیست)`,
    },
  };
}

function buildImperialTimingReasoning(
  sku: string,
  rawName: string,
  brand: string,
  profile: string,
  spec: (typeof IMPERIAL_TIMING_SPECS)[string],
  lengthCode: string | null,
  pitchLengthMm: number | null,
  toothCount: number | null,
  widthCode: string | null,
  nominalWidthMm: number | null,
  supplyForm: BeltTechnicalParameters['supplyForm'],
  currentFamilyId: string
): string {
  if (sku === '10538' || sku === '36103') {
    return `تسمه تایمینگ ذوزنقه‌ای اینچی یک‌طرفه Bando Synchro-Link پروفیل H (گام 0.5 اینچ = 12.7 میلی‌متر، زاویه دندانه 40 درجه، ارتفاع دندانه 2.29 میلی‌متر، ضخامت کل 4.30 میلی‌متر، بدنه نئوپرن با کورد فایبرگلاس و روکش دندانه نایلونی). کد ${sku} دارای طول گام ${pitchLengthMm} میلی‌متر (${toothCount} دندانه) و کد عرض ${widthCode} (معادل 1.00 اینچ = 25.4 میلی‌متر) است. کدهای 10538 (1400H100) و 36103 (1140H100) دقیقاً واریانت‌های سایزی یک خانواده واحد هستند که پیش‌تر به دلیل نگارش بدون فاصله 1140H100 در دو خانواده و دو زیرشاخه متفاوت قرار گرفته بودند.`;
  }
  if (['36468', '10111', '41291', '41598', '41689', '36636', '41322', '39994', '41349'].includes(sku)) {
    if (supplyForm === 'uncut-sleeve') {
      return `تسمه تایمینگ ذوزنقه‌ای اینچی دوطرفه (Double-Sided) Bando Synchro-Link پروفیل DH (گام 12.7 میلی‌متر، دندانه در هر دو طرف، ضخامت کل 5.94 میلی‌متر) به صورت «آستین برش‌نخورده» (Sleeve) با واحد فروش «سانتی‌متر» و طول گام ${pitchLengthMm} میلی‌متر (${toothCount} دندانه در هر طرف). به دلیل عرضه به صورت آستین و فروش برحسب سانتی‌متر عرض برش، فاقد کد عرض سه‌رقمی اینچی است و در خانواده مستقل آستین دوطرفه DH BANDO قرار می‌گیرد (و هرگز با تسمه یک‌طرفه H یا حلقه‌های برش‌خورده ترکیب نمی‌شود).`;
    }
    return `تسمه تایمینگ ذوزنقه‌ای اینچی دوطرفه (Double-Sided) Bando Synchro-Link پروفیل DH (گام 12.7 میلی‌متر، دندانه در هر دو طرف، ضخامت کل 5.94 میلی‌متر) به صورت حلقه مداربسته استاندارد با طول گام ${pitchLengthMm} میلی‌متر (${toothCount} دندانه در هر طرف) و کد عرض ${widthCode} (${nominalWidthMm} میلی‌متر). تمام کدهای حلقه مداربسته DH برند BANDO (10111، 41291، 41598، 41689، 36636 و 41322) در یک خانواده واحد قرار می‌گیرند و از تسمه‌های یک‌طرفه H و آستین‌های برش‌نخورده DH تفکیک می‌شوند.`;
  }
  if (currentFamilyId === 'FAM-10538') {
    return `تفکیک از خانواده مختلط FAM-10538 («تسمه BANDO»): این کد دارای پروفیل ${profile} (${
      spec.sidedness === 'double-sided' ? 'دوطرفه' : 'یک‌طرفه'
    }) و فرم عرضه ${supplyForm === 'uncut-sleeve' ? 'آستین (سانتی‌متر)' : 'حلقه مداربسته'} با گام ${
      spec.pitchMm
    } میلی‌متر است و نباید با پروفیل‌های دیگر یا فرم عرضه متفاوت در یک خانواده ادغام شود.`;
  }
  return `تسمه سنکرون اینچی پروفیل ${profile} (${
    spec.sidedness === 'double-sided' ? 'دوطرفه' : 'یک‌طرفه'
  }) با گام ${spec.pitchMm} میلی‌متر مطابق ISO 19347 / DIN ISO 5296${
    pitchLengthMm ? `، طول گام ${pitchLengthMm} میلی‌متر (${toothCount} دندانه)` : ''
  }${nominalWidthMm ? ` و عرض اسمی ${nominalWidthMm} میلی‌متر` : ''}.`;
}

export function classifyBeltSkuWithProvenance(
  product: Product,
  variant: ProductVariant,
  refs?: AuditReferenceTables
): BeltSkuAuditRecord {
  const rec = classifyBeltSku(product, variant);
  const resolved = resolveProvenanceAndConfidence(rec, refs);
  rec.confidence = resolved.confidence;
  rec.verification = resolved.verification;
  return rec;
}

export function runBeltCatalogAudit(products: Product[], refs?: AuditReferenceTables): BeltCatalogAuditReport {
  const skuRecords: BeltSkuAuditRecord[] = [];
  const beltCategoryBeforeFamilies = new Set<string>();

  let totalCatalogSkus = 0;
  for (const product of products) {
    if (product.categoryName === 'تسمه و انتقال نیرو' || product.categoryName === 'نوار و تسمه نقاله') {
      beltCategoryBeforeFamilies.add(product.code);
    }
    for (const variant of product.variants || []) {
      totalCatalogSkus++;
      if (isBeltOrBeltAdjacentCandidate(product, variant)) {
        skuRecords.push(classifyBeltSkuWithProvenance(product, variant, refs));
      }
    }
  }

  // Build Proposed Families (Report B)
  const familyGroups = new Map<string, BeltSkuAuditRecord[]>();
  for (const rec of skuRecords) {
    const list = familyGroups.get(rec.proposedFamilyId) || [];
    list.push(rec);
    familyGroups.set(rec.proposedFamilyId, list);
  }

  // Track which source families were split into multiple proposed families
  const sourceFamilyToProposed = new Map<string, Set<string>>();
  for (const rec of skuRecords) {
    const set = sourceFamilyToProposed.get(rec.currentFamilyId) || new Set<string>();
    set.add(rec.proposedFamilyId);
    sourceFamilyToProposed.set(rec.currentFamilyId, set);
  }

  const proposedFamilies: ProposedBeltFamilyRecord[] = [...familyGroups.entries()]
    .map(([proposedFamilyId, members]) => {
      const sample = members[0];
      const sourceFamilyIds = [...new Set(members.map((m) => m.currentFamilyId))];
      const mergedFromFamilies = sourceFamilyIds.length > 1 ? sourceFamilyIds : [];
      const splitFromFamilies = sourceFamilyIds.filter((sf) => (sourceFamilyToProposed.get(sf)?.size || 0) > 1);

      const excludedIncompatibleSkus: Array<{ sku: string; reason: string }> = [];
      for (const sf of splitFromFamilies) {
        const otherMembers = skuRecords.filter((r) => r.currentFamilyId === sf && r.proposedFamilyId !== proposedFamilyId);
        for (const om of otherMembers.slice(0, 12)) {
          excludedIncompatibleSkus.push({
            sku: om.sku,
            reason: `دارای پروفیل ${om.technical.profile} (${om.technical.sidedness}) و واحد/فرم عرضه ${om.unit} (${om.technical.supplyForm})؛ منتقل‌شده به ${om.proposedFamilyId}`,
          });
        }
      }

      const variableParameters: string[] = [];
      if (members.some((m) => m.technical.pitchLengthMm || m.technical.insideLengthMm || m.technical.outsideLengthMm)) {
        variableParameters.push('طول گام / طول موثر (Length)');
      }
      if (members.some((m) => m.technical.toothCount)) {
        variableParameters.push('تعداد دندانه (Teeth Count)');
      }
      if (members.some((m) => m.technical.nominalWidthMm)) {
        variableParameters.push('عرض تسمه (Belt Width)');
      }
      if (members.some((m) => m.technical.ribCount)) {
        variableParameters.push('تعداد شیار / شاخه (Rib Count)');
      }
      if (variableParameters.length === 0) {
        variableParameters.push('ابعاد سفارش / سایز کاتالوگ');
      }

      return {
        proposedFamilyId,
        familyNameFa: sample.proposedFamilyNameFa,
        familyNameEn: sample.proposedFamilyNameEn,
        categorySlug: sample.proposedCategorySlug,
        categoryName: sample.proposedCategoryName,
        submenu: sample.proposedSubmenu,
        leaf: sample.proposedLeaf,
        taxonomyGap: sample.taxonomyGap,
        brand: sample.detectedBrand,
        beltDivision: sample.technical.beltDivision,
        profile: sample.technical.profile,
        sidedness: sample.technical.sidedness,
        supplyForm: sample.technical.supplyForm,
        unit: sample.unit,
        fixedSpecs: {
          pitchMm: sample.technical.pitchMm,
          toothHeightMm: sample.technical.toothHeightMm,
          beltThicknessMm: sample.technical.beltThicknessMm,
          bodyMaterial: sample.technical.bodyMaterial,
          tensileCord: sample.technical.tensileCord,
          backingOrCoating: sample.technical.backingOrCoating,
          standardReference: sample.technical.standardReference,
        },
        variableParameters,
        skuCount: members.length,
        memberSkus: members.map((m) => m.sku),
        sourceFamilyIds,
        mergedFromFamilies,
        splitFromFamilies,
        excludedIncompatibleSkus,
        technicalDescriptionFa: `${sample.proposedFamilyNameFa} (${sample.actualProductType})؛ استاندارد مرجع: ${
          sample.technical.standardReference
        }؛ شامل ${members.length.toLocaleString('fa-IR')} کد کالا با واحد فروش «${sample.unit}».`,
      };
    })
    .sort((a, b) => b.skuCount - a.skuCount || a.proposedFamilyId.localeCompare(b.proposedFamilyId));

  // Build Exceptions (Report C)
  const exceptions: BeltCatalogExceptionRecord[] = [];

  for (const rec of skuRecords) {
    if (
      rec.currentCategory !== 'تسمه و انتقال نیرو' &&
      rec.currentCategory !== 'نوار و تسمه نقاله' &&
      rec.technical.operatingPrinciple !== 'non-belt'
    ) {
      exceptions.push({
        type: 'MISPLACED_BELT_OUTSIDE_BELT_CATEGORY',
        severity: 'HIGH',
        skuOrFamilyId: `${rec.sku} (${rec.currentFamilyId})`,
        originalName: rec.originalName,
        currentLocation: `${rec.currentCategory} > ${rec.currentSubcategory}`,
        proposedResolution: `${rec.proposedCategoryName} (${rec.proposedCategorySlug}) > ${rec.proposedSubmenu} > ${rec.proposedLeaf} [${rec.proposedFamilyId}]`,
        engineeringExplanation: rec.engineeringReasoning,
      });
    }

    if (rec.currentCategory === 'تسمه و انتقال نیرو' && rec.technical.operatingPrinciple === 'non-belt') {
      exceptions.push({
        type: 'NON_BELT_INSIDE_BELT_CATEGORY',
        severity: 'HIGH',
        skuOrFamilyId: `${rec.sku} (${rec.currentFamilyId})`,
        originalName: rec.originalName,
        currentLocation: `${rec.currentCategory} > ${rec.currentSubcategory}`,
        proposedResolution: `${rec.proposedCategoryName} (${rec.proposedCategorySlug}) > ${rec.proposedLeaf}`,
        engineeringExplanation: rec.engineeringReasoning,
      });
    }

    if (rec.currentCategory === 'نوار و تسمه نقاله' && rec.technical.operatingPrinciple === 'non-belt') {
      exceptions.push({
        type: 'NON_CONVEYOR_INSIDE_CONVEYOR_CATEGORY',
        severity: 'HIGH',
        skuOrFamilyId: `${rec.sku} (${rec.currentFamilyId})`,
        originalName: rec.originalName,
        currentLocation: `${rec.currentCategory} > ${rec.currentSubcategory}`,
        proposedResolution: `${rec.proposedCategoryName} (${rec.proposedCategorySlug}) > ${rec.proposedLeaf}`,
        engineeringExplanation: rec.engineeringReasoning,
      });
    }

    if (/^(?:تسه|سمه|نسمه)(?=\s|$)/.test(normalize(rec.originalName))) {
      exceptions.push({
        type: 'TYPO_IN_ORIGINAL_NAME',
        severity: 'MEDIUM',
        skuOrFamilyId: `${rec.sku} (${rec.currentFamilyId})`,
        originalName: rec.originalName,
        currentLocation: `${rec.currentCategory} > ${rec.currentSubcategory}`,
        proposedResolution: `حفظ نام اصلی در دیتابیس + شناسایی نرم‌افزاری به عنوان تسمه در ${rec.proposedFamilyId}`,
        engineeringExplanation:
          'پیشوند کلمه «تسمه» در نام اصلی به صورت «تسه»، «سمه» یا «نسمه» تایپ شده بود و باعث دسته‌بندی در «اقلام نیازمند شناسایی» شده بود.',
      });
    }

    if (rec.confidence === 'REQUIRES_REVIEW') {
      exceptions.push({
        type: 'AMBIGUOUS_OR_CONFLICTING_DESIGNATION',
        severity: 'MEDIUM',
        skuOrFamilyId: `${rec.sku} (${rec.currentFamilyId})`,
        originalName: rec.originalName,
        currentLocation: `${rec.currentCategory} > ${rec.currentSubcategory}`,
        proposedResolution: 'بازبینی مهندسی و قرائت مشخصات روی تسمه فیزیکی',
        engineeringExplanation: rec.engineeringReasoning,
      });
    }
  }

  // Record Family Splits (e.g. FAM-10538)
  for (const [sourceFamId, targetSet] of sourceFamilyToProposed.entries()) {
    if (targetSet.size > 1) {
      const members = skuRecords.filter((r) => r.currentFamilyId === sourceFamId);
      exceptions.push({
        type: 'MIXED_PROFILE_OR_SUPPLY_FAMILY_SPLIT',
        severity: 'HIGH',
        skuOrFamilyId: sourceFamId,
        originalName: members[0]?.currentFamilyName || sourceFamId,
        currentLocation: `${members[0]?.currentCategory} > ${members[0]?.currentSubcategory} (${members.length} SKUs)`,
        proposedResolution: `تفکیک مهندسی به ${targetSet.size} خانواده مجزا: ${[...targetSet].join(', ')}`,
        engineeringExplanation: `خانواده ${sourceFamId} شامل ترکیب ناسازگاری از پروفیل‌ها (${[
          ...new Set(members.map((m) => m.technical.profile)),
        ].join(' / ')})، یک‌طرفه/دوطرفه و واحدهای فروش متفاوت (${[...new Set(members.map((m) => m.unit))].join(
          ' / '
        )}) بود که براساس گام، پروفیل دندانه، یک‌طرفه/دوطرفه بودن و فرم عرضه تفکیک شد.`,
      });
    }
  }

  // Record Taxonomy Gaps (deduplicated by gap code)
  const seenGaps = new Set<string>();
  for (const fam of proposedFamilies) {
    if (fam.taxonomyGap) {
      const gapCode = fam.taxonomyGap.split(':')[0];
      if (!seenGaps.has(gapCode)) {
        seenGaps.add(gapCode);
        const affectedSkus = skuRecords.filter((r) => r.taxonomyGap?.startsWith(gapCode));
        exceptions.push({
          type: 'TAXONOMY_GAP',
          severity: 'MEDIUM',
          skuOrFamilyId: `${gapCode} (${affectedSkus.length} SKUs)`,
          originalName: fam.familyNameFa,
          currentLocation: `${fam.categoryName} > ${fam.submenu} > ${fam.leaf}`,
          proposedResolution: fam.taxonomyGap,
          engineeringExplanation: `تعداد ${affectedSkus.length} کد کالا دارای پروفیل یا ساختار معتبری هستند که در عنوان برگ‌های فعلی فایل اکسل به صورت صریح درج نشده و به نزدیک‌ترین برگ مهندسی نگاشت شده‌اند.`,
        });
      }
    }
  }

  const confidenceCounts: Record<BeltConfidenceLevel, number> = {
    DATASHEET_VERIFIED: 0,
    NOMINAL_TABLE_VERIFIED: 0,
    SERIES_VERIFIED: 0,
    ALGORITHMIC_STANDARD_ONLY: 0,
    REQUIRES_REVIEW: 0,
  };
  const verificationTierCounts: Record<VerificationSourceTier, number> = {
    EXACT_SKU_DATASHEET_MATCHED: 0,
    NOMINAL_DESIGNATION_REF_MATCHED: 0,
    BRAND_SERIES_AND_ISO_STANDARD: 0,
    ALGORITHMIC_REGEX_AND_ISO_TABLE: 0,
    INTERNAL_DB_CATALOG_ONLY: 0,
    UNVERIFIED_REQUIRES_PHYSICAL_REVIEW: 0,
  };
  const sevenLevelEvidenceCounts: Record<SevenLevelEvidenceClass, number> = {
    '1_Manufacturer_Datasheet_Verified': 0,
    '2_Official_Catalog_Verified': 0,
    '3_Standard_Table_Verified': 0,
    '4_Brand_Series_Identified': 0,
    '5_Algorithmically_Classified': 0,
    '6_Internal_Database_Only': 0,
    '7_Requires_Physical_Inspection': 0,
  };
  const actionCounts: Record<BeltRecommendedAction, number> = {
    KEEP_IN_CURRENT_FAMILY: 0,
    MOVE_TO_EXISTING_FAMILY: 0,
    CREATE_NEW_FAMILY: 0,
    SPLIT_FROM_CURRENT_FAMILY: 0,
    MOVE_TO_OTHER_CATEGORY: 0,
    MANUAL_ENGINEERING_REVIEW: 0,
  };

  let misplacedBeltOrEquipOutsideMovedIn = 0;
  let nonBeltRemovedFromBeltCat = 0;
  let nonConveyorRemovedFromConvCat = 0;
  let beltMovedFromBeltCatToConveyorCat = 0;
  let conveyorMovedFromConvCatToBeltCat = 0;
  let nonBeltAlreadyOutsideBeltOrConv = 0;
  let withinBeltOrConvSubcategoryChanged = 0;
  let withinBeltOrConvUnchanged = 0;

  for (const rec of skuRecords) {
    confidenceCounts[rec.confidence]++;
    verificationTierCounts[rec.verification.tier]++;
    sevenLevelEvidenceCounts[rec.verification.evidenceClass7]++;
    actionCounts[rec.recommendedAction]++;

    const inPT = rec.currentCategory === 'تسمه و انتقال نیرو';
    const inConv = rec.currentCategory === 'نوار و تسمه نقاله';
    const isNonBelt = rec.technical.operatingPrinciple === 'non-belt';

    if (!inPT && !inConv) {
      if (isNonBelt) nonBeltAlreadyOutsideBeltOrConv++;
      else misplacedBeltOrEquipOutsideMovedIn++;
    } else if (inPT) {
      if (isNonBelt) nonBeltRemovedFromBeltCat++;
      else if (rec.proposedCategorySlug === 'excel-v2-2-1') beltMovedFromBeltCatToConveyorCat++;
      else if (rec.recommendedAction !== 'KEEP_IN_CURRENT_FAMILY' || rec.currentSubcategory === 'تسمه صنعتی') withinBeltOrConvSubcategoryChanged++;
      else withinBeltOrConvUnchanged++;
    } else if (inConv) {
      if (isNonBelt) nonConveyorRemovedFromConvCat++;
      else if (rec.proposedCategorySlug !== 'excel-v2-2-1') conveyorMovedFromConvCatToBeltCat++;
      else withinBeltOrConvUnchanged++;
    }
  }

  const partitionTotal =
    misplacedBeltOrEquipOutsideMovedIn +
    nonBeltRemovedFromBeltCat +
    nonConveyorRemovedFromConvCat +
    beltMovedFromBeltCatToConveyorCat +
    conveyorMovedFromConvCatToBeltCat +
    nonBeltAlreadyOutsideBeltOrConv +
    withinBeltOrConvSubcategoryChanged +
    withinBeltOrConvUnchanged;

  const truePowerTransmission = skuRecords.filter(
    (r) =>
      r.technical.operatingPrinciple === 'synchronous' ||
      r.technical.operatingPrinciple === 'friction-v' ||
      r.technical.operatingPrinciple === 'friction-ribbed' ||
      r.technical.operatingPrinciple === 'friction-round-welded' ||
      r.technical.beltDivision === 'vbelt-crowned-crc'
  );
  const trueConveyor = skuRecords.filter(
    (r) => r.technical.beltDivision === 'conveyor-pvc-pu' || r.technical.beltDivision === 'conveyor-grip'
  );
  const beltEquipment = skuRecords.filter((r) => r.technical.operatingPrinciple === 'equipment');

  const validBeltFamilies = proposedFamilies.filter(
    (f) =>
      !f.beltDivision.startsWith('non-belt-') &&
      f.beltDivision !== 'belt-welding-tool' &&
      f.beltDivision !== 'service-ambiguous'
  );
  const singletonValidBeltFamilies = validBeltFamilies.filter((f) => f.skuCount === 1).length;
  const multiMemberValidBeltFamilies = validBeltFamilies.filter((f) => f.skuCount > 1).length;
  const weldingToolGroups = proposedFamilies.filter((f) => f.beltDivision === 'belt-welding-tool').length;
  const provisionalReviewGroups = proposedFamilies.filter((f) => f.beltDivision === 'service-ambiguous').length;
  const separatedNonBeltFamilies = proposedFamilies.filter((f) => f.beltDivision.startsWith('non-belt-')).length;

  return {
    generatedAt: new Date().toISOString(),
    totalCatalogFamilies: products.length,
    totalCatalogSkus,
    auditedSkuCount: skuRecords.length,
    trueBeltSkuCount: truePowerTransmission.length + trueConveyor.length,
    truePowerTransmissionBeltSkuCount: truePowerTransmission.length,
    trueConveyorBeltSkuCount: trueConveyor.length,
    beltEquipmentSkuCount: beltEquipment.length,
    misplacedBeltOutsideBeltCategoryCount: misplacedBeltOrEquipOutsideMovedIn,
    nonBeltInsideBeltCategoryCount: nonBeltRemovedFromBeltCat,
    nonConveyorInsideConveyorCategoryCount: nonConveyorRemovedFromConvCat,
    catchAllIndustrialBeltResolvedCount: skuRecords.filter(
      (r) => r.currentSubcategory === 'تسمه صنعتی' && r.technical.beltDivision !== 'service-ambiguous'
    ).length,
    beforeFamilyCountInBeltCategories: beltCategoryBeforeFamilies.size,
    afterProposedBeltFamilyCount: validBeltFamilies.length,
    groupCounts: {
      validBeltAndConveyorFamilies: validBeltFamilies.length,
      singletonValidBeltFamilies,
      multiMemberValidBeltFamilies,
      weldingToolGroups,
      provisionalReviewGroups,
      separatedNonBeltFamilies,
      totalProposedGroups: proposedFamilies.length,
    },
    confidenceCounts,
    verificationTierCounts,
    sevenLevelEvidenceCounts,
    actionCounts,
    reconciliationPartition: {
      misplacedBeltOrEquipOutsideMovedIn,
      nonBeltRemovedFromBeltCat,
      nonConveyorRemovedFromConvCat,
      beltMovedFromBeltCatToConveyorCat,
      conveyorMovedFromConvCatToBeltCat,
      nonBeltAlreadyOutsideBeltOrConv,
      withinBeltOrConvSubcategoryChanged,
      withinBeltOrConvUnchanged,
      partitionTotal,
    },
    bandoSpotlight: {
      hSingleSidedCohort: skuRecords.filter(
        (r) => r.detectedBrand === 'BANDO' && r.technical.profile === 'H' && r.technical.sidedness === 'single-sided'
      ),
      dhDoubleSidedEndlessCohort: skuRecords.filter(
        (r) =>
          r.detectedBrand === 'BANDO' &&
          r.technical.profile === 'DH' &&
          r.technical.supplyForm === 'endless-loop'
      ),
      dhDoubleSidedSleeveCohort: skuRecords.filter(
        (r) =>
          r.detectedBrand === 'BANDO' &&
          r.technical.profile === 'DH' &&
          r.technical.supplyForm === 'uncut-sleeve'
      ),
      lSingleSidedSeparatedFrom10538: skuRecords.filter(
        (r) => r.currentFamilyId === 'FAM-10538' && r.technical.profile === 'L'
      ),
    },
    reportA_skuClassifications: skuRecords,
    reportB_proposedFamilies: proposedFamilies,
    reportC_exceptions: exceptions,
  };
}

function checkInvariantString(
  values: Array<string | null | undefined>,
  unknownRegex = /نامشخص|UNSPECIFIED|UNKNOWN|نیازمند قرائت/i
): AttributeCheckStatus {
  if (values.length === 0) return 'UNKNOWN';
  const cleaned = values.map((v) => String(v ?? '').trim());
  if (cleaned.some((v) => !v || unknownRegex.test(v))) return 'UNKNOWN';
  return new Set(cleaned).size === 1 ? 'OK_INVARIANT' : 'FAIL_MIXED';
}

function checkNumericAttribute(
  values: Array<number | null | undefined>,
  applicable: boolean,
  allowControlledVariant = false
): AttributeCheckStatus {
  if (!applicable) return 'NOT_APPLICABLE';
  if (values.length === 0 || values.some((v) => v === null || v === undefined || !Number.isFinite(v))) {
    return 'UNKNOWN';
  }
  const uniq = new Set(values.map((v) => Number(v)));
  if (uniq.size === 1) return 'OK_INVARIANT';
  return allowControlledVariant ? 'CONTROLLED_VARIANT' : 'FAIL_MIXED';
}

export function validateFamilyEngineeringHomogeneity(
  family: ProposedBeltFamilyRecord,
  members: BeltSkuAuditRecord[]
): FamilyEngineeringValidationResult {
  const div = family.beltDivision;
  const prof = family.profile;
  const isNonBeltOrEquip = div.startsWith('non-belt-') || div === 'belt-welding-tool';
  const isAmbiguous = div === 'service-ambiguous';

  if (members.length === 0) {
    return {
      proposedFamilyId: family.proposedFamilyId,
      brandCheck: 'UNKNOWN',
      productTypeCheck: 'UNKNOWN',
      operatingPrincipleCheck: 'UNKNOWN',
      profileCheck: 'UNKNOWN',
      pitchCheck: 'UNKNOWN',
      toothAngleCheck: 'UNKNOWN',
      toothHeightCheck: 'UNKNOWN',
      beltThicknessCheck: 'UNKNOWN',
      beltWidthCheck: 'UNKNOWN',
      bodyMaterialCheck: 'UNKNOWN',
      tensileCordCheck: 'UNKNOWN',
      coveringCheck: 'UNKNOWN',
      sidednessCheck: 'UNKNOWN',
      supplyFormCheck: 'UNKNOWN',
      unitCheck: 'UNKNOWN',
      standardCheck: 'UNKNOWN',
      mixedAttributes: [],
      unknownAttributes: ['members'],
      notApplicableAttributes: [],
      homogeneityVerdict: 'FAIL_REQUIRES_PHYSICAL_REVIEW',
      passedStrictValidation: false,
      verdictDetail: 'FAIL — Empty family member list',
    };
  }

  // 1. Brand (UNSPECIFIED, *-OEM, and wrong generic descriptor SYNCHRONOUS are UNKNOWN, never falsely OK)
  let brandCheck: AttributeCheckStatus;
  if (new Set(members.map((m) => m.detectedBrand)).size > 1) {
    brandCheck = 'FAIL_MIXED';
  } else {
    const b = members[0].detectedBrand;
    if (!b || b === 'UNSPECIFIED' || b.endsWith('-OEM') || b === 'SYNCHRONOUS') {
      brandCheck = isNonBeltOrEquip ? 'NOT_APPLICABLE' : 'UNKNOWN';
    } else {
      brandCheck = 'OK_INVARIANT';
    }
  }

  // 2. Product Type
  const productTypeCheck: AttributeCheckStatus = isAmbiguous
    ? 'UNKNOWN'
    : checkInvariantString(members.map((m) => m.actualProductType), /نامشخص|ناقص|UNKNOWN/i);

  // 3. Operating Principle
  const operatingPrincipleCheck: AttributeCheckStatus =
    new Set(members.map((m) => m.technical.operatingPrinciple)).size > 1
      ? 'FAIL_MIXED'
      : isAmbiguous
        ? 'UNKNOWN'
        : 'OK_INVARIANT';

  // 4. Profile
  const profileCheck: AttributeCheckStatus = isNonBeltOrEquip
    ? 'NOT_APPLICABLE'
    : isAmbiguous || members.some((m) => !m.technical.profile || m.technical.profile === 'UNSPECIFIED')
      ? 'UNKNOWN'
      : new Set(members.map((m) => m.technical.profile)).size > 1
        ? 'FAIL_MIXED'
        : 'OK_INVARIANT';

  // 5. Pitch (applicable to synchronous timing belts & Poly-V longitudinal ribs; N/A to V-belts, welded PU, flat conveyors, hardware)
  const pitchApplicable = !isNonBeltOrEquip && !isAmbiguous && (div.startsWith('timing-') || div === 'ribbed-poly-v');
  const pitchCheck: AttributeCheckStatus = isAmbiguous
    ? 'UNKNOWN'
    : checkNumericAttribute(
        members.map((m) => m.technical.pitchMm),
        pitchApplicable
      );

  // 6. Tooth / Rib / V-Groove Angle (applicable to trapezoidal timing, Poly-V ribs, V-belts, PU V/CRC/BRB; N/A to HTD/RPP/AUTO curvilinear, ROUND, conveyor)
  const toothAngleApplicable =
    !isNonBeltOrEquip &&
    !isAmbiguous &&
    (div.startsWith('timing-imperial-') ||
      div.startsWith('timing-metric-') ||
      div === 'ribbed-poly-v' ||
      div.startsWith('vbelt-') ||
      div === 'perforated-open-v' ||
      div === 'welded-pu-v-flat' ||
      (div === 'welded-pu-round-crc' && (prof === 'CRC' || prof === 'BRB')));
  const toothAngleCheck: AttributeCheckStatus = isAmbiguous
    ? 'UNKNOWN'
    : checkNumericAttribute(
        members.map((m) => m.technical.toothAngleDeg),
        toothAngleApplicable
      );

  // 7. Tooth Height (applicable ONLY to synchronous timing belts; N/A to friction belts, Poly-V, flat conveyor, hardware)
  const toothHeightApplicable = !isNonBeltOrEquip && !isAmbiguous && div.startsWith('timing-');
  const toothHeightCheck: AttributeCheckStatus = isAmbiguous
    ? 'UNKNOWN'
    : checkNumericAttribute(
        members.map((m) => m.technical.toothHeightMm),
        toothHeightApplicable
      );

  // 8. Belt Thickness (applicable to all true belts/conveyors; controlled variant on ROUND diameter & PVC/PU conveyors only when non-null)
  const thicknessApplicable = !isNonBeltOrEquip && !isAmbiguous;
  const allowThicknessVariant = prof === 'ROUND' || div === 'conveyor-pvc-pu';
  const beltThicknessCheck: AttributeCheckStatus = isAmbiguous
    ? 'UNKNOWN'
    : checkNumericAttribute(
        members.map((m) => m.technical.beltThicknessMm),
        thicknessApplicable,
        allowThicknessVariant
      );

  // 9. Belt Width (N/A on uncut sleeves sold per cut cm width, hardware, or non-belts; invariant on fixed-section V-belts/CRC/BRB; controlled dimension on timing/Poly-V/conveyor/ROUND)
  let beltWidthCheck: AttributeCheckStatus;
  if (isNonBeltOrEquip) {
    beltWidthCheck = 'NOT_APPLICABLE';
  } else if (isAmbiguous) {
    beltWidthCheck = 'UNKNOWN';
  } else if (family.supplyForm === 'uncut-sleeve') {
    beltWidthCheck = 'NOT_APPLICABLE';
  } else {
    const widthMustBeInvariant =
      div.startsWith('vbelt-') ||
      div === 'perforated-open-v' ||
      div === 'welded-pu-v-flat' ||
      prof === 'CRC' ||
      prof === 'BRB';
    beltWidthCheck = checkNumericAttribute(
      members.map((m) => m.technical.nominalWidthMm),
      true,
      !widthMustBeInvariant
    );
  }

  // 10. Body Material
  const bodyMaterialCheck: AttributeCheckStatus = isNonBeltOrEquip
    ? 'NOT_APPLICABLE'
    : checkInvariantString(members.map((m) => m.technical.bodyMaterial));

  // 11. Tensile Cord
  const tensileCordCheck: AttributeCheckStatus = isNonBeltOrEquip
    ? 'NOT_APPLICABLE'
    : checkInvariantString(members.map((m) => m.technical.tensileCord));

  // 12. Covering / Backing (NEVER treat null===null as OK_INVARIANT; distinguish NOT_APPLICABLE vs explicit OK_INVARIANT vs FAIL_MIXED vs UNKNOWN)
  let coveringCheck: AttributeCheckStatus;
  if (isNonBeltOrEquip) {
    coveringCheck = 'NOT_APPLICABLE';
  } else if (isAmbiguous) {
    coveringCheck = 'UNKNOWN';
  } else {
    const rawCoverings = members.map((m) => (m.technical.backingOrCoating ? m.technical.backingOrCoating.trim() : null));
    const hasNull = rawCoverings.some((c) => c === null);
    const hasNonNull = rawCoverings.some((c) => c !== null);
    if (hasNull && hasNonNull) {
      coveringCheck = 'FAIL_MIXED';
    } else if (!hasNonNull) {
      // Uncoated/bare standard construction (e.g. standard neoprene/PU belt without extra APL/Tie-Band backing)
      coveringCheck = 'NOT_APPLICABLE';
    } else {
      coveringCheck = new Set(rawCoverings as string[]).size === 1 ? 'OK_INVARIANT' : 'FAIL_MIXED';
    }
  }

  // 13. Sidedness
  let sidednessCheck: AttributeCheckStatus;
  if (isNonBeltOrEquip || members.every((m) => m.technical.sidedness === 'not-applicable')) {
    sidednessCheck = 'NOT_APPLICABLE';
  } else if (isAmbiguous) {
    sidednessCheck = 'UNKNOWN';
  } else {
    sidednessCheck = new Set(members.map((m) => m.technical.sidedness)).size === 1 ? 'OK_INVARIANT' : 'FAIL_MIXED';
  }

  // 14. Supply Form & Unit
  const supplyFormCheck: AttributeCheckStatus =
    new Set(members.map((m) => m.technical.supplyForm)).size === 1 ? 'OK_INVARIANT' : 'FAIL_MIXED';
  const unitCheck: AttributeCheckStatus = checkInvariantString(members.map((m) => m.unit));

  // 15. Standard Reference
  const standardCheck: AttributeCheckStatus = isNonBeltOrEquip
    ? 'NOT_APPLICABLE'
    : checkInvariantString(members.map((m) => m.technical.standardReference));

  const checkEntries: Array<[string, AttributeCheckStatus]> = [
    ['brand', brandCheck],
    ['productType', productTypeCheck],
    ['operatingPrinciple', operatingPrincipleCheck],
    ['profile', profileCheck],
    ['pitchMm', pitchCheck],
    ['toothAngleDeg', toothAngleCheck],
    ['toothHeightMm', toothHeightCheck],
    ['beltThicknessMm', beltThicknessCheck],
    ['beltWidth', beltWidthCheck],
    ['bodyMaterial', bodyMaterialCheck],
    ['tensileCord', tensileCordCheck],
    ['covering', coveringCheck],
    ['sidedness', sidednessCheck],
    ['supplyForm', supplyFormCheck],
    ['unit', unitCheck],
    ['standardReference', standardCheck],
  ];

  const mixedAttributes = checkEntries.filter(([, s]) => s === 'FAIL_MIXED').map(([k]) => k);
  const unknownAttributes = checkEntries.filter(([, s]) => s === 'UNKNOWN').map(([k]) => k);
  const notApplicableAttributes = checkEntries.filter(([, s]) => s === 'NOT_APPLICABLE').map(([k]) => k);

  let homogeneityVerdict: FamilyHomogeneityVerdict;
  let passedStrictValidation = false;
  let verdictDetail: string;

  if (isNonBeltOrEquip) {
    homogeneityVerdict = 'NON_BELT_OR_EQUIPMENT';
    verdictDetail = `NON_BELT_OR_EQUIPMENT (${div})`;
  } else if (mixedAttributes.length > 0) {
    homogeneityVerdict = 'FAIL_MIXED_INVARIANT';
    verdictDetail = `FAIL_MIXED_INVARIANT (${mixedAttributes.join(', ')})`;
  } else if (isAmbiguous) {
    homogeneityVerdict = 'FAIL_REQUIRES_PHYSICAL_REVIEW';
    verdictDetail = `FAIL_REQUIRES_PHYSICAL_REVIEW (unknown: ${unknownAttributes.join(', ')})`;
  } else if (unknownAttributes.length > 0) {
    homogeneityVerdict = 'CONDITIONAL_UNKNOWN_SPECS';
    verdictDetail = `CONDITIONAL_UNKNOWN_SPECS (unknown: ${unknownAttributes.join(', ')})`;
  } else {
    homogeneityVerdict = 'PASS_HOMOGENEOUS';
    passedStrictValidation = true;
    verdictDetail =
      notApplicableAttributes.length > 0
        ? `PASS_HOMOGENEOUS (N/A: ${notApplicableAttributes.join(', ')})`
        : 'PASS_HOMOGENEOUS';
  }

  return {
    proposedFamilyId: family.proposedFamilyId,
    brandCheck,
    productTypeCheck,
    operatingPrincipleCheck,
    profileCheck,
    pitchCheck,
    toothAngleCheck,
    toothHeightCheck,
    beltThicknessCheck,
    beltWidthCheck,
    bodyMaterialCheck,
    tensileCordCheck,
    coveringCheck,
    sidednessCheck,
    supplyFormCheck,
    unitCheck,
    standardCheck,
    mixedAttributes,
    unknownAttributes,
    notApplicableAttributes,
    homogeneityVerdict,
    passedStrictValidation,
    verdictDetail,
  };
}

export function findIdenticalInvariantMergeCandidates(
  family: ProposedBeltFamilyRecord,
  allValidBeltFamilies: ProposedBeltFamilyRecord[]
): SingletonDuplicateCheckResult {
  const sameBrandOthers = allValidBeltFamilies.filter(
    (o) =>
      o.proposedFamilyId !== family.proposedFamilyId &&
      o.brand === family.brand &&
      o.beltDivision === family.beltDivision &&
      o.profile === family.profile
  );
  const crossBrandSimilarIds = allValidBeltFamilies
    .filter(
      (o) =>
        o.proposedFamilyId !== family.proposedFamilyId &&
        o.brand !== family.brand &&
        o.beltDivision === family.beltDivision &&
        o.profile === family.profile
    )
    .map((o) => o.proposedFamilyId);

  const sameBrandSimilarDiffs: string[] = [];
  for (const o of sameBrandOthers) {
    const diffs: string[] = [];
    if (o.supplyForm !== family.supplyForm || o.unit !== family.unit) {
      diffs.push(`SupplyForm/Unit(${o.supplyForm}/${o.unit} vs ${family.supplyForm}/${family.unit})`);
    }
    if (o.fixedSpecs.tensileCord !== family.fixedSpecs.tensileCord) {
      diffs.push(`Cord(${o.fixedSpecs.tensileCord} vs ${family.fixedSpecs.tensileCord})`);
    }
    if (o.fixedSpecs.bodyMaterial !== family.fixedSpecs.bodyMaterial) {
      diffs.push(`Material(${o.fixedSpecs.bodyMaterial} vs ${family.fixedSpecs.bodyMaterial})`);
    }
    if ((o.fixedSpecs.backingOrCoating || '') !== (family.fixedSpecs.backingOrCoating || '')) {
      diffs.push(`Coating(${o.fixedSpecs.backingOrCoating || 'NONE'} vs ${family.fixedSpecs.backingOrCoating || 'NONE'})`);
    }
    if ((o.fixedSpecs.pitchMm ?? null) !== (family.fixedSpecs.pitchMm ?? null)) {
      diffs.push(`Pitch(${o.fixedSpecs.pitchMm ?? 'NULL'} vs ${family.fixedSpecs.pitchMm ?? 'NULL'})`);
    }
    if ((o.fixedSpecs.toothHeightMm ?? null) !== (family.fixedSpecs.toothHeightMm ?? null)) {
      diffs.push(`ToothHeight(${o.fixedSpecs.toothHeightMm ?? 'NULL'} vs ${family.fixedSpecs.toothHeightMm ?? 'NULL'})`);
    }
    if ((o.fixedSpecs.beltThicknessMm ?? null) !== (family.fixedSpecs.beltThicknessMm ?? null)) {
      diffs.push(`Thickness(${o.fixedSpecs.beltThicknessMm ?? 'NULL'} vs ${family.fixedSpecs.beltThicknessMm ?? 'NULL'})`);
    }
    if (o.fixedSpecs.standardReference !== family.fixedSpecs.standardReference) {
      diffs.push(`Standard(${o.fixedSpecs.standardReference} vs ${family.fixedSpecs.standardReference})`);
    }
    if (o.sidedness !== family.sidedness) {
      diffs.push(`Sidedness(${o.sidedness} vs ${family.sidedness})`);
    }
    sameBrandSimilarDiffs.push(`${o.proposedFamilyId}[${diffs.join('; ')}]`);
  }

  const invariantSignature = (f: ProposedBeltFamilyRecord) => {
    const ignoreThickness = f.profile === 'ROUND' || f.beltDivision === 'conveyor-pvc-pu';
    return [
      f.brand,
      f.beltDivision,
      f.profile,
      f.sidedness,
      f.supplyForm,
      f.unit,
      f.fixedSpecs.pitchMm ?? 'NULL',
      f.fixedSpecs.toothHeightMm ?? 'NULL',
      ignoreThickness ? 'CONTROLLED_VARIANT' : f.fixedSpecs.beltThicknessMm ?? 'NULL',
      f.fixedSpecs.bodyMaterial,
      f.fixedSpecs.tensileCord,
      f.fixedSpecs.backingOrCoating ?? 'NONE',
      f.fixedSpecs.standardReference,
    ].join('|');
  };

  const targetSig = invariantSignature(family);
  const identicalCandidateIds = allValidBeltFamilies
    .filter((o) => o.proposedFamilyId !== family.proposedFamilyId && invariantSignature(o) === targetSig)
    .map((o) => o.proposedFamilyId);

  return {
    identicalCandidateIds,
    sameBrandSimilarDiffs,
    crossBrandSimilarIds,
    identicalMergeCandidateCount: identicalCandidateIds.length,
  };
}
