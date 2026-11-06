#!/usr/bin/env node
/* guide.js(사용법 장) → ops/naviweb-qna/manual-digest.js. 질문 게시판 SP 가 답변 근거로 쓰는 "매뉴얼 발췌"의 원본이다.
 * 사용법 장을 고치면 이 스크립트를 다시 돌린다: node scripts/build-manual-digest.mjs  (tests/qna-worker.test.mjs 가 최신인지 검사한다) */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { _pure: G } = require('../guide.js');
const strip = (h) => String(h).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
export function build() {
  return G.pages(true).map((p, i) => ({ n: i + 1, level: p.level, title: p.title, text: p.body.map(strip).join(' ') }));
}
if (process.argv[1] && process.argv[1].endsWith('build-manual-digest.mjs')) {
  const out = new URL('../ops/naviweb-qna/manual-digest.js', import.meta.url);
  writeFileSync(out, '// 자동 생성 — 직접 고치지 말고 `node scripts/build-manual-digest.mjs` 를 다시 실행한다(원본: guide.js).\nexport const DIGEST = ' + JSON.stringify(build(), null, 1) + ';\n');
  console.log('chapters', build().length);
}
