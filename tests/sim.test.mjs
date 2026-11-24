import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const rd = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const insApp = rd('../insurance-app.js'), sim = rd('../sim-lab.js'), ledger = rd('../ledger-book.js'), stockApp = rd('../stock-app.js'), taxApp = rd('../tax-app.js'), bankApp = rd('../bank-app.js'), mktApp = rd('../market-app.js'), desk = rd('../desktop.html'), paths = rd('../ops/naviweb-proxy/mail-paths.js');
function env(withStock = false) {
  const w = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true }).window;
  Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true }); w.TextEncoder = TextEncoder; let f = 0; w.fetch = () => { f++; return Promise.reject(new Error('no')); };
  w.eval(ledger); if (withStock) w.eval(stockApp); w.eval(sim); return { w, doc: w.document, S: w.NaviSim, fetched: () => f };
}
const J = (x) => JSON.stringify(x);

test('가상 데이터: 같은 시드는 같은 결과, 다른 시드는 다른 결과(재현 가능)', { skip }, () => {
  const { S } = env(true);
  for (const k of ['market', 'tax', 'bank', 'stock']) { assert.equal(J(S.gen[k](7)), J(S.gen[k](7)), k); assert.notEqual(J(S.gen[k](7)), J(S.gen[k](8)), k); }
  assert.ok(S.rng(3)() >= 0 && S.rng(3)() < 1);
});
test('시장: 이상 가격(과다·너무 낮음)은 대부분 가려내고, 정상 가격은 거의 걸리지 않는다', { skip }, () => {
  const { S } = env(); let inj = 0, hit = 0, norm = 0, fp = 0;
  for (let seed = 1; seed <= 30; seed++) for (const rw of S.gen.market(seed, { n: 12, spread: 6, odd: 15 }).rows) for (const x of rw.offers) { if (x.injected) { inj++; if (x.v !== '적정') hit++; } else { norm++; if (x.v !== '적정') fp++; } }
  assert.ok(inj > 100 && hit / inj > 0.85, 'recall ' + hit / inj); assert.ok(fp / norm < 0.08, 'fp ' + fp / norm);
  const d = S.gen.market(5); const before = J(d.rows.map((r) => r.band)); S.gen.marketTick(d, 99); assert.notEqual(J(d.rows.map((r) => r.band)), before);
});
test('세무: 부가세 = 매출세액 − 매입세액, 원가는 공통 장부 규칙, 영업이익·세금 계산', { skip }, () => {
  const { S, w } = env(); const d = S.gen.tax(11, { n: 20, opex: 50000 });
  assert.equal(d.vatDue, d.vatOut - d.vatIn); assert.equal(d.recs.length, 20);
  assert.equal(d.cogs, w.NaviLedger.costFlow('나', d.recs).cogs); assert.equal(d.op, d.sales - d.cogs - 50000); assert.equal(d.tax.total, w.NaviLedger.incomeTax(d.op).total);
});
test('은행: 잔고는 음수가 되지 않고(부족한 결제는 거절), 장부 대조가 맞는다', { skip }, () => {
  const { S } = env(); for (let seed = 1; seed <= 20; seed++) { const d = S.gen.bank(seed, { months: 24, start: 0, income: 1000000, fixed: 1200000, vol: 30 }); assert.ok(d.rows.every((r) => r.close >= 0)); assert.ok(d.reconciled); assert.ok(d.min >= 0); }
  assert.ok(S.gen.bank(1, { start: 0, income: 1000000, fixed: 1500000 }).rejected > 0);
});
test('증권: 급변동일을 감독 AI 가 모두 찾고, 가치 평가는 증권 화면 규칙으로 구간을 낸다', { skip }, () => {
  const { S } = env(true); const d = S.gen.stock(21, { n: 20, days: 120 });
  for (const c of d.cos) { const f = S.gen.scan(c); assert.deepEqual(f.map((x) => x.day), c.shock.filter((day) => Math.abs((c.series[day] - c.series[day - 1]) / c.series[day - 1]) > 0.3)); }
  const v = S.gen.valueCo(d.cos[0]); assert.ok(v && v.high >= v.low);
  assert.equal(env(false).S.gen.valueCo(d.cos[0]), null);
});
test('화면: 열면 가상 데이터 표시가 있고, 실제 저장소에는 아무것도 쓰지 않으며, Esc·닫기로 닫힌다', { skip }, () => {
  for (const k of ['market', 'tax', 'bank', 'stock']) {
    const { S, doc, w, fetched } = env(true); const before = w.localStorage.length;
    assert.equal(S.open(k), true); const ov = doc.getElementById('nsim-pn'); assert.ok(ov); assert.ok(!doc.querySelector('[role=dialog]'), '팝업(dialog)이 아니라 패널'); assert.match(ov.textContent, /가상 데이터/); assert.match(ov.textContent, /실제 장부·잔고·전표·기록에는 들어가지 않아요/);
    assert.equal(ov.getAttribute('role'), 'complementary'); assert.equal(ov.parentNode, doc.body);
    doc.getElementById('sim-again').click(); doc.getElementById('sim-gen').click(); assert.ok(doc.getElementById('sim-body').textContent.length > 50, k);
    if (doc.getElementById('sim-next')) { doc.getElementById('sim-next').click(); }
    assert.equal(w.localStorage.length, before, k + ' 저장소 변경 없음'); assert.equal(fetched(), 0);
    doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); assert.ok(!doc.getElementById('nsim-pn'), k + ' Esc'); 
    S.open(k); doc.getElementById('sim-close').click(); assert.ok(!doc.getElementById('nsim-pn'));
  }
  assert.equal(env().S.open('nope'), false);
});
test('화면: 입력값을 바꿔 다시 만들면 반영되고, 증권은 하루 진행으로 시세가 움직이며 필터가 걸린다', { skip }, () => {
  const { S, doc, w } = env(true); S.open('bank'); doc.getElementById('sm-st').value = '0'; doc.getElementById('sm-in').value = '1,000,000'; doc.getElementById('sm-fx').value = '1500000'; doc.getElementById('sim-gen').click();
  assert.match(doc.getElementById('sim-b-sum').textContent, /거절된 결제 [1-9]/); assert.match(doc.getElementById('sim-b-sum').textContent, /장부 대조: .*✓/);
  S.open('stock'); doc.getElementById('sim-next').click(); assert.match(doc.getElementById('sim-body').textContent, /시세 1일째/); S.tab('stock', 'explore'); const rows0 = doc.querySelectorAll('#sim-body tbody tr').length; assert.ok(rows0 >= 3);
  const sec = doc.getElementById('sm-sec'); sec.value = '__none__'; sec.dispatchEvent(new w.Event('change', { bubbles: true }));
  const cnt = doc.querySelectorAll('#sim-body tbody tr').length; assert.ok(cnt <= rows0);
});
test('배선: 네 화면에 시뮬레이션 버튼이 있고 눌러도 오류 없이 시뮬레이션을 부르며, 로더·경로 목록에 등록돼 있다', { skip }, () => {
  for (const [src, id] of [[taxApp, 'tax-sim'], [bankApp, 'bank-sim'], [stockApp, 'stock-sim'], [mktApp, 'market-sim']]) assert.ok(src.includes("id:'" + id + "'"), id);
  assert.match(desk, /window\._simOpen = function/); assert.match(desk, /sim-lab\.js\?v=/); assert.match(paths, /"sim-lab\.js"/);
  const { w, doc } = env(true); const calls = []; w._simOpen = (k, tab) => calls.push([k, tab]);
  w.NaviStock.mount(doc.getElementById('m'), { view: 'portfolio' }); doc.getElementById('stock-sim').click(); assert.deepEqual(calls, [['stock', 'portfolio']]);
  assert.ok(!/fetch\(|XMLHttpRequest/.test(sim));
});

// ── 8단계: 사업성 점검 ──
test('수수료 모형: 월 거래대금·수입·절감액·손익분기가 산식대로 나온다', { skip }, () => {
  const { S } = env(); const f = S.viab.feeModel({ ft: '1000', fa: '500000', fr: '0.0015', br: '0.015', fc: '5000000' });
  assert.equal(f.volume, 1000 * 500000 * 22); assert.equal(Math.round(f.revenue), 165000); assert.equal(Math.round(f.saving), 1485000); assert.equal(Math.round(f.profit), 165000 - 5000000);
  assert.equal(Math.round(f.breakEvenVolume), Math.round(5000000 / 0.000015)); assert.ok(f.breakEvenTradesPerDay > 0);
  assert.equal(S.viab.feeModel({ fr: '0' }).breakEvenVolume, null); assert.equal(S.viab.feeModel({ ft: 'abc' }).trades, 1000);
});
test('감독 한도별 성적: 한도를 높이면 탐지율·오탐이 줄고, 심은 이상 변동 수는 같다', { skip }, () => {
  const { S } = env(); const t = S.viab.detectTable(S.gen.stock(5, { n: 30, days: 200 }));
  assert.equal(new Set(t.map((x) => x.total)).size, 1); assert.ok(t[0].total > 20);
  for (let i = 1; i < t.length; i++) { assert.ok(t[i].hit <= t[i - 1].hit); assert.ok(t[i].falseAlarms <= t[i - 1].falseAlarms); }
  assert.ok(t[0].recall > t[3].recall);
});
test('평가 구간 백테스트: 증권 모듈이 있으면 적중률을 내고, 없으면 null', { skip }, () => {
  const { S } = env(true), d = S.gen.stock(9, { n: 40 }); const b = S.viab.backtest(d); assert.ok(b && b.n > 5 && b.hit <= b.n && b.rate >= 0 && b.rate <= 1 && b.avgWidth > 1);
  assert.equal(env(false).S.viab.backtest(d), null);
});
test('장부 변조 시험: 변조는 모두 잡히고 변조 전 장부는 정상, 저장소는 건드리지 않는다', { skip }, async () => {
  const { S, w } = env(); const before = w.localStorage.length; const r = await S.viab.chainTest(3, 40);
  assert.ok(r.baselineOk); assert.equal(r.detected, r.trials); assert.equal(r.tailTruncationDetected, false);   // 끝 전표 삭제는 이음만으로는 못 잡는다(알려진 한계)
  assert.ok(r.records >= 5); assert.equal(w.localStorage.length, before);
});
test('화면: 증권 시뮬레이션에 사업성 점검이 보이고, 수수료율을 바꾸면 다시 계산되며 변조 시험이 돈다', { skip }, async () => {
  const { S, doc, w } = env(true); S.open('stock', 'order'); assert.match(doc.getElementById('sim-s-fee').textContent, /손익분기/);
  const before = doc.getElementById('sim-s-fee').textContent; const fr = doc.getElementById('sm-fr'); fr.value = '0.01'; fr.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.notEqual(doc.getElementById('sim-s-fee').textContent, before); S.tab('stock', 'company'); assert.match(doc.getElementById('sim-s-bt').textContent, /진짜 가치|시험할 수 없어요/); S.tab('stock', 'trades');
  doc.getElementById('sim-chain').click(); await new Promise((r) => setTimeout(r, 400)); assert.match(doc.getElementById('sim-s-chain').textContent, /변조 30번 중 30번 잡았어요.*맨 끝 전표를 지우면 이 장부만으로는 못 잡아요/);
});

test('탭마다 시뮬레이션: 네 화면의 모든 탭이 각자 내용을 그리고, 탭을 옮기면 패널이 따라가며, 저장소·네트워크는 쓰지 않는다', { skip }, () => {
  const { S, doc, w, fetched } = env(true); const before = w.localStorage.length; let total = 0;
  for (const [k, pg] of Object.entries(S.pages)) {
    S.open(k, pg.tabs[0][0]); const seen = new Set();
    for (const [id, label] of pg.tabs) {
      assert.equal(S.tab(k, id), true, k + id); const body = doc.getElementById('sim-body').textContent; assert.ok(body.length > 20, k + ':' + id + ' 비어 있음');
      assert.match(doc.getElementById('sim-title-t').textContent, new RegExp(label)); seen.add(body); total++;
      assert.equal(doc.getElementById('nsim-pn').querySelectorAll('.chips button.cur').length, 1);
    }
    assert.ok(seen.size >= pg.tabs.length - 2, k + ' 탭마다 내용이 달라야 해요');
    assert.equal(S.tab(k, '없는탭'), false); S.close();
  }
  assert.equal(total, 11 + 6 + 5 + 12 + 5); assert.equal(w.localStorage.length, before); assert.equal(fetched(), 0);
  S.open('stock', 'goal'); doc.getElementById('sm-sv').value = '500000'; doc.getElementById('sm-sv').dispatchEvent(new w.Event('change', { bubbles: true })); assert.match(doc.getElementById('sim-g-sum').textContent, /목표를 넘긴/);
  S.open('stock', 'alloc'); doc.getElementById('sm-wa').value = '100'; doc.getElementById('sm-wa').dispatchEvent(new w.Event('change', { bubbles: true })); assert.match(doc.getElementById('sim-a-sum').textContent, /현금 비중 0%/);
  S.open('market', 's3'); doc.getElementById('sm-bud').value = '1'; doc.getElementById('sm-bud').dispatchEvent(new w.Event('change', { bubbles: true })); assert.match(doc.getElementById('sim-m-b').textContent, /살 곳이 없을 수 있어요/);
});
test('배선: 각 화면은 현재 탭을 시뮬레이션에 넘기고, 화면을 옮기면 패널을 닫는다', { skip }, () => {
  assert.match(stockApp, /_simOpen\('stock', S\.view\)/); assert.match(bankApp, /_simOpen\('bank', S\.view\)/); assert.match(mktApp, /_simOpen\('market', 's' \+ S\.step\)/); assert.match(mktApp, /market-sim-sell/); assert.match(taxApp, /_simOpen\('tax', 'slip'\)/);
  assert.match(desk, /NaviSim\.close\(\);[^\n]*다른 화면으로 가면/); assert.ok(!/aria-modal/.test(sim) && !/nsim-ov/.test(sim));
});

test('보험 시뮬레이션: 같은 시드는 같은 결과, 가입자가 많을수록 손해율이 안정되고, 화면 버튼이 현재 탭을 넘긴다', { skip }, () => {
  const { S, doc, w } = env(); assert.equal(J(S.gen.insure(3)), J(S.gen.insure(3))); assert.notEqual(J(S.gen.insure(3)), J(S.gen.insure(4)));
  const spread = (n) => { const xs = []; for (let sd = 1; sd <= 40; sd++) xs.push(S.gen.insure(sd, { n, rate: 4, prem: 20000, cov: 10000000 }).lossRatio); const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };
  assert.ok(spread(5000) < spread(50), '대수의 법칙');
  S.open('insure', 'claims'); assert.match(doc.getElementById('sim-i-claims').textContent, /추가 확인/); S.tab('insure', 'mine'); assert.match(doc.getElementById('sim-i-mine').textContent, /월 보험료/);
  assert.match(insApp, /_simOpen\('insure', S\.view\)/); assert.match(insApp, /id:'insure-sim'/);
});
