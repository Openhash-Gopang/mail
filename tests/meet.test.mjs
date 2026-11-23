import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../meet-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../meet.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
const sp = readFileSync(new URL('../infra-sp.js', import.meta.url), 'utf8');
function page(view, ls) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  w.eval(app); Object.entries(ls || {}).forEach(([k, v]) => w.localStorage.setItem(k, JSON.stringify(v)));
  const doc = w.document, asks = []; w.NaviMeet.on('ask', (t) => asks.push(t)); w.NaviMeet.mount(doc.getElementById('m'), { view });
  const txt = () => doc.getElementById('mt-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, txt, btn, fetched: () => fetched, N: w.NaviMeet };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const pick = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('change', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviMeet; };
const J = (x) => JSON.parse(JSON.stringify(x));
const near = (a, b, e = 0.01) => assert.ok(Math.abs(a - b) < e, a + ' ≈ ' + b);
const A = { name: 'A', interests: '걷기, 독서, 사진', skills: '요리', purpose: '친목', act: 5, soc: 5, plan: 3, adv: 3, age: '30', gender: '여성', show: { age: '공개' } };
const B = { name: 'B', interests: '걷기, 독서', skills: '요리, 코딩', purpose: '친목', act: 4, soc: 5, plan: 3, adv: 2 };
const C = { name: 'C', interests: '게임', skills: '디자인', purpose: '학습', act: 1, soc: 1, plan: 1, adv: 1 };

test('similarity: 취향·성향·목적·능력의 유사도, 연령·성별·가족은 쓰지 않는다', { skip }, () => {
  const N = api(); const r = J(N.similarity(A, B)); near(r.score, 79.58); near(r.parts.interests, 2 / 3, 1e-6); near(r.parts.traits, 0.875, 1e-6); assert.equal(r.parts.purpose, 1); near(r.parts.skills, 0.5, 1e-6);
  near(J(N.similarity(A, { ...B, skills: '' })).score, 82.87); assert.equal(J(N.similarity(A, { ...B, skills: '' })).parts.skills, null); near(J(N.similarity(A, A)).score, 100); near(J(N.similarity(A, C)).score, 7.5);
  near(J(N.similarity(A, { ...B, age: '70', gender: '남성', family: '자녀 있음' })).score, 79.58);
  assert.equal(N.similarity(A, { ...B, purpose: '' }), null); assert.equal(N.similarity(A, { ...B, act: 6 }), null); assert.equal(N.similarity(A, { ...B, interests: '' }), null); assert.equal(N.similarity(A, { ...B, age: '200' }), null);
});

test('recommend: 유사도 순위와 연령·성별 조건(참여 가능 여부)', { skip }, () => {
  const N = api(); const ms = [{ title: '게임 모임', purpose: '학습', tags: '게임', act: 1, soc: 1, plan: 1, adv: 1, ageMax: '25' }, { title: '걷기 모임', purpose: '친목', tags: '걷기, 사진', act: 5, soc: 4, plan: 3, adv: 3 }, { title: '남성 걷기', purpose: '친목', tags: '걷기', act: 5, soc: 5, plan: 3, adv: 3, gender: '남성' }];
  const r = J(N.recommend(A, ms)); assert.deepEqual(r.map((x) => x.title), ['걷기 모임', '남성 걷기', '게임 모임']); near(r[0].score, 84.95); assert.equal(r[0].eligible, true); assert.equal(r[1].eligible, false); assert.match(r[1].why[0], /성별 조건\(남성\)/); near(r[1].score, 74.07);
  assert.match(r[2].why[0], /연령 조건\(~25세\)/); const r2 = J(N.recommend({ ...A, age: '', gender: '' }, ms)); assert.ok(r2.find((x) => x.title === '게임 모임').why[0].includes('나이를 입력하지 않았어요')); assert.ok(r2.find((x) => x.title === '남성 걷기').why[0].includes('성별을 입력하지 않았어요'));
  assert.deepEqual(J(N.recommend(A, [{ ...ms[1], ageMin: '20', ageMax: '40', gender: '여성' }]))[0].needs, ['연령', '성별']); assert.equal(N.recommend(A, [{ ...ms[1], ageMin: '50', ageMax: '40' }]), null); assert.equal(N.recommend({ ...A, name: '' }, ms), null);
});

test('formGroup: 평균 유사도가 기준 미만인 사람부터 한 명씩 걸러 낸다', { skip }, () => {
  const N = api(); const g = J(N.formGroup([A, B, C], 60)); assert.equal(g.formed, true); assert.deepEqual(g.members.map((x) => x.name), ['A', 'B']); near(g.avg, 79.58); assert.equal(g.removed.length, 1); assert.equal(g.removed[0].name, 'C'); assert.match(g.removed[0].reason, /평균 유사도 9\.4점이 기준 60점보다 낮고/);
  assert.equal(J(N.formGroup([A, B, C], 0)).members.length, 3); const n = J(N.formGroup([A, B, C], 90)); assert.equal(n.formed, false); assert.equal(n.members.length, 0); assert.equal(n.removed.length, 3);
  assert.equal(N.formGroup([A], 60), null); assert.equal(N.formGroup([A, B], 101), null); assert.equal(N.formGroup([A, { ...B, name: 'A' }], 60), null); assert.equal(N.formGroup([A, { ...B, purpose: '' }], 60), null);
});

test('sharedView: 취향·성향은 공유, 연령·성별·가족은 공개한 것만', { skip }, () => {
  const N = api(); const v = J(N.sharedView([A, { ...B, age: '40', gender: '남성', family: '부부', show: { gender: '공개' } }])); assert.equal(v[0].age, '30세'); assert.equal(v[0].gender, '비공개'); assert.equal(v[0].family, '비공개'); assert.match(v[0].interests, /걷기/); assert.match(v[0].traits, /act5/);
  assert.equal(v[1].age, '비공개'); assert.equal(v[1].gender, '남성'); assert.equal(v[1].skills, '요리, 코딩'); assert.equal(N.sharedView([]), null); assert.equal(N.sharedView([{ ...B, act: 0 }]), null);
});

test('화면: 다섯 탭, 안내문, 외부 전송 없음', { skip }, () => {
  const p = page('me'); assert.equal(p.doc.querySelectorAll('.tab').length, 5); assert.match(p.doc.getElementById('mt-note').textContent, /연령·성별·가족은 넣지 않아요/); assert.ok(p.doc.getElementById('mt-m-none'));
  ['meet', 'group', 'share', 'principle'].forEach((v) => { p.N.view(v); assert.ok(p.txt().length > 20, v); }); assert.match(p.txt(), /점수에 넣지 않아요/); assert.equal(p.fetched(), 0);
});

test('전체 흐름: 내 프로필 → 모임 추천 → 그룹 구성 → 성향 공유', { skip }, () => {
  const p = page('me'); type(p, 'mt-m-name', 'A'); type(p, 'mt-m-interests', '걷기, 독서, 사진'); type(p, 'mt-m-skills', '요리'); pick(p, 'mt-m-purpose', '친목'); for (const [k, v] of [['act', '5'], ['soc', '5'], ['plan', '3'], ['adv', '3']]) pick(p, 'mt-m-' + k, v);
  type(p, 'mt-m-age', '30'); pick(p, 'mt-m-gender', '여성'); pick(p, 'mt-m-show-age', '공개'); assert.ok(p.doc.getElementById('mt-m-ok'));
  p.N.view('meet'); p.btn('모임 추가').click(); assert.match(p.txt(), /모임 이름을 적어/);
  type(p, 'mt-g-title', '걷기 모임'); type(p, 'mt-g-tags', '걷기, 사진'); pick(p, 'mt-g-purpose', '친목'); for (const [k, v] of [['act', '5'], ['soc', '4'], ['plan', '3'], ['adv', '3']]) pick(p, 'mt-g-' + k, v); p.btn('모임 추가').click(); assert.match(p.doc.getElementById('mt-r-top').textContent, /걷기 모임」\(85점|걷기 모임」\(84\.9|걷기 모임」\(85/);
  p.N.view('group'); assert.ok(p.doc.getElementById('mt-g-nop'));
  for (const x of [B, C]) { type(p, 'mt-p-name', x.name); type(p, 'mt-p-interests', x.interests); type(p, 'mt-p-skills', x.skills); pick(p, 'mt-p-purpose', x.purpose); for (const k of ['act', 'soc', 'plan', 'adv']) pick(p, 'mt-p-' + k, String(x[k])); p.btn('후보 추가').click(); }
  assert.equal(p.doc.getElementById('mt-g-n').textContent, '2명'); assert.equal(p.doc.getElementById('mt-g-rm').textContent, '1명'); assert.match(p.txt(), /평균 유사도 9\.4점이 기준 60점보다 낮고/);
  type(p, 'mt-t', '0'); assert.equal(p.doc.getElementById('mt-g-n').textContent, '3명'); type(p, 'mt-t', '90'); assert.ok(p.doc.getElementById('mt-g-none')); type(p, 'mt-t', '60');
  type(p, 'mt-p-name', 'B'); p.btn('후보 추가').click(); assert.match(p.txt(), /같은 이름이 이미 있어요/);
  p.N.view('share'); assert.match(p.txt(), /30세/); assert.match(p.txt(), /비공개/); assert.ok(p.doc.getElementById('mt-s-sum'));
  const s = JSON.parse(p.w.localStorage.getItem('navi-meet-v1')); assert.equal(s.people.length, 2); assert.equal(s.meets.length, 1); assert.equal(s.me.show.age, '공개'); assert.equal(s.thr, '60'); assert.equal(p.fetched(), 0);
});

test('모임 AI에게 묻기는 대화창에 채우기만 한다', { skip }, () => { const p = page('principle'); p.btn('모임 AI에게 묻기').click(); assert.equal(p.asks.length, 1); });

test('연결: desktop.html·paths·SP·CSS', () => {
  assert.match(d, /tab-btn-mtg/); assert.match(d, /mtg-root-host/); assert.match(d, /mtg: 'ksocial'/); assert.match(d, /_mtgOpen/); assert.match(d, /meet-app\.js/);
  assert.match(paths, /meet-app\.js/); assert.match(paths, /meet\.css/); assert.match(sp, /"scr": "모임 화면"/); assert.match(css, /\.mtg/); assert.ok(!/\.sch\b/.test(css));
});
