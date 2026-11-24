/* market-app.js — 나비웹 시장(인프라 AI · 시장). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviMarket.mount(요소) · .nav({do:'reset'}) · .on('ask'|'result', 함수) · .flow(순수 함수) · .ledger(거래 인증·장부)
 * 모양은 market.css(.mkt 범위). 전역은 NaviMarket 하나만 쓴다.
 *
 * 한 페이지 구매 검토(주피터 지시 2026-11-24, 이전 탭 5개 화면은 모두 지우고 새로 씀):
 *  상품 받기 → PDV 구매 기록으로 중복 확인 → 필요도 1~5 → 가격·AS·리뷰 보고서 → 판매자 나비와 협의·최종 보고 → 승인하면 블록체인 방식 결제
 *  (상호 인증·잔고 검증·장부 기록) → 재무제표 SP가 장부 갱신 → 나만의 AI 비서가 PDV에 기록.
 * 상품 정보(이미지·가격·AS·리뷰 등)는 나비웹 도우미가 판매 사이트를 열어 읽어 온다(로그인은 사용자). 직접 넣어도 된다.
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - PDV 실제 연동, 판매자 나비, 재무제표 SP, 나만의 AI 비서, 실제 GDC 잔고·지급, 여러 나비가 나눠 갖는 분산 장부는 아직 연결되어 있지 않다.
 *    이 화면의 PDV 기록·장부·지출 기록은 이 브라우저(localStorage)에만 저장되는 체험용이고, 판매자 나비 응답은 이 화면이 만든 체험용 값이다.
 *  - 필요도·가격 평가는 체험용 규칙으로 계산한다(실제로는 시장 SP가 판단). 결정은 항상 사용자가 한다.
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
function won(n) { return Math.round(Number(n) || 0).toLocaleString('ko-KR'); }
function kst() { return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul' }).format(new Date()); }
function numOf(v) { var s = String(v == null ? '' : v).replace(/[,\s원]/g, ''); if (s === '' || !/^\d*\.?\d+$|^\d+\.?$/.test(s)) return NaN; return Number(s); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function clean(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }


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

// ── 구매 검토 한 페이지 (주피터 지시 2026-11-24) ──
// 흐름: ① 상품(이미지·가격·판매 사이트 링크) 받기 → ② 내 데이터 금고(PDV) 구매 기록에서 중복 확인(중복이면 여기서 멈춤, "구매 원함"을 눌러야 계속)
//       → ③ PDV의 업무·일상으로 필요도 1~5점(5 매우 적절, 1 불필요) → "계속 진행" → ④ 가격·AS·리뷰 평가 보고서 → "구매"
//       → ⑤ 시장 SP가 판매자 나비와 구매 조건·결제·배송 협의 → 최종 보고 → ⑥ 승인하면 블록체인 방식 결제(상호 인증·잔고 검증·장부 기록)
//       → 재무제표 SP가 장부 갱신 → 나만의 AI 비서가 PDV에 기록.
// 상품 정보는 나비웹 도우미가 판매 사이트를 열어(로그인은 사용자가) 읽어 오고, 직접 넣어도 된다.
// 연결 전인 것(화면에도 적는다): PDV 실제 연동(기록은 이 브라우저에 저장한 체험용), 판매자 나비(응답은 체험용), 재무제표 SP·나만의 AI 비서(이 화면이 대신 기록), 실제 GDC 잔고·지급.
function snum(v) { var s = String(v == null ? '' : v).replace(/[,\s원]/g, ''); return /^\d+$/.test(s) ? Number(s) : NaN; }
var STEPS = ['상품', '중복 확인', '필요도', '가격·품질', '판매자 협의', '결제·기록'];
var F = { ver:1 };   // 화면에서 쓰는 순수 함수 모음(테스트용으로도 내보낸다)

function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^0-9a-z\u3131-\u318e\uac00-\ud7a3]+/g, ' ').trim(); }
function bigrams(s) { var t = norm(s).replace(/ /g, ''), o = {}, i; if (t.length === 1) o[t] = 1; for (i = 0; i + 1 < t.length; i++) o[t.slice(i, i + 2)] = 1; return o; }
function jaccard(a, b) { var A = bigrams(a), B = bigrams(b), ka = Object.keys(A), kb = Object.keys(B); if (!ka.length || !kb.length) return 0; var n = 0; ka.forEach(function (k) { if (B[k]) n++; }); return n / (ka.length + kb.length - n); }
/** 중복 판단: 상품 이름이 PDV의 지난 구매 기록과 비슷한지(글자 두 개 단위 겹침 0.4 이상, 또는 한쪽이 다른 쪽을 품음). 비슷한 순으로 돌려준다. */
F.similar = function (name, history) {
  var n = norm(name).replace(/ /g, ''); if (!n) return [];
  return (history || []).map(function (p) {
    var m = norm(p.name).replace(/ /g, ''), j = jaccard(name, p.name), inc = m.length >= 2 && n.length >= 2 && (n.indexOf(m) >= 0 || m.indexOf(n) >= 0);
    return { p:p, score:inc ? Math.max(j, 0.8) : j };
  }).filter(function (x) { return x.score >= 0.4; }).sort(function (a, b) { return b.score - a.score; }).map(function (x) { return x.p; });
};
/** 필요도 1~5. 기준(체험용 규칙): 기본 2점 + 업무·일상 메모와 상품 이름이 겹치면 +1~2 + 가격이 지난 평균 구매가의 3배 이내면 +1 − 중복을 알고도 구매 원함이면 −1. 메모가 없으면 근거가 부족하다고 알린다. */
F.need = function (o) {
  var memo = norm(o.memo), words = norm(o.name).split(' ').filter(function (w) { return w.length >= 2; }), hit = [], why = [], s = 2, avg = 0, price = Number(o.price);
  words.forEach(function (w) { if (memo && memo.indexOf(w) >= 0) hit.push(w); });
  if (!memo) why.push('PDV에 업무·일상 기록이 없어 필요도를 판단할 근거가 부족해요(기본값 적용)');
  else if (hit.length >= 2) { s += 2; why.push('업무·일상 기록과 겹치는 말이 있어요: ' + hit.slice(0, 4).join(', ')); }
  else if (hit.length === 1) { s += 1; why.push('업무·일상 기록과 겹치는 말이 하나 있어요: ' + hit[0]); }
  else why.push('업무·일상 기록에서 이 상품과 이어지는 내용을 찾지 못했어요');
  var hs = (o.history || []).map(function (p) { return Number(p.price); }).filter(function (x) { return x > 0; });
  if (hs.length) avg = hs.reduce(function (a, b) { return a + b; }, 0) / hs.length;
  if (price > 0 && (!avg || price <= avg * 3)) { s += 1; why.push(avg ? '지난 평균 구매가(' + won(avg) + '원)의 3배 이내예요' : '지난 구매 기록이 없어 가격을 견줄 수 없지만 큰 지출은 아니에요'); }
  else if (price > 0) why.push('지난 평균 구매가(' + won(avg) + '원)의 3배를 넘는 큰 지출이에요');
  if (o.dupOverride) { s -= 1; why.push('비슷한 구매 기록이 있는데도 구매를 원하셨어요'); }
  s = Math.max(1, Math.min(5, s));
  return { score:s, label:s >= 5 ? '매우 적절' : s === 4 ? '적절' : s === 3 ? '보통' : s === 2 ? '신중' : '불필요', reasons:why, memoEmpty:!memo };
};
/** 가격·AS·리뷰 평가. 가격: 다른 판매처 가격 3개 이상의 중앙값 대비 15% 이내면 공정. 리뷰: 평점 4.0 이상·20건 이상이면 만족 수준. 모르는 것은 "판단 보류"로 둔다. */
F.report = function (p) {
  var price = Number(p.price), cmp = (p.compare || []).filter(function (x) { return x > 0; }), L = [], warn = 0, hold = 0, med = 0, n;
  if (cmp.length >= 3) {
    var s = cmp.slice().sort(function (a, b) { return a - b; }); n = s.length; med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    var dev = (price - med) / med, out = Math.abs(dev) * 100 >= 15;
    L.push({ k:'가격', ok:!out, text:out ? '다른 판매처 중앙값 ' + won(med) + '원보다 ' + Math.abs(Math.round(dev * 1000) / 10) + '% ' + (dev > 0 ? '비싸요(공정 범위 밖)' : '싸요(공정 범위 밖 — 품질·출처를 확인하세요)') : '다른 판매처 중앙값 ' + won(med) + '원과 비슷해요(공정 범위 안)' });
    if (out) warn++;
  } else { L.push({ k:'가격', ok:null, text:'비교할 다른 판매처 가격이 3개 미만이라 공정성은 판단을 보류해요(' + cmp.length + '개)' }); hold++; }
  if (p.as) L.push({ k:'사후 서비스(AS)', ok:true, text:clean(p.as, 160) }); else { L.push({ k:'사후 서비스(AS)', ok:false, text:'AS·반품·교환 안내를 찾지 못했어요' }); warn++; }
  var r = Number(p.rating), c = Number(p.count);
  if (r >= 1 && r <= 5 && c > 0) { var good = r >= 4 && c >= 20; L.push({ k:'고객 리뷰', ok:good, text:'평점 ' + r.toFixed(1) + ' · ' + won(c) + '건 — ' + (good ? '만족 수준(4.0점·20건 이상)을 넘어요' : '만족 수준(4.0점·20건 이상)에 못 미쳐요') }); if (!good) warn++; }
  else { L.push({ k:'고객 리뷰', ok:null, text:'평점·리뷰 건수를 읽지 못해 판단을 보류해요' }); hold++; }
  var st = clean(p.sellerTrust, 120), sn = clean(p.seller, 30);
  if (st) L.push({ k:'판매자 신뢰도', ok:!/낮|불량|주의|신고|분쟁/.test(st), text:(sn ? sn + ' — ' : '') + st }); else { L.push({ k:'판매자 신뢰도', ok:null, text:(sn ? sn + ': ' : '') + '판매자 평점·등급을 읽지 못해 판단을 보류해요' }); hold++; }
  if (L[L.length - 1].ok === false) warn++;
  var verdict = warn ? 'caution' : hold ? 'hold' : 'ok';
  return { lines:L, verdict:verdict, title:verdict === 'ok' ? '가격이 공정하고 만족도가 충분해요' : verdict === 'caution' ? '확인이 필요한 점이 있어요(' + warn + '건)' : '근거가 부족한 항목이 있어요(' + hold + '건 보류)', median:med };
};
F.snum = snum; F.norm = norm;

// ── 저장(이 브라우저, 체험용) ──
var KEY = 'navi-market-v2', MAXP = 200;
var M = null, LS = {};
var S = { step:0, prod:{ name:'', price:'', img:'', link:'', seller:'', sellerTrust:'', as:'', rating:'', count:'', reviews:[], shipping:'', compare:[] },
  auto:false, tok:0, ask:null, payMsg:null, bal:'', history:[], memo:'', fin:[], ledger:[], dup:[], dupOverride:false, need:null, rep:null, deal:null, done:null, read:{ st:'idle', msg:'' }, err:'', info:'' };
function load() {
  try {
    var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v || typeof v !== 'object') return;
    S.history = (Array.isArray(v.history) ? v.history : []).map(function (p) { return p && clean(p.name, 60) && Number(p.price) > 0 ? { name:clean(p.name, 60), price:Math.round(Number(p.price)), d:/^\d{4}-\d{2}-\d{2}$/.test(p.d) ? p.d : '', seller:clean(p.seller, 30) } : null; }).filter(Boolean).slice(0, MAXP);
    S.memo = clean(v.memo, 600); S.fin = (Array.isArray(v.fin) ? v.fin : []).filter(function (x) { return x && Number(x.amt) > 0; }).slice(0, MAXP);
    S.ledger = (Array.isArray(v.ledger) ? v.ledger : []).slice(0, MAXB);
  } catch (e) { /* 저장값이 깨졌으면 비운 채 시작 */ }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ history:S.history, memo:S.memo, fin:S.fin, ledger:S.ledger })); } catch (e) { /* 저장 불가여도 화면은 쓴다 */ } }
function emit(t, p) { (LS[t] || []).slice().forEach(function (f) { try { f(p); } catch (e) { /* 듣는 쪽 오류는 무시 */ } }); }
function btn(t, c, fn, id) { return h('button', { type:'button', class:'btn ' + (c || ''), text:t, onclick:fn, id:id }); }
function note(t, bad, id) { return h('div', { class:bad ? 'note' : 'note info', role:bad ? 'alert' : 'status', id:id, text:t }); }
function safeImg(u) { u = String(u || ''); return /^https:\/\/[^\s"'<>]+$/i.test(u) || /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(u) ? u : ''; }
function safeLink(u) { u = String(u || '').trim(); return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : ''; }
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
function go(n) { S.tok++; S.step = n; S.err = ''; S.info = ''; if (window.NaviHist) NaviHist.push('market', n); render(); try { M.scrollIntoView({ block:'start' }); } catch (e) { /* 스크롤 불가 */ } }
function reset(keepHistory) { S.tok++; S.ask = null; S.payMsg = null; S.bal = ''; S.step = 0; S.prod = { name:'', price:'', img:'', link:'', seller:'', sellerTrust:'', as:'', rating:'', count:'', reviews:[], shipping:'', compare:[] }; S.dup = []; S.dupOverride = false; S.need = null; S.rep = null; S.deal = null; S.done = null; S.read = { st:'idle', msg:'' }; clearTimeout(coreT); S.err = ''; S.info = ''; render(); }

// ── 도우미(상품 페이지 읽기) ──
var SLOT = '시장 상품 확인';
function goalFor(link) {
  return '이 상품 페이지(' + link + ')를 열어 상품 정보를 확인해 주세요. 로그인이 필요하면 사용자가 로그인하도록 넘기고, 로그인하면 이어서 진행해 주세요. ' +
    '첫째, 상품명을 읽어 주세요. 상품명은 페이지에 보이는 제목을 줄이거나 바꾸지 말고 글자 그대로(브랜드·모델명·수량 포함) 옮기고, 판매 가격(원)·대표 이미지 주소·판매자와 함께 report_data(kind: product, data.stage: core)로 먼저 보내 주세요. ' +
    '둘째, 이어서 판매자 신뢰도(판매자 평점·등급·운영 기간·분쟁 여부, 화면에 있는 말 그대로)·AS(반품·교환·보증) 안내·고객 리뷰 평점(1~5)과 건수·대표 리뷰 요약 최대 5개·배송 방식과 기간·같은 상품의 다른 판매처 가격(찾을 수 있으면 최대 5개)을 읽어 report_data(stage: detail)로 보내 주세요. ' +
    '화면에서 찾지 못한 값은 비우고 지어내지 마세요. 구매·장바구니·결제는 하지 마세요.';
}
function takeProduct(d) {
  d = d && typeof d === 'object' ? d : {}; var p = S.prod, n;
  if (clean(d.name, 80)) p.name = clean(d.name, 80);
  if (Number(d.price) > 0 && Number(d.price) <= 1e9) p.price = String(Math.round(Number(d.price)));
  if (safeImg(d.image)) p.img = safeImg(d.image);
  if (clean(d.seller, 30)) p.seller = clean(d.seller, 30);
  if (clean(d.sellerTrust, 120)) p.sellerTrust = clean(d.sellerTrust, 120);
  if (clean(d.as, 200)) p.as = clean(d.as, 200);
  if (Number(d.rating) >= 1 && Number(d.rating) <= 5) p.rating = String(Math.round(Number(d.rating) * 10) / 10);
  if (Number(d.count) > 0 && Number(d.count) <= 1e8) p.count = String(Math.round(Number(d.count)));
  if (Array.isArray(d.reviews)) p.reviews = d.reviews.slice(0, 5).map(function (x) { return clean(x, 120); }).filter(Boolean);
  if (clean(d.shipping, 80)) p.shipping = clean(d.shipping, 80);
  if (Array.isArray(d.compare)) p.compare = d.compare.map(Number).filter(function (x) { return x > 0 && x <= 1e9; }).slice(0, 5);
  n = [p.name, p.price, p.img, p.as, p.rating].filter(Boolean).length;
  if (d.stage === 'core') S.read = { st:'wait', core:true, msg:'도우미가 상품 이름과 가격을 먼저 읽어 왔어요. 이름이 페이지 제목과 같은지 확인하고 고쳐도 돼요. 나머지(판매자·AS·리뷰)를 이어서 읽는 중이에요.' };
  else S.read = { st:'done', core:true, msg:'도우미가 상품 정보를 읽어 왔어요(' + n + '개 항목). 맞는지 확인하고 고쳐도 돼요.' };
}
var agentWired = false, coreT = 0;
function coreWait() { return typeof window !== 'undefined' && typeof window.__naviMarketCoreWait === 'number' ? window.__naviMarketCoreWait : 90000; }
function wireAgent() {
  if (agentWired || !window.NaviAgent || !NaviAgent.onData) return; agentWired = true;
  NaviAgent.onData(function (m) {
    if (m.label !== SLOT || !M) return; takeProduct(m.data);
    var ready = S.step === 0 && S.auto && clean(S.prod.name, 80) && snum(S.prod.price) >= 1, core = m.data && m.data.stage === 'core';
    if (ready && core) { clearTimeout(coreT); coreT = setTimeout(function () { if (M && S.step === 0 && S.auto) { S.auto = false; startReview(); } }, coreWait()); render(); }   // 이름·가격이 먼저 오면 보여 주고 나머지를 기다린다(오래 안 오면 있는 값으로 시작)
    else if (ready) { clearTimeout(coreT); S.auto = false; startReview(); } else render();
  });   // 도우미가 이름·가격을 읽어 오면 "검토 시작"을 자동으로 누른다
}
var MINVER = '0.6.41';   // 상품 주소 전달(url)과 읽은 값 보내기(report_data)가 들어간 확장 버전. 이보다 낮으면 빈 페이지만 열리고 값이 오지 않는다.
function verOk(v) {
  var a = String(v || '').split('.').map(Number), b = MINVER.split('.').map(Number), i;
  if (a.length < 2 || a.some(function (x) { return !isFinite(x); })) return false;
  for (i = 0; i < b.length; i++) { var x = a[i] || 0; if (x !== b[i]) return x > b[i]; }
  return true;
}
function askAgent() {
  var link = safeLink(S.prod.link);
  if (!link) { S.err = '판매 사이트의 상품 링크(https://로 시작)를 먼저 넣어 주세요.'; render(); return; }
  if (!window.NaviAgent || !NaviAgent.queue) { S.read = { st:'none', msg:'나비웹 도우미를 쓸 수 없는 화면이에요. 아래 칸에 직접 넣어도 돼요.' }; render(); return; }
  wireAgent(); S.auto = true; S.read = { st:'wait', msg:'나비웹 도우미에게 맡겼어요. 판매 사이트가 열리면 로그인이 필요한 경우에만 직접 로그인해 주세요. 읽은 값은 이 화면에 채워져요.' }; S.err = ''; render();
  function probe(n) { return NaviAgent.detect().then(function (info) { return info || (n > 1 ? new Promise(function (r) { setTimeout(r, 700); }).then(function () { return probe(n - 1); }) : null); }); }   // 확장 서비스 워커가 깨어나는 동안 첫 응답이 늦을 수 있어 세 번까지 묻는다
  probe(3).then(function (info) {
    if (!info) { var mark = NaviAgent.installedMark ? NaviAgent.installedMark() : ''; S.read = { st:'none', msg:mark ? '나비웹 도우미가 설치되어 있지만 이 화면과 연결되지 않았어요. 이 화면을 새로고침(F5)한 뒤 다시 눌러 주세요. 아래 칸에 직접 넣어도 돼요.' : '나비웹 도우미가 설치되어 있지 않거나 이 화면에 연결되지 않았어요. 방금 설치했거나 켰다면 이 화면을 새로고침(F5)한 뒤 다시 눌러 주세요. 아래 칸에 직접 넣어도 돼요.' }; render(); return null; }
    if (!verOk(info.version)) { S.read = { st:'none', msg:'나비웹 도우미가 오래된 버전(' + (info.version || '알 수 없음') + ')이에요. 상품 읽기는 ' + MINVER + ' 이상이 필요해요. 크롬 주소창에 chrome://extensions 를 열어 나비웹 도우미를 업데이트한 뒤 다시 눌러 주세요. 아래 칸에 직접 넣어도 돼요.' }; render(); return null; }
    return NaviAgent.queue({ goal:goalFor(link), url:link, slot:SLOT, title:'상품 확인' }).then(function (ok) {
      if (!ok || ok.ok === false) { S.read = { st:'none', msg:'도우미에게 맡기지 못했어요. 아래 칸에 직접 넣어도 돼요.' }; render(); }
    });
  });
}

// ── 화면 ──
function steps() {
  return h('ol', { class:'mk-steps', 'aria-label':'진행 단계' }, STEPS.map(function (t, i) {
    return h('li', { class:i < S.step ? 'done' : i === S.step ? 'cur' : '', 'aria-current':i === S.step ? 'step' : null }, [h('i', { text:i < S.step ? '✓' : String(i + 1) }), h('span', { text:t })]);
  }));
}
function inp(id, label, val, set, o) {
  o = o || {}; var e = h('input', { id:id, type:'text', value:val == null ? '' : val, placeholder:o.ph || '', maxlength:o.max || '200', inputmode:o.mode || '', autocomplete:'off' });
  e.oninput = function () { set(e.value); };
  if (o.enter) e.onkeydown = function (ev) { if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); set(e.value); o.enter(); } };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), e, o.help ? h('div', { class:'help', text:o.help }) : null]);
}
function prodCard() {
  var p = S.prod, img = safeImg(p.img), price = snum(p.price);
  return h('div', { class:'card prod', id:'mk-prod' }, [
    img ? h('img', { src:img, alt:'상품 이미지', referrerpolicy:'no-referrer' }) : h('div', { class:'noimg', text:'이미지 없음' }),
    h('div', { class:'col' }, [h('b', { text:p.name || '(이름 없음)' }), h('div', { class:'sub', text:(isFinite(price) ? won(price) + '원' : '가격 없음') + (p.seller ? ' · ' + p.seller : hostOf(p.link) ? ' · ' + hostOf(p.link) : '') })])]);
}
// ── 진행 기록: 도우미와 시장 SP가 지금까지 한 일을 단계별로 보여 준다 ──
var DOING = ['상품 정보를 받는 중', 'PDV 구매 기록에서 비슷한 물건을 찾는 중', 'PDV의 업무·일상을 살펴 필요도를 따지는 중', '가격·AS·리뷰·판매자를 평가하는 중', '판매자 나비와 조건을 협의하는 중', '결제하고 장부에 기록하는 중'];
function progRows() {
  var p = S.prod, price = snum(p.price), r = [], i, d = S.deal, rp = S.rep, n = S.need;
  var res = [
    { t:(clean(p.name, 40) || '(이름 없음)') + ' · ' + (isFinite(price) ? won(price) + '원' : '가격 없음') + (p.seller ? ' · ' + p.seller : '') + ' — ' + (S.read.st === 'done' ? '도우미가 읽어 왔어요' : '직접 넣었어요'), sub:[] },
    S.step < 1 ? null : { t:S.dup.length ? '비슷한 구매 ' + S.dup.length + '건 있음 → ' + (S.dupOverride ? '“구매 원함”으로 계속' : '멈추고 확인 중') : '비슷한 구매 없음(PDV 기록 ' + S.history.length + '건 확인)',
      sub:S.dup.slice(0, 3).map(function (x) { return '이전 구매: ' + x.name + ' · ' + won(x.price) + '원' + (x.d ? ' · ' + x.d : ''); }) },
    n ? { t:'필요도 ' + n.score + ' / 5 — ' + n.label, sub:n.reasons } : null,
    rp ? { t:rp.title, sub:rp.lines.map(function (l) { return (l.ok === true ? '✓ ' : l.ok === false ? '⚠ ' : '… ') + l.k + ': ' + l.text; }) } : null,
    d ? { t:d.seller + ' · ' + won(d.price) + '원 × ' + d.qty + '개 · ' + d.pay, sub:['배송: ' + d.ship, '구매 조건: ' + d.cond] } : null,
    S.done ? { t:'결제 완료 ' + gdc(S.done.total) + ' · 잔액 ' + gdc(S.done.left) + ' · 장부 ' + S.done.n + '번째 블록', sub:[] } : null];
  for (i = 0; i < STEPS.length; i++) {
    var st = S.step === 6 || i < S.step ? 'done' : i === S.step ? 'now' : 'wait', x = res[i];
    r.push({ k:STEPS[i], st:st, t:st === 'wait' ? '대기' : x ? x.t : DOING[i] + '…', sub:st === 'wait' || !x ? [] : x.sub });
  }
  return r;
}
function progCard(detail) {
  var rows = progRows();
  return h('div', { class:'card', style:'margin-top:16px', id:'mk-prog' }, [h('b', { text:'진행 기록' }), h('ol', { class:'mk-prog' }, rows.map(function (x, i) {
    return h('li', { class:x.st, id:'mk-prog-' + i }, [h('i', { text:x.st === 'done' ? '✓' : x.st === 'now' ? '●' : String(i + 1) }),
      h('div', { class:'col' }, [h('span', {}, [h('b', { text:x.k + ' ' }), h('span', { text:x.t })])].concat(detail ? x.sub.map(function (s) { return h('div', { class:'sub', text:s }); }) : []))]);
  }))]);
}
// 시작 화면: 도우미가 맡은 일을 어디까지 했는지
function helperProg() {
  var s = S.read.st; if (s !== 'wait' && s !== 'done') return null;
  var core = s === 'done' || !!S.read.core, nm = clean(S.prod.name, 60), rows = [['도우미에게 맡김', 'done'], ['판매 사이트 열기 · 로그인(필요할 때만 직접)', core ? 'done' : 'now'],
    ['상품 이름·가격 읽기' + (core && nm ? ' — ' + nm + (isFinite(snum(S.prod.price)) && snum(S.prod.price) ? ' · ' + won(snum(S.prod.price)) + '원' : '') : ''), core ? 'done' : 'wait'],
    ['판매자·AS·리뷰·다른 판매처 가격 읽기', s === 'done' ? 'done' : core ? 'now' : 'wait']];
  return h('div', { class:'card', style:'margin-top:12px', id:'mk-hprog' }, [h('b', { text:'도우미 진행' }), h('ol', { class:'mk-prog' }, rows.map(function (x, i) {
    return h('li', { class:x[1] }, [h('i', { text:x[1] === 'done' ? '✓' : x[1] === 'now' ? '●' : String(i + 1) }), h('div', { class:'col' }, [h('span', { text:x[0] + (x[1] === 'now' ? ' — 진행 중' : '') })])]);
  }))]);
}
function viewStart() {
  var p = S.prod, kids = [];
  kids.push(h('h2', { text:'살 물건을 알려 주세요' }), h('p', { class:'lead', text:'판매 사이트의 상품 링크를 넣고 "도우미로 읽어 오기"를 누르면, 나비웹 도우미가 그 사이트를 열어 이미지·가격·AS·리뷰를 읽어 와요. 로그인은 직접 해 주세요. 직접 넣어도 돼요.' }));
  kids.push(inp('mk-link', '판매 사이트 상품 링크', p.link, function (v) { p.link = v; }, { ph:'https://…', max:'500', enter:function () { if (S.read.st !== 'wait') askAgent(); } }));
  var rowb = [btn('도우미로 읽어 오기', 'fill', askAgent, 'mk-read')];
  kids.push(h('div', { class:'rowf' }, rowb));
  if (S.read.msg) kids.push(note(S.read.msg, S.read.st === 'none', 'mk-read-msg'));
  kids.push(helperProg());
  kids.push(h('div', { class:'g2', style:'margin-top:16px' }, [
    inp('mk-name', '상품 이름', p.name, function (v) { p.name = v; }, { ph:'예: 무선 청소기', max:'80', help:'가장 먼저 정확해야 하는 값이에요. 판매 페이지 제목과 같은지 확인해 주세요.' }),
    inp('mk-price', '가격(원)', p.price, function (v) { p.price = v; }, { ph:'예: 189000', mode:'numeric', max:'12' })]));
  var fi = h('input', { id:'mk-imgfile', type:'file', accept:'image/png,image/jpeg,image/webp', 'aria-label':'상품 이미지 올리기' });
  fi.onchange = function () { var f = fi.files && fi.files[0]; if (!f || f.size > 1500000) { S.err = '이미지는 1.5MB 이하만 올릴 수 있어요.'; render(); return; } var r = new FileReader(); r.onload = function () { p.img = String(r.result); S.err = ''; render(); }; r.readAsDataURL(f); };
  kids.push(h('div', { class:'field' }, [h('label', { for:'mk-imgfile', text:'상품 이미지(선택)' }), fi, h('div', { class:'help', text:'도우미가 읽어 오면 자동으로 채워져요. 이 이미지는 이 화면에만 보이고 밖으로 보내지 않아요.' })]));
  if (p.img) kids.push(prodCard());
  if (S.err) kids.push(note(S.err, true, 'mk-err'));
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('검토 시작', 'fill', startReview, 'mk-start')]));
  return kids;
}
var DELAY = (typeof window !== 'undefined' && typeof window.__naviMarketDelay === 'number') ? window.__naviMarketDelay : 900;
/** 단계 사이는 자동으로 넘어간다. 잠깐 멈춰 지금 단계를 보여 준 뒤 이어 가고, 그 사이 화면이 바뀌었거나 새로 시작했으면 이어 가지 않는다. */
function later(fn) { var k = S.tok; setTimeout(function () { if (M && S.tok === k) fn(); }, DELAY); }
function openAsk(title, text, opts) { S.ask = { title:title, text:text, opts:opts }; render(); }
function closeAsk(fn) { return function () { S.ask = null; if (fn) fn(); else render(); }; }
function modal() {
  var a = S.ask; if (!a) return null;
  var first = null, dlg = h('div', { class:'mk-dlg', role:'dialog', 'aria-modal':'true', 'aria-labelledby':'mk-ask-t' }, [h('b', { id:'mk-ask-t', text:a.title }), h('div', { id:'mk-ask-x', text:a.text }),
    h('div', { class:'rowf', style:'margin-top:16px' }, a.opts.map(function (o, i) { var b = btn(o.t, o.c || '', closeAsk(o.fn), o.id); if (i === 0) first = b; return b; }))]);
  setTimeout(function () { try { first.focus(); } catch (e) { /* 포커스 불가 */ } }, 0);
  return h('div', { class:'mk-ov' }, [dlg]);
}
function startReview() {
  S.auto = false; var p = S.prod, price = snum(p.price);
  if (!clean(p.name, 80)) { S.err = '상품 이름을 넣어 주세요(도우미가 읽어 왔다면 확인해 주세요).'; return render(); }
  if (!(price >= 1 && price <= 1e9)) { S.err = '가격을 1원 이상 숫자로 넣어 주세요.'; return render(); }
  S.dup = F.similar(p.name, S.history); S.dupOverride = false; S.need = null; S.rep = null; S.deal = null; S.err = ''; S.ask = null; S.payMsg = null; S.bal = '';
  go(1);
  later(function () {
    if (!S.dup.length) { toNeed(); return; }
    openAsk('비슷한 구매 기록이 있어요', '「' + S.dup[0].name + '」(' + won(S.dup[0].price) + '원' + (S.dup[0].d ? ', ' + S.dup[0].d : '') + ')을 이미 산 적이 있어요. 중복일 수 있어 멈췄어요. 그래도 사시겠어요?',
      [{ t:'구매 원함', c:'fill', id:'mk-want', fn:function () { S.dupOverride = true; toNeed(); } }, { t:'그만두기', fn:function () { reset(); } }]);
  });
}
function viewDup() {
  var kids = [h('h2', { text:'먼저, 비슷한 걸 산 적이 있는지 볼게요' }), prodCard()];
  kids.push(h('p', { class:'sub', text:'내 데이터 금고(PDV)의 구매 기록 ' + S.history.length + '건에서 찾았어요.' }));
  if (S.dup.length) {
    kids.push(note('비슷한 구매 기록이 있어요. 중복일 수 있어 여기서 멈추고 물어볼게요.', true, 'mk-dup'));
    kids.push(h('div', { class:'card', style:'padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['상품', '가격', '산 날'].map(function (t) { return h('th', { text:t }); }))]),
      h('tbody', {}, S.dup.slice(0, 5).map(function (x) { return h('tr', {}, [h('td', { text:x.name }), h('td', { text:won(x.price) + '원' }), h('td', { text:x.d || '-' })]); }))])])]));
  } else kids.push(note('비슷한 구매 기록이 없어요. 다음 단계로 넘어가요.', false, 'mk-nodup'));
  kids.push(pdvCard());
  return kids;
}
function pdvCard() {
  var d = h('details', { class:'card', style:'margin-top:16px' }), nm = h('input', { id:'mk-h-name', type:'text', placeholder:'상품 이름', maxlength:'60', 'aria-label':'지난 구매 상품 이름' }), pr = h('input', { id:'mk-h-price', type:'text', placeholder:'가격(원)', inputmode:'numeric', maxlength:'12', 'aria-label':'지난 구매 가격' }),
    dd = h('input', { id:'mk-h-date', type:'text', placeholder:'YYYY-MM-DD', maxlength:'10', 'aria-label':'지난 구매 날짜' }), memo = h('textarea', { id:'mk-memo', rows:'3', maxlength:'600', placeholder:'예: 재택 근무, 요리를 자주 함, 주 3회 러닝' });
  memo.value = S.memo; memo.oninput = function () { S.memo = clean(memo.value, 600); save(); };
  d.appendChild(h('summary', { text:'체험용: 내 PDV 기록 보기·고치기' }));
  d.appendChild(h('p', { class:'sub', text:'실제 PDV 연동 전이라, 이 브라우저에 저장하는 체험용 기록이에요. 구매를 마치면 여기에 자동으로 쌓여요.' }));
  d.appendChild(h('b', { text:'업무·일상(필요도 판단에 써요)' })); d.appendChild(memo);
  d.appendChild(h('b', { style:'display:block;margin-top:12px', text:'지난 구매 기록 ' + S.history.length + '건' }));
  S.history.slice(0, 20).forEach(function (x, i) { d.appendChild(h('div', { class:'kv' }, [h('span', { text:x.name + (x.d ? ' · ' + x.d : '') }), h('span', {}, [document.createTextNode(won(x.price) + '원 '), h('button', { type:'button', class:'btn', text:'지우기', onclick:function () { S.history.splice(i, 1); save(); render(); } })])])); });
  d.appendChild(h('div', { class:'rowf', style:'margin-top:8px' }, [nm, pr, dd, btn('기록 추가', '', function () {
    var n = clean(nm.value, 60), p = snum(pr.value), dt = clean(dd.value, 10) || kst(); if (!n || !(p >= 1) || !/^\d{4}-\d{2}-\d{2}$/.test(dt)) { S.info = '이름·가격(숫자)·날짜(YYYY-MM-DD)를 확인해 주세요.'; render(); return; }
    S.history.unshift({ name:n, price:p, d:dt, seller:'' }); S.history = S.history.slice(0, MAXP); save(); S.info = ''; S.dup = F.similar(S.prod.name, S.history); render();
  })]));
  if (S.info) d.appendChild(note(S.info, true)); d.open = !!S.info;
  return d;
}
function toNeed() {
  S.need = F.need({ name:S.prod.name, price:snum(S.prod.price), memo:S.memo, history:S.history, dupOverride:S.dupOverride }); go(2);
  later(function () {
    if (S.need.score >= 3) { toReport(); return; }
    openAsk('필요도가 낮아요(' + S.need.score + ' / 5 · ' + S.need.label + ')', S.need.reasons.join(' / ') + ' — 그래도 계속 볼까요?',
      [{ t:'계속 진행', c:'fill', id:'mk-go2', fn:function () { toReport(); } }, { t:'그만두기', fn:function () { reset(); } }]);
  });
}
function viewNeed() {
  var n = S.need, kids = [h('h2', { text:'이 물건이 나에게 필요할까요?' }), prodCard()];
  kids.push(h('div', { class:'card', style:'margin-top:16px' }, [h('div', { class:'k', text:'필요도 (5 매우 적절 · 1 불필요)' }), h('div', { class:'num', id:'mk-score', style:'font-size:34px;font-weight:700', text:n.score + ' / 5' }), h('div', { class:'sub', id:'mk-score-label', text:n.label }),
    h('ul', {}, n.reasons.map(function (r) { return h('li', { text:r }); }))]));
  kids.push(h('p', { class:'sub', text:'체험용 규칙으로 계산한 점수예요. 실제로는 시장 SP가 PDV의 업무·일상 전체를 분석해 판단해요. 3점 이상이면 자동으로 이어 가고, 낮으면 물어봐요.' }));
  return kids;
}
function toReport() {
  var p = S.prod; S.rep = F.report({ price:snum(p.price), compare:p.compare, as:p.as, seller:p.seller, sellerTrust:p.sellerTrust, rating:p.rating, count:p.count }); go(3);
  later(function () { askBuy(); });
}
function askBuy() {
  var r = S.rep, brief = r.lines.map(function (l) { return (l.ok === true ? '✓ ' : l.ok === false ? '⚠ ' : '… ') + l.k + ': ' + l.text; }).join('\n');
  openAsk('구매할까요? — ' + r.title, '「' + clean(S.prod.name, 40) + '」 ' + won(snum(S.prod.price)) + '원\n' + brief,
    [{ t:'구매', c:'fill', id:'mk-buy', fn:function () { startDeal(); } }, { t:'그만두기', fn:function () { reset(); } }, { t:'보고서 더 보기', id:'mk-more' }]);
}
function viewReport() {
  var r = S.rep, p = S.prod, kids = [h('h2', { text:'구매 검토 보고서' }), prodCard(), progCard(true)];
  kids.push(h('div', { class:'card', style:'margin-top:16px' }, [h('b', { id:'mk-verdict', text:r.title }), h('div', {}, r.lines.map(function (l) {
    return h('div', { class:'kv', style:'align-items:flex-start' }, [h('span', { text:(l.ok === true ? '✓ ' : l.ok === false ? '⚠ ' : '… ') + l.k }), h('span', { style:'text-align:right', text:l.text })]); }))]));
  if (p.reviews && p.reviews.length) kids.push(h('div', { class:'card', style:'margin-top:12px' }, [h('b', { text:'대표 리뷰' }), h('ul', {}, p.reviews.map(function (x) { return h('li', { text:x }); }))]));
  if (!p.as || !p.sellerTrust || !p.rating || p.compare.length < 3) kids.push(h('details', { class:'card', style:'margin-top:12px' }, [h('summary', { text:'보고서에 빠진 값 직접 넣기' }),
    inp('mk-trust', '판매자 신뢰도(평점·등급 등)', p.sellerTrust, function (v) { p.sellerTrust = v; }, { max:'120' }),
    inp('mk-as', 'AS·반품·교환 안내', p.as, function (v) { p.as = v; }, { max:'200' }),
    h('div', { class:'g2' }, [inp('mk-rating', '리뷰 평점(1~5)', p.rating, function (v) { p.rating = v; }, { max:'4' }), inp('mk-count', '리뷰 건수', p.count, function (v) { p.count = v; }, { max:'8', mode:'numeric' })]),
    inp('mk-cmp', '다른 판매처 가격(원, 쉼표로 3개 이상)', p.compare.join(', '), function (v) { p.compare = v.split(/[\s,]+/).map(snum).filter(function (x) { return x >= 1; }).slice(0, 5); }, { max:'80' }),
    btn('보고서 다시 만들기', '', function () { S.rep = F.report({ price:snum(p.price), compare:p.compare, as:p.as, seller:p.seller, sellerTrust:p.sellerTrust, rating:p.rating, count:p.count }); render(); }, 'mk-remake')]));
  if (!S.ask) kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('구매', 'fill', startDeal, 'mk-buy-inline'), btn('그만두기', '', function () { reset(); })]));
  return kids;
}
// 판매자 나비와의 협의(체험용): 시장 SP가 보내는 말과 판매자 나비의 응답을 보여 준다. 판매자 나비 응답은 실제 연결 전이라 이 화면이 만든 체험용 값이다.
function startDeal() {
  var p = S.prod, price = snum(p.price), seller = clean(p.seller, 20) || hostOf(p.link) || '판매자';
  S.deal = { seller:seller, price:price, qty:1, pay:'GDC 블록체인 결제(상호 인증·잔고 검증·장부 기록)', ship:clean(p.shipping, 60) || '택배(기간은 판매자 확인 전 — 체험용)', cond:clean(p.as, 80) || '반품·교환 조건은 판매자 안내 기준(체험용)',
    talk:[['시장 SP → 판매자 나비', '「' + clean(p.name, 40) + '」 1개를 ' + won(price) + '원에 사려고 합니다. 결제는 GDC로, 배송은 택배를 원합니다. 조건을 알려 주세요.'],
          ['판매자 나비(체험용 응답)', '가격 ' + won(price) + '원, 수량 1개 확인했습니다. 결제는 GDC 서명 결제로 받겠습니다. 배송: ' + (clean(p.shipping, 60) || '택배') + '.']] };
  go(4);
  later(function () {
    var d = S.deal;
    openAsk('이 조건으로 결제할까요?', '판매자 ' + d.seller + ' · ' + won(d.price) + '원 × 1개 · 결제 ' + d.pay + ' · 배송 ' + d.ship + ' · 구매 조건 ' + d.cond,
      [{ t:'승인', c:'fill', id:'mk-approve', fn:function () { go(5); later(autoPay); } }, { t:'취소', fn:function () { reset(); } }]);
  });
}
function viewDeal() {
  var d = S.deal, kids = [h('h2', { text:'판매자 나비와 조건을 맞췄어요' }), prodCard()];
  kids.push(h('div', { class:'card col', style:'margin-top:16px', id:'mk-talk' }, d.talk.map(function (t) { return h('div', {}, [h('b', { text:t[0] }), h('div', { text:t[1] })]); })));
  kids.push(note('판매자 나비는 아직 연결되어 있지 않아, 위 응답은 이 화면이 만든 체험용이에요.', false));
  kids.push(h('div', { class:'card', style:'margin-top:12px' }, [h('b', { text:'최종 보고' })].concat([['판매자', d.seller], ['금액', won(d.price) + '원 × ' + d.qty + '개'], ['결제', d.pay], ['배송', d.ship], ['구매 조건', d.cond]].map(function (x) { return h('div', { class:'kv' }, [h('span', { text:x[0] }), h('span', { text:x[1] })]); }))));
  return kids;
}
// 승인 뒤에는 결제까지 자동으로 이어 간다. 잔고가 모자랄 때만 체험용 입금을 물어본다.
function autoPay() {
  var d = S.deal; if (!d) return;
  if (!subtle()) { S.payMsg = { t:'이 브라우저에서는 서명·해시 기능(보안 연결 필요)을 쓸 수 없어 결제를 체험할 수 없어요.', bad:true }; render(); return; }
  S.payMsg = null;
  verifyLedger(S.ledger).then(function (r) {
    var have = r.ok ? (r.bal['나'] || 0) : 0; S.bal = r.ok ? gdc(have) : '장부 이상';
    if (!r.ok) { S.payMsg = { t:'장부에 이상이 있어 결제할 수 없어요(' + r.bad + '번 블록). 체험용 장부를 지우고 다시 해 보세요.', bad:true }; render(); return; }
    if (have < d.price) {
      var need = d.price - have;
      render(); openAsk('잔고가 모자라요', '내 잔고 ' + gdc(have) + ', 결제 금액 ' + gdc(d.price) + '. 실제 GDC 연결 전이라 체험용으로 ' + gdc(need) + '을 입금하고 이어서 결제할까요?',
        [{ t:'체험용 입금 후 결제', c:'fill', id:'mk-dep', fn:function () {
          appendDeposit(S.ledger, '나', String(need)).then(function (res) { if (!res.ok) { S.payMsg = { t:res.msg, bad:true }; render(); return; } S.ledger.push(res.block); save(); S.bal = gdc(d.price); doPay(); })
            .catch(function () { S.payMsg = { t:'입금을 기록하지 못했어요.', bad:true }; render(); }); } },
         { t:'취소', fn:function () { reset(); } }]);
      return;
    }
    render(); doPay();
  }).catch(function () { S.payMsg = { t:'장부를 확인하지 못했어요(이 브라우저에서는 해시 기능을 쓸 수 없어요).', bad:true }; render(); });
}
function doPay() {
  var d = S.deal, t = { item:clean(S.prod.name, 40), qty:'1', price:String(d.price), buyer:'나', seller:d.seller === '나' ? '판매자' : d.seller, d:kst(), n:uid() };
  if (!parseSlip(t)) { S.payMsg = { t:'결제 내용을 확인해 주세요(품목·금액·판매자 이름).', bad:true }; render(); return; }
  var text = canonTerms(t);
  Promise.all([ensureKey('b'), ensureKey('s')]).then(function (ks) {
    return Promise.all([signText(ks[0].priv, text), signText(ks[1].priv, text)]).then(function (sg) {
      return appendTrade(S.ledger, { terms:t, pub:ks[0].pub, sig:sg[0] }, { terms:t, pub:ks[1].pub, sig:sg[1] }).then(function (res) {
        if (!res.ok) { S.payMsg = { t:res.msg, bad:true }; render(); return; }
        S.ledger.push(res.block);
        var total = res.total, left = res.buyerLeft;
        S.fin.unshift({ d:kst(), item:t.item, amt:total, left:left }); S.fin = S.fin.slice(0, MAXP);                          // 재무제표 SP: 장부(지출) 갱신
        S.history.unshift({ name:t.item, price:total, d:kst(), seller:t.seller }); S.history = S.history.slice(0, MAXP);       // 나만의 AI 비서: PDV에 기록
        save(); S.done = { total:total, left:left, n:S.ledger.length, seller:t.seller, item:t.item }; go(6);
      });
    });
  }).catch(function () { S.payMsg = { t:'결제하지 못했어요(이 브라우저에서는 서명·해시 기능을 쓸 수 없어요).', bad:true }; render(); });
}
function viewPay() {
  var d = S.deal, kids = [h('h2', { text:'결제하고 장부에 남겨요' }), prodCard()];
  kids.push(h('div', { class:'card', style:'margin-top:16px' }, [h('b', { text:'결제 금액' }), h('div', { class:'num', id:'mk-pay-amt', style:'font-size:26px;font-weight:700', text:gdc(d.price) }), h('div', { class:'sub', text:'체험용으로 1원을 1 GDC로 봐요.' }),
    S.bal ? h('div', { class:'kv' }, [h('span', { text:'내 잔고(장부 기준)' }), h('b', { id:'mk-pay-have', text:S.bal })]) : null]));
  kids.push(h('div', { class:'sub', style:'margin-top:8px', text:'승인했으니 구매자(나)와 판매자가 같은 내용에 각자 서명하고(상호 인증), 장부로 내 잔고를 다시 계산해 확인한 뒤(잔고 검증), 이전 블록에 이어 붙여 기록해요(장부 기록).' }));
  if (S.payMsg) {
    kids.push(h('div', { id:'mk-pay-msg', style:'margin-top:12px' }, [note(S.payMsg.t, S.payMsg.bad)]));
    kids.push(h('div', { class:'rowf', style:'margin-top:12px' }, [btn('결제 다시 시도', 'fill', function () { autoPay(); }, 'mk-pay'), btn('취소', '', function () { reset(); })]));
  } else if (!S.ask) kids.push(h('div', { class:'sub', id:'mk-pay-wait', style:'margin-top:12px', text:'결제하고 있어요…' }));
  return kids;
}
function viewDone() {
  var o = S.done, kids = [h('h2', { text:'구매를 마쳤어요' }), note('결제와 기록은 체험용이에요. 실제 GDC 지급과 분산 장부는 아직 연결되어 있지 않아요.', false)];
  var rows = [['시장 SP', '「' + o.item + '」 ' + gdc(o.total) + ' 결제를 두 사람의 서명으로 인증하고 잔고를 확인한 뒤, 장부 ' + o.n + '번째 블록으로 기록했어요.'],
    ['재무제표 SP', '지출 ' + gdc(o.total) + '을 내 장부에 반영했어요. 잔고는 ' + gdc(o.left) + '이에요.'],
    ['나만의 AI 비서', '이 구매를 내 데이터 금고(PDV) 구매 기록에 남겼어요. 다음에 비슷한 상품을 보면 중복을 알려 드려요.']];
  kids.push(h('div', { class:'card col', style:'margin-top:16px', id:'mk-done' }, rows.map(function (r) { return h('div', {}, [h('b', { text:'✓ ' + r[0] }), h('div', { text:r[1] })]); })));
  var lg = h('div', { id:'mk-done-ledger', style:'margin-top:12px' });
  kids.push(lg);
  verifyLedger(S.ledger).then(function (r) { lg.appendChild(note(r.ok ? '장부 검증: 이상 없음(' + r.n + '개 블록 — 이음·서명·잔고가 모두 맞아요)' : '장부 검증: ' + r.bad + '번 블록에 이상이 있어요.', !r.ok, 'mk-done-ok')); }).catch(function () {});
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('다른 물건 검토하기', 'fill', function () { reset(); if (window.NaviHist) NaviHist.push('market', 0); }, 'mk-again')]));
  return kids;
}

function render() {
  var root = $('mk-root'), tp = $('mk-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top';
  tp.appendChild(h('div', { class:'topin' }, [h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 시장' })])]), steps()]));
  if (S.step >= 1 && S.step !== 3) root.appendChild(progCard(false));
  var v = [viewStart, viewDup, viewNeed, viewReport, viewDeal, viewPay, viewDone][S.step] || viewStart;
  v().forEach(function (k) { if (k) root.appendChild(k); });
  root.appendChild(h('div', { class:'rowf', style:'margin-top:24px' }, [btn('시장 SP에게 물어보기', '', function () { emit('ask', '지금 보고 있는 구매 검토 단계에서 무엇을 확인하면 좋을지 알려 줘'); })]));
  var m = modal(); if (m) root.appendChild(m);
}
function nav(a) {
  var d = a && typeof a['do'] === 'string' ? a['do'] : '';
  if (d === 'reset' || d === 'start') { reset(); return emit('result', { ok:true, msg:'새 구매 검토를 시작합니다.', view:'buy' }); }
  emit('result', { ok:false, msg:'지원하지 않는 요청입니다.', view:'buy' });
}
function mount(el) {
  if (!el) return;
  M = el; el.textContent = ''; el.classList.add('mkt'); S.history = []; S.memo = ''; S.fin = []; S.ledger = []; reset(); load(); wireAgent();
  [h('div', { id:'mk-top' }), h('div', { class:'wrap', id:'mk-root' })].forEach(function (x) { el.appendChild(x); }); render();
}
if (window.NaviHist) NaviHist.on('market', 'mkt', function (sub) { if (!M) return; S.tok++; S.step = typeof sub === 'number' && sub >= 0 && sub <= 6 ? sub : 0; S.err = ''; S.info = ''; render(); });   // 브라우저 뒤로·앞으로 가기로 단계를 옮긴다
window.NaviMarket = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function () { if (M) { S.step = 0; render(); } },
  flow:F,
  agentVer:{ ok:verOk, min:MINVER },
  ledger:{ newKeys:newKeys, signTerms:function (priv, t) { return signText(priv, canonTerms(t)); }, mutualAuth:mutualAuth, appendDeposit:appendDeposit, appendTrade:appendTrade, verify:verifyLedger, parseSlip:parseSlip, canonTerms:canonTerms },
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
