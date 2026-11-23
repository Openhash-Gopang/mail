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
  const txt = () => doc.getElementById('pol-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, txt, btn, fetched: () => fetched, N: w.NaviPolice };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviPolice; };

test('reportText: 유형·장소·상황이 있어야 만들어지고 선택 항목이 붙는다', { skip }, () => {
  const N = api();
  assert.equal(N.reportText({ kind: '폭행·위협', place: '', desc: 'x' }), null); assert.equal(N.reportText({ kind: '없는유형', place: 'a', desc: 'b' }), null);
  const t = N.reportText({ kind: '폭행·위협', place: '○○ 편의점 앞', desc: '취객이 행인을 때려요', who: '검은 모자', car: '12가 3456', when: '방금' });
  assert.match(t, /^\[신고\] 폭행·위협\n장소: ○○ 편의점 앞\n상황: 취객이 행인을 때려요\n시각: 방금\n상대 인상착의: 검은 모자\n차량: 12가 3456$/);
  assert.doesNotMatch(N.reportText({ kind: '도난·절도', place: 'a', desc: 'b' }), /인상착의|차량|시각/);
});

test('dispatch: 인력·차량 배정과 부족 시 범위 확대', { skip }, () => {
  const N = api();
  const a = N.dispatch({ kind: '폭행·위협', cctv: '6', off: '3', car: '1', need: '' }); assert.equal(a.need, 2); assert.equal(a.send, 2); assert.equal(a.cars, 1); assert.equal(a.widen, false); assert.equal(a.urgent, true);
  const b = N.dispatch({ kind: '폭행·위협', cctv: '0', off: '1', car: '5', need: '4' }); assert.equal(b.send, 1); assert.equal(b.shortage, 3); assert.equal(b.widen, true); assert.equal(b.cars, 1);
  assert.equal(N.dispatch({ kind: '도난·절도', cctv: '1', off: '0', car: '1', need: '' }).send, 0);
  assert.equal(N.dispatch({ kind: '도난·절도', cctv: '1', off: '1.5', car: '1', need: '' }), null); assert.equal(N.dispatch({ kind: '도난·절도', cctv: '1', off: '1', car: '1', need: '0' }), null); assert.equal(N.dispatch({ kind: 'x', cctv: '1', off: '1', car: '1' }), null);
});

test('신고: 112 전화·문자 링크, 직접 연락 안내, 문장 미리보기, 검증, 기록 저장', { skip }, () => {
  const p = page('report');
  assert.match(p.doc.getElementById('pol-warn').textContent, /112에 먼저/); assert.ok(p.doc.querySelector('a[href="tel:112"]')); assert.ok(p.doc.querySelector('a[href="sms:112"]'));
  p.btn('기록에 저장').click(); assert.match(p.txt(), /장소를 적어/); assert.match(p.txt(), /상황을 적어/);
  type(p, 'pol-place', '○○ 편의점 앞'); type(p, 'pol-desc', '취객 폭행'); assert.match(p.doc.getElementById('pol-rt').textContent, /장소: ○○ 편의점 앞/);
  p.btn('기록에 저장').click(); assert.equal(JSON.parse(p.w.localStorage.getItem('navi-pol-v1')).log.length, 1);
  assert.equal(p.fetched(), 0);
});

test('대응 원리: 5단계와 설계 단계·법적 근거 안내', { skip }, () => {
  const p = page('principle'); const t = p.txt();
  for (const re of [/CCTV/, /직접 제어/, /통신 기록/, /경찰서·파출소/, /자율주행 치안 차량/, /설계 원칙/]) assert.match(t, re);
  assert.match(p.doc.getElementById('pol-legal').textContent, /법적 근거/);
});

test('대응 시뮬레이션: 배정 결과와 부족 안내', { skip }, () => {
  const p = page('sim');
  assert.equal(p.doc.getElementById('pol-s-send').textContent, '2명'); assert.equal(p.doc.getElementById('pol-s-cars').textContent, '1대'); assert.equal(p.doc.getElementById('pol-s-short'), null);
  type(p, 'pol-s-off', '1'); assert.equal(p.doc.getElementById('pol-s-send').textContent, '1명'); assert.match(p.doc.getElementById('pol-s-short').textContent, /1명이 모자라요/);
  type(p, 'pol-s-off', 'x'); assert.match(p.doc.getElementById('pol-s-out').textContent, /정수/);
  assert.equal(p.fetched(), 0);
});

test('내 신고 기록: 상태·접수번호·삭제, 공개 범위, 탭 이동', { skip }, () => {
  const p = page('report'); type(p, 'pol-place', '골목'); type(p, 'pol-desc', '수상한 사람'); p.btn('기록에 저장').click();
  p.N.view('log'); assert.equal(p.doc.getElementById('pol-l0').textContent, '1건'); assert.equal(p.doc.getElementById('pol-l1').textContent, '1건');
  const id = JSON.parse(p.w.localStorage.getItem('navi-pol-v1')).log[0].id, s = p.doc.getElementById('pol-st-' + id); s.value = '처리 완료'; s.dispatchEvent(new p.w.Event('change'));
  assert.equal(p.doc.getElementById('pol-l1').textContent, '0건');
  const no = p.doc.getElementById('pol-no-' + id); no.value = 'A-123'; no.dispatchEvent(new p.w.Event('change')); assert.equal(JSON.parse(p.w.localStorage.getItem('navi-pol-v1')).log[0].no, 'A-123');
  p.btn('삭제').click(); assert.match(p.txt(), /아직 신고 기록이 없어요/);
  p.N.view('consent'); assert.ok(p.doc.getElementById('pol-sh-loc').disabled); const cb = p.doc.getElementById('pol-sh-phone'); cb.checked = true; cb.dispatchEvent(new p.w.Event('change'));
  assert.match(p.doc.getElementById('pol-c-n').textContent, /1 \/ 4/);
  for (const v of ['report', 'principle', 'sim', 'log', 'consent']) { p.N.view(v); assert.ok(p.txt().length > 20, v); }
  assert.equal(p.doc.querySelectorAll('.tab').length, 5);
});

test('CSS는 .pol 아래로 한정, 네트워크 호출 없음', () => {
  const sel = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').split('}').map((x) => x.split('{')[0].trim()).filter((x) => x && !x.startsWith('@') && !/^\d+%|^from|^to/.test(x));
  assert.deepEqual(sel.filter((x) => x.split(',').some((y) => !/\.pol\b/.test(y))).slice(0, 5), []);
  assert.doesNotMatch(app, /fetch\(|XMLHttpRequest|sendBeacon/);
});

test('desktop.html: 치안 전용 화면, 이름은 치안, 보안은 PDV 로 연결', () => {
  assert.match(d, /tab-btn-pol/); assert.match(d, /pol-root/); assert.match(d, /_polOpen/); assert.match(d, /key === 'kpolice' && !_polChat/);
  assert.match(d, /\['kpolice','치안'\]/); assert.doesNotMatch(d, /\['kpolice','치안 신고'\]/); assert.match(d, /pol:report/);
  assert.match(d, /if \(key === 'ksecurity'\) \{ _infraVia = key; _switchTab\('vault'\); return; \}/);
  assert.match(d, /police-app\.js/); assert.match(d, /police\.css/);
  assert.match(paths, /"police-app\.js"/); assert.match(paths, /"police\.css"/);
});
