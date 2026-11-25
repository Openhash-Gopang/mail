import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 없으면 건너뜀 */ }
const skip = !JSDOM && 'jsdom 없음';
const rd = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const src = rd('../sim-howto.js'), man = rd('../manual/hondi_interactive_manual.html'), paths = rd('../ops/naviweb-proxy/mail-paths.js');
function env() {
  const w = new JSDOM('<!DOCTYPE html><body><div id="x"></div></body>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true }).window;
  let f = 0, st = 0; w.fetch = () => { f++; return Promise.reject(new Error('no')); };
  for (const k of ['setItem', 'getItem', 'removeItem']) { const o = w.Storage.prototype[k]; w.Storage.prototype[k] = function () { st++; return o.apply(this, arguments); }; }
  w.eval(src); return { w, N: w.NaviHowto, fetched: () => f, stor: () => st };
}
const chapters = JSON.parse(man.split('\n').find((l) => l.startsWith('var CHAPTERS = ')).slice(15).replace(/;\s*$/, ''));
const ALL = chapters.map((c) => c.id);
const IDS = ALL.slice(0, 39);

test('매뉴얼 전체 장(107개)에 시나리오가 있고 단계가 3개 이상, 번호가 장 순서와 같다', { skip }, () => {
  const { N } = env(); assert.equal(JSON.stringify(N.ids()), JSON.stringify(ALL));
  for (const id of ALL) { const m = N.meta(id); assert.equal(m.n, ALL.indexOf(id) + 1, id); assert.ok(m.steps.length >= 3, id); assert.equal(m.say.length, 3, id); assert.ok(m.focus.includes('시뮬레이션이 맡는 것'), id); }
});
const tick = () => new Promise((r) => setTimeout(r, 30));
test('열기·Esc·바깥 클릭으로 닫힘, 저장·전송 없음', { skip }, async () => {
  const { w, N, fetched, stor } = env(); const d = w.document;
  for (const id of ALL) { N.open(id, 3); assert.ok(d.getElementById('nhow-pn'), id); N.close(); assert.equal(d.getElementById('nhow-pn'), null, id); }
  N.open('ch1', 1); await tick(); d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); assert.equal(d.getElementById('nhow-pn'), null);
  N.open('ch1', 1); await tick(); d.getElementById('x').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); assert.equal(d.getElementById('nhow-pn'), null);
  assert.equal(fetched(), 0); assert.equal(stor(), 0);
});
test('같은 시드는 같은 화면', { skip }, () => {
  const a = env(), b = env(); a.N.open('ch14', 5); b.N.open('ch14', 5);
  assert.equal(a.w.document.getElementById('hw-body').innerHTML, b.w.document.getElementById('hw-body').innerHTML);
});
test('매뉴얼: 장마다 시뮬레이션 안내와 버튼 연결, 갱신일, JSON 유효', () => {
  for (const id of ALL) { const c = chapters.find((x) => x.id === id); assert.ok(c.body.includes('🧪 시뮬레이션'), id); assert.equal(c.updated, '2026-11-25', id); }
  assert.equal(JSON.stringify(Object.keys(JSON.parse(/NAVI_HOWTO_IDS = (\{[^}]*\});/.exec(man)[1]))), JSON.stringify(ALL));
  for (const id of ['ch10', 'ch11', 'ch13', 'ch14']) assert.ok(chapters.find((x) => x.id === id).body.includes('🎯 연습 예제'), id);
  assert.ok(man.includes('hwOpenBtn') && man.includes('sim-howto.js'));
  const lm = chapters.find((x) => x.id === 'ch_leftmenu').body; assert.ok(lm.includes('캠페인 이력') && lm.includes('플랜 업그레이드'));
});
test('새 파일이 mail-paths 에 등록됨', () => { assert.ok(paths.includes('sim-howto.js')); });
