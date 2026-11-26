#!/usr/bin/env node
/**
 * Import the pinned POPD reference JSON into the exact PostgreSQL database
 * already used by the live SCRIPT container. This is a deploy-time sync only;
 * the runtime catalogue API reads the private Supabase archive and never calls
 * POPD or GitHub.
 */
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { assertProductionDatabaseConfig, database, closeDatabase } from '../server/db/connection.ts';

export const POPD_COMMIT = 'e81218f2a248f1db9a72349a67e46af55c7977ee';

export const SOURCES = Object.freeze([
  {
    sourcePath: 'github/javanwebi/POPD/server/data/engineeredCatalog.json',
    url: `https://raw.githubusercontent.com/javanwebi/POPD/${POPD_COMMIT}/server/data/engineeredCatalog.json`,
    maxBytes: 12 * 1024 * 1024,
    validate: validateEngineeredPayload,
  },
  {
    sourcePath: 'github/javanwebi/POPD/deliverables/catalog-869-audit/e869_linked_catalog.json',
    url: `https://raw.githubusercontent.com/javanwebi/POPD/${POPD_COMMIT}/deliverables/catalog-869-audit/e869_linked_catalog.json`,
    maxBytes: 2 * 1024 * 1024,
    validate: validateE869Payload,
  },
]);

export function validateEngineeredPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('POPD_ENGINEERED_ARCHIVE_INVALID_OBJECT');
  }
  if (!Array.isArray(payload.products) || payload.products.length !== 492) {
    throw new Error('POPD_ENGINEERED_ARCHIVE_FAMILY_TOTAL_INVALID');
  }
  if (!Array.isArray(payload.aliases) || payload.aliases.length !== 3156) {
    throw new Error('POPD_ENGINEERED_ARCHIVE_ALIAS_TOTAL_INVALID');
  }
  const stats = payload.stats || {};
  const expected = {
    validSkus: 10308,
    sourceSkus: 10435,
    quarantinedSkus: 127,
    aliases: 1372,
    directSkus: 678,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (Number(stats[key]) !== value) {
      throw new Error('POPD_ENGINEERED_ARCHIVE_STATS_INVALID_' + key);
    }
  }
  return {
    families: payload.products.length,
    aliasRows: payload.aliases.length,
    validSkus: expected.validSkus,
    sourceSkus: expected.sourceSkus,
    quarantinedSkus: expected.quarantinedSkus,
  };
}

export function validateE869Payload(payload) {
  const assignments = Array.isArray(payload?.assignments) ? payload.assignments : [];
  const skuCodes = new Set();
  const imageNumbers = new Set();
  for (const assignment of assignments) {
    const skuCode = String(assignment?.skuCode || '').trim();
    const match = String(assignment?.url || '').match(/^\/storage\/products\/catalog\/e\(([1-9]\d{0,3})\)\.png$/i);
    const imageNumber = match ? Number(match[1]) : 0;
    if (
      assignment?.targetKind !== 'variant' ||
      !skuCode ||
      !Number.isInteger(imageNumber) ||
      imageNumber < 1 ||
      imageNumber > 869 ||
      skuCodes.has(skuCode) ||
      imageNumbers.has(imageNumber)
    ) {
      throw new Error('POPD_E869_ARCHIVE_ASSIGNMENT_INVALID');
    }
    skuCodes.add(skuCode);
    imageNumbers.add(imageNumber);
  }
  if (
    Number(payload?.totalImages) !== 869 ||
    Number(payload?.linkedImages) !== 869 ||
    Number(payload?.uniqueSkusLinked) !== 869 ||
    assignments.length !== 869 ||
    skuCodes.size !== 869 ||
    imageNumbers.size !== 869
  ) {
    throw new Error('POPD_E869_ARCHIVE_TOTALS_INVALID');
  }
  for (let imageNumber = 1; imageNumber <= 869; imageNumber++) {
    if (!imageNumbers.has(imageNumber)) throw new Error('POPD_E869_ARCHIVE_IMAGE_SEQUENCE_INVALID');
  }
  return { assignments: assignments.length, uniqueSkus: skuCodes.size, uniqueImages: imageNumbers.size };
}

async function fetchPinnedSource(source) {
  const response = await fetch(source.url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error('POPD_ARCHIVE_HTTP_' + response.status + '_' + source.sourcePath);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > source.maxBytes) {
    throw new Error('POPD_ARCHIVE_SIZE_INVALID_' + source.sourcePath);
  }
  const raw = bytes.toString('utf8');
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('POPD_ARCHIVE_JSON_INVALID_' + source.sourcePath);
  }
  const validation = source.validate(payload);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return { sourcePath: source.sourcePath, raw, payload, sha256, validation };
}

async function verifyProductionTarget(client) {
  assertProductionDatabaseConfig();
  const result = await client.query(`
    select
      to_regclass('app_private.source_archives') is not null as archive_table,
      (select count(*)::int from public.catalog_families where is_active = true) as active_families,
      (select count(*)::int from public.catalog_variants where active = true) as active_skus,
      (select count(*)::int from public.catalog_categories where is_active = true and slug ~ '^excel-v2-[0-9]+-[0-9]+$' and metadata->>'source' = 'industrial_megamenu_hierarchy_v2') as approved_categories,
      (select count(*)::int from public.catalog_navigation_groups where is_active = true) as active_groups,
      (select count(distinct mapped.category_slug)::int from public.catalog_navigation_groups g cross join lateral unnest(g.category_slugs) as mapped(category_slug) where g.is_active = true and g.id ~ '^excel-v2-[0-9]+$') as grouped_categories
  `);
  const row = result.rows[0];
  if (
    row?.archive_table !== true ||
    Number(row.active_families) < 1000 ||
    Number(row.active_skus) < 10000 ||
    Number(row.approved_categories) !== 40 ||
    Number(row.active_groups) !== 14 ||
    Number(row.grouped_categories) !== 40
  ) {
    throw new Error('POPD_ARCHIVE_SYNC_DATABASE_IDENTITY_CHECK_FAILED');
  }
  return {
    families: Number(row.active_families),
    skus: Number(row.active_skus),
    categories: Number(row.approved_categories),
    groupedCategories: Number(row.grouped_categories),
    groups: Number(row.active_groups),
  };
}

export async function syncPinnedPopdReferenceArchives() {
  // Download and validate both immutable sources before opening a write transaction.
  const records = await Promise.all(SOURCES.map(fetchPinnedSource));
  const pool = database();
  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query('begin');
    await client.query('set local statement_timeout = 120000');
    const target = await verifyProductionTarget(client);
    for (const record of records) {
      const latest = await client.query(
        'select sha256, payload from app_private.source_archives where source_path = $1 order by imported_at desc, sha256 desc limit 1',
        [record.sourcePath],
      );
      if (!latest.rows.length || latest.rows[0].sha256 !== record.sha256) {
        await client.query(
          `insert into app_private.source_archives(source_path, sha256, payload)
           values ($1, $2, $3::jsonb)
           on conflict (source_path, sha256) do update set imported_at = now()`,
          [record.sourcePath, record.sha256, record.raw],
        );
        inserted++;
      }
      const verified = await client.query(
        'select sha256, payload from app_private.source_archives where source_path = $1 order by imported_at desc, sha256 desc limit 1',
        [record.sourcePath],
      );
      if (!verified.rows.length || verified.rows[0].sha256 !== record.sha256) {
        throw new Error('POPD_ARCHIVE_NOT_CURRENT_AFTER_SYNC_' + record.sourcePath);
      }
      record.validation = SOURCES.find(source => source.sourcePath === record.sourcePath).validate(verified.rows[0].payload);
    }
    await client.query('commit');
    console.log(
      'POPD_REFERENCE_ARCHIVE_SYNC_OK',
      'sourceCommit=' + POPD_COMMIT,
      'insertedOrPromoted=' + inserted,
      'families=' + records[0].validation.families,
      'validSkus=' + records[0].validation.validSkus,
      'e869Assignments=' + records[1].validation.assignments,
      'target=' + JSON.stringify(target),
    );
    return { inserted, target, records: records.map(({ sourcePath, sha256, validation }) => ({ sourcePath, sha256, validation })) };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
    await closeDatabase();
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  syncPinnedPopdReferenceArchives().catch(error => {
    console.error('[POPD_REFERENCE_ARCHIVE_SYNC_FAILED]', error?.code || '', error?.message || String(error));
    process.exitCode = 1;
  });
}
