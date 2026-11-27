/* ═════════════════════════════════════════════════
   hub.js — 과제 페이지의 공통 틀(2026-11-28)
   - 대상은 탭 셋(과제·메일·서류), 만드는 동작은 "＋ 새로 만들기" 하나, 상태·역할·유형은 거르기, 주소록·양식함은 머리글 단추, 설정은 ⋮.
   - 여기서 그리는 것: 머리글과 탭, "← 과제" 줄, 새 과제 대화창, 과제 지정 대화창, 서류 탭 목록.
   - 의존(desktop.html 의 HubHost 로 주입). 과제 목록은 task-home.js, 연결 기록은 task-links.js.
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var TABS = [['tasks', '과제'], ['mail', '메일'], ['docs', '서류']];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function host() { return root.HubHost; }
  function T(s) { var H = host(); return H && H.t ? H.t(s) : s; }
  function doc() { return root.document; }
  function $(id) { return doc().getElementById(id); }
  var query = { tasks: '', mail: '', docs: '' };

  // ── 머리글과 탭 ───────────────────────────────
  function headerHtml(active) {
    var ph = { tasks: '과제 검색', mail: '메일 검색', docs: '서류 검색' }[active];
    return '<div class="hub-head"><h1>' + esc(T('과제')) + '</h1><input type="search" class="hub-q" data-hubq="' + active + '" placeholder="' + esc(T(ph)) + '" aria-label="' + esc(T(ph)) + '" value="' + esc(query[active]) + '">' +
      '<span class="hub-sp"></span><button type="button" class="btn btn-sm btn-outline" data-hub-act="contacts">' + esc(T('주소록')) + '</button><button type="button" class="btn btn-sm btn-outline" data-hub-act="forms">' + esc(T('양식함')) + '</button>' +
      '<details class="tk-more"><summary aria-label="' + esc(T('설정')) + '">⋮</summary><div><button type="button" data-hub-act="notif">' + esc(T('알림 설정')) + '</button><button type="button" data-hub-act="sim">' + esc(T('예시 데이터로 보기')) + '</button></div></details>' +
      '<details class="tk-more hub-new"><summary class="btn btn-sm btn-primary">＋ ' + esc(T('새로 만들기')) + '</summary><div><button type="button" data-hub-act="new-task">' + esc(T('새 과제')) + '</button><button type="button" data-hub-act="new-mail">' + esc(T('메일 쓰기')) + '</button><button type="button" data-hub-act="new-doc">' + esc(T('서류 작성')) + '</button><button type="button" data-hub-act="othersite">' + esc(T('다른 사이트에 입력')) + '</button></div></details></div>' +
      '<div class="cs-modes hub-tabs" role="tablist" aria-label="' + esc(T('과제')) + '">' + TABS.map(function (x) {
        return '<button type="button" role="tab" class="cs-mode' + (x[0] === active ? ' on' : '') + '" aria-selected="' + (x[0] === active) + '" data-hub-act="tab-' + x[0] + '">' + esc(T(x[1])) +
          (x[0] === 'mail' ? '<span class="unread-badge" data-for="inbox" hidden></span>' : '') + '</button>';
      }).join('') + '</div>';
  }
  function fillHeaders() {
    var list = doc().querySelectorAll('[data-hub]');
    Array.prototype.forEach.call(list, function (el) { el.innerHTML = headerHtml(el.getAttribute('data-hub')); });
    var H = host(); if (H && H.unreadBadge) H.unreadBadge();
  }
  /** "← 과제" 줄: [data-back] 안을 채운다. note 가 있으면 어느 과제에 연결되는지 알린다. */
  function fillBack(el, title, note) {
    el.innerHTML = '<button type="button" class="tk-link" data-hub-act="home">← ' + esc(T('과제')) + '</button>' + (title ? '<b>' + esc(T(title)) + '</b>' : '') +
      (note ? '<span class="hub-ctx">' + esc(note) + ' <button type="button" class="tk-link" data-hub-act="ctx-clear">' + esc(T('연결 안 함')) + '</button></span>' : '');
  }

  // ── 대화창 ───────────────────────────────────
  var modalEl = null, lastFocus = null;
  function closeModal() {
    if (!modalEl) return;
    modalEl.remove(); modalEl = null;
    try { if (lastFocus) lastFocus.focus(); } catch (e) {}
  }
  function modal(label, html) {
    closeModal();
    lastFocus = doc().activeElement;
    var ov = doc().createElement('div'); ov.className = 'hub-ov';
    ov.innerHTML = '<div class="hub-dlg" role="dialog" aria-modal="true" aria-label="' + esc(label) + '"><div class="hub-dlg-h"><h3>' + esc(label) + '</h3><button type="button" class="hub-x" aria-label="닫기">×</button></div>' + html + '</div>';
    ov.addEventListener('click', function (ev) { if (ev.target === ov || (ev.target.closest && ev.target.closest('.hub-x'))) closeModal(); });
    ov.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.stopPropagation(); closeModal(); } });
    doc().body.appendChild(ov); modalEl = ov;
    return ov;
  }

  // ── 새 과제 ───────────────────────────────────
  /** 고른 값에 따라 쓸 수 있는 단추: 상의 = 자체 진행(일반·캠페인), 바로 만들기 = 일반(업무 기능이 켜진 경우) */
  function newTaskChoices(role, type, caseOn) {
    return { consult: role === 'solo', direct: type === 'plain' && !!caseOn, roles: type === 'campaign' || !caseOn ? ['solo'] : ['solo', 'provider', 'consumer'], email: role !== 'solo' };
  }
  function openNewTask() {
    var H = host(), caseOn = H.caseOn();
    var radio = function (name, v, label, on) { return '<label class="hub-radio"><input type="radio" name="' + name + '" value="' + v + '"' + (on ? ' checked' : '') + '> ' + label + '</label>'; };
    var ov = modal('새 과제',
      '<label class="hub-f">목표<textarea id="nt-goal" rows="2" maxlength="200" placeholder="예: GPU 지원사업 응모"></textarea></label>' +
      '<fieldset class="hub-f" id="nt-roles"><legend>역할</legend>' + radio('nt-role', 'solo', '자체 진행', true) + (caseOn ? radio('nt-role', 'provider', '맡은 일') + radio('nt-role', 'consumer', '맡긴 일') : '') + '</fieldset>' +
      '<fieldset class="hub-f"><legend>유형</legend>' + radio('nt-type', 'plain', '일반', true) + radio('nt-type', 'campaign', '✉ 메일 캠페인') + '</fieldset>' +
      (caseOn ? '<label class="hub-f" id="nt-kind-row">종류<select id="nt-kind"><option value="case">사건·건</option><option value="transaction">거래</option><option value="event">행사</option></select></label>' : '') +
      '<div id="nt-peer" hidden><label class="hub-f">상대방 메일 주소 (초대권을 보낼 곳)<input id="nt-email" type="email" placeholder="client@example.com"></label><label class="hub-radio"><input type="checkbox" id="nt-send" checked> 만들면서 초대 메일을 바로 보내기 (내 K-Mail 주소로 발송, 사건 제목은 메일에 넣지 않음)</label></div>' +
      '<div class="hub-hint" id="nt-hint"></div><div class="hub-msg" id="nt-msg" role="alert"></div>' +
      '<div class="hub-dlg-f"><button type="button" class="btn btn-sm btn-outline" id="nt-consult">나비와 상의해 만들기</button><button type="button" class="btn btn-sm btn-primary" id="nt-direct">바로 만들기</button></div>');
    var val = function (n) { var e = ov.querySelector('input[name="' + n + '"]:checked'); return e ? e.value : ''; };
    function sync() {
      var type = val('nt-type'), allowed = newTaskChoices(val('nt-role'), type, caseOn).roles;
      Array.prototype.forEach.call(ov.querySelectorAll('input[name="nt-role"]'), function (r) { r.disabled = allowed.indexOf(r.value) < 0; if (r.disabled && r.checked) ov.querySelector('input[name="nt-role"][value="solo"]').checked = true; });
      var c = newTaskChoices(val('nt-role'), type, caseOn);
      $('nt-peer').hidden = !c.email; if ($('nt-kind-row')) $('nt-kind-row').hidden = !c.direct;
      $('nt-consult').disabled = !c.consult; $('nt-direct').disabled = !c.direct;
      $('nt-hint').textContent = type === 'campaign' ? '메일 캠페인은 나비와 대화하면서 대상·내용을 정하고, 발송 전에 확인받습니다.' : c.consult ? '“나비와 상의해 만들기”는 계획서를, “바로 만들기”는 기록할 빈 업무를 만듭니다.' : '상대와 함께 하는 일은 “바로 만들기”로 만든 뒤 상대를 초대합니다.';
    }
    ov.addEventListener('change', sync); sync();
    $('nt-consult').addEventListener('click', function () {
      var goal = $('nt-goal').value.trim(), type = val('nt-type'); closeModal();
      if (type === 'campaign') H.startCampaign(goal); else H.startGuide(goal);
    });
    $('nt-direct').addEventListener('click', function () {
      var btn = this, role = val('nt-role'), name = role === 'provider' ? 'caseprov' : role === 'consumer' ? 'casecons' : 'casesolo'; btn.disabled = true;
      Promise.resolve(H.createCase(name, { title: $('nt-goal').value, kind: $('nt-kind').value, email: $('nt-email').value, sendMail: $('nt-send').checked })).then(function (r) {
        if (r && r.ok) { closeModal(); H.openCase(name, r.id); return; }
        btn.disabled = false; if ($('nt-msg')) $('nt-msg').textContent = (r && r.error) || '만들지 못했습니다.';
      }).catch(function (e) { btn.disabled = false; if ($('nt-msg')) $('nt-msg').textContent = (e && e.message) || '만들지 못했습니다.'; });
    });
    $('nt-goal').focus();
  }

  // ── 과제 지정 ─────────────────────────────────
  function titleFor(link) { var H = root.TaskHome; return (H && H.titleOf(link.task)) || link.taskTitle || '연결한 과제'; }
  /** 메일·서류 한 건의 "과제" 칸: 연결돼 있으면 과제 이름, 아니면 "＋ 과제 지정" */
  function linkButton(item, kind, label, box) {
    var L = root.TaskLinks; if (!L) return '';
    var link = L.get(item);
    return '<button type="button" class="hub-link' + (link ? ' on' : '') + '" data-linkitem="' + esc(item) + '" data-kind="' + esc(kind) + '" data-label="' + esc(label || '') + '" data-box="' + esc(box || '') + '">' + esc(link ? titleFor(link) : '＋ ' + T('과제 지정')) + '</button>';
  }
  function pick(item, info) {
    var L = root.TaskLinks, H = host(), th = root.TaskHome;
    var ov = modal('과제 지정', '<div class="hub-hint">' + esc(info.label || '') + '</div><input type="search" class="hub-q" id="pk-q" placeholder="과제 검색" aria-label="과제 검색"><div id="pk-list" class="hub-picklist">불러오는 중…</div><div class="hub-hint">연결 기록은 이 기기(브라우저)에만 저장됩니다.</div>');
    function draw() {
      var el = $('pk-list'); if (!el || modalEl !== ov) return;
      var needle = $('pk-q').value.trim().toLowerCase(), cur = L.get(item);
      var rows = th.rows().filter(function (r) { return !needle || (r.title + ' ' + r.no).toLowerCase().indexOf(needle) >= 0; });
      el.innerHTML = (cur ? '<button type="button" data-pk="">연결 해제</button>' : '') + (rows.length ? rows.map(function (r) {
        return '<button type="button" data-pk="' + esc(r.key) + '"' + (cur && cur.task === r.key ? ' class="on" aria-current="true"' : '') + '><b>' + esc(r.title) + '</b><small>' + esc(r.no + ' · ' + r.stage) + '</small></button>';
      }).join('') : '<div class="hub-hint">과제가 없습니다.</div>');
    }
    ov.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-pk]'); if (!b) return;
      var key = b.getAttribute('data-pk');
      if (!key) L.remove(item);
      else if (!L.set(item, key, { kind: info.kind, label: info.label, box: info.box, taskTitle: th.titleOf(key) })) H.toast('이 브라우저에 저장하지 못했습니다. 화면을 닫으면 연결이 사라집니다.');
      closeModal(); H.linksChanged();
    });
    $('pk-q').addEventListener('input', draw); $('pk-q').focus();
    draw();
    Promise.resolve(th.sync(false)).then(draw).catch(draw);
  }

  // ── 서류 탭 ───────────────────────────────────
  var CHIPS = [['all', '전체'], ['draft', '작성 중'], ['written', '작성 완료'], ['agent', '도우미 진행'], ['sent', '제출·접수·발급'], ['failed', '마치지 못함']];
  var GROUP = { draft: 'draft', written: 'written', running: 'agent', upload: 'agent', issued: 'sent', reported: 'sent', filed: 'sent', failed: 'failed' };
  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  /** 서류 한 건에 한 줄: 작성 중(draft)·작성 완료(done) 서류에, 같은 이름의 작성·제출 이력(history)을 합친다.
      history = DocHistory.rows(...) 의 source 'history' 줄. 이름이 같은 서류가 여럿이면 가장 최근 것에 합친다. */
  function docRows(drafts, done, history) {
    function base(it, state, label) { return { id: it.id, source: 'doc', title: it.title || '(제목 없음)', site: it.site || '', agency: '', state: state, label: label, at: it.updated || 0, hasFile: !!(it.hasFile || it.extraCount), base: state, histIds: [], canMark: false }; }
    var rows = (done || []).map(function (it) { return base(it, 'written', '작성 완료'); }).concat((drafts || []).map(function (it) { return base(it, 'draft', '작성 중'); }));
    var docs = rows.slice().sort(function (a, b) { return (a.base === 'written' ? 0 : 1) - (b.base === 'written' ? 0 : 1) || b.at - a.at; }), byTitle = {};
    docs.forEach(function (r) { var k = norm(r.title); if (!byTitle[k]) byTitle[k] = r; });
    (history || []).slice().sort(function (a, b) { return b.at - a.at; }).forEach(function (h) {
      var k = norm(h.title), r = byTitle[k];
      if (!r) { r = { id: h.id, source: 'history', title: h.title || '(제목 없음)', site: '', agency: h.agency || '', state: h.state, label: h.label, at: h.at, hasFile: h.hasFile, base: '', histIds: [h.id], canMark: h.canMark, fileId: h.hasFile ? h.id : '' }; byTitle[k] = r; rows.push(r); return; }
      if (!r.histIds.length) { r.state = h.state; r.label = h.label; r.agency = h.agency || r.agency; r.canMark = h.canMark; r.at = Math.max(r.at, h.at); r.markId = h.id; }
      r.histIds.push(h.id);
      if (h.hasFile && !r.hasFile && !r.fileId) r.fileId = h.id;
    });
    rows.forEach(function (r) { if (r.source === 'history') r.markId = r.histIds[0]; });
    return rows.sort(function (a, b) { return b.at - a.at; });
  }
  /** 다음에 할 동작 하나 [act, 이름] */
  function nextAction(r) {
    if (r.base === 'draft' && (r.state === 'draft' || r.state === 'failed')) return ['resume', '이어 쓰기'];
    if (r.base === 'written' && r.hasFile && (r.state === 'written' || r.state === 'failed')) return ['submit', '기관에 올리기'];
    if (r.hasFile || r.fileId) return ['dl', '파일 받기'];
    return null;
  }
  function moreActions(r) {
    var a = [];
    if (r.base === 'draft') { a.push(['resume', '이어 쓰기']); if (r.hasFile) a.push(['done', '작성 완료']); }
    if (r.hasFile || r.fileId) a.push(['dl', '파일 받기']);
    if (r.base && r.hasFile) { a.push(['mail', '메일에 첨부']); if (r.base === 'written') a.push(['submit', '기관에 올리기(도우미)']); }
    if (r.canMark) a.push(['filed', '제출 완료로 표시']);
    a.push(['del', '삭제']);
    return a;
  }
  var docView = { chip: 'all', task: 'all', agency: 'all' }, docData = null, docSeq = 0, docBound = null;
  function filterDocs(rows, v, q, linkOf, agencyOf) {
    var needle = norm(q);
    return rows.filter(function (r) {
      var l = linkOf(r);
      return (v.chip === 'all' || GROUP[r.state] === v.chip) && (v.task === 'all' || (v.task === 'none' ? !l : l && l.task === v.task)) &&
        (v.agency === 'all' || agencyOf(r) === v.agency) && (!needle || norm(r.title + ' ' + agencyOf(r)).indexOf(needle) >= 0);
    });
  }
  function paintDocs() {
    var el = $('hub-docs'); if (!el || !docData) return;
    var H = host(), L = root.TaskLinks;
    var linkOf = function (r) { return L ? L.get('doc:' + r.id) : null; };
    var agencyOf = function (r) { return r.agency || (r.site ? H.siteLabel(r.site) : ''); };
    var rows = docData.rows, shown = filterDocs(rows, docView, query.docs, linkOf, agencyOf);
    var tasks = {}, agencies = {};
    rows.forEach(function (r) { var l = linkOf(r); if (l) tasks[l.task] = titleFor(l); if (agencyOf(r)) agencies[agencyOf(r)] = 1; });
    var sel = function (name, label, items) { return '<label class="tk-sel"><span>' + label + '</span><select data-docsel="' + name + '">' + items.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (docView[name] === x[0] ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select></label>'; };
    el.innerHTML = '<div class="tk-filters"><div role="group" aria-label="상태">' + CHIPS.map(function (c) {
      var n = c[0] === 'all' ? rows.length : rows.filter(function (r) { return GROUP[r.state] === c[0]; }).length;
      return '<button type="button" class="tk-chip' + (docView.chip === c[0] ? ' on' : '') + '" aria-pressed="' + (docView.chip === c[0]) + '" data-docchip="' + c[0] + '">' + c[1] + ' ' + n + '</button>';
    }).join('') + '</div><div class="tk-fsel">' + sel('task', '과제', [['all', '전체'], ['none', '미지정']].concat(Object.keys(tasks).map(function (k) { return [k, tasks[k]]; }))) +
      sel('agency', '기관', [['all', '전체']].concat(Object.keys(agencies).sort().map(function (k) { return [k, k]; }))) + '</div></div>' +
      (shown.length ? '<div class="hub-table"><div class="hub-tr hub-th"><span>서류</span><span>상태</span><span>과제</span><span>갱신</span><span>다음 동작</span></div>' + shown.map(function (r) {
        var nx = nextAction(r);
        return '<div class="hub-tr" data-doc="' + esc(r.id) + '"><span class="tk-name"><b>' + esc(r.title) + '</b><small>' + esc(agencyOf(r) || '') + '</small></span><span><span class="tk-tag ' + (GROUP[r.state] === 'sent' ? 'done' : GROUP[r.state] === 'failed' ? 'hold' : GROUP[r.state] === 'agent' ? 'run' : 'off') + '">' + esc(r.label) + '</span></span><span>' + linkButton('doc:' + r.id, 'doc', r.title, '') + '</span><span>' + esc(H.fmtDt(r.at)) + '</span><span class="hub-acts">' +
          (nx ? '<button type="button" class="btn btn-sm btn-outline" data-docact="' + nx[0] + '">' + nx[1] + '</button>' : '') +
          '<details class="tk-more"><summary aria-label="더보기">⋮</summary><div>' + moreActions(r).map(function (a) { return '<button type="button" data-docact="' + a[0] + '">' + a[1] + '</button>'; }).join('') + '</div></details></span></div>';
      }).join('') + '</div>' : '<div class="tk-empty">' + (rows.length ? '이 조건에 맞는 서류가 없습니다.' : '아직 작성하거나 제출한 서류가 없습니다. “＋ 새로 만들기 ▸ 서류 작성”으로 시작하세요.') + '</div>') +
      (docData.noHistory ? '<div class="tk-source">작성·제출 이력은 지금 연결된 내 기록(PDV)에서 읽을 수 없어 빠져 있습니다.</div>' : '') +
      '<div class="tk-sub">서류는 이 기기에만 보관됩니다. 같은 이름의 작성·제출 이력은 한 줄로 합쳐 보여 줍니다.</div>';
  }
  function renderDocs() {
    var el = $('hub-docs'); if (!el) return Promise.resolve();
    bindDocs(el);
    if (!docData) el.innerHTML = '<div class="loading-row"><span class="spinner"></span>불러오는 중…</div>';
    var my = ++docSeq;
    return Promise.resolve(host().loadDocs()).then(function (d) {
      if (my !== docSeq) return;
      docData = { rows: docRows(d.drafts, d.done, d.history), noHistory: !!d.noHistory }; paintDocs();
    }).catch(function () {
      if (my !== docSeq) return; docData = null;
      el.innerHTML = '<div class="tk-source bad" role="alert">내 기록(PDV) 연결을 확인하지 못해 서류를 불러오지 못했습니다. <button type="button" class="tk-link" data-docretry="1">다시 시도</button></div>';
    });
  }
  function bindDocs(el) {
    if (docBound === el) return; docBound = el;
    el.addEventListener('click', function (ev) {
      var t = ev.target;
      var chip = t.closest('[data-docchip]'); if (chip) { docView.chip = chip.getAttribute('data-docchip'); paintDocs(); return; }
      if (t.closest('[data-docretry]')) { renderDocs(); return; }
      var b = t.closest('[data-docact]'); if (!b || !docData) return;
      var id = b.closest('[data-doc]').getAttribute('data-doc'), r = docData.rows.filter(function (x) { return x.id === id; })[0];
      if (r) Promise.resolve(host().docAction(r, b.getAttribute('data-docact'))).then(function (changed) { if (changed) renderDocs(); });
    });
    el.addEventListener('change', function (ev) { var s = ev.target.closest('[data-docsel]'); if (s) { docView[s.getAttribute('data-docsel')] = s.value; paintDocs(); } });
  }

  // ── 공통 동작 ─────────────────────────────────
  function onClick(ev) {
    var t = ev.target && ev.target.closest ? ev.target : null; if (!t) return;
    Array.prototype.forEach.call(doc().querySelectorAll('details.tk-more[open]'), function (d) { if (!d.contains(t) || t.closest('details.tk-more > div button')) d.open = false; });
    var l = t.closest('[data-linkitem]');
    if (l) { ev.preventDefault(); ev.stopPropagation(); pick(l.getAttribute('data-linkitem'), { kind: l.getAttribute('data-kind'), label: l.getAttribute('data-label'), box: l.getAttribute('data-box') }); return; }
    var b = t.closest('[data-hub-act]'); if (!b || !host()) return;
    var act = b.getAttribute('data-hub-act');
    if (act === 'new-task') openNewTask(); else host().act(act);
  }
  function onInput(ev) {
    var i = ev.target && ev.target.closest && ev.target.closest('[data-hubq]'); if (!i) return;
    var tab = i.getAttribute('data-hubq'); query[tab] = i.value;
    if (tab === 'tasks') { if (root.TaskHome) root.TaskHome.search(i.value); }
    else if (tab === 'docs') paintDocs();
    else if (host()) host().searchMail(i.value);
  }
  if (root.document && root.document.addEventListener) { root.document.addEventListener('click', onClick, true); root.document.addEventListener('input', onInput); }

  var api = { fillHeaders: fillHeaders, fillBack: fillBack, openNewTask: openNewTask, pick: pick, linkButton: linkButton, renderDocs: renderDocs, modal: modal, closeModal: closeModal,
    query: function (tab) { return query[tab] || ''; },
    _pure: { docRows: docRows, nextAction: nextAction, moreActions: moreActions, filterDocs: filterDocs, newTaskChoices: newTaskChoices, headerHtml: headerHtml } };
  root.Hub = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
