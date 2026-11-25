/* job-app.js — 나비웹 일자리(인프라 AI · 직업). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviJob.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 job.css(.job 범위). 전역은 NaviJob 하나만 쓴다.
 *
 * 일자리 화면의 개념(주피터 지시): 시민 개개인의 적성·능력에 맞는 최적의 업무를 배정하는 인프라이며 한국의 기초수급제도를 확장한다.
 * AI 와 Openhash 기술로 금융·교육·법조 등 사회 전 분야에 대량 실직이 올 수 있다고 보고 사회 안전망을 미리 설계한다.
 * 기초수급제도: 국가가 매달 일정한 생계 급여를 주는 대신 65세 미만 수급자는 국가가 지정하는 사업장 중 한 곳에서 의무적으로 일한다.
 * 2026년 현재 취업 인구의 절반이 실직하는 최악의 고용 대란을 가정해, AI·로봇이 대체할 수 없는 업종에 실직 인구를 언제·어떻게·얼마나 배치할지 도출한다.
 * 이상적으로는 개인의 희망 직종과 사회 총생산이 최대가 되는 두 지점이 만난다.
 * 순서: ① 국가가 소비할 재화·용역의 종류와 수량을 추정 ② AI·로봇으로 만들 수 있는 것과 없는 것으로 분류 ③ 없는 것의 생산에 실직 인구를 배치 — 이 결정은 개인의 적성·능력을 반영하며 그 자료는 교육 인프라(평생 교육, 적성·능력의 객관적 파악)에서 받는다.
 * 이 화면은 입력한 값으로 계산·기록만 한다: humanHours(수요) · supplyOf(공급) · balance(균형) · allocate(분야별 배치) · overlap(희망과 필요의 겹침) · matchPerson(개인 매칭) · rampPlan(연도별 배치).
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 취업 인구·실직률·재화와 용역의 수요량 같은 통계는 연결하지 않았고 모두 사용자가 입력한 가정이다. 결과는 가정을 바꾸면 달라지는 모의 계산이며 예측이나 정책 결정이 아니다.
 *  - 노동 시간의 수요와 공급만 맞춘다. 가격·생산성·지역 분포·기술 변화는 반영하지 않는다.
 *  - 교육 인프라와는 아직 연결되어 있지 않아 개인의 적성·능력 점수는 직접 입력한다. 어떤 일자리도 실제로 배정하거나 지급하지 않는다.
 *  - 의무 근로는 헌법·법률의 문제(근로의 권리와 의무, 강제 노역 금지 등)가 얽혀 있어 법률 판단은 법률 인프라 AI·전문가에게 확인한다. 기록은 이 브라우저(localStorage)에만 저장된다. */
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
var KEY = 'navi-job-v1', MAXI = 40, MAXS = 20;
var TABS = [['me', '내 일자리'], ['demand', '수요 추정'], ['alloc', '인력 할당'], ['plan', '배치 일정'], ['principle', '제도 원리']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var AS = [['employed', '취업 인구(명)'], ['rate', '실직률(%)'], ['share65', '실직자 중 65세 미만 비율(%)'], ['weekly', '주당 의무 근로 시간'], ['weeks', '연간 근무 주 수'], ['wage', '월 생계급여(원, 선택)'], ['startYear', '시작 연도'], ['ramp', '실직이 이르는 기간(년)']];
var W = { apt:0.4, pref:0.3, need:0.3 };
var M = null, LS = {};
function blankAs() { return { employed:'', rate:'', share65:'', weekly:'', weeks:'', wage:'', startYear:'', ramp:'' }; }
var S = { view:'me', items:[], as:blankAs(), pref:{}, me:{ apt:{}, pref:{} }, f:{ name:'', sector:'', qty:'', hpu:'', auto:'' }, err:{}, msg:'' };
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
    h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 직업' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function notice() {
  return h('div', { class:'note info', style:'margin:16px 0', id:'jb-note', text:'이 화면은 내가 입력한 가정으로 노동 시간의 수요와 공급을 맞춰 보는 모의 계산이며 예측이나 정책 결정이 아니에요. 취업 인구·실직률·수요 같은 통계는 연결하지 않았고, 교육 인프라와도 아직 연결되지 않아 적성 점수는 직접 넣어요. 일자리를 실제로 배정하거나 급여를 지급하지 않고, 적은 내용은 이 브라우저에만 저장됩니다.' });
}
function rows2(rows) { return rows.map(function (r) { return h('tr', {}, r.map(function (t, i) { return h(i ? 'td' : 'th', { text:t }); })); }); }
function nf(n) { return n === null || n === undefined || !isFinite(n) ? '—' : Math.round(n).toLocaleString('ko-KR'); }
function pc(x) { return x === null || x === undefined || !isFinite(x) ? '—' : Math.round(x * 1000) / 10 + '%'; }

// ── 계산 ──
function cleanName(s, n) { return clean(s, n); }
/** 수요: 품목별 연간 수요량 × 단위당 노동 시간 × (1 − AI·로봇 대체 비율). 분야별 사람 노동 시간과 비중을 돌려준다. 품목이 없거나 값이 틀리면 null. */
function humanHours(items) {
  if (!Array.isArray(items) || !items.length) return null; var by = {}, total = 0, i, x, q, hp, au;
  for (i = 0; i < items.length; i++) { x = items[i]; q = Number(x && x.qty); hp = Number(x && x.hpu); au = Number(x && x.auto);
    if (!x || !cleanName(x.sector, 20) || !isFinite(q) || q <= 0 || q > 1e15 || !isFinite(hp) || hp <= 0 || hp > 1e6 || !isFinite(au) || au < 0 || au > 100) return null;
    var hrs = q * hp * (1 - au / 100); by[x.sector] = (by[x.sector] || 0) + hrs; total += hrs; }
  var rows = Object.keys(by).filter(function (k) { return by[k] > 0; }).map(function (k) { return { sector:k, hours:by[k], share:by[k] / total }; }).sort(function (a, b) { return b.hours - a.hours; });
  return { total:total, rows:rows };
}
function pctOk(v) { var n = Number(v); return isFinite(n) && n >= 0 && n <= 100; }
/** 공급: 실직자 = 취업 인구 × 실직률, 의무 대상 = 그중 65세 미만, 한 사람의 연간 의무 근로 시간 = 주당 시간 × 근무 주 수. */
function supplyOf(a) {
  if (!a) return null; var e = numOf(a.employed), r = numOf(a.rate), s = numOf(a.share65), w = numOf(a.weekly), k = numOf(a.weeks);
  if (!isFinite(e) || e <= 0 || e > 1e10 || !pctOk(r) || !pctOk(s) || !isFinite(r) || !isFinite(s) || !isFinite(w) || w <= 0 || w > 60 || !isFinite(k) || k < 1 || k > 52) return null;
  var un = Math.round(e * r / 100), el = Math.round(un * s / 100); return { unemployed:un, eligible:el, perYear:w * k, hours:el * w * k };
}
/** 균형: 필요한 인원(수요 시간 ÷ 한 사람의 연간 시간)과 의무 대상 인원을 견준다. 0.9 미만 인력 부족, 1.1 이하 균형, 그 초과 인력 여유. */
function balance(totalHours, sup) {
  if (!sup || !isFinite(totalHours) || totalHours < 0 || sup.perYear <= 0) return null; var need = Math.ceil(totalHours / sup.perYear); if (need === 0) return { need:0, eligible:sup.eligible, ratio:null, gap:-sup.eligible, verdict:'수요 없음' };
  var ratio = sup.eligible / need; return { need:need, eligible:sup.eligible, ratio:ratio, gap:need - sup.eligible, verdict:ratio < 0.9 ? '인력 부족' : ratio <= 1.1 ? '균형' : '인력 여유' };
}
/** 분야별 배치: 배치할 사람 수를 수요 시간 비중대로 나누고 합이 정확히 맞도록 반올림한다(최대 잔여). */
function allocate(rows, persons) {
  if (!Array.isArray(rows) || !rows.length || !isFinite(persons) || persons < 0 || Math.floor(persons) !== persons) return null; var raw = rows.map(function (r) { return r.share * persons; }), base = raw.map(Math.floor), left = persons - base.reduce(function (s, x) { return s + x; }, 0);
  raw.map(function (x, i) { return [x - Math.floor(x), i]; }).sort(function (a, b) { return b[0] - a[0] || a[1] - b[1]; }).slice(0, left).forEach(function (p) { base[p[1]] += 1; });
  return rows.map(function (r, i) { return { sector:r.sector, persons:base[i], share:r.share }; });
}
/** 희망과 필요의 겹침: 분야별 희망 비중(합 100%)과 수요 비중 중 작은 쪽을 더한다. 1 이면 희망과 필요가 완전히 겹친다. 희망 합이 100 이 아니거나 값이 틀리면 null. */
function overlap(rows, prefs) {
  if (!Array.isArray(rows) || !rows.length || !prefs) return null; var sum = 0, ov = 0, out = [];
  for (var i = 0; i < rows.length; i++) { var p = numOf(prefs[rows[i].sector]); if (!isFinite(p) || p < 0 || p > 100) return null; sum += p; }
  if (Math.abs(sum - 100) > 0.5) return null;
  rows.forEach(function (r) { var ps = numOf(prefs[r.sector]) / 100; ov += Math.min(ps, r.share); out.push({ sector:r.sector, demand:r.share, pref:ps, diff:ps - r.share }); });
  return { overlap:ov, rows:out };
}
/** 개인 매칭: 점수 = 0.4×적성 + 0.3×희망 + 0.3×사회적 필요(수요 비중 ÷ 희망 비중, 최대 1). 적성·희망은 0~5 정수이고 모든 분야에 있어야 한다. 점수 높은 순. */
function matchPerson(rows, prefs, person, w) {
  if (!Array.isArray(rows) || !rows.length || !person || !person.apt || !person.pref) return null; var wt = w || W; var out = [];
  for (var i = 0; i < rows.length; i++) { var s = rows[i].sector, a = person.apt[s], p = person.pref[s]; if (a === '' || p === '' || a === undefined || p === undefined || !(a >= 0 && a <= 5) || !(p >= 0 && p <= 5) || Math.floor(a) !== a || Math.floor(p) !== p) return null;
    var ps = prefs && prefs[s] !== undefined && prefs[s] !== '' ? numOf(prefs[s]) / 100 : null, need = ps === null || !isFinite(ps) || ps <= 0 ? 1 : Math.min(1, rows[i].share / ps);
    out.push({ sector:s, apt:a, pref:p, need:need, score:wt.apt * a / 5 + wt.pref * p / 5 + wt.need * need }); }
  return out.sort(function (x, y) { return y.score - x.score; });
}
/** 연도별 배치: 실직률이 시작 연도부터 기간 동안 직선으로 최종 실직률에 이른다고 가정하고, 해마다 의무 대상 중 필요 인원까지 배치하고 나머지는 대기·재교육으로 둔다. 월 급여가 있으면 연간 급여 총액도 계산한다. */
function rampPlan(o) {
  if (!o) return null; var e = numOf(o.employed), r = numOf(o.rate), s = numOf(o.share65), y0 = numOf(o.startYear), n = numOf(o.ramp), need = Number(o.need), wage = o.wage === '' || o.wage === undefined ? null : numOf(o.wage);
  if (!isFinite(e) || e <= 0 || !pctOk(r) || !pctOk(s) || !isFinite(r) || !isFinite(s) || !isFinite(y0) || y0 < 2000 || y0 > 2200 || Math.floor(y0) !== y0 || !isFinite(n) || n < 1 || n > 30 || Math.floor(n) !== n || !isFinite(need) || need < 0 || (wage !== null && (!isFinite(wage) || wage < 0))) return null;
  var out = []; for (var k = 1; k <= n; k++) { var un = Math.round(e * r / 100 * k / n), el = Math.round(un * s / 100), pl = Math.min(el, Math.ceil(need)); out.push({ year:y0 + k - 1, unemployed:un, eligible:el, placed:pl, waiting:el - pl, cost:wage === null ? null : el * wage * 12 }); }
  return out;
}

function load() {
  try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v || typeof v !== 'object') return;
    S.items = (Array.isArray(v.items) ? v.items : []).map(function (x) { if (!x || typeof x !== 'object') return null; var n = cleanName(x.name, 40), sec = cleanName(x.sector, 20), q = Number(x.qty), hp = Number(x.hpu), au = Number(x.auto); return n && sec && q > 0 && hp > 0 && au >= 0 && au <= 100 ? { id:cleanName(x.id, 20) || uid(), name:n, sector:sec, qty:q, hpu:hp, auto:au } : null; }).filter(Boolean).slice(0, MAXI);
    if (v.as && typeof v.as === 'object') AS.forEach(function (a) { S.as[a[0]] = clean(v.as[a[0]], 20); });
    if (v.pref && typeof v.pref === 'object') Object.keys(v.pref).slice(0, MAXS).forEach(function (k) { S.pref[clean(k, 20)] = clean(v.pref[k], 6); });
    ['apt', 'pref'].forEach(function (g) { var o = v.me && v.me[g]; if (o && typeof o === 'object') Object.keys(o).slice(0, MAXS).forEach(function (k) { var n = o[k]; S.me[g][clean(k, 20)] = n === '' ? '' : (Number(n) >= 0 && Number(n) <= 5 && Math.floor(Number(n)) === Number(n) ? Number(n) : ''); }); }); } catch (e) {}
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ items:S.items, as:S.as, pref:S.pref, me:S.me })); } catch (e) {} }
function demand() { return humanHours(S.items); }

// ── 수요 추정 ──
function addItem() {
  var f = S.f, e = {}, n = cleanName(f.name, 40), sec = cleanName(f.sector, 20), q = numOf(f.qty), hp = numOf(f.hpu), au = numOf(f.auto);
  if (!n) e.name = '품목 이름을 적어 주세요.'; if (!sec) e.sector = '분야를 적어 주세요(예: 돌봄).'; if (!isFinite(q) || q <= 0) e.qty = '연간 수요량을 0보다 큰 숫자로 적어 주세요.'; if (!isFinite(hp) || hp <= 0) e.hpu = '단위당 노동 시간을 0보다 큰 숫자로 적어 주세요.'; if (!isFinite(au) || au < 0 || au > 100) e.auto = '대체 가능 비율을 0~100 사이로 적어 주세요.'; if (S.items.length >= MAXI) e.name = '품목은 최대 ' + MAXI + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); } S.items.push({ id:uid(), name:n, sector:sec, qty:q, hpu:hp, auto:au }); f.name = ''; f.qty = ''; f.hpu = ''; f.auto = ''; S.msg = '품목을 적어 뒀어요.'; save(); render();
}
function viewDemand() {
  var kids = head('수요 추정', '국가가 쓸 재화와 용역의 종류·수량을 적고, 그중 AI·로봇이 만들 수 있는 몫을 빼면 사람이 해야 할 노동이 남습니다.'); kids.push(notice());
  var f = S.f, e = S.err;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'재화·용역 품목' }), h('div', { class:'sub', text:'AI·로봇 대체 비율이 0%면 사람만 할 수 있는 일, 100%면 전부 대체되는 일이에요. 값은 모두 내가 정하는 가정이에요.' }),
    h('div', { class:'frm' }, [field('jb-i-name', '품목', f.name, { err:e.name, max:40, ph:'예: 노인 방문 돌봄', set:function (v) { f.name = v; } }), field('jb-i-sector', '분야', f.sector, { err:e.sector, max:20, ph:'예: 돌봄', set:function (v) { f.sector = v; } }), field('jb-i-qty', '연간 수요량(단위 수)', f.qty, { err:e.qty, max:16, mode:'numeric', set:function (v) { f.qty = v; } }), field('jb-i-hpu', '단위당 필요한 노동 시간', f.hpu, { err:e.hpu, max:10, mode:'numeric', set:function (v) { f.hpu = v; } }), field('jb-i-auto', 'AI·로봇 대체 가능 비율(%)', f.auto, { err:e.auto, max:3, mode:'numeric', set:function (v) { f.auto = v; } })]),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('품목 추가', 'fill', addItem), btn('직업 AI에게 묻기', 'quiet', function () { ask('AI와 로봇이 대체하기 어려운 일은 어떤 분야이고, 그 노동 수요를 어떻게 추정하면 좋을까요?'); }), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  if (!S.items.length) { kids.push(empty('아직 품목이 없어요.')); return kids; }
  kids.push(table(['품목', '분야', '연간 수요', '단위당 시간', '대체', '사람 노동 시간', ''], S.items.map(function (x) { return h('tr', {}, [h('th', { text:x.name }), h('td', { text:x.sector }), h('td', { class:'num', text:nf(x.qty) }), h('td', { class:'num', text:String(x.hpu) }), h('td', { class:'num', text:x.auto + '%' }), h('td', { class:'num', text:nf(x.qty * x.hpu * (1 - x.auto / 100)) }), h('td', {}, [btn('삭제', 'quiet', function () { S.items = S.items.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]); })));
  var d = demand(); if (d) { kids.push(h('div', { class:'g2', style:'margin-top:16px' }, [tile('사람이 해야 할 노동', nf(d.total) + '시간/년', '대체되지 않는 몫의 합', 'jb-d-total'), tile('분야', d.rows.length + '개', d.rows.length ? '가장 큰 분야: ' + d.rows[0].sector : '모두 대체되는 가정이에요', 'jb-d-n')])); if (d.rows.length) kids.push(table(['분야', '노동 시간', '비중'], d.rows.map(function (r) { return h('tr', {}, [h('th', { text:r.sector }), h('td', { class:'num', text:nf(r.hours) }), h('td', { class:'num', text:pc(r.share) })]); }))); }
  return kids;
}

// ── 인력 할당 ──
var aOut = null;
function updA() {
  if (!aOut) return; aOut.textContent = ''; var d = demand(), sup = supplyOf(S.as);
  if (!d || !d.rows.length) { aOut.appendChild(h('div', { class:'note', id:'jb-a-nod', text:'먼저 「수요 추정」에서 사람이 해야 할 노동이 남는 품목을 한 개 이상 적어 주세요.' })); return; }
  if (!sup) { aOut.appendChild(h('div', { class:'note', id:'jb-a-nos', text:'취업 인구·실직률·65세 미만 비율·주당 의무 시간·연간 근무 주 수를 모두 넣어 주세요(비율은 0~100).' })); return; }
  var b = balance(d.total, sup), alloc = allocate(d.rows, Math.min(sup.eligible, b.need));
  aOut.appendChild(h('div', { class:'g2' }, [tile('실직자(가정)', nf(sup.unemployed) + '명', '취업 인구 × 실직률', 'jb-a-un'), tile('의무 대상(65세 미만)', nf(sup.eligible) + '명', '급여를 받으며 일할 사람', 'jb-a-el'), tile('필요한 인원', nf(b.need) + '명', '수요 시간 ÷ 1인 연간 ' + sup.perYear + '시간', 'jb-a-need'), tile('균형', b.verdict, b.ratio === null ? '' : '대상/필요 = ' + Math.round(b.ratio * 100) / 100, 'jb-a-v')]));
  aOut.appendChild(h('div', { class:b.verdict === '균형' ? 'note info' : 'note', style:'margin-top:12px', id:'jb-a-msg', text:b.verdict === '인력 부족' ? nf(b.gap) + '명이 모자라요. 의무 근로 시간을 늘리거나, 대체 가능 비율을 다시 보거나, 65세 이상·다른 대상의 자발적 참여를 따져 보세요.' : b.verdict === '인력 여유' ? nf(-b.gap) + '명이 남아요. 근로 시간을 줄이거나, 교육·재훈련으로 돌리거나, 수요가 더 있는 분야를 찾아 보세요.' : b.verdict === '균형' ? '필요한 인원과 의무 대상이 비슷해요.' : '사람이 해야 할 노동 수요가 없어요.' }));
  aOut.appendChild(table(['분야', '노동 시간', '비중', '배치 인원'], alloc.map(function (r, i) { return h('tr', {}, [h('th', { text:r.sector }), h('td', { class:'num', text:nf(d.rows[i].hours) }), h('td', { class:'num', text:pc(r.share) }), h('td', { class:'num', text:nf(r.persons) + '명' })]); })));
  var ov = overlap(d.rows, S.pref);
  aOut.appendChild(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'희망 직종과 사회의 필요' }), h('div', { class:'sub', text:'분야별로 시민이 희망하는 비중(%)을 넣어요(합 100). 희망과 필요가 겹칠수록 이상적이에요.' }),
    h('div', { class:'frm' }, d.rows.map(function (r) { return field('jb-p-' + r.sector, r.sector + ' 희망 비중(%)', S.pref[r.sector] === undefined ? '' : S.pref[r.sector], { max:6, mode:'numeric', set:function (v) { S.pref[r.sector] = clean(v, 6); save(); updOv(); } }); })), h('div', { id:'jb-a-ov' })]));
  updOv();
}
function updOv() {
  var box = aOut && aOut.querySelector('#jb-a-ov'); if (!box) return; box.textContent = ''; var d = demand(), ov = d ? overlap(d.rows, S.pref) : null;
  if (!ov) { box.appendChild(h('div', { class:'sub', id:'jb-ov-none', text:'모든 분야의 희망 비중을 넣고 합이 100이 되면 겹침을 계산해요.' })); return; }
  box.appendChild(h('div', { class:'g2' }, [tile('희망과 필요의 겹침', pc(ov.overlap), '100%면 희망과 필요가 같아요', 'jb-ov')]));
  box.appendChild(table(['분야', '필요 비중', '희망 비중', '차이'], ov.rows.map(function (r) { var d2 = Math.round(r.diff * 1000) / 10; return h('tr', {}, [h('th', { text:r.sector }), h('td', { class:'num', text:pc(r.demand) }), h('td', { class:'num', text:pc(r.pref) }), h('td', { class:'num', text:(d2 > 0 ? '+' : '') + d2 + '%p' + (d2 > 0 ? ' (희망 초과)' : d2 < 0 ? ' (일손 부족)' : '') })]); })));
}
function viewAlloc() {
  var kids = head('인력 할당', '실직 인구를 AI·로봇이 대체하지 못하는 분야에 얼마나 어떻게 배치할지 계산합니다.'); kids.push(notice());
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'가정' }), h('div', { class:'frm' }, AS.slice(0, 5).map(function (a) { return field('jb-s-' + a[0], a[1], S.as[a[0]], { max:14, mode:'numeric', ph:a[0] === 'employed' ? '통계로 확인해 입력' : a[0] === 'rate' ? '예: 50(최악 가정)' : '', set:function (v) { S.as[a[0]] = clean(v, 20); save(); updA(); } }); }))]));
  aOut = h('div', { id:'jb-a-out', style:'margin-top:16px' }); kids.push(aOut); updA(); return kids;
}

// ── 배치 일정 ──
var pOut = null;
function updP() {
  if (!pOut) return; pOut.textContent = ''; var d = demand(), sup = supplyOf(S.as);
  if (!d || !d.rows.length || !sup) { pOut.appendChild(h('div', { class:'note', id:'jb-p-none', text:'「수요 추정」과 「인력 할당」의 가정을 먼저 넣어 주세요.' })); return; }
  var b = balance(d.total, sup), rows = rampPlan({ employed:S.as.employed, rate:S.as.rate, share65:S.as.share65, startYear:S.as.startYear, ramp:S.as.ramp, need:b.need, wage:S.as.wage });
  if (!rows) { pOut.appendChild(h('div', { class:'note', id:'jb-p-bad', text:'시작 연도(2000~2200)와 실직이 이르는 기간(1~30년)을 넣어 주세요. 월 생계급여는 비워도 돼요.' })); return; }
  pOut.appendChild(table(['연도', '실직자', '의무 대상', '배치', '대기·재교육', '연 급여 총액'], rows.map(function (r) { return h('tr', {}, [h('th', { class:'num', text:String(r.year) }), h('td', { class:'num', text:nf(r.unemployed) }), h('td', { class:'num', text:nf(r.eligible) }), h('td', { class:'num', text:nf(r.placed) }), h('td', { class:'num', text:nf(r.waiting) }), h('td', { class:'num', text:r.cost === null ? '—' : nf(r.cost) + '원' })]); })));
  var last = rows[rows.length - 1]; pOut.appendChild(h('div', { class:'sub', style:'margin-top:8px', id:'jb-p-sum', text:last.year + '년에 의무 대상 ' + nf(last.eligible) + '명 중 ' + nf(last.placed) + '명을 배치하고 ' + nf(last.waiting) + '명은 대기·재교육이에요.' + (last.cost === null ? '' : ' 급여 재원 조달은 이 화면이 다루지 않아요.') }));
}
function viewPlan() {
  var kids = head('배치 일정', '실직이 늘어나는 속도에 따라 해마다 얼마나 배치할 수 있는지 봅니다. 실직은 직선으로 는다고 가정해요.'); kids.push(notice());
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('div', { class:'frm' }, AS.slice(5).map(function (a) { return field('jb-s-' + a[0], a[1], S.as[a[0]], { max:12, mode:'numeric', ph:a[0] === 'startYear' ? '예: 2027' : '', set:function (v) { S.as[a[0]] = clean(v, 20); save(); updP(); } }); }))]));
  pOut = h('div', { id:'jb-p-out', style:'margin-top:16px' }); kids.push(pOut); updP(); return kids;
}

// ── 내 일자리 ──
function viewMe() {
  var kids = head('내 일자리', '내 적성·능력과 희망, 사회의 필요를 함께 놓고 어느 분야가 잘 맞는지 봅니다.'); kids.push(notice()); var d = demand();
  if (!d || !d.rows.length) return kids.concat([empty('먼저 「수요 추정」에서 사람이 해야 할 노동이 남는 분야를 적어 주세요.', btn('수요 추정으로', 'fill', function () { go('demand'); }))]);
  var sel = function (g, sector, label) { var s = h('select', { id:'jb-m-' + g + '-' + sector, 'aria-label':sector + ' ' + label }, [h('option', { value:'', text:'선택' })].concat([0, 1, 2, 3, 4, 5].map(function (n) { return h('option', { value:String(n), text:String(n) }); }))); s.value = S.me[g][sector] === undefined || S.me[g][sector] === '' ? '' : String(S.me[g][sector]); s.onchange = function () { S.me[g][sector] = s.value === '' ? '' : Number(s.value); save(); updM(); }; return s; };
  kids.push(table(['분야', '내 적성·능력(0~5)', '내 희망(0~5)'], d.rows.map(function (r) { return h('tr', {}, [h('th', { text:r.sector }), h('td', {}, [sel('apt', r.sector, '적성')]), h('td', {}, [sel('pref', r.sector, '희망')])]); })));
  kids.push(h('div', { class:'sub', style:'margin-top:8px', text:'적성·능력은 원래 교육 인프라가 객관적으로 파악해 주는 값이에요. 아직 연결되지 않아 지금은 내가 직접 넣어요.' }));
  kids.push(h('div', { id:'jb-m-out', style:'margin-top:16px' })); kids.push(h('div', { class:'rowf', style:'margin-top:12px' }, [btn('교육 AI에게 묻기', 'quiet', function () { ask('내 적성과 능력을 객관적으로 파악하려면 어떤 검사나 학습 기록이 필요한가요?'); })]));
  return kids;
}
function updM() {
  var box = M && M.querySelector('#jb-m-out'); if (!box) return; box.textContent = ''; var d = demand(); if (!d) return; var r = matchPerson(d.rows, S.pref, S.me, W);
  if (!r) { box.appendChild(h('div', { class:'note', id:'jb-m-none', text:'모든 분야의 적성과 희망을 고르면 추천 순서가 나와요.' })); return; }
  box.appendChild(table(['순위', '분야', '점수', '적성', '희망', '사회적 필요'], r.map(function (x, i) { return h('tr', {}, [h('td', { class:'num', text:String(i + 1) }), h('th', { text:x.sector }), h('td', { class:'num', text:Math.round(x.score * 100) + '점' }), h('td', { class:'num', text:String(x.apt) }), h('td', { class:'num', text:String(x.pref) }), h('td', { class:'num', text:pc(x.need) })]); })));
  box.appendChild(h('div', { class:'sub', style:'margin-top:8px', id:'jb-m-top', text:'1순위는 ' + r[0].sector + '이에요. 점수 = 적성 40% + 희망 30% + 사회적 필요 30%(수요 비중 ÷ 희망 비중, 최대 100%)로 계산한 참고 순서이며 실제 배정이 아니에요. 사회적 필요는 「인력 할당」에서 희망 비중을 넣으면 반영돼요.' }));
}

// ── 제도 원리 ──
function viewPrinciple() {
  var kids = head('제도 원리', 'AI와 Openhash 기술이 일자리를 바꾸는 시대의 사회 안전망을 미리 설계합니다.'); kids.push(notice());
  kids.push(stepsCard('일자리 인프라의 순서', [['소비할 재화·용역 추정', '국가가 쓸 재화와 용역의 종류와 수량을 추정해요.'], ['AI·로봇으로 가능한지 분류', '만들 수 있는 것과 없는 것으로 나눠요.'], ['사람이 해야 할 일에 배치', '없는 것의 생산에 실직 인구를 언제·어떻게·얼마나 배치할지 정해요.'], ['개인의 적성·능력 반영', '교육 인프라가 평생 교육으로 적성과 능력을 객관적으로 파악해 알려 줘요.'], ['희망과 총생산이 만나는 곳', '이상적으로는 개인의 희망 직종과 사회 총생산이 최대가 되는 두 지점이 만나요.']]));
  kids.push(table(['기초수급제도 확장안', '내용'], rows2([['급여', '국가가 매달 일정한 생계 급여를 지급해요.'], ['의무 근로', '65세 미만 수급자는 국가가 지정하는 사업장 중 한 곳에서 일해요(사업장은 선택).'], ['대상 업종', 'AI와 로봇이 대체할 수 없는 업종에 배치해요.'], ['개인 반영', '적성·능력(교육 인프라)과 희망 직종을 함께 봐요.']])));
  kids.push(table(['따져 볼 쟁점', '내용'], rows2([['법적 근거', '의무 근로는 법률로 정해야 하고, 근로의 권리·의무(헌법 제32조)와 강제 노역 금지(헌법 제12조 제1항)가 얽혀 있어요.'], ['현행 제도', '지금도 근로 능력이 있는 수급자에게 자활 사업 참여를 조건으로 하는 제도가 있는 것으로 알려져 있어요. 확인이 필요해요.'], ['예외와 보호', '질병·장애·양육·돌봄 같은 사정과 노동 안전, 적정한 처우를 어떻게 보장할지 정해야 해요.'], ['선택권', '지정 사업장 중 고를 수 있어야 하고, 배치를 이의 신청할 길이 필요해요.'], ['재원', '급여 재원은 이 화면이 다루지 않아요.'], ['모델의 한계', '노동 시간의 수요와 공급만 맞춰요. 가격·생산성·지역 분포·기술 변화는 반영하지 않아요.']])));
  kids.push(h('div', { class:'note', style:'margin-top:12px', text:'법률 판단은 이 화면이 대신하지 않아요. 법률 인프라 AI와 전문가에게 확인하세요.' }));
  kids.push(h('div', { class:'rowf', style:'margin-top:12px' }, [btn('직업 AI에게 묻기', 'quiet', function () { ask('대량 실직에 대비한 기초수급과 의무 근로 설계에서 가장 먼저 풀어야 할 문제는 무엇인가요?'); })]));
  return kids;
}

/* 나비웹 도우미로 기관 사이트 조회 열기 — 로그인·인증은 사용자, 조회까지만 한다. 호스트는 NaviJob.agentResult(ok, msg) 로 결과를 돌려준다. */
var AG = [["work24", "채용정보 찾기(고용24)", "https://www.work24.go.kr"], ["ei", "내 고용보험 가입 이력 조회", "https://www.ei.go.kr"]], AGG = {"work24": "고용24에서 내 희망 직종의 채용정보 조회", "ei": "고용보험에서 내 가입 이력 조회"};
function agentResult(ok, msg) { S.agMsg = clean(msg, 160) || (ok ? '도우미가 시작합니다.' : '도우미에 맡기지 못했어요.'); render(); }
function handOff() {
  var it = AG.filter(function (x) { return x[0] === S.ag; })[0] || AG[0];
  S.agMsg = '도우미에 맡기는 중…'; render();
  if (!(LS.agent && LS.agent.length)) return agentResult(false, '나비웹 도우미를 쓸 수 없는 화면이에요.');
  emit('agent', { kind:it[0], label:it[1], url:it[2], goal:AGG[it[0]] });
}
function agentCard() {
  var s = h('select', { id:'jb-ag', 'aria-label':'도우미로 열 사이트' }, AG.map(function (x) { return h('option', { value:x[0], text:x[1] }); })); s.value = S.ag || AG[0][0]; s.onchange = function () { S.ag = s.value; };
  return h('div', { class:'card col', id:'jb-agent', style:'margin-top:12px' }, [h('b', { text:'일자리 조회는 도우미에게 (나비웹 도우미)' }),
    h('div', { class:'sub', text:'채용정보나 내 고용보험 이력을 도우미가 해당 사이트에서 열어 줍니다. 로그인·인증서는 내가 하고, 조회까지만 해요. 입사 지원과 신청서 제출은 하지 않아요.' }),
    h('div', { class:'rowf' }, [s, btn('도우미로 열기', '', handOff)]),
    S.agMsg ? h('div', { class:'sub', id:'jb-ag-msg', text:S.agMsg }) : null]);
}
function render() {
  var root = $('jb-root'), tp = $('jb-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar()); aOut = null; pOut = null;
  var kids = S.view === 'demand' ? viewDemand() : S.view === 'alloc' ? viewAlloc() : S.view === 'plan' ? viewPlan() : S.view === 'principle' ? viewPrinciple() : viewMe();
  if (S.view === 'me' || !S.view) kids.push(agentCard());
  kids.forEach(function (k) { if (k) root.appendChild(k); }); if (S.view === 'me') updM();
}
function reply(ok, msg) { emit('result', { ok:ok, msg:msg, view:S.view }); }
function nav(a) {
  var d = a && typeof a['do'] === 'string' ? a['do'] : '';
  if (VIEWS.indexOf(d) >= 0) { go(d); return reply(true, TABS[VIEWS.indexOf(d)][1] + ' 화면으로 이동했습니다.'); }
  return reply(false, '지원하지 않는 요청입니다.');
}
function mount(el, o) {
  if (!el) return; o = o || {};
  M = el; el.textContent = ''; el.classList.add('job'); S.items = []; S.as = blankAs(); S.pref = {}; S.me = { apt:{}, pref:{} }; S.err = {}; S.msg = ''; S.f = { name:'', sector:'', qty:'', hpu:'', auto:'' }; load();
  [h('div', { id:'jb-top' }), h('div', { class:'wrap', id:'jb-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'me'; render();
}
window.NaviJob = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  humanHours:humanHours, supplyOf:supplyOf, balance:balance, allocate:allocate, overlap:overlap, matchPerson:matchPerson, rampPlan:rampPlan,
  agentResult:function (ok, msg) { if (M) agentResult(!!ok, msg); },
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
