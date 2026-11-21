// 대화창 출처 — naviweb.kr 화면은 대화창을 naviweb.kr/webapp 으로 열므로 'hondi.net' 고정 비교가 남으면 안 된다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
test('대화창 메시지는 프레임 자신의 출처로 판별한다', () => {
  assert.match(d, /function _hcOrigin\(e\)/);
  for (const t of ['hondi-embed-sp-ready', 'hondi-embed-sp-reply', 'hondi-embed-ctx-request']) {
    const line = d.split('\n').filter(l => l.includes(t) && l.includes('e.origin') || l.includes(t) && l.includes('_hcOrigin'));
    assert.ok(line.every(l => !/e\.origin !== 'https:\/\/hondi\.net'/.test(l)), t);
  }
});
