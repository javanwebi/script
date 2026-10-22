#!/usr/bin/env bash
set -euo pipefail
# Official Supabase stack, pinned for reproducibility. Run on an isolated development server first.
revision=b46b645c6d74316dd5ec0be92bc0f94125917e9b
if [ "$#" -ne 1 ]; then echo 'Usage: prepare.sh /absolute/new-directory'; exit 1; fi
destination=$1
if [ -e "$destination" ]; then echo 'Destination already exists; no files were overwritten.'; exit 1; fi
umask 077
mkdir -p "$destination"
git clone --filter=blob:none --no-checkout https://github.com/supabase/supabase.git "$destination/upstream"
git -C "$destination/upstream" sparse-checkout set docker
git -C "$destination/upstream" checkout --detach "$revision"
cp -a "$destination/upstream/docker/." "$destination/stack/"
cp "$destination/stack/.env.example" "$destination/stack/.env"
echo 'Official stack prepared. Replace every sample secret, configure TLS/domain/SMS/backups, inspect docker compose config, then start on DEVELOPMENT only.'
