#!/usr/bin/env bash
# Manual, failure-safe VPS deployment for the existing bind-mounted SanatPish app.
# Download/build in isolation; promote only after validation. Brief restart, not zero downtime.
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
exec 9>/run/lock/sanatpish-deploy.lock
flock -w 10 9 || { echo "Another deployment is running"; exit 1; }
cd /opt/sanatpish
test "$(git remote get-url origin)" = "https://github.com/javanwebi/script.git"
test "$(git branch --show-current)" = "main"
git diff --quiet && git diff --cached --quiet || { echo "Tracked local edits exist: aborting safely"; exit 1; }
mount_source=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app"}}{{.Source}}{{end}}{{end}}' sanatpish-new)
[ "$mount_source" = /opt/sanatpish ] || { echo "Unexpected /app mount: $mount_source"; exit 1; }
docker image inspect node:22-bookworm >/dev/null
old="$(git rev-parse HEAD)"
git fetch --quiet origin main
new="$(git rev-parse FETCH_HEAD)"
git merge-base --is-ancestor "$old" "$new" || { echo "Non fast-forward update: abort"; exit 1; }
if [ "$old" = "$new" ]; then echo "Already current: $old"; exit 0; fi
echo "Deploying from $old to $new"
# npm installation and validation run in an isolated directory, never in /app.
# A brief restart is required only AFTER candidate validation.
APP=/opt/sanatpish
CONTAINER=sanatpish-new
NODE_IMAGE=node:22-bookworm
DOCKER_NETWORK=supabase_default
MIRROR=https://registry.npmmirror.com

stage=$(mktemp -d /opt/sanatpish-stage.XXXXXXXX)
promoting=0
source_changed=0
old_modules_moved=0
new_modules_live=0
old_dist_moved=0
new_dist_live=0

on_exit() {
  local status=$1
  trap - EXIT ERR INT TERM
  set +e
  if [ "$status" -ne 0 ]; then
    if [ "$promoting" -eq 1 ]; then
      echo "Promotion failed; restoring previous application: $old"
      if [ "$source_changed" -eq 1 ]; then git -C "$APP" reset --hard "$old" || true; fi
      if [ "$new_modules_live" -eq 1 ] && [ -d "$APP/node_modules" ]; then
        mv "$APP/node_modules" "$stage/.failed-node_modules" || true
      fi
      if [ "$old_modules_moved" -eq 1 ] && [ -d "$stage/.old-node_modules" ]; then
        mv "$stage/.old-node_modules" "$APP/node_modules" || true
      fi
      if [ "$new_dist_live" -eq 1 ] && [ -d "$APP/dist" ]; then
        mv "$APP/dist" "$stage/.failed-dist" || true
      fi
      if [ "$old_dist_moved" -eq 1 ] && [ -d "$stage/.old-dist" ]; then
        mv "$stage/.old-dist" "$APP/dist" || true
      fi
      docker restart "$CONTAINER" >/dev/null 2>&1 || docker start "$CONTAINER" >/dev/null 2>&1 || true
      echo 'Rollback attempted; verify container logs and /api/health.'
    else
      echo 'Preparation failed; live source, dependencies, and running container are unchanged.'
    fi
  fi
  case "$stage" in /opt/sanatpish-stage.*) rm -rf -- "$stage" ;; esac
}
trap 'on_exit $?' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Export the proposed commit without updating the live working tree.
git archive --format=tar "$new" | tar -xf - -C "$stage"

# Reuse a COPY of working dependencies when package manifests are unchanged.
if git diff --quiet "$old" "$new" -- package.json package-lock.json \
  && [ -f "$APP/node_modules/tsx/dist/cli.mjs" ] \
  && [ -f "$APP/node_modules/vite/package.json" ]; then
  echo 'Dependency manifests unchanged; copying live dependencies to staging.'
  cp -a "$APP/node_modules" "$stage/node_modules"
else
  echo 'Installing candidate dependencies in isolation from npm mirror.'
  # npm lockfiles pin tarball URLs: rewriting only the STAGING copy is required.
  sed 's#https://registry.npmjs.org/#https://registry.npmmirror.com/#g' \
    "$stage/package-lock.json" > "$stage/package-lock.json.mirror"
  mv "$stage/package-lock.json.mirror" "$stage/package-lock.json"
  docker run --rm --pull=never --network "$DOCKER_NETWORK" \
    --mount "type=bind,source=$stage,target=/app" -w /app \
    -e "npm_config_registry=$MIRROR" \
    -e npm_config_maxsockets=2 \
    -e npm_config_fetch_retries=6 \
    -e npm_config_fetch_retry_mintimeout=20000 \
    -e npm_config_fetch_retry_maxtimeout=120000 \
    -e npm_config_fetch_timeout=120000 \
    "$NODE_IMAGE" npm ci --include=dev --no-audit --no-fund
fi

[ -f "$stage/node_modules/tsx/dist/cli.mjs" ] || { echo 'Candidate tsx missing'; exit 1; }
[ -f "$stage/node_modules/vite/package.json" ] || { echo 'Candidate vite missing'; exit 1; }

docker run --rm --pull=never --network "$DOCKER_NETWORK" \
  --mount "type=bind,source=$stage,target=/app" -w /app \
  "$NODE_IMAGE" npm run lint

docker run --rm --pull=never --network "$DOCKER_NETWORK" \
  --mount "type=bind,source=$stage,target=/app" -w /app \
  "$NODE_IMAGE" npm run build
[ -f "$stage/dist/index.html" ] || { echo 'Candidate build output missing'; exit 1; }

echo 'Candidate validated; switching live revision (brief restart).'
promoting=1
docker stop -t 15 "$CONTAINER" >/dev/null
source_changed=1
git merge --ff-only "$new"

if [ -d "$APP/node_modules" ]; then
  mv "$APP/node_modules" "$stage/.old-node_modules"
  old_modules_moved=1
fi
mv "$stage/node_modules" "$APP/node_modules"
new_modules_live=1

if [ -d "$APP/dist" ]; then
  mv "$APP/dist" "$stage/.old-dist"
  old_dist_moved=1
fi
mv "$stage/dist" "$APP/dist"
new_dist_live=1

docker start "$CONTAINER" >/dev/null
ok=0
for n in $(seq 1 40); do
  if curl -fsS --max-time 5 http://127.0.0.1:3001/api/health 2>/dev/null | grep -q '"database":"ok"'; then
    ok=1
    break
  fi
  sleep 3
done
[ "$ok" -eq 1 ] || { echo 'New release failed health check'; exit 1; }
promoting=0
echo "DEPLOY_OK $(git rev-parse HEAD)"
