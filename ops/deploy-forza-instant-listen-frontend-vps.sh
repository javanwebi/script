#!/usr/bin/env bash
# Frontend-only FORZA speaking-state fix. Keep Nginx and Express on port 3004.
set -Eeuo pipefail
umask 077
STAGE=/opt/sanatpish-forza-final
FIX_SHA=52a75642b1a2ef232c4e308dce420ff70d78c453
CONF1="$(readlink -f /etc/nginx/sites-enabled/default)"
CONF2="$(readlink -f /etc/nginx/sites-enabled/sanatpish-https.conf)"
LIVE=""
ACTIVE=""
PORT=""
for candidate in 3005 3004; do
  if grep -Fq "proxy_pass http://127.0.0.1:$candidate;" "$CONF1" &&
     grep -Fq "proxy_pass http://127.0.0.1:$candidate;" "$CONF2"; then
    PORT="$candidate"
    break
  fi
done
[[ "$PORT" = 3004 || "$PORT" = 3005 ]] || { echo UNSUPPORTED_ACTIVE_NGINX_PORT; exit 1; }
mapfile -t MATCHES < <(docker inspect $(docker ps -q) | python3 -c '
import json,sys
port=sys.argv[1]
for c in json.load(sys.stdin):
  if not c["State"]["Running"]:continue
  bindings=(c["NetworkSettings"]["Ports"] or {}).get("3000/tcp") or []
  if not any(b.get("HostPort")==port for b in bindings):continue
  volumes=[m["Source"] for m in c["Mounts"] if m["Destination"]=="/app"]
  if len(volumes)!=1:continue
  print(c["Name"].lstrip("/")+" "+volumes[0])
' "$PORT")
test "${#MATCHES[@]}" -eq 1 || { echo ACTIVE_CONTAINER_AMBIGUOUS; exit 1; }
read -r ACTIVE LIVE <<< "${MATCHES[0]}"
case "$LIVE" in
  /opt/sanatpish-firstpaint|/opt/sanatpish-images) ;;
  *) echo UNKNOWN_PRODUCTION_MOUNT; exit 1 ;;
esac
ROLLBACK="/root/forza-previous-index-$(date +%Y%m%d%H%M%S)-${BASHPID}.html"
NEW_INDEX="$LIVE/dist/index.html.forza-${BASHPID}.tmp"
echo "ACTIVE_PRODUCTION_PORT=$PORT"
echo "ACTIVE_PRODUCTION_CONTAINER=$ACTIVE"
echo "ACTIVE_PRODUCTION_SOURCE=$LIVE"
CUTOVER=0
DONE=0
rollback(){
  local status=$?
  trap - EXIT
  if [[ "$DONE" != 1 && "$CUTOVER" = 1 && -s "$ROLLBACK" ]];then
    echo '===== RESTORE PREVIOUS INDEX ====='
    cp -p "$ROLLBACK" "$NEW_INDEX"
    mv -f "$NEW_INDEX" "$LIVE/dist/index.html"
    echo 'FORZA_FRONTEND_ROLLBACK_APPLIED'
  fi
  if [[ "$DONE" != 1 ]];then
    echo 'FORZA_FRONTEND_DEPLOY_NOT_COMMITTED'
    echo 'NGINX_AND_EXPRESS_UNCHANGED'
  fi
  exit "$status"
}
trap rollback EXIT
trap 'code=$?; echo "FORZA_DEPLOY_ERROR_LINE=$LINENO CODE=$code" >&2' ERR

echo '===== VALIDATE CURRENT PRODUCTION ====='
git -C "$STAGE" merge-base --is-ancestor "$FIX_SHA" HEAD
test -s "$STAGE/dist/index.html"
test -d "$STAGE/dist/assets"
test -s "$LIVE/dist/index.html"
LIVE_SHA="$(git -C "$LIVE" rev-parse HEAD)"
case "$LIVE_SHA" in
  c6229740d5df96a0264bc40419792c8cccd1ca88|daa34af00d2ea6d3b9fb71d0c3830f457e06c382) ;;
  *) echo UNEXPECTED_PRODUCTION_VERSION; exit 1 ;;
esac
test "$(docker inspect "$ACTIVE" --format '{{.State.Running}}')" = true
test "$(docker inspect "$ACTIVE" --format '{{range .Mounts}}{{if eq .Destination "/app"}}{{.Source}}{{end}}{{end}}')" = "$LIVE"
curl -fsS --max-time 12 "http://127.0.0.1:$PORT/api/health";echo
curl -kfsS --max-time 12 https://127.0.0.1/api/health;echo

echo '===== VERIFY FORZA CLIENT BUILD ====='
python3 - "$STAGE/dist" <<'PY'
from pathlib import Path
import sys
root=Path(sys.argv[1])
chunks=list((root/'assets').glob('*AiForzaPage*.js'))
assert chunks,'FORZA_LAZY_CHUNK_MISSING'
assert any('فورزا در انتظار ادامه پاسخ' in p.read_text(errors='replace')
           for p in chunks),'FORZA_AUDIO_END_FIX_MISSING'
html=(root/'index.html').read_text()
assert '/assets/' in html,'NO_ASSET_ENTRY'
print('FORZA_PATCHED_CHUNK_OK',len(chunks))
PY

echo '===== PRESERVE OLD HTML AND ASSETS ====='
cp -p "$LIVE/dist/index.html" "$ROLLBACK"
cp -a "$STAGE/dist/assets/." "$LIVE/dist/assets/"

echo '===== VERIFY NEW BUNDLES SERVED BEFORE SWAP ====='
python3 - "$STAGE/dist/index.html" "$LIVE/dist" "$PORT" <<'PY'
from pathlib import Path
import re,sys,urllib.request
html=Path(sys.argv[1]).read_text()
root=Path(sys.argv[2])
paths=re.findall(r'(?:src|href)="(/assets/[^"]+)"',html)
assert paths,'NO_VERSIONED_ASSETS'
for path in paths:
 asset=root/path.lstrip('/')
 assert asset.is_file() and asset.stat().st_size>0,f'BUNDLE_MISSING {path}'
 with urllib.request.urlopen('http://127.0.0.1:'+sys.argv[3]+path,timeout=20) as response:
  assert response.status==200 and len(response.read())>0,f'BUNDLE_NOT_SERVED {path}'
print('NEW_BUNDLES_READY',len(paths))
PY

echo '===== ATOMIC HTML ENTRY SWAP ====='
cp -p "$STAGE/dist/index.html" "$NEW_INDEX"
CUTOVER=1
mv -f "$NEW_INDEX" "$LIVE/dist/index.html"

echo '===== CHECK LIVE HTTPS AND DATABASE ====='
python3 - "$STAGE/dist/index.html" <<'PY'
from pathlib import Path
import sys,ssl,urllib.request,json
expected=Path(sys.argv[1]).read_bytes()
ctx=ssl._create_unverified_context()
def get(path):
 with urllib.request.urlopen('https://127.0.0.1'+path,context=ctx,timeout=30) as response:
  return response.read()
assert get('/')==expected,'HTML_ENTRY_NOT_UPDATED'
health=json.loads(get('/api/health'))
assert health.get('status')=='ok' and health.get('database')=='ok','HEALTH_FAILED'
for path,key in [('/api/catalog/home-preview','products'),('/api/catalog/home-categories','categories')]:
 data=json.loads(get(path))
 assert data.get('success') and len(data.get(key,[]))>0,path
print('FORZA_PATCHED_HTTPS_AND_CATALOG_OK')
PY
test "$(docker inspect "$ACTIVE" --format '{{.State.Running}}')" = true
DONE=1
echo 'FORZA_INSTANT_LISTEN_DEPLOY_OK'
echo "PRIOR_INDEX_BACKUP=$ROLLBACK"
echo "NGINX_AND_EXPRESS_UNCHANGED_PORT=$PORT"
