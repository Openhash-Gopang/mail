import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../democracy-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../democracy.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
const sp = readFileSync(new URL('../infra-sp.js', import.meta.url), 'utf8');
function page(view) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  w.eval(app); const doc = w.document, asks = [];
  w.NaviDemocracy.on('ask', (t) => asks.push(t)); w.NaviDemocracy.mount(doc.getElementById('m'), { view });
  const txt = () => doc.getElementById('dm-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, txt, btn, fetched: () => fetched, N: w.NaviDemocracy };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviDemocracy; };
const good = { id: 'a', kind: '새 입법', title: '소송 증거 접근권 보장', law: '', problem: '대기업과의 소송에서 증거가 상대에게만 있어 입증이 사실상 불가능했습니다.', claim: '증거를 가진 쪽이 법원의 명령으로 이를 제출하도록 하는 규정을 새로 만들어야 합니다.', basis: '비슷한 제도를 둔 나라의 사례와 내가 겪은 재판 기록이 있습니다.' };

test('screenPetition: 필수 항목·개인정보·선거운동·중복·개정 법률명', { skip }, () => {
  const N = api(); assert.equal(N.screenPetition(good, []).ok, true);
  assert.ok(N.screenPetition({ ...good, title: '짧다' }, []).issues.some((s) => /제목/.test(s)));
  assert.ok(N.screenPetition({ ...good, kind: '기존 법률 개정' }, []).issues.some((s) => /법률의 이름/.test(s)));
  assert.ok(N.screenPetition({ ...good, basis: good.basis + ' 연락처 010-1234-5678' }, []).issues.some((s) => /개인정보/.test(s)));
  assert.ok(N.screenPetition({ ...good, claim: good.claim + ' 다음 선거에서 낙선시켜야 합니다.' }, []).issues.some((s) => /선거 운동/.test(s)));
  assert.ok(N.screenPetition({ ...good, id: 'b' }, [good]).issues.some((s) => /비슷한 청원/.test(s)));
  assert.equal(N.screenPetition(null, []), null);
});

test('assess: 네 항목을 모두 매겨야 하고, 평균·최저점으로 전달·보관·보류를 정한다', { skip }, () => {
  const N = api();
  assert.equal(N.assess({ valid: 4, reason: 4, clarity: 3, impact: 4 }).action, 'forward'); assert.equal(N.assess({ valid: 4, reason: 4, clarity: 4, impact: 1 }).action, 'summary');
  assert.equal(N.assess({ valid: 2, reason: 2, clarity: 3, impact: 2 }).action, 'hold'); assert.equal(N.assess({ valid: 5, reason: 5, clarity: 0, impact: 5 }), null); assert.equal(N.assess({ valid: 5, reason: 5, clarity: 4.5, impact: 5 }), null);
});

test('progress: 달성률·남은 기간·하루 필요 수, 잘못된 값은 null', { skip }, () => {
  const N = api(), r = N.progress('10000', '50000', '2026-11-13', '30', '2026-11-23');
  assert.equal(r.pct, 20); assert.equal(r.left, 40000); assert.equal(r.daysLeft, 20); assert.equal(r.perDay, 2000); assert.equal(r.status, '어려움');
  assert.equal(N.progress('50000', '50000', '2026-11-13', '30', '2026-11-23').status, '달성'); assert.equal(N.progress('1', '50000', '2026-10-01', '30', '2026-11-23').status, '기간 종료');
  assert.equal(N.progress('30000', '50000', '2026-11-13', '30', '2026-11-23').status, '가능'); assert.equal(N.progress('x', '50000', '2026-11-13', '30', '2026-11-23'), null); assert.equal(N.progress('1', '0', '2026-11-13', '30', '2026-11-23'), null); assert.equal(N.progress('1', '5', '2026-12-01', '30', '2026-11-23'), null);
});

test('화면: 탭 6개, 청원 쓰기 → 1차 심사 → 배포 대기, 아무것도 밖으로 보내지 않는다', { skip }, () => {
  const p = page(); assert.equal(p.doc.querySelectorAll('.tab').length, 6); assert.match(p.txt(), /아직 쓴 청원이 없어요/); assert.match(p.txt(), /실제로 배포·접수하거나 동의를 모으지 않고/);
  p.N.view('write'); p.btn('초안으로 저장').click(); assert.match(p.txt(), /청원 제목을 적어 주세요/);
  type(p, 'dm-w-title', good.title); type(p, 'dm-w-problem', good.problem); type(p, 'dm-w-claim', good.claim); type(p, 'dm-w-basis', good.basis); p.btn('초안으로 저장').click();
  assert.match(p.txt(), /아무에게도 보내지 않았어요/); assert.equal(JSON.parse(p.w.localStorage.getItem('navi-democracy-v1')).petitions[0].st, '초안');
  p.N.view('screen'); p.btn('1차 심사 받기').click(); assert.equal(JSON.parse(p.w.localStorage.getItem('navi-democracy-v1')).petitions[0].st, '배포 대기'); assert.match(p.txt(), /아무에게도 보내지 않았어요/);
  p.N.view('write'); type(p, 'dm-w-title', '아주 짧은 청원입니다'); p.btn('초안으로 저장').click(); p.N.view('screen'); p.btn('1차 심사 받기').click();
  assert.match(p.txt(), /보완이 필요해요/); assert.equal(JSON.parse(p.w.localStorage.getItem('navi-democracy-v1')).petitions[0].st, '보완 필요'); assert.equal(p.fetched(), 0);
});

test('받은 청원: 평가하면 비서 의견이 나오고 동의는 내가 고른다', { skip }, () => {
  const p = page('inbox'); type(p, 'dm-r-title', '주차 규정 개선'); type(p, 'dm-r-gist', '주거지 주변 주차 규정을 바꾸자는 청원입니다.'); p.btn('적기').click();
  const id = JSON.parse(p.w.localStorage.getItem('navi-democracy-v1')).inbox[0].id; assert.match(p.txt(), /네 항목을 모두 평가하면/);
  for (const k of ['valid', 'reason', 'clarity', 'impact']) { const s = p.doc.getElementById('dm-i-' + id + k); s.value = '4'; s.dispatchEvent(new p.w.Event('change', { bubbles: true })); }
  assert.match(p.doc.getElementById('dm-i-res-' + id).textContent, /내게 전달해 판단 요청/); assert.match(p.txt(), /비서가 내 대신 동의하지 않아요/);
  const w = p.doc.getElementById('dm-i-w-' + id); w.value = '동의'; w.dispatchEvent(new p.w.Event('change', { bubbles: true })); assert.equal(JSON.parse(p.w.localStorage.getItem('navi-democracy-v1')).inbox[0].will, '동의'); assert.equal(p.fetched(), 0);
});

test('desktop.html 연결 + 경로 + 범위 css + SP', { skip }, () => {
  assert.ok(d.includes("_demOpen('mine')") && d.includes("go.indexOf('dem:') === 0") && d.includes("if (name === 'dem') _demShow();") && d.includes('id="tab-dem"') && d.includes("dem: 'kdemocracy'"));
  assert.ok(paths.includes('"democracy-app.js"') && paths.includes('"democracy.css"')); assert.ok(css.includes('.dem ') && !css.includes('.lgs'));
  assert.ok(sp.includes('"scr": "민주주의 화면"'));
});
