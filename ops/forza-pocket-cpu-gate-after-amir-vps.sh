#!/usr/bin/env bash
# Profile original Pocket Farsi v2 CPU speed while keeping active Amir untouched.
# All generated WAV frames remain transient: no generated customer audio on disk.
set -Eeuo pipefail
umask 077
export GIT_TERMINAL_PROMPT=0
test "$EUID" -eq 0 || { echo "Run with sudo" >&2; exit 1; }
for name in docker git awk; do command -v "$name" >/dev/null || { echo "Missing $name" >&2; exit 1; }; done
APP=/opt/sanatpish
SITE=sanatpish-new
LIVE=forza-voice
CANDIDATE=forza-pocket-gate-eval
MARKER=/etc/sanatpish/forza-amir-rollback-container
SECRETS=/etc/sanatpish/forza-voice.env
EXPECTED_SHA=31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833
STAGE=""
CANDIDATE_STARTED=0
cleanup(){
  local rc=$?
  trap - EXIT INT TERM
  if [ "$CANDIDATE_STARTED" = 1 ]; then docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true; fi
  if [ -n "$STAGE" ]; then rm -rf -- "$STAGE"; fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
test -d "$APP/.git" && test -r "$SECRETS"
test "$(git -C "$APP" remote get-url origin)" = "https://github.com/javanwebi/script.git"
for name in "$SITE" "$LIVE"; do test "$(docker inspect -f '{{.State.Running}}' "$name")" = true; done
! docker inspect "$CANDIDATE" >/dev/null 2>&1 || { echo "Existing candidate container: abort" >&2; exit 1; }
# When the rollback metadata file is missing, find one uniquely named,
# stopped original container. Verify the immutable voice fingerprint.
if [ -r "$MARKER" ]; then
  BACKUP=$(sed -n 's/^BACKUP=//p' "$MARKER" | head -1)
  echo "FORZA_POCKET_BACKUP_DISCOVERY source=rollback-marker"
else
  mapfile -t BACKUPS < <(docker ps -a --format '{{.Names}}' |
    grep -E '^forza-voice-before-amir-[0-9]{14}$' || true)
  if [ "${#BACKUPS[@]}" -ne 1 ]; then
    echo "No unique Pocket backup; candidates=${#BACKUPS[@]}; live unchanged." >&2
    echo "Inspect: docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'" >&2
    exit 1
  fi
  BACKUP="${BACKUPS[0]}"
  echo "FORZA_POCKET_BACKUP_DISCOVERY source=unique-stopped-container marker_missing=1"
fi
[[ "$BACKUP" =~ ^forza-voice-before-amir-[0-9]{14}$ ]] || {
  echo "Unexpected Pocket backup name: abort" >&2; exit 1;
}
docker container inspect "$BACKUP" >/dev/null 2>&1 || {
  echo "Original Pocket backup container not found: $BACKUP" >&2; exit 1;
}
test "$(docker inspect -f '{{.State.Running}}' "$BACKUP")" = false || {
  echo "Old Pocket backup is running: abort" >&2; exit 1;
}
PARENT=$(docker inspect -f '{{.Image}}' "$BACKUP")
docker image inspect "$PARENT" >/dev/null || { echo "Pocket image not found" >&2; exit 1; }
CURRENT_IMAGE=$(docker inspect -f '{{.Image}}' "$LIVE")
test "$PARENT" != "$CURRENT_IMAGE" || {
  echo "Pocket backup is same image as live Amir: abort" >&2; exit 1;
}
BACKUP_SHA=$(docker run --rm --network none --read-only --cpus=0.25 --memory=192m \
  --entrypoint sha256sum "$PARENT" /app/public/forza-pocket-reference.wav | awk '{print $1}')
test "$BACKUP_SHA" = "$EXPECTED_SHA" || {
  echo "Backup voice SHA mismatch: refusing wrong voice/model" >&2; exit 1;
}
echo "FORZA_POCKET_BACKUP_VERIFIED name=$BACKUP voice_sha256=$BACKUP_SHA"
TOKEN=$(sed -n 's/^FORZA_VOICE_TOKEN=//p' "$SECRETS" | head -1)
test "$(printf %s "$TOKEN" | wc -c)" -eq 64 || { echo "Invalid private token" >&2; exit 1; }
test "$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)" -ge 2450000 || {
  echo "Need 2.45 GiB available RAM for safe isolated Pocket test; live untouched" >&2; exit 1;
}
NETWORK=$(docker inspect -f '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$SITE" | grep -Fx supabase_default | head -1 || true)
if [ -z "$NETWORK" ]; then
  NETWORK=$(docker inspect -f '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$SITE" | grep -v '^bridge$' | head -1 || true)
fi
test -n "$NETWORK"

STAGE=$(mktemp -d /opt/forza-pocket-gate.XXXXXXXX)
git -C "$APP" fetch --quiet origin main
REV=$(git -C "$APP" rev-parse origin/main)
git -C "$APP" archive --format=tar "$REV" scripts/forza_pocket_worker.py scripts/forza_voice_http.py |
  tar -xf - -C "$STAGE"
for item in forza_pocket_worker.py forza_voice_http.py; do
  test -r "$STAGE/scripts/$item"
done
echo "FORZA_POCKET_GATE_START revision=$REV selected_voice_sha256=$EXPECTED_SHA backup=$BACKUP"
echo "FORZA_POCKET_GATE_RESOURCES available_ram_kib=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo) cpu=$(nproc)"

# Do not rebuild or overwrite the original Pocket image. Override only
# current worker Python with read-only script mounts inside the candidate.
docker run -d --name "$CANDIDATE" --restart no \
  --network "$NETWORK" --network-alias "$CANDIDATE" \
  --cpus=2 --cpu-shares=128 --memory=2g --memory-swap=2g \
  --pids-limit=128 --read-only --tmpfs /tmp:rw,nosuid,nodev,size=96m \
  --env-file "$SECRETS" -e PORT=8080 \
  -e FORZA_TTS_RESIDENT_ACOUSTIC=1 -e FORZA_TTS_RESIDENT_G2P=1 \
  -e FORZA_TTS_WARMUP=1 -e FORZA_TTS_PARALLEL_CHUNKS=2 \
  -e FORZA_TTS_STREAM_FIRST_TOKENS=12 -e FORZA_TTS_UNBROKEN=1 \
  -e FORZA_CPU_INTRA=1 -e FORZA_ONNX_INT8=0 \
  --mount "type=bind,src=$STAGE/scripts/forza_pocket_worker.py,dst=/app/scripts/forza_pocket_worker.py,readonly" \
  --mount "type=bind,src=$STAGE/scripts/forza_voice_http.py,dst=/app/scripts/forza_voice_http.py,readonly" \
  --entrypoint python "$PARENT" -u scripts/forza_voice_http.py >/dev/null
CANDIDATE_STARTED=1

READY=0
for i in $(seq 1 90); do
  if docker exec "$SITE" node -e \
    'fetch("http://forza-pocket-gate-eval:8080/health",{signal:AbortSignal.timeout(2000)}).then(async r=>process.exit(r.ok&&(await r.json()).voice==="pocket-farsi-v2"?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1; then
    READY=1; break
  fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$CANDIDATE")" != true ]; then break; fi
  sleep 2
done
test "$READY" = 1 || { echo "Pocket candidate not ready" >&2; docker logs --tail 80 "$CANDIDATE" >&2; exit 1; }
ACTUAL_SHA=$(docker exec "$CANDIDATE" sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')
test "$ACTUAL_SHA" = "$EXPECTED_SHA" || {
  echo "Selected Pocket voice SHA mismatch: abort" >&2; exit 1;
}
docker exec "$CANDIDATE" test -s /app/vendor/persian_tts/forza_voice_state.npz

docker exec -i -e "FORZA_VOICE_TOKEN=$TOKEN" "$SITE" node - <<'JS'
(async()=>{
  const url='http://forza-pocket-gate-eval:8080/speak-stream';
  const texts=[
    ['short','سلام، من فورزا هستم.'],
    ['medium','سلام، من فورزا هستم و می‌توانم برای انتخاب قطعات صنعتی به شما کمک کنم. لطفاً کد و مشخصات قطعه مورد نیاز را بفرمایید.'],
    ['long','برای انتخاب تسمه صنعتی، شماره فنی و مشخصات دستگاه را بفرمایید. مدل‌های مختلف تسمه و انتقال نیرو را بررسی می‌کنم و بعد از تطبیق ابعاد و استاندارد قطعه، گزینه مناسب را معرفی خواهم کرد.'],
  ];
  for(const [sample,text] of texts) {
    const started=performance.now();
    const res=await fetch(url,{method:'POST',
      headers:{'Content-Type':'application/json','X-Forza-Voice-Token':process.env.FORZA_VOICE_TOKEN},
      body:JSON.stringify({text}),signal:AbortSignal.timeout(300000),
    });
    if(!res.ok||res.headers.get('x-forza-voice')!=='pocket-farsi-v2')
      throw Error('unavailable_'+sample+'_'+res.status);
    let buffer=Buffer.alloc(0),frames=0,firstMs=0,totalAudioMs=0,playbackEnds=0,underflowMs=0,maxUnderflowMs=0;
    for await (const chunk of res.body) {
      buffer=Buffer.concat([buffer,Buffer.from(chunk)]);
      if(buffer.length>9_000_000)throw Error('stream_oversize_'+sample);
      while(buffer.length>=4) {
        const n=buffer.readUInt32LE(0);
        if(n<44||n>5_000_000)throw Error('invalid_frame_length_'+sample);
        if(buffer.length<n+4)break;
        const wav=buffer.subarray(4,n+4);
        if(wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE')
          throw Error('bad_wav_'+sample);
        const sr=wav.readUInt32LE(24),channels=wav.readUInt16LE(22),bits=wav.readUInt16LE(34);
        if(sr!==24000||channels!==1||bits!==16)throw Error('bad_pcm_format_'+sample);
        const frameMs=(n-44)/(sr*channels*(bits/8))*1000;
        const arrived=performance.now()-started;
        if(frames===0){firstMs=arrived;playbackEnds=arrived+frameMs;}
        else {const gap=Math.max(0,arrived-playbackEnds);underflowMs+=gap;
          maxUnderflowMs=Math.max(maxUnderflowMs,gap);
          playbackEnds=Math.max(arrived,playbackEnds)+frameMs;
        }
        frames++;totalAudioMs+=frameMs;
        buffer=buffer.subarray(n+4);
      }
    }
    if(buffer.length||frames===0)throw Error('incomplete_stream_'+sample);
    const totalMs=performance.now()-started;
    const withinTarget=totalMs<=1000;
    console.log('FORZA_POCKET_ONE_SECOND_GATE sample='+sample+
      ' frames='+frames+
      ' first_ms='+firstMs.toFixed(0)+
      ' total_ms='+totalMs.toFixed(0)+
      ' audio_seconds='+(totalAudioMs/1000).toFixed(2)+
      ' rtf='+(totalMs/totalAudioMs).toFixed(3)+
      ' underrun_ms='+underflowMs.toFixed(0)+
      ' max_underrun_ms='+maxUnderflowMs.toFixed(0)+
      ' pass_1000ms='+(withinTarget?1:0));
  }
})().catch(e=>{console.error('FORZA_POCKET_GATE_ERROR '+e.message);process.exit(1)});
JS
docker stats --no-stream --format 'FORZA_POCKET_PROFILE_RESOURCES memory={{.MemUsage}} cpu={{.CPUPerc}}' "$CANDIDATE"
docker logs "$CANDIDATE" 2>&1 |
  grep -E 'FORZA voice stream (plan|profile)|FORZA voice stream] (first_chunk_ms|inter_chunk_gap_ms)' |
  tail -50 || true
for name in "$LIVE" "$SITE"; do test "$(docker inspect -f '{{.State.Running}}' "$name")" = true; done
echo "FORZA_POCKET_GATE_DONE live_unchanged=1 customer_wav_saved=0"
echo "The one-second target is met ONLY if every unique sample reports pass_1000ms=1."
