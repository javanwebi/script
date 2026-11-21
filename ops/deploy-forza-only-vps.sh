#!/usr/bin/env bash
# Deploy the current pinned main release with the Forza-only safety gates.
# This deliberately bypasses the general catalog migration/deployment wrapper.
set -Eeuo pipefail
umask 077
export GIT_TERMINAL_PROMPT=0

APP=/opt/sanatpish
[[ "$EUID" == "0" ]] || { echo "RUN_AS_ROOT: use sudo bash"; exit 1; }
[[ "$(git -C "$APP" remote get-url origin)" == "https://github.com/javanwebi/script.git" ]] || {
  echo "UNEXPECTED_SANATPISH_REPOSITORY"
  exit 1
}

# Fetching updates Git objects/refs only. It does not checkout, reset, clean,
# or overwrite the server worktree (which may contain owner-managed files).
git -C "$APP" fetch --no-tags origin main
SHA="$(git -C "$APP" rev-parse FETCH_HEAD)"
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]] || { echo "INVALID_FETCHED_MAIN_SHA"; exit 1; }

INNER="$(mktemp /tmp/sanatpish-forza-only-inner.XXXXXXXX.sh)"
trap 'rm -f -- "$INNER"' EXIT
git -C "$APP" show "$SHA:ops/deploy-single-port-vps.sh" > "$INNER"
bash -n "$INNER"
grep -qF 'FORZA_ONLY_DATABASE_MIGRATIONS_SKIPPED=YES' "$INNER" || {
  echo "PINNED_RELEASE_HAS_NO_DATABASE_SAFE_FORZA_MODE"
  exit 1
}
grep -qF 'verify-forza-only-canary.mjs' "$INNER" || {
  echo "PINNED_RELEASE_HAS_NO_FORZA_CANARY"
  exit 1
}
git -C "$APP" cat-file -e "$SHA:ops/verify-forza-only-canary.mjs"

echo "FORZA_ONLY_DEPLOY_SOURCE_SHA=$SHA"
echo "FORZA_ONLY_WORKTREE_MUTATIONS=NONE"
echo "FORZA_ONLY_DATABASE_MIGRATIONS=SKIPPED"
SANATPISH_RELEASE_SHA="$SHA" SANATPISH_FORZA_ONLY=1 bash "$INNER"
