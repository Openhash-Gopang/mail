// K-Address 채팅 — 오류로 끝난 요청은 대화 기록에서 뺀다(다음 요청에 딸려 실행되는 사고 방지, 2026-11-21).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
test('_kaddrSend: 답을 못 받으면 보낸 사용자 메시지를 기록에서 제거한다', () => {
  const i = html.indexOf('async function _kaddrSend');
  const body = html.slice(i, i + 6000);
  assert.match(body, /let _kaddrAnswered = false/);
  assert.match(body, /_kaddrAnswered = true;\s*\n\s*_kaddrChat\.messages\.push\(\{ role: 'assistant'/);
  assert.match(body, /if \(!_kaddrAnswered\) \{ const i = _kaddrChat\.messages\.lastIndexOf\(_kaddrUserMsg\)/);
});
