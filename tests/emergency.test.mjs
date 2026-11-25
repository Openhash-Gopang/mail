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

test('한 페이지·4단계: 탭 없이 단계 버튼으로 신고→대응→지시→인계를 따라간다', { skip }, () => {
  const p = page(); const root = p.doc.getElementById('emg-root'), id = (x) => p.doc.getElementById(x);
  assert.equal(p.doc.querySelectorAll('.tab, [role="tab"], [role="tablist"]').length, 0); assert.ok(id('emg-mock'));
  assert.ok(id('emg-s1-sig') && id('emg-s1-name').textContent && id('emg-s1-blood').textContent && id('emg-s1-hist').textContent && id('emg-s1-loc').textContent);
  assert.match(id('emg-s1-sig').textContent, /^SIG-/); assert.equal(id('emg-st2'), null); assert.equal(id('emg-next').textContent, '응급 AI에게 전송 ▶');
  id('emg-next').click(); assert.ok(id('emg-st2')); assert.match(id('emg-s2-sig').textContent, /^일치/); assert.ok(id('emg-s2-est').textContent); assert.ok(id('emg-m-res')); assert.equal(id('emg-st3'), null);
  id('emg-next').click(); assert.ok(id('emg-st3')); id('emg-next').click(); assert.ok(id('emg-st4')); assert.equal(id('emg-next'), null);
  assert.ok(id('emg-s4-sig1').textContent.startsWith('SIG-') && id('emg-s4-sig2').textContent.startsWith('SIG-') && id('emg-s4-sig1').textContent !== id('emg-s4-sig2').textContent);
  assert.match(id('emg-s4-end').textContent, /처치가 시작됩니다/); assert.equal(root.textContent.includes('undefined'), false);
  assert.equal(p.fetched(), 0);
  const order = ['emg-s-prep', 'emg-s-sim', 'emg-st1', 'emg-st2', 'emg-st3', 'emg-st4'].map((x) => [...root.querySelectorAll('*')].indexOf(id(x))); assert.ok(order.every((x, k) => x >= 0 && (k === 0 || x > order[k - 1])));
});

test('3단계: 시간 슬라이더로 구급대·의료진·시설의 상태가 바뀐다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x); for (let k = 0; k < 2; k++) id('emg-next').click();
  const t = id('emg-t'); assert.ok(t); t.value = '0'; t.dispatchEvent(new p.w.Event('input'));
  assert.match(id('emg-st-amb').textContent, /이동 중/); assert.match(id('emg-st-fac').textContent, /준비 중/);
  t.value = t.max; t.dispatchEvent(new p.w.Event('input')); assert.equal(id('emg-st-amb').textContent, '병원 도착'); assert.equal(id('emg-st-fac').textContent, '준비 완료'); assert.match(id('emg-st-note').textContent, /모두 도착/);
});

test('2단계: 병·의원 현황을 바꾸면 계획서가 바뀌고, 새 사건을 뽑으면 처음으로 돌아간다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x); id('emg-next').click();
  const docs = [...p.doc.querySelectorAll('[data-doc]')], eqs = [...p.doc.querySelectorAll('[data-eq]')];
  docs.forEach((b) => { if (b.getAttribute('aria-pressed') === 'true') p.doc.querySelector('[data-doc="' + b.dataset.doc + '"]').click(); });
  assert.match(id('emg-m-res').textContent, /조합할 수 있는 인력·장비가 없어요/); id('emg-next').click(); assert.ok(id('emg-s3-none'));
  p.btn('처음 상태로').click(); assert.doesNotMatch(id('emg-m-res').textContent, /조합할 수 있는 인력·장비가 없어요/);
  id('emg-draw').click(); assert.equal(id('emg-st2'), null); assert.ok(id('emg-st1')); assert.equal(p.w.localStorage.getItem('navi-emg-v1'), null);
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
