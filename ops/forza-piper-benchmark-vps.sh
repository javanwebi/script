#!/usr/bin/env bash
# Isolated Persian Piper CPU voice benchmark for FORZA.
# Downloads official ONNX models and produces WAV samples only.
# Never touches forza-voice, sanatpish-new, database, Nginx, or production env.
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
umask 077

test "$EUID" -eq 0 || { echo "Run with sudo bash" >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker not installed" >&2; exit 1; }
command -v curl >/dev/null || { echo "curl not installed" >&2; exit 1; }
test "$(docker inspect -f '{{.State.Running}}' forza-voice)" = true || { echo "Live voice must be healthy." >&2; exit 1; }
test "$(docker inspect -f '{{.State.Running}}' sanatpish-new)" = true || { echo "Live site must be healthy." >&2; exit 1; }
test "$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)" -ge 1800000 || {
  echo "Not enough available RAM for a safe isolated test." >&2; exit 1;
}
test "$(df -Pk / | awk 'NR==2 {print $4}')" -ge 1500000 || {
  echo "Need at least 1.5 GiB of free disk space." >&2; exit 1;
}
if docker container inspect forza-piper-benchmark >/dev/null 2>&1; then
  echo "Another/orphaned Piper benchmark container already exists; not overwriting it." >&2
  exit 1
fi

ROOT=/opt/forza-piper-eval
mkdir -p "$ROOT/models" "$ROOT/audio"

echo "[1/4] Downloading three official Farsi Piper voices (one time, ~190 MB)."
for NAME in gyro ganji reza_ibrahim; do
  BASE="fa_IR-$NAME-medium.onnx"
  URL="https://huggingface.co/rhasspy/piper-voices/resolve/main/fa/fa_IR/$NAME/medium"
  MODEL="$ROOT/models/$BASE"
  CONFIG="$MODEL.json"
  if [ ! -s "$MODEL" ]; then
    curl --fail --location --retry 3 --connect-timeout 20 --max-time 360 \
      --silent --show-error "$URL/$BASE" --output "$MODEL.partial"
    test "$(stat -c %s "$MODEL.partial")" -gt 1000000 || {
      echo "Incomplete ONNX download for $NAME" >&2; exit 1;
    }
    mv "$MODEL.partial" "$MODEL"
  fi
  if [ ! -s "$CONFIG" ]; then
    curl --fail --location --retry 3 --connect-timeout 20 --max-time 90 \
      --silent --show-error "$URL/$BASE.json" --output "$CONFIG.partial"
    python3 -m json.tool "$CONFIG.partial" >/dev/null
    mv "$CONFIG.partial" "$CONFIG"
  fi
  python3 -c 'import json,sys; c=json.load(open(sys.argv[1])); assert c["language"]["code"]=="fa_IR"; assert c["audio"]["sample_rate"]==22050' "$CONFIG"
  # Licensing varies by model/training data; keep a local model card for review.
  if [ ! -s "$ROOT/models/$NAME-MODEL_CARD" ]; then
    curl --fail --location --retry 2 --connect-timeout 15 --max-time 35 \
      --silent --show-error "$URL/MODEL_CARD" --output "$ROOT/models/$NAME-MODEL_CARD" || true
  fi
  echo "MODEL_READY $NAME size_bytes=$(stat -c %s "$MODEL")"
done

echo "[2/4] Preparing repeatable Python streaming latency benchmark."
cat > "$ROOT/benchmark.py" <<'PY'
import os
import time
import wave
from pathlib import Path
from piper import PiperVoice

root = Path("/eval")
voices = ("gyro", "ganji", "reza_ibrahim")
texts = (
    "سلام، من فورزا هستم و در انتخاب قطعات صنعتی به شما کمک می‌کنم.",
    "برای انتخاب تسمه مناسب، شماره فنی و مشخصات دستگاه را بفرمایید تا قطعه سازگار را بررسی کنیم.",
)

for name in voices:
    path = root / "models" / f"fa_IR-{name}-medium.onnx"
    t0 = time.perf_counter()
    voice = PiperVoice.load(str(path))
    load_ms = (time.perf_counter() - t0) * 1000

    # Cold model initialization is not a customer turn; a resident service
    # would perform this once at startup.
    t0 = time.perf_counter()
    warm_chunks = list(voice.synthesize("سلام، من فورزا هستم."))
    warm_ms = (time.perf_counter() - t0) * 1000
    if not warm_chunks:
        raise RuntimeError("Piper warmup produced no audio for " + name)
    print(f"FORZA_PIPER_READY voice={name} load_ms={load_ms:.0f} warmup_ms={warm_ms:.0f}", flush=True)

    for index, text in enumerate(texts, start=1):
        out = root / "audio" / f"{name}-sample-{index}.wav"
        started = time.perf_counter()
        first_chunk_ms = None
        audio_bytes = 0
        chunks = 0
        sample_rate = 0
        channels = 0
        width = 0

        with wave.open(str(out), "wb") as dst:
            for part in voice.synthesize(text):
                if first_chunk_ms is None:
                    first_chunk_ms = (time.perf_counter() - started) * 1000
                    sample_rate = part.sample_rate
                    channels = part.sample_channels
                    width = part.sample_width
                    dst.setnchannels(channels)
                    dst.setsampwidth(width)
                    dst.setframerate(sample_rate)
                pcm = part.audio_int16_bytes
                dst.writeframes(pcm)
                audio_bytes += len(pcm)
                chunks += 1

        total_ms = (time.perf_counter() - started) * 1000
        if not chunks or not sample_rate or not audio_bytes:
            raise RuntimeError(f"Empty Piper result for {name} phrase {index}")
        seconds = audio_bytes / (sample_rate * width * channels)
        rtf = total_ms / 1000 / seconds
        if out.stat().st_size < 1000:
            raise RuntimeError("WAV too small: " + str(out))
        print(
            f"FORZA_PIPER_RESULT voice={name} phrase={index} "
            f"first_chunk_ms={first_chunk_ms:.0f} total_ms={total_ms:.0f} "
            f"audio_s={seconds:.2f} rtf={rtf:.3f} frames={chunks} "
            f"wav={out}",
            flush=True,
        )

print("FORZA_PIPER_BENCH_PASS", flush=True)
PY

echo "[3/4] Building an isolated Piper 1.8.0 Docker image (does not touch the live voice)."
IMAGE=sanatpish/piper-eval:1.8.0
docker build --pull=false -q --tag "$IMAGE" - <<'DOCKER'
FROM python:3.11-slim-bookworm
ENV PYTHONUNBUFFERED=1 OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 NUMEXPR_NUM_THREADS=1
RUN pip install --no-cache-dir piper-tts==1.8.0
WORKDIR /eval
DOCKER

echo "[4/4] Generating WAV samples with 1.5 CPUs and 1.25 GiB RAM, no network or ports."
docker run --rm --name forza-piper-benchmark --restart no \
  --cpus=1.5 --cpu-shares=128 --memory=1280m --memory-swap=1280m \
  --pids-limit=128 --network=none --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --volume "$ROOT:/eval:rw" \
  "$IMAGE" python /eval/benchmark.py

test "$(docker inspect -f '{{.State.Running}}' forza-voice)" = true
test "$(docker inspect -f '{{.State.Running}}' sanatpish-new)" = true
echo "Saved WAV files:"
ls -lh "$ROOT/audio/"*.wav
echo "FORZA_PIPER_SAMPLES_READY at $ROOT/audio"
echo "Commercial voice-model/data licenses must be verified before production use."
echo "Live FORZA, xKiro, Nginx and database were not changed."
