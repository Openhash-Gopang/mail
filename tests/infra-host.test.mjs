import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let JSDOM = null; try { ({ JSDOM } = await import('jsdom')); } catch (e) { /* jsdom 이 없으면 건너뛴다 */ }
const skip = !JSDOM && 'jsdom 없음';
const src = readFileSync(new URL('../infra-host.js', import.meta.url), 'utf8');
const d = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
function env() {
  const dom = new JSDOM('<!DOCTYPE html><button id="hchat-fab"></button>', { runScripts: 'outside-only', url: 'https://naviweb.kr/' }); const w = dom.window;
  const posted = [], sps = [], frame = {};
  w.HondiChat = { isOpen: () => false, close() {}, setSp: (m) => sps.push(m), post: (m) => { posted.push(m); return true; }, frameWindow: () => frame, notify() {}, onFab: null };
  w._hcOrigin = () => true; w._orgMd = (t) => '<p>' + String(t).replace(/</g, '&lt;') + '</p>'; w._org = null;
  w.eval(src); return { w, posted, sps, frame, doc: w.document };
}
const cfg = (k, sp, label) => ({ key: k, label, sp, greeting: '안녕하세요 ' + label, examples: ['예시 하나'], placeholder: '말씀해 주세요' });
const reply = (e, id, text) => e.w.dispatchEvent(Object.assign(new e.w.Event('message'), { data: { type: 'hondi-embed-sp-reply', id, text }, source: e.frame, origin: 'https://naviweb.kr' }));
const ready = (e) => e.w.dispatchEvent(Object.assign(new e.w.Event('message'), { data: { type: 'hondi-embed-sp-ready' }, source: e.frame, origin: 'https://naviweb.kr' }));

test('enter: SP 키를 대화창에 알리고, 우하단 아이콘이 이 패널을 연다', { skip }, () => {
  const e = env(); assert.equal(e.w.InfraHost.enter(cfg('med', 'SP-04_khealth', '의료 SP')), true);
  assert.equal(e.sps[0].sp, 'SP-04_khealth'); assert.equal(e.w.InfraHost.cur(), 'med');
  assert.equal(e.w.HondiChat.onFab(), true); assert.ok(e.doc.getElementById('ichat-panel').classList.contains('open'));
  assert.match(e.doc.getElementById('ichat-thread').textContent, /안녕하세요 의료 SP/); assert.equal(e.doc.getElementById('hchat-fab').getAttribute('aria-label'), '의료 SP 대화');
  assert.equal(e.w.InfraHost.enter({ key: 'x', sp: '' }), false);
});

test('send: 질문을 SP로 보내고, 답은 이스케이프해서 보여 주며, 인프라별 대화가 따로 남는다', { skip }, () => {
  const e = env(); e.w.InfraHost.enter(cfg('med', 'SP-04_khealth', '의료 SP')); ready(e);
  e.w.HondiChat.onFab(); const inp = e.doc.getElementById('ichat-in'); inp.value = '허리가 아파요'; e.doc.getElementById('ichat-form').dispatchEvent(new e.w.Event('submit', { cancelable: true }));
  assert.equal(e.posted.length, 1); assert.equal(e.posted[0].type, 'hondi-embed-sp-ask'); assert.equal(e.posted[0].text, '허리가 아파요');
  reply(e, e.posted[0].id, '<b>쉬세요</b>'); assert.match(e.doc.getElementById('ichat-thread').innerHTML, /&lt;b&gt;쉬세요/);
  e.w.InfraHost.enter(cfg('law', 'SP-01_klaw', '법률 SP')); assert.equal(e.sps.at(-1).sp, 'SP-01_klaw'); assert.equal(e.doc.getElementById('ichat-title').textContent, '법률 SP');
  assert.doesNotMatch(e.doc.getElementById('ichat-thread').textContent, /허리가 아파요/);
  e.w.InfraHost.enter(cfg('med', 'SP-04_khealth', '의료 SP')); assert.match(e.doc.getElementById('ichat-thread').textContent, /허리가 아파요/);
});

test('ask: 패널을 열고 입력칸만 채운다(보내지 않음). leave: 닫고 대화창 SP를 되돌린다', { skip }, () => {
  const e = env(); e.w.InfraHost.enter(cfg('law', 'SP-01_klaw', '법률 SP')); e.w.InfraHost.ask('보증금 문제');
  assert.equal(e.doc.getElementById('ichat-in').value, '보증금 문제'); assert.equal(e.posted.length, 0); assert.ok(e.doc.getElementById('ichat-panel').classList.contains('open'));
  e.w.InfraHost.leave(); assert.equal(e.w.InfraHost.active(), false); assert.equal(e.w.HondiChat.onFab === null, false); assert.equal(e.sps.at(-1), null);
  assert.ok(!e.doc.getElementById('ichat-panel').classList.contains('open')); e.w.InfraHost.ask('x'); assert.equal(e.doc.getElementById('ichat-in').value, '보증금 문제');
});

test('엉뚱한 출처의 메시지는 무시', { skip }, () => {
  const e = env(); e.w.InfraHost.enter(cfg('med', 'SP-04_khealth', '의료 SP')); ready(e); e.w.InfraHost.ask('a'); e.doc.getElementById('ichat-in').value = '질문';
  e.doc.getElementById('ichat-form').dispatchEvent(new e.w.Event('submit', { cancelable: true })); const id = e.posted[0].id;
  e.w.dispatchEvent(Object.assign(new e.w.Event('message'), { data: { type: 'hondi-embed-sp-reply', id, text: '가짜' }, source: {}, origin: 'https://evil.example' }));
  assert.doesNotMatch(e.doc.getElementById('ichat-thread').textContent, /가짜/);
});

test('인프라 SP v0.1: 27개 모두 전문가 SP·설정이 있다', { skip }, () => {
  const w = new JSDOM('', { runScripts: 'outside-only' }).window; w.eval(readFileSync(new URL('../infra-sp.js', import.meta.url), 'utf8')); const S = w.InfraSP;
  assert.equal(S.VERSION, 'v0.1'); assert.equal(S.KEYS.length, 27);
  const items = [...d.match(/const _ORG_ITEMS = (\[.*\]);/)[1].matchAll(/\['(\w+)','([^']+)'\]/g)].map((m) => [m[1], m[2]]); assert.equal(items.length, 27);
  for (const [k, n] of items) { assert.ok(S.has(k), k); assert.equal(S.name(k), n); const c = S.cfg(k); assert.equal(c.sp, 'inline:' + k + ':v0.1'); assert.match(c.spText, /v0\.1/); assert.match(c.spText, new RegExp('"' + n.replace('·', '·') + ' SP"')); assert.match(c.spText, /통달한|전문가/); assert.equal(c.examples.length, 3); assert.ok(c.spText.length > 400 && c.spText.length < 4000); assert.match(c.spText, /실제 처리는 하지 않고/); }
  assert.match(S.build('gdc'), /시중은행과 중앙은행의 모든 업무에 통달/); assert.match(S.build('klaw'), /법률 전문가/); assert.match(S.build('k119'), /119/); assert.match(S.build('kpolice'), /112/);
  assert.match(S.build('kstock'), /분식 회계가 불가능/); assert.match(S.build('kinsurance'), /보험 인프라 AI만 접근/); assert.match(S.build('ktax'), /국세청 AI/); assert.match(S.build('ktax'), /거래 일련번호/);
  assert.match(S.build('kmarket'), /구매 원함/); assert.match(S.build('kmarket'), /필요도를 1~5/); assert.match(S.build('ktraffic'), /1\/2 이하/); assert.match(S.build('khealth'), /의료진이 하며/);
  assert.equal(S.build('nope'), ''); assert.equal(S.cfg('nope'), null);
});

test('desktop.html: 인프라를 고르면 화면과 SP를 함께 부른다', { skip }, () => {
  assert.ok(d.includes('<script src="infra-sp.js') && d.includes('<script src="infra-host.js'));
  assert.ok(d.includes("if (key === 'klaw') { _infraVia = key; _switchTab('verdict'); return; }") && d.includes("if (key === 'ksecurity') { _infraVia = key; _switchTab('vault'); return; }") && d.includes("if (key === 'kmail') { _infraVia = key; _switchTab('mail'); return; }"));
  assert.ok(d.includes("if (window.InfraSP && InfraSP.has(key)) { _infraOpen(key); return; }") && d.includes('id="tab-infra"') && d.includes('id="infra-root"'));
  assert.ok(d.includes('_infraChatSync(name);')); for (const t of ['bank', 'stock', 'insure', 'emg', 'pol', 'med', 'tax', 'mkt', 'trf']) assert.ok(d.includes("_infraChatSync('" + t + "')"), t);
});
