#!/usr/bin/env bash
# One-time public model download; no account, API key or download token. Does not enable production.
set -Eeuo pipefail
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG=/opt/sanatpish/.env.local-vision
IMAGE=sanatpish-local-vision:dinov2-small-lens-v2
if [[ ${EUID} != 0 ]]; then echo 'Run with sudo'; exit 1; fi
APP_CONTAINER=''
if [[ -f "$CONFIG" ]] && grep -Eq '^LOCAL_VISION_ENCODER=mobileclip2-s0\r?$' "$CONFIG"; then
 echo 'MobileCLIP is configured; use ops/upgrade-local-vision-mobileclip.sh --app sanatpish-app'
 exit 1
fi
if [[ $# -gt 0 ]]; then
 [[ $# == 2 && "$1" == '--app' && "$2" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]+$ ]] || { echo 'Usage: setup-local-vision-vps.sh [--app container-name]'; exit 1; }
 APP_CONTAINER="$2"
fi
VISION_PYPI_INDEX_URL="$(python3 "$ROOT/services/local-vision/select_pypi_mirror.py")"
docker build --progress=plain --build-arg "VISION_PYPI_INDEX_URL=$VISION_PYPI_INDEX_URL" \
 -t "$IMAGE" "$ROOT/services/local-vision"
# Generate a private service credential automatically; no external service/account is involved.
if [[ ! -e "$CONFIG" ]]; then
 python3 - "$CONFIG" <<'PY'
import secrets,sys
with open(sys.argv[1], 'x') as f:
 f.write('LOCAL_VISION_URL=http://sanatpish-local-vision-lens-v2:8091\n')
 f.write('LOCAL_VISION_TOKEN='+secrets.token_hex(32)+'\n')
 f.write('LOCAL_VISION_MIN_SIMILARITY=0.65\n')
 # Reconcile photos/bindings and benchmark with the owner before enabling.
 f.write('PART_RECOGNITION_MODE=local-embedding\n')
PY
 chmod 600 "$CONFIG"
fi
# Upgrade only the local service address; preserve the automatically generated credential.
sed -i 's#^LOCAL_VISION_URL=.*#LOCAL_VISION_URL=http://sanatpish-local-vision-lens-v2:8091#' "$CONFIG"
if [[ -n "$APP_CONTAINER" ]]; then
 # Discover the real app's network without printing its environment or database credentials.
 VISION_NETWORK="$(python3 - "$APP_CONTAINER" <<'PYNET'
import json,subprocess,sys
app=json.loads(subprocess.check_output(['docker','inspect',sys.argv[1]]))[0]
assert app['State']['Running'], 'APP_NOT_RUNNING'
assert any(m['Source']=='/opt/sanatpish' and m['Destination']=='/app' and m['RW'] for m in app['Mounts']), 'UNEXPECTED_APP_MOUNT'
network=app['HostConfig']['NetworkMode']
assert network in app['NetworkSettings']['Networks'] and network not in ('host','bridge','none'), 'DEDICATED_NETWORK_REQUIRED'
print(network)
PYNET
)"
 if ! docker container inspect sanatpish-local-vision-lens-v2 >/dev/null 2>&1; then
  docker run -d --name sanatpish-local-vision-lens-v2 --restart unless-stopped \
   --network "$VISION_NETWORK" --cpus=1 --memory=1200m --memory-swap=1200m \
   --pids-limit=64 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
   --cap-drop=ALL --security-opt=no-new-privileges \
   --env-file "$CONFIG" "$IMAGE" >/dev/null
 else
  test "$(docker inspect sanatpish-local-vision-lens-v2 --format '{{.Image}}')" = "$(docker image inspect "$IMAGE" --format '{{.Id}}')" || { echo 'EXISTING_ENCODER_VERSION_DIFFERS'; exit 1; }
  docker start sanatpish-local-vision-lens-v2 >/dev/null
 fi
 READY=0
 for _ in $(seq 1 30); do
  if docker exec sanatpish-local-vision-lens-v2 python -c 'import json,urllib.request; d=json.load(urllib.request.urlopen("http://127.0.0.1:8091/health",timeout=2)); assert d.get("pipeline")=="local-lens-v2"' 2>/dev/null; then READY=1; break; fi
  sleep 1
 done
 test "$READY" = 1
 echo "LOCAL_VISION_PRIVATE_ENCODER_READY network=$VISION_NETWORK"
fi
echo 'LOCAL_VISION_INSTALLED — enable after catalogue reconciliation and accuracy/latency validation:'
echo 'sudo touch /opt/sanatpish/.local-vision-enabled'
echo 'sudo sanatpish-deploy-main'
