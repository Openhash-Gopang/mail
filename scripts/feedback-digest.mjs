// 사용자 제보 집계. 사용: node scripts/feedback-digest.mjs <제보.json> [--min 3] [--out report.md]
// 입력: 혼디 제보 창구(user_feedback)에서 내려받은 기록 — 배열이거나 { items:[…] } (PocketBase 목록 응답). 각 기록의 raw_text 첫머리가 "[naviweb:<종류>]" 인 것만 쓴다.
//   attach  첨부서류 문제(기관이 달라요·가져오지 못해요·직접 준비 서류예요·버튼이 없어요)  → 카탈로그 규칙 수정 후보
//   newdoc  찾는 서류가 없어요                                                        → 새 서류 양식 추가 후보(요청 많은 순)
//   report  서류 화면의 "오류 신고와 제안" 버튼(유형 bug|idea)                              → 오류 목록 / 제안 목록
//   auto    도우미가 가져오지 못한 서류의 자동 보고(서류 이름·사유 코드만)                    → 카탈로그 규칙·기관 점검 후보
//   bug     오류·불편 신고                                                            → 확인할 목록
// 같은 (종류·서류·문제)를 서로 다른 기록 min 건 이상 받은 것을 "조치 후보"로 표시한다(기본 3). 한 사람이 여러 번 보내도 guid 가 같으면 1건.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const C = createRequire(import.meta.url)('../attach-catalog.js');

const Core = createRequire(import.meta.url)('../feedback-digest-core.js');
export const parse = Core.parse, digest = Core.digest;
const REASON_TEXT = { FETCH_FAILED: '가져오기 실패', SYSTEM_OUTAGE: '기관 시스템 장애(일시적일 수 있음)' };
const PROBLEM_TEXT = { agency: '기관이 달라요', fail: '가져오지 못해요', own: '직접 준비 서류예요', missing: '버튼이 없어요', other: '그 밖의 문제' };
export function report(d) {
  const L = [`# 사용자 제보 집계 (조치 후보 기준: 서로 다른 ${d.min}명 이상)`, ''];
  L.push('## 첨부서류 문제 — 카탈로그 규칙 수정 후보', '');
  if (!d.attach.length) L.push('(없음)');
  for (const g of d.attach) {
    const cur = C.classify(g.label), best = [...g.rights.entries()].sort((a, b) => b[1] - a[1])[0];
    L.push(`- ${g.action ? '**[조치]** ' : ''}${g.label} — ${PROBLEM_TEXT[g.problem] || g.problem} · ${g.n}명 · 현재 분류: ${cur.kind}${cur.id ? '/' + cur.id : ''}${best ? ' · 제안 기관: ' + best[0] : ''}${g.notes.length ? ' · 메모: ' + g.notes.join(' / ') : ''}`);
  }
  L.push('', '## 찾는 서류가 없어요 — 새 서류 양식 후보 (요청 많은 순)', '');
  if (!d.newdoc.length) L.push('(없음)');
  for (const g of d.newdoc) L.push(`- ${g.action ? '**[추가]** ' : ''}${g.label} · ${g.n}명${g.notes.length ? ' · ' + g.notes.join(' / ') : ''}`);
  L.push('', '## 오류·불편 신고', '');
  if (!d.bugs.length) L.push('(없음)');
  for (const b of d.bugs) L.push(`- ${b.text}${b.ctx ? ' (' + b.ctx + ')' : ''}`);
  L.push('', '## 자동 보고 — 도우미가 가져오지 못한 서류', '');
  if (!d.auto || !d.auto.length) L.push('(없음)');
  for (const g of d.auto || []) L.push(`- ${g.action ? '**[조치]** ' : ''}${g.label} — ${REASON_TEXT[g.reason] || g.reason} · ${g.n}명${g.rule ? ' · 규칙: ' + g.rule : ''}${g.agency ? ' · 기관: ' + g.agency : ''}`);
  L.push('', '## 제안 (서류 화면의 "오류 신고와 제안" 버튼)', '');
  if (!d.ideas || !d.ideas.length) L.push('(없음)');
  for (const b of d.ideas || []) L.push(`- ${b.text}${b.ctx ? ' (' + b.ctx + ')' : ''}`);
  return L.join('\n') + '\n';
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2]; if (!file) { console.error('사용: node scripts/feedback-digest.mjs <제보.json> [--min 3] [--out report.md]'); process.exit(2); }
  const arg = (k, dflt) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : dflt; };
  const out = report(digest(JSON.parse(readFileSync(file, 'utf8')), { min: Number(arg('min', 3)) }));
  if (arg('out')) { writeFileSync(arg('out'), out); console.log('저장:', arg('out')); } else process.stdout.write(out);
}
