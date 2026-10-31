#!/usr/bin/env bash
# Promote only the benchmarked 2-CPU / 2-GiB resident-G2P Pocket worker.
# Uses a NEW rollback marker and preserves any older rollback marker/container.
set -Eeuo pipefail
umask 077
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
exec 9>/run/lock/forza-voice-promote.lock
flock -w 5 9 || { echo "Another FORZA voice switch is running" >&2; exit 1; }
test "$EUID" -eq 0 || { echo "Run using sudo bash" >&2; exit 1; }

APP=/opt/sanatpish
LIVE=forza-voice
ORIGINAL_SPEAKER_SHA=31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833
TOKENFILE=/etc/sanatpish/forza-voice.env
MARKER=/etc/sanatpish/forza-voice-faststart-rollback-container
BACKUP="forza-voice-before-faststart-$(date -u +%Y%m%d%H%M%S)"
CHANGED=0
VERIFIED=0
TEMP=$(mktemp -d /tmp/forza-faststart-promote.XXXXXXXX)

on_exit(){
  rc=$?
  trap - EXIT ERR INT TERM
  if [ "$CHANGED" = 1 ] && [ "$VERIFIED" != 1 ]; then
    echo "FORZA_FASTSTART_PROMOTE_FAILED: restoring the previous voice worker." >&2
    if docker container inspect "$BACKUP" >/dev/null 2>&1; then
      docker rm -f "$LIVE" >/dev/null 2>&1 || true
      docker rename "$BACKUP" "$LIVE" >/dev/null 2>&1 || true
      docker start "$LIVE" >/dev/null 2>&1 || true
    elif docker container inspect "$LIVE" >/dev/null 2>&1; then
      docker start "$LIVE" >/dev/null 2>&1 || true
    fi
    echo "FORZA_FASTSTART_ROLLBACK_ATTEMPTED: inspect docker logs forza-voice" >&2
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
test ! -e "$MARKER" || { echo "Fast-start rollback marker already exists; resolve it first." >&2; exit 1; }
test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
test "$(docker exec "$LIVE" sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')" = "$ORIGINAL_SPEAKER_SHA" || { echo "FORZA_ABORT wrong original Pocket speaker" >&2; exit 1; }
test "$(docker inspect -f '{{.State.Running}}' sanatpish-new)" = true
test "$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)" -ge 1800000
test "$(df -Pk / | awk 'NR==2 {print $4}')" -ge 1048576

TOKEN=$(sed -n 's/^FORZA_VOICE_TOKEN=//p' "$TOKENFILE" | head -1)
test "${#TOKEN}" -eq 64 || { echo "Invalid private voice token." >&2; exit 1; }

echo "[1/4] Verifying the exact benchmark image."
git -C "$APP" fetch --quiet origin main
REV=$(git -C "$APP" rev-parse origin/main)
IMAGE="sanatpish/forza-voice:faststart-test-${REV:0:12}"
docker image inspect "$IMAGE" >/dev/null || {
  echo "Missing $IMAGE. Run ops/forza-voice-faststart-benchmark-vps.sh first." >&2
  exit 1
}

NETWORK=$(docker inspect -f '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -Fx supabase_default | head -1 || true)
if [ -z "$NETWORK" ]; then
  NETWORK=$(docker inspect -f '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -v '^bridge$' | head -1 || true)
fi
test -n "$NETWORK"

echo "[2/4] Replacing only the private TTS worker; older rollback marker is untouched."
CHANGED=1
docker stop -t 15 "$LIVE" >/dev/null
docker rename "$LIVE" "$BACKUP"
docker run -d --name "$LIVE" --network "$NETWORK" --network-alias "$LIVE" \
  --restart unless-stopped \
  --memory 2g --memory-swap 2g --cpus 2.0 --cpu-shares 2048 --pids-limit 128 \
  --env-file "$TOKENFILE" -e PORT=8080 \
  -e FORZA_TTS_RESIDENT_ACOUSTIC=1 \
  -e FORZA_TTS_RESIDENT_G2P=1 \
  -e FORZA_TTS_WARMUP=1 \
  -e FORZA_TTS_PARALLEL_CHUNKS=2 \
  -e FORZA_TTS_STREAM_FIRST_TOKENS=18 \
  "$IMAGE" >/dev/null

echo "[3/4] Waiting for resident G2P and Pocket warmup (up to 120 seconds)."
ready=0
for i in $(seq 1 60); do
  if docker exec sanatpish-new node -e '
    fetch("http://forza-voice:8080/health",{signal:AbortSignal.timeout(3500)})
      .then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))
  ' >/dev/null 2>&1; then ready=1; break; fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$LIVE")" != true ]; then break; fi
  sleep 2
done
test "$ready" = 1 || { docker logs --tail 80 "$LIVE" >&2; exit 1; }
test "$(docker exec "$LIVE" sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')" = "$ORIGINAL_SPEAKER_SHA" || { echo "FORZA_PROMOTE_REF_CHANGED rolling_back=1" >&2; exit 1; }
test "$(docker inspect -f '{{.State.OOMKilled}}' "$LIVE")" = false || { echo "FORZA_PROMOTE_OOM" >&2; exit 1; }

echo "[4/4] Enforcing first-audio and inter-frame limits through the private worker."
docker exec -i -e "FORZA_VOICE_TOKEN=$TOKEN" \
  -e "FORZA_FASTSTART_MAX_FIRST_MS=${FORZA_FASTSTART_MAX_FIRST_MS:-5000}" \
  -e "FORZA_FASTSTART_MAX_GAP_MS=${FORZA_FASTSTART_MAX_GAP_MS:-5000}" \
  sanatpish-new node - <<'JS'
(async()=>{
 const maxFirst=Number(process.env.FORZA_FASTSTART_MAX_FIRST_MS);
 const maxGap=Number(process.env.FORZA_FASTSTART_MAX_GAP_MS);
 const started=performance.now();
 const response=await fetch('http://forza-voice:8080/speak-stream',{
  method:'POST',
  headers:{'Content-Type':'application/json','X-Forza-Voice-Token':process.env.FORZA_VOICE_TOKEN},
  body:JSON.stringify({text:'سلام، من فورزا هستم و برای راهنمایی انتخاب قطعات صنعتی در خدمت شما هستم.'}),
  signal:AbortSignal.timeout(90000)
 });
 if(!response.ok||!response.body)throw Error('private_stream_http_'+response.status);
 if(response.headers.get('x-forza-voice')!=='pocket-farsi-v2')throw Error('wrong_voice_provider');
 if(!(response.headers.get('content-type')||'').includes('application/x-forza-wav-frames'))
  throw Error('invalid_stream_content_type');
 let pending=Buffer.alloc(0),frames=0,first=0,maxGapMs=0,lastAt=0,audioSeconds=0;
 for await(const block of response.body){
  pending=Buffer.concat([pending,Buffer.from(block)]);
  while(pending.length>=4){
   const size=pending.readUInt32LE(0);
   if(size<44||size>1500000)throw Error('invalid_wav_frame_length');
   if(pending.length<size+4)break;
   const wav=pending.subarray(4,size+4);
   if(wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE')
    throw Error('invalid_wav_header');
   const now=performance.now();
   if(frames===0)first=Math.round(now-started);
   else maxGapMs=Math.max(maxGapMs,now-lastAt);
   lastAt=now;frames++;
   audioSeconds+=(size-44)/48000;
   pending=pending.subarray(size+4);
  }
 }
 const total=Math.round(performance.now()-started);
 console.log('FORZA_FASTSTART_PROMOTE first_wav_ms='+first+
  ' max_inter_frame_gap_ms='+Math.round(maxGapMs)+
  ' frames='+frames+' audio_s='+audioSeconds.toFixed(2)+' total_ms='+total);
 if(pending.length||frames===0)throw Error('incomplete_audio_stream');
 if(first>maxFirst)throw Error('first_audio_exceeded_limit_'+first+'_ms');
 if(maxGapMs>maxGap)throw Error('inter_frame_gap_exceeded_limit_'+Math.round(maxGapMs)+'_ms');
})().catch(error=>{console.error('FORZA_FASTSTART_SMOKE_FAILED',error.message);process.exit(1)});
JS

test "$(docker inspect -f '{{.State.OOMKilled}}' "$LIVE")" = false
test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
printf '%s\n' "$BACKUP" > "$MARKER"
chmod 600 "$MARKER"
VERIFIED=1
echo "FORZA_FASTSTART_POCKET_LIVE_OK"
echo "Image=$IMAGE CPU=2 RAM=2GiB resident_G2P=1 warmup=1 parallel_chunks=2 first_tokens=18"
echo "Backup retained stopped: $BACKUP"
echo "Existing /speak route remains compatible; deploy the app to activate progressive browser playback."
echo "Older /etc/sanatpish/forza-voice-rollback-container was preserved unchanged."
echo "Rollback: sudo bash ops/forza-voice-faststart-rollback-vps.sh"
