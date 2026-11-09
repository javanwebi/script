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
  local url="$1" label="$2" insecure="${3:-0}" attempt body
  local -a args=(--noproxy '*' -fsS --connect-timeout 3 --max-time 12)
  [[ "$insecure" == 1 ]] && args+=(-k)
  for attempt in $(seq 1 8); do
    if body="$(curl "${args[@]}" "$url" 2>/dev/null)" &&
       grep -q '"database":"ok"' <<<"$body"; then
      echo "${label}=OK attempt=${attempt}"
      return 0
    fi
    sleep 2
  done
  echo "${label}=FAILED url=${url}" >&2
  curl --noproxy '*' -skv --connect-timeout 3 --max-time 8 "$url" 2>&1 | tail -25 >&2 || true
  return 1
}
wait_for_live_health "http://127.0.0.1:$ACTIVE/api/health" ACTIVE_HTTP_HEALTH
wait_for_live_health "https://127.0.0.1/api/health" ACTIVE_HTTPS_HEALTH 1
OLD=''
for c in $(docker ps --format '{{.Names}}'); do
 if docker port "$c" 3000/tcp 2>/dev/null | grep -Fxq "127.0.0.1:$ACTIVE"; then OLD="$c"; break; fi
done
test -n "$OLD"
echo "ACTIVE_CONTAINER=$OLD"

NEXT="$FIXED_PORT"
echo "STABLE_APP_PORT=$NEXT"

STAMP="$(date +%Y%m%d-%H%M%S)-$BASHPID"
STAGE="/opt/sanatpish-unified-stage-$STAMP"
NAME="sanatpish-unified-live-$STAMP"
CANARY_NAME="sanatpish-unified-canary-$STAMP"
BACKUP="/root/sanatpish-main-rollback-$STAMP"
ENV_FILE="$(mktemp /tmp/sanatpish-camera-env.XXXXXXXX)"
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
   if [[ "$STAGE" == /opt/sanatpish-unified-stage-* ]]; then
     rm -rf -- "$STAGE"
   fi
 fi
 if test -n "$CANARY_CID"; then
   docker rm -f "$CANARY_NAME" >/dev/null 2>&1 || true
 fi
 rm -f -- "$ENV_FILE"
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
 node:22-bookworm sh -ec 'npm ci --include=dev --no-audit --no-fund --loglevel=info && npm run lint && node --import tsx --test tests/mobile-scan-ui.test.ts tests/forza-mobile-contact-sheet.test.ts && npm run build' 2>&1 | tee "$BUILD_LOG"
test -s "$STAGE/dist/index.html"
grep -RlF 'full-screen-camera-experience' "$STAGE/dist/assets" --include='*.js' >/dev/null
grep -RlF 'عکس‌برداری مجدد' "$STAGE/dist/assets" --include='*.js' >/dev/null
grep -RlF 'تأیید و جستجوی قطعه' "$STAGE/dist/assets" --include='*.js' >/dev/null
grep -RlF 'vision-analyzing-screen' "$STAGE/dist/assets" --include='*.js' >/dev/null
grep -RlF 'sanat-identification-open' "$STAGE/dist/assets" --include='*.js' >/dev/null
grep -RlF 'forza-mobile-contact-sheet' "$STAGE/dist/assets" --include='*.js' >/dev/null
grep -RlF 'forza-swipe-instruction' "$STAGE/dist/assets" --include='*.js' >/dev/null
grep -RlF 'forza-swipe-instruction' "$STAGE/dist/assets" --include='*.js' >/dev/null
grep -RlF 'store-scan-action' "$STAGE/dist/assets" --include='*.js' >/dev/null
grep -RlF 'home-category-group' "$STAGE/dist/assets" --include='*.js' >/dev/null
grep -RlF 'sp-vision-analysis__viewer' "$STAGE/dist/assets" --include='*.css' >/dev/null
grep -RlF 'sanat-camera-experience__stage' "$STAGE/dist/assets" --include='*.css' >/dev/null
test -s "$STAGE/dist/images/scan-industrial-generated.webp"
test -s "$STAGE/dist/images/precision-scan-technical-overlay.svg"
WEBPS="$(find "$STAGE/dist/assets" -maxdepth 1 -type f -name '*.webp' | wc -l)"
test "$WEBPS" -ge 21
echo "CAMERA_AND_WEBP_BUILD_OK count=$WEBPS"

echo '===== VERIFY PRODUCTION NAVIGATION SCHEMA (SAME LIVE DATABASE) ====='
# Executed inside the currently serving container, reusing its exact DATABASE_URL,
# SSL configuration and private credentials. Only additive DDL and absent groups.
# Do not run this recovery against an unrelated connected Supabase project.
if ! docker exec "$OLD" node --import tsx --input-type=module -e '
  import {database, closeDatabase} from "./server/db/connection.ts";
  try {
    const rows=await database().query(
      "select to_regclass(\x27public.catalog_navigation_groups\x27) as groups, " +
      "to_regclass(\x27public.catalog_family_menu_assignments\x27) as assignments, " +
      "to_regclass(\x27public.catalog_direct_skus\x27) as direct");
    const row=rows.rows[0];
    const approved=row.groups
      ? await database().query("select count(*)::int as total from public.catalog_navigation_groups where id ~ \x27^excel-v2-[0-9]+$\x27 and is_active=true")
      : {rows:[{total:0}]};
    const categoryCount=await database().query(
      "select count(*)::int as total from public.catalog_categories where is_active=true and slug ~ \x27^excel-v2-[0-9]+-[0-9]+$\x27 and metadata->>\x27source\x27=\x27industrial_megamenu_hierarchy_v2\x27");
    if (!row.groups || !row.assignments || !row.direct || Number(approved.rows[0].total)<14 || Number(categoryCount.rows[0].total)<34) process.exitCode=2;
    else console.log("PRODUCTION_NAV_SCHEMA_ALREADY_OK", approved.rows[0].total, categoryCount.rows[0].total);
  }catch(error){console.error("PRODUCTION_NAV_SCHEMA_CHECK_FAILED",error.code||"",error.message);process.exitCode=2}
  finally{await closeDatabase()}
'; then
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
fi
# A missing table must never be reported as a successful deploy.
docker exec "$OLD" node --import tsx --input-type=module -e '
 import {database,closeDatabase} from "./server/db/connection.ts";
 try {
  const x=await database().query(
   "select count(*)::int as n from public.catalog_navigation_groups where is_active=true and id ~ \x27^excel-v2-[0-9]+$\x27");
  if(Number(x.rows[0].n)<14)throw Error("Expected 14 approved menu groups");
  const c=await database().query(
   "select count(*)::int as n from public.catalog_categories where is_active=true and slug ~ \x27^excel-v2-[0-9]+-[0-9]+$\x27 and metadata->>\x27source\x27=\x27industrial_megamenu_hierarchy_v2\x27");
  if(Number(c.rows[0].n)<34)throw Error("Expected 34 active approved categories, found "+c.rows[0].n);
  console.log("PRODUCTION_NAVIGATION_GROUPS_VERIFIED",x.rows[0].n);
  console.log("PRODUCTION_APPROVED_CATEGORIES_VERIFIED",c.rows[0].n);
 }catch(error){console.error("PRODUCTION_NAVIGATION_VERIFY_FAILED",error.code||"",error.message);process.exitCode=1}
 finally{await closeDatabase()}
'
echo '===== CONTINUE BLUE-GREEN DEPLOY ====='
echo '===== BACK UP NGINX AND COPY LIVE CONTAINER SETTINGS ====='
mkdir -m 700 -p "$BACKUP"
cp -p "$CONF1" "$BACKUP/default"
cp -p "$CONF2" "$BACKUP/https"
cp -p "$CONF_DOMAIN" "$BACKUP/domain"
docker inspect "$OLD" | python3 -c '
import json,sys
env=json.load(sys.stdin)[0]["Config"]["Env"]
with open(sys.argv[1],"w") as f:
 for entry in env:
  if "\n" in entry or "\r" in entry:raise SystemExit("MULTILINE_ENV_UNSUPPORTED")
  f.write(entry+"\n")
' "$ENV_FILE"
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
 if provider=='avalai' and not values.get('AVALAI_API_KEY','').strip():
  raise SystemExit('AVALAI_PROVIDER_SELECTED_BUT_PRIVATE_KEY_MISSING')
print('PRIVATE_FORZA_CONFIG_PRESENT desk='+values.get('FORZA_DESK_PROVIDER','unset')+
      ' voice='+values.get('FORZA_VOICE_PROVIDER','unset')+
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
echo '===== PRIVATE CANARY WITHOUT A HOST PORT ====='
CANARY_CID="$(docker run -d --name "$CANARY_NAME" --network "$NETWORK" --workdir /app \
 --cpus=1.5 --memory=3g --memory-swap=3g --env-file "$ENV_FILE" \
 -e PORT=3000 -e SANATPISH_SERVE_DIST=1 -e "SANATPISH_RELEASE_SHA=$EXPECTED" -e CATALOG_IMAGE_VOLUME_MIGRATE_ON_BOOT=false \
 "${MOUNTS[@]}" node:22-bookworm node --import tsx server.ts)"
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
    for (const surface of ["DESK", "VOICE"]) {
      const provider = process.env["FORZA_" + surface + "_PROVIDER"];
      if (provider !== "avalai") throw new Error(surface + "_PROVIDER_NOT_AVALAI");
    }
    if (!process.env.AVALAI_API_KEY?.trim()) throw new Error("AVALAI_API_KEY_NOT_EFFECTIVE");
    console.log("AVALAI_CANARY_CONFIG_OK desk=avalai voice=avalai key=SET");
  '
fi
docker exec -e "OLD_HOST=$OLD" "$CANARY_NAME" node ops/verify-single-port-canary.mjs

if [[ -f "$APP/.local-vision-enabled" ]]; then
 echo '===== WAIT FOR COMPLETE LOCAL IMAGE INDEX BEFORE PROMOTION ====='
 VISION_INDEX_READY=0
 for _ in $(seq 1 120); do
  if docker exec "$CANARY_NAME" node -e '
   fetch("http://127.0.0.1:3000/api/ai/local-vision-status",{signal:AbortSignal.timeout(5000)})
    .then(async r=>{const d=await r.json(); console.log("LOCAL_INDEX",d.indexed,"/",d.total); process.exit(r.ok&&d.enabled&&d.ready&&d.total>0?0:1)})
    .catch(()=>process.exit(1))'; then
   VISION_INDEX_READY=1
   break
  fi
  sleep 5
 done
 test "$VISION_INDEX_READY" = 1
fi

echo '===== PROMOTE ON SAME FIXED PORT (BRIEF RESTART) ====='
docker rm -f "$CANARY_NAME" >/dev/null
CANARY_CID=''
PROMOTING=1
docker stop -t 12 "$OLD" >/dev/null
CID="$(docker run -d --name "$NAME" --restart unless-stopped \
 --network "$NETWORK" --workdir /app --cpus=1.5 --memory=3g --memory-swap=3g \
 -p "127.0.0.1:$FIXED_PORT:3000" --env-file "$ENV_FILE" \
 -e PORT=3000 -e SANATPISH_SERVE_DIST=1 -e "SANATPISH_RELEASE_SHA=$EXPECTED" -e CATALOG_IMAGE_VOLUME_MIGRATE_ON_BOOT=false \
 "${MOUNTS[@]}" node:22-bookworm node --import tsx server.ts)"
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
contents=[Path(p).read_text() for p in files]
for filename,source in zip(files,contents):
 matches=pattern.findall(source)
 assert matches,("NO_APP_UPSTREAM",filename)
 assert len({m[1] for m in matches})==1,("MIXED_APP_UPSTREAMS",filename)
for filename,source in zip(files,contents):
 Path(filename).write_text(pattern.sub(lambda m:m.group(1)+target+m.group(3),source))
 print("SINGLE_PORT_NGINX_UPDATED",filename,target)
PY
nginx -t
systemctl reload nginx

echo '===== VERIFY PUBLIC HTTPS ====='
python3 - "$NEXT" <<'PY'
import sys,ssl,time,json,urllib.request
ctx=ssl._create_unverified_context()
port=sys.argv[1]
def get(url):
 with urllib.request.urlopen(url,timeout=25,context=ctx) as r:return r.read()
expected=get(f'http://127.0.0.1:{port}/')
for i in range(10):
 try:
  if get('https://127.0.0.1/')==expected:break
 except Exception:pass
 time.sleep(2)
else:raise AssertionError('HTTPS_BUILD_MISMATCH')
health=json.loads(get('https://127.0.0.1/api/health'))
assert health.get('status')=='ok' and health.get('database')=='ok'
# SPA fallback returns index.html with HTTP 200 for unknown API routes.
# Treat that as a deployment failure; Nginx rollback stays armed.
with urllib.request.urlopen('https://127.0.0.1/api/ai/forza-stt-info',timeout=15,context=ctx) as stt_response:
 content_type=stt_response.headers.get('content-type','').lower()
 assert 'application/json' in content_type, ('FORZA_STT_PUBLIC_API_RETURNED_HTML',content_type)
 stt_info=json.loads(stt_response.read())
assert isinstance(stt_info.get('serverSttConfigured'),bool), ('FORZA_STT_PUBLIC_BAD_CONTRACT',stt_info)
assert stt_info.get('serverSttProvider') in ('none','gemini'), ('FORZA_STT_PUBLIC_BAD_PROVIDER',stt_info)
print('PUBLIC_FORZA_STT_API_JSON_OK provider='+stt_info['serverSttProvider'])
print('PUBLIC_HTTPS_AND_DATABASE_OK')
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
echo 'SANATPISH_MAIN_BLUEGREEN_DEPLOY_OK'
echo 'SANATPISH_SINGLE_PORT_RELEASE_OK'
echo "RELEASE_SHA=$EXPECTED"
echo "NEW_CONTAINER=$NAME"
echo "NEW_PORT=$NEXT"
echo "PREVIOUS_CONTAINER=$OLD"
echo "PREVIOUS_PORT=$ACTIVE"
echo "HOST_APP_PORTS_TARGET=1"
echo "ROLLBACK_BACKUP=$BACKUP"
