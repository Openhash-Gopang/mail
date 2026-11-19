// 매뉴얼 장(CHAPTERS) 무결성 — 사용법 강의를 합친 뒤(2026-11-15) 장 데이터가 깨지지 않았는지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const html = readFileSync(new URL('../manual/hondi_interactive_manual.html', import.meta.url), 'utf8');
const C = JSON.parse(/var CHAPTERS = (\[.*\]);\n/.exec(html)[1]);
test('장 id 중복 없음, 단계는 초·중·고 순서로 묶임', () => {
  assert.equal(new Set(C.map((c) => c.id)).size, C.length);
  const t = C.map((c) => c.tier), order = ['beginner', 'intermediate', 'advanced'];
  assert.deepEqual([...new Set(t)], order);
  assert.ok(C.length >= 70);
});
test('장마다 제목·본문·퀴즈가 있고 정답 index 가 유효하다', () => {
  for (const c of C) {
    assert.ok(c.title && c.body && c.body.length > 40, c.id);
    assert.ok(c.quiz && c.quiz.length >= 1, 'quiz ' + c.id);
    for (const q of c.quiz) { assert.ok(q.options.length >= 2 && q.answer >= 0 && q.answer < q.options.length, 'answer ' + c.id); assert.ok(q.options.every(Boolean), 'option ' + c.id); }
  }
});
test('옛 강의 표현(이 코스·실습 ①)이 남지 않는다', () => {
  for (const c of C) assert.ok(!/이 코스|이 퀴즈 코스|실습 [①-⑨]/.test(c.body), c.id);
});
test('장에 쓴 그림 파일이 manual-img 에 있다', () => {
  for (const c of C) for (const m of c.body.matchAll(/src="manual-img\/([^"]+)"/g)) assert.ok(existsSync(new URL('../manual/manual-img/' + m[1], import.meta.url)), c.id + ' ' + m[1]);
});

test('본문의 장 참조는 링크이고 가리키는 장이 있다', () => {
  const ids = new Set(C.map((c) => c.id));
  for (const c of C) {
    for (const m of c.body.matchAll(/data-goto="([^"]+)"/g)) assert.ok(ids.has(m[1]), `${c.id} → ${m[1]} 없음`);
    const plain = c.body.replace(/<[^>]+>/g, ' ');
    assert.ok(!/(?<!자료\s*)(?<![\d/“”\"])\d{1,3}장(?!\s*완료)/.test(plain.replace(/\d+\s*\/\s*\d+장/g, '')), `${c.id}: 링크 아닌 "N장" 표기가 남음`);
  }
});
