/* ═════════════════════════════════════════════════
   assistant-host.js — 나만의 AI 비서를 화면에 붙이는 호스트(DOM 없음, 결정론) — A5, 2026-11-01
   · 기본 규칙팩(제품에 포함된 "일 처리 규칙")을 이 기기 키로 서명·검증해 쓴다. 외부 발행자 팩은 trusted 에 키를 넣어야만 들어온다.
   · lines(): 이번 대화 턴에 붙일 [ctx] 신호 줄(코드가 계산한 사실만). check()/record(): 화면의 행위(합의 서명·공유·종료) 앞 점검과 증명.
   · findings(): 지금 열려 있는 일(기한·응답 대기·청구서…) 전체 — 알림 패널용. 알림은 사용자 PDV(원장)에만 남는다.
   ⚠ 법률·세무 등 분야 규칙팩(예: 민사 기한)은 여기에 없다 — 법률 검토를 거쳐 발행자 서명으로 따로 배포한다.
      분야 팩이 없는 고위험 행위는 gate 가 ADVISE_HUMAN("인간 전문가의 조언을 구하시길 권합니다", 특정인 추천 없음)으로 돌려준다.
   의존: case-core, case-sync, case-store, assistant-core, assistant-rules, assistant-runtime
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var R = function () { return root.AssistantRules; }, A = function () { return root.AssistantCore; }, RT = function () { return root.AssistantRuntime; };

  // 일 처리 규칙(domain:'common') — 어떤 분야의 일에도 적용되는, 제품 자체의 규칙만 담는다.
  var BUILTIN = [{
    id: 'hondi-case-process', version: '1.0.0', domain: 'common', jurisdiction: 'KR', effective_from: '2026-01-01T00:00:00.000Z',
    publisher: { id: 'device', pub: '' },
    rules: [
      { id: 'process.peer_key_unverified', actions: ['case.agree'], severity: 2,
        violation_when: { op: 'not', args: [{ var: 'peer_fp_verified' }] },
        message: '상대의 서명 키 지문을 대조하지 않았습니다.', remedy: '전화나 대면으로 상대와 키 지문이 같은지 확인한 뒤 “지문 확인함”을 눌러 두면 가장 안전합니다.' },
      { id: 'process.sensitive_in_shared', actions: ['case.share'], severity: 2,
        violation_when: { var: 'has_sensitive' },
        message: '상대에게 공유하려는 내용에 주민등록번호·카드번호처럼 보이는 값이 있습니다.', remedy: '꼭 필요한 경우가 아니면 지우고 보내세요. 공유한 내용은 상대 기기에도 남습니다.' },
      { id: 'process.close_unpaid', actions: ['case.close'], severity: 3, blocking: true,
        violation_when: { op: 'gt', args: [{ var: 'unpaid_invoices' }, 0] },
        message: '미결제 청구서가 있어 종료할 수 없습니다.', remedy: '청구서를 정산(또는 취소)한 뒤 다시 진행하세요.' },
    ],
  }];

  var RRN = /\b\d{6}[-\s]?[1-8]\d{6}\b/, CARD = /\b(?:\d{4}[-\s]?){3}\d{4}\b/;
  function hasSensitive(text) { var t = String(text == null ? '' : text); return RRN.test(t) || CARD.test(t); }

  // 알림 패널용 한국어 한 줄(코드가 만든 문장 — 사용자·상대가 쓴 제목은 RT.clean 으로 정리해 끼운다)
  function describe(f) {
    var t = f.title ? '「' + f.title + '」 ' : '';
    if (f.kind === 'deadline') return t + f.label + (f.status === 'overdue' ? ' 기한이 지났습니다(' + Math.abs(f.days) + '일 경과)' : ' 기한까지 ' + (f.days <= 0 ? '오늘입니다' : f.days + '일 남았습니다'));
    if (f.sub === 'handover') return t + '기한이 임박하거나 지났습니다. 인간 전문가(예: 변호사)에게 맡기는 것을 검토해 보세요.';
    if (f.sub === 'close_response') return t + '상대가 종료를 요청했습니다. 동의·이의·보류 중 하나를 골라 주세요.';
    if (f.sub === 'pay_invoice') return t + '결제하지 않은 청구서가 ' + f.count + '건 있습니다.';
    if (f.sub === 'settle_invoice') return t + '아직 정산되지 않은 청구서가 ' + f.count + '건 있습니다.';
    if (f.sub === 'confirm_comm') return t + '상대가 기록한 소통의 확인이 3일 넘게 대기 중입니다.';
    if (f.sub === 'stale_proposal') return t + '제안한 지 7일이 넘었는데 합의가 없습니다. 상대에게 확인해 보세요.';
    return t + (f.sub || f.kind);
  }

  // o: { store, identity, now?:()=>iso, trusted?:[pub], packs?:[서명된 외부 팩] }
  function create(o) {
    var store = o.store, identity = o.identity, now = o.now || function () { return new Date().toISOString(); };
    var ledger = A().Ledger(store), rt = RT().Runtime({ store: store, ledger: ledger, now: now });
    var loaded = null;

    async function init() {
      var trusted = [identity.pub].concat(o.trusted || []), cands = [];
      for (var i = 0; i < BUILTIN.length; i++) cands.push(await R().signPack(identity, BUILTIN[i]));
      cands = cands.concat(o.packs || []);
      loaded = await R().loadPacks(cands, trusted, now());
      return loaded;
    }
    async function ready() { if (!loaded) await init(); return loaded; }

    // 이번 대화 턴의 신호 줄. 같은 알림은 한 번만 나온다(tick 의 중복·상한 규칙).
    async function lines() { await ready(); var t = await rt.tick(now()); return rt.ctxLines(t); }

    // 지금 열려 있는 일 전체(알림 패널). severity 높은 순.
    async function findings() {
      var f = await rt.scan(now());
      f.sort(function (a, b) { return b.severity - a.severity || (a.days == null ? 1e9 : a.days) - (b.days == null ? 1e9 : b.days); });
      return f.map(function (x) { return Object.assign({}, x, { text: describe(x) }); });
    }

    // 행위 앞 점검. action: { type:'case.agree|case.share|case.close', effect, domain?, ref? }, ctx: 규칙이 읽는 값(없는 값은 넣지 않는다 = 미평가)
    async function check(action, ctx) {
      var l = await ready(), g = await R().gate(action, ctx, l.packs, now());
      return { g: g, notice: R().buildNotice(g, action), needs_decision: g.result === 'WARN' || g.result === 'ADVISE_HUMAN', blocked: g.result === 'BLOCK' };
    }
    // 결과와 사용자 선택을 원장에 증명으로 남긴다(입력은 해시만).
    async function record(action, ctx, g, decision) { return R().attest(ledger, action, ctx, g, decision || null, now()); }

    return { init: init, lines: lines, findings: findings, check: check, record: record, ledger: ledger, runtime: rt, _loaded: function () { return loaded; } };
  }

  root.AssistantHostLib = { create: create, hasSensitive: hasSensitive, describe: describe, BUILTIN: BUILTIN };
})(typeof window !== 'undefined' ? window : globalThis);
