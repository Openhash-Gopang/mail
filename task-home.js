/* ═════════════════════════════════════════════════
   task-home.js — 과제(2026-11-28): 과제 목록과 과제 상세
   - 과제는 하나의 일(예: 특허 출원 한 건, 민사 소송 한 건) 단위다. 메일·서류·메일 캠페인은 과제가 아니므로 목록에 넣지 않는다
     (메일 캠페인은 메일 탭의 "캠페인" 함 = mail-campaigns.js). 메일·서류는 과제에 연결해서 본다.
   - 목록에 올리는 것: 길잡이 계획서(자체 진행), 업무(Case: 맡은 일·맡긴 일·자체 진행). 나비 비서의 내부 원장(case_id 'assistant')은 뺀다.
   - 새 저장소를 만들지 않는다. 계획서·업무는 이 기기의 기록이다.
   - "확인 필요"의 건수와 왼쪽 메뉴 "과제"의 숫자는 같은 계산(todayItems)을 쓴다.
   - 메일·서류 연결은 task-links.js(이 기기에만 저장). 아직 없는 것: 회신 자동 분류, AI 비서의 제출 대행 기록.
   - 의존(desktop.html 의 TaskHomeHost 로 주입): 계획서 읽기·저장·열기, 알림 계산, 확인창.
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var ROLE = { solo: '자체 진행', provider: '맡은 일', consumer: '맡긴 일' };
  var LEDGER_ID = 'assistant';   // assistant-core.js 의 원장 — 비서의 내부 기록이지 사용자의 과제가 아니다
  var STAGES = ['진행 중', '개시 전', '보류', '완료'];
  var CASE_STAGE = { proposed: '개시 전', agreed: '개시 전', active: '진행 중', closing: '진행 중', on_hold: '보류', closed: '완료', archived: '완료', declined: '성립 안 됨', expired: '성립 안 됨' };
  var CASE_NOTE = { proposed: '합의 확인이 필요합니다', agreed: '진행 시작 전입니다', closing: '종료 협의 중입니다' };
  function freshView() { return { role: 'all', stage: 'open', q: '', open: null, tab: 'todo', select: false, sel: {}, more: false }; }
  var view = freshView();
  var cases = [], findings = [], bound = false, seq = 0, histOn = null;

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
      stageNote: verdict || (st && st !== stage && st !== '진행' && st !== '준비' && st !== '종료' ? st : ''), next: stage === '완료' ? '' : open[0] ? open[0].name : '', due: stage === '완료' ? '' : (open[0] && open[0].due) || dateIn(field(t, '마감')), updated: p.updated || 0, need: '' };
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
  /** 두 곳의 기록(계획서·업무)을 한 목록으로. alerts = 길잡이 알림 [{id, sev, msg}] */
  function buildRows(plans, caseList, alerts) {
    var rows = Object.keys(plans || {}).map(function (k) { return plans[k]; }).filter(function (p) { return p && p.text; }).map(guideRow)
      .concat((caseList || []).filter(function (c) { return c && c.case_id !== LEDGER_ID; }).map(caseRow));
    rows.forEach(function (r) {
      if (r.source !== 'guide') return;
      var a = (alerts || []).filter(function (x) { return x.id === r.id; })[0];
      if (a) r.need = String(a.msg).replace(/^「[\s\S]*?」\s*/, '');
    });
    var order = { '진행 중': 0, '개시 전': 1, '보류': 2, '완료': 3, '성립 안 됨': 4 };
    return rows.sort(function (a, b) { return order[a.stage] - order[b.stage] || (a.due || '9999').localeCompare(b.due || '9999') || b.updated - a.updated; });
  }
  /** "확인 필요": 길잡이 알림 + 업무의 지난·7일 안 기한과 내 확인이 필요한 상태 + 비서의 응답·청구 알림.
      같은 업무의 기한은 한 번만 센다(비서의 기한 알림은 여기의 기한 계산과 겹치므로 뺀다). */
  function todayItems(rows, alerts, today, notes) {
    var byKey = {}; rows.forEach(function (r) { byKey[r.key] = r; });
    function item(key, sev, tagText, title, text) { return { key: key, sev: sev, tag: tagText, title: title, text: text, msg: '「' + title + '」 ' + text }; }
    var out = (alerts || []).filter(function (a) { return a.sev >= 2; }).map(function (a) {
      var r = byKey['guide:' + a.id], title = r ? r.title : (/^「([\s\S]*?)」/.exec(a.msg) || [])[1] || '';
      return { key: 'guide:' + a.id, sev: a.sev, tag: '기한', title: title, text: String(a.msg).replace(/^「[\s\S]*?」\s*/, ''), msg: a.msg };
    });
    rows.forEach(function (r) {
      if (r.stage === '완료' || r.stage === '성립 안 됨') return;
      if (r.source !== 'case') return;
      if (r.due) { var n = Math.round((Date.parse(r.due) - Date.parse(today)) / 864e5); if (n <= 7) out.push(item(r.key, n <= 3 ? 3 : 2, '기한', r.title, r.next + ' 기한 ' + dday(r.due, today).text)); }
      if (r.need && r.stage === '개시 전') out.push(item(r.key, 2, '확인', r.title, r.need));
    });
    (notes || []).forEach(function (f) {
      var r = byKey['case:' + f.case_id];
      if (!r || f.severity < 2 || f.kind === 'deadline' || r.stage === '완료' || r.stage === '성립 안 됨') return;
      if (r.need && f.sub === 'close_response') { out = out.filter(function (x) { return !(x.key === r.key && x.tag === '확인'); }); }
      out.push(item(r.key, f.severity, '비서 알림', r.title, String(f.text || '')));
    });
    return out.sort(function (a, b) { return b.sev - a.sev; });
  }
  function isOver(r) { return r.stage === '완료' || r.stage === '성립 안 됨'; }
  /** stage: 'open'(미완료) · 'all' · 단계 이름. '완료'에는 성립 안 됨도 함께 보인다. */
  function filterRows(rows, role, stage, q) {
    var needle = String(q || '').trim().toLowerCase();
    return rows.filter(function (r) {
      return (role === 'all' || r.role === role) && (stage === 'all' || (stage === 'open' ? !isOver(r) : stage === '완료' ? isOver(r) : r.stage === stage)) &&
        (!needle || (r.title + ' ' + r.no + ' ' + r.next).toLowerCase().indexOf(needle) >= 0);
    });
  }
  /** 계획서의 '상태:' 줄을 바꾼다(없으면 제목 아래에 더한다). 다른 줄은 건드리지 않는다. */
  function setStatus(text, value) {
    var lines = String(text || '').replace(/\r/g, '').split('\n');
    for (var i = 0; i < lines.length; i++) {
      var m = /^(\s*(?:[-*]\s*)?상태\s*[:：]\s*).*$/.exec(lines[i]);
      if (m) { lines[i] = m[1] + value; return lines.join('\n'); }
    }
    var at = /^\s*#/.test(lines[0] || '') ? 1 : 0;
    lines.splice(at, 0, '상태: ' + value);
    return lines.join('\n');
  }

  // ── 화면 ───────────────────────────────────────────────
  function box() { return root.document && root.document.getElementById('task-root'); }
  function caseOn() { return !!(root.CaseUI && root.CaseUI.enabled()); }
  function links() { return root.TaskLinks || null; }
  function loadCases() {
    if (!caseOn()) return Promise.resolve([]);
    var H = root.CaseHost;
    return (H ? H.initLocal().catch(function () {}) : Promise.resolve()).then(function () { return root.CaseUI._store().listCases(); });
  }
  function loadNotes() {
    var A = root.CaseAssist;
    return caseOn() && A && A.findings ? Promise.resolve(A.findings()).catch(function () { return []; }) : Promise.resolve([]);
  }
  function rowsNow() { return buildRows(host().plans(), cases, host().alerts()); }
  function itemsNow(rows) { return todayItems(rows || rowsNow(), host().alerts(), host().today(), findings); }
  function badge() { var H = host(); if (H && H.badge) H.badge(itemsNow().length); }
  function chips(name, items, cur) {
    return items.map(function (x) { return '<button type="button" class="tk-chip' + (x[0] === cur ? ' on' : '') + '" aria-pressed="' + (x[0] === cur) + '" data-act="' + name + '" data-v="' + esc(x[0]) + '">' + esc(x[1]) + '</button>'; }).join('');
  }
  function select(name, label, items, cur) {
    return '<label class="tk-sel"><span>' + esc(label) + '</span><select data-sel="' + name + '">' + items.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (x[0] === cur ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select></label>';
  }
  function tag(stage) { var c = { '진행 중': 'run', '개시 전': 'pre', '완료': 'done', '보류': 'hold' }[stage] || 'off'; return '<span class="tk-tag ' + c + '">' + esc(stage) + '</span>'; }
  function linkText(key) {
    var L = links(); if (!L) return '—';
    var c = L.counts(key), a = [];
    if (c.mail) a.push('메일 ' + c.mail);
    if (c.doc) a.push('서류 ' + c.doc);
    return a.join(' · ') || '—';
  }
  function needHtml(items) {
    var shown = view.more ? items : items.slice(0, 3);
    return '<section class="tk-sec tk-needbox" aria-label="확인 필요"><h3>확인 필요 <span class="tk-count">' + items.length + '</span></h3>' +
      (items.length ? '<ul class="tk-needs">' + shown.map(function (a) {
        return '<li class="' + (a.sev >= 3 ? 's3' : '') + '"><span class="tk-needtag">' + esc(a.tag) + '</span><span class="tk-needmsg">' + esc(a.text) + '<small>' + esc(a.title) + '</small></span><button type="button" class="btn btn-sm btn-outline" data-act="open" data-key="' + esc(a.key) + '">과제 열기</button></li>';
      }).join('') + '</ul>' + (items.length > 3 ? '<button type="button" class="tk-link" data-act="more">' + (view.more ? '접기' : '그 밖에 ' + (items.length - 3) + '건 더 보기') + '</button>' : '')
        : '<div class="tk-empty">기한이 임박하거나 지난 일이 없습니다.</div>') + '</section>';
  }
  function selectedKeys() { return Object.keys(view.sel).filter(function (k) { return view.sel[k]; }); }
  var FOOT = '<div class="tk-foot"><span class="tk-sub">과제 기록은 이 기기(브라우저·PDV)의 것입니다.</span></div>';
  function listHtml() {
    var today = host().today(), rows = rowsNow(), items = itemsNow(rows), need = items.length ? needHtml(items) : '';
    // 과제가 하나도 없으면 비워 둔다(거르기·표·확인 필요를 그리지 않는다)
    if (!rows.length) return '<div class="tk-none">진행 중인 과제가 없습니다.</div>';
    var base = filterRows(rows, view.role, 'all'), shown = filterRows(rows, view.role, view.stage, view.q);
    var n = function (st) { return filterRows(base, 'all', st).length; };
    var table = shown.length ? '<div class="tk-table' + (view.select ? ' selecting' : '') + '" role="table"><div class="tk-tr tk-th" role="row">' + (view.select ? '<span></span>' : '') + '<span>과제</span><span>상태</span><span>다음 할 일</span><span>기한</span><span>연결 자료</span></div>' +
      shown.map(function (r) {
        var d = dday(r.due, today), sub = r.no + ' · ' + ROLE[r.role];
        var cells = '<span class="tk-name"><b>' + esc(r.title) + '</b><small>' + esc(sub) + '</small></span><span>' + tag(r.stage) + (r.stageNote ? '<small>' + esc(r.stageNote) + '</small>' : '') + '</span><span' + (r.need ? ' class="tk-need"' : '') + '>' + esc(r.next || r.need || '—') + '</span><span class="tk-due ' + d.cls + '">' + (r.due ? esc(r.due.slice(5)) + '<small>' + esc(d.text) + '</small>' : '—') + '</span><span class="tk-links">' + esc(linkText(r.key)) + '</span>';
        if (!view.select) return '<button type="button" class="tk-tr" role="row" data-act="open" data-key="' + esc(r.key) + '">' + cells + '</button>';
        var can = r.source !== 'case';
        return '<label class="tk-tr" role="row"><span><input type="checkbox" data-act="pick" data-key="' + esc(r.key) + '"' + (view.sel[r.key] ? ' checked' : '') + (can ? '' : ' disabled title="상대와의 기록이 있는 업무는 지울 수 없습니다. 과제를 열어 종료·보관하세요."') + ' aria-label="' + esc(r.title) + ' 선택"></span>' + cells + '</label>';
      }).join('') + '</div>'
      : '<div class="tk-none">' + (view.stage === 'open' && !view.q && view.role === 'all' ? '진행 중인 과제가 없습니다.' : '이 조건에 맞는 과제가 없습니다.') + '</div>';
    var nsel = selectedKeys().length;
    return need +
      '<section class="tk-sec"><div class="tk-filters"><div role="group" aria-label="상태">' + chips('stage', [['open', '미완료 ' + n('open')]].concat(STAGES.map(function (s) { return [s, s + ' ' + n(s)]; })), view.stage) + '</div>' +
        '<div class="tk-fsel">' + select('role', '역할', [['all', '전체'], ['solo', '자체 진행'], ['provider', '맡은 일'], ['consumer', '맡긴 일']], view.role) +
        '<button type="button" class="tk-chip' + (view.select ? ' on' : '') + '" aria-pressed="' + view.select + '" data-act="select">선택</button></div></div>' +
        (view.select ? '<div class="tk-bulk"><button type="button" class="tk-link" data-act="pick-all">보이는 과제 모두 선택</button><span>' + nsel + '개 선택</span><button type="button" class="btn btn-sm btn-outline" data-act="del-sel"' + (nsel ? '' : ' disabled') + '>선택한 과제 삭제</button><span class="tk-sub">업무(상대와의 기록)는 지울 수 없습니다.</span></div>' : '') +
        table + '</section>' + FOOT;
  }
  function sideCard(title, inner) { return '<section class="tk-card2"><h4>' + esc(title) + '</h4>' + inner + '</section>'; }
  function tabsHtml(list) {
    return '<div class="cs-modes tk-dtabs" role="tablist">' + list.map(function (x) { return '<button type="button" role="tab" class="cs-mode' + (x[0] === view.tab ? ' on' : '') + '" aria-selected="' + (x[0] === view.tab) + '" data-act="tab" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
  }
  var DTABS = [['todo', '할 일'], ['log', '기록'], ['files', '메일·서류'], ['plan', '계획·결과']];
  /** 과제에 연결된 메일·서류 — 업무(Case) 상세(case-ui.js)도 같은 것을 쓴다. */
  function filesHtml(key) {
    var L = links(), list = L ? L.forTask(key) : [];
    return (list.length ? '<ul class="tk-files">' + list.map(function (x) {
      var isDoc = x.item.indexOf('doc:') === 0;
      return '<li><span class="tk-tag off">' + (isDoc ? '서류' : x.item.indexOf('sdraft:') === 0 ? '임시 메일' : '메일') + '</span><span class="tk-fname">' + esc(x.label || '(제목 없음)') + '</span><button type="button" class="tk-link" data-act="file-open" data-item="' + esc(x.item) + '" data-box="' + esc(x.box || '') + '">목록에서 보기</button><button type="button" class="tk-link" data-act="unlink" data-item="' + esc(x.item) + '">연결 해제</button></li>';
    }).join('') + '</ul>' : '<div class="tk-empty">이 과제에 연결한 메일·서류가 없습니다. 메일 탭·서류 탭에서 “＋ 과제 지정”을 누르거나 아래에서 새로 만드세요.</div>') +
      '<div class="tk-btns"><button type="button" class="btn btn-sm btn-outline" data-act="mail-new" data-key="' + esc(key) + '">이 과제의 메일 쓰기</button><button type="button" class="btn btn-sm btn-outline" data-act="doc-new" data-key="' + esc(key) + '">이 과제의 서류 작성</button></div>' +
      '<div class="tk-sub">연결 기록은 이 기기(브라우저)에만 저장됩니다.</div>';
  }
  function frame(r, tagsExtra, sub, actions, more, tabs, body, side) {
    return '<button type="button" class="tk-link" data-act="back">← 과제 목록</button>' +
      '<div class="tk-dhead"><div class="tk-chips">' + tag(r.stage) + '<span class="tk-tag off">' + ROLE[r.role] + '</span>' + (r.stageNote ? '<span class="tk-tag off">' + esc(r.stageNote) + '</span>' : '') + tagsExtra + '</div><h2>' + esc(r.title) + '</h2><div class="tk-sub">' + esc(sub) + '</div>' +
      '<div class="tk-btns tk-actions">' + actions + '<details class="tk-more"><summary aria-label="더보기">⋮</summary><div>' + more + '</div></details></div></div>' +
      '<div class="tk-detail"><div class="tk-main">' + tabsHtml(tabs) + '<div class="tk-body">' + body + '</div></div><aside class="tk-side">' + side + '</aside></div>';
  }
  function dueCard(r, today) { var d = dday(r.due, today); return sideCard('기한', r.due ? '<b class="tk-due ' + d.cls + '">' + esc(r.due) + ' · ' + esc(d.text) + '</b>' + (r.next ? '<small>' + esc(r.next) + '</small>' : '') : '<small>정해진 기한이 없습니다.</small>'); }
  function detailHtml(p) {
    var r = rowsNow().filter(function (x) { return x.key === 'guide:' + p.id; })[0] || guideRow(p), today = host().today(), body = '';
    if (view.tab === 'log') {
      var logs = logsOf(p.text);
      body = '<div class="tk-add"><input id="tk-log" maxlength="300" aria-label="기록 내용" placeholder="예: 보정서 초안을 작성함"><button type="button" class="btn btn-sm btn-primary" data-act="add-log">＋ 오늘 날짜로 기록</button></div>' +
        (logs.length ? '<ol class="tk-tl">' + logs.map(function (e) { return '<li><time>' + esc(e.date || '날짜 없음') + '</time><div>' + esc(e.text) + '</div></li>'; }).join('') + '</ol>' : '<div class="tk-empty">아직 기록이 없습니다.</div>');
    } else if (view.tab === 'files') body = filesHtml(r.key);
    else if (view.tab === 'plan') body = (field(p.text, '판정') ? '<div class="tk-result"><b>결과: ' + esc(field(p.text, '판정')) + '</b></div>' : '') + '<h4>계획서 원문</h4><pre class="tk-plan">' + esc(p.text) + '</pre>';
    else {
      var td = todosOf(p.text);
      body = (r.need ? '<div class="tk-source bad">' + esc(r.need) + '</div>' : '') + (td.length ? '<ul class="tk-todos">' + td.map(function (t) { var x = dday(t.due, today); return '<li><label><input type="checkbox" data-act="todo" data-line="' + t.line + '"' + (t.done ? ' checked' : '') + '><span class="' + (t.done ? 'did' : '') + '">' + esc(t.name) + '</span></label>' + (t.due ? '<small class="tk-due ' + (t.done ? '' : x.cls) + '">' + esc(t.due) + (t.done ? '' : ' · ' + esc(x.text)) + '</small>' : '') + '</li>'; }).join('') + '</ul>' : '<div class="tk-empty">할 일이 아직 없습니다. “나비와 이어 하기”에서 정할 수 있습니다.</div>');
    }
    var hold = r.stage === '보류' ? '<button type="button" class="btn btn-sm btn-outline" data-act="resume">다시 진행</button>' : isOver(r) ? '' : '<button type="button" class="btn btn-sm btn-outline" data-act="hold">보류</button>';
    return frame(r, '', '식별 코드 ' + r.no + (field(p.text, '목적') ? ' · 목적: ' + field(p.text, '목적') : ''),
      '<button type="button" class="btn btn-sm btn-primary" data-act="talk">나비와 이어 하기</button>' + hold,
      '<button type="button" data-act="del">과제 삭제</button>', DTABS, body,
      dueCard(r, today) + sideCard('과제 정보', '<dl><dt>식별 코드</dt><dd>' + esc(r.no) + '</dd><dt>유형</dt><dd>일반</dd><dt>저장 위치</dt><dd>이 기기(브라우저·PDV)</dd></dl>'));
  }
  // NaviHist 는 desktop.html 아래쪽에서 정의된다 — 주소(#tasks)로 바로 열면 첫 화면을 그릴 때는 아직 없으므로, 생긴 뒤에 한 번 등록한다.
  function hist() {
    var N = root.NaviHist; if (!N || histOn === N) return N;
    histOn = N; N.on('tasks', 'tasks', function (sub) { view.open = sub || null; view.tab = 'todo'; paint(); });
    return N;
  }
  function paint() {
    var el = box(); if (!el || !host()) return;
    hist();
    var html = null, key = view.open || '';
    if (key.indexOf('guide:') === 0) { var p = host().plans()[key.slice(6)]; if (p) html = detailHtml(p); else view.open = null; }
    el.innerHTML = html == null ? listHtml() : html;
    if (host().painted) host().painted(!!view.open);
  }
  /** 업무(Case)·비서 알림을 다시 읽고 화면과 왼쪽 메뉴 숫자를 맞춘다. */
  function sync(force) {
    if (!host()) return Promise.resolve();
    var my = ++seq, failed = false;
    function step() { if (my !== seq) return; badge(); var el = box(); if (el && el.closest && el.closest('.tab-panel.active') === null) return; if (!typing()) paint(); }
    var a = loadCases().then(function (list) { cases = list || []; }).catch(function () { failed = true; }).then(loadNotes).then(function (n) { findings = n || []; step(); });
    return a.then(function () {
      if (failed && my === seq) { var e = box(); if (e && !view.open) e.insertAdjacentHTML('beforeend', '<div class="tk-source bad" role="alert">업무 기록을 읽지 못했습니다. 목록에는 업무(맡은 일·맡긴 일)가 빠져 있습니다.</div>'); }
    });
  }
  /** 화면에 들어올 때. 계획서 과제는 바로 그리고, 업무는 읽는 대로 다시 그린다. */
  function render() {
    var el = box(); if (!el || !host()) return Promise.resolve();
    bind(el); paint();
    return sync(false);
  }
  function typing() { var a = root.document && root.document.activeElement; return !!(a && a.id === 'tk-log' && a.value); }
  /** 다른 곳(동기화 등)에서 기록이 바뀌었을 때: 이 화면이 열려 있고 입력 중이 아니면 다시 그린다. */
  function refresh() { var el = box(); badge(); if (el && el.closest('.tab-panel.active') && !typing()) paint(); }
  /** 왼쪽 메뉴 "과제"를 누르면 항상 목록부터 */
  function home() { view.open = null; view.select = false; view.sel = {}; }
  function search(q) { view.q = q || ''; if (view.open && view.q) view.open = null; paint(); }
  function rows() { return host() ? rowsNow() : []; }
  function titleOf(key) { var r = rows().filter(function (x) { return x.key === key; })[0]; return r ? r.title : ''; }
  /** 지금 상세를 열어 둔 과제(새로 만든 메일·서류를 자동으로 연결할 때 쓴다) */
  function currentKey() { var el = box(); return el && el.closest && el.closest('.tab-panel.active') && view.open ? view.open : null; }
  function openKey(key) {
    if (key.indexOf('case:') === 0) {
      var id = key.slice(5), c = cases.filter(function (x) { return x.case_id === id; })[0]; if (!c) return false;
      root.CaseUI.openFrom(c.mode === 'solo' ? 'casesolo' : c.my_side === 'provider' ? 'caseprov' : 'casecons', id);
      return true;
    }
    view.open = key; view.tab = 'todo'; view.select = false; view.sel = {}; paint();
    if (hist()) hist().push('tasks', view.open);
    if (root.scrollTo) root.scrollTo(0, 0);
    return true;
  }
  function save(p, text) { host().save(p.id, text); paint(); }
  /** 계획서 과제를 지운다. 연결한 메일·서류는 남고 연결만 사라진다. */
  function removeKeys(keys) {
    var H = host();
    keys.forEach(function (k) { if (k.indexOf('guide:') === 0) { H.remove(k.slice(6)); if (links()) links().dropTask(k); } });
    return Promise.resolve();
  }
  function onClick(ev) {
    var t = ev.target.closest('[data-act]'); if (!t) return;
    var act = t.getAttribute('data-act'), v = t.getAttribute('data-v'), H = host(), key = view.open || '';
    var p = key.indexOf('guide:') === 0 ? H.plans()[key.slice(6)] : null;
    if (act === 'stage') { view.stage = v; view.sel = {}; paint(); }
    else if (act === 'open') openKey(t.getAttribute('data-key'));
    else if (act === 'more') { view.more = !view.more; paint(); }
    else if (act === 'select') { view.select = !view.select; view.sel = {}; paint(); }
    else if (act === 'pick') { view.sel[t.getAttribute('data-key')] = t.checked; paint(); }
    else if (act === 'pick-all') { filterRows(rowsNow(), view.role, view.stage, view.q).forEach(function (r) { if (r.source !== 'case') view.sel[r.key] = true; }); paint(); }
    else if (act === 'del-sel') {
      var keys = selectedKeys(); if (!keys.length) return;
      Promise.resolve(H.confirm('선택한 과제 ' + keys.length + '개를 지울까요? 되돌릴 수 없습니다.')).then(function (ok) { if (!ok) return; view.sel = {}; view.select = false; return removeKeys(keys).then(paint); });
    }
    else if (act === 'back') { view.open = null; paint(); if (hist()) hist().push('tasks', ''); }
    else if (act === 'tab') { view.tab = v; paint(); }
    else if (act === 'talk' && p) H.openGuide(p.id);
    else if (act === 'hold' && p) save(p, setStatus(p.text, '보류'));
    else if (act === 'resume' && p) save(p, setStatus(p.text, '진행'));
    else if (act === 'add-log' && p) { var i = root.document.getElementById('tk-log'), msg = (i.value || '').trim(); if (msg) { i.value = ''; save(p, addLog(p.text, H.today(), msg)); } else i.focus(); }
    else if (act === 'todo' && p) save(p, toggleTodo(p.text, Number(t.getAttribute('data-line'))));
    else if (act === 'del' && p) {
      Promise.resolve(H.confirm('「' + p.title + '」 과제의 계획서와 기록을 지울까요? 되돌릴 수 없습니다. 연결한 메일·서류는 남습니다.')).then(function (ok) { if (!ok) return; view.open = null; return removeKeys(['guide:' + p.id]).then(paint); });
    }
    else onFileAct(t, paint);
  }
  /** "메일·서류" 탭의 단추 — 업무(Case) 상세도 함께 쓴다. 처리했으면 true */
  function onFileAct(t, repaint) {
    var act = t.getAttribute('data-act'), H = host(); if (!H) return false;
    if (act === 'unlink') { if (links()) links().remove(t.getAttribute('data-item')); repaint(); }
    else if (act === 'file-open') H.showItem(t.getAttribute('data-item'), t.getAttribute('data-box'));
    else if (act === 'mail-new') H.newMail(t.getAttribute('data-key'));
    else if (act === 'doc-new') H.newDoc(t.getAttribute('data-key'));
    else return false;
    return true;
  }
  function onChange(ev) {
    var s = ev.target.closest && ev.target.closest('select[data-sel]'); if (!s) return;
    view[s.getAttribute('data-sel')] = s.value; view.sel = {}; paint();
  }
  function bind(el) {
    if (bound === el) return; bound = el;
    el.addEventListener('click', onClick);
    el.addEventListener('change', onChange);
    el.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && !ev.isComposing && ev.target.id === 'tk-log') { var b = el.querySelector('[data-act="add-log"]'); if (b) b.click(); } });
  }

  if (root.setTimeout && root.document) root.setTimeout(hist, 0);

  var api = { render: render, refresh: refresh, sync: sync, home: home, search: search, rows: rows, titleOf: titleOf, currentKey: currentKey, open: openKey, filesHtml: filesHtml, onFileAct: onFileAct,
    _pure: { taskNo: taskNo, todosOf: todosOf, logsOf: logsOf, addLog: addLog, toggleTodo: toggleTodo, buildRows: buildRows, todayItems: todayItems, filterRows: filterRows, setStatus: setStatus, dday: dday },
    _reset: function () { view = freshView(); cases = []; findings = []; bound = false; histOn = null; } };
  root.TaskHome = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
