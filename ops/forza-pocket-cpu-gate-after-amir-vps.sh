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
# Optional A/B of one complete in-RAM WAV versus progressive frames.
# 1 waits for all CPU synthesis BEFORE playback; it is not a speed boost.
FORZA_GATE_FULL_ANSWER_WAV=${FORZA_GATE_FULL_ANSWER_WAV:-0}
# Never change production retry policy: opt into A/B only inside the test
# container. 1 attempt may be faster but has higher omitted-word risk.
FORZA_GATE_RETRY_ATTEMPTS=${FORZA_GATE_RETRY_ATTEMPTS:-3}
FORZA_GATE_SAMPLE=${FORZA_GATE_SAMPLE:-all}
FORZA_GATE_OVERLAP_MIMI=${FORZA_GATE_OVERLAP_MIMI:-0}
# The Pocket image patches upstream ONNX SessionOptions to read these
# per-container knobs, including for resident warm sessions. Only the
# temporary evaluation container receives the values.
FORZA_GATE_CPU_INTRA=${FORZA_GATE_CPU_INTRA:-1}
FORZA_GATE_CPU_ARENA=${FORZA_GATE_CPU_ARENA:-0}
FORZA_GATE_CPU_PATTERN=${FORZA_GATE_CPU_PATTERN:-0}
# Original Pocket generates 5 extra EOS frames on <=4-word phrases.
# Try fewer EOS tail frames in this isolated comparison ONLY, checking
# fixed-seed WAV SHA against the original before considering any rollout.
FORZA_GATE_EOS_SHORT=${FORZA_GATE_EOS_SHORT:-5}
FORZA_GATE_EOS_LONG=${FORZA_GATE_EOS_LONG:-3}
case "$FORZA_GATE_EOS_SHORT" in 1|2|3|4|5) ;; *) echo "Expected EOS_SHORT 1..5" >&2; exit 1;; esac
case "$FORZA_GATE_EOS_LONG" in 1|2|3) ;; *) echo "Expected EOS_LONG 1..3" >&2; exit 1;; esac
if [ "$FORZA_GATE_EOS_SHORT" != 5 ] || [ "$FORZA_GATE_EOS_LONG" != 3 ]; then
  test -n "${FORZA_GATE_FIXED_SEED:-}" || {
    echo "Reduced EOS tail requires a deterministic seed to compare audio" >&2; exit 1;
  }
fi
case "$FORZA_GATE_CPU_INTRA" in 1|2) ;; *) echo "Invalid FORZA_GATE_CPU_INTRA: expected 1 or 2" >&2; exit 1;; esac
for value in "$FORZA_GATE_CPU_ARENA" "$FORZA_GATE_CPU_PATTERN"; do
  case "$value" in 0|1) ;; *) echo "Invalid ONNX memory flag: expected 0 or 1" >&2; exit 1;; esac
done
# Research-only repeatable generation for comparing model operator changes.
FORZA_GATE_FIXED_SEED=${FORZA_GATE_FIXED_SEED:-}
if [ -n "$FORZA_GATE_FIXED_SEED" ]; then
  [[ "$FORZA_GATE_FIXED_SEED" =~ ^[0-9]{1,10}$ ]] &&
    test "$FORZA_GATE_FIXED_SEED" -le 2147483647 || {
      echo "Invalid fixed seed" >&2; exit 1;
    }
fi
case "$FORZA_GATE_OVERLAP_MIMI" in 0|1) ;; *) echo "Invalid Mimi overlap mode" >&2; exit 1;; esac
case "$FORZA_GATE_SAMPLE" in all|short|medium|long) ;; *) echo "Invalid sample" >&2; exit 1;; esac
case "$FORZA_GATE_RETRY_ATTEMPTS" in 1|2|3) ;; *) echo "Invalid retry budget" >&2; exit 1;; esac
case "$FORZA_GATE_FULL_ANSWER_WAV" in 0|1) ;; *) echo "Expected FORZA_GATE_FULL_ANSWER_WAV=0 or 1" >&2; exit 1;; esac
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
# The live voice may already be Pocket (e.g. after a manual/automatic
# rollback), while a separate Amir rollback marker no longer exists.
# First verify the live service reports Pocket AND serves the exact selected
# reference voice. If not, inspect the stopped backup candidates by checksum.
# Never stop, rename, restart or modify any existing container.
SOURCE_KIND=""
SOURCE_CONTAINER=""
PARENT=""
LIVE_SHA=$(docker exec "$LIVE" sha256sum /app/public/forza-pocket-reference.wav 2>/dev/null | awk '{print $1}' || true)
if [ "$LIVE_SHA" = "$EXPECTED_SHA" ] && docker exec "$SITE" node -e '
  fetch("http://forza-voice:8080/health",{signal:AbortSignal.timeout(4000)})
  .then(async r => {const data=await r.json();process.exit(r.ok&&data.voice==="pocket-farsi-v2"?0:1)})
  .catch(()=>process.exit(1))
' >/dev/null 2>&1; then
  SOURCE_KIND=verified-live-pocket
  SOURCE_CONTAINER="$LIVE"
  PARENT=$(docker inspect -f '{{.Image}}' "$LIVE")
fi

if [ -z "$PARENT" ]; then
  # Existing rollback metadata is only a HINT; missing/stale files must not
  # block selecting a provably authentic stopped Pocket backup.
  mapfile -t BACKUPS < <(docker ps -a --format '{{.Names}}' |
    grep -E '^(forza-voice-before-amir|forza-voice-previous)-[0-9]{14}$' || true)
  MATCH_COUNT=0
  for BACKUP in "${BACKUPS[@]}"; do
    test "$(docker inspect -f '{{.State.Running}}' "$BACKUP")" = false || continue
    IMAGE=$(docker inspect -f '{{.Image}}' "$BACKUP")
    docker image inspect "$IMAGE" >/dev/null 2>&1 || continue
    BACKUP_SHA=$(docker run --rm --network none --read-only --cpus=0.25 --memory=192m \
      --entrypoint sha256sum "$IMAGE" /app/public/forza-pocket-reference.wav 2>/dev/null |
      awk '{print $1}' || true)
    if [ "$BACKUP_SHA" = "$EXPECTED_SHA" ]; then
      MATCH_COUNT=$((MATCH_COUNT+1))
      SOURCE_CONTAINER="$BACKUP"
      PARENT="$IMAGE"
    fi
  done
  if [ "$MATCH_COUNT" -ne 1 ]; then
    echo "No unique checksum-verified Pocket image found (matches=$MATCH_COUNT)." >&2
    echo "Run: docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'" >&2
    echo "Live service and all old containers were left unchanged." >&2
    exit 1
  fi
  SOURCE_KIND=verified-stopped-pocket
fi
# Confirm the image itself, not just the currently running container, contains
# the identical selected voice asset. The benchmark launches this immutable
# image, not the live container's mutable filesystem.
docker image inspect "$PARENT" >/dev/null
IMAGE_SHA=$(docker run --rm --network none --read-only --cpus=0.25 --memory=192m \
  --entrypoint sha256sum "$PARENT" /app/public/forza-pocket-reference.wav 2>/dev/null | awk '{print $1}' || true)
test "$IMAGE_SHA" = "$EXPECTED_SHA" || {
  echo "Pocket image SHA mismatch: refusing wrong voice/model" >&2; exit 1;
}
echo "FORZA_POCKET_SOURCE_VERIFIED kind=$SOURCE_KIND container=$SOURCE_CONTAINER voice_sha256=$IMAGE_SHA"
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
git -C "$APP" archive --format=tar "$REV" scripts/forza_pocket_worker.py scripts/forza_voice_http.py scripts/forza_pocket_overlap.py |
  tar -xf - -C "$STAGE"
for item in forza_pocket_worker.py forza_voice_http.py; do
  test -r "$STAGE/scripts/$item"
done
echo "FORZA_POCKET_GATE_START revision=$REV selected_voice_sha256=$EXPECTED_SHA source=$SOURCE_KIND container=$SOURCE_CONTAINER"
echo "FORZA_POCKET_GATE_RESOURCES available_ram_kib=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo) cpu=$(nproc)"

# Do not rebuild or overwrite the original Pocket image. Override only
# current worker Python with read-only script mounts inside the candidate.
docker run -d --name "$CANDIDATE" --restart no \
  --network "$NETWORK" --network-alias "$CANDIDATE" \
  --cpus=2 --cpu-shares=128 --memory=2g --memory-swap=2g \
  --pids-limit=128 --read-only --tmpfs /tmp:rw,nosuid,nodev,size=96m \
  --env-file "$SECRETS" -e PORT=8080 \
  -e FORZA_TTS_RESIDENT_ACOUSTIC=1 -e FORZA_TTS_RESIDENT_G2P=1 \
  -e FORZA_TTS_WARMUP=1 -e FORZA_TTS_PARALLEL_CHUNKS=1 \
  -e FORZA_TTS_STREAM_FIRST_TOKENS=12 -e FORZA_TTS_UNBROKEN=1 \
  -e "FORZA_CPU_INTRA=$FORZA_GATE_CPU_INTRA" -e FORZA_ONNX_INT8=0 \
  -e "FORZA_CPU_ARENA=$FORZA_GATE_CPU_ARENA" \
  -e "FORZA_CPU_PATTERN=$FORZA_GATE_CPU_PATTERN" \
  -e "FORZA_TTS_EOS_SHORT=$FORZA_GATE_EOS_SHORT" \
  -e "FORZA_TTS_EOS_LONG=$FORZA_GATE_EOS_LONG" \
  -e "FORZA_TTS_FULL_ANSWER_WAV=$FORZA_GATE_FULL_ANSWER_WAV" \
  -e "FORZA_TTS_RETRY_ATTEMPTS=$FORZA_GATE_RETRY_ATTEMPTS" \
  -e FORZA_TTS_STAGE_PROFILE=1 \
  -e "FORZA_TTS_OVERLAP_MIMI=$FORZA_GATE_OVERLAP_MIMI" \
  -e "FORZA_TTS_TEST_SEED=$FORZA_GATE_FIXED_SEED" \
  --mount "type=bind,src=$STAGE/scripts/forza_pocket_worker.py,dst=/app/scripts/forza_pocket_worker.py,readonly" \
  --mount "type=bind,src=$STAGE/scripts/forza_pocket_overlap.py,dst=/app/scripts/forza_pocket_overlap.py,readonly" \
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

docker exec -i -e "FORZA_VOICE_TOKEN=$TOKEN" \
  -e "FORZA_GATE_FULL_ANSWER_WAV=$FORZA_GATE_FULL_ANSWER_WAV" \
  -e "FORZA_GATE_RETRY_ATTEMPTS=$FORZA_GATE_RETRY_ATTEMPTS" \
  -e "FORZA_GATE_SAMPLE=$FORZA_GATE_SAMPLE" \
  -e "FORZA_GATE_OVERLAP_MIMI=$FORZA_GATE_OVERLAP_MIMI" \
  -e "FORZA_GATE_FIXED_SEED=$FORZA_GATE_FIXED_SEED" \
  -e "FORZA_GATE_CPU_INTRA=$FORZA_GATE_CPU_INTRA" \
  -e "FORZA_GATE_CPU_ARENA=$FORZA_GATE_CPU_ARENA" \
  -e "FORZA_GATE_CPU_PATTERN=$FORZA_GATE_CPU_PATTERN" \
  -e "FORZA_GATE_EOS_SHORT=$FORZA_GATE_EOS_SHORT" \
  -e "FORZA_GATE_EOS_LONG=$FORZA_GATE_EOS_LONG" "$SITE" node - <<'JS'
(async()=>{
  const url='http://forza-pocket-gate-eval:8080/speak-stream';
  const texts=[
    ['short','سلام، من فورزا هستم.'],
    ['medium','سلام، من فورزا هستم و می‌توانم برای انتخاب قطعات صنعتی به شما کمک کنم. لطفاً کد و مشخصات قطعه مورد نیاز را بفرمایید.'],
    ['long','برای انتخاب تسمه صنعتی، شماره فنی و مشخصات دستگاه را بفرمایید. مدل‌های مختلف تسمه و انتقال نیرو را بررسی می‌کنم و بعد از تطبیق ابعاد و استاندارد قطعه، گزینه مناسب را معرفی خواهم کرد.'],
  ];
  for(const [sample,text] of texts) {
    if(process.env.FORZA_GATE_SAMPLE!=='all' &&
       process.env.FORZA_GATE_SAMPLE!==sample)continue;
    const started=performance.now();
    const res=await fetch(url,{method:'POST',
      headers:{'Content-Type':'application/json','X-Forza-Voice-Token':process.env.FORZA_VOICE_TOKEN},
      body:JSON.stringify({text}),signal:AbortSignal.timeout(300000),
    });
    if(!res.ok||res.headers.get('x-forza-voice')!=='pocket-farsi-v2')
      throw Error('unavailable_'+sample+'_'+res.status);
    const {createHash}=require('node:crypto');
    const digest=createHash('sha256');
    let buffer=Buffer.alloc(0),frames=0,firstMs=0,totalAudioMs=0,playbackEnds=0,underflowMs=0,maxUnderflowMs=0;
    for await (const chunk of res.body) {
      buffer=Buffer.concat([buffer,Buffer.from(chunk)]);
      if(buffer.length>9_000_000)throw Error('stream_oversize_'+sample);
      while(buffer.length>=4) {
        const n=buffer.readUInt32LE(0);
        if(n<44||n>5_000_000)throw Error('invalid_frame_length_'+sample);
        if(buffer.length<n+4)break;
        const wav=buffer.subarray(4,n+4);
        digest.update(wav);
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
    const atomic=process.env.FORZA_GATE_FULL_ANSWER_WAV==='1';
    if(atomic && frames!==1)throw Error('atomic_wav_must_have_one_frame');
    console.log('FORZA_POCKET_ONE_SECOND_GATE mode='+(atomic?'atomic':'progressive')+
      ' retries='+process.env.FORZA_GATE_RETRY_ATTEMPTS+
      ' mimi_overlap='+process.env.FORZA_GATE_OVERLAP_MIMI+
      ' fixed_seed='+(process.env.FORZA_GATE_FIXED_SEED||'random')+
      ' cpu_intra='+process.env.FORZA_GATE_CPU_INTRA+
      ' cpu_arena='+process.env.FORZA_GATE_CPU_ARENA+
      ' cpu_pattern='+process.env.FORZA_GATE_CPU_PATTERN+
      ' eos_short='+process.env.FORZA_GATE_EOS_SHORT+
      ' eos_long='+process.env.FORZA_GATE_EOS_LONG+
      ' wav_sha256='+digest.digest('hex')+
      ' sample='+sample+
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
  grep -E 'FORZA voice stream (plan|profile)|FORZA voice CPU stages|FORZA voice stream] (first_chunk_ms|inter_chunk_gap_ms)' |
  tail -50 || true
for name in "$LIVE" "$SITE"; do test "$(docker inspect -f '{{.State.Running}}' "$name")" = true; done
echo "FORZA_POCKET_GATE_DONE live_unchanged=1 customer_wav_saved=0"
echo "The one-second target is met ONLY if every unique sample reports pass_1000ms=1."
