/* ═════════════════════════════════════════════════
   case-ui.js — 업무(Case) 화면: 맡은 일 · 맡긴 일 · 나 홀로  (M4 첫 조각)
   2026-11-01. desktop.html 의 사이드바 "업무" 묶음과 3개 패널(tab-caseprov/casecons/casesolo)을 그린다.
   - 기능 플래그: URL ?case=1 또는 localStorage kmail_case_ui=1 일 때만 메뉴가 보인다(기본 숨김).
   - 모든 기록은 이 기기의 PDV(IndexedDB hondi_case_store)에만 저장한다. 서버로는 해시만(큐에 쌓임).
   - 의존: case-core.js, case-invite.js, case-store.js (hondi 저장소가 원본 — 복사본).
   - 2026-11-01(S5 후반): case-host.js 와 연결 — 키 지문, 합의 확인·성립, 종료 요청·응답, 우편함 새로 고침(60초 자동), 공유 항목 전송.
   - 아직 없는 것(화면에 숨기지 않고 안내): 초대 메일 자동 발송, 초대받은 쪽(가입 후)의 일 생성 화면(naviweb.kr 가입 화면과 함께).
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
  // 초대 링크(?inv=토큰)로 들어오면 토큰을 이 탭에만 기억해 로그인 과정을 거쳐도 잃지 않는다.
  function invToken() {
    var m = (typeof location !== 'undefined' && location.search || '').match(/[?&]inv=([^&#]+)/);
    try { if (m) sessionStorage.setItem('case_inv', decodeURIComponent(m[1])); return sessionStorage.getItem('case_inv') || ''; }
    catch (_) { return m ? decodeURIComponent(m[1]) : ''; }
  }
  function enabled() {
    if (invToken()) return true;   // 초대 링크로 들어온 사람은 업무 메뉴가 보여야 한다
    try { if (/[?&]case=1\b/.test(location.search)) { localStorage.setItem('kmail_case_ui', '1'); return true; } return localStorage.getItem('kmail_case_ui') === '1'; }
    catch (_) { return /[?&]case=1\b/.test(location.search); }
  }
  function fmt(iso) { try { return new Date(iso).toLocaleString('ko-KR', { hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (_) { return iso; } }
  function host() { return root.CaseHost || null; }
  function proposalOf(c) { return { case_id: c.case_id, title: c.title, kind: c.kind }; }
  var ERR = { INVITE_NOT_FOUND: '초대를 찾을 수 없습니다(만료되었거나 잘못된 링크)', INVITE_EXPIRED: '만료된 초대입니다', INVITE_REVOKED: '초대한 분이 취소한 초대입니다', INVITE_USED: '이미 사용된 초대입니다', SELF_INVITE: '내가 보낸 초대는 수락할 수 없습니다', NO_MAIL_ID: '메일 아이디를 먼저 만들어 주세요(설정)', NO_MAILER: '메일 발송을 쓸 수 없는 화면입니다', SEND_FAILED: '메일 발송 실패', NO_PEER: '상대가 아직 가입하지 않았습니다', KEY_CHANGED: '상대의 키가 바뀌었습니다 — 상대와 직접 확인하기 전에는 진행하지 않습니다', BAD_KEY_SIGNATURE: '상대 키 서명이 올바르지 않습니다', KEYS_REQUIRED: '키 교환 전입니다', FROM_MISMATCH: '로그인 정보가 맞지 않습니다', NO_RELATION: '초대·가입으로 연결된 상대가 아닙니다', BLOCKED: '차단된 관계입니다' };
  function errText(r) { return (r && (ERR[r.code] || r.error || r.message || r.code)) || '실패'; }
  // 맡은 일/맡긴 일의 변경은 만든 뒤 바로 상대에게 보낸다(실패하면 대기열에 남아 다음 새로 고침 때 다시 보낸다).
  async function pushOut(id, events) {
    var H = host(); if (!H) return { ok: true, sent: 0 };
    try { if (events && events.length) await H.enqueue(id, events); return await H.flush(id); } catch (e) { return { ok: false, code: 'OFFLINE', error: e.message }; }
  }
  function assist() { return root.CaseAssist || null; }
  // 행위 앞 점검(비서). 꺼져 있거나 실패하면 그대로 진행한다. BLOCK 이면 사유를 보여 주고 중단.
  async function gate(name, action, ctx) {
    var A = assist(); if (!A) return true;
    var r; try { r = await A.check(action, ctx); } catch (_) { return true; }
    if (r.blocked) { var el = $('cs-sync-msg') || $('cs-c-msg'); var t = (r.notice && r.notice.text) || '진행할 수 없습니다.'; if (el) { el.style.color = ''; el.textContent = t; } else if (typeof alert === 'function') alert(t); }
    return r.proceed;
  }
  async function unpaidOf(c, h) { try { if (c.mode === 'solo') return 0; if (c.mode !== 'engaged' || !c.keys || !root.CaseSync) return undefined; var n = await root.CaseSync.unpaidInvoices(h, c.keys); return Number.isInteger(n) ? n : undefined; } catch (_) { return undefined; } }
  function hasSens(t) { return !!(root.AssistantHostLib && root.AssistantHostLib.hasSensitive(t)); }
  function newId() { return 'case-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function mineOf(name, cases) {
    var m = MODES[name];
    return cases.filter(function (c) { return m.solo ? c.mode === 'solo' : (c.mode === 'engaged' && c.my_side === m.side); });
  }

  // ── 목록 ───────────────────────────────────────────────
  // 나비 비서 알림: 지금 열려 있는 일의 기한·응답 대기·청구서를 코드가 계산한 한 줄로 보여 준다(모델 없음, 이 기기 안에서만).
  async function notesHtml() {
    var A = assist(); if (!A) return '';
    var f = []; try { f = await A.findings(); } catch (_) {}
    if (!f.length) return '';
    return '<div class="cs-card cs-notes"><b>나비 비서 알림</b>' + f.slice(0, 8).map(function (x) { return '<div class="cs-note-row' + (x.severity >= 3 ? ' cs-bad' : '') + '">' + esc(x.text) + '</div>'; }).join('') +
      '<div class="cs-sub">이 기기의 기록에서 계산한 알림입니다. 법적 결과를 보장하지 않으며, 중요한 판단은 인간 전문가의 조언을 구하세요.</div></div>';
  }
  async function renderList(name) {
    var p = $('tab-' + name), m = MODES[name]; if (!p) return;
    var cases = mineOf(name, await getStore().listCases()).sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
    p.innerHTML =
      '<div class="cs-head"><div><h2 class="cs-h">' + esc(m.label) + '</h2><div class="cs-sub">' + esc(m.blurb) + '</div></div>' +
      '<button class="cs-btn cs-pri" data-act="new">+ 새 일</button></div>' +
      '<div id="cs-form-' + name + '"></div>' + await notesHtml() +
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
      (m.solo ? '' : '<label>상대방 메일 주소 (초대권을 보낼 곳)<input id="cs-f-email" type="email" placeholder="client@example.com"></label>' +
        '<label class="cs-inl"><input type="checkbox" id="cs-f-sendmail" checked> 만들면서 초대 메일을 바로 보내기 (내 K-Mail 주소로 발송, 사건 제목은 메일에 넣지 않음)</label>') +
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
        var inv = await root.CaseInvite.createInvitation({ case_id: id, inviter_id: cfg().userId || 'me', inviter_side: m.side, invitee_email: email, signup_base: cfg().signupBase || 'https://naviweb.kr/i' }   // naviweb.kr/i → Cloudflare 리디렉션 → K-Mail(?case=1&inv=…), PC·폰 공통);
        if (!inv.ok) { msg.textContent = inv.errors.join(', '); return; }
        await s.patchCase(id, { invitation: inv.invitation, invite_link: inv.link });
        await s.append(id, { type: 'invite_issued', actor_side: m.side, visibility: 'internal', payload: { token_hash: inv.invitation.token_hash, expires_at: inv.invitation.expires_at } });
        if (host()) { try { await host().registerInvite(id); } catch (_) { /* 로그인 전·오프라인이면 상세 화면의 "초대 등록" 버튼으로 다시 */ } }
        var mailNow = $('cs-f-sendmail');
        if (host() && mailNow && mailNow.checked) { try { var sm = await host().sendInviteMail(id); if (!sm.ok) cur['inv-msg'] = '초대 메일을 보내지 못했습니다(' + errText(sm) + '). 아래 버튼으로 다시 보내거나 링크를 직접 전달하세요.'; } catch (_) {} }
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
    else if (e.type.indexOf('state_') === 0) body = '상태 변경: ' + esc(STATE[e.payload.from] || e.payload.from) + ' → <b>' + esc(STATE[e.payload.to] || e.payload.to) + '</b>' + (e.payload.outcome ? ' · 결과: ' + esc(e.payload.outcome) : '') + (e.payload.proof ? ' <span class="cs-6h">(' + (e.actor_side === 'provider' ? '맡은 쪽' : '맡긴 쪽') + ' 서명)</span>' : '');
    else if (e.type === 'peer_entry') { var pe = (e.payload || {}).entry || {}, pp = pe.payload || {}; body = '<b>상대 기록</b> · ' + esc(pe.type === 'comm' ? '소통 — ' + (pp.summary || '') : (pp.text || pe.type || '')); }
    else if (e.type === 'agreement_confirm') body = '<b>합의 확인</b> 서명 — ' + (e.actor_side === 'provider' ? '맡은 쪽' : '맡긴 쪽') + ' <span class="cs-6h">(전자서명 검증됨)</span>';
    else if (e.type === 'invite_issued') body = '초대권 발행 (만료 ' + esc(fmt(e.payload.expires_at)) + ')';
    else body = esc(e.type);
    return '<div class="cs-ev"><div class="cs-ev-h"><span>#' + e.seq + ' · ' + esc(fmt(e.at)) + '</span>' + vis + '</div>' + body + '</div>';
  }

  // 맡은 일/맡긴 일의 "상대와의 연결" 카드: 초대 링크, 가입 여부, 키 지문(상대와 직접 대조), 보내지 못한 항목.
  function connHtml(c, ki, h) {
    var parts = [];
    if (c.incoming && c.state === 'proposed') parts.push('<div><b>받은 제안</b> — 초대한 분이 보낸 일입니다. 제목·종류를 확인하고 “합의 확인(서명)” 또는 “거절”을 누르세요. 내용은 이 기기에만 저장됩니다.</div>');
    if (!c.peer) {
      parts.push('<b>상대 가입 대기 중</b>' + (c.invite_link ? ' — 아래 초대 링크를 메일로 보내세요(자동 발송은 준비 중).<div class="cs-link-box"><input readonly id="cs-invite-link" value="' + esc(c.invite_link) + '"><button class="cs-btn" data-act="copy">복사</button></div>' +
        '<div class="cs-actions"><button class="cs-btn" data-act="send-invite">' + (c.invite_mail_sent_at ? '초대 메일 다시 보내기' : '초대 메일 보내기') + '</button>' +
        (c.invite_mail_sent_at ? '<span class="cs-sub">' + esc(fmt(c.invite_mail_sent_at)) + ' ' + esc(c.invitation && c.invitation.invitee_email || '') + '로 보냄</span>' : '') + '</div>' +
        (cur['inv-msg'] ? '<div class="cs-msg">' + esc(cur['inv-msg']) + '</div>' : '') +
        '<div class="cs-sub">링크 유효기간 14일 · 상대가 가입하면 가입 사실과 아이디, 메일 아이디가 전달되고 키가 교환됩니다.</div>' : ' — 초대 링크가 없습니다.'));
      if (c.invitation && !c.invite_registered) parts.push('<div class="cs-msg">초대가 서버에 등록되지 않았습니다. 로그인 후 <button class="cs-link" data-act="reg-invite">초대 등록</button>을 누르세요(등록해야 상대가 가입 후 연결됩니다).</div>');
    } else {
      parts.push('<b>상대</b> ' + esc(c.peer_mail || (c.incoming ? '초대한 분' : c.peer)) + (c.peer_email_match === false ? ' <span class="cs-bad">⚠ 초대한 메일 주소와 다른 계정으로 가입했습니다. 본인이 맞는지 확인하세요.</span>' : ''));
    }
    if (ki && ki.peer) parts.push('<div class="cs-sub">' + (c.peer_fp_verified ? '✓ 상대와 키 지문을 대조해 확인했습니다.' : '상대와 전화·대면으로 키 지문을 대조했다면 <button class="cs-link" data-act="fp">지문 확인함</button>을 눌러 기록하세요.') + '</div>');
    if (ki) {
      parts.push('<div class="cs-fp">내 키 지문 <code>' + esc(ki.mine) + '</code>' + (ki.peer ? ' · 상대 키 지문 <code>' + esc(ki.peer) + '</code>' : '') + '</div>' +
        (ki.ready ? '<div class="cs-sub">서명 키를 주고받았습니다. 합의 전에 상대와 전화·대면으로 지문이 같은지 한 번 확인하면 가장 안전합니다. 상대 키가 나중에 바뀌면 진행이 중단됩니다.</div>' : (c.peer ? '<div class="cs-sub">키 교환 중입니다. “새로 고침”을 눌러 주세요.</div>' : '')));
    }
    var q = (c.outq || []).length;
    parts.push('<div class="cs-actions"><button class="cs-btn" data-act="sync">새로 고침(우편함)</button>' + (q ? '<span class="cs-bad">보내지 못한 항목 ' + q + '건</span>' : '') + '</div><div id="cs-sync-msg" class="cs-msg"></div>');
    var pending = c.state === 'proposed' ? '<div class="cs-sub">양측이 같은 제안 내용에 서명해야 합의가 성립합니다. 서명은 이 기기의 키로만 만들어지고, 상대의 서명이 없으면 상대가 했다고 인정하지 않습니다.</div>' : '';
    return '<div class="cs-card ' + (c.state === 'proposed' ? 'cs-warn' : '') + '">' + parts.join('') + pending + '</div>';
  }

  // 기한: 사용자가 정한 날짜. 비서가 D-7·D-1·당일에 알린다(규칙·법정기한 계산이 아니라 사용자가 입력한 날짜 기준).
  function deadlinesHtml(c) {
    if (c.state === 'archived' || c.state === 'closed') return '';
    var ds = c.deadlines || [];
    return '<div class="cs-card"><b>기한</b> <span class="cs-sub">비서가 7일 전·1일 전·당일에 알려 드립니다(이 기기에서만)</span>' +
      (ds.length ? ds.map(function (d, i) { return '<div class="cs-dl"><span>' + esc(d.label) + ' · ' + esc(String(d.due).slice(0, 10)) + '</span><button class="cs-link" data-act="del-deadline" data-i="' + i + '">삭제</button></div>'; }).join('') : '') +
      '<div class="cs-grid"><input id="cs-dl-label" maxlength="24" placeholder="무엇의 기한(예: 답변서 제출)"><input id="cs-dl-due" type="date"></div><button class="cs-btn" data-act="add-deadline">기한 추가</button></div>';
  }
  async function openCase(name, id) {
    var s = getStore(), c = await s.getCase(id), m = MODES[name], p = $('tab-' + name);
    if (!c) { await renderList(name); return; }
    cur[name] = id;
    var h = await s.history(id), v = await s.verify(id);
    var tab = (cur[name + ':tab'] || 'all');
    var shown = h.filter(function (e) { return tab === 'all' || (tab === 'comm' && e.type === 'comm'); }).slice().reverse();
    var acts = '', ki = null, H = host(), amReq = null;
    if (m.solo) {
      if (c.state === 'active') acts = '<button class="cs-btn" data-act="tr" data-ev="hold">보류</button><button class="cs-btn" data-act="tr" data-ev="close_self">종료</button>';
      else if (c.state === 'on_hold') acts = '<button class="cs-btn" data-act="tr" data-ev="resume">재개</button><button class="cs-btn" data-act="tr" data-ev="close_self">종료</button>';
      else if (c.state === 'closed') acts = '<button class="cs-btn" data-act="tr" data-ev="archive">보관</button>';
    } else {
      if (H) { try { ki = await H.keyInfo(id); } catch (_) { ki = null; } }
      var ready = !!(c.keys && c.keys.provider && c.keys.consumer), prov = c.my_side === 'provider';
      var b = function (ev, label, pri) { return '<button class="cs-btn' + (pri ? ' cs-pri' : '') + '" data-act="tr" data-ev="' + ev + '">' + label + '</button>'; };
      if (ready && root.CaseSync) amReq = await root.CaseSync.closeRequestedBy(h, c.keys);
      if (c.state === 'proposed') { acts = (ready ? '<button class="cs-btn cs-pri" data-act="confirm">합의 확인(서명)</button>' + (prov ? b('accept', '합의 성립', false) : '') : '') + b('decline', '거절'); }
      else if (c.state === 'agreed') acts = prov ? b('activate', '진행 시작', true) : '';
      else if (c.state === 'active') acts = b('hold', '보류') + b('request_close', '종료 요청');
      else if (c.state === 'on_hold') acts = b('resume', '재개') + b('request_close', '종료 요청');
      else if (c.state === 'closing') acts = amReq && amReq !== c.my_side ? b('close_agree', '종료 동의', true) + b('close_dispute', '이의(진행 계속)') + b('close_hold', '보류로 전환') : '<span class="cs-sub">상대의 응답을 기다리는 중입니다.</span>';
      else if (c.state === 'closed') acts = b('archive', '보관');
    }
    var pending = (await getStore().flushAnchors(0)).pending;
    p.innerHTML =
      '<div class="cs-head"><div><button class="cs-link" data-act="back">← ' + esc(m.label) + '</button><h2 class="cs-h">' + esc(c.title) + '</h2>' +
      '<div class="cs-sub">' + esc(KIND[c.kind] || c.kind) + ' · <span class="cs-badge cs-st-' + esc(c.state) + '">' + esc(STATE[c.state] || c.state) + '</span>' +
      ' · <span class="' + (v.ok ? 'cs-ok' : 'cs-bad') + '">' + (v.ok ? '기록 무결성 확인됨 (' + v.length + '건)' : '⚠ 기록 변조 의심 (#' + v.brokenAt + ')') + '</span>' +
      ' · 이 기기의 해시 전송 대기 ' + pending + '건</div></div><div class="cs-actions">' + acts + '</div></div>' +
      (!m.solo ? connHtml(c, ki, h) : '') + deadlinesHtml(c) +
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
      if (!m.solo && sh && sh.checked && !(await gate(name, { type: 'case.share', effect: 'external' }, { has_sensitive: hasSens(txt) }))) return;
      await s.append(id, { type: 'note', actor_side: m.side, visibility: sh && sh.checked ? 'shared' : 'internal', payload: { text: txt } });
      if (!m.solo) await pushOut(id);
      await openCase(name, id);
    } else if (act === 'add-comm') {
      var at = $('cs-c-at').value ? new Date($('cs-c-at').value).toISOString() : new Date().toISOString();
      var r = root.CaseCore.buildCommunication({ recorder_side: m.side, who: $('cs-c-who').value, with: $('cs-c-with').value, occurred_at: at,
        channel: $('cs-c-ch').value, place: $('cs-c-place').value, how: 'manual', summary: $('cs-c-sum').value, purpose: $('cs-c-pu').value });
      if (!r.ok) { $('cs-c-msg').textContent = r.errors.join(' · '); return; }
      var sh2 = $('cs-c-shared');
      if (!m.solo && sh2 && sh2.checked && !(await gate(name, { type: 'case.share', effect: 'external' }, { has_sensitive: hasSens([$('cs-c-sum').value, $('cs-c-with').value, $('cs-c-place').value].join(' ')) }))) return;
      await s.append(id, { type: 'comm', actor_side: m.side, visibility: sh2 && sh2.checked ? 'shared' : 'internal', payload: r.value });
      if (!m.solo) await pushOut(id);
      cur[name + ':tab'] = 'comm'; await openCase(name, id);
    } else if (act === 'tr') {
      var evn = t.getAttribute('data-ev'), ctx = { side: m.side }, entry = {};
      if (evn === 'close_self' || evn === 'request_close') {
        var o = (typeof prompt === 'function') ? prompt('결과를 한 줄로 기록하세요 (예: 승소 / 완치 / 취하)') : null;
        if (!o) return; ctx.outcome = o; entry.payload = { outcome: o };
      }
      if (['request_close', 'close_agree', 'close_self'].indexOf(evn) >= 0) {
        var cc = await s.getCase(id), un = await unpaidOf(cc, await s.history(id)), gx = { }; if (un !== undefined) gx.unpaid_invoices = un;
        if (!(await gate(name, { type: 'case.close', effect: 'external' }, gx))) return;
      }
      var rr = await s.applyTransition(id, evn, ctx, Object.assign({ visibility: m.solo ? 'internal' : 'shared' }, entry));
      if (!rr.ok) { note(name, rr); return; }
      if (!m.solo && rr.event) { var pr = await pushOut(id, [rr.event]); if (pr && !pr.ok) { await openCase(name, id); note(name, { error: '기록은 저장됐지만 상대에게 아직 보내지 못했습니다(' + errText(pr) + '). 새로 고침 때 다시 보냅니다.' }); return; } }
      await openCase(name, id);
    } else if (act === 'confirm') {
      var H = host(); if (!H) return;
      var kr = await H.ensureKeys(id); if (!kr.ok) { note(name, kr); return; }
      var c0 = await s.getCase(id);
      if (!(await gate(name, { type: 'case.agree', effect: 'signature' }, { peer_fp_verified: !!c0.peer_fp_verified }))) return;
      var cf = await s.confirmAgreement(id, proposalOf(c0));
      if (!cf.ok) { note(name, cf); return; }
      var p1 = await pushOut(id, [cf.event]);
      await openCase(name, id);
      if (p1 && !p1.ok) note(name, { error: '서명은 저장됐지만 상대에게 아직 보내지 못했습니다(' + errText(p1) + '). 새로 고침 때 다시 보냅니다.' });
    } else if (act === 'sync') {
      var H2 = host(); if (!H2) return;
      var msg = $('cs-sync-msg'); if (msg) msg.textContent = '확인 중…';
      try {
        await H2.ensureKeys(id).catch(function () {});
        var r2 = await H2.poll();
        await openCase(name, id);
        var m2 = $('cs-sync-msg');
        if (m2) { m2.style.color = r2.ok ? 'var(--sub)' : ''; m2.textContent = r2.ok ? ('받은 항목 ' + r2.applied + '건 반영 · 보낸 항목 ' + r2.sent + '건' + (r2.errors && r2.errors.length ? ' · 처리하지 못한 항목 ' + r2.errors.length + '건(' + r2.errors.map(function (e) { return e.code; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ') + ')' : '')) : errText(r2); }
      } catch (e) { var m3 = $('cs-sync-msg'); if (m3) { m3.style.color = ''; m3.textContent = e.message || '실패'; } }
    } else if (act === 'fp') {
      await s.patchCase(id, { peer_fp_verified: true, peer_fp_verified_at: new Date().toISOString() }); await openCase(name, id);
    } else if (act === 'add-deadline') {
      var dl = ($('cs-dl-label').value || '').trim(), dd = $('cs-dl-due').value; if (!dl || !dd) { var me = $('cs-c-msg') || $('cs-sync-msg'); if (me) me.textContent = '기한의 이름과 날짜를 모두 입력하세요.'; return; }
      var cd = await s.getCase(id), due = new Date(dd + 'T23:59:59+09:00').toISOString();
      await s.patchCase(id, { deadlines: (cd.deadlines || []).concat([{ label: dl.slice(0, 24), due: due }]).sort(function (a, b) { return a.due.localeCompare(b.due); }) }); await openCase(name, id);
    } else if (act === 'del-deadline') {
      var cd2 = await s.getCase(id), ix = parseInt(t.getAttribute('data-i'), 10), arr = (cd2.deadlines || []).slice(); arr.splice(ix, 1); await s.patchCase(id, { deadlines: arr }); await openCase(name, id);
    } else if (act === 'send-invite') {
      var H4 = host(); if (!H4) return;
      if (typeof confirm === 'function' && !confirm('초대 메일을 ' + (((await s.getCase(id)).invitation || {}).invitee_email || '') + ' 주소로 보냅니다. 보낼까요?')) return;
      var sr = await H4.sendInviteMail(id); cur['inv-msg'] = sr.ok ? '' : '초대 메일을 보내지 못했습니다(' + errText(sr) + ')';
      await openCase(name, id);
    } else if (act === 'reg-invite') {
      var H3 = host(); if (!H3) return;
      try { var ri = await H3.registerInvite(id); if (!ri.ok) { note(name, ri); return; } } catch (e) { note(name, { error: e.message }); return; }
      await openCase(name, id);
    }
  }

  function note(name, r) { var el = $('cs-sync-msg') || $('cs-c-msg'); if (el) { el.style.color = ''; el.textContent = errText(r); } else if (typeof alert === 'function') alert(errText(r)); }

  function show(name) {
    if (!MODES[name]) return;
    var p = $('tab-' + name); if (!p) return;
    if (!p.__csBound) { p.__csBound = true; p.addEventListener('click', function (ev) { onClick(name, ev); }); }
    var go = function () { return cur[name] ? openCase(name, cur[name]) : renderList(name); };
    var H = host();
    if (!H) return go();
    // 키(이 기기)를 먼저 준비해야 CaseStore 가 서명 키를 갖고 만들어진다. 우편함 자동 확인은 로그인 후 60초마다.
    return H.initLocal().catch(function () {}).then(function () {
      if (name !== 'casesolo' && !H.__auto) { H.__auto = true; H.onUpdate(function (o) { if (!o || !(o.applied || (o.joined && o.joined.length))) return; var ae = document.activeElement; if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return; var n = ['caseprov', 'casecons'].filter(function (k) { return cur[k]; }); n.forEach(function (k) { var pn = $('tab-' + k); if (pn && pn.classList.contains('active')) openCase(k, cur[k]); }); }); H.startAutoPoll(60000); }
      return go();
    });
  }
  // ── 초대 수락 배너 ─────────────────────────────────────
  function inviteBanner() {
    var t = invToken(); if (!t || !host() || $('cs-inv') || typeof document === 'undefined' || !document.body) return;
    var d = document.createElement('div'); d.id = 'cs-inv'; d.className = 'cs-inv';
    d.innerHTML = '<b>초대를 받았습니다.</b><div class="cs-sub">수락하면 내 가입 사실과 아이디·메일 아이디가 초대한 분께 전달되고, 서로의 서명 키를 주고받습니다. 일의 내용은 초대한 분이 제안을 보내면 이 기기에만 나타납니다.</div>' +
      '<div class="cs-actions"><button class="cs-btn cs-pri" id="cs-inv-ok" data-requires-login="초대 수락">수락</button><button class="cs-btn" id="cs-inv-no">나중에</button></div><div id="cs-inv-msg" class="cs-sub"></div>';
    document.body.appendChild(d);
    var msg = function (m, bad) { var e = $('cs-inv-msg'); if (e) { e.textContent = m; e.style.color = bad ? '#c0392b' : ''; } };
    $('cs-inv-no').onclick = function () { d.remove(); };
    $('cs-inv-ok').onclick = async function () {
      var btn = this; btn.disabled = true; msg('수락하는 중…');
      try {
        await host().initLocal();
        var r = await host().claim(t);
        if (!r.ok) { msg(errText(r), true); btn.disabled = false; return; }
        try { sessionStorage.removeItem('case_inv'); history.replaceState(null, '', location.pathname + location.search.replace(/([?&])inv=[^&#]*&?/, '$1').replace(/[?&]$/, '') + location.hash); } catch (_) {}
        btn.style.display = 'none'; $('cs-inv-no').textContent = '닫기';
        msg('수락했습니다. 초대한 분이 제안을 보내면 자동으로 나타납니다…');
        for (var i = 0; i < 15; i++) {
          var pr = await host().poll();
          if (pr && pr.proposals) { var cs = await getStore().listCases(), nw = cs.filter(function (c) { return c.incoming; }).sort(function (a, b) { return (b.incoming_at || '').localeCompare(a.incoming_at || ''); })[0];
            msg('제안이 도착했습니다: ' + (nw ? nw.title : '')); var tab = nw && nw.my_side === 'provider' ? 'caseprov' : 'casecons'; cur[tab] = nw ? nw.case_id : null; if (typeof root._switchTab === 'function') root._switchTab(tab); setTimeout(function () { d.remove(); }, 4000); return; }
          await new Promise(function (res) { setTimeout(res, 4000); });
        }
        msg('아직 제안이 오지 않았습니다. 초대한 분이 확인하면 “맡은 일/맡긴 일”에 자동으로 나타납니다.');
      } catch (e) { msg(e.message || '실패', true); btn.disabled = false; }
    };
  }
  function applyFlag() { var g = $('side-group-case'); if (g) g.hidden = !enabled(); inviteBanner(); }

  root.CaseUI = { show: show, enabled: enabled, applyFlag: applyFlag, MODES: MODES, _store: getStore, _reset: function () { store = null; cur = {}; } };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyFlag); else applyFlag();
  }
})(typeof window !== 'undefined' ? window : globalThis);
