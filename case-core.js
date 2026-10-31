/* ═════════════════════════════════════════════════
   case-core.js — Case(일) 관리 엔진의 순수 데이터 계층 (M0)
   2026-11-01 신설. 설계: hondi-case-process v0.2/v0.3.

   원칙
   - 모든 기록은 당사자 본인의 PDV(기기 IndexedDB, domain 'work')에 저장하고,
     네트워크(/pdv/report)에는 SHA-256 해시만 보낸다. 이 파일은 저장소·네트워크를
     전혀 모른다(저장소 어댑터는 호출자가 주입). 본문을 서버로 보내는 코드는 없다.
   - 의존성 없음(UMD). 해시는 WebCrypto(globalThis.crypto.subtle) — 브라우저·Node 19+.
   - 도메인 팩(법률·의료 …)은 이 엔진 위의 설정 데이터이며 여기에는 들어오지 않는다.

   구성
   1) canonical / sha256Hex        — 해시 입력을 결정적으로 만든다
   2) Case 상태기계                — transition(state, event, ctx) 순수 함수 + 가드
   3) History                       — append-only 해시체인(prev_hash/hash), visibility
   4) 소비자 투영                   — projectForConsumer: shared 항목만(B안)
   5) 소통 이력(Communication)      — 6하 + 누구와, 검증·확정 상태
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  // ── 1) 정규화·해시 ─────────────────────────────────────────
  // 키 정렬 JSON. undefined 키는 제거, 비유한 숫자는 거부(해시 불일치 방지).
  function canonical(v) {
    if (v === null) return 'null';
    var t = typeof v;
    if (t === 'string' || t === 'boolean') return JSON.stringify(v);
    if (t === 'number') {
      if (!isFinite(v)) throw new Error('canonical: 유한하지 않은 숫자');
      return JSON.stringify(v);
    }
    if (Array.isArray(v)) return '[' + v.map(function (x) { return x === undefined ? 'null' : canonical(x); }).join(',') + ']';
    if (t === 'object') {
      var keys = Object.keys(v).filter(function (k) { return v[k] !== undefined; }).sort();
      return '{' + keys.map(function (k) { return JSON.stringify(k) + ':' + canonical(v[k]); }).join(',') + '}';
    }
    throw new Error('canonical: 지원하지 않는 형식 ' + t);
  }

  async function sha256Hex(str) {
    var c = root.crypto && root.crypto.subtle ? root.crypto : null;
    if (!c) throw new Error('WebCrypto 사용 불가');
    var buf = await c.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  // ── 2) Case 상태기계 ───────────────────────────────────────
  var STATES = ['proposed', 'agreed', 'active', 'on_hold', 'closing', 'closed', 'archived', 'declined', 'expired'];
  var KINDS = ['transaction', 'case', 'event'];
  var SIDES = ['provider', 'consumer', 'self'];   // self = 나 홀로(한 사람이 공급자이자 소비자)
  var MODES = ['engaged', 'solo'];                // engaged = 맡은 일/맡긴 일(양측), solo = 나 홀로

  // from → { event: to }
  var TRANSITIONS = {
    proposed: { confirm: 'proposed', accept: 'agreed', decline: 'declined', expire: 'expired' },
    agreed:   { activate: 'active' },
    active:   { hold: 'on_hold', request_close: 'closing', close_self: 'closed' },
    on_hold:  { resume: 'active', request_close: 'closing', close_self: 'closed' },
    closing:  { close_agree: 'closed', close_dispute: 'active', close_hold: 'on_hold' },
    closed:   { archive: 'archived' },
    archived: {}, declined: {}, expired: {},
  };

  // ctx: { confirmations:{provider,consumer}, side, outcome, unpaidInvoices, closeRequestedBy }
  // 반환: { ok, to } | { ok:false, error }
  function transition(state, event, ctx) {
    ctx = ctx || {};
    var row = TRANSITIONS[state];
    if (!row) return { ok: false, error: '알 수 없는 상태: ' + state };
    if (!Object.prototype.hasOwnProperty.call(row, event)) return { ok: false, error: state + ' 상태에서 ' + event + ' 불가' };
    var solo = ctx.mode === 'solo';
    if (solo && ['confirm', 'accept', 'decline', 'expire', 'request_close', 'close_agree', 'close_dispute', 'close_hold'].indexOf(event) >= 0)
      return { ok: false, error: '나 홀로 일에는 합의·상대 응답 절차가 없음(' + event + ')' };
    if (!solo && event === 'close_self') return { ok: false, error: 'close_self는 나 홀로 일에서만 가능' };
    if (solo && ctx.side !== 'self') return { ok: false, error: '나 홀로 일은 side=self 만 가능' };
    if (!solo && ctx.side === 'self') return { ok: false, error: 'self 는 나 홀로 일에서만 가능' };
    if (SIDES.indexOf(ctx.side) < 0 && event !== 'expire') return { ok: false, error: 'side(provider|consumer) 필요' };

    if (event === 'confirm') {
      // 제안자는 이미 확인한 것으로 보고, 상대 확인이 들어오면 accept 가능.
      return { ok: true, to: 'proposed' };
    }
    if (event === 'accept') {
      var cf = ctx.confirmations || {};
      if (!(cf.provider && cf.consumer)) return { ok: false, error: '양측 확인이 모두 기록되어야 합의 완료' };
    }
    if (event === 'request_close' || event === 'close_self') {
      if (!ctx.outcome) return { ok: false, error: '종료 요청에는 결과(outcome) 기록이 필요' };
    }
    if (event === 'close_agree') {
      if (!ctx.closeRequestedBy) return { ok: false, error: '종료 요청 기록 없음' };
      if (ctx.side === ctx.closeRequestedBy) return { ok: false, error: '종료 동의는 요청하지 않은 상대편이 해야 함' };
      if (!(Number.isInteger(ctx.unpaidInvoices) && ctx.unpaidInvoices >= 0)) return { ok: false, error: '미결제 청구서 수를 확인할 수 없어 종료 불가(unpaidInvoices 필요)' };
      if (ctx.unpaidInvoices > 0) return { ok: false, error: '미결제 청구서가 있어 종료 불가' };
    }
    if (event === 'close_dispute' || event === 'close_hold') {
      if (ctx.side === ctx.closeRequestedBy) return { ok: false, error: '요청한 쪽은 자기 종료 요청에 이의/보류 불가' };
    }
    return { ok: true, to: row[event] };
  }

  // 나 홀로 일은 합의 없이 곧바로 active 로 시작한다(제3자 기관·병원 등과의 소통은 소통 이력에 기록).
  function createSolo(input) {
    var i = input || {};
    if (!i.case_id || !i.title) return { ok: false, error: 'case_id, title 필수' };
    if (KINDS.indexOf(i.kind || 'case') < 0) return { ok: false, error: 'kind 오류' };
    return { ok: true, value: { case_id: i.case_id, title: i.title, kind: i.kind || 'case', mode: 'solo', state: 'active', owner: i.owner || null } };
  }

  // ── 3) History: 해시체인 ───────────────────────────────────
  var VISIBILITY = ['internal', 'shared'];
  var GENESIS = '0'.repeat(64);

  function hashBody(e) {
    // hash 필드를 제외한 모든 필드가 해시 입력
    var o = {};
    Object.keys(e).forEach(function (k) { if (k !== 'hash') o[k] = e[k]; });
    return canonical(o);
  }

  // entry: { case_id, type, actor_side, actor, visibility, payload, at, corrects? }
  async function appendEntry(history, entry) {
    if (!Array.isArray(history)) throw new Error('history 배열 필요');
    if (!entry || !entry.case_id || !entry.type) throw new Error('case_id, type 필수');
    if (SIDES.indexOf(entry.actor_side) < 0) throw new Error('actor_side 오류');
    var vis = entry.visibility || 'internal';
    if (VISIBILITY.indexOf(vis) < 0) throw new Error('visibility 오류');
    var prev = history.length ? history[history.length - 1] : null;
    if (entry.corrects && !history.some(function (h) { return h.seq === entry.corrects; })) {
      throw new Error('corrects 대상 seq 없음');
    }
    var e = {
      case_id: entry.case_id,
      seq: prev ? prev.seq + 1 : 1,
      type: entry.type,
      actor_side: entry.actor_side,
      actor: entry.actor || null,
      visibility: vis,
      payload: entry.payload === undefined ? null : entry.payload,
      at: entry.at || new Date().toISOString(),
      corrects: entry.corrects || null,
      prev_hash: prev ? prev.hash : GENESIS,
    };
    e.hash = await sha256Hex(hashBody(e));
    return e; // 호출자가 저장소에 추가(append-only: 이 함수는 history를 변경하지 않음)
  }

  // 반환: { ok, brokenAt?, reason? }
  async function verifyChain(history) {
    var prevHash = GENESIS, expectSeq = 1, caseId = history.length ? history[0].case_id : null;
    for (var i = 0; i < history.length; i++) {
      var e = history[i];
      if (e.case_id !== caseId) return { ok: false, brokenAt: e.seq, reason: 'case_id 불일치' };
      if (e.seq !== expectSeq) return { ok: false, brokenAt: e.seq, reason: 'seq 불연속' };
      if (e.prev_hash !== prevHash) return { ok: false, brokenAt: e.seq, reason: 'prev_hash 불일치' };
      if ((await sha256Hex(hashBody(e))) !== e.hash) return { ok: false, brokenAt: e.seq, reason: '내용 변조(hash 불일치)' };
      prevHash = e.hash; expectSeq++;
    }
    return { ok: true, head: history.length ? prevHash : GENESIS, length: history.length };
  }

  // 두 기기의 기록 비교(S4, G7 일부): same / ahead(a 가 더 앞섬) / behind / forked(어느 시점부터 갈라짐)
  async function compareChains(a, b) {
    var n = Math.min(a.length, b.length), i = 0;
    while (i < n && a[i].hash === b[i].hash) i++;
    if (i === a.length && i === b.length) return { relation: 'same', common: i };
    if (i === a.length) return { relation: 'behind', common: i };
    if (i === b.length) return { relation: 'ahead', common: i };
    return { relation: 'forked', common: i, forkSeq: a[i].seq };
  }

  // 네트워크에 올리는 것은 이것뿐 — 본문 없이 해시와 식별 메타만(/pdv/report용 입력).
  function anchorPayload(entry) {
    return { type: 'case_' + entry.type, content_hash: entry.hash, case_id_hash: null, seq: entry.seq, at: entry.at };
  }
  async function anchorPayloadFor(entry) {
    var p = anchorPayload(entry);
    p.case_id_hash = await sha256Hex('case:' + entry.case_id); // case_id 자체도 평문 노출하지 않음
    return p;
  }

  // ── 4) 소비자 투영 (B안) ───────────────────────────────────
  // 공급자 원본에서 shared 항목만 골라 소비자용 뷰를 만든다. internal 은 절대 포함하지 않는다.
  // 정정(corrects)이 걸린 shared 항목은 정정본으로 대체 표시한다.
  function projectForConsumer(history) {
    var shared = history.filter(function (e) { return e.visibility === 'shared'; });
    var corrected = {};
    shared.forEach(function (e) { if (e.corrects) corrected[e.corrects] = e.seq; });
    return shared.map(function (e) {
      // 소비자가 해시를 직접 재계산할 수 있도록 해시 입력 필드를 모두 담는다(내부 항목은 prev_hash 로만 흔적이 남고 내용은 없음).
      return {
        link_id: e.case_id + '#' + e.seq,
        case_id: e.case_id, seq: e.seq, type: e.type, at: e.at, actor_side: e.actor_side, actor: e.actor == null ? null : e.actor,
        visibility: e.visibility, payload: e.payload, corrects: e.corrects || null, prev_hash: e.prev_hash, hash: e.hash,
        superseded_by: corrected[e.seq] || null,
      };
    });
  }

  // 항목 하나의 해시를 그 항목의 필드만으로 다시 계산한다(투영 항목도 가능 — 원본 전체가 필요 없다).
  var HASH_FIELDS = ['case_id', 'seq', 'type', 'actor_side', 'actor', 'visibility', 'payload', 'at', 'corrects', 'prev_hash'];
  async function entryHash(e) {
    var o = {};
    HASH_FIELDS.forEach(function (k) { o[k] = e[k] === undefined ? null : e[k]; });
    return sha256Hex(canonical(o));
  }
  async function verifyEntryHash(e) {
    try { return !!e && typeof e.hash === 'string' && (await entryHash(e)) === e.hash; } catch (_) { return false; }
  }

  // 소비자가 보유한 투영이 공급자 원본의 shared 부분과 일치하는지(해시 대조).
  function verifyProjection(projection, providerHistory) {
    var byHash = {};
    providerHistory.forEach(function (e) { byHash[e.hash] = e; });
    for (var i = 0; i < projection.length; i++) {
      var o = byHash[projection[i].hash];
      if (!o) return { ok: false, brokenAt: projection[i].seq, reason: '원본에 없는 해시' };
      if (o.visibility !== 'shared') return { ok: false, brokenAt: projection[i].seq, reason: 'internal 항목이 투영에 포함됨' };
    }
    return { ok: true };
  }

  // ── 5) 소통 이력 (Communication) — 6하 ─────────────────────
  var CHANNELS = ['mail', 'chat', 'phone', 'video', 'in_person', 'document', 'other'];
  var HOW = ['auto', 'manual', 'ai_assisted'];
  var PURPOSES = ['info', 'request', 'report', 'consult', 'agreement', 'payment', 'other'];
  var CONFIRM = ['auto', 'self', 'unconfirmed', 'confirmed', 'disputed'];

  // 입력: { recorder_side, who, with, occurred_at, channel, place?, how, summary, purpose, link?:{request_id|task_id},
  //        attachments?:[hash], visibility? }
  // 반환: { ok, value } | { ok:false, errors:[...] }
  function buildCommunication(input, nowIso) {
    var errs = [], i = input || {};
    function need(k, label) { if (!i[k] || (typeof i[k] === 'string' && !i[k].trim())) errs.push(label + ' 필수'); }
    need('who', '누가'); need('with', '누구와'); need('occurred_at', '언제'); need('summary', '무엇을');
    if (SIDES.indexOf(i.recorder_side) < 0) errs.push('기록자 측(recorder_side) 오류');
    if (CHANNELS.indexOf(i.channel) < 0) errs.push('어떻게(channel) 오류');
    if (HOW.indexOf(i.how) < 0) errs.push('방식(how: auto|manual|ai_assisted) 오류');
    if (PURPOSES.indexOf(i.purpose) < 0) errs.push('왜(purpose) 오류');
    if (i.channel === 'in_person' && !(i.place && String(i.place).trim())) errs.push('대면 소통은 어디서(place) 필수');
    if (i.occurred_at && isNaN(Date.parse(i.occurred_at))) errs.push('언제 형식 오류');
    var now = nowIso || new Date().toISOString();
    if (i.occurred_at && !isNaN(Date.parse(i.occurred_at)) && Date.parse(i.occurred_at) > Date.parse(now) + 5 * 60e3) errs.push('언제가 미래');
    var visibility = i.visibility || 'internal';
    if (VISIBILITY.indexOf(visibility) < 0) errs.push('visibility 오류');
    if (errs.length) return { ok: false, errors: errs };
    // 자동 수집(메일·앱 채팅)은 시스템이 본 사실이므로 auto, 수기 입력은 상대 확인 전까지 unconfirmed.
    // 나 홀로(self)의 상대는 법원·병원 등 제3자라 확인 절차가 없다 → 본인 기록('self').
    var confirm_status = i.how === 'auto' ? 'auto' : (i.recorder_side === 'self' ? 'self' : 'unconfirmed');
    return {
      ok: true,
      value: {
        who: i.who, with: i.with, recorder_side: i.recorder_side,
        occurred_at: new Date(i.occurred_at).toISOString(), recorded_at: now,
        channel: i.channel, place: i.place || null, how: i.how,
        summary: i.summary, purpose: i.purpose, link: i.link || null,
        attachments: i.attachments || [], confirm_status: confirm_status,
      },
      visibility: visibility,
    };
  }

  // 수기 소통의 확정 상태 전이: 상대(with 측)만 confirmed/disputed 가능, 기록 원본은 바꾸지 않고 새 History 항목으로 남긴다.
  function respondCommunication(comm, responderSide, answer) {
    if (comm.confirm_status === 'self') return { ok: false, error: '나 홀로 기록은 확인 대상 아님' };
    if (comm.confirm_status === 'auto') return { ok: false, error: '자동 수집 기록은 확인 대상 아님' };
    if (comm.confirm_status !== 'unconfirmed') return { ok: false, error: '이미 ' + comm.confirm_status };
    if (answer !== 'confirmed' && answer !== 'disputed') return { ok: false, error: 'answer 오류' };
    if (responderSide === comm.recorder_side) return { ok: false, error: '기록자 본인은 확인할 수 없음' };
    return { ok: true, confirm_status: answer };
  }

  var API = {
    canonical: canonical, sha256Hex: sha256Hex,
    STATES: STATES, KINDS: KINDS, SIDES: SIDES, MODES: MODES, createSolo: createSolo, TRANSITIONS: TRANSITIONS, transition: transition,
    GENESIS: GENESIS, appendEntry: appendEntry, verifyChain: verifyChain, compareChains: compareChains,
    anchorPayloadFor: anchorPayloadFor,
    projectForConsumer: projectForConsumer, verifyProjection: verifyProjection, entryHash: entryHash, verifyEntryHash: verifyEntryHash,
    CHANNELS: CHANNELS, PURPOSES: PURPOSES, CONFIRM: CONFIRM,
    buildCommunication: buildCommunication, respondCommunication: respondCommunication,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.CaseCore = API;
})(typeof window !== 'undefined' ? window : globalThis);
