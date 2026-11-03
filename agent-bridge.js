/* 나비웹 서류 도우미(Chrome 확장)와의 다리 — 서류 작성 화면의 "후속 절차 도우미" 줄.
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
  var api = { suggest: suggest, detect: detect, queue: queue, STORE_URL: STORE_URL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NaviAgent = api;
})(typeof window !== 'undefined' ? window : globalThis);
