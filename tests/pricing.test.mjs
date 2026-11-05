import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const p = readFileSync(new URL('../pricing.html', import.meta.url), 'utf8');
test('요금제 — 좌측 메뉴와 상단 바에 동시에 있다', () => {
  assert.match(d, /id="tab-btn-pricing"[^>]*onclick="_switchTab\('pricing'\)"/);
  assert.match(d, /id="pricing-btn"[^>]*onclick="_switchTab\('pricing'\)"/);
  assert.match(d, /id="tab-pricing" class="tab-panel"/);
  assert.match(d, /pricing\.html\?embed=mail/);
});
test('요금제 — 정가 100달러, 베타 90% 할인, 환율 표시', () => {
  assert.match(p, /PRICE_LIST_USD = 100, DISCOUNT = 0\.9/);
  assert.match(p, /BETA_END = '2026-12-31'/);
  assert.match(p, /id="rate-val"/);
  assert.match(p, /Math\.ceil\(window\._usd \* r\.rate\)/);
});
