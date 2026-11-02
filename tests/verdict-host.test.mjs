/**
 * tests/verdict-host.test.mjs — 입력창 '판결 시뮬레이션' 모드의 흐름 (가짜 엔진·가짜 화면, DOM 없음)
 *   분석 → 추가질문 → STEP 0~C → 결과, 단계 실패 후 이어하기, 오류 재시도, 모드 이탈 시 늦게 도착한 이벤트 무시
 * 실행: node --test tests/verdict-host.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../verdict-host.js');
const { VerdictHost } = globalThis;

const CASE = '2023년 3월에 지인에게 1천만 원을 빌려주었는데 약속한 날짜가 지나도록 갚지 않고 연락도 피합니다.';
const STEPS = [{ id: 'step0', tag: 'STEP 0' }, { id: 'stepA', tag: 'STEP A' }, { id: 'stepB', tag: 'STEP B' }, { id: 'stepC', tag: 'STEP C' }];
const tick = () => new Promise(r => setImmediate(r));

// ── 가짜 화면: 호출 기록만 남긴다 ──
function fakeUi(initial = '') {
  const log = []; let input = initial;
  const rec = (name) => (...a) => { log.push([name, ...a]); };
  const ui = {
    log, get input() { return input; },
    readInput: () => input, clearInput: () => { input = ''; log.push(['clearInput']); }, setInput: (t) => { input = t; log.push(['setInput', t]); },
    setSendEnabled: (on) => log.push(['send', on]), setMeter: (c) => log.push(['meter', c]),
    lock: (ph) => log.push(['lock', ph]), unlock: (ph) => log.push(['unlock', ph]), setLoginLabel: (on) => log.push(['loginLabel', on]),
    toast: rec('toast'), reset: rec('reset'), addUser: rec('addUser'), brief: rec('brief'), error: (msg, retry) => { log.push(['error', msg]); ui.lastRetry = retry; },
    ask: (q, skip) => { log.push(['ask', q]); ui.skip = skip; }, removeQuestionButtons: rec('removeQuestionButtons'), removeQuestions: rec('removeQuestions'),
    status: (t) => { log.push(['status', t]); return { tail: (x) => log.push(['tail', x]), remove: () => log.push(['statusRemove', t]) }; },
    progressBegin: (steps, labels, resume) => log.push(['progressBegin', steps.length, !!resume]), progressEnd: (ok) => log.push(['progressEnd', ok]),
    stepActive: rec('stepActive'), stepText: rec('stepText'), stepDone: rec('stepDone'),
    stepError: (id, msg, retry) => { log.push(['stepError', id, msg]); ui.stepRetry = retry; },
    result: (r, url) => log.push(['result', r.caseNo, url]),
  };
  ui.names = () => log.map(x => x[0]);
  return ui;
}

// ── 가짜 엔진: 이벤트를 직접 쏜다 ──
function fakeEngine(over = {}) {
  const handlers = {}; const calls = [];
  const e = {
    calls, steps: STEPS,
    on(name, fn) { (handlers[name] = handlers[name] || []).push(fn); return () => { handlers[name] = (handlers[name] || []).filter(f => f !== fn); }; },
    emit(name, p) { (handlers[name] || []).slice().forEach(f => f(p)); },
    async loadMethod() { calls.push('loadMethod'); return over.method || { ok: true, version: 'v16.2' }; },
    async analyze(t) { calls.push('analyze'); if (over.analyzeError) { const x = over.analyzeError; delete over.analyzeError; throw x; }
      return over.analysis || { caseData: { caseName: '대여금 반환 청구', type: '민사(본안)', level: '3심', dispute: '변제 여부' }, needsMoreInfo: false, question: '' }; },
    async reply(t) { calls.push('reply'); return over.reply || { ready: true, question: '' }; },
    skipQuestions() { calls.push('skipQuestions'); },
    async runVerdict(o = {}) {
      calls.push(o.resume ? 'runVerdict:resume' : 'runVerdict');
      const from = o.resume ? (over.resumeFrom ?? 0) : 0;
      for (let i = from; i < STEPS.length; i++) {
        const s = STEPS[i];
        e.emit('step:start', { id: s.id, index: i });
        e.emit('step:chunk', { id: s.id, text: '작성 중' });
        if (over.failAt === s.id && !o.resume) { e.emit('step:error', { id: s.id, message: '서버 오류' }); return { ok: false, failedStep: s.id }; }
        if (over.hold && i === from) await over.hold;
        e.emit('step:done', { id: s.id, text: s.id + ' 본문' });
      }
      return { ok: true, caseNo: 'SIM-2026-0001', version: 'v16.2', text: '전문', meta: { totalConfidence: 7 } };
    },
    abort() { calls.push('abort'); }, reset() { calls.push('reset'); },
  };
  return e;
}
const host = (ui, engine) => VerdictHost.create({ ui, getEngine: () => engine });

test('입력 가능 조건: 사건 개요는 20자 이상, 추가질문 답변은 1자 이상, 작성 중에는 불가', () => {
  const h = host(fakeUi(), fakeEngine()); h.enter();
  assert.equal(h.canSend('짧음'), false);
  assert.equal(h.canSend('가'.repeat(20)), true);
  assert.equal(h.canSend('   ' + '가'.repeat(19) + '   '), false, '공백은 세지 않는다');
  assert.equal(h.longForm(), true);
});

test('enter: 로그인 안내 문구를 이 기능 이름으로 바꾸고 입력창을 연다', () => {
  const ui = fakeUi(); host(ui, fakeEngine()).enter();
  assert.deepEqual(ui.log.find(x => x[0] === 'loginLabel'), ['loginLabel', true]);
  assert.ok(ui.log.some(x => x[0] === 'unlock' && /언제, 누구와/.test(x[1])));
});

test('너무 짧으면 보내지 않고 안내만 한다(엔진 호출 0회)', async () => {
  const ui = fakeUi('짧음'), eng = fakeEngine(), h = host(ui, eng); h.enter();
  await h.submit();
  assert.ok(ui.names().includes('toast')); assert.deepEqual(eng.calls, []);
});

test('추가질문 없는 경로: 분석 → STEP 0~C → 결과 카드', async () => {
  const ui = fakeUi(CASE), eng = fakeEngine(), h = host(ui, eng); h.enter();
  await h.submit();
  assert.deepEqual(eng.calls, ['loadMethod', 'analyze', 'runVerdict']);
  const n = ui.names();
  assert.ok(n.indexOf('addUser') < n.indexOf('brief') && n.indexOf('brief') < n.indexOf('progressBegin') && n.indexOf('progressBegin') < n.indexOf('result'));
  assert.equal(n.filter(x => x === 'stepDone').length, 4);
  assert.deepEqual(ui.log.find(x => x[0] === 'result'), ['result', 'SIM-2026-0001', VerdictHost.KLAW_URL]);
  assert.equal(h.phase, 'done');
  assert.equal(ui.input, '', '보낸 뒤 입력칸은 비워진다');
});

test('추가질문 경로: 질문 → 답변 → 작성', async () => {
  const eng = fakeEngine({ analysis: { caseData: { caseName: 'x' }, needsMoreInfo: true, question: '증거가 있나요?' } });
  const ui = fakeUi(CASE), h = host(ui, eng); h.enter();
  await h.submit();
  assert.equal(h.phase, 'asking'); assert.ok(ui.log.some(x => x[0] === 'ask' && x[1] === '증거가 있나요?'));
  assert.equal(h.longForm(), false, '답변은 Enter 로 보낸다');
  ui.setInput('네, 문자가 있습니다'); assert.equal(h.canSend(ui.input), true);
  await h.submit();
  assert.deepEqual(eng.calls, ['loadMethod', 'analyze', 'reply', 'runVerdict']);
  assert.equal(h.phase, 'done');
});

test('추가질문에서 "추가 정보 없이 진행"', async () => {
  const eng = fakeEngine({ analysis: { caseData: {}, needsMoreInfo: true, question: '?' } });
  const ui = fakeUi(CASE), h = host(ui, eng); h.enter();
  await h.submit(); ui.skip(); await tick(); await tick();
  assert.ok(eng.calls.includes('skipQuestions') && eng.calls.includes('runVerdict'));
  assert.ok(ui.names().includes('removeQuestions'));
});

test('STEP B 실패: 화면에 이어하기를 달고 입력창은 잠가 둔다 → 이어하기로 완료', async () => {
  const eng = fakeEngine({ failAt: 'stepB', resumeFrom: 2 });
  const ui = fakeUi(CASE), h = host(ui, eng); h.enter();
  await h.submit();
  assert.deepEqual(ui.log.find(x => x[0] === 'stepError'), ['stepError', 'stepB', '서버 오류']);
  assert.ok(!ui.names().includes('result')); assert.equal(h.phase, 'generating'); assert.equal(h.hasWork(), true);
  assert.equal(h.canSend(CASE), false, '실패 상태에서는 새로 보낼 수 없다(이어하기만)');
  ui.stepRetry(); await tick(); await tick();
  assert.equal(eng.calls.filter(c => c === 'runVerdict:resume').length, 1);
  assert.deepEqual(ui.log.filter(x => x[0] === 'progressBegin').map(x => x[2]), [false, true], '이어하기는 진행 표시를 새로 만들지 않는다');
  assert.ok(ui.names().includes('result')); assert.equal(h.phase, 'done');
});

test('분석 실패: 입력을 되돌려 주고, 다시 시도하면 처음부터 한 번 더', async () => {
  const err = Object.assign(new Error('두 번 시도했지만 사건 개요를 추출하지 못했습니다'), { code: 'ANALYSIS_EMPTY' });
  const eng = fakeEngine({ analyzeError: err });
  const ui = fakeUi(CASE), h = host(ui, eng); h.enter();
  await h.submit();
  assert.ok(ui.log.some(x => x[0] === 'error' && /추출하지 못했습니다/.test(x[1])));
  assert.equal(ui.input, CASE, '입력한 글은 돌려 준다'); assert.equal(h.phase, 'idle');
  ui.lastRetry(); await tick(); await tick(); await tick();
  assert.equal(h.phase, 'done'); assert.equal(eng.calls.filter(c => c === 'analyze').length, 2);
});

test('방법론 원문을 못 받으면 분석(비용) 전에 멈춘다', async () => {
  const eng = fakeEngine({ method: { ok: false, error: 'HTTP 404' } });
  const ui = fakeUi(CASE), h = host(ui, eng); h.enter();
  await h.submit();
  assert.deepEqual(eng.calls, ['loadMethod'], 'analyze 를 호출하지 않는다');
  assert.ok(ui.log.some(x => x[0] === 'error' && /방법론/.test(x[1])));
});

test('엔진 스크립트를 못 불러온 경우: 오류 안내만 하고 죽지 않는다', async () => {
  const ui = fakeUi(CASE), h = VerdictHost.create({ ui, getEngine: () => { throw new Error('KLawEngine 없음'); } }); h.enter();
  await h.submit();
  assert.ok(ui.log.some(x => x[0] === 'error' && /엔진/.test(x[1])));
});

test('작성 중 모드를 나가면: 중단하고, 늦게 도착한 이벤트는 화면에 반영하지 않는다', async () => {
  let release; const hold = new Promise(r => { release = r; });
  const eng = fakeEngine({ hold });
  const ui = fakeUi(CASE), h = host(ui, eng); h.enter();
  const p = h.submit(); await tick(); await tick(); await tick();
  assert.equal(h.hasWork(), true);
  h.exit();
  assert.ok(eng.calls.includes('abort') && eng.calls.includes('reset')); assert.equal(h.hasWork(), false);
  const before = ui.log.length; release(); await p; await tick();
  const after = ui.log.slice(before).map(x => x[0]);
  assert.ok(!after.includes('stepDone') && !after.includes('result') && !after.includes('error'), '나간 뒤에는 화면을 건드리지 않는다: ' + after.join(','));
});

test('모드에 들어온 적 없이 exit 해도 아무것도 하지 않는다(다른 모드 사이 전환)', () => {
  const ui = fakeUi(), eng = fakeEngine(), h = host(ui, eng); h.exit();
  assert.deepEqual(ui.log, []); assert.deepEqual(eng.calls, []);
});

test('모드를 다시 들어오면 지난 작업의 상태가 남지 않는다', async () => {
  const ui = fakeUi(CASE), eng = fakeEngine(), h = host(ui, eng); h.enter(); await h.submit();
  assert.equal(h.phase, 'done'); h.exit(); h.enter();
  assert.equal(h.phase, 'idle'); assert.equal(h.hasWork(), false);
});

test('끝난 뒤에는 이어서 새 사건을 입력할 수 있다', async () => {
  const ui = fakeUi(CASE), eng = fakeEngine(), h = host(ui, eng); h.enter(); await h.submit();
  ui.setInput(CASE + ' 두 번째'); assert.equal(h.canSend(ui.input), true); await h.submit();
  assert.equal(eng.calls.filter(c => c === 'analyze').length, 2); assert.equal(ui.names().filter(x => x === 'result').length, 2);
});
