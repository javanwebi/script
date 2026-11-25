#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const POPD_COMMIT = "e81218f2a248f1db9a72349a67e46af55c7977ee";
const E869_JSON_URL = `https://raw.githubusercontent.com/javanwebi/POPD/${POPD_COMMIT}/deliverables/catalog-869-audit/e869_linked_catalog.json`;
const CATALOG_TREE_URL = "https://api.github.com/repos/javanwebi/POPD/git/trees/7069731296b73f6ba2613c89de84d6f1ace20643?recursive=1";
const RAW_BASE = `https://raw.githubusercontent.com/javanwebi/POPD/${POPD_COMMIT}/public/storage/products/catalog`;
const CONCURRENCY = 8;
const ROOT = path.resolve(process.env.PRODUCT_STORAGE_DIR || "/data/storage/products");
const RELEASES_DIR = path.join(ROOT, "catalog-releases");
const CURRENT_LINK = path.join(ROOT, "catalog-current");

function gitBlobSha(buffer) {
  return crypto.createHash("sha1")
    .update(Buffer.from(`blob ${buffer.length}\0`))
    .update(buffer)
    .digest("hex");
}

function isPng(buffer) {
  return buffer.length > 1000 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}: ${url}`);
  return response.json();
}

async function downloadImage(entry) {
  const url = `${RAW_BASE}/${entry.name}`;
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
      if (!response.ok) throw new Error(`IMAGE_HTTP_${response.status}: ${entry.name}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length !== entry.size) {
        throw new Error(`IMAGE_SIZE_MISMATCH ${entry.name}: expected=${entry.size} actual=${buffer.length}`);
      }
      if (!isPng(buffer)) throw new Error(`IMAGE_PNG_SIGNATURE_INVALID: ${entry.name}`);
      const sha = gitBlobSha(buffer);
      if (sha !== entry.sha) throw new Error(`IMAGE_GIT_BLOB_SHA_MISMATCH ${entry.name}: expected=${entry.sha} actual=${sha}`);
      return buffer;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise(resolve => setTimeout(resolve, attempt * 1200));
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
  if (errors.length) throw new AggregateError(errors, `POPD_CATALOG_DOWNLOAD_FAILED count=${errors.length}`);
}

async function validateExistingRelease(releaseDir, entries) {
  for (const entry of entries) {
    const file = path.join(releaseDir, entry.name);
    const buffer = await fs.readFile(file).catch(() => null);
    if (!buffer || buffer.length !== entry.size || !isPng(buffer) || gitBlobSha(buffer) !== entry.sha) return false;
  }
  return true;
}

async function switchCurrentLink(releaseDir) {
  const currentStat = await fs.lstat(CURRENT_LINK).catch(() => null);
  if (currentStat && !currentStat.isSymbolicLink()) {
    throw new Error("CATALOG_CURRENT_EXISTS_BUT_IS_NOT_A_SYMLINK; refusing to replace a live directory");
  }
  const tempLink = path.join(ROOT, `.catalog-current-${process.pid}-${Date.now()}.next`);
  const relativeTarget = path.relative(ROOT, releaseDir);
  await fs.symlink(relativeTarget, tempLink, "dir");
  try {
    // rename() atomically swaps the symlink pointer. The previous catalog and
    // any old container reading /data/storage/products/catalog remain untouched.
    await fs.rename(tempLink, CURRENT_LINK);
  } finally {
    await fs.rm(tempLink, { force: true }).catch(() => {});
  }
}

async function main() {
  if (!path.isAbsolute(ROOT)) throw new Error("PRODUCT_STORAGE_DIR_MUST_BE_ABSOLUTE");
  await fs.mkdir(RELEASES_DIR, { recursive: true, mode: 0o750 });

  const [mapping, treePayload] = await Promise.all([
    fetchJson(E869_JSON_URL),
    fetchJson(CATALOG_TREE_URL),
  ]);
  const assignments = Array.isArray(mapping.assignments) ? mapping.assignments : [];
  if (
    Number(mapping.totalImages) !== 869 ||
    Number(mapping.linkedImages) !== 869 ||
    Number(mapping.uniqueSkusLinked) !== 869 ||
    assignments.length !== 869
  ) throw new Error("POPD_E869_MAPPING_TOTALS_INVALID");

  const skuCodes = new Set();
  const imageNames = new Set();
  for (const assignment of assignments) {
    const sku = String(assignment?.skuCode || "").trim();
    const match = String(assignment?.url || "").match(/^\/storage\/products\/catalog\/e\(([1-9]\d{0,3})\)\.png$/);
    if (assignment?.targetKind !== "variant" || !sku || !match) {
      throw new Error("POPD_E869_MAPPING_ENTRY_INVALID: " + sku);
    }
    if (skuCodes.has(sku) || imageNames.has(`e(${match[1]}).png`)) {
      throw new Error("POPD_E869_MAPPING_DUPLICATE: " + sku);
    }
    skuCodes.add(sku);
    imageNames.add(`e(${match[1]}).png`);
  }
  if (skuCodes.size !== 869 || imageNames.size !== 869 || [...Array(869)].some((_, index) => !imageNames.has(`e(${index + 1}).png`))) {
    throw new Error("POPD_E869_MAPPING_UNIQUENESS_INVALID");
  }

  const files = (treePayload.tree || [])
    .filter(entry => entry.type === "blob" && /^e\([1-9]\d{0,3}\)\.png$/.test(entry.path))
    .map(entry => ({ name: entry.path, sha: entry.sha, size: Number(entry.size) }));
  const fileNames = new Set(files.map(file => file.name));
  if (
    files.length !== 869 ||
    fileNames.size !== 869 ||
    [...Array(869)].some((_, index) => !fileNames.has(`e(${index + 1}).png`)) ||
    [...imageNames].some(name => !fileNames.has(name)) ||
    files.some(file => !Number.isInteger(file.size) || file.size <= 1000 || !/^[a-f0-9]{40}$/.test(file.sha))
  ) throw new Error("POPD_E869_SOURCE_TREE_INVALID");

  let releaseDir = path.join(RELEASES_DIR, POPD_COMMIT);
  if (await validateExistingRelease(releaseDir, files)) {
    await switchCurrentLink(releaseDir);
    console.log("POPD_CATALOG_IMAGE_SYNC_OK", `sourceCommit=${POPD_COMMIT}`, "images=869", "downloaded=0", "reused=869");
    return;
  }

  const existingRelease = await fs.lstat(releaseDir).catch(() => null);
  if (existingRelease) releaseDir = path.join(RELEASES_DIR, `${POPD_COMMIT}-${Date.now()}`);
  const stageDir = await fs.mkdtemp(path.join(RELEASES_DIR, ".staging-"));
  let downloaded = 0;
  try {
    await runPool(files, async entry => {
      const buffer = await downloadImage(entry);
      await fs.writeFile(path.join(stageDir, entry.name), buffer, { flag: "wx", mode: 0o640 });
      downloaded++;
    });

    if (!(await validateExistingRelease(stageDir, files))) {
      throw new Error("POPD_E869_STAGED_RELEASE_FAILED_FINAL_INTEGRITY_CHECK");
    }

    await fs.rename(stageDir, releaseDir);
    await switchCurrentLink(releaseDir);
    console.log(
      "POPD_CATALOG_IMAGE_SYNC_OK",
      `sourceCommit=${POPD_COMMIT}`,
      `images=${files.length}`,
      `bytes=${files.reduce((sum, file) => sum + file.size, 0)}`,
      `downloaded=${downloaded}`,
      `uniqueSkuLinks=${skuCodes.size}`,
    );
  } catch (error) {
    await fs.rm(stageDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

main().catch(error => {
  console.error("[POPD_CATALOG_IMAGE_SYNC_FAILED]", error);
  process.exitCode = 1;
});
