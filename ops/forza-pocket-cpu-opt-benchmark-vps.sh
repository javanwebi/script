#!/usr/bin/env bash
# Compare Pocket Farsi v2 CPU/ORT tuning WITHOUT touching live services.
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
umask 077
test "$EUID" -eq 0 || { echo "Run with sudo bash" >&2; exit 1; }
APP=/opt/sanatpish
LIVE=forza-voice
SITE=sanatpish-new
CANDIDATE=forza-pocket-cpu-eval
SECRETS=/etc/sanatpish/forza-voice.env
test -d "$APP/.git"
test "$(git -C "$APP" remote get-url origin)" = https://github.com/javanwebi/script.git
test -r "$SECRETS"
test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
test "$(docker inspect -f '{{.State.Running}}' "$SITE")" = true
! docker container inspect "$CANDIDATE" >/dev/null 2>&1 || { echo "Existing candidate! Refusing to overwrite." >&2; exit 1; }
MEMKB=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
DISKKB=$(df -Pk / | awk 'NR==2 {print $4}')
test "$MEMKB" -ge 2500000 || { echo "Need 2.5 GiB MemAvailable." >&2; exit 1; }
test "$DISKKB" -ge 1048576 || { echo "Need at least 1 GiB free disk." >&2; exit 1; }
TOKEN=$(sed -n 's/^FORZA_VOICE_TOKEN=//p' "$SECRETS" | head -1)
test "${#TOKEN}" -eq 64 || { echo "Invalid private TTS token." >&2; exit 1; }
SOURCE_IMAGE=$(docker inspect -f '{{.Config.Image}}' "$LIVE")
[[ "$SOURCE_IMAGE" =~ ^[a-zA-Z0-9_./:@-]+$ ]] || { echo "Invalid image ref." >&2; exit 1; }
docker image inspect "$SOURCE_IMAGE" >/dev/null
NETWORK=$(docker inspect -f '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -Fx supabase_default | head -1 || true)
if [ -z "$NETWORK" ]; then
  NETWORK=$(docker inspect -f '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -v '^bridge$' | head -1 || true)
fi
test -n "$NETWORK"
VOICE_SHA=$(docker exec "$LIVE" sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')
STATE_SHA=$(docker exec "$LIVE" sha256sum /app/vendor/persian_tts/forza_voice_state.npz | awk '{print $1}')
test "${#VOICE_SHA}" -eq 64
test "${#STATE_SHA}" -eq 64
STAGE=$(mktemp -d /opt/forza-pocket-cpu-eval.XXXXXXXX)
cleanup() {
  rc=$?
  trap - EXIT INT TERM
  docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true
  rm -rf -- "$STAGE"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "[1/5] VPS resources (limits and real CPU type)."
echo "FORZA_CPU_HOST nproc=$(nproc) mem_available_kib=$MEMKB disk_free_kib=$DISKKB arch=$(uname -m)"
grep -m 1 'model name' /proc/cpuinfo || true
docker inspect -f 'FORZA_CPU_LIVE cpu_nano={{.HostConfig.NanoCpus}} ram_bytes={{.HostConfig.Memory}} image={{.Config.Image}}' "$LIVE"
docker stats --no-stream "$LIVE" "$SITE" || true
echo "[2/5] Building candidate from same live Pocket weights, reference and KV voice state."
git -C "$APP" fetch --quiet origin main
REV=$(git -C "$APP" rev-parse origin/main)
git -C "$APP" archive --format=tar "$REV" scripts/forza_pocket_worker.py scripts/forza_voice_http.py | tar -xf - -C "$STAGE"
cat > "$STAGE/Dockerfile" <<'DOCKER'
ARG VOICE_PARENT
FROM ${VOICE_PARENT}
COPY scripts/forza_pocket_worker.py /app/scripts/forza_pocket_worker.py
COPY scripts/forza_voice_http.py /app/scripts/forza_voice_http.py
# ONLY the disposable image receives these tunable settings.
RUN python3 - <<'PY'
from pathlib import Path
p = Path("/app/vendor/persian_tts/scripts/tts_onnx.py")
s = p.read_text()
patches = {
  "opts.intra_op_num_threads = 1":
    'opts.intra_op_num_threads = int(os.environ.get("FORZA_CPU_INTRA", "1"))',
  "opts.enable_cpu_mem_arena = False":
    'opts.enable_cpu_mem_arena = os.environ.get("FORZA_CPU_ARENA", "0") == "1"',
  "opts.enable_mem_pattern = False":
    'opts.enable_mem_pattern = os.environ.get("FORZA_CPU_PATTERN", "0") == "1"',
}
for before, after in patches.items():
    if s.count(before) != 1:
        raise RuntimeError("Unexpected Pocket source: " + before)
    s = s.replace(before, after, 1)
p.write_text(s)
PY
DOCKER
IMAGE="sanatpish/forza-voice:pocket-cpu-eval-${REV:0:12}"
docker build -q --pull=false --build-arg "VOICE_PARENT=$SOURCE_IMAGE" -f "$STAGE/Dockerfile" -t "$IMAGE" "$STAGE" >/dev/null
echo "FORZA_CPU_CANDIDATE_READY image=$IMAGE same_voice_sha256=$VOICE_SHA"

# name:intra:arena:pattern:parallel
PROFILES=(baseline:1:0:0:2 arena:1:1:1:2 serial:1:1:1:1 intra2:2:1:1:1)
echo "[3/5] Testing four profiles serially, max 2 CPUs and 2GiB; production unaffected."
for SPEC in "${PROFILES[@]}"; do
  IFS=: read -r NAME INTRA ARENA PATTERN PARALLEL <<< "$SPEC"
  test "$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)" -ge 1800000 || { echo "Low RAM, aborting." >&2; exit 1; }
  echo "FORZA_CPU_PROFILE_START name=$NAME intra=$INTRA arena=$ARENA pattern=$PATTERN parallel=$PARALLEL"
  docker run -d --name "$CANDIDATE" --restart no \
    --network "$NETWORK" --network-alias "$CANDIDATE" \
    --cpus=2.0 --cpu-shares=128 --memory=2g --memory-swap=2g --pids-limit=128 \
    --env-file "$SECRETS" -e PORT=8080 \
    -e FORZA_TTS_RESIDENT_ACOUSTIC=1 -e FORZA_TTS_RESIDENT_G2P=1 \
    -e FORZA_TTS_WARMUP=1 -e FORZA_TTS_STREAM_FIRST_TOKENS=18 \
    -e "FORZA_TTS_PARALLEL_CHUNKS=$PARALLEL" \
    -e "FORZA_CPU_INTRA=$INTRA" -e "FORZA_CPU_ARENA=$ARENA" \
    -e "FORZA_CPU_PATTERN=$PATTERN" "$IMAGE" >/dev/null
  READY=0
  for i in $(seq 1 90); do
    if docker exec "$SITE" node -e '
      fetch("http://forza-pocket-cpu-eval:8080/health",{signal:AbortSignal.timeout(2000)})
        .then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))
    ' >/dev/null 2>&1; then READY=1; break; fi
    if [ "$(docker inspect -f '{{.State.Running}}' "$CANDIDATE")" != true ]; then break; fi
    sleep 2
  done
  if [ "$READY" -ne 1 ]; then docker logs --tail 80 "$CANDIDATE" >&2; exit 1; fi
  test "$(docker exec "$CANDIDATE" sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')" = "$VOICE_SHA"
  test "$(docker exec "$CANDIDATE" sha256sum /app/vendor/persian_tts/forza_voice_state.npz | awk '{print $1}')" = "$STATE_SHA"
  docker exec -i -e "FORZA_VOICE_TOKEN=$TOKEN" -e "FORZA_CPU_PROFILE=$NAME" "$SITE" node - <<'JS'
(async()=>{
 const phrases=[
  'سلام، من فورزا هستم و برای راهنمایی انتخاب قطعات صنعتی در خدمت شما هستم.',
  'برای انتخاب قطعه مناسب، شماره فنی و مشخصات دستگاه را بفرمایید تا موجودی و گزینه‌های سازگار را بررسی کنم.'
 ];
 for(let i=0;i<phrases.length;i++){
  const started=performance.now();
  const r=await fetch('http://forza-pocket-cpu-eval:8080/speak-stream',{
   method:'POST',
   headers:{'Content-Type':'application/json','X-Forza-Voice-Token':process.env.FORZA_VOICE_TOKEN},
   body:JSON.stringify({text:phrases[i]}),signal:AbortSignal.timeout(95000)
  });
  if(!r.ok||!r.body)throw Error('bad_http_'+r.status);
  if(r.headers.get('x-forza-voice')!=='pocket-farsi-v2')throw Error('voice_mismatch');
  let buf=Buffer.alloc(0),frames=0,first=0,firstAt=0,lastAt=0,audioMs=0,gapMs=0,underflowMs=0;
  for await(const block of r.body){
   buf=Buffer.concat([buf,Buffer.from(block)]);
   while(buf.length>=4){
    const n=buf.readUInt32LE(0);
    if(n<44||n>1500000)throw Error('bad_frame_length');
    if(buf.length<4+n)break;
    const wav=buf.subarray(4,4+n);
    if(wav.toString('ascii',0,4)!=='RIFF' || wav.toString('ascii',8,12)!=='WAVE' ||
     wav.readUInt32LE(24)!==24000 || wav.readUInt16LE(22)!==1 || wav.readUInt16LE(34)!==16)
     throw Error('bad_wav_header');
    const now=performance.now();
    if(!frames){first=Math.round(now-started);firstAt=now;}
    else {
     gapMs=Math.max(gapMs,now-lastAt);
     underflowMs=Math.max(underflowMs,Math.max(0,now-firstAt-audioMs));
    }
    lastAt=now;frames++;audioMs+=(n-44)/48;
    buf=buf.subarray(n+4);
   }
  }
  if(buf.length||!frames)throw Error('incomplete_frames');
  const total=performance.now()-started;
  console.log('FORZA_CPU_RESULT profile='+process.env.FORZA_CPU_PROFILE+
   ' phrase='+(i+1)+' first_wav_ms='+first+' total_ms='+Math.round(total)+
   ' frames='+frames+' audio_s='+(audioMs/1000).toFixed(2)+
   ' rtf='+(total/audioMs).toFixed(3)+
   ' max_frame_gap_ms='+Math.round(gapMs)+' audio_underrun_ms='+Math.round(underflowMs));
 }
})().catch(e=>{console.error('FORZA_CPU_PROFILE_FAILED',e.message);process.exit(1)})
JS
  docker stats --no-stream --format "FORZA_CPU_STATS name=$NAME memory={{.MemUsage}} cpu={{.CPUPerc}}" "$CANDIDATE"
  if docker exec "$CANDIDATE" test -r /sys/fs/cgroup/memory.peak; then
    PEAK=$(docker exec "$CANDIDATE" cat /sys/fs/cgroup/memory.peak)
    echo "FORZA_CPU_PEAK name=$NAME bytes=$PEAK"
    test "$PEAK" -lt 1850000000 || { echo "Memory limit warning" >&2; exit 1; }
  fi
  test "$(docker inspect -f '{{.State.OOMKilled}}' "$CANDIDATE")" = false
  docker logs --tail 70 "$CANDIDATE" 2>&1 | grep -E 'g2p_ready_ms|warmup_ms|synthesis_ms=|first_chunk_ms|inter_chunk_gap_ms' || true
  docker rm -f "$CANDIDATE" >/dev/null
  test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
  test "$(docker inspect -f '{{.State.Running}}' "$SITE")" = true
  echo "FORZA_CPU_PROFILE_DONE $NAME"
done
echo "[4/5] Checking live site and Pocket voice remain up."
docker ps --filter "name=^/(forza-voice|sanatpish-new)$" --format '{{.Names}} {{.Status}}'
echo "[5/5] FINISHED: compare first_wav_ms, RTF and audio_underrun_ms across profiles."
echo "FORZA_CPU_OPT_BENCH_PASS revision=$REV same_voice_sha256=$VOICE_SHA"
echo "No live worker, Nginx, xKiro, Supabase, voice reference or weights were changed."
