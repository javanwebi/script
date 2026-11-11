# One canonical release: main → isolated build → single fixed app port → HTTPS

## Single published website port (2026-11-04)

The production site now uses **one permanent host loopback application port: 127.0.0.1:3013**. The HTTPS public entry point remains Nginx on TCP 443. All three storefront virtual hosts (IP/default, IP HTTPS, and `sanatpish.com` / `www.sanatpish.com`) proxy to the same running container at port 3013.

The existing `sudo sanatpish-deploy-main` entrypoint fetches the pinned `main` commit, then dispatches to `ops/deploy-single-port-vps.sh`. It does **not** rotate through 3006–3020 anymore. Releases are built in an isolated Git archive, and preflight is performed in a **private Docker-network canary with no published host port**. It compares the actual PostgreSQL product/SKU projection with the active site, checks API/voice and real frontend assets, and preserves existing secrets and storage mounts.

After canary checks pass, the active site is stopped and its replacement binds the **same** port 3013. This requires a **brief interruption of website requests** during promotion; strictly one host-published app port and uninterrupted overlap are incompatible without introducing a different proxy/socket architecture.

On a promotion failure, the new container is removed, the original container is restarted on 3008, and the backed-up Nginx virtual hosts are restored. After all checks pass, unused historical site containers are **stopped, never removed**. Databases, Supabase, and the private FORZA voice container are excluded from cleanup. The script refuses to stop an old application whose port remains referenced by an Nginx proxy.

## Customer API writes and read-only storefront fallback

The customer-facing **HTTPS** virtual host must have a dedicated `location ^~ /api/` before the general `location /` SPA fallback. That API location proxies requests to the active Node/Express app and disables request/response buffering for uploads and streaming. It explicitly sets `proxy_intercept_errors off` so upstream Express JSON 401/403 responses are not replaced by Nginx HTML error pages, forwards the Express header, and overrides inherited Nginx access/basic/subrequest-auth gates for this API location only. Authentication, authorization, validation and allowed methods remain enforced by the Express endpoints. The general SPA fallback remains GET-only. The API proxy is transport-only: it does not grant a customer session or role, and Express session/role checks remain authoritative for protected operations. The plain-HTTP domain vhost redirects `/api/` requests to HTTPS with status 308; the IP preview vhost remains read-only. Exact `/api/portal`, `/api/runtime`, and the more-specific `/api/ai/` locations retain their existing precedence.

The canonical single-port deployment installs and verifies the HTTPS proxy and HTTP redirect, then probes CRM-create and SKU-transfer POSTs on both `sanatpish.com` and `www.sanatpish.com`. The anonymous probes must reach Express and be rejected as JSON (401/403), with the Express response header present; an Nginx HTML 403 or a missing Express response header fails promotion and triggers rollback.

For an Nginx-only repair without rebuilding or restarting the website/database, use the rollback-safe script after it is merged to main:

```bash
cd /opt/sanatpish
git fetch origin main
git show FETCH_HEAD:ops/fix-nginx-api-write-routing-vps.sh | sudo bash
```

The script backs up the two customer-facing vhosts, runs `nginx -t`, reloads Nginx, verifies both hostnames and API JSON responses, and restores the backups if verification fails. It deliberately does not change the read-only IP preview, app container, or PostgreSQL data.

**Scope:** This is a single port for the **website app**. Supabase/PostgreSQL and the private Piper voice service still need their own internal/network ports and should not be collapsed into the website port.

**One-time prerequisite:** The initial live IP/default vhosts must already point at the known-good 3013 website container (from the verified 2026-11-04 VPS output). If the live server moves to a different port, the script fails before any traffic change rather than stopping a mystery container.

**Never deploy a feature branch directly to production.** Production source of truth is `origin/main` in `javanwebi/script`. Both ChatGPT projects and all other contributors must branch from the latest main, push their changes, and merge reviewed pull requests into main. Do not reset main or replace the running site with a standalone branch copy.

## Install once, deploy with one command

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

Once the merged commit exists on GitHub main, install the wrapper once with:
```bash
cd /opt/sanatpish
git fetch origin main
sudo sh -c 'git -C /opt/sanatpish show "$(git -C /opt/sanatpish rev-parse FETCH_HEAD)":ops/sanatpish-deploy-main.sh > /usr/local/sbin/sanatpish-deploy-main'
sudo chmod 755 /usr/local/sbin/sanatpish-deploy-main
```

Every later update needs only:
```bash
sudo sanatpish-deploy-main
```

The command first verifies that `/opt/sanatpish` is on the local `main` branch, has no tracked local edits, and can fast-forward to the fetched release. It builds and tests an isolated archive and private no-host-port canary, checks catalog parity, then replaces the single fixed-port app with rollback. **Only after the new production app and voice pass all health checks**, the wrapper fast-forwards the tracked source checkout at `/opt/sanatpish` to that exact deployed commit. This makes the page source visible in the main project folder while preserving untracked owner-managed files and release data. If the source checkout has tracked edits, is not on `main`, or cannot fast-forward, the command stops before deployment rather than overwriting server work. The active container continues to use the isolated release under `/opt/sanatpish/.deploy/releases`; do not edit that generated release directly. The previous production container is stopped and preserved for immediate rollback.

### Working in multiple chats

1. Each contributor starts from a fresh `main`, creates a unique feature branch, and opens a pull request.
2. If main changed, update the feature branch by merging current main, resolve overlapping file changes, and rerun CI.
3. Only merge a PR when required checks pass; one release must contain both this PR and all earlier main commits.
4. Run the single VPS command above after the merge. Never redeploy the old home-image or camera-specific branch SHA.

**Deploy success** requires `SANATPISH_MAIN_BLUEGREEN_DEPLOY_OK`. Vite large chunk warnings do not imply failure. On error, the script keeps the old public container and restores Nginx.

Note: The application needs TLS trusted by the browser to use camera hardware. The hosted database and its credentials must be preserved unchanged.
