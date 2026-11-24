import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const rd = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const app = rd('../market-app.js'), css = rd('../market.css'), d = rd('../desktop.html'), paths = rd('../ops/naviweb-proxy/mail-paths.js');
const bridgeSrc = rd('../agent-bridge.js'), extTools = rd('../ops/naviweb-agent/extension/tools.js'), extBg = rd('../ops/naviweb-agent/extension/background.js'), extBridge = rd('../ops/naviweb-agent/extension/bridge.js');
const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
function page(agent) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true }); w.TextEncoder = TextEncoder; w.Element.prototype.scrollIntoView = () => {};
  if (agent) w.NaviAgent = agent;
  w.eval(app); const doc = w.document, asks = [];
  w.NaviMarket.on('ask', (t) => asks.push(t)); w.NaviMarket.mount(doc.getElementById('m'));
  const txt = () => doc.getElementById('mk-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  const type = (id, v) => { const i = doc.getElementById(id); i.value = v; i.dispatchEvent(new w.Event('input', { bubbles: true })); };
  return { w, doc, asks, txt, btn, type, fetched: () => fetched, N: w.NaviMarket };
}
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviMarket; };

test('중복 판단: 비슷한 이름의 지난 구매를 찾고, 다른 물건은 찾지 않는다', { skip }, () => {
  const F = api().flow, H = [{ name: '무선 청소기 A100', price: 150000, d: '2026-05-01' }, { name: '러닝화', price: 80000, d: '2026-06-01' }];
  assert.equal(F.similar('무선청소기 A200', H)[0].name, '무선 청소기 A100');
  assert.equal(F.similar('에어프라이어', H).length, 0); assert.equal(F.similar('', H).length, 0); assert.equal(F.similar('러닝화 트레일', H)[0].name, '러닝화');
});
test('필요도 1~5: 업무·일상과 겹치면 오르고, 메모가 없으면 근거 부족을 알리고, 중복 강행은 깎는다', { skip }, () => {
  const F = api().flow, base = { name: '러닝화 트레일', price: 90000, history: [{ name: '러닝화', price: 80000 }] };
  const a = F.need({ ...base, memo: '주 3회 러닝, 트레일 대회 준비' }); assert.ok(a.score >= 4 && a.score <= 5); assert.equal(a.memoEmpty, false);
  const b = F.need({ ...base, memo: '' }); assert.equal(b.memoEmpty, true); assert.ok(b.reasons[0].includes('근거가 부족'));
  const c = F.need({ ...base, memo: '요리, 독서', dupOverride: true }); assert.ok(c.score < a.score && c.score >= 1);
  const e = F.need({ name: '고급 시계', price: 5000000, memo: '', history: [{ name: '양말', price: 5000 }] }); assert.ok(e.score >= 1 && e.score <= 5 && e.reasons.some((x) => x.includes('3배를 넘는')));
});
test('보고서: 가격 공정성(비교 3개 이상)·AS·리뷰를 따로 판단하고 모르면 보류한다', { skip }, () => {
  const F = api().flow;
  const ok = F.report({ price: 100000, compare: [98000, 102000, 105000], as: '1년 무상 AS', rating: 4.5, count: 120 }); assert.equal(ok.verdict, 'ok'); assert.ok(ok.lines.every((l) => l.ok === true));
  const hi = F.report({ price: 150000, compare: [98000, 102000, 105000], as: '1년', rating: 4.5, count: 120 }); assert.equal(hi.verdict, 'caution'); assert.ok(hi.lines[0].text.includes('비싸요'));
  const low = F.report({ price: 100000, compare: [98000], as: '', rating: 3.2, count: 5 }); assert.equal(low.verdict, 'caution'); assert.equal(low.lines[0].ok, null); assert.equal(low.lines[1].ok, false);
  const hold = F.report({ price: 100000, compare: [], as: '있음', rating: '', count: '' }); assert.equal(hold.verdict, 'hold');
});

test('화면: 한 페이지 구매 흐름 — 중복이면 멈추고 "구매 원함"으로 계속 → 필요도 → 보고서 → 협의 → 결제 → 기록', { skip }, async () => {
  const p = page(); const { doc, btn, type, txt } = p;
  assert.ok(txt().includes('살 물건을 알려 주세요') && !txt().includes('시장 원리'));
  p.w.localStorage.setItem('navi-market-v2', JSON.stringify({ history: [{ name: '무선 청소기 A100', price: 150000, d: '2026-05-01' }], memo: '재택 근무, 청소 자주 함', fin: [], ledger: [] }));
  p.N.mount(doc.getElementById('m'));
  btn('검토 시작').click(); assert.ok(txt().includes('상품 이름을 넣어')); type('mk-name', '무선청소기 A200'); btn('검토 시작').click(); assert.ok(txt().includes('가격을 1원 이상'));
  type('mk-price', '189000'); btn('검토 시작').click();
  assert.ok(doc.getElementById('mk-dup') && txt().includes('중복일 수 있어')); assert.ok(!doc.getElementById('mk-go2') && !btn('계속 진행'));
  btn('구매 원함').click(); assert.ok(txt().includes('필요할까요')); const sc = Number(doc.getElementById('mk-score').textContent.split('/')[0]); assert.ok(sc >= 1 && sc <= 5);
  btn('계속 진행').click(); assert.ok(txt().includes('가격·AS·리뷰 평가 보고서')); assert.ok(txt().includes('판단을 보류') || txt().includes('못 찾')); // 비교 가격·AS·리뷰 없음
  type('mk-as', '1년 무상 AS'); type('mk-rating', '4.6'); type('mk-count', '230'); type('mk-cmp', '185000, 190000, 192000'); btn('보고서 다시 만들기').click();
  assert.ok(doc.getElementById('mk-verdict').textContent.includes('공정')); btn('구매').click();
  assert.ok(txt().includes('판매자 나비와 조건을 맞췄어요') && txt().includes('체험용')); btn('승인').click();
  assert.ok(txt().includes('결제하고 장부에 남겨요')); await wait(150); assert.ok(doc.getElementById('mk-pay-have').textContent.includes('0 GDC'));
  btn('승인하고 결제').click(); await wait(150); assert.ok(txt().includes('구매를 마쳤어요') === false, '잔고 0이면 결제되지 않는다'); assert.ok(doc.getElementById('mk-pay-msg').textContent.includes('부족'));
  btn('체험용 입금 기록').click(); await wait(200); assert.ok(doc.getElementById('mk-pay-have').textContent.includes('189,000'));
  btn('승인하고 결제').click(); await wait(400);
  assert.ok(txt().includes('구매를 마쳤어요')); assert.ok(txt().includes('재무제표 SP') && txt().includes('나만의 AI 비서')); await wait(150); assert.ok(doc.getElementById('mk-done-ok').textContent.includes('이상 없음'));
  const s = JSON.parse(p.w.localStorage.getItem('navi-market-v2')); assert.equal(s.fin[0].amt, 189000); assert.equal(s.fin[0].left, 0); assert.equal(s.history[0].name, '무선청소기 A200'); assert.equal(s.ledger.length, 2);
  assert.equal(p.fetched(), 0); btn('다른 물건 검토하기').click(); assert.ok(txt().includes('살 물건을 알려 주세요'));
});
test('화면: 비슷한 구매가 없으면 바로 필요도로 가고, 그만두면 처음으로 돌아간다', { skip }, () => {
  const p = page(); p.type('mk-name', '에어프라이어'); p.type('mk-price', '90000'); p.btn('검토 시작').click();
  assert.ok(p.doc.getElementById('mk-nodup')); p.btn('다음').click(); assert.ok(p.txt().includes('필요할까요')); p.btn('그만두기').click(); assert.ok(p.txt().includes('살 물건을 알려 주세요'));
});
test('도우미: 링크 없으면 안내, 있으면 맡기고, 읽어 온 값은 걸러서 칸에 채운다(주소·이미지 검사)', { skip }, async () => {
  let cb = null, job = null;
  const agent = { onData: (f) => { cb = f; }, detect: () => Promise.resolve({ version: '0.6.40' }), queue: (j) => { job = j; return Promise.resolve({ ok: true }); } };
  const p = page(agent); p.btn('도우미로 읽어 오기').click(); assert.ok(p.txt().includes('상품 링크')); assert.equal(job, null);
  p.type('mk-link', 'http://evil.test/x'); p.btn('도우미로 읽어 오기').click(); assert.equal(job, null);
  p.type('mk-link', 'https://shop.example/p/1'); p.btn('도우미로 읽어 오기').click(); await wait(30);
  assert.ok(job && job.url === 'https://shop.example/p/1' && job.slot === '시장 상품 확인' && job.goal.includes('report_data') && job.goal.includes('결제는 하지 마세요'));
  assert.ok(p.txt().includes('나비웹 도우미에게 맡겼어요'));
  cb({ label: '다른 항목', data: { name: '무시돼야 함', price: 1 } }); assert.equal(p.doc.getElementById('mk-name').value, '');
  cb({ label: '시장 상품 확인', data: { name: '무선 청소기', price: 189000, image: 'javascript:alert(1)', seller: '예시몰', as: '1년 무상 AS', rating: 4.6, count: 230, reviews: ['좋아요'], compare: [185000, 190000, 'x', 192000] } });
  assert.ok(p.txt().includes('비슷한 걸 산 적이 있는지'), '이름·가격을 읽어 오면 검토 시작이 자동으로 눌린다'); assert.ok(p.txt().includes('무선 청소기') && p.txt().includes('189,000원')); assert.equal(p.doc.querySelector('img'), null);
  cb({ label: '시장 상품 확인', data: { image: 'https://img.example/a.jpg' } }); assert.equal(p.doc.querySelector('img').getAttribute('src'), 'https://img.example/a.jpg'); assert.ok(p.txt().includes('비슷한 걸 산 적이 있는지'));
  const q2 = page({ onData: (f) => { cb = f; }, detect: () => Promise.resolve({}), queue: () => Promise.resolve({ ok: true }) }); q2.type('mk-link', 'https://shop.example/p/2'); q2.btn('도우미로 읽어 오기').click(); await wait(30);
  cb({ label: '시장 상품 확인', data: { name: '이름만 있음' } }); assert.ok(q2.txt().includes('살 물건을 알려 주세요') && q2.doc.getElementById('mk-name').value === '이름만 있음', '가격이 없으면 자동으로 넘어가지 않는다');
  cb({ label: '시장 상품 확인', data: { price: 5000 } }); assert.ok(q2.txt().includes('비슷한 걸 산 적이 있는지'));
});
test('도우미가 없으면 직접 넣으라고 안내한다', { skip }, async () => {
  const p = page(); p.type('mk-link', 'https://shop.example/p/1'); p.btn('도우미로 읽어 오기').click(); assert.ok(p.txt().includes('직접 넣어도 돼요'));
  const q = page({ onData() {}, detect: () => Promise.resolve(null), queue: () => Promise.resolve({ ok: true }) }); q.type('mk-link', 'https://shop.example/p/1'); q.btn('도우미로 읽어 오기').click(); await wait(2500); assert.ok(q.txt().includes('설치되어 있지 않거나') && q.txt().includes('새로고침(F5)'));
  let n = 0; const r = page({ onData() {}, detect: () => Promise.resolve(++n < 3 ? null : { version: '0.6.40' }), queue: () => Promise.resolve({ ok: true }) }); r.type('mk-link', 'https://shop.example/p/1'); r.btn('도우미로 읽어 오기').click(); await wait(2000); assert.equal(n, 3); assert.ok(!r.txt().includes('설치되어 있지 않거나'));
});
test('desktop.html 연결 + 경로 + 범위 css + 확장 도구(report_data) 중계', () => {
  assert.ok(d.includes('_mktOpen('), 'desktop 에서 시장 열기'); assert.ok(d.includes("go.indexOf('mkt:') === 0") && d.includes("if (name === 'mkt') _mktShow();") && d.includes('id="tab-mkt"'));
  assert.ok(d.includes("'구매 검토>mkt:buy'") && !d.includes('상품 평가>mkt:eval')); assert.ok(paths.includes('"market-app.js"') && paths.includes('"market.css"')); assert.ok(css.includes('.mkt ') && css.includes('.mk-steps'));
  assert.ok(bridgeSrc.includes("m.type !== 'agent-data'") && bridgeSrc.includes('onData: onData'));
  assert.ok(extTools.includes("name: 'report_data'") && extBg.includes("name === 'report_data'") && extBg.includes("msg.kind === 'data' ? 'data'") && extBridge.includes("type: 'agent-data'"));
});

// ── 거래 인증 · 잔고 검증 · 장부 기록 ──
const lw = () => { const w = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true }).window; Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true }); w.TextEncoder = TextEncoder; w.eval(app); return w; };
const T = (o = {}) => ({ item: '자전거', qty: 1, price: 400, buyer: '나', seller: '철수', d: '2026-11-24', n: 'n1', ...o });
async function sign(L, terms) { const k = await L.newKeys(); return { terms, pub: k.pub, sig: await L.signTerms(k.priv, terms), k }; }

test('상호 인증: 같은 내용에 두 서명이 있어야 성공, 다르면 어디가 다른지 알려 준다', { skip }, async () => {
  const L = lw().NaviMarket.ledger, t = T(), b = await sign(L, t), s = await sign(L, t);
  assert.equal((await L.mutualAuth(b, s)).ok, true);
  const s2 = await sign(L, T({ price: 450 })), r = await L.mutualAuth(b, s2); assert.equal(r.ok, false); assert.equal(r.code, 'diff'); assert.ok(r.msg.includes('단가'));
  assert.equal((await L.mutualAuth(b, { ...s, sig: '' })).code, 'nosig');
  assert.equal((await L.mutualAuth(b, { ...s, sig: b.sig })).code, 'badsig');   // 남의 서명을 가져다 붙이면 맞지 않는다
  assert.equal((await L.mutualAuth(b, { ...s, pub: b.pub })).code, 'badsig');   // 키가 다르면 맞지 않는다
});

test('장부: 입금 → 거래 기록, 잔고는 장부로 다시 계산한다', { skip }, async () => {
  const L = lw().NaviMarket.ledger, chain = [];
  let r = await L.appendDeposit(chain, '나', '1000'); assert.equal(r.ok, true); chain.push(r.block);
  const t = T(), b = await sign(L, t), s = await sign(L, t);
  r = await L.appendTrade(chain, b, s); assert.equal(r.ok, true); assert.equal(r.total, 400); assert.equal(r.buyerLeft, 600); chain.push(r.block);
  const v = await L.verify(chain); assert.equal(v.ok, true); assert.deepEqual({ ...v.bal }, { 나: 600, 철수: 400 });
  assert.equal(chain[1].prev, chain[0].hash); assert.equal(chain[0].prev, '0'.repeat(64));
});

test('잔고 검증: 모자라면 기록하지 않고 부족액을 알려 준다 · 같은 거래는 두 번 기록 못 한다', { skip }, async () => {
  const L = lw().NaviMarket.ledger, chain = [];
  chain.push((await L.appendDeposit(chain, '나', '500')).block);
  const big = T({ price: 700, n: 'n2' }), b = await sign(L, big), s = await sign(L, big), r = await L.appendTrade(chain, b, s);
  assert.equal(r.ok, false); assert.equal(r.code, 'balance'); assert.ok(r.msg.includes('부족 200'));
  assert.equal(chain.length, 1);
  const ok = T({ price: 300, n: 'n3' }), b2 = await sign(L, ok), s2 = await sign(L, ok), r2 = await L.appendTrade(chain, b2, s2); assert.equal(r2.ok, true); chain.push(r2.block);
  const again = await L.appendTrade(chain, b2, s2); assert.equal(again.ok, false); assert.equal(again.code, 'replay');
  assert.equal((await L.appendTrade(chain, b2, { ...s2, sig: '' })).ok, false);
  assert.equal((await L.appendTrade(chain, await sign(L, T({ buyer: '나', seller: '나', n: 'n4' })), await sign(L, T({ buyer: '나', seller: '나', n: 'n4' })))).code, 'bad');   // 자기 자신과의 거래
});

test('위·변조 감지: 한 칸을 고치거나 이음을 끊으면 그 블록에서 드러난다', { skip }, async () => {
  const L = lw().NaviMarket.ledger, chain = [];
  chain.push((await L.appendDeposit(chain, '나', '1000')).block);
  const t = T(), b = await sign(L, t), s = await sign(L, t); chain.push((await L.appendTrade(chain, b, s)).block);
  const t2 = T({ n: 'n5', item: '책', price: 100 }), b2 = await sign(L, t2), s2 = await sign(L, t2); chain.push((await L.appendTrade(chain, b2, s2)).block);
  assert.equal((await L.verify(chain)).ok, true);
  const c1 = JSON.parse(JSON.stringify(chain)); c1[1].body.terms.price = 1; let v = await L.verify(c1); assert.equal(v.ok, false); assert.equal(v.bad, 1);
  const c2 = JSON.parse(JSON.stringify(chain)); c2[0].body.amt = 5000; v = await L.verify(c2); assert.equal(v.ok, false); assert.equal(v.bad, 0);   // 입금액을 부풀려도 첫 블록에서 걸린다
  const c3 = JSON.parse(JSON.stringify(chain)); c3[2].prev = c3[0].hash; v = await L.verify(c3); assert.equal(v.ok, false); assert.equal(v.bad, 2);
  const c4 = [chain[0], chain[2]]; v = await L.verify(c4); assert.equal(v.ok, false);   // 가운데 블록을 빼도 걸린다
  // 해시까지 다시 맞춰 붙여도, 서명이 없는 거래·잔고 없는 거래는 걸린다
  const forged = JSON.parse(JSON.stringify(chain)); forged[1].body.bsig = ''; v = await L.verify(forged); assert.equal(v.ok, false);
});


test('시장 화면: 연결 전인 것(PDV·판매자 나비·분산 장부)을 숨기지 않고 적는다', { skip }, () => {
  const p = page(); assert.ok(app.includes('분산 장부') && app.includes('체험용')); p.type('mk-name', '에어프라이어'); p.type('mk-price', '90000'); p.btn('검토 시작').click(); assert.ok(p.txt().includes('체험용'));
});

test('도우미 버전: 오래된 확장(주소를 전달하지 못함)은 맡기지 않고 업데이트를 안내한다', { skip }, async () => {
  let queued = 0; const mk = (v) => page({ onData() {}, detect: () => Promise.resolve({ version: v }), queue: () => { queued++; return Promise.resolve({ ok: true }); } });
  const old = mk('0.6.5'); old.type('mk-link', 'https://shop.example/p/1'); old.btn('도우미로 읽어 오기').click(); await wait(30);
  assert.equal(queued, 0); assert.ok(old.txt().includes('오래된 버전(0.6.5)') && old.txt().includes('chrome://extensions') && old.txt().includes('0.6.40'));
  const ok = mk('0.6.40'); ok.type('mk-link', 'https://shop.example/p/1'); ok.btn('도우미로 읽어 오기').click(); await wait(30); assert.equal(queued, 1);
  const V = ok.N.agentVer; assert.equal(V.ok('0.6.41'), true); assert.equal(V.ok('0.7.0'), true); assert.equal(V.ok('1.0'), true); assert.equal(V.ok('0.6.39'), false); assert.equal(V.ok(''), false); assert.equal(V.ok('x.y'), false);
});
test('상품 링크 칸: 엔터 키로 도우미를 바로 실행한다(한글 조합 중 엔터는 무시)', { skip }, async () => {
  let queued = 0; const p = page({ onData() {}, detect: () => Promise.resolve({ version: '0.6.40' }), queue: () => { queued++; return Promise.resolve({ ok: true }); } });
  p.type('mk-link', 'https://shop.example/p/1'); const i = p.doc.getElementById('mk-link');
  i.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })); await wait(30); assert.equal(queued, 0);
  i.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await wait(30); assert.equal(queued, 1);
});
test('뒤로 가기: 해시가 없는 화면끼리 옮겨도 기록이 남고, 뒤로 갈 때 기록의 화면 이름으로 돌아간다', () => {
  assert.ok(d.includes("history.pushState({ navTab: name }"), '화면 이동마다 state 에 화면 이름을 넣어 기록을 남긴다');
  assert.ok(d.includes("_st !== name"), '해시가 같아도 화면 이름이 다르면 기록을 남긴다');
  assert.ok(d.includes("history.state && history.state.navTab"), 'popstate 가 기록의 화면 이름을 읽는다');
});
