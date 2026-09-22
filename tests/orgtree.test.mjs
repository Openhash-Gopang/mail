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

// ═════════ 미분류 자동 분류(규칙 기반 분류기) ═════════
const emptyTree = () => P.buildTree([]);
const cls = (org, dept = '', tree = emptyTree()) => P.classifyOrg(org, dept, P.makeIndex(tree));
const path = c => c.segs && c.segs.join('>');

test('분류기: 사용자 예시 — "제주대학교 컴퓨터공학과" → 학교>대학>제주대학교>컴퓨터공학과', () => {
  assert.equal(path(cls('제주대학교 컴퓨터공학과')), '학교>대학>제주대학교>컴퓨터공학과');
  assert.equal(path(cls('제주대학교')), '학교>대학>제주대학교');
  assert.equal(path(cls('제주대학교', '컴퓨터공학과')), '학교>대학>제주대학교>컴퓨터공학과');   // 부서 필드를 하위 노드로
  assert.equal(cls('제주대학교').conf, 'high');
});
test('분류기: 대학 규칙보다 병원·동문회·대학원 규칙이 먼저(우선순위)', () => {
  assert.equal(path(cls('제주대학교병원')), '의료기관>병원>제주대학교병원');
  assert.equal(path(cls('서울대학교 치과병원')), '의료기관>병원>서울대학교 치과병원');
  assert.equal(path(cls('제주대학교 총동문회')), '협회·단체>제주대학교 총동문회');
  assert.equal(path(cls('제주대학교 대학원')), '학교>대학원>제주대학교');   // 2026-09-22 수정: 중복 리프 제거
  assert.equal(path(cls('한국방송통신대학교')), '학교>대학>한국방송통신대학교');   // 방송 키워드가 아니라 대학
});
test('분류기: 초·중·고, 대학 아닌 학교', () => {
  assert.equal(path(cls('한림초등학교')), '학교>초등학교>한림초등학교');
  assert.equal(path(cls('한림중학교')), '학교>중학교>한림중학교');
  assert.equal(path(cls('제주고등학교')), '학교>고등학교>제주고등학교');
  assert.equal(path(cls('제주대학교부속고등학교')), '학교>고등학교>제주대학교부속고등학교');
});
test('분류기: 정부·공공기관', () => {
  assert.equal(path(cls('제주특별자치도청')), '정부·공공기관>지방자치단체>제주특별자치도청');
  assert.equal(path(cls('제주시 한림읍사무소')), '정부·공공기관>지방자치단체>제주시 한림읍사무소');
  assert.equal(path(cls('제주도교육청')), '정부·공공기관>지방자치단체>제주도교육청');
  assert.equal(path(cls('행정안전부')), '정부·공공기관>중앙정부>행정안전부');
  assert.equal(path(cls('국세청')), '정부·공공기관>중앙정부>국세청');
  assert.equal(path(cls('제주지방법원')), '정부·공공기관>국회·법원>제주지방법원');
  assert.equal(path(cls('한국관광공사')), '정부·공공기관>공공기관>한국관광공사');
  assert.equal(cls('한국관광공사').conf, 'medium');
});
test('분류기: 의료·금융·연구·언론·협회·국제·기업', () => {
  assert.equal(path(cls('한림의원')), '의료기관>의원>한림의원');
  assert.equal(path(cls('행복약국')), '의료기관>약국>행복약국');
  assert.equal(path(cls('제주은행')), '금융기관>은행>제주은행');
  assert.equal(path(cls('삼성생명')), '금융기관>증권·보험>삼성생명');
  assert.equal(path(cls('한국과학기술연구원')), '연구기관>한국과학기술연구원');
  assert.equal(path(cls('제주일보')), '언론·방송>제주일보');
  assert.equal(path(cls('KBS제주')), '언론·방송>KBS제주');
  assert.equal(path(cls('제주도 관광협회')), '협회·단체>제주도 관광협회');
  assert.equal(path(cls('사단법인 한림발전회')), '협회·단체>사단법인 한림발전회');
  assert.equal(path(cls('주한 미국대사관')), '국제·외국기관>주한 미국대사관');
  assert.equal(path(cls('(주)혼디')), '기업>(주)혼디');
  assert.equal(path(cls('Acme Corp.')), '기업>Acme Corp.');
  assert.equal(cls('(주)혼디').conf, 'high');
  assert.equal(cls('한림전자').conf, 'medium');
});
test('분류기: 규칙 없음/소속 없음은 null(억지로 추측하지 않는다)', () => {
  assert.equal(cls('혼디').segs, null); assert.equal(cls('혼디').conf, 'none');
  assert.equal(cls('').segs, null); assert.equal(cls('   ').why, '소속 미기재');
  assert.equal(cls(null).segs, null);
});
test('분류기: 이미 있는 노드의 이름·별칭이 규칙보다 우선(표기 통일)', () => {
  const tree = P.buildTree([
    { id: 'a', name: '학교', parent_id: '', path: '학교', depth: 1, aliases: [] },
    { id: 'b', name: '대학', parent_id: 'a', path: '학교>대학', depth: 2, aliases: [] },
    { id: 'c', name: '제주대학교', parent_id: 'b', path: '학교>대학>제주대학교', depth: 3, aliases: ['제주대', 'JNU'] },
    { id: 'd', name: '혼디', parent_id: '', path: '협력사>혼디', depth: 2, aliases: ['Hondi Inc'] },
  ]);
  assert.equal(path(cls('제주대', '', tree)), '학교>대학>제주대학교');
  assert.equal(path(cls('jnu', '', tree)), '학교>대학>제주대학교');          // 대소문자 무시
  assert.equal(path(cls('제주 대학교', '', tree)), '학교>대학>제주대학교');   // 공백 무시
  assert.equal(path(cls('제주대', '컴퓨터공학과', tree)), '학교>대학>제주대학교>컴퓨터공학과');   // 대학 하위면 부서 추가
  assert.equal(path(cls('Hondi Inc', '개발팀', tree)), '협력사>혼디');        // 대학이 아니면 부서는 붙이지 않음
  assert.equal(cls('제주대', '', tree).why, '이미 있는 소속(이름·별칭 일치)');
  assert.equal(path(cls('혼디', '', tree)), '협력사>혼디');                    // 규칙이 없던 표기도 노드 이름이면 매칭
});
test('분류기: 같은 표기가 여러 노드에 있으면(모호) 별칭 매칭을 쓰지 않는다', () => {
  const tree = P.buildTree([
    { id: 'a', name: '기획팀', parent_id: '', path: 'A>기획팀', depth: 2, aliases: [] },
    { id: 'b', name: '기획팀', parent_id: '', path: 'B>기획팀', depth: 2, aliases: [] },
  ]);
  assert.equal(cls('기획팀', '', tree).segs, null);
});
test('분류기: 노드 이름에 못 쓰는 문자는 공백으로 정리, 정리 후 비면 제안 없음', () => {
  assert.equal(path(cls('한림 > 의원')), '의료기관>의원>한림 의원');
  assert.equal(P.sanitizeName('a%b\\c>d'), 'a b c d');
  assert.equal(P.sanitizeName('__NONE__'), '');
  assert.equal(P.sanitizeName('x'.repeat(150)).length, 100);
});
test('buildGroups: 소속별 묶음·건수 순 정렬, 대학은 부서별로 나눔, 소속 없음 분리', () => {
  const contacts = [
    { id: '1', name: '가', org: '제주대학교', dept: '컴퓨터공학과' },
    { id: '2', name: '나', org: '제주대학교', dept: '컴퓨터공학과' },
    { id: '3', name: '다', org: '제주대학교', dept: '' },
    { id: '4', name: '라', org: '(주)혼디', dept: '개발팀' },
    { id: '5', name: '마', org: '(주)혼디', dept: '영업팀' },
    { id: '6', name: '바', org: '  (주)혼디 ', dept: '' },
    { id: '7', name: '사', org: '', dept: '' },
    { id: '8', name: '아', org: '미지의곳', dept: '' },
  ];
  const { groups, noOrg } = P.buildGroups(contacts, emptyTree());
  assert.equal(noOrg.length, 1);
  const by = Object.fromEntries(groups.map(g => [g.org + '|' + g.dept, g]));
  assert.equal(by['(주)혼디|'].count, 3, '기업은 부서로 나누지 않고 공백만 다른 표기를 한 그룹으로');
  assert.equal(by['제주대학교|컴퓨터공학과'].count, 2);
  assert.deepEqual(by['제주대학교|컴퓨터공학과'].segs, ['학교', '대학', '제주대학교', '컴퓨터공학과']);
  assert.equal(by['제주대학교|'].count, 1); assert.deepEqual(by['제주대학교|'].segs, ['학교', '대학', '제주대학교']);
  assert.equal(by['미지의곳|'].segs, null);
  assert.equal(by['제주대학교|컴퓨터공학과'].deptUsed, true); assert.equal(by['(주)혼디|'].deptUsed, false);
  assert.deepEqual(groups.map(g => g.count), [3, 2, 1, 1], '건수 내림차순');
  assert.deepEqual(by['(주)혼디|'].ids.sort(), ['4', '5', '6']);
});

// ═════════ 2026-09-22 수정: 대학원 소속의 대학명 추출 ═════════
// 실사용 결함 재현(사용자 스크린샷) — '대학원' 캐치올이 대학명 추출보다 먼저 걸려
// "고려대학교 정보대학 대학원 뇌공학과" 같은 원문 전체가 대학 구분 없이
// 학교>대학원 바로 밑에 평평하게 쌓였던 문제.
test('분류기(수정): 대학원 소속도 대학별로 나뉜다 — 실사용 재현 사례', () => {
  const idx = P.makeIndex(emptyTree());
  const a = P.classifyOrg('고려대학교 정보대학 대학원 뇌공학과', '', idx);
  assert.equal(path(a), '학교>대학원>고려대학교>정보대학 대학원 뇌공학과');
  assert.equal(a.conf, 'high');
  const b = P.classifyOrg('이화여자대학교 법학전문대학원(특임·연구교수)', '', idx);
  assert.equal(path(b), '학교>대학원>이화여자대학교>법학전문대학원(특임·연구교수)');
});
test('분류기(수정): 대학원 텍스트가 "대학원" 그 자체뿐이면 중복 리프를 만들지 않는다', () => {
  assert.equal(path(cls('제주대학교 대학원')), '학교>대학원>제주대학교');
});
test('분류기(수정): 부서 필드에 "대학원"이 있으면 대학원으로 라우팅', () => {
  assert.equal(path(cls('제주대학교', '대학원 컴퓨터공학과')), '학교>대학원>제주대학교>대학원 컴퓨터공학과');
});
test('분류기(수정): 대학명을 못 뽑는 경우(공백 없는 표기)만 종전처럼 평평한 대체 규칙으로', () => {
  assert.equal(path(cls('정보대학원')), '학교>대학원>정보대학원');
  assert.equal(cls('정보대학원').why, '대학원(대학명 인식 불가)');
});
test('분류기(수정): 회귀 — 병원·동문회·일반 대학·부서 필드는 그대로', () => {
  assert.equal(path(cls('제주대학교병원')), '의료기관>병원>제주대학교병원');
  assert.equal(path(cls('제주대학교 총동문회')), '협회·단체>제주대학교 총동문회');
  assert.equal(path(cls('연세대학교', '컴퓨터과학과')), '학교>대학>연세대학교>컴퓨터과학과');
  assert.equal(path(cls('성균관대학교 소프트웨어학과(초빙교수)')), '학교>대학>성균관대학교>소프트웨어학과(초빙교수)');
});

// ═════════ 2026-09-22 신설: 과학기술원 계열 영문 약칭(KAIST/POSTECH 등) 인식 ═════════
// 실사용 확인 — '대학교/대학' 접미어가 없어 규칙이 걸리지 않고, 사용자가 직접 입력한 경로에
// '>' 구분자가 없어 트리 최상위에 KAIST/POSTECH 노드 3개가 학교 계층 밖으로 따로 생긴 사례.
test('분류기(신설): 과학기술원 계열 — 학부/대학원 구분, 학과 없으면 대학까지만', () => {
  assert.equal(path(cls('KAIST 전산학부')), '학교>대학>KAIST>전산학부');
  assert.equal(path(cls('KAIST AI 대학원')), '학교>대학원>KAIST>AI 대학원');
  assert.equal(path(cls('POSTECH 컴퓨터공학과')), '학교>대학>POSTECH>컴퓨터공학과');
  assert.equal(path(cls('KAIST')), '학교>대학>KAIST');   // 학과 정보 없음 — 대학 노드까지만 제안
  assert.equal(path(cls('GIST')), '학교>대학>GIST');
  assert.equal(path(cls('UNIST 물리학과')), '학교>대학>UNIST>물리학과');
  assert.equal(path(cls('DGIST 대학원 로봇공학과')), '학교>대학원>DGIST>대학원 로봇공학과');
});
test('분류기(신설): 대소문자가 섞여도 표준 표기(대문자)로 정규화되어 같은 노드로 모인다', () => {
  assert.equal(path(cls('kaist 전산학부')), '학교>대학>KAIST>전산학부');
  assert.equal(path(cls('Kaist 전산학부')), '학교>대학>KAIST>전산학부');
  assert.equal(path(cls('postech 컴퓨터공학과')), '학교>대학>POSTECH>컴퓨터공학과');
});
test('분류기(신설): 회귀 — 목록에 없는 영문 약칭·한글 음역은 여전히 규칙 없음(억지 추측 안 함)', () => {
  assert.equal(cls('카이스트').segs, null);
  assert.equal(cls('MIT').segs, null);
});
