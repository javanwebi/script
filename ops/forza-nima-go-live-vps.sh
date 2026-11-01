#!/usr/bin/env bash
# Promote the reviewed Piper Nima voice while retaining Pocket for rollback.
# Site and private TTS only; Supabase and Nginx configurations are untouched.
set -Eeuo pipefail
umask 077
export GIT_TERMINAL_PROMPT=0
fail(){ printf 'FORZA_NIMA_DEPLOY_ABORT %s\n' "$*" >&2; exit 1; }
test "$EUID" -eq 0 || fail "use_sudo"
exec 9>/run/lock/forza-voice-promote.lock
flock -w 8 9 || fail "voice_maintenance_lock_busy"
APP=/opt/sanatpish
SITE=sanatpish-new
LIVE=forza-voice
CONFIG="$APP/.env.forza-voice"
SECRETS=/etc/sanatpish/forza-voice.env
MARKER=/etc/sanatpish/forza-nima-rollback-container
PREV="forza-voice-before-nima-$(date -u +%Y%m%d%H%M%S)"
PREV_ENV="/etc/sanatpish/forza-nima-env-before-$(date -u +%Y%m%d%H%M%S)"
STAGE=""
CHANGED=0
PROMOTED=0

restore_if_needed(){
  local rc=$?
  trap - EXIT INT TERM
  if [ "$CHANGED" = 1 ] && [ "$PROMOTED" = 0 ]; then
    echo "FORZA_NIMA_FAILED_ROLLING_BACK" >&2
    if [ -f "$PREV_ENV" ]; then cp -p "$PREV_ENV" "$CONFIG" || true; fi
    if docker inspect "$PREV" >/dev/null 2>&1; then
      docker rm -f "$LIVE" >/dev/null 2>&1 || true
      docker rename "$PREV" "$LIVE" >/dev/null 2>&1 || true
      docker start "$LIVE" >/dev/null 2>&1 || true
    fi
    docker restart "$SITE" >/dev/null 2>&1 || true
    echo "FORZA_NIMA_ROLLBACK_ATTEMPTED_CHECK_SITE_HEALTH" >&2
  fi
  if [ -n "$STAGE" ]; then rm -rf -- "$STAGE"; fi
  exit "$rc"
}
trap restore_if_needed EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for c in git docker curl python3 flock; do command -v "$c" >/dev/null || fail "missing_tool_$c"; done
test -d "$APP/.git" && test -r "$CONFIG" && test -r "$SECRETS" || fail "missing_repo_or_private_env"
test "$(git -C "$APP" remote get-url origin)" = https://github.com/javanwebi/script.git || fail "unexpected_git_remote"
test "$(git -C "$APP" branch --show-current)" = main || fail "checkout_not_main"
git -C "$APP" diff --quiet && git -C "$APP" diff --cached --quiet || fail "uncommitted_changes"
for f in "$MARKER" /etc/sanatpish/forza-amir-rollback-container; do
  test ! -e "$f" || fail "existing_voice_rollback_marker"
done
test ! -L "$CONFIG" && test ! -L "$SECRETS" || fail "symlink_env_rejected"
if docker ps --format '{{.Names}}' | grep -Fxq forza-pocket-teacher-eval; then
  fail "teacher_dataset_generation_running"
fi
for c in "$SITE" "$LIVE"; do
  test "$(docker inspect -f '{{.State.Running}}' "$c")" = true || fail "not_running_$c"
done
test "$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)" -ge 1800000 || fail "insufficient_free_memory"
test "$(df -Pk / | awk 'NR==2{print $4}')" -ge 2400000 || fail "insufficient_free_disk"
test -x /usr/local/sbin/sanatpish-deploy || fail "deployment_tool_missing"
git -C "$APP" check-ignore -q .env.forza-voice || fail "private_config_must_be_gitignored"
if docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$SITE" | grep -q '^FORZA_VOICE_ENGINE='; then
  fail "engine_is_pinned_in_container_environment"
fi
grep -Fxq 'FORZA_VOICE_INTERNAL_URL=http://forza-voice:8080' "$CONFIG" || fail "wrong_voice_url"
TOKEN=$(sed -n 's/^FORZA_VOICE_TOKEN=//p' "$SECRETS" | head -1)
test "$(printf %s "$TOKEN" | wc -c)" -eq 64 || fail "invalid_private_token"
grep -Fxq "FORZA_VOICE_TOKEN=$TOKEN" "$CONFIG" || fail "private_token_mismatch"
docker exec "$SITE" node -e 'fetch("http://forza-voice:8080/health",{signal:AbortSignal.timeout(5000)}).then(async r=>{let j=await r.json();process.exit(r.ok&&j.voice==="pocket-farsi-v2"?0:1)}).catch(()=>process.exit(1))' || fail "current_voice_not_verified_pocket"
NETWORK=$(docker inspect -f '{{range $name,$conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -Fx supabase_default | head -1 || true)
if [ -z "$NETWORK" ]; then
  NETWORK=$(docker inspect -f '{{range $name,$conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -v '^bridge$' | head -1 || true)
fi
test -n "$NETWORK" || fail "no_private_docker_network"
docker inspect -f '{{range $name,$conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$SITE" | grep -Fxq "$NETWORK" || fail "site_not_connected_to_voice_network"

# A previous manual 'git pull' can advance the bind-mounted checkout
# without restarting the running Node process or rebuilding dist/. The normal
# deployment tool then prints 'Already current' even though the API is stale.
# Only accept real JSON from the actual Node port; HTML SPA fallback is NOT OK.
voice_info_ready() {
  curl --noproxy '*' -fsS --max-time 6 \
    -H 'Accept: application/json' \
    http://127.0.0.1:3001/api/ai/forza-voice-info 2>/dev/null |
    python3 -c 'import json,sys
try:
    x=json.loads(sys.stdin.read())
except (ValueError, UnicodeError):
    sys.exit(2)
sys.exit(0 if x.get("voice")=="pocket-farsi-v2" and x.get("incrementalSpeech") is False else 3)'
}

echo "[1/5] Deploy the compatible source while Pocket is still live."
/usr/local/sbin/sanatpish-deploy
git -C "$APP" fetch --quiet origin main
REV=$(git -C "$APP" rev-parse origin/main)
test "$(git -C "$APP" rev-parse HEAD)" = "$REV" || fail "application_revision_mismatch"
if ! voice_info_ready; then
  echo "FORZA_NIMA_STALE_APP_DETECTED: checkout matches main but API is older."
  echo "Rebuilding the current revision in an isolated directory with full lint/build validation."
  test -r "$APP/ops/sanatpish-deploy.sh" || fail "current_revision_rebuild_tool_missing"
  SANATPISH_DEPLOY_REBUILD_CURRENT=1 bash "$APP/ops/sanatpish-deploy.sh"
fi
voice_info_ready || fail "voice_info_route_missing_after_checked_rebuild"
echo "FORZA_NIMA_APP_READY api=pocket-farsi-v2 revision=$REV"

STAGE=$(mktemp -d /opt/forza-nima-release.XXXXXXXX)
git -C "$APP" archive --format=tar "$REV" Dockerfile.forza-nima scripts/forza_nima_voice_http.py | tar -xf - -C "$STAGE"
IMAGE="sanatpish/forza-nima:release-$(printf %.12s "$REV")"
echo "[2/5] Build the pinned Nima model without changing live voice."
docker build --pull=false -t "$IMAGE" -f "$STAGE/Dockerfile.forza-nima" "$STAGE" >/dev/null

echo "[3/5] Save rollback copy and switch private voice engine."
cp -p "$CONFIG" "$PREV_ENV"
chmod 600 "$PREV_ENV"
CHANGED=1
python3 - "$CONFIG" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
rows=[line for line in p.read_text().splitlines() if not line.startswith('FORZA_VOICE_ENGINE=')]
rows.append('FORZA_VOICE_ENGINE=nima')
p.write_text('\n'.join(rows)+'\n')
p.chmod(0o600)
PY
docker stop -t 15 "$LIVE" >/dev/null
docker rename "$LIVE" "$PREV"
docker run -d --name "$LIVE" --restart unless-stopped \
  --network "$NETWORK" --network-alias "$LIVE" \
  --cpus=2 --cpu-shares=128 --memory=1280m --memory-swap=1280m \
  --pids-limit=128 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --env-file "$SECRETS" -e PORT=8080 "$IMAGE" >/dev/null

echo "[4/5] Check Nima identity and restart site with Nima config."
READY=0
for i in $(seq 1 60); do
  if docker exec "$SITE" node -e 'fetch("http://forza-voice:8080/health",{signal:AbortSignal.timeout(2500)}).then(async r=>{let j=await r.json();process.exit(r.ok&&j.voice==="piper-nima-gyro-medium"?0:1)}).catch(()=>process.exit(1))' >/dev/null 2>&1; then READY=1; break; fi
  test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true || break
  sleep 2
done
test "$READY" = 1 || fail "nima_health_failed"
docker restart "$SITE" >/dev/null
UP=0
for i in $(seq 1 60); do
  if curl --noproxy '*' -fsS --max-time 4 http://127.0.0.1:3001/api/health 2>/dev/null | grep -q '"database":"ok"'; then UP=1; break; fi
  sleep 2
done
test "$UP" = 1 || fail "site_not_healthy_after_voice_switch"

echo "[5/5] Smoke test voice info, greeting, full WAV and framed speech."
python3 - <<'PY'
import json, struct, urllib.request
base='http://127.0.0.1:3001'
def call(path,data=None):
    body=json.dumps(data,ensure_ascii=False).encode() if data is not None else None
    req=urllib.request.Request(base+path,data=body,headers={'Content-Type':'application/json'} if body else {})
    with urllib.request.urlopen(req,timeout=45) as response:
        return response.status,response.headers,response.read()
status,headers,data=call('/api/ai/forza-voice-info')
assert status==200 and json.loads(data)['voice']=='piper-nima-gyro-medium'
assert json.loads(data)['incrementalSpeech'] is False
assert json.loads(data)['wholeAnswerWav'] is True
status,headers,greeting=call('/forza-greeting-bootstrap.wav')
assert status==200 and greeting[:4]==b'RIFF' and greeting[8:12]==b'WAVE'
assert struct.unpack('<I',greeting[24:28])[0]==22050
print('FORZA_NIMA_GREETING_PASS bytes=%d'%len(greeting))
phrase={'text':'سلام من فورزا هستم و برای انتخاب قطعات صنعتی به شما کمک می‌کنم.'}
status,headers,wav=call('/api/ai/forza-speech',phrase)
assert status==200 and headers.get('X-Forza-Voice')=='piper-nima-gyro-medium'
assert wav[:4]==b'RIFF' and wav[8:12]==b'WAVE'
status,headers,frame=call('/api/ai/forza-speech-stream',phrase)
assert status==200 and headers.get('X-Forza-Voice')=='piper-nima-gyro-medium'
assert len(frame)>48 and struct.unpack('<I',frame[:4])[0]==len(frame)-4 and frame[4:8]==b'RIFF'
print('FORZA_NIMA_LIVE_AUDIO_PASS greeting=1 wav=1 framed_wav=1 whole_answer_wav=1')
PY
test "$(docker inspect -f '{{.State.OOMKilled}}' "$LIVE")" = false || fail "voice_out_of_memory"
printf 'BACKUP=%s\nENV_BACKUP=%s\nREVISION=%s\n' "$PREV" "$PREV_ENV" "$REV" > "$MARKER"
chmod 600 "$MARKER"
PROMOTED=1
echo "FORZA_NIMA_LIVE_OK revision=$REV private_speech_only=1 customer_audio_saved=0"
echo "Original Pocket backup retained stopped: $PREV"
echo "Rollback: sudo bash /opt/sanatpish/ops/forza-nima-rollback-vps.sh"
