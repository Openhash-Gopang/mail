/**
 * hondi-chat.js — K-Mail 화면 우측 하단 "혼디 대화" 떠 있는 버튼 + 패널 (2026-10-28, 주피터 지시)
 *
 * 혼디의 1:1 대화(WebRTC P2P)는 https://hondi.net/webapp.html 이 이미 갖고 있다. 그 대화를 코드 수정 없이 그대로 쓰기 위해
 * K-Mail 화면 위에 그 페이지를 떠 있는 패널(iframe)로 띄운다. K-Mail 과는 별개로 동작하며, 로그인·지갑·상대 찾기·연결은 전부 혼디 앱의 것이다.
 *
 *  - 버튼을 처음 누를 때 페이지를 불러온다(평소에는 아무것도 받지 않는다). 한 번 열면 닫아도 패널을 숨기기만 하고 살려 둬서,
 *    통화 신호(상대의 대화 요청)를 계속 받을 수 있다.
 *  - 혼디 앱이 window.parent.postMessage({ type: 'hondi:incoming' }, '*') 를 보내 주면(선택) 패널을 자동으로 열고 버튼에 표시한다.
 *  - iframe 으로 열리지 않는 환경(보안 헤더 등)이면 "새 창" 버튼으로 같은 페이지를 팝업으로 연다.
 *
 * 전역: window.HondiChat = { mount, open, close, toggle, isOpen, _pure }
 */
(function (root) {
  'use strict';
  var URL_DEFAULT = 'https://hondi.net/webapp.html';
  var KEY_OPEN = 'kmail_hchat_open';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /** 순수 함수 — 패널 크기. 좁은 화면(폰)은 화면 전체, 넓은 화면은 우측 하단 카드. */
  function panelBox(vw, vh) {
    if (vw <= 640) return { full: true, width: vw, height: vh };
    return { full: false, width: Math.min(440, vw - 32), height: Math.max(420, Math.min(780, vh - 110)) };
  }
  /** 순수 함수 — 메시지 출처가 혼디 앱이고 "수신 대화 요청" 알림인지. */
  function isIncomingMessage(ev, allowedOrigin) {
    if (!ev || !ev.data || typeof ev.data !== 'object') return false;
    if (ev.origin !== allowedOrigin) return false;
    return ev.data.type === 'hondi:incoming';
  }
  /**
   * 순수 함수 — 공유 로그인 쿠키(hondi_pvt)에서 K-Mail 로그인 아이디 뽑기.
   * 혼디 앱은 같은 쿠키를 쓰는 서비스끼리 로그인을 공유한다. 테스트 기간 아이디 로그인의 토큰 형식은 'tid-<아이디>:<만료>.<서명>'.
   * 전화 인증 토큰(tid- 로 시작하지 않음)이면 아이디를 알 수 없으므로 ''.
   */
  function testIdFromToken(token) {
    var t = String(token == null ? '' : token);
    if (t.indexOf('tid-') !== 0) return '';
    var end = t.indexOf(':'); var id = (end < 0 ? t.slice(4) : t.slice(4, end)).trim();
    return /^[A-Za-z0-9가-힣_-]{2,20}$/.test(id) ? id : '';
  }
  /** 순수 함수 — 패널 주소. 아이디를 알면 ?testid= 로 혼디 앱이 그 아이디로 입장하게 한다(혼디 앱이 이미 지원하는 전환 주소). */
  function panelUrl(base, id) {
    if (!id) return base;
    return base + (base.indexOf('?') < 0 ? '?' : '&') + 'testid=' + encodeURIComponent(id);
  }
  function readCookie(name) {
    try { var m = root.document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; }
  }
  function currentLoginId() { return testIdFromToken(readCookie('hondi_pvt')); }
  /** 전화 인증으로 로그인한 경우(tid- 가 아닌 토큰) — 혼디 앱이 공유 쿠키로 그 계정을 이어받는다. */
  function hasRealLogin() { var t = readCookie('hondi_pvt'); return !!t && t.indexOf('tid-') !== 0; }
  function originOf(url) { try { return new URL(url).origin; } catch (e) { return ''; } }

  var S = { mounted: false, loaded: false, loadedId: '', open: false, badge: false, url: URL_DEFAULT, els: null };

  function storeGet() { try { return root.localStorage.getItem(KEY_OPEN) === '1'; } catch (e) { return false; } }
  function storeSet(v) { try { root.localStorage.setItem(KEY_OPEN, v ? '1' : '0'); } catch (e) { /* 저장은 편의 기능 */ } }

  function injectStyle(doc) {
    if (doc.getElementById('hchat-style')) return;
    var st = doc.createElement('style'); st.id = 'hchat-style';
    st.textContent = [
      '#hchat-fab{position:fixed;right:20px;bottom:20px;z-index:9990;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;background:var(--pri,#0F8F7E);color:#fff;font-size:26px;line-height:1;box-shadow:0 6px 20px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center}',
      '#hchat-fab:hover{filter:brightness(1.08)}',
      '#hchat-fab .hchat-dot{position:absolute;top:6px;right:6px;width:14px;height:14px;border-radius:50%;background:#E5484D;border:2px solid #fff;display:none}',
      '#hchat-fab.badge .hchat-dot{display:block}',
      '#hchat-panel{position:fixed;right:20px;bottom:86px;z-index:9991;display:none;flex-direction:column;background:#fff;border:1px solid var(--bdr,#d8dee6);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.3);overflow:hidden}',
      '#hchat-panel.open{display:flex}',
      '#hchat-panel.full{right:0;bottom:0;left:0;top:0;border-radius:0;border:0}',
      '#hchat-head{display:flex;align-items:center;gap:6px;padding:8px 10px;background:var(--gov,#0B3B33);color:#fff;font-size:14px;font-weight:700}',
      '#hchat-head .sp{flex:1}',
      '#hchat-head button{border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:6px;padding:4px 9px;font-size:13px;cursor:pointer;font-family:inherit}',
      '#hchat-head button:hover{background:rgba(255,255,255,.28)}',
      '#hchat-frame{flex:1;border:0;width:100%;min-height:0;background:#fff}',
      '#hchat-note{padding:6px 10px;font-size:12px;color:#5b6676;background:#f4f7f9;border-top:1px solid #e3e8ee}',
    ].join('');
    doc.head.appendChild(st);
  }

  function layout() {
    if (!S.els) return;
    var b = panelBox(root.innerWidth || 1024, root.innerHeight || 768), p = S.els.panel;
    p.classList.toggle('full', b.full);
    if (b.full) { p.style.width = ''; p.style.height = ''; } else { p.style.width = b.width + 'px'; p.style.height = b.height + 'px'; }
  }
  function paint() {
    if (!S.els) return;
    S.els.panel.classList.toggle('open', S.open);
    S.els.fab.classList.toggle('badge', S.badge && !S.open);
    S.els.fab.setAttribute('aria-expanded', String(S.open));
    S.els.fab.title = S.open ? '혼디 대화 닫기' : '혼디 대화';
  }
  function setNote(id, real) {
    var n = S.els && S.els.panel.querySelector('#hchat-note'); if (!n) return;
    n.textContent = id ? 'K-Mail 아이디 “' + id + '”로 혼디에 연결했습니다. 대화 상대는 혼디 앱 안에서 찾으세요.'
                : real ? 'K-Mail에 로그인한 계정으로 혼디에 연결합니다. 대화 상대는 혼디 앱 안에서 찾으세요.'
                       : 'K-Mail과 별개로 혼디 앱(hondi.net)이 동작합니다. 혼디 계정으로 로그인하세요.';
  }
  /** 패널 안 혼디 페이지에 "이 화면의 기본 SP 로 AI 입력을 넘겨 달라"고 알린다(embed-delegate.js 규약). 페이지가 그 규약을 모르면 아무 일도 없다. */
  function post(msg) {
    var f = S.els && S.els.frame; if (!f || !f.contentWindow) return false;
    try { f.contentWindow.postMessage(msg, originOf(S.url)); return true; } catch (e) { return false; }
  }
  function announce() { post({ type: 'hondi-embed-host', v: 1, ai: 'delegate' }); }
  function frameWindow() { return S.els && S.els.frame ? S.els.frame.contentWindow : null; }
  /** 처음 열 때 불러오고, K-Mail 로그인 아이디가 바뀌었으면(다른 아이디로 다시 로그인) 새 아이디로 다시 불러온다. */
  function ensureLoaded() {
    if (!S.els) return;
    var id = currentLoginId(), real = !id && hasRealLogin(), key = id || (real ? '*' : '');
    if (S.loaded && key === S.loadedId) return;
    S.loaded = true; S.loadedId = key;
    S.els.frame.setAttribute('src', panelUrl(S.url, id));
    if (!S.loadHook) { S.loadHook = true; S.els.frame.addEventListener('load', announce); }
    setNote(id, real);
  }
  function open() {
    if (!S.mounted) return;
    ensureLoaded(); S.open = true; S.badge = false; storeSet(true); layout(); paint();
  }
  function close() { S.open = false; storeSet(false); paint(); }   // 숨기기만 — 페이지는 살려 둬 상대의 대화 요청을 계속 받는다
  function toggle() { if (S.open) close(); else open(); }
  function popup() {
    try { root.open(S.url, 'hondi-chat', 'popup=yes,width=440,height=780'); } catch (e) { /* 팝업 차단은 브라우저 안내에 맡김 */ }
  }

  function mount(opts) {
    var doc = root.document;
    if (!doc || S.mounted || doc.getElementById('hchat-fab')) return;
    opts = opts || {};
    if (opts.url) S.url = opts.url;
    injectStyle(doc);
    var fab = doc.createElement('button');
    fab.id = 'hchat-fab'; fab.type = 'button'; fab.setAttribute('aria-label', '혼디 대화'); fab.setAttribute('aria-controls', 'hchat-panel');
    fab.innerHTML = '<span aria-hidden="true">💬</span><span class="hchat-dot"></span>';
    var panel = doc.createElement('div');
    panel.id = 'hchat-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', '혼디 대화');
    panel.innerHTML =
      '<div id="hchat-head"><span>💬 혼디 대화</span><span class="sp"></span>' +
      '<button type="button" data-hchat="popup" title="새 창으로 열기">↗ 새 창</button>' +
      '<button type="button" data-hchat="close" title="닫기(대화는 계속 받습니다)">닫기</button></div>' +
      '<iframe id="hchat-frame" title="혼디 대화" allow="microphone; camera; clipboard-write; clipboard-read; notifications; autoplay; fullscreen"></iframe>' +
      '<div id="hchat-note">K-Mail과 별개로 혼디 앱(hondi.net)이 동작합니다. 혼디 계정으로 로그인하세요.</div>';
    doc.body.appendChild(fab); doc.body.appendChild(panel);
    S.els = { fab: fab, panel: panel, frame: panel.querySelector('#hchat-frame') };
    fab.addEventListener('click', toggle);
    panel.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-hchat]') : null; if (!t) return;
      var a = t.getAttribute('data-hchat'); if (a === 'close') close(); else if (a === 'popup') popup();
    });
    root.addEventListener('resize', layout);
    root.addEventListener('message', function (ev) {
      if (!isIncomingMessage(ev, originOf(S.url))) return;
      S.badge = true; if (!S.open) open(); else paint();   // 상대의 대화 요청 — 패널을 열어 수락 창이 보이게 한다
    });
    root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.open && S.els.panel.contains(doc.activeElement)) close(); });
    S.mounted = true; layout(); paint();
    if (storeGet() && opts.restore !== false) open();   // 지난번에 열어 둔 채였다면 다시 연다(통화 신호를 받기 위해)
  }

  var API = {
    mount: mount, open: open, close: close, toggle: toggle, isOpen: function () { return S.open; }, post: post, frameWindow: frameWindow,
    _pure: { panelBox: panelBox, isIncomingMessage: isIncomingMessage, originOf: originOf, testIdFromToken: testIdFromToken, panelUrl: panelUrl },
    _state: S,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.HondiChat = API;
  if (root.document && !(typeof module !== 'undefined' && module.exports)) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { mount(); });
    else mount();
  }
})(typeof window !== 'undefined' ? window : globalThis);
