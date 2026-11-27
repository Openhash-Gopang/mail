import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('상단에 설치 단추는 두지 않고, 미설치 안내창이 스토어 설치 화면을 연다', () => {
  const d = rd('desktop.html');
  assert.doesNotMatch(d, /helper-install-btn/);
  assert.match(d, /if \(!_agentGuideSnoozed\(\)\) window\._agentGuideOpen/);
  assert.match(rd('agent-bridge.js'), /STORE_URL = 'https:\/\/chromewebstore\.google\.com\/detail\/bhmnnbmebjppofdboeinccngpeheongi'/);
});
test('지구본과 기능 개선 제안은 사용자 팝업 안에 둔다', () => {
  const d = rd('desktop.html');
  assert.match(d, /hub-extra/);
  assert.match(d, /\.user-row:has\(#hondi-user-badge\) > \.lp-host,\.user-row:has\(#hondi-user-badge\) > \.fb-top\{display:none\}/);
  assert.doesNotMatch(d, /hub-agent/);
});
test('다시 불러온 뒤 남은 옛 다리의 오류 응답이 새 연결을 가리지 않는다', () => {
  assert.match(rd('ops/naviweb-agent/extension/bridge.js'), /!chrome\.runtime \|\| !chrome\.runtime\.id\) return/);
  assert.match(rd('agent-bridge.js'), /context invalidated\/i\.test/);
});
