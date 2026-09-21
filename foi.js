/* ══════════════════════════════════════════════════════════════
   K-Mail — "정보 공개 청구" 탭 (desktop.html 전용)
   2026-09-20 신설, 같은 날 "청구 건(캠페인)" 구조로 개편.

   사용자가 여러 기관에 반복해서 하는 전형적 업무이므로:
   (1) 새 청구서 — 맨 위 입력창에 알고 싶은 것을 적으면 K-FOI(SP-28_kfoi, /kfoi/chat)가
       기관을 특정하고, 공유 아카이브 → 웹 순으로 이미 얻을 수 있는 정보를 걸러낸 뒤,
       아직 못 얻은 것만 청구 목록으로 만들어 아래 폼을 채운다.
   (2) 내 청구 건 — 청구는 대개 1회로 끝나지 않는다. 한 건(캠페인) 안에 "얻고 싶은 정보"(항목)와
       "청구 회차"를 쌓아 추적하고, 남은 항목으로 후속 청구를 만든다. 다 얻으면 종료·보관한다.
   (3) 공유 아카이브 — 종료·보관하며 공유를 선택한 건을 혼디 사용자가 검색한다. 같은 정보를
       다시 청구하기 전에 먼저 찾아보고, 가져와서 이어갈 수 있다.

   저장 경계
   - 청구 건(기관·문서 이름·회차·접수번호·메모)은 혼디 서버(/kfoi/campaigns/*)에 저장된다.
   - 청구인의 성명·주소·연락처·생년월일은 서버로 보내지 않는다. 이 브라우저(localStorage)에만
     "저장" 체크를 켰을 때 남는다.
   - 공유 아카이브로 나가는 것은 서버가 허용목록으로 거른 필드뿐이다(기관·부서·제목·항목 이름/범위/
     상태·회차 상태(월 단위)·공개 자료 주소·사용자가 승인한 요약).
   - 청구서를 정보공개시스템에 대신 제출하지 않는다. 제출은 사용자가 한다.
   - 기한 계산은 참고용이다(토·일만 반영, 공휴일 미반영). 기관의 통지가 항상 우선한다.

   법령 근거(2026-09-20 국가법령정보센터 본문 검색으로 확인)
   - 제10조 청구방법: 청구서 제출 또는 말로 청구. 청구 정보는 내용과 범위를 확정할 수 있을 정도로
     특정해야 한다(판례) → 문서명 점검.
   - 제11조: 청구를 받은 날부터 10일 이내 결정, 부득이하면 기간이 끝나는 날의 다음 날부터 10일
     범위에서 연장(연장 사실·사유 문서 통지).
   - 제18조: 비공개·부분공개 결정에 불복하거나 청구 후 20일이 지나도록 결정이 없으면, 통지를 받은
     날 또는 20일이 경과한 날부터 30일 이내에 문서로 이의신청.
   - 제19조: 이의신청을 거치지 않고도 행정심판 청구 가능.

   이 파일은 desktop.html의 인라인 스크립트가 정의하는 전역(kmailApi, mdToHtml, _switchTab,
   _mailLoadDraftIntoEditor)을 쓰므로 그 스크립트 뒤에 로드해야 한다.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LS_PROFILE = 'kmail.foi.profile.v2';
  var LS_LEGACY = 'kmail.foi.v1';          // 2026-09-20 초판(브라우저 저장 방식)의 기록 — 가져오기 전용
  var PORTAL_URL = 'https://www.open.go.kr';
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];
  var MAX_AI_CALLS = 6;                    // 한 질문에 대해 /kfoi/chat을 이어 부르는 최대 횟수

  // 회차(청구 1회)의 진행 상태 → 표시 라벨 / 기존 .badge-* 클래스(webapp과 같은 팔레트)
  var ROUND_STATE = {
    draft:     { label: '작성됨(미제출)', badge: 'badge-draft' },
    filed:     { label: '청구함',         badge: 'badge-scheduled' },
    extended:  { label: '기간 연장 통지', badge: 'badge-pending_review' },
    disclosed: { label: '공개 결정',      badge: 'badge-sent' },
    partial:   { label: '부분공개',       badge: 'badge-pending' },
    denied:    { label: '비공개',         badge: 'badge-failed' },
    none:      { label: '부존재',         badge: 'badge-rejected' },
    withdrawn: { label: '취하·종결',      badge: 'badge-none' }
  };
  var ROUND_ORDER = ['draft', 'filed', 'extended', 'disclosed', 'partial', 'denied', 'none', 'withdrawn'];

  // 항목(얻고 싶은 정보 하나)의 상태
  var ITEM_STATE = {
    pending:   { label: '미청구',     badge: 'badge-draft' },
    requested: { label: '청구 중',    badge: 'badge-scheduled' },
    obtained:  { label: '획득',       badge: 'badge-sent' },
    partial:   { label: '부분 획득',  badge: 'badge-pending' },
    denied:    { label: '비공개',     badge: 'badge-failed' },
    none:      { label: '부존재',     badge: 'badge-rejected' },
    public:    { label: '공개 자료',  badge: 'badge-confirmed' },
    shared:    { label: '아카이브',   badge: 'badge-confirmed' },
    dropped:   { label: '제외',       badge: 'badge-none' }
  };
  var ITEM_ORDER = ['pending', 'requested', 'obtained', 'partial', 'denied', 'none', 'public', 'shared', 'dropped'];
  var OPEN_STATES = ['pending', 'requested', 'partial'];          // 아직 "다 얻지 못한" 상태
  var RESOLVED_STATES = ['obtained', 'public', 'shared', 'dropped'];
  var FOLLOWUP_STATES = ['pending', 'partial', 'denied', 'none'];   // 후속 청구 후보

  // 자주 쓰는 문서 묶음. 항목은 "문서 이름으로 지목"하는 형태(질문·새 통계 작성 요구는 부존재·보정 사유).
  var PRESETS = {
    blank: { label: '직접 작성', items: [{ title: '', scope: '' }] },
    orgdocs: {
      label: '기관·부서 업무 자료 세트 (사무분장·민원편람·지침 목록 등)',
      items: [
        { title: '부서별 사무분장표 (팀 편제, 팀별 담당 업무, 팀 대표전화)', scope: '현재 시행 중인 최신본' },
        { title: '소관 민원사무 편람·처리기준표 (사무명, 근거, 구비서류, 처리기한, 수수료, 접수처)', scope: '현재 시행 중인 최신본' },
        { title: '시행 중인 훈령·예규·업무처리지침의 목록 (제목, 시행일)', scope: '원문이 아닌 목록만' },
        { title: '위임전결 규정 (처분·과태료·허가 등의 결재권자표)', scope: '현재 시행 중인 최신본' },
        { title: 'FAQ, 민원 응대 매뉴얼, 상담 지식 자료 (개인정보 제외본)', scope: '현재 사용 중인 최신본' },
        { title: '부서 간 업무협조 절차·요청 양식, 협의체·합동업무 운영계획', scope: '시행 완료분' },
        { title: '소관 업무 서식 (신청서·신고서·통지서)', scope: '현재 사용 중인 서식' },
        { title: '소관 민원사무별 접수·처리 통계와 반려·불수리 사유 분류', scope: '최근 2개년, 기존 집계 문서에 한정' },
        { title: '소관 업무 정보시스템 목록 (명칭, 용도, 이용 채널, 운영부서)', scope: '명칭·용도 수준' },
        { title: '소관 밖 민원 이송 지침, 부서 간 업무 경계 정리표', scope: '현재 시행 중인 최신본' }
      ]
    },
    contract: {
      label: '용역·계약 자료 (계약서·과업내용서·결과보고서)',
      items: [
        { title: '○○ 용역 계약서 및 과업내용서', scope: '20○○년 체결분' },
        { title: '○○ 사업 결과보고서 (최종본)', scope: '20○○년도' },
        { title: '수의계약 체결 현황', scope: '기존 집계 문서에 한정, 최근 1개년' }
      ]
    },
    committee: {
      label: '위원회·회의 자료 (회의록·안건·위원 명단)',
      items: [
        { title: '○○위원회 회의록', scope: '20○○년 ○월~○월, 공개 가능한 범위' },
        { title: '○○위원회 회의 안건 및 결과 자료', scope: '위 기간과 동일' },
        { title: '○○위원회 위원 명단 (직위·분야 수준)', scope: '개인정보 제외' }
      ]
    }
  };
  var AGENCY_SUGGEST = ['제주특별자치도', '제주특별자치도교육청', '제주시', '서귀포시', '제주특별자치도의회'];

  function newDraft() {
    return { campaignId: null, roundSeq: null, title: '', goal: '', sourceArchiveId: '', known: [], publicSources: [], archiveMatches: [], unverified: [] };
  }

  var S = {
    inited: false,
    profile: null,
    campaigns: [], loaded: false, loading: false, filter: 'active',
    draft: newDraft(),
    detail: null, detailDirty: false, panel: null,
    chat: { messages: [], firstUser: '', busy: false },
    arc: { results: [], detail: null },
    preset: 'blank'
  };

  // ── 공통 유틸 ────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : ''; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function parseYmd(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function fmtDate(d) { return d ? ymd(d) + ' (' + DOW[d.getDay()] + ')' : '—'; }
  function todayStart() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  // 기간의 말일이 토·일이면 다음 평일로(민법 제161조 취지). 공휴일은 반영하지 않는다.
  function rollWeekend(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1);
    return x;
  }
  function daysLeft(d) { return Math.round((d.getTime() - todayStart().getTime()) / 86400000); }
  function dLabel(n) { return n > 0 ? 'D-' + n : (n === 0 ? '오늘 마감' : Math.abs(n) + '일 경과'); }
  function monthOf(iso) { return String(iso || '').slice(0, 7); }

  function api(path, opts) {
    if (typeof kmailApi !== 'function') return Promise.reject(new Error('K-Mail 화면이 아직 준비되지 않았습니다.'));
    return kmailApi(path, opts);
  }
  function loggedIn() {
    try { return !!(window.KAuth && KAuth.hasValidLogin && KAuth.hasValidLogin()); } catch (e) { return false; }
  }
  function flash(id, msg, ok) {
    var el = $(id);
    if (!el) return;
    el.textContent = msg;
    el.className = 'foi-flash ' + (ok === false ? 'err' : 'ok');
    el.style.display = '';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.display = 'none'; }, 5200);
  }
  function findCampaign(id) {
    for (var i = 0; i < S.campaigns.length; i++) if (S.campaigns[i].id === id) return S.campaigns[i];
    return null;
  }
  function upsertCampaign(c) {
    for (var i = 0; i < S.campaigns.length; i++) if (S.campaigns[i].id === c.id) { S.campaigns[i] = c; return; }
    S.campaigns.unshift(c);
  }

  // ── 청구인 정보(브라우저에만) ─────────────────────────────────
  function loadProfile() {
    try {
      var raw = window.localStorage.getItem(LS_PROFILE);
      if (raw) return JSON.parse(raw);
      var old = window.localStorage.getItem(LS_LEGACY);       // 초판이 저장해 둔 청구인 정보를 이어 쓴다
      if (old) { var d = JSON.parse(old); if (d && d.profile) return d.profile; }
    } catch (e) { /* 저장소를 못 쓰는 환경 — 그냥 빈 값 */ }
    return null;
  }
  function storeProfile(p) {
    try {
      if (p) window.localStorage.setItem(LS_PROFILE, JSON.stringify(p));
      else window.localStorage.removeItem(LS_PROFILE);
    } catch (e) { /* 무시 */ }
  }

  // ── 작성 폼: 읽기/쓰기 ──────────────────────────────────────
  function readItems() {
    var rows = document.querySelectorAll('#foi-items .foi-item');
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      out.push({
        id: rows[i].dataset.id || '',
        prior: rows[i].dataset.prior || '',
        note: rows[i].dataset.note || '',
        title: rows[i].querySelector('.foi-it').value.trim(),
        scope: rows[i].querySelector('.foi-is').value.trim()
      });
    }
    return out;
  }
  function readForm() {
    return {
      presetId: $('foi-preset').value,
      agency: $('foi-agency').value.trim(),
      dept: $('foi-dept').value.trim(),
      purpose: $('foi-purpose').value.trim(),
      items: readItems(),
      pub: { file: $('foi-pub-file').checked, copy: $('foi-pub-copy').checked, view: $('foi-pub-view').checked },
      recv: $('foi-recv').value,
      opts: {
        nocreate: $('foi-opt-nocreate').checked, partial: $('foi-opt-partial').checked,
        nonexist: $('foi-opt-nonexist').checked, personal: $('foi-opt-personal').checked, cost: $('foi-opt-cost').checked
      },
      req: {
        type: $('foi-req-type').value, name: $('foi-req-name').value.trim(), rep: $('foi-req-rep').value.trim(),
        birth: $('foi-req-birth').value.trim(), addr: $('foi-req-addr').value.trim(),
        phone: $('foi-req-phone').value.trim(), email: $('foi-req-email').value.trim(), keep: $('foi-req-keep').checked
      },
      date: $('foi-date').value
    };
  }
  function addItemRow(item) {
    var row = document.createElement('div');
    row.className = 'foi-item';
    row.dataset.id = item.id || '';
    row.dataset.prior = item.prior || '';
    row.dataset.note = item.note || '';
    row.innerHTML =
      '<div class="foi-item-main">' +
        '<input type="text" class="foi-it" placeholder="문서 이름으로 지목 — 예: 부서별 사무분장표 (팀별 담당 업무 포함)" value="' + esc(item.title) + '">' +
        '<input type="text" class="foi-is" placeholder="범위·시점 — 예: 현재 시행 중인 최신본 / 최근 2개년" value="' + esc(item.scope) + '">' +
        '<div class="foi-item-warn"></div>' +
      '</div>' +
      '<button type="button" class="foi-item-del" title="이 항목 삭제" aria-label="이 항목 삭제">×</button>';
    row.querySelector('.foi-item-del').addEventListener('click', function () {
      row.parentNode.removeChild(row);
      if (!document.querySelector('#foi-items .foi-item')) addItemRow({ title: '', scope: '' });
      refresh();
    });
    $('foi-items').appendChild(row);
  }
  function setItems(items) {
    $('foi-items').innerHTML = '';
    var list = (items && items.length) ? items : [{ title: '', scope: '' }];
    for (var i = 0; i < list.length; i++) addItemRow(list[i]);
  }
  function writeForm(f) {
    S.preset = PRESETS[f.presetId] ? f.presetId : 'blank';
    $('foi-preset').value = S.preset;
    $('foi-agency').value = f.agency || '';
    $('foi-dept').value = f.dept || '';
    $('foi-purpose').value = f.purpose || '';
    setItems(f.items);
    var pub = f.pub || { file: true, copy: false, view: false };
    $('foi-pub-file').checked = !!pub.file; $('foi-pub-copy').checked = !!pub.copy; $('foi-pub-view').checked = !!pub.view;
    $('foi-recv').value = f.recv || 'net';
    var o = f.opts || { nocreate: true, partial: true, nonexist: true, personal: true, cost: true };
    $('foi-opt-nocreate').checked = !!o.nocreate; $('foi-opt-partial').checked = !!o.partial;
    $('foi-opt-nonexist').checked = !!o.nonexist; $('foi-opt-personal').checked = !!o.personal; $('foi-opt-cost').checked = !!o.cost;
  }
  function writeRequester(p) {
    p = p || {};
    $('foi-req-type').value = p.type || 'person';
    $('foi-req-name').value = p.name || '';
    $('foi-req-rep').value = p.rep || '';
    $('foi-req-birth').value = p.birth || '';
    $('foi-req-addr').value = p.addr || '';
    $('foi-req-phone').value = p.phone || '';
    $('foi-req-email').value = p.email || '';
    $('foi-req-keep').checked = !!S.profile;
  }
  function formHasContent() {
    var f = readForm();
    return !!(f.agency || f.items.some(function (x) { return x.title; }));
  }

  // ── 청구서 문구 생성 ─────────────────────────────────────────
  var RECV_LABEL = {
    net: '정보통신망(정보공개시스템·전자우편)으로 수령',
    post: '우편으로 수령', visit: '방문하여 수령', fax: '팩스로 수령'
  };

  function buildText(f) {
    var L = [];
    var isOrg = f.req.type === 'org';
    var d = parseYmd(f.date);
    L.push('정 보 공 개 청 구 서');
    L.push('');
    L.push('수신: ' + (f.agency || '(청구 기관)') + (f.dept ? ' ' + f.dept : '') + ' 귀중');
    L.push('');
    L.push('1. 청구인');
    L.push('  - 구분: ' + (isOrg ? '법인·단체' : '개인'));
    L.push('  - ' + (isOrg ? '명칭' : '성명') + ': ' + (f.req.name || '(입력 필요)'));
    if (isOrg) L.push('  - 대표자: ' + (f.req.rep || '(입력 필요)'));
    if (!isOrg && f.req.birth) L.push('  - 생년월일: ' + f.req.birth);
    L.push('  - ' + (isOrg ? '소재지' : '주소') + ': ' + (f.req.addr || '(입력 필요)'));
    var contact = [];
    if (f.req.phone) contact.push('전화 ' + f.req.phone);
    if (f.req.email) contact.push('전자우편 ' + f.req.email);
    L.push('  - 연락처: ' + (contact.length ? contact.join(' / ') : '(입력 필요)'));
    L.push('');
    L.push('2. 청구 내용');
    L.push('  「공공기관의 정보공개에 관한 법률」 제10조에 따라, 귀 기관이 보유·관리하고 있는 아래 정보의 공개를 청구합니다.');
    if (f.purpose) L.push('  (청구 목적: ' + f.purpose + ')');
    if (f.dept) L.push('  - 대상 부서: ' + f.dept);
    L.push('  - 청구 정보:');
    var n = 0;
    for (var i = 0; i < f.items.length; i++) {
      if (!f.items[i].title) continue;
      n++;
      L.push('    (' + n + ') ' + f.items[i].title + (f.items[i].scope ? ' — ' + f.items[i].scope : ''));
    }
    if (n === 0) L.push('    (청구할 문서를 입력해 주세요)');
    L.push('');
    L.push('3. 공개 방법 및 수령 방법');
    var pubs = [];
    if (f.pub.file) pubs.push('전자파일');
    if (f.pub.copy) pubs.push('사본·출력물 교부');
    if (f.pub.view) pubs.push('열람');
    L.push('  - 공개 방법: ' + (pubs.length ? pubs.join(', ') : '(선택 필요)'));
    if (f.pub.file) L.push('    (전자파일은 가능한 한 작성 원본 형식 — 한글(HWP)·엑셀·텍스트 PDF 등 — 으로 제공해 주시기 바랍니다.)');
    L.push('  - 수령 방법: ' + (RECV_LABEL[f.recv] || RECV_LABEL.net));
    var reqs = [];
    if (f.followUp) {
      reqs.push('이 청구는 ' + (f.followUp.received_at ? f.followUp.received_at + ' 접수한 ' : '이전에 접수한 ') +
        '정보공개 청구(접수번호 ' + f.followUp.receipt_no + ')의 후속 청구입니다.');
    }
    if (f.opts.nocreate) reqs.push('이 청구는 새로운 문서의 작성·취합·분석을 요구하는 것이 아니라, 귀 기관이 이미 보유·관리하는 문서 그대로의 공개를 청구하는 것입니다.');
    if (f.opts.partial) reqs.push('비공개 대상 정보가 포함되어 있는 경우 해당 부분만 제외하고 나머지를 부분공개해 주시기 바랍니다.');
    if (f.opts.nonexist) reqs.push('청구 정보가 존재하지 않는 경우 부존재 사실을 통지해 주시고, 유사한 내용을 담은 보유 문서가 있다면 그 문서명을 함께 안내해 주시기 바랍니다.');
    if (f.opts.personal) reqs.push('개인정보(성명·연락처 등 개인을 식별할 수 있는 정보)는 청구 대상이 아니며, 포함되어 있는 경우 그 부분은 제외하고 공개해 주시기 바랍니다.');
    if (f.opts.cost) reqs.push('비용(수수료·우송료)이 발생하는 경우 금액과 납부 방법을 사전에 안내해 주시기 바랍니다.');
    if (reqs.length) {
      L.push('');
      L.push('4. 요청 사항');
      for (var r = 0; r < reqs.length; r++) L.push('  ' + (r + 1) + ') ' + reqs[r]);
    }
    L.push('');
    L.push(d ? d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일' : '(청구일)');
    L.push('');
    L.push('청구인: ' + (f.req.name || '(성명)') + (isOrg && f.req.rep ? ' (대표자 ' + f.req.rep + ')' : ''));
    L.push('');
    L.push((f.agency || '(청구 기관)') + ' 귀중');
    return L.join('\n');
  }

  // ── 특정성 점검(청구 정보는 내용·범위를 확정할 수 있을 정도로 특정해야 함) ──
  function checkItem(title) {
    var w = [];
    if (!title) return w;
    if (title.length < 4) w.push('문서 이름을 더 구체적으로 적어 주세요.');
    if (/(일체|전부|모든|관련\s*자료|관련\s*서류)/.test(title)) {
      w.push('‘일체·모든·관련 자료’처럼 범위가 넓은 표현은 특정성 부족으로 보정 요구·부분공개 사유가 될 수 있습니다. 문서 이름과 시점으로 좁혀 주세요.');
    }
    if (/[?？]|(어떻게|왜\s|무엇|언제|몇\s*건|알려)/.test(title)) {
      w.push('질문 형태입니다. 정보공개는 보유 문서를 청구하는 제도이므로 “○○ 처리지침 최신본”처럼 문서 이름으로 지목하세요.');
    }
    if (/(작성해|만들어|분석해|취합해|정리해)/.test(title)) {
      w.push('새로 작성·취합을 요구하는 표현입니다(부존재 통지 사유). 이미 존재하는 문서로 바꿔 보세요.');
    }
    return w;
  }
  var PRIOR_MSG = {
    denied: '선행 청구에서 비공개 결정을 받은 항목입니다. 같은 청구를 반복하기보다 이의신청(법 제18조)이나 문서 이름·범위 변경을 검토하세요.',
    none: '선행 청구에서 부존재로 답이 온 항목입니다. 다른 문서 이름으로 지목하거나, 유사 보유 문서명을 안내받아 다시 청구해 보세요.'
  };

  // 후속 청구이면 앞선 회차의 접수번호를 청구서에 밝힌다(기관이 같은 건으로 묶어 볼 수 있도록).
  function followUpInfo() {
    var c = S.draft.campaignId ? findCampaign(S.draft.campaignId) : null;
    if (!c) return null;
    var limit = S.draft.roundSeq || 1e9, best = null;
    (c.rounds || []).forEach(function (r) {
      if (r.seq < limit && r.receipt_no && (!best || r.seq > best.seq)) best = r;
    });
    return best ? { receipt_no: best.receipt_no, received_at: best.received_at } : null;
  }

  // ── 미리보기 갱신 ───────────────────────────────────────────
  function refresh() {
    var f = readForm();
    f.followUp = followUpInfo();
    $('foi-preview').value = buildText(f);

    var rows = document.querySelectorAll('#foi-items .foi-item');
    var totalWarn = 0;
    for (var i = 0; i < rows.length; i++) {
      var ws = checkItem(f.items[i].title);
      if (PRIOR_MSG[f.items[i].prior]) ws.unshift(PRIOR_MSG[f.items[i].prior]);
      totalWarn += ws.length;
      rows[i].querySelector('.foi-item-warn').innerHTML = ws.map(function (t) { return '<div>⚠ ' + esc(t) + '</div>'; }).join('');
    }

    var miss = [];
    if (!f.agency) miss.push('청구 기관');
    if (!f.items.some(function (x) { return x.title; })) miss.push('청구할 문서');
    if (!f.pub.file && !f.pub.copy && !f.pub.view) miss.push('공개 방법');
    if (!f.req.name) miss.push(f.req.type === 'org' ? '단체 명칭' : '청구인 성명');
    if (!f.req.phone && !f.req.email) miss.push('연락처(전화 또는 전자우편)');
    var box = $('foi-status-box');
    if (miss.length) { box.className = 'foi-status warn'; box.textContent = '아직 비어 있는 항목: ' + miss.join(', '); }
    else if (totalWarn) { box.className = 'foi-status warn'; box.textContent = '필수 항목은 채워졌습니다. 다만 위 문서 항목의 ⚠ 안내를 확인해 보세요.'; }
    else { box.className = 'foi-status ok'; box.textContent = '필수 항목이 모두 채워졌습니다. 복사하거나 다운로드해서 정보공개시스템에 제출하세요.'; }
    $('foi-org-only-rep').style.display = f.req.type === 'org' ? '' : 'none';
    $('foi-person-only-birth').style.display = f.req.type === 'org' ? 'none' : '';
  }

  // ── 액션: 복사·다운로드·메일·포털 ───────────────────────────
  function copyText() {
    var text = $('foi-preview').value;
    var done = function () { flash('foi-flash', '청구서를 복사했습니다.'); };
    var fail = function () {
      var ta = $('foi-preview'); ta.focus(); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { flash('foi-flash', '복사하지 못했습니다. 미리보기를 직접 선택해 복사해 주세요.', false); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fail);
    else fail();
  }
  function safeName(s) { return String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40); }
  function downloadBlob(name, text, type) {
    var blob = new Blob([text], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function downloadText() {
    var f = readForm();
    downloadBlob('정보공개청구서_' + safeName(f.agency || '기관') + '_' + ymd(new Date()).replace(/-/g, '') + '.txt',
      '\uFEFF' + $('foi-preview').value, 'text/plain;charset=utf-8');
  }
  function sendToMail() {
    var f = readForm();
    if (typeof _mailLoadDraftIntoEditor !== 'function') { flash('foi-flash', '메일 편지쓰기를 불러오지 못했습니다.', false); return; }
    _mailLoadDraftIntoEditor({
      subject: '[정보공개 청구] ' + (f.agency || '') + (f.dept ? ' ' + f.dept : ''),
      body: $('foi-preview').value, draftId: null,
      sourceNote: '정보 공개 청구 탭에서 가져온 청구서입니다. 받는 사람(기관의 정보공개 담당 전자우편)을 직접 입력하세요. 기관이 전자우편 청구를 받는지는 먼저 확인해 주세요.',
      switchTo: true
    });
  }
  function openPortal() { window.open(PORTAL_URL, '_blank', 'noopener'); }

  function applyPreset() {
    var id = $('foi-preset').value;
    var p = PRESETS[id] || PRESETS.blank;
    var cur = readItems().filter(function (x) { return x.title; });
    if (cur.length && !window.confirm('현재 입력한 문서 목록을 이 묶음으로 바꿀까요?')) { $('foi-preset').value = S.preset; return; }
    S.preset = id;
    setItems(p.items.map(function (x) { return { title: x.title, scope: x.scope }; }));
    refresh();
  }

  // ── 이미 확인된 정보 패널 ────────────────────────────────────
  function stateBadge(state) {
    var st = ITEM_STATE[state] || ITEM_STATE.pending;
    return '<span class="badge ' + st.badge + '">' + esc(st.label) + '</span>';
  }
  function renderKnown() {
    var d = S.draft;
    var has = d.known.length || d.archiveMatches.length || d.unverified.length || d.publicSources.length;
    $('foi-known-card').style.display = has ? '' : 'none';
    if (!has) return;
    $('foi-known-items').innerHTML = d.known.map(function (k) {
      var link = safeUrl(k.source_url);
      var ref = k.state === 'shared' && k.archive_id
        ? ' <a href="#" onclick="_foi.archiveOpen(\'' + esc(k.archive_id) + '\');return false">아카이브 건 보기</a>'
        : (link ? ' <a href="' + esc(link) + '" target="_blank" rel="noopener">출처 열기 ↗</a>' : '');
      return '<div class="row">' + stateBadge(k.state) + '<div class="t"><b>' + esc(k.title) + '</b>' +
        (k.scope ? ' <span class="foi-opt">— ' + esc(k.scope) + '</span>' : '') +
        (k.note ? '<div class="hint" style="margin:0">' + esc(k.note) + '</div>' : '') + ref + '</div></div>';
    }).join('');
    var m = '';
    if (d.archiveMatches.length) {
      m += '<div class="sec">일치한 공유 아카이브 건</div>' + d.archiveMatches.map(function (x) {
        return '<div class="row"><div class="t">' + esc(x.reason || '관련 건') + ' <a href="#" onclick="_foi.archiveOpen(\'' + esc(x.id) + '\');return false">자세히 보기</a></div></div>';
      }).join('');
    }
    if (d.publicSources.length) {
      m += '<div class="sec">확인한 공개 자료 주소</div>' + d.publicSources.map(function (s) {
        return '<div class="row"><div class="t"><a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener">' + esc(s.title) + ' ↗</a>' +
          (s.covers ? '<div class="hint" style="margin:0">' + esc(s.covers) + '</div>' : '') + '</div></div>';
      }).join('');
    }
    $('foi-known-matches').innerHTML = m;
    $('foi-known-unverified').innerHTML = d.unverified.length
      ? '<div class="sec">확인하지 못한 것</div><div class="unv">' + d.unverified.map(function (u) { return '· ' + esc(u); }).join('<br>') + '</div>'
      : '';
  }

  // ── AI 입력창(K-FOI) ────────────────────────────────────────
  function autosize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 340) + 'px'; }
  function aiUpdateSend() { $('foi-ai-send').disabled = S.chat.busy || !$('foi-ai-input').value.trim(); }
  function appendBubble(role, text, progress) {
    var row = document.createElement('div');
    row.className = 'chat-bubble-row ' + role;
    var inner = role === 'user'
      ? esc(text)
      : (typeof mdToHtml === 'function' ? mdToHtml(text) : esc(text));
    if (role === 'assistant' && progress && progress.length) {
      inner += '<div class="hint" style="margin-top:10px">' + progress.map(function (p) { return '🔎 ' + esc(p); }).join('<br>') + '</div>';
    }
    row.innerHTML = '<div class="chat-bubble">' + inner + '</div>';
    $('foi-ai-thread').appendChild(row);
  }
  function showProgress(lines) {
    var el = $('foi-ai-progress');
    el.style.display = '';
    el.innerHTML = lines.map(function (l) { return '<div class="row">✓ ' + esc(l) + '</div>'; }).join('') +
      '<div class="row"><span class="spinner"></span>확인하고 있습니다…</div>';
  }
  function hideProgress() { $('foi-ai-progress').style.display = 'none'; $('foi-ai-progress').innerHTML = ''; }

  async function aiSend() {
    var ta = $('foi-ai-input');
    var text = ta.value.trim();
    if (!text || S.chat.busy) return;
    if (!S.chat.messages.length) S.chat.firstUser = text;
    S.chat.messages.push({ role: 'user', content: text });
    appendBubble('user', text);
    ta.value = ''; autosize(ta);
    S.chat.busy = true; aiUpdateSend();
    $('foi-ai-err').style.display = 'none';
    $('foi-ai-reset').style.display = '';
    var steps = 0, lines = [], final = null;
    try {
      for (var call = 0; call < MAX_AI_CALLS; call++) {
        showProgress(lines);
        var res = await api('/kfoi/chat', { method: 'POST', body: { messages: S.chat.messages, research_steps: steps } });
        (res.append || []).forEach(function (m) { S.chat.messages.push(m); });
        (res.progress || []).forEach(function (p) { lines.push(p); });
        steps = res.research_steps || steps;
        if (res.pending) continue;
        final = res; break;
      }
      hideProgress();
      if (!final) throw new Error('조사가 길어져 중단했습니다. 알고 싶은 것을 더 좁혀서 다시 적어 주세요.');
      appendBubble('assistant', final.reply || (final.action ? '청구서 폼을 채웠습니다.' : '응답이 비어 있습니다.'), lines);
      if (final.action) applyFill(final.action);
    } catch (e) {
      hideProgress();
      var er = $('foi-ai-err');
      er.textContent = 'AI 조사에 실패했습니다: ' + (e && e.message ? e.message : e);
      er.style.display = '';
    } finally {
      S.chat.busy = false; aiUpdateSend();
    }
  }
  function aiReset() {
    S.chat = { messages: [], firstUser: '', busy: false };
    $('foi-ai-thread').innerHTML = '';
    hideProgress();
    $('foi-ai-err').style.display = 'none';
    $('foi-ai-reset').style.display = 'none';
    $('foi-ai-input').focus();
    aiUpdateSend();
  }

  // KFOI_FILL → 폼·이미 확인된 정보 패널에 반영
  function applyFill(a) {
    if (formHasContent() && !window.confirm('현재 입력한 청구서 내용을 AI가 정리한 내용으로 바꿀까요?')) {
      flash('foi-flash', '청구서 폼은 그대로 두었습니다. 위 답변만 참고하세요.');
      return;
    }
    var d = newDraft();
    d.title = a.title || '';
    d.goal = S.chat.firstUser;
    d.known = (a.items || []).filter(function (i) { return i.state === 'public' || i.state === 'shared'; });
    d.publicSources = a.public_sources || [];
    d.archiveMatches = a.archive_matches || [];
    d.unverified = a.unverified || [];
    S.draft = d;
    var req = (a.items || []).filter(function (i) { return i.state === 'pending'; })
      .map(function (i) { return { id: '', title: i.title, scope: i.scope, prior: i.prior || '', note: i.note || '' }; });
    var cur = readForm();
    writeForm({ presetId: 'blank', agency: a.agency, dept: a.dept, purpose: a.purpose, items: req, pub: cur.pub, recv: cur.recv, opts: cur.opts });
    var note = $('foi-editing-note');
    note.textContent = req.length
      ? 'AI가 정리한 내용으로 폼을 채웠습니다. 청구할 문서 ' + req.length + '건, 이미 확인된 정보 ' + d.known.length + '건 — 내용을 확인하고 청구인 정보를 입력한 뒤 “청구 건에 저장”하세요.'
      : '청구할 항목이 남지 않았습니다 — 위에서 이미 공개됐거나 다른 사용자가 얻은 정보로 확인됐습니다. 출처를 열어 확인해 보세요.';
    note.style.display = '';
    renderKnown();
    refresh();
    var card = $('foi-known-card');
    if (card && card.style.display !== 'none' && card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── 청구 건에 저장 ───────────────────────────────────────────
  function maxItemNum(items) {
    var m = 0;
    (items || []).forEach(function (i) { var n = parseInt(String(i.id).replace(/\D/g, ''), 10); if (n > m) m = n; });
    return m;
  }
  function defaultTitle(f) { return f.agency + (f.dept ? ' ' + f.dept : '') + ' 정보공개 청구'; }

  async function saveToCampaign() {
    var f = readForm();
    var rows = f.items.filter(function (x) { return x.title; });
    if (!f.agency) { flash('foi-flash', '청구 기관을 입력해 주세요.', false); $('foi-agency').focus(); return; }
    if (!rows.length) { flash('foi-flash', '청구할 문서를 하나 이상 입력해 주세요.', false); return; }
    var d = S.draft;
    var camp = d.campaignId ? findCampaign(d.campaignId) : null;
    var payload, roundSeq;

    if (!camp) {
      var n = 0, items = [], reqIds = [];
      d.known.forEach(function (k) {
        items.push({ id: 'i' + (++n), title: k.title, scope: k.scope, state: k.state, note: k.note || '', source_url: k.source_url || '', round_seq: null, prior: '', archive_id: k.archive_id || '' });
      });
      rows.forEach(function (x) {
        var id = 'i' + (++n); reqIds.push(id);
        items.push({ id: id, title: x.title, scope: x.scope, state: 'pending', note: x.note || '', source_url: '', round_seq: 1, prior: x.prior || '', archive_id: '' });
      });
      roundSeq = 1;
      payload = {
        title: d.title || defaultTitle(f), goal: d.goal, agency: f.agency, dept: f.dept, items: items,
        rounds: [{ seq: 1, status: 'draft', item_ids: reqIds, receipt_no: '', received_at: '', decided_at: '', memo: '' }],
        public_sources: d.publicSources, source_archive_id: d.sourceArchiveId
      };
    } else {
      var c = clone(camp);
      var num = maxItemNum(c.items);
      var byId = {}; c.items.forEach(function (i) { byId[i.id] = i; });
      roundSeq = d.roundSeq || ((c.rounds || []).reduce(function (m, r) { return Math.max(m, r.seq); }, 0) + 1);
      var round = null;
      (c.rounds || []).forEach(function (r) { if (r.seq === roundSeq) round = r; });
      var ids = [];
      rows.forEach(function (x) {
        var it = x.id && byId[x.id];
        if (it) { it.title = x.title; it.scope = x.scope; if (!d.roundSeq) it.state = 'pending'; it.round_seq = roundSeq; ids.push(it.id); }
        else {
          var id = 'i' + (++num);
          c.items.push({ id: id, title: x.title, scope: x.scope, state: 'pending', note: x.note || '', source_url: '', round_seq: roundSeq, prior: x.prior || '', archive_id: '' });
          ids.push(id);
        }
      });
      if (round) {
        // 이 회차에서 빠진 항목은 삭제하지 않고 "미청구"로 되돌려 둔다(상세 화면에서 제외 처리 가능).
        round.item_ids.forEach(function (id) {
          if (ids.indexOf(id) < 0 && byId[id]) { byId[id].round_seq = null; if (byId[id].state === 'requested') byId[id].state = 'pending'; }
        });
        round.item_ids = ids;
      } else {
        c.rounds = (c.rounds || []).concat([{ seq: roundSeq, status: 'draft', item_ids: ids, receipt_no: '', received_at: '', decided_at: '', memo: '' }]);
      }
      c.agency = f.agency; c.dept = f.dept;
      payload = { id: c.id, title: c.title, goal: c.goal, agency: c.agency, dept: c.dept, items: c.items, rounds: c.rounds, public_sources: c.public_sources };
    }

    // 청구인 정보는 서버로 보내지 않는다 — 이 브라우저에만(사용자가 켠 경우).
    if (f.req.keep) { S.profile = { type: f.req.type, name: f.req.name, rep: f.req.rep, birth: f.req.birth, addr: f.req.addr, phone: f.req.phone, email: f.req.email }; }
    else S.profile = null;
    storeProfile(S.profile);

    var btn = $('foi-save-btn'); btn.disabled = true;
    try {
      var res = await api('/kfoi/campaigns/save', { method: 'POST', body: payload });
      upsertCampaign(res.campaign);
      S.draft.campaignId = res.campaign.id;
      S.draft.roundSeq = roundSeq;
      flash('foi-flash', '청구 건에 저장했습니다 — “내 청구 건”에서 접수일·접수번호·결과를 기록하세요.');
      updateNavCount(); renderList();
    } catch (e) {
      var msg = String(e && e.message || e);
      flash('foi-flash', /종료된|CAMPAIGN_CLOSED/.test(msg) ? '종료된 건입니다 — “내 청구 건”에서 다시 연 뒤 저장해 주세요.' : '저장하지 못했습니다: ' + msg, false);
    } finally { btn.disabled = false; }
  }

  function resetForm() {
    S.draft = newDraft();
    writeForm({ presetId: 'blank', items: [{ title: '', scope: '' }], pub: { file: true, copy: false, view: false }, recv: 'net', opts: { nocreate: true, partial: true, nonexist: true, personal: true, cost: true } });
    $('foi-date').value = ymd(new Date());
    writeRequester(S.profile);
    $('foi-editing-note').style.display = 'none';
    renderKnown();
    refresh();
  }

  // ═══════════════ 청구 건(캠페인) ═══════════════════════════

  // ── 기한 계산(회차 단위) ────────────────────────────────────
  function calcRound(r) {
    var out = { decideBy: null, extendBy: null, day20: null, noRespAppealBy: null, appealBy: null };
    var base = parseYmd(r.received_at);
    if (base) {
      out.decideBy = rollWeekend(addDays(base, 10));                 // 제11조 ①
      out.extendBy = rollWeekend(addDays(out.decideBy, 10));         // 제11조 ② — 기간 끝난 다음 날부터 10일 범위
      out.day20 = addDays(base, 20);                                 // 제18조 ① — 청구 후 20일 경과일
      out.noRespAppealBy = rollWeekend(addDays(out.day20, 30));
    }
    var dec = parseYmd(r.decided_at);
    if (dec) out.appealBy = rollWeekend(addDays(dec, 30));           // 제18조 ① — 통지받은 날부터 30일
    return out;
  }
  function roundDeadline(r) {
    var c = calcRound(r);
    if ((r.status === 'partial' || r.status === 'denied') && c.appealBy) return { label: '이의신청 마감', date: c.appealBy };
    if (r.status === 'filed' && c.decideBy) return { label: '결정 기한', date: c.decideBy };
    if (r.status === 'extended' && c.extendBy) return { label: '연장 기한(최대)', date: c.extendBy };
    return null;
  }
  function campaignDeadline(c) {
    if (c.status === 'closed') return null;
    var best = null;
    (c.rounds || []).forEach(function (r) { var d = roundDeadline(r); if (d && (!best || d.date < best.date)) best = d; });
    return best;
  }
  function roundCalcHtml(r) {
    var c = calcRound(r), lines = [];
    if (c.decideBy) {
      lines.push('<b>결정 기한</b> (법 제11조 ①, 접수일 다음 날부터 10일): ' + fmtDate(c.decideBy) + ' · ' + dLabel(daysLeft(c.decideBy)));
      lines.push('<b>연장 시 최대</b> (법 제11조 ②): ' + fmtDate(c.extendBy) + ' — 연장하려면 기관이 연장 사실·사유를 문서로 통지해야 합니다.');
      lines.push('<b>접수 후 20일 경과일</b>: ' + fmtDate(c.day20) + ' — 이날까지 결정이 없으면 이의신청·행정심판이 가능하고, 이의신청은 ' + fmtDate(c.noRespAppealBy) + '까지 문서로 해야 합니다(법 제18조 ①).');
    }
    if (c.appealBy) {
      lines.push('<b>이의신청 마감</b> (결정 통지일부터 30일, 법 제18조 ①): ' + fmtDate(c.appealBy) + ' · ' + dLabel(daysLeft(c.appealBy)) +
        ' — 비공개·부분공개에 불복할 때만 해당합니다. 이의신청 없이 행정심판을 청구할 수도 있습니다(법 제19조).');
    }
    if (!lines.length) return '';
    return '<div class="foi-calc">' + lines.map(function (l) { return '<div>' + l + '</div>'; }).join('') +
      '<div class="hint">토·일요일만 반영한 참고용 계산이며 공휴일은 반영하지 않습니다. 기관이 보낸 통지의 기한이 항상 우선합니다.</div></div>';
  }

  function progressOf(c) {
    var open = 0, resolved = 0, items = c.items || [];
    items.forEach(function (i) {
      if (OPEN_STATES.indexOf(i.state) >= 0) open++;
      if (RESOLVED_STATES.indexOf(i.state) >= 0) resolved++;
    });
    return { total: items.length, open: open, resolved: resolved };
  }
  function itemById(c, id) { var r = null; (c.items || []).forEach(function (i) { if (i.id === id) r = i; }); return r; }
  function roundBySeq(c, seq) { var r = null; (c.rounds || []).forEach(function (x) { if (String(x.seq) === String(seq)) r = x; }); return r; }
  function latestRound(c) { var r = null; (c.rounds || []).forEach(function (x) { if (!r || x.seq > r.seq) r = x; }); return r; }

  // 회차 상태가 바뀌면 그 회차에 속한 항목의 상태를 함께 옮긴다(직접 고친 상태는 건드리지 않는다).
  function applyRoundStatus(c, round) {
    var map = { filed: 'requested', extended: 'requested', disclosed: 'obtained', partial: 'partial', denied: 'denied', none: 'none' };
    (c.items || []).forEach(function (it) {
      if (round.item_ids.indexOf(it.id) < 0) return;
      if (round.status === 'withdrawn' || round.status === 'draft') { if (it.state === 'requested') it.state = 'pending'; return; }
      var target = map[round.status];
      if (target && (it.state === 'pending' || it.state === 'requested')) it.state = target;
    });
  }

  // ── 목록 ────────────────────────────────────────────────────
  function updateNavCount() {
    var n = S.campaigns.filter(function (c) { return c.status === 'active'; }).length;
    var el = $('foi-nav-count');
    el.textContent = n; el.style.display = n ? '' : 'none';
  }
  async function loadCampaigns() {
    if (S.loading) return;
    S.loading = true;
    $('foi-list-loading').style.display = '';
    try {
      var d = await api('/kfoi/campaigns/list');
      S.campaigns = d.items || []; S.loaded = true;
    } catch (e) {
      flash('foi-list-flash', '청구 건을 불러오지 못했습니다: ' + (e && e.message ? e.message : e), false);
    } finally {
      S.loading = false; $('foi-list-loading').style.display = 'none';
    }
    updateNavCount(); renderList();
  }
  function setFilter(f) {
    S.filter = f;
    var bs = document.querySelectorAll('#foi-filter button');
    for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('active', bs[i].dataset.f === f);
    renderList();
  }
  function renderList() {
    var all = S.campaigns, active = 0, openItems = 0, soon = 0, closed = 0;
    all.forEach(function (c) {
      if (c.status === 'closed') { closed++; return; }
      active++; openItems += progressOf(c).open;
      var dl = campaignDeadline(c); if (dl && daysLeft(dl.date) <= 3) soon++;
    });
    $('foi-sum-active').textContent = active; $('foi-sum-open').textContent = openItems;
    $('foi-sum-soon').textContent = soon; $('foi-sum-closed').textContent = closed;

    var list = all.filter(function (c) { return S.filter === 'all' || (S.filter === 'closed') === (c.status === 'closed'); });
    list.sort(function (a, b) {
      var da = campaignDeadline(a), db = campaignDeadline(b);
      if (da && db) return da.date - db.date;
      if (da) return -1;
      if (db) return 1;
      return String(b.updated || '').localeCompare(String(a.updated || ''));
    });
    var empty = $('foi-list-empty'), wrap = $('foi-list-wrap');
    if (!list.length) {
      wrap.style.display = 'none'; empty.style.display = '';
      empty.innerHTML = !S.loaded
        ? '청구 건을 불러오는 중이거나 로그인이 필요합니다.'
        : (S.filter === 'closed'
          ? '보관된 건이 없습니다. 원하는 정보를 모두 얻은 건은 “종료·보관”하면 이곳에 쌓입니다.'
          : '<div class="foi-empty-cta">진행 중인 청구 건이 없습니다.<br>“새 청구서”에서 알고 싶은 것을 적어 시작하거나, “공유 아카이브”에서 다른 사용자가 이미 얻은 자료를 먼저 찾아보세요.</div>');
      renderDetailIfOpen();
      return;
    }
    empty.style.display = 'none'; wrap.style.display = '';
    var html = '';
    list.forEach(function (c) {
      var pr = progressOf(c), pct = pr.total ? Math.round(pr.resolved * 100 / pr.total) : 0;
      var lr = latestRound(c), dl = campaignDeadline(c), dlHtml = '—';
      if (dl) {
        var n = daysLeft(dl.date);
        dlHtml = '<div class="foi-dl' + (n < 0 ? ' over' : (n <= 3 ? ' soon' : '')) + '">' + dLabel(n) + '</div><div class="hint" style="margin:0">' + esc(dl.label) + ' ' + fmtDate(dl.date) + '</div>';
      }
      var stat;
      if (c.status === 'closed') stat = '<span class="foi-chip ok">보관됨</span>' + (c.share === 'shared' ? '<span class="foi-chip">공유 중</span>' : '');
      else if (lr) stat = '<span class="badge ' + ROUND_STATE[lr.status].badge + '">' + esc(ROUND_STATE[lr.status].label) + '</span><div class="sub-line">' + lr.seq + '회차 · 총 ' + c.rounds.length + '회</div>';
      else stat = '<span class="foi-chip">청구 전</span>';
      html += '<tr' + (S.detail && S.detail.id === c.id ? ' class="sel"' : '') + '>' +
        '<td><div class="foi-ag">' + esc(c.title) + '</div><div class="sub-line">' + esc(c.agency) + (c.dept ? ' · ' + esc(c.dept) : '') + '</div></td>' +
        '<td><div class="foi-bar"><span style="width:' + pct + '%"></span></div><div class="foi-prog-txt">' + pr.resolved + '/' + pr.total + ' 확보' + (pr.open ? ' · 남은 ' + pr.open : '') + '</div></td>' +
        '<td>' + stat + '</td><td>' + dlHtml + '</td>' +
        '<td class="ct-actions"><button type="button" class="btn btn-outline btn-sm" onclick="_foi.openCampaign(\'' + esc(c.id) + '\')">관리</button> ' +
        '<button type="button" class="btn btn-outline btn-sm" title="같은 문서 목록으로 다른 기관에 청구서 만들기" onclick="_foi.reuse(\'' + esc(c.id) + '\')">재사용</button></td></tr>';
    });
    $('foi-list-body').innerHTML = html;
    renderDetailIfOpen();
    checkLegacy();
  }
  function renderDetailIfOpen() { if (S.detail) renderDetail(); }

  // ── 상세 ────────────────────────────────────────────────────
  function openCampaign(id) {
    var c = findCampaign(id);
    if (!c) return;
    if (S.detail && S.detailDirty && S.detail.id !== id && !window.confirm('저장하지 않은 변경이 있습니다. 버리고 다른 건을 열까요?')) return;
    S.detail = clone(c); S.detailDirty = false; S.panel = null;
    sub('list', true);
    renderList();
    var el = $('foi-detail-card');
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function closeDetail() {
    if (S.detail && S.detailDirty && !window.confirm('저장하지 않은 변경이 있습니다. 버릴까요?')) return;
    S.detail = null; S.detailDirty = false; S.panel = null;
    $('foi-detail-card').style.display = 'none';
    renderList();
  }
  function markDirty() {
    S.detailDirty = true;
    var el = $('foi-d-dirty'); if (el) el.style.display = '';
  }
  function itemOptions(sel) {
    return ITEM_ORDER.map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(ITEM_STATE[k].label) + '</option>'; }).join('');
  }
  function roundOptions(sel) {
    return ROUND_ORDER.map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(ROUND_STATE[k].label) + '</option>'; }).join('');
  }

  function renderDetail() {
    var c = S.detail, card = $('foi-detail-card');
    if (!c) { card.style.display = 'none'; return; }
    card.style.display = '';
    var closed = c.status === 'closed', dis = closed ? ' disabled' : '';
    var pr = progressOf(c);
    $('foi-d-title').textContent = c.agency + (c.dept ? ' · ' + c.dept : '');
    var h = '';
    h += '<div class="foi-d-meta">' +
      (closed ? '<span class="foi-chip ok">보관됨' + (c.closed_at ? ' · ' + esc(monthOf(c.closed_at)) : '') + '</span>' + (c.share === 'shared' ? '<span class="foi-chip">공유 아카이브에 공개 중</span>' : '<span class="foi-chip">비공개</span>')
        : '<span class="foi-chip warn">진행 중</span>') +
      '<span>항목 ' + pr.total + '개 · 확보 ' + pr.resolved + ' · 남은 ' + pr.open + ' · 청구 ' + (c.rounds || []).length + '회</span>' +
      (c.source_archive_id ? '<span class="foi-chip">아카이브에서 가져온 건</span>' : '') +
      '<span id="foi-d-dirty" class="foi-chip bad" style="display:' + (S.detailDirty ? '' : 'none') + '">저장하지 않은 변경</span></div>';
    h += '<input type="text" class="foi-d-title-in" data-k="title" value="' + esc(c.title) + '" placeholder="이 건의 이름"' + dis + '>';
    if (!closed && pr.total > 0 && pr.open === 0) {
      h += '<div class="foi-banner"><span>모든 항목이 정리되었습니다. 원하는 정보를 모두 얻었다면 이 건을 종료·보관하고, 다른 사용자와 공유할 수 있습니다.</span>' +
        '<button type="button" class="btn btn-primary btn-sm" onclick="_foi.detailClose()">종료·보관하기</button></div>';
    }

    h += '<div class="foi-h3">얻고 싶은 정보 (' + pr.total + ')</div>';
    h += '<div class="ct-table-wrap"><table class="foi-itbl"><thead><tr><th>문서</th><th style="width:130px">상태</th><th>메모 <span class="foi-opt">(공유되지 않음)</span></th><th style="width:70px">회차</th></tr></thead><tbody>';
    (c.items || []).forEach(function (it) {
      var link = safeUrl(it.source_url);
      h += '<tr><td><div class="it-title">' + esc(it.title) + '</div>' + (it.scope ? '<div class="it-scope">' + esc(it.scope) + '</div>' : '') +
        (it.prior ? '<span class="foi-chip warn">선행 청구 ' + (it.prior === 'denied' ? '비공개' : '부존재') + '</span>' : '') +
        (link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener" style="font-size:13px;color:var(--pri)">출처 ↗</a>' : '') +
        (it.archive_id ? ' <a href="#" style="font-size:13px;color:var(--pri)" onclick="_foi.archiveOpen(\'' + esc(it.archive_id) + '\');return false">아카이브 건</a>' : '') + '</td>' +
        '<td><select data-k="item-state" data-id="' + esc(it.id) + '"' + dis + '>' + itemOptions(it.state) + '</select></td>' +
        '<td><input type="text" data-k="item-note" data-id="' + esc(it.id) + '" value="' + esc(it.note) + '" placeholder="예: 6월 통지, 표 3개 누락"' + dis + '></td>' +
        '<td>' + (it.round_seq ? '#' + it.round_seq : '—') + '</td></tr>';
    });
    h += '</tbody></table></div>';

    h += '<div class="foi-h3">청구 회차 (' + (c.rounds || []).length + ')</div>';
    if (!(c.rounds || []).length) h += '<div class="hint" style="margin:0 0 8px">아직 청구한 회차가 없습니다. 아래 “후속 청구 만들기”로 청구서를 만드세요.</div>';
    (c.rounds || []).forEach(function (r) {
      var titles = (r.item_ids || []).map(function (id) { var it = itemById(c, id); return it ? it.title : ''; }).filter(Boolean);
      h += '<div class="foi-round"><div class="foi-round-head"><b>#' + r.seq + ' 청구</b><span class="badge ' + ROUND_STATE[r.status].badge + '">' + esc(ROUND_STATE[r.status].label) + '</span>' +
        '<button type="button" class="btn btn-outline btn-sm" style="margin-left:auto" onclick="_foi.roundOpen(' + r.seq + ')">청구서 보기·수정</button></div>' +
        '<div class="field-row">' +
          '<div class="field"><label>진행 상태</label><select data-k="round-status" data-seq="' + r.seq + '"' + dis + '>' + roundOptions(r.status) + '</select></div>' +
          '<div class="field"><label>접수일</label><input type="date" data-k="round-received" data-seq="' + r.seq + '" value="' + esc(r.received_at) + '"' + dis + '></div>' +
          '<div class="field"><label>접수번호 <span class="foi-opt">(공유되지 않음)</span></label><input type="text" data-k="round-receipt" data-seq="' + r.seq + '" value="' + esc(r.receipt_no) + '" placeholder="기관·시스템이 부여한 번호"' + dis + '></div>' +
          '<div class="field"><label>결정 통지를 받은 날</label><input type="date" data-k="round-decided" data-seq="' + r.seq + '" value="' + esc(r.decided_at) + '"' + dis + '></div>' +
        '</div>' +
        '<div class="field" style="margin-bottom:0"><label>메모 <span class="foi-opt">(공유되지 않음)</span></label><textarea rows="2" data-k="round-memo" data-seq="' + r.seq + '" placeholder="담당자 회신, 부분공개 사유, 후속 조치 등"' + dis + '>' + esc(r.memo) + '</textarea></div>' +
        (titles.length ? '<div class="foi-round-items">청구한 문서: ' + titles.map(esc).join(' · ') + '</div>' : '') +
        (closed ? '' : roundCalcHtml(r)) + '</div>';
    });

    h += '<div id="foi-d-panel"></div>';
    h += '<div id="foi-d-flash" class="foi-flash" style="display:none"></div>';
    h += '<div class="foi-actions">';
    if (!closed) {
      h += '<button type="button" class="btn btn-primary btn-sm" onclick="_foi.detailSave()">저장</button>' +
        '<button type="button" class="btn btn-outline btn-sm" onclick="_foi.detailFollowUp()">후속 청구 만들기</button>' +
        '<button type="button" class="btn btn-outline btn-sm" onclick="_foi.detailClose()">종료·보관</button>';
    } else {
      h += '<button type="button" class="btn btn-primary btn-sm" onclick="_foi.detailReopen()">다시 열기</button>' +
        '<button type="button" class="btn btn-outline btn-sm" onclick="_foi.detailShare()">공유 설정</button>';
    }
    h += '<button type="button" class="btn btn-outline btn-sm" style="color:var(--red)" onclick="_foi.detailDelete()">삭제</button></div>';
    $('foi-d-body').innerHTML = h;
    renderPanel();
  }

  async function detailSave(silent) {
    var c = S.detail; if (!c) return true;
    try {
      var res = await api('/kfoi/campaigns/save', { method: 'POST', body: {
        id: c.id, title: c.title, goal: c.goal, agency: c.agency, dept: c.dept,
        items: c.items, rounds: c.rounds, public_sources: c.public_sources
      } });
      upsertCampaign(res.campaign);
      S.detail = clone(res.campaign); S.detailDirty = false;
      updateNavCount(); renderList();
      if (!silent) flash('foi-d-flash', '저장했습니다.');
      return true;
    } catch (e) {
      flash('foi-d-flash', '저장하지 못했습니다: ' + (e && e.message ? e.message : e), false);
      return false;
    }
  }

  // ── 후속 청구 ───────────────────────────────────────────────
  function detailFollowUp() {
    var c = S.detail; if (!c) return;
    var cand = (c.items || []).filter(function (i) { return FOLLOWUP_STATES.indexOf(i.state) >= 0 && !(i.state === 'pending' && i.round_seq && roundStatusOf(c, i.round_seq) === 'draft'); });
    if (!cand.length) { flash('foi-d-flash', '후속 청구할 항목이 없습니다 — 미청구·부분 획득·비공개·부존재 항목이 있을 때 만들 수 있습니다.', false); return; }
    var checked = {}; cand.forEach(function (i) { checked[i.id] = i.state !== 'none'; });
    S.panel = { kind: 'followup', checked: checked };
    renderPanel();
  }
  function roundStatusOf(c, seq) { var r = roundBySeq(c, seq); return r ? r.status : ''; }
  async function followUpStart() {
    var c = S.detail; if (!c || !S.panel) return;
    var ids = Object.keys(S.panel.checked).filter(function (k) { return S.panel.checked[k]; });
    if (!ids.length) { flash('foi-d-flash', '항목을 하나 이상 선택해 주세요.', false); return; }
    if (S.detailDirty && !(await detailSave(true))) return;
    c = S.detail;
    var rows = ids.map(function (id) {
      var it = itemById(c, id);
      return { id: it.id, title: it.title, scope: it.scope, prior: it.state === 'denied' ? 'denied' : (it.state === 'none' ? 'none' : (it.prior || '')), note: it.note || '' };
    });
    var known = (c.items || []).filter(function (i) { return i.state === 'public' || i.state === 'shared'; });
    S.draft = newDraft();
    S.draft.campaignId = c.id; S.draft.title = c.title; S.draft.goal = c.goal; S.draft.sourceArchiveId = c.source_archive_id || '';
    S.draft.known = known; S.draft.publicSources = c.public_sources || [];
    var cur = readForm();
    writeForm({ presetId: 'blank', agency: c.agency, dept: c.dept, purpose: '', items: rows, pub: cur.pub, recv: cur.recv, opts: cur.opts });
    S.panel = null;
    var note = $('foi-editing-note');
    note.textContent = '“' + c.title + '” 건의 ' + ((c.rounds || []).length + 1) + '회차(후속) 청구서입니다. 이전 회차의 접수번호가 청구서에 자동으로 언급됩니다. 저장하면 이 건에 회차가 추가됩니다.';
    note.style.display = '';
    sub('new'); renderKnown(); refresh();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function roundOpen(seq) {
    var c = S.detail; if (!c) return;
    var r = roundBySeq(c, seq); if (!r) return;
    var rows = (r.item_ids || []).map(function (id) {
      var it = itemById(c, id); return it ? { id: it.id, title: it.title, scope: it.scope, prior: it.prior || '', note: it.note || '' } : null;
    }).filter(Boolean);
    S.draft = newDraft();
    S.draft.campaignId = c.id; S.draft.roundSeq = r.seq; S.draft.title = c.title; S.draft.goal = c.goal;
    S.draft.known = (c.items || []).filter(function (i) { return i.state === 'public' || i.state === 'shared'; });
    S.draft.publicSources = c.public_sources || [];
    var cur = readForm();
    writeForm({ presetId: 'blank', agency: c.agency, dept: c.dept, purpose: '', items: rows, pub: cur.pub, recv: cur.recv, opts: cur.opts });
    var note = $('foi-editing-note');
    note.textContent = '“' + c.title + '” 건의 ' + r.seq + '회차 청구서를 열었습니다. 저장하면 이 회차가 갱신됩니다.';
    note.style.display = '';
    sub('new'); renderKnown(); refresh();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  // 목록의 "재사용" — 같은 문서 목록으로 다른 기관에 새 건을 만든다(기관은 비운다).
  function reuse(id) {
    var c = findCampaign(id); if (!c) return;
    var rows = (c.items || [])
      .filter(function (i) { return i.state !== 'dropped' && i.state !== 'public' && i.state !== 'shared'; })
      .map(function (i) { return { id: '', title: i.title, scope: i.scope }; });
    S.draft = newDraft(); S.draft.goal = c.goal;
    var cur = readForm();
    writeForm({ presetId: 'blank', agency: '', dept: '', purpose: '', items: rows, pub: cur.pub, recv: cur.recv, opts: cur.opts });
    var note = $('foi-editing-note');
    note.textContent = '“' + c.title + '”의 문서 목록을 복사해 왔습니다. 청구할 기관을 입력하세요 — 저장하면 새 건이 만들어집니다.';
    note.style.display = '';
    sub('new'); renderKnown(); refresh(); $('foi-agency').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── 종료·보관·공유 ──────────────────────────────────────────
  function autoSummary(c) {
    var cnt = {}; (c.items || []).forEach(function (i) { cnt[i.state] = (cnt[i.state] || 0) + 1; });
    var parts = [];
    [['obtained', '획득'], ['partial', '부분 획득'], ['public', '공개 자료로 확인'], ['shared', '아카이브로 확인'], ['denied', '비공개'], ['none', '부존재']].forEach(function (p) {
      if (cnt[p[0]]) parts.push(p[1] + ' ' + cnt[p[0]]);
    });
    return '항목 ' + (c.items || []).length + '개 중 ' + (parts.join(', ') || '결과 없음') + '. 총 ' + (c.rounds || []).length + '회 청구.';
  }
  function sharePreviewHtml(c, summary) {
    var li = (c.items || []).map(function (i) { return '<li>' + esc(i.title) + (i.scope ? ' <span class="foi-opt">(' + esc(i.scope) + ')</span>' : '') + ' — ' + esc(ITEM_STATE[i.state].label) + '</li>'; }).join('');
    var rd = (c.rounds || []).map(function (r) { return '#' + r.seq + ' ' + esc(ROUND_STATE[r.status].label) + (monthOf(r.decided_at || r.received_at) ? ' (' + esc(monthOf(r.decided_at || r.received_at)) + ')' : ''); }).join(' · ');
    var src = (c.public_sources || []).map(function (s) { return '<li>' + esc(s.title) + '</li>'; }).join('');
    return '<div class="foi-share-preview"><b>' + esc(c.title) + '</b><br>' + esc(c.agency) + (c.dept ? ' · ' + esc(c.dept) : '') +
      '<ul>' + li + '</ul>' + (rd ? '<div>회차: ' + rd + '</div>' : '') + (src ? '<div>공개 자료:</div><ul>' + src + '</ul>' : '') +
      '<div>요약: ' + (summary ? esc(summary) : '<span class="foi-opt">(없음)</span>') + '</div>' +
      '<div class="foi-share-no">공유되지 않는 것: 청구인 정보, 요청 원문, 접수번호, 메모(항목·회차), 날짜의 일 단위(월까지만 공개).</div></div>';
  }
  function detailClose() {
    var c = S.detail; if (!c) return;
    S.panel = { kind: 'close', share: true, summary: autoSummary(c) };
    renderPanel();
  }
  function detailShare() {
    var c = S.detail; if (!c) return;
    S.panel = { kind: 'share', share: c.share === 'shared', summary: c.shared_summary || autoSummary(c) };
    renderPanel();
  }
  async function panelConfirm() {
    var c = S.detail, p = S.panel; if (!c || !p) return;
    if (p.kind === 'close') {
      if (S.detailDirty && !(await detailSave(true))) return;
      var pr = progressOf(S.detail);
      if (pr.open > 0 && !window.confirm('아직 얻지 못한 항목이 ' + pr.open + '개 남아 있습니다. 그래도 종료·보관할까요? (나중에 다시 열 수 있습니다)')) return;
      try {
        var res = await api('/kfoi/campaigns/close', { method: 'POST', body: { id: c.id, share: !!p.share, shared_summary: p.summary, closed_reason: pr.open === 0 ? 'all_obtained' : 'user_closed' } });
        upsertCampaign(res.campaign); S.detail = clone(res.campaign); S.panel = null; S.detailDirty = false;
        updateNavCount(); renderList();
        flash('foi-d-flash', res.campaign.share === 'shared' ? '종료·보관했고 공유 아카이브에 공개했습니다.' : '종료·보관했습니다(공유하지 않음).');
      } catch (e) { flash('foi-d-flash', '종료하지 못했습니다: ' + (e && e.message ? e.message : e), false); }
    } else if (p.kind === 'share') {
      try {
        var r2 = await api('/kfoi/campaigns/share', { method: 'POST', body: { id: c.id, share: !!p.share, shared_summary: p.summary } });
        upsertCampaign(r2.campaign); S.detail = clone(r2.campaign); S.panel = null;
        renderList();
        flash('foi-d-flash', r2.campaign.share === 'shared' ? '공유 아카이브에 공개했습니다.' : '공유를 껐습니다.');
      } catch (e2) { flash('foi-d-flash', '공유 설정에 실패했습니다: ' + (e2 && e2.message ? e2.message : e2), false); }
    }
  }
  async function detailReopen() {
    var c = S.detail; if (!c) return;
    if (c.share === 'shared' && !window.confirm('다시 열면 공유 아카이브에서 내려갑니다. 계속할까요?')) return;
    try {
      var res = await api('/kfoi/campaigns/reopen', { method: 'POST', body: { id: c.id } });
      upsertCampaign(res.campaign); S.detail = clone(res.campaign); S.panel = null;
      updateNavCount(); renderList();
      flash('foi-d-flash', '다시 열었습니다 — 진행 중인 건으로 돌아갔습니다.');
    } catch (e) { flash('foi-d-flash', '다시 열지 못했습니다: ' + (e && e.message ? e.message : e), false); }
  }
  async function detailDelete() {
    var c = S.detail; if (!c) return;
    var msg = '“' + c.title + '” 청구 건을 삭제할까요? 되돌릴 수 없습니다.' + (c.share === 'shared' ? ' 공유 아카이브에서도 사라집니다.' : '');
    if (!window.confirm(msg)) return;
    try {
      await api('/kfoi/campaigns/delete', { method: 'POST', body: { id: c.id } });
      S.campaigns = S.campaigns.filter(function (x) { return x.id !== c.id; });
      if (S.draft.campaignId === c.id) S.draft = newDraft();
      S.detail = null; S.detailDirty = false; S.panel = null;
      $('foi-detail-card').style.display = 'none';
      updateNavCount(); renderList();
      flash('foi-list-flash', '삭제했습니다.');
    } catch (e) { flash('foi-d-flash', '삭제하지 못했습니다: ' + (e && e.message ? e.message : e), false); }
  }

  function renderPanel() {
    var el = $('foi-d-panel'); if (!el) return;
    var p = S.panel, c = S.detail;
    if (!p || !c) { el.innerHTML = ''; return; }
    var h = '';
    if (p.kind === 'followup') {
      var cand = (c.items || []).filter(function (i) { return p.checked.hasOwnProperty(i.id); });
      h = '<div class="foi-panel-box"><h4>후속 청구할 항목 선택</h4><div class="hint" style="margin:0 0 8px">미청구·부분 획득·비공개·부존재 항목입니다. 비공개 항목은 같은 청구를 반복하기보다 이의신청(법 제18조)이나 문서 이름·범위 변경을 검토하세요.</div>' +
        cand.map(function (i) {
          return '<label class="chk"><input type="checkbox" data-k="fu-check" data-id="' + esc(i.id) + '"' + (p.checked[i.id] ? ' checked' : '') + '><span>' + esc(i.title) + (i.scope ? ' <span class="foi-opt">(' + esc(i.scope) + ')</span>' : '') + ' ' + stateBadge(i.state) + '</span></label>';
        }).join('') +
        '<div class="foi-actions"><button type="button" class="btn btn-primary btn-sm" onclick="_foi.followUpStart()">이 항목으로 청구서 만들기</button><button type="button" class="btn btn-outline btn-sm" onclick="_foi.panelCancel()">취소</button></div></div>';
    } else {
      var pr = progressOf(c);
      h = '<div class="foi-panel-box"><h4>' + (p.kind === 'close' ? '종료·보관' : '공유 설정') + '</h4>' +
        (p.kind === 'close' ? '<div class="hint" style="margin:0 0 8px">' + esc(autoSummary(c)) + (pr.open ? ' <b style="color:var(--org)">아직 얻지 못한 항목 ' + pr.open + '개가 남아 있습니다.</b>' : '') + ' 종료해도 나중에 다시 열 수 있습니다.</div>' : '') +
        '<label class="chk"><input type="checkbox" data-k="cl-share"' + (p.share ? ' checked' : '') + '><span><b>공유 아카이브에 공개</b> — 다른 혼디 사용자가 같은 정보를 청구하기 전에 이 결과를 찾아볼 수 있습니다.</span></label>' +
        (p.share ? '<div class="field" style="margin:8px 0 0"><label>공개할 요약 <span class="foi-opt">(직접 고칠 수 있습니다 — 개인정보를 넣지 마세요)</span></label><textarea rows="2" data-k="cl-summary" class="foi-textarea">' + esc(p.summary) + '</textarea></div>' +
          '<div class="foi-label-sm" style="margin-top:10px">다른 사용자에게 이렇게 보입니다</div><div id="foi-cl-preview">' + sharePreviewHtml(c, p.summary) + '</div>' : '') +
        '<div class="foi-actions"><button type="button" class="btn btn-primary btn-sm" onclick="_foi.panelConfirm()">' + (p.kind === 'close' ? '종료·보관' : '저장') + '</button><button type="button" class="btn btn-outline btn-sm" onclick="_foi.panelCancel()">취소</button></div></div>';
    }
    el.innerHTML = h;
  }

  // 상세 화면의 입력 이벤트(위임)
  function onDetailInput(ev) {
    var t = ev.target, k = t.dataset && t.dataset.k, c = S.detail;
    if (!k || !c) return;
    if (k === 'title') c.title = t.value;
    else if (k === 'item-note') { var it = itemById(c, t.dataset.id); if (it) it.note = t.value; }
    else if (k === 'round-receipt') { var r1 = roundBySeq(c, t.dataset.seq); if (r1) r1.receipt_no = t.value; }
    else if (k === 'round-memo') { var r2 = roundBySeq(c, t.dataset.seq); if (r2) r2.memo = t.value; }
    else if (k === 'cl-summary') {
      if (S.panel) { S.panel.summary = t.value; var pv = $('foi-cl-preview'); if (pv) pv.innerHTML = sharePreviewHtml(c, t.value); }
      return;
    } else return;
    markDirty();
  }
  function onDetailChange(ev) {
    var t = ev.target, k = t.dataset && t.dataset.k, c = S.detail;
    if (!k || !c) return;
    if (k === 'item-state') { var it = itemById(c, t.dataset.id); if (it) { it.state = t.value; markDirty(); renderDetail(); } }
    else if (k === 'round-status') { var r = roundBySeq(c, t.dataset.seq); if (r) { r.status = t.value; applyRoundStatus(c, r); markDirty(); renderDetail(); } }
    else if (k === 'round-received') { var r1 = roundBySeq(c, t.dataset.seq); if (r1) { r1.received_at = t.value; markDirty(); renderDetail(); } }
    else if (k === 'round-decided') { var r2 = roundBySeq(c, t.dataset.seq); if (r2) { r2.decided_at = t.value; markDirty(); renderDetail(); } }
    else if (k === 'fu-check') { if (S.panel && S.panel.checked) S.panel.checked[t.dataset.id] = t.checked; }
    else if (k === 'cl-share') { if (S.panel) { S.panel.share = t.checked; renderPanel(); } }
  }

  // ═══════════════ 공유 아카이브 ═════════════════════════════
  async function archiveSearch() {
    var q = $('foi-arc-q').value.trim(), ag = $('foi-arc-agency').value.trim();
    $('foi-arc-loading').style.display = ''; $('foi-arc-empty').style.display = 'none';
    try {
      var d = await api('/kfoi/archive/search', { method: 'GET', query: { q: q, agency: ag, limit: 15 } });
      S.arc.results = d.items || [];
      renderArchiveResults();
    } catch (e) {
      flash('foi-arc-flash', '아카이브를 검색하지 못했습니다: ' + (e && e.message ? e.message : e), false);
    } finally { $('foi-arc-loading').style.display = 'none'; }
  }
  function archiveProgressTxt(a) {
    var p = a.progress || { total: 0, resolved: 0 };
    return p.resolved + '/' + p.total + ' 확보';
  }
  function renderArchiveResults() {
    var box = $('foi-arc-results'), list = S.arc.results;
    $('foi-arc-empty').style.display = list.length ? 'none' : '';
    box.innerHTML = list.map(function (a) {
      return '<div class="foi-arc-card" onclick="_foi.archiveOpen(\'' + esc(a.id) + '\')"><div class="t">' + esc(a.title) + '</div>' +
        '<div class="m">' + esc(a.agency) + (a.dept ? ' · ' + esc(a.dept) : '') + ' · ' + esc(a.closed_month || '') + ' 보관 · ' + esc(archiveProgressTxt(a)) + ' · ' + (a.rounds || []).length + '회 청구</div>' +
        (a.shared_summary ? '<div class="s">' + esc(a.shared_summary) + '</div>' : '') + '</div>';
    }).join('');
  }
  async function archiveOpen(id) {
    var found = null;
    S.arc.results.forEach(function (a) { if (a.id === id) found = a; });
    try {
      if (!found) { var d = await api('/kfoi/archive/get', { method: 'GET', query: { id: id } }); found = d.item; }
    } catch (e) { flash('foi-arc-flash', '보관 건을 열지 못했습니다: ' + (e && e.message ? e.message : e), false); sub('archive'); return; }
    S.arc.detail = found;
    sub('archive');
    renderArchiveDetail();
    var el = $('foi-arc-detail-card');
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function archiveCloseDetail() { S.arc.detail = null; $('foi-arc-detail-card').style.display = 'none'; }
  function renderArchiveDetail() {
    var a = S.arc.detail, card = $('foi-arc-detail-card');
    if (!a) { card.style.display = 'none'; return; }
    card.style.display = '';
    $('foi-arc-d-title').textContent = a.title;
    var h = '<div class="foi-d-meta"><span>' + esc(a.agency) + (a.dept ? ' · ' + esc(a.dept) : '') + '</span><span class="foi-chip ok">' + esc(a.closed_month || '') + ' 보관</span><span>' + esc(archiveProgressTxt(a)) + '</span></div>';
    if (a.shared_summary) h += '<div class="foi-share-preview" style="margin-top:12px"><b>작성자 요약</b><br>' + esc(a.shared_summary) + '</div>';
    h += '<div class="foi-h3">청구했던 정보</div><table class="foi-itbl"><thead><tr><th>문서</th><th style="width:130px">결과</th></tr></thead><tbody>' +
      (a.items || []).map(function (i) {
        return '<tr><td><div class="it-title">' + esc(i.title) + '</div>' + (i.scope ? '<div class="it-scope">' + esc(i.scope) + '</div>' : '') + '</td><td>' + stateBadge(i.state) + '</td></tr>';
      }).join('') + '</tbody></table>';
    if ((a.rounds || []).length) {
      h += '<div class="foi-h3">청구 회차</div><div style="font-size:14px">' + a.rounds.map(function (r) {
        return '<span class="badge ' + ROUND_STATE[r.status].badge + '" style="margin-right:6px">#' + r.seq + ' ' + esc(ROUND_STATE[r.status].label) + (r.month ? ' · ' + esc(r.month) : '') + '</span>';
      }).join('') + '</div>';
    }
    if ((a.public_sources || []).length) {
      h += '<div class="foi-h3">이미 공개돼 있던 자료</div><ul class="foi-tips">' + a.public_sources.map(function (s) {
        return '<li><a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener" style="color:var(--pri)">' + esc(s.title) + ' ↗</a>' + (s.covers ? ' <span class="foi-opt">— ' + esc(s.covers) + '</span>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    h += '<div class="hint">다른 사용자가 정리한 자료이며 정확성을 보증하지 않습니다. 이번 버전은 문서 파일 자체는 공유하지 않고 “무엇을 어디에 청구해 어떤 결과를 얻었는지”만 공유합니다.</div>' +
      '<div id="foi-arc-d-flash" class="foi-flash" style="display:none"></div>' +
      '<div class="foi-actions"><button type="button" class="btn btn-primary btn-sm" onclick="_foi.archiveAdopt()">내 청구 건으로 가져오기</button></div>';
    $('foi-arc-d-body').innerHTML = h;
  }
  // 아카이브 건을 내 건으로 가져온다 — 이미 얻을 수 있는 것은 "아카이브"로, 비공개·부존재였던 것은
  // 선행 결과를 표시한 채 "미청구"로 둔다(같은 청구를 그대로 반복하지 않도록 경고가 붙는다).
  async function archiveAdopt() {
    var a = S.arc.detail; if (!a) return;
    var n = 0, items = [];
    (a.items || []).forEach(function (it) {
      if (it.state === 'dropped') return;
      var state = 'pending', prior = '', note = '', aid = '';
      if (['obtained', 'partial', 'public', 'shared'].indexOf(it.state) >= 0) {
        state = 'shared'; aid = a.id;
        note = '아카이브: 다른 사용자가 ' + (it.state === 'partial' ? '부분 ' : '') + '확보(' + (a.closed_month || '') + ')';
      } else if (it.state === 'denied' || it.state === 'none') {
        prior = it.state; note = '선행 청구에서 ' + (it.state === 'denied' ? '비공개' : '부존재') + ' 결과(' + (a.closed_month || '') + ')';
      }
      items.push({ id: 'i' + (++n), title: it.title, scope: it.scope, state: state, note: note, source_url: '', round_seq: null, prior: prior, archive_id: aid });
    });
    if (!items.length) { flash('foi-arc-d-flash', '가져올 항목이 없습니다.', false); return; }
    try {
      var res = await api('/kfoi/campaigns/save', { method: 'POST', body: {
        title: a.title, goal: '', agency: a.agency, dept: a.dept, items: items, rounds: [],
        public_sources: a.public_sources || [], source_archive_id: a.id
      } });
      upsertCampaign(res.campaign); updateNavCount();
      openCampaign(res.campaign.id);
      flash('foi-d-flash', '아카이브 건을 내 청구 건으로 가져왔습니다. 아직 얻지 못한 항목이 있으면 “후속 청구 만들기”로 이어가세요.');
    } catch (e) { flash('foi-arc-d-flash', '가져오지 못했습니다: ' + (e && e.message ? e.message : e), false); }
  }

  // ═══════════════ 초판(브라우저 저장) 기록 가져오기 ═══════════
  function legacyRecords() {
    try {
      var d = JSON.parse(window.localStorage.getItem(LS_LEGACY) || 'null');
      if (d && Array.isArray(d.records) && !d.imported) {
        return d.records.filter(function (r) { return r && r.agency && Array.isArray(r.items) && r.items.length; });
      }
    } catch (e) { /* 없음 */ }
    return [];
  }
  function checkLegacy() {
    var n = legacyRecords().length;
    $('foi-legacy-box').style.display = n ? '' : 'none';
    if (n) $('foi-legacy-text').textContent = '이 브라우저에 이전 버전으로 저장된 청구 기록이 ' + n + '건 있습니다. 내 청구 건으로 가져오면 서버에 저장되어 어느 PC에서든 볼 수 있습니다(청구인 정보는 가져오지 않습니다).';
  }
  async function importLegacy() {
    var recs = legacyRecords(), ok = 0, fail = 0;
    var itemMap = { draft: 'pending', filed: 'requested', extended: 'requested', disclosed: 'obtained', partial: 'partial', denied: 'denied', none: 'none', withdrawn: 'dropped' };
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i], st = ROUND_STATE[r.status] ? r.status : 'draft';
      var items = r.items.map(function (x, idx) {
        return { id: 'i' + (idx + 1), title: x.title, scope: x.scope || '', state: itemMap[st] || 'pending', note: '', source_url: '', round_seq: 1, prior: '', archive_id: '' };
      });
      try {
        var res = await api('/kfoi/campaigns/save', { method: 'POST', body: {
          title: r.agency + (r.dept ? ' ' + r.dept : '') + ' 정보공개 청구', goal: '', agency: r.agency, dept: r.dept || '', items: items,
          rounds: [{ seq: 1, status: st, item_ids: items.map(function (x) { return x.id; }), receipt_no: r.receiptNo || '', received_at: r.receivedAt || '', decided_at: r.decidedAt || '', memo: r.memo || '' }],
          public_sources: []
        } });
        upsertCampaign(res.campaign); ok++;
      } catch (e) { fail++; }
    }
    if (!fail) {
      try { var d = JSON.parse(window.localStorage.getItem(LS_LEGACY)); d.imported = true; window.localStorage.setItem(LS_LEGACY, JSON.stringify(d)); } catch (e2) { /* 무시 */ }
    }
    updateNavCount(); renderList();
    flash('foi-list-flash', '가져오기 완료 — 성공 ' + ok + '건' + (fail ? ', 실패 ' + fail + '건(다시 시도할 수 있습니다)' : ''), !fail);
  }

  // ═══════════════ 하위 탭·초기화 ═════════════════════════════
  function sub(name, keepDetail) {
    var subs = document.querySelectorAll('.foi-sub');
    for (var i = 0; i < subs.length; i++) subs[i].classList.remove('active');
    var btns = document.querySelectorAll('.foi-subnav button');
    for (var j = 0; j < btns.length; j++) btns[j].classList.remove('active');
    $('foi-sub-' + name).classList.add('active');
    $('foi-subnav-' + name).classList.add('active');
    if (name === 'list' && !keepDetail) { if (!S.loaded) loadCampaigns(); else renderList(); }
  }

  function init() {
    if (S.inited) return;
    S.inited = true;
    S.profile = loadProfile();
    $('foi-agency-list').innerHTML = AGENCY_SUGGEST.map(function (a) { return '<option value="' + esc(a) + '"></option>'; }).join('');
    $('foi-preset').innerHTML = Object.keys(PRESETS).map(function (k) { return '<option value="' + k + '">' + esc(PRESETS[k].label) + '</option>'; }).join('');
    resetForm();
    $('foi-form').addEventListener('input', refresh);
    $('foi-form').addEventListener('change', refresh);
    $('foi-preset').addEventListener('change', applyPreset);
    $('foi-add-item').addEventListener('click', function () { addItemRow({ title: '', scope: '' }); refresh(); });
    var ai = $('foi-ai-input');
    ai.addEventListener('input', function () { autosize(ai); aiUpdateSend(); });
    ai.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); aiSend(); } });
    var body = $('foi-d-body');
    body.addEventListener('input', onDetailInput);
    body.addEventListener('change', onDetailChange);
    aiUpdateSend();
    checkLegacy();
    if (loggedIn()) loadCampaigns();
  }

  window._foi = {
    init: init, sub: sub, copy: copyText, download: downloadText, toMail: sendToMail, portal: openPortal,
    save: saveToCampaign, reset: resetForm,
    aiSend: aiSend, aiReset: aiReset,
    setFilter: setFilter, openCampaign: openCampaign, closeDetail: closeDetail, reuse: reuse, roundOpen: roundOpen,
    detailSave: detailSave, detailFollowUp: detailFollowUp, followUpStart: followUpStart,
    detailClose: detailClose, detailShare: detailShare, detailReopen: detailReopen, detailDelete: detailDelete,
    panelConfirm: panelConfirm, panelCancel: function () { S.panel = null; renderPanel(); },
    archiveSearch: archiveSearch, archiveOpen: archiveOpen, archiveCloseDetail: archiveCloseDetail, archiveAdopt: archiveAdopt,
    importLegacy: importLegacy,
    _state: S   // 테스트용
  };
  // 파일 구조상 desktop.html이 참조하는 전역 진입점
  window._foiInit = init;

  // desktop.html#foi 딥링크로 열렸다면 인라인 스크립트가 이 파일보다 먼저 탭을 켰으므로
  // (그때는 _foiInit이 아직 없었다) 여기서 직접 초기화한다.
  var _panel = document.getElementById('tab-foi');
  if (_panel && _panel.classList.contains('active')) init();
})();
