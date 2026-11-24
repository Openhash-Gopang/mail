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
