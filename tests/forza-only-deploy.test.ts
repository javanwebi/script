import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const deploy = readFileSync(new URL("../ops/deploy-single-port-vps.sh", import.meta.url), "utf8");
const entrypoint = readFileSync(new URL("../ops/deploy-forza-only-vps.sh", import.meta.url), "utf8");
const canary = readFileSync(new URL("../ops/verify-forza-only-canary.mjs", import.meta.url), "utf8");
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const deployWorkflow = readFileSync(new URL("../.github/workflows/deploy-production-after-main-ci.yml", import.meta.url), "utf8");

test("Forza-only deployment skips every catalog/customer database migration block", () => {
  const marker = 'if [[ "$FORZA_ONLY" == "1" ]]; then\n  # Strict Forza-only release:';
  const start = deploy.indexOf(marker);
  assert.notEqual(start, -1, "Forza-only migration guard must exist");
  const elseAt = deploy.indexOf("\nelse\n", start);
  assert.ok(elseAt > start, "normal deployment migration branch must remain available");
  const forzOnlyBranch = deploy.slice(start, elseAt);
  assert.match(forzOnlyBranch, /FORZA_ONLY_DATABASE_MIGRATIONS_SKIPPED=YES/);
  assert.doesNotMatch(forzOnlyBranch, /database\(\)\.query|INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|ALTER\s+TABLE|CREATE\s+TABLE/i);
  assert.match(deploy, /CATALOG_IMAGE_VOLUME_MIGRATE_ON_BOOT=false/);
});

test("Forza-only deployment runs voice tests and never promotes unrelated private services", () => {
  assert.match(deploy, /npm run test:forza-engine/);
  assert.match(deploy, /tests\/forza\*\.test\.ts/);
  assert.match(deploy, /verify-forza-only-canary\.mjs/);
  assert.match(deploy, /FORZA_ONLY_PRIVATE_NIMA_CONTAINER_RETAINED=YES/);
  assert.match(deploy, /FORZA_ONLY_EXISTING_VISION_SIDECAR_PRESERVED=YES/);
  assert.match(deploy, /FORZA_ONLY_LIVE_VISION_INDEX_READ_ONLY_BASELINE_OK/);
  assert.match(deploy, /FORZA_ONLY_FRONTEND_AND_DIBA_ASSETS_OK/);
  assert.match(deploy, /def wait_json/);
  assert.match(deploy, /PUBLIC_FORZA_TTS_WAV_OK/);
});

test("Forza-only canary loads the persisted visual index read-only without changing production warmup", () => {
  const start = server.indexOf("function warmCatalogVisualIndex");
  const end = server.indexOf("\n}\n\n// Ensure catalog images cache folder exists", start);
  assert.notEqual(start, -1, "visual index warmup function must exist");
  assert.ok(end > start, "visual index warmup function boundary must exist");
  const warmup = server.slice(start, end);
  const guardEnd = warmup.indexOf("if(Date.now()<nextVisualIndexBuild)");
  assert.ok(guardEnd > 0, "read-only guard must precede the normal updater");
  const guard = warmup.slice(0, guardEnd);
  assert.match(guard, /SANATPISH_FORZA_ONLY_READ_ONLY_INDEX/);
  assert.match(guard, /catalogVisualIndex\.load\(\)/);
  assert.doesNotMatch(guard, /catalogVisualIndex\.update\(/);
  assert.match(deploy, /CANARY_EXTRA_ENV\+=\(-e SANATPISH_FORZA_ONLY_READ_ONLY_INDEX=1\)/);
  assert.doesNotMatch(deploy, /APP_EXTRA_ENV\+=\(-e SANATPISH_FORZA_ONLY_READ_ONLY_INDEX=1\)/);
  assert.match(canary, /FORZA_CANARY_VISION_INDEX_HAS_PENDING_WRITES/);
});

test("Forza-only canary checks Diba, Nima, and two sequential TTS turns without an LLM call", () => {
  assert.match(canary, /serverSttProvider === "diba"/);
  assert.match(canary, /serverSttReady/);
  assert.match(canary, /FORZA_CANARY_EXISTING_VISION_INDEX_READ_ONLY_OK/);
  assert.match(canary, /piper-nima-gyro-medium/);
  assert.match(canary, /generated_audio_persisted, false/);
  assert.match(canary, /FORZA_TTS_SEQUENTIAL_TURN_OK/);
  assert.match(canary, /for\s*\(let index = 1; index <= 2/);
  assert.doesNotMatch(canary, /consult-stream|forza-live|database\(\)\.query|INSERT\s+INTO|UPDATE\s+public\./i);
});

test("main CI deploy routes only the exact Forza-only commit through the safe entrypoint", () => {
  assert.match(deployWorkflow, /Classify exact main release as Forza-only or standard/);
  assert.ok(deployWorkflow.indexOf("Classify exact main release") < deployWorkflow.indexOf("Verify every required main check"));
  assert.match(deployWorkflow, /FORZA Conversation Engine/);
  assert.match(deployWorkflow, /if \[\[ "\$FORZA_ONLY" == "true" \]\]; then[\s\S]*FORZA Conversation Engine/);
  assert.match(deployWorkflow, /Verify VPS frontend build before deployment/);
  assert.match(deployWorkflow, /forza_only=true/);
  assert.match(deployWorkflow, /FORZA_ONLY_RELEASE_HAS_UNEXPECTED_FILES/);
  assert.match(deployWorkflow, /Deploy exact Forza-only main commit without database migrations/);
  assert.match(deployWorkflow, /ops\/deploy-forza-only-vps\.sh/);
  assert.match(deployWorkflow, /Deploy standard main release/);
  assert.match(entrypoint, /REQUESTED_SHA="\$\{1:-\}"/);
  assert.match(entrypoint, /merge-base --is-ancestor/);
});

test("standalone entrypoint pins origin/main without resetting the server worktree", () => {
  assert.match(entrypoint, /git -C "\$APP" fetch --no-tags origin main/);
  assert.match(entrypoint, /git -C "\$APP" rev-parse FETCH_HEAD/);
  assert.match(entrypoint, /git -C "\$APP" show "\$SHA:ops\/deploy-single-port-vps\.sh"/);
  assert.match(entrypoint, /SANATPISH_FORZA_ONLY=1/);
  assert.match(entrypoint, /FORZA_ONLY_DATABASE_MIGRATIONS_SKIPPED=YES/);
  assert.doesNotMatch(entrypoint, /git\s+-C\s+["']?\$APP["']?\s+(reset|clean|checkout|pull)/);
  assert.doesNotMatch(entrypoint, /sanatpish-deploy-main|deploy-main-bluegreen-vps\.sh/);
});
