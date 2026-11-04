import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const legacy=readFileSync('src/admin/modules/SettingsSystemModule.tsx','utf8');
const page=readFileSync('src/admin/modules/SecurityCenterModule.tsx','utf8');
const service=readFileSync('src/services/adminService.ts','utf8');
const api=readFileSync('server/db/adminSecurityApi.ts','utf8');
const exportApi=readFileSync('server/db/adminFullDataExport.ts','utf8');

test('one employee creation workspace only; security center links to it',()=>{
 assert.match(legacy,/export \{SecurityCenterModule as SettingsSystemModule\}/);
 assert.doesNotMatch(page,/AdminStaffUsersModule|<AdminStaffUsersModule/);
 assert.match(page,/to="\/admin\/staff-users"/);
 assert.match(page,/tab==='access'/);
});
test('security center covers nine responsive real API sections',()=>{
 for(const section of ['overview','access','payments','messaging','shipping','website','integrations','activity','backups']){
  assert.match(page,new RegExp("id:'"+section+"'"));
 }
 assert.match(page,/lg:grid-cols/);
 assert.match(page,/securityApi<SecurityOverview>/);
 assert.match(page,/api\/admin\/security\/settings/);
});
test('reset-all and misleading browser-only full backup are not exported',()=>{
 assert.doesNotMatch(service,/resetToInitial\s*\(/);
 assert.doesNotMatch(service,/exportBackupJson\s*\(/);
 assert.doesNotMatch(page,/resetToInitial|exportBackupJson|بازنشانی داده‌های اولیه/);
});
test('owner authentication, serial version checks and server-side audit on sensitive settings',()=>{
 assert.match(api,/getPortalIdentity\(req\)/);
 assert.match(api,/!who\.admin/);
 assert.match(api,/req\.headers\.origin/);
 assert.match(api,/expectedUpdatedAt/);
 assert.match(api,/securityAudit\(a/);
 assert.match(api,/public\.system_settings/);
});
test('full-table data download requires fresh owner password and is not a restore backup',()=>{
 assert.match(exportApi,/signInWithPassword\(credentials\)/);
 assert.match(exportApi,/timingSafeEqual/);
 assert.match(exportApi,/one-use|One-use/i);
 assert.match(exportApi,/row_to_json\(t\)/);
 assert.match(exportApi,/read only/);
 assert.match(exportApi,/physical Supabase Storage objects/);
});
