/* tax-app.js — 나비웹 세무 회계(인프라 AI · 세무 회계). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviTax.mount(요소) · .nav({do:'reset'}) · .on('ask'|'result', 함수) · .flow(순수 함수·전표 흐름)
 * 모양은 tax.css(.tx 범위). 전역은 NaviTax 하나만 쓴다. 장부 계산은 ledger-book.js(NaviLedger)를 먼저 불러온 뒤 쓴다.
 *
 * 한 페이지(주피터 지시 2026-11-24): 시장 인프라가 보낸 거래 전표를 받아 세액 결정과 장부 반영까지 처리하는 세무 회계 쪽 화면.
 *  전표는 시장 화면이 남긴 거래(이 브라우저, 읽기 전용)나 예시 전표로 받는다. 거래를 직접 만드는 입력 폼은 시장 화면의 일이라 여기 두지 않는다.
 *  ① 판매자·구매자의 시장 SP가 시장 인프라 AI를 통해 거래하고, 각자 서명한 거래 전표를 만든다(6하 원칙: 누가·언제·어디서·무엇을·어떻게·왜).
 *  ② 거래가 성사되면 시장 인프라 AI가 일련번호와 자기 서명을 붙여 국세청 AI(국세청의 나만의 AI 비서)에게 전달한다.
 *  ③ 국세청 AI가 인프라 AI의 서명을 확인하고 세액을 정해, 세액과 자기 서명을 붙여 시장 인프라 AI에게 돌려준다.
 *  ④ 시장 인프라 AI가 구매자·판매자의 시장 SP에게 전달하고, 각자의 시장 SP는 각자의 나만의 AI 비서에게 보고한다.
 *  ⑤ 나만의 AI 비서가 국세청 서명을 확인하고 각자의 재무제표 SP에 넘기면, 재무제표 SP가 일련번호와 함께 장부에 반영한다.
 *  ⑥ 모든 개인·기관의 장부 항목과 갱신은 거래 일련번호를 따라가며 진실성을 입증할 수 있다.
 * 편의상 Openhash Network에 해시를 등록하는 과정은 생략한다(주피터 지시).
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 시장 인프라 AI·국세청 AI·시장 SP·나만의 AI 비서·재무제표 SP는 아직 서로 연결되어 있지 않다. 이 화면이 한 브라우저 안에서 이 모두를 대신해 흐름을 보여 준다.
 *    서명은 이 화면이 만든 임시 키(ECDSA P-256)로 하며 실제 신원 인증이 아니다. 기록은 이 브라우저(localStorage)에만 저장된다.
 *  - 「홈택스에서 가져오기」는 고른 조회 화면(신고 내역·전자세금계산서·사업자 현황)을 나비웹 도우미가 홈택스에서 열어 주는 것이다. 이 화면은 'agent' 이벤트로 할 일만 호스트에 넘기고,
 *    로그인·인증서는 사용자가 하며 조회·내려받기까지만 한다(신고서 제출·납부는 하지 않는다). 내려받은 파일은 사용자의 컴퓨터에 저장되고 이 장부에는 자동으로 반영되지 않는다.
 *  - 세액은 부가가치세 10%(공급가액 기준) 체험 값이다. 실제 과세는 최신 세법에 따라 국세청이 정하며, 세무 상담이나 신고 대리가 아니다.
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
function emit(t, p) { (LS[t] || []).slice().forEach(function (f) { try { f(p); } catch (e) { /* 듣는 쪽 오류는 무시 */ } }); }
function won(n) { return Math.round(Number(n) || 0).toLocaleString('ko-KR'); }
function btn(t, c, fn, id) { return h('button', { type:'button', class:'btn ' + (c || ''), text:t, onclick:fn, id:id }); }
function note(t, bad, id) { return h('div', { class:bad ? 'note' : 'note info', role:bad ? 'alert' : 'status', id:id, text:t }); }
function kst() { return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul' }).format(new Date()); }
function nowKst() { var m = {}; new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).formatToParts(new Date()).forEach(function (x) { m[x.type] = x.value; }); return m.year + '-' + m.month + '-' + m.day + ' ' + (m.hour === '24' ? '00' : m.hour) + ':' + m.minute + ':' + m.second; }
function clean(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
function snum(v) { var s = String(v == null ? '' : v).replace(/[,\s원]/g, ''); return /^\d+$/.test(s) ? Number(s) : NaN; }

// ── 서명·해시(WebCrypto): 전표의 진실성은 서명과 해시로 확인한다 ──
function subtle() { try { var c = window.crypto || window.msCrypto; return c && c.subtle ? c.subtle : null; } catch (e) { return null; } }
function enc(s) { return new TextEncoder().encode(String(s)); }
function toHex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join(''); }
function toB64(buf) { var s = '', a = new Uint8Array(buf), i; for (i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
function fromB64(b) { var s = atob(String(b)), a = new Uint8Array(s.length), i; for (i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a.buffer; }
function sha256Hex(s) { return subtle().digest('SHA-256', enc(s)).then(toHex); }
var ALG = { name:'ECDSA', namedCurve:'P-256' }, SIG = { name:'ECDSA', hash:'SHA-256' };
function newKey() {
  var sb = subtle(); if (!sb) return Promise.reject(new Error('nosubtle'));
  return sb.generateKey(ALG, true, ['sign', 'verify']).then(function (kp) { return sb.exportKey('jwk', kp.publicKey).then(function (jwk) { return { priv:kp.privateKey, pub:{ kty:jwk.kty, crv:jwk.crv, x:jwk.x, y:jwk.y } }; }); });
}
function sign(priv, text) { return subtle().sign(SIG, priv, enc(text)).then(toB64); }
function verify(pub, text, sig) {
  try { return subtle().importKey('jwk', { kty:pub.kty, crv:pub.crv, x:pub.x, y:pub.y, ext:true }, ALG, false, ['verify']).then(function (k) { return subtle().verify(SIG, k, fromB64(sig), enc(text)); }).catch(function () { return false; }); }
  catch (e) { return Promise.resolve(false); }
}
function fp(pub) { return sha256Hex(String(pub.x) + String(pub.y)).then(function (x) { return x.slice(0, 8); }); }

// ── 거래 전표(6하 원칙) · 세액 · 장부 반영 ──
var KEY = 'navi-tax-v2', MAXR = 50, VAT = 0.10;
var W6 = [['buyer', '누가(구매자)'], ['seller', '누가(판매자)'], ['when', '언제'], ['where', '어디서'], ['what', '무엇을'], ['how', '어떻게'], ['why', '왜']];
function checkSlip(f) {
  var o = { buyer:clean(f.buyer, 20), seller:clean(f.seller, 20), when:clean(f.when, 10), where:clean(f.where, 40), what:clean(f.what, 40), qty:snum(f.qty), price:snum(f.price), how:clean(f.how, 30), why:clean(f.why, 40) };
  if (!o.buyer || !o.seller) return { ok:false, msg:'구매자와 판매자 이름을 모두 넣어 주세요(누가).' };
  if (o.buyer === o.seller) return { ok:false, msg:'구매자와 판매자는 서로 달라야 해요.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.when)) return { ok:false, msg:'언제: 날짜를 YYYY-MM-DD로 넣어 주세요.' };
  if (!o.where) return { ok:false, msg:'어디서 거래했는지 넣어 주세요.' };
  if (!o.what) return { ok:false, msg:'무엇을 거래했는지 넣어 주세요.' };
  if (!(o.qty >= 1 && o.qty <= 1e5)) return { ok:false, msg:'수량은 1 이상 정수로 넣어 주세요.' };
  if (!(o.price >= 1 && o.price <= 1e9)) return { ok:false, msg:'단가는 1원 이상 정수로 넣어 주세요.' };
  if (!o.how) return { ok:false, msg:'어떻게(결제 방식)를 넣어 주세요.' };
  if (!o.why) return { ok:false, msg:'왜(거래 사유)를 넣어 주세요.' };
  o.supply = o.qty * o.price; return { ok:true, slip:o };
}
function canon(o) { return JSON.stringify([o.buyer, o.seller, o.when, o.where, o.what, o.qty, o.price, o.how, o.why]); }
function vat10(supply) { return Math.round(supply * VAT); }
/** 장부 반영 분개: 같은 전표와 세액에서 누구나 똑같이 다시 만들 수 있어야 한다(진실성 대조에 쓴다). */
function entryFor(side, slip, tax, serial, hash) {
  var s = slip.supply, lines = side === 'buyer'
    ? [['상품(재고자산)', s, 0], ['부가세대급금', tax, 0], ['현금(GDC)', 0, s + tax]]
    : [['현금(GDC)', s + tax, 0], ['매출', 0, s], ['부가세예수금', 0, tax]];
  return { serial:serial, hash:hash, side:side, owner:side === 'buyer' ? slip.buyer : slip.seller, lines:lines };
}
var KEYS = null;
function keys() {
  if (!KEYS) KEYS = Promise.all([newKey(), newKey(), newKey(), newKey()]).then(function (k) { return { b:k[0], s:k[1], i:k[2], n:k[3] }; });
  return KEYS;
}
function txt(kind, serial, c, a, b) { return [kind, serial, c, a, b].join('|'); }
/** 전표 한 건이 지나가는 길 전체를 실제로 서명·확인하며 실행한다. 한 곳이라도 확인이 틀리면 거기서 멈춘다. */
function run(f, seq) {
  var v = checkSlip(f); if (!v.ok) return Promise.resolve(v);
  if (!subtle()) return Promise.resolve({ ok:false, msg:'이 브라우저에서는 서명·해시 기능(보안 연결 필요)을 쓸 수 없어요.' });
  var slip = v.slip, C = canon(slip), serial = 'MK-' + slip.when.replace(/-/g, '') + '-' + String(10000 + (seq || 0) + 1).slice(1), hops = [];
  return keys().then(function (K) {
    return Promise.all([sign(K.b.priv, C), sign(K.s.priv, C), fp(K.b.pub), fp(K.s.pub), fp(K.i.pub), fp(K.n.pub)]).then(function (a) {
      var sigB = a[0], sigS = a[1], F = { b:a[2], s:a[3], i:a[4], n:a[5] };
      hops.push({ who:'구매자 시장 SP · 판매자 시장 SP', to:'시장 인프라 AI', text:'시장 인프라 AI를 통해 거래하고, 각자 서명한 거래 전표를 만들었어요(서명 키 ' + F.b + ' · ' + F.s + ').' });
      var tI = txt('INFRA', serial, C, sigB, sigS);
      return sign(K.i.priv, tI).then(function (sigI) {
        hops.push({ who:'시장 인프라 AI', to:'국세청 AI', text:'거래 일련번호 ' + serial + '와 자기 서명(키 ' + F.i + ')을 붙여 국세청 AI에게 전달했어요.' });
        return Promise.all([verify(K.i.pub, tI, sigI), verify(K.b.pub, C, sigB), verify(K.s.pub, C, sigS)]).then(function (ok) {
          if (!ok[0]) return { ok:false, msg:'국세청 AI가 시장 인프라 AI의 서명을 확인하지 못해 멈췄어요.' };
          if (!ok[1] || !ok[2]) return { ok:false, msg:'국세청 AI가 구매자·판매자의 서명을 확인하지 못해 멈췄어요.' };
          var tax = vat10(slip.supply), tN = txt('NTS', serial, C, tax, sigI);
          hops.push({ who:'국세청 AI(국세청의 나만의 AI 비서)', to:'시장 인프라 AI', text:'인프라 서명과 당사자 서명을 확인했어요(✓). 부가가치세법 제9조(재화의 공급)·제29조(과세표준)·제30조(세율 10%)를 참고해 세액을 ' + won(tax) + '원으로 정하고(공급가액 ' + won(slip.supply) + '원의 10%, 체험 값) 자기 서명(키 ' + F.n + ')을 붙여 돌려보냈어요.' });
          return sign(K.n.priv, tN).then(function (sigN) {
            hops.push({ who:'시장 인프라 AI', to:'구매자·판매자 시장 SP', text:'세액과 국세청 서명이 붙은 전표를 두 시장 SP에게 전달했어요.' });
            hops.push({ who:'구매자 시장 SP · 판매자 시장 SP', to:'각자의 나만의 AI 비서', text:'각자의 나만의 AI 비서에게 보고했어요.' });
            return Promise.all([verify(K.n.pub, tN, sigN), verify(K.n.pub, tN, sigN), sha256Hex(tN + '|' + sigN)]).then(function (r2) {
              if (!r2[0] || !r2[1]) return { ok:false, msg:'나만의 AI 비서가 국세청 서명을 확인하지 못해 장부에 반영하지 않았어요.' };
              var hash = r2[2];
              hops.push({ who:'구매자·판매자의 나만의 AI 비서', to:'재무제표 SP', text:'국세청 서명을 확인했어요(✓ 구매자 측 ✓ 판매자 측). 각자의 재무제표 SP에 전달했어요.' });
              hops.push({ who:'재무제표 SP', to:'장부', text:'일련번호 ' + serial + '와 함께 해당 항목을 각자의 장부에 반영했어요.' });
              var rec = { serial:serial, slip:slip, tax:tax, sigB:sigB, sigS:sigS, sigI:sigI, sigN:sigN, pubs:{ b:K.b.pub, s:K.s.pub, i:K.i.pub, n:K.n.pub }, hash:hash,
                buyer:entryFor('buyer', slip, tax, serial, hash), seller:entryFor('seller', slip, tax, serial, hash), hops:hops };
              return { ok:true, rec:rec };
            });
          });
        });
      });
    });
  }).catch(function () { return { ok:false, msg:'처리하지 못했어요(이 브라우저에서는 서명·해시 기능을 쓸 수 없어요).' }; });
}
/** 일련번호로 거슬러 올라가 진실성을 확인한다: 서명 4개, 전표 해시, 두 장부 항목이 전표에서 다시 만든 값과 같은지. */
function trace(rec) {
  var s = rec.slip, C = canon(s), tI = txt('INFRA', rec.serial, C, rec.sigB, rec.sigS), tN = txt('NTS', rec.serial, C, rec.tax, rec.sigI);
  return Promise.all([verify(rec.pubs.b, C, rec.sigB), verify(rec.pubs.s, C, rec.sigS), verify(rec.pubs.i, tI, rec.sigI), verify(rec.pubs.n, tN, rec.sigN), sha256Hex(tN + '|' + rec.sigN)]).then(function (a) {
    var hash = a[4], taxOk = rec.tax === vat10(s.supply), checks = [
      { k:'구매자 시장 SP 서명', ok:a[0] }, { k:'판매자 시장 SP 서명', ok:a[1] }, { k:'시장 인프라 AI 서명(일련번호 포함)', ok:a[2] }, { k:'국세청 AI 서명(세액 포함)', ok:a[3] },
      { k:'세액이 전표 금액과 맞음(체험 규칙)', ok:taxOk }, { k:'전표 해시 일치', ok:hash === rec.hash }];
    ['buyer', 'seller'].forEach(function (side) {
      var e = rec[side], want = entryFor(side, s, rec.tax, rec.serial, rec.hash), same = !!e && e.serial === rec.serial && e.hash === rec.hash && JSON.stringify(e.lines) === JSON.stringify(want.lines);
      checks.push({ k:(side === 'buyer' ? '구매자' : '판매자') + ' 장부 항목이 전표와 같음', ok:same });
    });
    return { ok:checks.every(function (c) { return c.ok; }), checks:checks };
  }).catch(function () { return { ok:false, checks:[{ k:'확인', ok:false }] }; });
}

// ── 화면 ──
var M = null, LS = {};
var MKEY = 'navi-market-v2';
var S = { rec:[], inbox:[], err:'', trc:null, tam:null, clr:false, busy:false };
function load() {
  try {
    var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v || !Array.isArray(v.rec)) return;
    S.rec = v.rec.filter(function (r) { return r && typeof r.serial === 'string' && r.slip && r.pubs && r.buyer && r.seller && Array.isArray(r.hops); }).slice(0, MAXR);
    S.inbox = (Array.isArray(v.inbox) ? v.inbox : []).filter(function (x) { return x && typeof x.n === 'string' && x.f; }).slice(0, 20);
  } catch (e) { /* 저장값이 깨졌으면 비운 채 시작 */ }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ rec:S.rec, inbox:S.inbox })); } catch (e) { /* 저장 불가여도 화면은 쓴다 */ } }
/** 시장 화면이 이 브라우저에 남긴 거래 장부에서, 아직 세무 회계로 처리하지 않은 거래를 전표로 읽어 온다(읽기만 한다). */
function marketSlips() {
  var out = [];
  try {
    var v = JSON.parse(localStorage.getItem(MKEY) || 'null'), L = v && Array.isArray(v.ledger) ? v.ledger : [];
    L.forEach(function (x) { var t = x && x.kind === 'trade' && x.body && x.body.terms; if (!t || !t.n) return;
      out.push({ n:'mk:' + clean(t.n, 30), src:'시장 화면의 구매', f:{ buyer:t.buyer, seller:t.seller, when:t.d, where:'나비웹 시장 인프라', what:t.item, qty:String(t.qty), price:String(t.price), how:'GDC 결제', why:'시장에서 구매' } }); });
  } catch (e) { /* 시장 기록을 못 읽으면 없는 것으로 본다 */ }
  return out;
}
function pending() {
  var done = {}; S.rec.forEach(function (r) { if (r.src) done[r.src] = 1; });
  return marketSlips().concat(S.inbox).filter(function (x) { return !done[x.n]; });
}
function ledgerCard(e, title, id) {
  return h('div', { class:'card', id:id, style:'padding:0' }, [h('div', { style:'padding:12px 16px' }, [h('b', { text:title + ' — ' + e.owner }), h('div', { class:'sub', text:'일련번호 ' + e.serial })]),
    h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['계정', '차변', '대변'].map(function (t) { return h('th', { text:t }); }))]),
      h('tbody', {}, e.lines.map(function (l) { return h('tr', {}, [h('td', { text:l[0] }), h('td', { text:l[1] ? won(l[1]) : '' }), h('td', { text:l[2] ? won(l[2]) : '' })]); }))])])]);
}
function slipLine(f) { var s = snum(f.qty) * snum(f.price); return f.when + ' · ' + f.seller + ' → ' + f.buyer + ' · ' + f.what + ' ' + f.qty + '개 × ' + won(snum(f.price)) + '원 = ' + won(s) + '원'; }
// ── 재무제표(대차대조표·손익계산서) 갱신과 갱신 이력: 전표 한 건마다 갱신일시와 일련번호를 부기한다 ──
// 시작 장부는 체험용 가상 초안이다. 구매자 '나'는 개인사업자, 그 밖의 판매자는 작은 가게로 가정한다. 매출원가는 반영하지 않는다.
// 장부 계산 규칙은 공통 장부(ledger-book.js)에 있다 — 은행·증권 화면과 같은 값을 보장하기 위해서다.
var NL = window.NaviLedger, ASSETS = NL.ASSETS, LIABS = NL.LIABS, EQUITY = NL.EQUITY;
var WHY = { 'buyer|상품(재고자산)':'구매한 상품을 재고로 반영(공급가액)', 'buyer|부가세대급금':'국세청이 정한 부가세를 매입세액으로 반영', 'buyer|현금(GDC)':'구매대금과 부가세를 GDC로 지급',
'seller|현금(GDC)':'판매대금과 부가세를 GDC로 수령', 'seller|매출':'재화 공급에 따른 매출 인식', 'seller|부가세예수금':'국세청이 정한 부가세 납부 의무 계상' };
/** 은행 화면이 읽은 GDC 잔액이 있으면 "나"의 현금 계정이 그 잔고로 끝나도록 시작 현금을 맞춘다(없으면 가상 초안 값). */
function bookOf(owner, rs) { var w = owner === '나' ? NL.wallet() : null; return NL.bookOf(owner, rs, w ? { cashEnd:w.bal, all:S.rec } : null); }
function sgn(n) { return n === 0 ? '' : (n > 0 ? '+' : '−') + won(Math.abs(n)); }
function thr(a) { return h('thead', {}, [h('tr', {}, a.map(function (t) { return h('th', { text:t }); }))]); }
/** 손익계산서 줄: 매출, 매출원가(구매 이력에서 파생), 매출총이익(원가를 모두 알 때만). 바뀐 줄은 강조한다. */
function isRows(s0, s1, c0, c1, mark) {
  var hl = function (x, y) { return x !== y ? 'background:rgba(30,138,90,.12)' : null; };
  function tr(label, x, y, m) { return h('tr', { style:hl(x, y) }, [h('td', { text:label }), h('td', { text:won(x) }), h('td', { text:sgn(y - x) }), h('td', { text:won(y) }), h('td', { class:'sub', text:x !== y ? m : '' })]); }
  var rows = [tr('매출', s0, s1, mark)];
  if (c0 || c1) { rows.push(tr('매출원가', c0, c1, mark)); rows.push(tr('매출총이익(원가를 아는 범위)', s0 - c0, s1 - c1, mark)); }
  return rows;
}
function stmtCard(owner, role, id) {
var mine = S.rec.slice().reverse().filter(function (r) { return r.buyer.owner === owner || r.seller.owner === owner; }), last = mine[mine.length - 1];
if (!last) return null;
var bf = bookOf(owner, mine.slice(0, -1)), af = bookOf(owner, mine), mark = (last.at || '갱신일시 기록 없음') + ' · ' + last.serial;
function row(a) {
var x = bf[a] || 0, y = af[a] || 0, d = y - x; if (!x && !y) return null;
return h('tr', { style:d ? 'background:rgba(30,138,90,.12)' : null }, [h('td', { text:a }), h('td', { text:won(x) }), h('td', { text:sgn(d) }), h('td', { text:won(y) }), h('td', { class:'sub', text:d ? mark : '' })]);
}
function tot(label, list) {
var x = 0, y = 0; list.forEach(function (a) { x += bf[a] || 0; y += af[a] || 0; });
return { x:x, y:y, tr:h('tr', {}, [h('td', {}, [h('b', { text:label })]), h('td', { text:won(x) }), h('td', { text:sgn(y - x) }), h('td', { text:won(y) }), h('td', {})]) };
}
var A = tot('자산 합계', ASSETS), L = tot('부채 합계', LIABS), E = tot('자본 합계', EQUITY), rows = [];
[['자산', ASSETS, A], ['부채', LIABS, L], ['자본', EQUITY, E]].forEach(function (g) {
rows.push(h('tr', {}, [h('td', { colspan:'5', class:'sub', text:g[0] })]));
g[1].forEach(function (a) { rows.push(row(a)); }); rows.push(g[2].tr);
});
var s0 = bf['매출'] || 0, s1 = af['매출'] || 0, c0 = bf['매출원가'] || 0, c1 = af['매출원가'] || 0, ok = A.y === L.y + E.y, pi = NL.profitInfo(owner, mine);
var costNote = pi.known ? '매출원가는 같은 품목을 산 이력(장부)에서 파생했어요.' + (owner === '나' ? (pi.opex > 0 ? ' 판매비와관리비 ' + won(pi.opex) + '원(내가 적은 기록)을 뺀 영업이익은 ' + won(pi.op) + '원, 참고용 예상 소득세(지방소득세 포함)는 ' + won(pi.tax.total) + '원이에요(공제·감면 미반영, 징수 아님).' : ' 아래에서 판매비·관리비를 적으면 영업이익과 참고용 예상 소득세가 나와요.') : ' 상대방의 판매비·관리비·세금은 알 수 없어 반영하지 않아요.') : (pi.sales > 0 ? '매출원가는 장부의 매입 이력이 있는 판매만 계산해요. 이 장부에는 원가를 알 수 없는 매출(가상 초안의 기존 매출, 산 이력이 없는 판매)이 ' + won(pi.uncovered) + '원 있어 원가 미확인이에요.' : '아직 매출이 없어요.');
return h('div', { class:'card', id:id, style:'padding:0' }, [
h('div', { style:'padding:12px 16px' }, [h('b', { text:role + ' ' + owner + ' — 재무제표 갱신' }), h('div', { class:'sub', text:'체험용 가상 초안에서 시작 · 일련번호 ' + last.serial + ' · ' + (last.at || '갱신일시 기록 없음') })]),
h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [thr(['대차대조표', '전', '증감', '후', '부기(갱신일시 · 일련번호)']), h('tbody', {}, rows)])]),
h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [thr(['손익계산서(11월 누계)', '전', '증감', '후', '부기(갱신일시 · 일련번호)']),
h('tbody', {}, isRows(s0, s1, c0, c1, mark))])]),
h('div', { class:'sub', style:'padding:8px 16px 12px', text:'자산 ' + won(A.y) + ' = 부채 ' + won(L.y) + ' + 자본 ' + won(E.y) + (ok ? ' — 대차가 맞아요' : ' — 대차가 맞지 않아요') + ' · ' + costNote })]);
}
function stmtsView(r) { return h('div', { class:'g2', style:'margin-top:12px', id:'tx-stmts' }, [stmtCard(r.buyer.owner, '구매자', 'tx-stmt-b'), stmtCard(r.seller.owner, '판매자', 'tx-stmt-s')]); }
/** 갱신 이력: 언제(갱신일시)·무엇이(일련번호·계정)·왜(사유)·어떻게(차변·대변, 전표 해시) 바뀌었는지 한 줄씩 남는다. */
function histCard() {
var rows = [];
S.rec.slice().reverse().forEach(function (r) { [r.seller, r.buyer].forEach(function (e) { e.lines.forEach(function (l) {
rows.push(h('tr', {}, [h('td', { text:r.at || '-' }), h('td', { text:r.serial }), h('td', { text:e.owner }), h('td', { text:l[0] }), h('td', { text:l[1] ? '차변 ' + won(l[1]) : '대변 ' + won(l[2]) }), h('td', { text:WHY[e.side + '|' + l[0]] || '장부 반영' }), h('td', { text:r.hash ? r.hash.slice(0, 8) : '' })]));
}); }); });
rows.reverse();
return h('div', { class:'card', id:'tx-hist', style:'padding:0;margin-top:12px' }, [h('div', { style:'padding:12px 16px' }, [h('b', { text:'갱신 이력 — 언제·왜·어떻게 바뀌었는지' }), h('div', { class:'sub', text:'장부가 바뀔 때마다 갱신일시와 일련번호가 한 줄씩 남아요. 장부 항목을 몰래 고치면 아래 "일련번호로 확인"에서 전표와 맞지 않아 드러나요.' })]),
h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [thr(['갱신일시', '일련번호', '장부 주인', '계정', '차변·대변', '사유', '전표 해시']), h('tbody', {}, rows.slice(0, 36))])])]);
}
var HT = [['vat', '부가가치세 신고 내역', '홈택스에서 부가가치세 신고 내역(신고서 조회)'], ['inv', '전자세금계산서 목록', '홈택스에서 전자세금계산서 매입·매출 목록'], ['biz', '사업자 현황', '홈택스에서 사업자등록 상태와 신고 현황']];
/** 홈택스 조회를 도우미에 맡길 일로 호스트에 넘긴다. 호스트는 NaviTax.agentResult(ok, msg) 로 결과를 돌려준다. */
function handOff() {
  var it = HT.filter(function (x) { return x[0] === S.ht; })[0] || HT[0];
  S.htMsg = '도우미에 맡기는 중…'; render();
  if (!(LS.agent && LS.agent.length)) return agentResult(false, '나비웹 도우미를 쓸 수 없는 화면이에요.');
  emit('agent', { kind:it[0], label:it[1], goal:it[2] });
}
function agentResult(ok, msg) { S.htMsg = clean(msg, 160) || (ok ? '도우미가 시작합니다.' : '도우미에 맡기지 못했어요.'); render(); }
function agentCard() {
  var s = h('select', { id:'tx-ht', 'aria-label':'홈택스에서 가져올 것' }, HT.map(function (x) { return h('option', { value:x[0], text:x[1] }); })); s.value = S.ht || 'vat'; s.onchange = function () { S.ht = s.value; };
  return h('div', { class:'card col', id:'tx-agent', style:'margin-top:12px' }, [h('b', { text:'홈택스에서 가져오기 (나비웹 도우미)' }),
    h('div', { class:'sub', text:'고른 조회 화면을 도우미가 홈택스에서 열어 줍니다. 로그인·인증서는 내가 하고, 조회와 내려받기까지만 해요. 신고서 제출과 납부는 하지 않아요. 내려받은 파일은 내 컴퓨터에 저장되며 이 장부에는 자동으로 들어가지 않아요.' }),
    h('div', { class:'rowf' }, [s, btn('도우미로 열기', '', handOff, 'tx-ht-go')]),
    S.htMsg ? note(S.htMsg, false, 'tx-ht-msg') : null]);
}
function viewMain() {
  var kids = [], P = pending();
  kids.push(h('h2', { text:'세무 회계 — 시장에서 받은 전표를 세액 결정과 장부 반영까지' }));
  var box = [h('b', { text:'받은 거래 전표' + (P.length ? ' ' + P.length + '건' : '') })];
  box.push(h('div', { class:'rowf', style:'margin-top:12px' }, [(function () { var b = btn('거래 전표 받기', '', addSample, 'tx-sample'); if (P.some(function (x) { return /^ex:/.test(x.n); }) || (S.rec.length && S.stage != null && S.stage < 3)) b.disabled = true; return b; })()]));
  if (!P.length && (S.rec.length && S.stage != null && S.stage < 3)) { var q = S.rec[0]; box.push(h('div', { id:'tx-sent', style:'margin-top:12px' }, [h('div', { text:slipLine(q.slip) }), h('div', { class:'sub', text:'시장 인프라 디지털 서명 ✓ ' + String(q.sigI).slice(0, 28) + '…' }), h('div', { class:'sub', text:'국세청 AI에 보냈어요 ✓' })])); }
  else if (!P.length) box.push(h('div', { class:'sub', id:'tx-empty', text:'아직 받은 전표가 없어요. 시장 화면에서 구매를 마치면 전표가 여기에 도착해요.' }));
  P.forEach(function (x, i) {
    var pr = PRE[x.n];   // 전표를 받으면 시장 인프라 서명을 미리 만들어 둔다(국세청 서명·세액은 보내기 뒤에 보인다)
    if (!pr || pr.seq !== S.rec.length) { pr = PRE[x.n] = { seq:S.rec.length, res:null }; (function (p, xx) { run(xx.f, p.seq).then(function (res) { p.res = res; render(); }); })(pr, x); }
    var sg = !pr.res ? '시장 인프라 디지털 서명을 만드는 중…' : (pr.res.ok ? '시장 인프라 디지털 서명 ✓ ' + String(pr.res.rec.sigI).slice(0, 28) + '…' : pr.res.msg);
    box.push(h('div', { style:'margin-top:16px' }, [h('div', { text:slipLine(x.f) }), h('div', { class:'sub', text:'출처: ' + x.src }), h('div', { class:'sub', id:'tx-infra-sig-' + i, text:sg }), h('div', { class:'rowf', style:'margin-top:10px' }, [btn('국세청 AI에 보내기', 'fill', function () { send(x); }, 'tx-send-' + i)])]));
  });
  kids.push(h('div', { class:'card col', style:'margin-top:12px' }, box));
  kids.push(agentCard());
  if (S.err) kids.push(note(S.err, true, 'tx-err'));
  var r = S.rec[0]; if (r) kids = kids.concat(viewResult(r));
  if (S.rec.length && (S.stage == null || S.stage >= 3)) kids.push(ownBooks());   // 이력 기록 뒤에 내 장부 합계를 보여 준다
  if (S.rec.length) kids = kids.concat(viewTail());
  return kids;
}
function addSample() {
  if (pending().some(function (x) { return /^ex:/.test(x.n); })) return;   // 처리하지 않은 예시 전표가 있으면 같은 전표를 또 받지 않는다
  var n = 'ex:' + Date.now().toString(36);
  S.inbox.unshift({ n:n, src:'예시 전표(체험)', f:{ buyer:'나', seller:'철수상회', when:kst(), where:'나비웹 시장 인프라', what:'무선 청소기', qty:'2', price:'90000', how:'GDC 결제', why:'예시 전표' } });
  S.inbox = S.inbox.slice(0, 20); save(); render();
}
/** 내 장부 합계: 구매자 이름이 '나'인 장부 항목을 계정별로 모은다(내 재무제표의 바탕). */
function ownBooks() {
  var acc = {}, order = [], n = 0, vat = 0;
  S.rec.forEach(function (r) { [r.buyer, r.seller].forEach(function (e) { if (e.owner !== '나') return; n++; e.lines.forEach(function (l) { if (!acc[l[0]]) { acc[l[0]] = [0, 0]; order.push(l[0]); } acc[l[0]][0] += l[1]; acc[l[0]][1] += l[2]; if (l[0] === '부가세대급금') vat += l[1]; }); }); });
  if (!n) return h('div', { id:'tx-books', class:'sub', style:'margin-top:12px', text:'내 이름("나")으로 된 장부 항목이 아직 없어요.' });
  var d = 0, c = 0; order.forEach(function (k) { d += acc[k][0]; c += acc[k][1]; });
  return h('div', { class:'card', id:'tx-books', style:'padding:0;margin-top:12px' }, [h('div', { style:'padding:12px 16px' }, [h('b', { text:'내 장부 합계 (' + n + '건)' }), h('div', { class:'sub', text:'매입 부가세(부가세대급금) 합계 ' + won(vat) + '원 · 차변 ' + won(d) + ' / 대변 ' + won(c) + (d === c ? ' — 대차가 맞아요' : ' — 대차가 맞지 않아요') })]),
    h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['계정', '차변', '대변'].map(function (x) { return h('th', { text:x }); }))]), h('tbody', {}, order.map(function (k) { return h('tr', {}, [h('td', { text:k }), h('td', { text:acc[k][0] ? won(acc[k][0]) : '' }), h('td', { text:acc[k][1] ? won(acc[k][1]) : '' })]); }))])])]);
}
function viewResult(r) {
  var k = [];
  var st = (S.stage == null) ? 3 : S.stage;
  function stepCard(txt, label, id, next) { return h('div', { class:'card', style:'margin-top:12px', id:id + '-card' }, [h('div', { class:'sub', text:txt }), h('div', { class:'rowf', style:'margin-top:8px' }, [btn(label, 'fill', function () { S.stage = next; render(); }, id)])]); }
  function slipCard() {
    var s = r.slip;
    function tr(a, b) { return h('tr', {}, [h('td', { text:a }), h('td', { class:'r', text:b })]); }
    return h('div', { class:'card', style:'margin-top:24px', id:'tx-signed' }, [h('b', { text:'국세청이 세액을 더한 거래 전표 — ' + r.serial }),
      h('table', { class:'tbl', style:'margin-top:8px' }, [h('tbody', {}, [tr('일련번호', r.serial), tr('공급가액', won(s.supply) + '원'), tr('부가세(10%, 국세청이 정함)', won(r.tax) + '원'), tr('합계', won(s.supply + r.tax) + '원'), tr('국세청 서명', String(r.sigN).slice(0, 28) + '…')])])]);
  }
  k.push(slipCard());
  if (st < 1) k.push(stepCard('다음 단계는 국세청이 거래 당사자에게 서명된 거래 전표를 보냅니다.', '보내기', 'tx-step1', 1));
  else {
    k.push(h('ol', { class:'tx-tl', id:'tx-hops' }, r.hops.map(function (x) { return h('li', {}, [h('b', { text:x.who + ' → ' + x.to }), h('div', { text:x.text })]); })));
    k.push(h('div', { class:'g2', id:'tx-slips', style:'margin-top:12px' }, [ledgerCard(r.buyer, '구매자 장부', 'tx-led-b'), ledgerCard(r.seller, '판매자 장부', 'tx-led-s')]));
    if (st < 2) k.push(stepCard('전표를 거래 당사자의 회계사 AI에게 보냅니다.', '보내기', 'tx-step2', 2));
    else { k.push(stmtsView(r)); if (st < 3) k.push(stepCard('거래 이력을 기록합니다.', '이력 기록', 'tx-step3', 3)); else k.push(histCard()); }
  }
  var out = h('div', { id:'tx-trace', style:'margin-top:12px' });
  if (S.trc) out.appendChild(traceView(S.trc));
  var tam = h('div', { id:'tx-tam', style:'margin-top:12px' }); if (S.tam) tam.appendChild(S.tam);
  if (st >= 3) k.push(h('div', { class:'card', style:'margin-top:12px' }, [h('b', { text:'진실성 확인 — 일련번호로 거슬러 올라가기' }), h('div', { class:'sub', text:'장부의 항목은 일련번호로 전표를 찾아가 서명·해시·금액을 다시 확인할 수 있어요.' }),
    h('div', { class:'rowf', style:'margin-top:8px' }, [btn('일련번호로 확인', 'fill', doTrace, 'tx-trace-btn'), btn('장부를 몰래 고친다면?', '', doTamper, 'tx-tam-btn')]), out, tam]));
  return k;
}
/** 화면 맨 아래: 이전 거래 요약과 체험 기록 지우기(장부 합계 다음에 둔다). */
function expCard() {
  var L = NL; if (!L) return null; var items = L.expLoad(), tot = L.expTotal();
  var f = S.exp, sel = h('select', { id:'tx-e-cat', 'aria-label':'분류', onchange:function () { f.cat = this.value; } }, L.EXP_CATS.map(function (c) { var o = h('option', { value:c, text:c }); if (c === f.cat) o.selected = true; return o; }));
  var amt = h('input', { id:'tx-e-amt', type:'text', inputmode:'numeric', placeholder:'금액(원)', value:f.amt, 'aria-label':'금액', oninput:function () { f.amt = this.value; } }), memo = h('input', { id:'tx-e-memo', type:'text', maxlength:'40', placeholder:'메모(선택)', value:f.memo, 'aria-label':'메모', oninput:function () { f.memo = this.value; } });
  return h('div', { class:'card col', id:'tx-exp', style:'margin-top:12px' }, [h('b', { text:'판매비·관리비 적기' }), h('div', { class:'sub', text:'임차료·급여처럼 거래 전표가 없는 비용을 적어요. 시장이 서명한 전표가 아니라 내가 적는 기록이라 그렇게 표시되고, 적은 뒤에는 고칠 수 없어요(추가만 가능). 은행 잔고에는 이미 반영된 지급으로 봅니다.' }), h('div', { class:'rowf' }, [sel, amt, memo, btn('적기', 'fill', function () { var r = L.expAdd(f.cat, String(f.amt).replace(/,/g, ''), f.memo); S.expMsg = r.ok ? { t:r.item.id + ' ' + r.item.cat + ' ' + won(r.item.amt) + '원을 적었어요.' } : { t:r.msg, bad:true }; if (r.ok) { f.amt = ''; f.memo = ''; } render(); }, 'tx-e-add')]),
    S.expMsg ? h('div', { class:S.expMsg.bad ? 'note' : 'note info', role:S.expMsg.bad ? 'alert' : 'status', id:'tx-e-msg', text:S.expMsg.t }) : null,
    items.length ? h('div', {}, [h('div', { class:'sub', text:'합계 ' + won(tot) + '원 · 최근 ' + Math.min(items.length, 5) + '건 (내가 적은 기록)' })].concat(items.slice(0, 5).map(function (x) { return h('div', { class:'kv' }, [h('span', { text:x.id + ' ' + x.at + ' ' + x.cat + (x.memo ? ' · ' + x.memo : '') }), h('b', { class:'num', text:won(x.amt) + '원' })]); }))) : h('div', { class:'sub', text:'아직 적은 비용이 없어요.' })]);
}
function viewTail() {
  var k = []; var ec = expCard(); if (ec) k.push(ec);
  if (S.rec.length > 1) k.push(h('div', { class:'sub', style:'margin-top:12px', text:'이전 거래 ' + (S.rec.length - 1) + '건: ' + S.rec.slice(1, 6).map(function (x) { return x.serial + ' ' + x.slip.what; }).join(' · ') }));
  k.push(h('div', { class:'rowf', style:'margin-top:12px' }, [btn(S.clr ? '정말 지울까요? 한 번 더 누르면 지워요' : '체험 기록 지우기', '', function () { if (!S.clr) { S.clr = true; render(); return; } S.rec = []; S.inbox = S.inbox.filter(function (y) { return !/^ex:/.test(y.n); }); S.stage = null; S.trc = null; S.tam = null; S.clr = false; if (NL) NL.expClear(); S.expMsg = null; save(); render(); }, 'tx-clear')]));
  return k;
}
function traceView(t) {
  return h('div', { class:t.ok ? 'note info' : 'note', role:t.ok ? 'status' : 'alert', id:'tx-trace-ok' }, [h('b', { text:t.ok ? '모두 맞아요 — 이 일련번호의 전표와 두 장부 항목은 서명과 해시로 입증돼요.' : '맞지 않는 곳이 있어요.' }),
    h('ul', {}, t.checks.map(function (c) { return h('li', { text:(c.ok ? '✓ ' : '⚠ ') + c.k }); }))]);
}
var PRE = {};   // 받은 전표별로 미리 만든 서명 결과(저장하지 않는다)
function send(x) {
  if (S.busy) return; S.busy = true; S.err = ''; S.trc = null; S.tam = null;
  (function () { var pr = PRE[x.n]; return (pr && pr.res && pr.seq === S.rec.length) ? Promise.resolve(pr.res) : run(x.f, S.rec.length); })().then(function (res) {
    S.busy = false;
    if (!res.ok) { S.err = res.msg; render(); return; }
    res.rec.src = x.n; res.rec.at = nowKst(); S.rec.unshift(res.rec); S.stage = 0; S.rec = S.rec.slice(0, MAXR); S.inbox = S.inbox.filter(function (y) { return y.n !== x.n; }); save(); render(); try { M.scrollIntoView({ block:'start' }); } catch (e) { /* 스크롤 불가 */ }
  });
}
function doTrace() { var r = S.rec[0]; if (!r) return; if (window.NaviHist) NaviHist.push('tax', 'trace'); trace(r).then(function (t) { S.trc = t; S.tam = null; render(); }); }
function doTamper() {
  var r = S.rec[0]; if (!r) return; if (window.NaviHist) NaviHist.push('tax', 'tamper'); var copy = JSON.parse(JSON.stringify(r)); copy.buyer.lines[0][1] = Number(copy.buyer.lines[0][1]) + 1;
  trace(copy).then(function (t) {
    var bad = t.checks.filter(function (c) { return !c.ok; }).map(function (c) { return c.k; });
    S.trc = null; S.tam = note('구매자 장부의 첫 항목 금액을 몰래 1원 올렸다고 가정해 다시 확인해 봤어요(실제 장부는 그대로예요). ' + (bad.length ? '→ "' + bad.join(', ') + '"에서 바로 드러나요.' : '그대로 통과했어요.'), bad.length === 0, 'tx-tam-out'); render();
  });
}
function render() {
  var root = $('tx-root'), tp = $('tx-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top';
  tp.appendChild(h('div', { class:'topin' }, [h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 세무 회계' })]), h('button', { type:'button', class:'btn quiet simbtn', id:'tax-sim', text:'시뮬레이션', 'aria-label':'가상 데이터로 시뮬레이션', onclick:function () { if (window._simOpen) window._simOpen('tax', 'slip'); } })])]));
  viewMain().forEach(function (k) { if (k) root.appendChild(k); });
}
function nav(a) {
  var d = a && typeof a['do'] === 'string' ? a['do'] : '';
  if (d === 'reset') { S.err = ''; S.trc = null; S.tam = null; render(); return emit('result', { ok:true, msg:'처음 화면으로 돌아왔습니다.', view:'main' }); }
  emit('result', { ok:false, msg:'지원하지 않는 요청입니다.', view:'main' });
}
function mount(el) {
  if (!el) return; M = el; el.textContent = ''; el.classList.add('tx'); S.exp = { cat:'임차료', amt:'', memo:'' }; S.expMsg = null; S.rec = []; S.inbox = []; S.err = ''; S.trc = null; S.tam = null; load();
  [h('div', { id:'tx-top' }), h('div', { class:'wrap', id:'tx-root' })].forEach(function (x) { el.appendChild(x); }); render();
}
if (window.NaviHist) NaviHist.on('tax', 'tax', function (sub) { if (!M) return; S.trc = null; S.tam = null; if (sub === 'trace') doTrace(); else if (sub === 'tamper') doTamper(); else render(); });   // 뒤로 가면 확인 결과를 닫고, 앞으로 가면 다시 보인다
window.NaviTax = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function () { if (M) render(); },
  agentResult:function (ok, msg) { if (M) agentResult(!!ok, msg); },
  flow:{ check:checkSlip, canon:canon, vat10:vat10, entry:entryFor, run:run, trace:trace },
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
