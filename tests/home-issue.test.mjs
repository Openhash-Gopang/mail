import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const A = createRequire(import.meta.url)('../agent-bridge.js');

test('발급 지시는 서류와 절차를 돌려준다', () => {
  for (const t of ['등본 발급해 줘', '등본 발급해줘', '주민등록등본 떼 줘', '초본 한 통 발급 부탁해', '등본 좀 뽑아 주세요', '주민등록표 등본 발급', '등본 발급받고 싶어']) {
    const r = A.issueIntent(t); assert.ok(r, t); assert.equal(r.plan.playbook, 'gov24-doc', t); assert.match(r.doc, /주민\s*등록/, t);
  }
  assert.equal(A.issueIntent('가족관계증명서 발급해 줘').doc, '가족관계증명서');
  assert.equal(A.issueIntent('납세증명서 발급해 줘').plan.url, 'https://www.hometax.go.kr');
});
test('질문·부정·등기·여러 서류·작성은 잡지 않는다', () => {
  for (const t of ['등본이 뭐야?', '등본 발급 방법 알려 줘', '등본 발급 수수료 얼마야', '등본 발급하지 마', '법인 등본 발급해 줘', '부동산 등기부등본 떼 줘', '판결 등본 발급해 줘',
    '등본하고 가족관계증명서 발급해 줘', '등본 발급해서 김과장에게 보내 줘', '위임장 작성해 줘', '등본 냈어', '여권 발급해 줘']) assert.equal(A.issueIntent(t), null, t);
});
test('홈 작업에는 파일을 돌려받을 slot 이 있고 주민번호는 가린다', () => {
  const r = A.issueIntent('등본 발급해 줘'), j = A.homeJob(r.doc, r.plan, '900101-1234567 등본');
  assert.equal(A.homeDoc(j.slot), '주민등록표 등본'); assert.equal(j.url, 'https://www.gov.kr'); assert.ok(!j.goal.includes('1234567'));
  assert.equal(A.homeDoc('주민등록표 등본'), '');
});
