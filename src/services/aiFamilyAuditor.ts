import {
  classifySingleIncomingSku,
  evaluateCandidateFamilyPair,
  type Phase1FamilyRecord,
  type Phase1SkuRecord,
  type TechnicalEvidenceLevel,
} from '../data/catalogPhase1Reconstruction';

export interface IncomingProductAuditInput {
  skuCode: string;
  productName: string;
  size?: string;
  unit?: string;
  technicalTypeHint?: string;
  categoryNameHint?: string;
  submenuHint?: string;
  requestedTargetFamilyId?: string;
}

export interface CandidateFamilyMatch {
  familyId: string;
  engineeringFamilyName: string;
  compatibilityScore: number;
  compatible: boolean;
  incompatibilityReasons: string[];
}

export interface SimilarProductSuggestion {
  skuCode: string;
  productName: string;
  brand: string;
  familyId: string | null;
  sharedProfileAndSize: string;
  reason: string;
}

export interface AiFamilyAuditVerdict {
  skuCode: string;
  standardizedName: string;
  englishName: string;
  extractedBrand: string;
  manufacturer: string;
  manufacturerPartNumber: string;
  productType: string;
  material: string;
  construction: string;
  profile: string;
  standard: string;
  unit: string;
  identitySpecifications: Record<string, string | number | null>;
  variableSpecifications: Record<string, string | number | null>;
  descriptiveSpecifications: Record<string, string | number | null>;
  proposedCategorySlug: string;
  proposedCategoryName: string;
  proposedSubmenu: string;
  proposedLeaf: string | null;
  mainGroupId: string;
  mainGroupName: string;
  familyTypeId: string;
  familyTypeName: string;
  researchEvidence: TechnicalEvidenceLevel;
  sourceUrl: string;
  confidenceScore: number;
  recommendedAction:
    | 'JOIN_EXISTING_FAMILY'
    | 'PROMOTE_DIRECT_TO_NEW_FAMILY'
    | 'CREATE_DIRECT_PRODUCT'
    | 'QUARANTINE_UNRESOLVED'
    | 'REJECT_INCOMPATIBLE_TARGET_FAMILY';
  recommendedFamilyId: string | null;
  recommendedFamilyName: string | null;
  duplicateFamilyPrevented: boolean;
  flaggedTechnicalConflicts: string[];
  candidateFamilyEvaluations: CandidateFamilyMatch[];
  suggestedSimilarProducts: SimilarProductSuggestion[];
  requiresAdminApproval: boolean;
  adminApprovalReason: string | null;
  engineeringExplanation: string;
}

/**
 * Stage 12 — AI Family Auditor Engine
 *
 * Deterministically audits any new or updated industrial SKU before insertion into the catalog:
 * 1. Extracts 3-tier specifications (Family Identity, SKU Variable, Descriptive).
 * 2. Resolves manufacturer, MPN, international standard (ISO/DIN/RMA), and verified 67-leaf path.
 * 3. Evaluates existing families and standalone direct products to prevent duplicate families.
 * 4. Rejects incompatible merges (brand, material, construction, profile, pitch, tooth geometry, unit).
 * 5. Suggests cross-brand equivalents as SIMILAR_PRODUCT without merging them into the same family.
 * 6. Enforces mandatory Admin Review when confidence < 85 or any conflict/ambiguity is present.
 */
export function auditIncomingCatalogProduct(
  input: IncomingProductAuditInput,
  existingFamilies: Phase1FamilyRecord[],
  existingSkus: Phase1SkuRecord[]
): AiFamilyAuditVerdict {
  const classified = classifySingleIncomingSku({
    skuCode: input.skuCode,
    productName: input.productName,
    size: input.size,
    unit: input.unit,
    technicalTypeHint: input.technicalTypeHint,
    categoryNameHint: input.categoryNameHint,
    submenuHint: input.submenuHint,
  });

  const flaggedTechnicalConflicts: string[] = [];
  const candidateFamilyEvaluations: CandidateFamilyMatch[] = [];

  // Build synthetic sample SKU for each existing family to run strict pairwise engineering validation
  const skuByCode = new Map<string, Phase1SkuRecord>();
  for (const s of existingSkus) {
    skuByCode.set(s.skuCode, s);
  }

  let exactMatchingFamily: Phase1FamilyRecord | null = null;

  for (const fam of existingFamilies) {
    const sampleMember = skuByCode.get(fam.memberSkuCodes[0]);
    if (!sampleMember) continue;

    const evalRes = evaluateCandidateFamilyPair(classified, sampleMember);
    if (evalRes.compatible) {
      exactMatchingFamily = fam;
      candidateFamilyEvaluations.push({
        familyId: fam.familyId,
        engineeringFamilyName: fam.engineeringFamilyName,
        compatibilityScore: 100,
        compatible: true,
        incompatibilityReasons: [],
      });
    } else if (
      fam.categorySlug === classified.proposedCategorySlug &&
      (fam.productType === classified.productType || fam.profile === classified.profile)
    ) {
      const score = Math.max(0, 100 - evalRes.reasons.length * 25);
      candidateFamilyEvaluations.push({
        familyId: fam.familyId,
        engineeringFamilyName: fam.engineeringFamilyName,
        compatibilityScore: score,
        compatible: false,
        incompatibilityReasons: evalRes.reasons,
      });
    }
  }

  // If caller requested a specific target family, verify whether it is compatible
  if (input.requestedTargetFamilyId) {
    const requestedFam = existingFamilies.find((f) => f.familyId === input.requestedTargetFamilyId);
    if (requestedFam) {
      const sampleMember = skuByCode.get(requestedFam.memberSkuCodes[0]);
      if (sampleMember) {
        const check = evaluateCandidateFamilyPair(classified, sampleMember);
        if (!check.compatible) {
          flaggedTechnicalConflicts.push(
            `TARGET_FAMILY_CONFLICT(${requestedFam.familyId}): ${check.reasons.join(', ')}`
          );
        }
      }
    }
  }

  // Check if an existing DIRECT_PRODUCT shares the exact same invariantKey (preventing duplicate singleton vs family)
  const matchingDirectProduct =
    classified.familyDecision !== 'UNRESOLVED'
      ? existingSkus.find(
          (s) =>
            s.skuCode !== classified.skuCode &&
            s.finalStatus === 'DIRECT_PRODUCT' &&
            s.invariantKey === classified.invariantKey
        ) || null
      : null;

  // Find cross-brand SIMILAR_PRODUCT suggestions (same productType, profile, material, unit, and size, different brand)
  const normSize = (classified.originalSize || '').trim().toUpperCase();
  const suggestedSimilarProducts: SimilarProductSuggestion[] = [];
  if (normSize && normSize !== 'نامشخص' && normSize !== 'استاندارد') {
    for (const other of existingSkus) {
      if (other.skuCode === classified.skuCode || other.finalStatus === 'UNRESOLVED') continue;
      const otherSize = (other.originalSize || '').trim().toUpperCase();
      if (
        otherSize === normSize &&
        other.productType === classified.productType &&
        other.profile === classified.profile &&
        other.material === classified.material &&
        other.unit === classified.unit &&
        other.brand !== classified.brand
      ) {
        suggestedSimilarProducts.push({
          skuCode: other.skuCode,
          productName: other.originalProductName,
          brand: other.brand,
          familyId: other.proposedFamily,
          sharedProfileAndSize: `${classified.profile} | ${normSize}`,
          reason: `معادل عملکردی از برند ${other.brand} با پروفیل و سایز یکسان (${classified.profile} - ${normSize}). طبق قانون عدم اختلاط برند، در خانواده یکسان ادغام نمی‌شود و به عنوان کالای مشابه (SIMILAR_PRODUCT) پیشنهاد می‌گردد.`,
        });
        if (suggestedSimilarProducts.length >= 10) break;
      }
    }
  }

  // Determine recommended action
  let recommendedAction: AiFamilyAuditVerdict['recommendedAction'];
  let recommendedFamilyId: string | null = null;
  let recommendedFamilyName: string | null = null;
  let duplicateFamilyPrevented = false;

  if (classified.familyDecision === 'UNRESOLVED' || classified.confidenceScore < 70) {
    recommendedAction = 'QUARANTINE_UNRESOLVED';
    flaggedTechnicalConflicts.push('INSUFFICIENT_TECHNICAL_IDENTITY_FOR_PUBLIC_CATALOG');
  } else if (flaggedTechnicalConflicts.length > 0) {
    recommendedAction = 'REJECT_INCOMPATIBLE_TARGET_FAMILY';
    if (exactMatchingFamily) {
      recommendedFamilyId = exactMatchingFamily.familyId;
      recommendedFamilyName = exactMatchingFamily.engineeringFamilyName;
    }
  } else if (exactMatchingFamily) {
    recommendedAction = 'JOIN_EXISTING_FAMILY';
    recommendedFamilyId = exactMatchingFamily.familyId;
    recommendedFamilyName = exactMatchingFamily.engineeringFamilyName;
    duplicateFamilyPrevented = true;
  } else if (matchingDirectProduct) {
    recommendedAction = 'PROMOTE_DIRECT_TO_NEW_FAMILY';
    recommendedFamilyId = `PFAM-AUTO-${classified.profile}-${classified.skuCode}`;
    recommendedFamilyName = `${classified.productType} | برند ${classified.brand} | جنس ${classified.material} | پروفیل/سری ${classified.profile} (${classified.unit})`;
    duplicateFamilyPrevented = true;
  } else {
    recommendedAction = 'CREATE_DIRECT_PRODUCT';
  }

  const requiresAdminApproval =
    classified.confidenceScore < 85 ||
    recommendedAction === 'QUARANTINE_UNRESOLVED' ||
    recommendedAction === 'REJECT_INCOMPATIBLE_TARGET_FAMILY' ||
    Boolean(classified.taxonomyGap);

  const adminApprovalReason = requiresAdminApproval
    ? classified.confidenceScore < 70
      ? 'امتیاز اطمینان کمتر از ۷۰ (اطلاعات فنی ناقص — قرنطینه UNRESOLVED)'
      : flaggedTechnicalConflicts.length > 0
        ? `تعارض فنی با خانواده هدف: ${flaggedTechnicalConflicts.join(' | ')}`
        : classified.taxonomyGap
          ? `نیازمند تایید زیرشاخه منو: ${classified.taxonomyGap}`
          : `امتیاز اطمینان در بازه بررسی انسانی (${classified.confidenceScore}/100 < 85)`
    : null;

  return {
    skuCode: classified.skuCode,
    standardizedName: classified.normalizedProductName,
    englishName: classified.englishProductName,
    extractedBrand: classified.brand,
    manufacturer: classified.manufacturer,
    manufacturerPartNumber: classified.manufacturerPartNumber,
    productType: classified.productType,
    material: classified.material,
    construction: classified.construction,
    profile: classified.profile,
    standard: classified.standard,
    unit: classified.unit,
    identitySpecifications: classified.identitySpecifications,
    variableSpecifications: classified.variableSpecifications,
    descriptiveSpecifications: classified.descriptiveSpecifications,
    proposedCategorySlug: classified.proposedCategorySlug,
    proposedCategoryName: classified.proposedCategory,
    proposedSubmenu: classified.proposedSubmenu,
    proposedLeaf: classified.proposedLeaf,
    mainGroupId: classified.mainGroupId,
    mainGroupName: classified.mainGroupName,
    familyTypeId: classified.familyTypeId,
    familyTypeName: classified.familyTypeName,
    researchEvidence: classified.technicalEvidence,
    sourceUrl: classified.sourceUrl,
    confidenceScore: classified.confidenceScore,
    recommendedAction,
    recommendedFamilyId,
    recommendedFamilyName,
    duplicateFamilyPrevented,
    flaggedTechnicalConflicts,
    candidateFamilyEvaluations: candidateFamilyEvaluations.slice(0, 10),
    suggestedSimilarProducts,
    requiresAdminApproval,
    adminApprovalReason,
    engineeringExplanation: classified.decisionReason,
  };
}
