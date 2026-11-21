import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');

test('FORZA never instantiates native SpeechRecognition on the raw microphone',()=>{
 assert.ok(!source.includes('SpeechRecognition'));
 assert.ok(!source.includes('webkitSpeechRecognition'));
 assert.ok(!source.includes('new SpeechRec()'));
 assert.ok(!source.includes('initSpeechRecognition'));
});

test('local Diba and server Diba receive only the AudioWorklet-filtered microphone route',()=>{
 const start=source.indexOf('const initializeMicrophone = useCallback(async () => {');
 const end=source.indexOf('},[ensureCtx,setupMediaRecorder,startListening,attachLocalStt]);',start);
 assert.ok(start>=0&&end>start);
 const mic=source.slice(start,end);
 assert.ok(mic.includes('attachForzaAudioEvidence(ctx,rawSource'));
 assert.ok(mic.includes('micSourceNodeRef.current=route.node'));
 assert.ok(mic.includes('setupMediaRecorder(route.stream)'));
 assert.ok(mic.includes('recognitionRef.current=null'));
 assert.ok(!mic.includes('navigator.mediaDevices.getUserMedia') || mic.includes('attachForzaAudioEvidence'));
});

test('monitor listening keeps the same call session without restarting a raw microphone recognizer',()=>{
 const start=source.indexOf('const startListening = useCallback(');
 const end=source.indexOf('const stopListening = useCallback(',start);
 assert.ok(start>=0&&end>start);
 const body=source.slice(start,end);
 assert.ok(body.includes('const localReady=startDibaTurn()'));
 assert.ok(body.includes('recorder.start(250)'));
 assert.ok(!body.includes('recognitionStartRef.current()'));
 assert.ok(!body.includes('recognitionRef.current?.start()'));
});
