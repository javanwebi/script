import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as XLSX from 'xlsx';
import {
  evaluateCandidateFamilyPair,
  extractBeltRefsFromTechnicalResearch,
  runPhase1CatalogReconstruction,
  validatePhase1FamilyHomogeneity,
  type TechnicalEvidenceLevel,
} from '../src/data/catalogPhase1Reconstruction';

const ROOT_DIR = process.cwd();
const rawFamilies = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'tests/fixtures/catalogueSource.json'), 'utf8')
);
const directSql = fs.readFileSync(
  path.join(ROOT_DIR, 'ops/sql/20261114_catalog_sku_level_menu_assignments.sql'),
  'utf8'
);
const trJson = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'docs/technical-research-2642.json'), 'utf8')
);
const beltRefs = extractBeltRefsFromTechnicalResearch(trJson);
const report = runPhase1CatalogReconstruction(rawFamilies, {
  directSkuSqlText: directSql,
  beltRefs,
});
const skuByCode = new Map(report.skuRecords.map((r) => [r.skuCode, r]));

test('Phase 1 Gate 1: 100% coverage of all 10,435 SKUs, 1,383 source families, and 90 technical types with zero duplicates', () => {
  assert.equal(report.summary.totalSourceFamilies, 1383);
  assert.equal(report.summary.totalSourceSkus, 10435);
  assert.equal(report.summary.totalTechnicalTypes, 90);
  assert.equal(report.skuRecords.length, 10435);
  assert.equal(report.sourceFamilyTransformations.length, 1383);
  assert.equal(report.typeRuleProfiles.length, 90);

  const uniqueSkuCodes = new Set(report.skuRecords.map((s) => s.skuCode));
  assert.equal(uniqueSkuCodes.size, 10435, 'Every SKU code must be unique with 0 duplicates');

  const sumDecisions =
    report.decisionDistribution.APPROVED_FAMILY +
    report.decisionDistribution.DIRECT_PRODUCT +
    report.decisionDistribution.UNRESOLVED;
  assert.equal(sumDecisions, 10435, 'APPROVED_FAMILY + DIRECT_PRODUCT + UNRESOLVED must equal 10,435');
});

test('Phase 1 Gate 2: All 22 mandatory SKU fields and 13 mandatory Family fields are populated and valid', () => {
  const validEvidenceLevels = new Set<TechnicalEvidenceLevel>([
    'EXACT_MANUFACTURER_DATASHEET',
    'OFFICIAL_CATALOG',
    'OFFICIAL_PRODUCT_PAGE',
    'STANDARD_REFERENCE',
    'PHYSICAL_VERIFICATION',
    'EXCEL_SOURCE',
    'INVENTORY_DESCRIPTION',
    'INFERRED',
    'UNKNOWN',
  ]);

  for (const sku of report.skuRecords) {
    assert.ok(sku.skuCode);
    assert.ok(sku.originalProductName);
    assert.ok(sku.normalizedProductName);
    assert.ok(sku.brand);
    assert.ok(sku.productType);
    assert.ok(sku.material);
    assert.ok(sku.construction);
    assert.ok(sku.profile);
    assert.ok(sku.standard);
    assert.ok(typeof sku.engineeringSpecifications === 'object' && sku.engineeringSpecifications !== null);
    assert.ok(sku.currentFamily.startsWith('FAM-'));
    assert.ok(sku.currentCategory);
    assert.ok(sku.proposedCategory);
    assert.ok(sku.currentSubcategory);
    assert.ok(sku.proposedSubcategory);
    assert.ok(['APPROVED_FAMILY', 'DIRECT_PRODUCT', 'UNRESOLVED'].includes(sku.familyDecision));
    assert.ok(validEvidenceLevels.has(sku.technicalEvidence));
    assert.ok(sku.sourceUrl);
    assert.ok(sku.decisionReason.length > 10);
    assert.ok(['HIGH', 'MEDIUM', 'LOW', 'UNRESOLVED'].includes(sku.confidence));
    assert.ok(
      [
        'VERIFIED_MANUFACTURER',
        'VERIFIED_STANDARD_OR_SOURCE',
        'VERIFIED_INVENTORY_RECORD',
        'REQUIRES_PHYSICAL_VERIFICATION',
      ].includes(sku.verificationStatus)
    );

    if (sku.familyDecision === 'APPROVED_FAMILY') {
      assert.ok(sku.proposedFamily && sku.proposedFamily.startsWith('PFAM-'));
    } else {
      assert.equal(sku.proposedFamily, null);
    }
  }

  for (const fam of report.reconstructedFamilies) {
    assert.ok(fam.familyId.startsWith('PFAM-'));
    assert.ok(fam.engineeringFamilyName);
    assert.ok(fam.productType);
    assert.ok(fam.brand);
    assert.ok(fam.material && fam.material !== 'UNKNOWN');
    assert.ok(fam.construction && fam.construction !== 'UNKNOWN');
    assert.ok(typeof fam.invariantSpecifications === 'object');
    assert.ok(Array.isArray(fam.variantSpecifications) && fam.variantSpecifications.length > 0);
    assert.ok(Array.isArray(fam.memberSkuCodes) && fam.memberSkuCodes.length >= 2);
    assert.equal(fam.memberCount, fam.memberSkuCodes.length);
    assert.ok(fam.memberCount >= 2, `Family ${fam.familyId} must have at least 2 members (no 1-SKU families allowed)`);
    assert.ok(fam.technicalIdentity);
    assert.ok(validEvidenceLevels.has(fam.evidence));
    assert.equal(fam.validationVerdict, 'PASS_HOMOGENEOUS');
  }
});

test('Phase 1 Gate 3: Zero SKU belongs to two active families, and 100% of reconstructed families pass strict homogeneity', () => {
  const seenInFamilies = new Set<string>();
  for (const fam of report.reconstructedFamilies) {
    const members = fam.memberSkuCodes.map((code) => skuByCode.get(code)!);
    assert.equal(
      validatePhase1FamilyHomogeneity(members),
      'PASS_HOMOGENEOUS',
      `Family ${fam.familyId} failed strict engineering homogeneity`
    );
    for (const code of fam.memberSkuCodes) {
      assert.ok(!seenInFamilies.has(code), `SKU ${code} appears in more than one reconstructed family`);
      seenInFamilies.add(code);
    }
  }
  assert.equal(seenInFamilies.size, report.decisionDistribution.APPROVED_FAMILY);
  assert.equal(report.summary.allFamiliesPassHomogeneity, true);
});

test('Phase 1 Gate 4: All 305 direct SKU menu overrides from ops/sql are 100% preserved', () => {
  assert.equal(report.summary.preservedDirectSkuOverridesCount, 305);
  const overriddenSkus = report.skuRecords.filter((s) => s.preservedDirectSkuOverride !== null);
  assert.equal(overriddenSkus.length, 305);
  for (const sku of overriddenSkus) {
    assert.equal(sku.currentFamily, sku.preservedDirectSkuOverride!.expectedFamilyCode);
    assert.equal(sku.proposedCategorySlug, sku.preservedDirectSkuOverride!.categorySlug);
  }
});

test('Phase 1 Gate 5: Haul-Off Belts (تسمه بارکش) special audit keeps leaf free of false items', () => {
  assert.equal(report.haulOffBeltAudit.verifiedTrueHaulOffBeltCount, 0);
  assert.ok(report.haulOffBeltAudit.coatedTimingBeltCount > 0);
  assert.ok(report.haulOffBeltAudit.coatedWeldedVBeltCount > 0);
  assert.equal(report.haulOffBeltAudit.gripBackingSheetCount, 15);
  assert.equal(report.haulOffBeltAudit.conveyorGripTapeCount, 22);
  assert.equal(report.haulOffBeltAudit.industrialMouldCount, 39);

  // Verify zero SKUs in the entire catalog are assigned to leaf انواع تسمه بارکش صنعتی
  const skusInHaulOffLeaf = report.skuRecords.filter(
    (s) => s.proposedLeaf === 'انواع تسمه بارکش صنعتی' && s.familyDecision !== 'UNRESOLVED'
  );
  assert.equal(skusInHaulOffLeaf.length, 0);
});

test('Phase 1 Gate 6: Welding Equipment (تجهیزات جوشی) strictly separated from Welded Belts (تسمه جوشی)', () => {
  assert.equal(report.weldingEquipmentAudit.weldingEquipmentAndClampCount, 3);
  for (const toolSkuCode of ['41497', '35852', '110049']) {
    const rec = skuByCode.get(toolSkuCode);
    assert.ok(rec, `Welding equipment SKU ${toolSkuCode} must exist`);
    assert.equal(rec.productType, 'دستگاه و گیره جوش تسمه صنعتی');
    assert.equal(rec.proposedCategorySlug, 'excel-v2-1-4');
    assert.equal(rec.proposedSubmenu, 'دستگاه‌های تسمه جوشی');
    assert.equal(rec.proposedLeaf, 'دستگاه جوش تسمه صنعتی');
    assert.equal(rec.familyDecision, 'DIRECT_PRODUCT');
    assert.equal(rec.proposedFamily, null);
  }
});

test('Phase 1 Gate 7: Negative & Positive Engineering Tests (Material, Profile, Sidedness, Supply Form, and Length Variants)', () => {
  // NEG-01: PVC vs PU conveyor belt in FAM-52858 must NOT merge
  const pvcConveyor = skuByCode.get('52858')!; // نوار 4 * 550 * 5890 PVC
  const puConveyor = skuByCode.get('41716')!; // نوار PU سبز 1160 * 8660
  assert.equal(evaluateCandidateFamilyPair(pvcConveyor, puConveyor).compatible, false);
  assert.notEqual(pvcConveyor.proposedFamily, puConveyor.proposedFamily);
  assert.equal(pvcConveyor.proposedLeaf, 'نوار نقاله PVC');
  assert.equal(puConveyor.proposedLeaf, 'نوار نقاله پلی‌اورتان (PU)');

  // NEG-02: Stainless Steel vs PTFE/Teflon vs Aluminum guide rails/guides must NOT merge
  const ssGuide = skuByCode.get('10107')!; // گاید استیل 2 * 30 * 1000
  const ptfeRail = skuByCode.get('40690')!; // ریل تفلونی زیر تسمه گرد
  const alRail = skuByCode.get('33117')!; // ریل آلومینیوم زیر تسمه ای
  assert.equal(evaluateCandidateFamilyPair(ssGuide, ptfeRail).compatible, false);
  assert.equal(evaluateCandidateFamilyPair(ptfeRail, alRail).compatible, false);
  assert.notEqual(ptfeRail.proposedFamily, alRail.proposedFamily);

  // NEG-03 & NEG-04: Bando H single-sided vs Bando DH double-sided must NOT merge
  const bandoH1 = skuByCode.get('10538')!; // تسمه 1400 H 100 BANDO
  const bandoDH = skuByCode.get('10111')!; // تسمه دوطرفه 1700DH100 BANDO
  assert.equal(evaluateCandidateFamilyPair(bandoH1, bandoDH).compatible, false);
  assert.notEqual(bandoH1.proposedFamily, bandoDH.proposedFamily);

  // NEG-05: Bando DH endless loop vs Bando DH uncut sleeve (سانتی‌متر) must NOT merge
  const bandoDHSleeve = skuByCode.get('36468')!; // آستین دوطرفه 2700DH BANDO
  assert.equal(evaluateCandidateFamilyPair(bandoDH, bandoDHSleeve).compatible, false);
  assert.notEqual(bandoDH.proposedFamily, bandoDHSleeve.proposedFamily);

  // NEG-06: Coated timing belt with 10mm red grip vs 15mm red grip vs black grip must NOT merge
  const grip10Red = skuByCode.get('54569')!; // 10 میل قرمز
  const grip15Red = skuByCode.get('34280')!; // 15 میل
  const gripBlack = skuByCode.get('39853')!; // مشکی
  assert.equal(evaluateCandidateFamilyPair(grip10Red, grip15Red).compatible, false);
  assert.equal(evaluateCandidateFamilyPair(grip10Red, gripBlack).compatible, false);

  // NEG-07: Welding clamp (35852) vs welded CRC belt (36215) must NOT merge
  const weldClamp = skuByCode.get('35852')!;
  const crcBelt = skuByCode.get('36215')!;
  assert.equal(evaluateCandidateFamilyPair(weldClamp, crcBelt).compatible, false);

  // NEG-08: Stainless steel sheet (14253) vs Galvanized sheet (38316) in FAM-14253 must NOT merge
  const ssSheet = skuByCode.get('14253')!;
  const galvSheet = skuByCode.get('38316')!;
  assert.equal(evaluateCandidateFamilyPair(ssSheet, galvSheet).compatible, false);
  assert.notEqual(ssSheet.proposedFamily, galvSheet.proposedFamily);

  // NEG-09: Braided gland packing (32496) vs Rotary oil seal (39379) in FAM-32496 must NOT merge
  const glandPacking = skuByCode.get('32496')!;
  const oilSeal = skuByCode.get('39379')!;
  assert.equal(evaluateCandidateFamilyPair(glandPacking, oilSeal).compatible, false);
  assert.equal(glandPacking.familyDecision, 'DIRECT_PRODUCT');
  assert.equal(oilSeal.familyDecision, 'UNRESOLVED');

  // NEG-10: Two 3-row PTFE-blade brushes with DIFFERENT selling units (شاخه vs عدد) must NOT merge
  const brush3Shakheh = skuByCode.get('39405')!; // برس تیغه تفلونی فلزی 3 ردیفه 1750 (unit: شاخه)
  const brush3Adad = skuByCode.get('31737')!; // برس تیغه تفلونی فلزی سه ردیفه 1800 (unit: عدد)
  assert.equal(evaluateCandidateFamilyPair(brush3Shakheh, brush3Adad).compatible, false);

  // POS-01: Two SKUs with identical invariant engineering identity and different lengths MUST merge into one APPROVED_FAMILY
  const bandoH2 = skuByCode.get('36103')!; // تسمه 1140H100 BANDO (from FAM-36103)
  assert.equal(evaluateCandidateFamilyPair(bandoH1, bandoH2).compatible, true);
  assert.equal(bandoH1.familyDecision, 'APPROVED_FAMILY');
  assert.equal(bandoH1.proposedFamily, bandoH2.proposedFamily);

  // POS-02: Double-stud bumpers with phrasing variants (دو سر پیچ vs دوطرف پیچ) and identical unit MUST merge
  const bumper1 = skuByCode.get('34684')!; // ضربه گیر دو سر پیچ 18 کد 284/2
  const bumper2 = skuByCode.get('34536')!; // ضربه گیر 4 * 3 دوطرف پیچ 8 کد 253/1
  assert.equal(evaluateCandidateFamilyPair(bumper1, bumper2).compatible, true);
  assert.equal(bumper1.familyDecision, 'APPROVED_FAMILY');
  assert.equal(bumper1.proposedFamily, bumper2.proposedFamily);

  // POS-03: Kiln roller end springs (فنر سر رول کوره vs فنر سر رولر کوره) MUST merge
  const kilnSpring1 = skuByCode.get('31909')!;
  const kilnSpring2 = skuByCode.get('36616')!;
  assert.equal(evaluateCandidateFamilyPair(kilnSpring1, kilnSpring2).compatible, true);
  assert.equal(kilnSpring1.proposedFamily, kilnSpring2.proposedFamily);
});

test('Phase 1 Gate 7A: PVC conveyor surface profiles form separate, dimension-invariant families', () => {
  const stoneA = skuByCode.get('10256')!; // PVC سنگی 9 * 95 * 12600
  const stoneB = skuByCode.get('10629')!; // PVC سنگی 9 * 95 * 8260
  const chicken = skuByCode.get('37036')!; // PVC پامرغی
  const cone = skuByCode.get('10100')!; // PVC کله‌قندی
  const perforatedCone = skuByCode.get('10099')!; // PVC کله‌قندی سوراخ‌دار
  const unknown = skuByCode.get('10123')!; // PVC سبز بدون ذکر الگوی سطح
  const transparent = skuByCode.get('41152')!; // PVC شفاف؛ شفافیت، الگوی سطح را ثابت نمی‌کند

  assert.equal(stoneA.profile, 'PVC_STONE_SURFACE');
  assert.equal(stoneB.profile, 'PVC_STONE_SURFACE');
  assert.equal(chicken.profile, 'PVC_PAMARGHI_PATTERN');
  assert.equal(cone.profile, 'PVC_CONICAL_CLEAT');
  assert.equal(perforatedCone.profile, 'PVC_CONICAL_CLEAT');
  assert.equal(unknown.profile, 'PVC_SURFACE_UNSPECIFIED');
  assert.equal(transparent.profile, 'PVC_SURFACE_UNSPECIFIED');

  // Size/length changes are SKU variants, while surface construction defines family identity.
  assert.equal(stoneA.proposedFamily, stoneB.proposedFamily);
  assert.equal(cone.proposedFamily, perforatedCone.proposedFamily);
  assert.notEqual(stoneA.proposedFamily, chicken.proposedFamily);
  assert.notEqual(stoneA.proposedFamily, cone.proposedFamily);
  assert.notEqual(stoneA.proposedFamily, unknown.proposedFamily);
  assert.notEqual(chicken.proposedFamily, cone.proposedFamily);

  for (const sku of [stoneA, stoneB, chicken, cone, perforatedCone, unknown, transparent]) {
    assert.equal(sku.proposedCategorySlug, 'excel-v2-2-1');
    assert.equal(sku.proposedLeaf, 'نوار نقاله PVC');
    assert.equal(sku.standard, 'NOT_ESTABLISHED');
  }
  assert.equal(unknown.requiredAction, 'WAREHOUSE_PHYSICAL_INSPECTION_REQUIRED');
  assert.equal(unknown.verificationStatus, 'REQUIRES_PHYSICAL_VERIFICATION');
  assert.ok(unknown.proposedFamily, 'unknown surface PVC SKUs stay in their own review family');

  // PVC guide profiles are not conveyor belts merely because their material is PVC.
  assert.equal(skuByCode.get('52394')!.proposedCategorySlug, 'excel-v2-6-2');
  assert.equal(skuByCode.get('52737')!.proposedCategorySlug, 'excel-v2-6-2');
});

test('Phase 1 Gate 7B: PVC conveyor data migration is backed up, reversible and fails closed', () => {
  const migrationPath = path.join(ROOT_DIR, 'ops/sql/20261116_pvc_conveyor_surface_family_split.sql');
  const rollbackPath = path.join(ROOT_DIR, 'ops/sql/20261116_pvc_conveyor_surface_family_split_rollback.sql');
  assert.ok(fs.existsSync(migrationPath), 'PVC conveyor surface migration must exist');
  assert.ok(fs.existsSync(rollbackPath), 'PVC conveyor surface rollback must exist');

  const migration = fs.readFileSync(migrationPath, 'utf8');
  const rollback = fs.readFileSync(rollbackPath, 'utf8');
  for (const marker of [
    'PVC surface preflight mismatch',
    'catalog_pvc_surface_variants_backup_20261116',
    'catalog_pvc_surface_commercial_backup_20261116',
    'PVC_STONE_SURFACE',
    'PVC_PAMARGHI_PATTERN',
    'PVC_CONICAL_CLEAT',
    'PVC_SURFACE_UNSPECIFIED',
    'NOT_ESTABLISHED',
    'all_new_family_codes',
    'PVC surface postflight mismatch',
  ]) {
    assert.ok(migration.includes(marker), 'missing migration safety or classification marker: ' + marker);
  }
  assert.match(rollback, /catalog_pvc_surface_variants_backup_20261116/);
  assert.match(rollback, /DELETE FROM public\.catalog_families/);
  assert.match(rollback, /PVC rollback did not restore all 146 variants/);
});

test('Phase 1 Gate 8: All mandatory deliverables exist in docs/ and zero private audit files exist in public/', () => {
  const requiredDocs = [
    'phase1-catalog-executive-report.md',
    'phase1-product-classification.xlsx',
    'phase1-family-reconstruction.xlsx',
    'phase1-taxonomy-mapping.xlsx',
    'phase1-unresolved-items.xlsx',
    'phase1-engineering-rules.md',
    'phase1-validation-results.json',
  ];

  for (const fileName of requiredDocs) {
    const fullPath = path.join(ROOT_DIR, 'docs', fileName);
    assert.ok(fs.existsSync(fullPath), `Deliverable docs/${fileName} must exist`);
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 500, `Deliverable docs/${fileName} must be non-empty (size=${stat.size})`);
  }

  // Verify Excel row counts in phase1-product-classification.xlsx
  const classWb = XLSX.read(
    fs.readFileSync(path.join(ROOT_DIR, 'docs/phase1-product-classification.xlsx')),
    { type: 'buffer' }
  );
  const skuSheet = XLSX.utils.sheet_to_json(classWb.Sheets['All_10435_SKUs']);
  assert.equal(skuSheet.length, 10435, 'All_10435_SKUs sheet must contain all 10,435 SKUs');

  // Verify public/ has no leaked audit files
  const publicFiles = fs.readdirSync(path.join(ROOT_DIR, 'public'));
  for (const f of publicFiles) {
    assert.ok(!/phase1|audit|sanatpish-belt/i.test(f), `Public directory must not contain private audit file: ${f}`);
  }
});

test('Phase 1 Gate 9 (Phases 1–9): Master 16-sheet workbook, full classification chain, 34 categories, 67 leaves, 0 singleton families, and Quality Control metrics pass 100%', () => {
  assert.equal(report.qualityControlMetrics.allSkusAudited, true);
  assert.equal(report.qualityControlMetrics.noDuplicateFamilyMembership, true);
  assert.equal(report.qualityControlMetrics.allCategoriesValid, true);
  assert.equal(report.qualityControlMetrics.allSubcategoriesValid, true);
  assert.equal(report.qualityControlMetrics.allFamiliesHomogeneous, true);
  assert.equal(report.qualityControlMetrics.noBrandMixingInFamilies, true);
  assert.equal(report.qualityControlMetrics.noMaterialMixingInFamilies, true);
  assert.equal(report.qualityControlMetrics.noSingleSkuArtificialFamilies, true);
  assert.equal(report.qualityControlMetrics.unresolvedProperlyQuarantined, true);

  assert.equal(report.categoryStageCheckpoints.length, 34);
  assert.equal(report.subcategorySkuCounts.length, 67);
  assert.ok(report.familyTypeSummary.length >= 25);
  assert.equal(report.oldToNewFamilyMappings.length, 1383);
  assert.ok(report.similarProductLinks.length > 0);
  assert.ok(report.technicalConflicts.length > 0);

  // Verify every SKU has exact finalStatus enum and full classification chain
  for (const sku of report.skuRecords) {
    assert.ok(['FAMILY_MEMBER', 'DIRECT_PRODUCT', 'UNRESOLVED'].includes(sku.finalStatus));
    assert.ok(sku.mainGroupId && sku.mainGroupName);
    assert.ok(sku.familyTypeId && sku.familyTypeName);
    assert.ok(Array.isArray(sku.familyMemberCodes));
    if (sku.finalStatus === 'FAMILY_MEMBER') {
      assert.ok(sku.proposedFamily?.startsWith('PFAM-'));
      assert.ok(sku.familyName && sku.familyName.length > 5);
      assert.ok(sku.familyMemberCodes.length >= 2);
      assert.ok(sku.familyMemberCodes.includes(sku.skuCode));
    } else if (sku.finalStatus === 'DIRECT_PRODUCT') {
      assert.equal(sku.proposedFamily, null);
      assert.equal(sku.familyName, null);
      assert.deepEqual(sku.familyMemberCodes, [sku.skuCode]);
    } else {
      assert.equal(sku.proposedFamily, null);
      assert.equal(sku.familyName, null);
      assert.deepEqual(sku.familyMemberCodes, []);
    }
  }

  // Verify cross-catalog global unification of genuine non-belt sibling variants (Phase 5 & 6)
  // 1. Rubber balls: 80222 (گلوله لاستیکی قطر 32) and 80226 (گلوله لاستیکی ضد سایش قطر 25)
  const ball1 = skuByCode.get('80222')!;
  const ball2 = skuByCode.get('80226')!;
  assert.equal(ball1.finalStatus, 'FAMILY_MEMBER');
  assert.equal(ball1.proposedFamily, ball2.proposedFamily);
  // 2. Bearing housing guards: 31761 (حفاظ روی یاتاقان تایوانی) and 41309 (حفاظ یاتاقان 205)
  const guard1 = skuByCode.get('31761')!;
  const guard2 = skuByCode.get('41309')!;
  assert.equal(guard1.finalStatus, 'FAMILY_MEMBER');
  assert.equal(guard1.proposedFamily, guard2.proposedFamily);
  // 3. Glaze squeegees: 80293 and 80197
  const sq1 = skuByCode.get('80293')!;
  const sq2 = skuByCode.get('80197')!;
  assert.equal(sq1.finalStatus, 'FAMILY_MEMBER');
  assert.equal(sq1.proposedFamily, sq2.proposedFamily);

  const masterPath = path.join(ROOT_DIR, 'docs/sanatpish-master-catalog-reconstruction.xlsx');
  assert.ok(fs.existsSync(masterPath), 'Master 16-sheet Excel workbook must exist');

  const masterWb = XLSX.read(fs.readFileSync(masterPath), { type: 'buffer' });
  const expected16Sheets = [
    'All_SKUs',
    'Current_Families',
    'Proposed_Families',
    'Family_Types_Summary',
    'Subcategory_SKU_Counts',
    'Category_Mapping',
    'Subcategory_Audit',
    'Misclassified_SKUs',
    'Duplicate_Families',
    'Similar_Products',
    'Direct_Products',
    'Unresolved_Products',
    'Research_Evidence',
    'Technical_Conflicts',
    'Old_New_ID_Mapping',
    'Quality_Control',
  ];
  assert.deepEqual(masterWb.SheetNames, expected16Sheets);

  const allSkusRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(masterWb.Sheets['All_SKUs']);
  assert.equal(allSkusRows.length, 10435);
});

test('Phase 1 Gate 10 (Phase 8): Additive & reversible PostgreSQL migration script with backup snapshots exists', () => {
  const sqlPath = path.join(ROOT_DIR, 'ops/sql/20261115_complete_catalog_reconstruction_migration.sql');
  assert.ok(fs.existsSync(sqlPath), 'SQL migration file must exist');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.backup_20261115_catalog_families'));
  assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.backup_20261115_catalog_variants'));
  assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.catalog_reconstruction_family_map'));
  assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.catalog_similar_product_links'));
});

test('Phase 1 Gate 11 (Stage 12): AI Family Auditor Engine accurately audits incoming SKUs, prevents duplicates, flags conflicts, and suggests similar products', async () => {
  const { auditIncomingCatalogProduct } = await import('../src/services/aiFamilyAuditor');

  // 1. Incoming SKU matching an existing BANDO H timing belt family -> JOIN_EXISTING_FAMILY
  const verdictJoin = auditIncomingCatalogProduct(
    {
      skuCode: '99001',
      productName: 'تسمه تایم 1500 H 100 BANDO',
      size: '1500H100',
      unit: 'حلقه',
    },
    report.reconstructedFamilies,
    report.skuRecords
  );
  assert.equal(verdictJoin.recommendedAction, 'JOIN_EXISTING_FAMILY');
  assert.equal(verdictJoin.duplicateFamilyPrevented, true);
  assert.ok(verdictJoin.recommendedFamilyId?.startsWith('PFAM-'));
  assert.equal(verdictJoin.extractedBrand, 'BANDO');
  assert.ok(verdictJoin.mainGroupName);
  assert.ok(verdictJoin.familyTypeName);
  assert.ok(verdictJoin.confidenceScore >= 85);
  assert.equal(verdictJoin.requiresAdminApproval, false);

  // 2. Incoming SKU requesting an incompatible target family (e.g. PVC conveyor belt requesting a BANDO H timing belt family) -> REJECT_INCOMPATIBLE_TARGET_FAMILY
  const verdictConflict = auditIncomingCatalogProduct(
    {
      skuCode: '99002',
      productName: 'نوار نقاله 4 * 600 * 5000 PVC',
      size: '4*600*5000',
      unit: 'عدد',
      requestedTargetFamilyId: verdictJoin.recommendedFamilyId || undefined,
    },
    report.reconstructedFamilies,
    report.skuRecords
  );
  assert.equal(verdictConflict.recommendedAction, 'REJECT_INCOMPATIBLE_TARGET_FAMILY');
  assert.ok(verdictConflict.flaggedTechnicalConflicts.length > 0);
  assert.equal(verdictConflict.requiresAdminApproval, true);

  // 3. Incoming SKU with insufficient technical identity -> QUARANTINE_UNRESOLVED
  const verdictUnresolved = auditIncomingCatalogProduct(
    {
      skuCode: '99003',
      productName: 'FORZA 999',
      size: 'نامشخص',
      unit: 'عدد',
    },
    report.reconstructedFamilies,
    report.skuRecords
  );
  assert.equal(verdictUnresolved.recommendedAction, 'QUARANTINE_UNRESOLVED');
  assert.ok(verdictUnresolved.confidenceScore < 70);
  assert.equal(verdictUnresolved.requiresAdminApproval, true);
});

test('Phase 1 Gate 12: Pilot Timing Belt Family (FAM-34388) Real Images & Engineering Drawings + Removal of Default Belt Fallbacks + Preservation of 869 Official Images', async () => {
  const { resolveSiteFallbackByText } = await import('../src/utils/siteProductImages');
  const { getProductImageUrl, TOTAL_OFFICIAL_IMAGES_COUNT } = await import('../src/assets/imagesproducts');

  // 1. All 869 official catalog images must remain 100% intact
  assert.equal(TOTAL_OFFICIAL_IMAGES_COUNT, 869);
  assert.equal(getProductImageUrl('e(1).png'), '/storage/products/catalog/e(1).png');
  assert.equal(getProductImageUrl('e(869).png'), '/storage/products/catalog/e(869).png');

  // 2. Default belt fallback images must be removed (return empty string)
  assert.equal(resolveSiteFallbackByText('تسمه تایمینگ صنعتی 240L100'), '');
  assert.equal(resolveSiteFallbackByText('تسمه وی بلت SPA 1250'), '');
  assert.equal(resolveSiteFallbackByText('تسمه شیاری 6PK1200'), '');
  assert.equal(resolveSiteFallbackByText('تسمه جوشی پلی اورتان'), '');
  assert.equal(resolveSiteFallbackByText('تسمه بارکش صنعتی'), '');

  // 3. Verify Pilot Family (FAM-34388) manifest & image deliverables
  const pilotDir = path.join(ROOT_DIR, 'docs/pilot-family-image-study/FAM-34388');
  const manifestPath = path.join(pilotDir, 'image-binding-manifest.json');
  const reportPath = path.join(pilotDir, 'pilot-family-image-report.md');
  assert.ok(fs.existsSync(manifestPath), 'Pilot image-binding-manifest.json must exist');
  assert.ok(fs.existsSync(reportPath), 'Pilot pilot-family-image-report.md must exist');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.family.sourceFamilyId, 'FAM-34388');
  assert.equal(manifest.familyImages.length, 4);
  assert.equal(manifest.skuImages.length, 5);

  for (const famImg of manifest.familyImages) {
    assert.ok(fs.existsSync(path.join(pilotDir, famImg.webp_file_name)), `Family WebP image must exist: ${famImg.webp_file_name}`);
  }

  for (const skuEntry of manifest.skuImages) {
    assert.ok(
      fs.existsSync(path.join(pilotDir, skuEntry.technical_drawing_image.svg_file_name)),
      `SKU technical drawing SVG must exist for ${skuEntry.sku_id}`
    );
    assert.ok(
      fs.existsSync(path.join(pilotDir, skuEntry.technical_drawing_image.webp_file_name)),
      `SKU technical drawing WebP must exist for ${skuEntry.sku_id}`
    );
    if (skuEntry.sku_id === '52009' || skuEntry.sku_id === '52050') {
      assert.equal(skuEntry.real_product_image.match_status, 'EXACT_SKU_IMAGE_FOUND');
      assert.equal(skuEntry.real_product_image.slot_populated, true);
      assert.ok(fs.existsSync(path.join(pilotDir, skuEntry.real_product_image.webp_file_name)));
    } else {
      assert.equal(skuEntry.real_product_image.match_status, 'REAL_IMAGE_NOT_FOUND');
      assert.equal(skuEntry.real_product_image.slot_populated, false);
      assert.equal(skuEntry.real_product_image.webp_file_name, null);
    }
  }
});


