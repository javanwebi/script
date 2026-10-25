#!/usr/bin/env bash
# Managed SanatPish deploy entrypoint. Called by GitHub Actions through restricted sudo.
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
exec 9>/run/lock/sanatpish-deploy.lock
flock -w 10 9 || { echo "Another deployment is running"; exit 1; }
cd /opt/sanatpish
test "$(git remote get-url origin)" = "https://github.com/javanwebi/script.git"
test "$(git branch --show-current)" = "main"
test -z "$(git status --porcelain)" || { echo "Local edits exist: aborting safely"; exit 1; }
old="$(git rev-parse HEAD)"
git fetch --quiet origin main
new="$(git rev-parse FETCH_HEAD)"
git merge-base --is-ancestor "$old" "$new" || { echo "Non fast-forward update: abort"; exit 1; }
if [ "$old" = "$new" ]; then echo "Already current: $old"; exit 0; fi
echo "Deploying from $old to $new"
# The existing site uses a bind-mounted source directory in development mode.
# This is a brief-interruption deployment, not an atomic/zero-downtime production release.
changed_lock=0
git diff --quiet "$old" "$new" -- package-lock.json || changed_lock=1
git merge --ff-only "$new"
rollback() {
  echo "Deployment failed. Rolling back source to $old"
  git reset --hard "$old"
  if [ "$changed_lock" -eq 1 ]; then docker exec sanatpish-new npm ci || true; fi
  docker restart sanatpish-new || true
}
trap rollback ERR
if [ "$changed_lock" -eq 1 ]; then docker exec sanatpish-new npm ci; fi
docker exec sanatpish-new npm run lint
docker exec sanatpish-new npm run build
docker restart sanatpish-new
ok=0
for n in $(seq 1 40); do
  if curl -fsS --max-time 5 http://127.0.0.1:3001/api/health | grep -q '"database":"ok"'; then ok=1; break; fi
  sleep 3
done
[ "$ok" -eq 1 ] || { echo "Health check failed"; false; }
trap - ERR
echo "DEPLOY_OK $(git rev-parse HEAD)"
