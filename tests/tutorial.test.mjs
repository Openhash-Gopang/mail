import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const t = readFileSync(new URL('../tutorial.html', import.meta.url), 'utf8');

test('왼쪽 메뉴 도움말 묶음에 튜토리얼 영상 메뉴가 있고 패널과 연결된다', () => {
  assert.match(d, /id="tab-btn-tutorial"[^>]*onclick="_switchTab\('tutorial'\)"/);
  assert.ok(d.indexOf('id="tab-btn-guide"') < d.indexOf('id="tab-btn-tutorial"') && d.indexOf('id="tab-btn-tutorial"') < d.indexOf('id="tab-btn-whitepaper"'), '사용법 다음, Whitepaper 앞');
  assert.match(d, /id="tab-tutorial" class="tab-panel"/);
  assert.match(d, /name === 'tutorial'[^\n]*tutorial\.html/);
});

test('튜토리얼 페이지: 영상 30편, 번호 순서대로', () => {
  const groups = t.slice(t.indexOf('var GROUPS'), t.indexOf('var YT'));
  assert.equal((groups.match(/\['/g) || []).length, 30);
  const yt = t.slice(t.indexOf('var YT'), t.indexOf('function idOf'));
  assert.equal((yt.match(/\d+:/g) || []).length, 30);
  assert.match(t, /youtube-nocookie\.com\/embed\//);
});
