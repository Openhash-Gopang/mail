/**
 * tests/myforms.test.mjs — myforms.js(내 서류함 양식 편집기)의 순수 로직 + 화면 연결 확인(DOM 없음).
 * 실행: node --test tests/myforms.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { _pure: M } = require('../myforms.js');

test('처음부터: 빈 양식 → 이름·항목이 없으면 저장할 수 없고, 채우면 저장용 JSON 이 된다', () => {
  const f = M.blank();
  assert.ok(M.isEmpty(f));
  assert.match(M.problem(f), /양식 이름/);
  f.title = ' 사무실  임대차 점검표 ';
  assert.match(M.problem(f), /항목을 한 개 이상/);
  f.sections[0].f.push({ l: '신청인 성명', t: 'short', h: '', req: true }, { l: '보증금', t: 'amount', u: '원', h: '월 기준 아님' }, { l: '', t: 'short' });
  assert.equal(M.problem(f), '');
  const st = M.toStored(f);
  assert.equal(st.title, '사무실 임대차 점검표');
  assert.deepEqual(st.sections[0].f.map((x) => x.l), ['신청인 성명', '보증금'], '이름 없는 항목은 버린다');
  assert.equal(st.sections[0].f[0].req, 1); assert.equal(st.sections[0].f[1].u, '원');
});

test('선택 종류: 선택지가 2개 미만이면 짧은 글로 낮추고, 2개 이상이면 선택지를 보존한다', () => {
  const f = M.blank(); f.title = 'x';
  f.sections[0].f.push({ l: '구분', t: 'select', oText: '신규' }, { l: '유형', t: 'select', oText: '신규 / 갱신, 해지' });
  const st = M.toStored(f);
  assert.equal(st.sections[0].f[0].t, 'short');
  assert.deepEqual(st.sections[0].f[1].o, ['신규', '갱신', '해지']);
});

test('같은 이름의 항목이 둘이면 알려 준다', () => {
  const f = M.blank(); f.title = 'x'; f.sections[0].f.push({ l: '성명', t: 'short' }, { l: '성명', t: 'long' });
  assert.match(M.problem(f), /두 번/);
});

test('AI·저장된 양식 → 편집 상태 → 다시 저장해도 같다(고쳐 쓰기)', () => {
  const ai = { title: '회비 면제 신청서', sections: [{ h: '신청인', f: [{ l: '성명', t: 'short', h: '', req: 1 }, { l: '구분', t: 'select', o: ['개인', '단체'], h: '' }] }, { h: '사유', f: [{ l: '면제 사유', t: 'long', h: '자세히' }] }], attach: ['증빙서류'] };
  const ed = M.fromStored(ai);
  assert.equal(ed.sections[0].f[1].oText, '개인 / 단체');
  assert.equal(ed.sections[0].f[0].req, true);
  ed.sections[1].f.push({ l: '신청일', t: 'date', h: '' });
  assert.equal(M.toStored(ed).sections[1].f.length, 2);
  assert.deepEqual(M.toStored(M.fromStored(ai)), { ...ai, sections: ai.sections.map((s) => ({ ...s, f: s.f.map((x) => ({ ...x })) })) });
});

test('위·아래 이동은 범위를 벗어나지 않는다', () => {
  const a = [1, 2, 3];
  assert.equal(M.move(a, 0, -1), false); assert.equal(M.move(a, 2, 1), false);
  assert.equal(M.move(a, 0, 1), true); assert.deepEqual(a, [2, 1, 3]);
});

test('한도: 묶음 12 · 항목 80 · 첨부 12', () => {
  const f = M.blank(); f.title = 't'; f.sections = [];
  for (let i = 0; i < 15; i++) f.sections.push({ h: 's' + i, f: Array.from({ length: 10 }, (_, j) => ({ l: 'a' + i + '_' + j, t: 'short' })) });
  f.attach = Array.from({ length: 20 }, (_, i) => 'x' + i);
  const st = M.toStored(f);
  assert.equal(st.sections.length <= 12, true);
  assert.equal(M.count(st) <= 80, true);
  assert.equal(st.attach.length, 12);
});

test('화면 연결: AI 는 navi-form-ai 로 부탁하고, 편집기는 처음부터·파일·AI 세 길을 모두 낸다', () => {
  const js = readFileSync(new URL('../myforms.js', import.meta.url), 'utf8');
  assert.match(js, /type: 'navi-form-ai'/);
  assert.match(js, /navi-form-ai-result/);
  assert.match(js, /data-a="scratch"/); assert.match(js, /data-a="file"/); assert.match(js, /data-a="aistart"/);
  assert.match(js, /box: 'mine'/);
  assert.match(js, /AI 변경 되돌리기/);
  assert.match(js, /mx-sw/, '필수 스위치');
});
