import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleCurriculum } from '../ops/naviweb-qna/curriculum.js';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../learn-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../learn.css', import.meta.url), 'utf8');

class KV {
  constructor() { this.m = new Map(); }
  async get(k, t) { const v = this.m.get(k); if (!v) return null; return t === 'json' ? JSON.parse(v.v) : v.v; }
  async put(k, v, o) { this.m.set(k, { v, meta: o && o.metadata }); }
  async delete(k) { this.m.delete(k); }
  async list({ prefix }) { return { keys: [...this.m].filter(([k]) => k.startsWith(prefix)).map(([k, x]) => ({ name: k, metadata: x.meta })), list_complete: true }; }
}
const weeks = (n) => Array.from({ length: n }, (_, i) => ({ t: (i + 1) + '주 주제', g: ['목표 하나를 설명한다', '목표 둘을 계산한다'], h: 4 }));
const PROFS = {
  '스페인어': { subject: '스페인어', aliases: ['에스파냐어'], field: '어학', summary: '스페인어의 발음·문법·회화를 초급부터 중급까지 지도한다.', levels: ['성인', '대학'], topics: ['발음', '동사 활용', '여행 회화'], keywords: ['스페인', 'español'] },
  '미적분학': { subject: '미적분학', aliases: ['미적분'], field: '자연과학', summary: '극한·미분·적분의 개념과 계산을 고등부터 대학 1학년 수준까지 지도한다.', levels: ['고등', '대학'], topics: ['극한', '미분', '적분'], keywords: ['도함수'] }
};
// 서버(워커)를 화면의 fetch 에 직접 이어 준다. LLM 만 가짜: 과목 이름을 보고 교수나 커리큘럼을 낸다.
function server(opt) {
  const env = { QNA: new KV(), SP_API_URL: opt && opt.noLLM ? '' : 'https://sp.test', SP_API_KEY: opt && opt.noLLM ? '' : 'k' }, calls = { prof: 0, cur: 0, urls: [] };
  const ext = async (url, init) => {
    const body = JSON.parse(init.body), sys = body.messages[0].content, user = body.messages[1].content;
    if (/교수 설계자/.test(sys)) { calls.prof++; const q = /<과목>(.*)<\/과목>/.exec(user)[1], k = Object.keys(PROFS).find((x) => q.includes(x)); return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(k ? PROFS[k] : { error: 'not_a_subject' }) } }] })); }
    if (/wikipedia\.org/.test(url)) return new Response(JSON.stringify({ query: { search: [] } }));
    calls.cur++; const q = /<과목>(.*)<\/과목>/.exec(user)[1];
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ title: q, subject: q.split(' ')[0], level: '대학', summary: '요약', hoursPerWeek: 4, weeks: weeks(10) }) } }] }));
  };
  const fetch = (u, init) => { calls.urls.push(u); return handleCurriculum(new Request('https://naviweb.kr' + u, init), env, { fetch: (u2, i2) => /wikipedia/.test(u2) ? new Response(JSON.stringify({ query: { search: [] } })) : ext(u2, i2) }); };
  return { env, calls, fetch };
}
function page(srv) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; w.fetch = srv.fetch; w.eval(app);
  const doc = w.document, asks = [];
  w.NaviLearn.on('ask', (t) => asks.push(t)); w.NaviLearn.mount(doc.getElementById('m'));
  const dlg = () => doc.getElementById('lrn-dlg').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  const until = async (re, ms) => { const t0 = Date.now(); while (!re.test(dlg())) { if (Date.now() - t0 > (ms || 3000)) throw new Error('기다리던 글이 없다: ' + re + '\n' + dlg().slice(0, 500)); await new Promise((r) => setTimeout(r, 10)); } };
  const find = async (q) => { const i = doc.getElementById('lrn-pf-in'); i.value = q; i.dispatchEvent(new w.Event('input', { bubbles: true })); btn('교수 찾기').click(); };
  const open = async (re) => { btn('+ 과목 추가').click(); await until(re || /AI 교수 목록/); };
  return { w, doc, asks, dlg, btn, until, find, open, stored: () => JSON.parse(w.localStorage.getItem('navi-learn-v1') || '{}') };
}

test('과목 추가 창: 고정 과목 칩 대신 검색창과 교수 목록이 나온다', { skip }, async () => {
  const p = page(server()); await p.open(/아직 등록된 교수가 없어요/);
  assert.ok(p.doc.getElementById('lrn-pf-in')); assert.match(p.dlg(), /어떤 과목이든 입력하세요/); assert.match(p.dlg(), /아직 등록된 교수가 없어요/);
  for (const k of ['인문', '사회과학', '자연과학', '어학', '직업·자격']) assert.ok(p.btn(k), k + ' 분야 거르개');
  assert.ok(!p.btn('코딩') && !p.btn('경제학'), '정해 둔 과목 칩은 없다');
});
test('목록에 없는 과목: 새 교수 만들기 → 목록에 올라가고 → 수업 시작으로 커리큘럼까지 만들어 추가', { skip }, async () => {
  const srv = server(), p = page(srv); await p.open();
  await p.find('스페인어'); await p.until(/아직 목록에 없어요/);
  p.btn('“스페인어” 교수 새로 만들기').click(); await p.until(/방금 새로 만들었어요/);
  assert.match(p.dlg(), /스페인어 교수/); assert.match(p.dlg(), /발음·문법·회화/); assert.match(p.dlg(), /동사 활용/); assert.match(p.dlg(), /español/); assert.match(p.dlg(), /한 명의 AI 교수가 모든 학습자를 동시에 지도/);
  assert.equal(srv.calls.prof, 1);
  assert.ok(p.btn('성인') && p.btn('대학') && !p.btn('초등'), '교수가 지도하는 수준만 고른다');
  p.btn('대학').click(); p.btn('수업 시작').click();
  const t0 = Date.now(); while (!p.stored().added || !p.stored().added.length) { if (Date.now() - t0 > 3000) throw new Error('과목이 추가되지 않았다'); await new Promise((r) => setTimeout(r, 10)); }
  const c = p.stored().added[0]; assert.equal(c.prof, '스페인어 교수'); assert.match(c.pid, /^p[0-9a-f]{12}$/); assert.equal(c.cur.w.length, 10); assert.equal(c.subj, '스페인어');
  assert.equal(p.doc.getElementById('lrn-ov').hidden, true); assert.equal(srv.calls.cur, 1);
  assert.equal((await srv.env.QNA.list({ prefix: 'prof:d:' })).keys.length, 1, '교수가 목록 DB 에 등록됐다');
});
test('이미 있는 교수: 다른 학습자는 검색하면 LLM 없이 바로 불러온다', { skip }, async () => {
  const srv = server(), a = page(srv); await a.open(); await a.find('스페인어'); await a.until(/아직 목록에 없어요/); a.btn('“스페인어” 교수 새로 만들기').click(); await a.until(/방금 새로 만들었어요/);
  const b = page(srv); await b.open(); await b.until(/스페인어 교수/);   // 목록에 이름과 세부 내용이 보인다
  assert.match(b.dlg(), /AI 교수 목록 · 1명/); assert.match(b.dlg(), /발음·문법·회화/); assert.match(b.dlg(), /어학/);
  await b.find('에스파냐어'); await b.until(/교수 목록에서 불러왔어요/); assert.match(b.dlg(), /스페인어 교수/);
  assert.equal(srv.calls.prof, 1, '두 번째 학습자는 교수를 다시 만들지 않는다');
});
test('목록에서 이름·세부 내용으로 찾고 분야로 거르고, 카드를 눌러 고른다', { skip }, async () => {
  const srv = server(); for (const q of ['스페인어', '미적분학']) { const r = await srv.fetch('/api/curriculum/prof/build', { method: 'POST', headers: { 'X-Qna-Owner': 'abcdefghijklmnop' + q.length, 'Content-Type': 'application/json' }, body: JSON.stringify({ q }) }); assert.equal((await r.json()).ok, true); }
  const p = page(srv); await p.open(); await p.until(/미적분학 교수/); assert.match(p.dlg(), /스페인어 교수/);
  p.btn('어학').click(); await p.until(/목록 · 1명/); assert.ok(!/미적분학 교수/.test(p.dlg()));
  p.btn('스페인어 교수').click(); assert.match(p.dlg(), /교수 선택/); assert.match(p.dlg(), /español/);
  p.btn('← 교수 목록').click(); assert.ok(p.doc.getElementById('lrn-pf-in'));
});
test('비슷한 교수 제안: 찾던 분이면 새로 만들지 않고 고른다', { skip }, async () => {
  const srv = server(); await srv.fetch('/api/curriculum/prof/build', { method: 'POST', headers: { 'X-Qna-Owner': 'abcdefghijklmnop1', 'Content-Type': 'application/json' }, body: JSON.stringify({ q: '미적분학' }) });
  const p = page(srv); await p.open(); await p.find('일변수 미적분 기초'); await p.until(/아직 목록에 없어요/);
  assert.match(p.dlg(), /비슷한 교수가 있어요/); p.btn('미적분학 교수').click(); await p.until(/교수 선택/); assert.match(p.dlg(), /극한/);
  assert.equal(srv.calls.prof, 1);
});
test('과목이 아니면 만들지 않고 안내한다', { skip }, async () => {
  const p = page(server()); await p.open(); await p.find('아무말'); await p.until(/아직 목록에 없어요/); p.btn('“아무말” 교수 새로 만들기').click(); await p.until(/학습 과목으로 보기 어려워요/);
});
test('서버에 LLM 이 없으면: 목록에서 고르거나 그냥 추가(교수와 상담)로 시작한다', { skip }, async () => {
  const p = page(server({ noLLM: true })); await p.open(); await p.find('스페인어'); await p.until(/아직 목록에 없어요/);
  assert.match(p.dlg(), /만드는 서버가 아직 준비되지 않았어요/); assert.ok(!p.btn('“스페인어” 교수 새로 만들기')); p.btn('그냥 추가').click();
  const c = p.stored().added[0]; assert.equal(c.subj, '스페인어'); assert.equal(c.prof, '스페인어 교수'); assert.equal(c.seq, ''); assert.match(p.asks.pop(), /스페인어 학습/);
});
test('같은 교수·수준을 다시 고르면 새로 만들지 않고 기존 수업을 연다', { skip }, async () => {
  const srv = server(), p = page(srv); await p.open(); await p.find('스페인어'); await p.until(/아직 목록에 없어요/); p.btn('“스페인어” 교수 새로 만들기').click(); await p.until(/방금 새로/);
  p.btn('성인').click(); p.btn('수업 시작').click(); const t0 = Date.now(); while (!p.stored().added) { if (Date.now() - t0 > 3000) throw new Error('추가 안 됨'); await new Promise((r) => setTimeout(r, 10)); }
  await new Promise((r) => setTimeout(r, 30)); assert.equal(p.stored().added.length, 1);
  p.w.NaviLearn.view('subjects'); await p.open(/AI 교수 목록 · 1명/); await p.find('스페인어'); await p.until(/교수 목록에서 불러왔어요/); p.btn('성인').click(); await p.until(/수업 열기/);
  p.btn('수업 열기').click(); assert.equal(p.stored().added.length, 1, '같은 교수·수준은 수업을 하나만 둔다');
});
test('learn.css: 교수 카드 목록(2열, 좁으면 1열)과 넓은 대화상자', () => {
  assert.match(css, /\.lrn \.dlg\.wide\{width:min\(760px/); assert.match(css, /\.lrn \.pl\{display:grid;grid-template-columns:repeat\(2/); assert.match(css, /\.lrn \.pcard\{/);
});
