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

test('desktop.html: 학습 화면의 교수 호출은 같은 출처·학습 프레임에서 온 것만 받는다', () => {
  assert.match(d, /e\.origin !== location\.origin \|\| e\.source !== f\.contentWindow \|\| d\.type !== 'navi-learn-ask'/);
});

test('learn.html: 내 수업·과목 추가·학습 기록·마스터리 단계', () => {
  for (const k of ['내 수업', '과목 추가', '학습 기록', '과목별 숙달도', '숙달', '통과', '연습 중', '시작 전', '예시 데이터']) assert.ok(l.includes(k), k);
  for (const s of ['수학', '물리', '영어', '초등', '대학원']) assert.ok(l.includes("'" + s + "'"), s);
  assert.ok(!/innerHTML/.test(l), 'learn.html 은 innerHTML 을 쓰지 않는다(사용자 입력 목표 문구 보호)');
});
