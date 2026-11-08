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
 assert.ok(html.includes('تصویر نمونهٔ خانواده'));
 assert.ok(html.includes('مدل هم‌خانواده'));
 assert.equal((html.match(/شباهت تصویری/g)||[]).length,2);
 assert.ok(html.includes('/product/closest'));
});
test('long result lists start with twelve cards and offer more real models',()=>{
 const html=renderToStaticMarkup(<MemoryRouter><LocalModelResults items={Array.from({length:24},(_,i)=>item('model-'+i))} onClose={()=>{}} /></MemoryRouter>);
 assert.equal((html.match(/<article/g)||[]).length,12);
 assert.ok(html.includes('نمایش مدل‌های بیشتر'));
});
test('exploratory neighbours cannot display an accepted-match label or a confidence score',()=>{
 const html=renderToStaticMarkup(<MemoryRouter><LocalModelResults items={[{...item('nearest'),matchBasis:'explore',visualScore:undefined}]} onClose={()=>{}} /></MemoryRouter>);
 assert.ok(html.includes('تطبیق تأییدشده نیستند'));assert.ok(html.includes('برای بررسی؛ تأیید نشده'));
 assert.ok(!html.includes('شباهت تصویری:'));assert.ok(!html.includes('مدل هم‌خانواده'));
});

test('a code-less family result has no fabricated SKU link or code text',()=>{
 const uncoded={...item('unused'),code:undefined,name:'قطعه بدون کد',familyCode:'uncoded-family',familyName:'خانواده بدون کد',matchBasis:'visual' as const,visualScore:94,imageScope:'family' as const};
 const html=renderToStaticMarkup(<MemoryRouter><LocalModelResults items={[uncoded]} onClose={()=>{}} /></MemoryRouter>);
 assert.ok(html.includes('کد کالا در کاتالوگ ثبت نشده'));
 assert.ok(html.includes('/product/uncoded-family'));
 assert.ok(!html.includes('/product/undefined'));
 assert.ok(html.includes('شباهت تصویری'));
});
