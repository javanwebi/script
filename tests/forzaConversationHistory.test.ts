import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FORZA_CONVERSATION_HISTORY_LIMIT,
  prepareForzaConversationTurn,
} from '../src/utils/forzaConversationHistory';

test('the current customer utterance is appended once and never duplicated in prior history',()=>{
  const history=[
    {role:'user' as const,text:'برای خط بسته‌بندی تسمه می‌خواهم'},
    {role:'model' as const,text:'عرض و طول تسمه را دارید؟'},
  ];
  const query='عرض ۲۰ میلی‌متر و طول ۱۲۵۰';
  const {previousHistory,nextHistory}=prepareForzaConversationTurn(history,query);
  assert.deepEqual(previousHistory,history);
  assert.equal(previousHistory.some(item=>item.text===query),false);
  assert.equal(nextHistory.filter(item=>item.role==='user'&&item.text===query).length,1);
  assert.equal(history.length,2,'the caller-owned history must not be mutated');
});

test('the rolling window keeps six exchanges rather than only three',()=>{
  const history=Array.from({length:20},(_,index)=>({
    role:index%2===0?'user' as const:'model' as const,
    text:'turn-'+index,
  }));
  const {previousHistory,nextHistory}=prepareForzaConversationTurn(history,'قیمتش چنده');
  assert.equal(FORZA_CONVERSATION_HISTORY_LIMIT,12);
  assert.deepEqual(previousHistory.map(item=>item.text),
    Array.from({length:12},(_,index)=>'turn-'+(index+8)));
  assert.equal(nextHistory.length,13);
  assert.equal(nextHistory.at(-1)?.text,'قیمتش چنده');
});

test('repeated identical customer utterances remain separate turns',()=>{
  const first=prepareForzaConversationTurn([],'سلام');
  const second=prepareForzaConversationTurn(first.nextHistory,'سلام');
  assert.equal(second.previousHistory.length,1);
  assert.deepEqual(second.nextHistory.map(item=>item.text),['سلام','سلام']);
});

test('invalid or empty messages are excluded and a zero limit means no history',()=>{
  const history=[
    {role:'user' as const,text:'  '},
    {role:'model' as const,text:'سلام'},
  ];
  assert.deepEqual(prepareForzaConversationTurn(history,'سؤال',0),{
    previousHistory:[],
    nextHistory:[{role:'user',text:'سؤال'}],
  });
});
