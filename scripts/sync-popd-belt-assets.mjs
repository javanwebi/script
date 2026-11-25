#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BELT_ROOT = path.join(ROOT, "src/assets/catalog/belts");
const BELT_MANIFEST_PATH = path.join(ROOT, "src/generated/beltCatalogManifest.ts");
const POPD_MANIFEST_PATH = path.join(ROOT, "src/generated/popdBeltMediaManifest.ts");
const POPD_RAW = "https://raw.githubusercontent.com/javanwebi/POPD";
const CONCURRENCY = 8;
let sourceCommit = "";

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
  sourceCommit = popdManifest.sourceCommit;
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
    skuEntries.length !== 18 ||
    allEntries.some(entry => !entry.sha || !entry.size || !entry.sourcePath)
  ) {
    throw new Error("POPD_BELT_MEDIA_MANIFEST_COUNTS_INVALID");
  }

  const stageRoot = await fs.mkdtemp(path.join(BELT_ROOT, ".popd-sync-"));
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

    // Every new source asset has now been downloaded and SHA-verified in staging.
    // Rename each replacement atomically over its old file before removing anything.
    for (const entry of familyEntries) {
      const staged = path.join(stageRoot, "families", entry.familyCode, entry.targetFile);
      await fs.mkdir(path.dirname(entry.targetPath), { recursive: true });
      await fs.rename(staged, entry.targetPath);
    }
    for (const entry of skuEntries) {
      const staged = path.join(stageRoot, "skus", entry.skuCode, entry.targetFile);
      await fs.mkdir(path.dirname(entry.targetPath), { recursive: true });
      await fs.rename(staged, entry.targetPath);
    }

    // Remove obsolete photos only after all verified replacements are installed.
    // Preserve every CAD drawing and specification sheet.
    for (const familyCode of Object.keys(beltManifest.families)) {
      const expected = new Set((popdManifest.families[familyCode] || []).map(entry => entry.targetFile));
      const dir = path.join(BELT_ROOT, "families", familyCode);
      for (const file of ["family-image-01.webp", "family-image-02.webp", "family-image-03.webp", "family-image-04.webp"]) {
        if (!expected.has(file)) await fs.rm(path.join(dir, file), { force: true });
      }
    }
    for (const skuCode of Object.keys(beltManifest.skus)) {
      if (!popdManifest.skuPhotos[skuCode]) {
        await fs.rm(path.join(BELT_ROOT, "skus", skuCode, "real-product-image.webp"), { force: true });
      }
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

    const reportPath = path.join(ROOT, "docs/belt-missing-sku-real-images.json");
    const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
    const previousMissing = new Map(
      (Array.isArray(report.missingSkus) ? report.missingSkus : []).map(row => [String(row.skuCode), row]),
    );
    const missingSkus = Object.keys(beltManifest.skus)
      .filter(skuCode => !popdManifest.skuPhotos[skuCode])
      .map(skuCode => previousMissing.get(skuCode) || ({
        skuCode,
        familyCode: beltManifest.skus[skuCode],
        division: "unknown",
        status: "REAL_IMAGE_NOT_FOUND",
      }));
    const missingByDivision = {};
    for (const row of missingSkus) {
      const division = String(row.division || "unknown");
      missingByDivision[division] = (missingByDivision[division] || 0) + 1;
    }
    report.generatedAt = new Date().toISOString();
    report.totalRealBeltSkus = Object.keys(beltManifest.skus).length;
    report.exactVerifiedRealSkuImagesCount = skuEntries.length;
    report.exactVerifiedRealSkus = skuEntries.map(entry => ({
      skuCode: entry.skuCode,
      familyCode: beltManifest.skus[entry.skuCode] || null,
      assetPath: `/src/assets/catalog/belts/skus/${entry.skuCode}/real-product-image.webp`,
      sourcePath: entry.sourcePath,
      sourceCommit,
      noteFa: entry.kind === "real-marking"
        ? "تصویر واقعی اختصاصی با مرجع علامت‌گذاری‌شده در POPD"
        : "تصویر محصول اختصاصی متصل به کد کالا در POPD",
    }));
    report.missingRealImageCount = missingSkus.length;
    report.missingByDivision = missingByDivision;
    report.missingSkus = missingSkus;
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");

    const markdown = [
      "# گزارش تصاویر واقعی اختصاصی تسمه‌های صنعتی",
      "",
      `- منبع تصاویر: \`javanwebi/POPD\` در commit \`${sourceCommit}\``,
      `- خانواده‌های تسمه در SCRIPT: ${Object.keys(beltManifest.families).length}`,
      `- خانواده‌های دارای تصاویر POPD: ${Object.keys(popdManifest.families).length}`,
      `- فایل‌های تصویر خانواده: ${familyEntries.length}`,
      `- خانواده بدون تصویر مرجع: ${popdManifest.totals.missingFamilyImages.join("، ")}`,
      `- کدهای تسمه در SCRIPT: ${Object.keys(beltManifest.skus).length}`,
      `- کدهای دارای تصویر واقعی POPD: ${skuEntries.length} (تصاویر وب: ${popdManifest.totals.skuWebImages}، تصاویر دارای علامت واقعی: ${popdManifest.totals.skuRealMarkingImages})`,
      `- کدهای بدون تصویر واقعی اختصاصی: ${missingSkus.length}`,
      "",
      "برای کدهای بدون تصویر واقعی، هیچ تصویر مشابه، عمومی یا جایگزین نمایش داده نمی‌شود. نقشه فنی SKU نیز فقط همراه تصویر واقعی همان کد در گالری منتشر می‌شود.",
      "",
      "فهرست کامل کدهای بدون تصویر و کدهای دارای تصویر در فایل JSON همین گزارش نگهداری می‌شود.",
      "",
    ].join("\n");
    await fs.writeFile(path.join(ROOT, "docs/belt-missing-sku-real-images.md"), markdown, "utf8");

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
