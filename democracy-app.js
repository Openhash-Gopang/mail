/* democracy-app.js — 나비웹 민주주의(인프라 AI · 민주주의). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviDemocracy.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 democracy.css(.dem 범위). 전역은 NaviDemocracy 하나만 쓴다.
 *
 * 민주주의 화면의 특징(주피터 지시, 설계 원칙): 정부(입법·사법·행정)의 업무 프로세스나 결정에 이의가 있는 시민은 자기 주장을 입법 청원으로 낼 수 있다.
 * 예: 대기업과의 소송에서 진 시민 A 가 재판 때문에 기본권을 침해당했다고 느낄 때. 사람 한 명이 5천만 시민에게 청원을 전할 방법은 없지만 AI 비서가 오가는 나비웹에서는 가능하다.
 *  1) 시민 A 의 AI 비서가 새 입법 또는 기존 법률 개정의 필요성을 주장하는 청원 초안을 쓴다.
 *  2) 나비웹 민주주의 시스템이 먼저 1차 심사로 배포할 가치가 있는지 본다(무분별하고 막대한 양의 메일이 오가는 폐해를 막는다).
 *  3) 통과하면 전국 시민의 AI 비서에게 배포된다. 각 비서가 청원의 타당성·합리성을 평가해, 사람의 최종 판단이 필요하다고 보면 자기 시민에게 전달한다.
 *  4) 시민(사람)이 청원 의사를 밝히고, 일정 수 이상이 동의하면 국회의 입법 절차로 넘어간다.
 * 확정한 운영 원칙: 동의 기준은 국회 국민동의청원(30일 안에 5만 명)에 연결하는 것을 기본값으로 둔다 · 동의는 전화번호 본인 인증을 거친 가입자 1인 1표이고 AI 가 대신 동의하지 않는다 ·
 *  1차 심사는 '보완 필요'까지만 판정하고 최종 반려는 사람이 확인하며 이의 신청을 받는다 · 심사와 평가는 정치적으로 중립이어서 내용의 타당성과 절차만 본다(특정 정당·후보 지지·반대는 청원이 아니다).
 * 이 화면은 기록·점검·계산만 한다: screenPetition(형식 점검) · assess(받은 청원 평가) · progress(동의 진행 계산).
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 청원을 실제로 배포·접수하거나 동의를 모으지 않고 어떤 정보도 밖으로 보내지 않는다. 심사 시스템·전국 배포·동의 집계는 아직 연결되어 있지 않다(설계 단계).
 *  - '1차 심사'는 형식(분량·필수 항목·개인정보·선거운동 표현·중복)만 점검하는 것이며 내용의 옳고 그름을 판단하지 않는다. 기록은 이 브라우저(localStorage)에만 저장된다. */
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
function pill(t, k) { return h('span', { class:'pill ' + (k || ''), text:t }); }
function btn(t, c, fn) { return h('button', { type:'button', class:'btn ' + (c || ''), text:t, onclick:fn }); }
function kst() { return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul' }).format(new Date()); }
function numOf(v) { var s = String(v == null ? '' : v).replace(/[,\s원명]/g, ''); if (s === '' || !/^\d*\.?\d+$|^\d+\.?$/.test(s)) return NaN; return Number(s); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function clean(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }

// ── 저장 ──
var KEY = 'navi-democracy-v1', MAXP = 50, MAXR = 100;
var TABS = [['mine', '내 청원'], ['write', '청원 쓰기'], ['screen', '1차 심사'], ['inbox', '받은 청원'], ['tally', '동의 현황'], ['principle', '민주주의 원리']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var KINDS = ['새 입법', '기존 법률 개정'];
var STAGES = ['초안', '보완 필요', '배포 대기', '동의 진행', '국회 이관'];
var WILLS = ['', '동의', '보류', '반대'];
var CRIT = [['valid', '타당성'], ['reason', '합리성'], ['clarity', '명확성'], ['impact', '영향']];
var M = null, LS = {};
var S = { view:'mine', petitions:[], inbox:[], sel:'', err:{}, msg:'',
  wr:{ kind:'새 입법', title:'', law:'', problem:'', claim:'', basis:'' }, rc:{ title:'', gist:'' }, tl:{ n:'', goal:'50000', start:'', days:'30' } };

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
function topbar() {
  return h('div', { class:'topin' }, [
    h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 민주주의' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function notice() {
  return h('div', { class:'note info', style:'margin:16px 0', id:'dm-note', text:'이 화면은 청원을 실제로 배포·접수하거나 동의를 모으지 않고 어떤 정보도 밖으로 보내지 않습니다. 적어 둔 내용은 이 브라우저에만 저장돼요. 전국 배포와 동의 집계는 아직 연결되어 있지 않습니다.' });
}
function tile(k, v, s, id) { return h('div', { class:'tile' }, [h('div', { class:'k', text:k }), h('div', { class:'num', id:id, style:'font-size:20px;font-weight:700', text:v }), s ? h('div', { class:'sub', text:s }) : null]); }
function stepsCard(title, st, foot) {
  return h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:title }), h('div', {}, st.map(function (x, i) { return h('div', { class:'stp' }, [h('i', { text:String(i + 1) }), h('div', {}, [h('b', { text:x[0] }), h('span', { text:x[1] })])]); })), foot ? h('div', { class:'note info', text:foot }) : null]);
}
function table(cols, rows) {
  return h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, cols.map(function (t) { return h('th', { text:t }); }))]), h('tbody', {}, rows)])])]);
}

function load() {
  try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v || typeof v !== 'object') return;
    S.petitions = (Array.isArray(v.petitions) ? v.petitions : []).map(fixP).filter(Boolean).slice(0, MAXP);
    S.inbox = (Array.isArray(v.inbox) ? v.inbox : []).map(fixR).filter(Boolean).slice(0, MAXR); } catch (e) {}
}
function fixP(x) {
  if (!x || typeof x !== 'object' || KINDS.indexOf(x.kind) < 0 || STAGES.indexOf(x.st) < 0) return null;
  var title = clean(x.title, 60); if (!title) return null;
  return { id:clean(x.id, 20) || uid(), kind:x.kind, title:title, law:clean(x.law, 60), problem:clean(x.problem, 600), claim:clean(x.claim, 600), basis:clean(x.basis, 600), st:x.st, issues:(Array.isArray(x.issues) ? x.issues : []).map(function (s) { return clean(s, 120); }).filter(Boolean).slice(0, 10), d:/^\d{4}-\d{2}-\d{2}$/.test(x.d) ? x.d : kst() };
}
function fixR(x) {
  if (!x || typeof x !== 'object') return null;
  var title = clean(x.title, 60), gist = clean(x.gist, 400); if (!title || !gist) return null;
  var sc = {}; CRIT.forEach(function (c) { var n = Number(x.sc && x.sc[c[0]]); sc[c[0]] = n >= 1 && n <= 5 && Math.floor(n) === n ? n : 0; });
  return { id:clean(x.id, 20) || uid(), title:title, gist:gist, sc:sc, will:WILLS.indexOf(x.will) >= 0 ? x.will : '' };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ petitions:S.petitions, inbox:S.inbox })); } catch (e) {} }

/** 글자 두 개씩 묶어 두 글의 비슷한 정도(0~1)를 잰다(띄어쓰기 무시). */
function similar(a, b) {
  function bg(s) { var t = String(s || '').replace(/\s+/g, '').toLowerCase(), o = {}; for (var i = 0; i < t.length - 1; i++) o[t.slice(i, i + 2)] = 1; return o; }
  var x = bg(a), y = bg(b), kx = Object.keys(x), ky = Object.keys(y); if (!kx.length || !ky.length) return 0;
  var both = kx.filter(function (k) { return y[k]; }).length; return both / (kx.length + ky.length - both);
}
/** 1차 심사(형식만): 필수 항목·분량·개인정보·선거운동 표현·중복. 내용의 옳고 그름은 판단하지 않는다. others 는 이미 있는 내 청원들. */
function screenPetition(p, others) {
  if (!p || typeof p !== 'object') return null;
  var issues = [], title = clean(p.title, 60), prob = clean(p.problem, 600), claim = clean(p.claim, 600), basis = clean(p.basis, 600), law = clean(p.law, 60);
  var all = [title, prob, claim, basis, law].join(' ');
  if (title.length < 5) issues.push('제목을 5자 이상으로 적어 주세요.');
  if (prob.length < 30) issues.push('문제 상황을 30자 이상으로 구체적으로 적어 주세요.');
  if (claim.length < 30) issues.push('요구하는 입법·개정 내용을 30자 이상으로 적어 주세요.');
  if (basis.length < 20) issues.push('근거를 20자 이상으로 적어 주세요(사실·자료·사례).');
  if (p.kind === '기존 법률 개정' && !law) issues.push('고치려는 법률의 이름을 적어 주세요.');
  if (/\d{6}-?[1-4]\d{6}/.test(all) || /01\d[-\s]?\d{3,4}[-\s]?\d{4}/.test(all) || /[\w.+-]+@[\w-]+\.[\w.-]+/.test(all)) issues.push('주민등록번호·전화번호·이메일 같은 개인정보가 들어 있어요. 지워 주세요.');
  if (/(투표하세요|투표해 주세요|찍어\s*주세요|낙선|당선시|을\s*지지합니다|를\s*지지합니다)/.test(all)) issues.push('특정 후보·정당을 지지하거나 반대하는 표현이 있어요. 청원은 선거 운동이 아니라 입법·개정 내용을 담아야 해요.');
  var dup = (others || []).filter(function (o) { return o && o.id !== p.id && similar(o.title + ' ' + o.claim, title + ' ' + claim) >= 0.6; });
  if (dup.length) issues.push('내용이 비슷한 청원이 이미 있어요: ' + clean(dup[0].title, 30) + '. 합치거나 차이를 분명히 해 주세요.');
  return { ok:issues.length === 0, issues:issues };
}
/** 받은 청원 평가: 타당성·합리성·명확성·영향(각 1~5). 하나라도 비면 null. 평균 3.5 이상이고 1점이 없으면 사람에게 전달, 2.5 이상이면 요약만 보관, 그 아래는 보류. 최종 판단은 언제나 사람이 한다. */
function assess(sc) {
  if (!sc || typeof sc !== 'object') return null;
  var v = CRIT.map(function (c) { return Number(sc[c[0]]); });
  if (v.some(function (n) { return !(n >= 1 && n <= 5) || Math.floor(n) !== n; })) return null;
  var avg = Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length * 10) / 10, min = Math.min.apply(null, v);
  var action = avg >= 3.5 && min >= 2 ? 'forward' : avg >= 2.5 ? 'summary' : 'hold';
  return { avg:avg, min:min, action:action, label:action === 'forward' ? '내게 전달해 판단 요청' : action === 'summary' ? '요약만 보관' : '보류' };
}
/** 동의 진행: 동의 수 n, 기준 goal, 시작일 start(YYYY-MM-DD), 기간 days, 오늘 today. */
function progress(n, goal, start, days, today) {
  var c = numOf(n), g = numOf(goal), d = numOf(days);
  if (!isFinite(c) || !isFinite(g) || !isFinite(d) || g < 1 || g > 1e9 || c < 0 || c > 1e9 || d < 1 || d > 365 || !/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(today || '')) return null;
  var ms = function (s) { return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); };
  var used = Math.floor((ms(today) - ms(start)) / 86400000); if (used < 0) return null;
  var left = Math.max(0, g - c), daysLeft = Math.max(0, d - used), pct = Math.min(100, Math.floor(c / g * 1000) / 10);
  var status = c >= g ? '달성' : daysLeft <= 0 ? '기간 종료' : (used >= 1 && c / used * daysLeft + c >= g) || used < 1 ? '가능' : '어려움';
  return { pct:pct, left:left, daysLeft:daysLeft, perDay:daysLeft > 0 ? Math.ceil(left / daysLeft) : null, status:status };
}

// ── 내 청원 ──
function viewMine() {
  var kids = head('내 청원', '내가 낸 청원이 지금 어느 단계에 있는지 봅니다.'); kids.push(notice());
  kids.push(h('div', { class:'g2', style:'margin-top:16px' }, [tile('내 청원', S.petitions.length + '건', '', 'dm-n'), tile('배포 대기', S.petitions.filter(function (x) { return x.st === '배포 대기'; }).length + '건', '1차 심사를 통과한 청원', 'dm-ready')]));
  if (!S.petitions.length) { kids.push(empty('아직 쓴 청원이 없어요. 청원 쓰기에서 첫 청원을 적어 보세요.', btn('청원 쓰기', 'fill', function () { go('write'); }))); return kids; }
  kids.push(table(['청원', '종류', '단계', ''], S.petitions.map(function (x) {
    var st = h('select', { 'aria-label':x.title + ' 단계' }, STAGES.map(function (c) { return h('option', { value:c, text:c }); })); st.value = x.st; st.onchange = function () { x.st = st.value; save(); render(); };
    return h('tr', {}, [h('td', {}, [h('b', { text:x.title }), h('div', { class:'sub', text:x.d })]), h('td', { text:x.kind + (x.law ? ' · ' + x.law : '') }), h('td', {}, [st]),
      h('td', {}, [btn('심사', 'quiet', function () { S.sel = x.id; go('screen'); }), btn('삭제', 'quiet', function () { S.petitions = S.petitions.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]);
  })));
  kids.push(h('div', { class:'sub', style:'margin-top:8px', text:'동의 진행·국회 이관 단계는 지금은 내가 직접 표시합니다. 배포와 집계가 연결되면 자동으로 바뀝니다.' }));
  return kids;
}

// ── 청원 쓰기 ──
function addPetition() {
  var f = S.wr, e = {}, title = clean(f.title, 60);
  if (!title) e.title = '청원 제목을 적어 주세요.'; if (S.petitions.length >= MAXP) e.title = '청원은 최대 ' + MAXP + '건까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  var p = { id:uid(), kind:f.kind, title:title, law:clean(f.law, 60), problem:clean(f.problem, 600), claim:clean(f.claim, 600), basis:clean(f.basis, 600), st:'초안', issues:[], d:kst() };
  S.petitions.unshift(p); S.sel = p.id; f.title = ''; f.law = ''; f.problem = ''; f.claim = ''; f.basis = ''; S.msg = '초안으로 저장했어요. 아무에게도 보내지 않았어요.'; save(); render();
}
function viewWrite() {
  var kids = head('청원 쓰기', '무엇이 문제이고 어떤 입법·개정을 바라는지 적습니다. 내 AI 비서가 초안을 다듬는 것을 도와줍니다.'); kids.push(notice());
  var f = S.wr, e = S.err;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('div', { class:'frm' }, [
    sel('dm-w-kind', '청원 종류', f.kind, KINDS.map(function (k) { return [k, k]; }), function (v) { f.kind = v; }),
    field('dm-w-title', '청원 제목', f.title, { err:e.title, max:60, ph:'예: 대기업 상대 소송의 증거 접근권 보장', set:function (v) { f.title = v; } }),
    field('dm-w-law', '관련 법률(개정일 때 필수)', f.law, { max:60, ph:'예: 민사소송법', set:function (v) { f.law = v; } })]),
    field('dm-w-problem', '문제 상황(30자 이상)', f.problem, { area:true, max:600, ph:'어떤 일이 있었고 무엇이 문제인가요? 개인정보는 적지 마세요.', set:function (v) { f.problem = v; } }),
    field('dm-w-claim', '요구하는 입법·개정(30자 이상)', f.claim, { area:true, max:600, ph:'법을 어떻게 만들거나 고쳐야 하나요?', set:function (v) { f.claim = v; } }),
    field('dm-w-basis', '근거(20자 이상)', f.basis, { area:true, max:600, ph:'사실, 자료, 비슷한 사례', set:function (v) { f.basis = v; } }),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('초안으로 저장', 'fill', addPetition),
      btn('내 AI 비서에게 초안 다듬기', 'quiet', function () { ask('내가 겪은 일을 바탕으로 입법 청원 초안을 쓰고 싶어요. 문제 상황, 요구하는 입법·개정 내용, 근거로 나눠서 정리하도록 질문해 주세요.'); }),
      S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  kids.push(h('div', { class:'note', style:'margin-top:16px', text:'청원은 내가 정한 문제와 주장을 담는 글이에요. 특정 정당·후보를 지지하거나 반대하는 글, 개인정보가 들어간 글은 배포되지 않아요.' }));
  return kids;
}

// ── 1차 심사 ──
function viewScreen() {
  var kids = head('1차 심사', '전국 시민에게 보내기 전에, 무분별한 청원이 오가지 않도록 먼저 형식을 점검합니다.'); kids.push(notice());
  kids.push(stepsCard('1차 심사에서 보는 것', [
    ['필수 항목과 분량', '제목·문제 상황·요구 내용·근거가 빠지지 않고 충분히 구체적인지 봐요.'],
    ['개인정보', '주민등록번호·전화번호·이메일 같은 개인정보가 들어 있지 않은지 봐요.'],
    ['선거 운동 표현', '특정 후보·정당을 지지하거나 반대하는 글은 청원이 아니라서 배포하지 않아요.'],
    ['중복', '이미 있는 청원과 거의 같다면 합치거나 차이를 밝히게 해요.']],
    '내용이 옳은지 그른지는 판단하지 않아요. 심사 시스템은 「보완 필요」까지만 알리고, 최종 반려는 사람이 확인하며 이의 신청을 받습니다.'));
  if (!S.petitions.length) { kids.push(empty('심사할 청원이 없어요. 먼저 청원을 써 보세요.', btn('청원 쓰기', 'fill', function () { go('write'); }))); return kids; }
  var cur = S.petitions.filter(function (x) { return x.id === S.sel; })[0] || S.petitions[0];
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [sel('dm-s-pick', '심사할 청원', cur.id, S.petitions.map(function (x) { return [x.id, x.title]; }), function (v) { S.sel = v; render(); }),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('1차 심사 받기', 'fill', function () {
      var r = screenPetition(cur, S.petitions); cur.issues = r.issues; if (cur.st === '초안' || cur.st === '보완 필요' || cur.st === '배포 대기') cur.st = r.ok ? '배포 대기' : '보완 필요'; S.sel = cur.id; save(); render(); }),
      pill(cur.st, cur.st === '보완 필요' ? 'bad' : '')])]));
  if (cur.st === '배포 대기') kids.push(h('div', { id:'dm-s-res', class:'note info', style:'margin-top:12px', text:'형식 점검을 통과했어요. 전국 배포가 연결되면 이 청원이 시민의 AI 비서에게 전해집니다. 지금은 아무에게도 보내지 않았어요.' }));
  else if (cur.issues.length) kids.push(h('div', { id:'dm-s-res', class:'note', role:'alert', style:'margin-top:12px' }, [h('b', { text:'보완이 필요해요' }), h('ul', {}, cur.issues.map(function (t) { return h('li', { text:t }); })), h('div', { class:'sub', text:'결과가 맞지 않는다고 생각하면 이의를 신청해 사람의 검토를 받을 수 있어요(연결 전에는 비서에게 묻기).' })]));
  if (cur.issues.length) kids.push(h('div', { class:'rowf', style:'margin-top:8px' }, [btn('이의 신청 방법 묻기', 'quiet', function () { ask('1차 심사에서 보완 필요로 나온 내 청원에 이의를 신청해 사람의 검토를 받으려면 어떻게 하나요?'); })]));
  return kids;
}

// ── 받은 청원 ──
function addInbox() {
  var f = S.rc, e = {}, title = clean(f.title, 60), gist = clean(f.gist, 400);
  if (!title) e.title = '청원 제목을 적어 주세요.'; if (!gist) e.gist = '청원의 요지를 적어 주세요.'; if (S.inbox.length >= MAXR) e.title = '최대 ' + MAXR + '건까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  S.inbox.unshift({ id:uid(), title:title, gist:gist, sc:{ valid:0, reason:0, clarity:0, impact:0 }, will:'' }); f.title = ''; f.gist = ''; S.msg = '받은 청원에 적었어요.'; save(); render();
}
function viewInbox() {
  var kids = head('받은 청원', '내 AI 비서가 평가해 올려 준 청원을 보고, 동의할지 정합니다. 최종 판단은 언제나 내가 합니다.'); kids.push(notice());
  var f = S.rc, e = S.err;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'받은 청원 적어 보기' }), h('div', { class:'sub', text:'연결되면 비서가 자동으로 올려 줘요. 지금은 직접 적어 평가하는 연습을 할 수 있어요.' }),
    h('div', { class:'frm' }, [field('dm-r-title', '청원 제목', f.title, { err:e.title, max:60, set:function (v) { f.title = v; } })]),
    field('dm-r-gist', '청원 요지', f.gist, { area:true, err:e.gist, max:400, set:function (v) { f.gist = v; } }),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('적기', 'fill', addInbox), btn('비서에게 평가 기준 묻기', 'quiet', function () { ask('받은 청원의 타당성과 합리성을 어떤 기준으로 평가하면 좋을지 알려 주세요.'); }), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  if (!S.inbox.length) { kids.push(empty('받은 청원이 없어요.')); return kids; }
  S.inbox.forEach(function (x) {
    var a = assess(x.sc), opts = [['0', '평가 전']].concat([1, 2, 3, 4, 5].map(function (n) { return [String(n), n + '점']; }));
    var grid = h('div', { class:'frm' }, CRIT.map(function (c) { return sel('dm-i-' + x.id + c[0], c[1], String(x.sc[c[0]]), opts, function (v) { x.sc[c[0]] = Number(v); save(); render(); }); }));
    kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:16px', text:x.title }), h('div', { class:'sub', text:x.gist }), grid,
      a ? h('div', { class:a.action === 'forward' ? 'note info' : 'note', id:'dm-i-res-' + x.id, text:'평가 평균 ' + a.avg + '점 — 비서의 의견: ' + a.label + (a.action === 'forward' ? '. 사람인 내가 읽고 판단할 청원이에요.' : '.') }) : h('div', { class:'sub', text:'네 항목을 모두 평가하면 비서의 의견이 나와요.' }),
      h('div', { class:'rowf', style:'margin-top:8px' }, [sel('dm-i-w-' + x.id, '내 의사', x.will, WILLS.map(function (w) { return [w, w || '아직 정하지 않음']; }), function (v) { x.will = v; save(); }), btn('삭제', 'quiet', function () { S.inbox = S.inbox.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]));
  });
  kids.push(h('div', { class:'note', style:'margin-top:16px', text:'동의는 전화번호 본인 인증을 거친 가입자 한 사람이 한 번만 할 수 있어요. 비서가 내 대신 동의하지 않아요. 평가는 내용의 타당성과 절차만 보고 특정 정당·후보를 편들지 않아요.' }));
  return kids;
}

// ── 동의 현황 ──
function viewTally() {
  var kids = head('동의 현황', '동의 수가 기준에 얼마나 왔는지, 남은 기간 안에 닿을 수 있는지 계산합니다.'); kids.push(notice());
  var f = S.tl; if (!f.start) f.start = kst();
  var out = h('div', { id:'dm-t-out', style:'margin-top:12px' });
  function upd() { out.textContent = ''; var r = progress(f.n, f.goal, f.start, f.days, kst());
    out.appendChild(!r ? h('div', { class:'sub', text:'동의 수·기준·기간을 숫자로, 시작일을 2026-11-23 모양으로 넣어 주세요.' }) : h('div', {}, [
      h('div', { class:'g2' }, [tile('달성률', r.pct + '%', '남은 동의 ' + won(r.left) + '명', 'dm-t-pct'), tile('남은 기간', r.daysLeft + '일', r.perDay == null ? '' : '하루 ' + won(r.perDay) + '명씩 필요', 'dm-t-days')]),
      h('div', { class:'meter8 ' + (r.status === '달성' ? 'ok' : r.status === '어려움' || r.status === '기간 종료' ? 'bad' : ''), style:'margin-top:12px' }, [h('i', { style:'width:' + r.pct + '%' })]),
      h('div', { id:'dm-t-res', class:r.status === '달성' || r.status === '가능' ? 'note info' : 'note', style:'margin-top:12px', text:r.status === '달성' ? '기준을 넘었어요. 국회 입법 절차로 넘길 수 있습니다.' : r.status === '가능' ? '지금 속도라면 기간 안에 기준에 닿을 수 있어요.' : r.status === '어려움' ? '지금 속도로는 기간 안에 기준에 닿기 어려워요.' : '기간이 끝났어요.' })])); }
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'동의 진행 계산' }), h('div', { class:'sub', text:'기본값은 국회 국민동의청원 기준(30일 안에 5만 명)이에요. 법이 바뀌면 달라질 수 있으니 확인해서 고쳐 쓰세요. 숫자는 내가 넣는 값이고 실제 집계가 아니에요.' }),
    h('div', { class:'frm' }, [field('dm-t-n', '지금 동의 수(명)', f.n, { mode:'numeric', max:10, ph:'예: 12000', set:function (v) { f.n = v; upd(); } }), field('dm-t-goal', '기준(명)', f.goal, { mode:'numeric', max:10, set:function (v) { f.goal = v; upd(); } }),
      field('dm-t-start', '동의 받기 시작한 날', f.start, { max:10, ph:'예: 2026-11-23', set:function (v) { f.start = v; upd(); } }), field('dm-t-days', '기간(일)', f.days, { mode:'numeric', max:3, set:function (v) { f.days = v; upd(); } })]), out]));
  var run = S.petitions.filter(function (x) { return x.st === '동의 진행' || x.st === '국회 이관'; });
  kids.push(run.length ? table(['청원', '단계'], run.map(function (x) { return h('tr', {}, [h('td', { text:x.title }), h('td', { text:x.st })]); })) : h('div', { class:'sub', style:'margin-top:12px', text:'동의 진행 또는 국회 이관으로 표시한 청원이 여기에 모여요.' }));
  upd(); return kids;
}

// ── 민주주의 원리 ──
function viewPrinciple() {
  var kids = head('민주주의 원리', '사람 한 명은 전국 시민에게 청원을 전할 수 없지만, AI 비서가 오가는 나비웹에서는 가능합니다.');
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'시민 A의 이야기' }),
    h('p', { text:'대기업과의 소송에서 진 시민 A가 재판 때문에 기본권을 침해당했다고 느낍니다. 지금의 입법 시스템에서 한 사람이 자기 뜻을 관철하기는 쉽지 않아요.' }),
    h('p', { text:'나비웹에서는 A의 AI 비서가 새 입법 또는 법률 개정의 필요성을 주장하는 청원 초안을 쓰고, 전국 시민의 AI 비서가 그 타당성과 합리성을 읽고 평가한 뒤 사람의 판단이 필요한 것만 시민에게 전합니다. 사람이 수백만 통의 메일을 다 읽을 수는 없어도 그의 비서는 읽을 수 있어요.' })]));
  kids.push(stepsCard('청원이 국회까지 가는 길', [
    ['내 비서가 초안을 씀', '시민 A의 AI 비서가 문제 상황, 요구하는 입법·개정, 근거를 담아 초안을 써요.'],
    ['나비웹 민주주의 시스템의 1차 심사', '전국에 보낼 가치가 있는지 형식을 먼저 점검해, 막대한 양의 무분별한 청원이 오가는 것을 막아요.'],
    ['전국 시민의 AI 비서에게 배포', '심사를 통과한 청원이 시민 각자의 AI 비서에게 전해져요.'],
    ['각 비서가 평가하고 필요하면 사람에게 전달', '비서가 타당성·합리성을 평가해, 사람의 최종 판단이 필요하다고 보면 자기 시민에게 청원과 평가를 전해요.'],
    ['시민이 동의, 기준을 넘으면 국회로', '사람이 청원 의사를 밝히고, 기준 이상이 동의하면 국회 입법 절차로 넘어가요.']],
    '청원을 쓰고 읽고 평가하는 일은 AI가, 청원 의사를 밝히는 일은 사람이 합니다. 전국 배포와 동의 집계는 아직 연결되어 있지 않아요.'));
  kids.push(table(['원칙', '내용'], [
    ['한 사람 한 표', '전화번호 본인 인증을 거친 가입자당 1표예요. AI 비서가 대신 동의하지 않아요.'],
    ['심사의 한계', '1차 심사는 「보완 필요」까지만 알리고, 최종 반려는 사람이 확인하며 이의 신청을 받아요.'],
    ['정치적 중립', '심사와 평가는 내용의 타당성과 절차만 봐요. 특정 정당·후보를 편들지 않아요.'],
    ['동의 기준', '국회 국민동의청원 기준(30일 안에 5만 명)에 연결하는 것을 기본으로 해요.']].map(function (r) { return h('tr', {}, [h('th', { text:r[0] }), h('td', { text:r[1] })]); })));
  return kids;
}

function render() {
  var root = $('dm-root'), tp = $('dm-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = S.view === 'write' ? viewWrite() : S.view === 'screen' ? viewScreen() : S.view === 'inbox' ? viewInbox() : S.view === 'tally' ? viewTally() : S.view === 'principle' ? viewPrinciple() : viewMine();
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
  M = el; el.textContent = ''; el.classList.add('dem'); S.petitions = []; S.inbox = []; S.err = {}; S.msg = ''; S.sel = ''; load();
  [h('div', { id:'dm-top' }), h('div', { class:'wrap', id:'dm-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'mine'; render();
}
window.NaviDemocracy = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  screenPetition:screenPetition, assess:assess, progress:progress, similar:similar,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
