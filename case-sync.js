/* ═════════════════════════════════════════════════
   case-sync.js — 서명된 이벤트: 합의 확인·종료 요청·소통 응답·청구서를 "누가 했는지 증명 가능"하게 한다 (S1)
   2026-11-01. 사고 실험 G1(서명 없음)·G3(투영 검증 불가)·G4(상태 전달 없음)·G5(청구서)·G6(소통 응답)을 해결한다.
   원칙
   - 모든 서명은 기기의 Ed25519 키(WebCrypto). 공개키는 일 단위로 양측이 교환해 case.keys 에 저장한다.
     지갑 키를 쓰려면 identity 객체({pub, sign(msg)})만 같은 모양으로 주입하면 된다.
   - 서명 대상은 항상 도메인 접두사('hondi-case/v1:…')가 붙은 문자열 — 다른 용도의 서명을 재사용할 수 없다.
   - 상대가 한 일은 상대 서명이 있어야만 인정한다. 서명 없는 항목은 도출 함수가 무시한다(fail-closed).
   의존: case-core.js (canonical, sha256Hex)
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var C = function () { return root.CaseCore; };
  var DOMAIN = 'hondi-case/v1:';
  var SIGNED_ENTRY_TYPES = ['agreement_confirm', 'comm_response', 'invoice_issued', 'invoice_settled', 'invoice_void'];
  var enc = new TextEncoder();

  function b64u(bytes) {
    var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64u(str) {
    var b = String(str).replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
    var bin = atob(b), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out;
  }
  function other(side) { return side === 'provider' ? 'consumer' : side === 'consumer' ? 'provider' : null; }

  // ── 키 ────────────────────────────────────────────────
  async function generateIdentity() {
    var kp = await root.crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    var pub = b64u(new Uint8Array(await root.crypto.subtle.exportKey('raw', kp.publicKey)));
    return { pub: pub, sign: async function (msg) { return b64u(new Uint8Array(await root.crypto.subtle.sign({ name: 'Ed25519' }, kp.privateKey, enc.encode(msg)))); }, _kp: kp };
  }
  async function verifySig(pub, msg, sig) {
    try {
      var key = await root.crypto.subtle.importKey('raw', unb64u(pub), { name: 'Ed25519' }, false, ['verify']);
      return await root.crypto.subtle.verify({ name: 'Ed25519' }, key, unb64u(sig), enc.encode(msg));
    } catch (_) { return false; }
  }

  // ── 항목 증명(proof): 기록 항목의 payload 안에 들어가 체인 해시에 묶인다 ─────────────
  function stripProof(payload) { var o = {}; Object.keys(payload || {}).forEach(function (k) { if (k !== 'proof') o[k] = payload[k]; }); return o; }
  function proofMsg(case_id, type, side, body) { return DOMAIN + 'proof:' + C().canonical({ case_id: case_id, type: type, side: side, body: body }); }
  async function signPayload(identity, case_id, type, side, body) {
    var sig = await identity.sign(proofMsg(case_id, type, side, body));
    return Object.assign({}, body, { proof: { pub: identity.pub, sig: sig } });
  }
  // 기록 항목(e)의 proof 가 기대 공개키(expectedPub)의 것인지 확인. type 은 e.type.
  async function verifyEntryProof(e, expectedPub) {
    if (!e || !e.payload || !e.payload.proof || !expectedPub) return false;
    var pr = e.payload.proof;
    if (pr.pub !== expectedPub) return false;
    return verifySig(expectedPub, proofMsg(e.case_id, e.type, e.actor_side, stripProof(e.payload)), pr.sig);
  }

  // ── 도출 함수: 서명 있는 항목만 인정 ────────────────────────
  // keys = { provider: pub, consumer: pub }
  async function deriveConfirmations(history, keys) {
    var out = { provider: false, consumer: false, proposal_hash: null };
    if (!keys) return out;
    var found = { provider: null, consumer: null };
    for (var i = 0; i < history.length; i++) {
      var e = history[i];
      if (e.type !== 'agreement_confirm' || !keys[e.actor_side]) continue;
      if (!(await verifyEntryProof(e, keys[e.actor_side]))) continue;
      if (!found[e.actor_side]) found[e.actor_side] = e.payload.proposal_hash || null;
    }
    // 두 사람이 같은 제안 내용(proposal_hash)에 확인했을 때만 합의로 본다
    if (found.provider && found.provider === found.consumer) { out.provider = out.consumer = true; out.proposal_hash = found.provider; }
    else { out.provider = !!found.provider; out.consumer = !!found.consumer && !found.provider; }  // 서로 다른 제안이면 합의 아님: 한쪽만 인정
    return out;
  }

  // 가장 최근의 유효한 종료 요청자. 종료 요청이 철회(이의·보류)되어 상태가 closing 이 아니면 호출자가 무시한다.
  async function closeRequestedBy(history, keys) {
    for (var i = history.length - 1; i >= 0; i--) {
      var e = history[i];
      if (e.type !== 'state_request_close' || !keys || !keys[e.actor_side]) continue;
      if (await verifyEntryProof(e, keys[e.actor_side])) return e.actor_side;
    }
    return null;
  }

  // 미결제 청구서 수: 제공자가 서명해 발행한 청구서 중, 제공자가 서명해 정산·취소하지 않은 것
  async function unpaidInvoices(history, keys) {
    if (!keys || !keys.provider) return null;                   // 키를 모르면 계산할 수 없다 → 호출자는 종료를 막는다
    var issued = {}, closed = {};
    for (var i = 0; i < history.length; i++) {
      var e = history[i];
      if (['invoice_issued', 'invoice_settled', 'invoice_void'].indexOf(e.type) < 0) continue;
      if (e.actor_side !== 'provider' || !(await verifyEntryProof(e, keys.provider))) continue;
      var id = e.payload && e.payload.invoice_id; if (!id) continue;
      if (e.type === 'invoice_issued') issued[id] = true; else closed[id] = true;
    }
    return Object.keys(issued).filter(function (id) { return !closed[id]; }).length;
  }

  // 수기 소통의 유효 확인 상태: 기록한 쪽의 상대가 서명해 응답한 가장 이른 것(확인/이의)이 있으면 그것, 없으면 원본 값
  async function effectiveConfirmStatus(history, seq, keys) {
    var c = history.filter(function (e) { return e.seq === seq && e.type === 'comm'; })[0];
    if (!c) return null;
    var base = c.payload && c.payload.confirm_status;
    if (base !== 'unconfirmed') return base;
    var counter = other(c.payload.recorder_side);
    for (var i = 0; i < history.length; i++) {
      var e = history[i];
      if (e.type !== 'comm_response' || e.actor_side !== counter || !e.payload || e.payload.target_seq !== seq) continue;
      if (!keys || !keys[counter] || !(await verifyEntryProof(e, keys[counter]))) continue;
      if (e.payload.answer === 'confirmed' || e.payload.answer === 'disputed') return e.payload.answer;
    }
    return base;
  }

  // ── 이벤트(전송 단위): 상대에게 보내는 서명된 메시지 ───────────────
  function eventMsg(ev) { return DOMAIN + 'event:' + C().canonical({ v: ev.v, kind: ev.kind, case_id: ev.case_id, side: ev.side, data: ev.data }); }
  async function buildEvent(identity, o) {
    var ev = { v: 1, kind: o.kind, case_id: o.case_id, side: o.side, pub: identity.pub, data: o.data };
    ev.sig = await identity.sign(eventMsg(ev));
    return ev;
  }
  async function verifyEvent(ev, expectedPub) {
    if (!ev || ev.v !== 1 || !expectedPub || ev.pub !== expectedPub || !ev.sig) return false;
    return verifySig(expectedPub, eventMsg(ev), ev.sig);
  }

  root.CaseSync = {
    SIGNED_ENTRY_TYPES: SIGNED_ENTRY_TYPES, other: other, b64u: b64u,
    generateIdentity: generateIdentity, verifySig: verifySig,
    stripProof: stripProof, signPayload: signPayload, verifyEntryProof: verifyEntryProof,
    deriveConfirmations: deriveConfirmations, closeRequestedBy: closeRequestedBy, unpaidInvoices: unpaidInvoices, effectiveConfirmStatus: effectiveConfirmStatus,
    buildEvent: buildEvent, verifyEvent: verifyEvent,
  };
})(typeof window !== 'undefined' ? window : globalThis);
