/**
 * tests/hondi-chat.test.mjs — 혼디 대화 떠 있는 패널의 순수 함수 (DOM 없음).
 * 실행: node --test tests/hondi-chat.test.mjs
 */
import test from 'node:test';
import { readFileSync } from 'node:fs';
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
test('대화 패널은 반투명(opacity)·배경 흐림으로 뒤 화면이 비친다', async () => {
  const { readFileSync } = await import('node:fs');
  const s = readFileSync(new URL('../hondi-chat.js', import.meta.url), 'utf8');
  assert.match(s, /#hchat-panel\{[^}]*opacity:\.8;[^}]*backdrop-filter:blur\(2px\)/);
});

test('setSp: 패널 SP 전환 메시지를 보내고 다시 로드돼도 announce 가 재전송한다', () => {
  const j = readFileSync(new URL('../hondi-chat.js', import.meta.url), 'utf8');
  assert.match(j, /function setSp\(msg\)/);
  assert.match(j, /setSp: setSp/);
  assert.match(j, /S\.spMsg \? 'self' : 'delegate'/);
});

import { readFileSync as _rf } from 'node:fs';
test('대화창 상단: "혼디 대화" 문구는 없고, 나비웹 도우미 버전이 상단 중앙 자리를 쓴다', () => {
  const js = _rf(new URL('../hondi-chat.js', import.meta.url), 'utf8'), html = _rf(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(!js.includes('💬 혼디 대화'));
  assert.match(js, /id="hchat-agent"/); assert.match(js, /#hchat-agent\{position:absolute;left:50%/);
  assert.match(html, /function _agentBadgePlace\(\)/);
});


test('clampGeo·resizeGeo: 사용자가 정한 위치·크기는 화면 안에, 최소 크기 아래로는 줄지 않는다', () => {
  assert.equal(P.clampGeo(null, 1440, 900), null);
  assert.equal(P.clampGeo({ left: 'a', top: 0, width: 400, height: 400 }, 1440, 900), null);
  assert.deepEqual(P.clampGeo({ left: -50, top: -20, width: 500, height: 600 }, 1440, 900), { left: 0, top: 0, width: 500, height: 600 });
  assert.deepEqual(P.clampGeo({ left: 1400, top: 880, width: 500, height: 600 }, 1440, 900), { left: 940, top: 300, width: 500, height: 600 });
  assert.deepEqual(P.clampGeo({ left: 0, top: 0, width: 9999, height: 9999 }, 1440, 900), { left: 0, top: 0, width: 1440, height: 900 });
  assert.equal(P.clampGeo({ left: 0, top: 0, width: 50, height: 50 }, 1440, 900).width, 300);
  const g = { left: 900, top: 100, width: 440, height: 700 };
  assert.deepEqual(P.resizeGeo(g, 'w', -100, 0), { left: 800, top: 100, width: 540, height: 700 });
  assert.deepEqual(P.resizeGeo(g, 'n', 0, 60), { left: 900, top: 160, width: 440, height: 640 });
  assert.deepEqual(P.resizeGeo(g, 'se', 30, 40), { left: 900, top: 100, width: 470, height: 740 });
  const small = P.resizeGeo(g, 'w', 400, 0);
  assert.equal(small.width, 300); assert.equal(small.left + small.width, g.left + g.width, '왼쪽 가장자리를 끌어도 오른쪽 가장자리는 제자리');
});
