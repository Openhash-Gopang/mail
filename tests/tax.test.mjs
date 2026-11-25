import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const rd = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const ledger = rd('../ledger-book.js'), app = rd('../tax-app.js'), css = rd('../tax.css'), d = rd('../desktop.html'), paths = rd('../ops/naviweb-proxy/mail-paths.js'), sp = rd('../infra-sp.js');
const wait = (ms = 80) => new Promise((r) => setTimeout(r, ms));
function page() {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true }); w.TextEncoder = TextEncoder; w.Element.prototype.scrollIntoView = () => {};
  w.eval(ledger); w.eval(app); const doc = w.document, asks = [];
  w.NaviTax.on('ask', (t) => asks.push(t)); w.NaviTax.mount(doc.getElementById('m'));
  const txt = () => doc.getElementById('tx-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  const type = (id, v) => { const i = doc.getElementById(id); i.value = v; i.dispatchEvent(new w.Event('input', { bubbles: true })); };
  return { w, doc, asks, txt, btn, type, fetched: () => fetched, N: w.NaviTax };
}
const F = (o = {}) => ({ buyer: '나', seller: '철수상회', when: '2026-11-24', where: '나비웹 시장 인프라', what: '무선 청소기', qty: '2', price: '90000', how: 'GDC 결제', why: '재택 근무용', ...o });

test('전표 검사: 6하 원칙이 모두 있어야 하고, 구매자와 판매자는 달라야 한다', { skip }, () => {
  const c = page().N.flow.check;
  assert.equal(c(F()).ok, true); assert.equal(c(F()).slip.supply, 180000);
  for (const k of ['buyer', 'seller', 'when', 'where', 'what', 'how', 'why', 'qty', 'price']) assert.equal(c(F({ [k]: '' })).ok, false, k);
  assert.equal(c(F({ seller: '나' })).ok, false); assert.equal(c(F({ when: '24-11-24' })).ok, false); assert.equal(c(F({ qty: '0' })).ok, false); assert.equal(c(F({ price: '1.5' })).ok, false);
});
test('흐름: 서명 4개·일련번호·세액이 붙고 두 장부가 같은 전표에서 나온다', { skip }, async () => {
  const N = page().N, r = await N.flow.run(F(), 0); assert.equal(r.ok, true);
  const rec = r.rec; assert.match(rec.serial, /^MK-20261124-0001$/); assert.equal(rec.tax, 18000);
  for (const k of ['sigB', 'sigS', 'sigI', 'sigN']) assert.ok(rec[k].length > 40, k);
  assert.equal(rec.buyer.hash, rec.hash); assert.equal(rec.seller.hash, rec.hash); assert.equal(rec.buyer.serial, rec.serial);
  const sum = (e, i) => e.lines.reduce((a, l) => a + l[i], 0);
  assert.equal(sum(rec.buyer, 1), sum(rec.buyer, 2)); assert.equal(sum(rec.seller, 1), sum(rec.seller, 2));           // 대차 균형
  assert.equal(rec.buyer.lines[2][2], 198000); assert.equal(rec.seller.lines[0][1], 198000);
  assert.equal(rec.hops.length, 7); assert.ok(rec.hops[2].text.includes('인프라 서명과 당사자 서명을 확인했어요'));
  assert.equal((await N.flow.run(F({ seller: '' }), 0)).ok, false);
});
test('진실성: 일련번호로 확인하면 통과하고, 금액·세액·서명·해시를 건드리면 드러난다', { skip }, async () => {
  const N = page().N, rec = (await N.flow.run(F(), 0)).rec, T = (x) => N.flow.trace(x), cp = () => JSON.parse(JSON.stringify(rec));
  assert.equal((await T(rec)).ok, true);
  let x = cp(); x.buyer.lines[0][1] += 1; let t = await T(x); assert.equal(t.ok, false); assert.ok(t.checks.find((c) => c.k.includes('구매자 장부')).ok === false);
  x = cp(); x.seller.lines[1][2] += 1; t = await T(x); assert.equal(t.ok, false); assert.ok(t.checks.find((c) => c.k.includes('판매자 장부')).ok === false);
  x = cp(); x.tax += 1; t = await T(x); assert.equal(t.ok, false); assert.equal(t.checks.find((c) => c.k.includes('국세청')).ok, false);
  x = cp(); x.slip.price += 1; t = await T(x); assert.equal(t.ok, false); assert.equal(t.checks.find((c) => c.k.includes('구매자 시장 SP')).ok, false);
  x = cp(); x.sigI = x.sigB; t = await T(x); assert.equal(t.ok, false); assert.equal(t.checks.find((c) => c.k.includes('인프라')).ok, false);
  x = cp(); x.hash = 'x'.repeat(64); t = await T(x); assert.equal(t.ok, false);
});
test('화면: 받은 전표 없음 → 예시 전표 → 국세청 AI에 보내기 → 흐름·두 장부·내 장부 합계·확인·몰래 고치기', { skip }, async () => {
  const p = page(), { doc, btn } = p;
  assert.ok(p.txt().includes('세무 회계') && p.txt().includes('받은 거래 전표'));
  assert.ok(!doc.getElementById('tx-buyer') && !doc.getElementById('tx-seller') && !doc.getElementById('tx-go'));       // 시장 내용(거래 입력 폼)은 두지 않는다
  assert.ok(doc.getElementById('tx-empty') && !btn('국세청 AI에 보내기'));
  btn('거래 전표 받기').click(); assert.ok(p.txt().includes('무선 청소기') && p.txt().includes('180,000원')); await wait(500); assert.ok(doc.getElementById('tx-infra-sig-0').textContent.includes('시장 인프라 디지털 서명 ✓') && !p.txt().includes('국세청 서명'));
  btn('국세청 AI에 보내기').click(); await wait(400); assert.ok(doc.getElementById('tx-sent') && doc.getElementById('tx-sent').textContent.includes('시장 인프라 디지털 서명') && doc.getElementById('tx-sent').textContent.includes('국세청 AI에 보냈어요') && !doc.getElementById('tx-empty')); assert.ok(doc.getElementById('tx-signed') && p.txt().includes('국세청 서명') && p.txt().includes('부가세(10%'));  assert.ok(doc.getElementById('tx-step1') && !doc.getElementById('tx-slips') && !doc.getElementById('tx-stmts') && !doc.getElementById('tx-hist') && p.txt().includes('서명된 거래 전표를 보냅니다')); doc.getElementById('tx-step1').click(); await wait(100); assert.ok(doc.getElementById('tx-slips') && !doc.getElementById('tx-stmts') && doc.getElementById('tx-step2') && p.txt().includes('회계사 AI에게 보냅니다')); doc.getElementById('tx-step2').click(); await wait(100); assert.ok(doc.getElementById('tx-stmts') && !doc.getElementById('tx-hist') && doc.getElementById('tx-step3') && p.txt().includes('거래 이력을 기록합니다')); doc.getElementById('tx-step3').click(); await wait(100); assert.ok(doc.getElementById('tx-hist'));
  assert.ok(doc.getElementById('tx-hops').children.length === 7); assert.ok(p.txt().includes('MK-') && p.txt().includes('구매자 장부') && p.txt().includes('판매자 장부'));
  assert.ok(doc.getElementById('tx-led-b').textContent.includes('부가세대급금') && doc.getElementById('tx-led-s').textContent.includes('부가세예수금'));
  assert.ok(doc.getElementById('tx-books').textContent.includes('18,000') && doc.getElementById('tx-books').textContent.includes('대차가 맞아요'));
  assert.ok(doc.getElementById('tx-empty') && !btn('국세청 AI에 보내기'));                                                // 보낸 전표는 목록에서 빠진다
  btn('일련번호로 확인').click(); await wait(300); assert.ok(doc.getElementById('tx-trace-ok').textContent.includes('모두 맞아요'));
  btn('장부를 몰래 고친다면?').click(); await wait(300); assert.ok(doc.getElementById('tx-tam-out').textContent.includes('드러나요'));
  assert.ok(doc.getElementById('tx-led-b').textContent.includes('180,000'));                                       // 실제 장부는 그대로
  const s = JSON.parse(p.w.localStorage.getItem('navi-tax-v2')); assert.equal(s.rec.length, 1);
  p.N.mount(doc.getElementById('m')); assert.ok(p.txt().includes('MK-'));                                            // 다시 열어도 남아 있다
  btn('일련번호로 확인').click(); await wait(300); assert.ok(doc.getElementById('tx-trace-ok').textContent.includes('모두 맞아요'));
  btn('체험 기록 지우기').click(); btn('정말 지울까요').click(); assert.ok(!p.txt().includes('MK-')); assert.equal(p.fetched(), 0);
});
test('화면: 시장 화면이 남긴 구매 거래가 받은 전표로 도착한다(읽기만 한다)', { skip }, async () => {
  const p = page(), { doc, btn } = p;
  p.w.localStorage.setItem('navi-market-v2', JSON.stringify({ ledger: [{ kind: 'trade', body: { terms: { item: '무선 청소기 A200', qty: 1, price: 189000, buyer: '나', seller: '판매자', d: '2026-11-24', n: 'abc123' } } }] }));
  p.N.mount(doc.getElementById('m')); assert.ok(p.txt().includes('무선 청소기 A200') && p.txt().includes('시장 화면의 구매') && p.txt().includes('189,000원'));
  btn('국세청 AI에 보내기').click(); await wait(400); for (const id of ['tx-step1', 'tx-step2', 'tx-step3']) { doc.getElementById(id).click(); await wait(100); } assert.ok(doc.getElementById('tx-books').textContent.includes('18,900'));      // 189,000의 10%
  assert.ok(doc.getElementById('tx-empty'));
  p.N.mount(doc.getElementById('m')); assert.ok(doc.getElementById('tx-empty'));                                      // 다시 열어도 같은 거래가 되돌아오지 않는다
  assert.equal(JSON.parse(p.w.localStorage.getItem('navi-market-v2')).ledger.length, 1); assert.equal(p.fetched(), 0);
});
test('이름 "세무 회계" + desktop.html 연결 + 경로 + 범위 css + SP', () => {
  assert.ok(d.includes('data-label="세무 회계"') && d.includes("['ktax','세무 회계']") && !d.includes("['ktax','세무']") && !d.includes('data-label="세무"'));
  assert.ok(d.includes("go.indexOf('tax:') === 0") && d.includes("if (name === 'tax') _taxShow();") && d.includes('id="tab-tax"') && d.includes("'거래 전표>tax:main'"));
  assert.ok(paths.includes('"tax-app.js"') && paths.includes('"tax.css"')); assert.ok(css.includes('.tx ') && css.includes('.tx-tl'));
  assert.ok(sp.includes('"n": "세무 회계"') && sp.includes('국세청 AI') && sp.includes('일련번호') && sp.includes('Openhash'));
});

test('화면: 전표를 처리하면 두 사람의 재무제표가 갱신되고 갱신일시·일련번호가 부기된다', { skip }, async () => {
const p = page(), { doc, btn } = p;
btn('거래 전표 받기').click(); btn('국세청 AI에 보내기').click(); await wait(400); for (const id of ['tx-step1', 'tx-step2', 'tx-step3']) { doc.getElementById(id).click(); await wait(100); }
const b = doc.getElementById('tx-stmt-b').textContent, s = doc.getElementById('tx-stmt-s').textContent, h = doc.getElementById('tx-hist').textContent;
assert.ok(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(b) && b.includes('MK-') && s.includes('MK-')); // 갱신일시와 일련번호 부기
assert.ok(b.includes('1,802,000') && b.includes('대차가 맞아요')); // 구매자: GDC 2,000,000 − 198,000
assert.ok(s.includes('5,198,000') && s.includes('3,180,000') && s.includes('6,880,000') && s.includes('대차가 맞아요')); // 판매자: GDC·매출·자본
assert.ok(h.includes('MK-') && h.includes('부가세예수금') && h.includes('부가세대급금') && h.includes('구매대금'));
assert.ok(doc.querySelectorAll('#tx-stmts tr[style*="background"]').length > 0); // 바뀐 계정 줄 강조
assert.ok(doc.getElementById('tx-hops').children[2].textContent.includes('제30조(세율')); // 세법 참조
assert.equal(p.fetched(), 0);
});

test('판관비 적기: 거래 뒤 카드가 나오고, 적으면 합계가 쌓이며 잘못된 금액은 막는다', { skip }, async () => {
  const p = page(); p.btn('거래 전표 받기').click(); await wait(500); p.btn('국세청 AI에 보내기').click(); await wait(600);
  assert.ok(p.doc.getElementById('tx-exp'));
  p.type('tx-e-amt', '0'); p.btn('적기').click(); assert.equal(p.doc.getElementById('tx-e-msg').getAttribute('role'), 'alert');
  p.type('tx-e-amt', '120,000'); p.type('tx-e-memo', '11월 월세'); p.btn('적기').click();
  assert.match(p.doc.getElementById('tx-e-msg').textContent, /EX-0001 임차료 120,000원/); assert.match(p.doc.getElementById('tx-exp').textContent, /내가 적은 기록/);
  assert.equal(JSON.parse(p.w.localStorage.getItem('navi-exp-v1')).items.length, 1); assert.equal(p.fetched(), 0);
  p.btn('체험 기록 지우기').click(); p.btn('정말 지울까요').click(); assert.equal(p.w.localStorage.getItem('navi-exp-v1'), null);
});

test('홈택스에서 가져오기: 연결이 없으면 알리고, 있으면 고른 조회만 넘기며 제출·납부는 하지 않는다고 밝힌다', { skip }, () => {
  const p = page(); assert.match(p.txt(), /신고서 제출과 납부는 하지 않아요/);
  p.doc.getElementById('tx-ht-go').click(); assert.match(p.doc.getElementById('tx-ht-msg').textContent, /도우미를 쓸 수 없는 화면/);
  const jobs = []; p.N.on('agent', (j) => jobs.push(j));
  const s = p.doc.getElementById('tx-ht'); s.value = 'inv'; s.dispatchEvent(new p.w.Event('change')); p.doc.getElementById('tx-ht-go').click();
  assert.equal(jobs.length, 1); assert.equal(jobs[0].kind, 'inv'); assert.match(jobs[0].goal, /전자세금계산서/); assert.match(p.doc.getElementById('tx-ht-msg').textContent, /맡기는 중/);
  p.N.agentResult(true, '도우미가 홈택스를 엽니다.'); assert.match(p.doc.getElementById('tx-ht-msg').textContent, /홈택스를 엽니다/);
  assert.equal(p.fetched(), 0);
  assert.match(d, /NaviTax\.on\('agent', _taxAgent\)/); assert.match(d, /hometax\.go\.kr/);
});
