// 첨부서류 전체 빈도표 + 분류 근거 보고. 사용: node scripts/attach-report.mjs --forms <서류 양식 폴더> [--out attach_all.csv]
// catalog-coverage.mjs 는 분류되지 않은(unknown) 이름만 저장한다. 이 스크립트는 모든 첨부서류 이름을 빈도순으로 저장하고,
// 어떤 규칙(id)·어떤 낱말 때문에 그 종류(agency/thirdparty/user/unknown)가 되었는지 함께 적는다. 파일은 읽기만 하고 바꾸지 않는다.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, basename } from 'node:path';
const C = createRequire(import.meta.url)('../attach-catalog.js');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const dir = arg('forms'); if (!dir) { console.error('사용: node scripts/attach-report.mjs --forms <서류 양식 폴더> [--out attach_all.csv]'); process.exit(2); }
const out = arg('out', 'attach_all.csv');
const files = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? files(p) : p.endsWith('.json') ? [p] : []; });
// 이름 정리: catalog-coverage.mjs 와 같은 규칙(괄호 안 말·부수 표기·공백 제거)
const norm = (t) => String(t).replace(/\(.*?\)|\[.*?\]/g, '').replace(/\d+\s*(부|통|매|장|건)\b/g, '').replace(/\s+/g, '');
const rules = new Map(C.RULES.map((r) => [r.id, r]));
const rec = new Map(); // 정리된 이름 → { n, forms:Set, jobs:Set, raw:Map }
let forms = 0, withAttach = 0, total = 0;
for (const f of files(dir)) {
  let d; try { d = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { console.error('읽기 실패(건너뜀):', f, e.message); continue; }
  if (!Array.isArray(d)) continue;
  const job = basename(f, '.json');
  for (const form of d) {
    forms++; const list = (form && form.attach) || []; if (list.length) withAttach++;
    const fid = (form && (form.id || (form.titles && form.titles[0]))) || '';
    for (const a of list) {
      const raw = typeof a === 'string' ? a : (a && (a.l || a.n)) || ''; const t = norm(raw); if (!t) continue;
      let r = rec.get(t); if (!r) rec.set(t, (r = { n: 0, forms: new Set(), jobs: new Set(), raw: new Map() }));
      r.n++; total++; r.forms.add(job + ':' + fid); r.jobs.add(job); r.raw.set(raw.trim(), (r.raw.get(raw.trim()) || 0) + 1);
    }
  }
}
const q = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
const rows = [], byKind = {}, byRule = {}, byWord = {};
for (const [t, r] of rec) {
  const c = C.classify(t), rule = rules.get(c.id); let word = '';
  if (rule) { const m = rule.re.exec(t); word = m ? m[0] : ''; }
  const rep = [...r.raw.entries()].sort((a, b) => b[1] - a[1])[0][0];
  rows.push({ t, rep, n: r.n, forms: r.forms.size, jobs: [...r.jobs].sort().join('/'), kind: c.kind, id: c.id || '', word, ag: c.agency || '', input: c.input || '' });
  byKind[c.kind] = (byKind[c.kind] || 0) + r.n;
  const k = c.kind + ' · ' + (c.id || '(규칙 없음)'); byRule[k] = byRule[k] || { n: 0, names: 0 }; byRule[k].n += r.n; byRule[k].names++;
  if (c.id === 'user-own') byWord[word] = (byWord[word] || 0) + r.n;
}
rows.sort((a, b) => b.n - a.n || a.t.localeCompare(b.t, 'ko'));
let cum = 0;
const lines = ['순위,이름,대표표기,빈도,누적비중(%),서식수,직역,종류,규칙,매칭어,기관,입력'];
rows.forEach((r, i) => { cum += r.n; lines.push([i + 1, q(r.t), q(r.rep), r.n, ((cum / total) * 100).toFixed(1), r.forms, q(r.jobs), r.kind, r.id, q(r.word), r.ag, r.input].join(',')); });
writeFileSync(out, '\ufeff' + lines.join('\n'));
const rl = ['규칙,건수,이름종수'];
for (const [k, v] of Object.entries(byRule).sort((a, b) => b[1].n - a[1].n)) rl.push([q(k), v.n, v.names].join(','));
const rulesOut = out.replace(/\.csv$/i, '') + '_by_rule.csv';
writeFileSync(rulesOut, '\ufeff' + rl.join('\n'));
console.log(`서식 ${forms}건(첨부서류가 있는 서식 ${withAttach}건) · 첨부서류 ${total}건 · 이름 ${rec.size}종 · 카탈로그 확인일 ${C.VERIFIED}`);
for (const k of ['agency', 'thirdparty', 'user', 'unknown']) console.log(`  ${k.padEnd(10)} ${String(byKind[k] || 0).padStart(7)}  ${(((byKind[k] || 0) / total) * 100).toFixed(1)}%`);
console.log('\n규칙별 건수:'); for (const [k, v] of Object.entries(byRule).sort((a, b) => b[1].n - a[1].n)) console.log(`  ${String(v.n).padStart(6)}건 ${String(v.names).padStart(6)}종  ${k}`);
console.log('\n"user-own" 규칙에서 가장 많이 걸린 낱말 상위 25:'); for (const [w, n] of Object.entries(byWord).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${String(n).padStart(6)}  ${w}`);
console.log('\n저장:', out, '·', rulesOut);
