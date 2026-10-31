#!/usr/bin/env bash
# One-command training + ONNX export on an independent CUDA machine.
# Dataset has to be copied to this machine PRIVATELY first.
set -Eeuo pipefail
umask 077
abort(){ echo "FORZA_GPU_RUN_ABORT $*" >&2; exit 1; }
test "${FORZA_VOICE_RIGHTS_CONFIRMED:-}" = yes || abort "training_rights_not_confirmed"
test "$#" -eq 1 || abort "usage: bash ops/forza-piper-custom-run-gpu.sh --check|--train"
case "$1" in --check|--train) ;; *) abort "use_--check_or_--train" ;; esac
APP="${FORZA_APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
DATASET="${FORZA_TRAIN_DATASET:?Set FORZA_TRAIN_DATASET to private full directory}"
OUTPUT="${FORZA_TRAIN_OUTPUT:?Set FORZA_TRAIN_OUTPUT to private results directory}"
PIPER_REPO="${FORZA_PIPER_REPO:?Set FORZA_PIPER_REPO to Piper checkout}"
CHECKPOINT="${FORZA_PIPER_CKPT:?Set FORZA_PIPER_CKPT to licensed medium Piper checkpoint}"
test -d "$DATASET/wav" && test -s "$DATASET/metadata.csv" || abort "dataset_not_transferred"
test -f "$CHECKPOINT" || abort "missing_pretrained_checkpoint"
test -x "$PIPER_REPO/.venv/bin/python" || abort "run_bootstrap_first"
command -v nvidia-smi >/dev/null || abort "missing_nvidia_gpu"
nvidia-smi -L | grep -q GPU || abort "no_nvidia_gpu"
python3 "$APP/scripts/forza_custom_voice_dataset_gate.py" \
  --csv "$DATASET/metadata.csv" --audio-dir "$DATASET/wav" \
  --min-clips 728 --min-minutes 30 || abort "dataset_quality_gate_failed"
test ! -e "$OUTPUT" || test -d "$OUTPUT" || abort "output_must_be_directory"
echo "FORZA_GPU_PREFLIGHT_PASS dataset_clips_min=728 checkpoint_ready=1 production_unchanged=1"
if test "$1" = --check; then exit 0; fi
mkdir -p "$OUTPUT"
FORZA_APP_DIR="$APP" FORZA_TRAIN_DATASET="$DATASET" FORZA_TRAIN_OUTPUT="$OUTPUT" \
  FORZA_PIPER_REPO="$PIPER_REPO" FORZA_PIPER_CKPT="$CHECKPOINT" \
  bash "$APP/ops/forza-piper-custom-train-gpu.sh"
# Train returns only when configured epochs complete. Never export a partial model.
CKPT=$(find "$OUTPUT" -type f -name '*.ckpt' -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d ' ' -f 2-)
test -n "$CKPT" && test -s "$CKPT" || abort "no_completed_training_checkpoint"
echo "FORZA_GPU_TRAIN_DONE ckpt=$(basename "$CKPT")"
FORZA_FINISHED_CKPT="$CKPT" FORZA_PIPER_REPO="$PIPER_REPO" \
  FORZA_TRAIN_OUTPUT="$OUTPUT" bash "$APP/ops/forza-piper-custom-export-gpu.sh"
MODEL="$OUTPUT/export/forza-custom-fa-medium.onnx"
test -s "$MODEL" && test -s "$MODEL.json" || abort "onnx_export_missing"
sha256sum "$MODEL" "$MODEL.json"
echo "FORZA_GPU_MODEL_READY model=$MODEL production_unchanged=1 human_voice_review_required=1 cpu_benchmark_required=1"
