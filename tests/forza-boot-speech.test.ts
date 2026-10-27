import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldRemountAfterCatalogHydration} from '../src/utils/forzaBootPolicy';
import {findPersianSpeechVoice} from '../src/utils/forzaBrowserSpeech';
test('catalog hydration never remounts an active FORZA route',()=>{
  for (const route of ['/ai-forza','/ai-forza/','/ai-forza/session'])
    assert.equal(shouldRemountAfterCatalogHydration(route),false);
  assert.equal(shouldRemountAfterCatalogHydration('/'),true);
  assert.equal(shouldRemountAfterCatalogHydration('/category/industrial-belts'),true);
});
test('voice fallback never silently pronounces Farsi with an English speech model',()=>{
  assert.equal(findPersianSpeechVoice([{name:'English',lang:'en-US'}]),null);
  assert.deepEqual(findPersianSpeechVoice([{name:'US English',lang:'en-US'},{name:'Persian',lang:'fa-IR'}]),{name:'Persian',lang:'fa-IR'});
});
