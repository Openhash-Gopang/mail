/**
 * tests/case-host.test.mjs — 메일 화면 연결(case-host.js)의 두 사람 시나리오 (가짜 서버, DOM·IndexedDB 없음)
 *   A = CaseHost 를 쓰는 화면(맡은 쪽), B = CaseNet 을 직접 쓰는 상대(맡긴 쪽)
 * 실행: node --test tests/case-host.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
['case-core', 'case-invite', 'case-store', 'case-sync', 'case-seal', 'case-net', 'case-host', 'case-ui'].forEach(f => require('../' + f + '.js'));
const G = globalThis;
const { CaseStore, MemoryAdapter } = G.CaseStore, { CaseNet } = G.CaseNet, { CaseHost } = G, { CaseSync, CaseSeal, CaseCore } = G;

// 아주 작은 가짜 서버: 키 보관, 우편함, 초대 등록, 로그인(=호출자 guid)
function fakeServer() {
  const keys = {}, boxes = {}, invites = {}; let n = 0;
  const handler = (guid) => async (route, body) => {
    const J = (status, json) => ({ status, json });
    if (route === '/auth/session-profile') return J(200, { ok: true, guid });
    if (route === '/case/key/register') { keys[guid] = body.record; return J(200, { ok: true }); }
    if (route === '/case/key/get') return keys[body.peer] ? J(200, { ok: true, record: keys[body.peer] }) : J(404, { ok: false, code: 'KEY_NOT_FOUND' });
    if (route === '/case/invite/register') { if (invites[body.token_hash]) return J(409, { ok: false, code: 'ALREADY_REGISTERED' }); invites[body.token_hash] = guid; return J(200, { ok: true }); }
    if (route === '/case/mailbox/push') { const e = body.envelope; if (e.from !== guid) return J(403, { ok: false, code: 'FROM_MISMATCH' }); (boxes[e.to] = boxes[e.to] || []).push({ id: String(++n), envelope: e }); return J(200, { ok: true }); }
    if (route === '/case/mailbox/pull') return J(200, { ok: true, items: (boxes[guid] || []).slice() });
    if (route === '/case/mailbox/ack') { boxes[guid] = (boxes[guid] || []).filter(i => !body.ids.includes(i.id)); return J(200, { ok: true }); }
    if (route === '/case/invite/claim') {
      const th = await CaseCore.sha256Hex('inv:' + body.token), inviter = invites[th];
      if (!inviter) return J(404, { ok: false, code: 'INVITE_NOT_FOUND' });
      if (body.key_record) keys[guid] = body.key_record;
      (boxes[inviter] = boxes[inviter] || []).push({ id: String(++n), server_notice: { type: 'invite_signed_up', token_hash: th, invitee_user_id: guid, invitee_mail_id: body.mail_id + '@naviweb.kr', email_match: true, signed_up_at: '2026-11-01T00:00:00Z' } });
      return J(200, { ok: true, inviter_user_id: inviter, inviter_keys: keys[inviter] || null });
    }
    return J(404, { ok: false, code: 'NO_ROUTE' });
  };
  return { handler, boxes, invites, keys, drop: (to, item) => (boxes[to] = boxes[to] || []).push(Object.assign({ id: String(++n) }, item)) };
}

async function setup() {
  const srv = fakeServer();
  // A — 화면(CaseHost)
  CaseHost._reset(); G.CaseUI._reset(); G.CASE_UI_CONFIG = {};
  const idA = await CaseSync.generateIdentity(), boxA = await CaseSeal.generateBoxKey();
  await CaseHost.initLocal({ identity: idA, box: boxA });
  G.CASE_UI_CONFIG = Object.assign(G.CASE_UI_CONFIG || {}, { adapter: MemoryAdapter() });
  const storeA = G.CaseUI._store();
  const ns = await CaseHost.net(srv.handler('A'), 'A');
  // B — 상대
  const idB = await CaseSync.generateIdentity(), boxB = await CaseSeal.generateBoxKey(), storeB = new CaseStore(MemoryAdapter(), { identity: idB });
  const netB = CaseNet({ store: storeB, box: boxB, identity: idB, call: srv.handler('B'), guid: 'B' });
  assert.equal((await netB.registerKeys()).status, 200);
  return { srv, idA, idB, storeA, storeB, netB, ns };
}

test('내 키를 서버에 한 번 등록한다', async () => {
  const { srv, idA } = await setup();
  assert.equal(srv.keys.A.sign_pub, idA.pub);
});

test('초대 등록 → 가입 알림(token_hash)으로 일을 찾아 상대·키를 기록한다', async () => {
  const { srv, storeA, idA, idB } = await setup();
  await storeA.createCase({ case_id: 'c1', title: '○○ 사건', kind: 'case', my_side: 'provider' });
  await storeA.patchCase('c1', { invitation: { token_hash: 'a'.repeat(64) } });
  assert.deepEqual(await CaseHost.registerInvite('c1'), { ok: true });
  assert.equal((await storeA.getCase('c1')).invite_registered, true);
  // 같은 초대를 한 번 더 등록해도 성공으로 본다(ALREADY_REGISTERED)
  assert.equal((await CaseHost.registerInvite('c1')).ok, true);
  srv.drop('A', { server_notice: { type: 'invite_signed_up', token_hash: 'a'.repeat(64), invitee_user_id: 'B', invitee_mail_id: 'b@naviweb.kr', email_match: true, signed_up_at: '2026-11-01T00:00:00Z' } });
  const r = await CaseHost.poll();
  assert.equal(r.ok, true); assert.deepEqual(r.joined, ['c1']);
  const c = await storeA.getCase('c1');
  assert.equal(c.peer, 'B'); assert.equal(c.peer_mail, 'b@naviweb.kr');
  assert.equal(c.keys.provider, idA.pub); assert.equal(c.keys.consumer, idB.pub);
  const ki = await CaseHost.keyInfo('c1');
  assert.ok(ki.ready && ki.mine && ki.peer && ki.mine !== ki.peer);
  assert.equal(srv.boxes.A.length, 0);   // 알림은 ack 로 지워졌다
});

test('token_hash 가 다른 알림은 엉뚱한 일에 붙이지 않는다', async () => {
  const { srv, storeA } = await setup();
  await storeA.createCase({ case_id: 'c1', title: 't', kind: 'case', my_side: 'provider' });
  await storeA.patchCase('c1', { invitation: { token_hash: 'a'.repeat(64) } });
  await storeA.createCase({ case_id: 'c2', title: 't2', kind: 'case', my_side: 'provider' });
  await storeA.patchCase('c2', { invitation: { token_hash: 'b'.repeat(64) } });
  srv.drop('A', { server_notice: { type: 'invite_signed_up', token_hash: 'c'.repeat(64), invitee_user_id: 'B' } });
  const r = await CaseHost.poll();
  assert.deepEqual(r.joined, []);
  assert.equal((await storeA.getCase('c1')).peer, undefined);
});

test('합의: 양측 서명 → 맡은 쪽이 성립·시작 → 종료 요청·동의까지 두 기기에서 같은 상태', async () => {
  const { srv, storeA, storeB, netB, idA, idB } = await setup();
  await storeA.createCase({ case_id: 'c1', title: '○○ 사건', kind: 'case', my_side: 'provider' });
  await storeA.patchCase('c1', { invitation: { token_hash: 'a'.repeat(64) }, peer: 'B' });
  assert.equal((await CaseHost.ensureKeys('c1')).ok, true);
  // B 쪽 일(같은 case_id, 맡긴 쪽)
  await storeB.createCase({ case_id: 'c1', title: '○○ 사건', kind: 'case', my_side: 'consumer' });
  await storeB.setKeys('c1', { provider: idA.pub, consumer: idB.pub });
  await storeB.patchCase('c1', { peer: 'A', peer_keys: { peer: 'A', record: srv.keys.A } });
  const proposal = { case_id: 'c1', title: '○○ 사건', kind: 'case' };

  // A 서명 → 전송
  const a1 = await storeA.confirmAgreement('c1', proposal); assert.ok(a1.ok);
  await CaseHost.enqueue('c1', [a1.event]);
  assert.deepEqual(await CaseHost.flush('c1'), { ok: true, sent: 1 });
  assert.equal((await storeA.getCase('c1')).outq.length, 0);
  // B 가 받아서 서명 → 전송
  assert.equal((await netB.poll()).applied, 1);
  const b1 = await storeB.confirmAgreement('c1', proposal); assert.ok(b1.ok);
  assert.equal((await netB.sendEvents('c1', 'A', [b1.event])).ok, true);
  assert.equal((await CaseHost.poll()).applied, 1);
  // A(맡은 쪽)가 합의 성립 → 시작 (모든 전이는 서명 이벤트로 상대에게 간다)
  const acc = await storeA.applyTransition('c1', 'accept', { side: 'provider' }, { visibility: 'shared' });
  const act = await storeA.applyTransition('c1', 'activate', { side: 'provider' }, { visibility: 'shared' });
  assert.ok(acc.ok && acc.event && act.ok && act.event);
  await CaseHost.enqueue('c1', [acc.event, act.event]);
  assert.deepEqual(await CaseHost.flush('c1'), { ok: true, sent: 2 });
  assert.equal((await netB.poll()).applied, 2);
  assert.equal((await storeB.getCase('c1')).state, 'active'); assert.equal((await storeA.getCase('c1')).state, 'active');
  // B 가 종료 요청 → A 가 동의 → 둘 다 종료
  const rq = await storeB.applyTransition('c1', 'request_close', { side: 'consumer', outcome: '완료' }, { visibility: 'shared', payload: { outcome: '완료' } });
  assert.ok(rq.ok && rq.event);
  assert.equal((await netB.sendEvents('c1', 'A', [rq.event])).ok, true);
  assert.equal((await CaseHost.poll()).applied, 1);
  assert.equal((await storeA.getCase('c1')).state, 'closing');
  const cl = await storeA.applyTransition('c1', 'close_agree', { side: 'provider' }, { visibility: 'shared' });
  assert.ok(cl.ok && cl.event); await CaseHost.enqueue('c1', [cl.event]); await CaseHost.flush('c1');
  assert.equal((await netB.poll()).applied, 1);
  assert.equal((await storeB.getCase('c1')).state, 'closed'); assert.equal((await storeA.getCase('c1')).state, 'closed');
  void srv;
});

test('상대 키가 바뀌면(KEY_CHANGED) 보내지 않고 이유를 알린다', async () => {
  const { srv, storeA, idA } = await setup();
  await storeA.createCase({ case_id: 'c1', title: 't', kind: 'case', my_side: 'provider' });
  await storeA.patchCase('c1', { peer: 'B' });
  // B 가 처음 등록한 키
  const idB1 = await CaseSync.generateIdentity(), boxB1 = await CaseSeal.generateBoxKey();
  srv.keys.B = await CaseSeal.bindBoxKey(idB1, boxB1.pub);
  assert.equal((await CaseHost.ensureKeys('c1')).ok, true);
  // 서버의 B 키가 다른 키로 교체됨
  const idB2 = await CaseSync.generateIdentity(), boxB2 = await CaseSeal.generateBoxKey();
  srv.keys.B = await CaseSeal.bindBoxKey(idB2, boxB2.pub);
  await CaseHost.enqueue('c1', [{ v: 1, kind: 'shared_entry', case_id: 'c1', side: 'provider', data: {}, sig: 'x' }]);
  const r = await CaseHost.flush('c1');
  assert.equal(r.ok, false); assert.equal(r.code, 'KEY_CHANGED');
  assert.equal(srv.boxes.B, undefined);   // 아무것도 전송되지 않았다
  assert.equal((await storeA.getCase('c1')).outq.length, 1);   // 대기열에 남아 있다
  void idA;
});

test('내가 쓴 공유 메모는 collectShared 로 이벤트가 되어 상대 화면에 상대 기록으로 들어간다', async () => {
  const { srv, storeA, storeB, netB, idA, idB } = await setup();
  await storeA.createCase({ case_id: 'c1', title: 't', kind: 'case', my_side: 'provider' });
  await storeA.patchCase('c1', { peer: 'B' });
  await CaseHost.ensureKeys('c1');
  await storeB.createCase({ case_id: 'c1', title: 't', kind: 'case', my_side: 'consumer' });
  await storeB.setKeys('c1', { provider: idA.pub, consumer: idB.pub });
  await storeA.append('c1', { type: 'note', actor_side: 'provider', visibility: 'shared', payload: { text: '서류 접수했습니다' } });
  await storeA.append('c1', { type: 'note', actor_side: 'provider', visibility: 'internal', payload: { text: '내부 메모' } });
  assert.deepEqual(await CaseHost.flush('c1'), { ok: true, sent: 1 });          // 공유분만
  assert.equal((await netB.poll()).applied, 1);
  const pe = await storeB.peerEntries('c1');
  assert.equal(pe.length, 1); assert.equal(pe[0].payload.text, '서류 접수했습니다');
  assert.deepEqual(await CaseHost.flush('c1'), { ok: true, sent: 0 });           // 다시 보내지 않는다
  void srv;
});

test('초청자(화면) → 가입 알림 → 제안 자동 전송 → 초대받은 상대 기기가 일을 만들고 키를 맞춘다', async () => {
  const { srv, storeA, netB, storeB, idA, idB } = await setup();
  const inv = await G.CaseInvite.createInvitation({ case_id: 'c7', inviter_id: 'A', inviter_side: 'provider', invitee_email: 'x@y.co' });
  await storeA.createCase({ case_id: 'c7', title: '○○ 사건', kind: 'case', my_side: 'provider' });
  await storeA.patchCase('c7', { invitation: inv.invitation });
  await CaseHost.registerInvite('c7');
  const cl = await netB.claimInvite(inv.token, 'bmail');
  assert.equal(cl.ok, true);
  const r = await CaseHost.poll();                                   // 알림 → 키 → 제안 전송
  assert.deepEqual(r.joined, ['c7']);
  assert.equal((await storeA.getCase('c7')).proposal_sent, true);
  let made = null;
  const rb = await netB.poll({ onProposal: async (pv, env) => { made = pv; await storeB.createCase({ case_id: pv.case_id, title: pv.title, kind: pv.kind, my_side: 'consumer' }); return { ok: true }; } });
  assert.equal(rb.proposals, 1); assert.equal(made.title, '○○ 사건');
  assert.equal((await CaseHost.flush('c7')).ok, true);               // 제안은 한 번만 간다
  assert.equal((srv.boxes.B || []).length, 0);
  void idA; void idB;
});

test('초대받은 쪽(화면): claim → 제안 도착 시 일이 만들어지고(제안됨·받은 제안), 초청자 키가 일에 기록된다', async () => {
  const srv = fakeServer();
  CaseHost._reset(); G.CaseUI._reset(); G.CASE_UI_CONFIG = { adapter: MemoryAdapter(), };
  G.CASE_HOST_CFG = { mailId: async () => 'bmail' };
  const idB = await CaseSync.generateIdentity(), boxB = await CaseSeal.generateBoxKey();
  await CaseHost.initLocal({ identity: idB, box: boxB });
  const storeB = G.CaseUI._store(); await CaseHost.net(srv.handler('B'), 'B');
  // 초청자 A(직접)
  const idA = await CaseSync.generateIdentity(), boxA = await CaseSeal.generateBoxKey(), storeA = new CaseStore(MemoryAdapter(), { identity: idA });
  const netA = CaseNet({ store: storeA, box: boxA, identity: idA, call: srv.handler('A'), guid: 'A' }); await netA.registerKeys();
  const inv = await G.CaseInvite.createInvitation({ case_id: 'c8', inviter_id: 'A', inviter_side: 'consumer', invitee_email: 'x@y.co' });
  await srv.handler('A')('/case/invite/register', { token_hash: inv.invitation.token_hash });
  await storeA.createCase({ case_id: 'c8', title: '무릎 치료', kind: 'case', my_side: 'consumer' });
  const cl = await CaseHost.claim(inv.token);
  assert.equal(cl.ok, true); assert.equal(cl.inviter, 'A');
  await netA.poll(); await storeA.patchCase('c8', { peer: 'B' });
  assert.equal((await netA.sendProposal('c8', 'B', { case_id: 'c8', title: '무릎 치료', kind: 'case', inviter_side: 'consumer' })).ok, true);
  const r = await CaseHost.poll();
  assert.equal(r.proposals, 1);
  const c = await storeB.getCase('c8');
  assert.equal(c.state, 'proposed'); assert.equal(c.my_side, 'provider'); assert.equal(c.peer, 'A'); assert.equal(c.incoming, true);
  assert.equal(c.keys.provider, idB.pub); assert.equal(c.keys.consumer, idA.pub);
  // 메일 아이디가 없으면 수락하지 않는다
  G.CASE_HOST_CFG = { mailId: async () => '' };
  assert.equal((await CaseHost.claim(inv.token)).code, 'NO_MAIL_ID');
});

test('초대 메일: 링크와 안내만 보내고 사건 제목은 넣지 않는다. 실패하면 보냄 표시를 하지 않는다', async () => {
  const { storeA } = await setup();
  const inv = await G.CaseInvite.createInvitation({ case_id: 'cm', inviter_id: 'A', inviter_side: 'provider', invitee_email: 'client@example.com', signup_base: 'https://mail.hondi.net/desktop.html?case=1' });
  await storeA.createCase({ case_id: 'cm', title: '비밀 사건명', kind: 'case', my_side: 'provider' });
  await storeA.patchCase('cm', { invitation: inv.invitation, invite_link: inv.link });
  assert.ok(inv.link.startsWith('https://mail.hondi.net/desktop.html?case=1&inv='));
  const sent = [];
  G.CASE_HOST_CFG = { sendMail: async (to, subject, text) => { sent.push({ to, subject, text }); } };
  G.CASE_UI_CONFIG.userName = '홍변호사';
  assert.deepEqual(await CaseHost.sendInviteMail('cm'), { ok: true });
  assert.equal(sent[0].to, 'client@example.com'); assert.ok(sent[0].text.includes(inv.link)); assert.ok(sent[0].text.includes('홍변호사'));
  assert.ok(!sent[0].text.includes('비밀 사건명') && !sent[0].subject.includes('비밀 사건명'));
  assert.ok((await storeA.getCase('cm')).invite_mail_sent_at);
  await storeA.patchCase('cm', { invite_mail_sent_at: null });
  G.CASE_HOST_CFG = { sendMail: async () => { throw new Error('boom'); } };
  const r = await CaseHost.sendInviteMail('cm');
  assert.equal(r.ok, false); assert.equal(r.code, 'SEND_FAILED');
  assert.equal((await storeA.getCase('cm')).invite_mail_sent_at, null);
  G.CASE_HOST_CFG = {};
  assert.equal((await CaseHost.sendInviteMail('cm')).code, 'NO_MAILER');
});
