#!/usr/bin/env bash
# One command for every production update: sudo sanatpish-deploy-main
set -Eeuo pipefail
umask 077
export GIT_TERMINAL_PROMPT=0
APP=/opt/sanatpish
cd "$APP"
CURRENT_BRANCH="$(git -C "$APP" branch --show-current)"
[[ "$CURRENT_BRANCH" == "main" ]] || {
  echo "SOURCE_CHECKOUT_MUST_BE_MAIN actual=${CURRENT_BRANCH:-detached}" >&2
  exit 1
}
git -C "$APP" diff --quiet && git -C "$APP" diff --cached --quiet || {
  echo "SOURCE_CHECKOUT_HAS_TRACKED_CHANGES - refusing to overwrite server edits" >&2
  exit 1
}
echo "===== FETCH CANONICAL MAIN ====="
git fetch origin main
SHA="$(git rev-parse FETCH_HEAD)"
test -n "$SHA"
git -C "$APP" merge-base --is-ancestor HEAD "$SHA" || {
  echo "SOURCE_CHECKOUT_CANNOT_FAST_FORWARD_TO_RELEASE head=$(git -C "$APP" rev-parse --short HEAD) release=$(git rev-parse --short "$SHA")" >&2
  exit 1
}
echo "MAIN_RELEASE_SHA=$SHA"
echo "===== READ SCRIPT FROM EXACT FETCHED COMMIT ====="
TEMP="$(mktemp /tmp/sanatpish-main-bluegreen.XXXXXXXX.sh)"
trap 'rm -f -- "$TEMP"' EXIT
git show "$SHA:ops/deploy-main-bluegreen-vps.sh" > "$TEMP"
bash -n "$TEMP"
echo "===== CANARY, TESTS, NGINX SWITCH AND ROLLBACK ====="
SANATPISH_RELEASE_SHA="$SHA" bash "$TEMP"
echo "===== FAST-FORWARD /opt/sanatpish SOURCE TO DEPLOYED MAIN ====="
git -C "$APP" merge --ff-only "$SHA"
test "$(git -C "$APP" rev-parse HEAD)" = "$SHA"
echo "SOURCE_CHECKOUT_UPDATED path=$APP commit=$SHA"
echo "===== FINAL HTTPS HEALTH ====="
curl --noproxy '*' -kfsS --max-time 15 \
  --resolve sanatpish.com:443:127.0.0.1 \
  https://sanatpish.com/api/health | grep -q '"database":"ok"'
echo "FINAL_HTTPS_HEALTH_OK domain=sanatpish.com sni=correct"
echo "SANATPISH_MAIN_DEPLOY_COMMAND_OK commit=$SHA"
