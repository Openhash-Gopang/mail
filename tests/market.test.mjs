import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../market-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../market.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
function page(view) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  w.eval(app); const doc = w.document, asks = [];
  w.NaviMarket.on('ask', (t) => asks.push(t)); w.NaviMarket.mount(doc.getElementById('m'), { view });
  const txt = () => doc.getElementById('mk-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, txt, btn, fetched: () => fetched, N: w.NaviMarket };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviMarket; };

test('fairPrice: 중앙값 대비 편차, 3개 미만은 null', { skip }, () => {
  const N = api(); const r = N.fairPrice(['95000', '100000', '105000'], '150000', '30');
  assert.equal(r.median, 100000); assert.equal(r.out, true); assert.equal(r.side, 'high'); assert.equal(N.fairPrice(['95000', '100000', '105000'], '110000', '30').out, false);
  assert.equal(N.fairPrice(['1', '2'], '1', '30'), null); assert.equal(N.fairPrice(['1', '2', '3'], '', '30'), null);
});

test('qualityRate · satisfaction', { skip }, () => {
  const N = api(); assert.equal(N.qualityRate('10', '8').rate, 0.8); assert.equal(N.qualityRate('10', '11'), null); assert.equal(N.qualityRate('4', '4').all, true);
  const s = N.satisfaction(['5', '4', '3', '4']); assert.equal(s.avg, 4); assert.equal(s.hi, 0.75); assert.equal(N.satisfaction(['6']), null); assert.equal(N.satisfaction([]), null);
});

test('needCheck: 사유 개수로 단계', { skip }, () => {
  const N = api(); assert.equal(N.needCheck({ owned: 'no', uses: 'often', plan: 'plan', alt: 'no' }).level, 'ok');
  assert.equal(N.needCheck({ owned: 'ok', uses: 'often', plan: 'plan', alt: 'no' }).level, 'think');
  const r = N.needCheck({ price: '100000', budget: '50000', owned: 'ok', uses: 'rare', plan: 'impulse', alt: 'yes' }); assert.equal(r.level, 'hold'); assert.equal(r.reasons.length, 5);
});

test('presale: 선지급·이자·잔금, 범위 밖은 null', { skip }, () => {
  const N = api(), r = N.presale('100000000', '30', '6', '60', '');
  assert.equal(r.adv, 30000000); assert.equal(r.interest, Math.round(30000000 * 0.06 * 60 / 365)); assert.equal(r.after, 100000000 - r.adv - r.interest); assert.equal(r.total, r.adv + r.after);
  assert.equal(N.presale('100000000', '30', '6', '60', '90000000').after, 90000000 - r.adv - r.interest);
  assert.equal(N.presale('100000000', '9', '6', '60', ''), null); assert.equal(N.presale('100000000', '51', '6', '60', ''), null); assert.equal(N.presale('', '30', '6', '60', ''), null);
});

test('화면: 시장 원리 · 설계 원칙, 전송 없음', { skip }, () => {
  const p = page(); assert.match(p.txt(), /공정거래위원회/); assert.match(p.txt(), /설계 원칙/); assert.match(p.txt(), /10~50%/); assert.equal(p.fetched(), 0);
});

test('화면: 상품 평가', { skip }, () => {
  const p = page('eval'); type(p, 'mk-f-refs', '95000, 100000, 105000'); type(p, 'mk-f-price', '150000'); assert.match(p.doc.getElementById('mk-f-res').textContent, /벗어났어요/);
  type(p, 'mk-q-total', '10'); type(p, 'mk-q-met', '8'); assert.match(p.doc.getElementById('mk-q-res').textContent, /80%/);
  type(p, 'mk-s-r', '5, 4, 3, 4'); assert.match(p.doc.getElementById('mk-s-res').textContent, /평균 4점/); assert.equal(p.fetched(), 0);
});

test('화면: 필요 판단', { skip }, () => {
  const p = page('need'); assert.match(p.doc.getElementById('mk-n-res').textContent, /필요한 구매/);
  const o = p.doc.getElementById('mk-n-owned'); o.value = 'ok'; o.dispatchEvent(new p.w.Event('change')); const u = p.doc.getElementById('mk-n-plan'); u.value = 'impulse'; u.dispatchEvent(new p.w.Event('change'));
  assert.match(p.doc.getElementById('mk-n-res').textContent, /자제/);
});

test('화면: 선구매 계산과 메모 저장', { skip }, () => {
  const p = page('presale'); type(p, 'mk-p-value', '100000000'); type(p, 'mk-p-annual', '6'); type(p, 'mk-p-days', '60');
  assert.match(p.doc.getElementById('mk-p-adv').textContent, /30,000,000/);
  type(p, 'mk-p-rate', '60'); assert.match(p.doc.getElementById('mk-p-out').textContent, /10~50%/);
  type(p, 'mk-p-rate', '20'); type(p, 'mk-p-item', '토지'); p.btn('내 메모에 저장').click();
  assert.equal(JSON.parse(p.w.localStorage.getItem('navi-market-v1')).list[0].adv, 20000000); assert.match(p.txt(), /토지/); assert.equal(p.fetched(), 0);
});

test('desktop.html 연결 + 이름 변경 + 경로 + 범위 css', { skip }, () => {
  assert.ok(d.includes("_mktOpen('principle')") && d.includes("go.indexOf('mkt:') === 0") && d.includes("if (name === 'mkt') _mktShow();") && d.includes('id="tab-mkt"'));
  assert.ok(d.includes("['kmarket','시장']") && !d.includes('쇼핑·거래'));
  assert.ok(paths.includes('"market-app.js"') && paths.includes('"market.css"')); assert.ok(css.includes('.mkt '));
});
