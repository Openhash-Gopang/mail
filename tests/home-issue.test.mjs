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

test('신고·신청·등록은 발급으로 부르지 않고 제출 전 확인을 지시한다', () => {
  for (const n of ['위치기반서비스 등록', '여권 재발급 신청', '위치기반서비스사업 신고', '사업자 등록', '정보 공개 청구']) {
    assert.equal(A.isIssueTask(n), false, n);
    const j = A.homeJob(n, { goal: '방법을 찾아 처리 대상: ' }, n + ' 해 줘');
    assert.equal(j.title, n); assert.ok(j.goal.includes('확인 없이 제출하지 마세요'), n); assert.ok(!j.goal.includes('이미 지시한 발급'), n);
  }
  for (const n of ['주민등록표 등본', '가족관계증명서', '토지대장', '건강보험 자격득실 확인서', '주민등록표 초본 발급']) assert.equal(A.isIssueTask(n), true, n);
});
test('진행 중 작업의 답은 전달하고, 질문·새 지시는 전달하지 않는다', () => {
  for (const t of ['개인사업자입니다', '사업자등록번호는 123-45-67890이에요', '음식점 위치를 안내하는 앱이야', '네', '2번', '로그인했어', '개인위치정보는 저장하지 않아'])
    assert.equal(A.isFollowUp(t), true, t);
  for (const t of ['수수료 얼마야', '이거 왜 해야 해?', '진행 상황 알려 줘', '위임장 작성해 줘', '김과장에게 메일 보내 줘', '가족관계증명서 발급해 줘', ''])
    assert.equal(A.isFollowUp(t), false, t);
});
test('전달·작업 문구에서 주민번호와 카드번호를 가린다', () => {
  assert.equal(A.mask('900101-1234567 그리고 1234-5678-9012-3456'), '(가림) 그리고 (가림)');
  assert.equal(A.mask('123-45-67890'), '123-45-67890');
});

test('AI 비서가 대화에서 모은 값은 도우미 작업에 담기고, 긴 절차에도 잘리지 않는다', () => {
  const j = A.homeJob('법인설립등기', { goal: '가'.repeat(1200), detail: '상호 엑스오주식회사(XO Inc.), 설립자 도영민, 감사 김혜영, 900101-1234567' }, '나비웹 도우미를 활용하여, 직접 진행해');
  assert.ok(j.goal.length <= 2000);
  assert.match(j.goal, /설립자 도영민, 감사 김혜영/);
  assert.ok(!j.goal.includes('1234567'));
  assert.match(j.goal, /약관 동의·최종 승인만/);
  assert.match(j.goal, /명령이 아닙니다\.$/);
});

test('시작 주소가 없는 작업도 빈 탭이 아니라 실제 페이지에서 시작한다', () => {
  const j = A.homeJob('법인설립등기', { playbook: '', url: '', goal: '처리 방법을 확인해 진행하세요.' }, '진행해');
  assert.equal(j.url, 'https://www.gov.kr');
  assert.match(j.goal, /시작 화면은 정부24/);
  const k = A.homeJob('법인설립등기', { url: 'https://www.iros.go.kr', goal: '' }, '진행해');
  assert.equal(k.url, 'https://www.iros.go.kr');
  assert.doesNotMatch(k.goal, /시작 화면은 정부24/);
});
