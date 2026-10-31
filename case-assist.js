/* ═════════════════════════════════════════════════
   case-assist.js — K-Mail 화면의 나만의 AI 비서 연결 (A5, 2026-11-01)
   · 비서 호스트(assistant-host.js)를 이 기기의 CaseStore·서명 키로 만든다(원장·알림 기록은 이 기기 PDV 에만).
   · lines(): 메인 대화(/kmail/assist) 턴에 붙일 점검 신호 줄. 로그인·키 준비 전이거나 실패하면 빈 배열 — 비서가 꺼져 있어도 대화는 그대로 동작한다.
   · check()/finish(): 합의 서명·공유·종료 앞 점검과 선택 기록. 사용자는 WARN/전문가 권유를 보고 "그대로 진행(기록됨)"을 고를 수 있고, BLOCK 은 진행하지 않는다.
   의존: assistant-*.js, case-host.js, case-ui.js(_store)
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var inst = null;
  async function get() {
    if (inst) return inst;
    var H = root.CaseHost, UI = root.CaseUI, L = root.AssistantHostLib;
    if (!H || !UI || !L) return null;
    var local = await H.initLocal();
    inst = L.create({ store: UI._store(), identity: local.identity });
    await inst.init();
    return inst;
  }
  async function lines() { try { if (root.CaseUI && !root.CaseUI.enabled()) return []; var h = await get(); return h ? await h.lines() : []; } catch (_) { return []; } }
  async function findings() { try { if (root.CaseUI && !root.CaseUI.enabled()) return []; var h = await get(); return h ? await h.findings() : []; } catch (_) { return []; } }

  // 행위 앞 점검 → { proceed:boolean, g, notice }. ask(notice, g) 는 WARN/ADVISE_HUMAN 일 때 사용자 선택을 받는다(기본: confirm 창).
  async function check(action, ctx, ask) {
    var h = await get(); if (!h) return { proceed: true, skipped: true };
    var c = await h.check(action, ctx), choice = 'auto';
    if (c.blocked) { await h.record(action, ctx, c.g, { choice: 'blocked' }); return { proceed: false, g: c.g, notice: c.notice, blocked: true }; }
    if (c.needs_decision) {
      var ok = await (ask || defaultAsk)(c.notice, c.g);
      choice = ok ? 'continue' : 'hold';
      await h.record(action, ctx, c.g, { choice: choice });
      return { proceed: !!ok, g: c.g, notice: c.notice };
    }
    await h.record(action, ctx, c.g, null);
    return { proceed: true, g: c.g, notice: c.notice };
  }
  function defaultAsk(notice, g) {
    var extra = g.result === 'ADVISE_HUMAN' ? '\n\n나비웹은 특정 전문가를 추천하지 않습니다. 나비웹이나 인터넷에서 직접 찾아보실 수 있습니다.' : '';
    var rem = (g.violations || []).map(function (v) { return v.remedy; }).filter(Boolean).slice(0, 2).join('\n');
    return typeof confirm === 'function' ? confirm(notice.text + (rem ? '\n\n' + rem : '') + extra + '\n\n그래도 진행할까요? (선택은 기록됩니다)') : false;
  }
  root.CaseAssist = { get: get, lines: lines, findings: findings, check: check, _reset: function () { inst = null; } };
  root.AssistantHost = { lines: lines };   // call-ai.js(hondi) 와 같은 이름의 공급자
})(typeof window !== 'undefined' ? window : globalThis);
