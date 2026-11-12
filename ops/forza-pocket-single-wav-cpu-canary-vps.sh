#!/usr/bin/env bash
# Build and measure full-Pocket-one-WAV mode in an ephemeral 2-CPU/2-GiB canary.
# Uses the exact live image, male speaker state and reference. No customer WAV disk writes.
# Does not stop, rename, restart or mutate the live voice/site/DB.
set -Eeuo pipefail
umask 077
test "$EUID" = 0 || { echo "Use sudo bash" >&2; exit 1; }
APP=/opt/sanatpish
LIVE=forza-voice
SITE=sanatpish-new
CANDIDATE=forza-pocket-fullwav-canary
SECRETS=/etc/sanatpish/forza-voice.env
ORIGINAL_SHA=31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833
test -r "$SECRETS"
test -d "$APP/.git"
test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
test "$(docker inspect -f '{{.State.Running}}' "$SITE")" = true
test "$(docker exec "$LIVE" sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')" = "$ORIGINAL_SHA" || { echo "Wrong selected male voice" >&2; exit 1; }
! docker container inspect "$CANDIDATE" >/dev/null 2>&1 || { echo "Existing canary exists; refusing to replace" >&2; exit 1; }
test "$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)" -gt 2450000 || { echo "Insufficient host available RAM" >&2; exit 1; }
test "$(df -Pk / | awk 'NR==2 {print $4}')" -gt 750000 || { echo "Insufficient free disk for temporary image" >&2; exit 1; }
SOURCE_IMAGE=$(docker inspect -f '{{.Config.Image}}' "$LIVE")
docker image inspect "$SOURCE_IMAGE" >/dev/null
NETWORK=$(docker inspect -f '{{range $n,$c := .NetworkSettings.Networks}}{{println $n}}{{end}}' "$LIVE" | grep -Fx supabase_default | head -1 || true)
if [ -z "$NETWORK" ]; then
 NETWORK=$(docker inspect -f '{{range $n,$c := .NetworkSettings.Networks}}{{println $n}}{{end}}' "$LIVE" | grep -v '^bridge$' | head -1 || true)
fi
test -n "$NETWORK"
TOKEN=$(sed -n 's/^FORZA_VOICE_TOKEN=//p' "$SECRETS" | head -1)
test "$(printf %s "$TOKEN" | wc -c)" -eq 64 || { echo "Private voice token unavailable" >&2; exit 1; }
STAGE=$(mktemp -d /opt/forza-pocket-wav-canary.XXXXXXXX)
cleanup(){
 rc=$?
 trap - EXIT INT TERM
 docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true
 rm -rf -- "$STAGE"
 exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
echo "FORZA_FULLWAV_CANARY_START original_voice_unchanged=1 no_audio_disk=1 live_service_untouched=1"
git -C "$APP" fetch --quiet origin main
REV=$(git -C "$APP" rev-parse origin/main)
git -C "$APP" archive --format=tar "$REV" scripts/forza_pocket_worker.py scripts/forza_voice_http.py scripts/forza_pocket_overlap.py | tar -xf - -C "$STAGE"
grep -q 'if FULL_ANSWER_WAV else render(engine, phrase)' "$STAGE/scripts/forza_voice_http.py" || { echo "Full-answer /speak code missing on main" >&2; exit 1; }
grep -q 'KEEP_G2P = os.environ.get' "$STAGE/scripts/forza_pocket_worker.py" || { echo "Resident G2P code missing" >&2; exit 1; }
printf 'FROM %s\nCOPY scripts/forza_pocket_worker.py /app/scripts/forza_pocket_worker.py\nCOPY scripts/forza_voice_http.py /app/scripts/forza_voice_http.py\nCOPY scripts/forza_pocket_overlap.py /app/scripts/forza_pocket_overlap.py\n' "$SOURCE_IMAGE" > "$STAGE/Dockerfile"
TAG="sanatpish/forza-voice:fullwav-canary-$(printf %s "$REV" | cut -c1-12)"
docker build --pull=false -q -f "$STAGE/Dockerfile" -t "$TAG" "$STAGE" >/dev/null
docker run -d --name "$CANDIDATE" --restart no --network "$NETWORK" \
 --cpus=2.0 --cpu-shares=256 --memory=2g --memory-swap=2g --pids-limit=128 \
 --env-file "$SECRETS" -e PORT=8080 \
 -e FORZA_TTS_RESIDENT_ACOUSTIC=1 -e FORZA_TTS_RESIDENT_G2P=1 \
 -e FORZA_TTS_WARMUP=1 -e FORZA_TTS_FULL_ANSWER_WAV=1 \
 -e FORZA_TTS_UNBROKEN=1 -e FORZA_TTS_STAGE_PROFILE=1 \
 -e FORZA_TTS_PARALLEL_CHUNKS=2 -e FORZA_TTS_STREAM_FIRST_TOKENS=18 \
 -e FORZA_TTS_FIRST_FRAME_PRIORITY=0 -e FORZA_TTS_OVERLAP_MIMI=0 \
 -e FORZA_TTS_RETRY_ATTEMPTS=3 -e FORZA_CPU_INTRA=1 \
 -e FORZA_CPU_ARENA=0 -e FORZA_CPU_PATTERN=0 "$TAG" >/dev/null
echo "FORZA_FULLWAV_CANARY_WAIT resident voice initialization"
ready=0
for i in $(seq 1 65); do
 if docker exec "$SITE" node -e '
 fetch("http://forza-pocket-fullwav-canary:8080/health",{signal:AbortSignal.timeout(2500)})
 .then(async r=>{const j=await r.json();if(!r.ok||j.voice!=="pocket-farsi-v2")process.exit(1)})
 .catch(()=>process.exit(1))
 ' >/dev/null 2>&1; then ready=1; break; fi
 if [ "$(docker inspect -f '{{.State.Running}}' "$CANDIDATE")" != true ]; then break; fi
 sleep 2
done
test "$ready" = 1 || { docker logs --tail 80 "$CANDIDATE" >&2; echo "CANARY_NOT_READY" >&2; exit 1; }
test "$(docker exec "$CANDIDATE" sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')" = "$ORIGINAL_SHA"
test "$(docker exec "$CANDIDATE" sha256sum /app/vendor/persian_tts/forza_voice_state.npz | awk '{print $1}')" = "$(docker exec "$LIVE" sha256sum /app/vendor/persian_tts/forza_voice_state.npz | awk '{print $1}')" || { echo "Changed male speaker state" >&2; exit 1; }
echo "FORZA_FULLWAV_CANARY_MEASURE fixed noncustomer text and identical voices"
docker exec -i -e "FORZA_VOICE_TOKEN=$TOKEN" "$SITE" node - <<'JS'
(async()=>{
 const samples=[
  ['short','سلام من فورزا هستم و برای راهنمایی شما آماده هستم'],
  ['long','لطفاً کد قطعه را بفرمایید و مشخصات فنی تسمه را اعلام کنید تا بتوانم قطعه مورد نظر را از کاتالوگ پیدا کنم']
 ];
 async function measure(route,url,phrase){
  const started=performance.now();
  const r=await fetch(url+'/speak',{
   method:'POST',headers:{'Content-Type':'application/json','X-Forza-Voice-Token':process.env.FORZA_VOICE_TOKEN},
   body:JSON.stringify({text:phrase}),signal:AbortSignal.timeout(180000)
  });
  const raw=Buffer.from(await r.arrayBuffer());
  if(r.status!==200||raw.length<100||raw.length>8_000_000 ||
    raw.toString('ascii',0,4)!=='RIFF'||raw.toString('ascii',8,12)!=='WAVE'||
    raw.readUInt16LE(22)!==1||raw.readUInt32LE(24)!==24000||raw.readUInt16LE(34)!==16)
   throw Error(route+' HTTP='+r.status+' bytes='+raw.length);
  const ms=Math.round(performance.now()-started);
  const seconds=(raw.length-44)/48000;
  console.log('FORZA_FULLWAV_RESULT route='+route+' total_ms='+ms+
    ' audio_s='+seconds.toFixed(2)+' rtf='+(ms/1000/seconds).toFixed(2)+
    ' bytes='+raw.length+' one_wav=1 saved_audio=0');
  return ms;
 }
 for(const [kind,phrase] of samples){
  // Sequential, not concurrent, so the benchmark does not starve live inference.
  const live=await measure('live_'+kind,'http://forza-voice:8080',phrase);
  const candidate=await measure('candidate_'+kind,'http://forza-pocket-fullwav-canary:8080',phrase);
  console.log('FORZA_FULLWAV_COMPARE sample='+kind+' live_ms='+live+
   ' candidate_ms='+candidate+' speedup='+(live/candidate).toFixed(2)+'x');
 }
})().catch(e=>{console.error('FORZA_FULLWAV_FAILED',e.message);process.exitCode=1});
JS
docker stats --no-stream "$CANDIDATE" "$LIVE" "$SITE"
# Some VPS Docker cgroups do not expose memory.peak. 0 denotes an
# unavailable measurement, NOT zero actual usage and NOT an OOM.
# Always report the live cgroup current value separately. When peak is
# unavailable, the run is a valid LATENCY probe but cannot be promoted based
# on memory safety until a supported peak monitor is added.
PEAK=$(docker exec "$CANDIDATE" cat /sys/fs/cgroup/memory.peak 2>/dev/null || true)
CURRENT=$(docker exec "$CANDIDATE" cat /sys/fs/cgroup/memory.current 2>/dev/null || true)
case "$CURRENT" in ''|*[!0-9]*) CURRENT=0;; esac
echo "FORZA_FULLWAV_CANARY_CURRENT_BYTES=$CURRENT"
case "$PEAK" in
  ''|0|*[!0-9]*)
    echo "FORZA_FULLWAV_CANARY_PEAK_BYTES=unavailable"
    echo "FORZA_FULLWAV_CANARY_MEMORY_GATE=inconclusive (Docker cgroup peak counter unavailable)"
    test "$CURRENT" -lt 1900000000 || { echo "Candidate current RAM exceeded 1.9GB" >&2; exit 1; }
    ;;
  *)
    echo "FORZA_FULLWAV_CANARY_PEAK_BYTES=$PEAK"
    test "$PEAK" -lt 1900000000 || { echo "Candidate memory peak exceeded 1.9GB" >&2; exit 1; }
    echo "FORZA_FULLWAV_CANARY_MEMORY_GATE=passed"
    ;;
esac
test "$(docker inspect -f '{{.State.OOMKilled}}' "$CANDIDATE")" = false
test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
test "$(docker inspect -f '{{.State.Running}}' "$SITE")" = true
docker logs --tail 220 "$CANDIDATE" 2>&1 | grep -E 'g2p_ready_ms|warmup_ms|FORZA voice CPU stages|generated chars|resident=|synthesis_ms|stream plan' || true
echo "FORZA_FULLWAV_CANARY_COMPLETE revision=$REV live_unchanged=1 exact_original_voice=1 no_audio_disk=1"
echo "CAUTION: Timing is not a pronunciation-quality test. Listen before promotion."
