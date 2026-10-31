#!/usr/bin/env bash
# Same original Pocket Farsi speaker + EXACT SAME FP32 weights; only compare
# ONNX allocator/memory-pattern settings (never INT4/INT8 or voice change).
# Run isolated existing CPU gate serially; no customer audio saved to disk.
set -Eeuo pipefail
umask 077
test "$EUID" -eq 0 || { echo "Run as root" >&2; exit 1; }
APP=/opt/sanatpish
EXPECTED_SHA=31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833
GATE_SCRIPT=""
cleanup(){
  local rc=$?
  if [ -n "$GATE_SCRIPT" ]; then rm -f -- "$GATE_SCRIPT"; fi
  exit "$rc"
}
trap cleanup EXIT
test -d "$APP/.git" && command -v docker >/dev/null
test "$(docker inspect -f '{{.State.Running}}' forza-voice)" = true
test "$(docker exec forza-voice sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')" = "$EXPECTED_SHA"
test "$(docker inspect -f '{{.State.Running}}' sanatpish-new)" = true
echo "FORZA_FP32_MATRIX_START same_voice_sha256=$EXPECTED_SHA model=original-FP32 threads=1"
GATE_SCRIPT=$(mktemp /tmp/forza-pocket-matrix-gate.XXXXXXXX.sh)
git -C "$APP" fetch --quiet origin main
git -C "$APP" show origin/main:ops/forza-pocket-cpu-gate-after-amir-vps.sh > "$GATE_SCRIPT"
bash -n "$GATE_SCRIPT"

# These settings do NOT change neural weights, the chosen voice or the
# training/inference sampling algorithm. Different WAV hashes still reject.
reference_hash=""
reference_time=0
best_ms=2147483647
best_profile=""
for profile in baseline:0:0 arena:1:0 arena_pattern:1:1; do
  IFS=: read -r name arena pattern <<< "$profile"
  echo "FORZA_FP32_MATRIX_PROFILE_START name=$name arena=$arena pattern=$pattern"
  # The existing gate manages a throwaway 2-vCPU candidate and verifies
  # site/voice continuity, and destroys each candidate on exit.
  if ! output=$(env FORZA_GATE_SAMPLE=short \
    FORZA_GATE_RETRY_ATTEMPTS=1 \
    FORZA_GATE_FIXED_SEED=12345 \
    FORZA_GATE_OVERLAP_MIMI=1 \
    FORZA_GATE_CPU_INTRA=1 \
    FORZA_GATE_CPU_ARENA="$arena" \
    FORZA_GATE_CPU_PATTERN="$pattern" \
    FORZA_GATE_EOS_SHORT=5 \
    FORZA_GATE_EOS_LONG=3 \
    bash "$GATE_SCRIPT" 2>&1); then
    echo "$output" >&2
    echo "FORZA_FP32_MATRIX_ABORT name=$name: isolated gate failed" >&2
    exit 1
  fi
  metric=$(printf '%s\n' "$output" | grep '^FORZA_POCKET_ONE_SECOND_GATE ' | tail -1)
  test -n "$metric" || { echo "$output" >&2; echo "Missing timing metric" >&2; exit 1; }
  echo "$metric"
  # POSIX shell-friendly key=value parsing, no eval/sourcing of log content.
  time=$(printf '%s\n' "$metric" | tr ' ' '\n' | sed -n 's/^total_ms=//p')
  hash=$(printf '%s\n' "$metric" | tr ' ' '\n' | sed -n 's/^wav_sha256=//p')
  steps=$(printf '%s\n' "$output" | sed -n '/^\[FORZA voice CPU stages\]/s/.*flow_steps=\([0-9]*\).*/\1/p' | tail -1)
  [[ "$time" =~ ^[0-9]+$ && "$hash" =~ ^[[:xdigit:]]{64}$ && "$steps" =~ ^[0-9]+$ ]] ||
    { echo "Invalid profile stats" >&2; exit 1; }
  if [ -z "$reference_hash" ]; then
    reference_hash=$hash
    reference_time=$time
  fi
  if [ "$reference_hash" != "$hash" ]; then
    echo "FORZA_FP32_MATRIX_REJECT name=$name reason=wav_changed_original_voice_preserved=1"
    continue
  fi
  echo "FORZA_FP32_MATRIX_PROFILE_OK name=$name total_ms=$time flow_steps=$steps exact_wav=1"
  if [ "$time" -lt "$best_ms" ]; then best_ms=$time;best_profile=$name;fi
done
echo "FORZA_FP32_MATRIX_DONE baseline_ms=$reference_time best_ms=$best_ms best=$best_profile"
if [ "$best_ms" -ge 1000 ]; then
  echo "FORZA_FP32_UNDER_ONE_SECOND_NOT_MET action=do_not_claim_subsecond"
else
  echo "FORZA_FP32_UNDER_ONE_SECOND_SINGLE_SAMPLE_ONLY needs_quality_and_load_testing=1"
fi
echo "FORZA_FP32_MATRIX_LIVE_UNCHANGED same_voice_sha256=$EXPECTED_SHA"
