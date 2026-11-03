#!/usr/bin/env bash
# Called ONLY by the pinned main blue/green release, after healthy website canary.
# Refreshes the private Piper Nima image if its *source* changed.
# The previous voice container is retained, stopped, for an explicit rollback.
set -Eeuo pipefail
umask 077
export GIT_TERMINAL_PROMPT=0

fail() { printf 'FORZA_NIMA_PINNED_DEPLOY_ABORT %s\n' "$*" >&2; exit 1; }
test "$EUID" -eq 0 || fail "root_required"
test "$#" -eq 4 || fail "expected_sha_site_network_stage"
SHA="$1"
SITE="$2"
NETWORK="$3"
STAGE="$4"
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]] || fail "invalid_sha"
[[ "$SITE" =~ ^sanatpish-unified-live-[A-Za-z0-9-]+$ ]] || fail "unexpected_site_container"
[[ "$NETWORK" =~ ^[A-Za-z0-9_.-]+$ ]] || fail "unexpected_network"
[[ "$STAGE" == /opt/sanatpish-unified-stage-* ]] || fail "unexpected_stage"
test -f "$STAGE/Dockerfile.forza-nima" && test -f "$STAGE/scripts/forza_nima_voice_http.py" || fail "pinned_voice_source_missing"
test "$(git -C /opt/sanatpish cat-file -t "$SHA")" = commit || fail "unavailable_release_sha"

exec 8>/run/lock/forza-voice-promote.lock
flock -w 15 8 || fail "voice_deploy_lock_busy"
LIVE=forza-voice
SECRETS=/etc/sanatpish/forza-voice.env
test -r "$SECRETS" && test ! -L "$SECRETS" || fail "voice_secrets_unavailable"
test "$(docker inspect "$SITE" --format '{{.State.Running}}')" = true || fail "site_canary_not_running"
test "$(docker inspect "$LIVE" --format '{{.State.Running}}')" = true || fail "private_voice_not_running"
docker inspect "$LIVE" --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' | grep -Fxq "$NETWORK" || fail "voice_not_on_site_network"
docker inspect "$SITE" --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' | grep -Fxq "$NETWORK" || fail "site_not_on_voice_network"

# Do not switch away from another deliberate voice model on an unverified host.
docker exec "$SITE" node -e '
fetch("http://forza-voice:8080/health",{signal:AbortSignal.timeout(6000)})
.then(async r=>{const j=await r.json();process.exit(r.ok&&j.voice==="piper-nima-gyro-medium"?0:1)})
.catch(()=>process.exit(1))' || fail "current_voice_identity_is_not_nima"

FINGERPRINT="$(cd "$STAGE" && sha256sum Dockerfile.forza-nima scripts/forza_nima_voice_http.py | sha256sum | awk '{print $1}')"
LIVE_FINGERPRINT="$(docker inspect "$LIVE" --format '{{index .Config.Labels "com.sanatpish.forza.source-sha256"}}' 2>/dev/null || true)"
if test "$FINGERPRINT" = "$LIVE_FINGERPRINT"; then
  echo "FORZA_NIMA_SOURCE_UNCHANGED fingerprint=$FINGERPRINT retained=1"
  exit 0
fi

test "$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)" -ge 1200000 || fail "insufficient_available_memory_for_voice_canary"
test "$(df -Pk / | awk 'NR==2{print $4}')" -ge 1800000 || fail "insufficient_free_disk_for_private_voice_build"
if docker ps --format '{{.Names}}' | grep -Fxq forza-pocket-teacher-eval; then fail "voice_teacher_job_running"; fi
STAMP="$(date -u +%Y%m%d%H%M%S)-$BASHPID"
IMAGE="sanatpish/forza-nima:release-$(printf '%.12s' "$SHA")-$(printf '%.12s' "$FINGERPRINT")"
CANARY="forza-nima-verify-$STAMP"
BACKUP="forza-voice-backup-$STAMP"
OLD_RENAMED=0
PROMOTED=0

cleanup() {
  rc=$?
  trap - EXIT
  set +e
  if test "$OLD_RENAMED" = 1 && test "$PROMOTED" != 1; then
    echo "FORZA_NIMA_PINNED_ROLLBACK_START" >&2
    docker rm -f "$LIVE" >/dev/null 2>&1 || true
    if docker inspect "$BACKUP" >/dev/null 2>&1; then
      docker rename "$BACKUP" "$LIVE" || true
      docker start "$LIVE" >/dev/null 2>&1 || true
    fi
    echo "FORZA_NIMA_PINNED_ROLLBACK_ATTEMPTED" >&2
  fi
  docker rm -f "$CANARY" >/dev/null 2>&1 || true
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "===== BUILD PINNED PRIVATE NIMA WITHOUT INTERRUPTING CUSTOMERS ====="
# Reuse verified already downloaded Piper weights when possible; source-only
# updates then work even if international model registries are inaccessible.
EXPECTED_MODEL_SHA="$(sed -n 's/^checksum="\([a-f0-9]\{64\}\)"/\1/p' "$STAGE/Dockerfile.forza-nima" | head -1)"
EXPECTED_PIPER_VERSION="$(sed -n 's/.*piper-tts==\([0-9.]*\).*/\1/p' "$STAGE/Dockerfile.forza-nima" | head -1)"
test -n "$EXPECTED_MODEL_SHA" && test -n "$EXPECTED_PIPER_VERSION" || fail "voice_pins_missing"
LIVE_MODEL_SHA="$(docker exec "$LIVE" sha256sum /app/voice/fa_IR-gyro-medium.onnx 2>/dev/null | awk '{print $1}' || true)"
LIVE_PIPER_VERSION="$(docker exec "$LIVE" python -c 'from importlib.metadata import version;print(version("piper-tts"))' 2>/dev/null || true)"
LIVE_IMAGE_ID="$(docker inspect "$LIVE" --format '{{.Image}}')"
if test "$LIVE_MODEL_SHA" = "$EXPECTED_MODEL_SHA" && test "$LIVE_PIPER_VERSION" = "$EXPECTED_PIPER_VERSION"; then
  echo "FORZA_NIMA_OFFLINE_BUILD using_verified_local_model=1"
  docker build --pull=false \
    --build-arg "FORZA_BASE_IMAGE=$LIVE_IMAGE_ID" \
    --label "org.opencontainers.image.revision=$SHA" \
    --label "com.sanatpish.forza.source-sha256=$FINGERPRINT" \
    -t "$IMAGE" -f - "$STAGE" <<'DOCKERFILE'
ARG FORZA_BASE_IMAGE
FROM ${FORZA_BASE_IMAGE}
COPY scripts/forza_nima_voice_http.py /app/scripts/forza_nima_voice_http.py
DOCKERFILE
else
  echo "FORZA_NIMA_FULL_PINNED_BUILD required_model_or_engine_update=1"
  docker build --pull=false \
    --label "org.opencontainers.image.revision=$SHA" \
    --label "com.sanatpish.forza.source-sha256=$FINGERPRINT" \
    -t "$IMAGE" -f "$STAGE/Dockerfile.forza-nima" "$STAGE"
fi

echo "===== START PRIVATE NIMA CANARY; NO HOST PORT ====="
docker run -d --name "$CANARY" --restart no \
  --network "$NETWORK" --network-alias "$CANARY" \
  --cpus=2 --cpu-shares=128 --memory=1280m --memory-swap=1280m \
  --pids-limit=128 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --env-file "$SECRETS" -e PORT=8080 "$IMAGE" >/dev/null
READY=0
for i in $(seq 1 75); do
  if docker exec -e "FORZA_CANARY_HOST=$CANARY" "$SITE" node -e '
    fetch("http://"+process.env.FORZA_CANARY_HOST+":8080/health",{signal:AbortSignal.timeout(2500)})
    .then(async r=>{const j=await r.json();process.exit(r.ok&&j.voice==="piper-nima-gyro-medium"?0:1)})
    .catch(()=>process.exit(1))' >/dev/null 2>&1; then READY=1; break; fi
  test "$(docker inspect "$CANARY" --format '{{.State.Running}}')" = true || break
  sleep 2
done
test "$READY" = 1 || { docker logs --tail 30 "$CANARY" >&2 || true; fail "private_voice_canary_health_failed"; }

echo "===== VERIFY AUTHENTICATED WAV IN MEMORY, NO SAVED AUDIO ====="
docker exec -i "$CANARY" python3 - <<'PY'
import json,os,struct,urllib.request
token=os.environ['FORZA_VOICE_TOKEN']
phrase='سلام، لطفاً مشخصات بلبرینگ شش هزار و دویست و دو را بررسی کن.'
body=json.dumps({'text':phrase},ensure_ascii=False).encode()
req=urllib.request.Request('http://127.0.0.1:8080/speak-stream',data=body,headers={
  'Content-Type':'application/json','X-Forza-Voice-Token':token})
with urllib.request.urlopen(req,timeout=50) as r:
    wav=r.read()
    assert r.status==200 and r.headers.get('X-Forza-Voice')=='piper-nima-gyro-medium'
    assert r.headers.get('X-Forza-Queue-Ms') is not None
    assert r.headers.get('X-Forza-Inference-Ms') is not None
assert len(wav)>48 and struct.unpack('<I',wav[:4])[0]==len(wav)-4
assert wav[4:8]==b'RIFF' and wav[12:16]==b'WAVE'
print('FORZA_NIMA_PINNED_CANARY_PASS bytes=%d queue_ms=available synthesis_ms=available'%(len(wav)-4))
PY
test "$(docker inspect "$CANARY" --format '{{.State.OOMKilled}}')" = false || fail "voice_canary_oom"

echo "===== SWITCH PRIVATE VOICE, RETAIN OLD CONTAINER ====="
docker stop -t 12 "$LIVE" >/dev/null
docker rename "$LIVE" "$BACKUP"
OLD_RENAMED=1
docker run -d --name "$LIVE" --restart unless-stopped \
  --network "$NETWORK" --network-alias "$LIVE" \
  --cpus=2 --cpu-shares=128 --memory=1280m --memory-swap=1280m \
  --pids-limit=128 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --env-file "$SECRETS" -e PORT=8080 "$IMAGE" >/dev/null

READY=0
for i in $(seq 1 70); do
  if docker exec "$SITE" node -e '
    fetch("http://forza-voice:8080/health",{signal:AbortSignal.timeout(2500)})
    .then(async r=>{const j=await r.json();process.exit(r.ok&&j.voice==="piper-nima-gyro-medium"?0:1)})
    .catch(()=>process.exit(1))' >/dev/null 2>&1; then READY=1; break; fi
  test "$(docker inspect "$LIVE" --format '{{.State.Running}}' 2>/dev/null)" = true || break
  sleep 2
done
test "$READY" = 1 || fail "promoted_voice_unhealthy"
test "$(docker inspect "$LIVE" --format '{{.State.OOMKilled}}')" = false || fail "promoted_voice_oom"
docker exec "$SITE" node -e '
fetch("http://127.0.0.1:3000/api/ai/forza-voice-info",{signal:AbortSignal.timeout(8000)})
.then(async r=>{const j=await r.json();process.exit(r.ok&&j.voice==="piper-nima-gyro-medium"&&j.incrementalSpeech===true?0:1)})
.catch(()=>process.exit(1))' || fail "site_and_private_voice_contract_mismatch"

PROMOTED=1
echo "FORZA_NIMA_PINNED_RELEASE_OK revision=$SHA fingerprint=$FINGERPRINT rollback_container=$BACKUP audio_saved=0"
