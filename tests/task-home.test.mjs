import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const R = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const T = (await import('../task-home.js')).default._pure;

const plan = (over = {}) => ({ id: 'g1795000000000', title: '상표 출원', updated: 1795000000000,
  text: `# 과제: 상표 출원\n목적: 등록\n마감: 2026-12-10\n상태: ${over.state || '진행'}\n${over.verdict ? '판정: ' + over.verdict + '\n' : ''}\n## 할 일\n- [x] 선행 조사 | ~2026-11-20\n- [ ] 출원서 검토 | ~2026-12-01\n- [ ] 수수료 납부 | ~2026-11-29\n\n## 기록\n- 2026-11-18 조사함\n- 2026-11-20 초안 작성\n\n## 위험\n- 유사 상표` });

test('과제 목록: 길잡이 계획서와 업무를 한 목록으로 모으고 역할·단계를 정한다', () => {
  const cases = [
    { case_id: 'case-a', title: '자문', mode: 'engaged', my_side: 'provider', state: 'proposed', created_at: '2026-11-01T00:00:00Z' },
    { case_id: 'case-b', title: '소송', mode: 'engaged', my_side: 'consumer', state: 'active', created_at: '2026-11-02T00:00:00Z', deadlines: [{ label: '보정서', due: '2026-11-30T14:59:59.000Z' }] },
    { case_id: 'case-c', title: '정리', mode: 'solo', my_side: 'self', state: 'archived', created_at: '2026-10-01T00:00:00Z', deadlines: [{ label: 'x', due: '2026-10-02T00:00:00Z' }] },
  ];
  const rows = T.buildRows({ g: plan(), empty: { id: 'g2', text: '' } }, cases, [{ id: 'g1795000000000', sev: 3, msg: '「상표 출원」 오늘 할 일 1건: 수수료 납부' }]);
  assert.equal(rows.length, 4);
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.deepEqual([by.g1795000000000.role, by.g1795000000000.stage, by.g1795000000000.next, by.g1795000000000.due], ['solo', '진행 중', '수수료 납부', '2026-11-29']);
  assert.equal(by.g1795000000000.need, '오늘 할 일 1건: 수수료 납부');
  assert.deepEqual([by['case-a'].role, by['case-a'].stage], ['provider', '개시 전']);
  assert.deepEqual([by['case-b'].role, by['case-b'].next, by['case-b'].due], ['consumer', '보정서', '2026-11-30']);
  assert.deepEqual([by['case-c'].role, by['case-c'].stage, by['case-c'].due], ['solo', '완료', '']);
  assert.equal(T.filterRows(rows, 'solo', 'all').length, 2);
  assert.equal(T.filterRows(rows, 'all', '진행 중').length, 2);
  const today = T.todayItems(rows, [{ id: 'g1795000000000', sev: 3, msg: 'm' }, { id: 'z', sev: 1, msg: '정체' }], '2026-11-27');
  assert.deepEqual(today.map((a) => a.key).sort(), ['case:case-a', 'case:case-b', 'guide:g1795000000000']);
});

test('과제 단계: 준비=개시 전, 보류, 종료·판정=완료', () => {
  const st = (o) => T.buildRows({ a: plan(o) }, [], [])[0].stage;
  assert.equal(st({ state: '준비' }), '개시 전');
  assert.equal(st({ state: '보류' }), '보류');
  assert.equal(st({ state: '결과 대기' }), '진행 중');
  assert.equal(st({ state: '종료' }), '완료');
  assert.equal(st({ state: '진행', verdict: '성공' }), '완료');
});

test('식별 코드: 같은 과제는 항상 같은 코드, 만든 해가 앞에 붙는다', () => {
  const a = T.taskNo('g1795000000000', 1795000000000);
  assert.match(a, /^T26-[2-9A-HJ-NP-Z]{5}$/);
  assert.equal(a, T.taskNo('g1795000000000', 1795000000000));
  assert.notEqual(a, T.taskNo('g1795000000001', 1795000000001));
});

test('기록: 최근 것이 먼저, 새 줄은 "## 기록" 절 끝에만 더해진다. 할 일 표시는 그 줄만 바뀐다', () => {
  const t = plan().text;
  assert.deepEqual(T.logsOf(t).map((e) => e.date), ['2026-11-20', '2026-11-18']);
  const n = T.addLog(t, '2026-11-27', '보정서\n초안 작성');
  assert.ok(n.includes('- 2026-11-20 초안 작성\n- 2026-11-27 보정서 초안 작성\n\n## 위험'));
  assert.equal(n.replace('- 2026-11-27 보정서 초안 작성\n', ''), t);
  assert.match(T.addLog('# 과제: a', '2026-11-27', 'x'), /## 기록\n- 2026-11-27 x\n$/);
  const line = T.todosOf(t).find((x) => x.name === '출원서 검토').line;
  const u = T.toggleTodo(t, line);
  assert.ok(u.includes('- [x] 출원서 검토'));
  assert.equal(T.toggleTodo(u, line), t);
});

test('왼쪽 메뉴: "과제" 단일 항목 — 하위 메뉴와 옛 서류·메일 메뉴는 없다', () => {
  const h = R('desktop.html'), nav = h.slice(h.indexOf('<nav class="side-nav"'), h.indexOf('</nav>'));
  assert.ok(nav.includes('id="tab-btn-guidenav"') && nav.includes('data-label="과제"'));
  for (const id of ['nav-legacy', 'task-sub-mail', 'task-sub-docs', 'task-sub-quick', 'task-sub-contacts', 'tab-btn-docs', 'tab-btn-mail', 'tab-btn-quicksend', 'tab-btn-contacts']) assert.ok(!h.includes('id="' + id + '"'), id);
  const en = JSON.parse(R('i18n/en.js').match(/\["en"\] = (\{[\s\S]*\});/)[1]);
  for (const k of ['과제', '메일', '서류', '새로 만들기', '새 과제', '메일 쓰기', '주소록', '양식함', '과제 검색', '메일 검색', '서류 검색']) assert.ok(en[k], k);
});

test('과제 화면 연결: 탭·주소·옛 주소 전환, 예시 데이터는 싣지 않는다', () => {
  const h = R('desktop.html');
  assert.ok(h.includes('id="tab-tasks"') && h.includes('id="task-root"') && h.includes('src="task-home.js?v=') && h.includes('src="hub.js?v=') && h.includes('src="task-links.js?v='));
  assert.ok(h.includes('window.TaskHomeHost = {') && h.includes('window.HubHost'));
  assert.ok(h.includes("const _OLD_HASH = ['gprog', 'gdone', 'campaigns', 'camphist', 'quicksend', 'docdrafts', 'docdone', 'docbox'];"));
  for (const id of ['tab-tasks', 'tab-mail', 'tab-docs']) assert.ok(h.includes('id="' + id + '"'), id);
  for (const id of ['tab-gprog', 'tab-gdone', 'tab-campaigns', 'tab-camphist', 'tab-quicksend', 'tab-docdrafts', 'tab-docdone']) assert.ok(!h.includes('id="' + id + '"'), id);
  assert.match(R('case-ui.js'), /create: create, openNew: openNew/);
  const paths = R('ops/naviweb-proxy/mail-paths.js');
  for (const f of ['task-home.js', 'task-links.js', 'hub.js']) assert.ok(paths.includes('"' + f + '"'), f + ' 중계 목록');
});

test('메일 캠페인은 과제 한 줄이 된다: 작성 중=개시 전, 예약·회신 수집=진행 중, 종료=완료, 실패=확인 필요', () => {
  const rows = T.buildRows({}, [], [], [
    { id: 'a', title: '초안', status: 'draft' },
    { id: 'b', title: '예약', status: 'scheduled', send_at: '2026-12-01T00:00:00Z', recipients: 3 },
    { id: 'c', title: '수집', status: 'sent', collect_replies_until: '2026-12-10T00:00:00Z' },
    { id: 'd', title: '끝', status: 'sent', closed_at: '2026-11-01T00:00:00Z' },
    { id: 'e', title: '실패', status: 'failed' },
  ]);
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.deepEqual(['a', 'b', 'c', 'd', 'e'].map((k) => by[k].stage), ['개시 전', '진행 중', '진행 중', '완료', '진행 중']);
  assert.deepEqual([by.b.due, by.b.recipients, by.c.next, by.d.due, by.d.next], ['2026-12-01', 3, '회신 수집', '', '']);
  assert.ok(rows.every((r) => r.type === 'campaign' && r.role === 'solo' && r.key === 'campaign:' + r.id));
  assert.deepEqual(T.todayItems(rows, [], '2026-11-28').map((x) => x.key), ['campaign:e']);
});
