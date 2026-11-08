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
  assert.match(stage, /if \\[\\[ -d "\\$APP\\/src\\/assets\\/IMAGESITE\\/mobile" \\]\\]/);
  assert.match(stage, /cp -a "\\$APP\\/src\\/assets\\/IMAGESITE\\/mobile\\/\\." "\\$STAGE\\/src\\/assets\\/IMAGESITE\\/mobile\\/"/);
  assert.match(stage, /diff -qr "\\$APP\\/src\\/assets\\/IMAGESITE\\/mobile" "\\$STAGE\\/src\\/assets\\/IMAGESITE\\/mobile"/);
  assert.match(stage, /PRESERVED_OWNER_MANAGED_MOBILE_ASSETS=YES/);
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
