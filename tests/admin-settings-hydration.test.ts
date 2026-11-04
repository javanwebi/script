import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync('src/admin/modules/SettingsSystemModule.tsx','utf8');
const adopted=readFileSync('server/db/adopted.ts','utf8');

test('staff accounts use an independent live workspace; missing system settings cannot block it',()=>{
 assert.match(source,/activeTab === 'roles' && <AdminStaffUsersModule\s*\/>/);
 assert.match(source,/activeTab === 'gateways_sms' && settingsError &&/);
 assert.doesNotMatch(source,/\{settingsError && \(/);
});

test('settings tab responds to database rehydration and blocks unsafe writes when settings are unavailable',()=>{
 assert.match(source,/addEventListener\('sanat-durable-hydrated'/);
 assert.match(source,/removeEventListener\('sanat-durable-hydrated'/);
 assert.match(source,/activeTab === 'gateways_sms'\) refreshData\(\)/);
 assert.match(source,/<fieldset disabled=\{Boolean\(settingsError\)\}/);
 assert.match(source,/if \(settingsError\) \{ alert\(settingsError\); return; \}/);
});

test('adopted database reads actual system settings projection, never fake credentials',()=>{
 assert.match(adopted,/key==='atlas_admin_settings_v1'/);
 assert.match(adopted,/select \* from public\.system_settings order by id limit 1/);
});
