import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {agencyService} from '../src/services/agencyService';
import {
  databaseStorageEnabled,
  isDatabaseCatalogHydrated,
  refreshDurableStorage,
} from '../src/services/durableStorage';

test('agency and SMS list reads are safe and read-only before runtime hydration',()=>{
  assert.equal(databaseStorageEnabled(),false);
  assert.deepEqual(agencyService.getApplications(),[]);
  assert.deepEqual(agencyService.getSmsLogs(),[]);
  const source=readFileSync('src/services/agencyService.ts','utf8');
  const applications=source.split('getApplications(): AgencyApplication[] {')[1]?.split('saveApplications')[0] || '';
  const sms=source.split('getSmsLogs(): SmsLog[] {')[1]?.split('addSmsLog')[0] || '';
  assert.match(applications,/getExistingItem/);
  assert.doesNotMatch(applications,/setItem\(/);
  assert.match(sms,/getExistingItem/);
  assert.doesNotMatch(sms,/setItem\(/);
});

test('runtime bootstrap is single-flight and a lean request can be upgraded to full catalogue',async()=>{
  const requests:string[]=[];
  Object.defineProperty(globalThis,'window',{value:new EventTarget(),configurable:true});
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(input:RequestInfo|URL)=>{
    const url=String(input);
    requests.push(url);
    await new Promise(resolve=>setTimeout(resolve,15));
    const includeProducts=!url.includes('includeProducts=0');
    return new Response(JSON.stringify({
      success:true,database:true,userId:null,values:{},versions:{},
      productsIncluded:includeProducts,products:[],
    }),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try {
    const [first,second]=await Promise.all([
      refreshDurableStorage({includeProducts:false}),
      refreshDurableStorage({includeProducts:false}),
    ]);
    assert.equal(first.database,true);
    assert.equal(second.database,true);
    assert.deepEqual(requests,['/api/runtime?includeProducts=0']);
    assert.equal(isDatabaseCatalogHydrated(),false);

    await refreshDurableStorage({includeProducts:true});
    assert.deepEqual(requests,[
      '/api/runtime?includeProducts=0',
      '/api/runtime',
    ]);
    assert.equal(isDatabaseCatalogHydrated(),true);
  } finally {
    globalThis.fetch=originalFetch;
  }
});

test('admin portal hydration overlaps portal and runtime requests and skips catalog on admin routes',()=>{
  const source=readFileSync('src/services/portalRepository.ts','utf8');
  assert.match(source,/Promise\.all\(\[/);
  assert.match(source,/portalRequest\(\),\s*runtimeHydration/);
  assert.match(source,/isAdminRoute \|\| databaseStorageEnabled\(\)/);
  assert.match(source,/runtimeState\?\.database!==true/);
  assert.ok(source.includes('const isAdminRoute=/^'));
  assert.ok(source.includes('const includeProducts=!isAdminRoute;'));
  assert.ok(source.includes('admin(?:'));
});

test('admin runtime endpoint does not read products when includeProducts=0',()=>{
  const source=readFileSync('server/db/runtimeApi.ts','utf8');
  assert.match(source,/includeProducts=String\(req\.query\.includeProducts/);
  assert.match(source,/if\(includeProducts\)\{/);
  assert.match(source,/productsIncluded:includeProducts/);
});

test('admin layout reports bootstrap failures and loads catalogue only on catalogue tabs',()=>{
  const source=readFileSync('src/admin/AdminLayout.tsx','utf8');
  assert.match(source,/bootstrapError/);
  assert.match(source,/تلاش مجدد/);
  assert.match(source,/activeTab !== 'products' && activeTab !== 'bulk_import'/);
  assert.match(source,/refreshDurableStorage\(\{ includeProducts: true \}\)/);
});
