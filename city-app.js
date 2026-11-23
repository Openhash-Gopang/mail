/* city-app.js — 나비웹 도시(인프라 AI · 도시). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviCity.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'open'|'result', 함수)
 * 모양은 city.css(.cty 범위). 전역은 NaviCity 하나만 쓴다.
 *
 * 도시 화면의 개념(주피터 지시): 도시 인프라는 적시조달·계획·감시·사업·일자리 등 모든 인프라의 최적화 결과이자 총합이다.
 * 부동산 인프라는 도시 인프라의 물리적 구현이다.
 * 이 화면은 다른 인프라 화면이 이 브라우저에 저장한 값을 읽어(같은 값을 계산하는 그 화면의 함수를 그대로 쓴다) 한곳에 모아 보여 준다:
 *  readAll(인프라별 지표) · cityScore(가중 종합 점수) · checks(인프라 간 정합성 규칙 점검) · physical(물리 공간 단서).
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 이 브라우저에 저장된 한 사람의 입력으로 그린 도시 모형이다. 여러 시민의 실제 합산이 아니며, 실제 합산은 PDV 의 익명 집계 통계와 연결된 뒤에 가능하다.
 *  - 점수 규칙(균형 100·여유 70 등)과 점검 규칙은 단순한 약속이며 예측이나 정책 결정이 아니다. 가중치는 사용자가 정한다.
 *  - 감시 인프라는 본인만 보는 기록이라 내용을 읽지 않고 기록 개수만 센다.
 *  - 부동산 거래·등기·인허가를 대신하지 않는다. 기록은 이 브라우저(localStorage)에만 저장된다. */
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
var KEY = 'navi-city-v1', MAXSC = 3;
var TABS = [['home', '종합 현황'], ['check', '정합성 점검'], ['score', '도시 점수'], ['scen', '시나리오'], ['phys', '물리 구현'], ['principle', '도시 원리']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var INFRAS = [['jit', '적시조달', 'jit:types', 'navi-jit-v1', 'NaviJit'], ['job', '일자리', 'job:me', 'navi-job-v1', 'NaviJob'], ['plan', '계획', 'plan:home', 'navi-plan-v1', 'NaviPlan'], ['biz', '사업', 'biz:home', 'navi-biz-v1', 'NaviBiz'], ['wch', '감시', 'wch:home', 'navi-watch-v1', null], ['dem', '민주주의', 'dem:mine', 'navi-democracy-v1', null], ['sch', '검색', 'sch:find', 'navi-search-v1', null], ['pub', '행정', 'pub:home', 'navi-public-v1', null]];
var SCORED = ['jit', 'job', 'plan', 'biz'];
var M = null, LS = {};
function blankW() { return { jit:'25', job:'25', plan:'25', biz:'25' }; }
var S = { view:'home', w:blankW(), scen:[], f:{ name:'' }, err:{}, msg:'' };

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

function rows2(rows) { return rows.map(function (r) { return h('tr', {}, r.map(function (t, i) { return h(i ? 'td' : 'th', { text:t }); })); }); }
function nf(n) { return n === null || n === undefined || !isFinite(n) ? '—' : Math.round(n).toLocaleString('ko-KR'); }
function pc(x) { return x === null || x === undefined || !isFinite(x) ? '—' : Math.round(x * 1000) / 10 + '%'; }

// ── 읽기·계산 ──
function lib(n) { return n && window[n] ? window[n] : null; }
function raw(key) { try { var v = JSON.parse(localStorage.getItem(key) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }
function countRecs(v) { if (!v) return 0; var n = 0; Object.keys(v).forEach(function (k) { if (Array.isArray(v[k])) n += v[k].length; }); return n; }
function none(why) { return { state:'input', score:null, text:why }; }
function loading(name) { return { state:'lib', score:null, text:name + ' 계산 코드를 불러오지 못했어요.' }; }
function fx(n, d) { return n === null || n === undefined || !isFinite(n) ? '—' : (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('ko-KR'); }
function readJit() {
  var L = lib('NaviJit'), v = raw('navi-jit-v1'); if (!L) return loading('적시조달'); if (!v || !(v.pts || []).length || !(v.sites || []).length) return none('수요 지점과 후보 거점을 아직 적지 않았어요.');
  var pk = 1, c = v.days ? L.dailyCurve(v.days.year, v.days.months, v.days.dows) : null; if (c) pk = c.peakRatio; var ev = L.evalSites(v.pts, v.sites, v.geo || {}, pk); if (!ev) return none('속도·우회 계수 등 값이 비어 있거나 틀려요.');
  var dem = v.pts.reduce(function (s, p) { return s + Number(p.w); }, 0), cap = v.sites.reduce(function (s, p) { return s + Number(p.cap); }, 0);
  if (!ev.feasible) return { state:'ok', score:20, verdict:'처리 능력 부족', text:ev.overloaded.join(', ') + ' 거점의 능력이 모자라요.', demand:dem, cap:cap };
  if (ev.peakOver.length) return { state:'ok', score:60, verdict:'첨두일 과부하', text:'평소엔 괜찮지만 첨두일에 ' + ev.peakOver.join(', ') + ' 거점이 넘쳐요(이동+대기 ' + fx(ev.total, 2) + '시간).', demand:dem, cap:cap, total:ev.total };
  return { state:'ok', score:100, verdict:'여유', text:'이동+대기 ' + fx(ev.total, 2) + '시간, 거점 능력이 첨두일에도 충분해요.', demand:dem, cap:cap, total:ev.total };
}
function readJob() {
  var L = lib('NaviJob'), v = raw('navi-job-v1'); if (!L) return loading('일자리'); if (!v || !(v.items || []).length) return none('수요 품목을 아직 적지 않았어요.');
  var d = L.humanHours(v.items), sup = d ? L.supplyOf(v.as || {}) : null; if (!d || !d.rows.length) return none('사람이 해야 할 노동이 남는 품목이 없어요.'); if (!sup) return none('취업 인구·실직률 등 가정을 아직 다 넣지 않았어요.');
  var b = L.balance(d.total, sup); if (!b || b.verdict === '수요 없음') return none('사람이 해야 할 노동 수요가 없어요.');
  var sc = b.verdict === '균형' ? 100 : b.verdict === '인력 여유' ? 70 : 30; return { state:'ok', score:sc, verdict:b.verdict, text:'필요 ' + fx(b.need, 0) + '명, 의무 대상 ' + fx(b.eligible, 0) + '명(' + b.verdict + ').', need:b.need, eligible:b.eligible };
}
function ymNow() { return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul' }).format(new Date()); }
function judgeGoal(L, g, today) {
  if (!g || typeof g !== 'object') return null; var hist = (Array.isArray(g.hist) ? g.hist : []).map(Number).filter(isFinite).concat((Array.isArray(g.checks) ? g.checks : []).filter(function (c) { return c && c.value !== null && c.value !== undefined && isFinite(Number(c.value)); }).slice().sort(function (a, b) { return a.ym < b.ym ? -1 : 1; }).map(function (c) { return Number(c.value); })).slice(-24);
  if (g.kind === '수치 목표') return L.quantFeasibility({ target:g.target, current:g.current, deadline:g.deadline, today:today, hist:hist });
  var mo = L.monthsLeft(g.deadline, today); if (mo === null) return null; var st = Array.isArray(g.stages) ? g.stages : [];
  return mo <= 0 && st.some(function (s) { return !s.done; }) ? { p:0, verdict:'어려움' } : L.stageFeasibility(st, mo, g.buffer);
}
function readPlan() {
  var L = lib('NaviPlan'), v = raw('navi-plan-v1'); if (!L) return loading('계획'); var gs = v && Array.isArray(v.goals) ? v.goals : []; if (!gs.length) return none('목표를 아직 적지 않았어요.');
  var today = ymNow(), ps = [], hard = 0, hold = 0; gs.forEach(function (g) { var r = judgeGoal(L, g, today); if (!r || r.p === null || r.p === undefined) hold++; else { ps.push(r.p); if (r.verdict === '어려움') hard++; } });
  if (!ps.length) return { state:'input', score:null, text:'목표 ' + gs.length + '개 모두 판단 보류예요(이력이 더 필요해요).', goals:gs.length, hard:0 };
  var avg = ps.reduce(function (s, x) { return s + x; }, 0) / ps.length; return { state:'ok', score:Math.round(avg * 100), verdict:hard ? '어려운 목표 ' + hard + '개' : '무난', text:'목표 ' + gs.length + '개, 판단한 ' + ps.length + '개의 평균 달성 확률 ' + Math.round(avg * 100) + '%' + (hold ? '(보류 ' + hold + '개)' : '') + '.', goals:gs.length, hard:hard };
}
function readBiz() {
  var L = lib('NaviBiz'), v = raw('navi-biz-v1'); if (!L) return loading('사업'); if (!v || !v.as) return none('사업 가정을 아직 적지 않았어요.'); var r = L.assessStart(v.as); if (!r) return none('시장·나·돈 점검 값을 아직 다 넣지 않았어요.');
  var sc = r.verdict === '진행 가능' ? 100 : r.verdict === '보완 후 시작' ? 60 : 25; return { state:'ok', score:sc, verdict:r.verdict, text:'시작 전 판단: ' + r.verdict + '(3가지 중 ' + r.passes + '가지 통과).' };
}
function readCount(key, what, extra) { var v = raw(key), n = countRecs(v); return n ? { state:'count', score:null, text:what + ' ' + n + '건' + (extra || '') + '.' } : none('기록이 아직 없어요.'); }
/** 인프라별 지표: 점수가 있는 것(적시조달·일자리·계획·사업)과 기록 개수만 세는 것(감시·민주주의·검색·행정). */
function readAll() {
  return { jit:readJit(), job:readJob(), plan:readPlan(), biz:readBiz(), wch:readCount('navi-watch-v1', '기록', '(내용은 읽지 않음)'), dem:readCount('navi-democracy-v1', '청원 기록'), sch:readCount('navi-search-v1', '검색 데이터'), pub:readCount('navi-public-v1', '행정 기록') };
}
/** 종합 점수: 점수가 있는 인프라만 가중 평균(가중치 0 이하와 입력 전은 제외). 쓸 수 있는 인프라가 없으면 null. */
function cityScore(inds, w) {
  if (!inds || !w) return null; var sum = 0, tot = 0, used = [];
  SCORED.forEach(function (k) { var i = inds[k], x = numOf(w[k]); if (!i || i.score === null || i.score === undefined || !isFinite(x) || x <= 0) return; sum += x * i.score; tot += x; used.push(k); });
  return tot > 0 ? { score:sum / tot, used:used, missing:SCORED.filter(function (k) { return used.indexOf(k) < 0; }) } : null;
}
/** 정합성 점검: 인프라 사이의 규칙 기반 참고 점검. ok true=서로 맞음, false=어긋남, null=입력이 모자라 판단 못 함. */
function checks(inds) {
  if (!inds) return null; var j = inds.jit, o = inds.job, p = inds.plan, b = inds.biz, out = [];
  function has(i) { return i && i.state === 'ok'; }
  if (has(j) && has(o)) {
    var jok = j.score === 100, lack = o.verdict === '인력 부족', spare = o.verdict === '인력 여유';
    out.push(lack && jok ? { k:'공급 × 노동', ok:false, msg:'공급 거점은 충분한데 일할 사람이 모자라요. 의무 근로 시간이나 대체 비율을 다시 보세요.' } : spare && !jok ? { k:'공급 × 노동', ok:false, msg:'일할 사람은 남는데 거점 처리 능력이 모자라요. 거점을 늘리고 인력을 거기에 배치하세요.' } : lack && !jok ? { k:'공급 × 노동', ok:false, msg:'거점 능력도 인력도 모자라요. 둘 다 보강이 필요해요.' } : { k:'공급 × 노동', ok:true, msg:'거점 능력과 인력 수요가 서로 크게 어긋나지 않아요.' });
  } else out.push({ k:'공급 × 노동', ok:null, msg:'적시조달과 일자리의 입력이 둘 다 있어야 점검할 수 있어요.' });
  if (has(b) && has(o)) out.push(b.verdict === '진행 가능' && o.verdict === '인력 부족' ? { k:'사업 × 노동', ok:false, msg:'사업은 진행 가능하지만 일할 사람이 모자라 채용이 어려울 수 있어요.' } : { k:'사업 × 노동', ok:true, msg:'사업 판단과 인력 상황이 서로 충돌하지 않아요.' }); else out.push({ k:'사업 × 노동', ok:null, msg:'사업과 일자리의 입력이 둘 다 있어야 점검할 수 있어요.' });
  if (has(p)) out.push(p.hard ? { k:'계획', ok:false, msg:'달성이 어려운 목표가 ' + p.hard + '개 있어요. 기한이나 목표를 다시 정하세요.' } : { k:'계획', ok:true, msg:'어려움으로 판단된 목표가 없어요.' }); else out.push({ k:'계획', ok:null, msg:'계획의 달성 가능성을 판단할 수 있게 목표를 적어 주세요.' });
  var n = SCORED.filter(function (k) { return has(inds[k]); }).length; out.push({ k:'입력 완결도', ok:n === SCORED.length ? true : null, msg:n === SCORED.length ? '네 인프라가 모두 계산돼 종합이 비교적 온전해요.' : '점수가 있는 인프라 ' + n + '/' + SCORED.length + '개만 반영돼 종합이 한쪽으로 치우칠 수 있어요.' });
  return out;
}
/** 물리 공간 단서: 도시 모형이 요구하는 공간. 후보 거점 수·거점 하루 능력(적시조달), 일자리 수용 인원, 근린 거점 수(공급 계층 가정). 없으면 해당 항목을 뺀다. */
function physical() {
  var out = [], j = raw('navi-jit-v1'), o = readJob();
  if (j && (j.sites || []).length) out.push(['물류 거점(후보)', j.sites.length + '곳', '하루 처리 능력 합 ' + fx(j.sites.reduce(function (s, x) { return s + Number(x.cap || 0); }, 0), 0)]);
  if (j && Array.isArray(j.tiers) && j.tiers[3] && numOf(j.tiers[3].n) > 0) out.push(['근린 거점(공급 계층 가정)', fx(numOf(j.tiers[3].n), 0) + '곳', '생활권 가까이에 두는 거점']);
  if (o.state === 'ok') out.push(['일자리 사업장 수용 인원', fx(o.need, 0) + '명', '의무 대상 ' + fx(o.eligible, 0) + '명 중 필요한 인원']);
  return out;
}
function load() {
  try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v || typeof v !== 'object') return;
    if (v.w && typeof v.w === 'object') SCORED.forEach(function (k) { if (v.w[k] !== undefined) S.w[k] = clean(v.w[k], 6); });
    S.scen = (Array.isArray(v.scen) ? v.scen : []).map(function (x) { if (!x || typeof x !== 'object') return null; var n = clean(x.name, 30), t = Number(x.total); if (!n || !isFinite(t) || t < 0 || t > 100) return null; var sc = {}, w = {}; SCORED.forEach(function (k) { var a = x.scores && x.scores[k]; sc[k] = a === null || a === undefined ? null : (isFinite(Number(a)) ? Number(a) : null); w[k] = clean(x.w && x.w[k], 6); }); return { id:clean(x.id, 20) || uid(), name:n, date:clean(x.date, 10), total:t, scores:sc, w:w }; }).filter(Boolean).slice(0, MAXSC); } catch (e) {}
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ w:S.w, scen:S.scen })); } catch (e) {} }

function topbar() {
  return h('div', { class:'topin' }, [
    h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 도시' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function notice() {
  return h('div', { class:'note info', style:'margin:16px 0', id:'ct-note', text:'이 화면은 이 브라우저에 저장된 한 사람의 입력으로 그린 도시 모형이에요. 여러 시민의 실제 합산이 아니며, 실제 합산은 PDV의 익명 집계 통계와 연결된 뒤에 가능해요. 점수와 점검은 단순한 규칙이라 예측이나 정책 결정이 아니고, 감시 기록은 본인만 보는 것이라 내용을 읽지 않고 개수만 세요. 부동산 거래·등기·인허가는 대신하지 않고, 적은 내용은 이 브라우저에만 저장됩니다.' });
}
var STATE = { ok:['계산됨', 'ok'], input:['입력 전', ''], count:['기록만', ''], lib:['불러오기 실패', ''] };

// ── 종합 현황 ──
function viewHome() {
  var kids = head('종합 현황', '도시는 모든 인프라가 낸 최적화 결과의 총합이에요. 각 인프라가 지금 어디까지 계산됐는지 한눈에 봅니다.'); kids.push(notice()); var inds = readAll();
  kids.push(table(['인프라', '상태', '요약', ''], INFRAS.map(function (f) { var i = inds[f[0]], st = STATE[i.state] || STATE.input; return h('tr', {}, [h('th', { text:f[1] }), h('td', {}, [pill(st[0], st[1])]), h('td', { id:'ct-h-' + f[0], text:(i.verdict ? i.verdict + ' — ' : '') + i.text }), h('td', {}, [btn('열기', 'quiet', function () { emit('open', f[2]); })])]); })));
  var cs = cityScore(inds, S.w); kids.push(h('div', { class:'g2', style:'margin-top:16px' }, [tile('도시 종합 점수', cs ? Math.round(cs.score) + '점' : '—', cs ? '반영한 인프라 ' + cs.used.length + '/' + SCORED.length + '개' : '점수가 있는 인프라가 없어요', 'ct-h-score'), tile('계산된 인프라', SCORED.filter(function (k) { return inds[k].state === 'ok'; }).length + '/' + SCORED.length + '개', '적시조달·일자리·계획·사업', 'ct-h-n')]));
  return kids;
}

// ── 정합성 점검 ──
function viewCheck() {
  var kids = head('정합성 점검', '인프라끼리 맞물리는 값이 서로 어긋나지 않는지 규칙으로 점검합니다.'); kids.push(notice()); var cs = checks(readAll());
  kids.push(table(['점검', '결과', '내용'], cs.map(function (c, i) { return h('tr', {}, [h('th', { text:c.k }), h('td', { id:'ct-c-' + i, text:c.ok === true ? '맞음' : c.ok === false ? '어긋남' : '판단 못 함' }), h('td', { text:c.msg })]); })));
  kids.push(h('div', { class:'sub', style:'margin-top:8px', text:'점검은 단순한 규칙이라 참고용이에요. 어긋남은 오류가 아니라 어느 인프라의 가정을 다시 봐야 한다는 신호예요.' }));
  return kids;
}

// ── 도시 점수 ──
var sOut = null;
function updS() {
  if (!sOut) return; sOut.textContent = ''; var inds = readAll(), cs = cityScore(inds, S.w);
  if (!cs) { sOut.appendChild(h('div', { class:'note', id:'ct-s-none', text:'점수가 있는 인프라(적시조달·일자리·계획·사업)를 먼저 계산하고 가중치를 0보다 크게 넣어 주세요.' })); return; }
  sOut.appendChild(h('div', { class:'g2' }, [tile('도시 종합 점수', Math.round(cs.score) + '점', '가중 평균(0~100)', 'ct-s-total')]));
  sOut.appendChild(table(['인프라', '점수', '가중치', '판정'], SCORED.map(function (k) { var i = inds[k], f = INFRAS.filter(function (x) { return x[0] === k; })[0]; return h('tr', {}, [h('th', { text:f[1] }), h('td', { class:'num', text:i.score === null ? '—' : String(i.score) }), h('td', { class:'num', text:S.w[k] || '0' }), h('td', { text:i.score === null ? '입력 전이라 제외' : (i.verdict || '') })]); })));
  if (cs.missing.length) sOut.appendChild(h('div', { class:'sub', style:'margin-top:8px', id:'ct-s-miss', text:'반영하지 못한 인프라: ' + cs.missing.map(function (k) { return INFRAS.filter(function (x) { return x[0] === k; })[0][1]; }).join(', ') + '. 가중치는 반영한 인프라끼리 다시 나눠요.' }));
}
function viewScore() {
  var kids = head('도시 점수', '각 인프라의 결과를 사용자가 정한 가중치로 합친 종합 점수예요.'); kids.push(notice());
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'가중치' }), h('div', { class:'sub', text:'무엇을 더 중요하게 볼지 정해요(0 이상, 합이 100일 필요는 없어요). 인프라 점수 규칙: 균형·진행 가능·여유 100점, 보완 필요 60점 안팎, 부족·재검토 20~30점, 계획은 목표 달성 확률 평균이에요.' }),
    h('div', { class:'frm' }, SCORED.map(function (k) { var f = INFRAS.filter(function (x) { return x[0] === k; })[0]; return field('ct-w-' + k, f[1] + ' 가중치', S.w[k], { max:6, mode:'decimal', set:function (v) { S.w[k] = clean(v, 6); save(); updS(); } }); }))]));
  sOut = h('div', { id:'ct-s-out', style:'margin-top:16px' }); kids.push(sOut); updS(); return kids;
}

// ── 시나리오 ──
function saveScen() {
  var n = clean(S.f.name, 30), e = {}, inds = readAll(), cs = cityScore(inds, S.w);
  if (!n) e.name = '이름을 적어 주세요(예: 일자리 가중치 높임).'; else if (!cs) e.name = '점수가 있는 인프라가 없어 저장할 수 없어요.'; else if (S.scen.length >= MAXSC) e.name = '시나리오는 최대 ' + MAXSC + '개까지예요. 하나를 지우고 저장하세요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  var sc = {}, w = {}; SCORED.forEach(function (k) { sc[k] = inds[k].score; w[k] = S.w[k]; }); S.scen.push({ id:uid(), name:n, date:kst(), total:cs.score, scores:sc, w:w }); S.f.name = ''; S.msg = '지금 상태를 시나리오로 저장했어요.'; save(); render();
}
function viewScen() {
  var kids = head('시나리오', '지금의 입력과 가중치를 이름 붙여 저장해 두고 나란히 비교합니다. 저장한 시점의 점수예요.'); kids.push(notice());
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('div', { class:'frm' }, [field('ct-n-name', '시나리오 이름', S.f.name, { err:S.err.name, max:30, ph:'예: 일자리 가중치 높임', set:function (v) { S.f.name = v; } })]), h('div', { class:'rowf', style:'margin-top:8px' }, [btn('지금 상태 저장', 'fill', saveScen), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null]), h('div', { class:'sub', text:'다른 인프라 화면에서 가정을 바꾼 뒤 다시 저장하면 서로 비교할 수 있어요.' })]));
  if (!S.scen.length) { kids.push(empty('저장한 시나리오가 아직 없어요.')); return kids; }
  kids.push(table(['시나리오', '저장일', '종합', '적시조달', '일자리', '계획', '사업', ''], S.scen.map(function (x) { return h('tr', {}, [h('th', { text:x.name }), h('td', { text:x.date }), h('td', { class:'num', text:Math.round(x.total) + '점' }), h('td', { class:'num', text:x.scores.jit === null ? '—' : String(x.scores.jit) }), h('td', { class:'num', text:x.scores.job === null ? '—' : String(x.scores.job) }), h('td', { class:'num', text:x.scores.plan === null ? '—' : String(x.scores.plan) }), h('td', { class:'num', text:x.scores.biz === null ? '—' : String(x.scores.biz) }), h('td', {}, [btn('삭제', 'quiet', function () { S.scen = S.scen.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]); })));
  if (S.scen.length > 1) { var best = S.scen.slice().sort(function (a, b) { return b.total - a.total; })[0]; kids.push(h('div', { class:'sub', style:'margin-top:8px', id:'ct-n-best', text:'종합 점수가 가장 높은 것은 「' + best.name + '」(' + Math.round(best.total) + '점)이에요. 가중치가 다르면 점수를 곧바로 견줄 수는 없어요.' })); }
  return kids;
}

// ── 물리 구현 ──
function viewPhys() {
  var kids = head('물리 구현', '도시 인프라가 계산한 최적 결과를 땅과 건물로 옮기는 것이 부동산 인프라예요.'); kids.push(notice());
  kids.push(table(['도시 인프라', '부동산 인프라(물리적 구현)'], rows2([['어디에 둘지(최적 지점)', '부지 확보, 용도지역·건폐율·용적률 검토, 시세·감정 평가'], ['무엇을 지을지(거점·사업장)', '건물 짓기·임대·매매 계약과 특약, 권리 분석(등기부)'], ['누가 쓸지(인력·시민)', '임대차 보증금 보호, 전월세, 입주'], ['돈을 어떻게 댈지', '취득세·보유세·양도세, 대출과 담보']])));
  var ph = physical(); kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'내 도시 모형이 요구하는 공간 단서' }), ph.length ? table(['항목', '규모', '설명'], ph.map(function (r) { return h('tr', {}, [h('th', { text:r[0] }), h('td', { class:'num', text:r[1] }), h('td', { text:r[2] })]); })) : h('div', { class:'empty', id:'ct-p-none', text:'적시조달의 후보 거점이나 일자리의 필요 인원을 계산하면 여기에 나와요.' }), h('div', { class:'sub', text:'이 값은 입력한 가정에서 나온 단서예요. 실제 부지·시세·거래는 부동산 인프라 AI와 전문가에게 확인하세요.' }), h('div', { class:'rowf', style:'margin-top:8px' }, [btn('부동산 AI에게 묻기', 'quiet', function () { ask('도시 모형에서 나온 물류 거점과 사업장을 실제 부지로 옮기려면 어떤 순서로 검토해야 하나요?'); })])]));
  return kids;
}

// ── 도시 원리 ──
function viewPrinciple() {
  var kids = head('도시 원리', '도시는 모든 인프라 최적화 결과의 총합이고, 그 물리적 구현이 부동산이에요.'); kids.push(notice());
  kids.push(stepsCard('도시가 만들어지는 순서', [['수요를 알아요', '개인·기업·기관의 일상을 기록하는 PDV의 집계 통계가 적시조달·일자리·사업의 수요가 돼요.'], ['각 인프라가 최적화해요', '적시조달은 거리와 대기를, 일자리는 인력 배치를, 계획과 사업은 목표와 성과를 최적화해요.'], ['도시가 총합을 봐요', '결과를 한곳에 모아 서로 어긋나는 곳을 찾고 종합 점수로 비교해요.'], ['부동산이 물리로 옮겨요', '정해진 지점과 규모를 부지와 건물, 계약과 등기로 구현해요.']], '이 화면은 한 사람의 입력으로 그린 모형이고, 여러 시민의 실제 합산은 PDV 집계 통계와 연결된 뒤에 가능해요.'));
  kids.push(table(['한계', '내용'], rows2([['범위', '이 브라우저에 저장된 한 사람의 입력만 읽어요. 다른 사람의 값은 볼 수 없어요.'], ['점수', '규칙이 단순하고 가중치는 사용자가 정해요. 예측이나 정책 결정이 아니에요.'], ['감시', '본인만 보는 기록이라 내용은 읽지 않고 개수만 세요.'], ['실행', '부동산 거래·등기·인허가를 대신하지 않아요.']])));
  kids.push(h('div', { class:'rowf', style:'margin-top:12px' }, [btn('도시 AI에게 묻기', 'quiet', function () { ask('여러 인프라의 최적화 결과가 서로 충돌할 때 도시는 어떤 기준으로 조정해야 하나요?'); })]));
  return kids;
}

function render() {
  var root = $('ct-root'), tp = $('ct-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar()); sOut = null;
  var kids = S.view === 'check' ? viewCheck() : S.view === 'score' ? viewScore() : S.view === 'scen' ? viewScen() : S.view === 'phys' ? viewPhys() : S.view === 'principle' ? viewPrinciple() : viewHome();
  kids.forEach(function (k) { if (k) root.appendChild(k); });
}
function reply(okk, msg) { emit('result', { ok:okk, msg:msg, view:S.view }); }
function nav(a) {
  var d = a && typeof a['do'] === 'string' ? a['do'] : '';
  if (VIEWS.indexOf(d) >= 0) { go(d); return reply(true, TABS[VIEWS.indexOf(d)][1] + ' 화면으로 이동했습니다.'); }
  return reply(false, '지원하지 않는 요청입니다.');
}
function mount(el, o) {
  if (!el) return; o = o || {};
  M = el; el.textContent = ''; el.classList.add('cty'); S.w = blankW(); S.scen = []; S.f = { name:'' }; S.err = {}; S.msg = ''; load();
  [h('div', { id:'ct-top' }), h('div', { class:'wrap', id:'ct-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'home'; render();
}
window.NaviCity = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  readAll:readAll, cityScore:cityScore, checks:checks, physical:physical,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
