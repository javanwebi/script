/**
 * Order private Nima CPU inference by (network address, call turn, phrase index).
 *
 * Browser HTTP requests can overtake one another. WAV playback already queues
 * in source order, but without this gate phrase 1 may seize Piper's single CPU
 * while phrase 0 waits: exactly the priority inversion seen in FORZA traces.
 *
 * One in-flight phrase per turn, bounded lookahead and bounded waiting.
 * Other customers remain independent; the worker's existing FIFO arbitrates
 * across customers. No audio, transcripts, API tokens, or customer identifiers
 * are written to disk or application logs.
 */
type Pending = {
  index: number;
  run: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  signal: AbortSignal;
  timer: ReturnType<typeof setTimeout>;
  onAbort: () => void;
};
type TurnState = {
  next: number;
  busy: boolean;
  pending: Map<number, Pending>;
  touched: number;
  failed: boolean;
};

export class ForzaTtsTurnOrder {
  private readonly turns = new Map<string, TurnState>();

  constructor(
    private readonly maxWaitMs = 18_000,
    private readonly maxTurns = 512,
    private readonly maxQueuedPerTurn = 4,
  ) {}

  private rejectPending(state: TurnState, task: Pending, code: string) {
    if (state.pending.get(task.index) !== task) return;
    state.pending.delete(task.index);
    clearTimeout(task.timer);
    task.signal.removeEventListener('abort', task.onAbort);
    task.reject(new Error(code));
  }

  private pump(state: TurnState): void {
    if (state.busy || state.failed) return;
    const task = state.pending.get(state.next);
    if (!task) return;
    state.pending.delete(state.next);
    clearTimeout(task.timer);
    state.busy = true;
    void Promise.resolve()
      .then(() => {
        if (task.signal.aborted) throw new Error('forza_tts_turn_aborted');
        return task.run();
      })
      .then(value => task.resolve(value), cause => {
        const error = cause instanceof Error ? cause : new Error('forza_tts_turn_failed');
        state.failed = true;
        task.reject(error);
        for (const queued of [...state.pending.values()])
          this.rejectPending(state, queued, 'forza_tts_preceding_phrase_failed');
      })
      .finally(() => {
        task.signal.removeEventListener('abort', task.onAbort);
        state.busy = false;
        state.next++;
        state.touched = performance.now();
        this.pump(state);
      });
  }

  execute<T>(key: string, index: number, signal: AbortSignal,
             run: () => Promise<T>): Promise<T> {
    if (!key || key.length > 160 || !Number.isInteger(index) || index < 0 || index >= 12)
      return Promise.reject(new Error('forza_tts_invalid_phrase_order'));
    if (signal.aborted) return Promise.reject(new Error('forza_tts_turn_aborted'));
    const now = performance.now();
    // Completed turn state is retained briefly to reject duplicate phrase
    // indices, then discarded. Only opaque network/turn keys are retained.
    for (const [turn, item] of this.turns) {
      if (!item.busy && !item.pending.size && now - item.touched > 120_000)
        this.turns.delete(turn);
    }
    let state = this.turns.get(key);
    if (!state) {
      if (this.turns.size >= this.maxTurns)
        return Promise.reject(new Error('forza_tts_too_many_turns'));
      state = {next: 0, busy: false, pending: new Map(), touched: now, failed: false};
      this.turns.set(key, state);
    }
    if (state.failed || index < state.next || state.pending.has(index) ||
        (state.busy && index === state.next) ||
        // Reserve the predecessor's entry even when later HTTP requests
        // filled the lookahead. Otherwise index 1/2 can deadlock index 0.
        (state.pending.size >= this.maxQueuedPerTurn &&
         (state.busy || index !== state.next)))
      return Promise.reject(new Error('forza_tts_duplicate_or_full_phrase'));
    const pendingState = state;
    return new Promise<T>((resolve, reject) => {
      const task: Pending = {
        index,
        run,
        resolve: value => resolve(value as T),
        reject,
        signal,
        timer: undefined as unknown as ReturnType<typeof setTimeout>,
        onAbort: () => this.rejectPending(pendingState, task, 'forza_tts_turn_aborted'),
      };
      task.timer = setTimeout(() =>
        this.rejectPending(pendingState, task, 'forza_tts_phrase_order_timeout'), this.maxWaitMs);
      signal.addEventListener('abort', task.onAbort, {once: true});
      pendingState.pending.set(index, task);
      pendingState.touched = performance.now();
      this.pump(pendingState);
    });
  }

  get counters(): {turns: number; pending: number} {
    let pending = 0;
    for (const turn of this.turns.values()) pending += turn.pending.size;
    return {turns:this.turns.size,pending};
  }
}
