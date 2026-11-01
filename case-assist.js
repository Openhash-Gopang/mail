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
    var extra = g.result === 'ADVISE_HUMAN' ? '나비웹은 특정 전문가를 추천하지 않습니다. 나비웹이나 인터넷에서 직접 찾아보실 수 있습니다.' : '';
    var rem = (g.violations || []).map(function (v) { return v.remedy; }).filter(Boolean).slice(0, 2).join(' ');
    var doc = typeof document !== 'undefined' ? document : null;
    if (!doc || !doc.body) return Promise.resolve(typeof confirm === 'function' ? confirm(notice.text + (rem ? '\n\n' + rem : '') + (extra ? '\n\n' + extra : '') + '\n\n그래도 진행할까요? (선택은 기록됩니다)') : false);
    return new Promise(function (resolve) {
      var ov = doc.createElement('div'); ov.className = 'cs-ask'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
      ov.style.cssText = 'position:fixed;inset:0;z-index:400;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:16px';
      var box = doc.createElement('div');
      box.style.cssText = 'max-width:420px;width:100%;background:var(--sur,var(--bg,#fff));color:var(--txt,#1a1d24);border:1px solid #e0b865;border-radius:12px;padding:16px;box-shadow:0 8px 30px rgba(0,0,0,.25);font-size:14.5px;line-height:1.55';
      function p(txt, st) { if (!txt) return; var e = doc.createElement('p'); e.style.cssText = 'margin:0 0 8px;' + (st || ''); e.textContent = txt; box.appendChild(e); }
      p(notice.text, 'font-weight:800'); p(rem); p(extra, 'color:var(--hint,#667);font-size:13.5px'); p('그래도 진행하시겠습니까? 선택은 이 기기에 기록됩니다.', 'color:var(--hint,#667);font-size:13px');
      var row = doc.createElement('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:10px';
      function done(v) { doc.removeEventListener('keydown', onKey, true); ov.remove(); resolve(v); }
      function onKey(ev) { if (ev.key === 'Escape') { ev.stopPropagation(); done(false); } }
      function btn(label, v, pri) { var b = doc.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute('data-ask', v ? 'continue' : 'hold');
        b.style.cssText = 'border:1px solid var(--pri,#0f8a78);border-radius:8px;padding:8px 14px;font-size:14px;font-weight:700;cursor:pointer;' + (pri ? 'background:var(--pri,#0f8a78);color:#fff' : 'background:transparent;color:var(--pri,#0f8a78)');
        b.onclick = function () { done(v); }; row.appendChild(b); return b; }
      var hold = btn('보류', false, true); btn('그대로 진행(기록됨)', true, false);
      box.appendChild(row); ov.appendChild(box); doc.body.appendChild(ov); doc.addEventListener('keydown', onKey, true);
      try { hold.focus(); } catch (_) {}   // 기본 선택은 안전한 쪽(보류)
    });
  }
  root.CaseAssist = { get: get, lines: lines, findings: findings, check: check, _reset: function () { inst = null; } };
  root.AssistantHost = { lines: lines };   // call-ai.js(hondi) 와 같은 이름의 공급자
})(typeof window !== 'undefined' ? window : globalThis);
