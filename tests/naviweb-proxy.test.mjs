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

import { readFileSync as _rf } from 'node:fs';
test('mail.hondi.net 직접 접속은 naviweb.kr 로 보낸다(desktop·webapp)', () => {
  for (const f of ['desktop.html', 'webapp.html']) {
    const s = _rf(new URL('../' + f, import.meta.url), 'utf8');
    assert.ok(s.includes("location.hostname === 'mail.hondi.net'"), f);
    assert.ok(s.includes("location.replace('https://naviweb.kr'"), f);
  }
});
