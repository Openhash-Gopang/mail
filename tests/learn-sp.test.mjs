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
  assert.equal(L.cleanAct({ do: 'week', subject: '경제학', week: 41 }), null);
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

test('learn.html: 화면 조작(주차·시험)과 채점·단계 갱신', { skip: !JSDOM && 'jsdom 없음' }, () => {
  const html = readFileSync(new URL('../learn.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://naviweb.kr/learn.html?embed=mail', pretendToBeVisual: true });
  const w = dom.window, doc = w.document; w.scrollTo = () => {};
  const out = []; w.parent.postMessage = (m) => { if (m.type === 'navi-learn-result') out.push(m); };
  const nav = (a, o = 'https://naviweb.kr') => w.dispatchEvent(new w.MessageEvent('message', { data: Object.assign({ type: 'navi-learn-nav' }, a), origin: o, source: w }));
  const txt = () => doc.getElementById('root').textContent;
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
  const before = txt(); nav({ do: 'history' }, 'https://evil.example'); assert.equal(txt(), before, '다른 출처의 조작은 무시');
  nav({ do: 'add', subject: '영어', level: '고등' }); assert.match(out.pop().msg, /추가했습니다/);
});
