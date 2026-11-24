import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const rd = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const src = rd('../ledger-book.js'), desk = rd('../desktop.html'), paths = rd('../ops/naviweb-proxy/mail-paths.js');
function env(store = {}) {
  const w = new JSDOM('<!DOCTYPE html><div></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/' }).window;
  for (const k of Object.keys(store)) w.localStorage.setItem(k, typeof store[k] === 'string' ? store[k] : JSON.stringify(store[k]));
  w.eval(src); return w;
}
// 세무 회계 화면이 만드는 전표와 같은 모양(공급가액 180,000 · 부가세 18,000)
const rec = (serial, at, buyer = '나', seller = '철수상회', supply = 180000) => { const tax = Math.round(supply * 0.1); return { serial, at, hash: 'h' + serial,
  buyer: { side: 'buyer', owner: buyer, lines: [['상품(재고자산)', supply, 0], ['부가세대급금', tax, 0], ['현금(GDC)', 0, supply + tax]] },
  seller: { side: 'seller', owner: seller, lines: [['현금(GDC)', supply + tax, 0], ['매출', 0, supply], ['부가세예수금', 0, tax]] } }; };

test('장부 계산: 시작 장부에 전표 증감이 더해지고 대차가 맞는다(세무 화면과 같은 값)', { skip }, () => {
  const L = env().NaviLedger, r = [rec('MK-1', '2026-11-25 10:00:00')];
  const me = L.bookOf('나', r), shop = L.bookOf('철수상회', r);
  assert.equal(me['GDC 잔액'], 2000000 - 198000); assert.equal(me['상품(재고자산)'], 180000); assert.equal(me['부가세대급금'], 18000);
  assert.equal(shop['GDC 잔액'], 5000000 + 198000); assert.equal(shop['매출'], 3000000 + 180000); assert.equal(shop['이익잉여금'], 1700000 + 180000);
  assert.equal(L.totals(me).balanced, true); assert.equal(L.totals(shop).balanced, true);
});
test('핵심: 은행 잔고를 알면 세무 장부와 은행 장부의 현금 계정·자산 합계가 같다', { skip }, () => {
  const L = env().NaviLedger, r = [rec('MK-2', '2026-11-25 11:00:00'), rec('MK-1', '2026-11-25 10:00:00')], chron = r.slice().reverse(), bal = 5200;
  const tax = L.bookOf('나', chron, { cashEnd: bal, all: chron }), bank = L.walletBook(r, bal);
  assert.equal(tax['GDC 잔액'], bal); assert.equal(bank['현금(GDC)'], bal);
  assert.equal(L.totals(tax).A, bank['현금(GDC)'] + bank['상품(재고자산)'] + bank['부가세대급금'] + bank['비품']);
  assert.equal(L.totals(tax).balanced, true);
  // 전표 하나만 처리한 시점의 현금도 그 사이 증감을 거꾸로 맞춘다
  const first = L.bookOf('나', chron.slice(0, 1), { cashEnd: bal, all: chron });
  assert.equal(first['GDC 잔액'], bal + 198000);
});
test('은행 재무제표: 현금은 잔고, 자본금이 대차를 맞추고 갱신 표시가 붙는다', { skip }, () => {
  const L = env().NaviLedger, b = L.walletBook([rec('MK-1', '2026-11-25 10:00:00')], 1000);
  assert.equal(b['현금(GDC)'], 1000); assert.equal(JSON.stringify(b.marks), JSON.stringify(['2026-11-25 10:00:00 · MK-1']));
  assert.equal(b['현금(GDC)'] + b['상품(재고자산)'] + b['부가세대급금'] + b['비품'], b['미지급금'] + b['부가세예수금'] + b['자본금'] + b['이익잉여금']);
});
test('요약: 전표가 없으면 null(지어내지 않음), 있으면 은행 잔고·매출 누계·일련번호를 준다', { skip }, () => {
  assert.equal(env().NaviLedger.summary('나'), null);
  const w = env({ 'navi-tax-v2': { rec: [rec('MK-2', '2026-11-25 11:00:00'), rec('MK-1', '2026-11-25 10:00:00')], inbox: [] } }), L = w.NaviLedger;
  let s = L.summary('나'); assert.equal(s.usesWallet, false); assert.equal(s.n, 2); assert.equal(JSON.stringify(s.serials), JSON.stringify(['MK-1', 'MK-2'])); assert.equal(s.sales, 0);
  assert.equal(L.saveWallet(7000), true); s = L.summary('나'); assert.equal(s.usesWallet, true); assert.equal(s.book['GDC 잔액'], 7000); assert.equal(s.totals.balanced, true);
  const sh = L.summary('철수상회'); assert.equal(sh.sales, 3000000 + 360000);
});
test('저장값 검증: 깨진 전표·이상한 잔액은 무시한다', { skip }, () => {
  const w = env({ 'navi-tax-v2': { rec: [{ serial: 'x' }, null, rec('MK-1', 'a')] }, 'navi-wallet-v1': { bal: -5 } }), L = w.NaviLedger;
  assert.equal(L.recs().length, 1); assert.equal(L.wallet(), null);
  assert.equal(L.saveWallet(-1), false); assert.equal(L.saveWallet(NaN), false); assert.equal(L.saveWallet('abc'), false);
  const bad = env({ 'navi-tax-v2': '{깨짐', 'navi-wallet-v1': '{깨짐' }).NaviLedger; assert.equal(bad.recs().length, 0); assert.equal(bad.wallet(), null);
});
test('배선: 세 화면은 공통 장부를 먼저 불러오고 경로 목록에 등록되어 있다', () => {
  assert.match(paths, /"ledger-book\.js"/);
  assert.match(desk, /function _ledgerLoad\(cb\)/);
  for (const n of ['bank', 'stock', 'tax']) assert.match(desk, new RegExp('function _' + n + 'Load\\(cb\\) \\{ _ledgerLoad\\(\\(\\) => _' + n + 'Load2\\(cb\\)\\); \\}'), n);
  for (const f of ['tax-app.js', 'bank-app.js']) assert.match(rd('../' + f), /NaviLedger/);
});

const sale = (serial, what, qty, supply, buyer, seller) => { const r = rec(serial, '2026-11-25 12:00:00', buyer, seller, supply); r.slip = { what, qty, supply, price: supply / qty }; return r; };
test('매출원가: 산 이력의 평균 매입가가 판매 때 원가가 되고 대차는 그대로 맞는다', { skip }, () => {
  const L = env().NaviLedger, buy1 = sale('MK-1', '청소기', 2, 180000, '나', '철수상회'), buy2 = sale('MK-2', '청소기', 2, 220000, '나', '철수상회'), sell = sale('MK-3', '청소기', 3, 450000, '영희', '나');
  const chron = [buy1, buy2, sell], f = L.costFlow('나', chron); // 평균 매입가 (180000+220000)/4 = 100000, 3개 → 300000
  assert.equal(f.cogs, 300000); assert.equal(f.uncoveredRevenue, 0);
  const b = L.bookOf('나', chron); assert.equal(b['매출원가'], 300000); assert.equal(b['매출'], 450000); assert.equal(b['이익잉여금'], 450000 - 300000);
  assert.equal(b['상품(재고자산)'], 400000 - 300000); assert.equal(L.totals(b).balanced, true);
  const pi = L.profitInfo('나', chron); assert.equal(pi.gross, 150000); assert.equal(pi.known, true);
});
test('매출원가: 산 이력이 없는 판매·가상 초안의 기존 매출은 원가 미확인으로 두고 지어내지 않는다', { skip }, () => {
  const L = env().NaviLedger, only = sale('MK-1', '청소기', 2, 180000, '나', '철수상회'), shop = L.profitInfo('철수상회', [only]);
  assert.equal(shop.cogs, 0); assert.equal(shop.known, false); assert.equal(shop.uncovered, 3000000 + 180000);
  const part = [sale('MK-1', '청소기', 1, 90000, '나', '철수상회'), sale('MK-2', '청소기', 3, 360000, '영희', '나')]; // 1개만 재고, 3개 판매 → 2개분 매출 240000 원가 미확인
  const f = L.costFlow('나', part); assert.equal(f.cogs, 90000); assert.equal(f.uncoveredRevenue, 240000); assert.equal(L.profitInfo('나', part).known, false);
});
test('은행 재무제표: 매출원가가 반영되고 대차가 맞는다, 요약에 이익 정보가 있다', { skip }, () => {
  const buy = sale('MK-1', '청소기', 2, 180000, '나', '철수상회'), sell = sale('MK-2', '청소기', 1, 120000, '영희', '나'), L = env({ 'navi-tax-v2': { rec: [sell, buy], inbox: [] } }).NaviLedger;
  const b = L.walletBook(L.recs(), 5000); assert.equal(b['매출원가'], 90000);
  assert.equal(b['현금(GDC)'] + b['상품(재고자산)'] + b['부가세대급금'] + b['비품'], b['미지급금'] + b['부가세예수금'] + b['자본금'] + b['이익잉여금']);
  const s = L.summary('나'); assert.equal(s.profit, 30000); assert.equal(s.profitKnown, true); assert.equal(s.cogs, 90000); assert.equal(s.totals.balanced, true);
});

// ── 4단계: 모의 증권 장부 ──
import { webcrypto } from 'node:crypto';
function envS() { const w = env(); Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true }); w.TextEncoder = TextEncoder; return w; }
async function mk(w, steps) { const L = w.NaviLedger, st = { recs: [], alerts: [] }; st.recs.push(await L.secAppend(st, L.secGrant())); for (const t of steps) { const pl = L.secPlan(L.secState(st.recs), t, st.recs.length); if (!pl.ok) return { st, pl }; st.recs.push(await L.secAppend(st, pl.rec)); } return { st }; }
test('모의 장부: 매수·매도 분개가 대차를 맞추고 처분손익·수수료가 계산된다', { skip }, async () => {
  const w = envS(), L = w.NaviLedger;
  const { st } = await mk(w, [{ kind: 'buy', sym: 'A', cls: '국내주식', qty: 10, px: 1000, d: '2026-11-25' }, { kind: 'sell', sym: 'A', cls: '국내주식', qty: 4, px: 1100, d: '2026-11-25' }]);
  const s = L.secState(st.recs); assert.ok(s.balanced); assert.equal(s.realized, 400); assert.equal(s.positions[0].qty, 6);
});
test('모의 장부: 부족·초과 매도·±30% 이탈·소수 수량은 계획 단계에서 거절한다', { skip }, async () => {
  const w = envS(), L = w.NaviLedger;
  const a = await mk(w, [{ kind: 'buy', sym: 'A', cls: '국내주식', qty: 1, px: 100, d: 'x' }, { kind: 'buy', sym: 'A', cls: '국내주식', qty: 1, px: 200, d: 'x' }]); assert.equal(a.pl.ok, false); assert.ok(a.pl.alert);
  assert.equal((await mk(w, [{ kind: 'sell', sym: 'A', cls: '국내주식', qty: 1, px: 100, d: 'x' }])).pl.ok, false);
  assert.equal((await mk(w, [{ kind: 'buy', sym: 'A', cls: '국내주식', qty: 1.5, px: 100, d: 'x' }])).pl.ok, false);
  assert.equal((await mk(w, [{ kind: 'buy', sym: '', cls: '국내주식', qty: 1, px: 100, d: 'x' }])).pl.ok, false);
});
test('모의 장부: 해시 이음 검증은 값 변조를 찾아낸다', { skip }, async () => {
  const w = envS(), L = w.NaviLedger;
  const { st } = await mk(w, [{ kind: 'buy', sym: 'A', cls: '국내주식', qty: 2, px: 100, d: 'x' }]);
  assert.equal((await L.secVerify(st.recs)).ok, true);
  const bad = JSON.parse(JSON.stringify(st.recs)); bad[1].qty = 3;
  const v = await L.secVerify(bad); assert.equal(v.ok, false); assert.equal(v.bad, 1);
});

// ── 5단계: 판매비·관리비·세금 ──
test('판관비: 적으면 영업이익이 줄고, 은행·세무 장부 모두 대차가 맞는다', { skip }, () => {
  const w = env({ 'navi-wallet-v1': { bal: 3000000, at: 'x' } }), L = w.NaviLedger;
  const rs = [rec('MK-1', '2026-11-25 09:00:00', '철수상회', '나', 500000)]; const base = L.profitInfo('나', rs);
  assert.equal(L.expAdd('임차료', '100000', '11월').ok, true);
  const p = L.profitInfo('나', rs); assert.equal(p.opex, 100000); assert.equal(p.op, base.gross - 100000);
  const bw = L.walletBook(rs.slice().reverse(), 3000000); assert.equal(bw['판매비와관리비'], 100000);
  const A = bw['현금(GDC)'] + bw['상품(재고자산)'] + bw['부가세대급금'] + bw['비품'], LE = bw['미지급금'] + bw['부가세예수금'] + bw['자본금'] + bw['이익잉여금']; assert.equal(A, LE);
  const tb = L.bookOf('나', rs, { cashEnd: 3000000, all: rs }); assert.ok(L.totals(tb).balanced);
  assert.ok(L.totals(L.bookOf('나', rs)).balanced);
});
test('판관비: 잘못된 입력(분류·0·소수·음수)은 거절하고 다른 사람 장부에는 쓰지 않는다', { skip }, () => {
  const L = env().NaviLedger;
  for (const [c, a] of [['없는분류', '100'], ['임차료', '0'], ['임차료', '1.5'], ['임차료', '-5'], ['임차료', 'abc']]) assert.equal(L.expAdd(c, a, '').ok, false);
  assert.equal(L.expTotal(), 0); L.expAdd('급여', '1000', ''); assert.equal(L.profitInfo('철수상회', []).opex, 0);
});
test('예상 소득세: 구간 경계 값과 지방소득세 10%, 0 이하는 0', { skip }, () => {
  const L = env().NaviLedger;
  assert.equal(L.incomeTax(14000000).tax, 840000); assert.equal(L.incomeTax(50000000).tax, 6240000);
  assert.equal(L.incomeTax(1000000).total, 66000); assert.equal(L.incomeTax(-5).total, 0); assert.equal(L.incomeTax(2000000000).tax, 834060000);
});
