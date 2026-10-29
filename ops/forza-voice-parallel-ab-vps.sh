#!/usr/bin/env bash
# Isolated, sequential A/B test of a 1-core/1-worker and 1.75-core/2-worker
# Pocket Farsi v2 configuration. Same voice, same uncached Persian phrases.
# Never replaces the public website or the active FORZA voice container.
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
umask 077
test "${EUID}" -eq 0 || { echo "Run using sudo" >&2; exit 1; }
APP=/opt/sanatpish
TEST=forza-voice-ab-test
SECRET=/etc/sanatpish/forza-voice.env
test -d "$APP/.git"
test "$(git -C "$APP" remote get-url origin)" = https://github.com/javanwebi/script.git
test -r "$SECRET"
test "$(docker inspect --format '{{.State.Running}}' forza-voice)" = true
test "$(docker inspect --format '{{.State.Running}}' sanatpish-new)" = true
! docker container inspect "$TEST" >/dev/null 2>&1 || {
  echo "Previous test container exists; not replacing it." >&2
  exit 1
}
MEMKB=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
DISKKB=$(df -Pk / | awk 'NR==2 {print $4}')
test "$MEMKB" -ge 1800000 || { echo "Low available RAM: skip test" >&2; exit 1; }
test "$DISKKB" -ge 1048576 || { echo "Low disk space: skip test" >&2; exit 1; }
IMAGE=$(docker inspect --format '{{.Config.Image}}' forza-voice)
docker image inspect "$IMAGE" >/dev/null
NETWORK=$(docker inspect --format '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' forza-voice | grep -Fx supabase_default | head -1 || true)
if [ -z "$NETWORK" ]; then
  NETWORK=$(docker inspect --format '{{range $name, $conf := .NetworkSettings.Networks}}{{println $name}}{{end}}' forza-voice | grep -v '^bridge$' | head -1 || true)
fi
test -n "$NETWORK"
TOKEN=$(sed -n 's/^FORZA_VOICE_TOKEN=//p' "$SECRET" | head -1)
test "${#TOKEN}" -eq 64 || { echo "Invalid internal voice token" >&2; exit 1; }

STAGE=$(mktemp -d /opt/forza-ab.XXXXXXXX)
cleanup() {
  rc=$?
  trap - EXIT INT TERM
  docker rm -f "$TEST" >/dev/null 2>&1 || true
  rm -rf -- "$STAGE"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
git -C "$APP" fetch --quiet origin main
REV=$(git -C "$APP" rev-parse origin/main)
git -C "$APP" archive --format=tar "$REV" scripts/forza_pocket_worker.py | tar -xf - -C "$STAGE"
grep -q 'FORZA_TTS_PARALLEL_CHUNKS' "$STAGE/scripts/forza_pocket_worker.py" || {
  echo "The expected parallel-chunk source was not found" >&2; exit 1;
}
printf 'FROM %s\nCOPY scripts/forza_pocket_worker.py /app/scripts/forza_pocket_worker.py\n' "$IMAGE" > "$STAGE/Dockerfile"
TAG="sanatpish/forza-voice:ab-${REV:0:12}"
echo "[1/3] Preparing two-mode CPU benchmark from the existing offline voice image..."
docker build --pull=false -q -f "$STAGE/Dockerfile" -t "$TAG" "$STAGE" >/dev/null

run_mode() {
  mode="$1"
  cpu="$2"
  workers="$3"
  echo "[2/3] Running mode=$mode with $cpu vCPU and $workers voice-chunk worker(s)."
  docker run -d --name "$TEST" --restart no \
    --network "$NETWORK" --cpus="$cpu" \
    --memory=1536m --memory-swap=1536m --pids-limit=128 \
    --env-file "$SECRET" -e PORT=8080 \
    -e FORZA_TTS_RESIDENT_ACOUSTIC=1 \
    -e FORZA_TTS_PARALLEL_CHUNKS="$workers" \
    "$TAG" >/dev/null
  ready=0
  for i in $(seq 1 45); do
    if docker exec sanatpish-new node -e '
      fetch("http://forza-voice-ab-test:8080/health",{signal:AbortSignal.timeout(3500)})
        .then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))
    ' >/dev/null 2>&1; then ready=1; break; fi
    if [ "$(docker inspect --format '{{.State.Running}}' "$TEST")" != true ]; then break; fi
    sleep 2
  done
  test "$ready" -eq 1 || { docker logs --tail 60 "$TEST" >&2; exit 1; }

  docker exec -e "FORZA_VOICE_TOKEN=$TOKEN" -e "FORZA_BENCH_MODE=$mode" sanatpish-new node -e '
  (async()=>{
    const phrases=[
      "سلام، برای راهنمایی انتخاب قطعات صنعتی در خدمت شما هستم.",
      "برای انتخاب قطعه مناسب، شماره فنی و مشخصات دستگاه را بفرمایید.",
      "اگر محصول در کاتالوگ موجود نباشد، امکان بررسی سفارش ساخت وجود دارد."
    ];
    const durations=[];
    for(let i=0;i<phrases.length;i++){
      const start=performance.now();
      const r=await fetch("http://forza-voice-ab-test:8080/speak",{
        method:"POST",
        headers:{"Content-Type":"application/json","X-Forza-Voice-Token":process.env.FORZA_VOICE_TOKEN},
        body:JSON.stringify({text:phrases[i]}),
        signal:AbortSignal.timeout(65000)
      });
      const wav=Buffer.from(await r.arrayBuffer());
      const ms=Math.round(performance.now()-start);
      if(!r.ok||wav.length<1000||wav.toString("ascii",0,4)!=="RIFF")
        throw Error("Invalid WAV from candidate phrase "+(i+1)+" HTTP="+r.status);
      durations.push(ms);
      console.log("FORZA_AB mode="+process.env.FORZA_BENCH_MODE+" phrase="+(i+1)+" ms="+ms+" bytes="+wav.length);
    }
    console.log("FORZA_AB_SUMMARY mode="+process.env.FORZA_BENCH_MODE+
      " avg_ms="+Math.round(durations.reduce((a,b)=>a+b,0)/durations.length));
  })().catch(e=>{console.error(e);process.exit(1)})
  ' | tee "$STAGE/bench-$mode.txt"

  docker exec "$TEST" sh -c '
    if test -r /sys/fs/cgroup/memory.peak; then
      printf "FORZA_AB_PEAK_BYTES="; cat /sys/fs/cgroup/memory.peak
    fi
    if test -r /sys/fs/cgroup/cpu.stat; then
      echo "FORZA_AB_CPU_STAT"; cat /sys/fs/cgroup/cpu.stat
    fi
  '
  test "$(docker inspect --format '{{.State.Running}}' "$TEST")" = true
  test "$(docker inspect --format '{{.State.OOMKilled}}' "$TEST")" = false
  docker stats --no-stream "$TEST"
  docker logs --tail 18 "$TEST" 2>&1 | grep -E 'FORZA voice profile|synthesis_error|generated chars' || true
  docker rm -f "$TEST" >/dev/null
}

run_mode serial 1.0 1
# Benchmark on the same machine at 1.75 vCPU, leaving at least 1.25 vCPU
# of the host's observed three vCPU available to Nginx, Node and Supabase.
run_mode parallel 1.75 2
echo "[3/3] Completed sequential A/B benchmark; live voice never changed."
echo "FORZA_AB_BENCH_PASS commit=$REV"
echo "Only consider promotion if parallel is materially faster with safe memory."
