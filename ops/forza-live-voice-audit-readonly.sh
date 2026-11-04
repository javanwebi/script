#!/usr/bin/env bash
# Read-only FORZA release/resource/config audit. Prints no API keys, audio,
# customer transcripts or environment file contents; NEVER alters Docker.
set -Eeuo pipefail
APP="${APP:-/opt/sanatpish}"
cd "$APP"
echo "===== CHECKOUT (not necessarily deployed) ====="
git rev-parse HEAD
git status --short
echo "===== REMOTE MAIN (no checkout/fetch mutation) ====="
timeout 12s git ls-remote origin refs/heads/main || echo REMOTE_MAIN_UNAVAILABLE

echo "===== HOST ====="
date -Is
uname -a
nproc
free -h
df -h /
echo "===== GPU (optional) ====="
if command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi --query-gpu=name,memory.total --format=csv,noheader || true
else
  echo NVIDIA_GPU_TOOL_UNAVAILABLE
fi

echo "===== CONTAINERS: IDENTIFIERS ONLY ====="
docker ps --format '{{.Names}} image={{.Image}} status={{.Status}}' \
  | grep -E '(^sanatpish|^forza|^supabase-db)' || true
echo "===== CPU/RAM SNAPSHOT ====="
docker stats --no-stream --format '{{.Name}} cpu={{.CPUPerc}} mem={{.MemUsage}}' \
  | grep -E '(^sanatpish|^forza|^supabase-db)' || true

echo "===== HTTPS ON CORRECT DOMAIN/SNI (certificate verification ENABLED) ====="
curl --noproxy '*' --resolve 'www.sanatpish.com:443:127.0.0.1' \
  -fsS --connect-timeout 5 --max-time 12 \
  https://www.sanatpish.com/api/health || echo DOMAIN_HTTPS_HEALTH_FAILED
echo
echo "===== VOICE & STT METADATA (no keys) ====="
for endpoint in /api/ai/forza-voice-info /api/ai/forza-stt-info; do
  printf '%s ' "$endpoint"
  curl --noproxy '*' --resolve 'www.sanatpish.com:443:127.0.0.1' \
    -fsS --connect-timeout 5 --max-time 12 \
    "https://www.sanatpish.com$endpoint" || echo ENDPOINT_UNAVAILABLE
  echo
done

echo "===== ACTIVE CONTAINER RELEASE ENV (only SHA, never full env) ====="
while IFS= read -r name; do
  [[ "$name" == sanatpish* ]] || continue
  printf '%s ' "$name"
  docker exec "$name" sh -c 'printf "revision="; printenv SANATPISH_RELEASE_SHA || printf "unknown\\n"' \
    2>/dev/null || echo CONTAINER_ENV_UNAVAILABLE
done < <(docker ps --format '{{.Names}}')

echo "===== PRIVATE VOICE METADATA/COUNTS ONLY (last 30m) ====="
while IFS= read -r name; do
  [[ "$name" == *forza* ]] || continue
  printf 'container=%s\n' "$name"
  docker logs --since 30m "$name" 2>&1 \
    | grep -E '^\\[FORZA_NIMA_(PRODUCTION|REJECT)\\]|^\\[FORZA Nima\\] generation_error=' \
    | tail -40 || true
done < <(docker ps --format '{{.Names}}')
echo "FORZA_READONLY_AUDIT_COMPLETE"
