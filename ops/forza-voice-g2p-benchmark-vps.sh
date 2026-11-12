#!/usr/bin/env bash
# Read-only live-service benchmark for experimental resident Persian G2P.
# Builds from the EXISTING voice image/model. Runs a temporary private worker.
# Never replaces forza-voice, restarts Node/Nginx, or touches Supabase.
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
umask 077
APP=/opt/sanatpish
LIVE=forza-voice
CANDIDATE=forza-voice-g2p-benchmark
TOKENFILE=/etc/sanatpish/forza-voice.env
test "${EUID}" -eq 0 || { echo 'Run using sudo bash' >&2; exit 1; }
test -d "$APP/.git"
test -r "$TOKENFILE"
test "$(git -C "$APP" remote get-url origin)" = https://github.com/javanwebi/script.git
test "$(docker inspect --format '{{.State.Running}}' "$LIVE")" = true
test "$(docker inspect --format '{{.State.Running}}' sanatpish-new)" = true
if docker container inspect "$CANDIDATE" >/dev/null 2>&1; then
  echo 'Existing G2P benchmark container detected; refusing to overwrite.' >&2
  exit 1
fi
MEMKB=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
DISKKB=$(df -Pk / | awk 'NR==2 {print $4}')
test "$MEMKB" -ge 1700000 || { echo 'Insufficient available RAM for isolated benchmark.' >&2; exit 1; }
test "$DISKKB" -ge 1048576 || { echo 'Insufficient free disk for isolated benchmark.' >&2; exit 1; }

STAGE=$(mktemp -d /opt/forza-g2p-bench.XXXXXXXX)
cleanup() {
  rc=$?
  trap - EXIT
  docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true
  rm -rf -- "$STAGE"
  exit "$rc"
}
trap cleanup EXIT

git -C "$APP" fetch --quiet origin main
REV=$(git -C "$APP" rev-parse origin/main)
git -C "$APP" archive --format=tar "$REV" scripts/forza_pocket_worker.py | tar -xf - -C "$STAGE"
grep -q FORZA_TTS_RESIDENT_G2P "$STAGE/scripts/forza_pocket_worker.py" || {
  echo 'G2P optimization is not present on GitHub main.' >&2; exit 1;
}
SOURCE_IMAGE=$(docker inspect --format '{{.Config.Image}}' "$LIVE")
docker image inspect "$SOURCE_IMAGE" >/dev/null
NETWORK=$(docker inspect --format '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -Fx supabase_default | head -1 || true)
if [ -z "$NETWORK" ]; then
  NETWORK=$(docker inspect --format '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -v '^bridge$' | head -1 || true)
fi
test -n "$NETWORK"
printf 'FROM %s\nCOPY scripts/forza_pocket_worker.py /app/scripts/forza_pocket_worker.py\n' "$SOURCE_IMAGE" > "$STAGE/Dockerfile"
TAG="sanatpish/forza-voice:g2p-bench-${REV:0:12}"
echo "[1/3] Building isolated benchmark image from current local model."
docker build --pull=false -q -f "$STAGE/Dockerfile" -t "$TAG" "$STAGE" >/dev/null
echo "[2/3] Starting 1-CPU, 1.5-GiB disposable candidate; live voice stays up."
docker run -d --name "$CANDIDATE" --restart no \
  --network "$NETWORK" --memory=1536m --memory-swap=1536m --cpus=1.0 --pids-limit=128 \
  --env-file "$TOKENFILE" -e PORT=8080 -e FORZA_TTS_RESIDENT_ACOUSTIC=1 \
  -e FORZA_TTS_RESIDENT_G2P=1 "$TAG" >/dev/null
ready=0
for i in $(seq 1 45); do
  if docker exec sanatpish-new node -e '
    fetch("http://forza-voice-g2p-benchmark:8080/health",{signal:AbortSignal.timeout(3500)})
      .then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))
  ' >/dev/null 2>&1; then ready=1; break; fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$CANDIDATE")" != true ]; then break; fi
  sleep 2
done
test "$ready" = 1 || { docker logs --tail 35 "$CANDIDATE" >&2; exit 1; }
TOKEN=$(sed -n 's/^FORZA_VOICE_TOKEN=//p' "$TOKENFILE" | head -1)
test -n "$TOKEN"

echo '[3/3] Testing three novel Persian phrases, including the previously slow one.'
docker exec -e "FORZA_VOICE_TOKEN=$TOKEN" sanatpish-new node -e '
(async()=>{
  const texts=[
    "سلام، من فورزا هستم.",
    "امروز برای انتخاب قطعات صنعتی به شما کمک می‌کنم.",
    "برای دریافت راهنمایی فنی، مشخصات قطعه را بفرمایید."
  ];
  let total=0;
  for(let i=0;i<texts.length;i++){
    const started=Date.now();
    const res=await fetch("http://forza-voice-g2p-benchmark:8080/speak",{
      method:"POST",
      headers:{"Content-Type":"application/json","X-Forza-Voice-Token":process.env.FORZA_VOICE_TOKEN},
      body:JSON.stringify({text:texts[i]}),
      signal:AbortSignal.timeout(65000)
    });
    const body=Buffer.from(await res.arrayBuffer());
    const ms=Date.now()-started;
    console.log("FORZA_G2P_PHRASE "+(i+1)+" http="+res.status+" ms="+ms+" bytes="+body.length);
    if(!res.ok||body.length<1000||body.toString("ascii",0,4)!=="RIFF") process.exit(1);
    total+=ms;
  }
  console.log("FORZA_G2P_AVG_MS="+Math.round(total/texts.length));
})().catch(e=>{console.error("FORZA_G2P_BENCH_FAILED",e.message);process.exit(1)})
'
docker stats --no-stream "$CANDIDATE" "$LIVE"
if docker exec "$CANDIDATE" test -r /sys/fs/cgroup/memory.peak; then
  PEAK=$(docker exec "$CANDIDATE" cat /sys/fs/cgroup/memory.peak)
  echo "FORZA_G2P_PEAK_BYTES=$PEAK"
  test "$PEAK" -lt 1500000000 || { echo 'Peak RAM too high for safe promotion.' >&2; exit 1; }
fi
test "$(docker inspect --format '{{.State.OOMKilled}}' "$CANDIDATE")" = false
test "$(docker inspect --format '{{.State.Running}}' "$CANDIDATE")" = true
echo "FORZA_G2P_BENCH_PASS commit=$REV"
echo 'This benchmark makes NO production change. Do not promote without reviewing the measurements.'
