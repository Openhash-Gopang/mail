import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fetchExport, buildReport, sinceDate } from '../scripts/feedback-weekly.mjs';

test('주간 집계: 기간·토큰·실패 처리', async () => {
  assert.equal(sinceDate(7, new Date('2026-11-09T00:00:00Z')), '2026-11-02');
  await assert.rejects(fetchExport({ since: '2026-11-02' }), (e) => e.code === 2);
  await assert.rejects(fetchExport({ token: 't', since: '2026-11-02', fetchImpl: async () => ({ ok: false, status: 401 }) }), (e) => e.code === 3);
  let url, hdr;
  const items = await fetchExport({ token: 'abc', since: '2026-11-02', fetchImpl: async (u, o) => { url = u; hdr = o.headers; return { ok: true, json: async () => ({ ok: true, items: [{ id: 1 }] }) }; } });
  assert.equal(items.length, 1); assert.match(url, /\/user-feedback\/export\?since=2026-11-02/); assert.equal(hdr.Authorization, 'Bearer abc');
});
test('주간 집계: 보고서 — 3명 이상이면 [조치], 없으면 "새 제보 없음"', () => {
  const rec = (i) => ({ id: 'r' + i, raw_text: '[naviweb:attach] 서류=가족관계증명서 | 문제=agency | 올바른기관=대법원', context_summary: 'dev=d' + i });
  const out = buildReport([1, 2, 3].map(rec), { min: 3, since: '2026-11-02' });
  assert.match(out, /\*\*\[조치\]\*\* 가족관계증명서/); assert.match(out, /받은 제보 3건/);
  assert.match(buildReport([], { since: '2026-11-02' }), /^\(새 제보 없음\)/);
});
test('주간 집계 워크플로: 비밀값은 secrets 로만, 이슈 쓰기 권한만 추가', () => {
  const y = readFileSync(new URL('../.github/workflows/feedback-digest.yml', import.meta.url), 'utf8');
  assert.match(y, /secrets\.USER_FEEDBACK_EXPORT_TOKEN/); assert.match(y, /issues: write/); assert.match(y, /cron:/);
});
