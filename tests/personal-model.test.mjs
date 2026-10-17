import test from 'node:test';
import assert from 'node:assert/strict';
import * as settings from '../src/personal-model.js';
import { createHandler } from '../api/analyze.mjs';
const own = { baseURL: 'https://api.deepseek.com', model: 'deepseek-flash', apiKey: 'personal-test-key' };
const env = { AI_BASE_URL: 'https://shared.example.test', AI_MODEL: 'shared-model', AI_API_KEY: 'owner-test-key', AI_ACCESS_CODE: 'private-code', AI_MAX_REQUESTS: '1' };
function req(personalModel, extra = {}) { return { method:'POST', headers:{host:'example.test',origin:'https://example.test','x-forwarded-for':'test-ip',...extra}, body:{text:'今天难过',personalModel} }; }
function res() { return {statusCode:0,setHeader(){},end(body){this.body=body;}}; }
function upstream(calls) { return async (url, options) => { calls.push({url,options});return {ok:true,status:200,json:async()=>({choices:[{message:{content:'{"mood":2,"evidence":"难过"}'}}]})}; }; }

test('personal endpoints normalize only verified HTTPS provider addresses', () => {
  assert.deepEqual(settings.normalizePersonalModel?.({...own,baseURL:'https://api.deepseek.com/v1/chat/completions/'}), {...own,baseURL:'https://api.deepseek.com/v1'});
  assert.deepEqual(settings.normalizePersonalModel?.({...own,baseURL:'https://api.siliconflow.cn/v1'}), {...own,baseURL:'https://api.siliconflow.cn/v1'});
});

test('personal mode uses only the visitor key without the site access code', async () => {
  const calls=[],handler=createHandler({env,fetch:upstream(calls)}),result=res();
  await handler(req(own),result);
  assert.equal(result.statusCode,200);
  assert.equal(calls[0]?.options.headers.Authorization,'Bearer personal-test-key');
  assert.equal(calls[0]?.url,'https://api.deepseek.com/chat/completions');
  assert.equal(calls[0]?.options.redirect,'error');
  assert.equal(result.body.includes('test-key'),false);
});

test('personal mode works even when the site has no shared model credentials', async () => {
  const calls=[],result=res();await createHandler({env:{},fetch:upstream(calls)})(req(own),result);
  assert.equal(result.statusCode,200);
  assert.equal(calls.length,1);
});

test('unsafe destinations and invalid personal keys fail before any upstream or owner fallback', async () => {
  for(const change of [{baseURL:'http://api.deepseek.com'}, {baseURL:'https://localhost'}, {baseURL:'https://127.0.0.1'}, {baseURL:'https://169.254.169.254'}, {baseURL:'https://api.deepseek.com.evil.test'}, {baseURL:'https://api.deepseek.com@evil.test'}, {baseURL:'https://api.deepseek.com:8443'}, {baseURL:'https://api.deepseek.com/redirect?to=http://localhost'}, {apiKey:''}, {apiKey:'bad\nAuthorization: secret'}, {model:''}, {extra:'owner-fallback'}]) {
    const calls=[],result=res();await createHandler({env,fetch:upstream(calls)})(req({...own,...change},{'x-ai-access-code':'private-code'}),result);
    assert.equal(result.statusCode,400);assert.equal(calls.length,0);
  }
});

test('personal usage cannot consume the owners process allowance', async () => {
  const calls=[],handler=createHandler({env,fetch:upstream(calls)}),personal=res();await handler(req(own),personal);assert.equal(personal.statusCode,200);
  const shared=req(undefined,{'x-ai-access-code':'private-code'});shared.body={text:'今天难过'};
  const result=res();await handler(shared,result);assert.equal(result.statusCode,200);
  assert.equal(calls.at(-1).options.headers.Authorization,'Bearer owner-test-key');
});

test('a personal upstream error never falls back to the owner key', async () => {
  const calls=[],result=res();await createHandler({env,fetch:async(url,options)=>{calls.push(options);throw Error('personal-test-key');}})(req(own),result);
  assert.equal(result.statusCode,502);assert.equal(calls.length,1);assert.equal(result.body.includes('test-key'),false);
});
