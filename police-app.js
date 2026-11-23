/* police-app.js — 나비웹 치안(인프라 AI · 치안). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviPolice.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 police.css(.pol 범위). 전역은 NaviPolice 하나만 쓴다.
 *
 * 치안 화면의 특징(주피터 지시, 설계 원칙): 사용자가 폰이나 스마트워치 등으로 위급 상황을 문자·음성으로 신고하면, 치안 인프라가 즉시 주변 센서(CCTV)를 직접 제어해 상황을 파악하고,
 *  주변의 차량과 인원(나비웹이 설치된 폰의 위치, 통신 기록 등)을 파악해 범죄자를 특정한다. 그 신상 정보를 인근 경찰서·파출소에 전송하고, 한 명 이상의 인원(인근 치안 기관에서 근무 중인 경찰 인력 등)과
 *  장비(자율주행 치안 차량)에 출동을 지시한다.
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 위 원칙은 아직 설계 단계다. 지금은 CCTV 제어·주변 파악·범죄자 특정·경찰 전송·출동 지시가 연결되어 있지 않고, 이 화면은 112나 경찰에 아무것도 보내지 않는다. 실제 위급 상황은 112(응급은 119)에 직접 연락해야 한다.
 *  - 개인의 위치·통신 기록을 쓰는 단계는 법적 근거와 감독 절차가 정해져야 하는 부분이라, 이 화면은 그 기능을 제공하지 않고 순서만 설명한다(화면에도 적는다).
 *  - '신고'는 사용자가 신고 내용을 정리해 직접 112에 말하거나 문자로 보낼 수 있게 돕는 것이다. '대응 시뮬레이션'은 가정값으로 출동 배정을 연습하는 용도이며 실제 사람을 특정하지 않는다.
 *  - 신고 기록·공개 범위는 사용자가 직접 적는 기록이고 이 브라우저(localStorage)에만 저장된다.
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
var KEY = 'navi-pol-v1', MAXR = 100;
var TABS = [['report', '신고'], ['principle', '대응 원리'], ['sim', '대응 시뮬레이션'], ['log', '내 신고 기록'], ['consent', '공개 범위']];
var VIEWS = TABS.map(function (t) { return t[0]; });
/** 신고 유형: 즉시 출동이 필요한 정도(예시)에 따라 보내는 인원 수의 기본값을 둔다. */
var KINDS = { '폭행·위협':{ need:2, urgent:true }, '도난·절도':{ need:1, urgent:false }, '스토킹·추행':{ need:1, urgent:true }, '교통사고·뺑소니':{ need:2, urgent:true }, '수상한 사람·행동':{ need:1, urgent:false }, '기타':{ need:1, urgent:false } };
var KIND_KEYS = Object.keys(KINDS);
var STATES = ['작성 중', '112에 연락함', '처리 중', '처리 완료'];
/** 신고할 때 함께 보낼 수 있는 내 정보(예시). 위치는 출동에 꼭 필요해 항상 포함. */
var SEND = [['loc', '현재 위치'], ['name', '이름'], ['phone', '연락처'], ['photo', '찍은 사진·영상'], ['voice', '음성 녹음']];
var STEPS = [['위급 상황을 신고합니다', '사용자가 폰이나 스마트워치 등으로 위급 상황을 문자나 음성으로 신고합니다.'], ['주변 센서를 직접 제어합니다', '치안 인프라가 신고 위치 주변의 CCTV 등 센서를 즉시 직접 제어해 상황을 파악합니다.'], ['주변 차량과 인원을 파악합니다', '나비웹이 설치된 폰의 위치, 통신 기록 등으로 주변의 차량과 인원을 파악하고 범죄자를 특정합니다.'], ['인근 경찰서·파출소에 전송합니다', '특정한 범죄자의 신상 정보를 인근 경찰서나 파출소 등에 전송합니다.'], ['인력과 장비에 출동을 지시합니다', '한 명 이상의 인원(인근 치안 기관에서 현재 근무 중인 경찰 인력 등)과 장비(자율주행 치안 차량)에 출동을 지시합니다.']];
var M = null, LS = {};
var S = { view:'report', rep:{ kind:'폭행·위협' }, log:[], share:{}, sim:{ kind:'폭행·위협', cctv:'6', off:'3', car:'1', need:'' }, err:{}, msg:'' };

function field(id, label, val, o) {
  o = o || {}; var e = o.err, inp = h('input', { id:id, type:'text', value:val == null ? '' : val, placeholder:o.ph || '', maxlength:o.max || '60', inputmode:o.mode || '', autocomplete:'off', 'aria-invalid':e ? 'true' : 'false' });
  inp.oninput = function () { if (o.set) o.set(inp.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), inp, h('div', { id:id + '-h', class:e ? 'err' : 'help', text:e || o.help || '' })]);
}

function empty(t, b) { return h('div', { class:'card', style:'margin-top:16px' }, [h('div', { class:'empty', text:t }), b ? h('div', { class:'rowf', style:'justify-content:center' }, [b]) : null]); }

function head(title, lead) { return [h('h1', { text:title }), lead ? h('p', { class:'lead', text:lead }) : null]; }
function go(v) { S.view = v; S.err = {}; S.msg = ''; render(); try { M.scrollIntoView({ block:'start' }); } catch (e) {} }
function load() {
  try {
    var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v || typeof v !== 'object') return;
    S.log = (Array.isArray(v.log) ? v.log : []).map(fixLog).filter(Boolean).slice(0, MAXR);
    if (v.share && typeof v.share === 'object') SEND.forEach(function (f) { if (v.share[f[0]]) S.share[f[0]] = 1; });
  } catch (e) {}
}
function fixLog(x) {
  if (!x || typeof x !== 'object') return null;
  if (!KINDS[x.kind] || STATES.indexOf(x.state) < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(x.d)) return null;
  var place = clean(x.place, 60), desc = clean(x.desc, 300); if (!place || !desc) return null;
  return { id:clean(x.id, 20) || uid(), d:x.d, kind:x.kind, place:place, desc:desc, who:clean(x.who, 80), car:clean(x.car, 20), state:x.state, no:clean(x.no, 30) };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ log:S.log, share:S.share })); } catch (e) {} }

/** 112에 말하거나 문자로 보낼 신고 문장. 유형·장소·상황이 없으면 null. */
function reportText(f) {
  var kind = KINDS[f.kind] ? f.kind : '', place = clean(f.place, 60), desc = clean(f.desc, 300); if (!kind || !place || !desc) return null;
  var lines = ['[신고] ' + kind, '장소: ' + place, '상황: ' + desc]; if (clean(f.when, 20)) lines.push('시각: ' + clean(f.when, 20));
  if (clean(f.who, 80)) lines.push('상대 인상착의: ' + clean(f.who, 80)); if (clean(f.car, 20)) lines.push('차량: ' + clean(f.car, 20));
  return lines.join('\n');
}
/**
 * 출동 배정 연습(가정값): 필요 인원 need(없으면 유형 기본값)를 근무 중인 인원 off 안에서 배정하고, 자율주행 치안 차량 car 대 중 필요한 만큼 배정한다.
 * 인원이 모자라면 shortage 를 알리고 가까운 다른 기관으로 넓힌다. 사람을 특정하거나 개인 정보를 쓰지 않는다.
 */
function dispatch(s) {
  var k = KINDS[s.kind]; if (!k) return null;
  var cctv = numOf(s.cctv), off = numOf(s.off), car = numOf(s.car), need = s.need === '' || s.need == null ? k.need : numOf(s.need);
  if (![cctv, off, car, need].every(isFinite) || cctv < 0 || off < 0 || car < 0 || need < 1 || [cctv, off, car, need].some(function (x) { return x > 1000 || Math.floor(x) !== x; })) return null;
  var send = Math.min(need, off), cars = Math.min(Math.ceil(send / 2), car);
  return { need:need, send:send, shortage:need - send, cars:cars, cctv:cctv, urgent:k.urgent, widen:send < need };
}

function topbar() {
  return h('div', { class:'topin' }, [
    h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 치안' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function warn() {
  return h('div', { class:'note', role:'alert', style:'margin:16px 0', id:'pol-warn' }, [h('b', { text:'지금 위험하다면 112에 먼저 연락하세요(응급은 119). ' }), '이 화면은 CCTV·경찰·출동에 연결되어 있지 않아 신고를 대신 접수하거나 출동을 부르지 않습니다.']);
}
function tile(k, v, s, id) { return h('div', { class:'tile' }, [h('div', { class:'k', text:k }), h('div', { class:'num', id:id, style:'font-size:20px;font-weight:700', text:v }), s ? h('div', { class:'sub', text:s }) : null]); }
function sel(id, label, val, opts, set) {
  var s = h('select', { id:id, 'aria-label':label }, opts.map(function (c) { return h('option', { value:c[0], text:c[1] }); })); s.value = val; s.onchange = function () { set(s.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), s, h('div', { class:'help', text:'' })]);
}

// ── 신고 ──
function saveReport() {
  var f = S.rep, e = {}, t = reportText(f);
  if (!clean(f.place, 60)) e.place = '장소를 적어 주세요.'; if (!clean(f.desc, 300)) e.desc = '상황을 적어 주세요.';
  if (S.log.length >= MAXR) e.desc = '기록은 최대 ' + MAXR + '개까지예요.';
  S.err = e; if (Object.keys(e).length || !t) { S.msg = ''; return render(); }
  S.log.push({ id:uid(), d:kst(), kind:f.kind, place:clean(f.place, 60), desc:clean(f.desc, 300), who:clean(f.who, 80), car:clean(f.car, 20), state:'작성 중', no:'' });
  S.msg = '신고 기록에 저장했어요.'; save(); render();
}
function viewReport() {
  var kids = head('신고', '위급한 상황을 112에 정확히 전할 수 있게 내용을 정리합니다.'); kids.push(warn());
  kids.push(h('div', { class:'g2' }, [['112', '범죄·폭력·위협 신고', 'tel:112', '112 전화 걸기'], ['문자 112', '말하기 어려울 때 문자로 신고', 'sms:112', '문자 보내기']].map(function (x) {
    return h('div', { class:'card col' }, [h('div', { class:'num', style:'font-size:30px;font-weight:700', text:x[0] }), h('b', { text:x[1] }), h('a', { class:'btn fill', href:x[2], text:x[3], style:'text-decoration:none;align-self:flex-start' })]); })));
  var f = S.rep, e = S.err, out = h('pre', { id:'pol-rt', style:'white-space:pre-wrap;font:inherit;background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:12px;min-height:48px' });
  function upd() { var t = reportText(f); out.textContent = t || '유형·장소·상황을 적으면 신고 문장이 만들어져요.'; }
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'신고 내용 정리' }), h('div', { class:'sub', text:'적은 내용으로 신고 문장을 만들어 줍니다. 112에 말하거나 문자로 보낼 때 그대로 읽거나 붙이면 돼요.' }),
    h('div', { class:'frm' }, [sel('pol-kind', '유형', f.kind, KIND_KEYS.map(function (k) { return [k, k]; }), function (v) { f.kind = v; upd(); }), field('pol-place', '장소', f.place, { err:e.place, ph:'예: ○○동 편의점 앞', max:60, set:function (v) { f.place = v; upd(); } }), field('pol-when', '시각(선택)', f.when, { ph:'예: 방금, 오후 9시경', max:20, set:function (v) { f.when = v; upd(); } }),
      field('pol-desc', '상황', f.desc, { err:e.desc, ph:'예: 취객이 행인을 때리고 있어요', max:300, set:function (v) { f.desc = v; upd(); } }), field('pol-who', '상대 인상착의(선택)', f.who, { ph:'예: 검은 모자, 회색 점퍼', max:80, set:function (v) { f.who = v; upd(); } }), field('pol-car', '차량 번호(선택)', f.car, { ph:'예: 12가 3456', max:20, set:function (v) { f.car = v; upd(); } })]),
    out, h('div', { class:'rowf', style:'margin-top:16px' }, [btn('문장 복사', 'quiet', function () { var t = reportText(f); var m = $('pol-m'); if (!t) { if (m) m.textContent = '유형·장소·상황을 먼저 적어 주세요.'; return; } try { navigator.clipboard.writeText(t); if (m) m.textContent = '복사했어요.'; } catch (x) { if (m) m.textContent = '복사하지 못했어요. 직접 선택해 복사해 주세요.'; } }), btn('기록에 저장', 'fill', saveReport), h('span', { class:'sub', id:'pol-m', role:'status', text:S.msg })])]));
  upd();
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('치안 AI에게 묻기', 'quiet', function () { ask('112에 신고할 때 무엇을 알려야 하나요?'); })]));
  return kids;
}

// ── 대응 원리 ──
function viewPrinciple() {
  var kids = head('대응 원리', '나비웹 치안이 신고를 받은 뒤 상황을 파악하고 출동까지 이어 가는 방식입니다.');
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'신고부터 출동까지' }), h('div', {}, STEPS.map(function (x, i) { return h('div', { class:'stp' }, [h('i', { text:String(i + 1) }), h('div', {}, [h('b', { text:x[0] }), h('span', { text:x[1] })])]); })),
    h('div', { class:'note info', text:'설계 원칙입니다. 지금은 CCTV 제어, 주변 파악, 범죄자 특정, 경찰 전송, 출동 지시가 연결되어 있지 않고 이 화면은 경찰에 아무것도 보내지 않아요.' }),
    h('div', { class:'note', id:'pol-legal', text:'개인의 위치와 통신 기록을 쓰는 단계(3번)는 법적 근거와 감독 절차가 정해져야 하는 부분입니다. 이 화면은 그 기능을 제공하지 않고 순서만 설명해요.' })]));
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('대응 시뮬레이션 해 보기', 'fill', function () { go('sim'); })]));
  return kids;
}

// ── 대응 시뮬레이션 ──
function viewSim() {
  var kids = head('대응 시뮬레이션', '신고 유형과 가정값을 넣으면 출동이 어떻게 배정되는지 연습해 봅니다. 사람을 특정하지 않고 실제 출동도 일어나지 않아요.'); kids.push(warn());
  var s = S.sim, k = KINDS[s.kind] || KINDS['기타'];
  var form = h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'가정 넣기' }), h('div', { class:'frm' }, [
    sel('pol-s-kind', '신고 유형', s.kind, KIND_KEYS.map(function (x) { return [x, x]; }), function (v) { s.kind = v; render(); }),
    field('pol-s-cctv', '주변 CCTV(대)', s.cctv, { mode:'numeric', max:4, help:'신고 위치 주변에서 제어할 수 있는 센서 수 가정', set:function (v) { s.cctv = v; upd(); } }),
    field('pol-s-off', '근무 중인 경찰 인력(명)', s.off, { mode:'numeric', max:4, help:'인근 치안 기관 기준 가정', set:function (v) { s.off = v; upd(); } }),
    field('pol-s-car', '자율주행 치안 차량(대)', s.car, { mode:'numeric', max:4, set:function (v) { s.car = v; upd(); } }),
    field('pol-s-need', '필요 인원(명, 비우면 유형 기본값 ' + k.need + ')', s.need, { mode:'numeric', max:4, set:function (v) { s.need = v; upd(); } })])]);
  var out = h('div', { class:'col', id:'pol-s-out', style:'gap:16px' });
  function upd() {
    out.textContent = ''; var D = dispatch(s);
    if (!D) { out.appendChild(h('div', { class:'card' }, [h('div', { class:'empty', text:'값을 0 이상의 정수로 넣어 주세요(필요 인원은 1 이상).' })])); return; }
    out.appendChild(h('div', { class:'g2' }, [tile('출동 인원', D.send + '명', '필요 ' + D.need + '명', 'pol-s-send'), tile('자율주행 치안 차량', D.cars + '대', '', 'pol-s-cars')]));
    out.appendChild(h('div', { class:'card col' }, [h('b', { text:'전개 순서(연습)' }), h('div', {}, [
      '신고를 접수하고 ' + (D.urgent ? '긴급으로 분류' : '출동 필요 여부를 확인') + '합니다.',
      D.cctv ? '신고 위치 주변 CCTV ' + D.cctv + '대를 직접 제어해 상황을 파악합니다.' : '주변에 제어할 수 있는 CCTV가 없어 신고 내용과 현장 정보로 파악합니다.',
      '주변 상황을 파악하고 인근 경찰서·파출소에 필요한 정보를 전송합니다(개인 위치·통신 기록 활용은 법적 근거 필요).',
      D.send ? '근무 중인 경찰 인력 ' + D.send + '명' + (D.cars ? '과 자율주행 치안 차량 ' + D.cars + '대' : '') + '에 출동을 지시합니다.' : '근무 중인 인력이 없어 출동 지시를 할 수 없습니다.'
    ].map(function (x, i) { return h('div', { class:'stp' }, [h('i', { text:String(i + 1) }), h('div', {}, [h('span', { text:x })])]); }))]));
    if (D.widen) out.appendChild(h('div', { class:'note', id:'pol-s-short', role:'alert', text:'필요 인원 ' + D.need + '명 중 ' + D.shortage + '명이 모자라요. 가까운 다른 경찰서·파출소로 범위를 넓혀 추가 출동을 요청합니다.' }));
    out.appendChild(h('div', { class:'foot', text:'가정값으로 배정 순서를 보여 주는 연습입니다. 실제 배정은 현장 상황과 지휘 체계에 따라 달라요.' }));
  }
  upd(); kids.push(h('div', { class:'g2', style:'margin-top:16px;align-items:start' }, [form, out]));
  return kids;
}

// ── 내 신고 기록 ──
function viewLog() {
  var kids = head('내 신고 기록', '내가 정리한 신고와 진행 상태를 적어 둡니다. 접수번호는 112에서 안내받은 것을 직접 적어요.'); kids.push(warn());
  var open = S.log.filter(function (x) { return x.state !== '처리 완료'; }).length;
  kids.push(h('div', { class:'g4' }, [tile('기록', S.log.length + '건', '', 'pol-l0'), tile('진행 중', open + '건', '', 'pol-l1')]));
  if (!S.log.length) { kids.push(empty('아직 신고 기록이 없어요. “신고” 화면에서 내용을 정리해 저장하세요.')); return kids; }
  var list = S.log.slice().sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; });
  kids.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['날짜', '유형', '장소·상황', '상태', '접수번호', ''].map(function (t) { return h('th', { text:t }); }))]),
    h('tbody', {}, list.map(function (x) {
      var st = sel('pol-st-' + x.id, '상태', x.state, STATES.map(function (z) { return [z, z]; }), function (v) { x.state = v; save(); render(); });
      var no = h('input', { id:'pol-no-' + x.id, type:'text', value:x.no, maxlength:'30', placeholder:'선택', 'aria-label':'접수번호' }); no.onchange = function () { x.no = clean(no.value, 30); save(); };
      return h('tr', {}, [h('td', { class:'num', text:x.d }), h('td', {}, [pill(x.kind)]), h('td', {}, [h('b', { text:x.place }), h('div', { class:'sub', text:x.desc })]), h('td', {}, [st]), h('td', {}, [no]), h('td', { class:'r' }, [btn('삭제', 'sm quiet', function () { S.log = S.log.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]); }))])])]));
  return kids;
}

// ── 공개 범위 ──
function viewConsent() {
  var kids = head('공개 범위', '신고할 때 함께 전달할 내 정보를 항목마다 직접 정합니다.');
  kids.push(h('div', { class:'note info', style:'margin:16px 0', text:'설계 원칙: 신고에 꼭 필요한 항목만 전달합니다. 현재 위치는 출동에 꼭 필요해 항상 포함돼요. 지금은 아무것도 전송되지 않으며, 고른 상태는 이 브라우저에만 저장됩니다.' }));
  var n = h('span', { class:'sub', id:'pol-c-n' });
  function tally() { n.textContent = '함께 전달하기로 고른 항목 ' + Object.keys(S.share).length + ' / ' + (SEND.length - 1) + ' (현재 위치 제외)'; }
  kids.push(h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'신고에 함께 전달할 정보' }), n,
    h('div', {}, SEND.map(function (f) { var id = 'pol-sh-' + f[0], cb = h('input', { type:'checkbox', id:id, checked:f[0] === 'loc' || S.share[f[0]] ? true : false, disabled:f[0] === 'loc' ? true : null });
      cb.onchange = function () { if (cb.checked) S.share[f[0]] = 1; else delete S.share[f[0]]; save(); tally(); }; return h('label', { class:'chk', for:id }, [cb, h('span', { text:f[1] + (f[0] === 'loc' ? ' (항상 포함)' : '') })]); })),
    h('div', { class:'rowf' }, [btn('모두 해제', 'quiet', function () { S.share = {}; save(); render(); })])]));
  tally();
  return kids;
}

function render() {
  var root = $('pol-root'), tp = $('pol-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = S.view === 'principle' ? viewPrinciple() : S.view === 'sim' ? viewSim() : S.view === 'log' ? viewLog() : S.view === 'consent' ? viewConsent() : viewReport();
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
  M = el; el.textContent = ''; el.classList.add('pol'); S.log = []; S.share = {}; S.err = {}; S.msg = ''; load();
  [h('div', { id:'pol-top' }), h('div', { class:'wrap', id:'pol-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'report'; render();
}
window.NaviPolice = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  reportText:reportText, dispatch:dispatch,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
