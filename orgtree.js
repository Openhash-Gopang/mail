/* ═════════════════════════════════════════════════
   K-Address — 소속 기관 계층(트리) UI
   2026-09-21 신설(주피터 지시: "주소록은 소속 기관 별로 분류 — 학교-대학-제주대학-
   컴퓨터공학과 같은 계층 구조"). webapp.html·desktop.html이 함께 쓰는 모듈이다
   (같은 주소록 코드를 두 페이지가 복제해 갖고 있어, 새 로직을 한 곳에 둔다).

   서버 API(hondi PR #404, 실서버 검증 34/34): /kmail/org-units{,/seed,/create,/update,
   /move,/delete,/resync}, /kmail/contacts/assign-org, GET /kmail/contacts?org_path=.

   화면
   - 주소록 요약 화면: [소속 기관 | 카테고리·태그] 전환. 소속 기관은 트리 — 노드 이름을
     누르면 그 노드와 하위 전부의 연락처 목록, 노드마다 하위 추가·이름/별칭·이동·삭제.
   - 목록 표: 체크박스로 여러 건을 골라 [소속 지정] — 기존 노드를 고르거나
     "학교>대학>제주대학교" 경로를 적으면 없는 노드는 만들어서 지정한다. 검색 결과에서도
     그대로 동작하므로 "제주대"로 검색 → 전체 선택 → 경로 지정으로 기존 연락처를 분류한다.

   서버 한도 처리
   - 서버는 요청당 연락처 쓰기를 200건으로 제한한다. 이름 변경/이동의 contacts_pending,
     삭제의 remaining이 0보다 크면 0이 될 때까지 resync/재호출을 반복한다(진행 없으면 중단).

   의존(페이지 전역): kmailApi, escHtml, _ctLoad, _ctOpenOrg. 이 파일은 DOM/네트워크를
   호출 시점에만 건드리므로 Node에서 require해 순수 함수만 테스트할 수 있다.
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var ORG_MAX_DEPTH = 12, NAME_MAX = 100, ASSIGN_BATCH = 100;
  var FORBIDDEN = /[>%\\\u0000-\u001f]/;      // 서버 validateOrgName과 같은 규칙
  var SEP = '>';

  // ── 순수 함수 ──────────────────────────────────────────────
  function cmpName(a, b) { return String(a.name).localeCompare(String(b.name), 'ko'); }

  function validateName(raw) {
    if (typeof raw !== 'string') return { ok: false, message: '이름을 입력해 주세요' };
    var name = raw.trim().replace(/\s+/g, ' ');
    if (!name) return { ok: false, message: '이름을 입력해 주세요' };
    if (name.length > NAME_MAX) return { ok: false, message: '이름은 ' + NAME_MAX + '자 이하여야 합니다' };
    if (FORBIDDEN.test(name)) return { ok: false, message: "이름에는 '>', '%', '\\' 및 제어문자를 쓸 수 없습니다" };
    if (name === '__NONE__') return { ok: false, message: "'__NONE__'는 예약어입니다" };
    return { ok: true, name: name };
  }

  function parseAliases(text) {
    var out = [];
    String(text || '').split(/[,，\n]/).forEach(function (s) {
      var v = validateName(s);
      if (v.ok && out.indexOf(v.name) < 0) out.push(v.name);
    });
    return out;
  }
  function aliasesInvalid(text) {
    var bad = null;
    String(text || '').split(/[,，\n]/).forEach(function (s) {
      if (s.trim() && !validateName(s).ok && !bad) bad = s.trim();
    });
    return bad;
  }

  /** nodes(평면) → { byId, kids(Map 부모id→정렬된 자식들), roots } */
  function buildTree(nodes) {
    var byId = new Map(), kids = new Map();
    (nodes || []).forEach(function (n) { byId.set(n.id, n); });
    (nodes || []).forEach(function (n) {
      var k = (n.parent_id && byId.has(n.parent_id)) ? n.parent_id : '';
      if (!kids.has(k)) kids.set(k, []);
      kids.get(k).push(n);
    });
    kids.forEach(function (arr) { arr.sort(cmpName); });
    return { byId: byId, kids: kids, roots: kids.get('') || [] };
  }

  /** 깊이 우선 순서의 평면 목록 [{id,name,path,depth}] — <select> 옵션용. exclude: 제외할 id 집합 */
  function flatten(tree, exclude) {
    var out = [];
    (function walk(list) {
      list.forEach(function (n) {
        if (exclude && exclude.has(n.id)) return;         // 노드와 그 하위 통째로 제외
        out.push({ id: n.id, name: n.name, path: n.path, depth: Number(n.depth) || 1 });
        walk(tree.kids.get(n.id) || []);
      });
    })(tree.roots);
    return out;
  }

  function descendantIds(tree, id) {
    var out = new Set([id]);
    (function walk(pid) {
      (tree.kids.get(pid) || []).forEach(function (c) { if (!out.has(c.id)) { out.add(c.id); walk(c.id); } });
    })(id);
    return out;
  }

  /** "학교 > 대학 > 제주대학교" → { ok, segments } (구분자는 '>'만) */
  function parsePathInput(text) {
    var segs = String(text || '').split(SEP).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!segs.length) return { ok: false, message: '경로를 입력해 주세요 (예: 학교>대학>제주대학교)' };
    if (segs.length > ORG_MAX_DEPTH) return { ok: false, message: '계층은 최대 ' + ORG_MAX_DEPTH + '단계까지입니다' };
    var out = [];
    for (var i = 0; i < segs.length; i++) {
      var v = validateName(segs[i]);
      if (!v.ok) return { ok: false, message: '"' + segs[i] + '": ' + v.message };
      out.push(v.name);
    }
    return { ok: true, segments: out };
  }

  /** 트리에서 segments를 따라 가장 깊이 존재하는 노드를 찾고, 만들어야 할 나머지를 돌려준다. */
  function planEnsurePath(tree, segments) {
    var parentId = '', existing = null, i = 0;
    for (; i < segments.length; i++) {
      var hit = (tree.kids.get(parentId) || []).find(function (n) { return n.name === segments[i]; });
      if (!hit) break;
      existing = hit; parentId = hit.id;
    }
    return { existing: existing, parentId: parentId, toCreate: segments.slice(i) };
  }

  function chunk(arr, n) {
    var out = [];
    for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  function crumbText(path) { return String(path || '').split(SEP).join(' › '); }

  // ── 상태 ─────────────────────────────────────────────────
  var S = {
    mode: 'org',              // 'org' | 'std'
    nodes: [], tree: buildTree([]),
    total: 0, unassigned: 0, dangling: 0,
    status: 'confirmed',
    expanded: new Set(), expandedInit: false,
    sel: new Set(),           // 현재 표에서 체크된 연락처 id
    busy: false, styled: false, host: null,
  };

  // ── 공용 헬퍼(페이지 전역 의존) ──────────────────────────
  function esc(s) { return root.escHtml ? root.escHtml(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(path, opts) { return root.kmailApi(path, opts); }
  function post(path, body) { return api(path, { method: 'POST', body: body || {} }); }
  function $(id) { return root.document.getElementById(id); }

  function injectStyle() {
    if (S.styled) return; S.styled = true;
    var st = root.document.createElement('style');
    st.id = 'orgtree-style';
    st.textContent = [
      '.ot-modes{display:inline-flex;border:1px solid var(--bdr);border-radius:999px;overflow:hidden;margin-bottom:12px}',
      '.ot-modes button{border:0;background:var(--sur);padding:7px 16px;font-size:13px;font-weight:700;color:var(--sub);cursor:pointer;font-family:inherit}',
      '.ot-modes button.on{background:var(--pri);color:#fff}',
      '.ot-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}',
      '.ot-summary{font-size:14px;color:var(--hint)}',
      '.ot-headbtns{display:flex;flex-wrap:wrap;gap:6px}',
      '.ot-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1A202C;color:#fff;padding:10px 16px;border-radius:10px;font-size:14px;z-index:10000;max-width:90vw;box-shadow:0 6px 20px rgba(0,0,0,.3)}',
      '.ot-toast.err{background:var(--red)} .ot-toast.ok{background:var(--grn)}',
      '.ot-tree,.ot-kids{list-style:none;margin:0;padding:0}',
      '.ot-kids{margin-left:18px;border-left:1px dashed var(--bdr);padding-left:8px}',
      '.ot-row{display:flex;align-items:center;gap:6px;padding:4px 2px;border-radius:6px;flex-wrap:wrap}',
      '.ot-row:hover{background:var(--pri-bg)}',
      '.ot-tgl{width:22px;height:22px;border:0;background:transparent;cursor:pointer;color:var(--hint);font-size:12px;padding:0}',
      '.ot-tgl.leaf{visibility:hidden}',
      '.ot-name{border:0;background:transparent;cursor:pointer;font-size:15px;font-weight:700;color:var(--txt);font-family:inherit;padding:2px 4px;text-align:left}',
      '.ot-name:hover{color:var(--pri);text-decoration:underline}',
      '.ot-acts{display:inline-flex;gap:4px;margin-left:auto}',
      '.ot-acts button{border:1px solid var(--bdr);background:var(--sur);border-radius:6px;font-size:12px;padding:2px 8px;cursor:pointer;color:var(--sub);font-family:inherit}',
      '.ot-acts button:hover{border-color:var(--pri-lt);color:var(--pri)}',
      '.ot-acts button.dg:hover{border-color:var(--red);color:var(--red)}',
      '.ot-none{margin-top:10px}',
      '.ot-empty{padding:14px;border:1px dashed var(--bdr);border-radius:8px;color:var(--sub);font-size:14px;line-height:1.7}',
      '.ot-selbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:8px 0;padding:8px 10px;background:var(--pri-bg);border:1px solid var(--pri-bd);border-radius:8px;font-size:14px}',
      '.ot-crumb{font-size:14px;color:var(--sub);margin:6px 0}',
      '.ct-orgpath{font-size:13px;color:var(--sub);white-space:nowrap}',
      '.ot-back{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px}',
      '.ot-modal{background:var(--sur);border-radius:12px;max-width:520px;width:100%;max-height:90vh;overflow:auto;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,.25)}',
      '.ot-modal h3{font-size:16px;font-weight:800;margin:0 0 12px}',
      '.ot-modal label{display:block;font-size:13px;font-weight:700;color:var(--sub);margin:10px 0 4px}',
      '.ot-modal input[type=text],.ot-modal select{width:100%;padding:9px 10px;border:1px solid var(--bdr);border-radius:8px;font-size:14px;font-family:inherit;box-sizing:border-box}',
      '.ot-modal .hint{font-size:12px;color:var(--hint);margin-top:4px;line-height:1.6}',
      '.ot-mfoot{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}',
      '.ot-radio{display:flex;gap:14px;font-size:14px;margin:6px 0}',
    ].join('\n');
    root.document.head.appendChild(st);
  }

  // ── 모드 전환 UI ─────────────────────────────────────────
  function modeSwitchHtml() {
    return '<div class="ot-modes" role="tablist" aria-label="분류 방식">' +
      '<button type="button" role="tab" data-ot-act="mode" data-mode="org" class="' + (S.mode === 'org' ? 'on' : '') + '" aria-selected="' + (S.mode === 'org') + '">소속 기관</button>' +
      '<button type="button" role="tab" data-ot-act="mode" data-mode="std" class="' + (S.mode === 'std' ? 'on' : '') + '" aria-selected="' + (S.mode === 'std') + '">카테고리·태그</button></div>';
  }

  // ── 트리 렌더 ─────────────────────────────────────────────
  function nodeHtml(n) {
    var kids = S.tree.kids.get(n.id) || [];
    var open = S.expanded.has(n.id);
    var direct = Number(n.direct) || 0, sub = Number(n.subtree) || 0;
    var tip = '직접 ' + direct + '건 · 하위 포함 ' + sub + '건';
    var alias = (n.aliases && n.aliases.length) ? ' title="별칭: ' + esc(n.aliases.join(', ')) + '"' : '';
    return '<li class="ot-item" role="treeitem"' + (kids.length ? ' aria-expanded="' + open + '"' : '') + '>' +
      '<div class="ot-row">' +
        '<button type="button" class="ot-tgl' + (kids.length ? '' : ' leaf') + '" data-ot-act="toggle" data-id="' + esc(n.id) + '" aria-label="' + (open ? '접기' : '펼치기') + '">' + (open ? '▾' : '▸') + '</button>' +
        '<button type="button" class="ot-name" data-ot-act="open" data-path="' + esc(n.path) + '"' + alias + '>' + esc(n.name) + '</button>' +
        '<span class="ct-cat-count" title="' + esc(tip) + '">' + sub + '</span>' +
        '<span class="ot-acts">' +
          '<button type="button" data-ot-act="add" data-id="' + esc(n.id) + '">＋ 하위</button>' +
          '<button type="button" data-ot-act="edit" data-id="' + esc(n.id) + '">이름·별칭</button>' +
          '<button type="button" data-ot-act="move" data-id="' + esc(n.id) + '">이동</button>' +
          '<button type="button" class="dg" data-ot-act="del" data-id="' + esc(n.id) + '">삭제</button>' +
        '</span>' +
      '</div>' +
      (kids.length && open ? '<ul class="ot-kids" role="group">' + kids.map(nodeHtml).join('') + '</ul>' : '') +
    '</li>';
  }

  function summaryHtml() {
    var assigned = Math.max(0, S.total - S.unassigned - S.dangling);
    var head =
      '<div class="ot-head">' +
        '<div class="ot-summary">전체 ' + S.total + '건 — 소속 지정 ' + assigned + '건 · 미분류 ' + S.unassigned + '건' +
          (S.dangling ? ' · <span style="color:var(--red)">끊긴 소속 ' + S.dangling + '건</span>' : '') + '</div>' +
        '<div class="ot-headbtns">' +
          '<button type="button" class="btn btn-primary btn-sm" data-ot-act="add-root">＋ 최상위 소속</button>' +
          (S.tree.roots.length ? '<button type="button" class="btn btn-outline btn-sm" data-ot-act="expand-all">모두 펼치기</button><button type="button" class="btn btn-outline btn-sm" data-ot-act="collapse-all">접기</button>' : '') +
          '<button type="button" class="btn btn-outline btn-sm" data-ot-act="resync">정합성 점검</button>' +
        '</div>' +
      '</div>';
    var body;
    if (!S.tree.roots.length) {
      body = '<div class="ot-empty">아직 소속 기관 구조가 없습니다. 아래 시드 템플릿(학교·정부·기업·연구·의료·협회·언론·금융·국제, 23개 노드)으로 시작하거나 <b>＋ 최상위 소속</b>으로 직접 만드세요. ' +
        '연락처는 목록에서 체크한 뒤 <b>소속 지정</b>에서 <code>학교&gt;대학&gt;제주대학교</code>처럼 경로를 적으면 없는 노드까지 자동으로 만들어 지정합니다.' +
        '<div style="margin-top:10px"><button type="button" class="btn btn-primary btn-sm" data-ot-act="seed">시드 템플릿으로 시작</button></div></div>';
    } else {
      body = '<ul class="ot-tree" role="tree">' + S.tree.roots.map(nodeHtml).join('') + '</ul>';
    }
    var none = '<div class="ot-none"><button type="button" class="ct-cat-item" data-ot-act="open-none"><span>미분류</span><span class="ct-cat-count">' + S.unassigned + '</span></button></div>';
    return modeSwitchHtml() + head + body + none;
  }

  /** 서버에서 노드·건수를 다시 받아 캐시(S.nodes/S.tree)를 최신화한다. 목록 화면에서 지정할 때 캐시가 낡지 않게. */
  async function refreshNodes() {
    var data = await api('/kmail/org-units', { query: { status: S.status } });
    S.nodes = data.nodes || [];
    S.tree = buildTree(S.nodes);
    S.total = data.total || 0; S.unassigned = data.unassigned || 0; S.dangling = data.dangling || 0;
  }

  async function renderSummary(el, status) {
    injectStyle();
    S.status = status || 'confirmed';
    await refreshNodes();
    // 처음 노드가 생겼을 때(시드 직후 포함) 최상위만 펼친다. 빈 트리에서는 초기화를 소진하지 않는다.
    if (!S.expandedInit && S.tree.roots.length) { S.tree.roots.forEach(function (r) { S.expanded.add(r.id); }); S.expandedInit = true; }
    S.host = el;
    el.innerHTML = summaryHtml();
  }
  function rerender() { if (S.host && S.host.isConnected) S.host.innerHTML = summaryHtml(); }

  // ── 알림(toast)/바쁨 ─────────────────────────────────────
  // 진행·결과 메시지는 _ctLoad()가 화면을 다시 그려도 지워지지 않도록 body에 고정한다.
  var _toastTimer = null;
  function toast(text, kind, sticky) {
    var el = $('ot-toast');
    if (!el) {
      el = root.document.createElement('div'); el.id = 'ot-toast';
      el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
      root.document.body.appendChild(el);
    }
    el.className = 'ot-toast' + (kind ? ' ' + kind : '');
    el.textContent = text || ''; el.style.display = text ? '' : 'none';
    clearTimeout(_toastTimer);
    if (text && !sticky) _toastTimer = setTimeout(function () { el.style.display = 'none'; }, kind === 'err' ? 9000 : 4500);
  }
  async function guarded(fn) {
    if (S.busy) return;
    S.busy = true;
    try { await fn(); }
    catch (e) { toast(e && e.message ? e.message : String(e), 'err'); }
    finally { S.busy = false; }
  }

  // ── 서버 한도 반복 처리 ──────────────────────────────────
  async function resyncAll(opts, onProgress) {
    var last = Infinity, stuck = 0, r = null;
    for (var i = 0; i < 40; i++) {
      r = await post('/kmail/org-units/resync', opts || {});
      if (onProgress) onProgress(r);
      if (!r.pending) return r;
      if (r.pending >= last) { if (++stuck >= 3) throw new Error('정합성 복구가 진행되지 않습니다(남은 ' + r.pending + '건). 잠시 후 다시 시도해 주세요.'); }
      else stuck = 0;
      last = r.pending;
    }
    throw new Error('정합성 복구를 반복했지만 끝나지 않았습니다(남은 ' + (r && r.pending) + '건).');
  }

  async function afterRewrite(res) {
    if (res && res.contacts_pending > 0) {
      toast('연락처 경로를 갱신하는 중… (남은 ' + res.contacts_pending + '건)', '', true);
      await resyncAll({}, function (p) { toast('연락처 경로를 갱신하는 중… (남은 ' + p.pending + '건)', '', true); });
      toast('연락처 경로 갱신을 마쳤습니다', 'ok');
      root._ctLoad();
    }
  }

  // ── 모달 ─────────────────────────────────────────────────
  var _escHandler = null;
  function closeModal() {
    var m = $('ot-modal'); if (m) m.remove();
    if (_escHandler) { root.document.removeEventListener('keydown', _escHandler); _escHandler = null; }
  }
  function openModal(o) {
    injectStyle(); closeModal();
    var back = root.document.createElement('div');
    back.className = 'ot-back'; back.id = 'ot-modal';
    back.innerHTML = '<div class="ot-modal" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '"><h3>' + esc(o.title) + '</h3>' +
      '<div class="ot-mbody">' + o.html + '</div><div class="errbox ot-merr" style="display:none;margin-top:10px"></div>' +
      '<div class="ot-mfoot"><button type="button" class="btn btn-outline btn-sm" data-ot-act="modal-close">취소</button>' +
      '<button type="button" class="btn btn-primary btn-sm" data-ot-act="modal-ok"' + (o.danger ? ' style="background:var(--red)"' : '') + '>' + esc(o.confirmLabel || '확인') + '</button></div></div>';
    root.document.body.appendChild(back);
    back.addEventListener('click', function (e) { if (e.target === back) closeModal(); });
    _escHandler = function (e) { if (e.key === 'Escape') closeModal(); };
    root.document.addEventListener('keydown', _escHandler);
    var ok = back.querySelector('[data-ot-act="modal-ok"]'), errEl = back.querySelector('.ot-merr');
    ok.addEventListener('click', async function () {
      errEl.style.display = 'none'; ok.disabled = true;
      try { await o.onConfirm(back); closeModal(); }
      catch (e) { errEl.textContent = (e && e.message) || String(e); errEl.style.display = ''; ok.disabled = false; }
    });
    if (o.onOpen) o.onOpen(back);
    var first = back.querySelector('input[type=text],select'); if (first) first.focus();
    return back;
  }

  function optionsHtml(exclude, includeRoot, selected, filter) {
    var f = String(filter || '').trim().toLowerCase();
    var html = includeRoot ? '<option value="">(최상위)</option>' : '';
    flatten(S.tree, exclude).forEach(function (n) {
      if (f && n.path.toLowerCase().indexOf(f) < 0) return;
      html += '<option value="' + esc(n.id) + '"' + (n.id === selected ? ' selected' : '') + ' title="' + esc(crumbText(n.path)) + '">' +
        '\u00A0\u00A0'.repeat(n.depth - 1) + (n.depth > 1 ? '└ ' : '') + esc(n.name) + '</option>';
    });
    return html;
  }

  // ── 노드 작업 모달 ───────────────────────────────────────
  function addNodeModal(parentId) {
    var parent = parentId ? S.tree.byId.get(parentId) : null;
    openModal({
      title: parent ? '“' + parent.name + '” 아래에 하위 소속 추가' : '최상위 소속 추가',
      confirmLabel: '추가',
      html: '<label for="ot-f-name">이름</label><input type="text" id="ot-f-name" maxlength="100" placeholder="예: 제주대학교">' +
        '<label for="ot-f-alias">별칭(선택, 쉼표로 구분)</label><input type="text" id="ot-f-alias" placeholder="예: 제주대, JNU">' +
        '<div class="hint">별칭은 표기 통일용입니다(같은 기관의 다른 이름). 이름에는 &gt; % \\ 를 쓸 수 없습니다.</div>',
      onConfirm: async function (m) {
        var v = validateName(m.querySelector('#ot-f-name').value); if (!v.ok) throw new Error(v.message);
        var aText = m.querySelector('#ot-f-alias').value, bad = aliasesInvalid(aText); if (bad) throw new Error('별칭 "' + bad + '"을 쓸 수 없습니다');
        var body = { name: v.name, aliases: parseAliases(aText) }; if (parentId) body.parent_id = parentId;
        await post('/kmail/org-units/create', body);
        if (parentId) S.expanded.add(parentId);
        root._ctLoad();
      },
    });
  }

  function editNodeModal(id) {
    var n = S.tree.byId.get(id); if (!n) return;
    openModal({
      title: '소속 이름·별칭 수정',
      confirmLabel: '저장',
      html: '<label for="ot-f-name">이름</label><input type="text" id="ot-f-name" maxlength="100" value="' + esc(n.name) + '">' +
        '<label for="ot-f-alias">별칭(쉼표로 구분)</label><input type="text" id="ot-f-alias" value="' + esc((n.aliases || []).join(', ')) + '">' +
        '<div class="hint">이름을 바꾸면 하위 소속과 소속 연락처의 경로가 함께 갱신됩니다.</div>',
      onConfirm: async function (m) {
        var v = validateName(m.querySelector('#ot-f-name').value); if (!v.ok) throw new Error(v.message);
        var aText = m.querySelector('#ot-f-alias').value, bad = aliasesInvalid(aText); if (bad) throw new Error('별칭 "' + bad + '"을 쓸 수 없습니다');
        var aliases = parseAliases(aText), body = { unit_id: id };
        if (v.name !== n.name) body.name = v.name;
        if (JSON.stringify(aliases) !== JSON.stringify(n.aliases || [])) body.aliases = aliases;
        if (Object.keys(body).length === 1) return;                       // 바뀐 게 없음
        var res = await post('/kmail/org-units/update', body);
        closeModal(); root._ctLoad(); await afterRewrite(res);
      },
    });
  }

  function moveNodeModal(id) {
    var n = S.tree.byId.get(id); if (!n) return;
    var exclude = descendantIds(S.tree, id);
    openModal({
      title: '“' + n.name + '” 이동',
      confirmLabel: '이동',
      html: '<label for="ot-f-parent">새 상위 소속</label><select id="ot-f-parent">' + optionsHtml(exclude, true, n.parent_id || '') + '</select>' +
        '<div class="hint">하위 소속과 소속 연락처가 함께 옮겨집니다. 같은 위치에 같은 이름이 있으면 이동할 수 없습니다.</div>',
      onConfirm: async function (m) {
        var target = m.querySelector('#ot-f-parent').value;
        if ((n.parent_id || '') === target) throw new Error('이미 그 위치에 있습니다');
        var res = await post('/kmail/org-units/move', { unit_id: id, new_parent_id: target });
        if (target) S.expanded.add(target);
        closeModal(); root._ctLoad(); await afterRewrite(res);
      },
    });
  }

  function deleteNodeModal(id) {
    var n = S.tree.byId.get(id); if (!n) return;
    var parent = n.parent_id ? S.tree.byId.get(n.parent_id) : null;
    openModal({
      title: '소속 삭제', danger: true, confirmLabel: '삭제',
      html: '<p style="font-size:14px;line-height:1.7">“<b>' + esc(n.name) + '</b>”을(를) 삭제합니다.<br>이 소속의 연락처는(상태와 무관하게 전부) ' +
        (parent ? '상위 소속 “' + esc(parent.name) + '”' : '<b>미분류</b>') + '로 옮겨집니다. 하위 소속이 있으면 삭제할 수 없습니다.</p>',
      onConfirm: async function () {
        var last = Infinity, stuck = 0, r;
        for (var i = 0; i < 50; i++) {
          r = await post('/kmail/org-units/delete', { unit_id: id });
          if (r.deleted) break;
          if (r.remaining >= last) { if (++stuck >= 3) throw new Error('삭제가 진행되지 않습니다(남은 ' + r.remaining + '건).'); } else stuck = 0;
          last = r.remaining;
        }
        if (!r || !r.deleted) throw new Error('삭제를 반복했지만 끝나지 않았습니다.');
        closeModal(); root._ctLoad();
      },
    });
  }

  // ── 소속 지정(선택한 연락처 일괄) ────────────────────────
  function assignModal(unassign) {
    var ids = Array.from(S.sel);
    if (!ids.length) return;
    if (unassign) {
      openModal({
        title: '미분류로 되돌리기', confirmLabel: '되돌리기',
        html: '<p style="font-size:14px">선택한 <b>' + ids.length + '건</b>의 소속 분류를 지웁니다(소속·직책 원문은 그대로).</p>',
        onConfirm: function () { return doAssign('', ids); },
      });
      return;
    }
    openModal({
      title: '소속 지정 — 선택 ' + ids.length + '건', confirmLabel: '지정',
      html: '<div class="ot-radio"><label><input type="radio" name="ot-how" value="pick" checked> 기존 소속 선택</label>' +
        '<label><input type="radio" name="ot-how" value="path"> 경로로 지정(없으면 생성)</label></div>' +
        '<div id="ot-how-pick"><input type="text" id="ot-f-filter" placeholder="소속 검색(경로 일부)"><label for="ot-f-unit">소속</label>' +
        '<select id="ot-f-unit" size="8">' + optionsHtml(null, false, '') + '</select></div>' +
        '<div id="ot-how-path" style="display:none"><label for="ot-f-path">소속 경로</label><input type="text" id="ot-f-path" placeholder="학교>대학>제주대학교>컴퓨터공학과">' +
        '<div class="hint">‘&gt;’로 단계를 나눕니다. 이미 있는 단계는 재사용하고, 없는 단계만 새로 만듭니다.</div></div>',
      onOpen: function (m) {
        var pick = m.querySelector('#ot-how-pick'), path = m.querySelector('#ot-how-path');
        m.querySelectorAll('input[name=ot-how]').forEach(function (r) {
          r.addEventListener('change', function () { var p = m.querySelector('input[name=ot-how]:checked').value === 'pick'; pick.style.display = p ? '' : 'none'; path.style.display = p ? 'none' : ''; });
        });
        var f = m.querySelector('#ot-f-filter'), sel = m.querySelector('#ot-f-unit');
        f.addEventListener('input', function () { sel.innerHTML = optionsHtml(null, false, '', f.value); });
      },
      onConfirm: async function (m) {
        var how = m.querySelector('input[name=ot-how]:checked').value, unitId;
        if (how === 'pick') {
          unitId = m.querySelector('#ot-f-unit').value;
          if (!unitId) throw new Error('지정할 소속을 선택해 주세요');
        } else {
          var p = parsePathInput(m.querySelector('#ot-f-path').value); if (!p.ok) throw new Error(p.message);
          unitId = await ensurePath(p.segments);
        }
        await doAssign(unitId, ids);
      },
    });
  }

  /** 경로의 없는 단계를 순서대로 만들고 마지막 노드 id를 돌려준다.
   *  낡은 캐시로 이미 있는 노드를 다시 만들지 않도록 먼저 최신 트리를 받고,
   *  그래도 다른 곳에서 먼저 만들어 409가 나면 다시 조회해 이어서 진행한다. */
  async function ensurePath(segments) {
    await refreshNodes();
    var plan = planEnsurePath(S.tree, segments), parentId = plan.parentId, lastId = plan.existing ? plan.existing.id : '';
    for (var i = 0; i < plan.toCreate.length; i++) {
      var body = { name: plan.toCreate[i] }; if (parentId) body.parent_id = parentId;
      var r;
      try { r = await post('/kmail/org-units/create', body); }
      catch (e) {
        if (!/이미 있습니다/.test(e && e.message || '')) throw e;
        await refreshNodes();
        var again = planEnsurePath(S.tree, segments);
        parentId = again.parentId; lastId = again.existing ? again.existing.id : lastId;
        if (again.toCreate.length < plan.toCreate.length - i) { plan = again; i = -1; continue; }   // 계획을 새로 세워 처음부터 이어감
        throw e;
      }
      parentId = lastId = r.node.id;
    }
    return lastId;
  }

  async function doAssign(unitId, ids) {
    var done = 0, skipped = 0;
    var batches = chunk(ids, ASSIGN_BATCH);
    for (var i = 0; i < batches.length; i++) {
      var r = await post('/kmail/contacts/assign-org', { unit_id: unitId, contact_ids: batches[i] });
      done += r.assigned || 0; skipped += (r.skipped || []).length + (r.failed || 0);
    }
    S.sel.clear();
    closeModal();
    root._ctLoad();
    toast(done + '건을 ' + (unitId ? '지정' : '미분류로 되돌림') + '했습니다' + (skipped ? ' (건너뜀 ' + skipped + '건)' : ''), skipped ? 'err' : 'ok');
  }

  // ── 목록 표 연동(webapp/desktop의 _ctRenderTable·_ctRenderRow가 호출) ──
  function beginTable() {
    injectStyle(); S.sel.clear();
    return '<div class="ot-selbar" id="ot-selbar"><span id="ot-selcount">선택 0건</span>' +
      '<button type="button" class="btn btn-primary btn-sm" data-ot-act="assign" disabled>소속 지정…</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-ot-act="unassign" disabled>미분류로</button></div>';
  }
  function updateSelBar() {
    var n = S.sel.size, c = $('ot-selcount'); if (c) c.textContent = '선택 ' + n + '건';
    root.document.querySelectorAll('#ot-selbar button').forEach(function (b) { b.disabled = n === 0; });
    var all = root.document.querySelector('.ot-sel-all'), cbs = root.document.querySelectorAll('.ot-sel-cb');
    if (all) all.checked = cbs.length > 0 && n === cbs.length;
  }
  function pathCellHtml(path) { return path ? '<span title="' + esc(crumbText(path)) + '">' + esc(crumbText(path)) + '</span>' : '—'; }
  function breadcrumbHtml(path) {
    if (path === '__NONE__') return '<div class="ot-crumb">소속: <b>미분류</b></div>';
    return '<div class="ot-crumb">소속: <b>' + esc(crumbText(path)) + '</b> (하위 포함)</div>';
  }

  // ── 시드·정합성 ──────────────────────────────────────────
  function seed() {
    openModal({
      title: '시드 템플릿으로 시작', confirmLabel: '만들기',
      html: '<p style="font-size:14px;line-height:1.7">학교(초·중·고·대학·대학원), 정부·공공기관, 기업, 연구기관, 의료기관, 협회·단체, 언론·방송, 금융기관, 국제·외국기관 — 23개 노드를 만듭니다. 이미 있는 노드는 건드리지 않고, 만든 뒤 자유롭게 수정·삭제할 수 있습니다.</p>',
      onConfirm: async function () { await post('/kmail/org-units/seed'); root._ctLoad(); },
    });
  }
  function resync() {
    guarded(async function () {
      toast('점검 중…', '', true);
      var r = await resyncAll({}, function (p) { toast('점검 중… (남은 ' + p.pending + '건)', '', true); });
      var parts = ['노드 ' + (r.nodes_fixed || 0) + '건·연락처 ' + (r.contacts_fixed || 0) + '건 바로잡음'];
      var weird = (r.orphans || []).length + (r.cycles || []).length;
      if (r.dangling) parts.push('끊긴 소속 ' + r.dangling + '건');
      if (weird) parts.push('구조 이상 노드 ' + weird + '개 — 관리자 확인 필요');
      toast(parts.join(' · '), (r.dangling || weird) ? 'err' : 'ok');
      root._ctLoad();
      if (r.dangling) offerDangling(r.dangling);
    });
  }
  function offerDangling(n) {
    openModal({
      title: '끊긴 소속 정리', danger: true, confirmLabel: '정리',
      html: '<p style="font-size:14px;line-height:1.7">삭제된 소속을 가리키는 연락처가 <b>' + n + '건</b> 있습니다. 이 연락처들의 소속 분류를 미분류로 되돌립니다(소속·직책 원문은 유지).</p>',
      onConfirm: async function () { await resyncAll({ fix_dangling: true }); root._ctLoad(); },
    });
  }

  // ── 이벤트 위임 ──────────────────────────────────────────
  function onClick(e) {
    var t = e.target.closest ? e.target.closest('[data-ot-act]') : null;
    if (!t) return;
    var act = t.getAttribute('data-ot-act'), id = t.getAttribute('data-id');
    switch (act) {
      case 'mode': S.mode = t.getAttribute('data-mode') === 'std' ? 'std' : 'org'; root._ctLoad(); break;
      case 'toggle': if (S.expanded.has(id)) S.expanded.delete(id); else S.expanded.add(id); rerender(); break;
      case 'open': root._ctOpenOrg(t.getAttribute('data-path')); break;
      case 'open-none': root._ctOpenOrg('__NONE__'); break;
      case 'expand-all': S.nodes.forEach(function (n) { S.expanded.add(n.id); }); rerender(); break;
      case 'collapse-all': S.expanded.clear(); rerender(); break;
      case 'add-root': addNodeModal(''); break;
      case 'add': addNodeModal(id); break;
      case 'edit': editNodeModal(id); break;
      case 'move': moveNodeModal(id); break;
      case 'del': deleteNodeModal(id); break;
      case 'seed': seed(); break;
      case 'resync': resync(); break;
      case 'assign': guarded(async function () { await refreshNodes(); assignModal(false); }); break;
      case 'unassign': assignModal(true); break;
      case 'modal-close': closeModal(); break;
      default: break;
    }
  }
  function onChange(e) {
    var t = e.target;
    if (t.classList && t.classList.contains('ot-sel-cb')) {
      var cid = t.getAttribute('data-cid');
      if (t.checked) S.sel.add(cid); else S.sel.delete(cid);
      updateSelBar();
    } else if (t.classList && t.classList.contains('ot-sel-all')) {
      root.document.querySelectorAll('.ot-sel-cb').forEach(function (cb) {
        cb.checked = t.checked;
        var cid = cb.getAttribute('data-cid');
        if (t.checked) S.sel.add(cid); else S.sel.delete(cid);
      });
      updateSelBar();
    }
  }
  var _bound = false;
  function bind() {
    if (_bound || !root.document) return; _bound = true;
    root.document.addEventListener('click', onClick);
    root.document.addEventListener('change', onChange);
  }
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', bind); else bind();
  }

  var API = {
    mode: function () { return S.mode; },
    modeSwitchHtml: modeSwitchHtml, renderSummary: renderSummary,
    beginTable: beginTable, pathCellHtml: pathCellHtml, breadcrumbHtml: breadcrumbHtml,
    _pure: { validateName: validateName, parseAliases: parseAliases, aliasesInvalid: aliasesInvalid, buildTree: buildTree, flatten: flatten,
             descendantIds: descendantIds, parsePathInput: parsePathInput, planEnsurePath: planEnsurePath, chunk: chunk, crumbText: crumbText },
    _state: S, _bind: bind,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.OrgTree = API;
})(typeof window !== 'undefined' ? window : globalThis);
