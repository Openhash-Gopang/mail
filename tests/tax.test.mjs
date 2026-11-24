import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../tax-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../tax.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
function page(view) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  w.eval(app); const doc = w.document, asks = [];
  w.NaviTax.on('ask', (t) => asks.push(t)); w.NaviTax.mount(doc.getElementById('m'), { view });
  const txt = () => doc.getElementById('tx-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, txt, btn, fetched: () => fetched, N: w.NaviTax };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviTax; };

test('matchSlips: 1원 차이도 불일치, 상대·품목·날짜도 대조', { skip }, () => {
  const N = api(), a = { me: 'A상사', other: 'B전자', item: '고무', amt: '1,000,000', d: '2026-11-23' };
  assert.equal(N.matchSlips(a, { me: 'B전자', other: 'A상사', item: '고무', amt: '1000000', d: '2026-11-23' }).ok, true);
  const r = N.matchSlips(a, { me: 'B전자', other: 'A상사', item: '고무', amt: '1000001', d: '2026-11-23' });
  assert.equal(r.ok, false); assert.match(r.issues[0], /1원/);
  assert.equal(N.matchSlips(a, { me: 'C', other: 'A상사', item: '철', amt: '1000000', d: '2026-11-24' }).issues.length, 3);
  assert.equal(N.matchSlips(a, { me: 'B전자', other: 'A상사', item: '고무', amt: 'abc', d: '2026-11-23' }), null);
});

test('chainCheck: 공급망 연쇄, 한 곳이 1원 달라도 잡는다', { skip }, () => {
  const N = api(); assert.equal(N.chainCheck([['100', '100'], ['300', '300']]).ok, true);
  const r = N.chainCheck([['100', '100'], ['300', '301']]); assert.equal(r.ok, false); assert.equal(r.links[1].diff, 1);
  assert.equal(N.chainCheck([['x', '1']]), null);
});

test('anomaly: 평소 대비 표준편차, 5개 미만은 null', { skip }, () => {
  const N = api(), base = [100, 110, 90, 105, 95];
  assert.equal(N.anomaly(base, 100, 3).abnormal, false); assert.equal(N.anomaly(base, 1000, 3).abnormal, true);
  assert.equal(N.anomaly([1, 2, 3], 5, 3), null); assert.equal(N.anomaly([5, 5, 5, 5, 5], 6, 3).abnormal, true);
});

test('statements: 대차 항상 균형, 순이익 = 수익 − 비용', { skip }, () => {
  const N = api(), e = (dr, cr, amt) => ({ dr, cr, amt });
  const T = N.statements([e('현금', '자본금', 10e6), e('현금', '매출', 1e6), e('급여', '현금', 400000)]);
  assert.equal(T.assets, 10600000); assert.equal(T.equity, 10e6); assert.equal(T.net, 600000); assert.equal(T.balanced, true);
});

test('taxCalc: 소득세 구간 누진, 법인세는 연도별 세법 버전', { skip }, () => {
  const N = api(), r = N.taxCalc('income', '2026', '60000000');
  assert.equal(r.tax, 14e6 * .06 + 36e6 * .15 + 10e6 * .24); assert.equal(r.local, Math.round(r.tax * .1)); assert.equal(r.marginal, .24);
  assert.equal(N.taxCalc('corp', '2025', '100000000').tax, 9e6); assert.equal(N.taxCalc('corp', '2026', '100000000').tax, 10e6);
  assert.equal(N.taxCalc('income', '2026', ''), null); assert.equal(N.taxCalc('income', '2020', '1000'), null);
});

test('vat: 납부와 환급', { skip }, () => {
  const N = api(); assert.equal(N.vat('1000000', '400000').pay, 60000); assert.equal(N.vat('100000', '400000').pay, -30000); assert.equal(N.vat('x', '1'), null);
});

test('화면: 회계 원리 · 설계 원칙 표시, 전송 없음', { skip }, () => {
  const p = page(); assert.match(p.txt(), /국세청 AI가 세액 결정/); assert.match(p.txt(), /거래 일련번호/); assert.match(p.txt(), /6하 원칙/); assert.match(p.txt(), /설계 원칙/); assert.equal(p.fetched(), 0);
});

test('화면: 전표 불일치와 공급망 1원 차이 경고', { skip }, () => {
  const p = page('verify'); assert.ok(p.doc.getElementById('tx-m-ok'));
  type(p, 'tx-b-amt', '1000001'); assert.ok(p.doc.getElementById('tx-m-bad'));
  type(p, 'tx-l1b', '3000001'); assert.match(p.doc.getElementById('tx-c-1').textContent, /1원/); assert.match(p.doc.getElementById('tx-c-sum').textContent, /어긋난/);
  type(p, 'tx-a-base', '100 110 90 105 95'); type(p, 'tx-a-val', '1000'); assert.match(p.doc.getElementById('tx-a-res').textContent, /이상 거래/);
  assert.equal(p.fetched(), 0);
});

test('화면: 분개 기록 → 재무제표 갱신, 저장', { skip }, () => {
  const p = page('fs'); type(p, 'tx-j-amt', '10000000'); p.btn('분개 기록').click();
  assert.match(p.doc.getElementById('tx-f0').textContent, /10,000,000/); assert.match(p.doc.getElementById('tx-f-bal').textContent, /대차가 맞아요/);
  assert.equal(JSON.parse(p.w.localStorage.getItem('navi-tax-v1')).je.length, 1);
  p.doc.getElementById('tx-j-cr').value = '현금'; p.doc.getElementById('tx-j-cr').dispatchEvent(new p.w.Event('change'));
  type(p, 'tx-j-amt', '5'); p.btn('분개 기록').click(); assert.match(p.txt(), /같을 수 없어요/);
});

test('화면: 세금 계산과 징수 원리 표시', { skip }, () => {
  const p = page('tax'); type(p, 'tx-t-base', '60000000'); assert.match(p.doc.getElementById('tx-t-tax').textContent, /8,640,000/);
  assert.match(p.doc.getElementById('tx-t-law').textContent, /공제·감면/);
  type(p, 'tx-v-s', '1000000'); type(p, 'tx-v-p', '400000'); assert.match(p.doc.getElementById('tx-v-pay').textContent, /60,000/);
  p.N.view('collect'); assert.match(p.txt(), /직접 징수/); assert.match(p.txt(), /연결되어 있지 않아요/);
});

test('desktop.html 연결 + 경로 목록 + 범위 css', { skip }, () => {
  assert.ok(d.includes("_taxOpen('acct')") && d.includes("go.indexOf('tax:') === 0") && d.includes("if (name === 'tax') _taxShow();") && d.includes('id="tab-tax"'));
  assert.ok(paths.includes('"tax-app.js"') && paths.includes('"tax.css"')); assert.ok(css.includes('.tx '));
});
