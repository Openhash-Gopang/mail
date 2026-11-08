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
  var KEY_GEO = 'kmail_hchat_geo';
  var MIN_W = 300, MIN_H = 280;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /** 순수 함수 — 패널 크기. 좁은 화면(폰)은 화면 전체, 넓은 화면은 우측 하단 카드. */
  function panelBox(vw, vh) {
    if (vw <= 640) return { full: true, width: vw, height: vh };
    return { full: false, width: Math.min(440, vw - 32), height: Math.max(420, Math.min(780, vh - 110)) };
  }
  /** 순수 함수 — 사용자가 정한 패널 위치·크기를 화면 안으로 맞춘다(최소 크기, 화면보다 크지 않게, 머리줄은 항상 화면 안에 남게). g 가 올바르지 않으면 null. */
  function clampGeo(g, vw, vh) {
    if (!g || [g.left, g.top, g.width, g.height].some(function (n) { return typeof n !== 'number' || !isFinite(n); })) return null;
    var w = Math.min(Math.max(g.width, Math.min(MIN_W, vw)), vw), h = Math.min(Math.max(g.height, Math.min(MIN_H, vh)), vh);
    var left = Math.min(Math.max(g.left, 0), Math.max(0, vw - w)), top = Math.min(Math.max(g.top, 0), Math.max(0, vh - h));
    return { left: Math.round(left), top: Math.round(top), width: Math.round(w), height: Math.round(h) };
  }
  /** 순수 함수 — 가장자리·모서리(dir: n s e w ne nw se sw)를 (dx,dy)만큼 끌었을 때의 새 위치·크기(최소 크기 아래로는 줄지 않는다). */
  function resizeGeo(g, dir, dx, dy) {
    var l = g.left, t = g.top, w = g.width, h = g.height;
    if (dir.indexOf('e') >= 0) w = g.width + dx;
    if (dir.indexOf('s') >= 0) h = g.height + dy;
    if (dir.indexOf('w') >= 0) { w = g.width - dx; l = g.left + dx; }
    if (dir.indexOf('n') >= 0) { h = g.height - dy; t = g.top + dy; }
    if (w < MIN_W) { if (dir.indexOf('w') >= 0) l -= (MIN_W - w); w = MIN_W; }
    if (h < MIN_H) { if (dir.indexOf('n') >= 0) t -= (MIN_H - h); h = MIN_H; }
    return { left: l, top: t, width: w, height: h };
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

  var S = { geo: null, mounted: false, loaded: false, loadedId: '', open: false, badge: false, url: URL_DEFAULT, els: null };

  function storeGet() { try { return root.localStorage.getItem(KEY_OPEN) === '1'; } catch (e) { return false; } }
  function storeSet(v) { try { root.localStorage.setItem(KEY_OPEN, v ? '1' : '0'); } catch (e) { /* 저장은 편의 기능 */ } }

  function geoGet() { try { var g = JSON.parse(root.localStorage.getItem(KEY_GEO) || 'null'); return g && typeof g === 'object' ? g : null; } catch (e) { return null; } }
  function geoSet(g) { try { if (g) root.localStorage.setItem(KEY_GEO, JSON.stringify(g)); else root.localStorage.removeItem(KEY_GEO); } catch (e) { /* 저장은 편의 기능 */ } }

  function injectStyle(doc) {
    if (doc.getElementById('hchat-style')) return;
    var st = doc.createElement('style'); st.id = 'hchat-style';
    st.textContent = [
      '#hchat-fab{position:fixed;right:20px;bottom:20px;z-index:9990;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;background:var(--pri,#0F8F7E);color:#fff;font-size:26px;line-height:1;box-shadow:0 6px 20px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center}',
      '#hchat-fab:hover{filter:brightness(1.08)}',
      '#hchat-fab .hchat-dot{position:absolute;top:6px;right:6px;width:14px;height:14px;border-radius:50%;background:#E5484D;border:2px solid #fff;display:none}',
      '#hchat-fab.badge .hchat-dot{display:block}',
      '#hchat-panel{position:fixed;right:20px;bottom:86px;z-index:9991;display:none;flex-direction:column;background:#fff;border:1px solid var(--bdr,#d8dee6);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.3);overflow:hidden;opacity:.8;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}',   /* 반투명 — 뒤 화면(서류·입력창)이 흐릿하게 비쳐 입력칸이 비었는지 알 수 있다 */
      '#hchat-panel.open{display:flex}',
      '#hchat-panel.full{right:0;bottom:0;left:0;top:0;border-radius:0;border:0}',
      '#hchat-head{display:flex;align-items:center;gap:6px;padding:8px 10px;background:var(--gov,#0B3B33);color:#fff;font-size:14px;font-weight:700}',
      '#hchat-head .sp{flex:1}',
      '#hchat-head{position:relative;min-height:36px}',
      '#hchat-agent{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:inline-flex;align-items:center;justify-content:center;max-width:46%;pointer-events:none}',
      '#hchat-agent a{pointer-events:auto}',
      '#hchat-head button{border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:6px;padding:4px 9px;font-size:13px;cursor:pointer;font-family:inherit}',
      '#hchat-head button:hover{background:rgba(255,255,255,.28)}',
      '#hchat-head{cursor:move;touch-action:none;user-select:none;-webkit-user-select:none}',
      '#hchat-head button,#hchat-head a{cursor:pointer}',
      '#hchat-panel.dragging{user-select:none;-webkit-user-select:none}',
      '#hchat-panel.dragging #hchat-frame{pointer-events:none}',
      '#hchat-panel.full .hchat-rz{display:none}',
      '.hchat-rz{position:absolute;z-index:3;touch-action:none}',
      '.hchat-rz[data-dir=n]{top:0;left:14px;right:14px;height:6px;cursor:ns-resize}',
      '.hchat-rz[data-dir=s]{bottom:0;left:14px;right:14px;height:6px;cursor:ns-resize}',
      '.hchat-rz[data-dir=e]{right:0;top:14px;bottom:14px;width:6px;cursor:ew-resize}',
      '.hchat-rz[data-dir=w]{left:0;top:14px;bottom:14px;width:6px;cursor:ew-resize}',
      '.hchat-rz[data-dir=ne]{top:0;right:0;width:14px;height:14px;cursor:nesw-resize}',
      '.hchat-rz[data-dir=nw]{top:0;left:0;width:14px;height:14px;cursor:nwse-resize}',
      '.hchat-rz[data-dir=se]{bottom:0;right:0;width:14px;height:14px;cursor:nwse-resize}',
      '.hchat-rz[data-dir=sw]{bottom:0;left:0;width:14px;height:14px;cursor:nesw-resize}',
      '#hchat-frame{flex:1;border:0;width:100%;min-height:0;background:#fff}',
      '#hchat-busy{display:none;padding:7px 12px 9px;font-size:13px;color:#1b2733;background:#eef4ff;border-top:1px solid #d6e2f7}',
      '#hchat-busy.on{display:block}',
      '#hchat-busy .bar{position:relative;height:4px;margin-top:6px;border-radius:2px;background:#d6e2f7;overflow:hidden}',
      '#hchat-busy .bar::after{content:"";position:absolute;top:0;bottom:0;width:38%;border-radius:2px;background:var(--pri,#3B7DDD);animation:hchat-bar 1.2s ease-in-out infinite}',
      '@keyframes hchat-bar{0%{left:-40%}100%{left:102%}}',
      '@media (prefers-reduced-motion:reduce){#hchat-busy .bar::after{animation:none;width:100%;opacity:.5}}',
      '#hchat-note{padding:6px 10px;font-size:12px;color:#5b6676;background:#f4f7f9;border-top:1px solid #e3e8ee}',
    ].join('');
    doc.head.appendChild(st);
  }

  function layout() {
    if (!S.els) return;
    var b = panelBox(root.innerWidth || 1024, root.innerHeight || 768), p = S.els.panel;
    p.classList.toggle('full', b.full);
    if (b.full) { p.style.width = ''; p.style.height = ''; p.style.left = ''; p.style.top = ''; p.style.right = ''; p.style.bottom = ''; return; }
    var g = S.geo ? clampGeo(S.geo, root.innerWidth || 1024, root.innerHeight || 768) : null;   // 사용자가 옮기거나 키운 위치·크기가 있으면 그대로(화면 안으로만 맞춘다)
    if (g) { p.style.left = g.left + 'px'; p.style.top = g.top + 'px'; p.style.right = 'auto'; p.style.bottom = 'auto'; p.style.width = g.width + 'px'; p.style.height = g.height + 'px'; }
    else { p.style.left = ''; p.style.top = ''; p.style.right = ''; p.style.bottom = ''; p.style.width = b.width + 'px'; p.style.height = b.height + 'px'; }
  }
  /** 머리줄을 끌어 옮기고, 가장자리·모서리를 끌어 크기를 바꾼다. 더블클릭하면 원래 위치·크기로. 정한 값은 이 브라우저에 기억한다. */
  function wireGeometry(doc, panel) {
    var head = panel.querySelector('#hchat-head');
    ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(function (d) { var h = doc.createElement('div'); h.className = 'hchat-rz'; h.setAttribute('data-dir', d); h.setAttribute('aria-hidden', 'true'); panel.appendChild(h); });
    head.title = '끌어서 옮기기 · 가장자리를 끌어 크기 조절 · 더블클릭하면 원래대로';
    function current() { var r = panel.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }
    function begin(e, dir) {
      if (e.button != null && e.button !== 0) return;
      if (panel.classList.contains('full')) return;
      e.preventDefault();
      var start = current(), x0 = e.clientX, y0 = e.clientY, vw = root.innerWidth || 1024, vh = root.innerHeight || 768, el = e.currentTarget;
      panel.classList.add('dragging');
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* 캡처가 안 돼도 창 이벤트로 이어진다 */ }
      function move(ev) {
        var dx = ev.clientX - x0, dy = ev.clientY - y0, g;
        if (dir === 'move') g = { left: start.left + dx, top: start.top + dy, width: start.width, height: start.height };
        else g = resizeGeo(start, dir, dx, dy);
        S.geo = clampGeo(g, vw, vh); layout();
      }
      function end() {
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', end); el.removeEventListener('pointercancel', end);
        panel.classList.remove('dragging'); geoSet(S.geo);
      }
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    }
    head.addEventListener('pointerdown', function (e) { if (e.target.closest && e.target.closest('button,a,input,select')) return; begin(e, 'move'); });
    head.addEventListener('dblclick', function (e) { if (e.target.closest && e.target.closest('button,a,input,select')) return; S.geo = null; geoSet(null); layout(); });
    panel.querySelectorAll('.hchat-rz').forEach(function (h) { h.addEventListener('pointerdown', function (e) { begin(e, h.getAttribute('data-dir')); }); });
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
  function announce() { post({ type: 'hondi-embed-host', v: 1, ai: S.spMsg ? 'self' : 'delegate' }); if (S.spMsg) post(S.spMsg); }
  /** 패널의 SP 를 바꾼다(각종 기관 선택). msg 가 null 이면 이 화면 기본 SP 위임으로 되돌린다. 페이지가 다시 로드돼도 announce() 가 다시 보낸다. */
  function setSp(msg) {
    S.spMsg = msg || null;
    if (S.mounted) ensureLoaded();   // 패널은 열지 않는다 — 대화는 메일 화면 안에서 보인다
    post({ type: 'hondi-embed-host', v: 1, ai: S.spMsg ? 'self' : 'delegate' });
    post(S.spMsg || { type: 'hondi-embed-sp', sp: null });
  }
  /** 대화창에 AI 말풍선 한 줄을 보여 준다(모델 호출 없음). 창이 아직 로드 중이면 로드된 뒤 보낸다. */
  function say(text) {
    if (!S.mounted) return; S.sayQ = S.sayQ || []; S.sayQ.push(String(text || '').slice(0, 600)); open();
    setTimeout(flushSay, S.loadedOnce ? 50 : 900);
  }
  function flushSay() { var q = S.sayQ || []; while (q.length) { if (!post({ type: 'hondi-embed-say', text: q[0] })) break; q.shift(); } }
  /** 대화창 아래에 "잠시 기다려 주세요" 줄과 진행 막대를 보인다(모델 응답이 느려도 멈춘 것으로 보이지 않게). 응답이 오면 idle() 로 끈다. 안전장치로 maxMs 뒤에는 저절로 꺼진다. */
  function busy(text, maxMs) {
    var el = S.els && S.els.panel.querySelector('#hchat-busy'); if (!el) return;
    el.querySelector('.msg').textContent = String(text || '잠시만 기다려 주세요…').slice(0, 200); el.classList.add('on');
    clearTimeout(S.busyT); S.busyT = setTimeout(idle, maxMs || 90000);
  }
  function idle() {
    clearTimeout(S.busyT);
    var el = S.els && S.els.panel.querySelector('#hchat-busy'); if (el) el.classList.remove('on');
  }
  function frameWindow() { return S.els && S.els.frame ? S.els.frame.contentWindow : null; }
  /** 처음 열 때 불러오고, K-Mail 로그인 아이디가 바뀌었으면(다른 아이디로 다시 로그인) 새 아이디로 다시 불러온다. */
  function ensureLoaded() {
    if (!S.els) return;
    var id = currentLoginId(), real = !id && hasRealLogin(), key = id || (real ? '*' : '');
    if (S.loaded && key === S.loadedId) return;
    S.loaded = true; S.loadedId = key;
    S.els.frame.setAttribute('src', panelUrl(S.url, id));
    if (!S.loadHook) { S.loadHook = true; S.els.frame.addEventListener('load', function () { S.loadedOnce = true; announce(); setTimeout(flushSay, 500); }); }
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
      '<div id="hchat-head"><span class="sp"></span><span id="hchat-agent"></span><span class="sp"></span>' +
      '<button type="button" data-hchat="popup" title="새 창으로 열기">↗ 새 창</button>' +
      '<button type="button" data-hchat="close" title="닫기(대화는 계속 받습니다)">닫기</button></div>' +
      '<iframe id="hchat-frame" title="혼디 대화" allow="microphone; camera; clipboard-write; clipboard-read; notifications; autoplay; fullscreen"></iframe>' +
      '<div id="hchat-busy" role="status" aria-live="polite"><span class="msg"></span><div class="bar" aria-hidden="true"></div></div>' +
      '<div id="hchat-note">K-Mail과 별개로 혼디 앱(hondi.net)이 동작합니다. 혼디 계정으로 로그인하세요.</div>';
    doc.body.appendChild(fab); doc.body.appendChild(panel);
    if (typeof window !== 'undefined' && typeof window._agentBadgePlace === 'function') window._agentBadgePlace();   // "나비웹 도우미 0.x.x" 는 대화창 상단 중앙에 둔다
    S.els = { fab: fab, panel: panel, frame: panel.querySelector('#hchat-frame') };
    S.geo = geoGet(); wireGeometry(doc, panel);
    fab.addEventListener('click', function () { if (root.HondiChat && typeof root.HondiChat.onFab === 'function' && root.HondiChat.onFab()) return; toggle(); });   // onFab: 화면(탭)이 아이콘 동작을 대신 맡고 싶을 때(true 를 돌려주면 기본 동작 생략)
    panel.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-hchat]') : null; if (!t) return;
      var a = t.getAttribute('data-hchat'); if (a === 'close') close(); else if (a === 'popup') popup();
    });
    root.addEventListener('resize', layout);
    root.addEventListener('message', function (ev) {
      if (!isIncomingMessage(ev, originOf(S.url))) return;
      S.badge = true; if (!S.open) open(); else paint();   // 상대의 대화 요청 — 패널을 열어 수락 창이 보이게 한다
    });
    root.addEventListener('message', function (ev) {   // 혼디 페이지가 직접 답하는 동안(서류 SP 등 ai:self)에도 진행 막대를 켜고 끈다
      var d = ev && ev.data;
      if (!d || typeof d !== 'object' || d.type !== 'hondi-embed-busy' || ev.origin !== originOf(S.url) || ev.source !== frameWindow()) return;
      if (d.on) busy('잠시 기다려 주십시오…', 120000); else idle();
    });
    root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.open && S.els.panel.contains(doc.activeElement)) close(); });
    S.mounted = true; layout(); paint();
    if (storeGet() && opts.restore !== false) {   // 지난번에 열어 둔 채였다면 다시 연다(통화 신호를 받기 위해)
      // 2026-11-04 속도 개선 — hondi.net/webapp.html(2.7초)을 첫 화면과 함께 받으면 새로고침 표시가 5.8초까지 이어진다. 화면이 뜬 뒤(load + 1.5초)에 연다.
      var restore = function () { if (!S.open) open(); };
      if (doc.readyState === 'complete') setTimeout(restore, 1500);
      else root.addEventListener('load', function () { setTimeout(restore, 1500); });
    }
  }

  var API = {
    mount: mount, open: open, close: close, toggle: toggle, isOpen: function () { return S.open; }, post: post, frameWindow: frameWindow, setSp: setSp, say: say, busy: busy, idle: idle,
    _pure: { clampGeo: clampGeo, resizeGeo: resizeGeo, panelBox: panelBox, isIncomingMessage: isIncomingMessage, originOf: originOf, testIdFromToken: testIdFromToken, panelUrl: panelUrl },
    _state: S,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.HondiChat = API;
  if (root.document && !(typeof module !== 'undefined' && module.exports)) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { mount(); });
    else mount();
  }
})(typeof window !== 'undefined' ? window : globalThis);
