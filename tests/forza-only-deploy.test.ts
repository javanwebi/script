import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const deploy = readFileSync(new URL("../ops/deploy-single-port-vps.sh", import.meta.url), "utf8");
const entrypoint = readFileSync(new URL("../ops/deploy-forza-only-vps.sh", import.meta.url), "utf8");
const canary = readFileSync(new URL("../ops/verify-forza-only-canary.mjs", import.meta.url), "utf8");
const server = readFileSync(new URL("../server.ts", import.meta.url), "utf8");
const voiceUpgrade = readFileSync(new URL("../ops/upgrade-forza-realtime-vps.sh", import.meta.url), "utf8");
const deployWorkflow = readFileSync(new URL("../.github/workflows/deploy-production-after-main-ci.yml", import.meta.url), "utf8");
const engineWorkflow = readFileSync(new URL("../.github/workflows/forza-conversation-engine.yml", import.meta.url), "utf8");
const nimaWorkflow = readFileSync(new URL("../.github/workflows/forza-nima-private.yml", import.meta.url), "utf8");
const browserWorkflow = readFileSync(new URL("../.github/workflows/forza-browser-smoke.yml", import.meta.url), "utf8");
const privateBrowserWorkflow = readFileSync(new URL("../.github/workflows/forza-private-ubuntu-browser.yml", import.meta.url), "utf8");

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
  assert.match(deploy, /upgrade-forza-realtime-vps\.sh/);
  assert.doesNotMatch(deploy, /FORZA_ONLY_PRIVATE_NIMA_CONTAINER_RETAINED=YES/);
  assert.match(voiceUpgrade, /FORZA_SENTENCE_STREAM_CANARY/);
  assert.match(voiceUpgrade, /FORZA_SITE_SENTENCE_STREAM_OK/);
  assert.match(voiceUpgrade, /FORZA_NIMA_LENGTH_SCALE/);
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

test("Forza-only canary checks live Diba streaming, Nima, and two sequential TTS turns without an LLM call", () => {
  assert.match(canary, /serverSttProvider === "diba"/);
  assert.match(canary, /serverSttReady/);
  assert.match(canary, /serverLiveSttReady === true/);
  assert.match(canary, /api\/forza-stt-stream/);
  assert.match(canary, /sampleRate: 16000/);
  assert.match(canary, /Buffer\.alloc\(6400\)/);
  assert.match(canary, /FORZA_DIBA_LIVE_STREAM_OK/);
  assert.match(canary, /FORZA_CANARY_EXISTING_VISION_INDEX_READ_ONLY_OK/);
  assert.match(canary, /piper-nima-gyro-medium/);
  assert.match(canary, /generated_audio_persisted, false/);
  assert.match(canary, /FORZA_TTS_SEQUENTIAL_TURN_OK/);
  assert.match(canary, /FORZA_TTS_STREAM_CANARY_OK/);
  assert.match(canary, /for\s*\(let index = 1; index <= 2/);
  assert.doesNotMatch(canary, /consult-stream|forza-live|database\(\)\.query|INSERT\s+INTO|UPDATE\s+public\./i);
});

test("main CI deploy routes only the exact Forza-only commit through the safe entrypoint", () => {
  assert.match(deployWorkflow, /Classify exact main release as Forza-only or standard/);
  assert.ok(deployWorkflow.indexOf("Classify exact main release") < deployWorkflow.indexOf("Verify every required main check"));
  assert.match(deployWorkflow, /FORZA Conversation Engine/);
  assert.match(deployWorkflow, /FORZA autoplay\/microphone UX smoke/);
  assert.match(deployWorkflow, /FORZA private Ubuntu Pocket browser integration/);
  assert.match(deployWorkflow, /FORZA Nima private voice and SSE speech tests/);
  assert.ok(deployWorkflow.indexOf('"FORZA Nima private voice and SSE speech tests"') >
    deployWorkflow.indexOf("REQUIRED_WORKFLOWS = ["),"Nima private test must be a required Forza deploy check");
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

test("Forza Conversation Engine runs on main pushes for the production deploy gate",()=>{
  const push=engineWorkflow.slice(engineWorkflow.indexOf("\n  push:"),engineWorkflow.indexOf("\npermissions:"));
  assert.match(push,/branches:\s*\n\s*- main/);
});

test("private Nima streaming validation runs on main pushes before Forza deployment",()=>{
  const start=nimaWorkflow.indexOf("\n  push:");
  const end=nimaWorkflow.indexOf("\n  workflow_dispatch:",start);
  assert.ok(start>=0&&end>start,"private Nima workflow must define a main push trigger");
  const push=nimaWorkflow.slice(start,end);
  assert.match(push,/branches:\s*\[main\]/);
  assert.match(push,/scripts\/forza_nima_voice_http\.py/);
  assert.match(push,/tests\/forzaNimaWavFrames\.test\.ts/);
});

test("Forza browser and private Pocket integration checks run on main pushes",()=>{
  for(const [name,workflow] of [
    ["browser smoke",browserWorkflow],
    ["private Pocket browser",privateBrowserWorkflow],
  ]){
    const start=workflow.indexOf("\n  push:");
    const end=workflow.indexOf("\n  workflow_dispatch:",start);
    assert.ok(start>=0&&end>start,name+" must define a main push trigger");
    const push=workflow.slice(start,end);
    assert.match(push,/branches:\s*\n\s*- main/);
  }
  assert.match(browserWorkflow,/tests\/forza-smart-turn\.test\.ts/);
  assert.match(privateBrowserWorkflow,/tests\/forzaVoiceRecoveryUi\.test\.ts/);
});

test("Forza-only release classifier includes only the reviewed call-engine fix paths",()=>{
  for(const path of [
    ".github/workflows/deploy-production-after-main-ci.yml",
    ".github/workflows/verify-vps-build.yml",
    ".github/workflows/forza-browser-smoke.yml",
    ".github/workflows/forza-conversation-engine.yml",
    ".github/workflows/forza-nima-private.yml",
    ".github/workflows/forza-private-ubuntu-browser.yml",
    "ops/deploy-forza-only-vps.sh",
    "ops/deploy-single-port-vps.sh",
    "tests/forza-only-deploy.test.ts",
    "src/components/forza/AiForzaCallExperience.tsx",
    "server.ts",
    "ops/verify-forza-only-canary.mjs",
    "ops/upgrade-forza-realtime-vps.sh",
    "scripts/forza_nima_voice_http.py",
    "src/utils/forzaNimaBufferedSpeech.ts",
    "src/utils/forzaNimaWavFrames.ts",
    "tests/forzaNimaWavFrames.test.ts",
    "tests/forzaNimaBufferedSpeech.test.ts",
    "src/utils/forzaUnbrokenText.ts",
    "tests/forzaUnbrokenFullAnswer.test.ts",
    "src/utils/forzaSpeechPipeline.ts",
    "src/utils/forzaIncrementalSpeechText.ts",
    "src/utils/forzaTtsConcurrency.ts",
    "src/utils/forzaAudioEvidence.ts",
    "src/utils/forzaLiveSttClient.ts",
    "server/ai/forzaDibaLiveStt.ts",
    "scripts/forza_diba_live_worker.py",
    "public/worklets/forza-stt-pcm.js",
    "tests/forzaLiveSttClient.test.ts",
    "tests/test_forza_nima_private.py",
    "tests/forzaCallPlainText.test.ts",
    "tests/forzaNimaIncrementalSpeech.test.ts",
    "tests/forzaTtsConcurrency.test.ts",
    "tests/test_forza_diba_live_worker.py",
    "src/utils/forzaSpeechAdmission.ts",
    "tests/forzaSpeechAdmission.test.ts",
    "tests/forzaBrowserRecognitionLifecycle.test.ts",
    "tests/forzaCallTeardown.test.ts",
    "tests/forzaConversationContinuity.test.ts",
    "tests/forzaLocalDibaStreaming.test.ts",
    "public/worklets/forza-foreground-gate.js",
    "tests/forzaAudioEvidence.test.ts",
    "scripts/tests/forza-local-diba-browser.cjs",
    "src/utils/silenceDetector.ts",
    ".github/workflows/forza-browser-smoke.yml",
    ".github/workflows/forza-private-ubuntu-browser.yml",
    ".github/workflows/forza-nima-private.yml",
    "tests/forza-smart-turn.test.ts",
    "tests/forzaVoiceRecoveryUi.test.ts",
  ]){
    assert.ok(deployWorkflow.includes(path),`release classifier must allow ${path}`);
  }
  assert.match(deployWorkflow,/public\/worklets\/forza-foreground-gate\.js/);
  assert.match(deployWorkflow,/scripts\/tests\/forza-local-diba-browser\.cjs/);
  assert.match(deployWorkflow,/tests\/forzaAudioEvidence\.test\.ts/);
  assert.match(deployWorkflow,/server\/ai\/forzaDibaLiveStt\.ts/);
  assert.match(deployWorkflow,/scripts\/forza_diba_live_worker\.py/);
  assert.match(deployWorkflow,/public\/worklets\/forza-stt-pcm\.js/);
  assert.match(deployWorkflow,/tests\/forzaLiveSttClient\.test\.ts/);
  assert.match(deployWorkflow,/FORZA_ONLY_RELEASE_HAS_UNEXPECTED_FILES/);
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
