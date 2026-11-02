import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=(path:string)=>readFileSync(path,'utf8');

test('header and homepage do not synchronously bundle heavy visual or consultation dialogs',()=>{
 for(const path of ['src/components/layout/Header.tsx','src/pages/HomePage.tsx']){
  const text=source(path);
  assert.match(text,/React\.lazy\(\(\) => import\(/,path);
  assert.doesNotMatch(text,/^import\s+\{\s*AiVisualPartSearchModal\s*\}\s+from/m,path);
  assert.doesNotMatch(text,/^import\s+\{\s*AiConsultModal\s*\}\s+from/m,path);
  assert.match(text,/React\.Suspense/,path);
 }
});

test('ceramic industry detail no longer defeats dynamic import and keeps a fallback',()=>{
 const text=source('src/pages/DiscoveryPages.tsx');
 assert.match(text,/React\.lazy\(\(\) => import\("\.\/TileCeramicIndustryPage"\)/);
 assert.match(text,/React\.Suspense fallback=/);
 assert.doesNotMatch(text,/^import\s+\{\s*TileCeramicIndustryPage\s*\}\s+from/m);
});

test('non-home routes are loaded only when requested',()=>{
 const text=source('src/App.tsx');
 for(const name of ['AllCategoriesPage','CartPage','ClubPage','AgencyPage','AboutUsPage','ContactUsPage']){
  assert.match(text,new RegExp('const '+name+' = lazy\\('));
  assert.doesNotMatch(text,new RegExp('^import \\{ '+name+' \\} from','m'));
 }
 assert.match(text,/import \{ HomePage \} from/,'homepage must stay eager');
});
