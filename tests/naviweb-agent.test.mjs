import test from 'node:test';
import assert from 'node:assert/strict';
import gw, { toOpenAI, fromOpenAI, withCache, whoIs } from '../ops/naviweb-agent/gateway/worker.js';
import { classify, hostAllowed } from '../ops/naviweb-agent/extension/policy.js';
import { runAgent, buildSystem } from '../ops/naviweb-agent/extension/agent-core.js';
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
  // 기본 사이트 밖은 어디든 갈 수 있지만 이동·입력·클릭마다 승인을 받는다
  assert.equal(classify('navigate', { url: 'https://example.com/' }).act, 'confirm');
  assert.equal(classify('click', { ref: 'ref_1' }, { text: '다음', host: 'example.com' }).act, 'confirm');
  assert.equal(classify('type', { ref: 'ref_1', text: '가나다' }, { name: 'q', host: 'example.com' }).act, 'confirm');
  assert.equal(classify('click', { ref: 'ref_1' }, { text: '다음', host: 'www.iros.go.kr' }).act, 'auto');
  assert.equal(classify('click', { ref: 'ref_1' }, { text: '로그인', host: 'example.com' }).act, 'handoff', '로그인은 승인이 아니라 직접 진행');
  assert.equal(classify('type', { ref: 'ref_1', text: '900101-1234567' }, { name: 'q', host: 'example.com' }).act, 'deny');
  assert.equal(classify('navigate', { url: 'https://iros.go.kr.evil.com/' }).act, 'confirm', '비슷한 이름의 다른 사이트는 기본 사이트가 아니다');
  assert.equal(hostAllowed('https://ecfs.scourt.go.kr/psp/index.on'), true);
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
  assert.equal(NA.slotPlan('신청인 인감증명서 1부'), null);
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
  assert.ok(mf.permissions.includes('downloads')); assert.match(mf.version, /^0\.5\./);
  const bg = fs.readFileSync(new URL('../ops/naviweb-agent/extension/background.js', import.meta.url), 'utf8');
  assert.match(bg, /name === 'send_file_to_navi'/); assert.match(bg, /kind: 'file'/);
  assert.match(fs.readFileSync(new URL('../ops/naviweb-agent/extension/content.js', import.meta.url), 'utf8'), /link_href/);
});

test('내려받기·발급 단추는 사용자 확인을 거친다', () => {
  assert.equal(classify('click', { ref: 'r' }, { text: '다운로드', host: 'www.gov.kr' }).act, 'confirm');
  assert.equal(classify('click', { ref: 'r' }, { text: 'PDF 내려받기', host: 'www.gov.kr' }).act, 'confirm');
  assert.equal(classify('click', { ref: 'r' }, { text: '다음', host: 'www.gov.kr' }).act, 'auto');
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
  const generic = new RegExp(NA.slotPatterns().at(-1));
  for (const l of ['주민등록등본 1부', '건강보험 자격득실확인서', '송달증명원', '법인등기사항증명서']) assert.ok(generic.test(l) && NA.slotFetchable(l), l);
  for (const l of ['위임장 1부', '사진 2매', '임대차계약서 사본', '재산목록', '']) assert.ok(!generic.test(l) && !NA.slotFetchable(l), l);
  assert.equal(NA.slotPlan('주민등록등본 1부'), null, '전용 절차 표시는 법인등기에만');
  assert.equal(NA.slotPlan('법인등기사항증명서').playbook, 'iros-corp-ecourt');
});
