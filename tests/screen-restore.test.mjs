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
test('서류 작성 중 새로 고침: 열어 둔 서류(사이트·제목)를 PDV 와 무관하게 기억해 같은 서류를 다시 연다', () => {
  assert.match(h, /const _SCR_DOC = 'kmail_doc'/);
  assert.match(h, /function _drAutoSave\(reason\) \{\s*\n\s*if \(_cmpMode === 'doc'\) _scrDocSave\(\);/);
  assert.match(h, /if \(dk && s\.n === 'doc'[^\n]*_scrResumeDoc\(dk\)/);
  assert.match(h, /if \(k\.confirmed && k\.title\) _docHostSubmit\(true\)/);
});
