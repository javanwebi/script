#!/usr/bin/env bash
# Run once after access to Meta's DINOv3 weights is approved. Does not enable production.
set -Eeuo pipefail
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG=/opt/sanatpish/.env.local-vision
IMAGE=sanatpish-local-vision:dinov3-smallplus-v1
if [[ ${EUID} != 0 ]]; then echo 'Run with sudo'; exit 1; fi
TOKEN_FILE="$(mktemp /tmp/sanatpish-hf.XXXXXXXX)"
trap 'rm -f -- "$TOKEN_FILE"' EXIT
read -rsp 'Hugging Face read token (approved DINOv3 account): ' HF_DOWNLOAD_TOKEN </dev/tty
printf '\n'
test -n "$HF_DOWNLOAD_TOKEN"
printf '%s' "$HF_DOWNLOAD_TOKEN" > "$TOKEN_FILE"
unset HF_DOWNLOAD_TOKEN
DOCKER_BUILDKIT=1 docker build --secret "id=hf_token,src=$TOKEN_FILE" \
 -t "$IMAGE" "$ROOT/services/local-vision"
rm -f -- "$TOKEN_FILE"
# Keep the token stable across blue/green releases; it is NOT the HF token.
if [[ ! -e "$CONFIG" ]]; then
 python3 - "$CONFIG" <<'PY'
import secrets,sys
with open(sys.argv[1], 'x') as f:
 f.write('LOCAL_VISION_URL=http://sanatpish-local-vision:8091\n')
 f.write('LOCAL_VISION_TOKEN='+secrets.token_hex(32)+'\n')
 f.write('LOCAL_VISION_MIN_SIMILARITY=0.65\n')
 # Reconcile photos/bindings and benchmark with the owner before enabling.
 f.write('PART_RECOGNITION_MODE=local-embedding\n')
PY
 chmod 600 "$CONFIG"
fi
echo 'LOCAL_VISION_INSTALLED — enable after catalogue reconciliation and accuracy/latency validation:'
echo 'sudo touch /opt/sanatpish/.local-vision-enabled'
echo 'sudo sanatpish-deploy-main'
