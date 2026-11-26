import test from 'node:test';
import assert from 'node:assert/strict';
import type {Product} from '../src/types';
import {buildPopdVisionCorpus} from '../src/services/catalogImageCorpus';
import {selectCachedLocalQuery} from '../src/services/localVisionDetectionCache';
import {localVisionResult} from '../src/services/localVision';

const revisions=new Map(Array.from({length:869},(_,i)=>['e('+(i+1)+').png','sha-'+(i+1)]));
const products=Array.from({length:869},(_,i)=>({
 code:'family-'+i,name:'Family '+i,active:true,images:['/storage/products/catalog/e(847).png'],
 variants:[{code:i===846?'41506':'sku-'+i,name:'SKU '+i,active:true,images:['/storage/products/catalog/e('+(i+1)+').png']}]
})) as unknown as Product[];

test('all exact POPD SKU photos have one active owner, including 41506; legacy family photos cannot steal a binding',()=>{
 const rows=buildPopdVisionCorpus(products,revisions);
 assert.equal(rows.length,869);
 const row=rows.find(r=>r.id==='e(847).png')!;
 assert.deepEqual(row.bindings,[{familyCode:'family-846',code:'41506',verified:true}]);
 assert.equal(row.revision,'sha-847');
 assert.throws(()=>buildPopdVisionCorpus(products.slice(0,-1),revisions),/869/);
 const changed=new Map(revisions);changed.set(row.id,'changed-file-content');
 assert.equal(buildPopdVisionCorpus(products,changed).find(r=>r.id===row.id)?.revision,'changed-file-content');
});

test('selected cached crop does not retain unrelated vectors or OCR',()=>{
 const a={x:0.1,y:0.2,width:0.3,height:0.4},b={x:0.5,y:0.2,width:0.3,height:0.4};
 const query={vectors:[[1,0],[0,1],[-1,0]],viewRegions:[null,a,b],markings:[{text:'41506',confidence:99}],ocrAvailable:true};
 const crop=selectCachedLocalQuery(query,b)!;
 assert.deepEqual(crop.vectors,[[-1,0]]);
 assert.deepEqual(crop.markings,[]);
 assert.deepEqual(selectCachedLocalQuery(query,undefined,true)?.vectors,[[1,0]]);
 assert.equal(selectCachedLocalQuery(query,{...a,x:0.15}),undefined);
});

test('a weaker real SKU remains a separately labelled suggestion even if a different SKU is above threshold',()=>{
 const rows=buildPopdVisionCorpus(products,revisions);
 const wheel=rows.find(r=>r.id==='e(847).png')!;
 const result=localVisionResult([{row:rows[0],score:0.8},{row:wheel,score:0.62}],products,{total:869,indexed:869,ready:true},'',0.65,undefined,true);
 assert.equal(result.nearestCatalogSuggestions?.[0]?.code,'41506');
 assert.equal(result.nearestCatalogSuggestions?.[0]?.matchBasis,'explore');
 assert.equal(result.nearestCatalogSuggestions?.[0]?.visualScore,undefined);
 assert.equal(result.similarCandidates?.some(x=>x.code==='41506'),false);
 assert.equal(result.summary.exactVisualMatch,false);
});
