import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../stock-app.js', import.meta.url), 'utf8');
const ledger = readFileSync(new URL('../ledger-book.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../stock.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');

function page(view, store = {}) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true }); w.TextEncoder = TextEncoder;
  for (const k of Object.keys(store)) w.localStorage.setItem(k, JSON.stringify(store[k]));
  w.eval(ledger); w.eval(app); const doc = w.document, asks = [];
  w.NaviStock.on('ask', (t) => asks.push(t));
  w.NaviStock.mount(doc.getElementById('m'), { view });
  const txt = () => doc.getElementById('stk-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, txt, btn, fetched: () => fetched, S: w.NaviStock };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true }); w.TextEncoder = TextEncoder; w.eval(app); return w.NaviStock; };

test('positions: 평균단가·실현손익·수수료·초과 매도', { skip }, () => {
  const N = api();
  const r = N.positions([
    { id: 'a', d: '2026-01-01', side: 'B', sym: 'A', cls: '국내주식', qty: 10, px: 100, fee: 0 },
    { id: 'b', d: '2026-01-02', side: 'B', sym: 'A', cls: '국내주식', qty: 10, px: 200, fee: 0 },
    { id: 'c', d: '2026-01-03', side: 'S', sym: 'A', cls: '국내주식', qty: 5, px: 250, fee: 10 },
    { id: 'd', d: '2026-01-04', side: 'S', sym: 'Z', cls: '국내주식', qty: 1, px: 1, fee: 0 }]);
  const a = r.pos.find((x) => x.sym === 'A');
  assert.equal(a.qty, 15); assert.equal(a.avg, 150);
  assert.equal(Math.round(r.realized), 500 - 10);
  assert.equal(r.bad.length, 1);
});

test('복리·목표 계산', { skip }, () => {
  const N = api();
  assert.ok(Math.abs(N.fv(1000000, 0, 0, 10) - 1000000) < 1e-6);
  assert.ok(Math.abs(N.fv(1000000, 0, 10, 1) - 1104713.07) < 1);
  assert.ok(N.fv(0, 100000, 5, 10) > 12000000);
});

test('evalCo: 대차 일치·지표·PER/PBR·내재가치', { skip }, () => {
  const N = api();
  const R = N.evalCo({ assets: '500', debt: '200', equity: '300', rev: '400', op: '40', ni: '30', shares: '10', price: '9', g: '3', r: '10' });
  assert.equal(R.balanced, true); assert.equal(R.diff, 0);
  assert.ok(Math.abs(R.roe - 0.1) < 1e-9); assert.ok(Math.abs(R.debtRatio - 2 / 3) < 1e-9); assert.ok(Math.abs(R.opm - 0.1) < 1e-9);
  assert.equal(R.eps, 3); assert.equal(R.bps, 30); assert.equal(R.per, 3); assert.equal(R.pbr, 0.3); assert.equal(R.mcap, 90);
  assert.ok(Math.abs(R.iv - 30 * 1.03 / 0.07) < 1e-6);
  assert.equal(N.evalCo({ assets: '500', debt: '200', equity: '200', ni: '30', g: '3', r: '10' }).balanced, false);
  assert.equal(N.evalCo({ assets: '', debt: '1', equity: '1', ni: '1' }), null);
  assert.equal(N.evalCo({ assets: '10', debt: '5', equity: '5', ni: '1', g: '10', r: '10' }).iv, undefined);
  assert.equal(N.evalCo({ assets: '10', debt: '5', equity: '5', ni: '-1', g: '3', r: '10' }).iv, undefined);
  assert.equal(N.evalCo({ assets: '1,000원', debt: '500', equity: '500', ni: '1' }).balanced, true);
});

test('crossCheck: 상호 대조', { skip }, () => {
  const N = api();
  assert.equal(N.crossCheck('1000', '1000', '1').ok, true);
  assert.equal(N.crossCheck('1000', '1005', '1').ok, true);
  const bad = N.crossCheck('1000', '1500', '1'); assert.equal(bad.ok, false); assert.equal(bad.diff, 500);
  assert.equal(N.crossCheck('', '1', '1'), null); assert.equal(N.crossCheck('0', '0', '1'), null);
});

test('기업 평가 탭: 원칙 설명과 설계 단계 표시, 입력 → 지표, 대차 불일치 경고', { skip }, () => {
  const p = page('company'); const t = p.txt();
  assert.match(t, /위변조|OpenHash/); assert.match(t, /상호|대조/); assert.match(t, /이상 탐지/); assert.match(t, /설계 단계/);
  type(p, 'stk-c-assets', '500'); type(p, 'stk-c-debt', '200'); type(p, 'stk-c-equity', '300'); type(p, 'stk-c-ni', '30'); type(p, 'stk-c-rev', '400'); type(p, 'stk-c-op', '40');
  assert.match(p.doc.getElementById('stk-c-bal').textContent, /맞아요/);
  assert.equal(p.doc.getElementById('stk-c-m0').textContent, '10%');
  assert.ok(p.doc.getElementById('stk-c-iv'));
  type(p, 'stk-c-equity', '100');
  assert.match(p.doc.getElementById('stk-c-bal').textContent, /맞지 않아요/);
  type(p, 'stk-cc-a', '1000'); type(p, 'stk-cc-b', '2000');
  assert.match(p.doc.getElementById('stk-cc-res').textContent, /이상 탐지/);
  type(p, 'stk-cc-b', '1000');
  assert.match(p.doc.getElementById('stk-cc-res').textContent, /맞아요/);
  assert.equal(p.fetched(), 0);
});

test('기업 평가 저장·불러오기·삭제 (localStorage)', { skip }, () => {
  const p = page('company');
  type(p, 'stk-c-name', '테스트전자'); type(p, 'stk-c-assets', '500'); type(p, 'stk-c-debt', '200'); type(p, 'stk-c-equity', '300'); type(p, 'stk-c-ni', '30');
  p.btn('이 평가 저장').click();
  assert.match(p.txt(), /저장한 평가 비교/); assert.match(p.txt(), /테스트전자/);
  const q = JSON.parse(p.w.localStorage.getItem('navi-stock-v1')); assert.equal(q.cos.length, 1);
  p.btn('삭제').click(); assert.doesNotMatch(p.txt(), /저장한 평가 비교/);
});

test('거래 기록: 검증, 포트폴리오, 현재가 입력', { skip }, () => {
  const p = page('trades');
  p.btn('기록하기').click(); assert.match(p.txt(), /종목|수량/);
  type(p, 'stk-sym', '삼성전자'); type(p, 'stk-qty', '10'); type(p, 'stk-px', '70000'); p.btn('기록하기').click();
  assert.match(p.txt(), /삼성전자/);
  p.S.view('portfolio'); assert.match(p.txt(), /삼성전자/);
  type(p, 'stk-px-0', '80000'); p.doc.getElementById('stk-px-0').dispatchEvent(new p.w.Event('change', { bubbles: true })); assert.match(p.txt(), /800,000/);
  assert.equal(p.fetched(), 0);
});

test('매도: 보유 수량보다 많으면 막는다', { skip }, () => {
  const p = page('trades');
  type(p, 'stk-sym', 'AAA'); type(p, 'stk-qty', '1'); type(p, 'stk-px', '100'); p.btn('기록하기').click();
  p.btn('매도').click(); type(p, 'stk-sym', 'AAA'); type(p, 'stk-qty', '5'); type(p, 'stk-px', '100'); p.btn('기록하기').click();
  assert.equal(JSON.parse(p.w.localStorage.getItem('navi-stock-v1')).trades.length, 1);
});

test('탭 이동: 모든 탭이 그려진다', { skip }, () => {
  const p = page('portfolio');
  for (const v of ['portfolio', 'value', 'company', 'trades', 'watch', 'alloc', 'goal', 'learn']) { p.S.view(v); assert.ok(p.txt().length > 20, v); }
  assert.equal(p.doc.querySelectorAll('.tab').length, 8);
});

test('투자 점검·용어, 시세 서버 없음 안내', { skip }, () => {
  const p = page('learn'); const c = p.doc.getElementById('stk-chk-0'); c.checked = true; c.dispatchEvent(new p.w.Event('change', { bubbles: true }));
  assert.ok(JSON.parse(p.w.localStorage.getItem('navi-stock-v1')).checks['0']);
  type(p, 'stk-gq', 'ETF'); assert.match(p.doc.getElementById('stk-gl').textContent, /ETF/);
});

test('CSS는 .stk 아래로 한정, 네트워크 호출 없음, 주문 기능 없음', () => {
  const sel = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').split('}').map((x) => x.split('{')[0].trim()).filter((x) => x && !x.startsWith('@') && !/^\d+%|^from|^to/.test(x));
  const bad = sel.filter((x) => x.split(',').some((y) => !/\.stk\b/.test(y)));
  assert.deepEqual(bad.slice(0, 5), []);
  assert.doesNotMatch(app, /fetch\(|XMLHttpRequest|sendBeacon/);
});

test('desktop.html 연결과 배포 목록', () => {
  assert.match(d, /tab-btn-stock/); assert.match(d, /id="stock-root"|stock-root/); assert.match(d, /_stockLoad/); assert.match(d, /_stockOpen/);
  assert.match(d, /kstock[\s\S]{0,40}&&[\s\S]{0,10}!_stockChat|!_stockChat/);
  assert.match(d, /stock:/); assert.match(d, /stock-app\.js/); assert.match(d, /stock\.css/);
  assert.match(paths, /"stock-app\.js"/); assert.match(paths, /"stock\.css"/);
});

// ── 내 가치 평가 v0 ──
const SM = (o = {}) => ({ owner: '나', asOf: '2026-11-25 10:00:00', serials: ['MK-1'], n: 1, equity: 3000000, assets: 3200000, debt: 200000, sales: 0, totals: { balanced: true }, ...o });
const rec = (serial, supply = 180000) => { const tax = Math.round(supply * 0.1); return { serial, at: '2026-11-25 10:00:00', hash: 'h',
  buyer: { side: 'buyer', owner: '나', lines: [['상품(재고자산)', supply, 0], ['부가세대급금', tax, 0], ['현금(GDC)', 0, supply + tax]] },
  seller: { side: 'seller', owner: '철수상회', lines: [['현금(GDC)', supply + tax, 0], ['매출', 0, supply], ['부가세예수금', 0, tax]] } }; };

test('valueOf: 이익이 있으면 수익가치 시나리오의 최소~최대 구간', { skip }, () => {
  const v = api().valueOf(SM({ sales: 1000000 }), { g: '3', r: '10' });
  assert.equal(v.mode, 'range'); assert.equal(v.sc.length, 3);
  assert.equal(Math.round(v.low), 10200000); assert.equal(Math.round(v.high), 26000000); assert.equal(v.ver, 'v0');
});
test('valueOf: 이익이 없으면 구간을 내지 않고 순자산만, 요구수익률 ≤ 성장률인 시나리오는 뺀다', { skip }, () => {
  const N = api(), a = N.valueOf(SM(), { g: '3', r: '10' });
  assert.equal(a.mode, 'asset'); assert.equal(a.low, 3000000); assert.equal(a.high, 3000000);
  const b = N.valueOf(SM({ sales: 1000000 }), { g: '9', r: '10' }); // 낮은(8,12)·입력(9,10)만 성립, 높은(10,8)은 r ≤ g 라 제외
  assert.equal(b.sc.length, 2); assert.equal(N.valueOf(SM({ sales: 1000000 }), { g: '10', r: '10' }).sc.length, 1); // 낮은 가정(9, 12)만 성립
  assert.equal(N.valueOf(SM({ sales: 1000000 }), { g: '20', r: '10' }).mode, 'asset'); // 성립하는 시나리오가 없으면 구간을 내지 않는다
  assert.equal(N.valueOf(null, {}), null);
});
test('hashOf: 같은 입력은 같은 해시, 가정이 다르면 다른 해시', { skip }, async () => {
  const N = api(), a = await N.hashOf(N.valueOf(SM({ sales: 1 }), { g: '3', r: '10' })), b = await N.hashOf(N.valueOf(SM({ sales: 1 }), { g: '3', r: '10' })), c = await N.hashOf(N.valueOf(SM({ sales: 1 }), { g: '4', r: '10' }));
  assert.match(a, /^[0-9a-f]{64}$/); assert.equal(a, b); assert.notEqual(a, c);
});
test('내 가치 탭: 장부가 없으면 만들어 보여 주지 않고 안내한다', { skip }, () => {
  const p = page('value'); assert.match(p.txt(), /평가 v0/); assert.match(p.txt(), /아직 내 장부에 거래가 없어요/); assert.ok(!p.doc.getElementById('stk-v-res'));
});
test('내 가치 탭: 장부가 있으면 순자산·미연결 신호·해시를 보여 주고, 평가 정보는 당사자(나) 것만 쓴다', { skip }, async () => {
  const p = page('value', { 'navi-tax-v2': { rec: [rec('MK-1')], inbox: [] }, 'navi-wallet-v1': { bal: 5200, at: '2026-11-25T01:00:00Z' } });
  const t = p.txt(); assert.match(t, /구간을 낼 수 없어요/); assert.match(p.doc.getElementById('stk-v-range').textContent, /원$/);
  assert.match(p.doc.getElementById('stk-v-book').textContent, /은행 GDC 잔액과 같아요/);
  for (const g of ['통화량', '업종 사이클', '경영진·임직원', '인구 구조']) assert.ok(t.includes(g), g);
  assert.ok(t.includes('데이터 미연결')); assert.ok(!t.includes('철수상회'));
  await new Promise((r) => setTimeout(r, 60)); assert.match(p.doc.getElementById('stk-v-hash').textContent, /입력 해시 [0-9a-f]{16}/);
  assert.equal(p.fetched(), 0);
});
test('내 가치 탭: 가정을 바꾸면 저장되고, 말로 이동(nav)도 된다', { skip }, () => {
  const p = page('portfolio', { 'navi-tax-v2': { rec: [rec('MK-1')], inbox: [] } });
  p.S.nav({ do: 'value' }); assert.match(p.txt(), /내 장부 상태/);
  type(p, 'stk-v-g', '5'); assert.equal(JSON.parse(p.w.localStorage.getItem('navi-stock-v1')).val.g, '5');
  assert.ok(p.btn('증권 AI에게 계산 방법 묻기')); p.btn('증권 AI에게 계산 방법 묻기').click(); assert.match(p.asks[0], /내 가치 구간/);
});
test('desktop.html: 증권 화면도 공통 장부를 먼저 불러온다, 증권 SP에 내 가치 원칙이 있다', () => {
  assert.match(d, /function _stockLoad\(cb\) \{ _ledgerLoad\(\(\) => _stockLoad2\(cb\)\); \}/);
  assert.match(readFileSync(new URL('../infra-sp.js', import.meta.url), 'utf8'), /'내 가치' 탭은 공통 장부에서 내 장부를 읽어/);
});
