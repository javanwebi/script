#!/usr/bin/env bash
# Isolated full-reply WAV benchmark. Leaves all production services untouched.
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
umask 077
test "$EUID" -eq 0 || { echo "Run as root" >&2; exit 1; }
APP=/opt/sanatpish
LIVE=forza-voice
SITE=sanatpish-new
CANDIDATE=forza-voice-fullwav-test
SECRETS=/etc/sanatpish/forza-voice.env
test -d "$APP/.git" && test -r "$SECRETS"
test "$(git -C "$APP" remote get-url origin)" = https://github.com/javanwebi/script.git
test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
test "$(docker inspect -f '{{.State.Running}}' "$SITE")" = true
! docker container inspect "$CANDIDATE" >/dev/null 2>&1 || {
  echo "Existing candidate detected. Refusing to overwrite." >&2; exit 1;
}
MEMKB=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
DISKKB=$(df -Pk / | awk 'NR==2 {print $4}')
test "$MEMKB" -ge 2500000 || { echo "Need 2.5 GiB available RAM" >&2; exit 1; }
test "$DISKKB" -ge 1048576 || { echo "Need 1 GiB free disk" >&2; exit 1; }
TOKEN=$(sed -n 's/^FORZA_VOICE_TOKEN=//p' "$SECRETS" | head -1)
test "${#TOKEN}" -eq 64 || { echo "Invalid private token" >&2; exit 1; }
IMAGE_PARENT=$(docker inspect -f '{{.Config.Image}}' "$LIVE")
[[ "$IMAGE_PARENT" =~ ^[a-zA-Z0-9_./:@-]+$ ]] || exit 1
docker image inspect "$IMAGE_PARENT" >/dev/null
NETWORK=$(docker inspect -f '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -Fx supabase_default | head -1 || true)
if [ -z "$NETWORK" ]; then
  NETWORK=$(docker inspect -f '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$LIVE" | grep -v '^bridge$' | head -1 || true)
fi
test -n "$NETWORK"
VOICE_SHA=$(docker exec "$LIVE" sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')
STATE_SHA=$(docker exec "$LIVE" sha256sum /app/vendor/persian_tts/forza_voice_state.npz | awk '{print $1}')
STAGE=$(mktemp -d /opt/forza-single-wav-test.XXXXXXXX)
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

echo "[1/4] Check host resources and selected unchanged voice."
echo "FORZA_FULLWAV_HOST cpu=$(nproc) memory_available_kib=$MEMKB disk_available_kib=$DISKKB"
docker stats --no-stream "$LIVE" "$SITE"
echo "[2/4] Build disposable full-WAV candidate from live image and GitHub main."
git -C "$APP" fetch --quiet origin main
REV=$(git -C "$APP" rev-parse origin/main)
git -C "$APP" archive --format=tar "$REV" scripts/forza_voice_http.py scripts/forza_pocket_worker.py | tar -xf - -C "$STAGE"
grep -q 'MAX_TEXT_CHARS = 1000' "$STAGE/scripts/forza_voice_http.py" || {
  echo "GitHub main is missing the single-WAV changes." >&2; exit 1;
}
cat > "$STAGE/Dockerfile" <<'DOCKER'
ARG VOICE_PARENT
FROM ${VOICE_PARENT}
COPY scripts/forza_voice_http.py /app/scripts/forza_voice_http.py
COPY scripts/forza_pocket_worker.py /app/scripts/forza_pocket_worker.py
DOCKER
IMAGE="sanatpish/forza-voice:fullwav-test-${REV:0:12}"
docker build --pull=false -q --build-arg "VOICE_PARENT=$IMAGE_PARENT" \
  -t "$IMAGE" -f "$STAGE/Dockerfile" "$STAGE" >/dev/null
echo "[3/4] Start candidate (2 CPU, 2 GiB RAM, same model and same voice)."
docker run -d --name "$CANDIDATE" --restart no \
  --network "$NETWORK" --network-alias "$CANDIDATE" \
  --cpus 2.0 --cpu-shares 128 --memory 2g --memory-swap 2g --pids-limit 128 \
  --env-file "$SECRETS" -e PORT=8080 \
  -e FORZA_TTS_RESIDENT_ACOUSTIC=1 -e FORZA_TTS_RESIDENT_G2P=1 \
  -e FORZA_TTS_WARMUP=1 -e FORZA_TTS_PARALLEL_CHUNKS=2 "$IMAGE" >/dev/null
READY=0
for attempt in $(seq 1 90); do
  if docker exec "$SITE" node -e '
    fetch("http://forza-voice-fullwav-test:8080/health",{signal:AbortSignal.timeout(2500)})
    .then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))
  ' >/dev/null 2>&1; then READY=1; break; fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$CANDIDATE")" != true ]; then break; fi
  sleep 2
done
test "$READY" = 1 || { docker logs --tail 80 "$CANDIDATE" >&2; exit 1; }
test "$(docker exec "$CANDIDATE" sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')" = "$VOICE_SHA"
test "$(docker exec "$CANDIDATE" sha256sum /app/vendor/persian_tts/forza_voice_state.npz | awk '{print $1}')" = "$STATE_SHA"
echo "[4/4] One HTTP request -> one complete RIFF WAV, not framed chunks."
docker exec -i -e "FORZA_VOICE_TOKEN=$TOKEN" "$SITE" node - <<'JS'
(async()=>{
 const texts=[
  'سلام، من فورزا هستم و می‌توانم برای انتخاب قطعات صنعتی به شما کمک کنم. لطفاً کد و مشخصات قطعه مورد نیاز را بفرمایید.',
  'برای انتخاب تسمه صنعتی مناسب، لازم است نوع تسمه و عرض یا پروفیل آن مشخص شود. همچنین طول تسمه و مشخصات پولی یا دستگاه اهمیت دارد. اگر کد روی تسمه خوانا است آن را برای من ارسال کنید تا مشخصات فنی و گزینه‌های سازگار را بهتر بررسی کنیم.'
 ];
 for(let i=0;i<texts.length;i++){
  const started=performance.now();
  const response=await fetch('http://forza-voice-fullwav-test:8080/speak',{
   method:'POST',
   headers:{'Content-Type':'application/json','X-Forza-Voice-Token':process.env.FORZA_VOICE_TOKEN},
   body:JSON.stringify({text:texts[i]}),
   signal:AbortSignal.timeout(420000)
  });
  if(!response.ok)throw Error('tts_http_'+response.status);
  if(!(response.headers.get('content-type')||'').includes('audio/wav'))throw Error('not_audio_wav');
  const wav=Buffer.from(await response.arrayBuffer());
  if(wav.length<44||wav.length>8000000||wav.toString('ascii',0,4)!=='RIFF'||
     wav.toString('ascii',8,12)!=='WAVE'||wav.readUInt16LE(22)!==1||wav.readUInt32LE(24)!==24000)
    throw Error('invalid_complete_wav');
  const totalMs=performance.now()-started;
  const audioSeconds=(wav.length-44)/48000;
  console.log('FORZA_SINGLE_WAV phrase='+(i+1)+' chars='+texts[i].length+
   ' wav_bytes='+wav.length+' first_and_only_wav_ms='+Math.round(totalMs)+
   ' audio_s='+audioSeconds.toFixed(2)+' rtf='+(totalMs/1000/audioSeconds).toFixed(2));
 }
})().catch(e=>{console.error('FORZA_SINGLE_WAV_FAILED',e.message);process.exit(1)})
JS
docker stats --no-stream "$CANDIDATE" "$LIVE" "$SITE"
if docker exec "$CANDIDATE" test -r /sys/fs/cgroup/memory.peak; then
  PEAK=$(docker exec "$CANDIDATE" cat /sys/fs/cgroup/memory.peak)
  echo "FORZA_SINGLE_WAV_PEAK_BYTES=$PEAK"
  test "$PEAK" -lt 1950000000 || { echo "Candidate RAM too high" >&2; exit 1; }
fi
test "$(docker inspect -f '{{.State.OOMKilled}}' "$CANDIDATE")" = false
test "$(docker inspect -f '{{.State.Running}}' "$LIVE")" = true
test "$(docker inspect -f '{{.State.Running}}' "$SITE")" = true
echo "FORZA_SINGLE_WAV_BENCH_PASS revision=$REV voice_sha256=$VOICE_SHA image=$IMAGE"
echo "Live TTS, website, Nginx, STT, xKiro and database were NOT modified."
