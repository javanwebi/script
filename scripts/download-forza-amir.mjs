/**
 * Download Piper Amir at IMAGE BUILD TIME, never during a production request.
 * Pin and verify the model checksum to protect against a changed upstream file.
 * Source: rhasspy/piper-voices (MIT repository, Amir dataset CC0).
 */
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { resolve } from 'node:path';

export const MODEL_ROOT = resolve('public/forza-models/amir');
const MODEL_NAME = 'fa_IR-amir-medium.onnx';
const SHA256 = 'fb815380d969ea372b0b21b0de14421f58fe481047e153e69685d079b6e1a9d1';
const SOURCE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/fa/fa_IR/amir/medium/';
const modelPath = resolve(MODEL_ROOT, MODEL_NAME);
const configPath = modelPath + '.json';

function sha256File(file) {
  const data = readFileSync(file);
  return createHash('sha256').update(data).digest('hex');
}

async function download(path, url, valid) {
  if (existsSync(path) && valid(path)) {
    console.log('[Amir assets] Reusing verified', path);
    return;
  }
  mkdirSync(MODEL_ROOT, {recursive:true});
  const temp = path + '.part';
  for(let attempt=1; attempt<=3;attempt++) {
    rmSync(temp,{force:true});
    try {
      const response = await fetch(url,{headers:{'User-Agent':'SanatPish-Amir-Build/1.0'},signal:AbortSignal.timeout(180000)});
      if(!response.ok || !response.body) throw new Error('Upstream HTTP '+response.status);
      await pipeline(Readable.fromWeb(response.body),createWriteStream(temp));
      if(!valid(temp)) throw new Error('Downloaded asset failed validation');
      renameSync(temp,path);
      console.log('[Amir assets] Verified',path,statSync(path).size,'bytes');
      return;
    }catch(error){
      console.warn('[Amir assets] download attempt '+attempt+' failed',error.message);
      rmSync(temp,{force:true});
      if(attempt===3)throw error;
      await new Promise(resolve=>setTimeout(resolve,attempt*1000));
    }
  }
}
const validModel = path => statSync(path).size > 60_000_000 && sha256File(path)===SHA256;
const validConfig = path => {
  const conf=JSON.parse(readFileSync(path,'utf8'));
  return conf?.audio?.sample_rate===22050 && conf?.espeak?.voice==='fa' && conf?.language?.code==='fa_IR';
};
await download(configPath,SOURCE+MODEL_NAME+'.json',validConfig);
await download(modelPath,SOURCE+MODEL_NAME,validModel);
console.log('[Amir assets] model and configuration bundled for same-origin serving');
