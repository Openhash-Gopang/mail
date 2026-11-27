import test from 'node:test';
import assert from 'node:assert/strict';
const H = (await import('../hub.js')).default._pure;
const L = (await import('../task-links.js')).default;

function memory() { const m = new Map(); globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; }

test('과제 연결: 지정·조회·해제, 과제를 지우면 그 연결만 사라진다', () => {
  memory();
  assert.ok(L.set('doc:1', 'guide:a', { kind: 'doc', label: '신청서', taskTitle: '응모' }, 1));
  L.set('mail:2', 'guide:a', { kind: 'mail', label: '안내' }, 2);
  L.set('doc:3', 'case:b', { kind: 'doc', label: '위임장' }, 3);
  assert.equal(L.get('doc:1').task, 'guide:a');
  assert.equal(L.get('doc:1').taskTitle, '응모');
  assert.equal(L.forTask('guide:a').length, 2);
  L.remove('mail:2');
  assert.equal(L.forTask('guide:a').length, 1);
  L.dropTask('guide:a');
  assert.equal(L.get('doc:1'), null);
  assert.equal(L.get('doc:3').task, 'case:b');
});

test('서류 목록: 같은 이름의 이력은 서류 한 줄로 합치고, 서류 없는 이력은 따로 남긴다', () => {
  const rows = H.docRows([{ id: 'd1', title: '신청서', updated: 10 }], [{ id: 'd2', title: '위임장', updated: 20, hasFile: true }],
    [{ id: 'h1', title: '위임장', state: 'submitted', label: '제출', at: 30, agency: '등기소' }, { id: 'h2', title: '증명서', state: 'issued', label: '발급', at: 5, agency: '정부24', hasFile: true }]);
  assert.deepEqual(rows.map((r) => [r.id, r.state]), [['d2', 'submitted'], ['d1', 'draft'], ['h2', 'issued']]);
  assert.equal(rows[0].agency, '등기소');
  assert.equal(rows[2].source, 'history');
  assert.deepEqual(H.nextAction(rows[1]), ['resume', '이어 쓰기']);
});

test('새 과제: 역할·유형에 따라 만들 수 있는 방법이 다르다', () => {
  const solo = H.newTaskChoices('solo', 'plain', true);
  assert.deepEqual([solo.consult, solo.direct, solo.email], [true, true, false]);
  const prov = H.newTaskChoices('provider', 'plain', true);
  assert.deepEqual([prov.consult, prov.direct, prov.email], [false, true, true]);
  const camp = H.newTaskChoices('solo', 'campaign', true);
  assert.deepEqual([camp.consult, camp.direct], [true, false]);
  assert.equal(H.newTaskChoices('solo', 'plain', false).direct, false);
});

test('머리글: 탭은 과제·메일·서류 셋이고 만들기 단추는 하나다', () => {
  const h = H.headerHtml('docs');
  assert.equal((h.match(/role="tab"/g) || []).length, 3);
  assert.match(h, /aria-selected="true" data-hub-act="tab-docs"/);
  assert.equal((h.match(/hub-new/g) || []).length, 1);
  for (const a of ['contacts', 'forms', 'notif', 'sim', 'new-task', 'new-mail', 'new-doc', 'othersite']) assert.ok(h.includes('data-hub-act="' + a + '"'), a);
});
