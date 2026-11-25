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

/* ── 진행 논리: 피드백 위치·순서 단계·다시 열기·다시 해 보기 ── */
function drive() {
  const e = env(), d = e.w.document, ck = (el) => el.dispatchEvent(new e.w.MouseEvent('click', { bubbles: true }));
  return { ...e, d, ck, card: () => d.getElementById('hw-card') };
}
test('모든 시나리오: 정답대로 풀면 끝까지 가고 결과 화면에 닿는다(수동 단계 포함)', { skip }, () => {
  for (const seed of [1, 2]) {
    const { w, N, d, ck } = drive();
    for (const id of ALL) {
      const sc = N._SC[id]; N.open(id, seed);
      for (let i = 0; i < sc.steps.length; i++) {
        const st = sc.steps[i], card = d.getElementById('hw-card'); assert.ok(card, id + ' 카드');
        const it = st.gen ? st.gen(N._mk(seed * 31 + i * 7919 + 17)) : st.v ? st.v[(seed + i) % st.v.length] : st;
        if (st.k === 'pick') { const a = Array.isArray(it.a) ? it.a[0] : it.a; ck([...card.querySelectorAll('.opts button')].find((b) => b.textContent === it.opts[a])); }
        else if (st.k === 'sort') { for (const row of card.querySelectorAll('.sorti')) ck(row.querySelector('button[data-b="' + it.items[+row.dataset.k][1] + '"]')); ck(card.querySelector('#hw-check')); }
        else if (st.k === 'order') { for (let k = 0; k < it.items.length; k++) ck(card.querySelector('.ordl button[data-k="' + k + '"]')); }
        else if (st.k === 'calc') { card.querySelector('#hw-ans').value = String(it.a); ck(card.querySelector('#hw-go')); }
        else if (st.k === 'chain') { ck(card.querySelectorAll('button[data-fix]')[0]); ck(card.querySelectorAll('button[data-fix]')[1]); }
        else if (st.k === 'text') { const ph = /(\d{2,3}-\d{3,4}-\d{4})/.exec(it.q)[1]; let dg = ph.replace(/-/g, '').replace(/^0/, ''); while (dg.length < 10) dg = '0' + dg; card.querySelector('#hw-ans').value = dg; ck(card.querySelector('#hw-go')); }
        else if (st.k === 'live' && id === 'ch11') { for (const b of card.querySelectorAll('.opts button')) ck(b); }
        else if (st.k === 'live' && id === 'ch14') { const nums = (/구매자의 현금 ([\d,]+) GDC, 판매자의 현금 ([\d,]+) GDC입니다\. ([\d,]+) GDC/.exec(card.textContent)).slice(1).map((x) => +x.replace(/,/g, '')); card.querySelector('#hw-ans').value = String(nums[1] + nums[2]); card.querySelector('#hw-ans2').value = '0'; ck(card.querySelector('#hw-go')); }
        else if (st.k === 'zone') ck(card.querySelector('button[data-z="' + it.a + '"]'));
        else assert.fail(id + ' 처리 못한 단계 ' + st.k);
        assert.ok(card.querySelector('#hw-next'), id + '#' + (i + 1) + '(' + st.k + ') 정답 후 완료');
        ck(card.querySelector('#hw-next'));
      }
      assert.ok(d.getElementById('hw-restart'), id + ' 결과 화면'); N.close();
    }
  }
});
test('순서 단계: 틀리면 몇 번째 단계인지 알려 주고, 고른 것은 선택지에서 빠지며, 3번 틀리면 정답 순서를 보여 준다', { skip }, () => {
  const { N, d, ck, card } = drive(); N.open('ch_infra_stock', 4);
  const k = (n) => card().querySelector('.ordl button[data-k="' + n + '"]');
  ck(k(3)); const fb = card().querySelector('.fbslot'); assert.ok(fb.classList.contains('no')); assert.match(fb.textContent, /4번째 단계/); assert.match(fb.textContent, /1번째를 고를 차례/);
  assert.equal(card().children[1], fb, '피드백은 질문 바로 아래(안내문 앞)'); 
  ck(k(0)); assert.equal(k(0).hidden, true); assert.equal(card().querySelectorAll('.seq li').length, 1); assert.match(card().querySelector('.pos').textContent, /2번째로/);
  ck(k(4)); ck(k(3)); assert.ok(card().querySelector('#hw-show'));
  ck(card().querySelector('#hw-show')); assert.equal(card().querySelectorAll('.seq li').length, 5); assert.ok(card().querySelector('#hw-next'));
});
test('마친 단계를 다시 열면 풀이 결과를 보여 주고, 다시 해 보기는 그 단계의 상황만 바꾼다', { skip }, () => {
  const { N, d, ck, card } = drive(); N.open('ch_infra_stock', 4);
  for (let k = 0; k < 5; k++) ck(card().querySelector('.ordl button[data-k="' + k + '"]'));
  ck(card().querySelector('#hw-next'));
  const q2 = card().querySelector('.q').textContent;
  d.querySelector('#hw-dots button[data-i="0"]').dispatchEvent(new (d.defaultView.MouseEvent)('click', { bubbles: true }));
  assert.ok(card().querySelector('#hw-done'), '다시 열면 마친 결과'); assert.equal(card().querySelectorAll('.ordl').length, 0);
  d.querySelector('#hw-dots button[data-i="1"]').dispatchEvent(new (d.defaultView.MouseEvent)('click', { bubbles: true }));
  assert.equal(card().querySelector('.q').textContent, q2, '다른 단계 상황은 그대로');
  d.querySelector('#hw-dots button[data-i="0"]').dispatchEvent(new (d.defaultView.MouseEvent)('click', { bubbles: true }));
  ck(card().querySelector('#hw-redo')); assert.ok(card().querySelector('.ordl'), '다시 해 보기는 풀 수 있는 상태');
  d.querySelector('#hw-dots button[data-i="1"]').dispatchEvent(new (d.defaultView.MouseEvent)('click', { bubbles: true }));
  assert.equal(card().querySelector('.q').textContent, q2, '다시 해 보기가 다른 단계를 바꾸지 않음');
});
test('헤더는 압축(역할 안내는 접힘)되어 풀이 영역이 가려지지 않는다', { skip }, () => {
  const { N, d } = drive(); N.open('ch1', 2); const det = d.querySelector('#nhow-pn details.how'); assert.ok(det); assert.equal(det.open, false); assert.ok(det.textContent.includes('시뮬레이션이 맡는 것'));
});
