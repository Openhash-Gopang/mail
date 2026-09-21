/**
 * tests/orgtree.test.mjs — orgtree.js의 순수 함수 단위 테스트(DOM·네트워크 없음).
 * 실행: node --test tests/orgtree.test.mjs
 * (화면 동작은 jsdom + 실제 worker.js 기반 종단 테스트로 별도 검증 — 2026-09-21)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { _pure: P } = require('../orgtree.js');

const N = (id, name, parent_id, path, depth) => ({ id, name, parent_id, path, depth });
const nodes = () => [
  N('c', '대학', 'a', '학교>대학', 2),
  N('a', '학교', '', '학교', 1),
  N('d', '제주대학교', 'c', '학교>대학>제주대학교', 3),
  N('e', '컴퓨터공학과', 'd', '학교>대학>제주대학교>컴퓨터공학과', 4),
  N('f', '가나다', '', '가나다', 1),
  N('g', '고아', 'ghost', '고아', 2),
];

test('validateName: 정상은 공백 정리, 서버와 같은 금지 문자 거부', () => {
  assert.deepEqual(P.validateName('  제주   대학교 '), { ok: true, name: '제주 대학교' });
  for (const bad of ['가>나', '10%', 'a\\b', '', '   ', '__NONE__', 'x'.repeat(101), 'a\u0001b', 5, null]) {
    assert.equal(P.validateName(bad).ok, false, JSON.stringify(bad));
  }
  assert.equal(P.validateName("Children's Hospital").ok, true);
});
test('parseAliases / aliasesInvalid', () => {
  assert.deepEqual(P.parseAliases(' 제주대, JNU ,제주대,, '), ['제주대', 'JNU']);
  assert.equal(P.aliasesInvalid('a, b>c'), 'b>c');
  assert.equal(P.aliasesInvalid('a, b'), null);
  assert.equal(P.aliasesInvalid(''), null);
});
test('buildTree: 이름순(가나다) 정렬, 부모가 없는 노드는 최상위로', () => {
  const t = P.buildTree(nodes());
  assert.deepEqual(t.roots.map(n => n.name), ['가나다', '고아', '학교']);
  assert.deepEqual(t.kids.get('d').map(n => n.name), ['컴퓨터공학과']);
});
test('flatten: 깊이 우선·정렬 순서, exclude는 하위 통째로 제외', () => {
  const t = P.buildTree(nodes());
  assert.deepEqual(P.flatten(t).map(n => n.name), ['가나다', '고아', '학교', '대학', '제주대학교', '컴퓨터공학과']);
  assert.deepEqual(P.flatten(t, new Set(['d'])).map(n => n.name), ['가나다', '고아', '학교', '대학']);
});
test('descendantIds', () => {
  const t = P.buildTree(nodes());
  assert.deepEqual([...P.descendantIds(t, 'c')].sort(), ['c', 'd', 'e']);
  assert.deepEqual([...P.descendantIds(t, 'e')], ['e']);
});
test('parsePathInput: 구분자 > 만, 공백 정리, 검증·깊이 한도', () => {
  assert.deepEqual(P.parsePathInput(' 학교 > 대학 >제주대학교 '), { ok: true, segments: ['학교', '대학', '제주대학교'] });
  assert.equal(P.parsePathInput('').ok, false);
  assert.equal(P.parsePathInput('>>').ok, false);
  assert.equal(P.parsePathInput('학교>10%').ok, false);
  assert.equal(P.parsePathInput(Array.from({ length: 13 }, (_, i) => 'n' + i).join('>')).ok, false);
  assert.equal(P.parsePathInput(Array.from({ length: 12 }, (_, i) => 'n' + i).join('>')).ok, true);
});
test('planEnsurePath: 가장 깊이 존재하는 노드를 재사용하고 나머지만 만든다', () => {
  const t = P.buildTree(nodes());
  let p = P.planEnsurePath(t, ['학교', '대학', '제주대학교', '컴퓨터공학과']);
  assert.equal(p.existing.id, 'e'); assert.deepEqual(p.toCreate, []);
  p = P.planEnsurePath(t, ['학교', '대학', '한라대학교', '경영학과']);
  assert.equal(p.existing.id, 'c'); assert.equal(p.parentId, 'c'); assert.deepEqual(p.toCreate, ['한라대학교', '경영학과']);
  p = P.planEnsurePath(t, ['기업', '스타트업']);
  assert.equal(p.existing, null); assert.equal(p.parentId, ''); assert.deepEqual(p.toCreate, ['기업', '스타트업']);
  // 같은 이름이 다른 부모 아래에 있어도 섞이지 않는다
  p = P.planEnsurePath(t, ['대학']);
  assert.equal(p.existing, null); assert.deepEqual(p.toCreate, ['대학']);
});
test('chunk / crumbText', () => {
  assert.deepEqual(P.chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(P.chunk([], 100), []);
  assert.equal(P.crumbText('학교>대학>제주대학교'), '학교 › 대학 › 제주대학교');
  assert.equal(P.crumbText(''), '');
});
