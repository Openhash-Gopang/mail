// 사용자 제보 집계. 사용: node scripts/feedback-digest.mjs <제보.json> [--min 3] [--out report.md]
// 입력: 혼디 제보 창구(user_feedback)에서 내려받은 기록 — 배열이거나 { items:[…] } (PocketBase 목록 응답). 각 기록의 raw_text 첫머리가 "[naviweb:<종류>]" 인 것만 쓴다.
//   attach  첨부서류 문제(기관이 달라요·가져오지 못해요·직접 준비 서류예요·버튼이 없어요)  → 카탈로그 규칙 수정 후보
//   newdoc  찾는 서류가 없어요                                                        → 새 서류 양식 추가 후보(요청 많은 순)
//   bug     오류·불편 신고                                                            → 확인할 목록
// 같은 (종류·서류·문제)를 서로 다른 기록 min 건 이상 받은 것을 "조치 후보"로 표시한다(기본 3). 한 사람이 여러 번 보내도 guid 가 같으면 1건.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const C = createRequire(import.meta.url)('../attach-catalog.js');

const norm = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[\s·.,:;!?()[\]{}<>\-_/\\'"“”‘’~]/g, '');
export function parse(raw) {
  const m = /^\[naviweb:(attach|newdoc|bug|report)\]\s*(.*)$/s.exec(String(raw || '')); if (!m) return null;
  const f = { kind: m[1] };
  for (const part of m[2].split(' | ')) { const i = part.indexOf('='); if (i > 0) f[part.slice(0, i).trim()] = part.slice(i + 1).trim(); }
  return f;
}
const PROBLEM_TEXT = { agency: '기관이 달라요', fail: '가져오지 못해요', own: '직접 준비 서류예요', missing: '버튼이 없어요', other: '그 밖의 문제' };
export function digest(records, { min = 3 } = {}) {
  const groups = new Map(), bugs = [], ideas = [];
  for (const r of (Array.isArray(records) ? records : records?.items) || []) {
    const f = parse(r.raw_text); if (!f) continue;
    const dev = /(?:^|; )dev=([^;]+)/.exec(r.context_summary || '');
    const who = (dev && dev[1]) || r.guid || r.id || Math.random().toString(36);
    if (f.kind === 'report') {   // 서류 화면의 "오류 신고와 제안" 버튼 — 유형이 idea 면 제안, 아니면 오류 신고
      const item = { text: (f['서류'] ? '[' + f['서류'] + '] ' : '') + (f['내용'] || ''), ctx: r.context_summary || '', id: r.id || '' };
      (f['유형'] === 'idea' ? ideas : bugs).push(item); continue;
    }
    if (f.kind === 'bug') { bugs.push({ text: f['내용'] || '', ctx: r.context_summary || '', id: r.id || '' }); continue; }
    const label = f['서류'] || ''; if (!label) continue;
    const key = [f.kind, norm(label), f['문제'] || ''].join('\n');
    const g = groups.get(key) || { kind: f.kind, label, problem: f['문제'] || '', users: new Set(), rights: new Map(), notes: [] };
    g.users.add(who);
    if (f['올바른기관']) g.rights.set(f['올바른기관'], (g.rights.get(f['올바른기관']) || 0) + 1);
    if (f['내용'] && g.notes.length < 3) g.notes.push(f['내용']);
    groups.set(key, g);
  }
  const rows = [...groups.values()].map((g) => ({ ...g, n: g.users.size, action: g.users.size >= min })).sort((a, b) => b.n - a.n);
  return { attach: rows.filter((g) => g.kind === 'attach'), newdoc: rows.filter((g) => g.kind === 'newdoc'), bugs, ideas, min };
}
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
