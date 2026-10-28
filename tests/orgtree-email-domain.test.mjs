import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { _pure: P } = require('../orgtree.js');

const emptyTree = () => P.buildTree([]);

test('이메일 도메인으로 대학 추정(하위 도메인 포함)', () => {
  assert.equal(P.guessOrgFromEmail('dikang@yonsei.ac.kr'), '연세대학교');
  assert.equal(P.guessOrgFromEmail('a@mail.jbnu.ac.kr'), '전북대학교');
  assert.equal(P.guessOrgFromEmail('x@KNOU.AC.KR'), '한국방송통신대학교');
  assert.equal(P.guessOrgFromEmail('x@gmail.com'), '');
  assert.equal(P.guessOrgFromEmail('x@notyonsei.ac.kr'), '');
  assert.equal(P.guessOrgFromEmail('이상한'), '');
});
test('소속이 비어 있어도 대학 이메일은 학교>대학>대학교 로 제안(확실), 일반 메일은 대상 아님', () => {
  const { groups, noOrg } = P.buildGroups([
    { id: '1', name: 'A', email: 'a@jbnu.ac.kr', org: '', org_path: '' },
    { id: '2', name: 'B', email: 'b@mail.jbnu.ac.kr', org: '', org_path: '' },
    { id: '3', name: 'C', email: 'c@gmail.com', org: '', org_path: '' },
  ], emptyTree());
  assert.equal(noOrg.length, 1);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].segs, ['학교', '대학', '전북대학교']);
  assert.equal(groups[0].conf, 'high'); assert.equal(groups[0].via, 'email'); assert.equal(groups[0].count, 2);
});
test('"연세대학교 · 경제학부" 같은 구분 기호 정리', () => {
  const r = P.classifyOrg('연세대학교 · 경제학부', '', new Map());
  assert.deepEqual(r.segs, ['학교', '대학', '연세대학교', '경제학부']);
  assert.deepEqual(P.classifyOrg('고려대학교/경영학과', '', new Map()).segs, ['학교', '대학', '고려대학교', '경영학과']);
});
test('소속과 부서가 따로 있는 기존 방식은 그대로', () => {
  const { groups } = P.buildGroups([{ id: '1', name: 'K', email: 'k@yonsei.ac.kr', org: '연세대학교', dept: '경제학부', org_path: '' }], emptyTree());
  assert.deepEqual(groups[0].segs, ['학교', '대학', '연세대학교', '경제학부']);
});
