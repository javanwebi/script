import test from 'node:test';
import assert from 'node:assert/strict';
import {buildForzaConversationHistory} from '../server/ai/baiConsult';
test('preserves original need, interruption and latest correction beyond six messages',()=>{
 const history=[{role:'user',text:'بلبرینگ برای موتور خط تولید میخواهم'},...Array.from({length:8},(_,i)=>({role:i%2?'user':'model',text:'جزئیات '+i})),{role:'model',text:'[پاسخ قطع شد]'}, {role:'user',text:'نه منظورم 6203ZZ بود'}];
 const result=buildForzaConversationHistory(history);
 assert.equal(result[0].content,history[0].text);
 assert.equal(result.at(-1)?.content,'نه منظورم 6203ZZ بود');
 assert.equal(result.at(-2)?.role,'assistant');
});
test('bounds context and retains newest messages without mutating original history',()=>{
 const history=Array.from({length:30},()=>({role:'user',text:'x'.repeat(3000)}));
 const result=buildForzaConversationHistory(history);
 assert.equal(result.length,4);assert.equal(history.length,30);
 assert.equal(result.reduce((n,m)=>n+m.content.length,0),12000);
 assert.deepEqual(buildForzaConversationHistory([{text:''},{sender:'user',text:'سلام'}]),[{role:'user',content:'سلام'}]);
});
