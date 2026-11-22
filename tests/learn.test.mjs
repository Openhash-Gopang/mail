import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const l = readFileSync(new URL('../learn.html', import.meta.url), 'utf8');

test('desktop.html: 교육 인프라의 내 수업·학습 기록 칩이 학습 화면(learn.html)을 연다', () => {
  assert.match(d, /kschool:\['학습 상담','내 수업>learn:subjects','과제','학습 기록>learn:history'\]/);
  assert.match(d, /id="tab-btn-learn"[^>]*onclick="_switchTab\('learn'\)"/);
  assert.match(d, /id="tab-learn"[^>]*><iframe id="learn-frame"/);
  assert.match(d, /'learn\.html\?embed=mail'/);
  assert.match(d, /go\.indexOf\('learn:'\) === 0\) \{ _learnOpen/);
});

test('desktop.html: 학습 화면에서 온 소식은 같은 출처·학습 프레임에서 온 것만 받는다', () => {
  assert.match(d, /e\.origin !== location\.origin \|\| e\.source !== f\.contentWindow \|\| d\.type !== 'navi-learn-ask'/);
});

test('desktop.html: 인프라 AI → 교육은 학습 포털을 바로 열고 교육 SP 대화창 파일을 불러온다', () => {
  assert.match(d, /if \(key === 'kschool'\) \{ _learnOpen\('subjects'\); return; \}/);
  assert.match(d, /<script src="learn-sp\.js[^"]*"><\/script><script src="learn-host\.js/);
  assert.match(d, /if \(window\.LearnHost\) LearnHost\.enter\(\); \} else if \(window\.LearnHost\) LearnHost\.leave\(\);/);
  assert.match(d, /if \(window\.LearnHost\) LearnHost\.ask\(d\.text\); return;/);
});

test('learn-host.js: 우하단 아이콘·교육 SP·검증', () => {
  const h = readFileSync(new URL('../learn-host.js', import.meta.url), 'utf8');
  assert.match(h, /sp: 'inline:learn:v1', spText: LearnSP\.LEARN_SP/);
  assert.match(h, /if \(_learn\.active\) \{ _lchatToggle\(\); return true; \}/);
  assert.match(h, /e\.origin !== location\.origin \|\| e\.source !== f\.contentWindow/);
  assert.match(h, /e\.source !== HondiChat\.frameWindow\(\) \|\| !_hcOrigin\(e\)/);
  assert.match(h, /LearnSP\.cleanAct\(raw\)/);
});

test('learn.html: 내 수업·과목 추가·학습 기록·마스터리 단계', () => {
  for (const k of ['내 수업', '과목 추가', '학습 기록', '과목별 숙달도', '숙달', '통과', '연습 중', '시작 전', '예시 데이터']) assert.ok(l.includes(k), k);
  for (const s of ['수학', '물리', '영어', '초등', '대학원']) assert.ok(l.includes("'" + s + "'"), s);
  assert.ok(!/innerHTML/.test(l), 'learn.html 은 innerHTML 을 쓰지 않는다(사용자 입력 목표 문구 보호)');
});

test('learn.html: 주차 학습 페이지·확인 문제 페이지·화면 조작 수신', () => {
  for (const k of ['viewWeek', 'viewQuiz', 'navi-learn-nav', 'navi-learn-state', 'navi-learn-result', 'applyResult', 'RECHECK']) assert.ok(l.includes(k), k);
  assert.match(l, /e\.origin !== location\.origin \|\| e\.source !== parent/);
});
