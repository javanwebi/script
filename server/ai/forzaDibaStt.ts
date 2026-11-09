import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';

type Pending = {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  abort?: () => void;
};
type WorkerState = {
  child: ChildProcessWithoutNullStreams;
  ready: boolean;
  failed: boolean;
  inflight: number;
  pending: Map<string, Pending>;
  readyPromise: Promise<void>;
};

const MODEL_PATH = process.env.FORZA_STT_DIBA_MODEL_PATH || '/opt/diba-stt/model';
const WORKER_SCRIPT = path.resolve(process.cwd(), 'scripts/forza_diba_stt_worker.py');
const PYTHON = process.env.FORZA_STT_PYTHON || '/opt/forza-pocket/bin/python';
const WORKER_COUNT = Math.max(1, Math.min(2, Number(process.env.FORZA_STT_WORKERS || 2) || 2));
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_PENDING = 24;
let workers: WorkerState[] = [];
let warmPromise: Promise<boolean> | null = null;

export function hasForzaDibaSttModel(): boolean {
  return existsSync(path.join(MODEL_PATH, 'am')) && existsSync(path.join(MODEL_PATH, 'conf'));
}
export function isForzaDibaSttReady(): boolean {
  return workers.some(worker => worker.ready && !worker.failed && worker.child.exitCode === null);
}

function failWorker(worker: WorkerState, reason: string): void {
  if (worker.failed) return;
  worker.failed = true;
  worker.ready = false;
  for (const pending of worker.pending.values()) {
    clearTimeout(pending.timer);
    pending.reject(new Error(reason));
  }
  worker.pending.clear();
  worker.inflight = 0;
}

function startWorker(): WorkerState {
  const child = spawn(PYTHON, [WORKER_SCRIPT], {
    cwd: process.cwd(),
    env: { ...process.env, FORZA_STT_DIBA_MODEL_PATH: MODEL_PATH },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const state: WorkerState = {
    child, ready: false, failed: false, inflight: 0,
    pending: new Map(),
    readyPromise: Promise.resolve(),
  };
  state.readyPromise = new Promise<void>((resolve, reject) => {
    const readyTimer = setTimeout(() => {
      failWorker(state, 'diba_worker_start_timeout');
      reject(new Error('diba_worker_start_timeout'));
    }, 20_000);
    const lines = createInterface({ input: child.stdout });
    lines.on('line', line => {
      let message: any;
      try { message = JSON.parse(line); } catch { return; }
      if (message?.type === 'ready') {
        state.ready = true;
        clearTimeout(readyTimer);
        resolve();
        return;
      }
      if (message?.type === 'fatal') {
        clearTimeout(readyTimer);
        failWorker(state, String(message.code || 'diba_worker_failed'));
        reject(new Error(String(message.code || 'diba_worker_failed')));
        return;
      }
      const id = String(message?.id || '');
      const pending = state.pending.get(id);
      if (!pending) return;
      state.pending.delete(id);
      state.inflight = Math.max(0, state.inflight - 1);
      clearTimeout(pending.timer);
      if (pending.abort) pending.signal?.removeEventListener('abort', pending.abort);
      if (message?.ok === true) pending.resolve(String(message.text || '').trim());
      else pending.reject(new Error(String(message?.code || 'diba_transcription_failed')));
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
    });
    // Worker diagnostics must never echo audio, transcript or request JSON.
    child.stderr.on('data', () => {});
  });
  return state;
}

export async function warmForzaDibaStt(): Promise<boolean> {
  if (!hasForzaDibaSttModel()) return false;
  if (isForzaDibaSttReady()) return true;
  if (warmPromise) return warmPromise;
  warmPromise = (async () => {
    workers = workers.filter(worker => !worker.failed && worker.child.exitCode === null);
    while (workers.length < WORKER_COUNT) workers.push(startWorker());
    const results = await Promise.allSettled(workers.map(worker => worker.readyPromise));
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
  const available = workers.filter(worker => worker.ready && !worker.failed && worker.child.exitCode === null);
  if (!available.length) throw new Error('diba_worker_unavailable');
  const totalPending = available.reduce((sum, worker) => sum + worker.inflight, 0);
  if (totalPending >= MAX_PENDING) throw new Error('diba_stt_busy');
  const worker = available.sort((a, b) => a.inflight - b.inflight)[0];
  const id = randomUUID();
  const timeoutMs = Math.max(1500, Math.min(20_000, options.timeoutMs ?? REQUEST_TIMEOUT_MS));

  return new Promise<string>((resolve, reject) => {
    const finish = (error?: Error, text = '') => {
      const pending = worker.pending.get(id);
      if (!pending) return;
      worker.pending.delete(id);
      worker.inflight = Math.max(0, worker.inflight - 1);
      clearTimeout(pending.timer);
      if (pending.abort) options.signal?.removeEventListener('abort', pending.abort);
      if (error) reject(error);
      else resolve(text);
    };
    const abort = () => finish(new Error('stt_aborted'));
    const timer = setTimeout(() => finish(new Error('diba_stt_timeout')), timeoutMs);
    worker.pending.set(id, {
      resolve: text => finish(undefined, text),
      reject: error => finish(error),
      timer,
      abort,
      signal: options.signal,
    } as Pending & { signal?: AbortSignal });
    worker.inflight++;
    if (options.signal) {
      options.signal.addEventListener('abort', abort, { once: true });
      if (options.signal.aborted) { abort(); return; }
    }
    try {
      worker.child.stdin.write(JSON.stringify({ id, audioBase64: encoded }) + '\n', error => {
        if (error) finish(new Error('diba_worker_write_failed'));
      });
    } catch {
      finish(new Error('diba_worker_write_failed'));
    }
  });
}
