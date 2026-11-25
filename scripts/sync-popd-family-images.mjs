#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET_ROOT = path.join(ROOT, "public/images/nonbelt-studio");
const SOURCE_COMMIT = "e81218f2a248f1db9a72349a67e46af55c7977ee";
const RAW_BASE = `https://raw.githubusercontent.com/javanwebi/POPD/${SOURCE_COMMIT}/public/images/nonbelt-studio`;
const CONCURRENCY = 4;
const ASSETS = [
  { name: "roller-lug-finger.jpg", sha: "39872694fec5d9cf7e347d6cef379d38f79d85e0", size: 328004 },
  { name: "wire-wheel-brush.jpg", sha: "952b6ac634c65a8d1ed159e2927f3c71d8e520fc", size: 651750 },
  { name: "drive-pulley.jpg", sha: "6d6837ccc1f3563f3ab20e7d1fab3956ca9a8351", size: 548783 },
  { name: "squeegee-blade-pu.jpg", sha: "4866933c66520892f8e9096c23fd2262ad98ce10", size: 236615 },
  { name: "roller-retaining-clip.jpg", sha: "77d925ac699ad9f1c866ac41cf2ffe1ee1d826a0", size: 465932 },
  { name: "double-roller-chain.jpg", sha: "e1e03600a03231229372da453a4c806fc9c180fd", size: 746206 },
  { name: "hose-barb-fitting.jpg", sha: "b797b5fbdcbb21b18edd9d6a9b512e66eed1e998", size: 541839 },
  { name: "hose-wire.jpg", sha: "7af17b0fa874714644353e7bdc662c7d1950fca2", size: 768300 },
  { name: "hose-plain.jpg", sha: "2f6f016e0a4431323406cc741acedfa979ea1519", size: 600647 },
  { name: "industrial-mold.jpg", sha: "cd1f1cb097a153a6ec97e6042669471663d313d9", size: 546453 },
  { name: "pillow-block-base.jpg", sha: "9a1cd0ed9adcd0613949db3be9f260fd4e31da6b", size: 504529 },
  { name: "bearing-locknut.jpg", sha: "a0522b2f51119526aa4f929cf1c3db84f2e04f6e", size: 490545 },
];

function gitBlobSha(buffer) {
  return crypto.createHash("sha1")
    .update(Buffer.from(`blob ${buffer.length}\0`))
    .update(buffer)
    .digest("hex");
}

function isJpeg(buffer) {
  return buffer.length > 1000 &&
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

async function fetchAsset(asset) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(`${RAW_BASE}/${asset.name}`, {
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) throw new Error(`POPD_FAMILY_IMAGE_HTTP_${response.status}: ${asset.name}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length !== asset.size) {
        throw new Error(`POPD_FAMILY_IMAGE_SIZE_MISMATCH ${asset.name}: expected=${asset.size} actual=${buffer.length}`);
      }
      if (!isJpeg(buffer)) throw new Error(`POPD_FAMILY_IMAGE_JPEG_SIGNATURE_INVALID: ${asset.name}`);
      const sha = gitBlobSha(buffer);
      if (sha !== asset.sha) throw new Error(`POPD_FAMILY_IMAGE_SHA_MISMATCH ${asset.name}: expected=${asset.sha} actual=${sha}`);
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
      try { await worker(items[index], index); }
      catch (error) { errors.push(error); }
    }
  });
  await Promise.all(runners);
  if (errors.length) throw new AggregateError(errors, `POPD_FAMILY_IMAGE_SYNC_FAILED count=${errors.length}`);
}

async function main() {
  await fs.mkdir(TARGET_ROOT, { recursive: true });
  const stageRoot = await fs.mkdtemp(path.join(TARGET_ROOT, ".popd-family-sync-"));
  let downloaded = 0;
  let reused = 0;
  const staged = new Map();
  try {
    await runPool(ASSETS, async asset => {
      const target = path.join(TARGET_ROOT, asset.name);
      const existing = await fs.readFile(target).catch(() => null);
      if (existing && existing.length === asset.size && isJpeg(existing) && gitBlobSha(existing) === asset.sha) {
        reused++;
        return;
      }
      const buffer = await fetchAsset(asset);
      const stagedPath = path.join(stageRoot, asset.name);
      await fs.writeFile(stagedPath, buffer, { flag: "wx", mode: 0o644 });
      staged.set(asset.name, stagedPath);
      downloaded++;
    });

    // All missing/replaced files are downloaded and SHA-verified before any
    // existing public image is replaced.
    for (const asset of ASSETS) {
      const stagedPath = staged.get(asset.name);
      if (!stagedPath) continue;
      await fs.rename(stagedPath, path.join(TARGET_ROOT, asset.name));
    }

    console.log(
      "POPD_FAMILY_IMAGES_SYNC_OK",
      `sourceCommit=${SOURCE_COMMIT}`,
      `images=${ASSETS.length}`,
      `downloaded=${downloaded}`,
      `reused=${reused}`,
    );
  } finally {
    await fs.rm(stageRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error("[POPD_FAMILY_IMAGES_SYNC_FAILED]", error);
  process.exitCode = 1;
});
