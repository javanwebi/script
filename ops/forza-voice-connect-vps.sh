#!/usr/bin/env bash
# Connect the already-tested private FORZA TTS to the existing bind-mounted VPS app.
# Does not recreate Docker containers or touch Supabase. Rolls back the config on a failed smoke test.
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
umask 077

if [ "${EUID}" -ne 0 ]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

APP=/opt/sanatpish
CONFIG="$APP/.env.forza-voice"
SOURCE_SECRET=/etc/sanatpish/forza-voice.env
STAGE=$(mktemp -d /tmp/forza-connect.XXXXXXXX)
BACKUP="$STAGE/original.env"
changed=0
had_original=0
verified=0

on_exit(){
  rc="$1"
  trap - EXIT
  if [ "$verified" -ne 1 ] && [ "$changed" -eq 1 ]; then
    echo "Private voice failed verification: restoring previous connection settings." >&2
    if [ "$had_original" -eq 1 ]; then
      cp "$BACKUP" "$CONFIG"
      chmod 600 "$CONFIG"
    else
      rm -f -- "$CONFIG"
    fi
    docker restart sanatpish-new >/dev/null 2>&1 || true
  fi
  rm -rf -- "$STAGE"
  exit "$rc"
}
trap 'on_exit $?' EXIT

test -r "$SOURCE_SECRET" || { echo "Missing voice token file" >&2; exit 1; }
test -d "$APP/.git" || { echo "Missing source checkout" >&2; exit 1; }
test "$(git -C "$APP" remote get-url origin)" = "https://github.com/javanwebi/script.git" || {
  echo "Unexpected origin repo" >&2; exit 1;
}
test "$(git -C "$APP" branch --show-current)" = main
git -C "$APP" diff --quiet && git -C "$APP" diff --cached --quiet || {
  echo "Local tracked changes: stopping safely" >&2; exit 1;
}
test "$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app"}}{{.Source}}{{end}}{{end}}' sanatpish-new)" = "$APP" || {
  echo "App mount does not match $APP" >&2; exit 1;
}
docker inspect --format '{{.State.Running}}' forza-voice | grep -Fxq true || {
  echo "Voice service is not running." >&2; exit 1;
}

# Confirm the private service is reachable before changing anything in production.
docker exec sanatpish-new node -e '
  fetch("http://forza-voice:8080/health", {signal:AbortSignal.timeout(4000)})
  .then(async r => {if (!r.ok) {console.error("FORZA health",r.status); process.exit(1)}})
  .catch(e => {console.error("FORZA health unreachable",e.message);process.exit(1)})
'

TOKEN=$(sed -n 's/^FORZA_VOICE_TOKEN=//p' "$SOURCE_SECRET" | head -n 1)
case "$TOKEN" in
  *[!0-9a-f]*|'') echo "Unexpected token format" >&2; exit 1 ;;
esac
test "${#TOKEN}" -eq 64 || { echo "Unexpected token length" >&2; exit 1; }

# .env* is excluded by the repository's .gitignore; never commit credentials.
git -C "$APP" check-ignore -q .env.forza-voice || {
  echo "Voice config would not be gitignored: stopping." >&2; exit 1;
}
if [ -e "$CONFIG" ]; then
  cp -p "$CONFIG" "$BACKUP"
  had_original=1
fi
printf 'FORZA_VOICE_INTERNAL_URL=http://forza-voice:8080\nFORZA_VOICE_TOKEN=%s\n' "$TOKEN" > "$STAGE/new.env"
chmod 600 "$STAGE/new.env"
cp "$STAGE/new.env" "$CONFIG"
chmod 600 "$CONFIG"
changed=1

# Verify non-root app identities can actually read the new private config.
docker exec sanatpish-new node -e '
  const fs=require("fs");
  const s=fs.readFileSync("/app/.env.forza-voice","utf8");
  if(!s.includes("FORZA_VOICE_INTERNAL_URL=http://forza-voice:8080")||!s.includes("FORZA_VOICE_TOKEN="))process.exit(1);
  console.log("FORZA_PRIVATE_CONFIG_READABLE")
'

echo "[1/3] Deploying the most recent source with the safe existing VPS deploy script..."
test -x /usr/local/sbin/sanatpish-deploy
/usr/local/sbin/sanatpish-deploy

echo "[2/3] Checking main website and database health..."
curl -fsS --max-time 20 http://127.0.0.1:3001/api/health > "$STAGE/health.json"
node_present=0
docker exec sanatpish-new node -e '
  const fs=require("fs");
  if (!fs.existsSync("/app/.env.forza-voice"))process.exit(1);
' && node_present=1
test "$node_present" -eq 1

echo "[3/3] Testing the public API proxy with a new Persian phrase..."
status=$(curl -sS --max-time 48 -w '%{http_code}' \
  -D "$STAGE/headers" \
  -o "$STAGE/speech.wav" \
  -H 'Content-Type: application/json' \
  --data '{"text":"سلام، پشتیبانی صنعت پیش آماده است."}' \
  http://127.0.0.1:3001/api/ai/forza-speech)
backend=$(grep -i '^x-forza-voice-backend:' "$STAGE/headers" | tr -d '\r' | awk '{print $2}' | tail -n 1)
bytes=$(wc -c < "$STAGE/speech.wav")
magic=$(head -c 4 "$STAGE/speech.wav" || true)
echo "FORZA_MAIN_PROXY status=$status backend=$backend wavBytes=$bytes"
if [ "$status" != 200 ] || [ "$backend" != private-service ] || [ "$magic" != RIFF ] || [ "$bytes" -lt 1000 ]; then
  echo "Voice route failed; reverting the config." >&2
  exit 1
fi
verified=1
echo "FORZA_PRIVATE_VOICE_CONNECTED"
echo "Site and database remain in the original application container."
echo "Credential file is only stored on the host and in its private /app bind mount."
