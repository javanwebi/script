import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const script = fs.readFileSync(path.resolve(process.cwd(), "ops/deploy-main-bluegreen-vps.sh"), "utf8");

test("all three vhosts participate in the safe blue/green switch", () => {
  assert.match(script, /CONF_DOMAIN="\$\(readlink -f \/etc\/nginx\/sites-enabled\/sanatpish-domain-20261103\.conf\)"/);
  assert.match(script, /test -f "\$CONF_DOMAIN"/);
  assert.match(script, /server_name\[\[:space:\]\]\+sanatpish\\\.com/);
  assert.match(script, /DOMAIN_PORT_DRIFT_DETECTED/);
  assert.match(script, /python3 - "\$CONF1" "\$CONF2" "\$CONF_DOMAIN" "\$ACTIVE" "\$NEXT" "\$DOMAIN_ACTIVE"/);
  assert.match(script, /paths=\[Path\(a\),Path\(b\),Path\(domain\)\]/);
  assert.match(script, /expected=\[old,old,domain_old\]/);
});

test("domain routing shares rollback, backups and post-switch build/data verification", () => {
  assert.match(script, /cp -p "\$CONF_DOMAIN" "\$BACKUP\/domain"/);
  assert.match(script, /cp -p "\$BACKUP\/domain" "\$CONF_DOMAIN"/);
  assert.match(script, /NGINX_VHOST_DRIFT_AFTER_SWITCH/);
  assert.match(script, /DOMAIN_BUILD_MISMATCH/);
  assert.match(script, /--resolve "\$DOMAIN:443:127\.0\.0\.1"/);
  assert.match(script, /DOMAIN_BUILD_AND_DATABASE_OK/);
  assert.match(script, /SANATPISH_MAIN_BLUEGREEN_DEPLOY_OK/);
  assert.ok(script.indexOf("DOMAIN_BUILD_AND_DATABASE_OK") < script.indexOf("SUCCESS=1"));
});
