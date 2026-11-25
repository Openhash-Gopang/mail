import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../emergency-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../emergency.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
function page(view) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  w.eval(app); const doc = w.document, asks = [];
  w.NaviEmergency.on('ask', (t) => asks.push(t)); w.NaviEmergency.mount(doc.getElementById('m'), { view });
  const txt = () => doc.getElementById('emg-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, txt, btn, fetched: () => fetched, N: w.NaviEmergency };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviEmergency; };

test('callMessage: 말·문자가 되면 함께, 아니면 오직 응급', { skip }, () => {
  const N = api();
  const v = N.callMessage('voice', '가슴이 아파요'); assert.equal(v.only, false); assert.equal(v.mode, 'voice'); assert.equal(v.body, '가슴이 아파요'); assert.equal(v.flag, '응급');
  const t = N.callMessage('text', '쓰러졌어요'); assert.equal(t.mode, 'text'); assert.equal(t.only, false);
  const n = N.callMessage('none', '무시되는 말'); assert.equal(n.only, true); assert.equal(n.body, ''); assert.equal(n.label, '응급');
});

test('match: 한 병원 또는 인력 이동 조합 중 가장 빠른 처치 시작', { skip }, () => {
  const N = api(); const H = N.newHosp();
  const a = N.match('ami', 'p1', H); assert.equal(a.best.kind, 'split'); assert.equal(a.best.fac.name, '가상 해안병원'); assert.equal(a.best.doc.name, '가상 중앙병원');
  assert.ok(a.options.every((o) => o.start >= a.best.start)); assert.match(N.planText(a).join(' '), /자율주행차량/);
  const b = N.match('stroke', 'p3', H); assert.equal(b.best.kind, 'single'); assert.equal(b.best.fac.name, '가상 산악병원');
  H[2].eq['뇌혈관 중재 장비'] = false; H[0].docs['신경과'] = true;
  const c = N.match('stroke', 'p3', H); assert.equal(c.best.fac.name, '가상 중앙병원'); assert.equal(c.best.kind, 'single');
  for (const h of H) { for (const k in h.docs) h.docs[k] = false; }
  assert.equal(N.match('ami', 'p1', H).best, null); assert.equal(N.match('nope', 'p1', H), null);
});

test('devSummary', { skip }, () => {
  const N = api(); const m = N.devSummary([{ kind: '폰', carry: true, chk: '2026-11-01' }, { kind: '나비웹 워치', carry: false, chk: '2027-01-01' }, { kind: '링(팔찌)', carry: true, chk: '' }], '2026-11-23');
  assert.equal(m.count, 3); assert.equal(m.due, 1); assert.equal(m.carry, 2);
});

const seq = (...v) => { let k = 0; return () => v[k++ % v.length]; };

test('draw: 기기·사건이 무작위로 정해지고 신상 Form·디지털 서명이 붙는다', { skip }, () => {
  const N = api(); const a = N.draw(seq(0.0, 0.0, 0.0, 0.1, 0.1, 0.1, 0.1, 0.1), 0), b = N.draw(seq(0.0, 0.0, 0.0, 0.1, 0.1, 0.1, 0.1, 0.1), 0);
  assert.deepEqual(a.sig, b.sig); assert.match(a.sig, /^SIG-[0-9a-f]{16}$/); assert.equal(N.verify(a), true);
  a.patient.name = '바뀐 이름'; a.payload = a.payload.replace(/[^|]+/, 'x'); assert.equal(N.verify(Object.assign({}, a, { payload: a.payload + '변조' })), false);
  const seen = new Set(), devs = new Set(); for (let i = 0; i < 80; i++) { const s = N.draw(Math.random); seen.add(s.inc.id); devs.add(s.dev); assert.ok(s.patient.name && s.patient.blood && s.patient.hist && s.patient.ageText); if (s.dev === 'ring') assert.equal(s.msg.only, true); }
  assert.equal(devs.size, 3); assert.ok(seen.size >= 4);
});


const walk = (p, n) => { for (let k = 0; k < n; k++) { const b = p.doc.getElementById('emg-nextstep'); if (b) b.click(); } };
const eqState = (p) => [...p.doc.querySelectorAll('[data-eq]')].map((b) => b.dataset.eq + b.textContent).join('|');

test('19단계: 처음엔 패널이 닫혀 있고, 1-1 부터 순서대로만 열린다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x);
  assert.equal(p.doc.querySelectorAll('.tab, [role="tab"], [role="tablist"]').length, 0); assert.ok(id('emg-mock'));
  assert.equal(p.doc.querySelectorAll('#emg-bar .tick').length, 19); assert.equal(p.doc.querySelectorAll('#emg-list .srow').length, 19);
  assert.equal(id('emg-panel').classList.contains('open'), false); assert.match(id('emg-bar-cap').textContent, /^0 \/ 19/);
  assert.equal(id('emg-row-2-1').disabled, true); assert.equal(id('emg-tick-4-4').disabled, true); assert.equal(id('emg-row-1-1').disabled, false);
  id('emg-row-1-1').click(); assert.equal(id('emg-panel').classList.contains('open'), true); assert.match(id('emg-ph-t').textContent, /^1-1 기기 호출/); assert.match(id('emg-bar-cap').textContent, /^1 \/ 19/);
  assert.equal(id('emg-prev').disabled, true); assert.equal(id('emg-row-1-2').disabled, true);
  id('emg-nextstep').click(); assert.match(id('emg-ph-t').textContent, /^1-2/); id('emg-prev').click(); assert.match(id('emg-ph-t').textContent, /^1-1/);
  id('emg-pclose').click(); assert.equal(id('emg-panel').classList.contains('open'), false); assert.equal(id('emg-row-1-2').disabled, false); assert.equal(id('emg-row-1-3').disabled, true);
});

test('19단계: 끝까지 따라가며 각 패널에 내용이 있고, 신상 Form·서명·인계가 나온다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x); id('emg-row-1-1').click();
  const seen = {};
  for (let i = 0; i < 19; i++) {
    const t = id('emg-ph-t').textContent; const body = id('emg-pbody').textContent; assert.ok(body.length > 15, t); assert.equal(body.includes('undefined'), false, t);
    seen[t.split(' ')[0]] = true; if (i < 18) id('emg-nextstep').click();
  }
  assert.equal(Object.keys(seen).length, 19); assert.equal(id('emg-nextstep'), null); assert.ok(id('emg-again'));
  assert.equal(p.doc.querySelectorAll('#emg-bar .tick.done').length, 18);
  id('emg-row-1-3').click(); assert.ok(id('emg-s1-name').textContent && id('emg-s1-blood').textContent && id('emg-s1-hist').textContent && id('emg-s1-loc').textContent);
  id('emg-row-1-4').click(); assert.match(id('emg-s1-sig').textContent, /^SIG-/);
  id('emg-row-2-1').click(); assert.match(id('emg-s2-sig').textContent, /^일치/);
  id('emg-row-2-2').click(); assert.ok(id('emg-s2-est').textContent);
  id('emg-row-2-3').click(); assert.ok(id('emg-s2-ask0').textContent);
  id('emg-row-2-4').click(); assert.ok(id('emg-s2-units') && id('emg-m-res-tbl'));
  id('emg-row-2-5').click(); assert.ok(id('emg-m-res'));
  id('emg-row-4-3').click(); assert.ok(id('emg-s4-sig1').textContent.startsWith('SIG-') && id('emg-s4-sig2').textContent.startsWith('SIG-') && id('emg-s4-sig1').textContent !== id('emg-s4-sig2').textContent);
  id('emg-row-4-4').click(); assert.match(id('emg-s4-end').textContent, /처치가 시작됩니다/); assert.equal(p.fetched(), 0);
  const order = ['emg-bar', 'emg-s-prep', 'emg-draw', 'emg-list'].map((x) => [...p.doc.getElementById('emg-root').querySelectorAll('*')].indexOf(id(x))); assert.ok(order.every((x, k) => x >= 0 && (k === 0 || x > order[k - 1])), order.join());
});

test('3-2~3-5: 시간 막대가 단계를 옮겨도 유지되고 상태가 바뀐다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x); id('emg-row-1-1').click(); walk(p, 11);
  assert.match(id('emg-ph-t').textContent, /^3-2/); const t = id('emg-t'); assert.ok(t); t.value = '0'; t.dispatchEvent(new p.w.Event('input'));
  assert.match(id('emg-st-amb').textContent, /이동 중/); t.value = t.max; t.dispatchEvent(new p.w.Event('input')); assert.equal(id('emg-st-amb').textContent, '병원 도착');
  const keep = t.value; id('emg-nextstep').click(); assert.match(id('emg-ph-t').textContent, /^3-3/); assert.equal(id('emg-t').value, keep); assert.ok(id('emg-st-doc'));
  id('emg-nextstep').click(); assert.ok(id('emg-st-fac'));
});

test('3-5: 장비가 막히면 그 시각 위치에서 다시 조합하고, 앞 단계는 그때의 판단을 그대로 보여 주며, 4단계는 새 계획을 따른다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x); id('emg-row-1-1').click(); walk(p, 14);
  assert.match(id('emg-ph-t').textContent, /^3-5/); assert.equal(id('emg-ev-new'), null);
  id('emg-row-2-4').click(); const before = eqState(p), plan = (id('emg-row-2-6').click(), id('emg-s2-plan').textContent); id('emg-row-3-5').click();
  id('emg-ev').click(); assert.ok(id('emg-ev-new').textContent.length > 5); assert.equal(id('emg-ev').disabled, true);
  id('emg-row-2-4').click(); assert.equal(eqState(p), before, '2-4 는 계획을 확정할 때의 현황 그대로'); assert.ok(p.doc.querySelectorAll('[data-eq]:disabled').length > 0);
  id('emg-row-2-6').click(); assert.equal(id('emg-s2-plan').textContent, plan, '2-6 계획서도 그대로');
  id('emg-row-3-5').click(); id('emg-nextstep').click(); assert.match(id('emg-ph-t').textContent, /^4-1/); assert.match(id('emg-pbody').textContent, /새 계획/);
  assert.equal(id('emg-s4-ready').textContent.includes('undefined'), false); walk(p, 3); assert.match(id('emg-s4-end').textContent, /처치가 시작됩니다/);
});

test('2-4: 병·의원 현황을 바꾸면 결과가 바뀌고, 조합이 없어도 구급대는 안정화 계획으로 출동한다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x); id('emg-row-1-1').click(); walk(p, 7); assert.match(id('emg-ph-t').textContent, /^2-4/);
  [...p.doc.querySelectorAll('[data-doc]')].forEach((b) => { if (b.getAttribute('aria-pressed') === 'true') p.doc.querySelector('[data-doc="' + b.dataset.doc + '"]').click(); });
  id('emg-nextstep').click(); assert.match(id('emg-m-res').textContent, /조합할 수 있는 인력·장비가 없어요/); assert.match(id('emg-m-kind').textContent, /안정화/);
  walk(p, 2); assert.match(id('emg-ph-t').textContent, /^3-1/); assert.ok(id('emg-s3-fb')); assert.ok(id('emg-s3-tbl').querySelectorAll('tbody tr').length >= 3);
  walk(p, 1); assert.ok(id('emg-st-amb')); walk(p, 2); assert.match(id('emg-ph-t').textContent, /^3-4/); walk(p, 1); assert.ok(id('emg-ev-none')); assert.equal(id('emg-ev'), null);
  walk(p, 3); assert.match(id('emg-s4-dr').textContent, /당직 의료진/); walk(p, 1); assert.match(id('emg-s4-end').textContent, /안정화 처치가 시작됩니다/);
  id('emg-draw').click(); assert.equal(id('emg-panel').classList.contains('open'), false); assert.match(id('emg-bar-cap').textContent, /^0 \/ 19/); assert.equal(id('emg-row-1-2').disabled, true); assert.equal(p.w.localStorage.getItem('navi-emg-v1'), null);
});

test('match: 조합이 없으면 안정화 계획(fb)을, 출동 뒤 다시 계산하면 움직이는 구급대·의료진의 위치에서 계산한다', { skip }, () => {
  const N = api();
  const H = N.newHosp(); for (const h of H) for (const k in h.docs) h.docs[k] = false;
  const f = N.match('ami', 'p1', H); assert.equal(f.best, null); assert.equal(f.fb.kind, 'stabilize'); assert.equal(f.go, f.fb); assert.equal(f.fb.fac.name, '가상 중앙병원'); assert.match(N.planText(f).join(' '), /안정화/);
  const A = N.newHosp(), p0 = N.match('stroke', 'p3', A); assert.equal(p0.best.kind, 'single'); assert.equal(p0.best.fac.name, '가상 산악병원');
  const at = 4; A.find((x) => x.id === p0.best.fac.id).eq['뇌혈관 중재 장비'] = false;
  const a = N.match('stroke', 'p3', A, { at, prev: p0 }); assert.equal(a.best.kind, 'split'); assert.equal(a.best.fac.name, '가상 중앙병원'); assert.equal(a.best.doc.name, '가상 산악병원');
  assert.ok(a.options.every((o) => o.start >= at && o.tPatient >= at && (o.kind === 'single' || o.tDoc >= at + 3)), '이미 지난 시각으로 계산하면 안 된다'); assert.equal(a.amb.id, p0.amb.id);
  const B = N.newHosp(), q = N.match('ami', 'p1', B); assert.equal(q.best.doc.name, '가상 중앙병원'); assert.equal(q.best.fac.name, '가상 해안병원');
  B[1].eq['심혈관 중재 장비'] = false; B[0].eq['심혈관 중재 장비'] = true;
  const z = N.match('ami', 'p1', B, { at: 8, prev: q }); assert.equal(z.best.kind, 'split'); assert.equal(z.best.doc.id, z.best.fac.id, '이미 출발한 전문의가 차량을 돌려 돌아온다'); assert.ok(z.best.tDoc >= 8); assert.match(N.planText(z).join(' '), /돌려/);
  const C = N.newHosp(), r0 = N.match('ami', 'p1', C); C[1].eq['심혈관 중재 장비'] = false; const d = N.match('ami', 'p1', C, { at: 8, prev: r0 }); assert.equal(d.best, null); assert.equal(d.fb.kind, 'stabilize'); assert.ok(d.fb.tPatient >= 8);
});

const fake = (p) => { const q = []; let n = 0; p.w.setTimeout = (fn, ms) => { q.push({ id: ++n, fn, ms }); return n; }; p.w.clearTimeout = (id) => { const k = q.findIndex((x) => x.id === id); if (k >= 0) q.splice(k, 1); }; return q; };
const fire = (q, min) => { const k = q.findIndex((x) => x.ms >= (min || 0)); if (k < 0) return null; const [x] = q.splice(k, 1); x.fn(); return x.ms; };

test('시뮬레이션 버튼: 오른쪽 위에서 열면 1-1 부터 자동으로 끝까지 진행하고, 닫기·바깥 클릭으로 닫힌다', { skip }, () => {
  const p = page(); const q = fake(p); const id = (x) => p.doc.getElementById(x);
  assert.ok(id('emg-top').contains(id('emg-sim'))); assert.equal(id('emg-apanel').classList.contains('open'), false);
  id('emg-sim').click(); assert.equal(id('emg-apanel').classList.contains('open'), true); assert.ok(id('emg-back').classList.contains('on'));
  assert.match(id('emg-au-t').textContent, /^1-1/); assert.match(id('emg-au-n').textContent, /시뮬레이션/); assert.equal(id('emg-nextstep'), null); assert.equal(p.doc.querySelectorAll('#emg-au-mini i').length, 19);
  const seen = [id('emg-au-t').textContent.split(' ')[0]]; const holds = [];
  for (let k = 0; k < 40 && q.length; k++) { const ms = fire(q, 4000); if (ms === null) break; holds.push(ms); seen.push(id('emg-au-t').textContent.split(' ')[0]); if (id('emg-au-t').textContent.startsWith('4-4')) break; }
  assert.equal(new Set(seen).size, 19); assert.equal(seen[18], '4-4'); assert.ok(holds.every((m) => m >= 4000 && m <= 9000), holds.join());
  assert.match(id('emg-au-s4-end').textContent, /처치가 시작됩니다/); assert.equal(id('emg-au-pause').disabled, true);
  id('emg-back').click(); assert.ok(id('emg-apanel').classList.contains('closing'));
  while (q.length) q.shift().fn(); assert.equal(id('emg-apanel').classList.contains('open'), false); assert.equal(id('emg-back').classList.contains('on'), false); assert.equal(id('emg-sim').disabled, false);
  assert.equal(p.fetched(), 0);
});

test('시뮬레이션은 화면의 단계 목록·패널과 완전히 분리되어 있다', { skip }, () => {
  const p = page(); const q = fake(p); const id = (x) => p.doc.getElementById(x);
  id('emg-draw').click(); id('emg-row-1-1').click(); walk(p, 2);
  const snap = () => ({ cap: id('emg-bar-cap').textContent, hint: id('emg-next-hint').textContent, done: p.doc.querySelectorAll('#emg-bar .tick.done').length, rows: [...p.doc.querySelectorAll('.srow .sst')].map((x) => x.textContent).join(), panel: id('emg-panel').innerHTML, pills: id('emg-draw-sum').parentNode.querySelector('.rowf').textContent });
  const before = snap(); assert.match(before.cap, /^3 \/ 19/); assert.match(id('emg-ph-n').textContent, /직접 따라가기/);
  id('emg-sim').click(); assert.equal(id('emg-sim').disabled, true);
  for (let k = 0; k < 25 && q.length; k++) { fire(q, 4000); if (id('emg-au-t').textContent.startsWith('4-')) break; }
  assert.deepEqual(snap(), before, '시뮬레이션이 도는 동안 페이지는 그대로');
  assert.equal(id('emg-panel').classList.contains('open'), true, '페이지 패널은 닫히거나 비워지지 않는다');
  assert.equal(p.doc.querySelectorAll('[id]').length, new Set([...p.doc.querySelectorAll('[id]')].map((x) => x.id)).size, 'id 가 겹치면 안 된다');
  id('emg-row-1-2').click(); assert.match(id('emg-au-t').textContent, /^4-/, '단계 목록을 눌러도 시뮬레이션은 따라가지 않는다'); assert.match(id('emg-ph-t').textContent, /^1-2/, '반대로 시뮬레이션은 페이지 패널을 움직이지 않는다');
  id('emg-nextstep').click(); assert.match(id('emg-au-t').textContent, /^4-/);
  const mid = snap();
  id('emg-au-close').click(); while (q.length) q.shift().fn();
  assert.equal(id('emg-apanel').classList.contains('open'), false); assert.equal(id('emg-sim').disabled, false); assert.deepEqual(snap(), mid, '닫아도 페이지는 그대로');
});

test('새 사건 뽑기: 처음엔 깜박여 눌러 볼 곳을 알려 주고, 뽑은 뒤에는 다음 할 일 배너가 따라온다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x);
  assert.ok(id('emg-draw').classList.contains('blink')); assert.equal(id('emg-next-hint'), null); assert.equal(p.doc.querySelector('.srow.blink'), null);
  id('emg-draw').click(); assert.equal(id('emg-draw').classList.contains('blink'), false);
  assert.match(id('emg-next-hint').textContent, /다음 할 일.*1-1 기기 호출/); assert.ok(id('emg-draw').parentNode.parentNode.contains(id('emg-next-hint')), '새 사건 뽑기 버튼 아래(같은 카드)에 놓인다'); assert.ok(id('emg-row-1-1').classList.contains('blink'));
  id('emg-row-1-1').click(); assert.match(id('emg-next-hint').textContent, /다음 ▶ 1-2 메시지 구성/); assert.equal(id('emg-row-1-1').classList.contains('blink'), false);
  id('emg-pclose').click(); assert.match(id('emg-next-hint').textContent, /“1-1 기기 호출”을 눌러 이어 가세요/);
  id('emg-row-1-1').click(); walk(p, 18); assert.match(id('emg-next-hint').textContent, /새 사건 뽑기/);
  id('emg-draw').click(); assert.match(id('emg-next-hint').textContent, /1-1 기기 호출/); assert.equal(id('emg-panel').classList.contains('open'), false);
});

test('시뮬레이션: 멈추기·이어서, 새 무작위 사건, 닫기 버튼, 3-5 사건이 무작위로 일어남', { skip }, () => {
  const p = page(); const q = fake(p); const id = (x) => p.doc.getElementById(x); id('emg-sim').click();
  id('emg-au-pause').click(); assert.equal(q.length, 0); assert.match(id('emg-au-n').textContent, /멈춤/); id('emg-au-pause').click(); assert.ok(q.length > 0);
  id('emg-au-restart').click(); assert.match(id('emg-au-t').textContent, /^1-1/);
  for (let k = 0; k < 40 && !id('emg-au-t').textContent.startsWith('3-5'); k++) fire(q, 4000);
  assert.match(id('emg-au-t').textContent, /^3-5/); const ev = q.find((x) => x.ms === 2200); if (ev) { fire(q, 2200); assert.ok(id('emg-au-ev-new')); } else assert.equal(id('emg-au-ev-new'), null);
  id('emg-au-close').click(); while (q.length) q.shift().fn(); assert.equal(id('emg-apanel').classList.contains('open'), false);
  let evs = 0; for (let r = 0; r < 30; r++) { const pp = page(); const qq = fake(pp); pp.doc.getElementById('emg-sim').click(); for (let k = 0; k < 40 && !pp.doc.getElementById('emg-au-t').textContent.startsWith('3-5'); k++) fire(qq, 4000); if (qq.some((x) => x.ms === 2200)) evs++; }
  assert.ok(evs > 0 && evs < 30, String(evs));
});

test('평소 준비: 내 기기·보내는 정보, 옛 화면 이름은 같은 페이지 구역으로 이동', { skip }, () => {
  const p = page('prep'); assert.equal(p.doc.getElementById('emg-s-prep').open, true);
  p.btn('기록하기').click(); assert.match(p.txt(), /기기 이름을 적어/);
  type(p, 'emg-dn', '내 폰'); type(p, 'emg-dc', '2026-01-01'); p.btn('기록하기').click();
  assert.equal(p.doc.getElementById('emg-d0').textContent, '1개'); assert.equal(p.doc.getElementById('emg-d2').textContent, '1개'); assert.equal(p.doc.getElementById('emg-d1').textContent, '1개');
  p.btn('삭제').click(); assert.match(p.txt(), /아직 등록한 기기가 없어요/);
  for (const v of ['call', 'follow', 'match', 'prep', 'devices', 'consent']) { p.N.view(v); assert.ok(p.txt().length > 20, v); assert.equal(p.doc.querySelectorAll('.tab').length, 0); }
  assert.ok(p.doc.getElementById('emg-sh-loc').disabled);
  const res = []; p.N.on('result', (x) => res.push(x)); p.N.nav({ do: 'consent' }); p.N.nav({ do: 'nope' });
  assert.equal(res[0].ok, true); assert.equal(res[1].ok, false);
});

test('CSS는 .emg 아래로 한정, 네트워크 호출 없음', () => {
  const sel = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').split('}').map((x) => x.split('{')[0].trim()).filter((x) => x && !x.startsWith('@') && !/^\d+%|^from|^to/.test(x));
  assert.deepEqual(sel.filter((x) => x.split(',').some((y) => !/\.emg\b/.test(y))).slice(0, 5), []);
  assert.doesNotMatch(app, /fetch\(|XMLHttpRequest|sendBeacon/);
});

test('desktop.html 연결과 배포 목록', () => {
  assert.match(d, /tab-btn-emg/); assert.match(d, /emg-root/); assert.match(d, /_emgOpen/); assert.match(d, /key === 'k119' && !_emgChat/);
  assert.match(d, /emergency-app\.js/); assert.match(d, /emergency\.css/); assert.match(d, /emg:call/);
  assert.match(paths, /"emergency-app\.js"/); assert.match(paths, /"emergency\.css"/);
});
