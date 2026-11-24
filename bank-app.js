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
var S = { view:'wallet', guid:'', proxy:'', fetch:null, st:'idle', at:0, bal:null, quota:null, usage:null, series:null, charges:null, errs:[], range:'7', pay:{ code:'', amt:'', memo:'' }, sim:false, hsim:false, hseed:1, csim:false, cstep:1, cseed:1, lsim:false, lseed:1, calc:{ kind:'save', p:'', r:'', m:'12' }, onPlans:null, plans:null };

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
    if (S.bal !== null && window.NaviLedger) NaviLedger.saveWallet(S.bal);   // 세무·증권 화면이 "나"의 현금 계정을 은행 잔고와 같게 쓰도록 남겨 둔다
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
  var NL = window.NaviLedger; if (!NL) return null;   // 공통 장부(ledger-book.js)가 없으면 재무제표를 만들지 않는다
  return NL.walletBook(NL.recs(), S.bal);
}
function stmtCard() {
  var head = [h('b', { text:'내 재무제표 — 은행 장부' })];
  if (S.bal === null) return h('div', { class:'card stmt cmp', id:'bnk-stmt' }, head.concat([h('div', { class:'sub', text:'잔액을 불러오면 재무제표가 나타나요.' })]));
  var b = walletBook(); if (!b) return h('div', { class:'card stmt cmp', id:'bnk-stmt' }, head.concat([h('div', { class:'sub', text:'장부 모듈을 불러오지 못해 재무제표를 보여 드릴 수 없어요. 새로고침해 주세요.' })]));
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
// ── 송금·결제 시뮬레이션: 가상 판매자·구매자 재무제표가 구매 즉시 바뀌는 모습(실제 돈·실제 장부와 무관한 연습용 값) ──
var SIM = { item:'원두 10봉', amt:15000,
  buyer:{ name:'가상 구매자 (작은 카페)', role:'구매자', bs:[['현금(GDC)', 200000, 185000], ['상품(재고자산)', 50000, 65000]], eq:[['자본금', 250000, 250000]], pl:null },
  seller:{ name:'가상 판매자 (해든 로스터리)', role:'판매자', bs:[['현금(GDC)', 500000, 515000], ['상품(재고자산)', 100000, 91000]], eq:[['자본금', 500000, 500000], ['이익잉여금', 100000, 106000]], pl:[['매출', 0, 15000], ['매출원가', 0, 9000], ['순이익', 0, 6000]] } };
function simCol(p) {
  var n = 0;
  function sg(v) { return v ? (v > 0 ? '+' : '−') + won(Math.abs(v)) : ''; }
  function tr(a, x, y, cls) { var dl = y - x; if (dl && !cls) n++; return h('tr', { class:cls || (dl ? 'hl' : 'dim') }, [h('td', { text:a }), h('td', { class:'r num', text:won(x) }), h('td', { class:'r num', text:won(y) }), h('td', { class:'r num chg' + (dl < 0 ? ' neg' : ''), text:sg(dl) })]); }
  function sec(t) { return h('tr', { class:'sec' }, [h('td', { text:t, colspan:'4' })]); }
  function sum(a, list) { var x = 0, y = 0; list.forEach(function (r) { x += r[1]; y += r[2]; }); return [tr(a, x, y, 'sum'), x, y]; }
  var rows = [h('tr', { class:'sec' }, [h('td', { text:'대차대조표' }), h('td', { class:'r', text:'구매 전' }), h('td', { class:'r', text:'구매 후' }), h('td', { class:'r', text:'바뀐 만큼' })])];
  rows.push(sec('자산')); p.bs.forEach(function (r) { rows.push(tr(r[0], r[1], r[2])); });
  var A = sum('자산 합계', p.bs); rows.push(A[0]);
  rows.push(sec('자본')); p.eq.forEach(function (r) { rows.push(tr(r[0], r[1], r[2])); });
  var E = sum('자본 합계', p.eq); rows.push(E[0]);
  if (p.pl) { rows.push(sec('손익계산서')); p.pl.forEach(function (r) { rows.push(tr(r[0], r[1], r[2])); }); }
  var ok = A[1] === E[1] && A[2] === E[2];
  return h('div', { class:'stcol', id:'bnk-sim-' + (p.role === '구매자' ? 'buyer' : 'seller') }, [h('div', { class:'sth', text:p.role + ' — ' + p.name }), h('table', { class:'stbl' }, [h('tbody', {}, rows)]),
    h('div', { class:'sub' }, [h('span', { class:'stok', text:ok ? '대차가 맞아요' : '대차가 안 맞아요' }), h('span', { text:' · 바뀐 줄 ' + n + '개' + (p.pl ? '' : ' · 손익계산서는 변동 없어요(재고만 바뀜)') })])]);
}
function simCard() {
  var on = S.sim, b = btn(on ? '시뮬레이션 닫기' : '시뮬레이션', on ? 'quiet' : 'fill', function () { S.sim = !S.sim; render(); }); b.id = 'bnk-sim-go';
  var kids = [h('div', { class:'rowf', style:'justify-content:space-between;align-items:center;gap:12px' }, [h('div', {}, [h('b', { style:'font-size:17px', text:'시뮬레이션 — 물건을 사는 즉시 두 재무제표가 바뀌어요' }), h('div', { class:'sub', text:'가상의 판매자와 구매자로 보여 주는 연습입니다. 실제 돈과 내 장부는 바뀌지 않아요.' })]), b])];
  if (on) {
    kids.push(h('div', { class:'note info', id:'bnk-sim-deal', style:'margin-top:12px', text:SIM.buyer.name + '가 ' + SIM.seller.name + '에서 ' + SIM.item + '을 ' + won(SIM.amt) + ' GDC에 샀어요. 결제되는 즉시 두 장부가 아래처럼 바뀝니다. 색이 칠해진 줄이 이번 거래로 바뀐 줄이에요.' }));
    kids.push(h('div', { class:'g2 eq', style:'margin-top:8px' }, [simCol(SIM.buyer), simCol(SIM.seller)]));
    kids.push(h('div', { class:'sub', text:'구매자는 GDC가 줄고 상품이 늘었어요. 판매자는 GDC가 늘고, 팔린 상품 원가 9,000 GDC만큼 재고가 줄고, 남은 이익 6,000 GDC가 이익잉여금에 쌓였어요.' }));
  }
  return h('div', { class:'card col', id:'bnk-sim', style:'margin-top:8px' }, kids);
}
function viewPay() {
  var kids = head('송금·결제', '나비 코드(10자리)로 GDC를 주고받습니다. 카드 수수료가 없는 GDC 지갑 간 직접 이체입니다.'), st = status(); if (st) kids.push(st);
  kids.push(soon('실제 결제는 폰의 나비웹 앱에서 합니다. 이 화면은 코드·금액을 미리 확인해 두는 용도이며 돈이 움직이지 않습니다.'));
  kids.push(simCard());
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
  kids.push(h('div', { class:'g2 eq' }, [f1, f2]));
  return kids;
}

// ── 거래 내역 ──
// ── 시뮬레이션 공통(연습용 가상 값: 실제 돈·내 장부와 무관) ──
function prng(seed) { var s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function rint(r, a, b, step) { step = step || 100; return Math.round((a + r() * (b - a)) / step) * step; }
function dayAgo(n) { var p = kst().split('-'), x = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) - n * 864e5); return x.getUTCFullYear() + '-' + ('0' + (x.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + x.getUTCDate()).slice(-2); }
function svgBox(id, w, hh, label, inner) { return h('div', { id:id, html:'<svg viewBox="0 0 ' + w + ' ' + hh + '" role="img" aria-label="' + label + '" style="width:100%;height:auto;display:block;font-family:inherit">' + inner + '</svg>' }); }
function sx(x, y, t, o) { o = o || {}; return '<text x="' + x + '" y="' + y + '" font-size="' + (o.fs || 12) + '" text-anchor="' + (o.a || 'start') + '" fill="' + (o.c || 'var(--on)') + '"' + (o.b ? ' font-weight="700"' : '') + '>' + t + '</text>'; }
function man(v) { return v >= 1e4 ? (v / 1e4).toLocaleString('ko-KR') + '만' : String(v); }
function simHead(title, sub, on, key, seedKey, goId, redoId) {
  var b = btn(on ? '시뮬레이션 닫기' : '시뮬레이션', on ? 'quiet' : 'fill', function () { S[key] = !S[key]; render(); }); b.id = goId;
  var acts = [b];
  if (on) { var rb = btn('다시 생성', 'quiet', function () { S[seedKey]++; render(); }); rb.id = redoId; acts.unshift(rb); }
  return h('div', { class:'rowf', style:'justify-content:space-between;align-items:center;gap:12px' }, [h('div', {}, [h('b', { style:'font-size:17px', text:title }), h('div', { class:'sub', text:sub })]), h('div', { class:'rowf' }, acts)]);
}
function stTable(title, rows, id) { return h('div', { class:'stcol', id:id }, [h('div', { class:'sth', text:title }), h('table', { class:'stbl' }, [h('tbody', {}, rows.map(function (r) { return h('tr', { class:r[2] || '' }, [h('td', { text:r[0] }), h('td', { class:'r num', text:r[1] })]); }))])]); }
// ── 거래 내역 시뮬레이션: 가상 거래 → 분야별 그래프, 국민 평균과 비교 ──
// 국민 평균: 국가데이터처(통계청) 가계동향조사 2025년 연간 가구당 월평균 소비지출 2,939,000원 기준 비중(%).
// 외식(음식·숙박 15.8%)·가정식(식료품·비주류음료 15.3%)·학비(교육 244,000원 ÷ 2,939,000원 = 8.3%)는 발표 값, 나머지는 대략값. 같은 7개 분야 안에서 비중으로 비교한다.
var SPC = [['교통비', 10.5, 0], ['식비 · 외식', 15.8, 1], ['식비 · 가정식', 15.3, 1], ['학비', 8.3, 1], ['통신비', 4.5, 0], ['문화·여가', 5.5, 0], ['의료·건강', 7.5, 0]];
function spendGen(seed) {
  var r = prng(seed), tx = [];
  function add(i, c, w, a) { tx.push({ d:dayAgo(29 - i), i:i, c:c, w:w, a:a }); }
  for (var i = 0; i < 30; i++) {
    var dow = new Date(dayAgo(29 - i) + 'T00:00:00Z').getUTCDay(), wk = dow > 0 && dow < 6;
    if (wk) { add(i, 0, '지하철·버스', rint(r, 1400, 2900, 50)); add(i, 0, '지하철·버스', rint(r, 1400, 2900, 50)); if (r() < 0.9) add(i, 1, '점심 식당', rint(r, 8000, 13500, 500)); if (r() < 0.6) add(i, 1, '카페', rint(r, 4500, 6500, 100)); }
    else { if (r() < 0.7) add(i, 1, '저녁 식당', rint(r, 18000, 42000, 500)); if (r() < 0.3) add(i, 1, '배달 주문', rint(r, 16000, 28000, 500)); if (r() < 0.25) add(i, 5, '영화관', 14000); }
    if (r() < 0.12) add(i, 0, '택시', rint(r, 8500, 21000, 500));
    if (i % 7 === 2) add(i, 2, '동네 마트', rint(r, 38000, 92000, 500));
    if (r() < 0.35) add(i, 2, '편의점', rint(r, 3000, 9000, 100));
    if (r() < 0.06) add(i, 6, '약국', rint(r, 6500, 15000, 500));
    if (i === 4 || i === 19) add(i, 0, '주유소', rint(r, 52000, 74000, 1000));
    if (i === 1) add(i, 3, '학원 수강료', 280000);
    if (i === 16) add(i, 3, '교재 구입', rint(r, 15000, 30000, 1000));
    if (i === 3) add(i, 4, '휴대폰 요금', rint(r, 55000, 69000, 1000));
    if (i === 8) add(i, 4, '인터넷 요금', 33000);
    if (i === 6) add(i, 5, '동영상 구독', 13500);
    if (i === 11) add(i, 6, '병원', rint(r, 14000, 28000, 500));
  }
  return tx;
}
function spendSimCard() {
  var on = S.hsim, kids = [simHead('시뮬레이션 — 가상 거래 내역을 분야별로 보고 국민 평균과 비교', '가상의 최근 30일 거래를 만들어 교통비·식비·학비·통신비 등으로 나눠 보여 줘요. 실제 거래와 무관한 연습입니다.', on, 'hsim', 'hseed', 'bnk-hsim-go', 'bnk-hsim-redo')];
  if (on) {
    var tx = spendGen(S.hseed), tot = [0, 0, 0, 0, 0, 0, 0], total = 0, day = [], i;
    for (i = 0; i < 30; i++) day.push(0);
    tx.forEach(function (t) { tot[t.c] += t.a; total += t.a; day[t.i] += t.a; });
    var asum = 0; SPC.forEach(function (c) { asum += c[1]; });
    var rows = SPC.map(function (c, k) { return { n:c[0], amt:tot[k], mine:total ? tot[k] / total * 100 : 0, avg:c[1] / asum * 100, pub:c[2] }; });
    var far = rows.slice().sort(function (a, b) { return Math.abs(b.mine - b.avg) - Math.abs(a.mine - a.avg); })[0], dfv = far.mine - far.avg;
    function t3(k, vv, id) { return h('div', { class:'tile' }, [h('div', { class:'k', text:k }), h('div', { class:'v num', id:id, text:vv })]); }
    kids.push(h('div', { class:'g4 cmp', style:'margin-top:12px' }, [t3('최근 30일 지출', won(total) + ' GDC', 'bnk-hsim-total'), t3('거래 건수', tx.length + '건', 'bnk-hsim-cnt'), t3('평균과 가장 다른 분야', far.n + ' ' + (dfv > 0 ? '+' : '−') + Math.abs(dfv).toFixed(1) + '%p', 'bnk-hsim-far')]));
    // 도넛: 분야별 구성(단색, 농도만 다르게)
    var op = [1, 0.82, 0.66, 0.52, 0.4, 0.3, 0.2], C = 2 * Math.PI * 80, off = 0, segs = '';
    rows.forEach(function (x, k) { var len = total ? x.amt / total * C : 0; if (len > 0) segs += '<circle cx="110" cy="110" r="80" fill="none" stroke="var(--pri)" stroke-opacity="' + op[k] + '" stroke-width="30" stroke-dasharray="' + Math.max(len - 1.5, 0.5).toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 110 110)"/>'; off += len; });
    segs += sx(110, 106, '30일 지출', { a:'middle', fs:12, c:'var(--on2)' }) + sx(110, 130, short(total), { a:'middle', fs:22, b:1 });
    var legend = h('div', { style:'flex:1;min-width:190px' }, rows.map(function (x, k) { return h('div', { style:'display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px;border-top:1px solid var(--line)' }, [h('span', { style:'display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--pri);opacity:' + op[k] }), h('span', { style:'flex:1', text:x.n }), h('span', { class:'num', text:won(x.amt) }), h('span', { class:'num', style:'width:48px;text-align:right;color:var(--on2)', text:x.mine.toFixed(1) + '%' })]); }));
    var donut = h('div', { class:'card col', style:'margin:0' }, [h('b', { text:'분야별 지출 구성' }), h('div', { style:'display:flex;flex-wrap:wrap;align-items:center;gap:12px' }, [h('div', { style:'width:200px;max-width:100%' }, [svgBox('bnk-hsim-donut', 220, 220, '분야별 지출 구성 도넛 차트', segs)]), legend])]);
    // 비교 막대: 나 vs 국민 평균(같은 7개 분야 안의 비중)
    var mx = 0; rows.forEach(function (x) { mx = Math.max(mx, x.mine, x.avg); }); mx = Math.ceil(mx / 5) * 5;
    var L = 112, sc = (560 - L - 54) / mx, bar = sx(L, 12, '나', { fs:11, c:'var(--on2)' }) + '<rect x="' + (L + 22) + '" y="4" width="10" height="10" fill="var(--pri)"/>' + sx(L + 60, 12, '국민 평균', { fs:11, c:'var(--on2)' }) + '<rect x="' + (L + 118) + '" y="4" width="10" height="10" fill="none" stroke="var(--n)" stroke-width="1.4"/>';
    bar = sx(L, 12, '■ 나', { fs:11 }) + sx(L + 60, 12, '□ 국민 평균', { fs:11, c:'var(--on2)' });
    rows.forEach(function (x, k) { var y0 = 26 + k * 38; bar += sx(0, y0 + 17, x.n, { fs:12.5 }) + '<rect x="' + L + '" y="' + (y0 + 3) + '" width="' + Math.max(x.mine * sc, 1).toFixed(1) + '" height="13" rx="2" fill="var(--pri)"/>' + sx(L + x.mine * sc + 6, y0 + 14, x.mine.toFixed(1) + '%', { fs:11 }) + '<rect x="' + L + '" y="' + (y0 + 20) + '" width="' + Math.max(x.avg * sc, 1).toFixed(1) + '" height="13" rx="2" fill="none" stroke="var(--n)" stroke-width="1.4"/>' + sx(L + x.avg * sc + 6, y0 + 31, x.avg.toFixed(1) + '%', { fs:11, c:'var(--on2)' }); });
    var cmpCard = h('div', { class:'card col', style:'margin:0' }, [h('b', { text:'국민 평균과 비교 — 지출 비중(%)' }), svgBox('bnk-hsim-cmp', 560, 26 + 7 * 38 + 4, '분야별 지출 비중을 나와 국민 평균으로 비교한 막대 차트', bar)]);
    kids.push(h('div', { class:'g2 eq', style:'margin-top:8px' }, [donut, cmpCard]));
    // 일별 지출 막대
    var dm = 0; day.forEach(function (x) { dm = Math.max(dm, x); }); var step = Math.pow(10, Math.floor(Math.log(dm || 1) / Math.LN10)); dm = Math.ceil(dm / step) * step || 1;
    var PL = 44, PB = 22, PT = 8, ch = 170, bw = (560 - PL - 6) / 30, dsv = '';
    [0, 0.5, 1].forEach(function (g) { var y = PT + (ch - PT - PB) * (1 - g); dsv += '<line x1="' + PL + '" y1="' + y + '" x2="556" y2="' + y + '" stroke="var(--line)" stroke-width="1"/>' + sx(PL - 6, y + 4, short(dm * g), { a:'end', fs:10.5, c:'var(--on2)' }); });
    day.forEach(function (x, k) { var hh = (ch - PT - PB) * x / dm; dsv += '<rect x="' + (PL + k * bw + bw * 0.15).toFixed(1) + '" y="' + (ch - PB - hh).toFixed(1) + '" width="' + (bw * 0.7).toFixed(1) + '" height="' + Math.max(hh, 0).toFixed(1) + '" rx="1.5" fill="var(--pri)" fill-opacity="0.85"/>'; });
    [0, 14, 29].forEach(function (k) { dsv += sx(PL + k * bw + bw / 2, ch - 6, dayAgo(29 - k).slice(5), { a:'middle', fs:10.5, c:'var(--on2)' }); });
    kids.push(h('div', { class:'card col', style:'margin-top:8px' }, [h('div', { class:'rowf', style:'justify-content:space-between' }, [h('b', { text:'일별 지출(GDC)' }), h('span', { class:'sub', text:'큰 막대는 학원비·휴대폰 요금·장보기·주유 같은 날이에요.' })]), svgBox('bnk-hsim-daily', 560, ch, '최근 30일 일별 지출 막대 차트', dsv)]));
    // 최근 거래
    var recent = tx.slice().sort(function (a, b) { return b.i - a.i; }).slice(0, 12);
    kids.push(h('div', { class:'stcol', id:'bnk-hsim-tx', style:'margin-top:8px' }, [h('div', { class:'sth', text:'가상 거래 내역 — 최근 12건 (전체 ' + tx.length + '건)' }), h('table', { class:'stbl' }, [h('tbody', {}, recent.map(function (t) { return h('tr', {}, [h('td', { class:'sub', text:t.d.slice(5) }), h('td', { text:SPC[t.c][0] }), h('td', { text:t.w }), h('td', { class:'r num', text:won(t.a) + ' GDC' })]); }))])]));
    kids.push(h('div', { class:'sub', id:'bnk-hsim-src', style:'margin-top:8px', text:'국민 평균은 국가데이터처(통계청) 가계동향조사 2025년 연간, 가구당 월평균 소비지출 293만 9천 원을 기준으로 했어요. 외식(음식·숙박 15.8%)·가정식(식료품·비주류음료 15.3%)·학비(교육, 월 24만 4천 원 = 8.3%)는 발표 값이고, 교통비·통신비·문화·여가·의료·건강은 대략값이에요. 같은 7개 분야 안에서 비중(%)으로 비교하고, 거래 내역은 연습용 가상 값이에요.' }));
  }
  return h('div', { class:'card col', id:'bnk-hsim', style:'margin-top:16px' }, kids);
}
function viewHistory() {
  var kids = head('거래 내역', '충전과 사용 내역, 이번 달 청구서를 모았습니다.'), st = status(); if (st) kids.push(st);
  kids.push(spendSimCard());
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
// ── 신용 평가 시뮬레이션: 종래의 평가 기법(재무비율 스코어카드·5C·Altman Z″)을 단계별로 적용 ──
var GR = [['AAA', 90, 3.5, 100], ['AA', 80, 4.2, 90], ['A', 70, 5.2, 75], ['BBB', 60, 6.5, 60], ['BB', 50, 8.0, 40], ['B', 40, 10.0, 20], ['CCC', 0, 13.0, 0]];
function grIdx(score) { for (var i = 0; i < GR.length; i++) if (score >= GR[i][1]) return i; return GR.length - 1; }
function frac(v, cuts, hi) { var fr = [1, 0.8, 0.6, 0.4, 0.2]; for (var i = 0; i < cuts.length; i++) if (hi ? v >= cuts[i] : v <= cuts[i]) return fr[i]; return 0; }
function r1k(x) { return Math.round(x / 1e3) * 1e3; }
function credGen(seed) {
  var r = prng(seed * 7919 + 13), i;
  var E = rint(r, 20e6, 60e6, 1e6), L = r1k(E * (0.3 + r() * 1.9));
  var ap = r1k(L * 0.3), sd = r1k(L * 0.35), ld = L - ap - sd, CL = ap + sd, A = E + L;
  var CA = Math.min(r1k(CL * (0.8 + r() * 1.6)), r1k(A * 0.85)), cash = r1k(CA * 0.35), rec = r1k(CA * 0.3), inv = CA - cash - rec, fix = A - CA;
  var cap = Math.round(E * (0.55 + r() * 0.25) / 1e6) * 1e6, re = E - cap;
  var base = rint(r, 5e6, 12e6, 1e5), sig = 0.04 + r() * 0.26, gg = (r() - 0.35) * 0.5, sales = [], rev = 0;
  for (i = 0; i < 12; i++) { var m = Math.max(base * (1 + gg * (i - 5.5) / 11 + (r() - 0.5) * 2 * sig), base * 0.3); m = r1k(m); sales.push(m); rev += m; }
  var mean = rev / 12, vs = 0; sales.forEach(function (x) { vs += (x - mean) * (x - mean); });
  var cv = Math.sqrt(vs / 12) / mean * 100, gr = ((sales[9] + sales[10] + sales[11]) / (sales[0] + sales[1] + sales[2]) - 1) * 100;
  var cogs = r1k(rev * (0.66 + r() * 0.2)), sga = r1k(rev * (0.08 + r() * 0.12)), gp = rev - cogs, op = gp - sga, intr = r1k((sd + ld) * 0.06), pre = op - intr;
  var u = r(), months = Math.round(3 + r() * 45), per = Math.round(25 + r() * 190), cp = Math.round(6 + r() * 60), od = u < 0.55 ? 0 : u < 0.8 ? 1 : u < 0.93 ? 2 : 3, nt = Math.round(45 + r() * 52);
  var dr = L / E * 100, cr = CA / CL * 100, om = op / rev * 100, icr = intr > 0 ? op / intr : 99;
  function it(c5, grp, lab, vt, rule, mx, fr) { return { c:c5, g:grp, l:lab, v:vt, rule:rule, mx:mx, s:Math.round(mx * fr * 10) / 10 }; }
  var items = [
    it('자본', 0, '부채비율', dr.toFixed(0) + '%', '50% 이하 만점 · 400% 초과 0점', 15, frac(dr, [50, 100, 150, 250, 400], false)),
    it('담보', 0, '유동비율', cr.toFixed(0) + '%', '200% 이상 만점 · 80% 미만 0점', 12, frac(cr, [200, 150, 120, 100, 80], true)),
    it('상환능력', 0, '영업이익률', om.toFixed(1) + '%', '15% 이상 만점 · 0% 미만 0점', 12, frac(om, [15, 10, 6, 3, 0], true)),
    it('상환능력', 0, '이자보상배율', icr >= 99 ? '이자 없음' : icr.toFixed(1) + '배', '8배 이상 만점 · 1배 미만 0점', 11, frac(icr, [8, 5, 3, 1.5, 1], true)),
    it('경기·환경', 0, '매출 성장률', gr.toFixed(1) + '%', '10% 이상 만점 · −10% 미만 0점', 10, frac(gr, [10, 5, 0, -5, -10], true)),
    it('성향', 1, '거래 기간', months + '개월', '36개월 이상 만점 · 3개월 미만 0점', 8, frac(months, [36, 24, 12, 6, 3], true)),
    it('성향', 1, '월 거래 건수', per + '건', '150건 이상 만점 · 10건 미만 0점', 6, frac(per, [150, 100, 60, 30, 10], true)),
    it('경기·환경', 1, '매출 변동계수', cv.toFixed(1) + '%', '8% 이하 만점 · 50% 초과 0점', 10, frac(cv, [8, 15, 25, 35, 50], false)),
    it('성향', 1, '최근 12개월 연체', od + '건', '0건 만점 · 3건 이상 0점', 6, od === 0 ? 1 : od === 1 ? 0.6 : od === 2 ? 0.3 : 0),
    it('성향', 2, '나비 온도', nt + '점', '90점 이상 만점 · 50점 미만 0점', 10, frac(nt, [90, 80, 70, 60, 50], true))
  ];
  var sub = [0, 0, 0], subm = [0, 0, 0], score = 0;
  items.forEach(function (x) { sub[x.g] += x.s; subm[x.g] += x.mx; score += x.s; });
  score = Math.round(score * 10) / 10;
  var x1 = (CA - CL) / A, x2 = re / A, x3 = op / A, x4 = E / L, z = 6.56 * x1 + 3.26 * x2 + 6.72 * x3 + 1.05 * x4;
  var gi = grIdx(score), adj = (z < 1.1 && gi < 3) ? 1 : 0;
  return { E:E, L:L, A:A, CA:CA, CL:CL, ap:ap, sd:sd, ld:ld, cash:cash, rec:rec, inv:inv, fix:fix, cap:cap, re:re, sales:sales, rev:rev, mean:mean, cv:cv, gr:gr, cogs:cogs, sga:sga, gp:gp, op:op, intr:intr, pre:pre, months:months, per:per, cp:cp, od:od, nt:nt, dr:dr, cr:cr, om:om, icr:icr, items:items, sub:sub, subm:subm, score:score, x1:x1, x2:x2, x3:x3, x4:x4, z:z, zone:z > 2.6 ? '안전' : z >= 1.1 ? '회색' : '위험', gi:gi, adj:adj, fi:Math.min(gi + adj, GR.length - 1) };
}
function gtab(id, head, rows) {
  return h('div', { class:'stcol', id:id }, [h('table', { class:'stbl' }, [h('thead', {}, [h('tr', {}, head.map(function (x) { return h('th', { style:'text-align:' + (x[1] === 'r' ? 'right' : 'left') + ';font-weight:700;font-size:12px;color:var(--on2);padding:6px 8px', text:x[0] }); }))]), h('tbody', {}, rows.map(function (r) { return h('tr', { class:r.cls || '' }, r.c.map(function (x, k) { return (typeof x === 'string' || typeof x === 'number') ? h('td', { class:head[k][1] === 'r' ? 'r num' : '', text:String(x) }) : h('td', { class:head[k][1] === 'r' ? 'r' : '' }, [x]); })); }))])]);
}
function salesChart(id, sales, mean) {
  var PL = 44, PB = 22, PT = 8, w = 560, ch = 170, bw = (w - PL - 6) / 12, mx = 0, s = '';
  sales.forEach(function (x) { mx = Math.max(mx, x); });
  var stp = Math.pow(10, Math.floor(Math.log(mx) / Math.LN10)); mx = Math.ceil(mx / stp) * stp;
  [0, 0.5, 1].forEach(function (g) { var y = PT + (ch - PT - PB) * (1 - g); s += '<line x1="' + PL + '" y1="' + y + '" x2="556" y2="' + y + '" stroke="var(--line)" stroke-width="1"/>' + sx(PL - 6, y + 4, short(mx * g), { a:'end', fs:10.5, c:'var(--on2)' }); });
  sales.forEach(function (x, k) { var hh = (ch - PT - PB) * x / mx; s += '<rect x="' + (PL + k * bw + bw * 0.18).toFixed(1) + '" y="' + (ch - PB - hh).toFixed(1) + '" width="' + (bw * 0.64).toFixed(1) + '" height="' + hh.toFixed(1) + '" rx="2" fill="var(--pri)" fill-opacity="0.85"/>'; });
  var ym = ch - PB - (ch - PT - PB) * mean / mx;
  s += '<line x1="' + PL + '" y1="' + ym.toFixed(1) + '" x2="556" y2="' + ym.toFixed(1) + '" stroke="var(--on)" stroke-width="1.2" stroke-dasharray="4 3"/>' + sx(556, ym - 5, '평균 ' + short(mean), { a:'end', fs:10.5 });
  s += sx(PL, ch - 6, '11개월 전', { fs:10.5, c:'var(--on2)' }) + sx(556, ch - 6, '이번 달', { a:'end', fs:10.5, c:'var(--on2)' });
  return svgBox(id, w, ch, '최근 12개월 월별 매출 막대 차트', s);
}
function cstep(n, title, kidsIn) { return h('div', { class:'card col', id:'bnk-csim-s' + n, style:'margin:8px 0 0' }, [h('div', { class:'rowf', style:'align-items:center;gap:10px' }, [h('span', { class:'pill p', text:String(n) }), h('b', { text:title })])].concat(kidsIn)); }
function tile(k, v, id) { return h('div', { class:'tile' }, [h('div', { class:'k', text:k }), h('div', { class:'v num', id:id || null, text:v })]); }
function csimCard() {
  var on = S.csim, n = S.cstep, g = on ? credGen(S.cseed) : null, acts = [];
  var go = btn(on ? '시뮬레이션 닫기' : '시뮬레이션', on ? 'quiet' : 'fill', function () { S.csim = !S.csim; S.cstep = 1; render(); }); go.id = 'bnk-csim-go';
  if (on) {
    var rd = btn('다시 생성', 'quiet', function () { S.cseed++; S.cstep = 1; render(); }); rd.id = 'bnk-csim-redo'; acts.push(rd); acts.push(go);
    if (n < 6) { var nx = btn('다음 단계 ▶', 'fill', function () { S.cstep++; render(); setTimeout(function () { var e = document.getElementById('bnk-csim-s' + S.cstep); if (e && e.scrollIntoView) e.scrollIntoView({ block:'nearest', behavior:'smooth' }); }, 0); }); nx.id = 'bnk-csim-next'; acts.push(nx); }
  } else acts.push(go);
  var kids = [h('div', { class:'rowf', style:'justify-content:space-between;align-items:center;gap:12px' }, [h('div', {}, [h('b', { style:'font-size:17px', text:'시뮬레이션 — 신용 등급이 정해지는 과정 보기' }), h('div', { class:'sub', text:on ? '가상의 재무제표와 거래 이력으로 신용 등급을 정합니다. 단계 ' + n + ' / 6' : '가상의 재무제표와 거래 이력으로, 널리 쓰이는 신용 평가 기법을 6단계로 차근차근 보여 드려요. 실제 평가와 무관한 연습입니다.' })]), h('div', { class:'rowf' }, acts)])];
  if (!on) return h('div', { class:'card col', id:'bnk-csim', style:'margin-top:16px' }, kids);
  // 1단계: 재무제표
  var bs = [['자산', '', 'sec'], ['현금 및 예금', won(g.cash)], ['매출채권', won(g.rec)], ['상품(재고)', won(g.inv)], ['유동자산 합계', won(g.CA), 'tot'], ['비품·설비', won(g.fix)], ['자산 총계', won(g.A), 'tot'], ['부채', '', 'sec'], ['매입채무', won(g.ap)], ['단기차입금', won(g.sd)], ['유동부채 합계', won(g.CL), 'tot'], ['장기차입금', won(g.ld)], ['부채 총계', won(g.L), 'tot'], ['자본', '', 'sec'], ['자본금', won(g.cap)], ['이익잉여금', won(g.re)], ['자본 총계', won(g.E), 'tot'], ['부채와 자본 총계', won(g.L + g.E), 'tot']];
  var is = [['매출액', won(g.rev)], ['매출원가', '−' + won(g.cogs)], ['매출총이익', won(g.gp), 'tot'], ['판매관리비', '−' + won(g.sga)], ['영업이익', won(g.op), 'tot'], ['이자비용', '−' + won(g.intr)], ['세전이익', won(g.pre), 'tot']];
  kids.push(cstep(1, '가상 재무제표 만들기', [h('div', { class:'g2 eq' }, [stTable('재무상태표 (단위: GDC)', bs, 'bnk-csim-bs'), stTable('손익계산서 · 최근 12개월', is, 'bnk-csim-is')]), h('div', { class:'sub', text:'자산 총계 ' + won(g.A) + ' = 부채 총계 ' + won(g.L) + ' + 자본 총계 ' + won(g.E) + ' — 대차가 맞아요. 신용 평가는 먼저 이 숫자들을 모으는 데서 시작합니다.' })]));
  if (n >= 2) kids.push(cstep(2, '거래 이력 정리하기', [h('div', { class:'g3' }, [tile('거래 기간', g.months + '개월'), tile('월평균 거래 건수', g.per + '건'), tile('거래처 수', g.cp + '곳'), tile('최근 12개월 연체', g.od + '건'), tile('나비 온도(가상)', g.nt + '점')]), h('b', { style:'font-size:13px', text:'월별 매출 — 최근 12개월' }), salesChart('bnk-csim-sales', g.sales, g.mean), h('div', { class:'sub', text:'매출의 들쭉날쭉한 정도를 변동계수(표준편차 ÷ 평균)로 재면 ' + g.cv.toFixed(1) + '%예요. 낮을수록 매출이 안정적이라는 뜻입니다.' })]));
  if (n >= 3) kids.push(cstep(3, '재무비율 계산하기', [gtab('bnk-csim-ratio', [['비율', 'l'], ['산식', 'l'], ['값', 'r'], ['읽는 법', 'l']], [
    { c:['부채비율', '부채 총계 ÷ 자본 총계', g.dr.toFixed(0) + '%', '낮을수록 빚 부담이 작아요'] },
    { c:['유동비율', '유동자산 ÷ 유동부채', g.cr.toFixed(0) + '%', '높을수록 단기 상환 여유가 커요'] },
    { c:['영업이익률', '영업이익 ÷ 매출액', g.om.toFixed(1) + '%', '높을수록 본업이 잘 벌어요'] },
    { c:['이자보상배율', '영업이익 ÷ 이자비용', g.icr >= 99 ? '이자 없음' : g.icr.toFixed(1) + '배', '1배 미만이면 번 돈으로 이자도 못 내요'] },
    { c:['매출 성장률', '최근 3개월 매출 ÷ 처음 3개월 매출 − 1', g.gr.toFixed(1) + '%', '높을수록 사업이 커지는 중이에요'] }]), h('div', { class:'sub', text:'은행과 신용평가사가 오래전부터 쓰는 기본 비율이에요: 안정성(부채·유동), 수익성(영업이익률), 이자 부담(이자보상배율), 성장성.' })]));
  if (n >= 4) {
    var rows = [], grp = ['재무 평가', '거래 이력 평가', '신뢰도 평가'];
    for (var gi = 0; gi < 3; gi++) {
      g.items.forEach(function (x) { if (x.g !== gi) return; rows.push({ c:[x.c, x.l, x.v, x.rule, h('div', { style:'display:flex;align-items:center;gap:8px;justify-content:flex-end' }, [h('div', { style:'width:64px;height:8px;background:var(--line);border-radius:4px;overflow:hidden' }, [h('i', { style:'display:block;height:100%;background:var(--pri);width:' + Math.round(x.s / x.mx * 100) + '%' })]), h('span', { class:'num', style:'width:64px;text-align:right', text:x.s + ' / ' + x.mx })])] }); });
      rows.push({ cls:'tot', c:['', grp[gi] + ' 소계', '', '', g.sub[gi].toFixed(1) + ' / ' + g.subm[gi]] });
    }
    rows.push({ cls:'tot hl', c:['', '합계', '', '', g.score + ' / 100'] });
    kids.push(cstep(4, '항목별로 점수 매기기 — 스코어카드', [gtab('bnk-csim-score', [['5C', 'l'], ['항목', 'l'], ['값', 'r'], ['점수 기준', 'l'], ['득점', 'r']], rows), h('div', { class:'sub', text:'스코어카드 방식: 항목마다 값의 구간에 따라 만점의 100·80·60·40·20·0%를 주고 더합니다. 5C는 신용 평가의 고전적인 관점이에요 — 성향(Character), 상환능력(Capacity), 자본(Capital), 담보(Collateral), 경기·환경(Conditions).' })]));
  }
  if (n >= 5) kids.push(cstep(5, '다른 방법으로 한 번 더 확인하기 — Altman Z″', [gtab('bnk-csim-z', [['항목', 'l'], ['산식', 'l'], ['값', 'r'], ['계수', 'r'], ['기여', 'r']], [
    { c:['X1 운전자본', '(유동자산 − 유동부채) ÷ 자산 총계', g.x1.toFixed(3), '6.56', (6.56 * g.x1).toFixed(2)] },
    { c:['X2 누적 이익', '이익잉여금 ÷ 자산 총계', g.x2.toFixed(3), '3.26', (3.26 * g.x2).toFixed(2)] },
    { c:['X3 수익력', '영업이익 ÷ 자산 총계', g.x3.toFixed(3), '6.72', (6.72 * g.x3).toFixed(2)] },
    { c:['X4 자본 여력', '자본 총계 ÷ 부채 총계', g.x4.toFixed(3), '1.05', (1.05 * g.x4).toFixed(2)] },
    { cls:'tot hl', c:['Z″ 점수', '', '', '', g.z.toFixed(2)] }]), h('div', { class:'sub', id:'bnk-csim-zone', text:'Z″ ' + g.z.toFixed(2) + ' → ' + g.zone + ' 구간 (2.6 초과 안전 · 1.1~2.6 회색 · 1.1 미만 위험). ' + (g.adj ? '스코어카드 등급은 좋은데 Z″가 위험 구간이라, 보수적 원칙에 따라 등급을 한 단계 낮춥니다.' : '스코어카드 결과와 크게 어긋나지 않아 등급을 그대로 둡니다. (스코어카드가 A 이상인데 Z″가 위험이면 한 단계 낮춰요.)') })]));
  if (n >= 6) {
    var cells = GR.map(function (x, i) { return h('div', { style:'flex:1;text-align:center;padding:10px 0;border-radius:6px;font-weight:700;font-size:14px;border:1px solid var(--line);' + (i === g.fi ? 'background:var(--pri);color:#fff;border-color:var(--pri)' : 'color:var(--on2)'), text:x[0] }); });
    var trs = GR.map(function (x, i) { return { cls:i === g.fi ? 'hl' : '', c:[x[0], i === 0 ? x[1] + '점 이상' : i === GR.length - 1 ? GR[i - 1][1] + '점 미만' : x[1] + '점 이상 ' + GR[i - 1][1] + '점 미만', x[2].toFixed(1) + '%', x[3] + '%'] }; });
    var F = GR[g.fi];
    kids.push(cstep(6, '종합 점수로 등급 정하기', [h('div', { class:'sub', text:'스코어카드 ' + g.score + '점 → ' + GR[g.gi][0] + (g.adj ? ' → Z″ 조정 → ' + F[0] : ' (조정 없음)') }), h('div', { style:'display:flex;gap:6px' }, cells), h('div', { class:'tile', id:'bnk-csim-final' }, [h('div', { class:'k', text:'최종 신용 등급' }), h('div', { class:'v num', text:F[0] }), h('div', { class:'sub', text:'점수 ' + g.score + ' / 100 · 기본 이자율 연 ' + F[2].toFixed(1) + '% · 대출 한도 계수 ' + F[3] + '%' })]), gtab('bnk-csim-grades', [['등급', 'l'], ['점수 구간', 'l'], ['기본 이자율(연)', 'r'], ['한도 계수', 'r']], trs), h('div', { class:'sub', text:'등급이 높을수록 낮은 이자율과 큰 한도를 받아요. 이 등급이 예금·대출 화면의 대출 시뮬레이션에도 쓰입니다. 모두 연습용 가상 값이에요.' })]));
  }
  return h('div', { class:'card col', id:'bnk-csim', style:'margin-top:16px' }, kids);
}
// ── 대출 시뮬레이션: 가상 재무제표·거래 이력·신용 등급 → 한도 → 금액별 차등 이자율 ──
var LT = [[500000, 0], [1000000, 0.3], [3000000, 0.7], [5000000, 1.2], [7000000, 1.8], [10000000, 2.5], [20000000, 3.5]];
function pmt(P, ar, n) { var r = ar / 1200; return r ? P * r / (1 - Math.pow(1 + r, -n)) : P / n; }
function loanSimCard() {
  var on = S.lsim, kids = [simHead('시뮬레이션 — 가상 재무제표로 대출 한도와 이자율 보기', '가상의 재무제표·거래 이력·신용 등급을 만들고, 한도와 금액별 이자율을 보여 줘요. 실제 대출과 무관한 연습입니다.', on, 'lsim', 'lseed', 'bnk-lsim-go', 'bnk-lsim-redo')];
  if (!on) return h('div', { class:'card col', id:'bnk-lsim', style:'margin-top:16px' }, kids);
  var g = credGen(S.lseed), F = GR[g.fi], a = g.E * 0.5, b = g.mean * 3, lim0 = Math.min(a, b), lim = Math.floor(lim0 * F[3] / 100 / 1e5) * 1e5, i;
  var fs = [['자산 총계', won(g.A)], ['부채 총계', won(g.L)], ['자본 총계(순자산)', won(g.E)], ['부채비율', g.dr.toFixed(0) + '%'], ['연 매출액', won(g.rev)], ['영업이익', won(g.op)], ['이자비용', won(g.intr)]];
  var cr = [['거래 기간', g.months + '개월'], ['월평균 거래 건수', g.per + '건'], ['거래처 수', g.cp + '곳'], ['최근 12개월 연체', g.od + '건'], ['나비 온도(가상)', g.nt + '점'], ['신용 점수', g.score + ' / 100'], ['신용 등급', F[0], 'tot hl']];
  kids.push(h('div', { class:'g2 eq', style:'margin-top:12px' }, [stTable('① 가상 재무제표 요약 (GDC)', fs, 'bnk-lsim-fs'), stTable('② 거래 이력 · ③ 신용 등급', cr, 'bnk-lsim-cr')]));
  kids.push(h('div', { class:'sub', text:'신용 등급은 재무비율 스코어카드와 Z″ 점검으로 정해요. 단계별 과정은 신용·채권 화면의 시뮬레이션에서 볼 수 있어요.' }));
  var lm = [['순자산의 50%', won(a)], ['월평균 매출의 3배', won(b)], ['둘 중 작은 값', won(lim0), 'tot'], ['등급 계수 (' + F[0] + ')', F[3] + '%'], ['대출 한도 (10만 단위 내림)', won(lim) + ' GDC', 'tot hl']];
  kids.push(h('div', { style:'margin-top:8px' }, [stTable('④ 대출 한도 산정', lm, 'bnk-lsim-limit')]));
  var rows = LT.map(function (t) { var rate = F[2] + t[1], ok = t[0] <= lim, p = pmt(t[0], rate, 12); return { cls:ok ? '' : 'dim', c:[won(t[0]) + ' GDC', rate.toFixed(1) + '%', won(p), won(p * 12 - t[0]), ok ? '가능' : (lim ? '한도 초과' : '어려움')] }; });
  kids.push(h('div', { style:'margin-top:8px' }, [h('div', { class:'sth', text:'⑤ 대출 금액별 이자율 — 12개월 원리금균등 상환' }), gtab('bnk-lsim-tiers', [['대출 금액', 'l'], ['이자율(연)', 'r'], ['월 상환액', 'r'], ['총 이자', 'r'], ['상태', 'r']], rows)]));
  // 막대: 금액이 커질수록 오르는 이자율
  var PL = 40, PB = 34, PT = 22, w = 560, ch = 200, bw = (w - PL - 6) / LT.length, mr = Math.ceil(F[2] + 3.5 + 1), s = '', k = 0;
  LT.forEach(function (t) { if (t[0] <= lim) k++; });
  [0, 0.5, 1].forEach(function (q) { var y = PT + (ch - PT - PB) * (1 - q); s += '<line x1="' + PL + '" y1="' + y + '" x2="556" y2="' + y + '" stroke="var(--line)" stroke-width="1"/>' + sx(PL - 6, y + 4, (mr * q).toFixed(0) + '%', { a:'end', fs:10.5, c:'var(--on2)' }); });
  LT.forEach(function (t, j) { var rate = F[2] + t[1], hh = (ch - PT - PB) * rate / mr, x = PL + j * bw + bw * 0.2, ok = t[0] <= lim; s += '<rect x="' + x.toFixed(1) + '" y="' + (ch - PB - hh).toFixed(1) + '" width="' + (bw * 0.6).toFixed(1) + '" height="' + hh.toFixed(1) + '" rx="2" ' + (ok ? 'fill="var(--pri)" fill-opacity="0.85"' : 'fill="none" stroke="var(--n)" stroke-width="1.4"') + '/>' + sx(x + bw * 0.3, ch - PB - hh - 5, rate.toFixed(1) + '%', { a:'middle', fs:11, b:ok }) + sx(x + bw * 0.3, ch - 16, man(t[0]), { a:'middle', fs:11, c:'var(--on2)' }); });
  s += sx(PL + 0, ch - 2, '대출 금액(GDC)', { fs:10.5, c:'var(--on2)' });
  if (k < LT.length) { var xl = PL + k * bw; s += '<line x1="' + xl.toFixed(1) + '" y1="' + (PT - 6) + '" x2="' + xl.toFixed(1) + '" y2="' + (ch - PB) + '" stroke="var(--on)" stroke-width="1.2" stroke-dasharray="4 3"/>' + sx(xl + 4, PT - 9, '한도 ' + man(lim) + ' ▸ 이 선 오른쪽은 한도 초과', { fs:10.5 }); }
  kids.push(h('div', { class:'card col', style:'margin:8px 0 0' }, [h('b', { text:'금액이 커질수록 이자율이 올라가요' }), svgBox('bnk-lsim-chart', w, ch, '대출 금액별 연 이자율 막대 차트', s), h('div', { class:'sub', text:'이자율 = 등급별 기본 이자율(' + F[0] + ' ' + F[2].toFixed(1) + '%) + 금액 가산. 가산은 50만 원 0%p, 100만 원 0.3%p, 300만 원 0.7%p, 500만 원 1.2%p, 700만 원 1.8%p, 1천만 원 2.5%p, 2천만 원 3.5%p로 커져요. 속이 빈 막대는 한도를 넘는 금액이에요.' })]));
  kids.push(h('div', { class:'sub', id:'bnk-lsim-src', style:'margin-top:8px', text:'재무제표·거래 이력·신용 등급과 금액은 모두 연습용 가상 값이고, 실제 대출 신청이나 자금 이동은 없어요.' }));
  return h('div', { class:'card col', id:'bnk-lsim', style:'margin-top:16px' }, kids);
}
function viewSave() {
  var kids = head('예금·대출', '신용 평가와 채권 이자율 체계를 기반으로, 예금·대출이 자동으로 처리되도록 설계되어 있습니다.');
  kids.push(soon('아직 설계 단계입니다. 실제 예치·대출 신청과 자금 이동은 아직 할 수 없고, 아래 계산기는 직접 넣은 이율로 계산만 합니다.'));
  kids.push(loanSimCard());
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
  kids.push(csimCard());
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
