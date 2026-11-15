import test from 'node:test';
import assert from 'node:assert/strict';
import {
  importWithRetry,
  isTransientModuleImportError,
} from '../src/utils/moduleImportRetry';

test('isTransientModuleImportError recognizes dynamic import fetch failures', () => {
  assert.equal(
    isTransientModuleImportError(
      new TypeError('Failed to fetch dynamically imported module: https://example.com/src/App.tsx'),
    ),
    true,
  );
  assert.equal(
    isTransientModuleImportError(new TypeError('Importing a module script failed.')),
    true,
  );
  assert.equal(
    isTransientModuleImportError(new SyntaxError('Unexpected token')),
    false,
  );
});

test('importWithRetry resolves immediately on first success', async () => {
  let calls = 0;
  const delays: number[] = [];
  const result = await importWithRetry(
    async () => {
      calls += 1;
      return { default: 'App' };
    },
    {
      sleep: async (ms) => {
        delays.push(ms);
      },
    },
  );
  assert.deepEqual(result, { default: 'App' });
  assert.equal(calls, 1);
  assert.deepEqual(delays, []);
});

test('importWithRetry retries transient import errors with exponential backoff and succeeds', async () => {
  let calls = 0;
  const delays: number[] = [];
  const result = await importWithRetry(
    async () => {
      calls += 1;
      if (calls < 3) {
        throw new TypeError(
          'Failed to fetch dynamically imported module: https://example.com/src/App.tsx',
        );
      }
      return { ok: true };
    },
    {
      maxRetries: 3,
      baseDelayMs: 400,
      sleep: async (ms) => {
        delays.push(ms);
      },
    },
  );
  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 3);
  assert.deepEqual(delays, [400, 800]);
});

test('importWithRetry does not retry non-transient errors', async () => {
  let calls = 0;
  await assert.rejects(
    importWithRetry(
      async () => {
        calls += 1;
        throw new SyntaxError('Unexpected export');
      },
      {
        maxRetries: 3,
        sleep: async () => {},
      },
    ),
    SyntaxError,
  );
  assert.equal(calls, 1);
});

test('importWithRetry throws after exhausting maxRetries', async () => {
  let calls = 0;
  const delays: number[] = [];
  await assert.rejects(
    importWithRetry(
      async () => {
        calls += 1;
        throw new TypeError('Failed to fetch dynamically imported module: /src/App.tsx');
      },
      {
        maxRetries: 2,
        baseDelayMs: 250,
        sleep: async (ms) => {
          delays.push(ms);
        },
      },
    ),
    /Failed to fetch dynamically imported module/,
  );
  assert.equal(calls, 3);
  assert.deepEqual(delays, [250, 500]);
});
