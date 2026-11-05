#!/usr/bin/env bash
# New Sanat Pish VPS 87.107.9.114. Safe release canary with Nginx rollback.
# No database migration, SSL replacement, or modification of existing containers.
set -Eeuo pipefail
umask 077
export GIT_TERMINAL_PROMPT=0

[[ "$EUID" == 0 ]] || { echo RUN_AS_ROOT; exit 1; }
[[ " $(hostname -I) " == *" 87.107.9.114 "* ]] || { echo WRONG_SERVER; exit 1; }
for cmd in git docker nginx python3 curl ss flock; do
 command -v "$cmd" >/dev/null || { echo "MISSING_COMMAND=$cmd"; exit 1; }
done

SSL=/etc/nginx/conf.d/sanatpish-hostino-https.conf
HTTP=/etc/nginx/conf.d/sanatpish-domain-http.conf
IP=/etc/nginx/conf.d/sanatpish-new-ip.conf
for p in "$SSL" "$HTTP" "$IP"; do
 test -f "$p" || { echo "MISSING_CONFIG=$p"; exit 1; }
 grep -q 'limit_except GET' "$p" || { echo "READ_ONLY_GUARD_MISSING=$p"; exit 1; }
done
nginx -t
exec 9>/run/lock/sanatpish-new-vps-deploy.lock
flock -n 9 || { echo DEPLOY_ALREADY_RUNNING; exit 1; }

ACTIVE=$(python3 - "$SSL" "$HTTP" "$IP" <<'PY'
from pathlib import Path
import re,sys
ports=[]
for file in sys.argv[1:]:
 matches=re.findall(r'proxy_pass\s+http://127\.0\.0\.1:(30\d{2});',Path(file).read_text())
 if len(matches)!=1:raise SystemExit('UNEXPECTED_UPSTREAM '+file+' '+str(matches))
 ports.append(matches[0])
if len(set(ports))!=1:raise SystemExit('UPSTREAMS_DIFFER '+str(ports))
print(ports[0])
PY
)
echo "ACTIVE_PORT=$ACTIVE"

OLD=''
while read -r name; do
 if docker port "$name" 3000/tcp 2>/dev/null | grep -Fxq "127.0.0.1:$ACTIVE"; then
  OLD="$name";break
 fi
done < <(docker ps --format '{{.Names}}')
test -n "$OLD" || { echo LIVE_CONTAINER_NOT_FOUND; exit 1; }
curl --noproxy '*' -fsS --max-time 15 "http://127.0.0.1:$ACTIVE/api/health" | grep -q '"database":"ok"'
echo "PREVIOUS_CONTAINER=$OLD"

NEXT=''
for port in $(seq 3010 3030); do
 if ! ss -H -lnt "( sport = :$port )" | grep -q .; then NEXT="$port";break; fi
done
test -n "$NEXT" || { echo NO_FREE_PORT; exit 1; }

STAMP=$(date +%Y%m%d-%H%M%S)-$$
STAGE=/opt/sanatpish-release-$STAMP
NAME=sanatpish-new-release-$STAMP
BACKUP=/root/sanatpish-nginx-backup-$STAMP
TMP=$(mktemp -d /root/sanatpish-deploy-XXXXXXXX)
SWITCHED=0
SUCCESS=0
STARTED=0
cleanup(){
 rc=$?
 trap - EXIT
 set +e
 if [[ "$SUCCESS" != 1 ]]; then
  echo "DEPLOY_FAILED_STATUS=$rc"
  RESTORED=1
  if [[ "$SWITCHED" == 1 ]]; then
   cp -p "$BACKUP/ssl" "$SSL"
   cp -p "$BACKUP/http" "$HTTP"
   cp -p "$BACKUP/ip" "$IP"
   if nginx -t && systemctl reload nginx; then
    echo NGINX_ROLLBACK_OK
   else
    RESTORED=0
    echo CRITICAL_ROLLBACK_ERROR_CANARY_RETAINED
   fi
  fi
  if [[ "$STARTED" == 1 && "$RESTORED" == 1 ]]; then
   docker rm -f "$NAME" >/dev/null 2>&1 || true
  fi
  echo ORIGINAL_CONTAINER_UNCHANGED
 fi
 rm -rf "$TMP"
 exit "$rc"
}
trap cleanup EXIT

echo '===== FETCH MAIN ====='
git clone --depth 1 --filter=blob:none --branch main --single-branch \
 https://github.com/javanwebi/script.git "$STAGE"
SHA=$(git -C "$STAGE" rev-parse HEAD)
echo "RELEASE_SHA=$SHA"
grep -Fq 'displayProducts.map(product' "$STAGE/src/components/home/HighUtilityProductsSection.tsx" \
 || { echo HOME_LAYOUT_FIX_NOT_PRESENT;exit 1; }

docker inspect "$OLD" > "$TMP/inspect.json"
python3 - "$TMP/inspect.json" "$TMP/env" "$TMP/mounts" <<'PY'
import json,os,sys
data=json.load(open(sys.argv[1]))[0]
envfile,mountfile=sys.argv[2:]
with open(envfile,'w') as out:
 for item in data['Config']['Env']:
  if '\n' in item or '\r' in item:raise SystemExit('UNSUPPORTED_MULTILINE_ENV')
  out.write(item+'\n')
mounts=data['Mounts']
if not any(m['Destination']=='/app' for m in mounts):raise SystemExit('ORIGINAL_APP_MOUNT_MISSING')
with open(mountfile,'wb') as out:
 for m in mounts:
  if m['Destination']=='/app':continue
  if m['Type']!='bind' or not os.path.exists(m['Source']):raise SystemExit('UNSUPPORTED_MOUNT '+m['Destination'])
  for item in ['-v',m['Source']+':'+m['Destination']+(':rw' if m['RW'] else ':ro')]:
   out.write(item.encode()+b'\0')
PY
mapfile -d '' -t MOUNTS < "$TMP/mounts"
NETWORK=$(docker inspect "$OLD" --format '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' | head -1)
test -n "$NETWORK"

echo '===== ISOLATED BUILD AND TEST ====='
docker image inspect node:22-bookworm >/dev/null 2>&1 || docker pull node:22-bookworm
docker run --rm --pull=never --network "$NETWORK" --cpus=4 --memory=6g \
 -v "$STAGE:/app:rw" -w /app node:22-bookworm sh -ec \
 'npm ci --include=dev --no-audit --no-fund && npm run lint && node --import tsx --test tests/home-fast-preview.test.ts && npm run build'
test -s "$STAGE/dist/index.html"

echo "===== START CANDIDATE ON $NEXT ====="
docker run -d --name "$NAME" --restart unless-stopped \
 --network "$NETWORK" -w /app --cpus=3 --memory=5g \
 -p "127.0.0.1:$NEXT:3000" --env-file "$TMP/env" \
 -e PORT=3000 -e SANATPISH_SERVE_DIST=1 \
 -e "SANATPISH_RELEASE_SHA=$SHA" -e CATALOG_IMAGE_VOLUME_MIGRATE_ON_BOOT=false \
 -v "$STAGE:/app:rw" "${MOUNTS[@]}" node:22-bookworm node --import tsx server.ts >/dev/null
STARTED=1
READY=0
for i in $(seq 1 60); do
 if curl --noproxy '*' -fsS --max-time 3 "http://127.0.0.1:$NEXT/api/health" 2>/dev/null | grep -q '"database":"ok"'; then
  READY=1;break
 fi
 if [[ $(docker inspect "$NAME" --format '{{.State.Running}}') != true ]]; then break;fi
 sleep 2
done
if [[ "$READY" != 1 ]];then docker logs --tail 50 "$NAME";exit 1;fi
curl --noproxy '*' --globoff -fsS --max-time 15 \
 "http://127.0.0.1:$NEXT/storage/products/catalog/e(1).png" -o "$TMP/image.png"
python3 - "$TMP/image.png" <<'PY'
from pathlib import Path
import sys
assert Path(sys.argv[1]).read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
PY
curl --noproxy '*' -fsS --max-time 15 "http://127.0.0.1:$NEXT/" -o "$TMP/index.html"
grep -Eiq '<html|<!doctype html' "$TMP/index.html" || { echo NOT_HTML;exit 1; }
echo 'CANARY_TESTS_PASSED'

echo '===== BACKUP AND SWITCH NGINX ====='
mkdir -m 700 "$BACKUP"
cp -p "$SSL" "$BACKUP/ssl"
cp -p "$HTTP" "$BACKUP/http"
cp -p "$IP" "$BACKUP/ip"
SWITCHED=1
python3 - "$ACTIVE" "$NEXT" "$SSL" "$HTTP" "$IP" <<'PY'
from pathlib import Path
import sys
old,new,*files=sys.argv[1:]
needle=f'proxy_pass http://127.0.0.1:{old};'
replacement=f'proxy_pass http://127.0.0.1:{new};'
texts={p:Path(p).read_text() for p in files}
if any(text.count(needle)!=1 for text in texts.values()):raise SystemExit('NGINX_PRECONDITION_CHANGED')
for p,text in texts.items():Path(p).write_text(text.replace(needle,replacement))
PY
nginx -t
systemctl reload nginx
sleep 2

for domain in sanatpish.com www.sanatpish.com;do
 curl --noproxy '*' -fsS --max-time 15 \
  --resolve "$domain:443:127.0.0.1" "https://$domain/api/health" | grep -q '"database":"ok"'
 echo "HTTPS_OK=$domain"
done
curl --noproxy '*' -fsS --max-time 15 \
 --resolve sanatpish.com:443:127.0.0.1 \
 https://sanatpish.com/ -o "$TMP/public.html"
cmp -s "$TMP/index.html" "$TMP/public.html" || { echo PUBLIC_HTML_DIFFERENT;exit 1; }

SUCCESS=1
echo '===== SANATPISH_NEW_VPS_DEPLOY_OK ====='
echo "RELEASE_SHA=$SHA"
echo "ACTIVE_PORT=$NEXT"
echo "ACTIVE_CONTAINER=$NAME"
echo "PREVIOUS_CONTAINER=$OLD"
echo "ROLLBACK_NGINX_FILES=$BACKUP"
echo 'HOSTINO_SSL=UNCHANGED'
echo 'DATABASE=UNCHANGED'
echo 'FORZA=UNCHANGED'
echo 'WRITE_RESTRICTIONS=UNCHANGED'