import test from 'node:test';
import assert from 'node:assert/strict';
import {allowInProcessPocket} from '../src/utils/forzaPocketRuntimePolicy';

test('self-hosted Ubuntu retains existing on-demand Pocket TTS',()=>{
  assert.equal(allowInProcessPocket({}),true);
});
test('1GB Railway never starts local ONNX or serves it on demand by default',()=>{
  assert.equal(allowInProcessPocket({RAILWAY_SERVICE_ID:'service-id'}),false);
  assert.equal(allowInProcessPocket({RAILWAY_PROJECT_ID:'project-id'}),false);
  assert.equal(allowInProcessPocket({RAILWAY_ENVIRONMENT_NAME:'production'}),false);
});
test('explicit operator opt-in is the only way to run ONNX in Railway',()=>{
  assert.equal(allowInProcessPocket({RAILWAY_SERVICE_ID:'x',FORZA_POCKET_ALLOW_IN_PROCESS:'true'}),true);
  assert.equal(allowInProcessPocket({RAILWAY_SERVICE_ID:'x',FORZA_POCKET_ALLOW_IN_PROCESS:'false'}),false);
});
