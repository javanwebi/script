import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
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

test("Nginx root fallback accepts deep indentation only when it is a direct child of server", () => {
  assert.ok(one.includes("root_depth=nginx_depth_before(source,roots[0].start())"));
  assert.ok(!one.includes("NGINX_ROOT_INDENT_UNSAFE"));
  assert.ok(!one.includes("len(indent) <= 16"));

  const helperStart = one.indexOf("def nginx_depth_before(text, stop):");
  const helperEnd = one.indexOf("\ndef require_read_only_spa_guard", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const helper = one.slice(helperStart, helperEnd);
  const fixture = `
import re
${helper}
source = "server {\\n" + (" " * 32) + "location / {\\n" + (" " * 36) + "try_files $uri /index.html;\\n" + (" " * 32) + "}\\n}\\n"
root = re.search(r"(?m)^([ \\t]*)location\\s+/\\s*\\{", source)
assert root
assert len(root.group(1)) == 32
assert nginx_depth_before(source, root.start()) == 1

nested = "server {\\n    location /nested/ {\\n        location / {\\n            try_files $uri /index.html;\\n        }\\n    }\\n}\\n"
nested_root = re.search(r"(?m)^([ \\t]*)location\\s+/\\s*\\{", nested)
assert nested_root
assert nginx_depth_before(nested, nested_root.start()) == 2
print("NGINX_ROOT_CONTEXT_FIXTURES_OK")
`;
  const result = spawnSync("python3", ["-c", fixture], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /NGINX_ROOT_CONTEXT_FIXTURES_OK/);
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

test("AvalAI private config is required for Voice while Desk may retain its independent provider", () => {
  const gate = one.indexOf("AVALAI_CANARY_CONFIG_OK");
  const promotion = one.indexOf("===== PROMOTE ON SAME FIXED PORT");
  assert.ok(gate >= 0 && promotion > gate);
  const configGate = one.slice(one.indexOf("if [[ -f \"$APP/.env.forza-voice\" ]]"), gate + 300);
  assert.match(configGate, /FORZA_VOICE_PROVIDER_NOT_AVALAI/);
  assert.match(configGate, /AVALAI_API_KEY_NOT_EFFECTIVE/);
  assert.match(configGate, /voiceProvider = String\(\s*process\.env\.FORZA_VOICE_PROVIDER \|\| process\.env\.FORZA_DESK_PROVIDER/);
  assert.doesNotMatch(configGate, /DESK_PROVIDER_NOT_AVALAI/);
  assert.match(one.slice(gate - 900, promotion), /PRIVATE_FORZA_CONFIG_MOUNT_OK/);
});

test("the private canary verifies effective AvalAI voice and Nima readiness before promotion", () => {
  const canary = file("ops/verify-single-port-canary.mjs");
  const voice = canary.indexOf('"/api/ai/forza-voice-info"');
  const stt = canary.indexOf('"/api/ai/forza-stt-info"');
  assert.ok(voice >= 0 && stt > voice);
  const gate = canary.slice(voice, stt);
  assert.match(gate, /textProvider, "avalai"/);
  assert.match(gate, /textProviderConfigured, true/);
  assert.match(gate, /voice, "piper-nima-gyro-medium"/);
  assert.match(gate, /incrementalSpeech, true/);
  assert.match(gate, /FORZA_PRIVATE_VOICE_NOT_READY/);
  assert.match(gate, /FORZA_VOICE_CANARY_AVALAI_READY_OK/);
});

test("private FORZA provider credentials are mounted read-only into each release", () => {
  assert.ok(one.includes('if [[ -f "$APP/.env.forza-voice" ]]'));
  assert.ok(one.includes('-v "$APP/.env.forza-voice:/app/.env.forza-voice:ro"'));
  assert.match(one, /Always bind the canonical host FORZA config/);
});

test("industrial belt PFAM reconciliation is guarded by the active production catalog lineage", () => {
  assert.match(one, /BELT_TAXONOMY_SQL="\$STAGE\/ops\/sql\/20261116_belt_family_taxonomy_followup\.sql"/);
  assert.match(one, /active_pfam/);
  assert.match(one, /active_fam/);
  assert.match(one, /PRODUCTION_CATALOG_FAMILY_LINEAGE/);
  assert.match(one, /activePfam===0&&activeFam>0/);
  assert.match(one, /if\(activeFam>0\)throw Error\("Mixed active FAM\/PFAM family lineage; refusing to apply PFAM-only belt taxonomy follow-up"\);/);
  assert.match(one, /PRODUCTION_BELT_PFAM_FOLLOWUP_SKIPPED reason=legacy_fam_catalog/);
  assert.match(one, /PRODUCTION_PFAM_DIRECT_SKU_FOLLOWUP_SKIPPED reason=legacy_fam_catalog/);
  assert.match(one, /LEGACY_FAM_WELDING_SQL="\$STAGE\/ops\/sql\/20261121_legacy_fam_belt_welding_direct_skus\.sql"/);
  assert.match(one, /PRODUCTION_LEGACY_FAM_WELDING_DIRECT_SKUS_APPLIED_OR_VERIFIED count=3/);
  assert.match(one, /PRODUCTION_PFAM_WELDING_DIRECT_SKUS_ALREADY_PRESENT count=3/);
  assert.match(one, /Mixed or missing FAM\/PFAM lineage; refusing legacy welding SKU projection/);
  assert.match(one, /PRODUCTION_BELT_TAXONOMY_APPLIED backup_rows=138/);
  assert.match(one, /PRODUCTION_BELT_TAXONOMY_ALREADY_APPLIED backup_rows=138/);
  assert.match(one, /Existing belt taxonomy backup is incomplete/);
  assert.match(one, /count\(\*\)::int as rows from internal\.catalog_belt_taxonomy_followup_backup_20261116/);
  const lineage = one.indexOf("PRODUCTION_CATALOG_FAMILY_LINEAGE");
  const skip = one.indexOf("PRODUCTION_BELT_PFAM_FOLLOWUP_SKIPPED");
  const mixed = one.indexOf("if(activeFam>0)throw Error");
  const apply = one.indexOf("await database().query(sql)", lineage);
  const alreadyApplied = one.indexOf("PRODUCTION_BELT_TAXONOMY_ALREADY_APPLIED", lineage);
  assert.ok(lineage >= 0 && skip > lineage && mixed > skip && apply > mixed && alreadyApplied > mixed,
    "legacy FAM-only catalogs skip PFAM SQL, while mixed FAM/PFAM catalogs fail closed before execution");
  const sku = one.indexOf('===== APPLY SOURCE-VERIFIED SKU-LEVEL MENU ASSIGNMENTS =====');
  const belt = one.indexOf('===== APPLY GUARDED INDUSTRIAL BELT TAXONOMY RECONCILIATION =====');
  const engineering = one.indexOf('===== APPLY GUARDED BELT FAMILY ENGINEERING CORRECTIONS =====');
  const legacyFamDirect = one.indexOf('===== APPLY LEGACY FAM-ONLY WELDING EQUIPMENT DIRECT SKU PROJECTION =====');
  const customer360 = one.indexOf('===== APPLY CUSTOMER 360 AND MANUFACTURING REQUEST SCHEMA =====');
  assert.ok(sku >= 0 && belt > sku && engineering > belt && legacyFamDirect > engineering && customer360 > legacyFamDirect,
    "PFAM-only corrections stay guarded and the legacy FAM direct-SKU projection runs before app promotion");
  assert.match(one, /BELT_ENGINEERING_SQL="\$STAGE\/ops\/sql\/20261117_belt_family_engineering_corrections\.sql"/);
  assert.match(one, /catalog_belt_family_engineering_backup_20261117/);
  assert.match(one, /activePfam===0&&activeFam>0/);
  assert.match(one, /PRODUCTION_BELT_ENGINEERING_SKIPPED reason=legacy_fam_catalog/);
  assert.match(one, /Mixed active FAM\/PFAM family lineage; refusing PFAM belt engineering correction/);
  assert.match(one, /PRODUCTION_BELT_ENGINEERING_APPLIED variants=292 families=19 assignments=8 direct=14 categories=5/);
  assert.match(one, /PRODUCTION_BELT_ENGINEERING_ALREADY_APPLIED variants=292 families=19 assignments=8 direct=14 categories=5/);
  assert.match(one, /Existing belt engineering backup is incomplete/);
  assert.match(one, /categories=5/);
  assert.match(one, /tests\/catalog-menu-semantic-guard\.test\.ts/);
  assert.match(one, /tests\/belt-category-experience\.test\.ts/);
  assert.match(one, /tests\/database\/belt-family-taxonomy-followup\.test\.ts/);
  assert.match(one, /tests\/database\/belt-family-engineering-corrections\.test\.ts/);
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

test("local vision canary resumes only stale persisted PostgreSQL index rows before promotion", () => {
  const prepare = one.indexOf('# Optional local vision sidecar:');
  const privateCanary = one.indexOf("echo '===== PRIVATE CANARY WITHOUT A HOST PORT ====='");
  const indexGate = one.indexOf('===== RESUME PERSISTED LOCAL IMAGE INDEX BEFORE PROMOTION =====');
  const promotion = one.indexOf("echo '===== PROMOTE ON SAME FIXED PORT");
  const gate = one.slice(indexGate, promotion);
  assert.ok(prepare >= 0 && prepare < privateCanary);
  assert.ok(indexGate > privateCanary && indexGate < promotion);
  assert.doesNotMatch(one.slice(privateCanary, indexGate), /SANATPISH_DISABLE_LOCAL_VISION_WARMUP=1/);
  assert.match(gate, /LIVE_VISION_STATUS=/);
  assert.match(gate, /CANARY_VISION_STATUS=/);
  assert.match(gate, /seq 1 360/);
  assert.match(gate, /sleep 5/);
  assert.match(gate, /CANARY_INDEX_NOT_READY/);
  assert.match(gate, /LOCAL_VISION_RESUME_TIMEOUT_AFTER_30_MINUTES/);
  assert.match(gate, /LOCAL_VISION_PERSISTED_INDEX_RESUMED_OK/);
  assert.match(gate, /LIVE_CANARY_MISMATCH_/);
  const backend = file("server.ts");
  assert.match(backend, /SANATPISH_DISABLE_LOCAL_VISION_WARMUP!=='1'/);
  assert.match(backend, /persistence:databaseEnabled\(\)\?'postgres':'file'/);
  const index = file("src/services/catalogVisualIndex.ts");
  assert.match(index, /storedEntries:this\.entries\.size,missing,signatureChanged/);
  assert.match(index, /const missing=images\.filter\(row=>this\.entries\.get\(row\.id\)\?\.signature!==signature\(row\)\)/);
});

test("Nginx API route upgrade is idempotent for 12 consecutive releases (regression: exponential indentation)", () => {
  const startTag = `python3 - "$CONF1" "$CONF2" "$CONF_DOMAIN" "$FIXED_PORT" <<'PY'`;
  const startPos = one.indexOf(startTag);
  assert.ok(startPos >= 0);
  const codeStart = one.indexOf("\n", startPos) + 1;
  const codeEnd = one.indexOf("\nPY\nnginx -t\nsystemctl reload nginx", codeStart);
  assert.ok(codeEnd > codeStart);
  const migrationPython = one.slice(codeStart, codeEnd);
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "sanatpish-nginx-idempotence-"));
  try {
    const paths = ["ip", "https", "domain"].map(name => path.join(sandbox, name + ".conf"));
    for (let i = 0; i < paths.length; i++) {
      const indent = i === 2 ? " ".repeat(32) : " ".repeat(4);
      const host = i === 2 ? "sanatpish.com www.sanatpish.com" : "localhost";
      fs.writeFileSync(paths[i], `server {
    server_name ${host};
    location = /api/live {
        proxy_pass http://127.0.0.1:3013;
    }
${indent}location / {
        limit_except GET {
            deny all;
        }
        try_files $uri /index.html;
    }
}
`);
    }
    let first: string[] | undefined;
    for (let iteration = 0; iteration < 12; iteration++) {
      const cmd = spawnSync("python3", ["-c", migrationPython, ...paths, "3013"], {encoding: "utf8"});
      assert.equal(cmd.status, 0, `Nginx rewrite failed at repeat ${iteration + 1}: ${cmd.stderr || cmd.stdout}`);
      const current = paths.map(p => fs.readFileSync(p, "utf8"));
      if (first) assert.deepEqual(current, first, `vhost changed on identical deploy repeat ${iteration + 1}`);
      else first = current;
      assert.ok(current.every(config => config.length < 4096), "Nginx vhost unexpectedly ballooned");
      assert.ok(current[2].includes(" ".repeat(32) + "location / {"), "original 32-space root indent changed");
      assert.equal(current[1].split("# SANATPISH_API_WRITE_ROUTE_V2").length - 1, 1);
      assert.equal(current[2].split("# SANATPISH_API_WRITE_ROUTE_V2").length - 1, 1);
      assert.match(current[0], /limit_except GET/);
    }
  } finally {
    fs.rmSync(sandbox, {recursive: true, force: true});
  }
});

test("standalone Nginx hotfix is idempotent and preserves the same root whitespace", () => {
  const standalone = file("ops/fix-nginx-api-write-routing-vps.sh");
  const startTag = `python3 - "$HTTPS" "$HTTP" "$PORT" <<'PY'`;
  const startPos = standalone.indexOf(startTag);
  assert.ok(startPos >= 0);
  const codeStart = standalone.indexOf("\n", startPos) + 1;
  const codeEnd = standalone.indexOf("\nPY\n\nnginx -t", codeStart);
  assert.ok(codeEnd > codeStart);
  const migrationPython = standalone.slice(codeStart, codeEnd);
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "sanatpish-nginx-hotfix-"));
  try {
    const names = ["https", "http"].map(name => path.join(sandbox, name + ".conf"));
    for (const p of names) fs.writeFileSync(p, `server {
    server_name sanatpish.com www.sanatpish.com;
    location = /api/live { proxy_pass http://127.0.0.1:3013; }
    location / {
        limit_except GET { deny all; }
        try_files $uri /index.html;
    }
}
`);
    let snapshot: string[] | undefined;
    for (let i=0;i<8;i++) {
      const cmd=spawnSync("python3",["-c",migrationPython,...names,"3013"],{encoding:"utf8"});
      assert.equal(cmd.status,0,cmd.stderr || cmd.stdout);
      const next=names.map(p=>fs.readFileSync(p,"utf8"));
      if(snapshot)assert.deepEqual(next,snapshot);
      snapshot=next;
      assert.ok(next.every(s=>s.length<4096));
    }
  } finally {fs.rmSync(sandbox,{recursive:true,force:true});}
});

test("one-time recovery removes only runaway whitespace from the actual live-style vhost", () => {
  const repair = file("ops/repair-nginx-indentation-vps.sh");
  assert.ok(repair.includes("flock -w 15 9"));
  assert.ok(repair.includes("NGINX_REPAIR_ROLLBACK_OK"));
  assert.ok(repair.includes("systemctl reload nginx"));
  const marker = `python3 - "$CONF" <<'PY'`;
  const start = repair.indexOf(marker);
  assert.ok(start >= 0);
  const begin = repair.indexOf("\n", start) + 1;
  const end = repair.indexOf("\nPY\nnginx -t\nsystemctl reload nginx", begin);
  assert.ok(end > begin);
  const python = repair.slice(begin,end);
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "sanatpish-nginx-repair-test-"));
  try {
    const domain = path.join(sandbox,"domain.conf");
    const huge = " ".repeat(65536);
    const source = `server {
    listen 80;
    server_name sanatpish.com www.sanatpish.com;
${huge}# SANATPISH_API_WRITE_ROUTE_V2
${huge}location ^~ /api/ {
${huge}return 308 https://$host$request_uri;
${huge}}
${huge}location / {
        limit_except GET { deny all; }
        proxy_pass http://127.0.0.1:3013;
    }
}
`;
    fs.writeFileSync(domain,source);
    assert.ok(fs.statSync(domain).size>262144);
    const run=spawnSync("python3",["-c",python,domain],{encoding:"utf8"});
    assert.equal(run.status,0,run.stderr || run.stdout);
    const clean=fs.readFileSync(domain,"utf8");
    assert.ok(Buffer.byteLength(clean)<262144);
    const normalize=(text:string)=>text.replace(/^[ \t]+/gm,"");
    assert.equal(normalize(clean),normalize(source));
    assert.equal(clean.split("SANATPISH_API_WRITE_ROUTE_V2").length-1,1);
    assert.ok(clean.includes("proxy_pass http://127.0.0.1:3013;"));
    assert.ok(clean.includes("limit_except GET { deny all; }"));
  } finally { fs.rmSync(sandbox,{recursive:true,force:true}); }
});
