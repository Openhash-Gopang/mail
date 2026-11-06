import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
test('화면 이름을 저장하고 부팅 시 복원한다', () => {
  assert.match(h, /_scrSave\(name\);\s*\n\}/);
  assert.match(h, /async function _scrRestore\(/);
  assert.match(h, /_scrBoot\(\)/);
});
test('Draft id 를 보관하고 4초 주기 자동 저장(tick)은 Word 캡처를 건너뛴다', () => {
  assert.match(h, /_scrDraftIdSave\(item\.id, item\.kind\)/);
  assert.match(h, /setInterval\(\(\) => \{ try \{ _drAutoSave\('tick'\)/);
  assert.match(h, /reason !== 'tick'\) _drCapture/);
});
