#!/usr/bin/env bash
# Store the small Apache-2.0 Diba/Vosk Persian browser model on the
# bind-mounted /opt/sanatpish VPS, outside dist, source control and Docker images.
# Does not change the running containers, site, database or nginx.
set -Eeuo pipefail
test "$EUID" -eq 0 || { echo "Run as root" >&2; exit 1; }
set -o pipefail
APP=/opt/sanatpish
MODEL_DIR="$APP/runtime-models"
MODEL="$MODEL_DIR/diba-stt-fa-small.tar.gz"
EXPECTED='a42a03e2cc7d72eb15d6ca757ee64664a2af18c24ce13c04d6a1f565b7546e74'
SOURCE='https://huggingface.co/Dibachain/Diba-STT/resolve/main/browser/diba-stt-fa-small.tar.gz'
test -d "$APP/.git"
test "$(docker inspect -f '{{.State.Running}}' sanatpish-new)" = true
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app"}}{{.Source}}{{end}}{{end}}' sanatpish-new)" = "$APP"
test "$(df -Pk "$APP" | awk 'NR==2 {print $4}')" -gt 150000
mkdir -p "$MODEL_DIR"
chmod 755 "$MODEL_DIR"
if [ -f "$MODEL" ] && echo "$EXPECTED  $MODEL" | sha256sum -c --status; then
  echo "FORZA_STT_MODEL_READY already_verified=1 bytes=$(wc -c < "$MODEL")"
  exit 0
fi
TMP=$(mktemp "$MODEL_DIR/.diba-model-download.XXXXXXXX")
cleanup(){ rm -f "$TMP"; }
trap cleanup EXIT
echo '[FORZA STT] Fetching the original 53.3 MB browser model over HTTPS.'
curl --fail --location --show-error --silent --retry 3 --retry-delay 3 \
  --connect-timeout 20 --max-time 600 --output "$TMP" "$SOURCE"
echo "$EXPECTED  $TMP" | sha256sum -c --status || {
 echo 'Model checksum mismatch; nothing installed.' >&2; exit 1;
}
chmod 644 "$TMP"
mv -f "$TMP" "$MODEL"
trap - EXIT
echo "FORZA_STT_MODEL_READY sha256=$EXPECTED bytes=$(wc -c < "$MODEL")"
echo 'Model available on host. The Node API route starts working only AFTER the STT PR is deployed.'
