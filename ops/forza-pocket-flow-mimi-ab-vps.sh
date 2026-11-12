#!/usr/bin/env bash
# Serial, read-only acoustic A/B: same Pocket FP32 weights, selected voice,
# deterministic Persian phrase, no audio file writes and NO live deployment.
# Runs the existing verified isolated gate once per candidate; all candidates
# use 2 CPUs and 2 GiB maximum, and are removed by that gate's EXIT trap.
set -Eeuo pipefail
umask 077
export GIT_TERMINAL_PROMPT=0
APP=/opt/sanatpish
LIVE=forza-voice
SITE=sanatpish-new
EXPECTED=31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833
test "$EUID" -eq 0 || { echo "FORZA_ACOUSTIC_ABORT run with sudo bash" >&2; exit 1; }
for binary in git docker awk python3; do
  command -v "$binary" >/dev/null || { echo "FORZA_ACOUSTIC_ABORT missing=$binary" >&2; exit 1; }
done
test -d "$APP/.git"
test "$(git -C "$APP" remote get-url origin)" = https://github.com/javanwebi/script.git || {
  echo "FORZA_ACOUSTIC_ABORT wrong_repository" >&2; exit 1;
}
for container in "$LIVE" "$SITE"; do
  test "$(docker inspect -f '{{.State.Running}}' "$container")" = true || {
    echo "FORZA_ACOUSTIC_ABORT missing_live_service=$container" >&2; exit 1;
  }
done
test "$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)" -ge 2450000 || {
  echo "FORZA_ACOUSTIC_ABORT insufficient_available_ram" >&2; exit 1;
}
test "$(df -Pk / | awk 'NR==2{print $4}')" -gt 1048576 || {
  echo "FORZA_ACOUSTIC_ABORT insufficient_disk" >&2; exit 1;
}
STAGE=$(mktemp -d /tmp/forza-acoustic-ab.XXXXXXXX)
cleanup(){
  rc=$?
  trap - EXIT INT TERM
  rm -rf -- "$STAGE"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
git -C "$APP" fetch --quiet origin main
REV=$(git -C "$APP" rev-parse origin/main)
git -C "$APP" show "$REV:ops/forza-pocket-cpu-gate-after-amir-vps.sh" > "$STAGE/gate.sh"
bash -n "$STAGE/gate.sh"

# Pinned medium-length public synthetic phrase. Fixed seed controls samples.
# This is an A/B feasibility gate, not a multi-user production benchmark.
echo "FORZA_ACOUSTIC_START revision=$REV voice_ref_sha256=$EXPECTED sample=medium test_seed=12345"
# name:FlowLM_ONNX_intra:Mimi_overlap:ORT_arena:ORT_mem_pattern
PROFILES=(
  baseline:1:0:0:0
  mimi_overlap:1:1:0:0
  flow_intra2:2:0:0:0
  flow_intra2_mimi:2:1:0:0
)
reference_hash=""
reference_ms=""
best_name="none"
best_ms=""
for spec in "${PROFILES[@]}"; do
  IFS=: read -r name intra overlap arena pattern <<< "$spec"
  test "$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)" -ge 2450000 || {
    echo "FORZA_ACOUSTIC_ABORT insufficient_available_ram_before=$name" >&2; exit 1;
  }
  echo "FORZA_ACOUSTIC_PROFILE_START name=$name flow_intra=$intra mimi_overlap=$overlap"
  if ! output=$(env FORZA_GATE_SAMPLE=medium \
    FORZA_GATE_FULL_ANSWER_WAV=0 \
    FORZA_GATE_FIXED_SEED=12345 \
    FORZA_GATE_RETRY_ATTEMPTS=3 \
    FORZA_GATE_CPU_INTRA="$intra" \
    FORZA_GATE_OVERLAP_MIMI="$overlap" \
    FORZA_GATE_CPU_ARENA="$arena" \
    FORZA_GATE_CPU_PATTERN="$pattern" \
    FORZA_GATE_EOS_SHORT=5 FORZA_GATE_EOS_LONG=3 \
    bash "$STAGE/gate.sh" 2>&1); then
    printf '%s\n' "$output" | tail -70 >&2
    echo "FORZA_ACOUSTIC_ABORT profile=$name isolated_gate_failed=1" >&2
    exit 1
  fi
  metric=$(printf '%s\n' "$output" | grep '^FORZA_POCKET_ONE_SECOND_GATE ' | tail -1 || true)
  test -n "$metric" || {
    echo "FORZA_ACOUSTIC_ABORT missing_metric=$name" >&2; exit 1;
  }
  value(){
    local key="$1" field
    for field in $metric; do
      case "$field" in "$key"=*) printf '%s' "${field#*=}"; return 0 ;; esac
    done
    return 1
  }
  ms=$(value total_ms)
  hash=$(value wav_sha256)
  rtf=$(value rtf)
  audio_s=$(value audio_seconds)
  test "$(value sample)" = medium
  [[ "$ms" =~ ^[0-9]+$ && "$hash" =~ ^[[:xdigit:]]{64}$ ]] || {
    echo "FORZA_ACOUSTIC_ABORT invalid_measurement=$name" >&2; exit 1;
  }
  # Existing stage logs report FlowLM execution, Mimi completion wait and
  # per-step costs. Mimi wait with overlap is NOT full Mimi operator time.
  stage=$(printf '%s\n' "$output" | awk '
    /^\[FORZA voice CPU stages\]/ {
      count++
      for(i=1;i<=NF;i++){
        split($i,a,"=")
        if(a[1]=="flow_ms")flow+=a[2]
        if(a[1]=="flow_steps")steps+=a[2]
        if(a[1]=="flow_onnx_ms")onnx+=a[2]
        if(a[1]=="mimi_ms")mimi+=a[2]
        if(a[1]=="attempts_actual")attempts+=a[2]
      }
    }
    END {printf "jobs=%d attempts=%d flow_wall_ms=%.0f flow_steps=%d flow_onnx_ms=%.0f mimi_wait_ms=%.0f",count,attempts,flow,steps,onnx,mimi}
  ')
  if [ -z "$reference_hash" ]; then
    reference_hash="$hash"
    reference_ms="$ms"
  fi
  if [ "$hash" != "$reference_hash" ]; then
    echo "FORZA_ACOUSTIC_REJECT name=$name reason=wav_sha256_changed total_ms=$ms baseline_ms=$reference_ms $stage"
    continue
  fi
  speedup=$(awk -v base="$reference_ms" -v current="$ms" 'BEGIN{if(current>0)printf "%.3f",base/current;else print "invalid"}')
  echo "FORZA_ACOUSTIC_RESULT name=$name total_ms=$ms audio_seconds=$audio_s rtf=$rtf speedup=${speedup}x exact_pcm_wav=1 $stage"
  # Don't promote a noisy one-shot win. Require at least 5% improvement
  # before flagging an option worth extended quality/load validation.
  if [ "$name" != baseline ] && [ $((ms*100)) -le $((reference_ms*95)) ]; then
    if [ -z "$best_ms" ] || [ "$ms" -lt "$best_ms" ]; then
      best_name="$name"
      best_ms="$ms"
    fi
  fi
done
test "$(docker inspect -f '{{.State.Running}}' "$SITE")" = true
test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
if [ "$best_name" = none ]; then
  echo "FORZA_ACOUSTIC_DONE baseline_ms=$reference_ms qualified=none live_unchanged=1"
else
  echo "FORZA_ACOUSTIC_DONE baseline_ms=$reference_ms candidate=$best_name candidate_ms=$best_ms test_only=1 live_unchanged=1"
fi
echo "Only full same-voice audio A/B, repeated p95 and resource/quality tests can authorize deployment."
