export interface ForzaQueueWorker {
  busy: boolean;
}

interface ForzaQueueJob<T, R> {
  payload: T;
  resolve: (value: R) => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  abort?: () => void;
  queueTimer: ReturnType<typeof setTimeout> | null;
  started: boolean;
  settled: boolean;
}

export interface ForzaSttQueueOptions<W extends ForzaQueueWorker> {
  maxPending: number;
  queueTimeoutMs: number;
  onNoWorkers?: () => void;
}

/**
 * A bounded FIFO queue that runs at most one job per available worker.
 *
 * An aborted active request rejects its caller immediately, but the worker
 * remains occupied until its actual job completes. This matters for persistent
 * line-oriented workers: aborting an HTTP request does not stop Python/Vosk
 * already processing the audio.
 */
export class ForzaSttQueue<T, R, W extends ForzaQueueWorker> {
  private readonly waiting: ForzaQueueJob<T, R>[] = [];
  private active = 0;
  private dispatching = false;

  constructor(
    private readonly getWorkers: () => W[],
    private readonly execute: (worker: W, payload: T) => Promise<R>,
    private readonly options: ForzaSttQueueOptions<W>,
  ) {}

  get pendingCount(): number {
    return this.active + this.waiting.length;
  }

  submit(payload: T, signal?: AbortSignal): Promise<R> {
    if (signal?.aborted) return Promise.reject(new Error('stt_aborted'));
    if (this.pendingCount >= Math.max(1, this.options.maxPending)) {
      return Promise.reject(new Error('diba_stt_busy'));
    }

    return new Promise<R>((resolve, reject) => {
      const job: ForzaQueueJob<T, R> = {
        payload,
        resolve,
        reject,
        signal,
        abort: undefined,
        queueTimer: null,
        started: false,
        settled: false,
      };

      const removeAbortListener = () => {
        if (job.abort) job.signal?.removeEventListener('abort', job.abort);
        job.abort = undefined;
      };

      const settle = (error?: Error, value?: R) => {
        if (job.settled) return;
        job.settled = true;
        if (job.queueTimer !== null) clearTimeout(job.queueTimer);
        job.queueTimer = null;
        removeAbortListener();
        if (error) reject(error);
        else resolve(value as R);
      };

      if (signal) {
        job.abort = () => {
          if (job.settled) return;
          if (!job.started) {
            const index = this.waiting.indexOf(job);
            if (index >= 0) this.waiting.splice(index, 1);
          }
          // If already running, do not release the worker slot here. The
          // persistent worker still owns this job until its response arrives.
          settle(new Error('stt_aborted'));
          if (!job.started) this.dispatch();
        };
        signal.addEventListener('abort', job.abort, { once: true });
        if (signal.aborted) {
          job.abort();
          return;
        }
      }

      job.queueTimer = setTimeout(() => {
        if (job.started || job.settled) return;
        const index = this.waiting.indexOf(job);
        if (index >= 0) this.waiting.splice(index, 1);
        settle(new Error('diba_stt_queue_timeout'));
        this.dispatch();
      }, Math.max(1000, this.options.queueTimeoutMs));

      this.waiting.push(job);
      this.dispatch();
    });
  }

  /** Call after a worker becomes ready or exits. */
  notifyWorkersChanged(): void {
    this.dispatch();
  }

  private dispatch(): void {
    if (this.dispatching) return;
    this.dispatching = true;
    try {
      while (this.waiting.length) {
        const workers = this.getWorkers();
        const worker = workers.find(candidate => !candidate.busy);
        if (!worker) {
          if (workers.length === 0) this.options.onNoWorkers?.();
          break;
        }

        const job = this.waiting.shift()!;
        if (job.settled) continue;
        job.started = true;
        if (job.queueTimer !== null) clearTimeout(job.queueTimer);
        job.queueTimer = null;
        worker.busy = true;
        this.active += 1;

        void Promise.resolve()
          .then(() => this.execute(worker, job.payload))
          .then(value => {
            if (!job.settled) {
              job.settled = true;
              if (job.signal && job.abort) job.signal.removeEventListener('abort', job.abort);
              job.abort = undefined;
              job.resolve(value);
            }
          }, error => {
            if (!job.settled) {
              job.settled = true;
              if (job.signal && job.abort) job.signal.removeEventListener('abort', job.abort);
              job.abort = undefined;
              job.reject(error instanceof Error ? error : new Error('diba_worker_failed'));
            }
          })
          .finally(() => {
            worker.busy = false;
            this.active = Math.max(0, this.active - 1);
            this.dispatch();
          });
      }
    } finally {
      this.dispatching = false;
    }
  }
}
