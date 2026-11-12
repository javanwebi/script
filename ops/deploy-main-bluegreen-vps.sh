#!/usr/bin/env bash
# Blue/green deployment: optimized homepage + camera, with Nginx rollback.
# Do NOT run directly without SANATPISH_RELEASE_SHA set to a pinned release commit.
set -Eeuo pipefail
umask 077
export GIT_TERMINAL_PROMPT=0
APP=/opt/sanatpish
EXPECTED="$SANATPISH_RELEASE_SHA"
[[ "$EXPECTED" =~ ^[a-f0-9]{40}$ ]] || { echo "INVALID_RELEASE_SHA"; exit 1; }
# Mandatory single-port dispatcher. The older rotating-port implementation
# below is retained only for reference; it is intentionally unreachable.
# The installed /usr/local/sbin/sanatpish-deploy-main wrapper remains usable.
SINGLE_TMP="$(mktemp /tmp/sanatpish-single-port.XXXXXXXX.sh)"
trap 'rm -f -- "$SINGLE_TMP"' EXIT
git -C "$APP" show "$EXPECTED:ops/deploy-single-port-vps.sh" > "$SINGLE_TMP"
bash -n "$SINGLE_TMP"
echo "===== SINGLE-PUBLISHED-APP-PORT DEPLOY ====="
bash "$SINGLE_TMP"
exit 0

exec 9>/run/lock/sanatpish-main-release.lock
flock -w 15 9 || { echo "DEPLOY_LOCK_BUSY"; exit 1; }
test "$(git -C "$APP" remote get-url origin)" = https://github.com/javanwebi/script.git
test "$(git -C "$APP" cat-file -t "$EXPECTED")" = commit

CONF1="$(readlink -f /etc/nginx/sites-enabled/default)"
CONF2="$(readlink -f /etc/nginx/sites-enabled/sanatpish-https.conf)"
# The public .com domain has a separate virtual host from the IP/default ones.
CONF_DOMAIN="$(readlink -f /etc/nginx/sites-enabled/sanatpish-domain-20261103.conf)"
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
curl --noproxy '*' -fsS --max-time 12 "http://127.0.0.1:$ACTIVE/api/health" | grep -q '"database":"ok"'
curl --noproxy '*' -kfsS --max-time 12 'https://127.0.0.1/api/health' | grep -q '"database":"ok"'
OLD=''
for c in $(docker ps --format '{{.Names}}'); do
 if docker port "$c" 3000/tcp 2>/dev/null | grep -Fxq "127.0.0.1:$ACTIVE"; then OLD="$c"; break; fi
done
test -n "$OLD"
echo "ACTIVE_CONTAINER=$OLD"

NEXT=''
# Persistent blue/green deployments leave earlier containers on old ports.
# Prefer fresh canary ports without interrupting the currently active site.
for p in 3006 3007 3008 3009 3010 3011 3012 3013 3014 3015 3016 3017 3018 3019 3020; do
 if test "$p" != "$ACTIVE" && ! ss -H -ltn "( sport = :$p )" | grep -q .; then NEXT="$p"; break; fi
done
if test -z "$NEXT"; then
  echo "NO_FREE_BLUEGREEN_PORT_IN_3006_3020" >&2
  echo "===== RUNNING PORT MAPPINGS ====="
  docker ps --format 'table {{.Names}}\t{{.Ports}}'
  exit 1
fi
echo "CANARY_PORT=$NEXT"

STAMP="$(date +%Y%m%d-%H%M%S)-$BASHPID"
STAGE="/opt/sanatpish-unified-stage-$STAMP"
NAME="sanatpish-unified-live-$STAMP"
BACKUP="/root/sanatpish-main-rollback-$STAMP"
ENV_FILE="$(mktemp /tmp/sanatpish-camera-env.XXXXXXXX)"
CID=''
SWITCH=0
SUCCESS=0

cleanup(){
 status=$?
 trap - EXIT
 set +e
 if test "$SUCCESS" != 1; then
   if test "$SWITCH" = 1; then
     echo '===== ROLLBACK NGINX ====='
     cp -p "$BACKUP/default" "$CONF1"
     cp -p "$BACKUP/https" "$CONF2"
      cp -p "$BACKUP/domain" "$CONF_DOMAIN"
     if nginx -t && systemctl reload nginx; then
       echo NGINX_ROLLBACK_OK
     else
       echo CRITICAL_NGINX_ROLLBACK_FAILED
       CID=''
     fi
   fi
   if test -n "$CID"; then docker rm -f "$CID" >/dev/null 2>&1 || true; fi
   if [[ "$STAGE" == /opt/sanatpish-unified-stage-* ]]; then rm -rf -- "$STAGE"; fi
   echo DEPLOY_FAILED_PREVIOUS_SITE_PRESERVED
 fi
 rm -f -- "$ENV_FILE"
 exit "$status"
}
trap cleanup EXIT
trap 'echo "DEPLOY_FAILED_AT_LINE=$LINENO" >&2' ERR

echo '===== BUILD CANDIDATE IN ISOLATION ====='
mkdir -m 700 "$STAGE"
git -C "$APP" archive "$EXPECTED" | tar -xf - -C "$STAGE"
test -s "$STAGE/package-lock.json"
sed -i 's#https://registry.npmjs.org/#https://registry.npmmirror.com/#g' "$STAGE/package-lock.json"
NETWORK="$(docker inspect "$OLD" --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' | head -1)"
test -n "$NETWORK"
docker image inspect node:22-bookworm >/dev/null
docker run --rm --pull=never --network "$NETWORK" --cpus=1.5 --memory=3g --memory-swap=3g \
 --mount "type=bind,source=$STAGE,target=/app" -w /app \
 -e npm_config_registry=https://registry.npmmirror.com \
 -e npm_config_maxsockets=2 \
 -e npm_config_fetch_retries=5 \
 node:22-bookworm sh -ec 'npm ci --include=dev --no-audit --no-fund && npm run lint && node --import tsx --test tests/mobile-scan-ui.test.ts tests/forza-mobile-contact-sheet.test.ts && npm run build'
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
echo '===== APPLY REVIEWED FAMILY MENU ASSIGNMENTS ====='
# This snapshot contains 832 curated family-to-Excel-category mappings.
# It is additive and idempotent: existing admin-verified assignments win.
# SQL owns its transaction; any FK/validation error rolls back the whole seed.
docker exec -i "$OLD" node --import tsx --input-type=module -e '
 import {readFileSync} from "node:fs";
 import {database,closeDatabase} from "./server/db/connection.ts";
 try {
  const sql=readFileSync(0,"utf8");
  await database().query(sql);
  const result=await database().query(
   "select count(*)::int as total, " +
   "count(*) filter(where method=\x27admin_verified\x27)::int as admin_verified " +
   "from public.catalog_family_menu_assignments");
  const total=Number(result.rows[0].total);
  if(total<832)throw Error("Expected at least 832 curated family assignments, found "+total);
  console.log("PRODUCTION_FAMILY_MENU_ASSIGNMENTS_VERIFIED",total,
    "admin_verified="+result.rows[0].admin_verified);
 }catch(error){
  console.error("PRODUCTION_FAMILY_MENU_ASSIGNMENTS_FAILED",error.code||"",error.message);
  process.exitCode=1;
 }finally{await closeDatabase()}
' < "$STAGE/ops/sql/20261101_catalog_family_menu_assignments.sql"
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
import json,sys
mounts=json.load(sys.stdin)[0]["Mounts"]
stage=sys.argv[1]
assert any(m["Destination"]=="/app" for m in mounts)
for m in mounts:
 dest=m["Destination"]
 source=stage if dest=="/app" else m["Source"]
 mode="rw" if m["RW"] else "ro"
 for arg in ("-v",f"{source}:{dest}:{mode}"):
  sys.stdout.buffer.write(arg.encode()+b"\0")
' "$STAGE"
)
test "${#MOUNTS[@]}" -ge 2
# Preserve optional private SMS credentials if an earlier canary lacked that mount.
if [[ -f "$APP/.env.sms" ]] &&
   ! docker inspect "$OLD" --format '{{range .Mounts}}{{println .Destination}}{{end}}' | grep -Fxq '/app/.env.sms'; then
  MOUNTS+=(-v "$APP/.env.sms:/app/.env.sms:ro")
fi
echo '===== START NEW CANARY ====='
CID="$(docker run -d --name "$NAME" --network "$NETWORK" --workdir /app \
 --cpus=1.5 --memory=3g --memory-swap=3g \
 -p "127.0.0.1:$NEXT:3000" --env-file "$ENV_FILE" \
 -e PORT=3000 -e SANATPISH_SERVE_DIST=1 \
 -e CATALOG_IMAGE_VOLUME_MIGRATE_ON_BOOT=false \
 "${MOUNTS[@]}" node:22-bookworm node --import tsx server.ts)"
READY=0
for i in $(seq 1 65); do
 if curl --noproxy '*' -fsS --max-time 3 "http://127.0.0.1:$NEXT/api/health" 2>/dev/null | grep -q '"database":"ok"'; then
   READY=1
   echo "CANARY_HEALTHY_AFTER_CHECK=$i"
   break
 fi
 if test "$(docker inspect "$CID" --format '{{.State.Running}}')" != true; then
   docker logs --tail 50 "$CID" || true
   echo CANARY_EXITED
   exit 1
 fi
 sleep 1
done
test "$READY" = 1
test "$(docker inspect "$CID" --format '{{.State.OOMKilled}}')" = false

echo '===== VERIFY FORZA STT JSON API BEFORE TRAFFIC SWITCH ====='
python3 - "$NEXT" <<'PY'
import json,sys,urllib.request
port=sys.argv[1]
url=f'http://127.0.0.1:{port}/api/ai/forza-stt-info'
with urllib.request.urlopen(url,timeout=15) as response:
 content_type=response.headers.get('content-type','').lower()
 assert 'application/json' in content_type, ('FORZA_STT_RETURNED_HTML_IN_CANARY',content_type)
 info=json.loads(response.read())
assert isinstance(info.get('serverSttConfigured'),bool), ('FORZA_STT_BAD_CONTRACT',info)
assert info.get('serverSttProvider') in ('none','gemini'), ('FORZA_STT_BAD_PROVIDER',info)
assert isinstance(info.get('reason'),str), ('FORZA_STT_MISSING_REASON',info)
print('FORZA_STT_CANARY_API_JSON_OK provider='+info['serverSttProvider'])
PY

echo '===== CATALOG AND CAMERA CANARY CHECKS ====='
python3 - "$ACTIVE" "$NEXT" "$STAGE" <<'PY'
import sys,json,urllib.request,re
from pathlib import Path
old,new,stage=sys.argv[1],sys.argv[2],Path(sys.argv[3])
def get(port,path):
 with urllib.request.urlopen(f'http://127.0.0.1:{port}{path}',timeout=70) as r:
  return r.read()
menu=json.loads(get(new,'/api/catalog/navigation-groups'))
approved=sorted((g for g in menu.get('groups',[]) if g.get('active',True) and re.fullmatch(r'excel-v2-[0-9]+',g.get('id',''))),key=lambda g:g.get('sortOrder',0))
assert menu.get('success') and len(approved)>=6,('MISSING_APPROVED_GROUPS',len(approved))
print('APPROVED_HOME_GROUPS_OK',[g['title'] for g in approved[:6]])
for path,key in [('/api/catalog/home-categories','categories'),('/api/catalog/home-preview','products')]:
 x=json.loads(get(new,path))
 assert x.get('success') and x.get(key),('EMPTY_PUBLIC_PROJECTION',path)
 print('FAST_API_OK',path,len(x[key]))
def catalog(port):
 data=json.loads(get(port,'/api/runtime'))
 assert data.get('success')
 p=data.get('products',[])
 return {x['code'] for x in p},{(x['code'],v['code']) for x in p for v in x.get('variants',[])}
a,b=catalog(old),catalog(new)
assert a==b,('CATALOG_PARITY_FAILED',len(a[0]),len(b[0]),len(a[1]),len(b[1]))
print('CATALOG_PARITY_OK',len(a[0]),len(a[1]))
html=get(new,'/')
m=re.search(rb'/assets/[^"]+\.js',html)
assert m and len(get(new,m.group().decode()))>10000
for asset in ('images/scan-industrial-generated.webp','images/precision-scan-technical-overlay.svg'):
 assert get(new,'/'+asset)==(stage/'dist'/asset).read_bytes(),asset
print('CAMERA_IMAGE_ASSETS_OK')
PY
CAMERAJS="$(grep -RlF 'full-screen-camera-experience' "$STAGE/dist/assets" --include='*.js' | head -1)"
curl --noproxy '*' -fsS --max-time 35 "http://127.0.0.1:$NEXT/assets/$(basename "$CAMERAJS")" \
 -o /tmp/sanatpish-fullscreen-camera-canary.js
grep -qF 'full-screen-camera-experience' /tmp/sanatpish-fullscreen-camera-canary.js
grep -qF 'عکس‌برداری مجدد' /tmp/sanatpish-fullscreen-camera-canary.js
PROGRESSJS="$(grep -RlF 'vision-analyzing-screen' "$STAGE/dist/assets" --include='*.js' | head -1)"
curl --noproxy '*' -fsS --max-time 35 "http://127.0.0.1:$NEXT/assets/$(basename "$PROGRESSJS")"  -o /tmp/sanatpish-vision-redesign-canary.js
grep -qF 'vision-analyzing-screen' /tmp/sanatpish-vision-redesign-canary.js
echo VISION_REDESIGN_CANARY_OK
FORZAJS="$(grep -RlF 'forza-mobile-contact-sheet' "$STAGE/dist/assets" --include='*.js' | head -1)"
curl --noproxy '*' -fsS --max-time 35 "http://127.0.0.1:$NEXT/assets/$(basename "$FORZAJS")"  -o /tmp/sanatpish-forza-contact-canary.js
grep -qF 'forza-mobile-contact-sheet' /tmp/sanatpish-forza-contact-canary.js
grep -qF 'forza-swipe-instruction' /tmp/sanatpish-forza-contact-canary.js
echo FORZA_CONTACT_CANARY_OK
echo CAMERA_CANARY_OK

echo '===== ATOMIC NGINX TRAFFIC SWITCH ====='
SWITCH=1
python3 - "$CONF1" "$CONF2" "$CONF_DOMAIN" "$ACTIVE" "$NEXT" "$DOMAIN_ACTIVE" <<'PY'
from pathlib import Path
import re,sys
a,b,domain,old,new,domain_old=sys.argv[1:]
paths=[Path(a),Path(b),Path(domain)]
expected=[old,old,domain_old]
pattern=re.compile(r'(proxy_pass\s+http://127\.0\.0\.1:)(30(?:0[4-9]|1[0-9]|20))(;)')
contents=[p.read_text() for p in paths]
for p,before,port in zip(paths,contents,expected):
 matches=pattern.findall(before)
 assert matches and {match[1] for match in matches}=={port},('UNEXPECTED_PROXY_TARGET',str(p),matches,port)
 assert new not in {match[1] for match in matches},('TARGET_ALREADY_SELECTED',str(p))
# Prevalidate all three files before writing any. The rollback trap restores
# all vhosts if the config, HTTP checks, or private voice promotion fails.
for p,before in zip(paths,contents):
 p.write_text(pattern.sub(lambda m:m.group(1)+new+m.group(3),before))
 print('UPDATED_NGINX',p)
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
SUCCESS=1
echo 'SANATPISH_MAIN_BLUEGREEN_DEPLOY_OK'
echo "RELEASE_SHA=$EXPECTED"
echo "NEW_CONTAINER=$NAME"
echo "NEW_PORT=$NEXT"
echo "PREVIOUS_CONTAINER=$OLD"
echo "PREVIOUS_PORT=$ACTIVE"
echo "ROLLBACK_BACKUP=$BACKUP"
