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

test('all industry details share one lazy template and canonical route handling',()=>{
 const text=source('src/pages/DiscoveryPages.tsx');
 const app=source('src/App.tsx');
 assert.match(text,/React\.lazy\(\(\) =>[\s\S]*import\("\.\/IndustryTemplatePage"\)/);
 assert.match(text,/<IndustryTemplatePage \/>/);
 assert.match(text,/React\.Suspense fallback=/);
 assert.doesNotMatch(text,/TileCeramicIndustryPage|TextileIndustryPage/);
 assert.match(app,/const IndustryTemplatePage = lazy/);
 assert.match(app,/path="\/industries\/:slug"[\s\S]*?IndustryTemplatePage/);
});

test('non-home routes are loaded only when requested',()=>{
 const text=source('src/App.tsx');
 for(const name of ['AllCategoriesPage','CartPage','ClubPage','AgencyPage','AboutUsPage','ContactUsPage']){
  assert.match(text,new RegExp('const '+name+' = lazy\\('));
  assert.doesNotMatch(text,new RegExp('^import \\{ '+name+' \\} from','m'));
 }
 assert.match(text,/import \{ HomePage \} from/,'homepage must stay eager');
});
