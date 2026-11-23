import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../plan-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../plan.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
const sp = readFileSync(new URL('../infra-sp.js', import.meta.url), 'utf8');
function page(view) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  w.eval(app); const doc = w.document, asks = [];
  w.NaviPlan.on('ask', (t) => asks.push(t)); w.NaviPlan.mount(doc.getElementById('m'), { view });
  const txt = () => doc.getElementById('pl-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, txt, btn, fetched: () => fetched, N: w.NaviPlan };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const pick = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('change', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviPlan; };
const J = (x) => JSON.parse(JSON.stringify(x));
const ahead = (months) => { const t = new Date(Date.now() + 9 * 3600e3); t.setUTCMonth(t.getUTCMonth() + months); return t.toISOString().slice(0, 10); };
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

test('monthsLeft: 남은 온전한 개월 수, 잘못된 날짜는 null', { skip }, () => {
  const N = api(); assert.equal(N.monthsLeft('2036-11-23', '2026-11-23'), 120); assert.equal(N.monthsLeft('2027-01-10', '2026-11-23'), 1); assert.equal(N.monthsLeft('2026-10-23', '2026-11-23'), -1);
  assert.equal(N.monthsLeft('2026-02-30', '2026-11-23'), null); assert.equal(N.monthsLeft('내일', '2026-11-23'), null);
});

test('quantFeasibility: 필요 속도 대 과거 속도로 확률을 낸다', { skip }, () => {
  const N = api(); const base = { target: 600, current: 100, deadline: '2027-09-23', today: '2026-11-23' };
  const ok = J(N.quantFeasibility({ ...base, hist: [60, 60, 60, 60] })); assert.equal(ok.p, 0.99); assert.equal(ok.verdict, '달성 가능'); assert.equal(ok.req, 50); assert.equal(ok.months, 10);
  const hard = J(N.quantFeasibility({ ...base, hist: [30, 50, 40, 60] })); assert.ok(hard.p < 0.4); assert.equal(hard.verdict, '어려움');
  assert.equal(J(N.quantFeasibility({ ...base, hist: [60, 60] })).p, null); assert.equal(N.quantFeasibility({ ...base, hist: [60, 60] }).verdict, '판단 보류');
  assert.equal(N.quantFeasibility({ ...base, current: 700, hist: [] }).verdict, '달성'); assert.equal(N.quantFeasibility({ ...base, deadline: '2026-10-01', hist: [1, 2, 3] }).p, 0);
  assert.equal(N.quantFeasibility({ ...base, target: 0, hist: [1, 2, 3] }), null); assert.equal(N.quantFeasibility({ ...base, deadline: 'x', hist: [1, 2, 3] }), null);
});

const st = (o) => ({ id: 'x', name: 's', months: 12, p: 50, retry: false, done: false, ...o });
test('stageFeasibility: 기간 부족은 0, 여유 기간은 재도전에 쓰인다', { skip }, () => {
  const N = api(); const a = st({ id: 'a', name: '입시', months: 12, p: 50, retry: true }), b = st({ id: 'b', name: '과정', months: 36, p: 90 });
  const r = J(N.stageFeasibility([a, b], 120, 20)); assert.equal(r.need, 59); assert.equal(r.slack, 61); assert.equal(r.plan[0].attempts, 5); assert.ok(Math.abs(r.p - 0.871875) < 1e-9); assert.equal(r.verdict, '달성 가능');
  assert.equal(J(N.stageFeasibility([{ ...a, retry: false }, b], 60, 20)).p, 0.45); assert.equal(N.stageFeasibility([{ ...a, retry: false }, b], 60, 20).verdict, '빠듯함');
  const sh = J(N.stageFeasibility([a, b], 50, 20)); assert.equal(sh.p, 0); assert.equal(sh.short, 9); assert.equal(sh.verdict, '어려움');
  assert.equal(J(N.stageFeasibility([{ ...a, done: true }, { ...b, done: true }], 10, 20)).verdict, '달성'); assert.equal(N.stageFeasibility([], 10, 20), null); assert.equal(N.stageFeasibility([st({ p: 100 })], 10, 20), null); assert.equal(N.stageFeasibility([a], 10, 200), null);
});

test('stageSchedule·actionRate·parseHist', { skip }, () => {
  const N = api(); const s = J(N.stageSchedule([st({ name: '입시', months: 12 }), st({ name: '과정', months: 36 })], '2026-11', 20));
  assert.deepEqual(s.map((x) => [x.start, x.end]), [['2026-11', '2028-02'], ['2028-02', '2031-10']]); assert.equal(N.stageSchedule([], '2026/11', 20), null);
  assert.deepEqual(J(N.actionRate([{ planned: 10, done: 8 }, { planned: 10, done: 4 }], 3)), { planned: 20, done: 12, rate: 60, n: 2 }); assert.equal(N.actionRate([], 3), null);
  assert.deepEqual([...N.parseHist('100, 200\n-50 300.5')], [100, 200, -50, 300.5]); assert.equal(N.parseHist(''), null); assert.equal(N.parseHist('가'), null);
});

test('화면: 다섯 탭, 안내문, 외부 전송 없음', { skip }, () => {
  const p = page('home'); assert.equal(p.doc.querySelectorAll('.tab').length, 5); assert.match(p.doc.getElementById('pl-note').textContent, /보장하지 않아요/);
  ['judge', 'actions', 'track', 'theory'].forEach((v) => { p.N.view(v); assert.ok(p.txt().length > 20, v); }); assert.equal(p.fetched(), 0);
});

test('수치 목표 전체 흐름: 만들기 → 판단 → 실행 계획 → 점검(확률 재평가)', { skip }, () => {
  const p = page('home'); p.btn('목표 만들기').click(); assert.match(p.txt(), /5자 이상/);
  type(p, 'pl-g-title', '30평대 아파트 마련'); type(p, 'pl-g-why', '가족이 살 집이 필요해요'); type(p, 'pl-g-deadline', ahead(10)); type(p, 'pl-g-unit', '원'); type(p, 'pl-g-target', '600000000'); type(p, 'pl-g-current', '100000000');
  p.btn('목표 만들기').click(); assert.match(p.txt(), /목표를 만들었어요/);
  p.N.view('actions'); assert.ok(p.doc.getElementById('pl-a-hold'));
  p.N.view('judge'); assert.ok(p.doc.getElementById('pl-j-none') === null); assert.equal(p.doc.getElementById('pl-j-p').textContent, '—');
  type(p, 'pl-e-hist', '30000000, 50000000, 40000000, 60000000'); assert.equal(p.doc.getElementById('pl-j-v').textContent, '어려움');
  p.N.view('actions'); assert.ok(p.doc.getElementById('pl-a-hard')); p.N.view('judge');
  type(p, 'pl-e-hist', '60000000, 60000000, 60000000'); assert.equal(p.doc.getElementById('pl-j-v').textContent, '달성 가능'); assert.equal(p.doc.getElementById('pl-j-p').textContent, '99%');
  p.N.view('actions'); type(p, 'pl-a-if', '월급날 저녁이면'); type(p, 'pl-a-then', '자동이체로 적금에 넣는다'); type(p, 'pl-a-times', '1'); p.btn('실천 항목 추가').click(); assert.match(p.txt(), /월급날 저녁이면/);
  p.N.view('track'); type(p, 'pl-c-ym', today().slice(0, 7)); type(p, 'pl-c-value', '55000000'); type(p, 'pl-c-planned', '4'); type(p, 'pl-c-done', '3'); p.btn('점검 저장').click();
  assert.match(p.doc.getElementById('pl-c-msg').textContent, /다시 계산/); assert.equal(p.doc.getElementById('pl-c-rate').textContent, '75%');
  const saved = JSON.parse(p.w.localStorage.getItem('navi-plan-v1')).goals[0]; assert.equal(saved.current, 155000000); assert.equal(saved.checks.length, 1); assert.ok(saved.checks[0].prob > 0);
  type(p, 'pl-c-value', '1'); type(p, 'pl-c-planned', '4'); type(p, 'pl-c-done', '9'); p.btn('점검 저장').click(); assert.match(p.txt(), /계획 이하/);
});

test('단계 목표: 단계를 적으면 확률이 나오고 완료 표시로 다시 계산된다', { skip }, () => {
  const p = page('home'); pick(p, 'pl-g-kind', '단계 목표');
  type(p, 'pl-g-title', '10년 안에 변호사 자격 취득'); type(p, 'pl-g-why', '법률 전문가가 되고 싶어요'); type(p, 'pl-g-deadline', ahead(120)); p.btn('목표 만들기').click();
  p.N.view('judge'); assert.ok(p.doc.getElementById('pl-j-none'));
  type(p, 'pl-s-name', '로스쿨 입학'); type(p, 'pl-s-months', '24'); type(p, 'pl-s-p', '40'); p.btn('단계 추가').click();
  type(p, 'pl-s-name', '변호사시험'); type(p, 'pl-s-months', '60'); type(p, 'pl-s-p', '60'); p.btn('단계 추가').click(); assert.match(p.doc.getElementById('pl-j-p').textContent, /%$/);
  const before = parseInt(p.doc.getElementById('pl-j-p').textContent); [...p.doc.querySelectorAll('button')].find((b) => b.textContent.startsWith('완료로 표시')).click();
  assert.ok(parseInt(p.doc.getElementById('pl-j-p').textContent) >= before);
  type(p, 'pl-s-months', '0'); type(p, 'pl-s-name', 'x'); type(p, 'pl-s-p', '100'); p.btn('단계 추가').click(); assert.match(p.txt(), /1~99 사이/);
});

test('계획 AI에게 묻기는 대화창에 채우기만 한다', { skip }, () => { const p = page('home'); p.btn('계획 AI에게 묻기').click(); assert.equal(p.asks.length, 1); });

test('연결: desktop.html·paths·SP·CSS', () => {
  assert.match(d, /tab-btn-plan/); assert.match(d, /plan-root-host/); assert.match(d, /plan: 'kplan'/); assert.match(d, /_planOpen/); assert.match(d, /plan-app\.js\?v=/);
  assert.match(paths, /plan-app\.js/); assert.match(paths, /plan\.css/); assert.match(sp, /"scr": "계획 화면"/); assert.match(css, /\.pln/); assert.ok(!/\.sch\b/.test(css));
});
