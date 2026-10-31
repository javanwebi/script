#!/usr/bin/env bash
# Isolated Piper Amir latency/continuity benchmark. Only ONNX model assets
# are downloaded to a disposable directory. Generated customer WAV/PCM is
# neither persisted nor cached; the original FORZA containers are untouched.
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
umask 077

test "$EUID" -eq 0 || { echo "Run as root" >&2; exit 1; }
for cmd in docker curl sha256sum python3 awk; do
  command -v "$cmd" >/dev/null || { echo "Missing $cmd" >&2; exit 1; }
done
test "$(docker inspect -f '{{.State.Running}}' forza-voice)" = true
test "$(docker inspect -f '{{.State.Running}}' sanatpish-new)" = true
test "$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)" -ge 1800000 || {
  echo "Not enough free RAM for isolated benchmark" >&2; exit 1;
}
test "$(df -Pk / | awk 'NR==2 {print $4}')" -ge 2200000 || {
  echo "At least 2.2 GiB free disk required for temporary Docker build" >&2; exit 1;
}
CANDIDATE=forza-amir-inmemory-eval
! docker inspect "$CANDIDATE" >/dev/null 2>&1 || {
  echo "Benchmark container already exists; not touching it" >&2; exit 1;
}
STAGE=$(mktemp -d /opt/forza-amir-inmemory.XXXXXXXX)
IMAGE="sanatpish/forza-amir-inmemory:eval-1.8.0"
IMAGE_CREATED=0
cleanup() {
  local status=$?
  trap - EXIT INT TERM
  docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true
  if [ "$IMAGE_CREATED" = 1 ]; then docker image rm "$IMAGE" >/dev/null 2>&1 || true; fi
  rm -rf -- "$STAGE"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

URL='https://huggingface.co/rhasspy/piper-voices/resolve/main/fa/fa_IR/amir/medium'
MODEL=fa_IR-amir-medium.onnx
mkdir -p "$STAGE/voice"
echo '[1/3] Downloading verified Persian Piper Amir model (63.5 MB, temporary).'
curl -fL --retry 3 --connect-timeout 20 --max-time 360 \
  --silent --show-error "$URL/$MODEL" -o "$STAGE/voice/$MODEL"
echo 'fb815380d969ea372b0b21b0de14421f58fe481047e153e69685d079b6e1a9d1  '"$STAGE/voice/$MODEL" | sha256sum -c -
curl -fL --retry 3 --connect-timeout 20 --max-time 90 \
  --silent --show-error "$URL/$MODEL.json" -o "$STAGE/voice/$MODEL.json"
python3 - "$STAGE/voice/$MODEL.json" <<'PY'
import json,sys
data=json.load(open(sys.argv[1], encoding='utf-8'))
assert data['language']['code']=='fa_IR'
assert data['audio']['sample_rate']==22050
PY

cat > "$STAGE/bench.py" <<'PY'
import time
from pathlib import Path
from piper import PiperVoice
import re

path=Path('/eval/voice/fa_IR-amir-medium.onnx')
started=time.perf_counter()
voice=PiperVoice.load(str(path),config_path=str(path)+'.json')
print(f'FORZA_AMIR_MODEL_READY load_ms={(time.perf_counter()-started)*1000:.0f}',flush=True)
# Warm-up before measuring steady-state customer turn latency.
parts=list(voice.synthesize('سلام من فورزا هستم'))
if not parts:
    raise RuntimeError('Amir warm-up did not generate speech')
del parts

full='سلام، من فورزا هستم و می‌توانم برای انتخاب قطعات صنعتی به شما کمک کنم. لطفاً کد و مشخصات قطعه مورد نیاز را بفرمایید.'
# The visible answer remains untouched; remove only spoken-form punctuation.
unbroken=re.sub(r'[،,؛;:!?؟…—–()]|(?<!\d)\.|\.(?!\d)', ' ', full)
unbroken=' '.join(unbroken.split())
for name,text in [('original',full),('unbroken',unbroken)]:
    start=time.perf_counter()
    first_ms=0
    previous_arrival=0
    playback_end=0
    total_audio_ms=0
    pauses_ms=0
    max_pause_ms=0
    n=0
    for part in voice.synthesize(text):
        pcm=part.audio_int16_bytes
        if not pcm: continue
        arrival=(time.perf_counter()-start)*1000
        duration=len(pcm)/(part.sample_rate*part.sample_channels*part.sample_width)*1000
        if n==0: first_ms=arrival
        if n: 
            gap=max(0,arrival-playback_end)
            pauses_ms+=gap
            max_pause_ms=max(max_pause_ms,gap)
        previous_arrival=arrival
        playback_end=max(arrival,playback_end)+duration
        total_audio_ms+=duration
        n+=1
        print(f'FORZA_AMIR_FRAME profile={name} index={n} arrived_ms={arrival:.0f} audio_ms={duration:.0f}',flush=True)
    total_ms=(time.perf_counter()-start)*1000
    if n==0 or total_audio_ms<500: raise RuntimeError('Invalid Amir audio result')
    print(f'FORZA_AMIR_RESULT profile={name} frames={n} first_ms={first_ms:.0f} '
          f'total_ms={total_ms:.0f} audio_seconds={total_audio_ms/1000:.2f} '
          f'rtf={total_ms/total_audio_ms:.3f} predicted_underrun_ms={pauses_ms:.0f} '
          f'max_predicted_underrun_ms={max_pause_ms:.0f}',flush=True)
print('FORZA_AMIR_INMEMORY_SMOKE_DONE generated_wav_saved=0 live_modified=0',flush=True)
PY

echo '[2/3] Creating isolated Piper Python environment.'
cat > "$STAGE/Dockerfile" <<'DOCKER'
FROM python:3.11-slim-bookworm
ENV PYTHONUNBUFFERED=1 OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 NUMEXPR_NUM_THREADS=1
RUN pip install --no-cache-dir piper-tts==1.8.0
WORKDIR /eval
DOCKER
docker build --pull=false --tag "$IMAGE" "$STAGE" >/dev/null
IMAGE_CREATED=1

echo '[3/3] Inference in isolated CPU-only container; no output WAV files.'
docker run --rm --name "$CANDIDATE" --restart no \
  --cpus=2 --cpu-shares=128 --memory=1280m --memory-swap=1280m \
  --pids-limit=128 --network=none --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,size=64m \
  --volume "$STAGE:/eval:ro" \
  "$IMAGE" python /eval/bench.py

for live in forza-voice sanatpish-new; do
  test "$(docker inspect -f '{{.State.Running}}' "$live")" = true
done
echo 'FORZA_AMIR_SAFE_TEST_COMPLETE: live FORZA, website, database unchanged.'
