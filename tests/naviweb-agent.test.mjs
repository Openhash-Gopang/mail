import test from 'node:test';
import assert from 'node:assert/strict';
import gw, { toOpenAI, fromOpenAI } from '../ops/naviweb-agent/gateway/worker.js';
import { classify, hostAllowed } from '../ops/naviweb-agent/extension/policy.js';
import { runAgent, buildSystem } from '../ops/naviweb-agent/extension/agent-core.js';
import { PLAYBOOKS } from '../ops/naviweb-agent/extension/playbooks.js';
import { TOOLS } from '../ops/naviweb-agent/extension/tools.js';

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
  assert.equal(classify('navigate', { url: 'https://iros.go.kr.evil.com/' }).act, 'deny');
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
