/* ledger-book.js — 나비웹 공통 장부(시장 → 세무 회계 → 은행 → 증권이 같은 장부를 같은 방식으로 읽는다).
 * 사용: NaviLedger.recs() · .bookOf(owner, recs, opt) · .walletBook(recs, bal) · .totals(book) · .saveWallet(bal) · .wallet()
 * 전역은 NaviLedger 하나만 쓴다. 이 파일은 화면을 그리지 않고 읽기·계산만 한다(저장은 saveWallet 한 곳뿐).
 *
 * 왜 따로 두었나(주피터 지시 2026-11-25): 은행의 현금 계정은 장부의 현금 계정이고 세무 회계의 재무제표와 같은 값이어야 한다.
 * 이전에는 세무 화면(tax-app.js)과 은행 화면(bank-app.js)이 같은 장부를 각자 계산해 시작 값(현금 2,000,000 대 서버 잔액)이 달랐다.
 * 증권 화면도 같은 장부로 개인·기업 가치를 평가하므로, 계산 규칙을 이 한 파일에 둔다.
 *
 * 무엇이 실제이고 무엇이 아닌가:
 *  - 전표(rec)는 세무 회계 화면이 이 브라우저(localStorage 'navi-tax-v2')에 남긴 체험 기록이다. 시작 장부는 체험용 가상 초안이다.
 *  - 은행 화면이 서버에서 읽은 GDC 잔액을 'navi-wallet-v1'에 적어 두면, 그 잔액을 "나"의 현금 계정으로 쓴다(없으면 가상 초안 값).
 *  - 매출원가(2026-11-25, 주피터 지시: 구매 이력에서 원가 파생): 전표에는 원가를 따로 적지 않는다. 같은 품목을 산 이력(전표의 품목·수량·공급가액)에서 평균 매입가를 이어받아,
 *    판매 때 그 수량만큼을 매출원가로 옮긴다(상품 재고자산 감소, 이익잉여금 감소). 전표만 있으면 누구나 같은 값을 다시 계산할 수 있다.
 *  - 장부에 매입 이력이 없는 판매(가상 초안의 기존 재고·기존 매출 포함)는 원가를 알 수 없으므로 원가 없이 두고 '원가 미확인'으로 표시한다(지어내지 않는다).
 *  - 판매비·관리비·세금은 아직 반영하지 않으므로 이익은 순이익이 아니라 '매출총이익(매출 − 매출원가)'이다. */
(function () {
'use strict';
var TAX_KEY = 'navi-tax-v2', WALLET_KEY = 'navi-wallet-v1';
var ASSETS = ['GDC 잔액', '상품(재고자산)', '부가세대급금', '비품'], LIABS = ['미지급금', '부가세예수금'], EQUITY = ['자본금', '이익잉여금'];
var LMAP = { '현금(GDC)':'GDC 잔액', '상품(재고자산)':'상품(재고자산)', '부가세대급금':'부가세대급금', '부가세예수금':'부가세예수금', '매출':'매출' };
// 시작 장부는 체험용 가상 초안: '나'는 개인사업자, 그 밖의 판매자는 작은 가게로 가정한다.
var DRAFT_ME = { 'GDC 잔액':2000000, '비품':500000, '자본금':2500000 };
var DRAFT_SHOP = { 'GDC 잔액':5000000, '상품(재고자산)':1200000, '비품':800000, '미지급금':300000, '자본금':5000000, '이익잉여금':1700000, '매출':3000000 };

function num(x) { var n = Number(x); return isFinite(n) ? n : 0; }
function isLine(l) { return Array.isArray(l) && typeof l[0] === 'string' && isFinite(Number(l[1])) && isFinite(Number(l[2])); }
function goodRec(r) { return !!r && typeof r.serial === 'string' && r.buyer && r.seller && Array.isArray(r.buyer.lines) && Array.isArray(r.seller.lines); }
/** 세무 회계 화면이 남긴 전표(최신이 앞). 읽기 전용. 깨진 저장값은 건너뛴다. */
function recs() {
  try { var v = JSON.parse(localStorage.getItem(TAX_KEY) || 'null'); return v && Array.isArray(v.rec) ? v.rec.filter(goodRec) : []; } catch (e) { return []; }
}
/** 은행 화면이 마지막으로 읽은 GDC 잔액. 없거나 이상하면 null. */
function wallet() {
  try { var v = JSON.parse(localStorage.getItem(WALLET_KEY) || 'null'); return v && isFinite(Number(v.bal)) && Number(v.bal) >= 0 ? { bal:Number(v.bal), at:typeof v.at === 'string' ? v.at : '' } : null; } catch (e) { return null; }
}
function saveWallet(bal) {
  var n = Number(bal); if (!isFinite(n) || n < 0) return false;
  try { localStorage.setItem(WALLET_KEY, JSON.stringify({ bal:n, at:new Date().toISOString() })); return true; } catch (e) { return false; }
}
function isDebit(a) { return ASSETS.indexOf(a) >= 0; }
/** 한 전표가 owner 의 장부에 주는 계정별 증감(자산은 차변−대변, 부채·자본은 대변−차변). */
function deltas(owner, r) {
  var d = {}; [r.buyer, r.seller].forEach(function (e) {
    if (!e || e.owner !== owner || !Array.isArray(e.lines)) return;
    e.lines.forEach(function (l) {
      if (!isLine(l)) return; var a = LMAP[l[0]]; if (!a) return;
      var x = isDebit(a) ? num(l[1]) - num(l[2]) : num(l[2]) - num(l[1]);
      d[a] = (d[a] || 0) + x; if (a === '매출') d['이익잉여금'] = (d['이익잉여금'] || 0) + x;
    });
  });
  return d;
}
/** owner 가 가진 전표 전체가 현금 계정에 준 증감 합계. */
function cashDelta(owner, rs) { return (rs || []).reduce(function (a, r) { return a + (deltas(owner, r)['GDC 잔액'] || 0); }, 0); }
/** 구매 이력에서 원가 파생. rs 는 오래된 것부터 시간 순서. owner 가 산 품목은 재고(수량·금액)로 쌓이고, 판 품목은 그때의 평균 매입가로 매출원가가 된다.
 *  재고가 모자란 판매분은 원가를 알 수 없어 uncoveredRevenue(원가 미확인 매출)로 모은다. */
function costFlow(owner, rs) {
  var inv = {}, cogs = 0, unc = 0;
  (rs || []).forEach(function (r) {
    var sl = r && r.slip; if (!sl || typeof sl.what !== 'string') return;
    var q = num(sl.qty), sup = num(sl.supply); if (!(q > 0) || !(sup >= 0)) return;
    if (r.buyer && r.buyer.owner === owner) { var a = inv[sl.what] || (inv[sl.what] = { q:0, c:0 }); a.q += q; a.c += sup; }
    if (r.seller && r.seller.owner === owner) {
      var b = inv[sl.what] || { q:0, c:0 }, cov = Math.min(q, b.q), avg = b.q > 0 ? b.c / b.q : 0, c = Math.round(avg * cov);
      if (cov > 0) { b.q -= cov; b.c -= c; inv[sl.what] = b; cogs += c; }
      if (q > cov) unc += Math.round(sup * (q - cov) / q);
    }
  });
  return { cogs:cogs, uncoveredRevenue:unc };
}
/** 장부 계산: 시작 장부 + 전표 증감. opt.cashEnd(은행 잔고)와 opt.all(전체 전표)을 주면 "나"의 현금이 그 잔고로 끝나도록 시작 현금을 맞춘다. */
function bookOf(owner, rs, opt) {
  var b = {}, base = owner === '나' ? DRAFT_ME : DRAFT_SHOP, k; for (k in base) b[k] = base[k];
  if (opt && owner === '나' && isFinite(Number(opt.cashEnd)) && Number(opt.cashEnd) >= 0) {
    var c0 = Number(opt.cashEnd) - cashDelta(owner, opt.all || rs); b['GDC 잔액'] = c0; b['자본금'] = c0 + (b['비품'] || 0);
  }
  (rs || []).forEach(function (r) { var d = deltas(owner, r); for (k in d) b[k] = (b[k] || 0) + d[k]; });
  var cf = costFlow(owner, rs);   // 판 만큼의 원가: 재고자산과 이익잉여금이 함께 줄어 대차는 그대로 맞는다
  if (cf.cogs > 0) { b['매출원가'] = cf.cogs; b['상품(재고자산)'] = (b['상품(재고자산)'] || 0) - cf.cogs; b['이익잉여금'] = (b['이익잉여금'] || 0) - cf.cogs; }
  return b;
}
/** 손익 요약: 매출·매출원가·매출총이익과 "원가를 모두 아는가". 가상 초안의 기존 매출은 원가를 알 수 없어 미확인으로 본다. */
function profitInfo(owner, rs) {
  var b = bookOf(owner, rs), cf = costFlow(owner, rs), baseSales = (owner === '나' ? DRAFT_ME : DRAFT_SHOP)['매출'] || 0, sales = num(b['매출']), unc = cf.uncoveredRevenue + baseSales;
  return { sales:sales, cogs:cf.cogs, gross:sales - cf.cogs, uncovered:unc, known:sales > 0 && unc === 0 };
}
function totals(b) {
  var s = function (list) { return list.reduce(function (a, k) { return a + num(b[k]); }, 0); }, A = s(ASSETS), L = s(LIABS), E = s(EQUITY);
  return { A:A, L:L, E:E, balanced:A === L + E };
}
/** 은행 화면의 '내 재무제표': 현금 계정은 GDC 잔액(서버 값)과 같고, 자본금이 대차를 맞춘다. 키 이름은 은행 화면이 쓰던 그대로. */
function walletBook(rs, bal) {
  var b = { '현금(GDC)':0, '상품(재고자산)':0, '부가세대급금':0, '비품':500000, '미지급금':0, '부가세예수금':0, '자본금':0, '이익잉여금':0, '매출':0, '매출원가':0 }, dCash = 0, marks = [];
  (rs || []).forEach(function (r) {
    var mine = false;
    [r.buyer, r.seller].forEach(function (e) {
      if (!e || e.owner !== '나' || !Array.isArray(e.lines)) return; mine = true;
      e.lines.forEach(function (l) {
        if (!isLine(l)) return; var a = l[0]; if (!(a in b)) return;
        var dr = (a === '현금(GDC)' || a === '상품(재고자산)' || a === '부가세대급금' || a === '비품'), d = dr ? num(l[1]) - num(l[2]) : num(l[2]) - num(l[1]);
        b[a] += d; if (a === '매출') b['이익잉여금'] += d; if (a === '현금(GDC)') dCash += d;
      });
    });
    if (mine) marks.push((r.at || '갱신일시 기록 없음') + ' · ' + r.serial);
  });
  var cf = costFlow('나', (rs || []).slice().reverse());   // recs() 는 최신이 앞이라 시간 순서로 뒤집어 원가를 파생한다
  b['매출원가'] = cf.cogs; b['상품(재고자산)'] -= cf.cogs; b['이익잉여금'] -= cf.cogs;
  b['현금(GDC)'] = num(bal); b['자본금'] = (num(bal) - dCash) + b['비품'];
  b.marks = marks; return b;
}
/** 내 장부 요약: 증권 화면이 가치 평가에 쓴다. 전표가 없으면 null(지어내지 않는다). */
function summary(owner) {
  var rs = recs().filter(function (r) { return r.buyer.owner === owner || r.seller.owner === owner; }), w = wallet();
  if (!rs.length) return null;
  var chron = rs.slice().reverse(), b = bookOf(owner, chron, owner === '나' && w ? { cashEnd:w.bal, all:chron } : null), t = totals(b), pi = profitInfo(owner, chron);
  return { owner:owner, book:b, totals:t, serials:chron.map(function (r) { return r.serial; }), n:chron.length, asOf:chron[chron.length - 1].at || '', walletAt:owner === '나' && w ? w.at : '', usesWallet:owner === '나' && !!w,
    sales:num(b['매출']), equity:t.E, assets:t.A, debt:t.L,
    cogs:pi.cogs, profit:pi.gross, profitKnown:pi.known, uncoveredRevenue:pi.uncovered };
}
window.NaviLedger = { ASSETS:ASSETS, LIABS:LIABS, EQUITY:EQUITY, LMAP:LMAP, recs:recs, wallet:wallet, saveWallet:saveWallet, deltas:deltas, cashDelta:cashDelta, costFlow:costFlow, profitInfo:profitInfo, bookOf:bookOf, totals:totals, walletBook:walletBook, summary:summary };
})();
