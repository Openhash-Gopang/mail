/* 나비웹 도우미(Chrome 확장)와의 다리 — 나비웹 화면의 "나비웹 도우미" 줄.
 * 페이지는 확장 프로그램이 있는지 묻고(agent-ping), 후속 절차를 "맡기기"만 한다(agent-queue).
 * 로그인·인증서·결제·보안문자는 사용자가 직접 하고, 제출·발급 단계는 확장 쪽에서 사용자 확인을 받는다. */
(function (root) {
  'use strict';
  // 서류 이름에 맞는 후속 절차를 제안한다. 모르면 null(사용자가 직접 고른다).
  var RULES = [
    { re: /압류|추심|채권\s*압류|전부명령|집행/, playbook: 'iros-corp-ecourt',
      title: '제3채무자 법인등기사항증명서(전자소송용) 발급',
      goal: '제3채무자의 법인등기사항증명서를 전자소송용으로 결제대상목록에 담아 주세요. 결제는 하지 말고 목록에서 멈춰 주세요. 법인 이름: ' },
  ];
  // 첨부서류 항목 문구에 맞는 "도우미가 가져오기" 절차. 항목마다 어디서 받는지는 여기서만 정한다(서류 화면은 정규식만 받아 버튼을 붙인다).
  var SLOTS = [
    { re: /법인.*등기|등기사항|등기부/, playbook: 'iros-corp-ecourt', goal: '법인등기사항증명서를 전자소송용으로 결제대상목록에 담아 주세요. 결제는 하지 말고 목록에서 멈춰 주세요. 법인 이름: ' },
  ];
  function slotPlan(label) {
    var t = String(label || '');
    for (var i = 0; i < SLOTS.length; i++) if (SLOTS[i].re.test(t)) return { playbook: SLOTS[i].playbook, goal: SLOTS[i].goal };
    return null;
  }
  function slotPatterns() { return SLOTS.map(function (s) { return s.re.source; }); }
  function suggest(title) {
    var t = String(title || '');
    for (var i = 0; i < RULES.length; i++) if (RULES[i].re.test(t)) return { playbook: RULES[i].playbook, title: RULES[i].title, goal: RULES[i].goal };
    return null;
  }
  var seq = 0, pending = {};
  function call(type, data, timeout) {
    return new Promise(function (resolve) {
      var id = 'a' + (++seq) + '-' + Date.now();
      var timer = setTimeout(function () { delete pending[id]; resolve(null); }, timeout || 1200);
      pending[id] = function (m) { clearTimeout(timer); resolve(m); };
      window.postMessage(Object.assign({ source: 'navi-web', type: type, id: id }, data || {}), location.origin);
    });
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('message', function (e) {
      var m = e.data;
      if (e.source !== window || !m || m.source !== 'navi-agent' || !pending[m.id]) return;
      var f = pending[m.id]; delete pending[m.id]; f(m);
    });
  }
  function detect() { return call('agent-ping', {}, 1200).then(function (m) { return m && m.ok ? { version: m.version, playbooks: m.playbooks || [] } : null; }); }
  function queue(job) { try { if (!job.token && window.KAuth && KAuth.getToken) job = Object.assign({}, job, { token: KAuth.getToken() || '' }); } catch (e) { /* 로그인 전 */ } return call('agent-queue', { job: job }, 3000).then(function (m) { return !!(m && m.ok); }); }
  // Chrome 웹 스토어에 등록한 뒤 이 주소를 채운다(비어 있으면 설치 안내를 보이지 않는다).
  var STORE_URL = '';
  // 확장이 받아 온 파일: { label, name, mime, data(ArrayBuffer) } — 넣을지는 호출한 쪽이 사용자에게 물은 뒤 정한다.
  function onFile(cb) {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    window.addEventListener('message', function (e) {
      var m = e.data;
      if (e.source !== window || e.origin !== location.origin || !m || m.source !== 'navi-agent' || m.type !== 'agent-file') return;
      cb({ label: String(m.label || ''), name: String(m.name || ''), mime: String(m.mime || ''), data: m.data });
    });
  }
  // 확장이 알려 준 항목 진행 결과: { label, state: sent|pending|failed, note }
  function onStatus(cb) {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    window.addEventListener('message', function (e) {
      var m = e.data;
      if (e.source !== window || e.origin !== location.origin || !m || m.source !== 'navi-agent' || m.type !== 'agent-status') return;
      cb({ label: String(m.label || ''), state: String(m.state || ''), note: String(m.note || '') });
    });
  }
  var api = { onStatus: onStatus, suggest: suggest, detect: detect, queue: queue, slotPlan: slotPlan, slotPatterns: slotPatterns, onFile: onFile, STORE_URL: STORE_URL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NaviAgent = api;
})(typeof window !== 'undefined' ? window : globalThis);
