/* ═════════════════════════════════════════════════
   case-ui.js — 업무(Case) 화면: 맡은 일 · 맡긴 일 · 나 홀로  (M4 첫 조각)
   2026-11-01. desktop.html 의 사이드바 "업무" 묶음과 3개 패널(tab-caseprov/casecons/casesolo)을 그린다.
   - 기능 플래그: URL ?case=1 또는 localStorage kmail_case_ui=1 일 때만 메뉴가 보인다(기본 숨김).
   - 모든 기록은 이 기기의 PDV(IndexedDB hondi_case_store)에만 저장한다. 서버로는 해시만(큐에 쌓임).
   - 의존: case-core.js, case-invite.js, case-store.js (hondi 저장소가 원본 — 복사본).
   - 아직 없는 것(화면에 숨기지 않고 안내): 상대 응답 수신(우편함 서버), 초대 메일 자동 발송, 소비자 투영 동기화.
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var MODES = {
    caseprov: { label: '맡은 일', side: 'provider', blurb: '내가 서비스 제공자로 맡은 일' },
    casecons: { label: '맡긴 일', side: 'consumer', blurb: '내가 전문가에게 맡긴 일' },
    casesolo: { label: '나 홀로', side: 'self', solo: true, blurb: '내가 나 자신의 일을 직접 처리하는 일' },
  };
  var STATE = { proposed: '제안됨', agreed: '합의됨', active: '진행 중', on_hold: '보류', closing: '종료 협의 중', closed: '종료', archived: '보관', declined: '거절됨', expired: '만료' };
  var KIND = { case: '사건·건', transaction: '거래', event: '행사' };
  var PURPOSE = { info: '안내·정보', request: '요청', report: '보고', consult: '상담', agreement: '합의', payment: '결제', other: '기타' };
  var CHANNEL = { mail: '메일', chat: '채팅', phone: '전화', video: '화상', in_person: '대면', document: '서류', other: '기타' };
  var store = null, cur = {};

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function cfg() { return root.CASE_UI_CONFIG || {}; }
  function getStore() {
    if (!store) {
      var S = root.CaseStore;
      store = new S.CaseStore(cfg().adapter || S.IdbAdapter(), cfg());
    }
    return store;
  }
  function enabled() {
    try { if (/[?&]case=1\b/.test(location.search)) { localStorage.setItem('kmail_case_ui', '1'); return true; } return localStorage.getItem('kmail_case_ui') === '1'; }
    catch (_) { return /[?&]case=1\b/.test(location.search); }
  }
  function fmt(iso) { try { return new Date(iso).toLocaleString('ko-KR', { hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (_) { return iso; } }
  function newId() { return 'case-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function mineOf(name, cases) {
    var m = MODES[name];
    return cases.filter(function (c) { return m.solo ? c.mode === 'solo' : (c.mode === 'engaged' && c.my_side === m.side); });
  }

  // ── 목록 ───────────────────────────────────────────────
  async function renderList(name) {
    var p = $('tab-' + name), m = MODES[name]; if (!p) return;
    var cases = mineOf(name, await getStore().listCases()).sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
    p.innerHTML =
      '<div class="cs-head"><div><h2 class="cs-h">' + esc(m.label) + '</h2><div class="cs-sub">' + esc(m.blurb) + '</div></div>' +
      '<button class="cs-btn cs-pri" data-act="new">+ 새 일</button></div>' +
      '<div id="cs-form-' + name + '"></div>' +
      (cases.length ? '<div class="cs-list">' + cases.map(function (c) {
        return '<button class="cs-row" data-act="open" data-id="' + esc(c.case_id) + '"><span class="cs-title">' + esc(c.title) + '</span>' +
          '<span class="cs-meta">' + esc(KIND[c.kind] || c.kind) + '</span><span class="cs-badge cs-st-' + esc(c.state) + '">' + esc(STATE[c.state] || c.state) + '</span></button>';
      }).join('') + '</div>' : '<div class="cs-empty">아직 일이 없습니다. “+ 새 일”로 시작하세요.</div>') +
      '<div class="cs-note">기록은 이 기기에만 저장되며, 네트워크에는 해시만 기록됩니다.</div>';
    cur[name] = null;
  }

  function newForm(name) {
    var m = MODES[name], h = $('cs-form-' + name);
    h.innerHTML = '<div class="cs-card"><label>제목<input id="cs-f-title" maxlength="120" placeholder="예: ○○ 사건 / 무릎 치료"></label>' +
      '<label>종류<select id="cs-f-kind"><option value="case">사건·건</option><option value="transaction">거래</option><option value="event">행사</option></select></label>' +
      (m.solo ? '' : '<label>상대방 메일 주소 (초대권을 보낼 곳)<input id="cs-f-email" type="email" placeholder="client@example.com"></label>') +
      '<div class="cs-actions"><button class="cs-btn cs-pri" data-act="create">만들기</button><button class="cs-btn" data-act="cancel-new">취소</button></div>' +
      '<div id="cs-f-msg" class="cs-msg"></div></div>';
  }

  async function createFromForm(name) {
    var m = MODES[name], title = ($('cs-f-title').value || '').trim(), msg = $('cs-f-msg');
    if (!title) { msg.textContent = '제목을 입력하세요.'; return; }
    var id = newId(), s = getStore();
    var r = await s.createCase(m.solo ? { mode: 'solo', case_id: id, title: title, kind: $('cs-f-kind').value }
      : { case_id: id, title: title, kind: $('cs-f-kind').value, my_side: m.side });
    if (!r.ok) { msg.textContent = r.error || '실패'; return; }
    if (!m.solo) {
      var email = (($('cs-f-email') || {}).value || '').trim();
      if (email) {
        var inv = await root.CaseInvite.createInvitation({ case_id: id, inviter_id: cfg().userId || 'me', inviter_side: m.side, invitee_email: email });
        if (!inv.ok) { msg.textContent = inv.errors.join(', '); return; }
        await s.patchCase(id, { invitation: inv.invitation, invite_link: inv.link });
        await s.append(id, { type: 'invite_issued', actor_side: m.side, visibility: 'internal', payload: { token_hash: inv.invitation.token_hash, expires_at: inv.invitation.expires_at } });
      }
    }
    await openCase(name, id);
  }

  // ── 상세 ───────────────────────────────────────────────
  function entryHtml(e, mode) {
    var vis = mode.solo ? '' : '<span class="cs-vis cs-vis-' + esc(e.visibility) + '">' + (e.visibility === 'shared' ? '공유' : '내부') + '</span>';
    var body;
    if (e.type === 'comm') {
      var c = e.payload || {};
      body = '<b>소통</b> · ' + esc(CHANNEL[c.channel] || c.channel) + ' · ' + esc(c.who) + ' → ' + esc(c.with) +
        '<div class="cs-6h">언제 ' + esc(fmt(c.occurred_at)) + (c.place ? ' · 어디서 ' + esc(c.place) : '') + ' · 왜 ' + esc(PURPOSE[c.purpose] || c.purpose) +
        ' · ' + (c.how === 'manual' ? '직접 기록' : c.how === 'auto' ? '자동 수집' : 'AI 보조') + (c.confirm_status === 'unconfirmed' ? ' · <i>상대 미확인</i>' : '') + '</div>' +
        '<div>' + esc(c.summary) + '</div>';
    } else if (e.type === 'note') body = esc((e.payload || {}).text);
    else if (e.type.indexOf('state_') === 0) body = '상태 변경: ' + esc(STATE[e.payload.from] || e.payload.from) + ' → <b>' + esc(STATE[e.payload.to] || e.payload.to) + '</b>' + (e.payload.outcome ? ' · 결과: ' + esc(e.payload.outcome) : '');
    else if (e.type === 'invite_issued') body = '초대권 발행 (만료 ' + esc(fmt(e.payload.expires_at)) + ')';
    else body = esc(e.type);
    return '<div class="cs-ev"><div class="cs-ev-h"><span>#' + e.seq + ' · ' + esc(fmt(e.at)) + '</span>' + vis + '</div>' + body + '</div>';
  }

  async function openCase(name, id) {
    var s = getStore(), c = await s.getCase(id), m = MODES[name], p = $('tab-' + name);
    if (!c) { await renderList(name); return; }
    cur[name] = id;
    var h = await s.history(id), v = await s.verify(id);
    var tab = (cur[name + ':tab'] || 'all');
    var shown = h.filter(function (e) { return tab === 'all' || (tab === 'comm' && e.type === 'comm'); }).slice().reverse();
    var acts = '';
    if (m.solo) {
      if (c.state === 'active') acts = '<button class="cs-btn" data-act="tr" data-ev="hold">보류</button><button class="cs-btn" data-act="tr" data-ev="close_self">종료</button>';
      else if (c.state === 'on_hold') acts = '<button class="cs-btn" data-act="tr" data-ev="resume">재개</button><button class="cs-btn" data-act="tr" data-ev="close_self">종료</button>';
      else if (c.state === 'closed') acts = '<button class="cs-btn" data-act="tr" data-ev="archive">보관</button>';
    } else {
      if (c.state === 'active') acts = '<button class="cs-btn" data-act="tr" data-ev="hold">보류</button>';
      else if (c.state === 'on_hold') acts = '<button class="cs-btn" data-act="tr" data-ev="resume">재개</button>';
    }
    var pending = (await getStore().flushAnchors(0)).pending;
    p.innerHTML =
      '<div class="cs-head"><div><button class="cs-link" data-act="back">← ' + esc(m.label) + '</button><h2 class="cs-h">' + esc(c.title) + '</h2>' +
      '<div class="cs-sub">' + esc(KIND[c.kind] || c.kind) + ' · <span class="cs-badge cs-st-' + esc(c.state) + '">' + esc(STATE[c.state] || c.state) + '</span>' +
      ' · <span class="' + (v.ok ? 'cs-ok' : 'cs-bad') + '">' + (v.ok ? '기록 무결성 확인됨 (' + v.length + '건)' : '⚠ 기록 변조 의심 (#' + v.brokenAt + ')') + '</span>' +
      ' · 이 기기의 해시 전송 대기 ' + pending + '건</div></div><div class="cs-actions">' + acts + '</div></div>' +
      (!m.solo && c.state === 'proposed' ? '<div class="cs-card cs-warn">상대방의 확인이 있어야 합의가 완료됩니다.' +
        (c.invite_link ? ' 아래 초대 링크를 메일로 보내세요(자동 발송·응답 수신은 준비 중).<div class="cs-link-box"><input readonly id="cs-invite-link" value="' + esc(c.invite_link) + '"><button class="cs-btn" data-act="copy">복사</button></div>' +
          '<div class="cs-sub">링크 유효기간 14일 · 가입하면 가입 사실과 아이디, 메일 아이디가 전달되고 대화방이 열립니다.</div>' : '') + '</div>' : '') +
      '<div class="cs-tabs"><button class="cs-tab' + (tab === 'all' ? ' on' : '') + '" data-act="tab" data-t="all">진행 기록</button>' +
      '<button class="cs-tab' + (tab === 'comm' ? ' on' : '') + '" data-act="tab" data-t="comm">소통 이력</button></div>' +
      (c.state !== 'archived' ? '<div class="cs-card"><div class="cs-two">' +
        '<div><label>메모<textarea id="cs-note" rows="2" placeholder="진행 상황을 기록"></textarea></label>' +
        (m.solo ? '' : '<label class="cs-inl"><input type="checkbox" id="cs-note-shared"> 상대에게 공유</label>') +
        '<button class="cs-btn cs-pri" data-act="add-note">기록 추가</button></div>' +
        '<div><b>소통 기록</b> <span class="cs-sub">누가·누구와·언제·어디서·어떻게·무엇을·왜</span>' +
        '<div class="cs-grid"><input id="cs-c-who" placeholder="누가" value="' + esc(cfg().userName || '나') + '"><input id="cs-c-with" placeholder="누구와">' +
        '<input id="cs-c-at" type="datetime-local"><select id="cs-c-ch">' + Object.keys(CHANNEL).map(function (k) { return '<option value="' + k + '">' + CHANNEL[k] + '</option>'; }).join('') + '</select>' +
        '<input id="cs-c-place" placeholder="어디서(대면은 필수)"><select id="cs-c-pu">' + Object.keys(PURPOSE).map(function (k) { return '<option value="' + k + '">' + PURPOSE[k] + '</option>'; }).join('') + '</select></div>' +
        '<textarea id="cs-c-sum" rows="2" placeholder="무엇을(내용 요약)"></textarea>' +
        (m.solo ? '' : '<label class="cs-inl"><input type="checkbox" id="cs-c-shared"> 상대에게 공유</label>') +
        '<button class="cs-btn" data-act="add-comm">소통 기록 추가</button><div id="cs-c-msg" class="cs-msg"></div></div></div></div>' : '') +
      '<div class="cs-tl">' + (shown.length ? shown.map(function (e) { return entryHtml(e, m); }).join('') : '<div class="cs-empty">기록이 없습니다.</div>') + '</div>';
  }

  async function onClick(name, ev) {
    var t = ev.target.closest('[data-act]'); if (!t) return;
    var act = t.getAttribute('data-act'), s = getStore(), m = MODES[name], id = cur[name];
    if (act === 'new') newForm(name);
    else if (act === 'cancel-new') $('cs-form-' + name).innerHTML = '';
    else if (act === 'create') await createFromForm(name);
    else if (act === 'open') { cur[name + ':tab'] = 'all'; await openCase(name, t.getAttribute('data-id')); }
    else if (act === 'back') await renderList(name);
    else if (act === 'tab') { cur[name + ':tab'] = t.getAttribute('data-t'); await openCase(name, id); }
    else if (act === 'copy') { var i = $('cs-invite-link'); i.select(); try { document.execCommand('copy'); t.textContent = '복사됨'; } catch (_) {} }
    else if (act === 'add-note') {
      var txt = ($('cs-note').value || '').trim(); if (!txt) return;
      var sh = $('cs-note-shared');
      await s.append(id, { type: 'note', actor_side: m.side, visibility: sh && sh.checked ? 'shared' : 'internal', payload: { text: txt } });
      await openCase(name, id);
    } else if (act === 'add-comm') {
      var at = $('cs-c-at').value ? new Date($('cs-c-at').value).toISOString() : new Date().toISOString();
      var r = root.CaseCore.buildCommunication({ recorder_side: m.side, who: $('cs-c-who').value, with: $('cs-c-with').value, occurred_at: at,
        channel: $('cs-c-ch').value, place: $('cs-c-place').value, how: 'manual', summary: $('cs-c-sum').value, purpose: $('cs-c-pu').value });
      if (!r.ok) { $('cs-c-msg').textContent = r.errors.join(' · '); return; }
      var sh2 = $('cs-c-shared');
      await s.append(id, { type: 'comm', actor_side: m.side, visibility: sh2 && sh2.checked ? 'shared' : 'internal', payload: r.value });
      cur[name + ':tab'] = 'comm'; await openCase(name, id);
    } else if (act === 'tr') {
      var evn = t.getAttribute('data-ev'), ctx = { side: m.side }, entry = {};
      if (evn === 'close_self') {
        var o = (typeof prompt === 'function') ? prompt('결과를 한 줄로 기록하세요 (예: 승소 / 완치 / 취하)') : null;
        if (!o) return; ctx.outcome = o; entry.payload = { outcome: o };
      }
      var rr = await s.applyTransition(id, evn, ctx, Object.assign({ visibility: m.solo ? 'internal' : 'shared' }, entry));
      if (rr.ok && entry.payload) { /* outcome 은 payload 에 from/to 와 함께 저장 */ }
      await openCase(name, id);
    }
  }

  function show(name) {
    if (!MODES[name]) return;
    var p = $('tab-' + name); if (!p) return;
    if (!p.__csBound) { p.__csBound = true; p.addEventListener('click', function (ev) { onClick(name, ev); }); }
    return cur[name] ? openCase(name, cur[name]) : renderList(name);
  }
  function applyFlag() { var g = $('side-group-case'); if (g) g.hidden = !enabled(); }

  root.CaseUI = { show: show, enabled: enabled, applyFlag: applyFlag, MODES: MODES, _store: getStore };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyFlag); else applyFlag();
  }
})(typeof window !== 'undefined' ? window : globalThis);
