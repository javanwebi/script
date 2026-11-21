import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const deploy = readFileSync(new URL("../ops/deploy-single-port-vps.sh", import.meta.url), "utf8");
const entrypoint = readFileSync(new URL("../ops/deploy-forza-only-vps.sh", import.meta.url), "utf8");
const canary = readFileSync(new URL("../ops/verify-forza-only-canary.mjs", import.meta.url), "utf8");

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
  assert.match(deploy, /FORZA_ONLY_FRONTEND_AND_DIBA_ASSETS_OK/);
});

test("Forza-only canary checks Diba, Nima, and two sequential TTS turns without an LLM call", () => {
  assert.match(canary, /serverSttProvider,\s*"diba"/);
  assert.match(canary, /serverSttReady/);
  assert.match(canary, /piper-nima-gyro-medium/);
  assert.match(canary, /FORZA_TTS_SEQUENTIAL_TURN_OK/);
  assert.match(canary, /for\s*\(let index = 1; index <= 2/);
  assert.doesNotMatch(canary, /consult-stream|forza-live|database\(\)\.query|INSERT\s+INTO|UPDATE\s+public\./i);
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
