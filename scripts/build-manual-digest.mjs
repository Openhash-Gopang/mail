#!/usr/bin/env node
/* 나비 사용자 매뉴얼(manual/hondi_interactive_manual.html 의 CHAPTERS) → ops/naviweb-qna/manual-digest.js.
 * 질문 게시판 SP·사용법 도우미가 답변 근거로 쓰는 "매뉴얼 발췌"의 원본이다. n = 매뉴얼 장 전체 순번(1부터, NaviManual.current().n 과 같다).
 * 매뉴얼 장을 고치면 이 스크립트를 다시 돌린다: node scripts/build-manual-digest.mjs  (tests/qna-worker.test.mjs 가 최신인지 검사한다) */
import { readFileSync, writeFileSync } from 'node:fs';
const strip = (h) => String(h).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const LEVEL = { beginner: '초급', intermediate: '중급', advanced: '고급' };
export function build() {
  const html = readFileSync(new URL('../manual/hondi_interactive_manual.html', import.meta.url), 'utf8');
  const m = /var CHAPTERS = (\[.*\]);\n/.exec(html);
  return JSON.parse(m[1]).map((c, i) => ({ n: i + 1, level: LEVEL[c.tier] || c.tier, title: c.title, text: strip(c.body) }));
}
if (process.argv[1] && process.argv[1].endsWith('build-manual-digest.mjs')) {
  const out = new URL('../ops/naviweb-qna/manual-digest.js', import.meta.url);
  writeFileSync(out, '// 자동 생성 — 직접 고치지 말고 `node scripts/build-manual-digest.mjs` 를 다시 실행한다(원본: manual/hondi_interactive_manual.html).\nexport const DIGEST = ' + JSON.stringify(build(), null, 1) + ';\n');
  console.log('chapters', build().length);
}
