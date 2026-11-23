import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../search-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../search.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
const sp = readFileSync(new URL('../infra-sp.js', import.meta.url), 'utf8');
function page(view) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  w.eval(app); const doc = w.document, asks = [];
  w.NaviSearch.on('ask', (t) => asks.push(t)); w.NaviSearch.mount(doc.getElementById('m'), { view });
  const txt = () => doc.getElementById('sc-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, txt, btn, fetched: () => fetched, N: w.NaviSearch };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviSearch; };

test('kAnon: 가장 작은 집단이 기준 이상이어야 통과, 잘못된 값은 null', { skip }, () => {
  const N = api();
  assert.deepEqual(JSON.parse(JSON.stringify(N.kAnon(['24', '31', '10'], 10))), { min: 10, k: 10, ok: true, small: 0, total: 3 });
  const r = N.kAnon(['24', '8', '3'], 10); assert.equal(r.ok, false); assert.equal(r.small, 2); assert.equal(r.min, 3);
  assert.equal(N.kAnon([], 10), null); assert.equal(N.kAnon(['0'], 10), null); assert.equal(N.kAnon(['a'], 10), null); assert.equal(N.kAnon(['5'], 1), null); assert.equal(N.kAnon(['5.5'], 10), null);
});

test('findPII: 주민번호·전화·이메일을 찾고, 빈 값은 null', { skip }, () => {
  const N = api();
  assert.equal(N.findPII('  '), null); assert.equal(N.findPII('감귤 농원 소개').length, 0);
  assert.deepEqual([...N.findPII('900101-1234567 010-1234-5678 a@b.kr')], ['주민등록번호', '전화번호', '이메일']);
});

test('searchLocal: 비공개는 나오지 않고 띄어쓰기를 무시한다', { skip }, () => {
  const N = api(); const items = [{ id: '1', name: '한림 감귤 농원', summary: '유기농', scope: '공개 동의' }, { id: '2', name: '내 감귤 일지', summary: '', scope: '비공개' }, { id: '3', name: '감귤 가격 통계', summary: '', scope: '익명화' }];
  assert.deepEqual([...N.searchLocal(items, '감 귤').map((x) => x.id)], ['1', '3']);
  assert.equal(N.searchLocal(items, '  '), null); assert.equal(N.searchLocal(items, '없는말').length, 0);
  assert.equal(N.searchLocal(items, '감귤')[0].kind, '공개 동의 자료');
});

test('화면: 여섯 탭, 안내문, 외부 전송 없음', { skip }, () => {
  const p = page('find'); assert.equal(p.doc.querySelectorAll('.tab').length, 6);
  assert.match(p.doc.getElementById('sc-note').textContent, /아무것도 등록하지 않고/);
  ['share', 'rules', 'govern', 'engine', 'principle'].forEach((v) => { p.N.view(v); assert.ok(p.txt().length > 30, v); });
  assert.equal(p.fetched(), 0);
});

test('내 데이터 공개: 처음은 비공개, 개인정보가 있으면 공개 불가, 범위 바꾸면 검색에 나온다', { skip }, () => {
  const p = page('share');
  type(p, 'sc-s-name', '우리 농원'); type(p, 'sc-s-sum', '연락처 010-1234-5678'); p.doc.getElementById('sc-s-scope').value = '공개 동의'; p.doc.getElementById('sc-s-scope').dispatchEvent(new p.w.Event('change'));
  p.btn('적어 두기').click(); assert.match(p.txt(), /전화번호가 들어 있어요/);
  type(p, 'sc-s-sum', '유기농 감귤'); p.doc.getElementById('sc-s-scope').value = '비공개'; p.doc.getElementById('sc-s-scope').dispatchEvent(new p.w.Event('change')); p.btn('적어 두기').click();
  assert.match(p.txt(), /비공개/); assert.equal(JSON.parse(p.w.localStorage.getItem('navi-search-v1')).items[0].scope, '비공개');
  p.N.view('find'); type(p, 'sc-f-q', '감귤'); assert.ok(p.doc.getElementById('sc-f-none'));
});

test('등록 기준: 익명성·개인정보 점검 결과가 화면에 나온다', { skip }, () => {
  const p = page('rules'); type(p, 'sc-r-counts', '24, 31, 8');
  assert.equal(p.doc.getElementById('sc-r-min').textContent, '8명'); assert.match(p.doc.getElementById('sc-r-res').textContent, /1개 있어요/);
  type(p, 'sc-r-counts', '24, 31, 12'); assert.match(p.doc.getElementById('sc-r-res').textContent, /모든 집단이 기준을 넘어요/);
  type(p, 'sc-r-text', '문의 a@b.kr'); assert.match(p.doc.getElementById('sc-r-piires').textContent, /이메일/);
});

test('검색 AI에게 묻기는 대화창에 채우기만 한다', { skip }, () => {
  const p = page('find'); type(p, 'sc-f-q', '제주 감귤'); p.btn('검색 AI에게 묻기').click(); assert.equal(p.asks.length, 1); assert.match(p.asks[0], /제주 감귤/);
});

test('연결: desktop.html·paths·SP·CSS', () => {
  assert.match(d, /tab-btn-sch/); assert.match(d, /sch-root-host/); assert.match(d, /sch: 'ksearch'/); assert.match(d, /_schOpen/); assert.match(d, /search-app\.js\?v=/);
  assert.match(paths, /search-app\.js/); assert.match(paths, /search\.css/); assert.match(sp, /"scr": "검색 화면"/); assert.match(css, /\.sch/);
  assert.ok(!/\.lgs\b/.test(css));
});
