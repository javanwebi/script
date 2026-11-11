import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const file = (name: string) => fs.readFileSync(path.resolve(process.cwd(), name), "utf8");
const one = file("ops/deploy-single-port-vps.sh");
const launcher = file("ops/deploy-main-bluegreen-vps.sh");
const mainEntrypoint = file("ops/sanatpish-deploy-main.sh");
const nimaDeploy = file("ops/deploy-forza-nima-pinned-vps.sh");

test("Nima promotion accepts only the canonical isolated release directory created by the site deployer", () => {
  assert.match(one, /RELEASE_ROOT="\$DEPLOY_ROOT\/releases"/);
  assert.match(one, /STAGE="\$RELEASE_ROOT\/\$STAMP"/);
  assert.match(nimaDeploy, /RELEASE_ROOT=\/opt\/sanatpish\/\.deploy\/releases/);
  assert.match(nimaDeploy, /\[\[ "\$STAGE" == "\$RELEASE_ROOT\/"\* \]\]/);
  assert.match(nimaDeploy, /dirname -- "\$STAGE"/);
  assert.match(nimaDeploy, /\[\[ -d "\$STAGE" && ! -L "\$STAGE" \]\]/);
  assert.match(nimaDeploy, /realpath -e -- "\$STAGE"/);
  assert.doesNotMatch(nimaDeploy, /\/opt\/sanatpish-unified-stage-/);
});

test("the canonical command deploys pinned main and fast-forwards the /opt/sanatpish source checkout only after successful promotion", () => {
  assert.match(mainEntrypoint, /APP=\/opt\/sanatpish/);
  assert.match(mainEntrypoint, /CURRENT_BRANCH=.*branch --show-current/);
  assert.match(mainEntrypoint, /\[\[ "\$CURRENT_BRANCH" == "main" \]\]/);
  assert.match(mainEntrypoint, /git -C "\$APP" diff --quiet && git -C "\$APP" diff --cached --quiet/);
  assert.match(mainEntrypoint, /git -C "\$APP" merge-base --is-ancestor HEAD "\$SHA"/);
  const deploy = mainEntrypoint.indexOf('SANATPISH_RELEASE_SHA="$SHA" bash "$TEMP"');
  const sync = mainEntrypoint.indexOf('git -C "$APP" merge --ff-only "$SHA"');
  assert.ok(deploy >= 0 && sync > deploy, "source checkout must only fast-forward after a successful deployment");
  assert.match(mainEntrypoint, /SOURCE_CHECKOUT_UPDATED path=\$APP commit=\$SHA/);
  assert.match(mainEntrypoint, /test "\$\(git -C "\$APP" rev-parse HEAD\)" = "\$SHA"/);
});

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

test("read-only SPA guard validation scans the complete root block without weakening the guard", () => {
  assert.ok(one.includes("def nginx_block_at(text, opening_brace):"));
  assert.ok(one.includes("def nginx_depth_before(text, stop):"));
  assert.ok(one.includes("def require_read_only_spa_guard(root_block, filename):"));
  assert.ok(one.includes('set(methods) not in ({"GET"},{"GET","HEAD"})'));
  assert.ok(one.includes("deny[ \\t]+all"));
  assert.ok(one.includes("root_block=nginx_block_at(source,roots[0].end()-1)"));
  assert.ok(one.includes("READ_ONLY_SPA_GUARD_OK"));
  assert.equal(one.includes("roots[0].start()+700"), false);
});

test("Nginx SPA guard parser handles long blocks, nested locations, comments and quoted braces", () => {
  const helperStart = one.indexOf("def nginx_block_at(text, opening_brace):");
  const helperEnd = one.indexOf("\ncontents=[Path(p).read_text() for p in files]", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const helper = one.slice(helperStart, helperEnd);
  const fixture = `
import re
${helper}
source = """location / {
    root /srv/www;
    add_header X-Quoted "brace { } #";
    # fake { } limit_except POST { deny all; }
${Array.from({ length: 110 }, (_, index) => `    add_header X-Padding-${index} value;`).join("\n")}
    location /nested/ {
        limit_except POST {
            deny all;
        }
    }
    limit_except GET {
        deny all;
    }
    try_files $uri $uri/ /index.html;
}"""
root = re.search(r"(?m)^location\\s+/\\s*\\{", source)
assert root
block = nginx_block_at(source, root.end() - 1)
methods, _ = require_read_only_spa_guard(block, "fixture")
assert methods == ["GET"]
assert source.index("limit_except GET") > 700

nested_only = """location / {
    location /nested/ {
        limit_except GET {
            deny all;
        }
    }
}"""
nested_root = re.search(r"(?m)^location\\s+/\\s*\\{", nested_only)
try:
    require_read_only_spa_guard(
        nginx_block_at(nested_only, nested_root.end() - 1), "nested-only"
    )
except AssertionError as error:
    assert error.args[0][0] == "READ_ONLY_SPA_GUARD_NOT_PRESERVED"
else:
    raise AssertionError("nested-only guard must not protect the SPA root")

missing_deny = """location / {
    limit_except GET {
        allow all;
    }
}"""
missing_root = re.search(r"(?m)^location\\s+/\\s*\\{", missing_deny)
try:
    require_read_only_spa_guard(
        nginx_block_at(missing_deny, missing_root.end() - 1), "missing-deny"
    )
except AssertionError as error:
    assert error.args[0][0] == "READ_ONLY_SPA_GUARD_NOT_PRESERVED"
else:
    raise AssertionError("guard without deny all must be rejected")
print("NGINX_SPA_GUARD_PARSER_FIXTURES_OK")
`;
  const result = spawnSync("python3", ["-c", fixture], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /NGINX_SPA_GUARD_PARSER_FIXTURES_OK/);
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
