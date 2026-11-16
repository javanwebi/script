import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  extractBeltRefsFromTechnicalResearch,
  runPhase1CatalogReconstruction,
} from '../src/data/catalogPhase1Reconstruction';

const root = process.cwd();
const rawFamilies = JSON.parse(
  fs.readFileSync(path.join(root, 'tests/fixtures/catalogueSource.json'), 'utf8')
);
const directSkuSqlText = fs.readFileSync(
  path.join(root, 'ops/sql/20261114_catalog_sku_level_menu_assignments.sql'),
  'utf8'
);
const technicalResearch = JSON.parse(
  fs.readFileSync(path.join(root, 'docs/technical-research-2642.json'), 'utf8')
);
const report = runPhase1CatalogReconstruction(rawFamilies, {
  directSkuSqlText,
  beltRefs: extractBeltRefsFromTechnicalResearch(technicalResearch),
});
const byCode = new Map(report.skuRecords.map((sku) => [sku.skuCode, sku]));

test('PVC conveyor surface patterns split into dimension-invariant families and quarantine unknown surfaces', () => {
  const stoneA = byCode.get('10256')!;
  const stoneB = byCode.get('10629')!;
  const chicken = byCode.get('37036')!;
  const cone = byCode.get('10100')!;
  const perforatedCone = byCode.get('10099')!;
  const unknown = byCode.get('10123')!;
  const transparent = byCode.get('41152')!;

  assert.equal(stoneA.profile, 'PVC_STONE_SURFACE');
  assert.equal(stoneB.profile, 'PVC_STONE_SURFACE');
  assert.equal(chicken.profile, 'PVC_PAMARGHI_PATTERN');
  assert.equal(cone.profile, 'PVC_CONICAL_CLEAT');
  assert.equal(perforatedCone.profile, 'PVC_CONICAL_CLEAT');
  assert.equal(unknown.profile, 'PVC_SURFACE_UNSPECIFIED');
  assert.equal(transparent.profile, 'PVC_SURFACE_UNSPECIFIED');

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
  assert.ok(unknown.proposedFamily);
  assert.equal(report.skuRecords.filter((sku) =>
    sku.currentFamily === stoneA.currentFamily && sku.proposedFamily === unknown.proposedFamily
  ).length, 25, 'the unknown-surface review family must keep its 25 PVC SKUs together');
});
