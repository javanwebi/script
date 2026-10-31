#!/usr/bin/env bash
# Non-destructive REAL first-audio latency check for the original Pocket Farsi
# on the *live* Ubuntu VPS: private TTS vs existing Express proxy.
# Only fixed, non-customer Persian phrases. WAV frames stay in RAM.
set -Eeuo pipefail
umask 077
export GIT_TERMINAL_PROMPT=0
test "$EUID" -eq 0 || { echo "FORZA_POCKET_TEST_ABORT run_as_root=1" >&2; exit 1; }
for command in docker git awk sed tail; do command -v "$command" >/dev/null || exit 1; done
APP=/opt/sanatpish
VOICE=forza-voice
SITE=sanatpish-new
EXPECTED_SHA=31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833
FORZA_PROBE_MODE=${FORZA_PROBE_MODE:-both}
FORZA_PROBE_EXTENDED=${FORZA_PROBE_EXTENDED:-0}
case "$FORZA_PROBE_MODE" in both|private|proxy) ;; *) echo "Invalid mode" >&2; exit 1;; esac
case "$FORZA_PROBE_EXTENDED" in 0|1) ;; *) echo "Invalid extended" >&2; exit 1;; esac

test -d "$APP/.git"
test "$(git -C "$APP" remote get-url origin)" = "https://github.com/javanwebi/script.git"
for name in "$VOICE" "$SITE"; do
  test "$(docker inspect -f '{{.State.Running}}' "$name")" = true ||
    { echo "FORZA_POCKET_TEST_ABORT container_not_running=$name" >&2; exit 1; }
done
SELECTED_SHA=$(docker exec "$VOICE" sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')
test "$SELECTED_SHA" = "$EXPECTED_SHA" || {
  echo "FORZA_POCKET_TEST_ABORT selected_voice_reference_mismatch=1" >&2; exit 1;
}
echo "FORZA_POCKET_TEST_PRECHECK original_reference_sha256=$SELECTED_SHA"
awk '/^MemAvailable:/{print "FORZA_POCKET_TEST_HOST available_ram_kib="$2}' /proc/meminfo
echo "FORZA_POCKET_TEST_CPU logical_cores=$(nproc) live_containers_unchanged=1"
git -C "$APP" fetch --quiet origin main
test -n "$(git -C "$APP" rev-parse origin/main)"
echo "FORZA_POCKET_TEST_RUN noncustomer_fixed_phrases=1 WAV_disk_writes=0 mode=$FORZA_PROBE_MODE"

# Private run is executed INSIDE the existing voice container, where its
# private credential already exists. The app container does not have or need it.
# The proxy run is executed INSIDE sanatpish-new, which has its own 3000/PORT
# listener; port 3001 is usually only the VPS HOST mapping.
# No credentials are passed on CLI; neither script writes customer WAVs.
PROBE_EXIT=0
PRIVATE_OUTPUT=""
PROXY_OUTPUT=""
if [ "$FORZA_PROBE_MODE" != proxy ]; then
  if PRIVATE_OUTPUT=$(git -C "$APP" show origin/main:scripts/tests/forza-pocket-vps-private-ttfb.py |
    docker exec -i -e "FORZA_PROBE_EXTENDED=$FORZA_PROBE_EXTENDED" "$VOICE" python - 2>&1); then
    printf '%s\\n' "$PRIVATE_OUTPUT"
  else
    printf '%s\\n' "$PRIVATE_OUTPUT"
    PROBE_EXIT=1
  fi
fi
if [ "$FORZA_PROBE_MODE" != private ]; then
  if PROXY_OUTPUT=$(git -C "$APP" show origin/main:scripts/tests/forza-pocket-vps-ttfb.cjs |
    docker exec -i -e FORZA_PROBE_MODE=proxy \\
      -e "FORZA_PROBE_EXTENDED=$FORZA_PROBE_EXTENDED" "$SITE" node - 2>&1); then
    printf '%s\\n' "$PROXY_OUTPUT"
  else
    printf '%s\\n' "$PROXY_OUTPUT"
    PROBE_EXIT=1
  fi
fi

if [ "$FORZA_PROBE_MODE" = both ]; then
  first_private=$(printf '%s\\n' "$PRIVATE_OUTPUT" |
    sed -n '/^FORZA_POCKET_VPS_RESULT route=private_short /s/.* first_ms=\\([0-9]*\\).*/\\1/p' | tail -1)
  first_proxy=$(printf '%s\\n' "$PROXY_OUTPUT" |
    sed -n '/^FORZA_POCKET_VPS_RESULT route=proxy_short /s/.* first_ms=\\([0-9]*\\).*/\\1/p' | tail -1)
  if [[ "$first_private" =~ ^[0-9]+$ && "$first_proxy" =~ ^[0-9]+$ ]]; then
    echo "FORZA_POCKET_VPS_COMPARE proxy_minus_private_first_ms=$((first_proxy-first_private)) result=serial_samples_not_statistically_conclusive"
  else
    echo "FORZA_POCKET_VPS_COMPARE unavailable=1 reason=missing_successful_measurement"
  fi
fi

echo "FORZA_POCKET_TEST_POST voice_ref_unchanged=$(
  test "$(docker exec "$VOICE" sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')" = "$EXPECTED_SHA" && echo 1 || echo 0
) app_running=$(docker inspect -f '{{.State.Running}}' "$SITE") voice_running=$(docker inspect -f '{{.State.Running}}' "$VOICE")"
docker stats --no-stream --format 'FORZA_POCKET_TEST_RESOURCES name={{.Name}} cpu={{.CPUPerc}} memory={{.MemUsage}}' "$VOICE" "$SITE" || true
test "$(docker inspect -f '{{.State.Running}}' "$VOICE")" = true
test "$(docker inspect -f '{{.State.Running}}' "$SITE")" = true
test "$(docker exec "$VOICE" sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')" = "$EXPECTED_SHA"
if [ "$PROBE_EXIT" -ne 0 ]; then
  echo "FORZA_POCKET_TEST_INCOMPLETE check_private_or_proxy_error_codes=1" >&2
  exit "$PROBE_EXIT"
fi
echo "FORZA_POCKET_TEST_DONE original_Pocket_unchanged=1 no_customer_wav_saved=1"
