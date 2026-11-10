#!/usr/bin/env bash
# Read-only diagnosis of the Nginx server block that actually handles
# sanatpish.com:443 and www.sanatpish.com:443. Makes no config changes.
set -Eeuo pipefail
[[ "$EUID" == 0 ]] || { echo RUN_AS_ROOT; exit 1; }
command -v nginx >/dev/null
command -v python3 >/dev/null
command -v curl >/dev/null
DOMAIN=sanatpish.com
DUMP="$(mktemp /tmp/sanatpish-nginx-active-vhost.XXXXXX)"
trap 'rm -f "$DUMP"' EXIT

echo "===== NGINX CONFIG TEST AND ACTIVE CONFIG DUMP ====="
if ! nginx -T >"$DUMP" 2>&1; then
  tail -100 "$DUMP"
  exit 1
fi
echo NGINX_CONFIG_TEST_OK

echo "===== SERVER BLOCKS THAT CAN HANDLE THE CUSTOMER DOMAINS ====="
python3 - "$DUMP" "$DOMAIN" <<'PY'
from pathlib import Path
import re,sys
lines=Path(sys.argv[1]).read_text(errors="replace").splitlines()
domain=sys.argv[2]

def uncomment(line):
    out=[]
    quote=None
    escaped=False
    for ch in line:
        if escaped:
            out.append(ch); escaped=False; continue
        if ch=="\\" and quote:
            out.append(ch); escaped=True; continue
        if quote:
            out.append(ch)
            if ch==quote: quote=None
            continue
        if ch in ("'",'"'):
            quote=ch; out.append(ch); continue
        if ch=="#": break
        out.append(ch)
    return "".join(out)

def structural(line):
    code=uncomment(line)
    out=[]
    quote=None
    escaped=False
    for ch in code:
        if escaped:
            escaped=False
            out.append(" ")
            continue
        if quote:
            if ch=="\\":
                escaped=True
            elif ch==quote:
                quote=None
            out.append(" ")
            continue
        if ch in ("'",'"'):
            quote=ch
            out.append(" ")
        else:
            out.append(ch)
    return "".join(out)

blocks=[]
current_file="(unknown include)"
inside=False
depth=0
buf=[]
start_line=0
for number,line in enumerate(lines,1):
    marker=re.match(r"^# configuration file (.+):$",line)
    if marker and not inside:
        current_file=marker.group(1)
    clean=uncomment(line)
    if not inside and re.match(r"^\s*server\s*\{",clean):
        inside=True
        depth=0
        buf=[]
        start_line=number
    if inside:
        buf.append((number,line))
        shape=structural(line)
        depth += shape.count("{")-shape.count("}")
        if depth==0:
            blocks.append((current_file,start_line,buf))
            inside=False
            buf=[]

def directives(block,pattern):
    result=[]
    for number,line in block:
        clean=uncomment(line).strip()
        if re.match(pattern,clean):
            result.append((number,clean))
    return result

candidates=[]
near=[]
for filename,start,block in blocks:
    names=[]
    for number,line in directives(block,r"server_name\b"):
        match=re.match(r"server_name\s+(.+?)\s*;",line)
        if match:
            names.extend(match.group(1).split())
    listens=directives(block,r"listen\b")
    exact=domain in names or "www."+domain in names
    related=any("sanatpish" in name for name in names)
    if exact:
        candidates.append((filename,start,block,names,listens))
    elif related:
        near.append((filename,start,block,names,listens))

print("EXACT_DOMAIN_SERVER_BLOCKS",len(candidates))
for filename,start,block,names,listens in candidates:
    listen_443=any(re.search(r"(?<!\d)443(?!\d)",line) for _,line in listens)
    print(f"SERVER_BLOCK file={filename} start_line={start} https_443={listen_443}")
    print("  server_name:", " ".join(names))
    for number,line in listens:
        print(f"  L{number}: {line}")
    for number,line in directives(block,r"(?:location\b|limit_except\b|deny\b|allow\b|auth_request\b|satisfy\b|proxy_pass\b|return\b|include\b)"):
        print(f"  L{number}: {line}")
    api=[line for _,line in directives(block,r"location\b") if re.search(r"/api(?:/|\s|$)",line)]
    generic=[line for _,line in directives(block,r"location\b") if re.search(r"location\s+(?:\^~\s+)?/\s*\{",line)]
    print("  GENERIC_API_LOCATION_PRESENT",any(re.search(r"location\s+(?:\^~\s+)?/api/\s*\{",line) for line in api))
    print("  ROOT_FALLBACK_PRESENT",bool(generic))
if not candidates:
    print("NO_EXACT_SERVER_NAME_BLOCK_FOUND")
for filename,start,block,names,listens in near:
    print(f"RELATED_SERVER_BLOCK file={filename} start_line={start} names={' '.join(names)}")
    for number,line in listens:
        print(f"  L{number}: {line}")

ports=set()
for _,_,block,_,listens in candidates:
    has_443=any(re.search(r"(?<!\d)443(?!\d)",line) for _,line in listens)
    if has_443:
        for _,line in directives(block,r"proxy_pass\b"):
            match=re.search(r"127\.0\.0\.1:(\d+)",line)
            if match: ports.add(match.group(1))
print("ACTIVE_HTTPS_APP_PORTS",",".join(sorted(ports)) if ports else "NONE")
PY

echo "===== DIRECT NODE POST (NO AUTH COOKIE; MUST BE JSON DENIAL) ====="
PORTS="$(python3 - "$DUMP" "$DOMAIN" <<'PY'
from pathlib import Path
import re,sys
lines=Path(sys.argv[1]).read_text(errors="replace").splitlines()
domain=sys.argv[2]
current=""; blocks=[]; inside=False; depth=0; buf=[]; ports=set()
def clean(s):
    return s.split("#",1)[0]
for line in lines:
    m=re.match(r"^# configuration file (.+):$",line)
    if m and not inside: current=m.group(1)
    c=clean(line)
    if not inside and re.match(r"^\s*server\s*\{",c):
        inside=True;depth=0;buf=[]
    if inside:
        buf.append(c)
        depth+=c.count("{")-c.count("}")
        if depth==0:
            text="\n".join(buf)
            names=[]
            for x in re.findall(r"(?m)^\s*server_name\s+([^;]+);",text):
                names.extend(x.split())
            listens=re.findall(r"(?m)^\s*listen\s+([^;]+);",text)
            if (domain in names or "www."+domain in names) and any(re.search(r"(?<!\d)443(?!\d)",x) for x in listens):
                ports.update(re.findall(r"127\.0\.0\.1:(30\d{2})",text))
            inside=False
for p in sorted(ports): print(p)
PY
)"
if [[ -z "$PORTS" ]]; then
  echo NO_ACTIVE_HTTPS_UPSTREAM_PORT_DISCOVERED
else
  while read -r port; do
    [[ -n "$port" ]] || continue
    body="$(mktemp /tmp/sanatpish-direct-api.XXXXXX)"
    meta="$(curl --noproxy '*' -sS --connect-timeout 3 --max-time 12 \
      -H "Host: $DOMAIN" -H 'Accept: application/json' -H 'Content-Type: application/json' \
      -X POST --data '{}' -o "$body" -w '%{http_code}|%{content_type}' \
      "http://127.0.0.1:$port/api/admin/crm/customers" || true)"
    echo "DIRECT_APP_PORT=$port META=$meta"
    head -c 300 "$body"; echo
    rm -f "$body"
  done <<< "$PORTS"
fi

echo "===== CUSTOMER HTTPS POST ROUTING (NO AUTH COOKIE) ====="
for host in "$DOMAIN" "www.$DOMAIN"; do
  body="$(mktemp /tmp/sanatpish-public-api.XXXXXX)"
  meta="$(curl --noproxy '*' -ksS --connect-timeout 3 --max-time 12 \
    --resolve "$host:443:127.0.0.1" \
    -H 'Accept: application/json' -H 'Content-Type: application/json' \
    -X POST --data '{}' -o "$body" -w '%{http_code}|%{content_type}' \
    "https://$host/api/admin/crm/customers" || true)"
  echo "PUBLIC_HOST=$host META=$meta"
  head -c 300 "$body"; echo
  rm -f "$body"
done

echo "NGINX_ACTIVE_VHOST_DIAGNOSTIC_COMPLETE"
