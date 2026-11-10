#!/usr/bin/env bash
# Static UI preview only. No production credentials, database or Nginx changes.
set -Eeuo pipefail
umask 077
ROOT=/opt/sanatpish
REV=${1:?Pass the full commit SHA to preview}
[[ "$REV" =~ ^[a-f0-9]{40}$ ]] || { echo INVALID_COMMIT; exit 1; }
git -C "$ROOT" cat-file -e "$REV^{commit}"
STAGE=$(mktemp -d /opt/sanatpish-ui-preview.XXXXXXXX)
NAME="sanatpish-ui-preview-${REV:0:10}-$(date +%s)"
complete=0
cleanup(){
 if [[ "$complete" != 1 ]]; then
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  rm -rf -- "$STAGE"
 fi
}
trap cleanup EXIT
git -C "$ROOT" archive "$REV" | tar -xf - -C "$STAGE"
docker run --rm --cpus=1.5 --memory=3g --memory-swap=3g \
 -v "$STAGE:/app" -w /app node:22-bookworm \
 bash -lc 'npm ci --no-audit --no-fund && npm run build'
cat > "$STAGE/preview.conf" <<'NGINX'
server {
 listen 8080;
 root /usr/share/nginx/html;
 location /api/ { return 503; }
 location / { try_files $uri $uri/ /index.html; }
}
NGINX
docker run -d --name "$NAME" --read-only \
 --security-opt=no-new-privileges --pids-limit=64 --memory=128m \
 --tmpfs /tmp:rw,noexec,nosuid,size=16m --tmpfs /var/cache/nginx:rw,size=16m \
 --tmpfs /var/run:rw,size=1m \
 -p 127.0.0.1::8080 \
 -v "$STAGE/dist:/usr/share/nginx/html:ro" \
 -v "$STAGE/preview.conf:/etc/nginx/conf.d/default.conf:ro" \
 nginx:stable-alpine >/dev/null
PORT=$(docker port "$NAME" 8080/tcp | sed -n 's/^127\.0\.0\.1://p')
for attempt in $(seq 1 15); do
 if curl -fsS --max-time 2 "http://127.0.0.1:$PORT/" >/dev/null; then complete=1; break; fi
 sleep 1
done
[[ "$complete" == 1 ]] || { echo PREVIEW_FAILED; exit 1; }
printf 'PREVIEW_CONTAINER=%s\nPREVIEW_PORT=%s\nPREVIEW_STAGE=%s\n' "$NAME" "$PORT" "$STAGE"
echo 'STATIC_UI_ONLY: catalog, authentication, STT and AI APIs are unavailable.'
