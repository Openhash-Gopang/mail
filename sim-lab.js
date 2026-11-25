/* sim-lab.js — 인프라 AI 화면(시장·세무 회계·은행·증권)의 "시뮬레이션" (주피터 지시 2026-11-25)
 * 사용: NaviSim.open('market' | 'tax' | 'bank' | 'stock') — 가상 데이터를 만들어 규칙을 직접 돌려 본다.
 *       NaviSim.gen.market/tax/bank/stock(seed, opt) — 같은 seed 면 같은 가상 데이터(순수 함수, 화면 없음) · NaviSim.rng(seed)
 *
 * 원칙:
 *  - 가상 데이터는 이 파일이 메모리에서만 만든다. 실제 장부·은행 잔고·전표·임금 기록·모의 계좌(localStorage)에는 아무것도 쓰지 않는다.
 *  - 화면마다 "가상 데이터" 표시를 붙이고, 창을 닫으면 사라진다. 같은 seed 로 다시 열면 같은 결과가 나온다(재현 가능).
 *  - 계산 규칙은 실제 화면과 같은 것을 쓴다: 원가(평균 매입가)·소득세는 NaviLedger, 가치 평가·검색은 NaviStock, 이상 탐지 한도는 NaviLedger.DEV_LIMIT.
 *    그 모듈이 아직 없으면 해당 줄만 "계산 모듈 없음"으로 비운다(지어내지 않는다).
 * 전역은 NaviSim 하나. 네트워크 요청 없음. */
(function () {
'use strict';
function rng(seed) { var a = (Number(seed) >>> 0) || 1; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { var u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function pick(r, a) { return a[Math.floor(r() * a.length)]; }
function ci(x, lo, hi, d) { var n = Math.floor(Number(x)); return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; }
function won(n) { return Math.round(Number(n) || 0).toLocaleString('ko-KR'); }
function med(a) { var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

// ── 시장: 가상 상품과 판매처별 가격 → 공정가격 구간 → 제 값 초과 판정 ──
var ITEMS = [['무선 청소기', 180000], ['노트북 거치대', 35000], ['전기 주전자', 42000], ['기계식 키보드', 98000], ['캠핑 의자', 56000], ['공기청정기', 240000], ['보온 텀블러', 24000], ['블루투스 스피커', 77000], ['전동 칫솔', 39000], ['에어프라이어', 89000], ['러닝화', 118000], ['보조배터리', 31000]];
function bandOf(prices) {   // 중앙값 ± 2.5×(보정 MAD, 중앙값의 3% 이상): 이상치에 끌려가지 않는 구간
  var m = med(prices), mad = med(prices.map(function (p) { return Math.abs(p - m); })) * 1.4826, w = Math.max(mad, m * 0.03) * 2.5;
  return { mid:m, lo:Math.max(0, m - w), hi:m + w };
}
function verdict(p, b) { return p > b.hi ? '제 값 초과' : p < b.lo ? '너무 낮음(확인 필요)' : '적정'; }
function market(seed, o) {
  o = o || {}; var r = rng(seed), n = ci(o.n, 1, ITEMS.length, 6), spread = ci(o.spread, 1, 30, 8) / 100, odd = ci(o.odd, 0, 50, 15) / 100, rows = [];
  var names = ITEMS.slice().sort(function () { return r() - 0.5; }).slice(0, n);
  names.forEach(function (it) {
    var truth = Math.round(it[1] * (0.85 + r() * 0.3)), offers = [];
    for (var i = 0; i < 8; i++) {
      var p = truth * (1 + gauss(r) * spread), kind = '';
      if (r() < odd) { if (r() < 0.6) { p = truth * (1.4 + r() * 0.6); kind = 'over'; } else { p = truth * (0.35 + r() * 0.25); kind = 'under'; } }
      offers.push({ seller:'판매처 ' + String.fromCharCode(65 + i), price:Math.max(100, Math.round(p / 100) * 100), injected:kind });
    }
    var b = bandOf(offers.map(function (x) { return x.price; })); offers.forEach(function (x) { x.v = verdict(x.price, b); });
    rows.push({ name:it[0], truth:truth, offers:offers, band:b });
  });
  return { seed:seed, rows:rows };
}
/** 하루 지남: 모든 가격이 조금씩 움직이고 공정가격 구간이 다시 계산된다. */
function marketTick(data, seed) {
  var r = rng(seed); data.rows.forEach(function (row) { row.offers.forEach(function (x) { x.price = Math.max(100, Math.round(x.price * (1 + gauss(r) * 0.02) / 100) * 100); }); row.band = bandOf(row.offers.map(function (x) { return x.price; })); row.offers.forEach(function (x) { x.v = verdict(x.price, row.band); }); });
  return data;
}

// ── 세무 회계: 가상 거래 → 부가세·매출원가·영업이익·참고용 소득세 ──
function tax(seed, o) {
  o = o || {}; var r = rng(seed), n = ci(o.n, 2, 40, 14), opex = ci(o.opex, 0, 1e9, 0), recs = [], inv = {}, k;
  var cat = ITEMS.slice(0, 6).map(function (x) { return [x[0], Math.round(x[1] * 0.6 / 100) * 100]; });
  for (var i = 0; i < n; i++) {
    var it = pick(r, cat), qty = 1 + Math.floor(r() * 5), buy = r() < 0.55 || !(inv[it[0]] > 0), cost = it[1], unit;
    if (buy) { unit = Math.round(cost * (0.9 + r() * 0.2) / 100) * 100; inv[it[0]] = (inv[it[0]] || 0) + qty; }
    else { unit = Math.round(cost * (1.25 + r() * 0.35) / 100) * 100; if (r() < 0.9) qty = Math.min(qty, inv[it[0]]); inv[it[0]] = Math.max(0, (inv[it[0]] || 0) - qty); }
    var sup = unit * qty; recs.push({ serial:'SIM-' + String(i + 1).padStart(3, '0'), buyer:{ owner:buy ? '나' : '가상 손님' }, seller:{ owner:buy ? '가상 도매상' : '나' }, slip:{ what:it[0], qty:qty, supply:sup }, vat:Math.round(sup * 0.1) });
  }
  var sales = 0, purch = 0, vOut = 0, vIn = 0;
  recs.forEach(function (x) { if (x.seller.owner === '나') { sales += x.slip.supply; vOut += x.vat; } else { purch += x.slip.supply; vIn += x.vat; } });
  var NL = window.NaviLedger, cf = NL && NL.costFlow ? NL.costFlow('나', recs) : null;
  var gross = cf ? sales - cf.cogs : null, op = gross == null ? null : gross - opex, tx = NL && NL.incomeTax && op != null ? NL.incomeTax(op) : null;
  return { seed:seed, recs:recs, sales:sales, purch:purch, vatOut:vOut, vatIn:vIn, vatDue:vOut - vIn, cogs:cf ? cf.cogs : null, uncovered:cf ? cf.uncoveredRevenue : null, gross:gross, opex:opex, op:op, tax:tx };
}

// ── 은행: 가상 월별 현금흐름 → 잔고 추이, 부족 월, 장부=잔고 대조 ──
function bank(seed, o) {
  o = o || {}; var r = rng(seed), months = ci(o.months, 3, 36, 12), start = ci(o.start, 0, 1e10, 1000000), inc = ci(o.income, 0, 1e9, 2800000), vol = ci(o.vol, 0, 80, 20) / 100, fixed = ci(o.fixed, 0, 1e9, 1900000);
  var bal = start, ents = [], rows = [], rejected = 0, mn = start, d = new Date(Date.UTC(2026, 0, 1));
  for (var m = 0; m < months; m++) {
    var ym = new Date(Date.UTC(2026, m, 1)).toISOString().slice(0, 7), a = Math.max(0, Math.round(inc * (1 + gauss(r) * vol) / 1000) * 1000), items = [['수입(가상)', a], ['고정 지출(가상)', -fixed]];
    if (r() < 0.3) items.push(['일회성 지출(가상)', -Math.round(inc * (0.2 + r() * 0.8) / 1000) * 1000]);
    var open = bal, rej = 0;
    items.forEach(function (it) { if (it[1] < 0 && bal + it[1] < 0) { rej++; rejected++; ents.push({ ym:ym, what:it[0], amt:it[1], ok:false }); return; } bal += it[1]; ents.push({ ym:ym, what:it[0], amt:it[1], ok:true }); });
    mn = Math.min(mn, bal); rows.push({ ym:ym, open:open, close:bal, rejected:rej });
  }
  var sum = start + ents.filter(function (e) { return e.ok; }).reduce(function (s, e) { return s + e.amt; }, 0);
  return { seed:seed, start:start, end:bal, min:mn, rows:rows, ents:ents, rejected:rejected, reconciled:sum === bal };
}

// ── 증권: 가상 기업·시세·이상 탐지 ──
var SECT = ['도소매', '제조', '서비스', 'IT·정보통신', '음식·숙박', '건설·부동산', '농림어업', '기타'], REG = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
var SYL = ['나', '비', '한', '솔', '바', '다', '온', '새', '길', '누리', '미래', '푸른', '해', '드림', '이음'], SUF = ['상회', '테크', '푸드', '건설', '랩', '농원', '유통', '소프트', '공방'];
function stock(seed, o) {
  o = o || {}; var r = rng(seed), n = ci(o.n, 3, 40, 12), days = ci(o.days, 5, 250, 60), cos = [], used = {};
  for (var i = 0; i < n; i++) {
    var nm; do { nm = pick(r, SYL) + pick(r, SYL) + pick(r, SUF); } while (used[nm]); used[nm] = 1;
    var sales = Math.round((2 + r() * 40) * 1e7), cogs = Math.round(sales * (0.45 + r() * 0.35)), opex = Math.round(sales * (0.05 + r() * 0.12)), assets = Math.round(sales * (0.4 + r() * 1.6)), debt = Math.round(assets * r() * 0.6);
    var px = 10000 * (0.5 + r() * 4), series = [Math.round(px)], shock = [], anom = [];
    for (var d = 1; d < days; d++) { var ret = gauss(r) * 0.015, big = r() < 0.025; if (big) { var sz = 0.12 + r() * 0.4; ret = (r() < 0.5 ? -1 : 1) * sz; anom.push({ day:d, size:sz }); } px = Math.max(100, px * (1 + ret)); series.push(Math.round(px)); if (big) shock.push(d); }
    var gT = 1 + r() * 4, rT = 8 + r() * 4;   // 이 가상 기업의 "진짜" 성장률·요구수익률(백테스트용 정답, 화면의 평가는 이 값을 모른다)
    cos.push({ id:'SIM' + String(i + 1).padStart(2, '0'), name:nm, anom:anom, gTrue:gT, rTrue:rT, sector:pick(r, SECT), region:pick(r, REG), sales:sales, cogs:cogs, opex:opex, assets:assets, debt:debt, equity:assets - debt, series:series, shock:shock });
  }
  return { seed:seed, days:days, cos:cos };
}
/** 가상 기업의 장부 요약(증권 화면의 valueOf 가 읽는 모양)과 가치 평가 구간. 증권 모듈이 없으면 null. */
function valueCo(co) {
  var NS = window.NaviStock, NL = window.NaviLedger; if (!NS || !NS.valueOf) return null;
  var gross = co.sales - co.cogs, op = gross - co.opex, tx = NL && NL.incomeTax ? NL.incomeTax(op).total : 0, net = op - tx;
  var sm = { owner:co.name, asOf:'가상', serials:['SIM'], n:1, equity:co.equity, assets:co.assets, debt:co.debt, sales:co.sales, cogs:co.cogs, profit:gross, profitKnown:true, uncoveredRevenue:0, earnNet:net, totals:{ balanced:true } };
  var v = NS.valueOf(sm, { g:'3', r:'10' }); return { low:v.low, high:v.high, mode:v.mode, net:net };
}
// ── 사업성 점검(미래의 상용화를 위한 사전 검증) ──
/** 수수료 수입 모형: 거래 규모 → 수수료 수입·투자자 절감액·손익분기. 요율과 비용은 모두 가정값이다. */
function feeModel(o) {
  o = o || {}; var n = function (x, d) { var v = Number(String(x == null ? '' : x).replace(/,/g, '')); return isFinite(v) && v >= 0 ? v : d; };
  var trades = n(o.ft, 1000), amt = n(o.fa, 500000), cost = n(o.fc, 5000000), fee = n(o.fr, 0.0015) / 100, brk = n(o.br, 0.015) / 100, vol = trades * amt * 22;
  var rev = vol * fee, save = vol * (brk - fee), be = fee > 0 ? cost / fee : null;
  return { trades:trades, amt:amt, cost:cost, fee:fee, brk:brk, volume:vol, revenue:rev, saving:save, profit:rev - cost, breakEvenVolume:be, breakEvenTradesPerDay:be != null && amt > 0 ? be / (amt * 22) : null };
}
/** 감독 AI 한도별 성적: 심은 이상 변동 중 몇 건을 잡았나(탐지), 정상인 날을 몇 번 잘못 잡았나(오탐). */
function detectTable(data, limits) {
  return (limits || [0.1, 0.2, 0.3, 0.4]).map(function (lim) {
    var total = 0, hit = 0, fa = 0, normal = 0;
    data.cos.forEach(function (c) { var inj = {}; c.anom.forEach(function (a) { inj[a.day] = 1; }); for (var d = 1; d < c.series.length; d++) { var big = Math.abs((c.series[d] - c.series[d - 1]) / c.series[d - 1]) > lim; if (inj[d]) { total++; if (big) hit++; } else { normal++; if (big) fa++; } } });
    return { limit:lim, total:total, hit:hit, recall:total ? hit / total : null, falseAlarms:fa, normalDays:normal };
  });
}
/** 평가 구간 백테스트: 화면이 쓰는 가정(성장 3%·요구수익률 10%)으로 낸 구간 안에 "진짜" 수익가치가 들어오는 비율. 증권 화면 모듈이 없으면 null. */
function backtest(data) {
  var n = 0, hit = 0, w = 0, skipped = 0;
  data.cos.forEach(function (c) { var v = valueCo(c); if (!v) return; if (v.mode !== 'range' || !(v.net > 0)) { skipped++; return; } var truth = v.net * (1 + c.gTrue / 100) / ((c.rTrue - c.gTrue) / 100); n++; if (truth >= v.low && truth <= v.high) hit++; w += v.high / v.low; });
  if (!n && !skipped && !data.cos.length) return null; if (!window.NaviStock) return null;
  return { n:n, hit:hit, rate:n ? hit / n : null, avgWidth:n ? w / n : null, skipped:skipped };
}
/** 장부 변조 시험: 이음 장부를 만들고 한 곳씩 몰래 바꿔 검증이 잡아내는지 본다(저장하지 않음). 공통 장부·웹 암호 모듈이 없으면 null. */
function chainTest(seed, trials) {
  var L = window.NaviLedger; if (!L || !L.secAppend || !L.secVerify || !(window.crypto && window.crypto.subtle)) return Promise.resolve(null);
  var r = rng(seed), st = { recs:[], alerts:[] }, N = ci(trials, 1, 100, 30), syms = ['A', 'B', 'C'];
  function add(rec) { return L.secAppend(st, rec).then(function (x) { if (x) st.recs.push(x); return !!x; }); }
  var p = add(L.secGrant());
  for (var i = 0; i < 14; i++) (function () { p = p.then(function () { var pl = L.secPlan(L.secState(st.recs), { kind:r() < 0.7 ? 'buy' : 'sell', sym:pick(r, syms), cls:'국내주식', qty:1 + Math.floor(r() * 5), px:1000 + Math.floor(r() * 50), d:'2026-11-25' }, st.recs.length); return pl.ok ? add(pl.rec) : true; }); })();
  return p.then(function () {
    return L.secVerify(st.recs).then(function (base) {
      var det = 0, run = Promise.resolve();
      for (var t = 0; t < N; t++) (function () { run = run.then(function () {
        var c = JSON.parse(JSON.stringify(st.recs)), k = Math.floor(r() * c.length), m = Math.floor(r() * 4), x = c[k];
        if (m === 0 && x.qty) x.qty += 1; else if (m === 1 && x.px) x.px += 1; else if (m === 2) x.lines[0][1] = Number(x.lines[0][1]) + 1; else if (m === 3 && c.length > 2 && k > 0 && k < c.length - 1) c.splice(k, 1); else x.lines[0][1] = Number(x.lines[0][1]) + 1;
        return L.secVerify(c).then(function (v) { if (!v.ok) det++; });
      }); })();
      return run.then(function () { return L.secVerify(st.recs.slice(0, -1)).then(function (tv) { return { records:st.recs.length, trials:N, detected:det, baselineOk:base.ok, tailTruncationDetected:!tv.ok }; }); });
    });
  });
}
/** 감독 AI: 하루 변동이 한도(기본 ±30%)를 넘는 날을 모두 찾는다. */
function scan(co, limit, upto) {
  var lim = limit || (window.NaviLedger && window.NaviLedger.DEV_LIMIT) || 0.3, out = [];
  for (var d = 1; d < Math.min(co.series.length, upto == null ? co.series.length : upto + 1); d++) { var ch = (co.series[d] - co.series[d - 1]) / co.series[d - 1]; if (Math.abs(ch) > lim) out.push({ day:d, change:ch, from:co.series[d - 1], to:co.series[d] }); }
  return out;
}

// ── 화면: 페이지 안쪽에서 오른쪽으로 밀려 나오는 패널(슬라이드 아웃) ──
function h(tag, a, kids) { var e = document.createElement(tag), k; for (k in (a || {})) { var v = a[k]; if (v == null || v === false) continue; if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e[k] = v; else e.setAttribute(k, v === true ? '' : v); } (kids || []).forEach(function (c) { if (c == null || c === false) return; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); return e; }
function tbl(head, rows, rcols) { return h('div', { class:'tbw' }, [h('table', {}, [h('thead', {}, [h('tr', {}, head.map(function (t, i) { return h('th', { class:rcols && rcols.indexOf(i) >= 0 ? 'r' : '', text:t }); }))]), h('tbody', {}, rows.map(function (rw) { return h('tr', {}, rw.map(function (c, i) { var o = c && typeof c === 'object' ? c : { t:c }; return h('td', { class:(rcols && rcols.indexOf(i) >= 0 ? 'r ' : '') + (o.c || ''), text:String(o.t) }); })); }))])]); }
function fld(id, label, val, o) { o = o || {}; var i = o.opts ? h('select', { id:id, 'aria-label':label, onchange:function () { if (ST._redraw) ST._redraw(); } }, o.opts.map(function (x) { return h('option', { value:x[0], text:x[1] }); })) : h('input', { id:id, type:'text', inputmode:'numeric', value:val, 'aria-label':label, onchange:function () { if (!/^sm-(n|sp|odd|mo|st|in|fx|vol|opex|seed)$/.test(id) && ST._redraw) ST._redraw(); } }); if (o.opts) i.value = val; return h('label', { for:id }, [label, i]); }
function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
var CSS = '.nsim-pn{position:fixed;top:0;right:0;bottom:0;width:min(480px,100vw);z-index:9000;background:#fff;color:#1b1d21;box-shadow:-8px 0 28px rgba(0,0,0,.22);border-left:1px solid #d9dce1;display:flex;flex-direction:column;transform:translateX(105%);transition:transform .22s ease;font:14px/1.5 system-ui,sans-serif}'
  + '.nsim-pn.on{transform:none}@media (prefers-reduced-motion:reduce){.nsim-pn{transition:none}}'
  + '.nsim-pn .hd{padding:14px 16px 8px;border-bottom:1px solid #e3e5e9}.nsim-pn .bdy{padding:8px 16px 24px;overflow:auto;flex:1}'
  + '.nsim-pn h2{margin:0;font-size:18px}.nsim-pn .bd{display:inline-block;padding:2px 8px;border-radius:99px;background:#fde9c8;color:#7a4a00;font-size:12px;font-weight:700;margin-left:8px}'
  + '.nsim-pn .sub{color:#5b6068;font-size:13px;margin:4px 0}.nsim-pn .row{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin:10px 0}.nsim-pn label{display:flex;flex-direction:column;font-size:12px;color:#5b6068;gap:2px}'
  + '.nsim-pn input,.nsim-pn select{padding:6px 8px;border:1px solid #c5c9d0;border-radius:8px;font:inherit;min-width:80px;max-width:100%}.nsim-pn button{padding:7px 12px;border-radius:99px;border:1px solid #c5c9d0;background:#f3f4f6;font:inherit;cursor:pointer}'
  + '.nsim-pn button.pri{background:#1e8a5a;border-color:#1e8a5a;color:#fff}.nsim-pn button.cur{background:#e8f0fe;border-color:#1a73e8;color:#174ea6;font-weight:700}.nsim-pn .chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}'
  + '.nsim-pn table{border-collapse:collapse;width:100%;margin:6px 0}.nsim-pn th,.nsim-pn td{border-bottom:1px solid #e3e5e9;padding:4px 6px;text-align:left;font-size:12.5px}'
  + '.nsim-pn .r{text-align:right}.nsim-pn .bad{color:#b3261e;font-weight:700}.nsim-pn .ok{color:#1e8a5a}.nsim-pn .box{border:1px solid #e3e5e9;border-radius:12px;padding:10px;margin:10px 0}.nsim-pn .tbw{overflow:auto;max-height:300px}';
var ST = {};   // 종류별 입력·가상 데이터(패널을 닫으면 지운다)
var PAGES = {
  stock:{ name:'증권', tabs:[['portfolio', '내 포트폴리오'], ['value', '내 가치'], ['wage', '내 임금'], ['explore', '종목 탐색'], ['company', '기업 평가'], ['order', '모의 주문'], ['trades', '거래 기록'], ['watch', '관심 종목'], ['alloc', '자산 배분'], ['goal', '목표 계산기'], ['learn', '투자 점검·용어']] },
  bank:{ name:'은행', tabs:[['wallet', '내 지갑'], ['topup', '충전·입금'], ['pay', '송금·결제'], ['history', '거래 내역'], ['save', '예금·대출'], ['credit', '신용·채권']] },
  tax:{ name:'세무 회계', tabs:[['slip', '거래 전표'], ['vat', '부가세'], ['stmts', '재무제표'], ['exp', '판관비'], ['inc', '소득세']] },
  home:{ name:'홈', tabs:[['tour', '화면 투어'], ['input', '입력창·예시 줄'], ['people', '사람 찾기'], ['chat', '대화'], ['attach', '첨부'], ['code', '나비 숫자 코드']] },
  mail:{ name:'메일', tabs:[['compose', '편지쓰기'], ['drafts', 'Draft'], ['sent', '보낸메일함'], ['inbox', '받은메일함'], ['tags', '태그별 보관함']] },
  guide:{ name:'나비 길잡이', tabs:[['new', '새 과제'], ['prog', '진행 중'], ['done', '완료']] },
  settings:{ name:'설정', tabs:[['account', '계정'], ['profile', '프로필'], ['ai', 'AI 비서'], ['gdc', 'GDC 지갑'], ['skin', '화면'], ['phone', '폰 전용'], ['signature', '서명'], ['autoreply', '부재중 자동응답']] },
  pdv:{ name:'내 기록', tabs:[['vault', '내 데이터 금고'], ['tx', '거래'], ['is', '손익'], ['bs', '재무상태'], ['cf', '현금흐름'], ['fa', '재무분석'], ['docs', '서류']] },
  myforms:{ name:'내 서류함', tabs:[['forms', '양식 보관·재사용']] },
  othersite:{ name:'다른 사이트 입력', tabs:[['steps', '옮겨 적기 순서']] },
  docs:{ name:'서류 작성', tabs:[['write', '작성 전 과정'], ['drafts', 'Draft'], ['done', '작성한 서류']] },
  learn:{ name:'교육', tabs:[['subjects', '내 수업'], ['plan', '진행 현황'], ['history', '학습 기록'], ['report', '학습 보고서'], ['career', '진로 추천']] },
  insure:{ name:'보험', tabs:[['mine', '내 보험'], ['rate', '요율 원리'], ['data', '상품과 공개 데이터'], ['claims', '청구 기록'], ['learn', '점검·용어']] },
  market:{ name:'시장', tabs:[['s0', '상품 이름'], ['s1', '구매 이력'], ['s2', '필요도'], ['s3', '구매 의사'], ['s4', '의견'], ['s5', 'AS 평가'], ['s6', '가격 비교'], ['s7', '판매자 협의'], ['s8', '최종 확인'], ['s9', '결제'], ['s10', '국세청 보고'], ['sell', '판매']] }
};
var LEAD = {
  home:'가상 화면과 가상 이용자로 홈 화면의 입력창·사람 찾기·대화·첨부·숫자 코드를 연습해 볼 수 있어요.',
  mail:'가상 주소록과 가상 메일로 편지 쓰기·보관함·태그 분류를 해 볼 수 있어요. 실제로 발송되지 않아요.', guide:'가상 과제로 할 일 나누기, 진행 확인, 성패와 원인 기록을 해 볼 수 있어요.',
  settings:'가상 값으로 설정의 각 탭을 미리 해 볼 수 있어요. 여기서 바꾼 것은 실제 설정에 반영되지 않아요.',
  pdv:'가상 월별 기록으로 내 기록(PDV)의 금고·거래·재무제표·서류 화면이 어떻게 이어지는지 해 볼 수 있어요.', myforms:'가상 양식으로 서류함에 담고 다시 쓰는 흐름을 해 볼 수 있어요.', othersite:'다른 사이트에 옮겨 적을 때 도우미와 사용자가 맡는 일을 순서대로 해 볼 수 있어요.', docs:'가상 서류로 작성 → 준법 점검 → 확정 → 보관까지 한 바퀴를 해 볼 수 있어요.',
  learn:'가상 학습자 한 명의 정답률·학습 기록으로 수업 조정, 진행 확인, 이상 탐지, 보고서를 해 볼 수 있어요.',
  insure:'가상 가입자·사고·청구로 보험료와 요율, 청구 심사가 어떻게 돌아가는지 해 볼 수 있어요. 요율은 모두 예시예요.',
  market:'가상 상품과 판매처 가격으로 구매 단계를 하나씩 해 볼 수 있어요.', tax:'가상 거래로 전표·부가세·재무제표·소득세가 어떻게 이어지는지 해 볼 수 있어요.',
  bank:'가상 월별 수입·지출로 지갑·충전·결제·내역·예금·신용을 해 볼 수 있어요.', stock:'가상 기업과 시세로 증권 화면의 각 탭을 해 볼 수 있어요. 모든 요율·가정은 예시예요.'
};
var DEF = { home:{}, mail:{}, guide:{}, settings:{}, pdv:{ months:'12', start:'1000000', income:'2800000', fixed:'1900000', vol:'20' }, myforms:{}, othersite:{}, docs:{}, learn:{ weeks:'8' }, insure:{ n:'500', rate:'4', prem:'20000', cov:'10000000' }, market:{ n:'6', spread:'8', odd:'15' }, tax:{ n:'14', opex:'0' }, bank:{ months:'12', start:'1000000', income:'2800000', fixed:'1900000', vol:'20' }, stock:{ n:'12', ft:'1000', fa:'500000', fc:'5000000', fr:'0.0015', br:'0.015' } };
var X = {   // 탭별 보조 입력의 기본값
  pi:'0', q:'', need:'3', bud:'', ask:'', my:'', bal:'5000000', co:'0', g:'3', r:'10', w:'3000000', wa:'60', wb:'30', sv:'300000', yr:'10', tg:'100000000', px:'10', tp:'1000000', ti:'3', dp:'10000000', rt:'3', dm:'12'
};
function cur(id) { var s = ST[CUR]; return s && s.vals && s.vals[id] != null ? s.vals[id] : ''; }
var num = function (id, d) { var c = cur(id), v = Number(String(c).replace(/,/g, '')); return c !== '' && isFinite(v) ? v : d; };
function sumBox(id, lines) { return h('div', { class:'box', id:id }, lines.map(function (x) { return h('div', { class:'sub' }, typeof x === 'string' ? [x] : x); })); }
function pc(x) { return x == null ? '—' : (x * 100).toFixed(1) + '%'; }
/** 연 단위 가상 경로 200번: 시작액·월 저축·수익률·변동성 가정으로 p10/p50/p90을 구한다(시드 고정). */
function trials(seed, o) {
  var r = rng(seed * 13 + 5), out = [], t, y, v;
  for (t = 0; t < 200; t++) { v = o.start; for (y = 0; y < o.years; y++) v = Math.max(0, v * (1 + o.mu + o.sigma * gauss(r)) + o.monthly * 12); out.push(v); }
  out.sort(function (a, b) { return a - b; }); return { p10:out[20], p50:out[100], p90:out[180], all:out };
}
function chipsRow(kind) {
  var s = ST[kind];
  return h('div', { class:'chips', role:'tablist', 'aria-label':PAGES[kind].name + ' 탭별 시뮬레이션' }, PAGES[kind].tabs.map(function (t) { return h('button', { type:'button', role:'tab', class:s.tab === t[0] ? 'cur' : '', 'aria-selected':s.tab === t[0] ? 'true' : 'false', 'data-tab':t[0], text:t[1], onclick:function () { setTab(kind, t[0]); } }); }));
}
function stockList(d) {
  return d.cos.map(function (c) { var v = valueCo(c); return { c:c, v:v, size:window.NaviStock && window.NaviStock.sizeOf ? window.NaviStock.sizeOf(c.assets) : '' }; });
}
/** 보험: 가입자 n명이 1년 동안 사고(확률 rate%)를 겪고 보험금(보장액의 20~100%)을 받는 가상 한 해. */
function insure(seed, o) {
  o = o || {}; var r = rng(seed), n = ci(o.n, 10, 20000, 500), rate = Math.min(60, Math.max(0, Number(o.rate) || 4)) / 100, prem = ci(o.prem, 0, 1e7, 20000), cov = ci(o.cov, 0, 1e10, 10000000), acc = 0, pay = 0, i;
  for (i = 0; i < n; i++) if (r() < rate) { acc++; pay += Math.round(cov * (0.2 + r() * 0.8) / 1000) * 1000; }
  var income = n * prem * 12; return { seed:seed, n:n, rate:rate, prem:prem, cov:cov, accidents:acc, payout:pay, income:income, lossRatio:income ? pay / income : null };
}
var BODY = {};
BODY.insure = function (box, s, tab) {
  var d = s.data, o = s.opt, P = function (x) { return won(x) + '원'; };
  var inputs = h('div', { class:'row' }, [fld('sm-n', '가입자 수(10~20000)', o.n), fld('sm-rate', '연 사고율(%)', o.rate), fld('sm-prem', '월 보험료(원)', o.prem), fld('sm-cov', '보장액(원)', o.cov)]);
  if (tab === 'mine') {
    var cov = num('sm-mcov', 50000000), g = ci(num('sm-grade', 2), 1, 3, 2), mp = Math.round(cov * 0.0004 * (1 + 0.5 * (g - 1)) / 10) * 10;
    box.appendChild(h('div', { class:'row' }, [fld('sm-mcov', '내가 원하는 보장액(원)', String(cov)), fld('sm-grade', '위험 등급(1 낮음~3 높음)', String(g))]));
    box.appendChild(sumBox('sim-i-mine', ['월 보험료 ', [h('b', { text:P(mp) }), ' (예시 요율: 보장액의 0.04%에 등급 1단계마다 50% 가산)'], '가입·결제는 일어나지 않아요. 실제 요율은 보험사 AI가 정해요.']));
  }
  if (tab === 'rate') {
    box.appendChild(inputs);
    box.appendChild(tbl(['가입자 수', '사고 건수', '보험금 지급', '보험료 수입', '손해율'], [50, 500, 5000].map(function (n) { var x = insure(s.seed, { n:n, rate:o.rate, prem:o.prem, cov:o.cov }); return [won(n), x.accidents, P(x.payout), P(x.income), x.lossRatio == null ? '—' : pc(x.lossRatio)]; }), [0, 1, 2, 3, 4]));
    box.appendChild(sumBox('sim-i-rate', ['지금 입력(' + won(d.n) + '명): 손해율 ' + (d.lossRatio == null ? '—' : pc(d.lossRatio)) + ' — 100%를 넘으면 걷은 보험료보다 더 지급한 거예요.', '가입자가 적으면 손해율이 크게 흔들리고, 많아질수록 안정돼요(대수의 법칙). 다른 데이터로 여러 번 해 보세요.']));
  }
  if (tab === 'data') {
    var r = rng(s.seed + 41), names = ['실손의료', '운전자', '화재', '여행자', '펫'], rows = names.map(function (nm) { var n = 200 + Math.floor(r() * 4800), pr = 0.3 + r() * 0.6; return [nm, won(n) + '명', pc(pr), P(Math.round((5000 + r() * 40000) / 100) * 100)]; });
    box.appendChild(tbl(['상품', '가입자', '지급률(가상)', '월 보험료(가상)'], rows, [1, 2, 3]));
    box.appendChild(h('div', { class:'sub', text:'가상 상품과 가상 공개 데이터예요. 실제 상품·통계가 아니에요.' }));
  }
  if (tab === 'claims') {
    var rc = rng(s.seed + 53), cl = [], k, ws = [];
    for (k = 0; k < 10; k++) { var odd = rc() < 0.2, a = odd ? Math.round(3e6 * (3 + rc() * 3) / 1000) * 1000 : Math.round(3e6 * (0.5 + rc()) / 1000) * 1000; cl.push({ id:'C' + (k + 1), who:'가입자 ' + String.fromCharCode(65 + Math.floor(rc() * 4)), amt:a }); ws.push(a); }
    var bd = bandOf(ws), cnt = {}; cl.forEach(function (c) { cnt[c.who] = (cnt[c.who] || 0) + 1; });
    box.appendChild(tbl(['청구', '가입자', '금액', '심사'], cl.map(function (c) { var flag = c.amt > bd.hi || cnt[c.who] >= 4; return [c.id, c.who, P(c.amt), { t:flag ? '추가 확인' : '지급 가능', c:flag ? 'bad' : 'ok' }]; }), [2]));
    box.appendChild(h('div', { class:'sub', id:'sim-i-claims', text:'기준: 청구 금액이 중앙값 기준 구간(' + P(bd.lo) + ' ~ ' + P(bd.hi) + ')을 넘거나 한 가입자가 4번 이상 청구하면 추가 확인. 연습용 단순 규칙이고, 확인 대상이라고 부정이라는 뜻은 아니에요.' }));
  }
  if (tab === 'learn') {
    var QS = [['손해율이 100%를 넘으면?', ['걷은 보험료보다 더 지급했다', '이익이 났다', '사고가 없었다'], 0], ['가입자가 많아지면 손해율은?', ['더 크게 흔들린다', '더 안정된다', '항상 0%다'], 1], ['청구가 추가 확인 대상이 되면?', ['부정이 확정된 것이다', '더 살펴본다는 뜻이다', '자동으로 거절된다'], 1], ['이 화면의 요율은?', ['예시(가정) 값', '확정된 값', '정부 고시 값'], 0]];
    QS.forEach(function (q, qi) { var res = h('div', { class:'sub', id:'sim-il-r' + qi }); box.appendChild(h('div', { class:'box' }, [h('b', { text:(qi + 1) + '. ' + q[0] })].concat(q[1].map(function (tx, ti) { return h('div', {}, [h('button', { type:'button', text:tx, onclick:function () { res.textContent = ti === q[2] ? '맞아요.' : '다시 생각해 보세요.'; res.className = 'sub ' + (ti === q[2] ? 'ok' : 'bad'); } })]); })).concat([res]))); });
  }
};
BODY.stock = function (box, s, tab) {
  var d = s.data, o = s.opt, day = s.day, list = stockList(d), lim = (window.NaviLedger && window.NaviLedger.DEV_LIMIT) || 0.3;
  var dayBtn = function () { return h('div', { class:'row' }, [h('button', { type:'button', id:'sim-next', text:'하루 진행', onclick:function () { readOpt('stock'); if (s.day < d.days - 1) s.day++; ST._redraw(); } }), h('span', { class:'sub', text:'시세 ' + day + '일째 / ' + (d.days - 1) + '일' })]); };
  var nFld = h('div', { class:'row' }, [fld('sm-n', '기업 수(3~40)', o.n)]);
  if (tab === 'portfolio') {
    var r = rng(s.seed + 11), hold = list.slice(0, 5).map(function (x) { return { c:x.c, q:(1 + Math.floor(r() * 20)) * 10 }; }), tot0 = 0, tot = 0;
    box.appendChild(nFld); box.appendChild(dayBtn());
    box.appendChild(tbl(['종목', '수량', '평균 단가', '현재가', '평가손익'], hold.map(function (x) { var p0 = x.c.series[0], p = x.c.series[day]; tot0 += p0 * x.q; tot += p * x.q; return [x.c.name, x.q, won(p0) + '원', won(p) + '원', { t:(p >= p0 ? '+' : '−') + won(Math.abs(p - p0) * x.q) + '원', c:p < p0 ? 'bad' : 'ok' }]; }), [1, 2, 3, 4]));
    box.appendChild(sumBox('sim-p-sum', ['가상 보유 ' + hold.length + '종목 · 평가금액 ', [h('b', { text:won(tot) + '원' }), ' (매입 ' + won(tot0) + '원 대비 ' + (tot >= tot0 ? '+' : '−') + won(Math.abs(tot - tot0)) + '원)'], '실제 계좌가 아니에요. 하루 진행을 누르면 시세가 움직여요.']));
  }
  if (tab === 'value') {
    var ci0 = ci(o.co, 0, list.length - 1, 0), x = list[ci0], v = x.v;
    box.appendChild(h('div', { class:'row' }, [fld('sm-n', '기업 수(3~40)', o.n), fld('sm-co', '기업', String(ci0), { opts:list.map(function (y, i) { return [String(i), y.c.name]; }) })]));
    box.appendChild(sumBox('sim-v-sum', ['자산 ' + won(x.c.assets) + '원 · 부채 ' + won(x.c.debt) + '원 · 매출 ' + won(x.c.sales) + '원 · 매출원가 ' + won(x.c.cogs) + '원 · 판관비 ' + won(x.c.opex) + '원', v ? ['세후 영업이익 ', h('b', { text:won(v.net) + '원' }), ' → 가치 평가 구간 ', h('b', { text:won(v.low) + ' ~ ' + won(v.high) + '원' }), ' (성장 3%·요구수익률 10% 가정)'] : '계산 모듈이 없어 평가를 못 해요.', '구간이 넓을수록 가정에 따라 값이 크게 달라진다는 뜻이에요.']));
  }
  if (tab === 'wage') {
    var rw = rng(s.seed + 23), base = num('sm-w', Number(o.w || X.w)), ws = [], i;
    for (i = 0; i < 12; i++) ws.push(Math.round(base * (1 + gauss(rw) * 0.05) / 1000) * 1000);
    if (rw() < 0.5) ws[ci(rw() * 12, 0, 11, 3)] = Math.round(base * 1.9 / 1000) * 1000;
    var bd = bandOf(ws);
    box.appendChild(h('div', { class:'row' }, [fld('sm-w', '기준 월 임금(원)', String(base))]));
    box.appendChild(tbl(['월', '기록한 임금', '판정'], ws.map(function (w, k) { var out = w < bd.lo || w > bd.hi; return [(k + 1) + '월', won(w) + '원', { t:out ? '구간 밖' : '구간 안', c:out ? 'bad' : 'ok' }]; }), [1]));
    box.appendChild(sumBox('sim-w-sum', ['내 기록 12개월 중앙값 기준 구간 ', [h('b', { text:won(bd.lo) + ' ~ ' + won(bd.hi) + '원' })], '임금은 내가 적은 값이라 시장이 확인한 값이 아니에요. 같은 직종의 시장 통계도 없어서 비교는 못 해요.']));
  }
  if (tab === 'explore') {
    var f = s.f, shown = window.NaviStock && window.NaviStock.searchListings ? window.NaviStock.searchListings(list.map(function (x) { return { name:x.c.name, sector:x.c.sector, region:x.c.region, size:x.size, ref:x }; }), f).map(function (x) { return x.ref; }) : list;
    box.appendChild(h('div', { class:'row' }, [fld('sm-n', '기업 수(3~40)', o.n), fld('sm-sec', '업종', f.sector, { opts:[['', '전체']].concat(SECT.map(function (y) { return [y, y]; })) }), fld('sm-reg', '지역', f.region, { opts:[['', '전체']].concat(REG.map(function (y) { return [y, y]; })) }), fld('sm-sz', '규모', f.size, { opts:[['', '전체'], ['small', '소규모'], ['mid', '중간'], ['large', '큰 규모']] })]));
    box.appendChild(tbl(['기업', '업종', '지역', '가치 평가 구간'], shown.map(function (x) { return [x.c.name, x.c.sector, x.c.region, x.v ? won(x.v.low) + ' ~ ' + won(x.v.high) + '원' : '—']; }), [3]));
    var sel = document.getElementById('sm-sec'); if (sel) sel.value = f.sector; sel = document.getElementById('sm-reg'); if (sel) sel.value = f.region; sel = document.getElementById('sm-sz'); if (sel) sel.value = f.size;
  }
  if (tab === 'company') {
    var bt = backtest(d);
    box.appendChild(nFld);
    box.appendChild(tbl(['기업', '가치 평가 구간', '현재가'], list.map(function (x) { return [x.c.name, x.v ? won(x.v.low) + ' ~ ' + won(x.v.high) + '원' : '—', won(x.c.series[day]) + '원']; }), [1, 2]));
    box.appendChild(h('div', { class:'box', id:'sim-s-bt-box' }, [h('b', { text:'평가 구간 적중률 (성장 3%·요구수익률 10% 가정)' }), h('div', { class:'sub', id:'sim-s-bt', text:bt ? (bt.n ? '이익이 있는 기업 ' + bt.n + '곳 중 ' + bt.hit + '곳(' + pc(bt.rate) + ')의 "진짜 가치"가 구간 안에 들어왔어요. 구간 폭은 평균 ' + bt.avgWidth.toFixed(2) + '배예요. 진짜 가정은 성장 1~5%·요구수익률 8~12%에서 무작위로 정했어요.' : '이익이 있는 가상 기업이 없어 시험할 수 없어요.') : '' })]));
  }
  if (tab === 'order') {
    var fm = feeModel(o), px = num('sm-px', 10);
    box.appendChild(h('div', { class:'row' }, [fld('sm-ft', '하루 거래 건수', o.ft), fld('sm-fa', '건당 평균 금액(원)', o.fa), fld('sm-fr', '우리 수수료율(%)', o.fr), fld('sm-br', '기존 증권사 수수료율(%) 가정', o.br), fld('sm-fc', '월 운영비(원) 가정', o.fc)]));
    box.appendChild(h('div', { class:'sub', id:'sim-s-fee', text:'월 거래대금 ' + won(fm.volume) + '원 → 수수료 수입 ' + won(fm.revenue) + '원, 월 운영비를 빼면 ' + (fm.profit >= 0 ? '+' : '−') + won(Math.abs(fm.profit)) + '원. 투자자는 기존보다 월 ' + won(fm.saving) + '원을 덜 냅니다. 손익분기는 월 거래대금 ' + (fm.breakEvenVolume == null ? '—' : won(fm.breakEvenVolume) + '원') + '. 요율·비용은 확정값이 아닌 가정이에요.' }));
    box.appendChild(h('div', { class:'row' }, [fld('sm-px', '주문 가격이 어제보다 몇 % 달라졌나(%)', String(px))]));
    box.appendChild(sumBox('sim-o-sum', ['감독 AI 한도 ±' + Math.round(lim * 100) + '% → ', [h('b', { class:Math.abs(px) / 100 > lim ? 'bad' : 'ok', text:Math.abs(px) / 100 > lim ? '주문 보류·확인 대상' : '모의 체결 가능' })]]));
  }
  if (tab === 'trades') {
    box.appendChild(h('div', { class:'sub', text:'이음 장부를 만들고 한 곳씩 몰래 바꿔 보며 검증이 잡아내는지 봅니다(수량·가격·분개 금액 변경, 중간 전표 삭제). 맨 끝 전표 삭제는 따로 확인합니다.' }));
    box.appendChild(h('div', { class:'row' }, [h('button', { type:'button', id:'sim-chain', text:'변조 시험 하기', onclick:function () { var el = document.getElementById('sim-s-chain'); if (el) el.textContent = '시험 중…'; chainTest(s.seed, 30).then(function (rs) { s.chain = rs; var e2 = document.getElementById('sim-s-chain'); if (e2) e2.textContent = rs ? rs.records + '건짜리 장부에서 변조 ' + rs.trials + '번 중 ' + rs.detected + '번 잡았어요.' + (rs.tailTruncationDetected ? '' : ' 맨 끝 전표를 지우면 이 장부만으로는 못 잡아요(바깥에 기준 해시를 따로 둬야 해요).') : '시험 모듈이 없어요.'; }); } })]));
    box.appendChild(h('div', { class:'sub', id:'sim-s-chain', text:s.chain ? s.chain.records + '건짜리 장부에서 변조 ' + s.chain.trials + '번 중 ' + s.chain.detected + '번 잡았어요.' : '' }));
  }
  if (tab === 'watch') {
    var all = d.cos.reduce(function (a, c) { return a.concat(scan(c, null, day).map(function (x) { return { co:c.name, x:x }; })); }, []), dt = detectTable(d);
    box.appendChild(nFld); box.appendChild(dayBtn());
    box.appendChild(h('div', { class:'box', id:'sim-s-alerts' }, [h('b', { text:'감독 AI 알림 ' + all.length + '건' })].concat(all.slice(-6).reverse().map(function (a) { return h('div', { class:'sub bad', text:a.x.day + '일째 ' + a.co + ': ' + won(a.x.from) + ' → ' + won(a.x.to) + '원 (' + (a.x.change > 0 ? '+' : '') + (a.x.change * 100).toFixed(1) + '%)' }); }))));
    box.appendChild(tbl(['한도(±)', '심은 이상 변동', '잡은 건수', '탐지율', '정상 날 오탐'], dt.map(function (x) { return [Math.round(x.limit * 100) + '%', x.total, x.hit, pc(x.recall), { t:x.falseAlarms + ' / ' + x.normalDays, c:x.falseAlarms ? 'bad' : '' }]; }), [1, 2, 3, 4]));
    box.appendChild(h('div', { class:'sub', text:'한도를 낮추면 더 많이 잡지만 정상 변동을 잘못 잡는 일이 늘어요. 이 가상 시세는 정상 변동이 작아 오탐이 적게 나오니, 실제 시세에서는 다시 재야 해요.' }));
  }
  if (tab === 'alloc') {
    var wa = num('sm-wa', 60), wb = num('sm-wb', 30), wc = Math.max(0, 100 - wa - wb), tot2 = wa + wb + wc, mu = (wa * 0.07 + wb * 0.03 + wc * 0.02) / tot2, sg = Math.sqrt(Math.pow(wa / tot2 * 0.18, 2) + Math.pow(wb / tot2 * 0.06, 2));
    var tr = trials(s.seed, { start:10000000, monthly:0, years:10, mu:mu, sigma:sg });
    box.appendChild(h('div', { class:'row' }, [fld('sm-wa', '주식 비중(%)', String(wa)), fld('sm-wb', '채권 비중(%)', String(wb))]));
    box.appendChild(sumBox('sim-a-sum', ['현금 비중 ' + wc + '% · 1천만 원을 10년 두었을 때 가상 200번의 결과', ['나쁜 10% 경우 ', h('b', { text:won(tr.p10) + '원' }), ' · 중간 ', h('b', { text:won(tr.p50) + '원' }), ' · 좋은 10% 경우 ', h('b', { text:won(tr.p90) + '원' })], '가정: 주식 연 7%·변동 18%, 채권 3%·6%, 현금 2%. 모두 예시 값이고 합산은 단순화했어요.']));
  }
  if (tab === 'goal') {
    var sv = num('sm-sv', 300000), yr = ci(num('sm-yr', 10), 1, 40, 10), rt = num('sm-grt', 5) / 100, tg = num('sm-tg', 100000000), t2 = trials(s.seed, { start:0, monthly:sv, years:yr, mu:rt, sigma:0.12 });
    var hit = t2.all.filter(function (v) { return v >= tg; }).length;
    box.appendChild(h('div', { class:'row' }, [fld('sm-sv', '월 저축(원)', String(sv)), fld('sm-yr', '기간(년)', String(yr)), fld('sm-grt', '연 수익률 가정(%)', String(rt * 100)), fld('sm-tg', '목표 금액(원)', String(tg))]));
    box.appendChild(sumBox('sim-g-sum', ['가상 200번 중 목표를 넘긴 경우 ' + hit + '번(' + Math.round(hit / 2) + '%)', ['나쁜 10% 경우 ', h('b', { text:won(t2.p10) + '원' }), ' · 중간 ', h('b', { text:won(t2.p50) + '원' }), ' · 좋은 10% 경우 ', h('b', { text:won(t2.p90) + '원' })], '수익률은 약속된 값이 아니라 가정이에요. 변동 12%로 흔들어 봤어요.']));
  }
  if (tab === 'learn') {
    var QS = [['분산 투자란?', ['한 종목에 몰아 넣는다', '여러 종목·자산에 나눠 넣는다', '빚을 내서 넣는다'], 1], ['수익률 가정이 높을수록 목표 계산 결과는?', ['더 낙관적으로 나온다', '변하지 않는다', '더 보수적으로 나온다'], 0], ['한 날 가격이 한도(±30%)를 넘으면 감독 AI는?', ['그대로 체결한다', '보류하고 확인한다', '자동으로 매도한다'], 1], ['가치 평가 구간이 넓다는 뜻은?', ['가정에 따라 값이 크게 달라진다', '정확하다', '무조건 싸다'], 0], ['이 화면의 수수료율·한도는?', ['확정된 값', '예시(가정) 값', '정부 고시 값'], 1]];
    QS.forEach(function (q, qi) { var res = h('div', { class:'sub', id:'sim-l-r' + qi }); box.appendChild(h('div', { class:'box' }, [h('b', { text:(qi + 1) + '. ' + q[0] })].concat(q[1].map(function (t, ti) { return h('div', {}, [h('button', { type:'button', text:t, onclick:function () { res.textContent = ti === q[2] ? '맞아요.' : '다시 생각해 보세요.'; res.className = 'sub ' + (ti === q[2] ? 'ok' : 'bad'); } })]); })).concat([res]))); });
  }
};
BODY.bank = function (box, s, tab) {
  var d = s.data, o = s.opt, last = d.rows[d.rows.length - 1];
  var inputs = h('div', { class:'row' }, [fld('sm-mo', '기간(개월)', o.months), fld('sm-st', '시작 잔고(원)', o.start), fld('sm-in', '월 수입(원)', o.income), fld('sm-fx', '월 고정 지출(원)', o.fixed), fld('sm-vol', '수입 변동(%)', o.vol)]);
  if (tab === 'wallet') {
    box.appendChild(inputs);
    box.appendChild(tbl(['월', '월초 잔고', '월말 잔고', '거절된 결제'], d.rows.map(function (x) { return [x.ym, won(x.open), { t:won(x.close), c:x.close < 0 ? 'bad' : '' }, { t:x.rejected, c:x.rejected ? 'bad' : '' }]; }), [1, 2, 3]));
    box.appendChild(h('div', { class:'box', id:'sim-b-sum' }, [h('div', { class:'sub' }, ['최종 잔고 ', h('b', { text:won(d.end) + '원' }), ' · 가장 낮았던 잔고 ', h('b', { text:won(d.min) + '원' }), ' · 잔액 부족으로 거절된 결제 ', h('b', { text:d.rejected + '건' })]), h('div', { class:'sub ' + (d.reconciled ? 'ok' : 'bad'), text:d.reconciled ? '장부 대조: 시작 잔고 + 성공한 입출금 = 최종 잔고 ✓' : '장부 대조: 맞지 않아요' })]));
  }
  if (tab === 'topup') {
    var bal = num('sm-bal', Number(X.bal)), t1 = num('sm-tp', 1000000), n = ci(num('sm-ti', 3), 1, 12, 3), after = bal + t1 * n;
    box.appendChild(h('div', { class:'row' }, [fld('sm-bal', '충전 전 잔고(원)', String(bal)), fld('sm-tp', '1회 충전액(원)', String(t1)), fld('sm-ti', '충전 횟수', String(n))]));
    box.appendChild(sumBox('sim-t-sum', ['충전 ' + n + '번 뒤 잔고 ', [h('b', { text:won(after) + '원' }), ' (+' + won(t1 * n) + '원)'], '가상 충전이에요. 실제 한도·수수료는 반영하지 않았어요.']));
  }
  if (tab === 'pay') {
    var rej = d.ents.filter(function (e) { return !e.ok; });
    box.appendChild(inputs);
    box.appendChild(sumBox('sim-pay-sum', ['잔액이 모자라 거절된 결제 ' + rej.length + '건', rej.length ? '가장 먼저 거절된 달: ' + rej[0].ym + ' (' + rej[0].what + ' ' + won(Math.abs(rej[0].amt)) + '원)' : '이 조건에서는 거절이 없었어요.', '월 수입을 줄이거나 고정 지출을 늘려 거절이 생기는 조건을 찾아 보세요.']));
    box.appendChild(tbl(['월', '항목', '금액', '결과'], d.ents.filter(function (e) { return e.amt < 0; }).slice(0, 14).map(function (e) { return [e.ym, e.what, won(e.amt) + '원', { t:e.ok ? '결제됨' : '거절', c:e.ok ? 'ok' : 'bad' }]; }), [2]));
  }
  if (tab === 'history') {
    var r = rng(s.seed + 31), cats = ['교통', '식비', '통신', '학비', '기타'], w = cats.map(function () { return 0.5 + r(); }), sw = w.reduce(function (a, b) { return a + b; }, 0), spend = Number(o.fixed) || 1900000;
    box.appendChild(inputs);
    box.appendChild(tbl(['분야', '최근 30일 지출', '비중'], cats.map(function (c, i) { return [c, won(Math.round(spend * w[i] / sw)) + '원', pc(w[i] / sw)]; }), [1, 2]));
    box.appendChild(h('div', { class:'sub', text:'월 고정 지출을 분야별로 무작위로 나눈 연습용 내역이에요. 국민 평균과 비교는 실제 통계가 있어야 해서 여기서는 하지 않아요.' }));
  }
  if (tab === 'save') {
    var pr = num('sm-dp', 10000000), rt = num('sm-rt', 3) / 100, mm = ci(num('sm-dm', 12), 1, 120, 12), gain = Math.round(pr * rt * mm / 12);
    box.appendChild(h('div', { class:'row' }, [fld('sm-dp', '예금 원금(원)', String(pr)), fld('sm-rt', '연 이율 가정(%)', String(rt * 100)), fld('sm-dm', '기간(개월)', String(mm))]));
    box.appendChild(sumBox('sim-sv-sum', ['단리 이자 ', [h('b', { text:won(gain) + '원' }), ' → 만기 ' + won(pr + gain) + '원'], '이율은 예시예요. 대출 한도는 가상 재무제표가 있어야 해서 신용·채권 탭에서 봐요.']));
  }
  if (tab === 'credit') {
    var rj = d.rejected, sc = Math.max(300, Math.min(900, 800 - rj * 40 - (d.min < 0 ? 100 : 0))), grade = sc >= 750 ? '우수' : sc >= 600 ? '보통' : '주의';
    box.appendChild(inputs);
    box.appendChild(sumBox('sim-c-sum', ['가상 신용 점수 ', [h('b', { text:sc + '점(' + grade + ')' })], '규칙(연습용): 800점에서 거절된 결제 1건마다 40점, 잔고가 마이너스였으면 100점을 뺐어요. 실제 신용 평가 기준이 아니에요.', '거절된 결제 ' + rj + '건 · 마지막 달 말 잔고 ' + won(last.close) + '원']));
  }
};
BODY.tax = function (box, s, tab) {
  var d = s.data, o = s.opt, T = d.tax, n = h('div', { class:'row' }, [fld('sm-n', '거래 수(2~40)', o.n), fld('sm-opex', '판매비·관리비(원)', o.opex)]);
  box.appendChild(n);
  if (tab === 'slip') box.appendChild(tbl(['전표', '구분', '품목', '수량', '공급가액', '부가세'], d.recs.map(function (x) { var sell = x.seller.owner === '나'; return [x.serial, sell ? '판매' : '구매', x.slip.what, x.slip.qty, won(x.slip.supply), won(x.vat)]; }), [3, 4, 5]));
  if (tab === 'vat') box.appendChild(sumBox('sim-t-sum', ['매출 ' + won(d.sales) + '원 · 매입 ' + won(d.purch) + '원', ['매출세액 ' + won(d.vatOut) + '원 − 매입세액 ' + won(d.vatIn) + '원 = ', h('b', { text:(d.vatDue >= 0 ? '납부 ' : '환급 ') + won(Math.abs(d.vatDue)) + '원' })]]));
  if (tab === 'stmts') box.appendChild(sumBox('sim-t-st', ['매출원가(평균 매입가): ' + (d.cogs == null ? '계산 모듈 없음' : won(d.cogs) + '원'), '원가 미확인 매출: ' + (d.uncovered == null ? '—' : won(d.uncovered) + '원'), ['영업이익 ', h('b', { text:d.op == null ? '—' : won(d.op) + '원' })]]));
  if (tab === 'exp') box.appendChild(sumBox('sim-t-exp', ['판관비 ' + won(Number(o.opex) || 0) + '원을 넣으면 영업이익은 ' + (d.op == null ? '—' : won(d.op) + '원') + '이에요.', '판관비를 바꿔 [가상 데이터 만들기]를 누르면 영업이익과 세금이 어떻게 달라지는지 볼 수 있어요. 판관비는 내가 적은 값이에요.']));
  if (tab === 'inc') box.appendChild(sumBox('sim-t-inc', T ? ['과세 기준 영업이익 ' + won(T.base) + '원', ['소득세 ' + won(T.tax) + '원 + 지방소득세 ' + won(T.local) + '원 = ', h('b', { text:won(T.total) + '원' })], '공제·감면이 없는 참고 계산이고 실제 징수가 아니에요.'] : ['영업이익이 0 이하이거나 계산 모듈이 없어 세금이 없어요.']));
};
BODY.market = function (box, s, tab) {
  var d = s.data, o = s.opt, rows = d.rows, pi = ci(o.pi, 0, rows.length - 1, 0), rw = rows[pi], r = rng(s.seed * 17 + pi), P = function (p) { return won(p) + '원'; }, band = rw.band;
  var verdict = function (p) { return p < band.lo ? '너무 낮음' : p > band.hi ? '제 값 초과' : '적정'; };
  var pickBest = function () { var ok = rw.offers.filter(function (x) { return x.v === '적정'; }).sort(function (a, b) { return a.price - b.price; }); return ok[0] || null; };
  box.appendChild(h('div', { class:'row' }, [fld('sm-n', '상품 수(1~12)', o.n), fld('sm-sp', '가격 흩어짐(%)', o.spread), fld('sm-odd', '이상 가격 비율(%)', o.odd), fld('sm-pi', '상품', String(pi), { opts:rows.map(function (x, i) { return [String(i), x.name]; }) })]));
  var sel = document.getElementById('sm-pi'); if (sel) sel.value = String(pi);
  box.appendChild(h('div', { class:'sub', text:rw.name + ' · 공정가격 구간 ' + P(band.lo) + ' ~ ' + P(band.hi) + ' (중앙값 ' + P(band.mid) + ')' }));
  if (tab === 's0') { var q = String(cur('sm-q') || ''); box.appendChild(h('div', { class:'row' }, [fld('sm-q', '상품 이름 검색', q)])); var hit = rows.filter(function (x) { return q && x.name.indexOf(q) >= 0; }); box.appendChild(sumBox('sim-m-q', [q ? '"' + q + '"이 들어간 상품 ' + hit.length + '개: ' + hit.map(function (x) { return x.name; }).join(', ') : '상품 이름의 일부를 적어 보세요.', '가상 상품 ' + rows.length + '개: ' + rows.map(function (x) { return x.name; }).join(', ')])); var qi = document.getElementById('sm-q'); if (qi) { qi.type = 'text'; qi.removeAttribute('inputmode'); qi.onchange = function () { ST._redraw(); }; } }
  if (tab === 's1') { var hist = [0, 1, 2, 3, 4].map(function () { return Math.round(rw.truth * (1 + (r() - 0.5) * 0.1) / 100) * 100; }), avg = hist.reduce(function (a, b) { return a + b; }, 0) / hist.length; box.appendChild(tbl(['지난 구매', '가격'], hist.map(function (p, i) { return [(i + 1) + '번째', P(p)]; }), [1])); box.appendChild(sumBox('sim-m-h', ['평균 구매가 ' + P(avg) + ' · 지금 공정가격 중앙값 ' + P(band.mid) + ' → ' + (avg > band.hi ? '예전에 비싸게 샀을 수 있어요' : '비슷한 값에 사 왔어요')])); }
  if (tab === 's2') { var nd = ci(num('sm-need', 3), 1, 5, 3); box.appendChild(h('div', { class:'row' }, [fld('sm-need', '필요도(1~5)', String(nd))])); box.appendChild(sumBox('sim-m-n', ['필요도 ' + nd + ' → ', [h('b', { text:nd >= 4 ? '급해요: 가격 구간 안이면 바로 진행' : nd <= 2 ? '급하지 않아요: 구간 아래로 내려갈 때까지 기다려도 돼요' : '보통: 가격 비교 뒤 결정' })], '연습용 단순 규칙이에요.'])); }
  if (tab === 's3') { var bud = num('sm-bud', band.mid); box.appendChild(h('div', { class:'row' }, [fld('sm-bud', '내 예산(원)', String(bud))])); box.appendChild(sumBox('sim-m-b', ['예산 ' + P(bud) + ' → ', [h('b', { class:verdict(bud) === '적정' ? 'ok' : 'bad', text:bud < band.lo ? '구간보다 낮아 이 값에는 살 곳이 없을 수 있어요' : bud > band.hi ? '구간보다 높아요. 더 싼 곳이 있어요' : '구간 안이에요' })]])); }
  if (tab === 's4') { var ops = [0, 1, 2, 3, 4, 5, 6, 7].map(function () { return 3 + Math.round(r() * 2); }); ops.push(1); ops.push(5); var m = ops.reduce(function (a, b) { return a + b; }, 0) / ops.length, sorted = ops.slice().sort(function (a, b) { return a - b; }), tm = sorted.slice(1, -1).reduce(function (a, b) { return a + b; }, 0) / (sorted.length - 2); box.appendChild(sumBox('sim-m-o', ['가상 별점 ' + ops.join(', '), '평균 ' + m.toFixed(2) + '점 · 가장 낮은 값과 높은 값을 뺀 평균 ' + tm.toFixed(2) + '점', '극단 의견 하나가 평균을 흔드는 정도를 봐요.'])); }
  if (tab === 's5') { var as = rw.offers.map(function (x) { return { x:x, as:1 + Math.floor(r() * 5) }; }); box.appendChild(tbl(['판매처', '가격', '판정', 'AS 점수'], as.map(function (a) { return [a.x.seller, P(a.x.price), { t:a.x.v, c:a.x.v === '적정' ? 'ok' : 'bad' }, a.as + '점']; }), [1, 3])); }
  if (tab === 's6') box.appendChild(tbl(['판매처', '가격', '판정'], rw.offers.map(function (x) { return [x.seller, P(x.price), { t:x.v, c:x.v === '적정' ? 'ok' : 'bad' }]; }), [1]));
  if (tab === 's7') { var ask = num('sm-ask', band.mid); box.appendChild(h('div', { class:'row' }, [fld('sm-ask', '내가 제안할 가격(원)', String(ask))])); box.appendChild(sumBox('sim-m-a', ['제안 ' + P(ask) + ' → ', [h('b', { class:ask > band.hi ? 'bad' : 'ok', text:ask > band.hi ? '구간을 넘어서 받아들이기 어려워요(연습 규칙)' : ask < band.lo ? '너무 낮아 판매자가 거절할 수 있어요' : '합의할 만한 가격이에요' })]])); }
  if (tab === 's8') { var b = pickBest(); box.appendChild(sumBox('sim-m-f', b ? ['가장 싼 적정 가격: ' + b.seller + ' ' + P(b.price), '가격 판정 ✓ · 구간 안 ✓ · 최종 확인 뒤 결제로 넘어가요'] : ['적정 가격 판매처가 없어요. 다른 데이터로 다시 해 보세요.'])); }
  if (tab === 's9') { var b9 = pickBest(), bal = num('sm-bal', Number(X.bal)); box.appendChild(h('div', { class:'row' }, [fld('sm-bal', '내 잔고(원)', String(bal))])); box.appendChild(sumBox('sim-m-p', b9 ? ['결제 ' + P(b9.price) + ' → ' + (bal >= b9.price ? '내 잔고 ' + P(bal) + ' → ' + P(bal - b9.price) + ', 판매자 +' + P(b9.price) : '잔고가 모자라 결제가 거절돼요'), '실제 돈은 움직이지 않아요.'] : ['결제할 판매처가 없어요.'])); }
  if (tab === 's10') { var b10 = pickBest(); box.appendChild(sumBox('sim-m-t', b10 ? ['결제액 ' + P(b10.price) + ' = 공급가액 ' + P(Math.round(b10.price / 1.1)) + ' + 부가세 ' + P(b10.price - Math.round(b10.price / 1.1)), '가상 보고예요. 실제 국세청에는 가지 않아요.'] : ['보고할 거래가 없어요.'])); }
  if (tab === 'sell') { var my = num('sm-my', band.mid); box.appendChild(h('div', { class:'row' }, [fld('sm-my', '내 판매 가격(원)', String(my))])); box.appendChild(sumBox('sim-m-s', ['내 가격 ' + P(my) + ' → ', [h('b', { class:verdict(my) === '적정' ? 'ok' : 'bad', text:verdict(my) })], '경쟁 판매처 가격: ' + rw.offers.map(function (x) { return P(x.price); }).join(', ')])); }
};
/** 교육: 가상 학습자 한 명의 과목별 주간 정답률과 하루 학습 기록. */
var SUBJ = ['국어', '수학', '영어', '과학', '사회'];
function learn(seed, o) {
  o = o || {}; var r = rng(seed), weeks = ci(o.weeks, 2, 26, 8), base = SUBJ.map(function () { return 0.45 + r() * 0.4; }), rows = [], logs = [], w, i, d = 0;
  SUBJ.forEach(function (nm, si) { var sc = [], cur = base[si]; for (w = 0; w < weeks; w++) { cur = Math.min(0.99, Math.max(0.1, cur + 0.02 + gauss(r) * 0.04)); sc.push(cur); } rows.push({ name:nm, scores:sc, target:0.8 }); });
  for (i = 0; i < 20; i++) { var burst = r() < 0.12; logs.push({ day:'11-' + String(i + 1).padStart(2, '0'), min:burst ? Math.round(240 + r() * 120) : Math.round(20 + r() * 50), subject:SUBJ[Math.floor(r() * 5)], fastCorrect:burst ? Math.round(10 + r() * 10) : Math.floor(r() * 3) }); }
  return { seed:seed, weeks:weeks, rows:rows, logs:logs };
}
BODY.learn = function (box, s, tab) {
  var d = s.data, o = s.opt, last = function (x) { return x.scores[x.scores.length - 1]; };
  var wk = h('div', { class:'row' }, [fld('sm-wk', '기간(주)', o.weeks)]);
  if (tab === 'subjects') {
    var lvl = function (a) { return a >= 0.85 ? '한 단계 어렵게' : a < 0.6 ? '한 단계 쉽게' : '그대로'; };
    box.appendChild(wk); box.appendChild(tbl(['과목', '최근 정답률', '다음 수업'], d.rows.map(function (x) { return [x.name, pc(last(x)), lvl(last(x))]; }), [1]));
    box.appendChild(h('div', { class:'sub', id:'sim-e-sub', text:'규칙(연습용): 정답률 85% 이상이면 어렵게, 60% 미만이면 쉽게. 1:1로 난이도를 맞추는 원리만 보여 줘요.' }));
  }
  if (tab === 'plan') {
    box.appendChild(wk); box.appendChild(tbl(['과목', '목표', '지금', '상태'], d.rows.map(function (x) { var a = last(x), late = a < x.target - 0.1; return [x.name, pc(x.target), pc(a), { t:late ? '지연' : '순조', c:late ? 'bad' : 'ok' }]; }), [1, 2]));
    box.appendChild(h('div', { class:'sub', text:'목표(80%)에서 10%p 넘게 모자라면 지연으로 표시해요.' }));
  }
  if (tab === 'history') {
    var ms = d.logs.map(function (l) { return l.min; }), bd = bandOf(ms), odd = d.logs.filter(function (l) { return l.min > bd.hi || l.fastCorrect >= 10; });
    box.appendChild(tbl(['날짜', '과목', '학습(분)', '아주 빠른 정답', '확인'], d.logs.map(function (l) { var f = odd.indexOf(l) >= 0; return [l.day, l.subject, l.min, l.fastCorrect, { t:f ? '추가 확인' : '정상', c:f ? 'bad' : 'ok' }]; }), [2, 3]));
    box.appendChild(h('div', { class:'sub', id:'sim-e-hist', text:'하루 학습 시간이 평소 구간(' + won(bd.lo) + '~' + won(bd.hi) + '분)을 넘거나, 아주 빠른 정답이 10번 이상이면 추가 확인(몰아치기·답 복사 가능성). 의심일 뿐 단정은 아니에요. 추가 확인 ' + odd.length + '건.' }));
  }
  if (tab === 'report') {
    box.appendChild(wk); var sorted = d.rows.slice().sort(function (a, b) { return last(a) - last(b); });
    box.appendChild(sumBox('sim-e-rep', ['평균 정답률 ' + pc(d.rows.reduce(function (a, x) { return a + last(x); }, 0) / d.rows.length), '보충이 필요한 과목: ' + sorted.slice(0, 2).map(function (x) { return x.name + '(' + pc(last(x)) + ')'; }).join(', '), '잘하는 과목: ' + sorted.slice(-1).map(function (x) { return x.name + '(' + pc(last(x)) + ')'; }).join(', ')]));
  }
  if (tab === 'career') {
    var MAP = { 국어:'글쓰기·미디어', 수학:'데이터·공학', 영어:'국제·번역', 과학:'연구·의료', 사회:'법·행정' }, top = d.rows.slice().sort(function (a, b) { return last(b) - last(a); }).slice(0, 2);
    box.appendChild(sumBox('sim-e-car', ['가상 성적 상위 2과목: ' + top.map(function (x) { return x.name; }).join(', '), ['살펴볼 분야: ', h('b', { text:top.map(function (x) { return MAP[x.name]; }).join(', ') })], '성적만으로 진로를 정할 수는 없어요. 관심과 경험이 함께 있어야 해요.']));
  }
};

/** 서류함·외부 입력·서류 작성용 가상 데이터. */
var FORMS = ['임대차 계약서', '근로계약서', '정보공개 청구서', '사업자 등록 신청서', '위임장', '이의신청서'];
var FIELD_POOL = ['성명', '주민등록번호 앞자리', '주소', '연락처', '날짜', '금액', '사업자명', '서명란'];
function formsGen(seed, o) {
  var r = rng(seed), out = FORMS.map(function (nm) { var n = 3 + Math.floor(r() * 5), f = [], i; for (i = 0; i < n; i++) { var k = FIELD_POOL[Math.floor(r() * FIELD_POOL.length)]; if (f.indexOf(k) < 0) f.push(k); } return { name:nm, fields:f, uses:Math.floor(r() * 9) }; });
  return { seed:seed, forms:out };
}
function docsGen(seed, o) {
  var r = rng(seed), kinds = ['임대차 계약서', '근로계약서', '정보공개 청구서', '위임장', '이의신청서', '확인서'], issues = ['날짜가 빠졌어요', '금액 표기가 숫자와 한글이 달라요', '서명란이 비었어요', '당사자 주소가 없어요', '문제 없음'], out = kinds.map(function (k, i) { return { id:'D' + (i + 1), kind:k, saved:'11-' + String(10 + Math.floor(r() * 15)).padStart(2, '0'), issue:issues[Math.floor(r() * issues.length)], done:r() < 0.5 }; });
  return { seed:seed, docs:out };
}
var QZ = function (box, id, QS) { QS.forEach(function (q, qi) { var res = h('div', { class:'sub', id:id + qi }); box.appendChild(h('div', { class:'box' }, [h('b', { text:(qi + 1) + '. ' + q[0] })].concat(q[1].map(function (tx, ti) { return h('div', {}, [h('button', { type:'button', text:tx, onclick:function () { res.textContent = ti === q[2] ? '맞아요.' : '다시 생각해 보세요.'; res.className = 'sub ' + (ti === q[2] ? 'ok' : 'bad'); } })]); })).concat([res]))); }); };
BODY.pdv = function (box, s, tab) {
  var d = s.data, o = s.opt, inc = 0, out = 0, ents = d.ents.filter(function (e) { return e.ok; });
  ents.forEach(function (e) { if (e.amt > 0) inc += e.amt; else out -= e.amt; });
  var inputs = h('div', { class:'row' }, [fld('sm-mo', '기간(개월)', o.months), fld('sm-st', '시작 잔고(원)', o.start), fld('sm-in', '월 수입(원)', o.income), fld('sm-fx', '월 고정 지출(원)', o.fixed), fld('sm-vol', '수입 변동(%)', o.vol)]);
  if (tab === 'vault') {
    box.appendChild(h('div', { class:'sub', text:'기록은 앞 기록의 지문을 이어 붙여 쌓여요. 한 곳을 몰래 바꾸면 뒤 기록과 맞지 않아 드러나요. 가상 장부로 시험해 보세요.' }));
    box.appendChild(h('div', { class:'row' }, [h('button', { type:'button', id:'sim-chain', text:'변조 시험 하기', onclick:function () { var el = document.getElementById('sim-s-chain'); if (el) el.textContent = '시험 중…'; chainTest(s.seed, 30).then(function (rs) { var e2 = document.getElementById('sim-s-chain'); if (e2) e2.textContent = rs ? rs.records + '건짜리 장부에서 변조 ' + rs.trials + '번 중 ' + rs.detected + '번 잡았어요. 맨 끝 전표를 지우면 이 장부만으로는 못 잡아요(바깥에 기준 해시를 따로 둬야 해요).' : '시험 모듈이 없어요.'; }); } })]));
    box.appendChild(h('div', { class:'sub', id:'sim-s-chain' }));
  }
  if (tab === 'tx') { box.appendChild(inputs); box.appendChild(tbl(['월', '항목', '금액', '결과'], d.ents.slice(0, 24).map(function (e) { return [e.ym, e.what, won(e.amt) + '원', { t:e.ok ? '기록됨' : '잔액 부족', c:e.ok ? 'ok' : 'bad' }]; }), [2])); }
  if (tab === 'is') { box.appendChild(inputs); box.appendChild(sumBox('sim-p-is', ['수입 합계 ' + won(inc) + '원 · 지출 합계 ' + won(out) + '원', ['순이익 ', h('b', { text:won(inc - out) + '원' })], '가상 기록으로 만든 간이 손익이에요(K-IFRS 서식 아님).'])); }
  if (tab === 'bs') { box.appendChild(inputs); box.appendChild(sumBox('sim-p-bs', ['자산(기말 잔고) ' + won(d.end) + '원 = 부채 0원 + 자본 ' + won(d.end) + '원', '장부 대조: ' + (d.reconciled ? '시작 잔고 + 입출금 = 기말 잔고 ✓' : '맞지 않아요')])); }
  if (tab === 'cf') { box.appendChild(inputs); box.appendChild(sumBox('sim-p-cf', ['기초 ' + won(d.start) + '원 + 들어온 돈 ' + won(inc) + '원 − 나간 돈 ' + won(out) + '원 = 기말 ' + won(d.end) + '원'])); }
  if (tab === 'fa') { box.appendChild(inputs); box.appendChild(sumBox('sim-p-fa', ['지출/수입 비율 ' + (inc ? pc(out / inc) : '—') + ' · 저축률 ' + (inc ? pc((inc - out) / inc) : '—'), '가장 낮았던 잔고 ' + won(d.min) + '원 · 잔액 부족 ' + d.rejected + '건', d.min < 0 ? '잔고가 마이너스였어요.' : '잔고는 계속 0원 이상이었어요.'])); }
  if (tab === 'docs') {
    var days = [12, 45, 120, 3, 200], names = ['등본', '재직증명서', '납세증명서', '인감증명서', '사업자등록증'];
    box.appendChild(tbl(['서류', '남은 유효 기간(일)', '상태'], names.map(function (n, i) { var soon = days[i] <= 14; return [n, days[i], { t:soon ? '곧 만료' : '유효', c:soon ? 'bad' : 'ok' }]; }), [1]));
    box.appendChild(h('div', { class:'sub', text:'가상 서류예요. 14일 이하로 남으면 곧 만료로 표시해요(연습용 기준).' }));
  }
};
BODY.myforms = function (box, s, tab) {
  var d = s.data; box.appendChild(h('div', { class:'row' }, [h('span', { class:'sub', text:'양식을 올리면 항목을 알아보고, 다음에 쓸 때 기억해 둔 값으로 채워 줘요(가상).' })]));
  box.appendChild(tbl(['양식', '알아본 항목', '쓴 횟수', '다음 작성'], d.forms.map(function (f) { return [f.name, f.fields.join(', '), f.uses + '번', { t:f.uses >= 3 ? '자주 쓰는 양식 위로' : '보관', c:f.uses >= 3 ? 'ok' : '' }]; }), [2]));
  box.appendChild(sumBox('sim-f-sum', ['자주 쓰는(3번 이상) 양식 ' + d.forms.filter(function (f) { return f.uses >= 3; }).length + '개가 목록 위로 올라와요.', '서명란·주민번호는 값을 대신 채우지 않고 사용자가 직접 입력하게 비워 두는 연습을 해 보세요.']));
};
BODY.othersite = function (box, s, tab) {
  var STEPS = [['사이트 주소 정하기', '도우미'], ['나비웹 도우미 연결 확인', '도우미'], ['적어 둔 값을 입력 칸에 옮겨 적기', '도우미'], ['로그인', '사용자'], ['내용 확인 후 제출', '사용자']];
  s.st = s.st == null ? 0 : s.st;
  box.appendChild(h('div', { class:'sub', text:'가상 사이트(그림 없이 순서만)에서 누가 무엇을 하는지 연습해요. 로그인과 마지막 제출은 언제나 사용자가 직접 해요.' }));
  box.appendChild(tbl(['단계', '내용', '맡은 쪽', '상태'], STEPS.map(function (x, i) { return [i + 1, x[0], x[1], { t:i < s.st ? '끝' : i === s.st ? '지금' : '대기', c:i < s.st ? 'ok' : i === s.st ? 'bad' : '' }]; })));
  box.appendChild(h('div', { class:'row' }, [h('button', { type:'button', id:'sim-ost-next', class:'pri', text:s.st >= STEPS.length ? '처음부터 다시' : (STEPS[s.st][1] === '사용자' ? '사용자가 했다고 치고 다음' : '다음 단계'), onclick:function () { s.st = s.st >= STEPS.length ? 0 : s.st + 1; ST._redraw(); } })]));
  box.appendChild(h('div', { class:'sub', id:'sim-ost-sum', text:s.st >= STEPS.length ? '끝났어요. 제출 버튼은 한 번도 도우미가 누르지 않았어요.' : '지금 단계: ' + STEPS[s.st][0] + ' (' + STEPS[s.st][1] + ')' }));
};
BODY.docs = function (box, s, tab) {
  var d = s.data;
  if (tab === 'write') {
    var STEPS = ['서류 종류 고르기', '사실관계 입력', 'AI가 초안 쓰기', '작성 시점 준법 점검', '고쳐서 확정', '작성한 서류에 보관'];
    s.st = s.st == null ? 0 : s.st; var sample = d.docs[0];
    box.appendChild(tbl(['단계', '내용', '상태'], STEPS.map(function (x, i) { return [i + 1, x, { t:i < s.st ? '끝' : i === s.st ? '지금' : '대기', c:i < s.st ? 'ok' : i === s.st ? 'bad' : '' }]; })));
    box.appendChild(h('div', { class:'row' }, [h('button', { type:'button', id:'sim-w-next', class:'pri', text:s.st >= STEPS.length ? '처음부터 다시' : '다음 단계', onclick:function () { s.st = s.st >= STEPS.length ? 0 : s.st + 1; ST._redraw(); } })]));
    box.appendChild(sumBox('sim-w-sum', [s.st === 3 ? '준법 점검: 「' + sample.kind + '」 — ' + sample.issue + (sample.issue === '문제 없음' ? '' : ' → 고친 뒤에 확정해요.') : '지금: ' + (STEPS[s.st] || '완료'), '서류 내용은 가상이고, 법적 효력이 없어요.']));
  }
  if (tab === 'drafts') box.appendChild(tbl(['서류', '자동 저장', '남은 문제'], d.docs.filter(function (x) { return !x.done; }).map(function (x) { return [x.kind, x.saved, { t:x.issue, c:x.issue === '문제 없음' ? 'ok' : 'bad' }]; })));
  if (tab === 'done') box.appendChild(tbl(['서류', '확정일', '점검 결과'], d.docs.filter(function (x) { return x.done; }).map(function (x) { return [x.kind, x.saved, { t:x.issue === '문제 없음' ? '통과' : '고친 뒤 확정', c:'ok' }]; })));
  if (tab !== 'write') box.appendChild(h('div', { class:'sub', text:'Draft는 작성 중 자동 저장된 것, 작성한 서류는 확정한 것이에요. 가상 목록이에요.' }));
};

/** 설정용 가상 데이터: 이미 쓰는 아이디, 가상 백업 단어, 폰 연동 코드, 가상 수신 메일. */
var WORDS = ['사과', '구름', '바다', '나무', '별', '종이', '여름', '거울', '시계', '우산', '노을', '언덕', '파도', '등대', '기차', '바람'];
function settingsGen(seed, o) {
  var r = rng(seed), words = [], i; while (words.length < 6) { var w = WORDS[Math.floor(r() * WORDS.length)]; if (words.indexOf(w) < 0) words.push(w); }
  var code = ''; for (i = 0; i < 6; i++) code += Math.floor(r() * 10);
  var mails = []; for (i = 0; i < 7; i++) mails.push({ day:24 + i, from:'보낸이 ' + String.fromCharCode(65 + Math.floor(r() * 6)) });
  return { seed:seed, taken:['jupiter', 'hondi', 'navi01', 'kim2026', 'lee_jeju', 'park77', 'naviweb', 'test1'], words:words, code:code, mails:mails };
}
BODY.settings = function (box, s, tab) {
  var d = s.data, sv = function (id, def) { var c = cur(id); return c === '' ? def : c; };
  var note = function (t) { box.appendChild(h('div', { class:'sub', text:t })); };
  if (tab === 'account') {
    var id = String(sv('sm-uid', 'navi2026')), okFmt = /^[a-z0-9_]{3,20}$/.test(id), dup = d.taken.indexOf(id) >= 0;
    box.appendChild(h('div', { class:'row' }, [fld('sm-uid', '바꾸고 싶은 아이디', id), fld('sm-disp', '보내는 사람 표시', String(sv('sm-disp', '홍길동')))]));
    var iu = document.getElementById('sm-uid'); if (iu) { iu.removeAttribute('inputmode'); }
    box.appendChild(sumBox('sim-a-id', ['아이디 「' + id + '」 → ', [h('b', { class:okFmt && !dup ? 'ok' : 'bad', text:!okFmt ? '쓸 수 없어요: 영문 소문자·숫자·밑줄 3~20자' : dup ? '이미 쓰는 사람이 있어요' : '쓸 수 있어요' })], '받는 사람에게는 「' + String(sv('sm-disp', '홍길동')) + ' <' + id + '@가상>」 으로 보여요.']));
    note('이미 쓰는 가상 아이디: ' + d.taken.join(', ') + '. 실제 아이디는 바뀌지 않아요.');
  }
  if (tab === 'profile') {
    var nm = String(sv('sm-pn', '홍길동')), intro = String(sv('sm-pi2', '제주에서 귤 농사를 짓습니다.')), pub = String(sv('sm-pp', 'intro'));
    box.appendChild(h('div', { class:'row' }, [fld('sm-pn', '이름', nm), fld('sm-pi2', '한 줄 소개', intro), fld('sm-pp', '공개 범위', pub, { opts:[['none', '아무에게도 안 보임'], ['intro', '이름+소개만'], ['all', '모두 공개']] })]));
    var sel = document.getElementById('sm-pp'); if (sel) sel.value = pub;
    ['sm-pn', 'sm-pi2'].forEach(function (x) { var e = document.getElementById(x); if (e) e.removeAttribute('inputmode'); });
    box.appendChild(sumBox('sim-pf-card', [pub === 'none' ? '공개 안 함: 다른 사람에게 프로필이 보이지 않아요.' : ['미리보기 — ', h('b', { text:nm }), pub === 'all' ? ' · ' + intro + ' · 연락처·활동 내역 공개' : ' · ' + intro], '저장되지 않는 미리보기예요.']));
  }
  if (tab === 'ai') {
    var lv = String(sv('sm-lv', 'mid')), r = rng(d.seed + 61), tips = [], i2;
    for (i2 = 0; i2 < 10; i2++) tips.push({ t:['일정 알림', '서류 마감', '요금 안내', '새 기능', '건강 점검', '모임 제안'][i2 % 6], imp:Math.round(r() * 100) });
    var th = { low:80, mid:50, high:20 }[lv] || 50, shown = tips.filter(function (x) { return x.imp >= th; });
    box.appendChild(h('div', { class:'row' }, [fld('sm-lv', '알림 강도', lv, { opts:[['low', '조용히'], ['mid', '보통'], ['high', '적극적으로']] })]));
    var s2 = document.getElementById('sm-lv'); if (s2) s2.value = lv;
    box.appendChild(sumBox('sim-ai-sum', ['오늘 비서가 낸 제안 가상 10건 중 ' + shown.length + '건이 화면에 떠요.', '중요도 ' + th + ' 이상만 보여 줘요. 너무 적극적이면 알림이 많아지고, 너무 조용하면 놓칠 수 있어요.']));
    box.appendChild(tbl(['제안', '중요도', '표시'], tips.map(function (x) { var on = x.imp >= th; return [x.t, x.imp, { t:on ? '표시' : '숨김', c:on ? 'ok' : '' }]; }), [1]));
  }
  if (tab === 'gdc') {
    var bal = num('sm-gb', 0), up = num('sm-gu', 10000), use = num('sm-gs', 3000), typed = String(sv('sm-gk', ''));
    box.appendChild(h('div', { class:'row' }, [fld('sm-gb', '현재 가상 GDC', String(bal)), fld('sm-gu', '충전할 양', String(up)), fld('sm-gs', '쓸 양', String(use))]));
    box.appendChild(sumBox('sim-g-flow', ['충전 +' + won(up) + ' → ' + won(bal + up) + ', 사용 −' + won(use) + ' → ', [h('b', { text:won(bal + up - use) + ' GDC' })], bal + up - use < 0 ? '잔액이 모자라 사용이 거절돼요.' : '가상 GDC예요. 실제 GDC와 섞이지 않아요.']));
    box.appendChild(h('div', { class:'box' }, [h('b', { text:'가상 백업 키 연습' }), h('div', { class:'sub', id:'sim-g-words', text:'가상 백업 단어: ' + d.words.join(' ') + ' (진짜 키가 아니에요. 종이에 적어 두는 연습만 해요.)' }), h('div', { class:'row' }, [fld('sm-gk', '단어를 안 보고 적어 보세요(띄어쓰기로 구분)', typed)])]));
    var gk = document.getElementById('sm-gk'); if (gk) gk.removeAttribute('inputmode');
    box.appendChild(sumBox('sim-g-key', [typed.trim() === '' ? '위 칸에 방금 본 단어를 순서대로 적으면 복구가 되는지 확인해요.' : typed.trim().split(/\s+/).join(' ') === d.words.join(' ') ? '복구 성공 — 키를 잃어버려도 이 단어가 있으면 되찾을 수 있어요.' : '순서나 단어가 달라요. 복구되지 않아요.']));
  }
  if (tab === 'skin') {
    var fs2 = num('sm-fs', 16), dk = String(sv('sm-dk', 'light'));
    box.appendChild(h('div', { class:'row' }, [fld('sm-fs', '글자 크기(12~24)', String(fs2)), fld('sm-dk', '밝기', dk, { opts:[['light', '밝게'], ['dark', '어둡게']] })]));
    var s3 = document.getElementById('sm-dk'); if (s3) s3.value = dk;
    var px = Math.min(24, Math.max(12, fs2));
    box.appendChild(h('div', { class:'box', id:'sim-sk-prev', style:'font-size:' + px + 'px;' + (dk === 'dark' ? 'background:#1c1f24;color:#f1f3f5' : 'background:#fff;color:#1b1d21') }, [h('b', { text:'미리보기' }), h('div', { text:'안녕하세요. 이 글자 크기와 밝기로 보여요.' })]));
    note('이 상자 안에서만 바뀌고, 실제 화면은 바뀌지 않아요.');
  }
  if (tab === 'phone') {
    var typed2 = String(sv('sm-pc', '')), on = typed2.trim() === d.code, al = ['메일 도착', '서류 마감', '결제 알림'].map(function (x, i) { return { n:x, on:String(sv('sm-pa' + i, '1')) === '1' }; });
    box.appendChild(h('div', { class:'sub', id:'sim-ph-code', text:'폰 화면에 뜬 가상 연동 코드: ' + d.code }));
    box.appendChild(h('div', { class:'row' }, [fld('sm-pc', 'PC에 코드 입력', typed2)].concat(al.map(function (x, i) { return fld('sm-pa' + i, x.n + ' 알림', x.on ? '1' : '0', { opts:[['1', '켬'], ['0', '끔']] }); }))));
    al.forEach(function (x, i) { var e = document.getElementById('sm-pa' + i); if (e) e.value = x.on ? '1' : '0'; }); var pc2 = document.getElementById('sm-pc'); if (pc2) pc2.removeAttribute('inputmode');
    box.appendChild(sumBox('sim-ph-sum', [on ? '연결됨 — 폰과 PC가 같은 계정으로 묶였어요.' : '코드가 맞지 않아 아직 연결되지 않았어요.', '오늘 도착할 가상 알림: ' + (on ? (al.filter(function (x) { return x.on; }).map(function (x) { return x.n; }).join(', ') || '없음(모두 꺼 둠)') : '연결 뒤에 보여요')]));
  }
  if (tab === 'signature') {
    var sg = String(sv('sm-sg', '홍길동 드림\n제주시 한림읍'));
    box.appendChild(h('div', { class:'row' }, [h('label', {}, ['서명 내용', h('textarea', { id:'sm-sg', rows:'3', 'aria-label':'서명 내용', onchange:function () { ST._redraw(); } })])]));
    var ta = document.getElementById('sm-sg'); if (ta) ta.value = sg;
    box.appendChild(h('div', { class:'box', id:'sim-sg-prev', style:'white-space:pre-wrap' }, [h('div', { text:'안녕하세요. 서류 잘 받았습니다.' }), h('div', { class:'sub', text:'— ' }), h('div', { text:sg })]));
    note('보내는 메일 아래에 이렇게 붙어요(미리보기). 실제 서명은 바뀌지 않아요.');
  }
  if (tab === 'autoreply') {
    var a0 = num('sm-as', 26), a1 = num('sm-ae', 28), msg = String(sv('sm-am', '자리를 비웠습니다. 돌아와서 답하겠습니다.'));
    box.appendChild(h('div', { class:'row' }, [fld('sm-as', '시작일(11월 며칠)', String(a0)), fld('sm-ae', '끝나는 날', String(a1)), fld('sm-am', '자동응답 문구', msg)]));
    var am = document.getElementById('sm-am'); if (am) am.removeAttribute('inputmode');
    var hit = d.mails.filter(function (m) { return m.day >= a0 && m.day <= a1; });
    box.appendChild(tbl(['도착일', '보낸이', '자동응답'], d.mails.map(function (m) { var on = m.day >= a0 && m.day <= a1; return ['11월 ' + m.day + '일', m.from, { t:on ? '보내요' : '안 보내요', c:on ? 'ok' : '' }]; })));
    box.appendChild(sumBox('sim-ar-sum', ['가상 메일 ' + d.mails.length + '통 중 ' + hit.length + '통에 자동응답이 나가요. 문구: 「' + msg + '」']));
  }
};

/** 메일·길잡이용 가상 데이터. */
var TAGR = [['세금', '세무'], ['청구', '결제'], ['회의', '일정'], ['광고', '광고']];
function mailGen(seed, o) {
  var r = rng(seed), subs = ['세금 신고 안내', '청구서 도착', '회의 일정 조율', '신제품 광고', '서류 보완 요청', '안부 인사', '결제 완료 알림', '회의록 공유', '광고: 특가 안내', '계약서 확인 부탁'], people = ['김가온', '이나래', '박하늘', '최보라', '정한결', '오다온', '한결', '서아름'], who = function () { return people[Math.floor(r() * people.length)]; };
  var tag = function (s) { var t = TAGR.filter(function (x) { return s.indexOf(x[0]) >= 0; })[0]; return t ? t[1] : '기타'; };
  var inbox = subs.map(function (s, i) { return { from:who(), subj:s, tag:tag(s), read:r() < 0.5, day:25 - (i % 5) }; });
  var sent = [0, 1, 2, 3, 4, 5].map(function (i) { return { to:who(), subj:subs[(i * 3) % subs.length], opened:r() < 0.6 }; });
  var drafts = [0, 1, 2, 3, 4].map(function (i) { return { subj:subs[(i * 2 + 1) % subs.length], saved:'11-' + (20 + Math.floor(r() * 6)) }; });
  return { seed:seed, people:people, inbox:inbox, sent:sent, drafts:drafts, tagOf:tag };
}
BODY.mail = function (box, s, tab) {
  var d = s.data, sv = function (id, def) { var c = cur(id); return c === '' ? def : c; };
  if (tab === 'compose') {
    var to = String(sv('sm-mt', '김가온')), sj = String(sv('sm-ms', '서류 보냅니다')), bd = String(sv('sm-mb', '첨부한 서류를 확인해 주세요.')), at = String(sv('sm-ma', '0')), known = d.people.indexOf(to) >= 0, warn = bd.indexOf('첨부') >= 0 && at !== '1';
    box.appendChild(h('div', { class:'row' }, [fld('sm-mt', '받는 사람(정확히 입력)', to), fld('sm-ms', '제목', sj), fld('sm-mb', '본문', bd), fld('sm-ma', '첨부 파일', at, { opts:[['0', '없음'], ['1', '1개 첨부']] })]));
    ['sm-mt', 'sm-ms', 'sm-mb'].forEach(function (x) { var e = document.getElementById(x); if (e) e.removeAttribute('inputmode'); }); var sa = document.getElementById('sm-ma'); if (sa) sa.value = at;
    box.appendChild(sumBox('sim-m-chk', ['받는 사람: ', [h('b', { class:known ? 'ok' : 'bad', text:known ? '찾았어요' : '정확히 일치하는 사람이 없어요(비슷한 이름은 찾아 주지 않아요)' })], warn ? '본문에 「첨부」가 있는데 첨부 파일이 없어요. 보내기 전에 확인하세요.' : '보내기 전 점검 통과', '가상 편지예요. 실제로 발송되지 않아요.']));
    box.appendChild(h('div', { class:'sub', text:'가상 주소록: ' + d.people.join(', ') }));
  }
  if (tab === 'drafts') box.appendChild(tbl(['제목', '자동 저장'], d.drafts.map(function (x) { return [x.subj, x.saved]; })));
  if (tab === 'sent') { box.appendChild(tbl(['받는 사람', '제목', '열어 봄'], d.sent.map(function (x) { return [x.to, x.subj, { t:x.opened ? '열어 봤어요' : '아직', c:x.opened ? 'ok' : '' }]; }))); box.appendChild(h('div', { class:'sub', text:'열람 표시는 가상 값이에요.' })); }
  if (tab === 'inbox') {
    var un = d.inbox.filter(function (x) { return !x.read; }).length;
    box.appendChild(h('div', { class:'sub', id:'sim-m-inbox', text:'받은 메일 ' + d.inbox.length + '통 중 안 읽은 메일 ' + un + '통. 제목의 낱말로 태그를 붙여요(연습용 규칙).' }));
    box.appendChild(tbl(['보낸이', '제목', '태그', '읽음'], d.inbox.map(function (x) { return [x.from, x.subj, x.tag, { t:x.read ? '읽음' : '안 읽음', c:x.read ? '' : 'bad' }]; })));
  }
  if (tab === 'tags') {
    var cnt = {}; d.inbox.forEach(function (x) { cnt[x.tag] = (cnt[x.tag] || 0) + 1; });
    box.appendChild(tbl(['태그', '메일 수'], Object.keys(cnt).map(function (k) { return [k, cnt[k]]; }), [1]));
    box.appendChild(h('div', { class:'sub', text:'규칙: 제목에 세금·청구·회의·광고가 있으면 해당 태그, 아니면 기타.' }));
  }
};
BODY.guide = function (box, s, tab) {
  var d = s.data, sv = function (id, def) { var c = cur(id); return c === '' ? def : c; }, r = rng(s.seed + 71);
  if (tab === 'new') {
    var goal = String(sv('sm-gg', '사업자 등록하기')), days = ci(num('sm-gd', 14), 4, 90, 14), st = ['자료 모으기', '초안 만들기', '검토받기', '제출하기'];
    box.appendChild(h('div', { class:'row' }, [fld('sm-gg', '이루고 싶은 일', goal), fld('sm-gd', '기한(일)', String(days))])); var ge = document.getElementById('sm-gg'); if (ge) ge.removeAttribute('inputmode');
    box.appendChild(tbl(['할 일', '기한(오늘부터)'], st.map(function (x, i) { return [x, Math.round(days * (i + 1) / st.length) + '일째']; }), [1]));
    box.appendChild(sumBox('sim-gd-new', ['「' + goal + '」 과제를 ' + st.length + '단계로 나눴어요(연습용 고정 틀).', '실제 길잡이는 대화로 일에 맞는 할 일을 추천해요.']));
  }
  if (tab === 'prog') {
    var names = ['세금 신고', '이사 신고', '임대차 계약', '보험 청구', '정보공개 청구'], rows = names.map(function (n) { var el = 0.2 + r() * 0.7, pg = Math.max(0, Math.min(1, el + (r() - 0.6) * 0.5)); return { n:n, el:el, pg:pg, late:pg < el - 0.2 }; });
    box.appendChild(tbl(['과제', '경과', '진행', '상태'], rows.map(function (x) { return [x.n, pc(x.el), pc(x.pg), { t:x.late ? '늦어지고 있어요' : '순조', c:x.late ? 'bad' : 'ok' }]; }), [1, 2]));
    box.appendChild(h('div', { class:'sub', id:'sim-gd-prog', text:'진행이 경과보다 20%p 넘게 뒤처지면 알려요. 늦어지는 과제 ' + rows.filter(function (x) { return x.late; }).length + '개.' }));
  }
  if (tab === 'done') {
    var CAUSE = ['서류 보완', '기한 놓침', '준비 부족', '잘 풀림'], recs = [0, 1, 2, 3, 4, 5].map(function (i) { var ok = r() < 0.55; return { n:'과제 ' + (i + 1), ok:ok, why:ok ? '잘 풀림' : CAUSE[Math.floor(r() * 3)] }; }), cs = {};
    recs.filter(function (x) { return !x.ok; }).forEach(function (x) { cs[x.why] = (cs[x.why] || 0) + 1; });
    box.appendChild(tbl(['과제', '결과', '원인·교훈'], recs.map(function (x) { return [x.n, { t:x.ok ? '성공' : '실패', c:x.ok ? 'ok' : 'bad' }, x.why]; })));
    box.appendChild(sumBox('sim-gd-done', ['성공 ' + recs.filter(function (x) { return x.ok; }).length + '건 / ' + recs.length + '건', Object.keys(cs).length ? '실패에서 가장 많은 원인: ' + Object.keys(cs).sort(function (a, b) { return cs[b] - cs[a]; })[0] : '실패가 없었어요.', '이 기록이 다음 과제를 세울 때 참고돼요.']));
  }
};

/** 홈 화면용 가상 데이터: 가상 이용자 50명과 연습 가게 3곳. */
var SUR = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'], GIV = ['가온', '나래', '하늘', '보라', '한결', '다온', '아름', '서연', '도윤', '지후', '예준', '시우'];
function homeGen(seed, o) {
  var r = rng(seed), names = [], i; while (names.length < 50) { var n = SUR[Math.floor(r() * SUR.length)] + GIV[Math.floor(r() * GIV.length)]; if (names.indexOf(n) < 0) names.push(n); }
  var shops = [['연습 식당', '010-0000-0001'], ['연습 약국', '064-000-0002'], ['연습 서점', '010-0000-0003']];
  return { seed:seed, names:names, shops:shops };
}
var ROUTE = [['메일|편지|보내', '메일(편지쓰기)'], ['서류|계약|청구서|신청서', '서류 작성'], ['세금|부가세|신고', '세무 회계 AI'], ['송금|잔액|GDC|충전', '은행 AI'], ['주식|투자|종목', '증권 AI'], ['보험|청구금', '보험 AI'], ['병원|아파|처방', '의료 AI'], ['쓰레기|환경|악취', '환경(K-Clean)']];
var HEX = ['이번 달 세금 얼마 내야 해?', '김가온에게 서류 보냈다고 메일 써줘', '임대차 계약서 만들어줘', '내 잔액 알려줘', '삼성전자 같은 주식 사도 돼?', '병원 예약하려고 하는데', '우리 동네 쓰레기 신고하고 싶어', '오늘 뭐 하면 좋을까?'];
BODY.home = function (box, s, tab) {
  var d = s.data, sv = function (id, def) { var c = cur(id); return c === '' ? def : c; };
  if (tab === 'tour') {
    box.appendChild(h('div', { class:'sub', text:'화면의 구역 이름을 알아 가는 연습이에요. 구역: 상단 바(제목·아이디) / 왼쪽 메뉴 / 입력창 / 예시 줄 / 대화창 / 설정(톱니바퀴).' }));
    QZ(box, 'sim-h-t', [['메일을 보내려면 어디에 말하나요?', ['입력창', '왼쪽 메뉴 맨 위', '상단 바'], 0], ['내 설정을 바꾸려면?', ['예시 줄', '설정(톱니바퀴)', '대화창'], 1], ['어떤 기관 AI를 부를지 고르는 곳은?', ['예시 줄·인프라 AI 선택', '프로필', '서명'], 0], ['대화 기록이 쌓여 보이는 곳은?', ['대화창', '상단 바', '왼쪽 메뉴'], 0]]);
  }
  if (tab === 'input') {
    var q = String(sv('sm-hq', HEX[0])), hit = ROUTE.filter(function (x) { return new RegExp(x[0]).test(q); })[0];
    box.appendChild(h('div', { class:'row' }, [fld('sm-hx', '예시 문장', q, { opts:HEX.map(function (x) { return [x, x]; }).concat([[q, '(직접 입력한 문장)']]) }), fld('sm-hq', '직접 입력', q)]));
    var se = document.getElementById('sm-hx'); if (se) se.value = HEX.indexOf(q) >= 0 ? q : q; var qi = document.getElementById('sm-hq'); if (qi) { qi.removeAttribute('inputmode'); qi.onchange = function () { ST._redraw(); }; }
    if (se) se.onchange = function () { var t = document.getElementById('sm-hq'); if (t) t.value = se.value; ST._redraw(); };
    box.appendChild(sumBox('sim-h-route', ['「' + q + '」 → ', [h('b', { text:hit ? hit[1] : '나만의 AI 비서(일반 대화)' })], '낱말로 갈래를 고르는 연습용 규칙이에요. 실제로는 문장 전체의 뜻을 보고 정해요.']));
    box.appendChild(h('div', { class:'sub', text:'다양하게 말해 보세요: 「세금 신고 도와줘」「이번 달 부가세」「3월 종합소득세는?」 모두 세무 쪽으로 가요.' }));
  }
  if (tab === 'people') {
    var nm = String(sv('sm-hp', '김가온')), found = d.names.indexOf(nm) >= 0, part = !found && nm.length >= 1 && d.names.some(function (x) { return x.indexOf(nm) >= 0; });
    box.appendChild(h('div', { class:'row' }, [fld('sm-hp', '찾을 이름(정확히)', nm)])); var pe = document.getElementById('sm-hp'); if (pe) { pe.removeAttribute('inputmode'); }
    box.appendChild(sumBox('sim-h-find', [found ? ['「' + nm + '」님을 찾았어요. ', h('b', { text:'[호출하기]' }), '를 누르면 대화가 열려요.'] : part ? '「' + nm + '」은(는) 이름 일부예요. 이름이 정확히 같아야 찾아 줘요.' : '「' + nm + '」님은 가상 이용자 50명 안에 없어요.']));
    box.appendChild(h('div', { class:'sub', text:'가상 이용자 예: ' + d.names.slice(0, 6).join(', ') + ' … (총 50명)' }));
  }
  if (tab === 'chat') {
    var Q = [['이번 달 지출이 많은 편이야?', '내 기록을 보고: 지난달보다 12% 많아요(가상).', '은행 AI: 일반 안내만 가능해요. 내 기록은 제가 몰라요.'], ['세금 줄이는 방법 알려줘', '내 사업 기록 기준으로 공제 후보 2가지를 알려 드려요(가상).', '세무 AI: 일반적인 공제 항목을 안내해요.']], qi2 = ci(num('sm-hc', 0), 0, Q.length - 1, 0);
    box.appendChild(h('div', { class:'row' }, [fld('sm-hc', '질문', String(qi2), { opts:Q.map(function (x, i) { return [String(i), x[0]]; }) })])); var ce = document.getElementById('sm-hc'); if (ce) ce.value = String(qi2);
    box.appendChild(tbl(['누구에게', '답'], [['나만의 AI 비서', Q[qi2][1]], ['호출한 기관 AI', Q[qi2][2]]]));
    s.p2p = s.p2p || 0; var P = ['사람과 대화 중', '대화창 닫기', 'AI 비서 화면으로 돌아옴(이전 대화 복구)'];
    box.appendChild(h('div', { class:'row' }, [h('button', { type:'button', id:'sim-h-p2p', class:'pri', text:s.p2p >= 2 ? '처음부터' : '다음: ' + P[s.p2p + 1], onclick:function () { s.p2p = s.p2p >= 2 ? 0 : s.p2p + 1; ST._redraw(); } })]));
    box.appendChild(sumBox('sim-h-p2ps', ['사용자 간 대화 연습: ' + P[s.p2p]]));
  }
  if (tab === 'attach') {
    s.att = s.att || []; var KIND = [['마이크', '목소리를 글로 바꿔 입력창에 넣어요'], ['카메라', '사진을 찍어 서류 사진으로 붙여요'], ['파일', '문서·사진 파일을 골라 붙여요']];
    KIND.forEach(function (k, i) { box.appendChild(h('div', { class:'box' }, [h('b', { text:k[0] }), h('div', { class:'sub', text:k[1] }), h('button', { type:'button', id:'sim-h-att' + i, text:'붙여 보기', onclick:function () { s.att.push(k[0]); ST._redraw(); } })])); });
    box.appendChild(sumBox('sim-h-atts', [s.att.length ? '붙인 것: ' + s.att.join(', ') : '아직 아무것도 안 붙였어요.', '권한 요청 창 없이 그림으로만 연습해요. 실제로는 처음 쓸 때 기기가 허락을 물어요.']));
  }
  if (tab === 'code') {
    var ph = String(sv('sm-hn', '010-1234-5678')), f = window._ncPhoneToDigits ? window._ncPhoneToDigits(ph) : null, shop = f && f.digits ? d.shops.filter(function (x) { var g = window._ncPhoneToDigits(x[1]); return g && g.digits === f.digits; })[0] : null;
    box.appendChild(h('div', { class:'row' }, [fld('sm-hn', '전화번호', ph)])); var ne = document.getElementById('sm-hn'); if (ne) ne.removeAttribute('inputmode');
    box.appendChild(sumBox('sim-h-code', [!f ? '변환 규칙을 불러오지 못했어요(이 화면에서만 가능해요).' : f.empty ? '전화번호를 입력해 보세요.' : f.err ? f.err : ['나비 숫자 코드(10칸): ', h('b', { text:f.digits }), ' (' + f.kind + ')'], shop ? '→ 「' + shop[0] + '」 가상 가게 화면이 열려요.' : (f && f.digits ? '이 코드의 가상 가게는 없어요.' : '')]));
    box.appendChild(h('div', { class:'sub', text:'연습 가게 번호: ' + d.shops.map(function (x) { return x[0] + ' ' + x[1]; }).join(' / ') }));
  }
};
function readOpt(kind) {
  var s = ST[kind], o = s.opt, g = function (id, d) { var e = document.getElementById(id); return e ? String(e.value).replace(/,/g, '') : d; };
  if (kind === 'market') { o.n = g('sm-n', o.n); o.spread = g('sm-sp', o.spread); o.odd = g('sm-odd', o.odd); o.pi = g('sm-pi', o.pi || '0'); }
  if (kind === 'pdv') { o.months = g('sm-mo', o.months); o.start = g('sm-st', o.start); o.income = g('sm-in', o.income); o.fixed = g('sm-fx', o.fixed); o.vol = g('sm-vol', o.vol); }
  if (kind === 'learn') { o.weeks = g('sm-wk', o.weeks); }
  if (kind === 'insure') { o.n = g('sm-n', o.n); o.rate = g('sm-rate', o.rate); o.prem = g('sm-prem', o.prem); o.cov = g('sm-cov', o.cov); }
  if (kind === 'tax') { o.n = g('sm-n', o.n); o.opex = g('sm-opex', o.opex); }
  if (kind === 'bank') { o.months = g('sm-mo', o.months); o.start = g('sm-st', o.start); o.income = g('sm-in', o.income); o.fixed = g('sm-fx', o.fixed); o.vol = g('sm-vol', o.vol); }
  if (kind === 'stock') { o.n = g('sm-n', o.n); o.ft = g('sm-ft', o.ft); o.fa = g('sm-fa', o.fa); o.fc = g('sm-fc', o.fc); o.fr = g('sm-fr', o.fr); o.br = g('sm-br', o.br); o.co = g('sm-co', o.co || '0'); o.w = g('sm-w', o.w || X.w); s.f = { sector:g('sm-sec', s.f.sector), region:g('sm-reg', s.f.region), size:g('sm-sz', s.f.size) }; }
}
function make(kind) { var s = ST[kind]; readOpt(kind); var G = { market:market, tax:tax, bank:bank, stock:stock, insure:insure, learn:learn, pdv:bank, settings:settingsGen, home:homeGen, mail:mailGen, guide:docsGen, myforms:formsGen, othersite:formsGen, docs:docsGen }[kind]; s.data = G(s.seed, s.opt); if (kind === 'stock') s.day = 0; return s; }
var PN = null, CUR = null, prevFocus = null;
function close() {
  ST._redraw = null; document.removeEventListener('keydown', onKey, true);
  if (PN) { var p = PN; p.classList.remove('on'); p.removeAttribute('id'); Array.prototype.forEach.call(p.querySelectorAll('[id]'), function (e) { e.removeAttribute('id'); }); setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 230); }
  PN = null; CUR = null; if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) { /* 포커스 복귀 실패는 무시 */ } }
}
function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
function tabLabel(kind, tab) { var t = PAGES[kind].tabs.filter(function (x) { return x[0] === tab; })[0]; return t ? t[1] : ''; }
function render() {
  if (!PN || !CUR) return; var kind = CUR, s = ST[kind], tab = s.tab, box = document.getElementById('sim-body'); if (!box) return;
  document.getElementById('sim-title-t').textContent = PAGES[kind].name + ' · ' + tabLabel(kind, tab) + ' 시뮬레이션';
  Array.prototype.forEach.call(PN.querySelectorAll('.chips button'), function (b) { var on = b.getAttribute('data-tab') === tab; b.className = on ? 'cur' : ''; b.setAttribute('aria-selected', on ? 'true' : 'false'); });
  s.vals = s.vals || {}; Array.prototype.forEach.call(box.querySelectorAll('input,select,textarea'), function (e) { if (e.id) s.vals[e.id] = e.value; });
  box.textContent = ''; BODY[kind](box, s, tab);
}
/** 화면에서 탭이 바뀌면 패널도 그 탭의 시뮬레이션으로 따라간다. */
function setTab(kind, tab) { if (!PAGES[kind] || !ST[kind]) return false; if (!tabLabel(kind, tab)) return false; readOpt(kind); ST[kind].tab = tab; if (CUR === kind) render(); return true; }
function open(kind, tab) {
  if (!PAGES[kind]) return false; if (PN) close();
  if (!document.getElementById('nsim-css')) { var st = document.createElement('style'); st.id = 'nsim-css'; st.textContent = CSS; document.head.appendChild(st); }
  var o = {}, k; for (k in DEF[kind]) o[k] = DEF[kind][k]; for (k in X) if (o[k] == null) o[k] = X[k];
  ST[kind] = { seed:((Date.now() / 1000) | 0) % 100000, opt:o, f:{ sector:'', region:'', size:'' }, day:0, tab:tabLabel(kind, tab) ? tab : PAGES[kind].tabs[0][0] }; CUR = kind; make(kind);
  prevFocus = document.activeElement; var box = h('div', { id:'sim-body', class:'bdy' });
  ST._redraw = function () { readOpt(kind); render(); };
  var seedIn = h('input', { id:'sm-seed', type:'text', inputmode:'numeric', value:String(ST[kind].seed), 'aria-label':'시드', style:'width:90px' });
  var bar = h('div', { class:'row' }, [h('label', { for:'sm-seed' }, ['시드(같으면 같은 결과)', seedIn]), h('button', { type:'button', class:'pri', id:'sim-gen', text:'가상 데이터 만들기', onclick:function () { ST[kind].seed = ci(seedIn.value, 0, 4294967295, 1); make(kind); render(); } }),
    h('button', { type:'button', id:'sim-again', text:'다른 데이터로 다시', onclick:function () { ST[kind].seed = (ST[kind].seed + 1) % 4294967295; seedIn.value = String(ST[kind].seed); make(kind); render(); } })]);
  var hd = h('div', { class:'hd' }, [h('div', { style:'display:flex;justify-content:space-between;gap:8px' }, [h('h2', { id:'sim-title' }, [h('span', { id:'sim-title-t' }), h('span', { class:'bd', text:'가상 데이터' })]), h('button', { type:'button', id:'sim-close', text:'닫기', onclick:close })]),
    h('div', { class:'sub', text:LEAD[kind] }), h('div', { class:'sub', text:'여기서 만든 데이터는 이 패널에만 있고, 실제 장부·잔고·전표·기록에는 들어가지 않아요. 패널을 닫으면 사라져요.' }), chipsRow(kind), bar]);
  PN = h('aside', { class:'nsim-pn', id:'nsim-pn', role:'complementary', 'aria-labelledby':'sim-title' }, [hd, box]); document.body.appendChild(PN); document.addEventListener('keydown', onKey, true); render();
  requestAnimationFrame(function () { if (PN) PN.classList.add('on'); }); if (!window.requestAnimationFrame && PN) PN.classList.add('on');
  var c = document.getElementById('sim-close'); if (c) c.focus(); return true;
}
window.NaviSim = { open:open, close:close, tab:setTab, pages:PAGES, rng:rng, viab:{ feeModel:feeModel, detectTable:detectTable, backtest:backtest, chainTest:chainTest }, gen:{ home:homeGen, mail:mailGen, settings:settingsGen, forms:formsGen, docs:docsGen, learn:learn, insure:insure, market:market, marketTick:marketTick, tax:tax, bank:bank, stock:stock, valueCo:valueCo, scan:scan, bandOf:bandOf } };
})();
