/* stock-app.js — 나비웹 증권(인프라 AI · 증권). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviStock.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 stock.css(.stk 범위). 전역은 NaviStock 하나만 쓴다.
 *
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 증권 화면의 특징은 재무제표 기반 기업 평가다. 나비웹은 모든 사용자의 거래를 기록해 재무제표를 자동 생성·갱신하고, 기록은 OpenHash로 위변조를 막고, 거래 상대방 기록과 상호 대조하며,
 *    비정상 거래는 이상 탐지로 바로 잡아내므로 재무제표만으로 기업을 평가할 수 있다는 것이 설계 원칙이다(주피터 지시). 이 원칙은 아직 설계 단계라 기업의 재무제표가 이 화면에 자동으로 연결되어 있지는 않다 —
 *    그래서 '기업 평가' 탭은 원칙을 설명하고, 사용자가 넣은 재무제표 값으로 같은 방식의 평가 지표를 계산한다(지어낸 기업 자료는 없다).
 *  - 시세 서버와 주문 기능이 없다. 이 화면은 주문을 보내지 않고, 시세를 지어내지 않는다. 현재가는 사용자가 직접 적는다.
 *  - 내 포트폴리오는 사용자가 적은 '거래 기록'에서 계산한다(평균단가법). 모든 기록은 이 브라우저(localStorage)에만 저장된다.
 *  - '내 가치'는 공통 장부(ledger-book.js)에서 내 장부를 읽어 평가 v0 구간을 계산한다. 연결되지 않은 신호는 쓰지 않고 미연결로 적는다. 이익은 매출총이익(매출 − 매출원가)이다.
 *  - '종목 탐색'은 업종·규모·지역 색인 검색 틀이다. 공개 서버가 없어 내가 공개 설정으로 만든 미리보기만 찾아지며, 고른 항목만 공개 정보에 담긴다(끄면 아무것도 내보내지 않는다).
 *  - '내 임금'은 사용자가 적은 월 임금 기록(자기 기록, 달마다 한 건·추가만)에서 최근 12개월 최저~최고·평균·증감을 보여 준다. 시장 임금 통계가 연결되지 않아 공정 임금 구간은 내지 않는다.
 *  - '모의 주문'은 테스트 GDC로 거래를 장부 전표(분개·일련번호·해시 이음)로 남기는 연습이다. 실제 주문·결제가 아니며 은행 잔고와 섞이지 않는다. 체결가는 직접 적고, 감독 규칙(직전 체결가 ±30%·보유 수량·모의 현금)이 주문을 검사한다. 보유·손익은 이 전표에서만 계산한다.
 *  - 자산 배분·목표 계산기는 사용자가 넣은 값으로 계산만 한다. 예측이나 추천이 아니다. 특정 상품을 사라고 권하지 않는다.
 */
(function () {
'use strict';
var KEY = 'navi-stock-v1', MAXT = 500, MAXW = 100;
var CLS = ['국내주식', '해외주식', 'ETF·펀드', '채권', '부동산·리츠', '암호화폐', '원자재', '현금·예금', '기타'];
var TABS = [['portfolio', '내 포트폴리오'], ['value', '내 가치'], ['wage', '내 임금'], ['explore', '종목 탐색'], ['company', '기업 평가'], ['order', '모의 주문'], ['trades', '거래 기록'], ['watch', '관심 종목'], ['alloc', '자산 배분'], ['goal', '목표 계산기'], ['learn', '투자 점검·용어']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var CONC = 30;   // 한 종목이 평가금액의 이 비율(%)을 넘으면 알려 준다(참고)
var CHECKS = ['비상 자금(생활비 3~6개월분)은 따로 두었나요?', '투자 목적과 기간(언제 쓸 돈인지)을 적어 두었나요?', '한 종목에 넣을 최대 비중을 정해 두었나요?', '손실이 얼마까지 나면 어떻게 할지 미리 정해 두었나요?', '내가 이해하지 못하는 상품에는 투자하지 않기로 했나요?', '수수료·세금(양도세·배당세 등)을 확인했나요?', '빚을 내서 투자하지 않나요?'];
var GLOSS = [['분산투자', '여러 종목·자산군·지역에 나누어 투자해 한 곳의 손실이 전체에 미치는 영향을 줄이는 방법입니다.'], ['리밸런싱', '시간이 지나 달라진 자산 비중을 처음 정한 목표 비중으로 되돌리는 조정입니다.'], ['평균단가법', '여러 번 나눠 산 종목의 평균 매수 가격을 구해 매도 때 손익을 계산하는 방법입니다. 이 화면도 이 방법을 씁니다.'], ['평가손익 · 실현손익', '평가손익은 아직 팔지 않은 종목의 현재가 기준 손익이고, 실현손익은 실제로 판 뒤 확정된 손익입니다.'], ['ETF', '여러 종목을 묶어 지수 등을 따라가도록 만든 펀드로, 주식처럼 거래소에서 사고팝니다.'], ['PER · PBR', 'PER은 주가를 주당순이익으로, PBR은 주가를 주당순자산으로 나눈 값으로 주가가 이익·자산에 비해 어느 수준인지 가늠하는 지표입니다.'], ['배당수익률', '1주당 배당금을 주가로 나눈 비율입니다. 배당은 회사 사정에 따라 줄거나 없어질 수 있습니다.'], ['채권', '정부나 기업이 돈을 빌리며 발행하는 증서로, 정해진 이자를 주고 만기에 원금을 갚기로 한 약속입니다. 발행자의 신용에 따라 위험이 다릅니다.'], ['신용등급', '채권 발행자가 이자와 원금을 갚을 능력을 등급으로 나타낸 것입니다. 등급이 낮을수록 보통 이자가 높고 위험도 큽니다.'], ['변동성', '가격이 오르내리는 폭입니다. 변동성이 크면 수익도 손실도 크게 날 수 있습니다.'], ['환율 위험', '해외 자산은 가격이 그대로여도 환율이 변하면 원화 가치가 달라집니다.'], ['복리', '이자에 다시 이자가 붙는 방식으로, 기간이 길수록 차이가 커집니다. 목표 계산기는 월 복리로 계산합니다.'], ['인플레이션(물가 상승)', '물가가 올라 같은 돈으로 살 수 있는 것이 줄어드는 현상입니다. 실질 가치는 물가 상승을 뺀 값입니다.'], ['유동성', '필요할 때 손해 없이 현금으로 바꿀 수 있는 정도입니다. 거래가 적은 자산은 팔고 싶을 때 못 팔 수 있습니다.'], ['레버리지', '빌린 돈으로 투자 규모를 키우는 것입니다. 이익도 손실도 커지며 손실이 원금보다 클 수 있습니다.'], ['시가총액', '주가에 발행 주식 수를 곱한 회사의 시장 가치입니다.'], ['호가', '사려는 가격(매수 호가)과 팔려는 가격(매도 호가)입니다.'], ['공매도', '주식을 빌려 먼저 팔고 나중에 사서 갚는 거래로, 가격이 내릴 때 이익이 나지만 오를 때 손실에는 한도가 없습니다.'], ['GDC 채권(설계 중)', '나비웹이 구상하는 GDC 기반 채권입니다. 아직 실제로 발행·거래되지 않는 개념 단계이며 이 화면에서는 거래할 수 없습니다.']];
var M = null, LS = {};
var S = { view:'portfolio', co:{ name:'', rev:'', op:'', ni:'', assets:'', debt:'', equity:'', shares:'', price:'', g:'3', r:'10' }, cos:[], cc:{ a:'', b:'', tol:'1' }, trades:[], px:{}, watch:[], target:{}, checks:{}, goal:{ p0:'', m:'', r:'5', y:'10', t:'', inf:'2' }, val:{ g:'3', r:'10' }, wage:{ m:'', amt:'', memo:'' }, wageMsg:null, xq:{ text:'', sector:'', size:'', region:'' }, pub:{ on:false, name:'', sector:'', region:'', fields:{ equity:false, range:false, sales:false, series:false } }, sec:{ recs:[], alerts:[] }, secMsg:null, secVer:null, secBusy:false, order:{ side:'B', sym:'', cls:'국내주식', qty:'', px:'' }, form:{ side:'B', d:'', sym:'', cls:'국내주식', qty:'', px:'', fee:'' }, wform:{ sym:'', cls:'국내주식', target:'', memo:'' }, err:{}, gq:'', msg:'' };

// ── 작은 도구 ──
function h(tag, attrs, kids) {
  var e = document.createElement(tag), k;
  for (k in (attrs || {})) { var v = attrs[k]; if (v == null || v === false) continue; if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e[k] = v; else e.setAttribute(k, v === true ? '' : v); }
  (kids || []).forEach(function (c) { if (c == null || c === false) return; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
function $(id) { return M ? M.querySelector('#' + id) : null; }
function emit(t, p) { (LS[t] || []).slice().forEach(function (f) { try { f(p); } catch (e) {} }); }
function ask(text) { emit('ask', text || ''); }
function won(n) { return Math.round(Number(n) || 0).toLocaleString('ko-KR'); }
function sgn(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + won(Math.abs(n)); }
function pct(n, d) { var v = Math.round(n * 100 * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d); return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d == null ? 1 : d) + '%'; }
function cls(n) { return n > 0 ? 'up' : n < 0 ? 'dn' : ''; }
function pill(t, k) { return h('span', { class:'pill ' + (k || ''), text:t }); }
function btn(t, c, fn) { return h('button', { type:'button', class:'btn ' + (c || ''), text:t, onclick:fn }); }
function kst() { return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul' }).format(new Date()); }
function numOf(v) { var s = String(v == null ? '' : v).replace(/[,\s원]/g, ''); if (s === '' || !/^\d*\.?\d+$|^\d+\.?$/.test(s)) return NaN; return Number(s); }
function snum(v) { var s = String(v == null ? '' : v).replace(/[,\s원]/g, '').replace(/^[−–-]/, '-'); return /^-?\d*\.?\d+$|^-?\d+\.?$/.test(s) ? Number(s) : NaN; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function clean(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }

// ── 저장 ──
function load() {
  try {
    var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v || typeof v !== 'object') return;
    S.trades = (Array.isArray(v.trades) ? v.trades : []).map(fixTrade).filter(Boolean).slice(0, MAXT);
    if (v.px && typeof v.px === 'object') Object.keys(v.px).slice(0, 300).forEach(function (k) { var n = Number(v.px[k]); if (isFinite(n) && n >= 0) S.px[clean(k, 30)] = n; });
    S.watch = (Array.isArray(v.watch) ? v.watch : []).map(function (w) { if (!w || typeof w.sym !== 'string' || !clean(w.sym, 30)) return null; var t = Number(w.target); return { id:clean(w.id, 20) || uid(), sym:clean(w.sym, 30), cls:CLS.indexOf(w.cls) >= 0 ? w.cls : '기타', target:isFinite(t) && t > 0 && w.target !== null && w.target !== '' ? t : null, memo:clean(w.memo, 60) }; }).filter(Boolean).slice(0, MAXW);
    if (v.co && typeof v.co === 'object') Object.keys(S.co).forEach(function (k) { if (typeof v.co[k] === 'string') S.co[k] = v.co[k].slice(0, k === 'name' ? 30 : 20); });
    S.cos = (Array.isArray(v.cos) ? v.cos : []).map(function (c) { if (!c || typeof c !== 'object' || !c.v || typeof c.v !== 'object') return null; var o = { id:clean(c.id, 20) || uid(), name:clean(c.name, 30) || '이름 없음', v:{} }; Object.keys(S.co).forEach(function (k) { o.v[k] = typeof c.v[k] === 'string' ? c.v[k].slice(0, k === 'name' ? 30 : 20) : ''; }); return o; }).filter(Boolean).slice(0, 20);
    if (v.target && typeof v.target === 'object') CLS.forEach(function (c) { var n = Number(v.target[c]); if (isFinite(n) && n > 0 && n <= 100) S.target[c] = n; });
    if (v.checks && typeof v.checks === 'object') CHECKS.forEach(function (_, i) { if (v.checks[i]) S.checks[i] = 1; });
    if (v.val && typeof v.val === 'object') ['g', 'r'].forEach(function (k) { if (typeof v.val[k] === 'string') S.val[k] = v.val[k].slice(0, 6); });
if (v.goal && typeof v.goal === 'object') Object.keys(S.goal).forEach(function (k) { if (typeof v.goal[k] === 'string') S.goal[k] = v.goal[k].slice(0, 14); });
  } catch (e) {}
}
function fixTrade(t) {
  if (!t || typeof t !== 'object') return null;
  var q = Number(t.qty), p = Number(t.px), f = Number(t.fee || 0), sym = clean(t.sym, 30);
  if (!sym || !(q > 0) || q > 1e12 || !(p >= 0) || p > 1e12 || !(f >= 0) || f > 1e12 || !/^\d{4}-\d{2}-\d{2}$/.test(t.d) || (t.side !== 'B' && t.side !== 'S')) return null;
  return { id:clean(t.id, 20) || uid(), d:t.d, side:t.side, sym:sym, cls:CLS.indexOf(t.cls) >= 0 ? t.cls : '기타', qty:q, px:p, fee:f };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ co:S.co, cos:S.cos, trades:S.trades, px:S.px, watch:S.watch, target:S.target, checks:S.checks, goal:S.goal, val:S.val })); } catch (e) {} }

// ── 계산(순수 함수) ──
/** 거래 기록 → 보유 종목(평균단가법). 보유보다 많이 판 기록은 건너뛰고 bad 에 id 를 모은다. */
function positions(trades) {
  var order = trades.map(function (t, i) { return [t, i]; }).sort(function (a, b) { return a[0].d < b[0].d ? -1 : a[0].d > b[0].d ? 1 : a[1] - b[1]; }).map(function (x) { return x[0]; });
  var P = {}, realized = 0, fees = 0, bad = [], rb = {};
  order.forEach(function (t) {
    var p = P[t.sym] || (P[t.sym] = { sym:t.sym, cls:t.cls, qty:0, cost:0 }); fees += t.fee; p.cls = t.cls;
    if (t.side === 'B') { p.qty += t.qty; p.cost += t.qty * t.px + t.fee; }
    else {
      if (t.qty > p.qty + 1e-9) { bad.push(t.id); return; }
      var avg = p.qty > 0 ? p.cost / p.qty : 0, g = t.qty * t.px - t.fee - avg * t.qty;
      realized += g; rb[t.sym] = (rb[t.sym] || 0) + g; p.cost -= avg * t.qty; p.qty -= t.qty; if (p.qty < 1e-9) { p.qty = 0; p.cost = 0; }
    }
  });
  var pos = Object.keys(P).map(function (k) { var p = P[k]; p.avg = p.qty > 0 ? p.cost / p.qty : 0; return p; }).filter(function (p) { return p.qty > 0; });
  return { pos:pos, realized:realized, fees:fees, bad:bad, realizedBy:rb };
}
/** 현재가가 있는 종목만 평가한다. */
function valued(pos, px) {
  var rows = pos.map(function (p) { var q = px[p.sym], has = isFinite(q) && q > 0; return { p:p, price:has ? q : null, val:has ? q * p.qty : null, pl:has ? q * p.qty - p.cost : null }; });
  var ok = rows.filter(function (r) { return r.val != null; }), val = ok.reduce(function (a, r) { return a + r.val; }, 0), cost = ok.reduce(function (a, r) { return a + r.p.cost; }, 0);
  var byCls = {}; ok.forEach(function (r) { byCls[r.p.cls] = (byCls[r.p.cls] || 0) + r.val; });
  return { rows:rows, val:val, cost:cost, pl:val - cost, byCls:byCls, unpriced:rows.filter(function (r) { return r.val == null; }).map(function (r) { return r.p.sym; }) };
}
/** 월 복리 미래 가치: 현재 자산 p0, 월 적립 m, 연 수익률 r(%), 기간 y(년). */
function fv(p0, m, r, y) {
  var n = Math.round(y * 12), i = r / 100 / 12;
  return i === 0 ? p0 + m * n : p0 * Math.pow(1 + i, n) + m * (Math.pow(1 + i, n) - 1) / i;
}
/** 목표 금액 t 를 y 년 뒤 만들기 위한 월 적립액(0 이하면 이미 달성). */
function needMonthly(t, p0, r, y) {
  var n = Math.round(y * 12), i = r / 100 / 12; if (!(n >= 1)) return null;
  var rest = t - p0 * Math.pow(1 + i, n); if (rest <= 0) return 0;
  return i === 0 ? rest / n : rest * i / (Math.pow(1 + i, n) - 1);
}
function goalCalc(g) {
  var p0 = g.p0 === '' ? 0 : numOf(g.p0), m = g.m === '' ? 0 : numOf(g.m), r = numOf(g.r), y = numOf(g.y), inf = g.inf === '' ? 0 : numOf(g.inf), t = g.t === '' ? null : numOf(g.t);
  if (!isFinite(p0) || !isFinite(m) || !isFinite(r) || !isFinite(y) || !isFinite(inf) || (t !== null && !isFinite(t)) || r > 100 || inf > 100 || !(y >= 1) || y > 60 || p0 > 1e13 || m > 1e12 || (t !== null && t > 1e14)) return null;
  var out = { fv:fv(p0, m, r, y), principal:p0 + m * Math.round(y * 12), years:[] };
  out.real = out.fv / Math.pow(1 + inf / 100, y); out.gain = out.fv - out.principal;
  for (var k = 1; k <= Math.floor(y); k++) out.years.push(fv(p0, m, r, k));
  out.sc = [Math.max(0, r - 2), r, r + 2].map(function (x) { return { r:x, fv:fv(p0, m, x, y) }; });
  if (t !== null) { out.t = t; out.need = needMonthly(t, p0, r, y); out.hit = out.fv >= t; }
  return out;
}

/** 재무제표 값(원) → 평가 지표. 필수: 자산·부채·자본·순이익. 값이 모자라거나 이상하면 null. 자산 = 부채 + 자본이 맞지 않으면 balanced:false(대차 불일치). */
function evalCo(v) {
  var opt = function (x) { return x == null || String(x).trim() === '' ? null : snum(x); };
  var a = snum(v.assets), d = snum(v.debt), e = snum(v.equity), ni = snum(v.ni), rev = opt(v.rev), op = opt(v.op), sh = opt(v.shares), px = opt(v.price), g = snum(v.g), r = snum(v.r);
  if (![a, d, e, ni].every(isFinite) || a <= 0 || d < 0 || Math.abs(a) > 1e18 || Math.abs(ni) > 1e18) return null;
  if ((rev !== null && (!isFinite(rev) || rev < 0)) || (op !== null && !isFinite(op)) || (sh !== null && (!isFinite(sh) || sh <= 0)) || (px !== null && (!isFinite(px) || px <= 0))) return null;
  var o = { diff:a - d - e, balanced:Math.abs(a - d - e) <= a * 0.01, roe:e > 0 ? ni / e : null, roa:ni / a, debtRatio:e > 0 ? d / e : null, equityRatio:e / a, opm:rev && op !== null ? op / rev : null, npm:rev && rev > 0 ? ni / rev : null };
  if (sh) { o.eps = ni / sh; o.bps = e / sh; if (px) { o.per = ni > 0 ? px / o.eps : null; o.pbr = e > 0 ? px / o.bps : null; o.mcap = px * sh; } }
  if (isFinite(g) && isFinite(r) && r > g && g > -50 && r <= 100 && ni > 0) { o.iv = ni * (1 + g / 100) / ((r - g) / 100); if (sh) { o.ivps = o.iv / sh; if (px) o.gap = o.ivps / px - 1; } }
  return o;
}
/** 거래 상대방 기록과의 상호 대조: 두 기록의 차이가 허용 비율(%)을 넘으면 불일치. */
function crossCheck(a, b, tolPct) {
  a = snum(a); b = snum(b); var t = snum(tolPct); if (!isFinite(a) || !isFinite(b) || a < 0 || b < 0 || !isFinite(t) || t < 0 || t > 100 || (a === 0 && b === 0)) return null;
  var diff = Math.abs(a - b), rate = diff / Math.max(a, b);
  return { diff:diff, rate:rate, ok:rate * 100 <= t };
}

// ── 내 가치 평가 v0(장부 기반) ──
var VER = 'v1';
// 증권 AI가 최종적으로 종합하려는 신호 중 아직 연결된 데이터가 없는 것 — 지어내지 않고 "미연결"로 보여 준다.
var GAPS = ['통화량(한국은행 발행·시중 유통)', '글로벌·국내 경제 구조 변화', '업종 사이클(성장·사양 산업)', '경영진·임직원 경력·신용도·근속', '세금 납부액 시계열', '인구 구조'];
function NL() { return window.NaviLedger || null; }
/** 장부 요약(NaviLedger.summary) + 가정(이익 성장률 g, 요구 수익률 r, %) → 가치 구간.
 *  이익이 있으면 수익가치 시나리오 3개(낮은·입력·높은 가정)의 최소~최대. 이익 근거가 없으면 구간 대신 순자산(장부가)만 낸다.
 *  이익은 장부의 세후 영업이익(매출 − 매출원가 − 판매비와관리비 − 참고용 예상 소득세)이다. 원가는 구매 이력에서 파생하며, 원가를 알 수 없는 매출이 있으면 이익을 쓰지 않는다. 판관비는 사용자가 적은 기록이고 세금은 공제 없는 참고 계산이다. */
function valueOf(sm, a) {
  if (!sm || !sm.totals || !isFinite(sm.equity)) return null;
  var g = snum(a && a.g), r = snum(a && a.r), ern = sm.earnNet != null ? sm.earnNet : sm.profit, earn = sm.profitKnown && ern > 0 ? ern : 0, sc = [];
  if (earn > 0 && isFinite(g) && isFinite(r)) [[g - 1, r + 2, '낮은 가정'], [g, r, '입력값'], [g + 1, r - 2, '높은 가정']].forEach(function (x) { if (x[1] > x[0] && x[1] <= 100 && x[0] > -50) sc.push({ g:x[0], r:x[1], name:x[2], v:earn * (1 + x[0] / 100) / ((x[1] - x[0]) / 100) }); });
  var vs = sc.map(function (x) { return x.v; });
  return { ver:VER, owner:sm.owner, asOf:sm.asOf, serials:sm.serials, n:sm.n, equity:sm.equity, assets:sm.assets, debt:sm.debt, earn:earn, sales:sm.sales || 0, cogs:sm.cogs || 0, opex:sm.opex || 0, taxEst:sm.taxEst ? sm.taxEst.total : 0, net:sm.earnNet != null, uncovered:sm.uncoveredRevenue || 0, profitKnown:!!sm.profitKnown, sc:sc, mode:vs.length ? 'range' : 'asset', low:vs.length ? Math.min.apply(null, vs) : sm.equity, high:vs.length ? Math.max.apply(null, vs) : sm.equity, g:g, r:r, balanced:sm.totals.balanced };
}
/** 같은 입력(전표 일련번호·장부 값·가정·모델 버전)이면 같은 해시 — 평가를 다시 계산해 맞춰 볼 수 있게 한다. 해시 기능이 없으면 null. */
function hashOf(v) {
  var sb = null; try { sb = window.crypto && window.crypto.subtle; } catch (e) { sb = null; }
  if (!sb || !v || typeof TextEncoder === 'undefined') return Promise.resolve(null);
  var t = JSON.stringify([v.ver, v.owner, v.serials, v.equity, v.assets, v.debt, v.earn, v.g, v.r]);
  return sb.digest('SHA-256', new TextEncoder().encode(t)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); }, function () { return null; });
}

// ── 그림 ──
function sv(tag, a, kids) { var e = document.createElementNS('http://www.w3.org/2000/svg', tag), k; for (k in (a || {})) e.setAttribute(k, a[k]); (kids || []).forEach(function (c) { e.appendChild(c); }); return e; }
function bars(vals, labels, color) {
  var W = 560, H = 180, L = 56, R = 8, T = 10, B = 24, iw = W - L - R, ih = H - T - B, n = vals.length, mx = Math.max.apply(null, vals.concat([1])), bw = Math.max(2, iw / n * .62);
  var s = sv('svg', { viewBox:'0 0 ' + W + ' ' + H, role:'img', 'aria-label':'연도별 예상 금액 막대 그래프' });
  for (var i = 0; i <= 2; i++) { var y = T + ih - ih * i / 2; s.appendChild(sv('line', { x1:L, x2:W - R, y1:y, y2:y, stroke:'#D9DEE6' })); var t = sv('text', { x:L - 6, y:y + 4, 'text-anchor':'end', 'font-size':10.5, fill:'#6C757D' }); t.textContent = short(mx * i / 2); s.appendChild(t); }
  vals.forEach(function (v, j) { var hh = Math.max(ih * v / mx, 1); s.appendChild(sv('rect', { x:(L + iw * (j + .5) / n - bw / 2).toFixed(1), y:(T + ih - hh).toFixed(1), width:bw.toFixed(1), height:hh.toFixed(1), rx:2, fill:color })); });
  var step = Math.ceil(n / 8); labels.forEach(function (l, j) { if (j % step === 0 || j === n - 1) { var t2 = sv('text', { x:(L + iw * (j + .5) / n).toFixed(1), y:H - 6, 'text-anchor':'middle', 'font-size':10.5, fill:'#6C757D' }); t2.textContent = l; s.appendChild(t2); } });
  return h('div', { class:'chart' }, [s]);
}
function short(v) { return v >= 1e8 ? Math.round(v / 1e7) / 10 + '억' : v >= 1e4 ? Math.round(v / 1e3) / 10 + '만' : String(Math.round(v)); }

// ── 공통 조각 ──
function topbar() {
  return h('div', { class:'topin' }, [
    h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 증권' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function head(title, lead) { return [h('h1', { text:title }), lead ? h('p', { class:'lead', text:lead }) : null]; }
function go(v) { S.view = v; S.err = {}; S.msg = ''; render(); try { M.scrollIntoView({ block:'start' }); } catch (e) {} }
function notice() { return h('div', { class:'note info', style:'margin:16px 0', text:'이 화면은 주문을 보내지 않고 시세를 보여 주지 않습니다. 현재가는 직접 적고, 기록은 이 브라우저에만 저장됩니다. 계산 결과는 참고용 정보이며 투자 결정과 책임은 본인에게 있습니다. 나비는 특정 상품을 사라고 권하지 않습니다.' }); }
function field(id, label, val, o) {
  o = o || {}; var e = o.err, inp = h('input', { id:id, type:'text', value:val == null ? '' : val, placeholder:o.ph || '', maxlength:o.max || '60', inputmode:o.mode || '', autocomplete:'off', 'aria-invalid':e ? 'true' : 'false' });
  inp.oninput = function () { if (o.set) o.set(inp.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), inp, h('div', { id:id + '-h', class:e ? 'err' : 'help', text:e || o.help || '' })]);
}
function clsSel(id, val, set) {
  var s = h('select', { id:id, 'aria-label':'자산군' }, CLS.map(function (c) { return h('option', { value:c, text:c }); })); s.value = val; s.onchange = function () { set(s.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:'자산군' }), s, h('div', { class:'help', text:'' })]);
}
function empty(t, b) { return h('div', { class:'card', style:'margin-top:16px' }, [h('div', { class:'empty', text:t }), b ? h('div', { class:'rowf', style:'justify-content:center' }, [b]) : null]); }

// ── 내 포트폴리오 ──
function curPos() { var P = positions(S.trades); return { P:P, V:valued(P.pos, S.px) }; }
function viewPortfolio() {
  var kids = head('내 포트폴리오', '거래 기록에서 계산한 보유 종목과 손익입니다. 현재가를 적으면 평가금액이 계산됩니다.'); kids.push(notice());
  if (!S.trades.length) { kids.push(empty('아직 거래 기록이 없어요. 증권사에서 산 종목을 “거래 기록”에 적으면 여기에 모입니다.', btn('거래 기록하기', 'fill', function () { go('trades'); }))); var sc0 = simCard(); if (sc0) kids.push(sc0); kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('증권 AI에게 묻기', 'quiet', function () { ask('투자를 처음 시작하려면 무엇부터 알아야 하나요?'); })])); return kids; }
  var c = curPos(), V = c.V, P = c.P;
  kids.push(h('div', { class:'g4', style:'margin-top:4px' }, [['평가금액', V.rows.length && V.val ? won(V.val) + '원' : '—', ''], ['투자 원금', V.val ? won(V.cost) + '원' : '—', '현재가를 적은 종목 기준'], ['평가손익', V.val ? sgn(V.pl) + '원' : '—', V.val && V.cost ? pct(V.pl / V.cost) : ''], ['실현손익', sgn(P.realized) + '원', '수수료 ' + won(P.fees) + '원 포함']].map(function (x, i) { return h('div', { class:'tile' }, [h('div', { class:'k', text:x[0] }), h('div', { class:'num ' + (i === 2 ? cls(V.pl) : i === 3 ? cls(P.realized) : ''), id:'stk-t' + i, style:'font-size:20px;font-weight:700', text:x[1] }), x[2] ? h('div', { class:'sub', text:x[2] }) : null]); })));
  if (V.unpriced.length) kids.push(h('div', { class:'note', style:'margin-top:12px', text:'현재가를 적지 않은 ' + V.unpriced.length + '종목(' + V.unpriced.slice(0, 4).join(', ') + (V.unpriced.length > 4 ? ' 외' : '') + ')은 평가금액·손익에 넣지 않았습니다.' }));
  if (P.bad.length) kids.push(h('div', { class:'note', role:'alert', style:'margin-top:12px', text:'보유 수량보다 많이 판 기록 ' + P.bad.length + '건은 계산에서 뺐습니다. 거래 기록을 확인해 주세요.' }));
  if (!P.pos.length) kids.push(empty('지금 보유한 종목이 없어요. 모두 팔았거나 거래 기록이 매도뿐입니다.'));
  else {
    var rows = V.rows.slice().sort(function (a, b) { return (b.val || 0) - (a.val || 0) || b.p.cost - a.p.cost; });
    var tb = h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['종목', '자산군', '수량', '평균단가', '현재가(직접 입력)', '평가금액', '손익', '비중'].map(function (t, i) { return h('th', { class:i > 1 ? 'r' : '', text:t }); }))]),
      h('tbody', {}, rows.map(function (r, i) {
        var inp = h('input', { id:'stk-px-' + i, type:'text', inputmode:'decimal', value:r.price == null ? '' : String(r.price), placeholder:'현재가', 'aria-label':r.p.sym + ' 현재가' });
        inp.onchange = function () { var n = numOf(inp.value); if (inp.value.trim() === '') delete S.px[r.p.sym]; else if (isFinite(n) && n >= 0 && n <= 1e12) S.px[r.p.sym] = n; save(); render(); };
        var share = r.val != null && V.val ? r.val / V.val : null;
        return h('tr', {}, [h('td', {}, [h('b', { text:r.p.sym })]), h('td', { text:r.p.cls }), h('td', { class:'r num', text:+r.p.qty.toFixed(6) + '' }), h('td', { class:'r num', text:won(r.p.avg) }), h('td', { class:'r' }, [inp]),
          h('td', { class:'r num', text:r.val == null ? '—' : won(r.val) }), h('td', { class:'r num ' + cls(r.pl || 0), text:r.pl == null ? '—' : sgn(r.pl) + ' (' + pct(r.pl / r.p.cost) + ')' }), h('td', { class:'r num', text:share == null ? '—' : Math.round(share * 1000) / 10 + '%' })]);
      }))]);
    kids.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { class:'tbw' }, [tb])]));
    var big = V.val ? rows.filter(function (r) { return r.val != null && r.val / V.val * 100 > CONC; })[0] : null;
    if (big) kids.push(h('div', { class:'note info', style:'margin-top:12px', text:'참고: ' + big.p.sym + ' 한 종목이 평가금액의 ' + Math.round(big.val / V.val * 100) + '%를 차지합니다(알림 기준 ' + CONC + '%). 점검표의 “최대 비중” 항목을 확인해 보세요.' }));
    var cl = Object.keys(V.byCls).sort(function (a, b) { return V.byCls[b] - V.byCls[a]; });
    if (cl.length) kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { text:'자산군별 비중' }), h('div', {}, cl.map(function (k) { var v = V.byCls[k] / V.val * 100; return h('div', { class:'mrow' }, [h('div', { class:'nm', style:'flex-basis:96px', text:k }), h('div', { class:'tr' }, [h('em', { style:'width:' + v.toFixed(1) + '%;background:var(--pri)' })]), h('div', { class:'v', text:Math.round(v * 10) / 10 + '% · ' + won(V.byCls[k]) + '원' })]); })), h('div', { class:'rowf' }, [btn('목표 비중과 비교', 'sm', function () { go('alloc'); })])]));
  }
  var sc1 = simCard(); if (sc1) kids.push(sc1);
kids.push(h('div', { class:'card rowf', style:'margin-top:16px;justify-content:space-between' }, [h('div', { class:'col', style:'gap:2px;flex:1;min-width:220px' }, [h('b', { text:'재무제표로 기업을 평가해 보세요' }), h('span', { class:'sub', text:'나비웹에서는 모든 거래가 재무제표로 자동 기록되고, 상호 대조와 이상 탐지로 분식을 막는다는 원칙입니다.' })]), btn('내 가치 열기', 'sm', function () { go('value'); }), btn('기업 평가 열기', 'sm', function () { go('company'); })]));
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('거래 기록 추가', 'fill', function () { go('trades'); }), btn('증권 AI에게 묻기', 'quiet', function () { ask('내 포트폴리오에서 점검해 볼 점을 알려 주세요'); })]));
  return kids;
}

// ── 기업 평가(재무제표 기반) ──
function viewCompany() {
  var kids = head('기업 평가', '재무제표만으로 기업을 평가하는 증권 화면의 핵심 기능입니다.');
  var steps = [['모든 거래가 기록되어 재무제표가 만들어집니다', '나비웹의 모든 사용자(개인·기업)는 거래가 생길 때마다 재무제표가 자동으로 만들어지고 갱신됩니다. 결산 때 따로 만들지 않습니다.'], ['기록은 위변조할 수 없습니다', '모든 기록은 OpenHash로 남아 기록 시점 이후 바뀌지 않았음을 증명할 수 있습니다.'], ['거래 상대방과 서로 대조합니다', '한 거래는 양쪽(판 쪽·산 쪽) 기록이 있어 서로 맞춰 봅니다. 한쪽만 부풀린 매출이나 없는 거래는 상대 기록과 맞지 않아 드러납니다.'], ['이상한 거래는 바로 감지합니다', '평소와 다른 거래는 이상 탐지(anomaly detection)가 즉시 잡아냅니다. 그래서 재무제표만으로 기업을 평가할 수 있어요.']];
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'나비웹 재무제표가 다른 점' }), h('div', {}, steps.map(function (x, i) { return h('div', { class:'stp' }, [h('i', { text:String(i + 1) }), h('div', {}, [h('b', { text:x[0] }), h('span', { text:x[1] })])]); })),
    h('div', { class:'note info', text:'설계 원칙입니다. 이 원칙은 아직 설계 단계여서 지금은 기업의 재무제표가 이 화면에 자동으로 연결되어 있지 않아요. 아래 계산기에 재무제표 값을 직접 넣으면 같은 방식으로 평가 지표를 계산합니다. 재무제표에 없는 미래 전망(성장률·할인율)은 평가하는 사람이 가정해 넣어야 해요.' })]));
  var v = S.co, R = evalCo(v), set = function (k) { return function (x) { v[k] = x; save(); upd(); }; };
  var form = h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'재무제표 값 넣기 (원)' }), h('div', { class:'frm' }, [field('stk-c-name', '기업 이름(저장용)', v.name, { ph:'예: ○○전자', max:30, set:function (x) { v.name = x; save(); } }), field('stk-c-assets', '자산 총계', v.assets, { ph:'500000000000', mode:'decimal', max:20, help:'재무상태표', set:set('assets') }), field('stk-c-debt', '부채 총계', v.debt, { ph:'200000000000', mode:'decimal', max:20, set:set('debt') }), field('stk-c-equity', '자본 총계', v.equity, { ph:'300000000000', mode:'decimal', max:20, set:set('equity') }),
    field('stk-c-rev', '매출액(선택)', v.rev, { ph:'400000000000', mode:'decimal', max:20, help:'손익계산서', set:set('rev') }), field('stk-c-op', '영업이익(선택, 적자는 −)', v.op, { ph:'40000000000', mode:'decimal', max:20, set:set('op') }), field('stk-c-ni', '당기순이익(적자는 −)', v.ni, { ph:'30000000000', mode:'decimal', max:20, set:set('ni') }),
    field('stk-c-shares', '발행 주식 수(선택)', v.shares, { ph:'100000000', mode:'decimal', max:20, set:set('shares') }), field('stk-c-price', '현재 주가(원, 선택)', v.price, { ph:'72000', mode:'decimal', max:20, help:'직접 입력', set:set('price') }),
    field('stk-c-g', '이익 성장률 가정(%/년)', v.g, { ph:'3', mode:'decimal', max:6, set:set('g') }), field('stk-c-r', '요구 수익률 가정(%/년)', v.r, { ph:'10', mode:'decimal', max:6, help:'성장률보다 커야 계산돼요.', set:set('r') })]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('이 평가 저장', 'fill', function () { if (!evalCo(v)) { S.msg = '자산·부채·자본·순이익을 숫자로 넣어야 저장할 수 있어요.'; return render(); } if (S.cos.length >= 20) { S.msg = '저장은 최대 20개까지예요.'; return render(); } var o = { id:uid(), name:clean(v.name, 30) || '이름 없음', v:{} }; Object.keys(v).forEach(function (k) { o.v[k] = v[k]; }); S.cos.push(o); S.msg = '저장했어요.'; save(); render(); }), btn('지우기', 'quiet', function () { Object.keys(v).forEach(function (k) { v[k] = k === 'g' ? '3' : k === 'r' ? '10' : ''; }); S.msg = ''; save(); render(); }), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]);
  var out = h('div', { class:'col', id:'stk-c-out', style:'gap:16px' });
  function upd() { out.textContent = ''; coOut(evalCo(v)).forEach(function (x) { out.appendChild(x); }); }
  upd(); kids.push(h('div', { class:'g2', style:'margin-top:16px;align-items:start' }, [form, out]));
  var cc = S.cc, ccOut = h('div', { id:'stk-cc-out', style:'margin-top:12px' });
  function ccUpd() { ccOut.textContent = ''; var r = crossCheck(cc.a, cc.b, cc.tol); ccOut.appendChild(!r ? h('div', { class:'sub', text:'두 금액을 넣으면 맞는지 알려 줘요.' }) : h('div', { class:r.ok ? 'note info' : 'note', role:r.ok ? null : 'alert', id:'stk-cc-res', text:r.ok ? '두 기록이 맞아요(차이 ' + won(r.diff) + '원, ' + Math.round(r.rate * 1000) / 10 + '%).' : '두 기록이 맞지 않아요: 차이 ' + won(r.diff) + '원(' + Math.round(r.rate * 1000) / 10 + '%)이 허용 ' + cc.tol + '%를 넘어요. 나비웹에서는 이런 거래가 이상 탐지에 걸려요.' })); }
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'상호 대조 해 보기' }), h('div', { class:'sub', text:'한 거래의 양쪽 기록이 맞는지 보는 원리를 금액 두 개로 시연합니다(실제 기록과 연결되어 있지 않아요).' }),
    h('div', { class:'frm' }, [field('stk-cc-a', '파는 쪽 기록: 매출(원)', cc.a, { ph:'10000000', mode:'decimal', max:20, set:function (x) { cc.a = x; ccUpd(); } }), field('stk-cc-b', '사는 쪽 기록: 매입(원)', cc.b, { ph:'10000000', mode:'decimal', max:20, set:function (x) { cc.b = x; ccUpd(); } }), field('stk-cc-t', '허용 차이(%)', cc.tol, { ph:'1', mode:'decimal', max:5, set:function (x) { cc.tol = x; ccUpd(); } })]), ccOut])); ccUpd();
  if (S.cos.length) {
    var rows = S.cos.map(function (c) { return [c, evalCo(c.v)]; }), f1 = function (x) { return x == null ? '—' : Math.round(x * 1000) / 10 + '%'; }, f2 = function (x) { return x == null ? '—' : (Math.round(x * 100) / 100).toFixed(2) + '배'; };
    kids.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { class:'rowf', style:'padding:16px 16px 0' }, [h('b', { style:'font-size:17px', text:'저장한 평가 비교' })]), h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['기업', 'ROE', '부채비율', '영업이익률', 'PER', 'PBR', ''].map(function (t, i) { return h('th', { class:i && i < 6 ? 'r' : '', text:t }); }))]),
      h('tbody', {}, rows.map(function (x) { var c = x[0], r = x[1] || {}; return h('tr', {}, [h('td', {}, [h('b', { text:c.name }), r.balanced === false ? pill('대차 불일치', 'bad') : null]), h('td', { class:'r num', text:f1(r.roe) }), h('td', { class:'r num', text:f1(r.debtRatio) }), h('td', { class:'r num', text:f1(r.opm) }), h('td', { class:'r num', text:f2(r.per) }), h('td', { class:'r num', text:f2(r.pbr) }),
        h('td', { class:'r' }, [btn('불러오기', 'sm quiet', function () { Object.keys(S.co).forEach(function (k) { S.co[k] = c.v[k]; }); S.co.name = c.name; save(); render(); }), btn('삭제', 'sm quiet', function () { S.cos = S.cos.filter(function (y) { return y.id !== c.id; }); save(); render(); })])]); }))])])]));
  }
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('증권 AI에게 재무제표 보는 법 묻기', 'quiet', function () { ask('재무제표만으로 기업을 평가할 때 어떤 지표를 봐야 하나요?'); })]));
  return kids;
}
function coOut(R) {
  if (!R) return [h('div', { class:'card' }, [h('div', { class:'empty', text:'자산·부채·자본·순이익을 넣으면 평가 지표가 여기에 나와요.' })])];
  var f1 = function (x) { return x == null ? '—' : Math.round(x * 1000) / 10 + '%'; }, f2 = function (x) { return x == null ? '—' : (Math.round(x * 100) / 100).toFixed(2) + '배'; };
  var k = [];
  k.push(R.balanced ? h('div', { class:'note info', id:'stk-c-bal', text:'재무상태표가 맞아요(자산 = 부채 + 자본). 나비웹 재무제표는 거래가 기록될 때마다 이 등식이 항상 맞도록 만들어집니다.' }) : h('div', { class:'note', role:'alert', id:'stk-c-bal', text:'재무상태표가 맞지 않아요: 자산 − (부채 + 자본) = ' + sgn(R.diff) + '원. 입력값을 확인해 주세요. 직접 만든 재무제표는 이런 불일치가 생길 수 있지만, 나비웹에서는 거래 기록에서 자동으로 만들어져 생기지 않아요.' }));
  k.push(h('div', { class:'g2' }, [['수익성', [['ROE(자기자본이익률)', f1(R.roe)], ['ROA(총자산이익률)', f1(R.roa)], ['영업이익률', f1(R.opm)], ['순이익률', f1(R.npm)]]], ['안정성', [['부채비율', f1(R.debtRatio)], ['자기자본비율', f1(R.equityRatio)]]]].map(function (g) { return h('div', { class:'card col' }, [h('b', { text:g[0] }), h('div', {}, g[1].map(function (x, i) { return h('div', { class:'kv' }, [h('span', { text:x[0] }), h('b', { class:'num', id:g[0] === '수익성' ? 'stk-c-m' + i : 'stk-c-s' + i, text:x[1] })]); }))]); })));
  if (R.eps != null) k.push(h('div', { class:'card col' }, [h('b', { text:'주당 지표' }), h('div', {}, [['EPS(주당순이익)', won(R.eps) + '원'], ['BPS(주당순자산)', won(R.bps) + '원']].concat(R.mcap ? [['PER', f2(R.per)], ['PBR', f2(R.pbr)], ['시가총액', won(R.mcap) + '원']] : []).map(function (x) { return h('div', { class:'kv' }, [h('span', { text:x[0] }), h('b', { class:'num', text:x[1] })]); }))]));
  if (R.iv != null) k.push(h('div', { class:'card col' }, [h('b', { text:'간이 내재가치(가정에 따른 계산)' }), h('div', { class:'num', id:'stk-c-iv', style:'font-size:22px;font-weight:700', text:won(R.iv) + '원' }), h('div', { class:'sub', text:'순이익이 매년 성장률만큼 늘고 요구 수익률로 할인한다는 가정(순이익 × (1+g) ÷ (r−g))입니다.' + (R.ivps != null ? ' 주당 ' + won(R.ivps) + '원' + (R.gap != null ? ', 현재 주가보다 ' + pct(Math.abs(R.gap)) + (R.gap >= 0 ? ' 높게' : ' 낮게') + ' 계산돼요.' : '.') : '') }), h('div', { class:'sub', text:'가정이 조금만 달라져도 값이 크게 변해요. 매수·매도 권유가 아니에요.' })]));
  else k.push(h('div', { class:'sub', text:'간이 내재가치는 순이익이 0보다 크고 요구 수익률이 성장률보다 클 때 계산돼요.' }));
  return k;
}

// ── 내 가치 ──
function valOut(sm) {
  var v = valueOf(sm, S.val), k = [];
  if (!v) return [h('div', { class:'note', text:'지금 값으로는 계산할 수 없어요.' })];
  var tile = v.mode === 'range'
    ? h('div', { class:'card col', id:'stk-v-res' }, [h('b', { style:'font-size:17px', text:'내 가치 구간 (' + VER + ')' }), h('div', { class:'num', id:'stk-v-range', style:'font-size:24px;font-weight:700', text:won(v.low) + ' ~ ' + won(v.high) + '원' }),
        h('div', { class:'sub', text:'수익가치 시나리오 ' + v.sc.length + '개(' + v.sc.map(function (x) { return x.name + ' 성장 ' + x.g + '%·수익률 ' + x.r + '%'; }).join(' / ') + ')의 최소~최대입니다. 구간의 폭은 가정의 차이일 뿐 데이터 충분도를 뜻하지 않아요.' })])
    : h('div', { class:'card col', id:'stk-v-res' }, [h('b', { style:'font-size:17px', text:'구간을 낼 수 없어요 — 순자산(장부가)만 보여 드려요' }), h('div', { class:'num', id:'stk-v-range', style:'font-size:24px;font-weight:700', text:won(v.equity) + '원' }),
        h('div', { class:'sub', text:(v.sales > 0 && !v.profitKnown ? '원가를 알 수 없는 매출이 있어(원가 미확인 ' + won(v.uncovered) + '원) 이익을 계산할 수 없어요.' : v.sales > 0 ? '세후 영업이익이 0 이하라 수익가치를 계산할 수 없어요(판매비·관리비·예상 세금 반영 후).' : '이익 근거가 없어요(아직 매출이 없어요).') + ' 순자산은 자산 합계 ' + won(v.assets) + '원 − 부채 합계 ' + won(v.debt) + '원입니다. 산 이력이 있는 물건을 팔아 거래가 쌓이면 구간이 나와요.' })]);
  k.push(tile);
  k.push(h('div', { class:'card col' }, [h('b', { text:'이 평가에 쓴 신호' }), h('div', {}, [
    ['재무(내 장부)', '연결됨 · 자산 ' + won(v.assets) + ' / 부채 ' + won(v.debt) + ' / 자본 ' + won(v.equity) + '원' + (v.balanced ? '' : ' (대차 불일치)')],
    ['이익', v.earn > 0 ? (v.net ? '세후 영업이익 ' + won(v.earn) + '원 (매출 ' + won(v.sales) + ' − 매출원가 ' + won(v.cogs) + ' − 판매비·관리비 ' + won(v.opex) + ' − 참고용 예상 소득세 ' + won(v.taxEst) + ')' : '매출총이익 ' + won(v.earn) + '원 (매출 ' + won(v.sales) + ' − 매출원가 ' + won(v.cogs) + ', 판매비·관리비·세금 미반영)') : v.sales > 0 && !v.profitKnown ? '원가 미확인 — 쓰지 않았어요' : '근거 없음']].concat(GAPS.map(function (g) { return [g, '데이터 미연결 — 쓰지 않았어요']; })).map(function (x) { return h('div', { class:'kv' }, [h('span', { text:x[0] }), h('b', { text:x[1] })]); }))]));
  k.push(h('div', { class:'sub', id:'stk-v-hash', text:'입력 해시 계산 중…' }));
  hashOf(v).then(function (x) { var e = $('stk-v-hash'); if (e) e.textContent = x ? '모델 ' + VER + ' · 입력 해시 ' + x.slice(0, 16) + '… (같은 장부·같은 가정이면 같은 값이 나와요)' : '모델 ' + VER + ' · 이 브라우저에서는 입력 해시를 만들 수 없어요.'; });
  return k;
}
function viewValue() {
  var kids = head('내 가치', '내 장부로 계산한 내 가치입니다. 평가 정보는 나만 볼 수 있고, 내가 고르기 전에는 공개되지 않아요.');
  kids.push(h('div', { class:'note info', style:'margin:16px 0', text:'평가 ' + VER + '입니다. 장부에 있는 값과 아래에 내가 넣는 가정만으로 계산해요. 통화량·업종·인력 같은 신호는 아직 연결되어 있지 않아 쓰지 않았어요. 매수·매도 권유나 가격 예측이 아니에요.' }));
  var L = NL(), sm = L ? L.summary('나') : null;
  if (!L) { kids.push(h('div', { class:'note', role:'alert', text:'장부 모듈을 불러오지 못했어요. 새로고침해 주세요.' })); return kids; }
  if (!sm) { kids.push(empty('아직 내 장부에 거래가 없어요. 시장에서 거래하고 세무 회계에서 전표를 처리하면 장부가 만들어지고, 그러면 여기서 내 가치를 계산해요.')); kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('증권 AI에게 묻기', 'quiet', function () { ask('내 가치는 어떤 자료로 계산되나요?'); })])); return kids; }
  kids.push(h('div', { class:'card col', id:'stk-v-book' }, [h('b', { text:'내 장부 상태' }), h('div', {}, [['반영된 전표', sm.n + '건'], ['가장 최근 반영', (sm.asOf || '갱신일시 기록 없음') + ' · ' + sm.serials[sm.serials.length - 1]], ['현금 계정', sm.usesWallet ? '은행 GDC 잔액과 같아요(은행 화면에서 읽은 값)' : '체험용 가상 초안 값이에요 — 은행 화면을 열면 은행 잔고와 같아져요'], ['대차', sm.totals.balanced ? '맞아요' : '맞지 않아요']].map(function (x) { return h('div', { class:'kv' }, [h('span', { text:x[0] }), h('b', { text:x[1] })]); }))]));
  var set = function (key) { return function (x) { S.val[key] = x; save(); upd(); }; }, out = h('div', { class:'col', id:'stk-v-out', style:'gap:16px' });
  function upd() { out.textContent = ''; valOut(sm).forEach(function (x) { out.appendChild(x); }); }
  upd();
  var form = h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'내 가정' }), h('div', { class:'frm' }, [field('stk-v-g', '이익 성장률 가정(%/년)', S.val.g, { ph:'3', mode:'decimal', max:6, set:set('g') }), field('stk-v-r', '요구 수익률 가정(%/년)', S.val.r, { ph:'10', mode:'decimal', max:6, help:'성장률보다 커야 수익가치가 계산돼요.', set:set('r') })]),
    h('div', { class:'sub', text:'이익이 있을 때만 쓰이는 가정입니다. 미래 전망은 평가하는 사람이 정해야 하는 값이라 기본값(3%, 10%)은 예시일 뿐이에요.' })]);
  kids.push(h('div', { class:'g2', style:'margin-top:16px;align-items:start' }, [out, form]));
  kids.push(h('div', { class:'card', style:'margin-top:16px' }, [h('div', { class:'sub', text:'개인의 적정 임금 구간은 경력·근속·신용 데이터가 연결된 뒤에 제공해요. 지금은 내 장부로 계산하는 가치만 보여 드려요.' })]));
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('증권 AI에게 계산 방법 묻기', 'quiet', function () { ask('내 가치 구간은 어떻게 계산했나요?'); })]));
  return kids;
}

// ── 종목 탐색·내 공개 설정(자금 조달) ──
var SECTORS = ['도소매', '제조', '서비스', 'IT·정보통신', '음식·숙박', '건설·부동산', '농림어업', '기타'];
var REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
var SIZES = [['small', '소규모(자산 1억 원 미만)'], ['mid', '중간(1억 ~ 10억 원 미만)'], ['large', '큰 규모(10억 원 이상)']];
var PUB_KEY = 'navi-pub-v1', PUB_FIELDS = [['equity', '순자산'], ['range', '가치 평가 구간(최저~최고)'], ['sales', '매출'], ['series', '평가 변화 시계열']];
function sizeOf(assets) { return assets >= 1e9 ? 'large' : assets >= 1e8 ? 'mid' : 'small'; }
function pubLoad() {
  var d = { on:false, name:'', sector:'', region:'', fields:{ equity:false, range:false, sales:false, series:false } };
  try { var v = JSON.parse(localStorage.getItem(PUB_KEY) || 'null'); if (!v) return d; d.on = v.on === true; d.name = typeof v.name === 'string' ? v.name.slice(0, 30) : ''; d.sector = SECTORS.indexOf(v.sector) >= 0 ? v.sector : ''; d.region = REGIONS.indexOf(v.region) >= 0 ? v.region : '';
    PUB_FIELDS.forEach(function (f) { d.fields[f[0]] = !!(v.fields && v.fields[f[0]] === true); }); } catch (e) { /* 깨진 값은 기본값 */ }
  return d;
}
function pubSave() { try { localStorage.setItem(PUB_KEY, JSON.stringify(S.pub)); } catch (e) { /* 저장 불가여도 화면은 쓴다 */ } }
/** 공개 목록의 한 항목: 사용자가 고른 항목만 담고, 고르지 않은 값은 키 자체를 넣지 않는다(내보내지 않는 값은 여기에도 없다). */
function listingOf(pub, sm) {
  if (!pub.on || !pub.name || !pub.sector || !pub.region || !sm) return null;
  var o = { id:'me', name:pub.name, sector:pub.sector, region:pub.region, size:sizeOf(sm.assets), asOf:sm.asOf, shown:{} };
  if (pub.fields.equity) o.shown.equity = sm.equity;
  if (pub.fields.sales) o.shown.sales = sm.sales || 0;
  if (pub.fields.range) { var v = valueOf(sm, S.val); o.shown.low = v.low; o.shown.high = v.high; o.shown.mode = v.mode; }
  if (pub.fields.series) o.shown.series = sm.serials.length;
  return o;
}
/** 색인 검색: 업종·지역·규모(비어 있으면 전체)와 이름 일부. 이름순. */
function searchListings(list, q) {
  q = q || {}; var t = String(q.text || '').trim().toLowerCase();
  return (list || []).filter(function (x) { return x && (!q.sector || x.sector === q.sector) && (!q.region || x.region === q.region) && (!q.size || x.size === q.size) && (!t || String(x.name).toLowerCase().indexOf(t) >= 0); }).sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
}
function selF(id, label, opts, val, set, all) {
  var s = h('select', { id:id, 'aria-label':label }, (all ? [h('option', { value:'', text:'전체' })] : [h('option', { value:'', text:'고르세요' })]).concat(opts.map(function (o) { var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; return h('option', { value:v, text:t }); }))); s.value = val || ''; s.onchange = function () { set(s.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), s]);
}
function viewExplore() {
  var kids = head('종목 탐색', '투자하고 싶은 기업을 업종·규모·지역으로 찾습니다. 자금을 조달하려는 사람이 직접 공개한 정보만 보여요.');
  kids.push(h('div', { class:'note info', style:'margin:16px 0', text:'공개 정보를 모으는 서버가 아직 없어 이 화면은 틀과 검색 규칙만 열려 있어요. 지금 보이는 항목은 내가 공개 설정으로 만든 미리보기뿐이고, 이 브라우저에만 있어서 다른 사람에게 보이지 않아요. 나비는 특정 종목을 권하지 않습니다.' }));
  var L = NL(), sm = L ? L.summary('나') : null, q = S.xq;
  var mine = listingOf(S.pub, sm), res = searchListings(mine ? [mine] : [], q);
  kids.push(h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'찾기' }),
    h('div', { class:'frm' }, [field('stk-x-text', '이름', q.text, { ph:'이름 일부', max:30, set:function (v) { q.text = v; } }), selF('stk-x-sector', '업종', SECTORS, q.sector, function (v) { q.sector = v; }, true), selF('stk-x-size', '규모', SIZES, q.size, function (v) { q.size = v; }, true), selF('stk-x-region', '지역', REGIONS, q.region, function (v) { q.region = v; }, true)]),
    h('div', { class:'rowf' }, [btn('찾기', 'fill', function () { render(); }), btn('조건 지우기', 'quiet', function () { S.xq = { text:'', sector:'', size:'', region:'' }; render(); })])]));
  var out = h('div', { class:'card col', id:'stk-x-res', style:'margin-top:16px' }, [h('b', { text:'찾은 기업 ' + res.length + '곳' })]);
  if (!res.length) out.appendChild(h('div', { class:'sub', id:'stk-x-empty', text:'조건에 맞는 공개 기업이 없어요. 공개한 기업이 아직 없거나 조건이 너무 좁을 수 있어요.' }));
  res.forEach(function (x) {
    var sh = x.shown, rows = [['업종', x.sector], ['지역', x.region], ['규모', SIZES.filter(function (z) { return z[0] === x.size; })[0][1]], ['장부 기준일', x.asOf || '기록 없음']];
    if ('equity' in sh) rows.push(['순자산', won(sh.equity) + '원']); if ('sales' in sh) rows.push(['매출', won(sh.sales) + '원']);
    if ('low' in sh) rows.push([sh.mode === 'range' ? '가치 평가 구간' : '순자산(수익가치 없음)', won(sh.low) + ' ~ ' + won(sh.high) + '원']); if ('series' in sh) rows.push(['평가에 쓴 전표', sh.series + '건']);
    out.appendChild(h('div', { class:'card col', style:'margin-top:8px' }, [h('div', { class:'rowf', style:'justify-content:space-between' }, [h('b', { text:x.name }), pill('내 미리보기', 'm')])].concat(rows.map(function (r) { return h('div', { class:'kv' }, [h('span', { text:r[0] }), h('b', { text:r[1] })]); }))));
  });
  kids.push(out);
  var p = S.pub, setP = function (k) { return function (v) { p[k] = v; pubSave(); }; };
  kids.push(h('div', { class:'card col', id:'stk-x-pub', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'내 공개 설정(자금 조달)' }),
    h('div', { class:'sub', text:'공개는 내가 고르는 일이에요. 끄면 아무것도 내보내지 않고, 켜도 아래에서 고른 항목만 보여요. 고르지 않은 값은 공개 정보에 들어가지 않아요.' }),
    h('label', { class:'rowf' }, [h('input', { type:'checkbox', id:'stk-x-on', checked:p.on ? 'checked' : null, onchange:function () { p.on = this.checked; pubSave(); render(); } }), h('span', { text:'자금 조달을 위해 공개하기' })]),
    h('div', { class:'frm' }, [field('stk-x-name', '공개 이름', p.name, { max:30, set:setP('name') }), selF('stk-x-psector', '업종', SECTORS, p.sector, function (v) { p.sector = v; pubSave(); }), selF('stk-x-pregion', '지역', REGIONS, p.region, function (v) { p.region = v; pubSave(); })]),
    h('div', { class:'col', style:'gap:4px' }, PUB_FIELDS.map(function (f) { return h('label', { class:'rowf' }, [h('input', { type:'checkbox', id:'stk-x-f-' + f[0], checked:p.fields[f[0]] ? 'checked' : null, onchange:function () { p.fields[f[0]] = this.checked; pubSave(); render(); } }), h('span', { text:f[1] })]); })),
    !sm ? h('div', { class:'sub', id:'stk-x-nobook', text:'내 장부에 거래가 아직 없어 공개할 값이 없어요.' }) : (p.on && !mine ? h('div', { class:'sub', id:'stk-x-need', text:'이름·업종·지역을 모두 채우면 위 목록에 미리보기가 나와요.' }) : null),
    h('div', { class:'sub', text:'실제 공개(다른 사람이 찾아볼 수 있게 하는 일)는 공개 서버와 금융당국 인가 경로가 정해진 뒤에 열려요.' })]));
  return kids;
}

// ── 내 임금(개인 가치 v0) ──
/** 임금 기록(월 오름차순)에서 최근 12개월 구간·평균·최근 3개월 대 직전 3개월 증감. 기록이 없으면 null(지어내지 않는다). */
function wageStats(items) {
  if (!items || !items.length) return null;
  var a = items.slice().sort(function (x, y) { return x.m < y.m ? -1 : 1; }), r = a.slice(-12), v = r.map(function (x) { return Number(x.amt); }), sum = v.reduce(function (s, x) { return s + x; }, 0), ch = null;
  if (a.length >= 6) { var l3 = a.slice(-3).reduce(function (s, x) { return s + Number(x.amt); }, 0) / 3, p3 = a.slice(-6, -3).reduce(function (s, x) { return s + Number(x.amt); }, 0) / 3; ch = (l3 - p3) / p3 * 100; }
  return { n:a.length, from:a[0].m, to:a[a.length - 1].m, last:Number(a[a.length - 1].amt), lo:Math.min.apply(null, v), hi:Math.max.apply(null, v), avg:Math.round(sum / v.length), months:r.length, change:ch, rows:a };
}
var WAGE_GAPS = ['직무·경력·자격(검증된 정보)', '업종·지역 노동시장 임금 통계', '근속·고용 안정성', '경제·인구 구조 변화'];
function viewWage() {
  var kids = head('내 임금', '개인의 가치는 임금으로 표명돼요. 내가 적은 월 임금 기록으로 내 임금의 흐름을 봅니다. 평가 정보는 나만 보고, 내보내지 않아요.');
  kids.push(h('div', { class:'note info', style:'margin:16px 0', text:'임금 평가 v0입니다. 지금은 내가 적은 기록만 쓰고, 시장 임금 통계·검증된 경력은 아직 연결되지 않아 "공정 임금 구간"은 내지 않아요. 기록은 시장이 서명한 전표가 아니라 내가 적는 것이라, 한번 적으면 고칠 수 없고(달마다 한 건) 그렇게 표시돼요.' }));
  var L = NL(); if (!L) { kids.push(h('div', { class:'note', role:'alert', text:'장부 모듈을 불러오지 못했어요. 새로고침해 주세요.' })); return kids; }
  if (S.wageMsg) kids.push(h('div', { class:S.wageMsg.bad ? 'note' : 'note info', role:S.wageMsg.bad ? 'alert' : 'status', id:'stk-w-msg', style:'margin-bottom:12px', text:S.wageMsg.t }));
  var w = S.wage, setW = function (k) { return function (v) { w[k] = v; }; };
  kids.push(h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'월 임금 적기' }),
    h('div', { class:'frm' }, [field('stk-w-m', '월(예: ' + kst().slice(0, 7) + ')', w.m, { ph:kst().slice(0, 7), max:7, set:setW('m') }), field('stk-w-amt', '그 달 임금(원, 세전)', w.amt, { ph:'3500000', mode:'numeric', set:setW('amt') }), field('stk-w-memo', '메모(선택)', w.memo, { max:40, set:setW('memo') })]),
    h('div', { class:'rowf' }, [btn('적기', 'fill', function () { var r = L.wageAdd(w.m, w.amt, w.memo); S.wageMsg = r.ok ? { t:r.item.m + ' 임금 ' + won(r.item.amt) + '원을 적었어요.' } : { t:r.msg, bad:true }; if (r.ok) { w.m = ''; w.amt = ''; w.memo = ''; } render(); })])]));
  var st = wageStats(L.wageLoad());
  if (!st) { kids.push(h('div', { class:'card', style:'margin-top:16px' }, [h('div', { class:'sub', id:'stk-w-empty', text:'아직 적은 임금이 없어요. 한 달치를 적으면 흐름이 나와요.' })])); }
  else {
    kids.push(h('div', { class:'card col', id:'stk-w-res', style:'margin-top:16px' }, [h('div', { class:'rowf', style:'justify-content:space-between' }, [h('b', { style:'font-size:17px', text:'내 임금의 흐름' }), pill('내가 적은 기록', 'm')]),
      h('div', { class:'num', id:'stk-w-range', style:'font-size:22px;font-weight:700', text:won(st.lo) + ' ~ ' + won(st.hi) + '원' }),
      h('div', { class:'sub', text:'최근 ' + st.months + '개월 기록의 최저 ~ 최고예요. 가치의 예측이 아니라 적은 값의 범위입니다.' }),
      h('div', {}, [['최근 달(' + st.to + ')', won(st.last) + '원'], ['최근 ' + st.months + '개월 평균', won(st.avg) + '원'], ['기록', st.n + '개월 (' + st.from + ' ~ ' + st.to + ')'], ['최근 3개월 대 직전 3개월', st.change == null ? '6개월 이상 적으면 나와요' : (st.change >= 0 ? '+' : '−') + Math.abs(st.change).toFixed(1) + '%']].map(function (x) { return h('div', { class:'kv' }, [h('span', { text:x[0] }), h('b', { text:x[1] })]); }))]));
    kids.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { style:'padding:14px 16px 0' }, [h('b', { text:'월별 기록(시계열)' })]), h('div', { class:'tbw' }, [h('table', { class:'tbl', id:'stk-w-tbl' }, [h('thead', {}, [h('tr', {}, ['월', '임금', '메모'].map(function (t, i) { return h('th', { class:i === 1 ? 'r' : '', text:t }); }))]), h('tbody', {}, st.rows.slice().reverse().slice(0, 24).map(function (x) { return h('tr', {}, [h('td', { class:'num', text:x.m }), h('td', { class:'r num', text:won(x.amt) }), h('td', { class:'sub', text:x.memo || '' })]); }))])])]));
  }
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { text:'아직 쓰지 않는 신호' })].concat(WAGE_GAPS.map(function (g) { return h('div', { class:'kv' }, [h('span', { text:g }), h('b', { text:'데이터 미연결 — 쓰지 않았어요' })]); }))));
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('증권 AI에게 묻기', 'quiet', function () { ask('내 임금 기록은 어떻게 평가에 쓰이나요?'); })]));
  return kids;
}

// ── 모의 주문·체결(테스트 GDC, 장부 전표) ──
function simCard() {
  var L = NL(); if (!L || !S.sec.recs.length) return null;
  var st = L.secState(S.sec.recs);
  return h('div', { class:'card col', id:'stk-sim-card', style:'margin-top:16px' }, [h('div', { class:'rowf', style:'justify-content:space-between' }, [h('b', { style:'font-size:17px', text:'모의 계좌 (장부에서 계산)' }), pill('모의', 'm')]),
    h('div', {}, [['모의 현금(테스트 GDC)', won(st.cash) + '원'], ['투자자산 장부가', won(st.invest) + '원'], ['증권 처분손익', sgn(st.realized) + '원'], ['낸 수수료(예시 요율)', won(st.fees) + '원']].map(function (x) { return h('div', { class:'kv' }, [h('span', { text:x[0] }), h('b', { class:'num', text:x[1] })]); })),
    st.positions.length ? h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['종목', '수량', '평균단가', '장부가', '마지막 체결가'].map(function (t, i) { return h('th', { class:i ? 'r' : '', text:t }); }))]),
      h('tbody', {}, st.positions.map(function (p) { return h('tr', {}, [h('td', {}, [h('b', { text:p.sym })]), h('td', { class:'r num', text:String(p.qty) }), h('td', { class:'r num', text:won(p.avg) }), h('td', { class:'r num', text:won(p.cost) }), h('td', { class:'r num', text:won(st.last[p.sym]) })]); }))])]) : h('div', { class:'sub', text:'보유한 모의 종목이 없어요.' }),
    h('div', { class:'rowf' }, [btn('모의 주문 열기', 'sm', function () { go('order'); })])]);
}
function openSim() {
  var L = NL(); if (!L || S.secBusy) return; S.secBusy = true;
  L.secAppend(S.sec, L.secGrant()).then(function (r) {
    S.secBusy = false;
    if (!r) S.secMsg = { t:'이 브라우저에서는 장부 해시를 만들 수 없어 모의 계좌를 열 수 없어요(보안 연결 필요).', bad:true };
    else { S.sec.recs.push(r); L.secSave(S.sec); S.secMsg = { t:'모의 계좌를 열었어요. 테스트 GDC ' + won(L.SIM_GRANT) + '원 입금 전표 ' + r.serial }; }
    render();
  });
}
function placeOrder() {
  var L = NL(); if (!L || S.secBusy) return; var f = S.order;
  var plan = L.secPlan(L.secState(S.sec.recs), { kind:f.side === 'S' ? 'sell' : 'buy', sym:f.sym, cls:f.cls, qty:numOf(f.qty), px:numOf(f.px), d:kst() }, S.sec.recs.length);
  S.secVer = null;
  if (!plan.ok) { if (plan.alert) { S.sec.alerts.unshift(plan.alert); S.sec.alerts = S.sec.alerts.slice(0, 50); L.secSave(S.sec); } S.secMsg = { t:plan.msg, bad:true }; return render(); }
  S.secBusy = true;
  L.secAppend(S.sec, plan.rec).then(function (r) {
    S.secBusy = false;
    if (!r) { S.secMsg = { t:'이 브라우저에서는 장부 해시를 만들 수 없어 주문을 기록하지 못했어요.', bad:true }; return render(); }
    S.sec.recs.push(r); L.secSave(S.sec); S.order = { side:f.side, sym:'', cls:f.cls, qty:'', px:'' };
    S.secMsg = { t:(r.kind === 'buy' ? '매수' : '매도') + ' 체결(모의) — 전표 ' + r.serial + ' · 수수료 ' + won(r.fee) + '원' }; render();
  });
}
function verifySim(tamper) {
  var L = NL(); if (!L || !S.sec.recs.length) return; var recs = S.sec.recs;
  if (tamper) { recs = JSON.parse(JSON.stringify(recs)); var i = recs.length - 1; if (recs[i].kind === 'grant') recs[i].amt += 1; else recs[i].qty += 1; }
  L.secVerify(recs).then(function (v) { v.tamper = !!tamper; S.secVer = v; render(); });
}
function viewOrder() {
  var kids = head('모의 주문·체결', '테스트 GDC로 증권을 사고파는 연습입니다. 거래가 장부 전표로 남고, 보유 종목과 손익이 이 장부에서 계산돼요.');
  kids.push(h('div', { class:'note info', style:'margin:16px 0', text:'모의 거래입니다. 진짜 GDC와 증권은 오가지 않고, 시세 서버가 없어 체결가는 직접 적어요. 실제 증권 거래는 금융당국 인가 경로가 정해진 뒤에 열려요. 수수료율은 예시(기존 증권사의 1/10 가정, 기준 미확정)이고 증권거래세 등 세금은 아직 반영하지 않았어요. 나비는 특정 상품을 사라고 권하지 않습니다.' }));
  var L = NL(); if (!L) { kids.push(h('div', { class:'note', role:'alert', text:'장부 모듈을 불러오지 못했어요. 새로고침해 주세요.' })); return kids; }
  if (S.secMsg) kids.push(h('div', { class:S.secMsg.bad ? 'note' : 'note info', role:S.secMsg.bad ? 'alert' : 'status', id:'stk-o-msg', style:'margin-bottom:12px', text:S.secMsg.t }));
  if (!S.sec.recs.length) { kids.push(h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'모의 계좌 열기' }), h('div', { class:'sub', text:'테스트 GDC ' + won(L.SIM_GRANT) + '원이 입금된 전표로 시작해요. 이 돈은 실제 GDC가 아니고 은행 잔고와도 섞이지 않아요.' }), h('div', { class:'rowf' }, [btn('모의 계좌 열기', 'fill', openSim)])])); return kids; }
  var st = L.secState(S.sec.recs), f = S.order, setO = function (k) { return function (v) { f[k] = v; }; };
  kids.push(h('div', { class:'g4' }, [['모의 현금', won(st.cash) + '원', '테스트 GDC'], ['투자자산 장부가', won(st.invest) + '원', ''], ['증권 처분손익', sgn(st.realized) + '원', '평균단가법'], ['대차', st.balanced ? '맞아요' : '맞지 않아요', '자산 = 자본 + 손익 − 수수료']].map(function (x, i) { return h('div', { class:'tile' }, [h('div', { class:'k', text:x[0] }), h('div', { class:'num', id:'stk-o-t' + i, style:'font-size:20px;font-weight:700', text:x[1] }), x[2] ? h('div', { class:'sub', text:x[2] }) : null]); })));
  var seg = h('div', { class:'seg', role:'group', 'aria-label':'매수 매도' }, [['B', '매수'], ['S', '매도']].map(function (x) { return h('button', { type:'button', 'aria-pressed':String(f.side === x[0]), text:x[1], onclick:function () { f.side = x[0]; render(); } }); }));
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'주문' }), seg,
    h('div', { class:'frm' }, [field('stk-o-sym', '종목', f.sym, { ph:'예: 삼성전자', max:30, set:setO('sym') }), clsSel('stk-o-cls', f.cls, setO('cls')), field('stk-o-qty', '수량(정수)', f.qty, { ph:'10', mode:'numeric', set:setO('qty') }), field('stk-o-px', '체결 가격(원, 직접 입력)', f.px, { ph:'72000', mode:'decimal', help:'직전 체결가에서 ±' + Math.round(L.DEV_LIMIT * 100) + '%를 넘으면 감독 규칙이 보류해요.', set:setO('px') })]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('주문하기(모의)', 'fill', placeOrder)])]));
  var recs = S.sec.recs.slice().reverse();
  kids.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { style:'padding:14px 16px 0' }, [h('b', { style:'font-size:17px', text:'장부 전표' }), h('div', { class:'sub', text:'전표마다 앞 전표의 해시를 이어 붙여요. 최근 20건을 보여 드려요.' })]),
    h('div', { class:'tbw' }, [h('table', { class:'tbl', id:'stk-o-ledger' }, [h('thead', {}, [h('tr', {}, ['일련번호', '일시', '구분', '종목', '수량', '가격', '분개', '해시'].map(function (t, i) { return h('th', { class:i > 3 && i < 6 ? 'r' : '', text:t }); }))]),
      h('tbody', {}, recs.slice(0, 20).map(function (r) { return h('tr', {}, [h('td', { class:'num', text:r.serial }), h('td', { class:'num', text:r.at }), h('td', {}, [pill(r.kind === 'grant' ? '입금' : r.kind === 'buy' ? '매수' : '매도', r.kind === 'sell' ? 'm' : '')]), h('td', { text:r.sym || '' }), h('td', { class:'r num', text:r.qty ? String(r.qty) : '' }), h('td', { class:'r num', text:r.px ? won(r.px) : '' }),
        h('td', { class:'sub', text:r.lines.map(function (l) { return (l[1] ? '차 ' : '대 ') + l[0] + ' ' + won(l[1] || l[2]); }).join(' · ') }), h('td', { class:'num', text:r.hash.slice(0, 8) })]); }))])])]));
  var ver = h('div', { id:'stk-o-ver', style:'margin-top:12px' });
  if (S.secVer) { var v = S.secVer; ver.appendChild(h('div', { class:v.tamper ? (v.ok ? 'note' : 'note info') : (v.ok ? 'note info' : 'note'), role:'status', id:'stk-o-ver-res', text:v.tamper ? '마지막 전표의 수량(또는 금액)을 몰래 1 올렸다고 가정해 다시 확인해 봤어요(실제 장부는 그대로예요). ' + (v.ok ? '그대로 통과했어요.' : '→ ' + (v.bad + 1) + '번째 전표에서 바로 드러나요: ' + v.why + '.') : (v.ok ? '모든 전표가 맞아요 — ' + v.n + '건의 해시 이음과 분개를 다시 계산해 확인했어요.' : (v.bad + 1) + '번째 전표가 맞지 않아요: ' + v.why + '.') })); }
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { text:'장부 확인' }), h('div', { class:'sub', text:'전표가 몰래 바뀌었는지 해시 이음과 분개를 다시 계산해 확인해요.' }), h('div', { class:'rowf' }, [btn('장부 확인', 'fill', function () { verifySim(false); }), btn('장부를 몰래 고친다면?', 'quiet', function () { verifySim(true); })]), ver]));
  kids.push(h('div', { class:'card col', style:'margin-top:16px', id:'stk-o-alerts' }, [h('b', { text:'감독 AI 알림' }), S.sec.alerts.length ? h('div', {}, S.sec.alerts.slice(0, 10).map(function (a) { return h('div', { class:'kv' }, [h('span', { text:a.at }), h('b', { text:a.msg })]); })) : h('div', { class:'sub', text:'아직 알림이 없어요. 주문은 규칙에 따라 자동으로 검사돼요(직전 체결가 ±' + Math.round(L.DEV_LIMIT * 100) + '% 이탈, 보유 수량 초과, 모의 현금 부족).' })]));
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('증권 AI에게 묻기', 'quiet', function () { ask('모의 주문은 어떻게 장부에 기록되나요?'); })]));
  return kids;
}

// ── 거래 기록 ──
function tradeErr(f) {
  var e = {}, q = numOf(f.qty), p = numOf(f.px), fee = f.fee === '' ? 0 : numOf(f.fee);
  if (!clean(f.sym, 30)) e.sym = '종목 이름을 적어 주세요.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.d) || isNaN(Date.parse(f.d))) e.d = '날짜를 2026-11-23 처럼 적어 주세요.'; else if (f.d > kst()) e.d = '오늘 이후 날짜는 기록할 수 없어요.';
  if (!(q > 0) || q > 1e12) e.qty = '수량을 0보다 크게 적어 주세요.';
  if (!isFinite(p) || p < 0 || p > 1e12) e.px = '가격(원)을 숫자로 적어 주세요.';
  if (!isFinite(fee) || fee < 0 || fee > 1e12) e.fee = '수수료는 0 이상의 숫자로 적어 주세요.';
  if (!Object.keys(e).length && f.side === 'S') { var t = positions(S.trades.concat([{ id:'new', d:f.d, side:'S', sym:clean(f.sym, 30), cls:f.cls, qty:q, px:p, fee:fee }])); if (t.bad.indexOf('new') >= 0) e.qty = '그 날짜까지 보유한 수량보다 많이 팔 수 없어요.'; }
  return e;
}
function addTrade() {
  var f = S.form; if (!f.d) f.d = kst();
  S.err = tradeErr(f); if (Object.keys(S.err).length) { S.msg = ''; return render(); }
  if (S.trades.length >= MAXT) { S.err = { qty:'기록은 최대 ' + MAXT + '건까지 둘 수 있어요.' }; return render(); }
  S.trades.push({ id:uid(), d:f.d, side:f.side, sym:clean(f.sym, 30), cls:f.cls, qty:numOf(f.qty), px:numOf(f.px), fee:f.fee === '' ? 0 : numOf(f.fee) });
  S.form = { side:f.side, d:f.d, sym:'', cls:f.cls, qty:'', px:'', fee:'' }; S.err = {}; S.msg = '기록했어요.'; save(); render();
}
function viewTrades() {
  var kids = head('거래 기록', '증권사에서 한 거래를 직접 적어 두는 곳입니다. 포트폴리오와 실현손익이 여기서 계산됩니다.'); kids.push(notice());
  var f = S.form, e = S.err; if (!f.d) f.d = kst();
  var seg = h('div', { class:'seg', role:'group', 'aria-label':'매수 매도' }, [['B', '매수'], ['S', '매도']].map(function (x) { return h('button', { type:'button', 'aria-pressed':String(f.side === x[0]), text:x[1], onclick:function () { f.side = x[0]; render(); } }); }));
  var card = h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'거래 적기' }), seg,
    h('div', { class:'frm' }, [field('stk-d', '거래일', f.d, { err:e.d, ph:'2026-11-23', max:10, mode:'numeric', set:function (v) { f.d = v.trim(); } }), field('stk-sym', '종목', f.sym, { err:e.sym, ph:'예: 삼성전자, AAPL', max:30, set:function (v) { f.sym = v; } }), clsSel('stk-cls', f.cls, function (v) { f.cls = v; }),
      field('stk-qty', '수량', f.qty, { err:e.qty, ph:'10', mode:'decimal', set:function (v) { f.qty = v; } }), field('stk-px', '체결 가격(원)', f.px, { err:e.px, ph:'72000', mode:'decimal', help:'해외 종목은 원화로 바꿔 적어 주세요.', set:function (v) { f.px = v; } }), field('stk-fee', '수수료·세금(원, 선택)', f.fee, { err:e.fee, ph:'0', mode:'decimal', set:function (v) { f.fee = v; } })]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('기록하기', 'fill', addTrade), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null]),
    h('div', { class:'sub', text:'현금·예금은 종목 이름을 “예금”으로, 수량을 금액(원), 가격을 1로 적으면 자산 배분에 넣을 수 있어요. 실제 매매는 증권사 앱에서 하세요.' })]);
  kids.push(card);
  if (!S.trades.length) { kids.push(empty('아직 기록이 없어요.')); return kids; }
  var P = positions(S.trades), list = S.trades.slice().sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; });
  kids.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['날짜', '구분', '종목', '수량', '가격', '수수료', ''].map(function (t, i) { return h('th', { class:i > 2 && i < 6 ? 'r' : '', text:t }); }))]),
    h('tbody', {}, list.map(function (t) { return h('tr', {}, [h('td', { class:'num', text:t.d }), h('td', {}, [pill(t.side === 'B' ? '매수' : '매도', t.side === 'B' ? '' : 'm')]), h('td', { text:t.sym }), h('td', { class:'r num', text:+t.qty.toFixed(6) + '' }), h('td', { class:'r num', text:won(t.px) }), h('td', { class:'r num', text:won(t.fee) }),
      h('td', { class:'r' }, [btn('삭제', 'sm quiet', function () { S.trades = S.trades.filter(function (x) { return x.id !== t.id; }); S.msg = '삭제했어요.'; save(); render(); })])]); }))])])]));
  var rb = Object.keys(P.realizedBy);
  kids.push(h('div', { class:'g2', style:'margin-top:16px' }, [h('div', { class:'card col' }, [h('b', { text:'실현손익(평균단가법)' }), h('div', { class:'num ' + cls(P.realized), style:'font-size:24px;font-weight:700', id:'stk-real', text:sgn(P.realized) + '원' }), h('div', { class:'sub', text:'판 종목의 확정 손익입니다. 수수료는 이미 뺐고, 세금은 반영하지 않았어요.' }),
      rb.length ? h('div', {}, rb.map(function (k) { return h('div', { class:'kv' }, [h('span', { text:k }), h('b', { class:'num ' + cls(P.realizedBy[k]), text:sgn(P.realizedBy[k]) + '원' })]); })) : h('div', { class:'sub', text:'아직 판 기록이 없어요.' })]),
    h('div', { class:'card col' }, [h('b', { text:'기록 요약' }), h('div', {}, [['전체 기록', S.trades.length + '건'], ['보유 종목', P.pos.length + '개'], ['낸 수수료·세금', won(P.fees) + '원']].map(function (x) { return h('div', { class:'kv' }, [h('span', { text:x[0] }), h('b', { class:'num', text:x[1] })]); })), P.bad.length ? h('div', { class:'note', role:'alert', text:'보유보다 많이 판 기록 ' + P.bad.length + '건은 계산에서 뺐어요.' }) : null])]));
  return kids;
}

// ── 관심 종목 ──
function addWatch() {
  var f = S.wform, t = f.target === '' ? null : numOf(f.target), e = {};
  if (!clean(f.sym, 30)) e.sym = '종목 이름을 적어 주세요.'; else if (S.watch.some(function (w) { return w.sym === clean(f.sym, 30); })) e.sym = '이미 관심 종목에 있어요.';
  if (t !== null && (!isFinite(t) || t <= 0 || t > 1e12)) e.target = '목표가를 0보다 큰 숫자로 적어 주세요.';
  if (!e.sym && S.watch.length >= MAXW) e.sym = '관심 종목은 최대 ' + MAXW + '개까지예요.';
  S.err = e; if (Object.keys(e).length) return render();
  S.watch.push({ id:uid(), sym:clean(f.sym, 30), cls:f.cls, target:t, memo:clean(f.memo, 60) }); S.wform = { sym:'', cls:f.cls, target:'', memo:'' }; S.msg = '추가했어요.'; save(); render();
}
function viewWatch() {
  var kids = head('관심 종목', '눈여겨보는 종목과 목표가를 적어 두고, 직접 적은 현재가와 얼마나 떨어져 있는지 봅니다.'); kids.push(notice());
  var f = S.wform, e = S.err;
  kids.push(h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'종목 추가' }), h('div', { class:'frm' }, [field('stk-wsym', '종목', f.sym, { err:e.sym, ph:'예: 현대차', max:30, set:function (v) { f.sym = v; } }), clsSel('stk-wcls', f.cls, function (v) { f.cls = v; }), field('stk-wtg', '목표가(원, 선택)', f.target, { err:e.target, ph:'250000', mode:'decimal', help:'관심 가격입니다. 매수 권유가 아니에요.', set:function (v) { f.target = v; } }), field('stk-wmemo', '메모(선택)', f.memo, { ph:'왜 관심 있는지', max:60, set:function (v) { f.memo = v; } })]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('추가하기', 'fill', addWatch), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  if (!S.watch.length) { kids.push(empty('아직 관심 종목이 없어요.')); return kids; }
  var tb = h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['종목', '자산군', '현재가(직접 입력)', '목표가', '목표까지', '메모', ''].map(function (t, i) { return h('th', { class:i > 1 && i < 5 ? 'r' : '', text:t }); }))]),
    h('tbody', {}, S.watch.map(function (w, i) {
      var q = S.px[w.sym], has = isFinite(q) && q > 0, d = has && w.target ? (w.target - q) / q : null;
      var inp = h('input', { id:'stk-wpx-' + i, type:'text', inputmode:'decimal', value:has ? String(q) : '', placeholder:'현재가', 'aria-label':w.sym + ' 현재가' });
      inp.onchange = function () { var n = numOf(inp.value); if (inp.value.trim() === '') delete S.px[w.sym]; else if (isFinite(n) && n >= 0 && n <= 1e12) S.px[w.sym] = n; save(); render(); };
      return h('tr', {}, [h('td', {}, [h('b', { text:w.sym })]), h('td', { text:w.cls }), h('td', { class:'r' }, [inp]), h('td', { class:'r num', text:w.target ? won(w.target) : '—' }), h('td', { class:'r num ' + (d == null ? '' : d <= 0 ? 'dn' : 'up'), text:d == null ? '—' : d <= 0 ? '목표가 이하 (' + pct(d) + ')' : pct(d) + ' 더 올라야 도달' }), h('td', { text:w.memo }),
        h('td', { class:'r' }, [btn('삭제', 'sm quiet', function () { S.watch = S.watch.filter(function (x) { return x.id !== w.id; }); save(); render(); })])]);
    }))]);
  kids.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { class:'tbw' }, [tb])]));
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('증권 AI에게 종목 분석 묻기', 'quiet', function () { ask('관심 종목을 분석할 때 어떤 지표를 봐야 하나요?'); })]));
  return kids;
}

// ── 자산 배분 ──
function viewAlloc() {
  var kids = head('자산 배분', '목표 비중을 정해 두고 지금 비중과 비교합니다. 계산 결과이며 매매 권유가 아닙니다.'); kids.push(notice());
  var V = curPos().V, tot = V.val, tsum = CLS.reduce(function (a, c) { return a + (S.target[c] || 0); }, 0);
  if (!tot) kids.push(h('div', { class:'note', style:'margin-bottom:12px', text:'현재 비중은 현재가를 적은 보유 종목으로 계산합니다. “내 포트폴리오”에서 현재가를 적어 주세요. 목표 비중은 지금도 정해 둘 수 있어요.' }));
  var rows = CLS.map(function (c) {
    var cur = tot ? (V.byCls[c] || 0) / tot * 100 : null, tg = S.target[c] || 0;
    var inp = h('input', { id:'stk-tg-' + CLS.indexOf(c), type:'text', inputmode:'decimal', value:tg ? String(tg) : '', placeholder:'0', 'aria-label':c + ' 목표 비중(%)' });
    inp.onchange = function () { var n = inp.value.trim() === '' ? 0 : numOf(inp.value); if (isFinite(n) && n >= 0 && n <= 100) { if (n) S.target[c] = n; else delete S.target[c]; save(); } render(); };
    var diffAmt = tot && tsum === 100 ? tg / 100 * tot - (V.byCls[c] || 0) : null;
    return h('tr', {}, [h('td', {}, [h('b', { text:c })]), h('td', { class:'r num', text:cur == null ? '—' : Math.round(cur * 10) / 10 + '%' }), h('td', { class:'r' }, [h('span', { class:'tgt' }, [inp, '%'])]), h('td', { class:'r num', text:cur == null || !tsum ? '—' : (tg - cur > 0 ? '+' : tg - cur < 0 ? '−' : '') + Math.abs(Math.round((tg - cur) * 10) / 10) + '%p' }), h('td', { class:'r num ' + (diffAmt == null ? '' : cls(diffAmt)), text:diffAmt == null ? '—' : sgn(diffAmt) + '원' })]);
  });
  kids.push(h('div', { class:'card', style:'padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['자산군', '지금 비중', '목표 비중', '차이', '목표와의 금액 차이'].map(function (t, i) { return h('th', { class:i ? 'r' : '', text:t }); }))]), h('tbody', {}, rows)])])]));
  var ok = tsum === 100;
  kids.push(h('div', { class:ok ? 'note info' : 'note', id:'stk-tsum', style:'margin-top:12px', role:tsum && !ok ? 'alert' : null, text:!tsum ? '목표 비중을 적어 주세요. 합계가 100%가 되면 목표와의 금액 차이를 계산해 줍니다.' : '목표 비중 합계 ' + Math.round(tsum * 100) / 100 + '%' + (ok ? ' — 목표와의 금액 차이는 목표 비중에 맞추려면 늘리거나(+) 줄여야(−) 하는 금액입니다. 거래 비용과 세금은 반영하지 않았습니다.' : ' — 100%가 되도록 맞춰 주세요.') }));
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('목표 지우기', 'quiet', function () { S.target = {}; save(); render(); }), btn('증권 AI에게 묻기', 'quiet', function () { ask('자산 배분 비율은 어떤 기준으로 정하나요?'); })]));
  return kids;
}

// ── 목표 계산기 ──
function viewGoal() {
  var kids = head('목표 계산기', '매달 얼마씩 모으면 몇 년 뒤 얼마가 되는지, 목표 금액에 닿으려면 월 얼마가 필요한지 계산합니다. 수익률은 내가 가정한 값이며 예측이 아닙니다.'); kids.push(notice());
  var g = S.goal, set = function (k) { return function (v) { g[k] = v; save(); upd(); }; };
  var form = h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'가정 입력' }), h('div', { class:'frm' }, [field('stk-g-p0', '지금 가진 돈(원)', g.p0, { ph:'10000000', mode:'decimal', set:set('p0') }), field('stk-g-m', '월 적립액(원)', g.m, { ph:'500000', mode:'decimal', set:set('m') }), field('stk-g-r', '연 수익률 가정(%)', g.r, { ph:'5', mode:'decimal', max:6, help:'확정된 수익이 아니에요.', set:set('r') }), field('stk-g-y', '기간(년)', g.y, { ph:'10', mode:'decimal', max:4, set:set('y') }), field('stk-g-t', '목표 금액(원, 선택)', g.t, { ph:'300000000', mode:'decimal', set:set('t') }), field('stk-g-inf', '물가 상승률 가정(%)', g.inf, { ph:'2', mode:'decimal', max:6, set:set('inf') })]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('내 평가금액 불러오기', 'sm', function () { var v = curPos().V.val; if (v) { g.p0 = String(Math.round(v)); save(); render(); } else { S.msg = '현재가를 적은 보유 종목이 없어요.'; render(); } }), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]);
  kids.push(form, h('div', { id:'stk-g-out', style:'margin-top:16px' }));
  function upd() { var o = $('stk-g-out'); if (o) { o.textContent = ''; goalOut().forEach(function (x) { o.appendChild(x); }); } }
  M.__goalOut = upd; return kids;
}
function goalOut() {
  var R = goalCalc(S.goal);
  if (!R) return [h('div', { class:'note', text:'현재 값으로는 계산할 수 없어요. 연 수익률·기간(1~60년)은 꼭 필요하고, 모두 0 이상의 숫자여야 해요.' })];
  var k = [h('div', { class:'g4' }, [['예상 금액', won(R.fv) + '원', '명목'], ['물가 반영', won(R.real) + '원', '오늘 가치로 환산'], ['넣은 원금', won(R.principal) + '원', ''], ['불어난 금액', sgn(R.gain) + '원', '']].map(function (x, i) { return h('div', { class:'tile' }, [h('div', { class:'k', text:x[0] }), h('div', { class:'num', id:'stk-g-o' + i, style:'font-size:20px;font-weight:700', text:x[1] }), x[2] ? h('div', { class:'sub', text:x[2] }) : null]); }))];
  if (R.t != null) k.push(h('div', { class:'note ' + (R.hit ? 'info' : ''), id:'stk-g-need', style:'margin-top:12px', text:R.hit ? '지금 가정이면 목표 금액(' + won(R.t) + '원)을 넘어요.' : '목표 금액 ' + won(R.t) + '원에 닿으려면 이 수익률 가정에서 월 ' + won(R.need) + '원씩 적립해야 해요(지금 가진 돈 기준).' }));
  if (R.years.length) k.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { text:'연도별 예상 금액(원)' }), bars(R.years, R.years.map(function (_, i) { return (i + 1) + '년'; }), 'var(--pri)')]));
  k.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['수익률 가정', '예상 금액'].map(function (t, i) { return h('th', { class:i ? 'r' : '', text:t }); }))]), h('tbody', {}, R.sc.map(function (s, i) { return h('tr', {}, [h('td', { text:Math.round(s.r * 10) / 10 + '%' + (i === 1 ? ' (입력값)' : i === 0 ? ' (−2%p)' : ' (+2%p)') }), h('td', { class:'r num', text:won(s.fv) + '원' })]); }))])])]));
  k.push(h('div', { class:'foot', text:'월 복리로 계산했고 세금·수수료·물가 변화는 단순화했어요. 실제 수익률은 매년 다르며 손실이 날 수도 있습니다.' }));
  return k;
}

// ── 투자 점검·용어 ──
function viewLearn() {
  var kids = head('투자 점검·용어', '투자하기 전에 스스로 확인할 것과 자주 쓰는 용어입니다. 일반적인 투자자 교육 내용이며 특정 상품에 대한 의견이 아닙니다.');
  var n = Object.keys(S.checks).length;
  var list = h('div', { class:'card col' }, [h('div', { class:'rowf', style:'justify-content:space-between' }, [h('b', { style:'font-size:17px', text:'투자 전 점검표' }), h('span', { class:'sub', id:'stk-chk-n', text:n + ' / ' + CHECKS.length })]), h('div', { class:'meter8' }, [h('i', { id:'stk-chk-bar', style:'width:' + Math.round(n / CHECKS.length * 100) + '%' })]),
    h('div', {}, CHECKS.map(function (t, i) { var cb = h('input', { type:'checkbox', id:'stk-chk-' + i, checked:S.checks[i] ? true : false }); cb.onchange = function () { if (cb.checked) S.checks[i] = 1; else delete S.checks[i]; save(); var c = Object.keys(S.checks).length; $('stk-chk-n').textContent = c + ' / ' + CHECKS.length; $('stk-chk-bar').style.width = Math.round(c / CHECKS.length * 100) + '%'; }; return h('label', { class:'chk', for:'stk-chk-' + i }, [cb, h('span', { text:t })]); })),
    h('div', { class:'sub', text:'모두 “예”가 되기 전에는 급하게 투자하지 않아도 돼요. 체크 상태는 이 브라우저에만 저장됩니다.' })]);
  var q = h('input', { id:'stk-gq', type:'search', placeholder:'용어 검색 (예: 복리, ETF)', maxlength:'20', value:S.gq, 'aria-label':'용어 검색' });
  var gl = h('div', { id:'stk-gl' });
  function drawGl() { gl.textContent = ''; var s = S.gq.trim().toLowerCase(), r = GLOSS.filter(function (x) { return !s || x[0].toLowerCase().indexOf(s) >= 0 || x[1].toLowerCase().indexOf(s) >= 0; }); if (!r.length) gl.appendChild(h('div', { class:'empty', text:'찾는 용어가 없어요. 증권 AI에게 물어보세요.' })); r.forEach(function (x) { gl.appendChild(h('div', { class:'gl' }, [h('b', { text:x[0] }), h('span', { class:'sub', text:x[1] })])); }); }
  q.oninput = function () { S.gq = q.value; drawGl(); }; drawGl();
  kids.push(h('div', { class:'g2', style:'margin-top:16px' }, [list, h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'용어 사전' }), h('div', { class:'sh' }, [q]), gl])]));
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('증권 AI에게 묻기', 'fill', function () { ask('투자 용어를 쉽게 설명해 주세요'); })]));
  return kids;
}

function render() {
  var root = $('stk-root'), tp = $('stk-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = S.view === 'explore' ? viewExplore() : S.view === 'wage' ? viewWage() : S.view === 'order' ? viewOrder() : S.view === 'value' ? viewValue() : S.view === 'company' ? viewCompany() : S.view === 'trades' ? viewTrades() : S.view === 'watch' ? viewWatch() : S.view === 'alloc' ? viewAlloc() : S.view === 'goal' ? viewGoal() : S.view === 'learn' ? viewLearn() : viewPortfolio();
  kids.forEach(function (k) { if (k) root.appendChild(k); });
  if (S.view === 'goal' && M.__goalOut) M.__goalOut();
}

// ── 화면 조작(말로 이동) ──
function reply(ok, msg) { emit('result', { ok:ok, msg:msg, view:S.view }); }
function nav(a) {
  var d = a && typeof a['do'] === 'string' ? a['do'] : '';
  if (VIEWS.indexOf(d) >= 0) { go(d); return reply(true, TABS[VIEWS.indexOf(d)][1] + ' 화면으로 이동했습니다.'); }
  if (d === 'add') {   // 거래 입력칸만 채워 둔다. 기록은 사용자가 '기록하기'를 눌러야 저장된다.
    var f = S.form; f.side = a.side === 'S' ? 'S' : 'B'; if (a.symbol) f.sym = clean(a.symbol, 30); if (isFinite(numOf(a.qty))) f.qty = String(numOf(a.qty)); if (isFinite(numOf(a.price))) f.px = String(numOf(a.price)); f.d = kst();
    go('trades'); return reply(true, '거래 입력칸을 채워 두었습니다. 내용을 확인하고 기록하기를 눌러 주세요.');
  }
  if (d === 'price') {
    var sym = clean(a.symbol, 30), p = numOf(a.price); if (!sym || !isFinite(p) || p < 0 || p > 1e12) return reply(false, '종목과 현재가(원)를 알려 주세요.');
    S.px[sym] = p; save(); go('portfolio'); return reply(true, sym + ' 현재가를 ' + won(p) + '원으로 적었습니다.');
  }
  if (d === 'goal') { var g = S.goal; ['p0', 'm', 'r', 'y', 't', 'inf'].forEach(function (k) { if (a[k] != null && isFinite(numOf(a[k]))) g[k] = String(numOf(a[k])); }); save(); go('goal'); return reply(true, '목표 계산기로 이동해 값을 채웠습니다.'); }
  return reply(false, '지원하지 않는 요청입니다.');
}

function mount(el, o) {
  if (!el) return; o = o || {};
  M = el; el.textContent = ''; el.classList.add('stk'); S.trades = []; S.cos = []; S.px = {}; S.watch = []; S.target = {}; S.checks = {}; S.val = { g:'3', r:'10' }; S.err = {}; S.msg = ''; load();
S.wage = { m:'', amt:'', memo:'' }; S.wageMsg = null; S.xq = { text:'', sector:'', size:'', region:'' }; S.pub = pubLoad();
S.sec = NL() ? NL().secLoad() : { recs:[], alerts:[] }; S.secMsg = null; S.secVer = null; S.secBusy = false; S.order = { side:'B', sym:'', cls:'국내주식', qty:'', px:'' };
  [h('div', { id:'stk-top' }), h('div', { class:'wrap', id:'stk-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'portfolio'; render();
}
window.NaviStock = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  positions:positions, valued:valued, evalCo:evalCo, valueOf:valueOf, wageStats:wageStats, searchListings:searchListings, sizeOf:sizeOf, hashOf:hashOf, crossCheck:crossCheck, fv:fv, needMonthly:needMonthly, goalCalc:goalCalc,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
