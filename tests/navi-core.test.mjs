import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const R = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('소개 패널: "나비웹의 핵심" 탭은 "나비와 나비웹 백서" 바로 오른쪽이다', () => {
  const h = R('desktop.html');
  const ids = ['manual', 'core', 'intro', 'wp'].map((k) => h.indexOf('id="intro-tab-' + k + '"'));
  assert.ok(ids.every((x, i) => x > 0 && (!i || x > ids[i - 1])));
  assert.ok(h.includes("core: 'navi-core.html?v=") && h.includes("['manual', 'core', 'intro', 'wp']"));
  assert.ok(R('ops/naviweb-proxy/mail-paths.js').includes('navi-core.html'));
});

test('나비웹의 핵심: PDV·해시·OpenHash를 설명하고, 한계와 구현 상태를 밝힌다', () => {
  const d = R('navi-core.html');
  for (const w of ['PDV', 'OpenHash', 'SHA-256', '해시 체인', '보장하지 않는 것', '장부 기록은 미완성', '설계 · 파일럿 단계']) assert.ok(d.includes(w), w);
  assert.ok(!/98\.5\s*%|열람할 수 없/.test(d), '확인되지 않은 주장은 싣지 않는다');
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(d), '연습 입력은 어디로도 보내지 않는다');
});
