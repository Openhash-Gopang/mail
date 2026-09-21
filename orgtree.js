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

  // ── 미분류 자동 분류: 규칙 기반 분류기(순수 함수) ──────────────
  // 소속(org) 원문 → 트리 경로 제안. ① 이미 있는 노드의 이름·별칭과 일치하면 그것을 최우선(사용자가 다듬은 표기),
  // ② 아니면 한국 기관명 규칙. 규칙은 위에서부터 첫 일치가 이기므로 순서가 곧 우선순위다
  // (예: '제주대학교병원'은 대학 규칙보다 병원 규칙이 먼저라 의료기관으로, '○○대학교 총동문회'는 협회·단체로).
  // conf: 'high'는 마법사가 기본 선택하고, 'medium'은 사용자가 확인·수정한 뒤 선택한다. 추측이 아니라 전부 접미어/키워드 규칙이다.
  function normText(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function normKey(s) { return normText(s).toLowerCase().replace(/[\s()（）]/g, '').replace(/주식회사|㈜/g, ''); }
  function sanitizeName(s) {
    var t = normText(s).replace(/[>%\\\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (t.length > NAME_MAX) t = t.slice(0, NAME_MAX).trim();
    return t === '__NONE__' ? '' : t;
  }
  var MINISTRY = /(기획재정|교육|과학기술정보통신|외교|통일|법무|국방|행정안전|국가보훈|문화체육관광|농림축산식품|산업통상자원|보건복지|환경|고용노동|여성가족|국토교통|해양수산|중소벤처기업)부$|(경찰청|소방청|국세청|관세청|조달청|통계청|병무청|방위사업청|농촌진흥청|산림청|문화재청|기상청|특허청|해양경찰청|질병관리청|식품의약품안전처|국가정보원|감사원|인사혁신처|법제처|국무조정실|대통령실)$/;
  var UNIV_TOKEN = /^(\S+?(?:대학교|대학))(?:\s+(.+))?$/;
  var RULES = [
    { re: /(병원|의료원|메디컬센터|hospital)$/i, root: ['의료기관', '병원'], conf: 'high', why: '병원' },
    { re: /(의원|치과|한의원|클리닉|clinic)$/i, root: ['의료기관', '의원'], conf: 'high', why: '의원·치과·한의원' },
    { re: /약국$/, root: ['의료기관', '약국'], conf: 'high', why: '약국' },
    { re: /(동문회|동창회|후원회|장학회|학부모회|총학생회)$/, root: ['협회·단체'], conf: 'high', why: '동문회·후원회' },
    { re: /대학원/, root: ['학교', '대학원'], conf: 'high', why: '대학원' },
    { re: /초등학교$/, root: ['학교', '초등학교'], conf: 'high', why: '초등학교' },
    { re: /중학교$/, root: ['학교', '중학교'], conf: 'high', why: '중학교' },
    { re: /(고등학교|고교)$/, root: ['학교', '고등학교'], conf: 'high', why: '고등학교' },
    { univ: true },
    { re: /(university|college)/i, root: ['학교', '대학'], conf: 'medium', why: '대학(영문)', dept: true },
    { re: /(특별자치도청|특별시청|광역시청|도청|시청|군청|구청|읍사무소|면사무소|동사무소|주민센터|행정복지센터|시의회|도의회|군의회|구의회|교육청|교육지원청|보건소)$/, root: ['정부·공공기관', '지방자치단체'], conf: 'high', why: '지방자치단체·교육청' },
    { re: /(경찰서|소방서|세무서|우체국|등기소)$/, root: ['정부·공공기관', '중앙정부'], conf: 'high', why: '국가기관 지방청' },
    { re: /(국회|법원|검찰청|헌법재판소)/, root: ['정부·공공기관', '국회·법원'], conf: 'high', why: '국회·법원' },
    { re: MINISTRY, root: ['정부·공공기관', '중앙정부'], conf: 'high', why: '중앙행정기관' },
    { re: /위원회$/, root: ['정부·공공기관', '중앙정부'], conf: 'medium', why: '위원회' },
    { re: /(연구원|연구소|연구센터|연구재단|institute)$/i, root: ['연구기관'], conf: 'high', why: '연구기관' },
    { re: /(공사|공단|진흥원|진흥공단)$/, root: ['정부·공공기관', '공공기관'], conf: 'medium', why: '공사·공단·진흥원' },
    { re: /(은행|저축은행|신협|새마을금고|농협|수협|bank)$/i, root: ['금융기관', '은행'], conf: 'high', why: '은행·금고' },
    { re: /(증권|보험|생명|화재)$/, root: ['금융기관', '증권·보험'], conf: 'medium', why: '증권·보험' },
    { re: /(카드|캐피탈|자산운용|파이낸셜|금융|투자)$/, root: ['금융기관'], conf: 'medium', why: '금융' },
    { re: /(방송|신문|일보|미디어|뉴스|저널|통신사)$|^(KBS|MBC|SBS|JTBC|YTN|EBS|TBS)/i, root: ['언론·방송'], conf: 'medium', why: '언론·방송' },
    { re: /(협회|학회|연합회|협의회|조합|연맹|재단|총회|단체)$|^(사단법인|재단법인|사회복지법인)/, root: ['협회·단체'], conf: 'high', why: '협회·단체·법인' },
    { re: /(대사관|영사관|국제기구|embassy|consulate|united nations|unesco|unicef|oecd|imf|world bank)/i, root: ['국제·외국기관'], conf: 'high', why: '국제·외국기관' },
    { re: /(주식회사|㈜|\(주\)|\(유\)|유한회사|합자회사|\binc\.?(?:\s|$)|\bcorp\.?(?:\s|$)|\bltd\.?(?:\s|$)|\bllc\b|\bgmbh\b|\bco\.)/i, root: ['기업'], conf: 'high', why: '회사 표기' },
    { re: /(그룹|컴퍼니|company|산업|전자|건설|상사|물산|제약|테크|시스템|솔루션|소프트|네트웍스|스튜디오)$/i, root: ['기업'], conf: 'medium', why: '회사명 접미어' },
  ];

  /** 트리의 이름·별칭 → 노드 색인. 같은 표기가 여러 노드에 있으면(모호) 쓰지 않는다. */
  function makeIndex(tree) {
    var idx = new Map();
    tree.byId.forEach(function (n) {
      [n.name].concat(Array.isArray(n.aliases) ? n.aliases : []).forEach(function (nm) {
        var k = normKey(nm); if (!k) return;
        if (!idx.has(k)) idx.set(k, []);
        if (idx.get(k).indexOf(n) < 0) idx.get(k).push(n);
      });
    });
    return idx;
  }

  function finishSegs(segs, dept, useDept, conf, why) {
    var clean = segs.map(sanitizeName);
    if (clean.some(function (x) { return !x; })) return { segs: null, conf: 'none', why: '이름에 쓸 수 없는 문자만 있음', useDept: false };
    if (useDept && dept && clean[clean.length - 1] !== dept) clean.push(dept);
    if (clean.length > ORG_MAX_DEPTH) return { segs: null, conf: 'none', why: '계층이 너무 깊음', useDept: false };
    return { segs: clean, conf: conf, why: why, useDept: !!useDept };
  }

  /** org 원문(+부서) → { segs|null, conf:'high'|'medium'|'none', why, useDept }. idx는 makeIndex(tree). */
  function classifyOrg(orgRaw, deptRaw, idx) {
    var org = normText(orgRaw);
    if (!org) return { segs: null, conf: 'none', why: '소속 미기재', useDept: false };
    var dept = sanitizeName(deptRaw);
    var hits = idx ? idx.get(normKey(org)) : null;
    if (hits && hits.length === 1) {
      var useD = /^학교>(대학|대학원)>/.test(hits[0].path);
      return finishSegs(hits[0].path.split(SEP), dept, useD, 'high', '이미 있는 소속(이름·별칭 일치)');
    }
    for (var i = 0; i < RULES.length; i++) {
      var r = RULES[i];
      if (r.univ) {
        var m = UNIV_TOKEN.exec(org);
        if (m) {
          var segs = ['학교', '대학', m[1]];
          if (m[2]) segs.push(m[2]);
          return finishSegs(segs, dept, true, 'high', '대학교·대학');
        }
        continue;
      }
      if (r.re.test(org)) return finishSegs(r.root.concat([org]), dept, !!r.dept || r.root[1] === '대학원', r.conf, r.why);
    }
    return { segs: null, conf: 'none', why: '규칙에 맞는 기관 유형 없음', useDept: false };
  }

  /** 미분류 연락처 목록 → 그룹. 같은 소속 원문끼리 묶고, 대학처럼 부서를 하위 노드로 쓰는 유형은 부서별로 다시 나눈다. */
  function buildGroups(contacts, tree) {
    var idx = makeIndex(tree), byOrg = new Map(), noOrg = [], groups = [];
    (contacts || []).forEach(function (c) {
      var org = normText(c.org);
      if (!org) { noOrg.push(c); return; }
      if (!byOrg.has(org)) byOrg.set(org, []);
      byOrg.get(org).push(c);
    });
    function mk(org, dept, list, cls) {
      return { org: org, dept: dept, ids: list.map(function (c) { return c.id; }), count: list.length,
        names: list.slice(0, 3).map(function (c) { return c.name || c.email || ''; }),
        segs: cls.segs, conf: cls.conf, why: cls.why, deptUsed: !!(cls.useDept && dept) };
    }
    byOrg.forEach(function (list, org) {
      var base = classifyOrg(org, '', idx);
      if (base.useDept) {
        var byDept = new Map();
        list.forEach(function (c) { var d = sanitizeName(c.dept); if (!byDept.has(d)) byDept.set(d, []); byDept.get(d).push(c); });
        byDept.forEach(function (l2, d) { groups.push(mk(org, d, l2, d ? classifyOrg(org, d, idx) : base)); });
      } else {
        groups.push(mk(org, '', list, base));
      }
    });
    groups.sort(function (a, b) { return b.count - a.count || String(a.org).localeCompare(String(b.org), 'ko'); });
    return { groups: groups, noOrg: noOrg };
  }

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
      '.ot-modal.wide{max-width:980px}',
      '.ot-wz-scroll{max-height:50vh;overflow:auto;border:1px solid var(--bdr);border-radius:8px;margin:8px 0}',
      '.ot-wz-table{width:100%;border-collapse:collapse;font-size:13px}',
      '.ot-wz-table th,.ot-wz-table td{padding:6px 8px;border-bottom:1px solid var(--bdr);text-align:left;vertical-align:top}',
      '.ot-wz-table th{position:sticky;top:0;background:var(--bg);z-index:1}',
      '.ot-wz-table input[type=text]{min-width:260px}',
      '.ot-wz-sub{font-size:12px;color:var(--hint);margin-top:2px}',
      '.ot-conf-high{color:var(--grn);font-weight:700} .ot-conf-medium{color:var(--org);font-weight:700} .ot-conf-none{color:var(--hint)}',
      '.ot-wz-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px}',
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
          (S.unassigned > 0 ? '<button type="button" class="btn btn-primary btn-sm" data-ot-act="wizard">미분류 자동 분류…</button>' : '') +
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
    back.innerHTML = '<div class="ot-modal' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '"><h3>' + esc(o.title) + '</h3>' +
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

  // ── 미분류 자동 분류 마법사 ─────────────────────────────
  // 흐름: 미분류 연락처를 전부 불러와(서버 페이지 200건씩) → 소속 원문별로 묶어 경로를 제안 → 사용자가 표에서
  // 확인·수정·선택 → 선택한 그룹만 적용(없는 노드 생성 → 100건씩 배정 → 수정한 표기는 별칭으로 기억).
  // 데이터는 브라우저 밖으로 나가지 않는다: 분류는 여기서 계산하고, 저장은 기존 org-units API만 쓴다.
  var WZ = { groups: [], noOrg: 0, truncated: false };

  async function loadUnassigned(onProgress) {
    var out = [], page = 1, totalPages = 1, truncated = false;
    do {
      var r = await api('/kmail/contacts', { query: { status: 'all', org_path: '__NONE__', page: page } });
      var items = r.items || [];
      items.forEach(function (c) { if (c.status !== 'rejected') out.push(c); });
      if (typeof r.totalPages === 'number') totalPages = r.totalPages;
      else { totalPages = 1; if (items.length >= 200) truncated = true; }   // 옛 서버(페이지 미지원): 첫 200건만
      if (onProgress) onProgress(out.length, r.totalItems);
      page++;
    } while (page <= totalPages && page <= 50);
    return { contacts: out, truncated: truncated };
  }

  function confLabel(c) { return c === 'high' ? '확실' : c === 'medium' ? '확인 필요' : '규칙 없음'; }

  function wizardHtml(res, truncated) {
    var g = res.groups, sug = g.filter(function (x) { return x.segs; }).length, hi = g.filter(function (x) { return x.segs && x.conf === 'high'; }).length;
    var rows = g.map(function (x, i) {
      var sub = [];
      if (x.dept) sub.push('부서: ' + esc(x.dept));
      if (x.names.length) sub.push(esc(x.names.join(', ')) + (x.count > x.names.length ? ' 등' : ''));
      return '<tr data-gi="' + i + '"><td><input type="checkbox" class="ot-wz-cb" aria-label="선택"' + (x.segs && x.conf === 'high' ? ' checked' : '') + '></td>' +
        '<td>' + esc(x.org) + '<div class="ot-wz-sub">' + sub.join(' · ') + '</div></td>' +
        '<td style="text-align:right">' + x.count + '</td>' +
        '<td><input type="text" class="ot-wz-path" list="ot-paths" value="' + esc(x.segs ? x.segs.join(SEP) : '') + '" placeholder="예: 학교>대학>제주대학교" aria-label="소속 경로"></td>' +
        '<td><span class="ot-conf-' + esc(x.conf) + '">' + confLabel(x.conf) + '</span><div class="ot-wz-sub">' + esc(x.why) + '</div></td></tr>';
    }).join('');
    var paths = flatten(S.tree).map(function (n) { return '<option value="' + esc(n.path) + '"></option>'; }).join('');
    var total = g.reduce(function (a, x) { return a + x.count; }, 0);
    return '<div class="ot-wz-sub" style="font-size:13px;color:var(--sub);line-height:1.7">' +
      '미분류 <b>' + (total + res.noOrg.length) + '건</b> → 소속 <b>' + g.length + '개 그룹</b> (자동 제안 ' + sug + '개, 그중 확실 ' + hi + '개 · 직접 입력 필요 ' + (g.length - sug) + '개)' +
      (res.noOrg.length ? ' · 소속이 비어 있는 ' + res.noOrg.length + '건은 대상이 아닙니다' : '') + '<br>' +
      '규칙에 따른 <b>제안</b>입니다. 경로는 직접 고칠 수 있고(‘&gt;’로 단계 구분), <b>체크한 그룹만</b> 적용됩니다. 확실한 것만 미리 선택돼 있습니다.</div>' +
      (truncated ? '<div class="errbox" style="margin-top:8px">서버가 아직 페이지를 지원하지 않아 첫 200건만 불러왔습니다. 서버 업데이트 후 다시 실행하세요.</div>' : '') +
      '<div class="ot-wz-bar"><button type="button" class="btn btn-outline btn-sm" data-ot-act="wz-high">확실한 것만 선택</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-ot-act="wz-all">제안 있는 것 전체 선택</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-ot-act="wz-none">모두 해제</button>' +
      '<label style="margin:0 0 0 auto;font-weight:400"><input type="checkbox" id="ot-wz-alias" checked> 수정한 소속은 원문을 별칭으로 기억(다음부터 자동 매칭)</label></div>' +
      '<div class="ot-wz-scroll"><table class="ot-wz-table"><thead><tr><th></th><th>소속(원문)</th><th style="text-align:right">건수</th><th>제안 경로</th><th>근거</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<datalist id="ot-paths">' + paths + '</datalist>';
  }

  function wizardModal() {
    injectStyle();
    openModal({
      title: '미분류 자동 분류', wide: true, confirmLabel: '선택한 그룹 적용',
      html: '<div id="ot-wz"><div class="loading-row"><span class="spinner"></span> 미분류 연락처를 불러오는 중…</div></div>',
      onOpen: function (m) {
        var ok = m.querySelector('[data-ot-act="modal-ok"]'), host = m.querySelector('#ot-wz');
        ok.disabled = true;
        (async function () {
          try {
            await refreshNodes();
            var got = await loadUnassigned(function (n, t) { host.textContent = '미분류 연락처를 불러오는 중… ' + n + (t ? ' / ' + t : '') + '건'; });
            var res = buildGroups(got.contacts, S.tree);
            WZ.groups = res.groups; WZ.noOrg = res.noOrg.length; WZ.truncated = got.truncated;
            if (!res.groups.length) { host.innerHTML = '<p style="font-size:14px">분류할 미분류 연락처가 없습니다' + (res.noOrg.length ? ' (소속이 비어 있는 ' + res.noOrg.length + '건은 대상 아님)' : '') + '.</p>'; return; }
            host.innerHTML = wizardHtml(res, got.truncated);
            ok.disabled = false;
          } catch (e) { host.innerHTML = '<div class="errbox">' + esc(e && e.message || e) + '</div>'; }
        })();
      },
      onConfirm: applyWizard,
    });
  }

  function wzSetChecks(mode) {
    root.document.querySelectorAll('#ot-wz tbody tr').forEach(function (tr) {
      var g = WZ.groups[Number(tr.getAttribute('data-gi'))], cb = tr.querySelector('.ot-wz-cb'), has = !!tr.querySelector('.ot-wz-path').value.trim();
      cb.checked = mode === 'none' ? false : mode === 'high' ? (has && g.conf === 'high') : has;
    });
  }

  async function applyWizard(m) {
    var aliasOn = !!(m.querySelector('#ot-wz-alias') || {}).checked, rows = [];
    m.querySelectorAll('#ot-wz tbody tr').forEach(function (tr) {
      if (!tr.querySelector('.ot-wz-cb').checked) return;
      var g = WZ.groups[Number(tr.getAttribute('data-gi'))], pth = parsePathInput(tr.querySelector('.ot-wz-path').value);
      if (!pth.ok) throw new Error('“' + g.org + '”: ' + pth.message);
      rows.push({ g: g, segs: pth.segments });
    });
    if (!rows.length) throw new Error('적용할 그룹을 선택해 주세요');
    await refreshNodes();
    var pathToId = new Map(S.nodes.map(function (n) { return [n.path, n.id]; })), nodeById = new Map(S.nodes.map(function (n) { return [n.id, n]; }));
    var created = 0, failedGroups = [];

    async function ensure(segs) {
      var path = '', parentId = '';
      for (var i = 0; i < segs.length; i++) {
        path = path ? path + SEP + segs[i] : segs[i];
        var id = pathToId.get(path);
        if (!id) {
          var body = { name: segs[i] }; if (parentId) body.parent_id = parentId;
          try { var r = await post('/kmail/org-units/create', body); id = r.node.id; nodeById.set(id, r.node); created++; }
          catch (e) {
            if (!/이미 있습니다/.test(e && e.message || '')) throw e;      // 다른 곳에서 먼저 만든 경우 — 다시 받아 이어감
            await refreshNodes();
            S.nodes.forEach(function (n) { pathToId.set(n.path, n.id); nodeById.set(n.id, n); });
            id = pathToId.get(path); if (!id) throw e;
          }
          pathToId.set(path, id);
        }
        parentId = id;
      }
      return parentId;
    }

    var assignMap = new Map(), aliasMap = new Map();
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      toast('소속 만드는 중… ' + (i + 1) + ' / ' + rows.length + ' 그룹', '', true);
      try {
        var tid = await ensure(row.segs);
        if (!assignMap.has(tid)) assignMap.set(tid, []);
        Array.prototype.push.apply(assignMap.get(tid), row.g.ids);
        var last = row.segs[row.segs.length - 1];
        if (aliasOn && !row.g.deptUsed && normKey(last) !== normKey(row.g.org) && validateName(row.g.org).ok) {
          if (!aliasMap.has(tid)) aliasMap.set(tid, []);
          if (aliasMap.get(tid).indexOf(normText(row.g.org)) < 0) aliasMap.get(tid).push(normText(row.g.org));
        }
      } catch (e) { failedGroups.push(row.g.org + ' (' + (e && e.message || e) + ')'); }
    }

    var assigned = 0, done = 0, targets = Array.from(assignMap.keys()), totalChunks = chunk_total(assignMap);
    for (var t = 0; t < targets.length; t++) {
      var chunks = chunk(assignMap.get(targets[t]), ASSIGN_BATCH);
      for (var c = 0; c < chunks.length; c++) {
        toast('연락처 배정 중… ' + (++done) + ' / ' + totalChunks + ' 묶음', '', true);
        try { var r2 = await post('/kmail/contacts/assign-org', { unit_id: targets[t], contact_ids: chunks[c] }); assigned += r2.assigned || 0; }
        catch (e) { failedGroups.push('배정 실패 (' + (e && e.message || e) + ')'); }
      }
    }

    var aliasCount = 0, aliasIds = Array.from(aliasMap.keys());
    for (var a = 0; a < aliasIds.length; a++) {
      var nid = aliasIds[a], node = nodeById.get(nid), have = (node && node.aliases) || [];
      var merged = have.slice(); aliasMap.get(nid).forEach(function (x) { if (merged.indexOf(x) < 0) merged.push(x); });
      if (merged.length === have.length || merged.length > 20) continue;
      try { await post('/kmail/org-units/update', { unit_id: nid, aliases: merged }); aliasCount += merged.length - have.length; } catch (e) { /* 별칭은 부가 기능 — 실패해도 분류는 유지 */ }
    }

    S.sel.clear();
    root._ctLoad();
    toast(assigned + '건을 분류했습니다 (새 소속 ' + created + '개' + (aliasCount ? ', 별칭 ' + aliasCount + '개 기억' : '') + ')' +
      (failedGroups.length ? ' · 실패 ' + failedGroups.length + '건: ' + failedGroups.slice(0, 2).join('; ') : ''), failedGroups.length ? 'err' : 'ok');
  }
  function chunk_total(map) { var n = 0; map.forEach(function (ids) { n += chunk(ids, ASSIGN_BATCH).length; }); return n; }

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
      case 'wizard': guarded(async function () { wizardModal(); }); break;
      case 'wz-high': wzSetChecks('high'); break;
      case 'wz-all': wzSetChecks('all'); break;
      case 'wz-none': wzSetChecks('none'); break;
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
  function onInput(e) {
    var t = e.target;
    if (t.classList && t.classList.contains('ot-wz-path')) { var cb = t.closest('tr').querySelector('.ot-wz-cb'); cb.checked = !!t.value.trim(); }
  }
  var _bound = false;
  function bind() {
    if (_bound || !root.document) return; _bound = true;
    root.document.addEventListener('click', onClick);
    root.document.addEventListener('change', onChange);
    root.document.addEventListener('input', onInput);
  }
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', bind); else bind();
  }

  var API = {
    mode: function () { return S.mode; },
    modeSwitchHtml: modeSwitchHtml, renderSummary: renderSummary,
    beginTable: beginTable, pathCellHtml: pathCellHtml, breadcrumbHtml: breadcrumbHtml,
    _pure: { validateName: validateName, parseAliases: parseAliases, aliasesInvalid: aliasesInvalid, buildTree: buildTree, flatten: flatten,
             descendantIds: descendantIds, parsePathInput: parsePathInput, planEnsurePath: planEnsurePath, chunk: chunk, crumbText: crumbText,
             normText: normText, normKey: normKey, sanitizeName: sanitizeName, makeIndex: makeIndex, classifyOrg: classifyOrg, buildGroups: buildGroups },
    _state: S, _bind: bind,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.OrgTree = API;
})(typeof window !== 'undefined' ? window : globalThis);
