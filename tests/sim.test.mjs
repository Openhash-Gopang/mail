import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const rd = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const sim = rd('../sim-lab.js'), ledger = rd('../ledger-book.js'), stockApp = rd('../stock-app.js'), taxApp = rd('../tax-app.js'), bankApp = rd('../bank-app.js'), mktApp = rd('../market-app.js'), desk = rd('../desktop.html'), paths = rd('../ops/naviweb-proxy/mail-paths.js');
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
    assert.equal(S.open(k), true); const ov = doc.getElementById('nsim-ov'); assert.ok(ov); assert.match(ov.textContent, /가상 데이터/); assert.match(ov.textContent, /실제 장부·잔고·전표·기록에는 들어가지 않아요/);
    assert.equal(ov.querySelector('[role=dialog]').getAttribute('aria-modal'), 'true');
    doc.getElementById('sim-again').click(); doc.getElementById('sim-gen').click(); assert.ok(doc.getElementById('sim-body').textContent.length > 50, k);
    if (doc.getElementById('sim-next')) { doc.getElementById('sim-next').click(); }
    assert.equal(w.localStorage.length, before, k + ' 저장소 변경 없음'); assert.equal(fetched(), 0);
    doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); assert.ok(!doc.getElementById('nsim-ov'), k + ' Esc'); 
    S.open(k); doc.getElementById('sim-close').click(); assert.ok(!doc.getElementById('nsim-ov'));
  }
  assert.equal(env().S.open('nope'), false);
});
test('화면: 입력값을 바꿔 다시 만들면 반영되고, 증권은 하루 진행으로 시세가 움직이며 필터가 걸린다', { skip }, () => {
  const { S, doc, w } = env(true); S.open('bank'); doc.getElementById('sm-st').value = '0'; doc.getElementById('sm-in').value = '1,000,000'; doc.getElementById('sm-fx').value = '1500000'; doc.getElementById('sim-gen').click();
  assert.match(doc.getElementById('sim-b-sum').textContent, /거절된 결제 [1-9]/); assert.match(doc.getElementById('sim-b-sum').textContent, /장부 대조: .*✓/);
  S.open('stock'); const rows0 = doc.querySelectorAll('#sim-body tbody tr').length; assert.ok(rows0 >= 3); doc.getElementById('sim-next').click(); assert.match(doc.getElementById('sim-body').textContent, /시세 1일째/);
  const sec = doc.getElementById('sm-sec'); sec.value = '__none__'; sec.dispatchEvent(new w.Event('change', { bubbles: true }));
  const cnt = doc.querySelectorAll('#sim-body tbody tr').length; assert.ok(cnt <= rows0);
});
test('배선: 네 화면에 시뮬레이션 버튼이 있고 눌러도 오류 없이 시뮬레이션을 부르며, 로더·경로 목록에 등록돼 있다', { skip }, () => {
  for (const [src, id] of [[taxApp, 'tax-sim'], [bankApp, 'bank-sim'], [stockApp, 'stock-sim'], [mktApp, 'market-sim']]) assert.ok(src.includes("id:'" + id + "'"), id);
  assert.match(desk, /window\._simOpen = function/); assert.match(desk, /sim-lab\.js\?v=/); assert.match(paths, /"sim-lab\.js"/);
  const { w, doc } = env(true); const calls = []; w._simOpen = (k) => calls.push(k);
  w.NaviStock.mount(doc.getElementById('m'), { view: 'portfolio' }); doc.getElementById('stock-sim').click(); assert.deepEqual(calls, ['stock']);
  assert.ok(!/fetch\(|XMLHttpRequest/.test(sim));
});
