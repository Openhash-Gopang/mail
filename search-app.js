/* search-app.js — 나비웹 검색(인프라 AI · 검색). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviSearch.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 search.css(.sch 범위). 전역은 NaviSearch 하나만 쓴다.
 *
 * 검색 화면의 특징(주피터 지시, 설계 원칙): 검색은 구글·네이버·다음 같은 사기업이 장악한 검색 시장을 오픈소스 검색 엔진과 데이터베이스로 대체하려는 시도다.
 * 지금은 한국 시민의 모든 정보가 사기업 서버에 무차별로 수집·보관·가공되고 있고 AI 시대에 그 정도는 더 심해진다.
 *  - 나비웹은 오픈소스 LLM 기반이고, 모든 데이터는 사용자 본인이 저장한다(PDV).
 *  - 나비웹 검색 엔진에는 ① 익명화된 데이터 ② 사용자가 공개에 동의한 데이터 ③ 통계 정보만 등록한다.
 *  - 나비웹 안에서 만들어지고 오가는 모든 데이터는 특정 기업이 아니라 나비웹 공동체가 함께 소유하고 함께 관리한다.
 *  - 목표: 오픈소스 검색 엔진과 오픈소스 LLM 위에 대규모 데이터베이스를 쌓고, 나비웹 커뮤니티가 관리하는 시스템.
 * 확정한 운영 원칙(기본값): 1단계 범위는 나비웹 안의 데이터(바깥 웹 색인은 2단계) · 익명성은 같은 조건의 집단이 10명 이상일 때만 · 공개 동의를 철회하면 색인에서 삭제(이미 합산된 통계는 개인이 식별되지 않으므로 유지) ·
 *  공동 관리는 나비웹 공익 법인·위원회 구조를 따른다 · 공동 소유 데이터의 이용 라이선스는 '미정'.
 * 이 화면은 기록·점검·계산만 한다: searchLocal(내가 공개한 것만 찾기) · kAnon(익명성 점검) · findPII(개인정보 점검).
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 검색 엔진·대규모 데이터베이스·커뮤니티 관리 시스템은 아직 연결되어 있지 않다(설계 단계). 이 화면은 어떤 정보도 밖으로 보내지 않고 검색 엔진에 등록하지 않는다.
 *  - '검색하기'는 이 화면에서 내가 적어 둔 공개·익명 항목 안에서만 찾는 것이며 나비웹 전체 검색이 아니다. 기록은 이 브라우저(localStorage)에만 저장된다. */
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
var KEY = 'navi-search-v1', MAXI = 100, MAXL = 200, MAXP = 30, DEFK = 10;
var TABS = [['find', '검색하기'], ['share', '내 데이터 공개'], ['rules', '등록 기준'], ['govern', '공동 관리'], ['engine', '엔진·데이터베이스'], ['principle', '검색 원리']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var SCOPES = ['비공개', '익명화', '공개 동의'];
var M = null, LS = {};
var S = { view:'find', items:[], log:[], props:[], k:DEFK, q:'', err:{}, msg:'',
  sh:{ name:'', summary:'', scope:'비공개' }, ck:{ counts:'', text:'' }, pr:{ title:'', body:'' } };

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
    h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 검색' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function notice() {
  return h('div', { class:'note info', style:'margin:16px 0', id:'sc-note', text:'이 화면은 검색 엔진에 아무것도 등록하지 않고 어떤 정보도 밖으로 보내지 않습니다. 적어 둔 내용은 이 브라우저에만 저장돼요. 검색 엔진과 대규모 데이터베이스는 아직 연결되어 있지 않고 설계 단계입니다.' });
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
    S.items = (Array.isArray(v.items) ? v.items : []).map(fixI).filter(Boolean).slice(0, MAXI);
    S.log = (Array.isArray(v.log) ? v.log : []).map(fixL).filter(Boolean).slice(0, MAXL);
    S.props = (Array.isArray(v.props) ? v.props : []).map(fixP).filter(Boolean).slice(0, MAXP);
    var k = Number(v.k); if (k >= 2 && k <= 1000 && Math.floor(k) === k) S.k = k; } catch (e) {}
}
function fixI(x) { if (!x || typeof x !== 'object' || SCOPES.indexOf(x.scope) < 0) return null; var name = clean(x.name, 40), sum = clean(x.summary, 200); if (!name) return null; return { id:clean(x.id, 20) || uid(), name:name, summary:sum, scope:x.scope }; }
function fixL(x) { if (!x || typeof x !== 'object' || SCOPES.indexOf(x.to) < 0) return null; var name = clean(x.name, 40); if (!name) return null; return { d:/^\d{4}-\d{2}-\d{2}$/.test(x.d) ? x.d : '', name:name, from:SCOPES.indexOf(x.from) >= 0 ? x.from : '', to:x.to }; }
function fixP(x) { if (!x || typeof x !== 'object') return null; var t = clean(x.title, 60), b = clean(x.body, 400); if (!t) return null; return { id:clean(x.id, 20) || uid(), title:t, body:b, d:/^\d{4}-\d{2}-\d{2}$/.test(x.d) ? x.d : '' }; }
function save() { try { localStorage.setItem(KEY, JSON.stringify({ items:S.items, log:S.log, props:S.props, k:S.k })); } catch (e) {} }

/** 내가 공개한 항목(익명화·공개 동의)에서만 찾는다. 비공개 항목은 결과에 나오지 않는다. 띄어쓰기·대소문자 무시. */
function searchLocal(items, q) {
  var t = String(q == null ? '' : q).replace(/\s+/g, '').toLowerCase(); if (!t || t.length > 60) return null;
  return (items || []).filter(function (x) { return x && x.scope !== '비공개' && (String(x.name || '') + String(x.summary || '')).replace(/\s+/g, '').toLowerCase().indexOf(t) >= 0; })
    .map(function (x) { return { id:x.id, name:x.name, summary:x.summary, scope:x.scope, kind:x.scope === '익명화' ? '익명 자료' : '공개 동의 자료' }; });
}
/** 익명성 점검: 같은 조건을 가진 집단들의 사람 수 목록. 가장 작은 집단이 k 명 이상이어야 등록할 수 있다. */
function kAnon(counts, k) {
  var kk = numOf(k), a = (counts || []).map(numOf);
  if (!isFinite(kk) || kk < 2 || kk > 1000 || Math.floor(kk) !== kk || !a.length || a.length > 500 || a.some(function (x) { return !isFinite(x) || x < 1 || Math.floor(x) !== x || x > 1e9; })) return null;
  var min = Math.min.apply(null, a), small = a.filter(function (x) { return x < kk; });
  return { min:min, k:kk, ok:small.length === 0, small:small.length, total:a.length };
}
/** 개인정보 점검: 주민등록번호·전화번호·이메일이 들어 있는지. 빈 값이면 null. */
function findPII(text) {
  var t = String(text == null ? '' : text); if (!t.trim()) return null; var out = [];
  if (/\d{6}-?[1-4]\d{6}/.test(t)) out.push('주민등록번호'); if (/01\d[-\s]?\d{3,4}[-\s]?\d{4}/.test(t)) out.push('전화번호'); if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(t)) out.push('이메일');
  return out;
}

// ── 검색하기 ──
function viewFind() {
  var kids = head('검색하기', '나비웹 안에서 공개 동의했거나 익명화된 자료, 통계를 찾습니다. 비공개 자료는 어디에도 나오지 않아요.'); kids.push(notice());
  var out = h('div', { id:'sc-f-out', style:'margin-top:12px' });
  function upd() { out.textContent = ''; var r = searchLocal(S.items, S.q);
    if (r === null) { out.appendChild(h('div', { class:'sub', text:'찾을 말을 넣어 주세요.' })); return; }
    out.appendChild(r.length ? table(['자료', '구분', '요약'], r.map(function (x) { return h('tr', {}, [h('td', {}, [h('b', { text:x.name })]), h('td', {}, [pill(x.kind, '')]), h('td', { text:x.summary })]); })) : h('div', { id:'sc-f-none', class:'note', text:'이 화면에 공개로 적어 둔 자료 중에는 없어요. 나비웹 전체 검색은 엔진이 연결되면 쓸 수 있어요.' })); }
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [field('sc-f-q', '찾을 말', S.q, { max:60, ph:'예: 한림 감귤 농원', help:'내가 「내 데이터 공개」에 적어 둔 공개·익명 자료 안에서 찾아요', set:function (v) { S.q = v; upd(); } }),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('검색 AI에게 묻기', 'quiet', function () { ask(S.q.trim() ? S.q.trim() + ' 에 대해 나비웹에서 찾을 수 있는 공개 자료와 통계를 알려 주세요.' : '나비웹 검색에서는 어떤 자료를 찾을 수 있나요?'); })]), out]));
  kids.push(h('div', { class:'g2', style:'margin-top:16px' }, [tile('공개·익명 자료', S.items.filter(function (x) { return x.scope !== '비공개'; }).length + '건', '검색에서 찾을 수 있는 것', 'sc-n'), tile('비공개 자료', S.items.filter(function (x) { return x.scope === '비공개'; }).length + '건', '나만 볼 수 있는 것', 'sc-priv')]));
  upd(); return kids;
}

// ── 내 데이터 공개 ──
function setScope(x, to) { if (x.scope === to) return; S.log.unshift({ d:kst(), name:x.name, from:x.scope, to:to }); S.log = S.log.slice(0, MAXL); x.scope = to; save(); render(); }
function addItem() {
  var f = S.sh, e = {}, name = clean(f.name, 40), sum = clean(f.summary, 200), pii = findPII(name + ' ' + sum);
  if (!name) e.name = '자료 이름을 적어 주세요.'; if (S.items.length >= MAXI) e.name = '최대 ' + MAXI + '건까지예요.';
  if (f.scope !== '비공개' && pii && pii.length) e.summary = pii.join('·') + '가 들어 있어요. 지우거나 비공개로 두세요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  var it = { id:uid(), name:name, summary:sum, scope:f.scope }; S.items.unshift(it); S.log.unshift({ d:kst(), name:name, from:'', to:f.scope }); S.log = S.log.slice(0, MAXL); f.name = ''; f.summary = ''; f.scope = '비공개';
  S.msg = it.scope === '비공개' ? '비공개로 적어 뒀어요.' : '적어 뒀어요. 검색 엔진에는 아직 등록되지 않아요.'; save(); render();
}
function viewShare() {
  var kids = head('내 데이터 공개', '내 데이터는 내가 저장하고, 무엇을 얼마나 공개할지도 내가 정합니다. 처음에는 모두 비공개예요.'); kids.push(notice());
  var f = S.sh, e = S.err;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('div', { class:'frm' }, [
    field('sc-s-name', '자료 이름', f.name, { err:e.name, max:40, ph:'예: 우리 농원 소개', set:function (v) { f.name = v; } }),
    sel('sc-s-scope', '공개 범위', f.scope, SCOPES.map(function (c) { return [c, c]; }), function (v) { f.scope = v; })]),
    field('sc-s-sum', '요약(검색에 보이는 글)', f.summary, { area:true, err:e.summary, max:200, ph:'공개해도 되는 내용만 적어요. 개인정보는 적지 마세요.', set:function (v) { f.summary = v; } }),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('적어 두기', 'fill', addItem), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  kids.push(stepsCard('공개 범위 세 가지', [['비공개', '나만 볼 수 있어요. 검색 엔진에 등록되지 않아요.'], ['익명화', '누구의 것인지 알 수 없게 바꾼 자료만 등록돼요. 같은 조건의 집단이 충분히 클 때만 가능해요.'], ['공개 동의', '내가 공개에 동의한 자료로 등록돼요. 언제든 비공개로 바꾸면 색인에서 삭제돼요.']]));
  if (!S.items.length) kids.push(empty('아직 적어 둔 자료가 없어요.'));
  else kids.push(table(['자료', '공개 범위', ''], S.items.map(function (x) {
    var s = h('select', { 'aria-label':x.name + ' 공개 범위' }, SCOPES.map(function (c) { return h('option', { value:c, text:c }); })); s.value = x.scope;
    s.onchange = function () { var to = s.value, pii = findPII(x.name + ' ' + x.summary); if (to !== '비공개' && pii && pii.length) { s.value = x.scope; S.err = { summary:pii.join('·') + '가 들어 있는 자료는 공개로 바꿀 수 없어요.' }; S.msg = ''; return render(); } setScope(x, to); };
    return h('tr', {}, [h('td', {}, [h('b', { text:x.name }), h('div', { class:'sub', text:x.summary })]), h('td', {}, [s]), h('td', {}, [btn('삭제', 'quiet', function () { S.log.unshift({ d:kst(), name:x.name, from:x.scope, to:'비공개' }); S.items = S.items.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]); })));
  if (S.log.length) kids.push(table(['날짜', '자료', '바뀐 범위'], S.log.slice(0, 20).map(function (l) { return h('tr', {}, [h('td', { class:'num', text:l.d }), h('td', { text:l.name }), h('td', { text:(l.from ? l.from + ' → ' : '') + l.to })]); })));
  if (S.err.summary && !S.items.length) kids.push(h('div', { class:'note', role:'alert', text:S.err.summary }));
  else if (S.err.summary && S.view === 'share') kids.push(h('div', { class:'note', role:'alert', style:'margin-top:12px', text:S.err.summary }));
  return kids;
}

// ── 등록 기준 ──
function viewRules() {
  var kids = head('등록 기준', '검색 엔진에는 세 가지만 등록됩니다. 그 밖의 데이터는 내 PDV 안에만 있어요.'); kids.push(notice());
  kids.push(table(['등록되는 것', '조건'], [['익명화된 데이터', '누구의 것인지 알 수 없고, 같은 조건의 집단이 ' + S.k + '명 이상'], ['내가 공개에 동의한 데이터', '내가 직접 공개 동의를 고른 자료. 철회하면 색인에서 삭제'], ['통계 정보', '여러 사람을 합쳐 개인이 드러나지 않는 수치']].map(function (r) { return h('tr', {}, [h('th', { text:r[0] }), h('td', { text:r[1] })]); })));
  kids.push(h('div', { class:'note', style:'margin-top:12px', text:'주민등록번호·전화번호·이메일 같은 개인정보와, 내가 비공개로 둔 데이터는 어떤 경우에도 등록되지 않아요.' }));
  var f = S.ck, out = h('div', { id:'sc-r-out', style:'margin-top:12px' }), pout = h('div', { id:'sc-r-pii', style:'margin-top:12px' });
  function upd() { out.textContent = ''; pout.textContent = '';
    var r = kAnon(f.counts.split(/[\s,]+/).filter(Boolean), S.k);
    out.appendChild(!r ? h('div', { class:'sub', text:'같은 조건을 가진 집단의 사람 수를 쉼표로 구분해 넣어 주세요(예: 24, 31, 8).' }) : h('div', {}, [h('div', { class:'g2' }, [tile('가장 작은 집단', r.min + '명', '기준 ' + r.k + '명 이상', 'sc-r-min'), tile('기준에 못 미치는 집단', r.small + '개', '전체 ' + r.total + '개 중', 'sc-r-small')]),
      h('div', { id:'sc-r-res', class:r.ok ? 'note info' : 'note', style:'margin-top:12px', text:r.ok ? '모든 집단이 기준을 넘어요. 익명 자료나 통계로 등록할 수 있어요.' : '기준에 못 미치는 집단이 ' + r.small + '개 있어요. 조건을 넓혀 집단을 합치거나 등록하지 마세요.' })]));
    var p = findPII(f.text); pout.appendChild(p === null ? h('div', { class:'sub', text:'등록하려는 글을 넣으면 개인정보가 들어 있는지 점검해요.' }) : h('div', { id:'sc-r-piires', class:p.length ? 'note' : 'note info', text:p.length ? p.join('·') + '가 들어 있어요. 지운 뒤에 등록하세요.' : '주민등록번호·전화번호·이메일은 보이지 않아요. 이름이나 주소처럼 사람을 알아볼 수 있는 내용이 없는지는 직접 한 번 더 확인해 주세요.' })); }
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'익명성 점검' }), h('div', { class:'frm' }, [field('sc-r-counts', '집단별 사람 수(쉼표로 구분)', f.counts, { max:300, ph:'예: 24, 31, 8', help:'예: 제주시·40대·농업 조건의 사람 수', set:function (v) { f.counts = v; upd(); } }),
    field('sc-r-k', '최소 집단 크기(기본 ' + DEFK + ')', String(S.k), { mode:'numeric', max:4, set:function (v) { var n = numOf(v); if (isFinite(n) && n >= 2 && n <= 1000 && Math.floor(n) === n) { S.k = n; save(); upd(); } } })]), out]));
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'개인정보 점검' }), field('sc-r-text', '등록하려는 글', f.text, { area:true, max:600, set:function (v) { f.text = v; upd(); } }), pout]));
  upd(); return kids;
}

// ── 공동 관리 ──
function addProp() {
  var f = S.pr, e = {}, t = clean(f.title, 60), b = clean(f.body, 400);
  if (!t) e.title = '제안 제목을 적어 주세요.'; if (S.props.length >= MAXP) e.title = '최대 ' + MAXP + '건까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  S.props.unshift({ id:uid(), title:t, body:b, d:kst() }); f.title = ''; f.body = ''; S.msg = '제안을 적어 뒀어요. 아직 아무에게도 보내지 않았어요.'; save(); render();
}
function viewGovern() {
  var kids = head('공동 관리', '나비웹 안에서 만들어지고 오가는 데이터는 특정 기업이 아니라 나비웹 공동체가 함께 소유하고 함께 관리합니다.'); kids.push(notice());
  kids.push(table(['원칙', '내용'], [['공동 소유', '나비웹 안의 공개 데이터는 어느 한 기업의 것이 아니라 나비웹 공동체의 것이에요.'], ['공동 관리', '나비웹 공익 법인과 위원회의 구조를 따라요. 검색 데이터 관리의 세부 규칙은 초안 단계예요.'], ['투명성', '무엇이 언제 등록되고 삭제됐는지 이력을 공개하는 것을 목표로 해요.'], ['이용 조건', '공동 소유 데이터의 이용 라이선스는 아직 정하지 않았어요(미정).']].map(function (r) { return h('tr', {}, [h('th', { text:r[0] }), h('td', { text:r[1] })]); })));
  var f = S.pr, e = S.err;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'관리 규칙 제안 적어 두기' }), h('div', { class:'sub', text:'커뮤니티 제안과 투표가 연결되면 여기서 낼 수 있어요. 지금은 적어 두기만 해요.' }),
    h('div', { class:'frm' }, [field('sc-g-title', '제안 제목', f.title, { err:e.title, max:60, ph:'예: 최소 집단 크기를 20으로 올리자', set:function (v) { f.title = v; } })]),
    field('sc-g-body', '내용', f.body, { area:true, max:400, set:function (v) { f.body = v; } }),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('제안 적어 두기', 'fill', addProp), btn('검색 AI에게 묻기', 'quiet', function () { ask('나비웹 공동체가 검색 데이터를 함께 관리하려면 어떤 규칙이 필요한가요?'); }), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  if (S.props.length) kids.push(table(['제안', '날짜', ''], S.props.map(function (x) { return h('tr', {}, [h('td', {}, [h('b', { text:x.title }), h('div', { class:'sub', text:x.body })]), h('td', { class:'num', text:x.d }), h('td', {}, [btn('삭제', 'quiet', function () { S.props = S.props.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]); })));
  return kids;
}

// ── 엔진·데이터베이스 ──
function viewEngine() {
  var kids = head('엔진·데이터베이스', '오픈소스 검색 엔진과 오픈소스 LLM 위에 대규모 데이터베이스를 쌓고, 나비웹 커뮤니티가 관리하는 시스템을 만듭니다.'); kids.push(notice());
  kids.push(table(['구성', '역할', '지금'], [['오픈소스 검색 엔진', '등록된 자료를 색인하고 찾아 줘요', '설계 단계'], ['오픈소스 LLM', '질문을 이해하고 결과를 요약·설명해요', '나비웹 대화는 사용 중, 검색에는 미연결'], ['대규모 데이터베이스', '익명·공개 동의·통계 자료를 보관해요', '설계 단계'], ['등록 점검', '개인정보와 익명성 기준을 확인해 등록을 걸러요', '이 화면에서 점검만 가능'], ['커뮤니티 관리', '등록·삭제 규칙을 공동체가 정하고 이력을 공개해요', '설계 단계']].map(function (r) { return h('tr', {}, r.map(function (t, i) { return h(i ? 'td' : 'th', { text:t }); })); })));
  kids.push(stepsCard('만들어 가는 순서', [['1단계 — 나비웹 안의 데이터', '프로필·서비스·공개 동의 자료·통계만 검색해요. 홈의 「주소」 검색도 이것을 출처로 삼아요.'], ['2단계 — 바깥 웹 색인', '오픈소스 방식으로 바깥 웹을 색인할지, 어떤 범위로 할지 따로 정해요.'], ['3단계 — 커뮤니티 운영', '등록·삭제 규칙과 이력을 나비웹 커뮤니티가 직접 관리해요.']], '지금은 1단계의 설계 중이에요. 엔진 후보와 규모, 비용은 구현을 시작할 때 정해요.'));
  return kids;
}

// ── 검색 원리 ──
function viewPrinciple() {
  var kids = head('검색 원리', '내 정보가 사기업 서버에 쌓이는 검색에서, 내가 저장하고 공동체가 관리하는 검색으로 바꿉니다.');
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'왜 바꾸나요' }),
    h('p', { text:'지금은 한국 시민의 정보가 구글과 네이버 같은 사기업의 서버에 무차별적으로 수집·보관·가공되고 있어요. AI 시대에는 그 정도가 더 깊어집니다.' }),
    h('p', { text:'나비웹은 오픈소스 LLM으로 움직이고, 모든 데이터는 사용자가 직접 저장해요. 검색 엔진에는 익명화됐거나 내가 공개에 동의한 데이터, 통계만 올라가요.' })]));
  kids.push(table(['', '사기업 검색', '나비웹 검색'], [['데이터가 있는 곳', '기업 서버', '사용자 본인의 PDV'], ['수집 대상', '가능한 모든 활동', '익명화·공개 동의·통계만'], ['소유', '기업', '나비웹 공동체'], ['관리', '기업의 정책', '커뮤니티와 공익 법인·위원회'], ['엔진', '비공개 기술', '오픈소스 검색 엔진과 LLM']].map(function (r) { return h('tr', {}, r.map(function (t, i) { return h(i ? 'td' : 'th', { text:t }); })); })));
  kids.push(h('div', { class:'note info', style:'margin-top:16px', text:'나비웹 안에서 만들어지고 오가는 모든 데이터는 특정 기업이 아니라 나비웹 공동체의 공동 소유·공동 관리 대상입니다. 검색 엔진과 데이터베이스는 아직 연결되지 않은 설계 단계예요.' }));
  return kids;
}

function render() {
  var root = $('sc-root'), tp = $('sc-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = S.view === 'share' ? viewShare() : S.view === 'rules' ? viewRules() : S.view === 'govern' ? viewGovern() : S.view === 'engine' ? viewEngine() : S.view === 'principle' ? viewPrinciple() : viewFind();
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
  M = el; el.textContent = ''; el.classList.add('sch'); S.items = []; S.log = []; S.props = []; S.k = DEFK; S.err = {}; S.msg = ''; S.q = ''; load();
  [h('div', { id:'sc-top' }), h('div', { class:'wrap', id:'sc-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'find'; render();
}
window.NaviSearch = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  searchLocal:searchLocal, kAnon:kAnon, findPII:findPII,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
