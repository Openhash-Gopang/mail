import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 화면 시험은 건너뛴다 */ }
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const L = require('../learn-sp.js');

test('parseReply: ~~~learn 블록을 떼어 글과 화면 조작으로 나눈다', () => {
  const r = L.parseReply('3주차를 엽니다.\n~~~learn\n{"do":"week","subject":"경제학","week":"3"}\n~~~');
  assert.equal(r.text, '3주차를 엽니다.');
  assert.deepEqual(r.acts, [{ do: 'week', subject: '경제학', week: 3 }]);
  assert.deepEqual(L.parseReply('x\n~~~learn\n{깨짐\n~~~').acts, []);
  assert.equal(L.parseReply('~~~learn\n[{"do":"history"},{"do":"subjects"}]\n~~~').acts.length, 1, '한 번에 하나만 실행');
});

test('cleanAct: 허용되지 않은 값은 버린다', () => {
  assert.equal(L.cleanAct({ do: 'rm' }), null);
  assert.equal(L.cleanAct({ do: 'week', subject: '경제학', week: 0 }), null);
  assert.equal(L.cleanAct({ do: 'week', subject: '경제학', week: 53 }), null);
  assert.equal(L.cleanAct({ do: 'week', subject: '경제학', week: 2.5 }), null);
  assert.equal(L.cleanAct({ do: 'week', week: 3 }), null);
  assert.equal(L.cleanAct({ do: 'add', subject: '아주아주아주아주긴과목이름입니다' }), null);
  assert.deepEqual(L.cleanAct({ do: 'add', subject: '영어', level: '고등', x: 1 }), { do: 'add', subject: '영어', level: '고등' });
  assert.deepEqual(L.cleanAct({ do: 'history', subject: 'ignored' }), { do: 'history' });
});

test('localIntent: 분명한 이동 명령만 규칙으로 읽는다', () => {
  const t = (s) => L.localIntent(s);
  assert.deepEqual(t('경제학 3주차 학습 페이지로 전환'), { do: 'week', subject: '경제학', week: 3 });
  assert.deepEqual(t('미적분 3주차 시험 문제 풀래'), { do: 'quiz', subject: '미적분', week: 3 });
  assert.deepEqual(t('내 학습 기록 보여줘'), { do: 'history' });
  assert.deepEqual(t('수학 교수님 불러줘'), { do: 'prof', subject: '수학' });
  assert.deepEqual(t('영어 과목 추가해줘 고등'), { do: 'add', subject: '영어', level: '고등' });
  assert.equal(t('수요곡선이 뭐예요?'), null);
  assert.equal(t(''), null);
});

test('buildAsk: 화면·과목 목록·교수 모드를 앞에 붙인다', () => {
  const a = L.buildAsk('이어서 학습할래', { view: 'course', cur: { id: 'econ', name: '경제학 입문' }, courses: [{ id: 'econ', name: '경제학 입문', subj: '경제학', level: '대학', weeks: 30, next: 1 }] }, '경제학 교수');
  assert.match(a, /^\[학습 화면\]\n\{/);
  assert.match(a, /"professor":"경제학 교수"/);
  assert.match(a, /\[사용자 말\]\n이어서 학습할래$/);
});

test('교육 SP 지침: 블록 형식과 금지 사항이 들어 있다', () => {
  for (const k of ['~~~learn', 'subjects', 'history', 'week', 'quiz', 'add', 'prof', 'endprof', '정답을 미리 알려 주지 않는다']) assert.ok(L.LEARN_SP.includes(k), k);
});

test('learn-app.js: 화면 조작(주차·시험)과 채점·단계 갱신', { skip: !JSDOM && 'jsdom 없음' }, () => {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window, doc = w.document; w.eval(readFileSync(new URL('../learn-app.js', import.meta.url), 'utf8'));
  const out = []; w.NaviLearn.on('result', (m) => out.push(m)); w.NaviLearn.mount(doc.getElementById('m'));
  const nav = (a) => w.NaviLearn.nav(a);
  const txt = () => doc.getElementById('lrn-root').textContent;
  nav({ do: 'week', subject: '경제학', week: 3 });
  assert.match(txt(), /경제학 입문 · 3주차 — 탄력성/); assert.equal(out.pop().ok, true);
  nav({ do: 'quiz', subject: '경제학', week: 1 });
  assert.match(txt(), /1주차 확인 문제/);
  const submit = () => [...doc.querySelectorAll('button')].find((b) => b.textContent.startsWith('제출'));
  assert.equal(submit().disabled, true, '모두 답하기 전에는 제출할 수 없다');
  const right = [1, 0, 1, 0, 1];
  [...doc.querySelectorAll('.q')].forEach((q, i) => q.querySelectorAll('.opt')[right[i]].click());
  submit().click();
  assert.match(txt(), /5 \/ 5문제 · 100%/);
  assert.match(txt(), /통과했습니다/);
  assert.equal(JSON.parse(w.localStorage.getItem('navi-learn-v1')).prog.econ.seq[0], 'P');
  nav({ do: 'week', subject: '경제학', week: 99 }); assert.equal(out.pop().ok, false);
  nav({ do: 'week', subject: '화학', week: 1 }); assert.match(out.pop().msg, /찾지 못했습니다/);
  const before = txt(); w.NaviLearn.nav(null); w.NaviLearn.nav({ do: 'zzz' }); assert.match(out.pop().msg, /지원하지 않는/); assert.equal(txt(), before, '모르는 조작은 화면을 바꾸지 않는다');
  nav({ do: 'add', subject: '영어', level: '고등' }); assert.match(out.pop().msg, /추가했습니다/);
});

test('localIntent·cleanAct: 보고서·제출·진로 명령', () => {
  assert.deepEqual(L.localIntent('내 학습 보고서 보여줘'), { do: 'report' });
  assert.deepEqual(L.localIntent('수학 보고서 제출해줘'), { do: 'submit', subject: '수학' });
  assert.deepEqual(L.localIntent('내 보고서 제출해줘'), { do: 'submit' });
  assert.deepEqual(L.localIntent('진로 추천해줘'), { do: 'career' });
  assert.deepEqual(L.cleanAct({ do: 'career', subject: 'x' }), { do: 'career' });
  assert.ok(L.LEARN_SP.includes('진로 지도 교수') && L.LEARN_SP.includes('reports'));
  const a = L.buildAsk('진로 추천해줘', { reports: [{ id: 'econ', name: '경제학 입문', score: 90, prog: 12, avg: 92, first: 100, pace: 2, attempts: 4, submitted: true }], career: [{ name: '경제·금융·경영', fit: 90 }] }, '진로 지도 교수');
  assert.match(a, /"reports":\[\{"id":"econ"/); assert.match(a, /"career":\[\{"name":"경제·금융·경영"/);
});

test('learn-app.js: 보고서 제출 → 진로 추천', { skip: !JSDOM && 'jsdom 없음' }, () => {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window, doc = w.document; w.eval(readFileSync(new URL('../learn-app.js', import.meta.url), 'utf8'));
  const out = []; w.NaviLearn.on('result', (m) => out.push(m)); w.NaviLearn.mount(doc.getElementById('m'));
  const nav = (a) => w.NaviLearn.nav(a);
  const txt = () => doc.getElementById('lrn-root').textContent;
  nav({ do: 'career' });
  assert.match(txt(), /제출된 보고서가 없습니다/);
  nav({ do: 'submit', subject: '경제학' });
  assert.equal(out.pop().ok, false, '기록 없는 과목은 제출되지 않는다');
  // 경제학 1주차 확인 문제를 통과한 뒤 보고서 제출
  nav({ do: 'quiz', subject: '경제학', week: 1 });
  [1, 0, 1, 0, 1].forEach((r, i) => doc.querySelectorAll('.q')[i].querySelectorAll('.opt')[r].click());
  [...doc.querySelectorAll('button')].find((b) => b.textContent.startsWith('제출')).click();
  nav({ do: 'report' });
  assert.match(txt(), /경제학 입문 · 경제학 교수/); assert.match(txt(), /평균 100%/); assert.match(txt(), /주당|자료 부족/);
  nav({ do: 'submit', subject: '경제학' });
  assert.match(out.pop().msg, /제출했습니다/);
  const sv = JSON.parse(w.localStorage.getItem('navi-learn-v1'));
  assert.equal(sv.sub.econ.score >= 85, true); assert.equal(sv.prog.econ.log.length, 1);
  nav({ do: 'career' });
  assert.match(txt(), /경제·금융·경영/); assert.match(txt(), /신뢰도 낮음/);
  assert.match(txt(), /반영한 보고서/);
  // 점수 기록이 없는 예시 과목(미적분)은 단계 기록만으로 평가하되 근거를 밝힌다
  nav({ do: 'report' }); assert.match(txt(), /주차 단계 기록만/);
});

test('localIntent: 커리큘럼 검색·진행 현황 명령', () => {
  assert.deepEqual(L.localIntent('거시경제학 커리큘럼 찾아줘'), { do: 'search', subject: '거시경제학' });
  assert.deepEqual(L.localIntent('파이썬 기초 검색해줘'), { do: 'search', subject: '파이썬 기초' });
  assert.deepEqual(L.localIntent('진행 현황 보여줘'), { do: 'plan' });
  assert.deepEqual(L.localIntent('영어 과목 추가해줘 고등'), { do: 'add', subject: '영어', level: '고등' }, '추가 명령은 검색으로 새지 않는다');
  assert.equal(L.cleanAct({ do: 'search' }), null); assert.deepEqual(L.cleanAct({ do: 'search', subject: '미적분' }), { do: 'search', subject: '미적분' });
  assert.deepEqual(L.cleanAct({ do: 'plan', subject: 'x' }), { do: 'plan' });
  assert.deepEqual(L.cleanAct({ do: 'week', subject: '수학', week: 52 }), { do: 'week', subject: '수학', week: 52 });
  assert.ok(L.LEARN_SP.includes('search') && L.LEARN_SP.includes('plan') && L.LEARN_SP.includes('Self-paced'));
  const a = L.buildAsk('진도 어때?', { courses: [{ id: 'u1', name: '거시경제학', weeks: 12, next: 3, plan: { done: 2, expected: 4, status: 'behind', std: 48 } }] });
  assert.match(a, /"plan":\{"done":2,"expected":4,"status":"behind","stdHours":48\}/);
});
