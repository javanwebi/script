#!/usr/bin/env bash
# Safe isolated full-text -> progressive Pocket streaming smoke on the 2-GiB VPS.
# Does not restart or modify running voice/site/database, and never saves WAVs.
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
umask 077
test "$EUID" -eq 0 || { echo "Run as root" >&2; exit 1; }
APP=/opt/sanatpish
LIVE=forza-voice
SITE=sanatpish-new
CANDIDATE=forza-progressive-eval
SECRETS=/etc/sanatpish/forza-voice.env
test -d "$APP/.git" && test -r "$SECRETS"
test "$(git -C "$APP" remote get-url origin)" = "https://github.com/javanwebi/script.git"
for name in "$LIVE" "$SITE"; do test "$(docker inspect -f '{{.State.Running}}' "$name")" = true; done
! docker container inspect "$CANDIDATE" >/dev/null 2>&1 || { echo "Candidate name occupied" >&2; exit 1; }
test "$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)" -ge 2600000 || { echo "Not enough available RAM" >&2; exit 1; }
test "$(df -Pk / | awk 'NR==2 {print $4}')" -ge 3145728 || { echo "Not enough disk space" >&2; exit 1; }
TOKEN=$(sed -n 's/^FORZA_VOICE_TOKEN=//p' "$SECRETS" | head -1)
test "${#TOKEN}" -eq 64 || { echo "Private token unavailable" >&2; exit 1; }
PARENT=$(docker inspect -f '{{.Config.Image}}' "$LIVE")
docker image inspect "$PARENT" >/dev/null
NETWORK=$(docker inspect -f '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -Fx supabase_default | head -1 || true)
if [ -z "$NETWORK" ]; then
  NETWORK=$(docker inspect -f '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -v '^bridge$' | head -1 || true)
fi
test -n "$NETWORK"
VOICE_SHA=$(docker exec "$LIVE" sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')
STATE_SHA=$(docker exec "$LIVE" sha256sum /app/vendor/persian_tts/forza_voice_state.npz | awk '{print $1}')
STAGE=$(mktemp -d /opt/forza-progressive-eval.XXXXXXXX)
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
git -C "$APP" archive --format=tar "$REV" scripts/forza_voice_http.py scripts/forza_pocket_worker.py | tar -xf - -C "$STAGE"
cat > "$STAGE/Dockerfile" <<'DOCKER'
ARG VOICE_PARENT
FROM ${VOICE_PARENT}
COPY scripts/forza_voice_http.py /app/scripts/forza_voice_http.py
COPY scripts/forza_pocket_worker.py /app/scripts/forza_pocket_worker.py
CMD ["python", "-u", "scripts/forza_voice_http.py"]
DOCKER
IMAGE="sanatpish/forza-progressive:smoke-${REV:0:12}"
docker build --pull=false --build-arg "VOICE_PARENT=$PARENT" -f "$STAGE/Dockerfile" -t "$IMAGE" "$STAGE" >/dev/null
docker run -d --name "$CANDIDATE" --restart no \
  --network "$NETWORK" --network-alias "$CANDIDATE" \
  --cpus 2 --cpu-shares 128 --memory 2g --memory-swap 2g --pids-limit 128 \
  --env-file "$SECRETS" -e PORT=8080 \
  -e FORZA_TTS_RESIDENT_ACOUSTIC=1 -e FORZA_TTS_RESIDENT_G2P=1 \
  -e FORZA_TTS_WARMUP=1 -e FORZA_TTS_PARALLEL_CHUNKS=2 -e FORZA_CPU_INTRA=1 \
  "$IMAGE" >/dev/null
READY=0
for _ in $(seq 1 90); do
  if docker exec "$SITE" node -e 'fetch("http://forza-progressive-eval:8080/health",{signal:AbortSignal.timeout(2000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1; then READY=1; break; fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$CANDIDATE")" != true ]; then break; fi
  sleep 2
done
if [ "$READY" != 1 ]; then docker logs --tail 80 "$CANDIDATE" >&2; exit 1; fi
test "$(docker exec "$CANDIDATE" sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')" = "$VOICE_SHA"
test "$(docker exec "$CANDIDATE" sha256sum /app/vendor/persian_tts/forza_voice_state.npz | awk '{print $1}')" = "$STATE_SHA"
docker exec -i -e "FORZA_VOICE_TOKEN=$TOKEN" "$SITE" node - <<'JS'
(async()=>{
  const phrase='سلام، من فورزا هستم و می‌توانم برای انتخاب قطعات صنعتی به شما کمک کنم. لطفاً کد و مشخصات قطعه مورد نیاز را بفرمایید.';
  const started=performance.now();
  const response=await fetch('http://forza-progressive-eval:8080/speak-stream',{
    method:'POST',
    headers:{'Content-Type':'application/json','X-Forza-Voice-Token':process.env.FORZA_VOICE_TOKEN},
    body:JSON.stringify({text:phrase}),signal:AbortSignal.timeout(420000),
  });
  if(!response.ok||!(response.headers.get('content-type')||'').includes('application/x-forza-wav-frames'))
    throw Error('invalid_stream_http_'+response.status);
  const reader=response.body.getReader();
  let buffered=Buffer.alloc(0),need=-1,frames=0,firstMs=0,lastMs=0,maxGap=0,audioSeconds=0;
  for(;;){
    const {done,value}=await reader.read();
    if(done)break;
    buffered=Buffer.concat([buffered,Buffer.from(value)]);
    for(;;){
      if(need<0){
        if(buffered.length<4)break;
        need=buffered.readUInt32LE(0);
        buffered=buffered.subarray(4);
        if(need<44||need>5000000)throw Error('invalid_frame_size');
      }
      if(buffered.length<need)break;
      const wav=buffered.subarray(0,need);
      buffered=buffered.subarray(need);
      need=-1;
      if(wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE'||wav.readUInt32LE(24)!==24000)
        throw Error('invalid_pcm_wav');
      const now=performance.now()-started;
      if(frames===0)firstMs=now;
      else maxGap=Math.max(maxGap,now-lastMs);
      lastMs=now;frames++;
      audioSeconds+=(wav.length-44)/48000;
      if(frames>256)throw Error('too_many_frames');
    }
  }
  if(need!==-1||buffered.length||frames<2)throw Error('truncated_or_not_progressive');
  const total=performance.now()-started;
  console.log('FORZA_PROGRESSIVE_STREAM_RESULT revision='+process.env.REV+
    ' frames='+frames+' first_ms='+Math.round(firstMs)+
    ' total_ms='+Math.round(total)+' audio_seconds='+audioSeconds.toFixed(2)+
    ' rtf='+(total/(audioSeconds*1000)).toFixed(3)+
    ' max_frame_gap_ms='+Math.round(maxGap));
})().catch(e=>{console.error('FORZA_PROGRESSIVE_STREAM_FAIL',e.message);process.exit(1)});
JS
echo "FORZA_PROGRESSIVE_SMOKE_DONE revision=$REV voice_sha256=$VOICE_SHA"
echo "Live voice, website, database and Nginx unchanged; no generated WAV saved."
