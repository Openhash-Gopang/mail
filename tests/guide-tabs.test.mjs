import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const R = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('나비 길잡이: 하위 메뉴가 없고 내 위치(조준점) 아이콘의 단일 항목이다', () => {
  const h = R('desktop.html');
  const btn = /<button id="tab-btn-guidenav"[\s\S]*?<\/button>/.exec(h)[0];
  assert.ok(btn.includes('onclick="_guideTabOpen()"'));
  assert.ok(btn.includes('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'), '내 위치 아이콘');
  assert.ok(!btn.includes('M4 22V3'), '깃발 아이콘은 없음');
  for (const id of ['nav-group-guide', 'nav-sub-guide', 'nav-toggle-guide', 'tab-btn-gprog', 'tab-btn-gdone', 'tab-btn-case']) assert.ok(!h.includes('id="' + id + '"'), id + ' 은(는) 없어야 함');
  assert.ok(!/_navToggleGuide|_caseLast|_guideNavOpen/.test(h));
});

test('나비 길잡이 화면 위쪽 탭: 진행 중 · 완료 · 맡긴 일 · 맡은 일 (이 순서)', () => {
  const h = R('desktop.html');
  assert.ok(h.includes("const _GTABS = [['gprog', '진행 중'], ['gdone', '완료'], ['casecons', '맡긴 일'], ['caseprov', '맡은 일']];"));
  assert.ok(h.includes('id="gt-bar-gprog"') && h.includes('id="gt-bar-gdone"'));
  assert.ok(h.includes("_gtabsFill(name); _guideRenderList("), '탭 화면에 들어올 때 탭 줄을 그림');
  assert.ok(h.includes("name === 'gprog' || name === 'gdone' || name.indexOf('case') === 0 ? 'guidenav'"), '모든 탭에서 왼쪽 메뉴 나비 길잡이가 켜짐');
});

test('나 홀로 페이지는 진행 중·완료 탭으로 흡수: 목록은 두 탭 아래, 상세는 상태에 따라 탭이 켜진다', () => {
  const h = R('desktop.html'), c = R('case-ui.js');
  assert.ok(h.includes('id="gprog-solo"') && h.includes('id="gdone-solo"'));
  assert.ok(h.includes("CaseUI.fillSolo(name === 'gdone' ? 'done' : 'prog')"));
  assert.match(c, /function fillSolo\(kind\)/);
  assert.match(c, /\(kind === 'done'\) === isDone\(c\)/);
  assert.match(c, /name === 'casesolo' \? \(state === 'closed' \|\| state === 'archived' \? 'gdone' : 'gprog'\) : name/);
  assert.ok(c.includes("if (name === 'casesolo') { if (typeof root._switchTab === 'function') root._switchTab('gprog'); return; }"));
});
