#!/usr/bin/env bash
# Restore verified original Pocket container and its private FORZA config.
set -Eeuo pipefail
umask 077
fail(){ echo "FORZA_NIMA_ROLLBACK_ABORT $*" >&2; exit 1; }
test "$EUID" -eq 0 || fail "use_sudo"
exec 9>/run/lock/forza-voice-promote.lock
flock -w 8 9 || fail "voice_lock_busy"
APP=/opt/sanatpish
SITE=sanatpish-new
LIVE=forza-voice
MARKER=/etc/sanatpish/forza-nima-rollback-container
CONFIG="$APP/.env.forza-voice"
test -r "$MARKER" && test -r "$CONFIG" || fail "missing_nima_rollback_data"
BACKUP=$(sed -n 's/^BACKUP=//p' "$MARKER" | head -1)
ENV_BACKUP=$(sed -n 's/^ENV_BACKUP=//p' "$MARKER" | head -1)
case "$BACKUP" in forza-voice-before-nima-[0-9]*) ;; *) fail "unexpected_backup_name" ;; esac
case "$ENV_BACKUP" in /etc/sanatpish/forza-nima-env-before-[0-9]*) ;; *) fail "unexpected_config_backup_name" ;; esac
test -r "$ENV_BACKUP" && test ! -L "$ENV_BACKUP" || fail "missing_private_config_backup"
test "$(docker inspect -f '{{.State.Running}}' "$SITE")" = true || fail "site_not_running"
test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true || fail "voice_not_running"
test "$(docker inspect -f '{{.State.Running}}' "$BACKUP")" = false || fail "backup_should_be_stopped"
docker inspect "$BACKUP" >/dev/null || fail "missing_original_voice_container"
docker exec "$SITE" node -e 'fetch("http://forza-voice:8080/health",{signal:AbortSignal.timeout(4000)}).then(async r=>{let j=await r.json();process.exit(r.ok&&j.voice==="piper-nima-gyro-medium"?0:1)}).catch(()=>process.exit(1))' || fail "current_voice_not_nima"
# Keep a stopped Nima backup rather than deleting its image or data.
NIMA_BACKUP="forza-nima-before-rollback-$(date -u +%Y%m%d%H%M%S)"
echo "[1/3] Restore the original stopped Pocket container."
docker stop -t 15 "$LIVE" >/dev/null
docker rename "$LIVE" "$NIMA_BACKUP"
docker rename "$BACKUP" "$LIVE"
docker start "$LIVE" >/dev/null
echo "[2/3] Restore original private engine config and restart only Node site."
cp -p "$ENV_BACKUP" "$CONFIG"
chmod 600 "$CONFIG"
docker restart "$SITE" >/dev/null
echo "[3/3] Verify Pocket and the site database endpoint."
READY=0
for i in $(seq 1 60); do
  if docker exec "$SITE" node -e 'fetch("http://forza-voice:8080/health",{signal:AbortSignal.timeout(2500)}).then(async r=>{let j=await r.json();process.exit(r.ok&&j.voice==="pocket-farsi-v2"?0:1)}).catch(()=>process.exit(1))' >/dev/null 2>&1 && \
     curl -fsS --max-time 4 http://127.0.0.1:3001/api/health | grep -q '"database":"ok"'; then READY=1; break; fi
  sleep 2
done
test "$READY" = 1 || fail "pocket_restored_but_health_incomplete"
rm -f -- "$MARKER"
echo "FORZA_POCKET_ROLLBACK_PASS old_voice_restored=1 nima_backup_stopped=$NIMA_BACKUP"
