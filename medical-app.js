/* medical-app.js — 나비웹 의료(인프라 AI · 의료). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviMedical.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 medical.css(.med 범위). 전역은 NaviMedical 하나만 쓴다.
 *
 * 의료 화면의 특징(주피터 지시, 설계 원칙): 나비웹 의료 인프라는 기존 건강보험공단의 역할과 기능을 확대해 국민 개개인의 의료 정보를 하나의 인프라로 취합한다.
 *  다만 개인 의료 정보는 그 개인의 PDV에 보관하고, 의료 기관의 요청이 있을 때 특정 데이터만 익명화해 의료 인프라에 제출한다.
 *  의료 인프라는 개인의 진술(예: 허리가 아파요), 생체 정보(혈압·심박수 등), 질병 이력, 가족력, 생활 습관(흡연·음주·운동 등)을 종합해 가능한 질병을 확률이 높은 것부터 낮은 것까지 순서대로 의료 기관에 전달한다.
 *  의료 기관의 AI 비서는 이를 특정 의료진에게 제공해 진료·진단의 참고로 쓰게 하고, 의료진이 최종 진단·처치·처방을 결정하며, 이 모든 과정이 의료 인프라에 기록된다.
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 위 원칙은 아직 설계 단계다. 지금은 의료 기관·건강보험 연결, 질병 확률 계산, 제출·기록이 연결되어 있지 않고, 이 화면은 어떤 정보도 밖으로 보내지 않는다.
 *  - 이 화면은 진단하거나 질병 가능성을 알려 주지 않는다. 질병 이름이나 확률은 지어내지 않는다(전달 형식은 '후보 A' 같은 자리표시로만 보여 준다). 진단·처치·처방은 의료진이 한다.
 *  - '내 의료 정보'·'진료 기록'·'제출 범위'는 사용자가 직접 적는 기록이고 이 브라우저(localStorage)에만 저장된다(설계에서는 PDV에 보관).
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
var KEY = 'navi-med-v1', MAXL = 100;
var TABS = [['profile', '내 의료 정보'], ['submit', '제출 범위'], ['principle', '의료 인프라 원리'], ['rank', '진료 참고 목록'], ['visits', '진료 기록']];
var VIEWS = TABS.map(function (t) { return t[0]; });
/** 의료 기관이 요청할 수 있는 데이터 종류. 이름·주민번호·정확한 주소 같은 신원 정보는 어떤 경우에도 제출하지 않는다(익명화). */
var CATS = [['stmt', '진술(증상)'], ['vit', '생체 정보'], ['hist', '질병 이력'], ['fam', '가족력'], ['life', '생활 습관']];
var LIFE = { smoke:['안 함', '과거에 함', '현재 함'], drink:['안 함', '주 1~2회', '주 3회 이상'], exer:['거의 안 함', '주 1~2회', '주 3회 이상'] };
var LIFE_LABEL = { smoke:'흡연', drink:'음주', exer:'운동' };
var STEPS = [['개인 의료 정보는 내 PDV에 보관', '진술·생체 정보·질병 이력·가족력·생활 습관은 그 개인의 PDV에 보관됩니다. 기관이 마음대로 가져가지 못해요.'], ['의료 기관이 특정 데이터를 요청', '진료할 때 의료 기관이 필요한 데이터 종류를 요청합니다.'], ['익명화해서 제출', '요청한 특정 데이터만, 내가 허용한 범위에서 익명화해 나비웹 의료 인프라에 제출합니다.'], ['가능한 질병을 확률 순서로 전달', '의료 인프라가 진술·생체 정보·질병 이력·가족력·생활 습관을 종합해 가능한 질병을 확률이 높은 것부터 낮은 것까지 순서대로 의료 기관에 전달합니다.'], ['의료 기관 AI 비서가 의료진에게 제공', '의료 기관의 AI 비서가 특정 의료진에게 이 정보를 제공해 진료와 진단에 참고하게 합니다.'], ['의료진이 최종 결정, 모두 기록', '의료진이 참고 자료를 보고 최종 진단·처치·처방을 결정하며, 이 모든 과정이 나비웹 의료 인프라에 기록됩니다.']];
var M = null, LS = {};
var S = { view:'profile', p:{ st:[], vit:[], hist:[], fam:[], life:{} }, share:{}, req:{}, sform:{}, vform:{}, hform:{}, fform:{}, visit:{}, vlist:[], rank:[{ n:'후보 A', s:'' }, { n:'후보 B', s:'' }, { n:'후보 C', s:'' }], err:{}, msg:'' };

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
    var p = v.p && typeof v.p === 'object' ? v.p : {};
    S.p.st = (Array.isArray(p.st) ? p.st : []).map(fixTxt).filter(Boolean).slice(0, MAXL);
    S.p.hist = (Array.isArray(p.hist) ? p.hist : []).map(fixTxt).filter(Boolean).slice(0, MAXL);
    S.p.fam = (Array.isArray(p.fam) ? p.fam : []).map(fixTxt).filter(Boolean).slice(0, MAXL);
    S.p.vit = (Array.isArray(p.vit) ? p.vit : []).map(fixVit).filter(Boolean).slice(0, MAXL);
    if (p.life && typeof p.life === 'object') { Object.keys(LIFE).forEach(function (k) { if (LIFE[k].indexOf(p.life[k]) >= 0) S.p.life[k] = p.life[k]; }); if (typeof p.life.sleep === 'string') S.p.life.sleep = p.life.sleep.slice(0, 4); }
    if (v.share && typeof v.share === 'object') CATS.forEach(function (c) { if (v.share[c[0]]) S.share[c[0]] = 1; });
    S.vlist = (Array.isArray(v.vlist) ? v.vlist : []).map(fixVisit).filter(Boolean).slice(0, MAXL);
  } catch (e) {}
}
function fixTxt(x) { if (!x || typeof x !== 'object') return null; var t = clean(x.t, 120); if (!t) return null; return { id:clean(x.id, 20) || uid(), t:t, d:/^\d{4}-\d{2}-\d{2}$/.test(x.d) ? x.d : '' }; }
function fixVit(x) {
  if (!x || typeof x !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(x.d)) return null;
  var o = { id:clean(x.id, 20) || uid(), d:x.d }, any = false;
  ['sys', 'dia', 'hr', 'temp', 'wt', 'ht'].forEach(function (k) { var n = Number(x[k]); if (x[k] !== '' && x[k] != null && isFinite(n) && n > 0 && n < 1000) { o[k] = n; any = true; } });
  return any ? o : null;
}
function fixVisit(x) {
  if (!x || typeof x !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(x.d)) return null; var org = clean(x.org, 40); if (!org) return null;
  return { id:clean(x.id, 20) || uid(), d:x.d, org:org, dept:clean(x.dept, 20), dx:clean(x.dx, 80), tx:clean(x.tx, 120), memo:clean(x.memo, 120) };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ p:S.p, share:S.share, vlist:S.vlist })); } catch (e) {} }

/** 체질량지수(BMI): 몸무게 kg ÷ (키 m)². 숫자 범위를 벗어나면 null. 판정(정상·과체중 등)은 붙이지 않는다. */
function bmi(wt, ht) {
  var w = numOf(wt), h2 = numOf(ht); if (!isFinite(w) || !isFinite(h2) || w < 2 || w > 500 || h2 < 50 || h2 > 250) return null;
  return Math.round(w / Math.pow(h2 / 100, 2) * 10) / 10;
}
function latestVit(list) { return list.slice().sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; })[0] || null; }
/** 의료 기관이 요청한 종류(req) 중 내가 허용한 것(share)만 제출 대상, 나머지는 막힌 항목, 요청하지 않은 항목은 제출하지 않는다. */
function submission(share, req) {
  var send = [], blocked = [];
  CATS.forEach(function (c) { if (!req[c[0]]) return; (share[c[0]] ? send : blocked).push(c[0]); });
  return { send:send, blocked:blocked };
}
/** 익명 요약: 제출 대상 종류만 담고 이름·주민번호·주소 같은 신원 정보는 넣지 않는다. */
function summaryText(p, keys) {
  var out = ['[익명 의료 요약 — 신원 정보 없음]'], has = function (k) { return keys.indexOf(k) >= 0; };
  if (has('stmt')) out.push('진술: ' + (p.st.length ? p.st.map(function (x) { return x.t; }).join('; ') : '없음'));
  if (has('vit')) { var v = latestVit(p.vit); if (!v) out.push('생체 정보: 없음'); else { var f = []; if (v.sys && v.dia) f.push('혈압 ' + v.sys + '/' + v.dia); if (v.hr) f.push('심박수 ' + v.hr); if (v.temp) f.push('체온 ' + v.temp); if (v.wt) f.push('체중 ' + v.wt + 'kg'); if (v.ht) f.push('키 ' + v.ht + 'cm'); var b = bmi(v.wt, v.ht); if (b != null) f.push('BMI ' + b); out.push('생체 정보(' + v.d + '): ' + f.join(', ')); } }
  if (has('hist')) out.push('질병 이력: ' + (p.hist.length ? p.hist.map(function (x) { return x.t; }).join('; ') : '없음'));
  if (has('fam')) out.push('가족력: ' + (p.fam.length ? p.fam.map(function (x) { return x.t; }).join('; ') : '없음'));
  if (has('life')) { var l = Object.keys(LIFE).filter(function (k) { return p.life[k]; }).map(function (k) { return LIFE_LABEL[k] + ' ' + p.life[k]; }); if (p.life.sleep) l.push('수면 ' + p.life.sleep + '시간'); out.push('생활 습관: ' + (l.length ? l.join(', ') : '없음')); }
  return out.join('\n');
}
/** 순서 정렬 시연: 후보별 점수를 합 1(100%)로 정규화해 높은 것부터 나열한다. 의학적 계산이 아니다. 점수가 숫자가 아니거나 0 이하인 줄은 뺀다. */
function rankCandidates(list) {
  var xs = (list || []).map(function (x, i) { return { n:clean(x.n, 20), s:numOf(x.s), i:i }; }).filter(function (x) { return x.n && isFinite(x.s) && x.s > 0 && x.s <= 1e9; });
  if (!xs.length) return null; var sum = xs.reduce(function (a, x) { return a + x.s; }, 0);
  return xs.sort(function (a, b) { return b.s - a.s || a.i - b.i; }).map(function (x, r) { return { rank:r + 1, name:x.n, pct:x.s / sum * 100 }; });
}

function topbar() {
  return h('div', { class:'topin' }, [
    h('div', { class:'brand' }, [h('div', {}, [h('b', { text:'나비웹 의료' }), h('span', { text:'인프라 AI · 의료' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function warn() {
  return h('div', { class:'note', role:'alert', style:'margin:16px 0', id:'med-warn' }, [h('b', { text:'위급하면 119에 먼저 전화하세요. ' }), '이 화면은 진단이나 처방을 하지 않고 의료 기관과 연결되어 있지 않습니다. 진단·처치·처방은 의료진이 합니다.']);
}
function tile(k, v, s, id) { return h('div', { class:'tile' }, [h('div', { class:'k', text:k }), h('div', { class:'num', id:id, style:'font-size:20px;font-weight:700', text:v }), s ? h('div', { class:'sub', text:s }) : null]); }
function sel(id, label, val, opts, set) {
  var s = h('select', { id:id, 'aria-label':label }, opts.map(function (c) { return h('option', { value:c[0], text:c[1] }); })); s.value = val; s.onchange = function () { set(s.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), s, h('div', { class:'help', text:'' })]);
}
function addTxt(key, f, id) {
  var t = clean(f.t, 120); if (!t) { S.err = {}; S.err[key] = '내용을 적어 주세요.'; S.msg = ''; return render(); }
  if (S.p[key].length >= MAXL) { S.err = {}; S.err[key] = '기록은 최대 ' + MAXL + '개까지예요.'; return render(); }
  S.p[key].push({ id:uid(), t:t, d:kst() }); f.t = ''; S.err = {}; S.msg = '기록했어요.'; save(); render();
}
function txtCard(key, title, hint, ph, form, aid) {
  var list = S.p[key], e = S.err[key];
  return h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:title }), h('div', { class:'sub', text:hint }),
    h('div', { class:'frm' }, [field(aid, '내용', form.t, { err:e, ph:ph, max:120, set:function (v) { form.t = v; } })]), h('div', { class:'rowf' }, [btn('추가', 'fill', function () { addTxt(key, form); })]),
    list.length ? h('div', {}, list.map(function (x) { return h('div', { class:'kv' }, [h('span', { text:(x.d ? x.d + ' · ' : '') + x.t }), btn('삭제', 'sm quiet', function () { S.p[key] = S.p[key].filter(function (y) { return y.id !== x.id; }); save(); render(); })]); })) : h('div', { class:'sub', text:'아직 없어요.' })]);
}

// ── 내 의료 정보 ──
function addVit() {
  var f = S.vform, d = f.d || kst(), o = { id:uid(), d:d }, e = {}, any = false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) e.d = '날짜는 2026-11-23 모양으로 적어 주세요.';
  [['sys', 1, 300], ['dia', 1, 200], ['hr', 1, 300], ['temp', 30, 45], ['wt', 2, 500], ['ht', 50, 250]].forEach(function (r) { var v = f[r[0]]; if (v === '' || v == null) return; var n = numOf(v); if (!isFinite(n) || n < r[1] || n > r[2]) e[r[0]] = r[1] + '~' + r[2] + ' 사이 숫자'; else { o[r[0]] = n; any = true; } });
  if (!any && !Object.keys(e).length) e.sys = '하나 이상 적어 주세요.'; if ((o.sys && !o.dia) || (o.dia && !o.sys)) e.dia = '혈압은 수축기·이완기를 함께 적어 주세요.';
  if (S.p.vit.length >= MAXL) e.sys = '기록은 최대 ' + MAXL + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  S.p.vit.push(o); S.vform = {}; S.msg = '기록했어요.'; save(); render();
}
function viewProfile() {
  var kids = head('내 의료 정보', '진료받을 때 필요한 내 정보를 한곳에 정리합니다. 설계상 이 정보는 내 PDV에 보관돼요.'); kids.push(warn());
  var v = latestVit(S.p.vit);
  kids.push(h('div', { class:'g4' }, [tile('진술', S.p.st.length + '건', '', 'med-t0'), tile('최근 혈압', v && v.sys ? v.sys + '/' + v.dia : '—', v ? v.d : '', 'med-t1'), tile('질병 이력', S.p.hist.length + '건', '', 'med-t2'), tile('가족력', S.p.fam.length + '건', '', 'med-t3')]));
  kids.push(h('div', { class:'g2', style:'margin-top:16px;align-items:start' }, [txtCard('st', '진술(증상)', '내가 느끼는 증상을 말하듯 적어요.', '예: 허리가 아파요', S.sform, 'med-st'), txtCard('hist', '질병 이력', '진단받은 적이 있는 병, 수술·입원 등', '예: 2022년 위염 진단', S.hform, 'med-hist'), txtCard('fam', '가족력', '가족이 진단받은 병', '예: 아버지 고혈압', S.fform, 'med-fam')]));
  var f = S.vform, e = S.err, b = bmi(f.wt || (v && v.wt), f.ht || (v && v.ht));
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'생체 정보 적기' }), h('div', { class:'sub', text:'측정한 값만 적어요(비워도 돼요). 혈압은 수축기·이완기를 함께 적습니다.' }),
    h('div', { class:'frm' }, [field('med-v-d', '측정일', f.d, { err:e.d, ph:kst(), mode:'numeric', max:10, set:function (x) { f.d = x.trim(); } }), field('med-v-sys', '수축기 혈압', f.sys, { err:e.sys, mode:'numeric', max:3, set:function (x) { f.sys = x; } }), field('med-v-dia', '이완기 혈압', f.dia, { err:e.dia, mode:'numeric', max:3, set:function (x) { f.dia = x; } }), field('med-v-hr', '심박수(분당)', f.hr, { err:e.hr, mode:'numeric', max:3, set:function (x) { f.hr = x; } }),
      field('med-v-temp', '체온(℃)', f.temp, { err:e.temp, mode:'decimal', max:4, set:function (x) { f.temp = x; } }), field('med-v-wt', '체중(kg)', f.wt, { err:e.wt, mode:'decimal', max:5, set:function (x) { f.wt = x; } }), field('med-v-ht', '키(cm)', f.ht, { err:e.ht, mode:'decimal', max:5, set:function (x) { f.ht = x; } })]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('기록하기', 'fill', addVit), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null]),
    S.p.vit.length ? h('div', { class:'tbw', style:'margin-top:12px' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['날짜', '혈압', '심박수', '체온', '체중', '키', 'BMI', ''].map(function (t) { return h('th', { text:t }); }))]), h('tbody', {}, S.p.vit.slice().sort(function (a, b2) { return a.d < b2.d ? 1 : a.d > b2.d ? -1 : 0; }).map(function (x) { var bb = bmi(x.wt, x.ht); return h('tr', {}, [h('td', { class:'num', text:x.d }), h('td', { class:'num', text:x.sys ? x.sys + '/' + x.dia : '—' }), h('td', { class:'num', text:x.hr || '—' }), h('td', { class:'num', text:x.temp || '—' }), h('td', { class:'num', text:x.wt || '—' }), h('td', { class:'num', text:x.ht || '—' }), h('td', { class:'num', text:bb == null ? '—' : bb }), h('td', { class:'r' }, [btn('삭제', 'sm quiet', function () { S.p.vit = S.p.vit.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]); }))])]) : null]));
  var l = S.p.life;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'생활 습관' }), h('div', { class:'frm' },
    Object.keys(LIFE).map(function (k) { return sel('med-l-' + k, LIFE_LABEL[k], l[k] || '', [['', '(선택 안 함)']].concat(LIFE[k].map(function (x) { return [x, x]; })), function (x) { if (x) l[k] = x; else delete l[k]; save(); }); }).concat([field('med-l-sleep', '하루 수면(시간)', l.sleep || '', { mode:'decimal', max:4, set:function (x) { var n = numOf(x); if (x === '') delete l.sleep; else if (isFinite(n) && n > 0 && n <= 24) l.sleep = String(n); save(); } })])),
    h('div', { class:'sub', text:'고르는 즉시 이 브라우저에 저장돼요.' })]));
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('의료 AI에게 묻기', 'quiet', function () { ask('진료받을 때 내 증상을 어떻게 설명하면 좋을까요?'); })]));
  return kids;
}

// ── 제출 범위 ──
function viewSubmit() {
  var kids = head('제출 범위', '의료 기관이 데이터를 요청하면 어떤 것이 어떻게 나가는지 미리 봅니다.');
  kids.push(h('div', { class:'note info', style:'margin:16px 0', text:'설계 원칙: 의료 기관이 요청한 특정 데이터만, 내가 허용한 범위에서, 익명화해 나비웹 의료 인프라에 제출합니다. 이름·주민번호·정확한 주소 같은 신원 정보는 제출하지 않아요. 지금은 아무것도 전송되지 않으며, 고른 상태는 이 브라우저에만 저장됩니다.' }));
  var n = h('span', { class:'sub', id:'med-c-n' }); function tally() { n.textContent = '제출을 허용한 종류 ' + Object.keys(S.share).length + ' / ' + CATS.length; }
  var share = h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'내가 허용하는 종류' }), n, h('div', {}, CATS.map(function (c) { var id = 'med-sh-' + c[0], cb = h('input', { type:'checkbox', id:id, checked:S.share[c[0]] ? true : false }); cb.onchange = function () { if (cb.checked) S.share[c[0]] = 1; else delete S.share[c[0]]; save(); tally(); upd(); }; return h('label', { class:'chk', for:id }, [cb, h('span', { text:c[1] })]); })), h('div', { class:'rowf' }, [btn('모두 해제', 'quiet', function () { S.share = {}; save(); render(); })])]);
  var rq = h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'의료 기관이 요청했다고 가정' }), h('div', { class:'sub', text:'진료과와 상황에 따라 요청하는 종류가 달라요.' }), h('div', {}, CATS.map(function (c) { var id = 'med-rq-' + c[0], cb = h('input', { type:'checkbox', id:id, checked:S.req[c[0]] ? true : false }); cb.onchange = function () { if (cb.checked) S.req[c[0]] = 1; else delete S.req[c[0]]; upd(); }; return h('label', { class:'chk', for:id }, [cb, h('span', { text:c[1] })]); }))]);
  var out = h('div', { class:'card col', id:'med-s-out' });
  function upd() {
    out.textContent = ''; var R = submission(S.share, S.req), nm = function (k) { return CATS.filter(function (c) { return c[0] === k; })[0][1]; };
    out.appendChild(h('b', { style:'font-size:17px', text:'제출될 내용(익명)' }));
    if (!Object.keys(S.req).length) { out.appendChild(h('div', { class:'sub', text:'요청 종류를 고르면 결과가 나와요.' })); return; }
    out.appendChild(h('div', { class:'kv' }, [h('span', { text:'제출함' }), h('b', { id:'med-s-send', text:R.send.map(nm).join(', ') || '없음' })]));
    if (R.blocked.length) out.appendChild(h('div', { class:'note', id:'med-s-block', text:'허용하지 않아 제출하지 않음: ' + R.blocked.map(nm).join(', ') }));
    if (R.send.length) out.appendChild(h('pre', { id:'med-s-txt', style:'white-space:pre-wrap;font:inherit;background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:12px' , text:summaryText(S.p, R.send) }));
  }
  tally(); upd(); kids.push(h('div', { class:'g2', style:'align-items:start' }, [share, rq])); kids.push(h('div', { style:'margin-top:16px' }, [out]));
  return kids;
}

// ── 의료 인프라 원리 ──
function viewPrinciple() {
  var kids = head('의료 인프라 원리', '나비웹 의료 인프라가 의료 정보를 모으고 진료에 쓰이게 하는 방식입니다.');
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'개인 정보에서 진료까지' }), h('div', {}, STEPS.map(function (x, i) { return h('div', { class:'stp' }, [h('i', { text:String(i + 1) }), h('div', {}, [h('b', { text:x[0] }), h('span', { text:x[1] })])]); })),
    h('div', { class:'note info', text:'나비웹 의료 인프라는 기존 건강보험공단의 역할과 기능을 확대해 국민 개개인의 의료 정보를 하나의 인프라로 모으되, 개인 정보는 각자의 PDV에 두는 설계입니다.' }),
    h('div', { class:'note', id:'med-design', text:'설계 원칙입니다. 지금은 의료 기관·건강보험과 연결되어 있지 않고 질병 가능성을 계산하지 않아요. 이 화면은 어떤 정보도 밖으로 보내지 않습니다.' })]));
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('제출 범위 보기', 'fill', function () { go('submit'); })]));
  return kids;
}

// ── 진료 참고 목록 ──
function viewRank() {
  var kids = head('진료 참고 목록', '의료 인프라가 의료 기관에 전달하는 참고 목록의 모양과 순서 방식을 보여 줍니다.'); kids.push(warn());
  kids.push(h('div', { class:'note info', style:'margin-bottom:16px', text:'설계: 의료 인프라가 진술·생체 정보·질병 이력·가족력·생활 습관을 종합해 가능한 질병을 확률이 높은 것부터 낮은 것까지 순서대로 의료 기관에 전달합니다. 의료 기관의 AI 비서가 이를 특정 의료진에게 주고, 의료진이 참고해 최종 진단·처치·처방을 결정합니다. 이 화면은 실제 질병이나 확률을 보여 주지 않아요.' }));
  kids.push(h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'전달 형식 예시(자리표시)' }), h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['순위', '후보', '확률', '근거 항목'].map(function (t) { return h('th', { text:t }); }))]),
    h('tbody', {}, [['1', '후보 A (예시)', '높음', '진술 · 생체 정보'], ['2', '후보 B (예시)', '중간', '질병 이력 · 가족력'], ['3', '후보 C (예시)', '낮음', '생활 습관']].map(function (r) { return h('tr', {}, r.map(function (c) { return h('td', { text:c }); })); }))])]), h('div', { class:'sub', text:'후보 이름과 확률은 형식을 보여 주는 자리표시이며 의학 정보가 아닙니다. 마지막에 “최종 진단은 의료진이 결정”이라는 안내가 붙어요.' })]));
  var out = h('div', { id:'med-r-out', style:'margin-top:12px' });
  function upd() {
    out.textContent = ''; var R = rankCandidates(S.rank);
    out.appendChild(!R ? h('div', { class:'sub', text:'점수를 넣으면 확률이 높은 순서로 정렬해 보여 줘요.' }) : h('div', {}, R.map(function (x) { return h('div', { class:'kv' }, [h('span', { text:x.rank + '. ' + x.name }), h('b', { class:'num', text:(Math.round(x.pct * 10) / 10) + '%' })]); })));
  }
  var rows = S.rank.map(function (r, i) { return h('div', { class:'frm' }, [field('med-r-n' + i, '후보 이름', r.n, { max:20, set:function (v) { r.n = v; upd(); } }), field('med-r-s' + i, '상대 점수', r.s, { ph:'예: 5', mode:'decimal', max:8, set:function (v) { r.s = v; upd(); } })]); });
  upd(); kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'순서 정렬 연습' }), h('div', { class:'sub', text:'후보와 점수를 넣으면 합이 100%가 되게 바꿔 높은 순서로 나열합니다. 정렬 방식을 보여 주는 연습이며 의학적 계산이 아니에요.' })].concat(rows, [out])));
  return kids;
}

// ── 진료 기록 ──
function addVisit() {
  var f = S.visit, e = {}, d = f.d || kst(), org = clean(f.org, 40);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) e.d = '날짜는 2026-11-23 모양으로 적어 주세요.'; if (!org) e.org = '의료 기관 이름을 적어 주세요.'; if (S.vlist.length >= MAXL) e.org = '기록은 최대 ' + MAXL + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  S.vlist.push({ id:uid(), d:d, org:org, dept:clean(f.dept, 20), dx:clean(f.dx, 80), tx:clean(f.tx, 120), memo:clean(f.memo, 120) }); S.visit = {}; S.msg = '기록했어요.'; save(); render();
}
function viewVisits() {
  var kids = head('진료 기록', '진료받은 내용을 직접 적어 둡니다. 진단·처치·처방은 의료진이 정한 대로 적어요.'); kids.push(warn());
  kids.push(h('div', { class:'g4' }, [tile('진료 기록', S.vlist.length + '건', '', 'med-v0')]));
  var f = S.visit, e = S.err; if (!f.d) f.d = kst();
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'진료 적기' }), h('div', { class:'sub', text:'설계에서는 진료 과정이 의료 인프라에 자동으로 기록돼요. 지금은 직접 적는 기록입니다.' }),
    h('div', { class:'frm' }, [field('med-vd', '진료일', f.d, { err:e.d, mode:'numeric', max:10, set:function (x) { f.d = x.trim(); } }), field('med-vo', '의료 기관', f.org, { err:e.org, ph:'예: ○○의원', max:40, set:function (x) { f.org = x; } }), field('med-vp', '진료과(선택)', f.dept, { ph:'예: 정형외과', max:20, set:function (x) { f.dept = x; } }), field('med-vx', '의료진의 진단(선택)', f.dx, { ph:'의사가 말한 진단명', max:80, set:function (x) { f.dx = x; } }), field('med-vt', '처치·처방(선택)', f.tx, { max:120, set:function (x) { f.tx = x; } }), field('med-vm', '메모(선택)', f.memo, { max:120, set:function (x) { f.memo = x; } })]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('기록하기', 'fill', addVisit), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  if (!S.vlist.length) { kids.push(empty('아직 진료 기록이 없어요.')); return kids; }
  kids.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['진료일', '의료 기관', '진단', '처치·처방', ''].map(function (t) { return h('th', { text:t }); }))]),
    h('tbody', {}, S.vlist.slice().sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; }).map(function (x) { return h('tr', {}, [h('td', { class:'num', text:x.d }), h('td', {}, [h('b', { text:x.org }), x.dept ? h('div', { class:'sub', text:x.dept }) : null]), h('td', { text:x.dx || '—' }), h('td', {}, [x.tx || '—', x.memo ? h('div', { class:'sub', text:x.memo }) : null]), h('td', { class:'r' }, [btn('삭제', 'sm quiet', function () { S.vlist = S.vlist.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]); }))])])]));
  return kids;
}

function render() {
  var root = $('med-root'), tp = $('med-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = S.view === 'submit' ? viewSubmit() : S.view === 'principle' ? viewPrinciple() : S.view === 'rank' ? viewRank() : S.view === 'visits' ? viewVisits() : viewProfile();
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
  M = el; el.textContent = ''; el.classList.add('med'); S.p = { st:[], vit:[], hist:[], fam:[], life:{} }; S.share = {}; S.req = {}; S.vlist = []; S.err = {}; S.msg = ''; load();
  [h('div', { id:'med-top' }), h('div', { class:'wrap', id:'med-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'profile'; render();
}
window.NaviMedical = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  bmi:bmi, submission:submission, summaryText:summaryText, rankCandidates:rankCandidates,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
