/* plan-app.js — 나비웹 계획(인프라 AI · 목표·기획). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviPlan.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 plan.css(.pln 범위). 전역은 NaviPlan 하나만 쓴다.
 *
 * 계획 화면의 흐름(주피터 지시): 영리 사업이 아닌 일련의 계획(예: 10년 안에 변호사 자격 취득, 30평대 아파트 마련)을 다룬다.
 * ① 사용자가 정한 목표를 사용자의 이력·현재 상황과 견주어 달성 가능한 목표인지 먼저 판단하고 ② 가능하면 실행 계획을 쓰고 ③ 사용자가 실천하는지 파악하고 ④ 달성 가능성(확률)을 주기적으로 다시 평가한다.
 * 쓰는 이론: SMART 목표(로크·레이섬의 목표 설정 이론) · 계획 오류(카너먼·트버스키)를 줄이는 여유 기간 · 실행 의도 'if-then'(골위처) · 정량 목표의 필요 속도 대 과거 속도 · 단계 목표의 기한·성공 확률·재도전 계산.
 * 이 화면은 입력한 값으로 계산·기록만 한다: monthsLeft · quantFeasibility(수치 목표) · stageFeasibility(단계 목표) · stageSchedule · actionRate · judge.
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 확률은 입력한 이력과 값, 아래 가정으로 계산한 추정이며 실제 결과를 보장하지 않는다. 합격률·시세 같은 바깥 정보를 가져오지 않고 사용자가 입력한 값을 쓴다.
 *  - 수치 목표: 매달 증가분이 과거 이력과 비슷하고 서로 독립이라고 가정한다(정규 분포). 단계 목표: 각 단계가 독립이고, 여유 기간이 있으면 재도전 가능한 단계를 되풀이한다고 가정한다.
 *  - 기록은 이 브라우저(localStorage)에만 저장되며 밖으로 보내지 않는다. 법률·세무·의료 같은 전문 판단은 해당 인프라 AI와 전문가에게 확인한다. */
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
var KEY = 'navi-plan-v1', MAXG = 20, MAXH = 24, MAXC = 60, MAXAC = 10, MAXST = 12, KINDS = ['수치 목표', '단계 목표'];
var TABS = [['home', '내 목표'], ['judge', '달성 가능성'], ['actions', '실행 계획'], ['track', '실천 점검'], ['theory', '계획 원리']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var M = null, LS = {};
var S = { view:'home', goals:[], sel:'', gf:{ title:'', why:'', kind:'수치 목표', deadline:'', unit:'', target:'', current:'' }, sf:{ name:'', months:'', p:'', retry:'가능' }, af:{ iff:'', then:'', times:'' }, cf:{ ym:'', value:'', planned:'', done:'' }, err:{}, msg:'' };
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
    h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 목표·기획' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function notice() {
  return h('div', { class:'note info', style:'margin:16px 0', id:'pl-note', text:'이 화면은 입력한 값으로 계산하고 기록만 합니다. 달성 가능성은 입력한 이력과 가정으로 계산한 추정이며 결과를 보장하지 않아요. 합격률·시세 같은 바깥 정보는 가져오지 않고 내가 넣은 값을 쓰며, 적은 내용은 이 브라우저에만 저장되고 밖으로 보내지 않습니다.' });
}
function rows2(rows) { return rows.map(function (r) { return h('tr', {}, r.map(function (t, i) { return h(i ? 'td' : 'th', { text:t }); })); }); }

// ── 날짜·수학 ──
function validDate(s) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false; var p = s.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2])); return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2]; }
/** 오늘부터 기한까지 남은 온전한 개월 수(기한이 지났으면 0 이하). 날짜가 틀리면 null. */
function monthsLeft(deadline, today) {
  if (!validDate(deadline) || !validDate(today)) return null; var a = today.split('-').map(Number), b = deadline.split('-').map(Number), n = (b[0] - a[0]) * 12 + (b[1] - a[1]); if (b[2] < a[2]) n -= 1; return n;
}
function ymAdd(ym, n) { var p = ym.split('-').map(Number), t = p[0] * 12 + (p[1] - 1) + n; return Math.floor(t / 12) + '-' + ('0' + ((t % 12) + 1)).slice(-2); }
function normCdf(z) { var t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }
function clampP(p) { return Math.max(0.01, Math.min(0.99, p)); }
function verdictOf(p) { return p === null ? '판단 보류' : p >= 0.7 ? '달성 가능' : p >= 0.4 ? '빠듯함' : '어려움'; }
function parseHist(text) {
  var parts = String(text == null ? '' : text).split(/[,\s]+/).filter(Boolean); if (!parts.length || parts.length > MAXH) return null; var out = [];
  for (var i = 0; i < parts.length; i++) { if (!/^-?\d+(\.\d+)?$/.test(parts[i])) return null; var n = Number(parts[i]); if (Math.abs(n) > 1e13) return null; out.push(n); } return out;
}
/** 수치 목표: 남은 금액을 남은 개월 수로 나눈 필요 속도와 과거 월별 증가 이력을 견줘 달성 확률을 추정한다(월별 증가분이 정규 분포·독립이라는 가정). 이력이 3개 미만이면 p 는 null. */
function quantFeasibility(o) {
  if (!o) return null; var t = Number(o.target), c = Number(o.current), months = monthsLeft(o.deadline, o.today), h = o.hist;
  if (!isFinite(t) || !isFinite(c) || t <= 0 || months === null || !Array.isArray(h) || h.some(function (x) { return !isFinite(x); })) return null;
  var gap = t - c; if (gap <= 0) return { gap:0, months:months, req:0, n:h.length, mean:null, sd:null, p:1, verdict:'달성', done:true };
  if (months <= 0) return { gap:gap, months:months, req:null, n:h.length, mean:null, sd:null, p:0, verdict:'어려움', late:true };
  var req = gap / months, n = h.length; if (n < 3) return { gap:gap, months:months, req:req, n:n, mean:null, sd:null, p:null, verdict:'판단 보류' };
  var mean = h.reduce(function (s, x) { return s + x; }, 0) / n, sd = Math.sqrt(h.reduce(function (s, x) { return s + (x - mean) * (x - mean); }, 0) / (n - 1)), p;
  if (sd === 0) p = mean * months >= gap ? 0.99 : 0.01; else p = clampP(normCdf((months * mean - gap) / (Math.sqrt(months) * sd)));
  return { gap:gap, months:months, req:req, n:n, mean:mean, sd:sd, p:p, verdict:verdictOf(p) };
}
/** 단계 목표: 남은 단계의 기간(여유 비율을 더함)이 남은 기간 안에 들어가는지, 단계별 한 번에 성공할 확률과 재도전을 따져 전체 달성 확률을 추정한다.
 *  남은 여유 기간은 재도전이 가능한 단계 중 성공 확률이 가장 낮은 단계부터 한 번씩 더 시도하는 데 쓴다(단계들은 서로 독립이라는 가정). */
function stageFeasibility(stages, months, buffer) {
  var b = Number(buffer); if (!Array.isArray(stages) || !stages.length || months === null || months === undefined || !isFinite(b) || b < 0 || b > 100) return null;
  var rem = stages.filter(function (s) { return !s.done; }); if (!rem.length) return { need:0, slack:months, p:1, verdict:'달성', plan:[], done:true };
  var plan = rem.map(function (s) { var m = Number(s.months), pp = Number(s.p) / 100; return { id:s.id, name:s.name, base:m, months:Math.ceil(m * (1 + b / 100)), p:pp, retry:!!s.retry, attempts:1 }; });
  if (plan.some(function (x) { return !isFinite(x.base) || x.base < 1 || !isFinite(x.p) || x.p <= 0 || x.p >= 1; })) return null;
  var need = plan.reduce(function (s, x) { return s + x.months; }, 0), slack = months - need;
  var eff = function (x) { return 1 - Math.pow(1 - x.p, x.attempts); };
  if (slack < 0) { plan.forEach(function (x) { x.pEff = eff(x); }); return { need:need, slack:slack, short:-slack, p:0, verdict:'어려움', plan:plan }; }
  var left = slack, guard = 0;
  while (guard++ < 200) { var best = null; plan.forEach(function (x) { if (x.retry && x.months <= left && (!best || eff(x) < eff(best))) best = x; }); if (!best) break; best.attempts += 1; left -= best.months; }
  var p = plan.reduce(function (s, x) { x.pEff = eff(x); return s * x.pEff; }, 1); p = clampP(p);
  return { need:need, slack:slack, left:left, p:p, verdict:verdictOf(p), plan:plan };
}
/** 단계 일정: 오늘 달(ym)부터 남은 단계를 차례로 놓아 시작·끝 달을 돌려준다(여유 비율 포함). */
function stageSchedule(stages, ym, buffer) {
  var b = Number(buffer); if (!Array.isArray(stages) || !/^\d{4}-\d{2}$/.test(ym) || !isFinite(b) || b < 0 || b > 100) return null; var cur = ym, out = [];
  stages.filter(function (s) { return !s.done; }).forEach(function (s) { var m = Math.ceil(Number(s.months) * (1 + b / 100)), end = ymAdd(cur, m); out.push({ name:s.name, start:cur, end:end, months:m }); cur = end; }); return out;
}
/** 실천율: 최근 n 번 점검(계획 횟수가 있는 것)의 실제 횟수 ÷ 계획 횟수. 점검이 없으면 null. */
function actionRate(checks, n) {
  var c = (checks || []).filter(function (x) { return x && x.planned > 0; }).slice(0, n || 3); if (!c.length) return null;
  var pl = c.reduce(function (s, x) { return s + x.planned; }, 0), dn = c.reduce(function (s, x) { return s + Math.min(x.done, x.planned); }, 0); return { planned:pl, done:dn, rate:Math.round(dn / pl * 100), n:c.length };
}
function histOf(g) { var cs = (g.checks || []).filter(function (c) { return c.value !== null && c.value !== undefined; }).slice().sort(function (a, b) { return a.ym < b.ym ? -1 : 1; }).map(function (c) { return c.value; }); return (g.hist || []).concat(cs).slice(-MAXH); }
function judge(g, today) {
  if (!g) return null; if (g.kind === '수치 목표') return quantFeasibility({ target:g.target, current:g.current, deadline:g.deadline, today:today, hist:histOf(g) });
  var mo = monthsLeft(g.deadline, today); return mo === null ? null : (mo <= 0 && g.stages.some(function (s) { return !s.done; }) ? { need:null, slack:mo, p:0, verdict:'어려움', plan:[], late:true } : stageFeasibility(g.stages, mo, g.buffer));
}
function ptxt(p) { return p === null || p === undefined ? '—' : Math.round(p * 100) + '%'; }
function money(n, u) { return n === null || n === undefined ? '—' : Math.round(n).toLocaleString('ko-KR') + (u || ''); }
var VPILL = { '달성':'ok', '달성 가능':'ok', '빠듯함':'warn', '어려움':'bad', '판단 보류':'' };

function load() {
  try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v || typeof v !== 'object') return; S.goals = (Array.isArray(v.goals) ? v.goals : []).map(fixG).filter(Boolean).slice(0, MAXG); if (S.goals.some(function (g) { return g.id === v.sel; })) S.sel = v.sel; } catch (e) {}
}
function fixG(x) {
  if (!x || typeof x !== 'object' || KINDS.indexOf(x.kind) < 0 || !validDate(x.deadline)) return null; var t = clean(x.title, 60), w = clean(x.why, 200); if (!t) return null;
  var g = { id:clean(x.id, 20) || uid(), title:t, why:w, kind:x.kind, deadline:x.deadline, unit:clean(x.unit, 10), target:Number(x.target) || 0, current:Number(x.current) || 0, hist:[], buffer:20, stages:[], actions:[], checks:[], d:validDate(x.d) ? x.d : '' };
  if (Array.isArray(x.hist)) g.hist = x.hist.map(Number).filter(function (n) { return isFinite(n) && Math.abs(n) <= 1e13; }).slice(-MAXH); var b = Number(x.buffer); if (isFinite(b) && b >= 0 && b <= 100) g.buffer = b;
  if (Array.isArray(x.stages)) g.stages = x.stages.map(function (s) { if (!s || typeof s !== 'object') return null; var m = Number(s.months), p = Number(s.p), n = clean(s.name, 40); return n && m >= 1 && m <= 600 && Math.floor(m) === m && p >= 1 && p <= 99 && Math.floor(p) === p ? { id:clean(s.id, 20) || uid(), name:n, months:m, p:p, retry:!!s.retry, done:!!s.done } : null; }).filter(Boolean).slice(0, MAXST);
  if (Array.isArray(x.actions)) g.actions = x.actions.map(function (a) { if (!a || typeof a !== 'object') return null; var i = clean(a.iff, 80), t2 = clean(a.then, 80), n = Number(a.times); return i && t2 && n >= 1 && n <= 14 && Math.floor(n) === n ? { id:clean(a.id, 20) || uid(), iff:i, then:t2, times:n } : null; }).filter(Boolean).slice(0, MAXAC);
  if (Array.isArray(x.checks)) g.checks = x.checks.map(function (c) { if (!c || typeof c !== 'object' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(c.ym)) return null; var v2 = c.value === null || c.value === undefined || c.value === '' ? null : Number(c.value), pl = Number(c.planned), dn = Number(c.done), pr = c.prob === null || c.prob === undefined ? null : Number(c.prob);
    return (v2 === null || isFinite(v2)) && pl >= 1 && pl <= 999 && dn >= 0 && dn <= pl && (pr === null || (pr >= 0 && pr <= 1)) ? { ym:c.ym, value:v2, planned:pl, done:dn, prob:pr } : null; }).filter(Boolean).sort(function (a, b2) { return a.ym < b2.ym ? 1 : -1; }).slice(0, MAXC);
  return g;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ goals:S.goals, sel:S.sel })); } catch (e) {} }
function cur() { for (var i = 0; i < S.goals.length; i++) if (S.goals[i].id === S.sel) return S.goals[i]; return null; }
function picker() {
  if (!S.goals.length) return null; var s = h('select', { id:'pl-pick', 'aria-label':'목표 고르기' }, S.goals.map(function (g) { return h('option', { value:g.id, text:g.title }); })); s.value = S.sel; s.onchange = function () { S.sel = s.value; save(); render(); };
  return h('div', { class:'field' }, [h('label', { for:'pl-pick', text:'목표' }), s, h('div', { class:'help', text:'' })]);
}
function needGoal(kids) { kids.push(empty('먼저 「내 목표」에서 목표를 하나 만들어 주세요.', btn('목표 만들기', 'fill', function () { go('home'); }))); return kids; }

// ── 내 목표 ──
function addGoal() {
  var f = S.gf, e = {}, t = clean(f.title, 60), w = clean(f.why, 200), today = kst();
  if (t.length < 5) e.title = '목표를 구체적으로 5자 이상 적어 주세요.'; if (w.length < 5) e.why = '이 목표가 나에게 왜 중요한지 5자 이상 적어 주세요.';
  var mo = monthsLeft(f.deadline, today); if (mo === null) e.deadline = '기한을 2036-11-23 형식으로 적어 주세요.'; else if (mo < 1) e.deadline = '기한은 오늘부터 한 달 이상 뒤여야 해요.'; else if (mo > 600) e.deadline = '기한은 50년 안으로 적어 주세요.';
  var tg = 0, cu = 0, un = clean(f.unit, 10); if (f.kind === '수치 목표') { tg = numOf(f.target); cu = numOf(f.current === '' ? '0' : f.current); if (!isFinite(tg) || tg <= 0) e.target = '목표 수량을 0보다 큰 숫자로 적어 주세요.'; if (!isFinite(cu)) e.current = '현재 수량을 0 이상의 숫자로 적어 주세요.'; if (!un) e.unit = '단위를 적어 주세요(예: 원).'; }
  if (S.goals.length >= MAXG) e.title = '목표는 최대 ' + MAXG + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  var g = { id:uid(), title:t, why:w, kind:f.kind, deadline:f.deadline, unit:un, target:tg, current:cu, hist:[], buffer:20, stages:[], actions:[], checks:[], d:today }; S.goals.unshift(g); S.sel = g.id;
  f.title = ''; f.why = ''; f.deadline = ''; f.unit = ''; f.target = ''; f.current = ''; S.msg = g.kind === '수치 목표' ? '목표를 만들었어요. 「달성 가능성」에서 지난 달별 증가분을 넣어 주세요.' : '목표를 만들었어요. 「달성 가능성」에서 단계를 적어 주세요.'; save(); render();
}
function viewHome() {
  var kids = head('내 목표', '목표를 정하고, 나의 이력과 현재 상황으로 달성 가능한지 먼저 따진 뒤 실행하고 점검합니다.'); kids.push(notice());
  var today = kst(), ok = S.goals.filter(function (g) { var r = judge(g, today); return r && (r.verdict === '달성 가능' || r.verdict === '달성'); }).length;
  kids.push(h('div', { class:'g2' }, [tile('내 목표', S.goals.length + '개', '', 'pl-h-n'), tile('달성 가능으로 본 목표', ok + '개', '확률 70% 이상', 'pl-h-ok')]));
  if (S.goals.length) kids.push(table(['목표', '기한', '달성 가능성', ''], S.goals.map(function (g) { var r = judge(g, today); return h('tr', {}, [h('td', {}, [h('b', { text:g.title }), h('div', { class:'sub', text:g.kind + ' · ' + g.why })]), h('td', { class:'num', text:g.deadline }), h('td', {}, [r ? pill(r.verdict + (r.p !== null ? ' ' + ptxt(r.p) : ''), VPILL[r.verdict]) : pill('입력 필요', '')]), h('td', {}, [btn('고르기', 'quiet', function () { S.sel = g.id; save(); go('judge'); }), btn('삭제', 'quiet', function () { S.goals = S.goals.filter(function (y) { return y.id !== g.id; }); if (S.sel === g.id) S.sel = S.goals.length ? S.goals[0].id : ''; save(); render(); })])]); })));
  var f = S.gf, e = S.err, ks = h('select', { id:'pl-g-kind', 'aria-label':'목표 종류' }, KINDS.map(function (k) { return h('option', { value:k, text:k }); })); ks.value = f.kind; ks.onchange = function () { f.kind = ks.value; render(); };
  var q = f.kind === '수치 목표' ? [field('pl-g-unit', '단위', f.unit, { err:e.unit, max:10, ph:'예: 원', set:function (v) { f.unit = v; } }), field('pl-g-target', '목표 수량', f.target, { err:e.target, max:16, mode:'numeric', ph:'예: 600000000', set:function (v) { f.target = v; } }), field('pl-g-current', '현재 수량', f.current, { err:e.current, max:16, mode:'numeric', ph:'예: 80000000', set:function (v) { f.current = v; } })] : [];
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'새 목표 만들기' }), h('div', { class:'sub', text:'구체적이고(S) 측정할 수 있고(M) 기한이 있고(T) 나에게 의미 있는(R) 목표로 적어요. 달성 가능성(A)은 다음 탭에서 계산해요.' }),
    h('div', { class:'frm' }, [field('pl-g-title', '목표', f.title, { err:e.title, max:60, ph:'예: 10년 안에 변호사 자격 취득 / 30평대 아파트 마련', set:function (v) { f.title = v; } }), field('pl-g-why', '왜 이 목표인가요', f.why, { err:e.why, max:200, set:function (v) { f.why = v; } }),
      h('div', { class:'field' }, [h('label', { for:'pl-g-kind', text:'종류' }), ks, h('div', { class:'help', text:'수치 목표는 모을 양, 단계 목표는 거쳐야 할 단계가 있는 목표예요' })]), field('pl-g-deadline', '기한', f.deadline, { err:e.deadline, max:10, ph:'2036-11-23', set:function (v) { f.deadline = v; } })].concat(q)),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('목표 만들기', 'fill', addGoal), btn('계획 AI에게 묻기', 'quiet', function () { ask('내 목표가 달성 가능한지 따져 보려면 어떤 정보를 정리해야 하나요?'); }), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  return kids;
}

// ── 달성 가능성 ──
var jOut = null;
function updJ() {
  if (!jOut) return; jOut.textContent = ''; var g = cur(); if (!g) return; var r = judge(g, kst());
  if (!r) { jOut.appendChild(h('div', { class:'note', id:'pl-j-none', text:g.kind === '수치 목표' ? '목표 수량·기한·월별 이력을 확인해 주세요.' : '단계를 한 개 이상 적어 주세요(기간 1개월 이상, 성공 확률 1~99%).' })); return; }
  if (r.done) { jOut.appendChild(h('div', { class:'note info', id:'pl-j-done', text:'이미 달성한 목표예요.' })); return; }
  jOut.appendChild(h('div', { class:'g2' }, [tile('달성 확률(추정)', ptxt(r.p), r.p === null ? '이력이 3개 이상 필요해요' : '입력한 값과 가정으로 계산', 'pl-j-p'), tile('판단', r.verdict, '70% 이상 가능 · 40% 이상 빠듯 · 그 미만 어려움', 'pl-j-v')]));
  var rows = [];
  if (g.kind === '수치 목표') { rows = [['남은 양', money(r.gap, g.unit)], ['남은 개월 수', r.months + '개월'], ['매달 필요한 양', r.req === null ? '기한이 지났어요' : money(r.req, g.unit)], ['과거 월평균 증가', r.mean === null ? '이력 ' + r.n + '개(3개 이상 필요)' : money(r.mean, g.unit) + ' (이력 ' + r.n + '개)']]; }
  else if (r.late) rows = [['기한', '지났어요. 기한을 다시 정하세요.']]; else rows = [['필요한 기간(여유 ' + g.buffer + '% 포함)', r.need + '개월'], ['남은 기간', (r.slack + r.need) + '개월'], [r.slack < 0 ? '모자란 기간' : '여유 기간', Math.abs(r.slack) + '개월']];
  jOut.appendChild(table(['항목', '값'], rows2(rows)));
  if (g.kind === '단계 목표' && r.plan && r.plan.length) jOut.appendChild(table(['단계', '기간', '한 번에 성공', '시도 횟수', '단계 성공'], r.plan.map(function (x) { return h('tr', {}, [h('th', { text:x.name }), h('td', { class:'num', text:x.months + '개월' }), h('td', { class:'num', text:Math.round(x.p * 100) + '%' }), h('td', { class:'num', text:x.attempts + '회' }), h('td', { class:'num', text:Math.round(x.pEff * 100) + '%' })]); })));
  jOut.appendChild(h('div', { class:r.verdict === '어려움' ? 'note' : 'note info', style:'margin-top:12px', id:'pl-j-msg', text:r.verdict === '어려움' ? '지금 조건으로는 달성이 어려워요. 기한을 늘리거나, 목표를 줄이거나, 단계를 고쳐 다시 계산해 보세요.' : r.verdict === '빠듯함' ? '달성할 수는 있지만 여유가 적어요. 기한이나 목표를 조금 조정하면 확률이 올라가요.' : r.verdict === '판단 보류' ? '이력을 3개 이상 넣으면 확률을 계산해요.' : '달성 가능으로 보여요. 「실행 계획」에서 실천할 일을 정하세요.' }));
  jOut.appendChild(h('div', { class:'sub', style:'margin-top:8px', text:g.kind === '수치 목표' ? '가정: 매달 증가분이 과거 이력과 비슷하고 서로 독립이에요.' : '가정: 단계들이 서로 독립이고, 여유 기간이 있으면 재도전할 수 있는 단계를 한 번 더 시도해요.' }));
  jOut.appendChild(h('div', { class:'rowf', style:'margin-top:8px' }, [btn('계획 AI에게 결과 묻기', 'quiet', function () { ask('내 목표 「' + g.title + '」의 달성 확률이 ' + ptxt(r.p) + '(' + r.verdict + ')로 나왔어요. 확률을 높이려면 무엇을 바꾸면 좋을까요?'); })]));
}
function viewJudge() {
  var kids = head('달성 가능성', '목표와 나의 이력·현재 상황을 견주어 달성할 수 있는지 먼저 판단합니다.'); kids.push(notice()); var g = cur(); if (!g) return needGoal(kids);
  var pk = picker(); kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [pk, h('div', { class:'sub', text:g.why }),
    h('div', { class:'frm' }, [field('pl-e-deadline', '기한', g.deadline, { max:10, help:'바꾸면 바로 다시 계산해요', set:function (v) { if (validDate(v) && monthsLeft(v, kst()) >= 1 && monthsLeft(v, kst()) <= 600) { g.deadline = v; save(); updJ(); } } })]
      .concat(g.kind === '수치 목표' ? [field('pl-e-target', '목표 수량(' + g.unit + ')', String(g.target), { max:16, mode:'numeric', set:function (v) { var n = numOf(v); if (isFinite(n) && n > 0) { g.target = n; save(); updJ(); } } }), field('pl-e-current', '현재 수량(' + g.unit + ')', String(g.current), { max:16, mode:'numeric', help:'실천 점검에서 넣는 증가분은 자동으로 더해져요', set:function (v) { var n = numOf(v); if (isFinite(n)) { g.current = n; save(); updJ(); } } })] : [field('pl-e-buffer', '여유 비율(%)', String(g.buffer), { max:3, mode:'numeric', help:'계획은 보통 예상보다 오래 걸려요(계획 오류). 기본 20%', set:function (v) { var n = numOf(v); if (isFinite(n) && n >= 0 && n <= 100) { g.buffer = n; save(); updJ(); } } })]))]));
  if (g.kind === '수치 목표') kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'지난 달별 증가분(이력)' }), field('pl-e-hist', '월별 증가분(쉼표나 줄바꿈으로 구분, 천 단위 쉼표 없이)', g.hist.join(', '), { area:true, max:400, ph:'예: 1500000, 1200000, 1800000, 1400000', help:'최근 6~12개월을 넣어 주세요. 지난 값이 앞으로도 비슷하다고 가정해요. 이력은 3개 이상 필요해요.', set:function (v) { var a = parseHist(v); if (a) { g.hist = a; save(); updJ(); } } })]));
  else kids.push(stageEditor(g));
  jOut = h('div', { id:'pl-j-out', style:'margin-top:16px' }); kids.push(jOut); updJ(); return kids;
}
function stageEditor(g) {
  var f = S.sf, e = S.err, rs = h('select', { id:'pl-s-retry', 'aria-label':'재도전 가능' }, [h('option', { value:'가능', text:'재도전 가능' }), h('option', { value:'불가', text:'재도전 불가' })]); rs.value = f.retry; rs.onchange = function () { f.retry = rs.value; };
  return h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'거쳐야 할 단계' }), h('div', { class:'sub', text:'차례대로 적어요. 한 번에 성공할 확률은 합격률·성공률 같은 자료를 보고 내가 정한 값이에요.' }),
    g.stages.length ? table(['단계', '기간', '한 번에 성공', '상태', ''], g.stages.map(function (s) { return h('tr', {}, [h('th', { text:s.name }), h('td', { class:'num', text:s.months + '개월' }), h('td', { class:'num', text:s.p + '%' + (s.retry ? ' · 재도전' : '') }), h('td', {}, [pill(s.done ? '완료' : '남음', s.done ? 'ok' : '')]), h('td', {}, [btn(s.done ? '되돌리기' : '완료로 표시', 'quiet', function () { s.done = !s.done; save(); render(); }), btn('삭제', 'quiet', function () { g.stages = g.stages.filter(function (y) { return y.id !== s.id; }); save(); render(); })])]); })) : h('div', { class:'empty', text:'아직 단계가 없어요.' }),
    h('div', { class:'frm' }, [field('pl-s-name', '단계 이름', f.name, { err:e.sname, max:40, ph:'예: 로스쿨 입학 준비', set:function (v) { f.name = v; } }), field('pl-s-months', '걸리는 기간(개월)', f.months, { err:e.smonths, max:3, mode:'numeric', set:function (v) { f.months = v; } }), field('pl-s-p', '한 번에 성공할 확률(%)', f.p, { err:e.sp, max:2, mode:'numeric', help:'1~99', set:function (v) { f.p = v; } }), h('div', { class:'field' }, [h('label', { for:'pl-s-retry', text:'재도전' }), rs, h('div', { class:'help', text:'실패해도 다시 시도할 수 있는 단계인가요' })])]),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('단계 추가', 'fill', function () { addStage(g); })])]);
}
function addStage(g) {
  var f = S.sf, e = {}, n = clean(f.name, 40), m = numOf(f.months), p = numOf(f.p);
  if (!n) e.sname = '단계 이름을 적어 주세요.'; if (!isFinite(m) || m < 1 || m > 600 || Math.floor(m) !== m) e.smonths = '기간을 1 이상의 정수(개월)로 적어 주세요.'; if (!isFinite(p) || p < 1 || p > 99 || Math.floor(p) !== p) e.sp = '확률을 1~99 사이 정수로 적어 주세요.'; if (g.stages.length >= MAXST) e.sname = '단계는 최대 ' + MAXST + '개까지예요.';
  S.err = e; if (Object.keys(e).length) return render(); g.stages.push({ id:uid(), name:n, months:m, p:p, retry:f.retry === '가능', done:false }); f.name = ''; f.months = ''; f.p = ''; save(); render();
}

// ── 실행 계획 ──
function addAction(g) {
  var f = S.af, e = {}, i = clean(f.iff, 80), t = clean(f.then, 80), n = numOf(f.times);
  if (!i) e.iff = '언제·어떤 상황인지 적어 주세요.'; if (!t) e.then = '그때 할 행동을 적어 주세요.'; if (!isFinite(n) || n < 1 || n > 14 || Math.floor(n) !== n) e.times = '한 주에 몇 번인지 1~14의 정수로 적어 주세요.'; if (g.actions.length >= MAXAC) e.iff = '실천 항목은 최대 ' + MAXAC + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); } g.actions.push({ id:uid(), iff:i, then:t, times:n }); f.iff = ''; f.then = ''; f.times = ''; S.msg = '실천 항목을 적어 뒀어요.'; save(); render();
}
function viewActions() {
  var kids = head('실행 계획', '달성할 수 있다고 본 목표만 실행 계획으로 옮깁니다. 구체적인 상황과 행동을 짝지어 적어요(실행 의도).'); kids.push(notice()); var g = cur(); if (!g) return needGoal(kids);
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [picker()])); var r = judge(g, kst());
  if (!r || r.p === null) { kids.push(h('div', { class:'note', id:'pl-a-hold', style:'margin-top:12px', text:'먼저 「달성 가능성」에서 판단을 마쳐 주세요.' })); kids.push(h('div', { class:'rowf', style:'margin-top:8px' }, [btn('달성 가능성으로', 'fill', function () { go('judge'); })])); return kids; }
  if (r.verdict === '어려움') { kids.push(h('div', { class:'note', id:'pl-a-hard', style:'margin-top:12px', text:'지금 조건으로는 달성이 어려워요(' + ptxt(r.p) + '). 기한이나 목표, 단계를 조정해 달성 가능성을 높인 뒤에 실행 계획을 써요.' })); kids.push(h('div', { class:'rowf', style:'margin-top:8px' }, [btn('달성 가능성으로', 'fill', function () { go('judge'); })])); return kids; }
  if (g.kind === '수치 목표') { if (!r.done) kids.push(table(['항목', '값'], rows2([['매달 필요한 양', money(r.req, g.unit)], ['남은 개월 수', r.months + '개월'], ['달성 확률(추정)', ptxt(r.p) + ' (' + r.verdict + ')']]))); }
  else { var sc = stageSchedule(g.stages, kst().slice(0, 7), g.buffer); if (sc && sc.length) kids.push(table(['단계', '시작', '끝(여유 포함)', '기간'], sc.map(function (x) { return h('tr', {}, [h('th', { text:x.name }), h('td', { class:'num', text:x.start }), h('td', { class:'num', text:x.end }), h('td', { class:'num', text:x.months + '개월' })]); }))); }
  var f = S.af, e = S.err;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'실천 항목 쓰기(if-then)' }), h('div', { class:'sub', text:'「이런 상황이면 → 이 행동을 한다」로 적으면 실천 가능성이 높아져요.' }),
    h('div', { class:'frm' }, [field('pl-a-if', '언제·어떤 상황', f.iff, { err:e.iff, max:80, ph:'예: 월급날 저녁이면', set:function (v) { f.iff = v; } }), field('pl-a-then', '할 행동', f.then, { err:e.then, max:80, ph:'예: 자동이체로 80만 원을 적금에 넣는다', set:function (v) { f.then = v; } }), field('pl-a-times', '한 주에 몇 번(1~14)', f.times, { err:e.times, max:2, mode:'numeric', set:function (v) { f.times = v; } })]),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('실천 항목 추가', 'fill', function () { addAction(g); }), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  if (g.actions.length) kids.push(table(['상황', '행동', '주당', ''], g.actions.map(function (a) { return h('tr', {}, [h('td', { text:a.iff }), h('td', { text:a.then }), h('td', { class:'num', text:a.times + '회' }), h('td', {}, [btn('삭제', 'quiet', function () { g.actions = g.actions.filter(function (y) { return y.id !== a.id; }); save(); render(); })])]); })));
  return kids;
}

// ── 실천 점검 ──
function addCheck(g) {
  var f = S.cf, e = {}, ym = clean(f.ym, 7), pl = numOf(f.planned), dn = numOf(f.done), v = null;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) e.ym = '월을 2026-11 형식으로 적어 주세요.';
  if (g.kind === '수치 목표') { var t = String(f.value).replace(/[,\s]/g, ''); if (!/^-?\d+(\.\d+)?$/.test(t) || Math.abs(Number(t)) > 1e13) e.value = '이번 달 증가분을 숫자로 적어 주세요(0 가능).'; else v = Number(t); }
  if (!isFinite(pl) || pl < 1 || pl > 999 || Math.floor(pl) !== pl) e.planned = '계획한 실천 횟수를 1 이상의 정수로 적어 주세요.'; if (!isFinite(dn) || dn < 0 || Math.floor(dn) !== dn || (isFinite(pl) && dn > pl)) e.done = '실제로 한 횟수를 0 이상, 계획 이하의 정수로 적어 주세요.';
  var old = g.checks.filter(function (c) { return c.ym === ym; })[0]; if (!old && g.checks.length >= MAXC) e.ym = '점검은 최대 ' + MAXC + '개월까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  if (g.kind === '수치 목표') g.current += v - (old && old.value !== null ? old.value : 0);
  g.checks = g.checks.filter(function (c) { return c.ym !== ym; }); var rec = { ym:ym, value:v, planned:pl, done:dn, prob:null }; g.checks.push(rec); g.checks.sort(function (a, b) { return a.ym < b.ym ? 1 : -1; });
  var r = judge(g, kst()); rec.prob = r && r.p !== null ? r.p : null; f.value = ''; f.planned = ''; f.done = ''; S.msg = ym + ' 점검을 저장하고 달성 확률을 다시 계산했어요: ' + ptxt(rec.prob); save(); render();
}
function viewTrack() {
  var kids = head('실천 점검', '실행 계획을 실천했는지 기록하고, 달성 확률을 다시 평가합니다.'); kids.push(notice()); var g = cur(); if (!g) return needGoal(kids);
  var f = S.cf, e = S.err; if (!f.ym) f.ym = kst().slice(0, 7);
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [picker(), h('div', { class:'frm' }, [field('pl-c-ym', '월', f.ym, { err:e.ym, max:7, set:function (v) { f.ym = v; } })].concat(g.kind === '수치 목표' ? [field('pl-c-value', '이번 달 증가분(' + g.unit + ')', f.value, { err:e.value, max:16, mode:'numeric', help:'현재 수량에 더해져요', set:function (v) { f.value = v; } })] : [], [field('pl-c-planned', '계획한 실천 횟수', f.planned, { err:e.planned, max:3, mode:'numeric', set:function (v) { f.planned = v; } }), field('pl-c-done', '실제로 한 횟수', f.done, { err:e.done, max:3, mode:'numeric', set:function (v) { f.done = v; } })])),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('점검 저장·재평가', 'fill', function () { addCheck(g); }), S.msg ? h('span', { id:'pl-c-msg', class:'sub', role:'status', text:S.msg }) : null])]));
  var ar = actionRate(g.checks, 3), r = judge(g, kst());
  kids.push(h('div', { class:'g2', style:'margin-top:16px' }, [tile('최근 실천율', ar ? ar.rate + '%' : '—', ar ? '최근 ' + ar.n + '번 점검 기준' : '점검을 기록하면 나와요', 'pl-c-rate'), tile('지금 달성 확률', r ? ptxt(r.p) : '—', r ? r.verdict : '', 'pl-c-p')]));
  if (ar && ar.rate < 60) kids.push(h('div', { class:'note', id:'pl-c-warn', style:'margin-top:12px', text:'실천율이 60% 아래예요. 계획이 너무 무겁다면 횟수를 줄이거나 상황·행동을 더 구체적으로 고쳐 보세요. 확률은 계획대로 실천한다는 가정이 아니라 입력한 이력으로 계산돼요.' }));
  if (!g.checks.length) kids.push(empty('아직 점검 기록이 없어요.')); else kids.push(table(['월', g.kind === '수치 목표' ? '증가분' : '', '실천', '달성 확률', '변화'], g.checks.slice(0, 12).map(function (c, i) { var nx = g.checks[i + 1], ch = nx && nx.prob !== null && c.prob !== null ? Math.round((c.prob - nx.prob) * 100) : null;
    return h('tr', {}, [h('td', { class:'num', text:c.ym }), h('td', { class:'num', text:c.value === null ? '' : money(c.value, g.unit) }), h('td', { class:'num', text:c.done + '/' + c.planned + ' (' + Math.round(c.done / c.planned * 100) + '%)' }), h('td', { class:'num', text:ptxt(c.prob) }), h('td', { class:'num', text:ch === null ? '—' : (ch > 0 ? '▲ ' : ch < 0 ? '▼ ' : '') + Math.abs(ch) + '%p' })]); })));
  kids.push(h('div', { class:'rowf', style:'margin-top:12px' }, [btn('계획 AI에게 묻기', 'quiet', function () { ask('내 목표 「' + g.title + '」의 실천율이 ' + (ar ? ar.rate + '%' : '아직 없음') + '이고 달성 확률은 ' + (r ? ptxt(r.p) : '—') + '입니다. 계획을 어떻게 고치면 좋을까요?'); })]));
  return kids;
}

// ── 계획 원리 ──
function viewTheory() {
  var kids = head('계획 원리', '목표를 세우고 → 달성 가능한지 판단하고 → 계획하고 → 실천을 점검하고 → 확률을 다시 평가합니다.'); kids.push(notice());
  kids.push(table(['이론', '어디에 쓰나요', '화면에서'], rows2([['SMART 목표(로크·레이섬)', '구체적·측정 가능·달성 가능·의미 있는·기한 있는 목표가 성과를 높여요', '목표 만들기(달성 가능성은 다음 탭)'], ['필요 속도 대 과거 속도', '남은 양을 남은 기간으로 나눈 필요 속도를 내 과거 속도와 견줘요', '수치 목표의 달성 확률'], ['단계 분해와 재도전', '긴 목표를 단계로 나눠 기한과 성공 확률, 재도전 여유를 따져요', '단계 목표의 달성 확률'], ['계획 오류(카너먼·트버스키)', '사람은 걸리는 시간을 짧게 잡아요. 예상 기간에 여유를 더해요', '여유 비율(기본 20%)'], ['실행 의도 if-then(골위처)', '「상황이면 행동」으로 정해 두면 실천율이 올라가요', '실행 계획'], ['주기적 재평가', '실제 진행으로 이력을 갱신해 확률을 다시 계산해요', '실천 점검']])));
  kids.push(stepsCard('예: 10년 안에 변호사 자격 취득(단계 목표)', [['단계를 적어요', '예: 학부 졸업 · 로스쿨 입학 · 로스쿨 과정 · 변호사시험. 단계마다 기간과 내가 정한 한 번에 성공할 확률을 넣어요.'], ['확률을 봐요', '필요한 기간이 기한보다 길면 어려움으로 나와요. 여유 기간이 있으면 재도전이 가능한 단계를 한 번 더 시도하는 것으로 계산해요.'], ['실천하고 다시 평가해요', '매달 점검을 기록하고 끝낸 단계는 완료로 표시하면 남은 기간으로 확률이 다시 계산돼요.']]));
  kids.push(stepsCard('예: 30평대 아파트 마련(수치 목표)', [['목표 수량과 현재 수량', '목표 금액과 지금 모은 금액을 넣어요.'], ['이력을 넣어요', '지난 달별로 모은 금액을 3개 이상 넣으면 매달 필요한 금액과 비교해 확률이 나와요.'], ['점검할 때마다 갱신해요', '이번 달 증가분을 넣으면 현재 수량이 늘고 확률이 다시 계산돼요.']], '시세와 대출 조건 같은 바깥 정보는 가져오지 않아요. 부동산·세금·금융 판단은 해당 인프라 AI와 전문가에게 확인하세요.'));
  kids.push(h('div', { class:'rowf', style:'margin-top:12px' }, [btn('계획 AI에게 묻기', 'quiet', function () { ask('내 목표를 SMART 기준으로 점검해 주세요.'); })]));
  return kids;
}

function render() {
  var root = $('pl-root'), tp = $('pl-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar()); jOut = null;
  var kids = S.view === 'judge' ? viewJudge() : S.view === 'actions' ? viewActions() : S.view === 'track' ? viewTrack() : S.view === 'theory' ? viewTheory() : viewHome();
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
  M = el; el.textContent = ''; el.classList.add('pln'); S.goals = []; S.sel = ''; S.err = {}; S.msg = ''; S.gf = { title:'', why:'', kind:'수치 목표', deadline:'', unit:'', target:'', current:'' }; S.sf = { name:'', months:'', p:'', retry:'가능' }; S.af = { iff:'', then:'', times:'' }; S.cf = { ym:'', value:'', planned:'', done:'' }; load();
  if (!S.sel && S.goals.length) S.sel = S.goals[0].id;
  [h('div', { id:'pl-top' }), h('div', { class:'wrap', id:'pl-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'home'; render();
}
window.NaviPlan = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  monthsLeft:monthsLeft, quantFeasibility:quantFeasibility, stageFeasibility:stageFeasibility, stageSchedule:stageSchedule, actionRate:actionRate, parseHist:parseHist,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
