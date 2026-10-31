/* ═════════════════════════════════════════════════
   assistant-rules.js — 나만의 AI 비서 A2: 규칙팩(서명 검증)·선언형 규칙 평가·Gate·Attestation·Notice
   2026-11-01. 설계 v0.2 §3. 핵심 약속
   · 같은 입력·같은 규칙 버전이면 결과가 항상 같다(결정론, 재현 가능). 임의 코드를 실행하지 않는다(선언형 표현식).
   · 평가에 필요한 값이 없으면 규칙은 "미평가"가 되고, 이는 "문제없음"이 아니다.
   · 위험이 큰 행위에서 규칙이 없거나 미평가면 ADVISE_HUMAN — 막지 않고 "인간 전문가(법률이면 변호사)의 조언을 구하시길 권한다".
     나비웹은 특정 전문가를 추천하지 않는다(중립). 사용자가 나비웹 검색이나 인터넷 검색으로 직접 찾는다.
   · BLOCK 은 규칙팩의 blocking 규칙 위반(불법·요건 불충족이 명백)일 때만.
   의존: case-core.js (canonical, sha256Hex), case-sync.js (verifySig), assistant-core.js (Ledger)
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var C = function () { return root.CaseCore; }, Y = function () { return root.CaseSync; };
  var DAY = 86400000;

  // ── 선언형 표현식 ───────────────────────────────────────
  // {var:"a.b"} · {op:"and|or|not|eq|neq|lt|lte|gt|gte|in|exists|len|days_until|add_days", args:[...]} · 리터럴
  function Unevaluable(path) { this.path = path; }
  function getVar(ctx, path) {
    var cur = ctx, parts = String(path).split('.');
    for (var i = 0; i < parts.length; i++) { if (cur == null || typeof cur !== 'object' || !(parts[i] in cur)) throw new Unevaluable(path); cur = cur[parts[i]]; }
    if (cur === undefined || cur === null) throw new Unevaluable(path);
    return cur;
  }
  function evalExpr(x, ctx) {
    if (x === null || typeof x !== 'object') return x;
    if (Array.isArray(x)) return x.map(function (v) { return evalExpr(v, ctx); });
    if ('var' in x) return getVar(ctx, x.var);
    if (!('op' in x)) throw new Error('잘못된 표현식');
    var a = x.args || [], op = x.op;
    if (op === 'and') { var allT = true; for (var i = 0; i < a.length; i++) { if (!evalExpr(a[i], ctx)) { allT = false; break; } } return allT; }
    if (op === 'or') { var firstUn = null; for (var j = 0; j < a.length; j++) { try { if (evalExpr(a[j], ctx)) return true; } catch (e) { if (e instanceof Unevaluable) firstUn = firstUn || e; else throw e; } } if (firstUn) throw firstUn; return false; }
    var v = a.map(function (e) { return evalExpr(e, ctx); });
    switch (op) {
      case 'not': return !v[0];
      case 'eq': return v[0] === v[1]; case 'neq': return v[0] !== v[1];
      case 'lt': return v[0] < v[1]; case 'lte': return v[0] <= v[1];
      case 'gt': return v[0] > v[1]; case 'gte': return v[0] >= v[1];
      case 'in': return Array.isArray(v[1]) && v[1].indexOf(v[0]) >= 0;
      case 'exists': return v[0] != null && v[0] !== '';
      case 'len': return v[0] == null ? 0 : v[0].length;
      case 'days_until': return Math.ceil((Date.parse(v[0]) - Date.parse(v[1])) / DAY);          // (목표일, 기준일)
      case 'add_days': return new Date(Date.parse(v[0]) + v[1] * DAY).toISOString();
      default: throw new Error('허용되지 않은 연산: ' + op);
    }
  }

  // ── 규칙팩 ─────────────────────────────────────────────
  // pack: { id, version, domain, jurisdiction, effective_from, effective_to?, publisher:{id,pub}, rules:[...], sig }
  //   rule: { id, actions:[행위 종류], violation_when:표현식, severity:1~3, blocking?:bool, message, remedy?, cite? }
  function packMsg(p) { return 'hondi-assistant/v1:pack:' + C().canonical({ id: p.id, version: p.version, domain: p.domain, jurisdiction: p.jurisdiction, effective_from: p.effective_from, effective_to: p.effective_to || null, publisher: p.publisher, rules: p.rules }); }
  async function signPack(identity, pack) { var p = Object.assign({}, pack, { publisher: { id: pack.publisher.id, pub: identity.pub } }); p.sig = await identity.sign(packMsg(p)); return p; }
  // trusted: 신뢰하는 발행자 공개키 목록(사용자 본인 키 포함). 서명이 없거나 신뢰 밖이면 무시한다.
  async function packValid(p, trusted, nowIso) {
    if (!p || !p.sig || !p.publisher || !p.publisher.pub) return { ok: false, code: 'NO_SIGNATURE' };
    if ((trusted || []).indexOf(p.publisher.pub) < 0) return { ok: false, code: 'UNTRUSTED_PUBLISHER' };
    if (!(await Y().verifySig(p.publisher.pub, packMsg(p), p.sig))) return { ok: false, code: 'BAD_SIGNATURE' };
    var t = Date.parse(nowIso);
    if (Date.parse(p.effective_from) > t) return { ok: false, code: 'NOT_YET_EFFECTIVE' };
    if (p.effective_to && Date.parse(p.effective_to) <= t) return { ok: false, code: 'EXPIRED' };
    return { ok: true };
  }

  // ── 위험 분류 (AC-PRO-CORE risk_tier 의 두 질문을 코드로) ─────────────
  // action: { type, effect:"read|draft|internal|external|money|signature", domain, affects_life_property?:bool }
  function classifyRisk(action) {
    var b = action.affects_life_property === true || action.effect === 'money' || action.effect === 'signature';
    return b ? 'high' : 'low';
  }

  var RANK = { BLOCK: 5, ADVISE_HUMAN: 4, WARN: 3, PASS_UNCHECKED: 2, PASS: 1 };
  var PROFESSION = { law: '변호사', tax: '세무사·회계사', health: '의사·약사', contract: '변호사', ip: '변리사', labor: '공인노무사', real_estate: '공인중개사·법무사' };

  // ── Gate ───────────────────────────────────────────────
  // packs: 이미 packValid 를 통과한 팩만 넘긴다(gate 가 다시 검증하지 않음 — loadPacks 사용). ctx: 규칙이 읽는 값.
  async function gate(action, ctx, packs, nowIso) {
    var risk = classifyRisk(action), evaluated = [], unevaluated = [], violations = [], usedPacks = [];
    (packs || []).forEach(function (p) {
      if (action.domain && p.domain !== action.domain && p.domain !== 'common') return;
      var any = false;
      (p.rules || []).forEach(function (r) {
        if ((r.actions || []).indexOf(action.type) < 0) return;
        any = true;
        try {
          var viol = !!evalExpr(r.violation_when, Object.assign({ now: nowIso }, ctx));
          evaluated.push(r.id);
          if (viol) violations.push({ rule: r.id, pack: p.id, version: p.version, severity: r.severity || 1, blocking: r.blocking === true, message: r.message, remedy: r.remedy || null, cite: r.cite || null });
        } catch (e) {
          if (e instanceof Unevaluable) unevaluated.push({ rule: r.id, pack: p.id, missing: e.path });
          else unevaluated.push({ rule: r.id, pack: p.id, missing: null, error: String(e.message || e) });
        }
      });
      if (any) usedPacks.push({ id: p.id, version: p.version });
    });
    var result;
    if (violations.some(function (v) { return v.blocking; })) result = 'BLOCK';
    else if (risk === 'high' && (unevaluated.length || (!evaluated.length && !unevaluated.length))) result = 'ADVISE_HUMAN';
    else if (violations.length) result = 'WARN';
    else if (!evaluated.length && !unevaluated.length) result = 'PASS_UNCHECKED';   // 적용되는 규칙이 아예 없을 때만. 규칙은 있는데 값을 몰라 평가 못 한 것은 아래 WARN(미확인)
    else if (unevaluated.length) result = 'WARN';           // 낮은 위험: 미평가 규칙이 있으면 알린다
    else result = 'PASS';
    // 위반도 있고 위험도 커서 ADVISE_HUMAN 인 경우, 더 센 신호를 잃지 않게 위반 목록은 그대로 둔다.
    return { result: result, risk: risk, violations: violations, unevaluated: unevaluated, evaluated_count: evaluated.length, packs: usedPacks, domain: action.domain || null };
  }

  // 신뢰·유효한 팩만 골라낸다(무효 사유는 함께 돌려줘 화면에 "점검 못 한 이유"로 보인다).
  async function loadPacks(packs, trusted, nowIso) {
    var good = [], rejected = [];
    for (var i = 0; i < (packs || []).length; i++) { var v = await packValid(packs[i], trusted, nowIso); if (v.ok) good.push(packs[i]); else rejected.push({ id: packs[i] && packs[i].id, code: v.code }); }
    return { packs: good, rejected: rejected };
  }

  // ── Attestation: 입력은 해시만, 규칙 버전·미평가 목록을 남겨 나중에 재현·증명 ──────────
  async function attest(ledger, action, ctx, g, decision, nowIso) {
    var payload = { action: { type: action.type, effect: action.effect || null, domain: action.domain || null, ref: action.ref || null },
      input_hash: await C().sha256Hex(C().canonical(ctx || {})), result: g.result, risk: g.risk, packs: g.packs,
      rules_evaluated: g.evaluated_count, rules_unevaluated: g.unevaluated.map(function (u) { return u.rule; }),
      violations: g.violations.map(function (v) { return { rule: v.rule, severity: v.severity, blocking: v.blocking }; }),
      user_decision: decision ? decision.choice : null, user_reason: decision ? (decision.reason || null) : null };
    return ledger.record('attestation', payload, 'internal');
  }

  // ── Notice(사용자에게 보이는 문안과 선택지) ───────────────────────
  // 나비웹은 특정 전문가를 추천하지 않는다 → 선택지는 "검색 방법"만 제공하고 개인 식별자를 담지 않는다.
  function buildNotice(g, action) {
    var prof = PROFESSION[g.domain] || PROFESSION[action && action.domain] || '해당 분야 전문가';
    if (g.result === 'ADVISE_HUMAN') {
      return { type: 'suggest', level: 2, result: g.result,
        text: '이 부분은 제가 확실하게 점검할 수 없습니다. 인간 ' + prof + '의 조언을 구하시길 권합니다. 나비웹이나 인터넷에서 직접 찾아보실 수 있으며, 나비웹은 특정 ' + prof + '를 추천하지 않습니다. 그대로 진행하실지는 선택하실 수 있고, 그 선택은 기록됩니다.',
        unevaluated: g.unevaluated.map(function (u) { return u.missing; }).filter(Boolean),
        actions: [{ id: 'search_naviweb', label: '나비웹에서 ' + prof + ' 찾기' }, { id: 'search_web', label: '인터넷에서 찾기' }, { id: 'continue', label: '그대로 진행(기록됨)' }, { id: 'hold', label: '보류' }],
        recommends_person: false };
    }
    if (g.result === 'BLOCK') return { type: 'alert', level: 3, result: g.result, text: '진행할 수 없습니다: ' + g.violations.filter(function (v) { return v.blocking; }).map(function (v) { return v.message; }).join(' / '), actions: [{ id: 'fix', label: '고치기' }, { id: 'ask_expert', label: '전문가에게 문의' }], recommends_person: false };
    if (g.result === 'WARN') return { type: 'alert', level: 2, result: g.result, text: g.violations.map(function (v) { return v.message; }).concat(g.unevaluated.length ? ['확인하지 못한 항목이 ' + g.unevaluated.length + '건 있습니다.'] : []).join(' / '), actions: [{ id: 'continue', label: '확인했고 진행(기록됨)' }, { id: 'hold', label: '보류' }], recommends_person: false };
    if (g.result === 'PASS_UNCHECKED') return { type: 'note', level: 0, result: g.result, text: '이 행위에 적용되는 점검 규칙이 없어 점검하지 않았습니다(문제없다는 뜻이 아닙니다).', actions: [], recommends_person: false };
    return { type: 'note', level: 0, result: g.result, text: '점검 ' + g.evaluated_count + '건을 통과했습니다. (규칙 범위 안의 점검이며 법적 결과를 보장하지 않습니다)', actions: [], recommends_person: false };
  }

  // 기한 계산 같은 단순 Finding: 규칙팩 없이도 쓰는 결정론 헬퍼
  function deadlineFinding(label, dueIso, nowIso, steps) {
    var d = Math.ceil((Date.parse(dueIso) - Date.parse(nowIso)) / DAY), st = steps || [7, 1, 0];
    if (d < 0) return { kind: 'deadline', severity: 3, label: label, due: dueIso, days: d, status: 'overdue' };
    var hit = st.filter(function (s) { return d <= s; }).length > 0;
    return hit ? { kind: 'deadline', severity: d <= 1 ? 3 : 2, label: label, due: dueIso, days: d, status: 'due_soon' } : null;
  }

  root.AssistantRules = { evalExpr: evalExpr, signPack: signPack, packValid: packValid, loadPacks: loadPacks, classifyRisk: classifyRisk,
    gate: gate, attest: attest, buildNotice: buildNotice, deadlineFinding: deadlineFinding, RANK: RANK };
})(typeof window !== 'undefined' ? window : globalThis);
