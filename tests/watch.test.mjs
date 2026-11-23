import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../watch-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../watch.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
const sp = readFileSync(new URL('../infra-sp.js', import.meta.url), 'utf8');
function page(view) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  w.eval(app); const doc = w.document, asks = [];
  w.NaviWatch.on('ask', (t) => asks.push(t)); w.NaviWatch.mount(doc.getElementById('m'), { view });
  const txt = () => doc.getElementById('wc-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, txt, btn, fetched: () => fetched, N: w.NaviWatch };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviWatch; };
const J = (x) => JSON.parse(JSON.stringify(x));
const ZERO = '0'.repeat(64);
function mk(N, list) { const out = []; let prev = ZERO; list.forEach(([t, text], k) => { const e = { i: k + 1, t, subject: '나(개인)', cat: '기타', text, prev, hash: '' }; e.hash = N.entryHash(e, prev); prev = e.hash; out.push(e); }); return out; }
const nowKst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

test('sha256: 알려진 값과 한글', { skip }, () => {
  const N = api(); assert.equal(N.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'); assert.equal(N.sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(N.sha256('가'), '64ee5293d31bc58b72d76ae9a86a902e90442428e29f24f4ecb257ba841cdd36');
});

test('verifyChain: 이어진 사슬은 정상, 고치거나 끼워 넣거나 빼면 어긋난 번호를 알린다', { skip }, () => {
  const N = api(); const c = mk(N, [['2026-11-20 09:00', '출근'], ['2026-11-20 12:00', '점심'], ['2026-11-20 18:00', '퇴근']]);
  assert.equal(J(N.verifyChain(c)).ok, true); assert.equal(J(N.verifyChain([])).ok, true);
  const t = J(c); t[1].text = '다른 곳'; assert.equal(J(N.verifyChain(t)).bad, 2);
  const r = J(c); r.splice(1, 1); assert.equal(J(N.verifyChain(r)).ok, false);
  const f = J(c); f[2].prev = ZERO; assert.equal(J(N.verifyChain(f)).bad, 3); assert.equal(N.verifyChain(null), null);
});

test('inWindow·packagePreview: 요청 기간 안의 고른 기록만, 사슬이 온전할 때만', { skip }, () => {
  const N = api(); const c = mk(N, [['2026-11-20 09:00', '출근'], ['2026-11-20 12:00', '점심'], ['2026-11-21 08:00', '다음 날']]); const req = { from: '2026-11-20 08:00', to: '2026-11-20 20:00' };
  assert.deepEqual(J(N.inWindow(c, req.from, req.to)).map((e) => e.i), [1, 2]); assert.equal(N.inWindow(c, req.to, req.from), null); assert.equal(N.inWindow(c, 'x', req.to), null);
  const pv = J(N.packagePreview(c, [2, 1, 2], req)); assert.equal(pv.count, 2); assert.deepEqual(pv.items.map((x) => x.i), [1, 2]); assert.equal(pv.head, c[2].hash);
  assert.equal(N.packagePreview(c, [3], req), null); assert.equal(N.packagePreview(c, [], req), null); assert.equal(N.packagePreview(c, [9], req), null);
  const t = J(c); t[0].text = '고침'; assert.equal(N.packagePreview(t, [1], req), null);
});

test('reportPreview: 피해자가 자기 기록을 인출해 내는 미리보기(기간 제한 없음, 사슬이 온전할 때만, 상대 표시 포함)', { skip }, () => {
  const N = api(); const c = mk(N, [['2026-11-20 09:00', '임대인과 통화'], ['2026-11-25 12:00', '문자 수신']]); c[0].with = '임대인 김○○'; c[0].hash = N.entryHash(c[0], ZERO); c[1].prev = c[0].hash; c[1].hash = N.entryHash(c[1], c[0].hash);
  const r = J(N.reportPreview(c, [2, 1])); assert.equal(r.count, 2); assert.equal(r.items[0].w, '임대인 김○○'); assert.equal(r.head, c[1].hash);
  assert.equal(N.reportPreview(c, [3]), null); assert.equal(N.reportPreview(c, []), null); const t = J(c); t[0].with = '다른 사람'; assert.equal(N.reportPreview(t, [1]), null);
});

test('화면: 여섯 탭, 안내문, 무죄 입증 원칙, 외부 전송 없음', { skip }, () => {
  const p = page('home'); assert.equal(p.doc.querySelectorAll('.tab').length, 6); assert.match(p.doc.getElementById('wc-note').textContent, /증거 능력을 보장하지 않아요/); assert.match(p.txt(), /나의 무죄를 밝히는 것/);
  ['log', 'report', 'request', 'decide', 'principle'].forEach((v) => { p.N.view(v); assert.ok(p.txt().length > 20, v); }); assert.match(p.txt(), /상대의 유죄를 입증할 수 있어요/); assert.equal(p.fetched(), 0);
});

test('활동 기록: 대상 만들기 → 기록 이어 붙이기 → 앞선 시각·미래 시각 거부 → 변조 점검', { skip }, () => {
  const p = page('log'); p.btn('사슬에 잇기').click(); assert.match(p.txt(), /기록 대상을 하나 만들어/);
  type(p, 'wc-s-name', '나'); p.btn('대상 추가').click(); type(p, 'wc-e-text', '회사 도착'); p.btn('사슬에 잇기').click(); assert.match(p.doc.getElementById('wc-e-msg').textContent, /1번 기록/);
  type(p, 'wc-e-text', '점심 식사'); p.btn('사슬에 잇기').click(); assert.match(p.doc.getElementById('wc-l-ver').textContent, /이상 없음.*2건/);
  type(p, 'wc-e-t', '2020-01-01 09:00'); type(p, 'wc-e-text', '과거로 끼워 넣기'); p.btn('사슬에 잇기').click(); assert.match(p.txt(), /이른 시각은 적을 수 없어요/);
  type(p, 'wc-e-t', '2999-01-01 09:00'); type(p, 'wc-e-text', '미래'); p.btn('사슬에 잇기').click(); assert.match(p.txt(), /미래 시각/);
  const s = JSON.parse(p.w.localStorage.getItem('navi-watch-v1')); assert.equal(s.entries.length, 2); s.entries[0].text = '고침'; p.w.localStorage.setItem('navi-watch-v1', JSON.stringify(s));
  p.N.mount(p.doc.getElementById('m'), { view: 'log' }); assert.match(p.doc.getElementById('wc-l-ver').textContent, /변조 의심/);
});

test('수사 요청 → 제출 판단: 기간 안의 기록만 고르고, 판단은 기록만 남기며 아무것도 보내지 않는다', { skip }, () => {
  const p = page('log'); const now = nowKst(), day = now.slice(0, 10);
  type(p, 'wc-s-name', '나'); p.btn('대상 추가').click(); type(p, 'wc-e-text', '집 근처 산책'); p.btn('사슬에 잇기').click();
  p.N.view('request'); p.btn('요청 적어 두기').click(); assert.match(p.txt(), /요청한 기관/);
  type(p, 'wc-q-org', '○○경찰서'); type(p, 'wc-q-sum', '○○동 절도 사건 관련'); type(p, 'wc-q-from', day + ' 00:00'); type(p, 'wc-q-to', day + ' 23:59'); p.btn('요청 적어 두기').click(); assert.match(p.doc.getElementById('wc-q-msg').textContent, /적어 뒀어요/);
  p.N.view('decide'); assert.match(p.doc.getElementById('wc-d-law').textContent, /헌법 제12조 제2항/); p.btn('판단 기록').click(); assert.match(p.txt(), /한 건 이상 골라/);
  const c = p.doc.getElementById('wc-dp-1'); c.checked = true; c.dispatchEvent(new p.w.Event('change', { bubbles: true })); assert.match(p.txt(), /고른 기록1건/);
  p.btn('판단 기록').click(); assert.match(p.doc.getElementById('wc-d-msg').textContent, /아무것도 보내지 않아요/);
  const s = JSON.parse(p.w.localStorage.getItem('navi-watch-v1')); assert.equal(s.decs[0].act, '제출 준비'); assert.equal(s.decs[0].n, 1);
  const a = p.doc.getElementById('wc-d-act'); a.value = '제출하지 않음'; a.dispatchEvent(new p.w.Event('change')); p.btn('판단 기록').click(); assert.equal(JSON.parse(p.w.localStorage.getItem('navi-watch-v1')).decs[0].act, '제출하지 않음'); assert.equal(p.fetched(), 0);
});

test('신고 초안: 사실 10자 이상, 112 안내, 아무에게도 보내지 않는다', { skip }, () => {
  const p = page('report'); assert.match(p.doc.getElementById('wc-r-112').textContent, /112/); p.btn('초안 적어 두기').click(); assert.match(p.txt(), /10자 이상/);
  type(p, 'wc-r-facts', '골목에서 누군가 차량 유리를 깨는 것을 보았습니다'); type(p, 'wc-r-guess', '같은 사람이 전에도 그랬을 것 같다'); p.btn('초안 적어 두기').click(); assert.match(p.doc.getElementById('wc-r-msg').textContent, /아무에게도 보내지 않았어요/); assert.equal(p.fetched(), 0);
});

test('감시 AI에게 묻기는 대화창에 채우기만 한다', { skip }, () => { const p = page('home'); p.btn('감시 AI에게 묻기').click(); assert.equal(p.asks.length, 1); });

test('연결: desktop.html·paths·SP·CSS', () => {
  assert.match(d, /tab-btn-wch/); assert.match(d, /wch-root-host/); assert.match(d, /wch: 'kwatch'/); assert.match(d, /_wchOpen/); assert.match(d, /watch-app\.js\?v=/); assert.match(d, /\['kwatch','감시'\]/);
  assert.match(paths, /watch-app\.js/); assert.match(paths, /watch\.css/); assert.match(sp, /"scr": "감시 화면"/); assert.match(sp, /자신의 무죄를 입증하는 수단/); assert.match(css, /\.wch/); assert.ok(!/\.sch\b/.test(css));
});

test('상대 표시: 기록에 상대를 적으면 해시에 포함되고, 신고 초안에서 고르면 미리보기에 나온다', { skip }, () => {
  const p = page('log'); type(p, 'wc-s-name', '나'); p.btn('대상 추가').click(); type(p, 'wc-e-text', '임대인과 통화로 보증금 반환 거절 들음'); type(p, 'wc-e-with', '임대인 김○○'); p.btn('사슬에 잇기').click();
  const s = JSON.parse(p.w.localStorage.getItem('navi-watch-v1')); assert.equal(s.entries[0].with, '임대인 김○○'); assert.equal(J(p.N.verifyChain(s.entries)).ok, true);
  p.N.view('report'); const c = p.doc.getElementById('wc-rp-1'); c.checked = true; c.dispatchEvent(new p.w.Event('change', { bubbles: true })); assert.match(p.txt(), /상대 임대인 김○○/); assert.match(p.txt(), /고른 기록\s*1건/);
});
