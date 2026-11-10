#!/usr/bin/env bash
# Add a narrowly scoped writable API route to the customer-facing Nginx vhosts.
# The root SPA and the IP preview remain read-only. No app/container/DB changes.
set -Eeuo pipefail
umask 077
[[ "$EUID" == 0 ]] || { echo RUN_AS_ROOT; exit 1; }
DOMAIN=sanatpish.com

if [[ -f /etc/nginx/sites-enabled/default && \
      -f /etc/nginx/sites-enabled/sanatpish-https.conf && \
      -f /etc/nginx/sites-enabled/sanatpish-domain-20261103.conf ]]; then
  CONF1="$(readlink -f /etc/nginx/sites-enabled/default)"
  CONF2="$(readlink -f /etc/nginx/sites-enabled/sanatpish-https.conf)"
  CONF_DOMAIN="$(readlink -f /etc/nginx/sites-enabled/sanatpish-domain-20261103.conf)"
elif [[ -f /etc/nginx/conf.d/sanatpish-new-ip.conf && \
        -f /etc/nginx/conf.d/sanatpish-hostino-https.conf && \
        -f /etc/nginx/conf.d/sanatpish-domain-http.conf ]]; then
  CONF1="$(readlink -f /etc/nginx/conf.d/sanatpish-new-ip.conf)"
  CONF2="$(readlink -f /etc/nginx/conf.d/sanatpish-hostino-https.conf)"
  CONF_DOMAIN="$(readlink -f /etc/nginx/conf.d/sanatpish-domain-http.conf)"
else
  echo SANATPISH_NGINX_LAYOUT_UNRECOGNIZED >&2
  exit 1
fi
test -f "$CONF1" && test -f "$CONF2" && test -f "$CONF_DOMAIN"
test "$CONF1" != "$CONF2" && test "$CONF1" != "$CONF_DOMAIN" && test "$CONF2" != "$CONF_DOMAIN"
grep -Eq 'server_name[[:space:]]+sanatpish\.com[[:space:]]+www\.sanatpish\.com;' "$CONF_DOMAIN"

PORT="$(python3 - "$CONF2" "$CONF_DOMAIN" <<'PY'
from pathlib import Path
import re,sys
pattern=re.compile(r'proxy_pass\s+http://127\.0\.0\.1:(30(?:0[0-9]|1[0-9]|20));')
ports=[]
for filename in sys.argv[1:]:
 matches=set(pattern.findall(Path(filename).read_text()))
 if len(matches)!=1:raise SystemExit(("UNEXPECTED_APP_UPSTREAM",filename,matches))
 ports.append(next(iter(matches)))
if len(set(ports))!=1:raise SystemExit(("CUSTOMER_VHOSTS_DIFFER",ports))
print(ports[0])
PY
)"
echo "CUSTOMER_APP_PORT=$PORT"
curl --noproxy '*' -fsS --connect-timeout 3 --max-time 12 \
 "http://127.0.0.1:$PORT/api/health" | grep -q '"database":"ok"'
echo DATABASE_HEALTH_OK

STAMP="$(date +%Y%m%d-%H%M%S)-$$"
BACKUP="/root/sanatpish-nginx-api-write-$STAMP"
mkdir -m 700 "$BACKUP"
cp -p "$CONF2" "$BACKUP/https"
cp -p "$CONF_DOMAIN" "$BACKUP/domain"
CHANGED=0
SUCCESS=0
cleanup() {
 status=$?
 trap - EXIT
 set +e
 if [[ "$SUCCESS" != 1 && "$CHANGED" == 1 ]]; then
  echo "===== RESTORE NGINX BACKUP ====="
  cp -p "$BACKUP/https" "$CONF2"
  cp -p "$BACKUP/domain" "$CONF_DOMAIN"
  if nginx -t && systemctl reload nginx; then
   echo NGINX_API_ROUTE_ROLLBACK_OK
  else
   echo CRITICAL_NGINX_API_ROUTE_ROLLBACK_FAILED >&2
  fi
 fi
 exit "$status"
}
trap cleanup EXIT

CHANGED=1
python3 - "$CONF2" "$CONF_DOMAIN" "$PORT" <<'PY'
from pathlib import Path
import re,sys
files=sys.argv[1:3]
target=sys.argv[3]
root_pattern=re.compile(r'(?m)^([ \t]*)location\s+/\s*\{')
api_pattern=re.compile(r'(?m)^[ \t]*location\s+\^~\s+/api/\s*\{')
marker="# SANATPISH_API_WRITE_ROUTE_V1"
for filename in files:
 source=Path(filename).read_text()
 if marker in source:
  assert source.count(marker)==1,("DUPLICATE_API_WRITE_ROUTE",filename)
  root=list(root_pattern.finditer(source))
  assert len(root)==1 and source.index(marker)<root[0].start(),("API_ROUTE_PLACEMENT_INVALID",filename)
  route=source[source.index(marker):root[0].start()]
  assert "limit_except GET HEAD POST PUT PATCH DELETE OPTIONS" in route,("API_METHOD_ALLOWLIST_MISSING",filename)
  assert f"proxy_pass http://127.0.0.1:{target};" in route,("API_UPSTREAM_MISMATCH",filename)
 else:
  assert not api_pattern.search(source),("UNMANAGED_API_PREFIX_LOCATION",filename)
  roots=list(root_pattern.finditer(source))
  assert len(roots)==1,("UNEXPECTED_ROOT_LOCATION_COUNT",filename,len(roots))
  indent=roots[0].group(1)
  block="\n".join((
   f"{indent}{marker}",
   f"{indent}location ^~ /api/ {{",
   f"{indent}    limit_except GET HEAD POST PUT PATCH DELETE OPTIONS {{",
   f"{indent}        deny all;",
   f"{indent}    }}",
   "",
   f"{indent}    proxy_pass http://127.0.0.1:{target};",
   f"{indent}    proxy_http_version 1.1;",
   f"{indent}    proxy_set_header Host $host;",
   f"{indent}    proxy_set_header X-Real-IP $remote_addr;",
   f"{indent}    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
   f"{indent}    proxy_set_header X-Forwarded-Proto $scheme;",
   f"{indent}    proxy_set_header Upgrade $http_upgrade;",
   f"{indent}    proxy_set_header Connection $connection_upgrade;",
   "",
   f"{indent}    proxy_connect_timeout 15s;",
   f"{indent}    proxy_read_timeout 300s;",
   f"{indent}    proxy_send_timeout 300s;",
   f"{indent}    proxy_buffering off;",
   f"{indent}    proxy_request_buffering off;",
   f"{indent}}}",
  ))
  source=source[:roots[0].start()]+block+"\n\n"+source[roots[0].start():]
  assert source.index(marker)<source.index("location / {")
 root=list(root_pattern.finditer(source))
 assert len(root)==1,("ROOT_LOCATION_CHANGED",filename)
 assert re.search(r'limit_except\s+GET\s*\{',source[root[0].start():root[0].start()+700]),("SPA_READ_ONLY_GUARD_NOT_PRESERVED",filename)
 Path(filename).write_text(source)
 print("CUSTOMER_API_WRITE_ROUTE_READY",filename,"upstream="+target)
PY

nginx -t
systemctl reload nginx

echo "===== VERIFY BOTH CUSTOMER DOMAINS ====="
python3 - "$DOMAIN" <<'PY'
import json,subprocess,sys
domain=sys.argv[1]
for host in (domain,"www."+domain):
 for path in ("/api/admin/crm/customers","/api/catalog/sku-transfer"):
  cmd=["curl","--noproxy","*","-ksS","--connect-timeout","3","--max-time","15",
       "--resolve",f"{host}:443:127.0.0.1",
       "-H","Accept: application/json","-H","Content-Type: application/json",
       "-X","POST","--data","{}",
       "-w","\n__META__%{http_code}|%{content_type}",
       f"https://{host}{path}"]
  result=subprocess.run(cmd,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  raw=result.stdout
  if b"\n__META__" not in raw:raise AssertionError(("MISSING_HTTP_METADATA",host,path))
  body,meta=raw.rsplit(b"\n__META__",1)
  status,content_type=meta.decode("utf-8","replace").strip().split("|",1)
  assert status in ("401","403"),("WRONG_HTTP_STATUS",host,path,status,content_type)
  assert "application/json" in content_type.lower(),("NGINX_STILL_BLOCKS_API",host,path,status,content_type)
  payload=json.loads(body)
  assert payload.get("success") is False or isinstance(payload.get("error"),dict),("UNEXPECTED_API_DENIAL",host,path)
  print("API_REACHES_EXPRESS_AS_JSON",host,path,"HTTP",status)
PY

for host in sanatpish.com www.sanatpish.com; do
 curl --noproxy '*' -kfsS --connect-timeout 3 --max-time 12 \
  --resolve "$host:443:127.0.0.1" "https://$host/api/health" | grep -q '"database":"ok"'
 echo "HTTPS_DATABASE_OK=$host"
done

SUCCESS=1
echo "NGINX_API_WRITE_ROUTE_FIX_OK"
echo "BACKUP=$BACKUP"
echo "READ_ONLY_IP_PREVIEW_PRESERVED=$CONF1"
