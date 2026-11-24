import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (name: string) => fs.readFileSync(path.resolve(process.cwd(), name), "utf8");
const workflow = read(".github/workflows/deploy-production-after-main-ci.yml");
const gate = read("ops/sanatpish-github-deploy-gate.sh");
const installer = read("ops/install-github-actions-deploy-user-vps.sh");
const entrypoint = read("ops/sanatpish-deploy-main.sh");
const ci = read(".github/workflows/unified-main-bluegreen.yml");
const source = read(".github/workflows/verify-source-db.yml");
const vps = read(".github/workflows/verify-vps-build.yml");

test("production deploy waits for successful main push CI and never deploys PR or feature-branch runs", () => {
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /Unified Sanat Pish main integration/);
  assert.match(workflow, /Verify source UI and database runtime/);
  assert.match(workflow, /Verify VPS frontend build before deployment/);
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /ALL_REQUIRED_MAIN_CHECKS_PASSED/);
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /conclusion == 'success'/);
  assert.match(workflow, /event == 'push'/);
  assert.match(workflow, /head_branch == 'main'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /vars\.SANATPISH_DEPLOY_ENABLED == 'true'/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /StrictHostKeyChecking=yes/);
  assert.match(workflow, /SANATPISH_DEPLOY_KNOWN_HOSTS/);
  assert.doesNotMatch(workflow, /ssh-keyscan/);
  assert.doesNotMatch(workflow, /actions\/checkout/);
});

test("deployment is pinned to the exact tested SHA and stale workflow runs cannot roll production backward", () => {
  assert.match(entrypoint, /SANATPISH_EXPECTED_MAIN_SHA/);
  assert.match(entrypoint, /DEPLOY_REF_NOT_CURRENT_MAIN/);
  assert.match(entrypoint, /git fetch origin main/);
  assert.match(entrypoint, /SANATPISH_RELEASE_SHA="\$SHA" bash/);
  assert.ok(entrypoint.indexOf("DEPLOY_REF_NOT_CURRENT_MAIN") < entrypoint.indexOf('SANATPISH_RELEASE_SHA="$SHA" bash "$TEMP"'));
});

test("SSH forced command accepts only one deploy command with a full lowercase SHA", () => {
  assert.match(gate, /SSH_ORIGINAL_COMMAND/);
  assert.match(gate, /deploy\[\[:space:\]\]\(\[a-f0-9\]\{40\}\)/);
  assert.match(gate, /sudo -n \/usr\/local\/sbin\/sanatpish-deploy-main/);
  assert.doesNotMatch(gate, /eval /);
  assert.doesNotMatch(gate, /bash -c/);
});

test("VPS installer creates a dedicated restricted account and an exact no-argument sudo allowlist", () => {
  assert.match(installer, /readonly DEPLOY_USER="sanatpish-deploy"/);
  assert.match(installer, /useradd --create-home/);
  assert.match(installer, /openssl rand -base64 48/);
  assert.match(installer, /printf '%s:%s\\n' "\$DEPLOY_USER" "\$RANDOM_PASSWORD" \| chpasswd/);
  assert.match(installer, /gpasswd -d "\$DEPLOY_USER" "\$group"/);
  assert.match(installer, /command=.*sanatpish-github-deploy-gate.*restrict/);
  assert.match(installer, /NOPASSWD: \/usr\/local\/sbin\/sanatpish-deploy-main ""/);
  assert.match(installer, /visudo -cf \/etc\/sudoers/);
  assert.match(installer, /env_keep \+= "SANATPISH_EXPECTED_MAIN_SHA"/);
  assert.doesNotMatch(installer, /usermod .*docker/);
  assert.doesNotMatch(installer, /DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY/);
});

test("existing main CI runs deployment-gate shell syntax and regression tests before deploy workflow can start", () => {
  assert.match(ci, /bash -n ops\/sanatpish-github-deploy-gate\.sh/);
  assert.match(ci, /bash -n ops\/install-github-actions-deploy-user-vps\.sh/);
  assert.match(ci, /tests\/github-actions-production-deploy\.test\.ts/);
  assert.match(source, /pull_request:\s*\n\s*branches: \[main\]/);
  assert.match(source, /push:\s*\n\s*branches:\s*\n\s*-\s*main/);
  assert.match(vps, /branches: \[main, feature\/textile-industry-page\]/);
  assert.doesNotMatch(vps, /push:\s*\n\s*branches:[^\n]*\n\s*paths:/);
});
