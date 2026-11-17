/* 개발 현황 — 왼쪽 메뉴 '개발 현황' 화면. devlog.json(scripts/devlog-sync.mjs 가 GitHub Actions 로 갱신)을 읽어
   일자별 표로 보여 준다. 검색·기간(드롭다운)·저장소 필터. desktop.html 의 _switchTab 이 DevLog.show() 를 부른다. */
(function () {
  'use strict';
  var CAT = { feat: '기능', fix: '수정', docs: '문서', etc: '기타' };
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  var S = { data: null, loading: false, month: null, q: '', repo: 'hondi', open: false };
  var root = null;


  var APP_URL = 'https://appdistribution.firebase.dev/i/295c33fac1876871';
  function installHtml() {   // 안드로이드 앱 설치 안내 — 개발 현황 화면 맨 위
    return '<section class="dl-inst" aria-label="나비웹 안드로이드 앱 설치">' +
      '<div class="dl-inst-qr"><img src="assets/naviweb-app-qr.svg" width="168" height="168" alt="나비웹 안드로이드 앱 설치 QR 코드"><small>폰 카메라로 촬영하세요</small></div>' +
      '<div class="dl-inst-txt"><h3>나비웹 안드로이드 앱 <span>테스트 버전</span></h3>' +
      '<p>나비웹을 앱처럼 쓸 수 있습니다. 안드로이드 폰으로 왼쪽 QR 코드를 촬영하면 설치 화면으로 연결됩니다. 현재는 테스트 중인 버전이며, 아이폰은 지원하지 않습니다.</p>' +
      '<ol><li>안드로이드 폰의 카메라(또는 QR 앱)로 QR 코드를 촬영하고, 나타난 링크를 엽니다.</li>' +
      '<li>구글(Gmail) 계정으로 로그인하고 <b>초대 수락</b>(Accept invitation)을 누릅니다.</li>' +
      '<li>안내에 따라 <b>나비웹 앱을 다운로드</b>합니다. 처음에는 \"알 수 없는 앱 설치 허용\"이 필요할 수 있습니다.</li>' +
      '<li>앱을 열고 <b>알림 허용</b>을 눌러 주세요.</li></ol>' +
      '<p class="dl-inst-sub">폰에서 이 페이지를 보고 있다면 <a href="' + APP_URL + '" target="_blank" rel="noopener">여기를 눌러 바로 설치</a>하세요. 오류나 불편한 점은 알려 주시면 반영하겠습니다.</p></div></section>';
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function wd(d) { var p = d.split('-'); return WD[new Date(+p[0], +p[1] - 1, +p[2]).getDay()]; }
  function mlabel(m) { return m.slice(0, 4) + '년 ' + (+m.slice(5)) + '월'; }
  function total(c) { return c.feat + c.fix + c.docs + c.etc; }
  function months(days) { var o = {}; days.forEach(function (x) { o[x.d.slice(0, 7)] = 1; }); return Object.keys(o).sort().reverse(); }

  function load() {
    if (S.data || S.loading) return;
    S.loading = true;
    fetch('devlog.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { S.data = j; if (!S.month) S.month = months(j.days)[0] || 'all'; })
      .catch(function () { S.data = { error: true, days: [], repos: {} }; })
      .then(function () { S.loading = false; render(); });
  }

  function filtered() {
    var q = S.q.trim().toLowerCase();
    return S.data.days.filter(function (x) {
      if (S.repo !== 'all' && x.r !== S.repo) return false;
      if (S.month !== 'all' && x.d.slice(0, 7) !== S.month) return false;
      if (!q) return true;
      return (x.d + ' ' + x.r + ' ' + x.i.map(function (i) { return i[1]; }).join(' ')).toLowerCase().indexOf(q) >= 0;
    });
  }

  function dayHtml(x) {
    var n = total(x.c), first = x.i[0];
    var tags = ['feat', 'fix', 'docs', 'etc'].filter(function (k) { return x.c[k]; }).map(function (k) { return '<span class="dl-tag ' + k + '">' + CAT[k] + ' ' + x.c[k] + '</span>'; }).join('');
    var items = x.i.map(function (it) {
      var pr = it[2] ? ' <a href="https://github.com/Openhash-Gopang/' + esc(x.r) + '/pull/' + it[2] + '" target="_blank" rel="noopener">#' + it[2] + '</a>' : '';
      return '<li><span class="dl-tag ' + it[0] + '">' + CAT[it[0]] + '</span><span>' + esc(it[1]) + pr + '</span></li>';
    }).join('') + (x.m ? '<li><span class="dl-tag">…</span><span>외 ' + x.m + '건</span></li>' : '');
    return '<details class="dl-day"><summary><span class="dl-date">' + x.d.slice(5).replace('-', '.') + ' <small>' + wd(x.d) + '</small></span>' +
      '<span class="dl-main">' + esc(first ? first[1] : '') + (n > 1 ? ' <small>· 외 ' + (n - 1) + '건</small>' : '') + '</span>' +
      '<span class="dl-tags"><span class="dl-repo">' + esc(x.r) + '</span>' + tags + '</span></summary><ul class="dl-items">' + items + '</ul></details>';
  }

  function opts() {
    var d = S.data, ms = months(d.days);
    return [['all', '전체 기간', d.days.length]].concat(ms.map(function (m) { return [m, mlabel(m), d.days.filter(function (x) { return x.d.slice(0, 7) === m; }).length]; }));
  }
  function result() {   // 검색어를 칠 때는 이 부분만 다시 그린다 — 입력칸을 새로 만들면 한글 입력이 끊긴다
    var d = S.data, rows = d.error ? [] : filtered();
    var cur = opts().filter(function (o) { return o[0] === S.month; })[0] || opts()[0];
    var sum = { feat: 0, fix: 0, docs: 0, etc: 0 };
    rows.forEach(function (x) { for (var k in sum) sum[k] += x.c[k]; });
    var h = d.repos && d.repos.hondi;
    var list = d.error ? '<div class="dl-empty">개발 현황 자료(devlog.json)를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.</div>'
      : rows.length ? rows.map(dayHtml).join('') : '<div class="dl-empty">조건에 맞는 작업이 없습니다.</div>';
    return '<div class="dl-stats"><div class="dl-stat"><b>' + (h ? h.total.toLocaleString() : '-') + '</b><span>hondi 누적 커밋</span></div><div class="dl-stat"><b>' + sum.feat + '</b><span>기능 추가 (선택 기간)</span></div><div class="dl-stat"><b>' + sum.fix + '</b><span>수정</span></div><div class="dl-stat"><b>' + sum.docs + '</b><span>문서</span></div></div>' +
      '<section class="dl-card" aria-label="일자별 개발 내역"><h3>' + esc(cur[1]) + ' <span>· ' + rows.length + '일</span></h3>' + list + '</section>' +
      '<p class="dl-note">빌드 번호·저장소 요약 같은 자동 갱신 기록은 제외했습니다. 일자를 누르면 그날의 주요 작업이 펼쳐집니다.</p>';
  }

  function render() {
    if (!root) return;
    var d = S.data;
    if (!d) { root.innerHTML = installHtml() + '<div class="dl-note" role="status">불러오는 중…</div>'; return; }
    var os = opts(), cur = os.filter(function (o) { return o[0] === S.month; })[0] || os[0];
    var repoBtns = [['hondi', 'hondi'], ['mail', 'mail'], ['all', '전체 저장소']].map(function (r) { return '<button type="button" class="dl-chip" data-dl-repo="' + r[0] + '" aria-pressed="' + (S.repo === r[0]) + '">' + r[1] + '</button>'; }).join('');
    root.innerHTML = installHtml() +
      '<div class="dl-head"><h2>개발 현황</h2><p>Openhash-Gopang 저장소의 일자별 진행 내역 — hondi 저장소 중심 · 자동 갱신 ' + esc((d.updated || '').slice(0, 16).replace('T', ' ')) + '</p></div>' +
      '<div class="dl-bar"><label class="dl-search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/></svg><input type="search" id="dl-q" value="' + esc(S.q) + '" placeholder="작업 내용 검색" aria-label="개발 현황 검색" autocomplete="off"></label>' +
      '<div class="dl-dd"><button type="button" class="dl-dd-btn" id="dl-dd-btn" aria-haspopup="listbox" aria-expanded="' + S.open + '" aria-label="기간 선택"><span>' + esc(cur[1]) + '</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
      '<ul class="dl-menu" role="listbox" aria-label="기간" ' + (S.open ? '' : 'hidden') + '>' + os.map(function (o) { return '<li role="presentation"><button type="button" role="option" class="dl-opt" data-dl-m="' + o[0] + '" aria-selected="' + (o[0] === S.month) + '"><span>' + o[1] + '</span><small>' + o[2] + '일</small></button></li>'; }).join('') + '</ul></div></div>' +
      '<div class="dl-chips" role="group" aria-label="저장소">' + repoBtns + '</div><div id="dl-res">' + result() + '</div>';
  }

  function bind() {
    root.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('button') : null; if (!t) return;
      if (t.id === 'dl-dd-btn') { S.open = !S.open; render(); return; }
      if (t.dataset.dlM) { S.month = t.dataset.dlM; S.open = false; render(); return; }
      if (t.dataset.dlRepo) { S.repo = t.dataset.dlRepo; render(); }
    });
    root.addEventListener('input', function (e) { if (e.target.id === 'dl-q') { S.q = e.target.value; var r = document.getElementById('dl-res'); if (r) r.innerHTML = result(); } });
    document.addEventListener('click', function (e) { if (S.open && !e.target.closest('.dl-dd')) { S.open = false; render(); } });
    root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.open) { S.open = false; render(); var b = document.getElementById('dl-dd-btn'); if (b) b.focus(); } });
  }

  window.DevLog = {
    show: function () {
      if (!root) { var p = document.getElementById('tab-devlog'); if (!p) return; root = document.createElement('div'); root.className = 'dl-wrap'; p.appendChild(root); bind(); }
      render(); load();
    }
  };
})();
