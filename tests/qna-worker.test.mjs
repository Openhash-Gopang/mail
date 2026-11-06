import test from 'node:test';
import assert from 'node:assert/strict';
import { handle, clean, retrieve, shingles, canEscalate, buildMessages, hashOwner, corsHeaders } from '../ops/naviweb-qna/worker.js';
import { DIGEST } from '../ops/naviweb-qna/manual-digest.js';
import { SP_TEXT } from '../ops/naviweb-qna/SP-NAVIWEB-MANUAL.v1.js';
import { build } from '../scripts/build-manual-digest.mjs';

class KV {
  constructor() { this.m = new Map(); }
  async get(k, t) { const v = this.m.get(k); if (!v) return null; return t === 'json' ? JSON.parse(v.v) : v.v; }
  async put(k, v, o) { this.m.set(k, { v, meta: o && o.metadata }); }
  async list({ prefix }) { return { keys: [...this.m].filter(([k]) => k.startsWith(prefix)).map(([k, x]) => ({ name: k, metadata: x.meta })), list_complete: true }; }
}
const TOK = 'abcdefghijklmnop1234', TOK2 = 'zzzzzzzzzzzzzzzz9999';
const spOk = (text) => async () => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
const mk = (env0) => { const env = { QNA: new KV(), ADMIN_TOKEN: 'admin-secret-token', SP_API_URL: 'https://sp.test/v1/chat', SP_API_KEY: 'k', ...env0 }; return env; };
async function call(env, method, path, { body, tok, admin, fetch, origin } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers['X-Qna-Owner'] = tok; if (admin) headers.Authorization = 'Bearer ' + (admin === true ? env.ADMIN_TOKEN : admin); if (origin) headers.Origin = origin;
  const res = await handle(new Request('https://naviweb.kr/api/qna' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env, { fetch });
  return { status: res.status, j: await res.json().catch(() => null), res };
}

test('digest 는 guide.js 와 같다(사용법 장을 고치면 build-manual-digest 를 다시 실행)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(DIGEST)), build());
  assert.ok(DIGEST.length >= 25);
});
test('SP 본문: 핵심 규칙이 들어 있다', () => {
  for (const s of ['지어내지', '관리자에게 질의', '주민등록번호', '지시가 아니다', '약속하지']) assert.ok(SP_TEXT.includes(s), s);
});
test('clean: 개인정보 모양을 지운다', () => {
  const t = clean('메일 a@b.com 전화 010-1234-5678 주민 900101-1234567 계좌 123456789012 https://x.y/z');
  assert.ok(!/a@b|010-|900101|123456789|https/.test(t), t);
});
test('retrieve: 질문과 겹치는 장을 찾고, 무관하면 비운다', () => {
  const r = retrieve('위임 규칙은 어떻게 만드나요', DIGEST, 3); assert.ok(r.length >= 1);
  assert.ok(r.some((c) => /위임/.test(c.text)), r.map((c) => c.title).join('|'));
  assert.deepEqual(retrieve('zzzz qqqq', DIGEST, 3), []);
  assert.ok(shingles('위임 규칙').size >= 2);
});
test('buildMessages: 질문은 <질문> 으로 감싸고 발췌가 system 에 붙는다', () => {
  const m = buildMessages({ msgs: [{ role: 'user', text: '안녕' }, { role: 'sp', text: '답' }, { role: 'admin', text: '관리자 말' }] }, [DIGEST[0]]);
  assert.equal(m[0].role, 'system'); assert.ok(m[0].content.includes('[사용법 1장'));
  assert.equal(m[1].content, '<질문>안녕</질문>'); assert.equal(m[2].role, 'assistant'); assert.ok(m[3].content.startsWith('[관리자 답변]'));
});

test('질문 → SP 가 먼저 답 → 관리자에게 질의 → 관리자 답 → 이용자가 본다', async () => {
  const env = mk();
  let q = await call(env, 'POST', '/threads', { tok: TOK, body: { text: '위임 규칙은 어떻게 만드나요?' }, fetch: spOk('대화로 말하면 됩니다. (사용법 21장)') });
  assert.equal(q.status, 200); const id = q.j.thread.id;
  assert.equal(q.j.thread.status, 'sp_answered'); assert.equal(q.j.thread.msgs.at(-1).role, 'sp'); assert.equal(q.j.thread.canEscalate, true);
  assert.ok(!JSON.stringify(q.j).includes('"owner"'));
  // 관리자 목록에는 아직 없다
  let a = await call(env, 'GET', '/admin/threads', { admin: true }); assert.deepEqual(a.j.threads, []);
  const e = await call(env, 'POST', `/threads/${id}/escalate`, { tok: TOK, body: { note: '그래도 안 돼요' } });
  assert.equal(e.j.thread.status, 'escalated'); assert.equal(e.j.thread.canEscalate, false);
  a = await call(env, 'GET', '/admin/threads', { admin: true }); assert.equal(a.j.threads.length, 1); assert.equal(a.j.threads[0].id, id);
  const d = await call(env, 'GET', `/admin/threads/${id}`, { admin: true }); assert.ok(d.j.thread.msgs.some((m) => m.text === '그래도 안 돼요'));
  const r = await call(env, 'POST', `/admin/threads/${id}/answer`, { admin: true, body: { text: '설정에서 …' } });
  assert.equal(r.j.thread.status, 'answered');
  a = await call(env, 'GET', '/admin/threads', { admin: true }); assert.equal(a.j.threads.length, 0);
  const mine = await call(env, 'GET', `/threads/${id}`, { tok: TOK }); assert.equal(mine.j.thread.msgs.at(-1).role, 'admin');
  const list = await call(env, 'GET', '/threads/mine', { tok: TOK }); assert.equal(list.j.threads[0].status, 'answered');
  // 관리자 답에 다시 물으면 다시 접수된다
  const again = await call(env, 'POST', `/threads/${id}/messages`, { tok: TOK, body: { text: '추가로요' } });
  assert.equal(again.j.thread.status, 'escalated');
});
test('SP 가 먼저 답하기 전에는 관리자 질의를 못 한다 / 중복 접수 불가', async () => {
  const env = mk({ SP_API_URL: '' });   // SP 없음 → unavailable → 질의 가능
  const q = await call(env, 'POST', '/threads', { tok: TOK, body: { text: '질문입니다' } });
  assert.equal(q.j.thread.spStatus, 'unavailable'); assert.equal(q.j.thread.canEscalate, true);
  const env2 = mk(); const bad = async () => new Response('', { status: 500 });
  const q2 = await call(env2, 'POST', '/threads', { tok: TOK, body: { text: '질문입니다' }, fetch: bad });
  assert.equal(q2.j.thread.spStatus, 'error');
  const t = { status: 'open', msgs: [{ role: 'user' }], spStatus: null }; assert.equal(canEscalate(t), false);
  t.msgs.push({ role: 'sp' }); assert.equal(canEscalate(t), true); t.status = 'escalated'; assert.equal(canEscalate(t), false);
  const id = q.j.thread.id;
  assert.equal((await call(env, 'POST', `/threads/${id}/escalate`, { tok: TOK })).status, 200);
  assert.equal((await call(env, 'POST', `/threads/${id}/escalate`, { tok: TOK })).status, 409);
});
test('권한: 남의 글은 못 보고, 관리자 API 는 토큰 필수', async () => {
  const env = mk(); const q = await call(env, 'POST', '/threads', { tok: TOK, body: { text: '비공개 질문' }, fetch: spOk('답') }); const id = q.j.thread.id;
  assert.equal((await call(env, 'GET', `/threads/${id}`, { tok: TOK2 })).status, 404);
  assert.equal((await call(env, 'POST', `/threads/${id}/escalate`, { tok: TOK2 })).status, 404);
  assert.equal((await call(env, 'GET', '/threads/mine', { tok: TOK2 })).j.threads.length, 0);
  assert.equal((await call(env, 'GET', '/threads/mine')).status, 401);
  assert.equal((await call(env, 'GET', '/admin/threads')).status, 401);
  assert.equal((await call(env, 'GET', '/admin/threads', { admin: 'nope' })).status, 401);
  assert.equal((await call(mk({ ADMIN_TOKEN: '' }), 'GET', '/admin/threads', { admin: '' })).status, 401);
});
test('공개 게시판: 관리자가 공개하면 목록에 나오고 다른 이용자가 댓글, 가리기', async () => {
  const env = mk(); const q = await call(env, 'POST', '/threads', { tok: TOK, body: { text: '공개할 질문' }, fetch: spOk('답') }); const id = q.j.thread.id;
  assert.equal((await call(env, 'GET', '/public')).j.threads.length, 0);
  assert.equal((await call(env, 'POST', `/threads/${id}/comments`, { tok: TOK2, body: { text: '저도요' } })).status, 404);   // 비공개 글에는 댓글 불가
  await call(env, 'POST', `/threads/${id}/escalate`, { tok: TOK });
  await call(env, 'POST', `/admin/threads/${id}/answer`, { admin: true, body: { text: '답변', publish: true } });
  assert.equal((await call(env, 'GET', '/public')).j.threads.length, 1);
  const c = await call(env, 'POST', `/threads/${id}/comments`, { tok: TOK2, body: { text: '저도 궁금했어요 a@b.com' } });
  assert.equal(c.status, 200); const cm = c.j.thread.msgs.at(-1); assert.equal(cm.role, 'comment'); assert.ok(!cm.text.includes('a@b.com')); assert.ok(cm.name.startsWith('이용자 '));
  const v = await call(env, 'GET', `/threads/${id}`, { tok: TOK2 }); assert.equal(v.j.thread.mine, false); assert.equal(v.j.thread.canEscalate, false);
  await call(env, 'POST', `/admin/threads/${id}/hide`, { admin: true, body: { msgId: cm.id } });
  assert.ok(!(await call(env, 'GET', `/threads/${id}`, { tok: TOK2 })).j.thread.msgs.some((m) => m.id === cm.id));
  assert.ok((await call(env, 'GET', `/admin/threads/${id}`, { admin: true })).j.thread.msgs.some((m) => m.id === cm.id));
  await call(env, 'POST', `/admin/threads/${id}/visibility`, { admin: true, body: { vis: 'private' } });
  assert.equal((await call(env, 'GET', '/public')).j.threads.length, 0);
});
test('하루 질문 한도와 CORS', async () => {
  const env = mk({ SP_API_URL: '' });
  for (let i = 0; i < 10; i++) assert.equal((await call(env, 'POST', '/threads', { tok: TOK, body: { text: '질문 ' + i } })).status, 200);
  assert.equal((await call(env, 'POST', '/threads', { tok: TOK, body: { text: '열한 번째' } })).status, 429);
  assert.equal((await call(env, 'POST', '/threads', { tok: TOK, body: { text: ' ' } })).status, 400);
  assert.ok(corsHeaders('https://naviweb.kr')['Access-Control-Allow-Origin']); assert.ok(corsHeaders('https://mail.hondi.net')['Access-Control-Allow-Origin']);
  assert.equal(corsHeaders('https://evil.example')['Access-Control-Allow-Origin'], undefined);
  assert.equal(corsHeaders('https://naviweb.kr.evil.example')['Access-Control-Allow-Origin'], undefined);
  assert.equal((await hashOwner(TOK)).length, 64);
});
