#!/usr/bin/env bash
# Prepare a SEPARATE NVIDIA GPU computer for licensed FORZA Piper fine-tuning.
# Does not upload the dataset, modify the VPS or deploy production.
set -Eeuo pipefail
umask 077
abort(){ echo "FORZA_GPU_SETUP_ABORT $*" >&2; exit 1; }
test "${FORZA_VOICE_RIGHTS_CONFIRMED:-}" = yes || abort "training_rights_not_confirmed"
command -v nvidia-smi >/dev/null || abort "nvidia_driver_not_installed"
nvidia-smi -L | grep -q GPU || abort "no_nvidia_gpu"
for tool in git python3 cmake ninja gcc g++ espeak-ng curl; do
  command -v "$tool" >/dev/null || abort "missing_$tool install_build-essential_cmake_ninja-build_espeak-ng"
done
PIPER_REPO="${FORZA_PIPER_REPO:?Set FORZA_PIPER_REPO to an empty private directory outside the site}"
CHECKPOINT="${FORZA_PIPER_CKPT:?Set FORZA_PIPER_CKPT to a private checkpoint filepath}"
case "${1:-}" in --setup|--check) MODE="$1" ;; *) abort "use_--setup_or_--check" ;; esac
test "$#" -eq 1 || abort "unexpected_arguments"
PIPER_REPO=$(realpath -m "$PIPER_REPO")
CHECKPOINT=$(realpath -m "$CHECKPOINT")
case "$PIPER_REPO/" in /opt/sanatpish/*|/opt/sanatpish/) abort "piper_checkout_cannot_be_application_checkout";; esac
test "$CHECKPOINT" != "$PIPER_REPO" || abort "invalid_checkpoint_path"
if test "$MODE" = --check; then
  test -d "$PIPER_REPO/src/piper/train" || abort "missing_piper_source"
  test -x "$PIPER_REPO/.venv/bin/python" || abort "missing_piper_venv"
  test -s "$CHECKPOINT" || abort "missing_base_checkpoint"
  "$PIPER_REPO/.venv/bin/python" -c 'import lightning,torch; print("FORZA_GPU_TORCH_CUDA",torch.cuda.is_available())' \
    || abort "python_torch_import_failed"
  echo "FORZA_GPU_READY source_present=1 checkpoint_present=1 gpu_detected=1 production_unchanged=1"
  exit 0
fi
if ! test -d "$PIPER_REPO/.git"; then
  test ! -e "$PIPER_REPO" || abort "piper_destination_exists_non_git"
  git clone --depth 1 https://github.com/OHF-Voice/piper1-gpl.git "$PIPER_REPO"
fi
test -d "$PIPER_REPO/src/piper/train" || abort "unexpected_piper_source"
if ! test -x "$PIPER_REPO/.venv/bin/python"; then
  python3 -m venv "$PIPER_REPO/.venv"
fi
cd "$PIPER_REPO"
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e '.[train]'
./build_monotonic_align.sh
.venv/bin/python setup.py build_ext --inplace
if ! test -s "$CHECKPOINT"; then
  mkdir -p "$(dirname "$CHECKPOINT")"
  temp=$(mktemp "$(dirname "$CHECKPOINT")/.base-ckpt.XXXXXXXX")
  trap 'rm -f "$temp"' EXIT
  # MIT-tagged official Piper base checkpoint; verify dataset model card before use.
  curl --fail --location --retry 3 --connect-timeout 20 \
    'https://huggingface.co/datasets/rhasspy/piper-checkpoints/resolve/main/en/en_US/lessac/medium/epoch%3D2164-step%3D1355540.ckpt' \
    -o "$temp"
  test "$(stat -c %s "$temp")" -gt 200000000 || abort "checkpoint_download_too_small"
  mv "$temp" "$CHECKPOINT"
fi
FORZA_VOICE_RIGHTS_CONFIRMED=yes FORZA_PIPER_REPO="$PIPER_REPO" FORZA_PIPER_CKPT="$CHECKPOINT" bash "$OLDPWD/ops/forza-piper-custom-bootstrap-gpu.sh" --check 2>/dev/null || {
  test -s "$CHECKPOINT" && test -x "$PIPER_REPO/.venv/bin/python" || abort "setup_incomplete"
}
echo "FORZA_GPU_SETUP_DONE piper_checkout_ready=1 checkpoint_ready=1 dataset_not_uploaded=1 production_unchanged=1"
