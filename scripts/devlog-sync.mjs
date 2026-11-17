// 개발 현황(desktop.html '개발 현황') 데이터 생성 — 저장소별 git 기록을 일자별로 묶어 devlog.json 으로 쓴다.
// 사용: node scripts/devlog-sync.mjs devlog.json hondi=경로 mail=경로 …   (경로는 git 저장소, 전체 기록 필요)
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [out, ...pairs] = process.argv.slice(2);
if (!out || !pairs.length) { console.error('사용법: node scripts/devlog-sync.mjs devlog.json hondi=경로 mail=경로'); process.exit(1); }

const SINCE = process.env.DEVLOG_SINCE || '2026-05-01';   // 이 날짜 이후의 기록만 담는다
const MAX_ITEMS = Number(process.env.DEVLOG_ITEMS) || 5;   // 하루에 펼쳐 보일 작업 수(나머지는 건수로만)
const BOT = /\[skip ci\]|bump build version|refresh repo digest|자동 갱신/i;
const RANK = { feat: 0, fix: 1, docs: 2 };

function git(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: { ...process.env, TZ: 'Asia/Seoul' } });
}
function clip(s, n) { return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; }

const days = new Map();
const repos = {};
for (const p of pairs) {
  const [name, dir] = p.split('=');
  repos[name] = { total: Number(git(dir, ['rev-list', '--count', 'HEAD']).trim()), url: 'https://github.com/Openhash-Gopang/' + name };
  const log = git(dir, ['log', '--no-merges', '--since=' + SINCE, '--date=format-local:%Y-%m-%d', '--format=%ad\t%s']);
  for (const line of log.split('\n')) {
    if (!line) continue;
    const tab = line.indexOf('\t'); const d = line.slice(0, tab); let s = line.slice(tab + 1).trim();
    if (BOT.test(s)) continue;
    const m = /^(\w+)(?:\([^)]*\))?!?:\s*(.*)$/.exec(s);
    let cat = m ? m[1].toLowerCase() : 'etc'; s = m ? m[2] : s;
    if (!(cat in RANK)) cat = 'etc';
    let pr = 0; s = s.replace(/\s*\(#(\d+)\)\s*$/, (_, n) => { pr = Number(n); return ''; });
    const key = d + '|' + name;
    if (!days.has(key)) days.set(key, { d, r: name, c: { feat: 0, fix: 0, docs: 0, etc: 0 }, all: [] });
    const day = days.get(key); day.c[cat]++; day.all.push([cat, clip(s, 64), pr]);
  }
}
const rows = [...days.values()].sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : a.r < b.r ? -1 : 1)).map((x) => {
  const sorted = x.all.map((it, i) => [it, i]).sort((a, b) => (RANK[a[0][0]] ?? 3) - (RANK[b[0][0]] ?? 3) || a[1] - b[1]).map((e) => e[0]);
  return { d: x.d, r: x.r, c: x.c, i: sorted.slice(0, MAX_ITEMS), m: Math.max(0, sorted.length - MAX_ITEMS) };
});
const updated = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 16).replace(' ', 'T') + '+09:00';
writeFileSync(out, '{"updated":"' + updated + '","repos":' + JSON.stringify(repos) + ',"days":[\n' + rows.map((r) => JSON.stringify(r)).join(',\n') + '\n]}\n');
console.log(out + ': ' + rows.length + '일·저장소 항목');
