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
 *  - 자산 배분·목표 계산기는 사용자가 넣은 값으로 계산만 한다. 예측이나 추천이 아니다. 특정 상품을 사라고 권하지 않는다.
 */
(function () {
'use strict';
var KEY = 'navi-stock-v1', MAXT = 500, MAXW = 100;
var CLS = ['국내주식', '해외주식', 'ETF·펀드', '채권', '부동산·리츠', '암호화폐', '원자재', '현금·예금', '기타'];
var TABS = [['portfolio', '내 포트폴리오'], ['company', '기업 평가'], ['trades', '거래 기록'], ['watch', '관심 종목'], ['alloc', '자산 배분'], ['goal', '목표 계산기'], ['learn', '투자 점검·용어']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var CONC = 30;   // 한 종목이 평가금액의 이 비율(%)을 넘으면 알려 준다(참고)
var CHECKS = ['비상 자금(생활비 3~6개월분)은 따로 두었나요?', '투자 목적과 기간(언제 쓸 돈인지)을 적어 두었나요?', '한 종목에 넣을 최대 비중을 정해 두었나요?', '손실이 얼마까지 나면 어떻게 할지 미리 정해 두었나요?', '내가 이해하지 못하는 상품에는 투자하지 않기로 했나요?', '수수료·세금(양도세·배당세 등)을 확인했나요?', '빚을 내서 투자하지 않나요?'];
var GLOSS = [['분산투자', '여러 종목·자산군·지역에 나누어 투자해 한 곳의 손실이 전체에 미치는 영향을 줄이는 방법입니다.'], ['리밸런싱', '시간이 지나 달라진 자산 비중을 처음 정한 목표 비중으로 되돌리는 조정입니다.'], ['평균단가법', '여러 번 나눠 산 종목의 평균 매수 가격을 구해 매도 때 손익을 계산하는 방법입니다. 이 화면도 이 방법을 씁니다.'], ['평가손익 · 실현손익', '평가손익은 아직 팔지 않은 종목의 현재가 기준 손익이고, 실현손익은 실제로 판 뒤 확정된 손익입니다.'], ['ETF', '여러 종목을 묶어 지수 등을 따라가도록 만든 펀드로, 주식처럼 거래소에서 사고팝니다.'], ['PER · PBR', 'PER은 주가를 주당순이익으로, PBR은 주가를 주당순자산으로 나눈 값으로 주가가 이익·자산에 비해 어느 수준인지 가늠하는 지표입니다.'], ['배당수익률', '1주당 배당금을 주가로 나눈 비율입니다. 배당은 회사 사정에 따라 줄거나 없어질 수 있습니다.'], ['채권', '정부나 기업이 돈을 빌리며 발행하는 증서로, 정해진 이자를 주고 만기에 원금을 갚기로 한 약속입니다. 발행자의 신용에 따라 위험이 다릅니다.'], ['신용등급', '채권 발행자가 이자와 원금을 갚을 능력을 등급으로 나타낸 것입니다. 등급이 낮을수록 보통 이자가 높고 위험도 큽니다.'], ['변동성', '가격이 오르내리는 폭입니다. 변동성이 크면 수익도 손실도 크게 날 수 있습니다.'], ['환율 위험', '해외 자산은 가격이 그대로여도 환율이 변하면 원화 가치가 달라집니다.'], ['복리', '이자에 다시 이자가 붙는 방식으로, 기간이 길수록 차이가 커집니다. 목표 계산기는 월 복리로 계산합니다.'], ['인플레이션(물가 상승)', '물가가 올라 같은 돈으로 살 수 있는 것이 줄어드는 현상입니다. 실질 가치는 물가 상승을 뺀 값입니다.'], ['유동성', '필요할 때 손해 없이 현금으로 바꿀 수 있는 정도입니다. 거래가 적은 자산은 팔고 싶을 때 못 팔 수 있습니다.'], ['레버리지', '빌린 돈으로 투자 규모를 키우는 것입니다. 이익도 손실도 커지며 손실이 원금보다 클 수 있습니다.'], ['시가총액', '주가에 발행 주식 수를 곱한 회사의 시장 가치입니다.'], ['호가', '사려는 가격(매수 호가)과 팔려는 가격(매도 호가)입니다.'], ['공매도', '주식을 빌려 먼저 팔고 나중에 사서 갚는 거래로, 가격이 내릴 때 이익이 나지만 오를 때 손실에는 한도가 없습니다.'], ['GDC 채권(설계 중)', '나비웹이 구상하는 GDC 기반 채권입니다. 아직 실제로 발행·거래되지 않는 개념 단계이며 이 화면에서는 거래할 수 없습니다.']];
var M = null, LS = {};
var S = { view:'portfolio', co:{ name:'', rev:'', op:'', ni:'', assets:'', debt:'', equity:'', shares:'', price:'', g:'3', r:'10' }, cos:[], cc:{ a:'', b:'', tol:'1' }, trades:[], px:{}, watch:[], target:{}, checks:{}, goal:{ p0:'', m:'', r:'5', y:'10', t:'', inf:'2' }, form:{ side:'B', d:'', sym:'', cls:'국내주식', qty:'', px:'', fee:'' }, wform:{ sym:'', cls:'국내주식', target:'', memo:'' }, err:{}, gq:'', msg:'' };

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
    if (v.goal && typeof v.goal === 'object') Object.keys(S.goal).forEach(function (k) { if (typeof v.goal[k] === 'string') S.goal[k] = v.goal[k].slice(0, 14); });
  } catch (e) {}
}
function fixTrade(t) {
  if (!t || typeof t !== 'object') return null;
  var q = Number(t.qty), p = Number(t.px), f = Number(t.fee || 0), sym = clean(t.sym, 30);
  if (!sym || !(q > 0) || q > 1e12 || !(p >= 0) || p > 1e12 || !(f >= 0) || f > 1e12 || !/^\d{4}-\d{2}-\d{2}$/.test(t.d) || (t.side !== 'B' && t.side !== 'S')) return null;
  return { id:clean(t.id, 20) || uid(), d:t.d, side:t.side, sym:sym, cls:CLS.indexOf(t.cls) >= 0 ? t.cls : '기타', qty:q, px:p, fee:f };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ co:S.co, cos:S.cos, trades:S.trades, px:S.px, watch:S.watch, target:S.target, checks:S.checks, goal:S.goal })); } catch (e) {} }

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
  if (!S.trades.length) { kids.push(empty('아직 거래 기록이 없어요. 증권사에서 산 종목을 “거래 기록”에 적으면 여기에 모입니다.', btn('거래 기록하기', 'fill', function () { go('trades'); }))); kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('증권 AI에게 묻기', 'quiet', function () { ask('투자를 처음 시작하려면 무엇부터 알아야 하나요?'); })])); return kids; }
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
  kids.push(h('div', { class:'card rowf', style:'margin-top:16px;justify-content:space-between' }, [h('div', { class:'col', style:'gap:2px;flex:1;min-width:220px' }, [h('b', { text:'재무제표로 기업을 평가해 보세요' }), h('span', { class:'sub', text:'나비웹에서는 모든 거래가 재무제표로 자동 기록되고, 상호 대조와 이상 탐지로 분식을 막는다는 원칙입니다.' })]), btn('기업 평가 열기', 'sm', function () { go('company'); })]));
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
  var kids = S.view === 'company' ? viewCompany() : S.view === 'trades' ? viewTrades() : S.view === 'watch' ? viewWatch() : S.view === 'alloc' ? viewAlloc() : S.view === 'goal' ? viewGoal() : S.view === 'learn' ? viewLearn() : viewPortfolio();
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
  M = el; el.textContent = ''; el.classList.add('stk'); S.trades = []; S.cos = []; S.px = {}; S.watch = []; S.target = {}; S.checks = {}; S.err = {}; S.msg = ''; load();
  [h('div', { id:'stk-top' }), h('div', { class:'wrap', id:'stk-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'portfolio'; render();
}
window.NaviStock = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  positions:positions, valued:valued, evalCo:evalCo, crossCheck:crossCheck, fv:fv, needMonthly:needMonthly, goalCalc:goalCalc,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
