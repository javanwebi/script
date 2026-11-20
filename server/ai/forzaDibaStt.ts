import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { ForzaSttQueue, type ForzaQueueWorker } from './forzaSttQueue';

type Pending = {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
type WorkerState = ForzaQueueWorker & {
  child: ChildProcessWithoutNullStreams;
  ready: boolean;
  failed: boolean;
  inflight: number;
  pending: Map<string, Pending>;
  readyPromise: Promise<void>;
};
type DibaJob = { audioBase64: string; timeoutMs: number };

const MODEL_PATH = process.env.FORZA_STT_DIBA_MODEL_PATH || '/opt/diba-stt/model';
const WORKER_SCRIPT = path.resolve(process.cwd(), 'scripts/forza_diba_stt_worker.py');
const PYTHON = process.env.FORZA_STT_PYTHON || '/opt/forza-pocket/bin/python';
const WORKER_COUNT = Math.max(1, Math.min(2, Number(process.env.FORZA_STT_WORKERS || 2) || 2));
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_PENDING = 48;
const QUEUE_TIMEOUT_MS = 45_000;
let workers: WorkerState[] = [];
let warmPromise: Promise<boolean> | null = null;
let queueWarming = false;
let lastQueueWarmAttemptAt = 0;

export function hasForzaDibaSttModel(): boolean {
  return existsSync(path.join(MODEL_PATH, 'am')) && existsSync(path.join(MODEL_PATH, 'conf'));
}
export function isForzaDibaSttReady(): boolean {
  return workers.some(worker => worker.ready && !worker.failed && worker.child.exitCode === null);
}

function settlePending(worker: WorkerState, id: string, error?: Error, text = ''): void {
  const pending = worker.pending.get(id);
  if (!pending) return;
  worker.pending.delete(id);
  worker.inflight = Math.max(0, worker.inflight - 1);
  clearTimeout(pending.timer);
  if (error) pending.reject(error);
  else pending.resolve(text);
}

function failWorker(worker: WorkerState, reason: string): void {
  if (worker.failed) return;
  worker.failed = true;
  worker.ready = false;
  for (const id of [...worker.pending.keys()]) {
    settlePending(worker, id, new Error(reason));
  }
  queue.notifyWorkersChanged();
}

function executeOnWorker(worker: WorkerState, job: DibaJob): Promise<string> {
  const id = randomUUID();
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      // A timed-out Python process may still be decoding audio. Retire it
      // before releasing the queue slot so no later request is written into
      // a worker whose state is unknown.
      failWorker(worker, 'diba_stt_timeout');
      worker.child.kill('SIGKILL');
    }, job.timeoutMs);
    worker.pending.set(id, { resolve, reject, timer });
    worker.inflight = 1;
    try {
      worker.child.stdin.write(JSON.stringify({ id, audioBase64: job.audioBase64 }) + '\n', error => {
        if (error) {
          failWorker(worker, 'diba_worker_write_failed');
          worker.child.kill('SIGKILL');
        }
      });
    } catch {
      failWorker(worker, 'diba_worker_write_failed');
      worker.child.kill('SIGKILL');
    }
  });
}

const queue = new ForzaSttQueue<DibaJob, string, WorkerState>(
  () => workers.filter(worker => worker.ready && !worker.failed && worker.child.exitCode === null),
  executeOnWorker,
  {
    maxPending: MAX_PENDING,
    queueTimeoutMs: QUEUE_TIMEOUT_MS,
    onNoWorkers: () => {
      if (queueWarming || Date.now() - lastQueueWarmAttemptAt < 5000) return;
      queueWarming = true;
      lastQueueWarmAttemptAt = Date.now();
      void warmForzaDibaStt().finally(() => {
        queueWarming = false;
        queue.notifyWorkersChanged();
      });
    },
  },
);

function startWorker(): WorkerState {
  const child = spawn(PYTHON, [WORKER_SCRIPT], {
    cwd: process.cwd(),
    env: { ...process.env, FORZA_STT_DIBA_MODEL_PATH: MODEL_PATH },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const state: WorkerState = {
    child, ready: false, failed: false, inflight: 0, busy: false,
    pending: new Map(),
    readyPromise: Promise.resolve(),
  };
  state.readyPromise = new Promise<void>((resolve, reject) => {
    const readyTimer = setTimeout(() => {
      failWorker(state, 'diba_worker_start_timeout');
      reject(new Error('diba_worker_start_timeout'));
      child.kill('SIGKILL');
    }, 20_000);
    const lines = createInterface({ input: child.stdout });
    lines.on('line', line => {
      let message: any;
      try { message = JSON.parse(line); } catch { return; }
      if (message?.type === 'ready') {
        state.ready = true;
        clearTimeout(readyTimer);
        resolve();
        queue.notifyWorkersChanged();
        return;
      }
      if (message?.type === 'fatal') {
        clearTimeout(readyTimer);
        const code = String(message.code || 'diba_worker_failed');
        failWorker(state, code);
        reject(new Error(code));
        return;
      }
      const id = String(message?.id || '');
      const pending = state.pending.get(id);
      if (!pending) return;
      settlePending(state, id,
        message?.ok === true ? undefined : new Error(String(message?.code || 'diba_transcription_failed')),
        String(message?.text || '').trim());
    });
    child.once('error', () => {
      clearTimeout(readyTimer);
      failWorker(state, 'diba_worker_process_error');
      reject(new Error('diba_worker_process_error'));
    });
    child.once('exit', () => {
      clearTimeout(readyTimer);
      failWorker(state, 'diba_worker_exited');
      if (!state.ready) reject(new Error('diba_worker_exited'));
      queue.notifyWorkersChanged();
    });
    // Worker diagnostics must never echo audio, transcript or request JSON.
    child.stderr.on('data', () => {});
  });
  return state;
}

export async function warmForzaDibaStt(): Promise<boolean> {
  if (!hasForzaDibaSttModel()) return false;
  const healthyCount = workers.filter(
    worker => worker.ready && !worker.failed && worker.child.exitCode === null,
  ).length;
  if (healthyCount >= WORKER_COUNT) return true;
  if (warmPromise) return warmPromise;
  warmPromise = (async () => {
    workers = workers.filter(worker => !worker.failed && worker.child.exitCode === null);
    while (workers.length < WORKER_COUNT) workers.push(startWorker());
    const results = await Promise.allSettled(workers.map(worker => worker.readyPromise));
    queue.notifyWorkersChanged();
    return results.some(result => result.status === 'fulfilled') && isForzaDibaSttReady();
  })().catch(() => false).finally(() => { warmPromise = null; });
  return warmPromise;
}

export async function transcribeForzaDibaAudio(
  audioBase64: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<string> {
  const encoded = String(audioBase64 || '').replace(/^data:[^,]*;base64,/i, '').trim();
  if (!encoded || encoded.length > 8_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error('invalid_audio');
  }
  if (options.signal?.aborted) throw new Error('stt_aborted');

  if (!isForzaDibaSttReady() && !(await warmForzaDibaStt())) {
    throw new Error(hasForzaDibaSttModel() ? 'diba_worker_unavailable' : 'diba_model_missing');
  }
  // Refill a failed slot in the background/foreground without blocking use of
  // the remaining healthy worker longer than the model warmup itself.
  if (workers.filter(worker => worker.ready && !worker.failed && worker.child.exitCode === null).length < WORKER_COUNT) {
    void warmForzaDibaStt();
  }

  const timeoutMs = Math.max(1500, Math.min(25_000, options.timeoutMs ?? REQUEST_TIMEOUT_MS));
  return queue.submit({ audioBase64: encoded, timeoutMs }, options.signal);
}
