/* medical-app.js — 나비웹 의료(인프라 AI · 의료). desktop.html 안에 직접 그려 넣는다(iframe 없음).
* 사용: NaviMedical.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result'|'agent', 함수) · .agentResult(ok, 메시지)
* 모양은 medical.css(.med 범위). 전역은 NaviMedical 하나만 쓴다.
*
* 응급·치안 페이지와 같은 레이아웃(2026-11-25): 한 페이지, 탭 없음. 평소 준비(기기·내 PDV에서 꺼낼 정보) 아래에서 무작위 가상 환자 한 명을
*   4단계·19개 세부 단계(1-1~4-4)로 따라간다. 위치는 상단 진행 막대, 차례는 단계 목록, 결과는 눌린 단계 바로 아래로 펼쳐지는 패널.
*   앞 단계를 연 뒤에만 다음 단계를 열 수 있고, 열린 단계 바로 다음 단계의 막대가 천천히 깜박인다.
*   3-1(지시서 발송)을 열면 이송·진료 계획과 그때의 기관 현황이 굳고, 3-5 에서 목적 기관의 검사 장비가 갑자기 막히면 그 시각의 위치에서 다시 고른다.
*   오른쪽 위 시뮬레이션 버튼은 별도의 무작위 환자를 1-1부터 자동으로 보여 주며, 화면의 단계 목록과 상태를 공유하지 않는다.
*
* 의료 화면의 설계 원칙(주피터 지시, 2026-11-25):
* 1. 환자는 다양하다 → 진술(증상)과 중증도가 환자마다 다르다(경증~중증). 환자의 나만의 AI 비서가 환자의 PDV 에서 생체 정보·질병 이력·가족력·생활 습관 등을 꺼내
*    익명화해(이름·주민번호는 빼고) 의료 AI 에 보낸다. 의료 AI 는 비서에게 더 물을 수 있다(알레르기, 최근 복용한 약 등). 본인 확인은 도착한 기관에서 환자 동의로만 한다.
* 2. 의료 AI 는 환자의 현재 위치를 근거로 가까운 기관 또는 멀리 있는 기관을 고른다. 기준은 "필요한 검사 장비를 모두 쓸 수 있고, 진료과 의사를 가장 빨리 만나는 곳"이다.
*    그 진료과 의사가 그곳에 없으면 → 경증·중등이면 환자는 장비가 있는 곳으로 가고 의사는 원격 협진으로 잇고(remote), 대면이 꼭 필요하면 의사가 자율주행차량을 타고 온다(split).
* 3. 환자 이송은 자율주행 이송차량이 한다. 중증이면 가까운 기관의 의료진이 먼저 차량에 동승한다(escort). 비어 있는 차량이 없으면 가장 가까운 차량을 돌려 보낸다(reassign).
* 4. 도착하면 증상에 맞는 검사(혈액·소변·X-ray·CT·MRI·초음파·심전도)를 하고, 결과를 모아 AI 가 진단 의견(진료 참고 목록)을 만든다. 질병 이름과 확률은 지어내지 않고
*    '후보 A/B/C' 자리표시와 근거(진술·생체·이력·가족력·생활·검사)만 보여 준다. 인간 의사가 이를 검토해 확진하고 처치·처방을 정한다(AI 는 결정하지 않는다).
* 5. 처치 뒤에는 경과를 관찰하고 AI 와 의사가 다시 협진해 새 처치·처방을 정하는 일을 퇴원·완치(또는 상급 기관 전원) 때까지 되풀이한다(4-4 의 라운드 표).
*
* 무엇이 실제이고 무엇이 아닌가(화면에도 한 줄로 적는다):
* - 위 원칙은 설계 단계이고 이 화면은 모의 체험이다. 기기·기관·건강보험·이송차량에 연결되어 있지 않고 어떤 것도 전송·조회·출동하지 않는다. 실제 위급 상황은 119, 진료는 의료 기관이 한다.
* - 환자·기관·의사·장비·검사 결과·이동 시간은 모두 가상 값이며 메모리 안에서만 계산한다(저장하지 않는다). 이 화면은 질병을 진단하거나 확률을 알려 주지 않는다.
* - 내 기기·꺼낼 정보는 사용자가 직접 정하는 기록이고 이 브라우저(localStorage)에만 저장된다(설계에서는 PDV 에 보관).
* - 기관 사이트 조회(진료·투약 내역, 접종 이력 등)는 나비웹 도우미에 맡기며 로그인은 사용자가 하고 조회까지만 한다.
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
var KEY = 'navi-med-v1', MAXD = 20;
var DEVICES = [['phone', '폰'], ['watch', '나비웹 워치'], ['ring', '링(팔찌)']];
var DEVKINDS = DEVICES.map(function (d) { return d[1]; });
/** 내 비서가 내 PDV 에서 꺼내 익명화해 의료 AI 에 보내는 정보. 위치는 이송에 꼭 필요해 항상 포함하고, 나머지는 항목마다 직접 정한다. 이름·주민번호는 어떤 경우에도 보내지 않는다. */
var SEND = [['loc', '현재 위치'], ['age', '나이·성별'], ['vit', '생체 정보(혈압·심박 등)'], ['hist', '질병 이력'], ['fam', '가족력'], ['life', '생활 습관(흡연·음주·운동)'], ['meds', '복용 중인 약']];
/** 의료 AI 가 내 비서에게 추가로 물을 수 있는 것(예시). 항목마다 답해도 되는지 직접 정한다. */
var ASKS = [['allergy', '알레르기 여부'], ['recent', '최근 먹은 것·복용한 약']];
var CALLS = [['voice', '말할 수 있음'], ['text', '문자를 입력할 수 있음'], ['none', '둘 다 어려움']];
var ANCH = { call:'med-list', flow:'med-list', follow:'med-list', match:'med-list', prep:'med-s-prep', devices:'med-s-prep', consent:'med-s-prep' };
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
function mockNote(t) { return h('div', { class:'note info', id:'med-mock', style:'margin:16px 0', text:t }); }

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

/** 의료 호출 메시지: 말할 수 있으면 음성, 문자를 입력할 수 있으면 문자를 함께 보내고, 그 밖에는 오직 '의료'만 보낸다(생체 정보와 PDV 정보가 대신 전달된다). */
function callMessage(can, said) {
  var t = clean(said, 120);
  if (can === 'voice') return { mode:'voice', label:'음성 + 의료', body:t || '(말한 내용이 음성으로 전달됩니다)', flag:'의료', only:false };
  if (can === 'text') return { mode:'text', label:'문자 + 의료', body:t || '(입력한 문자가 전달됩니다)', flag:'의료', only:false };
  return { mode:'none', label:'의료', body:'', flag:'의료', only:true };
}
function sharedItems(share) { return SEND.filter(function (f) { return f[0] === 'loc' || share[f[0]]; }).map(function (f) { return f[1]; }); }
function askItems(askok) { return ASKS.filter(function (f) { return askok[f[0]]; }).map(function (f) { return f[1]; }); }
function devSummary(list, today) {
  var t0 = today ? Date.parse(today + 'T00:00:00Z') : NaN, due = 0, carry = 0, by = {};
  list.forEach(function (x) { by[x.kind] = (by[x.kind] || 0) + 1; if (x.carry) carry++; if (x.chk && isFinite(t0) && Date.parse(x.chk + 'T00:00:00Z') <= t0) due++; });
  return { count:list.length, carry:carry, by:by, due:due };
}

// ── 의료 기관·이송 차량(가상 값) ──
var VEHICLES = [['V1', '자율주행 이송차량 1', 5, 6], ['V2', '자율주행 이송차량 2', 12, 8], ['V3', '자율주행 이송차량 3', 8, 13]];
var PLACES = [['p1', '가상 마을 가', 3, 5], ['p2', '가상 마을 나', 13, 9], ['p3', '가상 마을 다', 9, 16], ['p4', '가상 마을 라', 16, 12]];
var EQ_OF = { '혈액':'검사실', '소변':'검사실', 'X-ray':'X-ray', 'CT':'CT', 'MRI':'MRI', '초음파':'초음파', '심전도':'심전도' };
var TEST_MIN = { '혈액':15, '소변':10, 'X-ray':10, 'CT':20, 'MRI':40, '초음파':15, '심전도':10 };   // 검사 한 번에 걸리는 시간(분, 가정)
var PREP = 3;    // 의료진이 자율주행차량에 타기까지(분, 가정)
var BOARD = 2;   // 동승 의료진이 차량에 오르는 시간(분, 가정)
var LINK = 2;    // 원격 협진 화상을 잇는 시간(분, 가정)
var TURN = 3;    // 다른 일을 하던 차량을 돌려 보내는 시간(분, 가정)
function newHosp() {
  return [
    { id:'h1', lvl:'병원', name:'가상 중앙병원', x:4, y:4, docs:{ '내과':true, '외과':true, '신경과':false, '정형외과':true, '소아과':true, '피부과':false }, eq:{ '검사실':true, 'X-ray':true, 'CT':false, 'MRI':true, '초음파':true, '심전도':true } },
    { id:'h2', lvl:'병원', name:'가상 해안병원', x:14, y:5, docs:{ '내과':true, '외과':true, '신경과':true, '정형외과':false, '소아과':true, '피부과':false }, eq:{ '검사실':true, 'X-ray':true, 'CT':true, '초음파':true, '심전도':true } },
    { id:'h3', lvl:'병원', name:'가상 산악병원', x:6, y:15, docs:{ '내과':false, '신경과':true, '정형외과':true, '외과':false }, eq:{ '검사실':true, 'X-ray':true, 'CT':true, 'MRI':true } },
    { id:'h4', lvl:'의원', name:'가상 동부의원', x:17, y:13, docs:{ '내과':true, '소아과':true, '피부과':true }, eq:{ '검사실':true, 'X-ray':true, '초음파':true } },
    { id:'h5', lvl:'보건소', name:'가상 보건소', x:10, y:10, docs:{ '내과':true, '피부과':false }, eq:{ '검사실':true, 'X-ray':true, '심전도':true } }
  ];
}
function newFleet() { return VEHICLES.map(function (v) { return { id:v[0], name:v[1], x:v[2], y:v[3], free:true }; }); }
function dist(a, b) { return Math.max(1, Math.round(Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2)))); }   // 1km = 1분(가정)
function lerp(a, b, f) { return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; }
function eqsOf(c) { var o = []; c.tests.forEach(function (t) { if (o.indexOf(EQ_OF[t]) < 0) o.push(EQ_OF[t]); }); return o; }
function testMin(c) { return c.tests.reduce(function (s, t) { return s + TEST_MIN[t]; }, 0); }
function hasDoc(F, sp) { return F.docs[sp] === true; }
function eqOk(F, eqs) { return eqs.every(function (e) { return F.eq[e] === true; }); }
function kindRank(k) { var o = { single:0, remote:1, split:2 }; return o[k] == null ? 3 : o[k]; }
/** 환자 위치에서 이송차량·동승 의료진·기관을 한꺼번에 골라 가장 빨리 진료를 시작할 수 있는 계획을 만든다.
*  ① 차량: 비어 있는 차량 중 환자에게 가장 빨리 닿는 것. 중증이면 가까운 기관의 의료진이 먼저 타야 하므로(esc) 그 기관을 거쳐 가는 시간까지 계산해 더 빠른 쪽을 쓴다.
*     비어 있는 차량이 없으면 가장 가까운 차량을 돌려 보낸다(TURN).
*  ② 기관: 필요한 검사 장비를 모두 쓸 수 있는 기관만 후보다. 그곳에 진료과 의사가 있으면 single, 없고 원격 협진이 되는 진료면 다른 기관의 의사와 화상으로 잇고(remote, LINK 분),
*     원격이 안 되면 의사가 자율주행차량으로 오는 시간을 센다(split, PREP + 이동). 시작 = 환자 도착과 의사 도착이 모두 갖춰진 때.
*  ③ 후보가 하나도 없어도 이송은 해야 하므로, 가장 가까운 기관에서 안정화하는 계획(fb)을 함께 돌려주고 의료 AI 가 계속 지켜보다 가능해지면 바꾼다. 하류 단계는 go(= best 또는 fb)를 쓴다.
*  live({ at, prev })를 주면 이송 중(T+at분)에 다시 계산한다. 환자는 그 시각의 위치에서 새 목적지까지 걸리는 시간으로 계산하고, 차량·동승 의료진은 그대로 쓴다. 모든 시각은 처음 호출 때부터 센 절대 시각이다. */
function match(caseKey, placeKey, hosp, fleet, live) {
  var c = CASEBY[caseKey], pl = PLACES.filter(function (p) { return p[0] === placeKey; })[0]; if (!c || !pl) return null;
  var P = [pl[2], pl[3]], at = live ? live.at : 0, pg = live && live.prev ? live.prev.go : null, eqs = eqsOf(c), veh = null, why = [];
  if (pg && live.prev.veh) veh = live.prev.veh;
  else {
    var free = fleet.filter(function (v) { return v.free; }), pool = free.length ? free : fleet, turn = free.length ? 0 : TURN, cands = [];
    var meds = hosp.filter(function (F) { return Object.keys(F.docs).some(function (k) { return F.docs[k] === true; }); });
    pool.forEach(function (v) {
      var V = [v.x, v.y], plain = { v:v, eta:dist(V, P) + turn, esc:null }, via = null;
      meds.forEach(function (Mf) { var t = dist(V, [Mf.x, Mf.y]) + BOARD + dist([Mf.x, Mf.y], P) + turn; if (!via || t < via.eta) via = { v:v, eta:t, esc:Mf }; });
      cands.push(c.escort && via ? via : plain);   // 중증은 동승이 원칙이다: 동승 경로가 더 느려도 의료진 없이 보내지 않는다
    });
    cands.sort(function (a, b) { return a.eta - b.eta || a.v.id.localeCompare(b.v.id); });
    var w = cands[0]; veh = { id:w.v.id, name:w.v.name, eta:w.eta, esc:w.esc ? { id:w.esc.id, name:w.esc.name } : null, turned:!free.length, origin:[w.v.x, w.v.y] };
    if (!free.length) why.push(['이송차량', '비어 있는 차량이 없어 가장 가까운 ' + veh.name + '을 돌려 보내요']);
  }
  function tPat(F) {   // 환자가 F 에 닿는 시각
    if (!live || at <= veh.eta || !pg) return veh.eta + dist(P, [F.x, F.y]);
    var Fo = pg.fac, pos = lerp(P, [Fo.x, Fo.y], Math.min(1, (at - veh.eta) / dist(P, [Fo.x, Fo.y])));
    return at + dist(pos, [F.x, F.y]);
  }
  function enroute(D) { return !!(live && pg && pg.kind === 'split' && pg.doc.id === D.id && at > PREP); }
  function tDoc(D, F) {   // 의사 D 가 F 에 직접 닿는 시각
    if (!live) return PREP + dist([D.x, D.y], [F.x, F.y]);
    if (pg && pg.kind === 'split' && pg.doc.id === D.id) {
      if (at <= PREP) return PREP + dist([D.x, D.y], [F.x, F.y]);
      var Fo = pg.fac, pos = lerp([D.x, D.y], [Fo.x, Fo.y], Math.min(1, (at - PREP) / dist([D.x, D.y], [Fo.x, Fo.y])));
      return at + dist(pos, [F.x, F.y]);
    }
    return at + PREP + dist([D.x, D.y], [F.x, F.y]);
  }
  hosp.forEach(function (F) {
    eqs.forEach(function (e) { if (!(e in F.eq)) why.push([F.name, '필요한 장비(' + e + ')가 없어요']); else if (F.eq[e] !== true) why.push([F.name, e + '가 사용 중이에요']); });
    if (!(c.sp in F.docs)) why.push([F.name, c.sp + ' 의사가 없어요' + (c.remote ? '(원격 협진으로 잇는 중)' : '')]); else if (F.docs[c.sp] !== true) why.push([F.name, c.sp + ' 의사가 근무 중이 아니에요' + (c.remote ? '(원격 협진으로 잇는 중)' : '')]);
  });
  var opts = [];
  hosp.forEach(function (F) {
    if (c.sev === '중증' && F.lvl !== '병원') { why.push([F.name, '중증은 입원할 수 있는 병원급 기관이 필요해요(' + F.lvl + '은 안 돼요)']); return; }
    if (!eqOk(F, eqs)) return;
    var tp = tPat(F), others = hosp.filter(function (D) { return D !== F && hasDoc(D, c.sp); });
    if (hasDoc(F, c.sp) && !enroute(F)) { opts.push({ kind:'single', fac:F, doc:F, tPatient:tp, tDoc:0, start:tp }); return; }
    if (c.remote) { var D = others.slice().sort(function (a, b) { return dist([a.x, a.y], [F.x, F.y]) - dist([b.x, b.y], [F.x, F.y]) || a.id.localeCompare(b.id); })[0]; if (D) opts.push({ kind:'remote', fac:F, doc:D, tPatient:tp, tDoc:LINK, start:tp + LINK }); }
    else hosp.forEach(function (D) { if (hasDoc(D, c.sp) && (D !== F || enroute(D))) { var td = tDoc(D, F); opts.push({ kind:'split', fac:F, doc:D, tPatient:tp, tDoc:td, start:Math.max(tp, td) }); } });
  });
  opts.sort(function (a, b) { return a.start - b.start || kindRank(a.kind) - kindRank(b.kind) || a.fac.id.localeCompare(b.fac.id); });
  var best = opts[0] || null, fb = null;
  if (!best) {   // 조합이 없어도 환자는 가장 가까운 기관(근무 중인 의사가 있는 곳 우선)으로 옮겨 안정화한다
    var cand = hosp.filter(function (F) { return (c.sev !== '중증' || F.lvl === '병원') && Object.keys(F.docs).some(function (k) { return F.docs[k] === true; }); }); if (!cand.length) cand = hosp.filter(function (F) { return c.sev !== '중증' || F.lvl === '병원'; });
    cand.forEach(function (F) { var t = tPat(F); if (!fb || t < fb.tPatient) fb = { kind:'stabilize', fac:F, doc:F, tPatient:t, tDoc:0, start:t }; });
  }
  return { c:c, place:pl, veh:veh, options:opts, best:best, fb:fb, go:best || fb, why:why, at:at, eqs:eqs };
}
function endT(g) { return g.start; }
function planText(r) {
  var g = r.go; if (!g) return []; var c = r.c, s = [], v = r.veh;
  if (r.at) s.push(v.name + '은 환자를 태운 채 이동을 이어 가고, 목적지만 새 계획에 맞춰 바꿔요.');
  else s.push('호출 위치(' + r.place[1] + ')에서 ' + (v.turned ? '비어 있는 차량이 없어 가장 가까운 ' : '가장 빨리 닿는 ') + v.name + '(' + v.eta + '분)을 보내요.' + (v.esc ? ' 중증이라 먼저 ' + v.esc.name + '의 의료진을 태워 동승시켜요.' : ''));
  if (g.kind === 'single') s.push(g.fac.name + '에 ' + c.sp + ' 의사와 필요한 검사 장비(' + r.eqs.join('·') + ')가 모두 있어, 환자를 그곳으로 이송해요(' + g.tPatient + '분 후 도착).');
  else if (g.kind === 'remote') { s.push('환자는 필요한 장비(' + r.eqs.join('·') + ')를 쓸 수 있는 ' + g.fac.name + '으로 이송해요(' + g.tPatient + '분 후 도착).'); s.push(g.doc.name + '의 ' + c.sp + ' 의사와는 화상 원격 협진으로 이어요(연결 ' + LINK + '분 — 환자가 도착하면 바로 협진). 검사는 현장 의료진이 하고 판단은 원격 의사가 해요.'); }
  else if (g.kind === 'split') { s.push('환자는 필요한 장비를 쓸 수 있는 ' + g.fac.name + '으로 이송해요(' + g.tPatient + '분 후 도착).'); s.push(g.doc === g.fac ? '이미 출발한 ' + c.sp + ' 의사는 차량을 돌려 ' + g.fac.name + '으로 돌아와요(' + g.tDoc + '분 후 도착).' : '직접 봐야 하는 진료라 ' + g.doc.name + '의 ' + c.sp + ' 의사를 자율주행차량에 태워 ' + g.fac.name + '으로 보내요(' + g.tDoc + '분 후 도착' + (r.at ? '' : ', 준비 ' + PREP + '분 포함') + ').'); }
  else { s.push('필요한 장비와 ' + c.sp + ' 의사를 함께 맞출 수 있는 조합이 없어, 환자를 가장 가까운 ' + g.fac.name + '으로 이송해 안정화해요(' + g.tPatient + '분 후 도착).'); s.push('의료 AI는 기관 현황을 계속 확인하다가 조합이 가능해지면 상급 기관으로 전원을 안내해요.'); }
  s.push(g.kind === 'stabilize' ? '기초 진료는 약 ' + g.start + '분 뒤 ' + g.fac.name + '에서 시작돼요. 이송차량에는 환자 상태와 목적지를 실시간으로 알려 줘요.' : '검사와 진료는 약 ' + g.start + '분 뒤 ' + g.fac.name + '에서 시작돼요. 이송차량에는 환자 상태와 목적지를 실시간으로 알려 줘요.');
  return s;
}
function mapSvg(r, hosp, fleet) {
  var K = 11, W = 20 * K + 20, ns = 'http://www.w3.org/2000/svg';
  function e(t, a, tx) { var n = document.createElementNS(ns, t), k; for (k in a) n.setAttribute(k, a[k]); if (tx != null) n.textContent = tx; return n; }
  var svg = e('svg', { viewBox:'0 0 ' + W + ' ' + W, role:'img', 'aria-label':'가상 지도: 의료 기관, 이송차량, 환자 위치와 선택된 이동 경로', style:'width:100%;max-width:440px;border:1px solid var(--line);border-radius:12px;background:var(--soft)' });
  function X(v) { return 10 + v * K; }
  var b = r.go, P = [r.place[2], r.place[3]];
  if (b) {
    svg.appendChild(e('line', { x1:X(P[0]), y1:X(P[1]), x2:X(b.fac.x), y2:X(b.fac.y), stroke:'#1A5FB4', 'stroke-width':2.5 }));
    if (b.kind === 'split') svg.appendChild(e('line', { x1:X(b.doc.x), y1:X(b.doc.y), x2:X(b.fac.x), y2:X(b.fac.y), stroke:'#1E7B46', 'stroke-width':2.5, 'stroke-dasharray':'5 3' }));
    if (b.kind === 'remote') svg.appendChild(e('line', { x1:X(b.doc.x), y1:X(b.doc.y), x2:X(b.fac.x), y2:X(b.fac.y), stroke:'#7B4FD0', 'stroke-width':2, 'stroke-dasharray':'2 3' }));
  }
  hosp.forEach(function (F) { var on = b && (F === b.fac || F === b.doc); svg.appendChild(e('rect', { x:X(F.x) - 7, y:X(F.y) - 7, width:14, height:14, rx:3, fill:on ? '#1E7B46' : '#fff', stroke:'#49505A' })); svg.appendChild(e('text', { x:X(F.x), y:X(F.y) - 10, 'text-anchor':'middle', 'font-size':9, fill:'#49505A' }, F.name.replace('가상 ', ''))); });
  fleet.forEach(function (u) { var on = u.id === r.veh.id; svg.appendChild(e('polygon', { points:X(u.x) + ',' + (X(u.y) - 6) + ' ' + (X(u.x) - 5) + ',' + (X(u.y) + 4) + ' ' + (X(u.x) + 5) + ',' + (X(u.y) + 4), fill:on ? '#1A5FB4' : '#9AA3B2' })); });
  svg.appendChild(e('circle', { cx:X(P[0]), cy:X(P[1]), r:6, fill:'#C9302C' })); svg.appendChild(e('text', { x:X(P[0]) + 9, y:X(P[1]) + 4, 'font-size':9, fill:'#C9302C' }, '환자'));
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

function setSimBtn() { var b = $('med-sim'); if (b) b.disabled = !!S.auto; }
function topbar() { return h('div', { class:'topin' }, [h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 의료' })])]), h('button', { type:'button', class:'btn tonal simbtn', id:'med-sim', text:'🧪 시뮬레이션', 'aria-label':'자동 시뮬레이션 열기', disabled:S.auto ? true : null, onclick:openAuto })]); }
function kv(k, v, id) { return h('div', { class:'kv' }, [h('span', { text:k }), h('b', { id:id || null, text:v })]); }
function step(n, title, kids, id) {
  return h('div', { class:'card col', id:id || null, style:'margin-top:16px' }, [h('div', { class:'rowf' }, [pill(String(n), 'm'), h('b', { style:'font-size:17px', text:title })])].concat(kids));
}

// ── 평소 준비: 내 기기 ──
function devicesBody() {
  var m = devSummary(S.dev, kst()), f = S.form, e = S.err, kids = [];
  kids.push(h('b', { style:'font-size:16px', text:'내 기기' }));
  kids.push(h('div', { class:'sub', text:'폰·나비웹 워치·링(팔찌) 중 적어도 하나를 24시간 가까이 두어야 의료 호출이 가능합니다. 직접 적는 기록이며, 기기가 나비웹에 연결되는 기능은 아직 없어요.' }));
  kids.push(h('div', { class:'g4' }, [tile('등록한 기기', m.count + '개', '', 'med-d0'), tile('24시간 가까이 두는 기기', m.carry + '개', m.carry ? '' : '하나 이상 필요해요', 'med-d2'), tile('점검일 지남·오늘', m.due + '개', '', 'med-d1')]));
  kids.push(h('div', { class:'frm' }, [sel('med-dk', '종류', f.kind, DEVKINDS.map(function (k) { return [k, k]; }), function (v) { f.kind = v; }), field('med-dn', '기기 이름', f.name, { err:e.name, ph:'예: 내 폰', max:40, set:function (v) { f.name = v; } }), field('med-dc', '다음 점검·충전일(선택)', f.chk, { err:e.chk, ph:'2027-01-31', mode:'numeric', max:10, set:function (v) { f.chk = v.trim(); } })]));
  kids.push(h('label', { class:'chk', for:'med-dcarry' }, [(function () { var c = h('input', { type:'checkbox', id:'med-dcarry', checked:f.carry !== false ? true : false }); c.onchange = function () { f.carry = c.checked; }; return c; })(), h('span', { text:'24시간 가까이 둡니다' })]));
  kids.push(h('div', { class:'rowf' }, [btn('기록하기', 'fill', addDev), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null]));
  if (!S.dev.length) kids.push(h('div', { class:'empty', text:'아직 등록한 기기가 없어요.' }));
  else kids.push(h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['종류', '이름', '24시간', '점검일', ''].map(function (t) { return h('th', { text:t }); }))]),
    h('tbody', {}, S.dev.map(function (x) { return h('tr', {}, [h('td', {}, [pill(x.kind)]), h('td', {}, [h('b', { text:x.name })]), h('td', { text:x.carry ? '예' : '아니요' }), h('td', { class:'num', text:x.chk || '—' }), h('td', { class:'r' }, [btn('삭제', 'sm quiet', function () { S.dev = S.dev.filter(function (y) { return y.id !== x.id; }); S.msg = '삭제했어요.'; save(); render(); })])]); }))])]));
  return h('div', { class:'col' }, kids);
}

// ── 평소 준비: 보내는 정보 ──
function consentBody() {
  var n = h('span', { class:'sub', id:'med-c-n' }), n2 = h('span', { class:'sub', id:'med-a-n' });
  function tally() { n.textContent = '보내기로 고른 항목 ' + Object.keys(S.share).length + ' / ' + (SEND.length - 1) + ' (현재 위치 제외)'; n2.textContent = '답해도 되는 질문 ' + Object.keys(S.askok).length + ' / ' + ASKS.length; }
  function list(items, store, pre, fixedKey) {
    return h('div', {}, items.map(function (f) { var id = pre + f[0], cb = h('input', { type:'checkbox', id:id, checked:f[0] === fixedKey || store[f[0]] ? true : false, disabled:f[0] === fixedKey ? true : null });
      cb.onchange = function () { if (cb.checked) store[f[0]] = 1; else delete store[f[0]]; save(); tally(); sumUpdate(); }; return h('label', { class:'chk', for:id }, [cb, h('span', { text:f[1] + (f[0] === fixedKey ? ' (항상 포함)' : '') })]); }));
  }
  var box = h('div', { class:'col' }, [h('b', { style:'font-size:16px', text:'내 비서가 내 PDV에서 꺼내 의료 AI에 보낼 정보(익명화)' }),
    h('div', { class:'sub', text:'현재 위치는 이송에 꼭 필요해 항상 포함됩니다(이름·주민번호는 어떤 경우에도 보내지 않아요). 나머지는 항목마다 직접 정하고, 고른 상태는 이 브라우저에만 저장돼요. 아래 시뮬레이션은 이 선택과 상관없이 모든 항목을 보낸 경우를 보여 줍니다.' }),
    n, list(SEND, S.share, 'med-sh-', 'loc'), h('div', { class:'rowf' }, [btn('모두 해제', 'quiet', function () { S.share = {}; save(); render(); })]),
    h('b', { style:'font-size:16px;margin-top:8px', text:'의료 AI가 내 비서에게 추가로 물어도 되는 것' }), n2, list(ASKS, S.askok, 'med-ak-', null), h('div', { class:'sub', text:'예시입니다. 내 비서는 허용한 질문에만 내 기록을 바탕으로 답해요. 아래 시뮬레이션은 비서가 모두 답한 경우를 보여 줍니다.' })]);
  tally(); return box;
}
function prepSummary() { var m = devSummary(S.dev, kst()); return '평소 준비 — 기기 ' + m.count + '개(24시간 가까이 ' + m.carry + '개) · 보내는 정보 ' + sharedItems(S.share).length + '항목 · 허용한 질문 ' + askItems(S.askok).length + '개'; }
function sumUpdate() { var s = $('med-prep-sum'); if (s) s.textContent = prepSummary(); }
function prepSection() {
  var det = h('details', { id:'med-s-prep', class:'card', style:'margin-top:16px' }, [h('summary', { id:'med-prep-sum', style:'cursor:pointer;font-weight:700;font-size:17px', text:prepSummary() }),
    h('div', { class:'col', style:'margin-top:16px;gap:24px' }, [devicesBody(), consentBody()])]);
  det.open = !!S.prepOpen; det.ontoggle = function () { S.prepOpen = det.open; };
  return det;
}

/* 나비웹 도우미로 기관 사이트 조회 열기 — 로그인·인증은 사용자, 조회까지만 한다. 호스트는 NaviMedical.agentResult(ok, msg) 로 결과를 돌려준다. */
var AG = [["nhis", "내 진료·투약 내역 조회(건강보험공단)", "https://www.nhis.or.kr"], ["kdca", "예방접종 이력 조회(질병관리청)", "https://nip.kdca.go.kr"], ["hira", "병원·약국 찾기(심평원)", "https://www.hira.or.kr"]], AGG = {"nhis": "국민건강보험공단에서 내 진료·투약 내역 조회", "kdca": "질병관리청 예방접종도우미에서 내 접종 이력 조회", "hira": "건강보험심사평가원에서 병원·약국 정보 조회"};
function agentResult(ok, msg) { S.agMsg = clean(msg, 160) || (ok ? '도우미가 시작합니다.' : '도우미에 맡기지 못했어요.'); render(); }
function handOff() {
  var it = AG.filter(function (x) { return x[0] === S.ag; })[0] || AG[0];
  S.agMsg = '도우미에 맡기는 중…'; render();
  if (!(LS.agent && LS.agent.length)) return agentResult(false, '나비웹 도우미를 쓸 수 없는 화면이에요.');
  emit('agent', { kind:it[0], label:it[1], url:it[2], goal:AGG[it[0]] });
}
function agentCard() {
  var s = h('select', { id:'med-ag', 'aria-label':'도우미로 열 사이트' }, AG.map(function (x) { return h('option', { value:x[0], text:x[1] }); })); s.value = S.ag || AG[0][0]; s.onchange = function () { S.ag = s.value; };
  return h('div', { class:'card col', id:'med-agent', style:'margin-top:16px' }, [h('b', { text:'의료 조회는 도우미에게 (나비웹 도우미)' }),
    h('div', { class:'sub', text:'진료·투약 내역이나 접종 이력, 병원·약국 정보를 도우미가 해당 사이트에서 열어 줍니다. 본인인증은 내가 하고, 조회까지만 해요. 예약·결제·서류 제출은 하지 않아요.' }),
    h('div', { class:'rowf' }, [s, btn('도우미로 열기', '', handOff)]),
    S.agMsg ? h('div', { class:'sub', id:'med-ag-msg', text:S.agMsg }) : null]);
}

// ── 가상 환자(무작위) ──
/** 환자는 다양하다: 진술·중증도·진료과·필요한 검사가 서로 다르다. 질병 이름과 확률은 지어내지 않고 '후보 A/B/C' 자리표시와 근거만 둔다.
*  cand[i] = { ev:근거 항목, base:진술·PDV 만으로 본 점수, t:{ 검사:이상일 때 더해지는 점수 } } — 점수는 순서를 정하는 데만 쓰고 화면에 확률로 보이지 않는다. */
var CASES = [
  { id:'back', name:'허리 통증과 다리 저림', say:'허리가 아프고 왼쪽 다리가 저려요', can:'text', sp:'정형외과', tests:['혈액', 'X-ray', 'MRI'], sev:'중등', remote:true, escort:false, age:[34, 62], vit:'혈압 128/82 · 심박 78회/분 · 체온 36.6℃',
    hist:'허리 디스크(5년 전)', fam:'아버지 척추 질환', life:'흡연 안 함 · 음주 주 1~2회 · 운동 거의 안 함', meds:'진통제 가끔 복용', tx:['안정과 자세 교정', '필요하면 물리치료·약물 치료'],
    asks:[['알레르기가 있나요?', '없음(가상)'], ['최근 먹은 것·복용한 약은?', '어제부터 진통제 두 번(가상)']],
    cand:[{ ev:['진술', '질병 이력'], base:3, t:{ 'MRI':3, 'X-ray':1 } }, { ev:['진술', '생활 습관'], base:2, t:{ 'X-ray':3, '혈액':1 } }, { ev:['가족력'], base:1, t:{ '혈액':3, 'MRI':1 } }] },
  { id:'belly', name:'오른쪽 아랫배 통증', say:'배가 아침부터 계속 아파요', can:'voice', sp:'외과', tests:['혈액', '초음파', 'CT'], sev:'중등', remote:false, escort:false, age:[19, 45], vit:'혈압 118/74 · 심박 96회/분 · 체온 37.9℃',
    hist:'특이 병력 없음', fam:'특이 사항 없음', life:'흡연 안 함 · 음주 거의 안 함 · 운동 주 1~2회', meds:'복용 약 없음', tx:['금식과 수액', '수술 또는 약물 치료 중 의사가 선택'],
    asks:[['알레르기가 있나요?', '없음(가상)'], ['마지막으로 먹은 것은?', '어제 저녁(가상)']],
    cand:[{ ev:['진술', '생체 정보'], base:3, t:{ '초음파':3, 'CT':2, '혈액':2 } }, { ev:['진술'], base:2, t:{ 'CT':3, '혈액':1 } }, { ev:['생활 습관'], base:1, t:{ '혈액':2, '초음파':1 } }] },
  { id:'neuro', name:'심한 두통과 한쪽 손 저림', say:'', can:'none', sp:'신경과', tests:['혈액', 'CT'], sev:'중증', remote:false, escort:true, age:[55, 78], vit:'혈압 172/98 · 심박 92회/분 · 산소포화도 97%',
    hist:'고혈압 · 심방세동', fam:'어머니 뇌혈관 질환', life:'흡연 과거에 함 · 음주 주 3회 이상 · 운동 거의 안 함', meds:'혈압약 복용 중', tx:['즉시 안정과 모니터링', '입원 치료 계획'],
    asks:[['증상이 시작된 시각은?', '약 1시간 전(가상)'], ['복용 중인 혈액 응고 관련 약은?', '있음(가상)']],
    cand:[{ ev:['생체 정보', '질병 이력'], base:3, t:{ 'CT':3, '혈액':1 } }, { ev:['진술', '가족력'], base:2, t:{ 'CT':2, '혈액':2 } }, { ev:['생활 습관'], base:1, t:{ '혈액':3 } }] },
  { id:'child', name:'어린이 고열과 기침', say:'아이가 열이 나고 기침이 심해요', can:'voice', sp:'소아과', tests:['혈액', 'X-ray'], sev:'경증', remote:true, escort:false, age:[3, 9], guardian:'보호자', vit:'체온 38.8℃ · 심박 118회/분 · 호흡 28회/분',
    hist:'특이 병력 없음', fam:'특이 사항 없음', life:'예방접종 일정대로 완료', meds:'해열제 한 번 복용', tx:['휴식과 수분 보충', '필요하면 약물 치료'],
    asks:[['알레르기가 있나요?', '없음(가상)'], ['열이 시작된 때는?', '이틀 전부터(가상)']],
    cand:[{ ev:['진술', '생체 정보'], base:3, t:{ 'X-ray':3, '혈액':2 } }, { ev:['진술'], base:2, t:{ '혈액':3, 'X-ray':1 } }, { ev:['생체 정보'], base:1, t:{ 'X-ray':2 } }] },
  { id:'chest', name:'가슴 답답함과 숨참', say:'가슴이 답답하고 숨이 차요', can:'voice', sp:'내과', tests:['심전도', '혈액', 'X-ray'], sev:'중증', remote:false, escort:true, age:[50, 74], vit:'혈압 98/62 · 심박 112회/분 · 산소포화도 93%',
    hist:'고혈압 · 당뇨', fam:'아버지 심장 질환', life:'흡연 현재 함 · 음주 주 1~2회 · 운동 거의 안 함', meds:'혈압약·당뇨약 복용 중', tx:['즉시 모니터링과 산소 공급', '입원 치료 계획'],
    asks:[['알레르기가 있나요?', '없음(가상)'], ['통증이 시작된 때는?', '40분 전부터(가상)']],
    cand:[{ ev:['생체 정보', '가족력'], base:3, t:{ '심전도':3, '혈액':3 } }, { ev:['진술', '생활 습관'], base:2, t:{ 'X-ray':3, '심전도':1 } }, { ev:['질병 이력'], base:1, t:{ '혈액':2, 'X-ray':1 } }] },
  { id:'skin', name:'온몸에 번지는 발진', say:'', can:'text', sp:'피부과', tests:['혈액'], sev:'경증', remote:true, escort:false, age:[20, 58], vit:'혈압 120/76 · 심박 80회/분 · 체온 36.8℃',
    hist:'알레르기성 비염', fam:'특이 사항 없음', life:'흡연 안 함 · 음주 주 1~2회 · 운동 주 3회 이상', meds:'복용 약 없음', tx:['원인 물질 피하기', '필요하면 연고·약물 치료'],
    asks:[['새로 먹은 음식·약·화장품은?', '이틀 전 새 비누(가상)'], ['알레르기가 있나요?', '꽃가루(가상)']],
    cand:[{ ev:['질병 이력', '진술'], base:3, t:{ '혈액':3 } }, { ev:['진술'], base:2, t:{ '혈액':1 } }, { ev:['생활 습관'], base:1, t:{ '혈액':2 } }] },
  { id:'ankle', name:'넘어진 뒤 발목이 붓고 아픔', say:'발목을 접질렸어요', can:'voice', sp:'정형외과', tests:['X-ray'], sev:'경증', remote:true, escort:false, age:[16, 50], vit:'혈압 122/78 · 심박 84회/분',
    hist:'특이 병력 없음', fam:'특이 사항 없음', life:'흡연 안 함 · 음주 주 1~2회 · 운동 주 3회 이상', meds:'복용 약 없음', tx:['고정과 냉찜질', '필요하면 재활 치료'],
    asks:[['알레르기가 있나요?', '없음(가상)'], ['체중을 실을 수 있나요?', '조금만 가능(가상)']],
    cand:[{ ev:['진술'], base:3, t:{ 'X-ray':3 } }, { ev:['진술', '생활 습관'], base:2, t:{ 'X-ray':1 } }, { ev:['질병 이력'], base:1, t:{ 'X-ray':2 } }] },
  { id:'sugar', name:'어지러움과 식은땀(당뇨 환자)', say:'어지럽고 식은땀이 나요', can:'voice', sp:'내과', tests:['혈액', '소변', '심전도'], sev:'중등', remote:true, escort:false, age:[45, 72], vit:'혈압 106/68 · 심박 102회/분 · 혈당 측정값 낮음',
    hist:'당뇨(10년)', fam:'어머니 당뇨', life:'흡연 안 함 · 음주 안 함 · 운동 주 1~2회', meds:'당뇨약 복용 중', tx:['혈당 안정과 모니터링', '복용 약 조정'],
    asks:[['마지막으로 먹은 것은?', '5시간 전(가상)'], ['복용한 당뇨약은?', '평소대로(가상)']],
    cand:[{ ev:['질병 이력', '생체 정보'], base:3, t:{ '혈액':3, '소변':1 } }, { ev:['진술'], base:2, t:{ '심전도':3, '혈액':1 } }, { ev:['가족력', '생활 습관'], base:1, t:{ '소변':3 } }] }
];
var CASEBY = {}; CASES.forEach(function (x) { x.kind = x.sp; CASEBY[x.id] = x; });
var NAMES = ['김가온', '이서연', '박도윤', '최하린', '정민준', '한지우', '오세아', '윤태양'];
var ABC = ['A', 'B', 'C'];
var ONSITE_NOTE = '아래 진료 내용은 모두 가상 시나리오이며 실제 진단·처방이 아닙니다.';
function pick(a, r) { return a[Math.min(a.length - 1, Math.floor(r() * a.length))]; }
function sig(txt) {
  function f(x) { var v = 2166136261, i; for (i = 0; i < x.length; i++) { v ^= x.charCodeAt(i); v = Math.imul(v, 16777619) >>> 0; } return ('00000000' + v.toString(16)).slice(-8); }
  return 'SIG-' + f(txt) + f(txt + '#');
}
function clock(ms) { return new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Seoul', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(new Date(ms)); }
/** 진료 참고 목록: 진술·PDV 점수(base)에 이상으로 나온 검사의 점수를 더해 순서를 매긴다. res 가 없으면 검사 전 순서다. 동점이면 앞 후보가 먼저. */
function rankList(c, res) {
  var L = c.cand.map(function (x, i) { var s = x.base, ev = x.ev.slice(); if (res) c.tests.forEach(function (t) { if (res[t] && x.t[t]) { s += x.t[t]; if (ev.indexOf('검사') < 0) ev.push('검사'); } }); return { i:i, name:'후보 ' + ABC[i], score:s, ev:ev }; });
  L.sort(function (a, b) { return b.score - a.score || a.i - b.i; });
  return L;
}
/** 경과: 처치 뒤 며칠마다 AI·의사가 다시 협진하고 처치를 정하는 일을 퇴원·전원 때까지 되풀이한다. 호전이 충분하면(경증 1번, 그 밖 2번) 퇴원하고, 악화가 두 번이면 상급 기관으로 전원한다. */
function mkCourse(sev, r) {
  var cut = { '경증':[0.8, 0.95], '중등':[0.6, 0.85], '중증':[0.45, 0.75] }[sev], step = { '경증':3, '중등':2, '중증':1 }[sev], need = sev === '경증' ? 1 : 2;
  var rounds = [], good = 0, bad = 0, day = 0, end = null, n = 0;
  while (!end && n < 5) {
    n++; day += step; var x = r(), trend = x < cut[0] ? '호전' : x < cut[1] ? '변화 없음' : '악화', rd = { n:n, day:day, trend:trend };
    if (trend === '호전') { good++; rd.ai = '진료 참고 목록 유지 — 회복 지표를 확인했어요'; rd.doc = good >= need ? '퇴원 기준 충족 — 퇴원 결정' : '처치를 줄이며 경과 관찰'; }
    else if (trend === '변화 없음') { rd.ai = '순위를 다시 계산하고 추가 검사를 제안했어요'; rd.doc = '추가 검사 또는 처치 조정'; }
    else { bad++; rd.ai = '목록 순위가 바뀌어 전문의 재협진을 요청했어요'; rd.doc = bad >= 2 ? '상급 기관 전원 결정' : '처치를 바꾸고 관찰을 늘림'; }
    rounds.push(rd);
    if (good >= need) end = sev === '경증' && rounds[rounds.length - 1].trend === '호전' && bad === 0 ? '완치(퇴원)' : '퇴원(외래 추적)'; else if (bad >= 2) end = '상급 기관 전원';
  }
  if (!end) { end = '퇴원(외래 추적)'; rounds[rounds.length - 1].doc += ' — 외래에서 계속 봐요'; }
  return { rounds:rounds, end:end, days:day };
}
/** 기기·환자·위치·검사 결과·경과를 무작위로 뽑는다. rng 를 넘기면 같은 값이 나온다(시험용). */
function draw(rng, now) {
  var r = typeof rng === 'function' ? rng : Math.random, t0 = now == null ? Date.now() : now;
  var c = pick(CASES, r), dev = pick(DEVICES, r), pl = pick(PLACES, r), kid = !!c.guardian;
  var age = c.age[0] + Math.floor(r() * (c.age[1] - c.age[0] + 1)), pn = pick(NAMES, r), rn = kid ? pick(NAMES, r) : pn;
  var can = dev[0] === 'ring' ? 'none' : dev[0] === 'watch' ? (c.can === 'none' ? 'none' : 'voice') : c.can;
  var pAb = { '경증':0.3, '중등':0.5, '중증':0.7 }[c.sev], res = {};
  c.tests.forEach(function (t) { res[t] = r() < pAb; });
  var sc = { c:c, inc:c, dev:dev[0], devName:dev[1], place:pl[0], placeName:pl[1], xy:[pl[2], pl[3]], can:can, say:can === 'none' ? '' : c.say, t0:t0,
    reporter:{ name:rn, rel:kid ? '보호자' : '본인' }, patient:{ name:pn, age:age, ageText:age + '세', sex:pick(['남', '여'], r), blood:pick(['A+', 'B+', 'O+', 'AB+', 'A-', 'O-'], r) }, res:res };
  sc.anon = 'ANON-' + sig(pn + age + pl[1] + t0).slice(4, 10).toUpperCase();
  var m = callMessage(sc.can, sc.say); sc.msg = m;
  sc.rank0 = rankList(c, null); sc.rank1 = rankList(c, res);
  var agree = r() >= 0.3; sc.doc = { agree:agree, pick:agree ? sc.rank1[0].i : sc.rank1[1].i, why:agree ? '진찰 소견이 AI 순위와 같아 1순위로 확진해요' : '진찰 소견이 AI 순위와 달라 2순위로 확진해요 — 최종 판단은 의사의 몫이에요' };
  sc.course = mkCourse(c.sev, r);
  sc.payload = [m.label, m.body, sc.anon, c.vit, c.hist, c.fam, c.life, c.meds, pl[1], t0].join('|') + '|' + sc.dev;
  sc.sig = sig(sc.payload); sc.no = 'MD-' + sc.sig.slice(4, 10).toUpperCase();
  return sc;
}
function verify(sc) { return sig(sc.payload) === sc.sig; }
/** 호출 위치에서 기관마다 닿는 시간과 그 진료에 필요한 의사·장비 상태를 모은다. */
function gather(sc, hosp, fleet) {
  var P = sc.xy, c = sc.c, eqs = eqsOf(c);
  var veh = fleet.map(function (v) { return { id:v.id, name:v.name, eta:dist([v.x, v.y], P), free:v.free }; }).sort(function (a, b) { return a.eta - b.eta; });
  var hs = hosp.map(function (F) { return { F:F, move:dist(P, [F.x, F.y]), doc:c.sp in F.docs ? (F.docs[c.sp] ? '근무 중' : '비번') : '의사 없음', eqs:eqs.map(function (e) { return [e, e in F.eq ? (F.eq[e] ? '가능' : '사용 중') : '없음']; }) }; });
  return { veh:veh, hosp:hs, eqs:eqs };
}
function form(groups) {
  var kids = [];
  groups.forEach(function (g) { kids.push(h('div', { class:'lab', style:'margin:12px 0 4px', text:g[0] })); g[1].forEach(function (p) { if (p) kids.push(kv(p[0], p[1], p[2])); }); });
  return h('div', { style:'border:1px solid var(--line);border-radius:12px;padding:4px 16px 12px' }, kids);
}
function sub(t) { return h('b', { style:'display:block;margin-top:8px', text:t }); }

// ── 시뮬레이션 한 번(run) ──
// run = { sc:환자, hosp:지금의 기관 현황, fleet:지금의 차량 현황, hosp0·fleet0:계획 확정 때의 현황, plan0:확정한 계획, ev:이송 중 갱신, t:시간 막대, reached:열 수 있는 가장 먼 단계, cur:보고 있는 단계 }
// 화면의 단계 목록과 오른쪽 위 시뮬레이션 버튼은 서로 다른 run 을 쓰므로 서로 영향을 주지 않는다.
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function newRun() { return { sc:draw(Math.random), hosp:newHosp(), fleet:newFleet(), hosp0:null, fleet0:null, plan0:null, ev:null, t:0, reached:0, cur:-1, picked:false, seen:false }; }
function shake(R) {
  R.hosp.forEach(function (F) { Object.keys(F.docs).forEach(function (k) { if (Math.random() < 0.12) F.docs[k] = !F.docs[k]; }); Object.keys(F.eq).forEach(function (k) { if (Math.random() < 0.12) F.eq[k] = !F.eq[k]; }); });
  R.fleet.forEach(function (v) { if (Math.random() < 0.2) v.free = false; });
}
/** 3-1 에서 지시서를 보내는 순간 계획과 그때의 기관·차량 현황을 굳힌다. 이후 현황이 바뀌어도(3-5) 앞 단계는 그때의 판단을 그대로 보여 준다. */
function lock(R) { if (R.plan0) return; R.hosp0 = clone(R.hosp); R.fleet0 = clone(R.fleet); R.plan0 = match(R.sc.c.id, R.sc.place, R.hosp0, R.fleet0); }
function ctx(R, re) {
  var sc = R.sc, locked = !!R.plan0, hd = locked ? R.hosp0 : R.hosp, fd = locked ? R.fleet0 : R.fleet, dec = locked ? R.plan0 : match(sc.c.id, sc.place, R.hosp, R.fleet);
  return { R:R, re:re, sc:sc, locked:locked, hosp:hd, fleet:fd, g:gather(sc, hd, fd), dec:dec, fin:R.ev ? R.ev.after : dec };
}
/** 단계 결과를 그리는 곳(페이지 패널 / 시뮬레이션 패널)마다 id 앞머리가 달라, 두 패널이 같은 id 를 갖지 않는다. */
var PF = 'med-';
function X(id) { return PF + id; }
function none(id, t) { return [h('div', { class:'sub', id:id, text:t })]; }
var KIND = { single:'그 기관에서 바로', remote:'원격 협진', split:'의사가 이동', stabilize:'안정화 후 전원' };
function rows3(rows) { return rows.length ? h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('m-opts') }, [h('thead', {}, [h('tr', {}, ['방식', '진료 기관', '의사', '환자 도착', '시작'].map(function (t, i) { return h('th', { class:i > 2 ? 'r' : '', text:t }); }))]), h('tbody', {}, rows)])]) : h('div', { class:'empty', text:'가능한 조합이 없어요.' }); }
function docWho(r) { var g = r.go, sp = r.c.sp; return g.kind === 'single' ? g.fac.name + ' ' + sp + ' 의사' : g.kind === 'remote' ? g.doc.name + ' ' + sp + ' 의사(원격)' : g.kind === 'split' ? g.doc.name + ' ' + sp + ' 의사' : g.fac.name + ' 당직 의사'; }
function dispatchList(sc, r) {
  var g = r.go, c = r.c, v = r.veh; if (!g) return [];
  var L = [{ k:'veh', who:v.name + (v.esc ? ' + ' + v.esc.name + ' 동승 의료진' : ''), order:'호출 위치(' + sc.placeName + ')로 가' + (v.esc ? '(먼저 ' + v.esc.name + '에서 의료진을 태웁니다)' : '') + ' 환자를 태우고 ' + g.fac.name + '으로 이송합니다. 이송 중에는 생체 정보를 실시간으로 의료 AI에 보내요.', due:v.eta + '분 뒤 환자 탑승 · ' + g.tPatient + '분 뒤 기관 도착' }];
  if (g.kind === 'split') L.push({ k:'doc', who:docWho(r), order:'대기 중인 자율주행차량(가상)에 타고 ' + g.fac.name + '으로 이동해 환자를 직접 진료할 준비를 합니다.', due:g.tDoc + '분 뒤 도착(준비 ' + PREP + '분 포함)' });
  else if (g.kind === 'remote') L.push({ k:'doc', who:docWho(r), order:'환자가 ' + g.fac.name + '에 도착하면 화상으로 연결해 검사 결과를 함께 보고 진료합니다(연결 ' + LINK + '분).', due:g.start + '분에 협진 시작' });
  else if (g.kind === 'single') L.push({ k:'doc', who:docWho(r), order:'그 자리에서 환자를 맞을 준비를 합니다.', due:'즉시 대기' });
  else L.push({ k:'doc', who:docWho(r), order:'환자를 맞아 안정화 진료를 준비합니다. 필요한 의사·장비 조합이 가능해지면 의료 AI가 전원을 안내해요.', due:'즉시 대기' });
  L.push({ k:'fac', who:g.fac.name + ' 시설·장비', order:(g.kind === 'stabilize' ? '진료실 자리와 기본 검사를 준비합니다.' : '검사 장비(' + r.eqs.join('·') + ') 예약을 확정하고 수용 준비를 합니다.') + ' 환자가 오기 전에 마칩니다.', due:Math.max(1, g.tPatient - 1) + '분 안에 준비 완료' });
  L.push({ k:'vic', who:'환자의 나만의 AI 비서', order:'환자에게 이송 상황과 도착 시각을 알리고, 보호자에게 연락해 줍니다. 말·문자가 어려우면 진동으로 간단히 알려요.', due:'즉시' });
  return L;
}
function statusAt(sc, r, t) {
  var g = r.go, v = r.veh, o = {}; if (!g) return o;
  o.veh = t < v.eta ? (v.esc ? '동승 의료진을 태우고 환자에게 가는 중' : '환자에게 가는 중') : t < g.tPatient ? '환자를 태우고 ' + g.fac.name + '으로 이송 중' : g.fac.name + ' 도착';
  o.doc = g.kind === 'single' ? '그 자리에서 대기 중' : g.kind === 'remote' ? (t < g.start ? '화상 연결 준비 중' : '원격 협진 연결됨') : g.kind === 'split' ? (t < g.tDoc ? '자율주행차량으로 이동 중' : '도착, 진료 대기') : '당직 의사 대기 중';
  o.fac = t < Math.max(1, g.tPatient - 1) ? '검사 장비 예약·수용 준비 중' : '준비 완료, 환자 맞을 차례';
  o.vic = t < 1 ? '안내 전달 중' : '안내 전달 완료, 연락 유지';
  return o;
}
function timeBar(c, r) {
  var g = r.go, sc = c.sc, R = c.R, pf = PF, mx = endT(g) + 1, t = Math.min(R.t, mx);
  var lab = h('b', { id:X('t-lab'), text:'경과 T+' + t + '분 · 가상 시각 ' + clock(sc.t0 + t * 60000) });
  var rg = h('input', { type:'range', id:X('t'), min:'0', max:String(mx), value:String(t), 'aria-label':'경과 시간(분)', style:'width:100%' });
  rg.oninput = function () { var v = Number(rg.value), o = statusAt(sc, r, v); R.t = v; lab.textContent = '경과 T+' + v + '분 · 가상 시각 ' + clock(sc.t0 + v * 60000); ['veh', 'doc', 'fac', 'vic'].forEach(function (k) { var e = $(pf + 'st-' + k); if (e) e.textContent = o[k]; }); };
  return h('div', { class:'card col', style:'margin-top:12px' }, [lab, rg, h('div', { class:'sub', text:'막대를 끌어 시간이 흐를 때 상태가 어떻게 바뀌는지 보세요. ' + ONSITE_NOTE })]);
}
function sendForm(sc) {
  var m = sc.msg, c = sc.c;
  return form([
    ['① 기기에서 보낸 의료 메시지', [['전송 기기', sc.devName + (sc.dev === 'ring' ? ' (말·문자 입력이 없는 기기)' : ''), X('s1-dev')], ['전달 형태', m.label, X('s1-mode')], ['내용', m.body || '없음 — 오직 “의료”만 전달(생체·PDV 정보가 대신 말해요)', X('s1-body')], ['받는 곳', '의료 AI']]],
    ['② 내 AI 비서가 내 PDV에서 꺼내 익명화한 정보', [['익명 번호', sc.anon, X('s1-anon')], ['나이 · 성별', sc.patient.ageText + ' · ' + sc.patient.sex], ['생체 정보', c.vit], ['질병 이력', c.hist], ['가족력', c.fam], ['생활 습관', c.life], ['복용 중인 약', c.meds], ['현재 위치', sc.placeName + ' (가상 좌표 ' + sc.xy[0] + ', ' + sc.xy[1] + ') — 이송에만 써요', X('s1-loc')], ['빼는 정보', '이름·주민번호·정확한 주소는 보내지 않아요']]],
    ['③ 접수 정보', [['호출 시각', clock(sc.t0) + ' (가상)'], ['진료 번호', sc.no, X('s1-no')]]],
    ['④ 환자(또는 보호자)의 디지털 서명', [['서명값', sc.sig, X('s1-sig')], ['서명 방식', '단말의 개인 키로 서명(가상). 의료 AI가 받은 뒤 확인합니다.']]]]);
}
function planList(r) { return h('div', {}, planText(r).map(function (x, i) { return h('div', { class:'stp', 'data-s':String(i) }, [h('i', { text:String(i + 1) }), h('div', {}, [h('span', { text:x })])]); })); }

// ── 19개 세부 단계(각각 눌린 단계 아래로 펼쳐지는 패널에 결과를 보여 준다) ──
function s11(c) { var sc = c.sc, how = { phone:'폰의 의료 버튼을 누릅니다.', watch:'나비웹 워치의 의료 버튼을 길게 누릅니다.', ring:'링(팔찌)을 두 번 눌러 의료를 보냅니다.' }[sc.dev];
  return [h('div', { class:'sub', text:'가상 환자입니다. 기기와 증상은 무작위로 뽑았어요. 환자가 가장 단순한 조작 한 번으로 의료 AI를 부릅니다.' }), form([['기기 호출', [['사용한 기기', sc.devName, X('s1-dev')], ['조작(가상)', how], ['호출 시각', clock(sc.t0) + ' (가상)'], ['어떤 상황', sc.c.name, X('s1-inc')]]]])]; }
function s12(c) { var sc = c.sc, m = sc.msg;
  return [form([['의료 메시지 구성', [['말·문자 입력', sc.can === 'voice' ? '말할 수 있음' : sc.can === 'text' ? '문자를 입력할 수 있음' : '둘 다 어려움'], ['전달 형태', m.label, X('s1-mode')], ['내용', m.body || '없음 — 오직 “의료”만 전달', X('s1-body')], ['이유', m.only ? (sc.dev === 'ring' ? '링에는 말·문자 입력이 없어 “의료”만 갑니다. 대신 생체·PDV 정보가 전달돼요.' : '말도 문자도 어려워 “의료”만 갑니다. 대신 생체·PDV 정보가 전달돼요.') : '“의료” 표시와 함께 ' + (m.mode === 'voice' ? '음성' : '문자') + '을(를) 보냅니다.']]]])]; }
function s13(c) { var sc = c.sc, p = sc.c;
  return [h('div', { class:'sub', text:'환자의 나만의 AI 비서가 환자의 PDV(내 데이터 금고)에서 필요한 정보만 꺼내 익명화해 붙입니다. 이 시뮬레이션은 모든 항목을 보내기로 한 경우를 보여 줍니다. 실제로는 “평소 준비”에서 고른 항목만 전송되고, 현재 위치는 항상 포함돼요.' }),
    form([['PDV 에서 꺼낸 정보(익명)', [['익명 번호', sc.anon, X('s1-anon')], ['나이 · 성별', sc.patient.ageText + ' · ' + sc.patient.sex], ['생체 정보', p.vit], ['질병 이력', p.hist, X('s1-hist')], ['가족력', p.fam], ['생활 습관', p.life], ['복용 중인 약', p.meds], ['현재 위치', sc.placeName + ' (가상 좌표 ' + sc.xy[0] + ', ' + sc.xy[1] + ')', X('s1-loc')]]]])]; }
function s14(c) { return [h('div', { class:'sub', text:'위 내용을 하나의 Form으로 묶어 디지털 서명을 붙이고 의료 AI로 보냅니다.' }), sendForm(c.sc)]; }
function s21(c) { var sc = c.sc; return [form([['서명 확인', [['받은 서명', sc.sig], ['확인 결과', verify(sc) ? '일치 — 전달 중 내용이 바뀌지 않았어요' : '불일치 — 위변조 의심', X('s2-sig')], ['익명 번호', sc.anon], ['진료 번호', sc.no]]]])]; }
function s22(c) { var sc = c.sc, p = sc.c, eqs = eqsOf(p);
  return [form([['증상 정리와 필요한 진료 추정', [['호소', p.name + (sc.msg.body ? ' — “' + sc.msg.body + '”' : ' (말·문자 없이 전달됨)')], ['생체 정보', p.vit], ['질병 이력 · 가족력', p.hist + ' / ' + p.fam], ['중증도 분류', p.sev + ' — ' + (p.sev === '중증' ? '의료진이 동승하고 가장 빠른 진료가 필요해요' : p.sev === '중등' ? '당일 검사와 진료가 필요해요' : '대기 가능한 진료예요'), X('s2-sev')], ['필요한 진료과', p.sp, X('s2-sp')], ['필요한 검사', p.tests.map(function (t) { return t + '(' + EQ_OF[t] + ' · 약 ' + TEST_MIN[t] + '분)'; }).join(', '), X('s2-tests')], ['쓸 장비', eqs.join(', ')], ['의사와 만나는 방식', p.remote ? '원격 협진도 가능한 진료예요' : '직접 봐야 하는 진료예요(원격 협진 불가)', X('s2-mode')], ['이송 중 동승 의료진', p.escort ? '필요 — 중증이라 의료진이 함께 타요' : '필요 없음', X('s2-esc')]]]]),
    h('div', { class:'sub', text:'의료 AI는 질병을 진단하거나 확률을 알려 주지 않아요. 진료과와 필요한 검사를 정하는 데까지만 쓰고, 진단은 검사 뒤 의사가 합니다.' })]; }
function s23(c) { return [h('div', { class:'sub', text:'의료 AI가 진료 준비에 꼭 필요한 것을 환자의 비서에게 더 묻습니다. 비서는 허용된 질문에만 PDV 기록을 바탕으로 답해요.' }), form([['추가 질의', c.sc.c.asks.map(function (a, i) { return ['의료 AI → 비서: ' + a[0], '답: ' + a[1], X('s2-ask') + i]; })]])]; }
function s24(c) {
  var sc = c.sc, g = c.g, lock0 = c.locked, p = sc.c;
  var vrows = g.veh.map(function (u, i) { return h('tr', {}, [h('td', {}, [pill('자율주행 이송차량', 'm')]), h('td', { text:u.name }), h('td', { class:'r num', text:u.eta + '분' }), h('td', { text:!u.free ? '다른 이송 중' : i === 0 ? '★ 가장 가까움' : '' })]); });
  var hrows = g.hosp.map(function (x) { var F = x.F, docOn = p.sp in F.docs;
    var doc = docOn ? [h('button', { type:'button', class:'chip', disabled:lock0 ? true : null, 'data-doc':F.id + ':' + p.sp, 'aria-pressed':String(F.docs[p.sp]), text:p.sp + (F.docs[p.sp] ? ' 근무' : ' 비번'), onclick:function () { F.docs[p.sp] = !F.docs[p.sp]; c.re(); } })] : [h('span', { class:'sub', text:p.sp + ' 의사 없음' })];
    var eqs = g.eqs.map(function (e) { return e in F.eq ? h('button', { type:'button', class:'chip', disabled:lock0 ? true : null, 'data-eq':F.id + ':' + e, 'aria-pressed':String(F.eq[e]), text:e + (F.eq[e] ? ' 가능' : ' 사용 중'), onclick:function () { F.eq[e] = !F.eq[e]; c.re(); } }) : h('span', { class:'sub', text:e + ' 없음' }); });
    return h('tr', {}, [h('td', {}, [h('b', { text:F.name }), h('div', { class:'sub', text:F.lvl })]), h('td', { class:'r num', text:x.move + '분' }), h('td', {}, [h('div', { class:'chips' }, doc)]), h('td', {}, [h('div', { class:'chips' }, eqs)])]); });
  return [h('div', { class:'sub', text:'호출 위치(' + sc.placeName + ')를 중심으로 가용한 이송차량과, 이 진료(' + p.sp + ' · 검사 ' + g.eqs.join('·') + ')에 필요한 기관의 의사·장비를 모읍니다. 가까운 기관이든 멀리 있는 기관이든 같은 기준으로 봐요.' + (lock0 ? ' 아래는 지시서를 보낼 때(3-1)의 현황이에요.' : '') }),
    h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('s2-units') }, [h('thead', {}, [h('tr', {}, ['구분', '자원', '도착', ''].map(function (t, i) { return h('th', { class:i === 2 ? 'r' : '', text:t }); }))]), h('tbody', {}, vrows)])]),
    h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('m-res-tbl') }, [h('thead', {}, [h('tr', {}, ['기관', '환자 위치까지', p.sp + ' 의사(근무)', '필요한 장비(사용 가능)'].map(function (t, i) { return h('th', { class:i === 1 ? 'r' : '', text:t }); }))]), h('tbody', {}, hrows)])]),
    h('div', { class:'sub', id:X('s2-av'), text:p.remote ? '이 진료는 원격 협진이 가능해, 그 기관에 의사가 없어도 다른 기관 의사와 화상으로 이을 수 있어요.' : '이 진료는 의사가 직접 봐야 해서, 그 기관에 의사가 없으면 의사가 자율주행차량으로 와야 해요.' }),
    h('div', { class:'sub', text:lock0 ? '지시서를 이미 보내 현황은 더 바꿀 수 없어요.' : '버튼을 눌러 의사가 퇴근하거나 장비가 사용 중이 된 상황을 만들면 다음 단계의 조합이 달라져요(저장하지 않습니다).' }),
    lock0 ? null : h('div', { class:'rowf' }, [btn('처음 상태로', 'quiet', function () { c.R.hosp = newHosp(); c.R.fleet = newFleet(); c.re(); })])];
}
function s25(c) {
  var r = c.dec, g = r.go, p = r.c, b = r.best, hero = h('div', { class:'card col hero', id:X('m-res') });
  if (!b) { hero.appendChild(h('div', { class:'big', text:'필요한 의사·장비를 한곳에 맞출 수 없어요' })); hero.appendChild(h('div', { class:'sub', id:X('m-kind'), text:'그래도 가장 가까운 ' + g.fac.name + '으로 환자를 옮겨 안정시키고, 조합이 가능해지면 의료 AI가 상급 기관 전원을 안내해요(연습).' })); }
  else { hero.appendChild(h('div', { class:'big', id:X('m-start'), text:'진료 시작 약 ' + g.start + '분 뒤 · ' + g.fac.name })); hero.appendChild(h('div', { class:'sub', id:X('m-kind'), text:g.kind === 'single' ? '이 기관에 ' + p.sp + ' 의사와 검사 장비가 모두 있어요.' : g.kind === 'remote' ? '환자는 장비가 있는 이 기관으로 가고, ' + p.sp + ' 의사는 ' + g.doc.name + '에서 화상 원격 협진으로 이어요.' : '환자는 장비가 있는 이 기관으로 가고, ' + g.doc.name + '의 ' + p.sp + ' 의사가 자율주행차량으로 와요.' })); }
  var opts = r.options.slice(0, 5).map(function (o, i) { return h('tr', {}, [h('td', {}, [pill(KIND[o.kind], o.kind === 'single' ? 'p' : 'm')]), h('td', {}, [h('b', { text:(i === 0 ? '★ ' : '') + o.fac.name })]), h('td', { text:o.kind === 'single' ? '같은 기관' : o.doc.name }), h('td', { class:'r num', text:o.tPatient + '분' }), h('td', { class:'r num', text:o.start + '분' })]); });
  return [hero, sub('진료를 가장 빨리 시작하는 순서'), rows3(opts), h('div', {}, [mapSvg(r, c.hosp, c.fleet), h('div', { class:'sub', text:'빨간 점이 환자, 초록 칸이 선택된 기관, 파란 삼각형이 이송차량이에요. 파란 선은 환자 이송, 초록 점선은 의사 이동, 보라 점선은 원격 협진 연결입니다.' })]),
    r.why.length ? h('div', { id:X('m-why') }, [h('b', { text:'조합에서 빠진 이유' }), h('div', {}, r.why.map(function (w) { return kv(w[0], w[1]); }))]) : null];
}
function s26(c) {
  var r = c.dec, g = r.go, sc = c.sc, p = r.c, v = r.veh;
  return [form([['이송·진료 계획서 · ' + sc.no, [['호출 위치', sc.placeName], ['중증도 · 진료과', p.sev + ' · ' + p.sp], ['이송차량', v.name + ' (' + v.eta + '분)' + (v.esc ? ' · 동승 ' + v.esc.name + ' 의료진' : ''), X('s2-plan')], ['진료 기관', g.fac.name + ' (환자 도착 ' + g.tPatient + '분)'], ['의사', docWho(r) + (g.kind === 'split' ? ' (' + g.tDoc + '분 도착)' : g.kind === 'remote' ? ' (협진 시작 ' + g.start + '분)' : '')], ['검사', p.tests.join(' → ') + ' (약 ' + testMin(p) + '분)'], ['결정 주체', '진단·처치·처방은 의사']]]]), planList(r)];
}
function s31(c) {
  var r = c.dec, L = dispatchList(c.sc, r);
  return [h('div', { class:'sub', text:'의료 AI가 이송차량, 진료 기관, 의사, 환자의 비서에 지시서를 동시에 보냅니다. 발송 시각은 T+0분이고, 이때 계획이 확정돼요.' }),
    r.best ? null : h('div', { class:'sub', id:X('s3-fb'), text:'필요한 의사·장비를 한곳에 맞출 수 없어 가장 가까운 기관으로 안정화 이송을 지시합니다. 조합이 가능해지면 의료 AI가 새 지시를 내려요.' }),
    h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('s3-tbl') }, [h('thead', {}, [h('tr', {}, ['받는 곳', '지시 내용', '예정'].map(function (x) { return h('th', { text:x }); }))]), h('tbody', {}, L.map(function (x) { return h('tr', {}, [h('td', {}, [h('b', { text:x.who })]), h('td', { text:x.order }), h('td', { text:x.due })]); }))])])];
}
function s3one(ks, title) { return function (c) { var r = c.dec, L = dispatchList(c.sc, r), st = statusAt(c.sc, r, Math.min(c.R.t, endT(r.go) + 1)), groups = [];
  ks.forEach(function (k, i) { var x = L.filter(function (y) { return y.k === k; })[0]; groups.push([title[i], [['받는 곳', x.who], ['지시 내용', x.order], ['예정', x.due], ['지금 상태', st[k], X('st-') + k]]]); });
  return [form(groups), timeBar(c, r)]; }; }
/** 이송 중 목적 기관의 검사 장비 하나가 갑자기 쓸 수 없게 된다(안정화 이송이면 당직 의사가 다른 환자를 맡는다). 그 시각의 환자 위치에서 기관을 다시 고른다. */
function triggerEvent(R, re) {
  if (R.ev) return; lock(R); var p0 = R.plan0; if (!p0 || !p0.go) return;
  var g0 = p0.go, F = R.hosp.filter(function (x) { return x.id === g0.fac.id; })[0], what = null, c = p0.c;
  if (F) { if (g0.kind === 'stabilize') { if (c.sp in F.docs) { F.docs[c.sp] = false; what = F.name + '의 당직 ' + c.sp + ' 의사가 다른 환자를 맡게 됨'; } else { F.docs[Object.keys(F.docs)[0]] = false; what = F.name + '의 당직 의사가 다른 환자를 맡게 됨'; } }
    else { var e0 = p0.eqs.filter(function (e) { return F.eq[e] === true; })[0] || p0.eqs[0]; F.eq[e0] = false; what = F.name + '의 ' + e0 + '가 갑자기 사용 중이 됨'; } }
  var at = Math.min(Math.max(p0.veh.eta + 1, Math.round(g0.tPatient * 0.5)), Math.max(p0.veh.eta, g0.tPatient - 1));
  R.ev = { at:at, what:what, after:match(R.sc.c.id, R.sc.place, R.hosp, R.fleet, { at:at, prev:p0 }) }; re();
}
function s35(c) {
  var R = c.R, r = c.dec, g0 = r.go, ev = R.ev, kids = [h('div', { class:'sub', text:'이송 중에도 의료 AI는 기관의 장비·의사 현황을 계속 받습니다. 목적 기관의 검사 장비가 갑자기 막히면 그 시각의 환자 위치에서 기관을 다시 고르고, 이송차량은 가던 길의 방향만 바꿔요. 이 단계는 건너뛰어도 됩니다.' })];
  kids.push(h('div', { class:'rowf' }, [h('button', { type:'button', class:'btn fill', id:X('ev'), disabled:ev ? true : null, text:ev ? '사건이 발생했어요' : '이송 중 사건 일으키기 (모의)', onclick:function () { triggerEvent(R, c.re); } })]));
  if (ev) {
    var a = ev.after, n = a.go, same = n.fac.id === g0.fac.id;
    kids.push(form([['실시간 재선정', [['발생 시각', 'T+' + ev.at + '분 · 가상 ' + clock(c.sc.t0 + ev.at * 60000)], ['사건', ev.what || '목적 기관의 현황이 바뀜'], ['그때 환자 위치', ev.at < g0.tPatient ? r.veh.name + '에 타고 ' + g0.fac.name + '으로 이동 중' : '이미 도착'], ['이전 목적지', g0.fac.name + ' (' + KIND[g0.kind] + ')'],
      ['새 목적지', n.fac.name + ' · ' + KIND[n.kind] + ' · 약 ' + n.start + '분에 진료 시작', X('ev-new')], ['지시', same ? '같은 기관을 유지하되 진료 방식만 바꿔요' : r.veh.name + '의 방향을 ' + n.fac.name + '으로 바꿈'], ['의사', docWho(a)]]]]));
    kids.push(planList(a));
  }
  return kids;
}
function s41(c) { var r = c.fin, g = r.go, p = r.c, sc = c.sc, t = g.start, rows = [], acc = t;
  p.tests.forEach(function (x) { rows.push(h('tr', {}, [h('td', {}, [h('b', { text:x })]), h('td', { text:EQ_OF[x] }), h('td', { class:'r num', text:TEST_MIN[x] + '분' }), h('td', { class:'r num', text:'T+' + (acc += TEST_MIN[x]) + '분' })])); });
  return [h('div', { class:'sub', text:c.R.ev ? '이송 중 목적지가 바뀌었지만, 새 계획대로 도착해 접수합니다.' : '환자가 기관에 도착해 접수하고 검사를 시작합니다.' }),
    form([['도착과 접수', [['도착 기관', g.fac.name + ' (T+' + g.tPatient + '분)', X('s4-ready')], ['진료 시작', 'T+' + g.start + '분 · ' + docWho(r), X('s4-start')], ['본인 확인', '이 기관은 익명 번호(' + sc.anon + ')만 알고 있어요. 환자가 동의하면 이름을 알려 줘요(가상)', X('s4-consent')], ['검사 순서', p.tests.join(' → ')]]]]),
    h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('s4-tests') }, [h('thead', {}, [h('tr', {}, ['검사', '장비', '소요', '끝나는 때'].map(function (x, i) { return h('th', { class:i > 1 ? 'r' : '', text:x }); }))]), h('tbody', {}, rows)])]),
    h('div', { class:'sub', text:ONSITE_NOTE })]; }
function rankTable(c, id) {
  var sc = c.sc, a = sc.rank0, b = sc.rank1;
  return h('div', { class:'tbw' }, [h('table', { class:'tbl', id:id }, [h('thead', {}, [h('tr', {}, ['순위', '후보', '근거', '검사 전 → 후'].map(function (x, i) { return h('th', { class:i === 3 ? 'r' : '', text:x }); }))]), h('tbody', {}, b.map(function (x, i) { var before = a.map(function (y) { return y.i; }).indexOf(x.i), d = before - i; return h('tr', {}, [h('td', { class:'num', text:String(i + 1) }), h('td', {}, [h('b', { text:x.name })]), h('td', { text:x.ev.join(' · ') }), h('td', { class:'r num', text:(before + 1) + '위 → ' + (i + 1) + '위' + (d > 0 ? ' ▲' : d < 0 ? ' ▼' : '') })]); }))])]);
}
function s42(c) { var sc = c.sc, p = sc.c, rows = p.tests.map(function (t) { return h('tr', {}, [h('td', {}, [h('b', { text:t })]), h('td', { text:sc.res[t] ? '범위를 벗어남 — 의사가 해석' : '정상 범위' })]); });
  return [h('div', { class:'sub', text:'검사 결과를 하나로 모아 의료 AI가 진단 의견(진료 참고 목록)을 만듭니다. 질병 이름과 확률은 만들지 않고 순서와 근거만 보여 줘요.' }),
    h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('s4-res') }, [h('thead', {}, [h('tr', {}, ['검사', '결과'].map(function (x) { return h('th', { text:x }); }))]), h('tbody', {}, rows)])]),
    sub('AI 진단 의견 — 진료 참고 목록'), rankTable(c, X('s4-rank')),
    h('div', { class:'sub', text:'AI는 후보 순서를 제안할 뿐이에요. 환자에게 쓰기 전에 의사가 검토합니다.' })]; }
function who4(c) { var g = c.fin.go; return docWho(c.fin); }
function s43(c) { var sc = c.sc, p = sc.c, d = sc.doc, top = sc.rank1[0], pk = sc.rank1.filter(function (x) { return x.i === d.pick; })[0], r = c.fin, g = r.go, base = sc.no + '|' + sc.anon;
  return [form([['의사 검토와 확진', [['검토한 의사', who4(c), X('s4-doc')], ['AI 의견', 'AI 1순위는 ' + top.name + ' (근거: ' + top.ev.join(' · ') + ')'], ['의사 판단', d.agree ? 'AI 의견과 같음' : 'AI 의견과 다름', X('s4-judge')], ['확진 진단', pk.name + ' — 실제 질병 이름은 의사가 정하며 이 화면은 자리표시만 보여 줘요', X('s4-dx')], ['이유', d.why]]],
      ['처치와 처방', [['처치', p.tx[0]], ['이후 계획', p.tx[1]], ['처방', '약의 종류·용량은 의사가 정해요(이 화면은 정하지 않아요)'], ['환자 설명', '진단과 처치를 환자에게 설명하고 동의를 받아요(가상)']]],
      ['서명', [['의사 서명', sig(base + '|DOC'), X('s4-sig1')], ['AI 서명', sig(base + '|AI'), X('s4-sig2')], ['환자 동의 서명', sig(base + '|PT'), X('s4-sig3')]]]]), h('div', { class:'sub', text:ONSITE_NOTE })]; }
function s44(c) { var sc = c.sc, p = sc.c, co = sc.course, g = c.fin.go, stab = g.kind === 'stabilize', rounds = stab ? [{ n:1, day:1, trend:'변화 없음', ai:'필요한 진료과·장비가 없어 안정화만 했어요', doc:'상급 기관 전원 결정' }] : co.rounds, end = stab ? '상급 기관 전원' : co.end, base = sc.no + '|' + sc.anon;
  var rows = rounds.map(function (x) { return h('tr', {}, [h('td', { class:'num', text:x.n + '회' }), h('td', { class:'num', text:x.day + '일째' }), h('td', {}, [pill(x.trend, x.trend === '호전' ? 'p' : 'm')]), h('td', { text:'AI: ' + x.ai }), h('td', { text:'의사: ' + x.doc })]); });
  return [h('div', { class:'card col hero' }, [h('div', { class:'big', id:X('s4-end'), text:'경과 ' + rounds.length + '회 관찰 · ' + end }), h('div', { class:'sub', text:'이 흐름은 모두 모의 체험이며, 인물·기관·검사·시간은 가상입니다. 실제 위급 상황은 119에 연락하세요.' })]),
    h('div', { class:'sub', text:'처치 뒤에는 경과를 보고 AI와 의사가 다시 협진해 새 처치·처방을 정하는 일을 퇴원(또는 전원) 때까지 되풀이해요. 경증은 호전이 한 번, 그 밖은 두 번 확인되면 퇴원하고, 악화가 두 번이면 상급 기관으로 전원합니다.' }),
    h('div', { class:'tbw' }, [h('table', { class:'tbl', id:X('s4-rounds') }, [h('thead', {}, [h('tr', {}, ['회차', '시점', '경과', 'AI 재협진', '의사 결정'].map(function (x) { return h('th', { text:x }); }))]), h('tbody', {}, rows)])]),
    form([['기록 보존', [['환자의 데이터 금고(PDV)', '진료 기록·검사 결과·처방이 저장돼요(가상).'], ['의료 인프라', '익명화한 진료 근거 데이터가 남아요(이름 제외).'], ['기록 지문', sig(base + '|END'), X('s4-sig0')], ['결정 주체', '진단·처치·처방·퇴원은 의사가 했어요 — 의료 AI는 의견과 기록만']]]])];
}

var STAGES = ['의료 호출', '의료 AI 대응', '이송·진료 준비', '검사·진단·경과'];
var STEPS = [
  { id:'1-1', st:0, title:'기기 호출', desc:'폰·워치·링으로 의료 AI를 불러요', fn:s11 }, { id:'1-2', st:0, title:'메시지 구성', desc:'말·문자가 되면 함께, 아니면 “의료”만', fn:s12 },
  { id:'1-3', st:0, title:'PDV 정보 첨부', desc:'내 비서가 내 PDV에서 익명화해 붙여요', fn:s13 }, { id:'1-4', st:0, title:'디지털 서명과 전송', desc:'전체 Form에 서명을 붙여 의료 AI로', fn:s14 },
  { id:'2-1', st:1, title:'접수와 서명 확인', desc:'내용이 바뀌지 않았는지 확인해요', fn:s21 }, { id:'2-2', st:1, title:'증상 정리와 필요한 진료 추정', desc:'중증도·진료과·필요한 검사를 정해요', fn:s22 },
  { id:'2-3', st:1, title:'비서에게 추가 질의', desc:'알레르기·최근 복용한 약 등을 물어요', fn:s23 }, { id:'2-4', st:1, title:'자원 취합', desc:'이송차량과 기관의 의사·장비를 모아요', fn:s24 },
  { id:'2-5', st:1, title:'진료 기관 선정', desc:'가장 빨리 진료를 시작하는 곳을 골라요', fn:s25 }, { id:'2-6', st:1, title:'이송·진료 계획서', desc:'차량·기관·의사·검사를 한 장으로 써요', fn:s26 },
  { id:'3-1', st:2, title:'지시서 발송', desc:'차량·기관·의사·비서에 동시에', fn:s31 }, { id:'3-2', st:2, title:'이송차량 이동', desc:'(필요하면 의료진 동승) 환자에게 가요', fn:s3one(['veh'], ['이송차량 출동']) },
  { id:'3-3', st:2, title:'의사 연결', desc:'원격 협진을 잇거나 의사가 이동해요', fn:s3one(['doc'], ['의사 연결']) }, { id:'3-4', st:2, title:'수용·검사 준비', desc:'장비 예약과 환자 안내를 해요', fn:s3one(['fac', 'vic'], ['기관 수용 준비', '환자 안내']) },
  { id:'3-5', st:2, title:'실시간 갱신', desc:'장비가 막히면 기관을 다시 골라요', fn:s35 },
  { id:'4-1', st:3, title:'도착과 검사', desc:'접수하고 증상에 맞는 검사를 해요', fn:s41 }, { id:'4-2', st:3, title:'결과 취합과 AI 진단 의견', desc:'검사 결과로 진료 참고 목록을 만들어요', fn:s42 },
  { id:'4-3', st:3, title:'의사 검토·확진과 처치·처방', desc:'의사가 검토하고 확진해요', fn:s43 }, { id:'4-4', st:3, title:'경과 관찰과 재협진, 퇴원', desc:'호전될 때까지 협진을 되풀이해요', fn:s44 }
];
var PLAN_AT = 10; // 3-1(지시서 발송)을 여는 순간 계획을 확정한다


// ── 단계 이동(run 마다 따로) ──
function openStep(R, i, re) { if (i < 0 || i >= STEPS.length || i > R.reached) return; if (i >= PLAN_AT) lock(R); R.cur = i; R.seen = true; R.reached = Math.max(R.reached, Math.min(i + 1, STEPS.length - 1)); re(); }
function advance(R, re) { var i = R.cur + 1; if (i >= STEPS.length) return; R.reached = Math.max(R.reached, i); openStep(R, i, re); }

// ── 화면: 진행 막대 · 단계 목록 · 패널 ──
function progressBar() {
  var R = S.sim, cur = R.cur, wrap = h('div', { class:'bar', id:'med-bar' });
  STAGES.forEach(function (name, si) {
    var ticks = []; STEPS.forEach(function (s, i) { if (s.st !== si) return;
      var cl = 'tick ' + (i < R.reached ? 'done' : i === R.reached ? 'next' : 'lock') + (i === cur ? ' cur' : '') + (cur >= 0 && i === cur + 1 ? ' blink slow' : '');
      ticks.push(h('button', { type:'button', class:cl, id:'med-tick-' + s.id, 'data-i':String(i), 'aria-label':s.id + ' ' + s.title, title:s.id + ' ' + s.title, 'aria-current':i === cur ? 'step' : null, disabled:i > R.reached ? true : null, onclick:function () { pickStep(R, i); } })); });
    wrap.appendChild(h('div', { class:'bseg' }, [h('div', { class:'bname', text:(si + 1) + '. ' + name }), h('div', { class:'bticks' }, ticks)]));
  });
  return h('div', { class:'barwrap' }, [wrap, h('div', { class:'bcap', id:'med-bar-cap', text:cur >= 0 ? (cur + 1) + ' / ' + STEPS.length + ' · ' + STEPS[cur].id + ' ' + STEPS[cur].title : '0 / ' + STEPS.length + ' · 1-1 기기 호출부터 눌러 보세요' })]);
}
/** 새 사건을 뽑은 뒤 지금 무엇을 하면 되는지 알려 주는 배너. */
function nextHint() {
  var R = S.sim; if (!R.picked) return null;
  var last = R.cur === STEPS.length - 1, t = R.cur < 0 ? (!R.seen ? '새 환자가 뽑혔어요. 다음 할 일: 아래 단계 목록에서 깜박이는 “1-1 기기 호출”을 눌러 시작하세요.' : '다음 할 일: 단계 목록에서 “' + STEPS[R.reached].id + ' ' + STEPS[R.reached].title + '”을 눌러 이어 가세요. 이미 연 단계는 다시 볼 수 있어요.')
    : last ? '끝까지 봤어요. 다음 할 일: “새 환자 뽑기”를 눌러 다른 환자로 다시 해 보세요.' : '다음 할 일: 아래에서 천천히 깜박이는 “' + STEPS[R.cur + 1].id + ' ' + STEPS[R.cur + 1].title + '” 단계를 눌러 한 단계씩 따라가세요.';
  return h('div', { class:'note info hintbn', id:'med-next-hint', role:'status', text:t });
}
function summaryCard() {
  var sc = S.sim.sc;
  return h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'무작위 가상 환자' }), h('div', { class:'rowf' }, [pill(sc.devName, 'm'), pill(sc.inc.kind, 'p'), pill(sc.inc.name), pill(sc.placeName)]),
    h('div', { class:'sub', id:'med-draw-sum', text:'기기·환자·증상·위치를 무작위로 뽑았어요. 아래 목록에서 단계를 누르면 그 단계 바로 아래에 결과가 펼쳐져요. 처음부터 저절로 보려면 오른쪽 위의 시뮬레이션 버튼을 누르세요.' }),
    h('div', { class:'rowf' }, [h('button', { type:'button', class:'btn tonal' + (S.sim.picked ? '' : ' blink'), id:'med-draw', text:'새 환자 뽑기', onclick:function () { S.sim = newRun(); S.sim.picked = true; S.wasOpen = false; render(); } }), btn('의료 AI에게 묻기', 'quiet', function () { ask('가까운 기관과 먼 기관 중 어디로 가야 하는지 어떻게 정하나요?'); })]), nextHint()]);
}
function stepList() {
  var R = S.sim, out = h('div', { id:'med-list', class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'단계 목록 (' + STEPS.length + '단계)' }), h('div', { class:'sub', text:'앞 단계를 연 뒤에 다음 단계를 열 수 있어요. 이미 연 단계는 언제든 다시 볼 수 있습니다.' })]);
  STAGES.forEach(function (name, si) {
    out.appendChild(h('div', { class:'lab', text:(si + 1) + '. ' + name }));
    STEPS.forEach(function (s, i) { if (s.st !== si) return;
      var state = i === R.cur ? '보는 중' : i < R.reached ? '완료' : i === R.reached ? '열기' : '잠김', hintRow = R.picked && R.cur < 0 && !R.seen && i === 0;
      out.appendChild(h('button', { type:'button', class:'srow' + (i === R.cur ? ' cur' : '') + (hintRow ? ' blink' : '') + (R.cur >= 0 && i === R.cur + 1 ? ' blink slow' : ''), id:'med-row-' + s.id, 'data-i':String(i), disabled:i > R.reached ? true : null, 'aria-current':i === R.cur ? 'step' : null, onclick:function () { pickStep(R, i); } },
        [h('span', { class:'sid', text:s.id }), h('span', { class:'stx' }, [h('b', { text:s.title }), h('span', { text:s.desc })]), h('span', { class:'sst', text:state })]));
      if (i === R.cur) { var ip = inlinePanel(); if (ip) out.appendChild(ip); } });
  });
  return out;
}
/** 단계 아래로 펼쳐지는 페이지 안 패널. 오른쪽 시뮬레이션 패널(#med-apanel)과는 서로 아무 관계가 없다. */
function inlinePanel() {
  var R = S.sim; if (R.cur < 0) return null;
  var st = STEPS[R.cur], c = ctx(R, render), last = R.cur === STEPS.length - 1, pb0 = $('med-pbody'), ps = pb0 ? pb0.scrollTop : 0, fresh = !S.wasOpen || S.lastOpen !== R.cur;
  S.wasOpen = true; S.lastOpen = R.cur; PF = 'med-';
  var body = h('div', { class:'pbody col', id:'med-pbody' }, st.fn(c).filter(Boolean));
  var pn = h('div', { id:'med-ipanel', class:'ipanel' + (fresh ? ' anim' : ''), role:'region', 'aria-label':st.id + ' ' + st.title + ' 결과' }, [
    h('div', { class:'phead' }, [h('div', { style:'flex:1;min-width:0' }, [h('div', { class:'sub', id:'med-ph-n', text:'직접 따라가기 · 단계 ' + (R.cur + 1) + ' / ' + STEPS.length + ' · ' + STAGES[st.st] }), h('b', { id:'med-ph-t', text:st.id + ' ' + st.title })]), h('button', { type:'button', class:'btn quiet sm', id:'med-pclose', text:'닫기', onclick:function () { closeStep(R); } })]),
    body,
    h('div', { class:'pfoot' }, [h('button', { type:'button', class:'btn quiet', id:'med-prev', text:'◀ 이전', disabled:R.cur === 0 ? true : null, onclick:function () { pickStep(R, R.cur - 1); } }),
      last ? h('button', { type:'button', class:'btn fill', id:'med-again', text:'새 환자로 다시', onclick:function () { S.sim = newRun(); S.wasOpen = false; render(); try { window.scrollTo(0, 0); } catch (x) {} } }) : null])]);
  body.scrollTop = ps; return pn;
}
// ── 부드러운 전환: 눌린 단계를 진행 막대 바로 아래로 올리고, 새 패널은 높이가 늘어나며 아래 단계를 밀어 내린다 ──
var MOVE_MS = 350;
function calm() { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
function noIds(el) { el.removeAttribute('id'); [].forEach.call(el.querySelectorAll('[id]'), function (x) { x.removeAttribute('id'); }); el.setAttribute('aria-hidden', 'true'); el.classList.remove('anim'); }
/** 지금 열린 패널을 본떠 두었다가, 다시 그린 뒤 같은 자리에서 접히게 한다. */
function ghostOf() { var old = $('med-ipanel'), R = S.sim; if (!old || R.cur < 0) return null; return { el:old.cloneNode(true), h:old.offsetHeight, rowId:'med-row-' + STEPS[R.cur].id }; }
function settle(mv) {
  var np = $('med-ipanel'), row = mv.rowId ? $(mv.rowId) : null, bw = M && M.querySelector('.barwrap'), ok = !calm();
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
  S.move.rowId = 'med-row-' + STEPS[i].id; openStep(R, i, render);
}
function closeStep(R) { S.move = { ghost:ghostOf() }; R.cur = -1; S.wasOpen = false; render(); }

// ── 자동 시뮬레이션(오른쪽 위 버튼): 자기만의 사건과 진행 상태를 쓰므로 화면의 단계 목록과 섞이지 않는다 ──
var HOLD = { '2-4':7000, '2-5':7500, '2-6':7000, '3-1':7000, '3-5':8000, '4-2':7000, '4-4':0 };
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
  if (p && id === '3-2') R.t = Math.round(p.tPatient * 0.3); else if (p && id === '3-3') R.t = Math.round(p.start * 0.6); else if (p && id === '3-4') R.t = p.start;
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
  var pn = $('med-apanel'), bk = $('med-back'), a = S.auto; if (!pn || !bk) return;
  if (!a) { pn.textContent = ''; pn.className = 'panel auto'; pn.setAttribute('aria-hidden', 'true'); bk.className = 'back'; return; }
  var R = a.R, st = STEPS[R.cur], c = ctx(R, renderAuto), last = R.cur === STEPS.length - 1, done = last && !a.playing, pb0 = $('med-au-body'), ps = a.top || !pb0 ? 0 : pb0.scrollTop;
  pn.textContent = ''; pn.className = 'panel auto open' + (a.closing ? ' closing' : !a.shown ? ' anim' : ''); pn.setAttribute('aria-hidden', 'false'); bk.className = 'back' + (a.closing ? '' : ' on'); a.shown = true; a.top = false;
  pn.appendChild(h('div', { class:'phead' }, [h('div', { style:'flex:1;min-width:0' }, [h('div', { class:'sub', id:'med-au-n', text:'시뮬레이션 · 단계 ' + (R.cur + 1) + ' / ' + STEPS.length + ' · ' + STAGES[st.st] + (a.playing ? ' · 자동 진행 중' : done ? ' · 끝' : ' · 멈춤') }), h('b', { id:'med-au-t', style:'font-size:17px', text:st.id + ' ' + st.title })]), h('button', { type:'button', class:'btn quiet sm', id:'med-au-close', text:'닫기', onclick:closeAuto })]));
  var mini = h('div', { class:'mini', id:'med-au-mini', 'aria-hidden':'true' }); STEPS.forEach(function (s, i) { mini.appendChild(h('i', { class:(i < R.cur ? 'done' : i === R.cur ? 'cur' : '') + (i > 0 && STEPS[i - 1].st !== s.st ? ' gap' : '') })); });
  pn.appendChild(mini);
  PF = 'med-au-'; var kidsA; try { kidsA = st.fn(c).filter(Boolean); } finally { PF = 'med-'; }
  var body = h('div', { class:'pbody col', id:'med-au-body' }, kidsA); pn.appendChild(body);
  pn.appendChild(h('div', { class:'pfoot' }, [h('button', { type:'button', class:'btn quiet', id:'med-au-pause', text:a.playing ? '⏸ 멈추기' : last ? '끝났어요' : '▶ 이어서', disabled:last && !a.playing ? true : null, onclick:autoToggle }), h('button', { type:'button', class:'btn fill', id:'med-au-restart', text:'↻ 새 무작위 환자', onclick:autoRestart })]));
  body.scrollTop = ps;
}
function render() {
  var root = $('med-root'), tp = $('med-top'); if (!root || !tp) return;
  var y = 0; try { y = window.pageYOffset || 0; } catch (e) {}
  root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = head('의료', '내 PDV의 건강 정보를 익명화해 의료 AI에 전달하고, 가까운 기관 또는 멀리 있는 기관의 의사·장비를 맞춰 이송·검사·진단·처치·경과 관찰까지 이어 줍니다. 무작위 가상 환자 한 명을 호출부터 퇴원까지 단계별로 따라가 보세요.');
  kids.push(mockNote('모의 체험입니다. 아무것도 전송·조회되지 않고 이송도 일어나지 않아요. 환자·기관·검사 결과·시간은 모두 가상 값이며, 진단이나 처방이 아닙니다. 실제 위급 상황은 119에 연락하세요.'));
  kids.push(progressBar(), prepSection(), agentCard(), summaryCard(), stepList());
  kids.forEach(function (k) { if (k) root.appendChild(k); });
  if (y) { try { window.scrollTo(0, y); } catch (e) {} }
  var mv = S.move; S.move = null; if (mv) settle(mv);
}
function reply(ok, msg) { emit('result', { ok:ok, msg:msg }); }
function go(v) {
  var a = ANCH[v]; if (!a) return false;
  if (a === 'med-s-prep') S.prepOpen = true;
  render(); var e = $(a) || $('med-s-call'); try { if (e) e.scrollIntoView({ block:'start' }); } catch (x) {}
  return true;
}
function nav(a) {
  var d = a && typeof a['do'] === 'string' ? a['do'] : '';
  if (go(d)) return reply(true, d === 'prep' || d === 'devices' || d === 'consent' ? '평소 준비 구역으로 이동했습니다.' : d === 'call' ? '환자 정하기 구역으로 이동했습니다.' : '흐름 구역으로 이동했습니다.');
  return reply(false, '지원하지 않는 요청입니다.');
}
function mount(el, o) {
  if (!el) return; o = o || {};
  autoClear(); S.auto = null; M = el; el.textContent = ''; el.classList.add('med'); S.share = {}; S.askok = {}; S.dev = []; S.err = {}; S.msg = ''; S.prepOpen = false; S.sim = newRun(); S.wasOpen = false; load();
  [h('div', { id:'med-top' }), h('div', { class:'wrap', id:'med-root' }), h('div', { id:'med-back', class:'back', onclick:closeAuto }), h('aside', { id:'med-apanel', class:'panel auto', 'aria-hidden':'true', 'aria-label':'시뮬레이션' })].forEach(function (x) { el.appendChild(x); });
  if (o.view && ANCH[o.view] && o.view !== 'call') go(o.view); else render();
}
window.NaviMedical = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M) go(v); },
  callMessage:callMessage, draw:draw, verify:verify, gather:gather, match:match, newHosp:newHosp, newFleet:newFleet, rankList:rankList, planText:planText, devSummary:devSummary, sharedItems:sharedItems, agentResult:function (ok, msg) { if (M) agentResult(!!ok, msg); },
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();

