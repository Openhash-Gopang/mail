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

var SC = {};     // 장 id → 시나리오
var PN = null, CUR = null, prevFocus = null, SV = null;
// SV = { id, seed, salt, i, res:[{tries, first, done}] }
function S(id, o) { o.id = id; SC[id] = o; }
var onQuizCb = null;

/* ── 단계 유형별 그리기 ───────────────────────────────────────────── */
function rngFor(i) { return mk(SV.seed * 31 + i * 7919 + SV.salt * 104729 + 17); }
function pickItem(step, i) { if (step.gen) return step.gen(rngFor(i)); if (step.v) return step.v[(SV.seed + i + SV.salt) % step.v.length]; return step; }
function note(box, cls, txt) { var o = box.querySelector('.fb'); if (o) o.remove(); box.appendChild(h('div', { class: 'fb ' + cls, role: 'status', text: txt })); }
function finish(i, box, why) {
  var R = SV.res[i]; R.done = true; if (why) note(box, 'ok', '✔ ' + why);
  var nxt = i + 1 < SC[SV.id].steps.length;
  box.appendChild(h('div', { class: 'row' }, [h('button', { type: 'button', class: 'pri', id: 'hw-next', text: nxt ? '다음 단계' : '결과 보기', onclick: function () { SV.i = i + 1; render(); } })]));
  dots();
}
function again(i, box) {
  if (box.querySelector('.hw-again')) return;
  box.appendChild(h('div', { class: 'row hw-again' }, [h('button', { type: 'button', id: 'hw-again', text: '다른 상황으로 한 번 더', onclick: function () { SV.salt++; SV.res[i] = { tries: SV.res[i].tries, first: SV.res[i].first, done: false }; render(); } })]));
}
var TYPES = {};
TYPES.pick = function (step, i, box) {
  var it = pickItem(step, i), r = rngFor(i + 100), idx = it.opts.map(function (_, k) { return k; }), ord = it.fixed ? idx : shuf(idx, r), R = SV.res[i];
  box.appendChild(h('div', { class: 'q', text: it.q }));
  var wrap = h('div', { class: 'opts' });
  ord.forEach(function (k) {
    wrap.appendChild(h('button', { type: 'button', 'data-k': String(k), text: it.opts[k], onclick: function () {
      if (R.done) return; R.tries++;
      var okk = Array.isArray(it.a) ? it.a.indexOf(k) >= 0 : it.a === k;
      if (okk) { if (R.first == null) R.first = true; Array.prototype.forEach.call(wrap.children, function (b) { b.disabled = true; }); finish(i, box, it.why); }
      else { if (R.first == null) R.first = false; note(box, 'no', '아니에요. ' + ((it.no && it.no[k]) || '다시 골라 보세요.')); if (R.tries >= 2) { note(box, 'no', '아니에요. ' + ((it.no && it.no[k]) || '다시 골라 보세요.') + ' (힌트: ' + (it.hint || it.why) + ')'); again(i, box); } }
    } }));
  });
  box.appendChild(wrap);
};
TYPES.sort = function (step, i, box) {
  var it = pickItem(step, i), r = rngFor(i + 100), order = shuf(it.items.map(function (_, k) { return k; }), r), R = SV.res[i], pick = {}, rows = {};
  box.appendChild(h('div', { class: 'q', text: it.q }));
  order.forEach(function (k) {
    var row = h('div', { class: 'sorti', 'data-k': String(k) }, [h('div', { class: 't', text: it.items[k][0] })]);
    it.buckets.forEach(function (b, bi) { row.appendChild(h('button', { type: 'button', 'data-b': String(bi), text: b, onclick: function () { if (R.done) return; pick[k] = bi; Array.prototype.forEach.call(row.querySelectorAll('button'), function (x) { x.className = x.getAttribute('data-b') === String(bi) ? 'cur' : ''; }); row.className = 'sorti'; } })); });
    rows[k] = row; box.appendChild(row);
  });
  box.appendChild(h('div', { class: 'row' }, [h('button', { type: 'button', class: 'pri', id: 'hw-check', text: '확인', onclick: function () {
    if (R.done) return; if (Object.keys(pick).length < it.items.length) { note(box, 'nt', '모든 항목을 하나씩 골라 주세요.'); return; }
    R.tries++; var bad = 0; it.items.forEach(function (x, k) { var okk = pick[k] === x[1]; rows[k].className = 'sorti ' + (okk ? 'good' : 'bad'); if (!okk) bad++; });
    if (!bad) { if (R.first == null) R.first = true; finish(i, box, it.why); }
    else { if (R.first == null) R.first = false; note(box, 'no', bad + '개가 달라요. 붉게 표시된 줄만 다시 골라 확인해 보세요.'); if (R.tries >= 2) again(i, box); }
  } })]));
};
TYPES.order = function (step, i, box) {
  var it = pickItem(step, i), r = rngFor(i + 100), R = SV.res[i], n = it.items.length, nextIdx = 0, shown = shuf(it.items.map(function (_, k) { return k; }), r), list = h('ol', { class: 'seq' });
  box.appendChild(h('div', { class: 'q', text: it.q })); box.appendChild(h('div', { class: 'sub', text: '맨 처음 할 일부터 차례로 눌러 보세요.' }));
  var wrap = h('div', { class: 'ordl' });
  shown.forEach(function (k) {
    wrap.appendChild(h('button', { type: 'button', 'data-k': String(k), text: it.items[k], onclick: function (ev) {
      if (R.done) return; var b = ev.currentTarget; if (b.className === 'used') return;
      if (k === nextIdx) { b.className = 'used'; list.appendChild(h('li', { text: it.items[k] })); nextIdx++; if (R.first == null && R.tries === 0) R.first = true; if (nextIdx === n) { if (R.first == null) R.first = false; Array.prototype.forEach.call(wrap.children, function (x) { x.disabled = true; }); finish(i, box, it.why); } }
      else { R.tries++; R.first = false; note(box, 'no', '아직은 이 단계가 아니에요. ' + (it.hint || '앞에 먼저 해야 할 일이 있어요.')); if (R.tries >= 3) again(i, box); }
    } }));
  });
  box.appendChild(wrap); box.appendChild(list);
};
TYPES.zone = function (step, i, box) {
  var it = pickItem(step, i), L = step.lay || it.lay, R = SV.res[i];
  box.appendChild(h('div', { class: 'q', text: it.q }));
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
  box.appendChild(h('div', { class: 'q', text: it.q })); if (it.facts) box.appendChild(h('div', { class: 'sub', text: it.facts }));
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
  box.appendChild(h('div', { class: 'q', text: it.q })); if (it.facts) box.appendChild(h('div', { class: 'sub', text: it.facts }));
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
  box.appendChild(h('div', { class: 'q', text: it.q })); box.appendChild(h('div', { class: 'sub', text: '기록은 앞 기록의 지문을 이어 쌓여요. 줄 하나를 몰래 고쳐 보고, 어디부터 지문이 어긋나는지 보세요(서로 다른 줄을 2번 해 보면 끝나요).' }));
  var draw = function (fix) {
    out.textContent = ''; var prev = '00000000', good = [], bad = -1, sh = rows.map(function (x, k) { return fix === k ? x + ' (고침)' : x; });
    rows.forEach(function (x) { prev = fnv(prev + x); good.push(prev); }); prev = '00000000';
    sh.forEach(function (x, k) { var hh = fnv(prev + x); if (hh !== good[k] && bad < 0) bad = k; prev = good[k]; });
    var tb = h('table', {}, [h('tr', {}, [h('th', { text: '번호' }), h('th', { text: '기록' }), h('th', { text: '지문' }), h('th', { text: '' })])]);
    sh.forEach(function (x, k) { tb.appendChild(h('tr', {}, [h('td', { text: String(k + 1) }), h('td', { text: x }), h('td', { class: 'mono' + (bad >= 0 && k >= bad ? ' bad' : ''), text: good[k] }), h('td', {}, [h('button', { type: 'button', 'data-fix': String(k), text: '몰래 고치기', onclick: function () { if (R.done) return; if (!tried[k]) { tried[k] = 1; cnt++; } draw(k); if (cnt >= 2) { R.tries++; if (R.first == null) R.first = true; if (!box.querySelector('#hw-next')) finish(i, box, it.why); } } })])])); });
    out.appendChild(tb);
    out.appendChild(h('div', { class: 'fb ' + (bad >= 0 ? 'no' : 'nt'), id: 'hw-chain', text: bad >= 0 ? (bad + 1) + '번째 기록부터 지문이 앞 기록과 맞지 않아요. 고친 흔적이 드러나요.' : '아직 아무것도 고치지 않았어요. 모든 지문이 이어져 있어요.' }));
  };
  draw(-1); box.appendChild(out);
};
TYPES.live = function (step, i, box) { var R = SV.res[i]; step.live(box, { seed: SV.seed + SV.salt, rng: rngFor(i), done: function (why) { if (R.done) return; R.tries++; if (R.first == null) R.first = true; finish(i, box, why); }, h: h, won: won, mk: mk, shuf: shuf, fnv: fnv, ri: ri }); };

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
  var row = h('div', { class: 'row' }, [h('button', { type: 'button', class: 'pri', id: 'hw-restart', text: '새 상황으로 다시 하기', onclick: function () { SV.salt++; SV.i = 0; SV.res = sc.steps.map(function () { return { tries: 0, first: null, done: false }; }); render(); } })]);
  if (onQuizCb) row.appendChild(h('button', { type: 'button', id: 'hw-quiz', text: '이 장의 퀴즈로 가기', onclick: function () { close(); try { onQuizCb(SV ? SV.id : sc.id); } catch (e) { /* 무시 */ } } }));
  if (sc.page && typeof window._simOpen === 'function') row.appendChild(h('button', { type: 'button', id: 'hw-page', text: '이 장과 짝인 나비웹 화면 시뮬레이션', onclick: function () { var p = sc.page; close(); setTimeout(function () { try { window._simOpen(p[0], p[1]); } catch (e) { /* 무시 */ } }, 260); } }));
  box.appendChild(row);
}
function render() {
  if (!PN || !SV) return; var sc = SC[SV.id], box = D.getElementById('hw-body'); if (!box) return; box.textContent = '';
  dots();
  if (SV.i >= sc.steps.length) { summary(box, sc); return; }
  var st = sc.steps[SV.i]; box.appendChild(h('div', { class: 'sub', text: (SV.i + 1) + '/' + sc.steps.length + ' · ' + st.name }));
  var card = h('div', { class: 'card', id: 'hw-card' }); TYPES[st.k](st, SV.i, card); box.appendChild(card);
  if (SV.res[SV.i].done) { var nxt = SV.i + 1 < sc.steps.length; card.appendChild(h('div', { class: 'row' }, [h('button', { type: 'button', class: 'pri', id: 'hw-next', text: nxt ? '다음 단계' : '결과 보기', onclick: function () { SV.i++; render(); } })])); }
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
  SV = { id: id, seed: seed != null ? seed : ((Date.now() / 1000) | 0) % 100000, salt: 0, i: 0, res: sc.steps.map(function () { return { tries: 0, first: null, done: false }; }) }; CUR = id; prevFocus = D.activeElement;
  var hd = h('div', { class: 'hd' }, [
    h('div', { style: 'display:flex;justify-content:space-between;gap:8px' }, [h('h2', { id: 'hw-title' }, [sc.n + '장 · ' + sc.short + ' 시뮬레이션', h('span', { class: 'bd', text: '가상 상황' })]), h('button', { type: 'button', id: 'hw-close', text: '닫기', onclick: close })]),
    h('div', { class: 'role' }, [
      h('div', {}, [h('b', { text: '연습 예제 ' }), '실제 화면에서 한 번 직접 해 보기']),
      h('div', {}, [h('b', { text: '퀴즈 ' }), '개념 확인 · 장 완료에 반영']),
      h('div', {}, [h('b', { class: 'me', text: '시뮬레이션' }), ' 가상 상황에서 틀려 보며 반복 · 어디에도 반영되지 않음'])]),
    h('div', { class: 'sub', text: sc.focus }),
    h('div', { id: 'hw-dots', class: 'dots', role: 'group', 'aria-label': '단계' })]);
  PN = h('aside', { class: 'nhow-pn', id: 'nhow-pn', role: 'complementary', 'aria-labelledby': 'hw-title' }, [hd, h('div', { id: 'hw-body', class: 'bdy' })]);
  D.body.appendChild(PN); D.addEventListener('keydown', onKey, true); setTimeout(function () { if (PN) D.addEventListener('click', onOutside, true); }, 0);
  render(); requestAnimationFrame(function () { if (PN) PN.classList.add('on'); }); if (!window.requestAnimationFrame && PN) PN.classList.add('on');
  var c = D.getElementById('hw-close'); if (c) c.focus(); return true;
}

/* ── 자주 쓰는 가상 화면 배치(구역 찾기) ──────────────────────────── */
var LAY = {
  home: { cols: '90px 1fr', areas: ['brand top', 'side main', 'side ex', 'side input'], cells: [['brand', '나비 아이콘 · 소개 ▾'], ['top', '위쪽 오른편(내 사진·아이디)'], ['side', '왼쪽 메뉴'], ['main', '가운데 화면(대화·결과)'], ['ex', '예시 버튼 · 예시 줄'], ['input', '입력창 (＋ 🎤 ↑)']] }
};

window.NaviHowto = {
  open: open, close: close, has: function (id) { return !!SC[id]; }, ids: function () { return Object.keys(SC); },
  meta: function (id) { var s = SC[id]; return s ? { n: s.n, short: s.short, focus: s.focus, say: s.say, page: s.page, steps: s.steps.map(function (x) { return x.name; }) } : null; },
  onQuiz: function (fn) { onQuizCb = fn; }, _S: S, _LAY: LAY, _h: h, _fnv: fnv, _mk: mk, _ri: ri, _won: won, _shuf: shuf
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
})();
