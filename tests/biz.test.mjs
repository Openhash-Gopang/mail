import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../biz-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../biz.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
const sp = readFileSync(new URL('../infra-sp.js', import.meta.url), 'utf8');
function page(view) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  w.eval(app); const doc = w.document, asks = [];
  w.NaviBiz.on('ask', (t) => asks.push(t)); w.NaviBiz.mount(doc.getElementById('m'), { view });
  const txt = () => doc.getElementById('bz-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, txt, btn, fetched: () => fetched, N: w.NaviBiz };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const pick = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('change', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviBiz; };
const J = (x) => JSON.parse(JSON.stringify(x));
const good = { forces: { rivalry: 2, entry: 2, substitute: 2, buyer: 2, supplier: 2 }, fit: { exp: 4, proof: 4, edge: 4 }, capital: '30000000', invest: '5000000', fixed: '2000000', price: '10000', varc: '4000', units: '500', ramp: '6' };

test('breakEven: 공헌이익·손익분기 판매량, 단가 ≤ 변동비는 null', { skip }, () => {
  const N = api(); const r = J(N.breakEven('2,000,000', 10000, 4000));
  assert.equal(r.margin, 6000); assert.equal(r.units, 334); assert.equal(r.revenue, 3340000); assert.equal(r.marginRate, 60);
  assert.equal(N.breakEven(1000, 5000, 5000), null); assert.equal(N.breakEven('', 100, 10), null); assert.equal(N.breakEven(-1, 100, 10), null);
});

test('cashPath: 판매량이 직선으로 늘 때 최대 누적 부족액과 흑자 전환 달', { skip }, () => {
  const N = api(); const r = J(N.cashPath(30000000, 5000000, 2000000, 10000, 4000, 500, 6));
  assert.ok(r.need > 5000000 && r.need < 30000000); assert.equal(r.enough, true); assert.equal(r.steadyProfit, 1000000); assert.equal(r.breakMonth, 4);
  assert.equal(J(N.cashPath(1000000, 5000000, 2000000, 10000, 4000, 500, 6)).enough, false);
  assert.equal(N.cashPath(1, 0, 1, 100, 200, 5, 6), null); assert.equal(N.cashPath(1, 0, 1, 100, 10, 5, 0), null); assert.equal(N.cashPath(1, 0, 1, 100, 10, 0, 3), null);
});

test('assessStart: 세 점검 통과 수로 진행 가능·보완 후 시작·재검토', { skip }, () => {
  const N = api(); assert.equal(N.assessStart(good).verdict, '진행 가능');
  assert.equal(N.assessStart({ ...good, forces: { rivalry: 5, entry: 5, substitute: 5, buyer: 5, supplier: 5 } }).verdict, '보완 후 시작');
  const bad = N.assessStart({ ...good, forces: { rivalry: 5, entry: 5, substitute: 5, buyer: 5, supplier: 5 }, fit: { exp: 1, proof: 1, edge: 1 }, units: '100' }); assert.equal(bad.verdict, '재검토'); assert.equal(bad.passes, 0);
  assert.equal(N.assessStart({ ...good, fit: { exp: 4, proof: 4 } }), null); assert.equal(N.assessStart(null), null); assert.equal(N.assessStart({ ...good, price: '' }), null);
});

const rec = (o) => ({ month: '2026-11', revenue: 10000000, cost: 8000000, marketing: 1000000, customers: 200, newc: 50, repeat: 80, proc: 4, learn: 4, ...o });
test('metrics·bsc·suggest: 이익률·성장률·LTV/CAC와 네 관점 신호, 위험마다 개선안 후보', { skip }, () => {
  const N = api(); const m = J(N.metrics(rec(), rec({ month: '2026-10', revenue: 8000000 })));
  assert.equal(m.profit, 2000000); assert.equal(m.margin, 20); assert.equal(m.growth, 25); assert.equal(m.cac, 20000); assert.equal(m.arpu, 50000); assert.equal(m.ltv, 50000 * 0.2 / 0.2); assert.equal(m.ltvCac, 2.5);
  const b = J(N.bsc(rec(), m)); assert.deepEqual(b.map((x) => x.s), ['good', 'watch', 'good', 'good']);
  const s = J(N.suggest(rec(), m)); assert.equal(s.length, 1); assert.equal(s[0].persp, '고객'); assert.equal(s[0].metric, 'LTV/CAC'); assert.equal(s[0].target, 3);
  const loss = rec({ cost: 12000000, proc: 2, learn: 3 }); const ml = N.metrics(loss, null); const sl = J(N.suggest(loss, ml));
  assert.equal(ml.margin, -20); assert.equal(J(N.bsc(loss, ml))[0].s, 'risk'); assert.ok(sl.some((x) => x.persp === '재무' && x.target === 0) && sl.some((x) => x.persp === '내부 프로세스') && sl.some((x) => x.persp === '학습과 성장'));
  assert.equal(N.metrics(null, null), null); assert.equal(N.metrics(rec({ newc: 0 }), null).cac, null);
});

test('effect: 달성·진행·미흡·악화, 목표=시작값이면 null', { skip }, () => {
  const N = api();
  assert.deepEqual(J(N.effect(10, 20, 20)), { pct: 100, status: '달성' }); assert.equal(N.effect(10, 20, 16).status, '진행'); assert.equal(N.effect(10, 20, 12).status, '미흡'); assert.equal(N.effect(10, 20, 8).status, '악화');
  assert.equal(N.effect(10, 10, 12), null); assert.equal(N.effect('', 10, 12), null); assert.equal(N.effect(10, 20, 'x'), null);
});

test('화면: 다섯 탭, 안내문, 외부 전송 없음', { skip }, () => {
  const p = page('home'); assert.equal(p.doc.querySelectorAll('.tab').length, 5); assert.match(p.doc.getElementById('bz-note').textContent, /성공을 보장하지 않아요/);
  ['assess', 'perf', 'cycle', 'theory'].forEach((v) => { p.N.view(v); assert.ok(p.txt().length > 30, v); }); assert.equal(p.fetched(), 0);
});

test('시작 전 판단 화면: 입력하면 손익분기와 판단이 나오고 저장된다', { skip }, () => {
  const p = page('assess'); assert.ok(p.doc.getElementById('bz-be-none') && p.doc.getElementById('bz-as-none'));
  for (const k of ['rivalry', 'entry', 'substitute', 'buyer', 'supplier']) pick(p, 'bz-f-' + k, '2'); for (const k of ['exp', 'proof', 'edge']) pick(p, 'bz-t-' + k, '4');
  type(p, 'bz-a-capital', '30,000,000'); type(p, 'bz-a-invest', '5000000'); type(p, 'bz-a-fixed', '2000000'); type(p, 'bz-a-price', '10000'); type(p, 'bz-a-varc', '4000'); type(p, 'bz-a-units', '500'); type(p, 'bz-a-ramp', '6');
  assert.equal(p.doc.getElementById('bz-be-u').textContent, '334개'); assert.equal(p.doc.getElementById('bz-as-verdict').textContent, '진행 가능'); assert.match(p.doc.getElementById('bz-as-cash').textContent, /4개월째/);
  assert.equal(JSON.parse(p.w.localStorage.getItem('navi-biz-v1')).as.units, '500');
});

test('성과 평가→개선 순환: 기록하면 BSC가 나오고, 개선안이 Plan→Do→Check→Act로 진행되며 효과가 측정된다', { skip }, () => {
  const p = page('perf');
  p.btn('기록 저장').click(); assert.match(p.txt(), /0 이상의 숫자/);
  const set = () => { type(p, 'bz-r-month', '2026-11'); type(p, 'bz-r-revenue', '10000000'); type(p, 'bz-r-cost', '12000000'); type(p, 'bz-r-marketing', '1000000'); type(p, 'bz-r-customers', '200'); type(p, 'bz-r-newc', '50'); type(p, 'bz-r-repeat', '80'); pick(p, 'bz-r-proc', '2'); pick(p, 'bz-r-learn', '4'); };
  set(); p.btn('기록 저장').click(); assert.match(p.doc.getElementById('bz-bsc').textContent, /재무 위험/); assert.equal(p.doc.getElementById('bz-m-margin').textContent, '-20%');
  p.N.view('cycle'); const add = p.btn('개선안으로 추가'); assert.ok(add); add.click();
  let card = p.doc.querySelector('[id^=bz-act-]'); assert.match(card.textContent, /Plan/);
  [...card.querySelectorAll('button')].find((b) => b.textContent.startsWith('적용 시작')).click(); card = p.doc.querySelector('[id^=bz-act-]'); assert.match(card.textContent, /Do/);
  [...card.querySelectorAll('button')].find((b) => b.textContent.startsWith('효과 측정')).click(); card = p.doc.querySelector('[id^=bz-act-]'); assert.match(card.textContent, /Check/);
  const rin = card.querySelector('input[aria-label="결과값"]'); rin.value = '0'; [...card.querySelectorAll('button')].find((b) => b.textContent.startsWith('결과 기록')).click();
  card = p.doc.querySelector('[id^=bz-act-]'); assert.match(card.textContent, /효과 100% — 달성/); [...card.querySelectorAll('button')].find((b) => b.textContent.startsWith('다음 순환')).click();
  const cards = p.doc.querySelectorAll('[id^=bz-act-]'); assert.equal(cards.length, 2); assert.match(cards[0].textContent, /2회차/); assert.match(cards[0].textContent, /목표 미정/);
  [...cards[0].querySelectorAll('button')].find((b) => b.textContent.startsWith('적용 시작')).click(); assert.match(p.txt(), /목표값을 시작값과 다르게/);
});

test('사업 AI에게 묻기는 대화창에 채우기만 한다', { skip }, () => { const p = page('home'); p.btn('사업 AI에게 묻기').click(); assert.equal(p.asks.length, 1); });

test('연결: desktop.html·paths·SP·CSS', () => {
  assert.match(d, /tab-btn-biz/); assert.match(d, /biz-root-host/); assert.match(d, /biz: 'kbiz'/); assert.match(d, /_bizOpen/); assert.match(d, /biz-app\.js\?v=/);
  assert.match(paths, /biz-app\.js/); assert.match(paths, /biz\.css/); assert.match(sp, /"scr": "사업 화면"/); assert.match(css, /\.biz/); assert.ok(!/\.sch\b/.test(css));
});
