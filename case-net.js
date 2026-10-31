/* ═════════════════════════════════════════════════
   case-net.js — 기기 쪽 접착제(S5): 키 등록·교환(TOFU) → 이벤트 봉인 전송 → 우편함 수신·복호화·반영
   2026-11-01. UI 는 이 모듈의 함수만 부르면 된다. 네트워크 호출은 주입된 call(route, body) 로만 한다.
     call('/case/mailbox/push', {...}) → { status, json }   (guid·ts·인증은 call 쪽이 붙인다)
   의존: case-core, case-sync, case-seal, case-store(CaseStore 인스턴스)
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  function CaseNet(o) {
    var store = o.store, box = o.box, identity = o.identity, call = o.call, guid = o.guid;
    var Seal = function () { return root.CaseSeal; }, C = function () { return root.CaseCore; };
    var PERMANENT = ['DECRYPT_FAILED', 'BAD_CIPHERTEXT', 'HASH_MISMATCH'];

    async function registerKeys() {
      var rec = await Seal().bindBoxKey(identity, box.pub);
      return call('/case/key/register', { record: rec });
    }

    // 상대 키를 구해 검증하고, 일(case)에 처음 저장한다(TOFU). 이미 저장된 키와 다르면 거부(KEY_CHANGED).
    async function peerKeys(case_id, peer) {
      var cs = await store.getCase(case_id);
      if (!cs) return { ok: false, code: 'NO_CASE' };
      if (cs.peer_keys && cs.peer_keys.record) {
        var kr = cs.peer_keys.record, fresh = await call('/case/key/get', { peer: peer });
        if (fresh.status === 200 && fresh.json.record && fresh.json.record.sign_pub !== kr.sign_pub) return { ok: false, code: 'KEY_CHANGED' };
        return { ok: true, record: kr };
      }
      var r = await call('/case/key/get', { peer: peer });
      if (r.status !== 200) return { ok: false, code: r.json && r.json.code || 'KEY_GET_FAILED' };
      if (!(await Seal().verifyBoxKey(r.json.record))) return { ok: false, code: 'BAD_KEY_SIGNATURE' };
      await store.patchCase(case_id, { peer_keys: { peer: peer, record: r.json.record, first_seen: new Date().toISOString() } });
      return { ok: true, record: r.json.record, first_seen: true };
    }
    // 키 지문(화면에서 상대와 전화·대면으로 대조): 서명키 앞부분
    function fingerprint(pub) { return String(pub).replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase().replace(/(.{4})/g, '$1 ').trim(); }

    // 이벤트들을 상대 우편함으로. 하나라도 실패하면 거기서 멈추고 실패 정보를 돌려준다(호출자가 재시도).
    async function sendEvents(case_id, peer, events) {
      var pk = await peerKeys(case_id, peer); if (!pk.ok) return pk;
      var sent = 0, hash = await C().sha256Hex('case:' + case_id);
      for (var i = 0; i < events.length; i++) {
        var env = await Seal().seal({ from: guid, to: peer, kind: 'history_entry', case_id_hash: hash }, events[i], pk.record.box_pub);
        var r = await call('/case/mailbox/push', { envelope: env });
        if (r.status !== 200) return { ok: false, code: r.json && r.json.code, sent: sent };
        sent++;
      }
      return { ok: true, sent: sent };
    }

    // 초대받은 사람: 가입 직후 호출. 내 키 기록을 함께 보내 초청자 키를 받는다(서버가 둘 사이 우편함 관계를 연다).
    async function claimInvite(token, mail_id) {
      var rec = await Seal().bindBoxKey(identity, box.pub);
      var r = await call('/case/invite/claim', { token: token, mail_id: mail_id, key_record: rec });
      if (r.status !== 200) return { ok: false, code: r.json && r.json.code, message: r.json && r.json.message };
      return { ok: true, inviter: r.json.inviter_user_id, inviter_keys: r.json.inviter_keys || null };
    }

    // 초청자: 가입 알림 뒤 제안 내용(일 제목·종류·내 쪽)을 상대에게 봉인해 보낸다. 상대가 이 기기에 일을 만든다.
    async function sendProposal(case_id, peer, proposal) {
      var pk = await peerKeys(case_id, peer); if (!pk.ok) return pk;
      var p = { type: 'proposal', proposal: { case_id: proposal.case_id, title: proposal.title, kind: proposal.kind, inviter_side: proposal.inviter_side } };
      var env = await Seal().seal({ from: guid, to: peer, kind: 'agreement', case_id_hash: await C().sha256Hex('case:' + case_id) }, p, pk.record.box_pub);
      var r = await call('/case/mailbox/push', { envelope: env });
      return r.status === 200 ? { ok: true } : { ok: false, code: r.json && r.json.code };
    }

    // 내 우편함 수신: 서버 알림은 notices 로, 봉투는 복호화해 해당 일에 반영. 처리된 것은 ack 로 서버에서 지운다.
    // o.onProposal(proposal, env) → { ok, code? } : 아직 모르는 일의 제안(kind 'agreement')을 받았을 때 화면이 일을 만든다.
    async function poll(o) {
      o = o || {};
      var r = await call('/case/mailbox/pull', {});
      if (r.status !== 200) return { ok: false, code: r.json && r.json.code };
      var cases = await store.listCases(), byHash = {};
      for (var i = 0; i < cases.length; i++) byHash[await C().sha256Hex('case:' + cases[i].case_id)] = cases[i];
      var res = { ok: true, applied: 0, notices: [], errors: [] }, ack = [];
      for (var j = 0; j < r.json.items.length; j++) {
        var it = r.json.items[j];
        if (it.server_notice) { res.notices.push(it.server_notice); ack.push(it.id); continue; }
        var env = it.envelope, cs = byHash[env.case_id_hash];
        var op = await Seal().open(env, box);
        if (!op.ok) { res.errors.push({ id: it.id, code: op.code }); if (PERMANENT.indexOf(op.code) >= 0) ack.push(it.id); continue; }
        if (env.kind === 'agreement') {
          var pv = op.value && op.value.type === 'proposal' ? op.value.proposal : null;
          if (!pv || !pv.case_id || await C().sha256Hex('case:' + pv.case_id) !== env.case_id_hash || (pv.inviter_side !== 'provider' && pv.inviter_side !== 'consumer')) { res.errors.push({ id: it.id, code: 'BAD_PROPOSAL' }); ack.push(it.id); continue; }
          if (cs) { ack.push(it.id); continue; }   // 이미 만든 일의 중복 제안
          var pr = o.onProposal ? await o.onProposal(pv, env) : { ok: false, code: 'NO_HANDLER' };
          if (pr && pr.ok) { res.proposals = (res.proposals || 0) + 1; ack.push(it.id); } else res.errors.push({ id: it.id, code: (pr && pr.code) || 'PROPOSAL_FAILED' });
          continue;
        }
        if (!cs) { res.errors.push({ id: it.id, code: 'UNKNOWN_CASE' }); continue; }   // 일이 아직 없으면 남겨 둔다(제안 수락 후 다시 처리)
        var ing = await store.ingestEvent(cs.case_id, op.value);
        if (ing.ok) { res.applied++; ack.push(it.id); }
        else { res.errors.push({ id: it.id, code: ing.code }); if (['BAD_SIGNATURE', 'WRONG_SIDE', 'DUPLICATE'].indexOf(ing.code) >= 0 || ing.duplicate) ack.push(it.id); }
      }
      if (ack.length) await call('/case/mailbox/ack', { ids: ack });
      return res;
    }

    return { registerKeys: registerKeys, peerKeys: peerKeys, fingerprint: fingerprint, sendEvents: sendEvents, claimInvite: claimInvite, sendProposal: sendProposal, poll: poll };
  }
  root.CaseNet = { CaseNet: CaseNet };
})(typeof window !== 'undefined' ? window : globalThis);
