// 사용자 제보 주간 자동 집계. 사용: USER_FEEDBACK_EXPORT_TOKEN=… node scripts/feedback-weekly.mjs [--days 7] [--min 3] [--out report.md] [--endpoint <주소>]
// 혼디 제보 창구의 GET /user-feedback/export 로 최근 제보를 받아 feedback-digest 로 집계해 보고서를 쓴다. 제보가 없으면 보고서 첫 줄이 "(새 제보 없음)".
// 종료 코드: 0 성공 · 2 토큰 없음 · 3 내려받기 실패. (GitHub Actions 주간 실행: .github/workflows/feedback-digest.yml)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { digest, report } from './feedback-digest.mjs';

export const DEFAULT_ENDPOINT = 'https://hondi-proxy.tensor-city.workers.dev';
export function sinceDate(days, now = new Date()) { return new Date(now.getTime() - days * 864e5).toISOString().slice(0, 10); }

export async function fetchExport({ endpoint = DEFAULT_ENDPOINT, token, since, limit = 2000, fetchImpl = fetch }) {
  if (!token) { const e = new Error('USER_FEEDBACK_EXPORT_TOKEN 이 없습니다'); e.code = 2; throw e; }
  const r = await fetchImpl(`${endpoint}/user-feedback/export?since=${encodeURIComponent(since)}&limit=${limit}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) { const e = new Error(`내려받기 실패 (HTTP ${r.status})`); e.code = 3; throw e; }
  const j = await r.json();
  if (!j || j.ok !== true) { const e = new Error('내려받기 실패 (응답 형식)'); e.code = 3; throw e; }
  return j.items || [];
}
export function buildReport(items, { min = 3, since = '' } = {}) {
  const head = `_집계 기간: ${since} 이후 · 받은 제보 ${items.length}건_\n\n`;
  const body = report(digest(items, { min }));
  return (items.length ? '' : '(새 제보 없음)\n\n') + head + body;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
  const since = sinceDate(Number(arg('days', 7)));
  try {
    const items = await fetchExport({ endpoint: arg('endpoint', DEFAULT_ENDPOINT), token: process.env.USER_FEEDBACK_EXPORT_TOKEN, since });
    const out = buildReport(items, { min: Number(arg('min', 3)), since });
    if (arg('out')) { writeFileSync(arg('out'), out); console.log('저장:', arg('out'), `(${items.length}건)`); } else process.stdout.write(out);
  } catch (e) { console.error(e.message); process.exit(e.code || 3); }
}
