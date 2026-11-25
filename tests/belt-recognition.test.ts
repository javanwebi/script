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
 catalogImageMatches:[{imageId:'photo-'+familyCode,image:'/storage/belt.webp',label:family.name,score:91,reason:'تصویر نزدیک',familyNames:[family.name,'بلبرینگ'],bindings:[{familyCode,code,verified:true}]}]};
}
test('Persian digits and V-belt profile are read without inventing pitch',()=>{const parsed=parseBeltMarkings([{text:'SWR SPB ۲۰۰۰',confidence:97}]);assert.equal(parsed?.profile,'SPB');assert.equal(parsed?.kind,'v-belt');assert.equal(parsed?.lengthMarking,'2000');assert.equal(parsed?.nominalPitchMm,undefined);});
test('timing profile pitch is separated from printed length marking',()=>{const parsed=parseBeltMarkings([{text:'GATES HTD 8M 1200',confidence:96}]);assert.equal(parsed?.profile,'8M');assert.equal(parsed?.kind,'timing');assert.equal(parsed?.nominalPitchMm,8);assert.equal(parsed?.lengthMarking,'1200');});
test('DS8M timing profile preserves its eight-millimetre pitch and Persian length digits',()=>{
 const parsed=parseBeltMarkings([{text:'CONTITECH DS8M ۱۲۰۰',confidence:96}]);
 assert.equal(parsed?.profile,'DS8M');
 assert.equal(parsed?.kind,'timing');
 assert.equal(parsed?.nominalPitchMm,8);
 assert.equal(parsed?.lengthMarking,'1200');
});

test('lone letters and low-confidence OCR do not create a profile',()=>{assert.equal(parseBeltMarkings([{text:'INDUSTRIAL PART A',confidence:98}]),undefined);assert.equal(parseBeltMarkings([{text:'SPB 2000',confidence:84}]),undefined);});
test('belt scope filters non-belt candidates and ranks matching profile evidence',()=>{const result=applyBeltRecognition(resultFor('belt-family','SPB-2000'),products,[{text:'SPB 2000',confidence:97}]);assert.equal(result.summary.detectedPartType,'تسمه V شکل');assert.equal(result.summary.detectedProfile,'SPB');assert.equal(result.beltAnalysis?.profileMatchStatus,'matched');assert.deepEqual(result.beltAnalysis?.codeMatches,['SPB-2000']);assert.deepEqual(result.modelSuggestions?.map(item=>item.familyCode),['belt-family']);assert.deepEqual(result.similarCandidates?.map(item=>item.code),['SPB-2000']);assert.deepEqual(result.catalogImageMatches?.[0].bindings.map(item=>item.familyCode),['belt-family']);});
test('a cross-family shared photo cannot confirm a belt even when one binding is a belt family',()=>{
 const base=resultFor('belt-family','SPB-2000');
 base.catalogImageMatches?.[0].bindings.push({familyCode:'bearing-family',code:'6202ZZ',verified:false});
 const result=applyBeltRecognition(base,products,[{text:'SPB 2000',confidence:97}]);
 assert.equal(result.beltAnalysis?.visualBeltConfirmed,false);
 assert.equal(result.beltAnalysis?.profileMatchStatus,'unverified');
 assert.deepEqual(result.beltAnalysis?.candidateFamilies,[]);
 assert.deepEqual(result.modelSuggestions,[]);
 assert.deepEqual(result.similarCandidates,[]);
 assert.deepEqual(result.catalogImageMatches,[]);
});

test('a shared photo across two SKUs confirms only the belt family, not either SKU visually',()=>{
 const extendedProducts=products.map(family=>family.code==='belt-family'
  ? {...family,variants:[...(family.variants||[]),{code:'SPB-2100',name:'SPB 2100',active:true,identitySpecs:{profile:'SPB'}}]}
  : family) as Product[];
 const base=resultFor('belt-family','SPB-2000');
 base.catalogImageMatches?.[0].bindings.push({familyCode:'belt-family',code:'SPB-2100',verified:false});
 base.modelSuggestions=[{name:'تسمه V شکل صنعتی',familyCode:'belt-family',familyName:'تسمه V شکل صنعتی',imageScope:'family',matchBasis:'visual',specs:[],reason:'تصویر مشترک خانواده'}];
 base.similarCandidates=[];
 const result=applyBeltRecognition(base,extendedProducts,[{text:'SPB 2000',confidence:97}]);
 assert.equal(result.beltAnalysis?.visualBeltConfirmed,true);
 assert.deepEqual(result.beltAnalysis?.candidateFamilies.map(item=>item.familyCode),['belt-family']);
 assert.deepEqual(result.similarCandidates,[]);
 assert.equal(result.modelSuggestions?.some(item=>Boolean(item.code)),false);
 assert.deepEqual(result.catalogImageMatches?.[0].bindings,[{familyCode:'belt-family',verified:false}]);
 assert.deepEqual(result.beltAnalysis?.codeMatches,['SPB-2000']);
});

test('an unverified SKU-only photo cannot confirm a belt family or SKU',()=>{
 const base=resultFor('belt-family','SPB-2000');
 base.catalogImageMatches=[{imageId:'unverified-sku-photo',image:'/storage/unverified.webp',label:'تسمه',score:98,reason:'unverified',bindings:[{familyCode:'belt-family',code:'SPB-2000',verified:false}]}];
 const result=applyBeltRecognition(base,products,[{text:'SPB 2000',confidence:97}]);
 assert.equal(result.beltAnalysis?.visualBeltConfirmed,false);
 assert.equal(result.beltAnalysis?.profileMatchStatus,'unverified');
 assert.deepEqual(result.beltAnalysis?.candidateFamilies,[]);
 assert.deepEqual(result.modelSuggestions,[]);
 assert.deepEqual(result.similarCandidates,[]);
 assert.deepEqual(result.catalogImageMatches,[]);
});

test('a family-scoped photo confirms the family but never an individual SKU',()=>{
 const base=resultFor('belt-family','SPB-2000');
 base.catalogImageMatches=[{imageId:'family-photo',image:'/storage/family.webp',label:'تسمه V شکل',score:98,reason:'family photo',bindings:[{familyCode:'belt-family',verified:false}]}];
 const result=applyBeltRecognition(base,products,[{text:'SPB 2000',confidence:97}]);
 assert.equal(result.beltAnalysis?.visualBeltConfirmed,true);
 assert.deepEqual(result.beltAnalysis?.candidateFamilies.map(item=>item.familyCode),['belt-family']);
 assert.deepEqual(result.modelSuggestions,[]);
 assert.deepEqual(result.similarCandidates,[]);
 assert.deepEqual(result.catalogImageMatches?.[0].bindings,[{familyCode:'belt-family',verified:false}]);
});

test('nonvisual SKU siblings are not promoted by a visually matched family',()=>{
 const extendedProducts=products.map(family=>family.code==='belt-family'
  ? {...family,variants:[...(family.variants||[]),{code:'SPB-2100',name:'SPB 2100',active:true,identitySpecs:{profile:'SPB'}}]}
  : family) as Product[];
 const base=resultFor('belt-family','SPB-2000');
 base.similarCandidates?.push({code:'SPB-2100',name:'SPB 2100',brand:'SWR',type:'تسمه V شکل صنعتی',similarityScore:80,matchReason:'family-only candidate',specs:[],matchType:'technical',isVisualMatch:false});
 const result=applyBeltRecognition(base,extendedProducts,[{text:'SPB 2000',confidence:97}]);
 assert.deepEqual(result.similarCandidates?.map(item=>item.code),['SPB-2000']);
});

test('conflicting profile removes the visual family from primary candidates',()=>{const result=applyBeltRecognition(resultFor('timing-family','HTD-8M-1200'),products,[{text:'SPB 2000',confidence:97}]);assert.equal(result.beltAnalysis?.profileMatchStatus,'not-matched');assert.deepEqual(result.modelSuggestions,[]);assert.deepEqual(result.similarCandidates,[]);assert.deepEqual(result.catalogImageMatches,[]);assert.equal(result.summary.catalogAvailability?.status,'custom_order_available');});
test('missing family profile metadata is shown as unverified rather than matched',()=>{const unknown=[{...products[0],profiles:'',variants:[{code:'SPB-2000',name:'تسمه صنعتی',active:true}]}] as Product[];const result=applyBeltRecognition(resultFor('belt-family','SPB-2000'),unknown,[{text:'SPB 2000',confidence:97}]);assert.equal(result.beltAnalysis?.profileMatchStatus,'unverified');assert.equal(result.modelSuggestions?.length,1);assert.match(result.beltAnalysis!.note,/کامل نیست/);});
test('OCR-only and family-sibling suggestions cannot confirm a belt without visual family evidence',()=>{
 const base=resultFor('belt-family','SPB-2000');
 for(const basis of ['read_code','family'] as const){
  const suggestions=(base.modelSuggestions||[]).map(item=>({...item,matchBasis:basis}));
  const result=applyBeltRecognition({...base,modelSuggestions:suggestions,similarCandidates:[],catalogImageMatches:[]},products,[{text:'SPB 2000',confidence:97}]);
  assert.equal(result.beltAnalysis?.visualBeltConfirmed,false);
  assert.equal(result.beltAnalysis?.profileMatchStatus,'unverified');
  assert.deepEqual(result.beltAnalysis?.candidateFamilies,[]);
  assert.equal(result.summary.detectedPartType,'تطبیق تصویری تسمه تأیید نشد');
 }
});

test('generic recognition is unchanged without explicit belt scope',()=>{const base=resultFor('belt-family','SPB-2000');assert.equal(base.beltAnalysis,undefined);assert.equal(base.modelSuggestions?.length,2);});

test('a non-belt visual result is not relabelled as an industrial belt',()=>{
 const result=applyBeltRecognition(resultFor('bearing-family','6202ZZ'),products,[]);
 assert.equal(result.beltAnalysis?.visualBeltConfirmed,false);
 assert.equal(result.beltAnalysis?.beltType,'unknown');
 assert.equal(result.summary.detectedPartType,'تطبیق تصویری تسمه تأیید نشد');
 assert.deepEqual(result.modelSuggestions,[]);
 assert.deepEqual(result.similarCandidates,[]);
});

test('combined brand and profile marking can still match an exact SKU token sequence',()=>{
 const result=applyBeltRecognition(resultFor('belt-family','SPB-2000'),products,[{text:'SWR SPB 2000',confidence:97}]);
 assert.deepEqual(result.beltAnalysis?.codeMatches,['SPB-2000']);
});
test('exploratory nearest neighbours do not confirm that the photographed object is a belt',()=>{
 const base=resultFor('belt-family','SPB-2000');
 const result=applyBeltRecognition({...base,modelSuggestions:[],similarCandidates:[],catalogImageMatches:[],nearestCatalogSuggestions:[{name:'تسمه V شکل صنعتی',familyCode:'belt-family',familyName:'تسمه V شکل صنعتی',imageScope:'family',matchBasis:'explore',specs:[],reason:'نزدیک‌ترین نتیجه'}]},products,[{text:'SPB 2000',confidence:97}]);
 assert.equal(result.beltAnalysis?.visualBeltConfirmed,false);
 assert.equal(result.beltAnalysis?.profileMatchStatus,'unverified');
 assert.equal(result.summary.detectedPartType,'تطبیق تصویری تسمه تأیید نشد');
 assert.deepEqual(result.nearestCatalogSuggestions,[]);
});
test('welding tools and ambiguous service families are excluded from belt identity',()=>{
 const tool={code:'tool-family',name:'دستگاه جوش تسمه',brand:'',categorySlug:'excel-v2-1-1',categoryName:'تسمه و انتقال نیرو',subcategory:'تجهیزات جوش',active:true,variants:[{code:'TOOL-1',name:'دستگاه جوش تسمه',active:true,variableSpecs:{beltDivision:'belt-welding-tool'}}]} as unknown as Product;
 const ambiguous={code:'ambiguous-family',name:'تسمه صنعتی',brand:'',categorySlug:'excel-v2-1-1',categoryName:'تسمه و انتقال نیرو',subcategory:'تسمه',active:true,variants:[{code:'AMB-1',name:'تسمه صنعتی',active:true,variableSpecs:{beltDivision:'service-ambiguous'}}]} as unknown as Product;
 const base=resultFor('belt-family','SPB-2000');
 base.modelSuggestions?.push(
  {code:'TOOL-1',name:'دستگاه جوش تسمه',familyCode:'tool-family',familyName:tool.name,imageScope:'variant',matchBasis:'visual',specs:[],reason:'visual'},
  {code:'AMB-1',name:'تسمه صنعتی',familyCode:'ambiguous-family',familyName:ambiguous.name,imageScope:'variant',matchBasis:'visual',specs:[],reason:'visual'}
 );
 base.similarCandidates?.push(
  {code:'TOOL-1',name:'دستگاه جوش تسمه',brand:'',type:tool.name,similarityScore:90,matchReason:'visual',specs:[],matchType:'visual',isVisualMatch:true},
  {code:'AMB-1',name:'تسمه صنعتی',brand:'',type:ambiguous.name,similarityScore:90,matchReason:'visual',specs:[],matchType:'visual',isVisualMatch:true}
 );
 base.catalogImageMatches?.[0].bindings.push({familyCode:'tool-family',code:'TOOL-1',verified:true},{familyCode:'ambiguous-family',code:'AMB-1',verified:true});
 const result=applyBeltRecognition(base,[...products,tool,ambiguous],[{text:'SPB 2000',confidence:97}]);
 assert.equal(result.beltAnalysis?.candidateFamilies.some(item=>item.familyCode==='tool-family'),false);
 assert.equal(result.beltAnalysis?.candidateFamilies.some(item=>item.familyCode==='ambiguous-family'),false);
 assert.equal(result.modelSuggestions?.some(item=>item.familyCode==='tool-family'||item.familyCode==='ambiguous-family'),false);
});
