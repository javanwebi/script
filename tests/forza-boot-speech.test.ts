import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldRemountAfterCatalogHydration} from '../src/utils/forzaBootPolicy';
import {findPersianSpeechVoice,findLocalPersianSpeechVoice,waitForLocalPersianSpeechVoice} from '../src/utils/forzaBrowserSpeech';
import {readFileSync} from 'node:fs';
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

test('on-device Persian voice must be verified local, not a remote or default voice',()=>{
  const voices=[
    {name:'English built in',lang:'en-US',localService:true},
    {name:'فارسی ابری',lang:'fa-IR',localService:false},
    {name:'Persian installed',lang:'fa-IR',localService:true},
  ];
  assert.deepEqual(findLocalPersianSpeechVoice(voices),voices[2]);
  assert.equal(findLocalPersianSpeechVoice(voices.slice(0,2)),null);
  assert.equal(findLocalPersianSpeechVoice([{name:'fa-IR unverified',lang:'fa-IR'}]),null);
});
test('local voice enumerates late without selecting cloud voice',async()=>{
  let voices=[{name:'Persian Remote',lang:'fa-IR',localService:false}];
  const callbacks=new Set<()=>void>();
  const fake={
    getVoices:()=>voices,
    addEventListener:(_name:string,callback:()=>void)=>{callbacks.add(callback);},
    removeEventListener:(_name:string,callback:()=>void)=>{callbacks.delete(callback);},
  };
  const pending=waitForLocalPersianSpeechVoice(fake as any,200);
  voices=[...voices,{name:'Persian Offline',lang:'fa-IR',localService:true}];
  for(const callback of [...callbacks])callback();
  assert.equal((await pending)?.name,'Persian Offline');
  assert.equal(callbacks.size,0);
});
test('FORZA replies never submit text to the server Pocket TTS endpoint',()=>{
  const file=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(file,/fetch\s*\(\s*['"]\/api\/ai\/forza-speech/);
  assert.match(file,/\/forza-greeting-bootstrap\.wav/);
  assert.match(file,/waitForLocalPersianSpeechVoice/);
  assert.match(file,/takeSpeakablePhrase\(speechBuffer/);
});
