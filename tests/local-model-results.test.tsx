import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {LocalModelResults} from '../src/components/search/LocalModelResults';
import type {CatalogModelSuggestion} from '../src/services/aiVisualSearchService';
const item=(code:string):CatalogModelSuggestion=>({code,name:'مدل '+code,familyCode:'gear',familyName:'چرخ‌دنده',image:'/storage/products/catalog/e(1).png',imageScope:'variant',matchBasis:'visual',visualScore:91,specs:[],reason:'مشابه تصویری'});
test('model result cards retain server ordering and distinguish shared photos without fake visual scores',()=>{
 const related={...item('family-alternative'),matchBasis:'family' as const,imageScope:'family' as const,visualScore:undefined};
 const html=renderToStaticMarkup(<MemoryRouter><LocalModelResults items={[item('closest'),item('second'),related]} onClose={()=>{}} /></MemoryRouter>);
 assert.ok(html.indexOf('مدل closest')<html.indexOf('مدل second'));
 assert.ok(html.includes('عکس نمونهٔ خانواده'));
 assert.ok(html.includes('مدل هم‌خانواده'));
 assert.equal((html.match(/شباهت تصویر/g)||[]).length,2);
 assert.ok(html.includes('/product/closest'));
});
test('long result lists start with twelve cards and offer more real models',()=>{
 const html=renderToStaticMarkup(<MemoryRouter><LocalModelResults items={Array.from({length:24},(_,i)=>item('model-'+i))} onClose={()=>{}} /></MemoryRouter>);
 assert.equal((html.match(/<article/g)||[]).length,12);
 assert.ok(html.includes('نمایش مدل‌های بیشتر'));
});
test('exploratory neighbours cannot display an accepted-match label or a confidence score',()=>{
 const html=renderToStaticMarkup(<MemoryRouter><LocalModelResults items={[{...item('nearest'),matchBasis:'explore',visualScore:undefined}]} onClose={()=>{}} /></MemoryRouter>);
 assert.ok(html.includes('برای بررسی؛ تأیید نشده'));
 assert.ok(!html.includes('شباهت تصویر'));assert.ok(!html.includes('مدل هم‌خانواده'));
});

test('family-only visual results show no fake SKU and link to the real family page',()=>{
 const familyOnly:CatalogModelSuggestion={recordType:'family',name:'خانواده بدون کد',familyCode:'uncoded-family',familyName:'خانواده بدون کد',image:'/storage/products/catalog/family.webp',imageScope:'family',matchBasis:'visual',visualScore:88,specs:[],reason:'تصویر خانواده با عکس مشتری شباهت دارد.'};
 const html=renderToStaticMarkup(<MemoryRouter><LocalModelResults items={[familyOnly]} onClose={()=>{}} /></MemoryRouter>);
 assert.ok(html.includes('خانواده بدون کد'));
 assert.ok(html.includes('کد کالا برای این خانواده ثبت نشده'));
 assert.ok(html.includes('مشاهده خانواده'));
 assert.ok(html.includes('/product/uncoded-family'));
 assert.ok(!html.includes('مشاهده این مدل'));
});
