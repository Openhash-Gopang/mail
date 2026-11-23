/* meet-app.js — 나비웹 모임(인프라 AI · 모임). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviMeet.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 meet.css(.mtg 범위). 전역은 NaviMeet 하나만 쓴다.
 *
 * 모임 화면의 개념(주피터 지시): 인간은 사회적 동물이다. 개인의 적성·취향·능력·연령·성별·가족 등을 종합해 알맞은 모임을 추천하고,
 * 모임에 들어온 참여자들은 자신을 포함해 서로의 성향 등을 공유한다. 그래서 이질적인 멤버를 걸러 내고, 취향·성향·목적이 실제로 비슷한 사람끼리 그룹을 만든다.
 * 이 화면은 입력한 값으로 계산·기록만 한다: similarity(두 프로필의 유사도) · recommend(모임 추천과 참여 조건) · formGroup(이질적 멤버 걸러 내기) · sharedView(공개한 항목만 서로 보기).
 * 설계 결정(화면에도 적는다):
 *  - 걸러 내는 점수는 취향(35%)·성향(30%)·목적(25%)·능력(10%)의 유사도로만 계산한다. 연령·성별·가족은 점수에 넣지 않는다.
 *  - 연령·성별·가족은 기본이 비공개이고 본인이 항목별로 공개를 고른다. 모임이 직접 내건 조건(연령 범위, 성별)만 참여 가능 여부에 쓰이며, 그때는 그 항목을 공개해야 한다.
 *  - 걸러 낼 기준 점수는 사용자가 정하고, 걸러진 사유(평균 유사도와 가장 다른 부분)를 보여 준다.
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 후보 참여자는 내가 직접 입력한 가상 사람들이며, 실제 사람들의 프로필 교환·그룹 구성은 PDV 와 연결된 뒤에 가능하다. 모임을 실제로 만들거나 사람을 연결·초대하지 않는다.
 *  - 유사도는 단순한 규칙이라 사람 사이의 궁합을 예측하지 않는다. 낯선 사람과의 오프라인 만남은 공개된 장소와 지인 알림을 권한다. 기록은 이 브라우저(localStorage)에만 저장된다. */
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
var KEY = 'navi-meet-v1', MAXP = 20, MAXG = 10, MAXT = 8;
var TABS = [['me', '내 프로필'], ['meet', '모임 추천'], ['group', '그룹 구성'], ['share', '성향 공유'], ['principle', '모임 원리']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var PURP = ['친목', '운동', '학습', '봉사', '창작', '여행', '돌봄'];
var AX = [['act', '활동적(5) ↔ 차분(1)'], ['soc', '사교적(5) ↔ 내향(1)'], ['plan', '계획적(5) ↔ 즉흥(1)'], ['adv', '모험적(5) ↔ 안정(1)']];
var GEN = ['', '여성', '남성', '기타'], FAM = ['', '1인 가구', '부부', '자녀 있음', '부모 부양'];
var W = { i:0.35, t:0.3, p:0.25, s:0.1 };
var PART = { interests:'취향', traits:'성향', purpose:'목적', skills:'능력' };
var M = null, LS = {};
function blankP() { return { name:'', interests:'', skills:'', purpose:'', act:'', soc:'', plan:'', adv:'', age:'', gender:'', family:'', show:{ age:'', gender:'', family:'' } }; }
function blankG() { return { title:'', purpose:'', tags:'', act:'', soc:'', plan:'', adv:'', ageMin:'', ageMax:'', gender:'' }; }
var S = { view:'me', me:blankP(), people:[], meets:[], thr:'60', fp:blankP(), fg:blankG(), last:null, err:{}, msg:'' };

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
function tags(s) { var seen = {}, out = []; String(s == null ? '' : s).split(/[,，、\n]/).forEach(function (x) { var t = clean(x, 12); if (t && !seen[t] && out.length < MAXT) { seen[t] = 1; out.push(t); } }); return out; }
function jac(a, b) { if (!a.length || !b.length) return 0; var n = 0; a.forEach(function (x) { if (b.indexOf(x) >= 0) n++; }); return n / (a.length + b.length - n); }
function traitsOf(p) { var o = [], i, v; for (i = 0; i < AX.length; i++) { v = Number(p && (p.traits ? (Array.isArray(p.traits) ? p.traits[i] : p.traits[AX[i][0]]) : p[AX[i][0]])); if (!ok(v, 1, 5) || Math.floor(v) !== v) return null; o.push(v); } return o; }
/** 프로필을 계산용으로 정리: 이름·취향 1개 이상·목적·성향 네 축(1~5 정수)이 있어야 한다. 아니면 null. */
function norm(p) {
  if (!p || typeof p !== 'object') return null; var name = clean(p.name, 20), it = Array.isArray(p.interests) ? p.interests : tags(p.interests), sk = Array.isArray(p.skills) ? p.skills : tags(p.skills), tr = traitsOf(p);
  if (!name || !it.length || PURP.indexOf(p.purpose) < 0 || !tr) return null; var a = p.age === '' || p.age === undefined || p.age === null ? null : numOf(p.age), age = a !== null && ok(a, 0, 120) ? a : null; if (a !== null && age === null) return null;
  return { name:name, interests:it, skills:sk, purpose:p.purpose, traits:tr, age:age, gender:GEN.indexOf(p.gender) > 0 ? p.gender : '', family:FAM.indexOf(p.family) > 0 ? p.family : '', show:p.show || {} };
}
/** 두 프로필의 유사도(0~100): 취향(자카드 35%)·성향(네 축 차이 30%)·목적(같으면 1, 25%)·능력(둘 다 있으면 자카드 10%). 연령·성별·가족은 쓰지 않는다. 능력이 한쪽이라도 비면 그 몫은 빼고 나머지로 다시 나눈다. */
function similarity(a, b) {
  var x = norm(a), y = norm(b); if (!x || !y) return null; var d = 0, i; for (i = 0; i < 4; i++) d += Math.abs(x.traits[i] - y.traits[i]);
  var parts = { interests:jac(x.interests, y.interests), traits:1 - d / 16, purpose:x.purpose === y.purpose ? 1 : 0, skills:x.skills.length && y.skills.length ? jac(x.skills, y.skills) : null };
  var sum = W.i * parts.interests + W.t * parts.traits + W.p * parts.purpose, tot = W.i + W.t + W.p; if (parts.skills !== null) { sum += W.s * parts.skills; tot += W.s; }
  return { score:sum / tot * 100, parts:parts };
}
function fixMeet(g) {
  if (!g || typeof g !== 'object') return null; var t = clean(g.title, 30), tg = tags(g.tags), tr = traitsOf(g); if (!t || !tg.length || PURP.indexOf(g.purpose) < 0 || !tr) return null;
  function ag(v) { if (v === '' || v === undefined || v === null) return null; var n = numOf(v); return ok(n, 0, 120) ? n : NaN; } var lo = ag(g.ageMin), hi = ag(g.ageMax); if ((lo !== null && isNaN(lo)) || (hi !== null && isNaN(hi)) || (lo !== null && hi !== null && lo > hi)) return null;
  return { title:t, purpose:g.purpose, tags:tg, traits:tr, ageMin:lo, ageMax:hi, gender:GEN.indexOf(g.gender) > 0 ? g.gender : '' };
}
/** 모임 추천: 내 프로필과 모임이 내건 취향·성향·목적의 유사도로 점수를 매기고, 모임이 건 연령·성별 조건을 따로 확인한다. 조건을 못 채우면(또는 내가 그 항목을 비워 확인할 수 없으면) 참여 불가로 사유를 적는다. 점수 높은 순, 참여 가능한 모임이 먼저. */
function recommend(me, meets) {
  var m = norm(me); if (!m || !Array.isArray(meets)) return null; var out = [];
  for (var i = 0; i < meets.length; i++) { var g = fixMeet(meets[i]); if (!g) return null; var s = similarity(me, { name:'모임', interests:g.tags, skills:[], purpose:g.purpose, act:g.traits[0], soc:g.traits[1], plan:g.traits[2], adv:g.traits[3] }), why = [];
    if (g.ageMin !== null || g.ageMax !== null) { if (m.age === null) why.push('연령 조건이 있는데 내 나이를 입력하지 않았어요'); else if ((g.ageMin !== null && m.age < g.ageMin) || (g.ageMax !== null && m.age > g.ageMax)) why.push('연령 조건(' + (g.ageMin === null ? '' : g.ageMin) + '~' + (g.ageMax === null ? '' : g.ageMax) + '세)에 맞지 않아요'); }
    if (g.gender) { if (!m.gender) why.push('성별 조건이 있는데 내 성별을 입력하지 않았어요'); else if (m.gender !== g.gender) why.push('성별 조건(' + g.gender + ')에 맞지 않아요'); }
    out.push({ title:g.title, purpose:g.purpose, score:s.score, parts:s.parts, eligible:!why.length, why:why, needs:(g.ageMin !== null || g.ageMax !== null ? ['연령'] : []).concat(g.gender ? ['성별'] : []) }); }
  return out.sort(function (a, b) { return (b.eligible - a.eligible) || (b.score - a.score); });
}
/** 그룹 구성: 후보 전원의 쌍별 유사도를 구하고, 다른 모든 사람과의 평균 유사도가 기준 미만인 사람을 가장 낮은 사람부터 한 명씩 빼 모두가 기준 이상이 될 때까지 반복한다. 둘 미만이 남으면 그룹이 만들어지지 않는다. 걸러진 사람에게는 평균과 가장 다른 부분을 적는다. */
function formGroup(cands, thr) {
  var t = Number(thr); if (!Array.isArray(cands) || cands.length < 2 || !ok(t, 0, 100)) return null; var ps = cands.map(norm); if (ps.some(function (p) { return !p; })) return null;
  var names = {}; for (var q = 0; q < ps.length; q++) { if (names[ps[q].name]) return null; names[ps[q].name] = 1; }
  var sim = ps.map(function (a) { return ps.map(function (b) { var r = similarity(a, b); return r; }); }), alive = ps.map(function (_, i) { return i; }), removed = [];
  function stat(i) { var o = alive.filter(function (j) { return j !== i; }), s = 0, pt = { interests:0, traits:0, purpose:0, skills:0 }, n = { skills:0 }; o.forEach(function (j) { var r = sim[i][j]; s += r.score; pt.interests += r.parts.interests; pt.traits += r.parts.traits; pt.purpose += r.parts.purpose; if (r.parts.skills !== null) { pt.skills += r.parts.skills; n.skills++; } }); var k = o.length;
    var avg = { interests:pt.interests / k, traits:pt.traits / k, purpose:pt.purpose / k }; if (n.skills) avg.skills = pt.skills / n.skills; return { mean:s / k, avg:avg }; }
  while (alive.length > 1) { var st = alive.map(function (i) { return { i:i, s:stat(i) }; }), low = st[0]; st.forEach(function (x) { if (x.s.mean <= low.s.mean) low = x; }); if (low.s.mean >= t) break;
    var weak = Object.keys(low.s.avg).sort(function (a, b) { return low.s.avg[a] - low.s.avg[b]; })[0]; removed.push({ name:ps[low.i].name, mean:low.s.mean, weak:PART[weak], reason:'평균 유사도 ' + Math.round(low.s.mean * 10) / 10 + '점이 기준 ' + t + '점보다 낮고, ' + PART[weak] + '이(가) 가장 달라요' }); alive = alive.filter(function (j) { return j !== low.i; }); }
  if (alive.length < 2) { alive.forEach(function (i) { removed.push({ name:ps[i].name, mean:null, weak:null, reason:'함께할 비슷한 사람이 남지 않았어요' }); }); return { formed:false, members:[], removed:removed, avg:null }; }
  var members = alive.map(function (i) { return { name:ps[i].name, mean:stat(i).mean }; }), tot = 0, c = 0; alive.forEach(function (i) { alive.forEach(function (j) { if (i < j) { tot += sim[i][j].score; c++; } }); });
  return { formed:true, members:members, removed:removed, avg:tot / c };
}
/** 공유 보기: 그룹에 들어온 사람들이 서로 보는 정보. 취향·성향·목적·능력은 모두 공유하고, 연령·성별·가족은 본인이 공개한 것만 보이며 나머지는 「비공개」다. */
function sharedView(people) {
  if (!Array.isArray(people) || !people.length) return null; var out = [];
  for (var i = 0; i < people.length; i++) { var p = norm(people[i]); if (!p) return null; var sh = people[i].show || {};
    out.push({ name:p.name, interests:p.interests.join(', '), skills:p.skills.length ? p.skills.join(', ') : '—', purpose:p.purpose, traits:AX.map(function (a, k) { return a[0] + p.traits[k]; }).join(' '), age:sh.age === '공개' && p.age !== null ? p.age + '세' : '비공개', gender:sh.gender === '공개' && p.gender ? p.gender : '비공개', family:sh.family === '공개' && p.family ? p.family : '비공개' }); }
  return out;
}
function cleanP(x) {
  if (!x || typeof x !== 'object') return null; var p = blankP(); p.name = clean(x.name, 20); p.interests = clean(x.interests, 120); p.skills = clean(x.skills, 120); p.purpose = PURP.indexOf(x.purpose) >= 0 ? x.purpose : '';
  AX.forEach(function (a) { var n = Number(x[a[0]]); p[a[0]] = ok(n, 1, 5) && Math.floor(n) === n ? String(n) : ''; }); p.age = clean(x.age, 3); p.gender = GEN.indexOf(x.gender) >= 0 ? x.gender : ''; p.family = FAM.indexOf(x.family) >= 0 ? x.family : '';
  ['age', 'gender', 'family'].forEach(function (k) { p.show[k] = x.show && x.show[k] === '공개' ? '공개' : ''; }); p.id = clean(x.id, 20) || uid(); return p;
}
function load() {
  try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v || typeof v !== 'object') return; var me = cleanP(v.me); if (me) { delete me.id; S.me = me; }
    S.people = (Array.isArray(v.people) ? v.people : []).map(cleanP).filter(function (p) { return p && p.name; }).slice(0, MAXP);
    S.meets = (Array.isArray(v.meets) ? v.meets : []).map(function (g) { var f = fixMeet(g); return f ? { id:clean(g.id, 20) || uid(), title:f.title, purpose:f.purpose, tags:f.tags.join(', '), act:String(f.traits[0]), soc:String(f.traits[1]), plan:String(f.traits[2]), adv:String(f.traits[3]), ageMin:f.ageMin === null ? '' : String(f.ageMin), ageMax:f.ageMax === null ? '' : String(f.ageMax), gender:f.gender } : null; }).filter(Boolean).slice(0, MAXG);
    if (v.thr !== undefined) S.thr = clean(v.thr, 6); } catch (e) {}
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ me:S.me, people:S.people, meets:S.meets, thr:S.thr })); } catch (e) {} }
function fx(n, d) { return n === null || n === undefined || !isFinite(n) ? '—' : (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('ko-KR'); }

function topbar() {
  return h('div', { class:'topin' }, [
    h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 모임' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function notice() {
  return h('div', { class:'note info', style:'margin:16px 0', id:'mt-note', text:'이 화면은 내가 입력한 값으로 비슷한 사람끼리 묶어 보는 모의 계산이에요. 후보 참여자는 내가 직접 적은 가상 사람들이고, 실제 사람들의 프로필 교환과 그룹 구성은 PDV와 연결된 뒤에 가능해요. 거르는 점수는 취향·성향·목적·능력의 유사도로만 계산하고 연령·성별·가족은 넣지 않아요. 모임을 실제로 만들거나 사람을 연결하지 않고, 적은 내용은 이 브라우저에만 저장됩니다.' });
}
var PU = [['', '선택']].concat(PURP.map(function (x) { return [x, x]; })), NUM = [['', '선택']].concat([1, 2, 3, 4, 5].map(function (n) { return [String(n), String(n)]; }));
var SH = [['', '비공개'], ['공개', '공개']];
function opts(a) { return a.map(function (x) { return [x, x || '선택 안 함']; }); }
/** 프로필 입력 칸. 값이 바뀌면 set 으로 알린다. e 는 칸별 오류 문구. */
function profFields(p, pf, e, after) {
  function ch(k) { return function (v) { p[k] = v; if (after) after(); }; }
  var f = [field(pf + 'name', '이름(별명)', p.name, { err:e.name, max:20, set:ch('name') }), field(pf + 'interests', '취향(쉼표로 구분)', p.interests, { err:e.interests, max:120, ph:'예: 걷기, 독서, 사진', set:ch('interests') }), field(pf + 'skills', '능력(쉼표로 구분, 선택)', p.skills, { max:120, ph:'예: 요리, 코딩', set:ch('skills') }), sel(pf + 'purpose', '모임 목적', p.purpose, PU, ch('purpose'))];
  AX.forEach(function (a) { f.push(sel(pf + a[0], a[1], p[a[0]], NUM, ch(a[0]))); });
  f.push(field(pf + 'age', '나이(선택)', p.age, { err:e.age, max:3, mode:'numeric', set:ch('age') }), sel(pf + 'gender', '성별(선택)', p.gender, opts(GEN), ch('gender')), sel(pf + 'family', '가족(선택)', p.family, opts(FAM), ch('family')));
  ['age', 'gender', 'family'].forEach(function (k) { f.push(sel(pf + 'show-' + k, { age:'나이', gender:'성별', family:'가족' }[k] + ' 공개', p.show[k], SH, function (v) { p.show[k] = v; if (after) after(); })); });
  return f;
}
function pErr(p) { var e = {}; if (!clean(p.name, 20)) e.name = '이름을 적어 주세요.'; if (!tags(p.interests).length) e.interests = '취향을 하나 이상 적어 주세요.'; if (p.age !== '' && !ok(numOf(p.age), 0, 120)) e.age = '나이는 0~120 숫자예요.'; return e; }

// ── 내 프로필 ──
var meOut = null;
function updMe() {
  if (!meOut) return; meOut.textContent = ''; var n = norm(S.me);
  if (!n) { meOut.appendChild(h('div', { class:'note', id:'mt-m-none', text:'이름, 취향 한 가지 이상, 모임 목적, 성향 네 가지를 모두 고르면 모임을 추천할 수 있어요.' })); return; }
  meOut.appendChild(h('div', { class:'note info', id:'mt-m-ok', text:'프로필이 준비됐어요. 다른 사람에게는 취향·성향·목적·능력이 공유되고, 나이·성별·가족은 「공개」로 고른 것만 보여요.' }));
}
function viewMe() {
  var kids = head('내 프로필', '취향·성향·목적·능력과 함께 나이·성별·가족을 적어요. 나이·성별·가족은 기본이 비공개예요.'); kids.push(notice());
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('div', { class:'frm' }, profFields(S.me, 'mt-m-', pErr(S.me), function () { save(); updMe(); })), h('div', { class:'sub', text:'성향 네 축은 1~5로 골라요. 적성과 능력은 원래 교육 인프라가 파악해 주는 값인데 아직 연결되지 않아 직접 적어요.' })]));
  meOut = h('div', { id:'mt-m-out', style:'margin-top:16px' }); kids.push(meOut); updMe(); return kids;
}

// ── 모임 추천 ──
function addMeet() {
  var f = S.fg, e = {}, g = fixMeet({ title:f.title, purpose:f.purpose, tags:f.tags, act:f.act, soc:f.soc, plan:f.plan, adv:f.adv, ageMin:f.ageMin, ageMax:f.ageMax, gender:f.gender });
  if (!clean(f.title, 30)) e.title = '모임 이름을 적어 주세요.'; else if (!tags(f.tags).length) e.tags = '모임의 취향(주제)을 하나 이상 적어 주세요.'; else if (!g) e.title = '목적과 성향 네 가지를 고르고, 나이 범위는 0~120(앞이 뒤보다 크지 않게)으로 적어 주세요.'; else if (S.meets.length >= MAXG) e.title = '모임은 최대 ' + MAXG + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); } S.meets.push({ id:uid(), title:g.title, purpose:g.purpose, tags:g.tags.join(', '), act:f.act, soc:f.soc, plan:f.plan, adv:f.adv, ageMin:f.ageMin, ageMax:f.ageMax, gender:g.gender }); S.fg = blankG(); S.msg = '모임을 적어 뒀어요.'; save(); render();
}
function viewMeet() {
  var kids = head('모임 추천', '내 프로필과 모임이 내건 취향·성향·목적이 얼마나 비슷한지 보고, 모임의 참여 조건도 함께 확인합니다.'); kids.push(notice()); var f = S.fg, e = S.err;
  function ch(k) { return function (v) { f[k] = v; }; }
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'후보 모임' }), h('div', { class:'sub', text:'모임이 내건 연령 범위와 성별은 참여 조건이에요. 이 조건이 있으면 참여할 때 그 항목을 공개해야 해요. 점수에는 쓰지 않아요.' }),
    h('div', { class:'frm' }, [field('mt-g-title', '모임 이름', f.title, { err:e.title, max:30, set:ch('title') }), field('mt-g-tags', '주제·취향(쉼표로 구분)', f.tags, { err:e.tags, max:120, ph:'예: 걷기, 사진', set:ch('tags') }), sel('mt-g-purpose', '목적', f.purpose, PU, ch('purpose'))].concat(AX.map(function (a) { return sel('mt-g-' + a[0], '모임 분위기 ' + a[1], f[a[0]], NUM, ch(a[0])); }), [field('mt-g-ageMin', '연령 조건 최소(선택)', f.ageMin, { max:3, mode:'numeric', set:ch('ageMin') }), field('mt-g-ageMax', '연령 조건 최대(선택)', f.ageMax, { max:3, mode:'numeric', set:ch('ageMax') }), sel('mt-g-gender', '성별 조건(선택)', f.gender, opts(GEN), ch('gender'))])),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('모임 추가', 'fill', addMeet), btn('모임 AI에게 묻기', 'quiet', function () { ask('내 취향과 성향에 맞는 모임을 어떻게 찾으면 좋을까요?'); }), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  if (!S.meets.length) { kids.push(empty('아직 후보 모임이 없어요.')); return kids; }
  if (!norm(S.me)) { kids.push(h('div', { class:'note', style:'margin-top:16px', id:'mt-r-nome', text:'먼저 「내 프로필」을 채워 주세요.' })); return kids; }
  var r = recommend(S.me, S.meets); if (!r) return kids;
  kids.push(table(['순위', '모임', '목적', '유사도', '취향', '성향', '목적 일치', '참여'], r.map(function (x, i) { return h('tr', {}, [h('td', { class:'num', text:String(i + 1) }), h('th', { text:x.title }), h('td', { text:x.purpose }), h('td', { class:'num', text:fx(x.score, 1) + '점' }), h('td', { class:'num', text:pc(x.parts.interests) }), h('td', { class:'num', text:pc(x.parts.traits) }), h('td', { text:x.parts.purpose ? '같음' : '다름' }), h('td', { text:x.eligible ? '가능' + (x.needs.length ? '(' + x.needs.join('·') + ' 공개 필요)' : '') : '불가: ' + x.why.join(', ') })]); })));
  kids.push(h('div', { class:'sub', style:'margin-top:8px', id:'mt-r-top', text:'가장 비슷한 모임은 「' + r[0].title + '」(' + fx(r[0].score, 1) + '점)이에요. 유사도는 취향 35%·성향 30%·목적 25%의 단순 계산이라 궁합을 보장하지 않아요.' + (r[0].eligible ? '' : ' 다만 참여 조건을 채우지 못해요.') }));
  kids.push(h('div', { class:'rowf', style:'margin-top:8px' }, S.meets.map(function (g) { return btn(g.title + ' 삭제', 'quiet', function () { S.meets = S.meets.filter(function (y) { return y.id !== g.id; }); save(); render(); }); })));
  return kids;
}

// ── 그룹 구성 ──
function addPerson() {
  var p = S.fp, e = pErr(p), nm = clean(p.name, 20); if (!e.name && nm && (nm === clean(S.me.name, 20) || S.people.some(function (x) { return clean(x.name, 20) === nm; }))) e.name = '같은 이름이 이미 있어요. 다른 이름을 써 주세요.';
  if (!Object.keys(e).length && !norm(p)) e.name = '목적과 성향 네 가지를 모두 골라 주세요.'; if (!Object.keys(e).length && S.people.length >= MAXP) e.name = '후보는 최대 ' + MAXP + '명까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); } var c = cleanP(p); S.people.push(c); S.fp = blankP(); S.msg = '후보를 적어 뒀어요.'; save(); render();
}
var gOut = null;
function updG() {
  if (!gOut) return; gOut.textContent = ''; S.last = null; var me = norm(S.me);
  if (!me) { gOut.appendChild(h('div', { class:'note', id:'mt-g-nome', text:'먼저 「내 프로필」을 채워 주세요. 나도 후보에 들어가요.' })); return; }
  if (!S.people.length) { gOut.appendChild(h('div', { class:'note', id:'mt-g-nop', text:'후보를 한 명 이상 적어 주세요.' })); return; }
  var all = [S.me].concat(S.people), r = formGroup(all, S.thr); if (!r) { gOut.appendChild(h('div', { class:'note', id:'mt-g-bad', text:'걸러 낼 기준 점수는 0~100이어야 하고 모든 후보의 프로필이 완성돼야 해요.' })); return; } S.last = { r:r, all:all };
  gOut.appendChild(h('div', { class:'g2' }, [tile('남은 사람', r.formed ? r.members.length + '명' : '그룹 없음', '후보 ' + all.length + '명 중', 'mt-g-n'), tile('평균 유사도', r.formed ? fx(r.avg, 1) + '점' : '—', '남은 사람끼리', 'mt-g-avg'), tile('걸러진 사람', r.removed.length + '명', '기준 ' + S.thr + '점 미만', 'mt-g-rm')]));
  if (r.formed) gOut.appendChild(table(['남은 사람', '다른 사람과의 평균 유사도'], r.members.map(function (m) { return h('tr', {}, [h('th', { text:m.name + (m.name === me.name ? '(나)' : '') }), h('td', { class:'num', text:fx(m.mean, 1) + '점' })]); })));
  else gOut.appendChild(h('div', { class:'note', id:'mt-g-none', text:'기준을 넘는 그룹이 만들어지지 않았어요. 기준 점수를 낮추거나 후보를 더 적어 보세요.' }));
  if (r.removed.length) gOut.appendChild(table(['걸러진 사람', '사유'], r.removed.map(function (m) { return h('tr', {}, [h('th', { text:m.name + (m.name === me.name ? '(나)' : '') }), h('td', { text:m.reason })]); })));
}
function viewGroup() {
  var kids = head('그룹 구성', '후보 가운데 서로 이질적인 사람을 걸러 내고, 취향·성향·목적이 비슷한 사람끼리 그룹을 만듭니다.'); kids.push(notice()); var p = S.fp, e = S.err;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'후보 참여자(가상)' }), h('div', { class:'sub', text:'나는 자동으로 후보에 들어가요. 거르는 점수는 취향·성향·목적·능력만 써요.' }), h('div', { class:'frm' }, profFields(p, 'mt-p-', e)), h('div', { class:'rowf', style:'margin-top:8px' }, [btn('후보 추가', 'fill', addPerson), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  if (S.people.length) kids.push(table(['후보', '목적', '취향', ''], S.people.map(function (x) { return h('tr', {}, [h('th', { text:x.name }), h('td', { text:x.purpose }), h('td', { text:x.interests }), h('td', {}, [btn('삭제', 'quiet', function () { S.people = S.people.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]); })));
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [field('mt-t', '걸러 낼 기준 점수(0~100)', S.thr, { max:6, mode:'decimal', help:'평균 유사도가 이 점수 미만인 사람부터 빼요.', set:function (v) { S.thr = clean(v, 6); save(); updG(); } })]));
  gOut = h('div', { id:'mt-g-out', style:'margin-top:16px' }); kids.push(gOut); updG(); return kids;
}

// ── 성향 공유 ──
function viewShare() {
  var kids = head('성향 공유', '그룹에 들어온 사람들이 서로 보게 되는 정보예요. 나이·성별·가족은 본인이 공개한 것만 보여요.'); kids.push(notice()); var me = norm(S.me);
  if (!me || !S.people.length) return kids.concat([empty('「내 프로필」과 「그룹 구성」에서 나와 후보를 먼저 적어 주세요.')]);
  var r = formGroup([S.me].concat(S.people), S.thr); if (!r) return kids.concat([empty('걸러 낼 기준 점수와 프로필을 확인해 주세요.')]); if (!r.formed) return kids.concat([h('div', { class:'note', style:'margin-top:16px', id:'mt-s-none', text:'아직 그룹이 만들어지지 않았어요. 「그룹 구성」에서 기준을 조정해 주세요.' })]);
  var by = {}; [S.me].concat(S.people).forEach(function (p) { by[clean(p.name, 20)] = p; }); var rows = sharedView(r.members.map(function (m) { return by[m.name]; }));
  kids.push(table(['이름', '목적', '취향', '능력', '성향(1~5)', '나이', '성별', '가족'], rows.map(function (x) { return h('tr', {}, [h('th', { text:x.name }), h('td', { text:x.purpose }), h('td', { text:x.interests }), h('td', { text:x.skills }), h('td', { text:x.traits }), h('td', { text:x.age }), h('td', { text:x.gender }), h('td', { text:x.family })]); })));
  kids.push(h('div', { class:'sub', style:'margin-top:8px', id:'mt-s-sum', text:'성향 축 표기: act 활동성, soc 사교성, plan 계획성, adv 모험성. 「비공개」는 그 사람이 공개하지 않기로 한 항목이에요.' }));
  return kids;
}

// ── 모임 원리 ──
function viewPrinciple() {
  var kids = head('모임 원리', '사람은 사회적 동물이라 비슷한 사람끼리 모일 때 오래 가요.'); kids.push(notice());
  kids.push(stepsCard('모임이 만들어지는 순서', [['나를 알려요', '적성·취향·능력과 연령·성별·가족을 종합해 프로필을 만들어요.'], ['알맞은 모임을 추천받아요', '모임이 내건 목적·취향·성향과 내 프로필이 얼마나 비슷한지 봐요.'], ['서로 성향을 공유해요', '참여자는 자신을 포함해 서로의 성향을 공유해요.'], ['이질적인 멤버를 걸러 내요', '취향·성향·목적이 실제로 비슷한 사람끼리 그룹을 이뤄요.']], '이 화면은 가상 후보로 시험하고, 실제 사람 사이의 교환은 PDV와 연결된 뒤에 가능해요.'));
  kids.push(table(['설계 약속', '내용'], rows2([['점수에 쓰는 것', '취향 35%·성향 30%·목적 25%·능력 10%의 유사도만 써요.'], ['쓰지 않는 것', '연령·성별·가족은 점수에 넣지 않아요. 사람을 그런 속성으로 걸러 내지 않기 위해서예요.'], ['공개', '연령·성별·가족은 기본이 비공개이고 본인이 항목별로 공개를 골라요.'], ['모임의 조건', '모임이 직접 내건 연령 범위·성별만 참여 가능 여부에 쓰고, 그때는 그 항목을 공개해야 해요.'], ['걸러진 이유', '기준 점수와 가장 다른 부분(취향·성향·목적·능력)을 보여 줘요.']])));
  kids.push(table(['한계', '내용'], rows2([['궁합', '유사도는 단순한 규칙이라 사람 사이의 궁합이나 모임의 성공을 예측하지 않아요.'], ['다양성', '비슷한 사람끼리만 모이면 관점이 좁아질 수 있어요. 기준 점수를 낮춰 폭을 조절하세요.'], ['안전', '낯선 사람과의 오프라인 만남은 공개된 장소에서, 지인에게 알리고 하세요.'], ['실행', '모임을 만들거나 사람을 연결·초대하지 않아요.']])));
  kids.push(h('div', { class:'rowf', style:'margin-top:12px' }, [btn('모임 AI에게 묻기', 'quiet', function () { ask('취향이 비슷한 사람끼리 모이면서도 관점이 좁아지지 않게 하려면 어떻게 하죠?'); })]));
  return kids;
}

function render() {
  var root = $('mt-root'), tp = $('mt-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar()); meOut = null; gOut = null;
  var kids = S.view === 'meet' ? viewMeet() : S.view === 'group' ? viewGroup() : S.view === 'share' ? viewShare() : S.view === 'principle' ? viewPrinciple() : viewMe();
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
  M = el; el.textContent = ''; el.classList.add('mtg'); S.me = blankP(); S.people = []; S.meets = []; S.thr = '60'; S.fp = blankP(); S.fg = blankG(); S.last = null; S.err = {}; S.msg = ''; load();
  [h('div', { id:'mt-top' }), h('div', { class:'wrap', id:'mt-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'me'; render();
}
window.NaviMeet = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  similarity:similarity, recommend:recommend, formGroup:formGroup, sharedView:sharedView,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
