/* ═════════════════════════════════════════════════
   manual-chat.js — 사용법 페이지 아래의 "사용법 도우미" 대화창 (desktop.html 사용법 > 사용법 강의). 2026-11-06.
   SP-NAVIWEB-MANUAL v2 를 서버(ops/naviweb-qna 의 POST /chat)가 불러 답한다. 지금 보는 장과 화면 언어를 함께 보낸다.
   대화는 이 브라우저 메모리에만 있고 어디에도 저장하지 않는다(새로고침하면 사라짐). "관리자에게 질의"를 누르면 그때까지의 대화가 글이 되어
   관리자 대시보드 "사용법 질의"로 접수된다(POST /threads/escalate-chat). 순수 함수(_pure)는 DOM 없이 Node 에서 테스트한다.
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var MAX_TURNS = 12;
  var ERR = {
    sp_unavailable: '지금은 도우미를 쓸 수 없습니다. 아래 “질문·답변 탭에서 질의하기”로 관리자에게 물어보실 수 있습니다.',
    sp_error: '도우미가 답을 만들지 못했습니다. 잠시 뒤 다시 보내 주세요.', limit: '오늘 보낼 수 있는 횟수를 넘었습니다. 내일 다시 이용해 주세요.',
    empty: '내용을 적어 주세요.', network: '서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요.', cannot_escalate: '도우미의 답을 받은 뒤에 관리자에게 질의할 수 있습니다.', owner_required: '이 브라우저에서 식별 정보를 만들 수 없습니다(저장소 차단).'
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function para(t) { return esc(t).replace(/\n/g, '<br>'); }
  /** 서버로 보낼 대화: 마지막 MAX_TURNS 개, {role, content}. */
  function payload(msgs) { return msgs.slice(-MAX_TURNS).map(function (m) { return { role: m.role, content: m.text }; }); }
  function canEscalate(msgs) { return msgs.some(function (m) { return m.role === 'assistant'; }); }
  function langNow() {
    try { var l = root.NaviI18n && root.NaviI18n.lang && root.NaviI18n.lang(); l = typeof l === 'string' ? l : (l && l.lang); return /^[a-z]{2}$/.test(l || '') ? l : 'ko'; } catch (e) { return 'ko'; }
  }
  function bubbleHtml(m) {
    return '<div class="mc-m mc-' + (m.role === 'user' ? 'user' : 'bot') + '"><div class="mc-who">' + (m.role === 'user' ? '나' : '사용법 도우미') + '</div><div class="mc-tx">' + para(m.text) + '</div></div>';
  }
  function panelHtml(S, chapter) {
    var h = '<section class="mc" aria-label="사용법 도우미"><div class="mc-head"><b>사용법 도우미</b><span class="mc-ctx">' + (chapter ? '지금 보는 장: ' + esc(chapter.n + '. ' + chapter.title) : '') + '</span>' +
      (S.msgs.length ? '<button type="button" class="mc-link" data-act="mc-reset">새 대화</button>' : '') + '</div>';
    h += '<div class="mc-log" role="log" aria-live="polite">' + (S.msgs.length ? S.msgs.map(bubbleHtml).join('') + (S.busy ? '<div class="mc-m mc-bot"><div class="mc-tx mc-dots">찾는 중…</div></div>' : '')
      : '<div class="mc-hint">사용법이 궁금하면 물어보세요. 예: “이 장에서 말하는 예시 줄이 뭐예요?”, “서류는 어디서 만들어요?”</div>') + '</div>';
    if (S.sent) {
      h += '<div class="mc-ok">관리자에게 접수되었습니다. 답이 오면 <button type="button" class="mc-link" data-act="mode" data-m="qna">질문·답변 탭의 “내 질문”</button>에 표시됩니다.</div>';
    } else {
      h += '<div class="mc-in"><textarea id="mc-q" rows="2" maxlength="1200" placeholder="궁금한 점을 적고 Enter(줄바꿈은 Shift+Enter)"' + (S.busy ? ' disabled' : '') + '></textarea><button type="button" class="mc-btn" data-act="mc-send"' + (S.busy ? ' disabled' : '') + '>보내기</button></div>';
      h += '<div class="mc-foot"><span>도우미는 사용법만 안내합니다.</span>';
      if (canEscalate(S.msgs)) h += '<button type="button" class="mc-link" data-act="mc-esc-open" aria-expanded="' + (S.note ? 'true' : 'false') + '">해결되지 않았어요 · 관리자에게 질의</button>';
      else if (S.unavail) h += '<button type="button" class="mc-link" data-act="mode" data-m="qna">질문·답변 탭에서 질의하기</button>';
      h += '</div>';
      if (S.note && canEscalate(S.msgs)) h += '<div class="mc-esc"><p>지금까지의 대화가 관리자 대시보드의 “사용법 질의”로 전달됩니다. 해결되지 않은 점을 적어 주세요(선택).</p><textarea id="mc-note" rows="2" maxlength="600" placeholder="예: 3단계 버튼이 보이지 않아요"></textarea><div class="mc-acts"><button type="button" class="mc-btn" data-act="mc-esc-send">질의 보내기</button><button type="button" class="mc-link" data-act="mc-esc-cancel">취소</button></div></div>';
    }
    return h + '<div class="mc-msg" role="status">' + esc(S.msg) + '</div></section>';
  }

  function mount(host, opts) {
    opts = opts || {};
    var QU = root.QnaUI && root.QnaUI._pure;
    var f = opts.fetch || (root.fetch ? root.fetch.bind(root) : null);
    var store = opts.store || (function () { try { return root.localStorage; } catch (e) { return { getItem: function () { return null; }, setItem: function () {} }; } })();
    var base = opts.base || (QU ? QU.baseUrl(root.location) : '/api/qna'), token = QU ? QU.ownerToken(store) : '';
    var S = { msgs: [], busy: false, note: false, sent: false, unavail: false, msg: '' };
    function chapter() { try { return opts.getChapter ? opts.getChapter() : null; } catch (e) { return null; } }
    function call(path, body) {
      return f(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Qna-Owner': token }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'network' }; }); }).catch(function () { return { ok: false, error: 'network' }; });
    }
    function draw(keep) {
      var q = host.querySelector('#mc-q'), v = keep && q ? q.value : '', n = host.querySelector('#mc-note'), nv = keep && n ? n.value : '';
      host.innerHTML = panelHtml(S, chapter());
      var q2 = host.querySelector('#mc-q'); if (q2 && v) q2.value = v; var n2 = host.querySelector('#mc-note'); if (n2 && nv) n2.value = nv;
      var log = host.querySelector('.mc-log'); if (log) log.scrollTop = log.scrollHeight;
    }
    function send() {
      var q = host.querySelector('#mc-q'), text = q ? q.value.trim() : ''; if (S.busy) return;
      if (!text) { S.msg = ERR.empty; return draw(true); }
      S.msgs.push({ role: 'user', text: text }); S.busy = true; S.msg = ''; S.unavail = false; draw();
      var c = chapter();
      call('/chat', { messages: payload(S.msgs), chapter: c ? c.n : null, lang: langNow() }).then(function (r) {
        S.busy = false;
        if (r.ok) S.msgs.push({ role: 'assistant', text: r.reply });
        else { S.msg = ERR[r.error] || ERR.network; if (r.error === 'sp_unavailable') S.unavail = true; if (r.error === 'limit' || r.error === 'sp_unavailable' || r.error === 'sp_error') S.msgs.pop(); }
        draw();
      });
    }
    host.addEventListener('click', function (ev) {
      var t = ev.target.closest && ev.target.closest('[data-act]'); if (!t || !host.contains(t)) return;
      var act = t.getAttribute('data-act');
      if (act === 'mc-send') send();
      else if (act === 'mc-reset') { S = { msgs: [], busy: false, note: false, sent: false, unavail: false, msg: '' }; draw(); }
      else if (act === 'mc-esc-open') { S.note = !S.note; draw(true); var n = host.querySelector('#mc-note'); if (n) n.focus(); }
      else if (act === 'mc-esc-cancel') { S.note = false; draw(true); }
      else if (act === 'mc-esc-send') {
        var n2 = host.querySelector('#mc-note'); if (S.busy) return; S.busy = true;
        call('/threads/escalate-chat', { messages: payload(S.msgs), note: n2 ? n2.value.trim() : '', lang: langNow() }).then(function (r) { S.busy = false; if (r.ok) { S.sent = true; S.note = false; S.msg = ''; } else S.msg = ERR[r.error] || ERR.network; draw(); });
      }
    });
    host.addEventListener('keydown', function (e) { if (e.target && e.target.id === 'mc-q' && e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); send(); } });
    draw();
    return { refresh: function () { var c = host.querySelector('.mc-ctx'), ch = chapter(); if (c) c.textContent = ch ? '지금 보는 장: ' + ch.n + '. ' + ch.title : ''; }, _state: function () { return S; } };
  }

  root.ManualChat = { mount: mount, _pure: { payload: payload, canEscalate: canEscalate, panelHtml: panelHtml, bubbleHtml: bubbleHtml, MAX_TURNS: MAX_TURNS } };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ManualChat;
})(typeof window !== 'undefined' ? window : this);
