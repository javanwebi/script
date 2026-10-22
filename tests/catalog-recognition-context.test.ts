import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogRecognitionContext,normalizeRecognitionObservation} from '../src/services/catalogRecognitionContext';
import {classifyVisualEvidence} from '../src/services/exhaustiveImageScan';
import type {Product} from '../src/types';
const products=[{code:'family',name:'بلبرینگ',active:true,categoryName:'انتقال نیرو',subcategory:'بلبرینگ شیار عمیق',technicalSpecs:[],prices:{},variants:[{code:'real-123',name:'بلبرینگ 6202ZZ',model:'6202ZZ',technicalSpecs:[{name:'قطر داخلی',value:'15',unit:'mm'}],price:99999}]}] as unknown as Product[];
const image={id:'p',url:'https://example.org/p.png',label:'bearing',revision:'1',bindings:[{familyCode:'family',verified:false}]};
test('OCR and family evidence supplement visual retrieval using registered products, without leaking prices',()=>{
 const context=catalogRecognitionContext(products,{detected_code_on_part:'6202ZZ',code_read_confidence:95});
 assert.deepEqual(context.supplement([image]).map(p=>p.id),['p']);
 const details=context.describe(image);
 assert.equal(details[0].variants[0].code,'real-123');assert.ok(!JSON.stringify(details).includes('99999'));
 assert.deepEqual(context.familyNames(image),['بلبرینگ']);
 assert.equal(catalogRecognitionContext(products,{detected_code_on_part:'6202ZZ',code_read_confidence:20}).supplement([image]).length,0);
 assert.equal(catalogRecognitionContext([{...products[0],active:false}],{part_family_farsi:'بلبرینگ'}).describe(image).length,0);
});
test('same family with visible differences remains a labelled related result, never a close physical match',()=>{
 const comparison={similar:true,sameType:true,sameFamily:true,queryType:'helical gear',candidateType:'spur gear',score:88,matchingFeatures:['central bore','external metal teeth'],contradictions:['tooth profile differs'],checks:{geometry:'match',holes:'match',teeth:'mismatch',connections:'unknown',markings:'unknown'}};
 assert.equal(classifyVisualEvidence(comparison),'related');
 assert.equal(classifyVisualEvidence({...comparison,sameType:false,sameFamily:false} ),null);
 assert.equal(classifyVisualEvidence({...comparison,matchingFeatures:['round']}),null);
 const close={...comparison,contradictions:[],checks:{...comparison.checks,teeth:'match'}};
 assert.equal(classifyVisualEvidence(close),'very_similar');
 assert.equal(classifyVisualEvidence({...close,technicalChecks:[{field:'diameter',status:'mismatch'}]}),'related');
});

test('string-valued model feature lists are normalized before the existing site search engine uses join',()=>{
 const result=normalizeRecognitionObservation({visual_features:'helical teeth',technical_features:null,readable_markings:'6202ZZ',unknown_parameters:{},observed_specifications:null});
 assert.equal(result.visual_features.join(' '),'helical teeth');
 assert.deepEqual(result.technical_features,[]);assert.deepEqual(result.readable_markings,['6202ZZ']);assert.deepEqual(result.observed_specifications,[]);
});

test('wrapped model observations and common field aliases preserve the actual part description',()=>{
 const value=normalizeRecognitionObservation({recognition:{what_you_see:'helical gear',part_type:'gear',visual_features:'angled teeth'}});
 assert.equal(value.whatYouSee,'helical gear');assert.equal(value.detected_part_type,'gear');assert.deepEqual(value.visual_features,['angled teeth']);
});
