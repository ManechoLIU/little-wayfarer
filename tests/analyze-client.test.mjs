import test from 'node:test';
import assert from 'node:assert/strict';
import * as client from '../src/analyze-client.js';
const own={baseURL:'https://api.deepseek.com',model:'deepseek-flash',apiKey:'visitor-key'};
test('personal requests send only the visitor config and never attach the site access code', async()=>{
 let captured;
 const result=await client.requestRecordAnalysis?.('难过',{personalModel:own,accessCode:'owner-code',fetch:async(url,options)=>{captured={url,options};return {ok:true,status:200,json:async()=>({mood:2,evidence:'难过'})};}});
 assert.deepEqual(result,{mood:2,evidence:'难过'});
 assert.deepEqual(JSON.parse(captured.options.body),{text:'难过',personalModel:own});
 assert.equal(captured.options.headers['x-ai-access-code'],undefined);
 assert.equal(captured.url,'/api/analyze');
});
test('personal failures never open the shared access dialog or retry with the owner account',async()=>{
 let calls=0,accessPrompts=0,error;
 try{await client.requestRecordAnalysis?.('难过',{personalModel:own,accessCode:'owner-code',onAccessRequired:()=>accessPrompts++,fetch:async()=>{calls++;return {ok:false,status:401,json:async()=>({error:'未授权'})};}});}catch(e){error=e;}
 assert.equal(calls,1);assert.equal(accessPrompts,0);assert.match(error?.message||'',/自己的模型/);
});
test('shared requests retain their access-code flow',async()=>{
 let prompt=0,headers,error;
 try{await client.requestRecordAnalysis?.('难过',{accessCode:'owner-code',onAccessRequired:()=>prompt++,fetch:async(url,options)=>{headers=options.headers;return {ok:false,status:401,json:async()=>({error:'未授权'})};}});}catch(e){error=e;}
 assert.equal(headers?.['x-ai-access-code'],'owner-code');assert.equal(prompt,1);assert.ok(error);
});
