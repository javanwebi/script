# Automatic production deployment from GitHub Actions

## Behavior

- Only a successful `push` CI run for `main` can trigger automatic production deployment.
- Pull-request runs, feature branches, workflow-dispatch CI runs, and failed CI runs do not auto-deploy.
- The deploy workflow uses the exact `head_sha` from the successful CI run.
- The VPS fetches current `origin/main` and refuses a stale SHA. An older completed CI run can never roll the site back.
- The existing canonical `sudo sanatpish-deploy-main` release path remains responsible for the isolated build, canary, database checks, promotion, HTTPS health checks, and rollback.
- Deployments are serialized. A newer main commit must pass CI before it can be promoted.
- The workflow does not contain database credentials, VPS passwords, or private SSH keys.

## One-time setup

Do these steps after the infrastructure PR has been merged to `main`.

### 1. Create a dedicated Ed25519 key pair on the administrator workstation

On Windows PowerShell:

```powershell
ssh-keygen -t ed25519 -C "github-actions-sanatpish" -f "$env:USERPROFILE\.ssh\sanatpish_github_actions"
```

For a non-interactive GitHub Actions key, press Enter twice when asked for a passphrase. Protect the private key as a GitHub Environment secret. Never commit it or paste it into the repository.

Display the public key:

```powershell
Get-Content "$env:USERPROFILE\.ssh\sanatpish_github_actions.pub"
```

Copy only the public key to the VPS (for example with `scp`). The private key stays on the administrator workstation until it is entered into GitHub Environment secrets.

### 2. Install the restricted deployment identity on the VPS

After the PR is merged, connect to the VPS as an administrator and run:

```bash
sudo bash /opt/sanatpish/ops/install-github-actions-deploy-user-vps.sh /root/sanatpish_github_actions.pub
```

The installer:
- fetches the exact deployment entrypoint from `origin/main`;
- creates the dedicated `sanatpish-deploy` account;
- installs an SSH forced-command key that accepts only `deploy <40-character-main-sha>`;
- grants passwordless sudo for only `/usr/local/sbin/sanatpish-deploy-main` with no arguments;
- keeps the expected SHA through sudo so the VPS can reject stale releases;
- does not add the deploy user to the Docker group;
- does not install database credentials or a private key on the VPS.

Remove the copied public-key file after successful setup:

```bash
sudo rm -f /root/sanatpish_github_actions.pub
```

### 3. Verify and pin the VPS SSH host key

On the VPS, obtain the Ed25519 host-key fingerprint:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

On the administrator workstation, collect the public host-key line:

```powershell
ssh-keyscan -t ed25519 sanatpish.com
```

Compare the fingerprint of the returned key with the fingerprint obtained directly on the VPS. Do not trust an unverified `ssh-keyscan` result. After it matches, store the complete `ssh-keyscan` line in the GitHub Environment secret below. If SSH uses a nonstandard port, collect and store the corresponding `[host]:port` entry instead.

### 4. Configure GitHub Environment

In the repository:
`Settings → Environments → New environment → production`

Add these Environment secrets:

| Secret | Value |
|---|---|
| `SANATPISH_DEPLOY_HOST` | `sanatpish.com` (or the verified VPS SSH host) |
| `SANATPISH_DEPLOY_USER` | `sanatpish-deploy` |
| `SANATPISH_DEPLOY_PRIVATE_KEY` | Full contents of `sanatpish_github_actions` (private key) |
| `SANATPISH_DEPLOY_KNOWN_HOSTS` | Verified complete Ed25519 known_hosts line |

Add this repository Actions variable:

| Variable | Value |
|---|---|
| `SANATPISH_DEPLOY_ENABLED` | `true` |

Restrict the `production` Environment to the `main` branch. Do not add these values to repository files, workflow YAML, build-time Vite variables, or application `.env` files.

### 5. First controlled deployment

After the VPS account and GitHub secrets are configured:
1. Open Actions → `Deploy Sanat Pish production after successful main CI`.
2. Run `workflow_dispatch` on branch `main`.
3. Supply the exact current 40-character `main` SHA.
4. The VPS checks that this SHA is still the current `origin/main` head before deploying.
5. Confirm the run ends successfully and reports `SANATPISH_MAIN_DEPLOY_COMMAND_OK` and final HTTPS health.

After this first controlled run, each later push to `main` automatically runs the existing CI workflow. Only when that CI run succeeds does the production deploy workflow start.

## Important branch rule for Google AI Studio

The production deployment source of truth is `main`.

- If AI Studio pushes directly to `main`, successful CI is followed by automatic production deployment.
- If AI Studio pushes to a feature branch, that push does not deploy production. Merge the feature branch into `main` after its checks pass.
- Never configure production deployment for every arbitrary branch.

## Operational safeguards

- No production deployment occurs when CI fails.
- A stale successful run cannot deploy an older commit after `main` has advanced.
- SSH host verification is strict; the workflow never runs `ssh-keyscan` dynamically.
- The SSH key is forced to a narrow deployment command and cannot obtain a shell, PTY, port forwarding, Docker group access, or arbitrary sudo.
- The existing deployment script remains the single deployment authority and keeps its canary/rollback behavior.
- The deployment script currently performs its existing additive catalog/schema checks against the live database as part of the release. Review future changes to that script carefully; this workflow does not create a separate unrestricted SQL channel.
