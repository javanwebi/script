import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAdminCatalogProducts,
  inspectAdminCatalogCache,
  primeAdminCatalogCache,
} from '../server/db/adminCatalogCache';

test('admin runtime reuses the startup catalog snapshot without loading per-SKU reports',async()=>{
  const input=[{code:'FAM-1',name:'Bearing',variants:[{
    code:'6202ZZ',price:1200,prices:{retail:1200},stock:8,stockKnown:true,
    technicalSpecs:[{key:'قطر',value:'15mm'}],
    technicalReview:{references:[{title:'large report',url:'https://example.test'}]}
  }]}];
  primeAdminCatalogCache(input);
  const first=await getAdminCatalogProducts() as any[];
  const second=await getAdminCatalogProducts() as any[];
  assert.equal(first,second,'admin reads must reuse the same in-memory snapshot');
  assert.equal(first[0].variants[0].price,1200);
  assert.deepEqual(first[0].variants[0].prices,{retail:1200});
  assert.equal(first[0].variants[0].stock,8);
  assert.deepEqual(first[0].variants[0].technicalSpecs,[{key:'قطر',value:'15mm'}]);
  assert.equal('technicalReview' in first[0].variants[0],false);
  assert.deepEqual(inspectAdminCatalogCache()?.familyCount,1);
  assert.equal(inspectAdminCatalogCache()?.stale,false);
});
