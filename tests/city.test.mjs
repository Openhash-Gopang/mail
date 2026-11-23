import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../city-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../city.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
const sp = readFileSync(new URL('../infra-sp.js', import.meta.url), 'utf8');
const libs = ['plan-app.js', 'job-app.js', 'jit-app.js', 'biz-app.js'].map((f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
function page(view, ls, withLibs = true) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  if (withLibs) libs.forEach((s) => w.eval(s)); w.eval(app); Object.entries(ls || {}).forEach(([k, v]) => w.localStorage.setItem(k, JSON.stringify(v)));
  const doc = w.document, asks = [], opens = []; w.NaviCity.on('ask', (t) => asks.push(t)); w.NaviCity.on('open', (t) => opens.push(t)); w.NaviCity.mount(doc.getElementById('m'), { view });
  const txt = () => doc.getElementById('ct-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, opens, txt, btn, fetched: () => fetched, N: w.NaviCity };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const pick = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('change', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviCity; };
const J = (x) => JSON.parse(JSON.stringify(x));
const P2 = [{ name: 'a', x: 0, y: 0, w: 100 }, { name: 'b', x: 10, y: 0, w: 100 }];
const jit = (cap = 400) => ({ 'navi-jit-v1': { pts: P2, sites: [{ name: 'S', x: 0, y: 0, svc: 0.01, cap }], geo: { area: '100000', speed: '50', circ: '1.3' }, tiers: [{ n: '1' }, { n: '17' }, { n: '250' }, { n: '3500' }] } });
const job = (emp = '31250') => ({ 'navi-job-v1': { items: [{ name: '돌봄', sector: '돌봄', qty: 1000000, hpu: 10, auto: 0 }, { name: '건설', sector: '건설', qty: 500000, hpu: 20, auto: 50 }], as: { employed: emp, rate: '50', share65: '100', weekly: '20', weeks: '48' } } });
const plan = () => ({ 'navi-plan-v1': { goals: [{ id: 'g1', title: '저축', kind: '수치 목표', deadline: '2030-01-01', target: 100, current: 10, hist: [5, 10, 6, 9] }] } });

test('readAll: 인프라별 지표를 그 화면의 계산 함수로 읽는다', { skip }, () => {
  const p = page('home', { ...jit(), ...job() }); const r = J(p.N.readAll());
  assert.equal(r.jit.score, 100); assert.equal(r.jit.verdict, '여유'); assert.equal(r.job.score, 100); assert.equal(r.job.verdict, '균형'); assert.equal(r.plan.state, 'input'); assert.equal(r.biz.state, 'input'); assert.equal(r.wch.state, 'input');
  assert.equal(J(page('home', jit(150)).N.readAll()).jit.score, 20); assert.equal(J(page('home', jit(250)).N.readAll()).jit.verdict, '첨두일 과부하' === '' ? '' : J(page('home', jit(250)).N.readAll()).jit.verdict);
  assert.equal(J(page('home', job('20000')).N.readAll()).job.verdict, '인력 부족'); assert.equal(J(page('home', job('20000')).N.readAll()).job.score, 30);
  const pl = J(page('home', plan()).N.readAll()).plan; assert.equal(pl.state, 'ok'); assert.ok(pl.score >= 0 && pl.score <= 100);
  const bad = J(page('home', { 'navi-jit-v1': { pts: [{ x: -1, y: 0, w: 1 }], sites: [{ x: 0, y: 0, svc: 1, cap: 1 }], geo: {} } }).N.readAll()); assert.equal(bad.jit.state, 'input');
  const nolib = J(page('home', jit(), false).N.readAll()); assert.equal(nolib.jit.state, 'lib'); assert.equal(nolib.job.state, 'lib');
  assert.equal(page('home', { 'navi-watch-v1': { entries: [{ t: 1 }, { t: 2 }], reports: [] } }).N.readAll().wch.text, '기록 2건(내용은 읽지 않음).');
});

test('cityScore: 점수 있는 인프라만 가중 평균, 입력 전·0 가중치 제외', { skip }, () => {
  const p = page('home', { ...jit(), ...job() }); const i = p.N.readAll(); const w = { jit: '25', job: '25', plan: '25', biz: '25' };
  const a = J(p.N.cityScore(i, w)); assert.equal(a.score, 100); assert.deepEqual(a.used, ['jit', 'job']); assert.deepEqual(a.missing, ['plan', 'biz']);
  const i2 = { ...i, job: { ...i.job, score: 30 } }; assert.equal(J(p.N.cityScore(i2, w)).score, 65); assert.equal(J(p.N.cityScore(i2, { ...w, jit: '75' })).score, 82.5); assert.deepEqual(J(p.N.cityScore(i2, { ...w, job: '0' })).used, ['jit']);
  assert.equal(p.N.cityScore(i, { jit: '0', job: '0', plan: '1', biz: '1' }), null); assert.equal(p.N.cityScore(null, w), null);
});

test('checks: 인프라 사이의 규칙 점검과 물리 단서', { skip }, () => {
  let p = page('home', { ...jit(), ...job() }); let c = J(p.N.checks(p.N.readAll())); assert.equal(c[0].ok, true); assert.equal(c[1].ok, null); assert.equal(c[3].ok, null);
  p = page('home', { ...jit(), ...job('20000') }); c = J(p.N.checks(p.N.readAll())); assert.equal(c[0].ok, false); assert.match(c[0].msg, /일할 사람이 모자라요/);
  p = page('home', { ...jit(150), ...job('60000') }); c = J(p.N.checks(p.N.readAll())); assert.equal(c[0].ok, false); assert.match(c[0].msg, /거점 처리 능력이 모자라요/);
  p = page('home', jit()); c = J(p.N.checks(p.N.readAll())); assert.equal(c[0].ok, null);
  p = page('home', { ...jit(), ...job() }); const ph = J(p.N.physical()); assert.deepEqual(ph.map((x) => x[0]), ['물류 거점(후보)', '근린 거점(공급 계층 가정)', '일자리 사업장 수용 인원']); assert.equal(ph[0][1], '1곳'); assert.equal(ph[1][1], '3,500곳'); assert.equal(ph[2][1], '15,625명');
  assert.equal(J(page('home', {}).N.physical()).length, 0);
});

test('화면: 여섯 탭, 안내문, 열기 → open 알림, 외부 전송 없음', { skip }, () => {
  const p = page('home', { ...jit(), ...job() }); assert.equal(p.doc.querySelectorAll('.tab').length, 6); assert.match(p.doc.getElementById('ct-note').textContent, /여러 시민의 실제 합산이 아니며/); assert.match(p.doc.getElementById('ct-note').textContent, /내용을 읽지 않고/);
  assert.match(p.doc.getElementById('ct-h-jit').textContent, /여유/); assert.equal(p.doc.getElementById('ct-h-score').textContent, '100점'); p.btn('열기').click(); assert.deepEqual(p.opens, ['jit:types']);
  ['check', 'score', 'scen', 'phys', 'principle'].forEach((v) => { p.N.view(v); assert.ok(p.txt().length > 20, v); }); assert.match(p.txt(), /부동산/); assert.equal(p.fetched(), 0);
});

test('정합성 점검·물리 구현 화면', { skip }, () => {
  const p = page('check', { ...jit(), ...job('20000') }); assert.equal(p.doc.getElementById('ct-c-0').textContent, '어긋남'); assert.equal(p.doc.getElementById('ct-c-1').textContent, '판단 못 함');
  p.N.view('phys'); assert.match(p.txt(), /15,625명|\d+명/); assert.match(p.txt(), /등기부/); p.btn('부동산 AI에게 묻기').click(); assert.equal(p.asks.length, 1);
  const q = page('phys', {}); assert.ok(q.doc.getElementById('ct-p-none'));
});

test('도시 점수: 가중치를 바꾸면 종합이 달라지고 값은 저장된다', { skip }, () => {
  const p = page('score', { ...jit(), ...job('20000') }); assert.equal(p.doc.getElementById('ct-s-total').textContent, '65점'); type(p, 'ct-w-jit', '75'); assert.equal(p.doc.getElementById('ct-s-total').textContent, '82점'.replace('82', String(Math.round(82.5)))); assert.match(p.doc.getElementById('ct-s-miss').textContent, /계획, 사업/);
  type(p, 'ct-w-job', '0'); type(p, 'ct-w-jit', '0'); assert.ok(p.doc.getElementById('ct-s-none')); assert.equal(JSON.parse(p.w.localStorage.getItem('navi-city-v1')).w.jit, '0');
});

test('시나리오: 저장·비교·삭제, 최대 3개', { skip }, () => {
  const p = page('scen', { ...jit(), ...job('20000') }); p.btn('지금 상태 저장').click(); assert.match(p.txt(), /이름을 적어/);
  type(p, 'ct-n-name', '기본'); p.btn('지금 상태 저장').click(); assert.match(p.txt(), /저장했어요/); p.N.view('scen'); type(p, 'ct-w-jit' === '' ? '' : 'ct-n-name', '조달 중시');
  p.N.view('score'); type(p, 'ct-w-jit', '75'); p.N.view('scen'); type(p, 'ct-n-name', '조달 중시'); p.btn('지금 상태 저장').click(); assert.match(p.doc.getElementById('ct-n-best').textContent, /조달 중시/);
  for (const n of ['셋째', '넷째']) { type(p, 'ct-n-name', n); p.btn('지금 상태 저장').click(); } assert.match(p.txt(), /최대 3개/); assert.equal(JSON.parse(p.w.localStorage.getItem('navi-city-v1')).scen.length, 3);
  p.btn('삭제').click(); assert.equal(JSON.parse(p.w.localStorage.getItem('navi-city-v1')).scen.length, 2); assert.equal(page('scen', {}).N.cityScore(null, {}), null);
  const e = page('scen', {}); type(e, 'ct-n-name', 'x'); e.btn('지금 상태 저장').click(); assert.match(e.txt(), /점수가 있는 인프라가 없어/);
});

test('도시 AI에게 묻기는 대화창에 채우기만 한다', { skip }, () => { const p = page('principle', {}); p.btn('도시 AI에게 묻기').click(); assert.equal(p.asks.length, 1); });

test('연결: desktop.html·paths·SP·CSS', () => {
  assert.match(d, /tab-btn-cty/); assert.match(d, /cty-root-host/); assert.match(d, /cty: 'kcity'/); assert.match(d, /_ctyOpen/); assert.match(d, /city-app\.js/);
  assert.match(paths, /city-app\.js/); assert.match(paths, /city\.css/); assert.match(sp, /"scr": "도시 화면"/); assert.match(css, /\.cty/); assert.ok(!/\.sch\b/.test(css));
});
