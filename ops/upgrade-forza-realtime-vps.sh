#!/usr/bin/env bash
# Existing fixed app deployment stays authoritative. Only private Nima is replaced.
set -Eeuo pipefail
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ $EUID == 0 ]] || { echo RUN_AS_ROOT; exit 1; }
[[ $# == 2 && "$1" == --app && "$2" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]+$ ]] || { echo 'Usage: upgrade-forza-realtime-vps.sh --app sanatpish-app'; exit 1; }
APP="$2"
LIVE=forza-voice
exec 8>/run/lock/forza-voice-promote.lock
flock -n 8 || { echo VOICE_UPGRADE_ALREADY_RUNNING; exit 1; }
NETWORK="$(python3 - "$APP" <<'PY'
import json,subprocess,sys
app=json.loads(subprocess.check_output(['docker','inspect',sys.argv[1]]))[0]
assert app['State']['Running']
assert any(m['Source']=='/opt/sanatpish' and m['Destination']=='/app' for m in app['Mounts']), 'UNEXPECTED_APP_MOUNT'
n=app['HostConfig']['NetworkMode'];assert n in app['NetworkSettings']['Networks'] and n not in ('host','bridge','none')
print(n)
PY
)"
# Reserve at least two CPU cores and 2 GiB available memory for the app/DB.
WORKERS="$(python3 - <<'PY'
import os
from pathlib import Path
m={p[0].rstrip(':'):int(p[1]) for p in (line.split() for line in Path('/proc/meminfo').read_text().splitlines())}
cpu=max(1,len(os.sched_getaffinity(0))-2)
ram=max(0,(m['MemAvailable']-2*1024*1024)//(512*1024))
assert ram>=1, 'NOT_ENOUGH_FREE_MEMORY_FOR_CANARY'
print(min(4,cpu,ram))
PY
)"
MEMORY="$((WORKERS*512+256))m"
STAMP="$(date +%Y%m%d-%H%M%S)-$$"
BUILD="$(mktemp -d /root/forza-realtime-build.XXXXXX)"
CANARY="forza-nima-realtime-check-$STAMP"
BACKUP="forza-voice-before-realtime-$STAMP"
BASE="sanatpish/forza-nima:realtime-base-$STAMP"
IMAGE="sanatpish/forza-nima:realtime-$STAMP"
OLD_STOPPED=0
OLD_RENAMED=0
SUCCESS=0
cleanup(){
 rc=$?
 trap - EXIT
 set +e
 if [[ $SUCCESS != 1 ]]; then
  if [[ $OLD_RENAMED == 1 ]]; then
   docker rm -f "$LIVE" >/dev/null 2>&1
   docker rename "$BACKUP" "$LIVE"
   docker start "$LIVE" >/dev/null
  elif [[ $OLD_STOPPED == 1 ]]; then docker start "$LIVE" >/dev/null; fi
 fi
 docker rm -f "$CANARY" >/dev/null 2>&1
 rm -rf "$BUILD"
 docker image rm "$BASE" >/dev/null 2>&1
 exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Reuse the exact already-installed voice and credential, without printing secrets.
python3 - "$LIVE" "$BUILD/private.env" "$NETWORK" <<'PY'
import json,subprocess,sys
voice=json.loads(subprocess.check_output(['docker','inspect',sys.argv[1]]))[0]
assert voice['State']['Running'] and sys.argv[3] in voice['NetworkSettings']['Networks']
token=next((e for e in voice['Config']['Env'] if e.startswith('FORZA_VOICE_TOKEN=')),None)
assert token and '\n' not in token and '\r' not in token and len(token.partition('=')[2])>=16
with open(sys.argv[2],'x') as f:f.write(token+'\n')
PY
docker exec "$LIVE" python -c 'from importlib.metadata import version; import hashlib; assert version("piper-tts")=="1.8.0"; assert hashlib.sha256(open("/app/voice/fa_IR-gyro-medium.onnx","rb").read()).hexdigest()=="37dfae43c82ee38ca9e6aac4ffef76a74d6b282ccbc397b27761f35d355c99ba"'
docker tag "$(docker inspect "$LIVE" --format '{{.Image}}')" "$BASE"
mkdir -p "$BUILD/scripts"
cp "$ROOT/scripts/forza_nima_voice_http.py" "$BUILD/scripts/"
cat > "$BUILD/Dockerfile" <<'DOCKER'
ARG FORZA_BASE_IMAGE
FROM ${FORZA_BASE_IMAGE}
WORKDIR /app
COPY scripts/forza_nima_voice_http.py scripts/forza_nima_voice_http.py
CMD ["python", "-u", "scripts/forza_nima_voice_http.py"]
DOCKER
printf 'private.env\n' > "$BUILD/.dockerignore"
FINGERPRINT="$(cd "$ROOT" && sha256sum Dockerfile.forza-nima scripts/forza_nima_voice_http.py | sha256sum | awk '{print $1}')"
docker build --network=none --pull=false --build-arg "FORZA_BASE_IMAGE=$BASE" \
 --label "com.sanatpish.forza.source-sha256=$FINGERPRINT" -t "$IMAGE" "$BUILD"
run_voice(){
 docker run -d --name "$1" --restart unless-stopped --network "$NETWORK" \
  --cpus="$WORKERS" --memory="$MEMORY" --memory-swap="$MEMORY" --pids-limit=192 \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m --cap-drop=ALL --security-opt=no-new-privileges \
  --env-file "$BUILD/private.env" -e PORT=8080 -e FORZA_NIMA_BIND=0.0.0.0 \
  -e "FORZA_NIMA_WORKERS=$WORKERS" -e OMP_NUM_THREADS=1 -e OPENBLAS_NUM_THREADS=1 -e MKL_NUM_THREADS=1 "$IMAGE" >/dev/null
}
wait_voice(){
 for _ in $(seq 1 90); do
  if docker exec -e "FORZA_CHECK_HOST=$1" -e "FORZA_CHECK_WORKERS=$WORKERS" "$APP" node -e '
fetch("http://"+process.env.FORZA_CHECK_HOST+":8080/health",{signal:AbortSignal.timeout(2000)}).then(async r=>{const d=await r.json();process.exit(r.ok&&d.voice==="piper-nima-gyro-medium"&&d.workers===Number(process.env.FORZA_CHECK_WORKERS)&&d.onnx_threads_per_worker===1?0:1)}).catch(()=>process.exit(1))' >/dev/null 2>&1; then return 0; fi
  [[ "$(docker inspect "$1" --format '{{.State.Running}}')" == true ]] || return 1
  sleep 1
 done
 return 1
}
run_voice "$CANARY"
wait_voice "$CANARY"
# Concurrent authenticated synthesis, with generated WAVs only in memory.
docker exec -i "$CANARY" python - <<'PY'
import concurrent.futures,json,os,time,urllib.request
start=time.monotonic()
def call(_):
 r=urllib.request.Request('http://127.0.0.1:8080/speak',data=json.dumps({'text':'سلام، شماره فنی قطعه را بفرمایید.'}).encode(),headers={'Content-Type':'application/json','X-Forza-Voice-Token':os.environ['FORZA_VOICE_TOKEN']})
 with urllib.request.urlopen(r,timeout=25) as response:
  wav=response.read();assert response.status==200 and response.headers['X-Forza-Voice']=='piper-nima-gyro-medium' and wav[:4]==b'RIFF' and wav[8:12]==b'WAVE'
  return {'queueMs':int(response.headers['X-Forza-Queue-Ms']),'inferenceMs':int(response.headers['X-Forza-Inference-Ms']),'wavBytes':len(wav)}
n=int(os.environ['FORZA_NIMA_WORKERS'])
with concurrent.futures.ThreadPoolExecutor(max_workers=n) as clients:results=list(clients.map(call,range(n)))
print('FORZA_CONCURRENCY_CANARY '+json.dumps({'workers':n,'wallMs':round((time.monotonic()-start)*1000),'requests':results}))
PY
# Do not contend with the new live pool by leaving the canary's workers running.
docker rm -f "$CANARY" >/dev/null
docker stop --time 15 "$LIVE" >/dev/null
OLD_STOPPED=1
docker rename "$LIVE" "$BACKUP"
OLD_RENAMED=1
run_voice "$LIVE"
wait_voice "$LIVE"
docker exec "$APP" node -e '
fetch("http://127.0.0.1:3000/api/ai/forza-speech",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:"سلام، شماره فنی قطعه را بفرمایید.",turnId:"realtime-upgrade-check"}),signal:AbortSignal.timeout(15000)})
.then(async r=>{const b=Buffer.from(await r.arrayBuffer());if(!r.ok||r.headers.get("X-Forza-Voice")!=="piper-nima-gyro-medium"||b.toString("ascii",0,4)!=="RIFF"||b.toString("ascii",8,12)!=="WAVE")process.exit(1);console.log("FORZA_SITE_VOICE_WAV_OK bytes="+b.length)})
.catch(()=>process.exit(1))'
SUCCESS=1
echo "FORZA_REALTIME_VOICE_READY workers=$WORKERS cpu_limit=$WORKERS memory_limit=$MEMORY"
echo "VOICE_ROLLBACK_CONTAINER=$BACKUP"
echo 'Site source still deploys with: sudo sanatpish-deploy-main'
