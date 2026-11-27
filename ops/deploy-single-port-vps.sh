#!/usr/bin/env bash
# Single-port website deployment: isolated canary WITHOUT a second published app port.
# Do NOT run directly without SANATPISH_RELEASE_SHA set to a pinned release commit.
set -Eeuo pipefail
umask 077
export GIT_TERMINAL_PROMPT=0
APP=/opt/sanatpish
EXPECTED="$SANATPISH_RELEASE_SHA"
[[ "$EXPECTED" =~ ^[a-f0-9]{40}$ ]] || { echo "INVALID_RELEASE_SHA"; exit 1; }
exec 9>/run/lock/sanatpish-main-release.lock
flock -w 15 9 || { echo "DEPLOY_LOCK_BUSY"; exit 1; }
test "$(git -C "$APP" remote get-url origin)" = https://github.com/javanwebi/script.git
test "$(git -C "$APP" cat-file -t "$EXPECTED")" = commit

POPD_CATALOG_SOURCE_COMMIT="e81218f2a248f1db9a72349a67e46af55c7977ee"
POPD_CATALOG_IMAGE_RELEASE_ID="${POPD_CATALOG_SOURCE_COMMIT}-${EXPECTED}"

# Resolve the actual Nginx vhosts. Older VPS images used sites-enabled;
# the current Hostino layout keeps the domain and IP vhosts under conf.d.
if [[ -f /etc/nginx/sites-enabled/default && \
      -f /etc/nginx/sites-enabled/sanatpish-https.conf && \
      -f /etc/nginx/sites-enabled/sanatpish-domain-20261103.conf ]]; then
  CONF1="$(readlink -f /etc/nginx/sites-enabled/default)"
  CONF2="$(readlink -f /etc/nginx/sites-enabled/sanatpish-https.conf)"
  CONF_DOMAIN="$(readlink -f /etc/nginx/sites-enabled/sanatpish-domain-20261103.conf)"
elif [[ -f /etc/nginx/conf.d/sanatpish-new-ip.conf && \
        -f /etc/nginx/conf.d/sanatpish-hostino-https.conf && \
        -f /etc/nginx/conf.d/sanatpish-domain-http.conf ]]; then
  CONF1="$(readlink -f /etc/nginx/conf.d/sanatpish-new-ip.conf)"
  CONF2="$(readlink -f /etc/nginx/conf.d/sanatpish-hostino-https.conf)"
  CONF_DOMAIN="$(readlink -f /etc/nginx/conf.d/sanatpish-domain-http.conf)"
else
  echo "SANATPISH_NGINX_LAYOUT_UNRECOGNIZED" >&2
  find /etc/nginx/sites-enabled /etc/nginx/conf.d -maxdepth 1 -type f -o -type l 2>/dev/null | sort >&2
  exit 1
fi
test -f "$CONF1" && test -f "$CONF2" && test -f "$CONF_DOMAIN"
test "$CONF1" != "$CONF2" && test "$CONF1" != "$CONF_DOMAIN" && test "$CONF2" != "$CONF_DOMAIN"
# Refuse malformed/ballooned Nginx files before nginx -T or Python reads them.
# Normal vhost files are only a few KB; 256 KiB is a generous safety ceiling.
MAX_NGINX_CONFIG_BYTES=262144
for nginx_conf in "$CONF1" "$CONF2" "$CONF_DOMAIN"; do
  nginx_conf_bytes="$(stat -c '%s' "$nginx_conf")"
  if (( nginx_conf_bytes > MAX_NGINX_CONFIG_BYTES )); then
    echo "NGINX_CONFIG_SIZE_INVALID path=$nginx_conf bytes=$nginx_conf_bytes max=$MAX_NGINX_CONFIG_BYTES" >&2
    echo "Restore the verified vhost backup before retrying deployment." >&2
    exit 1
  fi
done
grep -Eq 'server_name[[:space:]]+sanatpish\.com[[:space:]]+www\.sanatpish\.com;' "$CONF_DOMAIN"
nginx -t
echo '===== READ LIVE NGINX TARGET ====='
ACTIVE="$(python3 - "$CONF1" "$CONF2" <<'PY'
from pathlib import Path
import re,sys
ports=[]
for p in sys.argv[1:]:
 s=Path(p).read_text()
 x=set(re.findall(r'proxy_pass\s+http://127\.0\.0\.1:(30(?:0[4-9]|1[0-9]|20));',s))
 assert len(x)==1,('UNEXPECTED_PROXY_TARGET',p,x)
 ports.append(next(iter(x)))
assert len(set(ports))==1,('NGINX_TARGETS_DISAGREE',ports)
print(ports[0])
PY
)"
test -n "$ACTIVE"
echo "ACTIVE_PORT=$ACTIVE"
FIXED_PORT=3013
if test "$ACTIVE" != "$FIXED_PORT"; then
  echo "UNEXPECTED_LIVE_PORT actual=$ACTIVE expected=$FIXED_PORT" >&2
  exit 1
fi
# Tolerate pre-existing domain drift; correct it atomically with the next canary switch.
DOMAIN_ACTIVE="$(python3 - "$CONF_DOMAIN" <<'PY'
from pathlib import Path
import re,sys
s=Path(sys.argv[1]).read_text()
ports=set(re.findall(r'proxy_pass\s+http://127\.0\.0\.1:(30(?:0[4-9]|1[0-9]|20));',s))
assert len(ports)==1,('UNEXPECTED_DOMAIN_PROXY_TARGET',ports)
print(next(iter(ports)))
PY
)"
echo "DOMAIN_PORT_BEFORE=$DOMAIN_ACTIVE"
if test "$DOMAIN_ACTIVE" != "$ACTIVE"; then
  echo "DOMAIN_PORT_DRIFT_DETECTED origin=$ACTIVE domain=$DOMAIN_ACTIVE"
fi
# The live app can briefly reset a connection while Node finishes an in-flight
# request. Retry the preflight without changing or restarting the current app.
wait_for_live_health() {
  local url="$1" label="$2" resolve_domain="${3:-}" attempt body
  local -a args=(--noproxy '*' -fsS --connect-timeout 3 --max-time 12)
  if [[ -n "$resolve_domain" ]]; then
    args+=(-k --resolve "$resolve_domain:443:127.0.0.1")
  fi
  for attempt in $(seq 1 8); do
    if body="$(curl "${args[@]}" "$url" 2>/dev/null)" &&
       grep -q '"database":"ok"' <<<"$body"; then
      echo "${label}=OK attempt=${attempt}"
      return 0
    fi
    sleep 2
  done
  echo "${label}=FAILED url=${url}" >&2
  local -a debug_args=(--noproxy '*' -skv --connect-timeout 3 --max-time 8)
  if [[ -n "$resolve_domain" ]]; then
    debug_args+=(--resolve "$resolve_domain:443:127.0.0.1")
  fi
  curl "${debug_args[@]}" "$url" 2>&1 | tail -25 >&2 || true
  return 1
}
wait_for_live_health "http://127.0.0.1:$ACTIVE/api/health" ACTIVE_HTTP_HEALTH
# HTTPS must use the canonical hostname for both Host and TLS SNI. A request
# to https://127.0.0.1 selects the wrong/default virtual host on this Nginx.
wait_for_live_health "https://sanatpish.com/api/health" ACTIVE_HTTPS_HEALTH sanatpish.com
OLD=''
for c in $(docker ps --format '{{.Names}}'); do
 if docker port "$c" 3000/tcp 2>/dev/null | grep -Fxq "127.0.0.1:$ACTIVE"; then OLD="$c"; break; fi
done
test -n "$OLD"
echo "ACTIVE_CONTAINER=$OLD"

NEXT="$FIXED_PORT"
echo "STABLE_APP_PORT=$NEXT"

STAMP="$(date +%Y%m%d-%H%M%S)-$BASHPID"
DEPLOY_ROOT="$APP/.deploy"
RELEASE_ROOT="$DEPLOY_ROOT/releases"
install -d -m 700 "$DEPLOY_ROOT" "$RELEASE_ROOT"
STAGE="$RELEASE_ROOT/$STAMP"
STT_IMAGE=''
STT_CONTEXT=''
NAME="sanatpish-unified-live-$STAMP"
CANARY_NAME="sanatpish-unified-canary-$STAMP"
BACKUP="/root/sanatpish-main-rollback-$STAMP"
ENV_FILE="$(mktemp /tmp/sanatpish-camera-env.XXXXXXXX)"
MULTILINE_ENV_FILE="$(mktemp /tmp/sanatpish-camera-env-args.XXXXXXXX)"
ARCHIVE_ENV_ARGS_FILE="$(mktemp /tmp/sanatpish-popd-archive-env-args.XXXXXXXX)"
CID=''
CANARY_CID=''
PROMOTING=0
SUCCESS=0

cleanup(){
 status=$?
 trap - EXIT
 set +e
 if test "$SUCCESS" != 1; then
   if test "$PROMOTING" = 1; then
     echo '===== SINGLE-PORT ROLLBACK ====='
     # Release the fixed port before restarting the old container.
     docker rm -f "$NAME" >/dev/null 2>&1 || true
     if docker start "$OLD" >/dev/null 2>&1; then
       echo ORIGINAL_SINGLE_PORT_RESTORED
     else
       echo CRITICAL_ORIGINAL_APP_RESTART_FAILED >&2
     fi
     if test -f "$BACKUP/default" && test -f "$BACKUP/https" && test -f "$BACKUP/domain"; then
       cp -p "$BACKUP/default" "$CONF1"
       cp -p "$BACKUP/https" "$CONF2"
       cp -p "$BACKUP/domain" "$CONF_DOMAIN"
       if nginx -t && systemctl reload nginx; then
         echo NGINX_ROLLBACK_OK
       else
         echo CRITICAL_NGINX_ROLLBACK_FAILED >&2
       fi
     fi
   fi
   echo DEPLOY_FAILED_PREVIOUS_SITE_PRESERVED
   case "$STAGE" in
     "$RELEASE_ROOT"/*|/opt/sanatpish-unified-stage-*)
       rm -rf --one-file-system -- "$STAGE"
       ;;
   esac
 fi
 if test -n "$CANARY_CID"; then
   docker rm -f "$CANARY_NAME" >/dev/null 2>&1 || true
 fi
 if test -n "$STT_CONTEXT" && [[ "$STT_CONTEXT" == /tmp/sanatpish-forza-stt-context.* ]]; then
   rm -rf -- "$STT_CONTEXT"
 fi
 rm -f -- "$ENV_FILE" "$MULTILINE_ENV_FILE" "$ARCHIVE_ENV_ARGS_FILE"
 exit "$status"
}
trap cleanup EXIT
trap 'echo "DEPLOY_FAILED_AT_LINE=$LINENO" >&2' ERR

echo '===== BUILD CANDIDATE IN ISOLATION ====='
# Persistent, isolated npm cache for disposable build containers; never auto-prune.
CACHE_DIR="/var/cache/sanatpish/npm"
LOG_DIR="/var/log/sanatpish-deploy"
install -d -m 700 "$CACHE_DIR" "$LOG_DIR"
BUILD_LOG="$LOG_DIR/build-$STAMP.log"
printf 'BUILD_LOG=%s\n' "$BUILD_LOG"
FREE_KB="$(df -Pk / | awk 'NR==2 {print $4}')"
if test "$FREE_KB" -lt 2097152; then
  echo "LOW_DISK_SPACE_BEFORE_NPM free_kb=$FREE_KB (need at least 2 GiB)" >&2
  exit 1
fi
if test "$FREE_KB" -lt 4194304; then
  echo "WARN_LOW_DISK_SPACE_BEFORE_NPM free_kb=$FREE_KB (4 GiB recommended)" >&2
fi
mkdir -m 700 "$STAGE"
git -C "$APP" archive "$EXPECTED" | tar -xf - -C "$STAGE"
test -s "$STAGE/ops/prune-deploy-releases.sh"
bash -n "$STAGE/ops/prune-deploy-releases.sh"
echo "RELEASE_RETENTION_HELPER_SYNTAX_OK"
# Preserve the owner-managed mobile image directory that is intentionally untracked.
# Git archive omits it; copy it into the isolated release stage without touching APP.
if [[ -d "$APP/src/assets/IMAGESITE/mobile" ]]; then
  install -d -m 755 "$STAGE/src/assets/IMAGESITE/mobile"
  cp -a "$APP/src/assets/IMAGESITE/mobile/." "$STAGE/src/assets/IMAGESITE/mobile/"
  diff -qr "$APP/src/assets/IMAGESITE/mobile" "$STAGE/src/assets/IMAGESITE/mobile" >/dev/null
  echo 'PRESERVED_OWNER_MANAGED_MOBILE_ASSETS=YES'
fi
test -s "$STAGE/package-lock.json"
# Use official integrity-checked tarballs, not the previously failing mirror.
sed -i 's#https://registry.npmmirror.com/#https://registry.npmjs.org/#g' "$STAGE/package-lock.json"
NETWORK="$(docker inspect "$OLD" --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' | head -1)"
test -n "$NETWORK"
docker image inspect node:22-bookworm >/dev/null
echo "NPM_REGISTRY=https://registry.npmjs.org NPM_CACHE=$CACHE_DIR"
# Keep full diagnostics after Docker --rm removes the temporary build container.
docker run --rm --pull=never --network "$NETWORK" --cpus=1.5 --memory=3g --memory-swap=3g \
 --mount "type=bind,source=$STAGE,target=/app" \
 --mount "type=bind,source=$CACHE_DIR,target=/root/.npm" -w /app \
 -e npm_config_cache=/root/.npm \
 -e npm_config_registry=https://registry.npmjs.org \
 -e npm_config_maxsockets=4 \
 -e npm_config_fetch_retries=2 \
 -e npm_config_fetch_retry_maxtimeout=60000 \
 node:22-bookworm sh -ec 'npm ci --include=dev --no-audit --no-fund --loglevel=info && npm install --no-save --ignore-scripts --package-lock=false --legacy-peer-deps --no-audit --no-fund vosk-browser@0.0.8 onnxruntime-web@1.18.0 && mkdir -p public/forza-runtime/stt public/forza-runtime/ort && cp node_modules/vosk-browser/dist/vosk.js public/forza-runtime/stt/vosk.js && cp node_modules/onnxruntime-web/dist/ort-wasm*.wasm public/forza-runtime/ort/ && node scripts/prepare-vision-assets.mjs && npm run lint && npm run test:portal && node --import tsx --test tests/admin-catalog-image-workflow.test.ts tests/mobile-scan-ui.test.ts tests/forza-vision-kiki-fastpath.test.ts tests/forza-mobile-contact-sheet.test.ts tests/image-assignments.test.ts tests/catalog-menu-assignment-audit.test.ts tests/catalog-menu-semantic-guard.test.ts tests/belt-category-experience.test.ts tests/database/belt-family-taxonomy-followup.test.ts tests/database/belt-family-engineering-corrections.test.ts && npm run build && test -s dist/forza-runtime/stt/vosk.js && test -s dist/models/u2netp.onnx && test -s dist/forza-runtime/ort/ort-wasm-simd.wasm' 2>&1 | tee "$BUILD_LOG"
test -s "$STAGE/dist/index.html"
test -s "$STAGE/dist/forza-runtime/stt/vosk.js"

echo '===== VERIFY / BUILD PINNED DIBA STT RUNTIME IMAGE ====='
# The STT toolchain is independent from the storefront source revision.
# Reuse an existing verified runtime when the Dockerfile and locally pinned
# base image are unchanged, rather than reinstalling Debian packages for
# every layout/content update to the site.
STT_DOCKERFILE_HASH="$(sha256sum "$STAGE/ops/Dockerfile.forza-stt-runtime" | cut -d' ' -f1)"
STT_BASE_IMAGE_ID="$(docker image inspect node:22-bookworm --format '{{.Id}}')"
STT_RUNTIME_KEY="$(printf '%s %s\n' "$STT_DOCKERFILE_HASH" "$STT_BASE_IMAGE_ID" | sha256sum | cut -c1-12)"
STT_IMAGE="sanatpish-forza-stt-runtime:$STT_RUNTIME_KEY"
echo "FORZA_STT_RUNTIME_IMAGE=$STT_IMAGE"
if docker image inspect "$STT_IMAGE" >/dev/null 2>&1; then
  echo 'FORZA_STT_RUNTIME_CACHE_HIT=YES'
else
  echo 'FORZA_STT_RUNTIME_CACHE_HIT=NO'
  STT_CONTEXT="$(mktemp -d /tmp/sanatpish-forza-stt-context.XXXXXXXX)"
  cp "$STAGE/ops/Dockerfile.forza-stt-runtime" "$STT_CONTEXT/Dockerfile"
  # The Diba installer first retries independent HTTPS Python package indices.
  # BuildKit caches successful wheel downloads across Docker build attempts.
  # If bridge networking fails too, retry once with host networking.
  # Both builds run before any live-site promotion; Diba readiness is mandatory.
  if ! docker build --progress=plain -t "$STT_IMAGE" "$STT_CONTEXT"; then
    echo 'WARN_DIBA_BRIDGE_BUILD_FAILED_RETRY_WITH_HOST_NETWORK'
    docker build --progress=plain --network=host -t "$STT_IMAGE" "$STT_CONTEXT"
  fi
  rm -rf -- "$STT_CONTEXT"
  STT_CONTEXT=''
fi
# Never trust a cached name alone; verify the model directory and Vosk.
docker run --rm --pull=never "$STT_IMAGE" sh -ec '
  command -v ffmpeg >/dev/null
  /opt/forza-pocket/bin/python -c "import vosk"
  test -d /opt/diba-stt/model/am
  test -d /opt/diba-stt/model/conf
  test -s /opt/diba-stt/diba-stt-fa-small.tar.gz
'
echo "FORZA_STT_RUNTIME_IMAGE_READY=$STT_IMAGE"

# The current camera flow starts private image preparation immediately; the old retake/confirm copy is intentionally absent.
# Verify the full-screen capture entry and the new automatic KIKI inline catalogue results.
grep -RlF 'full-screen-camera-experience' "$STAGE/dist/assets" --include='*.js' >/dev/null
grep -RlF 'kiki-inline-catalog-results' "$STAGE/dist/assets" --include='*.js' >/dev/null
grep -RlF 'vision-analyzing-screen' "$STAGE/dist/assets" --include='*.js' >/dev/null
grep -RlF 'sanat-identification-open' "$STAGE/dist/assets" --include='*.js' >/dev/null
grep -RlF 'forza-mobile-contact-sheet' "$STAGE/dist/assets" --include='*.js' >/dev/null
grep -RlF 'forza-swipe-instruction' "$STAGE/dist/assets" --include='*.js' >/dev/null
grep -RlF 'store-scan-action' "$STAGE/dist/assets" --include='*.js' >/dev/null
grep -RlF 'home-category-group' "$STAGE/dist/assets" --include='*.js' >/dev/null
grep -RlF 'sp-vision-analysis__viewer' "$STAGE/dist/assets" --include='*.css' >/dev/null
grep -RlF 'sanat-camera-experience__stage' "$STAGE/dist/assets" --include='*.css' >/dev/null
test -s "$STAGE/dist/images/scan-industrial-generated.webp"
test -s "$STAGE/dist/images/precision-scan-technical-overlay.svg"
WEBPS="$(find "$STAGE/dist/images" -type f -name '*.webp' | wc -l)"
test "$WEBPS" -ge 21
echo "CAMERA_AND_WEBP_BUILD_OK count=$WEBPS"

echo '===== VERIFY PRODUCTION NAVIGATION SCHEMA (SAME LIVE DATABASE) ====='
# Executed inside the currently serving container, reusing its exact DATABASE_URL,
# SSL configuration and private credentials. Only missing POPD categories and group membership arrays are reconciled.
# Do not run this recovery against an unrelated connected Supabase project.
echo '===== APPLY NON-DESTRUCTIVE CATALOG SCHEMA REPAIR ====='
# Database transaction either commits all new tables/groups or rolls back.
# The SQL source comes from the same pinned commit as the frontend.
docker exec -i "$OLD" node --import tsx --input-type=module -e '
  import {readFileSync} from "node:fs";
  import {database,closeDatabase} from "./server/db/connection.ts";
  try {
    const sql=readFileSync(0,"utf8");
    await database().query(sql);
    console.log("PRODUCTION_CATALOG_SCHEMA_RECOVERED");
  }catch(error){console.error("PRODUCTION_CATALOG_SCHEMA_RECOVERY_FAILED",error.code||"",error.message);process.exitCode=1}
  finally{await closeDatabase()}
' < "$STAGE/ops/sql/20261103_recover_missing_production_catalog_navigation.sql"
# A missing table must never be reported as a successful deploy.
docker exec "$OLD" node --import tsx --input-type=module -e '
 import {database,closeDatabase} from "./server/db/connection.ts";
 try {
  const x=await database().query(
   "select count(*)::int as n from public.catalog_navigation_groups where is_active=true and id ~ \x27^excel-v2-[0-9]+$\x27");
  if(Number(x.rows[0].n)<14)throw Error("Expected 14 approved menu groups");
  const c=await database().query(
    "select count(*)::int as n from public.catalog_categories where is_active=true and slug ~ \x27^excel-v2-[0-9]+-[0-9]+$\x27 and metadata->>\x27source\x27=\x27industrial_megamenu_hierarchy_v2\x27");
  const mapped=await database().query(
    "select count(distinct mapped.category_slug)::int as unique_categories, count(*)::int as links, " +
    "count(*) filter(where category.slug is null)::int as unknown " +
    "from public.catalog_navigation_groups g cross join unnest(g.category_slugs) as mapped(category_slug) " +
    "left join public.catalog_categories category on category.slug=mapped.category_slug and category.is_active=true " +
    "and category.metadata->>\x27source\x27=\x27industrial_megamenu_hierarchy_v2\x27 " +
    "where g.is_active=true and g.id ~ \x27^excel-v2-[0-9]+$\x27");
  if(Number(x.rows[0].n)!==14)throw Error("Expected 14 approved menu groups, found "+x.rows[0].n);
  if(Number(c.rows[0].n)!==40)throw Error("Expected 40 active approved categories, found "+c.rows[0].n);
  if(Number(mapped.rows[0].unique_categories)!==40 || Number(mapped.rows[0].links)!==40 || Number(mapped.rows[0].unknown)!==0)
    throw Error("Expected exact 40-category group coverage: "+JSON.stringify(mapped.rows[0]));
  console.log("PRODUCTION_NAVIGATION_GROUPS_VERIFIED",x.rows[0].n);
  console.log("PRODUCTION_APPROVED_CATEGORIES_VERIFIED",c.rows[0].n);
  console.log("PRODUCTION_GROUP_CATEGORY_COVERAGE_VERIFIED",mapped.rows[0].unique_categories);
 }catch(error){console.error("PRODUCTION_NAVIGATION_VERIFY_FAILED",error.code||"",error.message);process.exitCode=1}
 finally{await closeDatabase()}
'
echo '===== SKIP UNVERIFIED BULK FAMILY MENU SEED ====='
echo 'The 1,286-row family menu seed is intentionally not auto-applied while the 90-to-67 technical taxonomy audit is open.'
echo 'Existing admin_verified assignments remain untouched.'

echo '===== APPLY TARGETED EXCEL-VERIFIED FAMILY MENU CORRECTIONS ====='
CORRECTION_SQL="$STAGE/ops/sql/20261114_catalog_family_menu_audit_corrections.sql"
test -s "$CORRECTION_SQL" || { echo "REQUIRED_CATALOG_CORRECTION_SQL_MISSING=$CORRECTION_SQL"; exit 1; }
docker exec -i "$OLD" node --import tsx --input-type=module -e '
 import {readFileSync} from "node:fs";
 import {database,closeDatabase} from "./server/db/connection.ts";
 try {
  const sql=readFileSync(0,"utf8");
  await database().query(sql);
  const result=await database().query(
   "select count(*)::int as total from public.catalog_family_menu_assignments where " +
   "((family_code in (\x27FAM-35826\x27,\x27FAM-10105\x27,\x27FAM-52948\x27) " +
   "and (method=\x27admin_verified\x27 or (category_slug=\x27excel-v2-6-2\x27 " +
   "and submenu_name=\x27نرده استیل\x27 and leaf_name=\x27نرده استیل و متعلقات\x27))) " +
   "or (family_code=\x27FAM-52858\x27 and (method=\x27admin_verified\x27 or " +
   "(category_slug=\x27excel-v2-2-1\x27 and submenu_name=\x27بر اساس جنس\x27 " +
   "and leaf_name IS NULL))))");
  if(Number(result.rows[0].total)!==4)throw Error("Expected 4 source-verified or admin-locked family assignments");
  console.log("PRODUCTION_SOURCE_VERIFIED_FAMILY_ASSIGNMENTS_OR_ADMIN_LOCKED",result.rows[0].total);
 }catch(error){console.error("PRODUCTION_CATALOG_AUDIT_CORRECTION_FAILED",error.code||"",error.message);process.exitCode=1}
 finally{await closeDatabase()}
' < "$CORRECTION_SQL"

echo '===== APPLY SOURCE-VERIFIED SKU-LEVEL MENU ASSIGNMENTS ====='
SKU_MENU_SQL="$STAGE/ops/sql/20261114_catalog_sku_level_menu_assignments.sql"
test -s "$SKU_MENU_SQL" || { echo "REQUIRED_SKU_MENU_SQL_MISSING=$SKU_MENU_SQL"; exit 1; }
docker exec -i "$OLD" node --import tsx --input-type=module -e '
 import {readFileSync} from "node:fs";
 import {database,closeDatabase} from "./server/db/connection.ts";
 try {
  const sql=readFileSync(0,"utf8");
  await database().query(sql);
  console.log("PRODUCTION_SKU_LEVEL_MENU_ASSIGNMENTS_VERIFIED",305);
 }catch(error){
  console.error("PRODUCTION_SKU_LEVEL_MENU_ASSIGNMENTS_FAILED",error.code||"",error.message);
  process.exitCode=1;
 }finally{await closeDatabase()}
' < "$SKU_MENU_SQL"

echo '===== APPLY GUARDED INDUSTRIAL BELT TAXONOMY RECONCILIATION ====='
BELT_TAXONOMY_SQL="$STAGE/ops/sql/20261116_belt_family_taxonomy_followup.sql"
test -s "$BELT_TAXONOMY_SQL" || { echo "REQUIRED_BELT_TAXONOMY_SQL_MISSING=$BELT_TAXONOMY_SQL"; exit 1; }
# This reconciliation targets the separate, engineering-reconstructed PFAM catalog.
# Legacy FAM-only production databases must not be forced through PFAM-specific IDs.
# The 138-row backup remains the idempotency marker for databases where this dataset exists.
docker exec -i "$OLD" node --import tsx --input-type=module -e '
 import {readFileSync} from "node:fs";
 import {database,closeDatabase} from "./server/db/connection.ts";
 try {
  const sql=readFileSync(0,"utf8");
  const marker=await database().query(
   "select to_regclass(\x27internal.catalog_belt_taxonomy_followup_backup_20261116\x27) as backup");
  const hasBackup=Boolean(marker.rows[0].backup);
  if(hasBackup){
   const existing=await database().query(
    "select count(*)::int as rows from internal.catalog_belt_taxonomy_followup_backup_20261116");
   if(Number(existing.rows[0].rows)!==138)throw Error("Existing belt taxonomy backup is incomplete; refusing to continue");
  }
  const lineage=await database().query(
   "select " +
   "count(*) filter(where code like \x27PFAM-%\x27 and is_active=true and coalesce(is_deleted,false)=false)::int as active_pfam, " +
   "count(*) filter(where code like \x27FAM-%\x27 and is_active=true and coalesce(is_deleted,false)=false)::int as active_fam " +
   "from public.catalog_families");
  const activePfam=Number(lineage.rows[0].active_pfam||0);
  const activeFam=Number(lineage.rows[0].active_fam||0);
  console.log("PRODUCTION_CATALOG_FAMILY_LINEAGE",JSON.stringify({active_pfam:activePfam,active_fam:activeFam}));
  if(activePfam===0&&activeFam>0){
   console.log("PRODUCTION_BELT_PFAM_FOLLOWUP_SKIPPED reason=legacy_fam_catalog active_fam="+activeFam);
   console.log("PRODUCTION_PFAM_DIRECT_SKU_FOLLOWUP_SKIPPED reason=legacy_fam_catalog active_fam="+activeFam);
  }else{
   if(activePfam===0)throw Error("No active PFAM or FAM family baseline found; refusing to apply belt taxonomy follow-up");
   if(activeFam>0)throw Error("Mixed active FAM/PFAM family lineage; refusing to apply PFAM-only belt taxonomy follow-up");
   if(hasBackup){
    console.log("PRODUCTION_BELT_TAXONOMY_ALREADY_APPLIED backup_rows=138");
   }else{
    await database().query(sql);
    const applied=await database().query(
     "select count(*)::int as rows from internal.catalog_belt_taxonomy_followup_backup_20261116");
    if(Number(applied.rows[0].rows)!==138)throw Error("Belt taxonomy migration did not create its complete 138-row backup");
    console.log("PRODUCTION_BELT_TAXONOMY_APPLIED backup_rows=138");
   }
  }
 }catch(error){
  console.error("PRODUCTION_BELT_TAXONOMY_MIGRATION_FAILED",error.code||"",error.message);
  process.exitCode=1;
 }finally{await closeDatabase()}
' < "$BELT_TAXONOMY_SQL"

echo '===== APPLY GUARDED BELT FAMILY ENGINEERING CORRECTIONS ====='
BELT_ENGINEERING_SQL="$STAGE/ops/sql/20261117_belt_family_engineering_corrections.sql"
test -s "$BELT_ENGINEERING_SQL" || { echo "REQUIRED_BELT_ENGINEERING_SQL_MISSING=$BELT_ENGINEERING_SQL"; exit 1; }
# Apply only to the audited PFAM production lineage. Legacy FAM-only databases
# and mixed lineages must never receive PFAM-specific family identifiers.
docker exec -i "$OLD" node --import tsx --input-type=module -e '
 import {readFileSync} from "node:fs";
 import {database,closeDatabase} from "./server/db/connection.ts";
 try {
  const sql=readFileSync(0,"utf8");
  const marker=await database().query(
   "select to_regclass(\x27internal.catalog_belt_family_engineering_backup_20261117\x27) as backup");
  const hasBackup=Boolean(marker.rows[0].backup);
  if(hasBackup){
   const existing=await database().query(
    "select " +
    "count(*) filter(where table_name=\x27catalog_variants\x27)::int as variants, " +
    "count(*) filter(where table_name=\x27catalog_families\x27)::int as families, " +
    "count(*) filter(where table_name=\x27catalog_family_menu_assignments\x27)::int as assignments, " +
    "count(*) filter(where table_name=\x27catalog_direct_skus\x27)::int as direct, " +
    "count(*) filter(where table_name=\x27catalog_categories\x27)::int as categories " +
    "from internal.catalog_belt_family_engineering_backup_20261117");
   const backup=existing.rows[0];
   if(Number(backup.variants)!==292||Number(backup.families)!==19||
      Number(backup.assignments)!==8||Number(backup.direct)!==14||Number(backup.categories)!==5){
    throw Error("Existing belt engineering backup is incomplete; refusing to continue");
   }
  }
  const lineage=await database().query(
   "select " +
   "count(*) filter(where code like \x27PFAM-%\x27 and is_active=true and coalesce(is_deleted,false)=false)::int as active_pfam, " +
   "count(*) filter(where code like \x27FAM-%\x27 and is_active=true and coalesce(is_deleted,false)=false)::int as active_fam " +
   "from public.catalog_families");
  const activePfam=Number(lineage.rows[0].active_pfam||0);
  const activeFam=Number(lineage.rows[0].active_fam||0);
  console.log("PRODUCTION_CATALOG_FAMILY_LINEAGE",JSON.stringify({active_pfam:activePfam,active_fam:activeFam}));
  if(activePfam===0&&activeFam>0){
   console.log("PRODUCTION_BELT_ENGINEERING_SKIPPED reason=legacy_fam_catalog active_fam="+activeFam);
  }else{
   if(activePfam===0)throw Error("No active PFAM or FAM family baseline found; refusing belt engineering correction");
   if(activeFam>0)throw Error("Mixed active FAM/PFAM family lineage; refusing PFAM belt engineering correction");
   if(hasBackup){
    console.log("PRODUCTION_BELT_ENGINEERING_ALREADY_APPLIED variants=292 families=19 assignments=8 direct=14 categories=5");
   }else{
    await database().query(sql);
    const applied=await database().query(
     "select " +
     "count(*) filter(where table_name=\x27catalog_variants\x27)::int as variants, " +
     "count(*) filter(where table_name=\x27catalog_families\x27)::int as families, " +
     "count(*) filter(where table_name=\x27catalog_family_menu_assignments\x27)::int as assignments, " +
     "count(*) filter(where table_name=\x27catalog_direct_skus\x27)::int as direct, " +
     "count(*) filter(where table_name=\x27catalog_categories\x27)::int as categories " +
     "from internal.catalog_belt_family_engineering_backup_20261117");
    const backup=applied.rows[0];
    if(Number(backup.variants)!==292||Number(backup.families)!==19||
       Number(backup.assignments)!==8||Number(backup.direct)!==14||Number(backup.categories)!==5){
     throw Error("Belt engineering migration did not create its complete private backup");
    }
    console.log("PRODUCTION_BELT_ENGINEERING_APPLIED variants=292 families=19 assignments=8 direct=14 categories=5");
   }
  }
 }catch(error){
  console.error("PRODUCTION_BELT_ENGINEERING_MIGRATION_FAILED",error.code||"",error.message);
  process.exitCode=1;
 }finally{await closeDatabase()}
' < "$BELT_ENGINEERING_SQL"

echo '===== APPLY LEGACY FAM-ONLY WELDING EQUIPMENT DIRECT SKU PROJECTION ====='
LEGACY_FAM_WELDING_SQL="$STAGE/ops/sql/20261121_legacy_fam_belt_welding_direct_skus.sql"
test -s "$LEGACY_FAM_WELDING_SQL" || { echo "REQUIRED_LEGACY_FAM_WELDING_SQL_MISSING=$LEGACY_FAM_WELDING_SQL"; exit 1; }
# The VPS source of truth remains the self-hosted legacy FAM catalog. This
# additive projection publishes only three source-verified welding tools;
# it does not rewrite/deactivate any family or variant and never touches cloud PFAM.
docker exec -i "$OLD" node --import tsx --input-type=module -e '
 import {readFileSync} from "node:fs";
 import {database,closeDatabase} from "./server/db/connection.ts";
 try {
  const sql=readFileSync(0,"utf8");
  const lineage=await database().query(
   "select " +
   "count(*) filter(where code like \x27PFAM-%\x27 and is_active=true and coalesce(is_deleted,false)=false)::int as active_pfam, " +
   "count(*) filter(where code like \x27FAM-%\x27 and is_active=true and coalesce(is_deleted,false)=false)::int as active_fam " +
   "from public.catalog_families");
  const activePfam=Number(lineage.rows[0].active_pfam||0);
  const activeFam=Number(lineage.rows[0].active_fam||0);
  if(activePfam===0&&activeFam>0){
   await database().query(sql);
   const backup=await database().query(
    "select count(*)::int as rows, count(*) filter(where migration_state=\x27applied\x27)::int as applied " +
    "from internal.catalog_legacy_fam_belt_welding_direct_backup_20261121");
   const direct=await database().query(
    "select count(*)::int as rows from public.catalog_direct_skus " +
    "where sku_code=any(array[\x2741497\x27,\x2735852\x27,\x27110049\x27]::text[]) " +
    "and category_slug=\x27excel-v2-1-4\x27 and submenu=\x27دستگاه‌های تسمه جوشی\x27 " +
    "and subcategory=\x27دستگاه جوش تسمه صنعتی\x27 and is_active=true " +
    "and ((sku_code=\x2741497\x27 and source_family_code=\x27FAM-41497\x27) or " +
    "(sku_code=\x2735852\x27 and source_family_code=\x27FAM-35852\x27) or " +
    "(sku_code=\x27110049\x27 and source_family_code=\x27FAM-90062\x27))");
   if(Number(backup.rows[0].rows)!==3||Number(backup.rows[0].applied)!==3||Number(direct.rows[0].rows)!==3){
    throw Error("Legacy FAM welding direct-SKU migration postcondition failed");
   }
   console.log("PRODUCTION_LEGACY_FAM_WELDING_DIRECT_SKUS_APPLIED_OR_VERIFIED count=3");
  }else if(activePfam>0&&activeFam===0){
   const direct=await database().query(
    "select count(*)::int as rows from public.catalog_direct_skus " +
    "where sku_code=any(array[\x2741497\x27,\x2735852\x27,\x27110049\x27]::text[]) " +
    "and category_slug=\x27excel-v2-1-4\x27 and submenu=\x27دستگاه‌های تسمه جوشی\x27 " +
    "and subcategory=\x27دستگاه جوش تسمه صنعتی\x27 and is_active=true " +
    "and ((sku_code=\x2741497\x27 and source_family_code=\x27FAM-41497\x27) or " +
    "(sku_code=\x2735852\x27 and source_family_code=\x27FAM-35852\x27) or " +
    "(sku_code=\x27110049\x27 and source_family_code=\x27FAM-90062\x27))");
   if(Number(direct.rows[0].rows)!==3){
    throw Error("PFAM lineage is missing the three source-verified welding equipment direct SKUs");
   }
   console.log("PRODUCTION_PFAM_WELDING_DIRECT_SKUS_ALREADY_PRESENT count=3");
  }else{
   throw Error("Mixed or missing FAM/PFAM lineage; refusing legacy welding SKU projection");
  }
 }catch(error){
  console.error("PRODUCTION_LEGACY_FAM_WELDING_DIRECT_SKU_FAILED",error.code||"",error.message);
  process.exitCode=1;
 }finally{await closeDatabase()}
' < "$LEGACY_FAM_WELDING_SQL"

echo '===== APPLY CUSTOMER 360 AND MANUFACTURING REQUEST SCHEMA ====='
for MIGRATION in \
  "$STAGE/supabase/adopted/migrations/20261109010000_customer_360_local_vault.sql" \
  "$STAGE/supabase/adopted/migrations/20261110010000_custom_part_requests.sql" \
  "$STAGE/supabase/adopted/migrations/20261116010000_catalog_identity_specs_compat.sql"; do
  test -s "$MIGRATION" || { echo "REQUIRED_MIGRATION_MISSING=$MIGRATION"; exit 1; }
  docker exec -i "$OLD" node --import tsx --input-type=module -e '
    import {readFileSync} from "node:fs";
    import {database,closeDatabase} from "./server/db/connection.ts";
    try {
      const sql=readFileSync(0,"utf8");
      await database().query(sql);
      console.log("PRODUCTION_ADDITIVE_MIGRATION_APPLIED");
    } catch(error) {
      console.error("PRODUCTION_ADDITIVE_MIGRATION_FAILED",error.code||"",error.message);
      process.exitCode=1;
    } finally { await closeDatabase(); }
  ' < "$MIGRATION"
done
echo 'PRODUCTION_CATALOG_IDENTITY_SCHEMA_READY'

echo '===== CONTINUE BLUE-GREEN DEPLOY ====='
echo '===== BACK UP NGINX AND COPY LIVE CONTAINER SETTINGS ====='
mkdir -m 700 -p "$BACKUP"
cp -p "$CONF1" "$BACKUP/default"
cp -p "$CONF2" "$BACKUP/https"
cp -p "$CONF_DOMAIN" "$BACKUP/domain"
docker inspect "$OLD" | python3 -c '
import json,os,sys
env=json.load(sys.stdin)[0]["Config"].get("Env",[])
env_path,args_path,vision_marker,vision_file=sys.argv[1:]
# Local-vision env entries are appended later; do not preserve stale duplicates.
override_keys=set()
if os.path.isfile(vision_marker) and os.path.isfile(vision_file):
 with open(vision_file,encoding="utf-8") as source:
  for line in source:
   if "=" in line and not line.lstrip().startswith("#"):
    key=line.split("=",1)[0].strip()
    if key:override_keys.add(key)
multiline=0
with open(env_path,"w",encoding="utf-8") as env_out, open(args_path,"wb") as args_out:
 for entry in env:
  key,sep,_=entry.partition("=")
  if not sep or key in override_keys:continue
  if not os.path.isfile(vision_marker) and entry=="PART_RECOGNITION_MODE=local-embedding":continue
  if "\n" in entry or "\r" in entry:
   # Docker env files are line-oriented; pass multiline values as argv entries.
   args_out.write(b"-e\0"+entry.encode("utf-8")+b"\0")
   multiline+=1
  else:
   env_out.write(entry+"\n")
print("LIVE_ENV_CAPTURE_OK multiline="+str(multiline))
' "$ENV_FILE" "$MULTILINE_ENV_FILE" "$APP/.local-vision-enabled" "$APP/.env.local-vision"
mapfile -d '' MULTILINE_ENV_ARGS < "$MULTILINE_ENV_FILE"
mapfile -d '' MOUNTS < <(
 docker inspect "$OLD" | python3 -c '
import json,os,sys
mounts=json.load(sys.stdin)[0]["Mounts"]
stage=sys.argv[1]
replace_forza=os.path.isfile(sys.argv[2])
assert any(m["Destination"]=="/app" for m in mounts)
for m in mounts:
 dest=m["Destination"]
 # The source release replaces /app; private local-vision files and, when
 # present on the host, the canonical FORZA config are re-mounted below.
 if dest in ("/app/.local-vision-enabled","/app/.env.local-vision") or (dest=="/app/.env.forza-voice" and replace_forza):
  continue
 source=stage if dest=="/app" else m["Source"]
 mode="rw" if m["RW"] else "ro"
 for arg in ("-v",f"{source}:{dest}:{mode}"):
  sys.stdout.buffer.write(arg.encode()+b"\0")
' "$STAGE" "$APP/.env.forza-voice"
)
test "${#MOUNTS[@]}" -ge 2
# Preserve optional private SMS credentials if an earlier canary lacked that mount.
if [[ -f "$APP/.env.sms" ]] &&
   ! docker inspect "$OLD" --format '{{range .Mounts}}{{println .Destination}}{{end}}' | grep -Fxq '/app/.env.sms'; then
  MOUNTS+=(-v "$APP/.env.sms:/app/.env.sms:ro")
fi
# Preserve the optional server-only staff Auth secret alongside existing SMS mounts.
if [[ -f "$APP/.env.staff" ]] &&
   ! docker inspect "$OLD" --format '{{range .Mounts}}{{println .Destination}}{{end}}' | grep -Fxq '/app/.env.staff'; then
  MOUNTS+=(-v "$APP/.env.staff:/app/.env.staff:ro")
fi

# Always bind the canonical host FORZA config when present. Do not inherit
# a stale mount source from the previous container just because its destination
# happens to be /app/.env.forza-voice.
if [[ -f "$APP/.env.forza-voice" ]]; then
  MOUNTS+=(-v "$APP/.env.forza-voice:/app/.env.forza-voice:ro")
  python3 - "$APP/.env.forza-voice" <<'PYFORZACONFIG'
from pathlib import Path
import sys
values={}
for line in Path(sys.argv[1]).read_text().splitlines():
 if '=' in line and not line.lstrip().startswith('#'):
  key,value=line.split('=',1)
  values[key.strip()]=value.strip().strip('"').strip("'")
for surface in ('DESK','VOICE'):
 provider=values.get('FORZA_'+surface+'_PROVIDER','').lower()
 if provider=='avalai':
  if surface=='DESK':
   key=values.get('AVALAI_DESK_API_KEY','').strip() or values.get('AVALAI_API_KEY','').strip()
  else:
   key=values.get('AVALAI_API_KEY','').strip()
  if not key:
   raise SystemExit('AVALAI_PROVIDER_SELECTED_BUT_PRIVATE_KEY_MISSING')
voice_provider=(values.get('FORZA_VOICE_PROVIDER') or values.get('FORZA_DESK_PROVIDER') or '').strip().lower()
if voice_provider!='avalai':
 raise SystemExit('FORZA_VOICE_PROVIDER_NOT_AVALAI')
print('PRIVATE_FORZA_CONFIG_PRESENT desk='+values.get('FORZA_DESK_PROVIDER','unset')+
      ' voice='+voice_provider+
      ' avalai_key='+('SET' if values.get('AVALAI_API_KEY','').strip() else 'EMPTY'))
PYFORZACONFIG
fi
# The release source is mounted at /app, so explicitly re-mount persistent
# local-vision activation/configuration files from the canonical project folder.
if [[ -f "$APP/.local-vision-enabled" ]]; then
  test -s "$APP/.env.local-vision"
  MOUNTS+=(-v "$APP/.local-vision-enabled:/app/.local-vision-enabled:ro")
  MOUNTS+=(-v "$APP/.env.local-vision:/app/.env.local-vision:ro")
fi
# Optional local vision sidecar: provisioned once, reused across application releases.
# The explicit marker is only created after photo binding reconciliation/benchmarks.
if [[ -f "$APP/.local-vision-enabled" ]]; then
 test -s "$APP/.env.local-vision"
 # The URL hostname is the exact versioned sidecar created by
 # ops/setup-local-vision-vps.sh. Do not silently start an older fixed-name image.
 VISION_NAME="$(python3 - "$APP/.env.local-vision" <<'PYVISION'
from pathlib import Path
from urllib.parse import urlparse
import re,sys
values=[line.split('=',1)[1].strip() for line in Path(sys.argv[1]).read_text().splitlines() if line.startswith('LOCAL_VISION_URL=')]
if not values: raise SystemExit('LOCAL_VISION_URL_MISSING')
url=urlparse(values[-1])
host=url.hostname or ''
if url.scheme not in ('http','https') or url.port!=8091 or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*',host):
 raise SystemExit('INVALID_PRIVATE_VISION_CONTAINER_URL')
print(host)
PYVISION
)"
 VISION_ENCODER="$(sed -n 's/^LOCAL_VISION_ENCODER=//p' "$APP/.env.local-vision" | tail -1 | tr -d '\r')"
 VISION_MODEL=dinov2-small-ed25f3a3-fp32-cls-224-v1
 VISION_DIMENSIONS=384
 VISION_PIPELINE=local-lens-v2
 if [[ "$VISION_ENCODER" == mobileclip2-s0 ]]; then
  VISION_MODEL=mobileclip2-s0-095906d2-fp32-pad-256-v1
  VISION_DIMENSIONS=512
  VISION_PIPELINE=local-lens-v3
 elif [[ -n "$VISION_ENCODER" && "$VISION_ENCODER" != dinov2-small ]]; then
  echo "UNSUPPORTED_LOCAL_VISION_ENCODER=$VISION_ENCODER" >&2
  exit 1
 fi
 docker container inspect "$VISION_NAME" >/dev/null || { echo "LOCAL_VISION_SIDECAR_MISSING=$VISION_NAME" >&2; exit 1; }
 VISION_IMAGE_ID="$(docker inspect "$VISION_NAME" --format '{{.Image}}')"
 docker image inspect "$VISION_IMAGE_ID" >/dev/null
 # The app config and already-running sidecar must use the same private token.
 python3 - "$APP/.env.local-vision" "$VISION_NAME" <<'PYTOKEN'
from pathlib import Path
import json,subprocess,sys
config={}
for line in Path(sys.argv[1]).read_text().splitlines():
 if '=' in line and not line.lstrip().startswith('#'):
  key,value=line.split('=',1);config[key.strip()]=value.strip().strip('"').strip("'")
container=json.loads(subprocess.check_output(['docker','inspect',sys.argv[2]]))[0]
runtime=dict(item.split('=',1) for item in container['Config'].get('Env',[]) if '=' in item)
if len(config.get('LOCAL_VISION_TOKEN',''))<32 or runtime.get('LOCAL_VISION_TOKEN')!=config.get('LOCAL_VISION_TOKEN'):
 raise SystemExit('LOCAL_VISION_TOKEN_MISMATCH')
PYTOKEN
 docker network connect "$NETWORK" "$VISION_NAME" 2>/dev/null || \
  docker inspect "$VISION_NAME" --format '{{json .NetworkSettings.Networks}}' | grep -Fq "\"$NETWORK\""
 docker start "$VISION_NAME" >/dev/null
 VISION_READY=0
 for _ in $(seq 1 30); do
  if docker exec "$VISION_NAME" python -c 'import json,sys,urllib.request; d=json.load(urllib.request.urlopen("http://127.0.0.1:8091/health",timeout=2)); assert d["model"]==sys.argv[1] and d.get("pipeline")==sys.argv[2]' "$VISION_MODEL" "$VISION_PIPELINE" 2>/dev/null; then VISION_READY=1; break; fi
  sleep 1
 done
 test "$VISION_READY" = 1
 # Verify encoder authentication and dimensions before changing the serving site.
 docker exec "$VISION_NAME" python -c 'import base64,io,json,os,sys,urllib.request; from PIL import Image; b=io.BytesIO(); Image.new("RGB",(24,24),"white").save(b,"JPEG"); r=urllib.request.Request("http://127.0.0.1:8091/embed",data=json.dumps({"images":[base64.b64encode(b.getvalue()).decode()]}).encode(),headers={"Authorization":"Bearer "+os.environ["LOCAL_VISION_TOKEN"],"Content-Type":"application/json"}); d=json.load(urllib.request.urlopen(r,timeout=10)); assert len(d["vectors"][0])==int(sys.argv[1]) and d["model"]==sys.argv[2]' "$VISION_DIMENSIONS" "$VISION_MODEL"
 # Docker uses the final definition; preserve all other existing live settings.
 cat "$APP/.env.local-vision" >> "$ENV_FILE"
else
 # Removing the marker must also disable the local mode inherited from the old container.
 sed -i '/^PART_RECOGNITION_MODE=local-embedding$/d' "$ENV_FILE"
fi
POPD_CATALOG_STORAGE_ROOT="$(python3 - "$ENV_FILE" <<'PYPRODUCTSTORAGE'
from pathlib import Path
import sys
values={}
for line in Path(sys.argv[1]).read_text().splitlines():
 key,sep,value=line.partition('=')
 if sep: values[key.strip()]=value.strip().strip('"').strip("'")
root=values.get('PRODUCT_STORAGE_DIR') or '/data/storage/products'
if not root.startswith('/data/'):
 raise SystemExit('PRODUCT_STORAGE_DIR_MUST_BE_ON_PERSISTENT_DATA_VOLUME')
print(root.rstrip('/'))
PYPRODUCTSTORAGE
)"
POPD_CATALOG_IMAGE_RELEASE_DIR="${POPD_CATALOG_STORAGE_ROOT}/catalog-releases/${POPD_CATALOG_IMAGE_RELEASE_ID}"
echo '===== STAGE AND VERIFY PINNED POPD 869 SKU IMAGES (NO LIVE LINK SWITCH) ====='
docker run --rm --network "$NETWORK" --workdir /app --cpus=1.5 --memory=3g --memory-swap=3g \
 -e "PRODUCT_STORAGE_DIR=$POPD_CATALOG_STORAGE_ROOT" \
 -e "CATALOG_IMAGE_RELEASE_ID=$POPD_CATALOG_IMAGE_RELEASE_ID" \
 -e CATALOG_IMAGE_ACTIVATE=false "${MOUNTS[@]}" "$STT_IMAGE" node scripts/sync-popd-catalog-images.mjs
docker exec "$OLD" sh -c "test -d '$POPD_CATALOG_IMAGE_RELEASE_DIR'"
echo "POPD_CATALOG_IMAGE_RELEASE_STAGED=$POPD_CATALOG_IMAGE_RELEASE_DIR"

echo '===== SYNC PINNED POPD REFERENCE JSON INTO THE ACTIVE PRODUCTION DATABASE ====='
# Pass only the live database connection settings, never AvalAI, SMS, vision,
# session, or other application secrets into this one-off archive importer.
docker inspect "$OLD" | python3 -c '
import json,sys
env=json.load(sys.stdin)[0]["Config"].get("Env",[])
allowed={"DATA_BACKEND","DATABASE_ENV","DATABASE_SCHEMA","DATABASE_URL","DATABASE_SSL","DATABASE_CA_CERT"}
required=allowed-{"DATABASE_CA_CERT"}
values={}
for entry in env:
 key,sep,_=entry.partition("=")
 if sep and key in allowed:
  values[key]=entry
missing=required-set(values)
if missing:
 raise SystemExit("POPD_ARCHIVE_DATABASE_ENV_MISSING="+",".join(sorted(missing)))
with open(sys.argv[1],"wb") as output:
 for key in sorted(values):
  for arg in ("-e",values[key]):
   output.write(arg.encode("utf-8")+bytes([0]))
' "$ARCHIVE_ENV_ARGS_FILE"
mapfile -d '' ARCHIVE_ENV_ARGS < "$ARCHIVE_ENV_ARGS_FILE"
docker run --rm --pull=never --network "$NETWORK" --workdir /app \
 --cpus=1 --memory=1g --memory-swap=1g -e NODE_ENV=production \
 "${ARCHIVE_ENV_ARGS[@]}" --mount "type=bind,source=$STAGE,target=/app" \
 node:22-bookworm node --import tsx scripts/sync-popd-reference-archives.mjs

echo '===== PRIVATE CANARY WITHOUT A HOST PORT ====='
CANARY_CID="$(docker run -d --name "$CANARY_NAME" --network "$NETWORK" --workdir /app \
 --cpus=1.5 --memory=3g --memory-swap=3g --env-file "$ENV_FILE" \
 "${MULTILINE_ENV_ARGS[@]}" -e PORT=3000 -e SANATPISH_SERVE_DIST=1 -e "SANATPISH_RELEASE_SHA=$EXPECTED" -e CATALOG_IMAGE_VOLUME_MIGRATE_ON_BOOT=false -e "CATALOG_IMAGE_READ_DIR=$POPD_CATALOG_IMAGE_RELEASE_DIR" -e "CATALOG_IMAGE_RELEASE_ID=$POPD_CATALOG_IMAGE_RELEASE_ID" -e CATALOG_IMAGE_ACTIVATE=false -e FORZA_STT_PROVIDER=avalai -e FORZA_STT_DIBA_MODEL_PATH=/opt/diba-stt/model -e FORZA_STT_DIBA_BROWSER_ARCHIVE=/opt/diba-stt/diba-stt-fa-small.tar.gz -e FORZA_STT_PYTHON=/opt/forza-pocket/bin/python -e FORZA_STT_WORKERS=2 -e CUSTOMER_360_LOCAL_VAULT_ENABLED=true \
 "${MOUNTS[@]}" "$STT_IMAGE" node --import tsx server.ts)"
READY=0
for i in $(seq 1 65); do
 if docker exec "$CANARY_NAME" node -e '
   fetch("http://127.0.0.1:3000/api/health",{signal:AbortSignal.timeout(3000)})
   .then(async r=>{const j=await r.json();process.exit(r.ok&&j.database==="ok"?0:1)})
   .catch(()=>process.exit(1))' >/dev/null 2>&1; then READY=1; break; fi
 if test "$(docker inspect "$CANARY_NAME" --format '{{.State.Running}}')" != true; then
   docker logs --tail 50 "$CANARY_NAME" || true
   echo PRIVATE_CANARY_EXITED
   exit 1
 fi
 sleep 1
done
test "$READY" = 1
test "$(docker inspect "$CANARY_NAME" --format '{{.State.OOMKilled}}')" = false
if [[ -f "$APP/.env.forza-voice" ]]; then
  HOST_FORZA_SHA="$(sha256sum "$APP/.env.forza-voice" | awk '{print $1}')"
  CANARY_FORZA_SHA="$(docker exec "$CANARY_NAME" sha256sum /app/.env.forza-voice | awk '{print $1}')"
  test "$HOST_FORZA_SHA" = "$CANARY_FORZA_SHA" || {
    echo "PRIVATE_FORZA_CONFIG_MOUNT_MISMATCH" >&2
    exit 1
  }
  echo "PRIVATE_FORZA_CONFIG_MOUNT_OK"
  # Verify the same loader used by server.ts resolves the selected AvalAI
  # provider and key before the canary is allowed to take production traffic.
  docker exec "$CANARY_NAME" node --import tsx --input-type=module -e '
    import fs from "node:fs";
    import dotenv from "dotenv";
    import { applyPrivateForzaConfig } from "./server/ai/privateForzaConfig.ts";
    const parsed = dotenv.parse(fs.readFileSync("/app/.env.forza-voice"));
    applyPrivateForzaConfig(process.env, parsed);
    const voiceProvider = String(
      process.env.FORZA_VOICE_PROVIDER || process.env.FORZA_DESK_PROVIDER || ""
    ).trim().toLowerCase();
    const deskProvider = String(process.env.FORZA_DESK_PROVIDER || "unset").trim().toLowerCase();
    if (voiceProvider !== "avalai") throw new Error("FORZA_VOICE_PROVIDER_NOT_AVALAI");
    if (!process.env.AVALAI_API_KEY?.trim()) throw new Error("AVALAI_API_KEY_NOT_EFFECTIVE");
    console.log("AVALAI_CANARY_CONFIG_OK desk=" + deskProvider +
      " voice=" + voiceProvider + " key=SET");
  '
fi
if ! docker exec -e "OLD_HOST=$OLD" "$CANARY_NAME" node --import tsx ops/verify-single-port-canary.mjs; then
  echo '===== PRIVATE CANARY APPLICATION LOGS (LAST 160 LINES) =====' >&2
  docker logs --tail 160 "$CANARY_NAME" >&2 || true
  exit 1
fi

if [[ -f "$APP/.local-vision-enabled" ]]; then
 echo '===== RESUME PERSISTED LOCAL IMAGE INDEX BEFORE PROMOTION ====='
 # Startup warmup is enabled in the private canary. CatalogVisualIndex.update
 # embeds only rows whose stored signature differs; completed batches survive
 # failed releases in PostgreSQL and are not rebuilt.
 LIVE_VISION_STATUS="$(docker exec "$OLD" node -e '
   fetch("http://127.0.0.1:3000/api/ai/local-vision-status",{signal:AbortSignal.timeout(8000)})
    .then(async r=>{if(!r.ok)throw new Error("LIVE_VISION_STATUS_HTTP_"+r.status);console.log(JSON.stringify(await r.json()))})
    .catch(e=>{console.error(e.message);process.exit(1)})')"
 printf '%s\n' "$LIVE_VISION_STATUS" | node -e '
  let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
   const d=JSON.parse(s);
   if(!d.enabled || !d.model || !d.pipeline)throw new Error("LIVE_VISION_CONFIG_INVALID");
   console.log("LIVE_INDEX",d.indexed,"/",d.total,"ready="+d.ready,"model="+d.model);
  });'
 VISION_INDEX_READY=0
 for attempt in $(seq 1 360); do
  CANARY_VISION_STATUS="$(docker exec "$CANARY_NAME" node -e '
    fetch("http://127.0.0.1:3000/api/ai/local-vision-status",{signal:AbortSignal.timeout(8000)})
     .then(async r=>{if(!r.ok)throw new Error("CANARY_VISION_STATUS_HTTP_"+r.status);console.log(JSON.stringify(await r.json()))})
     .catch(e=>{console.error(e.message);process.exit(1)})')"
  if CHECK_OUTPUT="$(printf '%s\n' "$CANARY_VISION_STATUS" | node -e '
   let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
    const d=JSON.parse(s);
    if(!d.enabled || d.persistence!=="postgres" ||
       !d.namespace || d.namespace!=="catalog_visual_"+d.model ||
       !Number.isInteger(d.total) || !Number.isInteger(d.indexed) ||
       !Number.isInteger(d.storedEntries) || d.storedEntries<d.indexed ||
       !Number.isInteger(d.missing) || !Number.isInteger(d.signatureChanged)){
      console.error("LOCAL_VISION_PERSISTENCE_GATE_FAILED_INVALID_STATUS");
      process.exitCode=2;
      return;
    }
    console.log("CANARY_INDEX",d.indexed,"/",d.total,
      "stored="+d.storedEntries,"missing="+d.missing,
      "changed="+d.signatureChanged,"persistence="+d.persistence);
    if(d.ready && d.indexed===d.total && d.missing===0 && d.signatureChanged===0){
      console.log("LOCAL_VISION_INDEX_READY");
      process.exitCode=0;
      return;
    }
    process.exitCode=3;
   });')"; then
    echo "$CHECK_OUTPUT"
    VISION_INDEX_READY=1
    break
  else
    CHECK_STATUS=$?
    if [[ "$CHECK_STATUS" -eq 2 ]]; then
      echo "$CHECK_OUTPUT" >&2
      exit 1
    fi
    if (( attempt == 1 || attempt % 6 == 0 )); then
      echo "$CHECK_OUTPUT"
      echo "LOCAL_VISION_RESUME_WAIT attempt=$attempt/360"
    fi
  fi
  sleep 5
 done
 if [[ "$VISION_INDEX_READY" != 1 ]]; then
  echo "LOCAL_VISION_RESUME_TIMEOUT_AFTER_30_MINUTES" >&2
  docker logs --tail 80 "$CANARY_NAME" || true
  exit 1
 fi
 node -e '
  const live=JSON.parse(process.argv[1]), next=JSON.parse(process.argv[2]);
  const fail=message=>{console.error("LOCAL_VISION_PERSISTENCE_GATE_FAILED "+message);process.exit(1)};
  for(const key of ["model","pipeline","total"])
    if(live[key]!==next[key])fail("LIVE_CANARY_MISMATCH_"+key);
  if(next.persistence!=="postgres" || !next.ready ||
     next.indexed!==next.total || next.missing!==0 || next.signatureChanged!==0)
    fail("CANARY_INDEX_NOT_READY");
  console.log("LOCAL_VISION_PERSISTED_INDEX_RESUMED_OK",next.indexed,"/",next.total);
 ' "$LIVE_VISION_STATUS" "$CANARY_VISION_STATUS"
 test "$(docker inspect "$CANARY_NAME" --format '{{.State.OOMKilled}}')" = false
fi

echo '===== PROMOTE ON SAME FIXED PORT (BRIEF RESTART) ====='
docker rm -f "$CANARY_NAME" >/dev/null
CANARY_CID=''
PROMOTING=1
docker stop -t 12 "$OLD" >/dev/null
CID="$(docker run -d --name "$NAME" --restart unless-stopped \
 --network "$NETWORK" --workdir /app --cpus=1.5 --memory=3g --memory-swap=3g \
 -p "127.0.0.1:$FIXED_PORT:3000" --env-file "$ENV_FILE" \
 "${MULTILINE_ENV_ARGS[@]}" -e PORT=3000 -e SANATPISH_SERVE_DIST=1 -e "SANATPISH_RELEASE_SHA=$EXPECTED" -e CATALOG_IMAGE_VOLUME_MIGRATE_ON_BOOT=false -e FORZA_STT_PROVIDER=avalai -e FORZA_STT_DIBA_MODEL_PATH=/opt/diba-stt/model -e FORZA_STT_PYTHON=/opt/forza-pocket/bin/python -e FORZA_STT_WORKERS=2 -e CUSTOMER_360_LOCAL_VAULT_ENABLED=true \
 "${MOUNTS[@]}" "$STT_IMAGE" node --import tsx server.ts)"
READY=0
for i in $(seq 1 60); do
 if curl --noproxy '*' -fsS --max-time 3 "http://127.0.0.1:$FIXED_PORT/api/health" 2>/dev/null | grep -q '"database":"ok"'; then READY=1; break; fi
 test "$(docker inspect "$NAME" --format '{{.State.Running}}')" = true || break
 sleep 1
done
test "$READY" = 1 || { docker logs --tail 50 "$NAME" || true; exit 1; }
echo "SINGLE_PORT_PROMOTED port=$FIXED_PORT"

echo '===== ONE FIXED PORT FOR ALL PUBLIC WEBSITE VHOSTS ====='
python3 - "$CONF1" "$CONF2" "$CONF_DOMAIN" "$FIXED_PORT" <<'PY'
from pathlib import Path
import re,sys
*files,target=sys.argv[1:]
pattern=re.compile(r'(proxy_pass\s+http://127\.0\.0\.1:)(30(?:0[0-9]|1[0-9]|20))(;)')

def nginx_block_at(text, opening_brace):
 depth=0
 quote=None
 escaped=False
 comment=False
 for pos in range(opening_brace,len(text)):
  char=text[pos]
  if comment:
   if char=="\n": comment=False
   continue
  if quote:
   if escaped: escaped=False
   elif char=="\\": escaped=True
   elif char==quote: quote=None
   continue
  if char in ("\"","'"):
   quote=char
  elif char=="#":
   comment=True
  elif char=="{":
   depth+=1
  elif char=="}":
   depth-=1
   if depth==0:
    return text[opening_brace:pos+1]
 raise AssertionError("UNBALANCED_NGINX_BLOCK")

def nginx_depth_before(text, stop):
 depth=0
 quote=None
 escaped=False
 comment=False
 for pos,char in enumerate(text[:stop]):
  if comment:
   if char=="\n": comment=False
   continue
  if quote:
   if escaped: escaped=False
   elif char=="\\": escaped=True
   elif char==quote: quote=None
   continue
  if char in ("\"","'"):
   quote=char
  elif char=="#":
   comment=True
  elif char=="{":
   depth+=1
  elif char=="}":
   depth-=1
 return depth

def require_read_only_spa_guard(root_block, filename):
 guard_pattern=re.compile(r'(?m)^[ \t]*limit_except[ \t]+([^;{}]+)\{')
 valid=[]
 for match in guard_pattern.finditer(root_block):
  if nginx_depth_before(root_block,match.start())!=1:
   continue
  methods=match.group(1).split()
  if set(methods) not in ({"GET"},{"GET","HEAD"}):
   continue
  guard_block=nginx_block_at(root_block,match.end()-1)
  if not re.search(r'(?m)^[ \t]*deny[ \t]+all[ \t]*;',guard_block):
   continue
  valid.append((methods,guard_block))
 assert len(valid)==1,("READ_ONLY_SPA_GUARD_NOT_PRESERVED",filename,len(valid))
 print("READ_ONLY_SPA_GUARD_OK",filename,"methods="+",".join(valid[0][0]))
 return valid[0]

contents=[Path(p).read_text() for p in files]
for filename,source in zip(files,contents):
 matches=pattern.findall(source)
 assert matches,("NO_APP_UPSTREAM",filename)
 assert len({m[1] for m in matches})==1,("MIXED_APP_UPSTREAMS",filename)
updated=[]
for index,(filename,source) in enumerate(zip(files,contents)):
 source=pattern.sub(lambda m:m.group(1)+target+m.group(3),source)
 # CONF1 is deliberately read-only. Customer HTTPS proxies /api to Express;
 # plain HTTP redirects /api to HTTPS instead of proxying customer data.
 if index in (1,2):
  marker="# SANATPISH_API_WRITE_ROUTE_V2"
  old_markers=("# SANATPISH_API_WRITE_ROUTE_V1",marker)
  root_pattern=re.compile(r'(?m)^([ \t]*)location\s+/\s*\{')
  api_pattern=re.compile(r'(?m)^[ \t]*location\s+(?:\^~\s+)?/api/\s*\{')
  roots=list(root_pattern.finditer(source))
  assert len(roots)==1,("UNEXPECTED_ROOT_LOCATION_COUNT",filename,len(roots))
  found=[m for m in old_markers if m in source]
  if found:
   assert len(found)==1 and source.count(found[0])==1,("DUPLICATE_API_ROUTE_MARKERS",filename,found)
   marker_offset=source.index(found[0])
   # Trim from the START of the marker line. Keeping its leading whitespace
   # joins that indentation to the next root line; repeated deploys then
   # double the root indentation and balloon the vhost exponentially.
   route_start=source.rfind("\n",0,marker_offset)+1
   assert source[route_start:marker_offset].strip()=="",("API_ROUTE_MARKER_NOT_LINE_ANCHORED",filename)
   assert route_start<roots[0].start(),("API_ROUTE_AFTER_SPA_FALLBACK",filename)
   source=source[:route_start]+source[roots[0].start():]
  else:
   assert not api_pattern.search(source),("UNMANAGED_API_PREFIX_LOCATION",filename)
  roots=list(root_pattern.finditer(source))
  assert len(roots)==1,("ROOT_LOCATION_CHANGED",filename,len(roots))
  # Whitespace is formatting, not a security boundary. Require the SPA root
  # to be a direct child of the server block instead of imposing an arbitrary
  # indentation limit that rejects valid, consistently formatted vhosts.
  root_depth=nginx_depth_before(source,roots[0].start())
  assert root_depth==1,("NGINX_ROOT_CONTEXT_UNSAFE",filename,root_depth)
  indent=roots[0].group(1)
  if index==1:
   lines=(
    f"{indent}{marker}",
    f"{indent}location ^~ /api/ {{",
    f"{indent}    # Preserve Express JSON 401/403 responses instead of Nginx HTML error pages.",
    f"{indent}    proxy_intercept_errors off;",
    f"{indent}    proxy_pass_header X-Powered-By;",
    f"{indent}    satisfy any;",
    f"{indent}    allow all;",
    f"{indent}    auth_basic off;",
    f"{indent}    auth_request off;",
    f"{indent}    proxy_pass http://127.0.0.1:{target};",
    f"{indent}    proxy_http_version 1.1;",
    f"{indent}    proxy_set_header Host $host;",
    f"{indent}    proxy_set_header X-Real-IP $remote_addr;",
    f"{indent}    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
    f"{indent}    proxy_set_header X-Forwarded-Proto https;",
    f"{indent}    proxy_set_header Upgrade $http_upgrade;",
    f"{indent}    proxy_set_header Connection $connection_upgrade;",
    f"{indent}    proxy_connect_timeout 15s;",
    f"{indent}    proxy_read_timeout 300s;",
    f"{indent}    proxy_send_timeout 300s;",
    f"{indent}    proxy_buffering off;",
    f"{indent}    proxy_request_buffering off;",
    f"{indent}}}",
   )
   label="CUSTOMER_HTTPS_API_PROXY_ROUTE_READY"
  else:
   lines=(
    f"{indent}{marker}",
    f"{indent}location ^~ /api/ {{",
    f"{indent}    return 308 https://$host$request_uri;",
    f"{indent}}}",
   )
   label="CUSTOMER_HTTP_API_HTTPS_REDIRECT_READY"
  block="\n".join(lines)
  source=source[:roots[0].start()]+block+"\n\n"+source[roots[0].start():]
  roots=list(root_pattern.finditer(source))
  assert len(roots)==1 and source.index(marker)<roots[0].start(),("API_ROUTE_NOT_BEFORE_SPA_FALLBACK",filename)
  root_block=nginx_block_at(source,roots[0].end()-1)
  require_read_only_spa_guard(root_block,filename)
  route=source[source.index(marker):roots[0].start()]
  assert "limit_except" not in route,("API_METHODS_MUST_REACH_EXPRESS",filename)
  if index==1:
   assert f"proxy_pass http://127.0.0.1:{target};" in route,("HTTPS_API_PROXY_ROUTE_INVALID",filename)
  else:
   assert "return 308 https://$host$request_uri;" in route and "proxy_pass" not in route,("HTTP_API_REDIRECT_INVALID",filename)
  assert source.count(marker)==1
  print(label,filename,"upstream="+target if index==1 else "https_redirect")
 else:
  assert "SANATPISH_API_WRITE_ROUTE_V1" not in source and "SANATPISH_API_WRITE_ROUTE_V2" not in source,("IP_PREVIEW_MUST_REMAIN_READ_ONLY",filename)
  print("READ_ONLY_IP_PREVIEW_PRESERVED",filename)
 updated.append((filename,source))
for filename,source in updated:
 Path(filename).write_text(source)
 print("SINGLE_PORT_NGINX_UPDATED",filename,target)
print("API_ROUTE_METHODS_DELEGATED_TO_EXPRESS")
PY
nginx -t
systemctl reload nginx

echo '===== VERIFY PUBLIC HTTPS ====='
python3 - "$NEXT" <<'PY'
import sys,ssl,time,json,subprocess
port=sys.argv[1]
domain='sanatpish.com'
def get(path):
 cmd=['curl','--noproxy','*','-kfsS','--connect-timeout','3','--max-time','25',
      '--resolve',f'{domain}:443:127.0.0.1',f'https://{domain}{path}']
 return subprocess.run(cmd,check=True,stdout=subprocess.PIPE).stdout
expected=subprocess.run(['curl','--noproxy','*','-fsS','--max-time','25',
                         f'http://127.0.0.1:{port}/'],
                        check=True,stdout=subprocess.PIPE).stdout
for i in range(10):
 try:
  if get('/')==expected:break
 except Exception:pass
 time.sleep(2)
else:raise AssertionError('HTTPS_BUILD_MISMATCH')
health=json.loads(get('/api/health'))
assert health.get('status')=='ok' and health.get('database')=='ok'
# A GET-only Nginx location can serve the homepage and health endpoint while
# silently blocking CRM/catalogue writes with an HTML 403. Probe protected
# POST routes through the actual local HTTPS vhost before marking release good.
# No session cookie is sent; these handlers must reject anonymously with JSON.
def post_json(path,host):
 cmd=['curl','--noproxy','*','-ksS','--connect-timeout','3','--max-time','15',
      '--resolve',f'{host}:443:127.0.0.1','-D','-',
      '-H','Accept: application/json','-H','Content-Type: application/json',
      '-X','POST','--data','{}','-w','\n__META__%{http_code}|%{content_type}',
      f'https://{host}{path}']
 result=subprocess.run(cmd,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 raw=result.stdout
 if b'\n__META__' not in raw:
  raise AssertionError('PUBLIC_POST_API_MISSING_HTTP_METADATA '+host+path)
 response,meta=raw.rsplit(b'\n__META__',1)
 if b'\r\n\r\n' not in response:
  raise AssertionError('PUBLIC_POST_API_MISSING_RESPONSE_HEADERS '+host+path)
 headers,body=response.split(b'\r\n\r\n',1)
 status,content_type=meta.decode('utf-8','replace').strip().split('|',1)
 assert status in ('401','403'), ('PUBLIC_POST_API_WRONG_STATUS',host,path,status,content_type)
 assert 'application/json' in content_type.lower(), ('PUBLIC_POST_API_BLOCKED_BEFORE_EXPRESS',host,path,status,content_type)
 assert any(line.lower().startswith(b'x-powered-by: express') for line in headers.splitlines()), ('PUBLIC_POST_API_EXPRESS_HEADER_MISSING',host,path,headers.decode('utf-8','replace'))
 payload=json.loads(body)
 assert payload.get('success') is False or isinstance(payload.get('error'),dict), ('PUBLIC_POST_API_BAD_DENIAL',host,path)
 print('PUBLIC_POST_API_EXPRESS_HEADER_OK',host,path)
 print('PUBLIC_POST_API_JSON_GUARD_OK',host,path,'HTTP',status)
for host in (domain,'www.'+domain):
 for path in ('/api/admin/crm/customers','/api/catalog/sku-transfer'):
  post_json(path,host)
# Plain HTTP writes must redirect to the same HTTPS URL rather than reach the app.
redirect_cmd=['curl','--noproxy','*','-sS','--connect-timeout','3','--max-time','15',
              '--resolve',f'{domain}:80:127.0.0.1','-D','-','-o','/dev/null',
              '-H','Content-Type: application/json','-X','POST','--data','{}',
              '-w','\n__META__%{http_code}',f'http://{domain}/api/admin/crm/customers']
redirect=subprocess.run(redirect_cmd,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE).stdout
if b'\n__META__' not in redirect:raise AssertionError('HTTP_API_REDIRECT_MISSING_METADATA')
redirect_headers,redirect_meta=redirect.rsplit(b'\n__META__',1)
assert redirect_meta.decode().strip()=='308',('HTTP_API_HTTPS_REDIRECT_BAD_STATUS',redirect_meta)
assert any(line.lower().startswith(b'location: https://sanatpish.com/api/admin/crm/customers') for line in redirect_headers.splitlines()),('HTTP_API_HTTPS_REDIRECT_BAD_LOCATION',redirect_headers.decode('utf-8','replace'))
print('HTTP_API_HTTPS_REDIRECT_OK')
# SPA fallback returns index.html with HTTP 200 for unknown API routes.
# Treat that as a deployment failure; Nginx rollback stays armed.
# Diba warms asynchronously as the offline fallback, so allow it to finish
# before deciding whether the new release can safely accept a voice call.
stt_info={}
for attempt in range(40):
 try:
  stt_info=json.loads(get('/api/ai/forza-stt-info'))
 except Exception:
  stt_info={}
 if (stt_info.get('serverSttConfigured') is True and
     stt_info.get('serverSttProvider') == 'avalai' and
     stt_info.get('serverSttReady') is True and
     stt_info.get('serverSttFallbackProvider') == 'diba' and
     stt_info.get('serverSttFallbackReady') is True):
  break
 time.sleep(1)
else:
 raise AssertionError(('FORZA_STT_AVALAI_OR_DIBA_FALLBACK_NOT_READY',stt_info))
print('PUBLIC_FORZA_STT_AVALAI_READY_DIBA_FALLBACK_OK')
print('PUBLIC_HTTPS_AND_DATABASE_OK domain='+domain+' sni=correct')
PY
echo '===== VERIFY DOMAIN AND IP ROUTE TO SAME RELEASE ====='
python3 - "$CONF1" "$CONF2" "$CONF_DOMAIN" "$NEXT" <<'PY'
from pathlib import Path
import re,sys
*paths,new=sys.argv[1:]
pattern=r'proxy_pass\s+http://127\.0\.0\.1:(30(?:0[4-9]|1[0-9]|20));'
for filename in paths:
 ports=set(re.findall(pattern,Path(filename).read_text()))
 assert ports=={new},('NGINX_VHOST_DRIFT_AFTER_SWITCH',filename,ports,new)
 print('NGINX_VHOST_MATCH',filename,'port='+new)
PY
EXPECTED_HTML="$(curl --noproxy '*' -fsS --max-time 25 "http://127.0.0.1:$NEXT/")"
for DOMAIN in sanatpish.com www.sanatpish.com; do
  DOMAIN_HTML="$(curl --noproxy '*' -kfsS --max-time 25 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/")"
  if test "$DOMAIN_HTML" != "$EXPECTED_HTML"; then
    echo "DOMAIN_BUILD_MISMATCH domain=$DOMAIN port=$NEXT" >&2
    exit 1
  fi
  curl --noproxy '*' -kfsS --max-time 15 --resolve "$DOMAIN:443:127.0.0.1" \
    "https://$DOMAIN/api/health" | grep -q '"database":"ok"'
  echo "DOMAIN_BUILD_AND_DATABASE_OK domain=$DOMAIN port=$NEXT"
done
test "$(docker inspect "$CID" --format '{{.State.Running}}')" = true
echo '===== PINNED PRIVATE NIMA CANARY AND SAFE VOICE PROMOTION ====='
bash -n "$STAGE/ops/deploy-forza-nima-pinned-vps.sh"
bash "$STAGE/ops/deploy-forza-nima-pinned-vps.sh" "$EXPECTED" "$NAME" "$NETWORK" "$STAGE"
echo '===== SITE AND PRIVATE VOICE BOTH HEALTHY ====='
echo '===== STOP OLD WEBSITE CONTAINERS WITHOUT DELETING DATA ====='
# This phase runs only after new app, TLS routes, catalog and voice succeeded.
# Never stop Supabase, private voice or another service still referenced by Nginx.
for stale in $(docker ps --format '{{.Names}}'); do
 case "$stale" in
  sanatpish-unified-live-*|sanatpish-new|sanatpish-hotfix-live|sanatpish-images-live-*|sanatpish-firstpaint-live-*)
   test "$stale" != "$NAME" || continue
   PUBLISHED="$(docker port "$stale" 3000/tcp 2>/dev/null | sed -n 's/.*127\.0\.0\.1:\([0-9]\+\)$/\1/p' | head -1)"
   if test -n "$PUBLISHED" &&
      nginx -T 2>/dev/null | grep -Eq "proxy_pass[[:space:]]+http://127\.0\.0\.1:$PUBLISHED;"; then
     echo "RETAIN_REFERENCED_CONTAINER name=$stale port=$PUBLISHED"
   else
     if docker stop -t 8 "$stale"; then
       echo "STOPPED_UNUSED_APP name=$stale port=$PUBLISHED"
     else
       echo "WARN_UNUSED_APP_STILL_RUNNING name=$stale"
     fi
   fi
   ;;
 esac
done
echo '===== VERIFY ONLY ONE WEBSITE HOST PORT IS PUBLISHED ====='
docker ps --format '{{.Names}} {{.Ports}}' | grep '^sanatpish-' || true
# Only the current app is allowed to remain running. No database or private
# voice containers are matched by this website-specific check.
STALE_ACTIVE="$(docker ps --format '{{.Names}}' | grep -E '^sanatpish-(unified-live-|new$|hotfix-live$|images-live-|firstpaint-live-)' | grep -Fxv "$NAME" || true)"
if test -n "$STALE_ACTIVE"; then
  echo "OTHER_WEBSITE_CONTAINERS_STILL_RUNNING - rollback rather than claim one-port success" >&2
  echo "$STALE_ACTIVE" >&2
  exit 1
fi
ACTUAL_PORT="$(docker port "$NAME" 3000/tcp)"
test "$ACTUAL_PORT" = "127.0.0.1:$FIXED_PORT"
echo "SANATPISH_SINGLE_HOST_PORT_DEPLOY_OK port=$FIXED_PORT"
SUCCESS=1
echo '===== SAFE RELEASE RETENTION (CURRENT + PREVIOUS) ====='
if bash "$STAGE/ops/prune-deploy-releases.sh" "$NAME" "$OLD" "$STAGE"; then
  :
else
  echo 'WARN_RELEASE_RETENTION_HELPER_FAILED_SITE_REMAINS_LIVE'
fi
echo 'SANATPISH_MAIN_BLUEGREEN_DEPLOY_OK'
echo 'SANATPISH_SINGLE_PORT_RELEASE_OK'
echo "RELEASE_SHA=$EXPECTED"
echo "NEW_CONTAINER=$NAME"
echo "NEW_PORT=$NEXT"
echo "PREVIOUS_CONTAINER=$OLD"
echo "PREVIOUS_PORT=$ACTIVE"
echo "HOST_APP_PORTS_TARGET=1"
echo "ROLLBACK_BACKUP=$BACKUP"
