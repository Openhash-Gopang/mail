import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const H = req('../doc-history.js'), F = req('../task-flow.js'), A = req('../agent-bridge.js');

const proc = { title: '위치기반서비스 등록', agency: '시험 기관', entry_url: 'https://www.example.go.kr', legal_kind: '신고', steps: [{ actor: 'user', action: '로그인' }, { actor: 'helper', action: '신고서 제출', submit: true }], required_fields: ['상호'], documents: ['사업계획서'], sources: [{ title: 't', url: 'https://www.law.go.kr' }] };

test('새 계획은 미검토라고 밝히고, 저장된 절차는 승인·확인일을 보여 준다', () => {
  const web = F.planMarkdown({ source: 'web', procedure: proc, questions: ['개인위치정보를 쓰나요?'] });
  assert.match(web, /아직 검토되지 않았습니다/); assert.match(web, /제출 전 확인/); assert.match(web, /개인위치정보/);
  assert.match(F.planMarkdown({ source: 'db', procedure: { ...proc, version: 2, verified_at: '2026-11-26', needs_recheck: true } }), /관리자 승인, 2판/);
});
test('도우미 작업에는 확인 지시가 잘리지 않고 2000자 안에 담긴다', () => {
  const long = { ...proc, steps: Array.from({ length: 40 }, () => ({ actor: 'helper', action: '가'.repeat(300) })) };
  const p = F.toPlan({ source: 'web', procedure: long, questions: [] });
  const j = A.homeJob('위치기반서비스 등록', p, '나'.repeat(500));
  assert.ok(j.goal.length <= 2000, String(j.goal.length)); assert.match(j.goal, /확인 없이 제출하지 마세요/); assert.match(j.goal, /state "sent"/);
  assert.equal(j.url, proc.entry_url); assert.ok(p.proc); assert.equal(F.toPlan({ source: 'db', procedure: proc }).proc, null);
});
test('이력: 끝난 일은 되돌리지 않고, 발급에는 제출 표시가 없다', () => {
  const it = H.make('h1', { title: '위치기반서비스 등록', agency: 'a', type: 'filing', proc }, 1);
  let d = H.parse(it.body); assert.equal(d.state, 'running'); assert.ok(H.canMarkFiled(d));
  d = H.advance(d, 'reported', 2); assert.equal(d.state, 'reported'); assert.equal(H.advance(d, 'failed', 3), null); assert.equal(H.advance(d, 'running', 3), null);
  assert.equal(H.canMarkFiled(H.parse(H.make('h2', { title: '등본', type: 'issue' }, 1).body)), false);
  const rows = H.rows([{ ...it, updated: 5 }], [{ id: 'd1', title: '위임장', updated: 9, hasFile: true }]);
  assert.deepEqual(rows.map((r) => r.state), ['written', 'running']); assert.equal(rows[0].source, 'doc');
});
