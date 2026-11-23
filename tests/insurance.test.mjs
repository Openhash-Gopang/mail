import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../insurance-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../insurance.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');

function page(view) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  w.eval(app); const doc = w.document, asks = [];
  w.NaviInsure.on('ask', (t) => asks.push(t)); w.NaviInsure.mount(doc.getElementById('m'), { view });
  const txt = () => doc.getElementById('ins-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, txt, btn, fetched: () => fetched, N: w.NaviInsure };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviInsure; };

test('rateCalc: 총액 = 보험금 + 운영비, 내 보험료 = 평균 × 위험도, 기존 방식 비교', { skip }, () => {
  const N = api();
  const R = N.rateCalc({ n: '1000', claims: '1000000000', op: '5', risk: '0.8', cmp: '' });
  assert.equal(R.total, 1050000000); assert.equal(R.opCost, 50000000); assert.equal(R.avg, 1050000); assert.ok(Math.abs(R.mine - 840000) < 1e-6); assert.ok(Math.abs(R.monthly - 70000) < 1e-6);
  const C = N.rateCalc({ n: '1000', claims: '1000000000', op: '5', risk: '1', cmp: '30' });
  assert.ok(Math.abs(C.old - 1000000 / 0.7) < 1e-6); assert.ok(C.diff > 0);
  assert.equal(N.rateCalc({ n: '0', claims: '1', op: '5', risk: '1' }), null);
  assert.equal(N.rateCalc({ n: '10', claims: '1', op: '101', risk: '1' }), null);
  assert.equal(N.rateCalc({ n: '10', claims: '1', op: '5', risk: '0' }), null);
  assert.equal(N.rateCalc({ n: '10', claims: '1', op: '5', risk: '1', cmp: '95' }), null);
});

test('share: 각자 보험료의 합은 총액과 같다', { skip }, () => {
  const N = api(); const s = N.share([0.5, 1, 1.5], 3000);
  assert.deepEqual(s.map((x) => Math.round(x)), [500, 1000, 1500]); assert.ok(Math.abs(s.reduce((a, b) => a + b, 0) - 3000) < 1e-9);
  assert.equal(N.share([0, 0], 10), null);
});

test('insSummary·claimSummary', { skip }, () => {
  const N = api();
  const m = N.insSummary([{ kind: '생명', prem: 30000, end: '2026-12-01' }, { kind: '의료', prem: 20000, end: '' }], '2026-11-23');
  assert.equal(m.count, 2); assert.equal(m.monthly, 50000); assert.equal(m.yearly, 600000); assert.deepEqual([...m.missing], ['재난', '상해']); assert.equal(m.soon.length, 1);
  const c = N.claimSummary([{ amt: 100, paid: 80, state: '지급 완료' }, { amt: 50, paid: null, state: '접수' }, { amt: 10, paid: null, state: '지급 완료' }]);
  assert.equal(c.asked, 160); assert.equal(c.paid, 90); assert.equal(c.open, 1);
});

test('내 보험: 검증, 기록, 합계, 보장 종류 안내, 삭제', { skip }, () => {
  const p = page('mine');
  p.btn('기록하기').click(); assert.match(p.txt(), /보험 이름을 적어/);
  type(p, 'ins-name', '○○ 실손'); type(p, 'ins-prem', '45000'); p.doc.getElementById('ins-kind').value = '의료'; p.doc.getElementById('ins-kind').dispatchEvent(new p.w.Event('change'));
  p.btn('기록하기').click();
  assert.match(p.txt(), /○○ 실손/); assert.equal(p.doc.getElementById('ins-t1').textContent, '45,000원'); assert.match(p.doc.getElementById('ins-gap').textContent, /생명/);
  assert.equal(JSON.parse(p.w.localStorage.getItem('navi-insure-v1')).ins.length, 1);
  p.btn('삭제').click(); assert.match(p.txt(), /아직 기록한 보험이 없어요/);
});

test('요율 원리: 설계 원칙 문구, 설계 단계 표시, 계산 결과', { skip }, () => {
  const p = page('rate'); const t = p.txt();
  for (const re of [/24시간/, /365일/, /사람 직원/, /인프라 AI/, /익명/, /최소 운영비/, /설계 원칙/]) assert.match(t, re);
  type(p, 'ins-r-c', '1000000000'); type(p, 'ins-r-n', '1000'); type(p, 'ins-r-k', '1');
  assert.equal(p.doc.getElementById('ins-r-mine').textContent, '1,050,000원');
  type(p, 'ins-r-cmp', '30'); assert.match(p.doc.getElementById('ins-r-vs').textContent, /적게/);
  assert.equal(p.fetched(), 0);
});

test('상품과 공개 데이터: 6개 상품, 항목 선택 저장·해제', { skip }, () => {
  const p = page('data'); const t = p.txt();
  for (const k of ['생명', '재난', '상해', '교육', '의료', '해상']) assert.match(t, new RegExp(k + '보험'));
  assert.match(t, /전송되지 않/);
  const cb = p.doc.getElementById('ins-sh-생명-0'); cb.checked = true; cb.dispatchEvent(new p.w.Event('change'));
  assert.match(p.doc.getElementById('ins-d-n').textContent, /1개/); assert.ok(JSON.parse(p.w.localStorage.getItem('navi-insure-v1')).share['생명']['0']);
  p.btn('모두 해제').click(); assert.match(p.doc.getElementById('ins-d-n').textContent, /0개/);
});

test('청구 기록: 검증, 기록, 합계', { skip }, () => {
  const p = page('claims');
  p.btn('기록하기').click(); assert.match(p.txt(), /청구 금액/);
  type(p, 'ins-ca', '350000'); type(p, 'ins-cp', '300000'); p.doc.getElementById('ins-cs').value = '지급 완료'; p.doc.getElementById('ins-cs').dispatchEvent(new p.w.Event('change'));
  p.btn('기록하기').click();
  assert.equal(p.doc.getElementById('ins-c0').textContent, '1건'); assert.equal(p.doc.getElementById('ins-c3').textContent, '300,000원');
  p.btn('삭제').click(); assert.match(p.txt(), /아직 청구 기록이 없어요/);
});

test('탭 이동·점검표·용어', { skip }, () => {
  const p = page('mine');
  for (const v of ['mine', 'rate', 'data', 'claims', 'learn']) { p.N.view(v); assert.ok(p.txt().length > 20, v); }
  assert.equal(p.doc.querySelectorAll('.tab').length, 5);
  const c = p.doc.getElementById('ins-chk-0'); c.checked = true; c.dispatchEvent(new p.w.Event('change'));
  assert.ok(JSON.parse(p.w.localStorage.getItem('navi-insure-v1')).checks['0']);
  type(p, 'ins-gq', '면책'); assert.match(p.doc.getElementById('ins-gl').textContent, /약관/);
  p.btn('보험 AI에게 묻기').click(); assert.equal(p.asks.length, 1);
});

test('CSS는 .ins 아래로 한정, 네트워크 호출 없음', () => {
  const sel = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').split('}').map((x) => x.split('{')[0].trim()).filter((x) => x && !x.startsWith('@') && !/^\d+%|^from|^to/.test(x));
  assert.deepEqual(sel.filter((x) => x.split(',').some((y) => !/\.ins\b/.test(y))).slice(0, 5), []);
  assert.doesNotMatch(app, /fetch\(|XMLHttpRequest|sendBeacon/);
});

test('desktop.html: 보험은 전용 화면, 메일·법률은 기존 페이지로 연결', () => {
  assert.match(d, /tab-btn-insure/); assert.match(d, /insure-root/); assert.match(d, /_insureOpen/); assert.match(d, /key === 'kinsurance' && !_insureChat/);
  assert.match(d, /insurance-app\.js/); assert.match(d, /insurance\.css/); assert.match(d, /insure:mine/);
  assert.match(d, /if \(key === 'kmail'\) \{ _infraVia = key; _switchTab\('mail'\); return; \}/);
  assert.match(d, /if \(key === 'klaw'\) \{ _infraVia = key; _switchTab\('verdict'\); return; \}/);
  assert.match(paths, /"insurance-app\.js"/); assert.match(paths, /"insurance\.css"/);
});
