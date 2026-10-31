#!/usr/bin/env bash
# Launch training ONLY on a separate GPU machine after explicit rights review.
# No VPS deployment, no mutation of the current Pocket/Amir voice service.
set -Eeuo pipefail
umask 077
abort(){ echo "FORZA_CUSTOM_TRAIN_ABORT $*" >&2; exit 1; }
test "${FORZA_VOICE_RIGHTS_CONFIRMED:-}" = yes || abort "voice_and_dataset_training_rights_not_confirmed"
command -v nvidia-smi >/dev/null || abort "training_requires_separate_nvidia_gpu_machine"
nvidia-smi -L | grep -q GPU || abort "no_gpu_detected"
APP="${FORZA_APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
PIPER_REPO="${FORZA_PIPER_REPO:?Set FORZA_PIPER_REPO to a vetted piper1-gpl checkout}"
DATASET="${FORZA_TRAIN_DATASET:?Set FORZA_TRAIN_DATASET to the private dataset directory}"
CHECKPOINT="${FORZA_PIPER_CKPT:?Set FORZA_PIPER_CKPT to a licensed medium-quality training checkpoint}"
OUTPUT="${FORZA_TRAIN_OUTPUT:?Set FORZA_TRAIN_OUTPUT to a private training results directory}"
test -f "$APP/scripts/forza_custom_voice_dataset_gate.py" || abort "missing_dataset_gate"
test -d "$PIPER_REPO/src/piper/train" || abort "missing_official_piper_training_source"
test -f "$CHECKPOINT" || abort "missing_medium_checkpoint"
test -f "$DATASET/metadata.csv" && test -d "$DATASET/wav" || abort "expected_private_dataset_metadata_and_wav"
test "$OUTPUT" != "$APP" && test "$OUTPUT" != "$PIPER_REPO" || abort "invalid_output_path"
# Reject project / git working-tree paths to prevent tracking private training samples.
case "$(realpath -m "$DATASET")/" in "$(realpath -m "$APP")/"*) abort "dataset_must_not_be_in_application_repo" ;; esac
case "$(realpath -m "$OUTPUT")/" in "$(realpath -m "$APP")/"*) abort "output_must_not_be_in_application_repo" ;; esac
python3 "$APP/scripts/forza_custom_voice_dataset_gate.py" \
  --csv "$DATASET/metadata.csv" --audio-dir "$DATASET/wav"
PIPER_PYTHON="$PIPER_REPO/.venv/bin/python"
test -x "$PIPER_PYTHON" || abort "install_piper_train_venv_first_see_docs"
mkdir -p "$OUTPUT"
cd "$PIPER_REPO"
echo "FORZA_CUSTOM_TRAIN_START model=piper1-gpl speaker=forza fa=1 sample_rate=22050 gpu=1 dataset_private=1"
echo "FORZA_CUSTOM_TRAIN_NOTES commercial_model_data_rights_required=1 checkpoint_medium_required=1"
# Piper1-GPL LightningCLI training interface, per upstream TRAINING.md.
exec "$PIPER_PYTHON" -m piper.train fit \
  --data.voice_name forza-custom \
  --data.csv_path "$DATASET/metadata.csv" \
  --data.audio_dir "$DATASET/wav" \
  --data.espeak_voice fa \
  --data.cache_dir "$OUTPUT/cache" \
  --data.config_path "$OUTPUT/forza-custom.onnx.json" \
  --data.batch_size "${FORZA_TRAIN_BATCH_SIZE:-8}" \
  --model.sample_rate 22050 \
  --trainer.accelerator gpu \
  --trainer.devices 1 \
  --trainer.max_epochs "${FORZA_TRAIN_MAX_EPOCHS:-100}" \
  --trainer.default_root_dir "$OUTPUT" \
  --ckpt_path "$CHECKPOINT"
