#!/usr/bin/env bash
# Promote only the benchmarked progressive Pocket TTS worker.
# The worker keeps /speak compatible, so it can be promoted before the app update.
# Website, Nginx, Supabase and xKiro settings are never modified.
set -Eeuo pipefail
umask 077
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
exec 9>/run/lock/forza-voice-promote.lock
flock -w 5 9 || { echo "Another FORZA voice switch is running" >&2; exit 1; }

test "$EUID" -eq 0 || { echo "Run using sudo" >&2; exit 1; }
APP=/opt/sanatpish
LIVE=forza-voice
TOKENFILE=/etc/sanatpish/forza-voice.env
MARKER=/etc/sanatpish/forza-voice-rollback-container
BACKUP="forza-voice-previous-$(date -u +%Y%m%d%H%M%S)"
CHANGED=0
VERIFIED=0
TEMP=$(mktemp -d /tmp/forza-stream-promote.XXXXXXXX)

on_exit() {
  rc=$1
  trap - EXIT ERR INT TERM
  if [ "$CHANGED" = 1 ] && [ "$VERIFIED" != 1 ]; then
    echo "FORZA_STREAM_PROMOTE_FAILED: restoring the previous Pocket worker" >&2
    if docker container inspect "$BACKUP" >/dev/null 2>&1; then
      docker rm -f "$LIVE" >/dev/null 2>&1 || true
      docker rename "$BACKUP" "$LIVE" >/dev/null 2>&1 || true
      docker start "$LIVE" >/dev/null 2>&1 || true
    elif docker container inspect "$LIVE" >/dev/null 2>&1; then
      docker start "$LIVE" >/dev/null 2>&1 || true
    fi
    echo "FORZA_STREAM_ROLLBACK_ATTEMPTED: inspect docker logs forza-voice" >&2
  fi
  rm -rf -- "$TEMP"
  exit "$rc"
}
trap 'on_exit $?' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

test -d "$APP/.git"
test "$(git -C "$APP" remote get-url origin)" = https://github.com/javanwebi/script.git
test -r "$TOKENFILE"
test ! -e "$MARKER" || { echo "Resolve the previous voice rollback marker first." >&2; exit 1; }
test "$(docker inspect --format '{{.State.Running}}' "$LIVE")" = true
test "$(docker inspect --format '{{.State.Running}}' sanatpish-new)" = true
test "$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)" -ge 1800000
test "$(df -Pk / | awk 'NR==2 {print $4}')" -ge 1048576

TOKEN=$(sed -n 's/^FORZA_VOICE_TOKEN=//p' "$TOKENFILE" | head -1)
test "\${#TOKEN}" -eq 64 || { echo "Invalid private voice token" >&2; exit 1; }

echo "[1/4] Checking benchmarked image. Worker-first promotion preserves the old /speak API."
git -C "$APP" fetch --quiet origin main
REV=$(git -C "$APP" rev-parse origin/main)
IMAGE="sanatpish/forza-voice:stream-test-\${REV:0:12}"
docker image inspect "$IMAGE" >/dev/null || {
  echo "Missing candidate image $IMAGE. Run ops/forza-voice-stream-benchmark-vps.sh first." >&2
  exit 1
}
# Do not require the new Express route yet. The upgraded worker keeps /speak
# fully compatible, so the existing live app continues speaking during rollout.

NETWORK=$(docker inspect --format '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -Fx supabase_default | head -1 || true)
if [ -z "$NETWORK" ]; then
  NETWORK=$(docker inspect --format '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -v '^bridge$' | head -1 || true)
fi
test -n "$NETWORK"

echo "[2/4] Replacing only the private TTS worker with the tested 1.75-CPU progressive image."
CHANGED=1
docker stop -t 15 "$LIVE" >/dev/null
docker rename "$LIVE" "$BACKUP"
docker run -d --name "$LIVE" --network "$NETWORK" --network-alias "$LIVE" \
  --restart unless-stopped \
  --memory 1536m --memory-swap 1536m --cpus 1.75 --pids-limit 128 \
  --env-file "$TOKENFILE" -e PORT=8080 \
  -e FORZA_TTS_RESIDENT_ACOUSTIC=1 \
  -e FORZA_TTS_PARALLEL_CHUNKS=2 \
  -e FORZA_TTS_STREAM_FIRST_TOKENS=10 \
  "$IMAGE" >/dev/null

echo "[3/4] Waiting for private worker health."
ready=0
for i in $(seq 1 45); do
  if docker exec sanatpish-new node -e '
    fetch("http://forza-voice:8080/health",{signal:AbortSignal.timeout(3000)})
      .then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))
  ' >/dev/null 2>&1; then ready=1; break; fi
  if [ "$(docker inspect --format '{{.State.Running}}' "$LIVE")" != true ]; then break; fi
  sleep 2
done
test "$ready" -eq 1 || { docker logs --tail 60 "$LIVE" >&2; exit 1; }

echo "[4/4] Testing first playable WAV frame directly from the private worker."
docker exec -i sanatpish-new node - <<'JS'
(async()=>{
  require('dotenv').config({path:'/app/.env.forza-voice',quiet:true});
  const token=process.env.FORZA_VOICE_TOKEN;
  if(!token)throw Error('private_voice_token_missing');
  const start=performance.now();
  const r=await fetch('http://forza-voice:8080/speak-stream',{
    method:'POST',
    headers:{'Content-Type':'application/json','X-Forza-Voice-Token':token},
    body:JSON.stringify({text:'سلام، من فورزا هستم و برای راهنمایی انتخاب قطعات صنعتی در خدمت شما هستم.'}),
    signal:AbortSignal.timeout(90000)
  });
  if(!r.ok||!r.body)throw Error('private_stream_http_'+r.status);
  if(!(r.headers.get('content-type')||'').includes('application/x-forza-wav-frames'))
    throw Error('invalid_stream_content_type');
  if(r.headers.get('x-forza-voice')!=='pocket-farsi-v2')
    throw Error('wrong_voice_provider');
  const reader=r.body.getReader();
  let pending=Buffer.alloc(0),first=0,frames=0,audioSeconds=0;
  while(true){
    const {value,done}=await reader.read();
    if(done)break;
    pending=Buffer.concat([pending,Buffer.from(value)]);
    while(pending.length>=4){
      const size=pending.readUInt32LE(0);
      if(size<44||size>1500000)throw Error('invalid_wav_frame_length');
      if(pending.length<size+4)break;
      const wav=pending.subarray(4,size+4);
      if(wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE')
        throw Error('invalid_wav_frame_header');
      if(wav.readUInt32LE(24)!==24000||wav.readUInt16LE(22)!==1||wav.readUInt16LE(34)!==16)
        throw Error('invalid_wav_pcm_format');
      frames++;
      if(frames===1){
        first=Math.round(performance.now()-start);
        console.log('FORZA_PROMOTE_FIRST_WAV_MS='+first);
      }
      audioSeconds+=(size-44)/48000;
      pending=pending.subarray(size+4);
    }
  }
  const total=Math.round(performance.now()-start);
  if(pending.length||frames===0)throw Error('incomplete_wav_stream');
  console.log('FORZA_PROMOTE_STREAM frames='+frames+' audio_s='+audioSeconds.toFixed(2)+' total_ms='+total);
  if(first>20000)throw Error('first_wav_too_slow_'+first);
  if(total>90000)throw Error('stream_total_timeout_'+total);
})().catch(e=>{console.error('FORZA_PROMOTE_SMOKE_FAILED',e.message);process.exit(1)});
JS

test "$(docker inspect --format '{{.State.OOMKilled}}' "$LIVE")" = false
test "$(docker inspect --format '{{.State.Running}}' "$LIVE")" = true
printf '%s\n' "$BACKUP" > "$MARKER"
chmod 600 "$MARKER"
VERIFIED=1
echo "FORZA_PROGRESSIVE_POCKET_LIVE_OK"
echo "Image=$IMAGE"
echo "CPU=1.75 RAM=1.5GiB parallel_chunks=2 first_tokens=10"
echo "Stopped rollback container retained: $BACKUP"
echo "Existing /speak remains available; deploy the app afterward to enable progressive browser playback."
echo "Website, Nginx, Supabase, xKiro and STT were not changed."
echo "Rollback if needed: sudo bash ops/forza-voice-rollback-vps.sh"
