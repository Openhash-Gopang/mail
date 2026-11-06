import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const p = readFileSync(new URL('../pricing.html', import.meta.url), 'utf8');
test('요금제 — 좌측 메뉴와 상단 바에 동시에 있다', () => {
  assert.match(d, /id="tab-btn-pricing"[^>]*onclick="_switchTab\('pricing'\)"/);
  assert.ok(!d.includes('id="pricing-btn"'), '위쪽 바의 단추는 없앴다');
  assert.match(d, /id="tab-pricing" class="tab-panel"/);
  assert.match(d, /pricing\.html\?embed=mail/);
});
test('플랜 — 최고 플랜 정가 200달러, 베타 90% 할인으로 20달러(12월 말), 환율·입금액 표시', () => {
  assert.match(p, /PRICE_LIST_USD=200,DISCOUNT=\.9/);
  assert.match(p, /BETA_END='2026-12-31'/);
  assert.match(p, /data-b="rate"/);
  assert.match(p, /data-b="krw"/);
  assert.match(p, /Math\.ceil\(window\._usd\*r\.rate\)/);
});
test('요금제 — 제목 없음, Pretendard, 지정 계좌', () => {
  assert.doesNotMatch(p, /<h1/);
  assert.match(p, /Pretendard/);
  assert.match(p, /415-092028-04-011/);
});
test('요금제 — 베타 테스트 보상 안내와 제안 화면 이동 버튼', () => {
  assert.match(p, /베타 테스트 안내/);
  assert.match(p, /100,000 GDC/);
  assert.match(p, /_switchTab\('feedback'\)/);
});
test('플랜 — 무료·$10·$100·$200 네 가지, 무료 플랜 선택은 서버 /auth/free-plan, 내부 10원·5시간 값은 화면에 없다', () => {
  assert.match(p, /id="plan-free"/);
  for (const id of ['plan-p10', 'plan-p100', 'plan-p200']) assert.match(p, new RegExp('id="' + id + '"'));
  assert.match(p, /\$10<small>/); assert.match(p, /\$100<small>/); assert.match(p, /가상 판결/);
  assert.match(p, /\/auth\/free-plan/); assert.match(p, /현재 플랜/);
  assert.match(p, /\$20/); assert.doesNotMatch(p, /10원|5시간/);
});
test('플랜 — 추가 사용량(종량제): 켜기·월 한도 입력, 서버 /auth/extra-usage', () => {
  assert.match(p, /id="extra-sec"/); assert.match(p, /id="x-on"/); assert.match(p, /id="x-lim"/);
  assert.match(p, /\/auth\/extra-usage/); assert.match(p, /월 한도/);
});
