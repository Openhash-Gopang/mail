/* logistics-app.js — 나비웹 물류(인프라 AI · 물류). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviLogistics.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 logistics.css(.lgs 범위). 전역은 NaviLogistics 하나만 쓴다.
 *
 * 물류 화면의 특징(주피터 지시, 설계 원칙): 물류는 자율주행 교통 인프라의 연장이다. 사회 전체의 물류 총비용이 최소가 되도록
 * 물류 물품 각각의 배송 시각과 경로를 결정하고, 실시간으로 갱신한다.
 *  - 단위는 물품 하나하나이고, 최소화 대상은 개별 업체가 아니라 사회 전체의 물류 총비용이다.
 *  - 화물도 교통 인프라의 자율주행·공유 차량으로 움직인다. 같은 방향의 물품은 한 차량에 합쳐 싣고(합차) 빈 차로 달리는 거리를 줄인다.
 *  - 도로 상황, 차량 위치, 새 주문이 바뀌면 시각과 경로를 다시 정해 갱신한다. 교통 인프라가 차량 위치를 통제하므로 도착 시각 예측이 정확하다.
 * 이 화면은 계산할 수 있는 부분을 사용자가 넣은 값으로 보여 준다: packBins(합차 효과), bestRoute(경로 순서), schedule(도착 시각·지연 반영).
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 물품 추적, 배차, 실시간 갱신은 아직 설계 단계로 연결되어 있지 않다. 이 화면은 물품을 보내거나 차량을 부르지 않고 정보를 밖으로 보내지 않는다.
 *  - 계산은 내가 넣은 값만 쓰며 실제 도로·차량·물품 데이터가 아니다. 거리는 직선거리(km)이고, 경로는 가까운 곳부터 잇고 꼬인 구간을 푸는 단순 방법이라 최적이 보장되지 않는다.
 *  - 합차는 부피 큰 것부터 넣는 단순 방법이다(물품의 종류·방향·시간 제약은 반영 안 함). 메모와 경유지는 이 브라우저(localStorage)에만 저장된다.
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
var KEY = 'navi-logistics-v1', MAXP = 100, MAXS = 30;
var TABS = [['principle', '물류 원리'], ['pack', '합차 효과'], ['route', '경로·도착 시각'], ['parcels', '물품 메모']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var STATES = ['예정', '완료'];
var M = null, LS = {};
var S = { view:'principle', list:[], stops:[], err:{}, msg:'',
  pk:{ items:'', cap:'' }, rt:{ dx:'0', dy:'0', speed:'', dwell:'', start:'', delay:'', after:'', name:'', x:'', y:'', dl:'' },
  pc:{ name:'', from:'', to:'', d:'' } };

function field(id, label, val, o) {
  o = o || {}; var e = o.err, inp = h('input', { id:id, type:'text', value:val == null ? '' : val, placeholder:o.ph || '', maxlength:o.max || '60', inputmode:o.mode || '', autocomplete:'off', 'aria-invalid':e ? 'true' : 'false' });
  inp.oninput = function () { if (o.set) o.set(inp.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), inp, h('div', { id:id + '-h', class:e ? 'err' : 'help', text:e || o.help || '' })]);
}

function empty(t, b) { return h('div', { class:'card', style:'margin-top:16px' }, [h('div', { class:'empty', text:t }), b ? h('div', { class:'rowf', style:'justify-content:center' }, [b]) : null]); }

function head(title, lead) { return [h('h1', { text:title }), lead ? h('p', { class:'lead', text:lead }) : null]; }
function go(v) { S.view = v; S.err = {}; S.msg = ''; render(); try { M.scrollIntoView({ block:'start' }); } catch (e) {} }function topbar() {
  return h('div', { class:'topin' }, [
    h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 물류' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function notice() {
  return h('div', { class:'note info', style:'margin:16px 0', id:'lg-note', text:'이 화면은 물품을 보내거나 차량을 배차하지 않고 어떤 정보도 밖으로 보내지 않습니다. 내가 넣은 값으로 계산해 보는 것이고 이 브라우저에만 저장돼요. 실제 도로·차량·물품 정보가 아니에요.' });
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
  try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v || typeof v !== 'object') return;
    S.list = (Array.isArray(v.list) ? v.list : []).map(fixP).filter(Boolean).slice(0, MAXP);
    S.stops = (Array.isArray(v.stops) ? v.stops : []).map(fixS).filter(Boolean).slice(0, MAXS); } catch (e) {}
}
function fixP(x) {
  if (!x || typeof x !== 'object' || STATES.indexOf(x.st) < 0) return null;
  var name = clean(x.name, 30), from = clean(x.from, 30), to = clean(x.to, 30); if (!name || !from || !to) return null;
  return { id:clean(x.id, 20) || uid(), name:name, from:from, to:to, d:/^\d{4}-\d{2}-\d{2}$/.test(x.d) ? x.d : '', st:x.st };
}
function fixS(x) {
  if (!x || typeof x !== 'object') return null;
  var name = clean(x.name, 30), px = Number(x.x), py = Number(x.y); if (!name || !isFinite(px) || !isFinite(py) || Math.abs(px) > 1000 || Math.abs(py) > 1000) return null;
  var dl = x.dl === '' || x.dl == null ? '' : Number(x.dl); if (dl !== '' && !(dl >= 0 && dl < 1440)) dl = '';
  return { id:clean(x.id, 20) || uid(), name:name, x:px, y:py, dl:dl };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ list:S.list, stops:S.stops })); } catch (e) {} }
function r1(n) { return Math.round(n * 10) / 10; }
/** 'HH:MM' → 하루 안의 분(0~1439). 형식이 틀리면 NaN. */
function parseHM(v) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(v == null ? '' : v).trim()); if (!m) return NaN; var h1 = Number(m[1]), mi = Number(m[2]); return h1 < 24 && mi < 60 ? h1 * 60 + mi : NaN; }
function fmtHM(min) { var m = Math.round(min), d = Math.floor(m / 1440), r = m - d * 1440, h1 = Math.floor(r / 60), mi = r % 60; return (h1 < 10 ? '0' : '') + h1 + ':' + (mi < 10 ? '0' : '') + mi + (d ? ' (+' + d + '일)' : ''); }

/** 합차 효과(단순): 물품 부피를 큰 것부터 차량 용량 cap 안에서 먼저 들어가는 차량에 싣는다. 물품마다 차량 한 대를 쓰는 경우와 견준다. */
function packBins(items, cap) {
  var a = (items || []).map(numOf), c = numOf(cap);
  if (a.length < 1 || a.length > 500 || !isFinite(c) || !(c > 0) || c > 1e9 || a.some(function (x) { return !isFinite(x) || !(x > 0) || x > c; })) return null;
  var sorted = a.slice().sort(function (x, y) { return y - x; }), bins = [];
  sorted.forEach(function (v) { for (var i = 0; i < bins.length; i++) if (bins[i].load + v <= c + 1e-9) { bins[i].load += v; bins[i].items.push(v); return; } bins.push({ load:v, items:[v] }); });
  var total = a.reduce(function (s, x) { return s + x; }, 0);
  return { n:bins.length, naive:a.length, saved:a.length - bins.length, load:total / (bins.length * c), bins:bins, ratio:bins.length / a.length };
}
function dist(p, q) { var dx = p.x - q.x, dy = p.y - q.y; return Math.sqrt(dx * dx + dy * dy); }
function tourLen(depot, pts, order) { var d = 0, cur = depot; order.forEach(function (i) { d += dist(cur, pts[i]); cur = pts[i]; }); return d + dist(cur, depot); }
/** 경로 순서(단순): 차고에서 가장 가까운 곳부터 잇고(가까운 곳 우선), 꼬인 구간을 풀어(2-opt) 차고로 돌아오는 총 거리를 줄인다. 최적이 보장되지는 않는다. */
function bestRoute(depot, stops) {
  if (!depot || !isFinite(depot.x) || !isFinite(depot.y) || !stops || stops.length < 1 || stops.length > MAXS) return null;
  var pts = stops.map(function (s) { return { x:Number(s.x), y:Number(s.y) }; });
  if (pts.some(function (p) { return !isFinite(p.x) || !isFinite(p.y); })) return null;
  var left = pts.map(function (_, i) { return i; }), order = [], cur = depot;
  while (left.length) { var bi = 0; for (var k = 1; k < left.length; k++) if (dist(cur, pts[left[k]]) < dist(cur, pts[left[bi]]) - 1e-12) bi = k; var pick = left.splice(bi, 1)[0]; order.push(pick); cur = pts[pick]; }
  var improved = true, guard = 0;
  while (improved && guard++ < 200) { improved = false;
    for (var i = 0; i < order.length - 1; i++) for (var j = i + 1; j < order.length; j++) {
      var cand = order.slice(0, i).concat(order.slice(i, j + 1).reverse(), order.slice(j + 1));
      if (tourLen(depot, pts, cand) < tourLen(depot, pts, order) - 1e-9) { order = cand; improved = true; } } }
  var base = tourLen(depot, pts, pts.map(function (_, i) { return i; })), best = tourLen(depot, pts, order);
  return { order:order, dist:best, base:base, saved:base - best };
}
/** 도착 시각: 차고에서 start(분)에 출발해 order 순서로 돈다. 속도 speed(km/h), 정차 dwell(분). delay(분)는 after번째 경유지에서 생긴 지연이다. 마감 dl(하루 안의 분)을 넘으면 late. */
function schedule(depot, stops, order, speed, dwell, start, delay, after) {
  var sp = numOf(speed), dw = dwell === '' || dwell == null ? 0 : numOf(dwell), st = typeof start === 'number' ? start : parseHM(start);
  var de = delay === '' || delay == null ? 0 : numOf(delay), af = after === '' || after == null ? 0 : numOf(after);
  if (!depot || !stops || !order || !isFinite(sp) || !(sp > 0) || sp > 200 || !isFinite(dw) || dw < 0 || dw > 240 || !isFinite(st) || !isFinite(de) || de < 0 || de > 1440 || !isFinite(af) || af < 0 || af > order.length || (de > 0 && (af < 1 || Math.floor(af) !== af))) return null;
  var t = st, cur = depot, rows = [], late = 0;
  order.forEach(function (idx, k) {
    var s = stops[idx], arrive = t + dist(cur, s) / sp * 60, depart = arrive + dw + (k + 1 === af ? de : 0), isLate = s.dl !== '' && s.dl != null && arrive > Number(s.dl);
    if (isLate) late++; rows.push({ i:k + 1, name:s.name, arrive:arrive, depart:depart, dl:s.dl === '' || s.dl == null ? null : Number(s.dl), late:isLate }); t = depart; cur = s; });
  var back = t + dist(cur, depot) / sp * 60; return { rows:rows, back:back, late:late };
}

// ── 물류 원리 ──
function viewPrinciple() {
  var kids = head('물류 원리', '나비웹 물류 인프라는 사회 전체의 물류 총비용이 최소가 되도록 물품 하나하나의 배송 시각과 경로를 정합니다.');
  kids.push(stepsCard('물류가 움직이는 방식', [
    ['자율주행 교통 인프라의 연장', '물류는 교통 인프라 위에서 움직입니다. 화물도 자율주행·공유 차량이 나르고, 차량 위치는 교통 인프라가 통제해요.'],
    ['최소화하는 것은 사회 전체의 물류 총비용', '택배사나 업체 한 곳의 비용이 아니라 사회 전체가 쓰는 운행 거리, 대기 시간, 빈 차 운행 같은 비용의 합이에요.'],
    ['물품 각각의 배송 시각과 경로를 결정', '물품 하나하나를 단위로 언제 어디를 거쳐 갈지 정합니다. 같은 방향의 물품은 한 차량에 합쳐 싣고, 빈 차로 달리는 거리를 줄여요.'],
    ['실시간으로 갱신', '도로 상황이나 차량 위치가 바뀌거나 새 물품이 들어오면 시각과 경로를 다시 정해요. 교통 인프라가 차량 위치를 알기 때문에 도착 시각 예측이 정확해집니다.']],
    '설계 원칙입니다. 물품 추적, 배차, 실시간 갱신은 아직 연결되어 있지 않아요. 이 화면에서는 같은 원리를 내가 넣은 값으로 계산해 볼 수 있습니다.'));
  kids.push(h('div', { class:'g2', style:'margin-top:16px' }, [['합차 효과', '물품을 합쳐 실으면 차량이 몇 대 줄어드는지', 'pack'], ['경로·도착 시각', '경유지 순서와 도착 시각, 지연 반영', 'route'], ['물품 메모', '보낼 물품을 적어 두기', 'parcels']].map(function (x) { return h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:x[0] }), h('div', { class:'sub', text:x[1] }), h('div', { class:'rowf' }, [btn('열기', 'quiet', function () { go(x[2]); })])]); })));
  return kids;
}

// ── 합차 효과 ──
function viewPack() {
  var kids = head('합차 효과', '같은 방향으로 가는 물품을 한 차량에 합쳐 실으면 차량이 얼마나 줄어드는지 계산합니다.'); kids.push(notice());
  var f = S.pk, out = h('div', { id:'lg-p-out', style:'margin-top:12px' });
  function upd() { out.textContent = ''; var r = packBins(f.items.split(/[\s,]+/).filter(Boolean), f.cap);
    out.appendChild(!r ? h('div', { class:'sub', text:'물품 부피를 쉼표로 구분해 넣고, 차량 용량을 넣어 주세요(물품은 하나도 용량을 넘을 수 없어요).' }) : h('div', {}, [
      h('div', { class:'g2' }, [tile('필요한 차량', r.n + '대', '물품마다 한 대 쓰면 ' + r.naive + '대', 'lg-p-n'), tile('줄어드는 차량', r.saved + '대', '적재율 ' + Math.round(r.load * 100) + '%', 'lg-p-saved')]),
      h('div', { id:'lg-p-res', class:r.saved > 0 ? 'note info' : 'note', style:'margin-top:12px', text:r.saved > 0 ? '합쳐 실으면 차량이 ' + Math.round((1 - r.ratio) * 100) + '% 줄어요.' : '이 값으로는 합쳐 실을 수 있는 물품이 없어요.' }),
      h('div', { class:'card', style:'margin-top:12px;padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['차량', '실은 물품', '적재'].map(function (t) { return h('th', { text:t }); }))]), h('tbody', {}, r.bins.map(function (b, i) { return h('tr', {}, [h('td', { text:(i + 1) + '번' }), h('td', { class:'num', text:b.items.join(' + ') }), h('td', { class:'r', text:Math.round(b.load / numOf(f.cap) * 100) + '%' })]); }))])])])])); }
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('div', { class:'frm' }, [field('lg-p-items', '물품 부피(쉼표로 구분)', f.items, { max:300, ph:'예: 40, 25, 60, 15, 35, 20', help:'내가 넣는 값이에요', set:function (v) { f.items = v; upd(); } }), field('lg-p-cap', '차량 한 대의 용량', f.cap, { mode:'decimal', max:9, ph:'예: 100', help:'물품과 같은 단위', set:function (v) { f.cap = v; upd(); } })]), out]));
  upd(); return kids;
}

// ── 경로·도착 시각 ──
function addStop() {
  var f = S.rt, e = {}, name = clean(f.name, 30), px = snum(f.x), py = snum(f.y), dl = f.dl.trim() === '' ? '' : parseHM(f.dl);
  if (!name) e.name = '경유지 이름을 적어 주세요.'; if (!isFinite(px) || Math.abs(px) > 1000) e.x = '가로 위치(km)는 −1000~1000 사이 숫자예요.'; if (!isFinite(py) || Math.abs(py) > 1000) e.y = '세로 위치(km)는 −1000~1000 사이 숫자예요.';
  if (dl !== '' && !isFinite(dl)) e.dl = '마감은 14:30 모양으로 적어 주세요.'; if (S.stops.length >= MAXS) e.name = '경유지는 최대 ' + MAXS + '곳까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  S.stops.push({ id:uid(), name:name, x:px, y:py, dl:dl }); f.name = ''; f.x = ''; f.y = ''; f.dl = ''; S.msg = '경유지를 저장했어요. 물품은 보내지 않았어요.'; save(); render();
}
function viewRoute() {
  var kids = head('경로·도착 시각', '경유지 위치를 넣으면 돌아오는 거리가 가장 짧은 순서와 도착 시각을 계산합니다.'); kids.push(notice());
  var f = S.rt, e = S.err;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'경유지 추가' }), h('div', { class:'sub', text:'위치는 기준점(차고)에서 가로·세로로 얼마나 떨어졌는지(km)로 넣어요.' }),
    h('div', { class:'frm' }, [field('lg-r-name', '이름', f.name, { err:e.name, max:30, ph:'예: 한림 우체국', set:function (v) { f.name = v; } }), field('lg-r-x', '가로(km)', f.x, { err:e.x, mode:'decimal', max:7, ph:'예: 4.5', set:function (v) { f.x = v; } }), field('lg-r-y', '세로(km)', f.y, { err:e.y, mode:'decimal', max:7, ph:'예: -2', set:function (v) { f.y = v; } }), field('lg-r-dl', '도착 마감(선택)', f.dl, { err:e.dl, max:5, ph:'예: 14:30', set:function (v) { f.dl = v; } })]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('경유지 저장', 'fill', addStop), btn('물류 AI에게 묻기', 'quiet', function () { ask('경유지가 여러 곳일 때 어떤 순서로 돌아야 사회 전체 물류 비용이 줄어드는지 알려 주세요.'); }), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  if (!S.stops.length) { kids.push(empty('아직 경유지가 없어요. 위에서 첫 경유지를 넣어 보세요.')); return kids; }
  var depot = { x:snum(f.dx), y:snum(f.dy) }, out = h('div', { id:'lg-r-out', style:'margin-top:12px' });
  function upd() {
    out.textContent = ''; depot = { x:snum(f.dx), y:snum(f.dy) }; var br = bestRoute(depot, S.stops);
    if (!br) { out.appendChild(h('div', { class:'sub', text:'기준점 위치(km)를 숫자로 넣어 주세요.' })); return; }
    var sc = schedule(depot, S.stops, br.order, f.speed, f.dwell, f.start, f.delay, f.after);
    out.appendChild(h('div', {}, [h('div', { class:'g2' }, [tile('돌아오는 거리', r1(br.dist) + 'km', '넣은 순서는 ' + r1(br.base) + 'km', 'lg-r-dist'), tile('줄어드는 거리', r1(br.saved) + 'km', br.base > 0 ? Math.round(br.saved / br.base * 100) + '%' : '', 'lg-r-saved')]),
      h('div', { class:'card', style:'margin-top:12px;padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['순서', '경유지', '도착', '마감', ''].map(function (t) { return h('th', { text:t }); }))]), h('tbody', {}, br.order.map(function (idx, k) { var s = S.stops[idx], row = sc ? sc.rows[k] : null; return h('tr', {}, [h('td', { text:String(k + 1) }), h('td', { text:s.name }), h('td', { class:'num', text:row ? fmtHM(row.arrive) : '—' }), h('td', { class:'num', text:s.dl === '' ? '—' : fmtHM(s.dl) }), h('td', {}, [row && row.late ? pill('마감 넘김', 'bad') : null])]); }))])])]),
      sc ? h('div', { id:'lg-r-res', class:sc.late ? 'note' : 'note info', role:sc.late ? 'alert' : null, style:'margin-top:12px', text:'차고로 돌아오는 시각 ' + fmtHM(sc.back) + (sc.late ? ' — 마감을 넘기는 경유지가 ' + sc.late + '곳 있어요. 지연이 생기면 순서를 다시 정해야 해요.' : ' — 마감을 넘기는 곳은 없어요.') }) : h('div', { class:'sub', style:'margin-top:12px', text:'평균 속도(km/h)와 출발 시각(예: 09:00)을 넣으면 도착 시각을 계산해요.' })]));
  }
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'계산 조건' }), h('div', { class:'frm' }, [field('lg-r-dx', '기준점 가로(km)', f.dx, { mode:'decimal', max:7, set:function (v) { f.dx = v; upd(); } }), field('lg-r-dy', '기준점 세로(km)', f.dy, { mode:'decimal', max:7, set:function (v) { f.dy = v; upd(); } }), field('lg-r-speed', '평균 속도(km/h)', f.speed, { mode:'decimal', max:5, ph:'예: 40', set:function (v) { f.speed = v; upd(); } }), field('lg-r-dwell', '경유지당 정차(분)', f.dwell, { mode:'decimal', max:4, ph:'예: 5', set:function (v) { f.dwell = v; upd(); } }), field('lg-r-start', '출발 시각', f.start, { max:5, ph:'예: 09:00', set:function (v) { f.start = v; upd(); } })]),
    h('b', { style:'font-size:15px;margin-top:8px', text:'지연 반영(실시간 갱신 흉내)' }), h('div', { class:'frm' }, [field('lg-r-after', '몇 번째 경유지에서', f.after, { mode:'numeric', max:2, ph:'예: 2', set:function (v) { f.after = v; upd(); } }), field('lg-r-delay', '지연(분)', f.delay, { mode:'decimal', max:4, ph:'예: 20', set:function (v) { f.delay = v; upd(); } })]), out]));
  kids.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['경유지', '가로', '세로', ''].map(function (t) { return h('th', { text:t }); }))]), h('tbody', {}, S.stops.map(function (x) { return h('tr', {}, [h('td', { text:x.name }), h('td', { class:'num', text:String(x.x) }), h('td', { class:'num', text:String(x.y) }), h('td', { class:'r' }, [btn('삭제', 'sm quiet', function () { S.stops = S.stops.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]); }))])])]));
  upd(); return kids;
}

// ── 물품 메모 ──
function addP() {
  var f = S.pc, e = {}, name = clean(f.name, 30), from = clean(f.from, 30), to = clean(f.to, 30), d = f.d.trim();
  if (!name) e.name = '물품 이름을 적어 주세요.'; if (!from) e.from = '보내는 곳을 적어 주세요.'; if (!to) e.to = '받는 곳을 적어 주세요.'; if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) e.d = '날짜는 2026-11-23 모양으로 적어 주세요.'; if (S.list.length >= MAXP) e.name = '메모는 최대 ' + MAXP + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  S.list.push({ id:uid(), name:name, from:from, to:to, d:d, st:'예정' }); f.name = ''; f.from = ''; f.to = ''; S.msg = '메모에 저장했어요. 물품은 보내지 않았어요.'; save(); render();
}
function viewParcels() {
  var kids = head('물품 메모', '보낼 물품을 적어 둡니다. 배송 요청과 추적은 아직 연결되어 있지 않아요.'); kids.push(notice());
  var f = S.pc, e = S.err;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('div', { class:'frm' }, [field('lg-m-name', '물품', f.name, { err:e.name, max:30, ph:'예: 감귤 상자 2개', set:function (v) { f.name = v; } }), field('lg-m-from', '보내는 곳', f.from, { err:e.from, max:30, ph:'예: 한림읍', set:function (v) { f.from = v; } }), field('lg-m-to', '받는 곳', f.to, { err:e.to, max:30, ph:'예: 서울 마포구', set:function (v) { f.to = v; } }), field('lg-m-d', '날짜(선택)', f.d, { err:e.d, ph:kst(), mode:'numeric', max:10, set:function (v) { f.d = v; } })]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('메모 저장', 'fill', addP), btn('물류 AI에게 묻기', 'quiet', function () { ask('이 송장번호 택배가 지금 어디 있나요?'); }), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  if (S.list.length) kids.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['물품', '보내는 곳', '받는 곳', '날짜', '상태', ''].map(function (t) { return h('th', { text:t }); }))]), h('tbody', {}, S.list.map(function (x) { return h('tr', {}, [h('td', { text:x.name }), h('td', { text:x.from }), h('td', { text:x.to }), h('td', { class:'num', text:x.d || '—' }), h('td', {}, [pill(x.st, x.st === '완료' ? 'm' : '')]), h('td', { class:'r' }, [btn(x.st === '예정' ? '완료로' : '예정으로', 'sm quiet', function () { x.st = x.st === '예정' ? '완료' : '예정'; save(); render(); }), btn('삭제', 'sm quiet', function () { S.list = S.list.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]); }))])])]));
  else kids.push(empty('아직 메모가 없어요. 위에서 첫 물품을 적어 보세요.'));
  return kids;
}

/* 나비웹 도우미로 기관 사이트 조회 열기 — 로그인·인증은 사용자, 조회까지만 한다. 호스트는 NaviLogistics.agentResult(ok, msg) 로 결과를 돌려준다. */
var AG = [["epost", "택배 배송 조회(우체국)", "https://service.epost.go.kr"], ["unipass", "수입 화물 통관 조회(관세청)", "https://unipass.customs.go.kr"]], AGG = {"epost": "우체국 택배에서 배송 조회", "unipass": "관세청 유니패스에서 화물 통관 진행 조회"};
function agentResult(ok, msg) { S.agMsg = clean(msg, 160) || (ok ? '도우미가 시작합니다.' : '도우미에 맡기지 못했어요.'); render(); }
function handOff() {
  var it = AG.filter(function (x) { return x[0] === S.ag; })[0] || AG[0];
  S.agMsg = '도우미에 맡기는 중…'; render();
  if (!(LS.agent && LS.agent.length)) return agentResult(false, '나비웹 도우미를 쓸 수 없는 화면이에요.');
  emit('agent', { kind:it[0], label:it[1], url:it[2], goal:AGG[it[0]] });
}
function agentCard() {
  var s = h('select', { id:'lg-ag', 'aria-label':'도우미로 열 사이트' }, AG.map(function (x) { return h('option', { value:x[0], text:x[1] }); })); s.value = S.ag || AG[0][0]; s.onchange = function () { S.ag = s.value; };
  return h('div', { class:'card col', id:'lg-agent', style:'margin-top:12px' }, [h('b', { text:'배송 조회는 도우미에게 (나비웹 도우미)' }),
    h('div', { class:'sub', text:'택배 배송이나 수입 화물 통관 상태를 도우미가 해당 사이트에서 열어 줍니다. 로그인은 내가 하고, 조회까지만 해요. 발송 신청과 결제는 하지 않아요.' }),
    h('div', { class:'rowf' }, [s, btn('도우미로 열기', '', handOff)]),
    S.agMsg ? h('div', { class:'sub', id:'lg-ag-msg', text:S.agMsg }) : null]);
}
function render() {
  var root = $('lg-root'), tp = $('lg-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = S.view === 'pack' ? viewPack() : S.view === 'route' ? viewRoute() : S.view === 'parcels' ? viewParcels() : viewPrinciple();
  if (S.view === 'parcels' || !S.view) kids.push(agentCard());
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
  M = el; el.textContent = ''; el.classList.add('lgs'); S.list = []; S.stops = []; S.err = {}; S.msg = ''; load();
  [h('div', { id:'lg-top' }), h('div', { class:'wrap', id:'lg-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'principle'; render();
}
window.NaviLogistics = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  packBins:packBins, bestRoute:bestRoute, schedule:schedule, parseHM:parseHM,
  agentResult:function (ok, msg) { if (M) agentResult(!!ok, msg); },
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
