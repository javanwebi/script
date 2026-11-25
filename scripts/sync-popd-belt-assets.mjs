#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BELT_ROOT = path.join(ROOT, "src/assets/catalog/belts");
const BELT_MANIFEST_PATH = path.join(ROOT, "src/generated/beltCatalogManifest.ts");
const POPD_MANIFEST_PATH = path.join(ROOT, "src/generated/popdBeltMediaManifest.ts");
const POPD_RAW = "https://raw.githubusercontent.com/javanwebi/POPD";
const CONCURRENCY = 8;

function parseGeneratedTs(source, symbol) {
  const prefix = `export const ${symbol} = `;
  const start = source.indexOf(prefix);
  const end = source.lastIndexOf(" as const;");
  if (start < 0 || end < start) throw new Error(`INVALID_GENERATED_MANIFEST: ${symbol}`);
  return JSON.parse(source.slice(start + prefix.length, end));
}

function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`);
  return crypto.createHash("sha1").update(header).update(buffer).digest("hex");
}

function isWebp(buffer) {
  return buffer.length > 1000 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";
}

async function fetchAsset(entry) {
  const url = `${POPD_RAW}/${sourceCommit}/${entry.sourcePath}`;
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`HTTP_${response.status} ${entry.sourcePath}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length !== entry.size) {
        throw new Error(`SIZE_MISMATCH ${entry.sourcePath}: expected=${entry.size} actual=${buffer.length}`);
      }
      if (!isWebp(buffer)) throw new Error(`INVALID_WEBP ${entry.sourcePath}`);
      const actualSha = gitBlobSha(buffer);
      if (actualSha !== entry.sha) {
        throw new Error(`GIT_BLOB_SHA_MISMATCH ${entry.sourcePath}: expected=${entry.sha} actual=${actualSha}`);
      }
      return buffer;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise(resolve => setTimeout(resolve, attempt * 900));
    }
  }
  throw lastError;
}

async function runPool(items, worker) {
  let cursor = 0;
  const errors = [];
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        await worker(items[index], index);
      } catch (error) {
        errors.push(error);
      }
    }
  });
  await Promise.all(runners);
  if (errors.length) throw new AggregateError(errors, `POPD_BELT_ASSET_DOWNLOAD_FAILED count=${errors.length}`);
}

async function main() {
  const [beltSource, popdSource] = await Promise.all([
    fs.readFile(BELT_MANIFEST_PATH, "utf8"),
    fs.readFile(POPD_MANIFEST_PATH, "utf8"),
  ]);
  const beltManifest = parseGeneratedTs(beltSource, "beltCatalogManifest");
  const popdManifest = parseGeneratedTs(popdSource, "popdBeltMediaManifest");
  const sourceCommit = popdManifest.sourceCommit;
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error("POPD_SOURCE_COMMIT_INVALID");

  const familyEntries = Object.entries(popdManifest.families).flatMap(([familyCode, entries]) =>
    entries.map(entry => ({ ...entry, familyCode, targetPath: path.join(BELT_ROOT, "families", familyCode, entry.targetFile) }))
  );
  const skuEntries = Object.entries(popdManifest.skuPhotos).map(([skuCode, entry]) => ({
    ...entry,
    skuCode,
    targetPath: path.join(BELT_ROOT, "skus", skuCode, entry.targetFile),
  }));
  const allEntries = [...familyEntries, ...skuEntries];
  if (
    Object.keys(popdManifest.families).length !== 613 ||
    familyEntries.length !== 1496 ||
    skuEntries.length !== 214 ||
    allEntries.some(entry => !entry.sha || !entry.size || !entry.sourcePath)
  ) {
    throw new Error("POPD_BELT_MEDIA_MANIFEST_COUNTS_INVALID");
  }

  const stageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sanatpish-popd-belt-"));
  let downloaded = 0;
  try {
    await runPool(allEntries, async (entry) => {
      const existing = await fs.readFile(entry.targetPath).catch(() => null);
      if (existing && isWebp(existing) && gitBlobSha(existing) === entry.sha) {
        const staged = path.join(stageRoot, entry.familyCode ? "families" : "skus",
          entry.familyCode || entry.skuCode, entry.targetFile);
        await fs.mkdir(path.dirname(staged), { recursive: true });
        await fs.writeFile(staged, existing);
        return;
      }
      const buffer = await fetchAsset(entry);
      const staged = path.join(stageRoot, entry.familyCode ? "families" : "skus",
        entry.familyCode || entry.skuCode, entry.targetFile);
      await fs.mkdir(path.dirname(staged), { recursive: true });
      await fs.writeFile(staged, buffer, { flag: "wx" });
      downloaded++;
    });

    // Only after every source asset passed its pinned Git blob SHA do we remove
    // obsolete family/SKU photos. CAD drawings and verified specification sheets stay intact.
    for (const familyCode of Object.keys(beltManifest.families)) {
      const dir = path.join(BELT_ROOT, "families", familyCode);
      for (const file of ["family-image-01.webp", "family-image-02.webp", "family-image-03.webp", "family-image-04.webp"]) {
        await fs.rm(path.join(dir, file), { force: true });
      }
    }
    for (const skuCode of Object.keys(beltManifest.skus)) {
      await fs.rm(path.join(BELT_ROOT, "skus", skuCode, "real-product-image.webp"), { force: true });
    }

    for (const entry of familyEntries) {
      const staged = path.join(stageRoot, "families", entry.familyCode, entry.targetFile);
      await fs.mkdir(path.dirname(entry.targetPath), { recursive: true });
      await fs.copyFile(staged, entry.targetPath);
    }
    for (const entry of skuEntries) {
      const staged = path.join(stageRoot, "skus", entry.skuCode, entry.targetFile);
      await fs.mkdir(path.dirname(entry.targetPath), { recursive: true });
      await fs.copyFile(staged, entry.targetPath);
    }

    // Keep the generated runtime manifest and the missing-image audit in lockstep
    // with the exact, pinned POPD source assets.
    const nextBeltManifest = {
      ...beltManifest,
      totals: {
        ...beltManifest.totals,
        exactVerifiedRealSkuImages: skuEntries.length,
      },
      exactRealSkuIds: skuEntries.map(entry => entry.skuCode).sort((a, b) => a.localeCompare(b, "en")),
    };
    await fs.writeFile(
      BELT_MANIFEST_PATH,
      `// Generated by scripts/build-belt-catalog-assets.ts and synchronized with POPD.\nexport const beltCatalogManifest = ${JSON.stringify(nextBeltManifest)} as const;\nexport default beltCatalogManifest;\n`,
      "utf8",
    );

    console.log(
      "POPD_BELT_ASSETS_SYNC_OK",
      `sourceCommit=${sourceCommit}`,
      `families=${Object.keys(popdManifest.families).length}`,
      `familyImages=${familyEntries.length}`,
      `skuPhotos=${skuEntries.length}`,
      `downloaded=${downloaded}`,
      `missingFamilies=${popdManifest.totals.missingFamilyImages.join(",")}`,
    );
  } finally {
    await fs.rm(stageRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error("[POPD_BELT_ASSET_SYNC_FAILED]", error);
  process.exitCode = 1;
});
