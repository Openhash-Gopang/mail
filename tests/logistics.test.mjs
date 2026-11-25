import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../logistics-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../logistics.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
function page(view) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  w.eval(app); const doc = w.document, asks = [];
  w.NaviLogistics.on('ask', (t) => asks.push(t)); w.NaviLogistics.mount(doc.getElementById('m'), { view });
  return { w, doc, asks, fetched: () => fetched, N: w.NaviLogistics };
}
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviLogistics; };
const fake = (p) => { const q = []; let n = 0; p.w.setTimeout = (fn, ms) => { q.push({ id: ++n, fn, ms }); return n; }; p.w.clearTimeout = (id) => { const k = q.findIndex((x) => x.id === id); if (k >= 0) q.splice(k, 1); }; return q; };
const fire = (q, min) => { const k = q.findIndex((x) => x.ms >= (min || 0)); if (k < 0) return null; const [x] = q.splice(k, 1); x.fn(); return x.ms; };
const nx = (p) => { const c = p.doc.querySelector('.srow.cur'); if (!c) return false; const n = [...p.doc.querySelectorAll('.srow')].find((r) => +r.dataset.i === +c.dataset.i + 1); if (n) n.click(); return !!n; };
const walk = (p, n) => { for (let k = 0; k < n; k++) nx(p); };
const seq = (...v) => { let k = 0; return () => v[k++ % v.length]; };
/** 모든 차량이 (14,14)에 유휴로 서 있는 기본 현황에 차량 일부만 바꿔 쓴다. 차량: L1·L2·L5·L8 소형 밴(8) · L3·L6 트럭(24, 대형 가능) · L4·L7 냉장 탑차(12, 냉장). */
const F = (N, o) => { const f = N.newFleet(() => 0.99); f.forEach((v) => { v.x = 14; v.y = 14; v.bat = 95; v.state = 'idle'; v.job = null; v.spd = 0; v.chgLeft = 0; }); Object.entries(o || {}).forEach(([id, p]) => Object.assign(f.find((v) => v.id === id), p)); return f; };
const TP = (o) => Object.assign({ P: [3, 3], D: [9, 3], Dn: '가상 수령지', vol: 2, kind: 'normal', n: 2 }, o);
const CH = [[3, 3], [10, 12], [12, 4]];
const busy = (to, vol, kind) => ({ state: 'busy', spd: 40, job: { to, vol, kind: kind || 'normal' } });

test('callMessage: 말·문자가 되면 함께, 아니면 오직 물류', { skip }, () => {
  const N = api();
  const v = N.callMessage('voice', '냉장 식자재 보내야 해요'); assert.equal(v.only, false); assert.equal(v.flag, '물류'); assert.equal(v.label, '음성 + 물류');
  const t = N.callMessage('text', '시장으로 입고'); assert.equal(t.mode, 'text'); const n = N.callMessage('none', '무시'); assert.equal(n.only, true); assert.equal(n.body, ''); assert.equal(n.label, '물류');
});

test('배차: 집하 지점에서 가장 빨리 닿는 유휴 차량이 한 대 전용으로 간다', { skip }, () => {
  const N = api(); const r = N.match(TP(), F(N, { L1: { x: 2, y: 2 }, L2: { x: 10, y: 10 } }));
  assert.equal(r.go.kind, 'single'); assert.equal(r.go.legs[0].v.id, 'L1'); assert.equal(r.go.legs[0].was, 'idle'); assert.equal(r.go.legs[0].eta, 3); assert.equal(r.options[0], r.best);
  assert.ok(r.go.arrive > r.go.pickupAt); assert.match(N.planText(r).join(' '), /곧바로 집하 지점/);
});

test('배차: 물품을 싣고 가는 차량은 그 물품을 내려 준 뒤의 위치(이동 경로)에서부터 센다', { skip }, () => {
  const N = api(); const f = F(N, { L1: Object.assign({ x: 0, y: 0, bat: 70 }, busy([3, 4], 2)) });
  const r = N.match(TP({ P: [3, 5], D: [9, 5] }), f), l = r.go.legs[0];
  assert.equal(l.v.id, 'L1'); assert.equal(l.was, 'busy'); assert.equal(l.pooled, false); assert.equal(l.tFree, 9); assert.equal(l.eta, 10); assert.match(N.planText(r).join(' '), /내린 뒤/);
  const s = N.stateAt(f[0], 4); assert.ok(s.x > 0 || s.y > 0); assert.ok(s.bat < 70); assert.equal(N.stateAt(f[0], 20).state, 'idle'); assert.equal(N.stateAt(f[0], 20).x, 3);
});

test('배차: 냉장 장치가 없는 차량·대형을 못 싣는 차량·하역 뒤 충전소까지 갈 배터리가 모자란 차량은 빠진다', { skip }, () => {
  const N = api();
  const a = N.match(TP(), F(N, { L1: { x: 2, y: 3, bat: 12 }, L2: { x: 5, y: 5 } })); assert.equal(a.go.legs[0].v.id, 'L2'); assert.ok(a.why.some((x) => /L1/.test(x[0]) && /배터리/.test(x[1])));
  const c = N.match(TP({ kind: 'cold', vol: 3 }), F(N, { L1: { x: 3, y: 4 }, L4: { x: 9, y: 9 } })); assert.equal(c.go.legs[0].v.id, 'L4'); assert.ok(c.why.some((x) => /L1/.test(x[0]) && /냉장/.test(x[1])));
  const g = N.match(TP({ kind: 'large', vol: 12 }), F(N, { L1: { x: 3, y: 4 }, L4: { x: 3, y: 5 }, L6: { x: 9, y: 9 } })); assert.equal(g.go.legs[0].v.id, 'L6'); assert.ok(g.why.some((x) => /L4/.test(x[0]) && /대형/.test(x[1])));
});

test('배차: 한 대에 못 싣거나 두 대가 더 싸면 두 대로 나눈다(대형은 나누지 않는다)', { skip }, () => {
  const N = api(); const smalls = { L1: { x: 5, y: 6 }, L2: { x: 6, y: 5 } }, P = [5, 5], D = [9, 5];
  const one = N.match(TP({ P, D, vol: 14, n: 14 }), F(N, Object.assign({ L3: { x: 5, y: 6 } }, smalls))); assert.equal(one.go.kind, 'single'); assert.equal(one.go.legs[0].v.id, 'L3', '가까운 트럭 한 대가 낫다');
  const two = N.match(TP({ P, D, vol: 14, n: 14 }), F(N, Object.assign({ L3: { x: 5, y: 9 } }, smalls))); assert.equal(two.go.kind, 'split', '먼 트럭보다 가까운 소형 두 대가 낫다');
  assert.equal(two.go.legs.reduce((a, l) => a + l.vol, 0), 14); two.go.legs.forEach((l) => { assert.ok(l.vol >= 1 && l.vol <= 8); });
  const big = N.match(TP({ P, D, vol: 20, n: 20, kind: 'normal' }), F(N, { L3: { state: 'down' }, L6: { state: 'down' } })); assert.equal(big.go.kind, 'split'); assert.equal(big.go.legs.reduce((a, l) => a + l.vol, 0), 20);
  const lg = N.match(TP({ kind: 'large', vol: 16, n: 16 }), F(N, {})); assert.equal(lg.go.legs.length, 1, '대형 물품은 나누지 않는다'); assert.equal(lg.go.legs[0].v.type, 'truck');
});

test('합차: 이미 물품을 싣고 가는 차량의 남는 자리에 함께 싣고, 기존 물품은 먼저 내린다(지연이 한도 안일 때만)', { skip }, () => {
  const N = api(), f = F(N, { L1: Object.assign({ x: 4, y: 5, bat: 80 }, busy([10, 6], 3)) });
  const r = N.match(TP({ P: [5, 5], D: [10, 7] }), f), l = r.go.legs[0];
  assert.equal(r.go.kind, 'pool'); assert.equal(l.v.id, 'L1'); assert.equal(l.pooled, true); assert.equal(l.exist.vol, 3); assert.equal(l.exist.delay, 2); assert.equal(l.exist.arrive1, 11); assert.equal(l.arrive, 13);
  assert.match(N.planText(r).join(' '), /합차/);
  const at = (t) => N.fleetAt(f, r.go, null, t).find((x) => x.v.id === 'L1');
  assert.equal(at(5).cg, 5, '집하 뒤 기존 3 + 새 2 를 함께 싣는다'); assert.equal(at(11).x, 10); assert.equal(at(12).cg, 2, '기존 물품을 내리고 새 물품만 남는다'); assert.equal(at(13).cg, 0);
  assert.ok(r.options.every((o) => o.cost >= r.best.cost));
  const far = N.match(TP({ P: [12, 5], D: [4, 12] }), F(N, { L1: Object.assign({ x: 4, y: 5, bat: 95 }, busy([4, 13], 3)) })); assert.notEqual(far.go.kind, 'pool'); assert.ok(far.why.some((x) => /L1/.test(x[0]) && /늦어져요/.test(x[1])));
  const full = N.match(TP({ P: [5, 5], D: [10, 7], vol: 6 }), F(N, { L1: Object.assign({ x: 4, y: 5, bat: 80 }, busy([10, 6], 5)) })); assert.notEqual(full.go.kind, 'pool', '남는 자리(8-5=3)보다 크면 합차하지 않는다');
});

test('배차: 쓸 수 있는 차량이 없으면 가장 빨리 충전을 마치고 오는 차량으로 안내하고, 모두 점검이면 계획이 없다', { skip }, () => {
  const N = api(); const f = F(N, {}); f.forEach((v) => { v.x = 1; v.y = 2; v.bat = 20; });
  const r = N.match(TP({ P: [1, 1], D: [13, 13] }), f); assert.equal(r.best, null); assert.equal(r.go.kind, 'charge'); assert.ok(r.go.legs[0].chg); assert.match(N.planText(r).join(' '), /충전/);
  const l = r.go.legs[0]; assert.ok(l.eta > 60); assert.ok(l.batEnd > 15);
  const dead = F(N, {}); dead.forEach((v) => { v.state = 'down'; }); assert.equal(N.match(TP(), dead).go, null);
});

test('실시간 갱신: 배정 차량이 멈추면 그 물량만 그 시각 현황으로 다시 배차하고, 길이 막히면 도착이 늦어지되 배터리 여유는 남는다', { skip }, () => {
  const N = api(); const f = F(N, { L1: { x: 1, y: 9 }, L2: { x: 6, y: 9 }, L3: { x: 12, y: 9 } }); const tp = TP({ P: [3, 3], D: [11, 3] }), p0 = N.match(tp, f), l0 = p0.go.legs[0];
  assert.equal(l0.v.id, 'L1'); assert.ok(l0.eta >= 8); const at = 4;
  const a = N.match(tp, f, { at, prev: p0, fault: 'L1' }); assert.notEqual(a.go.legs[0].v.id, 'L1'); assert.ok(a.go.legs[0].eta >= at); assert.ok(a.why.some((x) => /L1/.test(x[0]) && /멈췄/.test(x[1])));
  const e = N.detourGo(p0.go, 10, 4); assert.ok(e.arrive > p0.go.arrive); assert.ok(e.legs[0].batEnd < p0.go.legs[0].batEnd); assert.equal(e.legs[0].detour, 4);
  const rows = N.fleetAt(f, e, null, e.arrive); const mine = rows.find((x) => x.v.id === 'L1'); assert.equal(mine.x, 11); assert.equal(mine.y, 3); assert.equal(mine.cg, 0);
});

test('배차: 어떤 차량 현황·수요에서도 규칙이 지켜진다(무작위 800회)', { skip }, () => {
  const N = api(); let goes = 0, pools = 0;
  const cap = { small: 8, truck: 24, cold: 12 };
  for (let n = 0; n < 800; n++) {
    const f = N.newFleet(Math.random); f.forEach((v) => { if (Math.random() < 0.15) { v.state = 'down'; v.job = null; } });
    const kind = ['normal', 'normal', 'cold', 'large'][n % 4], cnt = kind === 'large' ? 4 + (n % 13) : kind === 'cold' ? 1 + (n % 10) : 1 + (n % 20), P = [1 + (n * 7) % 13, 1 + (n * 5) % 13], D = [1 + (n * 3) % 13, 1 + (n * 11) % 13];
    if (Math.abs(P[0] - D[0]) + Math.abs(P[1] - D[1]) < 3) continue;
    const r = N.match({ P, D, Dn: 'x', vol: cnt, kind, n: cnt }, f); if (!r.go) { assert.equal(r.fb, null); assert.equal(r.best, null); continue; }
    goes++; assert.equal(r.go.legs.reduce((a, l) => a + l.vol, 0), cnt); assert.equal(new Set(r.go.legs.map((l) => l.v.id)).size, r.go.legs.length); if (r.go.kind === 'pool') pools++;
    r.go.legs.forEach((l) => { if (kind === 'cold') assert.equal(l.v.type, 'cold'); if (kind === 'large') assert.equal(l.v.type, 'truck'); assert.ok(l.vol <= cap[l.v.type]); assert.ok(l.arrive > l.eta && l.eta >= l.tFree); assert.ok(l.batEnd - 0.7 * Math.min(...CH.map((c) => Math.abs(c[0] - D[0]) + Math.abs(c[1] - D[1]))) >= 15 - 1e-9, '하역 뒤에도 충전소까지 갈 배터리');
      if (l.pooled) { assert.ok(l.exist.vol + l.vol <= cap[l.v.type]); assert.ok(l.exist.delay >= 0 && l.exist.delay <= 10); } });
    if (r.best) { assert.equal(r.options[0], r.best); r.options.forEach((o) => assert.ok(o.cost >= r.best.cost)); } else assert.equal(r.go.kind, 'charge');
  }
  assert.ok(goes > 500);
});

test('draw: 수요·기기가 무작위로 정해지고 서명이 붙으며, 이름은 보내는 정보에 들어가지 않는다(익명화)', { skip }, () => {
  const N = api(); const a = N.draw(seq(0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7), 0), b = N.draw(seq(0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7), 0);
  assert.equal(a.sig, b.sig); assert.match(a.sig, /^SIG-[0-9a-f]{16}$/); assert.equal(N.verify(a), true); assert.equal(N.verify(Object.assign({}, a, { payload: a.payload + '변조' })), false);
  const seen = new Set(), devs = new Set(), accs = new Set(); let multi = 0;
  for (let i = 0; i < 300; i++) { const s = N.draw(Math.random); seen.add(s.c.id); devs.add(s.dev); accs.add(s.acc); if (s.n > 1) multi++; assert.match(s.anon, /^ANON-[0-9A-F]{6}$/); assert.ok(!s.payload.includes(s.rider.name), '이름은 보내지 않는다'); assert.match(s.no, /^LG-/); if (s.dev === 'ring') assert.equal(s.msg.only, true);
    assert.ok(s.P[0] >= 1 && s.P[0] <= 13 && s.P[1] >= 1 && s.P[1] <= 13); assert.ok(Math.abs(s.P[0] - s.D[0]) + Math.abs(s.P[1] - s.D[1]) >= 3); if (s.can === 'none') assert.equal(s.destVia, 'PDV 일정'); }
  assert.equal(seen.size, 8); assert.equal(devs.size, 3); assert.equal(accs.size, 3); assert.ok(multi > 100);
});

test('19단계: 처음엔 패널이 닫혀 있고, 1-1 부터 열면 다음 단계가 풀리며 다음 막대가 천천히 깜박인다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x);
  assert.equal(p.doc.querySelectorAll('#lg-bar .tick').length, 19); assert.equal(p.doc.querySelectorAll('#lg-list .srow').length, 19); assert.equal(p.doc.querySelectorAll('[role="tab"]').length, 0);
  assert.equal(!!id('lg-ipanel'), false); assert.match(id('lg-bar-cap').textContent, /^0 \/ 19/); assert.equal(id('lg-row-2-1').disabled, true); assert.equal(id('lg-row-1-1').disabled, false);
  id('lg-row-1-1').click(); assert.match(id('lg-ph-t').textContent, /^1-1 기기 호출/); assert.equal(id('lg-row-1-1').nextElementSibling, id('lg-ipanel'));
  assert.equal(id('lg-row-1-2').disabled, false); assert.equal(id('lg-row-1-3').disabled, true); assert.ok(id('lg-row-1-2').classList.contains('blink') && id('lg-row-1-2').classList.contains('slow'));
  nx(p); assert.match(id('lg-ph-t').textContent, /^1-2/); id('lg-prev').click(); assert.match(id('lg-ph-t').textContent, /^1-1/); id('lg-row-1-1').click(); assert.equal(!!id('lg-ipanel'), false);
});

test('19단계: 수요 150건을 끝까지 따라가도 모든 패널에 내용이 있고 undefined·NaN 이 없으며, 단계마다 핵심 값이 보인다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x); const kinds = new Set();
  for (let k = 0; k < 150; k++) {
    id('lg-draw').click(); id('lg-row-1-1').click();
    for (let i = 0; i < 19; i++) { const t = id('lg-ph-t').textContent, body = id('lg-pbody').textContent; assert.ok(body.length > 15, t); assert.ok(!/undefined|NaN|\[object|null|Infinity/.test(body), t + ' ' + body.slice(0, 120)); if (i < 18) nx(p); }
    assert.ok(id('lg-s4-fleet')); assert.ok(id('lg-s4-sig0')); assert.match(id('lg-s4-zones').textContent, /서북/); kinds.add(id('lg-s4-end').textContent.slice(0, 3));
  }
  assert.doesNotMatch(p.doc.getElementById('lg-root').textContent, /응급 AI|구급대|환자|승차|탑승/);
});

test('2-2~2-6: 목적지·일행·편의가 보이고, 2-4 의 점검 토글이 2-5 배차를 바꾸며, 지시서(3-1) 뒤에는 잠긴다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x); id('lg-draw').click(); id('lg-row-1-1').click(); walk(p, 5);
  assert.match(id('lg-ph-t').textContent, /^2-2/); assert.ok(id('lg-s2-dest').textContent.length > 3); assert.match(id('lg-s2-party').textContent, /부피 \d+/); assert.ok(id('lg-s2-need').textContent.length > 3);
  walk(p, 2); assert.match(id('lg-ph-t').textContent, /^2-4/); assert.ok(id('lg-s2-fleet')); assert.equal(id('lg-s2-fleet').querySelectorAll('tbody tr').length, 8); const chips = p.doc.querySelectorAll('#lg-ipanel .chip[data-down]'); assert.equal(chips.length, 8);
  walk(p, 1); assert.match(id('lg-ph-t').textContent, /^2-5/); assert.ok(id('lg-m-res')); assert.ok(id('lg-m-opts')); const kind0 = id('lg-m-start').textContent;
  id('lg-row-2-4').click(); [...p.doc.querySelectorAll('#lg-ipanel .chip[data-down]')].forEach((b) => { if (b.getAttribute('aria-pressed') === 'false') b.click(); });
  id('lg-row-2-5').click(); assert.ok(id('lg-nogo'), '모든 차량이 점검이면 배차할 수 없다'); id('lg-row-2-4').click(); [...id('lg-ipanel').querySelectorAll('.btn')].find((b) => b.textContent === '처음 상태로').click();
  id('lg-row-2-5').click(); assert.equal(id('lg-m-start').textContent, kind0, '처음 상태로 되돌리면 같은 배차');
  id('lg-row-2-6').click(); walk(p, 1); assert.match(id('lg-ph-t').textContent, /^3-1/); id('lg-row-2-4').click(); assert.equal(p.doc.querySelectorAll('#lg-ipanel .chip[disabled]').length, p.doc.querySelectorAll('#lg-ipanel .chip').length, '지시서 뒤에는 현황을 바꿀 수 없다');
});

test('3단계: 실시간 차량 표(위치·속도·경로·배터리·탑승)가 막대를 끌면 바뀌고, 탑승 인원이 갱신된다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x); id('lg-draw').click(); id('lg-row-1-1').click(); walk(p, 11); assert.match(id('lg-ph-t').textContent, /^3-2/);
  assert.ok(id('lg-lv')); const n0 = id('lg-lv').querySelectorAll('tbody tr').length; assert.ok(n0 >= 1 && n0 <= 2); const mx = +id('lg-t').max; const sn = () => id('lg-lv-body').textContent;
  const s0 = sn(); id('lg-t').value = String(mx); id('lg-t').dispatchEvent(new p.w.Event('input')); assert.notEqual(sn(), s0); assert.match(sn(), /하역 완료/);
  nx(p); assert.match(id('lg-ph-t').textContent, /^3-3/); assert.match(id('lg-s3-board').textContent, /^\d+$/); assert.match(id('lg-s3-match').textContent, /일치/); assert.match(id('lg-s3-pax0').textContent, /\d+ → \d+/);
  nx(p); assert.match(id('lg-ph-t').textContent, /^3-4/); assert.equal(id('lg-lv').querySelectorAll('tbody tr').length, 8);
});

test('3-5: 운행 중 사건을 일으키면 새 계획이 나오고 앞 단계는 그때의 판단을 보여 주며, 4단계는 새 계획을 따른다', { skip }, () => {
  const kinds = new Set();
  for (let k = 0; k < 60; k++) {
    const p = page(); const id = (x) => p.doc.getElementById(x); id('lg-draw').click(); id('lg-row-1-1').click(); walk(p, 10); assert.match(id('lg-ph-t').textContent, /^3-1/);
    const plan0 = id('lg-s3-tbl').textContent; walk(p, 4); assert.match(id('lg-ph-t').textContent, /^3-5/); assert.equal(id('lg-ev-new'), null);
    id('lg-ev').click(); assert.ok(id('lg-ev-new')); assert.equal(id('lg-ev').disabled, true); kinds.add(/실시간 재배차/.test(id('lg-ipanel').textContent) ? 'fault' : 'closure');
    id('lg-row-3-1').click(); assert.equal(id('lg-s3-tbl').textContent, plan0); id('lg-row-3-5').click(); nx(p); assert.match(id('lg-ph-t').textContent, /^4-1/); assert.ok(id('lg-s4-arrive'));
    walk(p, 3); assert.match(id('lg-ph-t').textContent, /^4-4/); assert.doesNotMatch(id('lg-pbody').textContent, /undefined|NaN/);
  }
  assert.ok(kinds.has('closure')); assert.ok(kinds.has('fault'));
});

test('4단계: 하차 → 거리로 정산 → 차량 갱신(배터리 낮으면 충전) → 전체 현황과 재배치', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x); let chg = false, move = false, stay = false;
  for (let k = 0; k < 100; k++) { id('lg-draw').click(); id('lg-row-1-1').click(); walk(p, 15); assert.match(id('lg-ph-t').textContent, /^4-1/); assert.match(id('lg-s4-pax0').textContent, /\d+ → 0/);
    nx(p); assert.match(id('lg-ph-t').textContent, /^4-2/); assert.match(id('lg-s4-total').textContent, /GDC\(가상\)/); assert.match(id('lg-pbody').textContent, /실제 결제가 일어나지 않아요/);
    nx(p); assert.match(id('lg-ph-t').textContent, /^4-3/); if (/충전소/.test(id('lg-s4-veh').textContent)) chg = true;
    nx(p); assert.match(id('lg-ph-t').textContent, /^4-4/); assert.equal(id('lg-s4-fleet').querySelectorAll('tbody tr').length, 8); if (/미리 보내 둬요/.test(id('lg-s4-rebal').textContent)) move = true; else stay = true; }
  assert.ok(chg && move && stay);
});

test('시뮬레이션 버튼: 오른쪽 위에서 열면 1-1 부터 자동으로 끝까지 진행하고, 닫기·바깥 클릭으로 닫힌다', { skip }, () => {
  const p = page(); const q = fake(p); const id = (x) => p.doc.getElementById(x);
  assert.ok(id('lg-sim')); id('lg-sim').click(); assert.equal(id('lg-sim').disabled, true); assert.ok(id('lg-apanel').classList.contains('open')); assert.match(id('lg-au-t').textContent, /^1-1/);
  for (let k = 0; k < 40 && q.length; k++) { fire(q, 4000); if (id('lg-au-t').textContent.startsWith('4-4')) break; }
  assert.match(id('lg-au-t').textContent, /^4-4/); assert.ok(id('lg-au-body').textContent.length > 30);
  id('lg-back').click(); while (q.length) q.shift().fn(); assert.equal(id('lg-apanel').classList.contains('open'), false); assert.equal(id('lg-sim').disabled, false);
});

test('시뮬레이션은 화면의 단계 목록·패널과 완전히 분리되어 있고 id 가 겹치지 않는다', { skip }, () => {
  const p = page(); const q = fake(p); const id = (x) => p.doc.getElementById(x);
  id('lg-draw').click(); id('lg-row-1-1').click(); walk(p, 2);
  const snap = () => ({ cap: id('lg-bar-cap').textContent, hint: id('lg-next-hint').textContent, rows: [...p.doc.querySelectorAll('.srow .sst')].map((x) => x.textContent).join(), panel: id('lg-ipanel').innerHTML });
  const before = snap(); id('lg-sim').click();
  for (let k = 0; k < 25 && q.length; k++) { fire(q, 4000); if (id('lg-au-t').textContent.startsWith('4-')) break; }
  assert.deepEqual(snap(), before); assert.equal(p.doc.querySelectorAll('[id]').length, new Set([...p.doc.querySelectorAll('[id]')].map((x) => x.id)).size);
  id('lg-row-1-2').click(); assert.match(id('lg-au-t').textContent, /^4-/); assert.match(id('lg-ph-t').textContent, /^1-2/); assert.equal(id('lg-panel'), null);
});

test('새 수요 뽑기: 처음엔 깜박이고, 뽑은 뒤에는 다음 할 일 배너가 따라온다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x);
  assert.ok(id('lg-draw').classList.contains('blink')); assert.equal(id('lg-next-hint'), null); id('lg-draw').click(); assert.equal(id('lg-draw').classList.contains('blink'), false);
  assert.match(id('lg-next-hint').textContent, /1-1 기기 호출/); id('lg-row-1-1').click(); assert.match(id('lg-next-hint').textContent, /천천히 깜박이는 “1-2 메시지 구성”/);
});

test('평소 준비: 기기·꺼낼 정보·허용한 질문은 이 브라우저에만 저장되고 외부로 나가지 않는다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x);
  assert.ok(id('lg-sh-loc').disabled); assert.match(id('lg-s-prep').textContent, /물류 AI에 보낼 정보/); assert.doesNotMatch(id('lg-s-prep').textContent, /응급|교통 AI/);
  id('lg-sh-sched').click(); assert.match(p.w.localStorage.getItem('navi-lgs-v2'), /sched/); assert.equal(p.fetched(), 0);
  const res = []; p.N.on('result', (x) => res.push(x)); p.N.nav({ do: 'consent' }); p.N.nav({ do: 'nope' }); assert.equal(res[0].ok, true); assert.equal(res[1].ok, false);
  p.N.view('principle'); assert.ok(id('lg-list'));
});

test('Material Design 3 와 레이아웃: 응급·치안·의료와 같은 규격, .lgs 안으로 한정, 네트워크 호출 없음', () => {
  assert.match(css, /--md-ease:cubic-bezier\(\.2,0,0,1\)/); assert.match(css, /\.lgs \.bar\{display:grid;grid-template-columns:4fr 6fr 5fr 4fr/); assert.match(css, /\.lgs \.ipanel\{[^}]*border-radius:16px/);
  const sel = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').split('}').map((x) => x.split('{')[0].trim()).filter((x) => x && !x.startsWith('@') && !/^\d+%|^from|^to/.test(x));
  assert.deepEqual(sel.filter((x) => x.split(',').some((y) => !/\.lgs\b/.test(y))).slice(0, 5), []);
  assert.doesNotMatch(app, /fetch\(|XMLHttpRequest|sendBeacon/); assert.doesNotMatch(css, /\.emg\b/);
});

test('도우미 카드: 평소 준비 구역에 있고, 도우미로 열면 이벤트가 나가며 결과가 화면에 보인다(발송 신청·결제는 하지 않는다)', { skip }, () => {
  const p = page('parcels'); const id = (x) => p.doc.getElementById(x); assert.ok(id('lg-agent')); assert.match(id('lg-agent').textContent, /발송 신청과 결제는 하지 않아요/);
  const got = []; p.N.on('agent', (j) => got.push(j)); [...id('lg-agent').querySelectorAll('button')].find((b) => /도우미로 열기/.test(b.textContent)).click();
  assert.equal(got.length, 1); assert.equal(got[0].kind, 'epost'); assert.match(got[0].url, /service\.epost\.go\.kr/); p.N.agentResult(true, '도우미가 배송 조회를 시작합니다.'); assert.match(id('lg-ag-msg').textContent, /시작합니다/);
  const q = page(); const sel = q.doc.getElementById('lg-ag'); sel.value = 'unipass'; sel.onchange(); [...q.doc.getElementById('lg-agent').querySelectorAll('button')].find((b) => /도우미로 열기/.test(b.textContent)).click(); assert.match(q.doc.getElementById('lg-ag-msg').textContent, /쓸 수 없는/);
});

test('desktop.html 연결과 배포 목록', () => {
  assert.ok(d.includes("_lgsOpen('call')") && d.includes("go.indexOf('lgs:') === 0") && d.includes("if (name === 'lgs') _lgsShow();") && d.includes('id="tab-lgs"') && d.includes("NaviLogistics.on('agent'"));
  assert.match(d, /물류 시뮬레이션>lgs:call/); assert.match(d, /평소 준비>lgs:prep/); assert.match(d, /logistics-app\.js/); assert.match(d, /logistics\.css/); assert.match(paths, /"logistics-app\.js"/); assert.match(paths, /"logistics\.css"/);
  assert.doesNotMatch(d, /물류 원리>lgs|합차 효과>lgs|물품 메모>lgs/);
});
