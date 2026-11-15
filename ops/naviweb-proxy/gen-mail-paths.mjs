// mail 저장소의 공개 파일 목록 → mail-paths.js (프록시가 "이 경로는 mail 원본" 판별에 쓴다). 파일을 추가·삭제하면 `node ops/naviweb-proxy/gen-mail-paths.mjs` 를 다시 실행한다.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const SKIP = /^(tests|docs|ops|scripts|\.github|node_modules)\//;
const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean).filter(f => !SKIP.test(f) && f !== 'CNAME' && f !== 'webapp.html' && !f.startsWith('.'));
const DIRS = ['manual/', 'i18n/', 'agent/', 'assets/guide/'];
const exact = files.filter(f => !DIRS.some(d => f.startsWith(d))).sort();
writeFileSync(new URL('./mail-paths.js', import.meta.url), `// 자동 생성 — gen-mail-paths.mjs. 직접 고치지 않는다.\nexport const MAIL_DIRS = ${JSON.stringify(DIRS)};\nexport const MAIL_FILES = new Set(${JSON.stringify(exact, null, 1)});\n`);
console.log('mail-paths.js', exact.length, 'files +', DIRS.length, 'dirs');
