import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { parse, digest, report } from '../scripts/feedback-digest.mjs';
const FB = createRequire(import.meta.url)('../feedback-kit.js');
const html = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };

test('제보 본문: 개인정보로 보이는 것은 지우고, 종류별 말머리·분류를 붙인다', () => {
  const b = FB.build('attach', { label: '가족관계증명서', problem: 'agency', right: '대법원 전자가족관계등록시스템', text: '010-1234-5678 로 연락 주세요 a@b.com 900101-1234567' }, { doc: '이혼 소장', rule: 'family', ext: '0.6.2' });
  assert.match(b.raw_text, /^\[naviweb:attach\] 서류=가족관계증명서 \| 문제=agency \| 올바른기관=대법원/);
  assert.ok(!/010-1234|a@b\.com|900101/.test(b.raw_text), '전화·이메일·주민번호는 보내지 않는다');
  assert.equal(b.category, 'bug'); assert.equal(b.guid, null); assert.equal(b.context_sp, 'naviweb-feedback');
  assert.match(b.context_summary, /doc=이혼 소장; rule=family; ext=0\.6\.2/);
  assert.equal(FB.build('attach', { label: 'x', problem: 'missing' }).category, 'feature_request');
  assert.equal(FB.build('newdoc', { label: '지급명령 신청서', use: '법원' }).category, 'feature_request');
});
test('제보 본문: 필수 항목이 없으면 만들지 않는다', () => {
  assert.equal(FB.build('attach', { label: '', problem: 'fail' }), null);
  assert.equal(FB.build('attach', { label: '서류' }), null, '문제 선택 필수');
  assert.equal(FB.build('newdoc', { label: '' }), null);
  assert.equal(FB.build('bug', { text: '  ' }), null);
  assert.equal(FB.build('nope', { text: 'x' }), null);
});
test('제보 보내기: 혼디 제보 창구로 보내고, 하루 한도를 넘으면 보내지 않는다', async () => {
  const sent = [], store = mem(), fetch = async (u, o) => { sent.push([u, JSON.parse(o.body)]); return { ok: true }; };
  const r = await FB.send('bug', { text: '화면이 멈춰요' }, {}, { fetch, store });
  assert.deepEqual(r, { ok: true, code: 'sent' });
  assert.match(sent[0][0], /\/user-feedback\/submit$/); assert.match(sent[0][1].raw_text, /^\[naviweb:bug\] 내용=화면이 멈춰요/);
  for (let i = 1; i < FB.DAILY_LIMIT; i++) await FB.send('bug', { text: 'n' + i }, {}, { fetch, store });
  assert.equal((await FB.send('bug', { text: '또' }, {}, { fetch, store })).code, 'limit');
  assert.equal(sent.length, FB.DAILY_LIMIT);
  assert.equal((await FB.send('bug', { text: 'x' }, {}, { fetch: async () => ({ ok: false }), store: mem() })).code, 'fail');
  assert.equal((await FB.send('bug', { text: 'x' }, {}, { fetch: async () => { throw new Error('net'); }, store: mem() })).code, 'fail');
  assert.equal((await FB.send('bug', { text: '' }, {}, { fetch, store: mem() })).code, 'invalid');
});
test('대화창 명령: "신고:"·"서류 요청:"·"제안:" 은 제보로 가고 그 밖의 말은 그대로 AI 로', () => {
  assert.deepEqual(FB.fromChat('신고: 로그인 창이 안 떠요'), { kind: 'bug', text: '로그인 창이 안 떠요' });
  assert.deepEqual(FB.fromChat('서류 요청：지급명령 신청서'), { kind: 'newdoc', text: '지급명령 신청서' });
  assert.equal(FB.fromChat('제안: 다크 모드').kind, 'idea');
  assert.equal(FB.fromChat('가족관계증명서 가져와 주세요'), null);
  assert.equal(FB.fromChat('신고하려면 어떻게 하나요?'), null);
});
test('나비웹 화면 연결: 서류 요청·문제 알리기 버튼, 첨부서류 ⚑ 신호, 가져오기 실패 안내, 대화창 명령', () => {
  assert.match(html, /<script src="feedback-kit\.js\?v=\d+"><\/script>/);
  assert.match(html, /_fbOpen\('newdoc'\)/); assert.match(html, /_fbOpen\('bug'\)/);
  assert.match(html, /d\.type === 'navi-doc-report'\) \{[^\n]*\n\s*_fbOpen\('attach'/);
  assert.match(html, /s\.state === 'failed'\) _embedNote\(true, [^\n]*⚑/);
  assert.match(html, /NaviFeedback\.fromChat\(text\)/);
  assert.ok(html.indexOf('NaviFeedback.fromChat(text)') < html.indexOf("if (_embedBusy) { reply('앞의 요청을"), '진행 중 처리보다 먼저 가로챈다');
});
test('제보 집계: 같은 서류·문제를 서로 다른 사람이 min 명 이상 보내면 조치 후보, 같은 사람의 중복은 1명', () => {
  const rec = (g, raw) => ({ id: Math.random().toString(36).slice(2), guid: g, raw_text: raw });
  const a = '[naviweb:attach] 서류=재직증명서 | 문제=own | 올바른기관=회사';
  const items = [rec('u1', a), rec('u1', a), rec('u2', a), rec('u3', a),
    rec('u1', '[naviweb:attach] 서류=가족 관계 증명서 | 문제=fail'), rec('u4', '[naviweb:attach] 서류=가족관계증명서 | 문제=fail'),
    rec('u1', '[naviweb:newdoc] 서류=지급명령 신청서 | 용도=법원'), rec('u2', '[naviweb:newdoc] 서류=지급명령신청서'), rec('u3', '[naviweb:newdoc] 서류=지급명령 신청서'),
    rec('u9', '[naviweb:bug] 내용=화면이 멈춰요'), rec('u9', '다른 종류의 제보')];
  const d = digest({ items }, { min: 3 });
  const own = d.attach.find((g) => g.problem === 'own'); assert.equal(own.n, 3); assert.equal(own.action, true);
  const fail = d.attach.find((g) => g.problem === 'fail'); assert.equal(fail.n, 2, '띄어쓰기만 다른 이름은 같은 서류'); assert.equal(fail.action, false);
  assert.equal(d.newdoc[0].n, 3); assert.equal(d.newdoc[0].action, true);
  assert.equal(d.bugs.length, 1);
  const md = report(d);
  assert.match(md, /\*\*\[조치\]\*\* 재직증명서 — 직접 준비 서류예요 · 3명 · 현재 분류: thirdparty\/employer · 제안 기관: 회사/);
  assert.match(md, /\*\*\[추가\]\*\* 지급명령 신청서 · 3명/);
  assert.equal(parse('일반 글'), null);
});

test('제보 보내기: 기기 표식(dev)을 붙이고, 집계는 같은 기기의 중복을 1명으로 센다', async () => {
  const sent = [], store = mem(), fetch = async (u, o) => { sent.push(JSON.parse(o.body)); return { ok: true }; };
  await FB.send('attach', { label: '가족관계증명서', problem: 'agency' }, {}, { fetch, store });
  await FB.send('attach', { label: '가족관계증명서', problem: 'agency' }, {}, { fetch, store });
  const d0 = /dev=([^;]+)/.exec(sent[0].context_summary)[1];
  assert.equal(d0, /dev=([^;]+)/.exec(sent[1].context_summary)[1], '같은 기기는 같은 표식');
  assert.ok(d0.length >= 8);
  const recs = sent.map((b, i) => ({ id: 'r' + i, guid: null, raw_text: b.raw_text, context_summary: b.context_summary }));
  assert.equal(digest(recs, { min: 2 }).attach[0].n, 1);
});
test('도우미 AI 직접 제보: 호스트가 [FEEDBACK] 메시지를 받아 미리 채운 제보 창을 연다', () => {
  assert.match(html, /d\.type === 'hondi-embed-feedback'/);
  assert.match(html, /\[FEEDBACK: kind=<attach\|newdoc\|bug>/);
  assert.match(html, /function _fbOpen\(kind, label, text, pre\)/);
});
