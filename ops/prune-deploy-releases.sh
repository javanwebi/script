#!/usr/bin/env bash
# Safely retain the active and immediately previous website release only.
# Called only after the new release and public health checks pass.
set -u
umask 077

APP=/opt/sanatpish
LEGACY_STAGE_PREFIX=/opt/sanatpish-unified-stage-
RELEASE_ROOT="$APP/.deploy/releases"
CURRENT_CONTAINER="${1:-}"
PREVIOUS_CONTAINER="${2:-}"
CURRENT_STAGE="${3:-}"

log() { printf '%s\n' "$*"; }

if [[ -z "$CURRENT_CONTAINER" || -z "$PREVIOUS_CONTAINER" || -z "$CURRENT_STAGE" ]]; then
  log 'RELEASE_PRUNE_SKIPPED missing_arguments'
  exit 0
fi

if ! docker inspect "$CURRENT_CONTAINER" >/dev/null 2>&1 ||
   ! docker inspect "$PREVIOUS_CONTAINER" >/dev/null 2>&1; then
  log 'RELEASE_PRUNE_SKIPPED release_container_missing'
  exit 0
fi

CURRENT_RUNNING="$(docker inspect "$CURRENT_CONTAINER" --format '{{.State.Running}}' 2>/dev/null || true)"
if [[ "$CURRENT_RUNNING" != true ]]; then
  log 'RELEASE_PRUNE_SKIPPED current_container_not_running'
  exit 0
fi

CURRENT_MOUNT="$(docker inspect "$CURRENT_CONTAINER" --format '{{range .Mounts}}{{if eq .Destination "/app"}}{{.Source}}{{end}}{{end}}' 2>/dev/null || true)"
if [[ -z "$CURRENT_MOUNT" || "$(readlink -f -- "$CURRENT_MOUNT" 2>/dev/null || true)" != "$(readlink -f -- "$CURRENT_STAGE" 2>/dev/null || true)" ]]; then
  log 'RELEASE_PRUNE_SKIPPED current_stage_mount_mismatch'
  exit 0
fi

PREVIOUS_RUNNING="$(docker inspect "$PREVIOUS_CONTAINER" --format '{{.State.Running}}' 2>/dev/null || true)"
if [[ "$PREVIOUS_RUNNING" == true ]]; then
  log 'RELEASE_PRUNE_SKIPPED previous_container_still_running'
  exit 0
fi
PREVIOUS_STAGE="$(docker inspect "$PREVIOUS_CONTAINER" --format '{{range .Mounts}}{{if eq .Destination "/app"}}{{.Source}}{{end}}{{end}}' 2>/dev/null || true)"

# Never prune if the newly promoted public site is unhealthy.
if ! curl --noproxy '*' -kfsS --max-time 12 \
  --resolve sanatpish.com:443:127.0.0.1 \
  https://sanatpish.com/api/health 2>/dev/null | grep -q '"database":"ok"'; then
  log 'RELEASE_PRUNE_SKIPPED public_health_check_failed'
  exit 0
fi

log "RELEASE_RETENTION_KEEP current=$CURRENT_CONTAINER previous=$PREVIOUS_CONTAINER"
log "RELEASE_RETENTION_CURRENT_STAGE=$CURRENT_STAGE"
log "RELEASE_RETENTION_PREVIOUS_STAGE=${PREVIOUS_STAGE:-none}"

# Remove only stopped website release containers. Do not remove Docker volumes.
while IFS= read -r stale; do
  [[ -n "$stale" ]] || continue
  [[ "$stale" == "$CURRENT_CONTAINER" || "$stale" == "$PREVIOUS_CONTAINER" ]] && continue

  running="$(docker inspect "$stale" --format '{{.State.Running}}' 2>/dev/null || true)"
  [[ "$running" == false ]] || { log "RELEASE_CONTAINER_RETAINED name=$stale reason=not_stopped"; continue; }

  app_source="$(docker inspect "$stale" --format '{{range .Mounts}}{{if eq .Destination "/app"}}{{.Source}}{{end}}{{end}}' 2>/dev/null || true)"
  case "$app_source" in
    "$LEGACY_STAGE_PREFIX"*|"$RELEASE_ROOT"/*) ;;
    *) log "RELEASE_CONTAINER_RETAINED name=$stale reason=unrecognized_app_mount"; continue ;;
  esac

  if docker rm "$stale" >/dev/null 2>&1; then
    log "RELEASE_CONTAINER_REMOVED name=$stale"
  else
    log "RELEASE_CONTAINER_RETAINED name=$stale reason=docker_rm_failed"
  fi
done < <(docker ps -a --format '{{.Names}}' 2>/dev/null | grep '^sanatpish-unified-live-' || true)

# Stage directories are removable only when no container mount or host process
# references them. Support both the legacy /opt layout and managed in-project releases.
shopt -s nullglob
CANDIDATES=( "$LEGACY_STAGE_PREFIX"* "$RELEASE_ROOT"/* )
for candidate in "${CANDIDATES[@]}"; do
  [[ -d "$candidate" && ! -L "$candidate" ]] || continue
  [[ "$candidate" == "$CURRENT_STAGE" || "$candidate" == "$PREVIOUS_STAGE" ]] && continue

  case "$candidate" in
    "$LEGACY_STAGE_PREFIX"*|"$RELEASE_ROOT"/*) ;;
    *) continue ;;
  esac

  python3 - "$candidate" <<'PY'
import json, os, subprocess, sys
candidate = os.path.realpath(sys.argv[1])
try:
    ids = subprocess.check_output(["docker", "ps", "-aq"], text=True).split()
    for cid in ids:
        item = json.loads(subprocess.check_output(["docker", "inspect", cid], text=True))[0]
        for mount in item.get("Mounts", []):
            source = mount.get("Source")
            if source and os.path.realpath(source) == candidate:
                print("DOCKER_MOUNT_REFERENCE", cid, source)
                sys.exit(1)
except Exception as exc:
    print("DOCKER_REFERENCE_CHECK_FAILED", type(exc).__name__)
    sys.exit(2)
sys.exit(0)
PY
  docker_ref_status=$?
  if [[ "$docker_ref_status" -ne 0 ]]; then
    log "RELEASE_STAGE_RETAINED path=$candidate reason=docker_reference_or_check_error"
    continue
  fi

  python3 - "$candidate" <<'PY'
import glob, os, sys
candidate = os.path.realpath(sys.argv[1])
for proc in glob.glob('/proc/[0-9]*'):
    pid = proc.rsplit('/', 1)[-1]
    links = [os.path.join(proc, 'cwd'), os.path.join(proc, 'root')]
    links.extend(glob.glob(os.path.join(proc, 'fd', '*')))
    for link in links:
        try:
            target = os.readlink(link).removesuffix(' (deleted)')
        except (OSError, PermissionError):
            continue
        if not os.path.isabs(target):
            continue
        resolved = os.path.realpath(target)
        if resolved == candidate or resolved.startswith(candidate + os.sep):
            print('PROCESS_PATH_REFERENCE', pid, link, target)
            sys.exit(1)
sys.exit(0)
PY
  process_ref_status=$?
  if [[ "$process_ref_status" -ne 0 ]]; then
    log "RELEASE_STAGE_RETAINED path=$candidate reason=process_reference_or_check_error"
    continue
  fi

  if rm -rf --one-file-system -- "$candidate"; then
    log "RELEASE_STAGE_REMOVED path=$candidate"
  else
    log "RELEASE_STAGE_RETAINED path=$candidate reason=rm_failed"
  fi
done

log 'RELEASE_RETENTION_COMPLETE'
exit 0
