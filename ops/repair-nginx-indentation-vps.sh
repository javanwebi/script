#!/usr/bin/env bash
# One-time repair for the 2026-11-23 exponentially growing Sanat Pish domain vhost.
# Changes ONLY excessive indentation. Does not remove/insert any Nginx directive.
set -Eeuo pipefail
umask 077
test "$(id -u)" = 0 || { echo "RUN_AS_ROOT_REQUIRED" >&2; exit 1; }
CONF=/etc/nginx/conf.d/sanatpish-domain-http.conf
test -f "$CONF" && test "$(readlink -f "$CONF")" = "$CONF"
nginx -t
BYTES_BEFORE="$(stat -c '%s' "$CONF")"
if (( BYTES_BEFORE <= 262144 )); then
  echo "NO_REPAIR_NEEDED vhost_bytes=$BYTES_BEFORE"
  exit 0
fi
if (( BYTES_BEFORE >= 1048576 )); then
  echo "UNEXPECTED_VHOST_SIZE bytes=$BYTES_BEFORE: manual review required" >&2
  exit 1
fi
BACKUP_DIR="$(mktemp -d /root/sanatpish-nginx-indent-rollback-XXXXXXXX)"
chmod 700 "$BACKUP_DIR"
cp -p -- "$CONF" "$BACKUP_DIR/domain.original"
echo "ORIGINAL_NGINX_SAVED=$BACKUP_DIR/domain.original"
CHANGED=1
SUCCESS=0
rollback() {
  status=$?
  trap - EXIT
  if [[ "$SUCCESS" != 1 && "$CHANGED" = 1 ]]; then
    echo "===== ROLLBACK DOMAIN NGINX FILE =====" >&2
    cp -p -- "$BACKUP_DIR/domain.original" "$CONF"
    if nginx -t && systemctl reload nginx; then
      echo "NGINX_REPAIR_ROLLBACK_OK" >&2
    else
      echo "CRITICAL_NGINX_REPAIR_ROLLBACK_FAILED" >&2
    fi
  fi
  exit "$status"
}
trap rollback EXIT

python3 - "$CONF" <<'PY'
from pathlib import Path
import os,re,stat,sys,tempfile
p=Path(sys.argv[1])
original=p.read_bytes()
assert b"\x00" not in original, "UNEXPECTED_NUL_IN_NGINX_CONFIG"
source=original.decode("utf-8")
assert "server_name sanatpish.com www.sanatpish.com;" in source, "NOT_SANATPISH_DOMAIN_VHOST"
assert source.count("# SANATPISH_API_WRITE_ROUTE_V2")==1, "API_ROUTE_MARKER_COUNT_INVALID"
assert len(re.findall(r'(?m)^[ \t]*location[ \t]+/[ \t]*\{', source))==1, "SPA_ROOT_NOT_UNIQUE"
before_ports=set(re.findall(r'proxy_pass\s+http://127\.0\.0\.1:(\d+);',source))
assert before_ports=={"3013"}, ("APP_PORT_DRIFT", before_ports)
assert len(re.findall(r'limit_except\s+GET\s*\{',source))>=1, "READ_ONLY_SPA_GUARD_MISSING"
assert len(re.findall(r'(?m)^[ \t]*location[ \t]+\^~[ \t]+/api/[ \t]*\{',source))==1, "CUSTOMER_API_ROUTE_MISSING"

cleaned=[]
changed_lines=[]
for number,line in enumerate(source.splitlines(keepends=True),start=1):
    match=re.match(r'[ \t]*',line)
    indent=len(match.group())
    if indent>=256:
        tail=line[indent:]
        # Retain all tokens, comments, quoting and line endings unchanged.
        new_indent="" if not tail.strip() else "    "
        cleaned.append(new_indent+tail)
        changed_lines.append((number,indent))
    else:
        cleaned.append(line)
result="".join(cleaned)
assert 1<=len(changed_lines)<=30, ("ABNORMAL_INDENT_LINE_COUNT", changed_lines)
# The only legal transformation is removing/replacing LEADING whitespace.
def remove_indent(text):
    return re.sub(r'(?m)^[ \t]+','',text)
assert remove_indent(source)==remove_indent(result), "DIRECTIVE_CONTENT_CHANGED"
assert len(result.encode("utf-8"))<=262144, "REPAIRED_CONFIG_STILL_TOO_LARGE"
assert len(original)-len(result.encode("utf-8"))>=65536, "NOT_THE_EXPECTED_INDENTATION_GROWTH"
assert len(re.findall(r'(?m)^[ \t]*location[ \t]+/[ \t]*\{',result))==1
assert result.count("# SANATPISH_API_WRITE_ROUTE_V2")==1
assert set(re.findall(r'proxy_pass\s+http://127\.0\.0\.1:(\d+);',result))==before_ports

fd,temp_path=tempfile.mkstemp(prefix=".sanatpish-indent-repair-",dir=str(p.parent))
try:
    meta=p.stat()
    os.fchmod(fd,stat.S_IMODE(meta.st_mode))
    os.fchown(fd,meta.st_uid,meta.st_gid)
    with os.fdopen(fd,"wb") as stream:
        stream.write(result.encode("utf-8"))
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temp_path,p)
except BaseException:
    try: os.unlink(temp_path)
    except FileNotFoundError: pass
    raise
print("NGINX_INDENTATION_NORMALIZED",changed_lines)
print("NGINX_SIZE_BEFORE",len(original),"AFTER",p.stat().st_size)
print("NGINX_NON_WHITESPACE_CONTENT_IDENTICAL")
PY
nginx -t
systemctl reload nginx
curl --noproxy '*' -fsS --max-time 12 http://127.0.0.1:3013/api/health | grep -q '"database":"ok"'
for domain in sanatpish.com www.sanatpish.com; do
  curl --noproxy '*' -kfsS --max-time 12 \
    --resolve "$domain:443:127.0.0.1" "https://$domain/api/health" \
    | grep -q '"database":"ok"'
  echo "DOMAIN_DATABASE_HEALTH_OK domain=$domain"
done
SUCCESS=1
CHANGED=0
echo "NGINX_INDENTATION_REPAIR_OK"
echo "ROLLBACK_BACKUP=$BACKUP_DIR/domain.original"
echo "The original configuration was preserved; no application container was changed."
