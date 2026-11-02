#!/usr/bin/env bash
# Read-only routing test of an isolated Express+Vite canary. Never edits Nginx.
set -Eeuo pipefail
umask 077
SRC=sanatpish-hotfix-live
STAGE=/opt/sanatpish-firstpaint
EXPECTED=c6229740d5df96a0264bc40419792c8cccd1ca88
NAME="sanatpish-firstpaint-diag-$$"
ENV_FILE="$(mktemp /tmp/sp-firstpaint.XXXXXXXX)"
CID=''
READY=0
cleanup(){
 local status=$?
 trap - EXIT
 if [[ -n "$CID" ]]; then
  docker rm -f "$CID" >/dev/null 2>&1 || true
 fi
 rm -f "$ENV_FILE"
 if ((status != 0)); then
  echo 'FIRSTPAINT_CANARY_FAILED'
  echo 'PRODUCTION_UNCHANGED'
 fi
 exit "$status"
}
trap cleanup EXIT
echo '===== PRECHECK HEALTH AND REPO ====='
test "$(git -C "$STAGE" rev-parse HEAD)" = "$EXPECTED"
test -s "$STAGE/dist/index.html"
curl -fsS --max-time 12 http://127.0.0.1:3002/api/health;echo
test "$(docker inspect "$SRC" --format '{{.State.Running}}')" = true
nginx -T 2>/dev/null | grep -Fq 'proxy_pass http://127.0.0.1:3002;'
if ss -ltn | grep -Eq '(:3004)[[:space:]]';then echo PORT_3004_IN_USE;exit 1;fi
echo '===== PREPARE ISOLATED RUNTIME ENV ====='
docker inspect "$SRC" | python3 -c '
import json,sys
env=json.load(sys.stdin)[0]["Config"]["Env"]
with open(sys.argv[1],"w") as f:
 for item in env:
  if "\n" in item or "\r" in item:raise SystemExit("MULTILINE_ENV_UNSUPPORTED")
  f.write(item+"\n")
' "$ENV_FILE"
IMAGE="$(docker inspect "$SRC" --format '{{.Config.Image}}')"
NETWORK="$(docker inspect "$SRC" --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' | head -1)"
test -n "$NETWORK"
mapfile -d '' MOUNTS < <(
 docker inspect "$SRC" | python3 -c '
import json,sys
mounts=json.load(sys.stdin)[0]["Mounts"]
stage=sys.argv[1]
found=False
for m in mounts:
  dest=m["Destination"]
  if dest=="/app":found=True
  src=stage if dest=="/app" else m["Source"]
  mode="rw" if m["RW"] else "ro"
  for arg in ("-v",f"{src}:{dest}:{mode}"):
    sys.stdout.buffer.write(arg.encode()+b"\0")
if not found:raise SystemExit("MISSING_APP_MOUNT")
' "$STAGE"
)
echo '===== START CANARY 3004 (NO NGINX CHANGE) ====='
CID="$(docker run -d --name "$NAME" --network "$NETWORK" \
 --cpus=1.0 --memory=2g --memory-swap=2g \
 -p 127.0.0.1:3004:3000 \
 --env-file "$ENV_FILE" -e PORT=3000 \
 -e SANATPISH_SERVE_DIST=1 \
 -e CATALOG_IMAGE_VOLUME_MIGRATE_ON_BOOT=false \
 "${MOUNTS[@]}" "$IMAGE" node --import tsx server.ts)"
echo "CANARY_ID=${CID:0:12}"
echo '===== WAIT FOR EXPRESS HEALTH ====='
for i in $(seq 1 60);do
 if curl -fsS --max-time 2 http://127.0.0.1:3004/api/health >/dev/null 2>&1;then
  READY=1
  echo "CANARY_HEALTHY_AFTER_CHECK=$i"
  break
 fi
 if [[ "$(docker inspect "$CID" --format '{{.State.Running}}')" = false ]];then
  echo "CANARY_EXITED_AFTER_CHECK=$i"
  break
 fi
 sleep 1
done
echo '===== CANARY STATE ====='
docker inspect "$CID" --format 'STATUS={{.State.Status}} EXIT={{.State.ExitCode}} OOM={{.State.OOMKilled}} ERROR={{.State.Error}}'
echo '===== SAFE CANARY LOG TAIL ====='
docker logs --tail 80 "$CID" 2>&1 | python3 -c '
import re,sys
s=sys.stdin.read()
s=re.sub(r"(?i)(postgres(?:ql)?|redis|mysql|mongodb(?:\\+srv)?)://[^\s\"\x27<>]+",r"\\1://[REDACTED]",s)
s=re.sub(r"(?i)(?:password|api_key|secret|token|database_url)\s*[:=]\s*[^\s,;]+","[REDACTED]",s)
s=re.sub(r"sk-[A-Za-z0-9_-]{10,}","sk-[REDACTED]",s)
print(s[-12000:])
'
if [[ "$READY" != 1 ]];then
 echo 'CANARY_NOT_READY_INSPECT_LOGS_ABOVE'
 exit 1
fi
echo '===== COMPARE BOTH CATALOGUE ROUTES ====='
python3 - <<'PY'
import json,time,urllib.request
def fetch(port,path):
 started=time.monotonic()
 with urllib.request.urlopen(f"http://127.0.0.1:{port}{path}",timeout=55) as res:
  data=res.read()
 return json.loads(data),round(time.monotonic()-started,3),len(data)
for port,path in [(3004,"/api/catalog/home-categories"),(3004,"/api/catalog/home-preview"),
                  (3002,"/api/catalog/categories")]:
 data,elapsed,length=fetch(port,path)
 key="products" if path.endswith("home-preview") else "categories"
 arr=data.get(key,[])
 assert data.get("success") is True and isinstance(arr,list) and len(arr)>0,(port,path,data.get("success"))
 print(f"PORT={port} ROUTE={path} TIME={elapsed}s BYTES={length} COUNT={len(arr)}")
 if path.endswith("home-preview"):
  allowed={"code","name","brand","categorySlug","categoryName","images"}
  assert all(set(p.keys())==allowed for p in arr)
  assert len(arr)<=12
print("HOME_API_TESTS_OK")
old,oldtime,_=fetch(3002,"/api/runtime")
new,newtime,_=fetch(3004,"/api/runtime")
def counts(payload):
 families=payload.get("products",[])
 return len(families),sum(len(f.get("variants",[])) for f in families)
assert counts(old)==counts(new),(counts(old),counts(new))
print("CATALOG_PARITY",counts(new),"OLD_RUNTIME_TIME",oldtime,"NEW_RUNTIME_TIME",newtime)
PY
echo '===== FINAL PUBLIC HEALTH ====='
curl -kfsS --max-time 10 https://127.0.0.1/api/health;echo
echo 'FIRSTPAINT_CANARY_OK'
echo 'NGINX_NOT_CHANGED_PRODUCTION_3002'
