/* traffic-app.js — 나비웹 교통(인프라 AI · 교통). desktop.html 안에 직접 그려 넣는다(iframe 없음).
* 사용: NaviTraffic.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
* 모양은 traffic.css(.trf 범위). 전역은 NaviTraffic 하나만 쓴다.
*
* 응급·치안·의료 페이지와 같은 레이아웃(2026-11-25): 한 페이지, 탭 없음. 평소 준비(기기·내 PDV에서 꺼낼 정보) 아래에서 무작위 가상 교통 수요 하나를
*   4단계·19개 세부 단계(1-1~4-4)로 따라간다. 위치는 상단 진행 막대, 차례는 단계 목록, 결과는 눌린 단계 바로 아래로 펼쳐지는 패널.
*   앞 단계를 연 뒤에만 다음 단계를 열 수 있고, 열린 단계 바로 다음 단계의 막대가 천천히 깜박인다.
*   3-1(지시서 발송)을 열면 배차 계획과 그때의 차량 현황이 굳고, 3-5 에서 배정 차량이 멈추거나 길이 막히면 그 시각의 현황으로 다시 정한다.
*   오른쪽 위 시뮬레이션 버튼은 별도의 무작위 수요를 1-1부터 자동으로 보여 주며, 화면의 단계 목록과 상태를 공유하지 않는다.
*
* 교통 화면의 설계 원칙(주피터 지시, 2026-11-25):
* 1. 도시 안 임의의 지점에서 한 명 이상의 교통 수요가 생긴다 → 일행 수·이동 편의(휠체어·큰 짐)·목적지가 수요마다 다르다. 이용자의 나만의 AI 비서가 PDV 에서 일정·인원·이동 편의를
*    꺼내 익명화해(이름·주민번호는 빼고) 교통 AI 에 보낸다. 말·문자가 어려우면 '교통'만 가고 목적지는 PDV 일정이 대신 말한다.
* 2. 교통 AI 는 모든 자율주행차량의 현재 위치·속도·경로(목적지)·배터리·탑승 중인 시민을 실시간으로 받아 갱신한다(차량은 도로 위 주행 안내선을 따르고 서버가 모든 위치를 파악·통제한다).
* 3. 배차: 차량마다 '지금 하던 일을 마치는 때와 곳'(유휴=지금 그 자리, 운송 중=손님을 내려 준 뒤 그 목적지, 충전 중=충전을 마친 뒤)에서 승차 지점까지의 시간으로 센다 → 이동 경로를 반영한다.
*    점검 중·리프트 없음·큰 짐 못 실음·하차 뒤 충전소까지 갈 배터리 부족인 차량은 뺀다. 일행이 한 대에 앉으면 한 대, 아니면 한 대 이상(두 대)으로 나눈다.
*    비용 = 승차 시간 + 차를 한 대 더 쓰는 데 대한 벌점(SPLIT_TOL, 가정). 쓸 수 있는 차량이 없으면 가장 빨리 충전을 마치고 오는 차량으로 안내한다.
* 4. 경로 계산은 도로(격자)를 따라 하고, 도로 관제가 차량별로 주행 안내선 구간을 예약해 서로 겹치거나 막히지 않게 한다(차량 충돌·혼잡 방지).
* 5. 운행 중에도 계속 갱신한다: 위치·속도·배터리·탑승 인원. 배정 차량이 멈추면 그 일행만 다시 배차하고, 길이 막히면 모든 차량이 돌아간다. 하차 뒤에는 요금 정산·차량 상태 갱신·충전 또는 재배치.
*
* 무엇이 실제이고 무엇이 아닌가(화면에도 한 줄로 적는다):
* - 위 원칙은 설계 단계이고 이 화면은 모의 체험이다. 차량·도로 관제·결제에 연결되어 있지 않고 어떤 것도 전송·호출·제어하지 않는다.
* - 도시·차량·시민·경로·속도·배터리·요금은 모두 가상 값이며 메모리 안에서만 계산한다(저장하지 않는다). 속도·배터리 소모·충전 속도·요금은 가정이다.
* - 내 기기·꺼낼 정보는 사용자가 직접 정하는 기록이고 이 브라우저(localStorage)에만 저장된다(설계에서는 PDV 에 보관).
* - 사람이 운전하는 특수한 경우, 대중교통, 차량 한 대를 여러 손님이 나눠 타는 합승은 이 화면에서 다루지 않는다(나중에 예외·확장 프로세스로 따로 만든다).
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
var KEY = 'navi-trf-v2', MAXD = 20;
var DEVICES = [['phone', '폰'], ['watch', '나비웹 워치'], ['ring', '링(팔찌)']];
var DEVKINDS = DEVICES.map(function (d) { return d[1]; });
/** 내 비서가 내 PDV 에서 꺼내 익명화해 교통 AI 에 보내는 정보. 위치는 승차 지점이라 항상 포함하고, 나머지는 항목마다 직접 정한다. 이름·주민번호는 어떤 경우에도 보내지 않는다. */
var SEND = [['loc', '현재 위치(승차 지점)'], ['sched', '오늘 일정·목적지'], ['party', '동행 인원'], ['access', '이동 편의(휠체어·큰 짐)'], ['pref', '선호(조용한 차 등)']];
/** 교통 AI 가 내 비서에게 추가로 물을 수 있는 것(예시). 항목마다 답해도 되는지 직접 정한다. */
var ASKS = [['when', '얼마나 기다릴 수 있는지'], ['bag', '짐의 개수와 크기']];
var CALLS = [['voice', '말할 수 있음'], ['text', '문자를 입력할 수 있음'], ['none', '둘 다 어려움']];
var ANCH = { call:'trf-list', flow:'trf-list', follow:'trf-list', match:'trf-list', principle:'trf-list', fleet:'trf-list', control:'trf-list', trips:'trf-list', prep:'trf-s-prep', devices:'trf-s-prep', consent:'trf-s-prep' };
var M = null, LS = {};
var S = { share:{}, askok:{}, dev:[], form:{ kind:'폰', carry:true }, err:{}, msg:'', prepOpen:false, sim:null, wasOpen:false, lastOpen:-1, move:null, auto:null };

function field(id, label, val, o) {
  o = o || {}; var e = o.err, inp = h('input', { id:id, type:'text', value:val == null ? '' : val, placeholder:o.ph || '', maxlength:o.max || '60', inputmode:o.mode || '', autocomplete:'off', 'aria-invalid':e ? 'true' : 'false' });
  inp.oninput = function () { if (o.set) o.set(inp.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), inp, h('div', { id:id + '-h', class:e ? 'err' : 'help', text:e || o.help || '' })]);
}
function empty(t, b) { return h('div', { class:'card', style:'margin-top:16px' }, [h('div', { class:'empty', text:t }), b ? h('div', { class:'rowf', style:'justify-content:center' }, [b]) : null]); }
function head(title, lead) { return [h('h1', { text:title }), lead ? h('p', { class:'lead', text:lead }) : null]; }
function seg(label, opts, val, set) {
  return h('div', { class:'seg', role:'group', 'aria-label':label }, opts.map(function (o) { return h('button', { type:'button', 'data-v':o[0], 'aria-pressed':String(val === o[0]), text:o[1], onclick:function () { set(o[0]); } }); }));
}
function sel(id, label, val, opts, set) {
  var s = h('select', { id:id, 'aria-label':label }, opts.map(function (c) { return h('option', { value:c[0], text:c[1] }); })); s.value = val; s.onchange = function () { set(s.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), s]);
}
function tile(k, v, s, id) { return h('div', { class:'tile' }, [h('div', { class:'k', text:k }), h('div', { class:'num', id:id, style:'font-size:20px;font-weight:700', text:v }), s ? h('div', { class:'sub', text:s }) : null]); }
function mockNote(t) { return h('div', { class:'note info', id:'trf-mock', style:'margin:16px 0', text:t }); }

function load() {
  try {
    var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v || typeof v !== 'object') return;
    if (v.share && typeof v.share === 'object') SEND.forEach(function (f) { if (v.share[f[0]]) S.share[f[0]] = 1; });
    if (v.askok && typeof v.askok === 'object') ASKS.forEach(function (f) { if (v.askok[f[0]]) S.askok[f[0]] = 1; });
    S.dev = (Array.isArray(v.dev) ? v.dev : []).map(fixDev).filter(Boolean).slice(0, MAXD);
  } catch (e) {}
}
function fixDev(x) {
  if (!x || typeof x !== 'object') return null;
  var kind = x.kind === '스마트워치' ? '나비웹 워치' : x.kind;
  var name = clean(x.name, 40); if (!name || DEVKINDS.indexOf(kind) < 0 || (x.chk && !/^\d{4}-\d{2}-\d{2}$/.test(x.chk))) return null;
  return { id:clean(x.id, 20) || uid(), kind:kind, name:name, carry:x.carry !== false, chk:x.chk || '' };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ share:S.share, askok:S.askok, dev:S.dev })); } catch (e) {} }

/** 교통 호출 메시지: 말할 수 있으면 음성, 문자를 입력할 수 있으면 문자를 함께 보내고, 그 밖에는 오직 '교통'만 보낸다(목적지는 PDV 일정이 대신 말한다). */
function callMessage(can, said) {
  var t = clean(said, 120);
  if (can === 'voice') return { mode:'voice', label:'음성 + 교통', body:t || '(말한 내용이 음성으로 전달됩니다)', flag:'교통', only:false };
  if (can === 'text') return { mode:'text', label:'문자 + 교통', body:t || '(입력한 문자가 전달됩니다)', flag:'교통', only:false };
  return { mode:'none', label:'교통', body:'', flag:'교통', only:true };
}
function sharedItems(share) { return SEND.filter(function (f) { return f[0] === 'loc' || share[f[0]]; }).map(function (f) { return f[1]; }); }
function askItems(askok) { return ASKS.filter(function (f) { return askok[f[0]]; }).map(function (f) { return f[1]; }); }
function devSummary(list, today) {
  var t0 = today ? Date.parse(today + 'T00:00:00Z') : NaN, due = 0, carry = 0, by = {};
  list.forEach(function (x) { by[x.kind] = (by[x.kind] || 0) + 1; if (x.carry) carry++; if (x.chk && isFinite(t0) && Date.parse(x.chk + 'T00:00:00Z') <= t0) due++; });
  return { count:list.length, carry:carry, by:by, due:due };
}

// ── 도시·차량(가상 값) ──
var GRID = 14;                     // 14km × 14km 격자 도시(가정). 도로는 격자이고 거리는 도로를 따라 센다.
var MINKM = 1.25, BATKM = 0.5;     // 1km 에 1.25분(시속 48km, 가정) · 1km 에 배터리 0.5%(가정)
var RESERVE = 15, FLOOR = 10;      // 하차 뒤 가장 가까운 충전소까지 가고도 남아야 하는 배터리(%) — 계획 15, 우회가 생겨도 10 밑으로는 안 내려가요
var BOARD = 1, SPLIT_TOL = 5;      // 탑승 1분 · 차를 한 대 더 쓰는 것을 대기 5분과 같은 비용으로 센다(가정)
var CHG_RATE = 1, CHG_TO = 80;     // 충전은 1분에 1%, 80% 까지(가정)
var BASEFARE = 1000, PERKM = 700;  // 가상 요금(GDC): 기본 + 거리당(가정, 실제 요금 아님)
var CHARGERS = [['c1', '가상 충전소 1', 3, 3], ['c2', '가상 충전소 2', 10, 12], ['c3', '가상 충전소 3', 12, 4]];
var SPOTS = [['업무지구', '가상 업무지구', 12, 3], ['병원', '가상 종합병원', 5, 11], ['공항', '가상 공항', 13, 12], ['도서관', '가상 도서관', 3, 4], ['시장', '가상 시장', 8, 8], ['호텔', '가상 항구 호텔', 1, 12], ['주택단지', '가상 주택단지', 11, 9], ['식당가', '가상 식당가', 7, 2]];
var TYPES = { sedan:{ name:'승용', seats:4, lift:false, big:false }, van:{ name:'승합', seats:6, lift:false, big:true }, lift:{ name:'리프트 승합', seats:4, lift:true, big:false } };
var VEH = [['T1', 'sedan'], ['T2', 'sedan'], ['T3', 'van'], ['T4', 'lift'], ['T5', 'sedan'], ['T6', 'van'], ['T7', 'sedan'], ['T8', 'lift']];
var ACC = { none:'특별한 요구 없음', wheel:'휠체어 이용(리프트 필요)', luggage:'큰 짐(승합만 가능)' };
function dist(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); }
function mins(km) { return Math.max(1, Math.round(km * MINKM)); }
function ri(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
function pth(a, b) { return [a, [b[0], a[1]], b]; }                       // 도로를 따라 가로 먼저, 세로 나중
function along(p, d) { var i, L; for (i = 0; i < p.length - 1; i++) { L = dist(p[i], p[i + 1]); if (d <= L || i === p.length - 2) { var f = L ? Math.min(1, d / L) : 1; return [p[i][0] + (p[i + 1][0] - p[i][0]) * f, p[i][1] + (p[i + 1][1] - p[i][1]) * f]; } d -= L; } return p[p.length - 1]; }
function nearestChg(p) { var b = null; CHARGERS.forEach(function (c) { var d = dist(p, [c[2], c[3]]); if (!b || d < b.km) b = { id:c[0], name:c[1], xy:[c[2], c[3]], km:d }; }); return b; }
function spot(k) { return SPOTS.filter(function (s) { return s[0] === k; })[0]; }
/** 차량 한 대: { id, name, type, x, y, bat(%), state:'idle'|'busy'|'charge'|'down', spd(km/h), job:{ to, pax }|null, chgLeft(분) } — 교통 AI 는 모든 차량의 이 값을 실시간으로 받는다. */
function newFleet(rng) {
  var r = typeof rng === 'function' ? rng : Math.random;
  return VEH.map(function (d) {
    var T = TYPES[d[1]], v = { id:d[0], name:'자율주행 ' + d[0], type:d[1], x:ri(r, 0, GRID), y:ri(r, 0, GRID), bat:ri(r, 20, 95), state:'idle', spd:0, job:null, chgLeft:0 }, q = r();
    if (q < 0.35) { var to; do { to = [ri(r, 0, GRID), ri(r, 0, GRID)]; } while (dist([v.x, v.y], to) < 3); v.state = 'busy'; v.job = { to:to, pax:ri(r, 1, T.seats) }; v.spd = ri(r, 36, 46); v.bat = Math.max(v.bat, 18 + Math.ceil(BATKM * dist([v.x, v.y], to))); }
    else if (q < 0.47) { var c = CHARGERS[ri(r, 0, CHARGERS.length - 1)]; v.state = 'charge'; v.x = c[2]; v.y = c[3]; v.bat = ri(r, 12, 60); v.chgLeft = Math.ceil((CHG_TO - v.bat) / CHG_RATE); }
    else if (q < 0.55) v.bat = ri(r, 12, 24);
    return v;
  });
}
/** t 분 뒤의 차량 상태(계획 없이 하던 일만 이어 갈 때). busy 는 도착하면 그 자리에 idle, charge 는 다 차면 idle. */
function stateAt(v, t) {
  var o = { id:v.id, name:v.name, type:v.type, x:v.x, y:v.y, bat:v.bat, state:v.state, spd:v.spd, job:v.job ? { to:v.job.to, pax:v.job.pax } : null, chgLeft:v.chgLeft };
  if (!t || v.state === 'down' || v.state === 'idle') return o;
  if (v.state === 'busy') {
    var km = dist([v.x, v.y], v.job.to), mn = mins(km);
    if (t >= mn) { o.x = v.job.to[0]; o.y = v.job.to[1]; o.bat = v.bat - BATKM * km; o.state = 'idle'; o.spd = 0; o.job = null; }
    else { var d = km * t / mn, p = along(pth([v.x, v.y], v.job.to), d); o.x = p[0]; o.y = p[1]; o.bat = v.bat - BATKM * d; }
  } else if (v.state === 'charge') {
    if (t >= v.chgLeft) { o.bat = Math.max(v.bat, CHG_TO); o.state = 'idle'; o.chgLeft = 0; } else { o.bat = Math.min(CHG_TO, v.bat + t * CHG_RATE); o.chgLeft = v.chgLeft - t; }
  }
  return o;
}
/** 이 차량이 새 일을 맡을 수 있게 되는 때와 곳: idle 이면 지금 그 자리, busy 면 지금 손님을 내려 준 뒤 목적지, charge 면 충전을 마친 뒤. */
function avail(v) {
  if (v.state === 'idle') return { t:0, pos:[v.x, v.y], bat:v.bat };
  if (v.state === 'busy') { var km = dist([v.x, v.y], v.job.to); return { t:mins(km), pos:v.job.to, bat:v.bat - BATKM * km }; }
  if (v.state === 'charge') return { t:v.chgLeft, pos:[v.x, v.y], bat:Math.max(v.bat, CHG_TO) };
  return null;
}
function legPhases(c, tp, shift, chg) {
  var ph = [], t = c.a.t + shift, pos = c.a.pos, bat = c.a.bat, P = tp.P, D = tp.D, tripKm = dist(P, D), tm = mins(tripKm), eta, e;
  if (t > 0) ph.push({ k:'pre', t0:0, t1:t });
  if (chg) {
    var km1 = dist(pos, chg.xy), m1 = mins(km1); ph.push({ k:'move', st:'충전소로 이동', t0:t, t1:t + m1, from:pos, to:chg.xy, bat0:bat, km:km1, pax:0 }); t += m1; bat -= BATKM * km1; pos = chg.xy;
    var need = Math.max(0, Math.ceil((CHG_TO - bat) / CHG_RATE)); if (need) { ph.push({ k:'charge', st:'충전 중', t0:t, t1:t + need, at:pos, bat0:bat }); t += need; bat = Math.min(CHG_TO, bat + need * CHG_RATE); }
  }
  var km2 = dist(pos, P), m2 = mins(km2); ph.push({ k:'move', st:'승차 지점으로 이동', t0:t, t1:t + m2, from:pos, to:P, bat0:bat, km:km2, pax:0 }); t += m2; bat -= BATKM * km2; eta = t;
  ph.push({ k:'board', st:'승차·탑승 확인', t0:t, t1:t + BOARD, at:P, bat0:bat }); t += BOARD;
  ph.push({ k:'trip', st:'목적지로 운행', t0:t, t1:t + tm, from:P, to:D, bat0:bat, km:tripKm }); e = t + tm;
  return { ph:ph, eta:eta, batPick:bat, batEnd:bat - BATKM * tripKm, arrive:e, tripMin:tm };
}
function mkLeg(c, riders, tp, shift, chg) {
  var L = legPhases(c, tp, shift, chg);
  return { v:{ id:c.v.id, name:c.v.name, type:c.v.type, tname:TYPES[c.v.type].name }, riders:riders, was:c.v.state, from:[c.v.x, c.v.y], tFree:c.a.t + shift, pre:c.a, eta:L.eta, kmPick:dist(c.a.pos, tp.P), batPick:L.batPick, batEnd:L.batEnd, tripMin:L.tripMin, arrive:L.arrive, chg:chg ? { name:chg.name, xy:chg.xy, km:chg.km } : null, detour:0, ph:L.ph };
}
function shapeOf(legs) { return { legs:legs, kind:legs.length > 1 ? 'split' : legs[0].chg ? 'charge' : 'single', pickupAt:Math.max.apply(null, legs.map(function (l) { return l.eta; })), arrive:Math.max.apply(null, legs.map(function (l) { return l.arrive; })), vehicles:legs.length }; }
/** 한 수요를 맡을 차량(들)을 고른다. snap = 어느 시각의 전체 차량 상태, ex = 쓸 수 없는 차량 { id: 이유 }.
*  ① 차량마다: 점검 중·리프트 없음·큰 짐 못 실음·하차 뒤 충전소까지 갈 배터리 부족이면 빠진다. 나머지는 '지금 하던 일을 마치는 때와 곳'(avail)에서 승차 지점까지의 시간으로 센다 → 이동 경로를 반영해요.
*  ② 일행이 한 대에 앉으면 한 대(single), 아니면 두 대(split). 비용 = 승차까지 시간(두 대면 늦은 쪽) + 차를 더 쓴 만큼 SPLIT_TOL. 비용이 같으면 시간 → 승차 이동 거리 → 번호 순.
*  ③ 쓸 수 있는 차량이 하나도 없으면 가장 빨리 충전을 마치고 오는 차(charge)로 안내한다(휠체어·큰 짐 조건은 그대로).  */
function plan(tp, snap, ex, shift) {
  shift = shift || 0; var P = tp.P, D = tp.D, tripKm = dist(P, D), tail = BATKM * nearestChg(D).km, n = tp.n, why = [], cs = [], opts = [], best = null, fb = null;
  function hw(v) { var T = TYPES[v.type]; if (ex && ex[v.id]) return ex[v.id]; if (v.state === 'down') return '점검 중이라 운행할 수 없어요'; if (tp.acc === 'wheel' && !T.lift) return '리프트(휠체어 승강)가 없어요'; if (tp.acc === 'luggage' && !T.big) return '큰 짐을 실을 수 없어요(승합만 가능)'; return null; }
  snap.forEach(function (v) {
    var bad = hw(v), a, km, bp; if (bad) { why.push([v.name, bad]); return; }
    a = avail(v); km = dist(a.pos, P); bp = a.bat - BATKM * km;
    if (bp - BATKM * tripKm - tail < RESERVE) { why.push([v.name, '배터리가 모자라요(' + Math.round(a.bat) + '% — 승차 뒤 하차하고 충전소까지 가려면 더 필요해요)']); return; }
    cs.push({ v:v, T:TYPES[v.type], a:a, eta:a.t + mins(km), km:km });
  });
  cs.forEach(function (c) { if (c.T.seats >= n) opts.push({ legs:[mkLeg(c, n, tp, shift, null)], cost:c.eta + shift, eta:c.eta + shift, km:c.km }); });
  if (n >= 2 && tp.acc !== 'wheel') {
    cs.forEach(function (a, i) { cs.forEach(function (b, j) { if (j <= i) return;
      var r1 = Math.min(a.T.seats, n - 1), r2 = n - r1; if (r2 > b.T.seats) { r2 = b.T.seats; r1 = n - r2; } if (r1 < 1 || r1 > a.T.seats || r2 < 1) return;
      var eta = Math.max(a.eta, b.eta) + shift; opts.push({ legs:[mkLeg(a, r1, tp, shift, null), mkLeg(b, r2, tp, shift, null)], cost:eta + SPLIT_TOL, eta:eta, km:a.km + b.km }); }); });
  }
  opts.sort(function (x, y) { return x.cost - y.cost || x.eta - y.eta || x.km - y.km || x.legs[0].v.id.localeCompare(y.legs[0].v.id); });
  opts.forEach(function (o) { o.shape = shapeOf(o.legs); });
  best = opts[0] || null;
  if (!best) {
    snap.forEach(function (v) {
      if (hw(v) || TYPES[v.type].seats < n) return;
      var a = avail(v), C = nearestChg(a.pos), km1 = C.km, bC = a.bat - BATKM * km1, need = Math.max(0, Math.ceil((CHG_TO - bC) / CHG_RATE)), bat1 = Math.min(CHG_TO, bC + need * CHG_RATE), km2 = dist(C.xy, P);
      if (bC < 0 || bat1 - BATKM * (km2 + tripKm) - tail < RESERVE) return;
      var eta = a.t + mins(km1) + need + mins(km2) + shift;
      if (!fb || eta < fb.eta || (eta === fb.eta && v.id < fb.v.id)) fb = { v:v, a:a, C:C, eta:eta };
    });
    if (fb) { var c = { v:fb.v, T:TYPES[fb.v.type], a:fb.a }, lg = mkLeg(c, n, tp, shift, fb.C); fb = { legs:[lg], cost:lg.eta, eta:lg.eta, km:lg.kmPick, shape:shapeOf([lg]) }; }
  }
  return { tp:tp, options:opts, best:best, fb:fb, go:best ? best.shape : fb ? fb.shape : null, why:why, at:shift };
}
function match(tp, fleet, live) {
  if (!tp) return null;
  if (!live) return plan(tp, fleet, null, 0);
  /* 이송 중 '배정 차량 이상'(live.fault): 그 차량이 맡던 일행만 그 시각(live.at)의 전체 차량 상태로 다시 맞춘다. 이미 출발한 다른 차량은 그대로 간다. */
  var pg = live.prev.go, lost = pg.legs.filter(function (l) { return l.v.id === live.fault; })[0], kept = pg.legs.filter(function (l) { return l.v.id !== live.fault; }), ex = {}, snap;
  kept.forEach(function (l) { ex[l.v.id] = '이미 이 일행을 태우러 가는 중이에요'; }); ex[live.fault] = '이상이 생겨 멈췄어요(가상)';
  snap = fleet.map(function (v) { return stateAt(v, live.at); });
  var sub = { P:tp.P, D:tp.D, Dn:tp.Dn, n:lost.riders, acc:tp.acc }, r = plan(sub, snap, ex, live.at);
  if (!r.go) return { tp:tp, options:[], best:null, fb:null, go:null, why:r.why, at:live.at, lost:lost };
  r.go = shapeOf(kept.concat(r.go.legs)); r.tp = tp; r.lost = lost; r.kept = kept; return r;
}
/** 이송 중 '구간 통제': 가던 길의 한 구간이 막혀 한두 블록 돌아가야 한다(+2km 또는 +4km). 모든 차량에 새 경로를 내려 보낸다. */
function detourGo(go, at, extra) {
  var legs = go.legs.map(function (l) {
    var n = JSON.parse(JSON.stringify(l)), dm = mins(extra), tr = n.ph.filter(function (p) { return p.k === 'trip'; })[0], i = n.ph.indexOf(tr);
    if (at > tr.t0 && at < tr.t1) { var f = (at - tr.t0) / (tr.t1 - tr.t0), pos = along(pth(tr.from, tr.to), tr.km * f), rem = dist(pos, tr.to), a1 = { k:'trip', st:'목적지로 운행', t0:tr.t0, t1:at, from:tr.from, to:tr.to, bat0:tr.bat0, km:tr.km * f, base:true }, b1 = { k:'trip', st:'우회로로 운행', t0:at, t1:tr.t1 + dm, from:pos, to:tr.to, bat0:tr.bat0 - BATKM * tr.km * f, km:rem + extra, base:false };
      n.ph.splice(i, 1, a1, b1); }
    else { tr.t1 += dm; tr.km += extra; tr.st = '우회로로 운행'; }
    n.arrive += dm; n.batEnd -= BATKM * extra; n.detour = extra; n.tripMin += dm; return n;
  });
  return shapeOf(legs);
}
function endT(g) { return g.arrive; }
/** 배정된 차량(leg)의 t 분(호출부터 센 절대 시각) 상태. v0 = 계획 확정 때의 그 차량. */
function legAt(leg, v0, t) {
  var ph = leg.ph, i, p, f, pos;
  for (i = 0; i < ph.length; i++) { p = ph[i]; if (t >= p.t0 && t < p.t1) break; p = null; }
  if (!p) { var Lp = ph[ph.length - 1]; return { x:Lp.to[0], y:Lp.to[1], bat:leg.batEnd, spd:0, st:'하차 완료 · 대기', pax:0, to:null }; }
  if (p.k === 'pre') { var s = stateAt(v0, t); return { x:s.x, y:s.y, bat:s.bat, spd:s.spd, st:v0.state === 'charge' ? '충전 중(마친 뒤 이 일행에게)' : v0.state === 'busy' ? '지금 손님을 내려 주는 중' : '대기', pax:s.job ? s.job.pax : 0, to:s.job ? s.job.to : null }; }
  f = (t - p.t0) / (p.t1 - p.t0);
  if (p.k === 'move' || p.k === 'trip') { pos = along(pth(p.from, p.to), p.km * f); return { x:pos[0], y:pos[1], bat:p.bat0 - BATKM * p.km * f, spd:Math.round(p.km / ((p.t1 - p.t0) / 60)), st:p.st, pax:p.k === 'trip' ? leg.riders : 0, to:p.to }; }
  if (p.k === 'charge') return { x:p.at[0], y:p.at[1], bat:Math.min(CHG_TO, p.bat0 + (t - p.t0) * CHG_RATE), spd:0, st:'충전 중', pax:0, to:leg.chg ? null : null };
  return { x:p.at[0], y:p.at[1], bat:p.bat0, spd:0, st:p.st, pax:t > p.t0 ? leg.riders : 0, to:null };
}
/** t 분 뒤 전체 차량 표. 배정된 차량은 계획(leg)대로, 나머지는 하던 일대로 움직인다. ev 가 있으면 이상으로 멈춘 차량도 반영한다. */
function fleetAt(fleet0, go, ev, t) {
  var by = {}; (go ? go.legs : []).forEach(function (l) { by[l.v.id] = l; });
  return fleet0.map(function (v0) {
    var l = by[v0.id], row;
    if (ev && ev.kind === 'fault' && ev.lost && ev.lost.v.id === v0.id) { var lt = Math.min(t, ev.at), x = legAt(ev.lost, v0, lt); row = t < ev.at ? x : { x:x.x, y:x.y, bat:x.bat, spd:0, st:'이상으로 정지(점검 호출)', pax:0, to:null }; row.mine = false; }
    else if (l) { row = legAt(l, v0, t); row.mine = true; }
    else { var s = stateAt(v0, t); row = { x:s.x, y:s.y, bat:s.bat, spd:s.state === 'busy' ? s.spd : 0, st:s.state === 'busy' ? '다른 손님 운송 중' : s.state === 'charge' ? '충전 중' : s.state === 'down' ? '점검 중' : '유휴', pax:s.job ? s.job.pax : 0, to:s.job ? s.job.to : null }; row.mine = false; }
    row.v = v0; return row;
  });
}
function planText(r) {
  var g = r.go, tp = r.tp, s = []; if (!g) return s;
  g.legs.forEach(function (l) {
    var lead = l.chg ? l.v.name + '(' + l.v.tname + ')은 배터리가 낮아 먼저 ' + l.chg.name + '에서 충전한 뒤 승차 지점으로 가요.' : l.was === 'idle' ? l.v.name + '(' + l.v.tname + ')이 지금 있는 곳에서 곧바로 승차 지점으로 가요.' : l.was === 'busy' ? l.v.name + '(' + l.v.tname + ')은 지금 손님을 T+' + l.tFree + '분에 내려 준 뒤 그곳에서 승차 지점으로 가요.' : l.v.name + '(' + l.v.tname + ')은 충전을 T+' + l.tFree + '분에 마친 뒤 승차 지점으로 가요.';
    s.push(lead + ' 승차는 T+' + l.eta + '분, ' + l.riders + '명이 타요.');
  });
  s.push('승차 뒤 ' + tp.Dn + '(' + dist(tp.P, tp.D) + 'km)까지 도로의 주행 안내선을 따라 운행해요. 도착은 T+' + g.arrive + '분쯤이에요.');
  if (g.kind === 'split') s.push('일행이 한 대에 다 앉지 못하거나 한 대를 쓰면 더 늦어서, 두 대로 나눠 같은 목적지로 보내요(차를 한 대 더 쓰는 것은 대기 ' + SPLIT_TOL + '분만큼의 비용으로 계산해요).');
  if (g.kind === 'charge') s.push('지금 바로 쓸 수 있는 차량이 없어, 가장 빨리 충전을 마치고 올 수 있는 차량으로 안내해요. 교통 AI는 차량 현황을 계속 확인하다가 더 빠른 차량이 생기면 바꿔요.');
  return s;
}
function mapSvg(r, fleet, ev) {
  var K = 20, W = GRID * K + 20, ns = 'http://www.w3.org/2000/svg';
  function e(t, a, tx) { var n = document.createElementNS(ns, t), k; for (k in a) n.setAttribute(k, a[k]); if (tx != null) n.textContent = tx; return n; }
  var svg = e('svg', { viewBox:'0 0 ' + W + ' ' + W, role:'img', 'aria-label':'가상 지도: 차량, 승차 지점, 목적지와 선택된 이동 경로', style:'width:100%;max-width:440px;border:1px solid var(--line);border-radius:12px;background:var(--soft)' });
  function X(v) { return 10 + v * K; }
  function line(a, b, o) { var q = pth(a, b); svg.appendChild(e('polyline', { points:q.map(function (p) { return X(p[0]) + ',' + X(p[1]); }).join(' '), fill:'none', stroke:o.c, 'stroke-width':o.w, 'stroke-dasharray':o.d || '' })); }
  var i, g = r.go, P = r.tp.P, D = r.tp.D;
  for (i = 0; i <= GRID; i += 2) { svg.appendChild(e('line', { x1:X(i), y1:X(0), x2:X(i), y2:X(GRID), stroke:'#DDE2EA', 'stroke-width':0.6 })); svg.appendChild(e('line', { x1:X(0), y1:X(i), x2:X(GRID), y2:X(i), stroke:'#DDE2EA', 'stroke-width':0.6 })); }
  if (g) g.legs.forEach(function (l) { line(l.pre.pos, P, { c:'#9AA3B2', w:1.6, d:'4 3' }); line(P, D, { c:'#1A5FB4', w:2.4 }); });
  if (ev && ev.kind === 'closure') { var m = along(pth(P, D), dist(P, D) * 0.5); svg.appendChild(e('text', { x:X(m[0]), y:X(m[1]) + 5, 'text-anchor':'middle', 'font-size':16, 'font-weight':700, fill:'#C9302C' }, '✕')); }
  CHARGERS.forEach(function (c) { svg.appendChild(e('rect', { x:X(c[2]) - 5, y:X(c[3]) - 5, width:10, height:10, rx:2, fill:'#FFF3C4', stroke:'#B58900' })); svg.appendChild(e('text', { x:X(c[2]), y:X(c[3]) + 3.5, 'text-anchor':'middle', 'font-size':9, fill:'#8a6700' }, '⚡')); });
  var ids = {}; if (g) g.legs.forEach(function (l) { ids[l.v.id] = 1; });
  fleet.forEach(function (u) { var on = ids[u.id], col = u.state === 'down' ? '#C9302C' : on ? '#1A5FB4' : u.state === 'busy' ? '#D9A441' : u.state === 'charge' ? '#B58900' : '#9AA3B2', sz = on ? 7 : 5;
    svg.appendChild(e('polygon', { points:X(u.x) + ',' + (X(u.y) - sz) + ' ' + (X(u.x) - sz + 1) + ',' + (X(u.y) + sz - 2) + ' ' + (X(u.x) + sz - 1) + ',' + (X(u.y) + sz - 2), fill:col })); svg.appendChild(e('text', { x:X(u.x) + 7, y:X(u.y) - 4, 'font-size':8, fill:'#49505A' }, u.id)); });
  svg.appendChild(e('rect', { x:X(D[0]) - 6, y:X(D[1]) - 6, width:12, height:12, rx:6, fill:'#1E7B46' })); svg.appendChild(e('text', { x:X(D[0]) + 9, y:X(D[1]) + 4, 'font-size':9, fill:'#1E7B46' }, '목적지'));
  svg.appendChild(e('circle', { cx:X(P[0]), cy:X(P[1]), r:6, fill:'#C9302C' })); svg.appendChild(e('text', { x:X(P[0]) + 9, y:X(P[1]) + 4, 'font-size':9, fill:'#C9302C' }, '승차'));
  return svg;
}
function addDev() {
  var f = S.form, e = {}, name = clean(f.name, 40);
  if (!name) e.name = '기기 이름을 적어 주세요.';
  if (f.chk && !/^\d{4}-\d{2}-\d{2}$/.test(f.chk)) e.chk = '점검일은 2026-11-23 모양으로 적어 주세요.';
  if (S.dev.length >= MAXD) e.name = '기록은 최대 ' + MAXD + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  S.dev.push({ id:uid(), kind:DEVKINDS.indexOf(f.kind) >= 0 ? f.kind : '폰', name:name, carry:f.carry !== false, chk:f.chk || '' }); S.form = { kind:f.kind, carry:true }; S.msg = '기록했어요.'; save(); render();
}

function setSimBtn() { var b = $('trf-sim'); if (b) b.disabled = !!S.auto; }
function topbar() { return h('div', { class:'topin' }, [h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 교통' })])]), h('button', { type:'button', class:'btn tonal simbtn', id:'trf-sim', text:'🧪 시뮬레이션', 'aria-label':'자동 시뮬레이션 열기', disabled:S.auto ? true : null, onclick:openAuto })]); }
function kv(k, v, id) { return h('div', { class:'kv' }, [h('span', { text:k }), h('b', { id:id || null, text:v })]); }
function step(n, title, kids, id) {
  return h('div', { class:'card col', id:id || null, style:'margin-top:16px' }, [h('div', { class:'rowf' }, [pill(String(n), 'm'), h('b', { style:'font-size:17px', text:title })])].concat(kids));
}

// ── 평소 준비: 내 기기 ──
function devicesBody() {
  var m = devSummary(S.dev, kst()), f = S.form, e = S.err, kids = [];
  kids.push(h('b', { style:'font-size:16px', text:'내 기기' }));
  kids.push(h('div', { class:'sub', text:'폰·나비웹 워치·링(팔찌) 중 적어도 하나를 24시간 가까이 두어야 교통 호출이 가능합니다. 직접 적는 기록이며, 기기가 나비웹에 연결되는 기능은 아직 없어요.' }));
  kids.push(h('div', { class:'g4' }, [tile('등록한 기기', m.count + '개', '', 'trf-d0'), tile('24시간 가까이 두는 기기', m.carry + '개', m.carry ? '' : '하나 이상 필요해요', 'trf-d2'), tile('점검일 지남·오늘', m.due + '개', '', 'trf-d1')]));
  kids.push(h('div', { class:'frm' }, [sel('trf-dk', '종류', f.kind, DEVKINDS.map(function (k) { return [k, k]; }), function (v) { f.kind = v; }), field('trf-dn', '기기 이름', f.name, { err:e.name, ph:'예: 내 폰', max:40, set:function (v) { f.name = v; } }), field('trf-dc', '다음 점검·충전일(선택)', f.chk, { err:e.chk, ph:'2027-01-31', mode:'numeric', max:10, set:function (v) { f.chk = v.trim(); } })]));
  kids.push(h('label', { class:'chk', for:'trf-dcarry' }, [(function () { var c = h('input', { type:'checkbox', id:'trf-dcarry', checked:f.carry !== false ? true : false }); c.onchange = function () { f.carry = c.checked; }; return c; })(), h('span', { text:'24시간 가까이 둡니다' })]));
  kids.push(h('div', { class:'rowf' }, [btn('기록하기', 'fill', addDev), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null]));
  if (!S.dev.length) kids.push(h('div', { class:'empty', text:'아직 등록한 기기가 없어요.' }));
  else kids.push(h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['종류', '이름', '24시간', '점검일', ''].map(function (t) { return h('th', { text:t }); }))]),
    h('tbody', {}, S.dev.map(function (x) { return h('tr', {}, [h('td', {}, [pill(x.kind)]), h('td', {}, [h('b', { text:x.name })]), h('td', { text:x.carry ? '예' : '아니요' }), h('td', { class:'num', text:x.chk || '—' }), h('td', { class:'r' }, [btn('삭제', 'sm quiet', function () { S.dev = S.dev.filter(function (y) { return y.id !== x.id; }); S.msg = '삭제했어요.'; save(); render(); })])]); }))])]));
  return h('div', { class:'col' }, kids);
}

// ── 평소 준비: 보내는 정보 ──
function consentBody() {
  var n = h('span', { class:'sub', id:'trf-c-n' }), n2 = h('span', { class:'sub', id:'trf-a-n' });
  function tally() { n.textContent = '보내기로 고른 항목 ' + Object.keys(S.share).length + ' / ' + (SEND.length - 1) + ' (현재 위치 제외)'; n2.textContent = '답해도 되는 질문 ' + Object.keys(S.askok).length + ' / ' + ASKS.length; }
  function list(items, store, pre, fixedKey) {
    return h('div', {}, items.map(function (f) { var id = pre + f[0], cb = h('input', { type:'checkbox', id:id, checked:f[0] === fixedKey || store[f[0]] ? true : false, disabled:f[0] === fixedKey ? true : null });
      cb.onchange = function () { if (cb.checked) store[f[0]] = 1; else delete store[f[0]]; save(); tally(); sumUpdate(); }; return h('label', { class:'chk', for:id }, [cb, h('span', { text:f[1] + (f[0] === fixedKey ? ' (항상 포함)' : '') })]); }));
  }
  var box = h('div', { class:'col' }, [h('b', { style:'font-size:16px', text:'내 비서가 내 PDV에서 꺼내 교통 AI에 보낼 정보(익명화)' }),
    h('div', { class:'sub', text:'현재 위치는 승차에 꼭 필요해 항상 포함됩니다(이름·주민번호는 어떤 경우에도 보내지 않아요). 나머지는 항목마다 직접 정하고, 고른 상태는 이 브라우저에만 저장돼요. 아래 시뮬레이션은 이 선택과 상관없이 모든 항목을 보낸 경우를 보여 줍니다.' }),
    n, list(SEND, S.share, 'trf-sh-', 'loc'), h('div', { class:'rowf' }, [btn('모두 해제', 'quiet', function () { S.share = {}; save(); render(); })]),
    h('b', { style:'font-size:16px;margin-top:8px', text:'교통 AI가 내 비서에게 추가로 물어도 되는 것' }), n2, list(ASKS, S.askok, 'trf-ak-', null), h('div', { class:'sub', text:'예시입니다. 내 비서는 허용한 질문에만 내 기록을 바탕으로 답해요. 아래 시뮬레이션은 비서가 모두 답한 경우를 보여 줍니다.' })]);
  tally(); return box;
}
function prepSummary() { var m = devSummary(S.dev, kst()); return '평소 준비 — 기기 ' + m.count + '개(24시간 가까이 ' + m.carry + '개) · 보내는 정보 ' + sharedItems(S.share).length + '항목 · 허용한 질문 ' + askItems(S.askok).length + '개'; }
function sumUpdate() { var s = $('trf-prep-sum'); if (s) s.textContent = prepSummary(); }
function prepSection() {
  var det = h('details', { id:'trf-s-prep', class:'card', style:'margin-top:16px' }, [h('summary', { id:'trf-prep-sum', style:'cursor:pointer;font-weight:700;font-size:17px', text:prepSummary() }),
    h('div', { class:'col', style:'margin-top:16px;gap:24px' }, [devicesBody(), consentBody()])]);
  det.open = !!S.prepOpen; det.ontoggle = function () { S.prepOpen = det.open; };
  return det;
}

// ── 가상 교통 수요(무작위) ──
/** 수요는 다양하다: 도시 안의 임의 지점에서 한 명 이상이 이동을 원한다. 목적지는 말한 내용 또는 PDV 일정에서 알고, 일행 수·이동 편의(휠체어·큰 짐)가 수요마다 다르다.
*  say = 말·문자로 하는 요청(여러 표현 중 하나), sched = PDV 일정에 적힌 목적지, n = 일행 수 범위, acc = 이동 편의, pref = 선호. */
var CASES = [
  { id:'work', kind:'출근', name:'출근길 한 사람', dest:'업무지구', n:[1, 1], acc:'none', can:'voice', say:['회사까지 가야 해요', '업무지구로 가고 싶어요', '출근해야 하는데 차 좀 불러 주세요'], sched:'오늘 09:00 업무지구 출근', pref:'조용한 차' },
  { id:'clinic', kind:'병원', name:'휠체어 이용자의 진료 이동', dest:'병원', n:[1, 2], acc:'wheel', can:'text', say:['병원에 가야 해요', '진료 예약이라 종합병원까지 가고 싶어요', '휠체어가 들어가는 차로 병원 가려고요'], sched:'오늘 14:00 종합병원 진료', pref:'승하차 보조' },
  { id:'airport', kind:'공항', name:'큰 짐을 든 가족 이동', dest:'공항', n:[3, 5], acc:'luggage', can:'voice', say:['공항까지 가요, 짐이 많아요', '우리 가족 공항 가려는데 큰 차로 부탁해요', '비행기 시간 전에 공항에 가야 해요'], sched:'오늘 17:30 공항 출발 항공편', pref:'' },
  { id:'school', kind:'하교', name:'학생들의 하교', dest:'도서관', n:[2, 3], acc:'none', can:'text', say:['도서관 가자', '학교 끝났어요, 도서관으로 갈래요', '친구들이랑 도서관 가요'], sched:'오늘 16:00 도서관 스터디', pref:'' },
  { id:'night', kind:'귀가', name:'늦은 밤 귀가', dest:'주택단지', n:[1, 1], acc:'none', can:'none', say:[''], sched:'귀가(집: 주택단지)', pref:'조용한 차' },
  { id:'market', kind:'장보기', name:'어르신들의 시장 나들이', dest:'시장', n:[2, 2], acc:'none', can:'voice', say:['시장 가려고 하는데요', '장 보러 가요', '시장까지 태워 주세요'], sched:'오늘 10:00 시장', pref:'승하차 보조' },
  { id:'party', kind:'모임', name:'여러 명의 저녁 모임', dest:'식당가', n:[5, 6], acc:'none', can:'text', say:['식당가로 같이 가요', '여섯이서 저녁 먹으러 가요', '모임 장소가 식당가예요'], sched:'오늘 19:00 식당가 모임', pref:'' },
  { id:'hotel', kind:'관광', name:'큰 짐을 든 여행자', dest:'호텔', n:[1, 2], acc:'luggage', can:'voice', say:['호텔까지 가요', '짐이 커서 호텔로 가야 해요'], sched:'오늘 숙소 항구 호텔', pref:'' }
];
var CASEBY = {}; CASES.forEach(function (x) { CASEBY[x.id] = x; });
var NAMES = ['김가온', '이서연', '박도윤', '최하린', '정민준', '한지우', '오세아', '윤태양'];
var ONSITE_NOTE = '아래 차량·시민·경로·요금은 모두 가상 시나리오입니다.';
function pick(a, r) { return a[Math.min(a.length - 1, Math.floor(r() * a.length))]; }
function sig(txt) {
  function f(x) { var v = 2166136261, i; for (i = 0; i < x.length; i++) { v ^= x.charCodeAt(i); v = Math.imul(v, 16777619) >>> 0; } return ('00000000' + v.toString(16)).slice(-8); }
  return 'SIG-' + f(txt) + f(txt + '#');
}
function clock(ms) { return new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Seoul', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(new Date(ms)); }
/** 기기·수요·위치·일행 수를 무작위로 뽑는다. rng 를 넘기면 같은 값이 나온다(시험용). 승차 지점은 도시 안의 임의 지점이다. */
function draw(rng, now) {
  var r = typeof rng === 'function' ? rng : Math.random, t0 = now == null ? Date.now() : now;
  var c = pick(CASES, r), dev = pick(DEVICES, r), sp = spot(c.dest), D = [sp[2], sp[3]], P, tries = 0;
  do { P = [1 + Math.floor(r() * (GRID - 1)), 1 + Math.floor(r() * (GRID - 1))]; tries++; } while (dist(P, D) < 3 && tries < 50);
  var n = c.n[0] + Math.floor(r() * (c.n[1] - c.n[0] + 1)), rn = pick(NAMES, r);
  var can = dev[0] === 'ring' ? 'none' : dev[0] === 'watch' ? (c.can === 'none' ? 'none' : 'voice') : c.can, say = can === 'none' ? '' : pick(c.say, r);
  var sc = { c:c, inc:c, dev:dev[0], devName:dev[1], P:P, D:D, Dn:sp[1], place:'x' + P[0] + 'y' + P[1], placeName:'가상 지점 (' + P[0] + ', ' + P[1] + ') 근처', xy:P, can:can, say:say, t0:t0, n:n, acc:c.acc, destVia:say ? '말한 내용' : 'PDV 일정', rider:{ name:rn, count:n } };
  sc.tp = { P:P, D:D, Dn:sp[1], n:n, acc:c.acc };
  sc.anon = 'ANON-' + sig(rn + n + sc.placeName + t0).slice(4, 10).toUpperCase();
  var m = callMessage(sc.can, sc.say); sc.msg = m;
  sc.payload = [m.label, m.body, sc.anon, P.join(','), c.sched, n, c.acc, c.pref, t0].join('|') + '|' + sc.dev;
  sc.sig = sig(sc.payload); sc.no = 'TR-' + sc.sig.slice(4, 10).toUpperCase();
  return sc;
}
function verify(sc) { return sig(sc.payload) === sc.sig; }
/** 승차 지점에서 본 차량 현황: 차량마다 하던 일을 마치는 때(avail)와 승차 지점까지의 시간, 승차 때의 배터리. */
function gather(sc, fleet) {
  return fleet.map(function (v) {
    var a = avail(v), km = a ? dist(a.pos, sc.P) : null;
    return { v:v, a:a, eta:a ? a.t + mins(km) : null, batPick:a ? a.bat - BATKM * km : null, T:TYPES[v.type] };
  });
}
function form(groups) {
  var kids = [];
  groups.forEach(function (g) { kids.push(h('div', { class:'lab', style:'margin:12px 0 4px', text:g[0] })); g[1].forEach(function (p) { if (p) kids.push(kv(p[0], p[1], p[2])); }); });
  return h('div', { style:'border:1px solid var(--line);border-radius:12px;padding:4px 16px 12px' }, kids);
}
function sub(t) { return h('b', { style:'display:block;margin-top:8px', text:t }); }

// ── 시뮬레이션 한 번(run) ──
// run = { sc:수요, fleet:지금의 차량 현황, fleetInit:처음 현황, fleet0:계획 확정 때의 현황, plan0:확정한 계획, ev:이송 중 갱신, t:시간 막대, reached:열 수 있는 가장 먼 단계, cur:보고 있는 단계 }
// 화면의 단계 목록과 오른쪽 위 시뮬레이션 버튼은 서로 다른 run 을 쓰므로 서로 영향을 주지 않는다.
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function newRun() { var f = newFleet(Math.random); return { sc:draw(Math.random), fleet:f, fleetInit:clone(f), fleet0:null, plan0:null, ev:null, t:0, reached:0, cur:-1, picked:false, seen:false }; }
function shake(R) { R.fleet.forEach(function (v) { if (Math.random() < 0.08) setDown(v, true); }); }
/** 점검 중으로 바꾸거나 되돌린다(되돌릴 때를 위해 하던 일을 적어 둔다). */
function setDown(v, on) {
  if (on && v.state !== 'down') { v.sv = { state:v.state, job:v.job, spd:v.spd, chgLeft:v.chgLeft }; v.state = 'down'; v.job = null; v.spd = 0; v.chgLeft = 0; }
  else if (!on && v.state === 'down' && v.sv) { v.state = v.sv.state; v.job = v.sv.job; v.spd = v.sv.spd; v.chgLeft = v.sv.chgLeft; v.sv = null; }
  else if (!on && v.state === 'down') { v.state = 'idle'; }
}
/** 3-1 에서 지시서를 보내는 순간 계획과 그때의 차량 현황을 굳힌다. 이후 현황이 바뀌어도(3-5) 앞 단계는 그때의 판단을 그대로 보여 준다. */
function lock(R) { if (R.plan0) return; R.fleet0 = clone(R.fleet); R.plan0 = match(R.sc.tp, R.fleet0); }
function ctx(R, re) {
  var sc = R.sc, locked = !!R.plan0, fl = locked ? R.fleet0 : R.fleet, dec = locked ? R.plan0 : match(sc.tp, R.fleet);
  return { R:R, re:re, sc:sc, locked:locked, fleet:fl, g:gather(sc, fl), dec:dec, fin:R.ev ? R.ev.after : dec };
}
var PF = 'trf-';
function X(id) { return PF + id; }
function clk(sc, t) { return clock(sc.t0 + t * 60000); }
function p1(v) { return Math.round(v * 10) / 10; }
function xy(a) { return '(' + p1(a[0]) + ', ' + p1(a[1]) + ')'; }
function paxIds(sc, legs) { var k = 0; return legs.map(function (l) { var s = []; for (var i = 0; i < l.riders; i++) s.push(sc.anon + '-' + (++k)); return s; }); }
function rows3(rows, id) { return rows.length ? h('div', { class:'tbw' }, [h('table', { class:'tbl', id:id }, [h('thead', {}, [h('tr', {}, ['방식', '차량', '승차', '비용', '승차 때 배터리'].map(function (t, i) { return h('th', { class:i > 1 ? 'r' : '', text:t }); }))]), h('tbody', {}, rows)])]) : h('div', { class:'empty', text:'쓸 수 있는 조합이 없어요.' }); }
function planList(r) { return h('div', {}, planText(r).map(function (x, i) { return h('div', { class:'stp', 'data-s':String(i) }, [h('i', { text:String(i + 1) }), h('div', {}, [h('span', { text:x })])]); })); }
function noGo(c) { return [h('div', { class:'card col hero', id:X('nogo') }, [h('div', { class:'big', text:'배차할 수 있는 차량이 없어요' }), h('div', { class:'sub', text:'조건(리프트·큰 짐·좌석)에 맞는 차량이 모두 점검 중이에요. 실제라면 교통 AI가 대기열에 올려 두고 가능해지면 바로 배차해요. 2-4에서 점검 중인 차량을 되돌리거나 “처음 상태로”를 눌러 보세요.' })])]; }
function G(fn) { return function (c) { return c.dec.go ? fn(c) : noGo(c); }; }
/** 차량 표(실시간): 위치·속도·경로(목적지)·배터리·탑승. 막대를 끌면 그 시각 값으로 바뀐다. only 가 true 면 이 수요에 배정된 차량만 보여 준다. */
function liveTable(c, only) {
  var R = c.R, sc = c.sc, g = c.fin.go, ev = R.ev, mx = endT(g) + 1, t = Math.min(R.t, mx), tb = h('tbody', { id:X('lv-body') });
  var lab = h('b', { id:X('t-lab'), text:'경과 T+' + t + '분 · 가상 시각 ' + clk(sc, t) });
  function fill(tt) {
    tb.textContent = '';
    fleetAt(c.fleet, g, ev, tt).forEach(function (q) {
      var lost = ev && ev.lost && ev.lost.v.id === q.v.id; if (only && !q.mine && !lost) return;
      tb.appendChild(h('tr', { 'data-v':q.v.id }, [h('td', {}, [h('b', { text:q.v.id }), h('div', { class:'sub', text:TYPES[q.v.type].name + (q.mine ? ' · 배정' : '') })]), h('td', { text:q.st }), h('td', { class:'num', text:xy([q.x, q.y]) }), h('td', { class:'r num', text:q.spd ? q.spd + ' km/h' : '정지' }),
        h('td', { class:'num', text:q.to ? '→ ' + xy(q.to) : '—' }), h('td', { class:'r num' + (q.bat < 20 ? ' dn' : ''), text:Math.round(q.bat) + '%' }), h('td', { class:'r num', text:q.pax + '명' })]));
    });
  }
  fill(t);
  var rg = h('input', { type:'range', id:X('t'), min:'0', max:String(mx), value:String(t), 'aria-label':'경과 시간(분)', style:'width:100%' });
  rg.oninput = function () { var v = Number(rg.value); R.t = v; lab.textContent = '경과 T+' + v + '분 · 가상 시각 ' + clk(sc, v); fill(v); };
  return h('div', { class:'col' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('lv') }, [h('thead', {}, [h('tr', {}, ['차량', '상태', '위치(km)', '속도', '경로(목적지)', '배터리', '탑승'].map(function (x, i) { return h('th', { class:i === 2 || i === 4 ? '' : i > 2 ? 'r' : '', text:x }); }))]), tb])]),
    h('div', { class:'card col', style:'margin-top:12px' }, [lab, rg, h('div', { class:'sub', text:'막대를 끌어 시간이 흐를 때 위치·속도·배터리·탑승 인원이 어떻게 바뀌는지 보세요. 교통 AI는 모든 차량에게서 이 값을 실시간으로 받아 갱신해요(가정: 1분마다). ' + ONSITE_NOTE })])]);
}
function sendForm(sc) {
  var m = sc.msg, c = sc.c;
  return form([
    ['① 기기에서 보낸 교통 메시지', [['전송 기기', sc.devName + (sc.dev === 'ring' ? ' (말·문자 입력이 없는 기기)' : ''), X('s1-dev')], ['전달 형태', m.label, X('s1-mode')], ['내용', m.body || '없음 — 오직 “교통”만 전달(목적지는 PDV 일정이 대신 말해요)', X('s1-body')], ['받는 곳', '교통 AI']]],
    ['② 내 AI 비서가 내 PDV에서 꺼내 익명화한 정보', [['익명 번호', sc.anon, X('s1-anon')], ['현재 위치(승차 지점)', sc.placeName + ' (가상 좌표 ' + sc.P[0] + ', ' + sc.P[1] + ') — 승차에만 써요', X('s1-loc')], ['오늘 일정·목적지', c.sched], ['동행 인원', sc.n + '명(이름 없이 인원만)'], ['이동 편의', ACC[sc.acc]], ['선호', c.pref || '없음'], ['빼는 정보', '이름·주민번호·정확한 주소는 보내지 않아요']]],
    ['③ 접수 정보', [['호출 시각', clock(sc.t0) + ' (가상)'], ['운행 번호', sc.no, X('s1-no')]]],
    ['④ 이용자(또는 동행 대표)의 디지털 서명', [['서명값', sc.sig, X('s1-sig')], ['서명 방식', '단말의 개인 키로 서명(가상). 교통 AI가 받은 뒤 확인합니다.']]]]);
}

// ── 19개 세부 단계(각각 눌린 단계 아래로 펼쳐지는 패널에 결과를 보여 준다) ──
function s11(c) { var sc = c.sc, how = { phone:'폰의 교통 버튼을 누릅니다.', watch:'나비웹 워치의 교통 버튼을 길게 누릅니다.', ring:'링(팔찌)을 두 번 눌러 교통을 보냅니다.' }[sc.dev];
  return [h('div', { class:'sub', text:'가상 수요입니다. 기기·일행·승차 지점은 무작위로 뽑았어요. 도시 안 어디서든 이동이 필요하면 가장 단순한 조작 한 번으로 교통 AI를 부릅니다.' }), form([['기기 호출', [['사용한 기기', sc.devName, X('s1-dev')], ['조작(가상)', how], ['호출 시각', clock(sc.t0) + ' (가상)'], ['어떤 수요', sc.c.name + ' · ' + sc.n + '명', X('s1-inc')], ['승차 지점', sc.placeName]]]])]; }
function s12(c) { var sc = c.sc, m = sc.msg;
  return [form([['교통 메시지 구성', [['말·문자 입력', sc.can === 'voice' ? '말할 수 있음' : sc.can === 'text' ? '문자를 입력할 수 있음' : '둘 다 어려움'], ['전달 형태', m.label, X('s1-mode')], ['내용', m.body || '없음 — 오직 “교통”만 전달', X('s1-body')], ['이유', m.only ? (sc.dev === 'ring' ? '링에는 말·문자 입력이 없어 “교통”만 갑니다. 목적지는 PDV의 오늘 일정에서 가져와요.' : '말도 문자도 어려워 “교통”만 갑니다. 목적지는 PDV의 오늘 일정에서 가져와요.') : '“교통” 표시와 함께 ' + (m.mode === 'voice' ? '음성' : '문자') + '을(를) 보냅니다.']]]])]; }
function s13(c) { var sc = c.sc, p = sc.c;
  return [h('div', { class:'sub', text:'이용자의 나만의 AI 비서가 이용자의 PDV(내 데이터 금고)에서 필요한 정보만 꺼내 익명화해 붙입니다. 이 시뮬레이션은 모든 항목을 보내기로 한 경우를 보여 줍니다. 실제로는 “평소 준비”에서 고른 항목만 전송되고, 현재 위치는 항상 포함돼요.' }),
    form([['PDV 에서 꺼낸 정보(익명)', [['익명 번호', sc.anon, X('s1-anon')], ['현재 위치(승차 지점)', sc.placeName + ' (가상 좌표 ' + sc.P[0] + ', ' + sc.P[1] + ')', X('s1-loc')], ['오늘 일정·목적지', p.sched, X('s1-sched')], ['동행 인원', sc.n + '명(이름 없이 인원만)', X('s1-party')], ['이동 편의', ACC[sc.acc], X('s1-acc')], ['선호', p.pref || '없음']]]])]; }
function s14(c) { return [h('div', { class:'sub', text:'위 내용을 하나의 Form으로 묶어 디지털 서명을 붙이고 교통 AI로 보냅니다.' }), sendForm(c.sc)]; }
function s21(c) { var sc = c.sc; return [form([['서명 확인', [['받은 서명', sc.sig], ['확인 결과', verify(sc) ? '일치 — 전달 중 내용이 바뀌지 않았어요' : '불일치 — 위변조 의심', X('s2-sig')], ['익명 번호', sc.anon], ['운행 번호', sc.no]]]])]; }
function s22(c) { var sc = c.sc, km = dist(sc.P, sc.D);
  var need = sc.acc === 'wheel' ? '리프트 차량 한 대(휠체어 일행은 나누지 않아요)' : sc.acc === 'luggage' ? '승합 차량(큰 짐) — 좌석이 모자라면 승합 두 대' : '좌석 ' + sc.n + '석 — 한 대에 앉으면 한 대, 아니면 두 대';
  return [form([['수요 정리', [['목적지', sc.Dn + ' (' + sc.destVia + '에서 확인)', X('s2-dest')], ['승차 → 목적지', km + 'km · 직행 약 ' + mins(km) + '분'], ['일행', sc.n + '명', X('s2-party')], ['이동 편의', ACC[sc.acc]], ['필요한 차량 조건', need, X('s2-need')], ['요청 시각', clock(sc.t0) + ' (가상)']]]]),
    h('div', { class:'sub', text:'교통 AI는 일행 수·이동 편의·목적지까지만 정리해요. 어느 차량이 갈지는 다음 단계에서 모든 차량의 위치·경로·배터리를 보고 정합니다.' })]; }
function s23(c) { var sc = c.sc, w = sc.c.id === 'airport' ? '항공편이라 15분 안에 출발해야 해요(가상)' : sc.c.id === 'clinic' ? '예약 시각 전이면 10분은 괜찮아요(가상)' : '10분 정도는 기다릴 수 있어요(가상)', bag = sc.acc === 'luggage' ? '큰 가방 ' + (sc.n + 1) + '개(가상)' : sc.acc === 'wheel' ? '휠체어 1대, 짐 없음(가상)' : '작은 가방만(가상)';
  return [h('div', { class:'sub', text:'교통 AI가 배차에 꼭 필요한 것을 이용자의 비서에게 더 묻습니다. 비서는 허용된 질문에만 PDV 기록을 바탕으로 답해요.' }), form([['추가 질의', [['교통 AI → 비서: 얼마나 기다릴 수 있나요?', '답: ' + w, X('s2-ask0')], ['교통 AI → 비서: 짐은 어떤가요?', '답: ' + bag, X('s2-ask1')]]]])]; }
function s24(c) {
  var sc = c.sc, lock0 = c.locked, rows = c.g.map(function (x) { var v = x.v, a = x.a, T = x.T, st = v.state === 'idle' ? '유휴' : v.state === 'busy' ? '손님 운송 중' : v.state === 'charge' ? '충전 중' : '점검 중', on = v.state !== 'down';
    return h('tr', {}, [h('td', {}, [h('b', { text:v.id }), h('div', { class:'sub', text:T.name + ' · ' + T.seats + '석' + (T.lift ? ' · 리프트' : '') })]), h('td', { text:st }), h('td', { class:'num', text:xy([v.x, v.y]) }), h('td', { class:'r num', text:v.state === 'busy' ? v.spd + ' km/h' : '정지' }), h('td', { class:'num', text:v.job ? '→ ' + xy(v.job.to) : '—' }),
      h('td', { class:'r num' + (v.bat < 20 ? ' dn' : ''), text:Math.round(v.bat) + '%' }), h('td', { class:'r num', text:(v.job ? v.job.pax : 0) + '명' }), h('td', { class:'r num', text:on ? (v.state === 'idle' ? x.eta + '분' : x.eta + '분(일을 마친 뒤)') : '—' }),
      h('td', {}, [h('button', { type:'button', class:'chip', disabled:lock0 ? true : null, 'data-down':v.id, 'aria-pressed':String(v.state === 'down'), text:v.state === 'down' ? '점검 중 (되돌리기)' : '점검으로 바꾸기', onclick:function () { setDown(v, v.state !== 'down'); c.re(); } })])]); });
  var idle = c.g.filter(function (x) { return x.v.state === 'idle'; }).length, soon = c.g.filter(function (x) { return x.v.state === 'busy' || x.v.state === 'charge'; }).length, off = c.g.filter(function (x) { return x.v.state === 'down'; }).length;
  return [h('div', { class:'sub', text:'교통 AI는 모든 차량의 현재 위치·속도·경로(목적지)·배터리·탑승 인원을 실시간으로 받아 둡니다. 승차 지점(' + sc.placeName + ')까지 걸리는 시간은 차량이 지금 하던 일을 마치는 때와 곳에서부터 셉니다.' + (lock0 ? ' 아래는 지시서를 보낼 때(3-1)의 현황이에요.' : '') }),
    h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('s2-fleet') }, [h('thead', {}, [h('tr', {}, ['차량', '상태', '위치(km)', '속도', '경로(목적지)', '배터리', '탑승', '승차까지', ''].map(function (t, i) { return h('th', { class:i > 2 && i !== 4 && i < 8 ? 'r' : '', text:t }); }))]), h('tbody', {}, rows)])]),
    h('div', { class:'sub', id:X('s2-av'), text:'지금 바로 갈 수 있는 차량 ' + idle + '대 · 하던 일을 마치면 갈 수 있는 차량 ' + soon + '대 · 쓸 수 없는 차량 ' + off + '대' }),
    h('div', { class:'sub', text:lock0 ? '지시서를 이미 보내 현황은 더 바꿀 수 없어요.' : '버튼을 눌러 차량을 점검으로 바꾸면(저장하지 않습니다) 다음 단계의 배차가 달라져요.' }),
    lock0 ? null : h('div', { class:'rowf' }, [btn('처음 상태로', 'quiet', function () { c.R.fleet = clone(c.R.fleetInit); c.re(); })])];
}
function s25(c) {
  var r = c.dec, g = r.go, tp = r.tp, hero = h('div', { class:'card col hero', id:X('m-res') }), best = r.best;
  var names = g.legs.map(function (l) { return l.v.id + '(' + l.v.tname + ')'; }).join(' + ');
  hero.appendChild(h('div', { class:'big', id:X('m-start'), text:'승차 약 ' + g.pickupAt + '분 뒤 · ' + names }));
  hero.appendChild(h('div', { class:'sub', id:X('m-kind'), text:g.kind === 'single' ? '한 대로 일행 ' + tp.n + '명이 모두 타요. 도착은 T+' + g.arrive + '분쯤이에요.' : g.kind === 'split' ? '한 대에 앉지 못하거나 두 대가 더 빨라, 두 대로 나눠 같은 목적지로 가요.' : '지금 바로 쓸 수 있는 차량이 없어, 가장 빨리 충전을 마치고 오는 차량으로 안내해요.' }));
  var opts = r.options.slice(0, 5).map(function (o, i) { return h('tr', {}, [h('td', {}, [pill(o.legs.length > 1 ? '두 대' : '한 대', o.legs.length > 1 ? 'm' : 'p')]), h('td', {}, [h('b', { text:(i === 0 ? '★ ' : '') + o.legs.map(function (l) { return l.v.id; }).join(' + ') })]), h('td', { class:'r num', text:o.eta + '분' }), h('td', { class:'r num', text:o.cost + '점' }), h('td', { class:'r num', text:o.legs.map(function (l) { return Math.round(l.batPick) + '%'; }).join(' / ') })]); });
  return [hero, sub('승차가 가장 빠른 순서(비용 = 승차 시간 + 차를 한 대 더 쓰면 ' + SPLIT_TOL + '점)'), best ? rows3(opts, X('m-opts')) : h('div', { class:'sub', id:X('m-opts'), text:'바로 쓸 수 있는 조합이 없어요.' }), h('div', {}, [mapSvg(r, c.fleet, null), h('div', { class:'sub', text:'빨간 점이 승차 지점, 초록 원이 목적지, 파란 삼각형이 배정된 차량이에요. 회색 점선은 차량이 승차 지점까지 가는 길, 파란 선은 승차 뒤 운행 경로입니다.' })]),
    r.why.length ? h('div', { id:X('m-why') }, [h('b', { text:'조합에서 빠진 이유' }), h('div', {}, r.why.map(function (w) { return kv(w[0], w[1]); }))]) : null];
}
function s26(c) {
  var r = c.dec, g = r.go, sc = c.sc, km = dist(sc.P, sc.D);
  return [form([['운행 계획서 · ' + sc.no, [['승차 지점', sc.placeName], ['목적지', sc.Dn + ' (' + km + 'km)'], ['일행', sc.n + '명 · ' + ACC[sc.acc]], ['차량', g.legs.map(function (l) { return l.v.id + '(' + l.v.tname + ') ' + l.riders + '명 · 승차 T+' + l.eta + '분'; }).join(' / '), X('s2-plan')], ['도착', 'T+' + g.arrive + '분쯤 (가상 ' + clk(sc, g.arrive) + ')'], ['예상 요금', g.legs.length + '대 × (기본 ' + won(BASEFARE) + ' + ' + won(PERKM) + '×' + km + 'km) = ' + won(g.legs.length * (BASEFARE + PERKM * km)) + ' GDC(가상 요금)'], ['결정 주체', '배차·경로는 교통 AI가 정해요(사람 운전 없음)']]]]), planList(r)];
}
function dispatchList(sc, r) {
  var g = r.go, tp = r.tp, L = [];
  g.legs.forEach(function (l) { L.push({ k:'veh', who:l.v.id + ' (' + l.v.tname + ') · ' + l.riders + '명', order:(l.chg ? '먼저 ' + l.chg.name + '에서 충전한 뒤 ' : l.was === 'idle' ? '' : l.was === 'busy' ? '지금 손님을 내려 준 뒤 ' : '충전을 마친 뒤 ') + '승차 지점(' + xy(tp.P) + ')으로 가서 ' + l.riders + '명을 태우고 ' + tp.Dn + '으로 운행합니다. 운행 중에는 위치·속도·배터리·탑승 인원을 계속 보내요.', due:'T+' + l.eta + '분 승차 · T+' + l.arrive + '분 도착' }); });
  L.push({ k:'road', who:'도로 관제(주행 안내선)', order:'승차 지점 → ' + tp.Dn + ' 구간의 주행 안내선을 차량별 시간대로 예약해, 다른 차량과 겹치지도 막히지도 않게 합니다.', due:'즉시' });
  L.push({ k:'vic', who:'이용자의 나만의 AI 비서', order:'배정된 차량 번호·승차 위치·도착 예상 시각을 알립니다. 말·문자가 어려우면 진동으로 간단히 알려요.', due:'즉시' });
  return L;
}
function s31(c) {
  var r = c.dec, L = dispatchList(c.sc, r);
  return [h('div', { class:'sub', text:'교통 AI가 배정 차량, 도로 관제, 이용자의 비서에 지시서를 동시에 보냅니다. 발송 시각은 T+0분이고, 이때 계획이 확정돼요. 지금 손님을 태우고 있는 차량은 그 손님을 먼저 내려 준 뒤에 이 일을 맡아요.' }),
    h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('s3-tbl') }, [h('thead', {}, [h('tr', {}, ['받는 곳', '지시 내용', '예정'].map(function (x) { return h('th', { text:x }); }))]), h('tbody', {}, L.map(function (x) { return h('tr', {}, [h('td', {}, [h('b', { text:x.who })]), h('td', { text:x.order }), h('td', { text:x.due })]); }))])])];
}
function s32(c) { var g = c.fin.go;
  return [h('div', { class:'sub', text:'배정된 차량이 승차 지점으로 가요. ' + g.legs.map(function (l) { return l.v.id + '는 ' + (l.was === 'idle' && !l.chg ? '지금 있는 곳에서 바로' : l.chg ? '먼저 충전하고' : '하던 일을 마친 뒤') + ' T+' + l.eta + '분에 도착'; }).join(', ') + '해요. 도착할 때까지 도로 관제가 주행 안내선 구간을 비워 줘요.' }), liveTable(c, true)]; }
function s33(c) { var sc = c.sc, g = c.fin.go, ids = paxIds(sc, g.legs), tot = g.legs.reduce(function (a, l) { return a + l.riders; }, 0);
  var groups = [['탑승 확인', [['요청 인원', sc.n + '명'], ['탑승 인원(합)', tot + '명', X('s3-board')], ['일치 확인', tot === sc.n ? '일치 — 출발해요' : '불일치 — 출발하지 않아요', X('s3-match')], ['이동 편의', sc.acc === 'wheel' ? '리프트로 휠체어를 올리고 고정했어요(가상)' : sc.acc === 'luggage' ? '큰 짐을 적재했어요(가상)' : '특별한 준비 없음']]]];
  g.legs.forEach(function (l, i) { groups.push(['차량 ' + l.v.id + ' 탑승 기록(익명)', [['승차 시각', 'T+' + l.eta + '분 · 가상 ' + clk(sc, l.eta)], ['탑승 시민', ids[i].join(', '), X('s3-ids') + i], ['차량 탑승 인원', '0명 → ' + l.riders + '명', X('s3-pax') + i]]]); });
  return [h('div', { class:'sub', text:'차량이 도착하면 이용자의 비서가 탑승을 확인해요. 요청한 인원과 실제로 탄 인원이 같아야 출발하고, 탑승 인원은 곧바로 차량 상태에 갱신돼요.' }), form(groups), liveTable(c, true)]; }
function s34(c) { return [h('div', { class:'sub', text:'운행하는 동안 교통 AI는 전체 차량(배정 차량과 다른 손님을 태운 차량 모두)의 위치·속도·경로·배터리·탑승 인원을 받아 한 장의 현황으로 갱신해요. 배터리가 모자라지는 차량이 생기면 새 일을 주지 않고 충전소로 보내요.' }), liveTable(c, false)]; }
/** 이송 중 사건 둘 중 하나: ① 배정 차량 하나가 승차 지점에 닿기 전에 이상으로 멈춘다 → 그 시각의 전체 차량 상태에서 그 일행만 다시 배차한다. ② 가던 길 한 구간이 막힌다 → 모든 차량이 한두 블록 돌아간다. */
function triggerEvent(R, re) {
  if (R.ev) return; lock(R); var p0 = R.plan0; if (!p0 || !p0.go) return;
  var g = p0.go, fa = g.legs.filter(function (l) { return l.eta - l.tFree >= 3; }), ev = null, at;
  if (fa.length && Math.random() < 0.5) {
    var lost = fa[Math.floor(Math.random() * fa.length)]; at = Math.min(Math.max(lost.tFree + 1, Math.round((lost.tFree + lost.eta) / 2)), lost.eta - 1);
    var a2 = match(R.sc.tp, R.fleet0, { at:at, prev:p0, fault:lost.v.id });
    if (a2 && a2.go) ev = { kind:'fault', at:at, what:lost.v.id + '에 구동계 이상이 생겨 멈춤(가상)', lost:lost, after:a2 };
  }
  if (!ev) {
    var l0 = g.legs[0], extra = Math.random() < 0.5 ? 2 : 4, after = clone(p0); at = Math.round((l0.eta + BOARD + l0.arrive) / 2); after.go = detourGo(g, at, extra);
    ev = { kind:'closure', at:at, extra:extra, what:'가던 길의 한 구간이 막혀(가상) 한두 블록 돌아가야 해요', after:after };
  }
  R.ev = ev; re();
}
function s35(c) {
  var R = c.R, r = c.dec, g0 = r.go, ev = R.ev, sc = c.sc, kids = [h('div', { class:'sub', text:'운행 중에도 교통 AI는 도로와 차량 상태를 계속 받습니다. 배정 차량이 승차 전에 멈추면 그 시각의 전체 차량 상태에서 그 일행을 다시 배차하고, 가던 길의 구간이 막히면 모든 차량에 새 경로를 내려 보내요. 이 단계는 건너뛰어도 됩니다.' })];
  kids.push(h('div', { class:'rowf' }, [h('button', { type:'button', class:'btn fill', id:X('ev'), disabled:ev ? true : null, text:ev ? '사건이 발생했어요' : '운행 중 사건 일으키기 (모의)', onclick:function () { triggerEvent(R, c.re); } })]));
  if (ev) {
    var a = ev.after, n = a.go;
    if (ev.kind === 'fault') {
      var nl = n.legs.filter(function (l) { return !ev.lost || l.v.id !== ev.lost.v.id; }), fresh = n.legs.filter(function (l) { return g0.legs.map(function (x) { return x.v.id; }).indexOf(l.v.id) < 0; });
      kids.push(form([['실시간 재배차', [['발생 시각', 'T+' + ev.at + '분 · 가상 ' + clk(sc, ev.at)], ['사건', ev.what], ['그때 상태', ev.lost.v.id + '는 승차 지점으로 가던 중이었고, 일행은 승차 지점에서 기다리는 중'], ['처리', '그 시각의 전체 차량 위치·배터리로 ' + ev.lost.riders + '명을 다시 맞췄어요(다른 차량은 그대로 가요)'],
        ['새 차량', fresh.map(function (l) { return l.v.id + '(' + l.v.tname + ') · 승차 T+' + l.eta + '분'; }).join(', ') || '없음', X('ev-new')], ['승차 시각 변화', 'T+' + g0.pickupAt + '분 → T+' + n.pickupAt + '분 (' + (n.pickupAt - g0.pickupAt >= 0 ? '+' : '') + (n.pickupAt - g0.pickupAt) + '분)'], ['도착 시각 변화', 'T+' + g0.arrive + '분 → T+' + n.arrive + '분'], ['멈춘 차량', ev.lost.v.id + '는 점검을 호출하고 새 일에서 빠져요']]]]));
    } else {
      var minB = Math.min.apply(null, n.legs.map(function (l) { return l.batEnd; }));
      kids.push(form([['실시간 우회', [['발생 시각', 'T+' + ev.at + '분 · 가상 ' + clk(sc, ev.at)], ['사건', ev.what], ['새 경로', '약 ' + ev.extra + 'km 돌아가요(도로 관제가 다른 차량과 겹치지 않는 구간을 새로 예약)', X('ev-new')], ['도착 시각 변화', 'T+' + g0.arrive + '분 → T+' + n.arrive + '분 (+' + (n.arrive - g0.arrive) + '분)'], ['배터리 확인', '도착 때 가장 낮은 배터리 약 ' + Math.round(minB) + '% — 충전소까지 갈 여유가 있어요']]]]));
    }
    kids.push(planList(a));
  }
  return kids;
}
function s41(c) { var sc = c.sc, g = c.fin.go, ids = paxIds(sc, g.legs);
  return [h('div', { class:'sub', text:c.R.ev ? '운행 중 경로·차량이 바뀌었지만, 새 계획대로 목적지에 도착해요.' : '차량이 목적지에 도착해 시민이 내려요.' }),
    form([['도착과 하차', [['목적지', sc.Dn, X('s4-dest')], ['도착 시각', 'T+' + g.arrive + '분 · 가상 ' + clk(sc, g.arrive), X('s4-arrive')], ['하차 인원', sc.n + '명(탑승 기록과 같아요)'], ['이용자 비서에게', '도착 안내를 보내고, 두고 내린 물건이 없는지 확인해요(가상)']]]].concat(g.legs.map(function (l, i) { return ['차량 ' + l.v.id + ' 하차 기록', [['도착', 'T+' + l.arrive + '분'], ['차량 탑승 인원', l.riders + '명 → 0명', X('s4-pax') + i], ['도로 관제', '이 차량이 쓰던 주행 안내선 예약을 풀어요']]]; })))]; }
function s42(c) { var sc = c.sc, g = c.fin.go, base = sc.no + '|' + sc.anon, tot = 0, rows = g.legs.map(function (l) { var km = dist(sc.P, sc.D) + l.detour, f = BASEFARE + PERKM * km; tot += f; return h('tr', {}, [h('td', {}, [h('b', { text:l.v.id })]), h('td', { class:'r num', text:km + 'km' }), h('td', { class:'r num', text:won(f) + ' GDC' })]); });
  return [h('div', { class:'sub', text:'요금은 실제로 달린 거리(우회 포함)로 계산해요. 이 화면의 요금은 가상 값이며 실제 결제가 일어나지 않아요.' }),
    h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('s4-fare') }, [h('thead', {}, [h('tr', {}, ['차량', '운행 거리', '요금'].map(function (x, i) { return h('th', { class:i ? 'r' : '', text:x }); }))]), h('tbody', {}, rows)])]),
    form([['정산과 기록', [['합계', won(tot) + ' GDC(가상)', X('s4-total')], ['정산 방식', '이용자의 지갑(GDC) → 교통 시스템. 일행 대표의 서명으로 확정해요(가상)'], ['이용 서명', sig(base + '|PAY'), X('s4-sig1')], ['교통 AI 서명', sig(base + '|AI'), X('s4-sig2')], ['이용자의 PDV', '이동 기록이 저장돼요(가상)'], ['교통 인프라', '익명 번호로 이동 수요 통계만 남아요(이름 제외)']]]])]; }
var LOWBAT = 30;
function s43(c) { var sc = c.sc, g = c.fin.go, rows = g.legs.map(function (l) { var C = nearestChg(sc.D), low = l.batEnd < LOWBAT;
  return h('tr', {}, [h('td', {}, [h('b', { text:l.v.id })]), h('td', { class:'num', text:xy(sc.D) }), h('td', { class:'r num' + (low ? ' dn' : ''), text:Math.round(l.batEnd) + '%' }), h('td', { class:'r num', text:'0명' }), h('td', { text:low ? C.name + '(' + C.km + 'km)로 보내 충전' : '유휴로 두고 다음 수요 대기' })]); });
  return [h('div', { class:'sub', text:'내려 준 차량의 위치·배터리·탑승 인원을 갱신하고 다음 일을 정해요. 배터리가 ' + LOWBAT + '% 밑이면 새 일을 주지 않고 가장 가까운 충전소로 보냅니다.' }),
    h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('s4-veh') }, [h('thead', {}, [h('tr', {}, ['차량', '위치(km)', '배터리', '탑승', '다음 일'].map(function (x, i) { return h('th', { class:i > 1 && i < 4 ? 'r' : '', text:x }); }))]), h('tbody', {}, rows)])])]; }
/** 하차가 끝난 시각의 전체 현황에서 유휴 차량이 어느 구역에 몰렸는지 보고, 한 대를 비어 있는 구역으로 미리 보낼지 정한다. */
function zoneOf(x, y) { return (x < GRID / 2 ? '서' : '동') + (y < GRID / 2 ? '북' : '남'); }
function rebalance(rows) {
  var zones = { '서북':[], '동북':[], '서남':[], '동남':[] };
  rows.forEach(function (q) { if (q.st === '유휴' || q.st === '하차 완료 · 대기') zones[zoneOf(q.x, q.y)].push(q); });
  var names = Object.keys(zones), most = names.slice().sort(function (a, b) { return zones[b].length - zones[a].length || (a < b ? -1 : 1); })[0], least = names.slice().sort(function (a, b) { return zones[a].length - zones[b].length || (a < b ? -1 : 1); })[0];
  var mover = zones[most].filter(function (q) { return q.bat >= 40; }).sort(function (a, b) { return b.bat - a.bat || (a.v.id < b.v.id ? -1 : 1); })[0] || null;
  return { zones:zones, most:most, least:least, move:zones[most].length - zones[least].length >= 2 && mover ? { v:mover.v.id, from:most, to:least } : null };
}
function s44(c) { var sc = c.sc, g = c.fin.go, T = endT(g), rows = fleetAt(c.fleet, g, c.R.ev, T), rb = rebalance(rows), base = sc.no + '|' + sc.anon, wait = g.pickupAt, ride = g.arrive - g.pickupAt;
  var tb = rows.map(function (q) { return h('tr', {}, [h('td', {}, [h('b', { text:q.v.id }), h('div', { class:'sub', text:TYPES[q.v.type].name })]), h('td', { text:q.st }), h('td', { class:'num', text:xy([q.x, q.y]) }), h('td', { class:'r num' + (q.bat < 20 ? ' dn' : ''), text:Math.round(q.bat) + '%' }), h('td', { class:'r num', text:q.pax + '명' })]); });
  var zt = Object.keys(rb.zones).map(function (k) { return k + ' ' + rb.zones[k].length + '대'; }).join(' · ');
  return [h('div', { class:'card col hero' }, [h('div', { class:'big', id:X('s4-end'), text:'기다림 ' + wait + '분 · 탑승 ' + ride + '분 · 도착 T+' + T + '분' }), h('div', { class:'sub', text:'차량 ' + g.legs.length + '대, ' + sc.n + '명이 이동했어요. 이 흐름은 모두 모의 체험이며, 시민·차량·요금·시간은 가상입니다.' })]),
    sub('하차가 끝난 시각(T+' + T + '분)의 전체 차량 현황'), h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('s4-fleet') }, [h('thead', {}, [h('tr', {}, ['차량', '상태', '위치(km)', '배터리', '탑승'].map(function (x, i) { return h('th', { class:i > 2 ? 'r' : '', text:x }); }))]), h('tbody', {}, tb)])]),
    form([['다음 수요 대비', [['구역별 유휴 차량', zt, X('s4-zones')], ['재배치', rb.move ? rb.move.v + '를 ' + rb.move.from + ' 구역에서 ' + rb.move.to + ' 구역으로 미리 보내 둬요(유휴 차량이 한쪽에 몰려 있어서)' : '유휴 차량이 고르게 흩어져 있어 그대로 둬요', X('s4-rebal')], ['운행 기록 지문', sig(base + '|END'), X('s4-sig0')], ['결정 주체', '배차·경로·재배치는 교통 AI가 했어요 — 사람의 개입 없이 기록만 남아요']]]])];
}

var STAGES = ['교통 호출', '교통 AI 대응', '배차·이동', '운행·정산'];
var STEPS = [
  { id:'1-1', st:0, title:'기기 호출', desc:'폰·워치·링으로 교통 AI를 불러요', fn:s11 }, { id:'1-2', st:0, title:'메시지 구성', desc:'말·문자가 되면 함께, 아니면 “교통”만', fn:s12 },
  { id:'1-3', st:0, title:'PDV 정보 첨부', desc:'내 비서가 내 PDV에서 익명화해 붙여요', fn:s13 }, { id:'1-4', st:0, title:'디지털 서명과 전송', desc:'전체 Form에 서명을 붙여 교통 AI로', fn:s14 },
  { id:'2-1', st:1, title:'접수와 서명 확인', desc:'내용이 바뀌지 않았는지 확인해요', fn:s21 }, { id:'2-2', st:1, title:'수요 정리', desc:'목적지·일행·이동 편의를 정해요', fn:s22 },
  { id:'2-3', st:1, title:'비서에게 추가 질의', desc:'기다릴 수 있는 시간·짐을 물어요', fn:s23 }, { id:'2-4', st:1, title:'차량 현황 취합', desc:'모든 차량의 위치·경로·배터리를 봐요', fn:s24 },
  { id:'2-5', st:1, title:'배차 선정', desc:'가장 빨리 태울 차량(들)을 골라요', fn:G(s25) }, { id:'2-6', st:1, title:'운행 계획서', desc:'차량·경로·도착·요금을 한 장으로 써요', fn:G(s26) },
  { id:'3-1', st:2, title:'지시서 발송', desc:'차량·도로 관제·비서에 동시에', fn:G(s31) }, { id:'3-2', st:2, title:'승차 지점으로 이동', desc:'배정 차량이 이용자에게 가요', fn:G(s32) },
  { id:'3-3', st:2, title:'승차와 탑승 확인', desc:'인원을 확인하고 탑승을 갱신해요', fn:G(s33) }, { id:'3-4', st:2, title:'운행과 실시간 파악', desc:'모든 차량의 위치·속도·배터리를 봐요', fn:G(s34) },
  { id:'3-5', st:2, title:'실시간 갱신', desc:'차량이 멈추거나 길이 막히면 다시 정해요', fn:G(s35) },
  { id:'4-1', st:3, title:'도착과 하차', desc:'목적지에 내리고 탑승 인원을 갱신해요', fn:G(s41) }, { id:'4-2', st:3, title:'요금 정산과 기록', desc:'달린 거리로 계산하고 기록해요', fn:G(s42) },
  { id:'4-3', st:3, title:'차량 상태 갱신', desc:'위치·배터리를 갱신하고 다음 일을 정해요', fn:G(s43) }, { id:'4-4', st:3, title:'운행 결과와 재배치', desc:'전체 현황을 보고 유휴 차량을 미리 보내요', fn:G(s44) }
];
var PLAN_AT = 10; // 3-1(지시서 발송)을 여는 순간 계획을 확정한다


// ── 단계 이동(run 마다 따로) ──
function openStep(R, i, re) { if (i < 0 || i >= STEPS.length || i > R.reached) return; if (i >= PLAN_AT) lock(R); R.cur = i; R.seen = true; R.reached = Math.max(R.reached, Math.min(i + 1, STEPS.length - 1)); re(); }
function advance(R, re) { var i = R.cur + 1; if (i >= STEPS.length) return; R.reached = Math.max(R.reached, i); openStep(R, i, re); }

// ── 화면: 진행 막대 · 단계 목록 · 패널 ──
function progressBar() {
  var R = S.sim, cur = R.cur, wrap = h('div', { class:'bar', id:'trf-bar' });
  STAGES.forEach(function (name, si) {
    var ticks = []; STEPS.forEach(function (s, i) { if (s.st !== si) return;
      var cl = 'tick ' + (i < R.reached ? 'done' : i === R.reached ? 'next' : 'lock') + (i === cur ? ' cur' : '') + (cur >= 0 && i === cur + 1 ? ' blink slow' : '');
      ticks.push(h('button', { type:'button', class:cl, id:'trf-tick-' + s.id, 'data-i':String(i), 'aria-label':s.id + ' ' + s.title, title:s.id + ' ' + s.title, 'aria-current':i === cur ? 'step' : null, disabled:i > R.reached ? true : null, onclick:function () { pickStep(R, i); } })); });
    wrap.appendChild(h('div', { class:'bseg' }, [h('div', { class:'bname', text:(si + 1) + '. ' + name }), h('div', { class:'bticks' }, ticks)]));
  });
  return h('div', { class:'barwrap' }, [wrap, h('div', { class:'bcap', id:'trf-bar-cap', text:cur >= 0 ? (cur + 1) + ' / ' + STEPS.length + ' · ' + STEPS[cur].id + ' ' + STEPS[cur].title : '0 / ' + STEPS.length + ' · 1-1 기기 호출부터 눌러 보세요' })]);
}
/** 새 사건을 뽑은 뒤 지금 무엇을 하면 되는지 알려 주는 배너. */
function nextHint() {
  var R = S.sim; if (!R.picked) return null;
  var last = R.cur === STEPS.length - 1, t = R.cur < 0 ? (!R.seen ? '새 수요가 뽑혔어요. 다음 할 일: 아래 단계 목록에서 깜박이는 “1-1 기기 호출”을 눌러 시작하세요.' : '다음 할 일: 단계 목록에서 “' + STEPS[R.reached].id + ' ' + STEPS[R.reached].title + '”을 눌러 이어 가세요. 이미 연 단계는 다시 볼 수 있어요.')
    : last ? '끝까지 봤어요. 다음 할 일: “새 수요 뽑기”를 눌러 다른 수요로 다시 해 보세요.' : '다음 할 일: 아래에서 천천히 깜박이는 “' + STEPS[R.cur + 1].id + ' ' + STEPS[R.cur + 1].title + '” 단계를 눌러 한 단계씩 따라가세요.';
  return h('div', { class:'note info hintbn', id:'trf-next-hint', role:'status', text:t });
}
function summaryCard() {
  var sc = S.sim.sc;
  return h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'무작위 가상 수요' }), h('div', { class:'rowf' }, [pill(sc.devName, 'm'), pill(sc.inc.kind, 'p'), pill(sc.inc.name), pill(sc.placeName)]),
    h('div', { class:'sub', id:'trf-draw-sum', text:'기기·일행·승차 지점·목적지를 무작위로 뽑았어요. 아래 목록에서 단계를 누르면 그 단계 바로 아래에 결과가 펼쳐져요. 처음부터 저절로 보려면 오른쪽 위의 시뮬레이션 버튼을 누르세요.' }),
    h('div', { class:'rowf' }, [h('button', { type:'button', class:'btn tonal' + (S.sim.picked ? '' : ' blink'), id:'trf-draw', text:'새 수요 뽑기', onclick:function () { S.sim = newRun(); S.sim.picked = true; S.wasOpen = false; render(); } }), btn('교통 AI에게 묻기', 'quiet', function () { ask('어떤 차량을 보낼지 어떻게 정하나요?'); })]), nextHint()]);
}
function stepList() {
  var R = S.sim, out = h('div', { id:'trf-list', class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'단계 목록 (' + STEPS.length + '단계)' }), h('div', { class:'sub', text:'앞 단계를 연 뒤에 다음 단계를 열 수 있어요. 이미 연 단계는 언제든 다시 볼 수 있습니다.' })]);
  STAGES.forEach(function (name, si) {
    out.appendChild(h('div', { class:'lab', text:(si + 1) + '. ' + name }));
    STEPS.forEach(function (s, i) { if (s.st !== si) return;
      var state = i === R.cur ? '보는 중' : i < R.reached ? '완료' : i === R.reached ? '열기' : '잠김', hintRow = R.picked && R.cur < 0 && !R.seen && i === 0;
      out.appendChild(h('button', { type:'button', class:'srow' + (i === R.cur ? ' cur' : '') + (hintRow ? ' blink' : '') + (R.cur >= 0 && i === R.cur + 1 ? ' blink slow' : ''), id:'trf-row-' + s.id, 'data-i':String(i), disabled:i > R.reached ? true : null, 'aria-current':i === R.cur ? 'step' : null, onclick:function () { pickStep(R, i); } },
        [h('span', { class:'sid', text:s.id }), h('span', { class:'stx' }, [h('b', { text:s.title }), h('span', { text:s.desc })]), h('span', { class:'sst', text:state })]));
      if (i === R.cur) { var ip = inlinePanel(); if (ip) out.appendChild(ip); } });
  });
  return out;
}
/** 단계 아래로 펼쳐지는 페이지 안 패널. 오른쪽 시뮬레이션 패널(#trf-apanel)과는 서로 아무 관계가 없다. */
function inlinePanel() {
  var R = S.sim; if (R.cur < 0) return null;
  var st = STEPS[R.cur], c = ctx(R, render), last = R.cur === STEPS.length - 1, pb0 = $('trf-pbody'), ps = pb0 ? pb0.scrollTop : 0, fresh = !S.wasOpen || S.lastOpen !== R.cur;
  S.wasOpen = true; S.lastOpen = R.cur; PF = 'trf-';
  var body = h('div', { class:'pbody col', id:'trf-pbody' }, st.fn(c).filter(Boolean));
  var pn = h('div', { id:'trf-ipanel', class:'ipanel' + (fresh ? ' anim' : ''), role:'region', 'aria-label':st.id + ' ' + st.title + ' 결과' }, [
    h('div', { class:'phead' }, [h('div', { style:'flex:1;min-width:0' }, [h('div', { class:'sub', id:'trf-ph-n', text:'직접 따라가기 · 단계 ' + (R.cur + 1) + ' / ' + STEPS.length + ' · ' + STAGES[st.st] }), h('b', { id:'trf-ph-t', text:st.id + ' ' + st.title })]), h('button', { type:'button', class:'btn quiet sm', id:'trf-pclose', text:'닫기', onclick:function () { closeStep(R); } })]),
    body,
    h('div', { class:'pfoot' }, [h('button', { type:'button', class:'btn quiet', id:'trf-prev', text:'◀ 이전', disabled:R.cur === 0 ? true : null, onclick:function () { pickStep(R, R.cur - 1); } }),
      last ? h('button', { type:'button', class:'btn fill', id:'trf-again', text:'새 수요로 다시', onclick:function () { S.sim = newRun(); S.wasOpen = false; render(); try { window.scrollTo(0, 0); } catch (x) {} } }) : null])]);
  body.scrollTop = ps; return pn;
}
// ── 부드러운 전환: 눌린 단계를 진행 막대 바로 아래로 올리고, 새 패널은 높이가 늘어나며 아래 단계를 밀어 내린다 ──
var MOVE_MS = 350;
function calm() { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
function noIds(el) { el.removeAttribute('id'); [].forEach.call(el.querySelectorAll('[id]'), function (x) { x.removeAttribute('id'); }); el.setAttribute('aria-hidden', 'true'); el.classList.remove('anim'); }
/** 지금 열린 패널을 본떠 두었다가, 다시 그린 뒤 같은 자리에서 접히게 한다. */
function ghostOf() { var old = $('trf-ipanel'), R = S.sim; if (!old || R.cur < 0) return null; return { el:old.cloneNode(true), h:old.offsetHeight, rowId:'trf-row-' + STEPS[R.cur].id }; }
function settle(mv) {
  var np = $('trf-ipanel'), row = mv.rowId ? $(mv.rowId) : null, bw = M && M.querySelector('.barwrap'), ok = !calm();
  var ty = null; try { if (row && bw) ty = row.getBoundingClientRect().top + (window.pageYOffset || 0) - bw.getBoundingClientRect().bottom - 8; } catch (e) {}
  if (ok && np && np.classList.contains('anim')) { var hh = np.scrollHeight; np.style.overflow = 'hidden'; np.style.height = '0px'; void np.offsetHeight; np.style.transition = 'height ' + MOVE_MS + 'ms cubic-bezier(.2,0,0,1)'; np.style.height = hh + 'px'; setTimeout(function () { np.style.height = ''; np.style.transition = ''; np.style.overflow = ''; }, MOVE_MS + 60); }
  var g = mv.ghost, orow = g ? $(g.rowId) : null;
  if (ok && g && orow && g.h > 0) { noIds(g.el); g.el.style.overflow = 'hidden'; g.el.style.height = g.h + 'px'; orow.parentNode.insertBefore(g.el, orow.nextSibling); void g.el.offsetHeight; g.el.style.transition = 'height ' + MOVE_MS + 'ms cubic-bezier(.2,0,0,1)'; g.el.style.height = '0px'; setTimeout(function () { if (g.el.parentNode) g.el.parentNode.removeChild(g.el); }, MOVE_MS + 60); }
  if (ty !== null && np) { try { window.scrollTo({ top:Math.max(0, ty), behavior:ok ? 'smooth' : 'auto' }); } catch (e) {} }
}
/** 같은 단계를 다시 누르면 접고, 다른 단계를 누르면 그 단계 아래로 옮겨 연다. */
function pickStep(R, i) {
  if (i < 0 || i >= STEPS.length || i > R.reached) return;
  var g = ghostOf(); S.move = { ghost:g };
  if (i === R.cur) { R.cur = -1; S.wasOpen = false; render(); return; }
  S.move.rowId = 'trf-row-' + STEPS[i].id; openStep(R, i, render);
}
function closeStep(R) { S.move = { ghost:ghostOf() }; R.cur = -1; S.wasOpen = false; render(); }

// ── 자동 시뮬레이션(오른쪽 위 버튼): 자기만의 사건과 진행 상태를 쓰므로 화면의 단계 목록과 섞이지 않는다 ──
var HOLD = { '2-4':7500, '2-5':7500, '2-6':6500, '3-1':7000, '3-4':7000, '3-5':8000, '4-4':0 };
function holdMs(id) { return HOLD[id] === undefined ? 5500 : HOLD[id]; }
function openAuto() {
  if (S.auto) return;
  var R = newRun(); shake(R); R.cur = 0; S.auto = { R:R, playing:true, closing:false, shown:false, top:true, timer:null, ev:null };
  setSimBtn(); renderAuto(); autoSchedule();
}
function autoClear() { var a = S.auto; if (a) { clearTimeout(a.timer); clearTimeout(a.ev); a.timer = null; a.ev = null; } }
function autoSchedule() {
  var a = S.auto; if (!a || a.closing) return; clearTimeout(a.timer); a.timer = null; if (!a.playing) return;
  var ms = holdMs(STEPS[a.R.cur].id); if (!ms) { a.playing = false; renderAuto(); return; }
  a.timer = setTimeout(function () { if (S.auto === a && !a.closing && a.playing) autoStep(); }, ms);
}
function autoStep() {
  var a = S.auto, R = a.R, i = R.cur + 1; if (i >= STEPS.length) return;
  var id = STEPS[i].id, p = null; R.reached = Math.max(R.reached, i);
  if (i >= PLAN_AT) lock(R); p = R.plan0 && R.plan0.go;
  if (p && id === '3-2') R.t = Math.max(1, Math.round(p.pickupAt * 0.5)); else if (p && id === '3-3') R.t = p.pickupAt + 1; else if (p && id === '3-4') R.t = Math.round((p.pickupAt + p.arrive) / 2);
  R.cur = i; a.top = true; renderAuto();
  if (id === '3-5' && R.plan0 && R.plan0.go && Math.random() < 0.6) a.ev = setTimeout(function () { if (S.auto === a && !a.closing && R.cur === i) triggerEvent(R, renderAuto); }, 2200);
  autoSchedule();
}
function autoToggle() { var a = S.auto; if (!a) return; a.playing = !a.playing; renderAuto(); autoSchedule(); }
function autoRestart() { var a = S.auto; if (!a) return; autoClear(); var R = newRun(); shake(R); R.cur = 0; a.R = R; a.playing = true; a.top = true; renderAuto(); autoSchedule(); }
function closeAuto() {
  var a = S.auto; if (!a || a.closing) return; autoClear(); a.closing = true; a.playing = false; renderAuto();
  setTimeout(function () { if (S.auto !== a) return; S.auto = null; renderAuto(); setSimBtn(); }, 240);
}
function renderAuto() {
  var pn = $('trf-apanel'), bk = $('trf-back'), a = S.auto; if (!pn || !bk) return;
  if (!a) { pn.textContent = ''; pn.className = 'panel auto'; pn.setAttribute('aria-hidden', 'true'); bk.className = 'back'; return; }
  var R = a.R, st = STEPS[R.cur], c = ctx(R, renderAuto), last = R.cur === STEPS.length - 1, done = last && !a.playing, pb0 = $('trf-au-body'), ps = a.top || !pb0 ? 0 : pb0.scrollTop;
  pn.textContent = ''; pn.className = 'panel auto open' + (a.closing ? ' closing' : !a.shown ? ' anim' : ''); pn.setAttribute('aria-hidden', 'false'); bk.className = 'back' + (a.closing ? '' : ' on'); a.shown = true; a.top = false;
  pn.appendChild(h('div', { class:'phead' }, [h('div', { style:'flex:1;min-width:0' }, [h('div', { class:'sub', id:'trf-au-n', text:'시뮬레이션 · 단계 ' + (R.cur + 1) + ' / ' + STEPS.length + ' · ' + STAGES[st.st] + (a.playing ? ' · 자동 진행 중' : done ? ' · 끝' : ' · 멈춤') }), h('b', { id:'trf-au-t', style:'font-size:17px', text:st.id + ' ' + st.title })]), h('button', { type:'button', class:'btn quiet sm', id:'trf-au-close', text:'닫기', onclick:closeAuto })]));
  var mini = h('div', { class:'mini', id:'trf-au-mini', 'aria-hidden':'true' }); STEPS.forEach(function (s, i) { mini.appendChild(h('i', { class:(i < R.cur ? 'done' : i === R.cur ? 'cur' : '') + (i > 0 && STEPS[i - 1].st !== s.st ? ' gap' : '') })); });
  pn.appendChild(mini);
  PF = 'trf-au-'; var kidsA; try { kidsA = st.fn(c).filter(Boolean); } finally { PF = 'trf-'; }
  var body = h('div', { class:'pbody col', id:'trf-au-body' }, kidsA); pn.appendChild(body);
  pn.appendChild(h('div', { class:'pfoot' }, [h('button', { type:'button', class:'btn quiet', id:'trf-au-pause', text:a.playing ? '⏸ 멈추기' : last ? '끝났어요' : '▶ 이어서', disabled:last && !a.playing ? true : null, onclick:autoToggle }), h('button', { type:'button', class:'btn fill', id:'trf-au-restart', text:'↻ 새 무작위 수요', onclick:autoRestart })]));
  body.scrollTop = ps;
}
function render() {
  var root = $('trf-root'), tp = $('trf-top'); if (!root || !tp) return;
  var y = 0; try { y = window.pageYOffset || 0; } catch (e) {}
  root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = head('교통', '도시 어디서든 폰·나비웹 워치·링(팔찌)의 조작 한 번으로 부르면, 교통 AI가 모든 자율주행차량의 위치·경로·배터리를 보고 가장 빨리 태울 차량을 보내 목적지까지 데려다 줍니다. 무작위 가상 수요 하나를 호출부터 하차·정산까지 단계별로 따라가 보세요.');
  kids.push(mockNote('모의 체험입니다. 아무것도 전송·호출되지 않고 차량도 움직이지 않아요. 시민·차량·경로·시간·요금은 모두 가상 값이며, 속도·배터리 소모·요금은 가정입니다.'));
  kids.push(progressBar(), prepSection(), summaryCard(), stepList());
  kids.forEach(function (k) { if (k) root.appendChild(k); });
  if (y) { try { window.scrollTo(0, y); } catch (e) {} }
  var mv = S.move; S.move = null; if (mv) settle(mv);
}
function reply(ok, msg) { emit('result', { ok:ok, msg:msg }); }
function go(v) {
  var a = ANCH[v]; if (!a) return false;
  if (a === 'trf-s-prep') S.prepOpen = true;
  render(); var e = $(a) || $('trf-s-call'); try { if (e) e.scrollIntoView({ block:'start' }); } catch (x) {}
  return true;
}
function nav(a) {
  var d = a && typeof a['do'] === 'string' ? a['do'] : '';
  if (go(d)) return reply(true, d === 'prep' || d === 'devices' || d === 'consent' ? '평소 준비 구역으로 이동했습니다.' : d === 'call' ? '수요 정하기 구역으로 이동했습니다.' : '흐름 구역으로 이동했습니다.');
  return reply(false, '지원하지 않는 요청입니다.');
}
function mount(el, o) {
  if (!el) return; o = o || {};
  autoClear(); S.auto = null; M = el; el.textContent = ''; el.classList.add('trf'); S.share = {}; S.askok = {}; S.dev = []; S.err = {}; S.msg = ''; S.prepOpen = false; S.sim = newRun(); S.wasOpen = false; load();
  [h('div', { id:'trf-top' }), h('div', { class:'wrap', id:'trf-root' }), h('div', { id:'trf-back', class:'back', onclick:closeAuto }), h('aside', { id:'trf-apanel', class:'panel auto', 'aria-hidden':'true', 'aria-label':'시뮬레이션' })].forEach(function (x) { el.appendChild(x); });
  if (o.view && ANCH[o.view] && o.view !== 'call') go(o.view); else render();
}
window.NaviTraffic = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M) go(v); },
  callMessage:callMessage, draw:draw, verify:verify, gather:gather, match:match, newFleet:newFleet, stateAt:stateAt, fleetAt:fleetAt, detourGo:detourGo, rebalance:rebalance, planText:planText, devSummary:devSummary, sharedItems:sharedItems,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();

