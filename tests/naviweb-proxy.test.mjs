import test from 'node:test';
import assert from 'node:assert/strict';
import { route } from '../ops/naviweb-proxy/worker.js';
const r = (p) => route(new URL('https://naviweb.kr' + p));
test('naviweb-proxy 라우팅', () => {
  assert.equal(r('/').target, 'https://mail.hondi.net/desktop.html');
  assert.equal(r('/manual.html?embed=mail').target, 'https://mail.hondi.net/manual.html?embed=mail');
  assert.deepEqual(r('/_h/pdv.html?embed=mail'), { target: 'https://hondi.net/pdv.html?embed=mail', hondi: true });
  assert.equal(r('/src/gopang/services/push.js').target, 'https://hondi.net/src/gopang/services/push.js');
  assert.equal(r('/icons/a.png').target, 'https://mail.hondi.net/icons/a.png');
});
