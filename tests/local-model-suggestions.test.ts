import test from 'node:test';
import assert from 'node:assert/strict';
import type {Product} from '../src/types';
import {localModelSuggestions} from '../src/services/localModelSuggestions';
import {localVisionResult} from '../src/services/localVision';
const family=(code:string,count=5)=>({code,name:code+' gear',active:true,brand:'real',images:['e(8).png'],variants:Array.from({length:count},(_,i)=>({code:code+'-'+i,name:'gear '+i,model:'model-'+i,size:String(i+10),active:true,images:[`e(${i+1}).png`],technicalSpecs:[{key:'دندانه',value:String(20+i)}]}))}) as Product;
const hit=(familyCode:string,code:string|undefined,score:number,id=code || familyCode)=>({score,row:{id,url:`/storage/products/catalog/e(${(Number(code?.split('-').at(-1))||0)+1}).png`,label:id,revision:'1',bindings:[{familyCode,code,verified:false}]}});
test('more than two independently photographed models from one family are returned, nearest first',()=>{
 const p=family('gear');const hits=[hit('gear','gear-0',0.8),hit('gear','gear-1',0.94),hit('gear','gear-2',0.88),hit('gear','gear-3',0.91),hit('gear','gear-4',0.84)];
 const list=localModelSuggestions(hits,[p]);
 assert.deepEqual(list.map(item=>item.code),['gear-1','gear-3','gear-2','gear-4','gear-0']);
 assert.ok(list.every(item=>item.matchBasis==='visual'&&item.imageScope==='variant'));
 assert.deepEqual(list[0].specs,[{key:'دندانه',value:'21'}]);
 const result=localVisionResult(hits,[p],{total:5,indexed:5,ready:true},'/customer');
 assert.equal(result.modelSuggestions!.length,5);assert.deepEqual(result.matchedProducts,[]);
});
test('the best photograph wins when one real model has multiple candidate photos',()=>{
 const p=family('gear',1);const lower=hit('gear','gear-0',0.72,'lower'),best={...hit('gear','gear-0',0.93,'best'),row:{...hit('gear','gear-0',0.93,'best').row,url:'/storage/products/catalog/e(9).png'}};
 const list=localModelSuggestions([lower,best],[p]);
 assert.equal(list.length,1);assert.equal(list[0].image,best.row.url);assert.equal(list[0].visualScore,93);
});
test('family-only photos show one scored family result plus honest unscored SKU alternatives',()=>{
 const p=family('gear',3);p.variants![0].images=[];p.variants![2].active=false;
 const list=localModelSuggestions([hit('gear',undefined,0.9)],[p]);
 assert.equal(list[0].code,undefined);assert.equal(list[0].matchBasis,'visual');assert.equal(list[0].visualScore,90);
 assert.equal(list[0].image,'/storage/products/catalog/e(1).png'); // matched family photo
 assert.equal(list[0].imageScope,'family');
 assert.deepEqual(list.slice(1).map(i=>i.code),['gear-0','gear-1']);
 assert.equal(list[1].image,'/storage/products/catalog/e(1).png');assert.equal(list[1].imageScope,'family');
 assert.equal(list[2].image,'/storage/products/catalog/e(2).png');assert.equal(list[2].imageScope,'variant');
 assert.ok(list.slice(1).every(i=>i.matchBasis==='family'&&i.visualScore===undefined));
});
test('a shared photo never becomes multiple independently ranked model scores',()=>{
 const p=family('gear',2);const shared=hit('gear','gear-0',0.97);
 shared.row.bindings.push({familyCode:'gear',code:'gear-1',verified:false});
 const list=localModelSuggestions([shared],[p]);
 assert.equal(list.length,2);assert.ok(list.every(i=>i.matchBasis==='family'&&i.imageScope==='family'&&i.visualScore===undefined));
});
test('weak photos, inactive families and non-existent SKU bindings do not produce visual suggestions',()=>{
 const active=family('gear',2),inactive={...family('hidden'),active:false};
 assert.deepEqual(localModelSuggestions([hit('gear','gear-0',0.4)],[active]),[]);
 assert.deepEqual(localModelSuggestions([hit('hidden','hidden-0',0.99)],[inactive]),[]);
 const list=localModelSuggestions([hit('gear','invented',0.9)],[active]);
 assert.ok(!list.some(item=>item.code==='invented'));
 assert.ok(list.every(i=>i.matchBasis==='family'));
});
test('visual ranking precedes OCR-only and family alternatives; unique OCR codes remain unconfirmed suggestions',()=>{
 const p=family('gear',3);
 const list=localModelSuggestions([hit('gear','gear-0',0.85)],[p],[{text:'gear-2',confidence:96}]);
 assert.deepEqual(list.map(i=>i.code),['gear-0','gear-2','gear-1']);
 assert.equal(list[0].matchBasis,'visual');assert.equal(list[1].matchBasis,'read_code');
 assert.equal(list[1].visualScore,undefined);
});
test('family alternatives are bounded and share slots across visually eligible families',()=>{
 const list=localModelSuggestions([hit('a',undefined,0.9),hit('b',undefined,0.87)],[family('a',100),family('b',100)]);
 assert.equal(list.length,24);assert.equal(new Set(list.map(i=>i.code || i.familyCode)).size,24);
 assert.equal(list[0].familyCode,'a');assert.equal(list[1].familyCode,'b');
});
test('lower-confidence photographed siblings follow their relative image scores but remain family alternatives',()=>{
 const p=family('gear',3);
 const list=localModelSuggestions([hit('gear',undefined,0.9),hit('gear','gear-0',0.51),hit('gear','gear-1',0.62),hit('gear','gear-2',0.57)],[p]);
 assert.equal(list[0].code,undefined);assert.equal(list[0].matchBasis,'visual');assert.equal(list[0].visualScore,90);
 assert.deepEqual(list.slice(1).map(item=>item.code),['gear-1','gear-2','gear-0']);
 assert.ok(list.slice(1).every(item=>item.matchBasis==='family'&&item.visualScore===undefined));
});

test('uncoded family-level products are included and ranked above lower-scoring coded products',()=>{
 const coded=family('coded',1);
 const uncoded=family('uncoded',0);uncoded.images=['e(30).png'];
 const uncodedPhoto=hit('uncoded',undefined,0.96,'uncoded-photo');
 const list=localModelSuggestions([hit('coded','coded-0',0.84),uncodedPhoto],[coded,uncoded]);
 assert.equal(list[0].familyCode,'uncoded');
 assert.equal(list[0].code,undefined);
 assert.equal(list[0].matchBasis,'visual');
 assert.equal(list[0].visualScore,96);
 assert.equal(list[0].image,uncodedPhoto.row.url);
 assert.ok(list[0].reason?.includes('کد SKU فعال ثبت نشده است'));
 assert.equal(list[1].code,'coded-0');
});

test('raw visual similarity remains the primary order when geometry or OCR bonuses differ',()=>{
 const p=family('gear',2);
 const highVisual={...hit('gear','gear-0',0.91),visualScore:0.91};
 const lowerVisual={...hit('gear','gear-1',0.96),visualScore:0.86};
 const list=localModelSuggestions([lowerVisual,highVisual],[p]);
 assert.deepEqual(list.slice(0,2).map(item=>item.code),['gear-0','gear-1']);
 assert.deepEqual(list.slice(0,2).map(item=>item.visualScore),[91,86]);
});

test('a family-only photo remains a scored result even when the family also has coded SKUs',()=>{
 const coded=family('coded',1);
 const familyWithSkus=family('uncoded',1);
 const familyPhoto=hit('uncoded',undefined,0.96,'uncoded-family-photo');
 const list=localModelSuggestions([hit('coded','coded-0',0.84),familyPhoto],[coded,familyWithSkus]);
 assert.equal(list[0].familyCode,'uncoded');
 assert.equal(list[0].code,undefined);
 assert.equal(list[0].matchBasis,'visual');
 assert.equal(list[0].visualScore,96);
 assert.ok(list[0].reason?.includes('نه به یک کد SKU مشخص'));
 assert.ok(list.some(item=>item.code==='uncoded-0'&&item.matchBasis==='family'));
});
