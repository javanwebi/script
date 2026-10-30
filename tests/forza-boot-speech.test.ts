import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldRemountAfterCatalogHydration} from '../src/utils/forzaBootPolicy';
import {findPersianSpeechVoice,findLocalPersianSpeechVoice} from '../src/utils/forzaBrowserSpeech';
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

test('local device TTS selects only installed Farsi voices, never remote or English',()=>{
  const voices=[
    {name:'English Local',lang:'en-US',localService:true},
    {name:'Persian Remote',lang:'fa-IR',localService:false},
    {name:'Persian Installed',lang:'fa-IR',localService:true},
  ];
  assert.deepEqual(findLocalPersianSpeechVoice(voices),voices[2]);
  assert.equal(findLocalPersianSpeechVoice(voices.slice(0,2)),null);
  assert.equal(findLocalPersianSpeechVoice([{name:'Persian unverified',lang:'fa-IR'}]),null);
});

test('local Persian voice can also be advertised by its name',()=>{
  const voices=[{name:'فارسی محلی',lang:'und',localService:true}];
  assert.deepEqual(findLocalPersianSpeechVoice(voices),voices[0]);
});
