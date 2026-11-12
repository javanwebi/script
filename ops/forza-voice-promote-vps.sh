#!/usr/bin/env bash
# Promote the already benchmarked same-voice Pocket TTS image on a VPS.
# Website and Supabase remain untouched. A stopped previous voice container
# is retained; any failed health or speech smoke test rolls back automatically.
set -Eeuo pipefail
umask 077
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
exec 9>/run/lock/forza-voice-promote.lock
flock -w 5 9 || { echo "Another FORZA voice switch is running" >&2; exit 1; }

test "${EUID}" -eq 0 || { echo "Run using sudo" >&2; exit 1; }
APP=/opt/sanatpish
LIVE=forza-voice
IMAGE=sanatpish/forza-voice:resident-test-cbfaa2a11ffe
TOKENFILE=/etc/sanatpish/forza-voice.env
ROLLBACK_MARKER=/etc/sanatpish/forza-voice-rollback-container
BACKUP="forza-voice-previous-$(date -u +%Y%m%d%H%M%S)"
CHANGED=0
VERIFIED=0
TEMP=$(mktemp -d /tmp/forza-promote.XXXXXXXX)

on_exit() {
  rc=$1
  trap - EXIT ERR INT TERM
  if [ "$CHANGED" = 1 ] && [ "$VERIFIED" != 1 ]; then
    echo "FORZA_PROMOTE_FAILED: restoring the old voice worker" >&2
    if docker container inspect "$BACKUP" >/dev/null 2>&1; then
      docker rm -f "$LIVE" >/dev/null 2>&1 || true
      docker rename "$BACKUP" "$LIVE" || true
      docker start "$LIVE" >/dev/null 2>&1 || true
    elif docker container inspect "$LIVE" >/dev/null 2>&1; then
      docker start "$LIVE" >/dev/null 2>&1 || true
    fi
    echo "FORZA_ROLLBACK_ATTEMPTED: check docker logs forza-voice" >&2
  fi
  rm -rf -- "$TEMP"
  exit "$rc"
}
trap 'on_exit $?' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

test -d "$APP/.git" || { echo "Missing application checkout" >&2; exit 1; }
test "$(git -C "$APP" remote get-url origin)" = https://github.com/javanwebi/script.git
test -r "$TOKENFILE"
test ! -e "$ROLLBACK_MARKER" || {
  echo "Previous FORZA rollback backup already exists. Resolve it before promoting again." >&2
  exit 1
}
test "$(docker inspect --format '{{.State.Running}}' "$LIVE")" = true
test "$(docker inspect --format '{{.State.Running}}' sanatpish-new)" = true
docker image inspect "$IMAGE" >/dev/null || {
  echo "Benchmark image not found locally: $IMAGE. Run the benchmark first." >&2
  exit 1
}
ORIG_IMAGE_ID=$(docker inspect --format '{{.Image}}' "$LIVE")
NEW_IMAGE_ID=$(docker image inspect --format '{{.Id}}' "$IMAGE")
test "$ORIG_IMAGE_ID" != "$NEW_IMAGE_ID" || { echo "Already running the benchmarked image."; exit 0; }

NETWORK=$(docker inspect --format '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -Fx supabase_default | head -1 || true)
if [ -z "$NETWORK" ]; then
  NETWORK=$(docker inspect --format '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -v '^bridge$' | head -1 || true)
fi
test -n "$NETWORK" || { echo "Missing private Docker network" >&2; exit 1; }
TOKEN=$(sed -n 's/^FORZA_VOICE_TOKEN=//p' "$TOKENFILE" | head -1)
test "${#TOKEN}" -eq 64 || { echo "Missing voice token" >&2; exit 1; }
# The existing Express proxy must already be configured. No app restart needed.
docker exec sanatpish-new node -e '
const fs=require("fs");
const s=fs.readFileSync("/app/.env.forza-voice","utf8");
if(!s.includes("FORZA_VOICE_INTERNAL_URL=http://forza-voice:8080")) process.exit(1);
'
# Make sure the old worker is healthy before disrupting it.
docker exec sanatpish-new node -e '
fetch("http://forza-voice:8080/health",{signal:AbortSignal.timeout(4000)})
  .then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))
'

echo "[1/3] Switching ONLY the voice container (short voice-only interruption)."
CHANGED=1
docker stop -t 15 "$LIVE" >/dev/null
docker rename "$LIVE" "$BACKUP"
docker run -d --name "$LIVE" --network "$NETWORK" --network-alias "$LIVE" \
  --restart unless-stopped \
  --memory 1536m --memory-swap 1536m --cpus 1.0 --pids-limit 128 \
  --env-file "$TOKENFILE" -e PORT=8080 -e FORZA_TTS_RESIDENT_ACOUSTIC=1 \
  "$IMAGE" >/dev/null

echo "[2/3] Checking health through the actual app container."
ready=0
for i in $(seq 1 45); do
  if docker exec sanatpish-new node -e '
    fetch("http://forza-voice:8080/health",{signal:AbortSignal.timeout(3000)})
      .then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))
  ' >/dev/null 2>&1; then
    ready=1; break
  fi
  if [ "$(docker inspect --format '{{.State.Running}}' "$LIVE")" != true ]; then break; fi
  sleep 2
done
test "$ready" -eq 1 || { docker logs --tail 60 "$LIVE" >&2; exit 1; }

echo "[3/3] Testing real Persian synthesis through the live Express proxy."
http=$(curl -sS --max-time 48 -D "$TEMP/headers" -o "$TEMP/voice.wav" \
  -w '%{http_code}' -H 'Content-Type: application/json' \
  --data '{"text":"فورزا در صنعت پیش برای پاسخگویی به مشتریان فعال است."}' \
  http://127.0.0.1:3001/api/ai/forza-speech)
backend=$(awk 'tolower($1)=="x-forza-voice-backend:" {gsub("\r","",$2); print $2}' "$TEMP/headers" | tail -1)
bytes=$(wc -c < "$TEMP/voice.wav")
magic=$(head -c 4 "$TEMP/voice.wav" || true)
echo "FORZA_PROMOTE_SMOKE status=$http backend=$backend bytes=$bytes"
test "$http" = 200 && test "$backend" = private-service && test "$magic" = RIFF && test "$bytes" -gt 1000
test "$(docker inspect --format '{{.State.OOMKilled}}' "$LIVE")" = false
test "$(docker inspect --format '{{.State.Running}}' "$LIVE")" = true

VERIFIED=1
printf '%s\n' "$BACKUP" > "$ROLLBACK_MARKER"
chmod 600 "$ROLLBACK_MARKER"
echo "FORZA_RESIDENT_LIVE_OK"
echo "Backup container retained stopped: $BACKUP"
echo "No Node app, Nginx or Supabase service was restarted."
echo "To restore manually, use the rollback script in the same GitHub repository."
