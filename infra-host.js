/**
 * infra-host.js — 인프라 AI 전용 화면의 "SP 대화창" (2026-11-23, 주피터 지시)
 *
 * 의료·법률처럼 전용 화면이 먼저 열리는 인프라는 화면 안에서 대화하지 않는다. 우하단 대화 아이콘(#hchat-fab)을 누르면
 * 그 인프라의 SP(의료 SP, 법률 SP …)와 이야기하는 대화창이 열린다. 교육(learn-host.js)과 같은 방식이고, 화면 이동 명령 해석은 하지 않는다(말만 주고받는다).
 *
 * 쓰는 법: InfraHost.enter({ key, label, sp, greeting, examples, placeholder }) / InfraHost.leave() / InfraHost.ask(text) / InfraHost.cur()
 *  - sp 는 SP 키(인라인이면 'inline:khealth:v0.1' 처럼 쓰고 spText 에 SP 전문을 넣는다. infra-sp.js 의 InfraSP.cfg(키)가 만들어 준다). 나비웹 대화창(숨은 프레임)에 hondi-embed-sp 로 알려 주고, 질문은 hondi-embed-sp-ask 로 보낸다.
 *  - 대화창은 하나뿐이다 — 들어올 때 기관 대화(_org)·전문가 대화(_prof)·교육 대화(LearnHost)를 먼저 닫는다.
 * desktop.html 의 전역(HondiChat, _org, _prof, _orgMd, _hcOrigin, _orgLeave, _profLeave)을 쓴다. 전역: window.InfraHost
 */
(function () {
'use strict';
var _ih = { active: false, cfg: null, ready: false, queue: [], pending: {}, busy: false, open: false, fabHooked: false, hist: {} };
function _el(id) { return document.getElementById(id); }
function _ihEnter(cfg) {
  if (!cfg || typeof cfg.sp !== 'string' || !cfg.sp || !window.HondiChat) return false;
  if (_ih.active && _ih.cfg && _ih.cfg.key === cfg.key) return true;
  if (_ih.active) _ihLeave();
  if (window.LearnHost) { try { LearnHost.leave(); } catch (x) {} }
  if (typeof _prof !== 'undefined' && _prof.active) _profLeave();
  if (typeof _org !== 'undefined' && _org) _orgLeave();
  try { if (HondiChat.isOpen()) HondiChat.close(); } catch (x) {}
  _ih.active = true; _ih.cfg = cfg; _ih.ready = false; _ih.queue = []; _ih.busy = false; _ih.pending = {};
  HondiChat.setSp({ type: 'hondi-embed-sp', sp: cfg.sp, spText: cfg.spText || undefined, label: cfg.label || '', greeting: String(cfg.greeting || '').slice(0, 300), role: '', context: '' });   // spText 가 있으면 인라인 SP(infra-sp.js, v0.1)
  setTimeout(function () { if (_ih.active && !_ih.ready) { _ih.ready = true; _ih.queue.splice(0).forEach(function (m) { HondiChat.post(m); }); } }, 5000);   // 준비 신호가 늦어도 말은 전한다
  if (!_ih.fabHooked) { _ih.fabHooked = true; var prev = HondiChat.onFab; HondiChat.onFab = function () { if (_ih.active) { _ihToggle(); return true; } return typeof prev === 'function' ? prev() : false; }; }
  _ihBuild(); var fab = _el('hchat-fab'); if (fab) fab.setAttribute('aria-label', cfg.label + ' 대화');
  _ihRefresh();
  try { HondiChat.notify(); } catch (x) {}   // 아이콘에 점으로 알린다
  return true;
}
function _ihLeave() {
  if (!_ih.active) return;
  var p = _el('ichat-panel'); if (p) p.classList.remove('open');
  _ih.active = false; _ih.open = false; _ih.cfg = null;
  var fab = _el('hchat-fab'); if (fab) fab.setAttribute('aria-label', '나비웹 대화');
  if (window.HondiChat && !(typeof _org !== 'undefined' && _org) && !(typeof _prof !== 'undefined' && _prof.active) && !(window.LearnHost && LearnHost.active && LearnHost.active())) HondiChat.setSp(null);
}
function _ihBuild() {
  if (!_el('ichat-panel')) {
    var st = document.createElement('style');
  st.textContent = '#ichat-panel{position:fixed;right:20px;bottom:86px;z-index:9991;display:none;flex-direction:column;width:min(400px,calc(100vw - 32px));height:min(560px,calc(100vh - 110px));background:var(--sur,#fff);border:1px solid var(--bdr,#d8dee6);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.3);overflow:hidden}' +
    '#ichat-panel.open{display:flex}#ichat-head{display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--gov,#1E3F85);color:#fff;font-weight:700;font-size:14px}#ichat-head .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#ichat-head button{border:0;background:rgba(255,255,255,.16);color:#fff;border-radius:6px;padding:4px 9px;font-size:13px;cursor:pointer;font-family:inherit}#ichat-head button:hover{background:rgba(255,255,255,.3)}' +
    '#ichat-thread{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px}#ichat-thread .chat-bubble{font-size:14px;line-height:1.55}' +
    '#ichat-thread .lc-note{align-self:center;font-size:12px;color:var(--hint,#5b6676);background:var(--soft,#f4f7f9);border-radius:999px;padding:3px 12px;text-align:center}#ichat-thread .lc-note.bad{color:#B3261E}' +
    '#ichat-ex{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 8px}#ichat-ex button{border:1px solid var(--bdr,#d8dee6);background:var(--sur,#fff);color:inherit;border-radius:999px;padding:5px 11px;font-size:12.5px;cursor:pointer;font-family:inherit}#ichat-ex button:hover{background:var(--pri-bg,#E8F0FE)}' +
    '#ichat-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--bdr,#d8dee6)}#ichat-in{flex:1;resize:none;border:1px solid var(--bdr,#d8dee6);border-radius:10px;padding:8px 10px;font:inherit;font-size:14px;background:var(--bg,#fff);color:inherit;max-height:90px}' +
    '#ichat-send{border:0;background:var(--pri,#3B7DDD);color:#fff;border-radius:10px;padding:0 16px;font-weight:700;cursor:pointer;font-family:inherit}#ichat-send:disabled{opacity:.45;cursor:default}' +
    '@media (max-width:640px){#ichat-panel{inset:0;width:auto;height:auto;border-radius:0}}';
    document.head.appendChild(st);
    var P = document.createElement('div'); P.id = 'ichat-panel'; P.setAttribute('role', 'dialog');
    var head = document.createElement('div'); head.id = 'ichat-head';
    var ti = document.createElement('span'); ti.className = 't'; ti.id = 'ichat-title';
    var cb = document.createElement('button'); cb.type = 'button'; cb.textContent = '닫기'; cb.onclick = _ihToggle;
    head.append(ti, cb);
    var th = document.createElement('div'); th.id = 'ichat-thread'; th.setAttribute('aria-live', 'polite');
    var ex = document.createElement('div'); ex.id = 'ichat-ex';
    var form = document.createElement('form'); form.id = 'ichat-form';
    var inp = document.createElement('textarea'); inp.id = 'ichat-in'; inp.rows = 1; inp.maxLength = 500;
    var sb = document.createElement('button'); sb.type = 'submit'; sb.id = 'ichat-send'; sb.textContent = '보내기';
    form.append(inp, sb);
    form.onsubmit = function (e) { e.preventDefault(); var t = inp.value.trim(); if (t) { inp.value = ''; _ihSend(t); } };
    inp.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } };
    P.append(head, th, ex, form); document.body.appendChild(P);
  }
}
/** 인프라가 바뀔 때 제목·예시·안내 문구를 바꾸고, 그 인프라의 이전 대화를 되살린다. */
function _ihRefresh() {
  var c = _ih.cfg, P = _el('ichat-panel'); if (!c || !P) return;
  P.setAttribute('aria-label', c.label + ' 대화'); _el('ichat-title').textContent = c.label;
  var inp = _el('ichat-in'); inp.placeholder = c.placeholder || '말씀해 주세요'; inp.setAttribute('aria-label', c.label + '에게 말하기');
  var ex = _el('ichat-ex'); ex.textContent = '';
  (c.examples || []).forEach(function (t) { var b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = function () { _ihSend(t); }; ex.appendChild(b); });
  var th = _el('ichat-thread'); th.textContent = '';
  (_ih.hist[c.key] || []).forEach(function (m) { _ihBubble(m.r, m.t, m.r === 'assistant' ? _orgMd(m.t) : null, true); });
  if (!(_ih.hist[c.key] || []).length) _ihBubble('assistant', c.greeting || ('안녕하세요. ' + c.label + '입니다. 무엇을 도와드릴까요?'), null, false, c.key);
}
function _ihToggle() {
  var p = _el('ichat-panel'); if (!p) return;
  _ih.open = !p.classList.contains('open'); p.classList.toggle('open', _ih.open);
  if (_ih.open) { try { var fab = _el('hchat-fab'); if (fab) fab.classList.remove('badge'); } catch (x) {} var i = _el('ichat-in'); if (i) setTimeout(function () { try { i.focus(); } catch (x) {} }, 50); }
}
function _ihBubble(role, text, html, noSave, key) {
  var th = _el('ichat-thread'); if (!th) return null;
  var row = document.createElement('div'); row.className = 'chat-bubble-row ' + role; var b = document.createElement('div'); b.className = 'chat-bubble' + (role === 'assistant' ? ' org-md' : '');
  if (html) b.innerHTML = html; else b.textContent = text;   // html 은 _orgMd(모든 글자를 먼저 이스케이프) 결과 또는 고정 문구만
  row.appendChild(b); th.appendChild(row); th.scrollTop = th.scrollHeight; return b;
}
function _ihNote(text, bad) { var th = _el('ichat-thread'); if (!th) return; var n = document.createElement('div'); n.className = 'lc-note' + (bad ? ' bad' : ''); n.textContent = text; th.appendChild(n); th.scrollTop = th.scrollHeight; }
function _ihKeep(role, text) { var c = _ih.cfg; if (!c) return; var h = _ih.hist[c.key] = _ih.hist[c.key] || []; h.push({ r: role, t: String(text).slice(0, 4000) }); if (h.length > 40) h.splice(0, h.length - 40); }
function _ihSend(text) {
  text = String(text || '').trim().slice(0, 500); if (!text || !_ih.active) return;
  if (_ih.busy) { _ihNote('앞의 질문에 답하는 중입니다. 잠시만 기다려 주세요.'); return; }
  var P = _el('ichat-panel'); if (P && !P.classList.contains('open')) _ihToggle();
  _ihBubble('user', text); _ihKeep('user', text);
  if (_ih.hook) { var hr = null; try { hr = _ih.hook(text, _ih.cfg.key); } catch (e) { hr = null; } if (typeof hr === 'string' && hr) { _ihBubble('assistant', hr, _orgMd(hr)); _ihKeep('assistant', hr); return; } }   // 화면이 직접 처리하는 말(예: 시장의 상품 찾기)은 SP 에 보내지 않고 화면 답을 보여 준다
  var wb = _ihBubble('assistant', '', '<span class="org-wait" role="status"><i aria-hidden="true">⏳</i><span>답변 준비 중<span class="org-dots"></span></span></span>');
  var id = 'ic' + Date.now(), m = { type: 'hondi-embed-sp-ask', id: id, text: text };
  _ih.busy = true; _ih.pending[id] = { el: wb, key: _ih.cfg.key };
  setTimeout(function () {   // SP 가 늦으면 알린다
    if (!_ih.pending[id]) return; delete _ih.pending[id]; _ih.busy = false; wb.innerHTML = _orgMd('응답이 늦어지고 있습니다. 잠시 뒤 다시 말씀해 주세요.');
  }, 40000);
  if (_ih.ready) HondiChat.post(m); else _ih.queue.push(m);
}
window.addEventListener('message', function (e) {   // SP 의 답 — 나비웹 대화창(숨은 프레임)에서 온 것만
  var d = e.data; if (!d || typeof d !== 'object' || !window.HondiChat || e.source !== HondiChat.frameWindow() || !_hcOrigin(e)) return;
  if (d.type === 'hondi-embed-sp-ready' && _ih.active) { _ih.ready = true; _ih.queue.splice(0).forEach(function (m) { HondiChat.post(m); }); return; }
  if (d.type !== 'hondi-embed-sp-reply' || !_ih.pending[d.id]) return;
  var it = _ih.pending[d.id]; delete _ih.pending[d.id]; _ih.busy = false;
  var txt = String(d.text || '').trim() || '답변을 받지 못했습니다. 다시 말씀해 주세요.';
  it.el.innerHTML = _orgMd(txt); var h = _ih.hist[it.key] = _ih.hist[it.key] || []; h.push({ r: 'assistant', t: txt.slice(0, 4000) }); if (h.length > 40) h.splice(0, h.length - 40);
  var th = _el('ichat-thread'); if (th) th.scrollTop = th.scrollHeight;
});
/** 화면 안의 '묻기' 단추 — 대화창을 열고 말을 채워 준다(보내지는 않는다). */
function _ihAsk(text) {
  if (!_ih.active) return; var p = _el('ichat-panel'); if (p && !p.classList.contains('open')) _ihToggle();
  var i = _el('ichat-in'), t = typeof text === 'string' ? text.slice(0, 500) : ''; if (i && t) { i.value = t; try { i.focus(); } catch (x) {} }
}
/** 화면이 대화창에 말을 덧붙인다(예: 도우미가 찾아 온 후보). open 이면 대화창을 연다. */
function _ihSay(text, open) {
  if (!_ih.active || !text) return; text = String(text).slice(0, 4000);
  _ihBubble('assistant', text, _orgMd(text)); _ihKeep('assistant', text);
  var p = _el('ichat-panel'); if (open && p && !p.classList.contains('open')) _ihToggle();
}
window.InfraHost = { hook: function (f) { _ih.hook = typeof f === 'function' ? f : null; }, say: _ihSay, enter: _ihEnter, leave: _ihLeave, ask: _ihAsk, cur: function () { return _ih.active && _ih.cfg ? _ih.cfg.key : ''; }, active: function () { return _ih.active; } };
})();
