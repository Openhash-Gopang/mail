import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classify, isCloseControl } from '../ops/naviweb-agent/extension/policy.js';
import { buildSystem, runAgent, POPUP_ASK } from '../ops/naviweb-agent/extension/agent-core.js';
import { TOOLS } from '../ops/naviweb-agent/extension/tools.js';
const click = (text, name = '') => classify('click', { ref: 'ref_1' }, { tag: 'button', text, name }).act;

test('SP: 필요 없는 팝업은 묻지 않고 닫고, 필요한 창은 남기며, 동의·설치·결제는 누르지 않는다', () => {
  const s = buildSystem(null);
  assert.match(s, /팝업은 도우미가 직접 닫습니다/); assert.match(s, /close_popup/);
  assert.match(s, /지금 작업에 필요한 창.*닫지 말고/); assert.match(s, /"동의·수락·허용·설치·구독·결제" 단추를 누르지 않습니다/);
  assert.doesNotMatch(s, /맘대로 누르지 않습니다/);
  assert.ok(TOOLS.some((t) => t.name === 'close_popup'));
  assert.equal(classify('close_popup', {}, {}).act, 'popup');
});
test('닫기 단추는 팝업 닫기로 분류한다(승인 1회)', () => {
  for (const t of ['닫기', '닫기 닫기', 'X', '×', 'Close', '창 닫기', '팝업 닫기', '로그인 안내 팝업 닫기', '결제 이벤트 공지 닫기', '오늘 하루 보지 않기', '오늘 하루 이 창을 열지 않음', '7일간 보지 않기', '다시 보지 않기']) assert.equal(click(t), 'popup', t);
});
test('닫는 척하며 다른 일을 하는 단추는 닫기로 보지 않는다', () => {
  assert.equal(click('동의하고 닫기'), 'confirm');
  assert.equal(click('삭제 후 닫기'), 'confirm');
  for (const t of ['신청하고 닫기', '설치 후 닫기', '수락하고 닫기', '구독하고 닫기']) assert.equal(isCloseControl({ text: t }), false, t);   // 닫기 예외를 적용하지 않고 기존 규칙을 따른다
  assert.equal(click('닫기', '전자서명 결제하기'), 'handoff');
  assert.equal(click('결제하기'), 'handoff');
  assert.equal(click('로그인'), 'handoff');
});
test('close_popup 은 처음 작업 창과 로그인·결제 창을 닫지 않는다', () => {
  const b = readFileSync(new URL('../ops/naviweb-agent/extension/background.js', import.meta.url), 'utf8');
  assert.match(b, /id === state\.rootTab/); assert.match(b, /input\[type=password\]/); assert.match(b, /const KEEP_POPUP/);
});

// 가짜 모델: 주어진 도구 호출을 차례로 부른 뒤 끝낸다.
async function drive(calls, approve) {
  const asked = [], ran = []; let i = 0;
  const host = {
    log() {}, aborted: () => false,
    async callModel() { const c = calls[i++]; return { content: c ? [{ type: 'tool_use', id: 'u' + i, name: c[0], input: c[1] }] : [{ type: 'text', text: '완료' }] }; },
    async describe(name, input) { return input.ref ? { tag: 'button', text: '닫기', name: '' } : {}; },
    async ask(t) { asked.push(t); return approve; },
    async execTool(name, input) { ran.push(name + (input.ref ? ':' + input.ref : '')); return { text: 'ok' }; },
  };
  await runAgent({ goal: 'g', playbook: null, host });
  return { asked, ran };
}
test('승인은 작업당 한 번: 승인하면 모두 닫고 다시 묻지 않는다', async () => {
  const r = await drive([['click', { ref: 'ref_1' }], ['close_popup', {}], ['click', { ref: 'ref_2' }]], true);
  assert.deepEqual(r.asked, [POPUP_ASK]);
  assert.deepEqual(r.ran, ['click:ref_1', 'close_popup', 'close_popup', 'click:ref_2']);
});
test('거절하면 닫지 않고 다시 묻지도 않는다', async () => {
  const r = await drive([['close_popup', {}], ['click', { ref: 'ref_2' }], ['close_popup', {}]], false);
  assert.equal(r.asked.length, 1); assert.deepEqual(r.ran, []);
});
