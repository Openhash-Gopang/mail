/* bank-app.js — 나비웹 은행(인프라 AI · 은행). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviBank.mount(요소, { view, guid, proxy, fetch, plans, onPlans }) · .nav(조작) · .view(이름) · .on('ask'|'state'|'result', 함수)
 * 모양은 bank.css(.bnk 범위). 전역은 NaviBank 하나만 쓴다.
 *
 * 무엇이 실제 자료이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 실제 자료(읽기 전용, hondi-proxy, guid 쿼리): 잔액 /biz/balance · 가입 무료 한도 /free-quota-status · 사용 내역 /usage-log · 충전 내역 /biz/charge-status
 *  - 이 화면은 돈을 옮기지 않는다. 송금·결제는 입력을 확인해 주기만 하고, 실제 결제는 폰의 나비웹 앱(코드로 결제)에서 사용자가 직접 한다.
 *  - 예금·대출·신용·채권은 설계 단계다. 계산기는 사용자가 넣은 이율로 계산만 하며 실제 상품이 아니다. 실제 자금은 오가지 않는다. */
(function () {
'use strict';
var DAY = 86400000, LOW = 1000;   // 잔액이 1,000 GDC 이하이면 충전을 권한다(매뉴얼 '충전 확인과 알림')
var ACCT = { bank:'중소기업은행', no:'415-092028-04-011', holder:'에이아이시티주식회사' };   // desktop.html 의 입금 안내와 같은 값
var PLANS = [['무료', '$0', '전화번호 인증 후 24시간 넉넉히, 그 뒤에도 가볍게'], ['기본', '$10 / 월', '대화·간단한 서류'], ['서류', '$100 / 월', '서류 작성 중심'], ['프로', '$200 / 월', '전문가 AI까지 넉넉히']];
var BETA_END = '2026-12-31';
var TABS = [['wallet', '내 지갑'], ['topup', '충전·입금'], ['pay', '송금·결제'], ['history', '거래 내역'], ['save', '예금·대출'], ['credit', '신용·채권']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var SVC = { 'hondi-chat':'나비 대화·서류 작성·전문가 AI', klaw:'K-Law(법률)', kplan:'K-Plan(계획)', kjit:'K-JIT', kcity:'K-City', biz:'사업체 AI', gov:'정부 AI' };
var COL = ['#3B7DDD', '#0F8F7E', '#E8710A', '#7C4DDB', '#C2410C', '#4B5563', '#B45309', '#0E7490'];
var RANGES = [['today', '오늘'], ['7', '7일'], ['30', '30일'], ['90', '90일']];
var CHG = { pending:'입금 대기', matched:'충전 완료', expired:'만료', cancelled:'취소' };
var M = null, LS = {};
var S = { view:'wallet', guid:'', proxy:'', fetch:null, st:'idle', at:0, bal:null, quota:null, usage:null, series:null, charges:null, errs:[], range:'7', pay:{ code:'', amt:'', memo:'' }, calc:{ kind:'save', p:'', r:'', m:'12' }, onPlans:null, plans:null };

// ── 작은 도구 ──
function h(tag, attrs, kids) {
  var e = document.createElement(tag), k;
  for (k in (attrs || {})) { var v = attrs[k]; if (v == null || v === false) continue; if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v; else if (k.slice(0, 2) === 'on') e[k] = v; else e.setAttribute(k, v === true ? '' : v); }
  (kids || []).forEach(function (c) { if (c == null || c === false) return; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
function sv(tag, a, kids) { var e = document.createElementNS('http://www.w3.org/2000/svg', tag), k; for (k in (a || {})) e.setAttribute(k, a[k]); (kids || []).forEach(function (c) { e.appendChild(c); }); return e; }
function $(id) { return M ? M.querySelector('#' + id) : null; }
function emit(t, p) { (LS[t] || []).slice().forEach(function (f) { try { f(p); } catch (e) {} }); }
function ask(text) { emit('ask', text || ''); }
function won(n) { return Math.round(Number(n) || 0).toLocaleString('ko-KR'); }
function short(v) { return v >= 1e6 ? Math.round(v / 1e5) / 10 + 'M' : v >= 1e3 ? Math.round(v / 100) / 10 + 'K' : String(Math.round(v * 100) / 100); }
function pill(t, k) { return h('span', { class:'pill ' + (k || ''), text:t }); }
function btn(t, cls, fn) { return h('button', { type:'button', class:'btn ' + (cls || ''), text:t, onclick:fn }); }
function kst() { return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul' }).format(new Date()); }
function isBeta() { return kst() <= BETA_END; }

// ── 불러오기 ──
function getJSON(path) {
  var f = S.fetch || window.fetch.bind(window);
  return f(S.proxy + path + (path.indexOf('?') < 0 ? '?' : '&') + 'guid=' + encodeURIComponent(S.guid)).then(function (r) { return r.json(); });
}
function load(force) {
  if (!S.guid) { S.st = 'nologin'; return render(); }
  if (!force && S.st === 'ok' && Date.now() - S.at < 30000) return;
  if (S.st === 'load') return;
  S.st = 'load'; render();
  var jobs = ['/biz/balance', '/free-quota-status', '/usage-log?days=90', '/biz/charge-status'].map(function (p) { return getJSON(p).then(function (v) { return { v:v }; }, function (e) { return { e:e }; }); });
  Promise.all(jobs).then(function (r) {
    var ok = function (x) { return x.v && x.v.ok ? x.v : null; };
    S.bal = ok(r[0]) && typeof r[0].v.balance === 'number' ? r[0].v.balance : (ok(r[0]) ? 0 : null);
    S.quota = ok(r[1]); S.usage = ok(r[2]); S.series = S.usage && S.usage.series && S.usage.series.daily ? S.usage.series : null;
    S.charges = ok(r[3]) && Array.isArray(r[3].v.requests) ? r[3].v.requests.slice(0, 20) : [];
    S.errs = r.map(function (x, i) { return ok(x) ? '' : ['잔액', '무료 한도', '사용 내역', '충전 내역'][i]; }).filter(Boolean);
    S.st = r.every(function (x) { return !ok(x); }) ? 'err' : 'ok'; S.at = Date.now(); render();
  });
}

// ── 사용 내역 계산(설정 > GDC 지갑과 같은 방식) ──
function merge(list) {
  var o = { req:0, tok:0, krw:0, svc:{}, models:{} };
  list.forEach(function (r) { o.req += r.req || 0; o.tok += r.tok || 0; o.krw += r.krw || 0; Object.keys(r.svc || {}).forEach(function (k) { var v = o.svc[k] || (o.svc[k] = { req:0, tok:0, krw:0 }), x = r.svc[k]; v.req += x.req || 0; v.tok += x.tok || 0; v.krw += x.krw || 0; }); });
  return o;
}
function rowsOf(range) {
  var sr = S.series; if (!sr) return null;
  var d = sr.daily || [];
  if (range === 'today') { var hr = sr.hourly || []; return { rows:hr, lab:hr.map(function (r) { return String(r.h).padStart(2, '0') + ':00'; }), prev:d.length > 1 ? d[d.length - 2] : null, prevName:'어제' }; }
  var n = Number(range), cur = d.slice(-n), before = d.slice(-2 * n, -n);
  if (n === 90) { var rows = [], lab = []; for (var i = 0; i < cur.length; i += 7) { var ch = cur.slice(i, i + 7); rows.push(merge(ch)); lab.push(ch[0].d.slice(5)); } return { rows:rows, lab:lab, prev:null, prevName:'' }; }
  return { rows:cur, lab:cur.map(function (r) { return r.d.slice(5); }), prev:before.length === n ? merge(before) : null, prevName:n === 7 ? '직전 7일' : '직전 30일' };
}
function sum(rows, k) { return rows.reduce(function (a, r) { return a + (r[k] || 0); }, 0); }
function svcTotals(rows) {
  var t = {}; rows.forEach(function (r) { Object.keys(r.svc || {}).forEach(function (k) { var v = t[k] || (t[k] = { req:0, tok:0, krw:0 }), x = r.svc[k]; v.req += x.req || 0; v.tok += x.tok || 0; v.krw += x.krw || 0; }); });
  return t;
}
function svcName(k) { return SVC[k] || (/^kmail/.test(k) ? '메일' : k === '(unknown)' ? '기타' : k); }
function monthBill() {
  var sr = S.series; if (!sr) return null;
  var ym = kst().slice(0, 7), rows = (sr.daily || []).filter(function (r) { return r.d && r.d.slice(0, 7) === ym; });
  return { ym:ym, rows:rows, krw:sum(rows, 'krw'), req:sum(rows, 'req'), svc:svcTotals(rows) };
}
/** 단리·월복리 예금 이자, 원리금균등 대출 상환 — 사용자가 넣은 연 이율(%)로 계산만 한다. */
function calc(kind, p, ratePct, months) {
  p = Number(p); var r = Number(ratePct), m = Math.floor(Number(months));
  if (!(p > 0) || !isFinite(r) || r < 0 || !(m >= 1) || m > 600) return null;
  var i = r / 100 / 12;
  if (kind === 'save') { var interest = p * (r / 100) * (m / 12); return { interest:Math.round(interest * 100) / 100, total:Math.round((p + interest) * 100) / 100 }; }
  var pay = i === 0 ? p / m : p * i / (1 - Math.pow(1 + i, -m)), tot = pay * m;
  return { monthly:Math.round(pay * 100) / 100, interest:Math.round((tot - p) * 100) / 100, total:Math.round(tot * 100) / 100 };
}

// ── 그림 ──
function bars(vals, labels, color, fmt) {
  var W = 560, H = 180, L = 44, R = 8, T = 10, B = 24, iw = W - L - R, ih = H - T - B, n = vals.length, mx = Math.max.apply(null, vals.concat([1])), bw = Math.max(2, iw / n * .62);
  var s = sv('svg', { viewBox:'0 0 ' + W + ' ' + H, role:'img', 'aria-label':'막대 그래프' });
  for (var i = 0; i <= 2; i++) { var y = T + ih - ih * i / 2; s.appendChild(sv('line', { x1:L, x2:W - R, y1:y, y2:y, stroke:'#D9DEE6' })); var t = sv('text', { x:L - 6, y:y + 4, 'text-anchor':'end', 'font-size':10.5, fill:'#6C757D' }); t.textContent = fmt(mx * i / 2); s.appendChild(t); }
  vals.forEach(function (v, j) { if (v <= 0) return; var hh = Math.max(ih * v / mx, 1), r = sv('rect', { x:(L + iw * (j + .5) / n - bw / 2).toFixed(1), y:(T + ih - hh).toFixed(1), width:bw.toFixed(1), height:hh.toFixed(1), rx:2, fill:color }); var tt = sv('title'); tt.textContent = labels[j] + ': ' + fmt(v); r.appendChild(tt); s.appendChild(r); });
  var step = Math.ceil(n / 6);
  labels.forEach(function (l, j) { if (j % step === 0 || (j === n - 1 && n < 8)) { var t2 = sv('text', { x:(L + iw * (j + .5) / n).toFixed(1), y:H - 6, 'text-anchor':'middle', 'font-size':10.5, fill:'#6C757D' }); t2.textContent = l; s.appendChild(t2); } });
  return h('div', { class:'chart' }, [s]);
}

// ── 공통 조각 ──
function topbar() {
  return h('div', { class:'topin' }, [
    h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 은행' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function head(title, lead) { return [h('h1', { text:title }), lead ? h('p', { class:'lead', text:lead }) : null]; }
function go(v) { S.view = v; render(); try { M.scrollIntoView({ block:'start' }); } catch (e) {} }
function status() {
  if (S.st === 'load' || S.st === 'idle') return h('div', { class:'card rowf', role:'status', style:'margin-top:16px' }, [h('span', { class:'spin' }), h('span', { class:'sub', text:'불러오는 중…' })]);
  if (S.st === 'nologin') return h('div', { class:'note', role:'alert', style:'margin-top:16px', text:'GDC 정보를 읽으려면 나비웹에 로그인된 상태여야 합니다. 폰에서 나비웹에 로그인한 뒤 이 화면을 새로고침해 주세요.' });
  if (S.st === 'err') return h('div', { class:'note', role:'alert', style:'margin-top:16px' }, ['GDC 정보를 불러오지 못했습니다. ', btn('다시 시도', 'sm', function () { load(true); })]);
  if (S.errs.length) return h('div', { class:'note', style:'margin-top:16px', text:S.errs.join('·') + ' 정보를 불러오지 못했습니다. 나머지는 정상입니다.' });
  return null;
}
function soon(text) { return h('div', { class:'note info', style:'margin:16px 0', text:text }); }
function copyBtn(text, label) {
  var b = btn(label || '복사', 'sm quiet', function () {
    var ok = function () { b.textContent = '복사됨'; setTimeout(function () { b.textContent = label || '복사'; }, 1500); };
    try { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(ok, function () { b.textContent = text; }); } catch (e) { b.textContent = text; }
  }); return b;
}

// ── 내 지갑 ──
/** 내 재무제표(은행 장부): 현금 계정은 GDC 잔액과 같다. 나머지 계정은 세무 회계 화면이 남긴 거래 기록(일련번호·갱신일시)으로 채운다. */
function walletBook() {
  var recs = [], b = { '현금(GDC)':0, '상품(재고자산)':0, '부가세대급금':0, '비품':500000, '미지급금':0, '부가세예수금':0, '자본금':0, '이익잉여금':0, '매출':0 }, dCash = 0, marks = [];
  try { var v = JSON.parse(localStorage.getItem('navi-tax-v2') || 'null'); if (v && Array.isArray(v.rec)) recs = v.rec; } catch (e) { recs = []; }
  recs.forEach(function (r) {
    var mine = false;
    [r.buyer, r.seller].forEach(function (e) {
      if (!e || e.owner !== '나' || !Array.isArray(e.lines)) return; mine = true;
      e.lines.forEach(function (l) {
        var a = l[0]; if (!(a in b)) return;
        var dr = (a === '현금(GDC)' || a === '상품(재고자산)' || a === '부가세대급금' || a === '비품'), d = dr ? l[1] - l[2] : l[2] - l[1];
        b[a] += d; if (a === '매출') b['이익잉여금'] += d; if (a === '현금(GDC)') dCash += d;
      });
    });
    if (mine) marks.push((r.at || '갱신일시 기록 없음') + ' · ' + r.serial);
  });
  b['현금(GDC)'] = S.bal; b['자본금'] = (S.bal - dCash) + b['비품'];
  b.marks = marks; return b;
}
function stmtCard() {
  var head = [h('b', { text:'내 재무제표 — 은행 장부' })];
  if (S.bal === null) return h('div', { class:'card stmt cmp', id:'bnk-stmt' }, head.concat([h('div', { class:'sub', text:'잔액을 불러오면 재무제표가 나타나요.' })]));
  var b = walletBook();
  function row(a, val, cls) { return h('tr', { class:cls || '' }, [h('td', { text:a }), h('td', { class:'r num', text:won(val) })]); }
  function opt(a) { return b[a] ? row(a, b[a]) : null; }
  function col(title, rows, extra) { return h('div', { class:'stcol' }, [h('div', { class:'sth', text:title }), h('table', { class:'stbl' }, [h('tbody', {}, rows)])].concat(extra || [])); }
  var A = b['현금(GDC)'] + b['상품(재고자산)'] + b['부가세대급금'] + b['비품'], L = b['미지급금'] + b['부가세예수금'], E = b['자본금'] + b['이익잉여금'], ok = A === L + E;
  var last = b.marks.length ? '최근 반영: ' + b.marks.slice(0, 2).join(' · ') : '아직 반영된 거래가 없어요. 세무 회계에서 전표를 처리하면 이어서 반영돼요.';
  return h('div', { class:'card stmt cmp', id:'bnk-stmt' }, head.concat([
    h('div', { class:'sub', text:'현금 계정은 위의 GDC 잔액과 같아요(= 은행 잔고). 모든 수치는 오픈해시와 거래 이력 기록으로 위·변조할 수 없어서, 이 재무제표가 곧 은행 장부예요.' }),
    h('div', { class:'stgrid' }, [
      col('대차대조표 · 자산', [row('현금(GDC)', b['현금(GDC)'], 'hl'), opt('상품(재고자산)'), opt('부가세대급금'), row('비품', b['비품']), row('자산 합계', A, 'tot')]),
      col('부채와 자본', [opt('미지급금'), opt('부가세예수금'), row('자본금', b['자본금']), opt('이익잉여금'), row('부채·자본 합계', L + E, 'tot')], [h('div', { class:'sub stok', text:ok ? '대차가 맞아요' : '대차가 맞지 않아요' })]),
      col('손익계산서', [row('매출', b['매출']), row('당기 순이익', b['매출'], 'tot')], [h('div', { class:'sub', text:last })])])]));
}
function viewWallet() {
  var kids = head('내 지갑', 'GDC 잔액과 사용 현황을 한눈에 봅니다. GDC는 나비 안에서 현금처럼 쓰입니다.'), st = status(); if (st) kids.push(st);
  var low = S.bal != null && S.bal <= LOW;
  var hero = h('div', { class:'card hero col cmp', style:'margin-top:12px' }, [
    h('div', { class:'sub', text:'GDC 잔액' }),
    h('div', { class:'amt num', id:'bnk-bal' }, [S.bal == null ? '—' : won(S.bal), h('small', { text:'GDC' })]),
    low ? h('div', { class:'sub', text:'잔액이 ' + won(LOW) + ' GDC 이하입니다. 충전을 권해 드려요.' }) : null,
    h('div', { class:'rowf', style:'margin-top:6px' }, [btn('충전하기', 'white', function () { go('topup'); }), btn('송금·결제', 'ghost', function () { go('pay'); }), btn('은행 AI에게 묻기', 'ghost', function () { ask('내 GDC 잔액과 사용 현황을 설명해 주세요'); })])]);
  kids.push(hero);
  var q = S.quota, tiles = [h('div', { class:'tile' }, [h('div', { class:'k', text:'지금까지 쓴 금액' }), h('div', { class:'v num', text:q ? won(q.spent_krw) + '원' : '—' })])];
  var mb = monthBill(); tiles.push(h('div', { class:'tile' }, [h('div', { class:'k', text:'이번 달 청구액' }), h('div', { class:'v num', text:mb ? won(mb.krw) + '원' : '—' })]));
  var r7 = rowsOf('7'); tiles.push(h('div', { class:'tile' }, [h('div', { class:'k', text:'최근 7일 API 요청' }), h('div', { class:'v num', text:r7 ? won(sum(r7.rows, 'req')) : '—' })]));
  kids.push(h('div', { class:'g4 cmp', style:'margin-top:8px' }, tiles)); kids.push(stmtCard()); var pair = [];
  if (q) {
    var pct = Math.min(Math.round(q.spent_krw / (q.limit_krw || 1) * 100), 100), msg = '';
    if (q.estimated_monthly_krw > 0) { msg = '지금 쓰시는 속도라면 한 달에 대략 ' + won(q.estimated_monthly_krw) + '원 정도예요.'; if (q.remaining_krw <= 0) msg += ' 가입 무료 한도를 모두 사용했어요.'; else if (q.projected_days_to_limit != null && q.projected_days_to_limit > 0) msg += ' 이 속도라면 약 ' + q.projected_days_to_limit + '일 후 무료 한도를 다 쓰게 돼요.'; }
    else msg = '아직 대화를 시작하기 전이에요.';
    pair.push(h('div', { class:'card col cmp' }, [h('b', { text:'가입 무료 한도 사용 현황' }),
      h('div', { class:'meter8 ' + (pct >= 90 ? 'bad' : ''), role:'progressbar', 'aria-valuemin':'0', 'aria-valuemax':'100', 'aria-valuenow':String(pct) }, [h('i', { style:'width:' + pct + '%' })]),
      h('div', { text:won(q.spent_krw) + '원 / ' + won(q.limit_krw) + '원 (' + pct + '%)' }), h('div', { class:'sub', text:msg })]));
  }
  if (S.series) { var d = S.series.daily.slice(-30); pair.push(h('div', { class:'card col cmp' }, [h('div', { class:'rowf', style:'justify-content:space-between' }, [h('b', { text:'최근 30일 청구액(원)' }), btn('거래 내역 보기', 'sm quiet', function () { go('history'); })]), bars(d.map(function (r) { return r.krw || 0; }), d.map(function (r) { return r.d.slice(5); }), 'var(--pri)', short)])); }
  if (pair.length) kids.push(h('div', { class:'g2 eq cmp', style:'margin-top:8px' }, pair));
  kids.push(h('h2', { text:'은행 서비스' }));
  var svc = [['충전·입금', '계좌 입금으로 GDC를 채우고 요금제를 확인합니다.', 'topup', '충전하기'], ['송금·결제', '나비 코드(10자리)로 GDC를 주고받습니다.', 'pay', '송금·결제'], ['거래 내역', '충전·사용 내역과 이번 달 청구서를 봅니다.', 'history', '내역 보기'], ['예금·대출', 'GDC 예치, 대출, 자동 상환(설계 단계).', 'save', '자세히'], ['신용·채권', '재무제표 기반 신용 등급과 채권 POOL(개념 시연).', 'credit', '자세히']];
  kids.push(h('div', { class:'g3' }, svc.map(function (x) { return h('div', { class:'card cc' }, [h('div', { class:'nm', text:x[0] }), h('div', { class:'sub', text:x[1] }), h('div', { class:'rowf', style:'margin-top:auto' }, [btn(x[3], 'sm', function () { go(x[2]); })])]); })));
  kids.push(h('div', { class:'foot', text:'GDC는 나비 안에서는 현금처럼 쓰이지만, 환전과 외부 사용에는 별도 규칙이 있습니다. 잔액·한도·사용 내역은 서버에서 읽어 온 값이며, 이 화면은 읽기 전용입니다.' }));
  return kids;
}

// ── 충전·입금 ──
function viewTopup() {
  var kids = head('충전·입금', 'GDC는 계좌 입금으로 채웁니다. 카드 자동결제 같은 정기결제는 없습니다.'), st = status(); if (st) kids.push(st);
  var acct = h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'입금 계좌 (지정 계좌 입금만 가능)' }),
    h('div', {}, [h('div', { class:'kv' }, [h('span', { text:'입금 은행' }), h('b', { text:ACCT.bank })]), h('div', { class:'kv' }, [h('span', { text:'계좌번호' }), h('b', {}, [h('span', { class:'num', text:ACCT.no, style:'color:var(--on)' }), copyBtn(ACCT.no)])]), h('div', { class:'kv' }, [h('span', { text:'예금주' }), h('b', { text:ACCT.holder })])]),
    h('div', { class:'sub', text:'나비는 정기 자동결제를 쓰지 않습니다. 사용자가 직접 은행 앱에서 계좌이체를 할 때만 적용되며, 이체 뒤 추가로 자동 청구되는 금액은 없습니다.' })]);
  var how = h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'충전 순서' }),
    h('div', {}, [['입금자명을 가입한 이름과 같게', '신청서 없이 지정 계좌로 원하는 금액을 바로 입금합니다. 띄어쓰기는 달라도 됩니다.'], ['입금 알림으로 자동 확인', '입금되면 은행 알림이 서버로 전달되어 입금자 이름으로 내 계정을 찾아 충전합니다. 보통 몇 분 안에 끝납니다.'], ['GDC 발행', '입금액과 1:1 비율로 GDC가 지갑에 들어옵니다(예: 1,000원 = 1,000 GDC. 테스트 기간 기준이며 바뀔 수 있습니다).']].map(function (x, i) { return h('div', { class:'stp' }, [h('i', { text:String(i + 1) }), h('div', {}, [h('b', { text:x[0] }), h('span', { text:x[1] })])]); })),
    h('div', { class:'note', text:'같은 이름의 가입자가 둘 이상이면 자동 처리되지 않고 관리자가 확인한 뒤 충전합니다.' })]);
  kids.push(h('div', { class:'g2 eq' }, [acct, how]));
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('요금제 열기', 'fill', function () { if (S.onPlans) S.onPlans(); })]));
  var ch = S.charges || [], list = h('div', { class:'card', style:'margin-top:16px;padding:8px 24px' });
  list.appendChild(h('div', { style:'padding:12px 0 4px' }, [h('b', { style:'font-size:17px', text:'충전 내역' }), h('div', { class:'sub', text:'최근 20건' })]));
  if (!ch.length) list.appendChild(h('div', { class:'empty', text:S.st === 'ok' || S.st === 'err' ? '아직 충전 내역이 없어요.' : '불러오는 중…' }));
  ch.forEach(function (r) { list.appendChild(h('div', { class:'row' }, [h('div', { style:'flex:1;min-width:160px' }, [h('b', { class:'num', text:won(r.requested_krw) + '원' }), r.created_at || r.ts ? h('div', { class:'sub', text:String(r.created_at || r.ts).slice(0, 16).replace('T', ' ') }) : null]), pill(CHG[r.status] || String(r.status || ''), r.status === 'matched' ? 'm' : r.status === 'pending' ? 'l' : '')])); });
  kids.push(list);
  return kids;
}

// ── 송금·결제 ──
function payErr() {
  var p = S.pay, e = {};
  if (p.code && !/^\d{10}$/.test(p.code)) e.code = '나비 코드는 숫자 10자리입니다.';
  if (p.amt !== '') { var a = Number(p.amt); if (!(a > 0) || Math.floor(a) !== a) e.amt = '1 이상의 정수로 적어 주세요.'; else if (S.bal != null && a > S.bal) e.amt = '잔액(' + won(S.bal) + ' GDC)보다 큽니다.'; }
  return e;
}
function payOk() { var p = S.pay, e = payErr(); return /^\d{10}$/.test(p.code) && p.amt !== '' && !e.amt && !e.code; }
function payText() { var p = S.pay; return '코드 ' + p.code + ' · ' + won(p.amt) + ' GDC' + (p.memo ? ' · ' + p.memo : ''); }
function openPayDlg() {
  var d = $('bnk-dlg'), ov = $('bnk-ov'); d.textContent = '';
  [h('b', { style:'font-size:20px', text:'결제 내용 확인' }),
   h('div', { style:'margin-top:12px' }, [h('div', { class:'kv' }, [h('span', { text:'나비 코드' }), h('b', { class:'num code', text:S.pay.code })]), h('div', { class:'kv' }, [h('span', { text:'금액' }), h('b', { class:'num', text:won(S.pay.amt) + ' GDC' })]), h('div', { class:'kv' }, [h('span', { text:'품목/메모' }), h('b', { text:S.pay.memo || '—' })])]),
   h('div', { class:'note', style:'margin-top:12px', text:'이 화면은 돈을 보내지 않습니다. 폰의 나비웹 앱 왼쪽 메뉴 “코드로 결제”에서 같은 값을 넣고 결제하세요. 보내기 전에 코드 10자리와 금액을 다시 확인하세요. 잘못 보낸 이체를 되돌리는 방법은 확인되지 않았습니다.' }),
   h('div', { class:'rowf', style:'justify-content:flex-end;margin-top:20px' }, [copyBtn(payText(), '내용 복사'), btn('닫기', 'fill', closeDlg)])
  ].forEach(function (x) { d.appendChild(x); }); ov.hidden = false;
}
function closeDlg() { var o = $('bnk-ov'); if (o) o.hidden = true; }
function field(id, label, val, o) {
  var e = o.err, inp = h('input', { id:id, type:'text', value:val, placeholder:o.ph || '', maxlength:o.max || '', inputmode:o.mode || '', autocomplete:'off', 'aria-invalid':e ? 'true' : 'false', 'aria-describedby':id + '-h', class:o.cls || '' });
  inp.oninput = function () { o.set(inp.value); var f = payOk(); var b = $('bnk-pay-go'); if (b) b.disabled = !f; var er = $(id + '-h'); var ee = payErr()[o.key]; if (er) { er.className = ee ? 'err' : 'help'; er.textContent = ee || o.help; } inp.setAttribute('aria-invalid', ee ? 'true' : 'false'); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), inp, h('div', { id:id + '-h', class:e ? 'err' : 'help', text:e || o.help })]);
}
function viewPay() {
  var kids = head('송금·결제', '나비 코드(10자리)로 GDC를 주고받습니다. 카드 수수료가 없는 GDC 지갑 간 직접 이체입니다.'), st = status(); if (st) kids.push(st);
  kids.push(soon('실제 결제는 폰의 나비웹 앱에서 합니다. 이 화면은 코드·금액을 미리 확인해 두는 용도이며 돈이 움직이지 않습니다.'));
  var er = payErr(), p = S.pay;
  var f1 = h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'결제하기 (사는 사람)' }),
    field('bnk-code', '나비 코드 (10자리)', p.code, { key:'code', err:er.code, ph:'0000000000', max:10, mode:'numeric', cls:'code', help:'판매자가 보여 준 코드입니다.', set:function (v) { S.pay.code = v.replace(/\D/g, ''); } }),
    field('bnk-amt', '결제 금액 (GDC)', p.amt, { key:'amt', err:er.amt, ph:'15000', mode:'numeric', help:S.bal != null ? '내 잔액 ' + won(S.bal) + ' GDC' : '정수로 적어 주세요.', set:function (v) { S.pay.amt = v.replace(/[^\d]/g, ''); } }),
    h('div', { class:'field' }, [h('label', { for:'bnk-memo', text:'품목/메모 (선택)' }), (function () { var i = h('input', { id:'bnk-memo', type:'text', value:p.memo, placeholder:'예: 아메리카노 2잔', maxlength:'60', autocomplete:'off' }); i.oninput = function () { S.pay.memo = i.value; }; return i; })()]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [(function () { var b = btn('내용 확인하기', 'fill', openPayDlg); b.id = 'bnk-pay-go'; b.disabled = !payOk(); return b; })(), btn('지우기', 'quiet', function () { S.pay = { code:'', amt:'', memo:'' }; render(); })]),
    h('div', { class:'sub', text:'일정 금액 미만(기본 1만 원)은 지문 없이 바로 결제되고, 그 이상은 지문(또는 Face ID)으로 한 번 더 확인합니다. 기준 금액은 설정에서 조정합니다.' })]);
  var f2 = h('div', { class:'col', style:'gap:16px' }, [
    h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'결제받기 (파는 사람)' }),
      h('div', {}, [['폰에서 결제받기 열기', '폰의 나비웹 앱 왼쪽 메뉴에서 “결제받기(내 코드)”를 엽니다.'], ['내 코드 보여 주기', '화면에 내 코드가 나타납니다. 상호명(선택)을 적고 손님께 코드를 보여 줍니다.'], ['입금 확인', '손님이 결제하면 내 GDC 잔액이 늘고, 거래 내역에 남습니다.']].map(function (x, i) { return h('div', { class:'stp' }, [h('i', { text:String(i + 1) }), h('div', {}, [h('b', { text:x[0] }), h('span', { text:x[1] })])]); }))]),
    h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'보내기 전에 확인하세요' }),
      h('ul', { style:'padding-left:20px;font-size:14px;display:flex;flex-direction:column;gap:6px' }, ['코드 10자리와 금액을 눈으로 한 번 더 확인합니다.', '새 가게에서는 판매자 이름이 맞는지 보고 보냅니다.', '잘못 보낸 이체를 되돌리는 방법은 확인되지 않았습니다.', '연습할 때는 1 GDC처럼 아주 작은 금액으로 합니다.'].map(function (t) { return h('li', { text:t }); }))])]);
  kids.push(h('div', { class:'g2' }, [f1, f2]));
  return kids;
}

// ── 거래 내역 ──
function viewHistory() {
  var kids = head('거래 내역', '충전과 사용 내역, 이번 달 청구서를 모았습니다.'), st = status(); if (st) kids.push(st);
  kids.push(h('div', { class:'rowf noprint', style:'margin-top:16px' }, [h('div', { class:'seg', role:'group', 'aria-label':'기간' }, RANGES.map(function (r) { return h('button', { type:'button', 'aria-pressed':String(S.range === r[0]), text:r[1], onclick:function () { S.range = r[0]; render(); } }); }))]));
  var R = rowsOf(S.range);
  if (!R) kids.push(h('div', { class:'card', style:'margin-top:16px' }, [h('div', { class:'empty', text:S.st === 'ok' || S.st === 'err' || S.st === 'nologin' ? '사용 내역이 아직 없어요. 서비스 도입 초기라 기록이 없을 수 있어요.' : '불러오는 중…' })]));
  else {
    var krw = sum(R.rows, 'krw'), req = sum(R.rows, 'req'), tok = sum(R.rows, 'tok'), delta = '';
    if (R.prev && krw + (R.prev.krw || 0) > 0) { var b = R.prev.krw || 0, df = krw - b; delta = b > 0 ? R.prevName + '(' + won(b) + '원)보다 ' + won(Math.abs(df)) + '원 ' + (df >= 0 ? '많이' : '적게') + ' 썼어요 (' + (df >= 0 ? '+' : '−') + Math.abs(Math.round(df / b * 100)) + '%).' : R.prevName + '에는 사용 내역이 없었어요.'; }
    kids.push(h('div', { class:'g4', style:'margin-top:16px' }, [['청구액', won(krw) + '원'], ['API 요청', won(req)], ['토큰', won(tok)]].map(function (x) { return h('div', { class:'tile' }, [h('div', { class:'k', text:x[0] }), h('div', { class:'v num', text:x[1] })]); })));
    if (delta) kids.push(h('div', { class:'sub', style:'margin-top:8px', text:delta }));
    if (!req) kids.push(h('div', { class:'card', style:'margin-top:16px' }, [h('div', { class:'empty', text:'이 기간의 사용 내역이 없어요.' })]));
    else {
      var tot = svcTotals(R.rows), keys = Object.keys(tot), byKrw = keys.some(function (k) { return tot[k].krw > 0; }), met = byKrw ? 'krw' : 'req';
      keys.sort(function (a, c) { return tot[c][met] - tot[a][met]; });
      var all = keys.reduce(function (a, k) { return a + tot[k][met]; }, 0) || 1;
      kids.push(h('div', { class:'g2' }, [
        h('div', { class:'card col' }, [h('div', { class:'rowf', style:'justify-content:space-between' }, [h('b', { text:'청구액(원)' }), h('span', { class:'sub', text:S.range === 'today' ? '시간별' : S.range === '90' ? '주별' : '일별' })]), bars(R.rows.map(function (r) { return r.krw || 0; }), R.lab, 'var(--pri)', short)]),
        h('div', { class:'card col' }, [h('b', { text:'어디에 썼나요?' }), h('div', { class:'sub', text:'사용 분야별 ' + (byKrw ? '청구액' : '요청 수') }), h('div', { class:'fld' }, keys.map(function (k, j) { var v = tot[k], pc = Math.round(v[met] / all * 100); return h('div', {}, [h('div', { class:'top' }, [h('span', { class:'dot', style:'background:' + COL[j % COL.length] }), h('b', { text:svcName(k) }), h('span', { class:'v', text:(byKrw ? won(v.krw) + '원' : won(v.req) + '건') + ' · ' + pc + '%' })]), h('div', { class:'meter' }, [h('i', { style:'width:' + pc + '%;background:' + COL[j % COL.length] })])]); }))])]));
    }
  }
  var mb = monthBill();
  var bill = h('div', { class:'card col', style:'margin-top:16px' }, [h('div', { class:'rowf', style:'justify-content:space-between' }, [h('b', { style:'font-size:17px', text:mb ? mb.ym.replace('-', '년 ') + '월 청구서' : '이번 달 청구서' }), h('span', { class:'noprint' }, [btn('인쇄 · PDF 저장', 'sm quiet', function () { try { window.print(); } catch (e) {} })])])]);
  if (!mb || !mb.req) bill.appendChild(h('div', { class:'empty', text:'이번 달 사용 내역이 아직 없어요.' }));
  else { Object.keys(mb.svc).sort(function (a, c) { return mb.svc[c].krw - mb.svc[a].krw; }).forEach(function (k) { bill.appendChild(h('div', { class:'kv' }, [h('span', { text:svcName(k) }), h('b', { class:'num', text:won(mb.svc[k].krw) + '원' })])); }); bill.appendChild(h('div', { class:'kv' }, [h('span', { text:'합계' }), h('b', { class:'num', text:won(mb.krw) + '원' })])); }
  bill.appendChild(h('div', { class:'sub', text:'청구액은 서비스 이용료(사용한 만큼 차감)입니다. 월 기본료는 없습니다.' }));
  kids.push(bill);
  var bm = S.usage && S.usage.by_model;
  if (bm && bm.length) kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('div', { class:'rowf', style:'justify-content:space-between' }, [h('b', { text:'모델별 사용 내역' }), h('span', { class:'sub', text:'최근 90일' })]), h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, [h('th', { text:'모델' }), h('th', { class:'r', text:'요청 수' }), h('th', { class:'r', text:'토큰' }), h('th', { class:'r', text:'청구액' })])]), h('tbody', {}, bm.map(function (m) { return h('tr', {}, [h('td', { text:m.model }), h('td', { class:'r', text:won(m.requests) }), h('td', { class:'r', text:won((m.hit_tokens || 0) + (m.miss_tokens || 0) + (m.out_tokens || 0)) }), h('td', { class:'r', text:won(m.billed_krw) + '원' })]); }))])])]));
  var ch = S.charges || [];
  kids.push(h('div', { class:'card', style:'margin-top:16px;padding:8px 24px' }, [h('div', { style:'padding:12px 0 4px' }, [h('b', { style:'font-size:17px', text:'충전 내역' }), h('div', { class:'sub', text:'최근 20건' })])].concat(ch.length ? ch.map(function (r) { return h('div', { class:'row' }, [h('b', { class:'num', style:'flex:1;min-width:120px', text:won(r.requested_krw) + '원' }), pill(CHG[r.status] || String(r.status || ''), r.status === 'matched' ? 'm' : r.status === 'pending' ? 'l' : '')]); }) : [h('div', { class:'empty', text:'아직 충전 내역이 없어요.' })])));
  kids.push(h('div', { class:'foot', text:'GDC 사용 내역은 서버 기록이며, 사용자 간 거래의 거래명세서는 내 데이터 금고(PDV)에 남습니다.' }));
  return kids;
}

// ── 예금·대출 ──
function calcCard() {
  var c = S.calc, out = calc(c.kind, c.p, c.r, c.m), save = c.kind === 'save';
  var res = h('div', { id:'bnk-calc-out', class:'col', style:'gap:0;margin-top:8px', 'aria-live':'polite' });
  function paint() {
    var o = calc(S.calc.kind, S.calc.p, S.calc.r, S.calc.m), sv2 = S.calc.kind === 'save'; res.textContent = '';
    if (!o) { res.appendChild(h('div', { class:'sub', text:'원금·연 이율·기간을 모두 적으면 계산 결과가 나옵니다.' })); return; }
    if (!sv2) res.appendChild(h('div', { class:'kv' }, [h('span', { text:'매월 상환액' }), h('b', { class:'num', text:won(o.monthly) + ' GDC' })]));
    res.appendChild(h('div', { class:'kv' }, [h('span', { text:sv2 ? '만기 이자(단리)' : '총 이자' }), h('b', { class:'num', text:won(o.interest) + ' GDC' })]));
    res.appendChild(h('div', { class:'kv' }, [h('span', { text:sv2 ? '만기 금액' : '총 상환액' }), h('b', { class:'num', text:won(o.total) + ' GDC' })]));
  }
  function num(id, label, key, ph, help) { var i = h('input', { id:id, type:'text', value:c[key], placeholder:ph, inputmode:'decimal', autocomplete:'off' }); i.oninput = function () { S.calc[key] = i.value.replace(/[^\d.]/g, ''); paint(); }; return h('div', { class:'field' }, [h('label', { for:id, text:label }), i, help ? h('div', { class:'help', text:help }) : null]); }
  var card = h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'이자 계산기' }), h('div', { class:'sub', text:'연 이율은 직접 넣는 값입니다. 실제 상품의 이율이 아니며, 대출은 원리금균등 상환으로 계산합니다.' }),
    h('div', { class:'seg', style:'align-self:flex-start;margin-top:8px', role:'group', 'aria-label':'계산 종류' }, [['save', '예치'], ['loan', '대출']].map(function (k) { return h('button', { type:'button', 'aria-pressed':String(c.kind === k[0]), text:k[1], onclick:function () { S.calc.kind = k[0]; render(); } }); })),
    num('bnk-c-p', save ? '예치 원금 (GDC)' : '대출 원금 (GDC)', 'p', '1000000'), num('bnk-c-r', '연 이율 (%)', 'r', '3.5', '예: 3.5'), num('bnk-c-m', '기간 (개월)', 'm', '12', '1~600개월'), res]);
  paint(); return card;
}
function viewSave() {
  var kids = head('예금·대출', '신용 평가와 채권 이자율 체계를 기반으로, 예금·대출이 자동으로 처리되도록 설계되어 있습니다.');
  kids.push(soon('아직 설계 단계입니다. 실제 예치·대출 신청과 자금 이동은 아직 할 수 없고, 아래 계산기는 직접 넣은 이율로 계산만 합니다.'));
  var items = [['GDC 예치', '여유 자금을 예치하면 정해진 이자를 받습니다.', '예치하면 얼마를 받나요?'], ['대출 신청', '필요 자금을 신청하면 내 신용 등급의 이자율이 자동 적용됩니다.', '대출을 받으려면 어떻게 하나요?'], ['자동 상환 관리', '상환 일정과 이자 계산이 자동으로 관리됩니다.', '상환 일정은 어떻게 관리되나요?']];
  kids.push(h('div', { class:'g3' }, items.map(function (x) { return h('div', { class:'card cc' }, [h('div', { class:'rowf', style:'justify-content:space-between' }, [h('div', { class:'nm', text:x[0] }), pill('준비 중', 'l')]), h('div', { class:'sub', text:x[1] }), h('div', { class:'rowf', style:'margin-top:auto' }, [btn('은행 AI에게 묻기', 'sm quiet', function () { ask(x[2]); })])]); })));
  kids.push(h('div', { class:'note info', style:'margin-top:16px', text:'서류 심사가 필요한가요? 별도 서류 없이, 이미 쌓인 재무제표와 신용 등급으로 처리하도록 설계되었습니다. 큰 금액은 추가 확인이 있을 수 있습니다.' }));
  kids.push(calcCard());
  return kids;
}

// ── 신용·채권 ──
function viewCredit() {
  var kids = head('신용·채권', '재무제표와 나비 온도로 신용 등급을 정하고, 등급에 따라 채권 이자율이 정해집니다.');
  kids.push(soon('개념 시연입니다. 라이선스 컨소시엄 이전이 끝나기 전까지 실제 자금이 오가지 않으며, 실제 투자·발행은 아직 할 수 없습니다.'));
  kids.push(h('h2', { text:'신용 등급은 이렇게 정해집니다', style:'margin-top:8px' }));
  var st = [['재무 데이터 분석', '자동 생성된 재무제표에서 매출 안정성·거래 빈도·수익성을 AI가 분석합니다.'], ['나비 온도 반영', '거래 신뢰도(나비 온도)도 신용 평가에 함께 반영됩니다.'], ['등급 산정과 이자율', '종합 점수로 등급이 정해지고, 신용이 높을수록 낮은 이자율로 자금을 조달합니다.']];
  kids.push(h('div', { class:'g3' }, st.map(function (x, i) { return h('div', { class:'card cc' }, [h('div', { class:'rowf' }, [h('span', { class:'pill p', text:String(i + 1) }), h('div', { class:'nm', text:x[0] })]), h('div', { class:'sub', text:x[1] })]); })));
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { text:'내 신용 등급' }), h('div', { class:'empty', text:'아직 표시할 등급이 없습니다. 재무제표가 쌓이고 평가가 열리면 이곳에 나타납니다.' }), h('div', { class:'rowf' }, [btn('은행 AI에게 묻기', 'sm quiet', function () { ask('제 신용 등급은 어떻게 정해지나요?'); })])]));
  kids.push(h('h2', { text:'채권 POOL — 위험을 나누는 방법' }));
  kids.push(h('div', { class:'sub', style:'margin:-6px 0 12px', text:'한 사람의 채권에 몰아 투자하지 않고 여러 발행자를 묶은 POOL에 투자해, 한 명이 부도나도 영향을 줄입니다. 범위가 넓을수록 위험이 줄고 이자율은 낮아집니다.' }));
  var pools = [['한림읍 POOL', '발행자 18명', '위험 매우 높음', 92, 'bad', '이자율 높음', 88], ['글로벌 POOL', '발행자 230만 명', '위험 최소', 8, 'ok', '이자율 낮음', 14]];
  kids.push(h('div', { class:'g2', style:'grid-template-columns:repeat(auto-fit,minmax(280px,1fr));margin-top:0' }, pools.map(function (p) { return h('div', { class:'card col' }, [h('div', { class:'rowf', style:'justify-content:space-between' }, [h('b', { style:'font-size:17px', text:p[0] }), pill(p[1])]), h('div', { class:'sub', text:'위험 · ' + p[2] }), h('div', { class:'meter8 ' + p[4], role:'img', 'aria-label':p[2] }, [h('i', { style:'width:' + p[3] + '%' })]), h('div', { class:'sub', text:p[5] }), h('div', { class:'meter8', role:'img', 'aria-label':p[5] }, [h('i', { style:'width:' + p[6] + '%' })])]); })));
  kids.push(h('div', { class:'foot', text:'막대는 위험과 이자율의 방향을 비교하기 위한 개념도이며 실제 수치가 아닙니다. 재무제표 기반 신용평가·분산 검증은 특허 출원 문서에 설계된 개념을 바탕으로 미리 보여 드리는 것입니다.' }));
  return kids;
}

// ── 그리기·진입 ──
function render() {
  var root = $('bnk-root'), tp = $('bnk-top'); if (!root || !tp) return;
  root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var f = S.view === 'topup' ? viewTopup : S.view === 'pay' ? viewPay : S.view === 'history' ? viewHistory : S.view === 'save' ? viewSave : S.view === 'credit' ? viewCredit : viewWallet;
  f().forEach(function (k) { if (k) root.appendChild(k); });
  emit('state', { view:S.view, balance:S.bal, status:S.st });
}
function reply(ok, msg) { emit('result', { ok:ok, msg:msg, view:S.view }); }
/** 밖(대화창·칩)에서 화면을 옮기는 조작. 돈을 옮기는 조작은 없다 — 송금은 값을 채워 두기만 한다. */
function nav(a) {
  var d = a && typeof a['do'] === 'string' ? a['do'] : '';
  if (VIEWS.indexOf(d) < 0) return reply(false, '지원하지 않는 요청입니다.');
  if (d === 'history' && a.range && RANGES.some(function (r) { return r[0] === String(a.range); })) S.range = String(a.range);
  if (d === 'pay') { if (a.code != null) S.pay.code = String(a.code).replace(/\D/g, '').slice(0, 10); if (a.amount != null) S.pay.amt = String(a.amount).replace(/[^\d]/g, ''); if (a.memo != null) S.pay.memo = String(a.memo).slice(0, 60); }
  go(d); reply(true, TABS.filter(function (t) { return t[0] === d; })[0][1] + ' 화면으로 이동했습니다.' + (d === 'pay' ? ' 이 화면은 값을 확인만 하며, 결제는 폰 앱에서 직접 해 주세요.' : ''));
}
function mount(el, o) {
  if (!el) return; o = o || {};
  M = el; el.textContent = ''; el.classList.add('bnk');
  S.guid = o.guid || ''; S.proxy = o.proxy || ''; S.fetch = o.fetch || null; S.onPlans = o.onPlans || null; S.plans = o.plans || null; S.st = 'idle'; S.at = 0;
  var ov = h('div', { class:'ov', id:'bnk-ov', hidden:'hidden', role:'dialog', 'aria-modal':'true', 'aria-label':'결제 내용 확인' }, [h('div', { class:'dlg', id:'bnk-dlg' })]);
  [h('div', { id:'bnk-top' }), h('div', { class:'wrap', id:'bnk-root' }), ov].forEach(function (x) { el.appendChild(x); });
  ov.addEventListener('click', function (e) { if (e.target === ov) closeDlg(); });
  if (!mount.esc) { mount.esc = true; document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDlg(); }); }
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'wallet';
  render(); load(true);
}
window.NaviBank = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v, o) { if (M && VIEWS.indexOf(v) >= 0) { if (o && o.guid) S.guid = o.guid; go(v); load(false); } },
  refresh:function () { if (M) load(true); },
  calc:calc,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
