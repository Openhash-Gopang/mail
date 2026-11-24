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
  if (kind === 'advance') return JSON.stringify(['advance', clean(b.acct, 20), Number(b.amt), clean(b.lid, 30), Number(b.est), clean(b.d, 10), b.fpub && b.fpub.x, b.fsig, b.upub && b.upub.x, b.usig]);
  if (kind === 'settle') return JSON.stringify(['settle', clean(b.acct, 20), Number(b.amt), clean(b.lid, 30), Number(b.price), Number(b.adv), Number(b.interest), clean(b.d, 10), b.fpub && b.fpub.x, b.fsig]);
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
    if (!b || typeof b !== 'object' || b.i !== k || (b.kind !== 'deposit' && b.kind !== 'trade' && b.kind !== 'advance' && b.kind !== 'settle') || !b.body || typeof b.body !== 'object') return Promise.resolve(fail(k, '블록 형식이 맞지 않아요.'));
    if (b.prev !== prev) return Promise.resolve(fail(k, '앞 블록과의 이음이 끊어졌어요.'));
    return hashOf(b.prev, b.i, b.kind, b.t, b.body).then(function (hh) {
      if (hh !== b.hash) return fail(k, '내용이 기록 당시와 달라요(해시가 맞지 않아요).');
      if (b.kind === 'deposit') {
        var a = Number(b.body.amt), ac = clean(b.body.acct, 20);
        if (!ac || !(a >= 1 && a <= 1e13) || Math.floor(a) !== a) return fail(k, '입금 기록이 올바르지 않아요.');
        bal[ac] = (bal[ac] || 0) + a; prev = b.hash; i++; return step();
      }
      if (b.kind === 'advance') {   // 선지급: 금융 인프라가 지급하고 사용자가 받기로 서명했는지
        var bd = b.body, av = Number(bd.amt), ae = Number(bd.est), at = advText(bd);
        if (!(av >= 1 && Math.floor(av) === av && ae >= av) || clean(bd.acct, 20) !== '나' || !clean(bd.lid, 30)) return fail(k, '선지급 기록이 올바르지 않아요.');
        return Promise.all([verifySig(bd.fpub, bd.fsig, at), verifySig(bd.upub, bd.usig, at)]).then(function (v) {
          if (!v[0] || !v[1]) return fail(k, '선지급 서명이 맞지 않아요.');
          bal['나'] = (bal['나'] || 0) + av; bal['금융 인프라 AI'] = (bal['금융 인프라 AI'] || 0) - av; prev = b.hash; i++; return step();
        });
      }
      if (b.kind === 'settle') {   // 정산: 판매가 − 선지급 − 이자(0 밑으로는 내려가지 않음)
        var sd = b.body, pr = Number(sd.price), ad = Number(sd.adv), it = Number(sd.interest), pay = Number(sd.amt);
        if (!(pr >= 1 && ad >= 0 && it >= 0 && pay >= 0) || pay !== Math.max(0, pr - ad - it) || clean(sd.acct, 20) !== '나' || !clean(sd.lid, 30)) return fail(k, '정산 기록이 올바르지 않아요.');
        return verifySig(sd.fpub, sd.fsig, settleText(sd)).then(function (ok) {
          if (!ok) return fail(k, '정산 서명이 맞지 않아요.');
          bal['나'] = (bal['나'] || 0) + pay; bal['금융 인프라 AI'] = (bal['금융 인프라 AI'] || 0) - pay; prev = b.hash; i++; return step();
        });
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
function advText(b) { return JSON.stringify(['advance', clean(b.lid, 30), Number(b.est), Number(b.amt), clean(b.d, 10)]); }
function settleText(b) { return JSON.stringify(['settle', clean(b.lid, 30), Number(b.price), Number(b.adv), Number(b.interest), Number(b.amt), clean(b.d, 10)]); }
/** 선지급: 나비웹 금융 인프라가 서명해 지급하고, 사용자가 받기로 서명한다. 같은 판매 상품에는 한 번만. */
function appendAdvance(chain, o) {
  var amt = snum(o.amt), est = snum(o.est), lid = clean(o.lid, 30);
  if (!lid || !(amt >= 1) || !(est >= amt)) return Promise.resolve({ ok:false, code:'bad', msg:'선지급 금액이 올바르지 않아요.' });
  if (chain.length >= MAXB) return Promise.resolve({ ok:false, code:'full', msg:'장부는 최대 ' + MAXB + '개 블록까지예요.' });
  if (chain.some(function (x) { return x && x.kind === 'advance' && x.body && x.body.lid === lid; })) return Promise.resolve({ ok:false, code:'replay', msg:'이 판매 상품은 이미 선지급을 받았어요.' });
  return verifyLedger(chain).then(function (r) {
    if (!r.ok) return { ok:false, code:'broken', msg:'장부에 이상이 있어 기록할 수 없어요(' + r.bad + '번 블록).' };
    var body = { acct:'나', amt:amt, lid:lid, est:est, d:clean(o.d, 10) || kst() }, text = advText(body);
    return Promise.all([ensureKey('f'), ensureKey('b')]).then(function (ks) {
      return Promise.all([signText(ks[0].priv, text), signText(ks[1].priv, text)]).then(function (sg) {
        body.fpub = ks[0].pub; body.fsig = sg[0]; body.upub = ks[1].pub; body.usig = sg[1];
        return mkBlock(chain, 'advance', body).then(function (blk) { return { ok:true, block:blk }; });
      });
    });
  });
}
function appendSettle(chain, o) {
  var price = snum(o.price), adv = Number(o.adv) || 0, it = Number(o.interest) || 0, lid = clean(o.lid, 30), pay = Math.max(0, price - adv - it);
  if (!lid || !(price >= 1)) return Promise.resolve({ ok:false, code:'bad', msg:'판매 금액을 1원 이상으로 넣어 주세요.' });
  if (chain.length >= MAXB) return Promise.resolve({ ok:false, code:'full', msg:'장부는 최대 ' + MAXB + '개 블록까지예요.' });
  if (chain.some(function (x) { return x && x.kind === 'settle' && x.body && x.body.lid === lid; })) return Promise.resolve({ ok:false, code:'replay', msg:'이미 정산한 판매 상품이에요.' });
  return verifyLedger(chain).then(function (r) {
    if (!r.ok) return { ok:false, code:'broken', msg:'장부에 이상이 있어 기록할 수 없어요(' + r.bad + '번 블록).' };
    var body = { acct:'나', amt:pay, lid:lid, price:price, adv:adv, interest:it, d:clean(o.d, 10) || kst() };
    return ensureKey('f').then(function (fk) {
      return signText(fk.priv, settleText(body)).then(function (sg) { body.fpub = fk.pub; body.fsig = sg; return mkBlock(chain, 'settle', body).then(function (blk) { return { ok:true, block:blk, payout:pay, shortfall:Math.max(0, adv + it - price) }; }); });
    });
  });
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
    if (b.kind === 'advance') return '선지급 · 금융 인프라 → 나 +' + gdc(b.body.amt) + ' · ' + clean(b.body.lid, 30);
    if (b.kind === 'settle') return '판매 정산 · ' + clean(b.body.lid, 30) + ' · 판매가 ' + gdc(b.body.price) + ' − 선지급 ' + gdc(b.body.adv) + ' − 이자 ' + gdc(b.body.interest) + ' = +' + gdc(b.body.amt);
    if (b.kind === 'deposit') return '입금(체험) · ' + clean(b.body.acct, 20) + ' +' + gdc(b.body.amt);
    var t = b.body.terms; return clean(t.buyer, 20) + ' → ' + clean(t.seller, 20) + ' · ' + clean(t.item, 40) + ' × ' + won(t.qty) + ' · ' + gdc(Number(t.qty) * Number(t.price));
  } catch (e) { return '(읽을 수 없는 블록)'; }
}
var KEYS = { b:null, s:null, f:null };
function ensureKey(k) { if (!KEYS[k]) KEYS[k] = newKeys().then(function (kk) { return fingerprint(kk.pub).then(function (fp) { kk.fp = fp; return kk; }); }); return KEYS[k]; }

// ── 구매 검토 한 페이지 (주피터 지시 2026-11-24) ──
// 흐름: ① 상품(이미지·가격·판매 사이트 링크) 받기 → ② 내 데이터 금고(PDV) 구매 기록에서 중복 확인(중복이면 여기서 멈춤, "구매 원함"을 눌러야 계속)
//       → ③ PDV의 업무·일상으로 필요도 1~5점(5 매우 적절, 1 불필요) → "계속 진행" → ④ 가격·AS·리뷰 평가 보고서 → "구매"
//       → ⑤ 시장 SP가 판매자 나비와 구매 조건·결제·배송 협의 → 최종 보고 → ⑥ 승인하면 블록체인 방식 결제(상호 인증·잔고 검증·장부 기록)
//       → 재무제표 SP가 장부 갱신 → 나만의 AI 비서가 PDV에 기록.
// 상품 정보는 나비웹 도우미가 판매 사이트를 열어(로그인은 사용자가) 읽어 오고, 직접 넣어도 된다.
// 연결 전인 것(화면에도 적는다): PDV 실제 연동(기록은 이 브라우저에 저장한 체험용), 판매자 나비(응답은 체험용), 재무제표 SP·나만의 AI 비서(이 화면이 대신 기록), 실제 GDC 잔고·지급.
function snum(v) { var s = String(v == null ? '' : v).replace(/[,\s원]/g, ''); return /^\d+$/.test(s) ? Number(s) : NaN; }
var STEPS = ['상품 이름', '구매 이력', '필요도', '구매 의사', '판매자·소비자 의견', 'AS 평가', '가격 비교', '판매자 협의', '최종 확인', '결제', '국세청 보고'];
var LAST = STEPS.length - 1;
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
/** 판매 상품의 시장 가치 추정: 비슷한 상품 가격 3개 이상의 중앙값 × 상태 계수. 비교 가격이 모자라면 희망가 × 상태 계수(믿음이 낮음)로 하고, 그렇다고 알린다. */
var CONDS = { '새 것':1, '거의 새 것':0.85, '사용감 있음':0.7, '수리 필요':0.45 };
F.CONDS = CONDS;
F.value = function (o) {
  var ask = Number(o.ask), comps = (o.comps || []).map(Number).filter(function (x) { return x > 0; }), fac = o.kind === '서비스' ? 1 : (CONDS[o.cond] || 0.7), base, conf, basis, s, n;
  if (comps.length >= 3) { s = comps.slice().sort(function (a, b) { return a - b; }); n = s.length; base = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; conf = 'mid'; basis = '비슷한 상품 ' + n + '개의 가격 중앙값 ' + won(Math.round(base)) + '원' + (fac !== 1 ? ' × 상태 계수 ' + fac : ''); }
  else { base = ask; conf = 'low'; basis = '비교할 가격이 3개 미만(' + comps.length + '개)이라 내가 적은 희망가 ' + won(ask) + '원' + (fac !== 1 ? ' × 상태 계수 ' + fac : '') + '로 어림했어요(믿음이 낮아요)'; }
  var est = Math.max(1, Math.round(base * fac / 100) * 100 || Math.round(base * fac)), sp = conf === 'mid' ? 0.1 : 0.2;
  return { est:est, low:Math.round(est * (1 - sp)), high:Math.round(est * (1 + sp)), conf:conf, basis:basis, rate:conf === 'mid' ? 0.30 : 0.25, adv:Math.round(est * (conf === 'mid' ? 0.30 : 0.25) / 100) * 100 };
};
var APR = 0.08;   // 체험용 연 이자율
F.interest = function (adv, days) { return Math.round(Number(adv) * APR * Math.max(1, Math.round(Number(days) || 1)) / 365); };
F.days = function (d1, d2) { var a = Date.parse(d1), b = Date.parse(d2); return isFinite(a) && isFinite(b) ? Math.max(1, Math.round((b - a) / 86400000)) : 1; };
F.settle = function (price, adv, days) { var it = F.interest(adv, days), pay = Math.max(0, Number(price) - Number(adv) - it); return { interest:it, payout:pay, shortfall:Math.max(0, Number(adv) + it - Number(price)) }; };
F.intent = function (it, price) {
  return '안녕하세요. 나비웹을 통해 판매 의사를 전해 드립니다.\n판매 품목: ' + it.name + '(' + it.kind + (it.kind === '물품' ? ', ' + it.cond : '') + ', ' + it.qty + '개)\n희망 가격: ' + won(price) + '원\n' + (it.desc ? '설명: ' + it.desc + '\n' : '') + '관심이 있으시면 이 문의 창으로 답해 주세요. 거래는 나비웹 시장에서 구매자·판매자가 같은 내용에 서명하는 방식으로 진행할 수 있습니다.';
};
F.snum = snum; F.norm = norm;

// ── 저장(이 브라우저, 체험용) ──
var KEY = 'navi-market-v2', MAXP = 200;
var M = null, LS = {};
var S = { step:0, prod:{ name:'', price:'', img:'', link:'', seller:'', sellerTrust:'', as:'', rating:'', count:'', reviews:[], shipping:'', compare:[] },
  mode:'buy', sell:null, listings:[], auto:false, find:{ q:'', site:'web', st:'idle', msg:'' }, cands:[], nts:null, ntsMsg:null, tok:0, ask:null, payMsg:null, bal:'', history:[], memo:'', fin:[], ledger:[], dup:[], dupOverride:false, need:null, rep:null, deal:null, done:null, read:{ st:'idle', msg:'' }, err:'', info:'' };
function load() {
  try {
    var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v || typeof v !== 'object') return;
    S.history = (Array.isArray(v.history) ? v.history : []).map(function (p) { return p && clean(p.name, 60) && Number(p.price) > 0 ? { name:clean(p.name, 60), price:Math.round(Number(p.price)), d:/^\d{4}-\d{2}-\d{2}$/.test(p.d) ? p.d : '', seller:clean(p.seller, 30) } : null; }).filter(Boolean).slice(0, MAXP);
    S.memo = clean(v.memo, 600); S.fin = (Array.isArray(v.fin) ? v.fin : []).filter(function (x) { return x && Number(x.amt) > 0; }).slice(0, MAXP);
    S.ledger = (Array.isArray(v.ledger) ? v.ledger : []).slice(0, MAXB);
    S.listings = (Array.isArray(v.listings) ? v.listings : []).map(function (x) { return x && clean(x.id, 30) && clean(x.name, 60) && Number(x.est) > 0 ? { id:clean(x.id, 30), name:clean(x.name, 60), kind:x.kind === '서비스' ? '서비스' : '물품', cond:clean(x.cond, 12), qty:Math.max(1, Math.round(Number(x.qty) || 1)), ask:Math.round(Number(x.ask) || 0), est:Math.round(Number(x.est)), d:/^\d{4}-\d{2}-\d{2}$/.test(x.d) ? x.d : '', status:['등록', '의향서 전송', '선판매', '판매 완료'].indexOf(x.status) >= 0 ? x.status : '등록', advance:Math.round(Number(x.advance) || 0), advD:/^\d{4}-\d{2}-\d{2}$/.test(x.advD) ? x.advD : '', sold:Math.round(Number(x.sold) || 0), payout:Math.round(Number(x.payout) || 0) } : null; }).filter(Boolean).slice(0, MAXP);
  } catch (e) { /* 저장값이 깨졌으면 비운 채 시작 */ }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ listings:S.listings, history:S.history, memo:S.memo, fin:S.fin, ledger:S.ledger })); } catch (e) { /* 저장 불가여도 화면은 쓴다 */ } }
function emit(t, p) { (LS[t] || []).slice().forEach(function (f) { try { f(p); } catch (e) { /* 듣는 쪽 오류는 무시 */ } }); }
function btn(t, c, fn, id) { return h('button', { type:'button', class:'btn ' + (c || ''), text:t, onclick:fn, id:id }); }
function note(t, bad, id) { return h('div', { class:bad ? 'note' : 'note info', role:bad ? 'alert' : 'status', id:id, text:t }); }
function safeImg(u) { u = String(u || ''); return /^https:\/\/[^\s"'<>]+$/i.test(u) || /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(u) ? u : ''; }
function safeLink(u) { u = String(u || '').trim(); return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : ''; }
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
function go(n) { S.tok++; S.step = n; S.err = ''; S.info = ''; if (window.NaviHist) NaviHist.push('market', n); render(); try { M.scrollIntoView({ block:'start' }); } catch (e) { /* 스크롤 불가 */ } }
function reset(keepHistory) { S.tok++; S.find = { q:'', site:'web', st:'idle', msg:'' }; S.cands = []; S.nts = null; S.ntsMsg = null; S.ask = null; S.payMsg = null; S.bal = ''; S.step = 0; S.prod = { name:'', price:'', img:'', link:'', seller:'', sellerTrust:'', as:'', rating:'', count:'', reviews:[], shipping:'', compare:[] }; S.dup = []; S.dupOverride = false; S.need = null; S.rep = null; S.deal = null; S.done = null; S.read = { st:'idle', msg:'' }; clearTimeout(coreT); S.err = ''; S.info = ''; render(); }

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
  if (Array.isArray(d.compare)) { var cm = d.compare.map(Number).filter(function (x) { return x > 0 && x <= 1e9; }).slice(0, 5); if (cm.length) p.compare = cm; }
  n = [p.name, p.price, p.img, p.as, p.rating].filter(Boolean).length;
  if (d.stage === 'core') S.read = { st:'wait', core:true, msg:'도우미가 상품 이름과 가격을 먼저 읽어 왔어요. 이름이 페이지 제목과 같은지 확인하고 고쳐도 돼요. 나머지(판매자·AS·리뷰)를 이어서 읽는 중이에요.' };
  else S.read = { st:'done', core:true, msg:'도우미가 상품 정보를 읽어 왔어요(' + n + '개 항목). 맞는지 확인하고 고쳐도 돼요.' };
}
var agentWired = false, coreT = 0;
function coreWait() { return typeof window !== 'undefined' && typeof window.__naviMarketCoreWait === 'number' ? window.__naviMarketCoreWait : 90000; }
function wireAgent() {
  if (agentWired || !window.NaviAgent || !NaviAgent.onData) return; agentWired = true;
  NaviAgent.onData(function (m) {
    if (!M) return;
    if (m.label === SLOT_FIND) { takeCands(m.data); render(); return; }
    if (m.label === SLOT_COMP) { if (S.sell && S.sell.step === 1) takeComps(m.data); return; }
    if (m.label === SLOT_BUYERS) { if (S.sell && S.sell.step >= 3 && S.sell.step <= 4) takeBuyers(m.data); return; }
    if (m.label !== SLOT) return; takeProduct(m.data);
    var ready = S.step === 0 && S.auto && clean(S.prod.name, 80) && snum(S.prod.price) >= 1, core = m.data && m.data.stage === 'core';
    if (ready && core) { clearTimeout(coreT); coreT = setTimeout(function () { if (M && S.step === 0 && S.auto) { S.auto = false; startReview(); } }, coreWait()); render(); }   // 이름·가격이 먼저 오면 보여 주고 나머지를 기다린다(오래 안 오면 있는 값으로 시작)
    else if (ready) { clearTimeout(coreT); S.auto = false; startReview(); } else render();
  });   // 도우미가 이름·가격을 읽어 오면 "검토 시작"을 자동으로 누른다
  if (NaviAgent.onStatus) NaviAgent.onStatus(function (m) {   // 의향서 전송 결과(도우미가 report_status 로 알림)
    if (!M || !S.sell || m.label !== SLOT_INTENT) return;
    S.sell.sendSt = m.state === 'sent' ? 'sent' : m.state === 'failed' ? 'failed' : 'wait'; S.sell.sendMsg = (m.state === 'sent' ? '판매 의향서를 보냈어요. ' : m.state === 'failed' ? '판매 의향서를 보내지 못했어요. ' : '판매 의향서를 보내는 중이에요. ') + (m.note || '');
    var L = curListing(); if (L && m.state === 'sent' && L.status === '등록') { L.status = '의향서 전송'; save(); } render();
  });
}
var MINVER = '0.6.41';   // 상품 주소 전달(url)과 읽은 값 보내기(report_data)가 들어간 확장 버전. 이보다 낮으면 빈 페이지만 열리고 값이 오지 않는다.
function verOk(v, min) {
  var a = String(v || '').split('.').map(Number), b = String(min || MINVER).split('.').map(Number), i;
  if (a.length < 2 || a.some(function (x) { return !isFinite(x); })) return false;
  for (i = 0; i < b.length; i++) { var x = a[i] || 0; if (x !== b[i]) return x > b[i]; }
  return true;
}
// 도우미에게 일을 맡기는 공통 절차: 연결 확인(세 번까지) → 버전 확인 → 맡기기. 실패하면 setSt('none', 이유)로 알리고 fail()을 부른다.
function agentJob(job, what, setSt, fail, min) {
  function bad(msg) { setSt('none', msg); if (fail) fail(); else render(); return null; }
  if (!window.NaviAgent || !NaviAgent.queue) { bad('나비웹 도우미를 쓸 수 없는 화면이에요. 아래 칸에 직접 넣어도 돼요.'); return; }
  wireAgent(); S.err = '';
  function probe(n) { return NaviAgent.detect().then(function (info) { return info || (n > 1 ? new Promise(function (r) { setTimeout(r, 700); }).then(function () { return probe(n - 1); }) : null); }); }   // 확장 서비스 워커가 깨어나는 동안 첫 응답이 늦을 수 있어 세 번까지 묻는다
  probe(3).then(function (info) {
    if (!info) { var mark = NaviAgent.installedMark ? NaviAgent.installedMark() : ''; return bad(mark ? '나비웹 도우미가 설치되어 있지만 이 화면과 연결되지 않았어요. 이 화면을 새로고침(F5)한 뒤 다시 눌러 주세요. 아래 칸에 직접 넣어도 돼요.' : '나비웹 도우미가 설치되어 있지 않거나 이 화면에 연결되지 않았어요. 방금 설치했다면 이 화면을 새로고침(F5)한 뒤 다시 눌러 주세요. 아래 칸에 직접 넣어도 돼요.'); }
    if (!verOk(info.version, min)) return bad('나비웹 도우미가 오래된 버전(' + (info.version || '알 수 없음') + ')이에요. ' + what + '는 ' + (min || MINVER) + ' 이상이 필요해요. 크롬 주소창에 chrome://extensions 를 열어 나비웹 도우미를 업데이트한 뒤 다시 눌러 주세요. 아래 칸에 직접 넣어도 돼요.');
    return NaviAgent.queue(job).then(function (ok) { if (!ok || ok.ok === false) bad('도우미에게 맡기지 못했어요. 아래 칸에 직접 넣어도 돼요.'); });
  });
}
function askAgent(fallbackStart) {
  var link = safeLink(S.prod.link);
  if (!link) { S.err = '판매 사이트의 상품 링크(https://로 시작)를 먼저 넣어 주세요.'; render(); return; }
  S.auto = true; S.read = { st:'wait', msg:'나비웹 도우미에게 맡겼어요. 판매 사이트가 열리면 로그인이 필요한 경우에만 직접 로그인해 주세요. 읽은 값은 이 화면에 채워져요.' }; render();
  agentJob({ goal:goalFor(link), url:link, slot:SLOT, title:'상품 확인' }, '상품 읽기', function (st, msg) { S.read = { st:st, msg:msg }; },
    fallbackStart ? function () { S.auto = false; startReview(); } : null);   // 고른 후보는 도우미 없이도 있는 값으로 검토를 시작한다
}

// ── 상품 찾기: 사용자가 원하는 상품을 도우미가 온라인 시장에서 찾아 후보 몇 개와 장단점을 가져온다 ──
var SLOT_FIND = '시장 상품 찾기';
var SITES = { web:['웹 전체', 'https://www.google.com/search?q='], coupang:['쿠팡', 'https://www.coupang.com/np/search?q='], naver:['네이버 쇼핑', 'https://search.shopping.naver.com/search/all?query='], danawa:['다나와', 'https://search.danawa.com/dsearch.php?query='] };
function searchUrl(site, q) { var s = SITES[site] || SITES.web; if (!SITES[site] || site === 'web') q = q + ' 구매'; return s[1] + encodeURIComponent(q); }   // 쇼핑몰을 지정하지 않으면(기본) 웹 전체를 검색한다
function goalFind(q, site, url) {
  var web = !SITES[site] || site === 'web';
  return '사용자가 사려는 상품 「' + q + '」을 ' + (web ? '웹 전체에서(특정 쇼핑몰을 정하지 않았으니 검색 결과(' + url + ')와 쇼핑·가격 비교 결과를 이용해 여러 쇼핑몰의 판매 페이지에서 골고루. 상품 링크는 실제 판매 페이지여야 하고 블로그·광고성 글은 피해 주세요)' : (SITES[site] || SITES.web)[0] + '(' + url + ')에서') + ' 찾아 주세요. 로그인이 필요하면 사용자가 로그인하도록 넘기고, 로그인하면 이어서 진행해 주세요. ' +
    '검색 결과에서 서로 다른 후보 3~5개를 골라 주세요(광고 표시가 붙은 것보다 평점·리뷰가 충분한 것을 먼저, 가격대는 다양하게). 후보마다 상품명(페이지 제목 그대로)·가격(원, 숫자)·대표 이미지 주소(https)·상품 링크(https)·판매자·평점(1~5)·리뷰 건수·장점 최대 3개·단점 최대 3개(리뷰와 상품 설명에서 읽은 것만, 짧게)를 읽어 ' +
    'report_data(kind: product, data: { stage: "candidates", candidates: [ { name, price, image, link, seller, rating, count, pros, cons, shipping } ] })로 한 번에 보내 주세요. 화면에서 찾지 못한 값은 비우고 지어내지 마세요. 구매·장바구니·결제는 하지 마세요.';
}
function takeCands(d) {
  var a = d && Array.isArray(d.candidates) ? d.candidates : []; if (!a.length) return;
  var out = a.slice(0, 5).map(function (c) {
    c = c && typeof c === 'object' ? c : {}; var nm = clean(c.name, 80), pr = Math.round(Number(c.price));
    if (!nm || !(pr >= 1 && pr <= 1e9)) return null;
    var r = Number(c.rating), n = Math.round(Number(c.count));
    return { name:nm, price:pr, img:safeImg(c.image), link:safeLink(c.link), seller:clean(c.seller, 30), rating:r >= 1 && r <= 5 ? String(Math.round(r * 10) / 10) : '', count:n > 0 && n <= 1e8 ? String(n) : '', shipping:clean(c.shipping, 80),
      pros:(Array.isArray(c.pros) ? c.pros : []).slice(0, 3).map(function (x) { return clean(x, 80); }).filter(Boolean), cons:(Array.isArray(c.cons) ? c.cons : []).slice(0, 3).map(function (x) { return clean(x, 80); }).filter(Boolean) };
  }).filter(Boolean);
  if (!out.length) { S.find.st = 'none'; S.find.msg = '도우미가 후보를 읽어 오지 못했어요. 찾을 상품 이름을 바꿔 다시 해 보거나 아래에 링크를 넣어 주세요.'; return; }
  S.cands = out; emit('say', { text:candSummary(), open:!!S.find.fromChat }); S.find.st = 'done'; S.find.msg = '도우미가 후보 ' + out.length + '개를 찾아 왔어요. 장단점은 도우미가 판매 페이지에서 읽은 내용이라 정확하지 않을 수 있어요.';
}
function recIndex() {
  var best = -1, bi = -1, lo = 0, i;
  S.cands.forEach(function (x, j) { var r = Number(x.rating), n = Number(x.count); if (r > best && n >= 20) { best = r; bi = j; } if (x.price < S.cands[lo].price) lo = j; });
  return bi >= 0 ? { i:bi, why:'리뷰 20건 이상 중 평점이 가장 높아요' } : { i:lo, why:'평점·리뷰 정보가 부족해 가장 저렴한 걸 골랐어요' };
}
function candSummary() {
  var L = ['후보 ' + S.cands.length + '개를 찾았어요.', ''], r = recIndex();
  S.cands.forEach(function (c, i) {
    L.push((i + 1) + '. **' + c.name + '** — ' + won(c.price) + '원' + (c.seller ? ' · ' + c.seller : '') + (Number(c.rating) ? ' · 평점 ' + c.rating + (c.count ? '(' + won(Number(c.count)) + '건)' : '') : ''));
    if (c.pros.length) L.push('   - 장점: ' + c.pros.join(', ')); if (c.cons.length) L.push('   - 단점: ' + c.cons.join(', '));
  });
  L.push('', '추천: **' + (r.i + 1) + '번** — ' + r.why + '. 평점·리뷰 건수·가격만 본 간단한 추천이고, 장단점은 판매 페이지에서 읽은 내용이라 정확하지 않을 수 있어요.', '몇 번으로 구매 검토를 할까요? 예: “' + (r.i + 1) + '번으로 해 줘” (시장 화면의 “이 상품으로 구매 검토” 단추도 돼요)');
  return L.join('\n');
}
// 대화창 말에서 상품 요청·후보 선택을 알아듣는다(시장 SP는 직접 검색하지 못하므로, 화면의 도우미 검색을 실행하고 결과를 알려 준다)
F.parseWant = function (s) {
  s = String(s || '').trim(); if (!s) return null;
  var pk = s.match(/^([1-5])\s*번/); if (pk) return { pick:Number(pk[1]) - 1 };
  var vi = s.search(/찾아|검색|추천|골라|알아봐|사고\s*싶|사려고|사려는|구하고\s*싶/); if (vi < 0) return null;
  var site = /네이버/.test(s) ? 'naver' : /다나와/.test(s) ? 'danawa' : /쿠팡/.test(s) ? 'coupang' : '';
  var q = s.slice(0, vi).replace(/(온라인|인터넷|쇼핑몰|쇼핑|쿠팡|네이버|다나와)\s*(에서|으로|에)?/g, ' ').replace(/(좀|제발|혹시|제가|내가|저는|나는)\s/g, ' ').replace(/\s*(을|를|이|가|은|는|에|도)\s*$/, '').replace(/(상품|제품|물건)\s*$/, '').replace(/\s+/g, ' ').trim();
  q = q.replace(/\s*(을|를)\s*$/, '').trim(); if (q.length < 2 || q.length > 60) return null;
  return { q:q, site:site };
};
function chat(text) {
  var w = F.parseWant(text); if (!w || !M) return null;
  if (w.pick != null) {
    if (!S.cands.length) return '아직 고를 후보가 없어요. 먼저 “무선 청소기 찾아줘”처럼 사려는 상품을 말해 주세요.';
    if (w.pick >= S.cands.length) return '후보는 1번부터 ' + S.cands.length + '번까지예요.';
    var c = S.cands[w.pick]; pickCand(w.pick); return '「' + c.name + '」(' + won(c.price) + '원)으로 구매 검토를 시작할게요. 도우미가 이 상품 페이지에서 판매자 신뢰도·AS·리뷰를 더 읽어 와요. 진행은 시장 화면에서 단계별로 보여 드려요.';
  }
  if (w.site) S.find.site = w.site; S.find.q = w.q; S.find.fromChat = true; askFind();
  return '「' + w.q + '」을 ' + (S.find.site === 'web' ? '웹 전체' : SITES[S.find.site][0]) + '에서 찾도록 나비웹 도우미에게 맡겼어요. 사이트가 열리면 로그인이 필요할 때만 직접 해 주세요. 후보가 오면 장단점과 함께 여기로 알려 드릴게요. 저는 직접 인터넷을 검색하지 못하고, 도우미가 읽어 온 내용만 전해요.';
}
function candTags(i) {
  var tags = [], c = S.cands, me = c[i], low = Math.min.apply(null, c.map(function (x) { return x.price; })), best = -1, bi = -1;
  if (me.price === low && c.length > 1) tags.push('가장 저렴');
  c.forEach(function (x, j) { var r = Number(x.rating), n = Number(x.count); if (r > best && n >= 20) { best = r; bi = j; } });
  if (bi === i) tags.push('평점 최고(20건 이상 중)');
  return tags;
}
function askFind() {
  var q = clean(S.find.q, 60); if (q.length < 2) { S.err = '찾을 상품을 두 글자 이상 적어 주세요. 예: 무선 청소기'; render(); return; }
  if (S.step !== 0) { var q0 = S.find.q, s0 = S.find.site, fc = S.find.fromChat; reset(); S.find.q = q0; S.find.site = s0; S.find.fromChat = fc; }
  var url = searchUrl(S.find.site, q); S.cands = []; S.find.st = 'wait'; S.find.msg = '나비웹 도우미에게 맡겼어요. 쇼핑 사이트가 열리면 로그인이 필요한 경우에만 직접 로그인해 주세요. 찾은 후보는 이 화면에 나와요.'; S.err = ''; render();
  agentJob({ goal:goalFind(q, S.find.site, url), url:url, slot:SLOT_FIND, title:'상품 찾기' }, '상품 찾기', function (st, msg) { S.find.st = st; S.find.msg = msg; });
}
function pickCand(i) {
  var c = S.cands[i]; if (!c) return;
  S.prod = { name:c.name, price:String(c.price), img:c.img, link:c.link, seller:c.seller, sellerTrust:'', as:'', rating:c.rating, count:c.count, reviews:[], shipping:c.shipping,
    compare:S.cands.filter(function (x, j) { return j !== i; }).map(function (x) { return x.price; }).slice(0, 5), pros:c.pros, cons:c.cons };
  S.read = { st:'idle', msg:'' }; S.err = '';
  if (c.link && window.NaviAgent && NaviAgent.queue) askAgent(true); else startReview();   // 고른 상품의 AS·판매자 신뢰도·리뷰는 도우미가 그 페이지에서 더 읽어 온다
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
var DOING = ['상품 이름을 받는 중', 'PDV 구매 기록에서 비슷한 물건을 찾는 중', 'PDV의 업무·일상을 살펴 필요도를 따지는 중', '구매 의사를 확인하는 중', '판매자 신뢰도와 소비자 의견을 모으는 중', '사후 서비스(AS)를 평가하는 중', '다른 판매처의 같은 상품 가격과 비교하는 중', '판매자 나비와 조건을 협의하는 중', '최종 구매 의사를 확인하는 중', '결제하고 장부에 기록하는 중', '시장 인프라가 국세청에 거래를 보고하는 중'];
function lineRes(keys) {
  var L = S.rep ? S.rep.lines.filter(function (l) { return keys.indexOf(l.k) >= 0; }) : []; if (!L.length) return null;
  return { t:L.map(function (l) { return (l.ok === true ? '✓ ' : l.ok === false ? '⚠ ' : '… ') + l.k; }).join(' · '), sub:L.map(function (l) { return l.k + ': ' + l.text; }) };
}
function progRows() {
  var p = S.prod, price = snum(p.price), r = [], i, d = S.deal, n = S.need, c = p.compare || [];
  var cmp = lineRes(['가격']); if (cmp && c.length) cmp.sub = cmp.sub.concat(['다른 판매처 가격: ' + c.map(won).join('원, ') + '원']);
  var res = [
    { t:(clean(p.name, 40) || '(이름 없음)') + ' · ' + (isFinite(price) ? won(price) + '원' : '가격 없음') + (p.seller ? ' · ' + p.seller : '') + ' — ' + (S.read.st === 'done' ? '도우미가 읽어 왔어요' : '직접 넣었어요'), sub:[] },
    S.step < 1 ? null : { t:S.dup.length ? '비슷한 구매 ' + S.dup.length + '건 있음 → ' + (S.dupOverride ? '“구매 원함”으로 계속' : '멈추고 확인 중') : '비슷한 구매 없음(PDV 기록 ' + S.history.length + '건 확인)',
      sub:S.dup.slice(0, 3).map(function (x) { return '이전 구매: ' + x.name + ' · ' + won(x.price) + '원' + (x.d ? ' · ' + x.d : ''); }) },
    n ? { t:'필요도 ' + n.score + ' / 5 — ' + n.label, sub:n.reasons } : null,
    S.step > 3 ? { t:'구매 의사를 확인했어요' + (S.dupOverride ? '(비슷한 구매가 있지만 “구매 원함”)' : ''), sub:[] } : null,
    lineRes(['판매자 신뢰도', '고객 리뷰']), lineRes(['사후 서비스(AS)']), cmp,
    d ? { t:d.seller + ' · ' + won(d.price) + '원 × ' + d.qty + '개 · ' + d.pay, sub:['배송: ' + d.ship, '구매 조건: ' + d.cond] } : null,
    S.step > 8 ? { t:'최종 구매 의사를 확인했어요(승인)', sub:[] } : null,
    S.done ? { t:'결제 완료 ' + gdc(S.done.total) + ' · 잔액 ' + gdc(S.done.left) + ' · 장부 ' + S.done.n + '번째 블록', sub:[] } : null,
    S.nts ? { t:'일련번호 ' + S.nts.serial + ' · 세액 ' + won(S.nts.tax) + '원', sub:[] } : null];
  for (i = 0; i < STEPS.length; i++) {
    var st = (S.step === LAST && (i < LAST || S.nts)) || i < S.step ? 'done' : i === S.step ? 'now' : 'wait', x = res[i];
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
function findProg() {
  var s = S.find.st; if (s !== 'wait' && s !== 'done') return null;
  var rows = [['도우미에게 맡김', 'done'], ['쇼핑 사이트 열기 · 로그인(필요할 때만 직접)', s === 'done' ? 'done' : 'now'], ['검색 결과에서 후보·장단점 읽기' + (s === 'done' ? ' — ' + S.cands.length + '개' : ''), s === 'done' ? 'done' : 'wait']];
  return h('div', { class:'card', style:'margin-top:12px', id:'mk-fprog' }, [h('b', { text:'도우미 진행(상품 찾기)' }), h('ol', { class:'mk-prog' }, rows.map(function (x, i) {
    return h('li', { class:x[1] }, [h('i', { text:x[1] === 'done' ? '✓' : x[1] === 'now' ? '●' : String(i + 1) }), h('div', { class:'col' }, [h('span', { text:x[0] + (x[1] === 'now' ? ' — 진행 중' : '') })])]);
  }))]);
}
function findBar() {
  var sel = h('select', { id:'mk-site', 'aria-label':'찾을 쇼핑몰(선택, 기본은 웹 전체)', title:'쇼핑몰을 고르지 않으면 웹 전체에서 찾아요' }, Object.keys(SITES).map(function (k) { return h('option', { value:k, text:SITES[k][0], selected:k === S.find.site ? '' : null }); }));
  sel.onchange = function () { S.find.site = sel.value; };
  return h('div', { class:'mk-fbar', id:'mk-fbar' }, [inp('mk-q', '사려는 상품을 말해 주세요 — 도우미가 온라인 시장에서 후보를 찾아 와요', S.find.q, function (v) { S.find.q = v; }, { ph:'예: 무선 청소기 · 100mm 그라인더 · 에어프라이어', max:'60', enter:function () { if (S.find.st !== 'wait') askFind(); } }),
    h('div', { class:'rowf' }, [sel, btn('상품 찾아오기', 'fill', function () { askFind(); }, 'mk-find')])]);
}
function viewFind() {
  var kids = [];
  if (S.find.msg) kids.push(note(S.find.msg, S.find.st === 'none', 'mk-find-msg'));
  kids.push(findProg());
  if (S.cands.length) kids.push(h('div', { id:'mk-cands', class:'col', style:'margin-top:12px;gap:12px' }, S.cands.map(function (c, i) {
    var tg = candTags(i), pr = Number(c.rating) ? '평점 ' + c.rating + (c.count ? ' · 리뷰 ' + won(Number(c.count)) + '건' : '') : '평점 정보 없음';
    return h('div', { class:'card prod', id:'mk-cand-' + i }, [c.img ? h('img', { src:c.img, alt:'상품 이미지', referrerpolicy:'no-referrer' }) : h('div', { class:'noimg', text:'이미지 없음' }),
      h('div', { class:'col', style:'flex:1' }, [h('b', { text:c.name }), h('div', { class:'sub', text:won(c.price) + '원' + (c.seller ? ' · ' + c.seller : '') + ' · ' + pr + (tg.length ? ' · ' + tg.join(' · ') : '') }),
        c.pros.length ? h('ul', { class:'pros' }, c.pros.map(function (x) { return h('li', { text:'✓ 장점: ' + x }); })) : null,
        c.cons.length ? h('ul', { class:'cons' }, c.cons.map(function (x) { return h('li', { text:'⚠ 단점: ' + x }); })) : null,
        btn('이 상품으로 구매 검토', 'fill', function () { pickCand(i); }, 'mk-pick-' + i)])]);
  })));
  return kids;
}
function viewStart() {
  var p = S.prod, kids = [];
  kids.push(h('h2', { text:'살 물건을 알려 주세요' }), h('p', { class:'lead', text:'판매 사이트의 상품 링크를 넣고 "도우미로 읽어 오기"를 누르면, 나비웹 도우미가 그 사이트를 열어 이미지·가격·AS·리뷰를 읽어 와요. 로그인은 직접 해 주세요. 직접 넣어도 돼요.' }));
  kids = kids.concat(viewFind()); kids.push(h('h3', { style:'margin-top:24px', text:'또는 상품 링크로 시작' }));
  kids.push(inp('mk-link', '판매 사이트 상품 링크', p.link, function (v) { p.link = v; }, { ph:'https://…', max:'500', enter:function () { if (S.read.st !== 'wait') askAgent(); } }));
  var rowb = [btn('도우미로 읽어 오기', 'fill', function () { askAgent(false); }, 'mk-read')];
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
  later(toIntent);
}
function viewNeed() {
  var n = S.need, kids = [h('h2', { text:S.step >= 3 ? '필요도를 보고 사려는 마음을 확인해요' : '이 물건이 나에게 필요할까요?' }), prodCard()];
  kids.push(h('div', { class:'card', style:'margin-top:16px' }, [h('div', { class:'k', text:'필요도 (5 매우 적절 · 1 불필요)' }), h('div', { class:'num', id:'mk-score', style:'font-size:34px;font-weight:700', text:n.score + ' / 5' }), h('div', { class:'sub', id:'mk-score-label', text:n.label }),
    h('ul', {}, n.reasons.map(function (r) { return h('li', { text:r }); }))]));
  kids.push(h('p', { class:'sub', text:'체험용 규칙으로 계산한 점수예요. 실제로는 시장 SP가 PDV의 업무·일상 전체를 분석해 판단해요.' }));
  return kids;
}
// 3단계: 필요도를 알려 주고 사용자의 구매 의사를 확인한다.
function toIntent() {
  go(3);
  later(function () {
    var n = S.need;
    openAsk('구매 의사 확인 — 필요도 ' + n.score + ' / 5(' + n.label + ')', n.reasons.join(' / ') + '\n계속 진행해 판매자·소비자 의견, AS, 가격을 알아볼까요?',
      [{ t:'계속 진행', c:'fill', id:'mk-go2', fn:function () { toTrust(); } }, { t:'그만두기', fn:function () { reset(); } }]);
  });
}
function evalRep() { var p = S.prod; S.rep = F.report({ price:snum(p.price), compare:p.compare, as:p.as, seller:p.seller, sellerTrust:p.sellerTrust, rating:p.rating, count:p.count }); }
function toTrust() { evalRep(); go(4); later(function () { go(5); later(function () { go(6); later(startDeal); }); }); }
function lineCard(keys) {
  var L = S.rep.lines.filter(function (l) { return keys.indexOf(l.k) >= 0; });
  return h('div', { class:'card', style:'margin-top:16px' }, L.map(function (l) { return h('div', { class:'kv', style:'align-items:flex-start' }, [h('span', { text:(l.ok === true ? '✓ ' : l.ok === false ? '⚠ ' : '… ') + l.k }), h('span', { style:'text-align:right', text:l.text })]); }));
}
function viewTrust() {
  var p = S.prod, kids = [h('h2', { text:'판매자 신뢰도와 소비자 의견' }), prodCard(), lineCard(['판매자 신뢰도', '고객 리뷰'])];
  if (p.reviews && p.reviews.length) kids.push(h('div', { class:'card', style:'margin-top:12px' }, [h('b', { text:'대표 리뷰' }), h('ul', {}, p.reviews.map(function (x) { return h('li', { text:x }); }))]));
  return kids;
}
function viewAs() { return [h('h2', { text:'사후 서비스(AS) 평가' }), prodCard(), lineCard(['사후 서비스(AS)'])]; }
function viewCompare() {
  var p = S.prod, c = p.compare || [], kids = [h('h2', { text:'같은 상품을 파는 다른 판매처와 가격 비교' }), prodCard(), lineCard(['가격'])];
  if (c.length) kids.push(h('div', { class:'card', style:'padding:0;margin-top:12px' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl', id:'mk-cmp-tbl' }, [h('thead', {}, [h('tr', {}, ['판매처', '가격'].map(function (x) { return h('th', { text:x }); }))]),
    h('tbody', {}, [h('tr', {}, [h('td', { text:'이 상품(' + (p.seller || hostOf(p.link) || '내가 보는 곳') + ')' }), h('td', { text:won(snum(p.price)) + '원' })])].concat(c.map(function (x, i) { return h('tr', {}, [h('td', { text:'다른 판매처 ' + (i + 1) }), h('td', { text:won(x) + '원' })]); })))])])]));
  return kids;
}
// 8단계: 지금까지의 모든 결과와 협의 조건을 한 번에 보여 주고 최종 구매 의사를 묻는다.
function toFinal() {
  go(8);
  later(function () {
    var d = S.deal, brief = S.rep.lines.map(function (l) { return (l.ok === true ? '✓ ' : l.ok === false ? '⚠ ' : '… ') + l.k; }).join(' · ');
    openAsk('최종 구매 의사 확인 — ' + S.rep.title, '「' + clean(S.prod.name, 40) + '」 ' + won(d.price) + '원 × 1개 · 판매자 ' + d.seller + '\n' + brief + '\n결제 ' + d.pay + ' · 배송 ' + d.ship + ' · 구매 조건 ' + d.cond,
      [{ t:'승인', c:'fill', id:'mk-approve', fn:function () { go(9); later(autoPay); } }, { t:'그만두기', fn:function () { reset(); } }, { t:'보고서 더 보기', id:'mk-more' }]);
  });
}
function viewFinal() {
  var p = S.prod, d = S.deal, kids = [h('h2', { text:'구매 검토 최종 보고서' }), prodCard(), progCard(true)];
  kids.push(h('div', { class:'card', style:'margin-top:12px' }, [h('b', { text:'협의한 조건' })].concat([['판매자', d.seller], ['금액', won(d.price) + '원 × ' + d.qty + '개'], ['결제', d.pay], ['배송', d.ship], ['구매 조건', d.cond]].map(function (x) { return h('div', { class:'kv' }, [h('span', { text:x[0] }), h('span', { text:x[1] })]); }))));
  kids.push(h('details', { class:'card', style:'margin-top:12px' }, [h('summary', { text:'보고서에 빠진 값 직접 넣기' }),
    inp('mk-trust', '판매자 신뢰도(평점·등급 등)', p.sellerTrust, function (v) { p.sellerTrust = v; }, { max:'120' }),
    inp('mk-as', 'AS·반품·교환 안내', p.as, function (v) { p.as = v; }, { max:'200' }),
    h('div', { class:'g2' }, [inp('mk-rating', '리뷰 평점(1~5)', p.rating, function (v) { p.rating = v; }, { max:'4' }), inp('mk-count', '리뷰 건수', p.count, function (v) { p.count = v; }, { max:'8', mode:'numeric' })]),
    inp('mk-cmp', '다른 판매처 가격(원, 쉼표로 3개 이상)', (p.compare || []).join(', '), function (v) { p.compare = v.split(/[\s,]+/).map(snum).filter(function (x) { return x >= 1; }).slice(0, 5); }, { max:'80' }),
    btn('보고서 다시 만들기', '', function () { evalRep(); render(); }, 'mk-remake')]));
  if (!S.ask) kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('승인', 'fill', function () { go(9); later(autoPay); }, 'mk-approve-inline'), btn('그만두기', '', function () { reset(); })]));
  return kids;
}
// 판매자 나비와의 협의(체험용): 시장 SP가 보내는 말과 판매자 나비의 응답을 보여 준다. 판매자 나비 응답은 실제 연결 전이라 이 화면이 만든 체험용 값이다.
function startDeal() {
  var p = S.prod, price = snum(p.price), seller = clean(p.seller, 20) || hostOf(p.link) || '판매자';
  S.deal = { seller:seller, price:price, qty:1, pay:'GDC 블록체인 결제(상호 인증·잔고 검증·장부 기록)', ship:clean(p.shipping, 60) || '택배(기간은 판매자 확인 전 — 체험용)', cond:clean(p.as, 80) || '반품·교환 조건은 판매자 안내 기준(체험용)',
    talk:[['시장 SP → 판매자 나비', '「' + clean(p.name, 40) + '」 1개를 ' + won(price) + '원에 사려고 합니다. 결제는 GDC로, 배송은 택배를 원합니다. 조건을 알려 주세요.'],
          ['판매자 나비(체험용 응답)', '가격 ' + won(price) + '원, 수량 1개 확인했습니다. 결제는 GDC 서명 결제로 받겠습니다. 배송: ' + (clean(p.shipping, 60) || '택배') + '.']] };
  go(7);
  later(toFinal);
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
        save(); S.done = { total:total, left:left, n:S.ledger.length, seller:t.seller, item:t.item }; S.nts = null; S.ntsMsg = null; go(LAST); autoReport();
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
// 결제 뒤 시장 인프라 AI의 다음 단계: 국세청에 거래를 보고한다(체험용). 6하원칙 거래 전표에 일련번호와 인프라 서명을 붙여 보내면,
// 국세청 AI가 서명을 확인하고 세액을 정해 자기 서명과 함께 돌려주고, 시장 SP → 나만의 AI 비서 → 재무제표 SP 순으로 장부에 반영한다.
function ntsCanon(o) { return JSON.stringify([o.buyer, o.seller, o.when, o.where, o.what, o.qty, o.price, o.how, o.why]); }
function autoReport() {
  var o = S.done; if (!o) return; S.ntsMsg = null; S.nts = null;
  if (!subtle()) { S.ntsMsg = '이 브라우저에서는 서명·해시 기능(보안 연결 필요)을 쓸 수 없어 국세청 보고를 체험할 수 없어요.'; render(); return; }
  var p = S.prod, serial = 'MK-' + kst().replace(/-/g, '') + '-' + String(100000 + S.ledger.length).slice(1), where = '시장 인프라 AI · ' + (hostOf(p.link) || '판매 사이트'),
    slip = { buyer:'나', seller:o.seller, when:kst(), where:where, what:o.item, qty:1, price:o.total, how:'GDC 블록체인 결제(장부 ' + o.n + '번째 블록)', why:S.need ? '필요도 ' + S.need.score + '/5 · 구매 의사 확인 후 구매' : '구매 의사 확인 후 구매' };
  var text = ntsCanon(slip) + '|' + serial, supply = Math.round(o.total / 1.1), tax = o.total - supply, k = S.tok;
  Promise.all([ensureKey('i'), ensureKey('n')]).then(function (ks) {
    return signText(ks[0].priv, text).then(function (isg) {
      return verifySig(ks[0].pub, isg, text).then(function (ok) {        // 국세청 AI가 인프라 서명을 확인한다
        if (!ok) throw new Error('isig');
        var ntext = text + '|' + tax;
        return signText(ks[1].priv, ntext).then(function (nsg) {
          return verifySig(ks[1].pub, nsg, ntext).then(function (ok2) {  // 나만의 AI 비서가 국세청 서명을 확인한다
            if (!ok2) throw new Error('nsig');
            if (!M || S.tok !== k) return;
            S.nts = { serial:serial, slip:slip, supply:supply, tax:tax, ifp:ks[0].fp, nfp:ks[1].fp };
            if (S.fin[0] && S.fin[0].item === o.item) { S.fin[0].serial = serial; S.fin[0].tax = tax; }
            save(); render();
          });
        });
      });
    });
  }).catch(function () { if (!M || S.tok !== k) return; S.ntsMsg = '국세청 보고를 마치지 못했어요(서명 확인 실패). 결제와 장부 기록은 이미 끝났어요.'; render(); });
}
function viewDone() {
  var o = S.done, n = S.nts, kids = [h('h2', { text:n ? '구매를 마쳤어요' : '시장 인프라가 국세청에 거래를 보고해요' }), note('결제·국세청 보고·기록은 체험용이에요. 국세청 AI와 실제 GDC 지급, 분산 장부는 아직 연결되어 있지 않고, Openhash Network 해시 등록은 생략했어요.', false)];
  if (!n) {
    kids.push(S.ntsMsg ? h('div', { id:'mk-nts-msg', style:'margin-top:12px' }, [note(S.ntsMsg, true), h('div', { class:'rowf', style:'margin-top:12px' }, [btn('국세청에 다시 보고', 'fill', function () { autoReport(); render(); }, 'mk-nts-retry')])])
      : h('div', { class:'sub', id:'mk-nts-wait', style:'margin-top:12px', text:'국세청에 거래를 보고하고 있어요…' }));
    return kids;
  }
  var s = n.slip, rows = [['시장 SP', '「' + o.item + '」 ' + gdc(o.total) + ' 결제를 두 사람의 서명으로 인증하고 잔고를 확인한 뒤, 장부 ' + o.n + '번째 블록으로 기록했어요.'],
    ['시장 인프라 AI → 국세청 AI', '거래 전표(6하원칙)에 일련번호 ' + n.serial + '와 자기 서명(키 ' + n.ifp + ')을 붙여 국세청에 보고했어요.'],
    ['국세청 AI', '인프라 서명을 확인하고 세액을 정했어요: 공급가액 ' + gdc(n.supply) + ' + 부가세 ' + gdc(n.tax) + '(체험용 10%). 세액과 자기 서명(키 ' + n.nfp + ')을 붙여 돌려보냈어요.'],
    ['나만의 AI 비서', '시장 SP를 거쳐 받은 전표의 국세청 서명을 확인하고, 재무제표 SP에 넘기고, 이 구매를 내 데이터 금고(PDV) 구매 기록에 남겼어요. 다음에 비슷한 상품을 보면 중복을 알려 드려요.'],
    ['재무제표 SP', '일련번호 ' + n.serial + '와 함께 지출 ' + gdc(n.supply) + '·부가세대급금 ' + gdc(n.tax) + '을 내 장부에 반영했어요. 잔고는 ' + gdc(o.left) + '이에요.']];
  kids.push(h('div', { class:'card col', style:'margin-top:16px', id:'mk-done' }, rows.map(function (r) { return h('div', {}, [h('b', { text:'✓ ' + r[0] }), h('div', { text:r[1] })]); })));
  kids.push(h('div', { class:'card', style:'margin-top:12px', id:'mk-slip' }, [h('b', { text:'국세청에 보고한 거래 전표 — 일련번호 ' + n.serial })].concat([['누가', '구매자 ' + s.buyer + ' · 판매자 ' + s.seller], ['언제', s.when], ['어디서', s.where], ['무엇을', s.what + ' × ' + s.qty], ['얼마에', gdc(s.price) + '(공급가액 ' + gdc(n.supply) + ' + 부가세 ' + gdc(n.tax) + ')'], ['어떻게', s.how], ['왜', s.why]].map(function (x) { return h('div', { class:'kv' }, [h('span', { text:x[0] }), h('span', { style:'text-align:right', text:x[1] })]); }))));
  var lg = h('div', { id:'mk-done-ledger', style:'margin-top:12px' });
  kids.push(lg);
  verifyLedger(S.ledger).then(function (r) { lg.appendChild(note(r.ok ? '장부 검증: 이상 없음(' + r.n + '개 블록 — 이음·서명·잔고가 모두 맞아요)' : '장부 검증: ' + r.bad + '번 블록에 이상이 있어요.', !r.ok, 'mk-done-ok')); }).catch(function () {});
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('다른 물건 검토하기', 'fill', function () { reset(); if (window.NaviHist) NaviHist.push('market', 0); }, 'mk-again')]));
  return kids;
}

function render() {
  var root = $('mk-root'), tp = $('mk-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top';
  if (window.NaviSim && window.NaviSim.tab) window.NaviSim.tab('market', S.mode === 'sell' ? 'sell' : 's' + S.step);
  if (S.mode === 'sell') { renderSell(tp, root); var m2 = modal(); if (m2) root.appendChild(m2); return; }
  tp.appendChild(h('div', { class:'topin' }, [tabsBar(), h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 시장' })]), h('button', { type:'button', class:'btn quiet', id:'market-sim', text:'시뮬레이션', 'aria-label':'가상 데이터로 시뮬레이션', onclick:function () { if (window._simOpen) window._simOpen('market', 's' + S.step); } })]), findBar(), steps()]));
  if (S.step >= 1 && S.step !== 8) root.appendChild(progCard(false));
  var v = [viewStart, viewDup, viewNeed, viewNeed, viewTrust, viewAs, viewCompare, viewDeal, viewFinal, viewPay, viewDone][S.step] || viewStart;
  v().forEach(function (k) { if (k) root.appendChild(k); });
  root.appendChild(h('div', { class:'rowf', style:'margin-top:24px' }, [btn('시장 SP에게 물어보기', '', function () { emit('ask', '지금 보고 있는 구매 검토 단계에서 무엇을 확인하면 좋을지 알려 줘'); })]));
  var m = modal(); if (m) root.appendChild(m);
}
function nav(a) {
  var d = a && typeof a['do'] === 'string' ? a['do'] : '';
  if (d === 'reset' || d === 'start') { reset(); return emit('result', { ok:true, msg:'새 구매 검토를 시작합니다.', view:'buy' }); }
  emit('result', { ok:false, msg:'지원하지 않는 요청입니다.', view:'buy' });
}
// ── 판매 탭 (주피터 지시 2026-11-24) ──
// 사용자가 가진 물품·서비스의 상세를 넣으면 → 나비웹이 시장 가치를 추정하고 → 나비웹 시장에 등록하고 → 도우미가 구매자를 물색해 → (사용자가 확인하면) 판매 의향서를 보낸다.
// 선판매: 추정 금액의 30% 안팎(비교 가격이 모자라면 25%)을 나비웹 금융 인프라가 먼저 지급하고, 나머지는 판매된 뒤 정산한다(이자를 뺀 금액을 지급).
// 연결 전(체험용): 나비웹 시장 등록은 이 브라우저에만 저장, 금융 인프라 지급·이자(연 8%)·정산은 이 화면이 장부에 흉내, 구매자 응답과 실제 판매는 사용자가 "판매 완료 처리"로 알려 준다.
var SELL_STEPS = ['상품 입력', '시장 가치 추정', '시장 등록', '구매자 물색', '판매 의향서', '선판매', '판매·정산'];
var SLOT_COMP = '시장 판매 시세', SLOT_BUYERS = '시장 구매자 물색', SLOT_INTENT = '시장 판매 의향서';
function newSell(item) { return { step:0, item:item || { name:'', kind:'물품', cond:'거의 새 것', qty:'1', ask:'', desc:'' }, comps:[], compSt:'idle', compMsg:'', val:null, lid:'', buyers:[], buySt:'idle', buyMsg:'', intent:'', sendSt:'idle', sendMsg:'', adv:null, sold:null, err:'' }; }
function sellReset(item) { S.tok++; S.ask = null; clearTimeout(sellT.c); clearTimeout(sellT.b); S.sell = newSell(item); render(); }
var sellT = { c:0, b:0 };
function sgo(n) { S.tok++; S.sell.step = n; S.sell.err = ''; render(); try { M.scrollIntoView({ block:'start' }); } catch (e) { /* 스크롤 불가 */ } }
function hasAgent() { return !!(window.NaviAgent && NaviAgent.queue); }
function curListing() { var id = S.sell && S.sell.lid; return S.listings.filter(function (x) { return x.id === id; })[0] || null; }
function sellStart() {
  var it = S.sell.item, ask = snum(it.ask), qty = snum(it.qty);
  if (clean(it.name, 60).length < 2) { S.sell.err = '판매할 상품(또는 서비스) 이름을 두 글자 이상 적어 주세요.'; return render(); }
  if (!(ask >= 1 && ask <= 1e9)) { S.sell.err = '희망 가격을 1원 이상 숫자로 넣어 주세요.'; return render(); }
  if (!(qty >= 1 && qty <= 1000)) { S.sell.err = '수량은 1~1000 사이로 넣어 주세요.'; return render(); }
  toValue();
}
// 2단계: 시장 가치 추정 — 도우미가 비슷한 상품의 현재 가격을 찾아 오면 그 중앙값으로, 못 찾으면 희망가로 어림한다.
function toValue() {
  var it = S.sell.item; S.sell.comps = []; S.sell.val = null; sgo(1);
  if (!hasAgent()) { S.sell.compSt = 'none'; S.sell.compMsg = '나비웹 도우미를 쓸 수 없는 화면이라 내가 적은 희망가로 어림해요.'; render(); later(finishValue); return; }
  S.sell.compSt = 'wait'; S.sell.compMsg = '도우미가 비슷한 상품의 현재 가격을 찾는 중이에요. 쇼핑 사이트가 열리면 로그인이 필요할 때만 직접 해 주세요.'; render();
  var url = SITES.naver[1] + encodeURIComponent(clean(it.name, 60));
  agentJob({ goal:goalComps(it, url), url:url, slot:SLOT_COMP, title:'시세 확인' }, '시세 확인', function (st, msg) { S.sell.compSt = st; S.sell.compMsg = msg; }, function () { finishValue(); });
  clearTimeout(sellT.c); sellT.c = setTimeout(function () { if (M && S.sell && S.sell.step === 1 && !S.sell.val) { S.sell.compSt = 'none'; S.sell.compMsg = '시세를 제때 받지 못해 희망가로 어림해요.'; finishValue(); } }, 90000);
}
function goalComps(it, url) {
  return '사용자가 판매하려는 「' + clean(it.name, 60) + '」(' + it.kind + (it.kind === '물품' ? ', 상태: ' + it.cond : '') + ')과 비슷한 ' + (it.kind === '물품' ? '상품' : '서비스') + '의 현재 판매 가격을 이 쇼핑 사이트(' + url + ')에서 찾아 주세요. 로그인이 필요하면 사용자가 로그인하도록 넘기고, 로그인하면 이어서 진행해 주세요. ' +
    (it.kind === '물품' && it.cond !== '새 것' ? '가능하면 중고 가격도 함께 봐 주세요. ' : '') + '서로 다른 판매자의 비슷한 것 3~5개의 name·price(원, 숫자)·link(https)·seller를 report_data(kind: product, data: { stage: "candidates", candidates: [ { name, price, link, seller } ] })로 한 번에 보내 주세요. 찾지 못한 값은 비우고 지어내지 마세요. 구매·장바구니·결제는 하지 마세요.';
}
function takeComps(d) {
  var a = d && Array.isArray(d.candidates) ? d.candidates : [];
  S.sell.comps = a.slice(0, 8).map(function (c) { return Math.round(Number(c && c.price)); }).filter(function (x) { return x >= 1 && x <= 1e9; });
  S.sell.compSt = S.sell.comps.length ? 'done' : 'none'; S.sell.compMsg = S.sell.comps.length ? '도우미가 비슷한 ' + (S.sell.item.kind === '물품' ? '상품' : '서비스') + ' ' + S.sell.comps.length + '개의 가격을 찾아 왔어요.' : '도우미가 비슷한 상품의 가격을 찾지 못했어요. 희망가로 어림해요.';
  clearTimeout(sellT.c); finishValue();
}
function finishValue() {
  if (!M || !S.sell || S.sell.step !== 1 || S.sell.val) return;
  var it = S.sell.item; S.sell.val = F.value({ ask:snum(it.ask), cond:it.cond, kind:it.kind, comps:S.sell.comps }); render();
  later(function () {
    var v = S.sell.val;
    openAsk('시장 가치 추정 — ' + won(v.est) + '원', v.basis + '\n예상 범위 ' + won(v.low) + ' ~ ' + won(v.high) + '원. 이 값으로 나비웹 시장에 등록할까요?',
      [{ t:'계속 진행', c:'fill', id:'mk-sv-ok', fn:function () { listIt(); } }, { t:'희망가·상태 고치기', id:'mk-sv-edit', fn:function () { sellReset(S.sell.item); } }, { t:'그만두기', fn:function () { sellReset(); } }]);
  });
}
// 3단계: 나비웹 시장 등록(체험용: 이 브라우저에 저장)
function listIt() {
  var it = S.sell.item, v = S.sell.val, L = { id:'L-' + kst().replace(/-/g, '') + '-' + String(1000 + S.listings.length + 1).slice(1), name:clean(it.name, 60), kind:it.kind, cond:it.kind === '물품' ? it.cond : '', qty:snum(it.qty), ask:snum(it.ask), est:v.est, d:kst(), status:'등록', advance:0, advD:'', sold:0, payout:0 };
  S.listings.unshift(L); S.listings = S.listings.slice(0, MAXP); S.sell.lid = L.id; save(); sgo(2); later(toBuyers);
}
// 4단계: 구매자 물색(도우미)
function goalBuyers(it) {
  return '「' + clean(it.name, 60) + '」(' + it.kind + ')을 사 줄 구매자 후보를 찾아 주세요(이 ' + (it.kind === '물품' ? '물건' : '서비스') + '을 찾는 구매 글, 매입 업체, 관련 구매 커뮤니티 등). 로그인이 필요하면 사용자가 하도록 넘기세요. 후보 3~5곳의 name(업체·계정 이름)·site(사이트 이름)·link(문의·메시지 페이지 주소, https)·reason(후보로 고른 이유, 짧게)을 ' +
    'report_data(kind: product, data: { stage: "buyers", buyers: [ { name, site, link, reason } ] })로 한 번에 보내 주세요. 개인 연락처(전화번호·이메일)는 읽지 말고 문의 페이지 링크만 주세요. 지금은 메시지를 보내지 마세요. 구매·결제는 하지 마세요.';
}
function takeBuyers(d) {
  var a = d && Array.isArray(d.buyers) ? d.buyers : [];
  S.sell.buyers = a.slice(0, 5).map(function (b) { b = b && typeof b === 'object' ? b : {}; var nm = clean(b.name, 60), lk = safeLink(b.link); return nm && lk ? { name:nm, site:clean(b.site, 30), link:lk, reason:clean(b.reason, 100) } : null; }).filter(Boolean);
  S.sell.buySt = S.sell.buyers.length ? 'done' : 'none'; S.sell.buyMsg = S.sell.buyers.length ? '도우미가 구매자 후보 ' + S.sell.buyers.length + '곳을 찾아 왔어요.' : '도우미가 구매자 후보를 찾지 못했어요. 시장 등록만 유지돼요.';
  clearTimeout(sellT.b); if (S.sell.step === 3) later(sToIntent); else render();
}
function toBuyers() {
  var it = S.sell.item; sgo(3);
  if (!hasAgent()) { S.sell.buySt = 'none'; S.sell.buyMsg = '나비웹 도우미를 쓸 수 없는 화면이라 구매자를 물색하지 못해요. 시장 등록만 유지돼요.'; render(); later(sToIntent); return; }
  S.sell.buySt = 'wait'; S.sell.buyMsg = '도우미가 구매자 후보를 찾는 중이에요. 로그인이 필요할 때만 직접 해 주세요.'; render();
  var url = 'https://search.naver.com/search.naver?query=' + encodeURIComponent(clean(it.name, 60) + (it.kind === '물품' ? ' 매입' : ' 구매 문의'));
  agentJob({ goal:goalBuyers(it), url:url, slot:SLOT_BUYERS, title:'구매자 물색' }, '구매자 물색', function (st, msg) { S.sell.buySt = st; S.sell.buyMsg = msg; }, function () { later(sToIntent); }, '0.6.43');
  clearTimeout(sellT.b); sellT.b = setTimeout(function () { if (M && S.sell && S.sell.step === 3 && S.sell.buySt === 'wait') { S.sell.buySt = 'none'; S.sell.buyMsg = '구매자 후보를 제때 받지 못했어요. 시장 등록만 유지돼요.'; sToIntent(); } }, 120000);
}
// 5단계: 판매 의향서 — 보내기 전에 사용자가 문안과 받는 곳을 확인한다.
function sToIntent() {
  if (!M || !S.sell || S.sell.step > 4) return; var L = curListing(); S.sell.intent = F.intent(S.sell.item, snum(S.sell.item.ask)); sgo(4);
  later(function () {
    var b = S.sell.buyers;
    if (!b.length) { toAdv(); return; }
    openAsk('판매 의향서를 보낼까요?', '받는 곳 ' + b.length + '곳: ' + b.map(function (x) { return x.name; }).join(', ') + '\n\n' + S.sell.intent,
      [{ t:'보내기', c:'fill', id:'mk-send', fn:function () { sendIntent(); toAdv(); } }, { t:'보내지 않기', id:'mk-nosend', fn:function () { toAdv(); } }]);
  });
  void L;
}
function sendIntent() {
  var b = S.sell.buyers; if (!b.length || !hasAgent()) return; S.sell.sendSt = 'wait'; S.sell.sendMsg = '도우미가 판매 의향서를 ' + b.length + '곳에 보내는 중이에요. 로그인·본인 확인이 필요하면 직접 해 주세요.';
  var goal = '아래 판매 의향서를 각 구매자 후보의 문의·메시지 페이지로 보내 주세요. 로그인이나 본인 확인이 필요하면 사용자에게 넘기고, 문안은 한 글자도 바꾸지 마세요. 계좌·카드 정보는 보내지 마세요.\n\n[판매 의향서]\n' + S.sell.intent + '\n\n[받는 곳]\n' +
    b.map(function (x, i) { return (i + 1) + ') ' + x.name + ' — ' + x.link; }).join('\n') + '\n\n마치면 report_status(state: sent 또는 failed, note: 보낸 곳 수와 실패한 곳)로 알려 주세요.';
  agentJob({ goal:goal, url:b[0].link, slot:SLOT_INTENT, title:'판매 의향서 전송' }, '의향서 전송', function (st, msg) { S.sell.sendSt = st === 'none' ? 'failed' : st; S.sell.sendMsg = msg; });
}
// 6단계: 선판매 — 추정 금액의 30% 안팎을 금융 인프라가 먼저 지급
function toAdv() {
  if (!M || !S.sell || S.sell.step > 5 || S.sell.step === 5) return; sgo(5);
  later(function () {
    var v = S.sell.val;
    openAsk('선판매 — ' + won(v.adv) + '원을 지금 받으시겠어요?', '추정 금액 ' + won(v.est) + '원의 약 ' + Math.round(v.rate * 100) + '%를 나비웹 금융 인프라가 지금 지급해요. 나머지는 판매된 뒤 정산하며, 정산할 때 이자(연 ' + Math.round(APR * 100) + '%, 체험용)를 뺀 금액을 받아요.',
      [{ t:'선지급 받기', c:'fill', id:'mk-adv-yes', fn:function () { doAdvance(); } }, { t:'나중에', id:'mk-adv-no', fn:function () { toSold(); } }]);
  });
}
function doAdvance() {
  var v = S.sell.val, L = curListing(); if (!L) return;
  if (!subtle()) { S.sell.err = '이 브라우저에서는 서명·해시 기능(보안 연결 필요)을 쓸 수 없어 선지급을 체험할 수 없어요.'; render(); return; }
  appendAdvance(S.ledger, { lid:L.id, est:L.est, amt:v.adv, d:kst() }).then(function (r) {
    if (!r.ok) { S.sell.err = r.msg; render(); return; }
    S.ledger.push(r.block); L.advance = v.adv; L.advD = kst(); L.status = '선판매'; S.sell.adv = { amt:v.adv, n:S.ledger.length }; save(); toSold();
  }).catch(function () { S.sell.err = '선지급을 기록하지 못했어요.'; render(); });
}
function toSold() { var L = curListing(); if (L && L.status === '등록' && S.sell.sendSt === 'sent') { L.status = '의향서 전송'; save(); } sgo(6); }
// 7단계: 판매·정산 — 실제 판매는 사용자가 알려 준다(체험용)
function doSold(priceText) {
  var L = curListing(), price = snum(priceText); if (!L || L.status === '판매 완료') return;
  if (!(price >= 1 && price <= 1e9)) { S.sell.err = '판매된 금액을 1원 이상 숫자로 넣어 주세요.'; render(); return; }
  if (!subtle()) { S.sell.err = '이 브라우저에서는 서명·해시 기능(보안 연결 필요)을 쓸 수 없어 정산을 체험할 수 없어요.'; render(); return; }
  var days = L.advance ? F.days(L.advD, kst()) : 0, st = L.advance ? F.settle(price, L.advance, days) : { interest:0, payout:price, shortfall:0 };
  appendSettle(S.ledger, { lid:L.id, price:price, adv:L.advance, interest:st.interest, d:kst() }).then(function (r) {
    if (!r.ok) { S.sell.err = r.msg; render(); return; }
    S.ledger.push(r.block); L.status = '판매 완료'; L.sold = price; L.payout = r.payout; save();
    S.sell.sold = { price:price, adv:L.advance, days:days, interest:st.interest, payout:r.payout, shortfall:r.shortfall, n:S.ledger.length }; S.sell.err = ''; render();
    verifyLedger(S.ledger).then(function (v) { if (M && S.sell && S.sell.sold) { S.sell.sold.left = v.ok ? (v.bal['나'] || 0) : null; render(); } });
  }).catch(function () { S.sell.err = '정산을 기록하지 못했어요.'; render(); });
}
function openListing(id) { var L = S.listings.filter(function (x) { return x.id === id; })[0]; if (!L) return; var s = newSell({ name:L.name, kind:L.kind, cond:L.cond || '거의 새 것', qty:String(L.qty), ask:String(L.ask), desc:'' }); s.lid = L.id; s.val = { est:L.est, low:Math.round(L.est * 0.9), high:Math.round(L.est * 1.1), conf:'mid', basis:'등록할 때 추정한 값이에요', rate:0.3, adv:L.advance }; s.step = 6; if (L.status === '판매 완료') s.sold = { price:L.sold, adv:L.advance, days:L.advance ? F.days(L.advD, L.d) : 0, interest:Math.max(0, L.sold - L.advance - L.payout), payout:L.payout, shortfall:0, n:0, left:null }; S.tok++; S.ask = null; S.sell = s; render(); }

// ── 판매 화면 ──
function sellSteps() {
  return h('ol', { class:'mk-steps', 'aria-label':'판매 진행 단계' }, SELL_STEPS.map(function (x, i) {
    var st = S.sell.step;
    return h('li', { class:i < st ? 'done' : i === st ? 'cur' : '', 'aria-current':i === st ? 'step' : null }, [h('i', { text:i < st ? '✓' : String(i + 1) }), h('span', { text:x })]);
  }));
}
function agentProg(id, title, st, rows) {
  if (st !== 'wait' && st !== 'done') return null;
  return h('div', { class:'card', style:'margin-top:12px', id:id }, [h('b', { text:title }), h('ol', { class:'mk-prog' }, rows.map(function (x, i) {
    var s = x[1](st); return h('li', { class:s }, [h('i', { text:s === 'done' ? '✓' : s === 'now' ? '●' : String(i + 1) }), h('div', { class:'col' }, [h('span', { text:x[0] + (s === 'now' ? ' — 진행 중' : '') })])]);
  }))]);
}
function sellProgCard() {
  var s = S.sell, L = curListing(), v = s.val, rows = [];
  function row(k, i, t) { var st = i < s.step || (s.step === 6 && s.sold) ? 'done' : i === s.step ? 'now' : 'wait'; rows.push({ k:k, st:st, t:st === 'wait' ? '대기' : t }); }
  row(SELL_STEPS[0], 0, clean(s.item.name, 40) + ' · ' + s.item.kind + (s.item.kind === '물품' ? '(' + s.item.cond + ')' : '') + ' · ' + s.item.qty + '개 · 희망가 ' + won(snum(s.item.ask)) + '원');
  row(SELL_STEPS[1], 1, v ? '추정 ' + won(v.est) + '원(' + won(v.low) + '~' + won(v.high) + '원) — ' + v.basis : '추정하는 중…');
  row(SELL_STEPS[2], 2, L ? '나비웹 시장에 등록했어요 · ' + L.id : '등록하는 중…');
  row(SELL_STEPS[3], 3, s.buyers.length ? '구매자 후보 ' + s.buyers.length + '곳: ' + s.buyers.map(function (b) { return b.name; }).join(', ') : s.buySt === 'wait' ? '도우미가 찾는 중…' : '찾지 못했거나 도우미를 쓸 수 없었어요');
  row(SELL_STEPS[4], 4, s.sendSt === 'sent' ? '판매 의향서를 보냈어요' : s.sendSt === 'wait' ? '도우미가 보내는 중…' : s.sendSt === 'failed' ? '보내지 못했어요: ' + s.sendMsg : s.buyers.length ? '보내지 않았어요' : '보낼 곳이 없었어요');
  row(SELL_STEPS[5], 5, s.adv ? '선지급 ' + gdc(s.adv.amt) + ' 받음(장부 ' + s.adv.n + '번째 블록)' : '선지급을 받지 않았어요');
  row(SELL_STEPS[6], 6, s.sold ? '판매 완료 · 정산 ' + gdc(s.sold.payout) : '구매자 응답을 기다리는 중');
  return h('div', { class:'card', style:'margin-top:16px', id:'mk-sprog' }, [h('b', { text:'진행 기록' }), h('ol', { class:'mk-prog' }, rows.map(function (x, i) {
    return h('li', { class:x.st, id:'mk-sprog-' + i }, [h('i', { text:x.st === 'done' ? '✓' : x.st === 'now' ? '●' : String(i + 1) }), h('div', { class:'col' }, [h('span', {}, [h('b', { text:x.k + ' ' }), h('span', { text:x.t })])])]);
  }))]);
}
function sellForm() {
  var s = S.sell, it = s.item, kids = [h('h2', { text:'내 물건·서비스 판매하기' }), h('p', { class:'lead', text:'파려는 것의 상세를 적으면 나비웹이 시장 가치를 추정하고, 나비웹 시장에 등록하고, 도우미가 구매자를 찾아 판매 의향서를 보내요. 원하면 추정 금액의 30% 안팎을 먼저 받는 선판매도 돼요.' })];
  var sel = h('select', { id:'mk-s-kind', 'aria-label':'물품 또는 서비스' }, ['물품', '서비스'].map(function (k) { return h('option', { value:k, text:k, selected:k === it.kind ? '' : null }); }));
  sel.onchange = function () { it.kind = sel.value; render(); };
  var cs = h('select', { id:'mk-s-cond', 'aria-label':'상태' }, Object.keys(CONDS).map(function (k) { return h('option', { value:k, text:k, selected:k === it.cond ? '' : null }); }));
  cs.onchange = function () { it.cond = cs.value; };
  kids.push(h('div', { class:'g2', style:'margin-top:16px' }, [inp('mk-s-name', '상품(서비스) 이름', it.name, function (v) { it.name = v; }, { ph:'예: 중고 노트북 · 사진 촬영 서비스', max:'60' }), h('div', { class:'field' }, [h('label', { for:'mk-s-kind', text:'종류' }), sel])]));
  kids.push(h('div', { class:'g2' }, [inp('mk-s-ask', '희망 가격(원)', it.ask, function (v) { it.ask = v; }, { ph:'예: 450000', mode:'numeric', max:'12' }), inp('mk-s-qty', '수량', it.qty, function (v) { it.qty = v; }, { ph:'1', mode:'numeric', max:'4' })]));
  if (it.kind === '물품') kids.push(h('div', { class:'field' }, [h('label', { for:'mk-s-cond', text:'상태' }), cs]));
  kids.push(inp('mk-s-desc', '상세 설명(선택)', it.desc, function (v) { it.desc = v; }, { ph:'예: 2023년 구입, 배터리 90%, 충전기 포함', max:'200' }));
  if (s.err) kids.push(note(s.err, true, 'mk-s-err'));
  kids.push(h('div', { class:'rowf', style:'margin-top:12px' }, [btn('판매 시작', 'fill', function () { sellStart(); }, 'mk-s-go')]));
  return kids;
}
function sellItemCard() { var it = S.sell.item; return h('div', { class:'card', style:'margin-top:16px' }, [h('b', { text:clean(it.name, 60) }), h('div', { class:'sub', text:it.kind + (it.kind === '물품' ? ' · ' + it.cond : '') + ' · ' + it.qty + '개 · 희망가 ' + won(snum(it.ask)) + '원' + (it.desc ? ' · ' + it.desc : '') })]); }
function sellView() {
  var s = S.sell, v = s.val, L = curListing(), kids;
  if (s.step === 0) return sellForm();
  if (s.step === 1) {
    kids = [h('h2', { text:'시장 가치를 추정해요' }), sellItemCard(), agentProg('mk-cprog', '도우미 진행(시세 확인)', s.compSt, [['도우미에게 맡김', function () { return 'done'; }], ['쇼핑 사이트 열기 · 비슷한 상품 가격 읽기', function (st) { return st === 'done' ? 'done' : 'now'; }]])];
    if (s.compMsg) kids.push(note(s.compMsg, s.compSt === 'none', 'mk-comp-msg'));
    if (v) kids.push(h('div', { class:'card', style:'margin-top:12px', id:'mk-val' }, [h('div', { class:'k', text:'추정 시장 가치' }), h('div', { class:'num', id:'mk-est', style:'font-size:30px;font-weight:700', text:won(v.est) + '원' }), h('div', { class:'sub', text:'예상 범위 ' + won(v.low) + ' ~ ' + won(v.high) + '원' }), h('div', { class:'sub', text:v.basis }),
      s.comps.length ? h('div', { class:'sub', text:'찾아 온 비슷한 가격: ' + s.comps.map(won).join('원, ') + '원' }) : null]));
    return kids;
  }
  if (s.step === 2) return [h('h2', { text:'나비웹 시장에 등록했어요' }), sellItemCard(), L ? h('div', { class:'card', style:'margin-top:12px', id:'mk-listed' }, [h('b', { text:'등록 번호 ' + L.id }), h('div', { class:'sub', text:'추정 ' + won(L.est) + '원 · 상태 ' + L.status + ' · ' + L.d }), h('div', { class:'sub', text:'체험용이라 이 브라우저에만 등록돼요. 실제 나비웹 시장 노출은 아직 연결되어 있지 않아요.' })]) : null];
  if (s.step === 3) {
    kids = [h('h2', { text:'도우미가 구매자를 찾아요' }), sellItemCard(), agentProg('mk-bprog', '도우미 진행(구매자 물색)', s.buySt, [['도우미에게 맡김', function () { return 'done'; }], ['구매자 후보 찾기(구매 글·매입 업체 등)', function (st) { return st === 'done' ? 'done' : 'now'; }]])];
    if (s.buyMsg) kids.push(note(s.buyMsg, s.buySt === 'none', 'mk-buy-msg'));
    if (s.buyers.length) kids.push(h('div', { class:'card', style:'margin-top:12px', id:'mk-buyers' }, [h('b', { text:'구매자 후보' })].concat(s.buyers.map(function (b, i) { return h('div', { class:'kv', style:'align-items:flex-start' }, [h('span', { text:(i + 1) + '. ' + b.name + (b.site ? ' · ' + b.site : '') }), h('span', { style:'text-align:right', text:b.reason })]); }))));
    return kids;
  }
  if (s.step === 4) {
    kids = [h('h2', { text:'판매 의향서' }), sellItemCard(), h('div', { class:'card', style:'margin-top:12px' }, [h('b', { text:'보낼 문안' }), h('pre', { id:'mk-intent', style:'white-space:pre-wrap;font:inherit;margin:8px 0 0', text:s.intent })])];
    if (s.buyers.length) kids.push(h('div', { class:'sub', style:'margin-top:8px', text:'받는 곳: ' + s.buyers.map(function (b) { return b.name; }).join(', ') + ' — 보내기 전에 사용자가 확인해요.' })); else kids.push(note('보낼 구매자 후보가 없어 의향서는 보내지 않아요.', false));
    return kids;
  }
  if (s.step === 5) return [h('h2', { text:'선판매 — 먼저 받고 나중에 정산' }), sellItemCard(), h('div', { class:'card', style:'margin-top:12px', id:'mk-advcard' }, [h('b', { text:'선지급 안내' }), h('div', { class:'kv' }, [h('span', { text:'추정 금액' }), h('b', { text:won(v.est) + '원' })]), h('div', { class:'kv' }, [h('span', { text:'지금 받는 금액(약 ' + Math.round(v.rate * 100) + '%)' }), h('b', { id:'mk-advamt', text:won(v.adv) + '원' })]),
    h('div', { class:'sub', text:'선지급금은 나비웹 금융 인프라가 지급해요. 나머지는 판매된 뒤 정산하고, 정산할 때 이자(연 ' + Math.round(APR * 100) + '%, 체험용)를 뺀 금액을 받아요.' })])];
  var sd = s.sold; kids = [h('h2', { text:sd ? '판매를 마치고 정산했어요' : '구매자 응답을 기다려요' }), sellItemCard()];
  if (s.sendMsg) kids.push(note(s.sendMsg, s.sendSt === 'failed', 'mk-send-msg'));
  if (s.err) kids.push(note(s.err, true, 'mk-s-err'));
  if (!sd && L) {
    var pin = h('input', { id:'mk-sold-price', type:'text', inputmode:'numeric', maxlength:'12', value:String(L.est), 'aria-label':'판매된 금액(원)' });
    kids.push(h('div', { class:'card', style:'margin-top:12px' }, [h('b', { text:'체험용: 판매 완료 처리' }), h('div', { class:'sub', text:'실제 구매자 응답과 결제는 아직 연결되어 있지 않아요. 판매된 금액을 넣고 누르면 정산을 체험해요.' }), h('div', { class:'field' }, [h('label', { for:'mk-sold-price', text:'판매된 금액(원)' }), pin]),
      L.advance ? h('div', { class:'sub', text:'이미 받은 선지급 ' + won(L.advance) + '원과 이자를 뺀 나머지를 받아요.' }) : null, h('div', { class:'rowf', style:'margin-top:8px' }, [btn('판매 완료 · 정산하기', 'fill', function () { doSold(pin.value); }, 'mk-sold')])]));
  }
  if (sd) kids.push(h('div', { class:'card col', id:'mk-settle', style:'margin-top:12px' }, [h('b', { text:'정산 내역' })].concat([['판매된 금액', gdc(sd.price)], ['이미 받은 선지급', '− ' + gdc(sd.adv)], ['이자(연 ' + Math.round(APR * 100) + '%, ' + sd.days + '일, 체험용)', '− ' + gdc(sd.interest)], ['지금 받는 금액', gdc(sd.payout)]].map(function (x) { return h('div', { class:'kv' }, [h('span', { text:x[0] }), h('b', { text:x[1] })]); })).concat([sd.shortfall ? note('판매 금액이 선지급금과 이자에 못 미쳐 받을 금액은 0이에요. 모자란 ' + gdc(sd.shortfall) + '은 나비웹 금융 인프라가 떠안는 것으로 체험해요.', false) : null, sd.left != null ? h('div', { class:'kv' }, [h('span', { text:'내 잔고(장부 기준)' }), h('b', { id:'mk-settle-left', text:gdc(sd.left) })]) : null])));
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('다른 물건 판매하기', sd ? 'fill' : '', function () { sellReset(); }, 'mk-s-again')]));
  return kids;
}
function myListings() {
  if (!S.listings.length) return null;
  return h('div', { class:'card', style:'margin-top:24px', id:'mk-mine' }, [h('b', { text:'내 판매 상품(나비웹 시장 등록, 체험용)' }), h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['상품', '추정', '선지급', '상태', ''].map(function (x) { return h('th', { text:x }); }))]),
    h('tbody', {}, S.listings.slice(0, 10).map(function (L, i) { return h('tr', { id:'mk-L-' + i }, [h('td', { text:L.name }), h('td', { text:won(L.est) + '원' }), h('td', { text:L.advance ? won(L.advance) + '원' : '-' }), h('td', { text:L.status + (L.status === '판매 완료' ? ' · 정산 ' + won(L.payout) + '원' : '') }),
      h('td', {}, [btn(L.status === '판매 완료' ? '보기' : '정산하기', '', function () { openListing(L.id); }, 'mk-L-open-' + i)])]); }))])])]);
}
function renderSell(tp, root) {
  tp.appendChild(h('div', { class:'topin' }, [tabsBar(), h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 시장 · 판매' })]), h('button', { type:'button', class:'btn quiet', id:'market-sim-sell', text:'시뮬레이션', 'aria-label':'가상 데이터로 시뮬레이션', onclick:function () { if (window._simOpen) window._simOpen('market', 'sell'); } })]), sellSteps()]));
  if (!S.sell) S.sell = newSell();
  if (S.sell.step >= 1) root.appendChild(sellProgCard());
  sellView().forEach(function (k) { if (k) root.appendChild(k); });
  var ml = myListings(); if (ml) root.appendChild(ml);
}
function tabsBar() {
  function tab(id, label) { var on = S.mode === id; return h('button', { type:'button', role:'tab', id:'mk-tab-' + id, class:'mk-tab' + (on ? ' on' : ''), 'aria-selected':on ? 'true' : 'false', text:label, onclick:function () { if (S.mode === id) return; S.tok++; S.ask = null; S.mode = id; if (id === 'sell' && !S.sell) S.sell = newSell(); render(); } }); }
  return h('div', { class:'mk-tabs', role:'tablist', 'aria-label':'시장 기능' }, [tab('buy', '구매 검토'), tab('sell', '판매')]);
}

function mount(el) {
  if (!el) return;
  M = el; el.textContent = ''; el.classList.add('mkt'); S.history = []; S.memo = ''; S.fin = []; S.ledger = []; reset(); load(); wireAgent();
  [h('div', { id:'mk-top' }), h('div', { class:'wrap', id:'mk-root' })].forEach(function (x) { el.appendChild(x); }); render();
}
if (window.NaviHist) NaviHist.on('market', 'mkt', function (sub) { if (!M) return; S.tok++; S.step = typeof sub === 'number' && sub >= 0 && sub <= LAST ? sub : 0; S.err = ''; S.info = ''; render(); });   // 브라우저 뒤로·앞으로 가기로 단계를 옮긴다
window.NaviMarket = {
  mount:mount, chat:chat, sell:{ F:F }, find:function (q) { if (M) { S.find.q = clean(q, 60); askFind(); } }, pick:function (i) { if (M) pickCand(i); },
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function () { if (M) { S.step = 0; render(); } },
  flow:F,
  agentVer:{ ok:verOk, min:MINVER },
  ledger:{ appendAdvance:appendAdvance, appendSettle:appendSettle, newKeys:newKeys, signTerms:function (priv, t) { return signText(priv, canonTerms(t)); }, mutualAuth:mutualAuth, appendDeposit:appendDeposit, appendTrade:appendTrade, verify:verifyLedger, parseSlip:parseSlip, canonTerms:canonTerms },
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
