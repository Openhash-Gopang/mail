/* ═════════════════════════════════════════════════
   qna-ui.js — 사용법 "질문·답변" 게시판 화면 (desktop.html 사용법 > 질문·답변 탭). 2026-11-06.
   흐름: 질문 → 나비웹 도우미(SP-NAVIWEB-MANUAL)가 먼저 답 → 해결되지 않으면 "관리자에게 질의" → 관리자 답 → (관리자가 공개하면) 공개 게시판에서 댓글.
   서버: ops/naviweb-qna (Cloudflare Worker + KV). 주소는 window.NAVI_QNA_API 로 바꿀 수 있다.
   이용자는 계정 대신 기기가 만든 비밀 토큰(localStorage)으로 구분한다. 순수 함수(_pure)는 DOM 없이 Node 에서 테스트한다.
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var TOKEN_KEY = 'navi_qna_owner';
  var STATUS = { open: '접수됨', sp_answered: '도우미 답변', escalated: '관리자 확인 중', answered: '관리자 답변 도착', closed: '해결됨' };
  var ROLE = { user: '나', sp: '나비웹 도우미', admin: '관리자', comment: '', system: '' };
  var ERR = {
    limit: '오늘 보낼 수 있는 횟수를 넘었습니다. 내일 다시 시도해 주세요.', empty: '내용을 적어 주세요.', cannot_escalate: '먼저 도우미의 답을 받은 뒤에 관리자에게 질의할 수 있습니다.',
    not_found: '글을 찾을 수 없습니다.', owner_required: '이 기기에서 식별 정보를 만들 수 없습니다(브라우저 저장소 차단).', network: '서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요.'
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function baseUrl(loc) {
    if (root.NAVI_QNA_API) return String(root.NAVI_QNA_API).replace(/\/+$/, '');
    return loc && loc.hostname === 'naviweb.kr' ? '/api/qna' : 'https://naviweb.kr/api/qna';
  }
  /** 이 기기의 비밀 토큰. 저장소를 못 쓰면 메모리에만 두고 이번 방문 동안만 유지한다. */
  var mem = '';
  function ownerToken(store, rnd) {
    try { var v = store.getItem(TOKEN_KEY); if (v && /^[A-Za-z0-9_-]{16,64}$/.test(v)) return v; } catch (e) { /* 저장소 차단 */ }
    var b = new Uint8Array(24); (rnd || (root.crypto || {}).getRandomValues.bind(root.crypto))(b);
    var t = Array.prototype.map.call(b, function (x) { return (x % 36).toString(36); }).join('');
    try { store.setItem(TOKEN_KEY, t); } catch (e) { mem = mem || t; return mem; }
    return t;
  }
  /** 서버 호출 묶음. 모든 메서드는 Promise<{ ok, thread|threads, error }> 를 돌려준다(예외를 던지지 않는다). */
  function makeApi(base, token, f) {
    function call(method, path, body) {
      var h = { 'X-Qna-Owner': token }; if (body) h['Content-Type'] = 'application/json';
      return f(base + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined })
        .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'network' }; }); })
        .catch(function () { return { ok: false, error: 'network' }; });
    }
    return {
      mine: function () { return call('GET', '/threads/mine'); },
      pub: function () { return call('GET', '/public'); },
      get: function (id) { return call('GET', '/threads/' + encodeURIComponent(id)); },
      ask: function (text) { return call('POST', '/threads', { text: text }); },
      say: function (id, text) { return call('POST', '/threads/' + encodeURIComponent(id) + '/messages', { text: text }); },
      escalate: function (id, note) { return call('POST', '/threads/' + encodeURIComponent(id) + '/escalate', { note: note }); },
      resolve: function (id) { return call('POST', '/threads/' + encodeURIComponent(id) + '/resolve', {}); },
      comment: function (id, text) { return call('POST', '/threads/' + encodeURIComponent(id) + '/comments', { text: text }); }
    };
  }
  function when(iso) {
    try { return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)); } catch (e) { return ''; }
  }
  function badge(s) { return '<span class="qn-st qn-st-' + esc(s) + '">' + esc(STATUS[s] || s) + '</span>'; }
  function para(t) { return esc(t).replace(/\n/g, '<br>'); }

  function listHtml(rows, kind) {
    if (!rows || !rows.length) return '<div class="qn-empty">' + (kind === 'pub' ? '아직 공개된 질문이 없습니다. 관리자가 답하고 공개한 질문이 여기에 올라옵니다.' : '아직 질문이 없습니다. 위의 “＋ 질문하기”로 궁금한 점을 물어보세요.') + '</div>';
    return '<ul class="qn-list">' + rows.map(function (t) {
      return '<li><button type="button" class="qn-row" data-act="open" data-id="' + esc(t.id) + '"><span class="qn-t">' + esc(t.title) + '</span>' + (kind === 'pub' ? '' : badge(t.status)) + '<span class="qn-d">' + esc(when(t.updated)) + '</span></button></li>';
    }).join('') + '</ul>';
  }
  function msgHtml(m) {
    if (m.role === 'system') return '<div class="qn-sys">' + esc(m.text) + ' · ' + esc(when(m.at)) + '</div>';
    var who = m.role === 'comment' ? (m.name || '이용자') : (ROLE[m.role] || ''), cls = 'qn-m qn-m-' + esc(m.role);
    return '<div class="' + cls + '"><div class="qn-who">' + esc(who) + ' <span>' + esc(when(m.at)) + '</span>' + (m.hidden ? ' <span class="qn-hid">가려짐</span>' : '') + '</div><div class="qn-tx">' + para(m.text) + '</div></div>';
  }
  /** opts.note: 관리자에게 질의 입력창이 열려 있는지 */
  function threadHtml(t, opts) {
    opts = opts || {};
    var h = '<div class="qn-head"><button type="button" class="qn-back" data-act="back">‹ 목록</button><h3 class="qn-title">' + esc(t.title) + '</h3>' + badge(t.status) + '<button type="button" class="qn-btn qn-btn-ghost" data-act="refresh">새로고침</button></div>';
    h += '<div class="qn-thread">' + t.msgs.map(msgHtml).join('') + '</div>';
    if (t.spStatus === 'unavailable' || t.spStatus === 'error') h += '<div class="qn-note">지금은 도우미의 자동 답변을 받을 수 없습니다. 아래 “관리자에게 질의”로 보내 주시면 관리자가 직접 답합니다.</div>';
    if (t.status === 'escalated') h += '<div class="qn-note qn-note-ok">관리자에게 접수되었습니다. 답이 오면 이 글에 표시됩니다(“새로고침”으로 확인).</div>';
    if (t.status === 'answered') h += '<div class="qn-note qn-note-ok">관리자가 답했습니다. 더 궁금하면 아래에 이어서 물어보세요.</div>';
    if (t.mine) {
      if (t.status !== 'closed') {
        h += '<div class="qn-reply"><textarea id="qn-say" rows="3" maxlength="1200" placeholder="' + (t.status === 'escalated' ? '관리자에게 덧붙일 말' : '이어서 물어보기') + '"></textarea>';
        h += '<div class="qn-acts"><button type="button" class="qn-btn" data-act="say">' + (t.status === 'escalated' ? '덧붙이기' : '보내기') + '</button>';
        if (t.canEscalate) h += '<button type="button" class="qn-btn qn-btn-ghost" data-act="esc-open" aria-expanded="' + (opts.note ? 'true' : 'false') + '">관리자에게 질의</button>';
        h += '<button type="button" class="qn-btn qn-btn-plain" data-act="resolve">해결됐어요</button></div>';
        if (t.canEscalate && opts.note) h += '<div class="qn-esc"><p>도우미의 답으로 해결되지 않은 점을 적어 주세요(선택). 관리자 대시보드의 “사용법 질의”로 전달됩니다.</p><textarea id="qn-note" rows="2" maxlength="600" placeholder="예: 3단계에서 버튼이 보이지 않아요"></textarea><div class="qn-acts"><button type="button" class="qn-btn" data-act="esc-send">질의 보내기</button><button type="button" class="qn-btn qn-btn-plain" data-act="esc-cancel">취소</button></div></div>';
        h += '</div>';
      }
    } else if (t.vis === 'public') {
      h += '<div class="qn-reply"><textarea id="qn-cm" rows="2" maxlength="600" placeholder="댓글을 남겨 보세요(이메일·전화·번호는 자동으로 지워집니다)"></textarea><div class="qn-acts"><button type="button" class="qn-btn" data-act="comment">댓글 달기</button></div></div>';
    }
    return h;
  }

  function mount(host, opts) {
    opts = opts || {};
    var f = opts.fetch || (root.fetch ? root.fetch.bind(root) : null);
    var store = opts.store || (function () { try { return root.localStorage; } catch (e) { return { getItem: function () { return null; }, setItem: function () {} }; } })();
    var api = makeApi(opts.base || baseUrl(root.location), ownerToken(store), f);
    var S = { tab: 'mine', view: 'list', rows: null, thread: null, note: false, busy: false, msg: '' };
    function $(id) { return host.querySelector('#' + id); }
    function say(m) { S.msg = m || ''; var e = host.querySelector('.qn-msg'); if (e) e.textContent = S.msg; }
    function fail(r) { say(ERR[r && r.error] || ERR.network); }
    function draw() {
      var h = '<div class="qn">';
      if (S.view === 'list') {
        h += '<div class="qn-bar"><div class="qn-tabs" role="tablist"><button type="button" role="tab" class="qn-tab' + (S.tab === 'mine' ? ' on' : '') + '" aria-selected="' + (S.tab === 'mine') + '" data-act="tab" data-t="mine">내 질문</button><button type="button" role="tab" class="qn-tab' + (S.tab === 'pub' ? ' on' : '') + '" aria-selected="' + (S.tab === 'pub') + '" data-act="tab" data-t="pub">공개 질문·답변</button></div><button type="button" class="qn-btn qn-btn-ghost" data-act="refresh">새로고침</button></div>';
        if (S.tab === 'mine') h += '<div class="qn-ask"><textarea id="qn-q" rows="3" maxlength="1200" placeholder="사용법이 궁금하면 여기에 적어 주세요. 나비웹 도우미가 사용법에서 찾아 먼저 답합니다. (주민번호·카드번호·비밀번호는 적지 마세요)"></textarea><div class="qn-acts"><button type="button" class="qn-btn" data-act="ask"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? '도우미가 찾는 중…' : '질문하기') + '</button></div></div>';
        h += S.rows == null ? '<div class="qn-empty">불러오는 중…</div>' : listHtml(S.rows, S.tab);
      } else if (S.thread) h += threadHtml(S.thread, { note: S.note });
      h += '<div class="qn-msg" role="status" aria-live="polite">' + esc(S.msg) + '</div></div>';
      host.innerHTML = h;
    }
    function loadList() { S.rows = null; draw(); return (S.tab === 'pub' ? api.pub() : api.mine()).then(function (r) { if (r.ok) S.rows = r.threads; else { S.rows = []; fail(r); } draw(); }); }
    function setThread(r) { if (r.ok) { S.thread = r.thread; S.view = 'thread'; S.note = false; say(''); } else fail(r); draw(); }
    function text(id) { var e = $(id); return e ? e.value.trim() : ''; }
    host.addEventListener('click', function (ev) {
      var t = ev.target.closest && ev.target.closest('[data-act]'); if (!t || !host.contains(t) || S.busy) return;
      var act = t.getAttribute('data-act'), id = S.thread && S.thread.id;
      if (act === 'tab') { S.tab = t.getAttribute('data-t'); say(''); loadList(); }
      else if (act === 'refresh') { if (S.view === 'thread') api.get(id).then(setThread); else loadList(); }
      else if (act === 'open') api.get(t.getAttribute('data-id')).then(setThread);
      else if (act === 'back') { S.view = 'list'; S.thread = null; say(''); loadList(); }
      else if (act === 'ask') { var q = text('qn-q'); if (q.length < 2) return say(ERR.empty); S.busy = true; say(''); draw(); api.ask(q).then(function (r) { S.busy = false; setThread(r); }); }
      else if (act === 'say') { var s = text('qn-say'); if (!s) return say(ERR.empty); S.busy = true; draw(); api.say(id, s).then(function (r) { S.busy = false; setThread(r); }); }
      else if (act === 'esc-open') { S.note = !S.note; draw(); var n = $('qn-note'); if (n) n.focus(); }
      else if (act === 'esc-cancel') { S.note = false; draw(); }
      else if (act === 'esc-send') { api.escalate(id, text('qn-note')).then(setThread); }
      else if (act === 'resolve') api.resolve(id).then(setThread);
      else if (act === 'comment') { var c = text('qn-cm'); if (!c) return say(ERR.empty); api.comment(id, c).then(setThread); }
    });
    loadList();
    return { reload: loadList, _state: S };
  }

  root.QnaUI = { mount: mount, _pure: { esc: esc, baseUrl: baseUrl, ownerToken: ownerToken, makeApi: makeApi, listHtml: listHtml, threadHtml: threadHtml, msgHtml: msgHtml, STATUS: STATUS } };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.QnaUI;
})(typeof window !== 'undefined' ? window : this);
