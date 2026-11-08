import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {agencyService} from '../src/services/agencyService';
import {
  databaseStorageEnabled,
  durableStorage,
  flushDurableChanges,
  isDatabaseCatalogHydrated,
  refreshDurableStorage,
} from '../src/services/durableStorage';
import {compactCatalogReviews} from '../src/utils/catalogPrivacy';

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

    // A later lean admin refresh contains products:[] by design. It must not
    // discard the full catalogue that was already installed in this session.
    await refreshDurableStorage({includeProducts:false});
    assert.deepEqual(requests,[
      '/api/runtime?includeProducts=0',
      '/api/runtime',
      '/api/runtime?includeProducts=0',
    ]);
    assert.equal(isDatabaseCatalogHydrated(),true);
  } finally {
    globalThis.fetch=originalFetch;
  }
});

test('lean runtime hydration never installs an empty catalogue into the browser index',()=>{
  const source=readFileSync('src/main.tsx','utf8');
  assert.match(source,/data\.productsIncluded===true && Array\.isArray\(data\.products\)/);
  assert.doesNotMatch(source,/if\(Array\.isArray\(data\.products\)\)installDatabaseProducts/);
});

test('failed durable writes do not poison later writes or overwrite dirty values during catalog hydration',async()=>{
  const originalFetch=globalThis.fetch;
  const key='catalog_queue_regression_v1';
  let writes=0;
  let savedValue:unknown={source:'database'};
  globalThis.fetch=async(_input:RequestInfo|URL,init?:RequestInit)=>{
    if(init?.method==='POST'){
      writes++;
      assert.ok(init.signal instanceof AbortSignal,'durable writes must have an abort timeout');
      const body=JSON.parse(String(init.body));
      if(writes===1)
        return new Response(JSON.stringify({success:false,message:'temporary failure'}),{status:503});
      savedValue=body.value;
      return new Response(JSON.stringify({success:true,version:writes}),{status:200});
    }
    return new Response(JSON.stringify({
      success:true,database:true,userId:null,
      values:{[key]:savedValue},
      versions:{[key]:writes},
      productsIncluded:true,products:[{code:'F-1',variants:[]}],
    }),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try {
    durableStorage.setItem(key,JSON.stringify({source:'local-first'}));
    await assert.rejects(flushDurableChanges(),/temporary failure/);

    // A server read after a failed write must not erase the optimistic value.
    await refreshDurableStorage({includeProducts:true});
    assert.equal(durableStorage.getItem(key),JSON.stringify({source:'local-first'}));

    // Retrying the unchanged value must recover the queue rather than no-op.
    durableStorage.setItem(key,JSON.stringify({source:'local-first'}));
    await flushDurableChanges();
    assert.equal(writes,2);

    durableStorage.setItem(key,JSON.stringify({source:'local-second'}));
    await flushDurableChanges();
    assert.equal(writes,3);

    await refreshDurableStorage({includeProducts:true});
    assert.equal(durableStorage.getItem(key),JSON.stringify({source:'local-second'}));
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


test('admin catalogue bootstrap keeps prices and stock but defers per-SKU technical reports',()=>{
  const input=[{code:'FAM-1',name:'Bearing',variants:[{
    code:'6202ZZ',price:1200,prices:{retail:1200},stock:8,stockKnown:true,
    technicalSpecs:[{key:'قطر',value:'15mm'}],
    technicalReview:{references:[{title:'large report',url:'https://example.test'}],evidence:[{key:'قطر'}]}
  }]}];
  const compact=compactCatalogReviews(input);
  assert.equal(compact[0].variants[0].price,1200);
  assert.deepEqual(compact[0].variants[0].prices,{retail:1200});
  assert.equal(compact[0].variants[0].stock,8);
  assert.deepEqual(compact[0].variants[0].technicalSpecs,[{key:'قطر',value:'15mm'}]);
  assert.equal('technicalReview' in compact[0].variants[0],false);
});

test('admin runtime defers technical reports and product editor fetches selected SKU report on demand',()=>{
  const runtime=readFileSync('server/db/runtimeApi.ts','utf8');
  const adopted=readFileSync('server/db/adopted.ts','utf8');
  const products=readFileSync('src/admin/modules/ProductsModule.tsx','utf8');
  assert.match(runtime,/products:includeProducts\?compactCatalogReviews\(visibleProducts\):\[\]/);
  assert.match(runtime,/readProducts\(\{includeTechnicalReviews:false\}\)/);
  assert.match(runtime,/select v\.code,v\.technical_review/);
  assert.match(adopted,/options:\{includeTechnicalReviews\?\:boolean\}/);
  assert.match(adopted,/to_jsonb\(v\)->'runtime_payload'\)-'technicalReview'/);
  assert.match(products,/\/api\/catalog\/variant-review\//);
  assert.match(products,/currentEditingVariant\?\.technicalReview/);
});

test('runtime hydration has a finite timeout for full and lean catalog requests',()=>{
  const source=readFileSync('src/services/durableStorage.ts','utf8');
  assert.match(source,/timeoutMs=includeProducts\?30000:12000/);
  assert.match(source,/AbortSignal\.timeout\(timeoutMs\)/);
  assert.match(source,/AbortSignal\.timeout\(15000\)/);
  assert.match(source,/previous\.catch\(\(\)=>undefined\)/);
  assert.match(source,/dirtyWrites/);
  const refresh=source.split('export function refreshDurableStorage')[1]?.split('export const durableStorage')[0] || '';
  assert.doesNotMatch(refresh,/await flushDurableChanges/,'catalog reads must not wait for write queues');
});

test('admin catalogue endpoint reuses startup data and invalidates snapshots after writes',()=>{
  const runtime=readFileSync('server/db/runtimeApi.ts','utf8');
  const cache=readFileSync('server/db/adminCatalogCache.ts','utf8');
  const server=readFileSync('server.ts','utf8');
  const checkout=readFileSync('server/db/checkout.ts','utf8');
  const images=readFileSync('server/productImageStorage.ts','utf8');
  assert.match(runtime,/await getAdminCatalogProducts\(\)/);
  assert.match(runtime,/primeAdminCatalogCache\(products\)/);
  assert.match(runtime,/invalidateAdminCatalogCache\(\)/);
  assert.match(cache,/REVALIDATE_AFTER_MS=30_000/);
  assert.match(cache,/readProducts\(\{includeTechnicalReviews:false\}\)/);
  assert.match(server,/invalidatePublicCatalogCache\(\)/);
  assert.match(checkout,/invalidateAdminCatalogCache\(\)/);
  assert.match(images,/invalidatePublicCatalogCache/);
});
