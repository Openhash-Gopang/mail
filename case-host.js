/* ═════════════════════════════════════════════════
   case-host.js — K-Mail 화면과 Case 엔진(case-net 등)을 잇는 접착제 (S5 후반, 2026-11-01)
   하는 일
   · 이 기기의 서명 키(Ed25519)·봉인 키(X25519)를 만들어 IndexedDB(hondi_case_keys)에 보관한다(없으면 새로 만든다).
   · 로그인 토큰(KAuth.fetchWithAuth)으로 /case/* 를 호출하는 call() 을 만들고, 내 guid 는 /auth/session-profile 로 얻는다.
   · 내 키를 서버에 등록(1회), 초대 가입 알림(invite_signed_up)으로 상대 키를 받아 일에 기록(TOFU)한다.
   · 로컬에서 만든 서명 이벤트·공유 항목을 일별 대기열(case.outq)에 쌓았다가 상대 우편함으로 보내고, 우편함을 읽어 반영한다.
   · 서버로 가는 것은 암호문과 해시뿐이다. 기록 원본은 이 기기의 PDV 에만 있다.
   설정: window.CASE_HOST_CFG = { proxy: 'https://…', fetch: (url, opts) => Promise<Response>, mailId: async () => '내 메일 아이디', sendMail: async (to, subject, text) => void }  (desktop.html 이 지정)
   의존: case-core, case-sync, case-seal, case-net, case-store
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var KEYDB = 'hondi_case_keys';
  var local = null, netState = null, timer = null, listeners = [];

  function cfg() { return root.CASE_HOST_CFG || {}; }

  // ── 키 보관(IndexedDB, CryptoKey 를 그대로 저장) ─────────────────
  function kdb() {
    return new Promise(function (res, rej) {
      var r = root.indexedDB.open(KEYDB, 1);
      r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains('k')) r.result.createObjectStore('k'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function kget(db, key) { return new Promise(function (res, rej) { var q = db.transaction('k', 'readonly').objectStore('k').get(key); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { rej(q.error); }; }); }
  function kput(db, key, val) { return new Promise(function (res, rej) { var t = db.transaction('k', 'readwrite'); t.objectStore('k').put(val, key); t.oncomplete = function () { res(); }; t.onerror = function () { rej(t.error); }; }); }

  async function identityFromKp(kp, pub) {
    var enc = new TextEncoder();
    return { pub: pub, _kp: kp, sign: async function (msg) { return root.CaseSync.b64u(new Uint8Array(await root.crypto.subtle.sign({ name: 'Ed25519' }, kp.privateKey, enc.encode(msg)))); } };
  }

  // 이 기기의 키를 준비한다(네트워크 불필요). 반환 { identity, box, adapter }
  async function initLocal(adapterOverride) {
    if (local) return local;
    var db = adapterOverride ? null : await kdb(), identity, box, reg = null;
    if (adapterOverride) {   // 테스트·키 보관소 주입
      identity = adapterOverride.identity; box = adapterOverride.box; reg = adapterOverride.reg || null;
    } else {
      var sid = await kget(db, 'identity'), sbox = await kget(db, 'box');
      if (sid) identity = await identityFromKp(sid.kp, sid.pub);
      else { var g = await root.CaseSync.generateIdentity(); await kput(db, 'identity', { kp: g._kp, pub: g.pub }); identity = g; }
      if (sbox) box = sbox;
      else { box = await root.CaseSeal.generateBoxKey(); await kput(db, 'box', { pub: box.pub, _priv: box._priv }); }
      reg = await kget(db, 'reg');
    }
    local = { identity: identity, box: box, db: db, reg: reg };
    root.CASE_UI_CONFIG = Object.assign(root.CASE_UI_CONFIG || {}, { identity: identity });   // case-ui 가 만드는 CaseStore 가 서명에 쓴다
    return local;
  }

  // ── 네트워크 ──────────────────────────────────────────
  async function call(route, body) {
    var c = cfg(); if (!c.fetch || !c.proxy) throw new Error('CASE_HOST_CFG 가 설정되지 않았습니다');
    var res = await c.fetch(c.proxy + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    var json = await res.json().catch(function () { return {}; });
    return { status: res.status, json: json };
  }

  // 내 guid 와 CaseNet. 처음 한 번 내 키를 서버에 등록한다.
  async function net(callOverride, guidOverride) {
    if (netState) return netState;
    var l = await initLocal(), cl = callOverride || call, guid = guidOverride;
    if (!guid) {
      var p = await cl('/auth/session-profile', {});
      if (p.status !== 200 || !p.json.guid) throw new Error('로그인이 필요합니다');
      guid = p.json.guid;
    }
    var store = (root.CaseUI && root.CaseUI._store) ? root.CaseUI._store() : null;
    if (!store) throw new Error('CaseStore 가 준비되지 않았습니다');
    var n = root.CaseNet.CaseNet({ store: store, box: l.box, identity: l.identity, call: cl, guid: guid });
    if (!l.reg || l.reg.guid !== guid || l.reg.sign_pub !== l.identity.pub) {
      var r = await n.registerKeys();
      if (r.status !== 200) throw new Error('키 등록 실패: ' + ((r.json && r.json.code) || r.status));
      l.reg = { guid: guid, sign_pub: l.identity.pub };
      if (l.db) await kput(l.db, 'reg', l.reg);
    }
    netState = { net: n, guid: guid, store: store, call: cl };
    root.CASE_UI_CONFIG = Object.assign(root.CASE_UI_CONFIG || {}, { userId: guid });
    return netState;
  }

  // ── 일 단위 동작 ─────────────────────────────────────────
  var oppo = function (s) { return s === 'provider' ? 'consumer' : s === 'consumer' ? 'provider' : null; };

  // 상대 키가 알려졌으면 일에 두 공개키를 기록한다(합의·종료 서명의 전제).
  async function ensureKeys(case_id) {
    var ns = await net(), cs = await ns.store.getCase(case_id);
    if (!cs || cs.mode !== 'engaged') return { ok: false, code: 'NOT_ENGAGED' };
    if (cs.keys && cs.keys.provider && cs.keys.consumer) return { ok: true, keys: cs.keys };
    if (!cs.peer) return { ok: false, code: 'NO_PEER', error: '상대가 아직 가입하지 않았거나 연결되지 않았습니다' };
    var pk = await ns.net.peerKeys(case_id, cs.peer);
    if (!pk.ok) return pk;
    var keys = {}; keys[cs.my_side] = (await initLocal()).identity.pub; keys[oppo(cs.my_side)] = pk.record.sign_pub;
    var r = await ns.store.setKeys(case_id, keys);
    return r.ok ? { ok: true, keys: keys } : { ok: false, code: 'SET_KEYS_FAILED', error: r.error };
  }

  // 서버 알림 처리: 초대한 사람이 가입했다 → 어느 일인지 찾아 상대 정보를 기록하고 키를 받는다.
  async function onNotice(n) {
    if (!n || n.type !== 'invite_signed_up') return { handled: false };
    var ns = await net(), cases = await ns.store.listCases();
    var cand = cases.filter(function (c) { return c.mode === 'engaged' && c.invitation && c.state === 'proposed' && !c.peer; });
    var hit = n.token_hash ? cand.filter(function (c) { return c.invitation.token_hash === n.token_hash; }) : (cand.length === 1 ? cand : []);
    if (hit.length !== 1) return { handled: false, unmatched: true };
    var c = hit[0];
    await ns.store.patchCase(c.case_id, { peer: n.invitee_user_id, peer_mail: n.invitee_mail_id, peer_email_match: n.email_match == null ? null : !!n.email_match, peer_joined_at: n.signed_up_at });
    var k = await ensureKeys(c.case_id), pr = k.ok ? await sendProposalIfNeeded(c.case_id) : { ok: false };
    return { handled: true, case_id: c.case_id, keys: k, proposal: pr };
  }

  // 초청자: 상대에게 일의 제안(제목·종류·내 쪽)을 한 번 보낸다. 상대 기기가 이 내용으로 일을 만든다. 실패하면 다음 새로 고침 때 다시.
  async function sendProposalIfNeeded(case_id) {
    var ns = await net(), cs = await ns.store.getCase(case_id);
    if (!cs || cs.mode !== 'engaged' || cs.incoming || cs.proposal_sent || !cs.peer) return { ok: true, skipped: true };
    var r = await ns.net.sendProposal(case_id, cs.peer, { case_id: cs.case_id, title: cs.title, kind: cs.kind, inviter_side: cs.my_side });
    if (r.ok) await ns.store.patchCase(case_id, { proposal_sent: true });
    return r;
  }

  // 초대받은 쪽: 모르는 일의 제안이 도착하면 이 기기에 일을 만든다(맡은 쪽/맡긴 쪽은 초청자의 반대편). 아직 합의 전(제안됨) 상태다.
  async function onProposal(pv, env) {
    var ns = await net();
    var r = await ns.store.createCase({ case_id: pv.case_id, title: String(pv.title || '').slice(0, 120), kind: ['case', 'transaction', 'event'].indexOf(pv.kind) >= 0 ? pv.kind : 'case', my_side: oppo(pv.inviter_side) });
    if (!r.ok && !/이미/.test(r.error || '')) return { ok: false, code: 'CREATE_FAILED' };
    await ns.store.patchCase(pv.case_id, { peer: env.from, incoming: true, incoming_at: new Date().toISOString() });
    try { await ensureKeys(pv.case_id); } catch (_) { /* 키는 새로 고침 때 다시 시도 */ }
    return { ok: true };
  }

  // 초대 수락(가입 확인): 내 키를 서버에 등록하고 초청자와 우편함 관계를 연다.
  async function claim(token) {
    var ns = await net(), mid = cfg().mailId ? await cfg().mailId() : '';
    if (!mid) return { ok: false, code: 'NO_MAIL_ID', message: '메일 아이디를 먼저 만들어 주세요(설정)' };
    return ns.net.claimInvite(token, mid);
  }

  // 대기열에 이벤트를 쌓는다(보내기 실패해도 잃지 않도록 일 레코드에 저장).
  async function enqueue(case_id, events) {
    if (!events || !events.length) return;
    var ns = await net(), cs = await ns.store.getCase(case_id);
    await ns.store.patchCase(case_id, { outq: (cs.outq || []).concat(events) });
  }
  // 내가 쓴 공유 항목(메모·소통 기록 등) 중 아직 안 보낸 것을 이벤트로 만들어 쌓는다.
  async function collectShared(case_id) {
    var ns = await net(), cs = await ns.store.getCase(case_id);
    if (!cs || cs.mode !== 'engaged' || !(cs.keys && cs.keys.provider)) return;
    var r = await ns.store.buildShareEvents(case_id, cs.shared_sent_seq || 0);
    var h = await ns.store.history(case_id), head = h.length ? h[h.length - 1].seq : 0;
    if (r.ok && r.events.length) await enqueue(case_id, r.events);
    await ns.store.patchCase(case_id, { shared_sent_seq: head });
  }
  // 대기열을 상대 우편함으로 보낸다. 실패하면 남겨 둔다.
  async function flush(case_id) {
    var ns = await net(), cs = await ns.store.getCase(case_id);
    if (!cs || !cs.peer) return { ok: false, code: 'NO_PEER', sent: 0 };
    var pp = await sendProposalIfNeeded(case_id);
    if (!pp.ok) return { ok: false, code: pp.code, sent: 0 };
    await collectShared(case_id);
    cs = await ns.store.getCase(case_id);
    var q = cs.outq || []; if (!q.length) return { ok: true, sent: 0 };
    var r = await ns.net.sendEvents(case_id, cs.peer, q);
    var sent = r.sent || 0;
    await ns.store.patchCase(case_id, { outq: q.slice(sent) });
    return r.ok ? { ok: true, sent: sent } : { ok: false, code: r.code, sent: sent, left: q.length - sent };
  }
  async function flushAll() {
    var ns = await net(), cases = await ns.store.listCases(), out = { sent: 0, failed: 0 };
    for (var i = 0; i < cases.length; i++) {
      var c = cases[i]; if (c.mode !== 'engaged' || !c.peer) continue;
      var r = await flush(c.case_id); out.sent += r.sent || 0; if (!r.ok && r.code !== 'NO_PEER') out.failed++;
    }
    return out;
  }

  // 우편함 읽기 → 알림 처리 → 대기 중인 내 이벤트 전송. 화면은 반환값으로 상태를 안내한다.
  async function poll() {
    var ns = await net(), r = await ns.net.poll({ onProposal: onProposal });
    if (!r.ok) return { ok: false, code: r.code };
    var joined = [];
    for (var i = 0; i < r.notices.length; i++) { var h = await onNotice(r.notices[i]); if (h.handled) joined.push(h.case_id); }
    var f = await flushAll();
    var out = { ok: true, applied: r.applied, proposals: r.proposals || 0, errors: r.errors, joined: joined, sent: f.sent, failed: f.failed };
    listeners.forEach(function (fn) { try { fn(out); } catch (_) {} });
    return out;
  }
  function onUpdate(fn) { listeners.push(fn); }
  function startAutoPoll(ms) {
    if (timer) return;
    timer = setInterval(function () { if (typeof document !== 'undefined' && document.hidden) return; poll().catch(function () {}); }, ms || 60000);
  }
  function stopAutoPoll() { if (timer) { clearInterval(timer); timer = null; } }

  // 초대를 서버에 등록한다(가입 확인·알림에 필요). 토큰 자체는 보내지 않고 해시만 보낸다.
  async function registerInvite(case_id) {
    var ns = await net(), cs = await ns.store.getCase(case_id);
    if (!cs || !cs.invitation) return { ok: false, code: 'NO_INVITATION' };
    var r = await ns.call('/case/invite/register', { token_hash: cs.invitation.token_hash });
    if (r.status === 200 || (r.json && r.json.code === 'ALREADY_REGISTERED')) { await ns.store.patchCase(case_id, { invite_registered: true }); return { ok: true }; }
    return { ok: false, code: r.json && r.json.code, message: r.json && r.json.message };
  }

  // 초대 메일 보내기: 내 K-Mail 주소로 상대에게 링크를 보낸다. 사건 제목·내용은 메일에 넣지 않는다(메일 서버를 지나므로).
  async function sendInviteMail(case_id) {
    var store = root.CaseUI._store(), cs = await store.getCase(case_id), c = cfg();
    if (!cs || !cs.invitation || !cs.invite_link) return { ok: false, code: 'NO_INVITATION' };
    if (!c.sendMail) return { ok: false, code: 'NO_MAILER' };
    var who = (root.CASE_UI_CONFIG && root.CASE_UI_CONFIG.userName) || '';
    var subject = '[NAVI] 일을 함께 진행하자는 초대가 도착했습니다';
    var text = (who ? who + '님이' : '지인이') + ' NAVI(나비웹)에서 일을 함께 진행하자고 초대했습니다.\n\n' +
      '아래 링크에서 수락하면 가입 사실과 아이디가 초대한 분께 전달되고, 서로의 서명 키를 주고받습니다. 일의 내용은 수락 후에 이 링크를 연 기기에만 나타납니다.\n\n' +
      cs.invite_link + '\n\n링크는 14일간 유효합니다. 모르는 분의 초대라면 이 메일을 무시하세요.';
    try { await c.sendMail(cs.invitation.invitee_email, subject, text); }
    catch (e) { return { ok: false, code: 'SEND_FAILED', message: e.message }; }
    await store.patchCase(case_id, { invite_mail_sent_at: new Date().toISOString() });
    return { ok: true };
  }

  // 화면에서 쓰는 요약: 내 키 지문, 상대 키 지문
  async function keyInfo(case_id) {
    var l = await initLocal(), store = root.CaseUI._store(), cs = await store.getCase(case_id), fp = function (p) { return String(p).replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase().replace(/(.{4})/g, '$1 ').trim(); };
    return { mine: fp(l.identity.pub), peer: cs && cs.peer_keys && cs.peer_keys.record ? fp(cs.peer_keys.record.sign_pub) : null, ready: !!(cs && cs.keys && cs.keys.provider && cs.keys.consumer) };
  }

  function _reset() { local = null; netState = null; stopAutoPoll(); listeners = []; }
  root.CaseHost = { initLocal: initLocal, net: net, call: call, ensureKeys: ensureKeys, onNotice: onNotice, enqueue: enqueue, flush: flush, flushAll: flushAll,
    poll: poll, onUpdate: onUpdate, startAutoPoll: startAutoPoll, stopAutoPoll: stopAutoPoll, registerInvite: registerInvite, sendInviteMail: sendInviteMail, claim: claim, onProposal: onProposal, sendProposalIfNeeded: sendProposalIfNeeded, keyInfo: keyInfo, _reset: _reset };
})(typeof window !== 'undefined' ? window : globalThis);
