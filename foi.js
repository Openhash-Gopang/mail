/* ══════════════════════════════════════════════════════════════
   K-Mail — "정보 공개 청구" 탭 (desktop.html 전용) — 2026-09-20 신설

   목적: 「공공기관의 정보공개에 관한 법률」에 따른 정보공개 청구는
   여러 사람이 여러 기관에 반복해서 하는 전형적 업무다. 이 탭은
   (1) 청구서를 표준 문구로 만들고, (2) 청구 이후의 진행(접수번호·
   결정기한·이의신청 기한)을 기록·계산해 준다.

   설계 원칙
   - 서버를 쓰지 않는다. 기록·청구인 정보는 이 브라우저의 localStorage
     에만 저장되고 어디로도 전송되지 않는다. 단, 사용자가 "메일 작성으로
     보내기"를 눌러 K-Mail 편지쓰기로 옮긴 뒤 직접 발송하는 경우는 예외.
     (서버 동기화가 필요하면 hondi-proxy Worker에 엔드포인트를 새로
     만들어야 한다 — 이번 범위 밖.)
   - 청구서를 정보공개시스템(open.go.kr)에 대신 제출하지 않는다.
     이 탭은 작성·복사·다운로드까지이며, 제출은 사용자가 한다.
   - 기한 계산은 참고용이다(토·일만 반영, 공휴일 미반영). 기관의 통지가
     항상 우선한다.

   법령 근거(2026-09-20 국가법령정보센터 본문 검색으로 확인)
   - 제10조 청구방법: 청구서 제출 또는 말로 청구. 청구 정보는 내용과
     범위를 확정할 수 있을 정도로 특정해야 한다(판례) → 문서명 점검.
   - 제11조: 청구를 받은 날부터 10일 이내 결정, 부득이하면 기간이 끝나는
     날의 다음 날부터 10일 범위에서 연장(연장 사실·사유 문서 통지).
   - 제18조: 비공개·부분공개 결정에 불복하거나 청구 후 20일이 지나도록
     결정이 없으면, 통지를 받은 날 또는 20일이 경과한 날부터 30일 이내에
     문서로 이의신청.
   - 제19조: 이의신청을 거치지 않고도 행정심판 청구 가능.

   이 파일은 desktop.html의 인라인 스크립트가 정의하는 전역 함수
   (escHtml, _switchTab, _mailLoadDraftIntoEditor)를 사용하므로 그
   스크립트 뒤에 로드해야 한다.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LS_KEY = 'kmail.foi.v1';
  var PORTAL_URL = 'https://www.open.go.kr';
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];

  // 상태 → 표시 라벨 / 기존 .badge-* 클래스(webapp과 동일 팔레트 재사용)
  var STATUS = {
    draft:     { label: '작성됨(미제출)', badge: 'badge-draft' },
    filed:     { label: '청구함',         badge: 'badge-scheduled' },
    extended:  { label: '기간 연장 통지', badge: 'badge-pending_review' },
    disclosed: { label: '공개 결정',      badge: 'badge-sent' },
    partial:   { label: '부분공개',       badge: 'badge-pending' },
    denied:    { label: '비공개',         badge: 'badge-failed' },
    none:      { label: '부존재',         badge: 'badge-rejected' },
    withdrawn: { label: '취하·종결',      badge: 'badge-none' }
  };
  var STATUS_ORDER = ['draft', 'filed', 'extended', 'disclosed', 'partial', 'denied', 'none', 'withdrawn'];

  // 자주 쓰는 문서 묶음. 항목은 "문서 이름으로 지목"하는 형태로 쓴다
  // (질문·새 통계 작성 요구는 부존재·보정 사유가 되기 쉽다).
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

  var S = {
    inited: false,
    data: { profile: null, records: [] },
    editingId: null,     // 작성 화면에 불러온 기록 id
    detailId: null,      // 현황 화면에서 열어 둔 기록 id
    preset: 'blank',     // 마지막으로 적용된 문서 묶음(확인 창에서 취소하면 되돌리기 위함)
    storageOk: true
  };

  // ── 공통 유틸 ────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
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
  function dLabel(n) {
    if (n > 0) return 'D-' + n;
    if (n === 0) return '오늘 마감';
    return Math.abs(n) + '일 경과';
  }

  // ── 저장소 ──────────────────────────────────────────────────
  function loadData() {
    try {
      var raw = window.localStorage.getItem(LS_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && Array.isArray(d.records)) return { profile: d.profile || null, records: d.records };
      }
    } catch (e) { S.storageOk = false; }
    return { profile: null, records: [] };
  }
  function persist() {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(S.data));
      return true;
    } catch (e) {
      S.storageOk = false;
      return false;
    }
  }
  function findRecord(id) {
    for (var i = 0; i < S.data.records.length; i++) if (S.data.records[i].id === id) return S.data.records[i];
    return null;
  }

  // ── 작성 폼: 읽기/쓰기 ──────────────────────────────────────
  function readItems() {
    var rows = document.querySelectorAll('#foi-items .foi-item');
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      out.push({
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
        nocreate: $('foi-opt-nocreate').checked,
        partial: $('foi-opt-partial').checked,
        nonexist: $('foi-opt-nonexist').checked,
        personal: $('foi-opt-personal').checked,
        cost: $('foi-opt-cost').checked
      },
      req: {
        type: $('foi-req-type').value,
        name: $('foi-req-name').value.trim(),
        rep: $('foi-req-rep').value.trim(),
        birth: $('foi-req-birth').value.trim(),
        addr: $('foi-req-addr').value.trim(),
        phone: $('foi-req-phone').value.trim(),
        email: $('foi-req-email').value.trim(),
        keep: $('foi-req-keep').checked
      },
      date: $('foi-date').value
    };
  }
  function addItemRow(item) {
    var row = document.createElement('div');
    row.className = 'foi-item';
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
    $('foi-opt-nonexist').checked = !!o.nonexist; $('foi-opt-personal').checked = !!o.personal;
    $('foi-opt-cost').checked = !!o.cost;
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
    $('foi-req-keep').checked = !!S.data.profile;
  }

  // ── 청구서 문구 생성 ─────────────────────────────────────────
  var RECV_LABEL = {
    net: '정보통신망(정보공개시스템·전자우편)으로 수령',
    post: '우편으로 수령',
    visit: '방문하여 수령',
    fax: '팩스로 수령'
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

  // ── 특정성 점검(정보공개 청구 정보는 내용·범위를 확정할 수 있을 정도로 특정해야 함) ──
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

  // ── 미리보기 갱신 ───────────────────────────────────────────
  function refresh() {
    var f = readForm();
    $('foi-preview').value = buildText(f);

    var rows = document.querySelectorAll('#foi-items .foi-item');
    var totalWarn = 0;
    for (var i = 0; i < rows.length; i++) {
      var ws = checkItem(f.items[i].title);
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
    if (miss.length) {
      box.className = 'foi-status warn';
      box.textContent = '아직 비어 있는 항목: ' + miss.join(', ');
    } else if (totalWarn) {
      box.className = 'foi-status warn';
      box.textContent = '필수 항목은 채워졌습니다. 다만 위 문서 항목의 ⚠ 안내를 확인해 보세요.';
    } else {
      box.className = 'foi-status ok';
      box.textContent = '필수 항목이 모두 채워졌습니다. 복사하거나 다운로드해서 정보공개시스템에 제출하세요.';
    }
    $('foi-org-only-rep').style.display = f.req.type === 'org' ? '' : 'none';
    $('foi-person-only-birth').style.display = f.req.type === 'org' ? 'none' : '';
  }

  // ── 액션: 복사·다운로드·메일 ────────────────────────────────
  function flash(id, msg, ok) {
    var el = $(id);
    el.textContent = msg;
    el.className = 'foi-flash ' + (ok === false ? 'err' : 'ok');
    el.style.display = '';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.display = 'none'; }, 4200);
  }
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
  function downloadText() {
    var f = readForm();
    var blob = new Blob(['\uFEFF' + $('foi-preview').value], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '정보공개청구서_' + safeName(f.agency || '기관') + '_' + ymd(new Date()).replace(/-/g, '') + '.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function sendToMail() {
    var f = readForm();
    if (typeof _mailLoadDraftIntoEditor !== 'function') { flash('foi-flash', '메일 편지쓰기를 불러오지 못했습니다.', false); return; }
    _mailLoadDraftIntoEditor({
      subject: '[정보공개 청구] ' + (f.agency || '') + (f.dept ? ' ' + f.dept : ''),
      body: $('foi-preview').value,
      draftId: null,
      sourceNote: '정보 공개 청구 탭에서 가져온 청구서입니다. 받는 사람(기관의 정보공개 담당 전자우편)을 직접 입력하세요. 기관이 전자우편 청구를 받는지는 먼저 확인해 주세요.',
      switchTo: true
    });
  }
  function openPortal() { window.open(PORTAL_URL, '_blank', 'noopener'); }

  // ── 기록 저장 ───────────────────────────────────────────────
  function saveRecord() {
    var f = readForm();
    if (!f.agency) { flash('foi-flash', '청구 기관을 입력해 주세요.', false); $('foi-agency').focus(); return; }
    var now = new Date().toISOString();
    var rec = S.editingId ? findRecord(S.editingId) : null;
    var isNew = !rec;
    if (!rec) {
      rec = { id: newId(), createdAt: now, status: 'draft', receiptNo: '', receivedAt: '', decidedAt: '', extended: false, memo: '' };
      S.data.records.unshift(rec);
      S.editingId = rec.id;
    }
    rec.updatedAt = now;
    rec.presetId = f.presetId; rec.agency = f.agency; rec.dept = f.dept; rec.purpose = f.purpose;
    rec.items = f.items.filter(function (x) { return x.title; });
    rec.pub = f.pub; rec.recv = f.recv; rec.opts = f.opts;
    // 청구인 개인정보는 기록에 넣지 않는다. "이 브라우저에 저장"을 켠 경우에만 별도 profile로 보관.
    if (f.req.keep) {
      S.data.profile = { type: f.req.type, name: f.req.name, rep: f.req.rep, birth: f.req.birth, addr: f.req.addr, phone: f.req.phone, email: f.req.email };
    } else {
      S.data.profile = null;
    }
    if (persist()) {
      flash('foi-flash', (isNew ? '기록에 저장했습니다' : '기록을 갱신했습니다') + ' — “내 청구 현황”에서 접수번호·기한을 관리하세요.');
      renderList();
    } else {
      flash('foi-flash', '이 브라우저가 저장을 허용하지 않아 기록하지 못했습니다(시크릿 모드 등). 청구서는 복사·다운로드해 두세요.', false);
    }
  }
  function resetForm(keepProfile) {
    S.editingId = null;
    writeForm({ presetId: 'blank', items: [{ title: '', scope: '' }], pub: { file: true, copy: false, view: false }, recv: 'net', opts: { nocreate: true, partial: true, nonexist: true, personal: true, cost: true } });
    $('foi-date').value = ymd(new Date());
    if (!keepProfile) writeRequester(S.data.profile);
    $('foi-editing-note').style.display = 'none';
    refresh();
  }
  function applyPreset() {
    var id = $('foi-preset').value;
    var p = PRESETS[id] || PRESETS.blank;
    var cur = readItems().filter(function (x) { return x.title; });
    if (cur.length && !window.confirm('현재 입력한 문서 목록을 이 묶음으로 바꿀까요?')) {
      $('foi-preset').value = S.preset;
      return;
    }
    S.preset = id;
    setItems(p.items.map(function (x) { return { title: x.title, scope: x.scope }; }));
    refresh();
  }

  // ── 하위 탭 ─────────────────────────────────────────────────
  function sub(name) {
    var subs = document.querySelectorAll('.foi-sub');
    for (var i = 0; i < subs.length; i++) subs[i].classList.remove('active');
    var btns = document.querySelectorAll('.foi-subnav button');
    for (var j = 0; j < btns.length; j++) btns[j].classList.remove('active');
    $('foi-sub-' + name).classList.add('active');
    $('foi-subnav-' + name).classList.add('active');
    if (name === 'list') renderList();
  }

  // ── 기한 계산 ───────────────────────────────────────────────
  // 반환: { decideBy, extendBy, day20, noRespAppealBy, appealBy }  (없으면 null)
  function calc(rec) {
    var out = { decideBy: null, extendBy: null, day20: null, noRespAppealBy: null, appealBy: null };
    var base = parseYmd(rec.receivedAt);
    if (base) {
      out.decideBy = rollWeekend(addDays(base, 10));                  // 제11조 ①
      out.extendBy = rollWeekend(addDays(out.decideBy, 10));          // 제11조 ② — 기간 끝난 다음 날부터 10일 범위
      out.day20 = addDays(base, 20);                                  // 제18조 ① — 청구 후 20일 경과일
      out.noRespAppealBy = rollWeekend(addDays(out.day20, 30));
    }
    var dec = parseYmd(rec.decidedAt);
    if (dec) out.appealBy = rollWeekend(addDays(dec, 30));            // 제18조 ① — 통지받은 날부터 30일
    return out;
  }
  // 목록에 보여줄 "다음 기한" 하나
  function nextDeadline(rec) {
    var c = calc(rec);
    if ((rec.status === 'partial' || rec.status === 'denied') && c.appealBy) return { label: '이의신청 마감', date: c.appealBy };
    if (rec.status === 'filed' && c.decideBy) return { label: '결정 기한', date: c.decideBy };
    if (rec.status === 'extended' && c.extendBy) return { label: '연장 기한(최대)', date: c.extendBy };
    return null;
  }

  // ── 내 청구 현황 ────────────────────────────────────────────
  function summaryOf(rec) {
    var first = (rec.items && rec.items[0]) ? rec.items[0].title : '(문서 없음)';
    var more = (rec.items ? rec.items.length : 0) - 1;
    return esc(first.length > 46 ? first.slice(0, 46) + '…' : first) + (more > 0 ? ' <span class="hint" style="display:inline">외 ' + more + '건</span>' : '');
  }
  function renderList() {
    var recs = S.data.records.slice();
    var empty = $('foi-list-empty'), wrap = $('foi-list-wrap');
    // 요약 카운터
    var active = 0, soon = 0, done = 0;
    for (var i = 0; i < recs.length; i++) {
      var st = recs[i].status;
      if (st === 'filed' || st === 'extended') active++;
      if (st === 'disclosed' || st === 'partial' || st === 'denied' || st === 'none' || st === 'withdrawn') done++;
      var nd = nextDeadline(recs[i]);
      if (nd && daysLeft(nd.date) <= 3) soon++;
    }
    $('foi-sum-active').textContent = active;
    $('foi-sum-soon').textContent = soon;
    $('foi-sum-done').textContent = done;
    $('foi-sum-all').textContent = recs.length;

    if (!S.storageOk) {
      $('foi-storage-warn').style.display = '';
    }
    if (!recs.length) { empty.style.display = ''; wrap.style.display = 'none'; closeDetail(); return; }
    empty.style.display = 'none'; wrap.style.display = '';

    // 기한이 있는 진행 건을 위로, 그다음 최근 수정순
    recs.sort(function (a, b) {
      var da = nextDeadline(a), db = nextDeadline(b);
      if (da && db) return da.date - db.date;
      if (da) return -1;
      if (db) return 1;
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });

    var html = '';
    for (var k = 0; k < recs.length; k++) {
      var r = recs[k], stt = STATUS[r.status] || STATUS.draft, dl = nextDeadline(r);
      var dlHtml = '—';
      if (dl) {
        var n = daysLeft(dl.date);
        dlHtml = '<div class="foi-dl' + (n < 0 ? ' over' : (n <= 3 ? ' soon' : '')) + '">' + dLabel(n) + '</div><div class="hint" style="margin:0">' + esc(dl.label) + ' ' + fmtDate(dl.date) + '</div>';
      }
      html += '<tr' + (r.id === S.detailId ? ' class="sel"' : '') + '>' +
        '<td><div class="foi-ag">' + esc(r.agency) + '</div>' + (r.dept ? '<div class="hint" style="margin:0">' + esc(r.dept) + '</div>' : '') + '</td>' +
        '<td>' + summaryOf(r) + '</td>' +
        '<td><span class="badge ' + stt.badge + '">' + esc(stt.label) + '</span></td>' +
        '<td>' + (r.receivedAt ? esc(r.receivedAt) : '—') + (r.receiptNo ? '<div class="hint" style="margin:0">접수번호 ' + esc(r.receiptNo) + '</div>' : '') + '</td>' +
        '<td>' + dlHtml + '</td>' +
        '<td class="ct-actions">' +
          '<button type="button" class="btn btn-outline btn-sm" onclick="_foi.openDetail(\'' + r.id + '\')">관리</button> ' +
          '<button type="button" class="btn btn-outline btn-sm" onclick="_foi.reuse(\'' + r.id + '\')" title="같은 문서 목록으로 다른 기관에 청구서 만들기">재사용</button>' +
        '</td></tr>';
    }
    $('foi-list-body').innerHTML = html;
    if (S.detailId) renderDetail();
  }

  function openDetail(id) {
    S.detailId = id;
    renderList();
    var el = $('foi-detail-card');
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function closeDetail() {
    S.detailId = null;
    var el = $('foi-detail-card');
    if (el) el.style.display = 'none';
    var rows = document.querySelectorAll('#foi-list-body tr.sel');
    for (var i = 0; i < rows.length; i++) rows[i].classList.remove('sel');
  }
  function renderDetail() {
    var rec = findRecord(S.detailId);
    var card = $('foi-detail-card');
    if (!rec) { card.style.display = 'none'; return; }
    card.style.display = '';
    $('foi-d-title').textContent = rec.agency + (rec.dept ? ' · ' + rec.dept : '');
    var sel = $('foi-d-status');
    if (!sel.options.length) {
      sel.innerHTML = STATUS_ORDER.map(function (k) { return '<option value="' + k + '">' + esc(STATUS[k].label) + '</option>'; }).join('');
    }
    sel.value = rec.status;
    $('foi-d-received').value = rec.receivedAt || '';
    $('foi-d-receipt').value = rec.receiptNo || '';
    $('foi-d-decided').value = rec.decidedAt || '';
    $('foi-d-memo').value = rec.memo || '';
    $('foi-d-items').innerHTML = (rec.items || []).map(function (x) {
      return '<li>' + esc(x.title) + (x.scope ? ' <span class="hint" style="display:inline">— ' + esc(x.scope) + '</span>' : '') + '</li>';
    }).join('');
    renderCalc(rec);
  }
  function renderCalc(rec) {
    var c = calc(rec), lines = [];
    if (c.decideBy) {
      lines.push('<b>결정 기한</b> (법 제11조 ①, 접수일 다음 날부터 10일): ' + fmtDate(c.decideBy) + ' · ' + dLabel(daysLeft(c.decideBy)));
      lines.push('<b>연장 시 최대</b> (법 제11조 ②, 기간 만료 다음 날부터 10일 범위): ' + fmtDate(c.extendBy) + ' — 연장하려면 기관이 연장 사실·사유를 문서로 통지해야 합니다.');
      lines.push('<b>접수 후 20일 경과일</b>: ' + fmtDate(c.day20) + ' — 이날까지 결정이 없으면 이의신청·행정심판이 가능하고, 이의신청은 ' + fmtDate(c.noRespAppealBy) + '까지 문서로 해야 합니다(법 제18조 ①).');
    } else {
      lines.push('접수일을 입력하면 결정 기한이 계산됩니다.');
    }
    if (c.appealBy) {
      lines.push('<b>이의신청 마감</b> (결정 통지일부터 30일, 법 제18조 ①): ' + fmtDate(c.appealBy) + ' · ' + dLabel(daysLeft(c.appealBy)) + ' — 비공개·부분공개 결정에 불복할 때만 해당합니다. 이의신청 없이 행정심판을 청구할 수도 있습니다(법 제19조).');
    }
    $('foi-d-calc').innerHTML = lines.map(function (l) { return '<div>' + l + '</div>'; }).join('') +
      '<div class="hint">토·일요일만 반영한 참고용 계산이며 공휴일은 반영하지 않습니다. 기관이 보낸 통지의 기한이 항상 우선합니다.</div>';
  }
  function saveDetail() {
    var rec = findRecord(S.detailId);
    if (!rec) return;
    rec.status = $('foi-d-status').value;
    rec.receivedAt = $('foi-d-received').value;
    rec.receiptNo = $('foi-d-receipt').value.trim();
    rec.decidedAt = $('foi-d-decided').value;
    rec.memo = $('foi-d-memo').value;
    rec.updatedAt = new Date().toISOString();
    if (persist()) flash('foi-d-flash', '저장했습니다.');
    else flash('foi-d-flash', '이 브라우저가 저장을 허용하지 않습니다.', false);
    renderList();
  }
  function detailInput() {
    // 저장 전에도 계산 결과를 미리 보여준다
    var tmp = {
      status: $('foi-d-status').value,
      receivedAt: $('foi-d-received').value,
      decidedAt: $('foi-d-decided').value
    };
    renderCalc(tmp);
  }
  function deleteRecord() {
    var rec = findRecord(S.detailId);
    if (!rec) return;
    if (!window.confirm('“' + rec.agency + '” 청구 기록을 삭제할까요? 이 브라우저에서만 지워지며 되돌릴 수 없습니다.')) return;
    S.data.records = S.data.records.filter(function (x) { return x.id !== rec.id; });
    if (S.editingId === rec.id) S.editingId = null;
    persist();
    closeDetail();
    renderList();
  }
  function editFromDetail() {
    var rec = findRecord(S.detailId);
    if (rec) loadIntoForm(rec, false);
  }
  function reuse(id) {
    var rec = findRecord(id);
    if (rec) loadIntoForm(rec, true);
  }
  function loadIntoForm(rec, asNew) {
    sub('new');
    S.editingId = asNew ? null : rec.id;
    writeForm({
      presetId: rec.presetId, agency: asNew ? '' : rec.agency, dept: asNew ? '' : rec.dept, purpose: rec.purpose,
      items: rec.items, pub: rec.pub, recv: rec.recv, opts: rec.opts
    });
    writeRequester(S.data.profile);
    $('foi-date').value = ymd(new Date());
    var note = $('foi-editing-note');
    note.textContent = asNew
      ? '“' + rec.agency + '” 청구서의 문서 목록·요청 사항을 복사해 왔습니다. 청구할 기관을 입력하세요 — 저장하면 새 기록이 만들어집니다.'
      : '“' + rec.agency + '” 기록을 수정하고 있습니다. 저장하면 이 기록이 갱신됩니다.';
    note.style.display = '';
    refresh();
    if (asNew) $('foi-agency').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── 내보내기·가져오기(청구인 개인정보는 포함하지 않음) ─────────
  function exportJson() {
    var payload = { app: 'kmail-foi', version: 1, exportedAt: new Date().toISOString(), records: S.data.records };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kmail-정보공개청구기록_' + ymd(new Date()).replace(/-/g, '') + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function importJson(ev) {
    var file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var d = JSON.parse(reader.result);
        if (!d || d.app !== 'kmail-foi' || !Array.isArray(d.records)) throw new Error('형식 불일치');
        var added = 0, updated = 0;
        d.records.forEach(function (r) {
          if (!r || !r.id || !r.agency) return;
          var cur = findRecord(r.id);
          if (!cur) { S.data.records.push(r); added++; }
          else if (String(r.updatedAt || '') > String(cur.updatedAt || '')) { S.data.records[S.data.records.indexOf(cur)] = r; updated++; }
        });
        persist();
        renderList();
        flash('foi-list-flash', '가져오기 완료 — 추가 ' + added + '건, 갱신 ' + updated + '건');
      } catch (e) {
        flash('foi-list-flash', '이 파일은 K-Mail 정보공개 기록 형식이 아닙니다.', false);
      }
    };
    reader.readAsText(file);
  }

  // ── 초기화(탭 첫 진입 시 1회) ───────────────────────────────
  function init() {
    if (S.inited) return;
    S.inited = true;
    S.data = loadData();

    // 기관 제안 목록, 묶음 선택지
    $('foi-agency-list').innerHTML = AGENCY_SUGGEST.map(function (a) { return '<option value="' + esc(a) + '"></option>'; }).join('');
    $('foi-preset').innerHTML = Object.keys(PRESETS).map(function (k) { return '<option value="' + k + '">' + esc(PRESETS[k].label) + '</option>'; }).join('');

    resetForm(false);
    $('foi-form').addEventListener('input', refresh);
    $('foi-form').addEventListener('change', refresh);
    $('foi-preset').addEventListener('change', applyPreset);
    $('foi-add-item').addEventListener('click', function () { addItemRow({ title: '', scope: '' }); refresh(); });
    $('foi-d-form').addEventListener('input', detailInput);
    $('foi-d-form').addEventListener('change', detailInput);
    renderList();
  }

  window._foi = {
    init: init, sub: sub, copy: copyText, download: downloadText, toMail: sendToMail, portal: openPortal,
    save: saveRecord, reset: function () { resetForm(false); }, openDetail: openDetail, closeDetail: closeDetail,
    saveDetail: saveDetail, deleteRecord: deleteRecord, editFromDetail: editFromDetail, reuse: reuse,
    exportJson: exportJson, importJson: importJson
  };
  // 파일 구조상 desktop.html이 참조하는 전역 진입점
  window._foiInit = init;

  // desktop.html#foi 딥링크로 열렸다면 인라인 스크립트가 이 파일보다 먼저 탭을 켰으므로
  // (그때는 _foiInit이 아직 없었다) 여기서 직접 초기화한다.
  var _panel = document.getElementById('tab-foi');
  if (_panel && _panel.classList.contains('active')) init();
})();
