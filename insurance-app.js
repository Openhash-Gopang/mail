/* insurance-app.js — 나비웹 보험(인프라 AI · 보험). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviInsure.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 insurance.css(.ins 범위). 전역은 NaviInsure 하나만 쓴다.
 *
 * 보험 화면의 특징(주피터 지시, 설계 원칙): 나비웹은 사용자의 일상과 업무를 하루 24시간·1년 365일 기록하므로 이상적인 보험 요율을 계산할 수 있다.
 *  사용자는 모든 데이터를 공개하지 않고 보험 상품이 요구하는 특정 데이터만 제공한다. 보험사의 사람 직원은 개개인의 데이터를 볼 수 없고 나비웹 보험 인프라 AI만 접근하며, 모든 데이터는 익명화된다.
 *  생명·재난·상해·교육·의료·해상 등 모든 상품은 가입자 총수, 보험료 총액, 가입자 각각의 활동을 입력으로 요율이 정해지고, 나비웹의 최소 운영비만 청구한다.
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 위 원칙은 아직 설계 단계다. 지금은 보험 상품 판매·가입·청구 접수·데이터 제공 기능이 연결되어 있지 않다. 이 화면은 어떤 데이터도 어디로 보내지 않는다.
 *  - '요율 원리' 탭은 사용자가 넣은 가정(가입자 수·예상 보험금·운영비율·내 위험도)으로 같은 방식의 산식을 계산해 보여 줄 뿐이며, 실제 보험료가 아니다.
 *  - '내 보험'·'청구 기록'은 사용자가 직접 적는 기록이고 이 브라우저(localStorage)에만 저장된다. 특정 보험 가입을 권하지 않는다.
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
var KEY = 'navi-insure-v1', MAXI = 100, MAXC = 300;
var TABS = [['mine', '내 보험'], ['rate', '요율 원리'], ['data', '상품과 공개 데이터'], ['claims', '청구 기록'], ['learn', '점검·용어']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var KINDS = ['생명', '재난', '상해', '교육', '의료', '해상', '기타'];
var CORE = ['생명', '재난', '상해', '의료'];
var STATES = ['준비 중', '접수', '심사 중', '지급 완료', '거절·보류'];
/** 상품별로 요율 계산에 필요하다고 설계한 데이터(예시). 사용자는 항목마다 공개 여부를 정한다. */
var NEED = {
  '생명': [['연령대', '나이를 구간으로만 씁니다'], ['수면·활동 시간 요약', '하루 평균 수면·활동 시간대'], ['위험 활동 여부', '위험 직업·활동을 하는지 예/아니오'], ['건강검진 이행 요약', '정기검진을 받았는지']],
  '재난': [['거주 지역(시·군 단위)', '정확한 주소는 쓰지 않습니다'], ['건물 유형·연식', '아파트·단독·상가 등'], ['방재 설비 유무', '소화기·경보기·배수 설비 등']],
  '상해': [['이동 수단·시간', '출퇴근·이동 시간대 요약'], ['업무 위험도', '현장·사무 등 업무 유형'], ['운동 종목·빈도', '위험 종목 여부']],
  '교육': [['학습 시간·꾸준함', '학습 기록 요약'], ['진도·성취 요약', '과목별 평가 요약']],
  '의료': [['연령대', '나이를 구간으로만 씁니다'], ['진료 이용 빈도 요약', '횟수 구간만'], ['생활습관 요약', '식사·운동·수면 요약']],
  '해상': [['운항 구역·기간', '항로와 시기'], ['선박 종류·연식', ''], ['화물 종류', '']]
};
var CHECKS = ['지금 가입한 보험의 보장 내용과 보험료를 한 번이라도 정리해 보았나요?', '내가 지불하는 월 보험료 합계를 알고 있나요?', '같은 위험을 보장하는 보험이 겹쳐 있지 않은지 확인했나요?', '보험금을 청구할 때 필요한 서류가 무엇인지 알고 있나요?', '보장에서 빠지는 경우(면책)를 읽어 보았나요?', '만기·갱신 날짜를 적어 두었나요?'];
var GLOSS = [['보험료', '보험에 가입한 사람이 내는 돈입니다.'], ['보험금', '사고가 나면 보험이 지급하는 돈입니다.'], ['요율', '보험료를 정하는 비율입니다. 위험이 클수록 높게 정해집니다.'], ['순보험료', '앞으로 지급할 보험금을 충당하기 위한 보험료 부분입니다.'], ['부가보험료', '보험을 운영하는 데 드는 비용(사업비 등)을 충당하는 보험료 부분입니다.'], ['면책', '보험금을 지급하지 않는 경우입니다. 약관에 적혀 있습니다.'], ['자기부담금', '사고가 났을 때 가입자가 직접 내는 금액입니다.'], ['갱신', '만기 때 같은 보험을 이어 가입하는 것입니다. 보험료가 달라질 수 있습니다.'], ['중복 보험', '같은 위험을 여러 보험으로 보장받는 상태입니다. 실손 보장은 보험금이 비례해서 나뉘기도 합니다.'], ['익명화', '누구의 데이터인지 알 수 없게 바꾸는 처리입니다.']];
var M = null, LS = {};
var S = { view:'mine', ins:[], claims:[], share:{}, rate:{ n:'10000', claims:'', op:'5', risk:'1', cmp:'' }, checks:{}, form:{ kind:'생명' }, cform:{ state:'준비 중' }, err:{}, msg:'', gq:'' };

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
    S.ins = (Array.isArray(v.ins) ? v.ins : []).map(fixIns).filter(Boolean).slice(0, MAXI);
    var ids = S.ins.map(function (x) { return x.id; });
    S.claims = (Array.isArray(v.claims) ? v.claims : []).map(fixClaim).filter(Boolean).slice(0, MAXC);
    if (v.share && typeof v.share === 'object') Object.keys(NEED).forEach(function (k) { if (v.share[k] && typeof v.share[k] === 'object') NEED[k].forEach(function (_, i) { if (v.share[k][i]) (S.share[k] = S.share[k] || {})[i] = 1; }); });
    if (v.rate && typeof v.rate === 'object') Object.keys(S.rate).forEach(function (k) { if (typeof v.rate[k] === 'string') S.rate[k] = v.rate[k].slice(0, 16); });
    if (v.checks && typeof v.checks === 'object') CHECKS.forEach(function (_, i) { if (v.checks[i]) S.checks[i] = 1; });
  } catch (e) {}
}
function fixIns(x) {
  if (!x || typeof x !== 'object') return null;
  var name = clean(x.name, 40), p = Number(x.prem), c = x.cover === null || x.cover === undefined || x.cover === '' ? null : Number(x.cover);
  if (!name || !(p >= 0) || p > 1e10 || (c !== null && !(c >= 0 && c <= 1e14)) || KINDS.indexOf(x.kind) < 0 || (x.end && !/^\d{4}-\d{2}-\d{2}$/.test(x.end))) return null;
  return { id:clean(x.id, 20) || uid(), kind:x.kind, name:name, co:clean(x.co, 30), prem:p, cover:c, end:x.end || '' };
}
function fixClaim(x) {
  if (!x || typeof x !== 'object') return null;
  var a = Number(x.amt), p = x.paid === null || x.paid === undefined || x.paid === '' ? null : Number(x.paid);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x.d) || !(a >= 0) || a > 1e14 || STATES.indexOf(x.state) < 0 || (p !== null && !(p >= 0 && p <= 1e14))) return null;
  return { id:clean(x.id, 20) || uid(), d:x.d, ins:clean(x.ins, 20), amt:a, paid:p, state:x.state, memo:clean(x.memo, 80) };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ ins:S.ins, claims:S.claims, share:S.share, rate:S.rate, checks:S.checks })); } catch (e) {} }

/** 내 보험 합계: 월 보험료, 연 환산, 종류별 건수, 보장 목록에 없는 핵심 종류. */
function insSummary(list, today) {
  var monthly = list.reduce(function (a, x) { return a + x.prem; }, 0), by = {};
  list.forEach(function (x) { by[x.kind] = (by[x.kind] || 0) + 1; });
  var t0 = today ? Date.parse(today + 'T00:00:00Z') : NaN, soon = list.filter(function (x) { if (!x.end || !isFinite(t0)) return false; var d = (Date.parse(x.end + 'T00:00:00Z') - t0) / 86400000; return d >= 0 && d <= 30; });
  return { count:list.length, monthly:monthly, yearly:monthly * 12, by:by, missing:CORE.filter(function (k) { return !by[k]; }), soon:soon };
}
function claimSummary(list) {
  var asked = 0, paid = 0, open = 0;
  list.forEach(function (c) { asked += c.amt; if (c.state === '지급 완료') paid += c.paid != null ? c.paid : c.amt; if (c.state === '준비 중' || c.state === '접수' || c.state === '심사 중') open++; });
  return { asked:asked, paid:paid, open:open, count:list.length };
}
/**
 * 상호 부조 요율(설계 원칙의 산식): 가입자 n 명, 연 예상 보험금 총액 claims, 운영비율 op(%), 내 위험도 risk(전체 평균 = 1).
 * 보험료 총액 = 보험금 총액 + 운영비. 가입자 평균 보험료 = 총액 / n. 내 보험료 = 평균 × 위험도.
 * cmp(기존 보험의 사업비·이익률 %, 선택)가 있으면 같은 순보험료에서 보험료 = 순보험료 ÷ (1 − cmp%) 로 비교한다.
 */
function rateCalc(r) {
  var n = numOf(r.n), c = numOf(r.claims), op = r.op === '' ? 0 : numOf(r.op), k = numOf(r.risk), cmp = r.cmp === '' || r.cmp == null ? null : numOf(r.cmp);
  if (!(n >= 1) || n > 1e10 || !isFinite(c) || c > 1e16 || !isFinite(op) || op > 100 || !(k >= 0.1) || k > 10 || (cmp !== null && !(cmp >= 0 && cmp < 90))) return null;
  var total = c * (1 + op / 100), avg = total / n, mine = avg * k, pure = c / n * k;
  var o = { total:total, opCost:c * op / 100, avg:avg, mine:mine, monthly:mine / 12, pure:pure };
  if (cmp !== null) { o.old = pure / (1 - cmp / 100); o.oldMonthly = o.old / 12; o.diff = o.old - mine; }
  return o;
}
/** 가입자별 위험도로 보험료 총액을 나눈다: 각자 보험료 = 총액 × 위험도 ÷ 위험도 합. 합은 항상 총액과 같다. */
function share(risks, total) {
  var s = risks.reduce(function (a, b) { return a + b; }, 0); if (!(s > 0) || !(total >= 0)) return null;
  return risks.map(function (x) { return total * x / s; });
}

function topbar() {
  return h('div', { class:'topin' }, [
    h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 보험' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function notice() {
  return h('div', { class:'note info', style:'margin:16px 0', text:'이 화면은 보험을 판매·가입시키거나 보험금을 접수하지 않습니다. 기록은 직접 적는 것이고 이 브라우저에만 저장되며, 어떤 데이터도 밖으로 보내지 않습니다. 계산은 참고용이며 특정 보험 가입을 권하지 않습니다.' });
}
function tile(k, v, s, id) { return h('div', { class:'tile' }, [h('div', { class:'k', text:k }), h('div', { class:'num', id:id, style:'font-size:20px;font-weight:700', text:v }), s ? h('div', { class:'sub', text:s }) : null]); }
function sel(id, label, val, opts, set) {
  var s = h('select', { id:id, 'aria-label':label }, opts.map(function (c) { return h('option', { value:c[0], text:c[1] }); })); s.value = val; s.onchange = function () { set(s.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), s, h('div', { class:'help', text:'' })]);
}
function insName(id) { var x = S.ins.filter(function (i) { return i.id === id; })[0]; return x ? x.name : '(삭제된 보험)'; }

// ── 내 보험 ──
function addIns() {
  var f = S.form, e = {}, name = clean(f.name, 40), p = numOf(f.prem), c = f.cover ? numOf(f.cover) : null;
  if (!name) e.name = '보험 이름을 적어 주세요.';
  if (!isFinite(p) || p > 1e10) e.prem = '월 보험료(원)를 숫자로 적어 주세요. 없으면 0.';
  if (c !== null && (!isFinite(c) || c > 1e14)) e.cover = '보장 한도를 숫자로 적어 주세요.';
  if (f.end && !/^\d{4}-\d{2}-\d{2}$/.test(f.end)) e.end = '만기는 2027-01-31 모양으로 적어 주세요.';
  if (S.ins.length >= MAXI) e.name = '기록은 최대 ' + MAXI + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  S.ins.push({ id:uid(), kind:KINDS.indexOf(f.kind) >= 0 ? f.kind : '기타', name:name, co:clean(f.co, 30), prem:p, cover:c, end:f.end || '' });
  S.form = { kind:f.kind }; S.msg = '기록했어요.'; save(); render();
}
function viewMine() {
  var kids = head('내 보험', '가입한 보험을 한곳에 적어 두고 월 보험료와 만기를 확인합니다.'); kids.push(notice());
  var m = insSummary(S.ins, kst());
  kids.push(h('div', { class:'g4' }, [tile('가입 건수', m.count + '건', '', 'ins-t0'), tile('월 보험료 합계', won(m.monthly) + '원', '', 'ins-t1'), tile('연 환산', won(m.yearly) + '원', '', 'ins-t2'), tile('30일 안 만기', m.soon.length + '건', m.soon.length ? m.soon.slice(0, 2).map(function (x) { return x.name; }).join(', ') : '', 'ins-t3')]));
  if (S.ins.length && m.missing.length) kids.push(h('div', { class:'note', id:'ins-gap', style:'margin-top:12px', text:'아직 기록한 보험이 없는 종류: ' + m.missing.join('·') + '. 필요한지는 생활과 형편에 따라 달라요. 이미 있는 보험이면 기록에 추가해 주세요.' }));
  var f = S.form, e = S.err;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'보험 적기' }),
    h('div', { class:'frm' }, [sel('ins-kind', '종류', f.kind, KINDS.map(function (k) { return [k, k]; }), function (v) { f.kind = v; }), field('ins-name', '보험 이름', f.name, { err:e.name, ph:'예: ○○ 실손의료보험', max:40, set:function (v) { f.name = v; } }), field('ins-co', '보험사(선택)', f.co, { ph:'예: ○○생명', max:30, set:function (v) { f.co = v; } }),
      field('ins-prem', '월 보험료(원)', f.prem, { err:e.prem, ph:'45000', mode:'numeric', max:12, set:function (v) { f.prem = v; } }), field('ins-cover', '보장 한도(원, 선택)', f.cover, { err:e.cover, ph:'100000000', mode:'numeric', max:15, set:function (v) { f.cover = v; } }), field('ins-end', '만기일(선택)', f.end, { err:e.end, ph:'2027-01-31', mode:'numeric', max:10, set:function (v) { f.end = v.trim(); } })]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('기록하기', 'fill', addIns), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  if (!S.ins.length) { kids.push(empty('아직 기록한 보험이 없어요. 가입한 보험을 위에 적어 보세요.')); return kids; }
  var list = S.ins.slice().sort(function (a, b) { return a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0; });
  kids.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['종류', '보험', '월 보험료', '보장 한도', '만기', ''].map(function (t, i) { return h('th', { class:i > 1 && i < 4 ? 'r' : '', text:t }); }))]),
    h('tbody', {}, list.map(function (x) { return h('tr', {}, [h('td', {}, [pill(x.kind)]), h('td', {}, [h('b', { text:x.name }), x.co ? h('div', { class:'sub', text:x.co }) : null]), h('td', { class:'r num', text:won(x.prem) + '원' }), h('td', { class:'r num', text:x.cover == null ? '—' : won(x.cover) + '원' }), h('td', { class:'num', text:x.end || '—' }),
      h('td', { class:'r' }, [btn('삭제', 'sm quiet', function () { S.ins = S.ins.filter(function (y) { return y.id !== x.id; }); S.msg = '삭제했어요.'; save(); render(); })])]); }))])])]));
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('보험 AI에게 묻기', 'fill', function () { ask('내 보험 보장 내용을 점검하려면 무엇을 확인해야 하나요?'); })]));
  return kids;
}

// ── 요율 원리 ──
function viewRate() {
  var kids = head('요율 원리', '나비웹 보험이 보험료를 정하는 방식과, 가정을 넣어 보는 계산기입니다.');
  var steps = [['하루 24시간·1년 365일 기록', '나비웹은 사용자의 일상과 업무를 계속 기록합니다. 그래서 가입자 각각의 실제 위험을 요율에 반영할 수 있어요.'], ['상품이 요구한 데이터만 제공', '사용자는 모든 데이터를 공개하지 않습니다. 보험 상품이 요구하는 특정 데이터만, 사용자가 정한 범위에서 제공합니다.'], ['사람 직원은 볼 수 없고, 데이터는 익명', '보험사의 사람 직원은 개인의 일상·업무 데이터를 볼 수 없습니다. 나비웹 보험 인프라 AI만 접근하고 모든 데이터는 익명화됩니다.'], ['총수·총액·활동으로 요율 결정', '가입자 총수, 보험료 총액, 가입자 각각의 활동을 입력으로 요율이 정해지고, 나비웹은 최소 운영비만 청구합니다.']];
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'나비웹 보험이 다른 점' }), h('div', {}, steps.map(function (x, i) { return h('div', { class:'stp' }, [h('i', { text:String(i + 1) }), h('div', {}, [h('b', { text:x[0] }), h('span', { text:x[1] })])]); })),
    h('div', { class:'note info', text:'설계 원칙입니다. 지금은 보험 상품 가입·데이터 제공·요율 산정이 이 화면에 연결되어 있지 않아요. 아래 계산기는 가정값으로 같은 산식을 보여 줄 뿐 실제 보험료가 아닙니다.' })]));
  var r = S.rate, set = function (k) { return function (v) { r[k] = v; save(); upd(); }; };
  var form = h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'가정 넣어 보기' }), h('div', { class:'frm' }, [
    field('ins-r-n', '가입자 총수(명)', r.n, { ph:'10000', mode:'numeric', max:12, set:set('n') }), field('ins-r-c', '1년 예상 보험금 총액(원)', r.claims, { ph:'3000000000', mode:'decimal', max:18, help:'가입자 전체에게 1년 동안 지급할 것으로 보는 금액', set:set('claims') }),
    field('ins-r-op', '나비웹 운영비율(%)', r.op, { ph:'5', mode:'decimal', max:5, help:'보험금 대비 최소 운영비 가정', set:set('op') }), field('ins-r-k', '내 위험도(평균 = 1)', r.risk, { ph:'1', mode:'decimal', max:5, help:'0.1~10. 활동 기록상 위험이 평균보다 낮으면 1보다 작게', set:set('risk') }),
    field('ins-r-cmp', '기존 보험의 사업비·이익률(%, 선택)', r.cmp, { ph:'직접 알아본 값', mode:'decimal', max:5, help:'넣으면 같은 위험에서 비교해 줘요.', set:set('cmp') })])]);
  var out = h('div', { class:'col', id:'ins-r-out', style:'gap:16px' });
  function upd() {
    out.textContent = ''; var R = rateCalc(r);
    if (!R) { out.appendChild(h('div', { class:'card' }, [h('div', { class:'empty', text:'가입자 수와 예상 보험금 총액을 넣으면 결과가 나와요.' })])); return; }
    out.appendChild(h('div', { class:'g2' }, [tile('내 연 보험료', won(R.mine) + '원', '월 ' + won(R.monthly) + '원', 'ins-r-mine'), tile('가입자 평균 연 보험료', won(R.avg) + '원', '', 'ins-r-avg')]));
    out.appendChild(h('div', { class:'card col' }, [h('b', { text:'보험료 총액의 구성' }), h('div', {}, [['보험금으로 지급', won(R.total - R.opCost) + '원'], ['최소 운영비', won(R.opCost) + '원'], ['보험료 총액', won(R.total) + '원']].map(function (x) { return h('div', { class:'kv' }, [h('span', { text:x[0] }), h('b', { class:'num', text:x[1] })]); })), h('div', { class:'sub', text:'내 보험료 = 총액 ÷ 가입자 수 × 내 위험도. 모두의 보험료를 합치면 총액이 됩니다.' })]));
    if (R.old != null) out.appendChild(h('div', { class:'note ' + (R.diff >= 0 ? 'info' : ''), id:'ins-r-vs', text:'같은 위험에서 기존 보험 방식(사업비·이익률 ' + r.cmp + '%)이면 연 ' + won(R.old) + '원(월 ' + won(R.oldMonthly) + '원)이에요. 이 가정에서는 ' + won(Math.abs(R.diff)) + '원 ' + (R.diff >= 0 ? '적게' : '많이') + ' 나와요.' }));
    out.appendChild(h('div', { class:'foot', text:'가정에 따라 달라지는 단순 계산이에요. 실제 요율은 상품과 가입자의 실제 활동 기록으로 정해집니다.' }));
  }
  upd(); kids.push(h('div', { class:'g2', style:'margin-top:16px;align-items:start' }, [form, out]));
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('보험 AI에게 묻기', 'quiet', function () { ask('보험 요율은 어떻게 정해지나요?'); })]));
  return kids;
}

// ── 상품과 공개 데이터 ──
function viewData() {
  var kids = head('상품과 공개 데이터', '보험 상품마다 요율에 필요한 데이터가 다릅니다. 제공할 항목만 직접 고릅니다.');
  kids.push(h('div', { class:'note info', style:'margin:16px 0', text:'설계 원칙: 상품이 요구하는 항목만 제공하고, 사람 직원은 볼 수 없으며 보험 인프라 AI만 접근하고 모든 데이터는 익명화됩니다. 아래 항목은 예시이고, 지금은 어떤 데이터도 전송되지 않습니다. 고른 상태는 이 브라우저에만 저장돼요.' }));
  var cnt = h('span', { class:'sub', id:'ins-d-n' });
  function tally() { var n = 0; Object.keys(S.share).forEach(function (k) { n += Object.keys(S.share[k]).length; }); cnt.textContent = '제공하기로 고른 항목 ' + n + '개'; }
  kids.push(h('div', { class:'rowf', style:'margin-bottom:12px' }, [cnt]));
  var grid = h('div', { class:'g2' }, Object.keys(NEED).map(function (k) {
    return h('div', { class:'card col' }, [h('div', { class:'rowf', style:'justify-content:space-between' }, [h('b', { style:'font-size:17px', text:k + '보험' }), pill('요율에 필요한 데이터 ' + NEED[k].length + '개')]),
      h('div', {}, NEED[k].map(function (it, i) { var id = 'ins-sh-' + k + '-' + i, cb = h('input', { type:'checkbox', id:id, checked:S.share[k] && S.share[k][i] ? true : false });
        cb.onchange = function () { var o = S.share[k] || (S.share[k] = {}); if (cb.checked) o[i] = 1; else delete o[i]; if (!Object.keys(o).length) delete S.share[k]; save(); tally(); };
        return h('label', { class:'chk', for:id }, [cb, h('span', {}, [h('b', { text:it[0] }), it[1] ? h('span', { class:'sub', text:' — ' + it[1] }) : null])]); }))]);
  }));
  tally(); kids.push(grid);
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('모두 해제', 'quiet', function () { S.share = {}; save(); render(); }), btn('보험 AI에게 묻기', 'quiet', function () { ask('보험에 가입할 때 어떤 데이터를 제공하게 되나요?'); })]));
  return kids;
}

// ── 청구 기록 ──
function addClaim() {
  var f = S.cform, e = {}, a = numOf(f.amt), p = f.paid ? numOf(f.paid) : null, d = f.d || kst();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) e.d = '날짜는 2026-11-23 모양으로 적어 주세요.';
  if (!isFinite(a) || a > 1e14) e.amt = '청구 금액(원)을 숫자로 적어 주세요.';
  if (p !== null && (!isFinite(p) || p > 1e14)) e.paid = '지급 금액을 숫자로 적어 주세요.';
  if (S.claims.length >= MAXC) e.amt = '기록은 최대 ' + MAXC + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  S.claims.push({ id:uid(), d:d, ins:S.ins.some(function (x) { return x.id === f.ins; }) ? f.ins : '', amt:a, paid:p, state:STATES.indexOf(f.state) >= 0 ? f.state : '준비 중', memo:clean(f.memo, 80) });
  S.cform = { state:f.state }; S.msg = '기록했어요.'; save(); render();
}
function viewClaims() {
  var kids = head('청구 기록', '보험금을 청구한 내용과 진행 상태를 직접 적어 두는 곳입니다. 실제 청구 접수는 보험사에서 합니다.'); kids.push(notice());
  var c = claimSummary(S.claims);
  kids.push(h('div', { class:'g4' }, [tile('청구 건수', c.count + '건', '', 'ins-c0'), tile('진행 중', c.open + '건', '준비·접수·심사', 'ins-c1'), tile('청구 금액 합계', won(c.asked) + '원', '', 'ins-c2'), tile('지급 완료 합계', won(c.paid) + '원', '', 'ins-c3')]));
  var f = S.cform, e = S.err; if (!f.d) f.d = kst();
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'청구 적기' }), h('div', { class:'frm' }, [
    field('ins-cd', '청구일', f.d, { err:e.d, ph:'2026-11-23', mode:'numeric', max:10, set:function (v) { f.d = v.trim(); } }),
    sel('ins-ci', '해당 보험', f.ins || '', [['', '(선택 안 함)']].concat(S.ins.map(function (x) { return [x.id, x.name]; })), function (v) { f.ins = v; }),
    field('ins-ca', '청구 금액(원)', f.amt, { err:e.amt, ph:'350000', mode:'numeric', max:15, set:function (v) { f.amt = v; } }), field('ins-cp', '지급 금액(원, 선택)', f.paid, { err:e.paid, ph:'지급되면 적기', mode:'numeric', max:15, set:function (v) { f.paid = v; } }),
    sel('ins-cs', '상태', f.state, STATES.map(function (s) { return [s, s]; }), function (v) { f.state = v; }), field('ins-cm', '메모(선택)', f.memo, { ph:'예: 통원 치료 3회', max:80, set:function (v) { f.memo = v; } })]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('기록하기', 'fill', addClaim), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  if (!S.claims.length) { kids.push(empty('아직 청구 기록이 없어요.')); return kids; }
  var list = S.claims.slice().sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; });
  kids.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['청구일', '보험', '청구', '지급', '상태', ''].map(function (t, i) { return h('th', { class:i === 2 || i === 3 ? 'r' : '', text:t }); }))]),
    h('tbody', {}, list.map(function (x) { return h('tr', {}, [h('td', { class:'num', text:x.d }), h('td', {}, [x.ins ? insName(x.ins) : '—', x.memo ? h('div', { class:'sub', text:x.memo }) : null]), h('td', { class:'r num', text:won(x.amt) + '원' }), h('td', { class:'r num', text:x.paid == null ? '—' : won(x.paid) + '원' }), h('td', {}, [pill(x.state, x.state === '지급 완료' ? 'm' : x.state === '거절·보류' ? 'l' : '')]),
      h('td', { class:'r' }, [btn('삭제', 'sm quiet', function () { S.claims = S.claims.filter(function (y) { return y.id !== x.id; }); S.msg = '삭제했어요.'; save(); render(); })])]); }))])])]));
  return kids;
}

// ── 점검·용어 ──
function viewLearn() {
  var kids = head('점검·용어', '보험을 정리할 때 확인할 것과 자주 쓰는 용어입니다. 일반 정보이며 특정 상품에 대한 의견이 아닙니다.');
  var n = Object.keys(S.checks).length;
  var list = h('div', { class:'card col' }, [h('div', { class:'rowf', style:'justify-content:space-between' }, [h('b', { style:'font-size:17px', text:'보험 점검표' }), h('span', { class:'sub', id:'ins-chk-n', text:n + ' / ' + CHECKS.length })]), h('div', { class:'meter8' }, [h('i', { id:'ins-chk-bar', style:'width:' + Math.round(n / CHECKS.length * 100) + '%' })]),
    h('div', {}, CHECKS.map(function (t, i) { var cb = h('input', { type:'checkbox', id:'ins-chk-' + i, checked:S.checks[i] ? true : false }); cb.onchange = function () { if (cb.checked) S.checks[i] = 1; else delete S.checks[i]; save(); var c = Object.keys(S.checks).length; $('ins-chk-n').textContent = c + ' / ' + CHECKS.length; $('ins-chk-bar').style.width = Math.round(c / CHECKS.length * 100) + '%'; }; return h('label', { class:'chk', for:'ins-chk-' + i }, [cb, h('span', { text:t })]); })),
    h('div', { class:'sub', text:'체크 상태는 이 브라우저에만 저장됩니다.' })]);
  var q = h('input', { id:'ins-gq', type:'search', placeholder:'용어 검색 (예: 면책, 요율)', maxlength:'20', value:S.gq, 'aria-label':'용어 검색' });
  var gl = h('div', { id:'ins-gl' });
  function drawGl() { gl.textContent = ''; var s = S.gq.trim().toLowerCase(), r = GLOSS.filter(function (x) { return !s || x[0].toLowerCase().indexOf(s) >= 0 || x[1].toLowerCase().indexOf(s) >= 0; }); if (!r.length) gl.appendChild(h('div', { class:'empty', text:'찾는 용어가 없어요. 보험 AI에게 물어보세요.' })); r.forEach(function (x) { gl.appendChild(h('div', { class:'gl' }, [h('b', { text:x[0] }), h('span', { class:'sub', text:x[1] })])); }); }
  q.oninput = function () { S.gq = q.value; drawGl(); }; drawGl();
  kids.push(h('div', { class:'g2', style:'margin-top:16px' }, [list, h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'용어 사전' }), h('div', { class:'sh' }, [q]), gl])]));
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('보험 AI에게 묻기', 'fill', function () { ask('보험 용어를 쉽게 설명해 주세요'); })]));
  return kids;
}

function render() {
  var root = $('ins-root'), tp = $('ins-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = S.view === 'rate' ? viewRate() : S.view === 'data' ? viewData() : S.view === 'claims' ? viewClaims() : S.view === 'learn' ? viewLearn() : viewMine();
  kids.forEach(function (k) { if (k) root.appendChild(k); });
}
function reply(ok, msg) { emit('result', { ok:ok, msg:msg, view:S.view }); }
function nav(a) {
  var d = a && typeof a['do'] === 'string' ? a['do'] : '';
  if (VIEWS.indexOf(d) >= 0) { go(d); return reply(true, TABS[VIEWS.indexOf(d)][1] + ' 화면으로 이동했습니다.'); }
  if (d === 'rate') { var r = S.rate; [['n', 'n'], ['claims', 'claims'], ['op', 'op'], ['risk', 'risk'], ['cmp', 'cmp']].forEach(function (k) { if (a[k[0]] != null && isFinite(numOf(a[k[0]]))) r[k[1]] = String(numOf(a[k[0]])); }); save(); go('rate'); return reply(true, '요율 계산기로 이동해 값을 채웠습니다.'); }
  return reply(false, '지원하지 않는 요청입니다.');
}
function mount(el, o) {
  if (!el) return; o = o || {};
  M = el; el.textContent = ''; el.classList.add('ins'); S.ins = []; S.claims = []; S.share = {}; S.checks = {}; S.err = {}; S.msg = ''; load();
  [h('div', { id:'ins-top' }), h('div', { class:'wrap', id:'ins-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'mine'; render();
}
window.NaviInsure = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  insSummary:insSummary, claimSummary:claimSummary, rateCalc:rateCalc, share:share,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
