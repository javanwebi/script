#!/usr/bin/env bash
# Compare the SAME original Pocket FlowLM FP32 vs weight-only INT4.
# No generated WAV is written to disk. No live service is changed.
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
umask 077
test "$EUID" -eq 0 || { echo "Run as root" >&2; exit 1; }
APP=/opt/sanatpish
LIVE=forza-voice
SITE=sanatpish-new
CANDIDATE=forza-original-int4-eval
QUANT_CONTAINER=forza-original-int4-build
SECRETS=/etc/sanatpish/forza-voice.env
test -d "$APP/.git" && test -r "$SECRETS"
test "$(git -C "$APP" remote get-url origin)" = https://github.com/javanwebi/script.git
for name in "$LIVE" "$SITE"; do
  test "$(docker inspect -f '{{.State.Running}}' "$name")" = true
done
for name in "$CANDIDATE" "$QUANT_CONTAINER"; do
  ! docker container inspect "$name" >/dev/null 2>&1 || {
    echo "Refusing to replace existing $name" >&2; exit 1;
  }
done
MEMKB=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
DISKKB=$(df -Pk / | awk 'NR==2 {print $4}')
test "$MEMKB" -ge 2600000 || { echo "Not enough available RAM (2.6 GiB required)" >&2; exit 1; }
test "$DISKKB" -ge 4194304 || { echo "Not enough free disk (4 GiB required)" >&2; exit 1; }
TOKEN=$(sed -n 's/^FORZA_VOICE_TOKEN=//p' "$SECRETS" | head -1)
test "${#TOKEN}" -eq 64 || { echo "Invalid private voice token" >&2; exit 1; }
PARENT=$(docker inspect -f '{{.Config.Image}}' "$LIVE")
[[ "$PARENT" =~ ^[a-zA-Z0-9_./:@-]+$ ]] || exit 1
docker image inspect "$PARENT" >/dev/null
NETWORK=$(docker inspect -f '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -Fx supabase_default | head -1 || true)
if [ -z "$NETWORK" ]; then
  NETWORK=$(docker inspect -f '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -v '^bridge$' | head -1 || true)
fi
test -n "$NETWORK"
VOICE_SHA=$(docker exec "$LIVE" sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')
STATE_SHA=$(docker exec "$LIVE" sha256sum /app/vendor/persian_tts/forza_voice_state.npz | awk '{print $1}')
test "$VOICE_SHA" = 31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833 || { echo "Wrong original voice" >&2; exit 1; }
test "${#STATE_SHA}" -eq 64
STAGE=$(mktemp -d /opt/forza-onnx-tune.XXXXXXXX)
FLOAT_IMAGE=""
QUANT_IMAGE=""
cleanup(){
  rc=$?
  trap - EXIT INT TERM
  docker rm -f "$CANDIDATE" "$QUANT_CONTAINER" >/dev/null 2>&1 || true
  if [ -n "$QUANT_IMAGE" ]; then docker image rm "$QUANT_IMAGE" >/dev/null 2>&1 || true; fi
  if [ -n "$FLOAT_IMAGE" ]; then docker image rm "$FLOAT_IMAGE" >/dev/null 2>&1 || true; fi
  rm -rf -- "$STAGE"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
echo "FORZA_TUNE_HOST cores=$(nproc) available_ram_kib=$MEMKB free_disk_kib=$DISKKB"
grep -m1 'model name' /proc/cpuinfo || true
docker stats --no-stream "$LIVE" "$SITE" || true
echo "[1/4] Build isolated tunable image based on *live* Pocket weights and voice."
git -C "$APP" fetch --quiet origin main
REV=$(git -C "$APP" rev-parse origin/main)
git -C "$APP" archive --format=tar "$REV" \
  scripts/forza_voice_http.py scripts/forza_pocket_worker.py scripts/forza_pocket_overlap.py \
  scripts/forza_quantize_original_flow_int4.py scripts/forza_patch_int4_parent.py |
  tar -xf - -C "$STAGE"
grep -q 'CPU_INTRA = int(os.environ.get' "$STAGE/scripts/forza_pocket_worker.py"
! grep -q 'audio_cache' "$STAGE/scripts/forza_voice_http.py" || {
  echo "Expected no WAV cache in private service." >&2; exit 1;
}
cat > "$STAGE/Dockerfile" <<'DOCKER'
ARG VOICE_PARENT
FROM ${VOICE_PARENT}
# The base Pocket image may carry an old ORT lacking any INT4 quantizer.
# This pinned runtime is for the disposable candidate ONLY; production untouched.
# Persistent *build* download cache survives failed builds; never used
# for customer WAV/PCM or live application data.
# The international PyPI endpoint may be slow or intermittently inaccessible.
RUN --mount=type=cache,id=forza-int4-pip-download-cache,target=/root/.cache/pip \
    python -m pip --timeout 180 --retries 10 install \
      --disable-pip-version-check --only-binary=:all: \
      'onnxruntime==1.23.2' 'onnx>=1.16,<2'
RUN python - <<'PY'
import onnxruntime as ort
from onnxruntime.quantization import matmul_nbits_quantizer as q
assert ort.__version__ == "1.23.2"
assert hasattr(q, "MatMulNBitsQuantizer")
assert hasattr(q, "DefaultWeightOnlyQuantConfig")
print("FORZA_INT4_ORT_READY version="+ort.__version__, flush=True)
PY
COPY scripts/forza_voice_http.py /app/scripts/
COPY scripts/forza_pocket_worker.py /app/scripts/
COPY scripts/forza_pocket_overlap.py /app/scripts/
COPY scripts/forza_quantize_original_flow_int4.py /app/scripts/
COPY scripts/forza_patch_int4_parent.py /app/scripts/
RUN python /app/scripts/forza_patch_int4_parent.py
DOCKER
FLOAT_IMAGE="sanatpish/forza-original-int4:float-${REV:0:12}-$$"
QUANT_IMAGE="sanatpish/forza-original-int4:int4-${REV:0:12}-$$"
# Retry via host's existing network stack if Docker bridge DNS or
# networking cannot reliably reach files.pythonhosted.org.
# Host mode is used ONLY during build of a disposable, untrusted-restricted
# image; no ports are exposed and no running containers are modified.
if ! docker build --pull=false --network=default \
  --build-arg "VOICE_PARENT=$PARENT" \
  -f "$STAGE/Dockerfile" -t "$FLOAT_IMAGE" "$STAGE"; then
  echo "FORZA_INT4_PIP_BUILD_RETRY network=host original_voice_unchanged=1" >&2
  docker build --pull=false --network=host \
    --build-arg "VOICE_PARENT=$PARENT" \
    -f "$STAGE/Dockerfile" -t "$FLOAT_IMAGE" "$STAGE"
fi
echo "FORZA_INT4_PIP_BUILD_OK original_voice_unchanged=1"
echo "[2/4] Convert original Pocket MatMul weights to INT4 in a RAM-capped candidate (no audio output files)."
if docker run --name "$QUANT_CONTAINER" --restart no --cpus 1 \
  --memory 2g --memory-swap 2g --pids-limit 96 \
  "$FLOAT_IMAGE" python /app/scripts/forza_quantize_original_flow_int4.py; then
  docker commit --change 'CMD ["python", "-u", "scripts/forza_voice_http.py"]' "$QUANT_CONTAINER" "$QUANT_IMAGE" >/dev/null
  echo "FORZA_ORIGINAL_INT4_CANDIDATE_READY"
else
  echo "FORZA_INT4_CONVERSION_FAILED: no INT4 speed comparison; original Pocket unchanged" >&2
  exit 1
fi
docker rm -f "$QUANT_CONTAINER" >/dev/null 2>&1 || true
echo "[3/4] Serial A/B performance: each candidate max 2 vCPU / 2 GiB."
PROFILES=(fp32:1:0)
if [ -n "$QUANT_IMAGE" ];then PROFILES+=(int4:1:1);fi
for SPEC in "${PROFILES[@]}";do
  IFS=: read -r NAME INTRA QUANT <<< "$SPEC"
  test "$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)" -ge 1800000 || {
    echo "RAM pressure: safely stop" >&2; exit 1;
  }
  TAG="$FLOAT_IMAGE"
  if [ "$QUANT" = 1 ];then TAG="$QUANT_IMAGE";fi
  PARALLEL=1
  if [ "$INTRA" = 2 ];then PARALLEL=1;fi
  echo "FORZA_INT4_PROFILE_START name=$NAME intra=$INTRA int4=$QUANT parallel=$PARALLEL"
  docker run -d --name "$CANDIDATE" --restart no \
    --network "$NETWORK" --network-alias "$CANDIDATE" \
    --cpus 2 --cpu-shares 128 --memory 2g --memory-swap 2g --pids-limit 128 \
    --env-file "$SECRETS" -e PORT=8080 \
    -e FORZA_TTS_RESIDENT_ACOUSTIC=1 -e FORZA_TTS_RESIDENT_G2P=1 \
    -e FORZA_TTS_WARMUP=1 -e "FORZA_TTS_PARALLEL_CHUNKS=$PARALLEL" \
    -e FORZA_TTS_STREAM_FIRST_TOKENS=12 -e FORZA_TTS_UNBROKEN=1 \
    -e FORZA_TTS_OVERLAP_MIMI=1 -e FORZA_TTS_RETRY_ATTEMPTS=1 \
    -e FORZA_TTS_STAGE_PROFILE=1 -e FORZA_TTS_TEST_SEED=12345 \
    -e "FORZA_CPU_INTRA=$INTRA" -e "FORZA_ONNX_INT4=$QUANT" \
    "$TAG" >/dev/null
  READY=0
  for attempt in $(seq 1 90);do
    if docker exec "$SITE" node -e '
      fetch("http://forza-original-int4-eval:8080/health",{signal:AbortSignal.timeout(2000)})
      .then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))
    ' >/dev/null 2>&1;then READY=1;break;fi
    if [ "$(docker inspect -f '{{.State.Running}}' "$CANDIDATE")" != true ];then break;fi
    sleep 2
  done
  if [ "$READY" -ne 1 ];then docker logs --tail 60 "$CANDIDATE" >&2;docker rm -f "$CANDIDATE" >/dev/null;continue;fi
  test "$(docker exec "$CANDIDATE" sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')" = "$VOICE_SHA"
  test "$(docker exec "$CANDIDATE" sha256sum /app/vendor/persian_tts/forza_voice_state.npz | awk '{print $1}')" = "$STATE_SHA"
  if docker exec -i -e "FORZA_VOICE_TOKEN=$TOKEN" -e "PROFILE=$NAME" "$SITE" node - <<'JS'
const {createHash}=require('node:crypto');
(async()=>{
 const start=performance.now();
 const res=await fetch('http://forza-original-int4-eval:8080/speak-stream',{
  method:'POST',
  headers:{'Content-Type':'application/json','X-Forza-Voice-Token':process.env.FORZA_VOICE_TOKEN},
  body:JSON.stringify({text:'سلام، من فورزا هستم.'}),signal:AbortSignal.timeout(180000)
 });
 if(!res.ok||res.headers.get('x-forza-voice')!=='pocket-farsi-v2')throw Error('invalid_voice_http_'+res.status);
 const digest=createHash('sha256');
 let left=Buffer.alloc(0),frames=0,first=0,audioMs=0,bytes=0;
 for await(const data of res.body){
  left=Buffer.concat([left,Buffer.from(data)]);
  if(left.length>9000000)throw Error('oversize');
  while(left.length>=4){
   const n=left.readUInt32LE(0);
   if(n<44||n>5000000)throw Error('invalid_frame_length');
   if(left.length<n+4)break;
   const wav=left.subarray(4,n+4);
   if(wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE'||wav.readUInt32LE(24)!==24000||wav.readUInt16LE(22)!==1||wav.readUInt16LE(34)!==16)throw Error('bad_pcm');
   if(!frames)first=performance.now()-start;
   digest.update(wav);frames++;bytes+=n;audioMs+=(n-44)/48;
   left=left.subarray(n+4);
  }
 }
 if(left.length||frames!==1||audioMs<300)throw Error('incomplete_voice');
 const total=performance.now()-start;
 console.log('FORZA_INT4_RESULT profile='+process.env.PROFILE+' first_ms='+Math.round(first)+' total_ms='+Math.round(total)+' audio_seconds='+(audioMs/1000).toFixed(3)+' wav_bytes='+bytes+' wav_sha256='+digest.digest('hex')+' pass_1000ms='+(total<=1000?1:0));
})().catch(e=>{console.error('FORZA_INT4_FAILED '+process.env.PROFILE+' '+e.message);process.exit(1)})
JS
  then echo "FORZA_INT4_PROFILE_PASS $NAME"; else echo "FORZA_INT4_PROFILE_FAILED $NAME" >&2;fi
  docker stats --no-stream --format "FORZA_TUNE_STATS profile=$NAME memory={{.MemUsage}} cpu={{.CPUPerc}}" "$CANDIDATE"
  if docker exec "$CANDIDATE" test -r /sys/fs/cgroup/memory.peak; then
    echo "FORZA_TUNE_MEMORY_PEAK profile=$NAME bytes=$(docker exec "$CANDIDATE" cat /sys/fs/cgroup/memory.peak)"
  fi
  docker rm -f "$CANDIDATE" >/dev/null
  test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
  test "$(docker inspect -f '{{.State.Running}}' "$SITE")" = true
done
echo "[4/4] Finished. INT4 is NOT promoted without real speed and voice-quality review."
echo "FORZA_INT4_BENCH_DONE revision=$REV voice_sha256=$VOICE_SHA"
echo "No generated WAV was written to disk. Live Pocket TTS, website and database unchanged."
