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

test('과제 화면의 탭은 과제·메일·서류 한 층이다. 진행 상태·역할은 탭이 아니라 걸러 보기다', () => {
  const h = R('desktop.html'), c = R('case-ui.js'), hub = R('hub.js'), th = R('task-home.js');
  assert.match(hub, /\[\['tasks', '과제'\], \['mail', '메일'\], \['docs', '서류'\]\]/);
  for (const n of ['tasks', 'mail', 'docs']) assert.ok(h.includes('data-hub="' + n + '"'), n);
  assert.ok(!h.includes('_GTABS') && !h.includes('gt-bar') && !c.includes('fillSolo'));
  for (const w of ['진행 중', '개시 전', '보류', '완료', '맡은 일', '맡긴 일', '자체 진행', '메일 캠페인']) assert.ok(th.includes(w), w);
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

test('나비 지식 온도: 36.5에서 시작, 초급 60 · 중급 80 · 고급 100 구간(매뉴얼 진행률만), 95° 이상 CNS', async () => {
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

test('Openhash·Navi Pro 탭은 준비 중 자리가 아니라 안내 화면이다', () => {
  const g = R('guide.js');
  assert.ok(!g.includes('renderSoon'));
  assert.ok(g.includes('function renderOpenhash') && g.includes('function renderNaviPro'));
  for (const d of ['law', 'ip', 'appraiser', 'doctor', 'tax', 'school']) assert.ok(g.includes("'" + d + "'"), d);
});
