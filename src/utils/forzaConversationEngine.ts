/**
 * FORZA v2 conversation coordinator.
 *
 * This module owns only conversation/session truth. Audio capture, VAD, STT,
 * LLM transport and TTS remain adapters around it. It deliberately has no
 * browser or provider dependency, so its race and interruption semantics can
 * be tested deterministically.
 */
export type ForzaConversationRole = 'user' | 'assistant';
export type ForzaConversationPhase =
  | 'idle'
  | 'listening'
  | 'user_speaking'
  | 'turn_ready'
  | 'thinking'
  | 'speaking'
  | 'closed';

export interface ForzaConversationTurn {
  id: string;
  role: ForzaConversationRole;
  text: string;
  createdAt: number;
  interrupted?: boolean;
}

export interface ForzaResponseLease {
  generation: number;
  signal: AbortSignal;
}

export interface ForzaConversationSnapshot {
  sessionId: string;
  phase: ForzaConversationPhase;
  generation: number;
  activeTranscript: string;
  turns: readonly ForzaConversationTurn[];
}

export interface ForzaConversationOptions {
  sessionId: string;
  maxTurns?: number;
  now?: () => number;
  makeId?: () => string;
}

function normalize(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

/** Merge cumulative STT snapshots without duplicating words at segment edges. */
export function mergeForzaTranscript(previousValue: string, incomingValue: string): string {
  const previous = normalize(previousValue);
  const incoming = normalize(incomingValue);
  if (!previous) return incoming;
  if (!incoming) return previous;
  if (incoming === previous || previous.endsWith(incoming)) return previous;
  if (incoming.startsWith(previous)) return incoming;

  const left = previous.split(' ');
  const right = incoming.split(' ');
  const max = Math.min(left.length, right.length, 32);
  for (let size = max; size > 0; size -= 1) {
    const suffix = left.slice(-size).join(' ');
    const prefix = right.slice(0, size).join(' ');
    if (suffix === prefix) return [...left, ...right.slice(size)].join(' ');
  }
  return previous + ' ' + incoming;
}

export class ForzaConversationEngine {
  private phaseValue: ForzaConversationPhase = 'idle';
  private generationValue = 0;
  private activeTranscriptValue = '';
  private turnsValue: ForzaConversationTurn[] = [];
  private responseAbort: AbortController | null = null;
  private readonly maxTurns: number;
  private readonly now: () => number;
  private readonly makeId: () => string;

  readonly sessionId: string;

  constructor(options: ForzaConversationOptions) {
    this.sessionId = normalize(options.sessionId);
    if (!this.sessionId) throw new Error('forza_session_id_required');
    this.maxTurns = Math.max(2, Math.min(200, options.maxTurns ?? 40));
    this.now = options.now ?? Date.now;
    this.makeId = options.makeId ?? (() => `turn-${this.generationValue + 1}-${this.now()}`);
  }

  get phase(): ForzaConversationPhase { return this.phaseValue; }
  get generation(): number { return this.generationValue; }
  get activeTranscript(): string { return this.activeTranscriptValue; }
  get turns(): readonly ForzaConversationTurn[] { return this.turnsValue; }

  snapshot(): ForzaConversationSnapshot {
    return {
      sessionId: this.sessionId,
      phase: this.phaseValue,
      generation: this.generationValue,
      activeTranscript: this.activeTranscriptValue,
      turns: this.turnsValue.map(turn => ({ ...turn })),
    };
  }

  startListening(): void {
    this.assertOpen();
    if (this.phaseValue === 'thinking' || this.phaseValue === 'speaking') return;
    this.phaseValue = this.activeTranscriptValue ? 'user_speaking' : 'listening';
  }

  /** Feed a recognizer's cumulative partial/final transcript for this utterance. */
  updateTranscript(value: string): string {
    this.assertOpen();
    const next = mergeForzaTranscript(this.activeTranscriptValue, value);
    if (next) {
      this.activeTranscriptValue = next;
      if (this.phaseValue !== 'thinking') this.phaseValue = 'user_speaking';
    }
    return this.activeTranscriptValue;
  }

  /** Commit only after the external VAD/turn policy confirms end-of-turn. */
  commitUserTurn(value?: string): ForzaConversationTurn | null {
    this.assertOpen();
    // At the turn boundary the caller passes the best complete transcript
    // available (often a final STT hypothesis). Treat it as authoritative:
    // merging a corrected final with an older interim can duplicate/reorder words.
    if (value !== undefined) this.activeTranscriptValue = normalize(value);
    const text = normalize(this.activeTranscriptValue);
    if (!text) return null;
    const turn: ForzaConversationTurn = {
      id: this.makeId(),
      role: 'user',
      text,
      createdAt: this.now(),
    };
    this.pushTurn(turn);
    this.activeTranscriptValue = '';
    this.phaseValue = 'turn_ready';
    return { ...turn };
  }

  /** Replace a committed user hypothesis with a later authoritative STT final. */
  replaceLastUserTurn(previousText: string, correctedText: string): boolean {
    this.assertOpen();
    const last = this.turnsValue[this.turnsValue.length - 1];
    const previous = normalize(previousText);
    const corrected = normalize(correctedText);
    if (!last || last.role !== 'user' || last.text !== previous || !corrected) return false;
    last.text = corrected;
    return true;
  }

  /** Abort the current model/TTS generation without discarding the user transcript. */
  cancelAssistantResponse(reason = 'cancelled'): boolean {
    if (this.phaseValue === 'closed' || !this.responseAbort) return false;
    this.abortResponse(reason);
    this.generationValue += 1;
    this.phaseValue = this.activeTranscriptValue ? 'user_speaking' : 'listening';
    return true;
  }

  /** Start one assistant generation. A newer generation invalidates all older callbacks. */
  beginAssistantResponse(): ForzaResponseLease {
    this.assertOpen();
    if (this.phaseValue !== 'turn_ready' && this.phaseValue !== 'thinking') {
      throw new Error('forza_user_turn_not_committed');
    }
    this.abortResponse('superseded');
    const controller = new AbortController();
    this.responseAbort = controller;
    this.generationValue += 1;
    this.phaseValue = 'thinking';
    return { generation: this.generationValue, signal: controller.signal };
  }

  markSpeaking(generation: number): boolean {
    if (!this.isCurrent(generation) || this.phaseValue === 'closed') return false;
    this.phaseValue = 'speaking';
    return true;
  }

  /** Append assistant text only if it belongs to the current live generation. */
  appendAssistantText(generation: number, delta: string): boolean {
    if (!this.isCurrent(generation) || this.phaseValue === 'closed') return false;
    // Stream deltas are byte-for-byte text fragments. Do not trim or insert
    // spaces: providers may split a word, punctuation or whitespace at any
    // token boundary.
    if (!String(delta || '').length) return true;
    const last = this.turnsValue[this.turnsValue.length - 1];
    if (last?.role === 'assistant' && last.id === `assistant-${generation}`) {
      last.text += delta;
    } else {
      this.pushTurn({
        id: `assistant-${generation}`,
        role: 'assistant',
        text: delta,
        createdAt: this.now(),
      });
    }
    return true;
  }

  /** Finish only the response that still owns the current generation. */
  completeAssistantResponse(generation: number): boolean {
    if (!this.isCurrent(generation) || this.phaseValue === 'closed') return false;
    this.responseAbort = null;
    this.generationValue += 1;
    this.phaseValue = 'listening';
    return true;
  }

  /**
   * A verified user transcript is the barge-in signal. Acoustic VAD alone must
   * not call this method; it can be noisy and can contain speaker echo.
   */
  interruptWithSpeech(value: string): boolean {
    this.assertOpen();
    const text = normalize(value);
    if (!text) return false;
    if (this.phaseValue === 'thinking' || this.phaseValue === 'speaking') {
      this.cancelAssistantResponse('user_barge_in');
    }
    this.activeTranscriptValue = mergeForzaTranscript(this.activeTranscriptValue, text);
    this.phaseValue = 'user_speaking';
    return true;
  }

  close(): void {
    if (this.phaseValue === 'closed') return;
    this.abortResponse('call_closed');
    this.generationValue += 1;
    this.activeTranscriptValue = '';
    this.phaseValue = 'closed';
  }

  private isCurrent(generation: number): boolean {
    return generation === this.generationValue && !this.responseAbort?.signal.aborted;
  }

  private abortResponse(reason: string): void {
    if (!this.responseAbort || this.responseAbort.signal.aborted) return;
    this.responseAbort.abort(new Error(reason));
    this.responseAbort = null;
  }

  private pushTurn(turn: ForzaConversationTurn): void {
    this.turnsValue.push(turn);
    if (this.turnsValue.length > this.maxTurns) {
      this.turnsValue.splice(0, this.turnsValue.length - this.maxTurns);
    }
  }

  private assertOpen(): void {
    if (this.phaseValue === 'closed') throw new Error('forza_call_closed');
  }
}
