/* ═════════════════════════════════════════════════
   case-store.js — M1 Case 저장소(PDV, domain 'work') + 해시 앵커 발송 큐
   2026-11-01. 원칙: 본문은 당사자 기기(IndexedDB)에만, 네트워크(/pdv/report)에는 content_hash만.
   - 저장소 어댑터는 주입: 브라우저는 IdbAdapter, 테스트는 MemoryAdapter. 같은 인터페이스
     { get(store,key), put(store,key,val), list(store,prefix) }.
   - 앵커 발송은 "아웃박스" — 기록은 먼저 로컬에 확정하고, 해시 발송은 나중에 재시도해도 된다
     (오프라인이어도 일은 계속 진행). 발송 성공 시 anchored 표시.
   - 의존: case-core.js (CaseCore). 기존 gopang_pdv_store 와 분리된 DB(hondi_case_store)를 쓴다.
   ⚠ /pdv/report 는 등록된 서비스(svc)만 받는다 — 'case' 서비스 등록은 아직 안 됨(미검증, 서버 PR 필요).
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var C = function () { return root.CaseCore; };
  var STORES = ['cases', 'history', 'comms', 'outbox'];

  function MemoryAdapter() {
    var m = {}; STORES.forEach(function (s) { m[s] = {}; });
    return {
      get: async function (s, k) { var v = m[s][k]; return v === undefined ? null : JSON.parse(JSON.stringify(v)); },
      put: async function (s, k, v) { m[s][k] = JSON.parse(JSON.stringify(v)); },
      del: async function (s, k) { delete m[s][k]; },
      list: async function (s, prefix) {
        return Object.keys(m[s]).filter(function (k) { return k.indexOf(prefix || '') === 0; }).sort()
          .map(function (k) { return JSON.parse(JSON.stringify(m[s][k])); });
      },
    };
  }

  // 브라우저 IndexedDB 어댑터. 키는 문자열, 값은 구조화 복제 가능한 객체.
  function IdbAdapter(dbName) {
    dbName = dbName || 'hondi_case_store';
    var dbp = null;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise(function (res, rej) {
        var r = root.indexedDB.open(dbName, 1);
        r.onupgradeneeded = function () { STORES.forEach(function (s) { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); }); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      });
      return dbp;
    }
    function tx(store, mode, fn) {
      return open().then(function (db) {
        return new Promise(function (res, rej) {
          var t = db.transaction(store, mode), out = fn(t.objectStore(store));
          t.oncomplete = function () { res(out && out.result !== undefined ? out.result : undefined); };
          t.onerror = function () { rej(t.error); };
        });
      });
    }
    return {
      get: function (s, k) { return tx(s, 'readonly', function (o) { return o.get(k); }).then(function (v) { return v === undefined ? null : v; }); },
      put: function (s, k, v) { return tx(s, 'readwrite', function (o) { return o.put(v, k); }).then(function () {}); },
      del: function (s, k) { return tx(s, 'readwrite', function (o) { return o.delete(k); }).then(function () {}); },
      list: function (s, prefix) {
        return tx(s, 'readonly', function (o) { return o.getAll(root.IDBKeyRange.bound(prefix || '', (prefix || '') + '￿')); }).then(function (v) { return v || []; });
      },
    };
  }

  var pad = function (n) { return ('000000' + n).slice(-6); };

  // opts: { who: ipv6, svc: 'case', endpoint: 'https://.../pdv/report', fetch: fn, now: fn }
  function CaseStore(adapter, opts) {
    opts = opts || {};
    var now = opts.now || function () { return new Date().toISOString(); };

    async function saveCase(c) { await adapter.put('cases', c.case_id, Object.assign({ domain: 'work' }, c)); return c; }

    async function createCase(input) {
      var c = input.mode === 'solo'
        ? C().createSolo(input)
        : (input.case_id && input.title ? { ok: true, value: { case_id: input.case_id, title: input.title, kind: input.kind || 'case', mode: 'engaged', state: 'proposed', my_side: input.my_side, owner: input.owner || null } } : { ok: false, error: 'case_id, title 필수' });
      if (!c.ok) return c;
      if (await adapter.get('cases', c.value.case_id)) return { ok: false, error: '이미 있는 case_id' };
      c.value.created_at = now();
      await saveCase(c.value);
      return c;
    }

    // 보조 필드(초대장 등) 갱신. 상태(state)는 여기서 못 바꾼다 — 반드시 applyTransition 으로.
    async function patchCase(id, patch) {
      var c = await adapter.get('cases', id);
      if (!c) return { ok: false, error: '없는 Case' };
      var p = Object.assign({}, patch); delete p.state; delete p.case_id; delete p.mode; delete p.domain;
      await saveCase(Object.assign(c, p));
      return { ok: true, value: c };
    }

    async function getCase(id) { return adapter.get('cases', id); }
    async function listCases() { return adapter.list('cases', ''); }
    async function history(id) { return adapter.list('history', id + '/'); }

    // 기록 추가: 해시체인 계산 → 로컬 저장 → 앵커 아웃박스에 적재. 네트워크는 여기서 호출하지 않는다.
    async function append(case_id, entry) {
      var cs = await getCase(case_id);
      if (!cs) return { ok: false, error: '없는 Case' };
      var h = await history(case_id);
      var e = await C().appendEntry(h, Object.assign({}, entry, { case_id: case_id, at: entry.at || now() }));
      await adapter.put('history', case_id + '/' + pad(e.seq), e);
      var payload = await C().anchorPayloadFor(e);
      var okey = case_id + '/' + pad(e.seq);
      await adapter.put('outbox', okey, { _key: okey, payload: payload, state: 'pending', tries: 0 });
      return { ok: true, entry: e };
    }

    // ── 서명·동기화(S1) — case-sync.js 필요. 나 홀로 일은 서명이 필요 없다(상대가 없음). ─────────────
    var Y = function () { return root.CaseSync; };
    var oppo = function (side) { return side === 'provider' ? 'consumer' : side === 'consumer' ? 'provider' : null; };
    // 맡은 일/맡긴 일의 모든 상태 전이는 서명해서 상대에게 보낸다(보내지 않으면 두 기기의 상태가 어긋나 이후 서명 전이가 STATE_MISMATCH 로 막힌다).
    // expire 는 각자 시계로 판단하는 시스템 전이라 제외, confirm 은 상태가 안 바뀌고 agreement_confirm 항목으로 따로 서명한다.
    var SIGNED_ON_TRANSITION = ['accept', 'decline', 'activate', 'hold', 'resume', 'request_close', 'close_agree', 'close_dispute', 'close_hold', 'archive'];
    var NEED_KEYS = ['accept', 'close_agree', 'close_dispute', 'close_hold'];

    // 두 사람의 공개키를 일에 기록한다. 내 키는 내 identity 와 같아야 한다.
    async function setKeys(case_id, keys) {
      var cs = await getCase(case_id);
      if (!cs || cs.mode !== 'engaged') return { ok: false, error: '맡은 일/맡긴 일만 키를 가짐' };
      if (!keys || !keys.provider || !keys.consumer) return { ok: false, error: 'provider·consumer 공개키 필요' };
      if (cs.keys && (cs.keys.provider !== keys.provider || cs.keys.consumer !== keys.consumer)) return { ok: false, error: '이미 정해진 키는 바꿀 수 없음' };
      if (opts.identity && keys[cs.my_side] !== opts.identity.pub) return { ok: false, error: '내 쪽 공개키가 내 identity 와 다름' };
      return patchCase(case_id, { keys: { provider: keys.provider, consumer: keys.consumer } });
    }

    // 서명이 필요한 항목(합의 확인·소통 응답·청구서)을 내 이름으로 기록하고, 상대에게 보낼 이벤트를 돌려준다.
    async function signedAppend(case_id, o) {
      var cs = await getCase(case_id);
      if (!cs || cs.mode !== 'engaged') return { ok: false, error: '맡은 일/맡긴 일만 가능' };
      if (!opts.identity) return { ok: false, error: 'identity(서명 키) 필요' };
      if (Y().SIGNED_ENTRY_TYPES.indexOf(o.type) < 0) return { ok: false, error: '서명 대상 항목이 아님: ' + o.type };
      if (!cs.keys) return { ok: false, error: '공개키 교환 전' };
      if ((o.type === 'invoice_issued' || o.type === 'invoice_settled' || o.type === 'invoice_void') && cs.my_side !== 'provider') return { ok: false, error: '청구서는 제공자만' };
      var payload = await Y().signPayload(opts.identity, case_id, o.type, cs.my_side, o.body || {});
      var r = await append(case_id, { type: o.type, actor_side: cs.my_side, visibility: 'shared', payload: payload });
      if (!r.ok) return r;
      var ev = await Y().buildEvent(opts.identity, { kind: 'entry', case_id: case_id, side: cs.my_side, data: { type: o.type, payload: payload } });
      return { ok: true, entry: r.entry, event: ev };
    }
    // 제안 내용(proposal)에 확인 서명. proposal_hash 가 같아야 양측 확인이 합의로 인정된다.
    async function confirmAgreement(case_id, proposal) {
      return signedAppend(case_id, { type: 'agreement_confirm', body: { proposal_hash: await C().sha256Hex(C().canonical(proposal)) } });
    }

    // 상태 전이를 기록과 함께 확정한다(가드 통과해야만 저장).
    // 맡은 일/맡긴 일: 내 쪽(my_side)으로만 가능, 합의·종료요청자·미결제 청구서는 서명된 기록에서 직접 도출(호출자 값 무시).
    async function applyTransition(case_id, event, ctx, entry) {
      var cs = await getCase(case_id);
      if (!cs) return { ok: false, error: '없는 Case' };
      ctx = Object.assign({}, ctx);
      if (cs.mode === 'engaged') {
        if (ctx.side && ctx.side !== cs.my_side) return { ok: false, error: 'side 는 내 쪽(' + cs.my_side + ')이어야 함' };
        ctx.side = cs.my_side;
        var d = await _derive(cs, event);
        if (!d.ok) return d;
        Object.assign(ctx, d.ctx);
        if (SIGNED_ON_TRANSITION.indexOf(event) >= 0 && !opts.identity) return { ok: false, error: 'identity(서명 키) 필요' };
      }
      return _commit(cs, event, ctx, entry || {}, false);
    }

    // 서명된 기록에서 전이 가드 입력을 도출한다.
    async function _derive(cs, event) {
      var out = {};
      if (NEED_KEYS.indexOf(event) >= 0 && !(cs.keys && cs.keys.provider && cs.keys.consumer)) return { ok: false, code: 'KEYS_REQUIRED', error: '공개키 교환 전에는 합의·종료를 진행할 수 없음' };
      var h = await history(cs.case_id);
      if (event === 'accept') out.confirmations = await Y().deriveConfirmations(h, cs.keys);
      if (event === 'close_agree' || event === 'close_dispute' || event === 'close_hold') out.closeRequestedBy = await Y().closeRequestedBy(h, cs.keys);
      if (event === 'close_agree') { var n = await Y().unpaidInvoices(h, cs.keys); out.unpaidInvoices = n; }   // null 이면 코어가 막는다
      return { ok: true, ctx: out };
    }

    async function _commit(cs, event, ctx, entry, remote, remotePayload) {
      var t = C().transition(cs.state, event, Object.assign({ mode: cs.mode }, ctx));
      if (!t.ok) return t;
      var body = Object.assign({ from: cs.state, to: t.to }, entry.payload || {});
      var payload = body, signedEvent = null;
      if (cs.mode === 'engaged' && SIGNED_ON_TRANSITION.indexOf(event) >= 0) {
        if (remote) payload = remotePayload;                                       // 상대 서명 payload 를 그대로 보관
        else if (opts.identity) payload = await Y().signPayload(opts.identity, cs.case_id, 'state_' + event, ctx.side, body);
      }
      var r = await append(cs.case_id, Object.assign({ type: 'state_' + event, actor_side: ctx.side, visibility: 'shared' }, entry, { payload: payload }));
      cs.state = t.to; await saveCase(cs);
      if (!remote && cs.mode === 'engaged' && opts.identity && payload.proof) signedEvent = await Y().buildEvent(opts.identity, { kind: 'transition', case_id: cs.case_id, side: ctx.side, data: { event: event, payload: payload } });
      return Object.assign({}, r, { state: t.to, event: signedEvent });
    }

    // 내가 쓴 공유 항목을 상대에게 보낼 이벤트로 만든다(서명된 항목·상태 전이는 각자 이벤트로 이미 나감).
    async function buildShareEvents(case_id, sinceSeq) {
      var cs = await getCase(case_id);
      if (!cs || cs.mode !== 'engaged' || !opts.identity) return { ok: false, error: '맡은 일/맡긴 일 + identity 필요' };
      var h = await history(case_id), out = [];
      var proj = C().projectForConsumer(h);
      for (var i = 0; i < proj.length; i++) {
        var p = proj[i];
        if (p.seq <= (sinceSeq || 0) || p.actor_side !== cs.my_side) continue;
        if (p.type.indexOf('state_') === 0 || Y().SIGNED_ENTRY_TYPES.indexOf(p.type) >= 0 || p.type === 'peer_entry') continue;
        out.push(await Y().buildEvent(opts.identity, { kind: 'shared_entry', case_id: case_id, side: cs.my_side, data: p }));
      }
      return { ok: true, events: out };
    }

    // 상대가 보낸 이벤트를 검증하고 반영한다. 같은 이벤트를 두 번 받아도 한 번만 반영된다.
    async function ingestEvent(case_id, ev) {
      var cs = await getCase(case_id);
      if (!cs || cs.mode !== 'engaged') return { ok: false, code: 'NO_CASE', error: '맡은 일/맡긴 일이 아님' };
      var peer = oppo(cs.my_side);
      if (!ev || ev.case_id !== case_id) return { ok: false, code: 'BAD_EVENT', error: '이벤트 형식/일 불일치' };
      if (ev.side !== peer) return { ok: false, code: 'WRONG_SIDE', error: '상대 쪽 이벤트가 아님' };
      if (!(cs.keys && cs.keys[peer])) return { ok: false, code: 'KEY_UNKNOWN', error: '상대 공개키를 모름' };
      if (!(await Y().verifyEvent(ev, cs.keys[peer]))) return { ok: false, code: 'BAD_SIGNATURE', error: '서명 검증 실패' };
      var seenKey = case_id + '/seen:' + (await C().sha256Hex(ev.sig));
      if (await adapter.get('comms', seenKey)) return { ok: true, duplicate: true };
      var res;
      if (ev.kind === 'entry') {
        var d = ev.data || {};
        if (Y().SIGNED_ENTRY_TYPES.indexOf(d.type) < 0) return { ok: false, code: 'BAD_TYPE', error: '허용되지 않은 항목 종류' };
        if ((d.type.indexOf('invoice_') === 0) && peer !== 'provider') return { ok: false, code: 'BAD_TYPE', error: '청구서는 제공자만' };
        var probe = { case_id: case_id, type: d.type, actor_side: peer, payload: d.payload };
        if (!(await Y().verifyEntryProof(probe, cs.keys[peer]))) return { ok: false, code: 'BAD_PROOF', error: '항목 서명 검증 실패' };
        res = await append(case_id, { type: d.type, actor_side: peer, visibility: 'shared', payload: d.payload });
      } else if (ev.kind === 'transition') {
        var td = ev.data || {}, pl = td.payload || {};
        if (SIGNED_ON_TRANSITION.indexOf(td.event) < 0) return { ok: false, code: 'BAD_TYPE', error: '허용되지 않은 전이' };
        var probe2 = { case_id: case_id, type: 'state_' + td.event, actor_side: peer, payload: pl };
        if (!(await Y().verifyEntryProof(probe2, cs.keys[peer]))) return { ok: false, code: 'BAD_PROOF', error: '전이 서명 검증 실패' };
        if (pl.from !== cs.state && cs.state === pl.to) return { ok: true, duplicate: true, converged: true };   // 양쪽이 동시에 같은 전이를 한 경우(이미 같은 상태) — 충돌이 아니라 수렴
        if (pl.from !== cs.state) return { ok: false, code: 'STATE_MISMATCH', error: '내 상태(' + cs.state + ')와 상대가 본 상태(' + pl.from + ')가 다름' };
        var dd = await _derive(cs, td.event);
        if (!dd.ok) return dd;
        var cx = Object.assign({ side: peer, outcome: pl.outcome }, dd.ctx);
        res = await _commit(cs, td.event, cx, { payload: Y().stripProof(pl) }, true, pl);
        if (res.ok && res.state !== pl.to) return { ok: false, code: 'STATE_MISMATCH', error: '전이 결과가 상대 서명 내용과 다름' };
      } else if (ev.kind === 'shared_entry') {
        var p = ev.data || {};
        if (p.case_id !== case_id || p.visibility !== 'shared' || !(await C().verifyEntryHash(p))) return { ok: false, code: 'BAD_HASH', error: '항목 해시 검증 실패' };
        res = await append(case_id, { type: 'peer_entry', actor_side: peer, visibility: 'shared', payload: { entry: p } });
      } else return { ok: false, code: 'BAD_KIND', error: '알 수 없는 이벤트 종류' };
      if (res && res.ok) await adapter.put('comms', seenKey, { at: now() });
      return res;
    }

    // 상대가 보낸 "공유 항목" 목록(소비자 화면용). 검증된 것만 저장되어 있다.
    async function peerEntries(case_id) {
      return (await history(case_id)).filter(function (e) { return e.type === 'peer_entry'; }).map(function (e) { return e.payload.entry; });
    }

    // ── 인계(S4, G8): 나 홀로 → 전문가에게 맡기기 ─────────────────────
    // 나 홀로 때의 기록은 그대로(내부) 남고, 인계 시점의 체인 머리 해시를 기록해 이후 "그때까지의 기록"을 증명할 수 있다.
    // 상대(맡은 쪽)에게는 사용자가 고른 항목만 discloseEntry 로 공개한다.
    async function handover(case_id) {
      var cs = await getCase(case_id);
      if (!cs) return { ok: false, error: '없는 Case' };
      if (cs.mode !== 'solo') return { ok: false, error: '나 홀로 일만 인계할 수 있습니다' };
      if (['active', 'on_hold'].indexOf(cs.state) < 0) return { ok: false, error: '진행 중이거나 보류 중인 일만 인계할 수 있습니다' };
      var v = await verify(case_id);
      if (!v.ok) return { ok: false, error: '기록 체인이 손상되어 인계할 수 없습니다' };
      var r = await append(case_id, { type: 'handover', actor_side: 'self', visibility: 'internal', payload: { solo_head: v.head, solo_length: v.length, prior_state: cs.state } });
      Object.assign(cs, { mode: 'engaged', my_side: 'consumer', state: 'proposed', keys: null, handover: { prior_state: cs.state, at: now(), solo_head: v.head, seq: r.entry.seq } });
      await saveCase(cs);
      return { ok: true, value: cs, entry: r.entry };
    }
    // 합의 전(제안·거절·만료)이면 나 홀로로 되돌린다. 합의 후에는 되돌릴 수 없다(맡은 쪽이 이미 책임을 졌다).
    async function continueAsSolo(case_id) {
      var cs = await getCase(case_id);
      if (!cs || !cs.handover) return { ok: false, error: '인계한 적 없는 일입니다' };
      if (['proposed', 'declined', 'expired'].indexOf(cs.state) < 0) return { ok: false, error: '합의 후에는 나 홀로로 되돌릴 수 없습니다' };
      var r = await append(case_id, { type: 'handover_cancelled', actor_side: 'consumer', visibility: 'internal', payload: { restored_state: cs.handover.prior_state } });
      var prior = cs.handover.prior_state;
      delete cs.my_side; delete cs.keys; delete cs.handover;
      Object.assign(cs, { mode: 'solo', state: prior });
      await saveCase(cs);
      return { ok: true, value: cs, entry: r.entry };
    }
    // 과거의 내부 기록을 상대에게 보여 주기로 한 경우: 원본 항목을 그대로 담은 공개 항목을 새로 남긴다(원본은 불변).
    async function discloseEntry(case_id, seq) {
      var h = await history(case_id), orig = h.filter(function (e) { return e.seq === seq; })[0];
      if (!orig) return { ok: false, error: '없는 항목' };
      if (orig.visibility === 'shared') return { ok: false, error: '이미 공개된 항목입니다' };
      var cs = await getCase(case_id);
      return append(case_id, { type: 'disclosure', actor_side: cs.my_side || 'self', visibility: 'shared', payload: { entry: orig } });
    }

    // 다른 기기의 기록 가져오기: 내 기록의 연장일 때만 이어 붙이고, 갈라졌으면(FORKED) 거부한다(합치기는 하지 않음).
    async function importHistory(case_id, entries) {
      var cs = await getCase(case_id);
      if (!cs) return { ok: false, code: 'NO_CASE' };
      var v = await C().verifyChain(entries);
      if (!v.ok) return { ok: false, code: 'BAD_CHAIN', reason: v.reason };
      if (entries.length && entries[0].case_id !== case_id) return { ok: false, code: 'WRONG_CASE' };
      var mine = await history(case_id), cmp = await C().compareChains(mine, entries);
      if (cmp.relation === 'forked') return { ok: false, code: 'FORKED', forkSeq: cmp.forkSeq };
      if (cmp.relation !== 'behind') return { ok: true, added: 0, relation: cmp.relation };
      for (var i = mine.length; i < entries.length; i++) {
        var e = entries[i], key = case_id + '/' + pad(e.seq);
        await adapter.put('history', key, e);
        await adapter.put('outbox', key, { _key: key, payload: await C().anchorPayloadFor(e), state: 'pending', tries: 0 });
      }
      return { ok: true, added: entries.length - mine.length, relation: 'behind' };
    }

    async function verify(case_id) { return C().verifyChain(await history(case_id)); }

    // 아웃박스 발송. 실패해도 예외 없이 pending 유지(오프라인 허용). 반환: { sent, failed, pending }
    async function flushAnchors(limit) {
      if (!opts.endpoint || !opts.fetch || !opts.who) return { sent: 0, failed: 0, pending: (await adapter.list('outbox', '')).filter(function (o) { return o.state === 'pending'; }).length, skipped: '엔드포인트/who/fetch 미설정' };
      var all = await adapter.list('outbox', '');   // 각 레코드가 자기 키(_key)를 가진다
      var sent = 0, failed = 0;
      for (var i = 0; i < all.length && (!limit || sent + failed < limit); i++) {
        var o = all[i];
        if (o.state !== 'pending') continue;
        var ok = false;
        try {
          var res = await opts.fetch(opts.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ report: { svc: opts.svc || 'case', who: { ipv6: opts.who }, content_hash: o.payload.content_hash,
              type: o.payload.type, case_id_hash: o.payload.case_id_hash, seq: o.payload.seq, when: o.payload.at } }) });
          ok = !!(res && res.ok);
        } catch (_) { ok = false; }
        o.tries++; o.state = ok ? 'anchored' : 'pending';
        await adapter.put('outbox', o._key, o);
        if (ok) sent++; else failed++;
      }
      return { sent: sent, failed: failed, pending: (await adapter.list('outbox', '')).filter(function (x) { return x.state === 'pending'; }).length };
    }

    return { createCase: createCase, patchCase: patchCase, getCase: getCase, listCases: listCases, history: history, append: append,
      applyTransition: applyTransition, verify: verify, flushAnchors: flushAnchors,
      setKeys: setKeys, signedAppend: signedAppend, confirmAgreement: confirmAgreement, buildShareEvents: buildShareEvents, ingestEvent: ingestEvent, peerEntries: peerEntries,
      handover: handover, continueAsSolo: continueAsSolo, discloseEntry: discloseEntry, importHistory: importHistory };
  }

  root.CaseStore = { CaseStore: CaseStore, MemoryAdapter: MemoryAdapter, IdbAdapter: IdbAdapter };
})(typeof window !== 'undefined' ? window : globalThis);
