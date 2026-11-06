// 첨부서류 카탈로그 적용 범위 점검. 사용: node scripts/catalog-coverage.mjs --forms <navi-pro>/public/data/forms [--top 60] [--csv out.csv]
// 서류 양식의 첨부서류 이름을 모아 카탈로그로 분류하고, 분류되지 않은(unknown) 이름을 빈도순으로 보여 준다. 새 양식을 추가한 뒤 실행해 규칙을 보강한다.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
const C = createRequire(import.meta.url)('../attach-catalog.js');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const dir = arg('forms'); if (!dir) { console.error('사용: node scripts/catalog-coverage.mjs --forms <서류 양식 폴더> [--top 60] [--csv out.csv]'); process.exit(2); }
const files = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? files(p) : p.endsWith('.json') ? [p] : []; });
const norm = (t) => String(t).replace(/\(.*?\)|\[.*?\]/g, '').replace(/\d+\s*(부|통|매|장|건)\b/g, '').replace(/\s+/g, '');
const cnt = new Map();
for (const f of files(dir)) { let d; try { d = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; } if (!Array.isArray(d)) continue;
  for (const form of d) for (const a of (form && form.attach) || []) { const t = norm(typeof a === 'string' ? a : a.l || a.n || ''); if (t) cnt.set(t, (cnt.get(t) || 0) + 1); } }
const by = {}, unk = []; let tot = 0;
for (const [t, c] of cnt) { const r = C.classify(t); by[r.kind] = (by[r.kind] || 0) + c; tot += c; if (r.kind === 'unknown') unk.push([t, c]); }
unk.sort((a, b) => b[1] - a[1]);
console.log(`첨부서류 ${tot}건(이름 ${cnt.size}종) · 카탈로그 확인일 ${C.VERIFIED}`);
for (const k of ['agency', 'thirdparty', 'user', 'unknown']) console.log(`  ${k.padEnd(10)} ${String(by[k] || 0).padStart(7)}  ${(((by[k] || 0) / tot) * 100).toFixed(1)}%`);
console.log(`\n분류되지 않은 이름 상위 ${arg('top', 60)}개 (규칙 보강 후보):`);
for (const [t, c] of unk.slice(0, Number(arg('top', 60)))) console.log(`  ${String(c).padStart(5)}  ${t}`);
if (arg('csv')) { writeFileSync(arg('csv'), '﻿이름,빈도\n' + unk.map(([t, c]) => `"${t}",${c}`).join('\n')); console.log('CSV 저장:', arg('csv')); }
