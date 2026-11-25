/* emergency-app.js — 나비웹 응급(인프라 AI · 응급). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviEmergency.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 emergency.css(.emg 범위). 전역은 NaviEmergency 하나만 쓴다.
 *
 * 응급 AI 설계 원칙(주피터 지시, 2026-11-25):
 *  1. 모든 개인은 폰·나비웹 워치·링(팔찌) 중 적어도 하나를 24시간 가까이 둔다.
 *  2. 응급은 이 기기를 가장 단순한 조작으로 호출하고, 응급 메시지가 관련 기관(응급 AI)에 전송된다.
 *     말을 하거나 문자를 입력할 수 있으면 음성 또는 문자를 보내고, 그 밖에는 오직 '응급' 메시지만 전달한다.
 *  3. 신고자의 '나만의 AI 비서'가 위치·나이·성명·병력·생체 정보 등을 응급 AI에 보내고, 응급 AI는 그 비서에게 추가로 물을 수 있다
 *     (예: 마지막으로 먹은 음식, 오늘 격한 운동을 했는지).
 *  4. 응급 AI는 신고자의 현재 위치에서 최단 시간 안에 도착할 수 있는 응급 대응 인원·장비를 정해 출동을 지시하고,
 *     출동 인원·장비는 응급 AI에서 실시간 데이터와 현장 처치·이송 목적지 지시를 받는다.
 *  5. 핵심: 전국 병·의원·보건소의 위치, 의료진 전공·자격, 보유 장비, 인력별 일정, 장비별 가동·예약 상태를 실시간으로 파악·갱신하고,
 *     응급 환자가 생기면 최적의 처치 인력과 장비를 실시간으로 조합한다(A 병원 B 의료진이 C 병원 장비로 처치하도록 일정을 짜고 자율주행차량을 A 병원에 급파).
 *
 * 무엇이 실제이고 무엇이 아닌가(화면에도 한 줄로 적는다):
 *  - 위 원칙은 설계 단계이고 이 화면은 모의 체험이다. 기기·병원·출동 시스템에 연결되어 있지 않고 어떤 것도 전송하지 않는다.
 *  - '자원 조합'의 병원·인력·장비·위치·이동 시간은 모두 가상 값이며 메모리 안에서만 계산한다(저장하지 않는다).
 *  - 내 기기·보내는 정보는 사용자가 직접 정하는 기록이고 이 브라우저(localStorage)에만 저장된다.
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
var TABS = [['call', '응급 호출'], ['follow', '한 사건 따라가기'], ['match', '자원 조합'], ['prep', '내 준비']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var ALIAS = { flow:'follow', devices:'prep', consent:'prep' };
var DEVICES = [['phone', '폰'], ['watch', '나비웹 워치'], ['ring', '링(팔찌)']];
var DEVKINDS = DEVICES.map(function (d) { return d[1]; });
/** 내 비서가 응급 AI에 보내는 정보. 위치는 구조에 꼭 필요해 항상 포함하고, 나머지는 항목마다 직접 정한다. */
var SEND = [['loc', '현재 위치'], ['name', '성명'], ['age', '나이'], ['hist', '병력(과거 질병)'], ['meds', '복용 약·알레르기'], ['blood', '혈액형'], ['vitals', '생체 정보(심박 등)'], ['kin', '비상 연락처']];
/** 응급 AI가 내 비서에게 추가로 물을 수 있는 것(예시). 항목마다 답해도 되는지 직접 정한다. */
var ASKS = [['meal', '마지막으로 먹은 음식'], ['exercise', '오늘 격한 운동을 했는지']];
var CALLS = [['voice', '말할 수 있음'], ['text', '문자를 입력할 수 있음'], ['none', '둘 다 어려움']];
var M = null, LS = {};
var S = { view:'call', share:{}, askok:{}, dev:[], form:{ kind:'폰', carry:true }, err:{}, msg:'',
  call:{ dev:'phone', can:'voice', say:'', fired:false }, m:null };

function field(id, label, val, o) {
  o = o || {}; var e = o.err, inp = h('input', { id:id, type:'text', value:val == null ? '' : val, placeholder:o.ph || '', maxlength:o.max || '60', inputmode:o.mode || '', autocomplete:'off', 'aria-invalid':e ? 'true' : 'false' });
  inp.oninput = function () { if (o.set) o.set(inp.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), inp, h('div', { id:id + '-h', class:e ? 'err' : 'help', text:e || o.help || '' })]);
}
function empty(t, b) { return h('div', { class:'card', style:'margin-top:16px' }, [h('div', { class:'empty', text:t }), b ? h('div', { class:'rowf', style:'justify-content:center' }, [b]) : null]); }
function head(title, lead) { return [h('h1', { text:title }), lead ? h('p', { class:'lead', text:lead }) : null]; }
function go(v) { S.view = v; S.err = {}; S.msg = ''; render(); try { M.scrollIntoView({ block:'start' }); } catch (e) {} }
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

function topbar() {
  return h('div', { class:'topin' }, [
    h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 응급' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}

// ── 응급 호출 ──
function viewCall() {
  var c = S.call, kids = head('응급 호출', '폰·나비웹 워치·링(팔찌) 중 하나를 24시간 가까이 두고, 위급할 때 가장 단순한 조작 한 번으로 부릅니다.');
  kids.push(mockNote('모의 체험입니다. 아무것도 전송되지 않고 출동도 일어나지 않아요.'));
  var dn = DEVICES.filter(function (d) { return d[0] === c.dev; })[0][1], msg = callMessage(c.can, c.say);
  var form = h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'상황 고르기' }),
    h('div', { class:'lab', text:'호출하는 기기' }), seg('기기', DEVICES, c.dev, function (v) { c.dev = v; c.fired = false; render(); }),
    h('div', { class:'lab', text:'지금 내 상태' }), seg('상태', CALLS, c.can, function (v) { c.can = v; c.fired = false; render(); }),
    c.can === 'none' ? h('div', { class:'sub', id:'emg-c-none', text:'말을 하거나 문자를 입력하기 어려우면 오직 “응급” 메시지만 전달돼요.' }) : field('emg-say', c.can === 'voice' ? '말한 내용(가상)' : '입력한 문자(가상)', c.say, { ph:'예: 가슴이 너무 아파요', max:120, set:function (v) { c.say = v; } }),
    h('div', { class:'rowf', style:'margin-top:16px' }, [h('button', { type:'button', class:'btn fill', id:'emg-fire', text:dn + '로 응급 호출 (모의)', onclick:function () { c.fired = true; render(); } }), c.fired ? btn('처음으로', 'quiet', function () { c.fired = false; c.say = ''; render(); }) : null])]);
  var out = h('div', { class:'col', id:'emg-c-out', style:'gap:16px' });
  if (!c.fired) out.appendChild(h('div', { class:'card' }, [h('div', { class:'empty', text:'기기와 상태를 고르고 호출해 보면 무엇이 전달되는지 보여 줘요.' })]));
  else {
    out.appendChild(h('div', { class:'card col' }, [h('b', { text:'1. 기기에서 전송된 응급 메시지' }),
      h('div', { class:'kv' }, [h('span', { text:'보낸 기기' }), h('b', { text:dn })]), h('div', { class:'kv' }, [h('span', { text:'받는 곳' }), h('b', { text:'관련 기관(응급 AI)' })]),
      h('div', { class:'kv' }, [h('span', { text:'전달 형태' }), h('b', { id:'emg-c-mode', text:msg.label })]), msg.body ? h('div', { class:'kv' }, [h('span', { text:'내용' }), h('b', { id:'emg-c-body', text:msg.body })]) : null,
      h('div', { class:'sub', id:'emg-c-flag', text:msg.only ? '오직 “응급” 메시지만 전달됐어요.' : '“응급” 표시와 함께 ' + (msg.mode === 'voice' ? '음성' : '문자') + '이(가) 전달됐어요.' })]));
    var sh = sharedItems(S.share), ak = askItems(S.askok);
    out.appendChild(h('div', { class:'card col' }, [h('b', { text:'2. 내 AI 비서가 응급 AI에 보내는 정보' }), h('div', { class:'kv' }, [h('span', { text:'보내는 정보' }), h('b', { id:'emg-c-send', text:sh.join(', ') })]),
      h('div', { class:'kv' }, [h('span', { text:'응급 AI가 추가로 물어도 되는 것' }), h('b', { id:'emg-c-ask', text:ak.join(', ') || '없음' })]), h('div', { class:'sub', text:'보내는 정보는 “보내는 정보” 탭에서 항목마다 정해요.' })]));
    out.appendChild(h('div', { class:'card col' }, [h('b', { text:'3. 이어지는 일' }), h('div', { class:'sub', text:'신고 위치에서 가장 빨리 닿는 구급 인원·장비에 출동이 지시되고, 처치할 병원의 인력·장비가 조합됩니다.' }), h('div', { class:'rowf' }, [btn('한 사건 따라가기', 'quiet', function () { go('follow'); }), btn('자원 조합 해 보기', 'fill', function () { go('match'); })])]));
  }
  kids.push(h('div', { class:'g2', style:'margin-top:16px;align-items:start' }, [form, out]));
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('응급 AI에게 묻기', 'quiet', function () { ask('응급 호출을 하면 무엇이 전달되나요?'); })]));
  return kids;
}

// ── 한 사건 따라가기 ──
var CASES = [
  { id:'s1', name:'말할 수 있어요', who:'아버지가 집에서 갑자기 가슴을 움켜쥐고 쓰러졌어요.', dev:'phone', can:'voice', say:'가슴이 너무 아파요', need:'ami', place:'p2' },
  { id:'s2', name:'말을 못 해요', who:'할머니가 말이 나오지 않고 한쪽 팔에 힘이 풀렸어요.', dev:'ring', can:'none', say:'', need:'stroke', place:'p3' },
  { id:'s3', name:'전문의와 장비가 다른 병원에 있어요', who:'동생이 운동 중에 갑자기 숨쉬기 힘들다며 주저앉았어요.', dev:'watch', can:'text', say:'숨이 안 쉬어져요', need:'ami', place:'p1' }
];
function scenes(c, hosp) {
  var dn = DEVICES.filter(function (d) { return d[0] === c.dev; })[0][1], msg = callMessage(c.can, c.say), r = match(c.need, c.place, hosp), b = r.best;
  var sh = sharedItems(S.share), ak = askItems(S.askok), hasMap = !!b;
  var L = [
    { t:'호출', now:dn + '을(를) 가장 단순하게 조작했습니다. ' + (msg.only ? '말도 문자도 어려워서 “응급”만 전달됩니다.' : (msg.mode === 'voice' ? '말한 내용이 음성으로' : '입력한 문자가') + ' “응급” 표시와 함께 전달됩니다.'),
      got:[['응급 AI', msg.only ? '“응급” 메시지' : '“응급” + ' + (msg.body || msg.label)]] },
    { t:'내 AI 비서가 정보를 보냄', now:'신고자의 나만의 AI 비서가 위치·나이·성명·병력·생체 정보 같은 데이터를 응급 AI에 보냅니다.', got:[['응급 AI', sh.join(', ')], ['안내', '“내 준비” 탭에서 정한 항목만 보냅니다. 현재 위치는 항상 포함']] },
    { t:'응급 AI가 더 물음', now:'응급 AI가 신고자의 비서에게 처치에 필요한 것을 더 묻습니다.', got:[['응급 AI → 비서', '“마지막으로 먹은 음식은?” “오늘 격한 운동을 했나요?”'], ['비서의 답', ak.length ? ak.join(', ') + '에 답함' : '허용한 질문이 없어 답하지 않음']] },
    { t:'가장 빠른 출동', now:b ? '신고 위치(' + r.place[1] + ')에서 가장 빨리 닿는 ' + r.amb.name + '에 출동을 지시합니다(' + r.amb.eta + '분).' : '출동 가능한 구급대를 찾습니다.', got:[['구급대', '출동 지시와 실시간 데이터'], ['응급 AI', '현장 처치와 이송 목적지를 구급대에 계속 알림']], map:hasMap },
    { t:'병·의원 인력·장비 확인', now:'응급 AI는 병·의원의 전문의 근무, 장비 가동, 예약 상태를 실시간으로 갖고 있습니다. 필요한 것은 ' + r.need.sp + ' 전문의와 ' + r.need.eq + '입니다.', got:[['병·의원 현황', r.need.sp + ' 전문의와 ' + r.need.eq + '의 상태를 비교']], map:hasMap },
    { t:'최적 조합 결정', now:b ? (b.kind === 'single' ? b.fac.name + '에 전문의와 장비가 모두 있어 그곳으로 이송합니다.' : b.doc.name + '의 의료진이 ' + b.fac.name + '의 장비로 처치하도록 일정을 짜고, 자율주행차량을 ' + b.doc.name + '에 급파합니다.') : '지금은 조합할 인력·장비가 없습니다.', got:b ? [['환자', b.fac.name + '로 이송(' + b.tPatient + '분)']].concat(b.kind === 'split' ? [['의료진', b.doc.name + ' → ' + b.fac.name + '(' + b.tDoc + '분)']] : []) : [], map:hasMap },
    { t:'처치 시작', now:b ? '약 ' + b.start + '분 뒤 ' + b.fac.name + '에서 처치가 시작됩니다.' : '조합이 가능해지면 다시 계산합니다.', got:b ? [['결과', '처치 시작 약 ' + b.start + '분 뒤']] : [], map:hasMap }
  ];
  return { list:L, r:r };
}
function viewFollow() {
  var f = S.f || (S.f = { sc:'s1', i:0 }), c = CASES.filter(function (x) { return x.id === f.sc; })[0] || CASES[0];
  var d = scenes(c, S.m ? S.m.hosp : newHosp()), L = d.list, i = Math.max(0, Math.min(f.i, L.length - 1)), sc = L[i];
  var kids = head('한 사건 따라가기', '가상 사건 하나를 처음부터 끝까지 따라가며, 누가 무엇을 받는지 봅니다.');
  kids.push(mockNote('모의 체험입니다. 병원·시간은 가상 값이고 아무것도 전송되지 않아요.'));
  kids.push(h('div', { class:'card col' }, [h('div', { class:'lab', text:'사건 고르기' }), seg('사건', CASES.map(function (x) { return [x.id, x.name]; }), f.sc, function (v) { f.sc = v; f.i = 0; render(); }), h('div', { class:'sub', id:'emg-f-who', text:c.who })]));
  kids.push(h('div', { class:'card col hero', style:'margin-top:16px' }, [
    h('div', { class:'sub', id:'emg-f-step', text:(i + 1) + ' / ' + L.length + ' · ' + sc.t }),
    h('div', { class:'big', id:'emg-f-now', style:'font-size:18px', text:sc.now }),
    sc.got.length ? h('div', { id:'emg-f-got' }, sc.got.map(function (g) { return h('div', { class:'kv' }, [h('span', { text:g[0] }), h('b', { text:g[1] })]); })) : null,
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('이전', 'quiet', function () { f.i = Math.max(0, i - 1); render(); }), i < L.length - 1 ? btn('다음', 'fill', function () { f.i = i + 1; render(); }) : btn('처음으로', 'quiet', function () { f.i = 0; render(); })])]));
  if (sc.map) kids.push(h('div', { style:'margin-top:16px', id:'emg-f-map' }, [mapSvg(d.r, S.m ? S.m.hosp : newHosp())]));
  if (i === L.length - 1) kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { text:'이제 내 설정으로 해 보세요' }), h('div', { class:'rowf' }, [btn('응급 호출 해 보기', 'fill', function () { go('call'); }), btn('자원 조합 해 보기', 'quiet', function () { go('match'); }), btn('내 준비 보기', 'quiet', function () { go('prep'); })])]));
  return kids;
}

// ── 자원 조합 ──
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
function viewMatch() {
  var m = S.m || (S.m = { need:'ami', place:'p1', hosp:newHosp() });
  var kids = head('자원 조합', '신고 위치에서 가장 빨리 처치를 시작할 수 있는 인력·장비·병원을 실시간으로 조합합니다. 아래 병원·인력·장비는 모두 가상이에요.');
  kids.push(mockNote('가상 값으로 계산합니다. 인력의 근무와 장비의 사용 상태를 바꾸면 결과가 바로 달라져요(저장하지 않습니다).'));
  var r = match(m.need, m.place, m.hosp);
  kids.push(h('div', { class:'card col' }, [h('div', { class:'frm' }, [sel('emg-m-need', '응급 환자', m.need, Object.keys(NEEDS).map(function (k) { return [k, NEEDS[k].name]; }), function (v) { m.need = v; render(); }), sel('emg-m-place', '신고 위치', m.place, PLACES.map(function (p) { return [p[0], p[1]]; }), function (v) { m.place = v; render(); })]),
    h('div', { class:'sub', text:'필요한 것: ' + r.need.sp + ' 전문의 + ' + r.need.eq })]));
  var b = r.best, res = h('div', { class:'card col hero', id:'emg-m-res', style:'margin-top:16px' });
  if (!b) { res.appendChild(h('div', { class:'big', text:'지금은 조합할 수 있는 인력·장비가 없어요' })); res.appendChild(h('div', { class:'sub', text:'가장 가까운 병원에서 상태를 안정시키며, 다른 병원의 인력·장비가 비는 대로 다시 조합합니다(연습).' })); }
  else { res.appendChild(h('div', { class:'big', id:'emg-m-start', text:'처치 시작 약 ' + b.start + '분 뒤 · ' + b.fac.name })); res.appendChild(h('div', { class:'sub', id:'emg-m-kind', text:b.kind === 'single' ? '한 병원에서 전문의와 장비를 모두 쓸 수 있어요.' : '전문의와 장비가 다른 병원에 있어 ' + b.doc.name + ' 의료진이 ' + b.fac.name + ' 장비로 처치하도록 조합했어요.' })); }
  kids.push(res);
  if (b) kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { text:'결정된 대응' }), h('div', {}, planText(r).map(function (x, i) { return h('div', { class:'stp', 'data-s':String(i) }, [h('i', { text:String(i + 1) }), h('div', {}, [h('span', { text:x })])]); }))]));
  var rows = r.options.slice(0, 5).map(function (o, i) { return h('tr', {}, [h('td', {}, [pill(o.kind === 'single' ? '한 병원' : '인력 이동', o.kind === 'single' ? 'm' : 'p')]), h('td', { text:o.fac.name }), h('td', { text:o.kind === 'single' ? '—' : o.doc.name }), h('td', { class:'r num', text:o.tPatient + '분' }), h('td', { class:'r num', text:o.kind === 'single' ? '—' : o.tDoc + '분' }), h('td', { class:'r num', text:(i === 0 ? '★ ' : '') + o.start + '분' })]); });
  kids.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { style:'padding:14px 16px 0' }, [h('b', { text:'가능한 조합(빠른 순)' })]), rows.length ? h('div', { class:'tbw' }, [h('table', { class:'tbl', id:'emg-m-opts' }, [h('thead', {}, [h('tr', {}, ['방식', '처치 장소', '전문의 출발', '환자 도착', '전문의 도착', '시작'].slice(0, 6).map(function (t, i) { return h('th', { class:i > 2 ? 'r' : '', text:t }); }))]), h('tbody', {}, rows)])]) : h('div', { class:'empty', text:'가능한 조합이 없어요.' })]));
  kids.push(h('div', { style:'margin-top:16px' }, [mapSvg(r, m.hosp), h('div', { class:'sub', text:'빨간 점이 신고 위치, 삼각형이 구급대(파란색이 출동), 네모가 병원이에요. 파란 선은 환자 이송, 초록 점선은 전문의 이동입니다.' })]));
  var tb = h('table', { class:'tbl', id:'emg-m-res-tbl' }, [h('thead', {}, [h('tr', {}, ['병원', '전문의(근무)', '장비(사용 가능)'].map(function (t) { return h('th', { text:t }); }))]),
    h('tbody', {}, m.hosp.map(function (F) {
      var docs = Object.keys(F.docs).map(function (k) { return h('button', { type:'button', class:'chip', 'data-doc':F.id + ':' + k, 'aria-pressed':String(F.docs[k]), text:k + (F.docs[k] ? ' 근무' : ' 비번'), onclick:function () { F.docs[k] = !F.docs[k]; render(); } }); });
      var eqs = Object.keys(F.eq).map(function (k) { return h('button', { type:'button', class:'chip', 'data-eq':F.id + ':' + k, 'aria-pressed':String(F.eq[k]), text:k + (F.eq[k] ? ' 가능' : ' 사용 중'), onclick:function () { F.eq[k] = !F.eq[k]; render(); } }); });
      return h('tr', {}, [h('td', {}, [h('b', { text:F.name })]), h('td', {}, [h('div', { class:'chips' }, docs.length ? docs : [h('span', { class:'sub', text:'전문의 없음' })])]), h('td', {}, [h('div', { class:'chips' }, eqs.length ? eqs : [h('span', { class:'sub', text:'장비 없음' })])])]);
    }))]);
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { text:'병·의원 인력·장비 현황(실시간 갱신 연습)' }), h('div', { class:'sub', text:'버튼을 눌러 전문의가 퇴근하거나 장비가 사용 중이 된 상황을 만들어 보세요.' }), h('div', { class:'tbw' }, [tb]), h('div', { class:'rowf' }, [btn('처음 상태로', 'quiet', function () { m.hosp = newHosp(); render(); })])]));
  var seen = {}, why = r.why.filter(function (w) { var k = w[0] + w[1]; if (seen[k]) return false; seen[k] = 1; return true; });
  if (why.length) kids.push(h('div', { class:'card col', style:'margin-top:16px', id:'emg-m-why' }, [h('b', { text:'조합에서 빠진 이유' }), h('div', {}, why.map(function (w) { return h('div', { class:'kv' }, [h('span', { text:w[0] }), h('b', { text:w[1] })]); }))]));
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('응급 AI에게 묻기', 'quiet', function () { ask('다른 병원의 의료진과 장비를 어떻게 조합하나요?'); })]));
  return kids;
}

// ── 내 기기 ──
function addDev() {
  var f = S.form, e = {}, name = clean(f.name, 40);
  if (!name) e.name = '기기 이름을 적어 주세요.';
  if (f.chk && !/^\d{4}-\d{2}-\d{2}$/.test(f.chk)) e.chk = '점검일은 2026-11-23 모양으로 적어 주세요.';
  if (S.dev.length >= MAXD) e.name = '기록은 최대 ' + MAXD + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  S.dev.push({ id:uid(), kind:DEVKINDS.indexOf(f.kind) >= 0 ? f.kind : '폰', name:name, carry:f.carry !== false, chk:f.chk || '' }); S.form = { kind:f.kind, carry:true }; S.msg = '기록했어요.'; save(); render();
}
function viewDevices() {
  var kids = head('내 기기', '폰·나비웹 워치·링(팔찌) 중 적어도 하나를 24시간 가까이 두어야 응급 호출이 가능합니다. 내가 쓰는 기기를 적어 두세요.');
  var m = devSummary(S.dev, kst());
  kids.push(h('div', { class:'g4' }, [tile('등록한 기기', m.count + '개', '', 'emg-d0'), tile('24시간 가까이 두는 기기', m.carry + '개', m.carry ? '' : '하나 이상 필요해요', 'emg-d2'), tile('점검일 지남·오늘', m.due + '개', '', 'emg-d1')]));
  var f = S.form, e = S.err;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'기기 적기' }), h('div', { class:'sub', text:'직접 적는 기록입니다. 기기가 나비웹에 연결되는 기능은 아직 없어요.' }),
    h('div', { class:'frm' }, [sel('emg-dk', '종류', f.kind, DEVKINDS.map(function (k) { return [k, k]; }), function (v) { f.kind = v; }), field('emg-dn', '기기 이름', f.name, { err:e.name, ph:'예: 내 폰', max:40, set:function (v) { f.name = v; } }), field('emg-dc', '다음 점검·충전일(선택)', f.chk, { err:e.chk, ph:'2027-01-31', mode:'numeric', max:10, set:function (v) { f.chk = v.trim(); } })]),
    h('label', { class:'chk', for:'emg-dcarry' }, [(function () { var c = h('input', { type:'checkbox', id:'emg-dcarry', checked:f.carry !== false ? true : false }); c.onchange = function () { f.carry = c.checked; }; return c; })(), h('span', { text:'24시간 가까이 둡니다' })]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('기록하기', 'fill', addDev), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  if (!S.dev.length) { kids.push(empty('아직 등록한 기기가 없어요.')); return kids; }
  kids.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['종류', '이름', '24시간', '점검일', ''].map(function (t) { return h('th', { text:t }); }))]),
    h('tbody', {}, S.dev.map(function (x) { return h('tr', {}, [h('td', {}, [pill(x.kind)]), h('td', {}, [h('b', { text:x.name })]), h('td', { text:x.carry ? '예' : '아니요' }), h('td', { class:'num', text:x.chk || '—' }), h('td', { class:'r' }, [btn('삭제', 'sm quiet', function () { S.dev = S.dev.filter(function (y) { return y.id !== x.id; }); S.msg = '삭제했어요.'; save(); render(); })])]); }))])])]));
  return kids;
}

// ── 보내는 정보 ──
function viewConsent() {
  var kids = head('보내는 정보', '응급 호출이 되면 내 AI 비서가 응급 AI에 보낼 정보와, 응급 AI가 추가로 물어도 되는 것을 항목마다 직접 정합니다.');
  kids.push(h('div', { class:'note info', style:'margin:16px 0', text:'현재 위치는 구조에 꼭 필요해 항상 포함됩니다. 고른 상태는 이 브라우저에만 저장되고, 응급 호출 화면의 연습이 이 선택을 따릅니다.' }));
  var n = h('span', { class:'sub', id:'emg-c-n' }), n2 = h('span', { class:'sub', id:'emg-a-n' });
  function tally() { n.textContent = '보내기로 고른 항목 ' + Object.keys(S.share).length + ' / ' + (SEND.length - 1) + ' (현재 위치 제외)'; n2.textContent = '답해도 되는 질문 ' + Object.keys(S.askok).length + ' / ' + ASKS.length; }
  function list(items, store, pre, fixedKey) {
    return h('div', {}, items.map(function (f) { var id = pre + f[0], cb = h('input', { type:'checkbox', id:id, checked:f[0] === fixedKey || store[f[0]] ? true : false, disabled:f[0] === fixedKey ? true : null });
      cb.onchange = function () { if (cb.checked) store[f[0]] = 1; else delete store[f[0]]; save(); tally(); }; return h('label', { class:'chk', for:id }, [cb, h('span', { text:f[1] + (f[0] === fixedKey ? ' (항상 포함)' : '') })]); }));
  }
  kids.push(h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'내 비서가 응급 AI에 보낼 정보' }), n, list(SEND, S.share, 'emg-sh-', 'loc'), h('div', { class:'rowf' }, [btn('모두 해제', 'quiet', function () { S.share = {}; save(); render(); })])]));
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'응급 AI가 내 비서에게 추가로 물어도 되는 것' }), n2, list(ASKS, S.askok, 'emg-ak-', null), h('div', { class:'sub', text:'예시입니다. 내 비서는 허용한 질문에만 내 기록을 바탕으로 답해요.' })]));
  tally();
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('응급 AI에게 묻기', 'quiet', function () { ask('응급 상황에서 내 정보는 누구에게 전달되나요?'); })]));
  return kids;
}

function viewPrep() {
  var a = viewDevices(), b = viewConsent(), kids = head('내 준비', '응급 호출이 되려면 기기를 24시간 가까이 두어야 하고, 비서가 응급 AI에 무엇을 보낼지 미리 정해 둡니다.');
  var rm = function (k) { return k && k.tagName !== 'H1' && !(k.className === 'lead'); };
  return kids.concat(a.slice(2).filter(rm), [h('div', { style:'height:8px' })], b.slice(2).filter(rm));
}
function render() {
  var root = $('emg-root'), tp = $('emg-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = S.view === 'follow' ? viewFollow() : S.view === 'match' ? viewMatch() : S.view === 'prep' ? viewPrep() : viewCall();
  kids.forEach(function (k) { if (k) root.appendChild(k); });
}
function reply(ok, msg) { emit('result', { ok:ok, msg:msg, view:S.view }); }
function nav(a) {
  var d = a && typeof a['do'] === 'string' ? a['do'] : ''; d = ALIAS[d] || d;
  if (VIEWS.indexOf(d) >= 0) { go(d); return reply(true, TABS[VIEWS.indexOf(d)][1] + ' 화면으로 이동했습니다.'); }
  return reply(false, '지원하지 않는 요청입니다.');
}
function mount(el, o) {
  if (!el) return; o = o || {};
  M = el; el.textContent = ''; el.classList.add('emg'); S.share = {}; S.askok = {}; S.dev = []; S.err = {}; S.msg = ''; S.call = { dev:'phone', can:'voice', say:'', fired:false }; S.m = null; S.f = null; load();
  [h('div', { id:'emg-top' }), h('div', { class:'wrap', id:'emg-root' })].forEach(function (x) { el.appendChild(x); });
  var ov = ALIAS[o.view] || o.view; S.view = VIEWS.indexOf(ov) >= 0 ? ov : 'call'; render();
}
window.NaviEmergency = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { v = ALIAS[v] || v; if (M && VIEWS.indexOf(v) >= 0) go(v); },
  callMessage:callMessage, match:match, newHosp:newHosp, planText:planText, devSummary:devSummary, sharedItems:sharedItems,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
