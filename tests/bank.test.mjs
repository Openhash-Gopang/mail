import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const app = readFileSync(new URL('../bank-app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../bank.css', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const daily = Array.from({ length: 60 }, (_, i) => { const dd = day(59 - i); return { d: dd, req: 10, tok: 1000, krw: 100, svc: { 'hondi-chat': { req: 8, tok: 800, krw: 80 }, klaw: { req: 2, tok: 200, krw: 20 } }, models: {} }; });
daily[59].d = today;
const API = {
  '/biz/balance': { ok: true, balance: 5200 },
  '/free-quota-status': { ok: true, spent_krw: 3000, limit_krw: 10000, remaining_krw: 7000, estimated_monthly_krw: 9000, projected_days_to_limit: 20 },
  '/usage-log': { ok: true, series: { daily, hourly: [{ h: 9, req: 1, tok: 10, krw: 5, svc: {}, models: {} }] }, by_model: [{ model: 'm1', requests: 5, hit_tokens: 1, miss_tokens: 2, out_tokens: 3, billed_krw: 700 }] },
  '/biz/charge-status': { ok: true, requests: [{ requested_krw: 10000, status: 'matched' }, { requested_krw: 5000, status: 'pending' }] }
};
function page(o) {
  const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
  const w = dom.window, urls = [];
  const fetch = async (u) => { urls.push(u); const p = u.replace('https://px.test', '').replace(/[?&]guid=.*/, '').replace(/\?days=90/, '?days=90'); const key = Object.keys(API).find((k) => p.startsWith(k)); return { json: async () => (o && o.fail) ? { ok: false } : API[key] }; };
  w.eval(app);
  const doc = w.document, out = [], asks = [];
  w.NaviBank.on('result', (m) => out.push(m)); w.NaviBank.on('ask', (t) => asks.push(t));
  w.NaviBank.mount(doc.getElementById('m'), Object.assign({ guid: 'g1', proxy: 'https://px.test', fetch }, o && o.mount));
  const txt = () => doc.getElementById('bnk-root').textContent;
  const btn = (t) => [...doc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t));
  const until = async (re, ms) => { const t0 = Date.now(); while (!re.test(txt())) { if (Date.now() - t0 > (ms || 3000)) throw new Error('기다리던 글이 없다: ' + re + '\n' + txt().slice(0, 400)); await new Promise((r) => setTimeout(r, 10)); } };
  return { w, doc, out, asks, urls, txt, btn, until, nav: (a) => w.NaviBank.nav(a) };
}
const type = (p, id, v) => { const i = p.doc.getElementById(id); i.value = v; i.dispatchEvent(new p.w.Event('input', { bubbles: true })); };

test('내 지갑: 잔액·무료 한도·이번 달 청구액을 서버 값으로 보여 준다', { skip }, async () => {
  const p = page(); await p.until(/5,200/);
  assert.match(p.doc.getElementById('bnk-bal').textContent, /5,200GDC/);
  assert.match(p.txt(), /3,000원 \/ 10,000원 \(30%\)/); assert.match(p.txt(), /20일 후 무료 한도/);
  assert.match(p.txt(), /이번 달 청구액/); assert.match(p.doc.querySelector('.brand').textContent, /나비웹 은행/);
  assert.equal(p.doc.querySelectorAll('.tab').length, 6);
  assert.ok(p.urls.some((u) => /\/biz\/balance\?guid=g1/.test(u)) && p.urls.some((u) => /usage-log\?days=90&guid=g1/.test(u)));
});
test('잔액이 1,000 GDC 이하이면 충전을 권한다', { skip }, async () => {
  const dom = page(); await dom.until(/5,200/);
  API['/biz/balance'] = { ok: true, balance: 800 }; const p = page(); await p.until(/800/); assert.match(p.txt(), /1,000 GDC 이하/);
  API['/biz/balance'] = { ok: true, balance: 5200 };
});
test('로그인 전(guid 없음)이면 안내만 하고 수치를 지어내지 않는다', { skip }, async () => {
  const p = page({ mount: { guid: '' } }); assert.match(p.txt(), /로그인된 상태여야/); assert.match(p.doc.getElementById('bnk-bal').textContent, /—/); assert.equal(p.urls.length, 0);
});
test('서버가 모두 실패하면 다시 시도 단추를 보인다', { skip }, async () => {
  const p = page({ fail: true }); await p.until(/불러오지 못했습니다/); assert.ok(p.btn('다시 시도'));
});
test('충전·입금: 계좌·순서·요금제·베타·충전 내역', { skip }, async () => {
  const p = page(); await p.until(/5,200/); p.nav({ do: 'topup' }); await p.until(/충전 완료/);
  assert.match(p.txt(), /중소기업은행/); assert.match(p.txt(), /415-092028-04-011/); assert.match(p.txt(), /에이아이시티주식회사/);
  assert.match(p.txt(), /입금자명을 가입한 이름과 같게/); assert.match(p.txt(), /\$200 \/ 월/); assert.match(p.txt(), /입금 대기/); assert.match(p.txt(), /정기 자동결제를 쓰지 않습니다/);
  assert.equal(/베타 테스트 기간/.test(p.txt()), today <= '2026-12-31');
  let opened = 0; const q = page({ mount: { onPlans: () => opened++ } }); q.nav({ do: 'topup' }); q.btn('요금제 열기').click(); assert.equal(opened, 1);
});
test('송금·결제: 코드 10자리·금액을 검사하고 확인 창만 띄운다(돈은 움직이지 않는다)', { skip }, async () => {
  const p = page(); await p.until(/5,200/); p.nav({ do: 'pay' });
  const go = () => p.doc.getElementById('bnk-pay-go'); assert.equal(go().disabled, true);
  type(p, 'bnk-code', '123'); assert.match(p.doc.getElementById('bnk-code-h').textContent, /숫자 10자리/); assert.equal(go().disabled, true);
  type(p, 'bnk-code', '1234567890'); type(p, 'bnk-amt', '99999'); assert.match(p.doc.getElementById('bnk-amt-h').textContent, /잔액\(5,200 GDC\)보다 큽니다/); assert.equal(go().disabled, true);
  type(p, 'bnk-amt', '1500'); type(p, 'bnk-memo', '아메리카노 2잔'); assert.equal(go().disabled, false);
  const n0 = p.urls.length; go().click();
  const dlg = p.doc.getElementById('bnk-ov'); assert.equal(dlg.hidden, false); assert.match(dlg.textContent, /1234567890/); assert.match(dlg.textContent, /1,500 GDC/); assert.match(dlg.textContent, /돈을 보내지 않습니다/); assert.match(dlg.textContent, /되돌리는 방법은 확인되지 않았습니다/);
  assert.equal(p.urls.length, n0, '확인 창을 열어도 서버를 부르지 않는다');
  p.doc.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape' })); assert.equal(dlg.hidden, true);
});
test('말로 이동: 송금 값은 채워 두기만 하고, 모르는 조작은 거절한다', { skip }, async () => {
  const p = page(); await p.until(/5,200/);
  p.nav({ do: 'pay', code: '12-34567890', amount: '1,500원', memo: '커피' }); assert.equal(p.out.pop().ok, true);
  assert.equal(p.doc.getElementById('bnk-code').value, '1234567890'); assert.equal(p.doc.getElementById('bnk-amt').value, '1500');
  p.nav({ do: 'transfer' }); assert.equal(p.out.pop().ok, false);
  p.nav({ do: 'history', range: '30' }); assert.equal(p.out.pop().ok, true); assert.equal(p.doc.querySelector('.seg [aria-pressed=true]').textContent, '30일');
});
test('거래 내역: 기간별 합계·분야별·청구서·모델별·충전 내역', { skip }, async () => {
  const p = page(); await p.until(/5,200/); p.nav({ do: 'history', range: '7' });
  assert.match(p.txt(), /청구액700원/); assert.match(p.txt(), /API 요청70/); assert.match(p.txt(), /나비 대화·서류 작성·전문가 AI/); assert.match(p.txt(), /K-Law\(법률\)/);
  assert.match(p.txt(), /월 청구서/); assert.match(p.txt(), /월 기본료는 없습니다/); assert.match(p.txt(), /m1/); assert.match(p.txt(), /충전 완료/);
  p.btn('30일').click(); assert.match(p.txt(), /청구액3,000원/); assert.match(p.txt(), /직전 30일\(3,000원\)보다/);
  p.btn('오늘').click(); assert.match(p.txt(), /어제\(/);
});
test('예금·대출: 준비 중 표시, 계산기는 입력한 이율로만 계산한다', { skip }, async () => {
  const p = page(); p.nav({ do: 'save' }); assert.match(p.txt(), /아직 설계 단계/); assert.equal((p.txt().match(/준비 중/g) || []).length >= 3, true);
  assert.match(p.txt(), /원금·연 이율·기간을 모두 적으면/);
  type(p, 'bnk-c-p', '1000000'); type(p, 'bnk-c-r', '3'); type(p, 'bnk-c-m', '12');
  assert.match(p.doc.getElementById('bnk-calc-out').textContent, /만기 이자\(단리\)30,000 GDC/); assert.match(p.doc.getElementById('bnk-calc-out').textContent, /1,030,000 GDC/);
  p.btn('대출').click(); type(p, 'bnk-c-p', '1200000'); type(p, 'bnk-c-r', '0'); type(p, 'bnk-c-m', '12'); assert.match(p.doc.getElementById('bnk-calc-out').textContent, /매월 상환액100,000 GDC/);
  const c = p.w.NaviBank.calc; assert.equal(c('save', 0, 3, 12), null); assert.equal(c('save', 1000, -1, 12), null); assert.equal(c('loan', 1000, 5, 0), null);
  const L = c('loan', 1000000, 12, 12); assert.ok(Math.abs(L.monthly - 88848.79) < 0.01); assert.ok(Math.abs(L.total - L.monthly * 12) < 0.05);
});
test('신용·채권: 개념 시연 표시, 내 등급은 지어내지 않는다, 질문은 은행 AI 로', { skip }, async () => {
  const p = page(); p.nav({ do: 'credit' });
  assert.match(p.txt(), /실제 자금이 오가지 않으며/); assert.match(p.txt(), /발행자 18명/); assert.match(p.txt(), /발행자 230만 명/); assert.match(p.txt(), /표시할 등급이 없습니다/);
  p.btn('은행 AI에게 묻기').click(); assert.match(p.asks.pop(), /신용 등급/);
});
test('내 지갑의 은행 AI 질문이 대화 이벤트로 나간다', { skip }, async () => {
  const p = page(); p.btn('은행 AI에게 묻기').click(); assert.match(p.asks.pop(), /잔액/);
});
test('bank.css: .bnk 범위 안에서만 규칙을 쓰고 M3 규격(개요선 카드·40px 알약·48px 탭)', () => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.split('{')[0].trim()).filter((s) => s && !s.startsWith('@') && !/^(from|to)$/.test(s));
  const bad = rules.filter((s) => s.split(',').some((x) => !x.trim().startsWith('.bnk')));
  assert.deepEqual(bad, []);
  assert.match(css, /\.bnk \.card\{[^}]*border-radius:12px[^}]*box-shadow:none/); assert.match(css, /\.bnk \.btn\{[^}]*min-height:40px/); assert.match(css, /\.bnk \.tab\{[^}]*height:48px/);
});
test('desktop.html: 인프라 AI → 은행은 은행 화면을 바로 열고, 이름 칩도 그 화면으로 간다', () => {
  assert.match(d, /id="tab-bank"[^>]*><div id="bank-root"><\/div>/);
  assert.match(d, /if \(key === 'gdc' && !_bankChat\) \{ _bankOpen\('wallet'\); return; \}/);
  assert.match(d, /'bank-app\.js\?v=' \+ _BANK_V/); assert.match(d, /'bank\.css\?v=' \+ _BANK_V/);
  assert.match(d, /gdc:\['송금·결제>bank:pay','내 지갑\(GDC\)>bank:wallet','거래 내역>bank:history','청구서>bank:history'\]/);
  assert.match(d, /go\.indexOf\('bank:'\) === 0\) \{ _bankOpen/);
  assert.match(d, /id="tab-btn-bank"[^>]*onclick="_switchTab\('bank'\)"/);
  assert.ok(!/bank-frame|<iframe[^>]*bank/.test(d));
});
