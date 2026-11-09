#!/usr/bin/env bash
# One command for every production update: sudo sanatpish-deploy-main
set -Eeuo pipefail
umask 077
export GIT_TERMINAL_PROMPT=0
APP=/opt/sanatpish
cd "$APP"
echo "===== FETCH CANONICAL MAIN ====="
git fetch origin main
SHA="$(git rev-parse FETCH_HEAD)"
test -n "$SHA"
echo "MAIN_RELEASE_SHA=$SHA"
echo "===== READ SCRIPT FROM EXACT FETCHED COMMIT ====="
TEMP="$(mktemp /tmp/sanatpish-main-bluegreen.XXXXXXXX.sh)"
trap 'rm -f -- "$TEMP"' EXIT
git show "$SHA:ops/deploy-main-bluegreen-vps.sh" > "$TEMP"
bash -n "$TEMP"
echo "===== CANARY, TESTS, NGINX SWITCH AND ROLLBACK ====="
SANATPISH_RELEASE_SHA="$SHA" bash "$TEMP"
echo "===== FINAL HTTPS HEALTH ====="
curl --noproxy '*' -kfsS --max-time 15 \
  --resolve sanatpish.com:443:127.0.0.1 \
  https://sanatpish.com/api/health | grep -q '"database":"ok"'
echo "FINAL_HTTPS_HEALTH_OK domain=sanatpish.com sni=correct"
echo "SANATPISH_MAIN_DEPLOY_COMMAND_OK commit=$SHA"
