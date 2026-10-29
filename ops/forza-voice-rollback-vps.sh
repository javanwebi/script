#!/usr/bin/env bash
# Restore the exact previous FORZA Pocket TTS container retained by promotion.
# Only switches the voice worker. Does not touch the site or database.
set -Eeuo pipefail
umask 077
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
exec 9>/run/lock/forza-voice-promote.lock
flock -w 5 9 || { echo "Another FORZA voice switch is running" >&2; exit 1; }

test "${EUID}" -eq 0 || { echo "Run using sudo" >&2; exit 1; }
MARKER=/etc/sanatpish/forza-voice-rollback-container
test -r "$MARKER" || { echo "No saved previous voice container" >&2; exit 1; }
PREVIOUS=$(cat "$MARKER")
case "$PREVIOUS" in
  forza-voice-previous-[0-9]*) ;;
  *) echo "Unexpected backup container name" >&2; exit 1 ;;
esac
test "$(docker inspect --format '{{.State.Running}}' "$PREVIOUS")" = false
test "$(docker inspect --format '{{.State.Running}}' forza-voice)" = true
CHANGED=0
SUCCESS=0
CURRENT_BACKUP="forza-voice-resident-replaced-$(date -u +%Y%m%d%H%M%S)"
on_exit() {
  rc=$1
  trap - EXIT ERR INT TERM
  if [ "$CHANGED" = 1 ] && [ "$SUCCESS" != 1 ]; then
    echo "Voice rollback verification failed; attempting to restore newer worker." >&2
    if docker container inspect "$CURRENT_BACKUP" >/dev/null 2>&1; then
      docker rm -f forza-voice >/dev/null 2>&1 || true
      docker rename "$CURRENT_BACKUP" forza-voice >/dev/null 2>&1 || true
    fi
    docker start forza-voice >/dev/null 2>&1 || true
  fi
  exit "$rc"
}
trap 'on_exit $?' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "[1/2] Restoring the previously tested private TTS container."
CHANGED=1
docker stop -t 15 forza-voice >/dev/null
docker rename forza-voice "$CURRENT_BACKUP"
docker rename "$PREVIOUS" forza-voice
docker start forza-voice >/dev/null

echo "[2/2] Verifying original TTS through the running app container."
healthy=0
for i in $(seq 1 45); do
  if docker exec sanatpish-new node -e '
    fetch("http://forza-voice:8080/health",{signal:AbortSignal.timeout(3000)})
    .then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))
  ' >/dev/null 2>&1; then healthy=1; break; fi
  sleep 2
done
test "$healthy" -eq 1 || { docker logs --tail 40 forza-voice >&2; exit 1; }
test "$(docker inspect --format '{{.State.OOMKilled}}' forza-voice)" = false
SUCCESS=1
rm -f -- "$MARKER"
echo "FORZA_VOICE_ROLLBACK_OK"
echo "Original worker restored. Former resident worker retained stopped: $CURRENT_BACKUP"
echo "No website, Nginx or database restart was needed."
