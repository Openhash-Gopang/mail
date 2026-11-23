import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../jit-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../jit.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
const sp = readFileSync(new URL('../infra-sp.js', import.meta.url), 'utf8');
function page(view) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  w.eval(app); const doc = w.document, asks = [];
  w.NaviJit.on('ask', (t) => asks.push(t)); w.NaviJit.mount(doc.getElementById('m'), { view });
  const txt = () => doc.getElementById('jt-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, txt, btn, fetched: () => fetched, N: w.NaviJit };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const pick = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('change', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviJit; };
const J = (x) => JSON.parse(JSON.stringify(x));
const near = (a, b, e = 1e-3) => assert.ok(Math.abs(a - b) < e, a + ' ≈ ' + b);
const P2 = [{ name: 'a', x: 0, y: 0, w: 100 }, { name: 'b', x: 10, y: 0, w: 100 }];
const geo = { area: '100000', speed: '50', circ: '1.3' };
const tiers = [{ name: '전국', n: '1', wait: '48', pen: '0' }, { name: '광역', n: '17', wait: '24', pen: '2' }, { name: '지역', n: '250', wait: '12', pen: '5' }, { name: '근린', n: '3500', wait: '4', pen: '10' }];

test('classify: ABC(누적 80/95%) × XYZ(변동 50/100%)로 품목 수를 줄인다', { skip }, () => {
  const N = api(); const it = [[100, 20], [50, 70], [30, 150], [10, 20], [5, 20], [5, 20]].map((x, i) => ({ name: 'p' + i, annual: x[0], cv: x[1] }));
  const r = J(N.classify(it)); assert.deepEqual(r.rows.map((x) => x.abc).join(''), 'AAABCC'); assert.deepEqual(r.rows.slice(0, 3).map((x) => x.xyz).join(''), 'XYZ'); assert.equal(r.n, 6); assert.equal(r.nClasses, 5);
  assert.equal(N.classify([]), null); assert.equal(N.classify([{ name: 'x', annual: 0, cv: 10 }]), null); assert.equal(N.classify([{ name: 'x', annual: 5, cv: -1 }]), null);
});

test('dailyCurve: 평균 1로 정규화한 연중 곡선의 첨두·최저일', { skip }, () => {
  const N = api(); const blank = Array(12).fill(''), dw = Array(7).fill('');
  const a = J(N.dailyCurve('2027', blank, dw)); assert.equal(a.days, 365); near(a.peak, 1); near(a.min, 1);
  const sat = [...dw]; sat[5] = '2'; const b = J(N.dailyCurve('2027', blank, sat)); near(b.peak, 2 * 365 / 417); near(b.min, 365 / 417); assert.equal(b.peakDate, '2027-01-02'); assert.equal(b.minDate, '2027-01-01');
  assert.equal(J(N.dailyCurve('2028', blank, dw)).days, 366); assert.equal(N.dailyCurve('1800', blank, dw), null); assert.equal(N.dailyCurve('2027', blank.map((x, i) => i ? x : '0'), dw), null); assert.equal(N.dailyCurve('2027', blank.slice(1), dw), null);
});

test('tierCosts: 긴급하면 가까운 계층, 규모가 중요하면 큰 계층, 거리 ±15% 안정성', { skip }, () => {
  const N = api(); const a = J(N.tierCosts({ urg: 5, scale: 0 }, tiers, geo, 1)); assert.equal(a.best, 3); near(a.rows[0].dist, 0.3826 * Math.sqrt(100000) * 1.3, 0.01); near(a.rows[0].J, 5 * (a.rows[0].dist / 50 + 48), 0.01);
  const b = J(N.tierCosts({ urg: 1, scale: 5 }, tiers, geo, 1)); assert.equal(b.best, 1); assert.equal(b.stable, true);
  assert.equal(N.tierCosts({ urg: 6, scale: 0 }, tiers, geo), null); assert.equal(N.tierCosts({ urg: 3, scale: 1 }, tiers, { ...geo, circ: '0.5' }), null); assert.equal(N.tierCosts({ urg: 3, scale: 1 }, [{ name: 'x', n: '0', wait: '1', pen: '1' }], geo), null);
});

test('evalSites: 이동 시간 + M/M/1 대기, 과부하·첨두 과부하', { skip }, () => {
  const N = api(); const s = { name: 'S', x: 0, y: 0, svc: 0.01, cap: 400 }; const r = J(N.evalSites(P2, [s], geo, 1)); assert.equal(r.feasible, true); near(r.avgDist, 6.5); near(r.travel, 0.13); near(r.wait, 0.01); near(r.total, 0.14); assert.equal(r.rows[0].rho, 0.5);
  const o = J(N.evalSites(P2, [{ ...s, cap: 200 }], geo, 1)); assert.equal(o.feasible, false); assert.deepEqual(o.overloaded, ['S']);
  const pk = J(N.evalSites(P2, [s], geo, 2)); assert.equal(pk.feasible, true); assert.deepEqual(pk.peakOver, ['S']);
  const two = J(N.evalSites(P2, [s, { name: 'T', x: 10, y: 0, svc: 0.01, cap: 400 }], geo, 1)); near(two.avgDist, 0); assert.equal(two.rows[0].load, 100);
  assert.equal(N.evalSites([], [s], geo), null); assert.equal(N.evalSites(P2, [], geo), null); assert.equal(N.evalSites(P2, [s], { speed: '0', circ: '1.3' }), null); assert.equal(N.evalSites(P2, [{ ...s, cap: 0 }], geo), null);
});

test('bestSingle·freeOptimum: 한 곳만 둘 때 순위, 기하 중앙값과 무게중심', { skip }, () => {
  const N = api(); const A = { name: 'A', x: 0, y: 0, svc: 0.01, cap: 400 }, B = { name: 'B', x: 20, y: 0, svc: 0.01, cap: 400 }, C = { name: 'C', x: 5, y: 0, svc: 0.01, cap: 150 };
  const r = J(N.bestSingle(P2, [B, A, C], geo, 1)); assert.deepEqual(r.map((x) => x.name), ['A', 'B', 'C']); assert.equal(r[2].feasible, false); near(r[1].avgDist, 19.5);
  const f = J(N.freeOptimum(P2)); near(f.centroid.x, 5); near(f.median.dist, 5, 0.01);
  const g = J(N.freeOptimum([{ x: 0, y: 0, w: 3 }, { x: 10, y: 0, w: 1 }])); assert.ok(g.median.dist < 2.51, String(g.median.dist)); near(g.centroid.dist, 3.75);
  assert.equal(N.freeOptimum([]), null); assert.equal(N.freeOptimum([{ x: -1, y: 0, w: 1 }]), null);
});

test('화면: 여섯 탭, 안내문, 외부 전송 없음', { skip }, () => {
  const p = page('types'); assert.equal(p.doc.querySelectorAll('.tab').length, 6); assert.match(p.doc.getElementById('jt-note').textContent, /예측이나 계획 결정이 아니에요/); assert.match(p.doc.getElementById('jt-note').textContent, /PDV/);
  ['days', 'grid', 'supply', 'optimum', 'principle'].forEach((v) => { p.N.view(v); assert.ok(p.txt().length > 20, v); }); assert.match(p.txt(), /PDV의 효용|PDV/); assert.match(p.txt(), /집계 통계/); assert.equal(p.fetched(), 0);
});

test('전체 흐름: 품목 유형 → 대표일 → 지역 수요 → 공급 계층 → 최적 지점', { skip }, () => {
  const p = page('types'); p.btn('품목 추가').click(); assert.match(p.txt(), /품목 이름을 적어/);
  for (const [n, a, c] of [['신선 채소', '500', '60'], ['공구', '20', '20']]) { type(p, 'jt-i-name', n); type(p, 'jt-i-annual', a); type(p, 'jt-i-cv', c); p.btn('품목 추가').click(); }
  assert.equal(p.doc.getElementById('jt-t-n').textContent, '2개'); assert.match(p.doc.getElementById('jt-t-sum').textContent, /AY 1개/);
  p.N.view('days'); assert.ok(p.doc.getElementById('jt-d-none')); type(p, 'jt-y-year', '2027'); type(p, 'jt-y-d5', '2'); assert.equal(p.doc.getElementById('jt-d-peak').textContent, '2027-01-02'); assert.equal(p.doc.getElementById('jt-d-days').textContent, '365일');
  p.N.view('optimum'); assert.ok(p.doc.getElementById('jt-o-none'));
  p.N.view('grid'); p.btn('지점 추가').click(); assert.match(p.txt(), /지점 이름을 적어/);
  for (const [n, x, y, w] of [['a', '0', '0', '100'], ['b', '10', '0', '100']]) { type(p, 'jt-p-name', n); type(p, 'jt-p-x', x); type(p, 'jt-p-y', y); type(p, 'jt-p-w', w); p.btn('지점 추가').click(); }
  p.btn('거점 추가').click(); assert.match(p.txt(), /거점 이름을 적어/);
  type(p, 'jt-s-name', 'S'); type(p, 'jt-s-x', '0'); type(p, 'jt-s-y', '0'); type(p, 'jt-s-svc', '0.01'); type(p, 'jt-s-cap', '400'); p.btn('거점 추가').click(); assert.match(p.txt(), /S/);
  p.N.view('supply'); assert.match(p.doc.getElementById('jt-s-sum').textContent, /계층별 선택 수/); type(p, 'jt-c-circ', '0.5'); assert.ok(p.doc.getElementById('jt-s-bad')); type(p, 'jt-c-circ', '1.3');
  p.N.view('optimum'); assert.equal(p.doc.getElementById('jt-o-total').textContent, '0.14시간'); assert.match(p.doc.getElementById('jt-o-msg').textContent, /첨두일/); assert.match(p.doc.getElementById('jt-o-free').textContent, /평균 직선 거리는 5km/);
  const s = JSON.parse(p.w.localStorage.getItem('navi-jit-v1')); assert.equal(s.items.length, 2); assert.equal(s.pts.length, 2); assert.equal(s.sites.length, 1); assert.equal(s.days.year, '2027'); assert.equal(p.fetched(), 0);
});

test('조달 AI에게 묻기는 대화창에 채우기만 한다', { skip }, () => { const p = page('principle'); p.btn('조달 AI에게 묻기').click(); assert.equal(p.asks.length, 1); });

test('연결: desktop.html·paths·SP·CSS', () => {
  assert.match(d, /tab-btn-jit/); assert.match(d, /jit-root-host/); assert.match(d, /jit: 'kjit'/); assert.match(d, /_jitOpen/); assert.match(d, /jit-app\.js\?v=/);
  assert.match(paths, /jit-app\.js/); assert.match(paths, /jit\.css/); assert.match(sp, /"scr": "적시조달 화면"/); assert.match(css, /\.jit/); assert.ok(!/\.sch\b/.test(css));
});
