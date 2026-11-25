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
  return { w, doc, asks, fetched: () => fetched, N: w.NaviMedical };
}
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviMedical; };
const fake = (p) => { const q = []; let n = 0; p.w.setTimeout = (fn, ms) => { q.push({ id: ++n, fn, ms }); return n; }; p.w.clearTimeout = (id) => { const k = q.findIndex((x) => x.id === id); if (k >= 0) q.splice(k, 1); }; return q; };
const fire = (q, min) => { const k = q.findIndex((x) => x.ms >= (min || 0)); if (k < 0) return null; const [x] = q.splice(k, 1); x.fn(); return x.ms; };
const nx = (p) => { const c = p.doc.querySelector('.srow.cur'); if (!c) return false; const n = [...p.doc.querySelectorAll('.srow')].find((r) => +r.dataset.i === +c.dataset.i + 1); if (n) n.click(); return !!n; };
const walk = (p, n) => { for (let k = 0; k < n; k++) nx(p); };
const seq = (...v) => { let k = 0; return () => v[k++ % v.length]; };

const IDS = ['back', 'belly', 'neuro', 'child', 'chest', 'skin', 'ankle', 'sugar'];
test('callMessage: 말·문자가 되면 함께, 아니면 오직 의료', { skip }, () => {
  const N = api();
  const v = N.callMessage('voice', '허리가 아파요'); assert.equal(v.only, false); assert.equal(v.flag, '의료'); assert.equal(v.label, '음성 + 의료');
  const t = N.callMessage('text', '열이 나요'); assert.equal(t.mode, 'text'); const n = N.callMessage('none', '무시'); assert.equal(n.only, true); assert.equal(n.body, ''); assert.equal(n.label, '의료');
});

test('match: 기본 현황에서 진료과·장비·중증도에 맞는 기관이 고른다(가까운 곳도 먼 곳도 같은 기준)', { skip }, () => {
  const N = api(); const m = (id, pl) => N.match(id, pl, N.newHosp(), N.newFleet());
  const a = m('back', 'p1'); assert.equal(a.go.kind, 'single'); assert.equal(a.go.fac.name, '가상 중앙병원'); assert.equal(a.veh.esc, null);
  const far = m('back', 'p4'); assert.equal(far.go.fac.name, '가상 산악병원', '정형외과·MRI 가 있는 곳이라면 멀어도 간다');
  const rem = m('skin', 'p1'); assert.equal(rem.go.kind, 'remote'); assert.ok(rem.go.doc.docs['피부과'] && !rem.go.fac.docs['피부과']); assert.equal(rem.go.start, rem.go.tPatient + 2);
  const neuro = m('neuro', 'p1'); assert.ok(neuro.veh.esc, '중증은 의료진이 동승'); assert.equal(neuro.go.fac.lvl, '병원'); assert.match(N.planText(neuro).join(' '), /동승/);
  const chest = m('chest', 'p2'); assert.equal(chest.go.fac.lvl, '병원', '중증은 보건소·의원으로 가지 않는다'); assert.ok(chest.why.some((x) => /병원급/.test(x[1])));
  assert.equal(N.match('nope', 'p1', N.newHosp(), N.newFleet()), null);
});

test('match: 원격이 안 되는 진료는 의사가 직접 오고(split), 조합이 없으면 가장 가까운 병원에서 안정화(stabilize), 차량이 없으면 돌려 보낸다(reassign)', { skip }, () => {
  const N = api(); const H = N.newHosp(), F = N.newFleet();
  H.find((x) => x.id === 'h2').docs['외과'] = false; H.find((x) => x.id === 'h1').eq['초음파'] = false;   // 외과 의사는 중앙병원만, 초음파·CT 는 해안병원만
  const s = N.match('belly', 'p2', H, F); assert.equal(s.go.kind, 'split'); assert.equal(s.go.fac.name, '가상 해안병원'); assert.equal(s.go.doc.name, '가상 중앙병원'); assert.ok(s.go.start >= s.go.tPatient); assert.match(N.planText(s).join(' '), /직접 봐야 하는 진료/);
  const H2 = N.newHosp(); H2.forEach((x) => { Object.keys(x.eq).forEach((k) => { if (k === 'CT') x.eq[k] = false; }); });
  const st = N.match('neuro', 'p1', H2, N.newFleet()); assert.equal(st.best, null); assert.equal(st.go.kind, 'stabilize'); assert.equal(st.go.fac.lvl, '병원'); assert.match(N.planText(st).join(' '), /안정화/);
  const F2 = N.newFleet(); F2.forEach((v) => { v.free = false; }); const re = N.match('back', 'p1', N.newHosp(), F2); assert.equal(re.veh.turned, true); assert.ok(re.veh.eta >= 3); assert.ok(re.why.some((x) => /돌려 보내요/.test(x[1])));
});

test('match(live): 이송 중 목적 기관의 장비가 막히면 그 시각의 환자 위치에서 다시 고르고, 차량은 그대로이며 막힌 기관은 빠진다', { skip }, () => {
  const N = api(); const H = N.newHosp(), F = N.newFleet(); const p0 = N.match('back', 'p2', H, F), g0 = p0.go;
  const at = Math.min(Math.max(p0.veh.eta + 1, Math.round(g0.tPatient * 0.5)), Math.max(p0.veh.eta, g0.tPatient - 1));
  H.find((x) => x.id === g0.fac.id).eq['MRI'] = false; const a = N.match('back', 'p2', H, F, { at, prev: p0 });
  assert.equal(a.veh.id, p0.veh.id); assert.notEqual(a.go.fac.id, g0.fac.id); assert.ok(a.go.tPatient >= at); assert.match(N.planText(a).join(' '), /이동을 이어 가고/);
  a.options.forEach((o) => assert.ok(o.fac.eq['MRI'] === true && o.start >= at));
});

test('match: 어떤 기관·차량·장비 상태에서도 항상 계획이 있고 규칙이 지켜진다(무작위 1500회)', { skip }, () => {
  const N = api(); let k = 0;
  for (let n = 0; n < 1500; n++) {
    const H = N.newHosp(), F = N.newFleet(); H.forEach((x) => { Object.keys(x.docs).forEach((d) => { if (Math.random() < 0.25) x.docs[d] = !x.docs[d]; }); Object.keys(x.eq).forEach((d) => { if (Math.random() < 0.25) x.eq[d] = !x.eq[d]; }); }); F.forEach((v) => { if (Math.random() < 0.35) v.free = false; });
    const id = IDS[n % 8], r = N.match(id, ['p1', 'p2', 'p3', 'p4'][(n >> 3) % 4], H, F), c = r.c; k++;
    assert.ok(r.go); if (c.sev === '중증') assert.equal(r.go.fac.lvl, '병원');
    if (r.best) { assert.equal(r.options[0], r.best); r.options.forEach((o) => { assert.ok(r.eqs.every((e) => o.fac.eq[e] === true)); assert.ok(o.start >= r.best.start); if (o.kind === 'single') assert.equal(o.fac.docs[c.sp], true); if (o.kind === 'remote') assert.ok(c.remote && o.fac.docs[c.sp] !== true && o.doc.docs[c.sp] === true); if (o.kind === 'split') assert.ok(!c.remote && o.doc.docs[c.sp] === true); }); } else assert.equal(r.go.kind, 'stabilize');
    assert.equal(r.veh.turned, !F.some((v) => v.free));
  }
  assert.equal(k, 1500);
});

test('draw: 환자·기기가 무작위로 정해지고 서명이 붙으며, 이름은 보내는 정보에 들어가지 않는다(익명화)', { skip }, () => {
  const N = api(); const a = N.draw(seq(0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7), 0), b = N.draw(seq(0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7), 0);
  assert.equal(a.sig, b.sig); assert.match(a.sig, /^SIG-[0-9a-f]{16}$/); assert.equal(N.verify(a), true); assert.equal(N.verify(Object.assign({}, a, { payload: a.payload + '변조' })), false);
  const seen = new Set(), sev = new Set(), devs = new Set();
  for (let i = 0; i < 200; i++) { const s = N.draw(Math.random); seen.add(s.c.id); sev.add(s.c.sev); devs.add(s.dev); assert.match(s.anon, /^ANON-[0-9A-F]{6}$/); assert.ok(!s.payload.includes(s.patient.name), '이름은 보내지 않는다'); assert.match(s.no, /^MD-/); if (s.dev === 'ring') assert.equal(s.msg.only, true);
    assert.ok(s.course.rounds.length >= 1 && s.course.rounds.length <= 5); assert.ok(['완치(퇴원)', '퇴원(외래 추적)', '상급 기관 전원'].includes(s.course.end)); assert.equal(s.rank1.length, 3); assert.equal(new Set(s.rank1.map((x) => x.i)).size, 3);
    assert.ok(s.doc.pick === s.rank1[0].i || s.doc.pick === s.rank1[1].i); }
  assert.equal(seen.size, 8); assert.equal(sev.size, 3); assert.equal(devs.size, 3);
});

test('경과: 호전이 충분하면 퇴원, 악화가 두 번이면 전원, 경증은 한 번 호전으로 퇴원한다', { skip }, () => {
  const N = api(); const ends = {};
  for (let i = 0; i < 600; i++) { const s = N.draw(Math.random), co = s.course, tr = co.rounds.map((x) => x.trend), good = tr.filter((x) => x === '호전').length, bad = tr.filter((x) => x === '악화').length;
    ends[co.end] = (ends[co.end] || 0) + 1;
    if (co.end === '상급 기관 전원') { assert.equal(bad, 2); assert.equal(tr[tr.length - 1], '악화'); }
    else if (tr.length < 5) assert.equal(good, s.c.sev === '경증' ? 1 : 2);
    assert.ok(good <= (s.c.sev === '경증' ? 1 : 2)); assert.ok(bad <= 2); }
  assert.ok(ends['상급 기관 전원'] > 0 && ends['완치(퇴원)'] > 0 && ends['퇴원(외래 추적)'] > 0);
});

test('진료 참고 목록: 이상으로 나온 검사가 순위를 바꾸고, 동점이면 앞 후보가 먼저이며 확률은 지어내지 않는다', { skip }, () => {
  const N = api(); const c = N.draw(() => 0.0).c; const none = N.rankList(c, null); assert.equal(none.map((x) => x.name).join(), '후보 A,후보 B,후보 C');
  const allAb = {}; c.tests.forEach((t) => { allAb[t] = true; }); const r = N.rankList(c, allAb); assert.equal(r.length, 3); assert.ok(r.every((x) => /^후보 [ABC]$/.test(x.name)));
  const s = N.draw(Math.random); assert.doesNotMatch(JSON.stringify(s.rank1), /%|확률/);
});

test('19단계: 처음엔 패널이 닫혀 있고, 1-1 부터 열면 다음 단계가 풀리며 다음 막대가 천천히 깜박인다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x);
  assert.equal(p.doc.querySelectorAll('#med-bar .tick').length, 19); assert.equal(p.doc.querySelectorAll('#med-list .srow').length, 19); assert.equal(p.doc.querySelectorAll('[role="tab"]').length, 0);
  assert.equal(!!id('med-ipanel'), false); assert.match(id('med-bar-cap').textContent, /^0 \/ 19/); assert.equal(id('med-row-2-1').disabled, true); assert.equal(id('med-row-1-1').disabled, false);
  id('med-row-1-1').click(); assert.match(id('med-ph-t').textContent, /^1-1 기기 호출/); assert.equal(id('med-row-1-1').nextElementSibling, id('med-ipanel'));
  assert.equal(id('med-nextstep'), null); assert.equal(id('med-row-1-2').disabled, false); assert.equal(id('med-row-1-3').disabled, true); assert.ok(id('med-row-1-2').classList.contains('blink') && id('med-row-1-2').classList.contains('slow'));
  nx(p); assert.match(id('med-ph-t').textContent, /^1-2/); id('med-prev').click(); assert.match(id('med-ph-t').textContent, /^1-1/); id('med-row-1-1').click(); assert.equal(!!id('med-ipanel'), false);
});

test('19단계: 환자 150명을 끝까지 따라가도 모든 패널에 내용이 있고 undefined·NaN 이 없으며, 단계마다 핵심 값이 보인다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x); const ends = new Set();
  for (let k = 0; k < 150; k++) {
    id('med-draw').click(); id('med-row-1-1').click();
    for (let i = 0; i < 19; i++) { const t = id('med-ph-t').textContent, body = id('med-pbody').textContent; assert.ok(body.length > 15, t); assert.ok(!/undefined|NaN|\[object|null/.test(body), t + ' ' + body.slice(0, 80)); if (i < 18) nx(p); }
    assert.ok(id('med-s4-rounds')); assert.ok(id('med-s4-sig0')); ends.add(id('med-s4-end').textContent.split('·')[1].trim());
  }
  assert.equal(ends.size, 3); assert.doesNotMatch(p.doc.getElementById('med-root').textContent, /응급 AI|구급대|신고/);
});

test('2-2~2-6: 중증도·진료과·검사가 보이고, 2-4 의 장비·의사 토글이 2-5 선정을 바꾸며, 지시서(3-1) 뒤에는 잠긴다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x); id('med-draw').click(); id('med-row-1-1').click(); walk(p, 5);
  assert.match(id('med-ph-t').textContent, /^2-2/); assert.match(id('med-s2-sev').textContent, /경증|중등|중증/); assert.ok(id('med-s2-sp').textContent.length > 1); assert.ok(id('med-s2-tests').textContent.length > 1);
  walk(p, 2); assert.match(id('med-ph-t').textContent, /^2-4/); assert.ok(id('med-s2-units')); const chips = p.doc.querySelectorAll('#med-ipanel .chip'); assert.ok(chips.length >= 2);
  walk(p, 1); assert.match(id('med-ph-t').textContent, /^2-5/); assert.ok(id('med-m-res')); assert.ok(id('med-m-opts') || id('med-m-kind'));
  const kind0 = id('med-m-kind').textContent; id('med-row-2-4').click(); [...p.doc.querySelectorAll('#med-ipanel .chip[data-eq]')].forEach((b) => { if (b.getAttribute('aria-pressed') === 'true') b.click(); });
  id('med-row-2-5').click(); assert.notEqual(id('med-m-kind').textContent, kind0, '모든 장비를 막으면 선정이 달라진다');
  id('med-row-2-6').click(); walk(p, 1); assert.match(id('med-ph-t').textContent, /^3-1/); id('med-row-2-4').click(); assert.equal(p.doc.querySelectorAll('#med-ipanel .chip[disabled]').length, p.doc.querySelectorAll('#med-ipanel .chip').length, '지시서 뒤에는 현황을 바꿀 수 없다');
});

test('3-5: 이송 중 사건을 일으키면 새 목적지가 나오고 앞 단계는 그때의 판단을 보여 주며, 4단계는 새 계획을 따른다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x); id('med-draw').click(); id('med-row-1-1').click(); walk(p, 10); assert.match(id('med-ph-t').textContent, /^3-1/);
  const plan0 = id('med-s3-tbl').textContent; walk(p, 4); assert.match(id('med-ph-t').textContent, /^3-5/); assert.equal(id('med-ev-new'), null);
  id('med-ev').click(); assert.ok(id('med-ev-new')); assert.equal(id('med-ev').disabled, true); assert.match(id('med-ipanel').textContent, /갑자기|당직/);
  id('med-row-3-1').click(); assert.equal(id('med-s3-tbl').textContent, plan0); id('med-row-3-5').click(); nx(p); assert.match(id('med-ph-t').textContent, /^4-1/); assert.ok(id('med-s4-tests'));
});

test('4단계: 검사 → AI 진단 의견(순위 변화) → 의사 확진(AI 와 다를 수 있음) → 경과 라운드 표', { skip }, () => {
  let sawDiff = false, sawAgree = false, sawStab = false;
  const p = page(); const id = (x) => p.doc.getElementById(x);
  for (let k = 0; k < 120; k++) { id('med-draw').click(); id('med-row-1-1').click(); walk(p, 15); assert.match(id('med-ph-t').textContent, /^4-1/); assert.match(id('med-s4-consent').textContent, /ANON-/);
    nx(p); assert.match(id('med-ph-t').textContent, /^4-2/); assert.ok(id('med-s4-rank').querySelectorAll('tbody tr').length === 3); assert.match(id('med-pbody').textContent, /AI는 후보 순서를 제안할 뿐/);
    nx(p); assert.match(id('med-ph-t').textContent, /^4-3/); const j = id('med-s4-judge').textContent; if (j === '같음' || /같음/.test(j)) sawAgree = true; if (/다름/.test(j)) sawDiff = true; assert.match(id('med-s4-dx').textContent, /후보 [ABC]/); assert.match(id('med-pbody').textContent, /약의 종류·용량은 의사가 정해요/);
    nx(p); assert.match(id('med-ph-t').textContent, /^4-4/); assert.ok(id('med-s4-rounds').querySelectorAll('tbody tr').length >= 1); if (/상급 기관 전원/.test(id('med-s4-end').textContent) && /안정화만/.test(id('med-s4-rounds').textContent)) sawStab = true; }
  assert.ok(sawAgree && sawDiff);
});

test('시뮬레이션 버튼: 오른쪽 위에서 열면 1-1 부터 자동으로 끝까지 진행하고, 닫기·바깥 클릭으로 닫힌다', { skip }, () => {
  const p = page(); const q = fake(p); const id = (x) => p.doc.getElementById(x);
  assert.ok(id('med-sim')); id('med-sim').click(); assert.equal(id('med-sim').disabled, true); assert.ok(id('med-apanel').classList.contains('open')); assert.match(id('med-au-t').textContent, /^1-1/);
  for (let k = 0; k < 40 && q.length; k++) { fire(q, 4000); if (id('med-au-t').textContent.startsWith('4-4')) break; }
  assert.match(id('med-au-t').textContent, /^4-4/); assert.ok(id('med-au-body').textContent.length > 30);
  id('med-back').click(); while (q.length) q.shift().fn(); assert.equal(id('med-apanel').classList.contains('open'), false); assert.equal(id('med-sim').disabled, false);
});

test('시뮬레이션은 화면의 단계 목록·패널과 완전히 분리되어 있고 id 가 겹치지 않는다', { skip }, () => {
  const p = page(); const q = fake(p); const id = (x) => p.doc.getElementById(x);
  id('med-draw').click(); id('med-row-1-1').click(); walk(p, 2);
  const snap = () => ({ cap: id('med-bar-cap').textContent, hint: id('med-next-hint').textContent, rows: [...p.doc.querySelectorAll('.srow .sst')].map((x) => x.textContent).join(), panel: id('med-ipanel').innerHTML });
  const before = snap(); id('med-sim').click();
  for (let k = 0; k < 25 && q.length; k++) { fire(q, 4000); if (id('med-au-t').textContent.startsWith('4-')) break; }
  assert.deepEqual(snap(), before); assert.equal(p.doc.querySelectorAll('[id]').length, new Set([...p.doc.querySelectorAll('[id]')].map((x) => x.id)).size);
  id('med-row-1-2').click(); assert.match(id('med-au-t').textContent, /^4-/); assert.match(id('med-ph-t').textContent, /^1-2/); assert.equal(id('med-panel'), null);
});

test('새 환자 뽑기: 처음엔 깜박이고, 뽑은 뒤에는 다음 할 일 배너가 따라온다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x);
  assert.ok(id('med-draw').classList.contains('blink')); assert.equal(id('med-next-hint'), null); id('med-draw').click(); assert.equal(id('med-draw').classList.contains('blink'), false);
  assert.match(id('med-next-hint').textContent, /1-1 기기 호출/); id('med-row-1-1').click(); assert.match(id('med-next-hint').textContent, /천천히 깜박이는 “1-2 메시지 구성”/);
});

test('평소 준비: 기기·꺼낼 정보·허용한 질문은 이 브라우저에만 저장되고 외부로 나가지 않으며, 도우미 카드가 보인다', { skip }, () => {
  const p = page(); const id = (x) => p.doc.getElementById(x);
  assert.ok(id('med-sh-loc').disabled); assert.ok(id('med-agent')); assert.match(id('med-agent').textContent, /조회까지만/);
  id('med-sh-hist').click(); assert.match(p.w.localStorage.getItem('navi-med-v1'), /hist/); assert.equal(p.fetched(), 0);
  const res = []; p.N.on('result', (x) => res.push(x)); p.N.nav({ do: 'consent' }); p.N.nav({ do: 'nope' }); assert.equal(res[0].ok, true); assert.equal(res[1].ok, false);
});

test('Material Design 3 와 레이아웃: 응급·치안과 같은 규격, .med 안으로 한정, 네트워크 호출 없음', () => {
  assert.match(css, /--md-ease:cubic-bezier\(\.2,0,0,1\)/); assert.match(css, /\.med \.bar\{display:grid;grid-template-columns:4fr 6fr 5fr 4fr/); assert.match(css, /\.med \.ipanel\{[^}]*border-radius:16px/);
  const sel = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').split('}').map((x) => x.split('{')[0].trim()).filter((x) => x && !x.startsWith('@') && !/^\d+%|^from|^to/.test(x));
  assert.deepEqual(sel.filter((x) => x.split(',').some((y) => !/\.med\b/.test(y))).slice(0, 5), []);
  assert.doesNotMatch(app, /fetch\(|XMLHttpRequest|sendBeacon/); assert.doesNotMatch(css, /\.emg\b/);
});

test('desktop.html 연결과 배포 목록', () => {
  assert.match(d, /tab-btn-med/); assert.match(d, /med-root/); assert.match(d, /_medOpen\('call'\)/); assert.match(d, /의료 시뮬레이션>med:call/); assert.match(d, /평소 준비>med:prep/);
  assert.match(d, /medical-app\.js/); assert.match(d, /medical\.css/); assert.match(paths, /"medical-app\.js"/); assert.match(paths, /"medical\.css"/);
  assert.match(d, /NaviMedical\.on\('agent'/);
});
