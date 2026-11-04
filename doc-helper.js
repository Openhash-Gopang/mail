/**
 * doc-helper.js — 나비웹 "서류 작성 도우미" 인계의 순수 로직 (2026-11-04, 주피터 지시)
 *
 * 흐름: 서류 화면이 열리면 대화창 주도권이 AC-PRO-CORE 에서 "서류 작성 도우미" SP(inline:doc:…)로 넘어간다(desktop.html _docChatEnsure).
 *  도우미 SP 는 첨부서류 발급을 나비웹 도우미(Chrome 확장)에게 맡기고([AGENT_TASK]), 사용자의 몫은 로그인·본인인증·결제뿐이다.
 *  서류 작성이 끝나면 주도권을 AC 에게 돌려준다(작성 완료 저장 · 사용자 취소 · [DOC_HANDBACK]).
 * 이 파일은 DOM 이 없는 판정·문장 생성만 맡는다 — 확장 호출·postMessage·화면 전환은 desktop.html 이 한다.
 *
 * 첨부서류 상태: none(없음) · queued(도우미에 맡김, 시작 대기) · pending(진행 중) · sent(법원 등으로 전송 완료) · received(서류에 넣음) · failed(실패)
 *
 * 전역: window.DocHelper = { matchLabel, applySlot, pendingLabels, attachCtx, planTask, handBackDecision, handBackSummary, SUFFIX }
 */
(function (root) {
  'use strict';
  var STATE_TEXT = {
    none: '없음', queued: '맡김 — 사용자가 도우미를 시작하기를 기다림', pending: '진행 중', sent: '전송 완료',
    received: '받음(서류에 넣음)', failed: '실패', up: '파일 올림',
  };
  var OPEN = { queued: 1, pending: 1 };                 // 아직 끝나지 않은 일
  var NO_RETRY = { queued: 1, pending: 1, sent: 1, received: 1 };   // 다시 맡기지 않는 상태
  var LABEL_MAX = 80, NOTE_MAX = 80, GOAL_MAX = 500;
  /** 도우미가 시킨 일 뒤에 항상 붙는 경계 — 인증·결제는 사용자 몫이고 도우미는 그 앞에서 멈춘다. */
  var SUFFIX = ' 로그인·공동인증서·본인인증·결제는 사용자가 직접 합니다. 그 단계에서 멈추고 사용자에게 넘겨 주세요. 결제 확정·제출은 하지 마세요.';
  // 목표 문장에 들어가면 안 되는 것: 주민등록번호 모양, 비밀번호·계좌·카드·인증서 정보를 가리키는 말.
  var SECRET_RE = /\d{6}\s*-?\s*[1-8]\d{6}|비밀번호|비번|패스워드|password|계좌\s*번호|카드\s*번호|보안\s*카드|OTP|인증서\s*(?:파일|암호)/i;

  function oneLine(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
  function key(t) { return String(t == null ? '' : t).replace(/^[\d.)\s]+/, '').replace(/[\s_\-().\[\]·,]/g, '').toLowerCase(); }

  /** 서류 화면의 첨부서류 항목 중 label 에 해당하는 것(정확 → 정규화 일치 → 한쪽이 다른 쪽을 포함하며 후보가 하나뿐일 때). 없으면 null. */
  function matchLabel(label, labels) {
    var want = key(label), ls = Array.isArray(labels) ? labels : [], i, k;
    if (want.length < 2) return null;
    for (i = 0; i < ls.length; i++) if (ls[i] === label) return ls[i];
    for (i = 0; i < ls.length; i++) if (key(ls[i]) === want) return ls[i];
    var hit = ls.filter(function (l) { k = key(l); return k.length >= 2 && (k.indexOf(want) >= 0 || want.indexOf(k) >= 0); });
    return hit.length === 1 ? hit[0] : null;
  }

  /** 상태표를 바꾸지 않고 한 항목만 갱신한 새 표를 돌려준다. 모르는 상태는 무시. */
  function applySlot(slots, label, state, note) {
    var out = {}, k, l = oneLine(label, LABEL_MAX);
    for (k in (slots || {})) if (Object.prototype.hasOwnProperty.call(slots, k)) out[k] = slots[k];
    if (!l || !Object.prototype.hasOwnProperty.call(STATE_TEXT, state) || state === 'none' || state === 'up') return out;
    out[l] = { state: state, note: oneLine(note, NOTE_MAX) };
    return out;
  }
  function pendingLabels(slots) {
    var out = [], k; for (k in (slots || {})) if (slots[k] && OPEN[slots[k].state]) out.push(k); return out;
  }

  function stateTextOf(label, slots, up) {
    if (up) return STATE_TEXT.up;
    var s = slots && slots[label];
    if (!s) return STATE_TEXT.none;
    return (STATE_TEXT[s.state] || STATE_TEXT.none) + (s.state === 'failed' && s.note ? ' — ' + s.note : '');
  }

  /**
   * 도우미 SP 가 "지금 화면" 블록으로 읽는 첨부서류·도우미·저장 상태 문단.
   * o: { attach: [{l, up}] | null, slots, agentOn, saved, planFor(label) → bool }
   * attach 가 null 이면 화면(서류 페이지)이 목록을 알려 주지 않은 것이다(옛 서류 페이지).
   */
  function attachCtx(o) {
    o = o || {}; var lines = [], a = Array.isArray(o.attach) ? o.attach : null;
    if (a) {
      lines.push('첨부서류 ' + a.length + '건:' + (a.length ? '' : ' (없음)'));
      a.slice(0, 20).forEach(function (x) {
        var l = oneLine(x && x.l, LABEL_MAX); if (!l) return;
        lines.push('- ' + l + ': ' + stateTextOf(l, o.slots, !!(x && x.up)) + (o.planFor && o.planFor(l) ? ' [전용 절차]' : ''));
      });
    } else {
      lines.push('첨부서류: 화면이 목록을 알려 주지 않았다 — 필요한 첨부서류는 사용자 말과 서류 종류로 확인하고, 항목 이름은 사용자 말 그대로 쓴다.');
      var ks = Object.keys(o.slots || {});
      ks.forEach(function (l) { lines.push('- ' + l + ': ' + stateTextOf(l, o.slots, false)); });
    }
    lines.push('나비웹 도우미: ' + (o.agentOn ? '연결됨' : '연결 안 됨'));
    lines.push('작성 완료 저장: ' + (o.saved ? '함' : '안 함'));
    return lines.join('\n');
  }

  /**
   * [AGENT_TASK] 한 건을 확장에 넘길 일(job)로 바꾼다. 맡길 수 없으면 { ok:false, code, msg }.
   * task: { slot, goal } · o: { agentOn, labels, slots, slotPlan(label) → {playbook, goal}|null }
   * 전용 절차(예: 법인등기사항증명서)가 있는 항목은 그 절차의 문구 뒤에 SP 가 쓴 goal(법인 이름)을 붙인다.
   */
  function planTask(task, o) {
    o = o || {}; var slot = oneLine(task && task.slot, LABEL_MAX), goal = oneLine(task && task.goal, 300);
    if (!slot || !goal) return { ok: false, code: 'empty', msg: '' };
    if (!o.agentOn) return { ok: false, code: 'no-agent', msg: '나비웹 도우미(확장 프로그램)가 연결돼 있지 않아 맡기지 못했습니다. 확장 프로그램을 켠 뒤 다시 요청해 주세요.' };
    if (SECRET_RE.test(slot) || SECRET_RE.test(goal)) return { ok: false, code: 'secret', msg: '비밀번호·주민등록번호 등 민감한 정보가 들어 있어 맡기지 않았습니다. 그런 정보는 도우미가 아니라 사용자가 해당 사이트에서 직접 입력합니다.' };
    var label = matchLabel(slot, o.labels) || slot;
    var cur = o.slots && o.slots[label];
    if (cur && NO_RETRY[cur.state]) return { ok: false, code: 'dup', msg: '“' + label + '” 항목은 이미 맡겼습니다.' };
    var plan = null; try { plan = o.slotPlan ? o.slotPlan(label) : null; } catch (e) { plan = null; }
    var full = ((plan && plan.goal ? plan.goal : '') + goal + SUFFIX).slice(0, GOAL_MAX);
    return { ok: true, label: label, job: { playbook: plan && plan.playbook ? plan.playbook : '', goal: full, title: ('첨부서류 발급 — ' + label).slice(0, 60), slot: label } };
  }

  /**
   * 주도권 반납 요청([DOC_HANDBACK: reason=…])을 받아들일지. cancel 은 항상, complete 는 작성 완료로 저장한 뒤에만.
   * 사용자가 저장 버튼을 누르기 전에 SP 가 끝났다고 선언해 주도권을 놓아 버리는 일을 막는다.
   */
  function handBackDecision(reason, st) {
    if (reason === 'cancel') return { ok: true };
    if (reason === 'complete') {
      if (st && st.saved) return { ok: true };
      return { ok: false, msg: '아직 작성 완료로 저장하지 않으셨습니다. 서류 화면의 “작성 완료로 저장”을 누르신 뒤 마무리하겠습니다.' };
    }
    return { ok: false, msg: '' };
  }

  /** 주도권을 AC 에게 돌려줄 때 대화창에 한 번 보여 줄 요약(모델 호출 없음, 600자 이내). */
  function handBackSummary(o) {
    o = o || {}; var t = oneLine(o.title, 40), a = Array.isArray(o.attach) ? o.attach : null, slots = o.slots || {};
    var head = o.reason === 'cancel' ? (t ? '「' + t + '」 작성 도우미를 마쳤습니다.' : '서류 작성 도우미를 마쳤습니다.') : (t ? '「' + t + '」 작성을 마쳤습니다.' : '서류 작성을 마쳤습니다.');
    var parts = [head];
    if (a && a.length) {
      var rest = a.filter(function (x) { var l = oneLine(x && x.l, LABEL_MAX); return l && !(x && x.up) && !(slots[l] && slots[l].state === 'received'); }).map(function (x) { return oneLine(x.l, 30); });
      parts.push('첨부서류 ' + a.length + '건 중 ' + (a.length - rest.length) + '건을 서류에 넣었습니다.' + (rest.length ? ' 남은 것: ' + rest.slice(0, 3).join(', ') + (rest.length > 3 ? ' 외 ' + (rest.length - 3) + '건' : '') + '.' : ''));
    }
    var open = pendingLabels(slots);
    if (open.length) parts.push('도우미가 맡은 ' + open.length + '건은 브라우저에서 계속 진행됩니다.');
    if (o.reason !== 'cancel') parts.push('제출 안내가 필요하시면 말씀해 주세요.');
    return parts.join(' ').slice(0, 600);
  }

  var API = { matchLabel: matchLabel, applySlot: applySlot, pendingLabels: pendingLabels, attachCtx: attachCtx, planTask: planTask, handBackDecision: handBackDecision, handBackSummary: handBackSummary, SUFFIX: SUFFIX };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.DocHelper = API;
})(typeof window !== 'undefined' ? window : globalThis);
