/* jit-app.js — 나비웹 적시조달(인프라 AI · 조달). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviJit.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 jit.css(.jit 범위). 전역은 NaviJit 하나만 쓴다.
 *
 * 적시조달의 개념(주피터 지시): 한국민이 하루에 소비하는 재화와 용역을 파악하고(365일, 언제 얼마나), 각 재화·용역의 생산·공급 방법을 정하고,
 * 이동 거리와 대기 시간의 합이 가장 작은 최적 지점(Optimal Point)을 계산한다.
 * 수만 종의 재화·용역이 서로 다른 곳에서 만들어지고 다른 경로로 옮겨져 다른 곳·때·사람이 소비하므로 정확한 모형은 불가능하다 → 단순화 방법론:
 *  ① 품목 유형화(ABC 매출 비중 × XYZ 수요 변동) ② 지역 격자(수요 지점으로 묶기) ③ 대표일(연중 곡선의 첨두·최저일) ④ 공급 4계층(전국·광역·지역·근린)과 연속 근사 ⑤ 개인 기록이 아닌 집계 통계만 계산에 사용.
 * 수요 자료의 원천은 개인·기업·기관의 일상과 업무를 기록하는 PDV 의 익명 집계 통계다(주피터: 적시조달은 PDV 의 효용이 발휘되는 지점). 아직 연결하지 않아 지금은 직접 입력한다.
 * 이 화면은 입력한 값으로 계산·기록만 한다: classify(품목 유형) · dailyCurve(대표일) · tierCosts(계층 비교) · evalSites(거점 평가) · bestSingle(단일 거점) · freeOptimum(자유 최적점).
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 실제 소비·물류 통계, 도로망·지도는 연결하지 않았다. 거리는 직선 거리에 우회 계수를 곱한 근사이고 모든 값은 사용자의 가정이다. 계층별 대기 시간·불확실 벌점의 기본값은 예시다.
 *  - 결과는 가정을 바꾸면 달라지는 모의 계산이며 예측이나 계획 결정이 아니다. 근사 오차 범위(거리 ±15%)에서 결론이 바뀌는지 함께 보여 준다.
 *  - 주문·배송·발주를 실제로 하지 않는다. 기록은 이 브라우저(localStorage)에만 저장된다. */
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
var KEY = 'navi-jit-v1', MAXI = 60, MAXP = 20, MAXS = 20;
var TABS = [['types', '품목 유형'], ['days', '대표일 수요'], ['grid', '지역 수요'], ['supply', '공급 계층'], ['optimum', '최적 지점'], ['principle', '조달 원리']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'], DOWS = ['월', '화', '수', '목', '금', '토', '일'];
var M = null, LS = {};
function defTiers() { return [{ name:'전국', n:'1', wait:'48', pen:'0' }, { name:'광역', n:'17', wait:'24', pen:'2' }, { name:'지역', n:'250', wait:'12', pen:'5' }, { name:'근린', n:'3500', wait:'4', pen:'10' }]; }
function blankDays() { return { year:'', months:MONTHS.map(function () { return ''; }), dows:DOWS.map(function () { return ''; }) }; }
var S = { view:'types', items:[], days:blankDays(), pts:[], sites:[], geo:{ area:'100000', speed:'50', circ:'1.3' }, tiers:defTiers(),
  f:{ name:'', annual:'', cv:'', urg:'3', scale:'2' }, fp:{ name:'', x:'', y:'', w:'' }, fs:{ name:'', x:'', y:'', svc:'', cap:'' }, err:{}, msg:'' };

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

// ── 계산 ──
function ok(n, lo, hi) { return isFinite(n) && n >= lo && n <= hi; }
/** 품목 유형화: 연간 규모 내림차순 누적 비중(앞까지 80% 미만 A, 95% 미만 B, 나머지 C) × 수요 변동계수(50% 미만 X, 100% 미만 Y, 나머지 Z). 값이 틀리면 null. */
function classify(items) {
  if (!Array.isArray(items) || !items.length) return null; var tot = 0, i, x;
  for (i = 0; i < items.length; i++) { x = items[i]; if (!x || !ok(Number(x.annual), 1e-12, 1e18) || !ok(Number(x.cv), 0, 1000)) return null; tot += Number(x.annual); }
  var rows = items.map(function (y) { return { name:y.name, annual:Number(y.annual), cv:Number(y.cv) }; }).sort(function (a, b) { return b.annual - a.annual; }), cum = 0, cls = {};
  rows.forEach(function (r) { var before = cum / tot; r.abc = before < 0.8 ? 'A' : before < 0.95 ? 'B' : 'C'; cum += r.annual; r.xyz = r.cv < 50 ? 'X' : r.cv < 100 ? 'Y' : 'Z'; r.cls = r.abc + r.xyz; r.share = r.annual / tot; cls[r.cls] = (cls[r.cls] || 0) + 1; });
  return { n:rows.length, classes:cls, nClasses:Object.keys(cls).length, rows:rows };
}
/** 대표일: 월별·요일별 배수(비우면 1)를 곱해 평균 1이 되게 정규화한 365(366)일 곡선의 첨두·최저일. */
function dailyCurve(year, months, dows) {
  var y = numOf(year); if (!ok(y, 1900, 2200) || Math.floor(y) !== y || !Array.isArray(months) || months.length !== 12 || !Array.isArray(dows) || dows.length !== 7) return null;
  function fac(a) { var o = []; for (var i = 0; i < a.length; i++) { var v = a[i] === '' || a[i] == null ? 1 : numOf(a[i]); if (!ok(v, 1e-6, 100)) return null; o.push(v); } return o; }
  var mf = fac(months), df = fac(dows); if (!mf || !df) return null;
  var d0 = Date.UTC(y, 0, 1), n = (Date.UTC(y + 1, 0, 1) - d0) / 864e5, w = [], sum = 0, k, dt;
  for (k = 0; k < n; k++) { dt = new Date(d0 + k * 864e5); var v2 = mf[dt.getUTCMonth()] * df[(dt.getUTCDay() + 6) % 7]; w.push(v2); sum += v2; }
  var mean = sum / n, pk = 0, mn = 0; w = w.map(function (v) { return v / mean; }); for (k = 1; k < n; k++) { if (w[k] > w[pk]) pk = k; if (w[k] < w[mn]) mn = k; }
  function ds(i) { return new Date(d0 + i * 864e5).toISOString().slice(0, 10); }
  return { days:n, peak:w[pk], peakDate:ds(pk), min:w[mn], minDate:ds(mn), peakRatio:w[pk] };
}
/** 계층 비교(연속 근사): 한 계층에 거점이 n개이면 서비스 구역 평균 이동 거리 ≈ 0.3826·√(면적/n)·우회 계수·거리 배수. 비용 J = 긴급도 × (이동 시간 + 대기 시간) + 규모 × 불확실 벌점. 거리 ±15%에서도 같은 계층이 이기는지 본다. */
function tierCosts(item, tiers, geo, mult) {
  if (!item || !Array.isArray(tiers) || !tiers.length || !geo) return null; var u = numOf(item.urg), sc = Number(item.scale), a = numOf(geo.area), sp = numOf(geo.speed), ci = numOf(geo.circ);
  if (!ok(u, 1, 5) || !ok(sc, 0, 5) || !ok(a, 1e-6, 1e9) || !ok(sp, 1e-6, 1e4) || !ok(ci, 1, 5)) return null;
  function one(m) { var rows = [], b = 0, i; for (i = 0; i < tiers.length; i++) { var t = tiers[i], n = numOf(t.n), w = numOf(t.wait), p = numOf(t.pen); if (!ok(n, 1, 1e7) || !ok(w, 0, 1e5) || !ok(p, 0, 1e5)) return null;
      var dist = 0.3826 * Math.sqrt(a / n) * ci * m, tr = dist / sp, J = u * (tr + w) + sc * p; rows.push({ name:t.name, dist:dist, travel:tr, wait:w, J:J }); if (J < rows[b].J) b = i; } return { rows:rows, best:b }; }
  var base = one(mult || 1); if (!base) return null; var lo = one(0.85), hi = one(1.15); base.stable = lo.best === base.best && hi.best === base.best; return base;
}
function dist2(a, b) { return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)); }
function goodPts(pts) { if (!Array.isArray(pts) || !pts.length) return false; for (var i = 0; i < pts.length; i++) { var p = pts[i]; if (!p || !ok(Number(p.x), 0, 1e5) || !ok(Number(p.y), 0, 1e5) || !ok(Number(p.w), 1e-12, 1e15)) return false; } return true; }
function goodSites(ss) { if (!Array.isArray(ss) || !ss.length) return false; for (var i = 0; i < ss.length; i++) { var s = ss[i]; if (!s || !ok(Number(s.x), 0, 1e5) || !ok(Number(s.y), 0, 1e5) || !ok(Number(s.svc), 1e-9, 1e4) || !ok(Number(s.cap), 1e-12, 1e15)) return false; } return true; }
/** 거점 평가: 수요 지점은 가장 가까운 후보 거점으로 가고, 이동 시간 = 직선 거리 × 우회 계수 ÷ 속도, 대기 시간 = M/M/1 평균 대기 s·ρ/(1−ρ)(s=1건 처리 시간, ρ=하루 수요/처리 능력). 첨두 배수를 곱한 ρ 가 1 이상이면 첨두일 과부하. 평균 ρ 가 1 이상이면 불가능. */
function evalSites(pts, sites, geo, peak) {
  if (!goodPts(pts) || !goodSites(sites) || !geo) return null; var sp = numOf(geo.speed), ci = numOf(geo.circ), pk = peak === undefined || peak === null || peak === '' ? 1 : Number(peak); if (!ok(sp, 1e-6, 1e4) || !ok(ci, 1, 5) || !ok(pk, 1, 1e3)) return null;
  var load = sites.map(function () { return 0; }), dsum = 0, wsum = 0, i, j;
  for (i = 0; i < pts.length; i++) { var p = { x:Number(pts[i].x), y:Number(pts[i].y) }, w = Number(pts[i].w), b = 0, bd = Infinity; for (j = 0; j < sites.length; j++) { var d = dist2(p, { x:Number(sites[j].x), y:Number(sites[j].y) }); if (d < bd) { bd = d; b = j; } } load[b] += w; dsum += w * bd * ci; wsum += w; }
  var rows = sites.map(function (s, k) { var rho = load[k] / Number(s.cap), svc = Number(s.svc); return { name:s.name, load:load[k], rho:rho, rhoPeak:rho * pk, wait:rho < 1 ? svc * rho / (1 - rho) : Infinity }; });
  var over = rows.filter(function (r) { return r.rho >= 1; }).map(function (r) { return r.name; }), peakOver = rows.filter(function (r) { return r.rho < 1 && r.rhoPeak >= 1; }).map(function (r) { return r.name; });
  var avgDist = dsum / wsum, travel = avgDist / sp; if (over.length) return { feasible:false, overloaded:over, rows:rows, avgDist:avgDist, travel:travel };
  var wait = rows.reduce(function (s, r, k) { return s + r.wait * load[k]; }, 0) / wsum; return { feasible:true, rows:rows, avgDist:avgDist, travel:travel, wait:wait, total:travel + wait, peakOver:peakOver };
}
/** 단일 거점: 후보를 하나씩 유일한 거점으로 두고 평가해 이동+대기 시간이 짧은 순(불가능은 뒤로). */
function bestSingle(pts, sites, geo, peak) {
  if (!goodSites(sites)) return null; var out = [], bad = false;
  sites.forEach(function (s) { var r = evalSites(pts, [s], geo, peak); if (!r) bad = true; else out.push({ name:s.name, feasible:r.feasible, total:r.feasible ? r.total : Infinity, travel:r.travel, wait:r.feasible ? r.wait : Infinity, avgDist:r.avgDist }); });
  if (bad) return null; return out.sort(function (a, b) { return a.total - b.total; });
}
/** 자유 최적점: 가중 기하 중앙값(Weiszfeld 반복, 이동 거리 합 최소)과 무게중심(거리 제곱 합 최소), 각각의 가중 평균 직선 거리. */
function freeOptimum(pts) {
  if (!goodPts(pts)) return null; var P = pts.map(function (p) { return { x:Number(p.x), y:Number(p.y), w:Number(p.w) }; }), W = 0, cx = 0, cy = 0; P.forEach(function (p) { W += p.w; cx += p.w * p.x; cy += p.w * p.y; }); cx /= W; cy /= W;
  function avg(c) { return P.reduce(function (s, p) { return s + p.w * dist2(p, c); }, 0) / W; }
  var m = { x:cx, y:cy }, it, k; for (it = 0; it < 200; it++) { var nx = 0, ny = 0, dn = 0, hit = null; for (k = 0; k < P.length; k++) { var d = dist2(P[k], m); if (d < 1e-9) { hit = P[k]; break; } nx += P[k].w * P[k].x / d; ny += P[k].w * P[k].y / d; dn += P[k].w / d; } if (hit) { m = { x:hit.x, y:hit.y }; break; } var nm = { x:nx / dn, y:ny / dn }; if (dist2(nm, m) < 1e-9) { m = nm; break; } m = nm; }
  return { median:{ x:m.x, y:m.y, dist:avg(m) }, centroid:{ x:cx, y:cy, dist:avg({ x:cx, y:cy }) } };
}
function cleanName(s, n) { return clean(s, n); }

function load() {
  try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v || typeof v !== 'object') return;
    S.items = (Array.isArray(v.items) ? v.items : []).map(function (x) { if (!x || typeof x !== 'object') return null; var n = cleanName(x.name, 40), a = Number(x.annual), c = Number(x.cv), u = Number(x.urg), s = Number(x.scale); return n && a > 0 && c >= 0 && c <= 1000 && u >= 1 && u <= 5 && s >= 0 && s <= 5 ? { id:cleanName(x.id, 20) || uid(), name:n, annual:a, cv:c, urg:u, scale:s } : null; }).filter(Boolean).slice(0, MAXI);
    S.pts = (Array.isArray(v.pts) ? v.pts : []).map(function (x) { if (!x || typeof x !== 'object') return null; var n = cleanName(x.name, 30), px = Number(x.x), py = Number(x.y), w = Number(x.w); return n && ok(px, 0, 1e5) && ok(py, 0, 1e5) && w > 0 ? { id:cleanName(x.id, 20) || uid(), name:n, x:px, y:py, w:w } : null; }).filter(Boolean).slice(0, MAXP);
    S.sites = (Array.isArray(v.sites) ? v.sites : []).map(function (x) { if (!x || typeof x !== 'object') return null; var n = cleanName(x.name, 30), px = Number(x.x), py = Number(x.y), sv = Number(x.svc), cp = Number(x.cap); return n && ok(px, 0, 1e5) && ok(py, 0, 1e5) && sv > 0 && cp > 0 ? { id:cleanName(x.id, 20) || uid(), name:n, x:px, y:py, svc:sv, cap:cp } : null; }).filter(Boolean).slice(0, MAXS);
    if (v.geo && typeof v.geo === 'object') ['area', 'speed', 'circ'].forEach(function (k) { if (v.geo[k] !== undefined) S.geo[k] = clean(v.geo[k], 14); });
    if (Array.isArray(v.tiers) && v.tiers.length === S.tiers.length) v.tiers.forEach(function (t, i) { if (t && typeof t === 'object') ['n', 'wait', 'pen'].forEach(function (k) { if (t[k] !== undefined) S.tiers[i][k] = clean(t[k], 10); }); });
    if (v.days && typeof v.days === 'object') { S.days.year = clean(v.days.year, 4); if (Array.isArray(v.days.months) && v.days.months.length === 12) S.days.months = v.days.months.map(function (x) { return clean(x, 8); }); if (Array.isArray(v.days.dows) && v.days.dows.length === 7) S.days.dows = v.days.dows.map(function (x) { return clean(x, 8); }); } } catch (e) {}
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ items:S.items, pts:S.pts, sites:S.sites, geo:S.geo, tiers:S.tiers, days:S.days })); } catch (e) {} }
function peakNow() { var c = dailyCurve(S.days.year, S.days.months, S.days.dows); return c ? c.peakRatio : 1; }
function fx(n, d) { return n === null || n === undefined || !isFinite(n) ? '—' : (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('ko-KR'); }

function topbar() {
  return h('div', { class:'topin' }, [
    h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 조달' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function notice() {
  return h('div', { class:'note info', style:'margin:16px 0', id:'jt-note', text:'이 화면은 내가 입력한 가정으로 거리와 대기 시간을 줄이는 지점을 찾아 보는 모의 계산이며 예측이나 계획 결정이 아니에요. 실제 소비·물류 통계와 지도는 연결하지 않았고 거리는 직선 거리에 우회 계수를 곱한 근사예요. 수요 자료는 원래 PDV의 익명 집계 통계에서 오지만 아직 연결되지 않아 직접 넣어요. 주문·배송을 실제로 하지 않고, 적은 내용은 이 브라우저에만 저장됩니다.' });
}
var tOut = null, dOut = null, oOut = null;
function geoFields(pfx, which) {
  var L = { area:['서비스 구역 면적(km²)', '예: 100000'], speed:['평균 이동 속도(km/h)', '예: 50'], circ:['우회 계수(1 이상)', '직선 거리 대비, 예: 1.3'] };
  return which.map(function (k) { return field(pfx + k, L[k][0], S.geo[k], { max:14, mode:'decimal', ph:L[k][1], set:function (v) { S.geo[k] = clean(v, 14); save(); if (S.view === 'supply') updT(); if (S.view === 'optimum') updO(); } }); });
}

// ── 품목 유형 ──
function addItem() {
  var f = S.f, e = {}, n = cleanName(f.name, 40), a = numOf(f.annual), c = numOf(f.cv), u = numOf(f.urg), s = numOf(f.scale);
  if (!n) e.name = '품목 이름을 적어 주세요.'; if (!ok(a, 1e-12, 1e18)) e.annual = '연간 수요 규모를 0보다 큰 숫자로 적어 주세요(금액이든 수량이든 품목끼리 같은 단위).'; if (!ok(c, 0, 1000)) e.cv = '수요 변동(%)을 0~1000 사이로 적어 주세요.'; if (!ok(u, 1, 5)) e.urg = '긴급도는 1~5예요.'; if (!ok(s, 0, 5)) e.scale = '규모 이득은 0~5예요.'; if (S.items.length >= MAXI) e.name = '품목은 최대 ' + MAXI + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); } S.items.push({ id:uid(), name:n, annual:a, cv:c, urg:u, scale:s }); f.name = ''; f.annual = ''; f.cv = ''; S.msg = '품목을 적어 뒀어요.'; save(); render();
}
function viewTypes() {
  var kids = head('품목 유형', '수만 종을 하나씩 계산할 수 없으니 매출 비중(ABC)과 수요 변동(XYZ)이 비슷한 품목끼리 묶어 유형별로 계산합니다.'); kids.push(notice());
  var f = S.f, e = S.err;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'대표 품목' }), h('div', { class:'sub', text:'수요 변동은 하루 수요의 표준편차÷평균(%)이에요. 긴급도는 늦으면 얼마나 곤란한가(1~5), 규모 이득은 모아서 만들수록 얼마나 유리한가(0~5)예요.' }),
    h('div', { class:'frm' }, [field('jt-i-name', '품목', f.name, { err:e.name, max:40, ph:'예: 신선 채소', set:function (v) { f.name = v; } }), field('jt-i-annual', '연간 수요 규모', f.annual, { err:e.annual, max:18, mode:'decimal', set:function (v) { f.annual = v; } }), field('jt-i-cv', '수요 변동(%)', f.cv, { err:e.cv, max:5, mode:'decimal', set:function (v) { f.cv = v; } }), field('jt-i-urg', '긴급도(1~5)', f.urg, { err:e.urg, max:3, mode:'decimal', set:function (v) { f.urg = v; } }), field('jt-i-scale', '규모 이득(0~5)', f.scale, { err:e.scale, max:3, mode:'decimal', set:function (v) { f.scale = v; } })]),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('품목 추가', 'fill', addItem), btn('조달 AI에게 묻기', 'quiet', function () { ask('수만 종의 재화를 ABC·XYZ로 묶어 조달 방식을 정하려면 어떤 기준이 좋을까요?'); }), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  if (!S.items.length) { kids.push(empty('아직 품목이 없어요.')); return kids; }
  var c = classify(S.items), by = {}; if (c) c.rows.forEach(function (r) { by[r.name + '|' + r.annual + '|' + r.cv] = r; });
  kids.push(table(['품목', '연간 규모', '변동', '긴급도', '규모 이득', '유형', ''], S.items.map(function (x) { var r = by[x.name + '|' + x.annual + '|' + x.cv]; return h('tr', {}, [h('th', { text:x.name }), h('td', { class:'num', text:fx(x.annual, 2) }), h('td', { class:'num', text:x.cv + '%' }), h('td', { class:'num', text:String(x.urg) }), h('td', { class:'num', text:String(x.scale) }), h('td', { class:'num', text:r ? r.cls : '—' }), h('td', {}, [btn('삭제', 'quiet', function () { S.items = S.items.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]); })));
  if (c) kids.push(h('div', { class:'g2', style:'margin-top:16px' }, [tile('품목', c.n + '개', '입력한 품목 수', 'jt-t-n'), tile('유형', c.nClasses + '가지', '품목 ' + c.n + '개 → 유형 ' + c.nClasses + '가지로 줄어요', 'jt-t-k')]));
  if (c) kids.push(h('div', { class:'sub', style:'margin-top:8px', id:'jt-t-sum', text:'유형별 품목 수: ' + Object.keys(c.classes).sort().map(function (k) { return k + ' ' + c.classes[k] + '개'; }).join(', ') + '. A는 누적 80%까지, B는 95%까지, C는 나머지이고 X는 변동 50% 미만, Y는 100% 미만, Z는 그 이상이에요.' }));
  return kids;
}

// ── 대표일 수요 ──
function updD() {
  if (!dOut) return; dOut.textContent = ''; var c = dailyCurve(S.days.year, S.days.months, S.days.dows);
  if (!c) { dOut.appendChild(h('div', { class:'note', id:'jt-d-none', text:'연도(1900~2200)를 넣어 주세요. 월·요일 배수는 비워 두면 1(평소)이고, 0보다 큰 숫자를 넣을 수 있어요.' })); return; }
  dOut.appendChild(h('div', { class:'g2' }, [tile('첨두일', c.peakDate, '평균의 ' + fx(c.peak, 2) + '배', 'jt-d-peak'), tile('최저일', c.minDate, '평균의 ' + fx(c.min, 2) + '배', 'jt-d-min'), tile('일수', c.days + '일', '평균을 1로 맞춘 곡선', 'jt-d-days')]));
  dOut.appendChild(h('div', { class:'sub', style:'margin-top:8px', id:'jt-d-sum', text:'365일 전부 계산하지 않고 첨두일(' + c.peakDate + ')과 평균일, 최저일 세 날로 대표해요. 거점 용량은 첨두일 기준으로 확인하세요. 「최적 지점」에서 이 첨두 배수를 씁니다.' }));
}
function viewDays() {
  var kids = head('대표일 수요', '1년 365일을 모두 풀지 않고, 월별·요일별 수요 배수로 연중 곡선을 만들어 첨두일과 최저일만 대표로 씁니다.'); kids.push(notice());
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'연중 수요 배수' }), h('div', { class:'sub', text:'평소를 1로 보고 더 많은 달·요일은 1보다 크게, 적은 곳은 작게 넣어요. 원래는 PDV의 익명 집계 통계에서 오는 값이에요.' }),
    h('div', { class:'frm' }, [field('jt-y-year', '연도', S.days.year, { max:4, mode:'numeric', ph:'예: 2027', set:function (v) { S.days.year = clean(v, 4); save(); updD(); } })].concat(MONTHS.map(function (m, i) { return field('jt-y-m' + i, m + ' 배수', S.days.months[i], { max:8, mode:'decimal', ph:'1', set:function (v) { S.days.months[i] = clean(v, 8); save(); updD(); } }); }), DOWS.map(function (d, i) { return field('jt-y-d' + i, d + '요일 배수', S.days.dows[i], { max:8, mode:'decimal', ph:'1', set:function (v) { S.days.dows[i] = clean(v, 8); save(); updD(); } }); }))),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('조달 AI에게 묻기', 'quiet', function () { ask('명절과 계절에 따라 변하는 소비를 대표일 몇 개로 줄여 계산해도 될까요?'); })])]));
  dOut = h('div', { id:'jt-d-out', style:'margin-top:16px' }); kids.push(dOut); updD(); return kids;
}

// ── 지역 수요 ──
function addPt() {
  var f = S.fp, e = {}, n = cleanName(f.name, 30), x = numOf(f.x), y = numOf(f.y), w = numOf(f.w);
  if (!n) e.name = '지점 이름을 적어 주세요.'; if (!ok(x, 0, 1e5)) e.x = '동쪽 방향 km(0 이상)를 적어 주세요.'; if (!ok(y, 0, 1e5)) e.y = '북쪽 방향 km(0 이상)를 적어 주세요.'; if (!ok(w, 1e-12, 1e15)) e.w = '하루 수요를 0보다 큰 숫자로 적어 주세요.'; if (S.pts.length >= MAXP) e.name = '수요 지점은 최대 ' + MAXP + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); } S.pts.push({ id:uid(), name:n, x:x, y:y, w:w }); f.name = ''; f.x = ''; f.y = ''; f.w = ''; S.msg = '수요 지점을 적어 뒀어요.'; save(); render();
}
function addSite() {
  var f = S.fs, e = {}, n = cleanName(f.name, 30), x = numOf(f.x), y = numOf(f.y), sv = numOf(f.svc), cp = numOf(f.cap);
  if (!n) e.sname = '거점 이름을 적어 주세요.'; if (!ok(x, 0, 1e5)) e.sx = '동쪽 방향 km(0 이상)를 적어 주세요.'; if (!ok(y, 0, 1e5)) e.sy = '북쪽 방향 km(0 이상)를 적어 주세요.'; if (!ok(sv, 1e-9, 1e4)) e.svc = '1건 처리 시간(시간)을 0보다 큰 숫자로 적어 주세요.'; if (!ok(cp, 1e-12, 1e15)) e.cap = '하루 처리 능력을 0보다 큰 숫자로 적어 주세요.'; if (S.sites.length >= MAXS) e.sname = '후보 거점은 최대 ' + MAXS + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); } S.sites.push({ id:uid(), name:n, x:x, y:y, svc:sv, cap:cp }); f.name = ''; f.x = ''; f.y = ''; f.svc = ''; f.cap = ''; S.msg = '후보 거점을 적어 뒀어요.'; save(); render();
}
function viewGrid() {
  var kids = head('지역 수요', '전국을 수요가 모인 지점(격자)으로 묶고, 거점을 둘 후보를 적습니다. 좌표는 기준점에서 동쪽·북쪽으로 몇 km인지예요.'); kids.push(notice());
  var f = S.fp, g = S.fs, e = S.err;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'수요 지점' }), h('div', { class:'sub', text:'하루 평균 수요는 어느 품목 유형이든 같은 단위로 적어요. 원래는 PDV 익명 집계 통계에서 지역별로 오는 값이에요.' }),
    h('div', { class:'frm' }, [field('jt-p-name', '지점', f.name, { err:e.name, max:30, ph:'예: 한림읍', set:function (v) { f.name = v; } }), field('jt-p-x', '동쪽 km', f.x, { err:e.x, max:8, mode:'decimal', set:function (v) { f.x = v; } }), field('jt-p-y', '북쪽 km', f.y, { err:e.y, max:8, mode:'decimal', set:function (v) { f.y = v; } }), field('jt-p-w', '하루 수요', f.w, { err:e.w, max:16, mode:'decimal', set:function (v) { f.w = v; } })]),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('지점 추가', 'fill', addPt), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  if (S.pts.length) kids.push(table(['지점', '동쪽 km', '북쪽 km', '하루 수요', ''], S.pts.map(function (x) { return h('tr', {}, [h('th', { text:x.name }), h('td', { class:'num', text:fx(x.x, 1) }), h('td', { class:'num', text:fx(x.y, 1) }), h('td', { class:'num', text:fx(x.w, 2) }), h('td', {}, [btn('삭제', 'quiet', function () { S.pts = S.pts.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]); })));
  else kids.push(empty('아직 수요 지점이 없어요.'));
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'후보 거점' }), h('div', { class:'sub', text:'1건 처리 시간은 한 건을 내보내는 데 걸리는 시간, 하루 처리 능력은 하루에 낼 수 있는 수량이에요.' }),
    h('div', { class:'frm' }, [field('jt-s-name', '거점', g.name, { err:e.sname, max:30, ph:'예: 제주 물류센터', set:function (v) { g.name = v; } }), field('jt-s-x', '동쪽 km', g.x, { err:e.sx, max:8, mode:'decimal', set:function (v) { g.x = v; } }), field('jt-s-y', '북쪽 km', g.y, { err:e.sy, max:8, mode:'decimal', set:function (v) { g.y = v; } }), field('jt-s-svc', '1건 처리 시간(시간)', g.svc, { err:e.svc, max:10, mode:'decimal', set:function (v) { g.svc = v; } }), field('jt-s-cap', '하루 처리 능력', g.cap, { err:e.cap, max:16, mode:'decimal', set:function (v) { g.cap = v; } })].concat(geoFields('jt-g-', ['speed', 'circ']))),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('거점 추가', 'fill', addSite)])]));
  if (S.sites.length) kids.push(table(['거점', '동쪽 km', '북쪽 km', '1건 시간', '하루 능력', ''], S.sites.map(function (x) { return h('tr', {}, [h('th', { text:x.name }), h('td', { class:'num', text:fx(x.x, 1) }), h('td', { class:'num', text:fx(x.y, 1) }), h('td', { class:'num', text:fx(x.svc, 3) }), h('td', { class:'num', text:fx(x.cap, 2) }), h('td', {}, [btn('삭제', 'quiet', function () { S.sites = S.sites.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]); })));
  return kids;
}

// ── 공급 계층 ──
function updT() {
  if (!tOut) return; tOut.textContent = '';
  if (!S.items.length) { tOut.appendChild(h('div', { class:'note', id:'jt-s-none', text:'먼저 「품목 유형」에서 대표 품목을 한 개 이상 적어 주세요.' })); return; }
  var res = S.items.map(function (x) { return { x:x, r:tierCosts(x, S.tiers, S.geo, 1) }; });
  if (res.some(function (o) { return !o.r; })) { tOut.appendChild(h('div', { class:'note', id:'jt-s-bad', text:'면적·속도·우회 계수(1 이상)와 계층별 거점 수·대기 시간·벌점을 빠짐없이 넣어 주세요.' })); return; }
  var cnt = {}; res.forEach(function (o) { var nm = o.r.rows[o.r.best].name; cnt[nm] = (cnt[nm] || 0) + 1; });
  tOut.appendChild(table(['품목', '가장 알맞은 계층', '이동 거리', '이동 시간', '비용 J', '결론'], res.map(function (o) { var b = o.r.rows[o.r.best]; return h('tr', {}, [h('th', { text:o.x.name }), h('td', { text:b.name }), h('td', { class:'num', text:fx(b.dist, 1) + 'km' }), h('td', { class:'num', text:fx(b.travel, 2) + '시간' }), h('td', { class:'num', text:fx(b.J, 2) }), h('td', { text:o.r.stable ? '결과 안정' : '거리 오차에 따라 달라질 수 있음' })]); })));
  tOut.appendChild(h('div', { class:'sub', style:'margin-top:8px', id:'jt-s-sum', text:'계층별 선택 수: ' + S.tiers.map(function (t) { return t.name + ' ' + (cnt[t.name] || 0) + '개'; }).join(', ') + '. 거리를 ±15% 바꿔도 같은 계층이 이기면 「결과 안정」이에요.' }));
}
function viewSupply() {
  var kids = head('공급 계층', '공급을 전국·광역·지역·근린 4계층으로 나누고, 품목마다 이동 시간과 대기 시간이 가장 작은 계층을 고릅니다.'); kids.push(notice());
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'계층 가정' }), h('div', { class:'sub', text:'거점 수가 많을수록 가까워지지만 규모 이득이 줄어요. 대기 시간과 벌점의 기본값은 예시일 뿐이니 실제 값으로 바꿔 주세요.' }),
    h('div', { class:'frm' }, geoFields('jt-c-', ['area', 'speed', 'circ']).concat(S.tiers.reduce(function (a, t, i) { return a.concat([field('jt-c-n' + i, t.name + ' 거점 수', t.n, { max:8, mode:'numeric', set:function (v) { t.n = clean(v, 10); save(); updT(); } }), field('jt-c-w' + i, t.name + ' 대기 시간(시간)', t.wait, { max:8, mode:'decimal', set:function (v) { t.wait = clean(v, 10); save(); updT(); } }), field('jt-c-p' + i, t.name + ' 규모 벌점', t.pen, { max:8, mode:'decimal', set:function (v) { t.pen = clean(v, 10); save(); updT(); } })]); }, []))),
    h('div', { class:'sub', text:'비용 J = 긴급도 × (이동 시간 + 대기 시간) + 규모 이득 × 계층 벌점. 평균 이동 거리는 구역을 거점 수로 나눈 연속 근사(0.38×√(면적÷거점 수))예요.' }),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('조달 AI에게 묻기', 'quiet', function () { ask('긴급한 품목과 규모가 중요한 품목은 어느 공급 계층이 좋은가요?'); })])]));
  tOut = h('div', { id:'jt-s-out', style:'margin-top:16px' }); kids.push(tOut); updT(); return kids;
}

// ── 최적 지점 ──
function updO() {
  if (!oOut) return; oOut.textContent = '';
  if (!S.pts.length || !S.sites.length) { oOut.appendChild(h('div', { class:'note', id:'jt-o-none', text:'「지역 수요」에서 수요 지점과 후보 거점을 한 개 이상씩 적어 주세요.' })); return; }
  var pk = peakNow(), ev = evalSites(S.pts, S.sites, S.geo, pk), fr = freeOptimum(S.pts), bs = bestSingle(S.pts, S.sites, S.geo, pk);
  if (!ev || !fr) { oOut.appendChild(h('div', { class:'note', id:'jt-o-bad', text:'속도와 우회 계수(1 이상)를 넣어 주세요.' })); return; }
  oOut.appendChild(h('div', { class:'g2' }, [tile('평균 이동 거리', fx(ev.avgDist, 1) + 'km', '직선 × 우회 계수', 'jt-o-dist'), tile('이동 시간', fx(ev.travel, 2) + '시간', '', 'jt-o-tr'), tile('평균 대기', ev.feasible ? fx(ev.wait, 2) + '시간' : '계산 불가', ev.feasible ? 'M/M/1 평균' : '처리 능력 부족', 'jt-o-wait'), tile('이동+대기', ev.feasible ? fx(ev.total, 2) + '시간' : '계산 불가', '줄일수록 좋아요', 'jt-o-total')]));
  oOut.appendChild(h('div', { class:ev.feasible && !ev.peakOver.length ? 'note info' : 'note', style:'margin-top:12px', id:'jt-o-msg', text:!ev.feasible ? ev.overloaded.join(', ') + ' 거점의 하루 수요가 처리 능력 이상이라 대기가 끝없이 늘어요. 능력을 늘리거나 거점을 더하세요.' : ev.peakOver.length ? '평소에는 괜찮지만 첨두일(평균의 ' + fx(pk, 2) + '배)에는 ' + ev.peakOver.join(', ') + ' 거점이 처리 능력을 넘어요.' : '평소와 첨두일(평균의 ' + fx(pk, 2) + '배) 모두 처리 능력 안이에요.' }));
  oOut.appendChild(table(['거점', '맡는 수요', '가동률 ρ', '첨두일 ρ', '대기'], ev.rows.map(function (r) { return h('tr', {}, [h('th', { text:r.name }), h('td', { class:'num', text:fx(r.load, 2) }), h('td', { class:'num', text:pc(r.rho) }), h('td', { class:'num', text:pc(r.rhoPeak) }), h('td', { class:'num', text:isFinite(r.wait) ? fx(r.wait, 2) + '시간' : '—' })]); })));
  if (bs && bs.length) oOut.appendChild(table(['거점 한 곳만 둘 때', '이동 거리', '이동+대기'], bs.map(function (b) { return h('tr', {}, [h('th', { text:b.name }), h('td', { class:'num', text:fx(b.avgDist, 1) + 'km' }), h('td', { class:'num', text:isFinite(b.total) ? fx(b.total, 2) + '시간' : '처리 능력 부족' })]); })));
  oOut.appendChild(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'자유 최적점(참고)' }), h('div', { class:'sub', id:'jt-o-free', text:'후보에 얽매이지 않고 거점 한 곳을 어디든 둘 수 있다면, 이동 거리의 합이 가장 작은 곳은 (동쪽 ' + fx(fr.median.x, 1) + 'km, 북쪽 ' + fx(fr.median.y, 1) + 'km)이고 평균 직선 거리는 ' + fx(fr.median.dist, 1) + 'km예요. 무게중심은 (' + fx(fr.centroid.x, 1) + ', ' + fx(fr.centroid.y, 1) + ')로 평균 ' + fx(fr.centroid.dist, 1) + 'km예요. 대기 시간과 처리 능력은 반영하지 않은 값이에요.' })]));
}
function viewOptimum() {
  var kids = head('최적 지점', '이동 거리와 대기 시간의 합이 가장 작은 지점을 찾습니다. 후보 거점으로 평가하고, 후보와 상관없는 이론상 최적점도 함께 보여요.'); kids.push(notice());
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('div', { class:'frm' }, geoFields('jt-o-g-', ['speed', 'circ'])), h('div', { class:'sub', text:'대표일 수요에서 구한 첨두 배수를 가동률 확인에 씁니다. 수요 지점과 후보 거점은 「지역 수요」에서 적어요.' })]));
  oOut = h('div', { id:'jt-o-out', style:'margin-top:16px' }); kids.push(oOut); updO(); kids.push(h('div', { class:'rowf', style:'margin-top:12px' }, [btn('조달 AI에게 묻기', 'quiet', function () { ask('물류 거점 입지를 정할 때 이동 거리와 대기 시간을 함께 줄이려면 어떻게 하나요?'); })])); return kids;
}

// ── 조달 원리 ──
function viewPrinciple() {
  var kids = head('조달 원리', '필요한 곳에, 필요한 때, 필요한 만큼만 공급해 이동과 기다림을 줄이는 인프라입니다.'); kids.push(notice());
  kids.push(stepsCard('적시조달의 순서', [['소비 파악', '한국민이 하루에 쓰는 재화와 용역을 1년 365일 언제, 얼마나 쓰는지 파악해요.'], ['생산·공급 방법 결정', '각 재화·용역을 어디서 어떻게 만들고 공급할지 정해요.'], ['최적 지점 계산', '이동 거리와 대기 시간의 합이 가장 작은 지점(Optimal Point)을 구해요.']], '이 세 단계를 수만 종에 그대로 적용할 수는 없어서 아래 단순화 방법을 써요.'));
  kids.push(table(['단순화 방법', '하는 일'], rows2([['① 품목 유형화', '수만 종을 매출 비중(ABC)과 수요 변동(XYZ)으로 묶어 유형 수를 크게 줄여요.'], ['② 지역 격자', '전국을 수요가 모인 지점으로 묶어 지역 단위로 계산해요.'], ['③ 대표일', '365일 곡선에서 첨두일·평균일·최저일만 대표로 써요.'], ['④ 공급 4계층', '전국·광역·지역·근린으로 나누고 거점 수로 평균 거리를 연속 근사해요.'], ['⑤ 집계 통계만', '개인 기록이 아니라 PDV의 익명 집계 통계만 계산에 써요.']])));
  kids.push(table(['PDV와의 관계', '내용'], rows2([['수요 자료', '개인·기업·기관의 일상과 업무를 기록하는 PDV가 있어야 언제, 어디서, 무엇을 얼마나 쓰는지 알 수 있어요. 적시조달은 PDV의 효용이 발휘되는 지점이에요.'], ['개인정보', '개인의 PDV는 본인만 볼 수 있어요. 계산에는 개인을 알 수 없는 집계 통계만 써요.'], ['현재 상태', 'PDV와 아직 연결되어 있지 않아요. 지금은 수요를 직접 입력해요.']])));
  kids.push(table(['한계', '내용'], rows2([['거리', '직선 거리에 우회 계수를 곱한 근사이고 도로망과 지도는 쓰지 않아요.'], ['값', '모든 값이 입력한 가정이며 계층별 기본값은 예시예요.'], ['오차', '평균 이동 거리 근사는 거리 ±15% 안에서 결론이 같은지로 점검해요.'], ['실행', '주문·배송·발주를 하지 않아요.']])));
  kids.push(h('div', { class:'rowf', style:'margin-top:12px' }, [btn('조달 AI에게 묻기', 'quiet', function () { ask('적시조달에서 가장 먼저 모아야 할 수요 데이터는 무엇인가요?'); })]));
  return kids;
}

function render() {
  var root = $('jt-root'), tp = $('jt-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar()); tOut = null; dOut = null; oOut = null;
  var kids = S.view === 'days' ? viewDays() : S.view === 'grid' ? viewGrid() : S.view === 'supply' ? viewSupply() : S.view === 'optimum' ? viewOptimum() : S.view === 'principle' ? viewPrinciple() : viewTypes();
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
  M = el; el.textContent = ''; el.classList.add('jit'); S.items = []; S.pts = []; S.sites = []; S.days = blankDays(); S.geo = { area:'100000', speed:'50', circ:'1.3' }; S.tiers = defTiers(); S.err = {}; S.msg = ''; S.f = { name:'', annual:'', cv:'', urg:'3', scale:'2' }; S.fp = { name:'', x:'', y:'', w:'' }; S.fs = { name:'', x:'', y:'', svc:'', cap:'' }; load();
  [h('div', { id:'jt-top' }), h('div', { class:'wrap', id:'jt-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'types'; render();
}
window.NaviJit = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  classify:classify, dailyCurve:dailyCurve, tierCosts:tierCosts, evalSites:evalSites, bestSingle:bestSingle, freeOptimum:freeOptimum,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
