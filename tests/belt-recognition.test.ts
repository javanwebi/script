import test from 'node:test';
import assert from 'node:assert/strict';
import type { Product } from '../src/types';
import type { AiPartAnalysisResult } from '../src/services/aiVisualSearchService';
import { applyBeltRecognition, parseBeltMarkings } from '../src/services/beltRecognition';
const products=[
 {code:'belt-family',name:'تسمه V شکل صنعتی',brand:'SWR',categorySlug:'excel-v2-1-1',categoryName:'تسمه و انتقال نیرو',subcategory:'تسمه V شکل',profiles:'SPB',active:true,variants:[{code:'SPB-2000',name:'SPB 2000',active:true,identitySpecs:{profile:'SPB'},variableSpecs:{beltDivision:'vbelt-wedge'}}]},
 {code:'timing-family',name:'تسمه تایمینگ',brand:'GATES',categorySlug:'excel-v2-1-2',categoryName:'تسمه و انتقال نیرو',subcategory:'تسمه تایمینگ',profiles:'8M',active:true,variants:[{code:'HTD-8M-1200',name:'HTD 8M 1200',active:true,identitySpecs:{profile:'8M'}}]},
 {code:'bearing-family',name:'بلبرینگ شیار عمیق',brand:'SKF',categorySlug:'bearings',categoryName:'قطعات مکانیکی',subcategory:'بلبرینگ',active:true,variants:[{code:'6202ZZ',name:'6202ZZ',active:true}]}
] as Product[];
function resultFor(familyCode:string,code:string):AiPartAnalysisResult{
 const family=products.find(item=>item.code===familyCode)!;
 return {success:true,isAiGenerated:true,stage:'quick',summary:{detectedPartType:'قطعه صنعتی',detectedProfile:'نامشخص',visualAnalysis:'نتیجه اولیه',confidence:0,exactVisualMatch:false,catalogAvailability:{status:'similar_in_catalog',statusFarsiTitle:'مشابه',statusFarsiMessage:'بررسی شود'}},matchedProducts:[],technicalAdvice:'بررسی اولیه؛ سازگاری نهایی باید با اندازه‌گیری تأیید شود.',
 modelSuggestions:[{code,name:family.variants![0].name,familyCode,familyName:family.name,imageScope:'variant',matchBasis:'visual',specs:[],reason:'شباهت تصویری'},{code:'6202ZZ',name:'بلبرینگ',familyCode:'bearing-family',familyName:'بلبرینگ',imageScope:'variant',matchBasis:'visual',specs:[],reason:'نامرتبط'}],
 similarCandidates:[{code,name:family.variants![0].name,brand:family.brand,type:family.name,similarityScore:91,matchReason:'شباهت تصویر',specs:[],matchType:'visual',isVisualMatch:true},{code:'6202ZZ',name:'بلبرینگ',brand:'SKF',type:'بلبرینگ',similarityScore:90,matchReason:'نامرتبط',specs:[],matchType:'visual',isVisualMatch:true}],
 catalogImageMatches:[{imageId:'photo-'+familyCode,image:'/storage/belt.webp',label:family.name,score:91,reason:'تصویر نزدیک',familyNames:[family.name,'بلبرینگ'],bindings:[{familyCode,code,verified:true},{familyCode:'bearing-family',code:'6202ZZ',verified:true}]}]};
}
test('Persian digits and V-belt profile are read without inventing pitch',()=>{const parsed=parseBeltMarkings([{text:'SWR SPB ۲۰۰۰',confidence:97}]);assert.equal(parsed?.profile,'SPB');assert.equal(parsed?.kind,'v-belt');assert.equal(parsed?.lengthMarking,'2000');assert.equal(parsed?.nominalPitchMm,undefined);});
test('timing profile pitch is separated from printed length marking',()=>{const parsed=parseBeltMarkings([{text:'GATES HTD 8M 1200',confidence:96}]);assert.equal(parsed?.profile,'8M');assert.equal(parsed?.kind,'timing');assert.equal(parsed?.nominalPitchMm,8);assert.equal(parsed?.lengthMarking,'1200');});
test('lone letters and low-confidence OCR do not create a profile',()=>{assert.equal(parseBeltMarkings([{text:'INDUSTRIAL PART A',confidence:98}]),undefined);assert.equal(parseBeltMarkings([{text:'SPB 2000',confidence:84}]),undefined);});
test('belt scope filters non-belt candidates and ranks matching profile evidence',()=>{const result=applyBeltRecognition(resultFor('belt-family','SPB-2000'),products,[{text:'SPB 2000',confidence:97}]);assert.equal(result.summary.detectedPartType,'تسمه V شکل');assert.equal(result.summary.detectedProfile,'SPB');assert.equal(result.beltAnalysis?.profileMatchStatus,'matched');assert.deepEqual(result.beltAnalysis?.codeMatches,['SPB-2000']);assert.deepEqual(result.modelSuggestions?.map(item=>item.familyCode),['belt-family']);assert.deepEqual(result.similarCandidates?.map(item=>item.code),['SPB-2000']);assert.deepEqual(result.catalogImageMatches?.[0].bindings.map(item=>item.familyCode),['belt-family']);});
test('conflicting profile removes the visual family from primary candidates',()=>{const result=applyBeltRecognition(resultFor('timing-family','HTD-8M-1200'),products,[{text:'SPB 2000',confidence:97}]);assert.equal(result.beltAnalysis?.profileMatchStatus,'not-matched');assert.deepEqual(result.modelSuggestions,[]);assert.deepEqual(result.similarCandidates,[]);assert.deepEqual(result.catalogImageMatches,[]);assert.equal(result.summary.catalogAvailability?.status,'custom_order_available');});
test('missing family profile metadata is shown as unverified rather than matched',()=>{const unknown=[{...products[0],profiles:'',variants:[{code:'SPB-2000',name:'تسمه صنعتی',active:true}]}] as Product[];const result=applyBeltRecognition(resultFor('belt-family','SPB-2000'),unknown,[{text:'SPB 2000',confidence:97}]);assert.equal(result.beltAnalysis?.profileMatchStatus,'unverified');assert.equal(result.modelSuggestions?.length,1);assert.match(result.beltAnalysis!.note,/کامل نیست/);});
test('generic recognition is unchanged without explicit belt scope',()=>{const base=resultFor('belt-family','SPB-2000');assert.equal(base.beltAnalysis,undefined);assert.equal(base.modelSuggestions?.length,2);});

test('a non-belt visual result is not relabelled as an industrial belt',()=>{
 const result=applyBeltRecognition(resultFor('bearing-family','6202ZZ'),products,[]);
 assert.equal(result.beltAnalysis?.visualBeltConfirmed,false);
 assert.equal(result.beltAnalysis?.beltType,'unknown');
 assert.equal(result.summary.detectedPartType,'تطبیق تصویری تسمه تأیید نشد');
 assert.deepEqual(result.modelSuggestions,[]);
 assert.deepEqual(result.similarCandidates,[]);
});
