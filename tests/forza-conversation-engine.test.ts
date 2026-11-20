import test from 'node:test';
import assert from 'node:assert/strict';
import { ForzaConversationEngine, mergeForzaTranscript } from '../src/utils/forzaConversationEngine';

test('merges cumulative and overlapping STT segments without dropping earlier words', () => {
  assert.equal(mergeForzaTranscript('من یک تسمه', 'من یک تسمه تایمینگ'), 'من یک تسمه تایمینگ');
  assert.equal(mergeForzaTranscript('تسمه تایمینگ صنعتی', 'تایمینگ صنعتی عرض بیست'), 'تسمه تایمینگ صنعتی عرض بیست');
  assert.equal(mergeForzaTranscript('من یک تسمه', 'تسمه تایمینگ'), 'من یک تسمه تایمینگ');
});

test('keeps a long utterance intact across partial updates and a pause', () => {
  const engine = new ForzaConversationEngine({ sessionId: 'call-1' });
  engine.startListening();
  engine.updateTranscript('من برای خط تولید');
  engine.updateTranscript('من برای خط تولید یک تسمه تایمینگ');
  engine.updateTranscript('یک تسمه تایمینگ با عرض بیست میلی متر');
  const committed = engine.commitUserTurn();
  assert.equal(committed?.text, 'من برای خط تولید یک تسمه تایمینگ با عرض بیست میلی متر');
  assert.equal(engine.activeTranscript, '');
  assert.equal(engine.turns.length, 1);
});

test('a verified barge-in aborts the previous response and invalidates stale callbacks', () => {
  const engine = new ForzaConversationEngine({ sessionId: 'call-2' });
  engine.updateTranscript('قیمت این قطعه چقدر است');
  engine.commitUserTurn();
  const lease = engine.beginAssistantResponse();
  assert.equal(engine.markSpeaking(lease.generation), true);
  assert.equal(engine.interruptWithSpeech('البته تعداد ده عدد می خواهم'), true);
  assert.equal(lease.signal.aborted, true);
  assert.equal(engine.appendAssistantText(lease.generation, 'پاسخ قدیمی'), false);
  assert.equal(engine.phase, 'user_speaking');
});

test('old response completion cannot move a newer user turn into listening', () => {
  const engine = new ForzaConversationEngine({ sessionId: 'call-3' });
  engine.updateTranscript('سؤال اول');
  engine.commitUserTurn();
  const lease = engine.beginAssistantResponse();
  engine.interruptWithSpeech('اصلاح می کنم سؤال دوم');
  assert.equal(engine.completeAssistantResponse(lease.generation), false);
  assert.equal(engine.phase, 'user_speaking');
});

test('close aborts the response and rejects later mutations', () => {
  const engine = new ForzaConversationEngine({ sessionId: 'call-4' });
  engine.updateTranscript('سلام');
  engine.commitUserTurn();
  const lease = engine.beginAssistantResponse();
  engine.close();
  assert.equal(lease.signal.aborted, true);
  assert.throws(() => engine.updateTranscript('بعد از پایان'), /forza_call_closed/);
});

test('assistant streaming preserves exact token boundaries without inserting spaces', () => {
  const engine = new ForzaConversationEngine({ sessionId: 'call-5' });
  engine.updateTranscript('سؤال');
  engine.commitUserTurn();
  const lease = engine.beginAssistantResponse();
  engine.appendAssistantText(lease.generation, 'پاس');
  engine.appendAssistantText(lease.generation, 'خ');
  engine.appendAssistantText(lease.generation, ' نهایی.');
  assert.equal(engine.turns.at(-1)?.text, 'پاسخ نهایی.');
});
