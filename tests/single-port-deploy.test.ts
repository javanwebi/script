import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const file = (name: string) => fs.readFileSync(path.resolve(process.cwd(), name), "utf8");
const one = file("ops/deploy-single-port-vps.sh");
const launcher = file("ops/deploy-main-bluegreen-vps.sh");

test("the existing server entrypoint always uses the fixed-port release script", () => {
  assert.match(launcher, /ops\/deploy-single-port-vps\.sh/);
  assert.match(launcher, /bash -n "\$SINGLE_TMP"/);
  assert.match(launcher, /bash "\$SINGLE_TMP"/);
  assert.ok(launcher.indexOf("bash \"$SINGLE_TMP\"") < launcher.indexOf("for p in 3006"));
});

test("one fixed website host port replaces rotating blue-green publication", () => {
  assert.match(one, /FIXED_PORT=3013/);
  assert.match(one, /test "\$ACTIVE" != "\$FIXED_PORT"/);
  assert.doesNotMatch(one, /for p in 3006 3007 3008 3009/);
  const canary = one.split("===== PRIVATE CANARY WITHOUT A HOST PORT =====")[1].split("===== PROMOTE ON SAME FIXED PORT")[0];
  assert.doesNotMatch(canary, /-p "127\.0\.0\.1:/);
  assert.match(one, /-p "127\.0\.0\.1:\$FIXED_PORT:3000"/);
  assert.match(one, /verify-single-port-canary\.mjs/);
});

test("container environment capture preserves multiline values without leaking them into Docker env files", () => {
  assert.match(one, /MULTILINE_ENV_FILE=/);
  assert.match(one, /LIVE_ENV_CAPTURE_OK multiline=/);
  assert.ok(one.includes('args_out.write(b"-e\\0"+entry.encode("utf-8")+b"\\0")'));
  assert.match(one, /mapfile -d '' MULTILINE_ENV_ARGS/);
  assert.equal((one.match(/MULTILINE_ENV_ARGS/g) ?? []).length, 3);
  assert.match(one, /override_keys/);
  assert.doesNotMatch(one, /MULTILINE_ENV_UNSUPPORTED/);
});

test("promotion retains same database and storage settings and reverses failures", () => {
  assert.match(one, /--env-file "\$ENV_FILE"/);
  assert.match(one, /"\$\{MOUNTS\[@\]\}"/);
  assert.match(one, /PROMOTING=1/);
  assert.match(one, /docker stop -t 12 "\$OLD"/);
  assert.match(one, /docker start "\$OLD"/);
  assert.match(one, /cp -p "\$BACKUP\/domain" "\$CONF_DOMAIN"/);
  assert.match(one, /SINGLE_PORT_NGINX_UPDATED/);
  assert.match(one, /DOMAIN_BUILD_AND_DATABASE_OK/);
  assert.match(one, /SANATPISH_SINGLE_PORT_RELEASE_OK/);
});

test("live preflight retries health and uses the canonical domain for HTTPS SNI", () => {
  assert.match(one, /wait_for_live_health\(\)/);
  assert.match(one, /for attempt in \$\(seq 1 8\)/);
  assert.match(one, /ACTIVE_HTTP_HEALTH/);
  assert.match(one, /ACTIVE_HTTPS_HEALTH/);
  assert.match(one, /https:\/\/sanatpish\.com\/api\/health/);
  assert.match(one, /--resolve "\$resolve_domain:443:127\.0\.0\.1"/);
  assert.doesNotMatch(one, /wait_for_live_health "https:\/\/127\.0\.0\.1/);
});

test("post-promotion HTTPS and STT checks preserve canonical hostname and SNI", () => {
  const verify = one.slice(one.indexOf("===== VERIFY PUBLIC HTTPS ====="), one.indexOf("===== VERIFY DOMAIN AND IP ROUTE"));
  assert.match(verify, /domain='sanatpish\.com'/);
  assert.match(verify, /--resolve',f'\{domain\}:443:127\.0\.0\.1'/);
  assert.match(verify, /get\('\/api\/health'\)/);
  assert.match(verify, /get\('\/api\/ai\/forza-stt-info'\)/);
  assert.doesNotMatch(verify, /https:\/\/127\.0\.0\.1/);
});

test("AvalAI private config must be effective in canary before production promotion", () => {
  const gate = one.indexOf("AVALAI_CANARY_CONFIG_OK desk=avalai voice=avalai key=SET");
  const promotion = one.indexOf("===== PROMOTE ON SAME FIXED PORT");
  assert.ok(gate >= 0 && promotion > gate);
  assert.match(one.slice(gate - 900, promotion), /AVALAI_API_KEY_NOT_EFFECTIVE/);
  assert.match(one.slice(gate - 900, promotion), /PRIVATE_FORZA_CONFIG_MOUNT_OK/);
});

test("private FORZA provider credentials are mounted read-only into each release", () => {
  assert.ok(one.includes('if [[ -f "$APP/.env.forza-voice" ]]'));
  assert.ok(one.includes('-v "$APP/.env.forza-voice:/app/.env.forza-voice:ro"'));
  assert.match(one, /Always bind the canonical host FORZA config/);
});

test("old app containers stop after Nima validation and are not deleted", () => {
  const voice = one.indexOf('echo \'===== PINNED PRIVATE NIMA CANARY AND SAFE VOICE PROMOTION =====\'');
  const cleanup = one.indexOf('===== STOP OLD WEBSITE CONTAINERS WITHOUT DELETING DATA =====');
  assert.ok(voice >= 0 && cleanup > voice);
  const tail = one.slice(cleanup);
  assert.match(tail, /docker stop -t 8 "\$stale"/);
  assert.doesNotMatch(tail, /docker rm -f "\$stale"/);
  assert.match(tail, /RETAIN_REFERENCED_CONTAINER/);
});

test("owner-managed untracked mobile assets are copied into the isolated release stage", () => {
  const archive = one.indexOf('git -C "$APP" archive "$EXPECTED"');
  const build = one.indexOf('docker run --rm --pull=never');
  assert.ok(archive >= 0 && build > archive);
  const stage = one.slice(archive, build);
  assert.ok(stage.includes('if [[ -d "$APP/src/assets/IMAGESITE/mobile" ]]'));
  assert.ok(stage.includes('cp -a "$APP/src/assets/IMAGESITE/mobile/." "$STAGE/src/assets/IMAGESITE/mobile/"'));
  assert.ok(stage.includes('diff -qr "$APP/src/assets/IMAGESITE/mobile" "$STAGE/src/assets/IMAGESITE/mobile"'));
  assert.ok(stage.includes('PRESERVED_OWNER_MANAGED_MOBILE_ASSETS=YES'));
});

test("local encoder is integrated in the executed fixed-port path and full indexing gates promotion", () => {
  const prepare = one.indexOf('# Optional local vision sidecar:');
  const privateCanary = one.indexOf("echo '===== PRIVATE CANARY WITHOUT A HOST PORT ====='");
  const indexGate = one.indexOf('===== WAIT FOR COMPLETE LOCAL IMAGE INDEX BEFORE PROMOTION =====');
  const promotion = one.indexOf("echo '===== PROMOTE ON SAME FIXED PORT");
  assert.ok(prepare >= 0 && prepare < privateCanary);
  assert.ok(indexGate > privateCanary && indexGate < promotion);
  assert.match(one.slice(indexGate, promotion), /docker exec "\$CANARY_NAME"/);
  assert.match(one.slice(indexGate, promotion), /test "\$VISION_INDEX_READY" = 1/);
});
