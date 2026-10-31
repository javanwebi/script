#!/usr/bin/env bash
# Isolated 2-CPU / 2-GiB Pocket fast-start benchmark with resident G2P and warmup.
# Builds only from the current private voice image; never changes the live worker.
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
umask 077
test "$EUID" -eq 0 || { echo "Run with sudo bash" >&2; exit 1; }
APP=/opt/sanatpish
LIVE=forza-voice
CANDIDATE=forza-voice-faststart-benchmark
SECRETS=/etc/sanatpish/forza-voice.env
test -d "$APP/.git"
test -r "$SECRETS"
test "$(git -C "$APP" remote get-url origin)" = https://github.com/javanwebi/script.git
test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
test "$(docker inspect -f '{{.State.Running}}' sanatpish-new)" = true
! docker container inspect "$CANDIDATE" >/dev/null 2>&1 || {
  echo "Existing fast-start benchmark container detected; refusing to overwrite." >&2; exit 1;
}
MEMKB=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
DISKKB=$(df -Pk / | awk 'NR==2 {print $4}')
test "$MEMKB" -ge 2500000 || { echo "Need at least 2.5 GiB MemAvailable for isolated 2-GiB benchmark." >&2; exit 1; }
test "$DISKKB" -ge 1048576 || { echo "Need at least 1 GiB free disk." >&2; exit 1; }
SOURCE_IMAGE=$(docker inspect -f '{{.Config.Image}}' "$LIVE")
docker image inspect "$SOURCE_IMAGE" >/dev/null
NETWORK=$(docker inspect -f '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -Fx supabase_default | head -1 || true)
if [ -z "$NETWORK" ]; then
  NETWORK=$(docker inspect -f '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -v '^bridge$' | head -1 || true)
fi
test -n "$NETWORK"
TOKEN=$(sed -n 's/^FORZA_VOICE_TOKEN=//p' "$SECRETS" | head -1)
test "${#TOKEN}" -eq 64 || { echo "Invalid private voice token." >&2; exit 1; }

STAGE=$(mktemp -d /opt/forza-faststart-bench.XXXXXXXX)
cleanup(){
  rc=$?
  trap - EXIT INT TERM
  docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true
  rm -rf -- "$STAGE"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "[1/4] Building candidate from current Pocket image plus updated worker code."
git -C "$APP" fetch --quiet origin main
REV=$(git -C "$APP" rev-parse origin/main)
git -C "$APP" archive --format=tar "$REV" scripts/forza_pocket_worker.py scripts/forza_voice_http.py | tar -xf - -C "$STAGE"
grep -q 'g2p_ready_ms' "$STAGE/scripts/forza_voice_http.py"
grep -q 'FORZA_TTS_WARMUP' "$STAGE/scripts/forza_voice_http.py"
grep -q 'synthesis_ms=' "$STAGE/scripts/forza_pocket_worker.py"
printf 'FROM %s\nCOPY scripts/forza_pocket_worker.py /app/scripts/forza_pocket_worker.py\nCOPY scripts/forza_voice_http.py /app/scripts/forza_voice_http.py\n' "$SOURCE_IMAGE" > "$STAGE/Dockerfile"
TAG="sanatpish/forza-voice:faststart-test-${REV:0:12}"
docker build --pull=false -q -f "$STAGE/Dockerfile" -t "$TAG" "$STAGE" >/dev/null

echo "[2/4] Starting disposable 2-CPU / 2-GiB worker with resident G2P, warmup and 18-token first chunk."
docker run -d --name "$CANDIDATE" --restart no \
  --network "$NETWORK" --cpus=2.0 --cpu-shares=512 \
  --memory=2g --memory-swap=2g --pids-limit=128 \
  --env-file "$SECRETS" -e PORT=8080 \
  -e FORZA_TTS_RESIDENT_ACOUSTIC=1 \
  -e FORZA_TTS_RESIDENT_G2P=1 \
  -e FORZA_TTS_WARMUP=1 \
  -e FORZA_TTS_PARALLEL_CHUNKS=2 \
  -e FORZA_TTS_STREAM_FIRST_TOKENS=18 \
  "$TAG" >/dev/null

echo "[3/4] Waiting for G2P preload and acoustic warmup (up to 120 seconds)."
ready=0
for i in $(seq 1 60); do
  if docker exec sanatpish-new node -e '
    fetch("http://forza-voice-faststart-benchmark:8080/health",{signal:AbortSignal.timeout(3500)})
      .then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))
  ' >/dev/null 2>&1; then ready=1; break; fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$CANDIDATE")" != true ]; then break; fi
  sleep 2
done
test "$ready" = 1 || { docker logs --tail 80 "$CANDIDATE" >&2; exit 1; }

echo "[4/4] Measuring first playable WAV, inter-frame gaps, RTF and peak memory."
docker exec -i -e "FORZA_VOICE_TOKEN=$TOKEN" sanatpish-new node - <<'JS'
(async()=>{
 const phrases=[
  'سلام، من فورزا هستم و برای راهنمایی انتخاب قطعات صنعتی در خدمت شما هستم.',
  'برای انتخاب قطعه مناسب، شماره فنی و مشخصات دستگاه را بفرمایید تا موجودی و گزینه‌های سازگار را بررسی کنم.'
 ];
 for(let index=0;index<phrases.length;index++){
  const started=performance.now();
  const response=await fetch('http://forza-voice-faststart-benchmark:8080/speak-stream',{
   method:'POST',
   headers:{'Content-Type':'application/json','X-Forza-Voice-Token':process.env.FORZA_VOICE_TOKEN},
   body:JSON.stringify({text:phrases[index]}),
   signal:AbortSignal.timeout(90000)
  });
  if(!response.ok||!response.body)throw Error('private_stream_http_'+response.status);
  if(!(response.headers.get('content-type')||'').includes('application/x-forza-wav-frames'))
   throw Error('invalid_stream_content_type');
  let pending=Buffer.alloc(0),frames=0,firstMs=0,audioSeconds=0,maxGapMs=0,lastFrameAt=0;
  for await(const block of response.body){
   pending=Buffer.concat([pending,Buffer.from(block)]);
   while(pending.length>=4){
    const size=pending.readUInt32LE(0);
    if(size<44||size>1500000)throw Error('invalid_wav_frame_length');
    if(pending.length<size+4)break;
    const wav=pending.subarray(4,size+4);
    if(wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE')
     throw Error('invalid_wav_frame_header');
    if(wav.readUInt32LE(24)!==24000||wav.readUInt16LE(22)!==1||wav.readUInt16LE(34)!==16)
     throw Error('invalid_wav_pcm_format');
    const now=performance.now();
    if(frames===0)firstMs=Math.round(now-started);
    else maxGapMs=Math.max(maxGapMs,now-lastFrameAt);
    lastFrameAt=now;
    frames++;
    audioSeconds+=(size-44)/48000;
    pending=pending.subarray(size+4);
   }
  }
  const totalMs=Math.round(performance.now()-started);
  if(pending.length||frames===0)throw Error('incomplete_wav_stream');
  console.log('FORZA_FASTSTART phrase='+(index+1)+
   ' first_wav_ms='+firstMs+
   ' max_inter_frame_gap_ms='+Math.round(maxGapMs)+
   ' total_ms='+totalMs+
   ' frames='+frames+
   ' audio_s='+audioSeconds.toFixed(2)+
   ' rtf='+(totalMs/1000/audioSeconds).toFixed(2));
 }
})().catch(error=>{console.error('FORZA_FASTSTART_FAILED',error.message);process.exit(1)});
JS

docker stats --no-stream "$CANDIDATE" "$LIVE" sanatpish-new
if docker exec "$CANDIDATE" test -r /sys/fs/cgroup/memory.peak; then
  PEAK=$(docker exec "$CANDIDATE" cat /sys/fs/cgroup/memory.peak)
  echo "FORZA_FASTSTART_PEAK_BYTES=$PEAK"
  test "$PEAK" -lt 1900000000 || { echo "Candidate peak RAM exceeded 1.9 GB." >&2; exit 1; }
fi
test "$(docker inspect -f '{{.State.OOMKilled}}' "$CANDIDATE")" = false
test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
test "$(docker inspect -f '{{.State.Running}}' sanatpish-new)" = true
docker logs --tail 100 "$CANDIDATE" 2>&1 | grep -E 'g2p_ready_ms|warmup_ms|synthesis_ms=|first_chunk_ms|inter_chunk_gap_ms|chunks=' || true
echo "FORZA_FASTSTART_BENCH_PASS revision=$REV image=$TAG"
echo "Live voice, website, Nginx and Supabase were not modified."
