/* public-app.js — 나비웹 행정(인프라 AI · 행정). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviPublic.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 public.css(.pub 범위). 전역은 NaviPublic 하나만 쓴다.
 *
 * 행정 화면의 특징(주피터 지시, 설계 원칙): 행정 인프라는 나비웹 도우미의 최종판이다. 일본이 도장을 대신 찍어 주는 로봇을 만들었듯,
 * 기관의 사람용 화면을 그대로 두고 사용자 대신 서류를 채워 주는 것은 '도장 찍는 로봇'과 같다. 행정 인프라는 이것을 대체한다.
 *  - 지금: 나비웹 도우미가 사용자를 대신해 입법·사법·행정 기관 사이트에 가서(로그인은 사용자) 서류를 찾고 필드를 채운다.
 *    사용자는 최종 확인·동의 버튼만 누르고, 결제는 직접 한다.
 *  - 목표: 사용자의 AI 비서와 기관의 AI 비서가 handshake 로 서로 신원을 인증한 뒤, 기관이 요구하는 서류를 사용자 AI 비서가 데이터로 전송한다.
 *    동의와 수수료 결제도 사용자가 위임한 범위 안에서 비서가 수행하고 사용자는 승인만 한다.
 * 이 화면은 계산·기록만 한다: matchDocs(요구 서류와 내가 가진 서류 대조).
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 이 화면은 기관 사이트에 접속하거나 서류를 제출·결제하지 않고 어떤 정보도 밖으로 보내지 않는다. 실제 대행은 나비웹 도우미가 기관 사이트에서 사용자의 승인을 받아 한다.
 *  - 연결된 기관 AI 는 아직 없다(handshake 는 설계 단계). 위임 규칙은 아직 효력이 없다. 모든 기록은 이 브라우저(localStorage)에만 저장된다. */
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
function numOf(v) { var s = String(v == null ? '' : v).replace(/[,\s원]/g, ''); if (s === '' || !/^\d*\.?\d+$|^\d+\.?$/.test(s)) return NaN; return Number(s); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function clean(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }

// ── 저장 ──
var KEY = 'navi-public-v1', MAXI = 100, MAXR = 30;
var TABS = [['home', '내 행정'], ['request', '대행 요청'], ['principle', '대행 원리'], ['connect', '기관 AI 연결'], ['delegate', '위임·동의'], ['log', '제출 기록']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var KINDS = ['입법', '사법', '행정'];
var STATES = ['준비', '서류 확인', '제출 완료', '보완 요청'];
var M = null, LS = {};
var S = { view:'home', items:[], rules:[], err:{}, msg:'',
  rq:{ kind:'사법', org:'', goal:'', docs:'' }, hs:{ req:'', held:'' }, dl:{ org:'', limit:'', until:'' } };

function field(id, label, val, o) {
  o = o || {}; var e = o.err, inp = h('input', { id:id, type:'text', value:val == null ? '' : val, placeholder:o.ph || '', maxlength:o.max || '60', inputmode:o.mode || '', autocomplete:'off', 'aria-invalid':e ? 'true' : 'false' });
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
    h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 행정' })]), h('button', { type:'button', class:'btn quiet simbtn', id:'pub-sim', text:'시뮬레이션', 'aria-label':'가상 데이터로 시뮬레이션', onclick:function () { if (window._simOpen) window._simOpen('pub', S.view === 'all' ? 'profile' : S.view); } })]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function notice() {
  return h('div', { class:'note info', style:'margin:16px 0', id:'pb-note', text:'이 화면은 기관 사이트에 접속하거나 서류를 제출·결제하지 않고 어떤 정보도 밖으로 보내지 않습니다. 적어 둔 내용은 이 브라우저에만 저장돼요. 실제 대행은 나비웹 도우미가 기관 사이트에서 내 승인을 받아 합니다.' });
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
    S.rules = (Array.isArray(v.rules) ? v.rules : []).map(fixR).filter(Boolean).slice(0, MAXR); } catch (e) {}
}
function fixI(x) {
  if (!x || typeof x !== 'object' || KINDS.indexOf(x.kind) < 0 || STATES.indexOf(x.st) < 0) return null;
  var org = clean(x.org, 40), goal = clean(x.goal, 80); if (!org || !goal) return null;
  return { id:clean(x.id, 20) || uid(), kind:x.kind, org:org, goal:goal, docs:clean(x.docs, 200), st:x.st, d:/^\d{4}-\d{2}-\d{2}$/.test(x.d) ? x.d : '', no:clean(x.no, 30) };
}
function fixR(x) {
  if (!x || typeof x !== 'object') return null;
  var org = clean(x.org, 40), lim = Number(x.limit); if (!org || !isFinite(lim) || lim < 0 || lim > 1e9) return null;
  return { id:clean(x.id, 20) || uid(), org:org, limit:Math.round(lim), until:/^\d{4}-\d{2}-\d{2}$/.test(x.until) ? x.until : '' };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ items:S.items, rules:S.rules })); } catch (e) {} }

/** 요구 서류와 내가 가진 서류 대조(쉼표·줄바꿈으로 구분, 띄어쓰기·대소문자 무시). 요구 서류가 없으면 null. */
function matchDocs(req, held) {
  function list(v) { var seen = {}, out = []; String(v == null ? '' : v).split(/[,\n]+/).forEach(function (s) { var t = clean(s, 40), k = t.replace(/\s+/g, '').toLowerCase(); if (t && !seen[k]) { seen[k] = 1; out.push({ t:t, k:k }); } }); return out; }
  var r = list(req), hd = list(held); if (!r.length || r.length > 50 || hd.length > 100) return null;
  var hk = {}; hd.forEach(function (x) { hk[x.k] = 1; });
  var have = r.filter(function (x) { return hk[x.k]; }).map(function (x) { return x.t; }), miss = r.filter(function (x) { return !hk[x.k]; }).map(function (x) { return x.t; });
  return { total:r.length, have:have, missing:miss, ready:miss.length === 0 };
}

// ── 내 행정 ──
function viewHome() {
  var kids = head('내 행정', '입법·사법·행정 기관에 맡긴 일을 한곳에 적어 두고, 지금 어디까지 왔는지 봅니다.'); kids.push(notice());
  var run = S.items.filter(function (x) { return x.st !== '제출 완료'; }).length, done = S.items.length - run, fix = S.items.filter(function (x) { return x.st === '보완 요청'; }).length;
  kids.push(h('div', { class:'g2', style:'margin-top:16px' }, [tile('진행 중', run + '건', '제출 전이거나 보완 중', 'pb-run'), tile('제출 완료', done + '건', fix ? '보완 요청 ' + fix + '건 있어요' : '', 'pb-done')]));
  if (!S.items.length) { kids.push(empty('아직 적어 둔 일이 없어요. 대행 요청에서 첫 일을 적어 보세요.', btn('대행 요청 적기', 'fill', function () { go('request'); }))); return kids; }
  kids.push(table(['기관', '목적', '진행', ''], S.items.map(function (x) {
    var s = h('select', { 'aria-label':x.org + ' 진행 상태' }, STATES.map(function (c) { return h('option', { value:c, text:c }); })); s.value = x.st;
    s.onchange = function () { x.st = s.value; if (x.st === '제출 완료' && !x.d) x.d = kst(); save(); render(); };
    return h('tr', {}, [h('td', {}, [h('b', { text:x.org }), h('div', { class:'sub', text:x.kind })]), h('td', { text:x.goal }), h('td', {}, [s]), h('td', {}, [btn('삭제', 'quiet', function () { S.items = S.items.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]);
  })));
  kids.push(h('div', { class:'sub', style:'margin-top:8px', text:'진행 상태는 내가 직접 바꿉니다. 기관 사이트의 실제 접수 상태와 자동으로 맞춰지지는 않아요.' }));
  return kids;
}

// ── 대행 요청 ──
function addItem() {
  var f = S.rq, e = {}, org = clean(f.org, 40), goal = clean(f.goal, 80);
  if (!org) e.org = '기관 이름을 적어 주세요.'; if (!goal) e.goal = '무엇을 하려는지 적어 주세요.'; if (S.items.length >= MAXI) e.org = '최대 ' + MAXI + '건까지 적을 수 있어요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  S.items.unshift({ id:uid(), kind:f.kind, org:org, goal:goal, docs:clean(f.docs, 200), st:'준비', d:'', no:'' }); f.org = ''; f.goal = ''; f.docs = ''; S.msg = '내 행정에 적었어요. 기관에는 아무것도 보내지 않았어요.'; save(); render();
}
function viewRequest() {
  var kids = head('대행 요청', '어느 기관에서 무엇을 하려는지 적으면, 나비웹 도우미가 할 일과 내가 할 일을 나눠 보여 줍니다.'); kids.push(notice());
  var f = S.rq, e = S.err;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('div', { class:'frm' }, [
    sel('pb-q-kind', '기관 종류', f.kind, KINDS.map(function (k) { return [k, k]; }), function (v) { f.kind = v; }),
    field('pb-q-org', '기관·사이트', f.org, { err:e.org, max:40, ph:'예: 대법원 전자소송', set:function (v) { f.org = v; } }),
    field('pb-q-goal', '하려는 일', f.goal, { err:e.goal, max:80, ph:'예: 지급명령 신청서 제출', set:function (v) { f.goal = v; } }),
    field('pb-q-docs', '필요한 서류(쉼표로 구분, 선택)', f.docs, { max:200, ph:'예: 신청서, 소명자료', set:function (v) { f.docs = v; } })]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('내 행정에 적기', 'fill', addItem),
      btn('나비웹 도우미에게 맡기기', 'quiet', function () { var org = clean(f.org, 40) || '기관 사이트', goal = clean(f.goal, 80) || '필요한 서류'; ask('나비웹 도우미로 ' + org + '에서 "' + goal + '" 서류를 찾아 필드를 채워 줘. 로그인과 최종 확인·결제는 내가 할게.'); }),
      S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  kids.push(stepsCard('이렇게 나눠서 합니다', [
    ['내가 로그인', '공동인증서 같은 로그인과 본인 인증은 항상 내가 직접 해요. 도우미는 비밀번호와 인증서를 다루지 않아요.'],
    ['도우미가 서류를 찾고 채움', '내 목적에 맞는 서류를 찾아, 내 기록(PDV)에서 값을 가져와 각 필드를 채워요. 어디에 무엇을 넣었는지 보여 줘요.'],
    ['내가 최종 확인과 동의', '채워진 내용을 눈으로 확인하고, 최종 확인·동의 버튼은 내가 눌러요.'],
    ['내가 결제', '수수료 결제는 내가 직접 해요.']],
    '기관 사이트의 모양이 바뀌거나 막혀 있으면 도우미가 멈추고 알려 줍니다. 이 단계는 기관이 자기 AI 비서를 갖추면 사라지고 아래 「대행 원리」의 handshake 로 바뀝니다.'));
  return kids;
}

// ── 대행 원리 ──
function viewPrinciple() {
  var kids = head('대행 원리', '도장을 대신 찍어 주는 로봇이 아니라, 도장이 필요 없는 길로 가는 것이 행정 인프라의 방향입니다.');
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'도장 찍는 로봇 이야기' }),
    h('p', { text:'공공 행정의 도장 업무는 전자 서명으로 바꿀 수 있는데도, 일본은 도장을 대신 찍어 주는 최첨단 로봇을 만들었어요. 문제의 뿌리는 두고 겉만 자동화한 거예요.' }),
    h('p', { text:'나비웹 도우미가 기관 사이트의 서류 필드를 대신 채우는 것도 같은 모양입니다. 지금은 꼭 필요한 다리지만, 최종 목적지는 아니에요.' })]));
  kids.push(table(['', '지금: 나비웹 도우미 대행', '목표: AI 비서끼리 handshake'], [
    ['누가 말하나', '내 도우미가 기관의 사람용 화면과 말해요', '내 AI 비서와 기관의 AI 비서가 서로 말해요'],
    ['신원 확인', '내가 로그인(공동인증서)', '서로 신원을 인증(handshake)'],
    ['서류', '화면의 필드를 하나씩 채움', '기관이 요구하는 서류를 데이터로 전송'],
    ['동의·결제', '내가 버튼을 누르고 직접 결제', '내가 위임한 범위 안에서 비서가 수행, 나는 승인만'],
    ['기관이 할 일', '없음(지금 사이트 그대로)', '자기 AI 비서를 갖추기']].map(function (r) { return h('tr', {}, r.map(function (t, i) { return h(i ? 'td' : 'th', { text:t }); })); })));
  kids.push(h('div', { class:'note info', style:'margin-top:16px', text:'입법·사법·행정 기관의 서류 요청과 제출을 사용자와 기관 각각의 AI 비서 사이의 소통으로 바꾸는 것이 목표입니다. 나비웹은 수많은 AI 비서가 서로 소통하는 공간이에요.' }));
  return kids;
}

// ── 기관 AI 연결 ──
function viewConnect() {
  var kids = head('기관 AI 연결', '내 AI 비서와 기관의 AI 비서가 서로 신원을 확인하고 서류를 주고받는 방식입니다.'); kids.push(notice());
  kids.push(stepsCard('handshake 로 서류를 낼 때', [
    ['서로 신원 인증', '내 AI 비서와 기관의 AI 비서가 서로가 진짜인지 확인해요. 기관 사이트에 따로 로그인하지 않아요.'],
    ['기관이 요구 서류를 알림', '기관의 AI 비서가 이 일에 필요한 서류와 항목만 알려요. 그 밖의 정보는 요구하지 않아요.'],
    ['내 비서가 필요한 것만 전송', '내 기록에서 요구된 항목만 골라 보내요. 보내기 전에 무엇을 보내는지 내가 볼 수 있어요.'],
    ['동의·수수료는 위임 범위 안에서', '내가 정해 둔 범위 안에서 비서가 동의와 결제를 처리하고, 나는 승인만 해요.']],
    '아직 설계 단계입니다. 연결된 기관 AI 비서는 없어요.'));
  var f = S.hs, out = h('div', { id:'pb-h-out', style:'margin-top:12px' });
  function upd() { out.textContent = ''; var r = matchDocs(f.req, f.held);
    out.appendChild(!r ? h('div', { class:'sub', text:'기관이 요구하는 서류를 쉼표로 구분해 넣어 주세요.' }) : h('div', {}, [
      h('div', { class:'g2' }, [tile('바로 보낼 수 있는 서류', r.have.length + '개', '요구 ' + r.total + '개 중', 'pb-h-have'), tile('내가 더 준비할 서류', r.missing.length + '개', r.ready ? '' : r.missing.join(', '), 'pb-h-miss')]),
      h('div', { id:'pb-h-res', class:r.ready ? 'note info' : 'note', style:'margin-top:12px', text:r.ready ? '요구 서류를 모두 갖고 있어요. 연결되면 내 비서가 바로 보낼 수 있습니다.' : '아직 없는 서류가 있어요: ' + r.missing.join(', ') + '. 이 서류를 먼저 준비해야 해요.' })])); }
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'서류 대조해 보기' }), h('div', { class:'sub', text:'기관이 요구하는 서류와 내가 가진 서류를 넣으면 무엇이 비는지 알려 줘요.' }),
    h('div', { class:'frm' }, [field('pb-h-req', '기관이 요구하는 서류', f.req, { max:300, ph:'예: 주민등록등본, 신청서, 소명자료', set:function (v) { f.req = v; upd(); } }), field('pb-h-held', '내가 가진 서류', f.held, { max:300, ph:'예: 주민등록등본, 신청서', set:function (v) { f.held = v; upd(); } })]), out]));
  kids.push(table(['기관 종류', '연결된 기관 AI'], KINDS.map(function (k) { return h('tr', {}, [h('td', { text:k }), h('td', {}, [pill('아직 없음', '')])]); })));
  upd(); return kids;
}

// ── 위임·동의 ──
function addRule() {
  var f = S.dl, e = {}, org = clean(f.org, 40), lim = f.limit.trim() === '' ? 0 : numOf(f.limit), u = f.until.trim();
  if (!org) e.org = '기관 이름을 적어 주세요.'; if (!isFinite(lim) || lim < 0 || lim > 1e9) e.limit = '결제 한도는 0~10억 사이 숫자예요.'; if (u && !/^\d{4}-\d{2}-\d{2}$/.test(u)) e.until = '날짜는 2026-12-31 모양으로 적어 주세요.'; if (S.rules.length >= MAXR) e.org = '위임은 최대 ' + MAXR + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  S.rules.push({ id:uid(), org:org, limit:Math.round(lim), until:u }); f.org = ''; f.limit = ''; f.until = ''; S.msg = '위임 내용을 적어 뒀어요. 아직 효력은 없어요.'; save(); render();
}
function viewDelegate() {
  var kids = head('위임·동의', '기관 AI 비서가 연결되면 내 비서가 어디까지 대신할지 미리 정해 둡니다.'); kids.push(notice());
  var f = S.dl, e = S.err;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'위임 범위 적어 두기' }), h('div', { class:'frm' }, [
    field('pb-d-org', '기관', f.org, { err:e.org, max:40, ph:'예: 대법원 전자소송', set:function (v) { f.org = v; } }),
    field('pb-d-lim', '한 번에 결제할 수 있는 한도(원)', f.limit, { err:e.limit, mode:'numeric', max:11, ph:'예: 10000', help:'0이면 결제는 늘 내가 해요', set:function (v) { f.limit = v; } }),
    field('pb-d-until', '위임 끝나는 날(선택)', f.until, { err:e.until, max:10, ph:'예: 2026-12-31', set:function (v) { f.until = v; } })]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('위임 적어 두기', 'fill', addRule), btn('행정 AI에게 묻기', 'quiet', function () { ask('내 AI 비서에게 기관 제출과 수수료 결제를 위임하려면 어떤 범위로 정해 두는 게 안전한가요?'); }), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  kids.push(h('div', { class:'note', style:'margin-top:16px', text:'지금은 어떤 위임도 효력이 없어요. 로그인과 본인 인증, 최종 확인·동의, 결제는 지금처럼 모두 내가 직접 합니다.' }));
  if (!S.rules.length) kids.push(empty('아직 적어 둔 위임이 없어요.'));
  else kids.push(table(['기관', '결제 한도', '끝나는 날', ''], S.rules.map(function (x) { return h('tr', {}, [h('td', { text:x.org }), h('td', { class:'num', text:x.limit ? won(x.limit) + '원' : '내가 직접 결제' }), h('td', { text:x.until || '정하지 않음' }), h('td', {}, [btn('삭제', 'quiet', function () { S.rules = S.rules.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]); })));
  return kids;
}

// ── 제출 기록 ──
function viewLog() {
  var kids = head('제출 기록', '제출 완료로 표시한 일을 모아 보여 줍니다.'); kids.push(notice());
  var done = S.items.filter(function (x) { return x.st === '제출 완료'; });
  if (!done.length) { kids.push(empty('아직 제출 완료로 표시한 일이 없어요. 내 행정에서 진행 상태를 바꿔 보세요.', btn('내 행정으로', 'fill', function () { go('home'); }))); return kids; }
  kids.push(table(['제출일', '기관', '목적', '접수번호'], done.map(function (x) {
    var inp = h('input', { type:'text', value:x.no, maxlength:'30', placeholder:'직접 적기', 'aria-label':x.org + ' 접수번호', autocomplete:'off' }); inp.onchange = function () { x.no = clean(inp.value, 30); save(); };
    return h('tr', {}, [h('td', { class:'num', text:x.d || '' }), h('td', { text:x.org }), h('td', { text:x.goal }), h('td', {}, [inp])]); })));
  kids.push(h('div', { class:'sub', style:'margin-top:8px', text:'접수번호는 기관에서 받은 것을 내가 직접 적어 둡니다. 기관의 접수 내역과 자동으로 맞춰지지는 않아요.' }));
  return kids;
}

function render() {
  var root = $('pb-root'), tp = $('pb-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar()); if (window.NaviSim && window.NaviSim.tab) window.NaviSim.tab('pub', S.view);
  var kids = S.view === 'request' ? viewRequest() : S.view === 'principle' ? viewPrinciple() : S.view === 'connect' ? viewConnect() : S.view === 'delegate' ? viewDelegate() : S.view === 'log' ? viewLog() : viewHome();
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
  M = el; el.textContent = ''; el.classList.add('pub'); S.items = []; S.rules = []; S.err = {}; S.msg = ''; load();
  [h('div', { id:'pb-top' }), h('div', { class:'wrap', id:'pb-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'home'; render();
}
window.NaviPublic = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  matchDocs:matchDocs,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
