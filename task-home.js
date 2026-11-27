/* ═════════════════════════════════════════════════
   task-home.js — 과제(2026-11-27): 서류·메일·나비 길잡이를 하나로 합친 첫 화면과 과제별 화면
   - 보여 주는 것은 이 기기에 실제로 저장된 것뿐이다: 길잡이 계획서(자체 진행)와 업무(Case: 맡은 일·맡긴 일·자체 진행).
   - 새 저장소를 만들지 않는다. 기존 기록을 읽어 한 목록으로 모은다.
   - 아직 없는 것(화면에도 그렇게 적는다): 서류·메일을 과제에 연결, 회신 자동 분류, AI 비서의 제출 대행 기록.
   - 의존(desktop.html 의 TaskHomeHost 로 주입): 길잡이 계획서 읽기·저장·열기, 알림 계산, 확인창.
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var ROLE = { solo: '자체 진행', provider: '맡은 일', consumer: '맡긴 일' };
  var STAGES = ['진행 중', '개시 전', '완료', '보류'];
  var CASE_STAGE = { proposed: '개시 전', agreed: '개시 전', active: '진행 중', closing: '진행 중', on_hold: '보류', closed: '완료', archived: '완료', declined: '성립 안 됨', expired: '성립 안 됨' };
  var CASE_NOTE = { proposed: '합의 확인이 필요합니다', agreed: '진행 시작 전입니다', closing: '종료 협의 중입니다' };
  var view = { role: 'all', stage: 'all', open: null, tab: 'log' };
  var cases = [], bound = false, seq = 0;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function host() { return root.TaskHomeHost; }
  function field(text, k) { var m = new RegExp('^\\s*(?:[-*]\\s*)?' + k + '\\s*[:：]\\s*(.*)$', 'm').exec(String(text || '')); return m ? m[1].trim() : ''; }
  function dateIn(s) { return (/(\d{4}-\d{2}-\d{2})/.exec(String(s || '')) || [])[1] || ''; }
  /** 한국 시각의 날짜(YYYY-MM-DD) */
  function kstDay(iso) { var t = Date.parse(iso); return isNaN(t) ? '' : new Date(t + 9 * 3600000).toISOString().slice(0, 10); }
  function dday(d, today) {
    var n = Math.round((Date.parse(d) - Date.parse(today)) / 864e5);
    if (!d || isNaN(n)) return { text: '', cls: '' };
    return { text: n < 0 ? 'D+' + (-n) + ' 지남' : n === 0 ? '오늘' : 'D-' + n, cls: n < 0 ? 'late' : n <= 3 ? 'soon' : '' };
  }
  /** 식별 코드: 과제의 고유 id 에서 계산하므로 같은 과제는 어느 기기에서나 같은 코드다. T + 만든 해(두 자리) + 5자. */
  function taskNo(id, createdMs) {
    var h = 2166136261, s = String(id), i;
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    var A = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ', out = '';
    for (i = 0; i < 5; i++) { out += A.charAt(h & 31); h = h >>> 5; }
    var y = createdMs ? new Date(createdMs + 9 * 3600000).getUTCFullYear() : NaN;
    return 'T' + (y >= 2000 ? String(y).slice(2) : '00') + '-' + out;
  }
  /** 계획서의 할 일: [{done, name, due, line}] (line = 원문 줄 번호) */
  function todosOf(text) {
    var out = [];
    String(text || '').replace(/\r/g, '').split('\n').forEach(function (l, i) {
      var m = /^\s*[-*]\s*\[( |x|X)\]\s*(.*)$/.exec(l); if (!m) return;
      var parts = m[2].split('|');
      out.push({ done: m[1] !== ' ', name: parts[0].trim(), due: dateIn(parts.slice(1).join('|')), line: i });
    });
    return out;
  }
  /** "## 기록" 아래의 줄: [{date, text}] — 최근 것이 먼저 */
  function logsOf(text) {
    var on = false, out = [];
    String(text || '').replace(/\r/g, '').split('\n').forEach(function (l) {
      var h = /^\s*##\s*(.*)$/.exec(l); if (h) { on = h[1].trim() === '기록'; return; }
      if (!on) return;
      var m = /^\s*[-*]\s+(.*)$/.exec(l); if (!m || !m[1].trim()) return;
      var d = /^(\d{4}-\d{2}-\d{2})\s*[:：]?\s*(.*)$/.exec(m[1].trim());
      out.push({ date: d ? d[1] : '', text: d ? d[2] : m[1].trim(), i: out.length });
    });
    return out.sort(function (a, b) { return b.date.localeCompare(a.date) || b.i - a.i; });
  }
  /** "## 기록" 절 끝에 한 줄을 더한다(절이 없으면 만든다). 다른 줄은 건드리지 않는다. */
  function addLog(text, day, msg) {
    var lines = String(text || '').replace(/\r/g, '').split('\n'), entry = '- ' + day + ' ' + String(msg).replace(/\s*\n\s*/g, ' ').trim(), at = -1, i;
    for (i = 0; i < lines.length; i++) if (/^\s*##\s*기록\s*$/.test(lines[i])) { at = i; break; }
    if (at < 0) return String(text || '').replace(/\s+$/, '') + '\n\n## 기록\n' + entry + '\n';
    var end = at + 1; while (end < lines.length && !/^\s*##\s/.test(lines[end])) end++;
    while (end > at + 1 && !lines[end - 1].trim()) end--;
    lines.splice(end, 0, entry);
    return lines.join('\n');
  }
  function toggleTodo(text, lineNo) {
    var lines = String(text || '').replace(/\r/g, '').split('\n');
    if (lines[lineNo] != null) lines[lineNo] = lines[lineNo].replace(/^(\s*[-*]\s*)\[( |x|X)\]/, function (_, p, c) { return p + (c === ' ' ? '[x]' : '[ ]'); });
    return lines.join('\n');
  }

  function guideRow(p) {
    var t = p.text, st = field(t, '상태'), verdict = field(t, '판정');
    var stage = verdict || st === '종료' ? '완료' : st === '보류' ? '보류' : st === '준비' ? '개시 전' : '진행 중';
    var open = todosOf(t).filter(function (x) { return !x.done; });
    open.sort(function (a, b) { return (a.due || '9999').localeCompare(b.due || '9999') || a.line - b.line; });
    var created = Number((/^g(\d{12,})/.exec(p.id) || [])[1]) || 0;
    return { key: 'guide:' + p.id, id: p.id, source: 'guide', role: 'solo', title: p.title || '제목 없는 과제', no: taskNo(p.id, created), stage: stage,
      stageNote: verdict || (st && st !== stage ? st : ''), next: stage === '완료' ? '' : open[0] ? open[0].name : '', due: stage === '완료' ? '' : (open[0] && open[0].due) || dateIn(field(t, '마감')), updated: p.updated || 0, need: '' };
  }
  function caseRow(c) {
    var role = c.mode === 'solo' ? 'solo' : c.my_side === 'provider' ? 'provider' : 'consumer';
    var stage = CASE_STAGE[c.state] || '진행 중', over = stage === '완료' || stage === '성립 안 됨';
    var dl = (c.deadlines || []).slice().sort(function (a, b) { return String(a.due).localeCompare(String(b.due)); })[0];
    var created = Date.parse(c.created_at) || 0;
    return { key: 'case:' + c.case_id, id: c.case_id, source: 'case', role: role, title: c.title || '제목 없는 과제', no: taskNo(c.case_id, created), stage: stage,
      stageNote: c.state === 'archived' ? '보관' : c.state === 'closing' ? '종료 협의 중' : c.state === 'agreed' ? '합의됨' : c.state === 'proposed' ? '제안됨' : '',
      next: !over && dl ? dl.label : '', due: !over && dl ? kstDay(dl.due) : '', updated: Date.parse(c.updated_at) || created, need: CASE_NOTE[c.state] || '' };
  }
  /** 두 저장소의 기록을 한 목록으로. alerts = 길잡이 알림 [{id, sev, msg}] */
  function buildRows(plans, caseList, alerts) {
    var rows = Object.keys(plans || {}).map(function (k) { return plans[k]; }).filter(function (p) { return p && p.text; }).map(guideRow)
      .concat((caseList || []).map(caseRow));
    rows.forEach(function (r) {
      if (r.source !== 'guide') return;
      var a = (alerts || []).filter(function (x) { return x.id === r.id; })[0];
      if (a) r.need = String(a.msg).replace(/^「[\s\S]*?」\s*/, '');
    });
    var order = { '진행 중': 0, '개시 전': 1, '보류': 2, '완료': 3, '성립 안 됨': 4 };
    return rows.sort(function (a, b) { return order[a.stage] - order[b.stage] || (a.due || '9999').localeCompare(b.due || '9999') || b.updated - a.updated; });
  }
  /** "오늘 확인할 일": 길잡이 알림 + 업무의 지난·7일 안 기한 + 내 확인이 필요한 상태 */
  function todayItems(rows, alerts, today) {
    var out = (alerts || []).filter(function (a) { return a.sev >= 2; }).map(function (a) { return { key: 'guide:' + a.id, sev: a.sev, msg: a.msg }; });
    rows.forEach(function (r) {
      if (r.source !== 'case' || r.stage === '완료' || r.stage === '성립 안 됨') return;
      if (r.due) { var n = Math.round((Date.parse(r.due) - Date.parse(today)) / 864e5); if (n <= 7) out.push({ key: r.key, sev: n <= 3 ? 3 : 2, msg: '「' + r.title + '」 ' + r.next + ' 기한 ' + dday(r.due, today).text }); }
      if (r.need && r.stage === '개시 전') out.push({ key: r.key, sev: 2, msg: '「' + r.title + '」 ' + r.need });
    });
    return out.sort(function (a, b) { return b.sev - a.sev; });
  }
  function filterRows(rows, role, stage) {
    return rows.filter(function (r) { return (role === 'all' || r.role === role) && (stage === 'all' || r.stage === stage); });
  }

  // ── 화면 ───────────────────────────────────────────────
  function box() { return root.document && root.document.getElementById('task-root'); }
  function caseOn() { return !!(root.CaseUI && root.CaseUI.enabled()); }
  function loadCases() {
    if (!caseOn()) return Promise.resolve([]);
    var H = root.CaseHost;
    return (H ? H.initLocal().catch(function () {}) : Promise.resolve()).then(function () { return root.CaseUI._store().listCases(); });
  }
  function rowsNow() { return buildRows(host().plans(), cases, host().alerts()); }
  function chips(name, items, cur) {
    return items.map(function (x) { return '<button type="button" class="tk-chip' + (x[0] === cur ? ' on' : '') + '" aria-pressed="' + (x[0] === cur) + '" data-act="' + name + '" data-v="' + esc(x[0]) + '">' + esc(x[1]) + '</button>'; }).join('');
  }
  function tag(stage) { var c = { '진행 중': 'run', '개시 전': 'pre', '완료': 'done', '보류': 'hold' }[stage] || 'off'; return '<span class="tk-tag ' + c + '">' + esc(stage) + '</span>'; }
  function listHtml() {
    var today = host().today(), rows = rowsNow(), items = todayItems(rows, host().alerts(), today), shown = filterRows(rows, view.role, view.stage);
    var n = function (st) { return rows.filter(function (r) { return r.stage === st; }).length; };
    var cards = items.slice(0, 6).map(function (a) {
      return '<button type="button" class="tk-card' + (a.sev >= 3 ? ' s3' : '') + '" data-act="open" data-key="' + esc(a.key) + '">' + esc(a.msg) + '</button>';
    }).join('');
    return '<div class="tk-head"><div><h2>내 과제</h2><div class="tk-sub">서류·메일·길잡이를 과제 단위로 모아 봅니다.</div></div><div class="tk-btns">' +
        '<button type="button" class="btn btn-sm btn-outline" data-act="doc">서류 작성</button><button type="button" class="btn btn-sm btn-primary" data-act="new" aria-expanded="false">＋ 새 과제</button></div></div>' +
      '<div class="tk-new" id="tk-new" hidden><button type="button" data-act="new-guide"><b>나비 길잡이와 상의해 만들기</b><span>대화하면서 목적·할 일·기한을 정합니다</span></button>' +
        (caseOn() ? '<button type="button" data-act="new-case" data-v="casesolo"><b>직접 만들기 — 자체 진행</b><span>상대 없이 내가 처리하는 일</span></button>' +
          '<button type="button" data-act="new-case" data-v="caseprov"><b>맡은 일</b><span>내가 제공자로 맡는 일 (상대 초대)</span></button>' +
          '<button type="button" data-act="new-case" data-v="casecons"><b>맡긴 일</b><span>전문가에게 맡기는 일 (상대 초대)</span></button>' : '') + '</div>' +
      '<section class="tk-sec"><h3>오늘 확인할 일 <span class="tk-count">' + items.length + '</span></h3>' +
        (cards ? '<div class="tk-cards">' + cards + '</div>' + (items.length > 6 ? '<div class="tk-sub">그 밖에 ' + (items.length - 6) + '건은 아래 목록에서 확인하세요.</div>' : '') : '<div class="tk-empty">기한이 임박하거나 지난 일이 없습니다.</div>') + '</section>' +
      '<section class="tk-sec"><div class="tk-filters"><div role="group" aria-label="역할">' + chips('role', [['all', '전체'], ['provider', '맡은 일'], ['consumer', '맡긴 일'], ['solo', '자체 진행']], view.role) + '</div>' +
        '<div role="group" aria-label="상태">' + chips('stage', [['all', '전체 ' + rows.length]].concat(STAGES.map(function (s) { return [s, s + ' ' + n(s)]; })), view.stage) + '</div></div>' +
        (shown.length ? '<div class="tk-table" role="table"><div class="tk-tr tk-th" role="row"><span>과제</span><span>역할</span><span>단계</span><span>지금 필요한 것</span><span>다음 할 일</span><span>기한</span></div>' +
          shown.map(function (r) {
            var d = dday(r.due, today);
            return '<button type="button" class="tk-tr" role="row" data-act="open" data-key="' + esc(r.key) + '"><span class="tk-name"><b>' + esc(r.title) + '</b><small>' + esc(r.no) + '</small></span><span>' + ROLE[r.role] + '</span><span>' + tag(r.stage) + (r.stageNote ? '<small>' + esc(r.stageNote) + '</small>' : '') + '</span><span class="tk-need">' + esc(r.need || '—') + '</span><span>' + esc(r.next || '—') + '</span><span class="tk-due ' + d.cls + '">' + (r.due ? esc(r.due.slice(5)) + '<small>' + esc(d.text) + '</small>' : '—') + '</span></button>';
          }).join('') + '</div>' : '<div class="tk-empty">' + (rows.length ? '이 조건에 맞는 과제가 없습니다.' : '아직 과제가 없습니다. “＋ 새 과제”로 시작하세요.') + '</div>') +
      '</section><div class="tk-foot"><button type="button" class="tk-link" data-act="old">알림 설정 · 이전 목록 화면</button><span class="tk-sub">과제 기록은 이 기기(브라우저·PDV)의 것입니다.</span></div>';
  }
  function detailHtml(p) {
    var r = rowsNow().filter(function (x) { return x.key === 'guide:' + p.id; })[0] || guideRow(p), today = host().today(), d = dday(r.due, today), body = '';
    if (view.tab === 'log') {
      var logs = logsOf(p.text);
      body = '<div class="tk-add"><input id="tk-log" maxlength="300" aria-label="기록 내용" placeholder="예: 보정서 초안을 작성함"><button type="button" class="btn btn-sm btn-primary" data-act="add-log">오늘 날짜로 기록</button></div>' +
        (logs.length ? '<ol class="tk-tl">' + logs.map(function (e) { return '<li><time>' + esc(e.date || '날짜 없음') + '</time><div>' + esc(e.text) + '</div></li>'; }).join('') + '</ol>' : '<div class="tk-empty">아직 기록이 없습니다.</div>') +
        '<div class="tk-sub">AI 비서가 한 일을 누가·언제·어디서·무엇을·왜·어떻게로 자동 기록하는 기능은 다음 단계에서 만듭니다.</div>';
    } else if (view.tab === 'files') {
      body = '<div class="tk-empty">서류와 메일을 이 과제에 연결하는 기능은 아직 없습니다. 지금은 아래에서 확인해 주세요.</div><div class="tk-btns"><button type="button" class="btn btn-sm btn-outline" data-act="all-docs">전체 서류</button><button type="button" class="btn btn-sm btn-outline" data-act="all-mail">전체 메일</button></div>';
    } else {
      var td = todosOf(p.text);
      body = (td.length ? '<ul class="tk-todos">' + td.map(function (t) { var x = dday(t.due, today); return '<li><label><input type="checkbox" data-act="todo" data-line="' + t.line + '"' + (t.done ? ' checked' : '') + '><span class="' + (t.done ? 'did' : '') + '">' + esc(t.name) + '</span></label>' + (t.due ? '<small class="tk-due ' + (t.done ? '' : x.cls) + '">' + esc(t.due) + (t.done ? '' : ' · ' + esc(x.text)) + '</small>' : '') + '</li>'; }).join('') + '</ul>' : '<div class="tk-empty">할 일이 아직 없습니다.</div>') +
        '<h4>계획서 원문</h4><pre class="tk-plan">' + esc(p.text) + '</pre>';
    }
    return '<button type="button" class="tk-link" data-act="back">← 내 과제</button>' +
      '<div class="tk-dhead"><div class="tk-chips">' + tag(r.stage) + '<span class="tk-tag off">' + ROLE[r.role] + '</span>' + (r.stageNote ? '<span class="tk-tag off">' + esc(r.stageNote) + '</span>' : '') + '</div><h2>' + esc(r.title) + '</h2><div class="tk-sub">식별 코드 ' + esc(r.no) + (field(p.text, '목적') ? ' · 목적: ' + esc(field(p.text, '목적')) : '') + '</div>' +
      '<div class="tk-boxes"><div><small>다음 행동</small><b>' + esc(r.next || (r.stage === '완료' ? '완료한 과제입니다' : '정해진 할 일이 없습니다')) + '</b>' + (r.need ? '<small class="tk-need">' + esc(r.need) + '</small>' : '') + '</div><div><small>기한</small><b class="tk-due ' + d.cls + '">' + (r.due ? esc(r.due) + ' · ' + esc(d.text) : '—') + '</b></div></div>' +
      '<div class="tk-btns"><button type="button" class="btn btn-sm btn-primary" data-act="talk">나비 길잡이와 이어 하기</button><button type="button" class="btn btn-sm btn-outline" data-act="del">과제 삭제</button></div></div>' +
      '<div class="cs-modes" role="tablist">' + [['log', '기록'], ['files', '서류·메일'], ['plan', '계획']].map(function (x) { return '<button type="button" role="tab" class="cs-mode' + (x[0] === view.tab ? ' on' : '') + '" aria-selected="' + (x[0] === view.tab) + '" data-act="tab" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="tk-body">' + body + '</div>';
  }
  function paint() {
    var el = box(); if (!el || !host()) return;
    var p = view.open ? host().plans()[view.open] : null;
    if (view.open && !p) view.open = null;
    el.innerHTML = p ? detailHtml(p) : listHtml();
  }
  /** 화면에 들어올 때. 길잡이 과제는 바로 그리고, 업무(Case)는 읽는 대로 다시 그린다. */
  function render() {
    var el = box(); if (!el || !host()) return Promise.resolve();
    bind(el); paint();
    var my = ++seq;
    return loadCases().then(function (list) { if (my !== seq) return; cases = list || []; if (!typing()) paint(); }).catch(function () {
      var e = box(); if (e && !view.open) e.insertAdjacentHTML('beforeend', '<div class="tk-empty">업무 기록을 읽지 못했습니다. 길잡이 과제만 보입니다.</div>');
    });
  }
  function typing() { var a = root.document.activeElement; return !!(a && a.id === 'tk-log' && a.value); }
  /** 다른 곳(동기화 등)에서 기록이 바뀌었을 때: 이 화면이 열려 있고 입력 중이 아니면 다시 그린다. */
  function refresh() { var el = box(); if (el && el.closest('.tab-panel.active') && !typing()) paint(); }
  /** 왼쪽 메뉴 "과제"를 누르면 항상 목록부터 */
  function home() { view.open = null; }
  function openKey(key) {
    if (key.indexOf('guide:') === 0) {
      view.open = key.slice(6); view.tab = 'log'; paint();
      if (root.NaviHist) root.NaviHist.push('tasks', view.open);
      if (root.scrollTo) root.scrollTo(0, 0);
      return;
    }
    var id = key.slice(5), c = cases.filter(function (x) { return x.case_id === id; })[0]; if (!c) return;
    root.CaseUI.openFrom(c.mode === 'solo' ? 'casesolo' : c.my_side === 'provider' ? 'caseprov' : 'casecons', id);
  }
  function save(p, text) { host().save(p.id, text); paint(); }
  function onClick(ev) {
    var t = ev.target.closest('[data-act]'); if (!t) return;
    var act = t.getAttribute('data-act'), v = t.getAttribute('data-v'), H = host(), p = view.open ? H.plans()[view.open] : null;
    if (act === 'role') { view.role = v; paint(); }
    else if (act === 'stage') { view.stage = v; paint(); }
    else if (act === 'open') openKey(t.getAttribute('data-key'));
    else if (act === 'new') { var m = root.document.getElementById('tk-new'); m.hidden = !m.hidden; t.setAttribute('aria-expanded', String(!m.hidden)); }
    else if (act === 'new-guide') H.openGuide(null);
    else if (act === 'new-case') H.newCase(v);
    else if (act === 'doc') H.go('doc');
    else if (act === 'old') H.go('gprog');
    else if (act === 'all-docs') H.go('docdone');
    else if (act === 'all-mail') H.go('inbox');
    else if (act === 'back') { view.open = null; paint(); if (root.NaviHist) root.NaviHist.push('tasks', ''); }
    else if (act === 'tab') { view.tab = v; paint(); }
    else if (act === 'talk' && p) H.openGuide(p.id);
    else if (act === 'add-log' && p) { var i = root.document.getElementById('tk-log'), msg = (i.value || '').trim(); if (msg) { i.value = ''; save(p, addLog(p.text, H.today(), msg)); } else i.focus(); }
    else if (act === 'todo' && p) save(p, toggleTodo(p.text, Number(t.getAttribute('data-line'))));
    else if (act === 'del' && p) {
      Promise.resolve(H.confirm('「' + p.title + '」 과제의 계획서와 기록을 지울까요? 되돌릴 수 없습니다.')).then(function (ok) { if (!ok) return; H.remove(p.id); view.open = null; paint(); });
    }
  }
  function bind(el) {
    if (bound === el) return; bound = el;
    if (root.NaviHist) root.NaviHist.on('tasks', 'tasks', function (sub) { view.open = sub || null; view.tab = 'log'; paint(); });
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && !ev.isComposing && ev.target.id === 'tk-log') { var b = el.querySelector('[data-act="add-log"]'); if (b) b.click(); } });
  }

  var api = { render: render, refresh: refresh, home: home,
    _pure: { taskNo: taskNo, todosOf: todosOf, logsOf: logsOf, addLog: addLog, toggleTodo: toggleTodo, buildRows: buildRows, todayItems: todayItems, filterRows: filterRows, dday: dday },
    _reset: function () { view = { role: 'all', stage: 'all', open: null, tab: 'log' }; cases = []; bound = false; } };
  root.TaskHome = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
