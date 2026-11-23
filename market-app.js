/* market-app.js — 나비웹 시장(인프라 AI · 시장). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviMarket.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 market.css(.mkt 범위). 전역은 NaviMarket 하나만 쓴다.
 *
 * 시장 화면의 특징(주피터 지시, 설계 원칙): 시장 인프라는 기존 공정거래위원회의 사회적 역할과 기능을 확장한다.
 *  - 모든 상품(물품·서비스)의 가격 공정성, 품질 기준 달성 여부, 고객 만족도를 평가·측정하므로 어떤 재화나 용역도 공정 가격을 현저히 벗어날 수 없다.
 *  - 첫째, 그 물품·서비스가 사용자에게 실제로 필요한지 판단하고 불필요한 구매의 자제를 요청한다.
 *  - 둘째, 은행 등 금융 인프라와 협업해 사용자가 팔려는 물품·서비스를 시장 인프라가 먼저 사고 대금을 차등 지급한다.
 *    예) 급히 부동산을 팔려는 사용자: 감정 평가 후 예상 매각 금액의 10~50%를 선지급, 나머지는 매각이 성사된 뒤 지급하고 금융 인프라가 부과한 이자를 차감한다.
 *  - 셋째(2026-11-24, 주피터 지시), 블록체인 기반의 상호 인증·잔고(balance) 검증·장부 기록: 구매자·판매자가 같은 내용에 서명해야 거래가 인정되고, 기록 전에 구매자 잔고를 장부로 다시 계산해 확인하며, 앞 블록 해시를 품은 블록으로 이어 붙인다('거래 인증·장부' 탭, 체험용·한 브라우저 안).
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
var TABS = [['principle', '시장 원리'], ['eval', '상품 평가'], ['need', '필요 판단'], ['presale', '선구매'], ['ledger', '거래 인증·장부']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var KINDS = ['부동산', '물품', '서비스'], STATES = ['검토 중', '매각 완료'];
var M = null, LS = {};
var S = { view:'principle', list:[], ledger:[], lg:newLg(), err:{}, msg:'',
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
  try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v || typeof v !== 'object') return; S.list = (Array.isArray(v.list) ? v.list : []).map(fixP).filter(Boolean).slice(0, MAXP); S.ledger = (Array.isArray(v.ledger) ? v.ledger : []).filter(function (b) { return b && typeof b === 'object'; }).slice(0, MAXB); } catch (e) {}   // 장부는 걸러 내지 않고 그대로 읽는다 — 고쳐졌으면 검증에서 드러나야 한다
}
function fixP(x) {
  if (!x || typeof x !== 'object' || KINDS.indexOf(x.kind) < 0 || STATES.indexOf(x.st) < 0) return null;
  var v = Number(x.value), r = Number(x.rate); if (!(v > 0) || v > 1e15 || Math.floor(v) !== v || !(r >= 10 && r <= 50)) return null;
  return { id:clean(x.id, 20) || uid(), item:clean(x.item, 40), kind:x.kind, value:v, rate:r, adv:Math.round(v * r / 100), st:x.st, d:/^\d{4}-\d{2}-\d{2}$/.test(x.d) ? x.d : '' };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ list:S.list, ledger:S.ledger })); } catch (e) {} }

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

// ── 거래 인증 · 잔고 검증 · 장부 기록 (블록체인 방식: 서명으로 인증하고, 해시로 이어 붙인 장부) ──
// 원리: ① 구매자·판매자가 같은 거래 내용에 각자 서명(ECDSA P-256)해야 거래가 인정된다(상호 인증).
//       ② 기록하기 전에 구매자 잔고가 거래 금액 이상인지 장부를 처음부터 다시 계산해 확인한다(잔고 검증).
//       ③ 거래는 앞 블록의 해시를 품은 블록으로 이어 붙여 기록한다 — 한 칸만 고쳐도 뒤가 모두 어긋난다(장부 기록).
// 이 화면의 장부는 한 브라우저 안의 체험용이다. 여러 나비가 같은 장부를 나눠 갖고 맞춰 보는 분산 장부, 실제 GDC 잔고 연결, 실제 지급은 설계 단계다.
var MAXB = 200, ZERO = '0000000000000000000000000000000000000000000000000000000000000000';
var TERM_LABELS = ['품목', '수량', '단가', '구매자', '판매자', '거래일', '거래번호'];
function subtle() { try { var c = window.crypto || window.msCrypto; return c && c.subtle ? c.subtle : null; } catch (e) { return null; } }
function enc(s) { return new TextEncoder().encode(String(s)); }
function toHex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join(''); }
function toB64(buf) { var s = '', a = new Uint8Array(buf), i; for (i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
function fromB64(t) { var s = atob(String(t)), a = new Uint8Array(s.length), i; for (i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
function sha256Hex(s) { var sb = subtle(); if (!sb) return Promise.reject(new Error('nosubtle')); return sb.digest('SHA-256', enc(s)).then(toHex); }
function termsArr(t) { t = t || {}; return [clean(t.item, 40), Number(t.qty), Number(t.price), clean(t.buyer, 20), clean(t.seller, 20), clean(t.d, 10), clean(t.n, 30)]; }
function canonTerms(t) { return JSON.stringify(termsArr(t)); }
function parseSlip(t) {
  if (!t || typeof t !== 'object') return null;
  var q = snum(t.qty), p = snum(t.price), by = clean(t.buyer, 20), se = clean(t.seller, 20), it = clean(t.item, 40);
  if (!it || !by || !se || by === se || !(q >= 1 && q <= 1e5) || !(p >= 1 && p <= 1e9) || !clean(t.n, 30)) return null;
  return { item:it, qty:q, price:p, total:q * p, buyer:by, seller:se };
}
function newKeys() {
  var sb = subtle(); if (!sb) return Promise.reject(new Error('nosubtle'));
  return sb.generateKey({ name:'ECDSA', namedCurve:'P-256' }, true, ['sign', 'verify']).then(function (kp) {
    return sb.exportKey('jwk', kp.publicKey).then(function (j) { return { priv:kp.privateKey, pub:{ kty:'EC', crv:'P-256', x:j.x, y:j.y } }; });
  });
}
function fingerprint(pub) { return sha256Hex(String(pub && pub.x) + '.' + String(pub && pub.y)).then(function (x) { return x.slice(0, 8); }); }
function signText(priv, text) { return subtle().sign({ name:'ECDSA', hash:'SHA-256' }, priv, enc(text)).then(toB64); }
function verifySig(pub, sig, text) {
  var sb = subtle(); if (!sb || !pub || typeof sig !== 'string' || !sig) return Promise.resolve(false);
  return sb.importKey('jwk', { kty:'EC', crv:'P-256', x:String(pub.x), y:String(pub.y), ext:true }, { name:'ECDSA', namedCurve:'P-256' }, false, ['verify'])
    .then(function (k) { return sb.verify({ name:'ECDSA', hash:'SHA-256' }, k, fromB64(sig), enc(text)); }).catch(function () { return false; });
}
// 상호 인증: 두 전표의 내용이 같고, 구매자·판매자 서명이 각자 그 내용에 대해 유효해야 한다.
function mutualAuth(b, s) {
  if (!b || !s || !b.sig || !s.sig || !b.terms || !s.terms) return Promise.resolve({ ok:false, code:'nosig', msg:'구매자와 판매자가 모두 서명해야 해요.' });
  var ab = termsArr(b.terms), as = termsArr(s.terms), cb = JSON.stringify(ab), cs = JSON.stringify(as);
  if (cb !== cs) { var diff = TERM_LABELS.filter(function (l, i) { return ab[i] !== as[i]; }); return Promise.resolve({ ok:false, code:'diff', msg:'두 전표의 내용이 달라요(' + diff.join('·') + '). 같은 내용에 서명해야 해요.' }); }
  return Promise.all([verifySig(b.pub, b.sig, cb), verifySig(s.pub, s.sig, cs)]).then(function (r) {
    if (!r[0]) return { ok:false, code:'badsig', msg:'구매자의 서명이 이 내용과 맞지 않아요.' };
    if (!r[1]) return { ok:false, code:'badsig', msg:'판매자의 서명이 이 내용과 맞지 않아요.' };
    return { ok:true, code:'ok', msg:'상호 인증 성공 — 두 사람이 같은 내용에 서명했어요.' };
  });
}
function bodyKey(kind, b) {
  b = b || {};
  if (kind === 'deposit') return JSON.stringify([clean(b.acct, 20), Number(b.amt)]);
  return JSON.stringify([canonTerms(b.terms), b.bpub && b.bpub.x, b.bpub && b.bpub.y, b.spub && b.spub.x, b.spub && b.spub.y, b.bsig, b.ssig]);
}
function hashOf(prev, i, kind, t, body) { return sha256Hex(String(prev) + '|' + i + '|' + kind + '|' + String(t) + '|' + bodyKey(kind, body)); }
function mkBlock(chain, kind, body) {
  var prev = chain.length ? chain[chain.length - 1].hash : ZERO, i = chain.length, t = new Date().toISOString();
  return hashOf(prev, i, kind, t, body).then(function (hh) { return { i:i, kind:kind, t:t, prev:prev, body:body, hash:hh }; });
}
// 장부를 처음부터 다시 읽는다: 블록 이음·해시, 거래 서명, 그 시점의 잔고를 모두 확인하고 잔고를 다시 계산한다.
function verifyLedger(blocks) {
  var bal = {}, prev = ZERO, i = 0;
  function fail(k, why) { return { ok:false, bad:k, why:why, bal:bal, n:blocks.length }; }
  function step() {
    if (i >= blocks.length) return Promise.resolve({ ok:true, bad:-1, why:'', bal:bal, n:blocks.length });
    var b = blocks[i], k = i;
    if (!b || typeof b !== 'object' || b.i !== k || (b.kind !== 'deposit' && b.kind !== 'trade') || !b.body || typeof b.body !== 'object') return Promise.resolve(fail(k, '블록 형식이 맞지 않아요.'));
    if (b.prev !== prev) return Promise.resolve(fail(k, '앞 블록과의 이음이 끊어졌어요.'));
    return hashOf(b.prev, b.i, b.kind, b.t, b.body).then(function (hh) {
      if (hh !== b.hash) return fail(k, '내용이 기록 당시와 달라요(해시가 맞지 않아요).');
      if (b.kind === 'deposit') {
        var a = Number(b.body.amt), ac = clean(b.body.acct, 20);
        if (!ac || !(a >= 1 && a <= 1e13) || Math.floor(a) !== a) return fail(k, '입금 기록이 올바르지 않아요.');
        bal[ac] = (bal[ac] || 0) + a; prev = b.hash; i++; return step();
      }
      var t = b.body.terms, sl = parseSlip(t); if (!sl) return fail(k, '거래 내용이 올바르지 않아요.');
      return mutualAuth({ terms:t, pub:b.body.bpub, sig:b.body.bsig }, { terms:t, pub:b.body.spub, sig:b.body.ssig }).then(function (m) {
        if (!m.ok) return fail(k, '서명이 맞지 않아요.');
        if ((bal[sl.buyer] || 0) < sl.total) return fail(k, '그 시점의 구매자 잔고가 모자라요.');
        bal[sl.buyer] -= sl.total; bal[sl.seller] = (bal[sl.seller] || 0) + sl.total; prev = b.hash; i++; return step();
      });
    });
  }
  return step();
}
function appendDeposit(chain, acct, amt) {
  var ac = clean(acct, 20), a = snum(amt);
  if (!ac) return Promise.resolve({ ok:false, code:'bad', msg:'계정 이름을 적어 주세요.' });
  if (!(a >= 1 && a <= 1e13)) return Promise.resolve({ ok:false, code:'bad', msg:'금액은 1 이상의 정수로 넣어 주세요.' });
  if (chain.length >= MAXB) return Promise.resolve({ ok:false, code:'full', msg:'장부는 최대 ' + MAXB + '개 블록까지예요.' });
  return verifyLedger(chain).then(function (r) {
    if (!r.ok) return { ok:false, code:'broken', msg:'장부에 이상이 있어 기록할 수 없어요(' + r.bad + '번 블록).' };
    return mkBlock(chain, 'deposit', { acct:ac, amt:a }).then(function (blk) { return { ok:true, block:blk }; });
  });
}
// 거래 기록: 상호 인증 → 중복(재사용) 확인 → 장부 이상 여부 → 잔고 검증 → 블록 이어 붙이기. 하나라도 어긋나면 기록하지 않는다.
function appendTrade(chain, b, s) {
  var t = b && b.terms, sl = parseSlip(t);
  if (!sl) return Promise.resolve({ ok:false, code:'bad', msg:'품목·수량(1~100000)·단가(1~1000000000)와 서로 다른 구매자·판매자 이름을 확인해 주세요.' });
  if (chain.length >= MAXB) return Promise.resolve({ ok:false, code:'full', msg:'장부는 최대 ' + MAXB + '개 블록까지예요.' });
  return mutualAuth(b, s).then(function (m) {
    if (!m.ok) return m;
    var nonce = clean(t.n, 30);
    if (chain.some(function (x) { return x && x.kind === 'trade' && x.body && x.body.terms && clean(x.body.terms.n, 30) === nonce; })) return { ok:false, code:'replay', msg:'이미 기록된 거래예요. 같은 거래를 두 번 기록할 수 없어요.' };
    return verifyLedger(chain).then(function (r) {
      if (!r.ok) return { ok:false, code:'broken', msg:'장부에 이상이 있어 기록할 수 없어요(' + r.bad + '번 블록).' };
      var have = r.bal[sl.buyer] || 0;
      if (have < sl.total) return { ok:false, code:'balance', msg:'구매자 잔고가 모자라요. 잔고 ' + won(have) + ' GDC, 필요 ' + won(sl.total) + ' GDC(부족 ' + won(sl.total - have) + ' GDC).' };
      return mkBlock(chain, 'trade', { terms:{ item:sl.item, qty:sl.qty, price:sl.price, buyer:sl.buyer, seller:sl.seller, d:clean(t.d, 10), n:nonce }, bpub:b.pub, spub:s.pub, bsig:b.sig, ssig:s.sig })
        .then(function (blk) { return { ok:true, block:blk, total:sl.total, buyerLeft:have - sl.total }; });
    });
  });
}
function gdc(n) { return won(n) + ' GDC'; }
function blockLine(b) {
  try {
    if (b.kind === 'deposit') return '입금(체험) · ' + clean(b.body.acct, 20) + ' +' + gdc(b.body.amt);
    var t = b.body.terms; return clean(t.buyer, 20) + ' → ' + clean(t.seller, 20) + ' · ' + clean(t.item, 40) + ' × ' + won(t.qty) + ' · ' + gdc(Number(t.qty) * Number(t.price));
  } catch (e) { return '(읽을 수 없는 블록)'; }
}
var KEYS = { b:null, s:null };
function ensureKey(k) { if (!KEYS[k]) KEYS[k] = newKeys().then(function (kk) { return fingerprint(kk.pub).then(function (fp) { kk.fp = fp; return kk; }); }); return KEYS[k]; }
function newLg() { return { acct:'', amt:'', buyer:'나', seller:'', n:uid(), d:kst(), b:{ item:'', qty:'1', price:'', sig:'', fp:'', pub:null, terms:null }, s:{ item:'', qty:'1', price:'', sig:'', fp:'', pub:null, terms:null }, clearAsk:false }; }

function viewLedger() {
  var kids = head('거래 인증·장부', '거래를 기록하기 전에 두 사람이 서로 인증하고, 잔고를 확인하고, 고칠 수 없게 이어 붙인 장부에 남겨요.'); kids.push(notice());
  kids.push(h('div', { class:'note', id:'mk-l-scope', style:'margin-bottom:16px', text:'이 화면의 장부는 이 브라우저 안에만 저장되는 체험용이에요. 여러 나비가 같은 장부를 나눠 갖고 서로 맞춰 보는 분산 장부, 실제 GDC 잔고 연결, 실제 대금 지급은 아직 설계 단계입니다. 서명 키는 접속할 때마다 새로 만드는 임시 키이며 저장하지 않아요.' }));
  if (!subtle()) kids.push(h('div', { class:'note', role:'alert', style:'margin-bottom:16px', text:'이 브라우저에서는 서명·해시 기능(보안 연결 필요)을 쓸 수 없어 체험할 수 없어요.' }));
  var g = S.lg, bal = h('div', { id:'mk-l-bal', style:'margin-top:12px' }), stat = h('div', { id:'mk-l-stat', style:'margin-top:12px' }), tbl = h('div', { id:'mk-l-tbl', style:'margin-top:12px' }),
    auth = h('div', { id:'mk-l-auth', style:'margin-top:12px' }), msg = h('div', { id:'mk-l-msg', style:'margin-top:12px' }), tam = h('div', { id:'mk-l-tam', style:'margin-top:12px' });
  function say(node, text, bad) { node.textContent = ''; if (text) node.appendChild(h('div', { class:bad ? 'note' : 'note info', role:bad ? 'alert' : 'status', text:text })); }
  function sigUi() { ['b', 's'].forEach(function (k) { var e = $('mk-l-' + k + '-sig'); if (e) e.textContent = g[k].sig ? '서명됨 (키 ' + g[k].fp + ')' : '아직 서명 안 함'; }); }
  function clr(k) { var ks = k ? [k] : ['b', 's'], had = false; ks.forEach(function (x) { if (g[x].sig) { had = true; g[x].sig = ''; g[x].fp = ''; g[x].pub = null; g[x].terms = null; } }); if (had) { sigUi(); say(auth, '내용을 고쳐서 서명이 지워졌어요. 서명은 서명한 내용에만 맞아서, 다시 서명해야 해요.', false); } }
  function refresh() {
    verifyLedger(S.ledger).then(function (r) {
      bal.textContent = '';
      var names = Object.keys(r.bal).sort();
      if (!r.ok) bal.appendChild(h('div', { class:'sub', text:'장부에 이상이 있어 잔고를 믿을 수 없어요.' }));
      else if (!names.length) bal.appendChild(h('div', { class:'sub', text:'아직 잔고가 없어요. 위에서 입금(체험용)을 기록해 보세요.' }));
      else bal.appendChild(h('div', { class:'card', id:'mk-l-balcard' }, names.map(function (nm) { return h('div', { class:'kv' }, [h('span', { text:nm }), h('b', { text:gdc(r.bal[nm]) })]); })));
      stat.textContent = '';
      stat.appendChild(h('div', { id:'mk-l-ok', class:r.ok ? 'note info' : 'note', role:r.ok ? 'status' : 'alert', text:r.ok ? '장부 검증: 이상 없음 (' + r.n + '개 블록 — 이음·서명·잔고가 모두 맞아요)' : '장부 검증: ' + r.bad + '번 블록에서 이상 발견 — ' + r.why }));
      tbl.textContent = '';
      if (!S.ledger.length) { tbl.appendChild(h('div', { class:'card' }, [h('div', { class:'empty', text:'아직 기록이 없어요. 입금이나 거래를 기록하면 블록이 이어 붙어요.' })])); return; }
      tbl.appendChild(h('div', { class:'card', style:'padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['번호', '내용', '해시', '앞 블록 해시'].map(function (t) { return h('th', { text:t }); }))]),
        h('tbody', {}, S.ledger.map(function (b, k) { var bad = !r.ok && k === r.bad; return h('tr', { class:bad ? 'bad' : '' }, [h('td', { text:String(k) }), h('td', { text:blockLine(b) + (bad ? '  ⚠' : '') }), h('td', { style:'font-family:monospace', text:String(b && b.hash || '').slice(0, 8) }), h('td', { style:'font-family:monospace', text:String(b && b.prev || '').slice(0, 8) })]); }))])])]));
    }).catch(function () { say(stat, '장부를 검증하지 못했어요(이 브라우저에서는 해시 기능을 쓸 수 없어요).', true); });
  }
  function doDeposit() {
    appendDeposit(S.ledger, g.acct, g.amt).then(function (res) {
      if (!res.ok) { say(msg, res.msg, true); return; }
      S.ledger.push(res.block); save(); g.amt = ''; S.msg = '입금을 장부에 기록했어요(체험용).'; render();
    }).catch(function () { say(msg, '기록하지 못했어요(이 브라우저에서는 해시 기능을 쓸 수 없어요).', true); });
  }
  function slipTerms(o) { return { item:clean(o.item, 40), qty:o.qty, price:o.price, buyer:clean(g.buyer, 20), seller:clean(g.seller, 20), d:g.d, n:g.n }; }
  function signSlip(k) {
    var o = g[k], t = slipTerms(o); if (!parseSlip(t)) { say(auth, '품목·수량·단가와 서로 다른 구매자·판매자 이름을 먼저 확인해 주세요.', true); return; }
    ensureKey(k).then(function (kk) { return signText(kk.priv, canonTerms(t)).then(function (sig) { o.sig = sig; o.pub = kk.pub; o.fp = kk.fp; o.terms = t; sigUi(); say(auth, (k === 'b' ? '구매자' : '판매자') + '가 서명했어요. 이 서명은 지금 적은 내용에만 맞아요.', false); }); })
      .catch(function () { say(auth, '서명하지 못했어요(이 브라우저에서는 서명 기능을 쓸 수 없어요).', true); });
  }
  function pair() { return [{ terms:g.b.terms, pub:g.b.pub, sig:g.b.sig }, { terms:g.s.terms, pub:g.s.pub, sig:g.s.sig }]; }
  function checkAuth() { var p = pair(); mutualAuth(p[0], p[1]).then(function (m) { say(auth, m.msg, !m.ok); }).catch(function () { say(auth, '확인하지 못했어요.', true); }); }
  function doTrade() {
    var p = pair();
    appendTrade(S.ledger, p[0], p[1]).then(function (res) {
      if (!res.ok) { say(msg, res.msg, true); return; }
      S.ledger.push(res.block); save(); var tot = res.total, left = res.buyerLeft; S.lg = newLg(); S.lg.seller = g.seller; S.lg.buyer = g.buyer; S.msg = '거래를 장부에 기록했어요(' + gdc(tot) + '). 구매자 잔고는 ' + gdc(left) + ' 남았어요.'; render();
    }).catch(function () { say(msg, '기록하지 못했어요(이 브라우저에서는 서명·해시 기능을 쓸 수 없어요).', true); });
  }
  function tamper() {
    tam.textContent = '';
    if (!S.ledger.length) { say(tam, '장부에 블록이 하나 이상 있어야 해요.', true); return; }
    var copy = JSON.parse(JSON.stringify(S.ledger)), k = copy.findIndex(function (b) { return b && b.kind === 'trade'; }); if (k < 0) k = 0;
    if (copy[k].kind === 'trade') copy[k].body.terms.price = Number(copy[k].body.terms.price) + 1; else copy[k].body.amt = Number(copy[k].body.amt) + 1;
    verifyLedger(copy).then(function (r) { say(tam, k + '번 블록의 금액을 몰래 1만 올렸다고 가정해 검증해 봤어요(실제 장부는 그대로예요). ' + (r.ok ? '그대로 통과했어요.' : '→ ' + r.bad + '번 블록에서 바로 드러났어요: ' + r.why), r.ok); });
  }
  function clearLedger(btnEl) {
    if (!g.clearAsk) { g.clearAsk = true; btnEl.textContent = '정말 지울까요? 한 번 더 누르면 지워요'; return; }
    S.ledger = []; save(); g.clearAsk = false; S.msg = '체험용 장부를 지웠어요.'; render();
  }
  var fld = function (id, label, key, o) { o = o || {}; return field(id, label, g[key], { max:o.max, ph:o.ph, mode:o.mode, help:o.help, set:function (v) { g[key] = v; if (o.clr) clr(); } }); };
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'① 잔고 — 장부로 계산해요' }), h('div', { class:'sub', text:'잔고는 따로 적어 두는 값이 아니라 장부의 입금·거래를 처음부터 더하고 빼서 구해요. 체험용으로 입금을 기록해 잔고를 만들어 보세요.' }),
    h('div', { class:'frm' }, [fld('mk-l-acct', '계정 이름', 'acct', { max:20, ph:'예: 나' }), fld('mk-l-amt', '입금 금액(GDC)', 'amt', { mode:'numeric', max:13, ph:'예: 50000' })]),
    h('div', { class:'rowf', style:'margin-top:12px' }, [btn('입금 기록(체험용)', 'fill', doDeposit)]), bal]));
  var slip = function (k, title) { var o = g[k], id = 'mk-l-' + k, cl = function () { clr(k); };
    return h('div', { class:'card col' }, [h('b', { text:title }), h('div', { class:'frm' }, [
      field(id + '-item', '품목', o.item, { max:40, ph:'예: 중고 자전거', set:function (v) { o.item = v; cl(); } }), field(id + '-qty', '수량', o.qty, { mode:'numeric', max:6, set:function (v) { o.qty = v; cl(); } }), field(id + '-price', '단가(GDC)', o.price, { mode:'numeric', max:10, set:function (v) { o.price = v; cl(); } })]),
      h('div', { class:'rowf', style:'margin-top:12px' }, [btn((k === 'b' ? '구매자' : '판매자') + ' 서명', 'fill', function () { signSlip(k); }), h('span', { class:'sub', id:id + '-sig', text:o.sig ? '서명됨 (키 ' + o.fp + ')' : '아직 서명 안 함' })])]); };
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'② 거래 — 서로 인증하고 잔고를 확인해요' }),
    h('div', { class:'sub', text:'구매자와 판매자가 같은 내용의 전표를 적고 각자 서명합니다. 내용이 다르거나 서명이 하나라도 없거나, 구매자 잔고가 모자라거나, 이미 기록한 거래이면 장부에 기록되지 않아요. 두 전표를 일부러 다르게 적어 보세요.' }),
    h('div', { class:'frm' }, [fld('mk-l-buyer', '구매자 이름', 'buyer', { max:20, clr:true }), fld('mk-l-seller', '판매자 이름', 'seller', { max:20, ph:'예: 철수', clr:true })]),
    h('div', { class:'g2', style:'margin-top:12px;align-items:start' }, [slip('b', '구매자 전표'), slip('s', '판매자 전표')]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('상호 인증 확인', '', checkAuth), btn('장부에 기록', 'fill', doTrade)]), auth, msg]));
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'③ 장부 — 이어 붙인 기록' }), h('div', { class:'sub', text:'블록마다 앞 블록의 해시(내용의 지문)를 품고 있어요. 한 칸만 고쳐도 그 블록부터 뒤가 모두 어긋나서, 고친 자리가 바로 드러나요.' }), stat, tbl,
    h('div', { class:'rowf', style:'margin-top:12px' }, [btn('장부 다시 검증', '', refresh), btn('한 칸을 몰래 고친다면?', '', tamper), btn('체험용 장부 지우기', '', function (ev) { clearLedger(ev.currentTarget || ev.target); })]), tam]));
  say(msg, S.msg, false); refresh();
  return kids;
}

// ── 시장 원리 ──
function viewPrinciple() {
  var kids = head('시장 원리', '나비웹 시장 인프라는 기존 공정거래위원회의 사회적 역할과 기능을 확장합니다.');
  kids.push(stepsCard('시장 인프라가 하는 일', [['가격·품질·만족도를 평가하고 측정', '모든 상품(물품·서비스)의 가격 공정성, 품질 기준 달성 여부, 고객 만족도를 측정해서 어떤 재화나 용역도 공정 가격을 현저히 벗어날 수 없게 합니다.'], ['첫째, 정말 필요한지 판단', '그 물품이나 서비스가 사용자에게 실제로 필요한지 판단하고, 불필요한 구매는 자제하도록 요청합니다.'], ['둘째, 팔려는 물건을 먼저 사고 대금을 차등 지급', '은행 등 금융 인프라와 협업해 사용자가 팔려는 물품이나 서비스를 시장 인프라가 먼저 삽니다. 급히 부동산을 팔려는 경우 감정 평가 뒤 예상 매각 금액의 10~50%를 먼저 지급하고, 나머지는 매각이 성사된 뒤 지급하며 금융 인프라가 부과한 이자를 뺍니다.'], ['셋째, 거래는 서로 인증하고 잔고를 확인해 장부에 기록', '모든 거래는 구매자와 판매자가 같은 내용에 각자 서명(상호 인증)해야 인정됩니다. 기록하기 전에 구매자 잔고가 거래 금액 이상인지 장부를 처음부터 다시 계산해 확인(잔고 검증)하고, 앞 블록의 해시를 품은 블록으로 이어 붙여 기록(장부 기록)합니다. 블록체인 방식이라 한 칸만 고쳐도 바로 드러나고 같은 거래를 두 번 기록할 수 없습니다.']],
    '설계 원칙입니다. 시장 전체 측정, 감정 평가, 선구매와 대금 지급, 여러 나비가 나눠 갖는 분산 장부와 실제 GDC 잔고 연결은 아직 연결되어 있지 않아요. 이 화면은 같은 원리를 내가 넣은 값으로 계산해 볼 수 있게 한 것입니다.'));
  kids.push(h('div', { class:'g2', style:'margin-top:16px' }, [['상품 평가', '비교 가격 대비 편차, 품질 달성률, 고객 만족도', 'eval'], ['필요 판단', '사기 전에 정말 필요한지 점검', 'need'], ['선구매', '선지급액과 이자, 매각 후 받을 금액 계산', 'presale'], ['거래 인증·장부', '두 사람의 서명, 잔고 확인, 이어 붙인 장부', 'ledger']].map(function (x) { return h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:x[0] }), h('span', { class:'sub', text:x[1] }), h('div', { class:'rowf' }, [btn('열기', 'fill', function () { go(x[2]); })])]); })));
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
  var kids = S.view === 'eval' ? viewEval() : S.view === 'need' ? viewNeed() : S.view === 'presale' ? viewPresale() : S.view === 'ledger' ? viewLedger() : viewPrinciple();
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
  M = el; el.textContent = ''; el.classList.add('mkt'); S.list = []; S.ledger = []; S.lg = newLg(); S.err = {}; S.msg = ''; load();
  [h('div', { id:'mk-top' }), h('div', { class:'wrap', id:'mk-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'principle'; render();
}
window.NaviMarket = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  fairPrice:fairPrice, qualityRate:qualityRate, satisfaction:satisfaction, needCheck:needCheck, presale:presale,
  ledger:{ newKeys:newKeys, signTerms:function (priv, t) { return signText(priv, canonTerms(t)); }, mutualAuth:mutualAuth, appendDeposit:appendDeposit, appendTrade:appendTrade, verify:verifyLedger, parseSlip:parseSlip, canonTerms:canonTerms },
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
