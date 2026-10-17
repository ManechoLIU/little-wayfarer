import test from 'node:test';
import assert from 'node:assert/strict';
import {writeJournal,verifySyncCursor,verifyCardReplay} from '../src/integrity.js';
test('quota failure never returns a saved journal',()=>{
 const storage={getItem:()=>null,setItem:()=>{throw Error('QuotaExceededError')}};
 assert.throws(()=>writeJournal(storage,'key',{chapter:1},null),/未能保存/);
});
test('stale tab refuses to overwrite newer journal',()=>{
 let writes=0;const storage={getItem:()=>'{"chapter":2}',setItem:()=>writes++};
 assert.throws(()=>writeJournal(storage,'key',{chapter:1},'{"chapter":0}'),/另一页/);assert.equal(writes,0);
});
test('only own confirmed cursor permits subsequent sync',()=>{
 assert.throws(()=>verifySyncCursor(1,1,0),/另一页/);
 assert.throws(()=>verifySyncCursor(2,1,1),/比本机更新/);
 assert.doesNotThrow(()=>verifySyncCursor(1,2,1));
});

test('replacement card refuses incomplete history before any new birth transaction',()=>{
 assert.throws(()=>verifyCardReplay({chapter:101,memories:Array.from({length:100},(_,i)=>({chapter:i+2}))}),/完整/);
 assert.throws(()=>verifyCardReplay({chapter:2,memories:[{chapter:2}]}),/完整/);
 assert.doesNotThrow(()=>verifyCardReplay({chapter:0,memories:[]}));
 assert.doesNotThrow(()=>verifyCardReplay({chapter:2,memories:[{chapter:1},{chapter:2}]}));
});
