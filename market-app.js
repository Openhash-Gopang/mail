/* market-app.js — 나비웹 시장(인프라 AI · 시장). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviMarket.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 market.css(.mkt 범위). 전역은 NaviMarket 하나만 쓴다.
 *
 * 시장 화면의 특징(주피터 지시, 설계 원칙): 시장 인프라는 기존 공정거래위원회의 사회적 역할과 기능을 확장한다.
 *  - 모든 상품(물품·서비스)의 가격 공정성, 품질 기준 달성 여부, 고객 만족도를 평가·측정하므로 어떤 재화나 용역도 공정 가격을 현저히 벗어날 수 없다.
 *  - 첫째, 그 물품·서비스가 사용자에게 실제로 필요한지 판단하고 불필요한 구매의 자제를 요청한다.
 *  - 둘째, 은행 등 금융 인프라와 협업해 사용자가 팔려는 물품·서비스를 시장 인프라가 먼저 사고 대금을 차등 지급한다.
 *    예) 급히 부동산을 팔려는 사용자: 감정 평가 후 예상 매각 금액의 10~50%를 선지급, 나머지는 매각이 성사된 뒤 지급하고 금융 인프라가 부과한 이자를 차감한다.
 * 이 화면은 위 원리 가운데 계산할 수 있는 부분을 사용자가 넣은 값으로 계산해 보여 준다:
 *  fairPrice(비교 가격 대비 가격 편차), qualityRate, satisfaction, needCheck(구매 필요성 점검), presale(선지급·이자·잔금).
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 시장 전체의 가격·품질·만족도 측정, 감정 평가, 선구매와 대금 지급, 금융 인프라 연결은 아직 설계 단계로 연결되어 있지 않다. 이 화면은 거래·지급·감정을 하지 않고 어떤 정보도 밖으로 보내지 않는다.
 *  - 비교 가격·이자율·감정가는 모두 사용자가 넣은 값이며 실제 시세나 금융 조건이 아니다. 입력값과 메모는 이 브라우저(localStorage)에만 저장된다.
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
var KEY = 'navi-market-v1', MAXP = 100;
var TABS = [['principle', '시장 원리'], ['eval', '상품 평가'], ['need', '필요 판단'], ['presale', '선구매']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var KINDS = ['부동산', '물품', '서비스'], STATES = ['검토 중', '매각 완료'];
var M = null, LS = {};
var S = { view:'principle', list:[], err:{}, msg:'',
  fp:{ refs:'', price:'', th:'30' }, ql:{ total:'', met:'' }, sat:{ r:'' },
  nd:{ price:'', budget:'', owned:'no', uses:'often', plan:'plan', alt:'no' },
  ps:{ item:'', kind:'부동산', value:'', rate:'30', annual:'', days:'', actual:'' } };

function field(id, label, val, o) {
  o = o || {}; var e = o.err, inp = h('input', { id:id, type:'text', value:val == null ? '' : val, placeholder:o.ph || '', maxlength:o.max || '60', inputmode:o.mode || '', autocomplete:'off', 'aria-invalid':e ? 'true' : 'false' });
  inp.oninput = function () { if (o.set) o.set(inp.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), inp, h('div', { id:id + '-h', class:e ? 'err' : 'help', text:e || o.help || '' })]);
}

function empty(t, b) { return h('div', { class:'card', style:'margin-top:16px' }, [h('div', { class:'empty', text:t }), b ? h('div', { class:'rowf', style:'justify-content:center' }, [b]) : null]); }

function head(title, lead) { return [h('h1', { text:title }), lead ? h('p', { class:'lead', text:lead }) : null]; }
function go(v) { S.view = v; S.err = {}; S.msg = ''; render(); try { M.scrollIntoView({ block:'start' }); } catch (e) {} }function topbar() {
  return h('div', { class:'topin' }, [
    h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 시장' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function notice() {
  return h('div', { class:'note info', style:'margin:16px 0', id:'mk-note', text:'이 화면은 거래·지급·감정을 하지 않고 어떤 정보도 밖으로 보내지 않습니다. 내가 넣은 값으로 계산해 보는 것이고 이 브라우저에만 저장돼요. 실제 시세나 금융 조건이 아니에요.' });
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
  if (!x || typeof x !== 'object' || KINDS.indexOf(x.kind) < 0 || STATES.indexOf(x.st) < 0) return null;
  var v = Number(x.value), r = Number(x.rate); if (!(v > 0) || v > 1e15 || Math.floor(v) !== v || !(r >= 10 && r <= 50)) return null;
  return { id:clean(x.id, 20) || uid(), item:clean(x.item, 40), kind:x.kind, value:v, rate:r, adv:Math.round(v * r / 100), st:x.st, d:/^\d{4}-\d{2}-\d{2}$/.test(x.d) ? x.d : '' };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ list:S.list })); } catch (e) {} }

/** 가격 공정성: 사용자가 넣은 비교 가격(3개 이상)의 중앙값 대비 편차. th(%) 이상 벗어나면 공정 범위 밖. */
function fairPrice(refs, price, th) {
  var xs = (refs || []).map(numOf), p = numOf(price), t = numOf(th);
  if (xs.length < 3 || xs.some(function (x) { return !isFinite(x) || x <= 0; }) || !isFinite(p) || p <= 0 || !(t > 0) || t > 500) return null;
  var s = xs.slice().sort(function (a, b) { return a - b; }), n = s.length, med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2, dev = (p - med) / med;
  return { median:med, dev:dev, out:Math.abs(dev) * 100 >= t, side:dev > 0 ? 'high' : dev < 0 ? 'low' : 'same' };
}
/** 품질 기준 달성률: 기준 total개 중 met개 충족. */
function qualityRate(total, met) {
  var t = numOf(total), m = numOf(met); if (!isFinite(t) || !isFinite(m) || t < 1 || t > 1000 || Math.floor(t) !== t || m < 0 || m > t || Math.floor(m) !== m) return null;
  return { total:t, met:m, rate:m / t, all:m === t };
}
/** 고객 만족도: 1~5점 평가들의 평균과 4점 이상 비율. */
function satisfaction(ratings) {
  var xs = (ratings || []).map(numOf); if (!xs.length || xs.length > 5000 || xs.some(function (x) { return !(x >= 1 && x <= 5) || Math.floor(x) !== x; })) return null;
  var sum = xs.reduce(function (a, b) { return a + b; }, 0), hi = xs.filter(function (x) { return x >= 4; }).length;
  return { n:xs.length, avg:sum / xs.length, hi:hi / xs.length };
}
/** 구매 필요성 점검: 사용자가 답한 사실로 사유를 모은다. 판단은 권유일 뿐 결정은 사용자가 한다. */
function needCheck(o) {
  var r = [], price = numOf(o.price), budget = numOf(o.budget);
  if (o.owned === 'ok') r.push('쓸 수 있는 같은 물건이 이미 있어요');
  if (isFinite(price) && isFinite(budget) && price > budget) r.push('여유 예산 ' + won(budget) + '원을 ' + won(price - budget) + '원 넘어요');
  if (o.uses === 'rare') r.push('거의 쓰지 않을 것 같아요');
  if (o.plan === 'impulse') r.push('계획 없이 떠오른 충동 구매예요');
  if (o.alt === 'yes') r.push('빌리거나 중고·대여로 대체할 수 있어요');
  return { reasons:r, level:r.length >= 2 ? 'hold' : r.length === 1 ? 'think' : 'ok' };
}
/** 선구매: 예상 매각 금액(value)의 rate%(10~50)를 먼저 받고, 매각 성사 뒤 나머지에서 선지급액에 붙은 이자를 뺀 금액을 받는다. 이자 = 선지급액 × 연이율 × 일수/365. */
function presale(value, rate, annual, days, actual) {
  var v = snum(value), r = numOf(rate), a = numOf(annual), d = numOf(days), act = actual === '' || actual == null ? null : snum(actual);
  if (!isFinite(v) || v <= 0 || v > 1e15 || !(r >= 10 && r <= 50) || !isFinite(a) || a > 100 || !isFinite(d) || d > 3650 || Math.floor(d) !== d || (act !== null && (!isFinite(act) || act <= 0 || act > 1e15))) return null;
  var adv = Math.round(v * r / 100), interest = Math.round(adv * a / 100 * d / 365), sale = act === null ? v : act, after = sale - adv - interest;
  return { adv:adv, interest:interest, sale:sale, after:after, total:adv + after, real:act !== null };
}
function snum(v) { var s = String(v == null ? '' : v).replace(/[,\s원]/g, ''); return /^\d+$/.test(s) ? Number(s) : NaN; }

// ── 시장 원리 ──
function viewPrinciple() {
  var kids = head('시장 원리', '나비웹 시장 인프라는 기존 공정거래위원회의 사회적 역할과 기능을 확장합니다.');
  kids.push(stepsCard('시장 인프라가 하는 일', [['가격·품질·만족도를 평가하고 측정', '모든 상품(물품·서비스)의 가격 공정성, 품질 기준 달성 여부, 고객 만족도를 측정해서 어떤 재화나 용역도 공정 가격을 현저히 벗어날 수 없게 합니다.'], ['첫째, 정말 필요한지 판단', '그 물품이나 서비스가 사용자에게 실제로 필요한지 판단하고, 불필요한 구매는 자제하도록 요청합니다.'], ['둘째, 팔려는 물건을 먼저 사고 대금을 차등 지급', '은행 등 금융 인프라와 협업해 사용자가 팔려는 물품이나 서비스를 시장 인프라가 먼저 삽니다. 급히 부동산을 팔려는 경우 감정 평가 뒤 예상 매각 금액의 10~50%를 먼저 지급하고, 나머지는 매각이 성사된 뒤 지급하며 금융 인프라가 부과한 이자를 뺍니다.']],
    '설계 원칙입니다. 시장 전체 측정, 감정 평가, 선구매와 대금 지급은 아직 연결되어 있지 않아요. 이 화면은 같은 원리를 내가 넣은 값으로 계산해 볼 수 있게 한 것입니다.'));
  kids.push(h('div', { class:'g2', style:'margin-top:16px' }, [['상품 평가', '비교 가격 대비 편차, 품질 달성률, 고객 만족도', 'eval'], ['필요 판단', '사기 전에 정말 필요한지 점검', 'need'], ['선구매', '선지급액과 이자, 매각 후 받을 금액 계산', 'presale']].map(function (x) { return h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:x[0] }), h('span', { class:'sub', text:x[1] }), h('div', { class:'rowf' }, [btn('열기', 'fill', function () { go(x[2]); })])]); })));
  return kids;
}

// ── 상품 평가 ──
function viewEval() {
  var kids = head('상품 평가', '가격이 공정한지, 품질 기준을 채웠는지, 고객이 만족하는지 확인합니다.'); kids.push(notice());
  var f = S.fp, q = S.ql, s = S.sat, fo = h('div', { id:'mk-f-out', style:'margin-top:12px' }), qo = h('div', { id:'mk-q-out', style:'margin-top:12px' }), so = h('div', { id:'mk-s-out', style:'margin-top:12px' });
  function fu() { fo.textContent = ''; var r = fairPrice(f.refs.split(/[\s,]+/).filter(Boolean), f.price, f.th); fo.appendChild(!r ? h('div', { class:'sub', text:'비교 가격 3개 이상과 이 상품의 가격을 넣으면 공정 범위인지 알려 줘요.' }) : h('div', { id:'mk-f-res', class:r.out ? 'note' : 'note info', role:r.out ? 'alert' : null, text:'비교 가격의 중앙값 ' + won(r.median) + '원 — 이 상품은 ' + Math.round(Math.abs(r.dev) * 1000) / 10 + '% ' + (r.side === 'high' ? '비싸요' : r.side === 'low' ? '싸요' : '같아요') + (r.out ? ' → 공정 가격 범위를 벗어났어요.' : ' → 공정 범위예요.') })); }
  function qu() { qo.textContent = ''; var r = qualityRate(q.total, q.met); qo.appendChild(!r ? h('div', { class:'sub', text:'기준 수와 충족한 수를 정수로 넣어 주세요.' }) : h('div', { id:'mk-q-res', class:r.all ? 'note info' : 'note', text:'품질 기준 ' + r.total + '개 중 ' + r.met + '개 충족(' + Math.round(r.rate * 100) + '%)' + (r.all ? ' → 모두 달성했어요.' : ' → 미달 기준이 ' + (r.total - r.met) + '개 있어요.') })); }
  function su() { so.textContent = ''; var r = satisfaction(s.r.split(/[\s,]+/).filter(Boolean)); so.appendChild(!r ? h('div', { class:'sub', text:'1~5점 평가를 쉼표로 구분해 넣어 주세요.' }) : h('div', { id:'mk-s-res', class:'note info', text:'평가 ' + r.n + '건, 평균 ' + (Math.round(r.avg * 10) / 10) + '점, 4점 이상 ' + Math.round(r.hi * 100) + '%' })); }
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'가격 공정성' }), h('div', { class:'sub', text:'같은 물품·서비스의 다른 곳 가격을 비교 가격으로 넣어 주세요. 실제 시세가 아니라 내가 넣은 값으로만 계산해요.' }), h('div', { class:'frm' }, [field('mk-f-refs', '비교 가격(원, 쉼표로 구분, 3개 이상)', f.refs, { ph:'예: 95000, 100000, 105000', max:120, set:function (v) { f.refs = v; fu(); } }), field('mk-f-price', '이 상품 가격(원)', f.price, { mode:'numeric', max:15, set:function (v) { f.price = v; fu(); } }), field('mk-f-th', '공정 범위(중앙값에서 ±%)', f.th, { mode:'decimal', max:4, set:function (v) { f.th = v; fu(); } })]), fo])); fu();
  kids.push(h('div', { class:'g2', style:'margin-top:16px;align-items:start' }, [h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'품질 기준 달성' }), h('div', { class:'frm' }, [field('mk-q-total', '확인한 품질 기준 수', q.total, { mode:'numeric', max:4, set:function (v) { q.total = v; qu(); } }), field('mk-q-met', '충족한 기준 수', q.met, { mode:'numeric', max:4, set:function (v) { q.met = v; qu(); } })]), qo]), h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'고객 만족도' }), h('div', { class:'frm' }, [field('mk-s-r', '고객 평가(1~5점, 쉼표로 구분)', s.r, { ph:'예: 5, 4, 4, 3, 5', max:200, set:function (v) { s.r = v; su(); } })]), so])])); qu(); su();
  return kids;
}

// ── 필요 판단 ──
function viewNeed() {
  var kids = head('필요 판단', '사기 전에 정말 필요한지 스스로 점검합니다. 시장 인프라는 불필요한 구매의 자제를 요청해요.'); kids.push(notice());
  var n = S.nd, out = h('div', { id:'mk-n-out', style:'margin-top:12px' });
  function upd() { out.textContent = ''; var r = needCheck(n); var msg = r.level === 'hold' ? '구매를 자제하는 게 좋겠어요.' : r.level === 'think' ? '한 번 더 생각해 보세요.' : '필요한 구매로 보여요.'; out.appendChild(h('div', { id:'mk-n-res', class:r.level === 'ok' ? 'note info' : 'note', role:r.level === 'hold' ? 'alert' : null, text:msg })); r.reasons.forEach(function (x) { out.appendChild(h('div', { class:'kv' }, [h('span', { text:x })])); }); out.appendChild(h('div', { class:'sub', style:'margin-top:8px', text:'내가 답한 내용으로 계산한 권유입니다. 사고 말고는 사용자가 정해요.' })); }
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('div', { class:'frm' }, [field('mk-n-price', '가격(원, 선택)', n.price, { mode:'numeric', max:15, set:function (v) { n.price = v; upd(); } }), field('mk-n-budget', '이번 달 여유 예산(원, 선택)', n.budget, { mode:'numeric', max:15, set:function (v) { n.budget = v; upd(); } }),
    sel('mk-n-owned', '같은 물건이 이미 있나요?', n.owned, [['no', '없어요'], ['ok', '있고 쓸 수 있어요'], ['bad', '있지만 고장 났어요']], function (v) { n.owned = v; upd(); }), sel('mk-n-uses', '얼마나 쓸 것 같나요?', n.uses, [['often', '자주'], ['some', '가끔'], ['rare', '거의 안 써요']], function (v) { n.uses = v; upd(); }),
    sel('mk-n-plan', '어떤 구매인가요?', n.plan, [['plan', '계획했어요'], ['need', '급하게 필요해요'], ['impulse', '갑자기 사고 싶어요']], function (v) { n.plan = v; upd(); }), sel('mk-n-alt', '빌리거나 중고로 대체할 수 있나요?', n.alt, [['no', '어려워요'], ['yes', '가능해요']], function (v) { n.alt = v; upd(); })]), out, h('div', { class:'rowf', style:'margin-top:12px' }, [btn('시장 AI에게 묻기', 'quiet', function () { ask('이걸 지금 사는 게 맞는지 같이 따져 봐 주세요.'); })])])); upd();
  return kids;
}

// ── 선구매 ──
function addP() {
  var f = S.ps, e = {}, r = presale(f.value, f.rate, f.annual || '0', f.days || '0', f.actual);
  if (!r) e.value = '예상 매각 금액·선지급 비율(10~50)·연이율·일수를 확인해 주세요.'; if (S.list.length >= MAXP) e.value = '메모는 최대 ' + MAXP + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  S.list.push({ id:uid(), item:clean(f.item, 40), kind:KINDS.indexOf(f.kind) >= 0 ? f.kind : '물품', value:snum(f.value), rate:numOf(f.rate), adv:r.adv, st:'검토 중', d:kst() }); S.msg = '메모에 저장했어요.'; save(); render();
}
function viewPresale() {
  var kids = head('선구매', '급히 팔아야 할 때, 선지급을 받으면 얼마를 먼저 받고 나중에 얼마를 받는지 계산해 봅니다.'); kids.push(notice());
  var f = S.ps, e = S.err, out = h('div', { class:'col', id:'mk-p-out', style:'gap:16px' });
  function upd() {
    out.textContent = ''; var r = presale(f.value, f.rate, f.annual || '0', f.days || '0', f.actual);
    if (!r) { out.appendChild(h('div', { class:'card' }, [h('div', { class:'empty', text:'예상 매각 금액과 선지급 비율(10~50%)을 넣으면 계산해요.' })])); return; }
    out.appendChild(h('div', { class:'g2' }, [tile('먼저 받는 금액', won(r.adv) + '원', '예상 매각 금액의 ' + f.rate + '%', 'mk-p-adv'), tile('부과되는 이자', won(r.interest) + '원', '선지급액 × 연이율 × 일수/365', 'mk-p-int'), tile('매각 성사 뒤 받는 금액', sgn(r.after) + '원', (r.real ? '실제 매각 금액' : '예상 매각 금액') + ' ' + won(r.sale) + '원 기준', 'mk-p-after'), tile('모두 받는 금액', won(r.total) + '원', '먼저 받은 금액 + 나중에 받는 금액', 'mk-p-total')]));
    if (r.after < 0) out.appendChild(h('div', { class:'note', role:'alert', text:'매각 금액이 선지급액과 이자보다 적어요. 모자란 금액은 어떻게 처리할지 정해져 있지 않아요(설계 단계).' }));
    out.appendChild(h('div', { class:'card', style:'padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['선지급 비율', '먼저 받는 금액', '이자', '나중에 받는 금액'].map(function (t, i) { return h('th', { class:i ? 'r' : '', text:t }); }))]), h('tbody', {}, [10, 30, 50].map(function (p) { var x = presale(f.value, String(p), f.annual || '0', f.days || '0', f.actual); return x ? h('tr', {}, [h('td', { text:p + '%' }), h('td', { class:'r num', text:won(x.adv) + '원' }), h('td', { class:'r num', text:won(x.interest) + '원' }), h('td', { class:'r num', text:sgn(x.after) + '원' })]) : null; }))])])]));
  }
  kids.push(h('div', { class:'g2', style:'margin-top:16px;align-items:start' }, [h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'팔려는 것' }), h('div', { class:'frm' }, [field('mk-p-item', '이름(선택)', f.item, { max:40, ph:'예: 한림읍 토지', set:function (v) { f.item = v; } }), sel('mk-p-kind', '종류', f.kind, KINDS.map(function (k) { return [k, k]; }), function (v) { f.kind = v; }), field('mk-p-value', '예상 매각 금액(원)', f.value, { err:e.value, mode:'numeric', max:15, help:'감정 평가는 아직 연결되지 않아 내가 넣는 값이에요', set:function (v) { f.value = v; upd(); } }), field('mk-p-rate', '선지급 비율(10~50%)', f.rate, { mode:'decimal', max:4, set:function (v) { f.rate = v; upd(); } }), field('mk-p-annual', '연이율(%, 가정)', f.annual, { mode:'decimal', max:5, ph:'예: 6', help:'금융 인프라가 정할 값을 내가 가정해요', set:function (v) { f.annual = v; upd(); } }), field('mk-p-days', '매각까지 예상 일수', f.days, { mode:'numeric', max:4, ph:'예: 60', set:function (v) { f.days = v; upd(); } }), field('mk-p-actual', '실제 매각 금액(원, 팔린 뒤에 입력)', f.actual, { mode:'numeric', max:15, set:function (v) { f.actual = v; upd(); } })]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('내 메모에 저장', 'fill', addP), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]), out])); upd();
  if (S.list.length) kids.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['이름', '종류', '예상 금액', '선지급', '상태', ''].map(function (t, i) { return h('th', { class:i === 2 || i === 3 ? 'r' : '', text:t }); }))]), h('tbody', {}, S.list.map(function (x) { return h('tr', {}, [h('td', { text:x.item || '—' }), h('td', { text:x.kind }), h('td', { class:'r num', text:won(x.value) + '원' }), h('td', { class:'r num', text:won(x.adv) + '원(' + x.rate + '%)' }), h('td', {}, [pill(x.st, x.st === '매각 완료' ? 'm' : '')]), h('td', { class:'r' }, [btn(x.st === '검토 중' ? '매각 완료로' : '검토 중으로', 'sm quiet', function () { x.st = x.st === '검토 중' ? '매각 완료' : '검토 중'; save(); render(); }), btn('삭제', 'sm quiet', function () { S.list = S.list.filter(function (y) { return y.id !== x.id; }); save(); render(); })])]); }))])])]));
  return kids;
}

function render() {
  var root = $('mk-root'), tp = $('mk-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = S.view === 'eval' ? viewEval() : S.view === 'need' ? viewNeed() : S.view === 'presale' ? viewPresale() : viewPrinciple();
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
  M = el; el.textContent = ''; el.classList.add('mkt'); S.list = []; S.err = {}; S.msg = ''; load();
  [h('div', { id:'mk-top' }), h('div', { class:'wrap', id:'mk-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'principle'; render();
}
window.NaviMarket = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  fairPrice:fairPrice, qualityRate:qualityRate, satisfaction:satisfaction, needCheck:needCheck, presale:presale,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
