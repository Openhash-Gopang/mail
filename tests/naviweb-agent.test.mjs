import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import gw, { toOpenAI, fromOpenAI, withCache, whoIs } from '../ops/naviweb-agent/gateway/worker.js';
import { classify, hostAllowed } from '../ops/naviweb-agent/extension/policy.js';
import { runAgent, buildSystem, needsAnswer } from '../ops/naviweb-agent/extension/agent-core.js';
import { PLAYBOOKS } from '../ops/naviweb-agent/extension/playbooks.js';
import { TOOLS } from '../ops/naviweb-agent/extension/tools.js';
import { baseDomain, checkFileUrl, fetchForNavi, pickDownload, parseDisposition, safeName } from '../ops/naviweb-agent/extension/files.js';

test('게이트웨이: Anthropic 형식 → OpenAI(Gemma) 변환', () => {
  const req = {
    system: 'sys', max_tokens: 99999, tools: TOOLS.slice(0, 2),
    messages: [
      { role: 'user', content: [{ type: 'text', text: '시작' }] },
      { role: 'assistant', content: [{ type: 'text', text: '읽겠습니다' }, { type: 'tool_use', id: 't1', name: 'read_page', input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: '화면' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAA' } }] }] },
    ],
  };
  const o = toOpenAI(req, 'gemma');
  assert.equal(o.max_tokens, 4096);
  assert.equal(o.messages[0].role, 'system');
  const a = o.messages.find((m) => m.role === 'assistant');
  assert.equal(a.tool_calls[0].function.name, 'read_page');
  const t = o.messages.find((m) => m.role === 'tool');
  assert.equal(t.tool_call_id, 't1'); assert.equal(t.content, '화면');
  const last = o.messages[o.messages.length - 1];
  assert.equal(last.role, 'user'); assert.match(last.content[0].image_url.url, /^data:image\/jpeg;base64,AAA/);
  assert.equal(o.tools[0].function.parameters.type, 'object');
});

test('게이트웨이: OpenAI 응답 → tool_use 블록', () => {
  const r = fromOpenAI({ choices: [{ message: { content: null, tool_calls: [{ id: 'c1', function: { name: 'click', arguments: '{"ref":"ref_3"}' } }] } }] });
  assert.equal(r.stop_reason, 'tool_use');
  assert.deepEqual(r.content[0], { type: 'tool_use', id: 'c1', name: 'click', input: { ref: 'ref_3' } });
  assert.equal(fromOpenAI({ choices: [{ message: { content: '끝' } }] }).stop_reason, 'end_turn');
  assert.equal(fromOpenAI({ choices: [{ message: { tool_calls: [{ id: 'x', function: { name: 'click', arguments: '{bad' } }] } }] }).content[0].input._raw, '{bad');
});

test('게이트웨이: 인증·원본·경로 검사', async () => {
  const env = { AGENT_TOKEN: 'tok', ALLOWED_ORIGINS: 'chrome-extension://abc' };
  const call = (h, body) => gw.fetch(new Request('https://g/v1/step', { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(body) }), env);
  assert.equal((await call({ origin: 'chrome-extension://abc' }, { messages: [{ role: 'user', content: 'x' }] })).status, 401);
  assert.equal((await call({ origin: 'https://evil.example', authorization: 'Bearer tok' }, { messages: [{ role: 'user', content: 'x' }] })).status, 403);
  assert.equal((await call({ origin: 'chrome-extension://abc', authorization: 'Bearer tok' }, { messages: [] })).status, 400);
  assert.equal((await call({ origin: 'chrome-extension://abc', authorization: 'Bearer tok' }, { messages: [{ role: 'user', content: 'x' }], provider: 'x' })).status, 400);
  assert.equal((await gw.fetch(new Request('https://g/health'), env)).status, 200);
  assert.equal((await gw.fetch(new Request('https://g/other'), env)).status, 404);
});

test('정책: 로그인·결제·비밀정보는 넘기고, 제출은 확인, 주민번호는 거부', () => {
  assert.equal(classify('type', { text: 'x' }, { type: 'password' }).act, 'handoff');
  assert.equal(classify('type', { text: '900101-1234567' }, {}).act, 'deny');
  assert.equal(classify('type', { text: '제주은행' }, { type: 'text', name: 'cmpNm' }).act, 'auto');
  assert.equal(classify('click', {}, { text: '결제' }).act, 'handoff');
  assert.equal(classify('click', {}, { text: '공동인증서 로그인' }).act, 'handoff');
  assert.equal(classify('click', {}, { text: '전자제출' }).act, 'confirm');
  assert.equal(classify('click', {}, { text: '발급' }).act, 'confirm');
  assert.equal(classify('click', {}, { text: '열람·발급' }).act, 'auto');
  assert.equal(classify('click', {}, { text: '다음' }).act, 'auto');
  assert.equal(classify('click', {}, { text: '취소' }).act, 'auto');
  assert.equal(classify('navigate', { url: 'https://www.iros.go.kr/a' }).act, 'auto');
  assert.equal(classify('navigate', { url: 'http://www.iros.go.kr/a' }).act, 'deny');
  // 사이트 제한은 없다(2026-11-08): 어느 https 사이트든 이동·입력·클릭을 바로 진행한다. 지키는 것은 사이트가 아니라 동작이다.
  assert.equal(classify('navigate', { url: 'https://example.com/' }).act, 'auto');
  assert.equal(classify('navigate', { url: 'https://iros.go.kr.evil.com/' }).act, 'auto', '사이트 이름으로는 막지 않는다');
  assert.equal(classify('navigate', { url: 'http://example.com/' }).act, 'deny', 'http 는 열지 않는다');
  assert.equal(classify('click', { ref: 'ref_1' }, { text: '다음', host: 'example.com' }).act, 'auto');
  assert.equal(classify('type', { ref: 'ref_1', text: '가나다' }, { name: 'q', host: 'example.com' }).act, 'auto');
  assert.equal(classify('click', { ref: 'ref_1' }, { text: '다음', host: 'www.iros.go.kr' }).act, 'auto');
  // 동작 규칙은 어느 사이트에서든 같다
  assert.equal(classify('click', { ref: 'ref_1' }, { text: '로그인', host: 'example.com' }).act, 'handoff', '로그인은 승인이 아니라 직접 진행');
  assert.equal(classify('click', { ref: 'ref_1' }, { text: '결제하기', host: 'example.com' }).act, 'handoff', '결제는 직접');
  assert.equal(classify('click', { ref: 'ref_1' }, { text: '발급', host: 'example.com' }).act, 'confirm', '발급·제출은 확인');
  assert.equal(classify('type', { ref: 'ref_1', text: '900101-1234567' }, { name: 'q', host: 'example.com' }).act, 'deny');
  assert.equal(classify('type', { ref: 'ref_1', text: 'x' }, { type: 'password', host: 'example.com' }).act, 'handoff', '비밀번호 입력칸은 직접');
  assert.equal(hostAllowed('https://ecfs.scourt.go.kr/psp/index.on'), true);
  assert.equal(hostAllowed('https://example.org/'), true);
  assert.equal(hostAllowed('http://example.org/'), false);
  assert.equal(hostAllowed(''), false);
  assert.equal(classify('handoff_to_user', { reason: '로그인' }).act, 'handoff');
});

function fakeHost(script, over = {}) {
  const log = []; let i = 0;
  return {
    log: (e) => log.push(e), logs: log, calls: [],
    callModel: async (req) => { return script[i++]; },
    describe: async (_n, input) => over.info || {},
    execTool: async function (n, input) { this.calls.push([n, input]); return { text: '실행:' + n }; },
    ask: async () => (over.ask ?? true), handoff: async function (t) { this.handed = t; },
    ...over.host,
  };
}
const use = (id, name, input = {}) => ({ content: [{ type: 'tool_use', id, name, input }], stop_reason: 'tool_use' });
const end = (t) => ({ content: [{ type: 'text', text: t }], stop_reason: 'end_turn' });

test('에이전트 루프: 도구 실행 후 종료 보고', async () => {
  const h = fakeHost([use('1', 'read_page'), end('완료')]);
  const r = await runAgent({ goal: 'g', host: h });
  assert.equal(r.done, true); assert.equal(r.text, '완료'); assert.deepEqual(h.calls, [['read_page', {}]]);
});

test('에이전트 루프: 결제는 handoff, 거절하면 실행하지 않음, 최대 단계 제한', async () => {
  let h = fakeHost([use('1', 'click', { ref: 'r' }), end('끝')], { info: { text: '결제' } });
  await runAgent({ goal: 'g', host: h });
  assert.ok(h.handed); assert.equal(h.calls.length, 0);
  h = fakeHost([use('1', 'click', { ref: 'r' }), end('끝')], { info: { text: '전자제출' }, ask: false });
  await runAgent({ goal: 'g', host: h }); assert.equal(h.calls.length, 0);
  h = fakeHost(Array(5).fill(0).map((_, k) => use(String(k), 'read_page')));
  const r = await runAgent({ goal: 'g', host: h, maxSteps: 3 });
  assert.equal(r.reason, 'max_steps'); assert.equal(h.calls.length, 3);
});

test('에이전트 루프: 이전 스크린샷은 1장만 유지', async () => {
  const seen = [];
  const h = fakeHost([use('1', 'screenshot'), use('2', 'screenshot'), end('끝')], {
    host: { execTool: async () => ({ text: 's', image: 'IMG' }), callModel: undefined },
  });
  let i = 0; const script = [use('1', 'screenshot'), use('2', 'screenshot'), end('끝')];
  h.callModel = async (req) => { seen.push(JSON.stringify(req.messages)); return script[i++]; };
  await runAgent({ goal: 'g', host: h });
  assert.equal((seen[2].match(/"type":"image"/g) || []).length, 1);
  assert.match(seen[2], /이전 스크린샷 생략/);
});

test('절차·도구·시스템 프롬프트', () => {
  const pb = PLAYBOOKS['iros-corp-ecourt'];
  assert.match(buildSystem(pb), /전자발급전송\(집행 등 전자소송용\)/);
  assert.match(buildSystem(pb), /결제는 사용자가 직접/);
  assert.ok(TOOLS.find((t) => t.name === 'handoff_to_user'));
  assert.ok(TOOLS.every((t) => t.input_schema.type === 'object'));
});

import { estimateTokens, fitToLimit, enforceLimit, HARD_LIMIT } from '../ops/naviweb-agent/gateway/worker.js';
const big = (n) => '가'.repeat(n);
const turn = (i, textLen, img) => [
  { role: 'assistant', content: [{ type: 'tool_use', id: 'u' + i, name: 'read_page', input: {} }] },
  { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'u' + i, content: [{ type: 'text', text: big(textLen) }, ...(img ? [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'A' } }] : [])] }] },
];
const mk = (turns, textLen, img) => ({ system: 's', tools: TOOLS, messages: [{ role: 'user', content: [{ type: 'text', text: '목표' }] }, ...Array.from({ length: turns }, (_, i) => turn(i, textLen, img)).flat()] });

test('크기 강제: 추정치는 한글을 글자당 1토큰, 이미지는 1600으로 본다', () => {
  assert.ok(estimateTokens({ messages: [{ role: 'user', content: [{ type: 'text', text: big(1000) }] }] }) >= 1000);
  const a = estimateTokens(mk(1, 10, false)), b = estimateTokens(mk(1, 10, true));
  assert.ok(b - a >= 1599);   // 추정치를 올림하므로 1 차이까지 허용
});

test('크기 강제: 한도를 넘으면 오래된 단계부터 줄이고, 첫 목표와 도구 짝은 유지', () => {
  const req = mk(40, 3000, true);                 // 약 12만 토큰 이상
  assert.ok(estimateTokens(req) > 100000);
  const fit = fitToLimit(req, 90000);
  assert.ok(!fit.error); assert.ok(fit.est <= 90000); assert.ok(fit.dropped > 0);
  assert.equal(fit.req.messages[0].content[0].text, '목표');
  assert.match(JSON.stringify(fit.req.messages[0]), /크기 제한으로 생략/);
  // 도구 짝: 모든 tool_result 의 id 가 바로 앞 assistant 의 tool_use 와 일치
  fit.req.messages.forEach((m, i) => { if (m.role === 'user' && i > 0 && m.content[0].type === 'tool_result') assert.equal(fit.req.messages[i - 1].content[0].id, m.content[0].tool_use_id); });
  // 마지막 메시지는 보존
  assert.equal(fit.req.messages.at(-1).content[0].tool_use_id, 'u39');
  assert.ok(estimateTokens(req) > 100000, '원본은 변경되지 않는다');
});

test('크기 강제: 어떤 설정에서도 95000 을 넘지 않고, 줄일 수 없으면 413', async () => {
  assert.equal(HARD_LIMIT, 95000);
  const f = fitToLimit(mk(2, 10, false), 500000); assert.equal(f.limit, 95000);
  const huge = { system: big(120000), tools: [], messages: [{ role: 'user', content: [{ type: 'text', text: 'x' }] }] };
  assert.equal(fitToLimit(huge, 90000).error, 'context_too_large');
  const env = { AGENT_TOKEN: 't' };
  const res = await gw.fetch(new Request('https://g/v1/step', { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify(huge) }), env);
  assert.equal(res.status, 413); assert.equal((await res.json()).error, 'context_too_large');
});

test('크기 강제: Claude 는 정확한 토큰 수로 재확인해 더 줄이고, 확인 불가면 여유가 없을 때 거절', async () => {
  const env = { MAX_INPUT_TOKENS: '90000' };
  const req = mk(20, 3000, false);                 // 추정 약 60K+ → 정확 계산 대상
  let calls = 0;
  const fit = await enforceLimit(req, env, 'claude', async (r) => { calls++; return calls === 1 ? 99000 : 70000; });
  assert.equal(calls, 2); assert.ok(!fit.error); assert.equal(fit.exact, 70000);
  const over = await enforceLimit(req, env, 'claude', async () => 120000);
  assert.equal(over.error, 'context_too_large');
  const un = await enforceLimit(mk(25, 3200, false), env, 'claude', async () => null);
  assert.ok(un.error === 'count_unavailable' || un.est < 76500);
  const gemma = await enforceLimit(mk(2, 10, false), env, 'gemma', async () => { throw new Error('호출 안 됨'); });
  assert.ok(!gemma.error);
});

// ── 나비웹 ↔ 확장 프로그램 다리(agent-bridge.js, bridge.js) ─────────────────────
import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);
function loadBridge() {
  const listeners = [];
  const win = { addEventListener: (t, f) => listeners.push(f), postMessage: null };
  globalThis.window = win; globalThis.location = { origin: 'https://naviweb.kr' };
  delete require_.cache[require_.resolve('../agent-bridge.js')];
  const api = require_('../agent-bridge.js');
  return { api, win, deliver: (data) => listeners.forEach((f) => f({ source: win, data })) };
}
test('suggest: 압류·추심 서류는 법인등기 절차를 제안하고 그 외는 null', () => {
  const { api } = loadBridge();
  assert.equal(api.suggest('채권압류 및 추심명령 신청서').playbook, 'iros-corp-ecourt');
  assert.equal(api.suggest('주민등록 등본 신청서'), null);
});
test('detect/queue: 확장이 응답하면 연결·맡기기 성공, 응답이 없으면 null/false', async () => {
  const b = loadBridge();
  b.win.postMessage = (m) => {
    if (m.source !== 'navi-web') return;
    if (m.type === 'agent-ping') b.deliver({ source: 'navi-agent', type: 'agent-pong', id: m.id, ok: true, version: '0.3.0', playbooks: [{ id: 'iros-corp-ecourt', title: 't' }] });
    if (m.type === 'agent-queue') b.deliver({ source: 'navi-agent', type: 'agent-queued', id: m.id, ok: m.job.playbook === 'iros-corp-ecourt' });
  };
  const info = await b.api.detect();
  assert.equal(info.version, '0.3.0');
  assert.equal(await b.api.queue({ playbook: 'iros-corp-ecourt', goal: 'x' }), true);
  assert.equal(await b.api.queue({ playbook: 'nope', goal: 'x' }), false);
  const quiet = loadBridge(); quiet.win.postMessage = () => {};
  assert.equal(await quiet.api.detect(), null);
});

// ── Haiku 프롬프트 캐시 ─────────────────────────────────────────────────────
test('withCache: 도구 끝·시스템·마지막 두 사용자 메시지에만 경계를 두고 원본은 그대로 둔다', () => {
  const req = { system: '지시문', tools: [{ name: 'a' }, { name: 'b' }], messages: [
    { role: 'user', content: '목표' },
    { role: 'assistant', content: [{ type: 'tool_use', id: '1', name: 'a', input: {} }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: '1', content: [{ type: 'text', text: '결과1' }] }] },
    { role: 'assistant', content: [{ type: 'tool_use', id: '2', name: 'a', input: {} }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: '2', content: [{ type: 'text', text: '결과2' }] }] },
  ] };
  const snapshot = JSON.stringify(req);
  const c = withCache(req);
  assert.equal(JSON.stringify(req), snapshot);
  assert.equal(c.tools[0].cache_control, undefined);
  assert.deepEqual(c.tools[1].cache_control, { type: 'ephemeral' });
  assert.equal(c.system[0].text, '지시문'); assert.deepEqual(c.system[0].cache_control, { type: 'ephemeral' });
  const marks = c.messages.flatMap((m, i) => (Array.isArray(m.content) ? m.content.filter((b) => b.cache_control).map(() => i) : []));
  assert.deepEqual(marks, [2, 4]);
  const total = (JSON.stringify(c).match(/cache_control/g) || []).length;
  assert.ok(total <= 4);
});
test('callClaude: 캐시 경계를 붙여 보내고 적중·기록 토큰을 응답에 싣는다. PROMPT_CACHE=off 이면 붙이지 않는다', async () => {
  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { seen.push(JSON.parse(init.body)); return new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', usage: { input_tokens: 10, cache_read_input_tokens: 900, cache_creation_input_tokens: 50, output_tokens: 5 } }), { status: 200 }); };
  try {
    const call = (env) => gw.fetch(new Request('https://g/v1/step', { method: 'POST', headers: { authorization: 'Bearer tok', 'content-type': 'application/json' }, body: JSON.stringify({ system: 's', messages: [{ role: 'user', content: 'hi' }], tools: [] }) }), { AGENT_TOKEN: 'tok', ANTHROPIC_API_KEY: 'k', ...env });
    const r1 = await call({}); const j1 = await r1.json();
    assert.deepEqual(j1.cache, { read: 900, write: 50, fresh: 10 });
    assert.ok(JSON.stringify(seen[seen.length - 1]).includes('cache_control'));
    await call({ PROMPT_CACHE: 'off' });
    assert.ok(!JSON.stringify(seen[seen.length - 1]).includes('cache_control'));
  } finally { globalThis.fetch = realFetch; }
});

test('게이트웨이: 나비웹 로그인 사용자(X-Navi-Token, 한글 포함)도 쓸 수 있고, 미설정·거절·한도 초과는 막는다', async () => {
  const real = globalThis.fetch; const seenTokens = [];
  globalThis.fetch = async (u) => {
    if (String(u).startsWith('https://auth.example/')) { const tok = new URL(String(u)).searchParams.get('phone_verify_token'); seenTokens.push(tok); return tok === 'user-ok-한글' ? new Response(JSON.stringify({ mail_id: 'peter' }), { status: 200 }) : new Response('{}', { status: 400 }); }
    return new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200 });
  };
  try {
    const env = { AGENT_TOKEN: 'tok', ANTHROPIC_API_KEY: 'k', AUTH_VERIFY_URL: 'https://auth.example/me', USER_DAILY_STEPS: '2' };
    const req = (h) => new Request('https://g/v1/step', { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }) });
    const user = { 'x-navi-token': encodeURIComponent('user-ok-한글') };
    assert.equal((await whoIs(req({ authorization: 'Bearer tok' }), env)).operator, true);
    assert.equal(await whoIs(req(user), { AGENT_TOKEN: 'tok' }), null, 'AUTH_VERIFY_URL 이 없으면 사용자 토큰은 거부');
    { const why = {}; await whoIs(req(user), { AGENT_TOKEN: 'tok' }, why); assert.equal(why.r, 'no_verify_url', '거절 사유를 알려 준다'); }
    { const why = {}; await whoIs(req({}), env, why); assert.equal(why.r, 'no_token_header'); }
    { let called = ''; const env2 = { ...env, HONDI_PROXY: { fetch: async (u) => { called = String(u); return new Response(JSON.stringify({ ok: true, mail_id: 'ceo' }), { status: 200 }); } } };
      const who = await whoIs(req(user), env2); assert.equal(who.sub, 'ceo'); assert.ok(called.startsWith('https://auth.example/me?phone_verify_token='), '서비스 바인딩으로 확인'); }
    { const env3 = { ...env, HONDI_PROXY: { fetch: async () => new Response('error code: 1042', { status: 404 }) } }; const why = {}; await whoIs(req(user), env3, why); assert.match(why.r, /^verify_http_404 error code: 1042/); }
    assert.equal((await gw.fetch(req({ 'x-navi-token': encodeURIComponent('nope') }), env)).status, 401);
    assert.equal((await gw.fetch(req({ 'x-navi-token': '%E0%A4%A' }), env)).status, 401, '깨진 인코딩');
    assert.equal((await gw.fetch(req(user), env)).status, 200);
    assert.ok(seenTokens.includes('user-ok-한글'), '풀어서 인증 서버에 전달');
    assert.equal((await gw.fetch(req(user), env)).status, 200);
    assert.equal((await gw.fetch(req(user), env)).status, 429, '하루 한도');
    assert.equal((await gw.fetch(req({ authorization: 'Bearer tok' }), env)).status, 200, '운영자는 한도 없음');
  } finally { globalThis.fetch = real; }
});

test('첨부서류 항목 → 가져오기 절차 연결', async () => {
  const { createRequire } = await import('node:module');
  const NA = createRequire(import.meta.url)('../agent-bridge.js');
  assert.equal(NA.slotPlan('제3채무자 법인등기사항증명서 1부').playbook, 'iros-corp-ecourt');
  assert.match(NA.slotPlan('법인 등기부등본').goal, /법인 이름: $/);
  assert.equal(NA.slotPlan('위임장 1부'), null);
  assert.equal(NA.slotPlan('신청인 인감증명서 1부').playbook, 'gov24-doc');
  assert.equal(NA.slotPlan('재직증명서'), null, '회사가 발급하는 서류는 도우미가 가져올 수 없다');
  const pats = NA.slotPatterns();
  assert.ok(pats.length >= 1 && pats.every((x) => { new RegExp(x); return true; }));
});

test('report_status 도구: 정의돼 있고 자동 허용(표시만 한다)', () => {
  const t = TOOLS.find((x) => x.name === 'report_status');
  assert.ok(t); assert.deepEqual(t.input_schema.properties.state.enum, ['sent', 'pending', 'failed']);
  assert.equal(classify('report_status', { state: 'sent' }, {}).act, 'auto');
  assert.match(PLAYBOOKS['iros-corp-ecourt'].guide, /report_status/);
});

// ── 0.5: 범용 첨부서류 가져오기(파일 받기) ───────────────────────────────────
test('send_file_to_navi: 도구·권한·안내가 갖춰져 있다', async () => {
  const fs = await import('node:fs');
  const t = TOOLS.find((x) => x.name === 'send_file_to_navi');
  assert.ok(t); assert.deepEqual(t.input_schema.required, []); assert.ok(t.input_schema.properties.ref);
  assert.equal(classify('send_file_to_navi', {}, {}).act, 'auto');
  assert.match(buildSystem(null), /send_file_to_navi/);
  const mf = JSON.parse(fs.readFileSync(new URL('../ops/naviweb-agent/extension/manifest.json', import.meta.url), 'utf8'));
  assert.ok(mf.permissions.includes('downloads')); assert.match(mf.version, /^0\.6\./);
  const bg = fs.readFileSync(new URL('../ops/naviweb-agent/extension/background.js', import.meta.url), 'utf8');
  assert.match(bg, /name === 'send_file_to_navi'/); assert.match(bg, /kind: 'file'/);
  assert.match(fs.readFileSync(new URL('../ops/naviweb-agent/extension/content.js', import.meta.url), 'utf8'), /link_href/);
});

test('내려받기·발급 단추는 사용자 확인을 거친다', () => {
  assert.equal(classify('click', { ref: 'r' }, { text: '다운로드', host: 'www.gov.kr' }).act, 'confirm');
  assert.equal(classify('click', { ref: 'r' }, { text: 'PDF 내려받기', host: 'www.gov.kr' }).act, 'confirm');
  assert.equal(classify('click', { ref: 'r' }, { text: '다음', host: 'www.gov.kr' }).act, 'auto');
  // 나비웹 "도우미가 가져오기"로 시작한 작업은 발급·다운로드를 다시 묻지 않는다(제출·전송·삭제·동의는 그대로 묻고, 결제는 직접)
  const J = { fetchJob: true };
  assert.equal(classify('click', { ref: 'r' }, { text: '발급하기', host: 'www.gov.kr' }, [], J).act, 'auto');
  assert.equal(classify('click', { ref: 'r' }, { text: 'PDF 내려받기', host: 'www.gov.kr' }, [], J).act, 'auto');
  assert.equal(classify('click', { ref: 'r' }, { text: '발급 신청서 제출', host: 'www.gov.kr' }, [], J).act, 'confirm');
  assert.equal(classify('click', { ref: 'r' }, { text: '삭제', host: 'www.gov.kr' }, [], J).act, 'confirm');
  assert.equal(classify('click', { ref: 'r' }, { text: '결제하기', host: 'www.gov.kr' }, [], J).act, 'handoff');
  assert.equal(classify('click', { ref: 'r' }, { text: '발급하기', host: 'www.gov.kr' }).act, 'confirm', '자유 작업은 그대로 묻는다');
  assert.match(classify('click', { ref: 'r' }, { text: '주민등록표 등본 발급 발급하기 버튼', host: 'x.kr' }).reason, /^\"주민등록표 등본 발급하기 버튼\"/, '겹친 글자 다듬기');
});

test('files: 같은 기관 사이트만, https 만, blob 은 안내', () => {
  assert.equal(baseDomain('www.gov.kr'), 'gov.kr'); assert.equal(baseDomain('edi.nhis.or.kr'), 'nhis.or.kr'); assert.equal(baseDomain('a.b.iros.go.kr'), 'iros.go.kr');
  assert.equal(checkFileUrl('https://file.gov.kr/a.pdf', 'https://www.gov.kr/portal').ok, true);
  assert.equal(checkFileUrl('https://edi.nhis.or.kr/x', 'https://www.nhis.or.kr/').ok, true);
  assert.equal(checkFileUrl('https://evil.example.com/a.pdf', 'https://www.gov.kr/').ok, false);
  assert.equal(checkFileUrl('http://www.gov.kr/a.pdf', 'https://www.gov.kr/').ok, false);
  assert.match(checkFileUrl('blob:https://www.gov.kr/1-2', 'https://www.gov.kr/').msg, /blob/);
  assert.equal(checkFileUrl('not a url', 'https://www.gov.kr/').ok, false);
});

test('files: 파일 이름·헤더 해석', () => {
  assert.equal(parseDisposition("attachment; filename*=UTF-8''%EB%93%B1%EB%B3%B8.pdf"), '등본.pdf');
  assert.equal(parseDisposition('attachment; filename="a b.pdf"'), 'a b.pdf');
  assert.equal(safeName('../../x:y.pdf', 'application/pdf', 'https://h/p'), '.._.._x_y.pdf');
  assert.equal(safeName('', 'application/pdf', 'https://h/path/file'), 'file.pdf');
  assert.equal(safeName('', 'application/pdf', 'https://h/'), '서류.pdf');
});

test('files: fetchForNavi — 정상 PDF 는 받고, HTML·오류·거대·가짜 PDF·다른 사이트는 거부', async () => {
  const pdf = new TextEncoder().encode('%PDF-1.4 test');
  const mk = (o = {}) => async () => ({ ok: o.ok !== false, status: o.status || 200, url: o.url || '', headers: new Headers(o.headers || { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="a.pdf"' }), arrayBuffer: async () => (o.body || pdf).buffer.slice((o.body || pdf).byteOffset, (o.body || pdf).byteOffset + (o.body || pdf).byteLength) });
  const tab = 'https://www.gov.kr/portal';
  const ok = await fetchForNavi('https://file.gov.kr/a', tab, mk());
  assert.equal(ok.ok, true); assert.equal(ok.name, 'a.pdf'); assert.equal(Buffer.from(ok.b64, 'base64').toString(), '%PDF-1.4 test');
  assert.equal((await fetchForNavi('https://file.gov.kr/a', tab, mk({ headers: { 'content-type': 'text/html; charset=utf-8' } }))).ok, false);
  assert.match((await fetchForNavi('https://file.gov.kr/a', tab, mk({ ok: false, status: 404 }))).msg, /404/);
  assert.match((await fetchForNavi('https://file.gov.kr/a', tab, mk({ headers: { 'content-type': 'application/pdf', 'content-length': String(11 * 1024 * 1024) } }))).msg, /너무 큽니다/);
  assert.match((await fetchForNavi('https://file.gov.kr/a', tab, mk({ body: new TextEncoder().encode('<html>로그인</html>') }))).msg, /PDF 파일이 아닙니다/);
  assert.equal((await fetchForNavi('https://file.gov.kr/a', tab, mk({ url: 'https://evil.example.com/a.pdf' }))).ok, false, '다른 사이트로 넘어가면 거부');
  assert.equal((await fetchForNavi('https://file.gov.kr/a', tab, mk({ body: new Uint8Array(0) }))).ok, false);
  assert.equal((await fetchForNavi('https://file.gov.kr/a', tab, async () => { throw new Error('net'); })).ok, false);
});

test('files: pickDownload — 최근 완료분의 https 주소만', () => {
  const now = Date.parse('2026-11-06T06:00:00Z');
  const d = (o) => ({ state: 'complete', endTime: '2026-11-06T05:58:00Z', url: 'https://file.gov.kr/a', filename: 'C:\\Users\\u\\Downloads\\등본.pdf', ...o });
  assert.deepEqual(pickDownload([d({}), d({ endTime: '2026-11-06T05:50:00Z', url: 'https://file.gov.kr/old' })], now), { ok: true, url: 'https://file.gov.kr/a', name: '등본.pdf' });
  assert.equal(pickDownload([d({ state: 'in_progress' })], now).ok, false);
  assert.equal(pickDownload([d({ endTime: '2026-11-06T05:00:00Z' })], now).ok, false, '10분 넘은 기록');
  assert.match(pickDownload([d({ url: 'blob:https://www.gov.kr/x' })], now).msg, /blob/);
  assert.equal(pickDownload([], now).ok, false);
});

test('첨부서류 가져오기 버튼: 직접 만든 자료만 빼고 모든 항목, 전용 절차 표시는 그대로', async () => {
  const { createRequire } = await import('node:module');
  const NA = createRequire(import.meta.url)('../agent-bridge.js');
  const anyPat = (l) => NA.slotPatterns().some((p) => new RegExp(p).test(l));
  for (const l of ['주민등록등본 1부', '건강보험 자격득실확인서', '송달증명원', '법인등기사항증명서']) assert.ok(anyPat(l) && NA.slotFetchable(l), l);
  for (const l of ['위임장 1부', '사진 2매', '임대차계약서 사본', '재산목록', '재직증명서', '']) assert.ok(!anyPat(l) && !NA.slotFetchable(l), l);
  assert.equal(NA.slotPlan('주민등록등본 1부').playbook, 'gov24-doc', '정부24 민원서류');
  assert.equal(NA.slotPlan('송달증명원').early, true, '대상을 물어야 하는 기관 서류는 사이트를 먼저 연다');
  assert.equal(NA.slotPlan('법인등기사항증명서').playbook, 'iros-corp-ecourt');
});

// ── 0.6: 맡기면 바로 시작(Claude in Chrome 방식) ─────────────────────────────
test('0.6: 모든 https 사이트 권한, 맡기면 바로 시작, 작업 탭 안내 띠', async () => {
  const fs = await import('node:fs');
  const rd = (f) => fs.readFileSync(new URL('../ops/naviweb-agent/extension/' + f, import.meta.url), 'utf8');
  const mf = JSON.parse(rd('manifest.json'));
  assert.ok(mf.host_permissions.includes('https://*/*'), '설치 때 모든 사이트 허용');
  const bg = rd('background.js');
  assert.match(bg, /j\.autostart && fromNavi && sender\.tab/); assert.match(bg, /async function runJob\(/);
  assert.match(bg, /if \(m\.type === 'start' && !state\.running\) runJob\(m\)/);
  assert.match(bg, /mine/, '답/중단은 작업 탭 또는 확장 화면에서 온 것만');
  const ct = rd('content.js');
  assert.match(ct, /__navi === 'overlay'/); assert.match(ct, /완료/); assert.match(ct, /mode: 'closed'/);
  const NA = (await import('node:module')).createRequire(import.meta.url)('../agent-bridge.js');
  assert.ok(NA.slotPlan('주민등록표 등본(초본) 1부'));
  assert.match(buildSystem(null), /로그인 창을 직접 연 뒤/);
  assert.ok(PLAYBOOKS['gov24-doc'] && PLAYBOOKS['gov24-doc'].allowedHosts.includes('gov.kr'));
});
test('0.6: 로그인 링크는 직접 열고, 입력·인증·제출 단추는 그대로 사용자에게 넘긴다', () => {
  assert.equal(classify('click', { ref: 'r' }, { tag: 'a', text: '로그인', host: 'www.gov.kr' }).act, 'auto');
  assert.equal(classify('click', { ref: 'r' }, { tag: 'a', text: '공동인증서 로그인', host: 'www.gov.kr' }).act, 'handoff');
  assert.equal(classify('click', { ref: 'r' }, { tag: 'button', text: '로그인', host: 'www.gov.kr' }).act, 'handoff');
  assert.equal(classify('type', { text: 'x' }, { type: 'password', host: 'www.gov.kr' }).act, 'handoff');
});

test('가져오기 버튼: 정부24 민원서류는 AI 답을 기다리지 않고 바로 맡긴다(instant)', async () => {
  const fs = await import('node:fs');
  const NA = (await import('node:module')).createRequire(import.meta.url)('../agent-bridge.js');
  assert.equal(NA.slotPlan('가족관계증명서').instant, true);
  assert.equal(NA.slotPlan('혼인관계증명서').playbook, 'gov24-doc');
  assert.equal(NA.slotPlan('법인등기사항증명서').instant, false);
  const html = fs.readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.match(html, /ip\.instant \|\| \(ip\.url && !ip\.playbook\)\)\) \{ _docChatAgentTask\(\{ slot: label, goal: label \}\); return; \}/);
});

test('가져오기: 법인 이름이 필요한 항목은 사이트를 먼저 열고 이름은 나중에 전한다(early/update)', async () => {
  const fs = await import('node:fs');
  const rd = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  const NA = (await import('node:module')).createRequire(import.meta.url)('../agent-bridge.js');
  assert.equal(NA.slotPlan('법인등기사항증명서').early, true);
  assert.equal(typeof NA.update, 'function');
  assert.match(rd('ops/naviweb-agent/extension/bridge.js'), /autostart: job\.autostart === true, url: [^\n]*update: job\.update === true/, '다리가 autostart·update 를 확장에 넘긴다');
  assert.match(rd('ops/naviweb-agent/extension/background.js'), /state\.inbox\.push\(j\.text/);
  assert.match(rd('ops/naviweb-agent/extension/agent-core.js'), /\[추가 정보\]/);
  assert.match(rd('desktop.html'), /NaviAgent\.update\(_lbl, d\.goal\)/);
  assert.match(JSON.parse(rd('ops/naviweb-agent/extension/manifest.json')).version, /^0\.6\.[1-9]/);
  // 에이전트 루프: inbox 의 정보가 다음 단계 입력에 덧붙는다
  const sent = []; let n = 0;
  const host = { aborted: () => false, log() {}, describe: async () => ({}), execTool: async () => ({ text: 'ok' }), ask: async () => true, handoff: async () => {}, inbox: () => (n++ === 1 ? '법인 이름: 가나다' : null),
    callModel: async (b) => { sent.push(JSON.stringify(b.messages)); return sent.length < 3 ? { content: [{ type: 'tool_use', id: 't' + sent.length, name: 'wait', input: { seconds: 1 } }] } : { content: [{ type: 'text', text: '끝' }] }; } };
  await runAgent({ goal: 'x', playbook: null, host });
  assert.ok(sent.some((x) => x.includes('[추가 정보] 법인 이름: 가나다')));
});

// ── 첨부서류 카탈로그 ────────────────────────────────────────────────
test('카탈로그: 기관 발급·개별 기관 발급·사용자 자료를 AI 없이 가른다', async () => {
  const C = (await import('node:module')).createRequire(import.meta.url)('../attach-catalog.js');
  const k = (l) => C.classify(l).kind;
  for (const l of ['법인등기부등본', '가족관계증명서 1부', '주민등록표등본', '건축물대장등본', '토지등기사항증명서', '국세완납증명서', '건강보험자격득실확인서', '송달증명원']) assert.equal(k(l), 'agency', l);
  for (const l of ['재직증명서', '진단서', '졸업증명서', '시험성적서']) assert.equal(k(l), 'thirdparty', l);
  for (const l of ['신분증사본', '주민등록증사본', '위임장', '사업계획서', '시설배치도', '통장사본']) assert.equal(k(l), 'user', l);
  assert.equal(k('아주특이한서류이름'), 'unknown');
  assert.equal(C.classify('가족관계증명서').instant, true);
  assert.equal(C.classify('법인등기부등본').playbook, 'iros-corp-ecourt');
  assert.equal(C.classify('국세완납증명서').url, 'https://www.hometax.go.kr');
  assert.ok(C.patterns().every((x) => { new RegExp(x); return true; }));
  for (const a of Object.values(C.AGENCIES)) assert.match(a.url, /^https:\/\//);
  for (const r of C.RULES) if (r.kind === 'agency') assert.ok(C.AGENCIES[r.agency], r.id + ' 기관 정의');
});
test('카탈로그: 기관 사이트는 도우미 기본 허용 사이트에 들어 있다(이동마다 묻지 않는다)', async () => {
  const C = (await import('node:module')).createRequire(import.meta.url)('../attach-catalog.js');
  for (const a of Object.values(C.AGENCIES)) assert.equal(hostAllowed(a.url), true, a.url);
});

test('카탈로그 전수조사 보정: 기관을 특정하고 AI 없이 사이트를 연다', async () => {
  const C = (await import('node:module')).createRequire(import.meta.url)('../attach-catalog.js');
  const want = { '취득세 영수필확인서': 'wetax', '국민주택채권 매입 필증': 'nhuf', '사업자등록증(사본)': 'hometax', '폐업사실증명원': 'hometax',
    '원천징수영수증': 'hometax', '범죄경력조회회보서': 'police', '교통사고사실확인원': 'efine', '농지원부': 'gov24', '신탁원부': 'iros', '특허증 사본': 'patent' };
  for (const [t, ag] of Object.entries(want)) { const r = C.classify(t); assert.equal(r.kind, 'agency', t); assert.equal(r.agency, ag, t); assert.ok(/^https:/.test(r.url), t); }
  assert.equal(C.classify('임금대장').kind, 'user');
  assert.equal(C.classify('송금내역').kind, 'thirdparty');
  const NA = (await import('node:module')).createRequire(import.meta.url)('../agent-bridge.js');
  assert.ok(NA.slotPlan('국민주택채권 매입 필증').url, '입력이 필요한 기관 서류도 사이트 주소를 갖는다');
  const { hostAllowed } = await import('../ops/naviweb-agent/extension/policy.js');
  for (const t of Object.keys(want)) { const r = C.classify(t); assert.ok(hostAllowed(r.url), r.url + ' 은 확장이 열 수 있어야 한다'); }
});

test('서류 화면 제한(식 20개·200자) 안에서도 모든 기관 서류에 가져오기 버튼이 붙는다', async () => {
  const C = (await import('node:module')).createRequire(import.meta.url)('../attach-catalog.js');
  const re = C.patterns().slice(0, 20).map((s) => { try { return new RegExp(s.slice(0, 200)); } catch { return null; } }).filter(Boolean);
  for (const r of C.RULES.filter((x) => x.kind === 'agency')) {
    const sample = { resident: '주민등록등본(초본)', 'vehicle-reg': '자동차등록원부', nhis: '건강보험 자격득실확인서' }[r.id];
    if (sample) assert.ok(re.some((x) => x.test(sample)), sample + ' 버튼 누락');
  }
  assert.ok(C.patterns().length <= 20);
  for (const l of ['주민등록등본(초본)', '건축물대장등본', '취득세 영수필확인서', '국민주택채권 매입 필증']) assert.ok(re.some((x) => x.test(l)), l);
  assert.ok(!re.some((x) => x.test('사진')) && !re.some((x) => x.test('재직증명서')));
});

// ── 0.6.4: 설치 직후 이미 열려 있던 나비웹 탭에도 다리를 넣는다 ────────────────
test('0.6.4: 설치·시작 때 열려 있는 나비웹 탭에 bridge.js 주입 (새로고침 없이 연결)', () => {
  const rd = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  const bg = rd('ops/naviweb-agent/extension/background.js'), mf = JSON.parse(rd('ops/naviweb-agent/extension/manifest.json'));
  assert.match(bg, /chrome\.runtime\.onInstalled\.addListener\(\(\) => \{ injectBridgeIntoOpenTabs\(\)/);
  assert.match(bg, /chrome\.runtime\.onStartup\.addListener/);
  assert.match(bg, /files: \['bridge\.js'\]/);
  // 주입 대상은 bridge.js 의 matches 와 같아야 한다
  const m = mf.content_scripts[0].matches;
  for (const u of m) assert.ok(bg.includes(`'${u}'`), u);
  assert.ok(mf.host_permissions.includes('https://*/*') && mf.permissions.includes('scripting') && mf.permissions.includes('tabs'));
  assert.match(mf.version, /^0\.6\.([4-9]|\d\d)/);
});

test('ask_choice: 선택지를 단추로 묻고 고른 값을 모델에 돌려준다', async () => {
  let asked = null;
  const h = fakeHost([use('1', 'ask_choice', { question: '어느 서류?', options: ['등본', '초본'] }), end('끝')], { host: { choose: async (q, o) => { asked = [q, o]; return '초본'; } } });
  const r = await runAgent({ goal: 'g', host: h });
  assert.deepEqual(asked, ['어느 서류?', ['등본', '초본']]); assert.equal(r.done, true); assert.equal(h.calls.length, 0);
  assert.equal(classify('ask_choice', {}, {}).act, 'choice');
  assert.ok(TOOLS.some((t) => t.name === 'ask_choice'));
  assert.match(buildSystem({ goal: 'g' }), /ask_choice/);
});

test('글로만 묻고 끝내면 ask_choice 로 다시 묻게 한다', async () => {
  const h = fakeHost([end('서류 종류를 정해 주셔야 합니다. 초본이 필요하면 알려 주세요.'), use('1', 'ask_choice', { question: '무엇을 발급?', options: ['등본', '초본'] }), end('완료')], { host: { choose: async () => '등본' } });
  const r = await runAgent({ goal: 'g', host: h });
  assert.equal(r.text, '완료'); assert.ok(needsAnswer('알려 주세요')); assert.ok(!needsAnswer('모두 끝났습니다.'));
});

test('handoff 는 인증·결제 사유만 허용, 그 밖은 거부', () => {
  assert.equal(classify('handoff_to_user', { reason: '등본/초본을 직접 선택하세요' }, {}).act, 'deny');
  assert.equal(classify('handoff_to_user', { reason: '간편인증으로 본인 확인하세요' }, {}).act, 'handoff');
  assert.equal(classify('handoff_to_user', { reason: '결제를 진행하세요' }, {}).act, 'handoff');
});

test('ask_input: 값을 받아 모델에 전달, 직접 입력 선택 시 건너뜀, 민감 항목은 거부', async () => {
  const mk = (ans) => fakeHost([use('1', 'ask_input', { question: '전화번호?', label: '전화번호' }), end('완료')], { host: { input: async () => ans } });
  assert.equal((await runAgent({ goal: 'g', host: mk('010-1234-5678') })).done, true);
  assert.equal((await runAgent({ goal: 'g', host: mk({ manual: true }) })).done, true);
  assert.equal(classify('ask_input', { question: '전화번호?' }, {}).act, 'input');
  assert.equal(classify('ask_input', { question: '비밀번호를 알려 주세요' }, {}).act, 'deny');
  assert.equal(classify('ask_input', { question: '주민등록번호?' }, {}).act, 'deny');
  assert.ok(TOOLS.some((t) => t.name === 'ask_input'));
});

test('pdv_get·save_as: 금고에서 읽고, 받은 값은 지정 항목으로 보관하도록 host 에 전달', async () => {
  assert.ok(TOOLS.some((t) => t.name === 'pdv_get'));
  assert.equal(classify('pdv_get', { keys: ['phone'] }, {}).act, 'auto');
  assert.match(buildSystem({ goal: 'g' }), /pdv_get/);
  let saved = null;
  const h = fakeHost([use('1', 'ask_input', { question: '전화번호?', label: '전화번호', save_as: 'phone' }), end('완료')], { host: { input: async (q, l, k) => { saved = k; return '010-1234-5678'; } } });
  await runAgent({ goal: 'g', host: h });
  assert.equal(saved, 'phone');
  const h2 = fakeHost([use('1', 'ask_input', { question: 'x', save_as: 'rrn' }), end('완료')], { host: { input: async (q, l, k) => { saved = k; return 'v'; } } });
  await runAgent({ goal: 'g', host: h2 });
  assert.equal(saved, '');
});

test('기관 사이트를 열면 나비웹에 opened 상태를 알린다(다리 허용 상태·배경 코드)', () => {
  const br = readFileSync(new URL('../ops/naviweb-agent/extension/bridge.js', import.meta.url), 'utf8');
  const bg = readFileSync(new URL('../ops/naviweb-agent/extension/background.js', import.meta.url), 'utf8');
  assert.match(br, /'opened'/); assert.match(bg, /notifyOpened/);
  assert.match(readFileSync(new URL('../desktop.html', import.meta.url), 'utf8'), /_agentOpenedNotice/);
});

test('처리완료 화면(text/html) 응답이면 문서출력·저장 단추로 내려받으라고 안내, 문서출력 단추는 가져오기 작업에서 자동', async () => {
  const r = await fetchForNavi('https://www.gov.kr/x', 'https://www.gov.kr/y', async () => ({ ok: true, url: 'https://www.gov.kr/x', status: 200, headers: new Headers({ 'content-type': 'text/html' }), arrayBuffer: async () => new ArrayBuffer(4) }));
  assert.equal(r.ok, false); assert.match(r.msg, /문서출력/);
  assert.equal(classify('click', { ref: 'e1' }, { tag: 'button', text: '문서출력' }, [], { fetchJob: true }).act, 'auto');
  assert.match(buildSystem({ goal: 'g' }), /문서출력/);
});

test('0.6.19: 직접 입력 단계 단추는 "완료", 민감 정보 입력 사유의 handoff 는 허용', () => {
  const c = readFileSync(new URL('../ops/naviweb-agent/extension/content.js', import.meta.url), 'utf8');
  assert.match(c, /btn\('완료'/); assert.doesNotMatch(c, /btn\('직접 했어요'/);
  assert.equal(classify('handoff_to_user', { reason: '주민등록번호는 직접 입력해 주세요' }, {}).act, 'handoff');
  assert.equal(classify('handoff_to_user', { reason: '화면 하단 버튼을 눌러 주세요' }, {}).act, 'deny');
});

test('0.6.20: 작업 탭 묶음·띠 되살리기·사용자 말하기·가입 대행 규칙', () => {
  const bg = readFileSync(new URL('../ops/naviweb-agent/extension/background.js', import.meta.url), 'utf8');
  const ct = readFileSync(new URL('../ops/naviweb-agent/extension/content.js', import.meta.url), 'utf8');
  assert.match(bg, /state\.family/); assert.match(bg, /tabs\.onActivated/); assert.match(bg, /m\.type === 'say'/);
  assert.match(ct, /ovWd/); assert.match(ct, /input\.i2|'i2'/);
  assert.match(buildSystem({ goal: 'g' }), /회원가입/);
  assert.equal(classify('handoff_to_user', { reason: '약관 동의와 아이디 만들기는 직접 해 주세요' }, {}).act, 'handoff');
});

test('확장 새로고침 직후 설치 안내가 뜨지 않게: 연결된 적 있으면 재확인·자동 안내 생략, 연속 2회 미응답만 끊김', () => {
  const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.match(d, /_agentDetectPatient/); assert.match(d, /if \(!_agentSeen\(\)\) setTimeout\(\(\) => window\._agentGuideOpen/);
  assert.match(d, /_agentMiss/);
});

test('0.6.21: 클릭·입력 전에 도우미 커서가 움직인다(닫힌 shadow DOM, 움직임 줄이기 존중)', () => {
  const ct = readFileSync(new URL('../ops/naviweb-agent/extension/content.js', import.meta.url), 'utf8');
  assert.match(ct, /async function glide/); assert.match(ct, /prefers-reduced-motion/); assert.match(ct, /pointer-events:none/);
  assert.match(ct, /glide\(el, msg\.name === 'click'\)/);
});

test('게이트웨이: 예외가 나도 CORS 머리글이 달린 500(worker_error)으로 답한다', async () => {
  const env = { ALLOWED_ORIGINS: 'chrome-extension://abc', get AGENT_TOKEN() { throw new Error('boom'); } };
  const res = await gw.fetch(new Request('https://gw.example/v1/step', { method: 'POST', headers: { origin: 'chrome-extension://abc', authorization: 'Bearer x', 'content-type': 'application/json' }, body: '{}' }), env);
  assert.equal(res.status, 500);
  assert.equal(res.headers.get('access-control-allow-origin'), 'chrome-extension://abc');
  assert.equal((await res.json()).error, 'worker_error');
});

test('0.6.22: 확장은 네트워크 끊김·5xx 를 재시도하고 서비스 워커를 깨워 둔다', () => {
  const bg = readFileSync(new URL('../ops/naviweb-agent/extension/background.js', import.meta.url), 'utf8');
  assert.match(bg, /async function postStep/); assert.match(bg, /3번 시도/); assert.match(bg, /getPlatformInfo/);
});

test('0.6.24: 로그인 안내 중 "로그아웃" 단추가 새로 보이면 사용자가 완료한 것으로 이어 간다', () => {
  const bg = readFileSync(new URL('../ops/naviweb-agent/extension/background.js', import.meta.url), 'utf8');
  assert.match(bg, /function loginProbe/); assert.match(bg, /function watchLogin/);
  assert.match(bg, /kind === 'handoff' && \/로그인\//);
  assert.match(bg, /hits >= 2/);   // 두 번 연속 확인
  // 프로브가 로그아웃 문구만 가려내는지(페이지 밖에서 같은 정규식으로 확인)
  const re = /^(로그\s*아웃|log\s*out|logout|sign\s*out)$/i;
  for (const t of ['로그아웃', '로그 아웃', 'Logout', 'Sign out']) assert.ok(re.test(t), t);
  for (const t of ['로그인', '로그아웃 연장 안내문구입니다']) assert.ok(!re.test(t), t);
});

test('0.6.25: 작업 중 커서가 화면 위를 천천히 오간다(대상으로 갈 때는 중단, 움직임 줄이기 존중)', () => {
  const ct = readFileSync(new URL('../ops/naviweb-agent/extension/content.js', import.meta.url), 'utf8');
  assert.match(ct, /function curWander/); assert.match(ct, /curGliding/); assert.match(ct, /if \(!curBusy \|\| curReduced\(\)\)/);
});
test('로그인 감지: 로그아웃 단추(남은 시간 포함)와 "님의 MyGOV" 문구를 로그인 신호로 본다', () => {
  const bg = readFileSync(new URL('../ops/naviweb-agent/extension/background.js', import.meta.url), 'utf8');
  const src = /function loginProbe\(\) \{[\s\S]*?\n\}\n/.exec(bg)[0];
  const mk = (btns, text) => {
    const doc = { body: { innerText: text }, querySelectorAll: () => btns.map((t) => ({ tagName: 'A', textContent: t, getBoundingClientRect: () => ({ width: 10, height: 10 }) })) };
    return new Function('document', 'getComputedStyle', src + '; return loginProbe();')(doc, () => ({ visibility: 'visible', display: 'block' }));
  };
  assert.equal(mk(['로그아웃'], ''), true);
  assert.equal(mk(['로그아웃 (29:59)'], ''), true);
  assert.equal(mk([], '도영민 님의 MyGOV 서비스 신청 내역'), true);
  assert.equal(mk(['로그인', '회원가입'], '로그인이 필요합니다'), false);
});
test('문서 보기 화면 PDF 가져오기: 같은 사이트의 PDF 만 받고, PDF 가 아니면 실패한다', async () => {
  const { grabPdfInPage } = await import('../ops/naviweb-agent/extension/files.js');
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...new Array(200).fill(65)]);
  const run = async (entries, fetchImpl, max = 10 * 1024 * 1024) => {
    const G = globalThis, save = { location: G.location, performance: G.performance, fetch: G.fetch };
    G.location = { hostname: 'plus.gov.kr' }; G.performance = { getEntriesByType: () => entries.map((name) => ({ name })) }; G.fetch = fetchImpl;
    try { return await grabPdfInPage(max); } finally { Object.assign(G, save); }
  };
  const ok = (body) => async () => ({ ok: true, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) });
  const r = await run(['https://plus.gov.kr/app.js', 'https://evil.com/x.pdf', 'https://plus.gov.kr/ezpdfwv/data?contentId=1'], ok(pdf));
  assert.equal(r.ok, true); assert.equal(r.size, pdf.length); assert.ok(r.b64.length > 100);
  const seen = []; await run(['https://evil.com/x', 'https://plus.gov.kr/a.png'], async (u) => { seen.push(u); return ok(pdf)(); });
  assert.equal(seen.length, 0);   // 다른 사이트·그림 파일은 요청하지 않는다
  const html = await run(['https://plus.gov.kr/ezpdfwv/viewer'], ok(new Uint8Array(300).fill(60)));
  assert.equal(html.ok, false);
  const big = await run(['https://plus.gov.kr/d'], ok(pdf), 50);
  assert.equal(big.ok, false); assert.match(big.msg, /너무 큽니다/);
});
test('화면을 PDF 로 만들기: 디버거에 붙였다가 반드시 떼고, 결과를 검사한다', async () => {
  const { printTabToPdf } = await import('../ops/naviweb-agent/extension/files.js');
  const mk = (data, fail) => { const log = []; return { log, attach: async () => { log.push('attach'); if (fail === 'attach') throw new Error('x'); }, sendCommand: async (t, m) => { log.push(m); if (fail === 'cmd') throw new Error('y'); return { data }; }, detach: async () => { log.push('detach'); } }; };
  const a = mk(Buffer.from('%PDF-1.4 hello').toString('base64')); const r = await printTabToPdf(a, 7);
  assert.equal(r.ok, true); assert.deepEqual(a.log, ['attach', 'Page.printToPDF', 'detach']);
  const b = mk('', null); assert.equal((await printTabToPdf(b, 7)).ok, false); assert.equal(b.log.at(-1), 'detach');
  const c = mk('QUJD', 'cmd'); assert.equal((await printTabToPdf(c, 7)).ok, false); assert.equal(c.log.at(-1), 'detach');
  assert.equal((await printTabToPdf(mk('x', 'attach'), 7)).ok, false);
  assert.equal((await printTabToPdf(mk('A'.repeat(400), null), 7, 100)).ok, false);
});
test('받아 온 파일은 되묻지 않고 바로 넣고, 정부24 열림 안내는 파일이 오면 지운다', () => {
  const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  const fn = /function _agentOnFile\(f\) \{[\s\S]*?\n\}\n/.exec(d)[0];
  assert.ok(!/confirm\(/.test(fn)); assert.match(fn, /navi-doc-fill-slot/); assert.match(fn, /agent-open-note/);
  assert.match(d, /const od = document\.getElementById\('agent-open-note'\); if \(od\) od\.remove\(\);/);
});
test('지시 이행 원칙: 맡긴 일을 "진행할까요?"로 되묻는 선택은 묻지 않고 진행하고, 위험한 질문은 묻는다', async () => {
  const { autoProceed } = await import('../ops/naviweb-agent/extension/policy.js');
  const q = '신청 전 확인: 주민등록표 등본을 제주시 주소 기준, 전체 발급, 온라인발급(본인출력)으로 신청합니다. 진행할까요? (신청 후 인증서 인증·결제가 나오면 직접 하셔야 합니다)';
  assert.equal(autoProceed(q, ['신청 진행', '취소', '중단']), '신청 진행');
  assert.equal(autoProceed('이 서류를 삭제할까요?', ['진행', '취소']), null);
  assert.equal(autoProceed('수수료 1,000원을 내고 발급할까요?', ['진행', '취소']), null);
  assert.equal(autoProceed('어느 주소로 할까요?', ['제주', '서울']), null);
  assert.equal(autoProceed('진행할까요?', ['진행']), null);
  const ac = readFileSync(new URL('../ops/naviweb-agent/extension/agent-core.js', import.meta.url), 'utf8');
  assert.match(ac, /지시 이행 원칙/); assert.match(ac, /autoProceed\(String\(u\.input\.question/);
});
test('문서 보기 창은 작업 탭이 아니어도 찾아 PDF 로 만든다(열린 뷰어 탭 조회)', () => {
  const bg = readFileSync(new URL('../ops/naviweb-agent/extension/background.js', import.meta.url), 'utf8');
  assert.match(bg, /tabs\.query\(\{ url: 'https:\/\/\*\.gov\.kr\/ezpdfwv\/\*' \}\)/);
  assert.match(bg, /printTabToPdf\(chrome\.debugger, tid\)/);
  const pb = readFileSync(new URL('../ops/naviweb-agent/extension/playbooks.js', import.meta.url), 'utf8');
  assert.match(pb, /open_issued_document/);
});
test('실제 마우스 입력: 이동 → 누름 → 잠깐 유지 → 뗌 순서로 보내고 반드시 디버거를 뗀다', async () => {
  const { debuggerClick } = await import('../ops/naviweb-agent/extension/files.js');
  const log = []; const dbg = { attach: async () => { log.push('attach'); }, sendCommand: async (t, m, p) => { log.push(p.type); }, detach: async () => { log.push('detach'); } };
  const waits = []; const r = await debuggerClick(dbg, 3, 10, 20, async (ms) => { waits.push(ms); }, 150);
  assert.equal(r.ok, true); assert.deepEqual(log, ['attach', 'mouseMoved', 'mousePressed', 'mouseReleased', 'detach']);
  assert.ok(waits.includes(150));   // 누른 채로 유지하는 시간
  const bad = { attach: async () => { throw new Error('x'); }, sendCommand: async () => {}, detach: async () => {} };
  assert.equal((await debuggerClick(bad, 3, 1, 1, async () => {})).ok, false);
  const fail = []; const d2 = { attach: async () => {}, sendCommand: async () => { throw new Error('y'); }, detach: async () => { fail.push('detach'); } };
  assert.equal((await debuggerClick(d2, 3, 1, 1, async () => {})).ok, false); assert.deepEqual(fail, ['detach']);
  const bg = readFileSync(new URL('../ops/naviweb-agent/extension/background.js', import.meta.url), 'utf8');
  assert.match(bg, /debuggerClick\(chrome\.debugger, state\.tabId, g\.x, g\.y\)/);
});
test('open_issued_document: 문서출력 찾기·실제 클릭·뷰어 확인·PDF 전송을 한 번에 하는 도구', async () => {
  const { TOOLS } = await import('../ops/naviweb-agent/extension/tools.js');
  assert.ok(TOOLS.some((t) => t.name === 'open_issued_document'));
  const bg = readFileSync(new URL('../ops/naviweb-agent/extension/background.js', import.meta.url), 'utf8');
  assert.match(bg, /name === 'open_issued_document'/); assert.match(bg, /pick_by_text/); assert.match(bg, /waitNewViewer/);
  assert.match(bg, /실제 마우스 입력\(실패\)/); assert.match(bg, /마우스 이벤트 전체/);
  const ct = readFileSync(new URL('../ops/naviweb-agent/extension/content.js', import.meta.url), 'utf8');
  assert.match(ct, /pick_by_text: \(\{ text, nth \}\)/);
  const pb = readFileSync(new URL('../ops/naviweb-agent/extension/playbooks.js', import.meta.url), 'utf8');
  assert.match(pb, /open_issued_document/);
});
test('이름표(aria-label)와 보이는 글자가 다른 단추도 글자로 찾는다(정부24 문서출력: aria-label="새 창 열림")', () => {
  const ct = readFileSync(new URL('../ops/naviweb-agent/extension/content.js', import.meta.url), 'utf8');
  assert.match(ct, /const textsOf = \(el\) =>/); assert.match(ct, /textsOf\(el\)\.some\(\(t\) => t\.toLowerCase\(\)\.includes\(filter\)\)/);
  assert.match(ct, /t\.includes\(want\)/); assert.ok(ct.includes('글자=')); 
});
test('팝업 창이 뜨면 커서는 팝업에서만, 안내 문구는 팝업에 띄우지 않는다(메인 창 커서는 숨김)', () => {
  const bg = readFileSync(new URL('../ops/naviweb-agent/extension/background.js', import.meta.url), 'utf8');
  assert.match(bg, /async function isPopupTab/); assert.match(bg, /part: 'cursor'/); assert.match(bg, /part: 'banner'/);
  const ct = readFileSync(new URL('../ops/naviweb-agent/extension/content.js', import.meta.url), 'utf8');
  assert.match(ct, /curSuppressed/); assert.match(ct, /msg\.part === 'cursor'/); assert.match(ct, /msg\.part === 'banner'/);
});
