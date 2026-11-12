#!/usr/bin/env bash
# Research-only: compare FP32 and Q4 of the SAME Persian Pocket Farsi v2
# export on the owner's current CPU. No text, voice output, or WAV saved.
# Does NOT switch any production service or infer a real user message.
set -Eeuo pipefail
umask 077
test "$EUID" -eq 0 || { echo "Run as root" >&2; exit 1; }
APP=/opt/sanatpish
SITE=sanatpish-new
LIVE=forza-voice
EXPECTED_SHA=31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833
test -d "$APP/.git"
for item in "$SITE" "$LIVE"; do test "$(docker inspect -f '{{.State.Running}}' "$item")" = true; done
ACTUAL_SHA=$(docker exec "$LIVE" sha256sum /app/public/forza-pocket-reference.wav 2>/dev/null | awk '{print $1}' || true)
test "$ACTUAL_SHA" = "$EXPECTED_SHA" || {
  echo "FORZA_Q4_PROBE_SKIP active Pocket voice not verified; live unchanged." >&2; exit 1;
}
IMAGE=$(docker inspect -f '{{.Image}}' "$LIVE")
docker image inspect "$IMAGE" >/dev/null
test "$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)" -ge 2400000 || {
  echo "FORZA_Q4_PROBE_SKIP need 2.4 GiB free RAM; live unchanged." >&2; exit 1;
}
test "$(df -Pk / | awk 'NR==2 {print $4}')" -ge 3600000 || {
  echo "FORZA_Q4_PROBE_SKIP need at least 3.6 GB free disk for temporary model weights." >&2; exit 1;
}
STAGE=$(mktemp -d /opt/forza-pocket-q4-probe.XXXXXXXX)
cleanup(){
  local rc=$?
  trap - EXIT INT TERM
  rm -rf -- "$STAGE"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "FORZA_Q4_CPU_PROBE_START voice_sha256=$ACTUAL_SHA host_cpus=$(nproc)"
docker run --rm -i --restart no \
  --network bridge --cpus=2 --cpu-shares=128 \
  --memory=2g --memory-swap=2g --pids-limit=128 --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,size=96m \
  -v "$STAGE:/probe:rw" \
  -e HF_HOME=/probe/hf \
  -e HF_HUB_DISABLE_TELEMETRY=1 \
  -e OMP_NUM_THREADS=1 -e OPENBLAS_NUM_THREADS=1 \
  --entrypoint python "$IMAGE" - <<'PY'
import gc
import statistics
import time
from pathlib import Path
import numpy as np
import onnxruntime as ort
from huggingface_hub import HfApi, hf_hub_download

model="mrfakename/pocket-tts-farsi-v2-ONNX"
api=HfApi()
revision=api.model_info(model).sha
print("FORZA_Q4_SOURCE model=%s sha=%s" % (model,revision),flush=True)
files=("onnx/flow_lm_step_q4.onnx","onnx/flow_lm_step.onnx")
root=Path("/probe")
for path in files:
    target=Path(hf_hub_download(repo_id=model,filename=path,revision=revision,local_dir=root))
    print("FORZA_Q4_DOWNLOAD file=%s size_bytes=%s" % (path,target.stat().st_size),flush=True)

def shape(dim):
    if isinstance(dim,int) and dim>=0:return dim
    return 1

def sample_inputs(session):
    feeds={}
    for inp in session.get_inputs():
        name=inp.name
        shp=[shape(v) for v in inp.shape]
        if "past_key" in name or "past_value" in name:
            shp=[1,16,1,64]
        elif name=="inputs_embeds":shp=[1,1,1024]
        elif name=="noise":shp=[1,32]
        dtype=np.float16 if "float16" in inp.type else np.float32
        if "int64" in inp.type:dtype=np.int64
        feeds[name]=np.zeros(shp,dtype=dtype)
    return feeds

def bench(path):
    settings=ort.SessionOptions()
    settings.intra_op_num_threads=1
    settings.inter_op_num_threads=1
    settings.graph_optimization_level=ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    load=time.perf_counter()
    session=ort.InferenceSession(str(root/path),settings,providers=["CPUExecutionProvider"])
    ready=(time.perf_counter()-load)*1000
    inputs=sample_inputs(session)
    for i in range(3):session.run(None,inputs)
    elapsed=[]
    for i in range(10):
        start=time.perf_counter()
        results=session.run(None,inputs)
        elapsed.append((time.perf_counter()-start)*1000)
    print("FORZA_Q4_CPU_STEP variant=%s load_ms=%.0f median_ms=%.2f max_ms=%.2f inputs=%d outputs=%d" %
          (path.name,ready,statistics.median(elapsed),max(elapsed),len(inputs),len(results)),flush=True)
    result=statistics.median(elapsed)
    del session,inputs,results
    gc.collect()
    return result

fp32=bench(Path(files[1]))
q4=bench(Path(files[0]))
print("FORZA_Q4_CPU_RATIO fp32_over_q4=%.3f q4_faster=%d" %
      (fp32/q4, int(q4<fp32)),flush=True)
print("FORZA_Q4_CPU_PROBE_PASS synthetic_operator_only=1 live_changed=0 customer_wav_saved=0",flush=True)
PY
test "$(docker inspect -f '{{.State.Running}}' "$SITE")" = true
test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
echo "FORZA_Q4_SAFE_TEST_COMPLETE original_service_unchanged=1 model_files_cleaned=1"
