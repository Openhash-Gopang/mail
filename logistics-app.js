/* logistics-app.js — 나비웹 물류(인프라 AI · 물류). desktop.html 안에 직접 그려 넣는다(iframe 없음).
* 사용: NaviLogistics.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result'|'agent', 함수) · .agentResult(ok, msg)
* 모양은 logistics.css(.lgs 범위). 전역은 NaviLogistics 하나만 쓴다.
*
* 응급·치안·의료·교통 페이지와 같은 레이아웃(2026-11-25): 한 페이지, 탭 없음. 평소 준비(기기·내 PDV에서 꺼낼 정보) 아래에서 무작위 가상 물류 수요 하나를
*   4단계·19개 세부 단계(1-1~4-4)로 따라간다. 위치는 상단 진행 막대, 차례는 단계 목록, 결과는 눌린 단계 바로 아래로 펼쳐지는 패널.
*   앞 단계를 연 뒤에만 다음 단계를 열 수 있고, 열린 단계 바로 다음 단계의 막대가 천천히 깜박인다.
*   3-1(지시서 발송)을 열면 배차 계획과 그때의 차량 현황이 굳고, 3-5 에서 배정 차량이 멈추거나 길이 막히면 그 시각의 현황으로 다시 정한다.
*   오른쪽 위 시뮬레이션 버튼은 별도의 무작위 수요를 1-1부터 자동으로 보여 주며, 화면의 단계 목록과 상태를 공유하지 않는다.
*   택배·수입 화물 조회는 나비웹 도우미에게 맡기는 카드(평소 준비 구역)로 남아 있다. 로그인은 사용자가 하고 도우미는 조회까지만 한다.
*
* 물류 화면의 설계 원칙(주피터 지시, 2026-11-25 — 교통과 같은 원리, 사람 대신 물품):
* 1. 도시 안 임의의 지점에서 한 건 이상의 물류 수요가 생긴다 → 물품의 부피·종류(일반·냉장·대형)·수령지가 수요마다 다르다. 발송인의 나만의 AI 비서가 PDV 에서 일정·물품 정보를
*    꺼내 익명화해(이름·주민번호·정확한 주소는 빼고) 물류 AI 에 보낸다. 말·문자가 어려우면 '물류'만 가고 수령지는 PDV 일정이 대신 말한다.
* 2. 물류 AI 는 모든 자율주행 화물차의 현재 위치·속도·경로(하역지)·배터리·싣고 있는 물품을 실시간으로 받아 갱신한다(차량은 도로 위 주행 안내선을 따르고 서버가 모든 위치를 파악·통제한다).
* 3. 배차: 차량마다 '지금 하던 일을 마치는 때와 곳'(유휴=지금 그 자리, 운송 중=싣고 가는 물품을 내려 준 뒤 그 하역지, 충전 중=충전을 마친 뒤)에서 집하 지점까지의 시간으로 센다.
*    점검 중·냉장 장치 없음·대형 못 실음·하역 뒤 충전소까지 갈 배터리 부족인 차량은 뺀다. 후보는 ① 한 대 전용 ② 두 대로 나눔(대형은 안 나눔) ③ 합차(이미 물품을 싣고 가는 차량의 남는 자리).
*    비용 = 새 물품이 수령지에 닿는 시각 + 합차로 늦어지는 기존 물품의 지연 + 새로 달리는 거리 × KMW(가정). 합차는 빈 차로 달리는 거리를 줄여 총비용을 낮춘다.
*    쓸 수 있는 차량이 없으면 가장 빨리 충전을 마치고 오는 차량으로 안내한다(냉장·대형 조건은 그대로).
* 4. 경로 계산은 도로(격자)를 따라 하고, 도로 관제가 차량별로 주행 안내선 구간을 예약해 서로 겹치거나 막히지 않게 한다.
* 5. 운송 중에도 계속 갱신한다: 위치·속도·배터리·적재량. 배정 차량이 멈추면 그 물량만 다시 배차하고, 길이 막히면 모든 차량이 돌아간다. 하역 뒤에는 운임 정산·차량 상태 갱신·충전 또는 재배치.
*
* 무엇이 실제이고 무엇이 아닌가(화면에도 한 줄로 적는다):
* - 위 원칙은 설계 단계이고 이 화면은 모의 체험이다. 차량·도로 관제·결제에 연결되어 있지 않고 어떤 것도 전송·호출·제어하지 않는다.
* - 도시·차량·물품·경로·속도·배터리·운임은 모두 가상 값이며 메모리 안에서만 계산한다(저장하지 않는다). 속도·배터리 소모·충전 속도·운임·합차 한도는 가정이다.
* - 내 기기·꺼낼 정보는 사용자가 직접 정하는 기록이고 이 브라우저(localStorage)에만 저장된다(설계에서는 PDV 에 보관).
* - 합차 차량의 고장 처리, 냉장 온도 관리, 수입 통관 같은 세부는 이 화면에서 다루지 않는다(나중에 예외·확장 프로세스로 따로 만든다).
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
var KEY = 'navi-lgs-v2', MAXD = 20;
var DEVICES = [['phone', '폰'], ['watch', '나비웹 워치'], ['ring', '링(팔찌)']];
var DEVKINDS = DEVICES.map(function (d) { return d[1]; });
/** 내 비서가 내 PDV 에서 꺼내 익명화해 물류 AI 에 보내는 정보. 집하 지점(위치)은 항상 포함하고, 나머지는 항목마다 직접 정한다. 이름·주민번호·정확한 주소는 어떤 경우에도 보내지 않는다. */
var SEND = [['loc', '현재 위치(집하 지점)'], ['sched', '오늘 일정·보낼 곳'], ['goods', '물품의 개수와 크기'], ['handle', '취급 조건(냉장·대형·깨지기 쉬움)'], ['pref', '받는 방식(문 앞·대면 등)']];
/** 물류 AI 가 내 비서에게 추가로 물을 수 있는 것(예시). 항목마다 답해도 되는지 직접 정한다. */
var ASKS = [['when', '언제까지 도착해야 하는지'], ['pack', '포장 상태와 무게']];
var CALLS = [['voice', '말할 수 있음'], ['text', '문자를 입력할 수 있음'], ['none', '둘 다 어려움']];
var ANCH = { call:'lg-list', flow:'lg-list', follow:'lg-list', match:'lg-list', principle:'lg-list', pack:'lg-list', route:'lg-list', prep:'lg-s-prep', devices:'lg-s-prep', consent:'lg-s-prep', parcels:'lg-s-prep' };
var M = null, LS = {};
var S = { share:{}, askok:{}, dev:[], form:{ kind:'폰', carry:true }, err:{}, msg:'', prepOpen:false, sim:null, wasOpen:false, lastOpen:-1, move:null, auto:null, ag:'', agMsg:'' };

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
function mockNote(t) { return h('div', { class:'note info', id:'lg-mock', style:'margin:16px 0', text:t }); }

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

/** 물류 호출 메시지: 말할 수 있으면 음성, 문자를 입력할 수 있으면 문자를 함께 보내고, 그 밖에는 오직 '물류'만 보낸다(보낼 곳은 PDV 일정·물품 메모가 대신 말한다). */
function callMessage(can, said) {
  var t = clean(said, 120);
  if (can === 'voice') return { mode:'voice', label:'음성 + 물류', body:t || '(말한 내용이 음성으로 전달됩니다)', flag:'물류', only:false };
  if (can === 'text') return { mode:'text', label:'문자 + 물류', body:t || '(입력한 문자가 전달됩니다)', flag:'물류', only:false };
  return { mode:'none', label:'물류', body:'', flag:'물류', only:true };
}
function sharedItems(share) { return SEND.filter(function (f) { return f[0] === 'loc' || share[f[0]]; }).map(function (f) { return f[1]; }); }
function askItems(askok) { return ASKS.filter(function (f) { return askok[f[0]]; }).map(function (f) { return f[1]; }); }
function devSummary(list, today) {
  var t0 = today ? Date.parse(today + 'T00:00:00Z') : NaN, due = 0, carry = 0, by = {};
  list.forEach(function (x) { by[x.kind] = (by[x.kind] || 0) + 1; if (x.carry) carry++; if (x.chk && isFinite(t0) && Date.parse(x.chk + 'T00:00:00Z') <= t0) due++; });
  return { count:list.length, carry:carry, by:by, due:due };
}

// ── 도시·화물 차량(가상 값) ──
var GRID = 14;                     // 14km × 14km 격자 도시(가정). 도로는 격자이고 거리는 도로를 따라 센다.
var MINKM = 1.25, BATKM = 0.7;     // 1km 에 1.25분(시속 48km, 가정) · 1km 에 배터리 0.7%(가정, 화물 차량은 더 무거워요)
var RESERVE = 15;                  // 하역 뒤 가장 가까운 충전소까지 가고도 남아야 하는 배터리(%)
var LOAD = 2, UNLOAD = 1;          // 적재 2분 · 하역 1분(가정)
var KMW = 0.5;                     // 차량이 1km 더 달리는 사회적 비용을 0.5분의 시간으로 셈(가정) — 합차가 빈 차 운행을 줄이는 효과를 비용에 넣는 값
var POOL_KM = 3, DELAY_OK = 10;    // 합차: 이미 싣고 가는 물품의 하역지와 새 수령지가 3km 안이고, 기존 물품이 늦어지는 시간이 10분 이하일 때만(가정)
var CHG_RATE = 1, CHG_TO = 80;     // 충전은 1분에 1%, 80% 까지(가정)
var BASEFARE = 1500, PERKM = 400, PERVOL = 100;   // 가상 운임(GDC): 기본 + 거리당 + 부피당(가정, 실제 운임 아님)
var CHARGERS = [['c1', '가상 충전소 1', 3, 3], ['c2', '가상 충전소 2', 10, 12], ['c3', '가상 충전소 3', 12, 4]];
var SPOTS = [['센터', '가상 물류센터', 7, 7], ['주택단지', '가상 주택단지', 11, 9], ['식당가', '가상 식당가', 7, 2], ['병원', '가상 종합병원', 5, 11], ['공장', '가상 공장', 13, 12], ['시장', '가상 시장', 8, 8], ['업무지구', '가상 업무지구', 12, 3], ['항구', '가상 항구', 1, 12]];
var TYPES = { small:{ name:'소형 밴', cap:8, cold:false, big:false }, truck:{ name:'트럭', cap:24, cold:false, big:true }, cold:{ name:'냉장 탑차', cap:12, cold:true, big:false } };
var VEH = [['L1', 'small'], ['L2', 'small'], ['L3', 'truck'], ['L4', 'cold'], ['L5', 'small'], ['L6', 'truck'], ['L7', 'cold'], ['L8', 'small']];
var KINDS = { normal:'일반', cold:'냉장', large:'대형' };
function dist(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); }
function mins(km) { return Math.max(1, Math.round(km * MINKM)); }
function ri(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
function pth(a, b) { return [a, [b[0], a[1]], b]; }                       // 도로를 따라 가로 먼저, 세로 나중
function along(p, d) { var i, L; for (i = 0; i < p.length - 1; i++) { L = dist(p[i], p[i + 1]); if (d <= L || i === p.length - 2) { var f = L ? Math.min(1, d / L) : 1; return [p[i][0] + (p[i + 1][0] - p[i][0]) * f, p[i][1] + (p[i + 1][1] - p[i][1]) * f]; } d -= L; } return p[p.length - 1]; }
function nearestChg(p) { var b = null; CHARGERS.forEach(function (c) { var d = dist(p, [c[2], c[3]]); if (!b || d < b.km) b = { id:c[0], name:c[1], xy:[c[2], c[3]], km:d }; }); return b; }
function spot(k) { return SPOTS.filter(function (s) { return s[0] === k; })[0]; }
/** 차량 한 대: { id, name, type, x, y, bat(%), state:'idle'|'busy'|'charge'|'down', spd(km/h), job:{ to, vol, kind }|null, chgLeft(분) } — 물류 AI 는 모든 차량의 이 값(위치·속도·경로·배터리·싣고 있는 물품)을 실시간으로 받는다. */
function newFleet(rng) {
  var r = typeof rng === 'function' ? rng : Math.random;
  return VEH.map(function (d) {
    var T = TYPES[d[1]], v = { id:d[0], name:'자율주행 화물차 ' + d[0], type:d[1], x:ri(r, 0, GRID), y:ri(r, 0, GRID), bat:ri(r, 20, 95), state:'idle', spd:0, job:null, chgLeft:0 }, q = r();
    if (q < 0.4) { var to; do { to = [ri(r, 0, GRID), ri(r, 0, GRID)]; } while (dist([v.x, v.y], to) < 3); v.state = 'busy'; v.job = { to:to, vol:ri(r, 1, T.cap), kind:T.cold && r() < 0.8 ? 'cold' : T.big && r() < 0.3 ? 'large' : 'normal' }; v.spd = ri(r, 36, 46); v.bat = Math.max(v.bat, 18 + Math.ceil(BATKM * dist([v.x, v.y], to))); }
    else if (q < 0.5) { var c = CHARGERS[ri(r, 0, CHARGERS.length - 1)]; v.state = 'charge'; v.x = c[2]; v.y = c[3]; v.bat = ri(r, 12, 60); v.chgLeft = Math.ceil((CHG_TO - v.bat) / CHG_RATE); }
    else if (q < 0.57) v.bat = ri(r, 12, 24);
    return v;
  });
}
function jobOf(j) { return j ? { to:j.to, vol:j.vol, kind:j.kind } : null; }
/** t 분 뒤의 차량 상태(계획 없이 하던 일만 이어 갈 때). busy 는 하역지에 닿으면 그 자리에 idle(짐은 내려요), charge 는 다 차면 idle. */
function stateAt(v, t) {
  var o = { id:v.id, name:v.name, type:v.type, x:v.x, y:v.y, bat:v.bat, state:v.state, spd:v.spd, job:jobOf(v.job), chgLeft:v.chgLeft };
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
/** 이 차량이 새 일을 맡을 수 있게 되는 때와 곳: idle 이면 지금 그 자리, busy 면 지금 싣고 가는 물품을 내려 준 뒤 그 하역지, charge 면 충전을 마친 뒤. */
function avail(v) {
  if (v.state === 'idle') return { t:0, pos:[v.x, v.y], bat:v.bat };
  if (v.state === 'busy') { var km = dist([v.x, v.y], v.job.to); return { t:mins(km), pos:v.job.to, bat:v.bat - BATKM * km }; }
  if (v.state === 'charge') return { t:v.chgLeft, pos:[v.x, v.y], bat:Math.max(v.bat, CHG_TO) };
  return null;
}
/** 한 대가 전용으로 맡는 구간별 일정(phases). 시각은 호출부터 센 절대 분. */
function legPhases(c, tp, vol, shift, chg) {
  var ph = [], t = c.a.t + shift, pos = c.a.pos, bat = c.a.bat, P = tp.P, D = tp.D, tripKm = dist(P, D), tm = mins(tripKm), eta, e;
  if (t > 0) ph.push({ k:'pre', t0:0, t1:t });
  if (chg) {
    var km1 = dist(pos, chg.xy), m1 = mins(km1); ph.push({ k:'move', st:'충전소로 이동', t0:t, t1:t + m1, from:pos, to:chg.xy, bat0:bat, km:km1, cg:0 }); t += m1; bat -= BATKM * km1; pos = chg.xy;
    var need = Math.max(0, Math.ceil((CHG_TO - bat) / CHG_RATE)); if (need) { ph.push({ k:'charge', st:'충전 중', t0:t, t1:t + need, at:pos, bat0:bat, cg:0 }); t += need; bat = Math.min(CHG_TO, bat + need * CHG_RATE); }
  }
  var km2 = dist(pos, P), m2 = mins(km2); ph.push({ k:'move', st:'집하 지점으로 이동', t0:t, t1:t + m2, from:pos, to:P, bat0:bat, km:km2, cg:0 }); t += m2; bat -= BATKM * km2; eta = t;
  ph.push({ k:'load', st:'적재·집하 확인', t0:t, t1:t + LOAD, at:P, bat0:bat, cg0:0, cg1:vol }); t += LOAD;
  ph.push({ k:'trip', st:'수령지로 운송', t0:t, t1:t + tm, from:P, to:D, bat0:bat, km:tripKm, cg:vol }); e = t + tm;
  return { ph:ph, eta:eta, batPick:bat, batEnd:bat - BATKM * tripKm, arrive:e, tripMin:tm };
}
/** 합차: 이미 물품을 싣고 가는 차량이 집하 지점을 들러 새 물품을 싣고, 원래 하역지에 기존 물품을 내린 뒤 새 수령지로 간다(새 수령지가 기존 하역지 가까이일 때). */
function poolPhases(v, tp, vol, shift) {
  var ph = [], pos = [v.x, v.y], P = tp.P, D = tp.D, Dv = v.job.to, ex = v.job.vol, bat = v.bat, t = shift, km1 = dist(pos, P), m1 = mins(km1), km2 = dist(P, Dv), m2 = mins(km2), km3 = dist(Dv, D), m3 = mins(km3);
  if (shift > 0) ph.push({ k:'pre', t0:0, t1:shift });
  ph.push({ k:'move', st:'집하 지점으로 이동(기존 물품을 싣고)', t0:t, t1:t + m1, from:pos, to:P, bat0:bat, km:km1, cg:ex }); t += m1; bat -= BATKM * km1; var eta = t;
  ph.push({ k:'load', st:'적재·집하 확인(합차)', t0:t, t1:t + LOAD, at:P, bat0:bat, cg0:ex, cg1:ex + vol }); t += LOAD;
  ph.push({ k:'trip', st:'기존 물품 하역지로 운송', t0:t, t1:t + m2, from:P, to:Dv, bat0:bat, km:km2, cg:ex + vol }); t += m2; bat -= BATKM * km2; var exArr = t;
  ph.push({ k:'drop', st:'기존 물품 하역', t0:t, t1:t + UNLOAD, at:Dv, bat0:bat, cg0:ex + vol, cg1:vol }); t += UNLOAD;
  ph.push({ k:'trip', st:'수령지로 운송', t0:t, t1:t + m3, from:Dv, to:D, bat0:bat, km:km3, cg:vol }); t += m3; bat -= BATKM * km3;
  return { ph:ph, eta:eta, batEnd:bat, arrive:t, exArr:exArr, extraKm:km1 + km2 + km3 - dist(pos, Dv), tripMin:m2 + UNLOAD + m3 };
}
function mkLeg(c, vol, tp, shift, chg) {
  var L = legPhases(c, tp, vol, shift, chg);
  return { v:{ id:c.v.id, name:c.v.name, type:c.v.type, tname:TYPES[c.v.type].name }, vol:vol, pooled:false, was:c.v.state, from:[c.v.x, c.v.y], tFree:c.a.t + shift, pre:c.a, eta:L.eta, kmPick:dist(c.a.pos, tp.P), batPick:L.batPick, batEnd:L.batEnd, tripMin:L.tripMin, arrive:L.arrive, chg:chg ? { name:chg.name, xy:chg.xy, km:chg.km } : null, detour:0, ph:L.ph };
}
function mkPool(v, vol, tp, shift, L) {
  return { v:{ id:v.id, name:v.name, type:v.type, tname:TYPES[v.type].name }, vol:vol, pooled:true, was:'busy', from:[v.x, v.y], tFree:shift, pre:{ t:0, pos:[v.x, v.y], bat:v.bat }, eta:L.eta, kmPick:dist([v.x, v.y], tp.P), batPick:v.bat - BATKM * dist([v.x, v.y], tp.P), batEnd:L.batEnd, tripMin:L.tripMin, arrive:L.arrive, chg:null, detour:0, ph:L.ph, exist:{ vol:v.job.vol, kind:v.job.kind, to:v.job.to, arrive0:shift + mins(dist([v.x, v.y], v.job.to)), arrive1:L.exArr } };
}
function shapeOf(legs) { return { legs:legs, kind:legs.length > 1 ? 'split' : legs[0].pooled ? 'pool' : legs[0].chg ? 'charge' : 'single', pickupAt:Math.max.apply(null, legs.map(function (l) { return l.eta; })), arrive:Math.max.apply(null, legs.map(function (l) { return l.arrive; })), vehicles:legs.length }; }
/** 한 물품 건을 맡을 차량(들)을 고른다. snap = 어느 시각의 전체 차량 상태, ex = 쓸 수 없는 차량 { id: 이유 }.
*  ① 차량마다: 점검 중·냉장 장치 없음·대형 못 실음·하역 뒤 충전소까지 갈 배터리 부족이면 빠진다. 나머지는 '지금 하던 일을 마치는 때와 곳'(avail)에서 집하 지점까지의 시간으로 센다.
*  ② 후보: 전용 한 대(single, 부피가 들어갈 때) · 전용 두 대(split, 대형이 아닌 물품) · 합차(pool: 이미 물품을 싣고 가는 차량이 남는 자리에 새 물품을 싣는다).
*  ③ 비용 = 새 물품이 수령지에 닿는 시각 + 합차로 늦어지는 기존 물품의 지연 + KMW × 새로 달리는 거리. 합차는 거리를 아껴 비용이 낮아질 수 있어요. 비용이 같으면 도착 → 거리 → 번호 순.
*  ④ 쓸 수 있는 후보가 하나도 없으면 가장 빨리 충전을 마치고 오는 차량(charge)으로 안내한다. 냉장·대형 조건은 그대로다. */
function plan(tp, snap, ex, shift) {
  shift = shift || 0; var P = tp.P, D = tp.D, tripKm = dist(P, D), tail = BATKM * nearestChg(D).km, vol = tp.vol, why = [], cs = [], opts = [], best = null, fb = null;
  function hw(v) { var T = TYPES[v.type]; if (ex && ex[v.id]) return ex[v.id]; if (v.state === 'down') return '점검 중이라 운행할 수 없어요'; if (tp.kind === 'cold' && !T.cold) return '냉장 장치가 없어요'; if (tp.kind === 'large' && !T.big) return '대형 물품을 실을 수 없어요(트럭만 가능)'; return null; }
  snap.forEach(function (v) {
    var bad = hw(v), a, km, bp; if (bad) { why.push([v.name, bad]); return; }
    a = avail(v); km = dist(a.pos, P); bp = a.bat - BATKM * km;
    if (bp - BATKM * tripKm - tail >= RESERVE) cs.push({ v:v, T:TYPES[v.type], a:a, eta:a.t + mins(km), km:km });
    else if (!(v.state === 'busy')) why.push([v.name, '배터리가 모자라요(' + Math.round(a.bat) + '% — 하역하고 충전소까지 가려면 더 필요해요)']);
  });
  cs.forEach(function (c) { if (c.T.cap >= vol) { var lg = mkLeg(c, vol, tp, shift, null); opts.push({ legs:[lg], eta:lg.eta, arrive:lg.arrive, delay:0, km:c.km + tripKm }); } });
  if (vol >= 2 && tp.kind !== 'large') {
    cs.forEach(function (a, i) { cs.forEach(function (b, j) { if (j <= i) return;
      var r1 = Math.min(a.T.cap, vol - 1), r2 = vol - r1; if (r2 > b.T.cap) { r2 = b.T.cap; r1 = vol - r2; } if (r1 < 1 || r1 > a.T.cap || r2 < 1) return;
      var la = mkLeg(a, r1, tp, shift, null), lb = mkLeg(b, r2, tp, shift, null); opts.push({ legs:[la, lb], eta:Math.max(la.eta, lb.eta), arrive:Math.max(la.arrive, lb.arrive), delay:0, km:a.km + b.km + 2 * tripKm }); }); });
  }
  snap.forEach(function (v) {   // 합차
    if (hw(v) || v.state !== 'busy') return; var T = TYPES[v.type], Dv = v.job.to;
    if (T.cap - v.job.vol < vol || dist(Dv, D) > POOL_KM) return;
    var L = poolPhases(v, tp, vol, shift), delay = L.exArr - (shift + mins(dist([v.x, v.y], Dv)));
    if (delay > DELAY_OK) { why.push([v.name, '합차하면 이미 싣고 가는 물품이 ' + delay + '분 늦어져요(' + DELAY_OK + '분 넘게는 안 늦춰요)']); return; }
    if (L.batEnd - tail < RESERVE) { why.push([v.name, '합차하면 배터리가 모자라요']); return; }
    var lg = mkPool(v, vol, tp, shift, L); lg.exist.delay = delay; opts.push({ legs:[lg], eta:lg.eta, arrive:lg.arrive, delay:delay, km:L.extraKm });
  });
  opts.forEach(function (o) { o.cost = o.arrive + o.delay + KMW * o.km; o.shape = shapeOf(o.legs); });
  opts.sort(function (x, y) { return x.cost - y.cost || x.arrive - y.arrive || x.km - y.km || x.legs[0].v.id.localeCompare(y.legs[0].v.id); });
  best = opts[0] || null;
  if (!best) {
    snap.forEach(function (v) {
      if (hw(v) || TYPES[v.type].cap < vol) return;
      var a = avail(v), C = nearestChg(a.pos), km1 = C.km, bC = a.bat - BATKM * km1, need = Math.max(0, Math.ceil((CHG_TO - bC) / CHG_RATE)), bat1 = Math.min(CHG_TO, bC + need * CHG_RATE), km2 = dist(C.xy, P);
      if (bC < 0 || bat1 - BATKM * (km2 + tripKm) - tail < RESERVE) return;
      var arr = a.t + mins(km1) + need + mins(km2) + LOAD + mins(tripKm) + shift;
      if (!fb || arr < fb.arr || (arr === fb.arr && v.id < fb.v.id)) fb = { v:v, a:a, C:C, arr:arr };
    });
    if (fb) { var c = { v:fb.v, T:TYPES[fb.v.type], a:fb.a }, lg = mkLeg(c, vol, tp, shift, fb.C); fb = { legs:[lg], eta:lg.eta, arrive:lg.arrive, delay:0, km:lg.kmPick + tripKm, cost:lg.arrive, shape:shapeOf([lg]) }; }
  }
  return { tp:tp, options:opts, best:best, fb:fb, go:best ? best.shape : fb ? fb.shape : null, why:why, at:shift };
}
function match(tp, fleet, live) {
  if (!tp) return null;
  if (!live) return plan(tp, fleet, null, 0);
  /* 운송 중 '배정 차량 이상'(live.fault): 그 차량이 맡던 물량만 그 시각(live.at)의 전체 차량 상태로 다시 맞춘다. 이미 출발한 다른 차량은 그대로 간다. */
  var pg = live.prev.go, lost = pg.legs.filter(function (l) { return l.v.id === live.fault; })[0], kept = pg.legs.filter(function (l) { return l.v.id !== live.fault; }), ex = {}, snap;
  kept.forEach(function (l) { ex[l.v.id] = '이미 이 물품을 실으러 가는 중이에요'; }); ex[live.fault] = '이상이 생겨 멈췄어요(가상)';
  snap = fleet.map(function (v) { return stateAt(v, live.at); });
  var sub = { P:tp.P, D:tp.D, Dn:tp.Dn, vol:lost.vol, kind:tp.kind, n:tp.n }, r = plan(sub, snap, ex, live.at);
  if (!r.go) return { tp:tp, options:[], best:null, fb:null, go:null, why:r.why, at:live.at, lost:lost };
  r.go = shapeOf(kept.concat(r.go.legs)); r.tp = tp; r.lost = lost; r.kept = kept; return r;
}
/** 운송 중 '구간 통제': 가던 길의 한 구간이 막혀 한두 블록 돌아가야 한다(+2km 또는 +4km). 수령지로 가는 마지막 구간에 반영한다. */
function detourGo(go, at, extra) {
  var legs = go.legs.map(function (l) {
    var n = JSON.parse(JSON.stringify(l)), dm = mins(extra), trs = n.ph.filter(function (p) { return p.k === 'trip'; }), tr = trs[trs.length - 1], i = n.ph.indexOf(tr);
    if (at >= tr.t1) return n;
    if (at > tr.t0) { var f = (at - tr.t0) / (tr.t1 - tr.t0), pos = along(pth(tr.from, tr.to), tr.km * f), rem = dist(pos, tr.to), a1 = { k:'trip', st:'수령지로 운송', t0:tr.t0, t1:at, from:tr.from, to:tr.to, bat0:tr.bat0, km:tr.km * f, cg:tr.cg }, b1 = { k:'trip', st:'우회로로 운송', t0:at, t1:tr.t1 + dm, from:pos, to:tr.to, bat0:tr.bat0 - BATKM * tr.km * f, km:rem + extra, cg:tr.cg };
      n.ph.splice(i, 1, a1, b1); }
    else { tr.t1 += dm; tr.km += extra; tr.st = '우회로로 운송'; }
    n.arrive += dm; n.batEnd -= BATKM * extra; n.detour = extra; n.tripMin += dm; return n;
  });
  return shapeOf(legs);
}
function endT(g) { return g.arrive; }
function capOf(v) { return TYPES[v.type].cap; }
/** 배정된 차량(leg)의 t 분(호출부터 센 절대 시각) 상태. v0 = 계획 확정 때의 그 차량. */
function legAt(leg, v0, t) {
  var ph = leg.ph, i, p, f, pos;
  for (i = 0; i < ph.length; i++) { p = ph[i]; if (t >= p.t0 && t < p.t1) break; p = null; }
  if (!p) { var Lp = ph[ph.length - 1]; return { x:Lp.to[0], y:Lp.to[1], bat:leg.batEnd, spd:0, st:'하역 완료 · 대기', cg:0, to:null }; }
  if (p.k === 'pre') { var s = stateAt(v0, t); return { x:s.x, y:s.y, bat:s.bat, spd:s.spd, st:v0.state === 'charge' ? '충전 중(마친 뒤 이 물품을 맡아요)' : v0.state === 'busy' ? '지금 물품을 내려 주는 중' : '대기', cg:s.job ? s.job.vol : 0, to:s.job ? s.job.to : null }; }
  f = (t - p.t0) / (p.t1 - p.t0);
  if (p.k === 'move' || p.k === 'trip') { pos = along(pth(p.from, p.to), p.km * f); return { x:pos[0], y:pos[1], bat:p.bat0 - BATKM * p.km * f, spd:Math.round(p.km / ((p.t1 - p.t0) / 60)), st:p.st, cg:p.cg, to:p.to }; }
  if (p.k === 'charge') return { x:p.at[0], y:p.at[1], bat:Math.min(CHG_TO, p.bat0 + (t - p.t0) * CHG_RATE), spd:0, st:'충전 중', cg:0, to:null };
  return { x:p.at[0], y:p.at[1], bat:p.bat0, spd:0, st:p.st, cg:Math.round(p.cg0 + (p.cg1 - p.cg0) * f), to:null };
}
/** t 분 뒤 전체 차량 표. 배정된 차량은 계획(leg)대로, 나머지는 하던 일대로 움직인다. ev 가 있으면 이상으로 멈춘 차량도 반영한다. */
function fleetAt(fleet0, go, ev, t) {
  var by = {}; (go ? go.legs : []).forEach(function (l) { by[l.v.id] = l; });
  return fleet0.map(function (v0) {
    var l = by[v0.id], row;
    if (ev && ev.kind === 'fault' && ev.lost && ev.lost.v.id === v0.id) { var lt = Math.min(t, ev.at), x = legAt(ev.lost, v0, lt); row = t < ev.at ? x : { x:x.x, y:x.y, bat:x.bat, spd:0, st:'이상으로 정지(점검 호출)', cg:0, to:null }; row.mine = false; }
    else if (l) { row = legAt(l, v0, t); row.mine = true; }
    else { var s = stateAt(v0, t); row = { x:s.x, y:s.y, bat:s.bat, spd:s.state === 'busy' ? s.spd : 0, st:s.state === 'busy' ? '다른 물품 운송 중' : s.state === 'charge' ? '충전 중' : s.state === 'down' ? '점검 중' : '유휴', cg:s.job ? s.job.vol : 0, to:s.job ? s.job.to : null }; row.mine = false; }
    row.v = v0; return row;
  });
}
function planText(r) {
  var g = r.go, tp = r.tp, s = []; if (!g) return s;
  g.legs.forEach(function (l) {
    var lead;
    if (l.pooled) lead = l.v.name + '(' + l.v.tname + ')이 이미 싣고 가는 물품(' + l.exist.vol + ')을 그대로 두고 집하 지점에 들러 새 물품을 함께 실어요(합차). 기존 물품을 먼저 내리고(T+' + l.exist.arrive1 + '분, 원래보다 ' + l.exist.delay + '분 늦어요) 이어서 수령지로 가요.';
    else lead = l.chg ? l.v.name + '(' + l.v.tname + ')은 배터리가 낮아 먼저 ' + l.chg.name + '에서 충전한 뒤 집하 지점으로 가요.' : l.was === 'idle' ? l.v.name + '(' + l.v.tname + ')이 지금 있는 곳에서 곧바로 집하 지점으로 가요.' : l.was === 'busy' ? l.v.name + '(' + l.v.tname + ')은 싣고 가는 물품을 T+' + l.tFree + '분에 내린 뒤 그곳에서 집하 지점으로 가요.' : l.v.name + '(' + l.v.tname + ')은 충전을 T+' + l.tFree + '분에 마친 뒤 집하 지점으로 가요.';
    s.push(lead + ' 집하는 T+' + l.eta + '분, 부피 ' + l.vol + '을 실어요.');
  });
  s.push('수령지 ' + tp.Dn + '까지 도로의 주행 안내선을 따라 운송해요. 도착은 T+' + g.arrive + '분쯤이에요.');
  if (g.kind === 'split') s.push('물품이 한 대에 다 들어가지 않거나 한 대로는 더 늦어서, 두 대로 나눠 같은 수령지로 보내요(차량이 더 달리는 거리는 비용에 들어가요).');
  if (g.kind === 'pool') s.push('합차는 빈 차로 달리는 거리를 줄여요. 이미 싣고 가는 물품이 크게 늦어지지 않을 때만 선택해요.');
  if (g.kind === 'charge') s.push('지금 바로 쓸 수 있는 차량이 없어, 가장 빨리 충전을 마치고 올 수 있는 차량으로 안내해요. 물류 AI는 차량 현황을 계속 확인하다가 더 빠른 차량이 생기면 바꿔요.');
  return s;
}
function mapSvg(r, fleet, ev) {
  var K = 20, W = GRID * K + 20, ns = 'http://www.w3.org/2000/svg';
  function e(t, a, tx) { var n = document.createElementNS(ns, t), k; for (k in a) n.setAttribute(k, a[k]); if (tx != null) n.textContent = tx; return n; }
  var svg = e('svg', { viewBox:'0 0 ' + W + ' ' + W, role:'img', 'aria-label':'가상 지도: 차량, 집하 지점, 수령지와 선택된 운송 경로', style:'width:100%;max-width:440px;border:1px solid var(--line);border-radius:12px;background:var(--soft)' });
  function X(v) { return 10 + v * K; }
  function line(a, b, o) { var q = pth(a, b); svg.appendChild(e('polyline', { points:q.map(function (p) { return X(p[0]) + ',' + X(p[1]); }).join(' '), fill:'none', stroke:o.c, 'stroke-width':o.w, 'stroke-dasharray':o.d || '' })); }
  var i, g = r.go, P = r.tp.P, D = r.tp.D;
  for (i = 0; i <= GRID; i += 2) { svg.appendChild(e('line', { x1:X(i), y1:X(0), x2:X(i), y2:X(GRID), stroke:'#DDE2EA', 'stroke-width':0.6 })); svg.appendChild(e('line', { x1:X(0), y1:X(i), x2:X(GRID), y2:X(i), stroke:'#DDE2EA', 'stroke-width':0.6 })); }
  if (g) g.legs.forEach(function (l) { l.ph.forEach(function (p) { if (p.k === 'move' && p.to === P || (p.k === 'move' && p.to[0] === P[0] && p.to[1] === P[1])) line(p.from, p.to, { c:'#9AA3B2', w:1.6, d:'4 3' }); else if (p.k === 'trip') line(p.from, p.to, { c:l.pooled && p.to !== D && !(p.to[0] === D[0] && p.to[1] === D[1]) ? '#7B4FD0' : '#1A5FB4', w:2.4 }); }); });
  if (ev && ev.kind === 'closure') { var m = along(pth(P, D), dist(P, D) * 0.5); svg.appendChild(e('text', { x:X(m[0]), y:X(m[1]) + 5, 'text-anchor':'middle', 'font-size':16, 'font-weight':700, fill:'#C9302C' }, '✕')); }
  CHARGERS.forEach(function (c) { svg.appendChild(e('rect', { x:X(c[2]) - 5, y:X(c[3]) - 5, width:10, height:10, rx:2, fill:'#FFF3C4', stroke:'#B58900' })); svg.appendChild(e('text', { x:X(c[2]), y:X(c[3]) + 3.5, 'text-anchor':'middle', 'font-size':9, fill:'#8a6700' }, '⚡')); });
  var ids = {}; if (g) g.legs.forEach(function (l) { ids[l.v.id] = 1; });
  fleet.forEach(function (u) { var on = ids[u.id], col = u.state === 'down' ? '#C9302C' : on ? '#1A5FB4' : u.state === 'busy' ? '#D9A441' : u.state === 'charge' ? '#B58900' : '#9AA3B2', sz = on ? 7 : 5;
    svg.appendChild(e('polygon', { points:X(u.x) + ',' + (X(u.y) - sz) + ' ' + (X(u.x) - sz + 1) + ',' + (X(u.y) + sz - 2) + ' ' + (X(u.x) + sz - 1) + ',' + (X(u.y) + sz - 2), fill:col })); svg.appendChild(e('text', { x:X(u.x) + 7, y:X(u.y) - 4, 'font-size':8, fill:'#49505A' }, u.id)); });
  svg.appendChild(e('rect', { x:X(D[0]) - 6, y:X(D[1]) - 6, width:12, height:12, rx:6, fill:'#1E7B46' })); svg.appendChild(e('text', { x:X(D[0]) + 9, y:X(D[1]) + 4, 'font-size':9, fill:'#1E7B46' }, '수령지'));
  svg.appendChild(e('circle', { cx:X(P[0]), cy:X(P[1]), r:6, fill:'#C9302C' })); svg.appendChild(e('text', { x:X(P[0]) + 9, y:X(P[1]) + 4, 'font-size':9, fill:'#C9302C' }, '집하'));
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

function setSimBtn() { var b = $('lg-sim'); if (b) b.disabled = !!S.auto; }
function topbar() { return h('div', { class:'topin' }, [h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 물류' })])]), h('button', { type:'button', class:'btn tonal simbtn', id:'lg-sim', text:'🧪 시뮬레이션', 'aria-label':'자동 시뮬레이션 열기', disabled:S.auto ? true : null, onclick:openAuto })]); }
function kv(k, v, id) { return h('div', { class:'kv' }, [h('span', { text:k }), h('b', { id:id || null, text:v })]); }
function step(n, title, kids, id) {
  return h('div', { class:'card col', id:id || null, style:'margin-top:16px' }, [h('div', { class:'rowf' }, [pill(String(n), 'm'), h('b', { style:'font-size:17px', text:title })])].concat(kids));
}

// ── 평소 준비: 내 기기 ──
function devicesBody() {
  var m = devSummary(S.dev, kst()), f = S.form, e = S.err, kids = [];
  kids.push(h('b', { style:'font-size:16px', text:'내 기기' }));
  kids.push(h('div', { class:'sub', text:'폰·나비웹 워치·링(팔찌) 중 적어도 하나를 24시간 가까이 두어야 물류 호출이 가능합니다. 직접 적는 기록이며, 기기가 나비웹에 연결되는 기능은 아직 없어요.' }));
  kids.push(h('div', { class:'g4' }, [tile('등록한 기기', m.count + '개', '', 'lg-d0'), tile('24시간 가까이 두는 기기', m.carry + '개', m.carry ? '' : '하나 이상 필요해요', 'lg-d2'), tile('점검일 지남·오늘', m.due + '개', '', 'lg-d1')]));
  kids.push(h('div', { class:'frm' }, [sel('lg-dk', '종류', f.kind, DEVKINDS.map(function (k) { return [k, k]; }), function (v) { f.kind = v; }), field('lg-dn', '기기 이름', f.name, { err:e.name, ph:'예: 내 폰', max:40, set:function (v) { f.name = v; } }), field('lg-dc', '다음 점검·충전일(선택)', f.chk, { err:e.chk, ph:'2027-01-31', mode:'numeric', max:10, set:function (v) { f.chk = v.trim(); } })]));
  kids.push(h('label', { class:'chk', for:'lg-dcarry' }, [(function () { var c = h('input', { type:'checkbox', id:'lg-dcarry', checked:f.carry !== false ? true : false }); c.onchange = function () { f.carry = c.checked; }; return c; })(), h('span', { text:'24시간 가까이 둡니다' })]));
  kids.push(h('div', { class:'rowf' }, [btn('기록하기', 'fill', addDev), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null]));
  if (!S.dev.length) kids.push(h('div', { class:'empty', text:'아직 등록한 기기가 없어요.' }));
  else kids.push(h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['종류', '이름', '24시간', '점검일', ''].map(function (t) { return h('th', { text:t }); }))]),
    h('tbody', {}, S.dev.map(function (x) { return h('tr', {}, [h('td', {}, [pill(x.kind)]), h('td', {}, [h('b', { text:x.name })]), h('td', { text:x.carry ? '예' : '아니요' }), h('td', { class:'num', text:x.chk || '—' }), h('td', { class:'r' }, [btn('삭제', 'sm quiet', function () { S.dev = S.dev.filter(function (y) { return y.id !== x.id; }); S.msg = '삭제했어요.'; save(); render(); })])]); }))])]));
  return h('div', { class:'col' }, kids);
}

// ── 평소 준비: 보내는 정보 ──
function consentBody() {
  var n = h('span', { class:'sub', id:'lg-c-n' }), n2 = h('span', { class:'sub', id:'lg-a-n' });
  function tally() { n.textContent = '보내기로 고른 항목 ' + Object.keys(S.share).length + ' / ' + (SEND.length - 1) + ' (현재 위치 제외)'; n2.textContent = '답해도 되는 질문 ' + Object.keys(S.askok).length + ' / ' + ASKS.length; }
  function list(items, store, pre, fixedKey) {
    return h('div', {}, items.map(function (f) { var id = pre + f[0], cb = h('input', { type:'checkbox', id:id, checked:f[0] === fixedKey || store[f[0]] ? true : false, disabled:f[0] === fixedKey ? true : null });
      cb.onchange = function () { if (cb.checked) store[f[0]] = 1; else delete store[f[0]]; save(); tally(); sumUpdate(); }; return h('label', { class:'chk', for:id }, [cb, h('span', { text:f[1] + (f[0] === fixedKey ? ' (항상 포함)' : '') })]); }));
  }
  var box = h('div', { class:'col' }, [h('b', { style:'font-size:16px', text:'내 비서가 내 PDV에서 꺼내 물류 AI에 보낼 정보(익명화)' }),
    h('div', { class:'sub', text:'현재 위치(집하 지점)는 집하에 꼭 필요해 항상 포함됩니다(이름·주민번호·정확한 주소는 어떤 경우에도 보내지 않아요). 나머지는 항목마다 직접 정하고, 고른 상태는 이 브라우저에만 저장돼요. 아래 시뮬레이션은 이 선택과 상관없이 모든 항목을 보낸 경우를 보여 줍니다.' }),
    n, list(SEND, S.share, 'lg-sh-', 'loc'), h('div', { class:'rowf' }, [btn('모두 해제', 'quiet', function () { S.share = {}; save(); render(); })]),
    h('b', { style:'font-size:16px;margin-top:8px', text:'물류 AI가 내 비서에게 추가로 물어도 되는 것' }), n2, list(ASKS, S.askok, 'lg-ak-', null), h('div', { class:'sub', text:'예시입니다. 내 비서는 허용한 질문에만 내 기록을 바탕으로 답해요. 아래 시뮬레이션은 비서가 모두 답한 경우를 보여 줍니다.' })]);
  tally(); return box;
}
function prepSummary() { var m = devSummary(S.dev, kst()); return '평소 준비 — 기기 ' + m.count + '개(24시간 가까이 ' + m.carry + '개) · 보내는 정보 ' + sharedItems(S.share).length + '항목 · 허용한 질문 ' + askItems(S.askok).length + '개'; }
function sumUpdate() { var s = $('lg-prep-sum'); if (s) s.textContent = prepSummary(); }
function prepSection() {
  var det = h('details', { id:'lg-s-prep', class:'card', style:'margin-top:16px' }, [h('summary', { id:'lg-prep-sum', style:'cursor:pointer;font-weight:700;font-size:17px', text:prepSummary() }),
    h('div', { class:'col', style:'margin-top:16px;gap:24px' }, [devicesBody(), consentBody()])]);
  det.open = !!S.prepOpen; det.ontoggle = function () { S.prepOpen = det.open; };
  return det;
}

/* 나비웹 도우미로 기관 사이트 조회 열기 — 로그인·인증은 사용자, 조회까지만 한다. 호스트는 NaviLogistics.agentResult(ok, msg) 로 결과를 돌려준다. */
var AG = [["epost", "택배 배송 조회(우체국)", "https://service.epost.go.kr"], ["unipass", "수입 화물 통관 조회(관세청)", "https://unipass.customs.go.kr"]], AGG = {"epost": "우체국 택배에서 배송 조회", "unipass": "관세청 유니패스에서 화물 통관 진행 조회"};
function agentResult(ok, msg) { S.agMsg = clean(msg, 160) || (ok ? '도우미가 시작합니다.' : '도우미에 맡기지 못했어요.'); render(); }
function handOff() {
  var it = AG.filter(function (x) { return x[0] === S.ag; })[0] || AG[0];
  S.agMsg = '도우미에 맡기는 중…'; render();
  if (!(LS.agent && LS.agent.length)) return agentResult(false, '나비웹 도우미를 쓸 수 없는 화면이에요.');
  emit('agent', { kind:it[0], label:it[1], url:it[2], goal:AGG[it[0]] });
}
function agentCard() {
  var s = h('select', { id:'lg-ag', 'aria-label':'도우미로 열 사이트' }, AG.map(function (x) { return h('option', { value:x[0], text:x[1] }); })); s.value = S.ag || AG[0][0]; s.onchange = function () { S.ag = s.value; };
  return h('div', { class:'card col', id:'lg-agent', style:'margin-top:16px' }, [h('b', { text:'배송 조회는 도우미에게 (나비웹 도우미)' }),
    h('div', { class:'sub', text:'택배 배송이나 수입 화물 통관 상태를 도우미가 해당 사이트에서 열어 줍니다. 로그인은 내가 하고, 조회까지만 해요. 발송 신청과 결제는 하지 않아요.' }),
    h('div', { class:'rowf' }, [s, btn('도우미로 열기', '', handOff)]),
    S.agMsg ? h('div', { class:'sub', id:'lg-ag-msg', text:S.agMsg }) : null]);
}

// ── 가상 물류 수요(무작위) ──
/** 수요는 다양하다: 도시 안의 임의 지점에서 한 건 이상의 물품이 생긴다. 수령지는 말한 내용 또는 PDV 일정에서 알고, 물품 부피(상자 단위)·종류(일반·냉장·대형)가 수요마다 다르다.
*  say = 말·문자로 하는 요청(여러 표현 중 하나), sched = PDV 일정·물품 메모, n = 부피 범위(상자 수), acc = 종류(normal·cold·large), pref = 받는 방식. */
var CASES = [
  { id:'parcel', kind:'택배', name:'작은 택배 한 건', dest:'주택단지', n:[1, 3], acc:'normal', can:'voice', say:['이 택배를 주택단지로 보내 주세요', '집으로 보낼 물건이 있어요', '작은 상자 하나 부탁해요'], sched:'오늘 중 주택단지 택배', pref:'문 앞에 두기' },
  { id:'fresh', kind:'신선식품', name:'신선식품 냉장 배송', dest:'식당가', n:[3, 8], acc:'cold', can:'text', say:['식당가에 냉장 식자재 보내야 해요', '오늘 아침 납품분이에요, 차갑게 가야 해요', '냉장 물품 배송 부탁합니다'], sched:'오늘 11:00 식당가 납품(냉장)', pref:'대면 수령' },
  { id:'medical', kind:'의약품', name:'병원 의료 물품', dest:'병원', n:[1, 4], acc:'cold', can:'voice', say:['병원에 약품을 보내야 해요', '종합병원에 냉장 약을 전달해 주세요', '의료 물품이 급해요'], sched:'오늘 13:00 종합병원 약품(냉장)', pref:'대면 수령' },
  { id:'furniture', kind:'가구', name:'대형 가구 이사', dest:'주택단지', n:[8, 16], acc:'large', can:'text', say:['큰 가구를 옮기려고 해요', '장롱이랑 소파를 주택단지로 보내 주세요', '이삿짐이에요, 큰 차가 필요해요'], sched:'오늘 15:00 주택단지 이사(대형)', pref:'' },
  { id:'parts', kind:'부품', name:'공장 부품 납품', dest:'공장', n:[4, 10], acc:'normal', can:'voice', say:['공장에 부품 납품이에요', '오늘 라인에 쓸 부품을 보내야 해요', '공장으로 부품 상자 보내 주세요'], sched:'오늘 09:30 공장 부품 납품', pref:'' },
  { id:'night', kind:'야간 주문', name:'늦은 밤 소량 주문', dest:'업무지구', n:[1, 2], acc:'normal', can:'none', say:[''], sched:'야간 업무지구 소량 배송', pref:'문 앞에 두기' },
  { id:'bulk', kind:'대량 입고', name:'시장 대량 입고', dest:'시장', n:[10, 20], acc:'normal', can:'voice', say:['시장에 물건이 많이 들어가요', '오늘 시장 입고분 한꺼번에 부탁해요', '상자가 스무 개쯤 돼요'], sched:'오늘 07:00 시장 입고', pref:'' },
  { id:'port', kind:'수입 화물', name:'항구에서 센터로 화물', dest:'센터', n:[6, 14], acc:'normal', can:'text', say:['항구에 도착한 화물을 센터로 보내 주세요', '통관 끝난 화물이에요, 물류센터로 가야 해요'], sched:'통관 완료 화물 항구→센터', pref:'' }
];
var CASEBY = {}; CASES.forEach(function (x) { CASEBY[x.id] = x; });
var NAMES = ['김가온', '이서연', '박도윤', '최하린', '정민준', '한지우', '오세아', '윤태양'];
var ONSITE_NOTE = '아래 차량·물품·경로·운임은 모두 가상 시나리오입니다.';
var ACC = { normal:'일반 물품', cold:'냉장 물품(냉장 탑차만 가능)', large:'대형 물품(트럭만 가능)' };
function pick(a, r) { return a[Math.min(a.length - 1, Math.floor(r() * a.length))]; }
function sig(txt) {
  function f(x) { var v = 2166136261, i; for (i = 0; i < x.length; i++) { v ^= x.charCodeAt(i); v = Math.imul(v, 16777619) >>> 0; } return ('00000000' + v.toString(16)).slice(-8); }
  return 'SIG-' + f(txt) + f(txt + '#');
}
function clock(ms) { return new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Seoul', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(new Date(ms)); }
/** 기기·수요·위치·물품 부피를 무작위로 뽑는다. rng 를 넘기면 같은 값이 나온다(시험용). 집하 지점은 도시 안의 임의 지점이다. */
function draw(rng, now) {
  var r = typeof rng === 'function' ? rng : Math.random, t0 = now == null ? Date.now() : now;
  var c = pick(CASES, r), dev = pick(DEVICES, r), sp = spot(c.dest), D = [sp[2], sp[3]], P, tries = 0;
  do { P = [1 + Math.floor(r() * (GRID - 1)), 1 + Math.floor(r() * (GRID - 1))]; tries++; } while (dist(P, D) < 3 && tries < 50);
  var n = c.n[0] + Math.floor(r() * (c.n[1] - c.n[0] + 1)), rn = pick(NAMES, r);
  var can = dev[0] === 'ring' ? 'none' : dev[0] === 'watch' ? (c.can === 'none' ? 'none' : 'voice') : c.can, say = can === 'none' ? '' : pick(c.say, r);
  var sc = { c:c, inc:c, dev:dev[0], devName:dev[1], P:P, D:D, Dn:sp[1], place:'x' + P[0] + 'y' + P[1], placeName:'가상 지점 (' + P[0] + ', ' + P[1] + ') 근처', xy:P, can:can, say:say, t0:t0, n:n, acc:c.acc, destVia:say ? '말한 내용' : 'PDV 일정', rider:{ name:rn, count:n } };
  sc.tp = { P:P, D:D, Dn:sp[1], vol:n, kind:c.acc, n:n };
  sc.anon = 'ANON-' + sig(rn + n + sc.placeName + t0).slice(4, 10).toUpperCase();
  var m = callMessage(sc.can, sc.say); sc.msg = m;
  sc.payload = [m.label, m.body, sc.anon, P.join(','), c.sched, n, c.acc, c.pref, t0].join('|') + '|' + sc.dev;
  sc.sig = sig(sc.payload); sc.no = 'LG-' + sc.sig.slice(4, 10).toUpperCase();
  return sc;
}
function verify(sc) { return sig(sc.payload) === sc.sig; }
/** 집하 지점에서 본 차량 현황: 차량마다 하던 일을 마치는 때(avail)와 집하 지점까지의 시간, 집하 때의 배터리. */
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
// run = { sc:수요, fleet:지금의 차량 현황, fleetInit:처음 현황, fleet0:계획 확정 때의 현황, plan0:확정한 계획, ev:운송 중 갱신, t:시간 막대, reached:열 수 있는 가장 먼 단계, cur:보고 있는 단계 }
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
var PF = 'lg-';
function X(id) { return PF + id; }
function clk(sc, t) { return clock(sc.t0 + t * 60000); }
function p1(v) { return Math.round(v * 10) / 10; }
function xy(a) { return '(' + p1(a[0]) + ', ' + p1(a[1]) + ')'; }
var POOL_BASE = 0.5;   // 합차하면 기본 운임을 기존 물품과 나눠 절반만 낸다(가정)
function fareOf(sc, l) { var km = dist(sc.P, sc.D) + (l.detour || 0); return Math.round(BASEFARE * (l.pooled ? POOL_BASE : 1) + PERKM * km + PERVOL * l.vol); }
/** 상자 번호: 한 수요의 상자를 차량 순서대로 B1, B2 … 로 나눠 붙인다. */
function boxIds(legs) { var k = 0; return legs.map(function (l) { var a = k + 1; k += l.vol; return l.vol > 1 ? 'B' + a + '~B' + k : 'B' + a; }); }
function kindName(k) { return KINDS[k] || k; }
function rows3(rows, id) { return rows.length ? h('div', { class:'tbw' }, [h('table', { class:'tbl', id:id }, [h('thead', {}, [h('tr', {}, ['방식', '차량', '집하', '비용', '집하 때 배터리'].map(function (t, i) { return h('th', { class:i > 1 ? 'r' : '', text:t }); }))]), h('tbody', {}, rows)])]) : h('div', { class:'empty', text:'쓸 수 있는 조합이 없어요.' }); }
function planList(r) { return h('div', {}, planText(r).map(function (x, i) { return h('div', { class:'stp', 'data-s':String(i) }, [h('i', { text:String(i + 1) }), h('div', {}, [h('span', { text:x })])]); })); }
function noGo(c) { return [h('div', { class:'card col hero', id:X('nogo') }, [h('div', { class:'big', text:'배차할 수 있는 차량이 없어요' }), h('div', { class:'sub', text:'조건(냉장·대형·부피·배터리)에 맞는 차량이 모두 점검 중이거나 쓸 수 없어요. 실제라면 물류 AI가 대기열에 올려 두고 가능해지면 바로 배차해요. 2-4에서 점검 중인 차량을 되돌리거나 “처음 상태로”를 눌러 보세요.' })])]; }
function G(fn) { return function (c) { return c.dec.go ? fn(c) : noGo(c); }; }
/** 차량 표(실시간): 위치·속도·경로(하역지)·배터리·싣고 있는 물품. 막대를 끌면 그 시각 값으로 바뀐다. only 가 true 면 이 수요에 배정된 차량만 보여 준다. */
function liveTable(c, only) {
  var R = c.R, sc = c.sc, g = c.fin.go, ev = R.ev, mx = endT(g) + 1, t = Math.min(R.t, mx), tb = h('tbody', { id:X('lv-body') });
  var lab = h('b', { id:X('t-lab'), text:'경과 T+' + t + '분 · 가상 시각 ' + clk(sc, t) });
  function fill(tt) {
    tb.textContent = '';
    fleetAt(c.fleet, g, ev, tt).forEach(function (q) {
      var lost = ev && ev.lost && ev.lost.v.id === q.v.id; if (only && !q.mine && !lost) return;
      tb.appendChild(h('tr', { 'data-v':q.v.id }, [h('td', {}, [h('b', { text:q.v.id }), h('div', { class:'sub', text:TYPES[q.v.type].name + (q.mine ? ' · 배정' : '') })]), h('td', { text:q.st }), h('td', { class:'num', text:xy([q.x, q.y]) }), h('td', { class:'r num', text:q.spd ? q.spd + ' km/h' : '정지' }),
        h('td', { class:'num', text:q.to ? '→ ' + xy(q.to) : '—' }), h('td', { class:'r num' + (q.bat < 20 ? ' dn' : ''), text:Math.round(q.bat) + '%' }), h('td', { class:'r num', text:q.cg + '/' + capOf(q.v) })]));
    });
  }
  fill(t);
  var rg = h('input', { type:'range', id:X('t'), min:'0', max:String(mx), value:String(t), 'aria-label':'경과 시간(분)', style:'width:100%' });
  rg.oninput = function () { var v = Number(rg.value); R.t = v; lab.textContent = '경과 T+' + v + '분 · 가상 시각 ' + clk(sc, v); fill(v); };
  return h('div', { class:'col' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('lv') }, [h('thead', {}, [h('tr', {}, ['차량', '상태', '위치(km)', '속도', '경로(하역지)', '배터리', '적재(부피/용량)'].map(function (x, i) { return h('th', { class:i === 2 || i === 4 ? '' : i > 2 ? 'r' : '', text:x }); }))]), tb])]),
    h('div', { class:'card col', style:'margin-top:12px' }, [lab, rg, h('div', { class:'sub', text:'막대를 끌어 시간이 흐를 때 위치·속도·배터리·싣고 있는 물품이 어떻게 바뀌는지 보세요. 물류 AI는 모든 차량에게서 이 값을 실시간으로 받아 갱신해요(가정: 1분마다). ' + ONSITE_NOTE })])]);
}
function sendForm(sc) {
  var m = sc.msg, c = sc.c;
  return form([
    ['① 기기에서 보낸 물류 메시지', [['전송 기기', sc.devName + (sc.dev === 'ring' ? ' (말·문자 입력이 없는 기기)' : ''), X('s1-dev')], ['전달 형태', m.label, X('s1-mode')], ['내용', m.body || '없음 — 오직 “물류”만 전달(보낼 곳은 PDV 일정이 대신 말해요)', X('s1-body')], ['받는 곳', '물류 AI']]],
    ['② 내 AI 비서가 내 PDV에서 꺼내 익명화한 정보', [['익명 번호', sc.anon, X('s1-anon')], ['현재 위치(집하 지점)', sc.placeName + ' (가상 좌표 ' + sc.P[0] + ', ' + sc.P[1] + ') — 집하에만 써요', X('s1-loc')], ['오늘 일정·보낼 곳', c.sched], ['물품', '부피 ' + sc.n + ' · ' + kindName(sc.acc) + '(이름·주소 없이 개수와 크기만)'], ['취급 조건', ACC[sc.acc]], ['받는 방식', c.pref || '없음'], ['빼는 정보', '이름·주민번호·정확한 주소는 보내지 않아요']]],
    ['③ 접수 정보', [['호출 시각', clock(sc.t0) + ' (가상)'], ['운송 번호', sc.no, X('s1-no')]]],
    ['④ 발송인의 디지털 서명', [['서명값', sc.sig, X('s1-sig')], ['서명 방식', '단말의 개인 키로 서명(가상). 물류 AI가 받은 뒤 확인합니다.']]]]);
}

// ── 19개 세부 단계(각각 눌린 단계 아래로 펼쳐지는 패널에 결과를 보여 준다) ──
function s11(c) { var sc = c.sc, how = { phone:'폰의 물류 버튼을 누릅니다.', watch:'나비웹 워치의 물류 버튼을 길게 누릅니다.', ring:'링(팔찌)을 두 번 눌러 물류를 보냅니다.' }[sc.dev];
  return [h('div', { class:'sub', text:'가상 수요입니다. 기기·물품·집하 지점은 무작위로 뽑았어요. 도시 어디서든 보낼 물품이 생기면 가장 단순한 조작 한 번으로 물류 AI를 부릅니다.' }), form([['기기 호출', [['사용한 기기', sc.devName, X('s1-dev')], ['조작(가상)', how], ['호출 시각', clock(sc.t0) + ' (가상)'], ['어떤 수요', sc.c.name + ' · 부피 ' + sc.n, X('s1-inc')], ['집하 지점', sc.placeName]]]])]; }
function s12(c) { var sc = c.sc, m = sc.msg;
  return [form([['물류 메시지 구성', [['말·문자 입력', sc.can === 'voice' ? '말할 수 있음' : sc.can === 'text' ? '문자를 입력할 수 있음' : '둘 다 어려움'], ['전달 형태', m.label, X('s1-mode')], ['내용', m.body || '없음 — 오직 “물류”만 전달', X('s1-body')], ['이유', m.only ? (sc.dev === 'ring' ? '링에는 말·문자 입력이 없어 “물류”만 갑니다. 보낼 곳은 PDV의 오늘 일정에서 가져와요.' : '말도 문자도 어려워 “물류”만 갑니다. 보낼 곳은 PDV의 오늘 일정에서 가져와요.') : '“물류” 표시와 함께 ' + (m.mode === 'voice' ? '음성' : '문자') + '을(를) 보냅니다.']]]])]; }
function s13(c) { var sc = c.sc, p = sc.c;
  return [h('div', { class:'sub', text:'발송인의 나만의 AI 비서가 발송인의 PDV(내 데이터 금고)에서 필요한 정보만 꺼내 익명화해 붙입니다. 이 시뮬레이션은 모든 항목을 보내기로 한 경우를 보여 줍니다. 실제로는 “평소 준비”에서 고른 항목만 전송되고, 현재 위치(집하 지점)는 항상 포함돼요.' }),
    form([['PDV 에서 꺼낸 정보(익명)', [['익명 번호', sc.anon, X('s1-anon')], ['현재 위치(집하 지점)', sc.placeName + ' (가상 좌표 ' + sc.P[0] + ', ' + sc.P[1] + ')', X('s1-loc')], ['오늘 일정·보낼 곳', p.sched, X('s1-sched')], ['물품의 개수와 크기', '부피 ' + sc.n + '(상자 단위)', X('s1-goods')], ['취급 조건', ACC[sc.acc], X('s1-acc')], ['받는 방식', p.pref || '없음']]]])]; }
function s14(c) { return [h('div', { class:'sub', text:'위 내용을 하나의 Form으로 묶어 디지털 서명을 붙이고 물류 AI로 보냅니다.' }), sendForm(c.sc)]; }
function s21(c) { var sc = c.sc; return [form([['서명 확인', [['받은 서명', sc.sig], ['확인 결과', verify(sc) ? '일치 — 전달 중 내용이 바뀌지 않았어요' : '불일치 — 위변조 의심', X('s2-sig')], ['익명 번호', sc.anon], ['운송 번호', sc.no]]]])]; }
function s22(c) { var sc = c.sc, km = dist(sc.P, sc.D);
  var need = sc.acc === 'cold' ? '냉장 탑차(용량 ' + TYPES.cold.cap + ') — 냉장 장치가 없는 차량은 쓰지 않아요' : sc.acc === 'large' ? '트럭(용량 ' + TYPES.truck.cap + ') — 대형 물품은 나누지 않아요' : '부피 ' + sc.n + ' — 한 대에 들어가면 한 대, 아니면 두 대로 나누거나 이미 가는 차량에 합차';
  return [form([['수요 정리', [['수령지', sc.Dn + ' (' + sc.destVia + '에서 확인)', X('s2-dest')], ['집하 → 수령지', km + 'km · 직행 약 ' + mins(km) + '분'], ['물품', '부피 ' + sc.n + ' · ' + kindName(sc.acc), X('s2-party')], ['취급 조건', ACC[sc.acc]], ['필요한 차량 조건', need, X('s2-need')], ['요청 시각', clock(sc.t0) + ' (가상)']]]]),
    h('div', { class:'sub', text:'물류 AI는 물품의 부피·종류·수령지까지만 정리해요. 어느 차량이 갈지는 다음 단계에서 모든 차량의 위치·경로·배터리·싣고 있는 물품을 보고 정합니다.' })]; }
function s23(c) { var sc = c.sc, w = sc.c.id === 'medical' ? '약품은 1시간 안에 닿아야 해요(가상)' : sc.c.id === 'fresh' ? '납품 시각 전에는 닿아야 해요(가상)' : '오늘 안에만 닿으면 돼요(가상)', bag = sc.acc === 'cold' ? '냉장 포장, 상자 ' + sc.n + '개(가상)' : sc.acc === 'large' ? '대형 가구, 포장 끝(가상)' : '일반 포장 상자 ' + sc.n + '개(가상)';
  return [h('div', { class:'sub', text:'물류 AI가 배차에 꼭 필요한 것을 발송인의 비서에게 더 묻습니다. 비서는 허용된 질문에만 PDV 기록을 바탕으로 답해요.' }), form([['추가 질의', [['물류 AI → 비서: 언제까지 도착해야 하나요?', '답: ' + w, X('s2-ask0')], ['물류 AI → 비서: 포장 상태와 무게는요?', '답: ' + bag, X('s2-ask1')]]]])]; }
function s24(c) {
  var sc = c.sc, lock0 = c.locked, rows = c.g.map(function (x) { var v = x.v, T = x.T, st = v.state === 'idle' ? '유휴' : v.state === 'busy' ? '물품 운송 중' : v.state === 'charge' ? '충전 중' : '점검 중', on = v.state !== 'down';
    return h('tr', {}, [h('td', {}, [h('b', { text:v.id }), h('div', { class:'sub', text:T.name + ' · 용량 ' + T.cap + (T.cold ? ' · 냉장' : '') + (T.big ? ' · 대형' : '') })]), h('td', { text:st }), h('td', { class:'num', text:xy([v.x, v.y]) }), h('td', { class:'r num', text:v.state === 'busy' ? v.spd + ' km/h' : '정지' }), h('td', { class:'num', text:v.job ? '→ ' + xy(v.job.to) : '—' }),
      h('td', { class:'r num' + (v.bat < 20 ? ' dn' : ''), text:Math.round(v.bat) + '%' }), h('td', { class:'r num', text:(v.job ? v.job.vol : 0) + '/' + T.cap }), h('td', { class:'r num', text:on ? (v.state === 'idle' ? x.eta + '분' : x.eta + '분(일을 마친 뒤)') : '—' }),
      h('td', {}, [h('button', { type:'button', class:'chip', disabled:lock0 ? true : null, 'data-down':v.id, 'aria-pressed':String(v.state === 'down'), text:v.state === 'down' ? '점검 중 (되돌리기)' : '점검으로 바꾸기', onclick:function () { setDown(v, v.state !== 'down'); c.re(); } })])]); });
  var idle = c.g.filter(function (x) { return x.v.state === 'idle'; }).length, soon = c.g.filter(function (x) { return x.v.state === 'busy' || x.v.state === 'charge'; }).length, off = c.g.filter(function (x) { return x.v.state === 'down'; }).length;
  return [h('div', { class:'sub', text:'물류 AI는 모든 차량의 현재 위치·속도·경로(하역지)·배터리·싣고 있는 물품을 실시간으로 받아 둡니다. 집하 지점(' + sc.placeName + ')까지 걸리는 시간은 차량이 지금 하던 일을 마치는 때와 곳에서부터 셉니다.' + (lock0 ? ' 아래는 지시서를 보낼 때(3-1)의 현황이에요.' : '') }),
    h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('s2-fleet') }, [h('thead', {}, [h('tr', {}, ['차량', '상태', '위치(km)', '속도', '경로(하역지)', '배터리', '적재', '집하까지', ''].map(function (t, i) { return h('th', { class:i > 2 && i !== 4 && i < 8 ? 'r' : '', text:t }); }))]), h('tbody', {}, rows)])]),
    h('div', { class:'sub', id:X('s2-av'), text:'지금 바로 갈 수 있는 차량 ' + idle + '대 · 하던 일을 마치면 갈 수 있는 차량 ' + soon + '대 · 쓸 수 없는 차량 ' + off + '대' }),
    h('div', { class:'sub', text:lock0 ? '지시서를 이미 보내 현황은 더 바꿀 수 없어요.' : '버튼을 눌러 차량을 점검으로 바꾸면(저장하지 않습니다) 다음 단계의 배차가 달라져요.' }),
    lock0 ? null : h('div', { class:'rowf' }, [btn('처음 상태로', 'quiet', function () { c.R.fleet = clone(c.R.fleetInit); c.re(); })])];
}
function s25(c) {
  var r = c.dec, g = r.go, tp = r.tp, hero = h('div', { class:'card col hero', id:X('m-res') }), best = r.best, L0 = g.legs[0];
  var names = g.legs.map(function (l) { return l.v.id + '(' + l.v.tname + ')'; }).join(' + ');
  hero.appendChild(h('div', { class:'big', id:X('m-start'), text:'집하 약 ' + g.pickupAt + '분 뒤 · ' + names }));
  hero.appendChild(h('div', { class:'sub', id:X('m-kind'), text:g.kind === 'single' ? '한 대로 물품 전부(부피 ' + tp.vol + ')를 실어요. 도착은 T+' + g.arrive + '분쯤이에요.' : g.kind === 'split' ? '한 대로는 못 싣거나 두 대가 더 빨라, 두 대로 나눠 같은 수령지로 가요.' : g.kind === 'pool' ? '이미 물품을 싣고 가는 ' + L0.v.id + '의 남는 자리에 함께 실어요(합차). 빈 차로 달리는 거리를 아끼고, 먼저 실은 물품은 ' + L0.exist.delay + '분만 늦어져요.' : '지금 바로 쓸 수 있는 차량이 없어, 가장 빨리 충전을 마치고 오는 차량으로 안내해요.' }));
  var opts = r.options.slice(0, 5).map(function (o, i) { var k = o.shape.kind; return h('tr', {}, [h('td', {}, [pill(k === 'split' ? '두 대' : k === 'pool' ? '합차' : '한 대', k === 'single' ? 'p' : 'm')]), h('td', {}, [h('b', { text:(i === 0 ? '★ ' : '') + o.legs.map(function (l) { return l.v.id; }).join(' + ') })]), h('td', { class:'r num', text:o.eta + '분' }), h('td', { class:'r num', text:p1(o.cost) + '점' }), h('td', { class:'r num', text:o.legs.map(function (l) { return Math.round(l.batPick) + '%'; }).join(' / ') })]); });
  return [hero, sub('비용이 낮은 순서(비용 = 수령지 도착 시각 + 먼저 실은 물품이 늦어지는 분 + 새로 달리는 거리 × ' + KMW + ')'), best ? rows3(opts, X('m-opts')) : h('div', { class:'sub', id:X('m-opts'), text:'바로 쓸 수 있는 조합이 없어요.' }), h('div', {}, [mapSvg(r, c.fleet, null), h('div', { class:'sub', text:'빨간 점이 집하 지점, 초록 원이 수령지, 파란 삼각형이 배정된 차량이에요. 회색 점선은 차량이 집하 지점까지 가는 길, 파란 선은 집하 뒤 운송 경로(합차면 보라색이 먼저 내리는 기존 물품 구간)입니다.' })]),
    r.why.length ? h('div', { id:X('m-why') }, [h('b', { text:'조합에서 빠진 이유' }), h('div', {}, r.why.map(function (w) { return kv(w[0], w[1]); }))]) : null];
}
function s26(c) {
  var r = c.dec, g = r.go, sc = c.sc, km = dist(sc.P, sc.D), tot = g.legs.reduce(function (a, l) { return a + fareOf(sc, l); }, 0);
  return [form([['운송 계획서 · ' + sc.no, [['집하 지점', sc.placeName], ['수령지', sc.Dn + ' (' + km + 'km)'], ['물품', '부피 ' + sc.n + ' · ' + kindName(sc.acc)], ['차량', g.legs.map(function (l) { return l.v.id + '(' + l.v.tname + ') ' + (l.pooled ? '합차 · ' : '') + '부피 ' + l.vol + ' · 집하 T+' + l.eta + '분'; }).join(' / '), X('s2-plan')], ['도착', 'T+' + g.arrive + '분쯤 (가상 ' + clk(sc, g.arrive) + ')'], ['예상 운임', g.legs.map(function (l) { return l.v.id + ' ' + won(fareOf(sc, l)); }).join(' + ') + ' = ' + won(tot) + ' GDC(가상 운임: 기본 ' + won(BASEFARE) + ' + ' + won(PERKM) + '×' + km + 'km + ' + won(PERVOL) + '×부피' + (g.kind === 'pool' ? ', 합차는 기본 운임 절반' : '') + ')'], ['결정 주체', '배차·경로는 물류 AI가 정해요(사람 운전 없음)']]]]), planList(r)];
}
function dispatchList(sc, r) {
  var g = r.go, tp = r.tp, L = [];
  g.legs.forEach(function (l) { L.push({ k:'veh', who:l.v.id + ' (' + l.v.tname + ') · 부피 ' + l.vol, order:(l.pooled ? '싣고 가는 기존 물품은 그대로 두고 ' : l.chg ? '먼저 ' + l.chg.name + '에서 충전한 뒤 ' : l.was === 'idle' ? '' : l.was === 'busy' ? '지금 싣고 가는 물품을 내려 준 뒤 ' : '충전을 마친 뒤 ') + '집하 지점(' + xy(tp.P) + ')으로 가서 물품 ' + l.vol + '을 싣고 ' + (l.pooled ? '기존 물품을 먼저 내린 다음 ' : '') + tp.Dn + '으로 운송합니다. 운송 중에는 위치·속도·배터리·적재량을 계속 보내요.', due:'T+' + l.eta + '분 집하 · T+' + l.arrive + '분 도착' }); });
  L.push({ k:'road', who:'도로 관제(주행 안내선)', order:'집하 지점 → ' + tp.Dn + ' 구간의 주행 안내선을 차량별 시간대로 예약해, 다른 차량과 겹치지도 막히지도 않게 합니다.', due:'즉시' });
  L.push({ k:'vic', who:'발송인의 나만의 AI 비서', order:'배정된 차량 번호·집하 위치·도착 예상 시각을 알립니다. 말·문자가 어려우면 진동으로 간단히 알려요.', due:'즉시' });
  L.push({ k:'rcv', who:'수령지(' + tp.Dn + ')의 AI 비서', order:'도착 예정 시각과 취급 조건(' + kindName(tp.kind) + ')을 미리 알려 받을 준비를 하게 합니다.', due:'즉시' });
  return L;
}
function s31(c) {
  var r = c.dec, L = dispatchList(c.sc, r);
  return [h('div', { class:'sub', text:'물류 AI가 배정 차량, 도로 관제, 발송인과 수령지의 비서에 지시서를 동시에 보냅니다. 발송 시각은 T+0분이고, 이때 계획이 확정돼요. 지금 다른 물품을 싣고 있는 차량은 그 물품을 먼저 내려 준 뒤에(합차는 함께 싣고) 이 일을 맡아요.' }),
    h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('s3-tbl') }, [h('thead', {}, [h('tr', {}, ['받는 곳', '지시 내용', '예정'].map(function (x) { return h('th', { text:x }); }))]), h('tbody', {}, L.map(function (x) { return h('tr', {}, [h('td', {}, [h('b', { text:x.who })]), h('td', { text:x.order }), h('td', { text:x.due })]); }))])])];
}
function s32(c) { var g = c.fin.go;
  return [h('div', { class:'sub', text:'배정된 차량이 집하 지점으로 가요. ' + g.legs.map(function (l) { return l.v.id + '는 ' + (l.pooled ? '기존 물품을 싣고 들러서' : l.was === 'idle' && !l.chg ? '지금 있는 곳에서 바로' : l.chg ? '먼저 충전하고' : '하던 일을 마친 뒤') + ' T+' + l.eta + '분에 도착'; }).join(', ') + '해요. 도착할 때까지 도로 관제가 주행 안내선 구간을 비워 줘요.' }), liveTable(c, true)]; }
function s33(c) { var sc = c.sc, g = c.fin.go, ids = boxIds(g.legs), tot = g.legs.reduce(function (a, l) { return a + l.vol; }, 0);
  var groups = [['적재 확인', [['요청 부피', sc.n], ['실제로 실은 부피(합)', tot, X('s3-board')], ['일치 확인', tot === sc.n ? '일치 — 출발해요' : '불일치 — 출발하지 않아요', X('s3-match')], ['취급 조건', sc.acc === 'cold' ? '냉장 장치를 켜고 온도를 확인했어요(가상)' : sc.acc === 'large' ? '대형 물품을 고정했어요(가상)' : '일반 적재, 특별한 준비 없음']]]];
  g.legs.forEach(function (l, i) { groups.push(['차량 ' + l.v.id + ' 적재 기록(익명)', [['집하 시각', 'T+' + l.eta + '분 · 가상 ' + clk(sc, l.eta)], ['상자 번호', sc.no + '-' + ids[i], X('s3-ids') + i], ['차량 적재량', (l.pooled ? l.exist.vol : 0) + ' → ' + ((l.pooled ? l.exist.vol : 0) + l.vol) + ' (용량 ' + capOf(l.v) + ')', X('s3-pax') + i]].concat(l.pooled ? [['합차', '먼저 실은 물품(부피 ' + l.exist.vol + ')과 함께 실었어요 — 용량 안이에요']] : [])]); });
  return [h('div', { class:'sub', text:'차량이 도착하면 발송인의 비서가 적재를 확인해요. 요청한 부피와 실제로 실은 부피가 같아야 출발하고, 적재량은 곧바로 차량 상태에 갱신돼요.' }), form(groups), liveTable(c, true)]; }
function s34(c) { return [h('div', { class:'sub', text:'운송하는 동안 물류 AI는 전체 차량(배정 차량과 다른 물품을 실은 차량 모두)의 위치·속도·경로·배터리·적재량을 받아 한 장의 현황으로 갱신해요. 배터리가 모자라지는 차량이 생기면 새 일을 주지 않고 충전소로 보내요.' }), liveTable(c, false)]; }
/** 운송 중 사건 둘 중 하나: ① 배정 차량 하나가 집하 지점에 닿기 전에 이상으로 멈춘다 → 그 시각의 전체 차량 상태에서 그 물량만 다시 배차한다(합차 차량은 먼저 실은 물품까지 걸려 있어 이 화면에서는 다루지 않는다). ② 가던 길 한 구간이 막힌다 → 모든 차량이 한두 블록 돌아간다. */
function triggerEvent(R, re) {
  if (R.ev) return; lock(R); var p0 = R.plan0; if (!p0 || !p0.go) return;
  var g = p0.go, fa = g.legs.filter(function (l) { return !l.pooled && l.eta - l.tFree >= 3; }), ev = null, at;
  if (fa.length && Math.random() < 0.5) {
    var lost = fa[Math.floor(Math.random() * fa.length)]; at = Math.min(Math.max(lost.tFree + 1, Math.round((lost.tFree + lost.eta) / 2)), lost.eta - 1);
    var a2 = match(R.sc.tp, R.fleet0, { at:at, prev:p0, fault:lost.v.id });
    if (a2 && a2.go) ev = { kind:'fault', at:at, what:lost.v.id + '에 구동계 이상이 생겨 멈춤(가상)', lost:lost, after:a2 };
  }
  if (!ev) {
    var l0 = g.legs[0], extra = Math.random() < 0.5 ? 2 : 4, after = clone(p0), trs = l0.ph.filter(function (p) { return p.k === 'trip'; }), tr = trs[trs.length - 1]; at = Math.round((tr.t0 + tr.t1) / 2); after.go = detourGo(g, at, extra);
    ev = { kind:'closure', at:at, extra:extra, what:'가던 길의 한 구간이 막혀(가상) 한두 블록 돌아가야 해요', after:after };
  }
  R.ev = ev; re();
}
function s35(c) {
  var R = c.R, r = c.dec, g0 = r.go, ev = R.ev, sc = c.sc, kids = [h('div', { class:'sub', text:'운송 중에도 물류 AI는 도로와 차량 상태를 계속 받습니다. 배정 차량이 집하 전에 멈추면 그 시각의 전체 차량 상태에서 그 물량을 다시 배차하고, 가던 길의 구간이 막히면 모든 차량에 새 경로를 내려 보내요. 이 단계는 건너뛰어도 됩니다.' })];
  kids.push(h('div', { class:'rowf' }, [h('button', { type:'button', class:'btn fill', id:X('ev'), disabled:ev ? true : null, text:ev ? '사건이 발생했어요' : '운송 중 사건 일으키기 (모의)', onclick:function () { triggerEvent(R, c.re); } })]));
  if (ev) {
    var a = ev.after, n = a.go;
    if (ev.kind === 'fault') {
      var fresh = n.legs.filter(function (l) { return g0.legs.map(function (x) { return x.v.id; }).indexOf(l.v.id) < 0; });
      kids.push(form([['실시간 재배차', [['발생 시각', 'T+' + ev.at + '분 · 가상 ' + clk(sc, ev.at)], ['사건', ev.what], ['그때 상태', ev.lost.v.id + '는 집하 지점으로 가던 중이었고, 물품은 집하 지점에서 기다리는 중'], ['처리', '그 시각의 전체 차량 위치·배터리로 부피 ' + ev.lost.vol + '을 다시 맞췄어요(다른 차량은 그대로 가요)'],
        ['새 차량', fresh.map(function (l) { return l.v.id + '(' + l.v.tname + ') · 집하 T+' + l.eta + '분'; }).join(', ') || '없음', X('ev-new')], ['집하 시각 변화', 'T+' + g0.pickupAt + '분 → T+' + n.pickupAt + '분 (' + (n.pickupAt - g0.pickupAt >= 0 ? '+' : '') + (n.pickupAt - g0.pickupAt) + '분)'], ['도착 시각 변화', 'T+' + g0.arrive + '분 → T+' + n.arrive + '분'], ['멈춘 차량', ev.lost.v.id + '는 점검을 호출하고 새 일에서 빠져요']]]]));
    } else {
      var minB = Math.min.apply(null, n.legs.map(function (l) { return l.batEnd; }));
      kids.push(form([['실시간 우회', [['발생 시각', 'T+' + ev.at + '분 · 가상 ' + clk(sc, ev.at)], ['사건', ev.what], ['새 경로', '약 ' + ev.extra + 'km 돌아가요(도로 관제가 다른 차량과 겹치지 않는 구간을 새로 예약)', X('ev-new')], ['도착 시각 변화', 'T+' + g0.arrive + '분 → T+' + n.arrive + '분 (+' + (n.arrive - g0.arrive) + '분)'], ['배터리 확인', '도착 때 가장 낮은 배터리 약 ' + Math.round(minB) + '% — 충전소까지 갈 여유가 있어요']]]]));
    }
    kids.push(planList(a));
  }
  return kids;
}
function s41(c) { var sc = c.sc, g = c.fin.go, ids = boxIds(g.legs);
  return [h('div', { class:'sub', text:c.R.ev ? '운송 중 경로·차량이 바뀌었지만, 새 계획대로 수령지에 도착해요.' : '차량이 수령지에 도착해 물품을 내려요.' }),
    form([['도착과 하역', [['수령지', sc.Dn, X('s4-dest')], ['도착 시각', 'T+' + g.arrive + '분 · 가상 ' + clk(sc, g.arrive), X('s4-arrive')], ['하역한 부피', sc.n + '(적재 기록과 같아요)'], ['수령 확인', '수령지의 비서가 수량·상태를 확인하고 서명해요(가상)'], ['발송인 비서에게', '도착 안내를 보내요(가상)']]]].concat(g.legs.map(function (l, i) { return ['차량 ' + l.v.id + ' 하역 기록', [['도착', 'T+' + l.arrive + '분'], ['상자 번호', sc.no + '-' + ids[i]], ['차량 적재량', l.vol + ' → 0', X('s4-pax') + i], ['도로 관제', '이 차량이 쓰던 주행 안내선 예약을 풀어요']].concat(l.pooled ? [['함께 실었던 기존 물품', 'T+' + l.exist.arrive1 + '분에 먼저 내렸어요(원래보다 ' + l.exist.delay + '분 늦음)']] : [])]; })))]; }
function s42(c) { var sc = c.sc, g = c.fin.go, base = sc.no + '|' + sc.anon, tot = 0, rows = g.legs.map(function (l) { var km = dist(sc.P, sc.D) + (l.detour || 0), f = fareOf(sc, l); tot += f; return h('tr', {}, [h('td', {}, [h('b', { text:l.v.id }), h('div', { class:'sub', text:l.pooled ? '합차' : '전용' })]), h('td', { class:'r num', text:km + 'km' }), h('td', { class:'r num', text:l.vol }), h('td', { class:'r num', text:won(f) + ' GDC' })]); });
  return [h('div', { class:'sub', text:'운임은 집하에서 수령지까지의 거리(우회 포함)와 부피로 계산해요. 합차는 기본 운임을 기존 물품과 나눠요. 이 화면의 운임은 가상 값이며 실제 결제가 일어나지 않아요.' }),
    h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('s4-fare') }, [h('thead', {}, [h('tr', {}, ['차량', '운송 거리', '부피', '운임'].map(function (x, i) { return h('th', { class:i ? 'r' : '', text:x }); }))]), h('tbody', {}, rows)])]),
    form([['정산과 기록', [['합계', won(tot) + ' GDC(가상)', X('s4-total')], ['정산 방식', '발송인의 지갑(GDC) → 물류 시스템. 발송인의 서명으로 확정해요(가상)'], ['이용 서명', sig(base + '|PAY'), X('s4-sig1')], ['물류 AI 서명', sig(base + '|AI'), X('s4-sig2')], ['발송인의 PDV', '발송 기록이 저장돼요(가상)'], ['물류 인프라', '익명 번호로 물동량 통계만 남아요(이름 제외)']]]])]; }
var LOWBAT = 30;
function s43(c) { var sc = c.sc, g = c.fin.go, rows = g.legs.map(function (l) { var C = nearestChg(sc.D), low = l.batEnd < LOWBAT;
  return h('tr', {}, [h('td', {}, [h('b', { text:l.v.id })]), h('td', { class:'num', text:xy(sc.D) }), h('td', { class:'r num' + (low ? ' dn' : ''), text:Math.round(l.batEnd) + '%' }), h('td', { class:'r num', text:'0/' + capOf(l.v) }), h('td', { text:low ? C.name + '(' + C.km + 'km)로 보내 충전' : '유휴로 두고 다음 수요 대기' })]); });
  return [h('div', { class:'sub', text:'내려 준 차량의 위치·배터리·적재량을 갱신하고 다음 일을 정해요. 배터리가 ' + LOWBAT + '% 밑이면 새 일을 주지 않고 가장 가까운 충전소로 보냅니다.' }),
    h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('s4-veh') }, [h('thead', {}, [h('tr', {}, ['차량', '위치(km)', '배터리', '적재', '다음 일'].map(function (x, i) { return h('th', { class:i > 1 && i < 4 ? 'r' : '', text:x }); }))]), h('tbody', {}, rows)])])]; }
/** 하역이 끝난 시각의 전체 현황에서 유휴 차량이 어느 구역에 몰렸는지 보고, 한 대를 비어 있는 구역으로 미리 보낼지 정한다. */
function zoneOf(x, y) { return (x < GRID / 2 ? '서' : '동') + (y < GRID / 2 ? '북' : '남'); }
function rebalance(rows) {
  var zones = { '서북':[], '동북':[], '서남':[], '동남':[] };
  rows.forEach(function (q) { if (q.st === '유휴' || q.st === '하역 완료 · 대기') zones[zoneOf(q.x, q.y)].push(q); });
  var names = Object.keys(zones), most = names.slice().sort(function (a, b) { return zones[b].length - zones[a].length || (a < b ? -1 : 1); })[0], least = names.slice().sort(function (a, b) { return zones[a].length - zones[b].length || (a < b ? -1 : 1); })[0];
  var mover = zones[most].filter(function (q) { return q.bat >= 40; }).sort(function (a, b) { return b.bat - a.bat || (a.v.id < b.v.id ? -1 : 1); })[0] || null;
  return { zones:zones, most:most, least:least, move:zones[most].length - zones[least].length >= 2 && mover ? { v:mover.v.id, from:most, to:least } : null };
}
function s44(c) { var sc = c.sc, g = c.fin.go, T = endT(g), rows = fleetAt(c.fleet, g, c.R.ev, T), rb = rebalance(rows), base = sc.no + '|' + sc.anon, wait = g.pickupAt, ride = g.arrive - g.pickupAt;
  var tb = rows.map(function (q) { return h('tr', {}, [h('td', {}, [h('b', { text:q.v.id }), h('div', { class:'sub', text:TYPES[q.v.type].name })]), h('td', { text:q.st }), h('td', { class:'num', text:xy([q.x, q.y]) }), h('td', { class:'r num' + (q.bat < 20 ? ' dn' : ''), text:Math.round(q.bat) + '%' }), h('td', { class:'r num', text:q.cg + '/' + capOf(q.v) })]); });
  var zt = Object.keys(rb.zones).map(function (k) { return k + ' ' + rb.zones[k].length + '대'; }).join(' · ');
  return [h('div', { class:'card col hero' }, [h('div', { class:'big', id:X('s4-end'), text:'집하까지 ' + wait + '분 · 운송 ' + ride + '분 · 도착 T+' + T + '분' }), h('div', { class:'sub', text:'차량 ' + g.legs.length + '대, 부피 ' + sc.n + '의 ' + kindName(sc.acc) + ' 물품이 옮겨졌어요. 이 흐름은 모두 모의 체험이며, 물품·차량·운임·시간은 가상입니다.' })]),
    sub('하역이 끝난 시각(T+' + T + '분)의 전체 차량 현황'), h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('s4-fleet') }, [h('thead', {}, [h('tr', {}, ['차량', '상태', '위치(km)', '배터리', '적재'].map(function (x, i) { return h('th', { class:i > 2 ? 'r' : '', text:x }); }))]), h('tbody', {}, tb)])]),
    form([['다음 수요 대비', [['구역별 유휴 차량', zt, X('s4-zones')], ['재배치', rb.move ? rb.move.v + '를 ' + rb.move.from + ' 구역에서 ' + rb.move.to + ' 구역으로 미리 보내 둬요(유휴 차량이 한쪽에 몰려 있어서)' : '유휴 차량이 고르게 흩어져 있어 그대로 둬요', X('s4-rebal')], ['운송 기록 지문', sig(base + '|END'), X('s4-sig0')], ['결정 주체', '배차·경로·재배치는 물류 AI가 했어요 — 사람의 개입 없이 기록만 남아요']]]])];
}

var STAGES = ['물류 호출', '물류 AI 대응', '배차·이동', '운송·정산'];
var STEPS = [
  { id:'1-1', st:0, title:'기기 호출', desc:'폰·워치·링으로 물류 AI를 불러요', fn:s11 }, { id:'1-2', st:0, title:'메시지 구성', desc:'말·문자가 되면 함께, 아니면 “물류”만', fn:s12 },
  { id:'1-3', st:0, title:'PDV 정보 첨부', desc:'내 비서가 내 PDV에서 익명화해 붙여요', fn:s13 }, { id:'1-4', st:0, title:'디지털 서명과 전송', desc:'전체 Form에 서명을 붙여 물류 AI로', fn:s14 },
  { id:'2-1', st:1, title:'접수와 서명 확인', desc:'내용이 바뀌지 않았는지 확인해요', fn:s21 }, { id:'2-2', st:1, title:'수요 정리', desc:'수령지·물품·취급 조건을 정해요', fn:s22 },
  { id:'2-3', st:1, title:'비서에게 추가 질의', desc:'도착 마감·포장 상태를 물어요', fn:s23 }, { id:'2-4', st:1, title:'차량 현황 취합', desc:'모든 차량의 위치·경로·배터리·적재를 봐요', fn:s24 },
  { id:'2-5', st:1, title:'배차 선정', desc:'전용·분할·합차 중 총비용이 낮은 것을 골라요', fn:G(s25) }, { id:'2-6', st:1, title:'운송 계획서', desc:'차량·경로·도착·운임을 한 장으로 써요', fn:G(s26) },
  { id:'3-1', st:2, title:'지시서 발송', desc:'차량·도로 관제·비서에 동시에', fn:G(s31) }, { id:'3-2', st:2, title:'집하 지점으로 이동', desc:'배정 차량이 물품이 있는 곳으로 가요', fn:G(s32) },
  { id:'3-3', st:2, title:'적재와 집하 확인', desc:'부피를 확인하고 적재량을 갱신해요', fn:G(s33) }, { id:'3-4', st:2, title:'운송과 실시간 파악', desc:'모든 차량의 위치·속도·배터리를 봐요', fn:G(s34) },
  { id:'3-5', st:2, title:'실시간 갱신', desc:'차량이 멈추거나 길이 막히면 다시 정해요', fn:G(s35) },
  { id:'4-1', st:3, title:'하역과 수령 확인', desc:'수령지에 내리고 적재량을 갱신해요', fn:G(s41) }, { id:'4-2', st:3, title:'운임 정산과 기록', desc:'거리·부피로 계산하고 기록해요', fn:G(s42) },
  { id:'4-3', st:3, title:'차량 상태 갱신', desc:'위치·배터리를 갱신하고 다음 일을 정해요', fn:G(s43) }, { id:'4-4', st:3, title:'운송 결과와 재배치', desc:'전체 현황을 보고 유휴 차량을 미리 보내요', fn:G(s44) }
];
var PLAN_AT = 10; // 3-1(지시서 발송)을 여는 순간 계획을 확정한다


// ── 단계 이동(run 마다 따로) ──
function openStep(R, i, re) { if (i < 0 || i >= STEPS.length || i > R.reached) return; if (i >= PLAN_AT) lock(R); R.cur = i; R.seen = true; R.reached = Math.max(R.reached, Math.min(i + 1, STEPS.length - 1)); re(); }
function advance(R, re) { var i = R.cur + 1; if (i >= STEPS.length) return; R.reached = Math.max(R.reached, i); openStep(R, i, re); }

// ── 화면: 진행 막대 · 단계 목록 · 패널 ──
function progressBar() {
  var R = S.sim, cur = R.cur, wrap = h('div', { class:'bar', id:'lg-bar' });
  STAGES.forEach(function (name, si) {
    var ticks = []; STEPS.forEach(function (s, i) { if (s.st !== si) return;
      var cl = 'tick ' + (i < R.reached ? 'done' : i === R.reached ? 'next' : 'lock') + (i === cur ? ' cur' : '') + (cur >= 0 && i === cur + 1 ? ' blink slow' : '');
      ticks.push(h('button', { type:'button', class:cl, id:'lg-tick-' + s.id, 'data-i':String(i), 'aria-label':s.id + ' ' + s.title, title:s.id + ' ' + s.title, 'aria-current':i === cur ? 'step' : null, disabled:i > R.reached ? true : null, onclick:function () { pickStep(R, i); } })); });
    wrap.appendChild(h('div', { class:'bseg' }, [h('div', { class:'bname', text:(si + 1) + '. ' + name }), h('div', { class:'bticks' }, ticks)]));
  });
  return h('div', { class:'barwrap' }, [wrap, h('div', { class:'bcap', id:'lg-bar-cap', text:cur >= 0 ? (cur + 1) + ' / ' + STEPS.length + ' · ' + STEPS[cur].id + ' ' + STEPS[cur].title : '0 / ' + STEPS.length + ' · 1-1 기기 호출부터 눌러 보세요' })]);
}
/** 새 사건을 뽑은 뒤 지금 무엇을 하면 되는지 알려 주는 배너. */
function nextHint() {
  var R = S.sim; if (!R.picked) return null;
  var last = R.cur === STEPS.length - 1, t = R.cur < 0 ? (!R.seen ? '새 수요가 뽑혔어요. 다음 할 일: 아래 단계 목록에서 깜박이는 “1-1 기기 호출”을 눌러 시작하세요.' : '다음 할 일: 단계 목록에서 “' + STEPS[R.reached].id + ' ' + STEPS[R.reached].title + '”을 눌러 이어 가세요. 이미 연 단계는 다시 볼 수 있어요.')
    : last ? '끝까지 봤어요. 다음 할 일: “새 수요 뽑기”를 눌러 다른 수요로 다시 해 보세요.' : '다음 할 일: 아래에서 천천히 깜박이는 “' + STEPS[R.cur + 1].id + ' ' + STEPS[R.cur + 1].title + '” 단계를 눌러 한 단계씩 따라가세요.';
  return h('div', { class:'note info hintbn', id:'lg-next-hint', role:'status', text:t });
}
function summaryCard() {
  var sc = S.sim.sc;
  return h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'무작위 가상 수요' }), h('div', { class:'rowf' }, [pill(sc.devName, 'm'), pill(sc.inc.kind, 'p'), pill(sc.inc.name), pill(sc.placeName)]),
    h('div', { class:'sub', id:'lg-draw-sum', text:'기기·물품·집하 지점·수령지를 무작위로 뽑았어요. 아래 목록에서 단계를 누르면 그 단계 바로 아래에 결과가 펼쳐져요. 처음부터 저절로 보려면 오른쪽 위의 시뮬레이션 버튼을 누르세요.' }),
    h('div', { class:'rowf' }, [h('button', { type:'button', class:'btn tonal' + (S.sim.picked ? '' : ' blink'), id:'lg-draw', text:'새 수요 뽑기', onclick:function () { S.sim = newRun(); S.sim.picked = true; S.wasOpen = false; render(); } }), btn('물류 AI에게 묻기', 'quiet', function () { ask('합차는 어떻게 정하나요?'); })]), nextHint()]);
}
function stepList() {
  var R = S.sim, out = h('div', { id:'lg-list', class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'단계 목록 (' + STEPS.length + '단계)' }), h('div', { class:'sub', text:'앞 단계를 연 뒤에 다음 단계를 열 수 있어요. 이미 연 단계는 언제든 다시 볼 수 있습니다.' })]);
  STAGES.forEach(function (name, si) {
    out.appendChild(h('div', { class:'lab', text:(si + 1) + '. ' + name }));
    STEPS.forEach(function (s, i) { if (s.st !== si) return;
      var state = i === R.cur ? '보는 중' : i < R.reached ? '완료' : i === R.reached ? '열기' : '잠김', hintRow = R.picked && R.cur < 0 && !R.seen && i === 0;
      out.appendChild(h('button', { type:'button', class:'srow' + (i === R.cur ? ' cur' : '') + (hintRow ? ' blink' : '') + (R.cur >= 0 && i === R.cur + 1 ? ' blink slow' : ''), id:'lg-row-' + s.id, 'data-i':String(i), disabled:i > R.reached ? true : null, 'aria-current':i === R.cur ? 'step' : null, onclick:function () { pickStep(R, i); } },
        [h('span', { class:'sid', text:s.id }), h('span', { class:'stx' }, [h('b', { text:s.title }), h('span', { text:s.desc })]), h('span', { class:'sst', text:state })]));
      if (i === R.cur) { var ip = inlinePanel(); if (ip) out.appendChild(ip); } });
  });
  return out;
}
/** 단계 아래로 펼쳐지는 페이지 안 패널. 오른쪽 시뮬레이션 패널(#lg-apanel)과는 서로 아무 관계가 없다. */
function inlinePanel() {
  var R = S.sim; if (R.cur < 0) return null;
  var st = STEPS[R.cur], c = ctx(R, render), last = R.cur === STEPS.length - 1, pb0 = $('lg-pbody'), ps = pb0 ? pb0.scrollTop : 0, fresh = !S.wasOpen || S.lastOpen !== R.cur;
  S.wasOpen = true; S.lastOpen = R.cur; PF = 'lg-';
  var body = h('div', { class:'pbody col', id:'lg-pbody' }, st.fn(c).filter(Boolean));
  var pn = h('div', { id:'lg-ipanel', class:'ipanel' + (fresh ? ' anim' : ''), role:'region', 'aria-label':st.id + ' ' + st.title + ' 결과' }, [
    h('div', { class:'phead' }, [h('div', { style:'flex:1;min-width:0' }, [h('div', { class:'sub', id:'lg-ph-n', text:'직접 따라가기 · 단계 ' + (R.cur + 1) + ' / ' + STEPS.length + ' · ' + STAGES[st.st] }), h('b', { id:'lg-ph-t', text:st.id + ' ' + st.title })]), h('button', { type:'button', class:'btn quiet sm', id:'lg-pclose', text:'닫기', onclick:function () { closeStep(R); } })]),
    body,
    h('div', { class:'pfoot' }, [h('button', { type:'button', class:'btn quiet', id:'lg-prev', text:'◀ 이전', disabled:R.cur === 0 ? true : null, onclick:function () { pickStep(R, R.cur - 1); } }),
      last ? h('button', { type:'button', class:'btn fill', id:'lg-again', text:'새 수요로 다시', onclick:function () { S.sim = newRun(); S.wasOpen = false; render(); try { window.scrollTo(0, 0); } catch (x) {} } }) : null])]);
  body.scrollTop = ps; return pn;
}
// ── 부드러운 전환: 눌린 단계를 진행 막대 바로 아래로 올리고, 새 패널은 높이가 늘어나며 아래 단계를 밀어 내린다 ──
var MOVE_MS = 350;
function calm() { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
function noIds(el) { el.removeAttribute('id'); [].forEach.call(el.querySelectorAll('[id]'), function (x) { x.removeAttribute('id'); }); el.setAttribute('aria-hidden', 'true'); el.classList.remove('anim'); }
/** 지금 열린 패널을 본떠 두었다가, 다시 그린 뒤 같은 자리에서 접히게 한다. */
function ghostOf() { var old = $('lg-ipanel'), R = S.sim; if (!old || R.cur < 0) return null; return { el:old.cloneNode(true), h:old.offsetHeight, rowId:'lg-row-' + STEPS[R.cur].id }; }
function settle(mv) {
  var np = $('lg-ipanel'), row = mv.rowId ? $(mv.rowId) : null, bw = M && M.querySelector('.barwrap'), ok = !calm();
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
  S.move.rowId = 'lg-row-' + STEPS[i].id; openStep(R, i, render);
}
function closeStep(R) { S.move = { ghost:ghostOf() }; R.cur = -1; S.wasOpen = false; render(); }

// ── 자동 시뮬레이션(오른쪽 위 버튼): 자기만의 수요와 진행 상태를 쓰므로 화면의 단계 목록과 섞이지 않는다 ──
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
  var pn = $('lg-apanel'), bk = $('lg-back'), a = S.auto; if (!pn || !bk) return;
  if (!a) { pn.textContent = ''; pn.className = 'panel auto'; pn.setAttribute('aria-hidden', 'true'); bk.className = 'back'; return; }
  var R = a.R, st = STEPS[R.cur], c = ctx(R, renderAuto), last = R.cur === STEPS.length - 1, done = last && !a.playing, pb0 = $('lg-au-body'), ps = a.top || !pb0 ? 0 : pb0.scrollTop;
  pn.textContent = ''; pn.className = 'panel auto open' + (a.closing ? ' closing' : !a.shown ? ' anim' : ''); pn.setAttribute('aria-hidden', 'false'); bk.className = 'back' + (a.closing ? '' : ' on'); a.shown = true; a.top = false;
  pn.appendChild(h('div', { class:'phead' }, [h('div', { style:'flex:1;min-width:0' }, [h('div', { class:'sub', id:'lg-au-n', text:'시뮬레이션 · 단계 ' + (R.cur + 1) + ' / ' + STEPS.length + ' · ' + STAGES[st.st] + (a.playing ? ' · 자동 진행 중' : done ? ' · 끝' : ' · 멈춤') }), h('b', { id:'lg-au-t', style:'font-size:17px', text:st.id + ' ' + st.title })]), h('button', { type:'button', class:'btn quiet sm', id:'lg-au-close', text:'닫기', onclick:closeAuto })]));
  var mini = h('div', { class:'mini', id:'lg-au-mini', 'aria-hidden':'true' }); STEPS.forEach(function (s, i) { mini.appendChild(h('i', { class:(i < R.cur ? 'done' : i === R.cur ? 'cur' : '') + (i > 0 && STEPS[i - 1].st !== s.st ? ' gap' : '') })); });
  pn.appendChild(mini);
  PF = 'lg-au-'; var kidsA; try { kidsA = st.fn(c).filter(Boolean); } finally { PF = 'lg-'; }
  var body = h('div', { class:'pbody col', id:'lg-au-body' }, kidsA); pn.appendChild(body);
  pn.appendChild(h('div', { class:'pfoot' }, [h('button', { type:'button', class:'btn quiet', id:'lg-au-pause', text:a.playing ? '⏸ 멈추기' : last ? '끝났어요' : '▶ 이어서', disabled:last && !a.playing ? true : null, onclick:autoToggle }), h('button', { type:'button', class:'btn fill', id:'lg-au-restart', text:'↻ 새 무작위 수요', onclick:autoRestart })]));
  body.scrollTop = ps;
}
function render() {
  var root = $('lg-root'), tp = $('lg-top'); if (!root || !tp) return;
  var y = 0; try { y = window.pageYOffset || 0; } catch (e) {}
  root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = head('물류', '도시 어디서든 폰·나비웹 워치·링(팔찌)의 조작 한 번으로 부르면, 물류 AI가 모든 자율주행 화물차의 위치·경로·배터리·싣고 있는 물품을 보고 가장 알맞은 차량을 보내 수령지까지 옮깁니다. 무작위 가상 수요 하나를 호출부터 하역·정산까지 단계별로 따라가 보세요.');
  kids.push(mockNote('모의 체험입니다. 아무것도 전송·호출되지 않고 차량도 움직이지 않아요. 물품·차량·경로·시간·운임은 모두 가상 값이며, 속도·배터리 소모·운임·합차 한도는 가정입니다.'));
  kids.push(progressBar(), prepSection(), agentCard(), summaryCard(), stepList());
  kids.forEach(function (k) { if (k) root.appendChild(k); });
  if (y) { try { window.scrollTo(0, y); } catch (e) {} }
  var mv = S.move; S.move = null; if (mv) settle(mv);
}
function reply(ok, msg) { emit('result', { ok:ok, msg:msg }); }
function go(v) {
  var a = ANCH[v]; if (!a) return false;
  if (a === 'lg-s-prep') S.prepOpen = true;
  render(); var e = $(a) || $('lg-s-call'); try { if (e) e.scrollIntoView({ block:'start' }); } catch (x) {}
  return true;
}
function nav(a) {
  var d = a && typeof a['do'] === 'string' ? a['do'] : '';
  if (go(d)) return reply(true, d === 'prep' || d === 'devices' || d === 'consent' ? '평소 준비 구역으로 이동했습니다.' : d === 'call' ? '수요 정하기 구역으로 이동했습니다.' : '흐름 구역으로 이동했습니다.');
  return reply(false, '지원하지 않는 요청입니다.');
}
function mount(el, o) {
  if (!el) return; o = o || {};
  autoClear(); S.auto = null; M = el; el.textContent = ''; el.classList.add('lgs'); S.share = {}; S.askok = {}; S.dev = []; S.err = {}; S.msg = ''; S.prepOpen = false; S.sim = newRun(); S.wasOpen = false; load();
  [h('div', { id:'lg-top' }), h('div', { class:'wrap', id:'lg-root' }), h('div', { id:'lg-back', class:'back', onclick:closeAuto }), h('aside', { id:'lg-apanel', class:'panel auto', 'aria-hidden':'true', 'aria-label':'시뮬레이션' })].forEach(function (x) { el.appendChild(x); });
  if (o.view && ANCH[o.view] && o.view !== 'call') go(o.view); else render();
}
window.NaviLogistics = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M) go(v); },
  callMessage:callMessage, draw:draw, verify:verify, gather:gather, match:match, newFleet:newFleet, stateAt:stateAt, fleetAt:fleetAt, detourGo:detourGo, rebalance:rebalance, planText:planText, devSummary:devSummary, sharedItems:sharedItems, agentResult:function (ok, msg) { if (M) agentResult(!!ok, msg); },
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();

