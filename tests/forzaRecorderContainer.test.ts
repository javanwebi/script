import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
const body=ui.split('        mr.ondataavailable = (e: BlobEvent) => {')[1].split('\n        };')[0];
test('recording reaches its cap with header intact and rotates instead of slicing',()=>{
 for(const monitoring of [false,true]){
  const chunks:any[]=[];let stops=0;
  const mr={state:'recording',stop(){stops++;this.state='inactive';}};
  const emit=new Function('audioChunksRef','isProcessingTurnRef','isAiSpeakingRef','hasSpeechSoundRef','mr','e','let rotateCapture=false;'+body+';return rotateCapture;');
  const cap=monitoring?8:160;
  for(let i=0;i<cap;i++)emit({current:chunks},{current:monitoring},{current:false},{current:true},mr,{data:{size:1,id:i}});
  assert.equal(stops,1);assert.equal(chunks[0].id,0);assert.equal(chunks.length,cap);
 }
});
test('barge-in and listening never slice a live container',()=>{
 assert.doesNotMatch(ui,/audioChunksRef\.current\.(?:slice|splice)\(/);
 assert.match(ui,/if\(mediaRecorderRef\.current\?\.state!=='recording'\)audioChunksRef\.current = \[\]/);
});
