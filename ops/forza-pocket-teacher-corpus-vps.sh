#!/usr/bin/env bash
# FORZA licensed Pocket teacher: single WAV smoke test, 5-clip pilot, then full corpus.
# Uses the EXACT selected Pocket reference, in a separate offline 1-vCPU Docker
# process. Production app, active voice, database, ports and credentials untouched.
set -Eeuo pipefail
umask 077
abort(){ echo "FORZA_TEACHER_ABORT $*" >&2; exit 1; }
test "$EUID" = 0 || abort "run_with_sudo"
test "${FORZA_TEACHER_TRAINING_RIGHTS:-}" = yes || abort "training_and_distillation_rights_not_confirmed"
case "${1:-}" in
  --one) LIMIT=1; MODE=one ;;
  --pilot) LIMIT=5; MODE=pilot ;;
  --full) LIMIT=368; MODE=full ;;
  *) abort "usage: sudo env FORZA_TEACHER_TRAINING_RIGHTS=yes bash ops/forza-pocket-teacher-corpus-vps.sh --one|--pilot|--full" ;;
esac
test "$#" -eq 1 || abort "unexpected_arguments"
APP=/opt/sanatpish
SITE=sanatpish-new
LIVE=forza-voice
WORK=/opt/forza-custom-work
EXPECTED=31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833
CANDIDATE=forza-pocket-teacher-eval
for cmd in docker sha256sum awk python3 flock stat df; do command -v "$cmd" >/dev/null || abort "missing_$cmd"; done
test -d "$APP/.git" && test -s "$APP/scripts/forza_pocket_teacher_dataset.py" || abort "source_missing"
test -s "$APP/scripts/forza_pocket_worker.py" || abort "original_worker_missing"
test -s "$APP/scripts/forza_custom_voice_dataset_gate.py" || abort "dataset_gate_missing"
test -s "$WORK/prompts.txt" || abort "missing_prompts_txt"
test ! -L "$WORK" && test ! -L "$WORK/prompts.txt" || abort "unsafe_work_path"
test "$(stat -c %a "$WORK")" = 700 || abort "work_directory_must_be_mode_700"
test "$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)" -ge 2450000 || abort "insufficient_free_ram"
test "$(df -Pk "$WORK" | awk 'NR==2{print $4}')" -ge 800000 || abort "insufficient_free_disk"
for name in "$SITE" "$LIVE"; do
  test "$(docker inspect -f '{{.State.Running}}' "$name")" = true || abort "live_container_missing_$name"
done
! docker inspect "$CANDIDATE" >/dev/null 2>&1 || abort "teacher_container_already_exists"
exec 9>"$WORK/.teacher.lock"
flock -n 9 || abort "another_teacher_job_running"

# One exact, checksum-verified model and voice, no substitute male sample.
PARENT=
SOURCE=
LIVE_SHA=$(docker exec "$LIVE" sha256sum /app/public/forza-pocket-reference.wav 2>/dev/null | awk '{print $1}' || true)
if [ "$LIVE_SHA" = "$EXPECTED" ]; then
  PARENT=$(docker inspect -f '{{.Image}}' "$LIVE")
  SOURCE=live_pocket_image
else
  MATCHES=0
  while IFS= read -r backup; do
    test "$(docker inspect -f '{{.State.Running}}' "$backup")" = false || continue
    image=$(docker inspect -f '{{.Image}}' "$backup")
    digest=$(docker run --rm --network none --read-only --cpus=0.25 --memory=192m \
      --entrypoint sha256sum "$image" /app/public/forza-pocket-reference.wav 2>/dev/null | awk '{print $1}' || true)
    if [ "$digest" = "$EXPECTED" ]; then
      MATCHES=$((MATCHES + 1))
      PARENT="$image"
    fi
  done < <(docker ps -a --format '{{.Names}}' | grep -E '^forza-voice-(previous|before-amir)-[0-9]{14}$' || true)
  test "$MATCHES" = 1 || abort "expected_one_original_voice_backup_found_$MATCHES"
  SOURCE=verified_stopped_pocket_image
fi
test -n "$PARENT" || abort "no_verified_pocket_image"
IMAGE_SHA=$(docker run --rm --network none --read-only --cpus=0.25 --memory=192m \
  --entrypoint sha256sum "$PARENT" /app/public/forza-pocket-reference.wav 2>/dev/null | awk '{print $1}' || true)
test "$IMAGE_SHA" = "$EXPECTED" || abort "wrong_voice_image"

if [ "$MODE" = full ]; then
  test "${FORZA_TEACHER_PILOT_APPROVED:-}" = yes || abort "pilot_listening_review_required"
  test -s "$WORK/pilot/metadata.csv" || abort "pilot_has_not_completed"
  python3 "$APP/scripts/forza_custom_voice_dataset_gate.py" \
    --csv "$WORK/pilot/metadata.csv" --audio-dir "$WORK/pilot/wav" \
    --min-clips 5 --min-minutes 0 >/dev/null || abort "pilot_quality_gate_failed"
fi
echo "FORZA_TEACHER_VPS_START mode=$MODE source=$SOURCE selected_voice_sha256=$EXPECTED cpu_limit=1 memory_mib=2048 no_network=1"
# Image-specific heavy libraries are used inside the original Pocket model
# container. The original image and all production containers are immutable.
docker run --rm --name "$CANDIDATE" --restart no \
  --network none --cpus=1 --cpu-shares=128 \
  --memory=2048m --memory-swap=2048m --pids-limit=128 \
  --read-only --tmpfs /tmp:rw,nosuid,nodev,size=96m \
  -e PYTHONDONTWRITEBYTECODE=1 \
  -e OMP_NUM_THREADS=1 -e OPENBLAS_NUM_THREADS=1 -e MKL_NUM_THREADS=1 \
  -e FORZA_TTS_RESIDENT_ACOUSTIC=1 -e FORZA_TTS_RESIDENT_G2P=1 \
  -e FORZA_TTS_PARALLEL_CHUNKS=1 -e FORZA_TTS_UNBROKEN=1 \
  --mount "type=bind,src=$WORK,dst=/work" \
  --mount "type=bind,src=$APP/scripts/forza_pocket_worker.py,dst=/app/scripts/forza_pocket_worker.py,readonly" \
  --mount "type=bind,src=$APP/scripts/forza_pocket_teacher_dataset.py,dst=/probe/teacher.py,readonly" \
  --entrypoint python "$PARENT" -B /probe/teacher.py \
  --prompts /work/prompts.txt --output "/work/$MODE" --limit "$LIMIT" --rights-confirmed yes

python3 "$APP/scripts/forza_custom_voice_dataset_gate.py" \
  --csv "$WORK/$MODE/metadata.csv" --audio-dir "$WORK/$MODE/wav" \
  --min-clips "$LIMIT" --min-minutes "$([ "$MODE" = full ] && echo 30 || echo 0)"
for name in "$SITE" "$LIVE"; do test "$(docker inspect -f '{{.State.Running}}' "$name")" = true || abort "live_container_stopped_$name"; done
echo "FORZA_TEACHER_VPS_PASS mode=$MODE path=$WORK/$MODE wav_count=$LIMIT original_voice=1 production_deployed=0"
echo "This is a PRIVATE teacher-synthesized WAV, NOT a fast Piper student inference test. Original Pocket latency is expected." 
echo "These are private intentionally stored TRAINING WAVs, not customer speech. Review pilot quality before permitting --full."
