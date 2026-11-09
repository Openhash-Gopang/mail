// 안내 영상 재생목록(YouTube) → guide-videos.json 동기화.
// desktop.html 의 "안내 영상" 화면이 이 파일을 읽어 카드를 만든다. GitHub Actions(guide-videos.yml)가 주기적으로 실행한다.
// 사용: node scripts/guide-videos-sync.mjs [재생목록ID] [출력파일]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
const num = (t) => { const m = /navi\s*0*(\d+)/i.exec(t || ''); return m ? parseInt(m[1], 10) : 1e9; };
const oneLine = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
const hms = (sec) => { sec = Math.round(+sec); if (!(sec > 0)) return ''; const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };

// YouTube 재생목록 RSS → [{ id, t, d }]
export function parseFeed(xml) {
  const out = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const id = (/<yt:videoId>([^<]+)<\/yt:videoId>/.exec(e) || [])[1];
    const t = (/<title>([\s\S]*?)<\/title>/.exec(e) || [])[1];
    const d = (/<media:description>([\s\S]*?)<\/media:description>/.exec(e) || [])[1];
    if (id && t) out.push({ id, t: unesc(t).trim(), d: oneLine(unesc(d || ''), 140) });
  }
  return out;
}
// 번호(navi 01, navi 003 …) 순. 번호가 없으면 목록 순서대로 뒤에.
export function sortByNumber(list) { return list.map((v, i) => [v, i]).sort((a, b) => num(a[0].t) - num(b[0].t) || a[1] - b[1]).map((x) => x[0]); }
// 이전 파일 내용과 합친다: 길이·설명을 이번에 못 얻었으면 이전 값을 유지한다.
export function merge(fresh, prev) {
  const old = new Map((prev || []).map((v) => [v.id, v]));
  return sortByNumber(fresh).map((v) => { const o = old.get(v.id) || {}; return { id: v.id, t: v.t, len: v.len || o.len || '', d: v.d || o.d || '' }; });
}

async function main() {
  const [, , listId = 'PLExMxaYxMDPE', outFile = 'guide-videos.json'] = process.argv;
  const res = await fetch('https://www.youtube.com/feeds/videos.xml?playlist_id=' + encodeURIComponent(listId), { headers: { 'user-agent': 'naviweb-guide-sync' } });
  if (!res.ok) throw new Error('재생목록 피드를 받지 못했습니다: HTTP ' + res.status);
  const fresh = parseFeed(await res.text());
  if (!fresh.length) throw new Error('피드에 영상이 없습니다 — 기존 파일을 그대로 둡니다');
  for (const v of fresh) {   // 길이는 피드에 없어 영상 페이지에서 가져온다(실패하면 이전 값 유지)
    try { const h = await (await fetch('https://www.youtube.com/watch?v=' + v.id, { headers: { 'user-agent': 'naviweb-guide-sync' } })).text(); v.len = hms((/"lengthSeconds":"(\d+)"/.exec(h) || [])[1]); } catch (e) { /* 이전 값 유지 */ }
  }
  let prev = []; try { if (existsSync(outFile)) prev = JSON.parse(readFileSync(outFile, 'utf8')).videos || []; } catch (e) {}
  const next = JSON.stringify({ list: listId, videos: merge(fresh, prev) }, null, 2) + '\n';
  if (!existsSync(outFile) || readFileSync(outFile, 'utf8') !== next) { writeFileSync(outFile, next); console.log('갱신:', fresh.length + '개'); } else console.log('변경 없음');
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) main().catch((e) => { console.error(e.message); process.exit(1); });
