/* police-app.js — 나비웹 치안(인프라 AI · 치안). desktop.html 안에 직접 그려 넣는다(iframe 없음).
* 사용: NaviPolice.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
* 모양은 police.css(.pol 범위). 전역은 NaviPolice 하나만 쓴다.
*
* 응급 페이지와 같은 레이아웃(2026-11-25): 한 페이지, 탭 없음. 평소 준비(기기·보내는 정보) 아래에서 무작위 가상 범죄 하나를
*   4단계·19개 세부 단계(1-1~4-4)로 따라간다. 위치는 상단 진행 막대, 차례는 단계 목록, 결과는 눌린 단계 바로 아래로 펼쳐지는 패널.
*   앞 단계를 연 뒤에만 다음 단계를 열 수 있고, 열린 단계 바로 다음 단계의 막대가 천천히 깜박인다.
*   3-1(지시서 발송)을 열면 배치 계획과 그때의 근무 현황이 굳고, 3-5 에서 용의자가 이동하면 그 시각의 위치에서 다시 배치한다(4단계는 새 계획을 따른다).
*   오른쪽 위 시뮬레이션 버튼은 별도의 무작위 사건을 1-1부터 자동으로 보여 주며, 화면의 단계 목록과 상태를 공유하지 않는다.
*
* 치안은 사고가 아니라 범죄다(주피터 지시, 2026-11-25). 응급과 다른 점:
* 1. 가해자가 있고 가까이에 있을 수 있다 → 신고는 소리 없이 가장 단순한 조작 한 번으로 한다(말·문자가 되면 함께, 아니면 오직 '치안' 메시지만).
* 2. 목표가 둘이다 → 피해자 안전 확보(가장 빨리 닿는 팀)와 용의자 확보(위험하면 두 번째 팀). 위험이 낮으면 한 팀이 겸한다.
* 3. 치안 인프라가 주변 CCTV를 직접 제어해 상황을 파악하고, 급박한 생명·신체 위험일 때만 법적 요건을 확인해 주변 단말의 위치·통신 사실로 용의자 후보를 좁힌다.
*    급박하지 않으면 그 조회를 하지 않고 영장 신청서 초안만 만든다. 조회 내역은 변경 불가 기록으로 남기고 감독 기관에 보고하며 대상자에게 알린다.
* 4. 용의자의 신원 정보는 후보일 뿐이다 → 출동 팀과 인근 경찰서·파출소에만 전달하고, 확인·체포·구속은 경찰관이 판단한다. 치안 AI는 결정하지 않는다.
* 5. 용의자는 움직인다 → 3-5 에서 용의자가 달아나면 그 시각의 위치에서 확보 팀을 다시 정하고, 여유 팀이 없으면 CCTV 추적과 인근 관할 수배로 잇는다.
* 6. 피해자의 나만의 AI 비서가 위치·성명·과거 신고 기록 등을 치안 AI에 보내고, 치안 AI는 비서에게 추가로 물을 수 있다(예: 용의자의 인상착의, 아는 사이인지).
*
* 무엇이 실제이고 무엇이 아닌가(화면에도 한 줄로 적는다):
* - 위 원칙은 설계 단계이고 이 화면은 모의 체험이다. 기기·CCTV·경찰 시스템에 연결되어 있지 않고 어떤 것도 전송·조회·출동하지 않는다. 실제 위급 상황은 112(응급은 119)에 직접 연락해야 한다.
* - 인물·장소·팀·CCTV·이동 시간은 모두 가상 값이며 메모리 안에서만 계산한다(저장하지 않는다). 용의자 후보도 가상의 이름표일 뿐 실제 사람을 특정하지 않는다.
* - 개인의 위치·통신 기록을 조회하는 요건은 법률과 감독 절차로 정해야 하는 부분이다. 이 화면의 요건은 설계 단계의 가정이다.
* - 내 기기·보내는 정보는 사용자가 직접 정하는 기록이고 이 브라우저(localStorage)에만 저장된다.
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
var KEY = 'navi-pol-v1', MAXD = 20;
var DEVICES = [['phone', '폰'], ['watch', '나비웹 워치'], ['ring', '링(팔찌)']];
var DEVKINDS = DEVICES.map(function (d) { return d[1]; });
/** 내 비서가 치안 AI에 보내는 정보. 위치는 출동에 꼭 필요해 항상 포함하고, 나머지는 항목마다 직접 정한다. */
var SEND = [['loc', '현재 위치'], ['name', '성명'], ['age', '나이'], ['kin', '비상 연락처'], ['prior', '과거 신고·접근금지 기록'], ['vitals', '생체 정보(심박 등)'], ['media', '주변 소리·영상']];
/** 치안 AI가 내 비서에게 추가로 물을 수 있는 것(예시). 항목마다 답해도 되는지 직접 정한다. */
var ASKS = [['look', '용의자의 인상착의'], ['know', '용의자와 아는 사이인지']];
var CALLS = [['voice', '말할 수 있음'], ['text', '문자를 입력할 수 있음'], ['none', '둘 다 어려움']];
var ANCH = { call:'pol-list', flow:'pol-list', follow:'pol-list', match:'pol-list', prep:'pol-s-prep', devices:'pol-s-prep', consent:'pol-s-prep' };
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
function mockNote(t) { return h('div', { class:'note info', id:'pol-mock', style:'margin:16px 0', text:t }); }

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

/** 치안 호출 메시지: 말할 수 있으면 음성, 문자를 입력할 수 있으면 문자를 함께 보내고, 그 밖에는 오직 '치안'만 보낸다. 가해자가 가까이 있을 수 있어 소리·진동 없이 보낸다. */
function callMessage(can, said) {
  var t = clean(said, 120);
  if (can === 'voice') return { mode:'voice', label:'음성 + 치안', body:t || '(말한 내용이 음성으로 전달됩니다)', flag:'치안', only:false };
  if (can === 'text') return { mode:'text', label:'문자 + 치안', body:t || '(입력한 문자가 전달됩니다)', flag:'치안', only:false };
  return { mode:'none', label:'치안', body:'', flag:'치안', only:true };
}
function sharedItems(share) { return SEND.filter(function (f) { return f[0] === 'loc' || share[f[0]]; }).map(function (f) { return f[1]; }); }
function askItems(askok) { return ASKS.filter(function (f) { return askok[f[0]]; }).map(function (f) { return f[1]; }); }
function devSummary(list, today) {
  var t0 = today ? Date.parse(today + 'T00:00:00Z') : NaN, due = 0, carry = 0, by = {};
  list.forEach(function (x) { by[x.kind] = (by[x.kind] || 0) + 1; if (x.carry) carry++; if (x.chk && isFinite(t0) && Date.parse(x.chk + 'T00:00:00Z') <= t0) due++; });
  return { count:list.length, carry:carry, by:by, due:due };
}

// ── 출동 팀 배치(가상 값) ──
// 팀 = 경찰관 + 차량. 자율주행 치안차량은 대기 중이라 바로 출발하고, 파출소 근무조는 출동 준비(PREP)가 든다.
var UNITS = [['U1', '자율주행 치안차량 1', 5, 6, 'car'], ['U2', '자율주행 치안차량 2', 12, 8, 'car'], ['U3', '자율주행 치안차량 3', 8, 13, 'car'],
  ['T1', '가상 중앙 파출소 근무조', 4, 4, 'team'], ['T2', '가상 해안 파출소 근무조', 14, 5, 'team'], ['T3', '가상 산악 파출소 근무조', 6, 15, 'team']];
var PLACES = [['p1', '가상 마을 가', 3, 5, 10, 2], ['p2', '가상 마을 나', 13, 9, 18, 15], ['p3', '가상 마을 다', 9, 16, 2, 18], ['p4', '가상 마을 라', 16, 12, 6, 6]];   // [id, 이름, x, y, 용의자가 달아날 곳 x, y]
var PREP = 2;       // 파출소 근무조가 출동 준비하는 시간(분, 가정)
var TURN = 3;       // 다른 일을 하던 팀을 돌려 보내는 시간(분, 가정)
var AID = 9;        // 인근 관할이 지원을 오는 시간(분, 가정)
function newUnits() { return UNITS.map(function (u) { return { id:u[0], name:u[1], x:u[2], y:u[3], kind:u[4], free:true }; }); }
function dist(a, b) { return Math.max(1, Math.round(Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2)))); }   // 1km = 1분(가정)
function lerp(a, b, f) { return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; }
function prepOf(u) { return u.kind === 'team' ? PREP : 0; }
function byEta(a, b) { return a.eta - b.eta || a.u.id.localeCompare(b.u.id); }
/** 신고 위치에서 피해자에게 가장 빨리 닿는 팀(lead)을 정하고, 위험이 낮지 않으면 용의자 위치로 갈 두 번째 팀(second)을 정한다.
*  위험이 낮거나 여유 팀이 하나뿐이면 한 팀이 겸한다(solo). 비어 있는 팀이 없으면 가장 가까운 팀을 다른 일에서 돌려 보내고 인근 관할에 지원을 요청한다(reassign, fb).
*  live({ at, prev })를 주면 용의자가 달아난 뒤(T+at분)에 다시 계산한다. 피해자 쪽 lead 는 그대로 가고, 용의자 쪽 second 만 그 시각의 위치에서 새 목적지(달아난 곳)까지 걸리는 시간으로
*  다시 고른다. 이미 가고 있는 팀은 준비 없이 방향만 바꾸고, 모든 시각은 처음 신고 때부터 센 절대 시각이다. 여유 팀이 없으면 CCTV 추적과 수배(track)로 잇는다. */
function match(crimeKey, placeKey, units, live) {
  var cr = CRIMES[crimeKey], pl = PLACES.filter(function (p) { return p[0] === placeKey; })[0]; if (!cr || !pl) return null;
  var P = [pl[2], pl[3]], Fl = [pl[4], pl[5]], S0 = cr.sus === 'fled' ? lerp(P, Fl, 0.3) : P, at = live ? live.at : 0, pg = live && live.prev ? live.prev.go : null;
  var why = [], free = units.filter(function (u) { return u.free; });
  units.forEach(function (u) { if (!u.free) why.push([u.name, '다른 출동 중이에요']); });
  var options = free.map(function (u) { return { u:u, eta:dist([u.x, u.y], P) + prepOf(u) }; }).sort(byEta), go = null, fb = null;
  function pack(lead, second, extra) { var o = { kind:second ? 'pair' : 'solo', lead:lead, second:second, start:lead.eta, contain:second ? second.eta : lead.eta, S:S0, track:false, aid:null }; var k; for (k in (extra || {})) o[k] = extra[k]; return o; }
  if (!live) {
    var lead = options[0] || null, second = null;
    if (lead && cr.risk !== '낮음') { var rest = free.filter(function (u) { return u !== lead.u; }).map(function (u) { return { u:u, eta:dist([u.x, u.y], S0) + prepOf(u) }; }).sort(byEta); second = rest[0] || null; }
    if (lead) go = pack(lead, second);
    else {
      var c = units.map(function (u) { return { u:u, eta:dist([u.x, u.y], P) + prepOf(u) + TURN }; }).sort(byEta)[0];
      fb = { kind:'reassign', lead:c, second:{ u:{ id:'AID', name:'인근 관할 지원' }, eta:c.eta + AID }, start:c.eta, contain:c.eta + AID, S:S0, track:false, aid:c.eta + AID };
    }
  } else if (pg) {
    var L = pg.lead, P2 = pg.second, cand = [];
    function posOf(u) { var S1 = u.id === (P2 && P2.u.id) ? S0 : null; if (!S1) return [u.x, u.y]; var d = dist([u.x, u.y], S1), run = Math.max(0, at - prepOf(u)); return lerp([u.x, u.y], S1, Math.min(1, run / d)); }
    free.forEach(function (u) { if (u === L.u || u.id === L.u.id) return; var en = !!(P2 && P2.u.id === u.id); cand.push({ u:u, eta:at + (en ? 0 : prepOf(u)) + dist(posOf(u), Fl) }); });
    cand.sort(byEta); var ns = cand[0] || null;
    go = { kind:ns ? 'pair' : 'solo', lead:L, second:ns, start:L.eta, contain:ns ? ns.eta : null, S:Fl, track:!ns, aid:pg.aid };
  }
  return { crime:cr, place:pl, options:options, go:go || fb, best:go, fb:fb, why:why, at:at, P:P, S:go ? go.S : S0 };
}
function planText(r) {
  var g = r.go; if (!g) return [];
  var s = [], cr = r.crime;
  if (r.at) s.push('용의자가 ' + r.at + '분에 달아나, 피해자 쪽 ' + g.lead.u.name + '은 계속 현장으로 가고 용의자 쪽 배치만 새로 짜요.');
  else if (g.kind === 'reassign') s.push('지금 비어 있는 팀이 없어, 가장 가까운 ' + g.lead.u.name + '을 다른 일에서 돌려 보내요(돌리는 시간 ' + TURN + '분 포함, ' + g.lead.eta + '분 뒤 현장 도착).');
  else s.push('신고 위치(' + r.place[1] + ')에서 피해자에게 가장 빨리 닿는 ' + g.lead.u.name + '(' + g.lead.eta + '분)을 보내 피해자 안전부터 확보해요.');
  if (g.kind === 'reassign') s.push('인근 관할에도 지원을 요청해요(' + g.aid + '분 뒤 도착). 지원이 오면 용의자 쪽을 맡아요.');
  else if (g.second) s.push(g.second.u.name + '(' + g.second.eta + '분)은 ' + (r.at ? '용의자가 달아난 곳' : cr.sus === 'fled' ? '용의자가 달아난 방향' : '현장 근처') + '으로 보내 용의자 확보를 맡아요' + (r.at ? '.' : g.second.u.kind === 'team' ? '(출동 준비 ' + PREP + '분 포함).' : '(대기 중이라 바로 출발).'));
  else if (g.track) s.push('용의자를 따라갈 여유 팀이 없어, CCTV 추적과 인근 관할 수배로 이어 가요. 여유 팀이 생기면 바로 보내요.');
  else s.push(cr.risk === '낮음' ? '위험이 낮아 한 팀이 피해자 확인과 용의자 수배를 함께 맡아요.' : '여유 팀이 하나뿐이라 한 팀이 둘을 겸하고, 두 번째 팀이 비는 대로 보내요.');
  s.push('현장 CCTV 영상과 용의자 이동 경로는 팀에 실시간으로 보내요. 용의자 확인·체포 여부는 경찰관이 판단하고, 치안 AI는 결정하지 않아요.');
  return s;
}
function mapSvg(r, units) {
  var K = 11, W = 20 * K + 20, ns = 'http://www.w3.org/2000/svg';
  function e(t, a, tx) { var n = document.createElementNS(ns, t), k; for (k in a) n.setAttribute(k, a[k]); if (tx != null) n.textContent = tx; return n; }
  var svg = e('svg', { viewBox:'0 0 ' + W + ' ' + W, role:'img', 'aria-label':'가상 지도: 출동 팀, 신고 위치, 용의자 위치와 선택된 이동 경로', style:'width:100%;max-width:440px;border:1px solid var(--line);border-radius:12px;background:var(--soft)' });
  function X(v) { return 10 + v * K; }
  var g = r.go, P = r.P, S1 = r.S;
  if (g) {
    svg.appendChild(e('line', { x1:X(g.lead.u.x), y1:X(g.lead.u.y), x2:X(P[0]), y2:X(P[1]), stroke:'#1A5FB4', 'stroke-width':2.5 }));
    if (g.second && g.second.u.x != null) svg.appendChild(e('line', { x1:X(g.second.u.x), y1:X(g.second.u.y), x2:X(S1[0]), y2:X(S1[1]), stroke:'#1E7B46', 'stroke-width':2.5, 'stroke-dasharray':'5 3' }));
  }
  units.forEach(function (u) { var on = g && (u.id === g.lead.u.id || (g.second && g.second.u.id === u.id)); svg.appendChild(e(u.kind === 'car' ? 'polygon' : 'rect', u.kind === 'car' ? { points:X(u.x) + ',' + (X(u.y) - 6) + ' ' + (X(u.x) - 5) + ',' + (X(u.y) + 4) + ' ' + (X(u.x) + 5) + ',' + (X(u.y) + 4), fill:on ? '#1A5FB4' : u.free ? '#9AA3B2' : '#D5D9E0' } : { x:X(u.x) - 6, y:X(u.y) - 6, width:12, height:12, rx:3, fill:on ? '#1A5FB4' : '#fff', stroke:u.free ? '#49505A' : '#B8BEC9' })); svg.appendChild(e('text', { x:X(u.x), y:X(u.y) - 9, 'text-anchor':'middle', 'font-size':8, fill:'#49505A' }, u.id)); });
  if (S1 && (S1[0] !== P[0] || S1[1] !== P[1])) { svg.appendChild(e('polygon', { points:X(S1[0]) + ',' + (X(S1[1]) - 6) + ' ' + (X(S1[0]) + 6) + ',' + X(S1[1]) + ' ' + X(S1[0]) + ',' + (X(S1[1]) + 6) + ' ' + (X(S1[0]) - 6) + ',' + X(S1[1]), fill:'#B86E00' })); svg.appendChild(e('text', { x:X(S1[0]) + 9, y:X(S1[1]) + 4, 'font-size':9, fill:'#B86E00' }, '용의자')); }
  svg.appendChild(e('circle', { cx:X(P[0]), cy:X(P[1]), r:6, fill:'#C9302C' })); svg.appendChild(e('text', { x:X(P[0]) + 9, y:X(P[1]) + 4, 'font-size':9, fill:'#C9302C' }, '신고'));
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

function setSimBtn() { var b = $('pol-sim'); if (b) b.disabled = !!S.auto; }
function topbar() { return h('div', { class:'topin' }, [h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 치안' })])]), h('button', { type:'button', class:'btn tonal simbtn', id:'pol-sim', text:'🧪 시뮬레이션', 'aria-label':'자동 시뮬레이션 열기', disabled:S.auto ? true : null, onclick:openAuto })]); }
function kv(k, v, id) { return h('div', { class:'kv' }, [h('span', { text:k }), h('b', { id:id || null, text:v })]); }
function step(n, title, kids, id) {
  return h('div', { class:'card col', id:id || null, style:'margin-top:16px' }, [h('div', { class:'rowf' }, [pill(String(n), 'm'), h('b', { style:'font-size:17px', text:title })])].concat(kids));
}

// ── 평소 준비: 내 기기 ──
function devicesBody() {
  var m = devSummary(S.dev, kst()), f = S.form, e = S.err, kids = [];
  kids.push(h('b', { style:'font-size:16px', text:'내 기기' }));
  kids.push(h('div', { class:'sub', text:'폰·나비웹 워치·링(팔찌) 중 적어도 하나를 24시간 가까이 두어야 치안 신고가 가능합니다. 직접 적는 기록이며, 기기가 나비웹에 연결되는 기능은 아직 없어요.' }));
  kids.push(h('div', { class:'g4' }, [tile('등록한 기기', m.count + '개', '', 'pol-d0'), tile('24시간 가까이 두는 기기', m.carry + '개', m.carry ? '' : '하나 이상 필요해요', 'pol-d2'), tile('점검일 지남·오늘', m.due + '개', '', 'pol-d1')]));
  kids.push(h('div', { class:'frm' }, [sel('pol-dk', '종류', f.kind, DEVKINDS.map(function (k) { return [k, k]; }), function (v) { f.kind = v; }), field('pol-dn', '기기 이름', f.name, { err:e.name, ph:'예: 내 폰', max:40, set:function (v) { f.name = v; } }), field('pol-dc', '다음 점검·충전일(선택)', f.chk, { err:e.chk, ph:'2027-01-31', mode:'numeric', max:10, set:function (v) { f.chk = v.trim(); } })]));
  kids.push(h('label', { class:'chk', for:'pol-dcarry' }, [(function () { var c = h('input', { type:'checkbox', id:'pol-dcarry', checked:f.carry !== false ? true : false }); c.onchange = function () { f.carry = c.checked; }; return c; })(), h('span', { text:'24시간 가까이 둡니다' })]));
  kids.push(h('div', { class:'rowf' }, [btn('기록하기', 'fill', addDev), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null]));
  if (!S.dev.length) kids.push(h('div', { class:'empty', text:'아직 등록한 기기가 없어요.' }));
  else kids.push(h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['종류', '이름', '24시간', '점검일', ''].map(function (t) { return h('th', { text:t }); }))]),
    h('tbody', {}, S.dev.map(function (x) { return h('tr', {}, [h('td', {}, [pill(x.kind)]), h('td', {}, [h('b', { text:x.name })]), h('td', { text:x.carry ? '예' : '아니요' }), h('td', { class:'num', text:x.chk || '—' }), h('td', { class:'r' }, [btn('삭제', 'sm quiet', function () { S.dev = S.dev.filter(function (y) { return y.id !== x.id; }); S.msg = '삭제했어요.'; save(); render(); })])]); }))])]));
  return h('div', { class:'col' }, kids);
}

// ── 평소 준비: 보내는 정보 ──
function consentBody() {
  var n = h('span', { class:'sub', id:'pol-c-n' }), n2 = h('span', { class:'sub', id:'pol-a-n' });
  function tally() { n.textContent = '보내기로 고른 항목 ' + Object.keys(S.share).length + ' / ' + (SEND.length - 1) + ' (현재 위치 제외)'; n2.textContent = '답해도 되는 질문 ' + Object.keys(S.askok).length + ' / ' + ASKS.length; }
  function list(items, store, pre, fixedKey) {
    return h('div', {}, items.map(function (f) { var id = pre + f[0], cb = h('input', { type:'checkbox', id:id, checked:f[0] === fixedKey || store[f[0]] ? true : false, disabled:f[0] === fixedKey ? true : null });
      cb.onchange = function () { if (cb.checked) store[f[0]] = 1; else delete store[f[0]]; save(); tally(); sumUpdate(); }; return h('label', { class:'chk', for:id }, [cb, h('span', { text:f[1] + (f[0] === fixedKey ? ' (항상 포함)' : '') })]); }));
  }
  var box = h('div', { class:'col' }, [h('b', { style:'font-size:16px', text:'내 비서가 치안 AI에 보낼 정보' }),
    h('div', { class:'sub', text:'현재 위치는 출동에 꼭 필요해 항상 포함됩니다. 나머지는 항목마다 직접 정하고, 고른 상태는 이 브라우저에만 저장돼요. 아래 시뮬레이션은 이 선택과 상관없이 모든 항목을 보낸 경우를 보여 줍니다.' }),
    n, list(SEND, S.share, 'pol-sh-', 'loc'), h('div', { class:'rowf' }, [btn('모두 해제', 'quiet', function () { S.share = {}; save(); render(); })]),
    h('b', { style:'font-size:16px;margin-top:8px', text:'치안 AI가 내 비서에게 추가로 물어도 되는 것' }), n2, list(ASKS, S.askok, 'pol-ak-', null), h('div', { class:'sub', text:'예시입니다. 내 비서는 허용한 질문에만 내 기록을 바탕으로 답해요. 아래 시뮬레이션은 비서가 모두 답한 경우를 보여 줍니다.' })]);
  tally(); return box;
}
function prepSummary() { var m = devSummary(S.dev, kst()); return '평소 준비 — 기기 ' + m.count + '개(24시간 가까이 ' + m.carry + '개) · 보내는 정보 ' + sharedItems(S.share).length + '항목 · 허용한 질문 ' + askItems(S.askok).length + '개'; }
function sumUpdate() { var s = $('pol-prep-sum'); if (s) s.textContent = prepSummary(); }
function prepSection() {
  var det = h('details', { id:'pol-s-prep', class:'card', style:'margin-top:16px' }, [h('summary', { id:'pol-prep-sum', style:'cursor:pointer;font-weight:700;font-size:17px', text:prepSummary() }),
    h('div', { class:'col', style:'margin-top:16px;gap:24px' }, [devicesBody(), consentBody()])]);
  det.open = !!S.prepOpen; det.ontoggle = function () { S.prepOpen = det.open; };
  return det;
}

// ── 가상 범죄(무작위) ──
/** 기기·범죄·신고자·위치를 무작위로 뽑는다. rng 를 넘기면 같은 값이 나온다(시험용). */
var INCIDENTS = [
  { id:'assault', kind:'폭력', name:'폭행(진행 중)', say:'누가 때리고 있어요', can:'voice', est:'폭행 진행 중 의심', conf:'높음', urgent:true, risk:'중간', sus:'onscene', age:[22, 48], prior:['과거 신고 기록 없음'], vit:'심박 132회/분(빠름) · 비명 소리 감지',
    see:'남성 1명이 다른 사람을 밀치고 때리는 장면(영상 분석 신뢰도 90%)', onsite:'피해자와 용의자를 떼어 놓고 안전을 확보하며, 다친 곳이 있으면 응급 AI에 연계', look:'키 큰 남성, 검은 점퍼', know:'아니요, 처음 보는 사람',
    asks:[['용의자의 인상착의는?', '검은 점퍼를 입은 키 큰 남성(가상)'], ['용의자와 아는 사이인가요?', '아니요, 처음 보는 사람(가상)']] },
  { id:'knife', kind:'폭력', name:'흉기 위협', say:'', can:'none', est:'흉기를 든 위협 의심', conf:'중간', urgent:true, risk:'높음', sus:'onscene', age:[20, 52], prior:['과거 신고 기록 없음'], vit:'심박 141회/분(매우 빠름) · 움직임 급정지',
    see:'손에 길쭉한 물체를 든 사람이 다가서는 장면(영상 분석 신뢰도 72%)', onsite:'접근하지 않고 거리를 두며 피해자를 안전한 곳으로 이동시키고, 경찰관 2명 이상이 함께 대응', look:'회색 후드, 손에 긴 물체', know:'모르는 사람',
    asks:[['용의자의 인상착의는?', '회색 후드를 쓴 사람, 손에 긴 물체(가상)'], ['용의자와 아는 사이인가요?', '모르는 사람(가상)']] },
  { id:'stalk', kind:'접근', name:'스토킹 접근', say:'계속 따라와요', can:'text', est:'스토킹 접근 의심', conf:'높음', urgent:true, risk:'중간', sus:'onscene', age:[21, 45], prior:['접근금지 결정 1건', '과거 스토킹 신고 2건'], vit:'심박 118회/분 · 걸음이 빨라짐',
    see:'피해자 뒤로 같은 사람이 일정한 거리를 두고 계속 따라오는 장면(영상 분석 신뢰도 88%)', onsite:'피해자를 사람 많고 밝은 곳으로 이동시키고, 접근금지 결정 위반 여부를 확인', look:'모자를 쓴 중간 키 남성', know:'예, 헤어진 지인(접근금지 대상)',
    asks:[['용의자의 인상착의는?', '모자를 쓴 중간 키 남성(가상)'], ['용의자와 아는 사이인가요?', '예, 헤어진 지인이고 접근금지 대상이에요(가상)']] },
  { id:'theft', kind:'재산', name:'소매치기 후 도주', say:'가방을 뺏기고 달아났어요', can:'text', est:'날치기 발생 후 도주', conf:'높음', urgent:false, risk:'낮음', sus:'fled', age:[19, 60], prior:['과거 신고 기록 없음'], vit:'심박 110회/분 · 보행 정지',
    see:'오토바이를 탄 사람이 지나가며 가방을 낚아채 한 방향으로 달아나는 장면(영상 분석 신뢰도 86%)', onsite:'피해자 진술을 받고 분실물 목록을 정리하며, 달아난 방향의 CCTV로 이동 경로를 확인', look:'오토바이, 흰색 헬멧', know:'모르는 사람',
    asks:[['용의자의 인상착의는?', '흰색 헬멧을 쓰고 오토바이를 탔어요(가상)'], ['용의자와 아는 사이인가요?', '모르는 사람(가상)']] },
  { id:'dv', kind:'폭력', name:'가정폭력 의심', say:'', can:'none', est:'가정폭력 진행 의심', conf:'중간', urgent:true, risk:'높음', sus:'onscene', age:[26, 58], prior:['과거 가정폭력 신고 1건'], vit:'심박 126회/분 · 큰 소리 감지',
    see:'실내 CCTV는 없고, 복도 CCTV와 소리 분석에서 고함과 물건 던지는 소리가 이어짐(신뢰도 70%)', onsite:'출입 전 피해자 상태를 확인하고, 피해자와 가해자를 분리하며 필요하면 보호 시설에 연계', look:'집 안의 동거인', know:'예, 같은 집에 사는 사람',
    asks:[['용의자의 인상착의는?', '같은 집에 사는 성인 남성(가상)'], ['용의자와 아는 사이인가요?', '예, 같은 집에 사는 사람이에요(가상)']] }
];
var CRIMES = {}; INCIDENTS.forEach(function (x) { CRIMES[x.id] = x; });
var NAMES = ['김가온', '이서연', '박도윤', '최하린', '정민준', '한지우', '오세아', '윤태양'];
var TAGS = ['가상 용의자 갑', '가상 용의자 을', '가상 용의자 병'];
var ONSITE_NOTE = '아래 현장 대응 내용은 모두 가상 시나리오입니다.';
function pick(a, r) { return a[Math.min(a.length - 1, Math.floor(r() * a.length))]; }
function sig(txt) {
  function f(x) { var v = 2166136261, i; for (i = 0; i < x.length; i++) { v ^= x.charCodeAt(i); v = Math.imul(v, 16777619) >>> 0; } return ('00000000' + v.toString(16)).slice(-8); }
  return 'SIG-' + f(txt) + f(txt + '#');
}
function clock(ms) { return new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Seoul', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(new Date(ms)); }
function draw(rng, now) {
  var r = typeof rng === 'function' ? rng : Math.random, t0 = now == null ? Date.now() : now;
  var inc = pick(INCIDENTS, r), dev = pick(DEVICES, r), pl = pick(PLACES, r);
  var age = inc.age[0] + Math.floor(r() * (inc.age[1] - inc.age[0] + 1)), vn = pick(NAMES, r);
  var can = dev[0] === 'ring' ? 'none' : dev[0] === 'watch' ? (inc.can === 'none' ? 'none' : 'voice') : inc.can;
  var total = 4 + Math.floor(r() * 6), usable = Math.max(1, total - Math.floor(r() * 3)), cover = usable >= 6 ? '좋음' : usable >= 4 ? '보통' : '나쁨';
  var pool = 8 + Math.floor(r() * 9), k = cover === '좋음' ? 1 : cover === '보통' ? (r() < 0.6 ? 1 : 2) : 2 + Math.floor(r() * 2), cands = [], i;
  if (inc.urgent) for (i = 0; i < k; i++) cands.push({ tag:TAGS[i], dev:'단말 ' + String.fromCharCode(65 + Math.floor(r() * 26)) + '-' + (10 + Math.floor(r() * 90)), fit:Math.max(52, 96 - i * 17 - Math.floor(r() * 9)) });
  var sc = { inc:inc, dev:dev[0], devName:dev[1], place:pl[0], placeName:pl[1], xy:[pl[2], pl[3]], can:can, say:can === 'none' ? '' : inc.say, t0:t0, reporter:{ name:vn, rel:'본인' },
    vic:{ name:vn, age:age, ageText:age + '세', sex:pick(['남', '여'], r), prior:inc.prior.join(', '), vit:inc.vit },
    cctv:{ total:total, usable:usable, cover:cover, owners:1 + Math.floor(r() * 3) },
    sus:{ pool:inc.urgent ? pool : 0, cands:cands, conf:!inc.urgent ? '해당 없음' : cover === '좋음' || (cover === '보통' && k === 1) ? '높음' : cover === '보통' ? '중간' : '낮음' } };
  var m = callMessage(sc.can, sc.say); sc.msg = m;
  sc.payload = [m.label, m.body, sc.reporter.name, sc.vic.name, sc.vic.ageText, sc.vic.sex, sc.vic.prior, sc.vic.vit, pl[1], t0].join('|') + '|' + sc.dev;
  sc.sig = sig(sc.payload); sc.no = 'PO-' + sc.sig.slice(4, 10).toUpperCase();
  return sc;
}
function verify(sc) { return sig(sc.payload) === sc.sig; }
/** 신고 위치에서 팀마다 닿는 시간과 근무 상태를 모은다. */
function gather(sc, units) {
  var P = sc.xy;
  return units.map(function (u) { return { u:u, eta:dist([u.x, u.y], P) + prepOf(u), free:u.free }; }).sort(byEta);
}
function form(groups) {
  var kids = [];
  groups.forEach(function (g) { kids.push(h('div', { class:'lab', style:'margin:12px 0 4px', text:g[0] })); g[1].forEach(function (p) { if (p) kids.push(kv(p[0], p[1], p[2])); }); });
  return h('div', { style:'border:1px solid var(--line);border-radius:12px;padding:4px 16px 12px' }, kids);
}
function sub(t) { return h('b', { style:'display:block;margin-top:8px', text:t }); }

// ── 시뮬레이션 한 번(run) ──
// run = { sc:사건, units:지금의 근무 현황, units0:계획 확정 때의 현황, plan0:확정한 계획, ev:용의자 이동 뒤 갱신, t:시간 막대, reached:열 수 있는 가장 먼 단계, cur:보고 있는 단계 }
// 화면의 단계 목록과 오른쪽 위 시뮬레이션 버튼은 서로 다른 run 을 쓰므로 서로 영향을 주지 않는다.
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function newRun() { return { sc:draw(Math.random), units:newUnits(), units0:null, plan0:null, ev:null, t:0, reached:0, cur:-1, picked:false, seen:false }; }
function shake(R) { R.units.forEach(function (u) { if (Math.random() < 0.25) u.free = false; }); }
/** 3-1 에서 지시서를 보내는 순간 계획과 그때의 근무 현황을 굳힌다. 이후 현황이 바뀌어도(3-5) 앞 단계는 그때의 판단을 그대로 보여 준다. */
function lock(R) { if (R.plan0) return; R.units0 = clone(R.units); R.plan0 = match(R.sc.inc.id, R.sc.place, R.units0); }
function ctx(R, re) {
  var sc = R.sc, locked = !!R.plan0, un = locked ? R.units0 : R.units, dec = locked ? R.plan0 : match(sc.inc.id, sc.place, R.units);
  return { R:R, re:re, sc:sc, locked:locked, units:un, g:gather(sc, un), dec:dec, fin:R.ev ? R.ev.after : dec };
}
/** 단계 결과를 그리는 곳(페이지 패널 / 시뮬레이션 패널)마다 id 앞머리가 달라, 두 패널이 같은 id 를 갖지 않는다. */
var PF = 'pol-';
function X(id) { return PF + id; }
function none(id, t) { return [h('div', { class:'sub', id:id, text:t })]; }
function endT(g) { return Math.max(g.start, g.contain || 0); }
function rows3(rows) { return rows.length ? h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('m-opts') }, [h('thead', {}, [h('tr', {}, ['순서', '팀', '종류', '현장 도착'].map(function (t, i) { return h('th', { class:i === 3 ? 'r' : '', text:t }); }))]), h('tbody', {}, rows)])]) : h('div', { class:'empty', text:'비어 있는 팀이 없어요.' }); }
function dispatchList(sc, r) {
  var g = r.go, cr = sc.inc, L = []; if (!g) return L;
  L.push({ k:'lead', who:g.lead.u.name, order:'신고 위치(' + sc.placeName + ')로 출동해 피해자 안전부터 확보합니다. 현장 지침: ' + cr.onsite + '.', due:g.lead.eta + '분 뒤 현장 도착' });
  if (g.kind === 'reassign') L.push({ k:'chase', who:'인근 관할 지원', order:'지원을 요청했습니다. 도착하면 용의자 확인과 확보를 맡습니다.', due:g.aid + '분 뒤 도착' });
  else if (g.second) L.push({ k:'chase', who:g.second.u.name, order:cr.sus === 'fled' ? '용의자가 달아난 방향으로 이동해 확보합니다.' : '현장 근처로 가 용의자가 달아나지 못하게 막고 확보를 맡습니다.', due:g.second.eta + '분 뒤 도착' });
  else L.push({ k:'chase', who:g.lead.u.name + ' (겸임)', order:'피해자 안전을 확보한 뒤 용의자 확인과 수배도 이어서 맡습니다.', due:'현장 도착 뒤' });
  L.push({ k:'live', who:'치안 AI · CCTV·정보 연결', order:'현장 CCTV 영상과 용의자 후보의 이동 경로를 출동 팀에 실시간으로 보냅니다. 용의자 신원 정보는 출동 팀과 인근 경찰서·파출소에만 전달합니다.', due:'즉시 연결' });
  L.push({ k:'vic', who:'신고자의 나만의 AI 비서', order:'피해자에게 안전한 곳으로 이동하고 연락을 이어 가라고 안내합니다. 말·문자가 어려우면 진동으로 간단히 알려요.', due:'즉시' });
  return L;
}
function statusAt(sc, r, t) {
  var g = r.go, o = {}; if (!g) return o;
  o.lead = t < prepOf(g.lead.u) ? '출동 준비 중' : t < g.lead.eta ? '현장으로 이동 중' : '현장 도착, 피해자 안전 확보';
  o.chase = g.kind === 'reassign' ? (t < g.aid ? '인근 관할이 이동 중' : '지원 도착') : g.second ? (t < g.second.eta ? '용의자 쪽으로 이동 중' : '도착, 용의자 확보 대기') : g.track ? 'CCTV 추적·수배 중' : '첫 팀이 겸임';
  o.live = t < 1 ? 'CCTV 연결 중' : '영상·이동 경로 전송 중';
  o.vic = t < 1 ? '안내 전달 중' : '안내 전달 완료, 연락 유지';
  return o;
}
function timeBar(c, r) {
  var g = r.go, sc = c.sc, R = c.R, pf = PF, mx = endT(g) + 1, t = Math.min(R.t, mx);
  var lab = h('b', { id:X('t-lab'), text:'경과 T+' + t + '분 · 가상 시각 ' + clock(sc.t0 + t * 60000) });
  var rg = h('input', { type:'range', id:X('t'), min:'0', max:String(mx), value:String(t), 'aria-label':'경과 시간(분)', style:'width:100%' });
  rg.oninput = function () { var v = Number(rg.value), o = statusAt(sc, r, v); R.t = v; lab.textContent = '경과 T+' + v + '분 · 가상 시각 ' + clock(sc.t0 + v * 60000); ['lead', 'chase', 'live', 'vic'].forEach(function (k) { var e = $(pf + 'st-' + k); if (e) e.textContent = o[k]; }); };
  return h('div', { class:'card col', style:'margin-top:12px' }, [lab, rg, h('div', { class:'sub', text:'막대를 끌어 시간이 흐를 때 상태가 어떻게 바뀌는지 보세요. ' + ONSITE_NOTE })]);
}
function sendForm(sc) {
  var m = sc.msg, p = sc.vic;
  return form([
    ['① 기기에서 보낸 치안 메시지', [['전송 기기', sc.devName + (sc.dev === 'ring' ? ' (말·문자 입력이 없는 기기)' : ''), X('s1-dev')], ['전달 형태', m.label, X('s1-mode')], ['내용', m.body || '없음 — 오직 “치안”만 전달', X('s1-body')], ['받는 곳', '치안 AI']]],
    ['② 내 AI 비서가 첨부한 신고자·피해자 정보', [['신고자', sc.reporter.name + ' · ' + sc.reporter.rel, X('s1-rep')], ['피해자 성명', p.name, X('s1-name')], ['나이 · 성별', p.ageText + ' · ' + p.sex], ['과거 신고·접근금지 기록', p.prior, X('s1-prior')], ['생체 정보', p.vit], ['주변 소리·영상', '신고 직전 5초(가상)'], ['현재 위치', sc.placeName + ' (가상 좌표 ' + sc.xy[0] + ', ' + sc.xy[1] + ')', X('s1-loc')]]],
    ['③ 접수 정보', [['신고 시각', clock(sc.t0) + ' (가상)'], ['사건 번호', sc.no, X('s1-no')]]],
    ['④ 신고자의 디지털 서명', [['서명값', sc.sig, X('s1-sig')], ['서명 방식', '신고자 단말의 개인 키로 서명(가상). 치안 AI가 받은 뒤 확인합니다.']]]]);
}
function planList(r) { return h('div', {}, planText(r).map(function (x, i) { return h('div', { class:'stp', 'data-s':String(i) }, [h('i', { text:String(i + 1) }), h('div', {}, [h('span', { text:x })])]); })); }

// ── 19개 세부 단계(각각 눌린 단계 아래로 펼쳐지는 패널에 결과를 보여 준다) ──
function s11(c) { var sc = c.sc, how = { phone:'폰의 치안 버튼을 소리 없이 세 번 빠르게 누릅니다(진동만).', watch:'나비웹 워치의 치안 버튼을 길게 누릅니다(소리 없음).', ring:'링(팔찌)을 두 번 눌러 치안을 보냅니다(소리 없음).' }[sc.dev];
  return [h('div', { class:'sub', text:'가상 사건입니다. 기기와 범죄는 무작위로 뽑았어요. 가해자가 가까이 있을 수 있어 소리·화면 없이 보냅니다.' }), form([['기기 호출', [['사용한 기기', sc.devName, X('s1-dev')], ['조작(가상)', how], ['호출 시각', clock(sc.t0) + ' (가상)'], ['어떤 상황', sc.inc.kind + ' · ' + sc.inc.name, X('s1-inc')]]]])]; }
function s12(c) { var sc = c.sc, m = sc.msg;
  return [form([['치안 메시지 구성', [['말·문자 입력', sc.can === 'voice' ? '말할 수 있음' : sc.can === 'text' ? '문자를 입력할 수 있음' : '둘 다 어려움'], ['전달 형태', m.label, X('s1-mode')], ['내용', m.body || '없음 — 오직 “치안”만 전달', X('s1-body')], ['이유', m.only ? (sc.dev === 'ring' ? '링에는 말·문자 입력이 없어 “치안”만 갑니다.' : '말도 문자도 어려워 “치안”만 갑니다.') : '“치안” 표시와 함께 ' + (m.mode === 'voice' ? '음성' : '문자') + '을(를) 보냅니다.']]]])]; }
function s13(c) { var sc = c.sc, p = sc.vic;
  return [h('div', { class:'sub', text:'신고자의 나만의 AI 비서가 붙이는 정보입니다. 이 시뮬레이션은 모든 항목을 보내기로 한 경우를 보여 줍니다. 실제로는 “평소 준비”에서 고른 항목만 전송되고, 현재 위치는 항상 포함돼요.' }),
    form([['신고자·피해자 정보', [['신고자', sc.reporter.name + ' · ' + sc.reporter.rel, X('s1-rep')], ['피해자 성명', p.name, X('s1-name')], ['나이 · 성별', p.ageText + ' · ' + p.sex], ['과거 신고·접근금지 기록', p.prior, X('s1-prior')], ['생체 정보', p.vit], ['주변 소리·영상', '신고 직전 5초(가상)'], ['현재 위치', sc.placeName + ' (가상 좌표 ' + sc.xy[0] + ', ' + sc.xy[1] + ')', X('s1-loc')]]]])]; }
function s14(c) { return [h('div', { class:'sub', text:'위 내용을 하나의 Form으로 묶어 신고자의 디지털 서명을 붙이고 치안 AI로 보냅니다.' }), sendForm(c.sc)]; }
function s21(c) { var sc = c.sc; return [form([['서명 확인', [['받은 서명', sc.sig], ['확인 결과', verify(sc) ? '일치 — 전달 중 내용이 바뀌지 않았어요' : '불일치 — 위변조 의심', X('s2-sig')], ['사건 번호', sc.no]]]])]; }
function s22(c) { var sc = c.sc, p = sc.vic, cr = sc.inc;
  return [form([['신고 내용 정리와 범죄 유형 추정', [['피해자', p.name + ' · ' + p.ageText + ' · ' + p.sex], ['과거 신고·접근금지 기록', p.prior], ['생체 정보', p.vit], ['전달된 내용', sc.msg.body || '“치안”만 전달됨'], ['범죄 유형(추정)', cr.est + ' — 신뢰도 ' + cr.conf + ' (' + cr.kind + ')', X('s2-est')], ['긴급도', cr.urgent ? '급박 — 생명·신체에 위험이 임박' : '급박하지 않음 — 이미 일어난 일', X('s2-urg')], ['위험도', cr.risk, X('s2-risk')], ['용의자 위치', cr.sus === 'fled' ? '달아남(방향 추정)' : '현장 또는 가까이에 있음', X('s2-sus')]]]])]; }
function s23(c) { return [h('div', { class:'sub', text:'치안 AI가 용의자를 가리는 데 꼭 필요한 것을 신고자의 비서에게 더 묻습니다. 비서는 허용된 질문에만 기록을 바탕으로 답해요.' }), form([['추가 질의', c.sc.inc.asks.map(function (a, i) { return ['치안 AI → 비서: ' + a[0], '답: ' + a[1] + ' (가상)', X('s2-ask') + i]; })]])]; }
function s24(c) {
  var sc = c.sc, cc = sc.cctv, cr = sc.inc;
  return [h('div', { class:'sub', text:'치안 인프라가 신고 위치 주변 CCTV를 직접 제어해 현장 상황을 파악합니다. 관리 기관(구청·교통·민간)의 제어 권한은 요건에 따라 허용돼요(가상).' }),
    form([['주변 CCTV 제어', [['반경 300m 안 CCTV', cc.total + '대', X('s2-cctv')], ['사용 가능(점검·사각 제외)', cc.usable + '대'], ['영상 범위', cc.cover, X('s2-cover')], ['제어 요청한 관리 기관', cc.owners + '곳'], ['제어 허용', cr.urgent ? '긴급 요건으로 즉시 허용 — 사후에 감독 기관에 보고' : '일반 절차로 허용 — 영상 보기·분석만', X('s2-allow')]]],
      ['영상 분석 결과', [['현장 상황', cr.see, X('s2-see')], ['위험도 확인', cr.risk + ' — 영상으로 확인했어요'], ['분석 방식', '치안 AI가 영상을 분석한 참고 정보이며, 현장 판단은 경찰관이 해요.']]]])];
}
function s25(c) {
  var sc = c.sc, cr = sc.inc, su = sc.sus, kids = [];
  kids.push(h('div', { class:'sub', text:'개인의 위치·통신 기록을 쓰는 단계라 먼저 법적 요건을 확인합니다. 아래 요건은 설계 단계의 가정이며, 실제 요건은 법률과 감독 절차로 정해야 해요.' }));
  if (cr.urgent) {
    kids.push(form([['법적 요건 확인', [['신고자의 요청', '있음 — 신고에 디지털 서명이 붙음'], ['급박한 생명·신체 위험', '해당 — ' + cr.est, X('s2-gate')], ['조회 범위', '신고 시각 앞뒤 5분 · 신고 위치 반경 200m · 단말 위치·통신 사실만(통화·문자 내용은 제외)', X('s2-scope')], ['감독', '사후 승인 요청을 감독 기관에 자동 전송 — 조회 요청·승인·열람 내역은 변경 불가 기록으로 남김'], ['결과', '조회 허용']]]]));
    kids.push(h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('s2-cands') }, [h('thead', {}, [h('tr', {}, ['후보', '단말', '영상 특징·이동 방향 일치'].map(function (t, i) { return h('th', { class:i === 2 ? 'r' : '', text:t }); }))]), h('tbody', {}, su.cands.map(function (x) { return h('tr', {}, [h('td', {}, [h('b', { text:x.tag })]), h('td', { text:x.dev }), h('td', { class:'r num', text:x.fit + '%' })]); }))])]));
    kids.push(form([['용의자 후보 좁히기', [['조회한 단말', su.pool + '대'], ['영상과 맞는 후보', su.cands.length + '명', X('s2-n')], ['후보의 확실한 정도', su.conf, X('s2-conf')], ['쓰는 방법', '후보일 뿐 확정이 아니에요. 경찰관이 현장에서 확인하고, 신원 정보는 출동 팀과 인근 경찰서·파출소에만 전달돼요.']]]]));
  } else {
    kids.push(form([['법적 요건 확인', [['신고자의 요청', '있음'], ['급박한 생명·신체 위험', '해당 없음 — 이미 일어난 일', X('s2-gate')], ['단말 위치·통신 조회', '하지 않음 — 사전 승인(영장 등)이 먼저 필요해요', X('s2-scope')], ['지금 하는 일', '영장 신청서 초안을 만들어 경찰에 전달 — 승인되기 전에는 조회하지 않아요'], ['결과', '조회 보류']]]]));
    kids.push(form([['용의자 특정', [['방법', 'CCTV 영상의 인상착의·이동 방향만 사용(신원은 특정하지 않음)', X('s2-n')], ['수배할 인상착의', cr.look], ['후보의 확실한 정도', '해당 없음', X('s2-conf')]]]]));
  }
  return kids;
}
function s26(c) {
  var r = c.dec, g = r.go, sc = c.sc, b = r.best, hero = h('div', { class:'card col hero', id:X('m-res') });
  if (!b) { hero.appendChild(h('div', { class:'big', text:'지금은 비어 있는 팀이 없어요' })); hero.appendChild(h('div', { class:'sub', id:X('m-kind'), text:'그래도 가장 가까운 ' + g.lead.u.name + '을 다른 일에서 돌려 보내고 인근 관할에 지원을 요청해요. 팀이 비는 대로 치안 AI가 다시 배치합니다(연습).' })); }
  else { hero.appendChild(h('div', { class:'big', id:X('m-start'), text:'피해자 보호 약 ' + g.start + '분 뒤 · ' + g.lead.u.name })); hero.appendChild(h('div', { class:'sub', id:X('m-kind'), text:g.kind === 'pair' ? '두 팀을 나눠 보내요 — 한 팀은 피해자에게, 다른 팀은 용의자 쪽으로 갑니다.' : '한 팀이 피해자 확인과 용의자 수배를 함께 맡아요(' + (sc.inc.risk === '낮음' ? '위험이 낮아요' : '여유 팀이 하나뿐이에요') + ').' })); }
  var opts = r.options.slice(0, 5).map(function (o, i) { return h('tr', {}, [h('td', { class:'num', text:(i === 0 ? '★ ' : '') + (i + 1) }), h('td', {}, [h('b', { text:o.u.name })]), h('td', {}, [pill(o.u.kind === 'car' ? '자율주행 치안차량' : '파출소 근무조', o.u.kind === 'car' ? 'p' : 'm')]), h('td', { class:'r num', text:o.eta + '분' })]); });
  var why = r.why.slice();
  return [hero, sub('피해자에게 닿는 순서(빠른 순)'), rows3(opts), h('div', {}, [mapSvg(r, c.units), h('div', { class:'sub', text:'빨간 점이 신고 위치예요(용의자가 현장에 있으면 같은 자리). 주황 마름모는 용의자가 달아난 곳이에요. 파란 칸·삼각형이 출동하는 팀, 파란 선은 피해자 쪽, 초록 점선은 용의자 쪽입니다. 연한 회색은 다른 출동 중인 팀이에요.' })]),
    why.length ? h('div', { id:X('m-why') }, [h('b', { text:'배치에서 빠진 팀' }), h('div', {}, why.map(function (w) { return kv(w[0], w[1]); }))]) : null,
    form([['치안 대응 계획서 · ' + sc.no, [['신고 위치', sc.placeName], ['범죄 유형(추정)', sc.inc.est], ['피해자 쪽 팀', g.lead.u.name + ' (' + g.lead.eta + '분)', X('s2-plan')], [g.kind === 'reassign' ? '용의자 쪽(지원)' : '용의자 쪽 팀', g.second ? g.second.u.name + ' (' + g.second.eta + '분)' : '첫 팀이 겸임'], ['CCTV·정보', '영상과 이동 경로를 팀에 실시간 전송'], ['용의자 정보', sc.inc.urgent ? '후보 ' + sc.sus.cands.length + '명(후보일 뿐) — 출동 팀과 경찰서·파출소에만 전달' : '인상착의 수배만 — 신원은 특정하지 않음'], ['결정 주체', '확인·체포는 경찰관']]]]), planList(r)];
}
function s31(c) {
  var r = c.dec, L = dispatchList(c.sc, r);
  return [h('div', { class:'sub', text:'치안 AI가 출동 팀, 인근 경찰서·파출소, 피해자의 비서에 지시서를 동시에 보냅니다. 발송 시각은 T+0분이고, 이때 계획이 확정돼요.' }),
    r.best ? null : h('div', { class:'sub', id:X('s3-fb'), text:'비어 있는 팀이 없어 돌려 보내기와 지원 요청으로 보냅니다. 팀이 비면 치안 AI가 새 지시를 내려요.' }),
    h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('s3-tbl') }, [h('thead', {}, [h('tr', {}, ['받는 곳', '지시 내용', '예정'].map(function (x) { return h('th', { text:x }); }))]), h('tbody', {}, L.map(function (x) { return h('tr', {}, [h('td', {}, [h('b', { text:x.who })]), h('td', { text:x.order }), h('td', { text:x.due })]); }))])])];
}
function s3one(ks, title) { return function (c) { var r = c.dec, L = dispatchList(c.sc, r), st = statusAt(c.sc, r, Math.min(c.R.t, endT(r.go) + 1)), groups = [];
  ks.forEach(function (k, i) { var x = L.filter(function (y) { return y.k === k; })[0]; groups.push([title[i], [['받는 곳', x.who], ['지시 내용', x.order], ['예정', x.due], ['지금 상태', st[k], X('st-') + k]]]); });
  return [form(groups), timeBar(c, r)]; }; }
/** 이동 중 용의자가 차량에 올라 더 먼 곳으로 달아난다. 그 시각의 위치에서 용의자 쪽 배치를 다시 계산한다. */
function triggerEvent(R, re) {
  if (R.ev) return; lock(R); var p0 = R.plan0; if (!p0 || !p0.go) return;
  var at = Math.max(1, Math.round(p0.go.lead.eta * 0.5));
  R.ev = { at:at, after:match(R.sc.inc.id, R.sc.place, R.units, { at:at, prev:p0 }) }; re();
}
function s35(c) {
  var R = c.R, r = c.dec, g0 = r.go, ev = R.ev, kids = [h('div', { class:'sub', text:'이동 중에도 치안 AI는 CCTV와 용의자 후보의 이동 경로를 실시간으로 받습니다. 용의자가 차량에 올라 달아나면 그 시각의 위치에서 용의자 쪽 배치를 다시 계산해요. 피해자 쪽 팀은 그대로 갑니다. 이 단계는 건너뛰어도 됩니다.' })];
  kids.push(h('div', { class:'rowf' }, [h('button', { type:'button', class:'btn fill', id:X('ev'), disabled:ev ? true : null, text:ev ? '사건이 발생했어요' : '용의자 이동 일으키기 (모의)', onclick:function () { triggerEvent(R, c.re); } })]));
  if (ev) {
    var a = ev.after, n = a.go, old = g0.second ? g0.second.u.name : g0.track ? 'CCTV 추적' : g0.kind === 'reassign' ? '인근 관할 지원' : '첫 팀 겸임', same = g0.second && n.second && g0.second.u.id === n.second.u.id;
    kids.push(form([['실시간 재배치', [['발생 시각', 'T+' + ev.at + '분 · 가상 ' + clock(c.sc.t0 + ev.at * 60000)], ['사건', '용의자가 차량에 올라 ' + (c.sc.placeName) + '에서 더 먼 곳으로 달아남'], ['그때 피해자 쪽 팀', ev.at < g0.lead.eta ? g0.lead.u.name + ' — 현장으로 이동 중(그대로 감)' : g0.lead.u.name + ' — 이미 현장 도착'], ['이전 용의자 쪽', old],
      ['새 용의자 쪽', n.second ? n.second.u.name + ' · 약 ' + n.second.eta + '분 뒤 도착' : 'CCTV 추적과 인근 관할 수배 — 여유 팀이 없어요', X('ev-new')], ['지시', n.second ? (same ? n.second.u.name + '은 가는 방향만 바꿔 계속 이동' : n.second.u.name + '을 용의자가 달아난 곳으로 보냄') : '용의자 이동 경로를 CCTV로 이어 따라가고 인근 관할에 수배'], ['CCTV·정보', '새 위치 주변 CCTV로 전환해 영상과 경로를 계속 전송']]]]));
    kids.push(planList(a));
  }
  return kids;
}
function s41(c) { var r = c.fin, g = r.go, cr = c.sc.inc;
  return [h('div', { class:'sub', text:c.R.ev ? '용의자가 달아나 용의자 쪽 배치가 바뀌었지만, 피해자 쪽 팀은 그대로 도착합니다.' : '피해자 쪽 팀이 도착해 피해자 안전을 확인합니다.' }),
    form([['현장 도착과 안전 확보', [['도착한 팀', g.lead.u.name + ' (T+' + g.lead.eta + '분)', X('s4-ready')], ['피해자 상태', '안전 확보 — ' + cr.onsite], ['피해자 비서', '안내를 마치고 연락을 이어 가는 중'], ['다친 곳이 있으면', '응급 AI에 연계해 구급대를 부릅니다(가상)']]]])];
}
function s42(c) { var r = c.fin, g = r.go, sc = c.sc, cr = sc.inc, su = sc.sus;
  var team = g.kind === 'reassign' ? '인근 관할 지원 (T+' + g.aid + '분 도착)' : g.second ? g.second.u.name + ' (T+' + g.second.eta + '분 도착)' : g.track ? '여유 팀 없음 — CCTV 추적·수배 중' : g.lead.u.name + ' (겸임)';
  return [form([['용의자 확인과 신병 확보', [['용의자 쪽', team, X('s4-team')], ['참고 정보', cr.urgent ? '후보 ' + su.cands.length + '명(확실한 정도 ' + su.conf + ') — 후보일 뿐' : '인상착의 수배: ' + cr.look, X('s4-sus')], ['확인·체포 판단', '현장 경찰관이 영상과 후보 정보를 참고해 직접 확인하고 판단해요', X('s4-judge')], ['치안 AI의 역할', '결정하지 않아요 — 영상·경로 제공과 기록만'], ['결과(모의)', g.track ? '아직 확보되지 않음 — 수배가 이어져요' : '현장 경찰관의 판단으로 확보 절차 진행']]]]), h('div', { class:'sub', text:ONSITE_NOTE })];
}
function evBase(c) { var g = c.fin.go; return c.sc.no + '|' + c.sc.placeName + '|' + clock(c.sc.t0 + endT(g) * 60000); }
function s43(c) { var g = c.fin.go, sc = c.sc, base = evBase(c);
  return [form([['증거 보존과 서명', [['보존한 것', '신고 메시지 · CCTV 영상 ' + sc.cctv.usable + '대 분 · 조회·제어 기록'], ['보존 방식', '변경할 수 없는 기록으로 남겨요'], ['기록 지문', sig(base + '|EVD'), X('s4-sig0')], ['보존 시각', 'T+' + endT(g) + '분 · 가상 ' + clock(sc.t0 + endT(g) * 60000), X('s4-at')], ['현장 경찰관 서명', sig(base + '|POL'), X('s4-sig1')], ['치안 AI 서명', sig(base + '|AI'), X('s4-sig2')]]]])];
}
function s44(c) { var r = c.fin, g = r.go, sc = c.sc, cc = sc.cctv, u = sc.inc.urgent;
  return [h('div', { class:'card col hero' }, [h('div', { class:'big', id:X('s4-end'), text:'신고 후 약 ' + g.lead.eta + '분 만에 피해자 안전이 확보됩니다' + (g.track ? ' — 용의자 수배는 이어져요' : '') }), h('div', { class:'sub', text:'이 흐름은 모두 모의 체험이며, 인물·장소·팀·시간은 가상입니다. 실제 위급 상황은 112에 연락하세요.' })]),
    form([['권한 사용 내역(감독 기관에 보고)', [['CCTV 제어', cc.usable + '대 · ' + (u ? '긴급 요건' : '일반 절차'), X('s4-aud1')], ['단말 위치·통신 조회', u ? sc.sus.pool + '대 조회 · 사후 승인 요청 전송' : '하지 않음(영장 신청서 초안만 전달)', X('s4-aud2')], ['대상자 통지', u ? '조회된 단말의 소유자에게 사실을 알려요(수사에 방해되지 않는 때)' : '해당 없음'], ['기록', '모든 내역은 변경할 수 없는 기록으로 남고 감독 기관이 열람해요']]],
      ['기록 보존', [['피해자의 데이터 금고(PDV)', '신고·조치 기록이 남습니다(가상).'], ['치안 AI', '사건 ' + sc.no + ' 종결 기록을 보관합니다(가상).']]]])];
}

var STAGES = ['치안 신고', '치안 AI 대응', '출동·현장 지시', '현장 확보·종결'];
var STEPS = [
  { id:'1-1', st:0, title:'기기 호출', desc:'폰·워치·링을 소리 없이 조작해요', fn:s11 }, { id:'1-2', st:0, title:'메시지 구성', desc:'말·문자가 되면 함께, 아니면 “치안”만', fn:s12 },
  { id:'1-3', st:0, title:'신상 정보 첨부', desc:'내 비서가 이름·위치·과거 신고 기록 등을 붙여요', fn:s13 }, { id:'1-4', st:0, title:'디지털 서명과 전송', desc:'전체 Form에 서명을 붙여 치안 AI로', fn:s14 },
  { id:'2-1', st:1, title:'접수와 서명 확인', desc:'내용이 바뀌지 않았는지 확인해요', fn:s21 }, { id:'2-2', st:1, title:'신고 정리와 범죄 유형 추정', desc:'긴급도와 위험도까지 한 장으로 정리해요', fn:s22 },
  { id:'2-3', st:1, title:'비서에게 추가 질의', desc:'용의자의 인상착의 등을 물어요', fn:s23 }, { id:'2-4', st:1, title:'주변 CCTV 제어', desc:'현장 주변 CCTV를 골라 영상을 분석해요', fn:s24 },
  { id:'2-5', st:1, title:'법적 요건 확인과 용의자 특정', desc:'요건이 되면 단말을 좁혀 후보를 찾아요', fn:s25 }, { id:'2-6', st:1, title:'출동 배치와 대응 계획서', desc:'가장 빨리 닿는 팀을 골라 계획서를 써요', fn:s26 },
  { id:'3-1', st:2, title:'지시서 발송', desc:'출동 팀·경찰서·파출소·비서에 동시에', fn:s31 }, { id:'3-2', st:2, title:'피해자 쪽 팀 이동', desc:'가장 빨리 닿는 팀이 현장으로 가요', fn:s3one(['lead'], ['피해자 쪽 팀 출동']) },
  { id:'3-3', st:2, title:'용의자 쪽 팀 이동', desc:'용의자 위치로 두 번째 팀이 가요', fn:s3one(['chase'], ['용의자 쪽 팀 이동']) }, { id:'3-4', st:2, title:'실시간 정보와 피해자 안내', desc:'CCTV 영상을 보내고 피해자를 안내해요', fn:s3one(['live', 'vic'], ['실시간 정보 연결', '피해자 안내']) },
  { id:'3-5', st:2, title:'실시간 갱신', desc:'용의자가 달아나면 배치를 다시 짜요', fn:s35 },
  { id:'4-1', st:3, title:'현장 도착과 안전 확보', desc:'피해자 안전부터 확인해요', fn:s41 }, { id:'4-2', st:3, title:'용의자 확인과 신병 확보', desc:'경찰관이 최종 판단해요', fn:s42 },
  { id:'4-3', st:3, title:'증거 보존과 서명', desc:'영상·기록을 변경 불가로 남겨요', fn:s43 }, { id:'4-4', st:3, title:'종결과 권한 사용 보고', desc:'조회 내역을 감독 기관에 보고해요', fn:s44 }
];
var PLAN_AT = 10; // 3-1(지시서 발송)을 여는 순간 계획을 확정한다


// ── 단계 이동(run 마다 따로) ──
function openStep(R, i, re) { if (i < 0 || i >= STEPS.length || i > R.reached) return; if (i >= PLAN_AT) lock(R); R.cur = i; R.seen = true; R.reached = Math.max(R.reached, Math.min(i + 1, STEPS.length - 1)); re(); }
function advance(R, re) { var i = R.cur + 1; if (i >= STEPS.length) return; R.reached = Math.max(R.reached, i); openStep(R, i, re); }

// ── 화면: 진행 막대 · 단계 목록 · 패널 ──
function progressBar() {
  var R = S.sim, cur = R.cur, wrap = h('div', { class:'bar', id:'pol-bar' });
  STAGES.forEach(function (name, si) {
    var ticks = []; STEPS.forEach(function (s, i) { if (s.st !== si) return;
      var cl = 'tick ' + (i < R.reached ? 'done' : i === R.reached ? 'next' : 'lock') + (i === cur ? ' cur' : '') + (cur >= 0 && i === cur + 1 ? ' blink slow' : '');
      ticks.push(h('button', { type:'button', class:cl, id:'pol-tick-' + s.id, 'data-i':String(i), 'aria-label':s.id + ' ' + s.title, title:s.id + ' ' + s.title, 'aria-current':i === cur ? 'step' : null, disabled:i > R.reached ? true : null, onclick:function () { pickStep(R, i); } })); });
    wrap.appendChild(h('div', { class:'bseg' }, [h('div', { class:'bname', text:(si + 1) + '. ' + name }), h('div', { class:'bticks' }, ticks)]));
  });
  return h('div', { class:'barwrap' }, [wrap, h('div', { class:'bcap', id:'pol-bar-cap', text:cur >= 0 ? (cur + 1) + ' / ' + STEPS.length + ' · ' + STEPS[cur].id + ' ' + STEPS[cur].title : '0 / ' + STEPS.length + ' · 1-1 기기 호출부터 눌러 보세요' })]);
}
/** 새 사건을 뽑은 뒤 지금 무엇을 하면 되는지 알려 주는 배너. */
function nextHint() {
  var R = S.sim; if (!R.picked) return null;
  var last = R.cur === STEPS.length - 1, t = R.cur < 0 ? (!R.seen ? '새 사건이 뽑혔어요. 다음 할 일: 아래 단계 목록에서 깜박이는 “1-1 기기 호출”을 눌러 시작하세요.' : '다음 할 일: 단계 목록에서 “' + STEPS[R.reached].id + ' ' + STEPS[R.reached].title + '”을 눌러 이어 가세요. 이미 연 단계는 다시 볼 수 있어요.')
    : last ? '끝까지 봤어요. 다음 할 일: “새 사건 뽑기”를 눌러 다른 사건으로 다시 해 보세요.' : '다음 할 일: 아래에서 천천히 깜박이는 “' + STEPS[R.cur + 1].id + ' ' + STEPS[R.cur + 1].title + '” 단계를 눌러 한 단계씩 따라가세요.';
  return h('div', { class:'note info hintbn', id:'pol-next-hint', role:'status', text:t });
}
function summaryCard() {
  var sc = S.sim.sc;
  return h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'무작위 가상 사건' }), h('div', { class:'rowf' }, [pill(sc.devName, 'm'), pill(sc.inc.kind, 'p'), pill(sc.inc.name), pill(sc.placeName)]),
    h('div', { class:'sub', id:'pol-draw-sum', text:'기기·사건·신고자·위치를 무작위로 뽑았어요. 아래 목록에서 단계를 누르면 그 단계 바로 아래에 결과가 펼쳐져요. 처음부터 저절로 보려면 오른쪽 위의 시뮬레이션 버튼을 누르세요.' }),
    h('div', { class:'rowf' }, [h('button', { type:'button', class:'btn tonal' + (S.sim.picked ? '' : ' blink'), id:'pol-draw', text:'새 사건 뽑기', onclick:function () { S.sim = newRun(); S.sim.picked = true; S.wasOpen = false; render(); } }), btn('치안 AI에게 묻기', 'quiet', function () { ask('용의자가 달아나면 출동 팀을 어떻게 다시 배치하나요?'); })]), nextHint()]);
}
function stepList() {
  var R = S.sim, out = h('div', { id:'pol-list', class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'단계 목록 (' + STEPS.length + '단계)' }), h('div', { class:'sub', text:'앞 단계를 연 뒤에 다음 단계를 열 수 있어요. 이미 연 단계는 언제든 다시 볼 수 있습니다.' })]);
  STAGES.forEach(function (name, si) {
    out.appendChild(h('div', { class:'lab', text:(si + 1) + '. ' + name }));
    STEPS.forEach(function (s, i) { if (s.st !== si) return;
      var state = i === R.cur ? '보는 중' : i < R.reached ? '완료' : i === R.reached ? '열기' : '잠김', hintRow = R.picked && R.cur < 0 && !R.seen && i === 0;
      out.appendChild(h('button', { type:'button', class:'srow' + (i === R.cur ? ' cur' : '') + (hintRow ? ' blink' : '') + (R.cur >= 0 && i === R.cur + 1 ? ' blink slow' : ''), id:'pol-row-' + s.id, 'data-i':String(i), disabled:i > R.reached ? true : null, 'aria-current':i === R.cur ? 'step' : null, onclick:function () { pickStep(R, i); } },
        [h('span', { class:'sid', text:s.id }), h('span', { class:'stx' }, [h('b', { text:s.title }), h('span', { text:s.desc })]), h('span', { class:'sst', text:state })]));
      if (i === R.cur) { var ip = inlinePanel(); if (ip) out.appendChild(ip); } });
  });
  return out;
}
/** 단계 아래로 펼쳐지는 페이지 안 패널. 오른쪽 시뮬레이션 패널(#pol-apanel)과는 서로 아무 관계가 없다. */
function inlinePanel() {
  var R = S.sim; if (R.cur < 0) return null;
  var st = STEPS[R.cur], c = ctx(R, render), last = R.cur === STEPS.length - 1, pb0 = $('pol-pbody'), ps = pb0 ? pb0.scrollTop : 0, fresh = !S.wasOpen || S.lastOpen !== R.cur;
  S.wasOpen = true; S.lastOpen = R.cur; PF = 'pol-';
  var body = h('div', { class:'pbody col', id:'pol-pbody' }, st.fn(c).filter(Boolean));
  var pn = h('div', { id:'pol-ipanel', class:'ipanel' + (fresh ? ' anim' : ''), role:'region', 'aria-label':st.id + ' ' + st.title + ' 결과' }, [
    h('div', { class:'phead' }, [h('div', { style:'flex:1;min-width:0' }, [h('div', { class:'sub', id:'pol-ph-n', text:'직접 따라가기 · 단계 ' + (R.cur + 1) + ' / ' + STEPS.length + ' · ' + STAGES[st.st] }), h('b', { id:'pol-ph-t', text:st.id + ' ' + st.title })]), h('button', { type:'button', class:'btn quiet sm', id:'pol-pclose', text:'닫기', onclick:function () { closeStep(R); } })]),
    body,
    h('div', { class:'pfoot' }, [h('button', { type:'button', class:'btn quiet', id:'pol-prev', text:'◀ 이전', disabled:R.cur === 0 ? true : null, onclick:function () { pickStep(R, R.cur - 1); } }),
      last ? h('button', { type:'button', class:'btn fill', id:'pol-again', text:'새 사건으로 다시', onclick:function () { S.sim = newRun(); S.wasOpen = false; render(); try { window.scrollTo(0, 0); } catch (x) {} } }) : null])]);
  body.scrollTop = ps; return pn;
}
// ── 부드러운 전환: 눌린 단계를 진행 막대 바로 아래로 올리고, 새 패널은 높이가 늘어나며 아래 단계를 밀어 내린다 ──
var MOVE_MS = 350;
function calm() { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
function noIds(el) { el.removeAttribute('id'); [].forEach.call(el.querySelectorAll('[id]'), function (x) { x.removeAttribute('id'); }); el.setAttribute('aria-hidden', 'true'); el.classList.remove('anim'); }
/** 지금 열린 패널을 본떠 두었다가, 다시 그린 뒤 같은 자리에서 접히게 한다. */
function ghostOf() { var old = $('pol-ipanel'), R = S.sim; if (!old || R.cur < 0) return null; return { el:old.cloneNode(true), h:old.offsetHeight, rowId:'pol-row-' + STEPS[R.cur].id }; }
function settle(mv) {
  var np = $('pol-ipanel'), row = mv.rowId ? $(mv.rowId) : null, bw = M && M.querySelector('.barwrap'), ok = !calm();
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
  S.move.rowId = 'pol-row-' + STEPS[i].id; openStep(R, i, render);
}
function closeStep(R) { S.move = { ghost:ghostOf() }; R.cur = -1; S.wasOpen = false; render(); }

// ── 자동 시뮬레이션(오른쪽 위 버튼): 자기만의 사건과 진행 상태를 쓰므로 화면의 단계 목록과 섞이지 않는다 ──
var HOLD = { '2-4':6500, '2-5':7500, '2-6':7500, '3-1':7000, '3-5':8000, '4-4':0 };
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
  if (p && id === '3-2') R.t = Math.round(p.start * 0.5); else if (p && id === '3-3') R.t = Math.round(endT(p) * 0.6); else if (p && id === '3-4') R.t = endT(p);
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
  var pn = $('pol-apanel'), bk = $('pol-back'), a = S.auto; if (!pn || !bk) return;
  if (!a) { pn.textContent = ''; pn.className = 'panel auto'; pn.setAttribute('aria-hidden', 'true'); bk.className = 'back'; return; }
  var R = a.R, st = STEPS[R.cur], c = ctx(R, renderAuto), last = R.cur === STEPS.length - 1, done = last && !a.playing, pb0 = $('pol-au-body'), ps = a.top || !pb0 ? 0 : pb0.scrollTop;
  pn.textContent = ''; pn.className = 'panel auto open' + (a.closing ? ' closing' : !a.shown ? ' anim' : ''); pn.setAttribute('aria-hidden', 'false'); bk.className = 'back' + (a.closing ? '' : ' on'); a.shown = true; a.top = false;
  pn.appendChild(h('div', { class:'phead' }, [h('div', { style:'flex:1;min-width:0' }, [h('div', { class:'sub', id:'pol-au-n', text:'시뮬레이션 · 단계 ' + (R.cur + 1) + ' / ' + STEPS.length + ' · ' + STAGES[st.st] + (a.playing ? ' · 자동 진행 중' : done ? ' · 끝' : ' · 멈춤') }), h('b', { id:'pol-au-t', style:'font-size:17px', text:st.id + ' ' + st.title })]), h('button', { type:'button', class:'btn quiet sm', id:'pol-au-close', text:'닫기', onclick:closeAuto })]));
  var mini = h('div', { class:'mini', id:'pol-au-mini', 'aria-hidden':'true' }); STEPS.forEach(function (s, i) { mini.appendChild(h('i', { class:(i < R.cur ? 'done' : i === R.cur ? 'cur' : '') + (i > 0 && STEPS[i - 1].st !== s.st ? ' gap' : '') })); });
  pn.appendChild(mini);
  PF = 'pol-au-'; var kidsA; try { kidsA = st.fn(c).filter(Boolean); } finally { PF = 'pol-'; }
  var body = h('div', { class:'pbody col', id:'pol-au-body' }, kidsA); pn.appendChild(body);
  pn.appendChild(h('div', { class:'pfoot' }, [h('button', { type:'button', class:'btn quiet', id:'pol-au-pause', text:a.playing ? '⏸ 멈추기' : last ? '끝났어요' : '▶ 이어서', disabled:last && !a.playing ? true : null, onclick:autoToggle }), h('button', { type:'button', class:'btn fill', id:'pol-au-restart', text:'↻ 새 무작위 사건', onclick:autoRestart })]));
  body.scrollTop = ps;
}
function render() {
  var root = $('pol-root'), tp = $('pol-top'); if (!root || !tp) return;
  var y = 0; try { y = window.pageYOffset || 0; } catch (e) {}
  root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = head('치안', '폰·나비웹 워치·링(팔찌) 중 하나를 24시간 가까이 두고, 범죄를 당하면 소리 없이 가장 단순한 조작 한 번으로 알립니다. 무작위 가상 범죄 하나를 신고부터 현장 확보까지 단계별로 따라가 보세요.');
  kids.push(mockNote('모의 체험입니다. 아무것도 전송·조회되지 않고 출동도 일어나지 않아요. 인물·장소·시간은 모두 가상 값입니다. 실제 위급 상황은 112(응급은 119)에 직접 연락하세요.'));
  kids.push(progressBar(), prepSection(), summaryCard(), stepList());
  kids.forEach(function (k) { if (k) root.appendChild(k); });
  if (y) { try { window.scrollTo(0, y); } catch (e) {} }
  var mv = S.move; S.move = null; if (mv) settle(mv);
}
function reply(ok, msg) { emit('result', { ok:ok, msg:msg }); }
function go(v) {
  var a = ANCH[v]; if (!a) return false;
  if (a === 'pol-s-prep') S.prepOpen = true;
  render(); var e = $(a) || $('pol-s-call'); try { if (e) e.scrollIntoView({ block:'start' }); } catch (x) {}
  return true;
}
function nav(a) {
  var d = a && typeof a['do'] === 'string' ? a['do'] : '';
  if (go(d)) return reply(true, d === 'prep' || d === 'devices' || d === 'consent' ? '평소 준비 구역으로 이동했습니다.' : d === 'call' ? '사건 정하기 구역으로 이동했습니다.' : '흐름 구역으로 이동했습니다.');
  return reply(false, '지원하지 않는 요청입니다.');
}
function mount(el, o) {
  if (!el) return; o = o || {};
  autoClear(); S.auto = null; M = el; el.textContent = ''; el.classList.add('pol'); S.share = {}; S.askok = {}; S.dev = []; S.err = {}; S.msg = ''; S.prepOpen = false; S.sim = newRun(); S.wasOpen = false; load();
  [h('div', { id:'pol-top' }), h('div', { class:'wrap', id:'pol-root' }), h('div', { id:'pol-back', class:'back', onclick:closeAuto }), h('aside', { id:'pol-apanel', class:'panel auto', 'aria-hidden':'true', 'aria-label':'시뮬레이션' })].forEach(function (x) { el.appendChild(x); });
  if (o.view && ANCH[o.view] && o.view !== 'call') go(o.view); else render();
}
window.NaviPolice = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M) go(v); },
  callMessage:callMessage, draw:draw, verify:verify, gather:gather, match:match, newUnits:newUnits, planText:planText, devSummary:devSummary, sharedItems:sharedItems,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();

