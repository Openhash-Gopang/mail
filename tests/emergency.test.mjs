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

test('응급 호출: 기기·상태에 따라 전달 형태가 달라지고 공개 선택을 따른다', { skip }, () => {
  const p = page('call'); const t = p.txt();
  assert.doesNotMatch(p.doc.body.textContent, /119|112/); assert.ok(p.doc.getElementById('emg-mock'));
  type(p, 'emg-say', '숨이 안 쉬어져요'); p.doc.getElementById('emg-fire').click();
  assert.equal(p.doc.getElementById('emg-c-mode').textContent, '음성 + 응급'); assert.equal(p.doc.getElementById('emg-c-body').textContent, '숨이 안 쉬어져요');
  assert.equal(p.doc.getElementById('emg-c-send').textContent, '현재 위치');
  p.doc.querySelector('[data-v="none"]').click(); p.doc.getElementById('emg-fire').click();
  assert.equal(p.doc.getElementById('emg-c-mode').textContent, '응급'); assert.match(p.doc.getElementById('emg-c-flag').textContent, /오직/); assert.equal(p.doc.getElementById('emg-c-body'), null);
  p.N.view('consent'); const cb = p.doc.getElementById('emg-sh-hist'); cb.checked = true; cb.dispatchEvent(new p.w.Event('change'));
  const ak = p.doc.getElementById('emg-ak-meal'); ak.checked = true; ak.dispatchEvent(new p.w.Event('change'));
  p.N.view('call'); p.doc.getElementById('emg-fire').click();
  assert.match(p.doc.getElementById('emg-c-send').textContent, /병력/); assert.match(p.doc.getElementById('emg-c-ask').textContent, /마지막으로 먹은 음식/);
  assert.equal(p.fetched(), 0); assert.ok(t.length > 20);
});

test('대응 흐름: 호출부터 병·의원 조합까지', { skip }, () => {
  const t = page('flow').txt();
  for (const re of [/가장 단순한 조작/, /나만의 AI 비서/, /마지막으로 먹은 음식/, /최단 시간/, /실시간/, /자율주행차량/, /일정/, /모의/]) assert.match(t, re);
  assert.doesNotMatch(t, /119|112|CCTV|센서/);
});

test('자원 조합: 인력·장비 상태를 바꾸면 결과가 바뀐다', { skip }, () => {
  const p = page('match');
  assert.match(p.doc.getElementById('emg-m-kind').textContent, /가상 중앙병원 의료진이 가상 해안병원 장비/);
  p.doc.querySelector('[data-doc="h1:심장내과"]').click(); assert.match(p.doc.getElementById('emg-m-res').textContent, /조합할 수 있는 인력·장비가 없어요/);
  p.doc.querySelector('[data-doc="h1:심장내과"]').click(); p.doc.querySelector('[data-eq="h2:심혈관 중재 장비"]').click(); assert.match(p.doc.getElementById('emg-m-res').textContent, /조합할 수 있는 인력·장비가 없어요/);
  p.btn('처음 상태로').click(); assert.match(p.doc.getElementById('emg-m-kind').textContent, /가상 중앙병원/);
  const s = p.doc.getElementById('emg-m-need'); s.value = 'stroke'; s.dispatchEvent(new p.w.Event('change')); assert.match(p.doc.getElementById('emg-m-res').textContent, /가상 산악병원|가상 중앙병원/);
  assert.equal(p.fetched(), 0); assert.equal(p.w.localStorage.getItem('navi-emg-v1'), null);
});

test('내 기기·보내는 정보·탭 이동', { skip }, () => {
  const p = page('devices');
  p.btn('기록하기').click(); assert.match(p.txt(), /기기 이름을 적어/);
  type(p, 'emg-dn', '내 폰'); type(p, 'emg-dc', '2026-01-01'); p.btn('기록하기').click();
  assert.equal(p.doc.getElementById('emg-d0').textContent, '1개'); assert.equal(p.doc.getElementById('emg-d2').textContent, '1개'); assert.equal(p.doc.getElementById('emg-d1').textContent, '1개');
  p.btn('삭제').click(); assert.match(p.txt(), /아직 등록한 기기가 없어요/);
  for (const v of ['call', 'flow', 'match', 'devices', 'consent']) { p.N.view(v); assert.ok(p.txt().length > 20, v); }
  assert.equal(p.doc.querySelectorAll('.tab').length, 5);
  p.N.view('consent'); assert.ok(p.doc.getElementById('emg-sh-loc').disabled);
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
