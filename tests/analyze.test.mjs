import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../api/analyze.mjs';

function response() { return { statusCode: 0, headers: {}, body: undefined, setHeader(name, value) { this.headers[name] = value; }, end(value) { this.body = value; } }; }
function request({ method = 'POST', text, origin, headers = {}, ip = '127.0.0.1' } = {}) { return { method, body: text === undefined ? undefined : { text }, headers: { host: 'example.test', 'x-ai-access-code': 'demo-code', ...(origin ? { origin } : {}), 'x-forwarded-for': ip, ...headers } }; }
function json(res) { return JSON.parse(res.body); }
const configured = { AI_API_KEY: 'secret-key', AI_BASE_URL: 'https://ai.example.test/v1', AI_MODEL: 'demo-model', AI_PROVIDER: 'Demo', AI_ACCESS_CODE: 'demo-code' };
function fakeFetch(payload, calls = [], behavior = {}) { return async (url, options) => { calls.push({ url, options }); if (behavior.reject) throw new Error('upstream private failure'); if (behavior.never) return new Promise(() => {}); return { ok: behavior.ok ?? true, status: behavior.status ?? 200, async json() { return payload; } }; }; }

test('GET reports availability without exposing credentials or calling model', async () => {
  let called = false; const handler = createHandler({ env: configured, fetch: async () => { called = true; } }); const res = response();
  await handler(request({ method: 'GET' }), res); assert.equal(res.statusCode, 200); assert.deepEqual(json(res), { available: true, provider: 'Demo', model: 'demo-model' }); assert.equal(called, false); assert.equal(res.body.includes('secret'), false);
});

test('POST without AI configuration returns 503 and does not call fetch', async () => {
  let called = false; const handler = createHandler({ env: {}, fetch: async () => { called = true; } }); const res = response();
  await handler(request({ text: '想记录今天' }), res); assert.equal(res.statusCode, 503); assert.equal(called, false); assert.match(json(res).error, /未配置/);
});

test('a paid-key configuration without an access code stays unavailable and never calls upstream', async () => {
  const env = { AI_API_KEY: 'secret-key', AI_BASE_URL: 'https://ai.example.test/v1', AI_MODEL: 'demo-model' };
  let called = false; const handler = createHandler({ env, fetch: async () => { called = true; } });
  const get = response(); await handler(request({ method: 'GET' }), get); assert.equal(get.statusCode, 200); assert.equal(json(get).available, false);
  const post = response(); await handler(request({ text: 'ok' }), post); assert.equal(post.statusCode, 503); assert.equal(called, false);
});

test('POST enforces JSON text, same-origin policy, and byte limit', async () => {
  const handler = createHandler({ env: configured, fetch: fakeFetch({}) });
  for (const req of [request({ text: '' }), request({ text: ' '.repeat(2) }), request({ text: 'x'.repeat(4001) }), request({ text: 'ok', origin: 'https://evil.test' }), request({ text: 'x'.repeat(24001) })]) { const res = response(); await handler({ ...req, headers: { ...req.headers, 'x-ai-access-code': 'demo-code' } }, res); assert.ok([400, 403].includes(res.statusCode)); }
  const invalidJson = response(); await handler({ method: 'POST', headers: { host: 'example.test', 'content-type': 'application/json', 'x-ai-access-code': 'demo-code' }, body: '{"text":' }, invalidJson); assert.equal(invalidJson.statusCode, 400);
});

test('valid POST returns a semantic face and keeps authorization server-side', async () => {
  const calls = [], text = '今天有点难过';
  const payload = { choices: [{ message: { content: JSON.stringify({ mood: 2, evidence: '难过' }) } }] };
  const handler = createHandler({ env: configured, fetch: fakeFetch(payload, calls) });
  const res = response(); await handler(request({ text, origin: 'https://example.test' }), res);
  assert.equal(res.statusCode, 200); assert.deepEqual(json(res), { mood: 2, evidence: '难过' });
  assert.equal(calls[0].url, 'https://ai.example.test/v1/chat/completions');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret-key');
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.ok(body.max_tokens <= 250);
  assert.equal(body.messages[1].content.includes(text), true);
  assert.equal(res.body.includes('secret-key'), false);
});

test('hallucinated evidence and injected model fields are rejected without keyword fallback', async () => {
  for (const result of [{ mood: 2, evidence: '原文没有' }, { mood: 8, evidence: 'ok' }, { mood: 2, evidence: 'ok', html: 'bad' }, { mood: null, evidence: 'ok' }]) {
    const handler = createHandler({ env: configured, fetch: fakeFetch({ choices: [{ message: { content: JSON.stringify(result) } }] }) });
    const res = response(); await handler(request({ text: 'ok' }), res); assert.equal(res.statusCode, 502);
  }
});

test('access code, per-IP rate limit, process cap, timeout and upstream errors are bounded', async () => {
  const env = { ...configured, AI_MAX_REQUESTS: '2' }; const payload = { choices: [{ message: { content: JSON.stringify({ mood: null, evidence: '' }) } }] }; const handler = createHandler({ env, timeoutMs: 5, fetch: fakeFetch(payload) });
  const unauthorized = response(); await handler(request({ text: 'ok', headers: { 'x-ai-access-code': 'wrong' } }), unauthorized); assert.equal(unauthorized.statusCode, 401);
  for (let i = 0; i < 2; i += 1) { const res = response(); await handler(request({ text: 'ok', headers: { 'x-ai-access-code': 'demo-code' }, ip: '10.0.0.1' }), res); assert.equal(res.statusCode, 200); }
  const limited = response(); await handler(request({ text: 'ok', headers: { 'x-ai-access-code': 'demo-code' }, ip: '10.0.0.1' }), limited); assert.equal(limited.statusCode, 429);
  const timeoutHandler = createHandler({ env: configured, timeoutMs: 5, fetch: fakeFetch({}, [], { never: true }) }); const timed = response(); await timeoutHandler(request({ text: 'ok', headers: { 'x-ai-access-code': 'demo-code' } }), timed); assert.equal(timed.statusCode, 502); assert.equal(timed.body.includes('secret-key'), false);
  const failed = response(); await createHandler({ env: configured, fetch: fakeFetch({}, [], { reject: true }) })(request({ text: 'ok', headers: { 'x-ai-access-code': 'demo-code' } }), failed); assert.equal(failed.statusCode, 502); assert.equal(failed.body.includes('private'), false);
});

test('the model timeout also bounds reading the upstream response body', async () => {
  const handler = createHandler({ env: configured, timeoutMs: 5, fetch: async () => ({ ok: true, json: () => new Promise(() => {}) }) });
  const res = response();
  const outcome = await Promise.race([handler(request({ text: 'ok' }), res).then(() => 'returned'), new Promise(resolve => setTimeout(() => resolve('hung'), 40))]);
  assert.equal(outcome, 'returned');
  assert.equal(res.statusCode, 502);
});
