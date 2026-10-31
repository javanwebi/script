#!/usr/bin/env bash
# Deprecated: replaced by the resident-G2P, warmed, 2-CPU fast-start rollout.
set -Eeuo pipefail
echo "This legacy script is disabled. Use:"
echo "  ops/forza-voice-faststart-benchmark-vps.sh"
echo "  ops/forza-voice-faststart-promote-vps.sh"
echo "The new scripts preserve the old rollback marker and use 18-token first chunks."
exit 2
