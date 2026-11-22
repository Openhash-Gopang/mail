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

test('detect: 낮을 때·높을 때 이상, 숫자가 아니면 null', { skip }, () => {
  const N = api();
  assert.equal(N.detect('lt', '35', '40').hit, true); assert.equal(N.detect('lt', '40', '40').hit, false);
  assert.equal(N.detect('gt', '450', '300').hit, true); assert.equal(N.detect('gt', '300', '300').hit, false);
  assert.equal(N.detect('gt', '', '300'), null); assert.equal(N.detect('gt', 'abc', '300'), null);
});

test('anomaly: 평소 값 대비 표준편차', { skip }, () => {
  const N = api();
  const r = N.anomaly(['68', '72', '70', '66', '74'], '40', '3'); assert.equal(r.mean, 70); assert.equal(r.abnormal, true); assert.ok(r.z < -3);
  assert.equal(N.anomaly(['68', '72', '70', '66', '74'], '71', '3').abnormal, false);
  assert.equal(N.anomaly(['1', '2'], '1', '3'), null);
  assert.equal(N.anomaly(['70', '70', '70', '70', '70'], '70', '3').abnormal, false);
  assert.equal(N.anomaly(['70', '70', '70', '70', '70'], '60', '3').abnormal, true);
});

test('plan: 공개를 허용한 항목만 보낸다(위치는 항상)', { skip }, () => {
  const N = api();
  const a = N.plan('cardiac', {}); assert.deepEqual([...a.send], ['현재 위치']); assert.ok(a.blocked.includes('과거 질병 이력')); assert.equal(a.steps.length, 5);
  const b = N.plan('cardiac', { cond: 1, age: 1 }); assert.ok(b.send.includes('과거 질병 이력') && b.send.includes('나이(연령대)')); assert.ok(!b.blocked.includes('과거 질병 이력'));
  assert.deepEqual([...N.plan('fire', {}).send], ['현재 위치']); assert.equal(N.plan('nope', {}), null);
});

test('devSummary', { skip }, () => {
  const N = api(); const m = N.devSummary([{ kind: 'CCTV', chk: '2026-11-01' }, { kind: '스마트워치', chk: '2027-01-01' }, { kind: '연기 센서', chk: '' }], '2026-11-23');
  assert.equal(m.count, 3); assert.equal(m.due, 1);
});

test('응급 연락: 119·112 전화 링크와 직접 전화 안내, 응급 정보 카드 저장', { skip }, () => {
  const p = page('contact');
  assert.match(p.doc.getElementById('emg-warn').textContent, /119에 전화/); assert.ok(p.doc.querySelector('a[href="tel:119"]')); assert.ok(p.doc.querySelector('a[href="tel:112"]'));
  type(p, 'emg-i-blood', 'A형'); assert.equal(JSON.parse(p.w.localStorage.getItem('navi-emg-v1')).info.blood, 'A형');
  p.btn('모두 지우기').click(); assert.equal(p.doc.getElementById('emg-i-blood').value, '');
  assert.equal(p.fetched(), 0);
});

test('대응 원리: 센서·이상 탐지·AI 판단·자동 대응과 설계 단계 표시', { skip }, () => {
  const t = page('principle').txt();
  for (const re of [/스마트워치/, /CCTV/, /이상 탐지/, /사건 종류/, /자동으로/, /설계 원칙/, /화재/, /개인 위급/]) assert.match(t, re);
});

test('대응 시뮬레이션: 심박 저하 → 감지·순서·보낼 데이터, 공개 범위 반영', { skip }, () => {
  const p = page('sim');
  type(p, 'emg-s-val', '55'); assert.match(p.doc.getElementById('emg-s-res').textContent, /이상이 아니에요/);
  type(p, 'emg-s-val', '35'); assert.match(p.doc.getElementById('emg-s-res').textContent, /이상 감지/);
  assert.match(p.txt(), /119 구조팀/); assert.equal(p.doc.getElementById('emg-s-send').textContent, '현재 위치'); assert.match(p.doc.getElementById('emg-s-block').textContent, /과거 질병 이력/);
  p.N.view('consent'); const cb = p.doc.getElementById('emg-sh-cond'); cb.checked = true; cb.dispatchEvent(new p.w.Event('change'));
  p.N.view('sim'); type(p, 'emg-s-val', '35'); assert.match(p.doc.getElementById('emg-s-send').textContent, /과거 질병 이력/);
  type(p, 'emg-b-base', '68, 72, 70, 66, 74'); assert.match(p.doc.getElementById('emg-b-res').textContent, /이상/);
  assert.equal(p.fetched(), 0);
});

test('시뮬레이션: 화재(연기) 카테고리', { skip }, () => {
  const p = page('sim'); const s = p.doc.getElementById('emg-s-cat'); s.value = 'fire'; s.dispatchEvent(new p.w.Event('change'));
  type(p, 'emg-s-val', '450'); assert.match(p.doc.getElementById('emg-s-res').textContent, /건물 화재/); assert.match(p.txt(), /온도·영상/);
});

test('내 장치·공개 범위·탭 이동', { skip }, () => {
  const p = page('devices');
  p.btn('기록하기').click(); assert.match(p.txt(), /장치 이름을 적어/);
  type(p, 'emg-dn', '현관 CCTV'); type(p, 'emg-dc', '2026-01-01'); p.btn('기록하기').click();
  assert.equal(p.doc.getElementById('emg-d0').textContent, '1개'); assert.equal(p.doc.getElementById('emg-d1').textContent, '1개');
  p.btn('삭제').click(); assert.match(p.txt(), /아직 등록한 장치가 없어요/);
  for (const v of ['contact', 'principle', 'sim', 'devices', 'consent']) { p.N.view(v); assert.ok(p.txt().length > 20, v); }
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
  assert.match(d, /emergency-app\.js/); assert.match(d, /emergency\.css/); assert.match(d, /emg:contact/);
  assert.match(paths, /"emergency-app\.js"/); assert.match(paths, /"emergency\.css"/);
});
