import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../public-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
const sp = readFileSync(new URL('../infra-sp.js', import.meta.url), 'utf8');
function page(view) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  w.eval(app); const doc = w.document, asks = [];
  w.NaviPublic.on('ask', (t) => asks.push(t)); w.NaviPublic.mount(doc.getElementById('m'), { view });
  const txt = () => doc.getElementById('pb-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, txt, btn, fetched: () => fetched, N: w.NaviPublic };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviPublic; };

test('matchDocs: 요구 서류 대조 — 띄어쓰기·대소문자 무시, 빈 값은 null', { skip }, () => {
  const N = api(), r = N.matchDocs('주민등록등본, 신청서, 소명 자료', '주민등록등본,소명자료');
  assert.equal(r.total, 3); assert.deepEqual([...r.have], ['주민등록등본', '소명 자료']); assert.deepEqual([...r.missing], ['신청서']); assert.equal(r.ready, false);
  assert.equal(N.matchDocs('A, a', 'a').total, 1); assert.equal(N.matchDocs('A', 'a').ready, true); assert.equal(N.matchDocs('', 'a'), null);
});

test('화면: 탭 6개, 첫 화면은 내 행정, 아무것도 밖으로 보내지 않는다', { skip }, () => {
  const p = page(); assert.equal(p.doc.querySelectorAll('.tab').length, 6);
  assert.match(p.txt(), /아직 적어 둔 일이 없어요/); assert.match(p.txt(), /기관 사이트에 접속하거나 서류를 제출·결제하지 않고/); assert.equal(p.fetched(), 0);
  p.N.view('principle'); assert.match(p.txt(), /도장 찍는 로봇/); p.N.view('connect'); assert.match(p.txt(), /아직 없음/);
});

test('대행 요청 → 내 행정 → 제출 기록, 이 브라우저에만 저장', { skip }, () => {
  const p = page('request'); p.btn('내 행정에 적기').click(); assert.match(p.txt(), /기관 이름을 적어 주세요/);
  type(p, 'pb-q-org', '대법원 전자소송'); type(p, 'pb-q-goal', '지급명령 신청서 제출'); p.btn('내 행정에 적기').click();
  assert.match(p.txt(), /기관에는 아무것도 보내지 않았어요/);
  const saved = JSON.parse(p.w.localStorage.getItem('navi-public-v1')); assert.equal(saved.items[0].org, '대법원 전자소송'); assert.equal(saved.items[0].st, '준비');
  p.N.view('home'); const s = p.doc.querySelector('td select'); s.value = '제출 완료'; s.dispatchEvent(new p.w.Event('change', { bubbles: true }));
  assert.equal(JSON.parse(p.w.localStorage.getItem('navi-public-v1')).items[0].st, '제출 완료');
  p.N.view('log'); assert.match(p.txt(), /지급명령 신청서 제출/);
  p.N.view('home'); p.btn('삭제').click(); assert.equal(JSON.parse(p.w.localStorage.getItem('navi-public-v1')).items.length, 0); assert.equal(p.fetched(), 0);
});

test('도우미에게 맡기기는 대화창에 말만 채운다 · 위임은 효력 없음 표시', { skip }, () => {
  const p = page('request'); type(p, 'pb-q-org', '정부24'); type(p, 'pb-q-goal', '주민등록등본 발급'); p.btn('나비웹 도우미에게 맡기기').click();
  assert.equal(p.asks.length, 1); assert.match(p.asks[0], /정부24/); assert.match(p.asks[0], /로그인과 최종 확인·결제는 내가/);
  p.N.view('delegate'); type(p, 'pb-d-org', '정부24'); type(p, 'pb-d-lim', '10000'); p.btn('위임 적어 두기').click(); assert.match(p.txt(), /아직 효력은 없어요/);
  assert.equal(JSON.parse(p.w.localStorage.getItem('navi-public-v1')).rules[0].limit, 10000);
  type(p, 'pb-d-lim', '-5'); type(p, 'pb-d-org', 'x'); p.btn('위임 적어 두기').click(); assert.match(p.txt(), /0~10억/); assert.equal(p.fetched(), 0);
});

test('desktop.html 연결 + 경로 + 범위 css + SP', { skip }, () => {
  assert.ok(d.includes("_pubOpen('home')") && d.includes("go.indexOf('pub:') === 0") && d.includes("if (name === 'pub') _pubShow();") && d.includes('id="tab-pub"') && d.includes("pub: 'kpublic'"));
  assert.ok(paths.includes('"public-app.js"') && paths.includes('"public.css"')); assert.ok(css.includes('.pub ') && !css.includes('.lgs'));
  assert.ok(sp.includes('"scr": "행정 화면"'));
});
