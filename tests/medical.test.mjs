import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../medical-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../medical.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
function page(view) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  w.eval(app); const doc = w.document, asks = [];
  w.NaviMedical.on('ask', (t) => asks.push(t)); w.NaviMedical.mount(doc.getElementById('m'), { view });
  const txt = () => doc.getElementById('med-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  const btns = (t) => [...doc.querySelectorAll('button')].filter((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, txt, btn, btns, fetched: () => fetched, N: w.NaviMedical };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviMedical; };

test('bmi: 계산과 범위 밖 null(판정 없음)', { skip }, () => {
  const N = api(); assert.equal(N.bmi('70', '175'), 22.9); assert.equal(N.bmi('', '175'), null); assert.equal(N.bmi('70', '20'), null); assert.equal(N.bmi('900', '175'), null);
});

test('submission: 요청한 것 중 허용한 것만 제출', { skip }, () => {
  const N = api(); const r = N.submission({ stmt: 1, vit: 1 }, { stmt: 1, hist: 1, vit: 1 });
  assert.deepEqual([...r.send], ['stmt', 'vit']); assert.deepEqual([...r.blocked], ['hist']);
  assert.deepEqual([...N.submission({ stmt: 1 }, {}).send], []); assert.deepEqual([...N.submission({}, { fam: 1 }).blocked], ['fam']);
});

test('summaryText: 제출 대상만, 신원 정보 없음', { skip }, () => {
  const N = api();
  const p = { st: [{ t: '허리가 아파요' }], vit: [{ d: '2026-11-01', sys: 120, dia: 80, hr: 70, wt: 70, ht: 175 }, { d: '2026-11-20', sys: 130, dia: 85, hr: 75 }], hist: [{ t: '위염' }], fam: [{ t: '아버지 고혈압' }], life: { smoke: '안 함', sleep: '7' } };
  const t = N.summaryText(p, ['stmt', 'vit']);
  assert.match(t, /신원 정보 없음/); assert.match(t, /진술: 허리가 아파요/); assert.match(t, /혈압 130\/85/); assert.doesNotMatch(t, /위염|고혈압|흡연/);
  const u = N.summaryText(p, ['hist', 'fam', 'life']); assert.match(u, /질병 이력: 위염/); assert.match(u, /가족력: 아버지 고혈압/); assert.match(u, /흡연 안 함, 수면 7시간/); assert.doesNotMatch(u, /허리/);
  assert.match(N.summaryText({ st: [], vit: [], hist: [], fam: [], life: {} }, ['stmt', 'vit']), /진술: 없음[\s\S]*생체 정보: 없음/);
});

test('rankCandidates: 합 100%, 높은 순, 잘못된 줄 제외', { skip }, () => {
  const N = api(); const r = N.rankCandidates([{ n: 'A', s: '1' }, { n: 'B', s: '3' }, { n: 'C', s: 'x' }, { n: 'D', s: '1' }]);
  assert.deepEqual(r.map((x) => x.name), ['B', 'A', 'D']); assert.ok(Math.abs(r.reduce((a, x) => a + x.pct, 0) - 100) < 1e-9); assert.equal(Math.round(r[0].pct), 60);
  assert.equal(N.rankCandidates([{ n: 'A', s: '' }]), null);
});

test('내 의료 정보: 진술·이력·가족력 추가·삭제, 생체 정보 검증·기록, 생활 습관 저장', { skip }, () => {
  const p = page('profile'); assert.match(p.doc.getElementById('med-warn').textContent, /119/);
  type(p, 'med-st', '허리가 아파요'); p.btns('추가')[0].click(); assert.equal(p.doc.getElementById('med-t0').textContent, '1건');
  type(p, 'med-hist', '위염'); p.btns('추가')[1].click(); assert.equal(p.doc.getElementById('med-t2').textContent, '1건');
  p.btn('기록하기').click(); assert.match(p.txt(), /하나 이상/);
  type(p, 'med-v-sys', '120'); p.btn('기록하기').click(); assert.match(p.txt(), /수축기·이완기를 함께/);
  type(p, 'med-v-dia', '80'); type(p, 'med-v-wt', '70'); type(p, 'med-v-ht', '175'); p.btn('기록하기').click();
  assert.equal(p.doc.getElementById('med-t1').textContent, '120/80'); assert.match(p.txt(), /22\.9/);
  const s = p.doc.getElementById('med-l-smoke'); s.value = '안 함'; s.dispatchEvent(new p.w.Event('change'));
  const q = JSON.parse(p.w.localStorage.getItem('navi-med-v1')); assert.equal(q.p.st.length, 1); assert.equal(q.p.vit.length, 1); assert.equal(q.p.life.smoke, '안 함');
  assert.equal(p.fetched(), 0);
});

test('제출 범위: 허용·요청 조합에 따라 익명 요약과 막힌 항목', { skip }, () => {
  const p = page('profile'); type(p, 'med-st', '허리가 아파요'); p.btns('추가')[0].click(); type(p, 'med-hist', '위염'); p.btns('추가')[1].click();
  p.N.view('submit');
  for (const k of ['stmt', 'hist']) { const c = p.doc.getElementById('med-rq-' + k); c.checked = true; c.dispatchEvent(new p.w.Event('change')); }
  assert.match(p.doc.getElementById('med-s-block').textContent, /진술\(증상\).*질병 이력/); assert.equal(p.doc.getElementById('med-s-send').textContent, '없음');
  const a = p.doc.getElementById('med-sh-stmt'); a.checked = true; a.dispatchEvent(new p.w.Event('change'));
  assert.equal(p.doc.getElementById('med-s-send').textContent, '진술(증상)'); assert.match(p.doc.getElementById('med-s-txt').textContent, /허리가 아파요/); assert.doesNotMatch(p.doc.getElementById('med-s-txt').textContent, /위염/);
  assert.match(p.doc.getElementById('med-c-n').textContent, /1 \/ 5/); assert.match(p.doc.getElementById('med-s-block').textContent, /질병 이력/);
});

test('의료 인프라 원리: 6단계, 건강보험공단 확대, 설계 단계 표시', { skip }, () => {
  const p = page('principle'); const t = p.txt();
  for (const re of [/PDV/, /익명화/, /확률이 높은 것부터/, /AI 비서/, /최종 진단·처치·처방/, /모두 기록/, /건강보험공단/]) assert.match(t, re);
  assert.match(p.doc.getElementById('med-design').textContent, /설계 원칙/);
});

test('진료 참고 목록: 자리표시 형식과 순서 연습, 실제 질병 이름 없음', { skip }, () => {
  const p = page('rank'); assert.match(p.txt(), /후보 A \(예시\)/); assert.match(p.txt(), /의학 정보가 아닙니다/);
  type(p, 'med-r-s0', '1'); type(p, 'med-r-s1', '3'); assert.match(p.doc.getElementById('med-r-out').textContent, /1\. 후보 B.*75%/);
  assert.equal(p.fetched(), 0);
});

test('진료 기록: 검증·기록·삭제, 탭 이동', { skip }, () => {
  const p = page('visits'); p.btn('기록하기').click(); assert.match(p.txt(), /의료 기관 이름을 적어/);
  type(p, 'med-vo', '○○의원'); type(p, 'med-vx', '의사가 말한 진단'); p.btn('기록하기').click(); assert.equal(p.doc.getElementById('med-v0').textContent, '1건'); assert.match(p.txt(), /○○의원/);
  p.btn('삭제').click(); assert.match(p.txt(), /아직 진료 기록이 없어요/);
  for (const v of ['profile', 'submit', 'principle', 'rank', 'visits']) { p.N.view(v); assert.ok(p.txt().length > 20, v); }
  assert.equal(p.doc.querySelectorAll('.tab').length, 5);
});

test('CSS는 .med 아래로 한정, 네트워크 호출 없음', () => {
  const sel = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').split('}').map((x) => x.split('{')[0].trim()).filter((x) => x && !x.startsWith('@') && !/^\d+%|^from|^to/.test(x));
  assert.deepEqual(sel.filter((x) => x.split(',').some((y) => !/\.med\b/.test(y))).slice(0, 5), []);
  assert.doesNotMatch(app, /fetch\(|XMLHttpRequest|sendBeacon/);
});

test('desktop.html: 의료 전용 화면 연결', () => {
  assert.match(d, /tab-btn-med/); assert.match(d, /med-root/); assert.match(d, /_medOpen/); assert.match(d, /key === 'khealth' && !_medChat/);
  assert.match(d, /medical-app\.js/); assert.match(d, /medical\.css/); assert.match(d, /med:profile/);
  assert.match(paths, /"medical-app\.js"/); assert.match(paths, /"medical\.css"/);
});

test('화면: 한 페이지(all) — 모든 기능이 세로로 쌓이고 칸 id가 겹치지 않는다', { skip }, () => {
  const p = page('all'); const secs = [...p.doc.querySelectorAll('section.sec')].map((s) => s.id);
  assert.deepEqual(secs, ['med-sec-profile', 'med-sec-submit', 'med-sec-principle', 'med-sec-rank', 'med-sec-visits']);
  const ids = [...p.doc.querySelectorAll('[id]')].map((e) => e.id); assert.equal(ids.length, new Set(ids).size);
  assert.match(p.txt(), /119/); assert.match(p.txt(), /진료 참고 목록/); assert.match(p.txt(), /진료 기록/); assert.match(p.txt(), /우측 하단의 대화 아이콘/);
  assert.equal(p.fetched(), 0);
});

test('화면: all 에서 칸 이동은 다시 그리지 않고, 대화창 열기는 ask 소식을 낸다', { skip }, () => {
  const p = page('all'); let scrolled = 0; p.doc.getElementById('med-sec-rank').scrollIntoView = () => { scrolled++; };
  p.N.view('rank'); assert.equal(scrolled, 1); assert.ok(p.doc.getElementById('med-sec-profile'));
  p.btn('대화창 열기').click(); assert.equal(p.asks.length, 1); assert.equal(p.asks[0], '');
  type(p, 'med-st', '허리가 아파요'); p.btns('추가')[0].click(); assert.match(p.txt(), /허리가 아파요/); assert.ok(p.doc.getElementById('med-sec-visits'));
});

test('desktop.html: 의료는 한 페이지 + 우하단 의료 SP 대화창', { skip }, () => {
  assert.ok(d.includes("NaviMedical.mount(r, { view: 'all', section: view })")); assert.ok(d.includes("_INFRA_OWN") && d.includes("med: 'khealth'")); assert.ok(d.includes("_infraChatSync('med')"));
  assert.ok(d.includes('<script src="infra-host.js')); assert.ok(paths.includes('"infra-host.js"'));
});
