import './catalogFixtures';
import test from 'node:test';import assert from 'node:assert/strict';
import {partMeasurements,measurementError,persianPartAnalysis,measurementText} from '../src/utils/partMeasurements';
import {partDimensionMatch} from '../src/utils/partDimensionMatch';
import {finalizeRecognition} from '../src/utils/recognitionPolicy';
test('family-specific measurements ask coupling lobes and seal diameters instead of generic belt pitch',()=>{
 const coupling=partMeasurements({detected_part_type:'elastomeric jaw coupling spider insert'});
 assert.ok(coupling.some(f=>f.id==='lobes'));assert.ok(!coupling.some(f=>f.id==='pitch'));
 const seal=partMeasurements({part_family_farsi:'حلقه آب‌بندی'});assert.ok(seal.some(f=>f.id==='innerDiameter'));
 assert.ok(measurementError(seal,{}));assert.equal(measurementError(seal,Object.fromEntries(seal.map(f=>[f.id,'unknown']))),undefined);
 assert.ok(measurementError(coupling,Object.fromEntries(coupling.map(f=>[f.id,f.id==='lobes'?'2.5':'unknown']))));
 assert.equal(measurementText(seal,{outerDiameter:'30',innerDiameter:'unknown'}),'قطر بیرونی: 30 میلی‌متر');
});
test('English scene captions are never rendered as Persian part analysis',()=>{
 const text=persianPartAnalysis({whatYouSee:'A person holding a red elastomeric jaw coupling spider insert in a workshop setting.',detected_part_type:'jaw coupling spider insert',visual_features:['red','ساختار چندپره']});
 assert.ok(text.includes('کوپلینگ'));assert.ok(text.includes('ساختار چندپره'));assert.ok(!text.includes('person holding'));
});
test('size identity requires all relevant registered measurements, exact units and no unknown or mismatch',()=>{
 const fields=partMeasurements({detected_part_type:'seal ring'});
 const values={outerDiameter:'30',innerDiameter:'20',thickness:'3',profile:'گرد',partCode:'unknown'};
 const specs=[{key:'قطر خارجی',value:'۳۰ mm'},{key:'قطر داخلی',value:'20'},{key:'ضخامت',value:'3'},{key:'پروفیل',value:'گرد'}];
 assert.equal(partDimensionMatch(specs,fields,values).complete,true);
 assert.equal(partDimensionMatch(specs,fields,{...values,partCode:'incompatible-model'}).complete,false);
 assert.equal(partDimensionMatch(specs,fields,{...values,innerDiameter:'21'}).complete,false);
 assert.equal(partDimensionMatch(specs,fields,{...values,thickness:'unknown'}).complete,false);
 assert.equal(partDimensionMatch([{key:'قطر خارجی',value:'3 cm'},...specs.slice(1)],fields,values).complete,false);
});
test('a dimension conflict overrides a read code; server-calculated unique dimensions support one exact code with alternatives',()=>{
 const catalog=[{code:'100',name:'seal',familyCode:'seals',specs:[],imageScope:'family',image:''},{code:'101',name:'seal',familyCode:'seals',specs:[],imageScope:'family',image:''}] as any;
 const conflict=finalizeRecognition({summary:{},matchedProducts:[{code:'100',dimensionMismatch:true}]},catalog,{detected_code_on_part:'100',code_read_confidence:99});assert.equal(conflict.matchedProducts.length,0);
 const result=finalizeRecognition({summary:{},matchedProducts:[],similarCandidates:[{code:'100'},{code:'101'}]},catalog,{},true,new Set(['100']));assert.equal(result.matchedProducts[0].code,'100');assert.equal(result.similarCandidates[0].code,'101');
});

test('the matching ring photograph cannot lend an incorrectly registered spring SKU to the result',async()=>{
 const {partFamilyCompatible}=await import('../src/utils/partFamilyCompatibility');
 assert.equal(partFamilyCompatible('فنر',{detected_part_type:'واشر تخت',part_family_farsi:'واشرها و آب‌بندها'}),false);
 assert.equal(partFamilyCompatible('چرخ دنده',{detected_part_type:'Helical Gear'}),true);
 assert.equal(partFamilyCompatible('تسمه گرد',{detected_part_type:'حلقه آب‌بندی',possible_families:['تسمه گرد']}),true);
});
test('the proven ring photo stays searchable but is no longer assigned to the spring family or labelled a spring preset',async()=>{
 const {USER_PRODUCTS_RAW}=await import('../src/data/userProducts');
 const {buildCatalogImageCorpus}=await import('../src/services/catalogImageCorpus');
 const {INDUSTRIAL_PRESET_SAMPLES}=await import('../src/data/recognitionSamples');
 assert.equal(USER_PRODUCTS_RAW.find(p=>p.code==='FAM-32193')?.images.length,0);
 const photo=buildCatalogImageCorpus(USER_PRODUCTS_RAW).find(p=>p.id==='e(1).png')!;
 assert.ok(photo);assert.equal(photo.bindings.some(b=>b.familyCode==='FAM-32193'),false);
 assert.equal(INDUSTRIAL_PRESET_SAMPLES[0].title,'حلقه تخت');
});
