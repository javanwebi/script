#!/usr/bin/env bash
# Original Pocket-v2 Persian G2P: slow full-prefix ONNX vs experimental KV export.
# No running service is stopped/renamed/replaced. Test only 12 fixed public
# phrases; no AI reply, no microphone, no audio generated/saved.
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
umask 077
APP=/opt/sanatpish
SITE=sanatpish-new
LIVE=forza-voice
EXPECTED=31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833
MODEL=mrfakename/pocket-tts-farsi-v2-ONNX
test "$EUID" = 0 || { echo "FORZA_KV_ABORT run with sudo bash" >&2; exit 1; }
test -d "$APP/.git"
test "$(docker inspect -f '{{.State.Running}}' "$SITE")" = true
test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
command -v docker >/dev/null
command -v git >/dev/null
test "$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)" -gt 1450000 || { echo "FORZA_KV_ABORT insufficient host RAM" >&2; exit 1; }
test "$(df -Pk / | awk 'NR==2 {print $4}')" -gt 800000 || { echo "FORZA_KV_ABORT insufficient free disk" >&2; exit 1; }
STAGE=$(mktemp -d /opt/forza-g2p-kv-probe.XXXXXXXX)
cleanup(){
  rc=$?
  trap - EXIT INT TERM
  rm -rf -- "$STAGE"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
SOURCE_KIND=
PARENT=
SHA=$(docker exec "$LIVE" sha256sum /app/public/forza-pocket-reference.wav 2>/dev/null | awk '{print $1}' || true)
if [ "$SHA" = "$EXPECTED" ]; then
  SOURCE_KIND=live-pocket
  PARENT=$(docker inspect -f '{{.Image}}' "$LIVE")
else
  # In case the active voice was switched to Amir, the ORIGINAL Pocket image
  # must be located from a checksum-verified stopped backup, not guessed.
  for c in $(docker ps -a --format '{{.Names}}' | grep -E '^forza-voice-(previous|before-amir)-[0-9]{14}$' || true); do
    test "$(docker inspect -f '{{.State.Running}}' "$c")" = false || continue
    img=$(docker inspect -f '{{.Image}}' "$c")
    digest=$(docker run --rm --network none --read-only --cpus=0.25 --memory=192m \
       --entrypoint sha256sum "$img" /app/public/forza-pocket-reference.wav 2>/dev/null | awk '{print $1}' || true)
    if [ "$digest" = "$EXPECTED" ]; then
      if [ -n "$PARENT" ]; then echo "FORZA_KV_ABORT ambiguous backups" >&2; exit 1; fi
      SOURCE_KIND=verified-stopped-pocket
      PARENT="$img"
    fi
  done
fi
test -n "$PARENT" || { echo "FORZA_KV_ABORT no verified original Pocket image" >&2; exit 1; }
test "$(docker run --rm --network none --read-only --cpus=0.25 --memory=192m \
  --entrypoint sha256sum "$PARENT" /app/public/forza-pocket-reference.wav | awk '{print $1}')" = "$EXPECTED" ||
  { echo "FORZA_KV_ABORT original voice mismatch" >&2; exit 1; }
git -C "$APP" fetch --quiet origin main
REV=$(git -C "$APP" rev-parse origin/main)
mkdir -p "$STAGE/code" "$STAGE/hf"
git -C "$APP" show "$REV:scripts/forza_g2p_kv_cpu_probe.py" > "$STAGE/code/forza_g2p_kv_cpu_probe.py"
python3 -m py_compile "$STAGE/code/forza_g2p_kv_cpu_probe.py"
echo "FORZA_G2P_KV_PROBE_START revision=$REV original_voice_verified=1 source=$SOURCE_KIND no_audio_generated=1"
echo "FORZA_G2P_KV_DOWNLOAD new_KV_ONNX_only=1 user_data=0 temporary_folder=1"
# Download only the TWO experimental graphs into temporary staging storage.
# No generated customer audio is written; no production model replacement.
docker run --rm --network bridge --cpus=1 --memory=1g \
  -e HF_HOME=/probe/hf_cache -e HF_HUB_DOWNLOAD_TIMEOUT=240 \
  --mount "type=bind,src=$STAGE,dst=/probe" \
  --entrypoint hf "$PARENT" \
  download "$MODEL" onnx/g2p_encoder_kv.onnx onnx/g2p_decoder_kv.onnx \
  --local-dir /probe/hf

test -s "$STAGE/hf/onnx/g2p_encoder_kv.onnx" || { echo "FORZA_KV_ABORT encoder missing" >&2; exit 1; }
test -s "$STAGE/hf/onnx/g2p_decoder_kv.onnx" || { echo "FORZA_KV_ABORT decoder missing" >&2; exit 1; }
echo "FORZA_G2P_KV_GRAPHS_BYTES encoder=$(stat -c %s "$STAGE/hf/onnx/g2p_encoder_kv.onnx") decoder=$(stat -c %s "$STAGE/hf/onnx/g2p_decoder_kv.onnx")"
sha256sum "$STAGE/hf/onnx/g2p_encoder_kv.onnx" "$STAGE/hf/onnx/g2p_decoder_kv.onnx"
echo "FORZA_G2P_KV_COMPARE one_candidate_process=1 cpu=2 memory_gib=2"

# Code and models mounted read-only in the transient one-shot process.
# Synthetic tests cannot impact production voice, speed/phoneme output only.
docker run --rm --restart no --network none --cpus=2 \
  --memory=2g --memory-swap=2g --pids-limit=128 \
  --read-only --tmpfs /tmp:rw,nosuid,nodev,size=64m \
  -e PYTHONDONTWRITEBYTECODE=1 \
  -e OMP_NUM_THREADS=1 -e OPENBLAS_NUM_THREADS=1 -e MKL_NUM_THREADS=1 \
  --mount "type=bind,src=$STAGE/code/forza_g2p_kv_cpu_probe.py,dst=/app/scripts/forza_g2p_kv_cpu_probe.py,readonly" \
  --mount "type=bind,src=$STAGE/hf/onnx,dst=/probe/onnx,readonly" \
  --entrypoint python "$PARENT" -B scripts/forza_g2p_kv_cpu_probe.py --kv-dir /probe/onnx

test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
test "$(docker inspect -f '{{.State.Running}}' "$SITE")" = true
echo "FORZA_G2P_KV_FINISHED live_unchanged=1 original_voice=1 no_wav_generated=1"
echo "This is G2P-only; even successful KV decoding does NOT establish 14x whole-Pocket speed."
