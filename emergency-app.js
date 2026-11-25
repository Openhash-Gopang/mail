/* emergency-app.js — 나비웹 응급(인프라 AI · 응급). desktop.html 안에 직접 그려 넣는다(iframe 없음).
* 사용: NaviEmergency.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
* 모양은 emergency.css(.emg 범위). 전역은 NaviEmergency 하나만 쓴다.
*
* 한 페이지, 탭 없음(2026-11-25). 위에서 아래로 한 사건의 흐름을 따라간다:
*   평소 준비(기기·보내는 정보) → 가상 사건 정하기 → ① 호출 → ② 내 AI 비서가 정보 전송 → ③ 응급 AI의 추가 질의
*   → ④ 가장 빠른 출동 → ⑤ 병·의원 인력·장비 실시간 조합 → ⑥ 현장 처치·이송 지시와 처치 시작
*
* 응급 AI 설계 원칙(주피터 지시, 2026-11-25):
* 1. 모든 개인은 폰·나비웹 워치·링(팔찌) 중 적어도 하나를 24시간 가까이 둔다.
* 2. 응급은 이 기기를 가장 단순한 조작으로 호출하고, 응급 메시지가 관련 기관(응급 AI)에 전송된다.
*    말을 하거나 문자를 입력할 수 있으면 음성 또는 문자를 보내고, 그 밖에는 오직 '응급' 메시지만 전달한다.
* 3. 신고자의 '나만의 AI 비서'가 위치·나이·성명·병력·생체 정보 등을 응급 AI에 보내고, 응급 AI는 그 비서에게 추가로 물을 수 있다
*    (예: 마지막으로 먹은 음식, 오늘 격한 운동을 했는지).
* 4. 응급 AI는 신고자의 현재 위치에서 최단 시간 안에 도착할 수 있는 응급 대응 인원·장비를 정해 출동을 지시하고,
*    출동 인원·장비는 응급 AI에서 실시간 데이터와 현장 처치·이송 목적지 지시를 받는다.
* 5. 핵심: 전국 병·의원·보건소의 위치, 의료진 전공·자격, 보유 장비, 인력별 일정, 장비별 가동·예약 상태를 실시간으로 파악·갱신하고,
*    응급 환자가 생기면 최적의 처치 인력과 장비를 실시간으로 조합한다(A 병원 B 의료진이 C 병원 장비로 처치하도록 일정을 짜고 자율주행차량을 A 병원에 급파).
*
* 무엇이 실제이고 무엇이 아닌가(화면에도 한 줄로 적는다):
* - 위 원칙은 설계 단계이고 이 화면은 모의 체험이다. 기기·병원·출동 시스템에 연결되어 있지 않고 어떤 것도 전송하지 않는다.
* - 병원·인력·장비·위치·이동 시간은 모두 가상 값이며 메모리 안에서만 계산한다(저장하지 않는다).
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
var KEY = 'navi-emg-v1', MAXD = 20;
var DEVICES = [['phone', '폰'], ['watch', '나비웹 워치'], ['ring', '링(팔찌)']];
var DEVKINDS = DEVICES.map(function (d) { return d[1]; });
/** 내 비서가 응급 AI에 보내는 정보. 위치는 구조에 꼭 필요해 항상 포함하고, 나머지는 항목마다 직접 정한다. */
var SEND = [['loc', '현재 위치'], ['name', '성명'], ['age', '나이'], ['hist', '병력(과거 질병)'], ['meds', '복용 약·알레르기'], ['blood', '혈액형'], ['vitals', '생체 정보(심박 등)'], ['kin', '비상 연락처']];
/** 응급 AI가 내 비서에게 추가로 물을 수 있는 것(예시). 항목마다 답해도 되는지 직접 정한다. */
var ASKS = [['meal', '마지막으로 먹은 음식'], ['exercise', '오늘 격한 운동을 했는지']];
var CALLS = [['voice', '말할 수 있음'], ['text', '문자를 입력할 수 있음'], ['none', '둘 다 어려움']];
var ANCH = { call:'emg-s-call', flow:'emg-s-flow', follow:'emg-s-flow', match:'emg-s-flow', prep:'emg-s-prep', devices:'emg-s-prep', consent:'emg-s-prep' };
var M = null, LS = {};
var S = { share:{}, askok:{}, dev:[], form:{ kind:'폰', carry:true }, err:{}, msg:'', prepOpen:false, call:{ dev:'phone', can:'voice', say:'', fired:false }, m:null };

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
function mockNote(t) { return h('div', { class:'note info', id:'emg-mock', style:'margin:16px 0', text:t }); }

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

/** 응급 호출 메시지: 말할 수 있으면 음성, 문자를 입력할 수 있으면 문자를 함께 보내고, 그 밖에는 오직 '응급'만 보낸다. */
function callMessage(can, said) {
  var t = clean(said, 120);
  if (can === 'voice') return { mode:'voice', label:'음성 + 응급', body:t || '(말한 내용이 음성으로 전달됩니다)', flag:'응급', only:false };
  if (can === 'text') return { mode:'text', label:'문자 + 응급', body:t || '(입력한 문자가 전달됩니다)', flag:'응급', only:false };
  return { mode:'none', label:'응급', body:'', flag:'응급', only:true };
}
function sharedItems(share) { return SEND.filter(function (f) { return f[0] === 'loc' || share[f[0]]; }).map(function (f) { return f[1]; }); }
function askItems(askok) { return ASKS.filter(function (f) { return askok[f[0]]; }).map(function (f) { return f[1]; }); }
function devSummary(list, today) {
  var t0 = today ? Date.parse(today + 'T00:00:00Z') : NaN, due = 0, carry = 0, by = {};
  list.forEach(function (x) { by[x.kind] = (by[x.kind] || 0) + 1; if (x.carry) carry++; if (x.chk && isFinite(t0) && Date.parse(x.chk + 'T00:00:00Z') <= t0) due++; });
  return { count:list.length, carry:carry, by:by, due:due };
}

// ── 자원 조합(가상 값) ──
var UNITS = [['U1', '구급대 1', 5, 6], ['U2', '구급대 2', 12, 8], ['U3', '구급대 3', 8, 13]];
var PLACES = [['p1', '가상 마을 가', 3, 5], ['p2', '가상 마을 나', 13, 9], ['p3', '가상 마을 다', 9, 16], ['p4', '가상 마을 라', 16, 12]];
var NEEDS = { ami:{ name:'급성 심근경색 의심', sp:'심장내과', eq:'심혈관 중재 장비' }, stroke:{ name:'뇌졸중 의심', sp:'신경과', eq:'뇌혈관 중재 장비' }, trauma:{ name:'중증 외상', sp:'외과', eq:'수술실' }, infant:{ name:'영아 호흡곤란', sp:'소아과', eq:'신생아 인공호흡기' } };
var PREP = 3;   // 의료진이 자율주행차량에 타기까지(분, 가정)
function newHosp() {
  return [
    { id:'h1', name:'가상 중앙병원', x:4, y:4, docs:{ '심장내과':true, '외과':true, '신경과':false }, eq:{ '심혈관 중재 장비':false, '수술실':true, '뇌혈관 중재 장비':true } },
    { id:'h2', name:'가상 해안병원', x:14, y:5, docs:{ '심장내과':false, '외과':true, '소아과':true }, eq:{ '심혈관 중재 장비':true, '수술실':true, '신생아 인공호흡기':true } },
    { id:'h3', name:'가상 산악병원', x:6, y:15, docs:{ '신경과':true, '소아과':false, '외과':false }, eq:{ '뇌혈관 중재 장비':true, '수술실':false, '신생아 인공호흡기':false } },
    { id:'h4', name:'가상 동부의원', x:17, y:13, docs:{ '소아과':true }, eq:{ '신생아 인공호흡기':true } },
    { id:'h5', name:'가상 보건소', x:10, y:10, docs:{}, eq:{} }
  ];
}
function dist(a, b) { return Math.max(1, Math.round(Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2)))); }   // 1km = 1분(가정)
/** 신고 위치에서 가장 빨리 처치를 시작할 수 있는 조합을 찾는다. 한 병원에 전문의와 장비가 모두 있으면 그곳으로, 없으면 장비가 있는 병원으로 환자를 옮기고 다른 병원의 전문의를 자율주행차량으로 보낸다. */
function match(needKey, placeKey, hosp) {
  var need = NEEDS[needKey], pl = PLACES.filter(function (p) { return p[0] === placeKey; })[0]; if (!need || !pl) return null;
  var P = [pl[2], pl[3]], amb = null;
  UNITS.forEach(function (u) { var t = dist([u[2], u[3]], P); if (!amb || t < amb.eta) amb = { id:u[0], name:u[1], eta:t }; });
  var opts = [], why = [];
  hosp.forEach(function (F) {
    var docOn = F.docs[need.sp] === true, hasEq = need.eq in F.eq, eqFree = F.eq[need.eq] === true;
    if (!hasEq) why.push([F.name, '필요한 장비(' + need.eq + ')가 없어요']);
    else if (!eqFree) why.push([F.name, need.eq + '가 사용 중이에요']);
    if (!docOn && need.sp in F.docs) why.push([F.name, need.sp + ' 전문의가 근무 중이 아니에요']);
    else if (!(need.sp in F.docs)) why.push([F.name, need.sp + ' 전문의가 없어요']);
  });
  hosp.forEach(function (F) {
    if (F.eq[need.eq] !== true) return;
    var tp = amb.eta + dist(P, [F.x, F.y]);
    if (F.docs[need.sp] === true) opts.push({ kind:'single', fac:F, doc:F, tPatient:tp, tDoc:0, start:tp });
    hosp.forEach(function (D) { if (D !== F && D.docs[need.sp] === true) { var td = PREP + dist([D.x, D.y], [F.x, F.y]); opts.push({ kind:'split', fac:F, doc:D, tPatient:tp, tDoc:td, start:Math.max(tp, td) }); } });
  });
  opts.sort(function (a, b) { return a.start - b.start || (a.kind === 'single' ? -1 : 1) - (b.kind === 'single' ? -1 : 1) || a.fac.id.localeCompare(b.fac.id); });
  return { need:need, place:pl, amb:amb, options:opts, best:opts[0] || null, why:why };
}
function planText(r) {
  var b = r.best; if (!b) return [];
  var s = ['신고 위치(' + r.place[1] + ')에서 가장 빨리 닿는 ' + r.amb.name + '(' + r.amb.eta + '분)를 출동시켜요.'];
  if (b.kind === 'single') s.push(b.fac.name + '에 ' + r.need.sp + ' 전문의와 ' + r.need.eq + '가 모두 있어, 환자를 그곳으로 이송해요(' + b.tPatient + '분 후 도착).');
  else { s.push('환자는 ' + r.need.eq + '를 쓸 수 있는 ' + b.fac.name + '으로 이송해요(' + b.tPatient + '분 후 도착).'); s.push(b.doc.name + '의 ' + r.need.sp + ' 전문의를 자율주행차량에 태워 ' + b.fac.name + '으로 보내요(' + b.tDoc + '분 후 도착, 준비 ' + PREP + '분 포함).'); }
  s.push('처치는 약 ' + b.start + '분 뒤 ' + b.fac.name + '에서 시작돼요. 구급대에는 현장 처치와 이송 목적지를 실시간으로 알려 줘요.');
  return s;
}

function mapSvg(r, hosp) {
  var K = 11, W = 20 * K + 20, ns = 'http://www.w3.org/2000/svg';
  function e(t, a, tx) { var n = document.createElementNS(ns, t), k; for (k in a) n.setAttribute(k, a[k]); if (tx != null) n.textContent = tx; return n; }
  var svg = e('svg', { viewBox:'0 0 ' + W + ' ' + W, role:'img', 'aria-label':'가상 지도: 병원, 구급대, 신고 위치와 선택된 이동 경로', style:'width:100%;max-width:440px;border:1px solid var(--line);border-radius:12px;background:var(--soft)' });
  function X(v) { return 10 + v * K; }
  var b = r.best;
  if (b) {
    svg.appendChild(e('line', { x1:X(r.place[2]), y1:X(r.place[3]), x2:X(b.fac.x), y2:X(b.fac.y), stroke:'#1A5FB4', 'stroke-width':2.5 }));
    if (b.kind === 'split') svg.appendChild(e('line', { x1:X(b.doc.x), y1:X(b.doc.y), x2:X(b.fac.x), y2:X(b.fac.y), stroke:'#1E7B46', 'stroke-width':2.5, 'stroke-dasharray':'5 3' }));
  }
  hosp.forEach(function (F) { var on = b && (F === b.fac || F === b.doc); svg.appendChild(e('rect', { x:X(F.x) - 7, y:X(F.y) - 7, width:14, height:14, rx:3, fill:on ? '#1E7B46' : '#fff', stroke:'#49505A' })); svg.appendChild(e('text', { x:X(F.x), y:X(F.y) - 10, 'text-anchor':'middle', 'font-size':9, fill:'#49505A' }, F.name.replace('가상 ', ''))); });
  UNITS.forEach(function (u) { var on = u[0] === r.amb.id; svg.appendChild(e('polygon', { points:(X(u[2])) + ',' + (X(u[3]) - 6) + ' ' + (X(u[2]) - 5) + ',' + (X(u[3]) + 4) + ' ' + (X(u[2]) + 5) + ',' + (X(u[3]) + 4), fill:on ? '#1A5FB4' : '#9AA3B2' })); });
  svg.appendChild(e('circle', { cx:X(r.place[2]), cy:X(r.place[3]), r:6, fill:'#C9302C' })); svg.appendChild(e('text', { x:X(r.place[2]) + 9, y:X(r.place[3]) + 4, 'font-size':9, fill:'#C9302C' }, '신고'));
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

function topbar() { return h('div', { class:'topin' }, [h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 응급' })])])]); }
function kv(k, v, id) { return h('div', { class:'kv' }, [h('span', { text:k }), h('b', { id:id || null, text:v })]); }
function step(n, title, kids, id) {
  return h('div', { class:'card col', id:id || null, style:'margin-top:16px' }, [h('div', { class:'rowf' }, [pill(String(n), 'm'), h('b', { style:'font-size:17px', text:title })])].concat(kids));
}

// ── 평소 준비: 내 기기 ──
function devicesBody() {
  var m = devSummary(S.dev, kst()), f = S.form, e = S.err, kids = [];
  kids.push(h('b', { style:'font-size:16px', text:'내 기기' }));
  kids.push(h('div', { class:'sub', text:'폰·나비웹 워치·링(팔찌) 중 적어도 하나를 24시간 가까이 두어야 응급 호출이 가능합니다. 직접 적는 기록이며, 기기가 나비웹에 연결되는 기능은 아직 없어요.' }));
  kids.push(h('div', { class:'g4' }, [tile('등록한 기기', m.count + '개', '', 'emg-d0'), tile('24시간 가까이 두는 기기', m.carry + '개', m.carry ? '' : '하나 이상 필요해요', 'emg-d2'), tile('점검일 지남·오늘', m.due + '개', '', 'emg-d1')]));
  kids.push(h('div', { class:'frm' }, [sel('emg-dk', '종류', f.kind, DEVKINDS.map(function (k) { return [k, k]; }), function (v) { f.kind = v; }), field('emg-dn', '기기 이름', f.name, { err:e.name, ph:'예: 내 폰', max:40, set:function (v) { f.name = v; } }), field('emg-dc', '다음 점검·충전일(선택)', f.chk, { err:e.chk, ph:'2027-01-31', mode:'numeric', max:10, set:function (v) { f.chk = v.trim(); } })]));
  kids.push(h('label', { class:'chk', for:'emg-dcarry' }, [(function () { var c = h('input', { type:'checkbox', id:'emg-dcarry', checked:f.carry !== false ? true : false }); c.onchange = function () { f.carry = c.checked; }; return c; })(), h('span', { text:'24시간 가까이 둡니다' })]));
  kids.push(h('div', { class:'rowf' }, [btn('기록하기', 'fill', addDev), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null]));
  if (!S.dev.length) kids.push(h('div', { class:'empty', text:'아직 등록한 기기가 없어요.' }));
  else kids.push(h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['종류', '이름', '24시간', '점검일', ''].map(function (t) { return h('th', { text:t }); }))]),
    h('tbody', {}, S.dev.map(function (x) { return h('tr', {}, [h('td', {}, [pill(x.kind)]), h('td', {}, [h('b', { text:x.name })]), h('td', { text:x.carry ? '예' : '아니요' }), h('td', { class:'num', text:x.chk || '—' }), h('td', { class:'r' }, [btn('삭제', 'sm quiet', function () { S.dev = S.dev.filter(function (y) { return y.id !== x.id; }); S.msg = '삭제했어요.'; save(); render(); })])]); }))])]));
  return h('div', { class:'col' }, kids);
}

// ── 평소 준비: 보내는 정보 ──
function consentBody() {
  var n = h('span', { class:'sub', id:'emg-c-n' }), n2 = h('span', { class:'sub', id:'emg-a-n' });
  function tally() { n.textContent = '보내기로 고른 항목 ' + Object.keys(S.share).length + ' / ' + (SEND.length - 1) + ' (현재 위치 제외)'; n2.textContent = '답해도 되는 질문 ' + Object.keys(S.askok).length + ' / ' + ASKS.length; }
  function list(items, store, pre, fixedKey) {
    return h('div', {}, items.map(function (f) { var id = pre + f[0], cb = h('input', { type:'checkbox', id:id, checked:f[0] === fixedKey || store[f[0]] ? true : false, disabled:f[0] === fixedKey ? true : null });
      cb.onchange = function () { if (cb.checked) store[f[0]] = 1; else delete store[f[0]]; save(); tally(); sumUpdate(); }; return h('label', { class:'chk', for:id }, [cb, h('span', { text:f[1] + (f[0] === fixedKey ? ' (항상 포함)' : '') })]); }));
  }
  var box = h('div', { class:'col' }, [h('b', { style:'font-size:16px', text:'내 비서가 응급 AI에 보낼 정보' }),
    h('div', { class:'sub', text:'현재 위치는 구조에 꼭 필요해 항상 포함됩니다. 나머지는 항목마다 직접 정하고, 아래 흐름의 ②가 이 선택을 따릅니다. 고른 상태는 이 브라우저에만 저장돼요.' }),
    n, list(SEND, S.share, 'emg-sh-', 'loc'), h('div', { class:'rowf' }, [btn('모두 해제', 'quiet', function () { S.share = {}; save(); render(); })]),
    h('b', { style:'font-size:16px;margin-top:8px', text:'응급 AI가 내 비서에게 추가로 물어도 되는 것' }), n2, list(ASKS, S.askok, 'emg-ak-', null), h('div', { class:'sub', text:'예시입니다. 내 비서는 허용한 질문에만 내 기록을 바탕으로 답해요. 아래 흐름의 ③이 이 선택을 따릅니다.' })]);
  tally(); return box;
}
function prepSummary() { var m = devSummary(S.dev, kst()); return '평소 준비 — 기기 ' + m.count + '개(24시간 가까이 ' + m.carry + '개) · 보내는 정보 ' + sharedItems(S.share).length + '항목 · 허용한 질문 ' + askItems(S.askok).length + '개'; }
function sumUpdate() { var s = $('emg-prep-sum'); if (s) s.textContent = prepSummary(); }
function prepSection() {
  var det = h('details', { id:'emg-s-prep', class:'card', style:'margin-top:16px' }, [h('summary', { id:'emg-prep-sum', style:'cursor:pointer;font-weight:700;font-size:17px', text:prepSummary() }),
    h('div', { class:'col', style:'margin-top:16px;gap:24px' }, [devicesBody(), consentBody()])]);
  det.open = !!S.prepOpen; det.ontoggle = function () { S.prepOpen = det.open; };
  return det;
}

// ── 사건 정하기 + 호출 ──
function incidentCard() {
  var c = S.call, m = S.m, need = NEEDS[m.need];
  var dn = DEVICES.filter(function (d) { return d[0] === c.dev; })[0][1];
  return h('div', { id:'emg-s-call', class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'가상 사건 정하기' }),
    h('div', { class:'frm' }, [sel('emg-m-need', '응급 환자', m.need, Object.keys(NEEDS).map(function (k) { return [k, NEEDS[k].name]; }), function (v) { m.need = v; render(); }), sel('emg-m-place', '신고 위치', m.place, PLACES.map(function (p) { return [p[0], p[1]]; }), function (v) { m.place = v; render(); })]),
    h('div', { class:'sub', text:'이 환자에게 필요한 것: ' + need.sp + ' 전문의 + ' + need.eq }),
    h('div', { class:'lab', text:'호출하는 기기' }), seg('기기', DEVICES, c.dev, function (v) { c.dev = v; render(); }),
    h('div', { class:'lab', text:'지금 내 상태' }), seg('상태', CALLS, c.can, function (v) { c.can = v; render(); }),
    c.can === 'none' ? h('div', { class:'sub', id:'emg-c-none', text:'말을 하거나 문자를 입력하기 어려우면 오직 “응급” 메시지만 전달돼요.' }) : field('emg-say', c.can === 'voice' ? '말한 내용(가상)' : '입력한 문자(가상)', c.say, { ph:'예: 가슴이 너무 아파요', max:120, set:function (v) { c.say = v; } }),
    h('div', { class:'rowf', style:'margin-top:8px' }, [h('button', { type:'button', class:'btn fill', id:'emg-fire', text:dn + '로 응급 호출 (모의)', onclick:function () { c.fired = true; render(); try { var e = $('emg-s-flow'); if (e) e.scrollIntoView({ block:'start' }); } catch (x) {} } }), c.fired ? btn('처음으로', 'quiet', function () { c.fired = false; c.say = ''; S.m.hosp = newHosp(); render(); }) : null])]);
}

// ── 흐름 ①~⑥ ──
function flow() {
  var c = S.call, m = S.m, dn = DEVICES.filter(function (d) { return d[0] === c.dev; })[0][1], msg = callMessage(c.can, c.say);
  var r = match(m.need, m.place, m.hosp), b = r.best, sh = sharedItems(S.share), ak = askItems(S.askok), out = h('div', { id:'emg-s-flow' });
  out.appendChild(step(1, '호출 — 기기에서 응급 메시지가 전송됩니다', [kv('보낸 기기', dn), kv('받는 곳', '관련 기관(응급 AI)'), kv('전달 형태', msg.label, 'emg-c-mode'), msg.body ? kv('내용', msg.body, 'emg-c-body') : null,
    h('div', { class:'sub', id:'emg-c-flag', text:msg.only ? '오직 “응급” 메시지만 전달됐어요.' : '“응급” 표시와 함께 ' + (msg.mode === 'voice' ? '음성' : '문자') + '이(가) 전달됐어요.' })]));
  out.appendChild(step(2, '내 AI 비서가 응급 AI에 정보를 보냅니다', [kv('보내는 정보', sh.join(', '), 'emg-c-send'), h('div', { class:'sub', text:'위치·나이·성명·병력·생체 정보 같은 데이터 중 “평소 준비”에서 정한 항목만 보냅니다. 현재 위치는 항상 포함돼요.' })]));
  out.appendChild(step(3, '응급 AI가 내 비서에게 더 묻습니다', [kv('응급 AI의 질문(예)', '“마지막으로 먹은 음식은?” “오늘 격한 운동을 했나요?”'), kv('비서의 답', ak.length ? ak.join(', ') + '에 답함' : '허용한 질문이 없어 답하지 않음', 'emg-c-ask')]));
  out.appendChild(step(4, '신고 위치에서 가장 빠른 구급대를 출동시킵니다', [kv('출동 지시', r.amb.name + ' — 신고 위치(' + r.place[1] + ')까지 ' + r.amb.eta + '분'), kv('구급대가 받는 것', '실시간 데이터, 현장 처치와 이송 목적지 지시')]));
  // 5. 병·의원 인력·장비 조합
  var tb = h('table', { class:'tbl', id:'emg-m-res-tbl' }, [h('thead', {}, [h('tr', {}, ['병원', '전문의(근무)', '장비(사용 가능)'].map(function (t) { return h('th', { text:t }); }))]),
    h('tbody', {}, m.hosp.map(function (F) {
      var docs = Object.keys(F.docs).map(function (k) { return h('button', { type:'button', class:'chip', 'data-doc':F.id + ':' + k, 'aria-pressed':String(F.docs[k]), text:k + (F.docs[k] ? ' 근무' : ' 비번'), onclick:function () { F.docs[k] = !F.docs[k]; render(); } }); });
      var eqs = Object.keys(F.eq).map(function (k) { return h('button', { type:'button', class:'chip', 'data-eq':F.id + ':' + k, 'aria-pressed':String(F.eq[k]), text:k + (F.eq[k] ? ' 가능' : ' 사용 중'), onclick:function () { F.eq[k] = !F.eq[k]; render(); } }); });
      return h('tr', {}, [h('td', {}, [h('b', { text:F.name })]), h('td', {}, [h('div', { class:'chips' }, docs.length ? docs : [h('span', { class:'sub', text:'전문의 없음' })])]), h('td', {}, [h('div', { class:'chips' }, eqs.length ? eqs : [h('span', { class:'sub', text:'장비 없음' })])])]);
    }))]);
  var res = h('div', { class:'card col hero', id:'emg-m-res' });
  if (!b) { res.appendChild(h('div', { class:'big', text:'지금은 조합할 수 있는 인력·장비가 없어요' })); res.appendChild(h('div', { class:'sub', text:'가장 가까운 병원에서 상태를 안정시키며, 다른 병원의 인력·장비가 비는 대로 다시 조합합니다(연습).' })); }
  else { res.appendChild(h('div', { class:'big', id:'emg-m-start', text:'처치 시작 약 ' + b.start + '분 뒤 · ' + b.fac.name })); res.appendChild(h('div', { class:'sub', id:'emg-m-kind', text:b.kind === 'single' ? '한 병원에서 전문의와 장비를 모두 쓸 수 있어요.' : '전문의와 장비가 다른 병원에 있어 ' + b.doc.name + ' 의료진이 ' + b.fac.name + ' 장비로 처치하도록 조합했어요.' })); }
  var rows = r.options.slice(0, 5).map(function (o, i) { return h('tr', {}, [h('td', {}, [pill(o.kind === 'single' ? '한 병원' : '인력 이동', o.kind === 'single' ? 'm' : 'p')]), h('td', { text:o.fac.name }), h('td', { text:o.kind === 'single' ? '—' : o.doc.name }), h('td', { class:'r num', text:o.tPatient + '분' }), h('td', { class:'r num', text:o.kind === 'single' ? '—' : o.tDoc + '분' }), h('td', { class:'r num', text:(i === 0 ? '★ ' : '') + o.start + '분' })]); });
  var seen = {}, why = r.why.filter(function (w) { var k = w[0] + w[1]; if (seen[k]) return false; seen[k] = 1; return true; });
  out.appendChild(step(5, '병·의원의 인력·장비를 실시간으로 조합합니다', [
    h('div', { class:'sub', text:'응급 AI는 전국 병·의원·보건소의 위치, 의료진 전공·자격, 보유 장비, 인력별 일정, 장비별 가동·예약 상태를 실시간으로 갖고 있습니다. 아래 값은 모두 가상이며, 버튼을 눌러 전문의가 퇴근하거나 장비가 사용 중이 된 상황을 만들면 결과가 바로 달라져요(저장하지 않습니다).' }),
    h('div', { class:'tbw' }, [tb]), h('div', { class:'rowf' }, [btn('처음 상태로', 'quiet', function () { m.hosp = newHosp(); render(); })]),
    res,
    h('b', { text:'가능한 조합(빠른 순)' }), rows.length ? h('div', { class:'tbw' }, [h('table', { class:'tbl', id:'emg-m-opts' }, [h('thead', {}, [h('tr', {}, ['방식', '처치 장소', '전문의 출발', '환자 도착', '전문의 도착', '시작'].map(function (t, i) { return h('th', { class:i > 2 ? 'r' : '', text:t }); }))]), h('tbody', {}, rows)])]) : h('div', { class:'empty', text:'가능한 조합이 없어요.' }),
    h('div', {}, [mapSvg(r, m.hosp), h('div', { class:'sub', text:'빨간 점이 신고 위치, 삼각형이 구급대(파란색이 출동), 네모가 병원이에요. 파란 선은 환자 이송, 초록 점선은 전문의 이동입니다.' })]),
    why.length ? h('div', { id:'emg-m-why' }, [h('b', { text:'조합에서 빠진 이유' }), h('div', {}, why.map(function (w) { return kv(w[0], w[1]); }))]) : null]));
  // 6. 현장 처치·이송 지시
  out.appendChild(step(6, '구급대와 의료진에게 현장 처치·이송을 지시합니다', b ? [h('div', {}, planText(r).map(function (x, i) { return h('div', { class:'stp', 'data-s':String(i) }, [h('i', { text:String(i + 1) }), h('div', {}, [h('span', { text:x })])]); })), h('div', { class:'sub', id:'emg-f-end', text:'구급대와 의료진은 처치 도중에도 응급 AI에서 실시간 데이터를 받습니다.' })]
    : [h('div', { class:'sub', id:'emg-f-end', text:'조합이 가능해지는 즉시 다시 계산해 지시합니다. 그동안 구급대는 가장 가까운 병원에서 상태를 안정시킵니다.' })]));
  out.appendChild(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('응급 AI에게 묻기', 'quiet', function () { ask('다른 병원의 의료진과 장비를 어떻게 조합하나요?'); })]));
  return out;
}

function render() {
  var root = $('emg-root'), tp = $('emg-top'); if (!root || !tp) return;
  var y = 0; try { y = window.pageYOffset || 0; } catch (e) {}
  root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = head('응급', '폰·나비웹 워치·링(팔찌) 중 하나를 24시간 가까이 두고, 위급할 때 가장 단순한 조작 한 번으로 부릅니다. 호출부터 병·의원 인력·장비 조합, 현장 처치 시작까지 한 사건의 흐름을 위에서 아래로 따라가 보세요.');
  kids.push(mockNote('모의 체험입니다. 아무것도 전송되지 않고 출동도 일어나지 않아요. 병원·시간은 모두 가상 값입니다.'));
  kids.push(prepSection(), incidentCard());
  kids.push(S.call.fired ? flow() : h('div', { id:'emg-s-flow', class:'card', style:'margin-top:16px' }, [h('div', { class:'empty', text:'사건을 정하고 호출해 보면, 무엇이 누구에게 전달되는지 순서대로 보여 줘요.' })]));
  kids.forEach(function (k) { if (k) root.appendChild(k); });
  if (y) { try { window.scrollTo(0, y); } catch (e) {} }
}
function reply(ok, msg) { emit('result', { ok:ok, msg:msg }); }
function go(v) {
  var a = ANCH[v]; if (!a) return false;
  if (a === 'emg-s-prep') S.prepOpen = true;
  render(); var e = $(a) || $('emg-s-call'); try { if (e) e.scrollIntoView({ block:'start' }); } catch (x) {}
  return true;
}
function nav(a) {
  var d = a && typeof a['do'] === 'string' ? a['do'] : '';
  if (go(d)) return reply(true, d === 'prep' || d === 'devices' || d === 'consent' ? '평소 준비 구역으로 이동했습니다.' : d === 'call' ? '사건 정하기 구역으로 이동했습니다.' : '흐름 구역으로 이동했습니다.');
  return reply(false, '지원하지 않는 요청입니다.');
}
function mount(el, o) {
  if (!el) return; o = o || {};
  M = el; el.textContent = ''; el.classList.add('emg'); S.share = {}; S.askok = {}; S.dev = []; S.err = {}; S.msg = ''; S.prepOpen = false; S.call = { dev:'phone', can:'voice', say:'', fired:false }; S.m = { need:'ami', place:'p1', hosp:newHosp() }; load();
  [h('div', { id:'emg-top' }), h('div', { class:'wrap', id:'emg-root' })].forEach(function (x) { el.appendChild(x); });
  if (o.view && ANCH[o.view] && o.view !== 'call') go(o.view); else render();
}
window.NaviEmergency = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M) go(v); },
  callMessage:callMessage, match:match, newHosp:newHosp, planText:planText, devSummary:devSummary, sharedItems:sharedItems,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
