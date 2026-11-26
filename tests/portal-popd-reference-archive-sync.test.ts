import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  POPD_COMMIT,
  SOURCES,
  validateE869Payload,
  validateEngineeredPayload,
} from '../scripts/sync-popd-reference-archives.mjs';

const engineeredFixture = () => ({
  products: Array.from({ length: 492 }, (_, index) => ({ code: `PFAM-${index + 1}` })),
  aliases: Array.from({ length: 3156 }, (_, index) => [`LEGACY-${index + 1}`, {}]),
  stats: {
    validSkus: 10308,
    sourceSkus: 10435,
    quarantinedSkus: 127,
    aliases: 1372,
    directSkus: 678,
  },
});

const e869Fixture = () => ({
  totalImages: 869,
  linkedImages: 869,
  uniqueSkusLinked: 869,
  assignments: Array.from({ length: 869 }, (_, index) => ({
    targetKind: 'variant',
    skuCode: `SKU-${index + 1}`,
    url: `/storage/products/catalog/e(${index + 1}).png`,
  })),
});

test('pinned engineered POPD archive reconciles canonical families and SKU totals', () => {
  assert.deepEqual(validateEngineeredPayload(engineeredFixture()), {
    families: 492,
    aliasRows: 3156,
    validSkus: 10308,
    sourceSkus: 10435,
    quarantinedSkus: 127,
  });
});

test('engineered archive refuses family, alias, or SKU count drift', () => {
  const payload = engineeredFixture();
  payload.products.pop();
  assert.throws(() => validateEngineeredPayload(payload), /FAMILY_TOTAL_INVALID/);
  const invalidStats = engineeredFixture();
  invalidStats.stats.validSkus--;
  assert.throws(() => validateEngineeredPayload(invalidStats), /STATS_INVALID_validSkus/);
});

test('pinned POPD e869 mapping has exactly 869 unique SKU and image identities', () => {
  assert.deepEqual(validateE869Payload(e869Fixture()), {
    assignments: 869,
    uniqueSkus: 869,
    uniqueImages: 869,
  });
});

test('e869 archive rejects duplicate SKU and image assignments', () => {
  const duplicateSku = e869Fixture();
  duplicateSku.assignments[1].skuCode = duplicateSku.assignments[0].skuCode;
  assert.throws(() => validateE869Payload(duplicateSku), /ASSIGNMENT_INVALID/);
  const duplicateImage = e869Fixture();
  duplicateImage.assignments[1].url = duplicateImage.assignments[0].url;
  assert.throws(() => validateE869Payload(duplicateImage), /ASSIGNMENT_INVALID/);
});

test('archive source paths and POPD commit match the pinned image release', () => {
  const imageSync = readFileSync('scripts/sync-popd-catalog-images.mjs', 'utf8');
  const pinnedImageCommit = imageSync.match(/const POPD_COMMIT = "([a-f0-9]{40})"/)?.[1];
  assert.equal(POPD_COMMIT, pinnedImageCommit);
  assert.deepEqual(SOURCES.map(source => source.sourcePath), [
    'github/javanwebi/POPD/server/data/engineeredCatalog.json',
    'github/javanwebi/POPD/deliverables/catalog-869-audit/e869_linked_catalog.json',
  ]);
});

test('deployment imports the pinned archive into the active DB before starting the private canary', () => {
  const deploy = readFileSync('ops/deploy-single-port-vps.sh', 'utf8');
  const syncIndex = deploy.indexOf('===== SYNC PINNED POPD REFERENCE JSON');
  const canaryIndex = deploy.indexOf("===== PRIVATE CANARY WITHOUT A HOST PORT =====");
  assert.ok(syncIndex >= 0 && canaryIndex > syncIndex);
  const syncBlock = deploy.slice(syncIndex, canaryIndex);
  assert.match(syncBlock, /--network "\$NETWORK"/);
  assert.match(syncBlock, /-e NODE_ENV=production/);
  assert.match(syncBlock, /--mount "type=bind,source=\$STAGE,target=\/app"/);
  assert.match(syncBlock, /DATABASE_URL/);
  assert.match(syncBlock, /DATABASE_CA_CERT/);
  assert.doesNotMatch(syncBlock, /--env-file "\$ENV_FILE"/);
  assert.doesNotMatch(syncBlock, /MOUNTS/);
});

test('archive importer only appends immutable private source snapshots, not live catalog data', () => {
  const importer = readFileSync('scripts/sync-popd-reference-archives.mjs', 'utf8');
  assert.match(importer, /assertProductionDatabaseConfig\(\)/);
  assert.match(importer, /insert into app_private\.source_archives/);
  assert.match(importer, /on conflict \(source_path, sha256\) do update set imported_at = now\(\)/);
  assert.doesNotMatch(importer, /\b(?:delete|truncate)\s+(?:from\s+)?(?:public\.)?(?:catalog_|variant_commercial_specs|orders|inventory)/i);
  assert.doesNotMatch(importer, /update\s+public\.(?:catalog_|variant_commercial_specs|orders|inventory)/i);
});
