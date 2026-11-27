import test from 'node:test';
import assert from 'node:assert/strict';
import gw, { callWithFallback, modelChain, toDeepSeek } from '../ops/naviweb-agent/gateway/worker.js';

const req = () => ({ system: 's', messages: [{ role: 'user', content: [{ type: 'text', text: '일' }] }], tools: [{ name: 'read_page', description: 'd', input_schema: { type: 'object' } }] });
const env = (o) => ({ ANTHROPIC_API_KEY: 'a', DEEPSEEK_API_KEY: 'd', RETRY_DELAY_MS: 0, ...o });
const claudeOk = { content: [{ type: 'text', text: '클로드' }], stop_reason: 'end_turn', usage: {} };
const dsOk = { choices: [{ message: { content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'read_page', arguments: '{}' } }] } }] };
async function withFetch(script, fn) {
  const real = globalThis.fetch, calls = [];
  globalThis.fetch = async (url, o) => { const host = new URL(url).hostname, body = JSON.parse(o.body); calls.push({ host, model: body.model, body }); const [status, data] = script(host, body, calls.length); return new Response(typeof data === 'string' ? data : JSON.stringify(data), { status }); };
  try { return await fn(calls); } finally { globalThis.fetch = real; }
}

test('대체 모델은 키가 있을 때만 쓰고, 끌 수 있다', () => {
  assert.deepEqual(modelChain('claude', env()), ['claude', 'deepseek-flash', 'deepseek-pro']);
  assert.deepEqual(modelChain('claude', { ANTHROPIC_API_KEY: 'a' }), ['claude']);
  assert.deepEqual(modelChain('claude', env({ FALLBACKS: 'off' })), ['claude']);
});
test('일시 오류면 Claude 를 한 번 더 부른다', () => withFetch((h, b, n) => (n === 1 ? [529, { error: { message: 'Overloaded' } }] : [200, claudeOk]), async (calls) => {
  const r = await callWithFallback(req(), env(), 'claude');
  assert.equal(r.provider, 'claude'); assert.equal(calls.length, 2);
}));
test('Claude 가 계속 실패하면 Flash, 그다음 Pro 순서로 부른다', () => withFetch((h, b) => (h === 'api.anthropic.com' ? [529, '<html>over</html>'] : b.model === 'deepseek-flash' ? [503, { error: { message: 'busy' } }] : [200, dsOk]), async (calls) => {
  const r = await callWithFallback(req(), env(), 'claude');
  assert.equal(r.provider, 'deepseek-pro'); assert.deepEqual(calls.map((c) => c.model), ['claude-haiku-5-5', 'claude-haiku-5-5', 'deepseek-flash', 'deepseek-v4-pro']);
  assert.equal(r.out.content[0].type, 'tool_use'); assert.deepEqual(calls[3].body.thinking, { type: 'disabled' });
}));
test('설정·잔액 오류는 같은 모델을 다시 부르지 않고 바로 대체한다', () => withFetch((h) => (h === 'api.anthropic.com' ? [400, { error: { message: 'credit balance is too low' } }] : [200, dsOk]), async (calls) => {
  const r = await callWithFallback(req(), env(), 'claude');
  assert.equal(r.provider, 'deepseek-flash'); assert.equal(calls.length, 2); assert.match(r.tried[0].reason, /credit/);
}));
test('모두 실패하면 모델별 원인을 돌려준다', () => withFetch(() => [400, { error: { message: 'credit balance is too low' } }], async () => {
  const res = await gw.fetch(new Request('https://g/v1/step', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(req()) }), env({ AGENT_TOKEN: 't', PROMPT_CACHE: 'off' }));
  const j = await res.json();
  assert.equal(res.status, 502); assert.equal(j.error, 'upstream'); assert.equal(j.status, 400); assert.equal(j.retryable, false); assert.equal(j.tried.length, 3); assert.match(j.reason, /credit/);
}));
test('이미지를 못 보는 Pro 에는 이미지를 보내지 않는다', () => {
  const q = { messages: [{ role: 'user', content: [{ type: 'image', source: { media_type: 'image/jpeg', data: 'AAA' } }] }] };
  assert.doesNotMatch(JSON.stringify(toDeepSeek(q, 'deepseek-v4-pro', false)), /image_url/);
  assert.match(JSON.stringify(toDeepSeek(q, 'deepseek-flash', true)), /image_url/);
});

import { createRequire } from 'node:module';
import { modelError, keepTrying, looksBlocked, MODEL_RETRY } from '../ops/naviweb-agent/extension/resilience.js';
import { cleanProcedure } from '../ops/naviweb-agent/extension/procedure.js';
const F = createRequire(import.meta.url)('../task-flow.js');

test('"upstream" 대신 모델별 원인을 보여 주고, 설정 오류는 다시 시도하지 않는다', () => {
  const e = modelError({ error: 'upstream', status: 400, retryable: false, tried: [{ provider: 'claude', status: 400, reason: 'credit balance is too low' }] }, 502);
  assert.match(e.message, /Claude Haiku 400 credit/); assert.match(e.message, /관리자 확인/); assert.equal(e.retryable, false);
  const old = modelError({ error: 'upstream', status: 529, detail: { error: { message: 'Overloaded' } } }, 502);   // 갱신 전 게이트웨이의 응답
  assert.match(old.message, /529 Overloaded/); assert.equal(old.retryable, true);
});
test('일시 실패는 한 번 저절로, 그다음은 사용자가 고르면 이어서 부른다', async () => {
  MODEL_RETRY.pauseMs = 1;
  const asked = [], h = { aborted: () => false, notice: () => {}, choose: async (q) => { asked.push(q); return '다시 시도'; } };
  let n = 0; const flaky = async () => { if (++n < 3) throw Object.assign(new Error('x'), { retryable: true }); return 'ok'; };
  assert.equal(await keepTrying(flaky, h), 'ok'); assert.equal(asked.length, 1);
  n = 0; await assert.rejects(keepTrying(async () => { n++; throw Object.assign(new Error('x'), { retryable: true }); }, h)); assert.equal(n, 4);
  n = 0; await assert.rejects(keepTrying(async () => { n++; throw Object.assign(new Error('x'), { retryable: false }); }, h)); assert.equal(n, 1);
});
test('막힌 화면만 막힌 것으로 본다', () => {
  for (const t of ['403 Forbidden', '비정상적인 접근입니다.', '접속이 일시적으로 차단되었습니다', 'Access Denied', '접속이 원활하지 않습니다']) assert.ok(looksBlocked('', t), t);
  for (const t of ['로그인 후 이용해 주세요', '보안문자를 입력하세요', '접근 제한 안내를 확인한 뒤 신청하세요', '신청서 작성']) assert.ok(!looksBlocked('전자민원', t), t);
  assert.ok(!looksBlocked('', '403 Forbidden ' + '가'.repeat(2000)));
});
const rec = { official_name: '○○사업 신고', agency: '시험 기관', entry_url: 'https://www.example.go.kr/a?sid=123', steps: [{ action: '로그인한다' }, { action: '신고 메뉴를 누른다' }, { action: '연락처 010-1234-5678 을 넣는다' }, { action: '신고서를 제출한다', submit: true }] };
test('성공한 절차 기록에는 개인 자료·주소의 뒤 값이 남지 않고, 비공식 주소는 받지 않는다', () => {
  const r = cleanProcedure(rec);
  assert.equal(r.entry_url, 'https://www.example.go.kr/a'); assert.deepEqual(r.steps.map((s) => s.actor), ['user', 'helper', 'helper']); assert.doesNotMatch(JSON.stringify(r), /010-1234|sid=/);
  assert.equal(cleanProcedure({ ...rec, entry_url: 'https://evil.com' }), null);
});
test('계획의 [직접]은 로그인·결제·동의·승인만이다', () => {
  const md = F.planMarkdown({ source: 'web', procedure: { agency: 'a', steps: [{ actor: 'user', action: '로그인 및 본인인증을 한다' }, { actor: 'user', action: '신청서를 작성한다' }] } });
  assert.match(md, /1\. \[직접\]/); assert.match(md, /2\. \[도우미\]/);
});
test('절차 기억: 같은 업무는 다시 조사하지 않고, 성공 기록은 조사만 한 계획으로 덮지 않는다', () => {
  const m = new Map(), store = { getItem: (k) => m.get(k) || null, setItem: (k, v) => m.set(k, v) };
  const p = { agency: 'a', steps: [{ action: 'x' }] };
  assert.equal(F.stem('위치기반서비스 사업자 신고'), F.stem('위치기반서비스사업 등록해 줘'));
  assert.notEqual(F.stem('위치정보사업 등록'), F.stem('위치기반서비스사업 신고'));
  F.remember(store, '위치기반서비스 사업자 신고', p, false, 0);
  assert.ok(F.recall(store, '위치기반서비스 등록', 1000)); assert.equal(F.recall(store, '위치기반서비스 등록', 25 * 3600 * 1000), null);
  F.remember(store, '위치기반서비스 신고', p, true, 0); F.remember(store, '위치기반서비스 신고', { agency: 'b', steps: [{ action: 'y' }] }, false, 5);
  const e = F.recall(store, '위치기반서비스 신고', 1e12); assert.ok(e.ok); assert.equal(e.procedure.agency, 'a');
});
test('기록은 처음 계획의 근거·출처를 이어받는다', () => {
  const r = F.recorded('○○ 신고', cleanProcedure(rec), { legal_basis: '법 제9조', sources: [{ url: 'https://www.law.go.kr/x' }] }, '2026-11-27');
  assert.equal(r.title, '○○ 신고'); assert.equal(r.legal_basis, '법 제9조'); assert.equal(r.sources[0].url, 'https://www.law.go.kr/x');
});
