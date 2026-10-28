/**
 * tests/hondi-chat.test.mjs — 혼디 대화 떠 있는 패널의 순수 함수 (DOM 없음).
 * 실행: node --test tests/hondi-chat.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { _pure: P } = require('../hondi-chat.js');

test('panelBox: 좁은 화면(폰)은 전체 화면, 넓은 화면은 우측 하단 카드', () => {
  assert.deepEqual(P.panelBox(390, 800), { full: true, width: 390, height: 800 });
  assert.deepEqual(P.panelBox(640, 800), { full: true, width: 640, height: 800 });
  const b = P.panelBox(1440, 900);
  assert.equal(b.full, false); assert.equal(b.width, 440); assert.equal(b.height, 780);
  assert.equal(P.panelBox(1000, 500).height, 420, '낮은 화면에서도 최소 높이');
  assert.equal(P.panelBox(700, 900).width, 440);
  assert.equal(P.panelBox(660, 900).width, 440);
});
test('isIncomingMessage: 혼디 앱 출처의 hondi:incoming 만 인정', () => {
  const ok = { origin: 'https://hondi.net', data: { type: 'hondi:incoming' } };
  assert.equal(P.isIncomingMessage(ok, 'https://hondi.net'), true);
  assert.equal(P.isIncomingMessage({ origin: 'https://evil.example', data: { type: 'hondi:incoming' } }, 'https://hondi.net'), false, '다른 출처는 무시');
  assert.equal(P.isIncomingMessage({ origin: 'https://hondi.net', data: { type: 'x' } }, 'https://hondi.net'), false);
  assert.equal(P.isIncomingMessage({ origin: 'https://hondi.net', data: 'hondi:incoming' }, 'https://hondi.net'), false);
  assert.equal(P.isIncomingMessage(null, 'https://hondi.net'), false);
});
test('originOf', () => {
  assert.equal(P.originOf('https://hondi.net/webapp.html'), 'https://hondi.net');
  assert.equal(P.originOf('not a url'), '');
});

test('testIdFromToken: 테스트 아이디 토큰(tid-<아이디>:…)에서만 아이디를 뽑는다', () => {
  assert.equal(P.testIdFromToken('tid-ceo:1793000000000.abcdef'), 'ceo');
  assert.equal(P.testIdFromToken('tid-느긋한돌하르방:123.sig'), '느긋한돌하르방');
  assert.equal(P.testIdFromToken('tid-ceo'), 'ceo');
  assert.equal(P.testIdFromToken('abc123:1.sig'), '', '전화 인증 토큰은 아이디를 알 수 없음');
  assert.equal(P.testIdFromToken(''), ''); assert.equal(P.testIdFromToken(null), '');
  assert.equal(P.testIdFromToken('tid-a:1.s'), '', '너무 짧은 아이디는 거부');
  assert.equal(P.testIdFromToken('tid-bad id!:1.s'), '', '허용 문자가 아니면 거부');
});
test('panelUrl: 아이디가 있으면 ?testid= 를 붙인다', () => {
  assert.equal(P.panelUrl('https://hondi.net/webapp.html', ''), 'https://hondi.net/webapp.html');
  assert.equal(P.panelUrl('https://hondi.net/webapp.html', 'ceo'), 'https://hondi.net/webapp.html?testid=ceo');
  assert.equal(P.panelUrl('https://hondi.net/webapp.html?x=1', 'ceo'), 'https://hondi.net/webapp.html?x=1&testid=ceo');
  assert.equal(P.panelUrl('https://hondi.net/webapp.html', '느긋'), 'https://hondi.net/webapp.html?testid=%EB%8A%90%EA%B8%8B');
});
