/* ═════════════════════════════════════════════════════════════════
   assist-launch.js — "나비웹 도우미가 진행하기" (2026-11-11 신설)
   가상 판결 입력창(왼쪽 메뉴 '가상 판결') 왼쪽 위에 나비 로고가 붙은 버튼을 둔다. 누르면 사건번호(또는 판결문 파일)를 받아
   K-Law 창(klaw.hondi.net/desktop.html?assist=1)을 새로 열고, 이미 로그인한 이 계정의 토큰을 postMessage 로 넘긴다.
   그러면 K-Law 쪽 자동 진행기(klaw-assist.js)가 판결문 확보 → 익명화 → 통합 판결문 → 가상 판결문 → 일치도 평가 →
   방법론 갱신 제안까지 진행하며 그 창에서 진행 상황과 문서 링크를 보고한다.
   보안: 토큰은 주소창에 싣지 않는다. 우리가 연 창(opener 관계)이 K-Law 출처에서 "준비됨"을 보냈을 때만, 그 출처로만 보낸다.
   확장 프로그램은 필요 없다(판결문은 K-Law 서버가 법제처 판례 API로 가져온다).
   ═════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var KLAW_ORIGIN = 'https://klaw.hondi.net';
  var KLAW_URL = KLAW_ORIGIN + '/desktop.html?assist=1';
  var CASE_RE = /^\d{2,4}[가-힣]{1,4}\d{1,7}$/;
  var win = null, job = null, files = [];

  function $(id) { return document.getElementById(id); }
  function readExp() { var m = document.cookie.match(/(?:^|; )hondi_pvt_exp=([^;]*)/); return m ? Number(decodeURIComponent(m[1])) : 0; }
  function loggedIn() { try { return !!(root.KAuth && KAuth.hasValidLogin && KAuth.hasValidLogin()); } catch (e) { return false; } }

  function css() {
    if ($('vd-assist-css')) return;
    var s = document.createElement('style'); s.id = 'vd-assist-css';
    s.textContent = '#tab-compose:not([data-mode="verdict"]) #vd-assist-row{display:none}' +
      '#vd-assist-row{position:relative;margin:0 0 10px 2px;font-size:13px;line-height:1.6}' +
      '#vd-assist-row *{font-size:13px;line-height:1.6;font-family:inherit;box-sizing:border-box}' +
      '#vd-assist-btn{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 14px 0 8px;border:1px solid #2563eb;border-radius:999px;background:#fff;color:#1d4ed8;font-weight:700;cursor:pointer;opacity:1}' +
      '#vd-assist-btn:hover,#vd-assist-btn[aria-expanded="true"]{background:#eff6ff}' +
      '#vd-assist-btn img{width:20px;height:20px;border-radius:5px;flex:none;margin:0;box-shadow:0 1px 3px rgba(0,0,0,.18)}' +
      '#vd-assist-pop{margin-top:8px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;color:#374151;max-width:640px}' +
      '#vd-assist-pop[hidden]{display:none}' +
      '#vd-assist-pop p{margin:0 0 10px;color:#374151}' +
      '#vd-assist-pop ul{margin:0 0 12px;padding:10px 12px 10px 28px;background:#f9fafb;border-radius:8px;color:#6b7280}' +
      '#vd-assist-pop li{margin:0 0 4px;color:#6b7280}#vd-assist-pop li:last-child{margin:0}' +
      '#vd-assist-pop .vd-as-row{display:flex;gap:8px;align-items:center;margin:0 0 8px}' +
      '#vd-assist-no{flex:1;min-width:0;height:36px;padding:0 10px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#111827}' +
      '#vd-assist-go{flex:none;height:36px;padding:0 16px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer;opacity:1}' +
      '#vd-assist-go:hover{background:#1d4ed8}#vd-assist-go:disabled{background:#93c5fd;cursor:default}' +
      '#vd-assist-pick{display:inline-flex;align-items:center;height:30px;padding:0 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;cursor:pointer}' +
      '#vd-assist-pick:hover{background:#f3f4f6}#vd-assist-files{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}' +
      '#vd-assist-fhint{color:#6b7280}' +
      '#vd-assist-msg{margin:0;min-height:0;color:#6b7280}#vd-assist-msg:empty{display:none}#vd-assist-msg.err{color:#b91c1c}';
    document.head.appendChild(s);
  }

  function build() {
    if ($('vd-assist-row')) return true;
    var anchor = $('cmp-attach-list'); if (!anchor || !anchor.parentNode) return false;
    css();
    var row = document.createElement('div'); row.id = 'vd-assist-row';
    row.innerHTML =
      '<button type="button" id="vd-assist-btn" aria-expanded="false" aria-controls="vd-assist-pop"><img src="icons/navi-icon-96.png" alt="" width="20" height="20"><span>나비웹 도우미가 진행하기</span></button>' +
      '<div id="vd-assist-pop" hidden>' +
      '<p>대법원 사건번호를 입력하면 도우미가 판결문을 가져와 <b>익명화 → 통합 판결문 → 가상 판결문 → 일치도 평가 → 방법론 갱신 제안</b>까지 진행하고, 진행 상황과 문서 링크를 알려 드립니다. K-Law 창이 새로 열리며, 지금 로그인한 계정으로 들어가므로 다시 인증하지 않아도 됩니다.</p>' +
      '<ul>' +
      '<li>판결문은 매번 새로 익명화한 뒤 생성합니다. AI가 그 사건을 기억하고 있어도 입력에는 사건을 알아볼 단서가 없어 생성에 영향을 주지 않습니다.</li>' +
      '<li>원심 판결문이 일부(예: 1심) 없어도 생성은 가능하지만, 1~3심을 모두 반영한 경우보다 일치도가 떨어질 수 있습니다.</li>' +
      '<li>가상 판결문 생성에는 사용량만큼 GDC가 차감됩니다.</li></ul>' +
      '<div class="vd-as-row"><input type="text" id="vd-assist-no" placeholder="대법원 사건번호 예: 2024도7082" aria-label="대법원 사건번호" autocomplete="off" inputmode="text"><button type="button" id="vd-assist-go">도우미 시작</button></div>' +
      '<div class="vd-as-row"><label id="vd-assist-pick" for="vd-assist-files">판결문 파일 첨부(선택)</label><input type="file" id="vd-assist-files" accept=".txt,.md,text/plain" multiple><span id="vd-assist-fhint">txt·md, 파일 이름에 대법원·2심·1심 표기</span></div>' +
      '<div id="vd-assist-msg" role="status" aria-live="polite"></div></div>';
    anchor.parentNode.insertBefore(row, anchor);
    $('vd-assist-btn').onclick = toggle;
    $('vd-assist-go').onclick = go;
    $('vd-assist-no').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    $('vd-assist-files').onchange = readFiles;
    return true;
  }

  function toggle() { var p = $('vd-assist-pop'), open = p.hidden; p.hidden = !open; $('vd-assist-btn').setAttribute('aria-expanded', String(open)); if (open) setTimeout(function () { $('vd-assist-no').focus(); }, 0); }
  function msg(t, err) { var m = $('vd-assist-msg'); m.textContent = t || ''; m.className = err ? 'err' : ''; }

  function readFiles() {
    var fs = Array.prototype.slice.call($('vd-assist-files').files || []).slice(0, 3); files = [];
    Promise.all(fs.map(function (f, i) {
      return f.text().then(function (t) {
        var n = f.name, lv = /대법|supreme/i.test(n) ? 'supreme' : /2심|항소|appeal/i.test(n) ? 'appeal' : /1심|first/i.test(n) ? 'first' : (i === 0 ? 'supreme' : i === 1 ? 'appeal' : 'first');
        return { level: lv, text: t.slice(0, 400000) };
      });
    })).then(function (r) { files = r; msg(r.length ? '판결문 ' + r.length + '건을 읽었습니다.' : ''); });
  }

  function go() {
    var no = String($('vd-assist-no').value || '').replace(/\s+/g, '');
    if (!CASE_RE.test(no) && !files.length) { msg('사건번호 형식이 올바르지 않습니다. 예: 2024도7082', true); return; }
    if (!loggedIn()) {   // 로그인 창을 먼저 띄운다(창 열기는 사용자 클릭 직후에만 막히지 않으므로 로그인 뒤 한 번 더 누르게 한다)
      msg('로그인이 필요합니다. 로그인한 뒤 "도우미 시작"을 다시 눌러 주세요.', true);
      try { KAuth.ensureLogin(); } catch (e) { /* 로그인 창 표시 실패 */ }
      return;
    }
    job = { caseNo: CASE_RE.test(no) ? no : '', files: files.slice() };
    win = window.open(KLAW_URL, 'klawassist');
    if (!win) { msg('새 창이 막혔습니다. 주소창 오른쪽의 팝업 차단 표시에서 허용한 뒤 다시 눌러 주세요.', true); return; }
    msg('K-Law 창을 열었습니다. 진행 상황은 그 창에서 보고됩니다.');
  }

  window.addEventListener('message', function (e) {
    var m = e.data;
    if (e.origin !== KLAW_ORIGIN || !win || e.source !== win || !m || m.type !== 'klaw-assist-ready' || !job) return;
    if (!loggedIn()) return;
    var tok = KAuth.getToken(), exp = readExp(); if (!(exp > Date.now() + 60000)) exp = Date.now() + 30 * 60000; // 쿠키를 못 읽어도 토큰 자체는 서버가 검증한다
    try { win.postMessage({ type: 'klaw-assist-start', token: tok, exp: exp, caseNo: job.caseNo, files: job.files }, KLAW_ORIGIN); } catch (er) { /* 창이 닫힘 */ }
  });

  function init() { if (!build()) { var n = 0, t = setInterval(function () { if (build() || ++n > 40) clearInterval(t); }, 250); } }
  root.AssistLaunch = { init: init, CASE_RE: CASE_RE };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
