#!/usr/bin/env bash
# One-time VPS setup for GitHub Actions production deployment.
# Run as root AFTER this commit has been merged to origin/main:
#   sudo bash /opt/sanatpish/ops/install-github-actions-deploy-user-vps.sh /root/sanatpish_github_actions.pub
set -Eeuo pipefail
umask 077

readonly REPO="/opt/sanatpish"
readonly DEPLOY_USER="sanatpish-deploy"
readonly SUDOERS_FILE="/etc/sudoers.d/sanatpish-github-deploy"
readonly PUBKEY_FILE="${1:-}"

if [[ "$EUID" -ne 0 ]]; then
  echo "RUN_AS_ROOT_REQUIRED" >&2
  exit 1
fi
if [[ -z "$PUBKEY_FILE" || ! -f "$PUBKEY_FILE" ]]; then
  echo "USAGE: $0 /path/to/github-actions-ed25519.pub" >&2
  exit 2
fi
if [[ ! -d "$REPO/.git" ]]; then
  echo "CANONICAL_REPOSITORY_NOT_FOUND path=$REPO" >&2
  exit 1
fi

REMOTE_URL="$(git -C "$REPO" remote get-url origin)"
case "$REMOTE_URL" in
  https://github.com/javanwebi/script.git|git@github.com:javanwebi/script.git) ;;
  *)
    echo "UNEXPECTED_ORIGIN_URL=$REMOTE_URL" >&2
    exit 1
    ;;
esac

mapfile -t KEY_LINES < <(tr -d '\r' < "$PUBKEY_FILE")
if [[ "${#KEY_LINES[@]}" -ne 1 ]]; then
  echo "PUBLIC_KEY_FILE_MUST_CONTAIN_EXACTLY_ONE_LINE" >&2
  exit 1
fi
read -r KEY_TYPE KEY_DATA _ <<< "${KEY_LINES[0]}"
if [[ "$KEY_TYPE" != "ssh-ed25519" || ! "$KEY_DATA" =~ ^[A-Za-z0-9+/]+={0,3}$ ]]; then
  echo "ED25519_PUBLIC_KEY_REQUIRED" >&2
  exit 1
fi
ssh-keygen -lf "$PUBKEY_FILE" >/dev/null

echo "===== FETCH VERIFIED MAIN DEPLOY ENTRYPOINTS ====="
git -C "$REPO" fetch --quiet origin main
MAIN_SHA="$(git -C "$REPO" rev-parse FETCH_HEAD)"
WRAPPER_TMP="$(mktemp /tmp/sanatpish-deploy-wrapper.XXXXXXXX)"
GATE_TMP="$(mktemp /tmp/sanatpish-deploy-gate.XXXXXXXX)"
SUDOERS_TMP="$(mktemp /tmp/sanatpish-deploy-sudoers.XXXXXXXX)"
cleanup() {
  rm -f -- "$WRAPPER_TMP" "$GATE_TMP" "$SUDOERS_TMP"
}
trap cleanup EXIT

git -C "$REPO" show "$MAIN_SHA:ops/sanatpish-deploy-main.sh" > "$WRAPPER_TMP"
git -C "$REPO" show "$MAIN_SHA:ops/sanatpish-github-deploy-gate.sh" > "$GATE_TMP"
bash -n "$WRAPPER_TMP"
bash -n "$GATE_TMP"
install -o root -g root -m 0755 "$WRAPPER_TMP" /usr/local/sbin/sanatpish-deploy-main
install -o root -g root -m 0755 "$GATE_TMP" /usr/local/sbin/sanatpish-github-deploy-gate

echo "===== CREATE RESTRICTED DEPLOY USER ====="
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --home-dir "/home/$DEPLOY_USER" --user-group --shell /bin/bash "$DEPLOY_USER"
fi
# Keep the account valid for public-key SSH authentication while making password
# authentication infeasible: set a random password that is never stored or printed.
RANDOM_PASSWORD="$(openssl rand -base64 48)"
printf '%s:%s\n' "$DEPLOY_USER" "$RANDOM_PASSWORD" | chpasswd
unset RANDOM_PASSWORD

# This account must never inherit broad sudo or Docker access from a prior setup.
for group in sudo docker; do
  if getent group "$group" >/dev/null && id -nG "$DEPLOY_USER" | tr ' ' '\n' | grep -qx "$group"; then
    gpasswd -d "$DEPLOY_USER" "$group"
  fi
done

DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
test -n "$DEPLOY_HOME"
SSH_DIR="$DEPLOY_HOME/.ssh"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0700 "$SSH_DIR"
AUTHORIZED_KEYS="$SSH_DIR/authorized_keys"
printf 'command="/usr/local/sbin/sanatpish-github-deploy-gate",restrict,no-user-rc %s %s github-actions-sanatpish\n' "$KEY_TYPE" "$KEY_DATA" > "$AUTHORIZED_KEYS"
chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTHORIZED_KEYS"
chmod 0600 "$AUTHORIZED_KEYS"

echo "===== INSTALL EXACT SUDO ALLOWLIST ====="
cat > "$SUDOERS_TMP" <<EOF
Defaults:$DEPLOY_USER env_keep += "SANATPISH_EXPECTED_MAIN_SHA"
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/local/sbin/sanatpish-deploy-main ""
EOF
chmod 0440 "$SUDOERS_TMP"
visudo -cf "$SUDOERS_TMP"
install -o root -g root -m 0440 "$SUDOERS_TMP" "$SUDOERS_FILE"
visudo -cf /etc/sudoers
sudo -l -U "$DEPLOY_USER"

if id -nG "$DEPLOY_USER" | tr ' ' '\n' | grep -qx docker; then
  echo "DEPLOY_USER_MUST_NOT_BE_IN_DOCKER_GROUP" >&2
  exit 1
fi

echo "GITHUB_ACTIONS_DEPLOY_USER_READY user=$DEPLOY_USER main_sha=$MAIN_SHA"
echo "SSH_KEY_RESTRICTIONS=forced-command,restrict,no-user-rc,no-pty,no-forwarding"
echo "SUDO_ALLOWLIST=/usr/local/sbin/sanatpish-deploy-main (no arguments)"
echo "NO_DATABASE_CREDENTIALS_OR_PRIVATE_KEY_INSTALLED_ON_SERVER"
echo "Remove the uploaded public-key file after setup."
