#!/usr/bin/env bash
# Promote tested WebP and loading-priority build; preserve current 3005 production.
set -Eeuo pipefail
umask 077
STAGE=/opt/sanatpish-images
OLD=sanatpish-firstpaint-live-20261102233742-1079197
EXPECTED=daa34af00d2ea6d3b9fb71d0c3830f457e06c382
NAME="sanatpish-images-live-$(date +%Y%m%d%H%M%S)-$"
CONF1="$(readlink -f /etc/nginx/sites-enabled/default)"
CONF2="$(readlink -f /etc/nginx/sites-enabled/sanatpish-https.conf)"
BACKUP="/root/sanatpish-images-rollback-$(date +%Y%m%d-%H%M%S)-$"
ENV_FILE="$(mktemp /tmp/sanatpish-images-env.XXXXXXXX)"
CID=''
SWITCH_ATTEMPTED=0
DEPLOYED=0
cleanup(){
  local status=$?
  trap - EXIT
  if [[ "$DEPLOYED" != 1 ]];then
    if [[ "$SWITCH_ATTEMPTED" = 1 ]];then
      echo '===== ROLL BACK NGINX ====='
      cp -p "$BACKUP/default" "$CONF1"
      cp -p "$BACKUP/https" "$CONF2"
      if nginx -t && systemctl reload nginx;then
        echo 'NGINX_ROLLBACK_OK'
        [[ -z "$CID" ]] || docker rm -f "$CID" >/dev/null 2>&1 || true
      else
        echo 'CRITICAL_NGINX_ROLLBACK_FAILED_CANARY_LEFT_RUNNING' >&2
      fi
    elif [[ -n "$CID" ]];then
      docker rm -f "$CID" >/dev/null 2>&1 || true
    fi
    echo 'DEPLOY_FAILED_PREVIOUS_APP_PRESERVED'
  fi
  rm -f "$ENV_FILE"
  exit "$status"
}
trap cleanup EXIT
trap 'status=$?; echo "DEPLOY_FAILED_LINE=$LINENO STATUS=$status" >&2' ERR

echo '===== PREFLIGHT ====='
test "$(git -C "$STAGE" rev-parse HEAD)" = "$EXPECTED"
test -s "$STAGE/dist/index.html"
test -z "$(git -C "$STAGE" status --porcelain --untracked-files=no)"
test -f "$CONF1" && test -f "$CONF2"
test "$CONF1" != "$CONF2"
test "$(docker inspect "$OLD" --format '{{.State.Running}}')" = true
curl -fsS --max-time 15 http://127.0.0.1:3004/api/health;echo
curl -kfsS --max-time 15 https://127.0.0.1/api/health;echo
LISTENERS="$(ss -H -ltn)"
if [[ "$LISTENERS" =~ :3005[[:space:]] ]];then echo 'PORT_3005_BUSY';exit 1;fi

echo '===== CONFIG BACKUP ====='
mkdir -m 700 -p "$BACKUP"
cp -p "$CONF1" "$BACKUP/default"
cp -p "$CONF2" "$BACKUP/https"
python3 - "$CONF1" "$CONF2" <<'PY'
from pathlib import Path
import sys
for name in sys.argv[1:]:
 s=Path(name).read_text()
 assert 'proxy_pass http://127.0.0.1:3004;' in s,(name,'OLD_PROXY_NOT_FOUND')
 assert 'proxy_pass http://127.0.0.1:3005;' not in s,(name,'CANARY_ALREADY_SELECTED')
 assert 'proxy_pass http://127.0.0.1:3003;' not in s,(name,'STALE_PROXY')
 print('BACKED_UP',name)
PY

echo '===== REUSE VERIFIED RUNTIME SETTINGS ====='
docker inspect "$OLD" | python3 -c '
import json,sys
env=json.load(sys.stdin)[0]["Config"]["Env"]
with open(sys.argv[1],"w") as f:
 for entry in env:
  if "\n" in entry or "\r" in entry:raise SystemExit("MULTILINE_ENV_UNSUPPORTED")
  f.write(entry+"\n")
' "$ENV_FILE"
IMAGE="$(docker inspect "$OLD" --format '{{.Config.Image}}')"
NETWORK="$(docker inspect "$OLD" --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' | head -1)"
test -n "$NETWORK"
mapfile -d '' MOUNTS < <(
 docker inspect "$OLD" | python3 -c '
import json,sys
mounts=json.load(sys.stdin)[0]["Mounts"]
stage=sys.argv[1]
assert any(m["Destination"]=="/app" for m in mounts),"MISSING_APP_MOUNT"
for m in mounts:
 dest=m["Destination"]
 source=stage if dest=="/app" else m["Source"]
 mode="rw" if m["RW"] else "ro"
 for arg in ("-v",f"{source}:{dest}:{mode}"):
  sys.stdout.buffer.write(arg.encode()+b"\0")
' "$STAGE"
)
test ${#MOUNTS[@]} -ge 2

echo '===== START VERSION ON PORT 3005 ====='
CID="$(docker run -d --name "$NAME" --network "$NETWORK" --workdir /app \
 --cpus=1.0 --memory=2g --memory-swap=2g \
 -p 127.0.0.1:3005:3000 --env-file "$ENV_FILE" \
 -e PORT=3000 -e SANATPISH_SERVE_DIST=1 \
 -e CATALOG_IMAGE_VOLUME_MIGRATE_ON_BOOT=false \
 "${MOUNTS[@]}" "$IMAGE" node --import tsx server.ts)"
echo "NEW_CONTAINER=$NAME"
READY=0
for i in $(seq 1 65);do
 if curl -fsS --max-time 2 http://127.0.0.1:3005/api/health >/dev/null 2>&1;then
  READY=1
  echo "READY_AFTER_CHECK=$i"
  break
 fi
 if [[ "$(docker inspect "$CID" --format '{{.State.Running}}')" != true ]];then
  echo 'CANARY_EXITED'
  docker inspect "$CID" --format 'EXIT={{.State.ExitCode}} OOM={{.State.OOMKilled}}'
  exit 1
 fi
 sleep 1
done
test "$READY" = 1
test "$(docker inspect "$CID" --format '{{.State.OOMKilled}}')" = false

echo '===== VERIFY REAL DATA, ASSETS, WEBP AND IMAGE PARITY ====='
python3 - <<'PY'
import json,ssl,urllib.request,time,re
from pathlib import Path
from urllib.parse import quote
def get(url):
 with urllib.request.urlopen(url,timeout=60,context=ssl._create_unverified_context()) as response:
  return response.read()
def api(port,path):
 start=time.monotonic()
 raw=get(f'http://127.0.0.1:{port}{path}')
 return json.loads(raw),time.monotonic()-start,len(raw)
cats,ct,cb=api(3005,'/api/catalog/home-categories')
preview,pt,pb=api(3005,'/api/catalog/home-preview')
assert cats.get('success') and len(cats.get('categories',[]))>0
assert preview.get('success') and 0<len(preview.get('products',[]))<=12
allowed={'code','name','brand','categorySlug','categoryName','images'}
assert all(set(p)==allowed for p in preview['products'])
print('FAST_CATEGORIES',len(cats['categories']),round(ct,3),'s',cb,'bytes')
print('FAST_PREVIEW',len(preview['products']),round(pt,3),'s',pb,'bytes')
old,_,_=api(3004,'/api/runtime')
new,_,_=api(3005,'/api/runtime')
assert old.get('success') and new.get('success')
def identity(data):
 families=data['products']
 return ({p['code'] for p in families},
         {(p['code'],v['code']) for p in families for v in p.get('variants',[])})
original,updated=identity(old),identity(new)
assert original==updated,'CATALOG_IDENTITIES_NOT_EQUAL'
print('CATALOG_IDENTITIES_OK',len(updated[0]),len(updated[1]))
html=get('http://127.0.0.1:3005/')
m=re.search(rb'/assets/[^"]+\.js',html)
assert m,'FRONTEND_SCRIPT_NOT_FOUND'
src=m.group().decode()
assert len(get('http://127.0.0.1:3005'+src))>10000
print('FRONTEND_ASSET_OK',src)
# Hashed WebP files must exist in dist, be downloadable, and cache immutable.
assets=list(Path('/opt/sanatpish-images/dist/assets').glob('*.webp'))
assert len(assets)>=21, f'INSUFFICIENT_BUNDLED_WEBP_ASSETS={len(assets)}'
print('BUNDLED_WEBP_ASSETS',len(assets))
for base in ['brands_fullbleed_bg_','parts_warehouse_vault_','forza_swr_hero_banner_']:
 matches=[p for p in assets if base in p.name]
 assert matches, 'MISSING_BUNDLED_WEBP_'+base
 p=matches[0]
 request=urllib.request.Request('http://127.0.0.1:3005/assets/'+quote(p.name))
 with urllib.request.urlopen(request,timeout=45) as response:
  binary=response.read()
  cache=response.headers.get('Cache-Control','')
 assert binary==p.read_bytes(), 'WEBP_BINARY_MISMATCH_'+p.name
 assert 'immutable' in cache and 'max-age=31536000' in cache,'WEBP_CACHE_INVALID_'+p.name
 print('WEBP_PUBLIC_OK',p.name,len(binary),'bytes')

photo_count=sum(bool(p.get('images')) for p in preview['products'])
print('PREVIEW_PRODUCTS_WITH_PHOTOS',photo_count)
assert photo_count>0,'HOMEPAGE_PREVIEW_HAS_NO_LINKED_PRODUCT_IMAGES'
for p in preview['products']:
 paths=[x for x in p.get('images',[]) if isinstance(x,str) and x.startswith('/storage/products/')]
 if paths:
  url=urllib.parse.quote(paths[0],safe='/()')
  old_img=get('http://127.0.0.1:3004'+url)
  new_img=get('http://127.0.0.1:3005'+url)
  assert old_img==new_img and len(new_img)>50,'PRODUCT_IMAGE_DIFFERENCE'
  print('PRODUCT_IMAGE_PARITY_OK',len(new_img),'bytes')
  break
else:
 raise AssertionError('PRODUCT_IMAGE_SAMPLE_UNAVAILABLE')
PY

echo '===== SWITCH TWO NGINX CONFIGS ====='
SWITCH_ATTEMPTED=1
python3 - "$CONF1" "$CONF2" <<'PY'
from pathlib import Path
import sys
old='proxy_pass http://127.0.0.1:3004;'
new='proxy_pass http://127.0.0.1:3005;'
files=[Path(x) for x in sys.argv[1:]]
texts=[f.read_text() for f in files]
assert all(old in t for t in texts)
for f,t in zip(files,texts):
 f.write_text(t.replace(old,new))
 print('UPDATED_NGINX',f)
PY
nginx -t
systemctl reload nginx

echo '===== CHECK NEW PUBLIC HTTPS ====='
python3 - <<'PY'
import json,ssl,time,urllib.request
ctx=ssl._create_unverified_context()
def get(url):
 with urllib.request.urlopen(url,context=ctx,timeout=25) as response:return response.read()
expected=get('http://127.0.0.1:3005/')
matched=False
for _ in range(10):
 try:
  if get('https://127.0.0.1/')==expected:
   matched=True
   break
 except Exception:pass
 time.sleep(2)
assert matched,'PUBLIC_HTML_NOT_NEW_BUILD'
health=json.loads(get('https://127.0.0.1/api/health'))
assert health.get('status')=='ok' and health.get('database')=='ok'
for path,key in [('/api/catalog/home-categories','categories'),('/api/catalog/home-preview','products')]:
 data=json.loads(get('https://127.0.0.1'+path))
 assert data.get('success') and len(data.get(key,[]))>0,path
print('HTTPS_NEW_BUILD_AND_FAST_APIS_OK')
PY
test "$(docker inspect "$CID" --format '{{.State.Running}}')" = true
DEPLOYED=1
echo '===== SUCCESS ====='
echo 'HOME_IMAGES_BLUEGREEN_DEPLOY_OK'
echo "NEW_CONTAINER=$NAME"
echo 'NEW_PORT=3005'
echo 'PREVIOUS_CONTAINER=sanatpish-firstpaint-live-20261102233742-1079197'
echo 'PREVIOUS_PORT=3004'
echo 'OLDER_BACKUP_PORTS=3002,3001'
echo "NGINX_BACKUP=$BACKUP"
