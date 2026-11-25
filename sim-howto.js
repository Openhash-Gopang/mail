/* sim-howto.js — 사용법(인터랙티브 매뉴얼) 장별 시뮬레이션 (2026-11-25)
 *
 * 목적: 사용법을 배우는 사람이 "가상 상황"에서 틀려 보며 익히는 연습 공간.
 *  - 연습 예제(🎯) = 실제 나비웹 화면에서 한 번 직접 해 보기
 *  - 퀴즈 = 개념 확인(장 완료·학습 기록에 반영)
 *  - 시뮬레이션 = 가상 상황에서 순서·위치·판단·계산·변조 탐지를 반복(틀려도 되고, 어디에도 반영되지 않음)
 * 원칙: 모의·가상만, 메모리 안에서만 동작, 저장소 쓰기·네트워크 전송 없음, 진짜 인증·지갑·메일·서류 데이터는 건드리지 않는다.
 * 사용: NaviHowto.open(장id) / NaviHowto.has(장id) / NaviHowto.close() / NaviHowto.meta(장id)
 */
(function () {
'use strict';
var D = document;
function mk(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function fnv(s) { var x = 0x811c9dc5, i; s = String(s); for (i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return ('00000000' + x.toString(16)).slice(-8); }
function ri(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
function shuf(arr, r) { var a = arr.slice(), i, j, t; for (i = a.length - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function won(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function h(tag, at, kids) {
  var e = D.createElement(tag), k;
  for (k in (at || {})) { if (k === 'text') e.textContent = at[k]; else if (k === 'onclick') e.addEventListener('click', at[k]); else if (k === 'class') e.className = at[k]; else e.setAttribute(k, at[k]); }
  (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? D.createTextNode(c) : c); });
  return e;
}
var CSS = '.nhow-pn{position:fixed;top:0;right:0;bottom:0;width:min(460px,100vw);background:#fff;color:#1f2328;z-index:2147483000;box-shadow:-8px 0 28px rgba(0,0,0,.22);display:flex;flex-direction:column;transform:translateX(105%);transition:transform .22s ease;font:14px/1.55 -apple-system,"Pretendard","Noto Sans KR",sans-serif}'
  + '.nhow-pn.on{transform:none}.nhow-pn *{box-sizing:border-box}.nhow-pn .hd{padding:12px 14px 8px;border-bottom:1px solid #e3e5e9;background:#f7f9fc}.nhow-pn .bdy{flex:1;overflow:auto;padding:12px 14px 24px}'
  + '.nhow-pn h2{margin:0;font-size:16px;line-height:1.35}.nhow-pn .bd{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:99px;background:#fff3cd;color:#7a5b00;font-size:11.5px;font-weight:700;vertical-align:middle}'
  + '.nhow-pn .sub{color:#5b6068;font-size:12.5px;margin:4px 0}.nhow-pn .role{display:grid;gap:2px;margin:8px 0 2px;padding:8px 10px;border-radius:10px;background:#eef3fb;font-size:12.5px;color:#334}'
  + '.nhow-pn .role b{color:#1a4fa3}.nhow-pn .role .me{background:#fff;border-radius:6px;padding:1px 6px;border:1px solid #bfd3f0}'
  + '.nhow-pn button{padding:7px 12px;border-radius:99px;border:1px solid #c5c9d0;background:#f3f4f6;font:inherit;cursor:pointer;color:inherit}.nhow-pn button:hover:not(:disabled){background:#e9ecf0}.nhow-pn button:disabled{opacity:.55;cursor:default}'
  + '.nhow-pn button.pri{background:#1e8a5a;border-color:#1e8a5a;color:#fff}.nhow-pn button.cur{background:#e8f0fe;border-color:#1a73e8;color:#174ea6;font-weight:700}'
  + '.nhow-pn .dots{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 0}.nhow-pn .dots button{width:30px;height:30px;padding:0;border-radius:50%;font-size:12.5px}.nhow-pn .dots button.ok{background:#e3f6ec;border-color:#1e8a5a;color:#146c43}.nhow-pn .dots button.cur{background:#e8f0fe}'
  + '.nhow-pn .card{border:1px solid #e3e5e9;border-radius:12px;padding:12px;margin:10px 0;background:#fff}.nhow-pn .q{font-weight:700;margin:0 0 8px;font-size:14.5px}.nhow-pn .opts{display:grid;gap:6px}.nhow-pn .opts button{text-align:left;border-radius:10px;padding:8px 10px}'
  + '.nhow-pn .fb{margin-top:8px;padding:8px 10px;border-radius:10px;font-size:13px}.nhow-pn .fb.ok{background:#e3f6ec;color:#146c43}.nhow-pn .fb.no{background:#fdecea;color:#9a1b13}.nhow-pn .fb.nt{background:#f1f3f5;color:#444}'
  + '.nhow-pn .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}.nhow-pn input[type=text],.nhow-pn input[type=number]{padding:7px 9px;border:1px solid #c5c9d0;border-radius:8px;font:inherit;min-width:120px;max-width:100%}'
  + '.nhow-pn .sorti{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 0;border-bottom:1px dashed #e3e5e9}.nhow-pn .sorti .t{flex:1 1 100%;font-size:13.5px}.nhow-pn .sorti button{padding:4px 10px;font-size:12.5px}.nhow-pn .sorti.bad{background:#fff5f4}.nhow-pn .sorti.good{background:#f1fbf5}'
  + '.nhow-pn table{border-collapse:collapse;width:100%;margin:6px 0;font-size:12.5px}.nhow-pn th,.nhow-pn td{border-bottom:1px solid #e3e5e9;padding:4px 6px;text-align:left}.nhow-pn td.bad{color:#b3261e;font-weight:700}.nhow-pn .mono{font-family:ui-monospace,Consolas,monospace}'
  + '.nhow-pn .lay{display:grid;gap:6px;margin:6px 0;padding:8px;border:1px dashed #9aa4b8;border-radius:10px;background:#f4f6fa}.nhow-pn .lay button{border-radius:8px;border:1px solid #b9c2d3;background:#fff;padding:8px 6px;font-size:12.5px;min-height:38px}'
  + '.nhow-pn .lay button.hit{background:#e3f6ec;border-color:#1e8a5a}.nhow-pn .lay button.miss{background:#fdecea;border-color:#d93025}.nhow-pn .metric{margin-top:14px;border-top:1px dashed #d9dce1;padding-top:8px}'
  + '.nhow-pn .ordl{display:flex;flex-wrap:wrap;gap:6px}.nhow-pn .ordl button{border-radius:10px;text-align:left}.nhow-pn .ordl button.used{background:#e3f6ec;border-color:#1e8a5a}.nhow-pn .seq{margin:6px 0;padding-left:20px;font-size:13px}'
  + '@media (prefers-reduced-motion:reduce){.nhow-pn{transition:none}}';

CSS += '.nhow-pn .hd>div:first-child{align-items:flex-start}.nhow-pn .hd h2{min-width:0;overflow-wrap:anywhere}.nhow-pn #hw-close{flex:none;white-space:nowrap}'
  + '.nhow-pn details.how{margin:6px 0 0}.nhow-pn details.how summary{cursor:pointer;font-size:12.5px;font-weight:700;color:#1a4fa3}.nhow-pn details.how .role{margin-top:6px}'
  + '.nhow-pn .fbslot:empty{display:none}.nhow-pn .fbslot{margin:0 0 8px}.nhow-pn .ordl button[hidden]{display:none}.nhow-pn .pos{margin:8px 0 6px;font-size:13px;font-weight:700;color:#174ea6}'
  + '.nhow-pn .seq{list-style:none;counter-reset:s;margin:6px 0;padding:0}.nhow-pn .seq li{counter-increment:s;margin:4px 0;padding:6px 10px;border-radius:10px;background:#e3f6ec;border:1px solid #1e8a5a;font-size:13px}.nhow-pn .seq li:before{content:counter(s)". ";font-weight:700;color:#146c43}';

var SC = {};     // 장 id → 시나리오
var PN = null, CUR = null, prevFocus = null, SV = null;
// SV = { id, seed, i, res:[{tries, first, done, salt, why}] } — 단계마다 자기 salt(다시 해 보기)와 결과를 따로 가진다
function S(id, o) { o.id = id; SC[id] = o; }
var onQuizCb = null;
function newRes(salt) { return { tries: 0, first: null, done: false, salt: salt || 0, why: '' }; }

/* ── 공통 틀: 질문 → 피드백 자리 → 풀이 영역. 피드백은 항상 질문 바로 아래에 보인다 ── */
function rngFor(i, off) { return mk(SV.seed * 31 + (i + (off || 0)) * 7919 + SV.res[i].salt * 104729 + 17); }
function pickItem(step, i) { if (step.gen) return step.gen(rngFor(i)); if (step.v) return step.v[(SV.seed + i + SV.res[i].salt) % step.v.length]; return step; }
function hdr(box, it) {
  box.appendChild(h('div', { class: 'q', text: it.q }));
  if (it.facts) box.appendChild(h('div', { class: 'sub', text: it.facts }));
  box.appendChild(h('div', { class: 'fbslot', role: 'status', 'aria-live': 'polite' }));
}
function note(box, cls, txt) {
  var s = box.querySelector('.fbslot');
  if (!s) { s = h('div', { class: 'fbslot', role: 'status', 'aria-live': 'polite' }); box.insertBefore(s, box.children[1] || null); }
  s.className = 'fbslot fb ' + cls; s.textContent = txt;
  if (s.scrollIntoView) { try { s.scrollIntoView({ block: 'nearest' }); } catch (e) { /* 스크롤 불가는 무시 */ } }
}
function nextBtn(i) { var nxt = i + 1 < SC[SV.id].steps.length; return h('button', { type: 'button', class: 'pri', id: 'hw-next', text: nxt ? '다음 단계' : '결과 보기', onclick: function () { SV.i = i + 1; render(); } }); }
function finish(i, box, why) {
  var R = SV.res[i]; R.done = true; R.why = why || '';
  if (why) note(box, 'ok', '✔ ' + why);
  box.appendChild(h('div', { class: 'row' }, [nextBtn(i)]));
  dots();
}
/* 같은 단계를 새 상황으로 다시: 이 단계의 상황만 바꾸고 다른 단계는 그대로 둔다(시도 횟수·처음 맞힘은 이어 센다) */
function redo(i) { var R = SV.res[i]; R.salt++; R.done = false; R.why = ''; render(); }
function again(i, box) {
  if (box.querySelector('.hw-again')) return;
  box.appendChild(h('div', { class: 'row hw-again' }, [h('button', { type: 'button', id: 'hw-again', text: '다른 상황으로 한 번 더', onclick: function () { redo(i); } })]));
}
var TYPES = {};
TYPES.pick = function (step, i, box) {
  var it = pickItem(step, i), r = rngFor(i, 100), idx = it.opts.map(function (_, k) { return k; }), ord = it.fixed ? idx : shuf(idx, r), R = SV.res[i];
  hdr(box, it);
  var wrap = h('div', { class: 'opts' });
  ord.forEach(function (k) {
    wrap.appendChild(h('button', { type: 'button', 'data-k': String(k), text: it.opts[k], onclick: function () {
      if (R.done) return; R.tries++;
      var okk = Array.isArray(it.a) ? it.a.indexOf(k) >= 0 : it.a === k;
      if (okk) { if (R.first == null) R.first = true; Array.prototype.forEach.call(wrap.children, function (b) { b.disabled = true; }); finish(i, box, it.why); }
      else { if (R.first == null) R.first = false; var m = '아니에요. ' + ((it.no && it.no[k]) || '다시 골라 보세요.'); note(box, 'no', R.tries >= 2 ? m + ' (힌트: ' + (it.hint || it.why) + ')' : m); if (R.tries >= 2) again(i, box); }
    } }));
  });
  box.appendChild(wrap);
};
TYPES.sort = function (step, i, box) {
  var it = pickItem(step, i), r = rngFor(i, 100), order = shuf(it.items.map(function (_, k) { return k; }), r), R = SV.res[i], pick = {}, rows = {};
  hdr(box, it);
  order.forEach(function (k) {
    var row = h('div', { class: 'sorti', 'data-k': String(k) }, [h('div', { class: 't', text: it.items[k][0] })]);
    it.buckets.forEach(function (b, bi) { row.appendChild(h('button', { type: 'button', 'data-b': String(bi), text: b, onclick: function () { if (R.done) return; pick[k] = bi; Array.prototype.forEach.call(row.querySelectorAll('button'), function (x) { x.className = x.getAttribute('data-b') === String(bi) ? 'cur' : ''; }); row.className = 'sorti'; } })); });
    rows[k] = row; box.appendChild(row);
  });
  box.appendChild(h('div', { class: 'row' }, [h('button', { type: 'button', class: 'pri', id: 'hw-check', text: '확인', onclick: function () {
    if (R.done) return; if (Object.keys(pick).length < it.items.length) { note(box, 'nt', '모든 항목을 하나씩 골라 주세요.'); return; }
    R.tries++; var bad = 0; it.items.forEach(function (x, k) { var okk = pick[k] === x[1]; rows[k].className = 'sorti ' + (okk ? 'good' : 'bad'); if (!okk) bad++; });
    if (!bad) { if (R.first == null) R.first = true; Array.prototype.forEach.call(box.querySelectorAll('.sorti button'), function (b) { b.disabled = true; }); finish(i, box, it.why); }
    else { if (R.first == null) R.first = false; note(box, 'no', bad + '개가 달라요. 붉게 표시된 줄만 다시 골라 확인해 보세요.'); if (R.tries >= 2) again(i, box); }
  } })]));
};
/* 순서 맞추기: 고른 순서가 위에 쌓이고, 고른 항목은 선택지에서 빠진다. 틀리면 그 항목이 몇 번째 단계인지 알려 준다. */
TYPES.order = function (step, i, box) {
  var it = pickItem(step, i), r = rngFor(i, 100), R = SV.res[i], n = it.items.length, nextIdx = 0, shown = shuf(it.items.map(function (_, k) { return k; }), r), list = h('ol', { class: 'seq' }), pos = h('div', { class: 'pos' }), wrap = h('div', { class: 'ordl' });
  hdr(box, it); box.appendChild(h('div', { class: 'sub', text: '처음 할 일부터 한 단계씩 골라 보세요. 고른 순서가 아래에 쌓여요.' }));
  function setPos() { pos.textContent = nextIdx < n ? (nextIdx + 1) + '번째로 할 일을 고르세요 (' + nextIdx + '/' + n + ')' : '순서를 모두 맞혔어요 (' + n + '/' + n + ')'; }
  function put(k) { var b = wrap.querySelector('button[data-k="' + k + '"]'); if (b) b.hidden = true; list.appendChild(h('li', { text: it.items[k] })); }
  shown.forEach(function (k) {
    wrap.appendChild(h('button', { type: 'button', 'data-k': String(k), text: it.items[k], onclick: function () {
      if (R.done) return;
      if (k === nextIdx) { put(k); nextIdx++; if (R.first == null && R.tries === 0) R.first = true; setPos(); note(box, 'nt', ''); if (nextIdx === n) { Array.prototype.forEach.call(wrap.children, function (x) { x.disabled = true; }); finish(i, box, it.why); } }
      else { R.tries++; R.first = false; note(box, 'no', '아니에요. 그 일은 ' + (k + 1) + '번째 단계예요(지금은 ' + (nextIdx + 1) + '번째를 고를 차례). ' + (k > nextIdx ? '그 전에 해야 할 일이 더 있어요.' : '') + (it.hint ? ' ' + it.hint : '')); if (R.tries >= 3 && !box.querySelector('.hw-again')) box.appendChild(h('div', { class: 'row hw-again' }, [h('button', { type: 'button', id: 'hw-show', text: '정답 순서 보기', onclick: function () { for (var q = nextIdx; q < n; q++) put(q); nextIdx = n; setPos(); Array.prototype.forEach.call(wrap.children, function (x) { x.disabled = true; }); box.querySelector('.hw-again').remove(); finish(i, box, it.why); } }), h('button', { type: 'button', id: 'hw-again', text: '다른 상황으로 한 번 더', onclick: function () { redo(i); } })])); }
    } }));
  });
  setPos(); box.appendChild(list); box.appendChild(pos); box.appendChild(wrap);
};
TYPES.zone = function (step, i, box) {
  var it = pickItem(step, i), L = step.lay || it.lay, R = SV.res[i];
  hdr(box, it);
  var g = h('div', { class: 'lay', style: 'grid-template-columns:' + L.cols + ';grid-template-areas:' + L.areas.map(function (a) { return '"' + a + '"'; }).join(' ') });
  L.cells.forEach(function (c) {
    g.appendChild(h('button', { type: 'button', 'data-z': c[0], style: 'grid-area:' + c[0], text: c[1], onclick: function (ev) {
      if (R.done) return; var b = ev.currentTarget; R.tries++;
      if (c[0] === it.a) { b.className = 'hit'; if (R.first == null) R.first = true; Array.prototype.forEach.call(g.children, function (x) { x.disabled = true; }); finish(i, box, it.why); }
      else { b.className = 'miss'; if (R.first == null) R.first = false; note(box, 'no', '「' + c[1] + '」는 아니에요. ' + (it.no && it.no[c[0]] ? it.no[c[0]] : '다시 찾아보세요.')); if (R.tries >= 3) again(i, box); }
    } }));
  });
  box.appendChild(g); box.appendChild(h('div', { class: 'sub', text: '가상 화면 그림이에요. 실제 화면과 비슷하게 단순화했어요.' }));
};
TYPES.calc = function (step, i, box) {
  var it = pickItem(step, i), R = SV.res[i], inp = h('input', { type: 'text', inputmode: 'decimal', id: 'hw-ans', 'aria-label': '답', placeholder: '숫자만' });
  hdr(box, it);
  var go = function () {
    if (R.done) return; var v = Number(String(inp.value).replace(/[,\s원%GDC분시간]/gi, '')); if (!isFinite(v) || inp.value === '') { note(box, 'nt', '숫자를 적어 주세요.'); return; } R.tries++;
    if (Math.abs(v - it.a) <= (it.tol || 0)) { if (R.first == null) R.first = true; inp.disabled = true; finish(i, box, it.why + ' (답: ' + (it.show || won(it.a) + (it.unit || '')) + ')'); }
    else { if (R.first == null) R.first = false; note(box, 'no', '값이 달라요. ' + (it.hint || '식을 다시 세워 보세요.')); if (R.tries >= 2) again(i, box); }
  };
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  box.appendChild(h('div', { class: 'row' }, [inp, h('span', { text: it.unit || '' }), h('button', { type: 'button', class: 'pri', id: 'hw-go', text: '확인', onclick: go })]));
};
TYPES.text = function (step, i, box) {
  var it = pickItem(step, i), R = SV.res[i], inp = h('input', { type: 'text', id: 'hw-ans', 'aria-label': '답', placeholder: it.ph || '' });
  hdr(box, it);
  var go = function () {
    if (R.done) return; var v = String(inp.value).replace(/[\s-]/g, ''); if (!v) { note(box, 'nt', '적어 주세요.'); return; } R.tries++;
    if (it.check(v)) { if (R.first == null) R.first = true; inp.disabled = true; finish(i, box, it.why); }
    else { if (R.first == null) R.first = false; note(box, 'no', it.hint || '다시 확인해 보세요.'); if (R.tries >= 2) again(i, box); }
  };
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  box.appendChild(h('div', { class: 'row' }, [inp, h('button', { type: 'button', class: 'pri', id: 'hw-go', text: '확인', onclick: go })]));
};
TYPES.chain = function (step, i, box) {
  var it = pickItem(step, i), R = SV.res[i], rows = it.rows, tried = {}, cnt = 0, out = h('div');
  hdr(box, it); box.appendChild(h('div', { class: 'sub', text: '기록은 앞 기록의 지문을 이어 쌓여요. 줄 하나를 몰래 고쳐 보고, 어디부터 지문이 어긋나는지 보세요(서로 다른 줄을 2번 해 보면 끝나요).' }));
  var draw = function (fix) {
    out.textContent = ''; var prev = '00000000', good = [], bad = -1, sh = rows.map(function (x, k) { return fix === k ? x + ' (고침)' : x; });
    rows.forEach(function (x) { prev = fnv(prev + x); good.push(prev); }); prev = '00000000';
    sh.forEach(function (x, k) { var hh = fnv(prev + x); if (hh !== good[k] && bad < 0) bad = k; prev = good[k]; });
    var tb = h('table', {}, [h('tr', {}, [h('th', { text: '번호' }), h('th', { text: '기록' }), h('th', { text: '지문' }), h('th', { text: '' })])]);
    sh.forEach(function (x, k) { tb.appendChild(h('tr', {}, [h('td', { text: String(k + 1) }), h('td', { text: x }), h('td', { class: 'mono' + (bad >= 0 && k >= bad ? ' bad' : ''), text: good[k] }), h('td', {}, [h('button', { type: 'button', 'data-fix': String(k), text: '몰래 고치기', onclick: function () { if (R.done) return; if (!tried[k]) { tried[k] = 1; cnt++; } draw(k); if (cnt >= 2) { R.tries++; if (R.first == null) R.first = true; finish(i, box, it.why); } } })])])); });
    out.appendChild(tb);
    out.appendChild(h('div', { class: 'fb ' + (bad >= 0 ? 'no' : 'nt'), id: 'hw-chain', text: bad >= 0 ? (bad + 1) + '번째 기록부터 지문이 앞 기록과 맞지 않아요. 고친 흔적이 드러나요.' : '아직 아무것도 고치지 않았어요. 모든 지문이 이어져 있어요.' }));
  };
  draw(-1); box.appendChild(out);
};
TYPES.live = function (step, i, box) { var R = SV.res[i]; step.live(box, { seed: SV.seed + R.salt, rng: rngFor(i), done: function (why) { if (R.done) return; R.tries++; if (R.first == null) R.first = true; finish(i, box, why); }, h: h, won: won, mk: mk, shuf: shuf, fnv: fnv, ri: ri }); };

/* 이미 마친 단계를 다시 열면: 처음 상태로 되돌려 놓지 않고, 마친 결과와 풀이를 보여 준다 */
function doneCard(card, st, i) {
  var it = st.k === 'live' ? { q: st.name } : pickItem(st, i), R = SV.res[i];
  card.appendChild(h('div', { class: 'q', text: it.q }));
  card.appendChild(h('div', { class: 'fb ok', id: 'hw-done', text: '✔ 이미 마친 단계예요. ' + (R.why || '') }));
  card.appendChild(h('div', { class: 'row' }, [h('button', { type: 'button', id: 'hw-redo', text: '새 상황으로 다시 해 보기', onclick: function () { redo(i); } }), nextBtn(i)]));
}

/* ── 패널 ───────────────────────────────────────────────────────── */
function dots() {
  var d = D.getElementById('hw-dots'); if (!d) return; d.textContent = '';
  SC[SV.id].steps.forEach(function (_, k) { var R = SV.res[k]; d.appendChild(h('button', { type: 'button', 'aria-label': (k + 1) + '단계', 'data-i': String(k), class: (k === SV.i ? 'cur ' : '') + (R.done ? 'ok' : ''), text: R.done ? '✓' : String(k + 1), onclick: function () { SV.i = k; render(); } })); });
  d.appendChild(h('button', { type: 'button', 'aria-label': '결과', 'data-i': 'end', class: SV.i >= SC[SV.id].steps.length ? 'cur' : '', text: '결과', style: 'width:auto;border-radius:99px;padding:0 10px', onclick: function () { SV.i = SC[SV.id].steps.length; render(); } }));
}
function summary(box, sc) {
  var tot = sc.steps.length, first = 0, tries = 0, worst = null, done = 0;
  var tb = h('table', {}, [h('tr', {}, [h('th', { text: '단계' }), h('th', { text: '처음에 맞힘' }), h('th', { text: '시도' })])]);
  sc.steps.forEach(function (st, k) { var R = SV.res[k]; if (R.first) first++; if (R.done) done++; tries += R.tries; if (R.tries > 1 && (!worst || R.tries > worst.t)) worst = { n: k + 1, t: R.tries, name: st.name }; tb.appendChild(h('tr', {}, [h('td', { text: (k + 1) + '. ' + st.name }), h('td', { text: R.done ? (R.first ? '예' : '아니오') : '아직' }), h('td', { text: String(R.tries) })])); });
  box.appendChild(h('div', { class: 'q', text: done === tot ? '모두 마쳤어요 🎉' : '아직 하지 않은 단계가 있어요' }));
  box.appendChild(tb);
  box.appendChild(h('div', { class: 'fb nt', id: 'hw-metric', text: '점검 지표(가상 · 이 패널 안에서만 센 값, 저장·전송 안 함): 처음에 맞힌 단계 ' + first + '/' + tot + ', ' + (worst ? '가장 많이 헤맨 단계 ' + worst.n + '번(' + worst.name + ', ' + worst.t + '번 시도)' : '헤맨 단계 없음') + '. 실제로 상용화 전에 재 볼 것: 단계별 완료율, 가장 많이 막힌 단계, 한 번에 이해한 비율.' }));
  box.appendChild(h('div', { class: 'sub', text: '이 결과는 장 완료·퀴즈 점수·학습 기록에 들어가지 않아요. 장을 완료하려면 본문 아래의 퀴즈를 푸세요.' }));
  var row = h('div', { class: 'row' }, [h('button', { type: 'button', class: 'pri', id: 'hw-restart', text: '새 상황으로 다시 하기', onclick: function () { SV.i = 0; SV.res = sc.steps.map(function (_, k) { return newRes(SV.res[k].salt + 1); }); render(); } })]);
  if (onQuizCb) row.appendChild(h('button', { type: 'button', id: 'hw-quiz', text: '이 장의 퀴즈로 가기', onclick: function () { close(); try { onQuizCb(SV ? SV.id : sc.id); } catch (e) { /* 무시 */ } } }));
  if (sc.page && typeof window._simOpen === 'function') row.appendChild(h('button', { type: 'button', id: 'hw-page', text: '이 장과 짝인 나비웹 화면 시뮬레이션', onclick: function () { var p = sc.page; close(); setTimeout(function () { try { window._simOpen(p[0], p[1]); } catch (e) { /* 무시 */ } }, 260); } }));
  box.appendChild(row);
}
function render() {
  if (!PN || !SV) return; var sc = SC[SV.id], box = D.getElementById('hw-body'); if (!box) return; box.textContent = ''; box.scrollTop = 0;
  dots();
  if (SV.i >= sc.steps.length) { summary(box, sc); return; }
  var st = sc.steps[SV.i]; box.appendChild(h('div', { class: 'sub', text: (SV.i + 1) + '/' + sc.steps.length + ' · ' + st.name }));
  var card = h('div', { class: 'card', id: 'hw-card' }); box.appendChild(card);
  if (SV.res[SV.i].done) doneCard(card, st, SV.i); else TYPES[st.k](st, SV.i, card);
}
function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
function onOutside(e) {
  if (!PN) return; var path = e.composedPath ? e.composedPath() : [e.target], i;
  for (i = 0; i < path.length; i++) { var el = path[i]; if (el === PN) return; if (el && el.classList && (el.classList.contains('simbtn') || el.classList.contains('nsim-pn'))) return; }
  close();
}
function close() {
  D.removeEventListener('keydown', onKey, true); D.removeEventListener('click', onOutside, true);
  if (PN) { var p = PN; p.classList.remove('on'); p.removeAttribute('id'); Array.prototype.forEach.call(p.querySelectorAll('[id]'), function (e) { e.removeAttribute('id'); }); setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 230); }
  PN = null; SV = null; CUR = null; if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) { /* 포커스 복귀 실패는 무시 */ } }
}
function open(id, seed) {
  var sc = SC[id]; if (!sc) return false; if (PN) close();
  if (!D.getElementById('nhow-css')) { var st = D.createElement('style'); st.id = 'nhow-css'; st.textContent = CSS; D.head.appendChild(st); }
  SV = { id: id, seed: seed != null ? seed : ((Date.now() / 1000) | 0) % 100000, i: 0, res: sc.steps.map(function () { return newRes(0); }) }; CUR = id; prevFocus = D.activeElement;
  var hd = h('div', { class: 'hd' }, [
    h('div', { style: 'display:flex;justify-content:space-between;gap:8px' }, [h('h2', { id: 'hw-title' }, [sc.n + '장 · ' + sc.short + ' 시뮬레이션', h('span', { class: 'bd', text: '가상 상황' })]), h('button', { type: 'button', id: 'hw-close', text: '닫기', onclick: close })]),
    h('details', { class: 'how' }, [h('summary', { text: '이 시뮬레이션이 맡는 일' }),
      h('div', { class: 'role' }, [
        h('div', {}, [h('b', { text: '연습 예제 ' }), '실제 화면에서 한 번 직접 해 보기']),
        h('div', {}, [h('b', { text: '퀴즈 ' }), '개념 확인 · 장 완료에 반영']),
        h('div', {}, [h('b', { class: 'me', text: '시뮬레이션' }), ' 가상 상황에서 틀려 보며 반복 · 어디에도 반영되지 않음'])]),
      h('div', { class: 'sub', text: sc.focus })]),
    h('div', { id: 'hw-dots', class: 'dots', role: 'group', 'aria-label': '단계' })]);
  PN = h('aside', { class: 'nhow-pn', id: 'nhow-pn', role: 'complementary', 'aria-labelledby': 'hw-title' }, [hd, h('div', { id: 'hw-body', class: 'bdy' })]);
  D.body.appendChild(PN); D.addEventListener('keydown', onKey, true); setTimeout(function () { if (PN) D.addEventListener('click', onOutside, true); }, 0);
  render();
  if (window.requestAnimationFrame) window.requestAnimationFrame(function () { if (PN) PN.classList.add('on'); }); else PN.classList.add('on');
  var c = D.getElementById('hw-close'); if (c) c.focus(); return true;
}

/* ── 자주 쓰는 가상 화면 배치(구역 찾기) ──────────────────────────── */
var LAY = {
  home: { cols: '90px 1fr', areas: ['brand top', 'side main', 'side ex', 'side input'], cells: [['brand', '나비 아이콘 · 소개 ▾'], ['top', '위쪽 오른편(내 사진·아이디)'], ['side', '왼쪽 메뉴'], ['main', '가운데 화면(대화·결과)'], ['ex', '예시 버튼 · 예시 줄'], ['input', '입력창 (＋ 🎤 ↑)']] }
};

window.NaviHowto = {
  open: open, close: close, has: function (id) { return !!SC[id]; }, ids: function () { return Object.keys(SC); },
  meta: function (id) { var s = SC[id]; return s ? { n: s.n, short: s.short, focus: s.focus, say: s.say, page: s.page, steps: s.steps.map(function (x) { return x.name; }) } : null; },
  onQuiz: function (fn) { onQuizCb = fn; }, _S: S, _SC: SC, _LAY: LAY, _h: h, _fnv: fnv, _mk: mk, _ri: ri, _won: won, _shuf: shuf
};


/* ══ 시나리오: 초급 1~23장 ══════════════════════════════════════════ */
function emailSet(r) {
  var names = ['hong', 'kim', 'lee', 'park', 'choi', 'jung'], n = names[ri(r, 0, names.length - 1)], dom = ['gmail.com', 'daum.net', 'naver.com', 'kakao.com'], d = dom[ri(r, 0, dom.length - 1)];
  return { good: n + '@' + d, bad: [n + '@naviweb.kr', n + '@' + d.replace('.', ','), n + '@@' + d, n + d] };
}
S('ch1', { n: 1, short: '가입하기', page: ['home', 'signup'], focus: '시뮬레이션이 맡는 것: 가입은 문자가 실제로 가므로 실제 화면 연습은 입력 칸 구경까지만 합니다. 여기서는 순서·실수(오타·PC 가입 시도)를 가상으로 먼저 겪어 봅니다.',
  say: ['나비웹에 가입하려면 뭐가 필요해?', 'PC에서 가입하려는데 왜 안 돼?', '백업 키 메일이 안 왔어요. 어떻게 해야 해?'],
  steps: [
    { k: 'order', name: '가입 순서', q: '폰으로 가입하는 순서대로 눌러 보세요.', items: ['준비물 3가지 점검(문자 받을 내 폰·가입 전부터 쓰던 내 이메일·5분)', '폰 Chrome 주소창(검색창 아님)에 naviweb.kr 입력', '로그인 창 위쪽 “가입” 탭 누르기', '전화번호 칸에 010 뒤 8자리 적고 나비 숫자 코드 확인', '메일 ID와 백업 이메일 입력'], why: '준비물을 먼저 점검하고, 폰에서 가입 탭으로 들어가 번호 → ID·백업 이메일 순으로 적습니다.' },
    { k: 'pick', name: '백업 이메일 고르기', gen: function (r) { var e = emailSet(r); return { q: '백업 이메일로 쓸 수 있는 주소는 어느 것인가요? (백업 키가 이 주소로 갑니다)', opts: [e.good].concat(e.bad), a: 0, why: '평소 쓰던 정상 주소여야 합니다. 나비웹 주소(@naviweb.kr)는 쓸 수 없고, 오타가 있으면 백업 키가 엉뚱한 곳으로 가요.', no: { 1: '@naviweb.kr 주소는 백업 이메일로 쓸 수 없어요.', 2: '쉼표(,)가 들어가면 주소가 아니에요.', 3: '@가 두 개예요.', 4: '@가 빠졌어요.' } }; } },
    { k: 'pick', name: '이럴 땐?', v: [
      { q: 'PC의 로그인 창에서 “회원 가입”을 눌러 끝까지 가려 합니다. 어떻게 되나요?', opts: ['PC에서 바로 가입이 끝난다', 'QR 코드나 문자 링크로 폰에서 이어 가라고 안내한다', '이메일만 있으면 가입된다'], a: 1, why: '나비웹의 신원증명은 내 폰입니다. 그래서 가입은 폰에서 이어 가야 해요.' },
      { q: '문자 인증번호를 받고 10분 뒤에 입력하려 합니다. 어떻게 될까요?', opts: ['10분이어도 된다', '문자 인증번호는 5분 안에 입력해야 해서 새로 받아야 한다', '이메일 인증번호가 대신 쓰인다'], a: 1, why: '문자 인증번호는 5분, 이메일 인증번호는 10분 안에 입력해야 합니다.' },
      { q: '이미 가입한 사람이 “가입하기” 단추를 눌러 봐도 될까요?', opts: ['안심하고 눌러 본다', '누르지 않는다(문자가 가고 가입 절차가 진행된다)', '친구 번호로 눌러 본다'], a: 1, why: '가입하기를 누르면 문자가 갑니다. 이미 가입했다면 누르지 마세요.' }] }
  ] });

S('ch_pclogin', { n: 2, short: 'PC로 로그인하기', page: ['home', 'pclogin'], focus: '시뮬레이션이 맡는 것: 틀린 숫자를 눌렀을 때 일어나는 일을 계정 걱정 없이 반복해 봅니다. 실제 연습 예제는 내 폰으로 한 번만 합니다.',
  say: ['PC 로그인이 안 돼요. 어떻게 하죠?', '폰에 서명 요청 알림이 안 와요.', '숫자를 틀리게 눌렀는데 어떻게 해요?'],
  steps: [
    { k: 'pick', name: '맞는 숫자 누르기', gen: function (r) { var a = ri(r, 10, 99), s = [a]; while (s.length < 3) { var x = ri(r, 10, 99); if (s.indexOf(x) < 0) s.push(x); } return { q: 'PC 화면에 큰 숫자 ' + a + '(남은 시간 299초)가 보입니다. 폰에는 ' + shuf(s, r).join(' · ') + ' 세 숫자가 떴어요. 무엇을 누를까요?', opts: s.map(String), a: 0, fixed: false, why: 'PC 화면의 숫자를 직접 보고 있는 사람만 같은 숫자를 고를 수 있습니다. 이것이 이 방식의 안전 원리예요.', no: { 1: '같은 숫자가 아니면 승인되지 않아요. PC에서 “다시 입력”을 누르면 새 숫자가 나와요.', 2: '같은 숫자가 아니면 승인되지 않아요. PC에서 “다시 입력”을 누르면 새 숫자가 나와요.' } }; } },
    { k: 'pick', name: '낯선 요청', q: '내가 로그인을 시작하지 않았는데 폰에 “서명 요청” 알림이 왔습니다. 어떻게 할까요?', opts: ['일단 눌러 본다', '누르지 않는다', '숫자 세 개 중 아무거나 고른다'], a: 1, why: '내가 시작하지 않은 서명 요청은 누르지 마세요. 남이 내 번호로 로그인하려는 것일 수 있어요.' },
    { k: 'order', name: '로그인 순서', q: 'PC에서 로그인하는 순서대로 눌러 보세요.', items: ['PC에서 폰 번호 뒤 8자리를 넣고 로그인을 누른다', 'PC 화면의 큰 숫자와 남은 시간을 확인한다', '폰에 온 “서명 요청” 알림을 연다', '폰의 숫자 세 개 중 PC와 같은 숫자를 누른다', '지문(또는 얼굴)으로 확인한다', 'PC가 로그인된다'], why: '숫자를 눈으로 확인 → 같은 숫자 선택 → 지문 확인 순서입니다.' }
  ] });

S('ch_agent', { n: 3, short: '나비웹 도우미', page: ['home', 'install'], focus: '시뮬레이션이 맡는 것: “누가 하는 일인가”를 가르는 연습을 여러 상황으로 반복합니다. 실제 사이트에서는 로그인 앞에서 멈추기까지만 해 봅니다.',
  say: ['정보공개포털을 열고 청구 화면까지 가 줘.', '정부24를 열고 로그인 화면까지 가 줘.', '납세증명서를 발급받아 첨부해 줘.'],
  steps: [
    { k: 'sort', name: '내 일 / 도우미 일', q: '누가 하는 일일까요? 항목마다 골라 주세요.', buckets: ['내가 한다', '도우미가 한다'], items: [['로그인', 0], ['사이트 열기·화면 이동', 1], ['본인인증', 0], ['입력란 채우기', 1], ['결제', 0], ['발급된 서류 받아 오기', 1], ['공동인증서 비밀번호 입력', 0]], why: '도우미는 사이트를 열고 눌러 주지만 로그인·본인인증·결제는 항상 내가 합니다. 비밀번호·공동인증서 비밀번호·주민등록번호는 도우미에게 맡기지 않아요.' },
    { k: 'pick', name: '로그인 화면 앞에서', q: '도우미가 연 사이트에 로그인 창이 나타났습니다. 이제 무엇을 하나요?', opts: ['도우미가 대신 입력하도록 비밀번호를 말해 준다', '도우미는 멈추고, 내가 직접 로그인한다', '로그인 없이 계속 진행하게 한다'], a: 1, why: '로그인 창이 뜨면 도우미가 멈춥니다. 로그인은 내가 직접 하고, 이후 작업을 이어서 맡깁니다.' },
    { k: 'pick', name: '설치 확인', q: '도우미가 설치돼 있는지 어디서 볼 수 있을까요?', opts: ['Chrome 오른쪽 위 퍼즐 아이콘에 나비웹 도우미가 보이고, 서류 화면에 “연결됨”이 보인다', '휴대폰 문자함', '은행 앱'], a: 0, why: '퍼즐 아이콘의 확장 목록과 서류 화면의 “연결됨” 표시로 확인합니다. 설치 전이면 설치하기부터 따라 해요.' }
  ] });

S('ch_overview', { n: 4, short: '화면 한눈에', page: ['home', 'tour'], focus: '시뮬레이션이 맡는 것: 네 구역의 이름과 위치를 가상 화면에서 반복해 찾고, “AI가 일하고 내가 승인한다”는 순서를 몸에 익힙니다. 실제 메일은 연습 예제에서 한 통만 보냅니다.',
  say: ['이번 주 금요일 오후 3시에 팀 회의가 있다고 (내 다른 주소)에 알려 줘.', '제목을 ‘금요일 회의 안내’로 바꿔 줘.', '네, 보내 줘. / 보내지 말고 취소해 줘.'],
  steps: [
    { k: 'zone', name: '구역 찾기', lay: LAY.home, v: [
      { q: '“예시 줄”을 펼치는 초록색 예시 버튼은 어느 구역 근처에 있나요?', a: 'ex', why: '예시 버튼은 입력창 왼쪽에 있고, 누르면 입력창 아래로 예시 줄이 펼쳐집니다.' },
      { q: '말로 일을 시키는 “가운데 입력창”은 어디인가요?', a: 'input', why: '입력창에 하고 싶은 일을 평소 말투로 적고 Enter(↑)를 누르면 나비가 읽고 알맞은 곳으로 이어 줍니다.' },
      { q: '서류·메일·나비 길잡이 같은 이동 메뉴는 어디인가요?', a: 'side', why: '왼쪽 메뉴입니다. 아이콘만 보이다가 마우스를 올리면 이름이 나타납니다.' }] },
    { k: 'order', name: '일은 AI가, 결정은 내가', q: '메일을 보내는 순서대로 눌러 보세요.', items: ['입력창에 “금요일 3시 팀 회의를 내 다른 주소에 알려 줘”라고 적는다', '비서가 받는 사람·제목·본문 초안을 보여 준다(아직 나가지 않음)', '“제목을 ‘금요일 회의 안내’로 바꿔 줘”처럼 고치게 한다', '내용이 맞으면 “네, 보내 줘”라고 말한다(또는 [승인])', '그제야 메일이 나간다'], why: '일은 AI가 하고, 보내기 같은 중요한 단계는 내가 “좋아요” 한 뒤에만 진행됩니다.' },
    { k: 'pick', name: '아직 나갔나요?', q: '비서가 초안을 보여 줬습니다. 받는 사람의 다른 메일함을 열어 보면 메일은 와 있을까요?', opts: ['와 있다', '아직 오지 않았다 — 내가 승인하지 않았기 때문이다', '초안이 보이면 반드시 나간 것이다'], a: 1, why: '승인하기 전에는 나가지 않습니다. 그리고 이미 보낸 메일은 되돌릴 수 없으니 받는 사람 주소를 꼭 읽어 보세요.' }
  ] });

S('ch_topbar', { n: 5, short: '화면 위쪽과 왼쪽 맨 위', page: ['home', 'tour'], focus: '시뮬레이션이 맡는 것: 단추 하나하나의 위치·뜻을 틀려도 되는 환경에서 반복합니다. 실제 화면에서는 눌러 보기만 하는 연습 예제를 합니다.',
  say: ['내 설정 화면으로 가 줘.', '홈 화면으로 돌아가 줘.', '언어를 바꾸고 싶어.'],
  steps: [
    { k: 'zone', name: '단추 찾기', lay: LAY.home, v: [
      { q: '눌러서 홈 화면으로 가는 나비 아이콘은 어디에 있나요?', a: 'brand', why: '왼쪽 맨 위 나비 아이콘이 홈입니다. 그 옆 소개 ▾를 누르면 나비와 나비웹 백서가 내려와요(Esc로 닫기).' },
      { q: '내 메일 아이디(예: swift-heron-482)나 “로그인 필요” 표시는 어디에 보이나요?', a: 'top', why: '오른쪽 위입니다. 메일 아이디가 보이면 정식 로그인, “로그인 필요”면 로그인하지 않은 상태예요.' }] },
    { k: 'pick', name: '내 상태 읽기', v: [
      { q: '오른쪽 위에 “로그인 필요”가 보입니다. 지금 상태는?', opts: ['정식 로그인 상태', '로그인하지 않은 상태', '도우미가 연결된 상태'], a: 1, why: '아이디가 아니라 “로그인 필요”가 보이면 로그인하지 않은 상태입니다.' },
      { q: '오른쪽 위에 swift-heron-482가 보입니다. 지금 상태는?', opts: ['정식 로그인 상태', '로그인하지 않은 상태', '서류 작성 중'], a: 0, why: '메일 아이디가 보이면 정식 로그인한 상태입니다.' }] },
    { k: 'pick', name: '나타나는 때', q: '“Draft 저장 후 새 서류”와 “★ 내 서류함에 담기” 단추는 언제 보일까요?', opts: ['항상 보인다', '서류를 작성하는 동안에만 오른쪽 위에 나타난다', '메일을 쓸 때만'], a: 1, why: '앞의 것은 지금 서류를 Draft로 저장하고 새 서류를 시작하며, 뒤의 것은 열린 서류를 내 서류함의 자주 쓰는 양식에 담습니다.' }
  ] });

S('ch_leftmenu', { n: 6, short: '왼쪽 메뉴', page: ['home', 'tour'], focus: '시뮬레이션이 맡는 것: 메뉴 묶음(서류·메일·설정)의 소속을 가려 보는 연습입니다. 실제 화면에서는 눌러서 이름만 확인합니다.',
  say: ['내 서류함을 열어 줘.', '받은 메일함을 보여 줘.', '진행 중인 일이 있는지 보여 줘.'],
  steps: [
    { k: 'sort', name: '어느 묶음일까요', q: '각 항목은 어느 묶음 아래에 있나요?', buckets: ['서류', '메일', '설정'], items: [['내 서류함', 0], ['다른 사이트 입력', 0], ['작성한 서류', 0], ['빠른 발송', 1], ['주소록', 1], ['태그별 보관함', 1], ['부재중 자동응답', 2], ['폰 전용', 2], ['GDC 지갑', 2]], why: '서류: 서류 작성·Draft·작성한 서류·내 서류함·다른 사이트 입력. 메일: 빠른 발송·내 캠페인·캠페인 이력·주소록·편지쓰기·Draft·보낸메일함·받은메일함·태그별 보관함. 설정: 계정·프로필·AI 비서·GDC 지갑·내 기록·화면·폰 전용·서명·부재중 자동응답.' },
    { k: 'pick', name: '나비 길잡이 화면', q: '나비 길잡이를 누르면 어떻게 보이나요?', opts: ['하위 메뉴 없이 한 화면이 열리고, 위쪽에 진행 중 · 완료 · 맡긴 일 · 맡은 일 탭이 있다', '서류처럼 왼쪽에 하위 메뉴가 펼쳐진다', '메일 화면으로 넘어간다'], a: 0, why: '나비 길잡이는 하위 메뉴 없이 위쪽 탭으로 오갑니다. 나 홀로 일은 진행 중·완료 탭에 함께 나와요.' },
    { k: 'pick', name: '길을 잃었을 때', q: '어느 화면에서든 처음으로 돌아가려면?', opts: ['왼쪽 맨 위 나비 아이콘 또는 🏠 홈을 누른다', '브라우저를 닫는다', '로그아웃한다'], a: 0, why: '맨 위 나비 아이콘이나 🏠 홈을 누르면 처음 화면으로 돌아옵니다.' }
  ] });

S('ch_inputbar', { n: 7, short: '입력창과 예시 줄', page: ['home', 'input'], focus: '시뮬레이션이 맡는 것: 문장 하나가 어디로 이어지는지(메일·서류·전문가·기관·그냥 대화) 판단하는 연습을 여러 문장으로 반복합니다. 실제 연습 예제는 예시 줄 조작에 집중합니다.',
  say: ['이번 주에 할 일을 정리해 줘.', '제주세무서에 문의할 게 있어요.', '가장 쉬운 서류 작성 방법을 알려 줘.'],
  steps: [
    { k: 'sort', name: '어디로 이어질까', q: '입력창에 이 말을 적으면 비서가 어디로 이어 줄까요?', buckets: ['메일', '서류 작성', '전문가 상담', '기관(정부)', '그냥 대화'], items: [['이번 주 금요일 3시 팀 회의를 (내 다른 주소)에 알려 줘.', 0], ['아이가 감기로 학교를 못 갔어요. 결석 사유를 내야 해요.', 1], ['계약 문제로 다툼이 생겼어요.', 2], ['제주세무서에 문의할 게 있어요.', 3], ['이번 주에 할 일을 정리해 줘.', 4]], why: '메일이면 메일로, 서류면 서류 작성으로, 상담이면 전문가 상담으로 이어 줍니다. 애매할 때만 최대 2번 되묻고, 항상 “그냥 대화로 계속” 선택지가 있어요.' },
    { k: 'pick', name: '서류 작성 ▾는 어디에?', q: '“서류 작성 ▾”(서류 검색·양식 업로드·정보 공개 청구) 버튼은 어디에 나타나나요?', opts: ['홈 화면의 예시 줄', '왼쪽 메뉴 서류를 눌러 서류 작성 화면에 들어가면 나타난다', '설정 화면'], a: 1, why: '홈 예시 줄에는 인프라 AI ▾ · 전문직 AI ▾ · 정부 AI ▾ · 가상 판결 · 나비 숫자 코드가 있고, 서류 작성 ▾는 서류 화면에서 나타납니다.' },
    { k: 'pick', name: '서류를 쓰는 동안', q: '서류를 고르면 입력창은 어떻게 되고, 질문은 어디에서 하나요?', opts: ['입력창에 서류 이름만 보이고 잠긴다. 질문은 💬 대화창에서 한다', '그대로 쓸 수 있다', '입력창이 사라지고 질문은 할 수 없다'], a: 0, why: '서류를 쓰는 동안 입력창은 서류 이름만 보이고 잠깁니다. 질문·지시는 💬 대화창에서 합니다.' }
  ] });

S('ch_apk_install', { n: 8, short: '안드로이드 앱 설치', page: ['home', 'install'], focus: '시뮬레이션이 맡는 것: 가짜 안내와 진짜 안내를 가려내는 “설치 전 3가지 확인”을 여러 상황으로 반복합니다. 실제로는 파일을 받지 않고 읽기만 합니다.',
  say: ['naviweb.apk가 안전한지 확인하는 방법을 알려 줘.', '설치할 때 ‘알 수 없는 앱’ 경고가 떠요.', '아이폰은 어떻게 설치해요?'],
  steps: [
    { k: 'sort', name: '설치해도 될까', q: '아래 상황을 설치해도 되는 경우와 멈춰야 하는 경우로 나눠 보세요.', buckets: ['설치해도 된다', '멈춘다'], items: [['폰 Chrome 주소창에 naviweb.kr/install을 직접 입력해 열었고, 파일은 naviweb.apk, 크기는 약 2.2MB', 0], ['문자로 받은 다른 주소의 링크를 눌러 열었다', 1], ['파일 이름이 naviweb-new.apk 이다', 1], ['크기가 48MB로 표시된다', 1]], why: '출처(naviweb.kr/install을 직접 입력)·이름(naviweb.apk)·크기(약 2.2MB) 세 가지가 모두 맞을 때만 계속합니다. 하나라도 다르면 설치하지 않아요.' },
    { k: 'pick', name: '경고가 떴다', q: '“앱 내려받기”를 누르자 Chrome이 “유해한 파일일 수도 있음”을 띄웠습니다. 위 세 가지는 모두 맞습니다. 어떻게 할까요?', opts: ['앱 파일(.apk)은 항상 이런 경고가 나온다는 것을 알고, 세 가지가 맞으니 계속한다', '무조건 중단하고 신고한다', '경고를 끄는 다른 앱을 먼저 받는다'], a: 0, why: '스토어 밖 앱은 경고가 여러 번 나옵니다. 중요한 것은 출처·이름·크기를 내 눈으로 확인하는 습관이에요.' },
    { k: 'pick', name: '그 밖의 경우', v: [
      { q: '아이폰을 쓰는 사람이 설치하려 합니다.', opts: ['아이폰은 지원하지 않는다', '같은 방법으로 된다', '설치 파일을 메일로 받으면 된다'], a: 0, why: '아이폰은 지원하지 않습니다.' },
      { q: '예전에 설치한 나비웹 앱이 이미 있습니다. 새로 설치하려면?', opts: ['덮어쓰면 된다', '먼저 삭제해야 한다(서명이 달라 덮어쓰기가 안 된다)', '폰을 초기화한다'], a: 1, why: '이전에 설치한 나비웹 앱이 있으면 먼저 삭제해야 합니다.' }] }
  ] });

S('ch2', { n: 9, short: '사람 찾기·호출하기', page: ['home', 'people'], focus: '시뮬레이션이 맡는 것: “정확히 같아야 찾아진다”는 검색 규칙을 가상 이용자 명단으로 반복합니다. 실제 사람에게는 알림이 가므로 초대는 보내지 않습니다.',
  say: ['홍길동 불러 줘.', '김영희 씨와 대화하고 싶어.', '연락처에서 박철수를 찾아 줘.'],
  steps: [
    { k: 'pick', name: '검색어 고르기', q: '가상 이용자 명단에 “김영희”가 있습니다(“김영희”만 등록). 사용자 검색 창에 어떻게 적어야 찾아질까요?', opts: ['김영', '영희', '김영희', '김 영 희 씨'], a: 2, why: '카카오톡처럼 이름이 정확히 같아야 찾아집니다. 일부만 적으면 결과가 없어요.', no: { 0: '일부만 적으면 찾아지지 않아요.', 1: '일부만 적으면 찾아지지 않아요.', 3: '정확히 같은 이름이 아니에요.' } },
    { k: 'pick', name: '결과 읽기', q: '검색 결과가 없습니다. 화면은 어떻게 안내하나요?', opts: ['초대 문자 보내기를 안내한다(연습에서는 보내지 않고 창을 닫는다)', '비슷한 이름을 모두 보여 준다', '자동으로 초대를 보낸다'], a: 0, why: '찾으면 이름을 눌러 대화 초대가 가고, 찾지 못하면 초대 문자 보내기가 안내됩니다. 실제 사람에게는 알림이 가니 연습에서는 보내지 마세요.' },
    { k: 'pick', name: '말로 찾기', q: '말로 상대를 부를 때 알맞은 것은?', opts: ['내 AI 비서 대화창에 “홍길동 불러 줘”라고 적는다', '입력창에 상대의 비밀번호를 적는다', '화면을 새로고침한다'], a: 0, why: '방법 A는 말로, 방법 B는 돋보기 아이콘의 사용자 검색 창입니다. 주고받은 말은 종료할 때 PDV에 저장돼요.' }
  ] });

S('ch3', { n: 10, short: '비서 채팅 vs 다른 AI 호출', page: ['home', 'input'], focus: '시뮬레이션이 맡는 것: 어디에 물어야 할지 모를 때의 기본 동선과 직접 고르는 동선을 상황별로 구분해 봅니다.',
  say: ['요즘 밤마다 가슴이 두근거려요.', '종합소득세 신고는 어떻게 하나요?', '이 장면은 어디에 물어야 하죠?'],
  steps: [
    { k: 'pick', name: '모를 때는', q: '세금인지 법률인지 건강인지, 어디에 물어야 할지 모를 때는?', opts: ['일단 내 AI 비서에게 말한다. 비서가 알맞은 전문 AI를 찾아 연결해 준다', '검색창에서 직접 전문가를 찾아야 한다', '질문하지 않는다'], a: 0, why: '병원 접수 창구에서 “어디가 아프세요?” 하고 묻고 내과·치과로 안내하는 것과 같아요.' },
    { k: 'pick', name: '직접 고르려면', q: 'PC에서 전문직 AI·정부 AI·인프라 AI를 직접 고르려면?', opts: ['입력창 왼쪽 예시 버튼을 눌러 예시 줄의 ▾ 목록에서 고른다', '설정 → 계정에서 고른다', '메일 화면에서 고른다'], a: 0, why: '예시 줄의 목록(▾)에서 직접 고를 수 있고, 비서에게 말로 시키는 것과 같은 곳으로 연결됩니다.' },
    { k: 'pick', name: '비서는 누구', q: '나만의 AI 비서와 전문가 AI의 차이로 맞는 것은?', opts: ['비서는 나 한 사람 전용이고, 전문가 AI는 한 분야에 맞춘 AI로 내가 골라 쓴다', '둘은 똑같다', '전문가 AI가 내 기록을 모두 가진다'], a: 0, why: '나비는 나 한 사람을 위해 일하고, 전문가 AI(변호사·세무사 등)는 분야별로 골라 쓰며 답은 참고용입니다.' }
  ] });

S('ch4', { n: 11, short: '메시지 주고받기', page: ['home', 'chat'], focus: '시뮬레이션이 맡는 것: 말 한 줄이 기관·서비스·전문가 중 누구를 부르는지 가려 보는 연습을 반복합니다. 실제로는 연습 예제에서 세 번만 불러 봅니다.',
  say: ['제주세무서에 문의할 게 있어요.', '강남구청에서 서류를 떼려고요.', '계약 문제로 다툼이 생겼어요.'],
  steps: [
    { k: 'sort', name: '누구를 부를까', q: '이 말을 하면 화면 맨 위에 어떤 상대가 뜰까요?', buckets: ['기관', '분야 전담 서비스', '전문가'], items: [['제주세무서에 문의할 게 있어요.', 0], ['강남구청에서 서류를 떼려고요.', 0], ['종합소득세 신고는 어떻게 하나요?', 1], ['특허를 내고 싶어요.', 2], ['계약 문제로 다툼이 생겼어요.', 2]], why: '비서가 “…를 열겠습니다.” 같은 한 문장으로 알리고 상대 이름이 맨 위에 뜹니다. 처음에 한 말이 이어져 다시 설명하지 않아도 돼요.' },
    { k: 'pick', name: '돌아오기', q: '전문가와 대화하다가 내 비서로 돌아오려면?', opts: ['칩의 ×를 누르거나 화면을 벗어난다', '로그아웃한다', '새 탭에서 다시 시작한다'], a: 0, why: '칩의 ×를 누르거나 화면을 벗어나면 담당이 다시 나만의 AI 비서로 돌아옵니다.' },
    { k: 'pick', name: '적지 말 것', q: '전문가 AI 연습에서 적어도 되는 말은?', opts: ['일반적인 질문(예: 종합소득세 신고는 어떻게 하나요?)', '실제 사건 내용', '주민등록번호'], a: 0, why: '전문가 AI의 답은 참고용입니다. 연습에서는 실제 사건·병력·주민번호를 적지 마세요.' }
  ] });

S('ch5', { n: 12, short: '마이크·카메라·파일 첨부', page: ['home', 'attach'], focus: '시뮬레이션이 맡는 것: 폰 촬영이 PC까지 오는 여섯 단계를 순서·조건으로 먼저 익힙니다. 실제 알림·카메라는 연습 예제에서 한 번만 씁니다.',
  say: ['폰으로 영수증을 찍어서 서류에 넣고 싶어.', '찍은 사진 이름을 바꿔 줘.', '촬영 연결을 끝내 줘.'],
  steps: [
    { k: 'order', name: '폰 촬영 순서', q: '서류를 쓰는 중에 폰으로 종이 서류를 찍어 넣는 순서대로 눌러 보세요.', items: ['PC 입력창 왼쪽 ＋ 단추 → 「📱 폰으로 촬영」을 고른다', '폰에 온 “서류 촬영 요청” 알림을 눌러 연다', '폰에서 「사진 찍기」(또는 「갤러리에서 고르기」)로 보낸다', 'PC 초록 상자의 “폰에서 온 자료”에서 이름을 확인하고 쓸 사진만 체크한다', '「체크한 자료를 서류에 사용」을 누른다', '「촬영 끝내기」로 연결을 끝낸다'], why: '같은 계정으로 로그인한 폰과 PC가 하나처럼 움직입니다. 쓰지 않고 2시간이 지나면 저절로 끊어져요.' },
    { k: 'pick', name: '카메라는 누가 켜나', q: '폰 카메라는 언제 켜질까요?', opts: ['내가 폰 알림을 눌러야만 켜진다. PC가 몰래 켤 수 없다', 'PC에서 단추를 누르면 바로 켜진다', '항상 켜져 있다'], a: 0, why: '폰 카메라는 내가 알림을 눌러야만 켜집니다.' },
    { k: 'pick', name: '이럴 땐?', v: [
      { q: '시작 전에 확인할 두 가지로 맞는 것은?', opts: ['PC와 폰에 같은 계정으로 로그인 + 폰에서 나비웹 알림이 켜져 있음', 'PC와 폰이 같은 와이파이에 있음', '폰에 카메라 앱이 있음'], a: 0, why: '같은 계정으로 로그인되어 있어야 하고, 폰에서 나비웹 알림이 켜져 있어야 합니다(배터리 “항상 허용”).' },
      { q: '소송 서류에서 폰으로 보낸 첫 사진에는 어떤 이름이 붙나요?', opts: ['갑 제1호증', '자료 1', '사진 1'], a: 0, why: '소송 서류는 “갑 제1호증”, 그 밖은 “자료 1”로 이름이 붙습니다. 이름이 틀리면 PC에서 고칠 수 있어요.' }] }
  ] });

S('ch6', { n: 13, short: '나비 숫자 코드', page: ['home', 'code'], focus: '시뮬레이션이 맡는 것: 전화번호가 열 칸 코드로 바뀌는 규칙을 여러 번호로 연습하고, 연습 식당의 메뉴로 계산해 봅니다. 실제 코드 읽기는 연습 식당에서 한 번 해 봅니다.',
  say: ['010-1234-5678은 어떤 코드가 돼?', '이 가게의 AI 비서에게 영업시간을 물어봐 줘.', '해물탕은 얼마예요?'],
  steps: [
    { k: 'text', name: '번호 → 코드', gen: function (r) { var mobile = r() < 0.5, p; if (mobile) { p = '010-' + ri(r, 1000, 9999) + '-' + ri(r, 1000, 9999); } else { p = '064-' + ri(r, 100, 999) + '-' + ri(r, 1000, 9999); } var d = p.replace(/-/g, '').replace(/^0/, ''); while (d.length < 10) d = '0' + d; return { q: '전화번호 ' + p + ' 는 열 칸 코드로 어떻게 바뀔까요?', facts: '규칙: 맨 앞의 0을 빼고 이어 쓴 뒤, 열 칸이 되도록 앞에 0을 채웁니다(010-1234-5678 → 1012345678).', ph: '열 칸 숫자', check: function (v) { return v === d; }, hint: '맨 앞 0을 빼고 번호를 이은 다음, 열 칸이 되도록 앞에 0을 채워 보세요.', why: '정답은 ' + d + ' 입니다. 직접 계산할 필요는 없어요. 전화번호를 입력하면 나비가 알아서 코드로 바꿔 줍니다.' }; } },
    { k: 'calc', name: '연습 식당 계산', q: '연습 식당(가상)에서 해물탕 1개와 비빔밥 2개를 시키면 합계는 얼마일까요?', facts: '메뉴: 해물탕 12,000원 · 생선구이 정식 18,000원 · 비빔밥 9,000원 · 보리차 무료', a: 30000, unit: '원', why: '12,000 + 9,000 × 2 = 30,000원. 연습 식당은 가상이라 주문·결제·리뷰가 실제로 이루어지지 않아요.', hint: '해물탕 12,000원 + 비빔밥 9,000원 × 2개.' },
    { k: 'pick', name: '손님·가게 규칙', v: [
      { q: '리뷰는 누가 쓸 수 있나요?', opts: ['실제로 결제한 손님만, 결제 직후에', '누구나', '가게 주인만'], a: 0, why: '리뷰는 누구나 읽을 수 있고, 쓰기는 결제한 손님만 합니다. 그래서 믿고 읽을 수 있어요.' },
      { q: '연습 식당은 월요일이 휴무이고 영업시간은 11:00~21:00입니다. 월요일 낮 12시에 방문할 수 있나요?', opts: ['없다 — 월요일은 휴무', '있다', '저녁에만 있다'], a: 0, why: '연습 식당은 월요일 휴무입니다. 메뉴에 없는 것을 물으면 “없다”고 솔직히 답해야 해요.' },
      { q: '코드를 찍으면 가게 화면은 어떤 언어로 열릴까요?', opts: ['내 폰의 언어 설정에 맞는 언어', '항상 한국어', '가게 주인이 정한 언어'], a: 0, why: '나비가 폰의 언어를 알아보고 그 언어 버전으로 가게 화면을 엽니다.' }] }
  ] });

S('ch7', { n: 14, short: '폰-PC 연동과 알림', page: ['settings', 'phone'], focus: '시뮬레이션이 맡는 것: 알림이 늦거나 안 올 때의 원인을 증상별로 가려 봅니다. 실제 폰 설정 점검은 연습 예제에서 내 폰으로 합니다.',
  say: ['로그인 알림이 안 와요.', '알림 소리를 크게 하고 싶어요.', '승인 시간이 지났어요. 다시 하려면?'],
  steps: [
    { k: 'pick', name: '증상 → 원인', v: [
      { q: '로그인 알림은 오는데 소리가 나지 않습니다. 가장 먼저 볼 것은?', opts: ['알림 중요도(긴급: 소리 및 팝업)와 무음·방해 금지 모드', 'PC의 해상도', '메일 서명'], a: 0, why: '알림을 길게 눌러 중요도를 “긴급(소리 및 팝업)”으로 바꾸고, 무음·방해 금지 모드에서는 소리가 나지 않으니 모드도 확인하세요.' },
      { q: '알림이 몇 시간 뒤에야 오거나 아예 오지 않습니다. 확인할 설정은?', opts: ['폰 설정 → 앱 → 나비 → 배터리(백그라운드)에서 “항상 허용”', '화면 밝기', '글자 크기'], a: 0, why: '백그라운드 사용이 제한되면 알림이 늦거나 놓칩니다. “항상 허용”인지 확인하세요.' },
      { q: '로그인 승인 알림을 문자 메시지로 기다리고 있습니다. 맞을까요?', opts: ['알림은 문자가 아니라 인터넷(Wi-Fi 포함)으로 온다', '문자로 온다', '메일로 온다'], a: 0, why: '“서명 요청” 알림은 문자가 아니라 인터넷으로 옵니다.' }] },
    { k: 'order', name: '알림 점검 순서', q: '알림이 늦을 때 점검하는 순서대로 눌러 보세요.', items: ['PC에서 로그인을 시작해 “서명 요청” 알림이 몇 초 만에 오는지 잰다', '알림을 길게 눌러 중요도를 “긴급”, 소리·진동을 켠다', '폰 설정에서 나비 앱의 배터리를 “항상 허용”으로 둔다', 'PC에서 “다시 입력”으로 새 알림을 만들어 다시 시험한다'], why: '한 번 바꾸면 이후 나비웹 알림에 모두 적용됩니다. 메뉴 이름은 폰마다 달라요.' },
    { k: 'pick', name: '낯선 요청', q: '내가 시작하지 않은 서명 요청이 왔습니다.', opts: ['누르지 않는다', '눌러서 확인해 본다', '소리부터 키운다'], a: 0, why: '내가 시작하지 않은 서명 요청은 누르지 마세요.' }
  ] });

S('ch8', { n: 15, short: '내 프로필', page: ['settings', 'profile'], focus: '시뮬레이션이 맡는 것: 가상의 가게 프로필로 “무엇을 공개로 바꿀지” 판단하고 말로 고치는 순서를 연습합니다. 실제 프로필은 가상 값으로만 채웁니다.',
  say: ['제주 한림에서 감귤 농사를 짓고 있어요. 프로필을 만들어 주세요.', '메뉴를 맨 위로 올려 줘.', '소개 글을 더 짧게 줄여 줘.'],
  steps: [
    { k: 'order', name: '프로필 만드는 순서', q: '말로 프로필을 만드는 순서대로 눌러 보세요.', items: ['왼쪽 메뉴 맨 아래 설정 → 프로필을 연다', '말풍선 아이콘을 누르고 가게를 말로 설명한다', '오른쪽 시안이 바뀌는 것을 본다', '“파란색 느낌으로”처럼 한 가지씩 고쳐 달라고 한다', '공개로 바꿀 항목만 정한다(새 항목은 처음에 비공개)', '연습으로 채운 내용은 지운다'], why: '프로필 초안은 이 브라우저에만 보관되고, 공개로 바꾼 항목만 다른 사람에게 보입니다.' },
    { k: 'sort', name: '공개 / 비공개', q: '가상의 중국음식점 프로필입니다. 손님에게 보여 줄 것과 비공개로 둘 것을 나눠 보세요.', buckets: ['공개로 바꾼다', '비공개로 둔다'], items: [['가게 이름과 대표 메뉴(짜장면·짬뽕)', 0], ['영업시간(오후 3시~5시 휴식)', 0], ['사장님의 개인 휴대폰 번호', 1], ['사장님 집 주소', 1]], why: '새 항목은 처음에 비공개이고, 공개로 바꾼 항목만 나타납니다. 연락처·주소는 가상의 값으로 적고 진짜 번호는 공개하지 마세요.' },
    { k: 'pick', name: '고쳐 달라고 말하기', q: '시안을 고치는 말로 가장 알맞은 것은?', opts: ['“영업시간을 눈에 띄게” 처럼 한 번에 한 가지씩', '“전부 다 마음에 안 드니 처음부터 새로 해 줘”', '“알아서 해”'], a: 0, why: '한 가지씩 고쳐 달라고 하면 시안이 어떻게 바뀌었는지 확인하기 쉬워요.' }
  ] });

S('ch9', { n: 16, short: '설정 페이지 사용법', page: ['settings', 'account'], focus: '시뮬레이션이 맡는 것: 어느 설정이 어느 탭에 있는지 찾고, 바꾼 것을 되돌리는 순서를 연습합니다. 실제 설정은 바꾼 뒤 연습 예제에서 원래대로 돌립니다.',
  say: ['서명을 ‘○○ 드림’으로 바꿔 줘.', '부재중 자동응답을 꺼 줘.', '존댓말로 짧게 답해 줘.'],
  steps: [
    { k: 'sort', name: '어느 탭일까', q: '이 설정은 어느 탭에 있나요?', buckets: ['AI 비서', '화면', '서명', '부재중 자동응답', 'GDC 지갑'], items: [['“존댓말로 짧게” 같은 내 AI 비서 지시', 0], ['화면 색상과 언어·지역', 1], ['메일 끝에 붙는 이름 맺음말', 2], ['휴가 중 자동으로 보내는 답장', 3], ['GDC 잔액과 사용 내역', 4]], why: '설정 위쪽에는 계정 · 프로필 · AI 비서 · GDC 지갑 · 내 기록 · 화면 · 폰 전용 · 서명 · 부재중 자동응답 탭이 있습니다. 어느 탭이든 제목과 설명 → 카드 → 입력칸과 단추 순서라 익숙해지면 쉬워요.' },
    { k: 'pick', name: '되돌리기', q: '화면 색을 초록으로 바꿔 봤습니다. 원래대로 돌리려면?', opts: ['같은 화면 맨 아래의 “기본값(파랑·레일)으로 되돌리기”를 누른다', '브라우저를 다시 설치한다', '계정을 삭제한다'], a: 0, why: '설정은 안전하게 바꿔 보고 되돌릴 수 있습니다.' },
    { k: 'pick', name: '저장과 적용 범위', v: [
      { q: '이 기기에서 AI 비서 지시를 저장했습니다. 다른 기기에도 적용될까요?', opts: ['아니다 — 지시와 스킨은 이 브라우저에 저장된다', '예, 모든 기기에 적용된다', '폰에만 적용된다'], a: 0, why: '지시와 스킨은 이 브라우저에 저장되어 다른 기기에는 적용되지 않습니다.' },
      { q: 'AI 비서 지시에 적어도 되는 것은?', opts: ['“존댓말로 짧게, 세 줄 이내로 답해 줘.”', '주민번호', '계좌번호와 비밀번호'], a: 0, why: '개인정보(주민번호·계좌번호·비밀번호)는 지시에 적지 마세요. 편집을 눌러야 글을 쓸 수 있고 “저장했습니다”가 보이면 끝이에요.' }] }
  ] });

S('ch_wallet', { n: 17, short: '지갑과 백업 키', page: ['settings', 'gdc'], focus: '시뮬레이션이 맡는 것: 새 폰에서 “지갑을 열 수 없습니다”가 떴을 때의 선택과 백업 키 보관 판단을 가상 상황으로 반복합니다. 진짜 백업 키는 연습에서도 복사·공유하지 않습니다.',
  say: ['백업 키를 언제 어느 주소로 보냈는지 알려 줘.', '새 폰에서 내 지갑을 쓰려면 어떻게 해?', '백업 키를 잃어버리면 어떻게 돼?'],
  steps: [
    { k: 'pick', name: '새 폰에서', v: [
      { q: '새 폰에 로그인했더니 “이 기기에 저장된 지갑을 열 수 없습니다”가 떴습니다. 가입 때 받은 백업 키 메일이 있습니다.', opts: ['백업 키로 복구', '이 기기에서 새로 시작', '나중에'], a: 0, why: '백업 키(개인키)를 붙여 넣고 확인하면 이 폰에서도 지갑을 쓸 수 있습니다.' },
      { q: '같은 안내가 떴습니다. 이전 폰이 아직 내 손에 있고 잘 켜집니다.', opts: ['다른 기기에서 이 지갑 가져오기(지갑을 가진 다른 기기가 승인)', '이 기기에서 새로 시작', '이전 폰을 초기화'], a: 0, why: '지갑을 가진 다른 기기가 승인하면 가져올 수 있습니다.' },
      { q: '백업 키도 없고 이전 폰도 잃어버렸습니다. 남은 선택은?', opts: ['이 기기에서 새로 시작(이전 지갑의 데이터는 이어지지 않을 수 있음)', '서버에서 사본을 받는다', '백업 키 없이 복구'], a: 0, why: '백업 키는 서버에 사본이 없어 잃으면 되찾을 방법이 없습니다. 그래서 가입 때 받은 키를 잘 보관하세요.' }] },
    { k: 'sort', name: '보관 장소', q: '백업 키 보관 방법을 알맞게 나눠 보세요.', buckets: ['알맞다', '위험하다'], items: [['비밀번호 관리자에 붙여 넣어 둔다', 0], ['본인만 보는 메모에 보관한다', 0], ['화면을 캡처해 단체 채팅방에 올린다', 1], ['가족·친구에게 보여 준다', 1]], why: '백업 키를 아는 사람은 누구나 내 계정이 될 수 있어요. 캡처하거나 다른 사람과 공유하지 마세요.' },
    { k: 'pick', name: '이 기기의 기존 키', q: '“다른 기기의 백업 키로 복구”를 적용하면 이 기기에 이미 있던 로컬 키는?', opts: ['교체된다 — 쓰던 키를 따로 보관해 두었는지 먼저 확인한다', '그대로 함께 쓰인다', '자동으로 백업된다'], a: 0, why: '이 기기에 이미 있던 로컬 키는 교체되니, 쓰던 키를 따로 보관해 두었는지 먼저 확인하세요.' }
  ] });

S('ch_helpmenu', { n: 18, short: '도움말·대화 패널', page: ['home', 'chat'], focus: '시뮬레이션이 맡는 것: 화면마다 담당 AI가 달라지는 것과 도우미가 일하는 순서를 상황으로 반복합니다. 실제 도우미는 연습 예제에서 “발급·제출 직전 아니오”까지만 씁니다.',
  say: ['이 화면에서 뭘 할 수 있어?', '납세증명서를 발급받아 첨부해 줘.', '이 장에서 제일 중요한 게 뭐예요?'],
  steps: [
    { k: 'pick', name: '누가 나오나', v: [
      { q: '홈(메인) 화면에서 💬를 누르면 누가 나오나요?', opts: ['나만의 AI 비서', '서류 작성 SP', '은행 전문 SP'], a: 0, why: '홈에서는 나만의 AI 비서가 나옵니다. 무엇이든 편하게 물어보세요.' },
      { q: '서류 작성 화면에서 서류를 하나 고른 뒤 💬를 누르면?', opts: ['그 서류의 서류 작성 SP', '나만의 AI 비서', '아무도 나오지 않는다'], a: 0, why: '지금 쓰는 서류에 맞춰 도와 주는 서류 작성 SP가 맡습니다.' },
      { q: '은행·대학·식당 같은 페이지에서 💬를 누르면?', opts: ['그 분야를 잘 아는 전문 SP', '항상 나만의 AI 비서', '서류 작성 SP'], a: 0, why: '화면이 바뀌면 담당 AI도 바뀝니다.' }] },
    { k: 'order', name: '도우미에게 시키는 순서', q: '서류 작성 중 필요한 서류를 도우미에게 받아 오게 하는 순서대로 눌러 보세요.', items: ['서류 작성 화면에서 💬를 누른다', '하고 싶은 일을 말로 적는다(예: “납세증명서를 발급받아 첨부해 줘.”)', '도우미가 필요한 사이트를 열어 화면을 준비한다', '로그인과 결제는 내가 직접 한다', '발급된 서류가 작성 중인 서류에 첨부·반영된다'], why: '도우미는 데이터 모으기·입력란 채우기·서류 발급받기를 맡고, 로그인과 결제는 항상 내가 합니다.' },
    { k: 'pick', name: 'SP 계층', q: 'SP가 나무처럼 이어져 있다는 말의 뜻은?', opts: ['아래쪽 SP는 위쪽 SP가 아는 것을 모두 이어받고 자기 분야 지식을 더한다', '위쪽 SP는 아래쪽 SP의 일을 대신한다', '모든 SP는 서로 무관하다'], a: 0, why: '그래서 도움말은 보통 그 페이지와 가장 가까운 아래쪽 SP를 불러 줍니다.' }
  ] });

S('ch_howto_tab', { n: 19, short: '전문가 인증서와 안전장치', page: ['cert', 'exam'], focus: '시뮬레이션이 맡는 것: 학습 기록이 “기록 부족”인지 “이상 신호”인지 가르는 판단과 도우미 안전장치 상황을 반복합니다. 실제 학습 이력은 연습 예제에서 내 기록으로 확인합니다.',
  say: ['내가 어느 장을 얼마나 공부했는지 알려 줘.', '‘기록 부족’이라고 뜨는데 어떻게 해?', '공부 안 하고 시험만 보면 어떻게 돼?'],
  steps: [
    { k: 'sort', name: '기록 읽기', q: '학습 기록 상황을 알맞게 나눠 보세요.', buckets: ['기록 부족(그 장을 다시 읽으면 된다)', '이상 신호(오프라인 시험 필요)'], items: [['퀴즈는 맞혔는데 다른 브라우저에서 학습해서 이 브라우저에 읽은 기록이 없다', 0], ['읽은 시간이 권장 시간의 40%에도 못 미치는 장이 있다', 1], ['하루에 12개 이상의 장을 끝냈다', 1], ['기록 기능이 생기기 전에 마친 장이다', 0]], why: '기록 부족은 문제가 아니며 그 장을 다시 열어 읽으면 됩니다. 이상 신호는 온라인 시험 대신 오프라인 시험이 필요해요. 기준은 시범 운영 값이라 조정될 수 있어요.' },
    { k: 'pick', name: '학습 시간이 쌓이나', q: '매뉴얼을 켜 두고 자리를 비웠습니다. 학습 시간은 어떻게 될까요?', opts: ['쌓이지 않는다 — 탭이 보이고 2분 안에 조작이 있을 때만 센다', '켜 둔 시간만큼 쌓인다', '하루 치가 한 번에 쌓인다'], a: 0, why: '시간은 탭이 화면에 보이고 2분 안에 스크롤·클릭 같은 조작이 있을 때만 셉니다. 기록은 이 브라우저에만 저장돼요.' },
    { k: 'pick', name: '안전장치 장면', v: [
      { q: '도우미가 사이트에서 결제 단추 앞까지 왔습니다.', opts: ['도우미는 멈추고 확인을 구한다. 결제는 내가 한다', '도우미가 이어서 결제한다', '무조건 취소된다'], a: 0, why: '제출·전송 단추는 내 확인 없이는 누르지 않는 것이 도우미의 규칙이고, 로그인과 결제는 내가 합니다.' },
      { q: '인증서는 어떤 성격인가요?', opts: ['나비웹이 운영하는 민간 멤버십 인증서로 국가 자격이 아니다', '국가가 인정하는 자격증이다', '변호사 면허를 대신한다'], a: 0, why: '국가 자격증이 아니며 변호사·세무사 같은 전문가 면허를 대신하지 않습니다.' }] }
  ] });

S('ch_kmail_basic', { n: 20, short: 'K-Mail', page: ['mail', 'compose'], focus: '시뮬레이션이 맡는 것: 캠페인 순서와 메뉴 선택을 가상 메일함으로 반복합니다. 실제로는 내 다른 주소로 한 통만 보내 봅니다. 여기서는 어떤 메일도 나가지 않습니다.',
  say: ['다음 달 세미나 참석자 모집 메일을 써 줘. 답장이 오면 정리해서 보고해 줘.', '더 짧게 써 줘.', '쓰다 만 메일을 이어서 쓰고 싶어.'],
  steps: [
    { k: 'order', name: '캠페인 순서', q: '말로 메일 캠페인을 진행하는 순서대로 눌러 보세요.', items: ['지시한다(누구에게, 무슨 목적으로)', '주소록에서 찾은 대상을 보고 승인한다', '받는 사람·제목·본문 초안을 확인한다', '“보내 줘”라고 말한다', '답장이 오면 회신 취합 보고를 받는다'], why: '내가 확인한 뒤에만 발송되며, 확인 없이 보내려 해도 서버가 막고 “아직 발송하지 않았습니다”라고 알립니다.' },
    { k: 'pick', name: '어느 메뉴?', v: [
      { q: '급한 한 통을 받는 사람 한 명에게 확인 없이 바로 보내려면?', opts: ['빠른 발송', '내 캠페인', '태그별 보관함'], a: 0, why: '빠른 발송은 확인 없이 즉시 나가니, 보내기 전에 한 번 더 읽어 보세요. 파일은 최대 25MB까지 붙일 수 있습니다.' },
      { q: '회신 취합 보고를 보려면?', opts: ['내 캠페인', '보낸메일함', '주소록'], a: 0, why: '캠페인으로 보낸 메일과 회신 취합 보고는 내 캠페인에서 봅니다.' },
      { q: '임시저장해 둔 편지를 이어 쓰려면?', opts: ['Draft', '받은메일함', '캠페인 이력'], a: 0, why: '임시저장한 글은 Draft에 모이고, 눌러서 이어 쓰거나 삭제합니다.' },
      { q: '받은 메일에 단 라벨(세미나·기관·문의)별로 모아 보려면?', opts: ['태그별 보관함', '보낸메일함', '빠른 발송'], a: 0, why: '태그별 보관함은 받은 메일의 라벨별로 모아 보여 줍니다.' }] },
    { k: 'pick', name: '보내기 전에', q: '이미 보낸 메일은 어떻게 되나요?', opts: ['되돌릴 수 없으니 발송 전 확인 화면에서 받는 사람과 내용을 꼭 본다', '언제든 회수할 수 있다', '24시간 안에는 취소된다'], a: 0, why: '이미 보낸 메일은 되돌릴 수 없습니다.' }
  ] });

S('ch_docmenu', { n: 21, short: '서류 메뉴와 서류 화면', page: ['docs', 'write'], focus: '시뮬레이션이 맡는 것: 서류 이름을 아는 경우/모르는 경우의 선택과 서류가 속한 분야 찾기를 반복합니다. 실제 서류는 연습 예제에서 결석계로 불러 봅니다.',
  say: ['회사에 낼 진단서가 필요해요.', '이사했는데 주소를 옮기려면 뭘 해야 하죠?', '이번 달 부가가치세 신고를 해야 해요.'],
  steps: [
    { k: 'pick', name: '어느 방법이 편할까', v: [
      { q: '필요한 서류 이름이 “결석계”라는 것을 이미 압니다. 어느 방법이 더 빠를까요?', opts: ['서류 화면의 검색창에 “결석”을 적어 직접 고른다', '대화로 길게 설명해 서류를 찾게 한다', '메일로 문의한다'], a: 0, why: '나비가 할 일이 줄어 정확한 서류를 곧바로 부를 수 있고 GDC도 아낄 수 있어요.' },
      { q: '무슨 서류를 써야 하는지 모르겠습니다. 어느 방법이 맞을까요?', opts: ['입력창에 상황을 말로 설명한다(예: “아이가 감기로 학교를 못 갔어요. 결석 사유를 내야 해요.”)', '서류 목록을 처음부터 끝까지 본다', '아무 서류나 연다'], a: 0, why: '어떤 서류를 써야 하는지 정하기 어려울 때는 말로 상황을 설명하면 서류 작성 비서가 알맞은 서류를 찾아 줍니다.' }] },
    { k: 'sort', name: '어느 분야 서류', q: '이 서류는 어느 분야에 속할까요?', buckets: ['학교 서류', '세무·회계 서류', '병원·의원 서류', '정보 공개 청구', '특허·상표 서류'], items: [['결석계', 0], ['부가가치세 신고 서류', 1], ['진단서', 2], ['제주도청 업무 지침 공개 청구서', 3], ['상표 출원 서류', 4]], why: '서류 종류(전체 · 정보 공개 청구 · 제주 행정 · 법률 · 세무·회계 · 병원·의원 · 특허·상표 · 감정평가 · 학교) 가운데 서류가 속한 분야를 고르거나 검색창에 서류 이름을 적어 고릅니다.' },
    { k: 'pick', name: '제출 단계', q: '서류 화면의 “제출”을 누르면?', opts: ['나비웹이 대신 접수하지 않고 단계별로 안내한다(도우미가 있으면 포털 칸 옮기기를 돕는다)', '나비웹이 기관에 바로 접수한다', '서류가 자동으로 삭제된다'], a: 0, why: '제출은 나비웹이 대신 접수하지 않고 단계별로 안내합니다. 로그인·확인·제출 클릭은 내가 해요.' }
  ] });

S('ch_guidecase', { n: 22, short: '나비 길잡이', page: ['guide', 'new'], focus: '시뮬레이션이 맡는 것: 일의 종류(나 홀로·맡긴 일·맡은 일)를 가르고 한 건을 끝까지 따라가 봅니다. 실제로는 연습 예제에서 나 홀로 일 하나를 만들어 봅니다.',
  say: ['이사하는데 전입신고, 주소 변경, 우편 정리를 다 해야 해요.', '오늘 할 일이 뭐지?', '이 일의 다음 단계를 알려 줘.'],
  steps: [
    { k: 'pick', name: '어느 탭?', v: [
      { q: '내가 전문가에게 맡긴 일은 어느 탭에 있나요?', opts: ['맡긴 일', '맡은 일', '나 홀로'], a: 0, why: '맡긴 일은 내가 전문가에게 맡긴 일입니다.' },
      { q: '다른 사람이 내게 맡긴 일은 어느 탭에 있나요?', opts: ['맡은 일', '맡긴 일', '완료'], a: 0, why: '맡은 일은 남이 내게 맡긴 일입니다.' },
      { q: '상대가 필요 없는 내 개인 일(이사 정리 등)은?', opts: ['나 홀로 일 — 진행 중·완료 탭에 함께 나온다', '맡긴 일', '맡은 일'], a: 0, why: '나 홀로 일은 상대 초대 없이 바로 진행 중이 됩니다.' }] },
    { k: 'order', name: '나 홀로 일 한 바퀴', q: '나 홀로 일을 만들고 끝내는 순서대로 눌러 보세요.', items: ['왼쪽 메뉴의 나비 길잡이 → 진행 중 탭을 연다', '“나 홀로 일”의 ＋ 새 일로 제목·종류를 정해 만든다', '나비 길잡이에게 과제를 말한다(예: “이사하는데 전입신고, 주소 변경, 우편 정리를 다 해야 해요”)', '보통 3회 안팎 대화하면 나오는 과제 계획서 초안을 읽는다', '일 상세의 종료 단추를 누르고 결과를 한 줄로 적는다', '완료 탭의 “나 홀로 일”에 “종료”로 나타나는지 확인한다'], why: '나 홀로 일은 합의 없이 바로 종료됩니다. 초대 메일은 보내지 않아요.' },
    { k: 'pick', name: '할 수 없는 것', q: '나비 길잡이가 계산해 주지 않는 것은?', opts: ['법정 기한', '해야 할 일 나누기', '진행 상황 확인'], a: 0, why: '법정 기한은 계산해 주지 않습니다. 정확한 기한은 해당 기관에서 확인하세요.' }
  ] });

S('ch_kclean_basic', { n: 23, short: 'K-Clean 첫걸음', page: ['home', 'clean'], focus: '시뮬레이션이 맡는 것: 장면별 신고 분류와 급한 순서 판단을 접수하지 않고 반복합니다. 실제 신고는 접수되어 기관에 전달되므로 연습에서도 보내지 않습니다.',
  say: ['해변에 그물과 스티로폼이 밀려와 쌓이고 있어요. 어제부터 계속이에요.', '공터에 냉장고가 버려져 있어요.', '시커먼 매연을 뿜는 버스를 봤어요.'],
  steps: [
    { k: 'sort', name: '장면 분류', q: '이 장면은 어디로 이어질까요?', buckets: ['쓰레기(환경 비서)', '경찰', '119', '시청(매연)', '제안'], items: [['해변에 밀려온 그물과 스티로폼', 0], ['빈 공터의 버려진 냉장고', 0], ['공장 뒤에서 하천에 폐유를 붓는 사람', 1], ['길에 쓰러져 숨을 안 쉬는 사람', 2], ['시커먼 매연을 뿜는 버스', 3], ['쓰레기통이 없는 해변 입구(이렇게 바꾸면 좋겠다)', 4]], why: '쓰레기는 환경 비서가 처리 방안을 세워 집행, 범법 행위는 경찰, 응급은 119, 매연 차량은 시청 등 관련 기관, “이렇게 바꾸면 좋겠다”는 제안입니다.' },
    { k: 'pick', name: '급한 순서', q: '한 장면에 쓰러진 사람과 몰래 버린 폐기물이 함께 있습니다. 먼저 할 일은?', opts: ['K-Clean을 기다리지 않고 먼저 119에 전화한다', '폐기물 사진부터 올린다', '쓰러진 사람 영상을 찍어 올린다'], a: 0, why: '목숨이 걸린 일이 먼저입니다. 사람이 쓰러졌다면 K-Clean을 기다리지 말고 먼저 119에 전화하세요.' },
    { k: 'pick', name: '좋은 한 줄', q: '환경 비서에게 말하는 신고 문장으로 가장 알맞은 것은?', opts: ['“한림읍 해변에 그물과 스티로폼이 밀려와 쌓이고 있어요. 어제부터 계속이에요.”', '“쓰레기 있어요.”', '“빨리 와 주세요!!!”'], a: 0, why: '장소·무엇이·어떤 상황인지를 한 줄로, 상황 설명을 덧붙이면 맡을 곳으로 이어 주기 쉽습니다. 실제로 보내면 접수되니 연습에서는 멈추세요.' }
  ] });


/* ══ 시나리오: 중급 24~39장(증권 이전) ═══════════════════════════════ */
S('ch10', { n: 24, short: '나비웹이 만들어진 이유', page: ['home', 'why'], focus: '시뮬레이션이 맡는 것: 이 장의 말이 “이미 이루어진 일”인지 “목표·전망”인지 “남은 숙제”인지 가려 읽는 연습을 합니다. 개념 장이라 연습 예제 대신 이 분류가 실습입니다.',
  say: ['이 계약서에서 나한테 불리한 조항이 있는지 봐 줘.', '전세 계약하기 전에 꼭 확인할 것을 알려 줘.', '이 결정에 반대하는 의견도 말해 줘.'],
  steps: [
    { k: 'sort', name: '전망 · 숙제 · 원칙', q: '이 문장은 어디에 속할까요?', buckets: ['목표·전망', '새 숙제', '원칙'], items: [['중요한 결정 전에 각자의 나비 의견을 먼저 듣는 일이 자연스러워질 것이다', 0], ['알고 있는 정도의 차이를 이용한 속임수와 부당한 이득이 줄어들 것이다', 0], ['AI에 지나치게 기대어 스스로 판단하는 힘이 약해질 수 있다', 1], ['나비를 쓰는 사람과 못 쓰는 사람 사이에 새로운 차이가 생길 수 있다', 1], ['나비의 의견은 참고이고 최종 판단은 언제나 나 자신이 한다', 2]], why: '이 장의 효과는 목표와 전망이지 이미 이루어진 결과가 아닙니다. 새 숙제는 나비웹이 지금 다 풀 수 있는 것이 아니며, 나비도 틀릴 수 있어서 최종 판단은 내가 합니다.' },
    { k: 'pick', name: '나비가 이렇게 말했다면', q: '나비가 “이 계약서는 별문제 없어 보여요”라고 답했습니다. 서명해도 될까요?', opts: ['참고로 삼고, 중요한 부분은 직접 확인한다(나비도 틀릴 수 있다)', '나비가 말했으니 바로 서명한다', '나비의 말은 무시한다'], a: 0, why: '나비의 의견은 참고이고 최종 판단은 언제나 나 자신이 합니다.' },
    { k: 'pick', name: '이런 때 물어보기', q: '상대가 나보다 더 많이 아는 일에서 나비를 가장 알맞게 쓰는 것은?', opts: ['“전세 계약하기 전에 꼭 확인할 것을 알려 줘.”', '“알아서 계약해 줘.”', '질문하지 않고 상대 설명만 듣는다'], a: 0, why: '계약·구매·진료 설명처럼 상대가 더 많이 아는 일에서 “잘 몰라서” 불리해지는 경우를 줄이려는 것이 나비웹의 방향입니다.' }
  ] });

S('ch11', { n: 25, short: '쓸수록 똑똑해지는 비서', page: ['home', 'learnai'], focus: '시뮬레이션이 맡는 것: “똑똑해진다 = 내 노트(PDV)가 두꺼워진다”를 같은 부탁에 대한 답이 달라지는 모습으로 확인합니다. 아래 장면은 방향을 보여 주는 예시입니다.',
  say: ['다음 주에 서울 출장 가야 해.', '임대차 계약서 또 써야 해.', '이 내용 메모해 줘.'],
  steps: [
    { k: 'live', name: '노트가 두꺼워지면', live: function (box, c) {
      var lv = [['처음 쓴 날 (기록 0건)', '“다음 주에 서울 출장 가야 해.” → “언제, 어디서 출발하시나요? 교통편 선호가 있으세요?” (아직 기록이 없어 물어봅니다)'], ['몇 달 뒤 (출장 기록이 쌓임)', '“다음 주에 서울 출장 가야 해.” → “지난번처럼 오전 비행기로 알아볼까요? 출장비 정산 서류도 같이 준비해 둘게요.” (지난 기록을 참고합니다)'], ['몇 달 뒤 (내 정보가 PDV에 있음)', '“임대차 계약서 또 써야 해.” → “이전에 입력하신 주소와 연락처를 먼저 채워 둘게요. 확인만 해 주세요.” (내 정보를 꺼내 씁니다)']], seen = {}, out = c.h('div', { class: 'fb nt', id: 'hw-live' });
      box.appendChild(c.h('div', { class: 'q', text: '아래 세 시점을 모두 눌러 같은 부탁에 대한 답이 어떻게 달라지는지 보세요.' })); var row = c.h('div', { class: 'opts' });
      lv.forEach(function (x, k) { row.appendChild(c.h('button', { type: 'button', text: x[0], onclick: function () { seen[k] = 1; out.textContent = x[1]; if (Object.keys(seen).length === 3) c.done('나비의 실력(AI)은 그대로이고 달라지는 것은 펼쳐 볼 수 있는 내 노트(PDV)입니다. “몇 달 뒤” 장면은 앞으로 넓혀 가는 방향을 보여 주는 예시예요.'); } })); });
      box.appendChild(row); box.appendChild(out); } },
    { k: 'order', name: '대화 한 번에', q: '내가 말을 걸면 눈에 보이지 않는 곳에서 일어나는 순서대로 눌러 보세요.', items: ['말하기 — 평소 쓰는 말 그대로 부탁한다', '찾기 — 내 금고에서 지금 부탁과 관련 있는 기록을 찾는다', '답하기 — 찾은 기록을 참고해 나에게 맞게 답한다', '기록하기 — 오늘 한 일이 내 금고에 한 줄 더해진다'], why: '기록한 한 줄이 다음 대화의 “찾기”에서 다시 쓰입니다. 대부분은 자동으로 쌓이고, 남기고 싶은 것은 “메모해 줘”라고 말하면 됩니다.' },
    { k: 'pick', name: '무엇이 달라지나', q: '“쓸수록 똑똑해진다”는 말은 무슨 뜻일까요?', opts: ['나비의 머리(AI)가 바뀌는 것이 아니라 참고할 내 기록(노트)이 늘어나는 것', '나비가 혼자 공부해서 AI 모델이 바뀌는 것', '다른 사람의 기록까지 함께 읽는 것'], a: 0, why: '시험을 볼 때 실력이 같아도 정리된 공책을 펼쳐 놓으면 더 정확하게 답하는 것과 같아요. 기록은 나만 열 수 있습니다.' }
  ] });

S('ch12', { n: 26, short: 'PDV 기록', page: ['pdv', 'vault'], focus: '시뮬레이션이 맡는 것: 내 기기에 원문, 네트워크에 지문이 남는 구조를 가상 기록에서 변조해 보며 확인합니다. 실제 PDV는 연습 예제에서 조회만 합니다.',
  say: ['내 PDV에 어떤 기록이 있어?', '내 이름과 연락처는 어디에 저장돼 있어?', '최근에 저장한 서류가 뭐야?'],
  steps: [
    { k: 'sort', name: '어디에 남나', q: '이 기록은 어디에 남을까요?', buckets: ['내 기기(원문)', '네트워크(지문만)'], items: [['서류 원문(작성한 서류)', 0], ['이름·주소·연락처 같은 내 정보', 0], ['그 서류가 그때 그대로임을 확인하는 지문', 1], ['거래 기록의 지문', 1]], why: '업무 기록은 본인 기기에 저장되고 네트워크에는 지문만 남습니다. 그래서 내용을 바꾸면 지문이 맞지 않아 알 수 있어요.' },
    { k: 'chain', name: '몰래 고쳐 보기', gen: function (r) { var docs = ['결석계 작성', '정보 공개 청구서 저장', '메일 초안 저장', '내 정보(주소) 수정', '양식 업로드']; return { q: '가상의 PDV 기록입니다. 줄을 몰래 고치면 어떻게 될까요?', rows: shuf(docs, r).slice(0, 4).map(function (x, k) { return '2026-11-' + (10 + k * 3) + ' ' + x; }), why: '기록은 앞 기록의 지문에 이어 붙기 때문에, 한 줄을 고치면 그 줄부터 지문이 어긋납니다. (이 시뮬레이션의 단순한 연결 방식에서는 맨 끝 줄을 통째로 지우는 것은 지문만으로는 드러나지 않아, 네트워크에 남은 지문과 맞춰 보는 단계가 따로 필요해요.)' }; } },
    { k: 'pick', name: '비서가 아는 것', q: '“내 PDV에 어떤 기록이 있어?”라고 물으면 비서는 무엇을 바탕으로 답하나요?', opts: ['이 기기의 내 기록(PDV)', '모든 사용자의 기록', '인터넷 검색 결과만'], a: 0, why: '비서는 내 금고의 기록을 바탕으로 답합니다. 기록은 나만 열 수 있어요.' }
  ] });

S('ch13', { n: 27, short: '출생부터 평생, 기록의 가치', page: ['pdv', 'life'], focus: '시뮬레이션이 맡는 것: 이 장의 추정 방식(가정을 밝히고 곱하기)을 내 숫자로 계산해 보고, “증명할 수 있는 것”과 “없는 것”을 가립니다. 효과는 측정값이 아니라 추정이에요.',
  say: ['이사했으니 전입 관련 서류를 다 정리해 줘.', '지난달 서류 작업만 보여 줘.', '내 기록 중 증명해 보낼 부분만 골라 줘.'],
  steps: [
    { k: 'calc', name: '시간 절감 어림하기', gen: function (r) { var n = ri(r, 6, 14), m = [20, 30, 40][ri(r, 0, 2)], pop = [5000, 10000, 20000][ri(r, 0, 2)], cut = [0.3, 0.5][ri(r, 0, 1)]; return { q: '한 사람이 1년에 서류를 ' + n + '번 내고 한 번에 ' + m + '분이 든다고 가정합니다. ' + won(pop) + '명이 사는 마을에서 기록으로 ' + Math.round(cut * 100) + '%가 줄어든다면 1년에 줄어드는 시간은 몇 시간일까요?', facts: '추정 방식: 비용을 알고 → 기록이 줄이는 몫을 곱하고 → 규모를 곱합니다(가정값).', a: Math.round(n * m / 60 * pop * cut), tol: 1, unit: '시간', why: '1인당 ' + n + '번 × ' + m + '분 ÷ 60 × ' + won(pop) + '명 × ' + Math.round(cut * 100) + '%. 실제 수치는 이와 다를 수 있으며, 추정은 가정을 밝히고 계산하는 방식으로 합니다.', hint: '(번수 × 분 ÷ 60) × 인구 × 줄어드는 비율.' }; } },
    { k: 'sort', name: '증명할 수 있나', q: '기록의 자기 증명으로 보일 수 있는 것은?', buckets: ['보일 수 있다', '보증하지 못한다'], items: [['이 기록은 그때 이후 바뀌지 않았다', 0], ['이 기록의 내용이 사실이다', 1], ['내가 보여 주기로 고른 범위만 상대에게 알린다', 0]], why: '기록의 진실성 입증은 “바뀌지 않았다”를 보이는 것이지 “내용이 사실이다”까지 보증하지는 않습니다.' },
    { k: 'pick', name: '24시간 기록 ≠ 감시', q: '“24시간 기록”이 감시가 되지 않으려면?', opts: ['기록은 본인만 열 수 있고, 기관은 내가 동의한 범위만 볼 수 있어야 한다', '기관이 모든 기록을 열람한다', '기록하지 않는다'], a: 0, why: '이 원칙이 무너지면 효용보다 위험이 커집니다. 동의와 권한은 「내 정보를 보겠다는 요청」장에서 다룹니다.' }
  ] });

S('ch14', { n: 28, short: 'GDC 충전하기와 쓰기', page: ['bank', 'wallet'], focus: '시뮬레이션이 맡는 것: 충전·결제·장부 반영의 숫자를 직접 계산해 “합이 0”임을 확인합니다. 실제 입금·결제는 하지 않으며, 1:1 비율은 테스트 기간 기준입니다.',
  say: ['내 GDC 잔액을 알려 줘.', '충전하려면 어떻게 해?', '입금했는데 충전이 안 됐어.'],
  steps: [
    { k: 'calc', name: '충전', gen: function (r) { var a = [10000, 30000, 50000, 120000][ri(r, 0, 3)]; return { q: '가입한 이름과 같은 입금자명으로 ' + won(a) + '원을 입금했습니다. 충전이 끝나면 GDC는 얼마가 들어올까요? (테스트 기간 기준 1:1)', a: a, unit: 'GDC', why: '입금액과 1:1 비율로 GDC가 지갑에 들어옵니다(예: 1,000원 = 1,000 GDC, 테스트 기간 기준이며 바뀔 수 있어요).', hint: '입금액과 1:1입니다.' }; } },
    { k: 'live', name: '거래 하나, 장부 두 개', live: function (box, c) {
      var p = c.ri(c.rng, 5, 30) * 1000, bc = 100000, sc = 100000, opt = [p, p / 2, 0, p * 2], ord = c.shuf([0, 1, 2, 3], c.rng); var ans = '';
      box.appendChild(c.h('div', { class: 'q', text: '구매자의 현금 ' + c.won(bc) + ' GDC, 판매자의 현금 ' + c.won(sc) + ' GDC입니다. ' + c.won(p) + ' GDC짜리 거래가 확정되면 판매자의 현금은 얼마가 되고, 두 사람의 현금 변동을 더하면 얼마일까요?' }));
      var inp = c.h('input', { type: 'text', id: 'hw-ans', placeholder: '판매자 현금(숫자)' }), inp2 = c.h('input', { type: 'text', id: 'hw-ans2', placeholder: '변동의 합(숫자)' }), fb = c.h('div', { class: 'fb nt', id: 'hw-fb' });
      box.appendChild(c.h('div', { class: 'row' }, [inp, inp2, c.h('button', { type: 'button', class: 'pri', id: 'hw-go', text: '확인', onclick: function () { var a = Number(String(inp.value).replace(/,/g, '')), b = Number(String(inp2.value).replace(/,/g, '')); if (a === sc + p && inp2.value !== '' && b === 0) { fb.className = 'fb ok'; fb.textContent = '맞아요.'; c.done('구매자 현금 −' + c.won(p) + '(산 물건 +' + c.won(p) + '), 판매자 현금 +' + c.won(p) + '(매출 +' + c.won(p) + '). 현금 변동의 합은 0이라 돈이 사라지거나 생기지 않습니다. 각자는 자기 몫만 자기 장부에 반영해요.'); } else { fb.className = 'fb no'; fb.textContent = '다시 계산해 보세요. 사는 사람은 현금이 줄고 파는 사람은 늘어요. 합은 얼마일까요?'; } } })]));
      box.appendChild(fb); } },
    { k: 'pick', name: '결제 규칙', v: [
      { q: '5,000 GDC짜리 결제를 하려 합니다(기본 설정). 지문 확인이 필요할까요?', opts: ['필요 없다 — 일정 금액(기본 1만 원) 미만은 지문 없이 바로 결제된다', '항상 필요하다', '카드 번호가 필요하다'], a: 0, why: '그 이상만 지문(또는 Face ID)으로 한 번 더 확인합니다. 기준 금액은 설정에서 조정해요.' },
      { q: '입금자명을 가입한 이름과 다르게 적었습니다. 어떻게 될까요?', opts: ['서버가 이름으로 내 계정을 찾지 못해 자동 충전이 안 될 수 있다', '다 자동으로 처리된다', '입금이 취소된다'], a: 0, why: '입금자명(보내는 분)은 나비웹에 가입한 이름과 같게 합니다. 띄어쓰기는 달라도 돼요. 같은 이름의 가입자가 둘 이상이면 관리자가 확인합니다.' },
      { q: 'GDC 잔액이 1,000 GDC 이하가 되면 어떻게 되나요?', opts: ['충전을 권하는 알림이 온다', '모든 서비스가 멈춘다', '자동으로 카드 결제된다'], a: 0, why: '카드 자동결제 같은 정기결제는 없습니다. 월 기본료도 없고 쓴 만큼만 차감돼요.' }] }
  ] });

S('ch16', { n: 29, short: '전문가 페르소나 호출하기', page: ['home', 'expert'], focus: '시뮬레이션이 맡는 것: 상황을 보고 어떤 직역 전문가를 불러야 하는지 가려 보는 연습을 반복합니다. 전문가의 답은 참고용이에요.',
  say: ['종합소득세 신고는 어떻게 하나요?', '특허를 내고 싶어요.', '우리 강아지가 밥을 안 먹어요.'],
  steps: [
    { k: 'sort', name: '누구를 부를까', q: '이 상황에는 어떤 전문가가 어울릴까요?', buckets: ['세무·회계', '특허·지식재산', '법률', '동물·수의'], items: [['종합소득세 신고는 어떻게 하나요?', 0], ['내 아이디어로 특허를 내고 싶어요.', 1], ['임대 계약 문제로 다툼이 생겼어요.', 2], ['우리 강아지가 밥을 안 먹어요.', 3]], why: '입력창 왼쪽 예시 버튼 → 전문직 AI ▾를 열고 검색창에 분야를 적어 직역을 고릅니다. 세부 분야를 고른 뒤 질문하세요.' },
    { k: 'pick', name: '답을 읽을 때', q: '전문가 AI의 답을 어떻게 받아들여야 할까요?', opts: ['참고용 의견으로 보고, 중요한 결정은 직접 확인한다', '자격 있는 전문가의 공식 판단이다', '법적 효력이 있다'], a: 0, why: '전문가 이름표가 바뀌고 답에 참고용 안내가 붙습니다. 허가·진단·법률 자문을 대신하지 않아요.' },
    { k: 'pick', name: '돌아오기', q: '전문가와의 대화를 끝내고 내 비서로 돌아오려면?', opts: ['칩의 ×를 누른다', '새로고침한다', '전문가를 삭제한다'], a: 0, why: '칩의 ×를 누르면 나만의 AI 비서로 돌아옵니다.' }
  ] });

S('ch_doc_write', { n: 30, short: '서류 작성 전 과정', page: ['docs', 'write'], focus: '시뮬레이션이 맡는 것: 저장까지의 순서와 “작성 시점에 어긋남을 찾아 고치기”를 가상 서류로 반복합니다(예방 점검). 실제 서류는 연습 예제에서 결석계 한 장을 저장까지만 합니다.',
  say: ['빈 칸을 채워 줘.', '결석 기간을 3일로 고쳐 줘.', '문장을 더 공손하게 바꿔 줘.'],
  steps: [
    { k: 'order', name: '저장까지', q: '서류를 시작해 저장하는 순서대로 눌러 보세요.', items: ['PDV에 이름·연락처가 들어 있는지 확인한다(주민등록번호는 넣지 않는다)', '왼쪽 메뉴 서류 → 서류 종류 ▾에서 분야를 고르고 서류(예: 결석계)를 고른다', '서류 작성 비서가 묻는 것에 하나씩 답한다(모르는 칸은 가상의 값)', '“빈 칸을 채워 줘”라고 말해 PDV 정보로 채워지는 칸을 본다', '내용을 읽고 어색한 곳은 말로 고친다', '작성 완료로 저장한다', '서류 → 작성한 서류에서 방금 만든 서류를 확인한다'], why: '제출은 하지 않고 저장까지만 하는 연습입니다. 기관 서류 발급은 도우미가 하며 로그인·결제는 내가 합니다.' },
    { k: 'pick', name: '어긋남 찾기', v: [
      { q: '가상 결석계: “결석 기간 3일, 시작 11월 3일, 종료 11월 8일”. 무엇을 고쳐야 할까요?', opts: ['기간(3일)과 시작·종료일이 맞지 않는다 — 말로 “결석 기간을 맞춰 줘”라고 고친다', '아무 문제 없다', '제목을 고친다'], a: 0, why: '저장 전에 내용을 읽어 어색하거나 어긋난 곳을 말로 고치는 단계가 있습니다.' },
      { q: '가상 청구서에 [청구인 이름] [연락처] 같은 [대괄호] 칸이 비어 있습니다. 어떻게 할까요?', opts: ['내가 직접 적는다 — 이름·주소·연락처는 대화에 말하지 않고 칸에 적는다', 'AI가 지어내도록 둔다', '그대로 제출한다'], a: 0, why: '[대괄호]는 내가 적는 칸입니다. AI는 지어내지 않고 내가 말한 만큼만 적어요.' }] },
    { k: 'pick', name: '제출 단계', q: '저장을 마친 서류를 기관에 내려 합니다.', opts: ['제출은 나비웹이 대신 접수하지 않고 단계별로 안내한다. 로그인·결제는 내가 한다', '저장하면 자동으로 접수된다', '메일에 첨부하면 접수된다'], a: 0, why: '서류 화면의 전달(메일에 첨부)과 제출은 다릅니다. 실제로 내지 않는 연습이라면 제출·전송 단계에서 멈추세요.' }
  ] });

S('ch_myforms', { n: 31, short: '내 양식으로 쓰기', page: ['myforms', 'forms'], focus: '시뮬레이션이 맡는 것: 양식을 만들고 고치는 순서와 한도를 가상 양식으로 반복합니다. 실제로는 연습 예제에서 템플릿 하나를 저장했다가 지웁니다.',
  say: ['엘리베이터 칸을 추가해 줘(선택: 양호/불량).', '사유는 질병/가정 사정/기타 중에서 고르게 해 줘.', '보호자 연락처 칸을 더 크게.'],
  steps: [
    { k: 'order', name: '양식 만들기', q: '템플릿으로 양식을 만들어 저장하는 순서대로 눌러 보세요.', items: ['서류 → 내 서류함 → ＋ 새 양식 만들기를 누른다', '“템플릿으로 바로 시작”에서 템플릿(예: 시설 점검표)을 고른다', '대화창에 말해서 칸을 고친다(예: “조치 계획 칸을 더 크게”)', '맨 위 이름을 바꾸고 저장한다(잘못 고쳤다면 되돌리기)', '내가 만든 양식에서 “열기”로 서류 작성 화면에 열리는지 본다'], why: '템플릿으로 시작하면 칸이 한 번에 채워지고, 말로 고칠 수 있습니다.' },
    { k: 'pick', name: '한도와 정리', v: [
      { q: '한 양식에 넣을 수 있는 한도는?', opts: ['묶음 8개, 항목 60개', '묶음 3개, 항목 10개', '제한 없음'], a: 0, why: '더 자세한 한도는 「내 양식 만들기」장에 있습니다.' },
      { q: '“열기”로 연 서류는 Draft에도 초안으로 자동 저장됩니다. 연습이 끝나면?', opts: ['Draft 탭에서도 삭제해 둔다', '그대로 둔다', '내 서류함만 지운다'], a: 0, why: '연습한 양식은 목록의 삭제로 지우고(“내 서류함에서 지울까요?” 확인), Draft 탭에서도 삭제해 두세요.' }] },
    { k: 'pick', name: '말로 고치기', q: '결석 사유서 양식에서 “결석 기간”을 시작일과 종료일 두 칸으로 나누려면?', opts: ['대화창에 “결석 기간은 시작일과 종료일로 나눠 줘”라고 말한다', '양식을 지우고 새로 만든다', '서류 작성 화면에서 고친다'], a: 0, why: '양식도 말로 고칩니다. “사유는 질병/가정 사정/기타 중에서 고르게 해 줘”처럼 선택지도 말로 정해요.' }
  ] });

S('ch_othersite', { n: 32, short: '다른 사이트에 옮겨 적기', page: ['othersite', 'steps'], focus: '시뮬레이션이 맡는 것: “읽은 글 확인”에서 틀린 곳을 찾는 연습과 도우미가 어디서 멈추는지 판단을 반복합니다. 실제로는 연습 예제에서 영수증 한 장으로 제출 없이 해 봅니다.',
  say: ['이 영수증을 메일 본문에 옮겨 적어 줘.', '읽은 글에서 금액을 고쳐 줘.', '보내기는 내가 누를게.'],
  steps: [
    { k: 'order', name: '옮겨 적는 순서', q: '영수증 한 장을 다른 사이트의 입력 칸에 옮겨 적는 순서대로 눌러 보세요.', items: ['연습용 사이트(예: 메일의 새 편지 쓰기 화면)를 열고 로그인한다', '나비웹에서 서류 → 다른 사이트 입력을 열어 도우미가 “연결됨”인지 본다', '📱 폰으로 촬영을 누르고 폰 알림을 눌러 영수증을 찍는다', '읽은 글을 확인하고 가게 이름·날짜·금액이 맞는지 고친다', '“이 내용으로 입력 맡기기”를 누른다', '입력된 것을 확인하되 보내기·제출은 누르지 않고 끝낸다'], why: '로그인과 마지막 제출은 항상 내가 합니다. 연습은 중요한 서류로 하지 마세요.' },
    { k: 'pick', name: '읽은 글 고치기', gen: function (r) { var shop = ['한라식당', '바당마트', '오름문구'][ri(r, 0, 2)], amt = ri(r, 8, 40) * 1000 + 500, bad = amt - 5000; return { q: '영수증 원본: ' + shop + ' / 금액 ' + won(amt) + '원. 도우미가 읽은 글: ' + shop + ' / 금액 ' + won(bad) + '원. 입력 맡기기 전에 무엇을 하나요?', opts: ['읽은 글의 금액을 ' + won(amt) + '원으로 고친다', '그대로 입력 맡긴다', '가게 이름을 고친다'], a: 0, why: '읽은 글은 틀릴 수 있어요. 입력을 맡기기 전에 가게 이름·날짜·금액이 맞는지 직접 확인해 고칩니다.' }; } },
    { k: 'pick', name: '도우미가 멈추는 곳', q: '도우미가 사이트의 입력 칸에 내용을 적고 나면 어디에서 멈춰야 할까요?', opts: ['보내기·제출 단추 앞(내가 확인하고 누른다)', '자동으로 제출한 뒤', '로그인 후 바로'], a: 0, why: '제출은 내 확인 없이 누르지 않는 것이 도우미의 규칙입니다. 연습에서는 적힌 내용을 지우고 📱 폰 촬영 끝내기로 연결을 끝내세요.' }
  ] });

S('ch_foi', { n: 33, short: '정보 공개 청구와 행정 심판', page: ['pub', 'request'], focus: '시뮬레이션이 맡는 것: 청구 전 확인과 범위 좁히기, 제출 앞에서 멈추는 단계를 가상 청구로 반복합니다. 법정 기한 등은 이 장이 확인하지 못한 값이 있어 예시로만 다룹니다.',
  say: ['제주도청 업무 수행 지침이 이미 공개돼 있는지 알려 줘.', '기획 부서와 관광 담당 부서 두 곳으로 범위를 좁혀 줘.', '청구서를 한 번 더 읽어 보고 모호한 표현을 알려 줘.'],
  steps: [
    { k: 'order', name: '청구 흐름', q: '정보 공개 청구서를 만들고 청구하는 순서대로 눌러 보세요.', items: ['먼저 이미 공개된 정보인지 확인한다(누리집의 정보공개 코너)', '공개돼 있지 않다면 서류 → 정보 공개 청구를 골라 청구서 대화를 시작한다', '범위를 좁혀 말한다(부서 두 곳, 최신 시행본, 전자파일)', '청구서의 [대괄호] 칸(이름·주소·연락처·청구 일자)을 내가 채우고 모호한 표현을 점검한다', 'PDF 또는 Word로 저장한다', '도우미가 포털(open.go.kr)에서 칸을 옮기고, 로그인과 마지막 “제출할까요?” 확인은 내가 한다'], why: '청구서를 만드는 일은 나비가, 포털 칸 옮기기는 도우미가, 인증·확인·제출 클릭은 내가 합니다.' },
    { k: 'pick', name: '좋은 청구 범위', q: '청구 내용을 어떻게 쓰는 것이 좋을까요?', opts: ['“기획 부서와 관광 담당 부서의 최신 시행본을 전자파일로”처럼 구체적으로', '“모든 지침을 다 주세요”', '“알아서 찾아 주세요”'], a: 0, why: '“모든 지침”처럼 넓게 말하면 결정이 늦어지거나 보완을 요구받을 수 있어요. 문서 이름·기간·범위를 좁혀 말하세요.' },
    { k: 'pick', name: '적지 말 것', q: '청구서나 대화에 적어도 되는 것은?', opts: ['청구 내용(문서 이름·기간·범위)', '내 주민등록번호', '남의 개인정보·비밀'], a: 0, why: '이름·주소·연락처는 대화에 말하지 않고 [대괄호] 칸에 직접 적으며, 번호류는 포털 화면에서 내가 직접 적습니다. 이미 공개된 정보나 남의 개인정보는 청구서에 적지 않아요.' }
  ] });

S('ch_expertdoc', { n: 34, short: '전문가 인증과 서류 작성', page: ['med', 'submit'], focus: '시뮬레이션이 맡는 것: “누가 정하고 AI는 무엇을 돕는가”의 경계를 가려 봅니다. 모든 수치·이름은 가상이며 의료 판단이 아닙니다.',
  say: ['내 처방전을 만들어 줘.', '연습용 가상 환자입니다. 오늘 직접 진찰했다고 가정할게요.', '진단 후보를 정리해 줘.'],
  steps: [
    { k: 'sort', name: '누가 하나', q: '처방전 서류 작성에서 누구의 몫일까요?', buckets: ['의사가 정한다', 'AI가 돕는다'], items: [['진단과 처방의 내용', 0], ['진단 후보를 정리해 보여 주는 초안', 1], ['서류 칸 채우기와 문장 다듬기', 1], ['처방을 최종 확정하는 판단', 0]], why: '이 사이트의 방법론은 “진단과 처방은 의사가 정한다”는 취지입니다. 연습의 수치와 이름은 모두 지어낸 값이며 실제 진료에 쓰지 않아요.' },
    { k: 'pick', name: '인증 없이 요청', q: '면허 인증을 하지 않은 상태에서 “내 처방전을 만들어 줘”라고 보냈습니다. 정상적인 반응은?', opts: ['면허 인증을 받은 의사만 쓸 수 있다는 안내를 하고 서류를 만들지 않는다', '바로 처방전을 만들어 준다', '인증 신청서를 대신 제출한다'], a: 0, why: '일반 건강 상담이 필요하면 건강 상담 서비스로 가라는 안내도 함께 나옵니다. 인증 신청 창이 열려도 연습이라면 신청하지 말고 닫으세요.' },
    { k: 'pick', name: '가상 환자 연습', q: '가상 환자 연습을 하려는 의사가 먼저 해야 할 말은?', opts: ['“연습용 가상 환자입니다.”라고 밝히고 가정한 상황을 말한다', '실제 환자의 이름과 수치를 그대로 넣는다', '아무 말 없이 서류를 요청한다'], a: 0, why: '가상 환자 연습은 인증을 마친 의사 전용이며, 입력하는 수치와 이름은 지어낸 값이어야 합니다.' }
  ] });

S('ch_learning', { n: 35, short: '학습 AI', page: ['learn', 'subjects'], focus: '시뮬레이션이 맡는 것: 학습 보고서의 종합 점수 계산과 학습 원장의 변조 탐지를 가상 학습자로 반복합니다. 실제 수업은 연습 예제에서 경제학 입문 하나로 해 봅니다.',
  say: ['핵심 개념을 쉽게 설명해 줘.', '연습 문제를 내 줘.', '내 학습 기록 보여 줘.'],
  steps: [
    { k: 'calc', name: '종합 점수', gen: function (r) { var a = ri(r, 60, 95), f = ri(r, 40, 100), m = ri(r, 50, 100); return { q: '성취도(평균) ' + a + '점, 처음 통과 비율 ' + f + '점, 숙달 비중 ' + m + '점일 때 종합 점수는?', facts: '종합 점수 = 성취도 60% + 처음 통과 25% + 숙달 비중 15% (소수점은 반올림)', a: Math.round(a * 0.6 + f * 0.25 + m * 0.15), tol: 1, unit: '점', why: a + '×0.6 + ' + f + '×0.25 + ' + m + '×0.15 입니다. 기록이 없는 항목은 수치를 지어내지 않고 “자료 부족”으로 둡니다.', hint: '각 점수에 비율을 곱해 더해 보세요.' }; } },
    { k: 'chain', name: '학습 원장 변조', gen: function (r) { return { q: '가상 학습자의 확인 문제 기록입니다. 중간 기록을 고치면 어떻게 될까요?', rows: shuf(['1주차 확인 문제 70%', '2주차 확인 문제 85%', '3주차 확인 문제 60%', '4주차 확인 문제 90%'], r).map(function (x) { return x; }), why: '확인 문제 기록은 이 기기에서 해시 체인으로 묶여, 중간 기록을 고치면 드러납니다(학습 원장 줄에 “변조 없음”으로 표시).' }; } },
    { k: 'pick', name: '통과 기준', q: '확인 문제를 제출하고 채점했더니 결과는 통과가 아닙니다. 기준과 다음 행동은?', opts: ['80% 이상이 통과. 못 미치면 풀이를 보고 “다시 풀기”로 도전한다', '60% 이상이 통과. 바로 다음 주차로 간다', '통과하지 못하면 과목을 삭제한다'], a: 0, why: '교수는 정답을 미리 알려 주지 않고 풀이 방향을 짚어 줍니다.' }
  ] });

S('ch_infra_market', { n: 36, short: '시장 AI', page: ['market', 's0'], focus: '시뮬레이션이 맡는 것: 구매 검토의 순서와 “멈춰야 할 때”를 가상 구매로 반복하고, 가격을 비교해 봅니다. 실제 돈은 움직이지 않는 체험 화면과 짝으로 쓰세요.',
  say: ['무선 청소기 찾아 줘.', '이거 사도 될지 검토해 줘.', '다른 판매처 가격도 비교해 줘.'],
  steps: [
    { k: 'order', name: '구매 검토 순서', q: '시장 AI가 구매를 검토하는 순서대로 눌러 보세요.', items: ['상품 이름과 가격 입력(링크가 있으면 도우미로 읽어 오기)', '구매 이력 조회 — 내 구매 기록에서 비슷한 물건 찾기', '필요도 검토(1~5점)', '구매 의사 확인 — 계속 진행할지 묻는 창', '판매자 신뢰도·소비자 의견·AS 평가', '다른 판매처와 가격 비교', '판매자의 나비와 조건 협의', '최종 구매 의사 확인 후 승인·결제', '국세청 보고와 장부 기록'], why: '화면은 한 페이지이고 단계는 저절로 이어지며, 내가 정해야 할 때만 확인 창이 떠요.' },
    { k: 'pick', name: '멈춰야 할 때', v: [
      { q: '“무선청소기 A100”을 이미 산 기록이 있는데 “무선청소기 A200”을 검토합니다. 어떻게 되나요?', opts: ['“비슷한 구매 기록이 있어요” 창이 뜨며 멈춘다. 그래도 사려면 구매 원함을 누른다', '바로 결제된다', '기록을 무시하고 계속한다'], a: 0, why: '이미 산 물건과 비슷하면 멈추고 확인 창이 뜹니다.' },
      { q: '최종 구매 의사에서 승인을 눌렀는데 “잔고가 모자라요”가 떴습니다. 지금 기록은?', opts: ['아직 아무것도 기록되지 않았다. 입금 후 결제를 고른다', '이미 결제된 것으로 기록됐다', '재고가 줄었다'], a: 0, why: '체험용 입금 후 결제를 고르면 일련번호(MK-…)가 붙은 거래 전표와 국세청 보고가 이어집니다.' }] },
    { k: 'calc', name: '가격 비교', gen: function (r) { var base = ri(r, 15, 25) * 10000, o = [base, base + ri(r, 1, 6) * 1000, base - ri(r, 2, 9) * 1000]; return { q: '같은 상품이 이 사이트에서 ' + won(o[0]) + '원, 다른 판매처에서 ' + won(o[1]) + '원, ' + won(o[2]) + '원입니다. 가장 싼 곳은 이 사이트보다 몇 원 싼가요?', a: o[0] - o[2], unit: '원', why: '최저가와의 차이를 보고, 가격만이 아니라 판매자 신뢰도·AS도 함께 봅니다.', hint: '이 사이트 가격 − 가장 싼 가격.' }; } }
  ] });

S('ch_infra_tax', { n: 37, short: '세무 회계 AI', page: ['tax', 'slip'], focus: '시뮬레이션이 맡는 것: 전표 한 장이 세액 결정과 장부로 이어지는 계산과 순서를 반복하고, 장부를 몰래 고치면 드러나는 이유를 확인합니다. 신고·납부는 일어나지 않아요.',
  say: ['거래 전표를 받아 줘.', '이 전표의 세액을 알려 줘.', '재무제표가 어떻게 바뀌었는지 보여 줘.'],
  steps: [
    { k: 'calc', name: '세액 계산', gen: function (r) { var q = ri(r, 1, 5), p = ri(r, 4, 20) * 5000, s = q * p; return { q: '무선 청소기 ' + q + '개 × ' + won(p) + '원 = 공급가액 ' + won(s) + '원입니다. 이 체험에서 국세청 AI가 정하는 세액과 합계(공급가액 + 세액)를 구하세요. 합계는 얼마인가요?', facts: '이 체험에서는 물건값(공급가액)의 10%가 세액입니다.', a: s * 1.1, tol: 1, unit: '원', why: '세액은 ' + won(s * 0.1) + '원, 합계는 ' + won(s * 1.1) + '원입니다.', hint: '공급가액 × 1.1.' }; } },
    { k: 'order', name: '전표가 가는 길', q: '전표가 가는 순서대로 눌러 보세요.', items: ['판매자와 구매자의 시장 SP가 각자 서명한 거래 전표를 만든다', '시장 인프라 AI가 일련번호와 서명을 붙여 국세청 AI에게 전달한다', '국세청 AI가 서명을 확인하고 세법을 참고해 세액을 정해 전표에 붙여 돌려준다', '인프라 AI가 세액과 국세청 서명이 붙은 전표를 구매자·판매자에게 보내 서명을 확인하게 한다', '각자의 재무제표 SP가 재산 표와 손익 표를 고치고 날짜·시각과 일련번호를 적는다', '갱신 이력이 한 줄 남고, 일련번호로 진짜임을 다시 확인할 수 있다'], why: '일련번호를 따라가 전표·서명·금액을 다시 확인할 수 있어서, 숫자를 몰래 고치면 이력과 맞지 않아 드러납니다.' },
    { k: 'chain', name: '장부 몰래 고치기', gen: function (r) { return { q: '가상 장부의 갱신 이력입니다. 한 줄을 몰래 고치면?', rows: ['MK-' + ri(r, 1000, 1999) + ' 상품 +180,000', 'MK-' + ri(r, 2000, 2999) + ' 부가세대급금 +18,000', 'MK-' + ri(r, 3000, 3999) + ' GDC 잔액 −198,000'], why: '장부가 바뀔 때마다 언제·무엇이·왜·얼마가 바뀌었는지 한 줄씩 이력이 남아, 슬쩍 꾸미기 어렵습니다.' }; } }
  ] });

S('ch_infra_bank', { n: 38, short: '은행 AI', page: ['bank', 'wallet'], focus: '시뮬레이션이 맡는 것: 구매 한 번에 두 장부가 어떻게 바뀌는지 직접 계산하고, 송금 확인 단계에서 돈이 움직이지 않는다는 점을 확인합니다. 은행 화면 자체의 모의와 짝으로 쓰세요.',
  say: ['내 지갑 잔액을 보여 줘.', '이번 달 지출을 분야별로 알려 줘.', '내 신용 등급이 어떻게 정해지는지 알려 줘.'],
  steps: [
    { k: 'calc', name: '구매 후 잔액', gen: function (r) { var c = ri(r, 10, 40) * 10000, p = ri(r, 1, 9) * 5000; return { q: '구매자 현금이 ' + won(c) + '원, 상품이 50,000원입니다. ' + won(p) + '원짜리 구매가 끝나면 구매자의 현금은 얼마일까요?', a: c - p, unit: '원', why: '현금은 ' + won(p) + '원 줄고, 상품은 ' + won(p) + '원 늘어 ' + won(50000 + p) + '원이 됩니다. 판매자 쪽은 현금과 이익이 늘어, 두 장부가 함께 바뀝니다.', hint: '현금에서 물건값을 뺍니다.' }; } },
    { k: 'pick', name: '내용 확인하기', q: '송금·결제에서 나비 코드와 금액을 넣고 “내용 확인하기”를 눌렀습니다. 돈은 움직였나요?', opts: ['아니다 — 입력만 점검되고 돈은 움직이지 않는다', '그렇다 — 즉시 송금된다', '절반만 이체된다'], a: 0, why: '체험용이라 실제 돈이나 대출은 움직이지 않아요. 화면의 재무제표·거래·등급은 연습용 가상 값입니다.' },
    { k: 'pick', name: '탭 찾기', v: [
      { q: '30일 지출 합계와 가장 많이 쓴 분야를 보려면 어느 탭인가요?', opts: ['거래 내역', '예금·대출', '신용·채권'], a: 0, why: '은행 화면 위쪽에는 내 지갑 · 충전·입금 · 송금·결제 · 거래 내역 · 예금·대출 · 신용·채권 탭이 있어요.' },
      { q: '신용 등급이 정해지는 과정을 단계별로 따라가 보려면?', opts: ['신용·채권', '내 지갑', '충전·입금'], a: 0, why: '신용·채권 탭의 시뮬레이션에서 6단계를 따라갈 수 있어요.' }] }
  ] });

S('ch_infra_insurance', { n: 39, short: '보험 AI', page: ['insure', 'rate'], focus: '시뮬레이션이 맡는 것: 요율 원리의 계산을 직접 해 보고, 어떤 말이 설계이고 어떤 것이 실제인지 가려 봅니다. 화면의 계산은 모두 가정이며 실제 보험료가 아닙니다.',
  say: ['내가 가입한 보험을 정리해 줘.', '요율이 어떻게 정해지는지 알려 줘.', '이 상품에 제공할 데이터를 고르고 싶어.'],
  steps: [
    { k: 'calc', name: '요율 계산', gen: function (r) { var n = [1000, 2000, 5000, 10000][ri(r, 0, 3)], cl = n * [50000, 100000][ri(r, 0, 1)], risk = [0.8, 1, 1.2, 1.5][ri(r, 0, 3)]; return { q: '가입자 ' + won(n) + '명, 1년 예상 보험금 총액 ' + won(cl) + '원, 운영비율 5%입니다. 내 위험도(평균=1)가 ' + risk + '이면 내 보험료(1년)는 얼마일까요?', facts: '보험료 총액 = 보험금 총액 + 운영비(보험금의 5%), 가입자 평균 = 총액 ÷ 가입자 수, 내 보험료 = 평균 × 내 위험도', a: Math.round(cl * 1.05 / n * risk), tol: 1, unit: '원', why: '평균은 ' + won(cl * 1.05 / n) + '원이고 위험도 ' + risk + '를 곱합니다. 계산기는 내가 넣은 가정으로 계산할 뿐 실제 보험료가 아니에요.', hint: '(보험금 × 1.05 ÷ 가입자 수) × 위험도.' }; } },
    { k: 'sort', name: '설계 vs 실제', q: '이 문장은 지금 어디에 해당할까요?', buckets: ['설계 원칙', '지금 화면이 하는 것'], items: [['사용자는 보험 상품이 요구하는 특정 데이터만 제공한다', 0], ['보험사의 사람 직원은 개개인의 데이터를 볼 수 없다', 0], ['가입한 보험과 청구 기록을 직접 적어 이 브라우저에 저장한다', 1], ['요율 계산기가 내가 넣은 가정으로 계산해 보여 준다', 1]], why: '위 원칙은 아직 설계 단계예요. 지금은 보험 상품 판매·가입·청구 접수·데이터 제공이 연결되어 있지 않고, 이 화면은 어떤 데이터도 밖으로 보내지 않습니다.' },
    { k: 'pick', name: '공개할 데이터', q: '상품과 공개 데이터 탭에서 제공할 항목을 고를 때 맞는 것은?', opts: ['상품마다 필요한 데이터가 다르고, 제공할 항목만 체크한다(모두 해제도 가능)', '모든 데이터를 반드시 제공해야 한다', '사람 직원이 내 데이터를 직접 열람한다'], a: 0, why: '필요한 데이터만 제공하고, 모든 데이터는 익명화돼 보험 인프라 AI만 접근하는 것이 설계 원칙입니다.' }
  ] });


/* ══ 시나리오: 증권(ch_infra_stock) ═══════════════════════════════ */
S('ch_infra_stock', { n: 40, short: '증권 AI', page: ['stock', 'order'], focus: '시뮬레이션이 맡는 것: 모의 주문이 장부 전표로 남는 순서, 감독 AI의 ±30% 판단, 전표 변조 확인을 가상 주문으로 반복합니다. 실제 주문·결제는 없고, 실제 화면에서는 연습 예제의 모의 주문 한 번만 합니다.',
  say: ['모의 주문은 어떻게 장부에 기록되나요?', '내 가치 구간은 어떻게 계산했나요?', '삼성전자 10주를 72000원에 모의로 사 줘.'],
  steps: [
    { k: 'order', name: '모의 주문 순서', q: '모의 계좌를 열고 주문해 장부를 확인하는 순서대로 눌러 보세요.', items: ['증권 → 모의 주문 탭에서 모의 계좌 열기(테스트 GDC가 입금된 전표로 시작)', '종목·수량·체결 가격(직접 입력)을 적고 주문하기(모의)', '감독 규칙이 직전 체결가 ±30%·보유 수량·모의 현금을 검사한다', '통과하면 분개와 일련번호가 붙은 장부 전표로 남고, 앞 전표의 해시가 이어진다', '장부 확인으로 전표가 바뀌지 않았는지 다시 검사한다'], why: '모의 거래라 실제 GDC와 증권은 오가지 않고 은행 잔고와도 섞이지 않아요. 보유·손익은 이 전표에서만 계산합니다.' },
    { k: 'calc', name: '감독 AI의 ±30%', gen: function (r) { var p = ri(r, 4, 20) * 5000, up = Math.round(p * 1.3); return { q: '직전 체결가가 ' + won(p) + '원입니다. 감독 규칙(직전 체결가 ±30%)에서 보류되지 않는 가장 높은 가격은 얼마일까요?', a: up, tol: 1, unit: '원', why: won(p) + ' × 1.3 = ' + won(up) + '원까지가 범위입니다. 이보다 높거나 ' + won(Math.round(p * 0.7)) + '원보다 낮으면 보류하고 감독 AI 알림이 남아요.', hint: '직전 체결가 × 1.3.' }; } },
    { k: 'chain', name: '전표 변조 확인', gen: function (r) { return { q: '가상의 모의 장부 전표입니다. 한 전표의 수량을 몰래 고치면 어떻게 될까요?', rows: ['모의 계좌 입금 10,000,000', '매수 ' + ri(r, 5, 20) + '주 × 72,000', '매도 ' + ri(r, 1, 4) + '주 × 75,000', '매수 ' + ri(r, 5, 20) + '주 × 70,000'], why: '전표마다 앞 전표의 해시를 이어 붙여서 한 줄을 고치면 그 줄부터 해시가 어긋나 장부 확인에서 드러나요.' }; } }
  ] });


/* ══ 시나리오: 인프라 AI 41~55장 ═══════════════════════════════ */
S('ch_infra_emergency', { n: 41, short: '응급 AI', focus: '시뮬레이션이 맡는 것: 호출에서 병·의원 자원 조합까지의 순서, 호출 때 전달되는 형태, 가장 빨리 처치를 시작하는 조합 고르기를 가상 상황으로 익힙니다. 원칙은 설계 단계라 기기·병원·출동 시스템은 연결되어 있지 않고 시간과 병원은 모두 가상 값입니다.',
  say: ['응급 호출을 하면 무엇이 전달돼?', '말을 못 하는 상황이면 어떻게 알려져?', '다른 병원의 의사와 장비를 어떻게 조합해?'],
  steps: [
    { k: 'order', name: '호출에서 조합까지', q: '가상 상황입니다. 응급 AI가 이어 가는 순서대로 눌러 보세요.', items: ['호출 — 폰·워치·링을 가장 단순하게 조작해 응급 메시지를 보낸다', '정보 전달 — 내 AI 비서가 위치·나이·병력·생체 정보를 응급 AI에 보낸다', '추가 질의 — 응급 AI가 비서에게 마지막 식사나 오늘의 운동 여부를 묻는다', '출동 결정 — 현재 위치에서 가장 빨리 닿는 인원·장비에 출동을 지시한다', '자원 조합 — 병·의원의 의료진과 장비를 실시간으로 짜 맞춘다'], why: '호출 → 정보 전달 → 추가 질의 → 출동 → 병·의원 자원 조합 순서입니다. 설계 원칙이며 지금은 연결되어 있지 않아요.' },
    { k: 'sort', name: '호출 때 전달되는 형태', q: '각 상황에서 전달되는 것은 어느 쪽일까요?', buckets: ['음성 또는 문자와 함께 전달', '오직 “응급”만 전달'], items: [['말할 수 있어서 “가슴이 아파요”라고 한다', 0], ['말은 어렵지만 문자를 입력할 수 있다', 0], ['말도 문자 입력도 할 수 없다', 1], ['의식이 흐려져 기기만 겨우 조작했다', 1]], why: '말하거나 문자를 입력할 수 있으면 함께 보내고, 그렇지 않으면 오직 “응급” 메시지만 전달됩니다.' },
    { k: 'pick', name: '가장 빠른 조합', gen: function (r) { var tp = ri(r, 8, 12), td = ri(r, 9, 13), ts = ri(r, 18, 24); return { q: '가상 값입니다. 환자를 한 병원에서 처치하려면 전문의와 장비가 모두 있는 병원이 ' + ts + '분 거리입니다. 다른 병원의 전문의를 자율주행차량으로 장비가 있는 병원에 보내면 환자 도착이 ' + tp + '분, 전문의 도착이 ' + td + '분입니다. 가장 빠른 처치 시작은?', opts: ['장비가 있는 병원으로 이송하고 다른 병원의 전문의를 그곳으로 보낸다(약 ' + Math.max(tp, td) + '분)', '전문의와 장비가 모두 있는 병원으로 이송한다(' + ts + '분)', '가장 가까운 병원에서 기다린다'], a: 0, why: '처치는 환자와 전문의가 모두 도착해야 시작되므로 둘 중 늦은 시간(' + Math.max(tp, td) + '분)이 기준입니다. 이 값은 가상이며, 응급 AI는 인력·장비 현황이 바뀔 때마다 다시 계산해요.', no: ['', '더 오래 걸려요.', '필요한 장비와 전문의가 없으면 처치를 시작할 수 없어요.'] }; } }
  ] });

S('ch_infra_police', { n: 42, short: '치안 AI', focus: '시뮬레이션이 맡는 것: 신고 접수에서 출동 지시까지의 설계 순서와, 신고 내용을 정리하는 일을 가상 상황으로 연습합니다. 원칙은 설계 단계라 CCTV 제어와 출동은 연결되어 있지 않고, 이 화면은 112나 경찰에 아무것도 보내지 않습니다.',
  say: ['지금 골목에서 누가 쫓아와요. 신고 내용을 정리해 줘.', '치안 화면에서 경찰을 바로 부를 수 있어?', '신고할 때 내 위치 기록도 같이 써 줘.'],
  steps: [
    { k: 'order', name: '접수에서 출동까지', q: '설계 원칙의 순서대로 눌러 보세요.', items: ['신고 접수 — 폰·스마트워치의 문자·음성 신고를 받는다', '주변 센서 파악 — 주변 CCTV를 직접 제어해 상황을 본다', '출동 지시 — 인근 경찰서·파출소에 알린다', '인원과 장비 — 자율주행 치안 차량 등에 출동을 지시한다'], why: '접수 → 센서로 상황 파악 → 출동 지시 순서로 설계되어 있습니다. 지금은 연결 전이라 실제로는 일어나지 않아요.' },
    { k: 'sort', name: '신고 내용 정리', q: '가상의 신고 메모입니다. 직접 112에 말할 때 정리해 둘 내용과 이 화면이 하지 않는 일을 나눠 보세요.', buckets: ['내가 정리해 둘 것', '이 화면이 하지 않는 일'], items: [['무슨 일이 벌어졌는지', 0], ['어디인지(장소)', 0], ['경찰에 내용을 대신 전송하기', 1], ['개인의 위치·통신 기록을 조회해 쓰기', 1]], why: '화면은 내용을 정리해 직접 112에 말하거나 문자를 보내도록 돕습니다. 위치·통신 기록을 쓰는 단계는 법적 근거와 감독 절차가 필요해 제공하지 않아요.' },
    { k: 'pick', name: '출동 배정 연습', gen: function (r) { var n = ri(r, 2, 4); return { q: '가정값 연습입니다. 신고가 접수되었고 CCTV로 현장을 파악한 뒤, 설계 원칙에서 다음 일은?', opts: ['인근 경찰서·파출소에 알리고 인원과 장비에 출동을 지시한다', '범죄자를 화면이 직접 특정한다', '신고자의 위치·통신 기록을 먼저 열람한다'], a: 0, why: '설계 원칙은 파악한 뒤 출동을 지시하는 것입니다. 범죄자 특정과 경찰 전송은 연결되어 있지 않아요. (가상 신고 ' + n + '건 가운데 한 건 연습)' }; } }
  ] });

S('ch_infra_medical', { n: 43, page: ['med', 'submit'], short: '의료 AI', focus: '시뮬레이션이 맡는 것: 가상 환자 정보로 제출 범위를 정하고 역할을 가려 봅니다. 의료 판단이 아니며, 의료 기관 연결은 설계 단계이고 이 화면은 어떤 정보도 밖으로 보내지 않습니다.',
  say: ['허리가 아픈데 병원에 알릴 내 정보를 정리해 줘.', '병원이 요청하면 내 기록 중 어디까지 줘야 해?', '내 증상이면 무슨 병일 가능성이 높아?'],
  steps: [
    { k: 'sort', name: '누가 하는 일인가', q: '의료 인프라의 설계 원칙에서 이 일은 누구의 몫일까요?', buckets: ['나(개인)', '의료 AI의 참고 목록', '의료진'], items: [['병원에 제출할 데이터를 항목별로 정한다', 0], ['내 의료 정보를 내 PDV에 보관한다', 0], ['진술과 기록을 종합해 후보를 순서대로 정리해 의료진에게 참고용으로 준다', 1], ['최종 진단을 내린다', 2], ['처치와 처방을 정한다', 2]], why: '개인은 제출할 데이터를 스스로 정하고, AI의 목록은 참고용이며, 진단·처치·처방은 의료진이 합니다. 이 화면은 질병 이름이나 확률을 지어내지 않아요.' },
    { k: 'pick', name: '제출 범위 판단', gen: function (r) { var c = ['허리 통증', '두통', '무릎 통증'][ri(r, 0, 2)]; return { q: '가상 환자가 ' + c + '으로 병원에 갑니다. 병원이 특정 자료를 요청했을 때 올바른 처리는?', opts: ['요청받은 특정 데이터만 익명화해 제출하도록 내가 항목별로 정한다', '내 PDV 전체를 병원에 넘긴다', '이 화면이 알려 준 질병 확률을 병원에 알린다'], a: 0, why: '설계에서는 의료 기관의 요청이 있을 때 특정 데이터만 익명화해 제출합니다. 이 화면은 확률을 계산하지 않고 아무것도 밖으로 보내지 않아요.', no: ['', 'PDV 전체가 아니라 특정 데이터만 냅니다.', '이 화면은 진단하거나 확률을 알려 주지 않아요.'] }; } },
    { k: 'pick', name: '진료 참고 목록', q: '진료 참고 목록 탭에 “후보 A, 후보 B”처럼 자리표시만 보입니다. 맞게 읽은 것은?', opts: ['전달 형식을 보여 주는 자리표시이고 실제 질병 후보나 확률이 아니다', '후보 A가 내 병이다', '확률이 높은 순서이니 그대로 약을 먹는다'], a: 0, why: '이 화면은 진단하지 않으며 질병 이름이나 확률을 지어내지도 않습니다. 진단·처방은 의료진이 합니다.' }
  ] });

S('ch_infra_traffic', { n: 44, short: '교통 AI', focus: '시뮬레이션이 맡는 것: 공유 차량이 차량 수를 얼마나 줄이는지 가정값으로 어림하고, 설계 원칙을 가려 봅니다. 차량 제어는 설계 단계이며 이 화면은 차량을 부르거나 제어하지 않고, 값은 실제 도로 데이터가 아닙니다.',
  say: ['모든 사람이 공유 차량을 쓰면 차가 몇 대나 필요해?', '교차로에서 차들이 안 부딪히는 방법이 뭐야?', '지금 공유 차량 하나 불러 줘.'],
  steps: [
    { k: 'calc', name: '차량 수 상한', gen: function (r) { var n = ri(r, 4, 20) * 10000; return { q: '가상의 도시에 지금 차량이 ' + won(n) + '대 있습니다. 모든 시민이 공유 차량을 쓰면 설계 원칙은 차량 총 대수를 기존의 1/2 이하로 줄일 수 있다고 합니다. 줄어든 뒤 차량 수의 상한은 몇 대일까요?', a: n / 2, tol: 0, unit: '대', why: won(n) + ' × 1/2 = ' + won(n / 2) + '대 이하입니다. 이는 설계 원칙이며 화면의 계산은 평균 가동 비율만 쓴 단순 추정이라 첨두 수요는 반영하지 않아요.', hint: '기존 대수의 절반입니다.' }; } },
    { k: 'sort', name: '원칙 · 한계', q: '이 문장은 어디에 속할까요?', buckets: ['설계 원칙', '화면의 한계'], items: [['차량은 도로에 표시된 주행 안내선을 따라간다', 0], ['서버가 모든 차량의 위치를 파악해 통제한다', 0], ['주정차 차량이 없어 도로가 원활하다', 0], ['계산은 내가 넣은 값만 쓰고 실제 도로 데이터가 아니다', 1], ['차량을 부르거나 제어하지 않는다', 1]], why: '안내선·서버 통제·충돌과 혼잡 없음은 설계 단계의 원칙입니다. 화면은 내가 넣은 값으로 단순 계산만 해요.' },
    { k: 'pick', name: '이 결과를 믿어도 될까', gen: function (r) { return { q: '가상 결과로 “공유 차량 ' + ri(r, 3, 9) * 1000 + '대면 충분”이 나왔습니다. 올바른 해석은?', opts: ['평균 가동 비율만 쓴 단순 추정이라 출퇴근 같은 첨두 수요는 따로 봐야 한다', '실제 도시에 그대로 적용해도 된다', '이 화면이 그만큼의 차량을 배차한 것이다'], a: 0, why: '공유 차량 규모는 평균 가동 비율만 쓴 단순 추정이고 첨두 수요 등은 반영하지 않습니다. 배차도 하지 않아요.' }; } }
  ] });

S('ch_infra_logistics', { n: 45, short: '물류 AI', focus: '시뮬레이션이 맡는 것: 합차 효과를 가상 물품으로 계산하고 경로 계산의 한계를 가려 봅니다. 배차와 추적은 설계 단계이며 이 화면은 물품을 보내거나 차량을 부르지 않습니다. 계산은 부피 합만 보는 단순 가정입니다.',
  say: ['같은 방향 택배를 한 차에 합치면 몇 대가 줄어?', '경유지 세 곳을 도는 순서를 알려 줘.', '내 택배가 지금 어디 있는지 추적해 줘.'],
  steps: [
    { k: 'calc', name: '합차로 줄어드는 차량', gen: function (r) { var cap = [10, 20][ri(r, 0, 1)], k = ri(r, 4, 7), per = cap / 2 * 1; var tot = k * (cap / 2) ; return { q: '가상 물품 ' + k + '개가 같은 방향이고 각각 부피 ' + (cap / 2) + '입니다. 차량 한 대의 적재 용량은 ' + cap + '입니다. 따로 보내면 차량 ' + k + '대인데, 부피 합만 보고 한 번에 합쳐 실으면 몇 대가 필요할까요?', facts: '가정: 부피 합 ÷ 적재 용량을 올림합니다(실제 화면은 부피 큰 것부터 넣는 단순 방법).', a: Math.ceil(tot / cap), tol: 0, unit: '대', why: '부피 합 ' + tot + ' ÷ 용량 ' + cap + ' = ' + (tot / cap) + ' 이므로 올림하여 ' + Math.ceil(tot / cap) + '대입니다. 같은 방향의 물품을 합쳐 빈 차로 달리는 거리를 줄이는 것이 합차입니다.', hint: '부피 합을 용량으로 나누고 올림하세요.' }; } },
    { k: 'sort', name: '원칙 · 한계', q: '이 문장은 어디에 속할까요?', buckets: ['설계 원칙', '이 화면의 계산 한계'], items: [['최소화 대상은 개별 업체가 아니라 사회 전체의 물류 총비용이다', 0], ['도로·차량·주문이 바뀌면 시각과 경로를 다시 정한다', 0], ['거리는 직선거리(km)이고 경로는 가까운 곳부터 잇는 단순 방법이라 최적이 아닐 수 있다', 1], ['합차는 물품 종류·방향·시간 제약을 반영하지 않는다', 1]], why: '총비용 최소와 실시간 갱신은 설계 단계의 원칙이고, 화면의 계산은 내가 넣은 값으로 하는 단순 방법입니다.' },
    { k: 'pick', name: '지연이 생기면', q: '경유지 도착 시각을 계산한 뒤 중간에 지연을 넣었습니다. 화면이 보여 주는 것은?', opts: ['지연을 넣으면 도착 시각이 어떻게 바뀌는지 다시 계산해 보여 준다', '실제 차량의 위치를 추적한다', '새 차량을 자동으로 배차한다'], a: 0, why: '경로·도착 시각 탭은 지연을 넣으면 시각이 어떻게 바뀌는지 보여 줍니다. 실제 추적과 배차는 하지 않아요.' }
  ] });

S('ch_infra_public', { n: 46, page: ['pub', 'connect'], short: '행정 AI', focus: '시뮬레이션이 맡는 것: 가상 민원으로 도우미 대행에서 내가 하는 일과 도우미가 하는 일을 가리고, 필요한 서류를 대조해 봅니다. 기관 AI 비서 연결과 위임 효력은 설계 단계이며 이 화면은 기관에 접속하거나 아무것도 제출하지 않습니다.',
  say: ['대법원 전자소송 서류를 대신 채워 줘.', '이 기관이 요구하는 서류 중 내가 더 준비할 게 뭐야?', '결제도 알아서 해 줘.'],
  steps: [
    { k: 'sort', name: '누가 하나', q: '지금 방식(도우미 대행)에서 이 일은 누가 할까요?', buckets: ['내가 직접', '도우미'], items: [['공동인증서 같은 로그인과 본인 인증', 0], ['채워진 내용을 보고 최종 확인·동의 버튼 누르기', 0], ['수수료 결제', 0], ['목적에 맞는 서류를 찾아 필드를 채우기', 1], ['어디에 무엇을 넣었는지 보여 주기', 1]], why: '도우미는 비밀번호와 인증서를 다루지 않고, 로그인·최종 확인·결제는 내가 합니다.' },
    { k: 'pick', name: '서류 대조', gen: function (r) { var all = ['신분증 사본', '주민등록등본', '소장 초안', '위임장', '인지대 영수증']; var need = shuf(all, r).slice(0, 4), have = need.slice(0, ri(r, 1, 3)); var lack = need.length - have.length; return { q: '가상 민원입니다. 기관이 요구하는 서류는 ' + need.join(', ') + '이고, 내가 가진 서류는 ' + have.join(', ') + '입니다. 더 준비할 서류는 몇 개일까요?', opts: ['1개', '2개', '3개', '4개'], a: lack - 1, why: '요구 ' + need.length + '개 중 가진 ' + have.length + '개를 빼면 ' + lack + '개를 더 준비합니다. 기관 AI 연결 탭의 대조가 바로 이 일입니다(기관에는 접속하지 않아요).' }; } },
    { k: 'order', name: '앞으로의 방식', q: '설계 단계의 handshake 방식을 순서대로 눌러 보세요.', items: ['기관 AI 비서가 갖춰지고 서로 신원을 인증한다', '기관이 요구하는 서류를 내 비서가 데이터로 보낸다', '내가 위임한 범위 안에서 비서가 동의와 수수료 결제를 한다', '나는 승인만 한다'], why: '아직 연결된 기관 AI 비서는 없는 설계 단계이고, 위임·동의 탭의 한도도 지금은 효력이 없어 결제는 계속 내가 합니다.' }
  ] });

S('ch_infra_search', { n: 47, short: '검색 AI', focus: '시뮬레이션이 맡는 것: 무엇이 검색 엔진에 올라가는지 가려 보고, 같은 조건 집단의 크기로 등록 기준을 점검해 봅니다. 검색 엔진과 공동 관리 시스템은 설계 단계이며 이 화면은 아무것도 등록하거나 밖으로 보내지 않습니다.',
  say: ['내 자료를 검색에 공개해도 안전해?', '우리 동네 통계만 올리고 싶어.', '공개했던 자료를 다시 비공개로 돌리고 싶어.'],
  steps: [
    { k: 'sort', name: '올라가나 · 안 올라가나', q: '이 자료는 검색 엔진에 올라갈 수 있을까요?', buckets: ['올라갈 수 있다', '올라가지 않는다'], items: [['누구의 것인지 알 수 없게 바꾼 익명화 자료(집단 충분)', 0], ['내가 직접 공개 동의를 고른 자료', 0], ['여러 사람을 합쳐 개인이 드러나지 않는 통계', 0], ['공개를 고르지 않은 내 PDV 속 기록', 1], ['전화번호가 들어 있는 자료', 1]], why: '익명화·공개 동의·통계만 올라갑니다. 처음은 모두 비공개이고, 주민등록번호·전화번호·이메일이 들어 있으면 공개로 바꿀 수 없어요.' },
    { k: 'pick', name: '집단 크기 점검', gen: function (r) { var s = [ri(r, 12, 40), ri(r, 5, 9), ri(r, 15, 60)]; s = shuf(s, r); var mn = Math.min.apply(null, s); return { q: '같은 조건의 집단별 사람 수가 ' + s.join(', ') + '명입니다. 기본 기준(10명 이상)으로 익명 자료 등록이 가능한가요?', opts: ['가능하다', '불가능하다(가장 작은 집단이 기준 미달)'], a: mn >= 10 ? 0 : 1, why: '가장 작은 집단은 ' + mn + '명이고 기준은 10명 이상이라 ' + (mn >= 10 ? '가능' : '불가능') + '합니다. 작은 집단이 있으면 사람을 알아볼 수 있기 때문이에요.' }; } },
    { k: 'pick', name: '공개를 거두면', q: '공개 동의했던 내 자료를 비공개로 바꾸면 어떻게 될까요?', opts: ['내 자료는 색인에서 삭제되고, 이미 합산된 통계는 유지된다', '검색 결과에 계속 남는다', '합산된 통계도 모두 삭제된다'], a: 0, why: '합산된 통계는 개인이 식별되지 않아 유지되고, 내 자료 자체는 색인에서 삭제됩니다.' }
  ] });

S('ch_infra_biz', { n: 48, short: '사업 AI', focus: '시뮬레이션이 맡는 것: 사업 순환의 순서와 개선 효과의 달성률 계산을 가상 값으로 해 봅니다. 결과는 참고용이며 성공을 보장하지 않고, 이 화면은 장부와 연결되어 있지 않으며 등록·신고·투자 권유는 하지 않습니다.',
  say: ['카페를 열기 전에 성공할 가능성을 따져 줘.', '이번 달 적자인데 뭘 고쳐야 해?', '개선안을 적용했는데 효과가 있었는지 알려 줘.'],
  steps: [
    { k: 'order', name: '사업 순환', q: '사업 화면의 순환을 순서대로 눌러 보세요.', items: ['시작 전 판단 — 시장 압력과 내 상황을 견줘 본다', '성과 평가 — 매달 숫자를 넣어 네 관점의 신호를 본다', '개선안 — 주의·위험 신호마다 후보를 정한다', '적용·효과 측정 — Plan → Do → Check → Act로 결과값을 넣는다', '새 개선안 — 달성하면 새 목표, 미달이면 원인을 다시 점검한다'], why: '시작 전에 따져 보고, 시작한 뒤에는 재고 고치는 순환입니다. 판단 결과는 참고용이에요.' },
    { k: 'calc', name: '달성률 계산', gen: function (r) { var s = ri(r, 2, 5) * 10, t = s + ri(r, 2, 6) * 10, res = s + Math.round((t - s) * [0.5, 0.75, 1][ri(r, 0, 2)]); var a = Math.round((res - s) / (t - s) * 100); return { q: '개선 지표의 시작값 ' + s + ', 목표값 ' + t + ', 결과값 ' + res + '입니다. 달성률(%)은?', facts: '달성률 = (결과 − 시작값) ÷ (목표 − 시작값) × 100', a: a, tol: 1, unit: '%', why: '(' + res + ' − ' + s + ') ÷ (' + t + ' − ' + s + ') × 100 = ' + a + '%. 달성·진행·미흡·악화로 효과를 알려 줍니다(가상 값).', hint: '(결과−시작) ÷ (목표−시작).' }; } },
    { k: 'pick', name: '균형성과표 네 관점', gen: function (r) { var o = ['재무', '고객', '내부 프로세스', '학습과 성장']; return { q: '균형성과표의 네 관점에 들어가지 않는 것은?', opts: ['정치'].concat(shuf(o, r).slice(0, 3)), a: 0, why: '네 관점은 재무·고객·내부 프로세스·학습과 성장입니다.' }; } }
  ] });

S('ch_infra_plan', { n: 49, short: '계획 AI', focus: '시뮬레이션이 맡는 것: 수치 목표의 필요 속도를 계산하고 달성 가능성 등급을 판정해 봅니다. 확률은 입력한 값과 가정으로 낸 추정이며 결과를 보장하지 않고, 바깥 정보는 가져오지 않습니다.',
  say: ['10년 안에 변호사 자격을 딸 수 있을까?', '2년 안에 3천만 원을 모으려는데 가능해?', '실천을 못 했는데 계획을 어떻게 고치지?'],
  steps: [
    { k: 'calc', name: '매달 필요한 양', gen: function (r) { var goal = ri(r, 5, 12) * 1000000, cur = ri(r, 1, 4) * 1000000, m = [12, 24, 20][ri(r, 0, 2)]; return { q: '가상 목표입니다. 목표 ' + won(goal) + '원, 현재 ' + won(cur) + '원, 남은 기간 ' + m + '개월입니다. 매달 필요한 양(원)은?', facts: '필요 속도 = 남은 양 ÷ 남은 기간. 이것을 내 과거 월별 증가분(3개 이상)과 견줍니다.', a: Math.round((goal - cur) / m), tol: 1, unit: '원', why: '(' + won(goal) + ' − ' + won(cur) + ') ÷ ' + m + ' = ' + won(Math.round((goal - cur) / m)) + '원. 이 값을 과거 월별 증가분과 견줘 확률을 추정합니다.', hint: '(목표−현재) ÷ 개월 수.' }; } },
    { k: 'pick', name: '판정 등급', gen: function (r) { var p = [85, 72, 55, 41, 25, 12][ri(r, 0, 5)]; return { q: '가상 추정 확률이 ' + p + '%입니다. 계획 화면의 판정은?', opts: ['달성 가능', '빠듯함', '어려움'], a: p >= 70 ? 0 : p >= 40 ? 1 : 2, fixed: true, why: '70% 이상 달성 가능, 40% 이상 빠듯함, 그 미만 어려움입니다. ' + p + '%는 ' + (p >= 70 ? '달성 가능' : p >= 40 ? '빠듯함' : '어려움') + '입니다.' }; } },
    { k: 'pick', name: '이어서 할 일', gen: function (r) { var q = [['판정이 어려움입니다', 0, '어려움이면 실행 계획 대신 목표나 기한을 조정하라고 안내합니다.'], ['실천율이 ' + ri(r, 30, 55) + '%입니다', 1, '실천율이 60% 아래면 계획을 가볍게 고치라고 알려 줍니다.'], ['과거 월별 증가분이 2개뿐입니다', 2, '이력이 3개 미만이면 확률 대신 판단 보류가 나옵니다.']][ri(r, 0, 2)]; return { q: '화면이 어떻게 안내할까요? — ' + q[0], opts: ['실행 계획을 쓰지 말고 목표·기한을 조정한다', '계획을 가볍게 고친다', '확률 대신 판단 보류가 나온다'], a: q[1], why: q[2] }; } }
  ] });

S('ch_infra_watch', { n: 50, short: '감시 AI', focus: '시뮬레이션이 맡는 것: 해시로 이어진 가상 활동 기록을 몰래 고쳐 보고, 제출 판단의 순서를 가려 봅니다. 24시간 자동 기록은 기기 연결 전이며 화면은 아무것도 당국에 보내지 않고 증거 능력을 보장하지 않습니다. 법률 판단은 변호사에게 확인하세요.',
  say: ['내 하루 활동을 기록해 두면 무죄를 밝히는 데 도움이 돼?', '수사 요청을 받았는데 내 기록을 다 내야 해?', '상대가 기록 공개를 거부하면 어떡하지?'],
  steps: [
    { k: 'chain', name: '활동 기록 변조', gen: function (r) { var a = ['08:10 출근 기록', '12:30 거래처 미팅', '15:00 서류 제출', '19:20 퇴근 기록', '21:00 문자 전송']; return { q: '가상의 활동 기록입니다. 중간 기록을 몰래 고치면 어떻게 될까요?', rows: shuf(a, r).slice(0, 4).map(function (x, k) { return '2026-11-' + (3 + k) + ' ' + x; }), why: '각 기록은 앞 기록의 해시와 이어져 있어, 고치거나 끼워 넣으면 그 줄부터 어긋나 변조 의심으로 드러납니다. 개별 수정·삭제는 없고, 사슬에 문제가 있으면 제출 준비를 할 수 없어요.' }; } },
    { k: 'order', name: '수사 요청을 받으면', q: '감시의 순환에서 용의자 쪽 순서대로 눌러 보세요.', items: ['스스로 기록 — 내가 한 일과 당사자로 함께한 일을 적는다', '요청 받기 — 영장인지 임의 제출 요청인지 확인한다', '내가 정하기 — 요청 기간 안의 기록 중 낼 것만 고른다', '제출 판단 기록 — 제출 준비 · 제출하지 않음 · 인정·진술 의사 중 하나를 적는다'], why: '요청 기간 안의 내 기록 중 내가 고른 것만 낼 수 있습니다. 화면은 아무것도 당국에 보내지 않고, 제출은 내가 직접 해요.' },
    { k: 'pick', name: '피해자가 되었을 때', q: '가상의 갈등에서 상대가 자기 기록 공개를 거부했습니다. 피해자인 나는?', opts: ['같은 사건을 기록한 내 PDV의 기록을 골라 꺼내 신고의 근거로 낼 수 있다', '상대의 PDV를 열어 확인한다', '몰래 녹음한 제3자의 대화를 근거로 삼는다'], a: 0, why: '기록은 당사자만 볼 수 있어 상대의 PDV는 열 수 없지만, 같은 사건을 기록한 내 기록은 내가 공개할 수 있습니다. 당사자가 아닌 사람의 대화를 몰래 기록하는 것은 통신비밀보호법 등으로 금지될 수 있어요.' }
  ] });

S('ch_infra_job', { n: 51, short: '직업 AI', focus: '시뮬레이션이 맡는 것: 내가 입력한 가정으로 노동 시간의 수요와 공급을 맞춰 보는 모의 계산을 해 봅니다. 예측이나 정책 결정이 아니며, 통계·교육 인프라는 연결 전이고 일자리 배정과 급여 지급은 하지 않습니다. 의무 근로는 법률 문제가 얽혀 있어 전문가에게 확인하세요.',
  say: ['AI가 대신하는 일을 빼면 사람이 할 일이 얼마나 남아?', '나는 어떤 분야가 나한테 맞아?', '실직하면 정부가 일자리를 정해 주는 거야?'],
  steps: [
    { k: 'calc', name: '사람이 해야 할 노동 시간', gen: function (r) { var q = ri(r, 2, 9) * 10000, t = ri(r, 1, 4), c = [20, 40, 50][ri(r, 0, 2)]; return { q: '가상 품목입니다. 연간 수요량 ' + won(q) + '개, 단위당 노동 ' + t + '시간, AI·로봇 대체 가능 비율 ' + c + '%입니다. 사람이 해야 할 노동 시간은?', facts: '연간 수요량 × 단위당 노동 시간 × (1 − 대체 비율)', a: Math.round(q * t * (1 - c / 100)), tol: 1, unit: '시간', why: won(q) + ' × ' + t + ' × (1 − ' + c / 100 + ') = ' + won(Math.round(q * t * (1 - c / 100))) + '시간(가정값).', hint: '대체되는 몫을 뺀 나머지입니다.' }; } },
    { k: 'calc', name: '희망과 필요의 겹침', gen: function (r) { var w = [ri(r, 2, 6) * 10]; w.push(ri(r, 1, 100 - w[0] - 10) ); w[1] = Math.floor(w[1] / 10) * 10 || 10; w.push(100 - w[0] - w[1]); var n = [[w[0] + 10, w[1], w[2] - 10], [w[0], w[1] + 10, w[2] - 10]][ri(r, 0, 1)]; if (n[2] < 0 || w[2] < 0) { w = [40, 30, 30]; n = [30, 40, 30]; } var s = 0, i; for (i = 0; i < 3; i++) s += Math.min(w[i], n[i]); return { q: '세 분야의 희망 비중이 ' + w.join(' · ') + '(%), 사회의 필요 비중이 ' + n.join(' · ') + '(%)입니다. 겹침(%)은?', facts: '분야별로 희망 비중과 필요 비중 중 작은 쪽을 더합니다(합 100).', a: s, tol: 0, unit: '%', why: '분야별 작은 쪽 ' + [0, 1, 2].map(function (i) { return Math.min(w[i], n[i]); }).join(' + ') + ' = ' + s + '%입니다(가상 값).', hint: '각 분야에서 작은 쪽만 더하세요.' }; } },
    { k: 'pick', name: '이 제도의 성격', q: '기초수급제도 확장안과 이 화면에 대해 맞는 것은?', opts: ['65세 미만 수급자가 지정 사업장 중 한 곳에서 일하는 방식을 가정한 모의 계산이고, 배정·지급은 하지 않는다', '화면이 내 일자리를 실제로 배정하고 급여를 지급한다', '실직률 통계가 이미 연결되어 있다'], a: 0, why: '통계와 교육 인프라는 연결 전이며 결과는 가정에 따라 달라지는 참고용입니다.' }
  ] });

S('ch_infra_jit', { n: 52, short: '조달 AI', focus: '시뮬레이션이 맡는 것: 수만 종 문제를 단순화하는 방법을 가려 보고, 처리 능력과 수요의 균형을 가상 값으로 판단해 봅니다. 모의 계산이며 실제 소비·물류 통계는 연결 전이고 주문·배송은 하지 않습니다. 기본값은 예시예요.',
  say: ['전국 물건 수요를 어떻게 한꺼번에 계산해?', '거점을 한 곳만 두면 어디가 좋아?', '내 구매 기록으로 수요를 계산해 줘.'],
  steps: [
    { k: 'sort', name: '단순화 방법', q: '이 방법은 어떤 단순화에 해당할까요?', buckets: ['품목 유형화', '지역 격자', '대표일'], items: [['매출 비중(ABC)과 수요 변동(XYZ)으로 묶는다', 0], ['수요가 모인 지점으로 전국을 묶는다', 1], ['365일 대신 첨두일·평균일·최저일로 푼다', 2], ['수만 종의 품목을 유형 몇 가지로 줄인다', 0]], why: '정확한 모형이 불가능해 품목은 유형으로, 지역은 격자로, 시간은 대표일로 줄입니다. 계산에는 개인이 아닌 집계 통계만 써요.' },
    { k: 'pick', name: '거점 능력 점검', gen: function (r) { var cap = ri(r, 5, 12) * 100, d = cap + ri(r, -3, 3) * 100; if (d === cap) d = cap + 100; return { q: '가상 후보 거점의 하루 처리 능력이 ' + won(cap) + '건이고 하루 수요가 ' + won(d) + '건입니다. 화면은 어떻게 나올까요?', opts: ['대기 시간을 계산할 수 있다', '가동률이 100% 이상이라 계산 불가로 알려 준다'], a: d >= cap ? 1 : 0, why: '가동률은 수요 ÷ 능력 = ' + (d / cap).toFixed(2) + '이고, 100% 이상이면 대기가 끝없이 늘어 대기 시간을 계산할 수 없습니다.' }; } },
    { k: 'pick', name: '수요 자료는 어디서', q: '적시조달의 수요 자료에 대해 맞는 것은?', opts: ['원천은 PDV의 익명 집계 통계이지만, 연결 전이라 지금은 직접 입력한다', '내 PDV 개인 기록을 그대로 쓴다', '실제 소비 통계가 이미 연결되어 있다'], a: 0, why: '개인의 PDV는 본인만 볼 수 있어 계산에는 집계 통계만 씁니다.' }
  ] });

S('ch_infra_city', { n: 53, short: '도시 AI', focus: '시뮬레이션이 맡는 것: 입력 전인 인프라를 빼고 가중치를 다시 나눠 종합 점수를 계산해 봅니다. 한 사람의 입력으로 그린 모형이며 여러 시민의 실제 합산이 아닙니다. 점수는 단순 규칙이라 예측이나 정책 결정이 아니고 부동산 거래·등기는 대신하지 않습니다.',
  say: ['도시 점수는 어떻게 매겨져?', '일자리 인력이 모자라면 어디서 알려 줘?', '내 감시 기록도 도시 화면에서 읽을 수 있어?'],
  steps: [
    { k: 'order', name: '도시가 만들어지는 순서', q: '순서대로 눌러 보세요.', items: ['수요를 안다 — PDV의 집계 통계가 원천이다', '각 인프라가 최적화한다', '도시가 총합을 본다 — 어긋나는 곳을 찾고 점수로 비교한다', '부동산이 물리로 옮긴다 — 부지·건물·계약·등기'], why: '도시는 다른 인프라가 낸 결과의 총합이고, 부동산이 그것을 땅과 건물로 옮깁니다.' },
    { k: 'calc', name: '종합 점수', gen: function (r) { var s = [ri(r, 50, 95), ri(r, 50, 95), ri(r, 50, 95)], w = [40, 30, 30]; var tot = Math.round((s[0] * w[0] + s[1] * w[1] + s[2] * w[2]) / (w[0] + w[1] + w[2])); return { q: '적시조달 ' + s[0] + '점(가중치 40), 일자리 ' + s[1] + '점(30), 계획 ' + s[2] + '점(30)입니다. 사업 AI는 입력 전이라 뺐습니다. 종합 점수는?', facts: '입력 전인 인프라는 빼고, 나머지끼리 가중 평균을 냅니다(소수점은 반올림, 가상 값).', a: tot, tol: 1, unit: '점', why: '(' + s[0] + '×40 + ' + s[1] + '×30 + ' + s[2] + '×30) ÷ 100 = ' + tot + '점입니다.', hint: '가중치 합 100으로 나누는 가중 평균입니다.' }; } },
    { k: 'pick', name: '정합성 점검', gen: function (r) { var o = ['일자리 인력이 모자라 거점이 필요로 하는 인원을 채우지 못한다', '적시조달 거점 능력이 일자리 배치 규모와 맞물리지 않는다']; return { q: '가상 입력에서 ' + o[ri(r, 0, 1)] + '. 정합성 점검은?', opts: ['어긋남으로 알려 준다', '무시하고 점수만 올린다', '실제 시민 데이터로 자동 보정한다'], a: 0, why: '맞물리는 값이 서로 어긋나는지 단순한 규칙으로 점검해 알려 줍니다. 실제 합산은 PDV 집계 통계와 연결된 뒤에 가능해요.' }; } }
  ] });

S('ch_infra_meet', { n: 54, short: '모임 AI', focus: '시뮬레이션이 맡는 것: 가상 사람들 사이의 유사도를 계산하고 어떤 정보가 점수에 쓰이는지 가려 봅니다. 후보는 직접 적은 가상 사람이며 궁합이나 성공을 예측하지 않고, 사람을 연결·초대하지 않습니다.',
  say: ['나랑 취향이 비슷한 사람들 모임을 추천해 줘.', '모임에서 내 나이와 성별이 보여?', '왜 저 사람은 그룹에서 빠졌어?'],
  steps: [
    { k: 'calc', name: '유사도 계산', gen: function (r) { var s = [ri(r, 40, 100), ri(r, 40, 100), ri(r, 40, 100), ri(r, 40, 100)], t = Math.round(s[0] * 0.35 + s[1] * 0.3 + s[2] * 0.25 + s[3] * 0.1); return { q: '두 가상 사람의 항목별 유사도가 취향 ' + s[0] + ', 성향 ' + s[1] + ', 목적 ' + s[2] + ', 능력 ' + s[3] + '점입니다. 전체 유사도는?', facts: '취향 35% · 성향 30% · 목적 25% · 능력 10% (소수점은 반올림)', a: t, tol: 1, unit: '점', why: s[0] + '×0.35 + ' + s[1] + '×0.30 + ' + s[2] + '×0.25 + ' + s[3] + '×0.10 = ' + t + '점입니다.', hint: '각 점수에 비율을 곱해 더하세요.' }; } },
    { k: 'sort', name: '점수 · 공개 · 조건', q: '이 항목은 어디에 쓰일까요?', buckets: ['유사도 점수', '점수에는 안 씀(기본 비공개)'], items: [['취향', 0], ['성향', 0], ['모임 목적', 0], ['연령', 1], ['성별', 1], ['가족', 1]], why: '연령·성별·가족은 점수에 넣지 않고 기본이 비공개이며, 모임이 직접 내건 조건이 있을 때만 참여 가능 여부에 쓰이고 그때는 그 항목을 공개해야 해요.' },
    { k: 'pick', name: '걸러 낼 사람', gen: function (r) { var a = [ri(r, 70, 90), ri(r, 50, 69), ri(r, 20, 49)], n = ['가', '나', '다']; var cut = [60, 50][ri(r, 0, 1)]; var low = a.filter(function (x) { return x < cut; }).length; return { q: '가상 후보 세 명의 다른 사람과의 평균 유사도가 가 ' + a[0] + ', 나 ' + a[1] + ', 다 ' + a[2] + '점이고 기준 점수는 ' + cut + '점입니다. 기준 미만으로 걸러지는 사람은 몇 명일까요?', opts: ['0명', '1명', '2명', '3명'], a: low, fixed: true, why: '평균 유사도가 기준 미만인 사람은 ' + low + '명입니다. 실제로는 가장 낮은 사람부터 한 명씩 빼며, 기준을 올리면 걸러진 사람이 늘어요. 비슷한 사람끼리만 모이면 관점이 좁아질 수 있어 기준을 낮춰 폭을 조절할 수 있습니다.' }; } }
  ] });

S('ch_infra_democracy', { n: 55, short: '민주주의 AI', focus: '시뮬레이션이 맡는 것: 입법 청원의 길에서 AI가 하는 일과 사람이 하는 일을 가리고, 동의 현황을 가상 숫자로 계산해 봅니다. 전국 배포와 동의 집계는 설계 단계이며 이 화면은 청원을 아무에게도 보내지 않고, 넣은 숫자는 실제 집계가 아닙니다.',
  say: ['재판 때문에 기본권이 침해됐다고 느껴서 청원을 내고 싶어.', '내 비서가 대신 동의해 줘.', '이 청원 초안이 형식에 맞는지 심사해 줘.'],
  steps: [
    { k: 'order', name: '청원이 가는 길', q: '청원이 국회까지 가는 순서대로 눌러 보세요.', items: ['내 비서가 초안을 쓴다', '나비웹 민주주의 시스템의 1차 심사를 받는다', '전국 시민의 AI 비서에게 배포한다', '각 비서가 타당성과 합리성을 평가하고 필요하면 시민에게 전한다', '시민이 동의하고 기준 이상이면 국회의 입법 절차로 넘어간다'], why: '쓰고 읽고 평가하는 일은 AI가, 청원 의사를 밝히는 일은 사람이 합니다. 전국 배포와 집계는 아직 설계 단계예요.' },
    { k: 'sort', name: 'AI · 사람', q: '이 일은 누구의 몫일까요?', buckets: ['AI 비서', '사람(시민)'], items: [['청원 초안 쓰기', 0], ['받은 청원의 타당성·합리성 평가', 0], ['형식(필수 항목·분량·개인정보·선거 운동 표현·중복) 점검', 0], ['청원에 동의할지 정하기', 1], ['최종 반려 확인과 이의 신청 받기', 1]], why: '동의는 전화번호 본인 인증을 거친 가입자 한 사람이 한 번만 하며 AI가 대신 동의하지 않습니다. 1차 심사는 내용의 옳고 그름을 판단하지 않아요.' },
    { k: 'calc', name: '하루에 필요한 동의', gen: function (r) { var d = [30, 20, 10][ri(r, 0, 2)], c = ri(r, 4, 20) * 1000; var need = Math.ceil((50000 - c) / d); return { q: '가상 연습입니다. 기준은 5만 명이고 기간은 ' + d + '일입니다. 지금까지 ' + won(c) + '명이 동의했고 ' + d + '일이 모두 남아 있다고 가정하면, 하루에 필요한 동의 수(올림)는?', facts: '남은 동의 수 ÷ 남은 일수 (넣은 숫자는 실제 집계가 아니에요)', a: need, tol: 0, unit: '명', why: '(50,000 − ' + won(c) + ') ÷ ' + d + ' = ' + won(need) + '명(올림). 기준 5만 명은 국회 국민동의청원(30일 안에 5만 명)에 연결하는 기본값이고 이 화면의 숫자는 가상이에요.', hint: '남은 동의 수를 일수로 나누고 올림하세요.' }; } }
  ] });

/* ══ 시나리오: 중급 56~67장(K-정부 ~ 종합 실습) ═══════════════════════ */
S('ch_kgov', { n: 56, short: 'K-정부와 기관 소통 방식', focus: '시뮬레이션이 맡는 것: 같은 일을 사람이 직접 · 도우미 · 기관의 나비 세 방식으로 가려 보는 연습을 합니다. 기관마다 나비를 갖는 단계는 아직 오지 않은 계획이고, 3일·1시간 이내·수 분은 예상·목표이지 측정값이 아닙니다.',
  say: ['카페를 열려면 어떤 기관에 무슨 서류를 내야 해?', '국세청은 어떤 조직인지 알려 줘.', '정부24에서 등본 신청 화면까지만 가 줘. 제출은 하지 마.'],
  steps: [
    { k: 'sort', name: '세 가지 방식', q: '위치기반사업 인허가 예시에서 이 설명은 어느 방식일까요?', buckets: ['사람이 직접', '나비웹 도우미(지금)', '나비 ↔ 기관의 나비(장차)'], items: [['기관을 하나하나 찾아가 서류를 낸다', 0], ['사용자는 로그인과 결제만 하고 기관 사이트를 대신 방문해 제출·다운로드한다', 1], ['사이트를 거치지 않고 기관들의 나비끼리 필요한 정보를 주고받는다', 2], ['기관마다 양식과 요구 서류가 달라 오가는 시간이 대부분이다', 0], ['기관의 사이트와 절차는 그대로 두고 사람이 하던 일을 빠르게 대신한다', 1]], why: '지금 쓸 수 있는 것은 도우미이고, 기관마다 나비를 갖는 단계는 아직 오지 않은 계획입니다.' },
    { k: 'pick', name: '찾아갈 곳', v: [
      { q: '“국세청은 어떤 조직인가”를 알고 싶습니다. 어디에서 찾을까요?', opts: ['K-정부에서 국세청을 찾는다', 'K-Tax로 바로 간다', '전문가 페르소나를 부른다'], a: 0, why: 'K-정부는 기능이 속한 기관 자체를 찾는 디렉토리이고, 세금 신고처럼 기능이 필요하면 K-Tax로 바로 갑니다.' },
      { q: '세금 신고를 하고 싶습니다. 어디로 갈까요?', opts: ['K-Tax로 바로 간다', 'K-정부에서 부서 SP를 읽는다', '도우미 없이는 불가능하다'], a: 0, why: 'K-서비스는 기능 중심, K-정부는 기관을 찾아가는 디렉토리입니다.' },
      { q: '기관 지도에서 부서를 눌렀더니 SP가 바로 열렸습니다. 이 SP는 어떻게 만들어졌을까요?', opts: ['부서 정보를 공용 템플릿에 그 자리에서 채워 만든다(입법·사법·행정·지자체 부서)', '모든 부서가 미리 만든 파일이다', '사람이 그때그때 써서 올린다'], a: 0, why: '공기업·공공기관은 이미 완성된 SP 파일이 있고, 부서 SP는 필요할 때 템플릿에 채워 만듭니다.' }] },
    { k: 'pick', name: '숫자 읽기', q: '“3일 → 1시간 이내 → 수 분”이라는 숫자를 어떻게 읽어야 할까요?', opts: ['설명을 위한 예상·목표이며 실제 측정값이 아니다', '이미 측정된 실제 처리 시간이다', '법으로 보장된 처리 기한이다'], a: 0, why: '원문이 예상·목표라고 밝혔습니다. 재량이나 법적 책임이 걸린 판단은 어느 방식에서든 담당 직원의 확인·승인을 거칩니다.' }
  ] });

S('ch_govagency', { n: 57, short: '행정기관 AI 페이지와 접수 연동 민원', focus: '시뮬레이션이 맡는 것: 도우미가 대신하는 일과 내가 직접 하는 일을 가르고 전입신고 순서와 기한을 가상 날짜로 연습합니다. 실제 신청은 접수되지 않으며, 제주시·도청의 실제 창구는 원문이 확인 필요로 표시한 부분입니다.',
  say: ['오늘 이사했어. 새 집 행정복지센터에 전입신고 해 줘.', '입력까지만 하고 제출은 잠깐 멈춰 줘.', '내 전입신고가 처리됐는지 확인해 줘.'],
  steps: [
    { k: 'sort', name: '도우미 vs 나', q: '민원 신청에서 누가 맡을까요?', buckets: ['도우미', '내가 직접'], items: [['메뉴를 찾고 칸을 채운다', 0], ['간편인증·공동인증서로 로그인한다', 1], ['수수료가 있으면 금액을 확인하고 결제한다', 1], ['제출 단추를 누르기 전 “제출할까요?”라고 묻는다', 0], ['화면이 요구하는 주민등록번호를 적는다', 1]], why: '도우미는 비밀번호·인증서·주민등록번호를 묻지도 입력하지도 않고, 결제 화면 앞에서 멈춥니다. 나는 로그인과 결제를 맡습니다.' },
    { k: 'order', name: '전입신고 흐름', q: '전입신고를 도우미로 진행하는 순서대로 눌러 보세요.', items: ['이사한 날과 이전·새 주소를 나비에게 말한다', '나비가 정리한 내용으로 “도우미로 진행”을 누른다', '도우미가 멈춘 로그인 창에서 내가 로그인하고 “로그인했어”라고 알린다', '도우미가 전입신고 메뉴를 찾아 주소와 사유를 입력한다', '“제출할까요?”에 답해 접수한다', '정부24의 나의 신청내역에서 처리 상태를 확인한다'], why: '접수 뒤에도 처리 상태를 꼭 확인합니다. 연습에서는 제출 확인에서 “아니오”라고 답하면 실제로 접수되지 않아요.' },
    { k: 'calc', name: '신고 기한', gen: function (r) { var d = ri(r, 1, 15); return { q: '가상의 이사 날짜는 11월 ' + d + '일입니다. 이사한 날부터 14일째 되는 날은 11월 며칠일까요?', facts: '전입신고는 이사한 날부터 14일 안에 해야 하는 의무입니다(원문). 이 문제는 날짜 더하기 연습이에요.', a: d + 14, tol: 0, unit: '일', why: d + ' + 14 = ' + (d + 14) + '. 실제 기한 계산과 준비물은 정부24의 전입신고 안내에서 확인하세요.', hint: '이사한 날짜에 14를 더합니다.' }; } },
    { k: 'pick', name: '접수번호 읽기', q: '나비가 접수 연동 민원을 신청하고 접수번호를 발급해 주었습니다. 이 번호는?', opts: ['나비 내부 접수번호이며 정부의 공식 접수번호가 아니다', '정부의 공식 접수번호이다', '결제가 끝났다는 증명이다'], a: 0, why: '재량이나 법적 책임이 걸린 판단은 담당 직원의 확인·승인을 거칩니다.' }
  ] });

S('ch17', { n: 58, short: 'K-서비스 호출하기', focus: '시뮬레이션이 맡는 것: 상황에 맞는 K-서비스를 가려 고르고 대화가 열린 것과 준비 중인 것을 분류하는 연습을 합니다. 실제 메뉴 클릭은 연습 예제에서 하며, 보이는 범위는 원문 앞부분입니다.',
  say: ['이 송장번호 택배가 지금 어디 있나요?', '제주 한림읍 근처 소아과를 찾아 주세요.', '한림읍 단독주택 전세 시세가 궁금해요.'],
  steps: [
    { k: 'sort', name: '어떤 서비스', q: '이 말은 어느 서비스에서 하면 좋을까요?', buckets: ['K-Logistics(물류)', 'K-Search(검색)', 'K-Estate(부동산)', 'K-Traffic(교통)'], items: [['이 송장번호 택배가 지금 어디 있나요?', 0], ['제주 한림읍 근처 소아과를 찾아 주세요.', 1], ['한림읍 단독주택 전세 시세가 궁금해요.', 2], ['내일 아침 제주공항에서 한림까지 가는 방법을 알려 줘.', 3]], why: '서비스는 입력창 아래 인프라 AI ▾에서 고릅니다. 첫 화면 → 말 걸기 → 대화창 순서는 모든 서비스가 같고 다루는 일만 다릅니다.' },
    { k: 'sort', name: '열림과 준비 중', q: '원문에서 “준비 중”으로 설명하는 서비스는 어느 쪽일까요?', buckets: ['대화 상담이 열림', '준비 중(입력창 잠김)'], items: [['K-Mail', 0], ['K-Market', 0], ['K-Security(보안)', 1], ['K-Social-Match(모임)', 1], ['K-Search', 0]], why: '보안·사업자·조달·도시 설계·모임은 아직 전용 AI가 없어 “준비 중” 안내와 함께 입력창이 잠기는 것이 정상입니다.' },
    { k: 'pick', name: '연습할 때', v: [
      { q: '응급·신고 서비스를 연습하려 합니다. 가장 중요한 것은?', opts: ['가상 상황임을 밝히고, 진짜 긴급하면 119·112에 먼저 전화한다', '실제처럼 접수해 본다', '연습은 위험하니 하지 않는다'], a: 0, why: '연습은 가상의 상황으로 하고 실제 긴급 상황이면 먼저 119·112에 전화합니다.' },
      { q: 'K-Mail 연습 메일은 누구에게 보내야 할까요?', opts: ['자기 자신의 주소', '아는 사람 아무에게나', '모르는 주소'], a: 0, why: '메일 연습은 자기 자신의 주소로 보내고, 발송 전 확인 단계에서 멈춰도 됩니다.' },
      { q: 'K-Law가 준 가상 판결을 어떻게 받아들일까요?', opts: ['참고용이며 실제 소송·계약 전에는 변호사 확인이 필요하다', '법률 자문과 같다', '한쪽이 받아들이면 화해계약이 성립한다'], a: 0, why: '화해계약은 당사자 양측이 자발적으로 합의할 때에만 성립합니다.' }] }
  ] });

S('ch_ksvc_work', { n: 59, short: '일하는 K-서비스', focus: '시뮬레이션이 맡는 것: K-Mail·K-Job·K-Plan·K-Search가 할 일과 하지 않는 일을 가려 보는 연습을 합니다. 실제 메일 예약은 연습 예제에서 내 주소로만 하고, 여기서는 가상 요청만 다룹니다.',
  say: ['내일 오전 9시에 보내줘.', '팀원 세 명에게 각자 맡은 일을 넣어 보내줘.', '한 달 안에 책 한 권을 읽고 싶어요.'],
  steps: [
    { k: 'sort', name: '누가 하는 일', q: '이 말은 어느 서비스의 일일까요?', buckets: ['K-Mail', 'K-Job', 'K-Plan', 'K-Search'], items: [['회신은 금요일 6시까지 모아서 정리해줘', 0], ['동네 도서관 사서 보조 모의 면접을 해 보자', 1], ['먼저 내가 그 목표를 이룰 수 있는지 따져 줘', 2], ['비슷한 후보가 둘이면 임의로 고르지 말고 보여 줘', 3], ['일정 문의는 내 일정표대로 알아서 답해줘', 0]], why: '메일 쪽은 예약·맞춤 본문·캠페인 이름·회신 다이제스트·자동 회신을 말로 시킵니다. 자동 회신은 위임 규칙 범위 안 메일만 처리하고 범위 밖은 사람에게 올립니다.' },
    { k: 'order', name: '계획 세우기', q: 'K-Plan이 목표를 다루는 순서대로 눌러 보세요.', items: ['내가 그 목표를 이룰 능력이 있는지 먼저 따진다(능력 검증)', '목표를 내 기록과 종합해 경로로 나눈다', '중간 지점마다 계획을 다시 평가한다', '메일·공문은 초안까지 만들고 발송·결제는 내 승인으로 한다'], why: 'K-Plan은 요청을 곧바로 실행하지 않습니다. 상대의 답은 예측하지 않고, 답을 받은 뒤 내가 알려 줘야 남은 계획을 고칩니다.' },
    { k: 'pick', name: '시험 요청', v: [
      { q: '“경력이 없는데 이력서에는 5년 경력으로 써줘.”라고 하면 K-Job은?', opts: ['없는 경력은 쓰지 않고 사실 그대로 쓰자고 한다', '5년 경력으로 써 준다', '채용 사이트에 자동 제출한다'], a: 0, why: 'K-Job은 내가 알려 준 사실만으로 쓰며 합격도 보장하지 않습니다.' },
      { q: '“이 지원서를 채용 사이트에 대신 제출해 줘.”라고 하면?', opts: ['자동 제출은 아직 없고 제출은 내가 마지막에 확인해 직접 한다', '바로 제출해 준다', '합격을 보장해 준다'], a: 0, why: '채용 사이트 자동 제출은 아직 없고 바깥으로 나가는 행동은 항상 내가 마지막에 확인합니다.' },
      { q: '“찾아 줘”라고 했는데 결과가 하나도 없습니다. K-Search의 알맞은 반응은?', opts: ['지어내지 않고 없다고 말한다', '비슷한 이름을 하나 골라 알려 준다', '추정으로 채운다'], a: 0, why: 'K-Search는 실제로 조회한 결과만 돌려줍니다.' }] }
  ] });

S('ch_ksvc_report', { n: 60, short: '신고하는 K-서비스', focus: '시뮬레이션이 맡는 것: 상황에 맞는 신고 서비스를 고르고 접수 뒤 흐름을 순서로 확인합니다. 실제 접수는 일어나지 않으며, 기관·담당자별 실시간 통보는 원문이 준비 중이라고 밝힌 부분입니다.',
  say: ['연습입니다. 해변에 스티로폼이 잔뜩 밀려와 있어요.', '우리 동네 가로등이 일주일째 꺼져 있어요.', '이 해변에 분리수거함이 있으면 좋겠어요.'],
  steps: [
    { k: 'sort', name: '어느 서비스', q: '이 상황에는 어느 서비스를 고를까요?', buckets: ['K-Clean(환경)', 'K-Watch(신고)', 'K-Police(치안)', 'K-119(응급)'], items: [['해변에 쓰레기가 밀려와 있다', 0], ['도로에 큰 구멍이 나 있다', 1], ['내가 위험하거나 범죄 피해가 의심된다(긴급하면 먼저 112)', 2], ['사람이 쓰러져 있다(먼저 119에 전화)', 3]], why: '쓰러진 사람이나 화재가 사진에 찍혀 있으면 K-Clean도 환경 처리보다 응급 안내를 먼저 합니다.' },
    { k: 'order', name: '이상적인 처리 흐름', q: 'K-Clean 접수 뒤 이상적인 흐름의 순서대로 눌러 보세요.', items: ['접수', '기관 배정', '담당 부서·담당자', '대응 진행', '결과'], why: '지금 화면은 접수·처리중·완료 3단계 표시까지이고 기관·담당자별 실시간 통보는 준비 중입니다. 받은 소식이 없으면 “아직 배정 소식이 없습니다”라고 말합니다.' },
    { k: 'pick', name: '한계 알기', v: [
      { q: 'K-Watch에게 “실제로 접수해 줘”라고 했습니다. 알맞은 반응은?', opts: ['자동 접수 연동은 아직 없고 서식 작성과 안내까지라고 알려 준다', '기관 시스템에 자동 접수한다', '신고 대상자의 신원을 확인해 알려 준다'], a: 0, why: 'K-Watch는 신고 대상자의 신원을 확인하거나 특정하지 않고 기관이 공개하지 않은 처리 결과도 추정하지 않습니다.' },
      { q: '말로 “쓰레기 문제예요”라고만 했는데 신고인지 제안인지 애매합니다. K-Clean은?', opts: ['한 번 되묻는다', '무조건 신고로 처리한다', '무조건 제안으로 처리한다'], a: 0, why: '제안은 1~2문장으로 정리해 담당 부서에 전하며 견적·출동은 만들지 않습니다.' },
      { q: '신고자의 현재 위치와 사진 속 현장 위치가 다르면 K-Clean은?', opts: ['처리를 막지 않고 신고서에 “대리신고”로 표시한다', '접수를 거부한다', '위치를 임의로 고친다'], a: 0, why: '사진이 흐리거나 판단이 어려우면 판단 유보로 다시 찍어 달라고 합니다.' }] }
  ] });

S('ch_ksvc_life', { n: 61, short: '생활·사업 K-서비스', focus: '시뮬레이션이 맡는 것: 대화가 열린 서비스와 준비 중인 서비스를 가르고, 나비가 안내까지만 하는 일과 내가 직접 마치는 일을 가려 봅니다. K-Biz·K-City는 준비 중이고 K-City는 초안 단계입니다.',
  say: ['한림읍 단독주택 전세를 알아보고 있어요.', '요금제를 줄여서 비용을 아끼고 싶어요.', '사업자 등록부터 영업신고까지 순서를 알려 줘.'],
  steps: [
    { k: 'sort', name: '지금 상태', q: '지금 대화가 열려 있을까요?', buckets: ['대화 가능', '준비 중(입력창 잠김)'], items: [['K-Estate(부동산)', 0], ['K-Telecom(통신)', 0], ['K-Biz(사업자)', 1], ['K-City(도시 설계)', 1]], why: '준비 중 서비스는 입력창이 잠기고 “○○ 서비스의 대화 상담은 준비 중입니다.”라고 나오는 것이 정상입니다.' },
    { k: 'pick', name: '누가 마치나', v: [
      { q: '“지금 바로 요금제를 바꿔줘.”라고 했습니다. 알맞은 안내는?', opts: ['본인인증이 필요한 최종 실행은 통신사 앱이나 대리점에서 직접 한다', '나비가 대신 끝낸다', '인증 없이 바로 바뀐다'], a: 0, why: '개통·명의변경·해지·유심 재발급 확정은 나비가 대신 끝냈다고 말하지 않습니다.' },
      { q: '계약서 조항이 불리한지 검토해 달라고 했습니다. K-Estate는?', opts: ['K-Law로 안내한다(법적 검토는 K-Estate의 일이 아니다)', '직접 법적 검토를 한다', '계약을 대신 체결한다'], a: 0, why: '취득세 등은 K-Tax, 전입신고·확정일자는 K-Public, 월세 자동이체 계좌 설정은 금융 서비스로 안내합니다.' },
      { q: '휴대폰을 잃어버렸습니다. K-Telecom의 안내는?', opts: ['임시 정지 절차를 바로 안내하고 실제 정지는 통신사 앱·고객센터(114 등)로 이어진다', '나비가 직접 정지시킨다', '다음 날 접수한다'], a: 0, why: '실제 정지는 통신사 쪽에서 이루어집니다.' }] },
    { k: 'order', name: '사업 절차 순서', q: 'K-Biz가 안내하려는 절차를 원문에 나온 순서대로 눌러 보세요.', items: ['사업자등록', '위생교육', '영업신고', '소방시설 완비증명', '원산지표시판 등록'], why: '순서가 꼬이면 접수가 안 되는 절차를 안내하는 서비스입니다. 직원을 뽑으면 4대보험 성립신고가 더해져요. 지금은 대화 상담이 열리지 않았습니다.' }
  ] });

S('ch_account_access', { n: 62, short: '로그인·동의·권한', focus: '시뮬레이션이 맡는 것: 공유 로그인의 흐름과 동의 화면 판단, 권한 용도를 가상 장면으로 연습합니다. 실제 로그인·로그아웃과 동의는 연습 예제의 몫이며 여기서는 아무것도 바뀌지 않습니다.',
  say: ['다른 서비스에서 또 로그인하라고 하는데 왜 그래?', '이 서비스가 내 기록을 보겠다는데 괜찮은 거야?', '카메라 권한은 어디에 쓰이는 거야?'],
  steps: [
    { k: 'order', name: '로그인 공유 확인', q: '공유 세션을 확인하는 순서대로 눌러 보세요.', items: ['나비웹에 로그인한다', '새 탭으로 plan.naviweb.kr을 열어 첫 화면을 본다', '기능을 눌러 다시 로그인하라고 하지 않는지 본다', '나비웹 설정에서 로그아웃한다', 'K-Plan 탭을 새로 고쳐 로그인을 요구하는지 본다'], why: '한 곳에서 로그인하면 다른 곳에서 다시 인증하지 않고, 한 곳에서 로그아웃하면 공유 세션이 함께 끝납니다. 다시 로그인하려면 폰 승인이 필요해요.' },
    { k: 'pick', name: '동의 화면 판단', v: [
      { q: '처음 보는 서비스가 넓은 범위의 기록을 오래 보겠다고 요청합니다. 알맞은 판단은?', opts: ['모르는 서비스면 거부하고, 범위는 넓을수록 기간은 필요한 만큼만 신중히 본다', '바로 동의한다', '기간만 본다'], a: 0, why: '요청 서비스·조회 범위·조회 기간 세 가지를 읽고 판단합니다.' },
      { q: '동의 화면에 “문제가 발생했습니다”가 떴습니다. 어떻게 할까요?', opts: ['동의하지 않고 요청한 서비스에 다시 시도해 달라고 한다', '동의하고 계속하기를 누른다', '무시하고 닫는다'], a: 0, why: '요청 정보를 불러오지 못한 것이기 때문입니다.' },
      { q: '동의 화면의 “조회 기간”은 무엇을 알려 줄까요?', opts: ['언제까지 내 기록을 보는지', '누가 보는지', '어떤 기록을 보는지'], a: 0, why: '요청 서비스는 누가, 조회 범위는 무엇을, 조회 기간은 언제까지입니다.' }] },
    { k: 'sort', name: '권한 용도', q: '권한 설정 화면에서 이 용도는 어느 권한일까요?', buckets: ['카메라', '마이크', '위치'], items: [['나비 코드 스캔·신원 확인', 0], ['AI 비서 음성 입력', 1], ['주변 서비스 탐색', 2]], why: '권한은 이 기기에만 저장되고 나비 서버로 전송되지 않는다고 화면에 안내됩니다. 처음에는 “대기”이고 나중에 허용해도 돼요.' }
  ] });

S('ch_pay', { n: 63, short: '코드로 결제하고 결제받기', focus: '시뮬레이션이 맡는 것: 가상 코드·금액으로 보내기 전 확인하는 습관을 반복합니다. 실제 GDC 이체는 하지 않습니다. 잘못 보낸 이체를 되돌리는 방법은 확인되지 않았습니다.',
  say: ['코드로 결제하려면 어떻게 해?', '내 결제받기 코드를 보여 줘.', '아메리카노 2잔 값을 보내려고 해.'],
  steps: [
    { k: 'order', name: '결제하기', q: '코드로 결제하는 순서대로 눌러 보세요.', items: ['폰 앱 왼쪽 메뉴에서 코드로 결제를 연다', '판매자의 나비 코드 10자리를 입력한다', '결제 금액(GDC)과 품목/메모를 적는다', '코드 10자리와 금액을 눈으로 한 번 더 확인한다', '단추가 켜지면 결제하기를 누른다'], why: '판매자 코드 10자리가 확인되기 전에는 결제하기 단추가 흐리게 잠겨 있습니다.' },
    { k: 'pick', name: '이런 때', v: [
      { q: '코드를 입력했는데 결제하기 단추가 흐립니다. 왜일까요?', opts: ['판매자 코드 10자리가 아직 확인되지 않았다', '결제가 끝났다', '금액이 너무 크다'], a: 0, why: '코드가 확인되면 단추가 켜집니다.' },
      { q: '보낸 뒤 코드를 한 자리 잘못 적은 것을 알았습니다. 알려진 방법은?', opts: ['되돌리는 방법이 확인되지 않았으니 보내기 전에 확인했어야 한다', '버튼 하나로 취소된다', '상대가 자동으로 돌려준다'], a: 0, why: '새 가게에서는 판매자 이름이 맞는지도 보고 보냅니다.' },
      { q: '결제받기 화면에 “지갑 정보를 아직 못 불러왔다”는 안내가 나옵니다. 먼저 확인할 것은?', opts: ['폰 앱에 로그인했는지', '카드 한도', '상호명 입력'], a: 0, why: '상호명은 선택입니다.' }] },
    { k: 'sort', name: '사는 쪽 · 받는 쪽', q: '이 행동은 어느 쪽일까요?', buckets: ['결제하기(사는 사람)', '결제받기(파는 사람)'], items: [['판매자의 코드를 입력한다', 0], ['손님께 내 코드를 보여 준다', 1], ['품목/메모를 적는다', 0], ['상호명(선택)을 적는다', 1]], why: '카드 수수료가 없는 GDC 지갑 간 직접 이체입니다. 플랜 이용료는 GDC가 아니라 계좌 입금이에요.' }
  ] });

S('ch_schedule_group', { n: 64, short: '일정 관리와 모임', focus: '시뮬레이션이 맡는 것: 입력 항목과 오류 안내를 가려 보고 모임에 쓰지 말아야 할 정보를 판단합니다. 실제 일정·모임 생성은 연습 예제의 몫이며, 알림·달력 연동은 확인되지 않았고 K-Social-Match는 설계 단계입니다.',
  say: ['건강검진 예약을 일정에 넣어 줘.', '제주 등산 모임을 만들고 싶어.', '나랑 맞는 모임을 알아서 찾아 줘.'],
  steps: [
    { k: 'sort', name: '입력 항목', q: '이 항목은 일정일까요, 모임일까요?', buckets: ['일정 관리', '모임'], items: [['제목(예: 건강검진 예약)', 0], ['일시', 0], ['카테고리(예: 운동, 독서, 육아)', 1], ['모임 이름(예: 제주 등산 모임)', 1]], why: '일정은 제목·일시·메모(선택), 모임은 이름·카테고리·소개(선택)를 적습니다.' },
    { k: 'pick', name: '안내 문구', v: [
      { q: '제목을 비워 두고 일정 추가를 눌렀습니다. 어떻게 될까요?', opts: ['“제목을 입력해 주세요.”가 나온다', '제목 없는 일정이 저장된다', '저절로 제목이 붙는다'], a: 0, why: '메모는 선택이지만 제목은 꼭 적어야 합니다.' },
      { q: '“지갑 정보를 아직 불러오지 못했습니다.”가 먼저 나왔습니다. 확인할 것은?', opts: ['폰 앱에 로그인했는지', '제목을 길게 쓰기', '모임 카테고리'], a: 0, why: '지갑 로그인이 안 된 상태에서 나오는 안내입니다.' },
      { q: '“나랑 취향이 맞는 모임을 알아서 맞춰 줘”라고 하면 이 화면은?', opts: ['자동 매칭은 없고 사용자가 직접 만든 모임 목록에서 참여한다', '알고리즘으로 맞춰 준다', 'K-Social-Match가 바로 추천한다'], a: 0, why: 'K-Social-Match는 설계 단계라 지금은 잠겨 있습니다.' }] },
    { k: 'pick', name: '소개 쓰기', q: '모임 소개에 쓰기 알맞은 것은?', opts: ['모임 목적과 활동 요일처럼 공개되어도 되는 내용', '실명과 전화번호', '집 주소'], a: 0, why: '모임 이름과 소개는 다른 사람도 볼 수 있으니 실명·연락처는 적지 않습니다. 참여한 뒤 대화는 나비 채팅으로 이어갑니다.' }
  ] });

S('ch_suggest', { n: 65, short: '의견 보내기', focus: '시뮬레이션이 맡는 것: 글이 제안인지 질문인지 가리고 게시판에 남기면 안 되는 내용을 가려 봅니다. 실제 글은 연습 예제에서 하나만 남기며, 여기서는 아무것도 게시되지 않습니다.',
  say: ['서류 작성에서 만든 서류는 어디에 저장되나요?', '이런 기능이 있으면 좋겠어요: 서류 자동 저장.', '질문인지 제안인지 모르겠어요.'],
  steps: [
    { k: 'sort', name: '제안 · 질문', q: '이 글은 어느 쪽일까요?', buckets: ['제안', '질문'], items: [['이런 기능이 있으면 좋겠어요: 서류 자동 저장.', 0], ['서류 작성에서 만든 서류는 어디에 저장되나요?', 1], ['이 버튼이 불편하니 위치를 바꿨으면 좋겠어요.', 0], ['최신 개발 현황이 궁금해요. 지금 어디까지 됐나요?', 1]], why: '질문에는 최신 개발 현황을 담은 저장소 요약을 바탕으로 답합니다. 모르겠으면 입력 방식을 자동 구분으로 두세요.' },
    { k: 'pick', name: '게시판에 남나', v: [
      { q: 'AI와 의도가 확인되지 않은 채 대화를 닫았습니다. 게시판에는?', opts: ['대화로 의도가 확인된 글만 기록되므로 남지 않을 수 있다', '무조건 기록된다', '관리자가 대신 쓴다'], a: 0, why: '게시판은 최신 글이 위에 오고 전체·제안·질문으로 거릅니다.' },
      { q: '게시판에 남기는 글에 쓰지 말아야 할 것은?', opts: ['이름·연락처·번호', '궁금한 점', '불편한 점'], a: 0, why: '게시판 글은 다른 사람도 볼 수 있습니다.' }] },
    { k: 'pick', name: '법률 검토 탭', q: '법률 검토 모드에서 서류를 점검했더니 문제없다고 합니다. 어떻게 받아들일까요?', opts: ['참고용이며 인간 변호사 자문을 대체할 수 없다', '변호사 자문과 같다', '법적 효력이 확정된 것이다'], a: 0, why: '화면에도 참고용이며 자문을 대체할 수 없다는 안내가 함께 표시됩니다.' }
  ] });

S('ch_sites', { n: 66, short: '직역 서류 사이트 한눈에', focus: '시뮬레이션이 맡는 것: 서류에 알맞은 사이트를 고르고 사이트별 주의점을 가려 봅니다. 가상 서류만 다루며 실제로 제출하지 않습니다.',
  say: ['내용증명 서류를 쓰고 싶어요.', '결석계를 써 줘.', '의견제출통지서에 대한 의견서를 작성해야 해요.'],
  steps: [
    { k: 'sort', name: '어느 사이트', q: '이 서류는 어느 사이트에서 쓸까요?', buckets: ['법률(나비로)', '세무·회계', '병원·의원', '특허·상표(나비 특허)', '학교(나비 스쿨)'], items: [['소유권이전등기 신청서', 0], ['부가가치세 신고서', 1], ['소견서', 2], ['의견제출통지서에 대한 의견서', 3], ['결석계', 4]], why: '화면 틀은 같고 서류 이름과 접수처만 다릅니다. 입력창 왼쪽 서류 종류 ▾에서 사이트를 바꿉니다.' },
    { k: 'pick', name: '사이트별 주의', v: [
      { q: '세무·회계 사이트에서 신고서를 작성했습니다. 실제 신고와 납부는?', opts: ['국세청 시스템에서 하며 세무 판단은 세무사 확인이 필요하다', '나비웹에서 자동으로 된다', '필요 없다'], a: 0, why: '서류 작성은 돕지만 신고·납부는 국세청 시스템에서 합니다.' },
      { q: '병원·의원 사이트의 진단서 초안은?', opts: ['면허가 있는 의사가 확인·서명해야 하는 서류다', 'AI가 서명하면 된다', '본인이 서명해도 효력이 있다'], a: 0, why: '의사용 흐름은 전문가 인증과 서류 작성에서 처방전으로 따라갑니다.' },
      { q: '특허·상표 사이트에서 의견서를 쓰기 전에 먼저 준비할 것은?', opts: ['심사관 통지서의 거절 이유가 담긴 통지서 내용', '법원 소장', '진단서'], a: 0, why: '의견서는 통지서의 거절 이유에 대응하는 서류입니다.' },
      { q: '감정평가 사이트의 AI 초안은?', opts: ['정리 용도이며 평가 방법과 결과는 감정평가사의 전문 판단이다', '확정된 감정평가서다', '의뢰인이 서명하면 된다'], a: 0, why: '법률 사이트는 법적 효력과 제출 방법을 법원·등기소 또는 법무사·변호사에게 확인합니다.' }] },
    { k: 'sort', name: '같은 것 · 다른 것', q: '사이트가 달라지면 이 항목은 어떻게 될까요?', buckets: ['같다', '다르다'], items: [['서류 이름을 치면 서식이 펼쳐지는 방식', 0], ['서류 이름과 서식 항목', 1], ['성명·주소·연락처를 PDV에서 가져와 파란 칸으로 채우는 방식', 0], ['서류를 내는 곳(접수처)', 1], ['Draft에 실시간 자동 저장되는 방식', 0]], why: '다른 사람의 서류를 쓸 때는 파란 칸이 그 사람의 정보인지 확인합니다. 제출 결과 예상은 참고용이며 보장하지 않아요.' }
  ] });

S('ch_capstone', { n: 67, short: '종합 실습과 졸업 점검', focus: '시뮬레이션이 맡는 것: 가상의 책 모임 시나리오 전체 순서와 안전 수칙을 한 번에 점검합니다. 실제 실습은 내 다른 메일 주소로 하고 제출은 하지 않으며, 막히는 단계는 해당 장으로 돌아갑니다.',
  say: ['다음 달 동네 책 모임을 준비하고 싶어.', '모임 안내 메일을 써서 내 다른 주소로 보내 줘.', '이 서류를 말로 고치고 되돌리고 싶어.'],
  steps: [
    { k: 'order', name: '책 모임 준비', q: '시나리오 “다음 달 동네 책 모임 준비”의 순서대로 눌러 보세요.', items: ['접속', '나비 길잡이로 계획서', '말로 메일 보내기', '주소록에 태그', '서류 작성', '말로 고치고 되돌리기, 전달', '내 서류함에 담기', '업무(나 홀로)에 메일 기록·기한', '계획서 완료·업무 종료·보관'], why: '막히는 단계는 앞의 해당 장으로 돌아가 다시 해 보세요. 연습은 내 다른 메일 주소로 하고 제출은 하지 않아요.' },
    { k: 'sort', name: '안전 수칙', q: '이 정보는 어떻게 다룰까요?', buckets: ['AI에게 말하지 않고 직접 입력', '보내기 전에 읽고 확인'], items: [['주민등록번호', 0], ['카드·계좌 번호', 0], ['비밀번호', 0], ['받는 사람 주소', 1], ['날짜·금액·당사자', 1]], why: '중요한 결정은 사람 전문가와 상의합니다.' },
    { k: 'pick', name: '졸업 점검', v: [
      { q: '실습 메일의 받는 사람으로 알맞은 것은?', opts: ['내 다른 메일 주소', '모임 참여 예정자 모두', '모르는 주소'], a: 0, why: '연습은 내 다른 메일 주소로 하고 제출은 하지 않습니다.' },
      { q: '새로 알게 된 점이나 불편한 점은 어디에 남길까요?', opts: ['위쪽 바의 기능 개선 제안', '메일 본문', '모임 소개'], a: 0, why: '고급 장에서는 내 양식 만들기, 자동화 같은 기술을 다룹니다.' },
      { q: '중요한 결정을 앞두고 나비가 의견을 주었습니다. 알맞은 행동은?', opts: ['사람 전문가와 상의한다', '나비 말만 따른다', '아무에게도 묻지 않는다'], a: 0, why: '중요한 결정은 사람 전문가와 상의하는 것이 안전 수칙입니다.' }] }
  ] });

/* ══ 시나리오: 고급 18~28장 묶음(지식 노동 ~ BYOK) ═══════════════════ */
S('ch18', { n: 68, short: '사람과 AI의 분업', focus: '시뮬레이션이 맡는 것: 가상의 일 목록을 AI 몫과 사람 몫으로 나눠 보는 연습입니다. 개념 장이라 연습 예제 없이 이 분류가 실습이며, 일 목록은 모두 가상입니다.',
  say: ['이번 달 영수증 정리해 줘.', '거래처 계약서 초안 좀 만들어 줘.', '이 계약 승인해도 될지 같이 봐 줘.'],
  steps: [
    { k: 'sort', name: 'AI 몫 · 사람 몫', q: '이 일은 누구의 몫일까요?', buckets: ['AI가 맡는 일', '사람이 맡는 일'], items: [['흩어진 자료를 한곳에 취합하기', 0], ['문서 초안 작성하기', 0], ['같은 질문에 반복해서 답하기', 0], ['제출된 서류를 1차로 걸러 보기', 0], ['최종 판단 내리기', 1], ['책임이 따르는 승인하기', 1], ['어려운 처지에 놓인 사람과 감정으로 소통하기', 1], ['창의적인 결정 내리기', 1]], why: '반복적이고 정형화된 일은 AI, 판단과 책임이 필요한 일은 사람의 몫입니다.' },
    { k: 'order', name: '서류 한 건의 흐름', q: '가상의 신청서 한 건이 처리되는 순서대로 눌러 보세요.', items: ['AI가 필요한 자료를 취합한다', 'AI가 초안을 쓰고 1차로 검토한다', '사람이 내용을 확인하고 판단한다', '사람이 책임지고 최종 승인한다'], why: '반복 작업(취합·초안·1차 검토)은 AI가 넘겨받고, 마지막 판단과 승인은 사람이 합니다.' },
    { k: 'pick', name: '맡겨도 될까', gen: function (r) { var t = shuf(['가상의 신입 직원 채용 최종 결정', '가상의 환불 분쟁에서 양쪽 감정을 달래는 대화', '가상의 대출 한도 최종 승인'], r)[0]; return { q: '“' + t + '”을(를) 나비에게 완전히 맡기려 합니다. 이 장의 분업에 맞는 선택은?', opts: ['초안·자료는 도움받되 최종 판단과 승인은 사람이 한다', '판단까지 전부 AI에게 맡긴다', '아예 AI를 쓰지 않는다'], a: 0, why: 'AI가 사람을 완전히 대체하기보다 반복 작업을 넘겨받아 사람이 더 중요한 일에 집중하게 돕는 분업입니다. 최종 판단·책임 있는 승인은 사람의 몫이에요.' }; } }
  ] });

S('ch19', { n: 69, short: '나비마켓', focus: '시뮬레이션이 맡는 것: 가상 도구 이름과 가상 금액으로 탐색 → 구매 → 판매 흐름을 순서와 분류로 연습합니다. 실제 구매·등록은 연습 예제에서 하며, 여기서는 돈이 오가지 않습니다.',
  say: ['나비마켓에 어떤 AI 도구가 있어?', '이력서 도와주는 도구 찾아 줘.', '내가 만든 도구를 팔고 싶어.'],
  steps: [
    { k: 'order', name: '구매 순서', q: '도구를 사는 순서대로 눌러 보세요.', items: ['필요한 AI 도구·SP를 검색하거나 카테고리로 둘러본다', '마음에 드는 도구를 고른다', 'GDC로 즉시 구매한다'], why: '탐색 → GDC로 구매 순서입니다. 내가 만든 도구를 등록하면 판매자도 될 수 있어요.' },
    { k: 'sort', name: '구매자 · 판매자', q: '누구에게 해당하는 일일까요?', buckets: ['구매자', '판매자'], items: [['카테고리별로 도구를 둘러본다', 0], ['GDC로 도구를 사 본다', 0], ['내가 만든 도구를 등록한다', 1], ['구매자 리뷰를 받아 나비 온도가 오르내린다', 1]], why: '둘러보고 사는 것은 구매자, 등록하고 거래 실적과 리뷰를 쌓는 것은 판매자입니다. 판매자가 되면 나비 온도가 오르내리기 시작해요.' },
    { k: 'pick', name: '리뷰가 쌓이면', gen: function (r) { var n = ri(r, 3, 9); return { q: '가상의 판매자 “한라도구”가 도구를 팔아 구매자 리뷰 ' + n + '건을 받았습니다. 이 장에 따르면 무엇이 달라지기 시작할까요?', opts: ['나비 온도가 오르내린다', '결제 수단이 GDC에서 바뀐다', '도구가 자동으로 삭제된다'], a: 0, why: '거래 실적과 구매자 리뷰가 쌓이면서 나비 온도가 오르내립니다. 결제는 계속 GDC입니다.' }; } }
  ] });

S('ch20', { n: 70, page: ['tax', 'stmts'], short: '판매자 재무제표 자동 생성', focus: '시뮬레이션이 맡는 것: 가상 거래로 재고자산과 매출원가가 갈리는 시점을 계산하고, 재무제표 기록의 변조 흔적을 확인합니다. 실제 재무제표는 연습 예제에서 봅니다.',
  say: ['내 재무제표 보여 줘.', '영수증 찍었어, 장부에 넣어 줘.', '이 손익계산서 조작된 거 아니지?'],
  steps: [
    { k: 'order', name: '자동 생성 순서', q: '재무제표가 만들어지는 순서대로 눌러 보세요.', items: ['판매·매입 내역이 GDC 결제와 함께 자동 기록된다', '기록이 PDV에 쌓인다', '손익계산서·대차대조표·현금흐름표가 자동으로 만들어진다', '신용 평가의 기초 자료로 쓰인다'], why: '거래 기록 → 재무제표 → 신용 평가의 기초 자료 순서입니다.' },
    { k: 'calc', name: '재고와 매출원가', gen: function (r) { var n = ri(r, 8, 20), p = ri(r, 3, 12) * 1000, m = ri(r, 2, n - 2); return { q: '가상의 판매자가 재판매용 상품 ' + n + '개를 개당 ' + won(p) + '원에 사입했고, 그중 ' + m + '개가 팔렸습니다. 이때 매출원가로 반영되는 금액은 얼마일까요?', facts: '사입한 상품은 재고자산으로 잡혔다가, 실제로 팔리는 시점에만 매출원가로 반영됩니다.', a: m * p, tol: 0, unit: '원', why: '팔린 ' + m + '개만 매출원가입니다. ' + m + ' × ' + won(p) + ' = ' + won(m * p) + '원. 남은 ' + (n - m) + '개(' + won((n - m) * p) + '원)는 재고자산으로 남습니다.', hint: '팔린 개수 × 개당 사입가.' }; } },
    { k: 'chain', name: '몰래 고쳐 보기', gen: function (r) { var it = shuf(['가상 판매 도구 A', '가상 판매 도구 B', '가상 사입 상품', '가상 판매 도구 C', '가상 매입 비용'], r).slice(0, 4); return { q: '가상의 재무제표 기록입니다. 줄을 몰래 고치면 어떻게 될까요?', rows: it.map(function (x, k) { return '2026-10-' + (5 + k * 6) + ' ' + x + ' ' + won(ri(r, 3, 30) * 1000) + '원'; }), why: '재무제표가 바뀔 때마다 해시가 Openhash에 기록되기 때문에, 숫자를 몰래 고치면 기록된 해시와 어긋납니다. 실제 화면에서는 손익계산서 탭의 지금 검증 버튼으로 확인합니다.' }; } }
  ] });

S('ch_fs_buyer_symmetric', { n: 71, short: '구매자 재무제표도 자동', focus: '시뮬레이션이 맡는 것: 가상 구매 내역이 매입(비용)으로 합쳐지는 것을 계산하고 판매·구매 양쪽 기록을 가려 봅니다. 금액은 모두 가상입니다.',
  say: ['내가 산 도구가 장부에 들어갔어?', '매입 항목을 직접 입력해야 해?', '사기만 해도 재무제표가 생겨?'],
  steps: [
    { k: 'sort', name: '어느 쪽 기록일까', q: '재무제표에서 어느 항목에 반영될까요?', buckets: ['매출 쪽(판매)', '매입(비용) 쪽(구매)'], items: [['내 도구를 팔고 GDC를 받음', 0], ['다른 판매자의 도구를 GDC로 구매함', 1], ['재료 격인 AI 도구를 사서 지출함', 1], ['구매자가 내 도구에 대금을 냄', 0]], why: '팔아서 받은 것은 판매 기록, 산 지출은 구매자 쪽 재무제표의 매입(비용)입니다. 둘 다 PDV 거래 기록에서 자동 반영됩니다.' },
    { k: 'calc', name: '매입 합계', gen: function (r) { var a = ri(r, 2, 9) * 1000, b = ri(r, 3, 12) * 1000, c = ri(r, 1, 8) * 1000; return { q: '가상의 구매자가 나비마켓에서 ' + won(a) + '원, ' + won(b) + '원, ' + won(c) + '원짜리 도구를 샀습니다. 손익계산서 매입(비용)에 자동으로 잡히는 합계는?', a: a + b + c, unit: '원', why: won(a) + ' + ' + won(b) + ' + ' + won(c) + ' = ' + won(a + b + c) + '원. 직접 입력할 필요 없이 거래 기록에서 자동 반영됩니다.', hint: '세 금액을 더하세요.' }; } },
    { k: 'pick', name: '직접 입력해야 할까', gen: function (r) { var x = ri(r, 5, 30) * 1000; return { q: '가상의 구매자가 ' + won(x) + '원을 지출했는데 손익계산서 매입 항목을 보니 이미 들어 있습니다. 이때 알맞은 행동은?', opts: ['금액을 확인만 하고, 필요하면 지금 검증 버튼으로 무결성을 확인한다', '같은 금액을 한 번 더 입력한다', '매입은 자동으로 안 되니 지운다'], a: 0, why: '매입은 거래 기록에서 자동 반영되므로 다시 입력하면 중복이 됩니다. 필요하면 Openhash 기록과 맞는지 검증합니다.' }; } }
  ] });

S('ch_fsverify', { n: 72, short: '재무제표 무결성 검증', focus: '시뮬레이션이 맡는 것: 검증 결과 화면의 여러 경우를 읽고 판단하는 연습입니다. 결과 문구는 가상이며, 실제 검증은 대시보드 재무제표 탭의 지금 검증 버튼에서 합니다.',
  say: ['이 재무제표가 조작 안 됐는지 확인해 줘.', '지금 검증 눌렀는데 아직 앵커링 전이래.', '검증이 실패했는데 어떡해?'],
  steps: [
    { k: 'order', name: '검증 순서', q: '재무제표를 직접 검증하는 순서대로 눌러 보세요.', items: ['대시보드의 재무제표 탭을 연다', '확인할 재무제표(손익계산서 등)를 연다', '무결성 검증 카드의 지금 검증 버튼을 누른다', '두 가지 결과(데이터↔해시, 앵커↔머클루트)를 읽는다'], why: '탭 열기 → 확인할 표 열기 → 지금 검증 → 결과 읽기 순서입니다.' },
    { k: 'pick', name: '결과 읽기', gen: function (r) { var c = [['데이터↔해시 일치: 예 / 앵커↔머클루트 일치: 예', 0, '두 가지가 모두 예이면 조작되지 않았다는 뜻입니다.'], ['아직 앵커링 전(방금 숫자를 바꾼 직후)', 1, 'Openhash에 기록되기까지 최대 10분 정도 걸릴 수 있어 정상적인 대기 상태입니다. 잠시 후 다시 확인합니다.'], ['데이터↔해시 일치: 아니요', 2, '화면 숫자가 기록과 달라졌을 수 있다는 신호입니다. 그 재무제표를 근거로 한 신용 평가·세금 계산을 다시 확인해야 합니다.']], x = shuf(c, r)[0]; return { q: '가상의 검증 결과가 이렇게 나왔습니다: “' + x[0] + '”. 가장 알맞은 해석은?', opts: ['조작되지 않았다', '오류가 아니라 잠시 후 다시 확인하면 되는 대기 상태', '화면 숫자가 기록과 달라졌을 수 있어 그 위의 판단을 다시 확인해야 한다'], a: x[1], why: x[2] }; } },
    { k: 'chain', name: '숫자를 몰래 고쳐 보기', gen: function (r) { return { q: '가상의 손익계산서 기록입니다. 줄 하나를 몰래 고치면 어디부터 어긋나는지 보세요.', rows: ['매출 ' + won(ri(r, 20, 50) * 10000) + '원', '매입 ' + won(ri(r, 5, 15) * 10000) + '원', '판매 수수료 ' + won(ri(r, 1, 5) * 10000) + '원', '당기순이익 계산'], why: '숫자가 바뀌면 다시 계산한 해시가 기록된 해시와 달라져 검증이 실패합니다. 이 연결 방식은 장의 원리를 보여 주는 단순한 모형이에요.' }; } }
  ] });

S('ch21', { n: 73, page: ['bank', 'credit'], short: '재무제표 기반 신용 평가', focus: '시뮬레이션이 맡는 것: 가상 판매자 두 명을 두고 신용 평가가 보는 요소를 분류·판단합니다. 등급 구간과 점수는 원문에 없으므로 쓰지 않으며, 실제 등급은 은행 화면의 신용 탭에서 봅니다.',
  say: ['내 신용 등급이 어떻게 정해져?', '서류 안 내도 평가가 돼?', '온도가 낮으면 등급도 낮아져?'],
  steps: [
    { k: 'sort', name: '평가에 쓰이는 것', q: '이 항목은 신용 평가에서 어떻게 쓰일까요?', buckets: ['재무제표 분석', '나비 온도', '쓰이지 않음(따로 낼 필요 없음)'], items: [['매출 안정성', 0], ['거래 빈도', 0], ['수익성', 0], ['거래 신뢰도', 1], ['은행에 따로 제출하는 증빙 서류', 2]], why: '재무제표에서 매출 안정성·거래 빈도·수익성을 분석하고, 나비 온도(거래 신뢰도)를 함께 반영합니다. 이미 쌓인 실제 거래 데이터로 평가하므로 서류를 따로 낼 필요가 없습니다.' },
    { k: 'order', name: '등급이 나오기까지', q: '신용 등급이 정해져 쓰이는 순서대로 눌러 보세요.', items: ['자동 생성된 재무제표가 쌓인다', 'AI가 재무 데이터를 분석한다', '나비 온도를 함께 반영한다', '종합 점수로 신용 등급이 매겨진다', '등급이 채권 이자율에 영향을 준다'], why: '재무제표 분석과 나비 온도를 종합해 등급을 매기고, 그 등급이 채권 이자율에 영향을 줍니다.' },
    { k: 'pick', name: '두 가상 판매자', gen: function (r) { var a = ['가나', '다라'][ri(r, 0, 1)]; return { q: '가상의 판매자 ' + a + '는 매출이 꾸준하고 수익성도 좋지만 거래 후기가 나빠 나비 온도가 낮습니다. 신용 평가는 어떨까요?', opts: ['온도도 함께 반영되므로 숫자만으로 매길 때보다 낮을 수 있다', '매출이 좋으니 온도는 상관없다', '온도가 낮으면 평가에서 제외된다'], a: 0, why: '재무제표와 나비 온도를 함께 봅니다. 온도가 낮으면 숫자만 볼 때보다 등급이 낮게 나올 수 있어요.' }; } }
  ] });

S('ch_temp_credit', { n: 74, short: '나비 온도와 신용 점수', focus: '시뮬레이션이 맡는 것: 숫자(재무제표)와 평판(온도)의 조합을 가상 사례로 판단해 봅니다. 구체적 점수 공식은 원문에 없어 사용하지 않으며, 등급 방향만 다룹니다.',
  say: ['온도랑 신용은 같은 거야?', '후기가 나쁘면 이자도 올라?', '숫자만 좋으면 최고 등급이야?'],
  steps: [
    { k: 'sort', name: '평판 · 숫자 · 결과', q: '이 말은 어디에 해당할까요?', buckets: ['온도(사람들이 겪은 신뢰)', '재무제표(숫자로 본 안정성)', '이어지는 결과'], items: [['실제 거래한 사용자들의 평가가 쌓인 결과', 0], ['36.5도에서 시작하는 거래 신뢰 지표', 0], ['매출과 매입 같은 객관적 숫자', 1], ['신용 등급을 거쳐 채권 이자율까지 영향을 받음', 2]], why: '온도는 평판, 재무제표는 숫자입니다. 둘이 함께 신용 등급에 들어가고, 등급은 채권 이자율로 이어집니다.' },
    { k: 'pick', name: '조합 판단', gen: function (r) { var c = [['매출은 꾸준한데 온도가 낮은', '숫자만 볼 때보다 낮게 나올 수 있다'], ['숫자도 좋고 온도도 높은', '최고 등급을 받기에 가장 유리하다'], ['온도는 높은데 재무제표 숫자가 불안정한', '숫자 쪽이 약해 최고 등급은 어렵다']], x = shuf(c, r)[0]; var o = ['숫자만 볼 때보다 낮게 나올 수 있다', '최고 등급을 받기에 가장 유리하다', '숫자 쪽이 약해 최고 등급은 어렵다']; return { q: '가상의 판매자는 ' + x[0] + ' 경우입니다. 신용 등급 방향은?', opts: o, a: o.indexOf(x[1]), why: '숫자와 평판 중 한쪽만 좋아서는 최고 등급을 받기 어려운 구조입니다. 둘을 함께 봅니다.' }; } },
    { k: 'order', name: '온도에서 이자율까지', q: '흐름 순서대로 눌러 보세요.', items: ['나비마켓에서 거래하고 리뷰를 주고받는다', '그에 따라 온도가 오르내린다', '온도가 재무제표 분석과 함께 신용 등급에 반영된다', '신용 등급이 채권 이자율에 영향을 준다'], why: '거래·리뷰 → 온도 변화 → 재무제표와 종합 → 등급 → 채권 이자율 순서입니다.' }
  ] });

S('ch22', { n: 75, page: ['bank', 'credit'], short: '신용 등급과 채권 이자율', focus: '시뮬레이션이 맡는 것: 가상 등급 두 개를 비교해 이자율 방향을 판단합니다. 실제 등급별 기준 금리 수치는 원문에 없어 쓰지 않으므로 방향(높을수록 낮음)만 연습합니다.',
  say: ['신용이 높으면 이자가 왜 낮아?', '내 이자율은 어떻게 정해져?', '채권은 어떻게 발행해?'],
  steps: [
    { k: 'pick', name: '높은 쪽은 어디', gen: function (r) { var g = shuf(['가', '나', '다'], r), hi = ri(r, 0, 1) === 0; return { q: '가상의 발행자 ' + g[0] + '의 신용 등급이 발행자 ' + g[1] + '보다 ' + (hi ? '높습니다' : '낮습니다') + '. 이자율은 누가 더 낮을까요?', opts: ['발행자 ' + g[0], '발행자 ' + g[1], '등급과 이자율은 무관하다'], a: hi ? 0 : 1, why: '신용이 높을수록 상환 가능성이 높아 위험이 낮으므로 더 낮은 이자율로 자금을 조달할 수 있습니다.' }; } },
    { k: 'order', name: '이자율이 정해지는 순서', q: '채권 이자율이 정해져 쓰이는 순서대로 눌러 보세요.', items: ['신용 등급 구간마다 기준 금리가 정해진다', '거래 이력의 일관성·성장세에 따라 미세 조정된다', '이자율이 확정된다', '확정된 이자율로 채권을 발행해 자금을 조달한다'], why: '등급별 기준 금리 → 개별 조정 → 확정 → 채권 발행 순서입니다.' },
    { k: 'sort', name: '이자율을 움직이는 것', q: '이 요소는 이자율에 어떻게 작용할까요?', buckets: ['기준 금리를 정함', '미세 조정함'], items: [['신용 등급 구간', 0], ['거래 이력의 일관성', 1], ['거래 이력의 성장세', 1]], why: '등급 구간마다 기본 이자율이 있고, 일관성·성장세가 이를 조금씩 조정합니다.' }
  ] });

S('ch_bondpool', { n: 76, short: '채권 POOL 투자(체험판)', focus: '시뮬레이션이 맡는 것: 이 장 자체가 라이선스 컨소시엄 이전 전의 개념 시연이라 실제 자금이 오가지 않습니다. 여기서도 가상의 GDC로 POOL의 위험 분산과 위험·이자율 맞교환을 계산·판단해 보는 설계 단계 연습입니다.',
  say: ['채권에 투자하려면 어떻게 해?', 'POOL이 뭐야?', '글로벌 POOL은 왜 이자가 낮아?'],
  steps: [
    { k: 'pick', name: '지금 가능한 일', q: '채권 POOL 기능에 대한 설명으로 맞는 것은?', opts: ['실제 자금은 오가지 않는 개념 시연(시뮬레이션)이다', '지금 바로 실제 투자·발행이 된다', '한림읍 POOL만 실제로 열려 있다'], a: 0, why: '라이선스 컨소시엄 이전이 끝나기 전까지는 실제 투자·발행을 할 수 없고, 특허 출원 문서에 설계된 개념을 미리 보여 주는 체험판입니다.' },
    { k: 'calc', name: '한 명이 부도나면', gen: function (r) { var x = ri(r, 2, 9) * 100000; return { q: '(가정) 가상의 GDC ' + won(x) + '를 한림읍 POOL의 발행자 18명에게 똑같이 나눠 투자했습니다. 한 명이 전액 부도나면 잃는 금액은?', facts: '한림읍 POOL은 발행자 18명(위험 매우 높음)입니다. 균등 분산은 이 문제를 위한 가정입니다.', a: Math.round(x / 18), tol: 1, unit: 'GDC', why: won(x) + ' ÷ 18 = 약 ' + won(Math.round(x / 18)) + ' GDC. 한 명에게 몰아 투자했다면 ' + won(x) + ' GDC를 모두 잃을 수 있어, POOL로 나누면 손실이 줄어듭니다.', hint: '투자금 ÷ 발행자 수.' }; } },
    { k: 'sort', name: '범위별 특징', q: '이 특징은 어느 POOL에 가까울까요?', buckets: ['좁은 범위(한림읍)', '넓은 범위(글로벌)'], items: [['발행자 18명', 0], ['발행자 230만 명', 1], ['위험이 크게 줄고 이자율은 낮음', 1], ['지역 경기에 함께 흔들리고 이자율은 높음', 0]], why: '범위가 넓어질수록 서로 다른 경기 흐름이 상쇄되어 위험과 이자율이 낮아집니다. 더 큰 수익을 원하면 더 좁은 지역과 더 높은 위험을 감수해야 해요.' }
  ] });

S('ch23', { n: 77, page: ['bank', 'save'], short: '예금·대출 전자동화', focus: '시뮬레이션이 맡는 것: 가상 신청 상황에서 처리 순서와 서류·확인 필요 여부를 판단합니다. 구체 이자율·한도는 원문에 없어 쓰지 않으며, 실제 예금·대출은 은행 화면에서 확인합니다.',
  say: ['여유 돈을 예치하고 싶어.', '대출 신청하면 이자율은 어떻게 돼?', '서류는 안 내도 돼?'],
  steps: [
    { k: 'order', name: '대출 처리 순서', q: '가상의 대출 신청이 처리되는 순서대로 눌러 보세요.', items: ['필요한 자금을 신청한다', '내 신용 등급의 이자율이 자동 적용된다', '쌓인 재무제표와 신용 등급으로 즉시 처리된다', '상환 일정과 이자 계산이 자동으로 관리된다'], why: '신청 → 신용 등급 이자율 자동 적용 → 즉시 처리 → 자동 상환 관리 순서입니다.' },
    { k: 'pick', name: '서류가 필요할까', gen: function (r) { var big = ri(r, 0, 1) === 1; return { q: '가상의 이용자가 ' + (big ? '아주 큰 금액' : '평소 쓰는 정도의 금액') + '을 대출 신청했습니다. 별도 서류 제출은?', opts: ['기본적으로 필요 없지만 큰 금액은 추가 확인이 있을 수 있다', '언제나 서류를 제출해야 한다', '어떤 경우에도 추가 확인이 없다'], a: 0, why: '이미 쌓인 재무제표와 신용 등급으로 즉시 처리되며, 큰 금액은 추가 확인이 있을 수 있습니다.' }; } },
    { k: 'sort', name: '예금 · 대출 · 공통', q: '이 말은 어디에 해당할까요?', buckets: ['예금', '대출', '둘 다 자동'], items: [['여유 자금을 GDC로 예치한다', 0], ['정해진 이자를 받는다', 0], ['내 신용 등급 이자율이 자동 적용된다', 1], ['상환 일정과 이자 계산이 자동 관리된다', 2]], why: '예금은 예치하고 이자를 받고, 대출은 신용 등급 이자율이 적용되며, 이후 관리는 자동으로 이뤄집니다.' }
  ] });

S('ch24', { n: 78, page: ['tax', 'inc'], short: '세금 계산·납부 자동화', focus: '시뮬레이션이 맡는 것: 가상 거래로 재무제표 → 국세청 API → 납부로 이어지는 순서를 연습하고, 최종 신고 전 확인 습관을 판단합니다. 세율은 원문에 없어 다루지 않습니다.',
  say: ['이번 세금 계산해 줘.', '세금은 어떻게 자동으로 내져?', '신고 전에 뭘 확인해야 해?'],
  steps: [
    { k: 'order', name: '세금 처리 순서', q: '자동 처리 순서대로 눌러 보세요.', items: ['자동 생성된 재무제표에서 과세 대상 항목을 정리한다', '정리된 데이터를 국세청 API로 전송해 세액을 계산한다', '최종 신고 전에 내용을 한 번 확인한다', '계산된 세금을 기한 내 GDC(또는 연동 계좌)로 자동 납부한다'], why: '정리 → 국세청 API 계산 → 확인 → 자동 납부 순서입니다. 자동 연동이라 실수는 줄지만 신고 전 확인을 권장합니다.' },
    { k: 'sort', name: '누가 맡나', q: '이 일은 누가 할까요?', buckets: ['자동으로 처리', '내가 확인'], items: [['과세 대상 항목 정리', 0], ['국세청 API로 세액 계산', 0], ['기한 내 자동 납부', 0], ['최종 신고 전 내용 확인', 1]], why: '계산과 납부는 자동이지만, 최종 신고 전 한 번 확인하는 일은 나의 몫으로 권장됩니다.' },
    { k: 'pick', name: '이상한 숫자', gen: function (r) { var v = ri(r, 3, 9) * 100000; return { q: '가상의 재무제표에서 정리된 매입이 평소보다 ' + won(v) + '원 크게 잡혀 있습니다. 신고 전에 알맞은 행동은?', opts: ['원인을 확인하고 필요하면 바로잡은 뒤 신고한다', '자동이니 그냥 넘어간다', '세금 계산을 아예 하지 않는다'], a: 0, why: '자동화로 수기 입력 실수가 줄어도 최종 신고 전 확인을 권장합니다.' }; } }
  ] });

S('ch_taxadvisor', { n: 79, short: '세무사 보조 AI와 경정청구', focus: '시뮬레이션이 맡는 것: 가상 상황이 경정청구 자동 실행 4가지 조건을 채우는지 점검합니다. 이 장은 실제 제출 창구가 아직 없어 현재는 완성된 초안까지만 제공됩니다(설계된 흐름 연습). 가상 사례이며 세무 판단이 아닙니다.',
  say: ['지난 신고에서 놓친 게 있는지 봐 줘.', '경정청구 자동으로 해 줘.', '세무 탭에서 상담 시작할게.'],
  steps: [
    { k: 'pick', name: '4가지 조건 점검', gen: function (r) { var c = [['세무 자동 집행 위임(G8-TAX)이 꺼져 있다', '위임을 직접 켜지 않았기'], ['확신도가 가장 높은 단계(🟢)가 아니다', '확신도가 최고 단계가 아니기'], ['제척기간(보통 5년)이 지났다', '제척기간을 넘겼기'], ['제출 시스템이 연결되어 있지 않다', '제출 시스템이 연결되지 않았기']], x = shuf(c, r)[0]; return { q: '가상의 경정청구 후보가 있습니다. 다른 조건은 모두 맞는데 “' + x[0] + '”. 결과는?', opts: ['자동 실행되지 않고 초안만 보여 준다', '그래도 자동 실행된다', '재무제표가 삭제된다'], a: 0, why: x[1] + ' 때문입니다. 4가지(위임 켜짐·확신도 최고·제척기간 이내·제출 시스템 연결) 중 하나라도 안 맞으면 초안만 보여 줍니다.' }; } },
    { k: 'sort', name: '자동 실행 대상', q: '이 업무는 어떻게 다뤄질까요?', buckets: ['자동 실행 대상', '초안까지만(등록 세무사 확인 필수)'], items: [['홈택스 조회', 0], ['경정청구(조건 충족 시)', 0], ['세무조정계산서 작성', 1], ['기장대리', 1]], why: '자동 실행 대상은 홈택스 조회와 경정청구 둘뿐입니다. 세무조정계산서·기장대리는 최종 확인이 등록 세무사를 거쳐야 해 초안까지만 제공됩니다.' },
    { k: 'order', name: '세무 탭 사용 순서', q: '세무 탭을 쓰는 순서대로 눌러 보세요.', items: ['사이드 메뉴에서 세무 탭을 연다', '상담 시작을 눌러 재무제표를 아는 세무사 보조 AI와 대화한다', '경정청구 후보를 1차 스크리닝으로 확인한다', '대화와 세무사 확인을 거쳐 최종 판단한다'], why: '재무제표는 자동으로 실립니다. 후보는 1차 스크리닝일 뿐이고 최종 판단은 대화와 세무사의 확인에서 이뤄집니다. 현재는 완성된 초안까지만 드립니다.' }
  ] });

S('ch25', { n: 80, short: '글로벌 나비마켓', focus: '시뮬레이션이 맡는 것: 가상의 해외 판매자 도구를 보며 자동 변환과 신뢰 지표가 어떻게 적용되는지 분류·판단합니다. 환율 같은 수치는 쓰지 않습니다.',
  say: ['외국 판매자 도구도 살 수 있어?', '영어로 된 설명은 어떻게 봐?', '해외 판매자는 믿어도 돼?'],
  steps: [
    { k: 'sort', name: '자동으로 되는 것', q: '이 장에 따르면 어떻게 될까요?', buckets: ['자동으로 바뀜', '국경과 상관없이 같음'], items: [['도구 설명의 언어', 0], ['가격 표시 통화', 0], ['나비 온도 시스템', 1], ['수수료 없는 GDC 환전 방식', 1]], why: '설명과 가격은 내 언어·통화로 자동 변환되고, 나비 온도와 GDC 환전 방식은 국경을 넘어도 그대로 적용됩니다.' },
    { k: 'pick', name: '해외 판매자 평가', gen: function (r) { var c = ['가상 판매자 “Sunrise”', '가상 판매자 “Nordlicht”', '가상 판매자 “Sakura”'][ri(r, 0, 2)]; return { q: c + '의 도구가 마음에 듭니다. 믿을 만한지 판단하려면?', opts: ['국내 판매자와 같이 나비 온도와 리뷰를 확인한다', '해외라서 온도는 적용되지 않으니 무조건 믿는다', '해외 판매자는 살 수 없다'], a: 0, why: '국경을 넘어도 나비 온도 시스템이 동일하게 적용됩니다.' }; } },
    { k: 'order', name: '해외 도구 구매', q: '해외 판매자의 도구를 사는 순서대로 눌러 보세요.', items: ['글로벌 카탈로그에서 도구를 검색한다', '내 언어·통화로 바뀐 설명과 가격을 확인한다', '나비 온도를 확인한다', 'GDC로 구매한다'], why: '검색 → 자동 변환된 정보 확인 → 신뢰 확인 → GDC 구매 순서입니다.' }
  ] });

S('ch26', { n: 81, page: ['bank', 'pay'], short: '수수료 없는 GDC 송금', focus: '시뮬레이션이 맡는 것: 가상 해외 송금에서 기존 방식과 GDC 방식의 차이를 계산·분류합니다. 기존 수수료 금액은 원문에 없으므로 가정값(가상)으로만 쓰며, 실제 송금은 은행 화면에서 합니다.',
  say: ['해외에 GDC 보내고 싶어.', '환전 안 해도 돼?', '수수료는 얼마야?'],
  steps: [
    { k: 'calc', name: '받는 금액', gen: function (r) { var a = ri(r, 2, 20) * 10000; return { q: '가상의 이용자가 해외 사용자에게 ' + won(a) + ' GDC를 보냈습니다. 수수료 0원이면 상대가 받는 GDC는?', a: a, unit: 'GDC', why: 'GDC 송금은 환전·송금 수수료가 없어 보낸 금액이 그대로 도착합니다: ' + won(a) + ' - 0 = ' + won(a) + ' GDC.', hint: '수수료가 0원입니다.' }; } },
    { k: 'sort', name: '기존 방식 · GDC', q: '이 특징은 어느 쪽일까요?', buckets: ['기존 국제송금', 'GDC 송금'], items: [['환전·송금 수수료가 발생한다', 0], ['은행을 거쳐야 한다', 0], ['환전 없이 그대로 쓴다', 1], ['은행 없이 즉시 처리된다', 1], ['수수료 0원', 1]], why: 'GDC는 나비 생태계 안의 자체 디지털 통화라 은행 간 환전·중개 수수료 구조가 필요 없습니다.' },
    { k: 'pick', name: '왜 수수료가 없을까', q: '원문이 말하는 수수료가 없는 이유는?', opts: ['GDC는 나비 생태계 안에서 통용되어 은행 간 환전·중개 수수료 구조가 필요 없다', '수수료는 나중에 한꺼번에 낸다', '해외 거래에는 GDC를 쓸 수 없다'], a: 0, why: '자체 디지털 통화라 은행 간 환전·중개 수수료 구조 자체가 필요 없기 때문입니다.', no: ['', '원문은 수수료 0원이라고 합니다.', '해외 사용자와도 환전 없이 씁니다.'] }
  ] });

S('ch27', { n: 82, short: 'SP 맞춤 수정', focus: '시뮬레이션이 맡는 것: 가상 규칙을 개인·기관·부서 중 알맞은 층에 넣고 상속 순서를 확인합니다. 규칙 예시는 모두 가상이며, 실제 SP 수정은 설정에서 합니다.',
  say: ['말투를 좀 더 부드럽게 바꿔 줘.', '우리 회사 응대 규칙을 반영하고 싶어.', '부서별로 다른 규칙을 넣을 수 있어?'],
  steps: [
    { k: 'sort', name: '어느 SP에 넣을까', q: '이 규칙은 어느 층에 넣는 것이 알맞을까요?', buckets: ['개인 SP', '기관 SP', '부서 SP'], items: [['나는 존댓말로 짧게 답해 주세요', 0], ['자주 쓰는 표현을 우선 사용해 주세요', 0], ['회사 전체가 따르는 응대 매뉴얼', 1], ['가상의 고객지원부만의 세부 응대 규칙', 2]], why: '말투·우선순위는 개인, 조직 전체가 공유하는 규칙은 기관, 부서별 세부 규칙은 기관 SP를 상속받은 부서 SP에 둡니다.' },
    { k: 'order', name: '상속 순서', q: '개인용 맞춤을 먼저 하고, 이어서 기관 → 부서로 내려가는 순서대로 눌러 보세요.', items: ['개인 SP에 내 말투·우선순위를 반영한다(내 몫)', '기관 SP(회사 전체 규칙)를 정한다', '부서 SP가 기관 규칙을 상속받고 세부 규칙을 추가한다'], why: '부서는 기관 SP를 기반으로 상속받아 세부 규칙을 더하는 나무(계층) 구조입니다.' },
    { k: 'pick', name: 'SP란', q: '“SP를 고친다”는 말의 뜻은?', opts: ['AI 비서의 기본 지침(System Prompt)을 내 필요에 맞게 수정한다', 'AI 모델을 새로 만든다', '내 PDV 기록을 삭제한다'], a: 0, why: 'SP는 System Prompt, 곧 AI 비서의 기본 지침입니다. 큰 규모의 정부 기관·부서 적용은 별도 로드맵 문서를 참고합니다.' }
  ] });

S('ch28', { n: 83, short: '내 API 키 연결(BYOK)', focus: '시뮬레이션이 맡는 것: 가상 사용자 사례에서 BYOK가 필요한지 판단하고 연결 순서를 연습합니다. 실제 키는 절대 입력하지 않으며, 키 등록은 설정 페이지에서 합니다. 가상 사용량만 씁니다.',
  say: ['내 API 키를 연결하고 싶어.', 'OpenRouter 키는 어디에 넣어?', '일반 사용자도 BYOK가 필요해?'],
  steps: [
    { k: 'pick', name: '필요한 사람', gen: function (r) { var c = [['가상 사용자 “가”: 가끔 질문만 하는 일반 사용자', 1], ['가상 사용자 “나”: 대량으로 AI를 쓰며 비용을 세밀하게 관리하려는 고급 사용자', 0]], x = shuf(c, r)[0]; return { q: x[0] + '. BYOK가 알맞을까요?', opts: ['알맞다(선택 기능)', '필요 없다'], a: x[1], why: 'BYOK는 일반 사용자에게는 필요 없고, 대량 사용이나 세밀한 비용 관리를 원하는 고급 사용자를 위한 선택 기능입니다.' }; } },
    { k: 'order', name: '연결 순서', q: '연결 순서대로 눌러 보세요.', items: ['OpenRouter 등에서 본인 명의의 API 키를 발급받는다', '설정 페이지에 발급받은 키를 등록한다', '이후 사용량과 비용을 내 키 기준으로 직접 확인·관리한다'], why: '발급 → 설정에 등록 → 사용량 직접 관리 순서입니다. 키는 본인 명의로 발급받고 남에게 알려 주지 않습니다.' },
    { k: 'pick', name: '키를 받았다면', q: '가상의 사용자가 키를 발급받았습니다. 어디에 등록할까요?', opts: ['설정 페이지', '친구와의 대화창', '공개 게시판'], a: 0, why: '키는 설정 페이지에 등록합니다. 키는 비용이 걸린 비밀 값이라 대화창이나 게시판에 붙이면 안 돼요.', no: ['', '키가 노출될 수 있어요.', '키가 노출될 수 있어요.'] }
  ] });

/* ══ 시나리오: 고급 29~33장 외(ch29~ch_cns) ═══════════════════════════════ */
S('ch29', { n: 84, short: 'Openhash — 서버 없는 인증', focus: '시뮬레이션이 맡는 것: 기록이 여러 지점에 분산되어 한 곳만 고쳐서는 속일 수 없다는 점을 가상 기록을 직접 고쳐 보며 확인합니다. 실제 Openhash 인증 화면이 아니라 원리를 단순화한 모의 연습입니다.',
  say: ['Openhash가 뭐야? 블록체인이랑 같은 거야?', '내 기록이 위조되지 않는다는 걸 어떻게 믿어?', 'PDV 기록을 왜 믿고 써도 되는지 쉽게 알려 줘.'],
  steps: [
    { k: 'chain', name: '몰래 고쳐 보기', gen: function (r) { var d = ['커피 구매 기록', '임대료 입금 기록', '결석계 작성 기록', '재무제표 갱신 기록', '양식 저장 기록']; return { q: '가상의 기록 묶음입니다. 한 줄만 몰래 고치면 어떻게 될까요?', rows: shuf(d, r).slice(0, 4).map(function (x, k) { return '2026-10-' + (5 + k * 4) + ' ' + x; }), why: '한 곳의 기록만 몰래 바꿔서는 전체 무결성을 속일 수 없습니다. 이 모의 연습은 이어 붙인 지문으로 원리를 보여 주는 단순화이며, 실제 Openhash의 내부 구조를 그대로 옮긴 것은 아닙니다.' }; } },
    { k: 'sort', name: '장이 말하는 것', q: '이 장의 내용으로 맞는 말인지 가려 보세요.', buckets: ['장이 말하는 것', '장이 말하지 않는 것'], items: [['기록이 하나의 서버가 아니라 여러 지점에 분산 저장된다', 0], ['한 곳의 기록만 바꿔서는 전체 무결성을 속일 수 없다', 0], ['PDV 기록과 재무제표를 믿고 쓰는 기반이 된다', 0], ['중앙 서버 한 곳만 지키면 모든 기록이 안전하다', 1], ['블록체인과 완전히 똑같은 기술이다', 1]], why: '장은 특정 중앙 서버 하나에 의존하지 않는다고 말합니다. 블록체인과는 분산·위변조 방지 철학을 공유하지만, 나비 생태계 안의 데이터 무결성에 특화되어 있다고 설명합니다.' },
    { k: 'pick', name: '믿는 근거', q: '내 재무제표가 조작되지 않았다고 믿는 근거로 가장 알맞은 것은?', opts: ['기록이 여러 지점에 분산되어 한 곳만 고쳐서는 맞지 않기 때문', '나비 화면에 그렇게 적혀 있기 때문', '서버 한 곳이 모든 기록을 지키고 있기 때문'], a: 0, why: 'Openhash는 중앙 서버 하나에 의존하지 않고 분산 기록으로 무결성을 지킵니다.' }
  ] });

S('ch_klawverdict', { n: 85, short: 'K-Law 판결 예측 성능 평가', focus: '시뮬레이션이 맡는 것: 성능 평가 시험의 순서와 수치를 읽는 방법을 가상 점수로 연습합니다. 이 장의 수치는 자체 실험이며 제3자 검증이 없고 일부는 초안이라, 연습 속 숫자도 모두 가상이고 인용·이용할 수 없습니다.',
  say: ['K-Law 판결 예측은 얼마나 맞아?', '이 정확도 수치를 보고서에 써도 될까?', 'Agon이 뭐고 언제 공개돼?'],
  steps: [
    { k: 'order', name: '시험 순서', q: '성능 평가 페이지의 시험을 순서대로 눌러 보세요.', items: ['사건 준비 — 최신 대법원 판례를 완전히 익명화해 사건 개요로 만든다', '같은 지시문으로 입력 — 대형·중소형 오픈소스 LLM에 웹 검색 금지 지시문으로 넣는다', '실제 판결과 비교 — 결론과 법리가 얼마나 맞는지 채점한다', 'K-Law 적용 전후 비교 — 그룹별로 점수가 얼마나 오르는지 본다'], why: '익명화한 사건을 같은 조건으로 넣어야 비교가 공정합니다. 적용 전후 비교는 맨 마지막 단계입니다.' },
    { k: 'calc', name: '점수를 퍼센트로', gen: function (r) { var s = [ri(r, 60, 85), ri(r, 60, 85), ri(r, 60, 85), ri(r, 60, 85), ri(r, 60, 85)], sum = s.reduce(function (a, b) { return a + b; }, 0), avg = sum / 5 / 10; return { q: '가상의 사건 5건을 10점 만점으로 채점했더니 점수가 ' + s.map(function (x) { return (x / 10).toFixed(1); }).join(', ') + '점이었습니다. 평균은 10점 만점 기준으로 몇 점일까요? (소수 둘째 자리까지)', facts: '원문 방식: 평균 7.44/10을 약 74%로 읽습니다. 이 점수는 연습용 가상 값입니다.', a: Math.round(avg * 100) / 100, tol: 0.02, unit: '점', why: '점수 합 ' + (sum / 10).toFixed(1) + ' ÷ 5건 = ' + avg.toFixed(2) + '점, 약 ' + Math.round(avg * 10) + '%. 이 장의 실제 수치(7.44/10)도 자체 실험이라 인용하면 안 됩니다.', hint: '점수를 모두 더해 건수(5)로 나눕니다.' }; } },
    { k: 'sort', name: '수치 읽기 판단', q: '이 장의 수치를 다루는 방법으로 알맞은지 가려 보세요.', buckets: ['알맞다', '알맞지 않다'], items: [['자체 실험이고 제3자 검증이 없다는 점을 먼저 확인한다', 0], ['판결 예측은 법적 판단이 아니라 전문가 확인이 필요한 1차 분석으로 본다', 0], ['1·2심 40~45%라는 수치는 대법원 공개 판례에 한정한 경향으로 읽는다', 0], ['74%라는 수치를 홍보 자료에 그대로 인용한다', 1], ['판결 예측 결과를 법률 자문 대신 쓴다', 1]], why: '이 장은 어떠한 용도로도 수치를 인용·이용하지 말라고 하고, 판결 예측은 인간 전문가의 확인이 필요하다고 밝힙니다.' },
    { k: 'pick', name: 'Agon 알아보기', q: '친구가 Agon을 K-Law 새 버전이라고 합니다. 맞게 바로잡은 말은?', opts: ['K-Law와는 별개의 방법론 체계이고 공개는 2027년 상반기 예정이지만 변경될 수 있다', 'K-Law v15.x와 같은 경로로 이미 공개되었다', 'Agon은 원심 결과를 보여 주고 채점한다'], a: 0, why: 'Agon은 원심 결과를 숨기고 공방을 거쳐 모범 판결문으로 채점하는 별도 체계입니다. 공개는 예정일 뿐 아직 아닙니다.' }
  ] });

S('ch30', { n: 86, short: 'MoTE란 무엇인가', focus: '시뮬레이션이 맡는 것: 매번 다시 읽는 비용 문제와 MoTE의 역할을 가상 질문 횟수로 어림해 봅니다. 원문에는 MoTE의 실제 절감 수치가 없어, 연습은 읽는 분량만 계산하는 가정 문제입니다.',
  say: ['MoTE가 뭐야?', '왜 AI 서비스 이용료가 내려갈 수 있어?', 'K-Law가 매번 50페이지를 읽는다는 게 무슨 말이야?'],
  steps: [
    { k: 'sort', name: '문제·해결·효과', q: '다음 문장은 어디에 속할까요?', buckets: ['문제', '해결', '효과'], items: [['질문마다 A4 약 50페이지의 참고자료를 새로 읽는다', 0], ['핵심 지침을 효율적으로 재사용하도록 구조화한다', 1], ['이용료와 에너지가 줄어든다', 2], ['비용과 에너지가 많이 든다', 0], ['K-서비스와 전문가 페르소나 이용료를 낮추는 데 기여한다', 2]], why: 'MoTE는 매번 처음부터 읽는 비용 문제를 구조적으로 줄이는 기술이고, 절감분이 이용료를 낮추는 데 기여합니다.' },
    { k: 'calc', name: '매번 읽는 분량', gen: function (r) { var q = ri(r, 4, 20); return { q: '(가정) 한 사람이 하루에 질문을 ' + q + '번 하고, 질문마다 A4 약 50페이지를 새로 읽는다면 하루에 읽는 분량은 몇 페이지일까요?', facts: '50페이지는 원문의 수치이고, 질문 횟수는 연습용 가정입니다.', a: q * 50, tol: 0, unit: '페이지', why: q + '번 × 50페이지 = ' + won(q * 50) + '페이지. 재사용 구조가 없으면 이렇게 쌓입니다. MoTE가 실제로 얼마나 줄이는지는 원문에 수치가 없어 이 연습에서 계산하지 않습니다.', hint: '질문 횟수에 50을 곱합니다.' }; } },
    { k: 'pick', name: '없다면', q: 'MoTE 같은 구조적 효율화가 없다면 어떻게 될까요?', opts: ['전문 지식이 필요한 AI 서비스의 비용이 훨씬 비싸질 수밖에 없다', '서비스가 더 정확해진다', '아무 차이가 없다'], a: 0, why: '원문은 효율화가 없으면 전문 지식 AI 서비스 비용이 훨씬 비싸질 수밖에 없다고 설명합니다.' }
  ] });

S('ch31', { n: 87, short: '정부 없이 여권 발급이 가능할까?', focus: '시뮬레이션이 맡는 것: 기술로 가능한 부분과 정부의 상호 인정이 필요한 부분을 나누어 봅니다. 이 장은 개념과 전망이며, 나비가 지금 여권을 발급한다는 내용이 아닙니다.',
  say: ['정부 없이 여권을 만들 수 있어?', '나비 신원으로 해외에서 입국할 수 있어?', '여권이 하는 일이 정확히 뭐야?'],
  steps: [
    { k: 'sort', name: '기술 vs 정부', q: '여권과 관련된 일이 기술로 가능한지, 정부 인정이 필요한지 나눠 보세요.', buckets: ['기술로 증명 가능', '각국 정부의 상호 인정 필요'], items: [['이 사람이 실제로 이 사람이다를 증명하는 신원 확인', 0], ['위변조를 막고 기록의 신뢰를 지키는 일', 0], ['국경을 통과할 때 입국으로 받아들여지는 일', 1], ['법적 효력을 갖는 것', 1]], why: '신원 증명과 위변조 방지는 Openhash 같은 기술이 맡을 잠재력이 있고, 국경 통과와 법적 효력은 각국 정부의 상호 인정이 필요한 영역입니다.' },
    { k: 'order', name: '논리 잇기', q: '이 장의 논리를 순서대로 눌러 보세요.', items: ['여권의 본질은 이 사람이 실제로 이 사람임을 증명하는 것이다', '위변조 방지 기술(Openhash)이 국가 발급 없이도 신뢰를 담보할 잠재력을 보여 준다', '다만 국경 통과와 법적 효력은 각국 정부의 상호 인정이 필요하다', '결론: 기술로 신원 증명은 가능해도 실제 여권 대체는 국제적 합의가 필요하다'], why: '본질 → 기술의 가능성 → 현실적 한계 → 결론의 흐름입니다.' },
    { k: 'pick', name: '이렇게 답한다면', q: '“기술이 있으니 이제 여권은 필요 없다”는 말에 대한 가장 알맞은 답은?', opts: ['신원 증명은 기술로 가능하지만 국경 통과와 법적 효력에는 정부의 상호 인정이 필요하다', '맞다, 기술만으로 이미 완전히 대체된다', '신원 증명조차 기술로는 불가능하다'], a: 0, why: '기술만으로 완전히 대체하기 어렵다는 것이 이 장의 결론입니다.' }
  ] });

S('ch32', { n: 88, short: '나비로 구현하는 글로벌 전자 여권', focus: '시뮬레이션이 맡는 것: 전자 여권 구상의 세 요소와 현재 상태를 가려 읽습니다. 이 장은 나비가 지향하는 방향과 설계 구상이며, 지금 여권을 대체하지는 않는다고 원문이 밝힙니다.',
  say: ['나비 계정으로 여권을 대신할 수 있어?', '전자 여권이 믿을 수 있는 이유가 뭐야?', '다른 나라에서도 나비 신원을 인정해 줘?'],
  steps: [
    { k: 'order', name: '세 가지 요소', q: '전자 여권 구상의 세 요소를 장에 나온 순서대로 눌러 보세요.', items: ['나비 신원 — 지갑 기반 신원이 여권 역할의 출발점이다', 'Openhash — 분산 인증 기술로 여권 정보의 신뢰성을 보장한다', '국가 간 상호 인정 — 각국 정부·기관이 인정하는 범위를 넓힌다'], why: '신원이 기초이고, Openhash가 신뢰를 보장하며, 상호 인정이 넓어질수록 실제 여권처럼 쓰일 수 있습니다.' },
    { k: 'sort', name: '지금 vs 방향', q: '다음 문장은 현재 사실일까요, 나비가 지향하는 방향일까요?', buckets: ['지향하는 방향', '지금 사실이 아님'], items: [['나비 계정 하나로 전 세계 어디서든 신원을 증명하는 형태', 0], ['각국이 나비 신원을 인정하는 범위가 넓어지는 것', 0], ['나비 신원이 이미 모든 나라에서 여권으로 통용된다', 1], ['제도적 인정 없이도 국경을 통과할 수 있다', 1]], why: '원문은 아직은 아니라고 말합니다. 이는 나비가 지향하는 방향이며 각국의 제도적 인정이 함께 진행되어야 완성됩니다.' },
    { k: 'pick', name: '실제 여권처럼 되려면', q: '나비 전자 여권이 실제 여권처럼 쓰이기 위해 꼭 필요한 것은?', opts: ['각국 정부·기관의 상호 인정 확대', '나비 온도 올리기', '지갑 백업 키 삭제'], a: 0, why: '국가 간 상호 인정이 확대되어야 실제 여권처럼 통용될 수 있습니다.' }
  ] });

S('ch33', { n: 89, short: '보안 설정 문턱값과 유예', focus: '시뮬레이션이 맡는 것: 보안을 높이는 조정과 낮추는 조정의 처리 방식 차이를 가상 설정으로 연습합니다. 가상 값이며 실제 설정에는 반영되지 않습니다.',
  say: ['송금할 때 지문을 요구하는 금액을 바꾸고 싶어.', '지문 필수를 끄면 바로 적용돼?', '내가 안 한 보안 완화 알림이 왔는데 어떻게 해?'],
  steps: [
    { k: 'sort', name: '즉시 vs 24시간', gen: function (r) { var all = [['송금 지문 금액을 10만 원에서 5만 원으로 낮춘다', 0], ['K-서비스 결제 지문 금액을 1만 원에서 5천 원으로 낮춘다', 0], ['꺼져 있던 다른 기기 로그인 지문 필수를 다시 켠다', 0], ['송금 지문 금액을 10만 원에서 50만 원으로 올린다', 1], ['K-서비스 결제 지문 금액을 1만 원에서 3만 원으로 올린다', 1], ['다른 기기 로그인 지문 필수를 끈다', 1]]; return { q: '각 조정이 바로 적용될까요, 24시간 뒤 적용될까요?', buckets: ['즉시 적용', '24시간 뒤 적용'], items: shuf(all, r).slice(0, 5), why: '문턱값을 낮추거나 지문 필수를 켜는 것은 보호를 강화하는 방향이라 지갑 서명만으로 바로 반영됩니다. 올리거나 끄는 것은 완화이므로 지문 확인 후에도 24시간 뒤부터 적용됩니다.' }; } },
    { k: 'calc', name: '남은 유예 시간', gen: function (r) { var h = ri(r, 1, 20); return { q: '보안 완화를 예약한 지 ' + h + '시간이 지났습니다. 적용되기까지 몇 시간이 남았을까요?', facts: '완화는 지문 확인 후 24시간 뒤부터 적용됩니다. 그 사이 설정 화면에서 취소할 수 있습니다.', a: 24 - h, tol: 0, unit: '시간', why: '24시간 - ' + h + '시간 = ' + (24 - h) + '시간. 이 시간 안에는 설정 화면에서 취소할 수 있습니다.', hint: '24에서 지난 시간을 뺍니다.' }; } },
    { k: 'pick', name: '낯선 알림', q: '내가 요청하지 않은 보안 완화 예약 알림이 다른 기기에 왔습니다. 가장 알맞은 행동은?', opts: ['적용되기 전에 설정 화면에서 취소한다', '24시간 기다린다', '알림을 무시한다'], a: 0, why: '본인이 요청한 것이 아니라면 적용되기 전까지 언제든 설정 화면에서 취소할 수 있습니다. 폰을 잠깐 손에 넣은 사람이 몰래 보안을 낮추는 것을 막으려는 장치입니다.' },
    { k: 'pick', name: '센서 없는 기기', q: '지문이나 Face ID 센서가 없는 기기에서 문턱값 조정을 켜려 합니다. 어떻게 될까요?', opts: ['조정 자체를 켤 수 없고 기본값(넓은 지문 적용)이 유지된다', '지문 없이 조정할 수 있다', '자동으로 24시간 뒤 켜진다'], a: 0, why: '센서가 없는 기기는 조정을 켤 수 없고 기본값이 유지됩니다. 지원 기기로 한 번 로그인하면 계정 전체의 설정을 조정할 수 있습니다.' }
  ] });

S('ch_kmail_advanced', { n: 90, short: 'K-Mail 고급 — 주소록 대량 등록', focus: '시뮬레이션이 맡는 것: CSV 업로드의 자동 분류·중복 처리 규칙과 캠페인 흐름을 가상 연락처로 연습합니다. 실제로 등록하거나 발송하지 않습니다.',
  say: ['엑셀 파일로 연락처 300명을 한 번에 넣고 싶어요.', '의료 카테고리 연락처만 보여 줘.', '중복된 연락처를 합쳐 주세요.'],
  steps: [
    { k: 'sort', name: '카테고리 자동분류', gen: function (r) { var all = [['제주대학교', 0], ['한라대학교', 0], ['제주시청', 2], ['서귀포시청', 2], ['제주병원', 1], ['한라병원', 1], ['개인 사업자', 3], ['소속 미기재', 3]]; return { q: '소속명 키워드로 카테고리가 어떻게 채워질까요?', buckets: ['교육', '의료', '행정', '빈 값'], items: shuf(all, r).slice(0, 5), why: '대학교는 교육, 병원은 의료, 시청은 행정으로 결정적으로 분류하고, 애매하면 억지로 채우지 않고 빈 값으로 둡니다. (연습용 소속 이름은 모두 가상입니다.)' }; } },
    { k: 'calc', name: '업로드 결과 계산', gen: function (r) { var n = ri(r, 20, 60), d = ri(r, 2, 8), e = ri(r, 1, 5); return { q: '가상의 CSV에 ' + n + '행이 있고 이미 등록된 중복 ' + d + '건, 형식 오류 ' + e + '건이 있습니다. 새로 등록되는 건수는?', facts: '이미 등록된 이메일은 대소문자가 달라도 중복으로 건너뜁니다.', a: n - d - e, tol: 0, unit: '건', why: n + ' - ' + d + ' - ' + e + ' = ' + (n - d - e) + '건. 결과 문구에는 등록·중복 건너뜀·형식 오류 건수가 함께 나옵니다.', hint: '전체에서 중복과 오류를 뺍니다.' }; } },
    { k: 'order', name: '캠페인 흐름', q: '캠페인을 순서대로 눌러 보세요.', items: ['목적 확인', '받을 사람 찾기', '주소록 반영', '최종 확인 후 발송', '답장 모으기(다이제스트)', '보고(응답률)', '종료'], why: '발송 전에는 최종 확인을 거치고, 발송 뒤에 답장을 모으고 보고하고 종료합니다. 이 연습은 미리보기까지만 하고 실제 발송은 하지 않습니다.' },
    { k: 'pick', name: '연습 연락처 지우기', q: '연습으로 올린 연락처를 말로 지우려 합니다. 알맞은 요청은?', opts: ['이메일 주소를 적어 한 번에 한 주소씩 삭제를 요청한다', '이름만 말해서 여러 명을 한꺼번에 지운다', '지울 필요 없이 실제 메일을 보내 본다'], a: 0, why: '이름만으로는 지워지지 않으며 한 번에 한 주소씩 하는 것이 확실합니다. 연습 연락처에는 실제 메일을 보내지 않습니다.' }
  ] });

S('ch_kclean_settlement', { n: 91, short: 'K-Clean 비용 산정과 정산', focus: '시뮬레이션이 맡는 것: 견적·배정·승인·정산의 흐름과 누가 무엇을 하는지를 가려 봅니다. 금액과 업체는 모두 가상이며 신고자는 비용을 내지 않습니다.',
  say: ['쓰레기를 신고하면 수거 비용은 누가 내?', '내 신고가 지금 어디까지 처리됐는지 알려 줘.', '견적 승인은 누가 해?'],
  steps: [
    { k: 'order', name: '견적에서 정산까지', q: '신고가 정산까지 이어지는 순서대로 눌러 보세요.', items: ['수거 견적 산정 — 쓰레기 종류·규모를 바탕으로 견적서가 신고서와 함께 발급된다', '담당 업체 매칭 — 지역·처리 종류에 맞는 업체에 작업이 배정된다', '담당자 승인 — 공무원이 승인하면 승인 시각과 확정 비용이 기록된다', '정산 — 수거 완료 확인 뒤 확정 비용 기준으로 정산한다'], why: '견적 → 배정 → 승인 → 정산 순서입니다. 정산은 수거 완료가 확인된 뒤에 이뤄집니다.' },
    { k: 'sort', name: '누가 하는 일인가', q: '다음 일은 누구의 몫일까요?', buckets: ['신고자', '지자체 담당 공무원', '수거업체·기관'], items: [['접수번호로 처리 상태를 확인한다', 0], ['견적을 확인하고 승인한다', 1], ['배정된 신고 건 목록을 대시보드에서 본다', 2], ['승인 대기 견적을 확인하고 승인한다', 1], ['정산 내역이 매출 기록에 반영된다', 2]], why: '신고자는 비용을 내지 않고 접수번호로 상태만 확인합니다. 승인은 담당 공무원이 하고, 정산 내역은 업체의 매출 기록(재무제표)에 자동 반영됩니다.' },
    { k: 'pick', name: '신고자 부담', q: '신고자가 “수거 비용은 내가 내야 하나요?”라고 묻습니다. 알맞은 답은?', v: [
      { q: '신고자가 “수거 비용은 내가 내야 하나요?”라고 묻습니다. 알맞은 답은?', opts: ['아니요, 비용 산정과 정산은 담당 기관과 수거업체 사이의 절차예요', '네, 견적 금액만큼 내야 해요', '승인 뒤에 절반을 내요'], a: 0, why: '일반 신고자는 비용을 부담하지 않습니다.' },
      { q: '견적을 확인해 승인하면 처리 상태는 어떻게 바뀌나요?', opts: ['승인으로 바뀌고 승인 시각과 확정 비용이 함께 기록된다', '바로 정산 완료가 된다', '변화 없이 신고자에게만 알려진다'], a: 0, why: '승인이 되면 승인 시각과 확정 비용이 기록되고, 정산은 수거 완료 확인 뒤에 이뤄집니다.' }] }
  ] });

S('ch_formbuilder', { n: 92, short: '내 양식 만들기', page: ['myforms', 'forms'], focus: '시뮬레이션이 맡는 것: 양식 만들기의 한도와 SP가 하는 일·못 하는 일을 가상 요청으로 판단해 봅니다. 실제 양식 만들기는 컴퓨터 화면의 연습 예제에서 합니다.',
  say: ['사무실 임대차 점검표 양식을 만들어 줘.', '상태는 양호/주의/불량 중에서 고르게 해 줘.', '비고 칸을 크게 만들고 필수 칸은 성명과 날짜만 남겨 줘.'],
  steps: [
    { k: 'sort', name: 'SP가 하는 일 가리기', q: '양식 작성 SP에게 이렇게 시켰을 때 어떻게 될까요?', buckets: ['SP가 해 준다', 'SP가 못 하거나 화면 단추로 한다'], items: [['연락처 칸을 성명 뒤에 추가해 줘', 0], ['특이사항 묶음을 맨 위로 올려 줘', 0], ['주민등록번호를 받는 칸을 만들어 줘', 1], ['올려 둔 PDF 원본을 읽고 양식을 똑같이 만들어 줘', 1], ['저장해 줘 (안내만 받고 단추는 내가 누른다)', 1]], why: 'SP는 양식의 틀만 만듭니다. 주민번호·계좌·카드·비밀번호 칸은 만들지 않고, 올려 둔 원본은 읽지 못하며, 저장·되돌리기·삭제는 화면의 단추로 합니다.' },
    { k: 'calc', name: '한도 넘은 줄 수', gen: function (r) { var n = ri(r, 62, 90); return { q: 'SP가 항목 ' + n + '개짜리 초안을 냈습니다. 한 양식에는 항목 60개까지 들어갑니다. SP는 넘는 줄을 빼고 알려 줍니다. 몇 줄이 빠질까요?', facts: '한도: 묶음 8개, 항목 60개(화면에서는 40개 안팎이 쓰기 편합니다).', a: n - 60, tol: 0, unit: '줄', why: n + ' - 60 = ' + (n - 60) + '줄. 그럴 때는 묶음을 나누거나 줄여 달라고 하세요.', hint: '초안 항목 수에서 60을 뺍니다.' }; } },
    { k: 'pick', name: '항목 설정 고르기', v: [
      { q: '선택 항목 “상태”에 양호, 주의, 불량 세 가지를 넣으려 합니다. 선택지는 어떻게 적나요?', opts: ['쉼표로 구분한다', '줄바꿈으로 3칸을 따로 만든다', '선택지는 11개를 넘겨야 한다'], a: 0, why: '선택 항목은 선택지를 쉼표로 적고, 2~12개까지 하나당 30자까지입니다.' },
      { q: '“비고” 칸을 넉넉하게 쓰고 싶습니다. 알맞은 항목 종류와 설정은?', opts: ['긴글 종류로 하고 폭은 12칸, 아래 모서리를 끌어 줄 수를 정한다', '짧은글 종류로 하고 폭을 3칸으로 한다', '금액 종류로 단위를 적는다'], a: 0, why: '긴글은 줄 2~12이고 폭은 12칸이 기본입니다. 아래 모서리를 끌어 줄 수를 정합니다.' }] },
    { k: 'order', name: '연습 순서', q: '말로 양식 한 장을 만드는 순서대로 눌러 보세요.', items: ['서류 → 내 서류함 → ＋ 새 양식 만들기를 연다', '양식 작성 SP 대화창에 만들 양식을 말로 설명한다', '말로 두세 가지를 고친다', '항목을 직접 움직이고 마음에 안 들면 되돌리기를 누른다', '이름을 정하고 저장한다'], why: '저장한 양식은 내 서류함 → 내가 만든 양식에 들어가 서류 작성에서 바로 쓸 수 있습니다. 컴퓨터에서만 할 수 있어요.' }
  ] });

S('ch_automation', { n: 93, short: '자동화 — 자동 삭제와 위임 규칙', focus: '시뮬레이션이 맡는 것: 어떤 자동화 규칙이 안전하게 좁은지, 위임 규칙 안에 둘 수 있는지를 가상 규칙으로 판단합니다. 실제 규칙은 만들지 않습니다.',
  say: ['광고 표시가 있는 메일은 도착하면 바로 삭제해 줘.', '다음 주 월요일 오전 9시까지 휴가 중이라고 자동 답장해 줘.', '재고 있는 짜장면 주문이면 알아서 수락해 줘.'],
  steps: [
    { k: 'sort', name: '규칙 범위 가리기', q: '처음 만드는 자동화 규칙으로 알맞은지 가려 보세요.', buckets: ['구체적이고 좁다', '너무 넓다'], items: [['재고가 있는 짜장면·짬뽕 주문이면 수락', 0], ['광고 표시가 있는 메일만 도착 즉시 삭제', 0], ['휴가가 끝나는 시각을 정해 자동 답장', 0], ['모든 메일을 알아서 답장하고 삭제', 1], ['들어오는 주문은 전부 수락', 1]], why: '자동 삭제는 되돌리기 어려워 범위를 좁게 시작하고, 위임 규칙은 구체적이고 좁게 씁니다. 자동 답장은 끝나는 시각을 정해야 멈춥니다.' },
    { k: 'sort', name: '규칙 안 vs 밖', q: '위임 규칙(내 확인 없이 알아서 답장)에 넣어도 될 일일까요?', buckets: ['규칙 안에 둘 수 있다', '규칙 밖에 둔다'], items: [['재고가 있는 주문이면 수락한다는 단순한 확인 답장', 0], ['금액을 깎아 주겠다는 답장', 1], ['계약 조건에 동의한다는 답장', 1], ['언제까지 반드시 납품한다는 확정적인 약속', 1]], why: '금액·계약·확정적인 약속이 걸린 일은 규칙 밖에 두고 직접 확인합니다. 위임은 나비웹이 나 대신 답장을 보내는 일이라 신중해야 합니다.' },
    { k: 'pick', name: '자동 답장 동작', v: [
      { q: '같은 사람이 하루에 메일을 세 번 보냈습니다. 자동 답장은 몇 번 갈까요?', opts: ['같은 사람에게는 24시간에 한 번만 간다', '메일마다 한 번씩 세 번 간다', '끝나는 시각까지 계속 간다'], a: 0, why: '자동 답장은 같은 사람에게 24시간에 한 번만 가고, 끝나는 시각을 정하면 멈춥니다.' },
      { q: '위임 규칙을 처음 만들려 합니다. 알맞은 시점은?', opts: ['처음에는 쓰지 말고 대화에 익숙해진 뒤에 만든다', '가입하자마자 모든 답장을 위임한다', '규칙은 한 번 만들면 고칠 수 없으니 최대한 넓게 쓴다'], a: 0, why: '규칙은 언제든 고치거나 지울 수 있으니 가끔 목록을 확인하세요.' }] }
  ] });

S('ch_case_deep', { n: 94, short: '업무(Case) 심화', focus: '시뮬레이션이 맡는 것: 상태 흐름·기록 변조 확인·점검 결과 읽기·초대 유효기간을 가상 업무로 연습합니다. 점검 통과는 법적 보증이 아닙니다.',
  say: ['새 일을 만들어서 상대방에게 초대 메일을 보내 줘.', '이 일을 종료하고 싶어.', '기록 무결성이 변조 의심이라고 떠.'],
  steps: [
    { k: 'order', name: '상태 흐름', q: '업무가 시작해서 끝나기까지 주된 상태를 순서대로 눌러 보세요.', items: ['제안됨', '합의됨', '진행 중', '종료 협의 중', '종료', '보관'], why: '진행 중과 보류는 오갈 수 있고 거절됨·만료도 있습니다. 합의는 상대가 확인(서명)해야 완료되며, 종료는 한쪽이 요청하면 상대가 동의·이의·보류로 응답합니다.' },
    { k: 'chain', name: '기록 변조 확인', gen: function (r) { var d = ['초대 발송', '상대 수락', '합의 확인(서명)', '메모 공유', '소통 기록(전화)']; return { q: '가상의 업무 진행 기록입니다. 한 줄을 몰래 고치면 어떻게 될까요?', rows: shuf(d, r).slice(0, 4).map(function (x, k) { return '2026-11-' + (3 + k * 4) + ' ' + x; }), why: '기록은 이 기기에만 저장되고 네트워크에는 지문만 남아, 고친 줄부터 지문이 어긋나 변조 의심으로 표시됩니다. 이 모의 연습은 원리를 단순화한 것입니다.' }; } },
    { k: 'sort', name: '점검 결과 읽기', q: '합의·공유·종료 직전 점검에서 이런 상황이면 결과는?', buckets: ['주의(기본 선택은 보류)', '진행 불가'], items: [['상대의 서명 키 지문을 아직 대조하지 않았다', 0], ['공유하려는 내용에 번호류가 들어 있다', 0], ['미결제 청구서가 있는 상태에서 종료하려 한다', 1]], why: '지문 미대조와 번호류 공유는 주의이고 기본 선택·Esc는 보류입니다. 미결제 청구서가 있는 종료는 진행 불가입니다. 통과나 적용 규칙 없음도 법적으로 문제없다는 뜻은 아닙니다.' },
    { k: 'calc', name: '초대 링크 남은 날', gen: function (r) { var d = ri(r, 1, 12); return { q: '초대 링크를 보낸 지 ' + d + '일이 지났습니다. 유효기간이 끝나기까지 며칠이 남았을까요?', facts: '초대 링크는 14일 유효합니다.', a: 14 - d, tol: 0, unit: '일', why: '14일 - ' + d + '일 = ' + (14 - d) + '일. 초대받은 기기에는 7일 기억됩니다.', hint: '14에서 지난 날을 뺍니다.' }; } }
  ] });

S('ch_cns', { n: 95, short: '나비 지식 온도와 전문가 인증서(CNS)', focus: '시뮬레이션이 맡는 것: 나비 지식 온도를 가상 진행 상황으로 계산하고 인증서 발급 조건을 판단합니다. 장의 개수는 연습용 가정이며, 인증서는 학습 완료 확인일 뿐 전문가 면허 인증이 아닙니다(면허 인증·번호 조회는 준비 중).',
  say: ['내 나비 지식 온도가 지금 몇 도야?', '인증서는 몇 도부터 받을 수 있어?', '발급한 인증서를 다시 보여 줘.'],
  steps: [
    { k: 'calc', name: '지금 몇 도?', gen: function (r) { var tot = [10, 20][ri(r, 0, 1)], k = ri(r, 1, tot - 1), init = ri(r, 0, 1); var base = init ? 60 : 36.5, span = init ? 20 : 23.5, t = base + span * k / tot; return { q: '(가정) ' + (init ? '초급을 모두 마친 뒤 중급에 장이 ' : '초급에 장이 ') + tot + '개 있고 그중 ' + k + '개를 끝냈습니다. 나비 지식 온도는 몇 도일까요? (소수 첫째 자리)', facts: '36.5°에서 시작해 초급 완료 60°, 중급 완료 80°, 고급 완료 100°. 각 단계 안에서는 끝낸 장의 비율만큼 오릅니다.', a: Math.round(t * 10) / 10, tol: 0.1, unit: '°', why: base + ' + ' + span + ' × ' + k + '/' + tot + ' = ' + t.toFixed(1) + '°. 장 개수는 연습용 가정입니다.', hint: '해당 단계의 상승 폭에 끝낸 비율을 곱해 더합니다.' }; } },
    { k: 'pick', name: '발급 단추 확인', gen: function (r) { var t = [80, 90, 94, 95, 97, 100][ri(r, 0, 5)], ok = t >= 95; return { q: '나비 지식 온도가 ' + t + '°입니다. 인증서 발급받기 단추가 보일까요?', opts: ['보인다(95° 이상)', '보이지 않는다(95° 미만)'], a: ok ? 0 : 1, fixed: true, why: '95° 이상이 되면 안내 띠와 인증서 발급받기 버튼이 나타나고, 그 전에는 보이지 않습니다.' }; } },
    { k: 'sort', name: '알아 둘 점', q: '인증서와 지식 온도에 대한 설명이 맞는지 가려 보세요.', buckets: ['맞다', '틀리다'], items: [['발급하면 이름과 발급일은 바꿀 수 없으니 정확히 적는다', 0], ['발급 기록은 이 브라우저에 보관되니 발급 직후 PDF로 저장해 둔다', 0], ['나비 지식 온도는 거래·평가로 오르내리는 나비 온도와 다른 값이다', 0], ['이 인증서는 변호사·세무사 면허 인증을 대신한다', 1], ['다른 브라우저에서도 항상 발급 기록이 보인다', 1]], why: '인증서는 매뉴얼 학습을 마쳤다는 확인이며 전문가 면허 인증과 번호 조회는 준비 중입니다. 발급 기록은 이 브라우저에 보관되어 다른 기기에서는 보이지 않을 수 있습니다.' }
  ] });

/* ══ 시나리오: 고급 — 분야별 서비스 소개·설계 장 12개 ═════════════════ */
S('ch_kstock', { n: 96, short: 'K-Stock 자산관리 상담', focus: '시뮬레이션이 맡는 것: 소개 화면의 말을 “서비스 설명”과 “내가 지는 몫”으로 가르고, 상담 답을 참고용으로 쓰는 순서를 연습합니다. 소개 화면 문구를 바탕으로 한 초안 장이라 가상 상황이며, 실제 투자 결정은 하지 않습니다.',
  say: ['내 자산을 한눈에 정리해서 분석해 줘.', '은퇴 준비를 어떻게 하면 좋을지 상담하고 싶어요.', '이 상품 사도 될까?'],
  steps: [
    { k: 'sort', name: '누구의 몫인가', q: '이 문장은 누구의 몫일까요?', buckets: ['서비스 설명(검증 전)', '내 몫'], items: [['분석 자산군이 89개라는 소개', 0], ['재무 목표를 30년까지 예측한다는 소개', 0], ['투자 결정을 내리는 일', 1], ['결정에 따른 책임', 1]], why: '소개 화면의 수치는 서비스 설명이며 제3자가 검증한 결과가 아닙니다. 투자 결정과 책임은 내게 있습니다.' },
    { k: 'order', name: '상담 답을 쓰는 순서', q: '상담 답을 받은 뒤 올바른 순서로 눌러 보세요.', items: ['내 자산 상황을 말하고 상담을 요청한다', '받은 답을 참고용 정보로 읽는다', '수치와 근거를 내가 한 번 더 따져 본다', '결정은 내가 직접 한다'], why: '나비는 특정 상품을 사라고 권하지 않습니다. 답은 참고이고 마지막 판단은 내가 합니다.' },
    { k: 'pick', name: '이렇게 답하면', q: '“이 종목 지금 사세요”라는 단정적인 답이 왔다면 어떻게 받아들일까요?', opts: ['특정 상품을 권하지 않는다는 원칙과 다르니 근거를 되묻고 직접 판단한다', '믿고 바로 산다', '서비스 전체를 믿지 않는다'], a: 0, why: '답은 참고용 정보입니다. 근거를 되묻고 결정은 내가 합니다.' }
  ] });

S('ch_kinsurance', { n: 97, short: 'K-Insurance 설계 단계', focus: '시뮬레이션이 맡는 것: 설계 문서에 적힌 내용과 지금 실제로 확인된 것을 가르는 연습입니다. 이 서비스는 설계 단계라 실제로 가입·청구·지급하는 화면이 아니며, 아래 장면은 모두 가상입니다.',
  say: ['나비 보험에 가입하고 싶어요.', '택시 탈 때 자동으로 보험이 적용돼?', '사고 났을 때 청구 서류는 어떻게 만들어?'],
  steps: [
    { k: 'sort', name: '설계 문서와 지금', q: '이 문장은 어디에 속할까요?', buckets: ['설계 문서의 목표', '지금 확인된 것'], items: [['이벤트가 생기면 AI가 필요한 보험을 자동 적용한다', 0], ['사고가 나면 증거로 청구 서류를 만든다', 0], ['소액 보험을 지점·설계사 없이 제공한다', 0], ['설계 문서가 저장소에 적혀 있다', 1], ['실제 가입·청구·지급 화면은 확인되지 않았다', 1]], why: '이 장은 설계 문서를 풀어 쓴 것입니다. 목표를 이미 되는 기능처럼 읽으면 안 됩니다.' },
    { k: 'sort', name: '자동 적용 이벤트', q: '설계 문서의 자동 적용 보험과 연결되는 이벤트인가요?', buckets: ['적혀 있다', '적혀 있지 않다'], items: [['탑승(K-Traffic)', 0], ['배달(K-Market)', 0], ['응급 의료(K-119)', 0], ['GDC 고액 이체의 거래 사기', 0], ['주민등록 변경', 1]], why: '자동 적용 보험은 탑승·배달·응급 의료·거래 사기입니다. 이 밖의 항목은 문서에 없습니다.' },
    { k: 'pick', name: '말을 걸었다면', q: '“지금 보험 가입할게요”라고 했습니다. 이 서비스의 현재 상태에 맞는 이해는?', opts: ['설계 단계라 실제 가입 화면은 확인되지 않았고, 확인되면 장을 다시 쓴다', '바로 가입되어 보험금이 나온다', '가입 대신 전화로 지점을 찾아간다'], a: 0, why: '실제 가입·청구·지급 화면은 확인되지 않았습니다. 지점·설계사가 없는 것도 설계 목표입니다.' }
  ] });

S('ch_khealth', { n: 98, short: 'K-Health 증상 상담', focus: '시뮬레이션이 맡는 것: 실제로 되는 것과 개발 중인 것을 가르고, 증상 말에 따라 상담할지 119를 부를지 판단하는 연습입니다. 가상 증상만 쓰며 실제 진단이 아닙니다.',
  say: ['어제부터 머리가 계속 아파요.', '기침이 일주일째 안 멈춰.', '나 가슴이 너무 아프고 숨이 안 쉬어져.'],
  steps: [
    { k: 'sort', name: '되는 것과 목표', q: '지금 상태는 어디에 속할까요?', buckets: ['실제 동작', '개발되지 않음(목표)'], items: [['AI 증상 상담(채팅, 24시간)', 0], ['PDV 암호화 저장(동의 하에 본인만 열람)', 0], ['진료 기관 자동 추천', 1], ['진료 기관과 자동 협상·예약', 1], ['의사 사전 브리핑', 1]], why: '진단 정확도 향상은 검증된 수치도 없다고 화면에 적혀 있습니다.' },
    { k: 'pick', name: '먼저 할 일', v: [
      { q: '가상 상황: 며칠째 가벼운 두통이 있어 걱정됩니다. 알맞은 쓰임은?', opts: ['AI에 증상을 상담하고, 걱정이 계속되면 병원에서 진료받는다', 'AI 답이 진단이니 병원은 가지 않는다', '아무것도 하지 않는다'], a: 0, why: 'AI 상담은 의사의 진단을 대신하지 않습니다.' },
      { q: '가상 상황: 가슴이 심하게 아프고 숨이 막힙니다. 먼저 할 일은?', opts: ['상담하지 말고 먼저 119에 연락한다', 'AI에 증상부터 길게 설명한다', '내일 예약을 알아본다'], a: 0, why: '응급 상황이면 상담하지 말고 먼저 119에 연락합니다.' }] },
    { k: 'order', name: '걱정될 때 순서', q: '가벼운 증상이 걱정될 때 올바른 순서로 눌러 보세요.', items: ['응급이 아닌지 먼저 살핀다', 'AI 증상 상담에서 증상을 말한다', '답을 참고용으로 읽는다', '걱정이 남으면 병원에서 진료받는다'], why: '응급이면 119가 먼저이고, 아니면 상담은 참고이며 진료는 병원에서 받습니다.' }
  ] });

S('ch_kpolice', { n: 99, short: 'K-Police 치안 서비스', focus: '시뮬레이션이 맡는 것: 위급할 때 먼저 할 일과 K-Police·K-Watch의 역할 구분을 가상 장면으로 연습합니다. 소개 화면 문구를 바탕으로 한 초안이며 실제 신고는 하지 않습니다.',
  say: ['밤길이 무서운데 같이 확인해 줘.', '낯선 차가 계속 따라와요.', '신고 접수하면 사건번호 받을 수 있어?'],
  steps: [
    { k: 'sort', name: 'K-Police냐 K-Watch냐', q: '어느 쪽 이야기일까요?', buckets: ['K-Police', 'K-Watch'], items: [['대화 중 내 위험 신호를 감지해 신고한다', 0], ['야간 이동이나 낯선 차량 탑승을 미리 알린다', 0], ['제3자로서 목격한 사건을 다룬다', 1], ['길에서 본 일을 알리는 쪽이다', 1]], why: 'K-Police는 본인의 위험 신호, K-Watch는 제3자로서 목격한 사건을 다룹니다.' },
    { k: 'pick', name: '위급하다면', q: '가상 상황: 지금 누가 나를 위협하고 있습니다. 먼저 할 일은?', opts: ['앱을 열기보다 먼저 112에 직접 연락한다', '앱에서 사건번호가 나올 때까지 기다린다', '나중에 정리해서 신고한다'], a: 0, why: '위급할 때는 먼저 112에 직접 연락합니다.' },
    { k: 'order', name: '신고 흐름', q: '소개 화면이 설명하는 신고 뒤 흐름을 순서대로 눌러 보세요.', items: ['신고를 받는다', '사건번호를 발급한다', '위급한 사건은 가까운 요원에게 배정한다', '이력이 PDV에 6하원칙으로 암호화 기록된다'], why: '소개 화면의 설명 순서입니다. 평균 출동 시간 같은 수치는 소개용이며 제3자 검증 결과가 아닙니다.' }
  ] });

S('ch_k119', { n: 100, short: 'K-119 응급출동', focus: '시뮬레이션이 맡는 것: 생명이 위급할 때의 행동 순서와 중증도(1~4급)·출동번호가 하는 일을 가상 장면으로 연습합니다. 소개 화면 문구를 바탕으로 한 초안이며 실제 출동은 일어나지 않습니다.',
  say: ['할머니가 갑자기 쓰러지셨어요.', '집에 연기가 나는 것 같아요.', '내 신고 접수 번호 알려 줘.'],
  steps: [
    { k: 'pick', name: '먼저 할 일', q: '가상 상황: 가족이 쓰러져 의식이 없습니다. 가장 먼저 할 일은?', opts: ['앱을 열기 전에 119에 직접 전화한다', 'K-119 채팅에 상황을 길게 쓴다', '출동번호가 나올 때까지 기다린다'], a: 0, why: '생명이 위급하면 앱을 열기 전에 119에 직접 전화합니다.' },
    { k: 'sort', name: '소개 화면의 설명 분류', q: '이 문장은 소개 화면의 어떤 설명일까요?', buckets: ['미리 알림', '신고 뒤 처리'], items: [['심정지·낙상 감지 시 알린다', 0], ['화재 감지 시 알린다', 0], ['중증도를 1~4급으로 나눈다', 1], ['출동번호(FD-)를 발급한다', 1], ['가까운 소방서·구급대 배치를 안내한다', 1]], why: 'GPS·신체 정보·채팅으로 위험을 미리 알리고, 신고하면 급수와 출동번호가 붙습니다. 기록은 PDV에 남습니다.' },
    { k: 'pick', name: '수치 읽기', q: '소개 화면에 적힌 평균 도착 시간은 어떻게 읽어야 할까요?', opts: ['소개용 수치이며 제3자 검증 결과가 아니다', '검증된 보장 시간이다', '내 집에 반드시 그 시간에 온다는 약속이다'], a: 0, why: '평균 도착 시간 같은 수치는 제3자 검증 결과가 아닙니다.' }
  ] });

S('ch_kpublic', { n: 101, short: 'K-Public 행정 상담', focus: '시뮬레이션이 맡는 것: 지금 실제로 되는 상담과 개발되지 않은 대행 기능을 가르고, 내 부탁에 맞는 길을 고르는 연습입니다. 가상 부탁만 쓰며 실제 민원은 접수되지 않습니다.',
  say: ['전입신고는 어떻게 하는지 알려 줘.', '시설 신고 절차를 알고 싶어요.', '복지 신청하려면 뭐가 필요해요?'],
  steps: [
    { k: 'sort', name: '되는 것과 아닌 것', q: '지금 상태는 어디에 속할까요?', buckets: ['실제 동작', '개발되지 않음'], items: [['행정 절차 AI 상담(채팅, 24시간)', 0], ['지역 예산·사업 정보의 일반 안내', 0], ['민원을 AI가 대신 처리', 1], ['서류 자동 작성·제출', 1], ['처리 현황 실시간 보고', 1]], why: '일반 안내만 가능하고 실시간 공공데이터 연동은 아닙니다. 대신 처리나 제출은 개발되지 않았습니다.' },
    { k: 'pick', name: '내 부탁에 맞는 길', v: [
      { q: '가상 부탁: “전입신고 절차가 궁금해요.” 알맞은 쓰임은?', opts: ['K-Public 채팅으로 절차를 안내받는다', '이 서비스에 대신 접수해 달라고 맡긴다', '처리 현황을 실시간으로 받는다'], a: 0, why: '절차 안내가 지금 되는 일입니다. 대신 처리는 개발되지 않았습니다.' },
      { q: '가상 부탁: “신청서를 직접 작성해야 해요.” 알맞은 길은?', opts: ['“나비로” 같은 직역 사이트와 “서류 작성” 장을 이용한다', 'K-Public이 자동으로 작성해 제출한다', '작성은 포기한다'], a: 0, why: '서류를 직접 쓰려면 나비로 같은 직역 사이트와 서류 작성 장을 이용합니다.' }] },
    { k: 'pick', name: '실시간 정보', q: '“우리 지역 올해 사업 예산을 실시간으로 보여 줘”라고 했다면?', opts: ['일반 안내만 가능하며 실시간 공공데이터 연동은 아니다', '실시간 자료를 그대로 보여 준다', '예산은 아예 다루지 않는다'], a: 0, why: '지역 예산·사업 정보는 일반 안내만 가능합니다.' }
  ] });

S('ch_ksecurity', { n: 102, short: 'K-Security 보안 감시', focus: '시뮬레이션이 맡는 것: 감시 주기와 심각도 단계에 따른 일의 흐름을 가상 이상 신호로 따라가 봅니다. 소개 화면 문구를 바탕으로 한 초안이며 실제 시스템은 건드리지 않습니다.',
  say: ['나비웹 지금 안전해?', '보안 현황 공개된 거 보여 줘.', '해킹 의심되면 내가 뭘 해야 해?'],
  steps: [
    { k: 'order', name: '감시 흐름', q: '소개 화면이 설명하는 감시 흐름을 순서대로 눌러 보세요.', items: ['각 시스템의 에이전트가 30초마다 스스로 점검한다', '응답 시간·인증 상태·PDV 흐름을 보고한다', 'AI가 2단계로 분석하고 심각도(S1~S3)를 판정한다', '이상이 있으면 이해관계자에게 알린다'], why: '점검 대상은 하위 시스템 22개이며, 현황은 숨기지 않고 공개한다는 원칙입니다.' },
    { k: 'pick', name: '가장 심각한 단계', q: '가상 상황: 어떤 시스템의 심각도가 S3로 판정되었습니다. 소개 화면에 따르면?', opts: ['시스템 정지 지시와 K-Police 연동이 발동한다', '아무 일도 일어나지 않는다', '사용자가 직접 설정을 바꿔야 한다'], a: 0, why: '가장 심각한 S3 단계에서 시스템 정지 지시와 K-Police 연동이 발동한다고 적혀 있습니다.' },
    { k: 'pick', name: '나의 몫', q: '일반 사용자가 K-Security에서 설정해 둘 것은?', opts: ['없다 — 감시는 자동이고 현황은 공개된다', '30초마다 직접 점검 버튼을 누른다', '시스템 22개의 에이전트를 직접 설치한다'], a: 0, why: '일반 사용자가 설정할 것은 없습니다.' }
  ] });

S('ch_ktraffic', { n: 103, short: 'K-Traffic 교통·카풀 매칭', focus: '시뮬레이션이 맡는 것: “이동 중인 차량 동선에 수요를 끼워 넣는” 핵심 아이디어와 화면 구성을 가상 요청으로 연습합니다. 저장소 설명 기준이며 실제 운행 서비스 여부는 확인되지 않았습니다.',
  say: ['내일 아침 한림에서 제주시까지 같이 갈 차 있어?', '이번 달 내 이동 이력 보여 줘.', '운전자인데 가는 길에 손님 태울 수 있을까?'],
  steps: [
    { k: 'pick', name: '핵심 아이디어', q: '새 이동 수요를 어떻게 처리하는 서비스일까요?', opts: ['이미 이동 중인 차량의 동선에 끼워 넣어 경로를 짠다', '수요마다 빈 차를 새로 보낸다', '이동 수요를 받지 않고 지도만 보여 준다'], a: 0, why: '이미 이동 중인 차량의 동선에 새 수요를 끼워 넣는 것이 핵심입니다.' },
    { k: 'sort', name: '어느 화면인가', q: '저장소 설명의 화면 분류로 맞는 쪽은?', buckets: ['운전자·사무 이용자용', '스마트폰용'], items: [['AI 채팅 매칭', 0], ['GDC 지갑', 0], ['차량 탐색', 1], ['탑승 요청', 1]], why: '이 밖에 내 이동 이력, 전국 현황판, 관제 센터용 지도 화면이 따로 있다고 적혀 있습니다.' },
    { k: 'pick', name: '기록과 현재 상태', v: [
      { q: '탑승·평가·긴급 이벤트는 어디에 기록되고 무엇과 이어지도록 설계되었나요?', opts: ['PDV에 기록되고 K-Insurance의 탑승 보험과 이어지도록 설계되었다', '기록하지 않는다', '메일로만 보내고 보관하지 않는다'], a: 0, why: '기록은 PDV에 남고 보험 연결은 설계 단계입니다.' },
      { q: '이 서비스로 지금 바로 차를 호출할 수 있다고 말해도 될까요?', opts: ['안 된다 — 실제 운행 서비스 여부는 확인되지 않았다', '된다', '확인할 필요가 없다'], a: 0, why: '확인되면 화면을 따라가며 장을 다시 쓴다고 적혀 있습니다.' }] }
  ] });

S('ch_klogistics', { n: 104, short: 'K-Logistics 물류 매칭', focus: '시뮬레이션이 맡는 것: 이동 중인 차량 동선에 화물을 끼워 넣는 구조와 화면 구성을 가상 배송 요청으로 연습합니다. 저장소 설명 기준이며 실제 배송 서비스 여부는 확인되지 않았습니다.',
  say: ['이 박스를 모레까지 서귀포로 보내고 싶어.', '내 배송 이력이랑 쓴 GDC 좀 보여 줘.', '지금 택배 어디쯤 왔어?'],
  steps: [
    { k: 'pick', name: '무엇을 끼우나', q: 'K-Logistics가 화물을 끼워 넣는 대상은?', opts: ['이미 이동 중인 차량의 동선', '새로 만든 전용 노선', '창고 안의 선반'], a: 0, why: 'K-Traffic과 같은 구조로, 이미 이동 중인 차량 동선에 화물을 끼워 넣습니다.' },
    { k: 'sort', name: '어느 화면인가', q: '저장소 설명의 화면 분류로 맞는 쪽은?', buckets: ['스마트폰 화면', '개인 발송자 화면'], items: [['AI 물류 채팅 매칭', 0], ['배송 요청과 실시간 추적', 0], ['내 배송 이력', 1], ['GDC 지출', 1], ['OpenHash 증빙 조회', 1]], why: '이 밖에 전국 물류 현황판과 관제 센터 화면이 따로 있습니다.' },
    { k: 'pick', name: '지금 상태', q: '“오늘 실제로 배송을 맡길 수 있다”는 말에 대해 맞는 판단은?', opts: ['실제 배송 서비스 여부는 확인되지 않아 단정할 수 없다', '당연히 맡길 수 있다', '절대 불가능하다고 확정되었다'], a: 0, why: '확인되면 화면을 따라가며 다시 쓴다고 적혀 있어, 지금은 저장소 설명 기준으로만 읽습니다.' }
  ] });

S('ch_kdemocracy', { n: 105, short: 'K-Democracy 평행 세계 입법', focus: '시뮬레이션이 맡는 것: 가상 안건 하나로 의결권과 효력의 범위를 계산·판단해 봅니다. 이 서비스의 결정은 평행 세계의 가상 입법이며 현실의 법적 효력이 없습니다.',
  say: ['우리 동네 쓰레기 분리 규칙을 안건으로 올리고 싶어.', '지금 올라온 안건 보여 줘.', '이 투표 결과는 법으로 인정돼?'],
  steps: [
    { k: 'calc', name: '공헌도 비례 의결권', gen: function (r) { var a = ri(r, 2, 6) * 10, b = ri(r, 1, 4) * 10, c = ri(r, 1, 3) * 10, t = a + b + c; return { q: '가상 안건입니다. 공헌도가 가 ' + a + '점, 나 ' + b + '점, 다 ' + c + '점이고 의결권은 공헌도에 비례한다고 가정합니다. 가의 의결권 비율은 몇 %일까요?', facts: '의결권은 공헌도에 비례합니다(가정 점수).', a: Math.round(a / t * 100), tol: 1, unit: '%', why: a + ' ÷ ' + t + ' × 100 로 계산합니다. 점수는 연습용 가정입니다.', hint: '내 점수 ÷ 전체 점수 × 100.' }; } },
    { k: 'order', name: '안건이 결정되기까지', q: '설명에 맞게 순서대로 눌러 보세요.', items: ['누군가 안건을 제안한다', '공헌도에 비례한 의결권으로 결정한다', '결과를 OpenHash에 영구 기록한다'], why: '누구나 제안할 수 있고 결과는 OpenHash에 영구 기록됩니다.' },
    { k: 'pick', name: '이 결정의 효력', q: '가상 결정: 평행 세계에서 “밤 10시 이후 소음 금지”가 통과되었습니다. 현실에서의 의미는?', opts: ['평행 세계의 가상 입법이라 현실의 법적 효력이 없다', '현실에서도 바로 법이 된다', '현실의 헌법보다 우선한다'], a: 0, why: '고팡의 원칙과 규칙은 현실의 헌법·법률에 종속되며, 이 서비스의 결정은 현실의 법적 효력이 없습니다.' }
  ] });

S('ch_kconst', { n: 106, short: 'K-Const 가상 결정 시뮬레이션', focus: '시뮬레이션이 맡는 것: 5개 심판유형을 구분하고, 이 서비스가 실제 헌법재판소 결정이 아님을 가려 읽는 연습입니다. 방법론 문서 중심이라 사용자 화면은 확인되지 않았고, 아래는 모두 가상입니다.',
  say: ['이 법률이 헌법에 어긋나는지 가상으로 따져 줘.', '탄핵심판은 어떤 걸 다루는 거야?', '이 결과가 실제 결정이야?'],
  steps: [
    { k: 'sort', name: '5개 심판유형 고르기', q: '이 유형은 K-Const가 다루는 5개 심판유형에 포함될까요?', buckets: ['포함', '포함되지 않음'], items: [['위헌법률심판', 0], ['헌법소원심판', 0], ['탄핵심판', 0], ['정당해산심판', 0], ['권한쟁의심판', 0], ['형사재판', 1]], why: '심판유형 5가지는 법에 정해져 있습니다. 형사재판은 법원의 일이라 K-Const 범위가 아닙니다.' },
    { k: 'sort', name: 'K-Law와 다른 점', q: '이 말은 어느 쪽에 맞을까요?', buckets: ['K-Const(헌법재판소)', 'K-Law(법원)'], items: [['독립된 헌법기관을 다룬다', 0], ['“결정”을 한다', 0], ['“판결”을 한다', 1], ['심판유형이 법에 5가지로 정해져 있다', 0]], why: 'K-Const는 K-Law의 자매 시스템이며 별도 저장소입니다. 헌법재판소는 법원이 아니라 독립된 헌법기관이고 공리 체계가 다릅니다.' },
    { k: 'pick', name: '결과를 읽을 때', q: '가상 결과에 “일치도 높음”이라고 적혀 있습니다. 어떻게 읽을까요?', opts: ['자체 실험 수치이며 제3자 검증을 받지 않았고 실제 결정도 아니다', '실제 헌법재판소가 이미 내린 결정이다', '제3자가 검증한 정확도이다'], a: 0, why: '이 서비스는 가상 결정 시뮬레이션이며 일치도 같은 수치는 제3자 검증을 받지 않았습니다.' }
  ] });

S('ch_kjit', { n: 107, short: 'K-JIT 적시조달(준비 중)', focus: '시뮬레이션이 맡는 것: 준비 중인 초안(v0.1)의 목표와 기존 JIT의 차이를 가려 읽는 연습입니다. 서비스 목록과 라우팅에 아직 없으므로 실제로 쓸 수 있는 화면이 아니며 모두 설계 단계의 말입니다.',
  say: ['우리 가게에 필요한 물자를 적시에 조달해 줘.', 'K-JIT는 언제부터 쓸 수 있어?', '기존 JIT랑 뭐가 달라?'],
  steps: [
    { k: 'sort', name: '목표가 다른 점', q: '이 문장은 어느 쪽 설명일까요?', buckets: ['기존 JIT', 'K-JIT 초안'], items: [['개별 주체의 비용 최소화를 목표로 한다', 0], ['사회 전체의 효용 극대화를 목표로 한다', 1], ['총비용 최소화를 목표로 한다', 1]], why: 'K-JIT는 개별 비용이 아니라 사회 전체의 효용 극대화와 총비용 최소화를 목표로 삼습니다.' },
    { k: 'pick', name: '지금 쓸 수 있나', q: '“K-JIT로 지금 주문해 줘”라고 했다면 맞는 이해는?', opts: ['초안·준비 중이라 서비스 목록에 없고 라우팅에도 연결되지 않았다', '지금 바로 주문된다', '이미 모든 기관에 연결되어 있다'], a: 0, why: '저장소 기준 초안(v0.1)이며 서비스가 열리면 화면과 쓰는 방법을 채웁니다.' },
    { k: 'pick', name: '이어지는 서비스', q: '설계상 K-JIT와 이어지는 서비스 짝은?', opts: ['K-Logistics와 K-Market', 'K-Const와 K-Democracy', 'K-Health와 K-Police'], a: 0, why: 'K-Logistics·K-Market과 이어지는 서비스로 설계돼 있습니다.' }
  ] });

})();
