// 카탈로그의 기관 사이트 주소가 살아 있는지 점검한다. 사용: node scripts/catalog-check.mjs  (인터넷 필요, 실패가 있으면 종료 코드 1)
import { createRequire } from 'node:module';
const C = createRequire(import.meta.url)('../attach-catalog.js');
let bad = 0;
for (const [id, a] of Object.entries(C.AGENCIES)) {
  try {
    const r = await fetch(a.url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'naviweb-catalog-check' } });
    const ok = r.status < 400; if (!ok) bad++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${id.padEnd(8)} ${r.status} ${a.url}${r.url !== a.url && !r.url.startsWith(a.url) ? ' → ' + r.url : ''}`);
  } catch (e) { bad++; console.log(`FAIL ${id.padEnd(8)} ${e.message} ${a.url}`); }
}
// 재확인 일정: 수수료 인상 예고처럼 날짜가 정해진 확인 사항(AGENCIES 의 reviewAfter)이 지났으면 알린다.
const today = new Date().toISOString().slice(0, 10);
for (const [id, a] of Object.entries(C.AGENCIES)) if (a.reviewAfter) console.log(`${a.reviewAfter <= today ? '재확인 필요' : '재확인 예정'} ${id.padEnd(8)} ${a.reviewAfter} — ${a.fee || ''}`);
console.log(bad ? `\n${bad}곳 확인 필요 — attach-catalog.js 의 AGENCIES 주소를 점검하세요.` : `\n모두 정상 (카탈로그 확인일 ${C.VERIFIED}).`);
process.exit(bad ? 1 : 0);
