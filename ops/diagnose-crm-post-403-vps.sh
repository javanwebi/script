#!/usr/bin/env bash
# Safe diagnosis for HTML 403 on CRM POST. Does not send cookies or write data.
set -uo pipefail
DOMAIN=sanatpish.com
PORT=3013
TMP="$(mktemp -d /tmp/sanatpish-crm-403.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

probe() {
  local name="$1"; shift
  echo
  echo "===== $name ====="
  if curl --noproxy '*' -ksS --connect-timeout 3 --max-time 15 \
      -H 'Accept: application/json' \
      -H 'Content-Type: application/json' \
      -X POST --data '{}' "$@" \
      -D "$TMP/$name.headers" -o "$TMP/$name.body" \
      -w 'HTTP_STATUS=%{http_code}\nCONTENT_TYPE=%{content_type}\n'; then
    sed -n '1,12p' "$TMP/$name.headers" 2>/dev/null || true
    echo "--- response body (first 500 bytes; no cookies sent) ---"
    head -c 500 "$TMP/$name.body" 2>/dev/null || true
    echo
  else
    echo "CURL_TRANSPORT_FAILED=$name"
  fi
}

echo "===== RELEASE AND APP ====="
if git -C /opt/sanatpish rev-parse --short HEAD 2>/dev/null; then :; else echo REPO_HEAD_UNAVAILABLE; fi
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}' | grep -E 'NAMES|sanatpish' || true

probe DIRECT_APP "http://127.0.0.1:$PORT/api/admin/crm/customers"
probe LOCAL_NGINX --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/admin/crm/customers"
probe PUBLIC_DNS "https://$DOMAIN/api/admin/crm/customers"

echo
echo "===== NGINX POST/METHOD RULE CONTEXT ====="
nginx -T 2>&1 | grep -n -B10 -A14 -E 'limit_except|location[[:space:]]+(/api|/)|proxy_pass' | tail -n 180 || true

echo
echo "===== DATABASE HEALTH (READ ONLY) ====="
curl --noproxy '*' -ksS --max-time 10 \
  --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" || true
echo
echo "DIAGNOSTIC_COMPLETE"
