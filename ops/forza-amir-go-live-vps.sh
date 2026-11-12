#!/usr/bin/env bash
# Reversible CPU-only Piper Amir promotion. Customer WAV stays in RAM.
# Uses the site's existing guarded deployment; does not change Supabase/Nginx.
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
umask 077
test "$EUID" -eq 0 || { echo "Run as root" >&2; exit 1; }
exec 9>/run/lock/forza-voice-promote.lock
flock -w 8 9 || { echo "Another FORZA voice promotion is running" >&2; exit 1; }

APP=/opt/sanatpish
SITE=sanatpish-new
LIVE=forza-voice
CONFIG="$APP/.env.forza-voice"
TOKENFILE=/etc/sanatpish/forza-voice.env
MARKER=/etc/sanatpish/forza-amir-rollback-container
BACKUP="forza-voice-before-amir-$(date -u +%Y%m%d%H%M%S)"
ENV_BACKUP="/etc/sanatpish/forza-amir-env-before-$(date -u +%Y%m%d%H%M%S)"
STAGE=""
CHANGED=0
VERIFIED=0

cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  if [ "$CHANGED" = 1 ] && [ "$VERIFIED" != 1 ]; then
    echo "FORZA_AMIR_DEPLOY_FAILED: restoring old voice and config" >&2
    if [ -f "$ENV_BACKUP" ]; then
      cp -p "$ENV_BACKUP" "$CONFIG" || true
      chmod 600 "$CONFIG" || true
    fi
    if docker inspect "$BACKUP" >/dev/null 2>&1; then
      docker rm -f "$LIVE" >/dev/null 2>&1 || true
      docker rename "$BACKUP" "$LIVE" >/dev/null 2>&1 || true
      docker start "$LIVE" >/dev/null 2>&1 || true
    else
      docker start "$LIVE" >/dev/null 2>&1 || true
    fi
    docker restart "$SITE" >/dev/null 2>&1 || true
    echo "FORZA_POCKET_ROLLBACK_ATTEMPTED: verify voice and /api/health" >&2
  fi
  if [ -n "$STAGE" ]; then rm -rf -- "$STAGE"; fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

test -d "$APP/.git" && test -r "$CONFIG" && test -r "$TOKENFILE"
test "$(git -C "$APP" remote get-url origin)" = https://github.com/javanwebi/script.git
test "$(git -C "$APP" branch --show-current)" = main
git -C "$APP" diff --quiet && git -C "$APP" diff --cached --quiet || {
  echo "Tracked local edits detected; abort" >&2; exit 1;
}
test "$(docker inspect -f '{{.State.Running}}' "$SITE")" = true
test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app"}}{{.Source}}{{end}}{{end}}' "$SITE")" = "$APP"
test ! -e "$MARKER" || { echo "Existing Amir backup marker: abort" >&2; exit 1; }
test "$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)" -ge 1600000
test "$(df -Pk / | awk 'NR==2 {print $4}')" -ge 2400000
test -x /usr/local/sbin/sanatpish-deploy
git -C "$APP" check-ignore -q .env.forza-voice
if docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$SITE" | grep -q '^FORZA_VOICE_ENGINE='; then
  echo "Engine pinned in app Docker environment; cannot override by .env" >&2
  exit 1
fi
TOKEN=$(sed -n 's/^FORZA_VOICE_TOKEN=//p' "$TOKENFILE" | head -1)
test "$(printf %s "$TOKEN" | wc -c)" -eq 64
grep -Fq 'FORZA_VOICE_INTERNAL_URL=http://forza-voice:8080' "$CONFIG"
grep -Fq "FORZA_VOICE_TOKEN=$TOKEN" "$CONFIG" || {
  echo "Private voice tokens do not match; abort" >&2; exit 1;
}
NETWORK=$(docker inspect -f '{{range $n, $v := .NetworkSettings.Networks}}{{println $n}}{{end}}' "$LIVE" | grep -Fx supabase_default | head -1 || true)
if [ -z "$NETWORK" ]; then
  NETWORK=$(docker inspect -f '{{range $n, $v := .NetworkSettings.Networks}}{{println $n}}{{end}}' "$LIVE" | grep -v '^bridge$' | head -1 || true)
fi
test -n "$NETWORK"
docker inspect -f '{{range $n, $v := .NetworkSettings.Networks}}{{println $n}}{{end}}' "$SITE" | grep -Fxq "$NETWORK"

echo "[1/5] Official backward-compatible source deployment while old Pocket runs."
/usr/local/sbin/sanatpish-deploy
git -C "$APP" fetch --quiet origin main
REV=$(git -C "$APP" rev-parse origin/main)
test "$(git -C "$APP" rev-parse HEAD)" = "$REV"
STAGE=$(mktemp -d /opt/forza-amir-release.XXXXXXXX)
git -C "$APP" archive --format=tar "$REV" Dockerfile.forza-amir scripts/forza_amir_voice_http.py | tar -xf - -C "$STAGE"
IMAGE="sanatpish/forza-amir:release-$(printf %.12s "$REV")"
echo "[2/5] Build standalone Amir image while Pocket is still live."
docker build --pull=false -t "$IMAGE" -f "$STAGE/Dockerfile.forza-amir" "$STAGE" >/dev/null

echo "[3/5] Back up voice container and private app config before switch."
cp -p "$CONFIG" "$ENV_BACKUP"
chmod 600 "$ENV_BACKUP"
python3 - "$CONFIG" <<'PY'
import sys
from pathlib import Path
p=Path(sys.argv[1])
rows=[x for x in p.read_text().splitlines() if not x.startswith("FORZA_VOICE_ENGINE=")]
rows.append("FORZA_VOICE_ENGINE=amir")
p.write_text("\n".join(rows)+"\n")
p.chmod(0o600)
PY
CHANGED=1
docker stop -t 15 "$LIVE" >/dev/null
docker rename "$LIVE" "$BACKUP"
docker run -d --name "$LIVE" --restart unless-stopped \
  --network "$NETWORK" --network-alias "$LIVE" \
  --cpus=2 --cpu-shares=128 --memory=1280m --memory-swap=1280m \
  --pids-limit=128 --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --env-file "$TOKENFILE" -e PORT=8080 "$IMAGE" >/dev/null
echo "[4/5] Confirm Amir identity on the private Docker network."
READY=0
for i in $(seq 1 60); do
  if docker exec "$SITE" node -e \
    'fetch("http://forza-voice:8080/health",{signal:AbortSignal.timeout(2500)}).then(async r=>process.exit(r.ok&&(await r.json()).voice==="piper-amir-medium"?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1; then
    READY=1; break
  fi
  test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true || break
  sleep 2
done
test "$READY" = 1 || { docker logs --tail 40 "$LIVE" >&2; exit 1; }
docker restart "$SITE" >/dev/null
UP=0
for i in $(seq 1 45); do
  if curl -fsS --max-time 4 http://127.0.0.1:3001/api/health 2>/dev/null | grep -q '"database":"ok"'; then
    UP=1; break
  fi
  sleep 2
done
test "$UP" = 1 || { echo "App health failed after switch" >&2; exit 1; }

echo "[5/5] Verify streamed WAV, fallback and Amir greeting in memory."
python3 - <<'PY'
import json,struct,time,urllib.request
base="http://127.0.0.1:3001"
payload=json.dumps({"text":"سلام، من فورزا هستم. راهنمایی انتخاب قطعات صنعتی آماده است."},ensure_ascii=False).encode()
def request(path,data=None):
    req=urllib.request.Request(base+path,data=data,
        headers={"Content-Type":"application/json"} if data is not None else {})
    t=time.monotonic()
    with urllib.request.urlopen(req,timeout=40) as r:
        return r.status,r.headers.get("X-Forza-Voice"),r.read(),int((time.monotonic()-t)*1000)
status,voice,framed,elapsed=request("/api/ai/forza-speech-stream",payload)
assert status==200 and voice=="piper-amir-medium"
assert len(framed)>48 and struct.unpack("<I",framed[:4])[0]==len(framed)-4
wav=framed[4:]
assert wav[:4]==b"RIFF" and wav[8:12]==b"WAVE"
assert struct.unpack("<I",wav[24:28])[0]==22050
print("FORZA_AMIR_LIVE_STREAM status=200 frames=1 ms=%d wav_bytes=%d"%(elapsed,len(wav)))
status,voice,wav,elapsed=request("/api/ai/forza-speech",payload)
assert status==200 and voice=="piper-amir-medium"
assert wav[:4]==b"RIFF" and struct.unpack("<I",wav[24:28])[0]==22050
print("FORZA_AMIR_LIVE_FALLBACK status=200 ms=%d"%elapsed)
status,voice,wav,elapsed=request("/forza-greeting-bootstrap.wav")
assert status==200 and wav[:4]==b"RIFF"
assert struct.unpack("<I",wav[24:28])[0]==22050
print("FORZA_AMIR_LIVE_GREETING status=200 ms=%d wav_bytes=%d"%(elapsed,len(wav)))
PY
test "$(docker inspect -f '{{.State.Running}}' "$SITE")" = true
test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
test "$(docker inspect -f '{{.State.OOMKilled}}' "$LIVE")" = false
printf 'BACKUP=%s\nENV_BACKUP=%s\nREVISION=%s\n' "$BACKUP" "$ENV_BACKUP" "$REV" > "$MARKER"
chmod 600 "$MARKER"
VERIFIED=1
echo "FORZA_AMIR_LIVE_OK revision=$REV generated_wav_saved=0"
echo "Pocket backup stopped and retained: $BACKUP"
echo "Rollback: sudo bash /opt/sanatpish/ops/forza-amir-rollback-vps.sh"
