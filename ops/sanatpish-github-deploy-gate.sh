#!/usr/bin/env bash
# ForcedCommand for the dedicated GitHub Actions deploy key.
# Only accepts: deploy <40-character lowercase main commit SHA>.
set -Eeuo pipefail

ORIGINAL_COMMAND="${SSH_ORIGINAL_COMMAND:-}"
if [[ ! "$ORIGINAL_COMMAND" =~ ^deploy[[:space:]]([a-f0-9]{40})$ ]]; then
  echo "DEPLOY_COMMAND_DENIED: expected 'deploy <40-character-main-sha>'" >&2
  exit 64
fi

EXPECTED_SHA="${BASH_REMATCH[1]}"
# sudoers keeps only this single, validated release identifier.
# The sudo rule permits exactly the canonical deploy entrypoint with no arguments.
exec /usr/bin/env "SANATPISH_EXPECTED_MAIN_SHA=$EXPECTED_SHA" \
  /usr/bin/sudo -n /usr/local/sbin/sanatpish-deploy-main
