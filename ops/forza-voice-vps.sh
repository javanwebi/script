#!/usr/bin/env bash
# Isolated Pocket Farsi v2 VPS deployment. Does NOT stop or replace the live app or database.
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
umask 077

if [ "${EUID}" -ne 0 ]; then
  echo "Run as root: sudo bash ops/forza-voice-vps.sh" >&2
  exit 1
fi
APP=/opt/sanatpish
REPO=https://github.com/javanwebi/script.git
VOICE_CONTAINER=forza-voice
SECRET_DIR=/etc/sanatpish
SECRET_FILE=$SECRET_DIR/forza-voice.env
test -d "$APP/.git" || { echo "Missing $APP checkout" >&2; exit 1; }
test "$(git -C "$APP" remote get-url origin)" = "$REPO" || {
  echo "Unexpected git remote; live app is untouched." >&2; exit 1;
}
docker container inspect sanatpish-new >/dev/null
docker info >/dev/null
NETWORK=$(docker inspect sanatpish-new --format '{{range $key, $value := .NetworkSettings.Networks}}{{println $key}}{{end}}' | grep -Fx supabase_default | head -n 1 || true)
if [ -z "$NETWORK" ]; then
  NETWORK=$(docker inspect sanatpish-new --format '{{range $key, $value := .NetworkSettings.Networks}}{{println $key}}{{end}}' | grep -v '^bridge$' | head -n 1 || true)
fi
test -n "$NETWORK" || { echo "No suitable shared private Docker network." >&2; exit 1; }

if docker container inspect "$VOICE_CONTAINER" >/dev/null 2>&1; then
  echo "Existing forza-voice container found; refusing to replace it automatically."
  docker ps -a --filter "name=^/forza-voice$"
  echo "Review its logs before any change: docker logs --tail 100 forza-voice"
  exit 0
fi

MEM_AVAILABLE_KB=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
DISK_AVAILABLE_KB=$(df -Pk / | awk 'NR==2 {print $4}')
if [ "$MEM_AVAILABLE_KB" -lt 2000000 ]; then
  echo "Less than 2 GB available RAM; refusing to start extra TTS worker." >&2
  exit 1
fi
if [ "$DISK_AVAILABLE_KB" -lt 5242880 ]; then
  echo "Less than 5 GB disk free; Docker build could exhaust disk." >&2
  exit 1
fi

echo "[1/4] Fetching pinned latest main source without modifying the live checkout..."
git -C "$APP" fetch --quiet origin main
REV=$(git -C "$APP" rev-parse origin/main)
TAG="sanatpish/forza-voice:${REV:0:12}"
STAGE=$(mktemp -d /opt/forza-voice-stage.XXXXXXXX)
trap 'rm -rf -- "$STAGE"' EXIT
git -C "$APP" archive --format=tar "$REV" \
  Dockerfile.forza-voice scripts/forza_pocket_worker.py scripts/forza_voice_http.py \
  | tar -xf - -C "$STAGE"

echo "[2/4] Building voice-only image. Live website, Nginx and Supabase are unchanged."
docker build -f "$STAGE/Dockerfile.forza-voice" -t "$TAG" "$STAGE"

mkdir -p "$SECRET_DIR"
chmod 700 "$SECRET_DIR"
if [ ! -s "$SECRET_FILE" ]; then
  TOKEN=$(openssl rand -hex 32)
  printf 'FORZA_VOICE_TOKEN=%s\n' "$TOKEN" > "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
fi
TOKEN=$(sed -n 's/^FORZA_VOICE_TOKEN=//p' "$SECRET_FILE" | head -n 1)
test -n "$TOKEN" || { echo "Missing private voice token" >&2; exit 1; }

echo "[3/4] Starting one private, resource-limited neural TTS worker..."
docker run -d \
  --name "$VOICE_CONTAINER" \
  --network "$NETWORK" \
  --network-alias forza-voice \
  --restart unless-stopped \
  --memory 1536m --memory-swap 1536m --cpus 1.0 --pids-limit 128 \
  --env-file "$SECRET_FILE" \
  -e PORT=8080 \
  "$TAG" >/dev/null

echo "[4/4] Waiting for a real health and same-voice Persian WAV test..."
healthy=0
for attempt in $(seq 1 45); do
  if docker exec sanatpish-new node -e '
    fetch("http://forza-voice:8080/health", {signal:AbortSignal.timeout(2500)})
      .then(r=>{if(!r.ok)process.exit(1);})
      .catch(()=>process.exit(1))
  ' >/dev/null 2>&1; then
    healthy=1
    break
  fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$VOICE_CONTAINER")" != true ]; then
    break
  fi
  sleep 3
done
if [ "$healthy" -ne 1 ]; then
  echo "Voice service did not become healthy. Leaving it intact for diagnosis." >&2
  docker logs --tail 50 "$VOICE_CONTAINER" >&2
  exit 1
fi

docker exec -e "FORZA_VOICE_TOKEN=$TOKEN" sanatpish-new node -e '
(async()=>{
 const started=Date.now();
 const r=await fetch("http://forza-voice:8080/speak", {
  method:"POST",
  headers:{"Content-Type":"application/json","X-Forza-Voice-Token":process.env.FORZA_VOICE_TOKEN},
  body:JSON.stringify({text:"سلام، من فورزا هستم."}),
  signal:AbortSignal.timeout(40000)
 });
 const audio=Buffer.from(await r.arrayBuffer());
 console.log("FORZA_SMOKE status="+r.status+" wavBytes="+audio.length+" ms="+(Date.now()-started));
 if(!r.ok || audio.length<1000 || audio.toString("ascii",0,4)!=="RIFF") process.exit(1);
})().catch(e=>{console.error("FORZA_SMOKE_FAILED",e.message);process.exit(1)})
'

echo "FORZA_VOICE_READY"
echo "Private service address (from sanatpish-new): http://forza-voice:8080"
echo "Private secret file: $SECRET_FILE"
echo "The live app has NOT been restarted or reconfigured."
echo "Next step: upgrade/connect Express with FORZA_VOICE_INTERNAL_URL and matching FORZA_VOICE_TOKEN."
