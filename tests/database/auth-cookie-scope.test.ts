import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAuthCookieHeaders,buildRefreshCookieMigrationHeaders} from '../../server/db/supabaseAuth';

test('Supabase refresh cookie is scoped to API routes and expires the legacy portal-only cookie',()=>{
 const cookies=buildAuthCookieHeaders({
  access_token:'test-access-token',
  refresh_token:'test-refresh-token',
  expires_in:3600,
 },true);

 assert.equal(cookies.length,3);
 assert.match(cookies[0],/^sp_access=test-access-token; Path=\/; HttpOnly; SameSite=Lax; Max-Age=3600; Secure$/);
 assert.match(cookies[1],/^sp_refresh=test-refresh-token; Path=\/api; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure$/);
 assert.match(cookies[2],/^sp_refresh=; Path=\/api\/portal; HttpOnly; SameSite=Lax; Max-Age=0; Secure$/);
});

test('legacy sessions migrate their refresh token to the shared API path',()=>{
 const [current,legacy]=buildRefreshCookieMigrationHeaders('legacy-refresh-token',true);

 assert.match(current,/^sp_refresh=legacy-refresh-token; Path=\/api;.*Max-Age=2592000; Secure$/);
 assert.match(legacy,/^sp_refresh=; Path=\/api\\/portal;.*Max-Age=0; Secure$/);
});

test('logout expires both current and legacy refresh-cookie paths',()=>{
 const cookies=buildAuthCookieHeaders(null,false);

 assert.equal(cookies.length,3);
 assert.match(cookies[0],/^sp_access=; Path=\/; HttpOnly; SameSite=Lax; Max-Age=0$/);
 assert.match(cookies[1],/^sp_refresh=; Path=\/api; HttpOnly; SameSite=Lax; Max-Age=0$/);
 assert.match(cookies[2],/^sp_refresh=; Path=\/api\/portal; HttpOnly; SameSite=Lax; Max-Age=0$/);
});

test('refresh cookie path covers portal and admin API endpoints but not public pages',()=>{
 const pathMatches=(cookiePath:string,requestPath:string)=>requestPath===cookiePath||requestPath.startsWith(cookiePath.endsWith('/')?cookiePath:cookiePath+'/');
 const refresh=cookiesPath(buildAuthCookieHeaders({access_token:'a',refresh_token:'r',expires_in:60},false)[1]);

 assert.equal(pathMatches(refresh,'/api/portal'),true);
 assert.equal(pathMatches(refresh,'/api/admin/reports'),true);
 assert.equal(pathMatches(refresh,'/api/admin/staff'),true);
 assert.equal(pathMatches(refresh,'/catalog'),false);
});

function cookiesPath(value:string){
 const match=value.match(/(?:^|; )Path=([^;]+)/);
 assert.ok(match,'Set-Cookie header must define an explicit Path');
 return match[1];
}
