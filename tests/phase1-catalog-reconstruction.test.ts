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

test('Phase 1 Gate 8: All 7 mandatory deliverables exist in docs/ and zero private audit files exist in public/', () => {
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
    assert.ok(stat.size > 1000, `Deliverable docs/${fileName} must be non-empty (size=${stat.size})`);
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
