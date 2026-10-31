#!/usr/bin/env bash
# Build the licensed same-speaker FORZA teacher dataset using the EXISTING
# Pocket model. Does not train a student, restart production or deploy anything.
set -Eeuo pipefail
umask 077
abort(){ printf 'FORZA_DATA_PREP_ABORT %s\n' "$*" >&2; exit 1; }
test "$EUID" -eq 0 || abort "run_with_sudo"
test "${FORZA_TEACHER_TRAINING_RIGHTS:-}" = yes || abort "rights_not_confirmed"
test "${FORZA_TEACHER_PILOT_APPROVED:-}" = yes || abort "five_sample_listening_approval_required"
case "${1:-}" in --prepare|--run) MODE="$1";; *) abort "usage: sudo env FORZA_TEACHER_TRAINING_RIGHTS=yes FORZA_TEACHER_PILOT_APPROVED=yes bash ops/forza-custom-build-dataset-vps.sh --prepare|--run";; esac
test "$#" -eq 1 || abort "unexpected_arguments"
APP=/opt/sanatpish
WORK=/opt/forza-custom-work
PROMPTS="$WORK/prompts.txt"
BACKUP="$WORK/prompts-368.backup.txt"
test -d "$APP/.git" || abort "missing_checkout"
test -d "$WORK" && ! test -L "$WORK" || abort "invalid_workdir"
test "$(stat -c %a "$WORK")" = 700 || abort "workdir_must_be_private_700"
test -f "$PROMPTS" && ! test -L "$PROMPTS" || abort "prompts_missing_or_symlink"
for bin in python3 cmp mktemp wc chmod flock; do command -v "$bin" >/dev/null || abort "missing_$bin"; done
test -s "$WORK/pilot/metadata.csv" || abort "five_pilot_clips_not_present"
python3 "$APP/scripts/forza_custom_voice_dataset_gate.py" \
  --csv "$WORK/pilot/metadata.csv" --audio-dir "$WORK/pilot/wav" \
  --min-clips 5 --min-minutes 0 || abort "five_pilot_gate_failed"
exec 8>"$WORK/.build-dataset.lock"
flock -n 8 || abort "another_dataset_prep_running"
tmp=$(mktemp "$WORK/.prompts-728.XXXXXXXX")
trap 'rm -f "$tmp"' EXIT
python3 "$APP/scripts/forza_custom_corpus_prompts.py" --limit 728 > "$tmp"
test "$(wc -l < "$tmp")" -eq 728 || abort "generated_prompt_count_not_728"
existing=$(wc -l < "$PROMPTS")
case "$existing" in
  368)
    head -n 368 "$tmp" | cmp -s "$PROMPTS" - || abort "original_368_prompts_changed"
    if test -e "$BACKUP"; then
      cmp -s "$PROMPTS" "$BACKUP" || abort "existing_backup_mismatch"
    fi
    ;;
  728)
    cmp -s "$PROMPTS" "$tmp" || abort "existing_728_prompts_mismatch"
    ;;
  *) abort "unexpected_prompt_count=$existing" ;;
esac
echo "FORZA_DATA_PREP_CHECK existing=$existing required=728 prefix_unchanged=1 pilot_verified=1 production_unchanged=1"
if test "$MODE" = --prepare; then
  echo "FORZA_DATA_PREP_READY run_with=--run no_generation_performed=1"
  exit 0
fi
if test "$existing" = 368; then
  if ! test -e "$BACKUP"; then
    cp -p "$PROMPTS" "$BACKUP"
    chmod 600 "$BACKUP"
  fi
  mv "$tmp" "$PROMPTS"
  chmod 600 "$PROMPTS"
fi
echo "FORZA_DATA_FULL_BEGIN clips=728 private_training_data=1 production_unchanged=1"
bash "$APP/ops/forza-pocket-teacher-corpus-vps.sh" --full
echo "FORZA_DATA_FULL_COMPLETE dataset=$WORK/full/metadata.csv training_not_yet_performed=1"
