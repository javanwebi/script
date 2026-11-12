#!/usr/bin/env bash
# Restore the exact worker that was active before the fast-start promotion.
# Uses its own marker and never touches the older rollback marker.
set -Eeuo pipefail
umask 077
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
exec 9>/run/lock/forza-voice-promote.lock
flock -w 5 9 || { echo "Another FORZA voice switch is running" >&2; exit 1; }
test "$EUID" -eq 0 || { echo "Run using sudo bash" >&2; exit 1; }

MARKER=/etc/sanatpish/forza-voice-faststart-rollback-container
test -r "$MARKER" || { echo "No fast-start rollback backup exists." >&2; exit 1; }
PREVIOUS=$(cat "$MARKER")
case "$PREVIOUS" in
  forza-voice-before-faststart-[0-9]*) ;;
  *) echo "Unexpected fast-start backup container name." >&2; exit 1 ;;
esac
test "$(docker inspect -f '{{.State.Running}}' "$PREVIOUS")" = false
test "$(docker inspect -f '{{.State.Running}}' forza-voice)" = true

CURRENT_BACKUP="forza-voice-faststart-replaced-$(date -u +%Y%m%d%H%M%S)"
CHANGED=0
SUCCESS=0
on_exit(){
  rc=$?
  trap - EXIT ERR INT TERM
  if [ "$CHANGED" = 1 ] && [ "$SUCCESS" != 1 ]; then
    echo "Rollback verification failed; restoring the optimized worker." >&2
    if docker container inspect "$CURRENT_BACKUP" >/dev/null 2>&1; then
      docker rm -f forza-voice >/dev/null 2>&1 || true
      docker rename "$CURRENT_BACKUP" forza-voice >/dev/null 2>&1 || true
      docker start forza-voice >/dev/null 2>&1 || true
    fi
  fi
  exit "$rc"
}
trap 'on_exit $?' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "[1/2] Restoring previous Pocket worker."
CHANGED=1
docker stop -t 15 forza-voice >/dev/null
docker rename forza-voice "$CURRENT_BACKUP"
docker rename "$PREVIOUS" forza-voice
docker start forza-voice >/dev/null

echo "[2/2] Verifying private voice health through the application container."
ready=0
for i in $(seq 1 60); do
  if docker exec sanatpish-new node -e '
    fetch("http://forza-voice:8080/health",{signal:AbortSignal.timeout(3500)})
      .then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))
  ' >/dev/null 2>&1; then ready=1; break; fi
  sleep 2
done
test "$ready" = 1 || { docker logs --tail 60 forza-voice >&2; exit 1; }
test "$(docker inspect -f '{{.State.OOMKilled}}' forza-voice)" = false
SUCCESS=1
rm -f -- "$MARKER"
echo "FORZA_FASTSTART_ROLLBACK_OK"
echo "Previous Pocket worker restored. Optimized worker retained stopped: $CURRENT_BACKUP"
echo "Older rollback marker and backup were not modified."
