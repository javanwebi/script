# One canonical release: main → isolated build → blue/green → HTTPS

**Never deploy a feature branch directly to production.** Production source of truth is `origin/main` in `javanwebi/script`. Both ChatGPT projects and all other contributors must branch from the latest main, push their changes, and merge reviewed pull requests into main. Do not reset main or replace the running site with a standalone branch copy.

## Single repeatable VPS command

```bash
sudo bash -euo pipefail -c '
  cd /opt/sanatpish
  git fetch origin main
  SHA="$(git rev-parse FETCH_HEAD)"
  git show "$SHA:ops/deploy-main-bluegreen-vps.sh" >/tmp/sanatpish-main-bluegreen.sh
  bash -n /tmp/sanatpish-main-bluegreen.sh
  SANATPISH_RELEASE_SHA="$SHA" bash /tmp/sanatpish-main-bluegreen.sh
'
```

The command does not checkout, clean, reset, or modify tracked files under `/opt/sanatpish`. It archives exactly the fetched commit into an isolated stage, builds and tests, launches a new canary, checks catalog parity, then switches Nginx with rollback. The previous production container is preserved for immediate rollback.

### Working in multiple chats

1. Each contributor starts from a fresh `main`, creates a unique feature branch, and opens a pull request.
2. If main changed, update the feature branch by merging current main, resolve overlapping file changes, and rerun CI.
3. Only merge a PR when required checks pass; one release must contain both this PR and all earlier main commits.
4. Run the single VPS command above after the merge. Never redeploy the old home-image or camera-specific branch SHA.

**Deploy success** requires `SANATPISH_MAIN_BLUEGREEN_DEPLOY_OK`. Vite large chunk warnings do not imply failure. On error, the script keeps the old public container and restores Nginx.

Note: The application needs TLS trusted by the browser to use camera hardware. The hosted database and its credentials must be preserved unchanged.
