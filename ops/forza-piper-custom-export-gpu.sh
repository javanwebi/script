#!/usr/bin/env bash
# Run ONNX export on the separate GPU training box. Never deploy automatically.
set -Eeuo pipefail
umask 077
abort(){ echo "FORZA_CUSTOM_EXPORT_ABORT $*" >&2; exit 1; }
PIPER_REPO="${FORZA_PIPER_REPO:?Set FORZA_PIPER_REPO}"
TRAIN_OUTPUT="${FORZA_TRAIN_OUTPUT:?Set FORZA_TRAIN_OUTPUT}"
CKPT="${FORZA_FINISHED_CKPT:?Set FORZA_FINISHED_CKPT to a trained checkpoint}"
test -f "$CKPT" || abort "checkpoint_missing"
test -s "$TRAIN_OUTPUT/forza-custom.onnx.json" || abort "training_config_missing"
test -x "$PIPER_REPO/.venv/bin/python" || abort "training_environment_missing"
test "${FORZA_VOICE_RIGHTS_CONFIRMED:-}" = yes || abort "voice_and_training_rights_not_confirmed"
mkdir -p "$TRAIN_OUTPUT/export"
OUTPUT="$TRAIN_OUTPUT/export/forza-custom-fa-medium.onnx"
echo "FORZA_CUSTOM_EXPORT_START output_dir_private=1 live_unchanged=1"
cd "$PIPER_REPO"
"$PIPER_REPO/.venv/bin/python" -m piper.train.export_onnx \
  --checkpoint "$CKPT" --output-file "$OUTPUT"
test -s "$OUTPUT" || abort "onnx_missing_after_export"
cp "$TRAIN_OUTPUT/forza-custom.onnx.json" "$OUTPUT.json"
python3 -m json.tool "$OUTPUT.json" >/dev/null || abort "bad_json_config"
echo "FORZA_CUSTOM_EXPORT_READY model_bytes=$(stat -c %s "$OUTPUT")"
echo "Do NOT promote without Persian pronunciation, voice-identity and full-WAV CPU A/B gates."
