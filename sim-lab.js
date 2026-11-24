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

// ── 화면 ──
var CSS = '.nsim-ov{position:fixed;inset:0;z-index:99999;background:rgba(20,22,26,.55);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px}'
  + '.nsim{background:#fff;color:#1b1d21;border-radius:16px;max-width:880px;width:100%;padding:20px;box-shadow:0 12px 40px rgba(0,0,0,.3);font:14px/1.5 system-ui,sans-serif}'
  + '.nsim h2{margin:0 0 4px;font-size:20px}.nsim .bd{display:inline-block;padding:2px 8px;border-radius:99px;background:#fde9c8;color:#7a4a00;font-size:12px;font-weight:700;margin-left:8px}'
  + '.nsim .sub{color:#5b6068;font-size:13px}.nsim .row{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin:12px 0}.nsim label{display:flex;flex-direction:column;font-size:12px;color:#5b6068;gap:2px}'
  + '.nsim input,.nsim select{padding:6px 8px;border:1px solid #c5c9d0;border-radius:8px;font:inherit;min-width:90px}.nsim button{padding:8px 14px;border-radius:99px;border:1px solid #c5c9d0;background:#f3f4f6;font:inherit;cursor:pointer}'
  + '.nsim button.pri{background:#1e8a5a;border-color:#1e8a5a;color:#fff}.nsim table{border-collapse:collapse;width:100%;margin:8px 0}.nsim th,.nsim td{border-bottom:1px solid #e3e5e9;padding:5px 8px;text-align:left;font-size:13px}'
  + '.nsim .r{text-align:right}.nsim .bad{color:#b3261e;font-weight:700}.nsim .ok{color:#1e8a5a}.nsim .box{border:1px solid #e3e5e9;border-radius:12px;padding:12px;margin:10px 0}.nsim .tbw{overflow:auto;max-height:340px}';
function h(tag, a, kids) { var e = document.createElement(tag), k; for (k in (a || {})) { var v = a[k]; if (v == null || v === false) continue; if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e[k] = v; else e.setAttribute(k, v === true ? '' : v); } (kids || []).forEach(function (c) { if (c == null || c === false) return; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); return e; }
function tbl(head, rows, rcols) { return h('div', { class:'tbw' }, [h('table', {}, [h('thead', {}, [h('tr', {}, head.map(function (t, i) { return h('th', { class:rcols && rcols.indexOf(i) >= 0 ? 'r' : '', text:t }); }))]), h('tbody', {}, rows.map(function (rw) { return h('tr', {}, rw.map(function (c, i) { var o = c && typeof c === 'object' ? c : { t:c }; return h('td', { class:(rcols && rcols.indexOf(i) >= 0 ? 'r ' : '') + (o.c || ''), text:String(o.t) }); })); }))])]); }
function fld(id, label, val, o) { o = o || {}; var i = o.opts ? h('select', { id:id, 'aria-label':label, onchange:function () { if (ST._redraw) ST._redraw(); } }, o.opts.map(function (x) { return h('option', { value:x[0], text:x[1] }); })) : h('input', { id:id, type:'text', inputmode:'numeric', value:val, 'aria-label':label, onchange:function () { if (/^sm-(ft|fa|fr|br|fc)$/.test(id) && ST._redraw) ST._redraw(); } }); if (o.opts) i.value = val; return h('label', { for:id }, [label, i]); }
function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }

var ST = {};   // 종류별 입력·가상 데이터(창을 닫으면 지운다)
var TITLE = { market:'시장 시뮬레이션', tax:'세무 회계 시뮬레이션', bank:'은행 시뮬레이션', stock:'증권 시뮬레이션' };
var LEAD = { market:'가상 상품과 판매처 가격을 만들고, 시장 AI가 공정가격 구간을 계산해 "제 값 초과" 가격을 가려내는 과정을 해 볼 수 있어요.', tax:'가상 거래를 만들고 부가세·매출원가·영업이익·참고용 소득세가 어떻게 계산되는지 해 볼 수 있어요.', bank:'가상 월별 수입·지출로 잔고가 어떻게 움직이고, 잔액이 모자란 결제가 어떻게 거절되는지 해 볼 수 있어요.', stock:'가상 기업을 만들어 가치 평가 구간을 보고, 시세를 하루씩 진행하며 감독 AI의 이상 탐지를 해 볼 수 있어요.' };
function body(kind, box) {
  var s = ST[kind], d = s.data, o = s.opt; box.textContent = '';
  if (kind === 'market') {
    box.appendChild(h('div', { class:'row' }, [fld('sm-n', '상품 수(1~12)', o.n), fld('sm-sp', '가격 흩어짐(%)', o.spread), fld('sm-odd', '이상 가격 비율(%)', o.odd)]));
    d.rows.forEach(function (rw) { box.appendChild(h('div', { class:'box' }, [h('b', { text:rw.name }), h('div', { class:'sub', text:'공정가격 구간 ' + won(rw.band.lo) + ' ~ ' + won(rw.band.hi) + '원 (중앙값 ' + won(rw.band.mid) + '원) · 가상의 실제 값 ' + won(rw.truth) + '원' }),
      tbl(['판매처', '가격', '판정'], rw.offers.map(function (x) { return [x.seller, won(x.price) + '원', { t:x.v, c:x.v === '적정' ? 'ok' : 'bad' }]; }), [1])])); });
    var all = d.rows.reduce(function (a, rw) { return a.concat(rw.offers); }, []), inj = all.filter(function (x) { return x.injected; }), hit = inj.filter(function (x) { return x.v !== '적정'; });
    box.appendChild(h('div', { class:'sub', id:'sim-m-sum', text:'이상 가격 ' + inj.length + '건 중 ' + hit.length + '건을 가려냈어요. 정상 가격 ' + (all.length - inj.length) + '건 중 ' + (all.length - inj.length - all.filter(function (x) { return !x.injected && x.v === '적정'; }).length) + '건은 잘못 걸렸어요.' }));
  }
  if (kind === 'tax') {
    box.appendChild(h('div', { class:'row' }, [fld('sm-n', '거래 수(2~40)', o.n), fld('sm-opex', '판매비·관리비(원)', o.opex)]));
    box.appendChild(tbl(['전표', '구분', '품목', '수량', '공급가액', '부가세'], d.recs.map(function (x) { var sell = x.seller.owner === '나'; return [x.serial, sell ? '판매' : '구매', x.slip.what, x.slip.qty, won(x.slip.supply), won(x.vat)]; }), [3, 4, 5]));
    var T = d.tax, rows = [['매출', won(d.sales) + '원'], ['매입', won(d.purch) + '원'], ['부가세 매출세액 − 매입세액', (d.vatDue >= 0 ? '납부 ' : '환급 ') + won(Math.abs(d.vatDue)) + '원'], ['매출원가(평균 매입가)', d.cogs == null ? '계산 모듈 없음' : won(d.cogs) + '원'], ['원가 미확인 매출', d.uncovered == null ? '—' : won(d.uncovered) + '원'], ['영업이익', d.op == null ? '—' : won(d.op) + '원'], ['참고용 예상 소득세(지방소득세 포함)', T ? won(T.total) + '원' : '—']];
    box.appendChild(h('div', { class:'box', id:'sim-t-sum' }, rows.map(function (x) { return h('div', { class:'sub' }, [x[0] + ': ', h('b', { text:x[1] })]); }).concat([h('div', { class:'sub', text:'세금은 공제·감면 없는 참고 계산이며 실제 징수가 아니에요.' })])));
  }
  if (kind === 'bank') {
    box.appendChild(h('div', { class:'row' }, [fld('sm-mo', '기간(개월)', o.months), fld('sm-st', '시작 잔고(원)', o.start), fld('sm-in', '월 수입(원)', o.income), fld('sm-fx', '월 고정 지출(원)', o.fixed), fld('sm-vol', '수입 변동(%)', o.vol)]));
    box.appendChild(tbl(['월', '월초 잔고', '월말 잔고', '거절된 결제'], d.rows.map(function (x) { return [x.ym, won(x.open), { t:won(x.close), c:x.close < 0 ? 'bad' : '' }, { t:x.rejected, c:x.rejected ? 'bad' : '' }]; }), [1, 2, 3]));
    box.appendChild(h('div', { class:'box', id:'sim-b-sum' }, [h('div', { class:'sub' }, ['최종 잔고 ', h('b', { text:won(d.end) + '원' }), ' · 가장 낮았던 잔고 ', h('b', { text:won(d.min) + '원' }), ' · 잔액 부족으로 거절된 결제 ', h('b', { text:d.rejected + '건' })]), h('div', { class:'sub ' + (d.reconciled ? 'ok' : 'bad'), text:d.reconciled ? '장부 대조: 시작 잔고 + 성공한 입출금 합계 = 최종 잔고 ✓' : '장부 대조가 맞지 않아요.' })]));
  }
  if (kind === 'stock') {
    var day = s.day, f = s.f, list = d.cos.map(function (c) { var v = valueCo(c); return { c:c, v:v, size:window.NaviStock && window.NaviStock.sizeOf ? window.NaviStock.sizeOf(c.assets) : '' }; });
    var shown = window.NaviStock && window.NaviStock.searchListings ? window.NaviStock.searchListings(list.map(function (x) { return { name:x.c.name, sector:x.c.sector, region:x.c.region, size:x.size, ref:x }; }), f).map(function (x) { return x.ref; }) : list;
    box.appendChild(h('div', { class:'row' }, [fld('sm-n', '기업 수(3~40)', o.n), fld('sm-sec', '업종', f.sector, { opts:[['', '전체']].concat(SECT.map(function (x) { return [x, x]; })) }), fld('sm-reg', '지역', f.region, { opts:[['', '전체']].concat(REG.map(function (x) { return [x, x]; })) }), fld('sm-sz', '규모', f.size, { opts:[['', '전체'], ['small', '소규모'], ['mid', '중간'], ['large', '큰 규모']] })]));
    box.appendChild(h('div', { class:'sub', text:'시세 ' + day + '일째 / ' + (d.days - 1) + '일. [하루 진행]을 누르면 시세가 하루씩 움직이고, 하루 변동이 ±' + Math.round(((window.NaviLedger && window.NaviLedger.DEV_LIMIT) || 0.3) * 100) + '%를 넘으면 감독 AI가 알려요.' }));
    box.appendChild(tbl(['기업', '업종', '지역', '가치 평가 구간', '현재가', '이상 탐지'], shown.map(function (x) { var c = x.c, al = scan(c, null, day); return [c.name, c.sector, c.region, x.v ? won(x.v.low) + ' ~ ' + won(x.v.high) + '원' : '계산 모듈 없음', won(c.series[day]) + '원', { t:al.length ? al.length + '건' : '없음', c:al.length ? 'bad' : '' }]; }), [3, 4]));
    var all = d.cos.reduce(function (a, c) { return a.concat(scan(c, null, day).map(function (x) { return { co:c.name, x:x }; })); }, []);
    box.appendChild(h('div', { class:'box', id:'sim-s-alerts' }, [h('b', { text:'감독 AI 알림 ' + all.length + '건' })].concat(all.slice(-8).reverse().map(function (a) { return h('div', { class:'sub bad', text:a.x.day + '일째 ' + a.co + ': ' + won(a.x.from) + ' → ' + won(a.x.to) + '원 (' + (a.x.change > 0 ? '+' : '') + (a.x.change * 100).toFixed(1) + '%) — 주문 보류·확인 대상' }); }))));
    // ── 사업성 점검 ──
    var fm = feeModel(o), dt = detectTable(d), bt = backtest(d), pc = function (x) { return x == null ? '—' : (x * 100).toFixed(1) + '%'; };
    var biz = h('div', { class:'box', id:'sim-s-biz' }, [h('b', { text:'사업성 점검 (미래 상용화 준비용 · 모두 가정값)' }), h('div', { class:'sub', text:'요율·비용은 확정된 것이 아니라 가정이에요. 숫자를 바꿔 가며 어떤 조건에서 수지가 맞는지 봅니다.' }),
      h('div', { class:'row' }, [fld('sm-ft', '하루 거래 건수', o.ft), fld('sm-fa', '건당 평균 금액(원)', o.fa), fld('sm-fr', '우리 수수료율(%)', o.fr), fld('sm-br', '기존 증권사 수수료율(%) 가정', o.br), fld('sm-fc', '월 운영비(원) 가정', o.fc)]),
      h('div', { class:'sub', id:'sim-s-fee', text:'월 거래대금 ' + won(fm.volume) + '원 → 수수료 수입 ' + won(fm.revenue) + '원, 월 운영비를 빼면 ' + (fm.profit >= 0 ? '+' : '−') + won(Math.abs(fm.profit)) + '원. 투자자는 기존보다 월 ' + won(fm.saving) + '원을 덜 냅니다. 손익분기는 월 거래대금 ' + (fm.breakEvenVolume == null ? '—' : won(fm.breakEvenVolume) + '원(하루 약 ' + won(fm.breakEvenTradesPerDay) + '건)') + '입니다.' }),
      h('b', { text:'감독 AI 한도별 성적 (가상 시세에 심은 이상 변동 기준)' }),
      tbl(['한도(±)', '심은 이상 변동', '잡은 건수', '탐지율', '정상 날 오탐'], dt.map(function (x) { return [Math.round(x.limit * 100) + '%', x.total, x.hit, pc(x.recall), { t:x.falseAlarms + ' / ' + x.normalDays, c:x.falseAlarms ? 'bad' : '' }]; }), [1, 2, 3, 4]),
      h('div', { class:'sub', text:'한도를 낮추면 더 많이 잡지만 정상 변동을 잘못 잡는 일이 늘어요. 이 가상 시세는 정상 변동이 작게 만들어져 오탐이 적게 나오니, 실제 시세에서는 다시 재야 해요.' }),
      h('b', { text:'평가 구간 적중률 (성장 3%·요구수익률 10% 가정)' }),
      h('div', { class:'sub', id:'sim-s-bt', text:bt ? (bt.n ? '이익이 있는 기업 ' + bt.n + '곳 중 ' + bt.hit + '곳(' + pc(bt.rate) + ')의 "진짜 가치"가 구간 안에 들어왔어요. 구간 폭은 평균 ' + bt.avgWidth.toFixed(2) + '배예요. 진짜 가정은 성장 1~5%·요구수익률 8~12%에서 무작위로 정했어요.' : '이익이 있는 가상 기업이 없어 시험할 수 없어요.') : '계산 모듈이 없어 시험할 수 없어요.' }),
      h('b', { text:'장부 변조 시험' }),
      h('div', { class:'sub', text:'이음 장부를 만들고 한 곳씩 몰래 바꿔 보며 검증이 잡아내는지 봅니다(수량·가격·분개 금액 변경, 중간 전표 삭제). 맨 끝 전표 삭제는 따로 확인합니다.' }),
      h('div', { class:'row' }, [h('button', { type:'button', id:'sim-chain', text:'변조 시험 하기', onclick:function () { var el = document.getElementById('sim-s-chain'); if (el) el.textContent = '시험 중…'; chainTest(s.seed, 30).then(function (rs) { s.chain = rs; var e2 = document.getElementById('sim-s-chain'); if (e2) e2.textContent = rs ? rs.records + '건짜리 장부에서 변조 ' + rs.trials + '번 중 ' + rs.detected + '번 잡았어요(' + (rs.baselineOk ? '변조 전 장부는 정상' : '변조 전 장부도 이상') + '). 맨 끝 전표를 지우면 ' + (rs.tailTruncationDetected ? '이것도 잡았어요.' : '이 장부만으로는 못 잡아요(바깥에 기준 해시를 남겨 두는 보완이 필요해요).') : '이 환경에서는 시험할 수 없어요(공통 장부·암호 모듈 필요).'; }); } })]),
      h('div', { class:'sub', id:'sim-s-chain', text:s.chain ? s.chain.records + '건짜리 장부에서 변조 ' + s.chain.trials + '번 중 ' + s.chain.detected + '번 잡았어요.' : '' })]);
    box.appendChild(biz);
  }
}
function readOpt(kind) {
  var s = ST[kind], o = s.opt, g = function (id, d) { var e = document.getElementById(id); return e ? String(e.value).replace(/,/g, '') : d; };
  if (kind === 'market') { o.n = g('sm-n', o.n); o.spread = g('sm-sp', o.spread); o.odd = g('sm-odd', o.odd); }
  if (kind === 'tax') { o.n = g('sm-n', o.n); o.opex = g('sm-opex', o.opex); }
  if (kind === 'bank') { o.months = g('sm-mo', o.months); o.start = g('sm-st', o.start); o.income = g('sm-in', o.income); o.fixed = g('sm-fx', o.fixed); o.vol = g('sm-vol', o.vol); }
  if (kind === 'stock') { o.n = g('sm-n', o.n); o.ft = g('sm-ft', o.ft); o.fa = g('sm-fa', o.fa); o.fc = g('sm-fc', o.fc); o.fr = g('sm-fr', o.fr); o.br = g('sm-br', o.br); s.f = { sector:g('sm-sec', s.f.sector), region:g('sm-reg', s.f.region), size:g('sm-sz', s.f.size) }; }
}
function make(kind) {
  var s = ST[kind]; readOpt(kind); var G = { market:market, tax:tax, bank:bank, stock:stock }[kind]; s.data = G(s.seed, s.opt); if (kind === 'stock') s.day = 0; return s;
}
var OV = null, prevFocus = null;
function close() { ST._redraw = null; if (OV && OV.parentNode) OV.parentNode.removeChild(OV); OV = null; document.removeEventListener('keydown', onKey, true); if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) { /* 포커스 복귀 실패는 무시 */ } } }
function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
var DEF = { market:{ n:'6', spread:'8', odd:'15' }, tax:{ n:'14', opex:'0' }, bank:{ months:'12', start:'1000000', income:'2800000', fixed:'1900000', vol:'20' }, stock:{ n:'12', ft:'1000', fa:'500000', fc:'5000000', fr:'0.0015', br:'0.015' } };
function open(kind) {
  if (!TITLE[kind]) return false; if (OV) close();
  if (!document.getElementById('nsim-css')) { var st = document.createElement('style'); st.id = 'nsim-css'; st.textContent = CSS; document.head.appendChild(st); }
  var o = {}, k; for (k in DEF[kind]) o[k] = DEF[kind][k];
  ST[kind] = { seed:((Date.now() / 1000) | 0) % 100000, opt:o, f:{ sector:'', region:'', size:'' }, day:0 }; make(kind);
  prevFocus = document.activeElement; var box = h('div', { id:'sim-body' });
  function redraw() { body(kind, box); }
  ST._redraw = function () { readOpt(kind); redraw(); };
  var seedIn = h('input', { id:'sm-seed', type:'text', inputmode:'numeric', value:String(ST[kind].seed), 'aria-label':'시드', style:'width:90px' });
  var bar = h('div', { class:'row' }, [h('label', { for:'sm-seed' }, ['시드(같으면 같은 결과)', seedIn]), h('button', { type:'button', class:'pri', id:'sim-gen', text:'가상 데이터 만들기', onclick:function () { ST[kind].seed = ci(seedIn.value, 0, 4294967295, 1); make(kind); redraw(); } }),
    h('button', { type:'button', id:'sim-again', text:'다른 데이터로 다시', onclick:function () { ST[kind].seed = (ST[kind].seed + 1) % 4294967295; seedIn.value = String(ST[kind].seed); make(kind); redraw(); } })]);
  if (kind === 'market') bar.appendChild(h('button', { type:'button', id:'sim-next', text:'하루 진행(가격 변동)', onclick:function () { readOpt(kind); marketTick(ST[kind].data, ST[kind].seed + 7919 * (++ST[kind].day)); redraw(); } }));
  if (kind === 'stock') bar.appendChild(h('button', { type:'button', id:'sim-next', text:'하루 진행', onclick:function () { readOpt(kind); var s = ST[kind]; if (s.day < s.data.days - 1) s.day++; redraw(); } }));
  var dlg = h('div', { class:'nsim', role:'dialog', 'aria-modal':'true', 'aria-labelledby':'sim-title' }, [h('div', { style:'display:flex;justify-content:space-between;gap:8px' }, [h('h2', { id:'sim-title' }, [TITLE[kind], h('span', { class:'bd', text:'가상 데이터' })]), h('button', { type:'button', id:'sim-close', text:'닫기', onclick:close })]),
    h('div', { class:'sub', text:LEAD[kind] }), h('div', { class:'sub', text:'여기서 만든 데이터는 이 창에만 있고, 실제 장부·잔고·전표·기록에는 들어가지 않아요. 창을 닫으면 사라져요.' }), bar, box]);
  OV = h('div', { class:'nsim-ov', id:'nsim-ov', onclick:function (e) { if (e.target === OV) close(); } }, [dlg]); document.body.appendChild(OV); document.addEventListener('keydown', onKey, true); redraw();
  var c = document.getElementById('sim-close'); if (c) c.focus(); return true;
}
window.NaviSim = { open:open, close:close, rng:rng, viab:{ feeModel:feeModel, detectTable:detectTable, backtest:backtest, chainTest:chainTest }, gen:{ market:market, marketTick:marketTick, tax:tax, bank:bank, stock:stock, valueCo:valueCo, scan:scan, bandOf:bandOf } };
})();
