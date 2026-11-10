import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const script = fs.readFileSync(path.resolve(process.cwd(), "ops/deploy-main-bluegreen-vps.sh"), "utf8");
const singlePort = fs.readFileSync(path.resolve(process.cwd(), "ops/deploy-single-port-vps.sh"), "utf8");
const nginxHotfix = fs.readFileSync(path.resolve(process.cwd(), "ops/fix-nginx-api-write-routing-vps.sh"), "utf8");
const activeVhostDiagnostic = fs.readFileSync(path.resolve(process.cwd(), "ops/diagnose-nginx-active-domain-vhost-vps.sh"), "utf8");

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

test("post-promotion HTTPS probe verifies CRM and SKU POSTs reach Express as JSON", () => {
  assert.match(singlePort, /PUBLIC_POST_API_BLOCKED_BEFORE_EXPRESS/);
  assert.match(singlePort, /PUBLIC_POST_API_JSON_GUARD_OK/);
  assert.match(singlePort, /PUBLIC_POST_API_EXPRESS_HEADER_OK/);
  assert.match(singlePort, /x-powered-by: express/);
  assert.match(singlePort, /HTTP_API_HTTPS_REDIRECT_OK/);
  assert.match(singlePort, /\/api\/admin\/crm\/customers/);
  assert.match(singlePort, /\/api\/catalog\/sku-transfer/);
  assert.match(singlePort, /application\/json/);
  assert.ok(singlePort.indexOf("PUBLIC_POST_API_JSON_GUARD_OK") < singlePort.indexOf("SUCCESS=1"));
});

test("customer-facing Nginx vhosts route API writes before the read-only SPA fallback", () => {
  assert.match(singlePort, /SANATPISH_API_WRITE_ROUTE_V2/);
  assert.match(singlePort, /location \^~ \/api\//);
  assert.match(singlePort, /proxy_intercept_errors off/);
  assert.match(singlePort, /proxy_pass_header X-Powered-By/);
  assert.match(singlePort, /satisfy any/);
  assert.match(singlePort, /auth_request off/);
  assert.match(singlePort, /return 308 https:\/\/\$host\$request_uri/);
  assert.match(singlePort, /API_ROUTE_METHODS_DELEGATED_TO_EXPRESS/);
  assert.doesNotMatch(singlePort, /limit_except GET HEAD POST PUT PATCH DELETE OPTIONS/);
  assert.match(singlePort, /CUSTOMER_HTTPS_API_PROXY_ROUTE_READY/);
  assert.match(singlePort, /CUSTOMER_HTTP_API_HTTPS_REDIRECT_READY/);
  assert.match(singlePort, /READ_ONLY_SPA_GUARD_NOT_PRESERVED/);
  assert.match(singlePort, /READ_ONLY_IP_PREVIEW_PRESERVED/);
  assert.match(singlePort, /if index in \(1,2\)/);
  assert.match(singlePort, /for host in \(domain,'www\.'\+domain\):/);
  const routeSwitch = singlePort.indexOf("===== ONE FIXED PORT FOR ALL PUBLIC WEBSITE VHOSTS =====");
  const routeReady = singlePort.indexOf("CUSTOMER_HTTPS_API_PROXY_ROUTE_READY", routeSwitch);
  const nginxReload = singlePort.indexOf("systemctl reload nginx", routeSwitch);
  assert.ok(routeSwitch >= 0 && routeReady > routeSwitch && nginxReload > routeReady);
});
test("standalone Nginx hotfix is rollback-safe, idempotent and leaves the IP preview read-only", () => {
  assert.match(nginxHotfix, /SANATPISH_API_WRITE_ROUTE_V2/);
  assert.match(nginxHotfix, /proxy_intercept_errors off/);
  assert.match(nginxHotfix, /proxy_pass_header X-Powered-By/);
  assert.match(nginxHotfix, /satisfy any/);
  assert.match(nginxHotfix, /auth_request off/);
  assert.match(nginxHotfix, /CUSTOMER_API_WRITE_ROUTE_READY/);
  assert.match(nginxHotfix, /CUSTOMER_API_HTTP_REDIRECT_READY/);
  assert.match(nginxHotfix, /DIRECT_EXPRESS_JSON_AUTH_GUARD_OK/);
  assert.match(nginxHotfix, /PUBLIC_POST_API_JSON_GUARD_OK/);
  assert.match(nginxHotfix, /\/api\/admin\/crm\/customers/);
  assert.match(nginxHotfix, /\/api\/catalog\/sku-transfer/);
  assert.match(nginxHotfix, /X-Powered-By/);
  assert.match(nginxHotfix, /NGINX_EXPRESS_HEADER_OR_JSON_MISSING/);
  assert.match(nginxHotfix, /HTTP_API_HTTPS_REDIRECT_OK/);
  assert.doesNotMatch(nginxHotfix, /limit_except GET HEAD POST PUT PATCH DELETE OPTIONS/);
  assert.match(nginxHotfix, /NGINX_API_ROUTE_ROLLBACK_OK/);
  assert.match(nginxHotfix, /NGINX_API_PROBE_UNEXPECTED/);
  assert.match(nginxHotfix, /READ_ONLY_IP_PREVIEW_PRESERVED/);
  assert.match(nginxHotfix, /proxy_request_buffering off/);
  assert.match(nginxHotfix, /for host in sanatpish\.com www\.sanatpish\.com/);
  assert.doesNotMatch(nginxHotfix, /docker (?:stop|rm|restart)|DROP TABLE|TRUNCATE TABLE/i);
});

test("active HTTPS vhost diagnostic inspects the loaded Nginx configuration without changing it", () => {
  assert.match(activeVhostDiagnostic, /nginx -T/);
  assert.match(activeVhostDiagnostic, /EXACT_DOMAIN_SERVER_BLOCKS/);
  assert.match(activeVhostDiagnostic, /ACTIVE_HTTPS_APP_PORTS/);
  assert.match(activeVhostDiagnostic, /PUBLIC_HOST=/);
  assert.match(activeVhostDiagnostic, /DIRECT_APP_PORT=/);
  assert.match(activeVhostDiagnostic, /NGINX_ACTIVE_VHOST_DIAGNOSTIC_COMPLETE/);
  assert.doesNotMatch(activeVhostDiagnostic, /systemctl reload nginx|systemctl restart nginx|Path\([^)]*\)\.write_text|cp -p .*\/etc\/nginx/i);
});
