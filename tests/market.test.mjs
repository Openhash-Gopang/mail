import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../market-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../market.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const paths = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
function page(view) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window; let fetched = 0; w.fetch = () => { fetched++; return Promise.reject(new Error('no')); };
  w.eval(app); const doc = w.document, asks = [];
  w.NaviMarket.on('ask', (t) => asks.push(t)); w.NaviMarket.mount(doc.getElementById('m'), { view });
  const txt = () => doc.getElementById('mk-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  return { w, doc, asks, txt, btn, fetched: () => fetched, N: w.NaviMarket };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
const api = () => { const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(app); return w.NaviMarket; };

test('fairPrice: 중앙값 대비 편차, 3개 미만은 null', { skip }, () => {
  const N = api(); const r = N.fairPrice(['95000', '100000', '105000'], '150000', '30');
  assert.equal(r.median, 100000); assert.equal(r.out, true); assert.equal(r.side, 'high'); assert.equal(N.fairPrice(['95000', '100000', '105000'], '110000', '30').out, false);
  assert.equal(N.fairPrice(['1', '2'], '1', '30'), null); assert.equal(N.fairPrice(['1', '2', '3'], '', '30'), null);
});

test('qualityRate · satisfaction', { skip }, () => {
  const N = api(); assert.equal(N.qualityRate('10', '8').rate, 0.8); assert.equal(N.qualityRate('10', '11'), null); assert.equal(N.qualityRate('4', '4').all, true);
  const s = N.satisfaction(['5', '4', '3', '4']); assert.equal(s.avg, 4); assert.equal(s.hi, 0.75); assert.equal(N.satisfaction(['6']), null); assert.equal(N.satisfaction([]), null);
});

test('needCheck: 사유 개수로 단계', { skip }, () => {
  const N = api(); assert.equal(N.needCheck({ owned: 'no', uses: 'often', plan: 'plan', alt: 'no' }).level, 'ok');
  assert.equal(N.needCheck({ owned: 'ok', uses: 'often', plan: 'plan', alt: 'no' }).level, 'think');
  const r = N.needCheck({ price: '100000', budget: '50000', owned: 'ok', uses: 'rare', plan: 'impulse', alt: 'yes' }); assert.equal(r.level, 'hold'); assert.equal(r.reasons.length, 5);
});

test('presale: 선지급·이자·잔금, 범위 밖은 null', { skip }, () => {
  const N = api(), r = N.presale('100000000', '30', '6', '60', '');
  assert.equal(r.adv, 30000000); assert.equal(r.interest, Math.round(30000000 * 0.06 * 60 / 365)); assert.equal(r.after, 100000000 - r.adv - r.interest); assert.equal(r.total, r.adv + r.after);
  assert.equal(N.presale('100000000', '30', '6', '60', '90000000').after, 90000000 - r.adv - r.interest);
  assert.equal(N.presale('100000000', '9', '6', '60', ''), null); assert.equal(N.presale('100000000', '51', '6', '60', ''), null); assert.equal(N.presale('', '30', '6', '60', ''), null);
});

test('화면: 시장 원리 · 설계 원칙, 전송 없음', { skip }, () => {
  const p = page(); assert.match(p.txt(), /공정거래위원회/); assert.match(p.txt(), /설계 원칙/); assert.match(p.txt(), /10~50%/); assert.equal(p.fetched(), 0);
});

test('화면: 상품 평가', { skip }, () => {
  const p = page('eval'); type(p, 'mk-f-refs', '95000, 100000, 105000'); type(p, 'mk-f-price', '150000'); assert.match(p.doc.getElementById('mk-f-res').textContent, /벗어났어요/);
  type(p, 'mk-q-total', '10'); type(p, 'mk-q-met', '8'); assert.match(p.doc.getElementById('mk-q-res').textContent, /80%/);
  type(p, 'mk-s-r', '5, 4, 3, 4'); assert.match(p.doc.getElementById('mk-s-res').textContent, /평균 4점/); assert.equal(p.fetched(), 0);
});

test('화면: 필요 판단', { skip }, () => {
  const p = page('need'); assert.match(p.doc.getElementById('mk-n-res').textContent, /필요한 구매/);
  const o = p.doc.getElementById('mk-n-owned'); o.value = 'ok'; o.dispatchEvent(new p.w.Event('change')); const u = p.doc.getElementById('mk-n-plan'); u.value = 'impulse'; u.dispatchEvent(new p.w.Event('change'));
  assert.match(p.doc.getElementById('mk-n-res').textContent, /자제/);
});

test('화면: 선구매 계산과 메모 저장', { skip }, () => {
  const p = page('presale'); type(p, 'mk-p-value', '100000000'); type(p, 'mk-p-annual', '6'); type(p, 'mk-p-days', '60');
  assert.match(p.doc.getElementById('mk-p-adv').textContent, /30,000,000/);
  type(p, 'mk-p-rate', '60'); assert.match(p.doc.getElementById('mk-p-out').textContent, /10~50%/);
  type(p, 'mk-p-rate', '20'); type(p, 'mk-p-item', '토지'); p.btn('내 메모에 저장').click();
  assert.equal(JSON.parse(p.w.localStorage.getItem('navi-market-v1')).list[0].adv, 20000000); assert.match(p.txt(), /토지/); assert.equal(p.fetched(), 0);
});

test('desktop.html 연결 + 이름 변경 + 경로 + 범위 css', { skip }, () => {
  assert.ok(d.includes("_mktOpen('principle')") && d.includes("go.indexOf('mkt:') === 0") && d.includes("if (name === 'mkt') _mktShow();") && d.includes('id="tab-mkt"'));
  assert.ok(d.includes("['kmarket','시장']") && !d.includes('쇼핑·거래'));
  assert.ok(paths.includes('"market-app.js"') && paths.includes('"market.css"')); assert.ok(css.includes('.mkt '));
});

// ── 거래 인증 · 잔고 검증 · 장부 기록 (2026-11-24) ──
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

test('거래 인증·장부 탭: 화면에서 입금 → 서명 → 기록 → 장부 검증, 한 칸 고치기 체험', { skip }, async () => {
  const w = lw(), doc = w.document; w.NaviMarket.mount(doc.getElementById('m'), { view: 'ledger' });
  const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms)), txt = (id) => doc.getElementById(id).textContent, btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  const type = (id, v) => { const i = doc.getElementById(id); i.value = v; i.dispatchEvent(new w.Event('input', { bubbles: true })); };
  assert.ok(doc.getElementById('mk-root').textContent.includes('체험용')); assert.ok(doc.getElementById('mk-root').textContent.includes('분산 장부'));
  type('mk-l-acct', '나'); type('mk-l-amt', '1000'); btn('입금 기록').click(); await wait(150);
  assert.ok(txt('mk-l-bal').includes('1,000 GDC')); assert.ok(txt('mk-l-ok').includes('이상 없음'));
  type('mk-l-seller', '철수'); for (const k of ['b', 's']) { type(`mk-l-${k}-item`, '자전거'); type(`mk-l-${k}-price`, k === 'b' ? '400' : '450'); }
  btn('구매자 서명').click(); btn('판매자 서명').click(); await wait(150);
  btn('상호 인증 확인').click(); await wait(100); assert.ok(txt('mk-l-auth').includes('달라요')); assert.ok(txt('mk-l-auth').includes('단가'));   // 내용이 다르면 인증 실패
  type('mk-l-s-price', '400'); assert.ok(txt('mk-l-auth').includes('서명이 지워졌어요'));   // 고치면 서명이 지워진다
  btn('구매자 서명').click(); btn('판매자 서명').click(); await wait(150); btn('장부에 기록').click(); await wait(250);
  assert.ok(txt('mk-l-msg').includes('기록했어요')); assert.ok(txt('mk-l-bal').includes('600 GDC')); assert.ok(txt('mk-l-bal').includes('400 GDC'));
  btn('한 칸을 몰래 고친다면').click(); await wait(150); assert.ok(txt('mk-l-tam').includes('바로 드러났어요'));
  const saved = JSON.parse(w.localStorage.getItem('navi-market-v1')); assert.equal(saved.ledger.length, 2);
  // 저장된 장부를 몰래 고치면 다시 열 때 검증에서 걸린다
  saved.ledger[1].body.terms.price = 1; w.localStorage.setItem('navi-market-v1', JSON.stringify(saved));
  w.NaviMarket.mount(doc.getElementById('m'), { view: 'ledger' }); await wait(200);
  assert.ok(txt('mk-l-ok').includes('이상 발견')); assert.ok(txt('mk-l-bal').includes('믿을 수 없어요'));
});

test('시장 원리 화면: 셋째 원칙과 거래 인증·장부 탭 안내', { skip }, () => {
  const p = page('principle'); assert.ok(p.txt().includes('상호 인증')); assert.ok(p.txt().includes('잔고 검증')); assert.ok(p.btn('열기') && p.txt().includes('거래 인증·장부'));
  assert.ok(p.txt().includes('분산 장부')); assert.equal(p.fetched(), 0);
});
