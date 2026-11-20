import test from 'node:test';
import assert from 'node:assert/strict';
import { ForzaSttQueue, type ForzaQueueWorker } from '../server/ai/forzaSttQueue';

interface Worker extends ForzaQueueWorker { id: number }
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('Diba queue dispatches FIFO and never runs more jobs than available workers', async () => {
  const workers: Worker[] = [{ id: 1, busy: false }, { id: 2, busy: false }];
  const started: number[] = [];
  const tasks = new Map<number, ReturnType<typeof deferred<number>>>();
  const queue = new ForzaSttQueue<number, number, Worker>(
    () => workers,
    async (worker, value) => {
      started.push(value);
      const task = deferred<number>();
      tasks.set(value, task);
      return task.promise;
    },
    { maxPending: 8, queueTimeoutMs: 10_000 },
  );

  const results = [1, 2, 3, 4].map(value => queue.submit(value));
  await tick();
  assert.deepEqual(started, [1, 2]);
  assert.equal(queue.pendingCount, 4);

  tasks.get(1)!.resolve(10);
  assert.equal(await results[0], 10);
  await tick();
  assert.deepEqual(started, [1, 2, 3]);

  tasks.get(2)!.resolve(20);
  tasks.get(3)!.resolve(30);
  await tick();
  assert.deepEqual(started, [1, 2, 3, 4]);
  tasks.get(4)!.resolve(40);
  assert.deepEqual(await Promise.all(results), [10, 20, 30, 40]);
  assert.equal(queue.pendingCount, 0);
  assert.equal(workers.every(worker => !worker.busy), true);
});

test('aborting a queued request removes it without consuming a worker slot', async () => {
  const workers: Worker[] = [{ id: 1, busy: false }];
  const active = deferred<string>();
  const started: string[] = [];
  const queue = new ForzaSttQueue<string, string, Worker>(
    () => workers,
    async (_worker, value) => {
      started.push(value);
      return value === 'active' ? active.promise : value;
    },
    { maxPending: 4, queueTimeoutMs: 10_000 },
  );

  const first = queue.submit('active');
  const controller = new AbortController();
  const second = queue.submit('cancel-me', controller.signal);
  await tick();
  controller.abort();
  await assert.rejects(second, /stt_aborted/);
  assert.deepEqual(started, ['active']);

  active.resolve('done');
  assert.equal(await first, 'done');
  await tick();
  assert.deepEqual(started, ['active']);
  assert.equal(queue.pendingCount, 0);
});

test('aborting an active request rejects its caller but keeps its worker busy until processing ends', async () => {
  const workers: Worker[] = [{ id: 1, busy: false }];
  const active = deferred<string>();
  const started: string[] = [];
  const queue = new ForzaSttQueue<string, string, Worker>(
    () => workers,
    async (_worker, value) => {
      started.push(value);
      return value === 'active' ? active.promise : value;
    },
    { maxPending: 4, queueTimeoutMs: 10_000 },
  );

  const controller = new AbortController();
  const first = queue.submit('active', controller.signal);
  const second = queue.submit('next');
  await tick();
  controller.abort();
  await assert.rejects(first, /stt_aborted/);
  assert.deepEqual(started, ['active']);
  assert.equal(workers[0].busy, true);

  active.resolve('discarded');
  assert.equal(await second, 'next');
  assert.deepEqual(started, ['active', 'next']);
  assert.equal(queue.pendingCount, 0);
});

test('bounded queue rejects overload instead of growing without limit', async () => {
  const workers: Worker[] = [{ id: 1, busy: false }];
  const active = deferred<string>();
  const queue = new ForzaSttQueue<string, string, Worker>(
    () => workers,
    async () => active.promise,
    { maxPending: 2, queueTimeoutMs: 10_000 },
  );

  const first = queue.submit('one');
  const second = queue.submit('two');
  await tick();
  await assert.rejects(queue.submit('three'), /diba_stt_busy/);
  active.resolve('ok');
  assert.equal(await first, 'ok');
  await tick();
  assert.equal(await second, 'ok');
});

test('queued work resumes when a previously unavailable worker becomes ready', async () => {
  const workers: Worker[] = [];
  const queue = new ForzaSttQueue<number, number, Worker>(
    () => workers,
    async (_worker, value) => value * 2,
    { maxPending: 4, queueTimeoutMs: 10_000 },
  );
  const result = queue.submit(21);
  await tick();
  assert.equal(queue.pendingCount, 1);
  workers.push({ id: 1, busy: false });
  queue.notifyWorkersChanged();
  assert.equal(await result, 42);
});

test('forty simultaneous STT requests are admitted and serialized across two workers', async () => {
  const workers: Worker[] = [{ id: 1, busy: false }, { id: 2, busy: false }];
  let active = 0;
  let maximumActive = 0;
  const started: number[] = [];
  const queue = new ForzaSttQueue<number, number, Worker>(
    () => workers,
    async (_worker, value) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      started.push(value);
      await new Promise(resolve => setTimeout(resolve, 2));
      active -= 1;
      return value;
    },
    { maxPending: 48, queueTimeoutMs: 45_000 },
  );

  const results = await Promise.all(Array.from({ length: 40 }, (_, index) => queue.submit(index)));
  assert.deepEqual(results, Array.from({ length: 40 }, (_, index) => index));
  assert.equal(started.length, 40);
  assert.equal(maximumActive, 2);
  assert.equal(queue.pendingCount, 0);
});

test('a queued request expires cleanly when workers remain busy beyond the queue deadline', async () => {
  const workers: Worker[] = [{ id: 1, busy: false }];
  const active = deferred<string>();
  const queue = new ForzaSttQueue<string, string, Worker>(
    () => workers,
    async () => active.promise,
    { maxPending: 4, queueTimeoutMs: 1000 },
  );

  const first = queue.submit('active');
  const queued = queue.submit('expires');
  await assert.rejects(queued, /diba_stt_queue_timeout/);
  active.resolve('finished');
  assert.equal(await first, 'finished');
  assert.equal(queue.pendingCount, 0);
});
