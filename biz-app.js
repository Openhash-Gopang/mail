/* biz-app.js — 나비웹 사업(인프라 AI · 사업자). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviBiz.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 biz.css(.biz 범위). 전역은 NaviBiz 하나만 쓴다.
 *
 * 사업 화면의 순환(주피터 지시): 개인·법인 사업을 시작하려는 사용자의 시장 상황과 사용자의 상황을 서로 비교해 성공 가능성을 미리 판단하고(시행착오 손실 방지),
 * 시작한 사업은 주기적으로 경영 성과를 평가해 개선책을 내고, 개선책의 적용 여부와 효과를 측정하고, 다시 새 개선책을 내는 순환이다. 널리 알려지고 인정받는 경영학 이론을 쓴다.
 *  - 시장 분석: 마이클 포터의 다섯 가지 힘(Five Forces), SWOT 메모, 손익분기점(CVP) 분석.
 *  - 성과 평가: 카플란·노턴의 균형성과표(BSC) 네 관점(재무·고객·내부 프로세스·학습과 성장), 단위 경제성(LTV/CAC ≥ 3 은 흔히 쓰는 경험 기준).
 *  - 개선 순환: 데밍의 PDCA(Plan-Do-Check-Act). 목표는 시작값·목표값·결과값으로 측정한다(OKR 의 핵심 결과 방식).
 * 이 화면은 입력한 숫자로 계산·기록만 한다: assessStart(시작 전 판단) · breakEven · cashPath · metrics/bsc(성과) · suggest(개선안 후보) · effect(개선 효과).
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 판단 결과는 입력한 값을 이론 틀에 넣어 본 참고용이며 성공을 보장하지 않는다. 시장 정보를 자동으로 가져오지 않는다(시장 평가는 사용자가 점수로 입력).
 *  - 매출·비용 같은 실제 장부와 연결되어 있지 않다. 입력한 값만 쓰고, 기록은 이 브라우저(localStorage)에만 저장되며 밖으로 보내지 않는다.
 *  - 사업자 등록·신고·투자 권유는 하지 않는다. 세무·법률은 해당 인프라 AI 와 전문가에게 확인한다. */
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
function pill(t, k) { return h('span', { class:'pill ' + (k || ''), text:t }); }
function btn(t, c, fn) { return h('button', { type:'button', class:'btn ' + (c || ''), text:t, onclick:fn }); }
function kst() { return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul' }).format(new Date()); }
function numOf(v) { var s = String(v == null ? '' : v).replace(/[,\s명]/g, ''); if (s === '' || !/^\d*\.?\d+$|^\d+\.?$/.test(s)) return NaN; return Number(s); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function clean(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }

// ── 저장 ──
var KEY = 'navi-biz-v1', MAXR = 60, MAXA = 60, STAGES = ['Plan', 'Do', 'Check', 'Act'], PERSP = ['재무', '고객', '내부 프로세스', '학습과 성장'];
var FORCES = [['rivalry', '기존 경쟁자와의 경쟁'], ['entry', '새 경쟁자의 진입 위협'], ['substitute', '대체재의 위협'], ['buyer', '고객의 협상력'], ['supplier', '공급자의 협상력']];
var FITS = [['exp', '이 분야 경험과 전문성'], ['proof', '고객이 살 것이라는 검증(주문·예약·인터뷰)'], ['edge', '경쟁자와 다른 강점']];
var TABS = [['home', '내 사업'], ['assess', '시작 전 판단'], ['perf', '성과 평가'], ['cycle', '개선 순환'], ['theory', '경영 이론']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var M = null, LS = {};
function blankAs() { return { forces:{}, fit:{}, swot:{ s:'', w:'', o:'', t:'' }, capital:'', invest:'', fixed:'', price:'', varc:'', units:'', ramp:'' }; }
var S = { view:'home', as:blankAs(), recs:[], acts:[], rf:{ month:'', revenue:'', cost:'', marketing:'', customers:'', newc:'', repeat:'', proc:'', learn:'' }, af:{ title:'', persp:'재무', metric:'', base:'', target:'' }, err:{}, msg:'' };

function field(id, label, val, o) {
  o = o || {}; var e = o.err, inp = h(o.area ? 'textarea' : 'input', o.area ? { id:id, rows:'4', placeholder:o.ph || '', maxlength:o.max || '60', 'aria-invalid':e ? 'true' : 'false' } : { id:id, type:'text', value:val == null ? '' : val, placeholder:o.ph || '', maxlength:o.max || '60', inputmode:o.mode || '', autocomplete:'off', 'aria-invalid':e ? 'true' : 'false' });
  if (o.area) inp.value = val == null ? '' : val;
  inp.oninput = function () { if (o.set) o.set(inp.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), inp, h('div', { id:id + '-h', class:e ? 'err' : 'help', text:e || o.help || '' })]);
}
function sel(id, label, val, opts, set) {
  var s = h('select', { id:id, 'aria-label':label }, opts.map(function (c) { return h('option', { value:c[0], text:c[1] }); })); s.value = val; s.onchange = function () { set(s.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), s, h('div', { class:'help', text:'' })]);
}
function empty(t, b) { return h('div', { class:'card', style:'margin-top:16px' }, [h('div', { class:'empty', text:t }), b ? h('div', { class:'rowf', style:'justify-content:center' }, [b]) : null]); }
function head(title, lead) { return [h('h1', { text:title }), lead ? h('p', { class:'lead', text:lead }) : null]; }
function go(v) { S.view = v; S.err = {}; S.msg = ''; render(); try { M.scrollIntoView({ block:'start' }); } catch (e) {} }
function tile(k, v, s, id) { return h('div', { class:'tile' }, [h('div', { class:'k', text:k }), h('div', { class:'num', id:id, style:'font-size:20px;font-weight:700', text:v }), s ? h('div', { class:'sub', text:s }) : null]); }
function stepsCard(title, st, foot) {
  return h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:title }), h('div', {}, st.map(function (x, i) { return h('div', { class:'stp' }, [h('i', { text:String(i + 1) }), h('div', {}, [h('b', { text:x[0] }), h('span', { text:x[1] })])]); })), foot ? h('div', { class:'note info', text:foot }) : null]);
}
function table(cols, rows) {
  return h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, cols.map(function (t) { return h('th', { text:t }); }))]), h('tbody', {}, rows)])])]);
}

function topbar() {
  return h('div', { class:'topin' }, [
    h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 사업자' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function notice() {
  return h('div', { class:'note info', style:'margin:16px 0', id:'bz-note', text:'이 화면은 입력한 숫자로 계산하고 기록만 합니다. 결과는 참고용이며 사업의 성공을 보장하지 않아요. 장부나 시장 정보와 연결되어 있지 않고, 적은 내용은 이 브라우저에만 저장되며 밖으로 보내지 않습니다.' });
}
function chips(n) { return h('span', { class:'pill', text:n }); }
function rows2(rows) { return rows.map(function (r) { return h('tr', {}, r.map(function (t, i) { return h(i ? 'td' : 'th', { text:t }); })); }); }

function load() {
  try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v || typeof v !== 'object') return;
    var a = v.as; if (a && typeof a === 'object') { var b = blankAs(); ['capital', 'invest', 'fixed', 'price', 'varc', 'units', 'ramp'].forEach(function (k) { b[k] = clean(a[k], 20); });
      FORCES.forEach(function (f) { var x = Number(a.forces && a.forces[f[0]]); if (x >= 1 && x <= 5 && Math.floor(x) === x) b.forces[f[0]] = x; });
      FITS.forEach(function (f) { var x = Number(a.fit && a.fit[f[0]]); if (x >= 1 && x <= 5 && Math.floor(x) === x) b.fit[f[0]] = x; });
      ['s', 'w', 'o', 't'].forEach(function (k) { b.swot[k] = clean(a.swot && a.swot[k], 300); }); S.as = b; }
    S.recs = (Array.isArray(v.recs) ? v.recs : []).map(fixR).filter(Boolean).slice(0, MAXR);
    S.acts = (Array.isArray(v.acts) ? v.acts : []).map(fixA).filter(Boolean).slice(0, MAXA); } catch (e) {}
}
function g15(x) { x = Number(x); return x >= 1 && x <= 5 && Math.floor(x) === x ? x : null; }
function fixR(x) { if (!x || typeof x !== 'object' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(x.month)) return null; var o = { month:x.month }; var ok = true;
  ['revenue', 'cost', 'marketing', 'customers', 'newc'].forEach(function (k) { var n = Number(x[k]); if (!isFinite(n) || n < 0 || n > 1e13) ok = false; o[k] = n; });
  var r = Number(x.repeat); if (!isFinite(r) || r < 0 || r > 100) ok = false; o.repeat = r; o.proc = g15(x.proc); o.learn = g15(x.learn); if (!o.proc || !o.learn) ok = false; return ok ? o : null; }
function fixA(x) { if (!x || typeof x !== 'object' || STAGES.indexOf(x.stage) < 0 || PERSP.indexOf(x.persp) < 0) return null; var t = clean(x.title, 60), m = clean(x.metric, 40); if (!t || !m) return null;
  var base = Number(x.base), tg = x.target === '' || x.target == null ? null : Number(x.target), res = x.result === '' || x.result == null ? null : Number(x.result);
  if (!isFinite(base) || (tg !== null && !isFinite(tg)) || (res !== null && !isFinite(res))) return null;
  var rd = Number(x.round); return { id:clean(x.id, 20) || uid(), title:t, persp:x.persp, metric:m, base:base, target:tg, result:res, stage:x.stage, round:rd >= 1 && rd <= 99 && Math.floor(rd) === rd ? rd : 1, d:/^\d{4}-\d{2}-\d{2}$/.test(x.d) ? x.d : '' }; }
function save() { try { localStorage.setItem(KEY, JSON.stringify({ as:S.as, recs:S.recs, acts:S.acts })); } catch (e) {} }

// ── 계산 ──
/** 손익분기점(CVP): 단가·단위당 변동비·월 고정비 → 단위당 공헌이익, 손익분기 판매량·매출. 단가 ≤ 변동비이면 null. */
function breakEven(fixed, price, varc) {
  var f = numOf(fixed), p = numOf(price), v = numOf(varc); if (!isFinite(f) || !isFinite(p) || !isFinite(v) || f < 0 || p <= 0 || v < 0 || p > 1e12 || f > 1e13 || v > 1e12 || p <= v) return null;
  var m = p - v; return { margin:m, marginRate:m / p * 100, units:Math.ceil(f / m), revenue:Math.ceil(f / m) * p };
}
/** 현금 흐름 점검: 판매량이 0에서 안정기 판매량까지 직선으로 는다고 가정하고 60개월을 계산한다. 초기 투자비를 포함한 최대 누적 부족액(trough)과 월 흑자 전환 달(없으면 null). */
function cashPath(capital, invest, fixed, price, varc, units, ramp) {
  var c = numOf(capital), iv = numOf(invest), f = numOf(fixed), p = numOf(price), v = numOf(varc), u = numOf(units), r = numOf(ramp);
  if ([c, iv, f, p, v, u, r].some(function (x) { return !isFinite(x) || x < 0 || x > 1e13; }) || p <= 0 || p <= v || r < 1 || r > 60 || Math.floor(r) !== r || u <= 0) return null;
  var cum = -iv, low = cum, brk = null, t, ut, pr;
  for (t = 1; t <= 60; t++) { ut = u * Math.min(t, r) / r; pr = ut * (p - v) - f; cum += pr; if (cum < low) low = cum; if (brk === null && pr >= 0) brk = t; }
  var need = -low; return { need:Math.max(0, Math.round(need)), capital:c, enough:c >= need, breakMonth:brk, steadyProfit:Math.round(u * (p - v) - f) };
}
/** 시작 전 판단: 시장(다섯 가지 힘 5개, 높을수록 압력이 큼) · 나(3개) · 돈(손익분기·현금) 세 가지 점검. 입력이 모자라거나 틀리면 null. */
function assessStart(a) {
  if (!a || !a.forces || !a.fit) return null; var fo = FORCES.map(function (f) { return g15(a.forces[f[0]]); }), fi = FITS.map(function (f) { return g15(a.fit[f[0]]); });
  if (fo.some(function (x) { return !x; }) || fi.some(function (x) { return !x; })) return null;
  var be = breakEven(a.fixed, a.price, a.varc), cp = cashPath(a.capital, a.invest, a.fixed, a.price, a.varc, a.units, a.ramp); if (!be || !cp) return null;
  var avg = function (z) { return z.reduce(function (s, x) { return s + x; }, 0) / z.length; }, market = Math.round((6 - avg(fo)) * 10) / 10, fit = Math.round(avg(fi) * 10) / 10, u = numOf(a.units);
  var checks = [
    { k:'시장', ok:market >= 3, msg:market >= 3 ? '시장의 압력이 감당할 만한 수준이에요(매력도 ' + market + '/5).' : '경쟁·협상력 압력이 커서 매력도가 낮아요(' + market + '/5). 차별화나 틈새 시장을 다시 찾아보세요.' },
    { k:'나', ok:fit >= 3, msg:fit >= 3 ? '내 경험·검증·강점이 받쳐 줘요(' + fit + '/5).' : '경험·고객 검증·강점이 부족해요(' + fit + '/5). 작게 시험해 검증을 먼저 쌓으세요.' },
    { k:'돈', ok:u >= be.units && cp.enough, msg:u < be.units ? '예상 월 판매량(' + u + ')이 손익분기 판매량(' + be.units + ')에 못 미쳐 안정기에도 적자예요.' : (cp.enough ? '자금이 최대 누적 부족액을 넘어요.' : '자금이 ' + (cp.need - cp.capital) + '원 모자라요. 투자비·고정비를 줄이거나 자금을 더 마련하세요.') }];
  var passes = checks.filter(function (c) { return c.ok; }).length;
  return { market:market, fit:fit, be:be, cash:cp, checks:checks, passes:passes, verdict:passes === 3 ? '진행 가능' : passes === 2 ? '보완 후 시작' : '재검토' };
}
function pct1(x) { return Math.round(x * 10) / 10; }
/** 월 성과 지표: 이익·이익률·매출 성장률(직전 달 대비)·고객 획득비용(CAC)·고객당 매출·고객 생애 가치(LTV)·LTV/CAC. 계산할 수 없는 값은 null. */
function metrics(rec, prev) {
  if (!rec) return null; var profit = rec.revenue - rec.cost, margin = rec.revenue > 0 ? pct1(profit / rec.revenue * 100) : null;
  var growth = prev && prev.revenue > 0 ? pct1((rec.revenue - prev.revenue) / prev.revenue * 100) : null, cac = rec.newc > 0 ? Math.round(rec.marketing / rec.newc) : null, arpu = rec.customers > 0 ? Math.round(rec.revenue / rec.customers) : null;
  var ltv = arpu !== null && margin !== null && margin > 0 && rec.repeat < 100 ? Math.round(arpu * (margin / 100) / (1 - rec.repeat / 100)) : null;
  return { profit:profit, margin:margin, growth:growth, cac:cac, arpu:arpu, ltv:ltv, ltvCac:ltv !== null && cac ? pct1(ltv / cac) : null };
}
/** 균형성과표(BSC) 네 관점의 신호: good(양호) · watch(주의) · risk(위험). */
function bsc(rec, m) {
  if (!rec || !m) return null; var sc = function (n) { return n >= 4 ? 'good' : n === 3 ? 'watch' : 'risk'; };
  var fin = m.margin === null || m.margin < 0 ? 'risk' : (m.growth !== null && m.growth < 0 ? 'watch' : 'good');
  var cus = rec.repeat < 30 ? 'risk' : m.ltvCac === null ? 'watch' : m.ltvCac < 1 ? 'risk' : m.ltvCac < 3 ? 'watch' : 'good';
  return [{ p:'재무', s:fin }, { p:'고객', s:cus }, { p:'내부 프로세스', s:sc(rec.proc) }, { p:'학습과 성장', s:sc(rec.learn) }];
}
/** 개선안 후보: 주의·위험 신호마다 측정할 지표와 시작값·목표값을 붙여 준다. */
function suggest(rec, m) {
  var b = bsc(rec, m); if (!b) return []; var out = [], st = {}; b.forEach(function (x) { st[x.p] = x.s; });
  if (st['재무'] !== 'good') { if (m.margin === null || m.margin < 0) out.push({ persp:'재무', title:'원가와 가격을 점검해 적자를 줄인다', metric:'이익률(%)', base:m.margin === null ? 0 : m.margin, target:0 }); else out.push({ persp:'재무', title:'매출이 줄어든 원인을 찾아 회복한다', metric:'매출 성장률(%)', base:m.growth, target:0 }); }
  if (st['고객'] !== 'good') { if (rec.repeat < 30 || m.ltvCac === null) out.push({ persp:'고객', title:'재구매율을 높인다', metric:'재구매율(%)', base:rec.repeat, target:Math.min(100, Math.round(rec.repeat) + 10) }); if (m.ltvCac !== null) out.push({ persp:'고객', title:'고객 획득비용을 낮추거나 고객 가치를 높인다', metric:'LTV/CAC', base:m.ltvCac, target:3 }); }
  if (st['내부 프로세스'] !== 'good') out.push({ persp:'내부 프로세스', title:'가장 불편한 업무 과정 하나를 고친다', metric:'프로세스 자가평가(1~5)', base:rec.proc, target:4 });
  if (st['학습과 성장'] !== 'good') out.push({ persp:'학습과 성장', title:'부족한 역량을 채울 학습을 정한다', metric:'학습·성장 자가평가(1~5)', base:rec.learn, target:4 });
  return out;
}
/** 개선 효과: (결과−시작값)/(목표−시작값). 100% 이상 달성 · 50% 이상 진행 · 0% 이상 미흡 · 0% 미만 악화. 목표가 시작값과 같거나 값이 틀리면 null. */
function effect(base, target, result) {
  var b = Number(base), t = Number(target), r = Number(result); if (base === '' || target === '' || result === '' || base == null || target == null || result == null || !isFinite(b) || !isFinite(t) || !isFinite(r) || t === b) return null;
  var p = pct1((r - b) / (t - b) * 100); return { pct:p, status:p >= 100 ? '달성' : p >= 50 ? '진행' : p >= 0 ? '미흡' : '악화' };
}
function money(n) { return n === null || n === undefined ? '—' : Math.round(n).toLocaleString('ko-KR') + '원'; }
function mval(n, u) { return n === null || n === undefined ? '—' : n + (u || ''); }
var SIG = { good:['양호', 'ok'], watch:['주의', 'warn'], risk:['위험', 'bad'] };

// ── 내 사업 ──
function lastRec() { return S.recs.length ? S.recs[0] : null; }
function viewHome() {
  var kids = head('내 사업', '시작하기 전에 판단하고, 시작한 뒤에는 재고 → 고치고 → 효과를 확인하는 순환을 돕습니다.'); kids.push(notice());
  var r = lastRec(), m = r ? metrics(r, S.recs[1] || null) : null, as = assessStart(S.as), open = S.acts.filter(function (x) { return x.stage !== 'Act' || x.result === null; }).length;
  kids.push(h('div', { class:'g2' }, [tile('시작 전 판단', as ? as.verdict : '—', as ? '세 가지 점검 중 ' + as.passes + '개 통과' : '입력이 더 필요해요', 'bz-h-as'), tile('최근 이익률', r && m && m.margin !== null ? m.margin + '%' : '—', r ? r.month + ' 기록' : '아직 기록이 없어요', 'bz-h-m'), tile('진행 중인 개선안', open + '건', '개선 순환 탭에서 관리', 'bz-h-open')]));
  kids.push(stepsCard('사업의 순환', [['시작 전 판단', '시장(다섯 가지 힘)과 내 상황(경험·검증·강점·자금)을 견주어 시행착오 손실을 미리 줄여요.'], ['성과 평가', '매달 균형성과표 네 관점으로 재요.'], ['개선안 제시', '주의·위험 신호마다 측정할 지표와 목표를 붙여 개선안을 내요.'], ['적용·효과 측정', 'PDCA 단계로 적용하고 결과값으로 효과를 재요.'], ['새 개선안', '달성하면 새 목표, 미달이면 원인을 다시 점검하며 한 바퀴 더 돌아요.']]));
  kids.push(h('div', { class:'rowf', style:'margin-top:12px' }, [btn('시작 전 판단', 'fill', function () { go('assess'); }), btn('성과 기록하기', 'quiet', function () { go('perf'); }), btn('사업 AI에게 묻기', 'quiet', function () { ask('내 사업의 성공 가능성을 따져 보려면 무엇부터 점검해야 하나요?'); })]));
  return kids;
}

// ── 시작 전 판단 ──
function numField(id, label, key, help) { return field(id, label, S.as[key], { max:16, mode:'numeric', help:help || '', set:function (v) { S.as[key] = clean(v, 20); save(); updAs(); } }); }
function scoreSel(id, label, grp, key, low, high) {
  var cur = S.as[grp][key], s = h('select', { id:id, 'aria-label':label }, [h('option', { value:'', text:'선택' })].concat([1, 2, 3, 4, 5].map(function (n) { return h('option', { value:String(n), text:n + (n === 1 ? ' (' + low + ')' : n === 5 ? ' (' + high + ')' : '') }); })));
  s.value = cur ? String(cur) : ''; s.onchange = function () { var n = g15(s.value); if (n) S.as[grp][key] = n; else delete S.as[grp][key]; save(); updAs(); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), s, h('div', { class:'help', text:'' })]);
}
var asOut = null;
function updAs() {
  if (!asOut) return; asOut.textContent = ''; var a = S.as, be = breakEven(a.fixed, a.price, a.varc), r = assessStart(a);
  if (be) asOut.appendChild(h('div', { class:'g2' }, [tile('손익분기 판매량', be.units + '개', '월 고정비 ÷ 단위당 공헌이익', 'bz-be-u'), tile('손익분기 매출', money(be.revenue), '공헌이익률 ' + pct1(be.marginRate) + '%', 'bz-be-r')]));
  else asOut.appendChild(h('div', { class:'sub', id:'bz-be-none', text:'월 고정비·단가·단위당 변동비를 넣으면 손익분기를 계산해요(단가는 변동비보다 커야 해요).' }));
  if (!r) { asOut.appendChild(h('div', { class:'note', id:'bz-as-none', style:'margin-top:12px', text:'시장 5개, 나 3개 점수와 돈 항목(자금·투자비·고정비·단가·변동비·판매량·안정기까지 개월)을 모두 넣으면 판단 결과가 나와요.' })); return; }
  asOut.appendChild(h('div', { id:'bz-as-res', class:r.passes === 3 ? 'note info' : 'note', style:'margin-top:12px' }, [h('b', { id:'bz-as-verdict', text:r.verdict }), h('span', { text:' — 세 가지 점검 중 ' + r.passes + '개를 통과했어요.' })]));
  asOut.appendChild(table(['점검', '결과', '내용'], r.checks.map(function (c) { return h('tr', {}, [h('th', { text:c.k }), h('td', {}, [pill(c.ok ? '통과' : '보완', c.ok ? 'ok' : 'warn')]), h('td', { text:c.msg })]); })));
  asOut.appendChild(h('div', { class:'sub', style:'margin-top:8px', id:'bz-as-cash', text:'판매량이 0에서 안정기까지 직선으로 는다고 가정하면, 초기 투자비를 포함해 최대 ' + money(r.cash.need) + '이 필요하고 월 흑자 전환은 ' + (r.cash.breakMonth ? r.cash.breakMonth + '개월째예요.' : '60개월 안에 오지 않아요.') }));
  asOut.appendChild(h('div', { class:'rowf', style:'margin-top:8px' }, [btn('사업 AI에게 결과 묻기', 'quiet', function () { ask('시작 전 판단 결과가 「' + r.verdict + '」입니다. 시장 매력도 ' + r.market + ', 내 준비도 ' + r.fit + ', 손익분기 판매량 ' + r.be.units + '개예요. 무엇을 보완하면 좋을까요?'); })]));
}
function viewAssess() {
  var kids = head('시작 전 판단', '시장 상황과 내 상황을 견주어 성공 가능성을 미리 따져 봅니다. 모두 내가 입력한 값으로만 계산해요.'); kids.push(notice());
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'① 시장 — 다섯 가지 힘(마이클 포터)' }), h('div', { class:'sub', text:'각 힘이 내 사업에 가하는 압력을 1(약함)~5(강함)로 평가해요.' }),
    h('div', { class:'frm' }, FORCES.map(function (f) { return scoreSel('bz-f-' + f[0], f[1], 'forces', f[0], '약함', '강함'); }))]));
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'② 나 — 내 상황' }),
    h('div', { class:'frm' }, FITS.map(function (f) { return scoreSel('bz-t-' + f[0], f[1], 'fit', f[0], '없음', '충분'); })),
    h('div', { class:'sub', text:'SWOT 메모(강점·약점·기회·위협)는 판단 점수에는 쓰이지 않고, 사업 AI와 이야기할 때 참고로 적어 두는 칸이에요.' }),
    h('div', { class:'frm' }, [['s', '강점(S)'], ['w', '약점(W)'], ['o', '기회(O)'], ['t', '위협(T)']].map(function (x) { return field('bz-sw-' + x[0], x[1], S.as.swot[x[0]], { area:true, max:300, set:function (v) { S.as.swot[x[0]] = clean(v, 300); save(); } }); }))]));
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'③ 돈 — 손익분기와 현금(원 단위)' }),
    h('div', { class:'frm' }, [numField('bz-a-capital', '준비한 자금', 'capital'), numField('bz-a-invest', '초기 투자비(설비·보증금 등)', 'invest'), numField('bz-a-fixed', '월 고정비(임대료·인건비 등)', 'fixed'), numField('bz-a-price', '단가(1개 판매가)', 'price'), numField('bz-a-varc', '단위당 변동비', 'varc'), numField('bz-a-units', '안정기 월 판매량(개)', 'units'), numField('bz-a-ramp', '안정기까지 걸리는 개월 수(1~60)', 'ramp')])]));
  asOut = h('div', { id:'bz-as-out', style:'margin-top:16px' }); kids.push(asOut); updAs(); return kids;
}

// ── 성과 평가 ──
function addRec() {
  var f = S.rf, e = {}, mo = clean(f.month, 7); if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mo)) e.month = '월을 2026-11 형식으로 적어 주세요.';
  var o = { month:mo }, lab = { revenue:'매출', cost:'비용(총)', marketing:'마케팅비', customers:'고객 수', newc:'신규 고객 수' };
  Object.keys(lab).forEach(function (k) { var n = numOf(f[k]); if (!isFinite(n) || n < 0 || n > 1e13) e[k] = lab[k] + '을(를) 0 이상의 숫자로 적어 주세요.'; o[k] = n; });
  var rp = numOf(f.repeat); if (!isFinite(rp) || rp < 0 || rp > 100) e.repeat = '재구매율은 0~100 사이로 적어 주세요.'; o.repeat = rp;
  o.proc = g15(f.proc); o.learn = g15(f.learn); if (!o.proc) e.proc = '1~5로 골라 주세요.'; if (!o.learn) e.learn = '1~5로 골라 주세요.';
  if (!e.marketing && !e.cost && o.marketing > o.cost) e.marketing = '마케팅비는 총비용을 넘을 수 없어요.'; if (!e.newc && !e.customers && o.newc > o.customers) e.newc = '신규 고객 수는 고객 수를 넘을 수 없어요.';
  var dup = S.recs.some(function (x) { return x.month === mo; }); if (!e.month && !dup && S.recs.length >= MAXR) e.month = '최대 ' + MAXR + '개월까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  S.recs = S.recs.filter(function (x) { return x.month !== mo; }); S.recs.push(o); S.recs.sort(function (a, b) { return a.month < b.month ? 1 : -1; }); S.msg = dup ? mo + ' 기록을 새 값으로 바꿨어요.' : mo + ' 기록을 저장했어요.';
  ['revenue', 'cost', 'marketing', 'customers', 'newc', 'repeat', 'proc', 'learn'].forEach(function (k) { f[k] = ''; }); save(); render();
}
function sc5(id, label, key, err) {
  var s = h('select', { id:id, 'aria-label':label }, [h('option', { value:'', text:'선택' })].concat([1, 2, 3, 4, 5].map(function (n) { return h('option', { value:String(n), text:String(n) }); }))); s.value = S.rf[key] ? String(S.rf[key]) : ''; s.onchange = function () { S.rf[key] = s.value; };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), s, h('div', { class:err ? 'err' : 'help', text:err || '' })]);
}
function viewPerf() {
  var kids = head('성과 평가', '매달 숫자를 넣으면 균형성과표(BSC) 네 관점으로 어디가 좋고 어디가 위험한지 보여 줍니다.'); kids.push(notice());
  var f = S.rf, e = S.err; if (!f.month) f.month = kst().slice(0, 7);
  var nf = function (id, label, key, help) { return field(id, label, f[key], { err:e[key], max:16, mode:'numeric', help:help || '', set:function (v) { f[key] = v; } }); };
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'이달 기록(원 단위)' }),
    h('div', { class:'frm' }, [field('bz-r-month', '월', f.month, { err:e.month, max:7, ph:'2026-11', set:function (v) { f.month = v; } }), nf('bz-r-revenue', '매출', 'revenue'), nf('bz-r-cost', '비용(총)', 'cost'), nf('bz-r-marketing', '마케팅비', 'marketing', '총비용에 포함된 금액'), nf('bz-r-customers', '고객 수', 'customers'), nf('bz-r-newc', '신규 고객 수', 'newc'), nf('bz-r-repeat', '재구매율(%)', 'repeat', '지난달 고객 중 이번 달에도 산 비율'), sc5('bz-r-proc', '내부 프로세스 자가평가(1~5)', 'proc', e.proc), sc5('bz-r-learn', '학습과 성장 자가평가(1~5)', 'learn', e.learn)]),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('기록 저장', 'fill', addRec), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  var r = lastRec();
  if (!r) { kids.push(empty('아직 기록이 없어요. 이달 숫자를 넣어 저장해 보세요.')); return kids; }
  var m = metrics(r, S.recs[1] || null), b = bsc(r, m);
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:r.month + ' 균형성과표(BSC)' }),
    h('div', { id:'bz-bsc', class:'rowf' }, b.map(function (x) { return h('span', {}, [pill(x.p + ' ' + SIG[x.s][0], SIG[x.s][1])]); }))]));
  kids.push(h('div', { class:'g2', style:'margin-top:16px' }, [tile('이익', money(m.profit), '매출 − 비용', 'bz-m-profit'), tile('이익률', mval(m.margin, '%'), '', 'bz-m-margin'), tile('매출 성장률', mval(m.growth, '%'), '직전 달 대비', 'bz-m-growth'), tile('고객 획득비용(CAC)', money(m.cac), '마케팅비 ÷ 신규 고객', 'bz-m-cac'), tile('고객 생애 가치(LTV)', money(m.ltv), '고객당 매출 × 이익률 ÷ 이탈률', 'bz-m-ltv'), tile('LTV/CAC', mval(m.ltvCac), '3 이상이면 양호(경험 기준)', 'bz-m-ratio')]));
  kids.push(table(['월', '매출', '비용', '이익', ''], S.recs.slice(0, 12).map(function (x) { return h('tr', {}, [h('td', { class:'num', text:x.month }), h('td', { class:'num', text:money(x.revenue) }), h('td', { class:'num', text:money(x.cost) }), h('td', { class:'num', text:money(x.revenue - x.cost) }), h('td', {}, [btn('삭제', 'quiet', function () { S.recs = S.recs.filter(function (y) { return y.month !== x.month; }); save(); render(); })])]); })));
  kids.push(h('div', { class:'rowf', style:'margin-top:12px' }, [btn('개선안 후보 보기', 'fill', function () { go('cycle'); })]));
  return kids;
}

// ── 개선 순환 ──
function addAct(o) {
  if (S.acts.length >= MAXA) { S.err = { title:'최대 ' + MAXA + '건까지예요.' }; S.msg = ''; return render(); }
  S.acts.unshift({ id:uid(), title:o.title, persp:o.persp, metric:o.metric, base:o.base, target:o.target, result:null, stage:'Plan', round:o.round || 1, d:kst() }); save();
}
function addManual() {
  var f = S.af, e = {}, t = clean(f.title, 60), mt = clean(f.metric, 40), b = numOf(f.base), tg = numOf(f.target);
  if (!t) e.title = '개선안 제목을 적어 주세요.'; if (!mt) e.metric = '측정할 지표를 적어 주세요.'; if (!isFinite(b)) e.base = '시작값을 숫자로 적어 주세요.'; if (!isFinite(tg)) e.target = '목표값을 숫자로 적어 주세요.'; else if (isFinite(b) && tg === b) e.target = '목표값은 시작값과 달라야 해요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  addAct({ title:t, persp:f.persp, metric:mt, base:b, target:tg }); f.title = ''; f.metric = ''; f.base = ''; f.target = ''; S.msg = '개선안을 Plan 단계로 적어 뒀어요.'; render();
}
function advance(x) { var i = STAGES.indexOf(x.stage); if (i < 3) { x.stage = STAGES[i + 1]; save(); render(); } }
function viewCycle() {
  var kids = head('개선 순환', '데밍의 PDCA로 개선안을 계획(Plan)하고 적용(Do)하고 효과를 측정(Check)하고 표준으로 굳히거나 다시 고칩니다(Act).'); kids.push(notice());
  var r = lastRec(), cand = r ? suggest(r, metrics(r, S.recs[1] || null)) : [];
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'개선안 후보' }), r ? h('div', { class:'sub', text:r.month + ' 성과 평가에서 주의·위험으로 나온 관점이에요.' }) : null,
    !r ? h('div', { class:'empty', text:'성과를 한 달 이상 기록하면 후보가 나와요.' }) : !cand.length ? h('div', { id:'bz-c-none', class:'note info', text:'네 관점이 모두 양호해요. 지금은 후보가 없고, 다음 달 기록을 기다려요.' }) :
      h('div', {}, cand.map(function (c, i) { return h('div', { class:'stp' }, [h('i', { text:String(i + 1) }), h('div', {}, [h('b', { text:c.title }), h('span', { text:c.persp + ' · ' + c.metric + ' ' + c.base + ' → ' + c.target }), h('div', { class:'rowf' }, [btn('개선안으로 추가', 'quiet', function () { addAct(c); S.msg = '개선안을 Plan 단계로 적어 뒀어요.'; render(); })])])]); }))]));
  var f = S.af, e = S.err; var ps = h('select', { id:'bz-a-persp', 'aria-label':'관점' }, PERSP.map(function (p) { return h('option', { value:p, text:p }); })); ps.value = f.persp; ps.onchange = function () { f.persp = ps.value; };
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'직접 개선안 적기' }),
    h('div', { class:'frm' }, [field('bz-c-title', '개선안', f.title, { err:e.title, max:60, ph:'예: 단골 쿠폰으로 재방문 늘리기', set:function (v) { f.title = v; } }), h('div', { class:'field' }, [h('label', { for:'bz-a-persp', text:'관점(BSC)' }), ps, h('div', { class:'help', text:'' })]), field('bz-c-metric', '측정할 지표', f.metric, { err:e.metric, max:40, ph:'예: 재구매율(%)', set:function (v) { f.metric = v; } }), field('bz-c-base', '시작값', f.base, { err:e.base, max:16, mode:'numeric', set:function (v) { f.base = v; } }), field('bz-c-target', '목표값', f.target, { err:e.target, max:16, mode:'numeric', set:function (v) { f.target = v; } })]),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('Plan으로 적어 두기', 'fill', addManual), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  if (!S.acts.length) { kids.push(empty('아직 개선안이 없어요.')); return kids; }
  kids.push(h('div', { class:'col', style:'margin-top:16px;gap:12px' }, S.acts.map(actCard)));
  return kids;
}
function actCard(x) {
  var ef = x.result !== null && x.target !== null ? effect(x.base, x.target, x.result) : null, done = x.stage === 'Act' && x.result !== null;
  var body = [h('div', { class:'rowf' }, [h('b', { text:x.title }), pill(x.persp, ''), pill(x.round + '회차', ''), pill(x.stage, x.stage === 'Act' ? 'ok' : '')]), h('div', { class:'sub', text:x.metric + ' · 시작 ' + x.base + ' → 목표 ' + (x.target === null ? '미정' : x.target) + (x.result !== null ? ' · 결과 ' + x.result : '') })];
  if (x.stage === 'Plan') { var tin = h('input', { type:'text', value:x.target === null ? '' : String(x.target), inputmode:'numeric', 'aria-label':'목표값', maxlength:'16', placeholder:'목표값' }); tin.onchange = function () { var n = numOf(tin.value); if (isFinite(n) && n !== x.base) { x.target = n; save(); render(); } }; body.push(h('div', { class:'rowf' }, [tin, btn('적용 시작(Do)', 'fill', function () { if (x.target === null || x.target === x.base) { S.err = { title:'목표값을 시작값과 다르게 정한 뒤 적용을 시작하세요.' }; S.msg = ''; return render(); } advance(x); })])); }
  if (x.stage === 'Do') body.push(h('div', { class:'rowf' }, [btn('효과 측정으로(Check)', 'fill', function () { advance(x); })]));
  if (x.stage === 'Check') { var rin = h('input', { type:'text', value:x.result === null ? '' : String(x.result), inputmode:'numeric', 'aria-label':'결과값', maxlength:'16', placeholder:'결과값' }); body.push(h('div', { class:'rowf' }, [rin, btn('결과 기록하고 Act로', 'fill', function () { var n = numOf(rin.value); if (!isFinite(n)) { S.err = { title:'결과값을 숫자로 적어 주세요.' }; S.msg = ''; return render(); } x.result = n; advance(x); })])); }
  if (ef) body.push(h('div', { class:ef.status === '달성' ? 'note info' : 'note', role:'status' }, [h('b', { text:'효과 ' + ef.pct + '% — ' + ef.status }), h('span', { text:ef.status === '달성' ? ' 목표를 이뤘어요. 이 방법을 표준으로 굳히고, 새 목표로 한 바퀴 더 돌릴 수 있어요.' : ef.status === '악화' ? ' 시작값보다 나빠졌어요. 원인을 다시 점검하고 방법을 바꿔 보세요.' : ' 목표에 못 미쳤어요. 원인을 다시 점검해 방법을 고치고 한 바퀴 더 돌려 보세요.' })]));
  if (done) body.push(h('div', { class:'rowf' }, [btn('다음 순환 시작', 'fill', function () { var again = ef && ef.status === '달성'; addAct({ title:x.title.replace(/ \(재개선\)$/, '') + ' (재개선)', persp:x.persp, metric:x.metric, base:x.result, target:again ? null : x.target, round:x.round + 1 }); S.msg = ''; render(); })]));
  body.push(h('div', { class:'rowf' }, [btn('삭제', 'quiet', function () { S.acts = S.acts.filter(function (y) { return y.id !== x.id; }); save(); render(); })]));
  return h('div', { class:'card col', id:'bz-act-' + x.id }, body);
}

// ── 경영 이론 ──
function viewTheory() {
  var kids = head('경영 이론', '널리 알려지고 인정받는 경영학 이론을 사업 판단과 개선에 씁니다.'); kids.push(notice());
  kids.push(table(['이론', '어디에 쓰나요', '화면에서'], rows2([['다섯 가지 힘(마이클 포터)', '산업의 매력도를 경쟁자·진입·대체재·고객·공급자의 압력으로 봐요', '시작 전 판단 ① 시장'], ['SWOT', '강점·약점·기회·위협을 정리해 내 상황을 한눈에 봐요', '시작 전 판단 ② 메모'], ['손익분기점(CVP) 분석', '고정비와 공헌이익으로 얼마를 팔아야 적자를 면하는지 계산해요', '시작 전 판단 ③ 돈'], ['균형성과표(카플란·노턴)', '재무뿐 아니라 고객·내부 프로세스·학습과 성장까지 네 관점으로 성과를 재요', '성과 평가'], ['단위 경제성(LTV/CAC)', '고객 한 명을 얻는 비용과 그가 주는 가치를 견줘요. 3 이상이면 양호하다고 흔히 봐요', '성과 평가 지표'], ['PDCA(데밍 사이클)', '계획·실행·확인·조치를 되풀이하며 개선해요', '개선 순환'], ['OKR의 측정 방식', '목표를 시작값·목표값·결과값으로 재요', '개선안 카드']])));
  kids.push(h('div', { class:'note', style:'margin-top:12px', text:'이론은 판단을 돕는 틀이에요. 같은 입력이라도 산업과 시기에 따라 결과가 달라지므로 판단 결과는 참고용입니다. 사업자 등록·세금·법률은 세무·법률 인프라 AI와 전문가에게 확인하세요.' }));
  kids.push(h('div', { class:'rowf', style:'margin-top:12px' }, [btn('사업 AI에게 묻기', 'quiet', function () { ask('내 사업에 다섯 가지 힘과 SWOT을 어떻게 적용하면 좋을까요?'); })]));
  return kids;
}

function render() {
  var root = $('bz-root'), tp = $('bz-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar()); asOut = null;
  var kids = S.view === 'assess' ? viewAssess() : S.view === 'perf' ? viewPerf() : S.view === 'cycle' ? viewCycle() : S.view === 'theory' ? viewTheory() : viewHome();
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
  M = el; el.textContent = ''; el.classList.add('biz'); S.as = blankAs(); S.recs = []; S.acts = []; S.err = {}; S.msg = ''; S.rf = { month:'', revenue:'', cost:'', marketing:'', customers:'', newc:'', repeat:'', proc:'', learn:'' }; S.af = { title:'', persp:'재무', metric:'', base:'', target:'' }; load();
  [h('div', { id:'bz-top' }), h('div', { class:'wrap', id:'bz-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'home'; render();
}
window.NaviBiz = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  breakEven:breakEven, cashPath:cashPath, assessStart:assessStart, metrics:metrics, bsc:bsc, suggest:suggest, effect:effect,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
