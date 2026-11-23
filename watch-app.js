/* watch-app.js — 나비웹 감시(인프라 AI · 감시). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviWatch.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 watch.css(.wch 범위). 전역은 NaviWatch 하나만 쓴다.
 *
 * 감시 화면의 개념(주피터 지시): 개인·기관·시설·장치의 제반 활동을 하루 24시간 기록하되, 그 기록을 오직 당사자만 볼 수 있게 해 본인 외 타인(자연인)의 접근을 철저히 막는 기술적 방안.
 * 범죄가 생기면 피해자나 범법 행위를 감지한 장치가 당국에 신고·보고하고, 당국은 범인을 찾을 의무가 생긴다. 용의선상에 오른 사람은 자기 PDV 의 기록(알리바이)을 꺼내 무죄를 입증하거나 범죄 사실을 자백하는 선택에 놓인다.
 * 모든 개인·장치·시설이 자기 자신을 감시하는 메커니즘이다.
 * 본질(주피터 지시): 첫째, 감시 인프라는 자신의 무죄를 입증하는 수단이다. 자기 일상·업무를 자기 PDV에 기록하고 오직 본인만 접근하며 일부 데이터를 골라 인출해 내므로 죄를 짓지 않은 모든 개인은 무죄를 입증할 수 있다.
 * 둘째, 대화나 행위의 양측이 같은 사건을 각자 기록하므로, 해를 가한 쪽이 자기 PDV 의 기록 공개를 거부해도 피해자가 자기 PDV 에서 그 기록을 인출해 공개하는 방법으로 상대의 유죄를 입증할 수 있다.
 * 그래서 기록에는 내가 직접 한 일과 내가 당사자로 함께한 일(상대 표시)만 적고, 기록은 나만 열람하며, 낼지 말지도 내가 정한다.
 * 이 화면이 다루는 것:
 *  - 활동 기록: 내가 적는 활동 기록을 해시 사슬(SHA-256)로 이어 붙여 고치거나 끼워 넣으면 드러나게 한다(verifyChain). 개별 삭제·수정은 없다.
 *  - 신고 초안: 사실과 추측을 나눠 쓰고 근거가 될 내 기록을 고른다. 위험하면 먼저 112.
 *  - 수사 요청: 당국이 요청한 기관·사건 요지·근거·기간을 적어 둔다.
 *  - 제출 판단: 요청 기간 안의 내 기록 중 내가 고른 것만 제출 준비로 정하거나, 제출하지 않거나, 사실을 인정하고 진술할 의사를 기록한다(packagePreview).
 * 설계 원칙: 제출은 본인이 정한다. 진술 거부권(헌법 제12조 제2항)과 무죄추정(헌법 제27조 제4항), 영장주의(헌법 제12조 제3항)를 해치지 않도록 「제출하지 않음」과 진술 거부를 같은 무게의 선택지로 두고,
 *  제출하지 않았다는 사실 자체를 불리하게 쓰지 않는 것은 법으로 정할 일이다. 법률 판단은 법률 인프라 AI·변호사에게 확인한다.
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 24시간 자동 기록은 기기·센서 연결이 필요하며 아직 연결되어 있지 않다. 이 화면의 기록은 내가 직접 적는 활동 기록이고 증거 능력을 보장하지 않는다.
 *  - 이 화면은 아무것도 당국에 보내지 않는다. 신고·제출은 내가 직접 한다. 기록은 이 브라우저(localStorage)에만 저장된다.
 *  - 시각은 이 기기의 시계를 쓰며 공인 시각 증명이 아니다. */
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
var KEY = 'navi-watch-v1', MAXE = 500, MAXS = 10, MAXR = 30, MAXQ = 30, MAXD = 60;
var CATS = ['위치·이동', '출입', '접속·통신', '업무·활동', '장치 상태', '기타'], KINDS = ['개인', '기관', '시설', '장치'], BASIS = ['영장', '임의 제출 요청', '기타'];
var ACTS = ['제출 준비', '제출하지 않음', '인정·진술 의사'];
var TABS = [['home', '현황'], ['log', '활동 기록'], ['report', '신고 초안'], ['request', '수사 요청'], ['decide', '제출 판단'], ['principle', '감시 원리']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var ZERO = new Array(65).join('0');
var M = null, LS = {};
var S = { view:'home', subjects:[], entries:[], reports:[], reqs:[], decs:[], sel:'', pick:{}, confirm:false, rpick:{},
  ef:{ t:'', subject:'', cat:CATS[0], text:'', with:'' }, sf:{ name:'', kind:'개인' }, rf:{ t:'', facts:'', guess:'' }, qf:{ org:'', summary:'', basis:BASIS[0], from:'', to:'' }, df:{ act:ACTS[0] }, err:{}, msg:'' };
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

function topbar() {
  return h('div', { class:'topin' }, [
    h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 감시' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function notice() {
  return h('div', { class:'note info', style:'margin:16px 0', id:'wc-note', text:'이 화면의 기록은 내가 직접 적는 활동 기록이고 증거 능력을 보장하지 않아요. 24시간 자동 기록은 기기·센서 연결이 필요하며 아직 연결되어 있지 않습니다. 아무것도 당국에 보내지 않고, 적은 내용은 이 브라우저에만 저장돼요. 위험하면 먼저 112에 연락하세요.' });
}
function rows2(rows) { return rows.map(function (r) { return h('tr', {}, r.map(function (t, i) { return h(i ? 'td' : 'th', { text:t }); })); }); }

// ── 해시·시각 ──
/** SHA-256(16진 64자). 문자열은 UTF-8 로 처리한다. */
function sha256(str) {
  var ascii = unescape(encodeURIComponent(String(str)));
  function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
  var mp = Math.pow, mw = mp(2, 32), i, j, result = '', words = [], abl = ascii.length * 8, hash = [], k = [], pc = 0, isC = {};
  for (var cand = 2; pc < 64; cand++) { if (!isC[cand]) { for (i = 0; i < 313; i += cand) isC[i] = cand; hash[pc] = (mp(cand, 0.5) * mw) | 0; k[pc++] = (mp(cand, 1 / 3) * mw) | 0; } }
  ascii += '\x80'; while (ascii.length % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) { j = ascii.charCodeAt(i); words[i >> 2] |= j << ((3 - i) % 4) * 8; }
  words[words.length] = (abl / mw) | 0; words[words.length] = abl;
  for (j = 0; j < words.length;) {
    var w = words.slice(j, j += 16), oldHash = hash; hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
      var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
      var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(t1 + t2) | 0].concat(hash); hash[4] = (hash[4] + t1) | 0;
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { var b = (hash[i] >> (j * 8)) & 255; result += (b < 16 ? '0' : '') + b.toString(16); }
  return result;
}
function nowKst() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' '); }
function dtMs(s) { if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(s))) return null; var p = s.split(/[- :]/).map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4])); return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2] && d.getUTCHours() === p[3] && d.getUTCMinutes() === p[4] ? d.getTime() : null; }
function entryHash(e, prev) { return sha256([e.i, e.t, e.subject, e.cat, e.text, e.with || '', prev].join('|')); }
/** 해시 사슬 점검: 번호가 1부터 이어지고 각 기록이 앞 기록의 해시와 자기 내용의 해시를 지니는지. 어긋난 첫 번호를 알려 준다(없으면 bad 0). 빈 사슬도 정상. */
function verifyChain(entries) {
  if (!Array.isArray(entries)) return null; var prev = ZERO;
  for (var k = 0; k < entries.length; k++) { var e = entries[k]; if (!e || e.i !== k + 1 || e.prev !== prev || e.hash !== entryHash(e, prev)) return { ok:false, bad:k + 1, n:entries.length }; prev = e.hash; }
  return { ok:true, bad:0, n:entries.length, head:prev };
}
/** 요청 기간(from~to, 양끝 포함) 안의 기록. 시각이 틀리면 null. */
function inWindow(entries, from, to) { if (dtMs(from) === null || dtMs(to) === null || dtMs(from) > dtMs(to)) return null; return (entries || []).filter(function (e) { return e.t >= from && e.t <= to; }); }
/** 신고 근거 미리보기: 고른 내 기록(번호 목록)이 모두 있고 사슬이 온전할 때 만든다. 기간 제한은 없다(피해자가 자기 기록을 인출해 내는 경우). */
function reportPreview(entries, picks) {
  var v = verifyChain(entries); if (!v || !v.ok || !Array.isArray(picks) || !picks.length) return null; var ids = {}; entries.forEach(function (e) { ids[e.i] = e; }); var u = picks.filter(function (x, i) { return picks.indexOf(x) === i; });
  if (u.some(function (x) { return !ids[x]; })) return null; u.sort(function (a, b) { return a - b; }); return { count:u.length, head:v.head, items:u.map(function (x) { return { i:x, t:ids[x].t, h:ids[x].hash, w:ids[x].with || '' }; }) };
}
/** 제출 준비 미리보기: 고른 기록(번호 목록)이 모두 요청 기간 안에 있고 사슬이 온전할 때만 만든다. 사슬의 마지막 해시(head)로 이 기록들이 끊김 없는 사슬의 일부임을 보인다. */
function packagePreview(entries, picks, req) {
  var v = verifyChain(entries); if (!v || !v.ok || !Array.isArray(picks) || !picks.length || !req) return null; var win = inWindow(entries, req.from, req.to); if (!win) return null; var ids = {}; win.forEach(function (e) { ids[e.i] = e; });
  var uniq = picks.filter(function (x, i) { return picks.indexOf(x) === i; }); if (uniq.some(function (x) { return !ids[x]; })) return null;
  uniq.sort(function (a, b) { return a - b; }); return { count:uniq.length, from:req.from, to:req.to, head:v.head, items:uniq.map(function (x) { return { i:x, t:ids[x].t, h:ids[x].hash }; }) };
}

function load() {
  try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v || typeof v !== 'object') return;
    S.subjects = (Array.isArray(v.subjects) ? v.subjects : []).map(function (x) { return clean(x, 30); }).filter(Boolean).slice(0, MAXS);
    S.entries = (Array.isArray(v.entries) ? v.entries : []).map(function (e) { return e && typeof e === 'object' ? { i:Number(e.i), t:String(e.t || ''), subject:String(e.subject || ''), cat:String(e.cat || ''), text:String(e.text || ''), with:e.with ? String(e.with) : '', prev:String(e.prev || ''), hash:String(e.hash || '') } : null; }).filter(Boolean).slice(0, MAXE);
    S.reports = (Array.isArray(v.reports) ? v.reports : []).map(function (r) { if (!r || typeof r !== 'object' || dtMs(r.t) === null) return null; var f = clean(r.facts, 400); return f ? { id:clean(r.id, 20) || uid(), t:r.t, facts:f, guess:clean(r.guess, 300), refs:(Array.isArray(r.refs) ? r.refs : []).map(Number).filter(function (n) { return n >= 1 && n <= MAXE; }).slice(0, 10), done:!!r.done } : null; }).filter(Boolean).slice(0, MAXR);
    S.reqs = (Array.isArray(v.reqs) ? v.reqs : []).map(function (q) { if (!q || typeof q !== 'object' || BASIS.indexOf(q.basis) < 0 || dtMs(q.from) === null || dtMs(q.to) === null) return null; var o = clean(q.org, 40), s = clean(q.summary, 120); return o && s ? { id:clean(q.id, 20) || uid(), org:o, summary:s, basis:q.basis, from:q.from, to:q.to, d:/^\d{4}-\d{2}-\d{2}$/.test(q.d) ? q.d : '' } : null; }).filter(Boolean).slice(0, MAXQ);
    S.decs = (Array.isArray(v.decs) ? v.decs : []).map(function (x) { return x && typeof x === 'object' && ACTS.indexOf(x.act) >= 0 ? { id:clean(x.id, 20) || uid(), reqId:clean(x.reqId, 20), act:x.act, n:Math.max(0, Math.min(MAXE, Number(x.n) || 0)), d:/^\d{4}-\d{2}-\d{2}$/.test(x.d) ? x.d : '' } : null; }).filter(Boolean).slice(0, MAXD);
    if (S.reqs.some(function (q) { return q.id === v.sel; })) S.sel = v.sel; } catch (e) {}
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ subjects:S.subjects, entries:S.entries, reports:S.reports, reqs:S.reqs, decs:S.decs, sel:S.sel })); } catch (e) {} }
function chain() { return verifyChain(S.entries); }

// ── 현황 ──
function viewHome() {
  var kids = head('감시', '감시의 첫째 목적은 나의 무죄를 밝히는 것입니다. 나와 내 장치·시설의 활동을 나 스스로 기록하고 그 기록은 나만 볼 수 있게 지키며, 내가 피해자일 때는 같은 사건을 상대도 기록하므로 내 기록으로 상대의 유죄도 보일 수 있어요.'); kids.push(notice());
  var v = chain(), submitted = S.decs.filter(function (x) { return x.act === '제출 준비'; }).reduce(function (s, x) { return s + x.n; }, 0);
  kids.push(h('div', { class:'g2' }, [tile('활동 기록', S.entries.length + '건', '내가 직접 적은 기록', 'wc-h-n'), tile('기록 무결성', S.entries.length ? (v.ok ? '이상 없음' : '변조 의심') : '—', S.entries.length ? (v.ok ? '해시 사슬이 이어져요' : v.bad + '번 기록부터 어긋나요') : '기록을 적으면 점검해요', 'wc-h-v'), tile('받은 수사 요청', S.reqs.length + '건', '내가 적어 둔 것', 'wc-h-q'), tile('제출 준비한 기록', submitted + '건', '이 화면이 보낸 것은 없어요', 'wc-h-s')]));
  kids.push(stepsCard('감시의 순환', [['스스로 기록', '개인·기관·시설·장치가 자기 활동을 24시간 기록해요. 기록은 당사자 PDV에만 있고 타인은 볼 수 없어요.'], ['신고·보고', '피해자나 범법 행위를 감지한 장치가 당국에 신고하면 당국은 범인을 찾을 의무가 생겨요.'], ['요청', '당국이 용의자에게 기록 제출을 요청해요.'], ['본인의 선택', '용의자는 자기 기록(알리바이)을 골라 제출하거나, 제출하지 않거나, 사실을 인정하고 진술할 수 있어요. 어느 쪽이든 본인이 정해요.']], '타인(자연인)이 내 기록을 보는 길은 열어 두지 않는 것이 원칙이에요. 본인이 고른 기록만 요청 기간 안에서 제출 준비를 할 수 있어요.'));
  kids.push(h('div', { class:'rowf', style:'margin-top:12px' }, [btn('활동 기록 적기', 'fill', function () { go('log'); }), btn('감시 AI에게 묻기', 'quiet', function () { ask('내 활동 기록을 나만 볼 수 있게 지키려면 어떻게 해야 하나요?'); })]));
  return kids;
}

// ── 활동 기록 ──
function addSubject() {
  var f = S.sf, n = clean(f.name, 20), e = {}; if (!n) e.sname = '이름을 적어 주세요.'; var lab = n + '(' + f.kind + ')'; if (S.subjects.indexOf(lab) >= 0) e.sname = '이미 있는 대상이에요.'; if (S.subjects.length >= MAXS) e.sname = '대상은 최대 ' + MAXS + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); } S.subjects.push(lab); f.name = ''; S.msg = ''; save(); render();
}
function addEntry() {
  var f = S.ef, e = {}, now = nowKst(), t = clean(f.t, 16) || now, text = clean(f.text, 120), sub = f.subject || S.subjects[0];
  if (!S.subjects.length) e.subject = '먼저 기록 대상을 하나 만들어 주세요.'; if (dtMs(t) === null) e.t = '시각을 2026-11-23 09:30 형식으로 적어 주세요.';
  else { if (t > nowKst().slice(0, 11) + '23:59' && dtMs(t) > Date.now() + 9 * 3600e3 + 5 * 60e3) e.t = '미래 시각은 적을 수 없어요.'; var last = S.entries[S.entries.length - 1]; if (!e.t && last && t < last.t) e.t = '앞선 기록(' + last.t + ')보다 이른 시각은 적을 수 없어요.'; }
  if (text.length < 2) e.text = '활동을 2자 이상 적어 주세요.'; if (S.entries.length >= MAXE) e.text = '기록은 최대 ' + MAXE + '건까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  var prev = S.entries.length ? S.entries[S.entries.length - 1].hash : ZERO, en = { i:S.entries.length + 1, t:t, subject:sub, cat:f.cat, text:text, with:clean(f.with, 30), prev:prev, hash:'' }; en.hash = entryHash(en, prev); S.entries.push(en); f.t = ''; f.text = ''; f.with = ''; S.msg = en.i + '번 기록을 사슬에 이었어요.'; save(); render();
}
function viewLog() {
  var kids = head('활동 기록', '내가 직접 한 일과 내가 당사자로 함께한 일만 적어요(내가 당사자가 아닌 다른 사람의 대화나 활동은 적지 않아요). 기록은 앞 기록의 해시와 함께 이어 붙여 고치거나 끼워 넣으면 드러나게 합니다. 개별 수정·삭제는 없어요.'); kids.push(notice());
  var f = S.ef, e = S.err, ss = h('select', { id:'wc-e-sub', 'aria-label':'기록 대상' }, S.subjects.map(function (x) { return h('option', { value:x, text:x }); })); ss.value = f.subject || S.subjects[0] || ''; ss.onchange = function () { f.subject = ss.value; };
  var cs = h('select', { id:'wc-e-cat', 'aria-label':'분류' }, CATS.map(function (x) { return h('option', { value:x, text:x }); })); cs.value = f.cat; cs.onchange = function () { f.cat = cs.value; };
  var sf = S.sf, ks = h('select', { id:'wc-s-kind', 'aria-label':'대상 종류' }, KINDS.map(function (x) { return h('option', { value:x, text:x }); })); ks.value = sf.kind; ks.onchange = function () { sf.kind = ks.value; };
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'기록 대상' }), h('div', { class:'sub', text:S.subjects.length ? S.subjects.join(' · ') : '아직 없어요. 나, 내 장치, 내 시설·기관을 대상으로 만들어요.' }),
    h('div', { class:'frm' }, [field('wc-s-name', '이름', sf.name, { err:e.sname, max:20, ph:'예: 나 / 현관 카메라', set:function (v) { sf.name = v; } }), h('div', { class:'field' }, [h('label', { for:'wc-s-kind', text:'종류' }), ks, h('div', { class:'help', text:'' })])]), h('div', { class:'rowf' }, [btn('대상 추가', 'quiet', addSubject)])]));
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'활동 적기' }),
    h('div', { class:'frm' }, [h('div', { class:'field' }, [h('label', { for:'wc-e-sub', text:'대상' }), ss, h('div', { class:e.subject ? 'err' : 'help', text:e.subject || '' })]), h('div', { class:'field' }, [h('label', { for:'wc-e-cat', text:'분류' }), cs, h('div', { class:'help', text:'' })]), field('wc-e-t', '시각(비우면 지금)', f.t, { err:e.t, max:16, ph:nowKst(), set:function (v) { f.t = v; } }), field('wc-e-text', '활동', f.text, { err:e.text, max:120, ph:'예: 회사 도착, 3층 사무실 출입', set:function (v) { f.text = v; } }), field('wc-e-with', '함께한 상대(선택)', f.with, { max:30, ph:'예: 임대인 김○○', help:'상대와 주고받은 대화나 행위라면 적어요. 상대도 같은 사건을 기록해요', set:function (v) { f.with = v; } })]),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('사슬에 잇기', 'fill', addEntry), S.msg ? h('span', { class:'sub', role:'status', id:'wc-e-msg', text:S.msg }) : null])]));
  var v = chain(); if (S.entries.length) kids.push(h('div', { id:'wc-l-ver', class:v.ok ? 'note info' : 'note', style:'margin-top:12px', text:v.ok ? '무결성 점검: 이상 없음. 기록 ' + v.n + '건이 끊김 없이 이어져 있어요. 사슬 끝 해시 ' + v.head.slice(0, 16) + '…' : '무결성 점검: ' + v.bad + '번 기록부터 앞 기록과 이어지지 않거나 내용이 바뀌었어요(변조 의심).' }));
  if (!S.entries.length) kids.push(empty('아직 활동 기록이 없어요.')); else {
    kids.push(table(['번호', '시각', '대상', '분류', '활동', '상대', '해시'], S.entries.slice(-30).reverse().map(function (x) { return h('tr', {}, [h('td', { class:'num', text:String(x.i) }), h('td', { class:'num', text:x.t }), h('td', { text:x.subject }), h('td', { text:x.cat }), h('td', { text:x.text }), h('td', { text:x.with || '—' }), h('td', { class:'num', text:x.hash.slice(0, 8) })]); })));
    var cb = btn(S.confirm ? '정말 모두 지우기' : '기록 모두 지우기', 'quiet', function () { if (!S.confirm) { S.confirm = true; return render(); } S.entries = []; S.confirm = false; S.msg = ''; save(); render(); });
    kids.push(h('div', { class:'rowf', style:'margin-top:8px' }, [cb, S.confirm ? h('span', { class:'sub', text:'지우면 되돌릴 수 없어요. 한 번 더 누르면 지워요.' }) : null]));
  }
  return kids;
}

// ── 신고 초안 ──
function packRef() { var a = Object.keys(S.rpick).filter(function (k) { return S.rpick[k]; }).map(Number); return reportPreview(S.entries, a); }
function addReport() {
  var f = S.rf, e = {}, t = clean(f.t, 16) || nowKst(), facts = clean(f.facts, 400), guess = clean(f.guess, 300);
  if (dtMs(t) === null) e.rt = '일어난 시각을 2026-11-23 09:30 형식으로 적어 주세요.'; if (facts.length < 10) e.facts = '직접 보거나 겪은 사실을 10자 이상 적어 주세요.'; if (S.reports.length >= MAXR) e.facts = '신고 초안은 최대 ' + MAXR + '건까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  var refs = Object.keys(S.rpick).filter(function (k) { return S.rpick[k]; }).map(Number).slice(0, 10); S.reports.unshift({ id:uid(), t:t, facts:facts, guess:guess, refs:refs, done:false }); f.t = ''; f.facts = ''; f.guess = ''; S.rpick = {}; S.msg = '신고 초안을 적어 뒀어요. 아직 아무에게도 보내지 않았어요.'; save(); render();
}
function viewReport() {
  var kids = head('신고 초안', '피해를 입었거나 범법 행위를 감지했을 때 신고할 내용을 정리합니다. 상대가 기록 공개를 거부해도 내 기록을 인출해 근거로 낼 수 있어요. 신고는 내가 직접 하고, 내가 직접 보고 겪은 사실만 적어요.'); kids.push(notice());
  kids.push(h('div', { class:'note', id:'wc-r-112', text:'지금 위험하거나 범죄가 진행 중이면 먼저 112(경찰)에 연락하세요. 허위 신고는 책임이 따를 수 있으니 직접 보고 겪은 사실만 적어 주세요.' }));
  var f = S.rf, e = S.err;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('div', { class:'frm' }, [field('wc-r-t', '일어난 시각(비우면 지금)', f.t, { err:e.rt, max:16, ph:nowKst(), set:function (v) { f.t = v; } }), field('wc-r-facts', '사실(직접 보고 겪은 것)', f.facts, { area:true, err:e.facts, max:400, set:function (v) { f.facts = v; } }), field('wc-r-guess', '추측(확인하지 못한 것은 여기에)', f.guess, { area:true, max:300, help:'사실과 추측을 나눠 적으면 신고가 더 정확해져요', set:function (v) { f.guess = v; } })]),
    S.entries.length ? h('div', { class:'sub', text:'근거가 될 내 기록(최근 10건)을 골라요' }) : null, h('div', { class:'col' }, S.entries.slice(-10).reverse().map(function (x) { var c = h('input', { type:'checkbox', id:'wc-rp-' + x.i, 'aria-label':x.i + '번 기록' }); c.checked = !!S.rpick[x.i]; c.onchange = function () { S.rpick[x.i] = c.checked; render(); }; return h('label', { class:'rowf', for:'wc-rp-' + x.i }, [c, h('span', { text:x.i + '번 · ' + x.t + ' · ' + x.text + (x.with ? ' · 상대 ' + x.with : '') })]); })),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('초안 적어 두기', 'fill', addReport), btn('감시 AI에게 묻기', 'quiet', function () { ask('범죄를 목격했는데 어디에 신고해야 하고 어떤 내용을 정리해야 하나요?'); }), S.msg ? h('span', { class:'sub', role:'status', id:'wc-r-msg', text:S.msg }) : null])]));
  var rp = packRef(); if (rp) kids.push(table(['항목', '값'], rows2([['고른 기록', rp.count + '건'], ['사슬 끝 해시', rp.head.slice(0, 16) + '…'], ['기록 해시', rp.items.map(function (x) { return x.i + ':' + x.h.slice(0, 8) + (x.w ? '(상대 ' + x.w + ')' : ''); }).join(' ')]])));
  if (S.reports.length) kids.push(table(['시각', '사실', '추측', '근거', ''], S.reports.map(function (r) { return h('tr', {}, [h('td', { class:'num', text:r.t }), h('td', { text:r.facts }), h('td', { text:r.guess || '—' }), h('td', { class:'num', text:r.refs.length ? r.refs.join(', ') + '번' : '—' }), h('td', {}, [btn(r.done ? '신고함 ✓' : '신고했어요', 'quiet', function () { r.done = !r.done; save(); render(); }), btn('삭제', 'quiet', function () { S.reports = S.reports.filter(function (y) { return y.id !== r.id; }); save(); render(); })])]); })));
  return kids;
}

// ── 수사 요청 ──
function addReq() {
  var f = S.qf, e = {}, o = clean(f.org, 40), s = clean(f.summary, 120), a = dtMs(f.from), b = dtMs(f.to);
  if (!o) e.org = '요청한 기관을 적어 주세요.'; if (s.length < 5) e.summary = '사건 요지를 5자 이상 적어 주세요.'; if (a === null) e.from = '시작 시각을 2026-11-23 09:00 형식으로 적어 주세요.'; if (b === null) e.to = '끝 시각을 2026-11-23 18:00 형식으로 적어 주세요.';
  if (a !== null && b !== null) { if (a > b) e.to = '끝 시각은 시작 시각보다 늦어야 해요.'; else if (b - a > 366 * 86400e3) e.to = '기간은 1년을 넘을 수 없어요.'; } if (S.reqs.length >= MAXQ) e.org = '요청은 최대 ' + MAXQ + '건까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  var q = { id:uid(), org:o, summary:s, basis:f.basis, from:f.from, to:f.to, d:nowKst().slice(0, 10) }; S.reqs.unshift(q); S.sel = q.id; f.org = ''; f.summary = ''; f.from = ''; f.to = ''; S.msg = '요청을 적어 뒀어요. 「제출 판단」에서 정해요.'; save(); render();
}
function viewRequest() {
  var kids = head('수사 요청', '당국이 내게 기록 제출을 요청했을 때 그 내용을 적어 둡니다. 요청 기간 밖의 기록은 대상이 아니에요.'); kids.push(notice());
  var f = S.qf, e = S.err, bs = h('select', { id:'wc-q-basis', 'aria-label':'요청 근거' }, BASIS.map(function (x) { return h('option', { value:x, text:x }); })); bs.value = f.basis; bs.onchange = function () { f.basis = bs.value; };
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('div', { class:'frm' }, [field('wc-q-org', '요청한 기관', f.org, { err:e.org, max:40, ph:'예: ○○경찰서', set:function (v) { f.org = v; } }), field('wc-q-sum', '사건 요지', f.summary, { err:e.summary, max:120, set:function (v) { f.summary = v; } }), h('div', { class:'field' }, [h('label', { for:'wc-q-basis', text:'요청 근거' }), bs, h('div', { class:'help', text:'영장이 있는지, 임의로 내 달라는 것인지 확인해요' })]), field('wc-q-from', '요청 기간 시작', f.from, { err:e.from, max:16, ph:'2026-11-23 09:00', set:function (v) { f.from = v; } }), field('wc-q-to', '요청 기간 끝', f.to, { err:e.to, max:16, ph:'2026-11-23 18:00', set:function (v) { f.to = v; } })]),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('요청 적어 두기', 'fill', addReq), btn('법률 AI에게 묻기', 'quiet', function () { ask('경찰이 내 기록 제출을 요청했습니다. 영장이 없는 임의 제출 요청이면 어떻게 해야 하나요?'); }), S.msg ? h('span', { class:'sub', role:'status', id:'wc-q-msg', text:S.msg }) : null])]));
  if (!S.reqs.length) kids.push(empty('아직 받은 요청이 없어요.')); else kids.push(table(['기관', '사건 요지', '근거', '기간', ''], S.reqs.map(function (q) { return h('tr', {}, [h('td', { text:q.org }), h('td', { text:q.summary }), h('td', {}, [pill(q.basis, q.basis === '영장' ? 'ok' : 'warn')]), h('td', { class:'num', text:q.from + ' ~ ' + q.to }), h('td', {}, [btn('판단하기', 'quiet', function () { S.sel = q.id; S.pick = {}; save(); go('decide'); }), btn('삭제', 'quiet', function () { S.reqs = S.reqs.filter(function (y) { return y.id !== q.id; }); S.decs = S.decs.filter(function (y) { return y.reqId !== q.id; }); if (S.sel === q.id) S.sel = ''; save(); render(); })])]); })));
  return kids;
}

// ── 제출 판단 ──
function curReq() { for (var i = 0; i < S.reqs.length; i++) if (S.reqs[i].id === S.sel) return S.reqs[i]; return null; }
function decide(q, picks) {
  var act = S.df.act, e = {};
  if (act === '제출 준비') { var pv = packagePreview(S.entries, picks, q); if (!pv) e.pick = '요청 기간 안의 기록을 한 건 이상 골라 주세요(사슬이 온전해야 해요).'; }
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  if (S.decs.length >= MAXD) { S.err = { pick:'판단 기록은 최대 ' + MAXD + '건까지예요.' }; return render(); }
  S.decs.unshift({ id:uid(), reqId:q.id, act:act, n:act === '제출 준비' ? picks.length : 0, d:nowKst().slice(0, 10) }); S.pick = {}; S.msg = '「' + act + '」으로 기록했어요. 이 화면은 아무것도 보내지 않아요.'; save(); render();
}
function viewDecide() {
  var kids = head('제출 판단', '요청을 받으면 내 기록에서 무엇을 낼지, 내지 않을지, 사실을 인정하고 진술할지를 내가 정합니다.'); kids.push(notice());
  if (!S.reqs.length) return kids.concat([empty('먼저 「수사 요청」에 받은 요청을 적어 주세요.', btn('수사 요청으로', 'fill', function () { go('request'); }))]);
  var sp = h('select', { id:'wc-d-req', 'aria-label':'요청 고르기' }, S.reqs.map(function (q) { return h('option', { value:q.id, text:q.org + ' — ' + q.summary }); })); if (!curReq()) S.sel = S.reqs[0].id; sp.value = S.sel; sp.onchange = function () { S.sel = sp.value; S.pick = {}; save(); render(); };
  var q = curReq(), win = inWindow(S.entries, q.from, q.to) || [], v = chain();
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('div', { class:'field' }, [h('label', { for:'wc-d-req', text:'요청' }), sp, h('div', { class:'help', text:q.basis + ' · ' + q.from + ' ~ ' + q.to })])]));
  kids.push(h('div', { class:'note', style:'margin-top:12px', id:'wc-d-law', text:'제출은 내가 정해요. 진술을 거부할 권리(헌법 제12조 제2항)와 무죄추정(제27조 제4항)이 있고, 영장 없는 요청은 임의 제출이에요. 제출하지 않았다는 사실 자체를 불리하게 쓰지 않는 것은 법으로 정할 일이에요. 정하기 전에 변호사나 법률 인프라 AI에게 확인하세요.' }));
  if (!v.ok) kids.push(h('div', { class:'note', role:'alert', id:'wc-d-bad', style:'margin-top:12px', text:'활동 기록의 무결성에 문제가 있어(' + v.bad + '번부터) 기록을 제출 준비에 쓸 수 없어요.' }));
  var picks = Object.keys(S.pick).filter(function (k) { return S.pick[k]; }).map(Number);
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'요청 기간 안의 내 기록 ' + win.length + '건' }), !win.length ? h('div', { class:'empty', id:'wc-d-none', text:'요청 기간 안에 내 기록이 없어요.' }) : h('div', { class:'col' }, win.map(function (x) { var c = h('input', { type:'checkbox', id:'wc-dp-' + x.i, 'aria-label':x.i + '번 기록' }); c.checked = !!S.pick[x.i]; c.onchange = function () { S.pick[x.i] = c.checked; render(); }; return h('label', { class:'rowf', for:'wc-dp-' + x.i }, [c, h('span', { text:x.i + '번 · ' + x.t + ' · ' + x.subject + ' · ' + x.text })]); })), S.err.pick ? h('div', { class:'err', role:'alert', text:S.err.pick }) : null]));
  var pv = packagePreview(S.entries, picks, q);
  if (pv) kids.push(table(['항목', '값'], rows2([['고른 기록', pv.count + '건'], ['기간', pv.from + ' ~ ' + pv.to], ['사슬 끝 해시', pv.head.slice(0, 16) + '…'], ['기록 해시', pv.items.map(function (x) { return x.i + ':' + x.h.slice(0, 8); }).join(' ')]])));
  var as = h('select', { id:'wc-d-act', 'aria-label':'판단' }, ACTS.map(function (x) { return h('option', { value:x, text:x }); })); as.value = S.df.act; as.onchange = function () { S.df.act = as.value; };
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('div', { class:'field' }, [h('label', { for:'wc-d-act', text:'내 판단' }), as, h('div', { class:'help', text:'제출 준비는 고른 기록만 대상이에요. 나머지는 기록 없이 판단만 남겨요.' })]), h('div', { class:'rowf' }, [btn('판단 기록', 'fill', function () { decide(q, picks); }), btn('법률 AI에게 묻기', 'quiet', function () { ask('경찰의 기록 제출 요청(' + q.basis + ')에 대해 제출·진술 거부·진술 중 무엇을 어떻게 판단해야 하는지 알려 주세요.'); }), S.msg ? h('span', { class:'sub', role:'status', id:'wc-d-msg', text:S.msg }) : null])]));
  var ds = S.decs.filter(function (x) { return x.reqId === q.id; }); if (ds.length) kids.push(table(['날짜', '판단', '기록'], ds.map(function (x) { return h('tr', {}, [h('td', { class:'num', text:x.d }), h('td', { text:x.act }), h('td', { class:'num', text:x.n ? x.n + '건' : '—' })]); })));
  return kids;
}

// ── 감시 원리 ──
function viewPrinciple() {
  var kids = head('감시 원리', '모든 개인과 장치, 시설이 자기 자신을 감시합니다. 남이 나를 감시하는 것이 아니에요.'); kids.push(notice());
  kids.push(table(['원칙', '내용'], rows2([['무죄 입증', '내 일상과 업무를 내 PDV에 기록하고 나만 접근하며 일부 데이터를 골라 내므로, 죄를 짓지 않은 사람은 누구나 자신의 무죄를 입증할 수 있어요.'], ['양측 기록', '대화나 행위의 양쪽이 같은 사건을 각자 기록해요. 해를 끼친 쪽이 자기 기록 공개를 거부해도, 피해자가 자기 PDV의 기록을 인출해 공개하는 방법으로 상대의 유죄를 입증할 수 있어요.'], ['스스로 기록', '개인·기관·시설·장치가 자기 활동을 하루 24시간 기록해요.'], ['당사자만 열람', '기록은 당사자 PDV에만 있고 본인 외 타인(자연인)의 접근은 막는 것이 원칙이에요.'], ['신고와 수사', '피해자나 범법 행위를 감지한 장치가 당국에 신고하면 당국은 범인을 찾을 의무가 생겨요.'], ['본인의 선택', '용의선상에 오른 사람은 자기 기록에서 무죄를 보일 자료를 꺼내 내거나, 내지 않거나, 사실을 인정하고 진술할 수 있어요.'], ['최소 제출', '요청 기간 안의 기록 중 내가 고른 것만 내요.'], ['무결성', '기록을 해시 사슬로 이어 고치거나 끼워 넣으면 드러나게 해요.']])));
  kids.push(table(['따져 볼 법·제도', '쟁점'], rows2([['진술 거부권(헌법 제12조 제2항)', '자기에게 불리한 진술을 강요받지 않아요. 제출·진술을 거부해도 그 자체를 불리하게 쓰지 않도록 정해야 해요.'], ['무죄 추정(헌법 제27조 제4항)', '유죄 입증 책임은 수사 기관에 있어요. 알리바이 제출이 의무가 되면 안 돼요.'], ['영장주의(헌법 제12조 제3항)', '강제로 가져가려면 영장이 필요하고, 영장 없는 요청은 임의 제출이에요.'], ['증거 능력', '내가 적은 기록, 기기 시계의 시각은 그대로 증거가 되지 않을 수 있어요. 기기·공인 시각 증명과 연결이 필요해요.'], ['상대의 사생활', '내가 당사자인 사건만 기록해야 해요. 당사자가 아닌 사람의 대화를 몰래 기록하는 것은 통신비밀보호법 등으로 금지될 수 있고, 내 기록을 공개할 때 상대의 정보도 함께 나갈 수 있어요.'], ['상대가 부인할 때', '양측 기록이 서로 다르면 해시 사슬과 공인 시각 증명 같은 무결성 근거가 중요해져요.']])));
  kids.push(h('div', { class:'note', style:'margin-top:12px', text:'법률 판단은 이 화면이 대신하지 않아요. 법률 인프라 AI와 변호사에게 확인하세요.' }));
  kids.push(h('div', { class:'rowf', style:'margin-top:12px' }, [btn('감시 AI에게 묻기', 'quiet', function () { ask('내 활동 기록을 나만 볼 수 있게 하면서도 알리바이로 쓸 수 있게 하려면 어떤 장치가 필요한가요?'); })]));
  return kids;
}

function render() {
  var root = $('wc-root'), tp = $('wc-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = S.view === 'log' ? viewLog() : S.view === 'report' ? viewReport() : S.view === 'request' ? viewRequest() : S.view === 'decide' ? viewDecide() : S.view === 'principle' ? viewPrinciple() : viewHome();
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
  M = el; el.textContent = ''; el.classList.add('wch'); S.subjects = []; S.entries = []; S.reports = []; S.reqs = []; S.decs = []; S.sel = ''; S.pick = {}; S.rpick = {}; S.confirm = false; S.err = {}; S.msg = '';
  S.ef = { t:'', subject:'', cat:CATS[0], text:'', with:'' }; S.sf = { name:'', kind:'개인' }; S.rf = { t:'', facts:'', guess:'' }; S.qf = { org:'', summary:'', basis:BASIS[0], from:'', to:'' }; S.df = { act:ACTS[0] }; load();
  [h('div', { id:'wc-top' }), h('div', { class:'wrap', id:'wc-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'home'; render();
}
window.NaviWatch = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  sha256:sha256, verifyChain:verifyChain, reportPreview:reportPreview, inWindow:inWindow, packagePreview:packagePreview, entryHash:entryHash,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
