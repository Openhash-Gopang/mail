/* ═════════════════════════════════════════════════
   mail-campaigns.js — 메일 탭의 "캠페인" 함(2026-11-28)
   - 캠페인(같은 목적으로 보내는 메일 묶음)은 과제가 아니라 메일이다. 과제 목록에는 넣지 않는다.
   - 기록은 로그인한 계정의 서버 기록. 로그인 전이면 부르지 않는다(로그인 창을 띄우지 않기 위해).
   - 의존(desktop.html 의 MailCampHost 로 주입): 목록·보고·대화 조회, 삭제, 대화 이어 하기, 확인창.
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var TTL = 60000;
  var STAGES = ['작성 중', '예약됨', '회신 수집', '발송 실패', '종료'];
  var TAG = { '작성 중': 'pre', '예약됨': 'run', '회신 수집': 'run', '발송 실패': 'hold', '종료': 'done' };
  var DTABS = [['info', '발송·보고'], ['log', '대화 기록']];
  function freshState() { return { state: 'idle', items: [], error: '', at: 0, extra: {} }; }
  function freshView() { return { stage: 'all', open: null, tab: 'info', select: false, sel: {} }; }
  var camp = freshState(), view = freshView(), bound = null, seq = 0;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function host() { return root.MailCampHost; }
  function box() { return root.document && root.document.getElementById('camp-root'); }
  function when(s) { var t = Date.parse(String(s || '').replace(' ', 'T')); if (isNaN(t)) return s ? String(s) : '—'; var d = new Date(t + 9 * 3600000).toISOString(); return d.slice(0, 10) + ' ' + d.slice(11, 16); }
  function titleOf(c) { return c.title || c.subject || '제목 없는 캠페인'; }
  function stageOf(c) { return c.closed_at ? '종료' : c.status === 'draft' ? '작성 중' : c.status === 'scheduled' ? '예약됨' : c.status === 'failed' ? '발송 실패' : '회신 수집'; }
  /** 발송 실패를 맨 위에, 그다음은 최근 것부터 */
  function sortItems(items) {
    var at = function (c) { return Date.parse(c.updated || c.closed_at || c.send_at || c.created_at || c.created) || 0; };
    return (items || []).slice().sort(function (a, b) { return (stageOf(b) === '발송 실패') - (stageOf(a) === '발송 실패') || at(b) - at(a); });
  }
  function filterItems(items, stage, q) {
    var needle = String(q || '').trim().toLowerCase();
    return sortItems(items).filter(function (c) { return (stage === 'all' || stageOf(c) === stage) && (!needle || (titleOf(c) + ' ' + (c.subject || '')).toLowerCase().indexOf(needle) >= 0); });
  }
  /** 캠페인 보고 내용(복사·파일로 받을 때 쓰는 글) */
  function reportText(c, digest) {
    var L = [titleOf(c) + ' — 캠페인 결과', '', '메일 제목: ' + (c.subject || '—'), '수신자: ' + (c.recipients || 0) + '명', '발송: ' + when(c.send_at), '회신 수집 마감: ' + when(c.collect_replies_until)];
    if (c.closed_at) L.push('종료: ' + when(c.closed_at));
    if (digest) L.push('', '[회신 취합 보고]', digest);
    return L.join('\n');
  }

  function load(force) {
    var H = host();
    if (!H) return Promise.resolve();
    if (!force && camp.state === 'ok' && Date.now() - camp.at < TTL) return Promise.resolve();
    var p = H.list();
    if (!p) { camp = freshState(); camp.state = 'login'; return Promise.resolve(); }
    if (camp.state !== 'ok') camp.state = 'loading';
    var my = ++seq;
    return Promise.resolve(p).then(function (items) { if (my !== seq) return; camp.state = 'ok'; camp.items = items || []; camp.error = ''; camp.at = Date.now(); })
      .catch(function (e) { if (my !== seq) return; camp.state = 'error'; camp.error = String((e && e.message) || e).slice(0, 80); });
  }
  function byId(id) { return camp.items.filter(function (c) { return String(c.id) === String(id); })[0] || null; }
  function selected() { return Object.keys(view.sel).filter(function (k) { return view.sel[k]; }); }
  function query() { var H = host(); return H && H.query ? H.query() : ''; }
  function tag(stage) { return '<span class="tk-tag ' + (TAG[stage] || 'off') + '">' + esc(stage) + '</span>'; }

  function listHtml() {
    if (camp.state === 'login') return '<div class="tk-empty">로그인하면 캠페인이 보입니다.</div>';
    if (camp.state === 'idle' || camp.state === 'loading') return '<div class="loading-row" role="status"><span class="spinner"></span>불러오는 중…</div>';
    if (camp.state === 'error') return '<div class="tk-source bad" role="alert">캠페인 목록을 불러오지 못했습니다(' + esc(camp.error) + '). <button type="button" class="tk-link" data-camp="retry">다시 시도</button></div>';
    if (!camp.items.length) return '<div class="tk-empty">캠페인이 없습니다. “＋ 새로 만들기 ▸ 메일 캠페인”으로 시작하세요.</div>';
    var shown = filterItems(camp.items, view.stage, query()), nsel = selected().length;
    var chips = [['all', '전체 ' + camp.items.length]].concat(STAGES.map(function (s) { return [s, s + ' ' + camp.items.filter(function (c) { return stageOf(c) === s; }).length]; }))
      .map(function (x) { return '<button type="button" class="tk-chip' + (view.stage === x[0] ? ' on' : '') + '" aria-pressed="' + (view.stage === x[0]) + '" data-camp="stage" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('');
    var rows = shown.map(function (c) {
      var s = stageOf(c), at = s === '예약됨' ? c.send_at : s === '회신 수집' ? c.collect_replies_until : '';
      var cells = '<span class="tk-name"><b>' + esc(titleOf(c)) + '</b><small>' + esc('수신자 ' + (c.recipients || 0) + '명' + (c.subject && c.subject !== titleOf(c) ? ' · ' + c.subject : '')) + '</small></span><span>' + tag(s) + (at ? '<small>' + esc((s === '예약됨' ? '발송 ' : '마감 ') + when(at)) + '</small>' : '') + '</span>';
      if (!view.select) return '<button type="button" class="camp-tr" data-camp="open" data-id="' + esc(c.id) + '">' + cells + '</button>';
      return '<label class="camp-tr selecting"><span><input type="checkbox" data-camp="pick" data-id="' + esc(c.id) + '"' + (view.sel[c.id] ? ' checked' : '') + ' aria-label="' + esc(titleOf(c)) + ' 선택"></span>' + cells + '</label>';
    }).join('');
    return '<div class="tk-filters"><div role="group" aria-label="캠페인 상태">' + chips + '</div><button type="button" class="tk-chip' + (view.select ? ' on' : '') + '" aria-pressed="' + view.select + '" data-camp="select">선택</button></div>' +
      (view.select ? '<div class="tk-bulk"><button type="button" class="tk-link" data-camp="pick-all">보이는 캠페인 모두 선택</button><span>' + nsel + '개 선택</span><button type="button" class="btn btn-sm btn-outline" data-camp="del-sel"' + (nsel ? '' : ' disabled') + '>선택한 캠페인 삭제</button></div>' : '') +
      (shown.length ? '<div class="tk-table">' + rows + '</div>' : '<div class="tk-empty">이 조건에 맞는 캠페인이 없습니다.</div>');
  }
  function detailHtml(c) {
    var x = camp.extra[c.id] || (camp.extra[c.id] = {}), s = stageOf(c), body = '';
    if (view.tab === 'log') {
      body = x.messages ? (x.messages.length ? '<ol class="tk-tl">' + x.messages.map(function (m) { return '<li><time>' + (m.role === 'user' ? '나' : '나비') + '</time><div>' + esc(m.content) + '</div></li>'; }).join('') + '</ol>' : '<div class="tk-empty">이 캠페인의 대화 기록이 없습니다.</div>')
        : '<div class="tk-empty">' + (x.msgError ? '대화 기록을 불러오지 못했습니다(' + esc(x.msgError) + ').' : '이 캠페인을 만들며 나눈 대화를 읽기 전용으로 봅니다.') + '</div><button type="button" class="btn btn-sm btn-outline" data-camp="log">' + (x.msgLoading ? '불러오는 중…' : '대화 기록 불러오기') + '</button>';
    } else {
      var kv = [['메일 제목', c.subject || '—'], ['수신자', (c.recipients || 0) + '명'], ['발송 시각', when(c.send_at)], ['회신 수집 마감', when(c.collect_replies_until)], ['보고 생성 시각', when(c.digest_at)],
        ['보고 상태', c.digest_status && c.digest_status !== 'none' ? (c.digest_status === 'sent' ? '보고 완료' : '보고 대기') : '보고 요청 안 함']];
      if (c.closed_at) kv.push(['종료 시각', when(c.closed_at)]);
      if (c.kplan_plan_id) kv.push(['K-Plan 연결', c.kplan_plan_id + (c.kplan_checkpoint_label ? ' (' + c.kplan_checkpoint_label + ')' : '')]);
      body = (s === '발송 실패' ? '<div class="tk-source bad">발송에 실패했습니다. 원인은 “나비와 이어 하기”에서 확인하세요.</div>' : s === '작성 중' ? '<div class="tk-source">아직 보내지 않은 캠페인입니다. “나비와 이어 하기”에서 내용과 수신자를 확정합니다.</div>' : '') +
        '<h4>발송 설정</h4><dl class="tk-kv">' + kv.map(function (k) { return '<dt>' + esc(k[0]) + '</dt><dd>' + esc(k[1]) + '</dd>'; }).join('') + '</dl><h4>회신 취합 보고</h4>' +
        (c.digest_status !== 'sent' ? '<div class="tk-empty">아직 완료된 보고가 없습니다.</div>' : x.digest ? '<pre class="tk-plan">' + esc(x.digest) + '</pre>' : '<div class="tk-empty" role="status">' + (x.digestError ? '보고를 불러오지 못했습니다(' + esc(x.digestError) + ').' : x.digestLoaded ? '받은메일함에서 보고 메일을 찾지 못했습니다.' : '보고를 불러오는 중…') + '</div>') +
        '<div class="tk-btns"><button type="button" class="btn btn-sm btn-outline" data-camp="copy">복사</button><button type="button" class="btn btn-sm btn-outline" data-camp="file">파일로 받기</button></div>' +
        '<div class="tk-sub">수신자별 발송·회신 현황과 기관별 집계는 “나비와 이어 하기”에서 물어보세요.</div>';
    }
    return '<button type="button" class="tk-link" data-camp="back">← 캠페인 목록</button><div class="tk-dhead"><div class="tk-chips">' + tag(s) + '</div><h2>' + esc(titleOf(c)) + '</h2><div class="tk-sub">' + esc('수신자 ' + (c.recipients || 0) + '명' + (c.subject ? ' · 메일 제목: ' + c.subject : '')) + '</div>' +
      '<div class="tk-btns tk-actions"><button type="button" class="btn btn-sm btn-primary" data-camp="talk">나비와 이어 하기</button><button type="button" class="btn btn-sm btn-outline" data-camp="del">캠페인 삭제</button></div></div>' +
      '<div class="cs-modes tk-dtabs" role="tablist">' + DTABS.map(function (t) { return '<button type="button" role="tab" class="cs-mode' + (t[0] === view.tab ? ' on' : '') + '" aria-selected="' + (t[0] === view.tab) + '" data-camp="tab" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div class="tk-body">' + body + '</div>';
  }
  function loadDigest(c) {
    var x = camp.extra[c.id] || (camp.extra[c.id] = {});
    if (c.digest_status !== 'sent' || x.digestLoaded || x.digestLoading || !host().digest) return;
    x.digestLoading = true;
    Promise.resolve(host().digest(c.id)).then(function (t) { x.digest = t || ''; x.digestError = ''; }).catch(function (e) { x.digestError = String((e && e.message) || e).slice(0, 80); })
      .then(function () { x.digestLoading = false; x.digestLoaded = true; paint(); });
  }
  function paint() {
    var el = box(); if (!el || !host()) return;
    var c = view.open ? byId(view.open) : null;
    if (view.open && !c && camp.state === 'ok') view.open = null;
    el.innerHTML = c ? detailHtml(c) : listHtml();
    if (c && view.tab === 'info') loadDigest(c);
  }
  function render(force) {
    var el = box(); if (!el || !host()) return Promise.resolve();
    bind(el);
    var p = load(force); paint();
    return p.then(paint);
  }
  /** 다른 곳에서 캠페인이 바뀌었을 때(만들기·발송·예약 결과): 다시 읽는다. */
  function sync() { camp.at = 0; var el = box(); return el && el.closest && el.closest('.mail-sub.active') ? render(true) : Promise.resolve(); }
  var WARN = '\n\n예약 중인 캠페인은 발송이 취소됩니다. 이미 보낸 메일은 보낸메일함에 그대로 남습니다.';
  function remove(ids, msg) {
    var H = host();
    return Promise.resolve(H.confirm(msg + WARN)).then(function (ok) {
      if (!ok) return;
      view.open = null; view.sel = {}; view.select = false;
      return Promise.resolve(H.remove(ids)).then(function (res) { if (res && res.failed) H.notify('캠페인 ' + res.failed + '건은 삭제하지 못했습니다.'); })
        .catch(function (e) { H.notify('캠페인 삭제 실패: ' + ((e && e.message) || e)); }).then(function () { return render(true); });
    });
  }
  function onClick(ev) {
    var t = ev.target.closest('[data-camp]'); if (!t) return;
    var act = t.getAttribute('data-camp'), v = t.getAttribute('data-v'), H = host(), c = view.open ? byId(view.open) : null;
    if (act === 'stage') { view.stage = v; view.sel = {}; paint(); }
    else if (act === 'open') { view.open = t.getAttribute('data-id'); view.tab = 'info'; paint(); }
    else if (act === 'back') { view.open = null; paint(); }
    else if (act === 'tab') { view.tab = v; paint(); }
    else if (act === 'retry') { camp.state = 'loading'; render(true); }
    else if (act === 'select') { view.select = !view.select; view.sel = {}; paint(); }
    else if (act === 'pick') { view.sel[t.getAttribute('data-id')] = t.checked; paint(); }
    else if (act === 'pick-all') { filterItems(camp.items, view.stage, query()).forEach(function (x) { view.sel[x.id] = true; }); paint(); }
    else if (act === 'del-sel') { var ids = selected(); if (ids.length) remove(ids, '선택한 캠페인 ' + ids.length + '개를 삭제할까요? 되돌릴 수 없습니다.'); }
    else if (act === 'del' && c) remove([c.id], '「' + titleOf(c) + '」 캠페인을 삭제할까요? 되돌릴 수 없습니다.');
    else if (act === 'talk' && c) H.talk(c);
    else if (act === 'log' && c) {
      var x = camp.extra[c.id] || (camp.extra[c.id] = {}); if (x.msgLoading) return; x.msgLoading = true; paint();
      Promise.resolve(H.messages(c.id)).then(function (list) { x.messages = list || []; x.msgError = ''; }).catch(function (e) { x.msgError = String((e && e.message) || e).slice(0, 80); }).then(function () { x.msgLoading = false; paint(); });
    }
    else if (act === 'copy' && c) H.copy(reportText(c, (camp.extra[c.id] || {}).digest));
    else if (act === 'file' && c) H.saveFile(titleOf(c) + ' 결과.txt', reportText(c, (camp.extra[c.id] || {}).digest));
  }
  function bind(el) { if (bound === el) return; bound = el; el.addEventListener('click', onClick); }

  var api = { render: render, sync: sync, refresh: paint,
    _pure: { stageOf: stageOf, filterItems: filterItems, reportText: reportText },
    _reset: function () { camp = freshState(); view = freshView(); bound = null; } };
  root.MailCamp = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
