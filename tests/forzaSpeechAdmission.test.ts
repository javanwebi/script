import test from 'node:test';
import assert from 'node:assert/strict';
import {ForzaSpeechAdmission,ForzaRecognitionAdmission} from '../src/utils/forzaSpeechAdmission';
import {extractPersianSpeechSince} from '../src/utils/forzaSpeechPipeline';
import {forzaTurnIntent} from '../src/utils/forzaBargeIn';
import { ForzaVoiceActivity } from '../src/utils/forzaVoiceActivity';
function calibrated(playback=false,noise=0.003){
 const gate=new ForzaSpeechAdmission();
 // Learn the room before playback; TTS energy must never calibrate the mic floor.
 for(let t=0;t<=1000;t+=50)gate.sample(noise,t,false);
 if(playback)gate.sample(noise,1050,true);
 return gate;
}
function speak(gate:ForzaSpeechAdmission,from:number,to:number,level:number,playback=false){
 for(let t=from;t<=to;t+=50)gate.sample(level,t,playback);
}
test('room noise and distant stop words do not authorize interruption or transcription',()=>{
 for(const playback of [false,true]){
  const gate=calibrated(playback,0.008);
  speak(gate,1050,1700,0.012,playback);
  for(const word of ['وایسا','صبر کن','ساکت','بلبرینگ دارید'])assert.equal(gate.decide(word,true,playback,1700),'reject');
 }
});
test('one loud transient cannot interrupt, even if STT hallucinates a stop',()=>{
 const gate=calibrated(true);gate.sample(0.2,1050,true);
 assert.notEqual(gate.decide('وایسا',true,true,1050),'accept');
 gate.sample(0.003,1200,true);
 assert.equal(gate.decide('وایسا',true,true,1200),'reject');
});
test('sustained close stop is fast; ordinary barge-in needs longer evidence and words',()=>{
 const gate=calibrated(true);speak(gate,1050,1250,0.06,true);
 assert.equal(gate.decide('وایسا',false,true,1250),'accept');
 assert.equal(gate.decide('برای دستگاه',false,true,1250),'wait');
 speak(gate,1300,1400,0.06,true);
 assert.equal(gate.decide('برای دستگاه',false,true,1400),'accept');
 assert.equal(gate.decide('برای',false,true,1400),'wait');
});
test('quiet near speech works in quiet rooms and stale VAD cannot admit a bystander',()=>{
 const gate=calibrated(false,0.001);speak(gate,1050,1350,0.011);
 assert.equal(gate.decide('بلبرینگ',false,false,1350),'accept');
 speak(gate,1400,1800,0.001);
 assert.equal(gate.decide('کلام دور',false,false,1800),'reject');
 assert.equal(gate.decide('بلبرینگ',true,false,1800),'accept','bounded late final');
 speak(gate,1850,2400,0.001);
 assert.equal(gate.decide('کلام دور',true,false,2400),'reject');
});
test('playback transition, suspended analyser and microphone reset invalidate old evidence',()=>{
 const gate=calibrated();speak(gate,1050,1350,0.06);
 assert.equal(gate.decide('وایسا',false,true,1350),'reject');
 gate.sample(0.06,1400,true);
 assert.notEqual(gate.decide('وایسا',false,true,1400),'accept');
 assert.equal(gate.decide('وایسا',true,true,2000),'reject');
 gate.reset();assert.equal(gate.decide('وایسا',true,true,2050),'reject');
});
const result=(text:string,isFinal=false)=>({0:{transcript:text},isFinal});
test('rejected cumulative finals never reappear when a nearby user speaks',()=>{
 const f=new ForzaRecognitionAdmission();
 f.filter([result('صدای اطراف',true)],()=> 'reject');
 const accepted=f.filter([result('صدای اطراف',true),result('بلبرینگ 6203',true)],()=> 'accept');
 assert.equal(extractPersianSpeechSince(accepted.results,0).text,'بلبرینگ 6203');
});
test('a rejected interim prefix cannot contaminate later customer words',()=>{
 const f=new ForzaRecognitionAdmission();f.filter([result('صدای اطراف')],()=> 'reject');
 const next=f.filter([result('صدای اطراف بلبرینگ 6203')],()=> 'accept');
 assert.equal(extractPersianSpeechSince(next.results,0).text,'بلبرینگ 6203');
});
test('untrusted suffix keeps accepted words but cannot change the displayed request',()=>{
 const f=new ForzaRecognitionAdmission();f.filter([result('6203')],()=> 'accept');
 const rejected=f.filter([result('6203 حرف فرد کناری',true)],()=> 'reject');
 assert.equal(extractPersianSpeechSince(rejected.results,0).text,'6203');
 assert.equal(rejected.rejected,true);assert.equal(rejected.changed,true);
});
test('pending onset preserves the first word, reset discards session state',()=>{
 const f=new ForzaRecognitionAdmission();f.filter([result('وایسا')],()=> 'wait');
 assert.equal(f.filter([result('وایسا')],()=> 'accept').changed,true);
 f.reset();assert.equal((f.filter([result('سلام',true)],()=> 'accept').results[0][0] as any)?.transcript,'سلام');
});
test('short stop variants remain local commands, compound requests remain questions',()=>{
 for(const word of ['وایسا','صبر کن','یه لحظه','یک لحظه','بس کن','بسه','ساکت','ساکت شو'])assert.equal(forzaTurnIntent(word),'stop');
 assert.notEqual(forzaTurnIntent('وایسا منظورم 6203 است'),'stop');
});


test('a filtered interim finalizes without duplicating its admitted suffix',()=>{
 const f=new ForzaRecognitionAdmission();f.filter([result('دور')],()=> 'reject');
 f.filter([result('دور بلبرینگ')],()=> 'accept');
 const final=f.filter([result('دور بلبرینگ 6203',true)],()=> 'accept');
 assert.equal(extractPersianSpeechSince(final.results,0).text,'بلبرینگ 6203');
});

test('assistant playback cannot raise the noise floor and suppress the next customer turn',()=>{
 const gate=calibrated(false,0.001);
 const roomFloor=gate.diagnostics(1000).floor;
 for(let t=1050;t<=3500;t+=50)gate.sample(0.06,t,true);
 assert.equal(gate.diagnostics(3500).floor,roomFloor,'TTS energy must not become ambient noise');
 assert.equal(gate.diagnostics(3500).utteranceLatched,false,
  'unrecognized loudspeaker echo must not latch as an admitted customer utterance');
 gate.sample(0.0005,3550,false);
 gate.sample(0.0005,3700,false);
 speak(gate,3750,4000,0.006,false);
 assert.equal(gate.decide('برای دستگاه تسمه PU می خواهم',false,false,4000),'accept',
  'the next customer turn must be admitted after assistant playback');
});

test('continuing speech survives the transition out of playback',()=>{
 const gate=calibrated(true);speak(gate,1050,1400,0.06,true);
 assert.equal(gate.decide('وایسا',false,true,1400),'accept');
 assert.equal(gate.decide('وایسا منظورم',false,false,1400),'accept');
 gate.sample(0.06,1450,false);
 assert.equal(gate.decide('وایسا منظورم 6203',false,false,1450),'accept');
});


test('slow rendering does not turn consecutive voiced samples into silence',()=>{
 const gate=calibrated(true);
 for(const t of [1100,1275,1450])gate.sample(0.06,t,true);
 assert.equal(gate.decide('وایسا',true,true,1450),'accept');
 const sparse=calibrated(true);
 sparse.sample(0.06,1100,true);sparse.sample(0.06,1300,true);
 assert.notEqual(sparse.decide('وایسا',true,true,1300),'accept','two sparse peaks are insufficient');
 sparse.sample(0.06,1700,true);
 assert.notEqual(sparse.decide('وایسا',true,true,1700),'accept','a long sampling stall resets evidence');
});


test('a final can await queued audio evidence without becoming a permanent rejected slot',()=>{
 const f=new ForzaRecognitionAdmission();
 assert.equal(f.filter([result('وایسا',true)],()=> 'wait').waiting,true);
 const accepted=f.filter([result('وایسا',true)],()=> 'accept');
 assert.equal(extractPersianSpeechSince(accepted.results,0).text,'وایسا');
 const expired=new ForzaRecognitionAdmission();expired.filter([result('دور',true)],()=> 'wait');
 expired.filter([result('دور',true)],()=> 'reject');
 assert.equal(extractPersianSpeechSince(expired.filter([result('دور',true)],()=> 'accept').results,0).text,'');
});

test('low-gain microphone admits normal speech without requiring a shout',()=>{
 for(const [playback,level] of [[false,0.003],[true,0.006]] as const){
  const gate=calibrated(playback,0.0005);
  speak(gate,1050,1400,level,playback);
  assert.equal(gate.decide(playback?'وایسا':'بلبرینگ 6203',false,playback,1400),'accept');
  assert.equal(gate.acousticSpeech,true);
 }
});

test('an emerging quiet utterance does not raise its own ambient threshold',()=>{
 const gate=calibrated(false,0.001);
 for(let t=1050;t<6000;t+=50)gate.sample(0.003,t,false);
 assert.equal(gate.decide('مشخصات تسمه را می خواهم',false,false,5950),'accept');
});

test('long speech does not relearn its own voice level as ambient noise between words',()=>{
 const gate=calibrated(false,0.003);
 // First phrase establishes the utterance latch only after its words pass admission.
 speak(gate,1050,1300,0.006);
 assert.equal(gate.decide('بخش اول مشخصات تسمه',false,false,1300),'accept');
 assert.equal(gate.acousticSpeech,true);
 // Simulate several natural 120ms word gaps. The room floor must stay frozen
 // while the same utterance continues, even when the mic level is modest.
 for(let start=1450;start<5600;start+=550){
  speak(gate,start,start+300,0.006);
  for(let t=start+350;t<start+500;t+=50)gate.sample(0.003,t,false);
 }
 // Continue speaking after the last natural gap; the floor must remain frozen
 // at the room level and fresh near-field samples must admit the resumed words.
 speak(gate,5850,6050,0.006);
 assert.equal(gate.decide('مشخصات تسمه را می خواهم',false,false,6050),'accept');
 assert.equal(gate.acousticSpeech,true);
});

test('final hypotheses are accepted only while near-field evidence is fresh',()=>{
 const gate=calibrated(false,0.001);
 speak(gate,1050,1350,0.006);
 speak(gate,1400,2100,0.001);
 assert.equal(gate.decide('تسمه SPA 1250',true,false,2100),'accept');
 speak(gate,2150,2400,0.001);
 assert.equal(gate.decide('تسمه SPA 1250',true,false,2400),'reject');
});

test('a late final hypothesis preserves words already admitted as live interim text',()=>{
 const gate=calibrated(false,0.001);
 speak(gate,1050,1350,0.006);
 const admission=new ForzaRecognitionAdmission();
 const interim=admission.filter([result('بلبرینگ 6203',false)],
  (text,final)=>gate.decide(text,final,false,1350));
 assert.equal(extractPersianSpeechSince(interim.results,0).text,'بلبرینگ 6203');
 const final=admission.filter([result('بلبرینگ 6203',true)],
  (text,isFinal)=>gate.decide(text,isFinal,false,2400));
 assert.equal(extractPersianSpeechSince(final.results,0).text,'بلبرینگ 6203');
 assert.equal(final.results[0].isFinal,true);
});

test('near-field admission survives short Persian word gaps but expires after sustained silence',()=>{
 const gate=calibrated(false,0.001);
 speak(gate,1050,1300,0.006);
 assert.equal(gate.decide('بلبرینگ',false,false,1300),'accept');
 for(let t=1350;t<=1450;t+=50)gate.sample(0.0005,t,false);
 assert.equal(gate.acousticSpeech,false,'the immediate onset detector may reset during a word gap');
 assert.equal(gate.hasRecentNearFieldEvidence(1450),true);
 assert.equal(gate.decide('بلبرینگ 6203',false,false,1450),'accept',
  'the already-admitted utterance must survive a short inter-word gap');
 for(let t=1500;t<=1650;t+=50)gate.sample(0.0005,t,false);
 assert.equal(gate.hasRecentNearFieldEvidence(1650),false);
 assert.equal(gate.decide('صدای دور',false,false,1650),'reject',
  'a stale near-field latch must not authorize a later speaker');
});

test('fresh near-field PCM resets the VAD endpoint before the full admission window',()=>{
 const gate=calibrated(false,0.001);
 const vad=new ForzaVoiceActivity();
 for(let t=1050;t<=1300;t+=50){
  gate.sample(0.006,t,false);
  const evidence=gate.acousticSpeech||gate.hasRecentNearFieldEvidence(t);
  vad.sample(0.006,t,evidence);
 }
 assert.equal(vad.heardSpeech,true);
 for(let t=1350;t<=3700;t+=50){
  gate.sample(0.0005,t,false);
  const evidence=gate.acousticSpeech||gate.hasRecentNearFieldEvidence(t);
  vad.sample(0.0005,t,evidence);
 }
 assert.ok(vad.silenceDuration(3700)>=2300);
 gate.sample(0.006,3750,false);
 assert.equal(gate.acousticSpeech,false,'the resumed syllable has not completed the full evidence window');
 const resumed=vad.sample(0.006,3750,
  gate.acousticSpeech||gate.hasRecentNearFieldEvidence(3750));
 assert.equal(resumed.speaking,true);
 assert.equal(resumed.silenceMs,0,'the pending endpoint must see resumed near-field PCM immediately');
});
test('ordinary speech at moderate mic gain remains admitted over an ambient floor',()=>{
 const gate=calibrated(false,0.003);
 speak(gate,1050,1450,0.006);
 assert.equal(gate.decide('تسمه صنعتی می خواهم',false,false,1450),'accept');
});
