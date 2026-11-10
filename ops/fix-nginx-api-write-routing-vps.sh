#!/usr/bin/env bash
# Repair the actual customer HTTPS API route. The IP preview stays read-only.
# All writes are backed up and rolled back if the live Express JSON probe fails.
set -Eeuo pipefail
umask 077
[[ "$EUID" == 0 ]] || { echo RUN_AS_ROOT; exit 1; }
[[ " $(hostname -I) " == *" 87.107.9.114 "* ]] || { echo WRONG_SERVER; exit 1; }
for cmd in nginx python3 curl; do command -v "$cmd" >/dev/null; done

HTTPS=/etc/nginx/conf.d/sanatpish-hostino-https.conf
HTTP=/etc/nginx/conf.d/sanatpish-domain-http.conf
IP=/etc/nginx/conf.d/sanatpish-new-ip.conf
DOMAIN=sanatpish.com
for file in "$HTTPS" "$HTTP" "$IP"; do
  test -f "$file" || { echo "MISSING_NGINX_CONFIG=$file"; exit 1; }
done

echo "===== VERIFY THESE ARE THE ACTIVE CUSTOMER VHOST FILES ====="
DUMP="$(mktemp /tmp/sanatpish-nginx-api-v2-dump.XXXXXX)"
trap 'rm -f "$DUMP"' EXIT
nginx -T >"$DUMP" 2>&1
grep -Fq "# configuration file $HTTPS:" "$DUMP" || { echo HTTPS_VHOST_NOT_LOADED; exit 1; }
grep -Fq "# configuration file $HTTP:" "$DUMP" || { echo HTTP_VHOST_NOT_LOADED; exit 1; }
grep -Eq 'server_name[[:space:]]+sanatpish\.com[[:space:]]+www\.sanatpish\.com;' "$HTTPS" || { echo HTTPS_SERVER_NAME_MISMATCH; exit 1; }
grep -Eq 'listen[[:space:]]+443[[:space:]]+ssl;' "$HTTPS" || { echo HTTPS_LISTENER_MISMATCH; exit 1; }
grep -Eq 'server_name[[:space:]]+sanatpish\.com[[:space:]]+www\.sanatpish\.com;' "$HTTP" || { echo HTTP_SERVER_NAME_MISMATCH; exit 1; }
grep -Eq 'limit_except[[:space:]]+GET[[:space:]]*\{' "$HTTPS" || { echo HTTPS_READ_ONLY_ROOT_GUARD_MISSING; exit 1; }
grep -Eq 'limit_except[[:space:]]+GET[[:space:]]*\{' "$HTTP" || { echo HTTP_READ_ONLY_ROOT_GUARD_MISSING; exit 1; }

PORT="$(python3 - "$HTTPS" "$HTTP" <<'PY'
from pathlib import Path
import re,sys
pattern=re.compile(r'proxy_pass\s+http://127\.0\.0\.1:(30\d{2});')
ports=[]
for filename in sys.argv[1:]:
    found=set(pattern.findall(Path(filename).read_text()))
    if len(found)!=1:
        raise SystemExit(("UNEXPECTED_APP_UPSTREAM",filename,sorted(found)))
    ports.append(next(iter(found)))
if len(set(ports))!=1:
    raise SystemExit(("CUSTOMER_VHOST_UPSTREAM_MISMATCH",ports))
print(ports[0])
PY
)"
echo "CUSTOMER_APP_PORT=$PORT"
curl --noproxy '*' -fsS --connect-timeout 3 --max-time 12 \
  "http://127.0.0.1:$PORT/api/health" | grep -q '"database":"ok"'
echo DATABASE_HEALTH_OK

echo "===== DIRECT EXPRESS CONTROL: CRM POST MUST BE JSON ====="
DIRECT_BODY="$(mktemp /tmp/sanatpish-direct-crm.XXXXXX)"
DIRECT_META="$(curl --noproxy '*' -sS --connect-timeout 3 --max-time 12 \
  -H 'Host: sanatpish.com' -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -X POST --data '{}' -o "$DIRECT_BODY" -w '%{http_code}|%{content_type}' \
  "http://127.0.0.1:$PORT/api/admin/crm/customers")"
DIRECT_STATUS="$(printf '%s' "$DIRECT_META" | cut -d'|' -f1)"
DIRECT_TYPE="$(printf '%s' "$DIRECT_META" | cut -d'|' -f2-)"
if [[ "$DIRECT_STATUS" != 401 && "$DIRECT_STATUS" != 403 ]]; then
  cat "$DIRECT_BODY"; rm -f "$DIRECT_BODY"
  echo "DIRECT_EXPRESS_AUTH_GUARD_UNEXPECTED status=$DIRECT_STATUS type=$DIRECT_TYPE"
  exit 1
fi
if [[ "$DIRECT_TYPE" != *application/json* ]]; then
  cat "$DIRECT_BODY"; rm -f "$DIRECT_BODY"
  echo "DIRECT_EXPRESS_DID_NOT_RETURN_JSON type=$DIRECT_TYPE"
  exit 1
fi
python3 - "$DIRECT_BODY" <<'PY'
import json,sys
with open(sys.argv[1],encoding="utf-8") as f: json.load(f)
PY
rm -f "$DIRECT_BODY"
echo "DIRECT_EXPRESS_JSON_AUTH_GUARD_OK status=$DIRECT_STATUS"

STAMP="$(date +%Y%m%d-%H%M%S)-$$"
BACKUP="/root/sanatpish-nginx-api-v2-$STAMP"
mkdir -m 700 "$BACKUP"
cp -p "$HTTPS" "$BACKUP/https"
cp -p "$HTTP" "$BACKUP/http"
CHANGED=0
SUCCESS=0
cleanup() {
  status=$?
  trap - EXIT
  set +e
  if [[ "$SUCCESS" != 1 && "$CHANGED" == 1 ]]; then
    echo "===== RESTORE NGINX CONFIG BACKUP ====="
    cp -p "$BACKUP/https" "$HTTPS"
    cp -p "$BACKUP/http" "$HTTP"
    if nginx -t && systemctl reload nginx; then
      echo NGINX_API_ROUTE_ROLLBACK_OK
    else
      echo CRITICAL_NGINX_API_ROUTE_ROLLBACK_FAILED >&2
    fi
  fi
  rm -f "$DUMP"
  exit "$status"
}
trap cleanup EXIT

CHANGED=1
python3 - "$HTTPS" "$HTTP" "$PORT" <<'PY'
from pathlib import Path
import re,sys
https,http,target=sys.argv[1:]
marker="# SANATPISH_API_WRITE_ROUTE_V2"
old_markers=("# SANATPISH_API_WRITE_ROUTE_V1",marker)
root_pattern=re.compile(r'(?m)^([ \t]*)location\s+/\s*\{')
api_pattern=re.compile(r'(?m)^[ \t]*location\s+(?:\^~\s+)?/api/\s*\{')
for index,filename in enumerate((https,http)):
    source=Path(filename).read_text()
    roots=list(root_pattern.finditer(source))
    if len(roots)!=1:
        raise SystemExit(("UNEXPECTED_ROOT_LOCATION_COUNT",filename,len(roots)))
    found=[m for m in old_markers if m in source]
    if found:
        if len(found)!=1 or source.count(found[0])!=1:
            raise SystemExit(("DUPLICATE_OR_MIXED_API_ROUTE_MARKERS",filename,found))
        start=source.index(found[0])
        root=list(root_pattern.finditer(source))
        if start>=root[0].start():
            raise SystemExit(("API_ROUTE_AFTER_SPA_FALLBACK",filename))
        source=source[:start]+source[root[0].start():]
    elif api_pattern.search(source):
        raise SystemExit(("UNMANAGED_GENERIC_API_LOCATION",filename))
    roots=list(root_pattern.finditer(source))
    if len(roots)!=1:
        raise SystemExit(("ROOT_LOCATION_CHANGED",filename,len(roots)))
    indent=roots[0].group(1)
    if index==0:
        lines=(
            f"{indent}{marker}",
            f"{indent}location ^~ /api/ {{",
            f"{indent}    # Nginx must not turn Express JSON 401/403 responses into HTML error pages.",
            f"{indent}    proxy_intercept_errors off;",
            f"{indent}    proxy_pass_header X-Powered-By;",
            f"{indent}    satisfy any;",
            f"{indent}    allow all;",
            f"{indent}    auth_basic off;",
            f"{indent}    auth_request off;",
            f"{indent}    proxy_pass http://127.0.0.1:{target};",
            f"{indent}    proxy_http_version 1.1;",
            f"{indent}    proxy_set_header Host $host;",
            f"{indent}    proxy_set_header X-Real-IP $remote_addr;",
            f"{indent}    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
            f"{indent}    proxy_set_header X-Forwarded-Proto https;",
            f"{indent}    proxy_set_header Upgrade $http_upgrade;",
            f"{indent}    proxy_set_header Connection $connection_upgrade;",
            f"{indent}    proxy_connect_timeout 15s;",
            f"{indent}    proxy_read_timeout 300s;",
            f"{indent}    proxy_send_timeout 300s;",
            f"{indent}    proxy_buffering off;",
            f"{indent}    proxy_request_buffering off;",
            f"{indent}}}",
        )
        label="CUSTOMER_API_WRITE_ROUTE_READY"
    else:
        lines=(
            f"{indent}{marker}",
            f"{indent}location ^~ /api/ {{",
            f"{indent}    return 308 https://$host$request_uri;",
            f"{indent}}}",
        )
        label="CUSTOMER_API_HTTP_REDIRECT_READY"
    block="\n".join(lines)
    source=source[:roots[0].start()]+block+"\n\n"+source[roots[0].start():]
    roots=list(root_pattern.finditer(source))
    if len(roots)!=1 or source.index(marker)>=roots[0].start():
        raise SystemExit(("API_ROUTE_NOT_BEFORE_SPA_FALLBACK",filename))
    root_text=source[roots[0].start():roots[0].start()+700]
    if not re.search(r'limit_except\s+GET\s*\{',root_text):
        raise SystemExit(("READ_ONLY_SPA_GUARD_NOT_PRESERVED",filename))
    route=source[source.index(marker):roots[0].start()]
    if "limit_except" in route:
        raise SystemExit(("API_METHODS_MUST_REACH_EXPRESS",filename))
    if index==0 and f"proxy_pass http://127.0.0.1:{target};" not in route:
        raise SystemExit(("HTTPS_API_PROXY_ROUTE_INVALID",filename))
    if index==1 and ("return 308 https://$host$request_uri;" not in route or "proxy_pass" in route):
        raise SystemExit(("HTTP_API_MUST_REDIRECT_TO_HTTPS",filename))
    Path(filename).write_text(source)
    print(label,filename,"upstream="+target if index==0 else "https_redirect")
print("API_ROUTE_METHODS_DELEGATED_TO_EXPRESS")
print("READ_ONLY_IP_PREVIEW_PRESERVED")
PY

nginx -t
systemctl reload nginx
echo "===== VERIFY THE LOADED ROUTE, EXPRESS JSON PASS-THROUGH AND BOTH PUBLIC HTTPS HOSTS ====="
nginx -T 2>&1 | grep -F "SANATPISH_API_WRITE_ROUTE_V2" >/dev/null
for host in sanatpish.com www.sanatpish.com; do
  for api_path in /api/admin/crm/customers /api/catalog/sku-transfer; do
    BODY="$(mktemp /tmp/sanatpish-public-api.XXXXXX)"
    HEADERS="$(mktemp /tmp/sanatpish-public-api-headers.XXXXXX)"
    META="$(curl --noproxy '*' -ksS --connect-timeout 3 --max-time 15 \
      --resolve "$host:443:127.0.0.1" \
      -D "$HEADERS" -H 'Accept: application/json' -H 'Content-Type: application/json' \
      -X POST --data '{}' -o "$BODY" -w '%{http_code}|%{content_type}' \
      "https://$host$api_path")"
    STATUS="$(printf '%s' "$META" | cut -d'|' -f1)"
    TYPE="$(printf '%s' "$META" | cut -d'|' -f2-)"
    if [[ "$STATUS" != 401 && "$STATUS" != 403 ]]; then
      cat "$BODY"; rm -f "$BODY" "$HEADERS"
      echo "NGINX_API_PROBE_UNEXPECTED host=$host path=$api_path status=$STATUS type=$TYPE"
      exit 1
    fi
    if [[ "$TYPE" != *application/json* ]] || ! grep -Eiq '^X-Powered-By:[[:space:]]*Express' "$HEADERS"; then
      cat "$BODY"; echo "===== RESPONSE HEADERS ====="; cat "$HEADERS"
      rm -f "$BODY" "$HEADERS"
      echo "NGINX_EXPRESS_HEADER_OR_JSON_MISSING host=$host path=$api_path status=$STATUS type=$TYPE"
      exit 1
    fi
    python3 - "$BODY" <<'PY'
import json,sys
with open(sys.argv[1],encoding="utf-8") as f: json.load(f)
PY
    rm -f "$BODY" "$HEADERS"
    echo "PUBLIC_POST_API_JSON_GUARD_OK host=$host path=$api_path status=$STATUS"
  done
  curl --noproxy '*' -kfsS --connect-timeout 3 --max-time 12 \
    --resolve "$host:443:127.0.0.1" "https://$host/api/health" | grep -q '"database":"ok"'
  echo "PUBLIC_API_DATABASE_HEALTH_OK host=$host"
done

echo "===== VERIFY PLAIN HTTP API REDIRECTS TO HTTPS ====="
HTTP_HEADERS="$(mktemp /tmp/sanatpish-http-redirect.XXXXXX)"
HTTP_STATUS="$(curl --noproxy '*' -sS --connect-timeout 3 --max-time 12 \
  --resolve "$DOMAIN:80:127.0.0.1" -D "$HTTP_HEADERS" -o /dev/null \
  -H 'Content-Type: application/json' -X POST --data '{}' -w '%{http_code}' \
  "http://$DOMAIN/api/admin/crm/customers")"
if [[ "$HTTP_STATUS" != 308 ]] || ! grep -Eiq '^Location:[[:space:]]*https://sanatpish\.com/api/admin/crm/customers' "$HTTP_HEADERS"; then
  cat "$HTTP_HEADERS"; rm -f "$HTTP_HEADERS"
  echo "HTTP_API_HTTPS_REDIRECT_FAILED status=$HTTP_STATUS"
  exit 1
fi
rm -f "$HTTP_HEADERS"
echo HTTP_API_HTTPS_REDIRECT_OK
SUCCESS=1
echo "SANATPISH_CUSTOMER_API_NGINX_FIX_OK"
