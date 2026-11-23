/* tax-app.js — 나비웹 세무·회계(인프라 AI · 세무). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviTax.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 tax.css(.tx 범위). 전역은 NaviTax 하나만 쓴다.
 *
 * 세무·회계 화면의 특징(주피터 지시, 설계 원칙):
 *  - 회계 인프라: 모든 나비웹 사용자(개인·기관·기업·부서)의 재무제표를 자동으로 생성·갱신한다. 모든 거래는 거래 당사자가 내는 거래 전표를 서로 검증하므로 분식 회계와 거짓 거래가 불가능하고, 이상 거래는 즉시 탐지된다.
 *    5천만 한국인과 수백만 기업·기관·부서의 재무제표가 하나의 결합 재무제표를 이루며, 공급망(고무 수입업체 → 타이어 → 자동차 → 소비자·정비업체)이 수직·수평으로 맞물려 1원의 거짓 수치도 끼어들 수 없다.
 *  - 세무 인프라: 항상 최신 세법을 적용해 과세하고, 사용자의 나비와 소통해 세금을 직접 징수하므로 개인과 기관 누구도 1원도 더 내거나 덜 낼 수 없다.
 * 이 화면은 설계 원칙 가운데 코드로 구현할 수 있는 부분을 사용자가 넣은 값으로 실제로 계산해 보여 준다:
 *  - 거래 전표 상호 검증(matchSlips), 공급망 연쇄 검증(chainCheck), 평소 거래 대비 이상 탐지(anomaly), 분개 → 재무제표 자동 생성(statements), 세법 버전표에 따른 세액 계산(taxCalc·vat).
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 설계 원칙은 아직 설계 단계다. 나비웹 사용자 전체의 거래·재무제표 연결, 국세청 신고·납부, 세금 직접 징수는 연결되어 있지 않고, 이 화면은 어떤 정보도 밖으로 보내지 않으며 세금을 징수·납부하지 않는다.
 *  - 세액 계산은 세율표(LAW)의 기본 산식만 쓴다. 공제·감면·세액공제·가산세 등은 반영하지 않는다. 세율표는 만든 시점에 확인한 값이므로 신고 전에 국세청 최신 기준을 확인해야 한다. 세법이 바뀌면 LAW 표만 고치면 된다.
 *  - 입력값은 이 브라우저(localStorage)에만 저장된다. 세무 상담이나 신고 대리가 아니다.
 */
(function () {
'use strict';
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
var KEY = 'navi-tax-v1', MAXE = 500, MAXP = 200;
var TABS = [['acct', '회계 원리'], ['verify', '거래 상호 검증'], ['fs', '내 재무제표'], ['tax', '세금 계산'], ['collect', '징수 원리']];
var VIEWS = TABS.map(function (t) { return t[0]; });
/** 세법 버전표: from(시행 기준 연도) 이후 사업연도·귀속연도에 적용. 구간은 [과세표준 상한(원), 세율]. 세법이 바뀌면 이 표에 버전을 추가한다. 확인일 2026-11-23, 신고 전 국세청 최신 기준 확인 필요. */
var INF = Infinity;
var LAW = {
  income:{ name:'종합소득세(거주자)', base:'소득세법 제55조', ver:[{ from:2023, br:[[14e6, .06], [50e6, .15], [88e6, .24], [150e6, .35], [300e6, .38], [500e6, .40], [1000e6, .42], [INF, .45]] }] },
  corp:{ name:'법인세(일반 내국법인)', base:'법인세법 제55조', ver:[{ from:2023, br:[[2e8, .09], [200e8, .19], [3000e8, .21], [INF, .24]] }, { from:2026, br:[[2e8, .10], [200e8, .20], [3000e8, .22], [INF, .25]] }] }
};
var LOCAL = 0.10, VAT = 0.10;   // 지방소득세 = 산출세액의 10%, 부가가치세 일반 세율 10%
/** 분개에 쓰는 계정과목. 유형: A 자산, L 부채, E 자본, R 수익, X 비용. */
var ACCTS = [['현금', 'A'], ['예금', 'A'], ['매출채권', 'A'], ['재고자산', 'A'], ['비품', 'A'], ['미지급금', 'L'], ['차입금', 'L'], ['자본금', 'E'], ['매출', 'R'], ['기타수익', 'R'], ['매입원가', 'X'], ['급여', 'X'], ['임차료', 'X'], ['기타비용', 'X']];
var TYPE = {}; ACCTS.forEach(function (a) { TYPE[a[0]] = a[1]; });
var TYPE_NAME = { A:'자산', L:'부채', E:'자본', R:'수익', X:'비용' };
var PAYKINDS = ['소득세', '법인세', '부가가치세', '지방소득세', '기타'];
var PAYSTATES = ['납부 전', '납부함'];
var CHAIN = ['고무 수입업체', '타이어 생산업체', '자동차 생산업체', '소비자'];
var M = null, LS = {};
var S = { view:'acct', je:[], pay:[], jf:{ dr:'현금', cr:'자본금' }, pf:{ kind:'소득세', st:'납부 전' }, slip:{ a:{ me:'A상사', other:'B전자', item:'고무', amt:'1000000', d:'' }, b:{ me:'B전자', other:'A상사', item:'고무', amt:'1000000', d:'' } }, chain:[['1000000', '1000000'], ['3000000', '3000000'], ['10000000', '10000000']], an:{ base:'', val:'', k:'3' }, tx:{ kind:'income', year:'2026', base:'' }, vt:{ sales:'', purch:'' }, err:{}, msg:'' };

function field(id, label, val, o) {
  o = o || {}; var e = o.err, inp = h('input', { id:id, type:'text', value:val == null ? '' : val, placeholder:o.ph || '', maxlength:o.max || '60', inputmode:o.mode || '', autocomplete:'off', 'aria-invalid':e ? 'true' : 'false' });
  inp.oninput = function () { if (o.set) o.set(inp.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), inp, h('div', { id:id + '-h', class:e ? 'err' : 'help', text:e || o.help || '' })]);
}

function empty(t, b) { return h('div', { class:'card', style:'margin-top:16px' }, [h('div', { class:'empty', text:t }), b ? h('div', { class:'rowf', style:'justify-content:center' }, [b]) : null]); }

function head(title, lead) { return [h('h1', { text:title }), lead ? h('p', { class:'lead', text:lead }) : null]; }
function go(v) { S.view = v; S.err = {}; S.msg = ''; render(); try { M.scrollIntoView({ block:'start' }); } catch (e) {} }
function load() {
  try {
    var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v || typeof v !== 'object') return;
    S.je = (Array.isArray(v.je) ? v.je : []).map(fixJe).filter(Boolean).slice(0, MAXE);
    S.pay = (Array.isArray(v.pay) ? v.pay : []).map(fixPay).filter(Boolean).slice(0, MAXP);
  } catch (e) {}
}
function fixJe(x) {
  if (!x || typeof x !== 'object' || !TYPE[x.dr] || !TYPE[x.cr] || x.dr === x.cr || !/^\d{4}-\d{2}-\d{2}$/.test(x.d)) return null;
  var a = Number(x.amt); if (!(a > 0) || a > 1e15 || Math.floor(a) !== a) return null;
  return { id:clean(x.id, 20) || uid(), d:x.d, dr:x.dr, cr:x.cr, amt:a, memo:clean(x.memo, 40) };
}
function fixPay(x) {
  if (!x || typeof x !== 'object' || PAYKINDS.indexOf(x.kind) < 0 || PAYSTATES.indexOf(x.st) < 0) return null;
  var a = Number(x.amt); if (!(a >= 0) || a > 1e15 || Math.floor(a) !== a) return null;
  return { id:clean(x.id, 20) || uid(), kind:x.kind, year:clean(x.year, 6), amt:a, st:x.st, d:/^\d{4}-\d{2}-\d{2}$/.test(x.d) ? x.d : '' };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ je:S.je, pay:S.pay })); } catch (e) {} }

/** 거래 전표 상호 검증: 판매자 전표(a)와 구매자 전표(b)가 서로 맞는지. 상대방·품목·금액(1원 단위)·날짜가 모두 같아야 한다. */
function matchSlips(a, b) {
  var n = function (s) { return clean(s, 40).replace(/\s+/g, ''); }, amtA = snum(a.amt), amtB = snum(b.amt), issues = [];
  if (!n(a.me) || !n(a.other) || !n(b.me) || !n(b.other) || !n(a.item) || !n(b.item) || !isFinite(amtA) || !isFinite(amtB) || amtA < 0 || amtB < 0 || !a.d || !b.d) return null;
  if (n(a.me) !== n(b.other)) issues.push('판매자 전표의 거래 주체와 구매자 전표의 거래 상대가 달라요');
  if (n(a.other) !== n(b.me)) issues.push('판매자 전표의 거래 상대와 구매자 전표의 거래 주체가 달라요');
  if (n(a.item) !== n(b.item)) issues.push('품목이 달라요');
  if (amtA !== amtB) issues.push('금액이 ' + won(Math.abs(amtA - amtB)) + '원 달라요');
  if (a.d !== b.d) issues.push('거래 날짜가 달라요');
  return { ok:!issues.length, issues:issues };
}
function snum(v) { var s = String(v == null ? '' : v).replace(/[,\s원]/g, ''); return /^\d+$/.test(s) ? Number(s) : NaN; }
/** 공급망 연쇄 검증: links[i] = [i번째 단계가 적은 매출, i+1번째 단계가 적은 매입]. 두 금액이 1원이라도 다르면 그 연결을 불일치로 돌려준다. */
function chainCheck(links) {
  var out = []; for (var i = 0; i < links.length; i++) { var s = snum(links[i][0]), b = snum(links[i][1]); if (!isFinite(s) || !isFinite(b)) return null; out.push({ i:i, sell:s, buy:b, diff:Math.abs(s - b), ok:s === b }); }
  return { links:out, ok:out.every(function (x) { return x.ok; }) };
}
/** 평소 거래 금액 대비 이상 탐지: 평소 값 5개 이상의 평균·표준편차에서 k 표준편차 이상 벗어나면 이상. */
function anomaly(readings, latest, k) {
  var xs = (readings || []).map(numOf), v = numOf(latest), kk = numOf(k);
  if (xs.length < 5 || xs.some(function (x) { return !isFinite(x); }) || !isFinite(v) || !(kk > 0) || kk > 20) return null;
  var mean = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length, sd = Math.sqrt(xs.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / xs.length);
  if (sd === 0) return { mean:mean, sd:0, z:null, abnormal:v !== mean };
  var z = (v - mean) / sd; return { mean:mean, sd:sd, z:z, abnormal:Math.abs(z) >= kk };
}
/** 분개 → 재무제표. 모든 분개는 차변과 대변이 같은 금액이므로 자산 = 부채 + 자본 + 당기순이익이 항상 성립한다. */
function statements(entries) {
  var bal = {}; ACCTS.forEach(function (a) { bal[a[0]] = 0; });
  entries.forEach(function (e) { bal[e.dr] += (TYPE[e.dr] === 'A' || TYPE[e.dr] === 'X' ? 1 : -1) * e.amt; bal[e.cr] += (TYPE[e.cr] === 'A' || TYPE[e.cr] === 'X' ? -1 : 1) * e.amt; });
  var sum = function (t) { return ACCTS.filter(function (a) { return a[1] === t; }).reduce(function (s, a) { return s + bal[a[0]]; }, 0); };
  var A = sum('A'), L = sum('L'), E = sum('E'), R = sum('R'), X = sum('X'), net = R - X;
  return { bal:bal, assets:A, liab:L, equity:E, revenue:R, expense:X, net:net, balanced:A === L + E + net };
}
function lawVersion(kind, year) {
  var law = LAW[kind]; if (!law) return null; var y = Number(year), v = null;
  law.ver.forEach(function (x) { if (y >= x.from) v = x; }); return v;
}
/** 세액 계산: 과세표준을 구간별로 나눠 누진 세율을 적용한다(초과누진). 귀속(사업)연도에 맞는 세법 버전을 고른다. 공제·감면은 반영하지 않는다. */
function taxCalc(kind, year, base) {
  var v = lawVersion(kind, year), b = snum(base); if (!v || !isFinite(b) || b > 1e15) return null;
  var rows = [], low = 0, tax = 0;
  for (var i = 0; i < v.br.length; i++) { var hi = v.br[i][0], r = v.br[i][1]; if (b > low) { var part = Math.min(b, hi) - low, t = Math.round(part * r); rows.push({ from:low, to:hi, rate:r, part:part, tax:t }); tax += t; } low = hi; if (b <= hi) break; }
  var local = Math.round(tax * LOCAL), marg = rows.length ? rows[rows.length - 1].rate : v.br[0][1];
  return { from:v.from, rows:rows, tax:tax, local:local, total:tax + local, eff:b > 0 ? tax / b : 0, marginal:marg };
}
/** 부가가치세: 매출세액 − 매입세액(음수면 환급). 공급가액 기준, 일반 세율 10%. */
function vat(sales, purch) {
  var s = snum(sales), p = snum(purch); if (!isFinite(s) || !isFinite(p) || s > 1e15 || p > 1e15) return null;
  var o = Math.round(s * VAT), i2 = Math.round(p * VAT); return { out:o, inn:i2, pay:o - i2 };
}

function topbar() {
  return h('div', { class:'topin' }, [
    h('div', { class:'brand' }, [h('div', {}, [h('b', { text:'나비웹 세무·회계' }), h('span', { text:'인프라 AI · 세무' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function notice() {
  return h('div', { class:'note info', style:'margin:16px 0', id:'tx-note', text:'이 화면은 신고·납부·징수를 하지 않고 어떤 정보도 밖으로 보내지 않습니다. 입력한 값으로 계산해 보는 것이고 이 브라우저에만 저장돼요. 세무 상담이나 신고 대리가 아니며, 신고 전에 국세청 기준을 확인하세요.' });
}
function tile(k, v, s, id) { return h('div', { class:'tile' }, [h('div', { class:'k', text:k }), h('div', { class:'num', id:id, style:'font-size:20px;font-weight:700', text:v }), s ? h('div', { class:'sub', text:s }) : null]); }
function sel(id, label, val, opts, set) {
  var s = h('select', { id:id, 'aria-label':label }, opts.map(function (c) { return h('option', { value:c[0], text:c[1] }); })); s.value = val; s.onchange = function () { set(s.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), s, h('div', { class:'help', text:'' })]);
}
function stepsCard(title, st, foot) {
  return h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:title }), h('div', {}, st.map(function (x, i) { return h('div', { class:'stp' }, [h('i', { text:String(i + 1) }), h('div', {}, [h('b', { text:x[0] }), h('span', { text:x[1] })])]); })), foot ? h('div', { class:'note info', text:foot }) : null]);
}

// ── 회계 원리 ──
function viewAcct() {
  var kids = head('회계 원리', '나비웹 회계 인프라가 모든 사용자의 재무제표를 만들고 거짓을 막는 방식입니다.');
  kids.push(stepsCard('재무제표가 만들어지는 과정', [['모든 사용자의 재무제표를 자동으로 생성·갱신', '개인, 기관, 기업, 부서 모두 거래가 생길 때마다 재무제표가 자동으로 만들어지고 갱신됩니다.'], ['거래 당사자가 전표를 내고 서로 검증', '거래할 때 양쪽이 각자 거래 전표를 냅니다. 상대방·품목·금액·날짜가 서로 맞아야 거래가 확정돼요.'], ['분식과 거짓 거래는 차단, 이상 거래는 즉시 탐지', '상대 전표와 맞지 않는 수치는 기록되지 않고, 평소와 다른 거래는 이상 탐지로 즉시 잡힙니다.'], ['하나의 결합 재무제표', '5천만 한국인과 수백만 기업·기관·부서의 재무제표가 하나로 맞물립니다. 예) 고무 수입업체 → 타이어 생산업체 → 자동차 생산업체 → 소비자·정비업체가 수직·수평으로 연동되어, 한 곳이 1원이라도 거짓을 적으면 맞물린 상대 기록과 어긋나요.']],
    '설계 원칙입니다. 지금은 나비웹 전체 거래와 연결되어 있지 않아요. 이 화면에서는 같은 원리를 입력한 값으로 직접 계산해 볼 수 있습니다.'));
  kids.push(h('div', { class:'g2', style:'margin-top:16px' }, [['거래 상호 검증', '판매자·구매자 전표 대조, 공급망 연쇄 검증, 이상 거래 탐지', 'verify'], ['내 재무제표', '분개를 적으면 재무상태표·손익계산서가 자동으로 만들어져요', 'fs']].map(function (x) { return h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:x[0] }), h('span', { class:'sub', text:x[1] }), h('div', { class:'rowf' }, [btn('열기', 'fill', function () { go(x[2]); })])]); })));
  return kids;
}

// ── 거래 상호 검증 ──
function viewVerify() {
  var kids = head('거래 상호 검증', '판매자와 구매자의 전표를 맞춰 보고, 공급망 전체가 맞물리는지, 평소와 다른 거래인지 확인합니다.'); kids.push(notice());
  // 1) 전표 대조
  var sl = S.slip, mk = function (key, title) { var o = sl[key]; return h('div', { class:'card col' }, [h('b', { text:title }), h('div', { class:'frm' }, [field('tx-' + key + '-me', '거래 주체', o.me, { max:20, set:function (v) { o.me = v; upd(); } }), field('tx-' + key + '-other', '거래 상대', o.other, { max:20, set:function (v) { o.other = v; upd(); } }), field('tx-' + key + '-item', '품목', o.item, { max:20, set:function (v) { o.item = v; upd(); } }), field('tx-' + key + '-amt', '금액(원)', o.amt, { mode:'numeric', max:15, set:function (v) { o.amt = v; upd(); } }), field('tx-' + key + '-d', '거래일', o.d, { ph:kst(), mode:'numeric', max:10, set:function (v) { o.d = v.trim(); upd(); } })])]); };
  if (!sl.a.d) { sl.a.d = kst(); sl.b.d = kst(); }
  var res = h('div', { id:'tx-m-res', style:'margin-top:12px' });
  function upd() { res.textContent = ''; var r = matchSlips(sl.a, sl.b); res.appendChild(!r ? h('div', { class:'sub', text:'모든 칸을 채우면(금액은 숫자) 서로 맞는지 알려 줘요.' }) : r.ok ? h('div', { class:'note info', id:'tx-m-ok', text:'두 전표가 일치합니다. 거래가 확정됩니다.' }) : h('div', { class:'note', role:'alert', id:'tx-m-bad', text:'전표가 일치하지 않아요: ' + r.issues.join(' · ') + '. 나비웹에서는 이런 거래가 확정되지 않고 탐지됩니다.' })); }
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'거래 전표 대조' }), h('div', { class:'sub', text:'거래 당사자가 각자 낸 전표라고 가정합니다. 금액은 1원 단위까지 같아야 해요.' }), h('div', { class:'g2' }, [mk('a', '판매자 전표'), mk('b', '구매자 전표')]), res])); upd();
  // 2) 공급망 연쇄
  var ch = S.chain, cres = h('div', { id:'tx-c-res', style:'margin-top:12px' });
  function cupd() { cres.textContent = ''; var r = chainCheck(ch); if (!r) { cres.appendChild(h('div', { class:'sub', text:'금액을 숫자로 넣어 주세요.' })); return; } r.links.forEach(function (x) { cres.appendChild(h('div', { class:'note' + (x.ok ? ' info' : ''), id:'tx-c-' + x.i, role:x.ok ? null : 'alert', style:'margin-top:8px', text:CHAIN[x.i] + ' → ' + CHAIN[x.i + 1] + ': ' + (x.ok ? '일치(' + won(x.sell) + '원)' : '불일치 — 판 쪽 ' + won(x.sell) + '원, 산 쪽 ' + won(x.buy) + '원, 차이 ' + won(x.diff) + '원') })); }); cres.appendChild(h('div', { class:'sub', id:'tx-c-sum', style:'margin-top:8px', text:r.ok ? '공급망 전체가 맞물려요. 거짓 수치가 끼어들 틈이 없습니다.' : '어긋난 연결이 있어요. 그 구간의 기록이 거짓이거나 오류입니다.' })); }
  var rows = ch.map(function (l, i) { return h('div', { class:'frm' }, [field('tx-l' + i + 's', CHAIN[i] + '의 매출(원)', l[0], { mode:'numeric', max:15, help:CHAIN[i + 1] + '에 판 금액', set:function (v) { l[0] = v; cupd(); } }), field('tx-l' + i + 'b', CHAIN[i + 1] + '의 매입(원)', l[1], { mode:'numeric', max:15, help:CHAIN[i] + '에서 산 금액', set:function (v) { l[1] = v; cupd(); } })]); });
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'공급망 연쇄 검증' }), h('div', { class:'sub', text:'고무 수입업체 → 타이어 생산업체 → 자동차 생산업체 → 소비자. 한 단계의 매출은 다음 단계의 매입과 같아야 합니다. 한 칸을 1원만 바꿔 보세요.' })].concat(rows, [cres]))); cupd();
  // 3) 이상 탐지
  var a = S.an, ares = h('div', { id:'tx-a-out', style:'margin-top:12px' });
  function aupd() { ares.textContent = ''; var r = anomaly(a.base.split(/[\s,]+/).filter(Boolean), a.val, a.k); ares.appendChild(!r ? h('div', { class:'sub', text:'평소 거래 금액 5개 이상과 새 거래 금액을 넣으면 평소와 얼마나 다른지 알려 줘요.' }) : h('div', { class:r.abnormal ? 'note' : 'note info', id:'tx-a-res', role:r.abnormal ? 'alert' : null, text:'평소 평균 ' + won(r.mean) + '원 — 새 거래는 ' + (r.z == null ? (r.abnormal ? '평소와 달라요(평소 금액이 모두 같아요).' : '평소와 같아요.') : Math.abs(Math.round(r.z * 10) / 10) + '표준편차 ' + (r.z < 0 ? '낮아요' : '높아요') + (r.abnormal ? ' → 이상 거래로 즉시 탐지됩니다.' : ' → 평소 범위예요.')) })); }
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'이상 거래 탐지' }), h('div', { class:'sub', text:'고정 기준이 아니라 그 거래 주체의 평소 거래와 비교합니다.' }), h('div', { class:'frm' }, [field('tx-a-base', '평소 거래 금액(쉼표로 구분, 5개 이상)', a.base, { ph:'예: 100000, 120000, 95000, 110000, 105000', max:120, set:function (v) { a.base = v; aupd(); } }), field('tx-a-val', '새 거래 금액(원)', a.val, { mode:'numeric', max:15, set:function (v) { a.val = v; aupd(); } }), field('tx-a-k', '이상으로 볼 표준편차 배수', a.k, { mode:'decimal', max:4, set:function (v) { a.k = v; aupd(); } })]), ares])); aupd();
  return kids;
}

// ── 내 재무제표 ──
function addJe() {
  var f = S.jf, e = {}, d = f.d || kst(), amt = snum(f.amt);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) e.d = '날짜는 2026-11-23 모양으로 적어 주세요.';
  if (!isFinite(amt) || amt <= 0 || amt > 1e15) e.amt = '금액(원)을 1 이상의 정수로 적어 주세요.';
  if (f.dr === f.cr) e.cr = '차변과 대변 계정이 같을 수 없어요.';
  if (S.je.length >= MAXE) e.amt = '기록은 최대 ' + MAXE + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  S.je.push({ id:uid(), d:d, dr:f.dr, cr:f.cr, amt:amt, memo:clean(f.memo, 40) }); f.amt = ''; f.memo = ''; S.msg = '분개를 기록했어요. 재무제표가 갱신되었습니다.'; save(); render();
}
function viewFs() {
  var kids = head('내 재무제표', '거래를 분개로 적으면 재무상태표와 손익계산서가 자동으로 만들어지고 갱신됩니다.'); kids.push(notice());
  var T = statements(S.je);
  kids.push(h('div', { class:'g4' }, [tile('자산', won(T.assets) + '원', '', 'tx-f0'), tile('부채', won(T.liab) + '원', '', 'tx-f1'), tile('자본(+순이익 전)', won(T.equity) + '원', '', 'tx-f2'), tile('당기순이익', sgn(T.net) + '원', '수익 − 비용', 'tx-f3')]));
  kids.push(h('div', { class:T.balanced ? 'note info' : 'note', id:'tx-f-bal', style:'margin-top:12px', text:T.balanced ? '대차가 맞아요: 자산 ' + won(T.assets) + ' = 부채 ' + won(T.liab) + ' + 자본 ' + won(T.equity) + ' + 당기순이익 ' + sgn(T.net) + '. 분개는 차변과 대변이 같은 금액으로만 기록돼서 이 등식이 항상 성립합니다.' : '대차가 맞지 않아요.' }));
  var f = S.jf, e = S.err, opts = ACCTS.map(function (a) { return [a[0], a[0] + ' (' + TYPE_NAME[a[1]] + ')']; });
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'분개 적기' }), h('div', { class:'sub', text:'예) 자본금 1,000만 원 출자: 차변 현금, 대변 자본금. 매출 100만 원 현금 수입: 차변 현금, 대변 매출.' }),
    h('div', { class:'frm' }, [field('tx-j-d', '날짜', f.d, { err:e.d, ph:kst(), mode:'numeric', max:10, set:function (v) { f.d = v.trim(); } }), sel('tx-j-dr', '차변(늘거나 생긴 쪽)', f.dr, opts, function (v) { f.dr = v; }), sel('tx-j-cr', '대변', f.cr, opts, function (v) { f.cr = v; }), field('tx-j-amt', '금액(원)', f.amt, { err:e.amt, mode:'numeric', max:15, set:function (v) { f.amt = v; } }), field('tx-j-memo', '메모(선택)', f.memo, { max:40, set:function (v) { f.memo = v; } })]),
    e.cr ? h('div', { class:'err', text:e.cr }) : null, h('div', { class:'rowf', style:'margin-top:16px' }, [btn('분개 기록', 'fill', addJe), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  var line = function (t) { return ACCTS.filter(function (a) { return a[1] === t; }).map(function (a) { return h('div', { class:'kv' }, [h('span', { text:a[0] }), h('b', { class:'num', text:won(T.bal[a[0]]) + '원' })]); }); };
  kids.push(h('div', { class:'g2', style:'margin-top:16px;align-items:start' }, [h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'재무상태표' }), h('b', { text:'자산' })].concat(line('A'), [h('b', { text:'부채' })], line('L'), [h('b', { text:'자본' })], line('E'), [h('div', { class:'kv' }, [h('span', { text:'당기순이익' }), h('b', { class:'num', text:sgn(T.net) + '원' })])])), h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'손익계산서' }), h('b', { text:'수익' })].concat(line('R'), [h('b', { text:'비용' })], line('X'), [h('div', { class:'kv' }, [h('span', { text:'당기순이익' }), h('b', { class:'num', text:sgn(T.net) + '원' })])]))]));
  if (S.je.length) kids.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['날짜', '차변', '대변', '금액', '메모', ''].map(function (t, i) { return h('th', { class:i === 3 ? 'r' : '', text:t }); }))]), h('tbody', {}, S.je.slice().sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; }).map(function (x) { return h('tr', {}, [h('td', { class:'num', text:x.d }), h('td', { text:x.dr }), h('td', { text:x.cr }), h('td', { class:'r num', text:won(x.amt) + '원' }), h('td', { text:x.memo || '—' }), h('td', { class:'r' }, [btn('삭제', 'sm quiet', function () { S.je = S.je.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]); }))])])]));
  else kids.push(empty('아직 분개가 없어요. 위에서 첫 거래를 적어 보세요.'));
  return kids;
}

// ── 세금 계산 ──
function viewTax() {
  var kids = head('세금 계산', '세법 버전표에 따라 세액을 계산합니다. 항상 최신 세법을 적용한다는 원칙을 버전표로 보여 줍니다.'); kids.push(notice());
  var t = S.tx, vt = S.vt;
  var form = h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'소득세·법인세' }), h('div', { class:'frm' }, [sel('tx-t-kind', '세목', t.kind, Object.keys(LAW).map(function (k) { return [k, LAW[k].name]; }), function (v) { t.kind = v; render(); }), field('tx-t-year', t.kind === 'corp' ? '사업연도(개시 연도)' : '귀속 연도', t.year, { mode:'numeric', max:4, set:function (v) { t.year = v; upd(); } }), field('tx-t-base', '과세표준(원)', t.base, { ph:'예: 60000000', mode:'numeric', max:15, help:'공제 등을 뺀 뒤의 금액', set:function (v) { t.base = v; upd(); } })])]);
  var out = h('div', { class:'col', id:'tx-t-out', style:'gap:16px' });
  function upd() {
    out.textContent = ''; var R = taxCalc(t.kind, t.year, t.base);
    if (!R) { out.appendChild(h('div', { class:'card' }, [h('div', { class:'empty', text:lawVersion(t.kind, t.year) ? '과세표준을 숫자로 넣어 주세요.' : '이 연도의 세율표가 없어요(2023년부터 지원).' })])); return; }
    out.appendChild(h('div', { class:'g2' }, [tile('산출세액', won(R.tax) + '원', '실효세율 ' + Math.round(R.eff * 1000) / 10 + '% · 한계세율 ' + Math.round(R.marginal * 1000) / 10 + '%', 'tx-t-tax'), tile('지방소득세 포함', won(R.total) + '원', '지방소득세 ' + won(R.local) + '원(산출세액의 10%)', 'tx-t-total')]));
    out.appendChild(h('div', { class:'card', style:'padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['구간', '세율', '이 구간 금액', '세액'].map(function (x, i) { return h('th', { class:i ? 'r' : '', text:x }); }))]), h('tbody', {}, R.rows.map(function (r) { return h('tr', {}, [h('td', { text:(r.to === Infinity ? won(r.from) + '원 초과' : won(r.from) + '원 초과 ~ ' + won(r.to) + '원 이하').replace('0원 초과 ~', '') }), h('td', { class:'r num', text:Math.round(r.rate * 100) + '%' }), h('td', { class:'r num', text:won(r.part) + '원' }), h('td', { class:'r num', text:won(r.tax) + '원' })]); }))])])]));
    out.appendChild(h('div', { class:'foot', id:'tx-t-law', text:'적용 세법: ' + LAW[t.kind].base + ' · ' + R.from + '년 이후 버전. 공제·감면·세액공제·가산세는 반영하지 않았어요.' }));
  }
  upd(); kids.push(h('div', { class:'g2', style:'margin-top:16px;align-items:start' }, [form, out]));
  // 세법 버전표
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'세법 버전표' }), h('div', { class:'sub', text:'나비웹 세무 인프라는 항상 최신 세법을 적용합니다. 이 화면의 세율은 2026-11-23에 확인한 값이며, 법이 바뀌면 이 표의 버전이 추가돼요.' })].concat(Object.keys(LAW).map(function (k) { return h('div', {}, [h('b', { text:LAW[k].name }), h('div', { class:'sub', text:LAW[k].ver.map(function (v) { return v.from + '년~: ' + v.br.map(function (b) { return Math.round(b[1] * 100) + '%'; }).join(' / '); }).join('  |  ') })]); }))));
  // 부가가치세
  var vres = h('div', { id:'tx-v-out', style:'margin-top:12px' });
  function vupd() { vres.textContent = ''; var r = vat(vt.sales, vt.purch); vres.appendChild(!r ? h('div', { class:'sub', text:'공급가액을 숫자로 넣어 주세요.' }) : h('div', {}, [h('div', { class:'kv' }, [h('span', { text:'매출세액' }), h('b', { class:'num', text:won(r.out) + '원' })]), h('div', { class:'kv' }, [h('span', { text:'매입세액' }), h('b', { class:'num', text:won(r.inn) + '원' })]), h('div', { class:'kv' }, [h('span', { text:r.pay >= 0 ? '납부할 세액' : '환급받을 세액' }), h('b', { class:'num', id:'tx-v-pay', text:won(Math.abs(r.pay)) + '원' })])])); }
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'부가가치세(일반 10%)' }), h('div', { class:'frm' }, [field('tx-v-s', '매출 공급가액(원)', vt.sales, { mode:'numeric', max:15, set:function (v) { vt.sales = v; vupd(); } }), field('tx-v-p', '매입 공급가액(원)', vt.purch, { mode:'numeric', max:15, set:function (v) { vt.purch = v; vupd(); } })]), vres, h('div', { class:'sub', text:'간이과세·면세·영세율 등 특례는 반영하지 않았어요.' })])); vupd();
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('세무 AI에게 묻기', 'quiet', function () { ask('내 소득에 세금이 얼마나 나올지 어떻게 계산하나요?'); })]));
  return kids;
}

// ── 징수 원리 ──
function addPay() {
  var f = S.pf, e = {}, a = snum(f.amt), d = f.d || '';
  if (!isFinite(a) || a > 1e15) e.amt = '금액(원)을 정수로 적어 주세요.'; if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) e.d = '날짜는 2026-11-23 모양으로 적어 주세요.'; if (S.pay.length >= MAXP) e.amt = '기록은 최대 ' + MAXP + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  S.pay.push({ id:uid(), kind:PAYKINDS.indexOf(f.kind) >= 0 ? f.kind : '기타', year:clean(f.year, 6), amt:a, st:PAYSTATES.indexOf(f.st) >= 0 ? f.st : '납부 전', d:d }); f.amt = ''; S.msg = '기록했어요.'; save(); render();
}
function viewCollect() {
  var kids = head('징수 원리', '나비웹 세무 인프라가 세법을 적용해 세금을 직접 징수하는 방식입니다.');
  kids.push(stepsCard('과세부터 징수까지', [['항상 최신 세법을 적용', '세법이 바뀌면 세법 버전이 갱신되고, 거래 시점의 세법에 맞춰 과세합니다.'], ['거래가 확정되면 세액이 자동 산출', '회계 인프라에서 상호 검증된 거래 기록으로 세액을 계산합니다. 거짓 수치가 없으니 조정할 것이 없어요.'], ['사용자의 나비와 소통', '세액과 근거를 사용자의 나비에게 알리고 확인합니다.'], ['세금을 직접 징수', '나비웹 세무 인프라가 세금을 직접 징수해 개인과 기관 누구도 1원도 더 내거나 덜 낼 수 없습니다.']], '설계 원칙입니다. 지금은 세금 징수·납부·신고가 연결되어 있지 않아요. 아래 기록은 내가 직접 적는 납부 메모입니다.'));
  var done = S.pay.filter(function (x) { return x.st === '납부함'; }).reduce(function (s, x) { return s + x.amt; }, 0), todo = S.pay.filter(function (x) { return x.st === '납부 전'; }).reduce(function (s, x) { return s + x.amt; }, 0);
  kids.push(h('div', { class:'g4', style:'margin-top:16px' }, [tile('납부한 합계', won(done) + '원', '', 'tx-p0'), tile('납부 전 합계', won(todo) + '원', '', 'tx-p1')]));
  var f = S.pf, e = S.err;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'납부 메모' }), h('div', { class:'frm' }, [sel('tx-pk', '세목', f.kind, PAYKINDS.map(function (k) { return [k, k]; }), function (v) { f.kind = v; }), field('tx-py', '귀속 연도(선택)', f.year, { ph:'2026', mode:'numeric', max:4, set:function (v) { f.year = v; } }), field('tx-pa', '금액(원)', f.amt, { err:e.amt, mode:'numeric', max:15, set:function (v) { f.amt = v; } }), sel('tx-ps', '상태', f.st, PAYSTATES.map(function (k) { return [k, k]; }), function (v) { f.st = v; }), field('tx-pd', '납부일(선택)', f.d, { err:e.d, ph:kst(), mode:'numeric', max:10, set:function (v) { f.d = v.trim(); } })]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('기록하기', 'fill', addPay), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  if (S.pay.length) kids.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['세목', '귀속', '금액', '상태', '납부일', ''].map(function (t, i) { return h('th', { class:i === 2 ? 'r' : '', text:t }); }))]), h('tbody', {}, S.pay.map(function (x) { return h('tr', {}, [h('td', { text:x.kind }), h('td', { text:x.year || '—' }), h('td', { class:'r num', text:won(x.amt) + '원' }), h('td', {}, [pill(x.st, x.st === '납부함' ? 'm' : '')]), h('td', { class:'num', text:x.d || '—' }), h('td', { class:'r' }, [btn('삭제', 'sm quiet', function () { S.pay = S.pay.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]); }))])])]));
  return kids;
}

function render() {
  var root = $('tx-root'), tp = $('tx-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = S.view === 'verify' ? viewVerify() : S.view === 'fs' ? viewFs() : S.view === 'tax' ? viewTax() : S.view === 'collect' ? viewCollect() : viewAcct();
  kids.forEach(function (k) { if (k) root.appendChild(k); });
}
function reply(ok, msg) { emit('result', { ok:ok, msg:msg, view:S.view }); }
function nav(a) {
  var d = a && typeof a['do'] === 'string' ? a['do'] : '';
  if (VIEWS.indexOf(d) >= 0) { go(d); return reply(true, TABS[VIEWS.indexOf(d)][1] + ' 화면으로 이동했습니다.'); }
  return reply(false, '지원하지 않는 요청입니다.');
}
function mount(el, o) {
  if (!el) return; o = o || {};
  M = el; el.textContent = ''; el.classList.add('tx'); S.je = []; S.pay = []; S.err = {}; S.msg = ''; load();
  [h('div', { id:'tx-top' }), h('div', { class:'wrap', id:'tx-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'acct'; render();
}
window.NaviTax = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  matchSlips:matchSlips, chainCheck:chainCheck, anomaly:anomaly, statements:statements, taxCalc:taxCalc, vat:vat, lawVersion:lawVersion,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
