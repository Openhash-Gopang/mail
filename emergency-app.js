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
var ANCH = { call:'emg-list', flow:'emg-list', follow:'emg-list', match:'emg-list', prep:'emg-s-prep', devices:'emg-s-prep', consent:'emg-s-prep' };
var M = null, LS = {};
var S = { share:{}, askok:{}, dev:[], form:{ kind:'폰', carry:true }, err:{}, msg:'', prepOpen:false, m:{ hosp:null }, sim:null, wasOpen:false };

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

// ── 가상 사건(무작위) ──
/** 기기·사건·신고자·위치를 무작위로 뽑는다. rng 를 넘기면 같은 값이 나온다(시험용). */
var INCIDENTS = [
  { id:'chest', kind:'질병', name:'가슴 통증·식은땀', need:'ami', say:'가슴이 너무 아파요', can:'voice', est:'급성 심근경색 의심', conf:'높음', age:[48, 66], hist:['고혈압', '당뇨', '고지혈증'], vit:'심박 118회/분(빠름) · 혈압 92/58 · 산소포화도 94%', onsite:'안정 자세 유지, 심전도 측정, 산소포화도 확인',
    asks:[['마지막으로 먹은 음식은?', '점심에 국밥, 약 2시간 전'], ['오늘 격한 운동을 했나요?', '아니요, 계단을 급하게 오른 정도']] },
  { id:'stroke', kind:'질병', name:'한쪽 팔 마비·말 어눌', need:'stroke', say:'', can:'none', est:'뇌졸중 의심', conf:'높음', age:[58, 78], hist:['고혈압', '심방세동'], vit:'심박 96회/분 · 혈압 168/96 · 산소포화도 97%', onsite:'발병 시각 기록, 혈당 측정, 머리를 약간 높여 눕히기',
    asks:[['마지막으로 정상이었던 시각은?', '약 40분 전, 아침 식사를 마칠 때'], ['오늘 격한 운동을 했나요?', '아니요']] },
  { id:'car', kind:'사고', name:'교통사고 다발 외상', need:'trauma', say:'차에 부딪혔어요, 다리가 안 움직여요', can:'voice', est:'중증 외상 의심(다리·골반)', conf:'중간', age:[24, 55], hist:['특이 병력 없음'], vit:'심박 124회/분(빠름) · 혈압 98/62 · 산소포화도 95%', onsite:'지혈, 경추·다리 고정, 움직이지 않게 유지',
    asks:[['마지막으로 먹은 음식은?', '30분 전 커피와 빵'], ['복용 중인 혈액 응고 관련 약이 있나요?', '없음']] },
  { id:'fall', kind:'사고', name:'작업 중 추락', need:'trauma', say:'사다리에서 떨어졌어요', can:'text', est:'추락 외상 의심(머리·허리)', conf:'중간', age:[35, 62], hist:['허리 디스크'], vit:'심박 108회/분 · 혈압 110/70 · 산소포화도 96%', onsite:'머리·척추 고정, 의식 수준 반복 확인, 출혈 압박',
    asks:[['추락 높이는 얼마였나요?', '약 3m'], ['오늘 마지막으로 먹은 음식은?', '1시간 전 김밥']] },
  { id:'infant', kind:'질병', name:'영아 호흡곤란', need:'infant', say:'아기가 숨쉬기 힘들어해요', can:'voice', est:'영아 급성 호흡곤란 의심', conf:'중간', guardian:'어머니', age:[0, 0], hist:['조산(34주)'], vit:'호흡 62회/분(빠름) · 심박 168회/분 · 산소포화도 91%', onsite:'기도 확보, 산소포화도 확인, 보호자와 함께 안정',
    asks:[['아기가 마지막으로 먹은 시각은?', '약 1시간 전 분유'], ['열이 있었나요?', '어제부터 미열']] }
];
var NAMES = ['김가온', '이서연', '박도윤', '최하린', '정민준', '한지우', '오세아', '윤태양'];
var BLOODS = ['A+', 'B+', 'O+', 'AB+', 'A-', 'O-'];
var ONSITE_NOTE = '아래 처치 내용은 모두 가상 시나리오입니다.';
function pick(a, r) { return a[Math.min(a.length - 1, Math.floor(r() * a.length))]; }
function sig(txt) {
  function f(x) { var v = 2166136261, i; for (i = 0; i < x.length; i++) { v ^= x.charCodeAt(i); v = Math.imul(v, 16777619) >>> 0; } return ('00000000' + v.toString(16)).slice(-8); }
  return 'SIG-' + f(txt) + f(txt + '#');
}
function clock(ms) { return new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Seoul', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(new Date(ms)); }
function draw(rng, now) {
  var r = typeof rng === 'function' ? rng : Math.random, t0 = now == null ? Date.now() : now;
  var inc = pick(INCIDENTS, r), dev = pick(DEVICES, r), pl = pick(PLACES, r), kid = !!inc.guardian;
  var age = kid ? 0 : inc.age[0] + Math.floor(r() * (inc.age[1] - inc.age[0] + 1)), pn = pick(NAMES, r), rn = kid ? pick(NAMES, r) : pn;
  var can = dev[0] === 'ring' ? 'none' : dev[0] === 'watch' ? (inc.can === 'none' ? 'none' : 'voice') : inc.can;
  var sc = { inc:inc, dev:dev[0], devName:dev[1], place:pl[0], placeName:pl[1], xy:[pl[2], pl[3]], need:inc.need, can:can, say:can === 'none' ? '' : inc.say, t0:t0,
    reporter:{ name:rn, rel:kid ? '보호자(' + inc.guardian + ')' : '본인' },
    patient:{ name:pn, age:age, ageText:kid ? '생후 8개월' : age + '세', sex:pick(['남', '여'], r), blood:pick(BLOODS, r), hist:inc.hist.join(', '), meds:kid ? '알레르기 없음' : pick(['복용 약 없음', '혈압약 복용 중', '알레르기: 페니실린', '아스피린 복용 중'], r), vit:inc.vit } };
  var m = callMessage(sc.can, sc.say); sc.msg = m;
  sc.payload = [m.label, m.body, sc.reporter.name, sc.patient.name, sc.patient.ageText, sc.patient.sex, sc.patient.blood, sc.patient.hist, sc.patient.meds, sc.patient.vit, pl[1], t0].join('|') + '|' + sc.dev;
  sc.sig = sig(sc.payload); sc.no = 'EM-' + sc.sig.slice(4, 10).toUpperCase();
  return sc;
}
function verify(sc) { return sig(sc.payload) === sc.sig; }
function gather(sc, hosp) {
  var P = sc.xy, need = NEEDS[sc.need];
  var units = UNITS.map(function (u) { return { id:u[0], name:u[1], eta:dist([u[2], u[3]], P) }; }).sort(function (a, b) { return a.eta - b.eta; });
  var hs = hosp.map(function (F) { return { F:F, move:dist(P, [F.x, F.y]), doc:need.sp in F.docs ? (F.docs[need.sp] ? '근무 중' : '비번') : '전문의 없음', eq:need.eq in F.eq ? (F.eq[need.eq] ? '가능' : '사용 중') : '없음' }; });
  return { units:units, hosp:hs, r:match(sc.need, sc.place, hosp) };
}
function form(groups) {
  var kids = [];
  groups.forEach(function (g) { kids.push(h('div', { class:'lab', style:'margin:12px 0 4px', text:g[0] })); g[1].forEach(function (p) { if (p) kids.push(kv(p[0], p[1], p[2])); }); });
  return h('div', { style:'border:1px solid var(--line);border-radius:12px;padding:4px 16px 12px' }, kids);
}
function sub(t) { return h('b', { style:'display:block;margin-top:8px', text:t }); }

// ── 흐름 계산 ──
function ctx() { var sc = S.sim.sc, live = match(sc.need, sc.place, S.m.hosp); return { sc:sc, g:gather(sc, S.m.hosp), live:live, p0:S.sim.plan0 || live }; }
function none(id, t) { return [h('div', { class:'sub', id:id, text:t })]; }
function rows3(rows) { return rows.length ? h('div', { class:'tbw' }, [h('table', { class:'tbl', id:'emg-m-opts' }, [h('thead', {}, [h('tr', {}, ['방식', '처치 장소', '전문의 출발', '환자 도착', '전문의 도착', '시작'].map(function (t, i) { return h('th', { class:i > 2 ? 'r' : '', text:t }); }))]), h('tbody', {}, rows)])]) : h('div', { class:'empty', text:'가능한 조합이 없어요.' }); }
function dispatchList(sc, r) {
  var b = r.best, need = r.need; if (!b) return [];
  var L = [{ k:'amb', who:'구급대(119) ' + r.amb.name, order:'신고 위치(' + sc.placeName + ')로 출동하고, 도착 후 현장에서 처치하며 ' + b.fac.name + '으로 이송합니다. 현장 처치: ' + sc.inc.onsite + '.', due:r.amb.eta + '분 뒤 현장 도착 · ' + b.tPatient + '분 뒤 병원 도착' }];
  if (b.kind === 'split') L.push({ k:'doc', who:b.doc.name + ' ' + need.sp + ' 의료진', order:'대기 중인 자율주행차량(가상)에 타고 ' + b.fac.name + '으로 이동해 ' + need.eq + '로 처치할 준비를 합니다.', due:b.tDoc + '분 뒤 도착(준비 ' + PREP + '분 포함)' });
  else L.push({ k:'doc', who:b.fac.name + ' ' + need.sp + ' 의료진', order:'그 자리에서 환자를 맞을 준비를 합니다.', due:'즉시 대기' });
  L.push({ k:'fac', who:b.fac.name + ' 시설·장비', order:need.eq + ' 예약을 확정하고 수용 준비를 합니다. 환자가 오기 전에 마칩니다.', due:Math.max(1, b.tPatient - 1) + '분 안에 준비 완료' });
  return L;
}
function statusAt(sc, r, t) {
  var b = r.best, o = {}; if (!b) return o;
  o.amb = t < r.amb.eta ? '신고 위치로 이동 중' : t < b.tPatient ? '현장 처치 후 병원으로 이송 중' : '병원 도착';
  o.doc = b.kind === 'split' ? (t < PREP ? '출발 준비' : t < b.tDoc ? '자율주행차량으로 이동 중' : '도착, 처치 준비 완료') : '대기 중';
  o.fac = t < Math.max(1, b.tPatient - 1) ? '수용 준비 중' : '준비 완료';
  return o;
}
function timeBar(c, r) {
  var b = r.best, sc = c.sc, t = Math.min(S.sim.t, b.start + 1);
  var lab = h('b', { id:'emg-t-lab', text:'경과 T+' + t + '분 · 가상 시각 ' + clock(sc.t0 + t * 60000) });
  var rg = h('input', { type:'range', id:'emg-t', min:'0', max:String(b.start + 1), value:String(t), 'aria-label':'경과 시간(분)', style:'width:100%' });
  rg.oninput = function () { var v = Number(rg.value), o = statusAt(sc, r, v); S.sim.t = v; lab.textContent = '경과 T+' + v + '분 · 가상 시각 ' + clock(sc.t0 + v * 60000); ['amb', 'doc', 'fac'].forEach(function (k) { var e = $('emg-st-' + k); if (e) e.textContent = o[k]; }); };
  return h('div', { class:'card col', style:'margin-top:12px' }, [lab, rg, h('div', { class:'sub', text:'막대를 끌어 시간이 흐를 때 상태가 어떻게 바뀌는지 보세요. ' + ONSITE_NOTE })]);
}
function sendForm(sc) {
  var m = sc.msg, p = sc.patient;
  return form([
    ['① 기기에서 보낸 응급 메시지', [['전송 기기', sc.devName + (sc.dev === 'ring' ? ' (말·문자 입력이 없는 기기)' : ''), 'emg-s1-dev'], ['전달 형태', m.label, 'emg-s1-mode'], ['내용', m.body || '없음 — 오직 “응급”만 전달', 'emg-s1-body'], ['받는 곳', '응급 AI']]],
    ['② 내 AI 비서가 첨부한 신고자·환자 정보', [['신고자', sc.reporter.name + ' · ' + sc.reporter.rel, 'emg-s1-rep'], ['환자 성명', p.name, 'emg-s1-name'], ['나이 · 성별', p.ageText + ' · ' + p.sex], ['혈액형', p.blood, 'emg-s1-blood'], ['과거 질병 이력', p.hist, 'emg-s1-hist'], ['복용 약 · 알레르기', p.meds], ['생체 정보', p.vit], ['현재 위치', sc.placeName + ' (가상 좌표 ' + sc.xy[0] + ', ' + sc.xy[1] + ')', 'emg-s1-loc']]],
    ['③ 접수 정보', [['신고 시각', clock(sc.t0) + ' (가상)'], ['사건 번호', sc.no, 'emg-s1-no']]],
    ['④ 신고자의 디지털 서명', [['서명값', sc.sig, 'emg-s1-sig'], ['서명 방식', '신고자 단말의 개인 키로 서명(가상). 응급 AI가 받은 뒤 확인합니다.']]]]);
}

// ── 19개 세부 단계(각각 오른쪽 패널에 결과를 보여 준다) ──
function s11(c) { var sc = c.sc, how = { phone:'폰의 응급 버튼을 한 번 누릅니다.', watch:'나비웹 워치의 응급 버튼을 길게 누릅니다.', ring:'링(팔찌)을 두 번 눌러 응급을 보냅니다.' }[sc.dev];
  return [h('div', { class:'sub', text:'가상 사건입니다. 기기와 사건은 무작위로 뽑았어요.' }), form([['기기 호출', [['사용한 기기', sc.devName, 'emg-s1-dev'], ['조작(가상)', how], ['호출 시각', clock(sc.t0) + ' (가상)'], ['어떤 상황', sc.inc.kind + ' · ' + sc.inc.name, 'emg-s1-inc']]]])]; }
function s12(c) { var sc = c.sc, m = sc.msg;
  return [form([['응급 메시지 구성', [['말·문자 입력', sc.can === 'voice' ? '말할 수 있음' : sc.can === 'text' ? '문자를 입력할 수 있음' : '둘 다 어려움'], ['전달 형태', m.label, 'emg-s1-mode'], ['내용', m.body || '없음 — 오직 “응급”만 전달', 'emg-s1-body'], ['이유', m.only ? (sc.dev === 'ring' ? '링에는 말·문자 입력이 없어 “응급”만 갑니다.' : '말도 문자도 어려워 “응급”만 갑니다.') : '“응급” 표시와 함께 ' + (m.mode === 'voice' ? '음성' : '문자') + '을(를) 보냅니다.']]]])]; }
function s13(c) { var sc = c.sc, p = sc.patient;
  return [h('div', { class:'sub', text:'신고자의 나만의 AI 비서가 붙이는 정보입니다. 이 시뮬레이션은 모든 항목을 보내기로 한 경우를 보여 줍니다. 실제로는 “평소 준비”에서 고른 항목만 전송되고, 현재 위치는 항상 포함돼요.' }),
    form([['신고자·환자 정보', [['신고자', sc.reporter.name + ' · ' + sc.reporter.rel, 'emg-s1-rep'], ['환자 성명', p.name, 'emg-s1-name'], ['나이 · 성별', p.ageText + ' · ' + p.sex], ['혈액형', p.blood, 'emg-s1-blood'], ['과거 질병 이력', p.hist, 'emg-s1-hist'], ['복용 약 · 알레르기', p.meds], ['생체 정보', p.vit], ['현재 위치', sc.placeName + ' (가상 좌표 ' + sc.xy[0] + ', ' + sc.xy[1] + ')', 'emg-s1-loc']]]])]; }
function s14(c) { return [h('div', { class:'sub', text:'위 내용을 하나의 Form으로 묶어 신고자의 디지털 서명을 붙이고 응급 AI로 보냅니다.' }), sendForm(c.sc)]; }
function s21(c) { var sc = c.sc; return [form([['서명 확인', [['받은 서명', sc.sig], ['확인 결과', verify(sc) ? '일치 — 전달 중 내용이 바뀌지 않았어요' : '불일치 — 위변조 의심', 'emg-s2-sig'], ['사건 번호', sc.no]]]])]; }
function s22(c) { var sc = c.sc, p = sc.patient, need = c.live.need;
  return [form([['신상 정보와 사고 내용 정리', [['환자', p.name + ' · ' + p.ageText + ' · ' + p.sex + ' · ' + p.blood], ['과거 질병 이력', p.hist], ['생체 정보', p.vit], ['전달된 내용', sc.msg.body || '“응급”만 전달됨'], ['사고 내용(추정)', sc.inc.est + ' — 신뢰도 ' + sc.inc.conf + ' (' + sc.inc.kind + ')', 'emg-s2-est'], ['필요한 처치 자원', need.sp + ' 전문의 + ' + need.eq]]]])]; }
function s23(c) { return [h('div', { class:'sub', text:'응급 AI가 처치에 꼭 필요한 것을 신고자의 비서에게 더 묻습니다. 비서는 허용된 질문에만 기록을 바탕으로 답해요.' }), form([['추가 질의', c.sc.inc.asks.map(function (a, i) { return ['응급 AI → 비서: ' + a[0], '답: ' + a[1] + ' (가상)', 'emg-s2-ask' + i]; })]])]; }
function s24(c) {
  var sc = c.sc, g = c.g, hosp = S.m.hosp, lock = !!S.sim.plan0;
  var unitRows = g.units.map(function (u, i) { return h('tr', {}, [h('td', {}, [pill('구급대(119)', 'm')]), h('td', { text:u.name }), h('td', { class:'r num', text:u.eta + '분' }), h('td', { text:i === 0 ? '★ 가장 가까움' : '' })]); });
  var hrows = g.hosp.map(function (x) { var F = x.F;
    var docs = Object.keys(F.docs).map(function (k) { return h('button', { type:'button', class:'chip', disabled:lock ? true : null, 'data-doc':F.id + ':' + k, 'aria-pressed':String(F.docs[k]), text:k + (F.docs[k] ? ' 근무' : ' 비번'), onclick:function () { F.docs[k] = !F.docs[k]; render(); } }); });
    var eqs = Object.keys(F.eq).map(function (k) { return h('button', { type:'button', class:'chip', disabled:lock ? true : null, 'data-eq':F.id + ':' + k, 'aria-pressed':String(F.eq[k]), text:k + (F.eq[k] ? ' 가능' : ' 사용 중'), onclick:function () { F.eq[k] = !F.eq[k]; render(); } }); });
    return h('tr', {}, [h('td', {}, [h('b', { text:F.name })]), h('td', { class:'r num', text:x.move + '분' }), h('td', {}, [h('div', { class:'chips' }, docs.length ? docs : [h('span', { class:'sub', text:'전문의 없음' })])]), h('td', {}, [h('div', { class:'chips' }, eqs.length ? eqs : [h('span', { class:'sub', text:'장비 없음' })])])]); });
  return [h('div', { class:'sub', text:'신고 위치(' + sc.placeName + ')를 중심으로 가용한 구급대(119), 병·의원의 전문의·장비, 자율주행차량을 모읍니다.' }),
    h('div', { class:'tbw' }, [h('table', { class:'tbl', id:'emg-s2-units' }, [h('thead', {}, [h('tr', {}, ['구분', '자원', '도착', ''].map(function (t, i) { return h('th', { class:i === 2 ? 'r' : '', text:t }); }))]), h('tbody', {}, unitRows)])]),
    h('div', { class:'tbw' }, [h('table', { class:'tbl', id:'emg-m-res-tbl' }, [h('thead', {}, [h('tr', {}, ['병·의원', '위치까지', '전문의(근무)', '장비(사용 가능)'].map(function (t, i) { return h('th', { class:i === 1 ? 'r' : '', text:t }); }))]), h('tbody', {}, hrows)])]),
    h('div', { class:'sub', id:'emg-s2-av', text:'자율주행차량: 병·의원마다 1대가 대기 중이에요(가상).' }),
    h('div', { class:'sub', text:lock ? '계획이 확정되어 현황은 더 바꿀 수 없어요.' : '버튼을 눌러 전문의가 퇴근하거나 장비가 사용 중이 된 상황을 만들면 다음 단계의 조합이 달라져요(저장하지 않습니다).' }),
    lock ? null : h('div', { class:'rowf' }, [btn('처음 상태로', 'quiet', function () { S.m.hosp = newHosp(); render(); })])]; }
function s25(c) {
  var r = c.live, b = r.best, hosp = S.m.hosp;
  var res = h('div', { class:'card col hero', id:'emg-m-res' });
  if (!b) { res.appendChild(h('div', { class:'big', text:'지금은 조합할 수 있는 인력·장비가 없어요' })); res.appendChild(h('div', { class:'sub', id:'emg-m-kind', text:'가장 가까운 병원에서 상태를 안정시키며, 다른 병원의 인력·장비가 비는 대로 다시 조합합니다(연습).' })); }
  else { res.appendChild(h('div', { class:'big', id:'emg-m-start', text:'처치 시작 약 ' + b.start + '분 뒤 · ' + b.fac.name })); res.appendChild(h('div', { class:'sub', id:'emg-m-kind', text:b.kind === 'single' ? '한 병원에서 전문의와 장비를 모두 쓸 수 있어요.' : '전문의와 장비가 다른 병원에 있어 ' + b.doc.name + ' 의료진이 ' + b.fac.name + ' 장비로 처치하도록 조합했어요.' })); }
  var opts = r.options.slice(0, 5).map(function (o, i) { return h('tr', {}, [h('td', {}, [pill(o.kind === 'single' ? '한 병원' : '인력 이동', o.kind === 'single' ? 'm' : 'p')]), h('td', { text:o.fac.name }), h('td', { text:o.kind === 'single' ? '—' : o.doc.name }), h('td', { class:'r num', text:o.tPatient + '분' }), h('td', { class:'r num', text:o.kind === 'single' ? '—' : o.tDoc + '분' }), h('td', { class:'r num', text:(i === 0 ? '★ ' : '') + o.start + '분' })]); });
  var seen = {}, why = r.why.filter(function (w) { var k = w[0] + w[1]; if (seen[k]) return false; seen[k] = 1; return true; });
  return [res, sub('가능한 조합(빠른 순)'), rows3(opts), h('div', {}, [mapSvg(r, hosp), h('div', { class:'sub', text:'빨간 점이 신고 위치, 삼각형이 구급대(파란색이 출동), 네모가 병원이에요. 파란 선은 환자 이송, 초록 점선은 전문의 이동입니다.' })]),
    why.length ? h('div', { id:'emg-m-why' }, [h('b', { text:'조합에서 빠진 이유' }), h('div', {}, why.map(function (w) { return kv(w[0], w[1]); }))]) : null]; }
function s26(c) { var r = c.live, b = r.best;
  if (!b) return none('emg-s2-plan', '조합이 불가능해 계획서는 “가장 가까운 병원에서 안정화”로 작성됩니다.');
  return [form([['응급 대응 계획서 · ' + c.sc.no, [['신고 위치', c.sc.placeName], ['처치 장소', b.fac.name, 'emg-s2-plan'], ['조합 방식', b.kind === 'single' ? '한 병원에서 전문의와 장비를 함께 사용' : b.doc.name + ' 의료진이 ' + b.fac.name + ' 장비로 처치(자율주행차량 급파)'], ['출동 구급대', r.amb.name + ' (' + r.amb.eta + '분)'], ['환자 도착', b.tPatient + '분 뒤'], ['전문의 도착', b.kind === 'split' ? b.tDoc + '분 뒤' : '대기 중'], ['필요 장비', r.need.eq], ['처치 시작', '약 ' + b.start + '분 뒤']]]]),
    h('div', {}, planText(r).map(function (x, i) { return h('div', { class:'stp', 'data-s':String(i) }, [h('i', { text:String(i + 1) }), h('div', {}, [h('span', { text:x })])]); }))]; }
function s31(c) { var r = c.p0, L = dispatchList(c.sc, r); if (!L.length) return none('emg-s3-none', '지금은 조합할 인력·장비가 없어, 구급대는 가장 가까운 병원에서 상태를 안정시키고 조합이 가능해지면 다시 지시합니다.');
  return [h('div', { class:'sub', text:'응급 AI가 구급대(119), 의료진, 장비(자율주행차량 포함), 병원에 지시서를 동시에 보냅니다. 발송 시각은 T+0분입니다.' }),
    h('div', { class:'tbw' }, [h('table', { class:'tbl', id:'emg-s3-tbl' }, [h('thead', {}, [h('tr', {}, ['받는 곳', '지시 내용', '예정'].map(function (x) { return h('th', { text:x }); }))]), h('tbody', {}, L.map(function (x) { return h('tr', {}, [h('td', {}, [h('b', { text:x.who })]), h('td', { text:x.order }), h('td', { text:x.due })]); }))])])]; }
function s3one(k, title) { return function (c) { var r = c.p0, L = dispatchList(c.sc, r); if (!L.length) return none('emg-s3-none', '조합이 가능해질 때까지 지시가 보류됩니다.');
  var x = L.filter(function (y) { return y.k === k; })[0], st = statusAt(c.sc, r, Math.min(S.sim.t, r.best.start + 1));
  return [form([[title, [['받는 곳', x.who], ['지시 내용', x.order], ['예정', x.due], ['지금 상태', st[k], 'emg-st-' + k]]]]), timeBar(c, r)]; }; }
function s35(c) {
  var p0 = c.p0, b = p0.best, ev = S.sim.ev, kids = [h('div', { class:'sub', text:'이동 중에도 응급 AI는 병·의원의 인력·장비 현황을 실시간으로 받습니다. 처치할 장비가 갑자기 사용 중이 되면 조합을 다시 계산해 이송 목적지를 바꿔요. 이 단계는 건너뛰어도 됩니다.' })];
  if (!b) return kids.concat(none('emg-ev-none', '조합할 계획이 없어 다시 계산할 것이 없어요.'));
  kids.push(h('div', { class:'rowf' }, [h('button', { type:'button', class:'btn fill', id:'emg-ev', disabled:ev ? true : null, text:ev ? '사건이 발생했어요' : '이동 중 사건 일으키기 (모의)', onclick:triggerEvent })]));
  if (ev) {
    var n = ev.after.best, rows = [['발생 시각', 'T+' + ev.at + '분 · 가상 ' + clock(c.sc.t0 + ev.at * 60000)], ['사건', ev.fac + '의 ' + ev.eq + '가 다른 응급 환자에게 배정됨'], ['응급 AI 판단', '구급대가 이동하는 중에 조합을 다시 계산'], ['이전 계획', b.fac.name + ' · 처치 시작 약 ' + b.start + '분 뒤'],
      ['새 계획', n ? n.fac.name + ' · 처치 시작 약 ' + n.start + '분 뒤' + (n.kind === 'split' ? ' (' + n.doc.name + ' 의료진이 자율주행차량으로 이동)' : '') : '조합 불가 — 가장 가까운 병원에서 안정화', 'emg-ev-new'], ['구급대에 지시', n ? '이송 목적지를 ' + n.fac.name + '으로 변경' : '가장 가까운 병원으로 이송하고 안정화']];
    kids.push(form([['실시간 재조합', rows]]));
    if (n) kids.push(h('div', {}, planText(ev.after).map(function (x, i) { return h('div', { class:'stp', 'data-s':String(i) }, [h('i', { text:String(i + 1) }), h('div', {}, [h('span', { text:x })])]); })));
  }
  return kids;
}
function triggerEvent() {
  var sm = S.sim, p0 = sm.plan0 || match(sm.sc.need, sm.sc.place, S.m.hosp), b = p0.best; if (!b || sm.ev) return; if (!sm.plan0) sm.plan0 = p0;
  var need = NEEDS[sm.sc.need]; b.fac.eq[need.eq] = false; sm.ev = { at:Math.max(1, p0.amb.eta - 1), fac:b.fac.name, eq:need.eq, after:match(sm.sc.need, sm.sc.place, S.m.hosp) }; render();
}
function holdMsg() { return S.sim.ev ? '이동 중 장비가 막혀 새 계획을 세울 수 없어요. 구급대는 가장 가까운 병원으로 가서 환자 상태를 안정시키고, 조합이 가능해지면 다시 인계합니다.' : '조합이 가능해질 때까지 인계는 보류됩니다.'; }
function s41(c) { var r = c.live, b = r.best; if (!b) return none('emg-s4-none', holdMsg());
  var st = statusAt(c.sc, r, b.start);
  return [h('div', { class:'sub', text:S.sim.ev ? '이동 중 계획이 바뀌어, 새 계획대로 ' + b.fac.name + '에서 인계합니다.' : '환자가 도착했는지, 의료진과 장비가 준비됐는지 확인합니다.' }),
    form([['도착·준비 확인', [['환자', b.fac.name + ' 도착 (T+' + b.tPatient + '분)', 'emg-s4-ready'], ['구급대', st.amb], ['의료진', (b.kind === 'split' ? b.doc.name + ' ' : b.fac.name + ' ') + r.need.sp + ' — ' + st.doc], ['장비·시설', r.need.eq + ' — ' + st.fac]]]])]; }
function handBase(c) { var b = c.live.best; return c.sc.no + '|' + b.fac.name + '|' + clock(c.sc.t0 + b.start * 60000); }
function s42(c) { var r = c.live, b = r.best, sc = c.sc, p = sc.patient; if (!b) return none('emg-s4-none', holdMsg());
  return [form([['인계 기록(구급대 → 의료진)', [['환자', p.name + ' · ' + p.ageText + ' · ' + p.sex + ' · ' + p.blood], ['과거 질병 이력', p.hist], ['복용 약 · 알레르기', p.meds], ['사고 내용(추정)', sc.inc.est], ['현장 처치', sc.inc.onsite], ['이송 중 생체 정보', p.vit + ' (최근 값, 가상)'], ['비서의 추가 답', sc.inc.asks.map(function (a) { return a[0] + ' ' + a[1]; }).join(' / ')]]]]), h('div', { class:'sub', text:ONSITE_NOTE })]; }
function s43(c) { var r = c.live, b = r.best, sc = c.sc; if (!b) return none('emg-s4-none', holdMsg());
  var at = clock(sc.t0 + b.start * 60000), base = handBase(c);
  return [form([['인수·서명', [['인계 시각', 'T+' + b.start + '분 · 가상 ' + at, 'emg-s4-at'], ['인계 장소', b.fac.name, 'emg-s4-fac'], ['넘기는 쪽', '구급대 ' + r.amb.name], ['받는 쪽', (b.kind === 'split' ? b.doc.name : b.fac.name) + ' ' + r.need.sp + ' 의료진', 'emg-s4-dr'], ['넘기는 쪽 서명', sig(base + '|EMS'), 'emg-s4-sig1'], ['받는 쪽 서명', sig(base + '|DR'), 'emg-s4-sig2']]]])]; }
function s44(c) { var r = c.live, b = r.best; if (!b) return none('emg-s4-none', holdMsg());
  return [h('div', { class:'card col hero' }, [h('div', { class:'big', id:'emg-s4-end', text:'신고 후 약 ' + b.start + '분 만에 ' + b.fac.name + '에서 처치가 시작됩니다' }), h('div', { class:'sub', text:'이 흐름은 모두 모의 체험이며, 병원·시간·처치 내용은 가상입니다.' })]),
    form([['기록 보존', [['환자의 데이터 금고(PDV)', '신고·인계 기록이 남습니다(가상).'], ['응급 AI', '사건 ' + c.sc.no + ' 종결 기록과 처치 시작 시각을 보관합니다(가상).']]]])]; }

var STAGES = ['응급 신고', '응급 AI 대응', '출동·준비 지시', '환자 인계'];
var STEPS = [
  { id:'1-1', st:0, title:'기기 호출', desc:'폰·워치·링을 가장 단순하게 조작해요', fn:s11 }, { id:'1-2', st:0, title:'메시지 구성', desc:'말·문자가 되면 함께, 아니면 “응급”만', fn:s12 },
  { id:'1-3', st:0, title:'신상 정보 첨부', desc:'내 비서가 이름·병력·위치 등을 붙여요', fn:s13 }, { id:'1-4', st:0, title:'디지털 서명과 전송', desc:'전체 Form에 서명을 붙여 응급 AI로', fn:s14 },
  { id:'2-1', st:1, title:'접수와 서명 확인', desc:'내용이 바뀌지 않았는지 확인해요', fn:s21 }, { id:'2-2', st:1, title:'신상 정보·사고 내용 정리', desc:'추정을 포함해 한 장으로 정리해요', fn:s22 },
  { id:'2-3', st:1, title:'비서에게 추가 질의', desc:'마지막 식사, 오늘의 운동 등을 물어요', fn:s23 }, { id:'2-4', st:1, title:'자원 취합', desc:'구급대·의료진·장비·자율주행차량을 모아요', fn:s24 },
  { id:'2-5', st:1, title:'최적 조합 결정', desc:'가장 빨리 처치를 시작하는 조합을 골라요', fn:s25 }, { id:'2-6', st:1, title:'응급 대응 계획서', desc:'결정을 Form으로 작성해요', fn:s26 },
  { id:'3-1', st:2, title:'지시서 발송', desc:'구급대·의료진·장비·병원에 동시에', fn:s31 }, { id:'3-2', st:2, title:'구급대 출동과 현장 처치', desc:'신고 위치로 가며 처치 지시를 받아요', fn:s3one('amb', '구급대(119) 출동') },
  { id:'3-3', st:2, title:'의료진·자율주행차량 이동', desc:'필요하면 다른 병원 의료진이 이동해요', fn:s3one('doc', '의료진 이동') }, { id:'3-4', st:2, title:'병원 수용 준비', desc:'장비 예약을 확정하고 대기해요', fn:s3one('fac', '병원 수용 준비') },
  { id:'3-5', st:2, title:'실시간 갱신', desc:'이동 중 상황이 바뀌면 조합을 다시 짜요', fn:s35 },
  { id:'4-1', st:3, title:'도착과 준비 확인', desc:'환자·의료진·장비가 모였는지 확인해요', fn:s41 }, { id:'4-2', st:3, title:'인계 기록 전달', desc:'구급대가 현장 기록을 넘겨요', fn:s42 },
  { id:'4-3', st:3, title:'의료진 인수와 서명', desc:'양쪽이 서명해요', fn:s43 }, { id:'4-4', st:3, title:'처치 시작과 기록 보존', desc:'처치가 시작되고 기록이 남아요', fn:s44 }
];
var PLAN_AT = 10; // 3-1 을 처음 열 때 계획을 확정(스냅샷)한다

// ── 진행 상태 ──
function newCase() { S.sim = { sc:draw(Math.random), reached:0, cur:-1, t:0, plan0:null, ev:null }; S.m = { hosp:newHosp() }; S.wasOpen = false; }
function openStep(i) {
  var sm = S.sim; if (i < 0 || i >= STEPS.length || i > sm.reached) return;
  if (i >= PLAN_AT && !sm.plan0) sm.plan0 = match(sm.sc.need, sm.sc.place, S.m.hosp);
  sm.cur = i; render();
}
function advance() { var sm = S.sim, i = sm.cur + 1; if (i >= STEPS.length) return; sm.reached = Math.max(sm.reached, i); openStep(i); }
function closePanel() { S.sim.cur = -1; render(); }

// ── 화면: 진행 막대 · 단계 목록 · 패널 ──
function progressBar() {
  var sm = S.sim, cur = sm.cur, wrap = h('div', { class:'bar', id:'emg-bar' });
  STAGES.forEach(function (name, si) {
    var ticks = []; STEPS.forEach(function (s, i) { if (s.st !== si) return;
      var cls = 'tick ' + (i < sm.reached ? 'done' : i === sm.reached ? 'next' : 'lock') + (i === cur ? ' cur' : '');
      ticks.push(h('button', { type:'button', class:cls, id:'emg-tick-' + s.id, 'data-i':String(i), 'aria-label':s.id + ' ' + s.title, title:s.id + ' ' + s.title, 'aria-current':i === cur ? 'step' : null, disabled:i > sm.reached ? true : null, onclick:function () { openStep(i); } })); });
    wrap.appendChild(h('div', { class:'bseg' }, [h('div', { class:'bname', text:(si + 1) + '. ' + name }), h('div', { class:'bticks' }, ticks)]));
  });
  return h('div', { class:'barwrap' }, [wrap, h('div', { class:'bcap', id:'emg-bar-cap', text:cur >= 0 ? (cur + 1) + ' / ' + STEPS.length + ' · ' + STEPS[cur].id + ' ' + STEPS[cur].title : '0 / ' + STEPS.length + ' · 1-1 기기 호출부터 눌러 보세요' })]);
}
function summaryCard() {
  var sc = S.sim.sc;
  return h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'무작위 가상 사건' }), h('div', { class:'rowf' }, [pill(sc.devName, 'm'), pill(sc.inc.kind, 'p'), pill(sc.inc.name), pill(sc.placeName)]),
    h('div', { class:'sub', id:'emg-draw-sum', text:'기기·사건·신고자·위치를 무작위로 뽑았어요. 아래 목록에서 단계를 눌러 오른쪽 패널로 결과를 확인하세요.' }),
    h('div', { class:'rowf' }, [h('button', { type:'button', class:'btn quiet', id:'emg-draw', text:'새 사건 뽑기', onclick:function () { newCase(); render(); } }), btn('응급 AI에게 묻기', 'quiet', function () { ask('다른 병원의 의료진과 장비를 어떻게 조합하나요?'); })])]);
}
function stepList() {
  var sm = S.sim, out = h('div', { id:'emg-list', class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'단계 목록 (' + STEPS.length + '단계)' }), h('div', { class:'sub', text:'앞 단계를 연 뒤에 다음 단계를 열 수 있어요. 이미 연 단계는 언제든 다시 볼 수 있습니다.' })]);
  STAGES.forEach(function (name, si) {
    out.appendChild(h('div', { class:'lab', text:(si + 1) + '. ' + name }));
    STEPS.forEach(function (s, i) { if (s.st !== si) return;
      var state = i === sm.cur ? '보는 중' : i < sm.reached ? '완료' : i === sm.reached ? '열기' : '잠김';
      out.appendChild(h('button', { type:'button', class:'srow' + (i === sm.cur ? ' cur' : ''), id:'emg-row-' + s.id, 'data-i':String(i), disabled:i > sm.reached ? true : null, 'aria-current':i === sm.cur ? 'step' : null, onclick:function () { openStep(i); } },
        [h('span', { class:'sid', text:s.id }), h('span', { class:'stx' }, [h('b', { text:s.title }), h('span', { text:s.desc })]), h('span', { class:'sst', text:state })])); });
  });
  return out;
}
function fillPanel(pn) {
  var sm = S.sim, open = sm.cur >= 0, pb0 = $('emg-pbody'), ps = pb0 ? pb0.scrollTop : 0;
  pn.textContent = ''; pn.className = 'panel' + (open ? ' open' : '') + (open && !S.wasOpen ? ' anim' : ''); pn.setAttribute('aria-hidden', String(!open)); M.classList.toggle('pn-open', open); S.wasOpen = open;
  if (!open) return;
  var st = STEPS[sm.cur], c = ctx(), last = sm.cur === STEPS.length - 1;
  pn.appendChild(h('div', { class:'phead' }, [h('div', { style:'flex:1;min-width:0' }, [h('div', { class:'sub', id:'emg-ph-n', text:'단계 ' + (sm.cur + 1) + ' / ' + STEPS.length + ' · ' + STAGES[st.st] }), h('b', { id:'emg-ph-t', style:'font-size:17px', text:st.id + ' ' + st.title })]), h('button', { type:'button', class:'btn quiet sm', id:'emg-pclose', text:'닫기', onclick:closePanel })]));
  var body = h('div', { class:'pbody col', id:'emg-pbody' }, st.fn(c).filter(Boolean)); pn.appendChild(body);
  pn.appendChild(h('div', { class:'pfoot' }, [h('button', { type:'button', class:'btn quiet', id:'emg-prev', text:'◀ 이전', disabled:sm.cur === 0 ? true : null, onclick:function () { openStep(sm.cur - 1); } }),
    last ? h('button', { type:'button', class:'btn fill', id:'emg-again', text:'새 사건으로 다시', onclick:function () { newCase(); render(); try { window.scrollTo(0, 0); } catch (x) {} } }) : h('button', { type:'button', class:'btn fill', id:'emg-nextstep', text:'다음 ▶ ' + STEPS[sm.cur + 1].id + ' ' + STEPS[sm.cur + 1].title, onclick:advance })]));
  body.scrollTop = ps;
}
function render() {
  var root = $('emg-root'), tp = $('emg-top'), pn = $('emg-panel'); if (!root || !tp || !pn) return;
  var y = 0; try { y = window.pageYOffset || 0; } catch (e) {}
  root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = head('응급', '폰·나비웹 워치·링(팔찌) 중 하나를 24시간 가까이 두고, 위급할 때 가장 단순한 조작 한 번으로 부릅니다. 무작위 가상 사건 하나를 신고부터 환자 인계까지 단계별로 따라가 보세요.');
  kids.push(mockNote('모의 체험입니다. 아무것도 전송되지 않고 출동도 일어나지 않아요. 병원·시간은 모두 가상 값입니다.'));
  kids.push(progressBar(), prepSection(), summaryCard(), stepList());
  kids.forEach(function (k) { if (k) root.appendChild(k); });
  fillPanel(pn);
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
  M = el; el.textContent = ''; el.classList.add('emg'); S.share = {}; S.askok = {}; S.dev = []; S.err = {}; S.msg = ''; S.prepOpen = false; newCase(); load();
  [h('div', { id:'emg-top' }), h('div', { class:'wrap', id:'emg-root' }), h('aside', { id:'emg-panel', class:'panel', 'aria-hidden':'true', 'aria-label':'단계 결과' })].forEach(function (x) { el.appendChild(x); });
  if (o.view && ANCH[o.view] && o.view !== 'call') go(o.view); else render();
}
window.NaviEmergency = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M) go(v); },
  callMessage:callMessage, draw:draw, verify:verify, gather:gather, match:match, newHosp:newHosp, planText:planText, devSummary:devSummary, sharedItems:sharedItems,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
