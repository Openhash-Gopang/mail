import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Q = require('../qna-ui.js')._pure;
const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
test('ownerToken: 처음 한 번 만들고 이후 같은 값, 형식 검사', () => {
  const s = mem(); const rnd = (b) => b.forEach((_, i) => { b[i] = i * 7 + 3; });
  const a = Q.ownerToken(s, rnd); assert.match(a, /^[A-Za-z0-9_-]{16,64}$/); assert.equal(Q.ownerToken(s, rnd), a);
  s.setItem('navi_qna_owner', 'bad token!'); assert.notEqual(Q.ownerToken(s, rnd), 'bad token!');
});
test('baseUrl: naviweb.kr 은 같은 출처, 그 밖은 절대 주소', () => {
  assert.equal(Q.baseUrl({ hostname: 'naviweb.kr' }), '/api/qna'); assert.equal(Q.baseUrl({ hostname: 'mail.hondi.net' }), 'https://naviweb.kr/api/qna');
});
test('makeApi: 헤더·경로·본문, 네트워크 오류는 예외 없이 {ok:false}', async () => {
  const calls = []; const f = async (u, o) => { calls.push([u, o]); return { json: async () => ({ ok: true }) }; };
  const api = Q.makeApi('/api/qna', 'TOK', f);
  await api.ask('질문'); await api.escalate('q1', '메모'); await api.comment('q1', '댓글'); await api.mine(); await api.pub();
  assert.equal(calls[0][0], '/api/qna/threads'); assert.equal(calls[0][1].headers['X-Qna-Owner'], 'TOK'); assert.deepEqual(JSON.parse(calls[0][1].body), { text: '질문' });
  assert.equal(calls[1][0], '/api/qna/threads/q1/escalate'); assert.equal(calls[2][0], '/api/qna/threads/q1/comments'); assert.equal(calls[3][0], '/api/qna/threads/mine'); assert.equal(calls[4][0], '/api/qna/public');
  const bad = Q.makeApi('/x', 'T', async () => { throw new Error('offline'); }); assert.deepEqual(await bad.mine(), { ok: false, error: 'network' });
});
const T = (o) => Object.assign({ id: 'q1', title: '제목', status: 'sp_answered', vis: 'private', mine: true, canEscalate: true, spStatus: 'ok', msgs: [{ id: 'm1', role: 'user', text: '질문', at: '2026-11-06T04:00:00Z' }, { id: 'm2', role: 'sp', text: '답', at: '2026-11-06T04:00:01Z' }] }, o);
test('threadHtml: 도우미가 답한 뒤에만 "관리자에게 질의" 버튼, 접수 후에는 안내만', () => {
  assert.ok(Q.threadHtml(T()).includes('data-act="esc-open"'));
  assert.ok(!Q.threadHtml(T({ canEscalate: false })).includes('data-act="esc-open"'));
  const e = Q.threadHtml(T({ status: 'escalated', canEscalate: false })); assert.ok(e.includes('접수되었습니다')); assert.ok(!e.includes('esc-open'));
  assert.ok(Q.threadHtml(T(), { note: true }).includes('data-act="esc-send"'));
  assert.ok(Q.threadHtml(T({ spStatus: 'unavailable', msgs: [T().msgs[0]] })).includes('자동 답변을 받을 수 없습니다'));
});
test('threadHtml: 남의 공개 글은 댓글 입력, 비공개·남의 글에는 질의 버튼 없음, 글은 이스케이프', () => {
  const pub = Q.threadHtml(T({ mine: false, canEscalate: false, vis: 'public', status: 'answered' })); assert.ok(pub.includes('data-act="comment"')); assert.ok(!pub.includes('esc-open')); assert.ok(!pub.includes('data-act="say"'));
  const x = Q.threadHtml(T({ title: '<img src=x onerror=alert(1)>', msgs: [{ id: 'a', role: 'user', text: '<script>alert(1)</script>', at: 'x' }] }));
  assert.ok(!/<img|<script/.test(x)); assert.ok(x.includes('&lt;script&gt;'));
});
test('listHtml: 빈 목록 안내와 행', () => {
  assert.ok(Q.listHtml([], 'mine').includes('질문하기')); assert.ok(Q.listHtml([{ id: 'a', title: 't', status: 'escalated', updated: '2026-11-06T04:00:00Z' }], 'mine').includes('관리자 확인 중'));
  assert.ok(!Q.listHtml([{ id: 'a', title: 't', status: 'answered', updated: '2026-11-06T04:00:00Z' }], 'pub').includes('qn-st'));
});
test('연결: guide.js 탭(사용법 강의 | 질문·답변), desktop.html 스크립트 순서, admin.html 사용법 질의 섹션', () => {
  const g = read('guide.js'); assert.ok(g.includes('data-m="qna"')); assert.ok(g.includes("S.mode === 'qna'")); assert.ok(g.includes('QnaUI.mount'));
  const d = read('desktop.html'); assert.ok(d.indexOf('qna-ui.js') > 0 && d.indexOf('qna-ui.js') < d.indexOf('guide.js?v='));
  const a = read('admin.html'); assert.ok(a.includes('id="qna"') && a.includes('사용법 질의')); assert.ok(a.includes('#qna=')); assert.ok(a.includes('Bearer')); assert.ok(a.includes('[hidden]{display:none}'));
  assert.ok(!a.includes("ADMIN_TOKEN'") || a.includes('sessionStorage'));   // 토큰은 sessionStorage 에만 둔다
});
