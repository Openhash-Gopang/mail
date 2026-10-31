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

    // 상태 전이를 기록과 함께 확정한다(가드 통과해야만 저장).
    async function applyTransition(case_id, event, ctx, entry) {
      var cs = await getCase(case_id);
      if (!cs) return { ok: false, error: '없는 Case' };
      var t = C().transition(cs.state, event, Object.assign({ mode: cs.mode }, ctx));
      if (!t.ok) return t;
      entry = entry || {};
      var r = await append(case_id, Object.assign({ type: 'state_' + event, actor_side: ctx.side, visibility: 'shared' }, entry,
        { payload: Object.assign({ from: cs.state, to: t.to }, entry.payload || {}) }));   // outcome 등은 from/to 와 합친다
      cs.state = t.to; await saveCase(cs);
      return Object.assign({}, r, { state: t.to });
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
      applyTransition: applyTransition, verify: verify, flushAnchors: flushAnchors };
  }

  root.CaseStore = { CaseStore: CaseStore, MemoryAdapter: MemoryAdapter, IdbAdapter: IdbAdapter };
})(typeof window !== 'undefined' ? window : globalThis);
