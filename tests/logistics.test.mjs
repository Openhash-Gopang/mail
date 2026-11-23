import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../logistics-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../logistics.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
function page(view) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  w.eval(app); const doc = w.document, asks = [];
  w.NaviLogistics.on('ask', (t) => asks.push(t)); w.NaviLogistics.mount(doc.getElementById('m'), { view });
  const txt = () => doc.getElementById('lg-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, txt, btn, fetched: () => fetched, N: w.NaviLogistics };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviLogistics; };

test('packBins: 합차로 차량 수 감소, 용량 초과·빈 값은 null', { skip }, () => {
  const N = api(), r = N.packBins(['40', '25', '60', '15', '35', '20'], '100');
  assert.equal(r.n, 2); assert.equal(r.naive, 6); assert.equal(r.saved, 4); assert.ok(r.bins.every((b) => b.load <= 100));
  assert.equal(N.packBins(['101'], '100'), null); assert.equal(N.packBins([], '100'), null); assert.equal(N.packBins(['0'], '100'), null); assert.equal(N.packBins(['5'], '0'), null);
  assert.equal(N.packBins(['60', '60'], '100').n, 2);
});

test('bestRoute: 일직선 경유지는 가까운 곳부터, 넣은 순서보다 짧다', { skip }, () => {
  const N = api(), s = [{ x: 10, y: 0 }, { x: 2, y: 0 }, { x: 6, y: 0 }], r = N.bestRoute({ x: 0, y: 0 }, s);
  assert.deepEqual([...r.order], [1, 2, 0]); assert.equal(r.base, 28); assert.equal(r.dist, 20); assert.equal(r.saved, 8);
  assert.equal(N.bestRoute({ x: 0, y: 0 }, []), null); assert.equal(N.bestRoute({ x: NaN, y: 0 }, s), null);
  const sq = N.bestRoute({ x: 0, y: 0 }, [{ x: 4, y: 4 }, { x: 4, y: 0 }, { x: 0, y: 4 }, { x: 2, y: 2 }]); assert.ok(sq.dist <= sq.base + 1e-9);
});

test('schedule: 도착 시각 · 지연 반영 · 마감 판정', { skip }, () => {
  const N = api(), dep = { x: 0, y: 0 }, st = [{ name: 'A', x: 20, y: 0, dl: '' }, { name: 'B', x: 40, y: 0, dl: 10 * 60 + 10 }];
  const r = N.schedule(dep, st, [0, 1], '40', '5', '09:00', '', ''); assert.equal(r.rows[0].arrive, 570); assert.equal(r.rows[1].arrive, 605); assert.equal(r.late, 0);
  const l = N.schedule(dep, st, [0, 1], '40', '5', '09:00', '20', '1'); assert.equal(l.rows[1].arrive, 625); assert.equal(l.rows[1].late, true); assert.equal(l.late, 1);
  assert.equal(N.schedule(dep, st, [0, 1], '0', '5', '09:00', '', ''), null); assert.equal(N.schedule(dep, st, [0, 1], '40', '5', '25:00', '', ''), null); assert.equal(N.schedule(dep, st, [0, 1], '40', '5', '09:00', '20', '9'), null);
  assert.equal(N.parseHM('09:05'), 545); assert.ok(Number.isNaN(N.parseHM('9시')));
});

test('화면: 물류 원리 · 설계 원칙, 전송 없음', { skip }, () => {
  const p = page(); assert.match(p.txt(), /총비용/); assert.match(p.txt(), /설계 원칙/); assert.match(p.txt(), /실시간으로 갱신/); assert.equal(p.fetched(), 0);
});

test('화면: 합차 효과', { skip }, () => {
  const p = page('pack'); type(p, 'lg-p-items', '40, 25, 60, 15, 35, 20'); type(p, 'lg-p-cap', '100');
  assert.match(p.doc.getElementById('lg-p-n').textContent, /2대/); assert.match(p.doc.getElementById('lg-p-saved').textContent, /4대/); assert.match(p.doc.getElementById('lg-p-res').textContent, /67%/); assert.equal(p.fetched(), 0);
});

test('화면: 경유지 저장 · 경로 · 도착 시각 · 삭제', { skip }, () => {
  const p = page('route'); p.btn('경유지 저장').click(); assert.match(p.txt(), /경유지 이름을 적어/);
  const add = (n, x, y, dl) => { type(p, 'lg-r-name', n); type(p, 'lg-r-x', x); type(p, 'lg-r-y', y); type(p, 'lg-r-dl', dl || ''); p.btn('경유지 저장').click(); };
  add('먼 곳', '10', '0'); add('가까운 곳', '2', '0'); add('중간', '6', '0', '09:20');
  assert.equal(JSON.parse(p.w.localStorage.getItem('navi-logistics-v1')).stops.length, 3);
  assert.match(p.doc.getElementById('lg-r-dist').textContent, /20km/); assert.match(p.doc.getElementById('lg-r-saved').textContent, /8km/);
  type(p, 'lg-r-speed', '60'); type(p, 'lg-r-start', '09:00'); assert.match(p.doc.getElementById('lg-r-res').textContent, /마감을 넘기는 곳은 없어요/);
  type(p, 'lg-r-after', '1'); type(p, 'lg-r-delay', '30'); assert.match(p.doc.getElementById('lg-r-res').textContent, /1곳/);
  p.btn('삭제').click(); assert.equal(JSON.parse(p.w.localStorage.getItem('navi-logistics-v1')).stops.length, 2); assert.equal(p.fetched(), 0);
});

test('화면: 물품 메모 저장 · 삭제, 검증', { skip }, () => {
  const p = page('parcels'); p.btn('메모 저장').click(); assert.match(p.txt(), /물품 이름을 적어/);
  type(p, 'lg-m-name', '감귤 상자'); type(p, 'lg-m-from', '한림읍'); type(p, 'lg-m-to', '마포구'); p.btn('메모 저장').click();
  assert.equal(JSON.parse(p.w.localStorage.getItem('navi-logistics-v1')).list[0].name, '감귤 상자'); assert.match(p.txt(), /물품은 보내지 않았어요/);
  p.btn('삭제').click(); assert.equal(JSON.parse(p.w.localStorage.getItem('navi-logistics-v1')).list.length, 0); assert.equal(p.fetched(), 0);
});

test('desktop.html 연결 + 경로 + 범위 css', { skip }, () => {
  assert.ok(d.includes("_lgsOpen('principle')") && d.includes("go.indexOf('lgs:') === 0") && d.includes("if (name === 'lgs') _lgsShow();") && d.includes('id="tab-lgs"') && d.includes("lgs: 'klogistics'"));
  assert.ok(paths.includes('"logistics-app.js"') && paths.includes('"logistics.css"')); assert.ok(css.includes('.lgs '));
});
