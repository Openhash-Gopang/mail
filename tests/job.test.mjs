import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../job-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../job.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
const sp = readFileSync(new URL('../infra-sp.js', import.meta.url), 'utf8');
function page(view) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  w.eval(app); const doc = w.document, asks = [];
  w.NaviJob.on('ask', (t) => asks.push(t)); w.NaviJob.mount(doc.getElementById('m'), { view });
  const txt = () => doc.getElementById('jb-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, txt, btn, fetched: () => fetched, N: w.NaviJob };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const pick = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('change', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviJob; };
const J = (x) => JSON.parse(JSON.stringify(x));
const items = [{ name: '노인 돌봄', sector: '돌봄', qty: 1000000, hpu: 10, auto: 0 }, { name: '건물 보수', sector: '건설', qty: 500000, hpu: 20, auto: 50 }, { name: '결제 처리', sector: '금융', qty: 100, hpu: 1, auto: 100 }];

test('humanHours: 수요 × 단위당 시간 × (1 − 대체 비율), 전부 대체되는 분야는 빠진다', { skip }, () => {
  const N = api(); const r = J(N.humanHours(items)); assert.equal(r.total, 15000000); assert.deepEqual(r.rows.map((x) => x.sector), ['돌봄', '건설']); assert.ok(Math.abs(r.rows[0].share - 2 / 3) < 1e-9);
  assert.equal(N.humanHours([]), null); assert.equal(N.humanHours([{ ...items[0], auto: 101 }]), null); assert.equal(N.humanHours([{ ...items[0], qty: 0 }]), null); assert.equal(N.humanHours([{ ...items[0], sector: '' }]), null);
  assert.deepEqual(J(N.humanHours([{ ...items[2] }])), { total: 0, rows: [] });
});

test('supplyOf·balance: 실직자·의무 대상·필요 인원과 균형 판정', { skip }, () => {
  const N = api(); const s = J(N.supplyOf({ employed: '28,000,000', rate: '50', share65: '80', weekly: '20', weeks: '48' })); assert.deepEqual(s, { unemployed: 14000000, eligible: 11200000, perYear: 960, hours: 11200000 * 960 });
  assert.equal(N.supplyOf({ employed: '1', rate: '101', share65: '80', weekly: '20', weeks: '48' }), null); assert.equal(N.supplyOf({ employed: '1000', rate: '50', share65: '80', weekly: '0', weeks: '48' }), null); assert.equal(N.supplyOf({ employed: '1000', rate: '50', share65: '80', weekly: '20', weeks: '53' }), null);
  const sup = { eligible: 15625, perYear: 960 }; assert.equal(N.balance(15000000, sup).verdict, '균형'); assert.equal(N.balance(15000000, { eligible: 10000, perYear: 960 }).verdict, '인력 부족'); assert.equal(N.balance(15000000, { eligible: 30000, perYear: 960 }).verdict, '인력 여유');
  assert.equal(N.balance(15000000, { eligible: 10000, perYear: 960 }).gap, 5625); assert.equal(N.balance(0, sup).verdict, '수요 없음'); assert.equal(N.balance(-1, sup), null);
});

test('allocate: 합이 정확히 맞게 비중대로 나눈다', { skip }, () => {
  const N = api(); const rows = J(N.humanHours(items)).rows; const a = J(N.allocate(rows, 10)); assert.deepEqual(a.map((x) => x.persons), [7, 3]); assert.equal(J(N.allocate(rows, 0)).every((x) => x.persons === 0), true);
  const t = J(N.allocate([{ sector: 'a', share: 1 / 3 }, { sector: 'b', share: 1 / 3 }, { sector: 'c', share: 1 / 3 }], 100)); assert.equal(t.reduce((s, x) => s + x.persons, 0), 100); assert.equal(N.allocate(rows, 1.5), null); assert.equal(N.allocate([], 3), null);
});

test('overlap: 희망 비중(합 100)과 수요 비중이 겹치는 정도', { skip }, () => {
  const N = api(); const rows = J(N.humanHours(items)).rows; const o = J(N.overlap(rows, { 돌봄: '50', 건설: '50' })); assert.ok(Math.abs(o.overlap - 5 / 6) < 1e-9); assert.ok(o.rows[1].diff > 0.16);
  assert.ok(Math.abs(J(N.overlap(rows, { 돌봄: '66.67', 건설: '33.33' })).overlap - 1) < 0.01); assert.equal(N.overlap(rows, { 돌봄: '50', 건설: '40' }), null); assert.equal(N.overlap(rows, { 돌봄: '50' }), null); assert.equal(N.overlap(rows, { 돌봄: '120', 건설: '-20' }), null);
});

test('matchPerson: 적성 40% + 희망 30% + 사회적 필요 30%', { skip }, () => {
  const N = api(); const rows = J(N.humanHours(items)).rows; const r = J(N.matchPerson(rows, { 돌봄: '50', 건설: '50' }, { apt: { 돌봄: 3, 건설: 5 }, pref: { 돌봄: 2, 건설: 3 } }));
  assert.equal(r[0].sector, '건설'); assert.ok(Math.abs(r[0].score - 0.78) < 1e-9); assert.ok(Math.abs(r[1].score - 0.66) < 1e-9);
  assert.equal(N.matchPerson(rows, {}, { apt: { 돌봄: 3 }, pref: { 돌봄: 2, 건설: 3 } }), null); assert.equal(N.matchPerson(rows, {}, { apt: { 돌봄: 6, 건설: 1 }, pref: { 돌봄: 2, 건설: 3 } }), null);
  const nopref = J(N.matchPerson(rows, {}, { apt: { 돌봄: 0, 건설: 0 }, pref: { 돌봄: 0, 건설: 0 } })); assert.equal(nopref[0].need, 1);
});

test('rampPlan: 실직이 직선으로 늘고 배치는 필요 인원까지, 나머지는 대기', { skip }, () => {
  const N = api(); const r = J(N.rampPlan({ employed: '1000000', rate: '50', share65: '80', startYear: '2027', ramp: '5', need: 100000, wage: '1000000' }));
  assert.equal(r.length, 5); assert.deepEqual([r[0].year, r[0].unemployed, r[0].eligible, r[0].placed, r[0].waiting], [2027, 100000, 80000, 80000, 0]); assert.deepEqual([r[4].year, r[4].eligible, r[4].placed, r[4].waiting, r[4].cost], [2031, 400000, 100000, 300000, 4.8e12]);
  assert.equal(J(N.rampPlan({ employed: '1000000', rate: '50', share65: '80', startYear: '2027', ramp: '5', need: 100000, wage: '' }))[0].cost, null);
  assert.equal(N.rampPlan({ employed: '1000000', rate: '50', share65: '80', startYear: '1999', ramp: '5', need: 1 }), null); assert.equal(N.rampPlan({ employed: '1000000', rate: '50', share65: '80', startYear: '2027', ramp: '31', need: 1 }), null);
});

test('화면: 다섯 탭, 안내문, 외부 전송 없음', { skip }, () => {
  const p = page('me'); assert.equal(p.doc.querySelectorAll('.tab').length, 5); assert.match(p.doc.getElementById('jb-note').textContent, /예측이나 정책 결정이 아니에요/);
  ['demand', 'alloc', 'plan', 'principle'].forEach((v) => { p.N.view(v); assert.ok(p.txt().length > 20, v); }); assert.match(p.txt(), /헌법 제32조/); assert.equal(p.fetched(), 0);
});

test('전체 흐름: 수요 → 인력 할당(균형·겹침) → 배치 일정 → 내 일자리 순서', { skip }, () => {
  const p = page('demand'); p.btn('품목 추가').click(); assert.match(p.txt(), /품목 이름을 적어/);
  for (const x of items.slice(0, 2)) { type(p, 'jb-i-name', x.name); type(p, 'jb-i-sector', x.sector); type(p, 'jb-i-qty', String(x.qty)); type(p, 'jb-i-hpu', String(x.hpu)); type(p, 'jb-i-auto', String(x.auto)); p.btn('품목 추가').click(); }
  assert.equal(p.doc.getElementById('jb-d-total').textContent, '15,000,000시간/년');
  p.N.view('alloc'); assert.ok(p.doc.getElementById('jb-a-nos')); type(p, 'jb-s-employed', '31250'); type(p, 'jb-s-rate', '50'); type(p, 'jb-s-share65', '100'); type(p, 'jb-s-weekly', '20'); type(p, 'jb-s-weeks', '48');
  assert.equal(p.doc.getElementById('jb-a-v').textContent, '균형'); assert.equal(p.doc.getElementById('jb-a-need').textContent, '15,625명'); assert.ok(p.doc.getElementById('jb-ov-none'));
  type(p, 'jb-p-돌봄', '50'); type(p, 'jb-p-건설', '50'); assert.equal(p.doc.getElementById('jb-ov').textContent, '83.3%');
  p.N.view('plan'); assert.ok(p.doc.getElementById('jb-p-bad')); type(p, 'jb-s-startYear', '2027'); type(p, 'jb-s-ramp', '5'); type(p, 'jb-s-wage', '1000000'); assert.match(p.doc.getElementById('jb-p-sum').textContent, /2031년에 의무 대상 15,625명 중 15,625명을 배치하고 0명은/);
  p.N.view('me'); assert.ok(p.doc.getElementById('jb-m-none')); pick(p, 'jb-m-apt-돌봄', '3'); pick(p, 'jb-m-apt-건설', '5'); pick(p, 'jb-m-pref-돌봄', '2'); pick(p, 'jb-m-pref-건설', '3'); assert.match(p.doc.getElementById('jb-m-top').textContent, /1순위는 건설/);
  const s = JSON.parse(p.w.localStorage.getItem('navi-job-v1')); assert.equal(s.items.length, 2); assert.equal(s.as.employed, '31250'); assert.equal(p.fetched(), 0);
});

test('직업 AI에게 묻기는 대화창에 채우기만 한다', { skip }, () => { const p = page('principle'); p.btn('직업 AI에게 묻기').click(); assert.equal(p.asks.length, 1); });

test('연결: desktop.html·paths·SP·CSS', () => {
  assert.match(d, /tab-btn-job/); assert.match(d, /job-root-host/); assert.match(d, /job: 'kjob'/); assert.match(d, /_jobOpen/); assert.match(d, /job-app\.js\?v=/);
  assert.match(paths, /job-app\.js/); assert.match(paths, /job\.css/); assert.match(sp, /"scr": "일자리 화면"/); assert.match(css, /\.job/); assert.ok(!/\.sch\b/.test(css));
});
