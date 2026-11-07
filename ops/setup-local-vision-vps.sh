#!/usr/bin/env bash
# One-time public model download; no account, API key or download token. Does not enable production.
set -Eeuo pipefail
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG=/opt/sanatpish/.env.local-vision
IMAGE=sanatpish-local-vision:dinov2-small-lens-v2
if [[ ${EUID} != 0 ]]; then echo 'Run with sudo'; exit 1; fi
docker build -t "$IMAGE" "$ROOT/services/local-vision"
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
echo 'LOCAL_VISION_INSTALLED — enable after catalogue reconciliation and accuracy/latency validation:'
echo 'sudo touch /opt/sanatpish/.local-vision-enabled'
echo 'sudo sanatpish-deploy-main'
