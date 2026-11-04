import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const root=new URL('../',import.meta.url);
const source=readFileSync(new URL('../ops/forza-live-voice-audit-readonly.sh',import.meta.url),'utf8');
const deploy=readFileSync(new URL('../ops/deploy-single-port-vps.sh',import.meta.url),'utf8');
const backend=readFileSync(new URL('../server.ts',import.meta.url),'utf8');

test('read-only audit never mutates service, code, secrets or customer logs',()=>{
  execFileSync('bash',['-n',new URL('../ops/forza-live-voice-audit-readonly.sh',import.meta.url).pathname]);
  assert.match(source,/git ls-remote origin refs\/heads\/main/);
  assert.match(source,/docker stats --no-stream/);
  assert.match(source,/https:\/\/www\.sanatpish\.com\/api\/health/);
  for(const forbidden of [/docker stop/,/docker rm/,/docker restart/,/git reset/,/git checkout/,/DROP TABLE/i,/\.env\.sms\b/,/\.env\.staff\b/,/FORZA_VOICE_TOKEN\b/]){
    assert.doesNotMatch(source,forbidden);
  }
});

test('pinned canary and live containers expose SHA independently of host Git checkout',()=>{
  assert.equal((deploy.match(/-e "SANATPISH_RELEASE_SHA=\$EXPECTED"/g)||[]).length,2);
  assert.match(backend,/revision:\/\^\[a-f0-9\]\{40\}\$\//);
});
