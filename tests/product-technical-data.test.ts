import './catalogFixtures';
import test from 'node:test';
import assert from 'node:assert/strict';
import { USER_PRODUCTS, USER_PRODUCTS_RAW } from '../src/data/userProducts';
import { enrichTechnicalVariant } from '../src/data/productTechnicalData';
const belt = USER_PRODUCTS_RAW.find(p=>p.subcategory === 'تسمه پروفیل باریک')!;
const spec = (v: ReturnType<typeof enrichTechnicalVariant>, key: string) => v.technicalSpecs?.find(s=>s.key===key)?.value;
test('SPA designation yields reference cross section without invented inside/outside lengths', () => {
  const v = enrichTechnicalVariant(belt,{code:'warehouse-1',name:'تسمه SPA 1250',size:'SPA1250'});
  assert.equal(v.model,'SPA');
  assert.equal(v.technicalReview?.technicalCode,'SPA 1250');
  assert.equal(spec(v,'عرض اسمی بالای پروفیل (مرجع)'),'12.7 میلی‌متر');
  assert.equal(spec(v,'ارتفاع اسمی پروفیل (مرجع)'),'10 میلی‌متر');
  assert.ok(!v.technicalSpecs?.some(s=>/طول داخلی|طول خارجی/.test(s.key)));
  assert.ok(v.technicalReview?.references.length);
});
test('ribbed belts preserve profile, rib count and recorded length',()=>{
  const v=enrichTechnicalVariant(belt,{code:'x',name:'تسمه شیاری 6PK1268',size:''});
  assert.equal(v.model,'PK');
  assert.equal(spec(v,'تعداد شیار درج‌شده'),'6');
  assert.equal(spec(v,'گام شیار پروفیل (مرجع)'),'3.56 میلی‌متر');
});
test('every SKU has a review and original commercial data is untouched',()=>{
  const original=new Map(USER_PRODUCTS_RAW.flatMap(p=>(p.variants||[]).map(v=>[v.code,v] as const)));
  for(const p of USER_PRODUCTS)for(const v of p.variants||[]){
    assert.ok(v.technicalReview?.categoryPath.length);
    assert.equal(v.name,original.get(v.code)?.name);
    assert.equal(v.size,original.get(v.code)?.size);
    assert.equal(v.price,original.get(v.code)?.price);
  }
});
test('unknown warehouse SKU is never fabricated into a manufacturer model',()=>{
  const p={...belt,categoryName:'قطعات تولید و قالب',subcategory:'قطعه صنعتی'};
  const v=enrichTechnicalVariant(p,{code:'6202',name:'قطعه صنعتی',size:'نامشخص'});
  assert.equal(v.model,undefined);
  assert.equal(v.technicalReview?.technicalCode,undefined);
  assert.equal(v.technicalReview?.status,'needs-identification');
});
test('manual values win and unitless source dimensions stay unitless',()=>{
  const v=enrichTechnicalVariant(belt,{code:'x',name:'تسمه SPA1250 قطر40',size:'',technicalSpecs:[{key:'ارتفاع اسمی پروفیل (مرجع)',value:'اندازه‌گیری شود'}]});
  assert.equal(spec(v,'ارتفاع اسمی پروفیل (مرجع)'),'اندازه‌گیری شود');
  assert.equal(spec(v,'قطر درج‌شده'),'40 (واحد در منبع مشخص نیست)');
  assert.equal(v.technicalReview?.evidence.find(e=>e.key==='ارتفاع اسمی پروفیل (مرجع)')?.basis,'admin');
});

test('imperial H belts decode verified designation conventions, not millimeter lengths',()=>{
 const v=enrichTechnicalVariant(belt,{code:'warehouse',name:'تسمه 1000H100',size:''});
 assert.equal(v.model,'H');
 assert.equal(spec(v,'طول گام در جدول مرجع'),'2540 میلی‌متر');
 assert.equal(spec(v,'عرض از کد سه‌رقمی اینچی (مرجع)'),'25.4 میلی‌متر');
 assert.equal(spec(v,'تعداد دندانه در جدول مرجع'),'200');
 assert.ok(v.technicalReview?.references.some(r=>r.title.includes('19347')));
});
test('rounded historical length codes use the actual reference table',()=>{
 const v=enrichTechnicalVariant(belt,{code:'warehouse',name:'تسمه 187DL100',size:''});
 assert.equal(spec(v,'طول گام در جدول مرجع'),'476.25 میلی‌متر');
 assert.equal(spec(v,'تعداد دندانه در جدول مرجع'),'50');
 assert.equal(v.technicalReview?.designationCheck?.identityVerified,false);
});
test('explicit drawing codes are preserved without inventing a standard or manufacturer model',()=>{
 const v=enrichTechnicalVariant(belt,{code:'44624',name:'بوش داخل بلبرینگ پولی هرزگرد کد1302/1',size:'1302/1'});
 assert.equal(v.technicalReview?.catalogPartCode,'1302/1');
 assert.equal(v.technicalReview?.standardStatus,'not-established');
 assert.equal(spec(v,'نوع قطعه'),'بوش صنعتی');
 assert.equal(v.model,undefined);
});
test('a pulley located in a belt category is not decoded as a timing belt',()=>{
 const v=enrichTechnicalVariant(belt,{code:'x',name:'پولی 20H100',size:'20H100'});
 assert.equal(spec(v,'نوع قطعه'),'پولی صنعتی');
 assert.equal(spec(v,'طول گام در جدول مرجع'),undefined);
});
test('washing and seal standards are conditional references rather than claimed conformity',()=>{
 const v=enrichTechnicalVariant(belt,{code:'x',name:'واشر پلی یورتان 3 * 48 * 100',size:''});
 assert.equal(v.technicalReview?.standardStatus,'not-established');
 assert.ok(v.technicalReview?.comparisonReferences?.every(r=>r.condition.includes('فقط')));
});
test('technical extraction is idempotent and manual overrides survive reprocessing',()=>{
 const v=enrichTechnicalVariant(belt,{code:'x',name:'تسمه1000H100',size:''});
 assert.deepEqual(enrichTechnicalVariant(belt,v),v);
 const changed={...v,technicalSpecs:v.technicalSpecs!.map(s=>s.key==='نوع قطعه'?{...s,value:'تأیید مدیر'}:s)};
 assert.equal(spec(enrichTechnicalVariant(belt,changed),'نوع قطعه'),'تأیید مدیر');
});

test('catalog markings preserve letter suffixes and Persian drawing prefixes',()=>{
 const a=enrichTechnicalVariant(belt,{code:'x',name:'بوش کد1302/1A',size:''});
 assert.equal(a.technicalReview?.catalogPartCode,'1302/1A');
 const b=enrichTechnicalVariant(belt,{code:'y',name:'بوش کد ت/ 1162/2',size:''});
 assert.equal(b.technicalReview?.catalogPartCode,'ت/1162/2');
 const c=enrichTechnicalVariant(belt,{code:'z',name:'ریل چاکدار',size:''});
 assert.equal(c.technicalReview?.catalogPartCode,undefined);
});


test('enrichment preserves the complete source SKU multiset and only copies existing catalog markings',()=>{
 const source=USER_PRODUCTS_RAW.flatMap(p=>p.variants||[]);
 const result=USER_PRODUCTS.flatMap(p=>p.variants||[]);
 const identity=(v:typeof source[number])=>JSON.stringify([v.code,v.name,v.size]);
 assert.deepEqual(result.map(identity).sort(),source.map(identity).sort());
 const normalize=(s:string)=>s.replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[\s\u200c]+/g,'').toUpperCase();
 for(const v of result){
   const marking=v.technicalReview?.catalogPartCode;
   if(marking) assert.ok(normalize(v.name||'').includes(normalize(marking)),`Unrecorded marking for SKU ${v.code}`);
 }
});

test('unlisted codes and internally inconsistent source tables never produce a guessed length',()=>{
 for(const name of ['تسمه 1235H100','تسمه 817L100']){
  const v=enrichTechnicalVariant(belt,{code:'original',name,size:''});
  assert.equal(spec(v,'طول گام در جدول مرجع'),undefined);
  assert.ok(spec(v,'ابهام نام‌گذاری طول'));
 }
});
test('MXL table notation is not confused with tenths of inches',()=>{
 const v=enrichTechnicalVariant(belt,{code:'original',name:'تسمه اپتی 480MXL025',size:''});
 assert.equal(spec(v,'طول گام در جدول مرجع'),'121.92 میلی‌متر');
 assert.equal(spec(v,'تعداد دندانه در جدول مرجع'),'60');
});
test('leading wheel and housing nouns win over sealing components they carry',()=>{
 const v=enrichTechnicalVariant({...belt,subcategory:'اورینگ لاستیکی'},{code:'33365',name:'چرخ هرزگرد تفلونی با روکش اورینگ 7/5 کد 1069/1',size:''});
 assert.equal(spec(v,'نوع قطعه'),'چرخ صنعتی');
 const h=enrichTechnicalVariant({...belt,subcategory:'لاستیک دیافراگم'},{code:'34318',name:'پوسته مادگی چدنی نگهدارنده لاستیک 2 اینچ دیافراگم کد 1452/10',size:''});
 assert.equal(spec(h,'نوع قطعه'),'پوسته صنعتی');
 assert.equal(spec(h,'جنس توصیف‌شده در کاتالوگ'),'چدنی');
 const g=enrichTechnicalVariant(belt,{code:'44625',name:'گاید فلزی 13 * 40 مخصوص ریل تفلونی کد 1023/2',size:''});
 assert.equal(spec(g,'جنس توصیف‌شده در کاتالوگ'),undefined);
});

test('ambiguous MXL numbering and unmatched ROTEX sizes remain unresolved',()=>{
 const mx=enrichTechnicalVariant(belt,{code:'a',name:'تسمه 480MXL025',size:''});
 assert.equal(spec(mx,'طول گام در جدول مرجع'),undefined);
 assert.ok(mx.technicalReview?.researchWarnings?.length);
 const rt=enrichTechnicalVariant(belt,{code:'50125',name:'لاستیک ROTEX 54',size:''});
 assert.equal(rt.model,'ROTEX 54');
 assert.ok(rt.technicalReview?.researchWarnings?.length);
 assert.equal(rt.code,'50125');
});
