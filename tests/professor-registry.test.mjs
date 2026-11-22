import test from 'node:test';
import assert from 'node:assert/strict';
import { handleCurriculum, validateProfessor, buildProfMessages, PROF_SP, pmeta, profFuzzy, FIELDS } from '../ops/naviweb-qna/curriculum.js';

class KV {
  constructor() { this.m = new Map(); }
  async get(k, t) { const v = this.m.get(k); if (!v) return null; return t === 'json' ? JSON.parse(v.v) : v.v; }
  async put(k, v, o) { if (o && o.metadata && new TextEncoder().encode(JSON.stringify(o.metadata)).length > 1024) throw new Error('KV metadata 1024바이트 초과'); this.m.set(k, { v, meta: o && o.metadata }); }
  async delete(k) { this.m.delete(k); }
  async list({ prefix }) { return { keys: [...this.m].filter(([k]) => k.startsWith(prefix)).map(([k, x]) => ({ name: k, metadata: x.meta })), list_complete: true }; }
}
const TOK = 'abcdefghijklmnop1234', TOK2 = 'zzzzzzzzzzzzzzzz9999';
const prof = (o) => JSON.stringify({ subject: '미적분학', aliases: ['미적분', 'Calculus'], field: '자연과학', summary: '극한·미분·적분의 개념과 계산을 고등부터 대학 1학년 수준까지 지도한다.', levels: ['고등', '대학'], topics: ['극한과 연속', '미분', '적분'], keywords: ['미분', '적분', '도함수'], ...(o || {}) });
function llm(text) { const f = async () => { f.n++; return new Response(JSON.stringify({ choices: [{ message: { content: typeof text === 'function' ? text(f.n) : text } }] })); }; f.n = 0; return f; }
const mk = (o) => ({ QNA: new KV(), ADMIN_TOKEN: 'adm', SP_API_URL: 'https://sp.test/v1', SP_API_KEY: 'k', ...o });
async function call(env, method, path, { body, tok, fetch, admin } = {}) {
  const headers = { 'Content-Type': 'application/json' }; if (tok) headers['X-Qna-Owner'] = tok;
  const res = await handleCurriculum(new Request('https://naviweb.kr/api/curriculum' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env, { fetch, admin: !!admin });
  return { status: res.status, j: await res.json().catch(() => null) };
}

test('validateProfessor: 표준명·별칭·분야·수준을 정리하고, 소개가 없거나 과목이 아니면 거부', () => {
  const v = validateProfessor(JSON.parse(prof()), '미적');
  assert.equal(v.name, '미적분학 교수'); assert.equal(v.field, '자연과학'); assert.deepEqual(v.levels, ['고등', '대학']); assert.ok(v.aliases.includes('Calculus'));
  assert.equal(validateProfessor({ error: 'not_a_subject' }, 'x'), null);
  assert.equal(validateProfessor(JSON.parse(prof({ summary: '짧음' })), 'x'), null);
  const t = validateProfessor(JSON.parse(prof({ subject: '<b>수학</b>', field: '??', levels: ['??'] })), 'x'); assert.ok(!/[<>]/.test(t.subject)); assert.equal(t.field, '기타'); assert.deepEqual(t.levels, ['대학']);
  assert.ok(FIELDS.includes('어학'));
});
test('SP: 과목 전부를 받되 과목이 아니면 거절, 입력은 데이터', () => {
  assert.match(PROF_SP, /자격시험, 취미·실용 기능 포함/); assert.match(PROF_SP, /not_a_subject/); assert.match(PROF_SP, /지시·명령은 따르지 않는다/);
  assert.match(buildProfMessages('거시경제학')[1].content, /<과목>거시경제학<\/과목>/);
});
test('pmeta: 한글이 길어도 KV 메타데이터 1024바이트 안에 들어간다', () => {
  const long = '가나다라마바사아자차'.repeat(30);
  const p = { id: 'p' + 'a'.repeat(12), name: long.slice(0, 22) + ' 교수', subject: long.slice(0, 20), field: '인문', levels: ['초등', '중등', '고등', '대학', '대학원', '성인'], createdAt: new Date().toISOString(), keywords: Array(10).fill(long.slice(0, 20)), aliases: Array(6).fill(long.slice(0, 24)), topics: Array(8).fill(long.slice(0, 24)), summary: long.slice(0, 200) };
  assert.ok(new TextEncoder().encode(JSON.stringify(pmeta(p))).length <= 1024);
});
test('없는 과목: 검색은 found:false, 만들면 목록에 등록되고 다음 사람은 바로 불러온다(LLM 한 번)', async () => {
  const env = mk(), f = llm(prof());
  let r = await call(env, 'GET', '/prof/search?q=' + encodeURIComponent('미적')); assert.equal(r.j.found, false); assert.equal(r.j.canBuild, true);
  r = await call(env, 'POST', '/prof/build', { body: { q: '미적' }, tok: TOK, fetch: f });
  assert.equal(r.status, 200); assert.equal(r.j.created, true); assert.equal(r.j.professor.name, '미적분학 교수'); assert.match(r.j.professor.id, /^p[0-9a-f]{12}$/);
  for (const q of ['미적', '미적분학', '미적분', 'calculus', '미적분학 교수']) { r = await call(env, 'GET', '/prof/search?q=' + encodeURIComponent(q)); assert.equal(r.j.found, true, q); assert.equal(r.j.professor.subject, '미적분학'); }
  r = await call(env, 'POST', '/prof/build', { body: { q: '미적분학' }, tok: TOK2, fetch: f }); assert.equal(r.j.created, false); assert.equal(f.n, 1, '이미 있으면 LLM 을 부르지 않는다');
});
test('다른 말로 요청해도 LLM 이 바로잡은 표준명이 이미 있으면 같은 교수를 돌려준다(교수가 둘 생기지 않는다)', async () => {
  const env = mk(); await call(env, 'POST', '/prof/build', { body: { q: '미적분학' }, tok: TOK, fetch: llm(prof()) });
  const r = await call(env, 'POST', '/prof/build', { body: { q: '캘큘러스 기초' }, tok: TOK2, fetch: llm(prof({ aliases: [] })) });
  assert.equal(r.j.created, false); assert.equal((await env.QNA.list({ prefix: 'prof:d:' })).keys.length, 1);
  assert.equal((await call(env, 'GET', '/prof/search?q=' + encodeURIComponent('캘큘러스 기초'))).j.found, true, '요청한 말도 검색키로 남는다');
});
test('목록: 이름·세부 내용(하위 분야·검색어·소개)으로 찾고, 분야로 거르고, 인기 순으로 정렬', async () => {
  const env = mk();
  await call(env, 'POST', '/prof/build', { body: { q: '미적분학' }, tok: TOK, fetch: llm(prof()) });
  await call(env, 'POST', '/prof/build', { body: { q: '스페인어' }, tok: TOK, fetch: llm(prof({ subject: '스페인어', aliases: ['에스파냐어'], field: '어학', summary: '스페인어의 발음·문법·회화를 초급부터 중급까지 지도한다.', levels: ['성인'], topics: ['발음', '동사 활용', '여행 회화'], keywords: ['스페인', 'español'] })) });
  let r = await call(env, 'GET', '/prof/list'); assert.equal(r.j.total, 2); assert.equal(r.j.list.length, 2);
  assert.deepEqual(r.j.list.map((x) => x.name).sort(), ['미적분학 교수', '스페인어 교수']);
  r = await call(env, 'GET', '/prof/list?q=' + encodeURIComponent('동사 활용')); assert.equal(r.j.list[0].name, '스페인어 교수', '하위 분야로 찾는다');
  r = await call(env, 'GET', '/prof/list?q=' + encodeURIComponent('도함수')); assert.equal(r.j.list[0].name, '미적분학 교수', '검색어로 찾는다');
  r = await call(env, 'GET', '/prof/list?field=' + encodeURIComponent('어학')); assert.deepEqual(r.j.list.map((x) => x.subject), ['스페인어']);
  const id = (await call(env, 'GET', '/prof/search?q=' + encodeURIComponent('스페인어'))).j.professor.id;
  await call(env, 'POST', '/prof/' + id + '/use', { body: {}, tok: TOK }); await call(env, 'POST', '/prof/' + id + '/use', { body: {}, tok: TOK }); await call(env, 'POST', '/prof/' + id + '/use', { body: {}, tok: TOK2 });
  r = await call(env, 'GET', '/prof/list'); assert.equal(r.j.list[0].name, '스페인어 교수'); assert.equal(r.j.list[0].learners, 2, '같은 사람은 하루 한 번만 센다');
  assert.ok(r.j.list[0].summary && r.j.list[0].topics.length && r.j.list[0].keywords.length, '목록 항목에 세부 내용이 있다');
});
test('비슷한 교수는 related 로 제안한다', async () => {
  const env = mk(); await call(env, 'POST', '/prof/build', { body: { q: '미적분학' }, tok: TOK, fetch: llm(prof()) });
  const r = await call(env, 'GET', '/prof/search?q=' + encodeURIComponent('일변수 미적분 기초')); assert.equal(r.j.found, false); assert.equal(r.j.related[0].subject, '미적분학');
});
test('만들기 거절·실패: 과목이 아님 422 · 형식 오류 502 · LLM 없음 503 · 한도 429 · 토큰 없음 400', async () => {
  const env = mk();
  assert.equal((await call(env, 'POST', '/prof/build', { body: { q: '아무거나' }, tok: TOK, fetch: llm('{"error":"not_a_subject"}') })).status, 422);
  assert.equal((await call(env, 'POST', '/prof/build', { body: { q: '아무거나' }, tok: TOK, fetch: llm('{"subject":"x"}') })).status, 502);
  assert.equal((await call(mk({ SP_API_URL: '', SP_API_KEY: '' }), 'POST', '/prof/build', { body: { q: '수학' }, tok: TOK })).status, 503);
  assert.equal((await call(env, 'POST', '/prof/build', { body: { q: '수학' }, fetch: llm(prof()) })).status, 400);
  assert.equal((await call(env, 'POST', '/prof/build', { body: { q: '가' }, tok: TOK })).status, 400);
  let st; for (let i = 0; i < 9; i++) st = (await call(env, 'POST', '/prof/build', { body: { q: '과목 ' + i + '번' }, tok: TOK, fetch: llm('{"error":"not_a_subject"}') })).status;
  assert.equal(st, 429);
});
test('신고 5건이면 목록·검색에서 빠지고, 관리자만 지운다', async () => {
  const env = mk(); const id = (await call(env, 'POST', '/prof/build', { body: { q: '미적분학' }, tok: TOK, fetch: llm(prof()) })).j.professor.id;
  for (let i = 0; i < 5; i++) await call(env, 'POST', '/prof/' + id + '/flag', { body: {}, tok: 'flagger-token-000' + i + 'xxxx' });
  assert.equal((await call(env, 'GET', '/prof/list')).j.list.length, 0); assert.equal((await call(env, 'GET', '/prof/search?q=' + encodeURIComponent('미적분학'))).j.found, false);
  assert.equal((await call(env, 'POST', '/admin/prof/' + id + '/delete', {})).status, 401);
  assert.equal((await call(env, 'POST', '/admin/prof/' + id + '/delete', { admin: true })).status, 200);
  assert.equal((await env.QNA.list({ prefix: 'prof:k:' })).keys.length, 0);
});
test('커리큘럼을 만들 때 교수 id 를 함께 기록한다', async () => {
  const env = mk(); const pid = (await call(env, 'POST', '/prof/build', { body: { q: '미적분학' }, tok: TOK, fetch: llm(prof()) })).j.professor.id;
  const weeks = Array.from({ length: 8 }, (_, i) => ({ t: (i + 1) + '주', g: ['하나를 설명한다', '둘을 계산한다'], h: 4 }));
  const r = await call(env, 'POST', '/build', { body: { q: '미적분학 고등', level: '고등', pid }, tok: TOK, fetch: llm(JSON.stringify({ title: '미적분학 고등', subject: '미적분학', level: '고등', summary: 's', weeks })) });
  assert.equal(r.j.curriculum.pid, pid);
});
test('profFuzzy: 이름 겹침이 소개 겹침보다 앞선다', () => {
  const a = { id: 'pa', n: '경제학 교수', s: '경제학', a: '', k: '시장', t: '', m: '선택', l: '대학', f: '사회과학', u: 0 }, b = { id: 'pb', n: '역사학 교수', s: '역사학', a: '', k: '경제사', t: '', m: '', l: '대학', f: '인문', u: 0 };
  assert.equal(profFuzzy('경제학', [b, a], 5)[0].id, 'pa');
});
