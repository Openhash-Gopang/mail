/**
 * tests/case-assist.test.mjs — 화면 쪽 비서 연결(case-assist.js): 신호 줄·행위 점검·선택 기록 (DOM 없음)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.location = { search: '?case=1', origin: 'https://mail.hondi.net' };
['case-core', 'case-invite', 'case-store', 'case-sync', 'case-seal', 'case-net', 'assistant-core', 'assistant-rules', 'assistant-runtime', 'assistant-host', 'case-host', 'case-ui', 'case-assist'].forEach(f => require('../' + f + '.js'));
const G = globalThis, { MemoryAdapter } = G.CaseStore;

async function fresh() {
  G.CaseHost._reset(); G.CaseUI._reset(); G.CaseAssist._reset(); G.CASE_UI_CONFIG = { adapter: MemoryAdapter() };
  const identity = await G.CaseSync.generateIdentity(), box = await G.CaseSeal.generateBoxKey();
  await G.CaseHost.initLocal({ identity, box });
  return G.CaseUI._store();
}

test('신호 줄: 기능 플래그가 꺼져 있으면 항상 빈 배열(대화에 아무것도 붙지 않는다)', async () => {
  await fresh(); G.location = { search: '' }; try { sessionStorage; } catch (_) {}
  assert.deepEqual(await G.CaseAssist.lines(), []);
  G.location = { search: '?case=1', origin: 'https://mail.hondi.net' };
});

test('신호 줄: 사용자가 정한 기한이 임박하면 코드가 계산한 줄이 나오고, 같은 날 반복하지 않는다', async () => {
  const store = await fresh();
  await store.createCase({ mode: 'solo', case_id: 's1', title: '임대차 분쟁', kind: 'case' });
  await store.patchCase('s1', { deadlines: [{ label: '답변서 제출', due: new Date(Date.now() + 86400000).toISOString() }] });
  const l = await G.CaseAssist.lines();
  assert.ok(l.some(x => /^기한:답변서 제출 D-1/.test(x)), l.join('|'));
  assert.equal((await G.CaseAssist.lines()).length, 0);
});

test('행위 점검: 경고는 사용자가 정하고(선택 기록), BLOCK 은 묻지 않고 막으며, 기록에는 입력 해시만 남는다', async () => {
  await fresh();
  let asked = 0;
  const yes = async () => { asked++; return true; }, no = async () => { asked++; return false; };
  const agree = { type: 'case.agree', effect: 'signature' };
  let r = await G.CaseAssist.check(agree, { peer_fp_verified: false }, yes);
  assert.equal(r.proceed, true); assert.equal(asked, 1);
  r = await G.CaseAssist.check(agree, { peer_fp_verified: false }, no);
  assert.equal(r.proceed, false);
  r = await G.CaseAssist.check(agree, { peer_fp_verified: true }, no);       // 통과: 묻지 않는다
  assert.equal(r.proceed, true); assert.equal(asked, 2);
  r = await G.CaseAssist.check({ type: 'case.close', effect: 'external' }, { unpaid_invoices: 1 }, yes);
  assert.equal(r.blocked, true); assert.equal(r.proceed, false); assert.equal(asked, 2);
  const h = await G.CaseAssist.get(), e = (await h.ledger.entries()).filter(x => x.type === 'attestation');
  assert.deepEqual(e.map(x => x.payload.user_decision), ['continue', 'hold', null, 'blocked']);
  assert.ok(e.every(x => /^[0-9a-f]{64}$/.test(x.payload.input_hash)));
  assert.equal((await h.ledger.verify()).ok, true);
});
