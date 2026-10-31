/**
 * tests/guide.test.mjs — guide.js(사용법 단계별 퀴즈)의 순수 로직 테스트(DOM 없음).
 * 실행: node --test tests/guide.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { _pure: G } = require('../guide.js');

test('콘텐츠 무결성: 페이지마다 본문·퀴즈 2개 이상, 정답 index 유효, 보기 3개 이상, 중복 없음', () => {
  assert.ok(G.PAGES.length >= 10);
  for (const p of G.PAGES) {
    assert.ok(p.title && p.body.length >= 3, p.title);
    assert.ok(['기본', '활용', '고급'].includes(p.level), p.title);
    assert.ok(p.quiz.length >= 2, p.title);
    for (const q of p.quiz) {
      assert.ok(q.q && q.hint, p.title);
      assert.ok(q.opts.length >= 3, q.q);
      assert.equal(new Set(q.opts).size, q.opts.length, q.q);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.opts.length, q.q);
    }
  }
});

test('정답 위치가 한쪽에 쏠리지 않음(찍기 방지): 모든 위치가 한 번 이상 쓰임, 한 위치가 60% 초과 금지', () => {
  const cnt = [0, 0, 0]; let n = 0;
  for (const p of G.PAGES) for (const q of p.quiz) { cnt[q.answer]++; n++; }
  assert.ok(cnt.every(c => c > 0), JSON.stringify(cnt));
  assert.ok(Math.max(...cnt) / n <= 0.6, JSON.stringify(cnt));
});

test('채점: 모두 맞아야 all=true, 하나라도 틀리거나 비우면 false', () => {
  const p = G.PAGES[0];
  const right = p.quiz.map(q => q.answer);
  assert.deepEqual(G.grade(p, right), { ok: [true, true, true], all: true });
  const wrong = right.slice(); wrong[1] = (wrong[1] + 1) % 3;
  const r = G.grade(p, wrong);
  assert.equal(r.all, false);
  assert.deepEqual(r.ok, [true, false, true]);
  assert.equal(G.grade(p, [right[0], null, right[2]]).all, false);
  assert.equal(G.grade(p, {}).all, false);
});

test('페이지 목록: 업무(Case) 페이지는 기능 플래그가 켜졌을 때만 포함, 항상 마지막', () => {
  const off = G.pages(false), on = G.pages(true);
  assert.equal(on.length, off.length + 1);
  assert.ok(on[on.length - 1].flag === 'case');
  assert.ok(off.every(p => !p.flag));
});

test('잠금: 완료한 단계 + 바로 다음 단계까지만 열림, 건너뛰기 불가', () => {
  assert.equal(G.canOpen(0, 0, 10), true);
  assert.equal(G.canOpen(0, 1, 10), false);
  assert.equal(G.canOpen(3, 3, 10), true);
  assert.equal(G.canOpen(3, 4, 10), false);
  assert.equal(G.canOpen(3, 0, 10), true);
  assert.equal(G.canOpen(3, -1, 10), false);
  assert.equal(G.canOpen(10, 9, 10), true);
  assert.equal(G.canOpen(10, 10, 10), false);
});

test('진행 값 보정과 다음 페이지', () => {
  assert.equal(G.clampDone('abc', 10), 0);
  assert.equal(G.clampDone(-3, 10), 0);
  assert.equal(G.clampDone(99, 10), 10);
  assert.equal(G.clampDone('4', 10), 4);
  assert.equal(G.nextAfterPass(0, 10), 1);
  assert.equal(G.nextAfterPass(9, 10), -1);
});
