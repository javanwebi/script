/**
 * One-time build-time generation of the exact FORZA greeting using PIPER AMIR.
 * No eSpeak synthetic fallback audio is ever generated or served.
 */
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const model = resolve('public/forza-models/amir/fa_IR-amir-medium.onnx');
const config = model + '.json';
const output = resolve('public/forza-greeting-bootstrap.wav');
const cli = process.env.FORZA_PIPER_BUILD_BIN || '/tmp/forza-piper-build/bin/piper';
const text = 'سَلام، بِه صَنعَتِ پیش خُوش آمَدید. مَن فُورزا هَستَم وَ بَرایِ رَهنَماییِ شُما آمادِه‌اَم.';
if (!existsSync(model) || !existsSync(config)) {
  throw new Error('Amir model missing; run node scripts/download-forza-amir.mjs before greeting generation.');
}
mkdirSync(resolve('public'), { recursive: true });
const result=spawnSync(cli,['--model',model,'--config',config,'--output_file',output],{
 input: text+'\n',encoding:'utf8',timeout:120000,maxBuffer:1024*1024,env:{...process.env,ONNXRUNTIME_LOG_SEVERITY_LEVEL:'3'},
});
if(result.error || result.status !== 0){
  throw new Error('Piper Amir greeting generation failed: '+String(result.error?.message||result.stderr||'exit '+result.status).slice(0,800));
}
const data = readFileSync(output);
if(data.length<44 || data.toString('ascii',0,4)!=='RIFF' || data.toString('ascii',8,12)!=='WAVE'){
  throw new Error('Piper Amir greeting WAV is invalid');
}
console.info('[Amir greeting] verified Piper-generated WAV:',statSync(output).size,'bytes');
