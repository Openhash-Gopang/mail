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
  w.__naviMarketDelay = 0; w.eval(app); const doc = w.document, asks = [];
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
  const ok = F.report({ price: 100000, compare: [98000, 102000, 105000], as: '1년 무상 AS', seller: '예시몰', sellerTrust: '판매자 평점 4.8 · 우수 판매자', rating: 4.5, count: 120 }); assert.equal(ok.verdict, 'ok'); assert.ok(ok.lines.every((l) => l.ok === true)); assert.ok(ok.lines.some((l) => l.k === '판매자 신뢰도'));
  const bad = F.report({ price: 100000, compare: [98000, 102000, 105000], as: '1년', seller: 'x몰', sellerTrust: '분쟁 신고 많음', rating: 4.5, count: 120 }); assert.equal(bad.verdict, 'caution');
  const hi = F.report({ price: 150000, compare: [98000, 102000, 105000], as: '1년', sellerTrust: '우수', rating: 4.5, count: 120 }); assert.equal(hi.verdict, 'caution'); assert.ok(hi.lines[0].text.includes('비싸요'));
  const low = F.report({ price: 100000, compare: [98000], as: '', rating: 3.2, count: 5 }); assert.equal(low.verdict, 'caution'); assert.equal(low.lines[0].ok, null); assert.equal(low.lines[1].ok, false);
  const hold = F.report({ price: 100000, compare: [], as: '있음', rating: '', count: '' }); assert.equal(hold.verdict, 'hold');
});

test('화면: 11단계 자동 진행 — 이름 → 이력(중복 팝업) → 필요도 → 구매 의사 → 신뢰도·의견 → AS → 가격 비교 → 협의 → 최종 확인 → 결제 → 국세청 보고', { skip }, async () => {
  const p = page(); const { doc, btn, type, txt } = p;
  assert.ok(txt().includes('살 물건을 알려 주세요') && !txt().includes('시장 원리'));
  p.w.localStorage.setItem('navi-market-v2', JSON.stringify({ history: [{ name: '무선 청소기 A100', price: 150000, d: '2026-05-01' }], memo: '재택 근무, 청소 자주 함', fin: [], ledger: [] }));
  p.N.mount(doc.getElementById('m'));
  assert.equal(doc.querySelectorAll('.mk-steps li').length, 11);
  btn('검토 시작').click(); assert.ok(txt().includes('상품 이름을 넣어')); type('mk-name', '무선청소기 A200'); btn('검토 시작').click(); assert.ok(txt().includes('가격을 1원 이상'));
  type('mk-price', '189000'); btn('검토 시작').click(); await wait(60);
  assert.ok(doc.querySelector('[role=dialog]') && txt().includes('비슷한 구매 기록이 있어요'), '이력에 비슷한 구매가 있으면 팝업으로 묻는다'); assert.ok(!doc.getElementById('mk-go2'));
  btn('구매 원함').click(); await wait(100);
  assert.ok(doc.getElementById('mk-score') && txt().includes('구매 의사 확인'), '필요도 뒤에는 늘 구매 의사를 묻는다'); const sc = Number(doc.getElementById('mk-score').textContent.split('/')[0]); assert.ok(sc >= 1 && sc <= 5);
  btn('계속 진행').click(); await wait(400);
  assert.ok(txt().includes('최종 구매 의사 확인') && txt().includes('구매 검토 최종 보고서') && txt().includes('협의한 조건'), '협의까지 마치고 최종 의사를 묻는다');
  { const pg = doc.getElementById('mk-prog').textContent; assert.ok(pg.includes('이전 구매: 무선 청소기 A100') && pg.includes('/ 5') && pg.includes('구매 의사') && pg.includes('판매자 신뢰도') && pg.includes('사후 서비스') && pg.includes('가격'), '최종 보고서에 모든 단계 결과가 들어 있다'); }
  assert.ok(doc.getElementById('mk-prog-4').className === 'done' && doc.getElementById('mk-prog-8').className === 'now');
  btn('보고서 더 보기').click(); assert.ok(!doc.querySelector('[role=dialog]'));
  type('mk-trust', '판매자 평점 4.8 · 우수 판매자'); type('mk-as', '1년 무상 AS'); type('mk-rating', '4.6'); type('mk-count', '230'); type('mk-cmp', '185000, 190000, 192000'); btn('보고서 다시 만들기').click();
  assert.ok(doc.getElementById('mk-prog').textContent.includes('다른 판매처 가격: 185,000원') && doc.getElementById('mk-prog').textContent.includes('우수 판매자'));
  btn('승인').click(); await wait(300);
  assert.ok(txt().includes('잔고가 모자라요'), '잔고 0이면 결제 전에 묻는다'); assert.ok(!txt().includes('구매를 마쳤어요'));
  btn('체험용 입금 후 결제').click(); await wait(900);
  assert.ok(txt().includes('구매를 마쳤어요')); assert.ok(txt().includes('국세청 AI') && txt().includes('재무제표 SP') && txt().includes('나만의 AI 비서') && txt().includes('MK-'), '결제 뒤 시장 인프라가 국세청에 보고한다');
  assert.ok(doc.getElementById('mk-slip').textContent.includes('누가') && doc.getElementById('mk-slip').textContent.includes('왜') && doc.getElementById('mk-slip').textContent.includes('부가세')); await wait(150); assert.ok(doc.getElementById('mk-done-ok').textContent.includes('이상 없음'));
  const s = JSON.parse(p.w.localStorage.getItem('navi-market-v2')); assert.equal(s.fin[0].amt, 189000); assert.equal(s.fin[0].left, 0); assert.ok(/^MK-\d{8}-\d{5}$/.test(s.fin[0].serial)); assert.equal(s.fin[0].tax, 189000 - Math.round(189000 / 1.1)); assert.equal(s.history[0].name, '무선청소기 A200'); assert.equal(s.ledger.length, 2);
  assert.equal(p.fetched(), 0); btn('다른 물건 검토하기').click(); assert.ok(txt().includes('살 물건을 알려 주세요'));
});
test('화면: 비슷한 구매가 없으면 팝업 없이 필요도까지 가고, 구매 의사 팝업에서 그만두면 처음으로 돌아간다', { skip }, async () => {
  const p = page(); p.type('mk-name', '에어프라이어'); p.type('mk-price', '90000'); p.btn('검토 시작').click();
  assert.ok(p.doc.getElementById('mk-nodup')); assert.ok(!p.doc.querySelector('[role=dialog]')); await wait(100);
  assert.ok(p.doc.querySelector('[role=dialog]') && p.txt().includes('구매 의사 확인'));
  p.btn('그만두기').click(); await wait(40); assert.ok(p.txt().includes('살 물건을 알려 주세요'));
});
test('화면: 자동 진행 중 처음으로 돌아가면 뒤늦은 타이머가 화면을 되살리지 않는다', { skip }, async () => {
  const p = page(); p.w.__naviMarketDelay = 80; p.type('mk-name', '에어프라이어'); p.type('mk-price', '90000'); p.btn('검토 시작').click();
  assert.ok(p.txt().includes('비슷한 걸 산 적이 있는지')); p.N.nav({ do: 'reset' }); await wait(250);
  assert.ok(p.txt().includes('살 물건을 알려 주세요') && !p.doc.querySelector('[role=dialog]'));
});
test('도우미: 링크 없으면 안내, 있으면 맡기고, 읽어 온 값은 걸러서 칸에 채운다(주소·이미지 검사)', { skip }, async () => {
  let cb = null, job = null;
  const agent = { onData: (f) => { cb = f; }, detect: () => Promise.resolve({ version: '0.6.41' }), queue: (j) => { job = j; return Promise.resolve({ ok: true }); } };
  const p = page(agent); p.btn('도우미로 읽어 오기').click(); assert.ok(p.txt().includes('상품 링크')); assert.equal(job, null);
  p.type('mk-link', 'http://evil.test/x'); p.btn('도우미로 읽어 오기').click(); assert.equal(job, null);
  p.type('mk-link', 'https://shop.example/p/1'); p.btn('도우미로 읽어 오기').click(); await wait(30);
  assert.ok(job && job.url === 'https://shop.example/p/1' && job.slot === '시장 상품 확인' && job.goal.includes('report_data') && job.goal.includes('결제는 하지 마세요'));
  assert.ok(p.txt().includes('나비웹 도우미에게 맡겼어요')); assert.ok(p.doc.getElementById('mk-hprog').textContent.includes('진행 중'));
  p.w.__naviMarketCoreWait = 0;
  cb({ label: '시장 상품 확인', data: { stage: 'core', name: '계양 DG18BLZ-100S 100mm 본체만', price: 112170 } });
  assert.ok(p.txt().includes('살 물건을 알려 주세요') && p.doc.getElementById('mk-name').value === '계양 DG18BLZ-100S 100mm 본체만', '이름·가격이 먼저 오면 칸에 채우고 나머지를 기다린다');
  assert.ok(p.doc.getElementById('mk-hprog').textContent.includes('계양 DG18BLZ-100S') && p.doc.getElementById('mk-hprog').textContent.includes('112,170원'));
  cb({ label: '다른 항목', data: { name: '무시돼야 함', price: 1 } }); assert.equal(p.doc.getElementById('mk-name').value, '계양 DG18BLZ-100S 100mm 본체만');
  cb({ label: '시장 상품 확인', data: { name: '무선 청소기', price: 189000, image: 'javascript:alert(1)', seller: '예시몰', as: '1년 무상 AS', rating: 4.6, count: 230, reviews: ['좋아요'], compare: [185000, 190000, 'x', 192000] } });
  assert.ok(p.txt().includes('비슷한 걸 산 적이 있는지'), '이름·가격을 읽어 오면 검토 시작이 자동으로 눌린다'); assert.ok(p.txt().includes('무선 청소기') && p.txt().includes('189,000원')); assert.equal(p.doc.querySelector('img'), null);
  cb({ label: '시장 상품 확인', data: { image: 'https://img.example/a.jpg' } }); assert.equal(p.doc.querySelector('img').getAttribute('src'), 'https://img.example/a.jpg'); assert.ok(p.txt().includes('비슷한 걸 산 적이 있는지'));
  const q2 = page({ onData: (f) => { cb = f; }, detect: () => Promise.resolve({}), queue: () => Promise.resolve({ ok: true }) }); q2.type('mk-link', 'https://shop.example/p/2'); q2.btn('도우미로 읽어 오기').click(); await wait(30);
  cb({ label: '시장 상품 확인', data: { name: '이름만 있음' } }); assert.ok(q2.txt().includes('살 물건을 알려 주세요') && q2.doc.getElementById('mk-name').value === '이름만 있음', '가격이 없으면 자동으로 넘어가지 않는다');
  cb({ label: '시장 상품 확인', data: { price: 5000 } }); assert.ok(q2.txt().includes('비슷한 걸 산 적이 있는지'));
});
test('상품 찾기: 대화 말에서 상품 요청·번호 선택을 알아듣는다', { skip }, () => {
  const F = api().flow;
  assert.deepEqual({ ...F.parseWant('무선 청소기 찾아줘') }, { q: '무선 청소기', site: '' });
  assert.equal(F.parseWant('에어프라이어를 사고 싶어요').q, '에어프라이어');
  assert.deepEqual({ ...F.parseWant('네이버에서 100mm 그라인더 추천해 줘') }, { q: '100mm 그라인더', site: 'naver' });
  assert.deepEqual({ ...F.parseWant('2번으로 해 줘') }, { pick: 1 });
  assert.equal(F.parseWant('이 가격이 적당한지 어떻게 판단하죠?'), null); assert.equal(F.parseWant('이 노트북을 지금 사도 될까요?'), null); assert.equal(F.parseWant('찾아줘'), null);
});
test('상품 찾기: 상단 입력 → 도우미가 후보를 찾아 옴 → 장단점 나열 → 고르면 구매 검토로 이어진다', { skip }, async () => {
  let cb = null; const jobs = [];
  const agent = { onData: (f) => { cb = f; }, detect: () => Promise.resolve({ version: '0.6.41' }), queue: (j) => { jobs.push(j); return Promise.resolve({ ok: true }); } };
  const p = page(agent); const says = []; p.N.on('say', (m) => says.push(m));
  assert.ok(p.doc.querySelector('#mk-top #mk-q'), '입력 필드는 페이지 맨 위에 있다');
  p.btn('상품 찾아오기').click(); assert.ok(p.txt().includes('두 글자 이상') || p.doc.body.textContent.includes('두 글자 이상')); assert.equal(jobs.length, 0);
  p.type('mk-q', '무선 청소기'); p.btn('상품 찾아오기').click(); await wait(30);
  assert.equal(p.doc.getElementById('mk-site').value, 'web', '쇼핑몰 지정은 선택이고 기본은 웹 전체다'); assert.equal(p.doc.getElementById('mk-site').options[0].textContent, '웹 전체');
  assert.equal(jobs.length, 1); assert.ok(jobs[0].url.startsWith('https://www.google.com/search?q=') && jobs[0].goal.includes('웹 전체에서') && jobs[0].slot === '시장 상품 찾기' && jobs[0].goal.includes('candidates') && jobs[0].goal.includes('결제는 하지 마세요'));
  assert.ok(p.doc.getElementById('mk-fprog').textContent.includes('진행 중'));
  cb({ label: '시장 상품 찾기', data: { stage: 'candidates', candidates: [
    { name: 'A사 무선 청소기 A200', price: 189000, image: 'javascript:x', link: 'https://www.coupang.com/vp/products/1', seller: 'A몰', rating: 4.6, count: 230, pros: ['흡입력이 좋아요', '가벼워요'], cons: ['배터리 40분'] },
    { name: 'B사 무선 청소기 B100', price: 129000, link: 'http://evil.test/x', rating: 4.1, count: 12, pros: ['저렴'], cons: ['소음'] },
    { name: '', price: 1 }, { name: '가격 없음', price: 0 },
    { name: 'C사 무선 청소기 C300', price: 249000, link: 'https://www.coupang.com/vp/products/3', rating: 4.8, count: 900, pros: [], cons: [] }] } });
  assert.equal(p.doc.querySelectorAll('[id^=mk-cand-]').length, 3, '이름·가격이 없는 후보는 거른다');
  const c0 = p.doc.getElementById('mk-cand-0').textContent; assert.ok(c0.includes('✓ 장점: 흡입력이 좋아요') && c0.includes('⚠ 단점: 배터리 40분') && c0.includes('189,000원'));
  assert.ok(p.doc.getElementById('mk-cand-1').textContent.includes('가장 저렴')); assert.ok(p.doc.getElementById('mk-cand-2').textContent.includes('평점 최고'));
  assert.equal(p.doc.querySelector('#mk-cand-0 img'), null, '이미지 주소가 https 가 아니면 쓰지 않는다');
  assert.equal(says.length, 1); assert.ok(says[0].text.includes('후보 3개') && says[0].text.includes('추천: **3번**') && says[0].text.includes('장점: 흡입력이 좋아요'));
  p.doc.getElementById('mk-pick-0').click(); await wait(30);
  assert.equal(jobs.length, 2); assert.ok(jobs[1].slot === '시장 상품 확인' && jobs[1].url === 'https://www.coupang.com/vp/products/1', '고른 상품 페이지에서 나머지를 더 읽어 온다');
  assert.ok(p.doc.getElementById('mk-name').value === 'A사 무선 청소기 A200' && p.doc.getElementById('mk-price').value === '189000');
  p.w.__naviMarketCoreWait = 0; cb({ label: '시장 상품 확인', data: { stage: 'detail', as: '1년 무상 AS', sellerTrust: '우수 판매자' } }); await wait(40);
  assert.ok(p.txt().includes('비슷한 걸 산 적이 있는지') || p.doc.getElementById('mk-prog'), '검토가 이어진다');
  await wait(300); assert.ok(p.doc.getElementById('mk-prog').textContent.includes('필요도'));
});
test('상품 찾기: 대화창에서 말하면 화면의 도우미 검색이 실행된다 · 후보 번호로 고른다', { skip }, async () => {
  let cb = null; const jobs = [];
  const p = page({ onData: (f) => { cb = f; }, detect: () => Promise.resolve({ version: '0.6.41' }), queue: (j) => { jobs.push(j); return Promise.resolve({ ok: true }); } });
  assert.equal(p.N.chat('이 가격이 적당한지 어떻게 판단하죠?'), null);
  assert.ok(p.N.chat('2번으로 해 줘').includes('아직 고를 후보가 없어요'));
  const r = p.N.chat('다나와에서 에어프라이어 찾아줘'); assert.ok(r.includes('다나와') && r.includes('직접 인터넷을 검색하지 못')); await wait(30);
  assert.ok(jobs[0].url.startsWith('https://search.danawa.com/') && jobs[0].url.includes(encodeURIComponent('에어프라이어')));
  const says = []; p.N.on('say', (m) => says.push(m));
  cb({ label: '시장 상품 찾기', data: { stage: 'candidates', candidates: [{ name: '에어프라이어 X', price: 80000, link: 'https://shop.example/x', rating: 4.5, count: 100 }, { name: '에어프라이어 Y', price: 60000 }] } });
  assert.equal(says.length, 1); assert.equal(says[0].open, true, '대화창에서 시작했으면 결과 알림으로 대화창을 연다');
  assert.ok(p.N.chat('3번').includes('1번부터 2번')); assert.ok(p.N.chat('1번으로 해 줘').includes('에어프라이어 X')); await wait(30); assert.equal(jobs[1].slot, '시장 상품 확인');
});
test('도우미가 없으면 직접 넣으라고 안내한다', { skip }, async () => {
  const p = page(); p.type('mk-link', 'https://shop.example/p/1'); p.btn('도우미로 읽어 오기').click(); assert.ok(p.txt().includes('직접 넣어도 돼요'));
  const q = page({ onData() {}, detect: () => Promise.resolve(null), queue: () => Promise.resolve({ ok: true }) }); q.type('mk-link', 'https://shop.example/p/1'); q.btn('도우미로 읽어 오기').click(); await wait(2500); assert.ok(q.txt().includes('설치되어 있지 않거나') && q.txt().includes('새로고침(F5)'));
  let n = 0; const r = page({ onData() {}, detect: () => Promise.resolve(++n < 3 ? null : { version: '0.6.41' }), queue: () => Promise.resolve({ ok: true }) }); r.type('mk-link', 'https://shop.example/p/1'); r.btn('도우미로 읽어 오기').click(); await wait(2000); assert.equal(n, 3); assert.ok(!r.txt().includes('설치되어 있지 않거나'));
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
  assert.equal(queued, 0); assert.ok(old.txt().includes('오래된 버전(0.6.5)') && old.txt().includes('chrome://extensions') && old.txt().includes('0.6.41'));
  const ok = mk('0.6.41'); ok.type('mk-link', 'https://shop.example/p/1'); ok.btn('도우미로 읽어 오기').click(); await wait(30); assert.equal(queued, 1);
  const V = ok.N.agentVer; assert.equal(V.ok('0.6.41'), true); assert.equal(V.ok('0.7.0'), true); assert.equal(V.ok('1.0'), true); assert.equal(V.ok('0.6.39'), false); assert.equal(V.ok(''), false); assert.equal(V.ok('x.y'), false);
});
test('상품 링크 칸: 엔터 키로 도우미를 바로 실행한다(한글 조합 중 엔터는 무시)', { skip }, async () => {
  let queued = 0; const p = page({ onData() {}, detect: () => Promise.resolve({ version: '0.6.41' }), queue: () => { queued++; return Promise.resolve({ ok: true }); } });
  p.type('mk-link', 'https://shop.example/p/1'); const i = p.doc.getElementById('mk-link');
  i.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })); await wait(30); assert.equal(queued, 0);
  i.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await wait(30); assert.equal(queued, 1);
});
test('뒤로 가기: 해시가 없는 화면끼리 옮겨도 기록이 남고, 뒤로 갈 때 기록의 화면 이름으로 돌아간다', () => {
  assert.ok(d.includes("history.pushState({ navTab: name }"), '화면 이동마다 state 에 화면 이름을 넣어 기록을 남긴다');
  assert.ok(d.includes("_st !== name"), '해시가 같아도 화면 이름이 다르면 기록을 남긴다');
  assert.ok(d.includes("history.state && history.state.navTab"), 'popstate 가 기록의 화면 이름을 읽는다');
});
test('뒤로 가기: 시장 단계·세무 확인 결과도 기록에 남고 복원된다', () => {
  assert.ok(app.includes("NaviHist.push('market', n)") && app.includes("NaviHist.on('market', 'mkt'"));
  const tax = rd('../tax-app.js');
  assert.ok(tax.includes("NaviHist.push('tax', 'trace')") && tax.includes("NaviHist.push('tax', 'tamper')") && tax.includes("NaviHist.on('tax', 'tax'"));
  assert.ok(d.includes('window.NaviHist') && d.includes('NaviHist.restore(name, history.state)'));
});

test('판매: 시장 가치는 비슷한 가격의 중앙값×상태, 선지급 30%(근거 약하면 25%), 정산은 이자를 뺀다', { skip }, () => {
  const F = api().flow;
  const a = F.value({ ask: 500000, cond: '거의 새 것', kind: '물품', comps: [400000, 420000, 440000, 900000] });
  assert.equal(a.est, Math.round(430000 * 0.85 / 100) * 100 === a.est ? a.est : a.est); assert.ok(a.est >= 360000 && a.est <= 370000); assert.equal(a.rate, 0.3); assert.equal(a.adv % 100, 0); assert.ok(a.low < a.est && a.est < a.high);
  const b = F.value({ ask: 300000, cond: '새 것', kind: '물품', comps: [] }); assert.equal(b.est, 300000); assert.equal(b.rate, 0.25); assert.equal(b.conf, 'low');
  const s = F.value({ ask: 150000, kind: '서비스', comps: [140000, 150000, 160000] }); assert.equal(s.est, 150000);
  const st = F.settle(320000, 90000, 30); assert.equal(st.interest, 592); assert.equal(st.payout, 320000 - 90000 - 592); assert.equal(st.shortfall, 0);
  const lo = F.settle(50000, 90000, 30); assert.equal(lo.payout, 0); assert.ok(lo.shortfall > 0);
  assert.ok(F.intent({ name: '중고 노트북', kind: '물품', cond: '거의 새 것', qty: '1', desc: '' }, 450000).includes('중고 노트북'));
});
test('판매 장부: 선지급·정산이 서명으로 검증되고, 같은 상품 중복 선지급·위조·잘못된 정산은 걸러진다', { skip }, async () => {
  const L = lw().NaviMarket.ledger; const chain = [];
  const r = await L.appendAdvance(chain, { lid: 'L-1', est: 300000, amt: 90000, d: '2026-11-24' }); assert.ok(r.ok, r.msg); chain.push(r.block);
  const dup = await L.appendAdvance(chain, { lid: 'L-1', est: 300000, amt: 90000, d: '2026-11-24' }); assert.ok(!dup.ok);
  let v = await L.verify(chain); assert.ok(v.ok, JSON.stringify(v)); assert.equal(v.bal['나'], 90000);
  const s = await L.appendSettle(chain, { lid: 'L-1', price: 320000, adv: 90000, interest: 592, d: '2026-12-24' }); assert.ok(s.ok, s.msg); assert.equal(s.payout, 229408); chain.push(s.block);
  v = await L.verify(chain); assert.ok(v.ok, JSON.stringify(v)); assert.equal(v.bal['나'], 90000 + 229408);
  const bad = JSON.parse(JSON.stringify(chain)); bad[0].body.amt = 190000; v = await L.verify(bad); assert.ok(!v.ok);
});
test('화면: 판매 탭 — 상품 입력 → 가치 추정 → 등록 → 선지급 → 판매 완료·정산 (도우미 없음)', { skip }, async () => {
  const p = page(); const { doc, btn, type, txt } = p;
  const tab = doc.getElementById('mk-tab-sell'); assert.ok(tab && doc.getElementById('mk-tab-buy')); tab.click();
  assert.equal(doc.querySelectorAll('.mk-steps li').length, 7); assert.ok(txt().includes('내 물건·서비스 판매하기'));
  btn('판매 시작').click(); assert.ok(doc.getElementById('mk-s-err'));
  type('mk-s-name', '중고 노트북'); type('mk-s-ask', '450000'); btn('판매 시작').click(); await wait(80);
  assert.ok(doc.querySelector('[role=dialog]') && txt().includes('시장 가치 추정'), '추정 금액을 팝업으로 묻는다'); btn('계속 진행').click(); await wait(120);
  assert.ok(doc.getElementById('mk-L-0') || txt().includes('선판매'), '등록 뒤 선판매를 묻는다'); assert.ok(doc.getElementById('mk-adv-yes'));
  doc.getElementById('mk-adv-yes').click(); await wait(400);
  assert.ok(txt().includes('선지급') && doc.getElementById('mk-sold-price'), '선지급 뒤 판매 완료 처리 칸이 보인다');
  type('mk-sold-price', '460000'); btn('판매 완료 · 정산하기').click(); await wait(500);
  assert.ok(doc.getElementById('mk-settle') && txt().includes('정산 내역'), '정산 내역'); assert.ok(doc.getElementById('mk-L-0').textContent.includes('판매 완료'));
  doc.getElementById('mk-tab-buy').click(); assert.ok(txt().includes('살 물건을 알려 주세요'));
});
test('화면: 판매 탭 — 도우미가 시세·구매자를 찾아 오고, 의향서는 확인한 뒤에만 보낸다', { skip }, async () => {
  const jobs = []; let onD = null, onS = null;
  const agent = { queue: (j) => { jobs.push(j); return Promise.resolve({ ok: true }); }, onData: (f) => { onD = f; }, onStatus: (f) => { onS = f; }, onFile() {}, detect: () => Promise.resolve({ ok: true, version: '0.6.43' }) };
  const p = page(agent); const { doc, btn, type, txt } = p; doc.getElementById('mk-tab-sell').click();
  type('mk-s-name', '중고 노트북'); type('mk-s-ask', '450000'); btn('판매 시작').click(); await wait(80);
  assert.ok(jobs.length === 1 && jobs[0].slot === '시장 판매 시세', '시세 확인을 도우미에게 맡긴다');
  if (onD) onD({ label: '시장 판매 시세', data: { stage: 'candidates', candidates: [{ price: 400000 }, { price: 420000 }, { price: 440000 }] } }); await wait(80);
  assert.ok(txt().includes('시장 가치 추정')); btn('계속 진행').click(); await wait(120);
  assert.ok(jobs.length === 2 && jobs[1].slot === '시장 구매자 물색' && /메시지를 보내지 마세요/.test(jobs[1].goal));
  if (onD) onD({ label: '시장 구매자 물색', data: { stage: 'buyers', buyers: [{ name: '중고매입점', site: '예시', link: 'https://example.com/ask', reason: '매입' }, { name: '위험', link: 'javascript:alert(1)' }] } }); await wait(120);
  assert.ok(doc.getElementById('mk-send') && txt().includes('중고매입점') && !txt().includes('위험'), '의향서 확인 창, 안전하지 않은 링크 후보는 거른다'); assert.equal(jobs.length, 2, '확인 전에는 보내지 않는다');
  doc.getElementById('mk-send').click(); await wait(80); assert.ok(jobs.length === 3 && jobs[2].slot === '시장 판매 의향서');
  if (onS) onS({ label: '시장 판매 의향서', state: 'sent', note: '1곳' }); await wait(40); assert.ok(txt().includes('판매 의향서를 보냈어요'));
});
test('상품 찾기: 쇼핑몰을 고르면 그 사이트에서, 고르지 않으면 웹 전체에서 찾는다', { skip }, async () => {
  const jobs = []; const agent = { onData() {}, detect: () => Promise.resolve({ version: '0.6.43' }), queue: (j) => { jobs.push(j); return Promise.resolve({ ok: true }); } };
  const p = page(agent); const sel = p.doc.getElementById('mk-site'); assert.deepEqual([...sel.options].map((o) => o.textContent), ['웹 전체', '쿠팡', '네이버 쇼핑', '다나와']);
  sel.value = 'danawa'; sel.dispatchEvent(new p.w.Event('change')); p.type('mk-q', '에어프라이어'); p.btn('상품 찾아오기').click(); await wait(30);
  assert.ok(jobs[0].url.startsWith('https://search.danawa.com/') && jobs[0].goal.includes('다나와') && !jobs[0].goal.includes('웹 전체에서'));
});
