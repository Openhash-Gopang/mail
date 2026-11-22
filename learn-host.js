/**
 * learn-host.js — 나비웹 학습 화면의 "교육 SP 대화창" (2026-11-22, 주피터 지시)
 *
 * 인프라 AI → 교육을 고르면 학습 포털(learn.html)이 바로 열리고(desktop.html 의 _cmpOrgPick → _learnOpen),
 * 우하단 대화 아이콘은 이 파일의 교육 SP 대화창을 연다. 사용자가 "경제학 3주차 학습 페이지로 가자" 처럼 말하면
 * 교육 SP(learn-sp.js)가 답변 끝에 ~~~learn 블록을 붙이고, 여기서 다시 검증한 뒤 learn.html 에 전한다.
 *
 * desktop.html 의 전역(HondiChat, _org, _prof, _orgMd, _hcOrigin, _switchTab …)을 쓴다. 전역: window.LearnHost = { enter, leave, ask }
 */
(function () {
'use strict';
var _learn = { active: false, ready: false, queue: [], pending: {}, state: null, prof: null, busy: false, greeted: false, open: false, pend: null };
function _learnEl(id) { return document.getElementById(id); }
function _learnEnter() {
  if (_learn.active) return;
  if (!window.HondiChat || !window.LearnSP) return;
  if (typeof _prof !== 'undefined' && _prof.active) _profLeave();
  if (typeof _org !== 'undefined' && _org) _orgLeave();   // 대화창은 하나 — 기관·전문가 대화를 쓰고 있었다면 먼저 닫는다
  try { if (HondiChat.isOpen()) HondiChat.close(); } catch (x) {}
  _learn.active = true; _learn.ready = false; _learn.queue = [];
  HondiChat.setSp({ type: 'hondi-embed-sp', sp: 'inline:learn:v1', spText: LearnSP.LEARN_SP, label: '교육 SP', greeting: '', role: '', context: '' });
  setTimeout(() => { if (_learn.active && !_learn.ready) { _learn.ready = true; _learn.queue.splice(0).forEach(m => HondiChat.post(m)); } }, 5000);   // 준비 신호가 늦어도 말은 전한다
  if (!_learn.fabHooked && window.HondiChat) { _learn.fabHooked = true; const prev = HondiChat.onFab; HondiChat.onFab = function () { if (_learn.active) { _lchatToggle(); return true; } return typeof prev === 'function' ? prev() : false; }; }   // 학습 화면이 열려 있으면 우하단 아이콘은 교육 SP 대화창을(그 밖의 화면은 이전 동작 그대로)
  _lchatBuild(); const fab = _learnEl('hchat-fab'); if (fab) fab.setAttribute('aria-label', '교육 SP 대화');
  try { HondiChat.notify(); } catch (x) {}   // 아이콘에 점으로 알린다
}
function _learnLeave() {
  if (!_learn.active) return;
  _learn.active = false; _learn.open = false; _learn.prof = null;
  const p = _learnEl('lchat-panel'); if (p) p.classList.remove('open');
  const fab = _learnEl('hchat-fab'); if (fab) fab.setAttribute('aria-label', '나비웹 대화');
  if (window.HondiChat && !(typeof _org !== 'undefined' && _org) && !(typeof _prof !== 'undefined' && _prof.active)) HondiChat.setSp(null);
}
function _learnProfName(subject) {
  const q = String(subject || '').trim(), cs = (_learn.state && _learn.state.courses) || [];
  const c = cs.find(x => x.id === q || x.name === q || x.subj === q || (q && (x.name.indexOf(q) >= 0 || (x.subj && (x.subj.indexOf(q) >= 0 || q.indexOf(x.subj) >= 0)))));
  return c && c.prof ? c.prof : (q ? q + ' 교수' : '교수');
}
function _lchatBuild() {
  if (_learnEl('lchat-panel')) return;
  const st = document.createElement('style');
  st.textContent = '#lchat-panel{position:fixed;right:20px;bottom:86px;z-index:9991;display:none;flex-direction:column;width:min(400px,calc(100vw - 32px));height:min(560px,calc(100vh - 110px));background:var(--sur,#fff);border:1px solid var(--bdr,#d8dee6);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.3);overflow:hidden}' +
    '#lchat-panel.open{display:flex}#lchat-head{display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--gov,#1E3F85);color:#fff;font-weight:700;font-size:14px}#lchat-head .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#lchat-head button{border:0;background:rgba(255,255,255,.16);color:#fff;border-radius:6px;padding:4px 9px;font-size:13px;cursor:pointer;font-family:inherit}#lchat-head button:hover{background:rgba(255,255,255,.3)}' +
    '#lchat-thread{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px}#lchat-thread .chat-bubble{font-size:14px;line-height:1.55}' +
    '#lchat-thread .lc-note{align-self:center;font-size:12px;color:var(--hint,#5b6676);background:var(--soft,#f4f7f9);border-radius:999px;padding:3px 12px;text-align:center}#lchat-thread .lc-note.bad{color:#B3261E}' +
    '#lchat-ex{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 8px}#lchat-ex button{border:1px solid var(--bdr,#d8dee6);background:var(--sur,#fff);color:inherit;border-radius:999px;padding:5px 11px;font-size:12.5px;cursor:pointer;font-family:inherit}#lchat-ex button:hover{background:var(--pri-bg,#E8F0FE)}' +
    '#lchat-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--bdr,#d8dee6)}#lchat-in{flex:1;resize:none;border:1px solid var(--bdr,#d8dee6);border-radius:10px;padding:8px 10px;font:inherit;font-size:14px;background:var(--bg,#fff);color:inherit;max-height:90px}' +
    '#lchat-send{border:0;background:var(--pri,#3B7DDD);color:#fff;border-radius:10px;padding:0 16px;font-weight:700;cursor:pointer;font-family:inherit}#lchat-send:disabled{opacity:.45;cursor:default}' +
    '@media (max-width:640px){#lchat-panel{inset:0;width:auto;height:auto;border-radius:0}}';
  document.head.appendChild(st);
  const P = document.createElement('div'); P.id = 'lchat-panel'; P.setAttribute('role', 'dialog'); P.setAttribute('aria-label', '교육 SP 대화');
  const head = document.createElement('div'); head.id = 'lchat-head';
  const ti = document.createElement('span'); ti.className = 't'; ti.id = 'lchat-title'; ti.textContent = '교육 SP';
  const eb = document.createElement('button'); eb.type = 'button'; eb.id = 'lchat-end'; eb.textContent = '교수 호출 끝'; eb.hidden = true; eb.onclick = () => _learnAct({ 'do': 'endprof' });
  const cb = document.createElement('button'); cb.type = 'button'; cb.textContent = '닫기'; cb.onclick = _lchatToggle;
  head.append(ti, eb, cb);
  const th = document.createElement('div'); th.id = 'lchat-thread'; th.setAttribute('aria-live', 'polite');
  const ex = document.createElement('div'); ex.id = 'lchat-ex';
  LearnSP.EXAMPLES.forEach(t => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = () => _lchatSend(t); ex.appendChild(b); });
  const form = document.createElement('form'); form.id = 'lchat-form';
  const inp = document.createElement('textarea'); inp.id = 'lchat-in'; inp.rows = 1; inp.maxLength = 300; inp.placeholder = '예: 경제학 3주차 학습 페이지로 가자'; inp.setAttribute('aria-label', '교육 SP 에게 말하기');
  const sb = document.createElement('button'); sb.type = 'submit'; sb.id = 'lchat-send'; sb.textContent = '보내기';
  form.append(inp, sb);
  form.onsubmit = (e) => { e.preventDefault(); const t = inp.value.trim(); if (t) { inp.value = ''; _lchatSend(t); } };
  inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } };
  P.append(head, th, ex, form); document.body.appendChild(P);
  _lchatBubble('assistant', '안녕하세요. 교육 SP입니다. 보고 싶은 과목·주차, 시험, 학습 기록을 말씀해 주시면 화면을 옮겨 드리고, 과목 교수도 불러 드립니다. 아래 예시를 눌러 보셔도 됩니다.');
}
function _lchatToggle() {
  const p = _learnEl('lchat-panel'); if (!p) return;
  _learn.open = !p.classList.contains('open'); p.classList.toggle('open', _learn.open);
  if (_learn.open) { try { const fab = _learnEl('hchat-fab'); if (fab) fab.classList.remove('badge'); } catch (x) {} const i = _learnEl('lchat-in'); if (i) setTimeout(() => { try { i.focus(); } catch (x) {} }, 50); }
}
function _lchatBubble(role, text, html) {
  const th = _learnEl('lchat-thread'); if (!th) return null;
  const row = document.createElement('div'); row.className = 'chat-bubble-row ' + role; const b = document.createElement('div'); b.className = 'chat-bubble' + (role === 'assistant' ? ' org-md' : '');
  if (html) b.innerHTML = html; else b.textContent = text;   // html 은 _orgMd(모든 글자를 먼저 이스케이프) 결과 또는 고정 문구만
  row.appendChild(b); th.appendChild(row); th.scrollTop = th.scrollHeight; return b;
}
function _lchatNote(text, bad) { const th = _learnEl('lchat-thread'); if (!th) return; const n = document.createElement('div'); n.className = 'lc-note' + (bad ? ' bad' : ''); n.textContent = text; th.appendChild(n); th.scrollTop = th.scrollHeight; }
function _lchatSend(text) {
  text = String(text || '').trim().slice(0, 300); if (!text || !_learn.active) return;
  if (_learn.busy) { _lchatNote('앞의 요청을 처리하는 중입니다. 잠시만 기다려 주세요.'); return; }
  const P = _learnEl('lchat-panel'); if (P && !P.classList.contains('open')) _lchatToggle();
  _lchatBubble('user', text);
  const wb = _lchatBubble('assistant', '', '<span class="org-wait" role="status"><i aria-hidden="true">⏳</i><span>답변 준비 중<span class="org-dots"></span></span></span>');
  const id = 'lc' + Date.now(), m = { type: 'hondi-embed-sp-ask', id, text: LearnSP.buildAsk(text, _learn.state, _learn.prof) };
  _learn.busy = true; _learn.pending[id] = { el: wb, text };
  setTimeout(() => {   // SP 가 늦으면 분명한 이동 명령만 규칙으로 처리한다
    if (!_learn.pending[id]) return; delete _learn.pending[id]; _learn.busy = false;
    const a = LearnSP.localIntent(text);
    if (a) { wb.innerHTML = _orgMd('교육 SP 응답이 늦어 요청을 직접 처리합니다.'); _learnAct(a); } else wb.innerHTML = _orgMd('응답이 늦어지고 있습니다. 잠시 뒤 다시 말씀해 주세요.');
  }, 40000);
  if (_learn.ready) HondiChat.post(m); else _learn.queue.push(m);
}
function _learnAct(raw) {
  const a = window.LearnSP && LearnSP.cleanAct(raw); if (!a) return;
  if (a['do'] === 'prof') { _learn.prof = _learnProfName(a.subject); _lchatSync(); _lchatNote(_learn.prof + '를 호출했습니다. 이제 이 교수가 답합니다.'); return; }
  if (a['do'] === 'endprof') { const was = _learn.prof; _learn.prof = null; _lchatSync(); if (was) _lchatNote('교수 호출을 마치고 교육 SP로 돌아왔습니다.'); return; }
  if (!document.getElementById('tab-learn').classList.contains('active')) _switchTab('learn');
  const f = _learnEl('learn-frame'); if (!f) return;
  const send = () => { try { f.contentWindow.postMessage(Object.assign({ type: 'navi-learn-nav' }, a), location.origin); } catch (x) {} };
  if (f.getAttribute('src') && f.contentWindow && _learn.state) send(); else { if (!f.getAttribute('src')) f.setAttribute('src', 'learn.html?embed=mail'); f.addEventListener('load', () => setTimeout(send, 200), { once: true }); }
}
function _lchatSync() {
  const t = _learnEl('lchat-title'), e = _learnEl('lchat-end'); if (t) t.textContent = _learn.prof || '교육 SP'; if (e) e.hidden = !_learn.prof;
  const i = _learnEl('lchat-in'); if (i) i.placeholder = _learn.prof ? _learn.prof + '에게 질문하세요' : '예: 경제학 3주차 학습 페이지로 가자';
}
window.addEventListener('message', (e) => {   // 학습 화면에서 온 소식 — 같은 출처·학습 프레임에서 온 것만
  const f = _learnEl('learn-frame'), d = e.data;
  if (!f || !d || typeof d !== 'object' || e.origin !== location.origin || e.source !== f.contentWindow) return;
  if (d.type === 'navi-learn-state' && d.state && typeof d.state === 'object') { _learn.state = d.state; return; }
  if (d.type === 'navi-learn-result') { if (_learn.active && typeof d.msg === 'string') _lchatNote((d.ok ? '✓ ' : '! ') + d.msg.slice(0, 200), !d.ok); return; }
  if (d.type === 'navi-learn-ask') { _learnAsk(d.text); }
});
window.addEventListener('message', (e) => {   // 교육 SP 의 답 — 나비웹 대화창(숨은 프레임)에서 온 것만
  const d = e.data; if (!d || typeof d !== 'object' || !window.HondiChat || e.source !== HondiChat.frameWindow() || !_hcOrigin(e)) return;
  if (d.type === 'hondi-embed-sp-ready' && _learn.active) { _learn.ready = true; _learn.queue.splice(0).forEach(m => HondiChat.post(m)); return; }
  if (d.type !== 'hondi-embed-sp-reply' || !_learn.pending[d.id]) return;
  const it = _learn.pending[d.id]; delete _learn.pending[d.id]; _learn.busy = false;
  const r = LearnSP.parseReply(d.text);
  it.el.innerHTML = _orgMd(r.text || (r.acts.length ? '요청하신 화면으로 옮깁니다.' : '답변을 받지 못했습니다. 다시 말씀해 주세요.'));
  const th = _learnEl('lchat-thread'); if (th) th.scrollTop = th.scrollHeight;
  if (r.acts.length) _learnAct(r.acts[0]); else { const a = /(이동|가자|열어|보여|전환|불러|시험|풀래)/.test(it.text) ? LearnSP.localIntent(it.text) : null; if (a) _learnAct(a); }   // 블록을 빠뜨렸을 때도 분명한 이동 명령은 놓치지 않는다
});

function _learnAsk(text) {   // 화면 안의 '교수에게 묻기' — 대화창을 열고 말을 채워 준다(보내지는 않는다)
  if (!_learn.active) _learnEnter(); if (!_learn.active) return;
  const p = _learnEl('lchat-panel'); if (p && !p.classList.contains('open')) _lchatToggle();
  const i = _learnEl('lchat-in'), t = typeof text === 'string' ? text.slice(0, 300) : ''; if (i && t) { i.value = t; try { i.focus(); } catch (x) {} }
}
window.LearnHost = { enter: _learnEnter, leave: _learnLeave, ask: _learnAsk };
// 이미 학습 화면이 열려 있다면(새로 고침 복원 등) 곧바로 켠다
if (document.getElementById('tab-learn') && document.getElementById('tab-learn').classList.contains('active')) _learnEnter();
})();
