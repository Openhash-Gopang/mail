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
    { re: /법인.*등기|등기사항|등기부/, playbook: 'iros-corp-ecourt', early: true, goal: '법인등기사항증명서를 전자소송용으로 결제대상목록에 담아 주세요. 결제는 하지 말고 목록에서 멈춰 주세요. 법인 이름: ' },
    { re: /주민등록|등본|초본|가족관계|혼인관계|기본증명|제적|지방세|납세|건강보험|국민연금|소득금액|사업자등록|병적|토지대장|건축물대장/, playbook: 'gov24-doc', instant: true, goal: '정부24에서 이 서류를 발급받아 나비웹으로 보내 주세요. 서류: ' },
  ];
  var CAT = (typeof module !== 'undefined' && module.exports && typeof require === 'function') ? require('./attach-catalog.js') : (root && root.AttachCatalog) || null;
  // 서류 이름 → 가져오기 절차. 카탈로그(attach-catalog.js)가 정한 기관 발급 서류만 버튼이 붙고, 사용자 자료·개별 기관(회사·병원 등) 서류는 null.
  // instant: 물을 것이 없어 AI 를 거치지 않고 바로 맡김 / early: 사이트·로그인을 먼저 열고 대상(법인 이름 등)은 나중에 전함 / url: 도우미가 열 기관 사이트.
  function slotPlan(label) {
    var t = String(label || ''), c = CAT ? CAT.classify(t) : null;
    if (c && c.kind === 'agency') {
      if (c.playbook) return { playbook: c.playbook, goal: SLOTS[0].goal, instant: false, early: true, url: c.url, note: c.note || '', paid: !!c.paid };
      if (c.agency === 'gov24') return { playbook: 'gov24-doc', goal: SLOTS[1].goal, instant: c.input === 'none', early: c.input === 'ask', url: c.url, note: c.note || '', paid: !!c.paid };
      return { playbook: '', goal: c.goal, instant: c.instant, early: c.input === 'ask', url: c.url, note: c.note || '', paid: !!c.paid };
    }
    if (c && (c.kind === 'user' || c.kind === 'thirdparty')) return null;
    for (var i = 0; i < SLOTS.length; i++) if (SLOTS[i].re.test(t)) return { playbook: SLOTS[i].playbook, goal: SLOTS[i].goal, instant: !!SLOTS[i].instant, early: !!SLOTS[i].early };
    return null;
  }
  // 사용자가 직접 만들거나 가진 자료(사진·계약서·위임장 등)는 기관에서 받을 수 없으므로 "도우미가 가져오기"를 붙이지 않는다. 카탈로그에 없는 항목은 예전처럼 도우미 AI 가 기관을 정한다.
  var USER_OWNED = /사진|계약서|위임장|재산목록|별지|직접\s*작성|서명/;
  var ANY_FETCHABLE = '^(?!.*(?:' + USER_OWNED.source + ')).+';
  function slotFetchable(label) {
    var t = String(label || '').trim(); if (!t) return false;
    var c = CAT ? CAT.classify(t) : null;
    if (c && c.kind === 'agency') return true;
    if (c && (c.kind === 'user' || c.kind === 'thirdparty')) return false;
    return !USER_OWNED.test(t);
  }
  function slotPatterns() { return CAT ? CAT.patterns() : SLOTS.map(function (s) { return s.re.source; }).concat([ANY_FETCHABLE]); }
  function suggest(title) {
    var t = String(title || '');
    for (var i = 0; i < RULES.length; i++) if (RULES[i].re.test(t)) return { playbook: RULES[i].playbook, title: RULES[i].title, goal: RULES[i].goal };
    return null;
  }
  // ── 홈 입력창의 발급 요청(2026-11-26) ─────────────────────────────
  // "등본 발급해 줘"처럼 기관 발급 서류를 지금 발급해 달라는 분명한 지시만 잡는다. 질문·설명 요청·부정·여러 서류·등기부는 null → 기본 AI 비서가 판단한다.
  var HOME_SLOT_MARK = ' (홈 요청)';
  var ISSUE_DOCS = /주민\s*등록\s*(?:표\s*)?(?:등\s*[·ㆍ,.]?\s*초본|등본|초본)|가족\s*관계\s*증명서|혼인\s*관계\s*증명서|기본\s*증명서|지방세\s*(?:납세|완납)\s*증명서?|(?:국세\s*)?(?:납세|완납)\s*증명서?|소득\s*금액\s*증명(?:원|서)?|사업자\s*등록\s*증명(?:원|서)?|병적\s*증명서|건강\s*보험\s*자격\s*득실\s*확인서|국민\s*연금\s*가입\s*(?:자\s*)?증명서?|토지\s*대장|건축물\s*대장|등본|초본/g;
  var ISSUE_ORDER = /(?:발급|발행|출력)\s*(?:좀\s*)?(?:받아\s*)?(?:해\s*(?:줘|주세요|줄래|주라|주십시오|달라|라)?|해$|줘|주세요|부탁|신청해|받아\s*(?:줘|주세요|와)|받고\s*싶|받아야\s*(?:해|돼|함)|하자|$)|(?:발급|발행)\s*받아\s*$|(?:떼|뽑아)\s*(?:어\s*)?(?:좀\s*)?(?:줘|주세요|줄래|주라|와|달라)|떼\s*(?:야\s*(?:해|돼)|고\s*싶)/;
  var ISSUE_NOT = /[?？]|어떻게|방법|뭐|무엇|무슨|얼마|수수료|비용|언제|어디|왜|차이|가능|안\s*(?:돼|되|나)|하지\s*마|말고|취소|메일|편지|보내|제출|작성|위임/;
  var NOT_RESIDENT = /등기|법인|부동산|제적|호적/;
  function issueIntent(text) {
    var t = String(text || '').trim();
    if (!t || t.length > 80 || /\n/.test(t) || ISSUE_NOT.test(t) || !ISSUE_ORDER.test(t)) return null;
    var found = t.match(ISSUE_DOCS); if (!found || found.length !== 1) return null;
    var doc = found[0].replace(/\s+/g, ' ').trim();
    if (/등본$|초본$/.test(doc) && NOT_RESIDENT.test(t)) return null;
    if (doc === '등본' || doc === '초본') {
      // "○○ 등본"의 앞말이 다른 장부 이름이면 주민등록 서류로 넘겨짚지 않는다
      if (/(?:대장|증명서|등록원부|회의록|판결|결정|조서)\s*$/.test(t.slice(0, t.indexOf(doc)))) return null;
      doc = '주민등록표 ' + doc;
    }
    var plan = slotPlan(doc);
    if (!plan || !plan.url) return null;
    return { doc: doc, plan: plan };
  }
  // 홈에서 맡길 일(job). slot 이 있어야 도우미가 발급 파일을 나비웹으로 돌려보낸다.
  function homeJob(doc, plan, userText) {
    var said = String(userText || '').replace(/\d{6}\s*-?\s*[1-8]\d{6}/g, '(가림)').trim().slice(0, 200);
    return { playbook: plan.playbook || '', url: plan.url || '', slot: String(doc).slice(0, 100) + HOME_SLOT_MARK, title: String(doc).slice(0, 100) + ' 발급',
      goal: String(plan.goal || '') + doc + '\n사용자 요청 원문: ' + said + '\n로그인·본인인증·결제만 사용자에게 넘기고, 이미 지시한 발급은 다시 묻지 마세요.' };
  }
  function homeDoc(label) { var s = String(label || ''); return s.slice(-HOME_SLOT_MARK.length) === HOME_SLOT_MARK ? s.slice(0, -HOME_SLOT_MARK.length) : ''; }
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
  function detect() {
    return call('agent-ping', {}, 1200).then(function (m) {
      if (!(m && m.ok)) return null;
      // 설치 직후 첫 응답에만 welcome 이 실려 온다 — 어느 확인이 받든 안내가 한 번 뜨도록 여기서 이벤트로 알린다.
      if (m.welcome && typeof window !== 'undefined' && window.dispatchEvent) { try { window.dispatchEvent(new CustomEvent('navi-agent-welcome', { detail: { version: m.version } })); } catch (e) { /* 안내만 빠진다 */ } }
      return { version: m.version, playbooks: m.playbooks || [] };
    });
  }
  // 확장이 설치돼 있다는 표지(bridge.js 가 남긴다). 연결 응답이 늦을 때 "설치 안내"를 다시 띄우지 않는 근거로만 쓴다.
  function installedMark() { try { return document.documentElement.getAttribute('data-navi-agent') || ''; } catch (e) { return ''; } }
  function queue(job) { job = Object.assign({}, job, { autostart: true }); try { if (!job.token && window.KAuth && KAuth.getToken) job = Object.assign({}, job, { token: KAuth.getToken() || '' }); } catch (e) { /* 로그인 전 */ } return call('agent-queue', { job: job }, 9000).then(function (m) { return !!(m && m.ok); }); }
  // 이미 시작한 작업에 나중에 알게 된 정보(예: 법인 이름)를 전한다.
  function update(slot, text) { return call('agent-queue', { job: { update: true, slot: String(slot || ''), text: String(text || '') } }, 3000).then(function (m) { return !!(m && m.ok); }); }
  // Chrome 웹 스토어에 등록한 뒤 이 주소를 채운다(비어 있으면 설치 안내를 보이지 않는다).
  var STORE_URL = 'https://chromewebstore.google.com/detail/bhmnnbmebjppofdboeinccngpeheongi';
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
  // 확장이 화면에서 읽어 보낸 정보(예: 시장의 상품 정보): { label, data } — 값은 받는 쪽에서 다시 걸러서 쓴다.
  function onData(cb) {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    window.addEventListener('message', function (e) {
      var m = e.data;
      if (e.source !== window || e.origin !== location.origin || !m || m.source !== 'navi-agent' || m.type !== 'agent-data' || !m.data || typeof m.data !== 'object') return;
      cb({ label: String(m.label || ''), data: m.data });
    });
  }
  var api = { issueIntent: issueIntent, homeJob: homeJob, homeDoc: homeDoc, installedMark: installedMark, onStatus: onStatus, onData: onData, suggest: suggest, detect: detect, queue: queue, update: update, slotPlan: slotPlan, slotPatterns: slotPatterns, slotFetchable: slotFetchable, onFile: onFile, STORE_URL: STORE_URL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NaviAgent = api;
})(typeof window !== 'undefined' ? window : globalThis);
