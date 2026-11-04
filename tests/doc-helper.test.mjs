/**
 * tests/doc-helper.test.mjs — 서류 작성 도우미 인계(2026-11-04)의 순수 로직과 desktop.html 연결 (DOM 없음).
 * 실행: node --test tests/doc-helper.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const D = require('../doc-helper.js');
const html = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');

const ATT = [{ l: '집행권원 사본 1부', up: false }, { l: '송달증명원 1부', up: false }, { l: '채무자 재산목록 1부', up: true }];

test('matchLabel: 정확·정규화 일치, 후보가 하나일 때만 부분 일치, 모호하면 null', () => {
  const ls = ['1. 집행권원 사본 1부', '송달증명원 1부', '법인등기사항증명서 (제3채무자)', '법인등기사항증명서 (채무자)'];
  assert.equal(D.matchLabel('송달증명원 1부', ls), '송달증명원 1부');
  assert.equal(D.matchLabel('집행권원사본1부', ls), '1. 집행권원 사본 1부');
  assert.equal(D.matchLabel('송달증명원', ls), '송달증명원 1부');
  assert.equal(D.matchLabel('법인등기사항증명서', ls), null, '둘 이상이 겹치면 고르지 않는다');
  assert.equal(D.matchLabel('', ls), null); assert.equal(D.matchLabel('가', ls), null); assert.equal(D.matchLabel('없는 서류', ls), null);
});

test('applySlot: 원본을 바꾸지 않고 한 항목만 갱신, 모르는 상태·none·up 은 무시, 길이 제한', () => {
  const a = {}; const b = D.applySlot(a, '송달증명원 1부', 'queued', '');
  assert.deepEqual(a, {}); assert.equal(b['송달증명원 1부'].state, 'queued');
  const c = D.applySlot(b, '집행권원 사본 1부', 'failed', 'x'.repeat(200));
  assert.equal(Object.keys(c).length, 2); assert.equal(c['집행권원 사본 1부'].note.length, 80);
  assert.deepEqual(D.applySlot(c, '가나', 'bogus', ''), c);
  assert.deepEqual(D.applySlot(c, '가나', 'none', ''), c);
  assert.deepEqual(D.applySlot(c, '', 'queued', ''), c);
});

test('pendingLabels: 맡김·진행 중만 "끝나지 않은 일"', () => {
  let s = {}; for (const [l, st] of [['a서류', 'queued'], ['b서류', 'pending'], ['c서류', 'sent'], ['d서류', 'received'], ['e서류', 'failed']]) s = D.applySlot(s, l, st, '');
  assert.deepEqual(D.pendingLabels(s).sort(), ['a서류', 'b서류']);
  assert.deepEqual(D.pendingLabels(null), []);
});

test('attachCtx: 항목별 상태·도우미 연결·저장 여부를 SP 가 읽는 문장으로', () => {
  let s = D.applySlot({}, '송달증명원 1부', 'queued', '');
  s = D.applySlot(s, '집행권원 사본 1부', 'failed', '로그인 취소');
  const t = D.attachCtx({ attach: ATT, slots: s, agentOn: true, saved: false, planFor: (l) => /등기/.test(l) });
  assert.match(t, /첨부서류 3건:/);
  assert.match(t, /- 집행권원 사본 1부: 실패 — 로그인 취소/);
  assert.match(t, /- 송달증명원 1부: 맡김 — 사용자가 도우미를 시작하기를 기다림/);
  assert.match(t, /- 채무자 재산목록 1부: 파일 올림/);
  assert.match(t, /나비웹 도우미: 연결됨/); assert.match(t, /작성 완료 저장: 안 함/);
  assert.doesNotMatch(t, /\[전용 절차\]/);
  const u = D.attachCtx({ attach: [{ l: '법인등기사항증명서 (제3채무자)', up: false }], slots: {}, agentOn: false, saved: true, planFor: (l) => /등기/.test(l) });
  assert.match(u, /법인등기사항증명서 \(제3채무자\): 없음 \[전용 절차\]/); assert.match(u, /연결 안 됨/); assert.match(u, /저장: 함/);
});

test('attachCtx: 서류 화면이 목록을 안 알려 주면(옛 페이지) 그 사실과 맡긴 항목만 보인다', () => {
  const t = D.attachCtx({ attach: null, slots: D.applySlot({}, '송달증명원', 'pending', ''), agentOn: true });
  assert.match(t, /화면이 목록을 알려 주지 않았다/); assert.match(t, /- 송달증명원: 진행 중/);
});

test('planTask: 도우미가 없으면 맡기지 않는다', () => {
  const r = D.planTask({ slot: '송달증명원 1부', goal: '대법원 전자소송에서 송달증명원 발급 화면까지' }, { agentOn: false });
  assert.equal(r.ok, false); assert.equal(r.code, 'no-agent'); assert.match(r.msg, /확장 프로그램/);
});
test('planTask: 비밀번호·주민등록번호가 든 goal 은 거부한다', () => {
  for (const g of ['정부24에서 인감증명서 발급, 비밀번호는 1234', '주민번호 900101-1234567 로 조회', '계좌번호 123 로 결제', 'password 입력']) {
    const r = D.planTask({ slot: '인감증명서 1부', goal: g }, { agentOn: true }); assert.equal(r.code, 'secret', g);
  }
  assert.equal(D.planTask({ slot: '인감증명서 1부', goal: '정부24에서 인감증명서 발급 화면까지 진행' }, { agentOn: true }).ok, true);
});
test('planTask: 이미 맡김·진행·전송·받음 항목은 다시 맡기지 않고, 실패 항목은 다시 맡긴다', () => {
  const o = (st) => ({ agentOn: true, labels: ['송달증명원 1부'], slots: D.applySlot({}, '송달증명원 1부', st, '') });
  for (const st of ['queued', 'pending', 'sent', 'received']) assert.equal(D.planTask({ slot: '송달증명원', goal: '발급 화면까지 진행' }, o(st)).code, 'dup', st);
  assert.equal(D.planTask({ slot: '송달증명원', goal: '발급 화면까지 진행' }, o('failed')).ok, true);
});
test('planTask: job 은 항목 이름으로 맞추고, 인증·결제 경계 문구를 항상 붙이며, 500자를 넘지 않는다', () => {
  const r = D.planTask({ slot: '송달증명원', goal: '대법원 전자소송에서 송달증명원 발급 화면까지 진행' }, { agentOn: true, labels: ['송달증명원 1부'] });
  assert.equal(r.ok, true); assert.equal(r.label, '송달증명원 1부'); assert.equal(r.job.slot, '송달증명원 1부'); assert.equal(r.job.playbook, '');
  assert.ok(r.job.goal.endsWith(D.SUFFIX)); assert.match(r.job.goal, /결제는 사용자가 직접/); assert.match(r.job.title, /^첨부서류 발급 — 송달증명원 1부/);
  const long = D.planTask({ slot: '서류', goal: '가'.repeat(300) }, { agentOn: true });
  assert.ok(long.job.goal.length <= 500);
});
test('planTask: 전용 절차(playbook)가 있는 항목은 그 문구 뒤에 SP 의 goal(법인 이름)을 붙인다', () => {
  const slotPlan = (l) => /법인.*등기/.test(l) ? { playbook: 'iros-corp-ecourt', goal: '법인등기사항증명서를 전자소송용으로 결제대상목록에 담아 주세요. 결제는 하지 말고 목록에서 멈춰 주세요. 법인 이름: ' } : null;
  const r = D.planTask({ slot: '법인등기사항증명서', goal: '㈜가나다' }, { agentOn: true, labels: ['법인등기사항증명서 (제3채무자)'], slotPlan });
  assert.equal(r.job.playbook, 'iros-corp-ecourt'); assert.match(r.job.goal, /법인 이름: ㈜가나다/); assert.ok(r.job.goal.endsWith(D.SUFFIX));
  const bad = D.planTask({ slot: '송달증명원', goal: '발급 화면까지 진행' }, { agentOn: true, slotPlan: () => { throw new Error('x'); } });
  assert.equal(bad.ok, true); assert.equal(bad.job.playbook, '');
});
test('planTask: slot·goal 이 비면 조용히 버린다(msg 없음)', () => {
  assert.deepEqual(D.planTask({ slot: '', goal: 'x' }, { agentOn: true }), { ok: false, code: 'empty', msg: '' });
  assert.equal(D.planTask(null, { agentOn: true }).code, 'empty');
});

test('handBackDecision: cancel 은 항상, complete 는 작성 완료 저장 뒤에만, 그 밖은 거부', () => {
  assert.equal(D.handBackDecision('cancel', { saved: false }).ok, true);
  assert.equal(D.handBackDecision('complete', { saved: true }).ok, true);
  const r = D.handBackDecision('complete', { saved: false }); assert.equal(r.ok, false); assert.match(r.msg, /작성 완료로 저장/);
  assert.deepEqual(D.handBackDecision('offtopic', { saved: true }), { ok: false, msg: '' });
  assert.equal(D.handBackDecision('complete').ok, false);
});

test('handBackSummary: 첨부 현황·남은 것·진행 중인 도우미 일·다음 단계를 한 번에, 600자 이내', () => {
  let s = D.applySlot({}, '집행권원 사본 1부', 'received', ''); s = D.applySlot(s, '송달증명원 1부', 'pending', '');
  const t = D.handBackSummary({ title: '채권압류 및 추심명령 신청서', reason: 'complete', attach: ATT, slots: s });
  assert.match(t, /^「채권압류 및 추심명령 신청서」 작성을 마쳤습니다\./);
  assert.match(t, /첨부서류 3건 중 2건을 서류에 넣었습니다\. 남은 것: 송달증명원 1부\./);
  assert.match(t, /도우미가 맡은 1건은 브라우저에서 계속 진행됩니다\./); assert.match(t, /제출 안내가 필요하시면/);
  const c = D.handBackSummary({ title: '서류', reason: 'cancel', attach: null, slots: {} });
  assert.equal(c, '「서류」 작성 도우미를 마쳤습니다.');
  assert.ok(D.handBackSummary({ title: '서', reason: 'complete', attach: Array.from({ length: 20 }, (_, i) => ({ l: '아주 긴 첨부서류 이름 '.repeat(5) + i, up: false })), slots: {} }).length <= 600);
});

// ── desktop.html 연결(소스 단언) ─────────────────────────────────────────────
test('desktop.html: 도우미 SP — 시키지 않고 맡기며, 사용자 몫은 로그인·본인인증·결제뿐', () => {
  const sp = html.slice(html.indexOf('function _docChatSp()'), html.indexOf('function _docChatEnsure('));
  assert.match(sp, /주도권은 너에게 있다/);
  assert.match(sp, /"발급받아 오세요", "직접 신청하세요", "받아 주세요"라고 쓰지 않는다/);
  assert.match(sp, /\[AGENT_TASK: slot=<블록의 항목 이름 그대로>; goal=/);
  assert.match(sp, /사용자의 일은 로그인\(공동인증서 포함\)·본인인증·결제뿐이다/);
  assert.match(sp, /\[DOC_HANDBACK: reason=cancel\]/); assert.match(sp, /\[DOC_HANDBACK: reason=complete\]/);
  assert.match(sp, /나비웹 도우미: 연결 안 됨"이면[\s\S]*이때만 사용자가 직접 발급받도록 안내/);
  assert.match(sp, /서류의 제출·접수는 사용자가 한다/);
  assert.ok(sp.length < 7800, 'hondi 페이지는 spText 를 8000자까지만 받는다: ' + sp.length);
});
test('desktop.html: 첨부·도우미·저장 상태 블록을 항목보다 먼저 놓는다(5800자 절단 대비)', () => {
  const p = html.slice(html.indexOf('async function _docChatPush()'), html.indexOf('function _docChatHandBack('));
  assert.ok(p.indexOf('DocHelper.attachCtx') > 0 && p.indexOf('DocHelper.attachCtx') < p.indexOf("'\\n항목 ' + fields.length"));
  assert.match(p, /slice\(0, 5800\)/);
});
test('desktop.html: 태그 수신은 혼디 대화창 iframe·hondi.net 출처·도우미 세션 중일 때만', () => {
  const h = html.slice(html.indexOf("window.addEventListener('message', function (e) {   // 서류 도우미 SP 가 낸 태그"), html.indexOf('window.addEventListener(\'message\', function (e) {   // 대화창이 전송 직전에'));
  assert.match(h, /d\.type !== 'hondi-embed-agent-task' && d\.type !== 'hondi-embed-doc-handback'/);
  assert.match(h, /e\.source !== f\.contentWindow \|\| e\.origin !== 'https:\/\/hondi\.net'/);
  assert.match(h, /if \(!_docChat\.on\) return;/);
  assert.match(h, /DocHelper\.handBackDecision\(String\(d\.reason \|\| ''\), \{ saved: _docChat\.saved \}\)/);
});
test('desktop.html: 마친 서류에서는 주도권을 다시 가져가지 않고, 다른 서류를 열면 다시 맡는다', () => {
  const e = html.slice(html.indexOf('function _docChatEnsure('), html.indexOf('function _docChatLeave('));
  assert.match(e, /_docChat\.doneKey === key && \(_docHost\.title \|\| ''\) === _docChat\.doneTitle\) return;/);
  assert.match(html, /!_docChat\.on && _docChat\.doneKey && _docHost\.title && _docHost\.title !== _docChat\.doneTitle/);
});
test('desktop.html: 저장 성공(두 경로)과 도우미 진행 상태가 _docChat 로 이어진다', () => {
  assert.match(html, /_drToast\('작성한 서류에 저장했습니다[^\n]*_docChatOnSaved\(\)/);
  assert.match(html, /\.then\(\(\) => _drCall\('done', \{ id \}\)\)\.then\(\(\) => \{ try \{ _docChatOnSaved\(\)/);
  assert.match(html, /function _agentOnStatus\(s\)[\s\S]{0,400}DocHelper\.applySlot\(_docChat\.slots/);
  assert.match(html, /navi-doc-slot-result'\) \{\s*\n\s*if \(_docChat\.on && window\.DocHelper\)[\s\S]{0,300}'received'/);
  assert.match(html, /<script src="doc-helper\.js\?v=\d+"><\/script>/);
});
test('desktop.html: 확장에는 항상 사용자가 시작·승인해야 하는 큐로만 맡긴다(자동 실행 없음)', () => {
  const f = html.slice(html.indexOf('async function _docChatAgentTask('), html.indexOf("window.addEventListener('message', function (e) {   // 서류 도우미 SP 가 낸 태그"));
  assert.match(f, /NaviAgent\.queue\(r\.job\)/); assert.match(f, /도구 모음의 나비웹 도우미 아이콘을 눌러 내용을 확인하고 시작하세요/);
  assert.doesNotMatch(f, /agent-start|autostart|run\(/);
});
