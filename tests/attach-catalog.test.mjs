// 첨부서류 카탈로그 v3 시험 — 사본·접두어 정리, 법원 서류, 사유 코드, 서류 화면 제한(식 20개·200자).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const C = createRequire(import.meta.url)('../attach-catalog.js');
const c = (l) => C.classify(l);

test('v3: 집행권원·판결 서류는 법원(전자소송) 기관 서류이고, 정본과 사본은 형태로 구분한다', () => {
  for (const l of ['집행권원 정본', '집행력 있는 정본', '압류명령정본', '판결문사본', '집행권원사본', '법원 결정문 등본', '회생절차개시결정문', '사건기록사본']) {
    const r = c(l); assert.equal(r.kind, 'agency', l); assert.equal(r.agency, 'ecfs', l);
  }
  assert.equal(c('집행권원 정본').form, '정본');
  assert.equal(c('집행권원 사본').form, '사본');
  assert.equal(c('집행권원 정본').upload, true, '이미 가진 경우 올리기 허용');
  assert.equal(c('집행권원 정본').unverified, true, '이름만 보고 정한 후보는 표시한다');
});

test('v3: ‘등본’ 낱말만으로 주민등록이 되지 않는다', () => {
  assert.equal(c('법원판결문등본').agency, 'ecfs');
  assert.equal(c('법인등록부등본').id, 'registry-misc');
  assert.equal(c('주민등록등본 1부').id, 'resident');
  assert.equal(c('초본').id, 'resident');
});

test('v3: 추가한 기관 서류군', () => {
  const want = { '송달료납부서': 'ecfs', '인지': 'ecfs', '사고사실확인원': 'efine', '재산세고지서사본': 'wetax', '체납고지서': 'wetax', '과태료고지서': 'wetax' };
  for (const [l, ag] of Object.entries(want)) { const r = c(l); assert.equal(r.kind, 'agency', l); assert.equal(r.agency, ag, l); assert.equal(r.reason, 'AGENCY', l); assert.ok(/^https:/.test(r.url), l); }
});

test('v3: 신청서·동의서·위임장은 기관 서류가 아니라 사용자가 쓰는 양식', () => {
  for (const l of ['범죄경력조회동의서', '인감증명서발급신청서', '건축물대장발급신청서', '위임장', '송달료납부영수증', '사건기록목록']) assert.notEqual(c(l).kind, 'agency', l);
  assert.equal(c('범죄경력조회동의서').kind, 'user');
});

test('v3: 가진 서류의 사본은 사용자 자료(USER_HELD), 종류를 모르는 서류의 사본도 사용자 자료', () => {
  assert.equal(c('허가증사본').reason, 'USER_HELD');
  assert.equal(c('아주특이한서류사본').kind, 'user');
  assert.equal(c('아주특이한서류사본').reason, 'USER_HELD');
  assert.equal(c('위임장').reason, 'USER_OWNED');
  assert.equal(c('건축물대장사본').kind, 'agency', '기관 서류의 사본은 가져오기 대상');
});

test('v3: 통칭 이름은 GENERIC 으로 표시한다', () => {
  for (const l of ['변경사실을증명하는서류', '변경사항증빙서류', '소명자료', '관련서류']) assert.equal(c(l).reason, 'GENERIC', l);
});

test('v3: 병원 기록은 개별 기관 발급', () => {
  for (const l of ['입원기록지', '투약기록지', '수술기록지', '활력징후기록지']) { const r = c(l); assert.equal(r.kind, 'thirdparty', l); assert.equal(r.reason, 'THIRD_PARTY', l); }
});

test('v3: 사본·접두어·부수를 떼고도 기존 분류는 그대로', () => {
  assert.equal(c('신청인 인감증명서 1부').id, 'seal');
  assert.equal(c('제3채무자 법인등기사항증명서 1부').playbook, 'iros-corp-ecourt');
  assert.equal(c('신분증사본').kind, 'user');
  assert.equal(c('통장사본').kind, 'user');
  assert.equal(c('아주특이한서류이름').kind, 'unknown');
  assert.equal(c('').kind, 'unknown');
});

test('v3: 서류 화면 제한(식 20개·200자) 안에서 법원 서류에 버튼이 붙고 양식·자료에는 붙지 않는다', () => {
  const pats = C.patterns();
  assert.ok(pats.length <= 20, '식은 20개 이하');
  for (const p of pats.slice(0, -1)) { assert.ok(p.length <= 200, '식 한 개는 200자 이하: ' + p.length); new RegExp(p); }
  const re = pats.slice(0, 20).map((s) => { try { return new RegExp(s.slice(0, 200)); } catch { return null; } }).filter(Boolean);
  const hit = (l) => re.some((x) => x.test(l));
  for (const l of ['집행권원 정본', '집행력 있는 정본', '판결문 사본', '법원 결정문 등본', '송달료납부서', '주민등록등본(초본)', '건축물대장등본']) assert.ok(hit(l), l);
  for (const l of ['범죄경력조회동의서', '인감증명서 발급신청서', '위임장 1부', '사진', '재직증명서']) assert.ok(!hit(l), l);
});

test('v3: 기관 정의·규칙 일관성', () => {
  for (const a of Object.values(C.AGENCIES)) assert.match(a.url, /^https:\/\//);
  for (const r of C.RULES) if (r.kind === 'agency') assert.ok(C.AGENCIES[r.agency], r.id + ' 기관 정의');
  assert.equal(new Set(C.RULES.map((r) => r.id)).size, C.RULES.length, '규칙 id 는 겹치지 않는다');
});

test('v4: 홈택스 서류를 서류별로 나누고, 타인 회사의 사업자등록증은 기관 서류가 아니다', () => {
  assert.equal(c('사업자등록증사본').id, 'biz-reg');
  assert.equal(c('폐업사실증명서').id, 'biz-closure');
  assert.equal(c('원천징수영수증').id, 'withholding');
  assert.ok(c('원천징수영수증').fallback, '조회가 안 되면 회사에 요청');
  assert.equal(c('세금계산서').id, 'tax-invoice');
  assert.equal(c('세금계산서').input, 'ask', '확인 전에는 바로 가져오지 않는다');
  assert.equal(c('세금계산서').unverified, true);
  assert.equal(c('소득증명원').id, 'income-cert');
  for (const l of ['제조사사업자등록증', '임대사업자등록증', '거래처사업자등록증사본']) assert.equal(c(l).kind, 'user', l);
});

test('v4: 제적등본은 전자가족관계등록시스템, 법인 인감증명서는 등기소, 토지이용계획서는 사용자 자료', () => {
  for (const l of ['제적등본', '피상속인제적등본']) { const r = c(l); assert.equal(r.agency, 'efamily', l); assert.match(r.url, /efamily\.scourt\.go\.kr/); }
  assert.equal(c('가족관계증명서').agency, 'gov24');
  assert.equal(c('법인인감증명서').agency, 'iros');
  assert.equal(c('인감증명서').agency, 'gov24', '개인 인감증명서는 그대로');
  assert.equal(c('토지이용계획확인서').id, 'landuse');
  for (const l of ['토지이용계획서', '토지이용계획도']) assert.notEqual(c(l).kind, 'agency', l);
});

test('v4: 결제가 드는 서류 표시(paid)와 사유 코드 설명(REASONS)', () => {
  assert.equal(c('특허증 사본').paid, true);
  assert.equal(c('특허등록원부').paid, true);
  assert.equal(c('가족관계증명서').paid, false);
  for (const k of ['AGENCY', 'THIRD_PARTY', 'USER_OWNED', 'USER_HELD', 'GENERIC', 'UNKNOWN', 'SYSTEM_OUTAGE', 'FETCH_FAILED']) assert.ok(C.REASONS[k], k);
});

test('v4: 서류 화면 제한(식 20개·200자)을 계속 지킨다', () => {
  const pats = C.patterns();
  assert.ok(pats.length <= 20);
  for (const p of pats.slice(0, -1)) { assert.ok(p.length <= 200, p.length + '자'); new RegExp(p); }
  const hit = (l) => pats.slice(0, 20).some((s) => { try { return new RegExp(s.slice(0, 200)).test(l); } catch { return false; } });
  for (const l of ['사업자등록증 사본', '폐업사실증명원', '제적등본', '법인인감증명서', '특허증']) assert.ok(hit(l), l);
  for (const l of ['제조사사업자등록증', '임대사업자등록증', '토지이용계획서']) assert.ok(!hit(l), l);
});

test('조사 결과 안내(note·conf)와 explain — 서류 화면의 “버튼이 없는 이유”', () => {
  const g = c('주민등록등본'); assert.match(g.note, /대리 불가/); assert.equal(g.conf, '높음');
  assert.match(c('법인등기사항증명서').note, /1,000원/); assert.equal(C.AGENCIES.iros.reviewAfter, '2026-11-23');
  assert.match(c('특허증').note, /수수료/); assert.equal(c('특허증').paid, true);
  assert.equal(c('범죄경력조회회보서').conf, '미조사');
  const named = C.RULES.filter((r) => r.kind === 'agency' && !r.note).map((r) => r.id);
  assert.ok(named.length <= 3, '기관 규칙은 거의 모두 안내가 있다: ' + named.join(','));
  const e1 = C.explain('재직증명서'); assert.equal(e1.reason, 'THIRD_PARTY'); assert.match(e1.text, /소속 회사/);
  assert.match(C.explain('입원기록지').text, /병원/); assert.match(C.explain('위임장').text, /직접 작성/);
  assert.match(C.explain('사업자등록증사본').note, /재발급/); assert.equal(C.explain('사업자등록증사본').text, '');
  assert.match(C.explain('변경사실을증명하는서류').text, /도우미에게 물어보세요/);
  assert.equal(C.explain('아주특이한서류이름'), null, '규칙이 없으면 null(도우미 AI 가 판단)');
});
