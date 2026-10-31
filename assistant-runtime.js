/* ═════════════════════════════════════════════════
   assistant-runtime.js — 나만의 AI 비서 A3·A4: Case 연동 Finding 산출 + 알림 억제/피로 관리 + [ctx] 신호 줄
   2026-11-01. 설계 v0.2 §2·§5. 전부 결정론(같은 상태·같은 시각이면 같은 결과). 모델은 쓰지 않는다.
   · scan(): Case 상태·기한·청구서·소통 확인·인계 후보에서 Finding 을 만든다.
   · tick(): Finding → 알림 여부 결정(중복 병합, 하루 상한, severity 3 은 억제 불가) → 원장에 기록 → [ctx] 줄.
   · [ctx] 줄에는 "코드가 만든 라벨"만 들어간다. 사용자·상대가 쓴 문자열(제목 등)은 대괄호·줄바꿈을 지워 태그 위조를 막는다.
   의존: case-core, case-sync, case-store, assistant-core(Ledger), assistant-rules(buildNotice·deadlineFinding)
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var C = function () { return root.CaseCore; }, Y = function () { return root.CaseSync; }, R = function () { return root.AssistantRules; };
  var DAY = 86400000, DAILY_CAP = 3, MAX_CTX_LINES = 5;
  var OPEN = ['proposed', 'agreed', 'active', 'on_hold', 'closing'];

  // 태그 위조·줄바꿈 주입 방지: 대괄호·꺾쇠·줄바꿈·제어문자 제거, 길이 제한
  function clean(t, n) { return String(t == null ? '' : t).replace(/[\[\]<>{}\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n || 40); }
  var day = function (iso) { return String(iso).slice(0, 10); };

  function Runtime(o) {
    var store = o.store, ledger = o.ledger, now = o.now || function () { return new Date().toISOString(); };

    // ── A3: Case 연동 Finding ──────────────────────────────
    async function scan(nowIso) {
      nowIso = nowIso || now();
      var cases = await store.listCases(), out = [];
      for (var i = 0; i < cases.length; i++) {
        var cs = cases[i];
        if (cs.case_id === ledger.case_id || OPEN.indexOf(cs.state) < 0) continue;
        var title = clean(cs.title, 24), base = { case_id: cs.case_id, title: title };
        // 1) 기한
        (cs.deadlines || []).forEach(function (d) {
          var f = R().deadlineFinding(clean(d.label, 24), d.due, nowIso, d.steps);
          if (f) out.push(Object.assign({}, base, f, { key: 'deadline:' + cs.case_id + ':' + clean(d.label, 24) + ':' + f.status + ':' + (f.days <= 0 ? 0 : f.days <= 1 ? 1 : 7) }));
        });
        if (cs.mode !== 'engaged') {
          // 4) 나 홀로 + 위험 신호(기한 임박/초과) → 전문가에게 맡기기(인계) 제안
          var risky = out.some(function (f) { return f.case_id === cs.case_id && f.kind === 'deadline' && f.severity >= 3; });
          if (risky && cs.state === 'active') out.push(Object.assign({}, base, { kind: 'opportunity', sub: 'handover', severity: 1, key: 'handover:' + cs.case_id }));
          continue;
        }
        var h = await store.history(cs.case_id), keys = cs.keys || null;
        // 2) 상대의 종료 요청이 내 응답을 기다림 / 종료 전 정산 필요
        if (cs.state === 'closing') {
          var by = keys ? await Y().closeRequestedBy(h, keys) : null;
          if (by && by !== cs.my_side) out.push(Object.assign({}, base, { kind: 'action_needed', sub: 'close_response', severity: 2, key: 'close:' + cs.case_id + ':' + h.length }));
        }
        // 3) 미결제 청구서
        if (keys && (cs.state === 'active' || cs.state === 'closing')) {
          var unpaid = await Y().unpaidInvoices(h, keys);
          if (unpaid > 0) out.push(Object.assign({}, base, { kind: 'action_needed', sub: cs.my_side === 'consumer' ? 'pay_invoice' : 'settle_invoice', count: unpaid, severity: cs.state === 'closing' ? 2 : 1, key: 'invoice:' + cs.case_id + ':' + unpaid }));
        }
        // 5) 제안 후 7일 넘게 합의 없음
        if (cs.state === 'proposed' && cs.created_at && Date.parse(nowIso) - Date.parse(cs.created_at) > 7 * DAY) out.push(Object.assign({}, base, { kind: 'suggest', sub: 'stale_proposal', severity: 1, key: 'stale:' + cs.case_id }));
        // 6) 상대가 기록한 소통의 확인 요청이 3일 넘게 대기(서명 키를 아는 경우)
        if (keys) {
          for (var k = 0; k < h.length; k++) {
            var e = h[k];
            if (e.type !== 'comm' || !e.payload || e.payload.recorder_side === cs.my_side || Date.parse(nowIso) - Date.parse(e.at) < 3 * DAY) continue;
            if ((await Y().effectiveConfirmStatus(h, e.seq, keys)) === 'unconfirmed') out.push(Object.assign({}, base, { kind: 'action_needed', sub: 'confirm_comm', severity: 1, key: 'comm:' + cs.case_id + ':' + e.seq }));
          }
        }
      }
      return out;
    }

    // 소통 이력 6하 초안(자동 수집 이벤트 → 사용자 확인 전 초안). 저장은 호출자가 확인 뒤에 한다.
    function draftCommunication(ev, recorderSide) {
      var chmap = { mail: 'mail', doc: 'document', gdc: 'other', schedule: 'other' };
      return C().buildCommunication({ recorder_side: recorderSide, who: ev.who || '본인', with: ev.with || '(미상)', occurred_at: ev.at, channel: chmap[ev.source] || 'other',
        how: 'ai_assisted', summary: ev.what, purpose: 'info', place: null }, now());
    }

    // ── A4: 알림 결정 ───────────────────────────────────────
    // 같은 key 는 같은 날 한 번만. severity ≤2 는 하루 DAILY_CAP 건까지(초과분은 다음 날로 미룸). severity 3 은 억제 불가.
    async function tick(nowIso) {
      nowIso = nowIso || now();
      var findings = await scan(nowIso), entries = await ledger.entries(), today = day(nowIso);
      var shownToday = entries.filter(function (e) { return e.type === 'notice' && day(e.at) === today; });
      // 같은 단계(key)의 알림은 한 번만(severity ≤2). severity 3 은 하루에 한 번씩 계속 알린다(억제 불가).
      var seenKeys = {}, seenToday = {};
      entries.forEach(function (e) { if (e.type === 'notice') { seenKeys[e.payload.key] = true; if (day(e.at) === today) seenToday[e.payload.key] = true; } });
      var capLeft = DAILY_CAP - shownToday.filter(function (e) { return e.payload.severity <= 2; }).length;
      findings.sort(function (a, b) { return b.severity - a.severity; });
      var show = [], deferred = [];
      for (var i = 0; i < findings.length; i++) {
        var f = findings[i];
        if (f.severity >= 3) { if (!seenToday[f.key]) show.push(f); continue; }
        if (seenKeys[f.key]) continue;
        if (capLeft > 0) { show.push(f); capLeft--; } else deferred.push(f);
      }
      for (var j = 0; j < show.length; j++) {
        var s = show[j];
        await ledger.record('notice', { key: s.key, kind: s.kind, sub: s.sub || null, severity: s.severity, case_ref: await C().sha256Hex('case:' + s.case_id) }, 'internal');
      }
      return { shown: show, deferred: deferred };
    }

    // ── [ctx] 신호 줄 (AC-PRO-CORE §ASSIST 가 소비) ───────────────────────
    // gate: 사용자가 지금 하려는 행위의 Gate 결과(있으면). 그 외에는 이번 tick 에서 새로 보여 줄 Finding.
    function ctxLines(tickResult, gate, action) {
      var lines = [], PROF = { law: '변호사', tax: '세무사·회계사', health: '의사·약사', contract: '변호사', ip: '변리사', labor: '공인노무사', real_estate: '공인중개사·법무사' };
      if (gate) {
        var dom = gate.domain || (action && action.domain);
        lines.push('점검:' + gate.result + (gate.result === 'ADVISE_HUMAN' ? '(분야=' + clean(PROF[dom] || '해당 분야 전문가', 12) + ')' : ''));
        if (gate.result === 'BLOCK' || gate.result === 'WARN') gate.violations.slice(0, 2).forEach(function (v) { lines.push('점검사유:' + clean(v.message, 50)); });
      }
      (tickResult ? tickResult.shown : []).forEach(function (f) {
        if (f.kind === 'deadline') lines.push('기한:' + clean(f.label, 24) + (f.status === 'overdue' ? ' 초과' : ' D-' + f.days) + '(' + clean(f.title, 16) + ')');
        else if (f.sub === 'handover') lines.push('제안:전문가에게 맡기기 검토(' + clean(f.title, 16) + ')');
        else if (f.sub === 'close_response') lines.push('확인요청:상대의 종료 요청(' + clean(f.title, 16) + ')');
        else if (f.sub === 'pay_invoice' || f.sub === 'settle_invoice') lines.push('확인요청:미결제 청구서 ' + f.count + '건(' + clean(f.title, 16) + ')');
        else if (f.sub === 'confirm_comm') lines.push('확인요청:상대가 기록한 소통 확인(' + clean(f.title, 16) + ')');
        else if (f.sub === 'stale_proposal') lines.push('제안:합의 대기 7일 경과(' + clean(f.title, 16) + ')');
      });
      return lines.slice(0, MAX_CTX_LINES);
    }

    return { scan: scan, tick: tick, ctxLines: ctxLines, draftCommunication: draftCommunication };
  }

  root.AssistantRuntime = { Runtime: Runtime, clean: clean, DAILY_CAP: DAILY_CAP };
})(typeof window !== 'undefined' ? window : globalThis);
