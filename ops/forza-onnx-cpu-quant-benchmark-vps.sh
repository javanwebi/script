#!/usr/bin/env bash
# Compare single-WAV Pocket Farsi: FP32/intra1, FP32/intra2, INT8/intra2.
# No generated WAV is written to disk. No live service is changed.
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
umask 077
test "$EUID" -eq 0 || { echo "Run as root" >&2; exit 1; }
APP=/opt/sanatpish
LIVE=forza-voice
SITE=sanatpish-new
CANDIDATE=forza-tuning-eval
QUANT_CONTAINER=forza-tuning-quant-build
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
test "$DISKKB" -ge 3145728 || { echo "Not enough free disk (3 GiB required)" >&2; exit 1; }
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
test "${#VOICE_SHA}" -eq 64
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
  scripts/forza_voice_http.py scripts/forza_pocket_worker.py scripts/forza_quantize_flow.py |
  tar -xf - -C "$STAGE"
grep -q 'CPU_INTRA = int(os.environ.get' "$STAGE/scripts/forza_pocket_worker.py"
! grep -q 'audio_cache' "$STAGE/scripts/forza_voice_http.py" || {
  echo "Expected no WAV cache in private service." >&2; exit 1;
}
cat > "$STAGE/Dockerfile" <<'DOCKER'
ARG VOICE_PARENT
FROM ${VOICE_PARENT}
COPY scripts/forza_voice_http.py /app/scripts/forza_voice_http.py
COPY scripts/forza_pocket_worker.py /app/scripts/forza_pocket_worker.py
COPY scripts/forza_quantize_flow.py /app/scripts/forza_quantize_flow.py
# The installed parent has hard-coded ORT intra=1; only this disposable
# derivative gets configurable ONNX threading and a selected INT8 flow graph.
RUN python3 - <<'PY'
from pathlib import Path
p=Path("/app/vendor/persian_tts/scripts/tts_onnx.py")
s=p.read_text()
patches={
  'opts.intra_op_num_threads = 1':
    'opts.intra_op_num_threads = int(os.environ.get("FORZA_CPU_INTRA", "1"))',
  'opts.enable_cpu_mem_arena = False':
    'opts.enable_cpu_mem_arena = os.environ.get("FORZA_CPU_ARENA", "0") == "1"',
  'opts.enable_mem_pattern = False':
    'opts.enable_mem_pattern = os.environ.get("FORZA_CPU_PATTERN", "0") == "1"',
  'str(self.dir / "flow_lm_step.onnx")':
    'str(self.dir / ("flow_lm_step.int8.onnx" if os.environ.get("FORZA_ONNX_INT8") == "1" else "flow_lm_step.onnx"))',
}
for a,b in patches.items():
    if s.count(a)!=1:raise RuntimeError("Unexpected upstream ORT patch anchor "+a)
    s=s.replace(a,b,1)
p.write_text(s)
PY
RUN python -m pip install --no-cache-dir "onnx>=1.16,<2"
DOCKER
FLOAT_IMAGE="sanatpish/forza-tuning:float-${REV:0:12}"
QUANT_IMAGE="sanatpish/forza-tuning:int8-${REV:0:12}"
docker build --pull=false --build-arg "VOICE_PARENT=$PARENT" \
  -f "$STAGE/Dockerfile" -t "$FLOAT_IMAGE" "$STAGE" >/dev/null
echo "[2/4] Convert MatMul/Gemm flow weights to INT8 in a RAM-capped candidate (no audio output files)."
if docker run --name "$QUANT_CONTAINER" --restart no --cpus 1 \
  --memory 2g --memory-swap 2g --pids-limit 96 \
  "$FLOAT_IMAGE" python /app/scripts/forza_quantize_flow.py; then
  docker commit --change 'CMD ["python", "-u", "scripts/forza_voice_http.py"]' "$QUANT_CONTAINER" "$QUANT_IMAGE" >/dev/null
  echo "FORZA_QUANT_CANDIDATE_READY"
else
  echo "FORZA_QUANT_FAILED_OR_UNSUPPORTED: float profiles remain usable" >&2
  QUANT_IMAGE=""
fi
docker rm -f "$QUANT_CONTAINER" >/dev/null 2>&1 || true
echo "[3/4] Serial A/B performance: each candidate max 2 vCPU / 2 GiB."
PROFILES=(float1:1:0 float2:2:0)
if [ -n "$QUANT_IMAGE" ];then PROFILES+=(int8:2:1);fi
for SPEC in "${PROFILES[@]}";do
  IFS=: read -r NAME INTRA QUANT <<< "$SPEC"
  test "$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)" -ge 1800000 || {
    echo "RAM pressure: safely stop" >&2; exit 1;
  }
  TAG="$FLOAT_IMAGE"
  if [ "$QUANT" = 1 ];then TAG="$QUANT_IMAGE";fi
  PARALLEL=2
  if [ "$INTRA" = 2 ];then PARALLEL=1;fi
  echo "FORZA_TUNE_PROFILE_START name=$NAME intra=$INTRA int8=$QUANT parallel=$PARALLEL"
  docker run -d --name "$CANDIDATE" --restart no \
    --network "$NETWORK" --network-alias "$CANDIDATE" \
    --cpus 2 --cpu-shares 128 --memory 2g --memory-swap 2g --pids-limit 128 \
    --env-file "$SECRETS" -e PORT=8080 \
    -e FORZA_TTS_RESIDENT_ACOUSTIC=1 -e FORZA_TTS_RESIDENT_G2P=1 \
    -e FORZA_TTS_WARMUP=1 -e "FORZA_TTS_PARALLEL_CHUNKS=$PARALLEL" \
    -e "FORZA_CPU_INTRA=$INTRA" -e "FORZA_ONNX_INT8=$QUANT" \
    "$TAG" >/dev/null
  READY=0
  for attempt in $(seq 1 90);do
    if docker exec "$SITE" node -e '
      fetch("http://forza-tuning-eval:8080/health",{signal:AbortSignal.timeout(2000)})
      .then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))
    ' >/dev/null 2>&1;then READY=1;break;fi
    if [ "$(docker inspect -f '{{.State.Running}}' "$CANDIDATE")" != true ];then break;fi
    sleep 2
  done
  if [ "$READY" -ne 1 ];then docker logs --tail 60 "$CANDIDATE" >&2;docker rm -f "$CANDIDATE" >/dev/null;continue;fi
  test "$(docker exec "$CANDIDATE" sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')" = "$VOICE_SHA"
  test "$(docker exec "$CANDIDATE" sha256sum /app/vendor/persian_tts/forza_voice_state.npz | awk '{print $1}')" = "$STATE_SHA"
  if docker exec -i -e "FORZA_VOICE_TOKEN=$TOKEN" -e "PROFILE=$NAME" "$SITE" node - <<'JS'
(async()=>{
 const text='سلام، من فورزا هستم و می‌توانم برای انتخاب قطعات صنعتی به شما کمک کنم. لطفاً کد و مشخصات قطعه مورد نیاز را بفرمایید.';
 const started=performance.now();
 const res=await fetch('http://forza-tuning-eval:8080/speak',{
  method:'POST',headers:{'Content-Type':'application/json','X-Forza-Voice-Token':process.env.FORZA_VOICE_TOKEN},
  body:JSON.stringify({text}),signal:AbortSignal.timeout(420000)
 });
 if(!res.ok||!(res.headers.get('content-type')||'').includes('audio/wav'))
   throw Error('invalid_http_'+res.status);
 const wav=Buffer.from(await res.arrayBuffer());
 if(wav.length<44||wav.length>8000000||wav.toString('ascii',0,4)!=='RIFF'||
  wav.toString('ascii',8,12)!=='WAVE'||wav.readUInt32LE(24)!==24000)
  throw Error('invalid_complete_wav');
 const elapsed=performance.now()-started, audio=(wav.length-44)/48000;
 if(audio<3||audio>30)throw Error('unusual_audio_duration');
 const sampleCount=Math.floor((wav.length-44)/2);
 let sum=0;for(let i=44;i+1<wav.length;i+=2){const v=wav.readInt16LE(i)/32768;sum+=v*v;}
 const rms=Math.sqrt(sum/sampleCount);
 if(rms<0.015)throw Error('silent_or_weak_wav');
 console.log('FORZA_TUNE_RESULT profile='+process.env.PROFILE+
  ' chars='+text.length+' wav_bytes='+wav.length+' elapsed_ms='+Math.round(elapsed)+
  ' audio_seconds='+audio.toFixed(2)+' rtf='+(elapsed/(audio*1000)).toFixed(3)+
  ' rms='+rms.toFixed(3));
})().catch(e=>{console.error('FORZA_TUNE_FAIL profile='+process.env.PROFILE,e.message);process.exit(1)})
JS
  then echo "FORZA_TUNE_PROFILE_PASS $NAME"; else echo "FORZA_TUNE_PROFILE_FAILED $NAME" >&2;fi
  docker stats --no-stream --format "FORZA_TUNE_STATS profile=$NAME memory={{.MemUsage}} cpu={{.CPUPerc}}" "$CANDIDATE"
  if docker exec "$CANDIDATE" test -r /sys/fs/cgroup/memory.peak; then
    echo "FORZA_TUNE_MEMORY_PEAK profile=$NAME bytes=$(docker exec "$CANDIDATE" cat /sys/fs/cgroup/memory.peak)"
  fi
  docker rm -f "$CANDIDATE" >/dev/null
  test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
  test "$(docker inspect -f '{{.State.Running}}' "$SITE")" = true
done
echo "[4/4] Finished. Quantization is NOT promoted without quality comparison."
echo "FORZA_TUNE_BENCH_DONE revision=$REV voice_sha256=$VOICE_SHA"
echo "No generated WAV was written to the server disk. No live service was modified."
