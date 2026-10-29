#!/usr/bin/env bash
# No-downtime, reversible CPU TTS A/B speed benchmark on the production VPS.
# Uses the EXISTING voice container's local image/model and voice reference.
# Does not modify/restart the website, the live voice worker or Supabase.
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
umask 077
test "${EUID}" -eq 0 || { echo "Use sudo bash" >&2; exit 1; }
APP=/opt/sanatpish
CANDIDATE=forza-voice-benchmark
TOKENFILE=/etc/sanatpish/forza-voice.env
test -d "$APP/.git"
test "$(git -C "$APP" remote get-url origin)" = https://github.com/javanwebi/script.git
test -r "$TOKENFILE"
docker inspect --format '{{.State.Running}}' forza-voice | grep -Fxq true
docker inspect --format '{{.State.Running}}' sanatpish-new | grep -Fxq true
if docker container inspect "$CANDIDATE" >/dev/null 2>&1; then
  echo "Candidate container already exists; refusing to replace it automatically." >&2
  exit 1
fi
MEMKB=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
DISKKB=$(df -Pk / | awk 'NR==2 {print $4}')
test "$MEMKB" -ge 1700000 || { echo "Low available memory; refusing concurrent test." >&2; exit 1; }
test "$DISKKB" -ge 1048576 || { echo "Low disk space; refusing build." >&2; exit 1; }

echo "[1/4] Fetching only updated TTS Python source; no live app change."
git -C "$APP" fetch --quiet origin main
REV=$(git -C "$APP" rev-parse origin/main)
SOURCE_IMAGE=$(docker inspect --format '{{.Config.Image}}' forza-voice)
# Source image must be a real locally cached image. No base-image download.
docker image inspect "$SOURCE_IMAGE" >/dev/null
NETWORK=$(docker inspect --format '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' forza-voice | grep -Fx supabase_default | head -1 || true)
if [ -z "$NETWORK" ]; then
  NETWORK=$(docker inspect --format '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' forza-voice | grep -v '^bridge$' | head -1 || true)
fi
test -n "$NETWORK"
STAGE=$(mktemp -d /opt/forza-resident-test.XXXXXXXX)
on_exit(){
  rc=$?
  trap - EXIT
  docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true
  rm -rf -- "$STAGE"
  exit "$rc"
}
trap on_exit EXIT
git -C "$APP" archive --format=tar "$REV" scripts/forza_pocket_worker.py | tar -xf - -C "$STAGE"
grep -q 'FORZA_TTS_RESIDENT_ACOUSTIC' "$STAGE/scripts/forza_pocket_worker.py" || {
  echo "Optimized source missing; cancelling." >&2; exit 1;
}
printf 'FROM %s\nCOPY scripts/forza_pocket_worker.py /app/scripts/forza_pocket_worker.py\n' "$SOURCE_IMAGE" > "$STAGE/Dockerfile"
TAG="sanatpish/forza-voice:resident-test-${REV:0:12}"
docker build --pull=false -q -f "$STAGE/Dockerfile" -t "$TAG" "$STAGE" >/dev/null

echo "[2/4] Starting private candidate with the same voice/model and 1 CPU, 1.5GiB limits."
docker run -d --name "$CANDIDATE" --restart no \
  --network "$NETWORK" --memory=1536m --memory-swap=1536m --cpus=1.0 \
  --env-file "$TOKENFILE" -e PORT=8080 -e FORZA_TTS_RESIDENT_ACOUSTIC=1 \
  "$TAG" >/dev/null
TOKEN=$(sed -n 's/^FORZA_VOICE_TOKEN=//p' "$TOKENFILE" | head -1)
test -n "$TOKEN"
healthy=0
for i in $(seq 1 45); do
  if docker exec sanatpish-new node -e '
    fetch("http://forza-voice-benchmark:8080/health",{signal:AbortSignal.timeout(4000)})
      .then(r=>{if(!r.ok)process.exit(1)})
      .catch(()=>process.exit(1))
  ' >/dev/null 2>&1; then healthy=1; break; fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$CANDIDATE")" != true ]; then break; fi
  sleep 2
done
test "$healthy" -eq 1 || { docker logs --tail 60 "$CANDIDATE" >&2; exit 1; }

echo "[3/4] Generating three previously uncached Persian WAVs from inside Node."
docker exec -e "FORZA_VOICE_TOKEN=$TOKEN" sanatpish-new node -e '
(async()=>{
 const phrases=[
  "این آزمایش سرعت جدید فورزا است.",
  "برای انتخاب قطعه مناسب، مشخصات فنی دستگاه را بفرمایید.",
  "در بخش فروش صنعت پیش آماده پاسخگویی به مشتریان هستیم."
 ];
 for(let i=0;i<phrases.length;i++){
   const started=Date.now();
   const res=await fetch("http://forza-voice-benchmark:8080/speak",{
     method:"POST",
     headers:{"Content-Type":"application/json","X-Forza-Voice-Token":process.env.FORZA_VOICE_TOKEN},
     body:JSON.stringify({text:phrases[i]}),
     signal:AbortSignal.timeout(65000)
   });
   const audio=Buffer.from(await res.arrayBuffer());
   const ms=Date.now()-started;
   console.log("FORZA_RESIDENT_PHRASE "+(i+1)+" http="+res.status+" ms="+ms+" bytes="+audio.length);
   if(!res.ok||audio.length<1000||audio.toString("ascii",0,4)!=="RIFF") process.exit(1);
 }
})().catch(e=>{console.error("FORZA_RESIDENT_BENCH_FAILED",e.message);process.exit(1)})
'

echo "[4/4] Inspecting memory ceiling and model timing (no service replacement)."
docker stats --no-stream "$CANDIDATE" forza-voice
docker exec "$CANDIDATE" sh -c '
  if test -r /sys/fs/cgroup/memory.peak; then
    printf "FORZA_RESIDENT_PEAK_BYTES="; cat /sys/fs/cgroup/memory.peak
  fi
'
docker logs --tail 35 "$CANDIDATE" 2>&1 | grep -E 'FORZA voice profile|generated chars|synthesis_error' || true
test "$(docker inspect --format '{{.State.Running}}' "$CANDIDATE")" = true
test "$(docker inspect --format '{{.State.OOMKilled}}' "$CANDIDATE")" = false
echo "FORZA_RESIDENT_BENCH_PASS commit=$REV image=$TAG"
echo "No changes to the live site or active voice service. The temporary test container is automatically removed."
