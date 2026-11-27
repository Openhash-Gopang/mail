import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSystem, runAgent } from '../ops/naviweb-agent/extension/agent-core.js';
import { TOOLS } from '../ops/naviweb-agent/extension/tools.js';
import { cleanAnnouncement } from '../ops/naviweb-agent/extension/procedure.js';
const require = createRequire(import.meta.url);
const TaskFlow = require('../task-flow.js');
const NaviAgent = require('../agent-bridge.js');

test('SP: 업무 처리 5단계가 순서대로 적혀 있다', () => {
  const s = buildSystem(null);
  const at = ['1단계(표준 절차 검색)', '2단계(절차 파악)', '3단계(사용자에게 고지)', '4단계(이행)', '5단계(표준 절차 등록)'].map((k) => s.indexOf(k));
  assert.ok(at.every((n, i) => n >= 0 && (i === 0 || n > at[i - 1])), String(at));
  assert.ok(TOOLS.some((t) => t.name === 'announce_procedure'));
});
async function drive(goal, calls) {
  const ran = [], results = []; let i = 0;
  await runAgent({ goal, playbook: null, host: {
    log() {}, aborted: () => false, fetchJob: () => true,
    async callModel({ messages }) { const last = messages[messages.length - 1]; if (i) results.push(JSON.stringify(last.content)); const c = calls[i++]; return { content: c ? [{ type: 'tool_use', id: 'u' + i, name: c[0], input: c[1] }] : [{ type: 'text', text: '완료' }] }; },
    async describe(name, input) { return input.ref ? { tag: 'button', text: input.ref === 'ref_menu' ? '민원안내' : '신청하기', name: '' } : {}; },
    async ask() { return true; },
    async execTool(name, input) { ran.push(name + (input.ref ? ':' + input.ref : '')); return name === 'announce_procedure' ? { announced: true, text: 'ok' } : { text: 'ok' }; },
  } });
  return { ran, results };
}
test('접수 업무는 절차를 알리기 전에는 "신청하기"를 누르지 못하고, 알린 뒤에 누른다', async () => {
  const r = await drive('[절차 고지 필요] 위치기반서비스 신고', [['click', { ref: 'ref_menu' }], ['click', { ref: 'ref_apply' }], ['announce_procedure', {}], ['click', { ref: 'ref_apply' }]]);
  assert.deepEqual(r.ran, ['click:ref_menu', 'announce_procedure', 'click:ref_apply']);
  assert.match(r.results[1], /announce_procedure 를 먼저/);
});
test('표시가 없는 작업(서류 발급 등)은 막지 않는다', async () => {
  assert.deepEqual((await drive('등본 발급', [['click', { ref: 'ref_apply' }]])).ran, ['click:ref_apply']);
});
test('접수 업무의 작업 지시에는 표시가 붙고 발급에는 붙지 않는다', () => {
  assert.match(NaviAgent.homeJob('위치기반서비스 신고', { goal: 'x'.repeat(3000) }, '신고해 줘').goal, /\[절차 고지 필요\]/);
  assert.doesNotMatch(NaviAgent.homeJob('주민등록등본', {}, '등본 발급해 줘').goal, /\[절차 고지 필요\]/);
});
test('고지: 근거 화면이 없으면 받지 않고, 민간 https 사이트도 알릴 수 있으며, 화면 글에 개인 값·태그를 남기지 않는다', () => {
  const base = { agency: '○○항공', entry_url: 'https://air.example.com/refund?sid=1', steps: ['<img onerror=x> 환불 [메뉴] 를 연다', '010-1234-5678 로 확인', '본인인증'], checked: ['https://air.example.com/help'] };
  assert.equal(cleanAnnouncement({ ...base, checked: [] }), null);
  const a = cleanAnnouncement(base);
  assert.equal(a.entry_url, 'https://air.example.com/refund'); assert.equal(a.steps.length, 2);
  const md = TaskFlow.announceMarkdown(a);
  assert.match(md, /확인한 처리 절차/); assert.match(md, /\[직접\] 본인인증/); assert.doesNotMatch(md, /<|1234-5678|\[메뉴\]/);
  assert.equal(TaskFlow.announceMarkdown({}), '');
});
