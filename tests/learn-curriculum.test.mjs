import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleCurriculum } from '../ops/naviweb-qna/curriculum.js';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../learn-app.js', import.meta.url), 'utf8');

class KV {
  constructor() { this.m = new Map(); }
  async get(k, t) { const v = this.m.get(k); if (!v) return null; return t === 'json' ? JSON.parse(v.v) : v.v; }
  async put(k, v, o) { this.m.set(k, { v, meta: o && o.metadata }); }
  async delete(k) { this.m.delete(k); }
  async list({ prefix }) { return { keys: [...this.m].filter(([k]) => k.startsWith(prefix)).map(([k, x]) => ({ name: k, metadata: x.meta })), list_complete: true }; }
}
const weeks = (n) => Array.from({ length: n }, (_, i) => ({ t: (i + 1) + '주 주제', g: ['목표 하나를 설명한다', '목표 둘을 계산한다'], h: 4 }));
const CUR = JSON.stringify({ title: '거시경제학', subject: '경제학', level: '대학', summary: '국민소득과 경기', hoursPerWeek: 4, weeks: weeks(14) });
const QZ = JSON.stringify({ questions: [0, 1, 2, 3, 4].map((i) => ({ q: '문제 ' + i, o: ['가', '나', '다', '라'], a: i % 4, e: '풀이 ' + i })) });
// 서버(워커)를 학습 화면의 fetch 에 직접 이어 준다. 바깥 호출(위키·LLM)은 가짜.
function server() {
  const env = { QNA: new KV(), SP_API_URL: 'https://sp.test', SP_API_KEY: 'k' }, calls = { llm: 0 };
  const ext = async (url) => {
    if (/wikipedia\.org/.test(url)) {
      if (/list=search/.test(url)) return new Response(JSON.stringify({ query: { search: [{ title: '거시경제학' }] } }));
      if (/prop=extracts/.test(url)) return new Response(JSON.stringify({ query: { pages: { 1: { title: '거시경제학', extract: '거시경제학은 경제 전체를 다룬다.' } } } }));
      return new Response(JSON.stringify({ parse: { sections: [{ toclevel: 1, line: '국민소득' }] } }));
    }
    calls.llm++; return new Response(JSON.stringify({ choices: [{ message: { content: calls.llm === 1 ? CUR : QZ } }] }));
  };
  const fetch = (u, init) => handleCurriculum(new Request('https://naviweb.kr' + u, init), env, { fetch: ext });
  return { env, calls, fetch };
}
function page(srv, seed) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; w.fetch = srv.fetch;
  if (seed) w.localStorage.setItem('navi-learn-v1', JSON.stringify(seed));
  w.eval(app);
  const doc = w.document, out = [];
  w.NaviLearn.on('result', (m) => out.push(m));
  w.NaviLearn.mount(doc.getElementById('m'));
  const nav = (a) => w.NaviLearn.nav(a);
  const txt = () => doc.getElementById('lrn-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  const until = async (re, ms) => { const t0 = Date.now(); while (!re.test(txt())) { if (Date.now() - t0 > (ms || 3000)) throw new Error('기다리던 글이 없다: ' + re + '\n' + txt().slice(0, 400)); await new Promise((r) => setTimeout(r, 15)); } };
  return { w, doc, out, nav, txt, btn, until };
}

test('상단: 로고를 없앴다(이름만 남는다)', { skip }, () => {
  const p = page(server());
  assert.equal(p.doc.querySelector('.logo'), null); assert.match(p.doc.querySelector('.brand').textContent, /나비웹 학습/);
  assert.ok(!/\.logo\{/.test(readFileSync(new URL('../learn.css', import.meta.url), 'utf8')));
});
test('검색 → DB 에 없음 → 새로 만들기 → 내 수업에 추가 → 다른 학습자는 즉시 인출', { skip }, async () => {
  const srv = server(), a = page(srv);
  a.nav({ do: 'search', subject: '거시경제학' }); assert.equal(a.out.pop().ok, true);
  await a.until(/아직 DB에 없어요/);
  a.btn('새로 만들기').click(); await a.until(/방금 새로 만들었어요/);
  assert.match(a.txt(), /표준 기간14주/); assert.match(a.txt(), /총 56시간/); assert.match(a.txt(), /주당4시간/); assert.match(a.txt(), /2개 분기/); assert.match(a.txt(), /웹 자료 \d건을 바탕으로 AI가 작성/);
  assert.equal(srv.calls.llm, 1);
  a.btn('내 수업에 추가').click();
  assert.match(a.txt(), /거시경제학/); assert.match(a.txt(), /표준 14주 · 총 56시간\(주 4시간\)/); assert.match(a.txt(), /분기별 진도/); assert.match(a.txt(), /1분기 · 1–13주/);
  const sv = JSON.parse(a.w.localStorage.getItem('navi-learn-v1')), c = sv.added[0];
  assert.match(c.cid, /^c[0-9a-f]{12}$/); assert.equal(c.cur.w.length, 14); assert.equal(c.seq, 'N'.repeat(14)); assert.ok(c.start > 0);
  const b = page(srv);   // 다른 학습자(다른 브라우저)
  b.nav({ do: 'search', subject: '거시경제학 강의' }); await b.until(/DB에서 바로 불러왔어요/); assert.equal(srv.calls.llm, 1, 'LLM 을 다시 부르지 않는다');
  b.btn('내 수업에 추가').click(); assert.match(b.txt(), /거시경제학/);
});
test('검색: 서버 준비 전·네트워크 오류·짧은 검색어를 알려 준다', { skip }, async () => {
  const srv = server(); delete srv.env.SP_API_URL; const a = page(srv);
  a.nav({ do: 'search', subject: '미적분' }); await a.until(/아직 DB에 없어요/); assert.match(a.txt(), /서버가 아직 준비되지 않았어요/); assert.equal(a.btn('새로 만들기'), undefined);
  a.nav({ do: 'search', subject: '가' }); await a.until(/두 글자 이상/);
  const down = page({ fetch: async () => { throw new Error('offline'); } });
  down.nav({ do: 'search', subject: '미적분' }); await down.until(/서버에 연결하지 못했어요/);
});
test('확인 문제: 커리큘럼 과목은 처음 풀 때 만들어 가져오고, 풀면 단계가 바뀐다', { skip }, async () => {
  const srv = server(), a = page(srv);
  a.nav({ do: 'search', subject: '거시경제학' }); await a.until(/아직 DB에 없어요/); a.btn('새로 만들기').click(); await a.until(/방금 새로 만들었어요/); a.btn('내 수업에 추가').click();
  a.nav({ do: 'quiz', subject: '거시경제학', week: 2 }); assert.match(a.txt(), /확인 문제를 준비하고 있어요/);
  await a.until(/2주차 확인 문제/); await a.until(/1\. 문제 0/);
  assert.equal(a.doc.querySelectorAll('.q').length, 5);
  [...a.doc.querySelectorAll('.q')].forEach((q, i) => q.querySelectorAll('.opt')[i % 4].click());
  [...a.doc.querySelectorAll('button')].find((b) => b.textContent.startsWith('제출')).click();
  assert.match(a.txt(), /5 \/ 5문제 · 100%/);
  assert.match(a.w.localStorage.getItem('navi-learn-qz'), /:2/);
  assert.equal(JSON.parse(a.w.localStorage.getItem('navi-learn-v1')).prog[JSON.parse(a.w.localStorage.getItem('navi-learn-v1')).added[0].id].seq[1], 'P');
});
test('진행 현황: 표준 일정 대비 상태, 분기·월·주·일 전환, 추이 그래프', { skip }, () => {
  const DAY = 86400000, now = Date.now();
  const cur = { id: 'cabcabcabcabc', title: '거시경제학', sum: '', level: '대학', w: weeks(14).map((k) => ({ t: k.t, g: k.g, h: k.h })), hours: 56, hpw: 4, web: false, src: [] };
  const seed = { added: [{ id: 'u1', cid: 'cabcabcabcab', name: '거시경제학', subj: '경제학', level: '대학 · 경제학', prof: '거시경제학 교수', seq: 'PPN' + 'N'.repeat(11), goal: '', start: now - 30 * DAY, cur }], prog: { u1: { seq: 'PPN' + 'N'.repeat(11), pass: { 1: now - 20 * DAY, 2: now - 9 * DAY }, log: [[1, 100, now - 20 * DAY], [2, 90, now - 9 * DAY], [2, 100, now - 1 * DAY]], chain: [] } } };
  const p = page(server(), seed); p.nav({ do: 'plan' }); assert.equal(p.out.pop().ok, true);
  let t = p.txt(); assert.match(t, /진행 현황/); assert.match(t, /거시경제학/); assert.match(t, /표준보다 2주 늦었어요/); assert.match(t, /2 \/ 14주/); assert.match(t, /5주차/); assert.match(t, /최근 7일1일 · 1회/);
  assert.match(t, /표준 14주 과정 중 2주를 통과했습니다\(14%\)/); p.btn('분기').click(); t = p.txt(); assert.match(t, /1분기 · 1–13주/); assert.match(t, /2분기 · 14–14주/);
  p.btn('월').click(); assert.match(p.txt(), /1개월 · 1–4주/); assert.match(p.txt(), /4개월 · 13–14주/);
  const last = (sel) => [...p.doc.querySelectorAll(sel)].pop();
  p.btn('주').click(); { const g = last('.wk'); assert.equal(g.querySelectorAll('button').length, 14); assert.equal(g.querySelectorAll('button.P').length, 2); assert.equal(g.querySelectorAll('button.now').length, 1); }
  p.btn('일').click(); { const g = last('.cal'); assert.equal(g.querySelectorAll('div').length, 28); assert.equal(g.querySelectorAll('div.today').length, 1); assert.equal(g.querySelectorAll('div.d1').length, 3, '확인 문제를 푼 3일'); }
  assert.match(p.txt(), /3주차 표준 일일 계획 · 주 4시간/); assert.match(p.txt(), /5일차/);
  assert.ok(p.doc.querySelector('svg[role=img] path'), '추이 그래프'); assert.match(p.doc.querySelector('svg title').textContent, /표준 일정/);
  assert.match(p.txt(), /인쇄/);
  // 예시 과목(경제학·미적분)도 같은 화면에 들어 있다
  assert.match(p.txt(), /경제학 입문/); assert.match(p.txt(), /미적분 기초/);
});
test('주차 학습: 커리큘럼의 주 제목·학습 목표·표준 일정을 쓴다', { skip }, () => {
  const now = Date.now(), cur = { id: '', title: '거시경제학', sum: '', level: '대학', w: weeks(8), hours: 32, hpw: 4, web: true, src: [{ title: '위키', url: 'https://ko.wikipedia.org/wiki/x' }, { title: '나쁨', url: 'javascript:alert(1)' }] };
  const p = page(server(), { added: [{ id: 'u1', name: '거시경제학', subj: '경제학', level: '대학 · 경제학', prof: '거시경제학 교수', seq: 'N'.repeat(8), goal: '', start: now, cur }], prog: {} });
  p.nav({ do: 'week', subject: '거시경제학', week: 3 });
  assert.match(p.txt(), /거시경제학 · 3주차 — 3주 주제/); assert.match(p.txt(), /목표 하나를 설명한다/); assert.match(p.txt(), /이번 주 표준 일정 · 주 4시간/); assert.match(p.txt(), /1일차/);
  p.nav({ do: 'course', subject: '거시경제학' }); assert.ok([...p.doc.querySelectorAll('a')].every((a) => /^https:/.test(a.href)), '자료 링크는 https 만');
  assert.match(p.txt(), /웹 자료 1건/);
});
test('저장값 검증: 깨진 커리큘럼·시작일은 버리고 화면은 산다', { skip }, () => {
  const p = page(server(), { added: [{ id: 'u1', name: '이상한 과목', subj: 'x', level: 'x', prof: 'x', seq: 'NNNN', goal: '', start: 'abc', cur: { w: [{ t: 1 }] }, cid: '<script>' }], prog: {} });
  p.nav({ do: 'plan' }); assert.match(p.txt(), /이상한 과목/); assert.match(p.txt(), /표준 일정 없음/);
});
test('검색: 돋보기 아이콘을 누르면 검색창이 열리고, 도움말은 처음 한 번만 보인다', { skip }, () => {
  const p = page(server());
  assert.equal(p.doc.getElementById('lrn-srch-in'), null); assert.ok(!/배우고 싶은 과목 검색/.test(p.txt()));
  const ic = () => p.doc.querySelector('button[aria-label="과목 검색"]');
  ic().click(); assert.ok(p.doc.getElementById('lrn-srch-in')); assert.match(p.txt(), /온라인 강좌가 다루는 어떤 과목이든/); assert.equal(p.w.localStorage.getItem('navi-learn-help-srch'), '1');
  ic().click(); assert.equal(p.doc.getElementById('lrn-srch-in'), null);
  ic().click(); assert.ok(p.doc.getElementById('lrn-srch-in')); assert.ok(!/온라인 강좌가 다루는 어떤 과목이든/.test(p.txt()), '두 번째부터는 도움말이 없다');
  const q = page(server()); q.w.localStorage.setItem('navi-learn-help-srch', '1'); q.w.document.querySelector('button[aria-label="과목 검색"]').click(); assert.ok(!/온라인 강좌가 다루는 어떤 과목이든/.test(q.txt()));
});
