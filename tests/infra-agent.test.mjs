import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const rd = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const d = rd('../desktop.html');
// [파일, 전역 이름, 카드 id 접두, 첫 사이트 주소, 화면 설명에 있어야 할 말]
const SIX = [
  ['stock-app.js', 'NaviStock', 'stk', 'seibro.or.kr', /주문·이체·결제는 하지 않아요/],
  ['insurance-app.js', 'NaviInsure', 'ins', 'cont.insure.or.kr', /보험금 청구·해지·가입은 하지 않아요/],
  ['medical-app.js', 'NaviMedical', 'med', 'nhis.or.kr', /예약·결제·서류 제출은 하지 않아요/],
  ['biz-app.js', 'NaviBiz', 'bz', 'bizinfo.go.kr', /신청서 제출과 결제는 하지 않아요/],
  ['job-app.js', 'NaviJob', 'jb', 'work24.go.kr', /입사 지원과 신청서 제출은 하지 않아요/],
  ['logistics-app.js', 'NaviLogistics', 'lg', 'service.epost.go.kr', /발송 신청과 결제는 하지 않아요/, 'parcels'],
];
for (const [file, mod, pre, site, say, view] of SIX) {
  test(`${mod}: 도우미 카드 — 연결이 없으면 알리고, 있으면 고른 사이트만 넘기며 신청·결제는 하지 않는다고 밝힌다`, { skip }, () => {
    const dom = new JSDOM('<!DOCTYPE html><div id="m"></div>', { runScripts: 'outside-only', url: 'https://naviweb.kr/', pretendToBeVisual: true });
    const w = dom.window; w.fetch = () => Promise.reject(new Error('no')); w.Element.prototype.scrollIntoView = () => {};
    w.eval(rd('../' + file)); const doc = w.document; const N = w[mod];
    N.mount(doc.getElementById('m')); if (view) N.view(view);
    const card = doc.getElementById(pre + '-agent'); assert.ok(card, '카드가 보여야 한다'); assert.match(card.textContent, say);
    doc.querySelector('#' + pre + '-agent button').click();
    assert.match(doc.getElementById(pre + '-ag-msg').textContent, /도우미를 쓸 수 없는 화면/);
    const jobs = []; N.on('agent', (j) => jobs.push(j));
    doc.querySelector('#' + pre + '-agent button').click();
    assert.equal(jobs.length, 1); assert.ok(jobs[0].url.startsWith('https://') && jobs[0].url.includes(site)); assert.ok(jobs[0].goal.length > 5);
    assert.match(doc.getElementById(pre + '-ag-msg').textContent, /맡기는 중/);
    N.agentResult(true, '도우미가 사이트를 엽니다.'); assert.match(doc.getElementById(pre + '-ag-msg').textContent, /사이트를 엽니다/);
    assert.match(d, new RegExp(mod + "\\.on\\('agent', \\(j\\) => _infraAgentRun\\('" + mod + "'"));
  });
}
test('호스트: 공통 _infraAgentRun 이 도우미 연결을 확인하고 조회만 맡긴다', () => {
  assert.match(d, /async function _infraAgentRun\(/); assert.match(d, /신청·제출·결제·주문·이체는 하지 마세요/); assert.match(d, /playbook: ''/);
});
