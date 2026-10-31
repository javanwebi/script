#!/usr/bin/env bash
# Isolated VPS-only custom Piper ONNX voice performance gate.
# Requires a trained & reviewed private ONNX from the GPU training process.
# Does not stop, restart, replace or reconfigure production FORZA services.
set -Eeuo pipefail
umask 077
abort(){ echo "FORZA_CUSTOM_CPU_ABORT $*" >&2; exit 1; }
test "$EUID" -eq 0 || abort "run_with_sudo"
for cmd in docker python3 awk; do command -v "$cmd" >/dev/null || abort "missing=$cmd"; done
for container in forza-voice sanatpish-new; do
  test "$(docker inspect -f '{{.State.Running}}' "$container")" = true || abort "live_missing=$container"
done
test "$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)" -ge 2000000 || abort "insufficient_ram"
MODEL="${FORZA_CUSTOM_MODEL:?Set FORZA_CUSTOM_MODEL to private trained *.onnx file}"
test -f "$MODEL" && test -f "$MODEL.json" || abort "missing_private_model_and_json"
MODEL="$(realpath "$MODEL")"
MODEL_DIR="$(dirname "$MODEL")"
MODEL_NAME="$(basename "$MODEL")"
case "$MODEL_NAME" in *.onnx) ;; *) abort "expected_onnx_filename" ;; esac
IMAGE="${FORZA_CUSTOM_PIPER_IMAGE:-sanatpish/piper-eval:1.8.0}"
docker image inspect "$IMAGE" >/dev/null || abort "missing_benchmark_image_see_docs"
CANDIDATE=forza-custom-piper-cpu-eval
! docker container inspect "$CANDIDATE" >/dev/null 2>&1 || abort "candidate_name_already_in_use"
APP=/opt/sanatpish
test -s "$APP/scripts/forza_piper_custom_benchmark.py" || abort "missing_benchmark_source"
echo "FORZA_CUSTOM_CPU_START model=$MODEL_NAME cpu_limit=2 memory_limit_mib=1536 output=in_memory"
docker run --rm --name "$CANDIDATE" --restart no \
  --network none --cpus=2 --cpu-shares=128 \
  --memory=1536m --memory-swap=1536m --pids-limit=96 \
  --read-only --tmpfs /tmp:rw,nosuid,nodev,size=64m \
  -e OMP_NUM_THREADS=1 -e OPENBLAS_NUM_THREADS=1 -e MKL_NUM_THREADS=1 \
  --mount "type=bind,src=$MODEL_DIR,dst=/voice,readonly" \
  --mount "type=bind,src=$APP/scripts/forza_piper_custom_benchmark.py,dst=/probe/bench.py,readonly" \
  --entrypoint python "$IMAGE" /probe/bench.py --model "/voice/$MODEL_NAME" --target-rtf 0.335
test "$(docker inspect -f '{{.State.Running}}' forza-voice)" = true
test "$(docker inspect -f '{{.State.Running}}' sanatpish-new)" = true
echo "FORZA_CUSTOM_CPU_FINISHED live_unchanged=1 no_customer_wav_saved=1 no_promotion=1"
