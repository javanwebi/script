#!/usr/bin/env bash
# Safe CPU Piper Nima private-API test; leaves production containers unchanged.
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
umask 077
test "$EUID" -eq 0 || { echo "Run as root" >&2; exit 1; }
APP=/opt/sanatpish
LIVE=forza-voice
SITE=sanatpish-new
CANDIDATE=forza-nima-canary
SECRETS=/etc/sanatpish/forza-voice.env
test -d "$APP/.git" && test -r "$SECRETS"
test "$(git -C "$APP" remote get-url origin)" = "https://github.com/javanwebi/script.git"
# Avoid competing with the separate long-running 728-WAV teacher generator.
if docker ps --format '{{.Names}}' | grep -Fxq forza-pocket-teacher-eval; then
  echo "FORZA_NIMA_CANARY_ABORT teacher_dataset_generation_running" >&2; exit 2
fi
for name in "$LIVE" "$SITE"; do test "$(docker inspect -f '{{.State.Running}}' "$name")" = true; done
! docker container inspect "$CANDIDATE" >/dev/null 2>&1 || { echo "Candidate name occupied" >&2; exit 1; }
test "$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)" -ge 1800000
test "$(df -Pk / | awk 'NR==2 {print $4}')" -ge 2400000
TOKEN=$(sed -n 's/^FORZA_VOICE_TOKEN=//p' "$SECRETS" | head -1)
test "$(printf %s "$TOKEN" | wc -c)" -eq 64 || { echo "Missing private token" >&2; exit 1; }
NETWORK=$(docker inspect -f '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -Fx supabase_default | head -1 || true)
if [ -z "$NETWORK" ]; then
  NETWORK=$(docker inspect -f '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -v '^bridge$' | head -1 || true)
fi
test -n "$NETWORK"
STAGE=$(mktemp -d /opt/forza-nima-canary.XXXXXXXX)
IMAGE=""
cleanup(){
  local rc=$?
  trap - EXIT INT TERM
  docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true
  if [ -n "$IMAGE" ]; then docker image rm "$IMAGE" >/dev/null 2>&1 || true; fi
  rm -rf -- "$STAGE"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
git -C "$APP" fetch --quiet origin main
REV=$(git -C "$APP" rev-parse origin/main)
git -C "$APP" archive --format=tar "$REV" Dockerfile.forza-nima scripts/forza_nima_voice_http.py | tar -xf - -C "$STAGE"
IMAGE="sanatpish/forza-nima:canary-$(printf %.12s "$REV")"
echo "[1/3] Build verified standalone Piper Nima image."
docker build --pull=false -t "$IMAGE" -f "$STAGE/Dockerfile.forza-nima" "$STAGE" >/dev/null
echo "[2/3] Launch private 2-vCPU / 1.25-GiB voice, no host ports."
docker run -d --name "$CANDIDATE" --restart no \
  --network "$NETWORK" --network-alias "$CANDIDATE" \
  --cpus=2 --cpu-shares=128 --memory=1280m --memory-swap=1280m \
  --pids-limit=128 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --env-file "$SECRETS" -e PORT=8080 "$IMAGE" >/dev/null
READY=0
for _ in $(seq 1 90); do
  if docker exec "$SITE" node -e \
    'fetch("http://forza-nima-canary:8080/health",{signal:AbortSignal.timeout(2000)}).then(async r=>process.exit(r.ok&&(await r.json()).voice==="piper-nima-gyro-medium"?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1; then READY=1; break; fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$CANDIDATE")" != true ]; then break; fi
  sleep 2
done
if [ "$READY" != 1 ]; then docker logs --tail 60 "$CANDIDATE" >&2; exit 1; fi
echo "[3/3] Full-answer authenticated one-WAV streaming test."
docker exec -i -e "FORZA_VOICE_TOKEN=$TOKEN" "$SITE" node - <<'JS'
(async()=>{
  const started=performance.now();
  const response=await fetch('http://forza-nima-canary:8080/speak-stream',{
    method:'POST',
    headers:{'Content-Type':'application/json','X-Forza-Voice-Token':process.env.FORZA_VOICE_TOKEN},
    body:JSON.stringify({text:'سلام، من فورزا هستم و می‌توانم برای انتخاب قطعات صنعتی به شما کمک کنم. لطفاً کد و مشخصات قطعه مورد نیاز را بفرمایید.'}),
    signal:AbortSignal.timeout(60000),
  });
  if(!response.ok||response.headers.get('x-forza-voice')!=='piper-nima-gyro-medium'||
     !(response.headers.get('content-type')||'').includes('application/x-forza-wav-frames'))
      throw Error('nima_wrong_response_'+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  const ms=performance.now()-started;
  const len=bytes.readUInt32LE(0),wav=bytes.subarray(4);
  if(len!==wav.length||wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE')
    throw Error('invalid_framed_wav');
  const sampleRate=wav.readUInt32LE(24);
  if(sampleRate!==22050)throw Error('wrong_sample_rate');
  const duration=(wav.length-44)/(2*sampleRate),rtf=ms/1000/duration;
  console.log('FORZA_NIMA_PRIVATE_CANARY_RESULT frames=1 total_ms='+ms.toFixed(0)+
   ' audio_seconds='+duration.toFixed(2)+' rtf='+rtf.toFixed(3)+
   ' wav_bytes='+wav.length+' generated_files=0');
  if(rtf>=1)throw Error('nima_not_real_time_on_current_host');
})().catch(e=>{console.error('FORZA_NIMA_PRIVATE_CANARY_FAIL',e.message);process.exit(1)});
JS
for name in "$LIVE" "$SITE"; do test "$(docker inspect -f '{{.State.Running}}' "$name")" = true; done
echo "FORZA_NIMA_PRIVATE_CANARY_PASS revision=$REV live_changed=0 generated_wav_saved=0"
