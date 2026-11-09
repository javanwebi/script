import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectForzaSttProvider} from '../server/ai/forzaSttProvider';
import {applyPrivateForzaConfig} from '../server/ai/privateForzaConfig';

test('xKiro chat and TTS keys are never interpreted as Gemini STT keys',()=>{
  const selection=selectForzaSttProvider({
    FORZA_VOICE_PROVIDER:'xkiro',
    FORZA_DESK_PROVIDER:'xkiro',
    XKIRO_API_KEY:'test-xkiro-key',
    AI_FORZA_API_KEY:'legacy-non-gemini-key',
    'ai-forza':'legacy-alias-value',
    GEMINI_API_KEY:'old-unrelated-setting',
  });
  assert.deepEqual(selection,{provider:'none',reason:'not_configured'});
  assert.deepEqual(selectForzaSttProvider({FORZA_STT_PROVIDER:'xkiro',XKIRO_API_KEY:'test-key'}),
    {provider:'none',reason:'unsupported_provider'});
});

test('Gemini STT requires explicit opt-in and a dedicated Gemini credential',()=>{
  assert.deepEqual(selectForzaSttProvider({FORZA_STT_PROVIDER:'gemini',XKIRO_API_KEY:'test'}),
    {provider:'none',reason:'missing_gemini_key'});
  assert.deepEqual(selectForzaSttProvider({FORZA_STT_PROVIDER:'gemini',GEMINI_API_KEY:'MY_GEMINI_API_KEY'}),
    {provider:'none',reason:'missing_gemini_key'});
  assert.deepEqual(selectForzaSttProvider({FORZA_STT_PROVIDER:'browser',GEMINI_API_KEY:'old-key'}),
    {provider:'none',reason:'disabled'});
  assert.deepEqual(selectForzaSttProvider({FORZA_STT_PROVIDER:'gemini',FORZA_STT_GEMINI_API_KEY:'dedicated-key'}),
    {provider:'gemini',key:'dedicated-key',reason:'configured'});
});

test('legacy AI_FORZA_API_KEY and ai-forza cannot silently enable Gemini STT',()=>{
  assert.deepEqual(selectForzaSttProvider({
    FORZA_STT_PROVIDER:'gemini',
    AI_FORZA_API_KEY:'unrelated-key',
    'ai-forza':'other-key',
  }),{provider:'none',reason:'missing_gemini_key'});
});

test('Diba Persian STT is the local default only when the server model is bundled',()=>{
  assert.deepEqual(selectForzaSttProvider({FORZA_STT_DIBA_MODEL_PATH:'/opt/diba-stt/model'}),
    {provider:'diba',modelPath:'/opt/diba-stt/model',reason:'configured'});
  assert.deepEqual(selectForzaSttProvider({FORZA_STT_PROVIDER:'diba'}),
    {provider:'none',reason:'model_missing'});
  assert.deepEqual(selectForzaSttProvider({FORZA_STT_PROVIDER:'disabled',FORZA_STT_DIBA_MODEL_PATH:'/opt/diba-stt/model'}),
    {provider:'none',reason:'disabled'});
});

test('legacy private credentials cannot disable the image-provisioned Diba runtime',()=>{
  const env:Record<string,string|undefined>={
    FORZA_STT_PROVIDER:'diba',
    FORZA_STT_DIBA_MODEL_PATH:'/opt/diba-stt/model',
    FORZA_STT_PYTHON:'/opt/forza-pocket/bin/python',
    FORZA_STT_WORKERS:'2',
  };
  applyPrivateForzaConfig(env,{
    FORZA_STT_PROVIDER:'none',
    FORZA_STT_DIBA_MODEL_PATH:'/missing/model',
    FORZA_STT_PYTHON:'/missing/python',
    FORZA_STT_WORKERS:'0',
    FORZA_VOICE_PROVIDER:'avalai',
    AVALAI_API_KEY:'private-key',
  });
  assert.equal(env.FORZA_STT_PROVIDER,'diba');
  assert.equal(env.FORZA_STT_DIBA_MODEL_PATH,'/opt/diba-stt/model');
  assert.equal(env.FORZA_STT_PYTHON,'/opt/forza-pocket/bin/python');
  assert.equal(env.FORZA_STT_WORKERS,'2');
  assert.equal(env.FORZA_VOICE_PROVIDER,'avalai');
  assert.equal(env.AVALAI_API_KEY,'private-key');
});

test('the real single-port VPS runtime provisions and requires ready Diba STT',()=>{
  const deploy=readFileSync(new URL('../ops/deploy-single-port-vps.sh',import.meta.url),'utf8');
  const runtime=readFileSync(new URL('../ops/Dockerfile.forza-stt-runtime',import.meta.url),'utf8');
  const canary=readFileSync(new URL('../ops/verify-single-port-canary.mjs',import.meta.url),'utf8');
  assert.match(runtime,/vosk==0\.3\.45/);
  assert.match(runtime,/Dibachain\/Diba-STT/);
  assert.match(runtime,/FORZA_STT_PROVIDER=diba/);
  assert.match(deploy,/docker build -t "\$STT_IMAGE"/);
  assert.match(deploy,/"\$STT_IMAGE" node --import tsx server\.ts/);
  assert.doesNotMatch(deploy,/node:22-bookworm node --import tsx server\.ts/);
  assert.match(deploy,/FORZA_STT_PROVIDER=diba/);
  assert.match(canary,/assert\.equal\(stt\.serverSttProvider, "diba"\)/);
  assert.match(canary,/assert\.equal\(stt\.serverSttReady, true\)/);
});
