import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../police-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../police.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
function page(view) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  w.eval(app); const doc = w.document, asks = [];
  w.NaviPolice.on('ask', (t) => asks.push(t)); w.NaviPolice.mount(doc.getElementById('m'), { view });
  return { w, doc, asks, fetched: () => fetched, N: w.NaviPolice };
}
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviPolice; };
const fake = (p) => { const q = []; let n = 0; p.w.setTimeout = (fn, ms) => { q.push({ id: ++n, fn, ms }); return n; }; p.w.clearTimeout = (id) => { const k = q.findIndex((x) => x.id === id); if (k >= 0) q.splice(k, 1); }; return q; };
const fire = (q, min) => { const k = q.findIndex((x) => x.ms >= (min || 0)); if (k < 0) return null; const [x] = q.splice(k, 1); x.fn(); return x.ms; };
const nx = (p) => { const c = p.doc.querySelector('.srow.cur'); if (!c) return false; const n = [...p.doc.querySelectorAll('.srow')].find((r) => +r.dataset.i === +c.dataset.i + 1); if (n) n.click(); return !!n; };
const walk = (p, n) => { for (let k = 0; k < n; k++) nx(p); };
const seq = (...v) => { let k = 0; return () => v[k++ % v.length]; };

test('callMessage: 말·문자가 되면 함께, 아니면 오직 치안', { skip }, () => {
  const N = api();
  const v = N.callMessage('voice', '누가 때려요'); assert.equal(v.only, false); assert.equal(v.mode, 'voice'); assert.equal(v.flag, '치안'); assert.equal(v.label, '음성 + 치안');
  const t = N.callMessage('text', '따라와요'); assert.equal(t.mode, 'text'); assert.equal(t.only, false);
  const n = N.callMessage('none', '무시되는 말'); assert.equal(n.only, true); assert.equal(n.body, ''); assert.equal(n.label, '치안');
});

test('match: 피해자에게 가장 빨리 닿는 팀 + 위험하면 용의자 쪽 두 번째 팀, 낮으면 한 팀이 겸임', { skip }, () => {
  const N = api(); const U = N.newUnits();
  const a = N.match('knife', 'p2', U); assert.equal(a.go.kind, 'pair'); assert.ok(a.go.second); assert.notEqual(a.go.second.u.id, a.go.lead.u.id);
  assert.ok(a.options.every((o) => o.eta >= a.go.lead.eta)); assert.match(N.planText(a).join(' '), /경찰관이 판단/);
  const b = N.match('theft', 'p2', U); assert.equal(b.go.kind, 'solo'); assert.equal(b.go.second, null);
  U.forEach((u, i) => { if (i > 0) u.free = false; });
  const c = N.match('assault', 'p1', U); assert.equal(c.go.kind, 'solo'); assert.equal(c.go.lead.u.id, U[0].id);
  U.forEach((u) => { u.free = false; });
  const e = N.match('assault', 'p1', U); assert.equal(e.best, null); assert.equal(e.go.kind, 'reassign'); assert.ok(e.go.aid > e.go.lead.eta); assert.match(N.planText(e).join(' '), /인근 관할/);
  assert.equal(N.match('nope', 'p1', U), null);
});

test('match(live): 용의자가 달아나면 피해자 쪽은 그대로, 용의자 쪽만 그 시각 위치에서 다시 정하고 여유 팀이 없으면 CCTV 추적', { skip }, () => {
  const N = api(); const U = N.newUnits(); const p0 = N.match('knife', 'p2', U);
  const at = Math.max(1, Math.round(p0.go.lead.eta * 0.5)); const a = N.match('knife', 'p2', U, { at, prev: p0 });
  assert.equal(a.go.lead.u.id, p0.go.lead.u.id); assert.equal(a.go.start, p0.go.start); assert.ok(a.go.second && a.go.second.eta >= at); assert.equal(a.go.track, false);
  assert.notDeepEqual(a.S, p0.S); assert.match(N.planText(a).join(' '), /달아나/);
  const V = N.newUnits(); V.forEach((u) => { if (u.id !== p0.go.lead.u.id) u.free = false; });
  const p1 = N.match('knife', 'p2', V); const b = N.match('knife', 'p2', V, { at: 1, prev: p1 }); assert.equal(b.go.second, null); assert.equal(b.go.track, true); assert.match(N.planText(b).join(' '), /CCTV 추적/);
});

test('draw: 기기·범죄가 무작위로 정해지고 서명이 붙으며, 급박한 범죄에만 용의자 후보가 생긴다', { skip }, () => {
  const N = api(); const a = N.draw(seq(0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7), 0), b = N.draw(seq(0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7), 0);
  assert.equal(a.sig, b.sig); assert.match(a.sig, /^SIG-[0-9a-f]{16}$/); assert.equal(N.verify(a), true); assert.equal(N.verify(Object.assign({}, a, { payload: a.payload + '변조' })), false);
  const seen = new Set(), devs = new Set();
  for (let i = 0; i < 120; i++) { const s = N.draw(Math.random); seen.add(s.inc.id); devs.add(s.dev); assert.ok(s.vic.name && s.vic.prior && s.vic.ageText && /^PO-/.test(s.no)); if (s.dev === 'ring') assert.equal(s.msg.only, true);
    if (s.inc.urgent) { assert.ok(s.sus.cands.length >= 1 && s.sus.cands.length <= 3); assert.ok(s.sus.pool > s.sus.cands.length); assert.ok(s.sus.cands.every((c) => /가상 용의자/.test(c.tag))); } else { assert.equal(s.sus.cands.length, 0); assert.equal(s.sus.pool, 0); } }
  assert.equal(devs.size, 3); assert.equal(seen.size, 5);
});

test('19단계: 처음엔 패널이 닫혀 있고, 1-1 부터 열면 다음 단계가 풀리며 다음 막대가 천천히 깜박인다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x);
  assert.equal(p.doc.querySelectorAll('#pol-bar .tick').length, 19); assert.equal(p.doc.querySelectorAll('#pol-list .srow').length, 19); assert.equal(p.doc.querySelectorAll('[role="tab"]').length, 0);
  assert.equal(!!id('pol-ipanel'), false); assert.match(id('pol-bar-cap').textContent, /^0 \/ 19/); assert.equal(id('pol-row-2-1').disabled, true); assert.equal(id('pol-row-1-1').disabled, false);
  id('pol-row-1-1').click(); assert.match(id('pol-ph-t').textContent, /^1-1 기기 호출/); assert.equal(id('pol-row-1-1').nextElementSibling, id('pol-ipanel'));
  assert.equal(id('pol-nextstep'), null); assert.equal(id('pol-row-1-2').disabled, false); assert.equal(id('pol-row-1-3').disabled, true);
  assert.ok(id('pol-row-1-2').classList.contains('blink') && id('pol-row-1-2').classList.contains('slow')); assert.ok(id('pol-tick-1-2').classList.contains('slow'));
  nx(p); assert.match(id('pol-ph-t').textContent, /^1-2/); id('pol-prev').click(); assert.match(id('pol-ph-t').textContent, /^1-1/);
  id('pol-row-1-1').click(); assert.equal(!!id('pol-ipanel'), false, '같은 단계를 다시 누르면 접힌다');
});

test('19단계: 끝까지 따라가며 모든 패널에 내용이 있고, 서명·권한 사용 보고까지 나온다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x); const seen = {};
  id('pol-row-1-1').click();
  for (let i = 0; i < 19; i++) { const t = id('pol-ph-t').textContent; const body = id('pol-pbody').textContent; assert.ok(body.length > 15, t); assert.equal(body.includes('undefined'), false, t); assert.equal(body.includes('NaN'), false, t); seen[t.split(' ')[0]] = true; if (i < 18) nx(p); }
  assert.equal(Object.keys(seen).length, 19); assert.ok(id('pol-again')); assert.ok(id('pol-s4-aud1')); assert.ok(id('pol-s4-sig1') === null && id('pol-s4-end'));
  assert.doesNotMatch(p.doc.getElementById('pol-root').textContent, /응급 AI|환자|병원/);
});

test('2-5: 급박하면 요건을 확인해 후보를 좁히고, 급박하지 않으면 조회 없이 영장 신청서 초안만 만든다', { skip }, () => {
  const make = (urgent) => { for (let k = 0; k < 400; k++) { const p = page(); const R = p.doc.getElementById('pol-row-1-1'); R.click(); walk(p, 8); const g = p.doc.getElementById('pol-s2-gate'); if (g && (/해당 —/.test(g.textContent) === urgent)) return p; } throw new Error('no case'); };
  const u = make(true), uid = (x) => u.doc.getElementById(x); assert.match(uid('pol-ph-t').textContent, /^2-5/); assert.ok(uid('pol-s2-cands').querySelectorAll('tbody tr').length >= 1); assert.match(uid('pol-s2-scope').textContent, /통화·문자 내용은 제외/); assert.match(uid('pol-ipanel').textContent, /후보일 뿐/);
  const n = make(false), nid = (x) => n.doc.getElementById(x); assert.match(nid('pol-s2-scope').textContent, /하지 않음/); assert.equal(nid('pol-s2-cands'), null); assert.match(nid('pol-ipanel').textContent, /영장 신청서 초안/);
});

test('3-1 에서 계획이 굳고, 3-5 용의자 이동 뒤에도 앞 단계는 그때의 판단을 보여 주며 4단계는 새 계획을 따른다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x); id('pol-row-1-1').click(); walk(p, 10); assert.match(id('pol-ph-t').textContent, /^3-1/);
  const plan0 = id('pol-s3-tbl').textContent; walk(p, 4); assert.match(id('pol-ph-t').textContent, /^3-5/); assert.equal(id('pol-ev-new'), null);
  id('pol-ev').click(); assert.ok(id('pol-ev-new')); assert.match(id('pol-ph-n').textContent, /3-5|단계 15/); assert.equal(id('pol-ev').disabled, true);
  id('pol-row-3-1').click(); assert.equal(id('pol-s3-tbl').textContent, plan0, '앞 단계는 그때의 판단 그대로');
  id('pol-row-3-5').click(); nx(p); assert.match(id('pol-ph-t').textContent, /^4-1/); assert.match(id('pol-pbody').textContent, /피해자 쪽 팀|안전 확보/);
});

test('비어 있는 팀이 없어도 가장 가까운 팀을 돌려 보내고 인근 관할에 지원을 요청한다', { skip }, () => {
  const N = api(); const U = N.newUnits(); U.forEach((u) => { u.free = false; });
  const r = N.match('assault', 'p1', U); assert.equal(r.go.kind, 'reassign'); assert.ok(r.go.lead.eta >= 3);
});

test('시뮬레이션 버튼: 오른쪽 위에서 열면 1-1 부터 자동으로 끝까지 진행하고, 닫기·바깥 클릭으로 닫힌다', { skip }, () => {
  const p = page(); const q = fake(p); const id = (x) => p.doc.getElementById(x);
  assert.ok(id('pol-sim')); id('pol-sim').click(); assert.equal(id('pol-sim').disabled, true); assert.ok(id('pol-apanel').classList.contains('open')); assert.match(id('pol-au-t').textContent, /^1-1/);
  for (let k = 0; k < 40 && q.length; k++) { fire(q, 4000); if (id('pol-au-t').textContent.startsWith('4-4')) break; }
  assert.match(id('pol-au-t').textContent, /^4-4/); assert.ok(id('pol-s4-end') === null && id('pol-au-body').textContent.length > 30);
  id('pol-back').click(); while (q.length) q.shift().fn(); assert.equal(id('pol-apanel').classList.contains('open'), false); assert.equal(id('pol-sim').disabled, false);
});

test('시뮬레이션은 화면의 단계 목록·패널과 완전히 분리되어 있고 id 가 겹치지 않는다', { skip }, () => {
  const p = page(); const q = fake(p); const id = (x) => p.doc.getElementById(x);
  id('pol-draw').click(); id('pol-row-1-1').click(); walk(p, 2);
  const snap = () => ({ cap: id('pol-bar-cap').textContent, hint: id('pol-next-hint').textContent, rows: [...p.doc.querySelectorAll('.srow .sst')].map((x) => x.textContent).join(), panel: id('pol-ipanel').innerHTML });
  const before = snap(); id('pol-sim').click();
  for (let k = 0; k < 25 && q.length; k++) { fire(q, 4000); if (id('pol-au-t').textContent.startsWith('4-')) break; }
  assert.deepEqual(snap(), before); assert.equal(p.doc.querySelectorAll('[id]').length, new Set([...p.doc.querySelectorAll('[id]')].map((x) => x.id)).size);
  const aBefore = id('pol-apanel').outerHTML; id('pol-row-1-2').click(); assert.match(id('pol-au-t').textContent, /^4-/); assert.match(id('pol-ph-t').textContent, /^1-2/);
  assert.equal(id('pol-panel'), null, '오른쪽 고정 패널은 페이지 단계용이 아니다'); assert.ok(aBefore.length > 100);
});

test('새 사건 뽑기: 처음엔 깜박이고, 뽑은 뒤에는 다음 할 일 배너가 따라온다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x);
  assert.ok(id('pol-draw').classList.contains('blink')); assert.equal(id('pol-next-hint'), null); id('pol-draw').click(); assert.equal(id('pol-draw').classList.contains('blink'), false);
  assert.match(id('pol-next-hint').textContent, /1-1 기기 호출/); assert.ok(id('pol-row-1-1').classList.contains('blink'));
  id('pol-row-1-1').click(); assert.match(id('pol-next-hint').textContent, /천천히 깜박이는 “1-2 메시지 구성”/);
});

test('평소 준비: 기기·보내는 정보·허용한 질문은 이 브라우저에만 저장되고 외부로 나가지 않는다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x);
  assert.ok(id('pol-sh-loc').disabled); assert.equal(p.doc.querySelectorAll('#pol-s-prep .chk input').length, 7 + 2 + 1);
  id('pol-sh-prior').click(); assert.match(p.w.localStorage.getItem('navi-pol-v1'), /prior/); assert.equal(p.fetched(), 0);
  const res = []; p.N.on('result', (x) => res.push(x)); p.N.nav({ do: 'consent' }); p.N.nav({ do: 'nope' }); assert.equal(res[0].ok, true); assert.equal(res[1].ok, false);
});

test('Material Design 3 와 레이아웃: 응급과 같은 규격, .pol 안으로 한정, 네트워크 호출 없음', () => {
  assert.match(css, /--md-ease:cubic-bezier\(\.2,0,0,1\)/); assert.match(css, /\.pol \.bar\{display:grid;grid-template-columns:4fr 6fr 5fr 4fr/); assert.match(css, /\.pol \.srow:hover:not\(:disabled\)::before\{opacity:\.08\}/); assert.match(css, /\.pol \.ipanel\{[^}]*border-radius:16px/);
  const sel = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').split('}').map((x) => x.split('{')[0].trim()).filter((x) => x && !x.startsWith('@') && !/^\d+%|^from|^to/.test(x));
  assert.deepEqual(sel.filter((x) => x.split(',').some((y) => !/\.pol\b/.test(y))).slice(0, 5), []);
  assert.doesNotMatch(app, /fetch\(|XMLHttpRequest|sendBeacon/); assert.doesNotMatch(css, /\.emg\b/);
});

test('desktop.html 연결과 배포 목록', () => {
  assert.match(d, /tab-btn-pol/); assert.match(d, /pol-root/); assert.match(d, /_polOpen\('call'\)/); assert.match(d, /치안 시뮬레이션>pol:call/); assert.match(d, /평소 준비>pol:prep/);
  assert.match(d, /police-app\.js/); assert.match(d, /police\.css/); assert.match(paths, /"police-app\.js"/); assert.match(paths, /"police\.css"/);
});
