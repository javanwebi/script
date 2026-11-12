#!/usr/bin/env bash
# Stage a separately named, private encoder; preserve DINO and its derived index.
# Activate by the owner's existing sanatpish-deploy-main command after this succeeds.
set -Eeuo pipefail
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG=/opt/sanatpish/.env.local-vision
NAME=sanatpish-local-vision-mobileclip-v3
IMAGE=sanatpish-local-vision:mobileclip2-s0-lens-v3
[[ "$EUID" == 0 ]] || { echo RUN_AS_ROOT; exit 1; }
[[ $# == 2 && "$1" == --app && "$2" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]+$ ]] || { echo 'Usage: upgrade-local-vision-mobileclip.sh --app sanatpish-app'; exit 1; }
APP="$2"
test -s "$CONFIG"
docker image inspect sanatpish-local-vision:dinov2-small-lens-v2 >/dev/null
NETWORK="$(python3 - "$APP" <<'PY'
import json,subprocess,sys
d=json.loads(subprocess.check_output(['docker','inspect',sys.argv[1]]))[0]
assert d['State']['Running'], 'APP_NOT_RUNNING'
assert any(m['Source']=='/opt/sanatpish' and m['Destination']=='/app' and m['RW'] for m in d['Mounts']), 'UNEXPECTED_APP_MOUNT'
n=d['HostConfig']['NetworkMode']
assert n in d['NetworkSettings']['Networks'] and n not in ('host','bridge','none'), 'DEDICATED_NETWORK_REQUIRED'
print(n)
PY
)"
exec 9>/run/lock/sanatpish-local-vision-upgrade.lock
flock -n 9 || { echo VISION_UPGRADE_ALREADY_RUNNING; exit 1; }
MIRROR="$(python3 "$ROOT/services/local-vision/select_pypi_mirror.py")"
docker build --progress=plain -f "$ROOT/services/local-vision/Dockerfile.mobileclip" \
 --build-arg "VISION_PYPI_INDEX_URL=$MIRROR" -t "$IMAGE" "$ROOT/services/local-vision"
PREVIOUS=''
CREATED=0
RENAMED=0
STOPPED_EXISTING=0
rollback() {
 rc=$?
 trap - EXIT
 set +e
 if [[ "$rc" != 0 ]]; then
  if [[ "$CREATED" == 1 ]]; then docker rm -f "$NAME" >/dev/null 2>&1 || true; fi
  if [[ "$RENAMED" == 1 ]]; then docker rename "$PREVIOUS" "$NAME"; docker start "$NAME" >/dev/null;
  elif [[ "$STOPPED_EXISTING" == 1 ]]; then docker start "$NAME" >/dev/null; fi
  echo 'VISION_UPGRADE_FAILED — previous configuration preserved'
 fi
 exit "$rc"
}
trap rollback EXIT
if docker container inspect "$NAME" >/dev/null 2>&1; then
 if [[ "$(docker inspect "$NAME" --format '{{.Image}}')" != "$(docker image inspect "$IMAGE" --format '{{.Id}}')" ]]; then
  PREVIOUS="$NAME-backup-$(date +%Y%m%d-%H%M%S)-$$"
  docker stop --time 15 "$NAME" >/dev/null
  STOPPED_EXISTING=1
  docker rename "$NAME" "$PREVIOUS"
  RENAMED=1
 fi
fi
if ! docker container inspect "$NAME" >/dev/null 2>&1; then
 docker run -d --name "$NAME" --restart unless-stopped \
  --network "$NETWORK" --cpus=1 --memory=1200m --memory-swap=1200m \
  --pids-limit=64 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --cap-drop=ALL --security-opt=no-new-privileges \
  --env-file "$CONFIG" --env LOCAL_VISION_ENCODER=mobileclip2-s0 "$IMAGE" >/dev/null
 CREATED=1
else
 docker start "$NAME" >/dev/null
fi
READY=0
for _ in $(seq 1 45); do
 if docker exec "$NAME" python -c 'import json,urllib.request; d=json.load(urllib.request.urlopen("http://127.0.0.1:8091/health",timeout=2)); assert d["model"]=="mobileclip2-s0-095906d2-fp32-pad-256-v1" and d["dimensions"]==512 and d["pipeline"]=="local-lens-v3"' 2>/dev/null; then READY=1; break; fi
 sleep 1
done
test "$READY" = 1
# Check real inference/auth before selecting this encoder in the app config.
docker exec "$NAME" python -c 'import base64,io,json,os,urllib.request; from PIL import Image; b=io.BytesIO(); Image.new("RGB",(24,24),"white").save(b,"JPEG"); r=urllib.request.Request("http://127.0.0.1:8091/embed",data=json.dumps({"images":[base64.b64encode(b.getvalue()).decode()]}).encode(),headers={"Authorization":"Bearer "+os.environ["LOCAL_VISION_TOKEN"],"Content-Type":"application/json"}); d=json.load(urllib.request.urlopen(r,timeout=10)); assert d["model"]=="mobileclip2-s0-095906d2-fp32-pad-256-v1" and len(d["vectors"][0])==512'
BACKUP="$CONFIG.before-mobileclip-$(date +%Y%m%d-%H%M%S)-$$"
cp -p "$CONFIG" "$BACKUP"
python3 - "$CONFIG" <<'PY'
import os,sys,tempfile
from pathlib import Path
p=Path(sys.argv[1])
updates={'LOCAL_VISION_URL':'http://sanatpish-local-vision-mobileclip-v3:8091','LOCAL_VISION_ENCODER':'mobileclip2-s0','LOCAL_VISION_MIN_SIMILARITY':'0.55'}
lines=[line for line in p.read_text().splitlines() if line.partition('=')[0].strip() not in updates]
lines += [key+'='+value for key,value in updates.items()]
fd,name=tempfile.mkstemp(prefix='.local-vision-',dir=p.parent)
try:
 with os.fdopen(fd,'w') as f:
  f.write('\n'.join(lines)+'\n'); f.flush(); os.fsync(f.fileno())
 os.replace(name,p)
finally:
 if os.path.exists(name):os.unlink(name)
PY
trap - EXIT
echo MOBILECLIP_PRIVATE_ENCODER_READY
echo "CONFIG_ROLLBACK=$BACKUP"
echo 'NEXT: sudo sanatpish-deploy-main'
echo 'The new image index starts at zero in a separate namespace. Wait for ready:true.'
