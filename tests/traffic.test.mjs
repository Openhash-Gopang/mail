import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../traffic-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../traffic.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
function page(view) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  w.eval(app); const doc = w.document, asks = [];
  w.NaviTraffic.on('ask', (t) => asks.push(t)); w.NaviTraffic.mount(doc.getElementById('m'), { view });
  const txt = () => doc.getElementById('tf-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, txt, btn, fetched: () => fetched, N: w.NaviTraffic };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviTraffic; };

test('fleetSize: 가동 비율로 필요한 차량, 범위 밖은 null', { skip }, () => {
  const N = api(), r = N.fleetSize('100000', '5', '15'); assert.equal(r.need, 33334); assert.equal(r.saved, 66666); assert.equal(r.half, true);
  assert.equal(N.fleetSize('100000', '5', '8').half, false); assert.equal(N.fleetSize('100000', '20', '10'), null); assert.equal(N.fleetSize('0', '5', '15'), null); assert.equal(N.fleetSize('100', '5', '101'), null);
});

test('gaps: 안전 간격보다 좁은 쌍', { skip }, () => {
  const N = api(), r = N.gaps(['90', '0', '30', '55'], '20'); assert.deepEqual([...r.gaps], [30, 25, 35]); assert.equal(r.ok, true);
  const w = N.gaps(['0', '10', '50'], '20'); assert.equal(w.tight, 1); assert.equal(w.ok, false); assert.equal(w.min, 10); assert.equal(N.gaps(['1'], '20'), null);
});

test('intersect: 같은 시각 통과 없음, 도착순 대기', { skip }, () => {
  const N = api(), r = N.intersect(['6', '0', '1', '1.5'], '2'); assert.deepEqual([...r.rows.map((x) => x.pass)], [0, 2, 4, 6]);
  for (let i = 1; i < r.rows.length; i++) assert.ok(r.rows[i].pass - r.rows[i - 1].pass >= 2);
  assert.equal(r.max, 2.5); assert.equal(N.intersect(['1'], '2'), null); assert.equal(N.intersect(['1', '2'], '0'), null);
});

test('화면: 교통 원리 · 설계 원칙, 전송 없음', { skip }, () => {
  const p = page(); assert.match(p.txt(), /주행 안내선/); assert.match(p.txt(), /설계 원칙/); assert.match(p.txt(), /1\/2 이하/); assert.equal(p.fetched(), 0);
});

test('화면: 공유 차량 규모', { skip }, () => {
  const p = page('fleet'); type(p, 'tf-f-cars', '100000'); type(p, 'tf-f-now', '5'); type(p, 'tf-f-shared', '15');
  assert.match(p.doc.getElementById('tf-f-need').textContent, /33,334/); assert.match(p.doc.getElementById('tf-f-res').textContent, /1\/2 이하/); assert.equal(p.fetched(), 0);
});

test('화면: 충돌·혼잡 방지', { skip }, () => {
  const p = page('control'); type(p, 'tf-g-pos', '0, 10, 50'); type(p, 'tf-g-safe', '20'); assert.match(p.doc.getElementById('tf-g-res').textContent, /1곳/);
  type(p, 'tf-x-arr', '0, 1, 1.5, 6'); type(p, 'tf-x-gap', '2'); assert.match(p.doc.getElementById('tf-x-max').textContent, /2\.5초/);
});

test('화면: 이동 메모 저장 · 삭제, 검증', { skip }, () => {
  const p = page('trips'); p.btn('메모 저장').click(); assert.match(p.txt(), /출발지를 적어/);
  type(p, 'tf-t-from', '제주공항'); type(p, 'tf-t-to', '한림읍'); p.btn('메모 저장').click();
  assert.equal(JSON.parse(p.w.localStorage.getItem('navi-traffic-v1')).list[0].to, '한림읍'); assert.match(p.txt(), /차량은 부르지 않았어요/);
  p.btn('삭제').click(); assert.equal(JSON.parse(p.w.localStorage.getItem('navi-traffic-v1')).list.length, 0); assert.equal(p.fetched(), 0);
});

test('desktop.html 연결 + 경로 + 범위 css', { skip }, () => {
  assert.ok(d.includes("_trfOpen('principle')") && d.includes("go.indexOf('trf:') === 0") && d.includes("if (name === 'trf') _trfShow();") && d.includes('id="tab-trf"'));
  assert.ok(paths.includes('"traffic-app.js"') && paths.includes('"traffic.css"')); assert.ok(css.includes('.trf '));
});
