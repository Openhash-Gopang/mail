import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const rd = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const lrnApp = rd('../learn-app.js'), insApp = rd('../insurance-app.js'), sim = rd('../sim-lab.js'), ledger = rd('../ledger-book.js'), stockApp = rd('../stock-app.js'), taxApp = rd('../tax-app.js'), bankApp = rd('../bank-app.js'), mktApp = rd('../market-app.js'), desk = rd('../desktop.html'), paths = rd('../ops/naviweb-proxy/mail-paths.js');
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
  S.open('stock'); doc.getElementById('sim-next').click(); assert.match(doc.getElementById('sim-body').textContent, /시세 21일째/); S.tab('stock', 'explore'); const rows0 = doc.querySelectorAll('#sim-body tbody tr').length; assert.ok(rows0 >= 3);
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
      assert.ok(doc.getElementById('sim-title-t').textContent.includes(label), label); seen.add(body); total++;
      assert.equal(doc.getElementById('nsim-pn').querySelectorAll('.chips button.cur').length, 1);
    }
    assert.ok(seen.size >= pg.tabs.length - 2, k + ' 탭마다 내용이 달라야 해요');
    assert.equal(S.tab(k, '없는탭'), false); S.close();
  }
  assert.equal(total, 11 + 6 + 5 + 12 + 5 + 5 + 7 + 1 + 1 + 3 + 8 + 5 + 3 + 6 + 22); assert.equal(w.localStorage.length, before); assert.equal(fetched(), 0);
  S.open('stock', 'goal'); doc.getElementById('sm-sv').value = '500000'; doc.getElementById('sm-sv').dispatchEvent(new w.Event('change', { bubbles: true })); assert.match(doc.getElementById('sim-g-sum').textContent, /목표를 넘긴/);
  S.open('stock', 'alloc'); doc.getElementById('sm-wa').value = '100'; doc.getElementById('sm-wa').dispatchEvent(new w.Event('change', { bubbles: true })); assert.match(doc.getElementById('sim-a-sum').textContent, /현금 비중 0%/);
  S.open('market', 's3'); { let sd = 1; while (!(S.gen.market(sd, { n: 6, spread: 8, odd: 15 }).rows[0].band.lo > 1)) sd++; doc.getElementById('sm-seed').value = String(sd); doc.getElementById('sim-gen').click(); } doc.getElementById('sm-bud').value = '1'; doc.getElementById('sm-bud').dispatchEvent(new w.Event('change', { bubbles: true })); assert.match(doc.getElementById('sim-m-b').textContent, /살 곳이 없을 수 있어요/);
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

test('교육 시뮬레이션: 같은 시드는 같은 결과, 몰아치기 기록은 추가 확인에 걸리고, 버튼이 현재 탭을 넘긴다', { skip }, () => {
  const { S, doc } = env(); assert.equal(J(S.gen.learn(5)), J(S.gen.learn(5))); assert.notEqual(J(S.gen.learn(5)), J(S.gen.learn(6)));
  let found = 0; for (let sd = 1; sd <= 20; sd++) { const d = S.gen.learn(sd); if (d.logs.some((l) => l.min >= 240)) found++; } assert.ok(found > 5);
  S.open('learn', 'history'); assert.match(doc.getElementById('sim-e-hist').textContent, /추가 확인 \d+건/); S.tab('learn', 'career'); assert.match(doc.getElementById('sim-e-car').textContent, /살펴볼 분야/);
  assert.match(lrnApp, /_simOpen\('learn', S\.view\)/); assert.match(lrnApp, /id:'learn-sim'/);
});

test('서류·기록 시뮬레이션: 서류함·외부 입력·서류 작성·PDV가 각자 내용을 그리고, 화면에 버튼이 있다', { skip }, () => {
  const { S, doc } = env(true);
  S.open('othersite', 'steps'); for (let i = 0; i < 5; i++) doc.getElementById('sim-ost-next').click(); assert.match(doc.getElementById('sim-ost-sum').textContent, /제출 버튼은 한 번도 도우미가 누르지 않았어요/);
  S.open('docs', 'write'); for (let i = 0; i < 3; i++) doc.getElementById('sim-w-next').click(); assert.match(doc.getElementById('sim-w-sum').textContent, /준법 점검/);
  S.open('pdv', 'bs'); assert.match(doc.getElementById('sim-p-bs').textContent, /장부 대조/); S.tab('pdv', 'vault'); assert.ok(doc.getElementById('sim-chain'));
  assert.equal(J(S.gen.forms(2)), J(S.gen.forms(2)));
  for (const id of ['docs-sim-drafts', 'docs-sim-done', 'myforms-sim', 'othersite-sim', 'pdv-sim']) assert.ok(desk.includes('id="' + id + '"'), id);
  assert.match(desk, /#pdv-root \[role=tab\]/);
});

test('버튼 위치: 모든 화면의 시뮬레이션 버튼은 같은 작은 모양(simbtn)이고, 제목 줄 오른쪽 끝에 놓는 공통 규칙이 있다', { skip }, () => {
  for (const [src, n] of [[stockApp, 1], [bankApp, 1], [taxApp, 1], [mktApp, 2], [insApp, 1], [lrnApp, 1]]) assert.equal((src.match(/class:'btn quiet simbtn', id:'[a-z-]*sim/g) || []).length, n);
  assert.equal((desk.match(/class="mfb-btn simbtn" id="[a-z-]*sim/g) || []).length, 11);
  assert.match(desk, /id="simbtn-css"/); assert.match(desk, /\.brand:has\(> \.simbtn\)\{display:flex/); assert.match(desk, /min-height:30px!important/);
});

test('설정 시뮬레이션: 아이디 규칙·백업 키 복구·폰 연동·부재중 자동응답이 입력에 따라 달라지고, 버튼이 현재 탭을 넘긴다', { skip }, () => {
  const { S, doc, w } = env(); const fire = (id, v) => { const e = doc.getElementById(id); e.value = v; e.dispatchEvent(new w.Event('change', { bubbles: true })); };
  S.open('settings', 'account'); fire('sm-uid', 'jupiter'); assert.match(doc.getElementById('sim-a-id').textContent, /이미 쓰는 사람/); fire('sm-uid', 'A!'); assert.match(doc.getElementById('sim-a-id').textContent, /쓸 수 없어요/); fire('sm-uid', 'navi_ok'); assert.match(doc.getElementById('sim-a-id').textContent, /쓸 수 있어요/);
  S.tab('settings', 'gdc'); const words = S.gen.settings(S.gen.settings ? 0 : 0).words; assert.ok(Array.isArray(words));
  const d = S.gen.settings(doc.getElementById('sm-seed').value ? Number(doc.getElementById('sm-seed').value) : 1); fire('sm-gk', d.words.join(' ')); assert.match(doc.getElementById('sim-g-key').textContent, /복구 성공/); fire('sm-gk', '틀림'); assert.match(doc.getElementById('sim-g-key').textContent, /복구되지 않아요/);
  S.tab('settings', 'phone'); fire('sm-pc', d.code); assert.match(doc.getElementById('sim-ph-sum').textContent, /연결됨/);
  S.tab('settings', 'autoreply'); fire('sm-as', '24'); fire('sm-ae', '30'); assert.match(doc.getElementById('sim-ar-sum').textContent, /7통 중 7통/);
  assert.equal(J(S.gen.settings(4)), J(S.gen.settings(4))); assert.match(desk, /NaviSim\.tab\('settings', name\)/); assert.match(desk, /_simOpen&&window\._simOpen\('settings',_SET_CUR_SEC\(\)\)|_simOpen\('settings',_SET_CUR_SEC\(\)\)/);
});

test('메일·길잡이 시뮬레이션: 받는 사람은 정확 일치만, 첨부 누락을 알리고, 늦어지는 과제를 표시하며, 버튼이 있다', { skip }, () => {
  const { S, doc, w } = env(); const fire = (id, v) => { const e = doc.getElementById(id); e.value = v; e.dispatchEvent(new w.Event('change', { bubbles: true })); };
  S.open('mail', 'compose'); fire('sm-mt', '김가'); assert.match(doc.getElementById('sim-m-chk').textContent, /정확히 일치하는 사람이 없어요/); fire('sm-mt', '김가온'); assert.match(doc.getElementById('sim-m-chk').textContent, /찾았어요/); assert.match(doc.getElementById('sim-m-chk').textContent, /첨부 파일이 없어요/); fire('sm-ma', '1'); assert.match(doc.getElementById('sim-m-chk').textContent, /점검 통과/);
  S.tab('mail', 'inbox'); assert.match(doc.getElementById('sim-m-inbox').textContent, /안 읽은 메일/); S.tab('mail', 'tags'); assert.ok(doc.getElementById('sim-body').textContent.includes('세무'));
  S.open('guide', 'prog'); assert.match(doc.getElementById('sim-gd-prog').textContent, /늦어지는 과제 \d개/); S.tab('guide', 'done'); assert.match(doc.getElementById('sim-gd-done').textContent, /성공 \d건/);
  for (const id of ['mail-sim', 'guide-sim-prog', 'guide-sim-done']) assert.ok(desk.includes('id="' + id + '"'), id); assert.match(desk, /NaviSim\.tab\('mail', name\)/);
  assert.equal(J(S.gen.mail(3)), J(S.gen.mail(3)));
});

test('홈 시뮬레이션: 입력 문장이 갈래로 안내되고, 사람은 정확 일치만 찾고, 숫자 코드는 실제 변환 규칙을 쓰며, 모드에 맞게 열린다', { skip }, () => {
  const { S, doc, w } = env(); const fire = (id, v) => { const e = doc.getElementById(id); e.value = v; e.dispatchEvent(new w.Event('change', { bubbles: true })); };
  S.open('home', 'input'); fire('sm-hq', '이번 달 부가세 얼마야'); assert.match(doc.getElementById('sim-h-route').textContent, /세무 회계 AI/); fire('sm-hq', '그냥 심심해'); assert.match(doc.getElementById('sim-h-route').textContent, /나만의 AI 비서/);
  S.tab('home', 'people'); const nm = S.gen.home(Number(doc.getElementById('sm-seed').value)).names[0]; fire('sm-hp', nm); assert.match(doc.getElementById('sim-h-find').textContent, /찾았어요/); fire('sm-hp', nm.slice(0, 1)); assert.match(doc.getElementById('sim-h-find').textContent, /정확히 같아야/);
  w._ncPhoneToDigits = (raw) => String(raw).replace(/\D/g, '') === '01000000001' ? { digits: '1000000001', kind: '휴대폰' } : { err: '규칙' };
  S.tab('home', 'code'); fire('sm-hn', '010-0000-0001'); assert.match(doc.getElementById('sim-h-code').textContent, /연습 식당/);
  S.tab('home', 'attach'); doc.getElementById('sim-h-att0').click(); assert.match(doc.getElementById('sim-h-atts').textContent, /붙인 것: 마이크/);
  S.tab('home', 'chat'); doc.getElementById('sim-h-p2p').click(); doc.getElementById('sim-h-p2p').click(); assert.match(doc.getElementById('sim-h-p2ps').textContent, /이전 대화 복구/);
  assert.ok(desk.includes('id="home-sim"')); assert.match(desk, /function _homeSimOpen/); assert.equal(J(S.gen.home(2)), J(S.gen.home(2)));
});

test('바깥 클릭: 패널 밖을 누르면 닫히고, 패널 안·시뮬레이션 버튼을 누르면 닫히지 않는다', { skip }, async () => {
  const { S, doc, w } = env(true); doc.body.insertAdjacentHTML('beforeend', '<div id="out">밖</div><button class="simbtn" id="sb">시뮬레이션</button>');
  const click = (el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); const wait = () => new Promise((r) => setTimeout(r, 10));
  S.open('stock', 'portfolio'); await wait(); click(doc.getElementById('sim-body')); assert.ok(doc.getElementById('nsim-pn'), '안쪽 클릭은 유지');
  click(doc.getElementById('sb')); assert.ok(doc.getElementById('nsim-pn'), '시뮬레이션 버튼은 유지');
  click(doc.getElementById('out')); assert.ok(!doc.getElementById('nsim-pn'), '바깥 클릭은 닫힘');
  S.open('bank', 'wallet'); click(doc.getElementById('out')); assert.ok(doc.getElementById('nsim-pn'), '열자마자 들어온 같은 클릭으로는 닫히지 않음'); await wait(); click(doc.getElementById('out')); assert.ok(!doc.getElementById('nsim-pn'));
});

test('나머지 시뮬레이션: 의료·행정·전문가 인증서·홈 확장·평생 기록이 입력에 따라 달라지고 화면에 버튼이 있다', { skip }, () => {
  const { S, doc, w } = env(); const fire = (id, v) => { const e = doc.getElementById(id); e.value = v; e.dispatchEvent(new w.Event('change', { bubbles: true })); };
  S.open('med', 'principle'); assert.match(doc.getElementById('sim-md-prin').textContent, /5건 미만/);
  S.tab('med', 'submit'); fire('sm-sp', 'check'); assert.match(doc.getElementById('sim-md-sub').textContent, /혈액형/);
  S.open('pub', 'request'); fire('sm-rd', '25'); assert.match(doc.getElementById('sim-pb-req').textContent, /12월 5일/);
  S.tab('pub', 'log'); assert.match(doc.getElementById('sim-pb-log').textContent, /이어져/); fire('sm-lf', '1'); assert.match(doc.getElementById('sim-pb-log').textContent, /2번째 기록부터 지문이 맞지 않아요/);
  S.tab('pub', 'delegate'); fire('sm-dd', '3'); fire('sm-de', '5'); assert.match(doc.getElementById('sim-pb-del').textContent, /위임이 끝났어요/);
  S.open('cert', 'safety'); fire('sm-sa', '1'); assert.match(doc.getElementById('sim-c-safe').textContent, /사용자가 직접/); S.tab('cert', 'record'); assert.match(doc.getElementById('sim-e-hist').textContent, /추가 확인/);
  S.open('home', 'signup'); const code = /인증번호 (\d{6})/.exec(doc.getElementById('sim-h-sms').textContent)[1]; fire('sm-sgc', code); assert.match(doc.getElementById('sim-h-auth').textContent, /가입 완료/); fire('sm-sgc', '000000'); assert.match(doc.getElementById('sim-h-auth').textContent, /맞지 않아요/);
  S.tab('home', 'pclogin'); doc.getElementById('sim-h-auto').click(); assert.match(doc.getElementById('sim-h-auth').textContent, /로그인됐어요/);
  S.tab('home', 'clean'); fire('sm-ck', 'smell'); assert.match(doc.getElementById('sim-h-clean').textContent, /시·군 환경과/);
  S.tab('home', 'expert'); fire('sm-xg', '법률'); assert.match(doc.getElementById('sim-h-exp').textContent, /맞아요/);
  S.tab('home', 'learnai'); fire('sm-ld', '30'); assert.match(doc.getElementById('sim-h-learn').textContent, /8\d\.\d%/);
  S.open('pdv', 'life'); assert.match(doc.getElementById('sim-p-life').textContent, /허락 없이는 열리지 않아요/);
  for (const id of ['cert-sim']) assert.ok(desk.includes('id="' + id + '"')); assert.match(rd('../public-app.js'), /_simOpen\('pub'/);
});

test('검토 보완: 입력을 바꾸면 바로 새 가상 데이터가 만들어지고, 거래·내 기록은 이음 표와 변조 표시가 있으며, 모의 주문은 금액·수수료·한도를 계산하고, 점검 지표가 붙는다', { skip }, () => {
  const { S, doc, w } = env(true); const fire = (id, v) => { const e = doc.getElementById(id); e.value = v; e.dispatchEvent(new w.Event('change', { bubbles: true })); };
  S.open('tax', 'exp'); const before = doc.getElementById('sim-t-exp').textContent; fire('sm-opex', '5000000'); assert.notEqual(doc.getElementById('sim-t-exp').textContent, before); assert.match(doc.getElementById('sim-t-exp').textContent, /5,000,000원/);
  S.open('stock', 'trades'); assert.match(doc.getElementById('sim-st-chk').textContent, /이어져/); fire('sm-stfx', '3'); assert.match(doc.getElementById('sim-st-chk').textContent, /3번째 기록부터/);
  S.tab('stock', 'order'); fire('sm-oq', '10'); fire('sm-op', '1'); assert.match(doc.getElementById('sim-o-sum').textContent, /주문 보류·확인 대상/); assert.match(doc.getElementById('sim-o-sum').textContent, /수수료/);
  S.open('pdv', 'vault'); fire('sm-pvfx', '2'); assert.match(doc.getElementById('sim-pv-chk').textContent, /2번째 기록부터/);
  for (const [k, pg] of Object.entries(S.pages)) { S.open(k, pg.tabs[0][0]); assert.match(doc.getElementById('sim-metric').textContent, /점검 지표/, k); S.close(); }
  S.open('stock', 'portfolio'); assert.match(doc.getElementById('sim-body').textContent, /시세 20일째/);
});
