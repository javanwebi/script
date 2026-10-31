#!/usr/bin/env bash
# Remove failed, disposable INT4 benchmarking artifacts only.
# Never touch selected Pocket production container/image or shared build cache.
set -Eeuo pipefail
umask 077
test "$EUID" -eq 0 || { echo "Run as root" >&2; exit 1; }
for cmd in docker awk; do command -v "$cmd" >/dev/null || exit 1; done
VOICE=forza-voice
SITE=sanatpish-new
VOICE_SHA=31ce0344f5abe28b1bcff4fe49f6d75e7cb7d0e672edec8f22367998e9b24833
for name in "$VOICE" "$SITE"; do
  test "$(docker inspect -f '{{.State.Running}}' "$name")" = true ||
    { echo "FORZA_INT4_CLEAN_ABORT required service not running: $name" >&2; exit 1; }
done
CURRENT=$(docker exec "$VOICE" sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')
test "$CURRENT" = "$VOICE_SHA" ||
  { echo "FORZA_INT4_CLEAN_ABORT selected original voice not verified" >&2; exit 1; }
VOICE_IMAGE=$(docker inspect -f '{{.Image}}' "$VOICE")
SITE_IMAGE=$(docker inspect -f '{{.Image}}' "$SITE")
echo "FORZA_INT4_CLEAN_START verified_voice_sha256=$CURRENT"

# These are exact, temporary container names created by INT4 benchmark.
for name in forza-original-int4-eval forza-original-int4-build; do
  if docker container inspect "$name" >/dev/null 2>&1; then
    test "$(docker inspect -f '{{.State.Running}}' "$name")" = false ||
      { echo "FORZA_INT4_CLEAN_ABORT active candidate $name must be reviewed manually" >&2; exit 1; }
    echo "FORZA_INT4_CLEAN_REMOVE_CONTAINER name=$name"
    docker container rm "$name" >/dev/null
  fi
done

# Only the exact dedicated INT4 benchmark repository is eligible.
# No wildcard docker prune, no touching unrelated dangling layers or cache.
while IFS= read -r tag; do
  case "$tag" in
    sanatpish/forza-original-int4:float-*|sanatpish/forza-original-int4:int4-*) ;;
    *) continue;;
  esac
  candidate_id=$(docker image inspect --format '{{.Id}}' "$tag")
  if [ "$candidate_id" = "$VOICE_IMAGE" ] || [ "$candidate_id" = "$SITE_IMAGE" ]; then
    echo "FORZA_INT4_CLEAN_SKIP production_image=$tag"
    continue
  fi
  used=$(docker ps -aq --filter "ancestor=$tag")
  if [ -n "$used" ]; then
    echo "FORZA_INT4_CLEAN_SKIP referenced_image=$tag containers=$used"
    continue
  fi
  echo "FORZA_INT4_CLEAN_REMOVE_IMAGE tag=$tag"
  docker image rm "$tag" >/dev/null
done < <(docker image ls --format '{{.Repository}}:{{.Tag}}' \
    --filter 'reference=sanatpish/forza-original-int4:*')

# BuildKit layer/pip cache is global. Do NOT prune it automatically because
# it may belong to the running Sanat Pish app and other Docker projects.
echo "FORZA_INT4_CLEAN_BUILD_CACHE shared_buildkit_cache_not_pruned=1"
test "$(docker inspect -f '{{.State.Running}}' "$VOICE")" = true
test "$(docker inspect -f '{{.State.Running}}' "$SITE")" = true
test "$(docker exec "$VOICE" sha256sum /app/public/forza-pocket-reference.wav | awk '{print $1}')" = "$VOICE_SHA"
echo "FORZA_INT4_CLEAN_DONE original_pocket_unchanged=1 site_unchanged=1 int4_not_promoted=1"
