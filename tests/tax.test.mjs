import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const rd = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const app = rd('../tax-app.js'), css = rd('../tax.css'), d = rd('../desktop.html'), paths = rd('../ops/naviweb-proxy/mail-paths.js'), sp = rd('../infra-sp.js');
const wait = (ms = 80) => new Promise((r) => setTimeout(r, ms));
function page() {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true }); w.TextEncoder = TextEncoder; w.Element.prototype.scrollIntoView = () => {};
  w.eval(app); const doc = w.document, asks = [];
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
test('화면: 한 페이지에 6하 원칙 입력 → 거래 성사 → 흐름·두 장부·확인·몰래 고치기', { skip }, async () => {
  const p = page(), { doc, btn, type } = p;
  assert.ok(p.txt().includes('거래 전표 한 장이') && p.txt().includes('Openhash Network') && p.txt().includes('체험'));
  assert.ok(!p.txt().includes('회계 원리') && !p.txt().includes('내 재무제표'));
  btn('거래 성사시키기').click(); await wait(); assert.ok(doc.getElementById('tx-err').textContent.includes('판매자'));
  type('tx-seller', '철수상회'); type('tx-what', '무선 청소기'); type('tx-price', '90000'); type('tx-qty', '2'); type('tx-why', '재택 근무용');
  btn('거래 성사시키기').click(); await wait(400);
  assert.ok(doc.getElementById('tx-hops').children.length === 7); assert.ok(p.txt().includes('MK-') && p.txt().includes('구매자 장부') && p.txt().includes('판매자 장부'));
  assert.ok(doc.getElementById('tx-led-b').textContent.includes('부가세대급금') && doc.getElementById('tx-led-s').textContent.includes('부가세예수금'));
  btn('일련번호로 확인').click(); await wait(300); assert.ok(doc.getElementById('tx-trace-ok').textContent.includes('모두 맞아요'));
  btn('장부를 몰래 고친다면?').click(); await wait(300); assert.ok(doc.getElementById('tx-tam-out').textContent.includes('드러나요'));
  assert.ok(doc.getElementById('tx-led-b').textContent.includes('180,000'));                                       // 실제 장부는 그대로
  const s = JSON.parse(p.w.localStorage.getItem('navi-tax-v2')); assert.equal(s.rec.length, 1);
  p.N.mount(doc.getElementById('m')); assert.ok(p.txt().includes('MK-'));                                            // 다시 열어도 남아 있다
  btn('일련번호로 확인').click(); await wait(300); assert.ok(doc.getElementById('tx-trace-ok').textContent.includes('모두 맞아요'));   // 저장된 공개키로도 확인된다
  btn('체험 기록 지우기').click(); btn('정말 지울까요').click(); assert.ok(!p.txt().includes('MK-')); assert.equal(p.fetched(), 0);
});
test('이름 "세무 회계" + desktop.html 연결 + 경로 + 범위 css + SP', () => {
  assert.ok(d.includes('data-label="세무 회계"') && d.includes("['ktax','세무 회계']") && !d.includes("['ktax','세무']") && !d.includes('data-label="세무"'));
  assert.ok(d.includes("go.indexOf('tax:') === 0") && d.includes("if (name === 'tax') _taxShow();") && d.includes('id="tab-tax"') && d.includes("'거래 전표>tax:main'"));
  assert.ok(paths.includes('"tax-app.js"') && paths.includes('"tax.css"')); assert.ok(css.includes('.tx ') && css.includes('.tx-tl'));
  assert.ok(sp.includes('"n": "세무 회계"') && sp.includes('국세청 AI') && sp.includes('일련번호') && sp.includes('Openhash'));
});
