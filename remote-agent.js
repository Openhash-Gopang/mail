/* 나비웹 원격 브라우저 보기 — 설치 없이 서류 작성의 후속 절차(인터넷등기소·전자소송)를 도우미가 대신 진행한다.
 * 서버의 격리된 브라우저 화면을 이 창에 실시간으로 보여 주고, 로그인(간편인증)·결제는 사용자가 이 화면에서 직접 한다.
 * 비밀번호·인증서·결제 정보는 도우미(AI)에게 전달되지 않는다. */
(function (root) {
  'use strict';
  var GATEWAY = 'https://naviweb-agent-gateway.tensor-city.workers.dev';
  var PLAYBOOKS = [{ id: 'iros-corp-ecourt', title: '제3채무자 법인등기사항증명서(전자소송용) 발급' }];
  var S = null;

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'style') e.style.cssText = attrs[k]; else e[k] = attrs[k]; });
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function note(t, kind) {
    if (!S) return;
    var p = el('div', { text: t, className: 'ra-line ' + (kind || '') });
    S.log.appendChild(p); S.log.scrollTop = S.log.scrollHeight;
    while (S.log.children.length > 80) S.log.removeChild(S.log.firstChild);
  }
  function status(t) { if (S) S.state.textContent = t; }

  async function getTicket(token) {
    var r = await fetch(GATEWAY + '/v1/ticket', { method: 'POST', headers: { authorization: 'Bearer ' + token } });
    var j = await r.json().catch(function () { return {}; });
    if (r.status === 503) throw new Error('원격 브라우저가 아직 준비되지 않았습니다.');
    if (r.status === 401) throw new Error('로그인이 필요합니다.');
    if (!r.ok) throw new Error('연결할 수 없습니다(' + r.status + ').');
    return j;
  }

  function close() {
    if (!S) return;
    try { S.ws.send(JSON.stringify({ type: 'stop' })); } catch (e) { /* 이미 닫힘 */ }
    try { S.ws.close(); } catch (e) { /* 이미 닫힘 */ }
    S.root.remove(); document.removeEventListener('keydown', S.onKey, true); S = null;
  }

  function send(o) { if (S && S.ws.readyState === 1) S.ws.send(JSON.stringify(o)); }
  function pos(ev) {
    var r = S.canvas.getBoundingClientRect();
    return { x: Math.round((ev.clientX - r.left) * (S.w / r.width)), y: Math.round((ev.clientY - r.top) * (S.h / r.height)) };
  }

  function prompt(m) {
    S.bar.innerHTML = '';
    if (m.kind === 'handoff') {
      S.control = true; S.canvas.classList.add('on'); S.input.hidden = false;
      status('직접 진행해 주세요');
      S.bar.appendChild(el('span', { text: m.text || '직접 진행이 필요합니다.' }));
      S.bar.appendChild(el('span', { className: 'ra-hint', text: ' 화면을 눌러 로그인하세요. 간편인증(휴대폰 승인)만 사용할 수 있습니다. 끝나면 오른쪽 버튼을 누르세요.' }));
      S.bar.appendChild(el('button', { type: 'button', className: 'btn btn-sm', text: '직접 진행 끝냈어요', onclick: function () { S.bar.innerHTML = ''; send({ type: 'reply', ok: true }); endControl(); } }));
    } else {
      status('확인이 필요합니다');
      S.bar.appendChild(el('span', { text: m.text || '이 동작을 진행할까요?' }));
      S.bar.appendChild(el('button', { type: 'button', className: 'btn btn-sm', text: '진행', onclick: function () { S.bar.innerHTML = ''; send({ type: 'reply', ok: true }); status('진행 중'); } }));
      S.bar.appendChild(el('button', { type: 'button', className: 'btn btn-sm', text: '하지 않기', onclick: function () { S.bar.innerHTML = ''; send({ type: 'reply', ok: false }); status('진행 중'); } }));
    }
  }
  function endControl() { if (!S) return; S.control = false; S.canvas.classList.remove('on'); S.input.hidden = true; status('진행 중'); }

  function onMessage(ev) {
    if (!S) return;
    if (typeof ev.data !== 'string') {
      createImageBitmap(new Blob([ev.data], { type: 'image/jpeg' })).then(function (bmp) {
        if (!S) return; if (S.canvas.width !== bmp.width) { S.canvas.width = bmp.width; S.canvas.height = bmp.height; }
        S.ctx.drawImage(bmp, 0, 0); bmp.close && bmp.close();
      }).catch(function () { /* 깨진 조각은 건너뜀 */ });
      return;
    }
    var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.type === 'meta') { S.w = m.width; S.h = m.height; }
    else if (m.type === 'ready') { status('도우미 시작'); send({ type: 'start', playbook: S.job.playbook, goal: S.job.goal }); }
    else if (m.type === 'prompt') prompt(m);
    else if (m.type === 'blocked') note('열 수 없는 사이트를 막았습니다: ' + m.host, 'warn');
    else if (m.type === 'status') note(m.text, 'warn');
    else if (m.type === 'log' && m.e) { if (m.e.kind === 'say') note(m.e.text); else if (m.e.kind === 'tool' && m.e.act === 'deny') note('거부됨: ' + m.e.name, 'warn'); }
    else if (m.type === 'done') { status('끝났습니다'); endControl(); note((m.res && m.res.text) || (m.res && m.res.reason === 'max_steps' ? '단계 한도에 도달했습니다.' : '끝났습니다.'), 'done'); S.bar.innerHTML = ''; }
    else if (m.type === 'error') { status('멈췄습니다'); note(m.text || '오류가 났습니다.', 'warn'); }
  }

  async function open(job) {
    if (S) return;
    var token = root.KAuth && KAuth.getToken && KAuth.getToken();
    if (!token) { if (root.KAuth && KAuth.ensureLogin) { try { await KAuth.ensureLogin(); token = KAuth.getToken(); } catch (e) { /* 취소 */ } } }
    if (!token) throw new Error('로그인이 필요합니다.');
    var t = await getTicket(token);
    var canvas = el('canvas', { width: 1280, height: 800, className: 'ra-canvas', tabIndex: 0 });
    var input = el('input', { type: 'text', hidden: true, placeholder: '여기에 입력한 글자가 선택한 칸에 들어갑니다(전화번호·생년월일 등). 비밀번호·인증서 암호는 입력하지 마세요.', className: 'ra-input' });
    var box = el('div', { className: 'ra-box', role: 'dialog', 'aria-label': '원격 브라우저' });
    var state = el('span', { className: 'ra-state', text: '연결 중' });
    var bar = el('div', { className: 'ra-bar' });
    var log = el('div', { className: 'ra-log' });
    box.appendChild(el('div', { className: 'ra-head' }, [el('strong', { text: job.title || '후속 절차' }), state, el('button', { type: 'button', className: 'btn btn-sm', text: '중지하고 닫기', onclick: close })]));
    box.appendChild(canvas); box.appendChild(input); box.appendChild(bar); box.appendChild(log);
    box.appendChild(el('div', { className: 'ra-hint', text: '이 화면은 서버의 임시 브라우저입니다. 닫으면 로그인 정보가 모두 지워집니다. 법원·등기소 사이트는 사용자 본인이 직접 로그인하고 결제합니다.' }));
    var rootEl = el('div', { className: 'ra-root' }, [box]);
    document.body.appendChild(rootEl);
    var ws = new WebSocket(t.ws + (t.ws.indexOf('?') < 0 ? '?' : '&') + 't=' + encodeURIComponent(t.ticket));
    ws.binaryType = 'arraybuffer';
    S = { root: rootEl, canvas: canvas, ctx: canvas.getContext('2d'), input: input, bar: bar, log: log, state: state, ws: ws, job: job, w: 1280, h: 800, control: false };
    S.onKey = function (e) { if (e.key === 'Escape' && !S.control) close(); };
    document.addEventListener('keydown', S.onKey, true);
    ws.onmessage = onMessage;
    ws.onclose = function () { if (S && S.ws === ws) { status('연결이 끝났습니다'); endControl(); } };
    ws.onerror = function () { note('원격 브라우저에 연결하지 못했습니다.', 'warn'); };
    // 사용자 입력은 "직접 진행" 단계에서만 서버가 받는다(서버도 같은 규칙으로 걸러 낸다).
    function mouse(action) { return function (e) { if (!S.control) return; e.preventDefault(); var p = pos(e); send({ type: 'input', kind: 'mouse', action: action, x: p.x, y: p.y, button: e.button === 2 ? 'right' : 'left' }); canvas.focus(); }; }
    canvas.addEventListener('mousedown', mouse('down')); canvas.addEventListener('mouseup', mouse('up')); canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('mousemove', (function () { var last = 0; return function (e) { if (!S.control || Date.now() - last < 60) return; last = Date.now(); var p = pos(e); send({ type: 'input', kind: 'mouse', action: 'move', x: p.x, y: p.y }); }; })());
    canvas.addEventListener('wheel', function (e) { if (!S.control) return; e.preventDefault(); var p = pos(e); send({ type: 'input', kind: 'wheel', x: p.x, y: p.y, dx: e.deltaX, dy: e.deltaY }); }, { passive: false });
    canvas.addEventListener('keydown', function (e) {
      if (!S.control) return;
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); send({ type: 'input', kind: 'text', text: e.key }); }
      else if (['Enter', 'Backspace', 'Tab', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape'].indexOf(e.key) >= 0) { e.preventDefault(); send({ type: 'input', kind: 'key', key: e.key }); }
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && input.value) { send({ type: 'input', kind: 'text', text: input.value }); input.value = ''; } });   // 한글 입력기·휴대폰용
  }

  var api = { open: open, close: close, playbooks: PLAYBOOKS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NaviRemote = api;
})(typeof window !== 'undefined' ? window : globalThis);
