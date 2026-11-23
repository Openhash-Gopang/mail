/* traffic-app.js — 나비웹 교통(인프라 AI · 교통). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviTraffic.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 traffic.css(.trf 범위). 전역은 NaviTraffic 하나만 쓴다.
 *
 * 교통 화면의 특징(주피터 지시, 설계 원칙): 모든 차량이 테슬라 택시 수준의 자율주행이고 모든 시민이 공유 차량을 이용한다고 상정해, 사회 교통 총 비용이 최소가 되도록 개별 차량의 운영 계획을 세우고 집행한다.
 *  - 모든 차량이 자율주행이므로 복잡한 컴퓨팅 장치가 필요 없다. 차량은 도로 위에 표시된 주행 안내선을 따라가고, 서버가 모든 차량의 현재 위치를 파악해 통제한다.
 *  - 그래서 차량끼리 부딪히거나 특정 구간이 막히지 않고, 도로가 주정차 차량이 없어 원활하다.
 *  - 모든 시민이 공유 차량을 쓰므로 도시의 차량 총 대수를 기존의 1/2 이하로 줄일 수 있다.
 *  - 사람이 운전하는 특수한 경우는 나중에 예외 프로세스로 따로 만든다.
 * 이 화면은 계산할 수 있는 부분을 사용자가 넣은 값으로 보여 준다: fleetSize(공유 차량 규모), gaps(차간 거리 점검), intersect(교차로 통과 순서).
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 차량 위치 파악·통제, 주행 안내선, 공유 차량 배차는 아직 설계 단계로 연결되어 있지 않다. 이 화면은 차량을 부르거나 제어하지 않고 정보를 밖으로 보내지 않는다.
 *  - 계산은 내가 넣은 값만 쓰며 실제 도로·차량 데이터가 아니다. 공유 차량 규모는 평균 가동 비율만 쓴 단순 추정이다(첨두 수요 등은 반영 안 함). 이동 메모는 이 브라우저(localStorage)에만 저장된다.
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
var KEY = 'navi-traffic-v1', MAXP = 100;
var TABS = [['principle', '교통 원리'], ['fleet', '공유 차량 규모'], ['control', '충돌·혼잡 방지'], ['trips', '이동 메모']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var STATES = ['예정', '완료'];
var M = null, LS = {};
var S = { view:'principle', list:[], err:{}, msg:'',
  fl:{ cars:'', now:'', shared:'' }, gp:{ pos:'', safe:'' }, ix:{ arr:'', gap:'' },
  tr:{ from:'', to:'', d:'', n:'1' } };

function field(id, label, val, o) {
  o = o || {}; var e = o.err, inp = h('input', { id:id, type:'text', value:val == null ? '' : val, placeholder:o.ph || '', maxlength:o.max || '60', inputmode:o.mode || '', autocomplete:'off', 'aria-invalid':e ? 'true' : 'false' });
  inp.oninput = function () { if (o.set) o.set(inp.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), inp, h('div', { id:id + '-h', class:e ? 'err' : 'help', text:e || o.help || '' })]);
}

function empty(t, b) { return h('div', { class:'card', style:'margin-top:16px' }, [h('div', { class:'empty', text:t }), b ? h('div', { class:'rowf', style:'justify-content:center' }, [b]) : null]); }

function head(title, lead) { return [h('h1', { text:title }), lead ? h('p', { class:'lead', text:lead }) : null]; }
function go(v) { S.view = v; S.err = {}; S.msg = ''; render(); try { M.scrollIntoView({ block:'start' }); } catch (e) {} }function topbar() {
  return h('div', { class:'topin' }, [
    h('div', { class:'brand' }, [h('div', {}, [h('b', { text:'나비웹 교통' }), h('span', { text:'인프라 AI · 교통' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function notice() {
  return h('div', { class:'note info', style:'margin:16px 0', id:'tf-note', text:'이 화면은 차량을 부르거나 제어하지 않고 어떤 정보도 밖으로 보내지 않습니다. 내가 넣은 값으로 계산해 보는 것이고 이 브라우저에만 저장돼요. 실제 도로·차량 정보가 아니에요.' });
}
function tile(k, v, s, id) { return h('div', { class:'tile' }, [h('div', { class:'k', text:k }), h('div', { class:'num', id:id, style:'font-size:20px;font-weight:700', text:v }), s ? h('div', { class:'sub', text:s }) : null]); }
function sel(id, label, val, opts, set) {
  var s = h('select', { id:id, 'aria-label':label }, opts.map(function (c) { return h('option', { value:c[0], text:c[1] }); })); s.value = val; s.onchange = function () { set(s.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), s, h('div', { class:'help', text:'' })]);
}
function stepsCard(title, st, foot) {
  return h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:title }), h('div', {}, st.map(function (x, i) { return h('div', { class:'stp' }, [h('i', { text:String(i + 1) }), h('div', {}, [h('b', { text:x[0] }), h('span', { text:x[1] })])]); })), foot ? h('div', { class:'note info', text:foot }) : null]);
}


function load() {
  try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v || typeof v !== 'object') return; S.list = (Array.isArray(v.list) ? v.list : []).map(fixP).filter(Boolean).slice(0, MAXP); } catch (e) {}
}
function fixP(x) {
  if (!x || typeof x !== 'object' || STATES.indexOf(x.st) < 0) return null;
  var n = Number(x.n); if (!(n >= 1 && n <= 10) || Math.floor(n) !== n) return null;
  var from = clean(x.from, 30), to = clean(x.to, 30); if (!from || !to) return null;
  return { id:clean(x.id, 20) || uid(), from:from, to:to, d:/^\d{4}-\d{2}-\d{2}$/.test(x.d) ? x.d : '', n:n, st:x.st };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ list:S.list })); } catch (e) {} }

/** 공유 차량 규모(단순 추정): 지금 차량이 쓰이는 시간 비율(now%)이 공유로 shared%가 되면 필요한 차량 수 = cars × now / shared. 첨두 수요는 반영하지 않는다. */
function fleetSize(cars, now, shared) {
  var c = numOf(cars), a = numOf(now), b = numOf(shared);
  if (!isFinite(c) || c < 1 || c > 1e8 || Math.floor(c) !== c || !isFinite(a) || !(a > 0 && a <= 100) || !isFinite(b) || !(b >= a && b <= 100)) return null;
  var need = Math.ceil(c * a / b), ratio = need / c; return { need:need, saved:c - need, ratio:ratio, half:ratio <= 0.5 };
}
/** 차간 거리 점검: 한 차로의 차량 위치(m)를 정렬해 앞뒤 간격을 구하고, 안전 간격보다 좁은 쌍을 센다. */
function gaps(positions, safe) {
  var p = (positions || []).map(numOf), s = numOf(safe);
  if (p.length < 2 || p.length > 500 || p.some(function (x) { return !isFinite(x) || x > 1e7; }) || !(s > 0) || s > 1000) return null;
  p = p.slice().sort(function (a, b) { return a - b; }); var g = [], tight = 0;
  for (var i = 1; i < p.length; i++) { var d = p[i] - p[i - 1]; g.push(d); if (d < s) tight++; }
  return { gaps:g, min:Math.min.apply(null, g), tight:tight, ok:tight === 0 };
}
/** 교차로 통과 순서: 서로 엇갈리는 방향의 차량이 도착한 시각(초)을 도착순으로 세우고, 앞 차량과 gap초 이상 띄워 통과시킨다. 같은 시각에 두 대가 지나는 일이 없다. */
function intersect(arrivals, gap) {
  var a = (arrivals || []).map(numOf), g = numOf(gap);
  if (a.length < 2 || a.length > 200 || a.some(function (x) { return !isFinite(x) || x > 1e6; }) || !(g > 0) || g > 600) return null;
  a = a.slice().sort(function (x, y) { return x - y; }); var rows = [], prev = -Infinity, total = 0, max = 0;
  a.forEach(function (t, i) { var pass = Math.max(t, prev + g), w = pass - t; rows.push({ i:i + 1, arrive:t, pass:pass, wait:w }); prev = pass; total += w; if (w > max) max = w; });
  return { rows:rows, total:total, max:max };
}

// ── 교통 원리 ──
function viewPrinciple() {
  var kids = head('교통 원리', '나비웹 교통 인프라는 사회 교통 총 비용이 최소가 되도록 모든 차량의 운영 계획을 세우고 집행합니다.');
  kids.push(stepsCard('교통이 움직이는 방식', [['모든 차량이 자율주행, 모든 시민이 공유 차량 이용', '테슬라 택시 수준의 자율주행을 상정합니다. 사람이 운전하는 특수한 경우는 나중에 예외 프로세스로 따로 만들어요.'], ['도로 위 주행 안내선을 따라 주행', '모든 차량이 자율주행이라 복잡한 컴퓨팅 장치가 필요 없고, 차량은 도로에 표시된 안내선을 따라갑니다.'], ['서버가 모든 차량의 위치를 파악하고 통제', '그래서 두 차량이 부딪히거나 특정 구간이 막히는 일이 없고, 길가에 서 있는 주정차 차량도 없어 교통이 원활합니다.'], ['공유 차량으로 차량 총 대수 1/2 이하', '모든 시민이 공유 차량을 이용하면 도시의 차량 총 대수를 기존의 절반 이하로 줄일 수 있습니다.']],
    '설계 원칙입니다. 차량 위치 파악·통제, 주행 안내선, 공유 차량 배차는 아직 연결되어 있지 않아요. 이 화면에서는 같은 원리를 내가 넣은 값으로 계산해 볼 수 있습니다.'));
  kids.push(h('div', { class:'g2', style:'margin-top:16px' }, [['공유 차량 규모', '공유하면 차량이 얼마나 줄어드는지', 'fleet'], ['충돌·혼잡 방지', '차간 거리 점검과 교차로 통과 순서', 'control'], ['이동 메모', '가려는 곳을 적어 두기', 'trips']].map(function (x) { return h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:x[0] }), h('span', { class:'sub', text:x[1] }), h('div', { class:'rowf' }, [btn('열기', 'fill', function () { go(x[2]); })])]); })));
  return kids;
}

// ── 공유 차량 규모 ──
function viewFleet() {
  var kids = head('공유 차량 규모', '모두가 공유 차량을 쓰면 차량이 몇 대나 필요한지 추정합니다.'); kids.push(notice());
  var f = S.fl, out = h('div', { id:'tf-f-out', style:'margin-top:12px' });
  function upd() { out.textContent = ''; var r = fleetSize(f.cars, f.now, f.shared); out.appendChild(!r ? h('div', { class:'sub', text:'차량 수(정수), 지금 가동 비율, 공유 가동 비율(지금 이상, 100 이하)을 넣어 주세요.' }) : h('div', {}, [h('div', { class:'g2' }, [tile('필요한 차량', won(r.need) + '대', '지금의 ' + Math.round(r.ratio * 1000) / 10 + '%', 'tf-f-need'), tile('줄어드는 차량', won(r.saved) + '대', '', 'tf-f-saved')]), h('div', { id:'tf-f-res', class:r.half ? 'note info' : 'note', style:'margin-top:12px', text:r.half ? '차량 총 대수를 1/2 이하로 줄일 수 있는 값이에요.' : '이 값으로는 1/2 이하가 안 돼요. 공유 가동 비율이 지금의 2배 이상이어야 해요.' })])); }
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('div', { class:'frm' }, [field('tf-f-cars', '도시의 차량 수(대)', f.cars, { mode:'numeric', max:9, ph:'예: 100000', set:function (v) { f.cars = v; upd(); } }), field('tf-f-now', '지금 차량이 쓰이는 시간 비율(%)', f.now, { mode:'decimal', max:5, ph:'예: 5', help:'내가 넣는 값이에요', set:function (v) { f.now = v; upd(); } }), field('tf-f-shared', '공유하면 쓰이는 시간 비율(%)', f.shared, { mode:'decimal', max:5, ph:'예: 15', set:function (v) { f.shared = v; upd(); } })]), out, h('div', { class:'sub', style:'margin-top:8px', text:'평균 가동 비율만 쓴 단순 추정이에요. 출퇴근 시간대 같은 첨두 수요는 반영하지 않았어요.' })])); upd();
  return kids;
}

// ── 충돌·혼잡 방지 ──
function viewControl() {
  var kids = head('충돌·혼잡 방지', '서버가 모든 차량의 위치를 알면 부딪히거나 엉키는 일을 미리 막을 수 있습니다.'); kids.push(notice());
  var g = S.gp, x = S.ix, go1 = h('div', { id:'tf-g-out', style:'margin-top:12px' }), xo = h('div', { id:'tf-x-out', style:'margin-top:12px' });
  function gu() { go1.textContent = ''; var r = gaps(g.pos.split(/[\s,]+/).filter(Boolean), g.safe); go1.appendChild(!r ? h('div', { class:'sub', text:'차량 위치 2개 이상과 안전 간격을 숫자로 넣어 주세요.' }) : h('div', { id:'tf-g-res', class:r.ok ? 'note info' : 'note', role:r.ok ? null : 'alert', text:'가장 좁은 간격 ' + Math.round(r.min * 10) / 10 + 'm — ' + (r.ok ? '모든 차량이 안전 간격 이상이에요.' : '안전 간격보다 좁은 쌍이 ' + r.tight + '곳 있어요. 서버가 뒤 차량을 감속시켜 간격을 벌립니다.') })); }
  function xu() { xo.textContent = ''; var r = intersect(x.arr.split(/[\s,]+/).filter(Boolean), x.gap); xo.appendChild(!r ? h('div', { class:'sub', text:'도착 시각 2개 이상(초)과 통과 간격(초)을 넣어 주세요.' }) : h('div', {}, [h('div', { class:'g2' }, [tile('가장 오래 기다림', Math.round(r.max * 10) / 10 + '초', '', 'tf-x-max'), tile('기다림 합계', Math.round(r.total * 10) / 10 + '초', '', 'tf-x-total')]), h('div', { class:'card', style:'padding:0;margin-top:12px' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['차량', '도착(초)', '통과(초)', '기다림(초)'].map(function (t, i) { return h('th', { class:i ? 'r' : '', text:t }); }))]), h('tbody', {}, r.rows.map(function (w) { return h('tr', {}, [h('td', { text:w.i + '번' }), h('td', { class:'r num', text:String(Math.round(w.arrive * 10) / 10) }), h('td', { class:'r num', text:String(Math.round(w.pass * 10) / 10) }), h('td', { class:'r num', text:String(Math.round(w.wait * 10) / 10) })]); }))])])]), h('div', { class:'sub', style:'margin-top:8px', text:'서버가 통과 순서를 정해 주므로 같은 시각에 두 차량이 교차 지점을 지나는 일이 없어요.' })])); }
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'차간 거리 점검' }), h('div', { class:'sub', text:'한 차로 위 차량 위치(m)를 넣으면 앞뒤 간격을 확인해요.' }), h('div', { class:'frm' }, [field('tf-g-pos', '차량 위치(m, 쉼표로 구분)', g.pos, { ph:'예: 0, 30, 55, 90', max:200, set:function (v) { g.pos = v; gu(); } }), field('tf-g-safe', '안전 간격(m)', g.safe, { mode:'decimal', max:5, ph:'예: 20', set:function (v) { g.safe = v; gu(); } })]), go1])); gu();
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'교차로 통과 순서' }), h('div', { class:'sub', text:'엇갈리는 방향의 차량이 교차로에 도착하는 시각(초)을 넣으면 통과 순서와 기다림을 계산해요.' }), h('div', { class:'frm' }, [field('tf-x-arr', '도착 시각(초, 쉼표로 구분)', x.arr, { ph:'예: 0, 1, 1.5, 6', max:200, set:function (v) { x.arr = v; xu(); } }), field('tf-x-gap', '통과 간격(초)', x.gap, { mode:'decimal', max:5, ph:'예: 2', set:function (v) { x.gap = v; xu(); } })]), xo])); xu();
  return kids;
}

// ── 이동 메모 ──
function addT() {
  var f = S.tr, e = {}, from = clean(f.from, 30), to = clean(f.to, 30), n = numOf(f.n), d = f.d.trim();
  if (!from) e.from = '출발지를 적어 주세요.'; if (!to) e.to = '도착지를 적어 주세요.'; if (!(n >= 1 && n <= 10) || Math.floor(n) !== n) e.n = '인원은 1~10명이에요.'; if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) e.d = '날짜는 2026-11-23 모양으로 적어 주세요.'; if (S.list.length >= MAXP) e.from = '메모는 최대 ' + MAXP + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  S.list.push({ id:uid(), from:from, to:to, d:d, n:n, st:'예정' }); f.from = ''; f.to = ''; S.msg = '메모에 저장했어요. 차량은 부르지 않았어요.'; save(); render();
}
function viewTrips() {
  var kids = head('이동 메모', '가려는 곳을 적어 둡니다. 차량 호출은 아직 연결되어 있지 않아요.'); kids.push(notice());
  var f = S.tr, e = S.err;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('div', { class:'frm' }, [field('tf-t-from', '출발지', f.from, { err:e.from, max:30, ph:'예: 제주공항', set:function (v) { f.from = v; } }), field('tf-t-to', '도착지', f.to, { err:e.to, max:30, ph:'예: 한림읍', set:function (v) { f.to = v; } }), field('tf-t-d', '날짜(선택)', f.d, { err:e.d, ph:kst(), mode:'numeric', max:10, set:function (v) { f.d = v; } }), field('tf-t-n', '인원', f.n, { err:e.n, mode:'numeric', max:2, set:function (v) { f.n = v; } })]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('메모 저장', 'fill', addT), btn('교통 AI에게 묻기', 'quiet', function () { ask('내일 아침 제주공항에서 한림까지 가는 방법을 알려 주세요.'); }), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  if (S.list.length) kids.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['출발', '도착', '날짜', '인원', '상태', ''].map(function (t) { return h('th', { text:t }); }))]), h('tbody', {}, S.list.map(function (x) { return h('tr', {}, [h('td', { text:x.from }), h('td', { text:x.to }), h('td', { class:'num', text:x.d || '—' }), h('td', { text:x.n + '명' }), h('td', {}, [pill(x.st, x.st === '완료' ? 'm' : '')]), h('td', { class:'r' }, [btn(x.st === '예정' ? '완료로' : '예정으로', 'sm quiet', function () { x.st = x.st === '예정' ? '완료' : '예정'; save(); render(); }), btn('삭제', 'sm quiet', function () { S.list = S.list.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]); }))])])]));
  else kids.push(empty('아직 메모가 없어요. 위에서 첫 이동을 적어 보세요.'));
  return kids;
}

function render() {
  var root = $('tf-root'), tp = $('tf-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = S.view === 'fleet' ? viewFleet() : S.view === 'control' ? viewControl() : S.view === 'trips' ? viewTrips() : viewPrinciple();
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
  M = el; el.textContent = ''; el.classList.add('trf'); S.list = []; S.err = {}; S.msg = ''; load();
  [h('div', { id:'tf-top' }), h('div', { class:'wrap', id:'tf-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'principle'; render();
}
window.NaviTraffic = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  fleetSize:fleetSize, gaps:gaps, intersect:intersect,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
