import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const l = readFileSync(new URL('../learn-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../learn.css', import.meta.url), 'utf8');

test('desktop.html: 교육 인프라의 내 수업·학습 기록 칩이 학습 화면(learn.html)을 연다', () => {
  assert.match(d, /kschool:\['학습 상담','내 수업>learn:subjects','과제','학습 기록>learn:history'\]/);
  assert.match(d, /id="tab-btn-learn"[^>]*onclick="_switchTab\('learn'\)"/);
  assert.match(d, /id="tab-learn"[^>]*><div id="learn-root"><\/div>/);
  assert.ok(!/learn-frame|<iframe[^>]*learn\.html/.test(d), '교육 화면은 iframe 이 아니라 문서 안에 직접 그린다');
  assert.match(d, /'learn-app\.js\?v=' \+ _LEARN_V/); assert.match(d, /'learn\.css\?v=' \+ _LEARN_V/);
  assert.match(d, /go\.indexOf\('learn:'\) === 0\) \{ _learnOpen/);
});

test('desktop.html: 학습 화면은 NaviLearn 으로 직접 부르고 postMessage 를 쓰지 않는다', () => {
  assert.match(d, /NaviLearn\.mount\(r, \{ view: view \}\)/);
  assert.match(d, /LearnHost\.bind\(NaviLearn\)/);
  assert.ok(!/navi-learn-/.test(d));
});

test('desktop.html: 인프라 AI → 교육은 학습 포털을 바로 열고 교육 SP 대화창 파일을 불러온다', () => {
  assert.match(d, /if \(key === 'kschool'\) \{ _learnOpen\('subjects'\); return; \}/);
  assert.match(d, /<script src="learn-sp\.js[^"]*"><\/script><script src="learn-host\.js/);
  assert.match(d, /if \(window\.LearnHost\) LearnHost\.enter\(\); \} else if \(window\.LearnHost\) LearnHost\.leave\(\);/);
});

test('learn-host.js: 우하단 아이콘·교육 SP·검증', () => {
  const h = readFileSync(new URL('../learn-host.js', import.meta.url), 'utf8');
  assert.match(h, /sp: 'inline:learn:v1', spText: LearnSP\.LEARN_SP/);
  assert.match(h, /if \(_learn\.active\) \{ _lchatToggle\(\); return true; \}/);
  assert.match(h, /L\.on\('ask', \(t\) => \{ _learnAsk\(t\); \}\)/);
  assert.ok(!/learn-frame|navi-learn-/.test(h));
  assert.match(h, /e\.source !== HondiChat\.frameWindow\(\) \|\| !_hcOrigin\(e\)/);
  assert.match(h, /LearnSP\.cleanAct\(raw\)/);
});

test('learn-app.js: 내 수업·과목 추가·학습 기록·마스터리 단계', () => {
  for (const k of ['내 수업', '과목 추가', '학습 기록', '과목별 숙달도', '숙달', '통과', '연습 중', '시작 전', '예시 데이터']) assert.ok(l.includes(k), k);
  for (const s of ['수학', '물리', '영어', '초등', '대학원']) assert.ok(l.includes("'" + s + "'"), s);
  assert.ok(!/innerHTML/.test(l), 'learn.html 은 innerHTML 을 쓰지 않는다(사용자 입력 목표 문구 보호)');
});

test('learn-app.js: 주차 학습 페이지·확인 문제 페이지·화면 조작 수신', () => {
  for (const k of ['viewWeek', 'viewQuiz', 'applyResult', 'RECHECK', "emit('state'", "emit('result'", "emit('ask'", 'window.NaviLearn']) assert.ok(l.includes(k), k);
  assert.ok(!/postMessage|parent\./.test(l), 'iframe 이 아니므로 postMessage 를 쓰지 않는다');
});

test('learn-app.js: 학습 보고서·진로 추천 화면', () => {
  for (const k of ['viewReport', 'viewCareer', 'metricsOf', 'careerOf', 'submitReport', '진로 지도 교수', '자료 부족']) assert.ok(l.includes(k), k);
});

test('learn.css: 모든 규칙이 .lrn 안에서만 적용되고 Material 3 규격(개요선 카드·알약 단추·48px 탭)을 따른다', () => {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const sel = [...body.matchAll(/(^|\})\s*([^{}@]+)\{/g)].map((m) => m[2].trim()).filter((x) => x && !/^(from|to|\d+%)/.test(x));
  for (const g of sel) for (const one of g.split(',')) assert.match(one.trim(), /^\.lrn(\b|\s|$)/, '범위 밖 선택자: ' + one);
  assert.match(css, /\.lrn \.card\{[^}]*border-radius:12px[^}]*box-shadow:none/);
  assert.match(css, /\.lrn \.btn\{[^}]*min-height:40px[^}]*border-radius:20px/);
  assert.match(css, /\.lrn \.tab\{(?=[^}]*height:48px)(?=[^}]*border-bottom:3px solid transparent)/);
  assert.ok(!/prefers-color-scheme/.test(css), '나비웹 화면은 밝은 바탕 하나다');
  assert.ok(!/#1A73E8/i.test(css), '자체 팔레트 대신 나비웹 토큰(--pri)을 쓴다');
});
test('learn.html: 단독 페이지는 같은 learn-app.js·learn.css 를 쓴다', () => {
  const p = readFileSync(new URL('../learn.html', import.meta.url), 'utf8');
  assert.match(p, /<link rel="stylesheet" href="learn\.css">/); assert.match(p, /<script src="learn-app\.js">/);
});
