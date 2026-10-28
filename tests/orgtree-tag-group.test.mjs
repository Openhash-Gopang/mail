import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { _pure: P } = require('../orgtree.js');

const emptyTree = () => P.buildTree([]);
const C = (id, email, tags, org = '') => ({ id, name: id, email, org, tags, org_path: '' });

test('소속·대학 이메일이 없고 태그가 있으면 태그 이름의 최상위 분류로 제안', () => {
  const { groups, noOrg } = P.buildGroups([
    C('1', 'a@gmail.com', ['팀 주피터']), C('2', 'b@naver.com', ['팀 주피터']), C('3', 'c@daum.net', []),
  ], emptyTree());
  assert.equal(noOrg.length, 1);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].segs, ['팀 주피터']);
  assert.equal(groups[0].count, 2); assert.equal(groups[0].via, 'tag'); assert.equal(groups[0].conf, 'high');
});
test('같은 이름의 분류가 이미 있으면 그 경로를 재사용', () => {
  const tree = P.buildTree([{ id: 'a', name: '지인', parent_id: '', path: '지인', depth: 1 }, { id: 'b', name: '팀 주피터', parent_id: 'a', path: '지인>팀 주피터', depth: 2 }]);
  const { groups } = P.buildGroups([C('1', 'a@gmail.com', ['팀 주피터'])], tree);
  assert.deepEqual(groups[0].segs, ['지인', '팀 주피터']);
});
test('대학 이메일이 태그보다 우선, 소속이 있으면 태그는 쓰지 않음', () => {
  const { groups } = P.buildGroups([C('1', 'a@yonsei.ac.kr', ['팀 주피터']), C('2', 'b@gmail.com', ['팀 주피터'], '제주대학교')], emptyTree());
  const byOrg = Object.fromEntries(groups.map(g => [g.org, g]));
  assert.equal(byOrg['연세대학교'].via, 'email');
  assert.deepEqual(byOrg['제주대학교'].segs, ['학교', '대학', '제주대학교']);
  assert.equal(groups.some(g => g.via === 'tag'), false);
});
test('태그가 여러 개면 첫 번째로 묶고, 태그 이름에 쓸 수 없는 문자는 정리', () => {
  const { groups } = P.buildGroups([C('1', 'a@gmail.com', ['A>B', 'x'])], emptyTree());
  assert.deepEqual(groups[0].segs, ['A B']);
});
