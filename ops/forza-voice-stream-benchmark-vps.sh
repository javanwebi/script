#!/usr/bin/env bash
# Disposable low-traffic test: progressive first-WAV TTFA and end-to-end RTF.
# No changes to live voice container, Node/Nginx, website or Supabase.
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
umask 077
test "$EUID" -eq 0 || { echo 'Run as root' >&2; exit 1; }
APP=/opt/sanatpish
REF="${FORZA_STREAM_REF:-feat/forza-progressive-pocket-stream-20261031}"
NAME=forza-voice-stream-benchmark
LIVE=forza-voice
SECRETS=/etc/sanatpish/forza-voice.env
test -d "$APP/.git"
test -r "$SECRETS"
test "$(git -C "$APP" remote get-url origin)" = https://github.com/javanwebi/script.git
test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
test "$(docker inspect -f '{{.State.Running}}' sanatpish-new)" = true
! docker container inspect "$NAME" >/dev/null 2>&1 || { echo 'Temporary container already exists' >&2; exit 1; }
test "$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)" -ge 1800000
test "$(df -Pk / | awk 'NR==2 {print $4}')" -ge 1048576
IMAGE=$(docker inspect -f '{{.Config.Image}}' "$LIVE")
docker image inspect "$IMAGE" >/dev/null
NETWORK=$(docker inspect -f '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -Fx supabase_default | head -1 || true)
if [ -z "$NETWORK" ]; then
  NETWORK=$(docker inspect -f '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -v '^bridge$' | head -1)
fi
test -n "$NETWORK"
TOKEN=$(sed -n 's/^FORZA_VOICE_TOKEN=//p' "$SECRETS" | head -1)
test "${#TOKEN}" -eq 64
STAGE=$(mktemp -d /opt/forza-stream-test.XXXXXXXX)
cleanup(){
 rc=$?
 trap - EXIT INT TERM
 docker rm -f "$NAME" >/dev/null 2>&1 || true
 rm -rf -- "$STAGE"
 exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo '[1/4] Building test-only image from the existing Pocket model.'
case "${FORZA_STREAM_FIRST_TOKENS:-10}" in 0|10|12|14) ;; *) echo "Invalid first-chunk budget" >&2; exit 1;; esac
git -C "$APP" fetch --quiet origin "$REF"
REV=$(git -C "$APP" rev-parse FETCH_HEAD)
git -C "$APP" archive "$REV" scripts/forza_pocket_worker.py scripts/forza_voice_http.py | tar -xf - -C "$STAGE"
grep -q '^def render_chunks' "$STAGE/scripts/forza_pocket_worker.py"
grep -q 'speak-stream' "$STAGE/scripts/forza_voice_http.py"
printf 'FROM %s\nCOPY scripts/forza_pocket_worker.py /app/scripts/forza_pocket_worker.py\nCOPY scripts/forza_voice_http.py /app/scripts/forza_voice_http.py\n' "$IMAGE" > "$STAGE/Dockerfile"
TAG="sanatpish/forza-voice:stream-test-$(echo "$REV" | cut -c1-12)"
docker build --pull=false -q -f "$STAGE/Dockerfile" -t "$TAG" "$STAGE" >/dev/null
echo '[2/4] Starting temporary 1.75 CPU, 1.5 GiB private worker.'
docker run -d --name "$NAME" --restart no \
 --network "$NETWORK" --cpus=1.75 --memory=1536m --memory-swap=1536m \
 --pids-limit=128 --env-file "$SECRETS" -e PORT=8080 \
 -e FORZA_TTS_RESIDENT_ACOUSTIC=1 -e FORZA_TTS_PARALLEL_CHUNKS=2 \
 -e FORZA_TTS_STREAM_FIRST_TOKENS="${FORZA_STREAM_FIRST_TOKENS:-10}" \
 "$TAG" >/dev/null
ready=0
for i in $(seq 1 45); do
  if docker exec sanatpish-new node -e '
   fetch("http://forza-voice-stream-benchmark:8080/health",{signal:AbortSignal.timeout(3500)})
    .then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))
  ' >/dev/null 2>&1; then ready=1;break;fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$NAME")" != true ];then break;fi
  sleep 2
done
if [ "$ready" != 1 ];then docker logs --tail 60 "$NAME"; exit 1;fi

echo "[3/4] Measuring first *valid playable* WAV frame (first phoneme budget=${FORZA_STREAM_FIRST_TOKENS:-10})."
docker exec -i -e "FORZA_VOICE_TOKEN=$TOKEN" sanatpish-new node - <<'JS'
(async()=>{
 const texts=[
 "برای انتخاب قطعه مناسب، شماره فنی و مشخصات دستگاه را بفرمایید.",
 "اگر محصول در کاتالوگ موجود نباشد، امکان بررسی سفارش ساخت وجود دارد."
 ];
 for(let i=0;i<texts.length;i++){
  const start=performance.now();
  const res=await fetch("http://forza-voice-stream-benchmark:8080/speak-stream",{
   method:"POST",
   headers:{"Content-Type":"application/json","X-Forza-Voice-Token":process.env.FORZA_VOICE_TOKEN},
   body:JSON.stringify({text:texts[i]}),signal:AbortSignal.timeout(90000)
  });
  if(!res.ok||!res.body)throw Error("HTTP="+res.status);
  if(!(res.headers.get("content-type")||"").includes("application/x-forza-wav-frames"))
   throw Error("bad_content_type");
  let pending=Buffer.alloc(0),count=0,first=0,audioSec=0;
  for await(const block of res.body){
   pending=Buffer.concat([pending,Buffer.from(block)]);
   while(pending.length>=4){
    const size=pending.readUInt32LE(0);
    if(size<44||size>1500000)throw Error("invalid_frame_size");
    if(pending.length<size+4)break;
    const wav=pending.subarray(4,size+4);
    if(wav.toString("ascii",0,4)!=="RIFF"||wav.toString("ascii",8,12)!=="WAVE")throw Error("bad_wav");
    if(wav.readUInt32LE(24)!==24000||wav.readUInt16LE(22)!==1||wav.readUInt16LE(34)!==16)
      throw Error("wrong_pcm_format");
    count++;
    if(count===1)first=Math.round(performance.now()-start);
    audioSec+=(size-44)/48000;
    pending=pending.subarray(size+4);
   }
  }
  const total=Math.round(performance.now()-start);
  if(pending.length||count===0)throw Error("incomplete_audio");
  console.log("FORZA_STREAM_BENCH phrase="+(i+1)+" first_wav_ms="+first+
    " total_ms="+total+" frames="+count+" audio_s="+audioSec.toFixed(2)+
    " rtf="+(total/1000/audioSec).toFixed(2));
 }
})().catch(e=>{console.error("FORZA_STREAM_BENCH_FAILED",e.message);process.exit(1)})
JS
echo '[4/4] Checking memory and all live containers remain running.'
docker stats --no-stream "$NAME" "$LIVE" sanatpish-new
if docker exec "$NAME" test -r /sys/fs/cgroup/memory.peak;then
 PEAK=$(docker exec "$NAME" cat /sys/fs/cgroup/memory.peak)
 echo "FORZA_STREAM_PEAK_BYTES=$PEAK"
 test "$PEAK" -lt 1500000000
fi
test "$(docker inspect -f '{{.State.OOMKilled}}' "$NAME")" = false
test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
test "$(docker inspect -f '{{.State.Running}}' sanatpish-new)" = true
docker logs --tail 50 "$NAME" 2>&1 | grep -E 'FORZA voice stream|error=' || true
echo "FORZA_STREAM_BENCH_PASS revision=$REV image=$TAG"
echo 'This script changed no production service.'
