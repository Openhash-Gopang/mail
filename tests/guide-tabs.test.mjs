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

test('사용법 위쪽 탭: 나비 사용자 매뉴얼 · 질문·답변 · Openhash · Navi Pro(강의 탭은 없다)', () => {
  const g = R('guide.js');
  const names = ['나비 사용자 매뉴얼', '질문·답변', 'Openhash', 'Navi Pro'].map((n) => g.indexOf("'" + n + "'"));
  assert.ok(names[0] > 0 && names[0] < names[1] && names[1] < names[2] && names[2] < names[3], '탭 순서');
  assert.ok(!g.includes('사용법 강의') && !g.includes("'course'"), '강의 탭 삭제');
  assert.match(g, /fetch\('manual\/hondi_interactive_manual\.html', \{[^}]*cache: 'no-cache'/);
  assert.match(g, /attachShadow\(\{ mode: 'open' \}\)/);
  assert.ok(!/createElement\('iframe'\)/.test(g), 'iframe 없이 직접 붙인다');
  assert.match(g, /attachChat\(el\)/);
  assert.match(g, /ManualChat\.mount\(S\.mc, \{ getChapter/);
  assert.match(R('desktop.html'), /\.gd-manual\{/);
  assert.ok(R('manual/hondi_interactive_manual.html').includes('var CHAPTERS'));
  assert.match(R('manual/hondi_interactive_manual.html'), /current: function \(\) \{ var i = -1;/);
});

test('나비 온도: 36.5에서 시작, 초급 60 · 중급 80 · 고급 100 구간(매뉴얼 진행률만), 95° 이상 CNS', async () => {
  const G = (await import('../guide.js')).default;
  const T = G._pure.naviTemp;
  assert.equal(T(null), 36.5);
  assert.equal(T([1, 0, 0]), 60);
  assert.equal(T([1, 1, 0]), 80);
  assert.equal(T([1, 1, 1]), 100);
  assert.equal(T([1, 1, 0.75]), 95);
  assert.ok(T([1, 1, 0.7]) < G._pure.CNS_AT && T([1, 1, 0.75]) >= G._pure.CNS_AT);
  assert.match(R('manual/hondi_interactive_manual.html'), /function naviTemp\(\)/);
  assert.match(R('guide.js'), /data-act="cns"/);
});
