/* ═════════════════════════════════════════════════
   assistant-core.js — 나만의 AI 비서(AC-PRO-CORE) 코어 A1: 관찰 이벤트·동의 범위·마스킹·원장
   2026-11-01. 설계: hondi-assistant-core-design v0.2. 판정은 코드(결정론), 모델은 해석·문안만.
   · ActivityEvent: 소통 이력과 같은 6하 + source/level/consent_scope. 동의 밖 이벤트는 받지 않는다.
   · 민감정보(special)는 모델 호출 전 maskForModel 로 가린다(주민번호·카드번호 패턴, special 본문 제거).
   · 원장(ledger): 비서의 판단·경고·증명은 "나 홀로 Case(case_id='assistant')"의 해시체인 History 로 남긴다
     → case-store 의 로컬 저장·앵커 아웃박스를 그대로 재사용. 앵커에는 해시만 나간다.
   의존: case-core.js (canonical, sha256Hex), case-store.js (CaseStore)
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var C = function () { return root.CaseCore; };

  // source → 동의 등급. L0: 우리 PDV 안 Case 기록 / L1: 우리 서비스 안 활동 / L2: 기기 활동 / L3: 외부 계정
  var SOURCE_LEVEL = {
    'case': 'L0', 'comm': 'L0', 'invoice': 'L0', 'agreement': 'L0',
    'mail': 'L1', 'doc': 'L1', 'schedule': 'L1', 'gdc': 'L1',
    'device.app': 'L2', 'device.location': 'L2', 'device.file': 'L2', 'device.notify': 'L2',
  };
  var DEFAULT_CONSENT = { L0: true, L1: true, L2: false, L3: [] };

  function levelOf(source) {
    if (SOURCE_LEVEL[source]) return SOURCE_LEVEL[source];
    return /^ext\./.test(source || '') ? 'L3' : null;
  }
  // consent: { L0:bool, L1:bool, L2:bool|[sources], L3:[허용한 ext.* source 목록] } — L2 는 true 또는 허용 source 배열
  function isAllowed(source, consent) {
    var c = Object.assign({}, DEFAULT_CONSENT, consent || {}), lv = levelOf(source);
    if (!lv) return false;
    if (lv === 'L3') return Array.isArray(c.L3) && c.L3.indexOf(source) >= 0;
    if (lv === 'L2') return c.L2 === true || (Array.isArray(c.L2) && c.L2.indexOf(source) >= 0);
    return c[lv] === true;
  }

  var SPECIAL_SOURCES = /^(ext\.health|ext\.bank|device\.location)/;
  // 6하(who/when/where/with/how/what/why) 중 최소한 who·what·at 은 있어야 한다.
  function normalizeEvent(raw, consent, nowIso) {
    raw = raw || {};
    if (!raw.source || !raw.what) return { ok: false, code: 'BAD_EVENT', message: 'source, what 필수' };
    var lv = levelOf(raw.source);
    if (!lv) return { ok: false, code: 'UNKNOWN_SOURCE', message: '알 수 없는 source' };
    if (!isAllowed(raw.source, consent)) return { ok: false, code: 'NO_CONSENT', message: '동의 범위 밖(' + lv + ')' };
    var special = raw.sensitivity === 'special' || SPECIAL_SOURCES.test(raw.source);
    return { ok: true, event: {
      id: raw.id || null, source: raw.source, level: lv, at: raw.at || nowIso || new Date().toISOString(),
      who: raw.who || null, where: raw.where || null, with: raw.with || null, how: raw.how || null, what: raw.what, why: raw.why || null,
      case_id: raw.case_id || null, refs: Array.isArray(raw.refs) ? raw.refs : [],
      sensitivity: special ? 'special' : (raw.sensitivity || 'normal'), data: raw.data === undefined ? null : raw.data,
      consent_scope: lv,
    } };
  }

  var RRN = /\b\d{6}[-\s]?[1-8]\d{6}\b/g, CARD = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
  function maskText(t) { return String(t == null ? '' : t).replace(RRN, '[주민번호]').replace(CARD, '[카드번호]'); }
  // 모델에 보낼 사본: special 은 본문(what/data/with/where)을 지우고 종류만 남긴다. 나머지는 패턴 마스킹.
  function maskForModel(ev) {
    var o = JSON.parse(JSON.stringify(ev));
    if (o.sensitivity === 'special') { o.what = '[민감정보 — 본문 비공개]'; o.data = null; o.with = null; o.where = null; o.why = null; o.refs = o.refs.map(function (r) { return { kind: r.kind }; }); return o; }
    ['who', 'where', 'with', 'how', 'what', 'why'].forEach(function (k) { if (o[k]) o[k] = maskText(o[k]); });
    if (o.data != null) o.data = JSON.parse(maskText(JSON.stringify(o.data)));
    return o;
  }

  // 원장: CaseStore 위의 나 홀로 Case. 비서가 한 일은 actor='assistant' 로 사용자가 열람할 수 있다.
  function Ledger(store, opts) {
    opts = opts || {}; var id = opts.case_id || 'assistant';
    async function ensure() {
      if (await store.getCase(id)) return { ok: true };
      return store.createCase({ mode: 'solo', case_id: id, title: '나비 비서 원장', kind: 'case' });
    }
    async function record(type, payload, visibility) {
      var e = await ensure(); if (e.ok === false) return e;
      return store.append(id, { type: type, actor_side: 'self', actor: 'assistant', visibility: visibility || 'internal', payload: payload });
    }
    async function entries() { return store.history(id); }
    async function verify() { return store.verify(id); }
    return { record: record, entries: entries, verify: verify, case_id: id };
  }

  root.AssistantCore = { SOURCE_LEVEL: SOURCE_LEVEL, DEFAULT_CONSENT: DEFAULT_CONSENT, levelOf: levelOf, isAllowed: isAllowed,
    normalizeEvent: normalizeEvent, maskText: maskText, maskForModel: maskForModel, Ledger: Ledger };
})(typeof window !== 'undefined' ? window : globalThis);
