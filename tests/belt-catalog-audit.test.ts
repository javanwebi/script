import './catalogFixtures';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import imperialRef from './fixtures/imperialTimingReference.json';
import misumiRef from './fixtures/misumiTimingReference.json';
import { USER_PRODUCTS_RAW } from '../src/data/userProducts';
import {
  runBeltCatalogAudit,
  validateFamilyEngineeringHomogeneity,
  findIdenticalInvariantMergeCandidates,
  type ProposedBeltFamilyRecord,
} from '../src/data/beltCatalogAudit';
import { getFamilyMenuAssignment } from '../src/services/catalogTaxonomyResolver';
import { readLiveDatabaseDifferences } from '../scripts/audit-belt-catalog';

const refs = {
  imperialTimingLengths: new Set(Object.keys(imperialRef.lengths)),
  misumiHLengths: new Set(Object.keys(misumiRef.lengths)),
};

const audit = runBeltCatalogAudit(USER_PRODUCTS_RAW, refs);
const bySku = new Map(audit.reportA_skuClassifications.map((r) => [r.sku, r] as const));
const byFamilySkus = new Map<string, typeof audit.reportA_skuClassifications>();
for (const r of audit.reportA_skuClassifications) {
  const arr = byFamilySkus.get(r.proposedFamilyId) || [];
  arr.push(r);
  byFamilySkus.set(r.proposedFamilyId, arr);
}

test('audit accounts for all 1,383 raw families, 10,435 SKUs, and exact 634 + 2 + 4 + 7 = 647 group separation', () => {
  assert.equal(audit.totalCatalogFamilies, 1383);
  assert.equal(audit.totalCatalogSkus, 10435);
  assert.equal(audit.auditedSkuCount, 7709);
  assert.equal(audit.reconciliationPartition.partitionTotal, audit.auditedSkuCount);

  assert.deepEqual(audit.groupCounts, {
    validBeltAndConveyorFamilies: 634,
    singletonValidBeltFamilies: 247,
    multiMemberValidBeltFamilies: 387,
    weldingToolGroups: 2,
    provisionalReviewGroups: 4,
    separatedNonBeltFamilies: 7,
    totalProposedGroups: 647,
  });
  assert.equal(audit.afterProposedBeltFamilyCount, 634);
  assert.equal(audit.reportB_proposedFamilies.length, 647);

  const tierSum = Object.values(audit.verificationTierCounts).reduce((a, b) => a + b, 0);
  const tier7Sum = Object.values(audit.sevenLevelEvidenceCounts).reduce((a, b) => a + b, 0);
  const confSum = Object.values(audit.confidenceCounts).reduce((a, b) => a + b, 0);
  const actSum = Object.values(audit.actionCounts).reduce((a, b) => a + b, 0);
  assert.equal(tierSum, 7709);
  assert.equal(tier7Sum, 7709);
  assert.equal(confSum, 7709);
  assert.equal(actSum, 7709);

  // Official evidence is counted separately: exact SKU datasheets + manufacturer series catalogs.
  const siteChecked = audit.reportA_skuClassifications.filter((r) => r.verification.officialManufacturerSiteChecked).length;
  const dsChecked = audit.reportA_skuClassifications.filter((r) => r.verification.datasheetOrCatalogChecked).length;
  const exactVerified = audit.confidenceCounts.DATASHEET_VERIFIED;
  const seriesVerified = audit.confidenceCounts.SERIES_VERIFIED;
  assert.equal(exactVerified, 0, 'No exact manufacturer article-number datasheet match is established in this pass');
  assert.ok(seriesVerified >= 2058, `Expected broad official series coverage, received ${seriesVerified}`);
  assert.equal(siteChecked, exactVerified + seriesVerified);
  assert.equal(dsChecked, exactVerified + seriesVerified);
  assert.ok(audit.confidenceCounts.NOMINAL_TABLE_VERIFIED > 0);
  assert.ok(audit.confidenceCounts.NOMINAL_TABLE_VERIFIED <= 1141);
  assert.equal(audit.confidenceCounts.ALGORITHMIC_STANDARD_ONLY,
    7709 - exactVerified - seriesVerified - audit.confidenceCounts.NOMINAL_TABLE_VERIFIED -
      audit.confidenceCounts.INVENTORY_DESCRIPTION_ONLY - audit.confidenceCounts.REQUIRES_REVIEW);
  assert.equal(audit.confidenceCounts.REQUIRES_REVIEW, 9);

  // Every SKU record must carry an explicit sourceUrl & documentType, and DATASHEET_VERIFIED requires same-brand match
  for (const r of audit.reportA_skuClassifications) {
    assert.ok(r.verification.sourceUrl && r.verification.sourceUrl.trim().length > 0, `Missing sourceUrl on SKU ${r.sku}`);
    assert.ok(r.verification.documentType && r.verification.documentType.trim().length > 0, `Missing documentType on SKU ${r.sku}`);
    if (r.confidence === 'DATASHEET_VERIFIED') {
      assert.equal(r.verification.documentType, 'MANUFACTURER_DATASHEET');
      assert.equal(r.verification.officialManufacturerSiteChecked, true);
      assert.equal(r.verification.datasheetOrCatalogChecked, true);
      assert.equal(r.verification.matchedManufacturer, r.detectedBrand);
    } else if (r.confidence === 'SERIES_VERIFIED') {
      assert.equal(r.verification.documentType, 'SERIES_CATALOG');
      assert.equal(r.verification.evidenceClass7, '2_Official_Catalog_Verified');
      assert.equal(r.verification.officialManufacturerSiteChecked, true);
      assert.equal(r.verification.datasheetOrCatalogChecked, true);
      assert.ok(/^https:\/\//i.test(r.verification.sourceUrl));
      assert.equal(r.verification.matchedManufacturer, r.detectedBrand);
    } else {
      assert.equal(r.verification.officialManufacturerSiteChecked, false, `SKU ${r.sku} must not claim official site checked`);
      assert.equal(r.verification.datasheetOrCatalogChecked, false, `SKU ${r.sku} must not claim datasheet checked`);
    }
  }

  // Welding clamps must honestly be INTERNAL_DB_CATALOG_ONLY
  assert.equal(bySku.get('110049')?.verification.tier, 'INTERNAL_DB_CATALOG_ONLY');
  assert.equal(bySku.get('35852')?.verification.tier, 'INTERNAL_DB_CATALOG_ONLY');
  assert.equal(bySku.get('110049')?.verification.datasheetOrCatalogChecked, false);

  assert.equal(audit.nonBeltInsideBeltCategoryCount, 24);
  assert.equal(audit.nonConveyorInsideConveyorCategoryCount, 32);
  assert.ok(audit.misplacedBeltOutsideBeltCategoryCount >= 45);
  assert.ok(audit.catchAllIndustrialBeltResolvedCount >= 1180);
});

test('all 647 groups pass strict invariant homogeneity checks with zero MIXED invariants and explicit N/A vs UNKNOWN distinction', () => {
  const results = audit.reportB_proposedFamilies.map((fam) => {
    const members = byFamilySkus.get(fam.proposedFamilyId) || [];
    assert.equal(members.length, fam.skuCount);
    return validateFamilyEngineeringHomogeneity(fam, members);
  });

  // Zero FAIL_MIXED_INVARIANT across the entire catalog
  const mixed = results.filter((v) => v.homogeneityVerdict === 'FAIL_MIXED_INVARIANT');
  assert.equal(mixed.length, 0, `Unexpected FAIL_MIXED families: ${mixed.map((m) => m.proposedFamilyId).join(', ')}`);

  // Never output fake '100%_PASS'
  for (const v of results) {
    assert.notEqual(v.verdictDetail, '100%_PASS');
  }

  // N/A vs UNKNOWN separation:
  // 1. Classical V-belt (B) has 40-deg wedge angle (OK_INVARIANT) and marks pitch/toothHeight/covering as NOT_APPLICABLE, never UNKNOWN
  const vbeltRes = results.find((v) => v.proposedFamilyId === 'FAM-VBELT-B-STD-BANDO');
  assert.ok(vbeltRes);
  assert.equal(vbeltRes.pitchCheck, 'NOT_APPLICABLE');
  assert.equal(vbeltRes.toothAngleCheck, 'OK_INVARIANT');
  assert.equal(vbeltRes.toothHeightCheck, 'NOT_APPLICABLE');
  assert.equal(vbeltRes.coveringCheck, 'NOT_APPLICABLE');
  assert.equal(vbeltRes.homogeneityVerdict, 'PASS_HOMOGENEOUS');
  assert.equal(vbeltRes.passedStrictValidation, true);

  // 2. Automotive RU 9.525mm timing belt (curved tooth => toothAngle NOT_APPLICABLE) has UNKNOWN toothHeightMm & beltThicknessMm, so it MUST NOT pass as PASS_HOMOGENEOUS
  const autoRuRes = results.find((v) => v.proposedFamilyId === 'FAM-TIMING-AUTO-RU-9P5-OPTIBELT');
  assert.ok(autoRuRes);
  assert.equal(autoRuRes.toothAngleCheck, 'NOT_APPLICABLE');
  assert.equal(autoRuRes.toothHeightCheck, 'UNKNOWN');
  assert.equal(autoRuRes.beltThicknessCheck, 'UNKNOWN');
  assert.equal(autoRuRes.passedStrictValidation, false);
  assert.equal(autoRuRes.homogeneityVerdict, 'CONDITIONAL_UNKNOWN_SPECS');

  // 3. Conveyor grip belt has variable beltThicknessMm (ALLOWED) + unspecified brand => CONDITIONAL_UNKNOWN_SPECS
  const gripRes = results.find((v) => v.proposedFamilyId === 'FAM-CONVEYOR-GRIP');
  assert.ok(gripRes);
  assert.equal(gripRes.brandCheck, 'UNKNOWN');
  assert.equal(gripRes.passedStrictValidation, false);
  assert.equal(gripRes.homogeneityVerdict, 'CONDITIONAL_UNKNOWN_SPECS');

  // Welded PU CRC vs ROUND, steel-cord TPU vs Neoprene, and conveyor thickness sanity checks
  assert.equal(bySku.get('37828')?.technical.profile, 'CRC');
  assert.equal(bySku.get('36859')?.technical.profile, 'ROUND');
  assert.equal(bySku.get('52640')?.technical.profile, 'A');
  assert.equal(bySku.get('41121')?.technical.bodyMaterial.includes('TPU'), true);
  assert.notEqual(bySku.get('41121')?.proposedFamilyId, bySku.get('10203')?.proposedFamilyId);
  assert.equal(bySku.get('31501')?.detectedBrand, 'OPTIBELT');
  assert.equal(bySku.get('36822')?.technical.beltThicknessMm, null);
  assert.equal(bySku.get('36822')?.technical.nominalWidthMm, 470);
  assert.equal(bySku.get('36527')?.confidence, 'ALGORITHMIC_STANDARD_ONLY');
  assert.equal(bySku.get('36527')?.technical.supplyForm, 'open-ended-meter');
});

test('negative engineering validation tests reject null/unknown invariant specs and mixed invariants', () => {
  const sampleFamily = audit.reportB_proposedFamilies.find((f) => f.proposedFamilyId === 'FAM-TIMING-IMP-H-ENDLESS-STD-BANDO')!;
  const sampleMembers = (byFamilySkus.get('FAM-TIMING-IMP-H-ENDLESS-STD-BANDO') || []).slice(0, 2);
  assert.equal(sampleMembers.length, 2);

  // Case A: NULL toothHeightMm on a timing belt must NOT pass strict validation
  const nullToothMembers = sampleMembers.map((m, idx) =>
    idx === 1
      ? {
          ...m,
          technical: {
            ...m.technical,
            toothHeightMm: null,
          },
        }
      : m
  );
  const resNull = validateFamilyEngineeringHomogeneity(sampleFamily, nullToothMembers);
  assert.equal(resNull.passedStrictValidation, false);
  assert.equal(resNull.toothHeightCheck, 'UNKNOWN');
  assert.notEqual(resNull.homogeneityVerdict, 'PASS_HOMOGENEOUS');

  // Case B: Conflicting beltThicknessMm across members must fail as FAIL_MIXED_INVARIANT
  const mixedThicknessMembers = sampleMembers.map((m, idx) =>
    idx === 1
      ? {
          ...m,
          technical: {
            ...m.technical,
            beltThicknessMm: 5.94,
          },
        }
      : m
  );
  const resMixed = validateFamilyEngineeringHomogeneity(sampleFamily, mixedThicknessMembers);
  assert.equal(resMixed.passedStrictValidation, false);
  assert.equal(resMixed.beltThicknessCheck, 'FAIL_MIXED');
  assert.equal(resMixed.homogeneityVerdict, 'FAIL_MIXED_INVARIANT');
  assert.ok(resMixed.mixedAttributes.includes('beltThicknessMm'));
});

test('BANDO 10538 (1400 H 100) and 36103 (1140H100) are series-verified as single-sided H timing belts, not exact SKU datasheets', () => {
  const s10538 = bySku.get('10538');
  const s36103 = bySku.get('36103');
  assert.ok(s10538, 'SKU 10538 must exist');
  assert.ok(s36103, 'SKU 36103 must exist');

  assert.equal(s10538.detectedBrand, 'BANDO');
  assert.equal(s36103.detectedBrand, 'BANDO');
  assert.equal(s10538.confidence, 'SERIES_VERIFIED');
  assert.equal(s36103.confidence, 'SERIES_VERIFIED');
  assert.equal(s10538.verification.documentType, 'SERIES_CATALOG');
  assert.equal(s10538.verification.matchedManufacturer, 'BANDO');
  assert.ok(s10538.verification.sourceUrl.includes('bandousa.com'));
  assert.equal(s10538.verification.officialManufacturerSiteChecked, true);
  assert.equal(s10538.technical.profile, 'H');
  assert.equal(s36103.technical.profile, 'H');
  assert.equal(s10538.technical.sidedness, 'single-sided');
  assert.equal(s36103.technical.sidedness, 'single-sided');
  assert.equal(s10538.technical.supplyForm, 'endless-loop');
  assert.equal(s36103.technical.supplyForm, 'endless-loop');
  assert.equal(s10538.technical.pitchMm, 12.7);
  assert.equal(s36103.technical.pitchMm, 12.7);
  assert.equal(s10538.technical.pitchLengthMm, 3556);
  assert.equal(s10538.technical.toothCount, 280);
  assert.equal(s10538.technical.nominalWidthMm, 25.4);
  assert.equal(s36103.technical.pitchLengthMm, 2895.6);
  assert.equal(s36103.technical.toothCount, 228);
  assert.equal(s36103.technical.nominalWidthMm, 25.4);

  assert.equal(s10538.proposedFamilyId, 'FAM-TIMING-IMP-H-ENDLESS-STD-BANDO');
  assert.equal(s36103.proposedFamilyId, 'FAM-TIMING-IMP-H-ENDLESS-STD-BANDO');
  assert.equal(s10538.proposedCategorySlug, 'excel-v2-1-1');
  assert.equal(s10538.proposedLeaf, 'H , XH , L , XL');
});

test('BANDO DH double-sided timing belts (36468, 10111, 41291, 41598, 41689) never merge with single-sided H and split cleanly into endless loops vs uncut sleeves', () => {
  const endlessSkus = ['10111', '41291', '41598', '41689', '36636', '41322'];
  const sleeveSkus = ['36468', '39994', '41349'];

  for (const sku of endlessSkus) {
    const rec = bySku.get(sku);
    assert.ok(rec, `Missing BANDO DH endless SKU ${sku}`);
    assert.equal(rec.detectedBrand, 'BANDO');
    assert.equal(rec.verification.documentType, 'SERIES_CATALOG');
    assert.ok(rec.verification.sourceUrl.includes('bandousa.com'));
    assert.equal(rec.confidence, 'SERIES_VERIFIED');
    assert.equal(rec.technical.profile, 'DH');
    assert.equal(rec.technical.sidedness, 'double-sided');
    assert.equal(rec.technical.supplyForm, 'endless-loop');
    assert.equal(rec.technical.pitchMm, 12.7);
    assert.equal(rec.technical.beltThicknessMm, 5.94);
    assert.equal(rec.proposedFamilyId, 'FAM-TIMING-IMP-DH-ENDLESS-STD-BANDO');
    assert.notEqual(rec.proposedFamilyId, 'FAM-TIMING-IMP-H-ENDLESS-STD-BANDO');
    assert.ok(rec.taxonomyGap?.startsWith('GAP-TIMING-DOUBLE-SIDED'));
  }

  for (const sku of sleeveSkus) {
    const rec = bySku.get(sku);
    assert.ok(rec, `Missing BANDO DH sleeve SKU ${sku}`);
    assert.equal(rec.detectedBrand, 'BANDO');
    assert.equal(rec.verification.documentType, 'SERIES_CATALOG');
    assert.ok(rec.verification.sourceUrl.includes('bandousa.com'));
    assert.equal(rec.confidence, 'SERIES_VERIFIED');
    assert.equal(rec.technical.profile, 'DH');
    assert.equal(rec.technical.sidedness, 'double-sided');
    assert.equal(rec.technical.supplyForm, 'uncut-sleeve');
    assert.equal(rec.proposedFamilyId, 'FAM-TIMING-IMP-DH-SLEEVE-STD-BANDO');
    assert.notEqual(rec.proposedFamilyId, 'FAM-TIMING-IMP-DH-ENDLESS-STD-BANDO');
  }
});

test('automotive timing belts, cross-reference-only RU codes, official series catalogs, and unsupported labels have honest provenance', () => {
  // Optibelt AUTO-RU is series-level only: the official product range identifies ZRK, not this exact stock article.
  const s31501 = bySku.get('31501');
  assert.equal(s31501?.technical.beltDivision, 'timing-automotive-ru');
  assert.equal(s31501?.technical.toothCount, 108);
  assert.equal(s31501?.technical.nominalWidthMm, 17);
  assert.equal(s31501?.confidence, 'SERIES_VERIFIED');
  assert.equal(s31501?.verification.documentType, 'SERIES_CATALOG');
  assert.match(s31501?.verification.evidenceBasis ?? '', /ZRK.*not carry.*article/i);

  // 42209 has no verified stock manufacturer; JIKIU is a nominal cross-reference source, not its brand.
  const s42209 = bySku.get('42209');
  assert.equal(s42209?.technical.beltDivision, 'timing-automotive-ru');
  assert.equal(s42209?.technical.toothCount, 123);
  assert.equal(s42209?.technical.nominalWidthMm, 24);
  assert.equal(s42209?.confidence, 'NOMINAL_TABLE_VERIFIED');
  assert.equal(s42209?.verification.documentType, 'NOMINAL_REFERENCE_TABLE');
  assert.equal(s42209?.verification.matchedManufacturer, null);
  assert.ok(s42209?.verification.sourceUrl.includes('jikiu.jp'));
  assert.equal(s42209?.verification.officialManufacturerSiteChecked, false);
  assert.equal(s42209?.verification.datasheetOrCatalogChecked, false);

  // Four RU cross-reference candidates still require physical ZRK marking; never call them exact datasheets.
  for (const pendingZrk of ['31502', '31504', '31505', '31506']) {
    const rec = bySku.get(pendingZrk);
    assert.equal(rec?.confidence, 'NOMINAL_TABLE_VERIFIED');
    assert.equal(rec?.verification.officialManufacturerSiteChecked, false);
    assert.equal(rec?.verification.datasheetOrCatalogChecked, false);
  }

  // The 8 mm AUTO-8MM belt is deliberately not folded into the 9.525 mm ZRK family.
  const s35023 = bySku.get('35023');
  assert.equal(s35023?.technical.pitchMm, 8);
  assert.equal(s35023?.confidence, 'ALGORITHMIC_STANDARD_ONLY');

  // Megadyne PJ section is catalog-supported; TNX itself remains an unverified inventory label.
  const s58129 = bySku.get('58129');
  assert.equal(s58129?.detectedBrand, 'MEGADYNE');
  assert.equal(s58129?.technical.profile, 'PJ');
  assert.equal(s58129?.confidence, 'SERIES_VERIFIED');
  assert.ok(s58129?.verification.sourceUrl.includes('megadynegroup.com'));
  assert.match(s58129?.verification.evidenceBasis ?? '', /TNX.*not.*manufacturer-verified/i);

  // Official profile/series examples across the researched manufacturers.
  const verifiedExamples = [
    ['52798', 'SWR', 'swr-europe.de'],
    ['15970', 'OPTIBELT', 'optibelt.com'],
    ['38872', 'OPTIBELT', 'optibelt.com'],
    ['38083', 'OPTIBELT', 'optibelt.com'],
    ['38893', 'MEGADYNE', 'megadynegroup.com'],
    ['38077', 'MEGADYNE', 'megadynegroup.com'],
    ['36512', 'MEGADYNE', 'megadynegroup.com'],
    ['40331', 'BANDO', 'bandousa.com'],
  ] as const;
  for (const [sku, brand, domain] of verifiedExamples) {
    const rec = bySku.get(sku);
    assert.equal(rec?.detectedBrand, brand, `Unexpected brand for ${sku}`);
    assert.equal(rec?.confidence, 'SERIES_VERIFIED', `Expected official series evidence for ${sku}`);
    assert.ok(rec?.verification.sourceUrl.includes(domain), `Missing official source for ${sku}`);
  }

  // Unsupported profile/brand combinations must remain algorithmic rather than inheriting a nearby catalog.
  for (const sku of ['39861', '32280', '765', '10742']) {
    assert.equal(bySku.get(sku)?.confidence, 'ALGORITHMIC_STANDARD_ONLY', `Unexpected manufacturer evidence for ${sku}`);
  }

  // AA-TOP ribbed belts must all be single-sided and ALGORITHMIC_STANDARD_ONLY.
  const s39216 = bySku.get('39216');
  assert.equal(s39216?.detectedBrand, 'AA-TOP');
  assert.equal(s39216?.technical.sidedness, 'single-sided');
});

test('BANDO SKUs and mixed catch-all family FAM-10111 are split into homogeneous families by profile, sidedness, and supply form', () => {
  const bandoSkus = audit.reportA_skuClassifications.filter((r) => r.detectedBrand === 'BANDO');
  const bandoTargetFamilies = new Set(bandoSkus.map((r) => r.proposedFamilyId));
  assert.ok(bandoTargetFamilies.has('FAM-TIMING-IMP-H-ENDLESS-STD-BANDO'));
  assert.ok(bandoTargetFamilies.has('FAM-TIMING-IMP-DH-ENDLESS-STD-BANDO'));
  assert.ok(bandoTargetFamilies.has('FAM-TIMING-IMP-DH-SLEEVE-STD-BANDO'));
  assert.ok(bandoTargetFamilies.has('FAM-VBELT-B-STD-BANDO'));

  const fam10111Members = audit.reportA_skuClassifications.filter((r) => r.currentFamilyId === 'FAM-10111');
  assert.equal(fam10111Members.length, 7);
  const fam10111TargetFamilies = new Set(fam10111Members.map((r) => r.proposedFamilyId));
  assert.ok(fam10111TargetFamilies.size >= 4);

  const fam80151Members = audit.reportA_skuClassifications.filter((r) => r.currentFamilyId === 'FAM-80151');
  assert.equal(fam80151Members.length, 605);
  const fam80151TargetFamilies = new Set(fam80151Members.map((r) => r.proposedFamilyId));
  assert.ok(fam80151TargetFamilies.size >= 55);
});

test('misplaced belts outside belt categories and non-belts inside belt categories are accurately resolved', () => {
  assert.equal(bySku.get('34064')?.proposedCategorySlug, 'excel-v2-1-1');
  assert.equal(bySku.get('58129')?.proposedCategorySlug, 'excel-v2-1-2');
  assert.equal(bySku.get('58122')?.proposedCategorySlug, 'excel-v2-1-1');
  assert.equal(bySku.get('58132')?.proposedCategorySlug, 'excel-v2-1-1');
  assert.equal(bySku.get('35198')?.proposedCategorySlug, 'excel-v2-1-2');
  assert.equal(bySku.get('33126')?.proposedCategorySlug, 'excel-v2-1-1');
  assert.equal(bySku.get('31222')?.proposedCategorySlug, 'excel-v2-1-2');
  assert.equal(bySku.get('33328')?.proposedCategorySlug, 'excel-v2-1-2');
  assert.equal(bySku.get('37541')?.proposedCategorySlug, 'excel-v2-1-2');
  assert.equal(bySku.get('41121')?.proposedCategorySlug, 'excel-v2-1-1');
  assert.equal(bySku.get('38161')?.proposedCategorySlug, 'excel-v2-1-1');
  assert.equal(bySku.get('110049')?.proposedCategorySlug, 'excel-v2-1-4');

  // Non-belts inside belt/conveyor categories (including 35712 scraper holder and 32711 tensioner)
  assert.equal(bySku.get('10415')?.technical.operatingPrinciple, 'non-belt');
  assert.equal(bySku.get('34975')?.technical.operatingPrinciple, 'non-belt');
  assert.equal(bySku.get('41169')?.technical.operatingPrinciple, 'non-belt');
  assert.equal(bySku.get('80073')?.technical.operatingPrinciple, 'non-belt');
  assert.equal(bySku.get('40686')?.technical.operatingPrinciple, 'non-belt');
  assert.equal(bySku.get('35712')?.technical.operatingPrinciple, 'non-belt');
  assert.equal(bySku.get('32711')?.technical.operatingPrinciple, 'non-belt');

  // Pre-approval audit targets + untouched live taxonomy check
  assert.equal(bySku.get('10111')?.proposedLeaf, 'H , XH , L , XL');
  assert.equal(bySku.get('36103')?.proposedLeaf, 'H , XH , L , XL');
  assert.equal(bySku.get('22751')?.proposedCategorySlug, 'excel-v2-1-2');
  assert.equal(bySku.get('35198')?.proposedCategorySlug, 'excel-v2-1-2');
  assert.equal(getFamilyMenuAssignment('FAM-34064')?.categorySlug, 'excel-v2-1-1');
});

test('pre-approval brand cleanup extracts hidden brands, fixes EHRE/typos, and keeps suspected aliases separate', () => {
  assert.equal(bySku.get('41777')?.detectedBrand, 'EHRE');
  assert.equal(bySku.get('41554')?.detectedBrand, 'EHRE');
  assert.equal(bySku.get('50151')?.detectedBrand, 'MITSUBOSHI');
  assert.equal(bySku.get('27416')?.detectedBrand, 'FEDERAL');
  assert.equal(bySku.get('40106')?.detectedBrand, 'FLYPARD');
  assert.equal(bySku.get('40781')?.detectedBrand, 'FIRST');
  assert.equal(bySku.get('40782')?.detectedBrand, 'FIRST');
  assert.equal(bySku.get('40101')?.detectedBrand, 'REZEX');
  assert.equal(bySku.get('40102')?.detectedBrand, 'REZEX');
  assert.equal(bySku.get('50143')?.detectedBrand, 'TECHNO');
  assert.equal(bySku.get('23378')?.detectedBrand, 'TECHNO');
  assert.equal(bySku.get('22743')?.detectedBrand, 'JAGER');
  assert.equal(bySku.get('41292')?.detectedBrand, 'PERSON');

  // Typo aliases normalized accurately
  assert.equal(bySku.get('41201')?.detectedBrand, 'INTROTECH');
  assert.equal(bySku.get('41202')?.detectedBrand, 'INTROTECH');
  assert.equal(bySku.get('23662')?.detectedBrand, 'DRAUDA');
  assert.equal(bySku.get('50142')?.detectedBrand, 'YANGSAN');
  assert.equal(bySku.get('52307')?.detectedBrand, 'HANCHANG');
  assert.equal(bySku.get('36543')?.detectedBrand, 'MITSUBISHI');
  assert.equal(bySku.get('41529')?.detectedBrand, 'SEMPERIT');
  assert.equal(bySku.get('40453')?.detectedBrand, 'POWER');

  // Suspected aliases NOT merged without invoice proof
  assert.notEqual(
    audit.reportA_skuClassifications.find((r) => r.detectedBrand === 'ENTRO')?.detectedBrand,
    audit.reportA_skuClassifications.find((r) => r.detectedBrand === 'ENTEROTECH')?.detectedBrand
  );
  assert.notEqual(
    audit.reportA_skuClassifications.find((r) => r.detectedBrand === 'TECHNO')?.detectedBrand,
    audit.reportA_skuClassifications.find((r) => r.detectedBrand === 'TEKNO')?.detectedBrand
  );
  // Zero EHER leftovers
  assert.equal(audit.reportA_skuClassifications.filter((r) => r.detectedBrand === 'EHER').length, 0);
});

test('8 Optibelt ZRK SKUs are resolved accurately and dynamic singleton duplicate detector flags identical invariants', () => {
  const zrk95Skus = ['31502', '31504', '31505', '31506', '31769', '34722', '35232'];
  for (const sku of zrk95Skus) {
    const rec = bySku.get(sku);
    assert.ok(rec, `Missing ZRK SKU ${sku}`);
    assert.equal(rec.technical.pitchMm, 9.525, `SKU ${sku} must be 9.525mm pitch`);
    assert.equal(rec.proposedFamilyId, 'FAM-TIMING-AUTO-RU-9P5-OPTIBELT');
  }
  assert.equal(bySku.get('34722')?.technical.toothCount, 127);
  assert.equal(bySku.get('34722')?.technical.nominalWidthMm, 25);
  assert.equal(bySku.get('35232')?.technical.toothCount, 123);
  assert.equal(bySku.get('35232')?.technical.nominalWidthMm, 29);

  // 35023 (65 * 12.7) = Optibelt ZRK 1459 / ContiTech CT1039 / MD182295 => 8.000mm pitch!
  const s35023 = bySku.get('35023');
  assert.ok(s35023);
  assert.equal(s35023.technical.pitchMm, 8);
  assert.equal(s35023.technical.toothCount, 65);
  assert.equal(s35023.technical.nominalWidthMm, 12.7);
  assert.equal(s35023.technical.pitchLengthMm, 520);
  assert.equal(s35023.proposedFamilyId, 'FAM-TIMING-AUTO-8MM-OPTIBELT');
  assert.notEqual(s35023.proposedFamilyId, 'FAM-TIMING-AUTO-RU-9P5-OPTIBELT');

  // Exactly 9 physical-review blockers remain
  const reviewSkus = audit.reportA_skuClassifications.filter((r) => r.confidence === 'REQUIRES_REVIEW').map((r) => r.sku);
  assert.equal(reviewSkus.length, 9);

  // Dynamic singleton check across all 247 valid singletons => 0 identical merge candidates
  const validFams = audit.reportB_proposedFamilies.filter(
    (f) => !f.beltDivision.startsWith('non-belt-') && f.beltDivision !== 'belt-welding-tool' && f.beltDivision !== 'service-ambiguous'
  );
  assert.equal(validFams.length, 634);
  const singletons = validFams.filter((f) => f.skuCount === 1);
  assert.equal(singletons.length, 247);
  for (const s of singletons) {
    const dup = findIdenticalInvariantMergeCandidates(s, validFams);
    assert.equal(dup.identicalMergeCandidateCount, 0, `Singleton ${s.proposedFamilyId} unexpectedly matched ${dup.identicalCandidateIds.join(', ')}`);
  }

  // Negative synthetic duplicate singleton check: two identical-spec families MUST yield identicalMergeCandidateCount === 1
  const synthA: ProposedBeltFamilyRecord = { ...singletons[0], proposedFamilyId: 'SYNTH-DUP-A' };
  const synthB: ProposedBeltFamilyRecord = { ...singletons[0], proposedFamilyId: 'SYNTH-DUP-B' };
  const dupRes = findIdenticalInvariantMergeCandidates(synthA, [synthA, synthB]);
  assert.equal(dupRes.identicalMergeCandidateCount, 1);
  assert.deepEqual(dupRes.identicalCandidateIds, ['SYNTH-DUP-B']);
});

test('Excel audit deliverables have exact sheet names/row counts, no fake 100%_PASS, and ZERO private reports under public/', () => {
  // Information security: no public/reports or any .xlsx under public/
  assert.equal(fs.existsSync(path.resolve('public/reports')), false, 'public/reports must NOT exist');
  const findXlsxUnder = (dir: string): string[] => {
    if (!fs.existsSync(dir)) return [];
    const found: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) found.push(...findXlsxUnder(full));
      else if (entry.name.toLowerCase().endsWith('.xlsx')) found.push(full);
    }
    return found;
  };
  assert.deepEqual(findXlsxUnder(path.resolve('public')), []);

  const preApprovalPath = path.resolve('docs/sanatpish-final-preapproval-audit.xlsx');
  assert.equal(fs.existsSync(preApprovalPath), true, 'docs/sanatpish-final-preapproval-audit.xlsx must exist');
  const wb = XLSX.read(fs.readFileSync(preApprovalPath), { type: 'buffer' });
  assert.deepEqual(wb.SheetNames, [
    'Final_647_Groups',
    'All_634_Belt_Conveyor_Families',
    'Singleton_247_Validation',
    'MultiMember_387_Validation',
    'Brand_Audit',
    'ZRK_And_Physical_Review',
    'Live_DB_Inspection',
    'Approved_Taxonomy_Mapping',
    'Final_SKU_Classification',
    'Migration_Readiness',
  ]);
  assert.equal(wb.SheetNames.includes('Live_DB_48_Differences'), false);

  assert.equal(XLSX.utils.sheet_to_json(wb.Sheets['Final_647_Groups']).length, 647);
  assert.equal(XLSX.utils.sheet_to_json(wb.Sheets['All_634_Belt_Conveyor_Families']).length, 634);
  assert.equal(XLSX.utils.sheet_to_json(wb.Sheets['Singleton_247_Validation']).length, 247);
  const multiRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['MultiMember_387_Validation']);
  assert.equal(multiRows.length, 387);

  // Ensure both PASS_HOMOGENEOUS and CONDITIONAL_UNKNOWN_SPECS exist, and ZERO '100%_PASS'
  const verdicts = new Set(multiRows.map((r) => String(r.Homogeneity_Verdict || '')));
  assert.equal(verdicts.has('100%_PASS'), false, 'Fake 100%_PASS verdict must never appear');
  assert.ok([...verdicts].some((v) => v.startsWith('PASS_HOMOGENEOUS')));
  assert.ok([...verdicts].some((v) => v.startsWith('CONDITIONAL_UNKNOWN_SPECS')));

  // Brand_Audit includes reconciliation totals row + 67 buckets = 68 rows
  const brandRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Brand_Audit']);
  assert.equal(brandRows.length, 68);
  assert.equal(brandRows[0].Brand_Code, '__RECONCILIATION_TOTALS__');
});

test('readLiveDatabaseDifferences returns honest UNVERIFIED status without hardcoded 48 differences when DATABASE_URL is absent', async () => {
  const prevUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const res = await readLiveDatabaseDifferences();
    assert.equal(res.queried, false);
    assert.equal(res.status, 'UNVERIFIED');
    assert.equal(res.liveFamiliesCount, null);
    assert.equal(res.diffs.length, 1);
    assert.equal(res.diffs[0].Read_Only_Query_Status, 'UNVERIFIED');
    assert.equal(res.statusNote.includes('48 differences'), false);
    assert.equal(res.statusNote.includes('2026-10-24'), false);
  } finally {
    if (prevUrl !== undefined) process.env.DATABASE_URL = prevUrl;
  }
});
